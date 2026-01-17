// Auto Fee Claim Agent - Autonomous fee claiming service
import { BagsApiClient } from "./bags-api";
import {
  getAgentWallet,
  getAgentPublicKey,
  getAgentBalance,
  signAndSendBase64Transaction,
  isAgentWalletConfigured,
} from "./agent-wallet";
import type { ClaimablePosition } from "./types";

// Agent configuration
export interface AutoClaimConfig {
  enabled: boolean;
  minClaimThresholdSol: number; // Minimum SOL to trigger auto-claim
  checkIntervalMs: number; // How often to check (default: 5 minutes)
  maxClaimsPerRun: number; // Limit claims per execution
  minWalletBalanceSol: number; // Minimum wallet balance needed for tx fees
  cooldownMs: number; // Cooldown between claims
}

// Agent state
export interface AutoClaimState {
  isRunning: boolean;
  lastCheck: number;
  lastClaim: number;
  totalClaimed: number;
  claimCount: number;
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
}

// Default configuration
const DEFAULT_CONFIG: AutoClaimConfig = {
  enabled: true,
  minClaimThresholdSol: 0.01, // Claim when 0.01+ SOL available
  checkIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxClaimsPerRun: 10,
  minWalletBalanceSol: 0.005, // Need at least 0.005 SOL for fees
  cooldownMs: 60 * 1000, // 1 minute cooldown between claims
};

// Agent state (in-memory, could be persisted to DB)
let agentState: AutoClaimState = {
  isRunning: false,
  lastCheck: 0,
  lastClaim: 0,
  totalClaimed: 0,
  claimCount: 0,
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
    threshold: agentConfig.minClaimThresholdSol,
    interval: agentConfig.checkIntervalMs,
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

// Main check and claim routine
export async function runAutoClaimCheck(): Promise<ClaimResult> {
  const result: ClaimResult = {
    success: false,
    positionsClaimed: 0,
    totalSolClaimed: 0,
    signatures: [],
    errors: [],
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

    // Check cooldown
    const timeSinceLastClaim = Date.now() - agentState.lastClaim;
    if (timeSinceLastClaim < agentConfig.cooldownMs) {
      console.log(`Cooldown active: ${Math.round((agentConfig.cooldownMs - timeSinceLastClaim) / 1000)}s remaining`);
      return result;
    }

    // Fetch claimable positions
    console.log(`Checking claimable positions for ${walletAddress}...`);
    const positions = await bagsApi.getClaimablePositions(walletAddress);

    if (!positions || positions.length === 0) {
      console.log("No claimable positions found");
      result.success = true;
      return result;
    }

    agentState.pendingPositions = positions;

    // Calculate total claimable
    const totalClaimable = positions.reduce(
      (sum, p) => sum + p.claimableDisplayAmount,
      0
    );

    console.log(`Found ${positions.length} positions with ${totalClaimable.toFixed(4)} SOL claimable`);

    // Check threshold
    if (totalClaimable < agentConfig.minClaimThresholdSol) {
      console.log(`Below threshold: ${totalClaimable} < ${agentConfig.minClaimThresholdSol}`);
      result.success = true;
      return result;
    }

    // Filter positions above individual thresholds and limit
    const positionsToClaim = positions
      .filter((p) => p.claimableDisplayAmount > 0.001) // Ignore dust
      .slice(0, agentConfig.maxClaimsPerRun);

    if (positionsToClaim.length === 0) {
      result.success = true;
      return result;
    }

    // Generate claim transactions
    console.log(`Generating claim transactions for ${positionsToClaim.length} positions...`);
    const virtualPools = positionsToClaim.map((p) => p.virtualPool);

    const txResult = await bagsApi.generateClaimTransactions(walletAddress, virtualPools);

    if (!txResult.transactions || txResult.transactions.length === 0) {
      throw new Error("No transactions returned from API");
    }

    // Execute each transaction
    for (const txBase64 of txResult.transactions) {
      try {
        console.log("Signing and sending claim transaction...");
        const signature = await signAndSendBase64Transaction(txBase64);

        result.signatures.push(signature);
        result.positionsClaimed++;
        console.log(`Claim tx confirmed: ${signature}`);
      } catch (txError: any) {
        const errorMsg = txError.message || "Transaction failed";
        console.error("Claim transaction error:", errorMsg);
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

      console.log(`Successfully claimed ${claimedAmount.toFixed(4)} SOL from ${result.positionsClaimed} positions`);
    }

    return result;
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    console.error("Auto-claim error:", errorMsg);
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
    errors: [],
    pendingPositions: [],
  };
}
