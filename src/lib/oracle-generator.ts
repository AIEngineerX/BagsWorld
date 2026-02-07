// Oracle Auto-Generator - Creates prediction markets from real data
// Generates price_prediction, world_health, weather_forecast, and fee_volume markets

import type { OracleMarketType, OracleMarketConfig } from "./types";
import { createOracleRound, getActiveOracleMarkets, type OracleTokenOptionDB } from "./neon";
import { getAllWorldTokensAsync, type LaunchedToken } from "./token-registry";
import { getTokenPrice, fetchWorldState } from "./oracle-resolver";

// ============================================
// Types
// ============================================

export interface GenerationResult {
  generated: Array<{ marketType: string; roundId: number }>;
  skipped: Array<{ marketType: string; reason: string }>;
  errors: Array<{ marketType: string; error: string }>;
}

// ============================================
// Market Frequency Configuration
// ============================================

export function getMarketFrequencyHours(type: OracleMarketType): number {
  switch (type) {
    case "price_prediction":
      return 24;
    case "world_health":
      return 12;
    case "weather_forecast":
      return 6;
    case "fee_volume":
      return 24;
    default:
      return 24;
  }
}

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

    const result = await createOracleRound(dbTokenOptions, endTime, BigInt(0), {
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
// World Health Market Generator
// ============================================

export async function generateWorldHealthMarket(): Promise<{
  success: boolean;
  roundId?: number;
  error?: string;
}> {
  try {
    console.log("[OracleGen] Generating world health market...");

    const worldState = await fetchWorldState();
    const currentHealth = worldState?.health || 50;

    // Set threshold slightly above or below current health
    const offset = Math.random() > 0.5 ? 5 : -5;
    const threshold = Math.max(10, Math.min(90, currentHealth + offset));

    // Create binary market
    const marketConfig: OracleMarketConfig & { threshold: number } = {
      outcome_type: "binary",
      outcomes: [
        { id: "yes", label: "YES" },
        { id: "no", label: "NO" },
      ],
      resolution_logic: "world_health",
      question: `Will world health be above ${threshold}% at resolution?`,
      threshold,
    };

    // Duration: 12 hours
    const endTime = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const result = await createOracleRound([], endTime, BigInt(0), {
      marketType: "world_health",
      marketConfig: marketConfig as unknown as Record<string, unknown>,
      autoResolve: true,
      resolutionSource: "world_state",
      createdBy: "auto_generator",
      entryCostOp: 100,
    });

    if (result.success) {
      console.log(
        `[OracleGen] World health market created: round #${result.roundId}, threshold=${threshold}%`
      );
    }

    return result;
  } catch (error) {
    console.error("[OracleGen] Error generating world health market:", error);
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
    console.log("[OracleGen] Generating weather forecast market...");

    // Create multiple choice market
    const marketConfig: OracleMarketConfig = {
      outcome_type: "multiple_choice",
      outcomes: [
        { id: "sunny", label: "Sunny" },
        { id: "cloudy", label: "Cloudy" },
        { id: "rain", label: "Rain" },
        { id: "storm", label: "Storm" },
      ],
      resolution_logic: "weather_forecast",
      question: "What will the weather be in 6 hours?",
    };

    // Duration: 6 hours
    const endTime = new Date(Date.now() + 6 * 60 * 60 * 1000);

    const result = await createOracleRound([], endTime, BigInt(0), {
      marketType: "weather_forecast",
      marketConfig: marketConfig as unknown as Record<string, unknown>,
      autoResolve: true,
      resolutionSource: "world_state",
      createdBy: "auto_generator",
      entryCostOp: 50,
    });

    if (result.success) {
      console.log(`[OracleGen] Weather forecast market created: round #${result.roundId}`);
    }

    return result;
  } catch (error) {
    console.error("[OracleGen] Error generating weather forecast market:", error);
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
    console.log("[OracleGen] Generating fee volume market...");

    const worldState = await fetchWorldState();
    const health = worldState?.health || 50;

    // Use health to estimate a reasonable volume threshold
    const threshold = health > 70 ? 10 : health > 50 ? 5 : 2;

    // Create binary market
    const marketConfig: OracleMarketConfig & { threshold: number } = {
      outcome_type: "binary",
      outcomes: [
        { id: "over", label: "OVER" },
        { id: "under", label: "UNDER" },
      ],
      resolution_logic: "fee_volume",
      question: `Will total fees claimed exceed ${threshold} SOL today?`,
      threshold,
    };

    // Duration: 24 hours
    const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await createOracleRound([], endTime, BigInt(0), {
      marketType: "fee_volume",
      marketConfig: marketConfig as unknown as Record<string, unknown>,
      autoResolve: true,
      resolutionSource: "bags_sdk",
      createdBy: "auto_generator",
      entryCostOp: 100,
    });

    if (result.success) {
      console.log(
        `[OracleGen] Fee volume market created: round #${result.roundId}, threshold=${threshold} SOL`
      );
    }

    return result;
  } catch (error) {
    console.error("[OracleGen] Error generating fee volume market:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Main Generator Function
// ============================================

const MARKET_TYPES: OracleMarketType[] = [
  "price_prediction",
  "world_health",
  "weather_forecast",
  "fee_volume",
];

const GENERATORS: Record<
  OracleMarketType,
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
    // Get all active markets
    const activeMarkets = await getActiveOracleMarkets();

    // Count active markets per type
    const activeCountByType: Record<string, number> = {};
    const mostRecentByType: Record<string, Date> = {};

    for (const market of activeMarkets) {
      const mType = market.marketType || "price_prediction";
      activeCountByType[mType] = (activeCountByType[mType] || 0) + 1;

      // Track most recent start time per type
      const startTime = new Date(market.startTime);
      if (!mostRecentByType[mType] || startTime > mostRecentByType[mType]) {
        mostRecentByType[mType] = startTime;
      }
    }

    const totalActive = activeMarkets.length;

    for (const marketType of MARKET_TYPES) {
      const activeCount = activeCountByType[marketType] || 0;
      const frequencyHours = getMarketFrequencyHours(marketType);

      // Check: active count < 2 for this type
      if (activeCount >= 2) {
        result.skipped.push({
          marketType,
          reason: `Already has ${activeCount} active markets (max 2)`,
        });
        continue;
      }

      // Check: enough time since last generation
      const lastGenerated = mostRecentByType[marketType];
      if (lastGenerated) {
        const hoursSinceLast = (Date.now() - lastGenerated.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < frequencyHours) {
          result.skipped.push({
            marketType,
            reason: `Only ${hoursSinceLast.toFixed(1)}h since last (need ${frequencyHours}h)`,
          });
          continue;
        }
      }

      // Generate this market
      try {
        const genResult = await GENERATORS[marketType]();
        if (genResult.success && genResult.roundId) {
          result.generated.push({
            marketType,
            roundId: genResult.roundId,
          });
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

    // Smart rule: if zero active markets total and none generated, force a price_prediction
    if (totalActive === 0 && result.generated.length === 0) {
      console.log("[OracleGen] No active markets at all, force-generating price prediction");
      try {
        const forceResult = await generatePricePredictionMarket();
        if (forceResult.success && forceResult.roundId) {
          result.generated.push({
            marketType: "price_prediction",
            roundId: forceResult.roundId,
          });
        } else {
          result.errors.push({
            marketType: "price_prediction (forced)",
            error: forceResult.error || "Force generation failed",
          });
        }
      } catch (err) {
        result.errors.push({
          marketType: "price_prediction (forced)",
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
