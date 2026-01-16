import { NextResponse } from "next/server";
import type {
  WorldState,
  FeeEarner,
  TokenInfo,
  GameEvent,
  ClaimEvent,
} from "@/lib/types";
import { buildWorldState } from "@/lib/world-calculator";
import { BagsApiClient } from "@/lib/bags-api";

// Known Bags.fm token mints - these are tokens launched via Bags.fm platform
// This list can be expanded as more tokens are discovered
const BAGS_FM_TOKEN_MINTS: string[] = [
  // Add known Bags.fm token mints here
  // These will be fetched from the Bags.fm API for live data
];

// Initialize Bags API client (lazy initialization)
let bagsApi: BagsApiClient | null = null;

function getBagsApi(): BagsApiClient | null {
  if (!bagsApi && process.env.BAGS_API_KEY) {
    bagsApi = new BagsApiClient(process.env.BAGS_API_KEY);
  }
  return bagsApi;
}

// Cache for various data
interface DataCache<T> {
  data: T;
  timestamp: number;
}

let tokenCache: DataCache<TokenInfo[]> | null = null;
let earnerCache: DataCache<FeeEarner[]> | null = null;
let claimEventsCache: DataCache<ClaimEvent[]> | null = null;
let cachedWeather: { weather: WorldState["weather"]; fetchedAt: number } | null =
  null;

const TOKEN_CACHE_DURATION = 60 * 1000; // 60 seconds
const EARNER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const WEATHER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CLAIM_EVENTS_CACHE_DURATION = 30 * 1000; // 30 seconds

// Store previous state for event generation
let previousState: WorldState | null = null;

// Fetch real Washington DC weather
async function fetchDCWeather(): Promise<WorldState["weather"]> {
  try {
    // Check cache first
    if (
      cachedWeather &&
      Date.now() - cachedWeather.fetchedAt < WEATHER_CACHE_DURATION
    ) {
      return cachedWeather.weather;
    }

    // Fetch from our weather API
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NETLIFY
        ? process.env.URL
        : "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/weather`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Weather API error");
    }

    const data = await response.json();
    const weather = data.gameWeather as WorldState["weather"];

    // Update cache
    cachedWeather = { weather, fetchedAt: Date.now() };

    return weather;
  } catch (error) {
    console.error("Error fetching DC weather:", error);
    // Return cached or default
    return cachedWeather?.weather ?? "cloudy";
  }
}

// Get current EST/EDT time info (handles Daylight Saving Time automatically)
function getESTTimeInfo(): {
  hour: number;
  isNight: boolean;
  isDusk: boolean;
  isDawn: boolean;
} {
  // Use Intl API to get accurate Eastern Time with DST handling
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const estHour = parseInt(formatter.format(now), 10);

  return {
    hour: estHour,
    isNight: estHour >= 20 || estHour < 6, // 8 PM to 6 AM
    isDusk: estHour >= 18 && estHour < 20, // 6 PM to 8 PM
    isDawn: estHour >= 6 && estHour < 8, // 6 AM to 8 AM
  };
}

// Sample Bags.fm tokens - these represent the community/ecosystem
// In production, this would be populated from a database or admin panel
const SAMPLE_BAGS_TOKENS: Array<{
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
}> = [
  {
    mint: "BagsXYZ111111111111111111111111111111111111",
    name: "BagsWorld",
    symbol: "BAGS",
    imageUrl: "/assets/buildings/level-5.png",
  },
  {
    mint: "MayorABC222222222222222222222222222222222222",
    name: "Mayor Coin",
    symbol: "MAYOR",
    imageUrl: "/assets/buildings/level-4.png",
  },
  {
    mint: "CityDEF333333333333333333333333333333333333",
    name: "City Token",
    symbol: "CITY",
    imageUrl: "/assets/buildings/level-3.png",
  },
  {
    mint: "FeesGHI444444444444444444444444444444444444",
    name: "Fee Sharer",
    symbol: "FEES",
    imageUrl: "/assets/buildings/level-2.png",
  },
  {
    mint: "TownJKL555555555555555555555555555555555555",
    name: "Town Hall",
    symbol: "TOWN",
    imageUrl: "/assets/buildings/level-1.png",
  },
];

// Build FeeEarner from creator data
function buildFeeEarner(
  creator: {
    wallet: string;
    provider: string;
    providerUsername: string;
    username?: string;
    pfp?: string;
    isCreator?: boolean;
  },
  token: TokenInfo,
  rank: number
): FeeEarner {
  return {
    rank,
    username: creator.username || creator.providerUsername,
    providerUsername: creator.providerUsername,
    provider: creator.provider as FeeEarner["provider"],
    wallet: creator.wallet,
    avatarUrl: creator.pfp,
    lifetimeEarnings: token.lifetimeFees,
    earnings24h: token.volume24h * 0.01, // Estimate: ~1% of volume as fees
    change24h: token.change24h,
    tokenCount: 1,
    topToken: token,
  };
}

// Fetch live token data from Bags.fm API only (no PumpFun/DexScreener)
async function fetchLiveTokenData(): Promise<{
  tokens: TokenInfo[];
  earners: FeeEarner[];
  claimEvents: ClaimEvent[];
}> {
  const now = Date.now();
  const api = getBagsApi();

  // Check token cache
  if (tokenCache && now - tokenCache.timestamp < TOKEN_CACHE_DURATION) {
    // Return cached data with possibly fresh earners
    if (earnerCache && now - earnerCache.timestamp < EARNER_CACHE_DURATION) {
      return {
        tokens: tokenCache.data,
        earners: earnerCache.data,
        claimEvents: claimEventsCache?.data || [],
      };
    }
  }

  // If no API key, use sample Bags.fm data
  if (!api) {
    console.log("No BAGS_API_KEY configured, using sample Bags.fm tokens");
    const sampleTokens: TokenInfo[] = SAMPLE_BAGS_TOKENS.map((t, i) => ({
      mint: t.mint,
      name: t.name,
      symbol: t.symbol,
      imageUrl: t.imageUrl,
      price: Math.random() * 0.01,
      marketCap: (5 - i) * 100000 + Math.random() * 50000,
      volume24h: (5 - i) * 10000 + Math.random() * 5000,
      change24h: (Math.random() - 0.5) * 40,
      holders: Math.floor(Math.random() * 1000) + 100,
      lifetimeFees: (5 - i) * 50 + Math.random() * 25,
      creator: `BagsCreator${i}111111111111111111111111111111`,
    }));

    const sampleEarners: FeeEarner[] = sampleTokens.map((t, i) => ({
      rank: i + 1,
      username: `bags_earner_${i + 1}`,
      providerUsername: `bags_earner_${i + 1}`,
      provider: "twitter" as const,
      wallet: t.creator,
      lifetimeEarnings: t.lifetimeFees,
      earnings24h: t.lifetimeFees * 0.1,
      change24h: t.change24h,
      tokenCount: 1,
      topToken: t,
    }));

    tokenCache = { data: sampleTokens, timestamp: now };
    earnerCache = { data: sampleEarners, timestamp: now };

    return { tokens: sampleTokens, earners: sampleEarners, claimEvents: [] };
  }

  try {
    // Fetch data for known Bags.fm tokens
    const tokenMints = BAGS_FM_TOKEN_MINTS.length > 0
      ? BAGS_FM_TOKEN_MINTS
      : SAMPLE_BAGS_TOKENS.map(t => t.mint);

    console.log(`Fetching data for ${tokenMints.length} Bags.fm tokens`);

    // Process tokens and fetch Bags.fm data in parallel
    const enrichedData = await Promise.all(
      tokenMints.map(async (mint, index) => {
        const sampleToken = SAMPLE_BAGS_TOKENS[index] || {
          mint,
          name: `Token ${index + 1}`,
          symbol: `TKN${index + 1}`,
        };

        let creators: Array<{
          wallet: string;
          provider: string;
          providerUsername: string;
          username?: string;
          pfp?: string;
          isCreator?: boolean;
        }> = [];
        let lifetimeFees = 0;
        let totalClaimed = 0;
        let totalUnclaimed = 0;

        try {
          const [creatorsResult, feesResult] = await Promise.allSettled([
            api.getTokenCreators(mint),
            api.getTokenLifetimeFees(mint),
          ]);

          if (creatorsResult.status === "fulfilled") {
            creators = creatorsResult.value;
          }
          if (feesResult.status === "fulfilled") {
            lifetimeFees = feesResult.value.lifetimeFees;
            totalClaimed = feesResult.value.totalClaimed;
            totalUnclaimed = feesResult.value.totalUnclaimed;
          }
        } catch (err) {
          console.log(`Could not fetch Bags.fm data for ${mint}:`, err);
        }

        return {
          mint,
          sampleToken,
          creators,
          lifetimeFees,
          totalClaimed,
          totalUnclaimed,
        };
      })
    );

    // Build TokenInfo array from Bags.fm data
    const tokens: TokenInfo[] = enrichedData.map((data, i) => ({
      mint: data.mint,
      name: data.sampleToken.name,
      symbol: data.sampleToken.symbol,
      imageUrl: data.sampleToken.imageUrl,
      price: 0, // Would need price feed for this
      marketCap: data.lifetimeFees * 1000, // Estimate based on fees
      volume24h: data.totalUnclaimed > 0 ? data.totalUnclaimed * 10 : (5 - i) * 10000,
      change24h: (Math.random() - 0.5) * 20,
      holders: 0,
      lifetimeFees: data.lifetimeFees,
      creator: data.creators[0]?.wallet || "",
    }));

    // Build FeeEarner array from creators
    const earnerMap = new Map<string, FeeEarner>();
    let rank = 1;

    enrichedData.forEach((data, dataIndex) => {
      const token = tokens[dataIndex];

      data.creators.forEach((creator) => {
        if (creator.isCreator !== false) {
          const existing = earnerMap.get(creator.wallet);
          if (existing) {
            if (token.lifetimeFees > (existing.topToken?.lifetimeFees || 0)) {
              existing.topToken = token;
              existing.lifetimeEarnings += token.lifetimeFees;
            }
            existing.tokenCount++;
          } else {
            earnerMap.set(creator.wallet, buildFeeEarner(creator, token, rank++));
          }
        }
      });
    });

    // Convert map to array and sort by earnings
    let earners = Array.from(earnerMap.values())
      .sort((a, b) => b.lifetimeEarnings - a.lifetimeEarnings)
      .slice(0, 15)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // If no earners from API, use sample earners
    if (earners.length === 0) {
      earners = tokens.map((t, i) => ({
        rank: i + 1,
        username: `bags_creator_${i + 1}`,
        providerUsername: `bags_creator_${i + 1}`,
        provider: "twitter" as const,
        wallet: t.creator || `BagsCreator${i}111111111111111111111111111111`,
        lifetimeEarnings: t.lifetimeFees,
        earnings24h: t.lifetimeFees * 0.1,
        change24h: t.change24h,
        tokenCount: 1,
        topToken: t,
      }));
    }

    // Fetch claim events from Bags.fm API
    let claimEvents: ClaimEvent[] = [];
    if (
      !claimEventsCache ||
      now - claimEventsCache.timestamp > CLAIM_EVENTS_CACHE_DURATION
    ) {
      try {
        // Get claim events from active Bags.fm tokens
        const activeTokens = tokens.slice(0, 5);
        const eventPromises = activeTokens.map((t) =>
          api.getTokenClaimEvents(t.mint, 5).catch(() => [])
        );
        const eventResults = await Promise.all(eventPromises);
        claimEvents = eventResults
          .flat()
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 20);

        claimEventsCache = { data: claimEvents, timestamp: now };
      } catch (err) {
        claimEvents = claimEventsCache?.data || [];
      }
    } else {
      claimEvents = claimEventsCache?.data || [];
    }

    // Update caches
    tokenCache = { data: tokens, timestamp: now };
    earnerCache = { data: earners, timestamp: now };

    return { tokens, earners, claimEvents };
  } catch (error) {
    console.error("Error fetching Bags.fm token data:", error);
    // Return cached data on error
    return {
      tokens: tokenCache?.data || [],
      earners: earnerCache?.data || [],
      claimEvents: claimEventsCache?.data || [],
    };
  }
}

// Generate game events from Bags.fm claim events only
function generateEventsFromClaims(
  claimEvents: ClaimEvent[],
  tokens: TokenInfo[],
  existingEvents: GameEvent[]
): GameEvent[] {
  const events: GameEvent[] = [...existingEvents];
  const existingIds = new Set(existingEvents.map((e) => e.id));

  // Convert Bags.fm claim events to game events
  claimEvents.forEach((claim) => {
    const eventId = `bags-claim-${claim.signature}`;
    if (!existingIds.has(eventId)) {
      const token = tokens.find((t) => t.mint === claim.tokenMint);
      events.unshift({
        id: eventId,
        type: "fee_claim",
        message: `${claim.claimerUsername || claim.claimer.slice(0, 8)} claimed ${(claim.amount / 1e9).toFixed(2)} SOL from ${token?.symbol || "Bags token"}`,
        timestamp: claim.timestamp * 1000,
        data: {
          username: claim.claimerUsername || claim.claimer.slice(0, 8),
          tokenName: token?.name || "Bags.fm Token",
          amount: claim.amount / 1e9,
        },
      });
    }
  });

  // Add Bags.fm token activity events
  tokens.forEach((token) => {
    // Only show significant movements for Bags.fm tokens
    if (Math.abs(token.change24h) > 10) {
      const eventId = `bags-price-${token.mint}-${Math.floor(Date.now() / 60000)}`;
      if (!existingIds.has(eventId)) {
        const type = token.change24h > 0 ? "price_pump" : "price_dump";
        events.unshift({
          id: eventId,
          type,
          message:
            token.change24h > 0
              ? `${token.symbol} pumped ${token.change24h.toFixed(0)}% on Bags.fm!`
              : `${token.symbol} dropped ${Math.abs(token.change24h).toFixed(0)}% on Bags.fm`,
          timestamp: Date.now(),
          data: {
            tokenName: token.name,
            change: token.change24h,
          },
        });
      }
    }

    // Add fee milestone events for Bags.fm tokens
    if (token.lifetimeFees > 0) {
      const feeThresholds = [10, 50, 100, 500, 1000];
      for (const threshold of feeThresholds) {
        if (token.lifetimeFees >= threshold) {
          const eventId = `bags-milestone-${token.mint}-${threshold}`;
          if (!existingIds.has(eventId)) {
            events.unshift({
              id: eventId,
              type: "milestone",
              message: `${token.symbol} reached ${threshold} SOL in lifetime fees!`,
              timestamp: Date.now() - Math.random() * 86400000, // Random time in last 24h
              data: {
                tokenName: token.name,
                amount: threshold,
              },
            });
            break; // Only show highest reached milestone
          }
        }
      }
    }
  });

  // Keep only recent events and limit count
  return events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
}

export async function GET() {
  try {
    // Fetch live data in parallel with weather
    const [liveData, realWeather, timeInfo] = await Promise.all([
      fetchLiveTokenData(),
      fetchDCWeather(),
      Promise.resolve(getESTTimeInfo()),
    ]);

    const { tokens, earners, claimEvents } = liveData;

    // Build world state from live data
    const worldState = buildWorldState(
      earners,
      tokens,
      previousState ?? undefined
    );

    // Override weather with real DC weather
    worldState.weather = realWeather;

    // Add time info to world state for day/night cycle
    (worldState as WorldState & { timeInfo: typeof timeInfo }).timeInfo = timeInfo;

    // Generate events from real claim events
    worldState.events = generateEventsFromClaims(
      claimEvents,
      tokens,
      previousState?.events || []
    );

    previousState = worldState;

    return NextResponse.json(worldState);
  } catch (error) {
    console.error("Error fetching world state:", error);
    return NextResponse.json(
      { error: "Failed to fetch world state" },
      { status: 500 }
    );
  }
}
