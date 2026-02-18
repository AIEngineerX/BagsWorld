// Database Status API - Check if Neon is configured and working
import { NextResponse } from "next/server";
import { isNeonConfigured, getGlobalTokens, getNeonConnectionType } from "@/lib/neon";

export async function GET() {
  try {
    const configured = isNeonConfigured();
    const connectionType = getNeonConnectionType();

    // Check all possible env var names
    const envVars = {
      NETLIFY_DATABASE_URL: !!process.env.NETLIFY_DATABASE_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL,
      POSTGRES_URL: !!process.env.POSTGRES_URL,
    };

    const netlifyDbExists = envVars.NETLIFY_DATABASE_URL;
    const directDbExists =
      envVars.DATABASE_URL || envVars.NEON_DATABASE_URL || envVars.POSTGRES_URL;

    const netlifyDbPreview = process.env.NETLIFY_DATABASE_URL
      ? process.env.NETLIFY_DATABASE_URL.substring(0, 50) + "..."
      : "not set";
    const directUrl =
      process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
    const directDbPreview = directUrl ? directUrl.substring(0, 50) + "..." : "not set";

    if (!configured) {
      return NextResponse.json({
        status: "not_configured",
        message:
          "Neon not configured. Set DATABASE_URL env var or enable Neon in Netlify dashboard.",
        tokenCount: 0,
        connectionType,
        debug: {
          envVars,
          directDbPreview,
          hint: "Set DATABASE_URL (or NEON_DATABASE_URL) to your Neon connection string (postgresql://...)",
        },
      });
    }

    // Try to fetch tokens to verify connection works
    const tokens = await getGlobalTokens();

    return NextResponse.json({
      status: "connected",
      message: `Neon database connected via ${connectionType === "netlify" ? "Netlify integration" : "direct DATABASE_URL"}`,
      tokenCount: tokens.length,
      connectionType,
      tokens: tokens.slice(0, 5), // Show first 5 tokens for debugging
      debug: {
        netlifyDbExists,
        directDbExists,
        netlifyDbPreview: connectionType === "netlify" ? netlifyDbPreview : undefined,
        directDbPreview: connectionType === "direct" ? directDbPreview : undefined,
      },
    });
  } catch (error) {
    console.error("Database status check error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to connect to database",
      tokenCount: 0,
      connectionType: getNeonConnectionType(),
      debug: {
        error: error instanceof Error ? error.stack : String(error),
        netlifyDbExists: !!process.env.NETLIFY_DATABASE_URL,
        directDbExists: !!process.env.DATABASE_URL,
      },
    });
  }
}
