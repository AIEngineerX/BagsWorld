import { NextRequest, NextResponse } from "next/server";
import { getRaffleEntries, getCasinoAdminWallet } from "@/lib/neon";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");
    const raffleId = searchParams.get("raffleId");

    // Verify admin wallet
    const adminWallet = getCasinoAdminWallet();
    if (wallet !== adminWallet) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    if (!raffleId) {
      return NextResponse.json({ success: false, error: "Missing raffleId" }, { status: 400 });
    }

    const entries = await getRaffleEntries(parseInt(raffleId));

    if (entries === null) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch entries" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, entries });
  } catch (error) {
    console.error("Error fetching entries:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
