import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import {
  fetchLatestTokenProfiles,
  fetchTopBoostedTokens,
  getTokensByMints,
} from "@/lib/dexscreener-api";
import { getGlobalTokens, isNeonConfigured } from "@/lib/neon";

// BagsWorld token — always included
const BAGSWORLD_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";

interface TopEarnerToken {
  mint: string;
  name: string;
  symbol: string;
  lifetimeFeesSol: number;
}

interface TopEarner {
  name: string;
  provider: string;
  username: string;
  profilePic?: string;
  wallet: string;
  totalLifetimeFeesSol: number;
  tokenCount: number;
  tokens: TopEarnerToken[];
}

// 5-minute response cache
let cachedResponse: {
  success: boolean;
  topEarners: TopEarner[];
  lastUpdated: string;
} | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// Per-mint probe cache (2h)
const probeCache = new Map<string, { isBags: boolean; feesLamports: number; ts: number }>();
const PROBE_TTL = 2 * 60 * 60_000;

// Per-mint creator cache (1h)
const creatorCache = new Map<
  string,
  {
    creators: Array<{
      wallet: string;
      provider: string;
      providerUsername: string;
      username?: string;
      pfp?: string;
      royaltyBps?: number;
      twitterUsername?: string;
      bagsUsername?: string;
    }>;
    ts: number;
  }
>();
const CREATOR_TTL = 60 * 60_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const noCache = searchParams.has("nocache");

  if (!noCache && cachedResponse && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedResponse);
  }

  const BAGS_API_KEY = process.env.BAGS_API_KEY;
  if (!BAGS_API_KEY) {
    return NextResponse.json(
      { success: false, error: "BAGS_API_KEY not configured" },
      { status: 503 }
    );
  }

  const api = initBagsApi(BAGS_API_KEY);
  const now = Date.now();

  // earnerKey → earner data (shared across both pipelines)
  const earnerMap = new Map<
    string,
    {
      name: string;
      provider: string;
      username: string;
      profilePic?: string;
      wallet: string;
      tokens: TopEarnerToken[];
    }
  >();

  // Track which mints we've already processed to avoid double-counting
  const processedMints = new Set<string>();

  try {
    // ====================================================
    // Pipeline A: BagsWorld DB tokens (known fee_shares)
    // Fast path — uses DB fee_shares directly, no creator API needed
    // ====================================================
    const dbTokenMap = new Map<string, { name: string; symbol: string }>();

    if (isNeonConfigured()) {
      const globalTokens = await getGlobalTokens();

      // Filter to tokens with Moltbook fee shares
      const moltbookDbTokens = globalTokens.filter(
        (t) =>
          t.mint !== "TEST123" &&
          t.fee_shares?.some((fs) => fs.provider === "moltbook" && fs.bps > 0)
      );

      // Populate dbTokenMap for all DB tokens (used by Pipeline B for names)
      for (const t of globalTokens) {
        dbTokenMap.set(t.mint, { name: t.name, symbol: t.symbol });
      }

      if (moltbookDbTokens.length > 0) {
        // Fetch lifetime fees for DB tokens
        const dbFeeResults = await Promise.allSettled(
          moltbookDbTokens.map((t) => api.getTokenLifetimeFees(t.mint))
        );

        for (let i = 0; i < moltbookDbTokens.length; i++) {
          const token = moltbookDbTokens[i];
          const feeResult = dbFeeResults[i];
          const feesLamports = feeResult.status === "fulfilled" ? feeResult.value : 0;

          processedMints.add(token.mint);
          if (feesLamports === 0) continue;

          // Cache the fee probe
          probeCache.set(token.mint, { isBags: true, feesLamports, ts: now });

          for (const share of token.fee_shares || []) {
            if (share.provider !== "moltbook" || share.bps <= 0) continue;

            const royaltyShare = share.bps / 10000;
            const earnerToken: TopEarnerToken = {
              mint: token.mint,
              name: token.name,
              symbol: token.symbol,
              lifetimeFeesSol: (feesLamports * royaltyShare) / 1_000_000_000,
            };

            const key = `moltbook:${share.username}`;
            const existing = earnerMap.get(key);
            if (existing) {
              existing.tokens.push(earnerToken);
            } else {
              earnerMap.set(key, {
                name: share.username,
                provider: "moltbook",
                username: share.username,
                wallet: token.creator_wallet,
                tokens: [earnerToken],
              });
            }
          }
        }

        console.log(
          `[top-earners] Pipeline A: ${moltbookDbTokens.length} DB tokens → ${earnerMap.size} Moltbook earners`
        );
      }
    }

    // ====================================================
    // Pipeline B: Global discovery via DexScreener + Bags API
    // Discovers Moltbook agents outside BagsWorld
    // ====================================================
    const mintSet = new Set<string>();
    mintSet.add(BAGSWORLD_MINT);

    // Source: DexScreener trending Solana tokens
    const [profiles, boosted] = await Promise.all([
      fetchLatestTokenProfiles().catch(() => []),
      fetchTopBoostedTokens().catch(() => []),
    ]);
    for (const p of profiles) {
      if (p.chainId === "solana" && !processedMints.has(p.tokenAddress)) {
        mintSet.add(p.tokenAddress);
      }
    }
    for (const b of boosted) {
      if (b.chainId === "solana" && !processedMints.has(b.tokenAddress)) {
        mintSet.add(b.tokenAddress);
      }
    }

    // Remove already-processed mints
    for (const mint of processedMints) {
      mintSet.delete(mint);
    }

    const mintsToProbe = Array.from(mintSet).slice(0, 60);

    if (mintsToProbe.length > 0) {
      // Probe for Bags.fm tokens with fees
      const bagsMints = new Map<string, number>();
      const uncachedMints: string[] = [];

      for (const mint of mintsToProbe) {
        const cached = probeCache.get(mint);
        if (cached && now - cached.ts < PROBE_TTL) {
          if (cached.isBags && cached.feesLamports > 0) {
            bagsMints.set(mint, cached.feesLamports);
          }
        } else {
          uncachedMints.push(mint);
        }
      }

      if (uncachedMints.length > 0) {
        const probeResults = await Promise.allSettled(
          uncachedMints.map((m) => api.getTokenLifetimeFees(m))
        );

        for (let i = 0; i < uncachedMints.length; i++) {
          const mint = uncachedMints[i];
          const result = probeResults[i];
          if (result.status === "fulfilled") {
            probeCache.set(mint, { isBags: true, feesLamports: result.value, ts: now });
            if (result.value > 0) bagsMints.set(mint, result.value);
          } else {
            probeCache.set(mint, { isBags: false, feesLamports: 0, ts: now });
          }
        }
      }

      console.log(
        `[top-earners] Pipeline B: Probed ${mintsToProbe.length} mints → ${bagsMints.size} Bags tokens with fees`
      );

      if (bagsMints.size > 0) {
        // Sort by fees, take top 20 for creator lookup
        const sortedMints = Array.from(bagsMints.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([mint]) => mint);

        // Resolve token names for unknown mints
        const unknownMints = sortedMints.filter((m) => !dbTokenMap.has(m));
        if (unknownMints.length > 0) {
          const dexPairs = await getTokensByMints(unknownMints).catch(() => []);
          for (const pair of dexPairs) {
            if (pair.baseToken && !dbTokenMap.has(pair.baseToken.address)) {
              dbTokenMap.set(pair.baseToken.address, {
                name: pair.baseToken.name,
                symbol: pair.baseToken.symbol,
              });
            }
          }
        }

        // Fetch creators for discovered tokens
        const creatorFetches = sortedMints.map(async (mint) => {
          const cached = creatorCache.get(mint);
          if (cached && now - cached.ts < CREATOR_TTL) {
            return { mint, creators: cached.creators };
          }

          const raw = await fetch(
            `https://public-api-v2.bags.fm/api/v1/token-launch/creator/v3?tokenMint=${mint}`,
            { headers: { "x-api-key": BAGS_API_KEY } }
          );
          const data = await raw.json();

          if (!data.success) {
            creatorCache.set(mint, { creators: [], ts: now });
            return { mint, creators: [] };
          }

          // Handle both response formats:
          // Format A: { success, response: [...] }
          // Format B: { success, name, symbol, creators: [...] }
          const creatorsArray = Array.isArray(data.response)
            ? data.response
            : Array.isArray(data.creators)
              ? data.creators
              : [];

          const creators = creatorsArray as Array<{
            wallet: string;
            provider: string;
            providerUsername: string;
            username?: string;
            pfp?: string;
            royaltyBps?: number;
            twitterUsername?: string;
            bagsUsername?: string;
          }>;

          creatorCache.set(mint, { creators, ts: now });
          return { mint, creators };
        });

        const creatorResults = await Promise.allSettled(creatorFetches);

        for (const result of creatorResults) {
          if (result.status !== "fulfilled") continue;
          const { mint, creators } = result.value;

          // If royaltyBps is missing, assume equal split
          const creatorsWithRoyalties = creators.filter(
            (c) => c.royaltyBps === undefined || c.royaltyBps > 0
          );
          const defaultShare =
            creatorsWithRoyalties.length > 0 ? 1 / creatorsWithRoyalties.length : 1;

          for (const creator of creatorsWithRoyalties) {
            if (creator.provider !== "moltbook") continue;

            const feesLamports = bagsMints.get(mint) ?? 0;
            const royaltyShare =
              creator.royaltyBps !== undefined ? creator.royaltyBps / 10000 : defaultShare;
            const creatorFeesLamports = feesLamports * royaltyShare;
            const dbToken = dbTokenMap.get(mint);
            const token: TopEarnerToken = {
              mint,
              name: dbToken?.name || "Unknown",
              symbol: dbToken?.symbol || "???",
              lifetimeFeesSol: creatorFeesLamports / 1_000_000_000,
            };

            const displayName =
              creator.twitterUsername ||
              creator.bagsUsername ||
              creator.providerUsername ||
              creator.username ||
              `${creator.wallet.slice(0, 4)}...${creator.wallet.slice(-4)}`;

            const key = `moltbook:${creator.providerUsername || creator.username || creator.wallet}`;
            const existing = earnerMap.get(key);
            if (existing) {
              // Only add if we haven't already processed this mint for this earner
              if (!existing.tokens.some((t) => t.mint === mint)) {
                existing.tokens.push(token);
              }
            } else {
              earnerMap.set(key, {
                name: displayName,
                provider: creator.provider,
                username:
                  creator.providerUsername ||
                  creator.username ||
                  `${creator.wallet.slice(0, 4)}...${creator.wallet.slice(-4)}`,
                profilePic: creator.pfp,
                wallet: creator.wallet,
                tokens: [token],
              });
            }
          }
        }
      }
    }

    // ====================================================
    // Build final sorted earner list
    // ====================================================
    const earners: TopEarner[] = [];

    for (const [, data] of earnerMap) {
      const tokens = data.tokens
        .filter((t) => t.lifetimeFeesSol > 0)
        .sort((a, b) => b.lifetimeFeesSol - a.lifetimeFeesSol);

      const totalLifetimeFeesSol = tokens.reduce((sum, t) => sum + t.lifetimeFeesSol, 0);
      if (totalLifetimeFeesSol === 0) continue;

      earners.push({
        name: data.name,
        provider: data.provider,
        username: data.username,
        profilePic: data.profilePic,
        wallet: data.wallet,
        totalLifetimeFeesSol,
        tokenCount: tokens.length,
        tokens,
      });
    }

    earners.sort((a, b) => b.totalLifetimeFeesSol - a.totalLifetimeFeesSol);

    console.log(
      `[top-earners] Total: ${earnerMap.size} Moltbook earners → top ${Math.min(3, earners.length)} returned`
    );

    const response = {
      success: true,
      topEarners: earners.slice(0, 3),
      lastUpdated: new Date().toISOString(),
    };

    cachedResponse = response;
    cacheTime = now;
    return NextResponse.json(response);
  } catch (err) {
    console.error("[top-earners] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch top earners",
      },
      { status: 500 }
    );
  }
}
