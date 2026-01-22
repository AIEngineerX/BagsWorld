import { NextRequest, NextResponse } from "next/server";
import { pauseCasinoRaffle, resumeCasinoRaffle, getCasinoAdminWallet } from "@/lib/neon";
import { verifyAdminSignature } from "@/lib/verify-signature";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, signature, timestamp, action } = body;

    // Validate required fields
    if (!wallet || !signature || !timestamp || !action) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate action
    if (action !== "pause" && action !== "resume") {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use 'pause' or 'resume'" },
        { status: 400 }
      );
    }

    // Verify admin wallet
    const adminWallet = getCasinoAdminWallet();
    if (wallet !== adminWallet) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Not admin wallet" },
        { status: 403 }
      );
    }

    // Verify signature
    const verification = verifyAdminSignature(
      wallet,
      signature,
      `toggle-${action}`,
      timestamp,
      adminWallet
    );

    if (!verification.verified) {
      return NextResponse.json(
        { success: false, error: verification.error || "Signature verification failed" },
        { status: 403 }
      );
    }

    // Perform the action
    if (action === "pause") {
      const result = await pauseCasinoRaffle();
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, status: "paused" });
    } else {
      const result = await resumeCasinoRaffle();
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, status: "active" });
    }
  } catch (error) {
    console.error("Error toggling raffle:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
