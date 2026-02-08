// Oracle Auto-Resolve API - Cron endpoint to resolve expired markets
// Now delegates to shared lazyResolveExpiredMarkets() function
import { NextRequest, NextResponse } from "next/server";
import { isNeonConfigured, initializeOracleTables } from "@/lib/neon";
import { lazyResolveExpiredMarkets } from "@/lib/oracle-resolver";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ORACLE_AUTO_RESOLVE_SECRET || process.env.AGENT_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  const { resolvedCount, errors } = await lazyResolveExpiredMarkets();

  return NextResponse.json({
    success: true,
    resolved: resolvedCount,
    total: resolvedCount + errors.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
