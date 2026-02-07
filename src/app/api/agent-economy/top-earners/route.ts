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

  try {
    // Step 1: Gather token mints from multiple sources
    const mintSet = new Set<string>();

    // Always include BagsWorld
    mintSet.add(BAGSWORLD_MINT);

    // Source A: Neon DB — all tokens launched through BagsWorld (guaranteed Bags.fm tokens)
    const dbTokenMap = new Map<string, { name: string; symbol: string }>();
    if (isNeonConfigured()) {
      const globalTokens = await getGlobalTokens();
      for (const t of globalTokens) {
        mintSet.add(t.mint);
        dbTokenMap.set(t.mint, { name: t.name, symbol: t.symbol });
      }
    }

    // Source B: DexScreener trending Solana tokens
    const [profiles, boosted] = await Promise.all([
      fetchLatestTokenProfiles(),
      fetchTopBoostedTokens(),
    ]);
    for (const p of profiles) {
      if (p.chainId === "solana") mintSet.add(p.tokenAddress);
    }
    for (const b of boosted) {
      if (b.chainId === "solana") mintSet.add(b.tokenAddress);
    }

    const mintsToProbe = Array.from(mintSet).slice(0, 80);

    console.log(
      `[top-earners] Sources: ${dbTokenMap.size} DB tokens, ${profiles.length} profiles, ${boosted.length} boosted → ${mintsToProbe.length} mints to probe`
    );

    // Step 2: Probe mints to identify Bags.fm tokens with fees
    const bagsMints = new Map<string, number>(); // mint → feesLamports
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
      `[top-earners] Probed ${mintsToProbe.length} mints → ${bagsMints.size} Bags tokens with fees`
    );

    if (bagsMints.size === 0) {
      const response = {
        success: true,
        topEarners: [] as TopEarner[],
        lastUpdated: new Date().toISOString(),
      };
      cachedResponse = response;
      cacheTime = now;
      return NextResponse.json(response);
    }

    // Step 3: Sort by fees descending, take top 20 for creator lookup
    const sortedMints = Array.from(bagsMints.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([mint]) => mint);

    // Step 3.5: Resolve token names via DexScreener for mints not in DB
    const unknownMints = sortedMints.filter((m) => !dbTokenMap.has(m));
    if (unknownMints.length > 0) {
      const dexPairs = await getTokensByMints(unknownMints);
      for (const pair of dexPairs) {
        if (pair.baseToken && !dbTokenMap.has(pair.baseToken.address)) {
          dbTokenMap.set(pair.baseToken.address, {
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
          });
        }
      }
    }

    // Step 4: Get creators for top Bags tokens
    // wallet → earner data
    const earnerMap = new Map<
      string,
      {
        name: string;
        provider: string;
        username: string;
        profilePic?: string;
        tokens: TopEarnerToken[];
      }
    >();

    const creatorFetches = sortedMints.map(async (mint) => {
      const cached = creatorCache.get(mint);
      if (cached && now - cached.ts < CREATOR_TTL) {
        return { mint, creators: cached.creators };
      }

      // The Bags API returns extended creator info
      const raw = await fetch(
        `https://public-api-v2.bags.fm/api/v1/token-launch/creator/v3?tokenMint=${mint}`,
        { headers: { "x-api-key": BAGS_API_KEY } }
      );
      const data = await raw.json();

      if (!data.success || !Array.isArray(data.response)) {
        creatorCache.set(mint, { creators: [], ts: now });
        return { mint, creators: [] };
      }

      const creators = data.response as Array<{
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

      // Find the creator with royalties (the fee earner)
      for (const creator of creators) {
        if (!creator.royaltyBps || creator.royaltyBps === 0) continue;

        const feesLamports = bagsMints.get(mint) ?? 0;
        const dbToken = dbTokenMap.get(mint);
        const token: TopEarnerToken = {
          mint,
          name: dbToken?.name || "Unknown",
          symbol: dbToken?.symbol || "???",
          lifetimeFeesSol: feesLamports / 1_000_000_000,
        };

        // Pick the best display name
        const displayName =
          creator.twitterUsername ||
          creator.bagsUsername ||
          creator.providerUsername ||
          creator.username ||
          `${creator.wallet.slice(0, 4)}...${creator.wallet.slice(-4)}`;

        const displayUsername =
          creator.twitterUsername ||
          creator.bagsUsername ||
          creator.providerUsername ||
          `${creator.wallet.slice(0, 4)}...${creator.wallet.slice(-4)}`;

        const existing = earnerMap.get(creator.wallet);
        if (existing) {
          existing.tokens.push(token);
        } else {
          earnerMap.set(creator.wallet, {
            name: displayName,
            provider: creator.provider,
            username: displayUsername,
            profilePic: creator.pfp,
            tokens: [token],
          });
        }
      }
    }

    // Step 5: Build sorted earner list
    const earners: TopEarner[] = [];

    for (const [wallet, data] of earnerMap) {
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
        wallet,
        totalLifetimeFeesSol,
        tokenCount: tokens.length,
        tokens,
      });
    }

    earners.sort((a, b) => b.totalLifetimeFeesSol - a.totalLifetimeFeesSol);

    console.log(
      `[top-earners] Found ${earnerMap.size} fee earners → top ${Math.min(3, earners.length)} returned`
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
