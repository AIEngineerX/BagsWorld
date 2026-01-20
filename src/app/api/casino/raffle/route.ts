// Casino Raffle API - Get active raffle status
import { NextRequest, NextResponse } from "next/server";
import { getCasinoRaffle, isNeonConfigured } from "@/lib/neon";

// In-memory state for development (replaced by DB in production)
let raffleState = {
  id: 1,
  status: "active" as "active" | "drawing" | "completed",
  potLamports: 250000000, // 0.25 SOL starting pot
  entryCount: 3,
  threshold: 0.5, // Draw at 0.5 SOL
  entries: new Map<string, boolean>(), // wallet -> entered
};

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");

    // Try to get from database first
    if (isNeonConfigured()) {
      try {
        const dbRaffle = await getCasinoRaffle();
        if (dbRaffle) {
          return NextResponse.json({
            ...dbRaffle,
            userEntered: wallet ? dbRaffle.entries?.includes(wallet) : false,
          });
        }
      } catch (err) {
        console.error("Error fetching raffle from DB:", err);
      }
    }

    // Fallback to in-memory state
    return NextResponse.json({
      id: raffleState.id,
      status: raffleState.status,
      potLamports: raffleState.potLamports,
      entryCount: raffleState.entryCount,
      threshold: raffleState.threshold,
      userEntered: wallet ? raffleState.entries.has(wallet) : false,
    });
  } catch (error) {
    console.error("Error in raffle GET:", error);
    return NextResponse.json(
      { error: "Failed to get raffle status" },
      { status: 500 }
    );
  }
}
