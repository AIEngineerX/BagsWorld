// Oracle Markets API - Get all active markets
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveOracleMarkets,
  getOraclePredictionCounts,
  getUserOraclePrediction,
  isNeonConfigured,
} from "@/lib/neon";
import { lazyResolveExpiredMarkets } from "@/lib/oracle-resolver";
import { generatePricePredictionMarket } from "@/lib/oracle-generator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  // Lazy resolve any expired markets before fetching
  await lazyResolveExpiredMarkets();

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const marketType = searchParams.get("type");
  const categoryFilter = searchParams.get("category");

  let activeMarkets = await getActiveOracleMarkets(marketType || undefined);

  // Lazy generation: if no active markets exist, auto-generate a price prediction
  if (activeMarkets.length === 0) {
    await generatePricePredictionMarket();
    activeMarkets = await getActiveOracleMarkets(marketType || undefined);
  }

  const marketResults = await Promise.allSettled(
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
      const hasPrize = round.prizePoolLamports > BigInt(0);

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
        category: (marketConfig?.category as string) || "bagsworld",
        description: (marketConfig?.description as string) || undefined,
        imageUrl: (marketConfig?.imageUrl as string) || undefined,
        isPrizeEvent: (marketConfig?.isPrizeEvent as boolean) ?? hasPrize,
        prizePool: {
          lamports: round.prizePoolLamports.toString(),
          sol: Number(round.prizePoolLamports) / 1_000_000_000,
          hasPrize,
        },
      };
    })
  );

  let markets = marketResults
    .filter((r): r is PromiseFulfilledResult<ReturnType<typeof Object>> => r.status === "fulfilled")
    .map((r) => r.value);

  // Filter by category if requested
  if (categoryFilter) {
    markets = markets.filter(
      (m: { category?: string }) => (m.category || "bagsworld") === categoryFilter
    );
  }

  // Sort: prize events first, then by remaining time ascending
  markets.sort(
    (
      a: { isPrizeEvent?: boolean; remainingMs: number },
      b: { isPrizeEvent?: boolean; remainingMs: number }
    ) => {
      if (a.isPrizeEvent && !b.isPrizeEvent) return -1;
      if (!a.isPrizeEvent && b.isPrizeEvent) return 1;
      return a.remainingMs - b.remainingMs;
    }
  );

  return NextResponse.json({
    success: true,
    markets,
    totalActive: markets.length,
  });
}
