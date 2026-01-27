// Casino Raffle Entry API
import { NextRequest, NextResponse } from "next/server";
import { enterCasinoRaffle, checkRaffleThreshold, isNeonConfigured } from "@/lib/neon";
import { isValidSolanaAddress } from "@/lib/env-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    // Validate wallet is a valid Solana address
    if (!isValidSolanaAddress(wallet)) {
      return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 });
    }

    // Check database is configured
    if (!isNeonConfigured()) {
      return NextResponse.json({ error: "Casino not initialized" }, { status: 503 });
    }

    // Enter raffle
    const result = await enterCasinoRaffle(wallet);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Check if threshold is reached after this entry
    const thresholdStatus = await checkRaffleThreshold();

    return NextResponse.json({
      success: true,
      message: "Successfully entered raffle!",
      entryCount: result.entryCount,
      threshold: thresholdStatus.threshold,
      thresholdReached: thresholdStatus.shouldDraw,
    });
  } catch (error) {
    console.error("Error in raffle entry:", error);
    return NextResponse.json({ error: "Failed to enter raffle" }, { status: 500 });
  }
}
