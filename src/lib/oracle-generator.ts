// Oracle Auto-Generator - Creates price prediction markets from real data

import type { OracleMarketConfig } from "./types";
import { createOracleRound, getActiveOracleMarkets, type OracleTokenOptionDB } from "./neon";
import { getAllWorldTokensAsync, type LaunchedToken } from "./token-registry";
import { getTokenPrice } from "./oracle-resolver";
import { ECOSYSTEM_CONFIG } from "./config";

// ============================================
// Types
// ============================================

export interface GenerationResult {
  generated: Array<{ marketType: string; roundId: number }>;
  skipped: Array<{ marketType: string; reason: string }>;
  errors: Array<{ marketType: string; error: string }>;
}

// ============================================
// Default prize pool from config
// ============================================

const defaultPrizeLamports = BigInt(
  Math.floor(
    ((ECOSYSTEM_CONFIG.oracle?.prizePool as { defaultSol?: number })?.defaultSol ?? 0.1) *
      1_000_000_000
  )
);

// ============================================
// Price Prediction Market Generator
// ============================================

export async function generatePricePredictionMarket(): Promise<{
  success: boolean;
  roundId?: number;
  error?: string;
}> {
  try {
    console.log("[OracleGen] Generating price prediction market...");

    // Get tokens from the BagsWorld registry
    const registry = await getAllWorldTokensAsync();
    const activeTokens = registry
      .filter((t: LaunchedToken) => !t.mint.startsWith("Starter") && !t.mint.startsWith("Treasury"))
      .slice(0, 10);

    if (activeTokens.length === 0) {
      return { success: false, error: "No active tokens found in registry" };
    }

    // Fetch prices from DexScreener for all tokens in parallel
    const priceResults = await Promise.allSettled(
      activeTokens.map(async (token) => {
        const price = await getTokenPrice(token.mint);
        return { ...token, startPrice: price };
      })
    );

    const tokenPrices = priceResults
      .filter(
        (r): r is PromiseFulfilledResult<LaunchedToken & { startPrice: number }> =>
          r.status === "fulfilled" && r.value.startPrice > 0
      )
      .map((r) => ({
        mint: r.value.mint,
        symbol: r.value.symbol,
        name: r.value.name,
        startPrice: r.value.startPrice,
        imageUrl: r.value.imageUrl,
      }));

    // Select top 5 tokens with valid prices
    const tokenOptions = tokenPrices.slice(0, 5);

    if (tokenOptions.length < 2) {
      return {
        success: false,
        error: `Only ${tokenOptions.length} tokens with valid prices, need at least 2`,
      };
    }

    // Create market config
    const marketConfig: OracleMarketConfig = {
      outcome_type: "multiple_choice",
      outcomes: tokenOptions.map((t) => ({
        id: t.mint,
        label: t.symbol,
        data: { startPrice: t.startPrice },
      })),
      resolution_logic: "price_prediction",
      question: "Which token gains the most in 24 hours?",
    };

    // Create DB-compatible token options
    const dbTokenOptions: OracleTokenOptionDB[] = tokenOptions.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      startPrice: t.startPrice,
      imageUrl: t.imageUrl,
    }));

    // Duration: 24 hours
    const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await createOracleRound(dbTokenOptions, endTime, defaultPrizeLamports, {
      marketType: "price_prediction",
      marketConfig: marketConfig as unknown as Record<string, unknown>,
      autoResolve: true,
      resolutionSource: "dexscreener",
      createdBy: "auto_generator",
      entryCostOp: 100,
    });

    if (result.success) {
      console.log(
        `[OracleGen] Price prediction market created: round #${result.roundId} with ${tokenOptions.length} tokens`
      );
    }

    return result;
  } catch (error) {
    console.error("[OracleGen] Error generating price prediction market:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Main Generator Function
// ============================================

export async function generateMarkets(): Promise<GenerationResult> {
  const result: GenerationResult = {
    generated: [],
    skipped: [],
    errors: [],
  };

  try {
    // Get all active markets
    const activeMarkets = await getActiveOracleMarkets();

    // Count active price_prediction markets
    const activePriceMarkets = activeMarkets.filter(
      (m) => (m.marketType || "price_prediction") === "price_prediction"
    ).length;

    if (activePriceMarkets >= 2) {
      result.skipped.push({
        marketType: "price_prediction",
        reason: `Already has ${activePriceMarkets} active markets (max 2)`,
      });
    } else {
      // Generate a price prediction market
      try {
        const genResult = await generatePricePredictionMarket();
        if (genResult.success && genResult.roundId) {
          result.generated.push({
            marketType: "price_prediction",
            roundId: genResult.roundId,
          });
        } else {
          result.errors.push({
            marketType: "price_prediction",
            error: genResult.error || "Unknown generation error",
          });
        }
      } catch (err) {
        result.errors.push({
          marketType: "price_prediction",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.log(
      `[OracleGen] Generation complete: ${result.generated.length} created, ${result.skipped.length} skipped, ${result.errors.length} errors`
    );

    return result;
  } catch (error) {
    console.error("[OracleGen] Fatal error in generateMarkets:", error);
    result.errors.push({
      marketType: "all",
      error: error instanceof Error ? error.message : "Fatal error",
    });
    return result;
  }
}
