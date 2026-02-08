// Oracle Auto-Resolve API - Cron endpoint to resolve expired markets
import { NextRequest, NextResponse } from "next/server";
import {
  getMarketsToResolve,
  settleOracleRound,
  settleOracleRoundWithOutcome,
  getOracleRoundPredictions,
  updatePredictionOPPayout,
  isNeonConfigured,
  initializeOracleTables,
} from "@/lib/neon";
import { resolveMarket, calculateOPPayouts } from "@/lib/oracle-resolver";
import { addOP, updateStreak, updateReputation } from "@/lib/op-economy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ORACLE_AUTO_RESOLVE_SECRET || process.env.AGENT_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  const marketsToResolve = await getMarketsToResolve();

  if (marketsToResolve.length === 0) {
    return NextResponse.json({ success: true, resolved: 0, message: "No markets to resolve" });
  }

  const results: Array<{
    roundId: number;
    marketType: string;
    success: boolean;
    winningOutcome?: string;
    payoutFailures?: number;
    error?: string;
  }> = [];

  for (const round of marketsToResolve) {
    try {
      const resolution = await resolveMarket(round);

      if (!resolution.success) {
        results.push({
          roundId: round.id,
          marketType: round.marketType || "price_prediction",
          success: false,
          error: resolution.error || "Resolution failed",
        });
        continue;
      }

      // Settle the round in the database
      if (resolution.winningTokenMint) {
        // Price prediction market - use existing settle flow
        await settleOracleRound(
          round.id,
          resolution.winningTokenMint,
          resolution.winningPriceChange || 0,
          resolution.resolutionData
        );
      } else if (resolution.winningOutcomeId) {
        // Outcome-based market
        await settleOracleRoundWithOutcome(
          round.id,
          resolution.winningOutcomeId,
          resolution.resolutionData
        );
      }

      // Distribute OP payouts
      let payoutFailures = 0;
      const predictions = await getOracleRoundPredictions(round.id);
      if (predictions.length > 0) {
        const winningId = resolution.winningOutcomeId || resolution.winningTokenMint || "";
        const isOutcomeBased = !!resolution.winningOutcomeId;
        const payouts = calculateOPPayouts(predictions, winningId, isOutcomeBased);

        // Calculate market difficulty (inverse of winning probability)
        const totalPredictions = predictions.length;
        const winnerCount = payouts.filter((p) => p.isWinner).length;
        const marketDifficulty =
          totalPredictions > 0 ? totalPredictions / Math.max(1, winnerCount) : 1;

        for (const payout of payouts) {
          // Update prediction record
          const payoutResult = await updatePredictionOPPayout(
            payout.predictionId,
            payout.opPayout,
            payout.isWinner,
            payout.rank
          );

          if (!payoutResult.success) {
            console.error(
              `[Oracle Auto-Resolve] Failed to record payout for prediction #${payout.predictionId}: ${payoutResult.error}`
            );
            payoutFailures++;
            continue; // Skip crediting OP if we can't record the payout
          }

          // Credit OP winnings
          if (payout.opPayout > 0) {
            const opResult = await addOP(
              payout.wallet,
              payout.opPayout,
              "prediction_win",
              round.id
            );
            if (!opResult.success) {
              console.error(
                `[Oracle Auto-Resolve] Failed to credit ${payout.opPayout} OP to ${payout.wallet}: ${opResult.error}`
              );
              payoutFailures++;
            }
          }

          // Update streaks and reputation
          await updateStreak(payout.wallet, payout.isWinner);
          await updateReputation(payout.wallet, payout.isWinner, marketDifficulty);
        }
      }

      results.push({
        roundId: round.id,
        marketType: round.marketType || "price_prediction",
        success: true,
        winningOutcome: resolution.winningOutcomeId || resolution.winningTokenMint,
        ...(payoutFailures > 0 ? { payoutFailures } : {}),
      });

      console.log(
        `[Oracle Auto-Resolve] Round #${round.id} (${round.marketType}) resolved: winner=${resolution.winningOutcomeId || resolution.winningTokenMint}${payoutFailures > 0 ? ` (${payoutFailures} payout failures)` : ""}`
      );
    } catch (error) {
      console.error(`[Oracle Auto-Resolve] Error resolving round #${round.id}:`, error);
      results.push({
        roundId: round.id,
        marketType: round.marketType || "price_prediction",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const resolvedCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    success: true,
    resolved: resolvedCount,
    total: marketsToResolve.length,
    results,
  });
}
