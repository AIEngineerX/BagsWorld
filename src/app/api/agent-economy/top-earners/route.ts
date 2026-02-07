import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import { isNeonConfigured } from "@/lib/neon";
import { neon } from "@neondatabase/serverless";

interface TopEarnerToken {
  mint: string;
  name: string;
  symbol: string;
  claimableSol: number;
}

interface TopEarner {
  name: string;
  provider: string;
  username: string;
  profilePic?: string;
  wallet: string;
  totalClaimableSol: number;
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

/**
 * Get all known Moltbook agent usernames from DB + hardcoded list
 */
async function getKnownMoltbookAgents(): Promise<
  Array<{ username: string; displayName?: string }>
> {
  const agents: Array<{ username: string; displayName?: string }> = [];

  // Hardcoded agents that always exist
  agents.push({ username: "Bagsy", displayName: "Bagsy" });
  agents.push({ username: "ChadGhost", displayName: "ChadGhost" });

  // Pull external agents with Moltbook usernames from DB
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
        // Avoid duplicates
        if (!agents.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
          agents.push({ username, displayName: name });
        }
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
    // Step 1: Get all known Moltbook agents
    const knownAgents = await getKnownMoltbookAgents();

    if (knownAgents.length === 0) {
      const response = {
        success: true,
        topEarners: [] as TopEarner[],
        lastUpdated: new Date().toISOString(),
      };
      cachedResponse = response;
      cacheTime = Date.now();
      return NextResponse.json(response);
    }

    console.log(`[top-earners] Checking ${knownAgents.length} Moltbook agents`);

    // Step 2: Bulk resolve Moltbook usernames → wallets
    const bulkItems = knownAgents.map((a) => ({
      provider: "moltbook",
      username: a.username,
    }));

    let walletResults: Array<{
      wallet: string;
      provider: string;
      username: string;
      platformData?: { avatarUrl?: string; displayName?: string };
    }> = [];

    try {
      walletResults = await api.bulkWalletLookup(bulkItems);
    } catch (err) {
      console.error("[top-earners] Bulk wallet lookup failed:", err);
      return NextResponse.json({
        success: false,
        error: "Failed to resolve agent wallets",
      });
    }

    if (walletResults.length === 0) {
      const response = {
        success: true,
        topEarners: [] as TopEarner[],
        lastUpdated: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }

    // Step 3: Get claimable positions for each wallet
    const earners: TopEarner[] = [];

    const positionResults = await Promise.allSettled(
      walletResults.map((wr) => api.getClaimablePositions(wr.wallet))
    );

    for (let i = 0; i < walletResults.length; i++) {
      const wr = walletResults[i];
      const result = positionResults[i];

      if (result.status !== "fulfilled" || !result.value?.length) continue;

      const positions = result.value;
      const tokens: TopEarnerToken[] = [];
      let totalLamports = 0;

      for (const pos of positions) {
        const lamports = pos.totalClaimableLamportsUserShare || 0;
        if (lamports <= 0) continue;

        totalLamports += lamports;
        tokens.push({
          mint: pos.baseMint,
          name: pos.tokenName || "Unknown",
          symbol: pos.tokenSymbol || "???",
          claimableSol: lamports / 1_000_000_000,
        });
      }

      if (totalLamports <= 0) continue;

      // Sort tokens by claimable amount descending
      tokens.sort((a, b) => b.claimableSol - a.claimableSol);

      // Find display name from known agents list
      const knownAgent = knownAgents.find(
        (a) => a.username.toLowerCase() === wr.username.toLowerCase()
      );

      earners.push({
        name: wr.platformData?.displayName || knownAgent?.displayName || wr.username,
        provider: "moltbook",
        username: wr.username,
        profilePic: wr.platformData?.avatarUrl,
        wallet: wr.wallet,
        totalClaimableSol: totalLamports / 1_000_000_000,
        tokenCount: tokens.length,
        tokens,
      });
    }

    // Sort by total claimable SOL descending
    earners.sort((a, b) => b.totalClaimableSol - a.totalClaimableSol);

    console.log(
      `[top-earners] ${walletResults.length} wallets resolved → ${earners.length} with claimable fees`
    );

    const response = {
      success: true,
      topEarners: earners.slice(0, 3),
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
