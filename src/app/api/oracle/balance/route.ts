// Oracle Balance API - Get user's claimable balance
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getOracleBalance,
  getOraclePendingClaim,
  isNeonConfigured,
} from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json(
      { success: false, error: "Oracle not initialized" },
      { status: 503 }
    );
  }

  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { success: false, error: "Missing wallet parameter" },
      { status: 400 }
    );
  }

  // Validate wallet address format
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid wallet address" },
      { status: 400 }
    );
  }

  const balance = await getOracleBalance(wallet);
  const pendingClaim = await getOraclePendingClaim(wallet);

  const balanceLamports = balance?.balanceLamports || BigInt(0);
  const totalEarnedLamports = balance?.totalEarnedLamports || BigInt(0);
  const totalClaimedLamports = balance?.totalClaimedLamports || BigInt(0);

  return NextResponse.json({
    success: true,
    wallet,
    balance: {
      lamports: balanceLamports.toString(),
      sol: Number(balanceLamports) / 1_000_000_000,
    },
    totalEarned: {
      lamports: totalEarnedLamports.toString(),
      sol: Number(totalEarnedLamports) / 1_000_000_000,
    },
    totalClaimed: {
      lamports: totalClaimedLamports.toString(),
      sol: Number(totalClaimedLamports) / 1_000_000_000,
    },
    lastClaimAt: balance?.lastClaimAt?.toISOString() || null,
    pendingClaim: pendingClaim
      ? {
          id: pendingClaim.id,
          amountLamports: pendingClaim.amountLamports.toString(),
          amountSol: Number(pendingClaim.amountLamports) / 1_000_000_000,
          status: pendingClaim.status,
          createdAt: pendingClaim.createdAt.toISOString(),
        }
      : null,
  });
}
