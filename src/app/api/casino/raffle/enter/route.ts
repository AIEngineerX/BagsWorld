// Casino Raffle Entry API
import { NextRequest, NextResponse } from "next/server";
import { enterCasinoRaffle, checkRaffleThreshold, isNeonConfigured } from "@/lib/neon";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      );
    }

    // Validate wallet format (basic check)
    if (typeof wallet !== "string" || wallet.length < 32 || wallet.length > 44) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // Check database is configured
    if (!isNeonConfigured()) {
      return NextResponse.json(
        { error: "Casino not initialized" },
        { status: 503 }
      );
    }

    // Enter raffle
    const result = await enterCasinoRaffle(wallet);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: "Failed to enter raffle" },
      { status: 500 }
    );
  }
}
