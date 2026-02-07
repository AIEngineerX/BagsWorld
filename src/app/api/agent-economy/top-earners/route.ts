import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import { searchTokens } from "@/lib/dexscreener-api";
import { getGlobalTokens, isNeonConfigured } from "@/lib/neon";

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
  tokenCount: number;
} | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// Per-mint probe cache (2h)
const probeCache = new Map<string, { feesLamports: number; ts: number }>();
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

  // earnerKey → earner data
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
  // Track which mints have DB fee_shares (skip creator API for these)
  const dbFeeShares = new Map<string, Array<{ provider: string; username: string; bps: number }>>();

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
        // Store DB fee_shares so we can skip creator API for these
        if (t.fee_shares && t.fee_shares.length > 0) {
          dbFeeShares.set(t.mint, t.fee_shares);
        }
      }
    }

    const allMints = Array.from(mintSet);
    console.log(
      `[top-earners] Discovered ${allMints.length} Bags.fm tokens (${dexPairs.length} DexScreener, ${dbFeeShares.size} DB)`
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
    // Step 2: Get lifetime fees for all discovered tokens
    // ====================================================
    const uncachedMints: string[] = [];
    const bagsMints = new Map<string, number>(); // mint → feesLamports

    for (const mint of allMints) {
      const cached = probeCache.get(mint);
      if (cached && now - cached.ts < PROBE_TTL) {
        if (cached.feesLamports > 0) {
          bagsMints.set(mint, cached.feesLamports);
        }
      } else {
        uncachedMints.push(mint);
      }
    }

    if (uncachedMints.length > 0) {
      // Batch in groups of 20 to avoid rate limits
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
            if (result.value > 0) bagsMints.set(mint, result.value);
          } else {
            probeCache.set(mint, { feesLamports: 0, ts: now });
          }
        }
      }
    }

    console.log(
      `[top-earners] ${bagsMints.size} tokens have fees (${uncachedMints.length} freshly probed)`
    );

    if (bagsMints.size === 0) {
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
    // Step 3: Get creators for tokens with fees
    // Use DB fee_shares when available, Bags API otherwise
    // ====================================================
    const sortedMints = Array.from(bagsMints.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([mint]) => mint);

    for (const mint of sortedMints) {
      const feesLamports = bagsMints.get(mint) ?? 0;
      const meta = tokenMeta.get(mint);

      // Fast path: use DB fee_shares if available
      const dbShares = dbFeeShares.get(mint);
      if (dbShares) {
        for (const share of dbShares) {
          if (share.provider !== "moltbook" || share.bps <= 0) continue;

          const royaltyShare = share.bps / 10000;
          const earnerToken: TopEarnerToken = {
            mint,
            name: meta?.name || "Unknown",
            symbol: meta?.symbol || "???",
            lifetimeFeesSol: (feesLamports * royaltyShare) / 1_000_000_000,
          };

          const key = `moltbook:${share.username}`;
          const existing = earnerMap.get(key);
          if (existing) {
            if (!existing.tokens.some((t) => t.mint === mint)) {
              existing.tokens.push(earnerToken);
            }
          } else {
            earnerMap.set(key, {
              name: share.username,
              provider: "moltbook",
              username: share.username,
              wallet: "",
              tokens: [earnerToken],
            });
          }
        }
        continue; // Skip API call for DB tokens
      }

      // Slow path: fetch creators from Bags API
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

      // Process creators — filter for Moltbook agents
      const creatorsWithRoyalties = creators.creators.filter(
        (c) => c.royaltyBps === undefined || c.royaltyBps > 0
      );
      const defaultShare = creatorsWithRoyalties.length > 0 ? 1 / creatorsWithRoyalties.length : 1;

      for (const creator of creatorsWithRoyalties) {
        if (creator.provider !== "moltbook") continue;

        const royaltyShare =
          creator.royaltyBps !== undefined ? creator.royaltyBps / 10000 : defaultShare;

        const earnerToken: TopEarnerToken = {
          mint,
          name: meta?.name || "Unknown",
          symbol: meta?.symbol || "???",
          lifetimeFeesSol: (feesLamports * royaltyShare) / 1_000_000_000,
        };

        const displayName =
          creator.providerUsername ||
          creator.username ||
          `${creator.wallet.slice(0, 4)}...${creator.wallet.slice(-4)}`;

        const key = `moltbook:${creator.providerUsername || creator.username || creator.wallet}`;
        const existing = earnerMap.get(key);
        if (existing) {
          if (!existing.tokens.some((t) => t.mint === mint)) {
            existing.tokens.push(earnerToken);
          }
        } else {
          earnerMap.set(key, {
            name: displayName,
            provider: "moltbook",
            username:
              creator.providerUsername ||
              creator.username ||
              `${creator.wallet.slice(0, 4)}...${creator.wallet.slice(-4)}`,
            profilePic: creator.pfp,
            wallet: creator.wallet,
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
      `[top-earners] ${allMints.length} tokens scanned → ${earnerMap.size} Moltbook earners → top ${Math.min(3, earners.length)}`
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
