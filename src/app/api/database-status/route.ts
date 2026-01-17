// Database Status API - Check if Supabase is configured and working
import { NextResponse } from "next/server";
import { isSupabaseConfigured, getGlobalTokens } from "@/lib/supabase";

export async function GET() {
  try {
    const configured = isSupabaseConfigured();

    if (!configured) {
      return NextResponse.json({
        status: "not_configured",
        message: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY",
        tokenCount: 0,
      });
    }

    // Try to fetch tokens to verify connection works
    const tokens = await getGlobalTokens();

    return NextResponse.json({
      status: "connected",
      message: "Global database connected",
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
