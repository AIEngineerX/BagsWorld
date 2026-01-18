// Buyback Agent - Autonomous token buyback and burn service
// Runs every 12 hours to buy back top BagsWorld tokens and burn them
import { BagsApiClient } from "./bags-api";
import {
  getAgentWallet,
  getAgentPublicKey,
  getAgentBalance,
  getAgentConnection,
  isAgentWalletConfigured,
} from "./agent-wallet";
import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createBurnInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Buyback configuration
export interface BuybackConfig {
  enabled: boolean;
  intervalMs: number; // How often to run (default: 12 hours)
  buybackPercentage: number; // % of wallet balance to use for buybacks
  minBuybackSol: number; // Minimum SOL to trigger buyback
  maxBuybackSol: number; // Maximum SOL per buyback cycle
  topTokensCount: number; // How many top tokens to buy back
  burnAfterBuy: boolean; // Whether to burn tokens after buying
  reserveBalanceSol: number; // Keep this much SOL for fees
}

// Buyback state
export interface BuybackState {
  isRunning: boolean;
  lastBuyback: number;
  totalBuybacksSol: number;
  totalTokensBurned: number;
  buybackCount: number;
  errors: string[];
  lastTokensBought: Array<{
    mint: string;
    symbol: string;
    amountSol: number;
    tokensBought: number;
    burned: boolean;
    timestamp: number;
  }>;
}

// Buyback result
export interface BuybackResult {
  success: boolean;
  tokensBoughtBack: number;
  totalSolSpent: number;
  totalTokensBurned: number;
  details: Array<{
    mint: string;
    symbol: string;
    solSpent: number;
    tokensBought: number;
    burned: boolean;
    signature?: string;
    error?: string;
  }>;
  errors: string[];
}

// Solana burn address (tokens sent here are effectively burned)
const BURN_ADDRESS = new PublicKey("1nc1nerator11111111111111111111111111111111");

// Default configuration
// 80% of collected fees go to buybacks, 20% reserved for operations
const DEFAULT_CONFIG: BuybackConfig = {
  enabled: true,
  intervalMs: 12 * 60 * 60 * 1000, // 12 hours
  buybackPercentage: 80, // 80% of balance for buybacks
  minBuybackSol: 0.05, // Minimum 0.05 SOL to trigger
  maxBuybackSol: 10, // Max 10 SOL per cycle
  topTokensCount: 5, // Buy back top 5 tokens
  burnAfterBuy: true,
  reserveBalanceSol: 0.02, // Keep 0.02 SOL for tx fees
};

// Agent state
let buybackState: BuybackState = {
  isRunning: false,
  lastBuyback: 0,
  totalBuybacksSol: 0,
  totalTokensBurned: 0,
  buybackCount: 0,
  errors: [],
  lastTokensBought: [],
};

let buybackConfig: BuybackConfig = { ...DEFAULT_CONFIG };
let buybackInterval: NodeJS.Timeout | null = null;
let bagsApi: BagsApiClient | null = null;

// Initialize the buyback agent
export function initBuybackAgent(config?: Partial<BuybackConfig>): boolean {
  if (!isAgentWalletConfigured()) {
    console.warn("[Buyback Agent] Wallet not configured");
    return false;
  }

  if (!process.env.BAGS_API_KEY) {
    console.warn("[Buyback Agent] BAGS_API_KEY not set");
    return false;
  }

  buybackConfig = { ...DEFAULT_CONFIG, ...config };
  bagsApi = new BagsApiClient(process.env.BAGS_API_KEY);

  console.log("[Buyback Agent] Initialized:", {
    wallet: getAgentPublicKey(),
    interval: `${buybackConfig.intervalMs / (60 * 60 * 1000)} hours`,
    buybackPercentage: `${buybackConfig.buybackPercentage}%`,
    topTokens: buybackConfig.topTokensCount,
    burnEnabled: buybackConfig.burnAfterBuy,
  });

  return true;
}

// Start the buyback agent
export function startBuybackAgent(): boolean {
  if (!bagsApi) {
    const initialized = initBuybackAgent();
    if (!initialized) return false;
  }

  if (buybackState.isRunning) {
    console.log("[Buyback Agent] Already running");
    return true;
  }

  buybackState.isRunning = true;

  // Run on interval (not immediately - wait for first cycle)
  buybackInterval = setInterval(() => {
    runBuybackCycle();
  }, buybackConfig.intervalMs);

  console.log("[Buyback Agent] Started - next buyback in 12 hours");
  return true;
}

// Stop the buyback agent
export function stopBuybackAgent(): void {
  if (buybackInterval) {
    clearInterval(buybackInterval);
    buybackInterval = null;
  }
  buybackState.isRunning = false;
  console.log("[Buyback Agent] Stopped");
}

// Get top tokens from BagsWorld (from world state or database)
async function getTopBagsWorldTokens(count: number): Promise<Array<{
  mint: string;
  symbol: string;
  name: string;
  volume24h?: number;
  marketCap?: number;
}>> {
  try {
    // Fetch from global tokens API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/global-tokens`);

    if (!response.ok) {
      console.warn("[Buyback Agent] Failed to fetch global tokens");
      return [];
    }

    const data = await response.json();
    const tokens = data.tokens || [];

    // Sort by volume/activity and return top N
    // For now, just return the first N tokens
    return tokens.slice(0, count).map((t: any) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      volume24h: t.volume24h || 0,
      marketCap: t.marketCap || 0,
    }));
  } catch (error) {
    console.error("[Buyback Agent] Error fetching top tokens:", error);
    return [];
  }
}

// Execute a swap via Bags API
async function executeSwap(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  walletAddress: string
): Promise<{ success: boolean; signature?: string; tokensReceived?: number; error?: string }> {
  if (!bagsApi) {
    return { success: false, error: "API not initialized" };
  }

  try {
    // Get quote
    const quote = await bagsApi.getTradeQuote(
      inputMint,
      outputMint,
      amountLamports,
      100 // 1% slippage
    );

    if (!quote || !quote.outAmount) {
      return { success: false, error: "Failed to get quote" };
    }

    // Create swap transaction
    const swapResult = await bagsApi.createSwapTransaction(quote, walletAddress);

    if (!swapResult.swapTransaction) {
      return { success: false, error: "Failed to create swap transaction" };
    }

    // Sign and send
    const wallet = getAgentWallet();
    if (!wallet) {
      return { success: false, error: "Wallet not available" };
    }

    const connection = getAgentConnection();
    const txBuffer = Buffer.from(swapResult.swapTransaction, "base64");
    const transaction = Transaction.from(txBuffer);

    // Get fresh blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign
    transaction.sign(wallet);

    // Send
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Confirm
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    return {
      success: true,
      signature,
      tokensReceived: Number(quote.outAmount),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Swap failed" };
  }
}

// Burn tokens by sending to burn address or using burn instruction
async function burnTokens(
  tokenMint: string,
  amount: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const wallet = getAgentWallet();
    if (!wallet) {
      return { success: false, error: "Wallet not available" };
    }

    const connection = getAgentConnection();
    const mintPubkey = new PublicKey(tokenMint);

    // Get the token account
    const tokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      wallet.publicKey
    );

    // Create burn instruction
    const burnIx = createBurnInstruction(
      tokenAccount,
      mintPubkey,
      wallet.publicKey,
      amount,
      [],
      TOKEN_PROGRAM_ID
    );

    // Create and send transaction
    const transaction = new Transaction().add(burnIx);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );

    console.log(`[Buyback Agent] Burned ${amount} tokens of ${tokenMint}: ${signature}`);

    return { success: true, signature };
  } catch (error: any) {
    console.error("[Buyback Agent] Burn error:", error);
    return { success: false, error: error.message || "Burn failed" };
  }
}

// Main buyback cycle
export async function runBuybackCycle(): Promise<BuybackResult> {
  const result: BuybackResult = {
    success: false,
    tokensBoughtBack: 0,
    totalSolSpent: 0,
    totalTokensBurned: 0,
    details: [],
    errors: [],
  };

  console.log("[Buyback Agent] Starting buyback cycle...");

  try {
    if (!bagsApi) {
      throw new Error("Agent not initialized");
    }

    const wallet = getAgentWallet();
    if (!wallet) {
      throw new Error("Wallet not available");
    }

    const walletAddress = wallet.publicKey.toBase58();

    // Check balance
    const balance = await getAgentBalance();
    const availableBalance = balance - buybackConfig.reserveBalanceSol;

    console.log(`[Buyback Agent] Wallet balance: ${balance} SOL, available: ${availableBalance} SOL`);

    if (availableBalance < buybackConfig.minBuybackSol) {
      console.log(`[Buyback Agent] Balance too low for buyback (need ${buybackConfig.minBuybackSol} SOL)`);
      result.success = true;
      return result;
    }

    // Calculate buyback amount
    let buybackAmount = availableBalance * (buybackConfig.buybackPercentage / 100);
    buybackAmount = Math.min(buybackAmount, buybackConfig.maxBuybackSol);

    console.log(`[Buyback Agent] Will spend ${buybackAmount.toFixed(4)} SOL on buybacks`);

    // Get top tokens
    const topTokens = await getTopBagsWorldTokens(buybackConfig.topTokensCount);

    if (topTokens.length === 0) {
      console.log("[Buyback Agent] No tokens found to buy back");
      result.success = true;
      return result;
    }

    console.log(`[Buyback Agent] Found ${topTokens.length} tokens to buy back`);

    // Split buyback amount among tokens
    const amountPerToken = buybackAmount / topTokens.length;
    const lamportsPerToken = Math.floor(amountPerToken * 1e9);

    // SOL mint address
    const SOL_MINT = "So11111111111111111111111111111111111111112";

    // Execute buybacks
    for (const token of topTokens) {
      console.log(`[Buyback Agent] Buying back $${token.symbol} (${token.mint})...`);

      const swapResult = await executeSwap(
        SOL_MINT,
        token.mint,
        lamportsPerToken,
        walletAddress
      );

      const detail: BuybackResult["details"][0] = {
        mint: token.mint,
        symbol: token.symbol,
        solSpent: amountPerToken,
        tokensBought: swapResult.tokensReceived || 0,
        burned: false,
        signature: swapResult.signature,
        error: swapResult.error,
      };

      if (swapResult.success && swapResult.tokensReceived) {
        result.tokensBoughtBack++;
        result.totalSolSpent += amountPerToken;

        console.log(`[Buyback Agent] Bought ${swapResult.tokensReceived} $${token.symbol}`);

        // Burn if enabled
        if (buybackConfig.burnAfterBuy) {
          console.log(`[Buyback Agent] Burning ${swapResult.tokensReceived} $${token.symbol}...`);

          const burnResult = await burnTokens(token.mint, swapResult.tokensReceived);

          if (burnResult.success) {
            detail.burned = true;
            result.totalTokensBurned++;
            console.log(`[Buyback Agent] Burned $${token.symbol}`);
          } else {
            detail.error = burnResult.error;
            result.errors.push(`Failed to burn ${token.symbol}: ${burnResult.error}`);
          }
        }

        // Track this buyback
        buybackState.lastTokensBought.push({
          mint: token.mint,
          symbol: token.symbol,
          amountSol: amountPerToken,
          tokensBought: swapResult.tokensReceived,
          burned: detail.burned,
          timestamp: Date.now(),
        });
      } else {
        result.errors.push(`Failed to buy ${token.symbol}: ${swapResult.error}`);
      }

      result.details.push(detail);

      // Small delay between swaps
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Update state
    buybackState.lastBuyback = Date.now();
    buybackState.totalBuybacksSol += result.totalSolSpent;
    buybackState.totalTokensBurned += result.totalTokensBurned;
    buybackState.buybackCount++;

    // Keep only last 20 buyback records
    if (buybackState.lastTokensBought.length > 20) {
      buybackState.lastTokensBought = buybackState.lastTokensBought.slice(-20);
    }

    result.success = true;
    console.log(`[Buyback Agent] Cycle complete: ${result.tokensBoughtBack} tokens bought, ${result.totalTokensBurned} burned, ${result.totalSolSpent.toFixed(4)} SOL spent`);

    return result;
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    console.error("[Buyback Agent] Cycle error:", errorMsg);
    result.errors.push(errorMsg);
    buybackState.errors.push(`${new Date().toISOString()}: ${errorMsg}`);

    // Keep only last 10 errors
    if (buybackState.errors.length > 10) {
      buybackState.errors = buybackState.errors.slice(-10);
    }

    return result;
  }
}

// Manual trigger
export async function triggerBuyback(): Promise<BuybackResult> {
  if (!bagsApi) {
    initBuybackAgent();
  }
  return runBuybackCycle();
}

// Get current state
export function getBuybackState(): BuybackState & { config: BuybackConfig } {
  return {
    ...buybackState,
    config: buybackConfig,
  };
}

// Update configuration
export function updateBuybackConfig(config: Partial<BuybackConfig>): BuybackConfig {
  buybackConfig = { ...buybackConfig, ...config };

  // Restart interval if running and interval changed
  if (buybackState.isRunning && config.intervalMs) {
    stopBuybackAgent();
    startBuybackAgent();
  }

  return buybackConfig;
}

// Reset state
export function resetBuybackState(): void {
  buybackState = {
    isRunning: false,
    lastBuyback: 0,
    totalBuybacksSol: 0,
    totalTokensBurned: 0,
    buybackCount: 0,
    errors: [],
    lastTokensBought: [],
  };
}
