import { NextResponse } from "next/server";
import { isNeonConfigured } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {
    app: "ok",
    database: isNeonConfigured() ? "configured" : "not_configured",
    bags_api: process.env.BAGS_API_KEY ? "configured" : "not_configured",
    rpc: process.env.SOLANA_RPC_URL ? "configured" : "not_configured",
  };

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    checks,
  });
}
