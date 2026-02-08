// Oracle Current Round API - Get active round status
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveOracleRound,
  getUserOraclePrediction,
  getOraclePredictionCounts,
  isNeonConfigured,
} from "@/lib/neon";
import { lazyResolveExpiredMarkets } from "@/lib/oracle-resolver";
import { generatePricePredictionMarket } from "@/lib/oracle-generator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!isNeonConfigured()) {
    return NextResponse.json({
      status: "none",
      message: "Oracle not initialized",
    });
  }

  // Lazy resolve any expired markets before fetching
  await lazyResolveExpiredMarkets();

  let round = await getActiveOracleRound();

  // Lazy generation: if no active round, auto-generate a price prediction
  if (!round) {
    await generatePricePredictionMarket();
    round = await getActiveOracleRound();
  }

  if (!round) {
    return NextResponse.json({
      status: "none",
      message: "No active prediction round",
    });
  }

  // Get prediction counts per token
  const predictionCounts = await getOraclePredictionCounts(round.id);

  // Check if user has entered (if wallet provided)
  let userPrediction = null;
  let userPrizeInfo = null;
  if (wallet) {
    const prediction = await getUserOraclePrediction(round.id, wallet);
    if (prediction) {
      userPrediction = {
        tokenMint: prediction.tokenMint,
        createdAt: prediction.createdAt.toISOString(),
      };

      // If round is settled and user won, include prize info
      if (
        round.status === "settled" &&
        prediction.isWinner &&
        prediction.prizeLamports > BigInt(0)
      ) {
        userPrizeInfo = {
          rank: prediction.predictionRank,
          prizeLamports: prediction.prizeLamports.toString(),
          prizeSol: Number(prediction.prizeLamports) / 1_000_000_000,
          claimed: prediction.claimed,
        };
      }
    }
  }

  // Calculate countdown
  const endTime = new Date(round.endTime);
  const now = new Date();
  const remainingMs = Math.max(0, endTime.getTime() - now.getTime());
  const entryDeadline = new Date(endTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before end
  const canEnter = now < entryDeadline;

  // Prize pool info
  const prizePoolLamports = round.prizePoolLamports || BigInt(0);
  const prizePoolSol = Number(prizePoolLamports) / 1_000_000_000;

  return NextResponse.json({
    id: round.id,
    status: round.status,
    startTime: round.startTime.toISOString(),
    endTime: round.endTime.toISOString(),
    tokenOptions: round.tokenOptions,
    entryCount: round.entryCount,
    predictionCounts,
    userPrediction,
    userPrizeInfo,
    remainingMs,
    canEnter,
    entryDeadline: entryDeadline.toISOString(),
    // Prize pool
    prizePool: {
      lamports: prizePoolLamports.toString(),
      sol: prizePoolSol,
      hasPrize: prizePoolSol > 0,
    },
    // Include settlement data if round is settled
    ...(round.status === "settled" && {
      winningTokenMint: round.winningTokenMint,
      winningPriceChange: round.winningPriceChange,
      settlementData: round.settlementData,
      prizeDistributed: round.prizeDistributed,
    }),
  });
}
