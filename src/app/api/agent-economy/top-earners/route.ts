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
  claimedSol: number;
  lifetimeFeesSol: number;
}

interface TopEarner {
  name: string;
  provider: string;
  username: string;
  profilePic?: string;
  wallet: string;
  totalUnclaimedSol: number;
  totalLifetimeFeesSol: number;
  tokenCount: number;
  tokens: TopEarnerToken[];
}

// Cache config
let cachedResponse: {
  success: boolean;
  topEarners: TopEarner[];
  lastUpdated: string;
} | null = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 min fresh
const STALE_TTL = 2 * 60 * 60 * 1000; // 2 hour stale-while-revalidate
let refreshInProgress = false;

// Persistent set of discovered agent usernames — survives cache refreshes
// so agents aren't lost when they fall off the Moltbook feed
const knownAgentUsernames = new Map<string, string>(); // lowercase → original username

/** @internal Reset persistent state — for testing only */
export function _resetKnownAgentsForTesting() {
  knownAgentUsernames.clear();
  cachedResponse = null;
  cacheTime = 0;
}

/** Extract author name from a Moltbook post, handling both string and object formats. */
function extractAuthorName(author: unknown): string | null {
  if (typeof author === "string") return author || null;
  if (author && typeof author === "object" && "name" in author) {
    const name = (author as { name: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

// Submolts where Bags.fm agents are active (global feed misses these)
const AGENT_SUBMOLTS = [
  "crypto",
  "general",
  "agentfinance",
  "introductions",
  "bagsworld",
  "pokecenter",
];

// BagsWorld's own agents — always included even if they don't appear in any Moltbook feed
const KNOWN_BAGSWORLD_AGENTS = ["Bagsy", "ChadGhost", "FinnBags"];

/**
 * Fetch unique authors from Moltbook's public feed API directly.
 * Fetches global feeds + submolt-specific feeds for broader coverage.
 */
async function fetchMoltbookFeedAuthors(): Promise<string[]> {
  try {
    // Global feed (hot/new/top)
    const globalFetches = ["hot", "new", "top"].map((sort) =>
      fetch(`https://www.moltbook.com/api/v1/posts?sort=${sort}&limit=50`)
        .then((r) => (r.ok ? r.json() : { posts: [] }))
        .catch(() => ({ posts: [] }))
    );
    // Submolt feeds (hot/new/top from key communities for broader coverage)
    const submoltFetches = AGENT_SUBMOLTS.flatMap((sub) =>
      ["hot", "new", "top"].map((sort) =>
        fetch(`https://www.moltbook.com/api/v1/submolts/${sub}?sort=${sort}&limit=50`)
          .then((r) => (r.ok ? r.json() : { posts: [] }))
          .catch(() => ({ posts: [] }))
      )
    );
    // Agent leaderboard (discovers agents by karma ranking)
    const leaderboardFetch = fetch("https://www.moltbook.com/api/v1/agents/leaderboard?limit=100")
      .then((r) => (r.ok ? r.json() : { leaderboard: [] }))
      .catch(() => ({ leaderboard: [] }));
    const [feedResults, leaderboardData] = await Promise.race([
      Promise.all([Promise.all([...globalFetches, ...submoltFetches]), leaderboardFetch]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Moltbook feed timeout")), 15000)
      ),
    ]);
    const authors = new Set<string>();
    for (const data of feedResults) {
      const posts = (data as { posts?: Array<{ author?: unknown }> }).posts || [];
      for (const post of posts) {
        const name = extractAuthorName(post.author);
        if (name) authors.add(name);
      }
    }
    // Add agents from leaderboard
    const leaderboard =
      (leaderboardData as { leaderboard?: Array<{ name?: string }> })?.leaderboard || [];
    for (const agent of leaderboard) {
      if (agent.name) authors.add(agent.name);
    }
    return Array.from(authors);
  } catch (err) {
    console.error("[top-earners] Direct Moltbook feed fetch failed:", err);
    return [];
  }
}

/**
 * Discover Moltbook agents dynamically from the live feed + DB.
 * Uses a persistent set so agents aren't lost when they fall off the feed.
 */
async function discoverMoltbookAgents(): Promise<
  Array<{ username: string; displayName?: string }>
> {
  const seen = new Set<string>();
  const agents: Array<{ username: string; displayName?: string }> = [];

  function addAgent(username: string, displayName?: string) {
    if (typeof username !== "string" || !username) return;
    const key = username.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    agents.push({ username, displayName });
    // Persist across cache refreshes so agents aren't lost when they leave the feed
    knownAgentUsernames.set(key, username);
  }

  // 0a. Always include known BagsWorld agents
  for (const agent of KNOWN_BAGSWORLD_AGENTS) {
    addAgent(agent, agent);
  }

  // 0b. Restore all previously-discovered agents so they're never lost
  for (const [, username] of knownAgentUsernames) {
    addAgent(username, username);
  }

  // 1. Try MoltbookClient (authenticated — global + submolt feeds)
  let authFeedSucceeded = false;
  const moltbook = getMoltbookOrNull();
  if (moltbook) {
    try {
      const feeds = await Promise.race([
        Promise.all([
          moltbook.getFeed("hot", 100),
          moltbook.getFeed("new", 100),
          moltbook.getFeed("top", 100).catch(() => []),
          // Scan key submolts — only "new" sort to reduce request count
          ...AGENT_SUBMOLTS.map((sub) => moltbook.getSubmoltPosts(sub, "new", 50).catch(() => [])),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Moltbook feed timeout")), 15000)
        ),
      ]);
      for (const feed of feeds) {
        if (!Array.isArray(feed)) continue;
        for (const post of feed) {
          const authorName = extractAuthorName(post.author);
          if (authorName) {
            addAgent(authorName, authorName);
          }
        }
      }
      authFeedSucceeded = true;
      console.log(`[top-earners] Discovered ${agents.length} agents from MoltbookClient feeds`);
    } catch (err) {
      console.error("[top-earners] MoltbookClient feed failed:", err);
    }
  }

  // 2. Public API fallback — only when authenticated client unavailable or failed
  if (!authFeedSucceeded) {
    const feedAuthors = await fetchMoltbookFeedAuthors();
    for (const author of feedAuthors) {
      addAgent(author, author);
    }
    if (feedAuthors.length > 0) {
      console.log(`[top-earners] Fell back to public API (total now: ${agents.length})`);
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

/**
 * Background refresh — populates cache without blocking the request
 */
async function refreshCache(): Promise<void> {
  if (refreshInProgress) return;
  refreshInProgress = true;

  try {
    const BAGS_API_KEY = process.env.BAGS_API_KEY;
    if (!BAGS_API_KEY) return;

    const api = initBagsApi(BAGS_API_KEY);

    // Step 1: Discover agents from Moltbook feed + DB
    const discoveredAgents = await discoverMoltbookAgents();

    if (discoveredAgents.length === 0) {
      cachedResponse = {
        success: true,
        topEarners: [],
        lastUpdated: new Date().toISOString(),
      };
      cacheTime = Date.now();
      return;
    }

    // Cap lookups to keep response times under ~60s (known agents are first in the list)
    const MAX_LOOKUPS = 200;
    const agentsToLookup = discoveredAgents.slice(0, MAX_LOOKUPS);
    console.log(
      `[top-earners] Checking ${agentsToLookup.length}/${discoveredAgents.length} Moltbook agents`
    );

    // Step 2: Bulk resolve Moltbook usernames → wallets (batched, max 100 per call)
    let walletResults: Array<{
      wallet: string;
      provider: string;
      username: string;
      platformData?: { avatarUrl?: string; displayName?: string };
    }> = [];

    let rateLimited = false;
    try {
      const lookupItems = agentsToLookup.map((a) => ({
        provider: "moltbook",
        username: a.username,
      }));
      const BATCH_SIZE = 50;
      const CONCURRENCY = 3;
      const batches: Array<{ provider: string; username: string }[]> = [];
      for (let i = 0; i < lookupItems.length; i += BATCH_SIZE) {
        batches.push(lookupItems.slice(i, i + BATCH_SIZE));
      }

      for (let round = 0; round < batches.length && !rateLimited; round += CONCURRENCY) {
        const concurrent = batches.slice(round, round + CONCURRENCY);
        const settled = await Promise.allSettled(
          concurrent.map((batch) =>
            Promise.race([
              api.bulkWalletLookup(batch),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Bulk lookup timeout")), 20000)
              ),
            ])
          )
        );
        for (let j = 0; j < settled.length; j++) {
          const result = settled[j];
          if (result.status === "fulfilled") {
            walletResults.push(...result.value);
          } else {
            const errMsg = String(result.reason);
            if (errMsg.includes("Rate limit") || errMsg.includes("429")) {
              rateLimited = true;
              break;
            }
            console.error(
              `[top-earners] Batch ${round + j + 1} failed:`,
              result.reason instanceof Error ? result.reason.message : result.reason
            );
          }
        }
      }
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
      if (!rateLimited) {
        cachedResponse = {
          success: true,
          topEarners: [],
          lastUpdated: new Date().toISOString(),
        };
        cacheTime = Date.now();
      }
      return;
    }

    // Phase 1: Fetch claimable positions per wallet, collect unique mints
    const walletPositions = new Map<
      string,
      Array<{ baseMint: string; unclaimedLamports: number; name: string; symbol: string }>
    >();
    const uniqueMints = new Set<string>();

    for (const wr of walletResults) {
      try {
        const positions = await Promise.race([
          api.getClaimablePositions(wr.wallet),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
        ]);

        const parsed: Array<{
          baseMint: string;
          unclaimedLamports: number;
          name: string;
          symbol: string;
        }> = [];

        for (const pos of positions || []) {
          const raw = pos as unknown as Record<string, unknown>;
          const virtual = Number(
            raw.virtualPoolClaimableAmount ?? pos.totalClaimableLamportsUserShare ?? 0
          );
          const damm = Number(raw.dammPoolClaimableAmount ?? 0);
          const lamports = virtual + damm;
          parsed.push({
            baseMint: pos.baseMint,
            unclaimedLamports: lamports,
            name: pos.tokenName || "Unknown",
            symbol: pos.tokenSymbol || "???",
          });
          uniqueMints.add(pos.baseMint);
        }

        walletPositions.set(wr.wallet, parsed);
      } catch {
        walletPositions.set(wr.wallet, []);
      }
    }

    // Phase 2: Batch-fetch claim stats for unique mints (5 concurrent, 5s timeout each)
    const claimStatsMap = new Map<string, Map<string, number>>();
    const mintArray = Array.from(uniqueMints);

    for (let i = 0; i < mintArray.length; i += 5) {
      const batch = mintArray.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map((mint) =>
          Promise.race([
            api.getClaimStats(mint),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
          ])
        )
      );

      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled" && result.value) {
          const perWallet = new Map<string, number>();
          for (const stat of result.value) {
            perWallet.set(stat.user, stat.totalClaimed);
          }
          claimStatsMap.set(batch[j], perWallet);
        }
      }
    }

    // Phase 3: Build earner objects with lifetime totals
    const earners: TopEarner[] = [];

    for (const wr of walletResults) {
      const positions = walletPositions.get(wr.wallet) || [];
      let totalUnclaimedLamports = 0;
      let totalClaimedLamports = 0;
      const tokens: TopEarnerToken[] = [];

      for (const pos of positions) {
        totalUnclaimedLamports += pos.unclaimedLamports;
        const mintStats = claimStatsMap.get(pos.baseMint);
        const claimedLamports = mintStats?.get(wr.wallet) ?? 0;
        totalClaimedLamports += claimedLamports;

        const unclaimedSol = pos.unclaimedLamports / 1_000_000_000;
        const claimedSol = claimedLamports / 1_000_000_000;

        tokens.push({
          mint: pos.baseMint,
          name: pos.name,
          symbol: pos.symbol,
          unclaimedSol,
          claimedSol,
          lifetimeFeesSol: unclaimedSol + claimedSol,
        });
      }

      tokens.sort((a, b) => b.lifetimeFeesSol - a.lifetimeFeesSol);

      const discoveredAgent = discoveredAgents.find(
        (a) => a.username.toLowerCase() === wr.username.toLowerCase()
      );

      const totalUnclaimedSol = totalUnclaimedLamports / 1_000_000_000;
      const totalClaimedSol = totalClaimedLamports / 1_000_000_000;

      earners.push({
        name: wr.platformData?.displayName || discoveredAgent?.displayName || wr.username,
        provider: "moltbook",
        username: wr.username,
        profilePic: wr.platformData?.avatarUrl,
        wallet: wr.wallet,
        totalUnclaimedSol,
        totalLifetimeFeesSol: totalUnclaimedSol + totalClaimedSol,
        tokenCount: tokens.length,
        tokens,
      });
    }

    earners.sort((a, b) => b.totalLifetimeFeesSol - a.totalLifetimeFeesSol);

    console.log(`[top-earners] ${walletResults.length} wallets → ${earners.length} agents listed`);

    cachedResponse = {
      success: true,
      topEarners: earners.slice(0, 10),
      lastUpdated: new Date().toISOString(),
    };
    cacheTime = Date.now();
  } catch (err) {
    console.error("[top-earners] Background refresh error:", err);
  } finally {
    refreshInProgress = false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const noCache = searchParams.has("nocache");
  const cacheAge = Date.now() - cacheTime;

  // Fresh cache — return immediately
  if (!noCache && cachedResponse && cacheAge < CACHE_TTL) {
    return NextResponse.json({ ...cachedResponse, cacheStatus: "fresh" });
  }

  // Stale cache — return stale data immediately, refresh in background
  if (!noCache && cachedResponse && cacheAge < STALE_TTL) {
    // Fire-and-forget background refresh
    refreshCache().catch(() => {});
    return NextResponse.json({ ...cachedResponse, cacheStatus: "stale" });
  }

  // No cache or expired — must wait for refresh
  const BAGS_API_KEY = process.env.BAGS_API_KEY;
  if (!BAGS_API_KEY) {
    return NextResponse.json(
      { success: false, error: "BAGS_API_KEY not configured" },
      { status: 503 }
    );
  }

  // If another request is already refreshing, wait a bit and return whatever we have
  if (refreshInProgress && cachedResponse) {
    return NextResponse.json({ ...cachedResponse, cacheStatus: "stale" });
  }

  await refreshCache();

  if (cachedResponse) {
    return NextResponse.json({ ...cachedResponse, cacheStatus: "fresh" });
  }

  return NextResponse.json(
    { success: false, error: "Failed to fetch top earners" },
    { status: 500 }
  );
}
