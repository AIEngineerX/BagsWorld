// Global Tokens API - Shared state for all BagsWorld users
import { NextRequest, NextResponse } from "next/server";
import {
  getGlobalTokens,
  saveGlobalToken,
  isNeonConfigured,
  type GlobalToken
} from "@/lib/neon";

// GET - Fetch all global tokens (everyone sees these)
export async function GET() {
  try {
    const dbConfigured = isNeonConfigured();
    console.log(`[Global Tokens] DB configured: ${dbConfigured}`);
    console.log(`[Global Tokens] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
    console.log(`[Global Tokens] NETLIFY_DATABASE_URL set: ${!!process.env.NETLIFY_DATABASE_URL}`);

    if (!dbConfigured) {
      return NextResponse.json({
        tokens: [],
        configured: false,
        message: "Database not configured. Set DATABASE_URL or use Netlify integration.",
        debug: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          NETLIFY_DATABASE_URL: !!process.env.NETLIFY_DATABASE_URL,
        }
      });
    }

    console.log("[Global Tokens] Fetching tokens from database...");
    const tokens = await getGlobalTokens();
    console.log(`[Global Tokens] Found ${tokens.length} tokens`);

    // Log sample token data for debugging
    if (tokens.length > 0) {
      const sample = tokens[0];
      console.log(`[Global Tokens] Sample token: ${sample.symbol}, creator: ${sample.creator_wallet}, fee_shares: ${JSON.stringify(sample.fee_shares)?.slice(0, 100)}`);
    }

    return NextResponse.json({
      tokens,
      configured: true,
      count: tokens.length,
    });
  } catch (error) {
    console.error("[Global Tokens] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch global tokens",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        configured: isNeonConfigured(),
      },
      { status: 500 }
    );
  }
}

// POST - Save a new token to the global database
export async function POST(request: NextRequest) {
  try {
    if (!isNeonConfigured()) {
      console.log("[Global Tokens POST] Database not configured");
      return NextResponse.json(
        { error: "Database not configured", configured: false },
        { status: 503 }
      );
    }

    const body = await request.json();
    console.log(`[Global Tokens POST] Received: mint=${body.mint}, symbol=${body.symbol}, creator=${body.creator_wallet || body.creator}`);

    // Validate required fields - accept both creator_wallet and creator
    const creatorWallet = body.creator_wallet || body.creator;
    if (!body.mint || !body.name || !body.symbol || !creatorWallet) {
      console.log(`[Global Tokens POST] Missing fields: mint=${!!body.mint}, name=${!!body.name}, symbol=${!!body.symbol}, creator=${!!creatorWallet}`);
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
      creator_wallet: creatorWallet,
      fee_shares: body.fee_shares || body.feeShares,
      lifetime_fees: body.lifetime_fees,
      market_cap: body.market_cap,
      volume_24h: body.volume_24h,
    };

    console.log(`[Global Tokens POST] Saving token: ${token.symbol} with ${(token.fee_shares || []).length} fee shares`);
    const success = await saveGlobalToken(token);

    if (!success) {
      console.log(`[Global Tokens POST] Failed to save token: ${token.symbol}`);
      return NextResponse.json(
        { error: "Failed to save token" },
        { status: 500 }
      );
    }

    console.log(`[Global Tokens POST] Successfully saved token: ${token.symbol}`);
    return NextResponse.json({
      success: true,
      message: "Token saved to global database",
      token,
    });
  } catch (error) {
    console.error("[Global Tokens POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to save token", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
