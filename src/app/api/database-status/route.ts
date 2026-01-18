// Database Status API - Check if Neon is configured and working
import { NextResponse } from "next/server";
import { isNeonConfigured, getGlobalTokens } from "@/lib/neon";

export async function GET() {
  try {
    const configured = isNeonConfigured();

    if (!configured) {
      return NextResponse.json({
        status: "not_configured",
        message: "Neon not configured. Enable Neon in Netlify dashboard.",
        tokenCount: 0,
      });
    }

    // Try to fetch tokens to verify connection works
    const tokens = await getGlobalTokens();

    return NextResponse.json({
      status: "connected",
      message: "Neon database connected",
      tokenCount: tokens.length,
    });
  } catch (error) {
    console.error("Database status check error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to connect to database",
      tokenCount: 0,
    });
  }
}
