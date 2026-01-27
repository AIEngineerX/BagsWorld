// Oracle Leaderboard API - Get top predictors
import { NextRequest, NextResponse } from "next/server";
import {
  getOracleLeaderboard,
  getUserOracleStats,
  isNeonConfigured,
} from "@/lib/neon";

export const dynamic = "force-dynamic";

function formatWallet(wallet: string): string {
  if (wallet.length <= 8) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({
      leaderboard: [],
      message: "Oracle not initialized",
    });
  }

  const wallet = request.nextUrl.searchParams.get("wallet");
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "10"), 1), 50);

  // Get leaderboard
  const leaderboard = await getOracleLeaderboard(limit);

  // Format for response
  const formattedLeaderboard = leaderboard.map((entry, index) => ({
    rank: index + 1,
    wallet: entry.wallet,
    walletShort: formatWallet(entry.wallet),
    wins: entry.wins,
    totalPredictions: entry.totalPredictions,
    winRate: Math.round(entry.winRate * 100),
    lastWin: entry.lastWin?.toISOString(),
  }));

  // Get user's stats if wallet provided
  let userStats = null;
  if (wallet) {
    const stats = await getUserOracleStats(wallet);
    if (stats) {
      userStats = {
        wallet,
        walletShort: formatWallet(wallet),
        wins: stats.wins,
        totalPredictions: stats.total,
        winRate: Math.round((stats.wins / Math.max(1, stats.total)) * 100),
        rank: stats.rank,
      };
    }
  }

  return NextResponse.json({
    leaderboard: formattedLeaderboard,
    userStats,
    totalPredictors: leaderboard.length,
  });
}
