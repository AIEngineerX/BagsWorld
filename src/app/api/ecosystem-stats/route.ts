import { NextResponse } from "next/server";
import { getAutoClaimState } from "@/lib/auto-claim-agent";
import { getBuybackState } from "@/lib/buyback-agent";

/**
 * Public endpoint for buyback statistics
 * No authentication required - this is transparency data
 */
export async function GET() {
  try {
    const claimState = getAutoClaimState();
    const buybackState = getBuybackState();

    return NextResponse.json({
      // Fee collection
      totalClaimed: claimState.totalClaimed,
      claimCount: claimState.claimCount,
      lastClaim: claimState.lastClaim,
      // Buyback & burn
      totalBuybacksSol: buybackState.totalBuybacksSol,
      totalTokensBurned: buybackState.totalTokensBurned,
      buybackCount: buybackState.buybackCount,
      lastBuyback: buybackState.lastBuyback,
      // Recent buybacks
      recentBuybacks: buybackState.lastTokensBought.slice(-5).map((b) => ({
        symbol: b.symbol,
        amountSol: b.amountSol,
        burned: b.burned,
        timestamp: b.timestamp,
      })),
    });
  } catch (error) {
    console.error("Ecosystem stats error:", error);
    return NextResponse.json({
      totalClaimed: 0,
      claimCount: 0,
      totalBuybacksSol: 0,
      totalTokensBurned: 0,
      buybackCount: 0,
      lastBuyback: 0,
      lastClaim: 0,
      recentBuybacks: [],
    });
  }
}
