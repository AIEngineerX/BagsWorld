// Buyback & Burn Module - Automated token buybacks and burns
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createBurnInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAgentWallet, getAgentConnection, getAgentBalance } from "./agent-wallet";
import { getJupiterClient } from "./jupiter-api";

// Buyback & Burn Configuration
export interface BuybackBurnConfig {
  enabled: boolean;
  // Tokens to buy and burn (by priority)
  targetTokens: TokenBuybackConfig[];
  // Minimum SOL to trigger buyback (after claiming)
  minBuybackThresholdSol: number;
  // Percentage of claimed SOL to use for buyback (0-100)
  buybackPercentage: number;
  // Keep minimum SOL in wallet for fees
  reserveSol: number;
  // Slippage tolerance (basis points)
  slippageBps: number;
  // Burn address (default: token program burn)
  useProgramBurn: boolean;
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

// Default configuration
const DEFAULT_CONFIG: BuybackBurnConfig = {
  enabled: false,
  targetTokens: [],
  minBuybackThresholdSol: 0.1,
  buybackPercentage: 50, // Use 50% of claimed SOL for buybacks
  reserveSol: 0.01, // Keep 0.01 SOL for tx fees
  slippageBps: 500, // 5% slippage
  useProgramBurn: true,
};

let buybackConfig: BuybackBurnConfig = { ...DEFAULT_CONFIG };
const jupiter = getJupiterClient();

// Initialize buyback config
export function initBuybackBurn(config?: Partial<BuybackBurnConfig>): BuybackBurnConfig {
  buybackConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate allocations sum to 100
  if (buybackConfig.targetTokens.length > 0) {
    const totalAllocation = buybackConfig.targetTokens.reduce(
      (sum, t) => sum + t.allocationPercent,
      0
    );
    if (totalAllocation !== 100) {
      console.warn(`Token allocations sum to ${totalAllocation}%, should be 100%`);
    }
  }

  console.log("Buyback & Burn initialized:", {
    enabled: buybackConfig.enabled,
    tokens: buybackConfig.targetTokens.map(t => t.symbol),
    threshold: buybackConfig.minBuybackThresholdSol,
    percentage: buybackConfig.buybackPercentage,
  });

  return buybackConfig;
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
 * Execute buyback and burn after claiming fees
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

    if (buybackConfig.targetTokens.length === 0) {
      result.errors.push("No target tokens configured");
      return result;
    }

    const wallet = getAgentWallet();
    if (!wallet) {
      throw new Error("Agent wallet not configured");
    }

    const connection = getAgentConnection();
    const walletBalance = await getAgentBalance();

    // Calculate buyback amount
    const buybackAmount = claimedSol * (buybackConfig.buybackPercentage / 100);
    const availableForBuyback = Math.max(
      0,
      walletBalance - buybackConfig.reserveSol
    );
    const actualBuybackAmount = Math.min(buybackAmount, availableForBuyback);

    console.log(`Buyback calculation:`, {
      claimed: claimedSol,
      buybackPercent: buybackConfig.buybackPercentage,
      targetBuyback: buybackAmount,
      walletBalance,
      reserve: buybackConfig.reserveSol,
      actualBuyback: actualBuybackAmount,
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

    for (const tokenConfig of buybackConfig.targetTokens) {
      try {
        const tokenBuybackSol = actualBuybackAmount * (tokenConfig.allocationPercent / 100);

        if (tokenBuybackSol < tokenConfig.minBuySol) {
          console.log(`Skipping ${tokenConfig.symbol}: ${tokenBuybackSol} < ${tokenConfig.minBuySol} SOL`);
          continue;
        }

        console.log(`Buying ${tokenConfig.symbol} with ${tokenBuybackSol} SOL...`);

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

        console.log(`Bought ${tokensReceived} ${tokenConfig.symbol} for ${tokenBuybackSol} SOL`);

        // Burn if configured
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
              console.log(`Burned ${tokensReceived} ${tokenConfig.symbol}`);
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
    return result;
  } catch (error: any) {
    const errorMsg = error.message || "Buyback failed";
    console.error("Buyback & burn error:", errorMsg);
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
