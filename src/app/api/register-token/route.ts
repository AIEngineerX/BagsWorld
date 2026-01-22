// Register Token API - Add existing tokens to the global database
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { saveGlobalToken, isNeonConfigured, type GlobalToken } from "@/lib/neon";

// Validate Solana address
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isNeonConfigured()) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { mint, name, symbol, creator } = body;

    if (!mint || !isValidSolanaAddress(mint)) {
      return NextResponse.json(
        { error: "Invalid or missing mint address" },
        { status: 400 }
      );
    }

    // Create token record
    const token: GlobalToken = {
      mint,
      name: name || symbol || "Unknown Token",
      symbol: symbol || "???",
      creator_wallet: creator || mint, // Use mint as fallback creator
      description: body.description,
      image_url: body.imageUrl || body.image_url,
      fee_shares: body.feeShares || body.fee_shares || [],
    };

    console.log(`[Register Token] Registering: ${token.symbol} (${mint.slice(0, 8)}...)`);

    const success = await saveGlobalToken(token);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to save token" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Token ${token.symbol} registered successfully`,
      token,
    });
  } catch (error) {
    console.error("[Register Token] Error:", error);
    return NextResponse.json(
      { error: "Failed to register token" },
      { status: 500 }
    );
  }
}
