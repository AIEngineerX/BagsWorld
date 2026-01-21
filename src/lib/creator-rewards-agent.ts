// Creator Rewards Agent - Distributes ecosystem fees to top 3 token creators
// Triggers when 10 SOL threshold hit OR 5 days pass (with minimum 10 SOL)
import { getServerBagsApi, isServerBagsApiConfigured } from "./bags-api-server";
import type { BagsApiClient } from "./bags-api";
import { emitDistribution } from "./agent-coordinator";
import {
  getAgentWallet,
  getAgentPublicKey,
  getAgentBalance,
  getAgentConnection,
  isAgentWalletConfigured,
  signAndSendBase64Transaction,
} from "./agent-wallet";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { ECOSYSTEM_CONFIG } from "./config";
import type { ClaimablePosition } from "./types";

// Agent configuration
export interface CreatorRewardsConfig {
  enabled: boolean;
  thresholdSol: number; // SOL threshold to trigger distribution (default: 10)
  backupTimerMs: number; // Backup timer in ms (default: 5 days)
  minimumDistributionSol: number; // Minimum SOL for timer-based distribution (default: 2)
  checkIntervalMs: number; // How often to check (default: 15 minutes)
  reservePercentage: number; // Percentage kept for gas/operations (default: 10)
  topCreatorsCount: number; // Number of creators to reward (default: 3)
  distribution: {
    first: number; // Percentage for 1st place (default: 50)
    second: number; // Percentage for 2nd place (default: 30)
    third: number; // Percentage for 3rd place (default: 20)
  };
}

// Creator ranking data
export interface CreatorRanking {
  wallet: string;
  tokenMint: string;
  tokenSymbol: string;
  feesGenerated: number; // SOL contributed to ecosystem
  rank: number;
}

// Agent state
export interface CreatorRewardsState {
  isRunning: boolean;
  lastCheck: number;
  lastDistribution: number;
  cycleStartTime: number; // When current accumulation cycle started
  totalDistributed: number;
  distributionCount: number;
  pendingPoolSol: number; // Current accumulated amount
  topCreators: CreatorRanking[];
  errors: string[];
  recentDistributions: Array<{
    timestamp: number;
    totalDistributed: number;
    recipients: Array<{
      wallet: string;
      tokenSymbol: string;
      amount: number;
      rank: number;
    }>;
  }>;
}

// Distribution result
export interface DistributionResult {
  success: boolean;
  totalDistributed: number;
  recipients: Array<{
    wallet: string;
    tokenSymbol: string;
    amount: number;
    rank: number;
    signature?: string;
    error?: string;
  }>;
  errors: string[];
  trigger: "threshold" | "timer";
}

// Default configuration from ECOSYSTEM_CONFIG
const DEFAULT_CONFIG: CreatorRewardsConfig = {
  enabled: true,
  thresholdSol: ECOSYSTEM_CONFIG.ecosystem.rewards.thresholdSol,
  backupTimerMs: ECOSYSTEM_CONFIG.ecosystem.rewards.backupTimerDays * 24 * 60 * 60 * 1000,
  minimumDistributionSol: ECOSYSTEM_CONFIG.ecosystem.rewards.minimumDistributionSol,
  checkIntervalMs: ECOSYSTEM_CONFIG.ecosystem.rewards.checkIntervalMs,
  reservePercentage: ECOSYSTEM_CONFIG.ecosystem.rewards.reservePercentage,
  topCreatorsCount: ECOSYSTEM_CONFIG.ecosystem.rewards.topCreatorsCount,
  distribution: {
    first: ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.first,
    second: ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.second,
    third: ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.third,
  },
};

// Agent state
let agentState: CreatorRewardsState = {
  isRunning: false,
  lastCheck: 0,
  lastDistribution: 0,
  cycleStartTime: Date.now(),
  totalDistributed: 0,
  distributionCount: 0,
  pendingPoolSol: 0,
  topCreators: [],
  errors: [],
  recentDistributions: [],
};

let agentConfig: CreatorRewardsConfig = { ...DEFAULT_CONFIG };
let checkInterval: NodeJS.Timeout | null = null;

// Helper to get the Bags API client (uses shared singleton)
function getBagsApiClient(): BagsApiClient | null {
  if (!isServerBagsApiConfigured()) {
    return null;
  }
  try {
    return getServerBagsApi();
  } catch {
    return null;
  }
}

// Initialize the agent
export function initCreatorRewardsAgent(config?: Partial<CreatorRewardsConfig>): boolean {
  if (!isAgentWalletConfigured()) {
    console.warn("[Creator Rewards] Wallet not configured");
    return false;
  }

  if (!isServerBagsApiConfigured()) {
    console.warn("[Creator Rewards] BAGS_API_KEY not set");
    return false;
  }

  agentConfig = { ...DEFAULT_CONFIG, ...config };

  console.log("[Creator Rewards] Initialized:", {
    wallet: getAgentPublicKey(),
    threshold: `${agentConfig.thresholdSol} SOL`,
    backupTimer: `${agentConfig.backupTimerMs / (24 * 60 * 60 * 1000)} days`,
    minDistribution: `${agentConfig.minimumDistributionSol} SOL`,
    topCreators: agentConfig.topCreatorsCount,
    split: `${agentConfig.distribution.first}/${agentConfig.distribution.second}/${agentConfig.distribution.third}`,
  });

  return true;
}

// Start the agent
export function startCreatorRewardsAgent(): boolean {
  if (!getBagsApiClient()) {
    const initialized = initCreatorRewardsAgent();
    if (!initialized) return false;
  }

  if (agentState.isRunning) {
    console.log("[Creator Rewards] Already running");
    return true;
  }

  agentState.isRunning = true;
  agentState.cycleStartTime = Date.now();

  // Run immediately, then on interval
  runRewardsCheck();

  checkInterval = setInterval(() => {
    runRewardsCheck();
  }, agentConfig.checkIntervalMs);

  console.log("[Creator Rewards] Started");
  return true;
}

// Stop the agent
export function stopCreatorRewardsAgent(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  agentState.isRunning = false;
  console.log("[Creator Rewards] Stopped");
}

// Get top creators by fee contribution
async function getTopCreatorsByFees(): Promise<CreatorRanking[]> {
  try {
    // Fetch from global tokens API which tracks fee generation
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/global-tokens`
    );

    if (!response.ok) {
      console.warn("[Creator Rewards] Failed to fetch global tokens");
      return [];
    }

    const data = await response.json();
    const tokens = data.tokens || [];

    // Map tokens to creator rankings with fee data
    const rankings: CreatorRanking[] = tokens
      .filter((t: any) => t.creatorWallet && t.lifetimeFees > 0)
      .map((t: any) => ({
        wallet: t.creatorWallet,
        tokenMint: t.mint,
        tokenSymbol: t.symbol || "UNKNOWN",
        // Calculate ecosystem fee contribution (1% of lifetime fees)
        feesGenerated: (t.lifetimeFees || 0) * 0.01,
        rank: 0,
      }))
      .sort((a: CreatorRanking, b: CreatorRanking) => b.feesGenerated - a.feesGenerated);

    // Assign ranks
    rankings.forEach((r, i) => {
      r.rank = i + 1;
    });

    return rankings.slice(0, agentConfig.topCreatorsCount);
  } catch (error) {
    console.error("[Creator Rewards] Error fetching creator rankings:", error);
    return [];
  }
}

// Send SOL to a creator wallet
async function sendRewardToCreator(
  recipientWallet: string,
  amountSol: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const wallet = getAgentWallet();
    if (!wallet) {
      return { success: false, error: "Wallet not available" };
    }

    const connection = getAgentConnection();
    const recipient = new PublicKey(recipientWallet);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    // Create transfer instruction
    const transferIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipient,
      lamports,
    });

    // Create and send transaction
    const transaction = new Transaction().add(transferIx);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);

    console.log(`[Creator Rewards] Sent ${amountSol.toFixed(4)} SOL to ${recipientWallet}: ${signature}`);

    return { success: true, signature };
  } catch (error: any) {
    console.error("[Creator Rewards] Transfer error:", error);
    return { success: false, error: error.message || "Transfer failed" };
  }
}

// Main check and distribute routine
export async function runRewardsCheck(): Promise<DistributionResult> {
  const result: DistributionResult = {
    success: false,
    totalDistributed: 0,
    recipients: [],
    errors: [],
    trigger: "threshold",
  };

  try {
    const bagsApi = getBagsApiClient();
    if (!bagsApi) {
      throw new Error("Agent not initialized");
    }

    const wallet = getAgentWallet();
    if (!wallet) {
      throw new Error("Agent wallet not available");
    }

    const walletAddress = wallet.publicKey.toBase58();
    agentState.lastCheck = Date.now();

    // Get claimable positions (ecosystem fees)
    console.log(`[Creator Rewards] Checking claimable fees for ${walletAddress}...`);
    const positions = await bagsApi.getClaimablePositions(walletAddress);

    if (!positions || positions.length === 0) {
      console.log("[Creator Rewards] No claimable positions found");
      agentState.pendingPoolSol = 0;
      result.success = true;
      return result;
    }

    // Calculate total claimable
    const totalClaimable = positions.reduce(
      (sum, p) => sum + p.claimableDisplayAmount,
      0
    );
    agentState.pendingPoolSol = totalClaimable;

    // Get top creators for display
    const topCreators = await getTopCreatorsByFees();
    agentState.topCreators = topCreators;

    console.log(
      `[Creator Rewards] Pool: ${totalClaimable.toFixed(4)} SOL | ` +
      `Threshold: ${agentConfig.thresholdSol} SOL | ` +
      `Days since cycle start: ${((Date.now() - agentState.cycleStartTime) / (24 * 60 * 60 * 1000)).toFixed(1)}`
    );

    // Check if we should distribute
    const timeSinceCycleStart = Date.now() - agentState.cycleStartTime;
    const thresholdMet = totalClaimable >= agentConfig.thresholdSol;
    const timerExpired = timeSinceCycleStart >= agentConfig.backupTimerMs &&
                         totalClaimable >= agentConfig.minimumDistributionSol;

    if (!thresholdMet && !timerExpired) {
      console.log("[Creator Rewards] Neither threshold nor timer conditions met - waiting");
      result.success = true;
      return result;
    }

    result.trigger = thresholdMet ? "threshold" : "timer";
    console.log(
      `[Creator Rewards] DISTRIBUTION TRIGGERED (${result.trigger}) - ` +
      `${totalClaimable.toFixed(4)} SOL to distribute`
    );

    // Claim all positions
    console.log(`[Creator Rewards] Claiming ${positions.length} positions...`);
    const virtualPools = positions.map((p) => p.virtualPool);
    const txResult = await bagsApi.generateClaimTransactions(walletAddress, virtualPools);

    if (!txResult.transactions || txResult.transactions.length === 0) {
      throw new Error("No claim transactions returned from API");
    }

    let claimedAmount = 0;
    for (const txBase64 of txResult.transactions) {
      try {
        const signature = await signAndSendBase64Transaction(txBase64);
        console.log(`[Creator Rewards] Claim tx confirmed: ${signature}`);
        claimedAmount += totalClaimable / txResult.transactions.length;
      } catch (txError: any) {
        console.error("[Creator Rewards] Claim tx error:", txError.message);
        result.errors.push(`Claim error: ${txError.message}`);
      }
    }

    if (claimedAmount === 0) {
      throw new Error("Failed to claim any fees");
    }

    // Small delay to let claims settle
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Calculate distribution amounts
    const reserveAmount = claimedAmount * (agentConfig.reservePercentage / 100);
    const distributableAmount = claimedAmount - reserveAmount;

    console.log(
      `[Creator Rewards] Claimed: ${claimedAmount.toFixed(4)} SOL | ` +
      `Reserve: ${reserveAmount.toFixed(4)} SOL | ` +
      `Distributable: ${distributableAmount.toFixed(4)} SOL`
    );

    if (topCreators.length === 0) {
      console.warn("[Creator Rewards] No eligible creators found");
      result.errors.push("No eligible creators found");
      result.success = true;
      return result;
    }

    // Calculate rewards per creator
    const distributionPercentages = [
      agentConfig.distribution.first,
      agentConfig.distribution.second,
      agentConfig.distribution.third,
    ];

    // Distribute to top creators
    for (let i = 0; i < Math.min(topCreators.length, agentConfig.topCreatorsCount); i++) {
      const creator = topCreators[i];
      const percentage = distributionPercentages[i] || 0;
      const rewardAmount = distributableAmount * (percentage / 100);

      console.log(
        `[Creator Rewards] Sending ${rewardAmount.toFixed(4)} SOL (${percentage}%) to ` +
        `${creator.tokenSymbol} creator (rank #${creator.rank}): ${creator.wallet}`
      );

      const transferResult = await sendRewardToCreator(creator.wallet, rewardAmount);

      result.recipients.push({
        wallet: creator.wallet,
        tokenSymbol: creator.tokenSymbol,
        amount: rewardAmount,
        rank: creator.rank,
        signature: transferResult.signature,
        error: transferResult.error,
      });

      if (transferResult.success) {
        result.totalDistributed += rewardAmount;
      } else {
        result.errors.push(`Failed to send to ${creator.wallet}: ${transferResult.error}`);
      }

      // Small delay between transfers
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Update state
    agentState.lastDistribution = Date.now();
    agentState.cycleStartTime = Date.now(); // Reset cycle
    agentState.totalDistributed += result.totalDistributed;
    agentState.distributionCount++;
    agentState.pendingPoolSol = 0;

    // Track distribution history
    agentState.recentDistributions.unshift({
      timestamp: Date.now(),
      totalDistributed: result.totalDistributed,
      recipients: result.recipients.map((r) => ({
        wallet: r.wallet,
        tokenSymbol: r.tokenSymbol,
        amount: r.amount,
        rank: r.rank,
      })),
    });

    // Keep only last 10 distributions
    if (agentState.recentDistributions.length > 10) {
      agentState.recentDistributions = agentState.recentDistributions.slice(0, 10);
    }

    result.success = true;
    console.log(
      `[Creator Rewards] Distribution complete: ${result.totalDistributed.toFixed(4)} SOL ` +
      `to ${result.recipients.filter((r) => !r.error).length} creators`
    );

    // Emit distribution event to Agent Coordinator
    emitDistribution(result).catch((err) => {
      console.error("[Creator Rewards] Failed to emit to coordinator:", err);
    });

    return result;
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    console.error("[Creator Rewards] Error:", errorMsg);
    result.errors.push(errorMsg);
    agentState.errors.push(`${new Date().toISOString()}: ${errorMsg}`);

    // Keep only last 10 errors
    if (agentState.errors.length > 10) {
      agentState.errors = agentState.errors.slice(-10);
    }

    return result;
  }
}

// Manual trigger
export async function triggerDistribution(): Promise<DistributionResult> {
  if (!getBagsApiClient()) {
    initCreatorRewardsAgent();
  }
  return runRewardsCheck();
}

// Get current state
export function getCreatorRewardsState(): CreatorRewardsState & { config: CreatorRewardsConfig } {
  return {
    ...agentState,
    config: agentConfig,
  };
}

// Update configuration
export function updateCreatorRewardsConfig(config: Partial<CreatorRewardsConfig>): CreatorRewardsConfig {
  agentConfig = { ...agentConfig, ...config };

  // Restart interval if running and interval changed
  if (agentState.isRunning && config.checkIntervalMs) {
    stopCreatorRewardsAgent();
    startCreatorRewardsAgent();
  }

  return agentConfig;
}

// Reset state
export function resetCreatorRewardsState(): void {
  agentState = {
    isRunning: false,
    lastCheck: 0,
    lastDistribution: 0,
    cycleStartTime: Date.now(),
    totalDistributed: 0,
    distributionCount: 0,
    pendingPoolSol: 0,
    topCreators: [],
    errors: [],
    recentDistributions: [],
  };
}

// Get time until next potential distribution
export function getTimeUntilDistribution(): {
  byThreshold: number | null; // SOL needed to hit threshold
  byTimer: number; // ms until timer expires
  estimatedTrigger: "threshold" | "timer" | "unknown";
} {
  const solNeeded = agentConfig.thresholdSol - agentState.pendingPoolSol;
  const timeRemaining = agentConfig.backupTimerMs - (Date.now() - agentState.cycleStartTime);

  return {
    byThreshold: solNeeded > 0 ? solNeeded : null,
    byTimer: Math.max(0, timeRemaining),
    estimatedTrigger:
      agentState.pendingPoolSol >= agentConfig.thresholdSol
        ? "threshold"
        : timeRemaining <= 0 && agentState.pendingPoolSol >= agentConfig.minimumDistributionSol
        ? "timer"
        : "unknown",
  };
}
