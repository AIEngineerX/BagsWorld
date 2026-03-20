import { NextResponse } from "next/server";
import { initBagsApi } from "@/lib/bags-api";
import { lamportsToSol } from "@/lib/solana-utils";
import type { ClaimEvent } from "@/lib/types";

const BAGSWORLD_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";

interface CachedData {
  tokenLifetimeFeesSol: number;
  recentClaims: Array<{
    claimer: string;
    amount: number;
    timestamp: number;
    signature: string;
  }>;
  totalClaimsSol: number;
  claimCount: number;
  lastUpdated: string;
}

let cachedResponse: CachedData | null = null;
let cacheTime = 0;
let lastErrorTime = 0;
let refreshInProgress: Promise<CachedData> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ERROR_COOLDOWN = 30 * 1000; // 30s cooldown after total failure

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const lifetimeFeesLamports = await tryCall(() => api.getTokenLifetimeFees(BAGSWORLD_MINT), 0);
  await delay(1500);
  const claimEvents = await tryCall(
    () => api.getTokenClaimEvents(BAGSWORLD_MINT, 200),
    [] as ClaimEvent[]
  );

  const tokenLifetimeFeesSol = lamportsToSol(lifetimeFeesLamports);

  const totalClaimsSol = claimEvents.reduce((sum, e) => sum + lamportsToSol(e.amount), 0);

  const recentClaims = claimEvents.slice(0, 20).map((e) => ({
    claimer: e.claimer,
    amount: lamportsToSol(e.amount),
    timestamp: e.timestamp,
    signature: e.signature,
  }));

  return {
    tokenLifetimeFeesSol,
    recentClaims,
    totalClaimsSol,
    claimCount: claimEvents.length,
    lastUpdated: new Date().toISOString(),
  };
}

export async function GET() {
  const now = Date.now();

  if (cachedResponse && now - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedResponse);
  }

  if (now - lastErrorTime < ERROR_COOLDOWN) {
    if (cachedResponse) return NextResponse.json(cachedResponse);
    return NextResponse.json({ error: "Rate limited — try again shortly" }, { status: 429 });
  }

  try {
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

    if (cachedResponse) {
      return NextResponse.json(cachedResponse);
    }

    return NextResponse.json({ error: "Failed to fetch community fund data" }, { status: 500 });
  }
}
