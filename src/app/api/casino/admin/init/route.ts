// Casino Admin API - Initialize casino tables
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/verify-signature";
import { initializeCasinoTables, getCasinoAdminWallet, isNeonConfigured } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Check database is configured
    if (!isNeonConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
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
    const verification = verifyAdminSignature(wallet, signature, "init", timestamp, adminWallet);

    if (!verification.verified) {
      console.warn(`[Casino Admin] Init failed: ${verification.error}`);
      return NextResponse.json({ error: verification.error }, { status: 403 });
    }

    // Initialize tables
    const success = await initializeCasinoTables();

    if (!success) {
      return NextResponse.json({ error: "Failed to initialize casino tables" }, { status: 500 });
    }

    console.log(`[Casino Admin] Tables initialized by ${wallet}`);
    return NextResponse.json({
      success: true,
      message: "Casino tables initialized successfully",
    });
  } catch (error) {
    console.error("[Casino Admin] Init error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
