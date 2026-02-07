import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import {
  fetchLatestTokenProfiles,
  fetchTopBoostedTokens,
  getTokensByMints,
} from "@/lib/dexscreener-api";
import type { DexPair } from "@/lib/dexscreener-api";
import type { GameEvent, ClaimEvent } from "@/lib/types";
import { lamportsToSol, formatSol } from "@/lib/solana-utils";

const BAGS_API_KEY = process.env.BAGS_API_KEY;

// --- Caches ---

// Main response cache (60s — matches client polling interval)
let eventsCache: {
  data: GameEvent[];
  summary: { totalVolume24h: number; totalFeesClaimed: number; activeTokenCount: number };
  timestamp: number;
} | null = null;
const EVENTS_CACHE_TTL = 60_000;

// Per-mint Bags token probe: maps mint → { isBags, feesLamports, timestamp }
// Successful probe = Bags token, failed probe = non-Bags token
const bagsProbeCache = new Map<
  string,
  { isBags: boolean; feesLamports: number; timestamp: number }
>();
const PROBE_CACHE_TTL = 2 * 60 * 60_000; // 2 hours

// Per-mint claim events cache
const claimCache = new Map<string, { events: ClaimEvent[]; timestamp: number }>();
const CLAIM_CACHE_TTL = 3 * 60_000; // 3 min

// --- Formatters ---

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

// --- Event generators ---

// Generate events for a confirmed Bags.fm token (lower thresholds, Bags-specific messaging)
function generateBagsTokenEvents(
  pair: DexPair,
  now: number,
  index: number,
  isBoosted: boolean,
  feesLamports: number
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
  const baseTs = now - index * 10_000;

  // 1. Trending event with Bags.fm branding
  const label = isBoosted ? "boosted on DexScreener" : "active on Bags.fm";
  const parts = [`$${symbol} ${label} — ${fmtMcap(mcap)} mcap`];
  if (vol24h > 0) parts.push(`${fmtVol(vol24h)} vol`);
  parts.push(fmtChange(change24h));

  events.push({
    id: `bags_trending_${mint}`,
    type: "platform_trending",
    message: parts.join(", "),
    timestamp: baseTs,
    data: { tokenName: name, symbol, mint, change: change24h, amount: vol24h, source: "platform" },
  });

  // 2. Price pump/dump — 5%+ 1h move OR 15%+ 24h move (lower thresholds for Bags tokens)
  if (Math.abs(change1h) >= 5) {
    const isPump = change1h > 0;
    const txnCount = txns1h ? (isPump ? txns1h.buys : txns1h.sells) : 0;
    const txnInfo = txnCount > 0 ? ` (${txnCount} ${isPump ? "buys" : "sells"} in 1h)` : "";
    events.push({
      id: `bags_${isPump ? "pump" : "dump"}_1h_${mint}`,
      type: isPump ? "price_pump" : "price_dump",
      message: `$${symbol} ${isPump ? "pumping" : "dumping"} ${fmtChange(change1h)} in 1h${txnInfo}`,
      timestamp: baseTs - 1000,
      data: { tokenName: name, symbol, mint, change: change1h, amount: vol1h, source: "platform" },
    });
  } else if (Math.abs(change24h) >= 15) {
    const isPump = change24h > 0;
    const txnCount = txns24h ? (isPump ? txns24h.buys : txns24h.sells) : 0;
    const txnInfo = txnCount > 0 ? ` (${txnCount} ${isPump ? "buys" : "sells"} today)` : "";
    events.push({
      id: `bags_${isPump ? "pump" : "dump"}_24h_${mint}`,
      type: isPump ? "price_pump" : "price_dump",
      message: `$${symbol} ${isPump ? "up" : "down"} ${fmtChange(change24h)} today${txnInfo}`,
      timestamp: baseTs - 1000,
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

  // 3. Whale alert — 3%+ mcap in 1h volume (lower threshold for Bags tokens)
  if (vol1h > 5_000 && mcap > 0 && vol1h / mcap > 0.03) {
    const totalTxns = txns1h ? txns1h.buys + txns1h.sells : 0;
    const txnInfo = totalTxns > 0 ? ` across ${totalTxns} trades` : "";
    events.push({
      id: `bags_whale_${mint}`,
      type: "whale_alert",
      message: `Heavy volume on $${symbol} — ${fmtVol(vol1h)} in 1h${txnInfo}`,
      timestamp: baseTs - 2000,
      data: { tokenName: name, symbol, mint, change: change24h, amount: vol1h, source: "platform" },
    });
  }

  // 4. High activity alert — 200+ txns in 24h (lower threshold for Bags tokens)
  if (txns24h && txns24h.buys + txns24h.sells > 200) {
    const total = txns24h.buys + txns24h.sells;
    const buyRatio = Math.round((txns24h.buys / total) * 100);
    events.push({
      id: `bags_activity_${mint}`,
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

  // 5. Lifetime fee milestones
  if (feesLamports > 0) {
    const feesSol = lamportsToSol(feesLamports);
    const thresholds = [1000, 500, 100, 50, 10, 5, 1, 0.5, 0.1];
    for (const threshold of thresholds) {
      if (feesSol >= threshold) {
        events.push({
          id: `bags_milestone_${mint}_${threshold}`,
          type: "milestone",
          message: `$${symbol} has earned ${formatSol(feesSol)} in lifetime fees on Bags.fm`,
          timestamp: baseTs - 4000,
          data: {
            tokenName: name,
            symbol,
            mint,
            amount: feesSol,
            source: "platform",
          },
        });
        break; // Only show highest achieved milestone
      }
    }
  }

  return events;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const knownMintsParam = searchParams.get("knownMints") || "";
  const knownMints = new Set(knownMintsParam.split(",").filter(Boolean));

  // Return cached data if fresh
  if (eventsCache && Date.now() - eventsCache.timestamp < EVENTS_CACHE_TTL) {
    const filtered =
      knownMints.size > 0
        ? eventsCache.data.filter((e) => !e.data?.mint || !knownMints.has(e.data.mint))
        : eventsCache.data;
    return NextResponse.json({ events: filtered, summary: eventsCache.summary });
  }

  const events: GameEvent[] = [];
  const now = Date.now();

  // ─── Step 1: DexScreener discovery ───
  // Fetch trending profiles + boosted tokens in parallel (no auth, 300 req/min)
  const [profiles, boosted] = await Promise.all([
    fetchLatestTokenProfiles(),
    fetchTopBoostedTokens(),
  ]);

  const solanaProfiles = profiles.filter((t) => t.chainId === "solana");
  const solanaBoosted = boosted.filter((t) => t.chainId === "solana");

  // Collect unique Solana mints (boosted first for priority)
  const boostedMints = new Set(solanaBoosted.map((t) => t.tokenAddress));
  const allMints = new Set<string>();
  solanaBoosted.forEach((t) => allMints.add(t.tokenAddress));
  solanaProfiles.slice(0, 20).forEach((t) => allMints.add(t.tokenAddress));

  // Exclude known BagsWorld-registered mints (handled by world-state route)
  const mintsToProcess = Array.from(allMints).filter((m) => !knownMints.has(m));

  // ─── Step 2: Probe mints against Bags API ───
  // getTokenLifetimeFees returns lamports for Bags tokens, throws "Invalid mint" for non-Bags
  let api: ReturnType<typeof initBagsApi> | null = null;
  const bagsMints = new Map<string, number>(); // mint → feesLamports
  const nonBagsMints: string[] = [];

  if (BAGS_API_KEY) {
    api = initBagsApi(BAGS_API_KEY);

    // Separate cached from uncached
    const uncachedMints: string[] = [];
    for (const mint of mintsToProcess) {
      const cached = bagsProbeCache.get(mint);
      if (cached && now - cached.timestamp < PROBE_CACHE_TTL) {
        if (cached.isBags) {
          bagsMints.set(mint, cached.feesLamports);
        } else {
          nonBagsMints.push(mint);
        }
      } else {
        uncachedMints.push(mint);
      }
    }

    // Probe uncached mints in parallel via getTokenLifetimeFees
    // Success = Bags token (stores lamports), failure = non-Bags token ("Invalid mint")
    if (uncachedMints.length > 0) {
      const probeResults = await Promise.allSettled(
        uncachedMints.map((mint) => api!.getTokenLifetimeFees(mint))
      );

      for (let i = 0; i < uncachedMints.length; i++) {
        const mint = uncachedMints[i];
        const result = probeResults[i];
        if (result.status === "fulfilled") {
          bagsProbeCache.set(mint, { isBags: true, feesLamports: result.value, timestamp: now });
          bagsMints.set(mint, result.value);
        } else {
          bagsProbeCache.set(mint, { isBags: false, feesLamports: 0, timestamp: now });
          nonBagsMints.push(mint);
        }
      }

      console.log(
        `[platform-activity] Probed ${uncachedMints.length} tokens: ${bagsMints.size} Bags.fm, ${nonBagsMints.length} non-Bags`
      );
    }
  } else {
    // No API key — all tokens are treated as non-Bags
    nonBagsMints.push(...mintsToProcess);
    console.warn("[platform-activity] BAGS_API_KEY not set — showing DexScreener data only");
  }

  // ─── Step 3: Get DexScreener pair data for Bags.fm tokens ───
  const allMintsToFetch = Array.from(bagsMints.keys()).slice(0, 30);
  const pairs = allMintsToFetch.length > 0 ? await getTokensByMints(allMintsToFetch) : [];

  const pairMap: Record<string, DexPair> = {};
  for (const p of pairs) {
    if (p?.baseToken?.address && (parseFloat(p.priceUsd) > 0 || p.volume?.h24 > 0)) {
      pairMap[p.baseToken.address] = p;
    }
  }

  // ─── Step 4: Generate events from Bags tokens (PRIMARY) ───
  const bagsMintsList = Array.from(bagsMints.keys());

  // Sort: boosted first, then by 24h volume
  bagsMintsList.sort((a, b) => {
    const aBoost = boostedMints.has(a) ? 1 : 0;
    const bBoost = boostedMints.has(b) ? 1 : 0;
    if (aBoost !== bBoost) return bBoost - aBoost;
    return (pairMap[b]?.volume?.h24 ?? 0) - (pairMap[a]?.volume?.h24 ?? 0);
  });

  for (let i = 0; i < bagsMintsList.length; i++) {
    const mint = bagsMintsList[i];
    const pair = pairMap[mint];
    if (!pair) continue;
    const feesLamports = bagsMints.get(mint) ?? 0;
    events.push(...generateBagsTokenEvents(pair, now, i, boostedMints.has(mint), feesLamports));
  }

  // ─── Step 5: Fetch claim events for top Bags tokens ───
  if (api && bagsMintsList.length > 0) {
    const topMints = bagsMintsList.slice(0, 10);

    // Separate cached from uncached
    const uncachedClaimMints: string[] = [];
    for (const mint of topMints) {
      const cached = claimCache.get(mint);
      if (cached && now - cached.timestamp < CLAIM_CACHE_TTL) {
        for (const claim of cached.events) {
          const pair = pairMap[mint];
          const displayName = claim.claimer?.slice(0, 8) || "Unknown";
          const claimSol = lamportsToSol(claim.amount);
          events.push({
            id: `bags_claim_${claim.signature}`,
            type: "fee_claim",
            message: `${displayName} claimed ${formatSol(claimSol)} from $${pair?.baseToken?.symbol ?? "token"} on Bags.fm`,
            timestamp: claim.timestamp * 1000,
            data: {
              username: displayName,
              tokenName: pair?.baseToken?.name,
              symbol: pair?.baseToken?.symbol,
              mint,
              amount: claimSol,
              source: "platform",
            },
          });
        }
      } else {
        uncachedClaimMints.push(mint);
      }
    }

    // Fetch uncached claim events in parallel
    if (uncachedClaimMints.length > 0) {
      const claimResults = await Promise.allSettled(
        uncachedClaimMints.map((mint) => api!.getTokenClaimEvents(mint, 5))
      );

      for (let i = 0; i < uncachedClaimMints.length; i++) {
        const mint = uncachedClaimMints[i];
        const result = claimResults[i];
        if (result.status === "fulfilled") {
          const claimEvents = result.value;
          claimCache.set(mint, { events: claimEvents, timestamp: now });

          for (const claim of claimEvents) {
            const pair = pairMap[mint];
            const displayName = claim.claimer?.slice(0, 8) || "Unknown";
            const claimSol = lamportsToSol(claim.amount);
            events.push({
              id: `bags_claim_${claim.signature}`,
              type: "fee_claim",
              message: `${displayName} claimed ${formatSol(claimSol)} from $${pair?.baseToken?.symbol ?? "token"} on Bags.fm`,
              timestamp: claim.timestamp * 1000,
              data: {
                username: displayName,
                tokenName: pair?.baseToken?.name,
                symbol: pair?.baseToken?.symbol,
                mint,
                amount: claimSol,
                source: "platform",
              },
            });
          }
        } else {
          console.error(
            `[platform-activity] Claim events failed for ${mint}:`,
            result.reason instanceof Error ? result.reason.message : result.reason
          );
        }
      }
    }
  }

  // ─── Step 6: Compute Bags.fm summary stats ───
  let platformVolume24h = 0;
  let platformFeesClaimed = 0;
  for (const mint of bagsMintsList) {
    const pair = pairMap[mint];
    if (pair) platformVolume24h += pair.volume?.h24 ?? 0;
    const feesLamports = bagsMints.get(mint) ?? 0;
    if (feesLamports > 0) platformFeesClaimed += lamportsToSol(feesLamports);
  }

  const summary = {
    totalVolume24h: platformVolume24h,
    totalFeesClaimed: platformFeesClaimed,
    activeTokenCount: bagsMintsList.filter((m) => pairMap[m]).length,
  };

  // ─── Step 7: Sort and cache ───
  events.sort((a, b) => b.timestamp - a.timestamp);

  console.log(
    `[platform-activity] DexScreener: ${solanaProfiles.length} profiles, ${solanaBoosted.length} boosted → ${bagsMints.size} Bags.fm tokens → ${events.length} events, summary: ${summary.activeTokenCount} tokens, ${fmtVol(summary.totalVolume24h)} vol`
  );

  eventsCache = { data: events, summary, timestamp: now };

  // Filter out known BagsWorld mints before returning
  const filtered =
    knownMints.size > 0
      ? events.filter((e) => !e.data?.mint || !knownMints.has(e.data.mint))
      : events;

  return NextResponse.json({ events: filtered, summary });
}
