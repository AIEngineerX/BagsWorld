// Casino Admin API - Create a new raffle
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/verify-signature";
import { createCasinoRaffle, getCasinoAdminWallet, isNeonConfigured } from "@/lib/neon";

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
    const { wallet, signature, timestamp, potSol, thresholdEntries } = body;

    // Validate required fields
    if (!wallet || !signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: wallet, signature, timestamp" },
        { status: 400 }
      );
    }

    if (typeof potSol !== "number" || potSol <= 0) {
      return NextResponse.json(
        { error: "potSol must be a positive number" },
        { status: 400 }
      );
    }

    // Cap pot at reasonable amount
    if (potSol > 1000) {
      return NextResponse.json(
        { error: "potSol cannot exceed 1000 SOL" },
        { status: 400 }
      );
    }

    // Verify admin signature
    const adminWallet = getCasinoAdminWallet();
    const verification = verifyAdminSignature(
      wallet,
      signature,
      "create-raffle",
      timestamp,
      adminWallet
    );

    if (!verification.verified) {
      console.warn(`[Casino Admin] Create raffle failed: ${verification.error}`);
      return NextResponse.json(
        { error: verification.error },
        { status: 403 }
      );
    }

    // Create the raffle
    const threshold = typeof thresholdEntries === "number" && thresholdEntries > 0
      ? thresholdEntries
      : 50; // Default to 50 entries

    const result = await createCasinoRaffle(potSol, threshold);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Casino Admin] Raffle #${result.raffleId} created by ${wallet}: ${potSol} SOL pot, ${threshold} entry threshold`);
    return NextResponse.json({
      success: true,
      raffleId: result.raffleId,
      potSol,
      thresholdEntries: threshold,
      message: `Raffle created with ${potSol} SOL pot. Draw at ${threshold} entries.`,
    });
  } catch (error) {
    console.error("[Casino Admin] Create raffle error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
