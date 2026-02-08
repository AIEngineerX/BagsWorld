import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import { isNeonConfigured } from "@/lib/neon";
import { neon } from "@neondatabase/serverless";
import { getMoltbookOrNull } from "@/lib/moltbook-client";

interface TopEarnerToken {
  mint: string;
  name: string;
  symbol: string;
  unclaimedSol: number;
}

interface TopEarner {
  name: string;
  provider: string;
  username: string;
  profilePic?: string;
  wallet: string;
  totalUnclaimedSol: number;
  tokenCount: number;
  tokens: TopEarnerToken[];
}

// 1-hour response cache
let cachedResponse: {
  success: boolean;
  topEarners: TopEarner[];
  lastUpdated: string;
} | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Fetch unique authors from Moltbook's public feed API directly.
 * This mirrors the PowerShell script approach — no MoltbookClient/API key needed.
 */
async function fetchMoltbookFeedAuthors(): Promise<string[]> {
  try {
    const res = await Promise.race([
      fetch("https://www.moltbook.com/api/v1/posts?sort=hot&limit=50"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Moltbook feed timeout")), 10000)
      ),
    ]);
    if (!res.ok) throw new Error(`Moltbook API ${res.status}`);
    const data = (await res.json()) as { posts?: Array<{ author?: { name?: string } }> };
    const posts = data.posts || [];
    const authors = new Set<string>();
    for (const post of posts) {
      if (post.author?.name) authors.add(post.author.name);
    }
    return Array.from(authors);
  } catch (err) {
    console.error("[top-earners] Direct Moltbook feed fetch failed:", err);
    return [];
  }
}

/**
 * Discover Moltbook agents dynamically from the live feed + DB.
 * No hardcoded names — mirrors the PowerShell approach.
 */
async function discoverMoltbookAgents(): Promise<
  Array<{ username: string; displayName?: string }>
> {
  const seen = new Set<string>();
  const agents: Array<{ username: string; displayName?: string }> = [];

  function addAgent(username: string, displayName?: string) {
    const key = username.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    agents.push({ username, displayName });
  }

  // 1. Try MoltbookClient first (if API key is configured)
  const moltbook = getMoltbookOrNull();
  if (moltbook) {
    try {
      const [hotPosts, newPosts] = await Promise.race([
        Promise.all([moltbook.getFeed("hot", 100), moltbook.getFeed("new", 100)]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Moltbook feed timeout")), 10000)
        ),
      ]);
      for (const post of [...hotPosts, ...newPosts]) {
        if (post.author) {
          addAgent(post.author, post.author);
        }
      }
      console.log(`[top-earners] Discovered ${agents.length} agents from MoltbookClient`);
    } catch (err) {
      console.error("[top-earners] MoltbookClient feed failed:", err);
    }
  }

  // 2. Fallback: direct HTTP fetch from Moltbook public API (no key needed)
  if (agents.length === 0) {
    const feedAuthors = await fetchMoltbookFeedAuthors();
    for (const author of feedAuthors) {
      addAgent(author, author);
    }
    if (feedAuthors.length > 0) {
      console.log(`[top-earners] Discovered ${feedAuthors.length} agents from Moltbook public API`);
    }
  }

  // 3. Pull external agents with Moltbook usernames from DB
  if (isNeonConfigured()) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        SELECT name, moltbook_username FROM external_agents
        WHERE moltbook_username IS NOT NULL
      `;
      for (const row of rows) {
        const username = (row as { moltbook_username: string }).moltbook_username;
        const name = (row as { name: string }).name;
        addAgent(username, name);
      }
    } catch (err) {
      console.error("[top-earners] Failed to fetch external agents from DB:", err);
    }
  }

  return agents;
}

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

  try {
    // Step 1: Discover agents from Moltbook feed + DB
    const discoveredAgents = await discoverMoltbookAgents();

    if (discoveredAgents.length === 0) {
      const response = {
        success: true,
        topEarners: [] as TopEarner[],
        lastUpdated: new Date().toISOString(),
      };
      cachedResponse = response;
      cacheTime = Date.now();
      return NextResponse.json(response);
    }

    console.log(`[top-earners] Checking ${discoveredAgents.length} Moltbook agents`);

    // Step 2: Bulk resolve Moltbook usernames → wallets (single API call)
    let walletResults: Array<{
      wallet: string;
      provider: string;
      username: string;
      platformData?: { avatarUrl?: string; displayName?: string };
    }> = [];

    let rateLimited = false;
    try {
      const lookupItems = discoveredAgents.map((a) => ({
        provider: "moltbook",
        username: a.username,
      }));
      walletResults = await Promise.race([
        api.bulkWalletLookup(lookupItems),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Bulk lookup timeout")), 15000)
        ),
      ]);
    } catch (err) {
      const errMsg = String(err);
      if (errMsg.includes("Rate limit") || errMsg.includes("429")) {
        rateLimited = true;
      }
      console.error("[top-earners] Bulk wallet lookup failed:", err);
    }

    console.log(
      `[top-earners] Resolved ${walletResults.length}/${discoveredAgents.length} agents to wallets${rateLimited ? " (rate limited)" : ""}`
    );

    if (walletResults.length === 0) {
      if (rateLimited && cachedResponse && cachedResponse.topEarners.length > 0) {
        return NextResponse.json(cachedResponse);
      }
      if (rateLimited) {
        return NextResponse.json(
          { success: false, error: "Bags API rate limit reached — try again later" },
          { status: 429 }
        );
      }
      const response = {
        success: true,
        topEarners: [] as TopEarner[],
        lastUpdated: new Date().toISOString(),
      };
      cachedResponse = response;
      cacheTime = Date.now();
      return NextResponse.json(response);
    }

    // Step 3: Get claimable positions per wallet → sum unclaimed fees
    const earners: TopEarner[] = [];

    for (const wr of walletResults) {
      let totalUnclaimedLamports = 0;
      const tokens: TopEarnerToken[] = [];

      try {
        const positions = await Promise.race([
          api.getClaimablePositions(wr.wallet),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
        ]);

        for (const pos of positions || []) {
          // Sum both virtual pool + DAMM pool fees (migrated tokens have DAMM amounts)
          // Matches getClaimableForWallet() logic in launcher.ts
          const raw = pos as unknown as Record<string, unknown>;
          const virtual = Number(
            raw.virtualPoolClaimableAmount ?? pos.totalClaimableLamportsUserShare ?? 0
          );
          const damm = Number(raw.dammPoolClaimableAmount ?? 0);
          const lamports = virtual + damm;
          totalUnclaimedLamports += lamports;
          tokens.push({
            mint: pos.baseMint,
            name: pos.tokenName || "Unknown",
            symbol: pos.tokenSymbol || "???",
            unclaimedSol: lamports / 1_000_000_000,
          });
        }
      } catch {
        // Claimable lookup failed for this wallet — still show the agent with 0
      }

      // Sort tokens by unclaimed fees descending
      tokens.sort((a, b) => b.unclaimedSol - a.unclaimedSol);

      const discoveredAgent = discoveredAgents.find(
        (a) => a.username.toLowerCase() === wr.username.toLowerCase()
      );

      earners.push({
        name: wr.platformData?.displayName || discoveredAgent?.displayName || wr.username,
        provider: "moltbook",
        username: wr.username,
        profilePic: wr.platformData?.avatarUrl,
        wallet: wr.wallet,
        totalUnclaimedSol: totalUnclaimedLamports / 1_000_000_000,
        tokenCount: tokens.length,
        tokens,
      });
    }

    // Sort by total unclaimed fees descending
    earners.sort((a, b) => b.totalUnclaimedSol - a.totalUnclaimedSol);

    console.log(`[top-earners] ${walletResults.length} wallets → ${earners.length} agents listed`);

    const response = {
      success: true,
      topEarners: earners.slice(0, 10),
      lastUpdated: new Date().toISOString(),
    };

    cachedResponse = response;
    cacheTime = Date.now();

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
