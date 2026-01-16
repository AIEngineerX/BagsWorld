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
import { fetchTrendingTokens, DexToken } from "@/lib/dexscreener-api";

// Known Bags.fm token mints - add real Bags.fm token addresses here
// These get priority display in the game
const BAGS_FM_TOKEN_MINTS: string[] = [
  // Real Bags.fm tokens will be added here as they're discovered
  // The system will also discover Bags.fm tokens by checking DexScreener tokens
  // against the Bags.fm API for creator data
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

// Convert DexScreener token to our TokenInfo format
function dexTokenToTokenInfo(
  dexToken: DexToken,
  lifetimeFees?: number,
  creatorWallet?: string,
  isBagsFm?: boolean
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
    holders: 0,
    lifetimeFees: lifetimeFees || 0,
    creator: creatorWallet || "",
  };
}

// Fetch live token data - discovers tokens via DexScreener, enriches with Bags.fm data
async function fetchLiveTokenData(): Promise<{
  tokens: TokenInfo[];
  earners: FeeEarner[];
  claimEvents: ClaimEvent[];
}> {
  const now = Date.now();
  const api = getBagsApi();

  // Check token cache
  if (tokenCache && now - tokenCache.timestamp < TOKEN_CACHE_DURATION) {
    if (earnerCache && now - earnerCache.timestamp < EARNER_CACHE_DURATION) {
      return {
        tokens: tokenCache.data,
        earners: earnerCache.data,
        claimEvents: claimEventsCache?.data || [],
      };
    }
  }

  try {
    // Step 1: Discover tokens from DexScreener
    const dexTokens = await fetchTrendingTokens();
    console.log(`Discovered ${dexTokens.length} tokens from DexScreener`);

    if (dexTokens.length === 0) {
      // Fallback to sample data if DexScreener fails
      console.log("No tokens from DexScreener, using sample data");
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

    // Step 2: For each token, try to get Bags.fm creator data
    // Tokens with Bags.fm creators are Bags.fm-launched tokens
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
        let isBagsFmToken = false;

        // Try to get Bags.fm data if API is configured
        if (api) {
          try {
            const [creatorsResult, feesResult] = await Promise.allSettled([
              api.getTokenCreators(dexToken.mint),
              api.getTokenLifetimeFees(dexToken.mint),
            ]);

            if (creatorsResult.status === "fulfilled" && creatorsResult.value.length > 0) {
              creators = creatorsResult.value;
              isBagsFmToken = true; // Has Bags.fm creators = Bags.fm token!
            }
            if (feesResult.status === "fulfilled") {
              lifetimeFees = feesResult.value.lifetimeFees || 0;
            }
          } catch {
            // Token might not be on Bags.fm - that's ok
          }
        }

        return {
          dexToken,
          creators,
          lifetimeFees,
          isBagsFmToken,
        };
      })
    );

    // Step 3: Build TokenInfo array - prioritize Bags.fm tokens
    const bagsFmTokens = enrichedData.filter((d) => d.isBagsFmToken);
    const otherTokens = enrichedData.filter((d) => !d.isBagsFmToken);

    // Show Bags.fm tokens first, then fill with other popular tokens
    const orderedData = [...bagsFmTokens, ...otherTokens].slice(0, 15);

    console.log(`Found ${bagsFmTokens.length} Bags.fm tokens out of ${enrichedData.length} total`);

    const tokens: TokenInfo[] = orderedData.map((data) =>
      dexTokenToTokenInfo(
        data.dexToken,
        data.lifetimeFees,
        data.creators[0]?.wallet,
        data.isBagsFmToken
      )
    );

    // Step 4: Build FeeEarner array from Bags.fm creators
    const earnerMap = new Map<string, FeeEarner>();
    let rank = 1;

    orderedData.forEach((data) => {
      if (!data.isBagsFmToken) return; // Only count Bags.fm creators

      const token = dexTokenToTokenInfo(
        data.dexToken,
        data.lifetimeFees,
        data.creators[0]?.wallet,
        true
      );

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

    // Convert earners map to sorted array
    let earners = Array.from(earnerMap.values())
      .sort((a, b) => b.lifetimeEarnings - a.lifetimeEarnings)
      .slice(0, 15)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // If no Bags.fm earners, create sample earners from top tokens
    if (earners.length === 0) {
      earners = tokens.slice(0, 5).map((t, i) => ({
        rank: i + 1,
        username: `trader_${t.symbol.toLowerCase()}`,
        providerUsername: `trader_${t.symbol.toLowerCase()}`,
        provider: "twitter" as const,
        wallet: t.creator || `Trader${i}11111111111111111111111111111111`,
        avatarUrl: t.imageUrl,
        lifetimeEarnings: t.volume24h * 0.01, // Estimate from volume
        earnings24h: t.volume24h * 0.001,
        change24h: t.change24h,
        tokenCount: 1,
        topToken: t,
      }));
    }

    // Step 5: Fetch claim events from Bags.fm tokens
    let claimEvents: ClaimEvent[] = [];
    if (
      api &&
      bagsFmTokens.length > 0 &&
      (!claimEventsCache || now - claimEventsCache.timestamp > CLAIM_EVENTS_CACHE_DURATION)
    ) {
      try {
        const bagsFmMints = bagsFmTokens.slice(0, 5).map((t) => t.dexToken.mint);
        const eventPromises = bagsFmMints.map((mint) =>
          api.getTokenClaimEvents(mint, 5).catch(() => [])
        );
        const eventResults = await Promise.all(eventPromises);
        claimEvents = eventResults
          .flat()
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 20);

        claimEventsCache = { data: claimEvents, timestamp: now };
      } catch {
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
    console.error("Error fetching token data:", error);
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
