// Oracle Live Prices API - Get real-time price changes for active round
import { NextResponse } from "next/server";
import { getActiveOracleRound, isNeonConfigured } from "@/lib/neon";

export const dynamic = "force-dynamic";

interface DexScreenerPair {
  priceUsd?: string;
  liquidity?: { usd?: number };
  baseToken?: { symbol?: string };
}

async function getCurrentPrice(mint: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      // Get most liquid pair
      const sortedPairs = data.pairs.sort(
        (a: DexScreenerPair, b: DexScreenerPair) =>
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );
      const bestPair = sortedPairs[0] as DexScreenerPair;
      return parseFloat(bestPair.priceUsd || "0");
    }

    return null;
  } catch (error) {
    console.error(`[Oracle Prices] Error fetching price for ${mint}:`, error);
    return null;
  }
}

export async function GET() {
  if (!isNeonConfigured()) {
    return NextResponse.json({
      status: "none",
      message: "Oracle not initialized",
    });
  }

  const round = await getActiveOracleRound();

  if (!round || round.status !== "active") {
    return NextResponse.json({
      status: "none",
      message: "No active prediction round",
    });
  }

  // Fetch current prices for all tokens
  const pricePromises = round.tokenOptions.map(async (token) => {
    const currentPrice = await getCurrentPrice(token.mint);
    const startPrice = token.startPrice;

    let priceChange = 0;
    let priceChangePercent = 0;

    if (currentPrice !== null && startPrice > 0) {
      priceChange = currentPrice - startPrice;
      priceChangePercent = ((currentPrice - startPrice) / startPrice) * 100;
    }

    return {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      startPrice,
      currentPrice,
      priceChange,
      priceChangePercent: Math.round(priceChangePercent * 100) / 100,
      imageUrl: token.imageUrl,
    };
  });

  const tokenPrices = await Promise.all(pricePromises);

  // Sort by price change (leader first)
  const sortedPrices = tokenPrices.sort((a, b) => b.priceChangePercent - a.priceChangePercent);

  // Identify current leader
  const leader = sortedPrices[0];

  // Calculate time remaining
  const endTime = new Date(round.endTime);
  const now = new Date();
  const remainingMs = Math.max(0, endTime.getTime() - now.getTime());

  return NextResponse.json({
    roundId: round.id,
    status: round.status,
    remainingMs,
    entryCount: round.entryCount,
    leader: leader
      ? {
          mint: leader.mint,
          symbol: leader.symbol,
          priceChangePercent: leader.priceChangePercent,
        }
      : null,
    tokens: sortedPrices,
    lastUpdated: new Date().toISOString(),
  });
}
