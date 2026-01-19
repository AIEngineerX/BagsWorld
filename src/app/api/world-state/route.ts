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
import { getTokensByMints, type DexPair } from "@/lib/dexscreener-api";

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
        "https://rpc.ankr.com/solana";
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
const PRICE_CACHE_DURATION = 60 * 1000; // 60 seconds for DexScreener rate limits

let previousState: WorldState | null = null;

// Price cache for DexScreener data
interface PriceData {
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  liquidity: number;
}
let priceCache: DataCache<Map<string, PriceData>> | null = null;

// Fetch real prices from DexScreener for all token mints
async function fetchTokenPrices(mints: string[]): Promise<Map<string, PriceData>> {
  // Filter out placeholder/permanent building mints (they start with "Treasury" or "Starter")
  const realMints = mints.filter(
    (m) => !m.startsWith("Treasury") && !m.startsWith("Starter")
  );

  if (realMints.length === 0) {
    return new Map();
  }

  // Check cache first
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_DURATION) {
    return priceCache.data;
  }

  try {
    console.log(`Fetching DexScreener prices for ${realMints.length} tokens...`);
    const pairs = await getTokensByMints(realMints);

    // Build price map - use the most liquid pair for each token
    const priceMap = new Map<string, PriceData>();
    const pairsByMint = new Map<string, DexPair[]>();

    // Group pairs by base token mint
    for (const pair of pairs) {
      if (!pair?.baseToken?.address) continue;
      const mint = pair.baseToken.address;
      if (!pairsByMint.has(mint)) {
        pairsByMint.set(mint, []);
      }
      pairsByMint.get(mint)!.push(pair);
    }

    // Select the most liquid pair for each token
    for (const [mint, tokenPairs] of pairsByMint) {
      const bestPair = tokenPairs.reduce((best, current) => {
        const currentLiquidity = current.liquidity?.usd || 0;
        const bestLiquidity = best.liquidity?.usd || 0;
        return currentLiquidity > bestLiquidity ? current : best;
      });

      priceMap.set(mint, {
        price: parseFloat(bestPair.priceUsd) || 0,
        marketCap: bestPair.marketCap || bestPair.fdv || 0,
        volume24h: bestPair.volume?.h24 || 0,
        change24h: bestPair.priceChange?.h24 || 0,
        liquidity: bestPair.liquidity?.usd || 0,
      });
    }

    console.log(`DexScreener: Got prices for ${priceMap.size}/${realMints.length} tokens`);

    // Update cache
    priceCache = { data: priceMap, timestamp: now };
    return priceMap;
  } catch (error) {
    console.error("Error fetching DexScreener prices:", error);
    // Return cached data if available, even if stale
    return priceCache?.data || new Map();
  }
}

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

    // Convert to game weather based on Open-Meteo weather codes
    // https://open-meteo.com/en/docs - WMO Weather interpretation codes
    // 0-3: Clear/Cloudy, 51-57: Drizzle, 61-67: Rain, 71-77: Snow, 80-82: Showers, 95-99: Thunderstorm
    let weather: WorldState["weather"] = "cloudy";
    if (code >= 95) weather = "storm";
    else if (code >= 51) weather = "rain"; // All precipitation codes (drizzle, rain, snow, showers)
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
  rank: number,
  earnings24h: number = 0
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
    earnings24h, // Real 24h earnings from claim events
    change24h: 0,
    tokenCount: 1,
    topToken: token,
  };
}

// Calculate 24h earnings per wallet from claim events
function calculate24hEarningsPerWallet(
  claimEvents24h: ClaimEvent[]
): Map<string, number> {
  const earningsMap = new Map<string, number>();

  for (const event of claimEvents24h) {
    const wallet = event.claimer;
    const currentEarnings = earningsMap.get(wallet) || 0;
    // Amount is in lamports, convert to SOL
    const amountInSol = event.amount / 1e9;
    earningsMap.set(wallet, currentEarnings + amountInSol);
  }

  return earningsMap;
}

// Convert registered token to TokenInfo with SDK enrichment
async function enrichTokenWithSDK(
  token: RegisteredToken,
  sdk: any | null
): Promise<{
  tokenInfo: TokenInfo;
  creators: TokenLaunchCreator[];
  claimEvents: ClaimEvent[];
  claimEvents24h: ClaimEvent[];
}> {
  let lifetimeFees = 0;
  let creators: TokenLaunchCreator[] = [];
  let claimEvents: ClaimEvent[] = [];
  let claimEvents24h: ClaimEvent[] = [];

  if (sdk) {
    try {
      const mintPubkey = new PublicKey(token.mint);

      // Calculate 24h time range for claim events
      const now = Math.floor(Date.now() / 1000);
      const twentyFourHoursAgo = now - 24 * 60 * 60;

      const [creatorsResult, feesResult, eventsResult, events24hResult] =
        await Promise.allSettled([
          sdk.state.getTokenCreators(mintPubkey),
          sdk.state.getTokenLifetimeFees(mintPubkey),
          sdk.state.getTokenClaimEvents(mintPubkey, { limit: 5 }),
          // Fetch 24h claim events using time-based filtering (Bags API v1.2.0+)
          sdk.state.getTokenClaimEvents(mintPubkey, {
            mode: "time",
            from: twentyFourHoursAgo,
            to: now,
          }),
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

      if (events24hResult.status === "fulfilled") {
        const rawEvents24h: TokenClaimEventSDK[] = events24hResult.value || [];
        claimEvents24h = rawEvents24h.map((e) => ({
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
  // Market cap, price, volume, change will be filled in by DexScreener data later
  // For permanent buildings (Treasury, PokeCenter), show max level
  const isPermanentBuilding = token.mint.startsWith("Treasury") || token.mint.startsWith("Starter");

  const tokenInfo: TokenInfo = {
    mint: token.mint,
    name: token.name,
    symbol: token.symbol,
    imageUrl: token.imageUrl,
    price: 0, // Filled by DexScreener
    marketCap: isPermanentBuilding ? 50_000_000 : 0, // Filled by DexScreener for real tokens
    volume24h: 0, // Filled by DexScreener
    change24h: 0, // Filled by DexScreener
    holders: 0,
    lifetimeFees,
    creator: token.creator,
  };

  return { tokenInfo, creators, claimEvents, claimEvents24h };
}

// Ecosystem rewards wallet - always visible for transparency
const TREASURY_WALLET = "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC";

// Creator Rewards Hub - ALWAYS appears in the world (permanent landmark)
// Links to Solscan so users can verify the creator rewards system
const TREASURY_BUILDING: RegisteredToken = {
  mint: "TreasuryBagsWorld1111111111111111111111111111",
  name: "Creator Rewards Hub",
  symbol: "REWARDS",
  description: "Top 3 creators get paid. 10 SOL threshold or 5 days. 50/30/20 split. Click to verify on Solscan!",
  imageUrl: "/assets/buildings/treasury.png",
  creator: TREASURY_WALLET,
  createdAt: Date.now() - 86400000 * 365, // 1 year ago (always been here)
};

// Starter buildings when no user tokens are registered
const STARTER_BUILDINGS: RegisteredToken[] = [
  {
    mint: "StarterPokeCenter11111111111111111111111111",
    name: "PokeCenter",
    symbol: "POKECENTER",
    description: "Welcome trainer! This is where citizens rest and recover. Launch a token to build your own building in BagsWorld!",
    imageUrl: "/assets/buildings/pokecenter.png",
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

    // ALWAYS include Treasury building and PokeCenter (permanent landmarks)
    // Then add any user tokens
    const permanentBuildings = [TREASURY_BUILDING, ...STARTER_BUILDINGS];
    const tokensToProcess = [...permanentBuildings, ...registeredTokens];

    console.log(`Processing ${tokensToProcess.length} buildings (${permanentBuildings.length} permanent + ${registeredTokens.length} user tokens)`);

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

    // Fetch REAL prices from DexScreener and merge into tokens
    const allMints = tokens.map((t) => t.mint);
    const priceData = await fetchTokenPrices(allMints);

    // Merge real price data into tokens
    for (const token of tokens) {
      const prices = priceData.get(token.mint);
      if (prices) {
        token.price = prices.price;
        token.marketCap = prices.marketCap;
        token.volume24h = prices.volume24h;
        token.change24h = prices.change24h;
        console.log(`${token.symbol}: Real market cap = $${prices.marketCap.toLocaleString()}`);
      }
    }

    // Aggregate all 24h claim events and calculate earnings per wallet
    const allClaimEvents24h: ClaimEvent[] = enrichedResults.flatMap((r) => r.claimEvents24h);
    const earnings24hPerWallet = calculate24hEarningsPerWallet(allClaimEvents24h);

    console.log(`Found ${allClaimEvents24h.length} claim events in last 24h across ${tokens.length} tokens`);

    // Build fee earners from SDK creators AND registered fee shares
    const earnerMap = new Map<string, FeeEarner>();
    let rank = 1;

    // First, add creators from SDK data
    enrichedResults.forEach((result, index) => {
      const token = tokens[index];
      result.creators.forEach((creator) => {
        const existing = earnerMap.get(creator.wallet);
        // Get real 24h earnings for this wallet from claim events
        const walletEarnings24h = earnings24hPerWallet.get(creator.wallet) || 0;

        if (existing) {
          existing.lifetimeEarnings += token.lifetimeFees;
          existing.earnings24h += walletEarnings24h; // Add real 24h earnings
          existing.tokenCount++;
          if (token.lifetimeFees > (existing.topToken?.lifetimeFees || 0)) {
            existing.topToken = token;
          }
        } else {
          earnerMap.set(creator.wallet, buildFeeEarner(creator, token, rank++, walletEarnings24h));
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

          // Create a unique ID from provider + username (normalized to lowercase)
          const uniqueId = `${share.provider}-${share.username.toLowerCase()}`;
          const existing = earnerMap.get(uniqueId);

          if (existing) {
            // Update existing earner - aggregate earnings from multiple tokens
            existing.tokenCount++;
            existing.lifetimeEarnings += (token.lifetimeFees * share.bps) / 10000; // Add proportional share
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

    // ALWAYS add Finn as the Bags.fm founder guide
    // Finn (@finnbags) is the CEO of Bags.fm
    const finn: FeeEarner = {
      rank: 0, // Special rank
      username: "Finn",
      providerUsername: "finnbags",
      provider: "twitter" as FeeEarner["provider"],
      wallet: "finnbags-ceo-permanent",
      avatarUrl: undefined, // Will use special Finn sprite
      lifetimeEarnings: 1000000000, // $1B+ volume on Bags.fm!
      earnings24h: 0,
      change24h: 0,
      tokenCount: 0,
      topToken: undefined,
      isFinn: true, // Special flag for the game to recognize
    } as FeeEarner & { isFinn: boolean };

    // ALWAYS add The Dev (DaddyGhost) as the trading agent character
    // DaddyGhost (@DaddyGhost) is the developer who built BagsWorld
    const dev: FeeEarner = {
      rank: 0, // Special rank
      username: "The Dev",
      providerUsername: "DaddyGhost",
      provider: "twitter" as FeeEarner["provider"],
      wallet: "daddyghost-dev-permanent",
      avatarUrl: undefined, // Will use special dev sprite
      lifetimeEarnings: 420690, // Trencher numbers
      earnings24h: 0,
      change24h: 0,
      tokenCount: 0,
      topToken: undefined,
      isDev: true, // Special flag for the game to recognize
    } as FeeEarner & { isDev: boolean };

    // ALWAYS add Neo as the Scout Agent character
    // Neo sees the blockchain like he sees The Matrix - scanning for new launches
    const scout: FeeEarner = {
      rank: 0, // Special rank
      username: "Neo",
      providerUsername: "TheOne",
      provider: "twitter" as FeeEarner["provider"],
      wallet: "scout-agent-permanent",
      avatarUrl: undefined, // Will use special Neo sprite
      lifetimeEarnings: 1999, // The Matrix release year
      earnings24h: 0,
      change24h: 0,
      tokenCount: 0,
      topToken: undefined,
      isScout: true, // Special flag for the game to recognize
    } as FeeEarner & { isScout: boolean };

    earners.unshift(scout); // Neo fifth
    earners.unshift(dev); // The Dev fourth
    earners.unshift(finn); // Finn third
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
