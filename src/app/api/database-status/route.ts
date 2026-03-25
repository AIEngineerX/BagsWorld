import { NextResponse } from "next/server";
import { isNeonConfigured, getGlobalTokens } from "@/lib/neon";

export async function GET() {
  if (!isNeonConfigured()) {
    return NextResponse.json({
      status: "not_configured",
      message: "No database configured (local mode)",
      tokenCount: 0,
    });
  }

  try {
    const tokens = await getGlobalTokens();
    return NextResponse.json({
      status: "connected",
      message: "Neon PostgreSQL connected",
      tokenCount: tokens.length,
    });
  } catch (err) {
    console.warn("[DatabaseStatus] Connection failed:", err);
    return NextResponse.json({
      status: "error",
      message: "Database connection failed",
      tokenCount: 0,
    });
  }
}
