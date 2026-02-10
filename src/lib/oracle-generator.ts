// Oracle Auto-Generator - Creates price prediction markets from real data

import type { OracleMarketConfig } from "./types";
import { createOracleRound, getActiveOracleMarkets, type OracleTokenOptionDB } from "./neon";
import { getAllWorldTokensAsync, type LaunchedToken } from "./token-registry";
import { getTokenPrice, fetchWorldState } from "./oracle-resolver";
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
      question: "Which BagsWorld token gains the most in 24 hours?",
      category: "bagsworld",
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
// Market Frequency Configuration
// ============================================

const MARKET_FREQUENCY_HOURS: Record<string, number> = {
  price_prediction: 24,
  world_health: 12,
  weather_forecast: 6,
  fee_volume: 24,
};

export function getMarketFrequencyHours(type: string): number {
  return MARKET_FREQUENCY_HOURS[type] ?? 24;
}

// ============================================
// World Health Market Generator
// ============================================

export async function generateWorldHealthMarket(): Promise<{
  success: boolean;
  roundId?: number;
  error?: string;
}> {
  try {
    const state = await fetchWorldState();
    const health = state?.health ?? 50;

    // Threshold near current health ±5, clamped to [10, 90]
    const offset = Math.floor(Math.random() * 11) - 5; // -5 to +5
    const threshold = Math.max(10, Math.min(90, health + offset));

    const marketConfig: OracleMarketConfig = {
      outcome_type: "binary",
      outcomes: [
        { id: "yes", label: "YES" },
        { id: "no", label: "NO" },
      ],
      resolution_logic: "world_health",
      question: `Will world health be above ${threshold}% in 12 hours?`,
      category: "bagsworld",
      threshold,
    };

    const endTime = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const result = await createOracleRound([], endTime, defaultPrizeLamports, {
      marketType: "world_health",
      marketConfig: marketConfig as unknown as Record<string, unknown>,
      autoResolve: true,
      resolutionSource: "world_state",
      createdBy: "auto_generator",
      entryCostOp: 100,
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Weather Forecast Market Generator
// ============================================

export async function generateWeatherForecastMarket(): Promise<{
  success: boolean;
  roundId?: number;
  error?: string;
}> {
  try {
    const marketConfig: OracleMarketConfig = {
      outcome_type: "multiple_choice",
      outcomes: [
        { id: "sunny", label: "Sunny" },
        { id: "cloudy", label: "Cloudy" },
        { id: "rain", label: "Rain" },
        { id: "storm", label: "Storm" },
      ],
      resolution_logic: "weather_forecast",
      question: "What will the BagsWorld weather be in 6 hours?",
      category: "bagsworld",
    };

    const endTime = new Date(Date.now() + 6 * 60 * 60 * 1000);

    const result = await createOracleRound([], endTime, defaultPrizeLamports, {
      marketType: "weather_forecast",
      marketConfig: marketConfig as unknown as Record<string, unknown>,
      autoResolve: true,
      resolutionSource: "world_state",
      createdBy: "auto_generator",
      entryCostOp: 50,
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Fee Volume Market Generator
// ============================================

export async function generateFeeVolumeMarket(): Promise<{
  success: boolean;
  roundId?: number;
  error?: string;
}> {
  try {
    const state = await fetchWorldState();
    const health = state?.health ?? 50;

    let threshold: number;
    if (health > 70) {
      threshold = 10;
    } else if (health > 50) {
      threshold = 5;
    } else {
      threshold = 2;
    }

    const marketConfig: OracleMarketConfig = {
      outcome_type: "binary",
      outcomes: [
        { id: "over", label: "OVER" },
        { id: "under", label: "UNDER" },
      ],
      resolution_logic: "fee_volume",
      question: `Will 24h claim volume exceed ${threshold} SOL?`,
      category: "bagsworld",
      threshold,
    };

    const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await createOracleRound([], endTime, defaultPrizeLamports, {
      marketType: "fee_volume",
      marketConfig: marketConfig as unknown as Record<string, unknown>,
      autoResolve: true,
      resolutionSource: "world_state",
      createdBy: "auto_generator",
      entryCostOp: 100,
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Main Generator Function
// ============================================

const GENERATORS: Record<
  string,
  () => Promise<{ success: boolean; roundId?: number; error?: string }>
> = {
  price_prediction: generatePricePredictionMarket,
  world_health: generateWorldHealthMarket,
  weather_forecast: generateWeatherForecastMarket,
  fee_volume: generateFeeVolumeMarket,
};

export async function generateMarkets(): Promise<GenerationResult> {
  const result: GenerationResult = {
    generated: [],
    skipped: [],
    errors: [],
  };

  try {
    const activeMarkets = await getActiveOracleMarkets();
    const now = Date.now();

    for (const [marketType, generator] of Object.entries(GENERATORS)) {
      const activeOfType = activeMarkets.filter(
        (m) => (m.marketType || "price_prediction") === marketType
      );

      // Skip if already at max (2 active)
      if (activeOfType.length >= 2) {
        result.skipped.push({
          marketType,
          reason: `Already has ${activeOfType.length} active markets (max 2)`,
        });
        continue;
      }

      // Skip if generated too recently
      const frequencyMs = getMarketFrequencyHours(marketType) * 60 * 60 * 1000;
      const mostRecent = activeOfType.reduce((latest, m) => {
        const t = new Date(m.startTime).getTime();
        return t > latest ? t : latest;
      }, 0);

      if (mostRecent > 0 && now - mostRecent < frequencyMs) {
        const hoursAgo = ((now - mostRecent) / (60 * 60 * 1000)).toFixed(1);
        result.skipped.push({
          marketType,
          reason: `Only ${hoursAgo}h since last (need ${getMarketFrequencyHours(marketType)}h)`,
        });
        continue;
      }

      try {
        const genResult = await generator();
        if (genResult.success && genResult.roundId) {
          result.generated.push({ marketType, roundId: genResult.roundId });
        } else {
          result.errors.push({
            marketType,
            error: genResult.error || "Unknown generation error",
          });
        }
      } catch (err) {
        result.errors.push({
          marketType,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Force-generate price_prediction if nothing succeeded and no active markets
    if (result.generated.length === 0 && activeMarkets.length === 0) {
      try {
        const forced = await generatePricePredictionMarket();
        if (forced.success && forced.roundId) {
          result.generated.push({ marketType: "forced_price_prediction", roundId: forced.roundId });
        } else {
          result.errors.push({
            marketType: "price_prediction",
            error: forced.error || "Force-generation failed",
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
