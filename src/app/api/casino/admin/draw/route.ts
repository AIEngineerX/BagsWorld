// Casino Admin API - Draw raffle winner
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/verify-signature";
import { drawRaffleWinner, getCasinoAdminWallet, isNeonConfigured, checkRaffleThreshold } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Check database is configured
    if (!isNeonConfigured()) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { wallet, signature, timestamp } = body;

    // Validate required fields
    if (!wallet || !signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: wallet, signature, timestamp" },
        { status: 400 }
      );
    }

    // Verify admin signature
    const adminWallet = getCasinoAdminWallet();
    const verification = verifyAdminSignature(
      wallet,
      signature,
      "draw",
      timestamp,
      adminWallet
    );

    if (!verification.verified) {
      console.warn(`[Casino Admin] Draw failed: ${verification.error}`);
      return NextResponse.json(
        { error: verification.error },
        { status: 403 }
      );
    }

    // Draw the winner
    const result = await drawRaffleWinner();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Casino Admin] Raffle drawn by ${wallet}. Winner: ${result.winner}, Prize: ${result.prize} SOL`);
    return NextResponse.json({
      success: true,
      winner: result.winner,
      prize: result.prize,
      entryCount: result.entryCount,
      message: `Winner drawn! ${result.winner} wins ${result.prize} SOL`,
    });
  } catch (error) {
    console.error("[Casino Admin] Draw error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check if threshold is reached (no auth needed, read-only)
export async function GET() {
  try {
    if (!isNeonConfigured()) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const status = await checkRaffleThreshold();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[Casino Admin] Threshold check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
