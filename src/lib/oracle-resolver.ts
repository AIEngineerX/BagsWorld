/**
 * Oracle Market Resolution Engine
 *
 * Resolves Oracle prediction markets by fetching real data and determining winners.
 * Supports price prediction and custom (admin-resolved) markets.
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
    case "custom":
      return {
        success: false,
        resolutionData: {},
        error: "Custom markets must be manually resolved by admin",
      };
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

const WEATHER_FALLBACKS: Record<string, string> = {
  apocalypse: "storm",
  storm: "rain",
  rain: "cloudy",
  cloudy: "sunny",
};

async function resolveWorldHealth(round: OracleRoundDB): Promise<ResolveResult> {
  const state = await fetchWorldState();
  if (!state) {
    return {
      success: false,
      resolutionData: {},
      error: "Failed to fetch world state",
    };
  }

  const config = (round as unknown as Record<string, unknown>).marketConfig as
    | Record<string, unknown>
    | undefined;
  const threshold = (config?.threshold as number) ?? 50;
  const health = state.health;

  return {
    success: true,
    winningOutcomeId: health >= threshold ? "yes" : "no",
    resolutionData: { currentHealth: health, threshold },
  };
}

// ---------------------------------------------------------------------------
// Weather Forecast Resolver
// ---------------------------------------------------------------------------

async function resolveWeatherForecast(round: OracleRoundDB): Promise<ResolveResult> {
  const state = await fetchWorldState();
  if (!state) {
    return {
      success: false,
      resolutionData: {},
      error: "Failed to fetch world state",
    };
  }

  const config = (round as unknown as Record<string, unknown>).marketConfig as
    | Record<string, unknown>
    | undefined;
  const outcomes = (config?.outcomes as Array<{ id: string; label: string }>) || [];
  const weather = state.weather;
  const outcomeIds = new Set(outcomes.map((o) => o.id));

  if (outcomeIds.has(weather)) {
    return {
      success: true,
      winningOutcomeId: weather,
      resolutionData: { weather },
    };
  }

  // Try fallback chain
  let fallback: string | undefined = WEATHER_FALLBACKS[weather];
  while (fallback) {
    if (outcomeIds.has(fallback)) {
      return {
        success: true,
        winningOutcomeId: fallback,
        resolutionData: { weather, usedFallback: true, originalWeather: weather },
      };
    }
    fallback = WEATHER_FALLBACKS[fallback];
  }

  return {
    success: false,
    resolutionData: { weather },
    error: `Weather "${weather}" does not match any configured outcome`,
  };
}

// ---------------------------------------------------------------------------
// Fee Volume Resolver
// ---------------------------------------------------------------------------

async function resolveFeeVolume(round: OracleRoundDB): Promise<ResolveResult> {
  const state = await fetchWorldState();
  if (!state) {
    return {
      success: false,
      resolutionData: {},
      error: "Failed to fetch world state",
    };
  }

  const config = (round as unknown as Record<string, unknown>).marketConfig as
    | Record<string, unknown>
    | undefined;
  const threshold = (config?.threshold as number) ?? 10;

  // Prefer healthMetrics.claimVolume24h if available
  const healthMetrics = (state as Record<string, unknown>).healthMetrics as
    | Record<string, number>
    | undefined;
  let claimVolume24h: number;
  let dataSource: string;

  if (healthMetrics?.claimVolume24h != null) {
    claimVolume24h = healthMetrics.claimVolume24h;
    dataSource = "healthMetrics";
  } else if (state.events && state.events.length > 0) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    claimVolume24h = state.events
      .filter(
        (e) => e.type === "fee_claim" && e.timestamp && new Date(e.timestamp).getTime() > cutoff
      )
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    dataSource = "events";
  } else {
    claimVolume24h = 0;
    dataSource = "no_data";
  }

  return {
    success: true,
    winningOutcomeId: claimVolume24h >= threshold ? "over" : "under",
    resolutionData: { claimVolume24h, threshold, dataSource },
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

// ---------------------------------------------------------------------------
// Lazy Resolution - Resolve expired markets on any Oracle endpoint hit
// ---------------------------------------------------------------------------

export async function lazyResolveExpiredMarkets(): Promise<{
  resolvedCount: number;
  errors: Array<{ roundId: number; error: string }>;
}> {
  // Dynamic imports to avoid circular dependencies
  const {
    getMarketsToResolve,
    settleOracleRound,
    settleOracleRoundWithOutcome,
    getOracleRoundPredictions,
    updatePredictionOPPayout,
  } = await import("./neon");
  const { addOP, updateStreak, updateReputation } = await import("./op-economy");

  const errors: Array<{ roundId: number; error: string }> = [];
  let resolvedCount = 0;

  try {
    const marketsToResolve = await getMarketsToResolve();

    if (marketsToResolve.length === 0) {
      return { resolvedCount: 0, errors: [] };
    }

    for (const round of marketsToResolve) {
      try {
        const resolution = await resolveMarket(round);

        if (!resolution.success) {
          errors.push({
            roundId: round.id,
            error: resolution.error || "Resolution failed",
          });
          continue;
        }

        // Settle the round in the database
        if (resolution.winningTokenMint) {
          await settleOracleRound(
            round.id,
            resolution.winningTokenMint,
            resolution.winningPriceChange || 0,
            resolution.resolutionData
          );
        } else if (resolution.winningOutcomeId) {
          await settleOracleRoundWithOutcome(
            round.id,
            resolution.winningOutcomeId,
            resolution.resolutionData
          );
        }

        // Distribute OP payouts
        const predictions = await getOracleRoundPredictions(round.id);
        if (predictions.length > 0) {
          const winningId = resolution.winningOutcomeId || resolution.winningTokenMint || "";
          const isOutcomeBased = !!resolution.winningOutcomeId;
          const payouts = calculateOPPayouts(predictions, winningId, isOutcomeBased);

          const totalPredictions = predictions.length;
          const winnerCount = payouts.filter((p) => p.isWinner).length;
          const marketDifficulty =
            totalPredictions > 0 ? totalPredictions / Math.max(1, winnerCount) : 1;

          for (const payout of payouts) {
            const payoutResult = await updatePredictionOPPayout(
              payout.predictionId,
              payout.opPayout,
              payout.isWinner,
              payout.rank
            );

            if (!payoutResult.success) {
              console.error(
                `[LazyResolve] Failed to record payout for prediction #${payout.predictionId}: ${payoutResult.error}`
              );
              continue;
            }

            if (payout.opPayout > 0) {
              const opResult = await addOP(
                payout.wallet,
                payout.opPayout,
                "prediction_win",
                round.id
              );
              if (!opResult.success) {
                console.error(
                  `[LazyResolve] Failed to credit ${payout.opPayout} OP to ${payout.wallet}: ${opResult.error}`
                );
              }
            }

            await updateStreak(payout.wallet, payout.isWinner);
            await updateReputation(payout.wallet, payout.isWinner, marketDifficulty);
          }
        }

        resolvedCount++;
        console.log(
          `[LazyResolve] Round #${round.id} (${round.marketType}) resolved: winner=${resolution.winningOutcomeId || resolution.winningTokenMint}`
        );
      } catch (error) {
        console.error(`[LazyResolve] Error resolving round #${round.id}:`, error);
        errors.push({
          roundId: round.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    console.error("[LazyResolve] Fatal error:", error);
  }

  return { resolvedCount, errors };
}
