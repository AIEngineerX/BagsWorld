// DEPRECATED: Platform activity is now merged into /api/world-state server-side.
// This route returns empty data for backward compatibility.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    events: [],
    summary: { totalVolume24h: 0, totalFeesClaimed: 0, activeTokenCount: 0 },
    deprecated: true,
    message: "Platform activity is now included in /api/world-state. This endpoint is deprecated.",
  });
}
