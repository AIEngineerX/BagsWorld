// Database Status API - Check if Neon is configured and working
import { NextResponse } from "next/server";
import { isNeonConfigured, getGlobalTokens } from "@/lib/neon";

export async function GET() {
  try {
    const configured = isNeonConfigured();
    const dbUrlExists = !!process.env.NETLIFY_DATABASE_URL;
    const dbUrlPreview = process.env.NETLIFY_DATABASE_URL
      ? process.env.NETLIFY_DATABASE_URL.substring(0, 50) + "..."
      : "not set";

    if (!configured) {
      return NextResponse.json({
        status: "not_configured",
        message: "Neon not configured. Enable Neon in Netlify dashboard.",
        tokenCount: 0,
        debug: { dbUrlExists, dbUrlPreview },
      });
    }

    // Try to fetch tokens to verify connection works
    const tokens = await getGlobalTokens();

    return NextResponse.json({
      status: "connected",
      message: "Neon database connected",
      tokenCount: tokens.length,
      tokens: tokens.slice(0, 5), // Show first 5 tokens for debugging
      debug: { dbUrlExists, dbUrlPreview },
    });
  } catch (error) {
    console.error("Database status check error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to connect to database",
      tokenCount: 0,
      debug: {
        error: error instanceof Error ? error.stack : String(error),
        dbUrlExists: !!process.env.NETLIFY_DATABASE_URL,
      },
    });
  }
}
