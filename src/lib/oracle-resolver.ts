/**
 * Oracle Market Resolution Engine
 *
 * Resolves Oracle prediction markets by fetching real data and determining winners.
 * Supports price prediction, world health, weather forecast, and fee volume markets.
 */

import type { OracleMarketType, WeatherType } from "./types";
import type { OracleRoundDB, OraclePredictionDB } from "./neon";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolveResult {
  success: boolean;
  winningOutcomeId?: string;
  winningTokenMint?: string;
  winningPriceChange?: number;
  resolutionData: Record<string, unknown>;
  error?: string;
}

export interface OPPayoutResult {
  predictionId: number;
  wallet: string;
  isWinner: boolean;
  opWagered: number;
  opPayout: number;
  rank?: number;
}

// ---------------------------------------------------------------------------
// Helper: fetch token price from DexScreener
// ---------------------------------------------------------------------------

export async function getTokenPrice(mint: string): Promise<number> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      next: { revalidate: 0 },
    } as RequestInit);

    if (!response.ok) return 0;

    const data = await response.json();
    const pairs = data?.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) return 0;

    // Pick the most liquid pair (highest 24h volume)
    const sorted = [...pairs].sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.volume as Record<string, number>)?.h24 ?? 0) -
        ((a.volume as Record<string, number>)?.h24 ?? 0)
    );

    const priceUsd = parseFloat(sorted[0]?.priceUsd ?? "0");
    return isNaN(priceUsd) ? 0 : priceUsd;
  } catch (error) {
    console.error(`[OracleResolver] Failed to fetch price for ${mint}:`, error);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Helper: fetch world state from internal API
// ---------------------------------------------------------------------------

export interface WorldStateResponse {
  health: number;
  weather: WeatherType;
  events?: Array<{
    type: string;
    amount?: number;
    timestamp?: string;
    data?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

export async function fetchWorldState(): Promise<WorldStateResponse | null> {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${siteUrl}/api/world-state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: [] }),
    });

    if (!res.ok) {
      console.error(`[OracleResolver] World state API returned ${res.status}`);
      return null;
    }

    return (await res.json()) as WorldStateResponse;
  } catch (error) {
    console.error("[OracleResolver] Failed to fetch world state:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main resolver dispatcher
// ---------------------------------------------------------------------------

export async function resolveMarket(round: OracleRoundDB): Promise<ResolveResult> {
  const marketType = (round.marketType || "price_prediction") as OracleMarketType;

  switch (marketType) {
    case "price_prediction":
      return resolvePricePrediction(round);
    case "world_health":
      return resolveWorldHealth(round);
    case "weather_forecast":
      return resolveWeatherForecast(round);
    case "fee_volume":
      return resolveFeeVolume(round);
    default:
      return {
        success: false,
        resolutionData: {},
        error: `Unknown market type: ${marketType}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Price Prediction Resolver
// ---------------------------------------------------------------------------

async function resolvePricePrediction(round: OracleRoundDB): Promise<ResolveResult> {
  const tokens = round.tokenOptions;
  if (!tokens || tokens.length === 0) {
    return {
      success: false,
      resolutionData: {},
      error: "No token options in round",
    };
  }

  const endPrices: Record<string, number> = {};
  const priceChanges: Record<string, number> = {};

  // Fetch current prices for all tokens in parallel
  const priceResults = await Promise.allSettled(
    tokens.map(async (token) => {
      const endPrice = await getTokenPrice(token.mint);
      return { mint: token.mint, startPrice: token.startPrice, endPrice };
    })
  );

  for (const result of priceResults) {
    if (result.status === "fulfilled") {
      const { mint, startPrice, endPrice } = result.value;
      endPrices[mint] = endPrice;

      if (startPrice > 0 && endPrice > 0) {
        priceChanges[mint] = ((endPrice - startPrice) / startPrice) * 100;
      } else {
        priceChanges[mint] = 0;
      }
    }
  }

  // Find the token with the highest positive price change
  let winningMint: string | undefined;
  let winningChange = -Infinity;

  for (const token of tokens) {
    const change = priceChanges[token.mint] ?? 0;
    if (change > winningChange) {
      winningChange = change;
      winningMint = token.mint;
    }
  }

  if (!winningMint) {
    return {
      success: false,
      resolutionData: { endPrices, priceChanges },
      error: "Could not determine winning token",
    };
  }

  return {
    success: true,
    winningTokenMint: winningMint,
    winningPriceChange: Math.round(winningChange * 100) / 100,
    resolutionData: {
      endPrices,
      priceChanges,
      resolvedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// World Health Resolver
// ---------------------------------------------------------------------------

async function resolveWorldHealth(round: OracleRoundDB): Promise<ResolveResult> {
  const config = round.marketConfig as Record<string, unknown> | undefined;
  const threshold = typeof config?.threshold === "number" ? config.threshold : 50;

  const worldState = await fetchWorldState();
  if (!worldState) {
    return {
      success: false,
      resolutionData: { threshold },
      error: "Failed to fetch world state for health resolution",
    };
  }

  const currentHealth = worldState.health;
  const winningOutcomeId = currentHealth >= threshold ? "yes" : "no";

  return {
    success: true,
    winningOutcomeId,
    resolutionData: {
      currentHealth,
      threshold,
      resolvedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Weather Forecast Resolver
// ---------------------------------------------------------------------------

async function resolveWeatherForecast(round: OracleRoundDB): Promise<ResolveResult> {
  const worldState = await fetchWorldState();
  if (!worldState) {
    return {
      success: false,
      resolutionData: {},
      error: "Failed to fetch world state for weather resolution",
    };
  }

  const currentWeather = worldState.weather;

  // Validate that the current weather matches one of the configured outcomes
  const config = round.marketConfig as Record<string, unknown> | undefined;
  const outcomes = (config?.outcomes ?? []) as Array<{ id: string; label?: string }>;

  const matchedOutcome = outcomes.find((o) => o.id === currentWeather);
  if (!matchedOutcome) {
    // Weather doesn't match any defined outcome — pick the closest
    // Fallback: map apocalypse to storm since it's the closest severity
    const weatherFallback: Record<string, string> = {
      apocalypse: "storm",
    };
    const fallbackId = weatherFallback[currentWeather] || currentWeather;
    const fallbackOutcome = outcomes.find((o) => o.id === fallbackId);

    return {
      success: !!fallbackOutcome,
      winningOutcomeId: fallbackOutcome?.id,
      resolutionData: {
        currentWeather,
        usedFallback: !!fallbackOutcome,
        resolvedAt: new Date().toISOString(),
      },
      error: fallbackOutcome
        ? undefined
        : `Weather "${currentWeather}" does not match any configured outcome`,
    };
  }

  return {
    success: true,
    winningOutcomeId: currentWeather,
    resolutionData: {
      currentWeather,
      resolvedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Fee Volume Resolver
// ---------------------------------------------------------------------------

async function resolveFeeVolume(round: OracleRoundDB): Promise<ResolveResult> {
  const config = round.marketConfig as Record<string, unknown> | undefined;
  const threshold = typeof config?.threshold === "number" ? config.threshold : 5;

  const worldState = await fetchWorldState();
  if (!worldState) {
    return {
      success: false,
      resolutionData: { threshold },
      error: "Failed to fetch world state for fee volume resolution",
    };
  }

  // Calculate 24h claim volume from events
  let claimVolume24h = 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (Array.isArray(worldState.events)) {
    for (const event of worldState.events) {
      if (event.type === "fee_claim" && typeof event.amount === "number") {
        const eventTime = event.timestamp ? new Date(event.timestamp).getTime() : 0;
        if (now - eventTime < dayMs) {
          claimVolume24h += event.amount;
        }
      }
    }
  }

  // If no events data available, use health as a proxy estimate
  // Health thresholds from CLAUDE.md: 70+ means claims > 5 SOL typically
  let usedHealthProxy = false;
  if (claimVolume24h === 0 && worldState.health > 0) {
    usedHealthProxy = true;
    const health = worldState.health;
    if (health >= 90) claimVolume24h = 50;
    else if (health >= 70) claimVolume24h = 20;
    else if (health >= 50) claimVolume24h = 10;
    else if (health >= 25) claimVolume24h = 2;
    else claimVolume24h = 0.5;
  }

  const winningOutcomeId = claimVolume24h >= threshold ? "over" : "under";

  return {
    success: true,
    winningOutcomeId,
    resolutionData: {
      claimVolume24h: Math.round(claimVolume24h * 1000) / 1000,
      threshold,
      healthProxy: usedHealthProxy || undefined,
      resolvedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// OP Payout Calculation (Parimutuel Model)
// ---------------------------------------------------------------------------

export function calculateOPPayouts(
  predictions: OraclePredictionDB[],
  winningOutcomeOrMint: string,
  isOutcomeBased: boolean
): OPPayoutResult[] {
  if (predictions.length === 0) return [];

  // Total pool = sum of all OP wagered
  const totalPool = predictions.reduce((sum, p) => sum + (p.opWagered ?? 0), 0);

  // Separate winners and losers
  const winners: OraclePredictionDB[] = [];
  const losers: OraclePredictionDB[] = [];

  for (const prediction of predictions) {
    const picked = isOutcomeBased ? prediction.outcomeId : prediction.tokenMint;
    if (picked === winningOutcomeOrMint) {
      winners.push(prediction);
    } else {
      losers.push(prediction);
    }
  }

  // If no winners, refund everyone
  if (winners.length === 0) {
    return predictions.map((p) => ({
      predictionId: p.id,
      wallet: p.wallet,
      isWinner: false,
      opWagered: p.opWagered ?? 0,
      opPayout: p.opWagered ?? 0, // full refund
    }));
  }

  // Sort winners by creation time (first-come = lower index = higher rank)
  const sortedWinners = [...winners].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Calculate weights using the same formula as calculatePrizeDistribution
  // Weight for rank i = (totalWinners - i + 1) ^ 1.5
  const totalWinners = sortedWinners.length;
  const weights: number[] = [];
  let totalWeight = 0;

  for (let rank = 1; rank <= totalWinners; rank++) {
    const weight = Math.pow(totalWinners - rank + 1, 1.5);
    weights.push(weight);
    totalWeight += weight;
  }

  // Build payout results for winners
  const results: OPPayoutResult[] = [];
  let distributedOp = 0;

  for (let i = 0; i < sortedWinners.length; i++) {
    const prediction = sortedWinners[i];
    const rank = i + 1;

    let opPayout: number;
    if (i === sortedWinners.length - 1) {
      // Last winner gets remainder to avoid rounding loss
      opPayout = totalPool - distributedOp;
    } else {
      opPayout = Math.floor((weights[i] / totalWeight) * totalPool);
      distributedOp += opPayout;
    }

    results.push({
      predictionId: prediction.id,
      wallet: prediction.wallet,
      isWinner: true,
      opWagered: prediction.opWagered ?? 0,
      opPayout,
      rank,
    });
  }

  // Losers get 0 from the pool
  for (const prediction of losers) {
    results.push({
      predictionId: prediction.id,
      wallet: prediction.wallet,
      isWinner: false,
      opWagered: prediction.opWagered ?? 0,
      opPayout: 0,
    });
  }

  return results;
}

// Participation reward constant (awarded to all participants outside of the pool)
export const OP_PARTICIPATION_REWARD = 10;
