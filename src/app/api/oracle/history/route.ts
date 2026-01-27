// Oracle History API - Get past prediction rounds
import { NextRequest, NextResponse } from "next/server";
import { getOracleHistory, isNeonConfigured } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (!isNeonConfigured()) {
    return NextResponse.json({
      rounds: [],
      message: "Oracle not initialized",
    });
  }

  const history = await getOracleHistory(limit, wallet || undefined);

  const rounds = history.map(({ round, userPrediction }) => {
    // Find winning token details
    const winningToken = round.winningTokenMint
      ? round.tokenOptions.find((t) => t.mint === round.winningTokenMint)
      : null;

    return {
      id: round.id,
      status: round.status,
      startTime: round.startTime.toISOString(),
      endTime: round.endTime.toISOString(),
      tokenOptions: round.tokenOptions,
      entryCount: round.entryCount,
      winner: round.status === "settled" && winningToken
        ? {
            mint: round.winningTokenMint,
            symbol: winningToken.symbol,
            name: winningToken.name,
            priceChange: round.winningPriceChange,
          }
        : null,
      settlementData: round.settlementData,
      // Include user's prediction if available
      ...(userPrediction && {
        userPrediction: {
          tokenMint: userPrediction.tokenMint,
          isWinner: userPrediction.isWinner,
          createdAt: userPrediction.createdAt.toISOString(),
        },
      }),
    };
  });

  return NextResponse.json({ rounds });
}
