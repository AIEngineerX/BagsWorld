// World State API - Token Launch Centric
// The world is built from user-launched tokens, not external discovery
// Each launched token becomes a building in BagsWorld

import { NextRequest, NextResponse } from "next/server";
import type {
  WorldState,
  FeeEarner,
  TokenInfo,
  GameEvent,
  ClaimEvent,
} from "@/lib/types";
import { buildWorldState } from "@/lib/world-calculator";
import { Connection, PublicKey } from "@solana/web3.js";

// Bags SDK types
interface TokenLaunchCreator {
  username: string;
  pfp: string;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider: string | null;
  providerUsername: string | null;
}

interface TokenClaimEventSDK {
  wallet: string;
  isCreator: boolean;
  amount: string;
  signature: string;
  timestamp: number;
}

// Lazy-loaded SDK instance
let sdkInstance: any = null;
let sdkInitPromise: Promise<any> | null = null;

async function getBagsSDK(): Promise<any | null> {
  if (!process.env.BAGS_API_KEY) {
    return null;
  }

  if (sdkInstance) {
    return sdkInstance;
  }

  if (sdkInitPromise) {
    return sdkInitPromise;
  }

  sdkInitPromise = (async () => {
    try {
      const { BagsSDK } = await import("@bagsfm/bags-sdk");
      const rpcUrl =
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      sdkInstance = new BagsSDK(
        process.env.BAGS_API_KEY!,
        connection,
        "processed"
      );
      console.log("Bags SDK initialized successfully");
      return sdkInstance;
    } catch (error) {
      console.error("Failed to initialize Bags SDK:", error);
      sdkInitPromise = null;
      return null;
    }
  })();

  return sdkInitPromise;
}

// Cache
interface DataCache<T> {
  data: T;
  timestamp: number;
}

let tokenCache: DataCache<TokenInfo[]> | null = null;
let earnerCache: DataCache<FeeEarner[]> | null = null;
let claimEventsCache: DataCache<ClaimEvent[]> | null = null;
let cachedWeather: { weather: WorldState["weather"]; fetchedAt: number } | null =
  null;

const TOKEN_CACHE_DURATION = 30 * 1000; // 30 seconds (faster refresh for launches)
const EARNER_CACHE_DURATION = 60 * 1000; // 1 minute
const WEATHER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CLAIM_EVENTS_CACHE_DURATION = 15 * 1000; // 15 seconds

let previousState: WorldState | null = null;

// Fetch real Washington DC weather directly from Open-Meteo
async function fetchDCWeather(): Promise<WorldState["weather"]> {
  try {
    if (
      cachedWeather &&
      Date.now() - cachedWeather.fetchedAt < WEATHER_CACHE_DURATION
    ) {
      return cachedWeather.weather;
    }

    // Fetch directly from Open-Meteo to avoid internal API call issues
    const DC_LAT = 38.9072;
    const DC_LON = -77.0369;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${DC_LAT}&longitude=${DC_LON}&current=weather_code,cloud_cover&timezone=America/New_York`;

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Weather API error");
    }

    const data = await response.json();
    const code = data.current.weather_code;
    const cloudCover = data.current.cloud_cover;

    // Convert to game weather
    let weather: WorldState["weather"] = "cloudy";
    if (code >= 95) weather = "storm";
    else if (code >= 51 || code >= 61 || code >= 71 || code >= 80) weather = "rain";
    else if (code === 3 || cloudCover > 70) weather = "cloudy";
    else if (code <= 2 && cloudCover < 30) weather = "sunny";

    cachedWeather = { weather, fetchedAt: Date.now() };

    return weather;
  } catch (error) {
    console.error("Error fetching DC weather:", error);
    return cachedWeather?.weather ?? "cloudy";
  }
}

// Get current EST time info
function getESTTimeInfo(): {
  hour: number;
  isNight: boolean;
  isDusk: boolean;
  isDawn: boolean;
} {
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
    isNight: estHour >= 20 || estHour < 6,
    isDusk: estHour >= 18 && estHour < 20,
    isDawn: estHour >= 6 && estHour < 8,
  };
}

// Registered token format (from client localStorage via POST)
interface RegisteredToken {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  creator: string;
  createdAt: number;
  feeShares?: Array<{
    provider: string;
    username: string;
    bps: number;
  }>;
}

// Build FeeEarner from SDK creator data
function buildFeeEarner(
  creator: TokenLaunchCreator,
  token: TokenInfo,
  rank: number
): FeeEarner {
  const displayName = creator.providerUsername || creator.username || "Unknown";

  return {
    rank,
    username: displayName,
    providerUsername: creator.providerUsername || displayName,
    provider: (creator.provider || "twitter") as FeeEarner["provider"],
    wallet: creator.wallet,
    avatarUrl: creator.pfp || undefined,
    lifetimeEarnings: token.lifetimeFees,
    earnings24h: token.lifetimeFees * 0.1, // Estimate
    change24h: 0,
    tokenCount: 1,
    topToken: token,
  };
}

// Convert registered token to TokenInfo with SDK enrichment
async function enrichTokenWithSDK(
  token: RegisteredToken,
  sdk: any | null
): Promise<{
  tokenInfo: TokenInfo;
  creators: TokenLaunchCreator[];
  claimEvents: ClaimEvent[];
}> {
  let lifetimeFees = 0;
  let creators: TokenLaunchCreator[] = [];
  let claimEvents: ClaimEvent[] = [];

  if (sdk) {
    try {
      const mintPubkey = new PublicKey(token.mint);

      const [creatorsResult, feesResult, eventsResult] =
        await Promise.allSettled([
          sdk.state.getTokenCreators(mintPubkey),
          sdk.state.getTokenLifetimeFees(mintPubkey),
          sdk.state.getTokenClaimEvents(mintPubkey, { limit: 5 }),
        ]);

      if (creatorsResult.status === "fulfilled") {
        creators = creatorsResult.value || [];
      }

      if (feesResult.status === "fulfilled") {
        lifetimeFees = feesResult.value || 0;
      }

      if (eventsResult.status === "fulfilled") {
        const rawEvents: TokenClaimEventSDK[] = eventsResult.value || [];
        claimEvents = rawEvents.map((e) => ({
          signature: e.signature,
          claimer: e.wallet,
          claimerUsername: undefined,
          amount: parseFloat(e.amount),
          timestamp: e.timestamp,
          tokenMint: token.mint,
        }));
      }
    } catch (error) {
      console.log(`Could not enrich token ${token.symbol}:`, error);
    }
  }

  // Build TokenInfo
  const tokenInfo: TokenInfo = {
    mint: token.mint,
    name: token.name,
    symbol: token.symbol,
    imageUrl: token.imageUrl,
    price: 0, // Would need price feed
    marketCap: lifetimeFees > 0 ? lifetimeFees * 1000 : 10000, // Estimate from fees
    volume24h: lifetimeFees > 0 ? lifetimeFees * 100 : 1000,
    change24h: 0,
    holders: 0,
    lifetimeFees,
    creator: token.creator,
  };

  return { tokenInfo, creators, claimEvents };
}

// Community Rewards wallet - always visible for transparency
const TREASURY_WALLET = "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC";

// Community Rewards Hub - ALWAYS appears in the world (permanent landmark)
// Links to Solscan so users can verify where community rewards come from
const TREASURY_BUILDING: RegisteredToken = {
  mint: "TreasuryBagsWorld1111111111111111111111111111",
  name: "Community Rewards Hub",
  symbol: "REWARDS",
  description: "Where fees become rewards - distributed to the strongest communities. Click to verify on Solscan!",
  imageUrl: "/assets/buildings/treasury.png",
  creator: TREASURY_WALLET,
  createdAt: Date.now() - 86400000 * 365, // 1 year ago (always been here)
};

// Starter buildings when no user tokens are registered
const STARTER_BUILDINGS: RegisteredToken[] = [
  {
    mint: "StarterWelcome111111111111111111111111111111",
    name: "Welcome Center",
    symbol: "WELCOME",
    description: "New to BagsWorld? Launch a token to build here!",
    imageUrl: "/assets/buildings/level-3.png",
    creator: "BagsWorld",
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
];

// Generate events from claim data and launches
function generateEvents(
  claimEvents: ClaimEvent[],
  tokens: TokenInfo[],
  existingEvents: GameEvent[]
): GameEvent[] {
  const events: GameEvent[] = [...existingEvents];
  const existingIds = new Set(existingEvents.map((e) => e.id));

  // Add claim events
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

  // Add fee milestone events
  tokens.forEach((token) => {
    if (token.lifetimeFees > 0) {
      const feeThresholds = [1, 5, 10, 50, 100, 500, 1000];
      for (const threshold of feeThresholds) {
        if (token.lifetimeFees >= threshold) {
          const eventId = `milestone-${token.mint}-${threshold}`;
          if (!existingIds.has(eventId)) {
            events.unshift({
              id: eventId,
              type: "milestone",
              message: `${token.symbol} reached ${threshold} SOL in lifetime fees!`,
              timestamp: Date.now() - Math.random() * 3600000,
              data: {
                tokenName: token.name,
                amount: threshold,
              },
            });
            break;
          }
        }
      }
    }
  });

  return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 25);
}

// POST - Get world state for specific tokens (token launch-centric)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const registeredTokens: RegisteredToken[] = body.tokens || [];

    const now = Date.now();
    const sdk = await getBagsSDK();

    // ALWAYS include Treasury building first (permanent landmark)
    // Then add user tokens, or starter buildings if no user tokens
    const userTokens = registeredTokens.length > 0 ? registeredTokens : STARTER_BUILDINGS;
    const tokensToProcess = [TREASURY_BUILDING, ...userTokens];

    console.log(`Processing ${tokensToProcess.length} buildings (1 treasury + ${userTokens.length} tokens)`);

    // Enrich all tokens with SDK data
    const enrichedResults = await Promise.all(
      tokensToProcess.map((token) => enrichTokenWithSDK(token, sdk))
    );

    // Build arrays
    const tokens: TokenInfo[] = enrichedResults.map((r) => r.tokenInfo);
    const allClaimEvents: ClaimEvent[] = enrichedResults
      .flatMap((r) => r.claimEvents)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    // Build fee earners from SDK creators AND registered fee shares
    const earnerMap = new Map<string, FeeEarner>();
    let rank = 1;

    // First, add creators from SDK data
    enrichedResults.forEach((result, index) => {
      const token = tokens[index];
      result.creators.forEach((creator) => {
        const existing = earnerMap.get(creator.wallet);
        if (existing) {
          existing.lifetimeEarnings += token.lifetimeFees;
          existing.tokenCount++;
          if (token.lifetimeFees > (existing.topToken?.lifetimeFees || 0)) {
            existing.topToken = token;
          }
        } else {
          earnerMap.set(creator.wallet, buildFeeEarner(creator, token, rank++));
        }
      });
    });

    // Then, add citizens from registered token fee shares (Twitter/X linked)
    tokensToProcess.forEach((registeredToken, index) => {
      const token = tokens[index];
      if (registeredToken.feeShares && registeredToken.feeShares.length > 0) {
        registeredToken.feeShares.forEach((share) => {
          // Skip ecosystem fee share - it's for the treasury, not a citizen
          if (share.provider === "ecosystem" || share.provider === "solana") {
            return;
          }

          // Create a unique ID from provider + username
          const uniqueId = `${share.provider}-${share.username}`;
          const existing = earnerMap.get(uniqueId);

          if (existing) {
            // Update existing earner
            existing.tokenCount++;
            if (token.lifetimeFees > (existing.topToken?.lifetimeFees || 0)) {
              existing.topToken = token;
            }
          } else {
            // Create new citizen from fee share
            const feeShareEarner: FeeEarner = {
              rank: rank++,
              username: share.username,
              providerUsername: share.username,
              provider: share.provider as FeeEarner["provider"],
              wallet: uniqueId, // Use unique ID as wallet placeholder
              avatarUrl: undefined, // Will be fetched by game if needed
              lifetimeEarnings: (token.lifetimeFees * share.bps) / 10000, // Proportional share
              earnings24h: 0,
              change24h: 0,
              tokenCount: 1,
              topToken: token,
            };
            earnerMap.set(uniqueId, feeShareEarner);
          }
        });
      }
    });

    let earners = Array.from(earnerMap.values())
      .sort((a, b) => b.lifetimeEarnings - a.lifetimeEarnings)
      .slice(0, 13) // Leave room for Satoshi and Ash
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // ALWAYS add Toly as a permanent Solana guide character
    // Toly (Anatoly Yakovenko) is the co-founder of Solana
    const toly: FeeEarner = {
      rank: 0, // Special rank
      username: "toly",
      providerUsername: "aeyakovenko",
      provider: "solana" as FeeEarner["provider"],
      wallet: "toly-solana-permanent",
      avatarUrl: undefined, // Will use special Toly sprite
      lifetimeEarnings: 65000, // ~65k TPS on Solana ;)
      earnings24h: 0,
      change24h: 0,
      tokenCount: 0,
      topToken: undefined,
      isToly: true, // Special flag for the game to recognize
    } as FeeEarner & { isToly: boolean };

    // ALWAYS add Ash as a permanent ecosystem guide character
    // Ash explains how BagsWorld works with Pokemon-themed analogies
    const ash: FeeEarner = {
      rank: 0, // Special rank
      username: "Ash",
      providerUsername: "ash_ketchum",
      provider: "pokemon" as FeeEarner["provider"],
      wallet: "ash-ketchum-permanent",
      avatarUrl: undefined, // Will use special Ash sprite
      lifetimeEarnings: 151, // Original 151 Pokemon ;)
      earnings24h: 0,
      change24h: 0,
      tokenCount: 0,
      topToken: undefined,
      isAsh: true, // Special flag for the game to recognize
    } as FeeEarner & { isAsh: boolean };

    earners.unshift(ash); // Ash second
    earners.unshift(toly); // Toly always first

    // Fetch weather and time
    const [realWeather, timeInfo] = await Promise.all([
      fetchDCWeather(),
      Promise.resolve(getESTTimeInfo()),
    ]);

    // Build world state
    const worldState = buildWorldState(earners, tokens, previousState ?? undefined);

    worldState.weather = realWeather;
    (worldState as WorldState & { timeInfo: typeof timeInfo }).timeInfo = timeInfo;

    // Generate events
    worldState.events = generateEvents(
      allClaimEvents,
      tokens,
      previousState?.events || []
    );

    // Add token launch events for new tokens
    tokens.forEach((token) => {
      const launchEventId = `launch-${token.mint}`;
      if (!worldState.events.some((e) => e.id === launchEventId)) {
        // Check if this is a "new" token (less than 24 hours old based on createdAt)
        const registeredToken = tokensToProcess.find((t) => t.mint === token.mint);
        if (registeredToken && Date.now() - registeredToken.createdAt < 86400000) {
          worldState.events.unshift({
            id: launchEventId,
            type: "token_launch",
            message: `${token.symbol} building constructed in BagsWorld!`,
            timestamp: registeredToken.createdAt,
            data: {
              tokenName: token.name,
              username: "Builder",
            },
          });
        }
      }
    });

    // Track building count for city growth
    (worldState as any).tokenCount = tokens.length;
    (worldState as any).sdkAvailable = !!sdk;

    previousState = worldState;

    return NextResponse.json(worldState);
  } catch (error) {
    console.error("Error building world state:", error);
    return NextResponse.json(
      { error: "Failed to build world state" },
      { status: 500 }
    );
  }
}

// GET - Basic world state (for initial load without tokens)
export async function GET() {
  try {
    // Use cached data if available
    const now = Date.now();
    if (
      tokenCache &&
      now - tokenCache.timestamp < TOKEN_CACHE_DURATION &&
      earnerCache
    ) {
      const [realWeather, timeInfo] = await Promise.all([
        fetchDCWeather(),
        Promise.resolve(getESTTimeInfo()),
      ]);

      const worldState = buildWorldState(
        earnerCache.data,
        tokenCache.data,
        previousState ?? undefined
      );

      worldState.weather = realWeather;
      (worldState as WorldState & { timeInfo: typeof timeInfo }).timeInfo = timeInfo;

      if (previousState) {
        worldState.events = previousState.events;
      }

      return NextResponse.json(worldState);
    }

    // Build from starter buildings
    const sdk = await getBagsSDK();
    const enrichedResults = await Promise.all(
      STARTER_BUILDINGS.map((token) => enrichTokenWithSDK(token, sdk))
    );

    const tokens: TokenInfo[] = enrichedResults.map((r) => r.tokenInfo);
    // No placeholder earners - only show real data from SDK
    const earners: FeeEarner[] = [];

    const [realWeather, timeInfo] = await Promise.all([
      fetchDCWeather(),
      Promise.resolve(getESTTimeInfo()),
    ]);

    const worldState = buildWorldState(earners, tokens, previousState ?? undefined);

    worldState.weather = realWeather;
    (worldState as WorldState & { timeInfo: typeof timeInfo }).timeInfo = timeInfo;

    // Add welcome message for empty world
    worldState.events = [
      {
        id: "welcome-message",
        type: "milestone",
        message: "Welcome to BagsWorld! Launch a token to build your first building!",
        timestamp: Date.now(),
        data: {},
      },
    ];

    // Update cache
    tokenCache = { data: tokens, timestamp: now };
    earnerCache = { data: earners, timestamp: now };

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
