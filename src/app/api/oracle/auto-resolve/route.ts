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
          await updatePredictionOPPayout(
            payout.predictionId,
            payout.opPayout,
            payout.isWinner,
            payout.rank
          );

          // Credit OP winnings
          if (payout.opPayout > 0) {
            await addOP(payout.wallet, payout.opPayout, "prediction_win", round.id);
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
      });

      console.log(
        `[Oracle Auto-Resolve] Round #${round.id} (${round.marketType}) resolved: winner=${resolution.winningOutcomeId || resolution.winningTokenMint}`
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
