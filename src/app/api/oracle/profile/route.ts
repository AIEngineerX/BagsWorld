// Oracle Profile API - Get user's OP balance, stats, and achievements
import { NextRequest, NextResponse } from "next/server";
import { isNeonConfigured, initializeOracleTables } from "@/lib/neon";
import { getOrCreateUser, getOPLedger, getReputationTierBonus } from "@/lib/op-economy";
import type { OracleReputationTier } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ success: false, error: "Missing wallet" }, { status: 400 });
  }

  const user = await getOrCreateUser(wallet);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Failed to get user profile" },
      { status: 500 }
    );
  }

  const ledger = await getOPLedger(wallet, 20);

  const winRate =
    user.totalMarketsEntered > 0
      ? Math.round((user.totalMarketsWon / user.totalMarketsEntered) * 100)
      : 0;

  const tierBonus = getReputationTierBonus(user.reputationTier as OracleReputationTier);

  // Calculate next daily claim time
  let nextDailyClaimAt: string | null = null;
  let canClaimDaily = true;
  if (user.lastDailyClaim) {
    const lastClaim = new Date(user.lastDailyClaim);
    const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() < nextClaim) {
      canClaimDaily = false;
      nextDailyClaimAt = nextClaim.toISOString();
    }
  }

  return NextResponse.json({
    success: true,
    profile: {
      wallet: user.wallet,
      opBalance: user.opBalance,
      totalOpEarned: user.totalOpEarned,
      totalOpSpent: user.totalOpSpent,
      reputationScore: user.reputationScore,
      reputationTier: user.reputationTier,
      tierBonus: `+${Math.round(tierBonus * 100)}%`,
      currentStreak: user.currentStreak,
      bestStreak: user.bestStreak,
      totalMarketsEntered: user.totalMarketsEntered,
      totalMarketsWon: user.totalMarketsWon,
      winRate,
      achievements: user.achievements,
      canClaimDaily,
      nextDailyClaimAt,
      createdAt: user.createdAt,
    },
    ledger: ledger.map((entry) => ({
      id: entry.id,
      amount: entry.amount,
      balanceAfter: entry.balanceAfter,
      txType: entry.txType,
      referenceId: entry.referenceId,
      createdAt: entry.createdAt,
    })),
  });
}
