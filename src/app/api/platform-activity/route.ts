import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import {
  fetchLatestTokenProfiles,
  fetchTopBoostedTokens,
  getTokensByMints,
} from "@/lib/dexscreener-api";
import type { DexPair } from "@/lib/dexscreener-api";
import type { GameEvent } from "@/lib/types";

const BAGS_API_KEY = process.env.BAGS_API_KEY;

// Server-side cache
let cachedResponse: { data: GameEvent[]; timestamp: number } | null = null;
const CACHE_DURATION = 60_000; // 60 seconds

// Helpers
function fmtMcap(mcap: number): string {
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(1)}M`;
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(0)}K`;
  return `$${mcap.toFixed(0)}`;
}

function fmtChange(change: number): string {
  return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
}

function fmtVol(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

// Generate rich events from a DexScreener pair
function generateEventsFromPair(
  pair: DexPair,
  now: number,
  index: number,
  isBoosted: boolean
): GameEvent[] {
  const events: GameEvent[] = [];
  const symbol = pair.baseToken.symbol;
  const name = pair.baseToken.name;
  const mint = pair.baseToken.address;
  const mcap = pair.marketCap || pair.fdv || 0;
  const change24h = pair.priceChange?.h24 ?? 0;
  const change1h = pair.priceChange?.h1 ?? 0;
  const vol24h = pair.volume?.h24 ?? 0;
  const vol1h = pair.volume?.h1 ?? 0;
  const txns24h = pair.txns?.h24;
  const txns1h = pair.txns?.h1;
  const baseTs = now - index * 10_000; // Stagger evenly

  // 1. Trending/boosted event
  const label = isBoosted ? "boosted on DexScreener" : "trending on Solana";
  const parts = [`$${symbol} ${label} — ${fmtMcap(mcap)} mcap`];
  if (vol24h > 0) parts.push(`${fmtVol(vol24h)} vol`);
  parts.push(fmtChange(change24h));

  events.push({
    id: `platform_trending_${mint}`,
    type: "platform_trending",
    message: parts.join(", "),
    timestamp: baseTs,
    data: {
      tokenName: name,
      symbol,
      mint,
      change: change24h,
      amount: vol24h,
      source: "platform",
    },
  });

  // 2. Price pump/dump for significant 1h moves (>=10%)
  if (Math.abs(change1h) >= 10) {
    const isPump = change1h > 0;
    const txnCount = txns1h ? (isPump ? txns1h.buys : txns1h.sells) : 0;
    const txnInfo = txnCount > 0 ? ` (${txnCount} ${isPump ? "buys" : "sells"} in 1h)` : "";
    events.push({
      id: `platform_${isPump ? "pump" : "dump"}_1h_${mint}`,
      type: isPump ? "price_pump" : "price_dump",
      message: `$${symbol} ${isPump ? "pumping" : "dumping"} ${fmtChange(change1h)} in 1h${txnInfo}`,
      timestamp: baseTs - 1000,
      data: { tokenName: name, symbol, mint, change: change1h, amount: vol1h, source: "platform" },
    });
  }

  // 3. Whale alert for high 1h volume relative to mcap (>5%)
  if (vol1h > 10_000 && mcap > 0 && vol1h / mcap > 0.05) {
    const totalTxns = txns1h ? txns1h.buys + txns1h.sells : 0;
    const txnInfo = totalTxns > 0 ? ` across ${totalTxns} trades` : "";
    events.push({
      id: `platform_whale_${mint}`,
      type: "whale_alert",
      message: `Heavy volume on $${symbol} — ${fmtVol(vol1h)} in 1h${txnInfo}`,
      timestamp: baseTs - 2000,
      data: { tokenName: name, symbol, mint, change: change24h, amount: vol1h, source: "platform" },
    });
  }

  // 4. High activity alert (500+ txns in 24h)
  if (txns24h && txns24h.buys + txns24h.sells > 500) {
    const total = txns24h.buys + txns24h.sells;
    const buyRatio = Math.round((txns24h.buys / total) * 100);
    events.push({
      id: `platform_activity_${mint}`,
      type: "platform_trending",
      message: `$${symbol} hot — ${total} trades today (${buyRatio}% buys), ${fmtVol(vol24h)} volume`,
      timestamp: baseTs - 3000,
      data: {
        tokenName: name,
        symbol,
        mint,
        change: change24h,
        amount: vol24h,
        source: "platform",
      },
    });
  }

  return events;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const knownMintsParam = searchParams.get("knownMints") || "";
  const knownMints = new Set(knownMintsParam.split(",").filter(Boolean));

  // Return cached data if fresh
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_DURATION) {
    const filtered =
      knownMints.size > 0
        ? cachedResponse.data.filter((e) => !e.data?.mint || !knownMints.has(e.data.mint))
        : cachedResponse.data;
    return NextResponse.json({ events: filtered });
  }

  const events: GameEvent[] = [];
  const now = Date.now();

  try {
    // DexScreener is the primary data source (no auth needed, 300 req/min)
    // Fetch latest profiles + boosted tokens in parallel
    const [profiles, boosted] = await Promise.all([
      fetchLatestTokenProfiles(),
      fetchTopBoostedTokens(),
    ]);

    // Filter for Solana tokens only
    const solanaProfiles = profiles.filter((t) => t.chainId === "solana");
    const solanaBoosted = boosted.filter((t) => t.chainId === "solana");

    // Collect unique Solana mints (boosted first for priority)
    const boostedMints = new Set(solanaBoosted.map((t) => t.tokenAddress));
    const allMints = new Set<string>();
    solanaBoosted.forEach((t) => allMints.add(t.tokenAddress));
    solanaProfiles.slice(0, 20).forEach((t) => allMints.add(t.tokenAddress));

    // Filter out known BagsWorld mints and limit to 30 for DexScreener batch
    const mintsToFetch = Array.from(allMints)
      .filter((m) => !knownMints.has(m))
      .slice(0, 30);

    if (mintsToFetch.length > 0) {
      // Get full pair data from DexScreener
      const pairs = await getTokensByMints(mintsToFetch);

      // Filter for valid pairs with real data
      const validPairs = pairs.filter(
        (p) => p?.baseToken?.address && (parseFloat(p.priceUsd) > 0 || p.volume?.h24 > 0)
      );

      // Sort: boosted first, then by volume
      validPairs.sort((a, b) => {
        const aIsBoosted = boostedMints.has(a.baseToken.address) ? 1 : 0;
        const bIsBoosted = boostedMints.has(b.baseToken.address) ? 1 : 0;
        if (aIsBoosted !== bIsBoosted) return bIsBoosted - aIsBoosted;
        return (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0);
      });

      // Generate events from each pair
      validPairs.forEach((pair, i) => {
        const isBoosted = boostedMints.has(pair.baseToken.address);
        events.push(...generateEventsFromPair(pair, now, i, isBoosted));
      });
    }

    console.log(
      `[platform-activity] DexScreener: ${solanaProfiles.length} profiles, ${solanaBoosted.length} boosted, ${mintsToFetch.length} fetched → ${events.length} events`
    );
  } catch (error) {
    console.error("[platform-activity] DexScreener error:", error);
  }

  // Bags API as supplementary source (best-effort, endpoints may not exist)
  if (BAGS_API_KEY) {
    try {
      const api = initBagsApi(BAGS_API_KEY);
      const [trendingResult, earnersResult] = await Promise.allSettled([
        api.getTrendingTokens(25),
        api.getFeeLeaderboard(15),
      ]);

      // Process Bags trending tokens (if endpoint exists)
      const trending = trendingResult.status === "fulfilled" ? trendingResult.value : [];
      if (trending.length > 0) {
        // Get DexScreener data for Bags tokens not already covered
        const existingMints = new Set(events.map((e) => e.data?.mint).filter(Boolean));
        const newBagsMints = trending
          .map((t) => t.mint)
          .filter((m) => !existingMints.has(m) && !knownMints.has(m));

        if (newBagsMints.length > 0) {
          try {
            const pairs = await getTokensByMints(newBagsMints.slice(0, 30));
            const pairMap: Record<string, DexPair> = {};
            for (const p of pairs) {
              if (p?.baseToken?.address) pairMap[p.baseToken.address] = p;
            }
            trending.forEach((token, i) => {
              const pair = pairMap[token.mint];
              if (pair) {
                events.push(...generateEventsFromPair(pair, now, events.length + i, false));
              }
            });
          } catch {
            // Best-effort enrichment
          }
        }
      }

      // Process Bags fee earners (if endpoint exists)
      const earners = earnersResult.status === "fulfilled" ? earnersResult.value : [];
      earners.forEach((earner, i) => {
        if (earner.earnings24h && earner.earnings24h > 0) {
          const name = earner.username || earner.wallet.slice(0, 6) + "...";
          events.push({
            id: `platform_claim_${earner.wallet}`,
            type: "fee_claim",
            message: `${name} earned ${earner.earnings24h.toFixed(2)} SOL in fees today`,
            timestamp: now - i * 20_000,
            data: { username: earner.username, amount: earner.earnings24h, source: "platform" },
          });
        }
        if (earner.lifetimeEarnings > 100) {
          const name = earner.username || earner.wallet.slice(0, 6) + "...";
          events.push({
            id: `platform_topearner_${earner.wallet}`,
            type: "milestone",
            message: `${name} — ${earner.lifetimeEarnings.toFixed(0)} SOL lifetime fees${earner.tokenCount ? ` across ${earner.tokenCount} tokens` : ""}`,
            timestamp: now - i * 20_000 - 5000,
            data: {
              username: earner.username,
              amount: earner.lifetimeEarnings,
              source: "platform",
            },
          });
        }
      });
    } catch {
      // Bags API is supplementary — DexScreener data is sufficient
    }
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
