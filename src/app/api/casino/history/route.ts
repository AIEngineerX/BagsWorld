// Casino History API
import { NextRequest, NextResponse } from "next/server";
import { getCasinoHistory, isNeonConfigured } from "@/lib/neon";

export const dynamic = "force-dynamic";

// In-memory history for development
const historyByWallet = new Map<string, Array<{
  id: string;
  type: "raffle" | "wheel";
  result: string;
  amount: number;
  timestamp: number;
  isWin: boolean;
}>>();

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      );
    }

    // Try to get from database
    if (isNeonConfigured()) {
      try {
        const dbHistory = await getCasinoHistory(wallet);
        if (dbHistory) {
          return NextResponse.json({
            history: dbHistory,
          });
        }
      } catch (err) {
        console.error("Error getting history from DB:", err);
      }
    }

    // Fallback to in-memory
    const history = historyByWallet.get(wallet) || [];
    return NextResponse.json({
      history,
    });
  } catch (error) {
    console.error("Error in history GET:", error);
    return NextResponse.json(
      { error: "Failed to get history" },
      { status: 500 }
    );
  }
}
