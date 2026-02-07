// Oracle Auto-Generate API - Cron endpoint to generate new markets
import { NextRequest, NextResponse } from "next/server";
import { isNeonConfigured, initializeOracleTables } from "@/lib/neon";
import { generateMarkets } from "@/lib/oracle-generator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ORACLE_AUTO_GENERATE_SECRET || process.env.AGENT_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  try {
    const result = await generateMarkets();

    console.log(
      `[Oracle Auto-Generate] Generated ${result.generated.length} market(s), skipped ${result.skipped.length}, errors ${result.errors.length}`
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Oracle Auto-Generate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
