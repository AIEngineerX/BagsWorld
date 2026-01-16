import { NextResponse } from "next/server";
import type {
  WorldState,
  FeeEarner,
  TokenInfo,
  GameEvent,
  ClaimEvent,
} from "@/lib/types";
import { buildWorldState } from "@/lib/world-calculator";
import { fetchTrendingTokens, DexToken } from "@/lib/dexscreener-api";
import { BagsApiClient } from "@/lib/bags-api";

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

// Convert DexScreener token to our TokenInfo format
function dexTokenToTokenInfo(
  dexToken: DexToken,
  lifetimeFees?: number,
  creatorWallet?: string
): TokenInfo {
  return {
    mint: dexToken.mint,
    name: dexToken.name,
    symbol: dexToken.symbol,
    imageUrl: dexToken.imageUrl,
    price: dexToken.price,
    marketCap: dexToken.marketCap,
    volume24h: dexToken.volume24h,
    change24h: dexToken.priceChange24h,
    holders: 0, // Not available from DexScreener
    lifetimeFees: lifetimeFees || 0,
    creator: creatorWallet || "",
  };
}

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

// Fetch live token data from DexScreener + Bags.fm
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

  try {
    // Fetch trending tokens from DexScreener
    const dexTokens = await fetchTrendingTokens();
    console.log(`Fetched ${dexTokens.length} tokens from DexScreener`);

    if (dexTokens.length === 0) {
      // Return cached data if no new data
      return {
        tokens: tokenCache?.data || [],
        earners: earnerCache?.data || [],
        claimEvents: claimEventsCache?.data || [],
      };
    }

    // Process tokens and fetch Bags.fm data in parallel
    const enrichedData = await Promise.all(
      dexTokens.map(async (dexToken) => {
        let creators: Array<{
          wallet: string;
          provider: string;
          providerUsername: string;
          username?: string;
          pfp?: string;
          isCreator?: boolean;
        }> = [];
        let lifetimeFees = 0;

        // Try to get Bags.fm data if API is configured
        if (api) {
          try {
            const [creatorsResult, feesResult] = await Promise.allSettled([
              api.getTokenCreators(dexToken.mint),
              api.getTokenLifetimeFees(dexToken.mint),
            ]);

            if (creatorsResult.status === "fulfilled") {
              creators = creatorsResult.value;
            }
            if (feesResult.status === "fulfilled") {
              lifetimeFees = feesResult.value.lifetimeFees;
            }
          } catch (err) {
            // Token might not be on Bags.fm, continue without enrichment
          }
        }

        return {
          dexToken,
          creators,
          lifetimeFees,
        };
      })
    );

    // Build TokenInfo array
    const tokens: TokenInfo[] = enrichedData.map((data) =>
      dexTokenToTokenInfo(
        data.dexToken,
        data.lifetimeFees,
        data.creators[0]?.wallet
      )
    );

    // Build FeeEarner array from creators
    const earnerMap = new Map<string, FeeEarner>();
    let rank = 1;

    enrichedData.forEach((data) => {
      const token = dexTokenToTokenInfo(
        data.dexToken,
        data.lifetimeFees,
        data.creators[0]?.wallet
      );

      data.creators.forEach((creator) => {
        if (creator.isCreator !== false) {
          // Include if creator or unknown
          const existing = earnerMap.get(creator.wallet);
          if (existing) {
            // Update existing earner with higher earnings token
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
    const earners = Array.from(earnerMap.values())
      .sort((a, b) => b.lifetimeEarnings - a.lifetimeEarnings)
      .slice(0, 15)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // Fetch claim events if API is available
    let claimEvents: ClaimEvent[] = [];
    if (
      api &&
      (!claimEventsCache ||
        now - claimEventsCache.timestamp > CLAIM_EVENTS_CACHE_DURATION)
    ) {
      try {
        // Get claim events from a few active tokens
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
    console.error("Error fetching live token data:", error);
    // Return cached data on error
    return {
      tokens: tokenCache?.data || [],
      earners: earnerCache?.data || [],
      claimEvents: claimEventsCache?.data || [],
    };
  }
}

// Generate game events from claim events
function generateEventsFromClaims(
  claimEvents: ClaimEvent[],
  tokens: TokenInfo[],
  existingEvents: GameEvent[]
): GameEvent[] {
  const events: GameEvent[] = [...existingEvents];
  const existingIds = new Set(existingEvents.map((e) => e.id));

  // Convert claim events to game events
  claimEvents.forEach((claim) => {
    const eventId = `claim-${claim.signature}`;
    if (!existingIds.has(eventId)) {
      const token = tokens.find((t) => t.mint === claim.tokenMint);
      events.unshift({
        id: eventId,
        type: "fee_claim",
        message: `${claim.claimerUsername || claim.claimer.slice(0, 8)} claimed ${(claim.amount / 1e9).toFixed(2)} SOL from ${token?.symbol || "token"}`,
        timestamp: claim.timestamp * 1000,
        data: {
          username: claim.claimerUsername || claim.claimer.slice(0, 8),
          tokenName: token?.name,
          amount: claim.amount / 1e9,
        },
      });
    }
  });

  // Add price movement events for significant changes
  tokens.forEach((token) => {
    if (Math.abs(token.change24h) > 10) {
      const eventId = `price-${token.mint}-${Math.floor(Date.now() / 60000)}`;
      if (!existingIds.has(eventId)) {
        const type = token.change24h > 0 ? "price_pump" : "price_dump";
        events.unshift({
          id: eventId,
          type,
          message:
            token.change24h > 0
              ? `${token.symbol} pumped ${token.change24h.toFixed(0)}%!`
              : `${token.symbol} dropped ${Math.abs(token.change24h).toFixed(0)}%`,
          timestamp: Date.now(),
          data: {
            tokenName: token.name,
            change: token.change24h,
          },
        });
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
