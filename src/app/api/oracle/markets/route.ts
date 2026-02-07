// Oracle Markets API - Get all active markets
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveOracleMarkets,
  getOraclePredictionCounts,
  getUserOraclePrediction,
  isNeonConfigured,
  initializeOracleTables,
} from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const marketType = searchParams.get("type");

  const activeMarkets = await getActiveOracleMarkets(marketType || undefined);

  const markets = await Promise.all(
    activeMarkets.map(async (round) => {
      const predictionCounts = await getOraclePredictionCounts(round.id);
      const endTime = round.endTime;
      const now = new Date();
      const remainingMs = Math.max(0, endTime.getTime() - now.getTime());
      const entryDeadline = new Date(endTime.getTime() - 2 * 60 * 60 * 1000);
      const canEnter = now < entryDeadline;

      let userPrediction = null;
      if (wallet) {
        const prediction = await getUserOraclePrediction(round.id, wallet);
        if (prediction) {
          userPrediction = {
            tokenMint: prediction.tokenMint,
            outcomeId: prediction.outcomeId,
            opWagered: prediction.opWagered,
            createdAt: prediction.createdAt.toISOString(),
          };
        }
      }

      const marketConfig = round.marketConfig as Record<string, unknown> | undefined;

      return {
        id: round.id,
        status: round.status,
        startTime: round.startTime.toISOString(),
        endTime: round.endTime.toISOString(),
        remainingMs,
        canEnter,
        entryDeadline: entryDeadline.toISOString(),
        entryCount: round.entryCount,
        marketType: round.marketType || "price_prediction",
        question: (marketConfig?.question as string) || "Which token gains the most in 24h?",
        outcomeType: (marketConfig?.outcome_type as string) || "multiple_choice",
        outcomes: (marketConfig?.outcomes as unknown[]) || [],
        tokenOptions: round.tokenOptions,
        predictionCounts,
        entryCostOp: round.entryCostOp || 100,
        autoResolve: round.autoResolve || false,
        createdBy: round.createdBy || "admin",
        userPrediction,
        prizePool: {
          lamports: round.prizePoolLamports.toString(),
          sol: Number(round.prizePoolLamports) / 1_000_000_000,
          hasPrize: round.prizePoolLamports > BigInt(0),
        },
      };
    })
  );

  return NextResponse.json({
    success: true,
    markets,
    totalActive: markets.length,
  });
}
