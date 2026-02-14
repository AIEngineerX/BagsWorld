import { NextResponse } from "next/server";
import { getRaffleHistory, isNeonConfigured } from "@/lib/neon";

interface CachedRaffles {
  raffles: Array<{
    id: number;
    prizeSol: number;
    entryCount: number;
    winnerWallet: string | null;
    drawnAt: string | null;
  }>;
  totalGivenAwaySol: number;
  totalRaffles: number;
  lastUpdated: string;
}

let cachedResponse: CachedRaffles | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const now = Date.now();

  if (cachedResponse && now - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedResponse);
  }

  if (!isNeonConfigured()) {
    if (cachedResponse) return NextResponse.json(cachedResponse);
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const history = await getRaffleHistory(50);

    if (!history) {
      if (cachedResponse) return NextResponse.json(cachedResponse);
      return NextResponse.json({
        raffles: [],
        totalGivenAwaySol: 0,
        totalRaffles: 0,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Only include completed raffles with a prize
    const completed = history
      .filter((r) => r.status === "completed" && r.prizeSol && r.prizeSol > 0)
      .map((r) => ({
        id: r.id,
        prizeSol: r.prizeSol!,
        entryCount: r.entryCount,
        winnerWallet: r.winnerWallet,
        drawnAt: r.drawnAt,
      }));

    const totalGivenAwaySol = completed.reduce((sum, r) => sum + r.prizeSol, 0);

    const data: CachedRaffles = {
      raffles: completed,
      totalGivenAwaySol,
      totalRaffles: completed.length,
      lastUpdated: new Date().toISOString(),
    };

    cachedResponse = data;
    cacheTime = now;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[community-fund/raffles] Error:", err);
    if (cachedResponse) return NextResponse.json(cachedResponse);
    return NextResponse.json({ error: "Failed to fetch raffle data" }, { status: 500 });
  }
}
