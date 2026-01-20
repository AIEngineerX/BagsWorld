// Casino Raffle Entry API
import { NextRequest, NextResponse } from "next/server";
import { enterCasinoRaffle, isNeonConfigured } from "@/lib/neon";

// In-memory state for development
const raffleEntries = new Map<string, boolean>();

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

    // Check if already entered (in-memory check)
    if (raffleEntries.has(wallet)) {
      return NextResponse.json(
        { error: "Already entered this raffle round" },
        { status: 400 }
      );
    }

    // Try to enter via database
    if (isNeonConfigured()) {
      try {
        const result = await enterCasinoRaffle(wallet);
        if (result.success) {
          raffleEntries.set(wallet, true); // Also update in-memory
          return NextResponse.json({
            success: true,
            message: "Successfully entered raffle!",
            entryCount: result.entryCount,
          });
        } else {
          return NextResponse.json(
            { error: result.error || "Failed to enter raffle" },
            { status: 400 }
          );
        }
      } catch (err) {
        console.error("Error entering raffle via DB:", err);
      }
    }

    // Fallback to in-memory
    raffleEntries.set(wallet, true);
    return NextResponse.json({
      success: true,
      message: "Successfully entered raffle!",
      entryCount: raffleEntries.size,
    });
  } catch (error) {
    console.error("Error in raffle entry:", error);
    return NextResponse.json(
      { error: "Failed to enter raffle" },
      { status: 500 }
    );
  }
}
