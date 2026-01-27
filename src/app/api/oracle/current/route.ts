// Oracle Current Round API - Get active round status
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveOracleRound,
  getUserOraclePrediction,
  getOraclePredictionCounts,
  isNeonConfigured,
} from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!isNeonConfigured()) {
    return NextResponse.json({
      status: "none",
      message: "Oracle not initialized",
    });
  }

  const round = await getActiveOracleRound();

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
  if (wallet) {
    const prediction = await getUserOraclePrediction(round.id, wallet);
    if (prediction) {
      userPrediction = {
        tokenMint: prediction.tokenMint,
        createdAt: prediction.createdAt.toISOString(),
      };
    }
  }

  // Calculate countdown
  const endTime = new Date(round.endTime);
  const now = new Date();
  const remainingMs = Math.max(0, endTime.getTime() - now.getTime());
  const entryDeadline = new Date(endTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before end
  const canEnter = now < entryDeadline;

  return NextResponse.json({
    id: round.id,
    status: round.status,
    startTime: round.startTime.toISOString(),
    endTime: round.endTime.toISOString(),
    tokenOptions: round.tokenOptions,
    entryCount: round.entryCount,
    predictionCounts,
    userPrediction,
    remainingMs,
    canEnter,
    entryDeadline: entryDeadline.toISOString(),
    // Include settlement data if round is settled
    ...(round.status === "settled" && {
      winningTokenMint: round.winningTokenMint,
      winningPriceChange: round.winningPriceChange,
      settlementData: round.settlementData,
    }),
  });
}
