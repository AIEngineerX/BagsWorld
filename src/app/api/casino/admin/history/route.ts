import { NextRequest, NextResponse } from "next/server";
import { getRaffleHistory, getCasinoAdminWallet } from "@/lib/neon";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");
    const limit = searchParams.get("limit") || "10";

    // Verify admin wallet
    const adminWallet = getCasinoAdminWallet();
    if (wallet !== adminWallet) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const history = await getRaffleHistory(parseInt(limit));

    if (history === null) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
