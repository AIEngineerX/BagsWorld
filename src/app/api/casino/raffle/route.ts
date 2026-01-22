// Casino Raffle API - Get active raffle status
import { NextRequest, NextResponse } from "next/server";
import { getCasinoRaffle, isNeonConfigured } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    const includeCompleted = request.nextUrl.searchParams.get("includeCompleted") === "true";

    // Try to get from database
    if (isNeonConfigured()) {
      try {
        const dbRaffle = await getCasinoRaffle(includeCompleted);

        if (dbRaffle) {
          // Check if user has entered (without exposing all entries)
          const userEntered = wallet && dbRaffle.entries
            ? dbRaffle.entries.includes(wallet)
            : false;

          // Don't expose full entries list to non-admin
          return NextResponse.json({
            id: dbRaffle.id,
            status: dbRaffle.status,
            potSol: dbRaffle.potSol,
            entryCount: dbRaffle.entryCount,
            threshold: dbRaffle.threshold,
            userEntered,
            // Only include winner info for completed raffles
            ...(dbRaffle.status === "completed" && {
              winnerWallet: dbRaffle.winnerWallet,
              prizeSol: dbRaffle.prizeSol,
              drawnAt: dbRaffle.drawnAt,
            }),
            createdAt: dbRaffle.createdAt,
          });
        }

        // No raffle found
        return NextResponse.json({
          status: "none",
          message: "No active raffle",
        });
      } catch (err) {
        console.error("Error fetching raffle from DB:", err);
      }
    }

    // Database not configured
    return NextResponse.json({
      status: "none",
      message: "Casino not initialized",
    });
  } catch (error) {
    console.error("Error in raffle GET:", error);
    return NextResponse.json(
      { error: "Failed to get raffle status" },
      { status: 500 }
    );
  }
}
