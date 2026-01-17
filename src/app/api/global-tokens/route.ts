// Global Tokens API - Shared state for all BagsWorld users
import { NextRequest, NextResponse } from "next/server";
import {
  getGlobalTokens,
  saveGlobalToken,
  isSupabaseConfigured,
  type GlobalToken
} from "@/lib/supabase";

// GET - Fetch all global tokens (everyone sees these)
export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        tokens: [],
        configured: false,
        message: "Database not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY"
      });
    }

    const tokens = await getGlobalTokens();

    return NextResponse.json({
      tokens,
      configured: true,
      count: tokens.length,
    });
  } catch (error) {
    console.error("Error fetching global tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch global tokens" },
      { status: 500 }
    );
  }
}

// POST - Save a new token to the global database
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured", configured: false },
        { status: 503 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.mint || !body.name || !body.symbol || !body.creator_wallet) {
      return NextResponse.json(
        { error: "Missing required fields: mint, name, symbol, creator_wallet" },
        { status: 400 }
      );
    }

    const token: GlobalToken = {
      mint: body.mint,
      name: body.name,
      symbol: body.symbol,
      description: body.description,
      image_url: body.image_url || body.imageUrl,
      creator_wallet: body.creator_wallet || body.creator,
      fee_shares: body.fee_shares || body.feeShares,
      lifetime_fees: body.lifetime_fees,
      market_cap: body.market_cap,
      volume_24h: body.volume_24h,
    };

    const success = await saveGlobalToken(token);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to save token" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Token saved to global database",
      token,
    });
  } catch (error) {
    console.error("Error saving global token:", error);
    return NextResponse.json(
      { error: "Failed to save token" },
      { status: 500 }
    );
  }
}
