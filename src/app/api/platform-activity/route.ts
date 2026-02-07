import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import { getTokensByMints } from "@/lib/dexscreener-api";
import type { GameEvent } from "@/lib/types";

const BAGS_API_KEY = process.env.BAGS_API_KEY;

// Server-side cache
let cachedResponse: { data: GameEvent[]; timestamp: number } | null = null;
const CACHE_DURATION = 90_000; // 90 seconds

export async function GET(request: Request) {
  // Parse known BagsWorld mints from query param for dedup
  const { searchParams } = new URL(request.url);
  const knownMintsParam = searchParams.get("knownMints") || "";
  const knownMints = new Set(knownMintsParam.split(",").filter(Boolean));

  // Return cached data if fresh
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_DURATION) {
    // Still filter against knownMints (may change between requests)
    const filtered =
      knownMints.size > 0
        ? cachedResponse.data.filter((e) => !e.data?.mint || !knownMints.has(e.data.mint))
        : cachedResponse.data;
    return NextResponse.json({ events: filtered });
  }

  if (!BAGS_API_KEY) {
    return NextResponse.json({ events: [] });
  }

  const api = initBagsApi(BAGS_API_KEY);
  const events: GameEvent[] = [];
  const now = Date.now();

  try {
    // Fetch trending tokens and fee leaderboard in parallel
    const [trendingTokens, feeEarners] = await Promise.allSettled([
      api.getTrendingTokens(10),
      api.getFeeLeaderboard(10),
    ]);

    // Process trending tokens
    const trending = trendingTokens.status === "fulfilled" ? trendingTokens.value : [];

    // Collect mints for DexScreener enrichment (only non-BagsWorld tokens)
    const platformMints = trending.map((t) => t.mint).filter((mint) => !knownMints.has(mint));

    // Enrich with DexScreener price data
    let priceMap: Record<
      string,
      { price: number; marketCap: number; volume24h: number; change24h: number }
    > = {};
    if (platformMints.length > 0) {
      try {
        const pairs = await getTokensByMints(platformMints.slice(0, 30));
        for (const pair of pairs) {
          if (pair?.baseToken?.address) {
            priceMap[pair.baseToken.address] = {
              price: parseFloat(pair.priceUsd) || 0,
              marketCap: pair.marketCap || pair.fdv || 0,
              volume24h: pair.volume?.h24 || 0,
              change24h: pair.priceChange?.h24 || 0,
            };
          }
        }
      } catch {
        // DexScreener enrichment is best-effort
      }
    }

    // Convert trending tokens to events
    for (const token of trending) {
      const dex = priceMap[token.mint];
      const mcap = dex?.marketCap ?? token.marketCap ?? 0;
      const change = dex?.change24h ?? token.change24h ?? 0;
      const vol = dex?.volume24h ?? token.volume24h ?? 0;

      const mcapStr =
        mcap >= 1_000_000
          ? `$${(mcap / 1_000_000).toFixed(1)}M`
          : mcap >= 1_000
            ? `$${(mcap / 1_000).toFixed(0)}K`
            : `$${mcap.toFixed(0)}`;

      const changeStr = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;

      events.push({
        id: `platform_trending_${token.mint}`,
        type: "platform_trending",
        message: `$${token.symbol} trending on Bags.fm — ${mcapStr} mcap, ${changeStr}`,
        timestamp: now - Math.floor(Math.random() * 300_000), // Stagger within last 5 min
        data: {
          tokenName: token.name,
          symbol: token.symbol,
          mint: token.mint,
          change,
          amount: vol,
          source: "platform",
        },
      });

      // Also emit as a platform_launch if it was recently created
      if (token.createdAt && now - token.createdAt < 24 * 60 * 60 * 1000) {
        events.push({
          id: `platform_launch_${token.mint}`,
          type: "platform_launch",
          message: `New on Bags.fm: $${token.symbol} (${token.name}) launched`,
          timestamp: token.createdAt,
          data: {
            tokenName: token.name,
            symbol: token.symbol,
            mint: token.mint,
            source: "platform",
          },
        });
      }
    }

    // Process fee earners into events
    const earners = feeEarners.status === "fulfilled" ? feeEarners.value : [];

    for (const earner of earners) {
      if (earner.earnings24h && earner.earnings24h > 0) {
        const name = earner.username || earner.wallet.slice(0, 6) + "...";
        events.push({
          id: `platform_claim_${earner.wallet}`,
          type: "fee_claim",
          message: `${name} earned ${earner.earnings24h.toFixed(2)} SOL in fees today`,
          timestamp: now - Math.floor(Math.random() * 600_000), // Stagger within last 10 min
          data: {
            username: earner.username,
            amount: earner.earnings24h,
            source: "platform",
          },
        });
      }
    }
  } catch (error) {
    console.error("[platform-activity] Error fetching platform data:", error);
  }

  // Sort by timestamp descending
  events.sort((a, b) => b.timestamp - a.timestamp);

  // Cache the full unfiltered events
  cachedResponse = { data: events, timestamp: now };

  // Filter out known BagsWorld tokens before returning
  const filtered =
    knownMints.size > 0
      ? events.filter((e) => !e.data?.mint || !knownMints.has(e.data.mint))
      : events;

  return NextResponse.json({ events: filtered });
}
