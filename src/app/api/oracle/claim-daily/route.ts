// Oracle Daily Claim API - Claim daily OP bonus
import { NextRequest, NextResponse } from "next/server";
import { isNeonConfigured, initializeOracleTables } from "@/lib/neon";
import { claimDailyBonus } from "@/lib/op-economy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  const body = await request.json();
  const { wallet } = body;

  if (!wallet) {
    return NextResponse.json({ success: false, error: "Missing wallet" }, { status: 400 });
  }

  const result = await claimDailyBonus(wallet);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        nextClaimAt: result.nextClaimAt,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    amount: result.amount,
    newBalance: result.newBalance,
    message: `Claimed ${result.amount} OP!`,
  });
}
