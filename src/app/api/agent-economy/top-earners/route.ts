import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import { searchTokens } from "@/lib/dexscreener-api";
import { getGlobalTokens, isNeonConfigured } from "@/lib/neon";

interface TopEarnerToken {
  mint: string;
  name: string;
  symbol: string;
  claimedSol: number;
}

interface TopEarner {
  name: string;
  provider: string;
  username: string;
  profilePic?: string;
  wallet: string;
  totalClaimedSol: number;
  tokenCount: number;
  tokens: TopEarnerToken[];
}

// 5-minute response cache
let cachedResponse: {
  success: boolean;
  topEarners: TopEarner[];
  lastUpdated: string;
  tokenCount: number;
} | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// Per-mint lifetime fees probe cache (2h) — used as a filter
const probeCache = new Map<string, { feesLamports: number; ts: number }>();
const PROBE_TTL = 2 * 60 * 60_000;

// Per-mint claim stats cache (30 min)
const claimStatsCache = new Map<
  string,
  { stats: Array<{ user: string; totalClaimed: number; claimCount: number }>; ts: number }
>();
const CLAIM_STATS_TTL = 30 * 60_000;

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

  // wallet → earner data (keyed by wallet since claim stats use wallets)
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

  // Track token metadata: mint → {name, symbol}
  const tokenMeta = new Map<string, { name: string; symbol: string }>();

  try {
    // ====================================================
    // Step 1: Discover ALL Bags.fm tokens
    // All Bags.fm mints end in "BAGS" — use DexScreener search
    // ====================================================
    const mintSet = new Set<string>();

    // Source A: DexScreener search for BAGS-suffix tokens (global discovery)
    const dexPairs = await searchTokens("BAGS").catch(() => []);
    for (const pair of dexPairs) {
      if (pair.chainId === "solana" && pair.baseToken.address.endsWith("BAGS")) {
        mintSet.add(pair.baseToken.address);
        tokenMeta.set(pair.baseToken.address, {
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
        });
      }
    }

    // Source B: BagsWorld DB tokens (may include tokens not on DexScreener)
    if (isNeonConfigured()) {
      const globalTokens = await getGlobalTokens();
      for (const t of globalTokens) {
        if (t.mint === "TEST123") continue;
        mintSet.add(t.mint);
        tokenMeta.set(t.mint, { name: t.name, symbol: t.symbol });
      }
    }

    const allMints = Array.from(mintSet);
    console.log(
      `[top-earners] Discovered ${allMints.length} Bags.fm tokens (${dexPairs.length} DexScreener)`
    );

    if (allMints.length === 0) {
      const response = {
        success: true,
        topEarners: [] as TopEarner[],
        lastUpdated: new Date().toISOString(),
        tokenCount: 0,
      };
      cachedResponse = response;
      cacheTime = now;
      return NextResponse.json(response);
    }

    // ====================================================
    // Step 2: Probe lifetime fees to filter tokens with activity
    // (tokens with 0 lifetime fees can't have any claims)
    // ====================================================
    const uncachedMints: string[] = [];
    const activeMints = new Map<string, number>(); // mint → feesLamports

    for (const mint of allMints) {
      const cached = probeCache.get(mint);
      if (cached && now - cached.ts < PROBE_TTL) {
        if (cached.feesLamports > 0) {
          activeMints.set(mint, cached.feesLamports);
        }
      } else {
        uncachedMints.push(mint);
      }
    }

    if (uncachedMints.length > 0) {
      const batches = [];
      for (let i = 0; i < uncachedMints.length; i += 20) {
        batches.push(uncachedMints.slice(i, i + 20));
      }

      for (const batch of batches) {
        const results = await Promise.allSettled(batch.map((m) => api.getTokenLifetimeFees(m)));

        for (let i = 0; i < batch.length; i++) {
          const mint = batch[i];
          const result = results[i];
          if (result.status === "fulfilled") {
            probeCache.set(mint, { feesLamports: result.value, ts: now });
            if (result.value > 0) activeMints.set(mint, result.value);
          } else {
            probeCache.set(mint, { feesLamports: 0, ts: now });
          }
        }
      }
    }

    console.log(
      `[top-earners] ${activeMints.size} tokens have fee activity (${uncachedMints.length} freshly probed)`
    );

    if (activeMints.size === 0) {
      const response = {
        success: true,
        topEarners: [] as TopEarner[],
        lastUpdated: new Date().toISOString(),
        tokenCount: allMints.length,
      };
      cachedResponse = response;
      cacheTime = now;
      return NextResponse.json(response);
    }

    // ====================================================
    // Step 3: Get claim stats + creators for active tokens
    // Match claimed wallets to Moltbook agents
    // ====================================================
    const sortedMints = Array.from(activeMints.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([mint]) => mint);

    for (const mint of sortedMints) {
      const meta = tokenMeta.get(mint);

      // 3a: Get claim stats for this token
      let claimStats = claimStatsCache.get(mint);
      if (!claimStats || now - claimStats.ts >= CLAIM_STATS_TTL) {
        try {
          const freshStats = await api.getClaimStats(mint);
          claimStats = { stats: freshStats, ts: now };
          claimStatsCache.set(mint, claimStats);
        } catch {
          claimStats = { stats: [], ts: now };
          claimStatsCache.set(mint, claimStats);
        }
      }

      // Skip tokens with no claims
      if (claimStats.stats.length === 0) continue;

      // 3b: Get creators to map wallets → Moltbook identities
      let creators = creatorCache.get(mint);
      if (!creators || now - creators.ts >= CREATOR_TTL) {
        try {
          const raw = await fetch(
            `https://public-api-v2.bags.fm/api/v1/token-launch/creator/v3?tokenMint=${mint}`,
            { headers: { "x-api-key": BAGS_API_KEY } }
          );
          const data = await raw.json();

          if (data.success) {
            const creatorsArray = Array.isArray(data.response)
              ? data.response
              : Array.isArray(data.creators)
                ? data.creators
                : [];
            creators = { creators: creatorsArray, ts: now };
          } else {
            creators = { creators: [], ts: now };
          }
          creatorCache.set(mint, creators);
        } catch {
          creators = { creators: [], ts: now };
          creatorCache.set(mint, creators);
        }
      }

      // 3c: Build wallet → Moltbook identity map for this token's creators
      const walletToMoltbook = new Map<string, { name: string; username: string; pfp?: string }>();

      for (const creator of creators.creators) {
        if (creator.provider !== "moltbook") continue;
        const displayName =
          creator.providerUsername ||
          creator.username ||
          `${creator.wallet.slice(0, 4)}...${creator.wallet.slice(-4)}`;
        walletToMoltbook.set(creator.wallet, {
          name: displayName,
          username: creator.providerUsername || creator.username || creator.wallet,
          pfp: creator.pfp,
        });
      }

      // 3d: Match claim stats to Moltbook creators
      for (const stat of claimStats.stats) {
        const moltAgent = walletToMoltbook.get(stat.user);
        if (!moltAgent) continue;
        if (stat.totalClaimed <= 0) continue;

        const claimedSol = stat.totalClaimed / 1_000_000_000;

        const earnerToken: TopEarnerToken = {
          mint,
          name: meta?.name || "Unknown",
          symbol: meta?.symbol || "???",
          claimedSol,
        };

        const key = `moltbook:${moltAgent.username}`;
        const existing = earnerMap.get(key);
        if (existing) {
          if (!existing.tokens.some((t) => t.mint === mint)) {
            existing.tokens.push(earnerToken);
          }
        } else {
          earnerMap.set(key, {
            name: moltAgent.name,
            provider: "moltbook",
            username: moltAgent.username,
            profilePic: moltAgent.pfp,
            wallet: stat.user,
            tokens: [earnerToken],
          });
        }
      }
    }

    // ====================================================
    // Step 4: Build sorted earner list
    // ====================================================
    const earners: TopEarner[] = [];

    for (const [, data] of earnerMap) {
      const tokens = data.tokens
        .filter((t) => t.claimedSol > 0)
        .sort((a, b) => b.claimedSol - a.claimedSol);

      const totalClaimedSol = tokens.reduce((sum, t) => sum + t.claimedSol, 0);
      if (totalClaimedSol === 0) continue;

      earners.push({
        name: data.name,
        provider: data.provider,
        username: data.username,
        profilePic: data.profilePic,
        wallet: data.wallet,
        totalClaimedSol,
        tokenCount: tokens.length,
        tokens,
      });
    }

    earners.sort((a, b) => b.totalClaimedSol - a.totalClaimedSol);

    console.log(
      `[top-earners] ${allMints.length} tokens → ${activeMints.size} with fees → ${earnerMap.size} Moltbook claimers → top ${Math.min(3, earners.length)}`
    );

    const response = {
      success: true,
      topEarners: earners.slice(0, 3),
      lastUpdated: new Date().toISOString(),
      tokenCount: allMints.length,
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
