// Buyback & Burn Module - Automated token buybacks and burns
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createBurnInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAgentWallet, getAgentConnection, getAgentBalance } from "./agent-wallet";
import { getJupiterClient } from "./jupiter-api";

// Auto-select modes
export type AutoSelectMode = "manual" | "top-bagsworld" | "top-jupiter";

// Buyback & Burn Configuration
export interface BuybackBurnConfig {
  enabled: boolean;
  // Auto-select mode for tokens
  autoSelectMode: AutoSelectMode;
  // Number of top tokens to select (for auto modes)
  topN: number;
  // Tokens to buy and burn (manual mode or override)
  targetTokens: TokenBuybackConfig[];
  // Minimum SOL to trigger buyback (after claiming)
  minBuybackThresholdSol: number;
  // Percentage of claimed SOL to use for buyback (0-100)
  buybackPercentage: number;
  // Allocation per token when using auto-select (e.g., 10 = 10% each)
  allocationPerToken: number;
  // Keep minimum SOL in wallet for fees
  reserveSol: number;
  // Slippage tolerance (basis points)
  slippageBps: number;
  // Burn address (default: token program burn)
  useProgramBurn: boolean;
  // Delay before executing buyback (in milliseconds)
  delayMs: number;
  // Minimum volume for token to be eligible (in USD)
  minVolumeUsd: number;
  // Tokens to exclude from auto-select
  excludeMints: string[];
}

// Pending buyback queue item
export interface PendingBuyback {
  id: string;
  claimedSol: number;
  claimedAt: number;
  executeAt: number;
  executed: boolean;
  result?: BuybackResult;
}

export interface TokenBuybackConfig {
  mint: string;
  symbol: string;
  name: string;
  // Percentage of buyback allocation for this token (should sum to 100)
  allocationPercent: number;
  // Whether to burn or hold
  burnAfterBuy: boolean;
  // Minimum buy amount in SOL
  minBuySol: number;
}

export interface BuybackResult {
  success: boolean;
  tokensBought: Array<{
    mint: string;
    symbol: string;
    solSpent: number;
    tokensReceived: number;
    signature: string;
  }>;
  tokensBurned: Array<{
    mint: string;
    symbol: string;
    amount: number;
    signature: string;
  }>;
  totalSolSpent: number;
  errors: string[];
}

// Default configuration - 30% allocation (10% x 3 tokens), 12 hour delay
const DEFAULT_CONFIG: BuybackBurnConfig = {
  enabled: false,
  autoSelectMode: "top-bagsworld",
  topN: 3,
  targetTokens: [],
  minBuybackThresholdSol: 0.05,
  buybackPercentage: 30, // Use 30% of claimed SOL for buybacks
  allocationPerToken: 10, // 10% per token (3 tokens = 30%)
  reserveSol: 0.01, // Keep 0.01 SOL for tx fees
  slippageBps: 500, // 5% slippage
  useProgramBurn: true,
  delayMs: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
  minVolumeUsd: 100, // Minimum $100 volume
  excludeMints: [],
};

let buybackConfig: BuybackBurnConfig = { ...DEFAULT_CONFIG };
const jupiter = getJupiterClient();

// Pending buyback queue
let pendingBuybacks: PendingBuyback[] = [];
let processingInterval: NodeJS.Timeout | null = null;

// Initialize buyback config
export function initBuybackBurn(config?: Partial<BuybackBurnConfig>): BuybackBurnConfig {
  buybackConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate allocations for manual mode
  if (buybackConfig.autoSelectMode === "manual" && buybackConfig.targetTokens.length > 0) {
    const totalAllocation = buybackConfig.targetTokens.reduce(
      (sum, t) => sum + t.allocationPercent,
      0
    );
    if (totalAllocation !== 100) {
      console.warn(`Token allocations sum to ${totalAllocation}%, should be 100%`);
    }
  }

  // Start processing interval for pending buybacks
  startPendingBuybackProcessor();

  console.log("Buyback & Burn initialized:", {
    enabled: buybackConfig.enabled,
    mode: buybackConfig.autoSelectMode,
    topN: buybackConfig.topN,
    percentage: buybackConfig.buybackPercentage,
    allocationPerToken: buybackConfig.allocationPerToken,
    delayHours: buybackConfig.delayMs / (60 * 60 * 1000),
  });

  return buybackConfig;
}

// Start the processor for pending buybacks
export function startPendingBuybackProcessor(): void {
  if (processingInterval) return;

  // Check every 5 minutes for pending buybacks ready to execute
  processingInterval = setInterval(async () => {
    await processPendingBuybacks();
  }, 5 * 60 * 1000);

  console.log("Pending buyback processor started");
}

// Stop the processor
export function stopPendingBuybackProcessor(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }
}

// Process pending buybacks that are ready
async function processPendingBuybacks(): Promise<void> {
  const now = Date.now();
  const readyBuybacks = pendingBuybacks.filter(
    pb => !pb.executed && pb.executeAt <= now
  );

  for (const pending of readyBuybacks) {
    console.log(`Executing delayed buyback ${pending.id} (claimed ${pending.claimedSol} SOL)`);
    try {
      const result = await executeImmediateBuyback(pending.claimedSol);
      pending.executed = true;
      pending.result = result;
      updateStats(result);
      console.log(`Delayed buyback ${pending.id} complete: ${result.totalSolSpent} SOL spent`);
    } catch (error: any) {
      console.error(`Delayed buyback ${pending.id} failed:`, error.message);
      pending.result = {
        success: false,
        tokensBought: [],
        tokensBurned: [],
        totalSolSpent: 0,
        errors: [error.message],
      };
    }
  }

  // Clean up old executed buybacks (keep last 50)
  pendingBuybacks = pendingBuybacks
    .filter(pb => !pb.executed || (now - pb.claimedAt) < 7 * 24 * 60 * 60 * 1000)
    .slice(-50);
}

// Get pending buybacks
export function getPendingBuybacks(): PendingBuyback[] {
  return pendingBuybacks;
}

/**
 * Fetch top BagsWorld tokens by volume
 */
async function fetchTopBagsWorldTokens(limit: number): Promise<TokenBuybackConfig[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/terminal?action=bags-hot&limit=${limit * 2}`);

    if (!response.ok) {
      console.warn("Failed to fetch BagsWorld tokens, using manual config");
      return [];
    }

    const data = await response.json();
    if (!data.success || !data.tokens || data.tokens.length === 0) {
      return [];
    }

    // Filter by minimum volume and exclude list
    const eligibleTokens = data.tokens
      .filter((t: any) =>
        t.volume24h >= buybackConfig.minVolumeUsd &&
        !buybackConfig.excludeMints.includes(t.mint)
      )
      .slice(0, limit);

    // Convert to TokenBuybackConfig with equal allocation
    return eligibleTokens.map((t: any) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      allocationPercent: buybackConfig.allocationPerToken,
      burnAfterBuy: true,
      minBuySol: 0.01,
    }));
  } catch (error) {
    console.error("Error fetching top BagsWorld tokens:", error);
    return [];
  }
}

/**
 * Get target tokens based on auto-select mode
 */
async function getTargetTokens(): Promise<TokenBuybackConfig[]> {
  if (buybackConfig.autoSelectMode === "manual") {
    return buybackConfig.targetTokens;
  }

  if (buybackConfig.autoSelectMode === "top-bagsworld") {
    const autoTokens = await fetchTopBagsWorldTokens(buybackConfig.topN);
    if (autoTokens.length > 0) {
      console.log(`Auto-selected ${autoTokens.length} BagsWorld tokens:`,
        autoTokens.map(t => t.symbol).join(", "));
      return autoTokens;
    }
    // Fall back to manual if auto-select fails
    console.warn("Auto-select failed, falling back to manual tokens");
    return buybackConfig.targetTokens;
  }

  // For top-jupiter mode (could be implemented later)
  return buybackConfig.targetTokens;
}

// Get current config
export function getBuybackConfig(): BuybackBurnConfig {
  return buybackConfig;
}

// Update config
export function updateBuybackConfig(config: Partial<BuybackBurnConfig>): BuybackBurnConfig {
  buybackConfig = { ...buybackConfig, ...config };
  return buybackConfig;
}

// Add a token to buyback list
export function addBuybackToken(token: TokenBuybackConfig): void {
  // Remove if exists
  buybackConfig.targetTokens = buybackConfig.targetTokens.filter(
    t => t.mint !== token.mint
  );
  buybackConfig.targetTokens.push(token);
}

// Remove a token from buyback list
export function removeBuybackToken(mint: string): void {
  buybackConfig.targetTokens = buybackConfig.targetTokens.filter(
    t => t.mint !== mint
  );
}

/**
 * Queue buyback for delayed execution (12 hours after claim)
 * @param claimedSol Amount of SOL claimed
 */
export async function executeBuybackBurn(claimedSol: number): Promise<BuybackResult> {
  const result: BuybackResult = {
    success: false,
    tokensBought: [],
    tokensBurned: [],
    totalSolSpent: 0,
    errors: [],
  };

  try {
    if (!buybackConfig.enabled) {
      result.errors.push("Buyback & burn is disabled");
      return result;
    }

    // Calculate buyback amount to validate threshold
    const buybackAmount = claimedSol * (buybackConfig.buybackPercentage / 100);

    if (buybackAmount < buybackConfig.minBuybackThresholdSol) {
      result.errors.push(
        `Buyback amount ${buybackAmount.toFixed(4)} SOL below threshold ${buybackConfig.minBuybackThresholdSol}`
      );
      result.success = true; // Not an error, just below threshold
      return result;
    }

    // If delay is configured, queue for later execution
    if (buybackConfig.delayMs > 0) {
      const pendingId = `buyback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();

      const pendingBuyback: PendingBuyback = {
        id: pendingId,
        claimedSol,
        claimedAt: now,
        executeAt: now + buybackConfig.delayMs,
        executed: false,
      };

      pendingBuybacks.push(pendingBuyback);

      const delayHours = buybackConfig.delayMs / (60 * 60 * 1000);
      console.log(`Buyback queued: ${pendingId}`);
      console.log(`  Amount: ${claimedSol.toFixed(4)} SOL claimed, ${buybackAmount.toFixed(4)} SOL for buyback`);
      console.log(`  Execute at: ${new Date(pendingBuyback.executeAt).toISOString()} (${delayHours}h delay)`);

      // Return success with info about queued buyback
      result.success = true;
      result.errors.push(`Buyback queued for ${delayHours}h delay (ID: ${pendingId})`);
      return result;
    }

    // No delay - execute immediately
    return executeImmediateBuyback(claimedSol);
  } catch (error: any) {
    const errorMsg = error.message || "Buyback queueing failed";
    console.error("Buyback & burn error:", errorMsg);
    result.errors.push(errorMsg);
    return result;
  }
}

/**
 * Execute buyback immediately (called after delay period or when delay=0)
 * @param claimedSol Amount of SOL that was claimed
 */
export async function executeImmediateBuyback(claimedSol: number): Promise<BuybackResult> {
  const result: BuybackResult = {
    success: false,
    tokensBought: [],
    tokensBurned: [],
    totalSolSpent: 0,
    errors: [],
  };

  try {
    const wallet = getAgentWallet();
    if (!wallet) {
      throw new Error("Agent wallet not configured");
    }

    const connection = getAgentConnection();
    const walletBalance = await getAgentBalance();

    // Get target tokens (auto-select or manual based on config)
    const targetTokens = await getTargetTokens();

    if (targetTokens.length === 0) {
      result.errors.push("No target tokens available for buyback");
      return result;
    }

    // Calculate buyback amount
    const buybackAmount = claimedSol * (buybackConfig.buybackPercentage / 100);
    const availableForBuyback = Math.max(
      0,
      walletBalance - buybackConfig.reserveSol
    );
    const actualBuybackAmount = Math.min(buybackAmount, availableForBuyback);

    console.log(`Executing buyback:`, {
      claimed: claimedSol,
      buybackPercent: buybackConfig.buybackPercentage,
      targetBuyback: buybackAmount,
      walletBalance,
      reserve: buybackConfig.reserveSol,
      actualBuyback: actualBuybackAmount,
      targetTokens: targetTokens.map(t => `${t.symbol} (${t.allocationPercent}%)`).join(", "),
    });

    if (actualBuybackAmount < buybackConfig.minBuybackThresholdSol) {
      result.errors.push(
        `Buyback amount ${actualBuybackAmount} below threshold ${buybackConfig.minBuybackThresholdSol}`
      );
      result.success = true; // Not an error, just below threshold
      return result;
    }

    // Execute buybacks for each token
    const SOL_MINT = "So11111111111111111111111111111111111111112";

    for (const tokenConfig of targetTokens) {
      try {
        const tokenBuybackSol = actualBuybackAmount * (tokenConfig.allocationPercent / 100);

        if (tokenBuybackSol < tokenConfig.minBuySol) {
          console.log(`Skipping ${tokenConfig.symbol}: ${tokenBuybackSol} < ${tokenConfig.minBuySol} SOL`);
          continue;
        }

        console.log(`Buying ${tokenConfig.symbol} with ${tokenBuybackSol.toFixed(4)} SOL...`);

        // Get quote from Jupiter
        const amountLamports = Math.floor(tokenBuybackSol * 1e9);

        // Create Ultra order for the swap
        const order = await jupiter.createUltraOrder(
          SOL_MINT,
          tokenConfig.mint,
          amountLamports,
          wallet.publicKey.toBase58(),
          buybackConfig.slippageBps
        );

        // Sign and execute the swap
        const txBuffer = Buffer.from(order.transaction, "base64");
        const transaction = VersionedTransaction.deserialize(txBuffer);
        transaction.sign([wallet]);

        const signature = await connection.sendRawTransaction(
          transaction.serialize(),
          { skipPreflight: false, maxRetries: 3 }
        );

        await connection.confirmTransaction(signature, "confirmed");

        const tokensReceived = parseFloat(order.outAmount);

        result.tokensBought.push({
          mint: tokenConfig.mint,
          symbol: tokenConfig.symbol,
          solSpent: tokenBuybackSol,
          tokensReceived,
          signature,
        });
        result.totalSolSpent += tokenBuybackSol;

        console.log(`Bought ${tokensReceived} ${tokenConfig.symbol} for ${tokenBuybackSol.toFixed(4)} SOL`);

        // Burn tokens (all tokens set to burnAfterBuy: true in auto-select)
        if (tokenConfig.burnAfterBuy && buybackConfig.useProgramBurn) {
          try {
            const burnResult = await burnTokens(
              tokenConfig.mint,
              tokensReceived,
              connection,
              wallet
            );

            if (burnResult.success) {
              result.tokensBurned.push({
                mint: tokenConfig.mint,
                symbol: tokenConfig.symbol,
                amount: tokensReceived,
                signature: burnResult.signature!,
              });
              console.log(`🔥 Burned ${tokensReceived} ${tokenConfig.symbol}`);
            } else {
              result.errors.push(`Burn failed for ${tokenConfig.symbol}: ${burnResult.error}`);
            }
          } catch (burnError: any) {
            result.errors.push(`Burn error for ${tokenConfig.symbol}: ${burnError.message}`);
          }
        }
      } catch (tokenError: any) {
        const errorMsg = `Buyback failed for ${tokenConfig.symbol}: ${tokenError.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        // Continue with other tokens
      }
    }

    result.success = result.tokensBought.length > 0;

    if (result.success) {
      console.log(`Buyback complete: ${result.tokensBought.length} tokens bought, ${result.tokensBurned.length} burned`);
      console.log(`Total SOL spent: ${result.totalSolSpent.toFixed(4)}`);
    }

    return result;
  } catch (error: any) {
    const errorMsg = error.message || "Buyback execution failed";
    console.error("Immediate buyback error:", errorMsg);
    result.errors.push(errorMsg);
    return result;
  }
}

/**
 * Burn tokens using SPL Token burn instruction
 */
async function burnTokens(
  mintAddress: string,
  amount: number,
  connection: Connection,
  wallet: any
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const mint = new PublicKey(mintAddress);
    const owner = wallet.publicKey;

    // Get the associated token account
    const tokenAccount = await getAssociatedTokenAddress(mint, owner);

    // Check token account exists and has balance
    const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
    if (!accountInfo.value) {
      return { success: false, error: "Token account not found" };
    }

    // Get decimals from mint
    const mintInfo = await connection.getParsedAccountInfo(mint);
    const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;

    // Calculate amount in smallest units
    const burnAmount = BigInt(Math.floor(amount));

    // Create burn instruction
    const burnIx = createBurnInstruction(
      tokenAccount,
      mint,
      owner,
      burnAmount,
      [],
      TOKEN_PROGRAM_ID
    );

    // Build transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const transaction = new Transaction().add(burnIx);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = owner;

    // Sign and send
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    return { success: true, signature };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get buyback stats
 */
export interface BuybackStats {
  totalSolSpent: number;
  totalTokensBought: number;
  totalTokensBurned: number;
  byToken: Record<string, {
    symbol: string;
    solSpent: number;
    bought: number;
    burned: number;
  }>;
}

let stats: BuybackStats = {
  totalSolSpent: 0,
  totalTokensBought: 0,
  totalTokensBurned: 0,
  byToken: {},
};

export function getBuybackStats(): BuybackStats {
  return stats;
}

export function updateStats(result: BuybackResult): void {
  stats.totalSolSpent += result.totalSolSpent;

  for (const bought of result.tokensBought) {
    stats.totalTokensBought++;
    if (!stats.byToken[bought.mint]) {
      stats.byToken[bought.mint] = {
        symbol: bought.symbol,
        solSpent: 0,
        bought: 0,
        burned: 0,
      };
    }
    stats.byToken[bought.mint].solSpent += bought.solSpent;
    stats.byToken[bought.mint].bought += bought.tokensReceived;
  }

  for (const burned of result.tokensBurned) {
    stats.totalTokensBurned++;
    if (stats.byToken[burned.mint]) {
      stats.byToken[burned.mint].burned += burned.amount;
    }
  }
}

export function resetStats(): void {
  stats = {
    totalSolSpent: 0,
    totalTokensBought: 0,
    totalTokensBurned: 0,
    byToken: {},
  };
}
