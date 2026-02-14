import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import { lamportsToSol } from "@/lib/solana-utils";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import type { ClaimStats, ClaimEvent } from "@/lib/types";

const BAGSWORLD_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";
const GHOST_WALLET = "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC";
const CONTRIBUTION_PERCENTAGE = ECOSYSTEM_CONFIG.ecosystem.founderContribution.percentage; // 5

interface CachedData {
  ghostTotalClaimedSol: number;
  communityContributionSol: number;
  contributionPercentage: number;
  tokenLifetimeFeesSol: number;
  recentClaims: Array<{
    amount: number;
    timestamp: number;
    signature: string;
  }>;
  lastUpdated: string;
}

let cachedResponse: CachedData | null = null;
let cacheTime = 0;
let lastErrorTime = 0;
let refreshInProgress: Promise<CachedData> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ERROR_COOLDOWN = 30 * 1000; // 30s cooldown after total failure

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Try a call, return fallback on failure instead of throwing */
async function tryCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(
      "[community-fund] Non-critical call failed, using fallback:",
      (err as Error).message
    );
    return fallback;
  }
}

async function fetchFreshData(): Promise<CachedData> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) throw new Error("BAGS_API_KEY not configured");

  const api = initBagsApi(apiKey);

  // claimStats is the critical call — must succeed for meaningful data
  const claimStats: ClaimStats[] = await api.getClaimStats(BAGSWORLD_MINT);

  // These are nice-to-have — use fallbacks if rate-limited
  await delay(1500);
  const lifetimeFeesLamports = await tryCall(() => api.getTokenLifetimeFees(BAGSWORLD_MINT), 0);
  await delay(1500);
  const claimEvents = await tryCall(
    () => api.getTokenClaimEvents(BAGSWORLD_MINT, 200),
    [] as ClaimEvent[]
  );

  const ghostStats = claimStats.find((s) => s.user.toLowerCase() === GHOST_WALLET.toLowerCase());
  const ghostTotalClaimedSol = ghostStats ? lamportsToSol(ghostStats.totalClaimed) : 0;
  const communityContributionSol = ghostTotalClaimedSol * (CONTRIBUTION_PERCENTAGE / 100);
  const tokenLifetimeFeesSol = lamportsToSol(lifetimeFeesLamports);

  const ghostClaims = claimEvents
    .filter((e) => e.claimer.toLowerCase() === GHOST_WALLET.toLowerCase())
    .slice(0, 10)
    .map((e) => ({
      amount: lamportsToSol(e.amount),
      timestamp: e.timestamp,
      signature: e.signature,
    }));

  return {
    ghostTotalClaimedSol,
    communityContributionSol,
    contributionPercentage: CONTRIBUTION_PERCENTAGE,
    tokenLifetimeFeesSol,
    recentClaims: ghostClaims,
    lastUpdated: new Date().toISOString(),
  };
}

export async function GET() {
  const now = Date.now();

  // Return fresh cache if available
  if (cachedResponse && now - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedResponse);
  }

  // During error cooldown, return stale cache or error
  if (now - lastErrorTime < ERROR_COOLDOWN) {
    if (cachedResponse) return NextResponse.json(cachedResponse);
    return NextResponse.json({ error: "Rate limited — try again shortly" }, { status: 429 });
  }

  try {
    // Deduplicate concurrent requests — reuse in-flight fetch
    if (!refreshInProgress) {
      refreshInProgress = fetchFreshData().finally(() => {
        refreshInProgress = null;
      });
    }

    const data = await refreshInProgress;

    cachedResponse = data;
    cacheTime = now;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[community-fund] API error:", err);
    lastErrorTime = now;

    // Return stale cache on error
    if (cachedResponse) {
      return NextResponse.json(cachedResponse);
    }

    return NextResponse.json({ error: "Failed to fetch community fund data" }, { status: 500 });
  }
}
