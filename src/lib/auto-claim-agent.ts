// Auto Fee Claim Agent - Threshold-based fee claiming with instant buyback
// Claims fees when threshold (1 SOL) is reached, then immediately buys back & burns top 5 tokens
import { BagsApiClient } from "./bags-api";
import {
  getAgentWallet,
  getAgentPublicKey,
  getAgentBalance,
  signAndSendBase64Transaction,
  isAgentWalletConfigured,
} from "./agent-wallet";
import type { ClaimablePosition } from "./types";
import { triggerBuyback, initBuybackAgent } from "./buyback-agent";

// Agent configuration
export interface AutoClaimConfig {
  enabled: boolean;
  claimThresholdSol: number; // Threshold to trigger claim+buyback (default: 1 SOL)
  checkIntervalMs: number; // How often to check (default: 15 minutes)
  maxClaimsPerRun: number; // Limit claims per execution
  minWalletBalanceSol: number; // Minimum wallet balance needed for tx fees
  dustFilterSol: number; // Ignore positions below this amount
  autoBuybackEnabled: boolean; // Trigger buyback immediately after claim
}

// Agent state
export interface AutoClaimState {
  isRunning: boolean;
  lastCheck: number;
  lastClaim: number;
  totalClaimed: number;
  claimCount: number;
  pendingClaimableSol: number; // Current claimable amount being tracked
  errors: string[];
  pendingPositions: ClaimablePosition[];
}

// Claim result
export interface ClaimResult {
  success: boolean;
  positionsClaimed: number;
  totalSolClaimed: number;
  signatures: string[];
  errors: string[];
  buybackTriggered: boolean;
  buybackResult?: {
    tokensBoughtBack: number;
    totalSolSpent: number;
    totalTokensBurned: number;
  };
}

// Default configuration - Threshold-based claiming
// Only claims when 1+ SOL is available, then immediately triggers buyback
const DEFAULT_CONFIG: AutoClaimConfig = {
  enabled: true,
  claimThresholdSol: 1.0, // Only claim when 1+ SOL accumulated (threshold-based)
  checkIntervalMs: 15 * 60 * 1000, // Check every 15 minutes
  maxClaimsPerRun: 20, // Batch more claims per run
  minWalletBalanceSol: 0.005, // Need at least 0.005 SOL for fees
  dustFilterSol: 0.01, // Ignore positions below 0.01 SOL
  autoBuybackEnabled: true, // Trigger buyback immediately after claim
};

// Agent state (in-memory, could be persisted to DB)
let agentState: AutoClaimState = {
  isRunning: false,
  lastCheck: 0,
  lastClaim: 0,
  totalClaimed: 0,
  claimCount: 0,
  pendingClaimableSol: 0,
  errors: [],
  pendingPositions: [],
};

let agentConfig: AutoClaimConfig = { ...DEFAULT_CONFIG };
let checkInterval: NodeJS.Timeout | null = null;
let bagsApi: BagsApiClient | null = null;

// Initialize the agent
export function initAutoClaimAgent(config?: Partial<AutoClaimConfig>): boolean {
  // Check prerequisites
  if (!isAgentWalletConfigured()) {
    console.warn("Auto-claim agent: Wallet not configured");
    return false;
  }

  if (!process.env.BAGS_API_KEY) {
    console.warn("Auto-claim agent: BAGS_API_KEY not set");
    return false;
  }

  // Merge config
  agentConfig = { ...DEFAULT_CONFIG, ...config };
  bagsApi = new BagsApiClient(process.env.BAGS_API_KEY);

  console.log("Auto-claim agent initialized:", {
    wallet: getAgentPublicKey(),
    threshold: `${agentConfig.claimThresholdSol} SOL`,
    interval: `${agentConfig.checkIntervalMs / 60000} min`,
    autoBuyback: agentConfig.autoBuybackEnabled,
  });

  return true;
}

// Start the agent (background polling)
export function startAutoClaimAgent(): boolean {
  if (!bagsApi) {
    const initialized = initAutoClaimAgent();
    if (!initialized) return false;
  }

  if (agentState.isRunning) {
    console.log("Auto-claim agent already running");
    return true;
  }

  agentState.isRunning = true;

  // Run immediately, then on interval
  runAutoClaimCheck();

  checkInterval = setInterval(() => {
    runAutoClaimCheck();
  }, agentConfig.checkIntervalMs);

  console.log("Auto-claim agent started");
  return true;
}

// Stop the agent
export function stopAutoClaimAgent(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  agentState.isRunning = false;
  console.log("Auto-claim agent stopped");
}

// Main check and claim routine - THRESHOLD-BASED
// Only claims when accumulated fees >= 1 SOL, then triggers instant buyback
export async function runAutoClaimCheck(): Promise<ClaimResult> {
  const result: ClaimResult = {
    success: false,
    positionsClaimed: 0,
    totalSolClaimed: 0,
    signatures: [],
    errors: [],
    buybackTriggered: false,
  };

  try {
    if (!bagsApi) {
      throw new Error("Agent not initialized");
    }

    const wallet = getAgentWallet();
    if (!wallet) {
      throw new Error("Agent wallet not available");
    }

    const walletAddress = wallet.publicKey.toBase58();
    agentState.lastCheck = Date.now();

    // Check wallet balance for tx fees
    const balance = await getAgentBalance();
    if (balance < agentConfig.minWalletBalanceSol) {
      const msg = `Wallet balance too low: ${balance} SOL (need ${agentConfig.minWalletBalanceSol})`;
      console.warn(msg);
      result.errors.push(msg);
      return result;
    }

    // Fetch claimable positions
    console.log(`[Threshold Check] Checking claimable positions for ${walletAddress}...`);
    const positions = await bagsApi.getClaimablePositions(walletAddress);

    if (!positions || positions.length === 0) {
      console.log("[Threshold Check] No claimable positions found");
      agentState.pendingClaimableSol = 0;
      result.success = true;
      return result;
    }

    // Filter out dust and calculate total claimable
    const validPositions = positions.filter(
      (p) => p.claimableDisplayAmount >= agentConfig.dustFilterSol
    );

    const totalClaimable = validPositions.reduce(
      (sum, p) => sum + p.claimableDisplayAmount,
      0
    );

    agentState.pendingPositions = validPositions;
    agentState.pendingClaimableSol = totalClaimable;

    console.log(`[Threshold Check] ${validPositions.length} positions with ${totalClaimable.toFixed(4)} SOL claimable (threshold: ${agentConfig.claimThresholdSol} SOL)`);

    // THRESHOLD CHECK - Only claim when we hit the threshold
    if (totalClaimable < agentConfig.claimThresholdSol) {
      console.log(`[Threshold Check] Below threshold: ${totalClaimable.toFixed(4)} < ${agentConfig.claimThresholdSol} SOL - waiting for more fees to accumulate`);
      result.success = true;
      return result;
    }

    // THRESHOLD MET - Proceed with claim
    console.log(`[Threshold Check] THRESHOLD MET! ${totalClaimable.toFixed(4)} SOL >= ${agentConfig.claimThresholdSol} SOL - initiating claim + buyback`);

    // Limit positions per run
    const positionsToClaim = validPositions.slice(0, agentConfig.maxClaimsPerRun);

    // Generate claim transactions
    console.log(`[Claim] Generating claim transactions for ${positionsToClaim.length} positions...`);
    const virtualPools = positionsToClaim.map((p) => p.virtualPool);

    const txResult = await bagsApi.generateClaimTransactions(walletAddress, virtualPools);

    if (!txResult.transactions || txResult.transactions.length === 0) {
      throw new Error("No transactions returned from API");
    }

    // Execute each transaction
    for (const txBase64 of txResult.transactions) {
      try {
        console.log("[Claim] Signing and sending claim transaction...");
        const signature = await signAndSendBase64Transaction(txBase64);

        result.signatures.push(signature);
        result.positionsClaimed++;
        console.log(`[Claim] Tx confirmed: ${signature}`);
      } catch (txError: any) {
        const errorMsg = txError.message || "Transaction failed";
        console.error("[Claim] Transaction error:", errorMsg);
        result.errors.push(errorMsg);
        // Continue with other transactions
      }
    }

    // Update state
    if (result.positionsClaimed > 0) {
      const claimedAmount = positionsToClaim
        .slice(0, result.positionsClaimed)
        .reduce((sum, p) => sum + p.claimableDisplayAmount, 0);

      result.totalSolClaimed = claimedAmount;
      result.success = true;

      agentState.lastClaim = Date.now();
      agentState.totalClaimed += claimedAmount;
      agentState.claimCount += result.positionsClaimed;
      agentState.pendingClaimableSol = 0; // Reset after claim

      console.log(`[Claim] Successfully claimed ${claimedAmount.toFixed(4)} SOL from ${result.positionsClaimed} positions`);

      // INSTANT BUYBACK - Trigger buyback immediately after successful claim
      if (agentConfig.autoBuybackEnabled && claimedAmount >= agentConfig.claimThresholdSol * 0.5) {
        console.log(`[Buyback] Triggering instant buyback with ${claimedAmount.toFixed(4)} SOL...`);

        try {
          // Initialize buyback agent if needed
          initBuybackAgent();

          // Small delay to let claim tx settle
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Trigger the buyback
          const buybackResult = await triggerBuyback();

          if (buybackResult.success) {
            result.buybackTriggered = true;
            result.buybackResult = {
              tokensBoughtBack: buybackResult.tokensBoughtBack,
              totalSolSpent: buybackResult.totalSolSpent,
              totalTokensBurned: buybackResult.totalTokensBurned,
            };
            console.log(`[Buyback] Complete! Bought ${buybackResult.tokensBoughtBack} tokens, spent ${buybackResult.totalSolSpent.toFixed(4)} SOL, burned ${buybackResult.totalTokensBurned}`);
          } else {
            console.warn("[Buyback] Completed with errors:", buybackResult.errors);
            result.errors.push(...buybackResult.errors);
          }
        } catch (buybackError: any) {
          console.error("[Buyback] Error:", buybackError.message);
          result.errors.push(`Buyback error: ${buybackError.message}`);
        }
      }
    }

    return result;
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    console.error("[Auto-claim] Error:", errorMsg);
    result.errors.push(errorMsg);
    agentState.errors.push(`${new Date().toISOString()}: ${errorMsg}`);

    // Keep only last 10 errors
    if (agentState.errors.length > 10) {
      agentState.errors = agentState.errors.slice(-10);
    }

    return result;
  }
}

// Manual trigger (for testing or API calls)
export async function triggerClaim(): Promise<ClaimResult> {
  if (!bagsApi) {
    initAutoClaimAgent();
  }
  return runAutoClaimCheck();
}

// Get current state
export function getAutoClaimState(): AutoClaimState & { config: AutoClaimConfig } {
  return {
    ...agentState,
    config: agentConfig,
  };
}

// Update configuration
export function updateAutoClaimConfig(config: Partial<AutoClaimConfig>): AutoClaimConfig {
  agentConfig = { ...agentConfig, ...config };

  // Restart interval if running and interval changed
  if (agentState.isRunning && config.checkIntervalMs) {
    stopAutoClaimAgent();
    startAutoClaimAgent();
  }

  return agentConfig;
}

// Reset state (for testing)
export function resetAutoClaimState(): void {
  agentState = {
    isRunning: false,
    lastCheck: 0,
    lastClaim: 0,
    totalClaimed: 0,
    claimCount: 0,
    pendingClaimableSol: 0,
    errors: [],
    pendingPositions: [],
  };
}
