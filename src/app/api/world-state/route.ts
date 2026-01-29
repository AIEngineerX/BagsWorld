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
  ZoneType,
} from "@/lib/types";
import {
  buildWorldState,
  type BagsHealthMetrics,
  type BagsWorldHolder,
} from "@/lib/world-calculator";
import { Connection, PublicKey } from "@solana/web3.js";
import { getTokensByMints, type DexPair } from "@/lib/dexscreener-api";
import { emitEvent, startCoordinator, type AgentEventType } from "@/lib/agent-coordinator";
import {
  getGlobalTokens,
  isNeonConfigured,
  batchUpdateBuildingHealth,
  recordMilestoneAchievement,
  getEventsClearedTimestamp,
  setEventsClearedTimestamp,
  type GlobalToken,
} from "@/lib/neon";
import { LAMPORTS_PER_SOL, lamportsToSol, formatSol } from "@/lib/solana-utils";

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

interface BagsSDKInstance {
  state: {
    getTokenCreators(mint: PublicKey): Promise<TokenLaunchCreator[]>;
    getTokenLifetimeFees(mint: PublicKey): Promise<number>;
    getTokenClaimEvents(
      mint: PublicKey,
      options?: { limit?: number; startTime?: number }
    ): Promise<TokenClaimEventSDK[]>;
  };
}

function safeParseClaimAmount(amount: string | number | undefined): number {
  if (amount === undefined || amount === null) return 0;
  const parsed = typeof amount === "number" ? amount : parseFloat(amount);
  return isNaN(parsed) ? 0 : parsed;
}

// Lazy-loaded SDK instance with proper mutex to prevent race conditions
let sdkInstance: BagsSDKInstance | null = null;
let sdkInitPromise: Promise<BagsSDKInstance | null> | null = null;
let sdkInitFailed = false;
let sdkFailedAt = 0;
const SDK_RETRY_DELAY = 5000; // Wait 5 seconds before retrying after failure

async function getBagsSDK(): Promise<BagsSDKInstance | null> {
  if (!process.env.BAGS_API_KEY) {
    return null;
  }

  // Return cached instance if available
  if (sdkInstance) {
    return sdkInstance;
  }

  // If init failed recently, don't retry immediately (prevents cascading failures)
  if (sdkInitFailed && Date.now() - sdkFailedAt < SDK_RETRY_DELAY) {
    return null;
  }

  // If initialization is in progress, wait for it
  if (sdkInitPromise) {
    return sdkInitPromise;
  }

  // Start initialization
  sdkInitPromise = (async () => {
    try {
      const { BagsSDK } = await import("@bagsfm/bags-sdk");
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana";
      const connection = new Connection(rpcUrl, "confirmed");
      sdkInstance = new BagsSDK(process.env.BAGS_API_KEY!, connection, "processed");
      sdkInitFailed = false;
      return sdkInstance;
    } catch {
      sdkInitFailed = true;
      sdkFailedAt = Date.now();
      return null;
    } finally {
      // Clear promise so future calls can retry (after delay if failed)
      sdkInitPromise = null;
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
let cachedWeather: { weather: WorldState["weather"]; fetchedAt: number } | null = null;

const TOKEN_CACHE_DURATION = 30 * 1000; // 30 seconds (faster refresh for launches)
const EARNER_CACHE_DURATION = 60 * 1000; // 1 minute
const WEATHER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CLAIM_EVENTS_CACHE_DURATION = 15 * 1000; // 15 seconds
const PRICE_CACHE_DURATION = 60 * 1000; // 60 seconds for DexScreener rate limits
const EVENT_EXPIRY_DURATION = 60 * 60 * 1000; // 1 hour - auto-expire old events

let previousState: WorldState | null = null;

// Local cache for cleared timestamp (fallback for non-DB environments)
let eventsClearedAfterLocal: number = 0;

// Clear all feed events (admin function) - stores in database for global effect
export async function clearFeedEvents(): Promise<void> {
  const timestamp = Date.now();
  eventsClearedAfterLocal = timestamp;

  // Store in database for persistence across serverless instances
  if (isNeonConfigured()) {
    await setEventsClearedTimestamp(timestamp);
  }

  if (previousState) {
    previousState.events = [];
  }
  console.log("[WorldState] Feed events cleared by admin at", timestamp);
}

// Get the clear timestamp (for filtering in generateEvents) - checks database
export async function getEventsClearedAfter(): Promise<number> {
  // Check database first for global timestamp
  if (isNeonConfigured()) {
    const dbTimestamp = await getEventsClearedTimestamp();
    if (dbTimestamp > eventsClearedAfterLocal) {
      eventsClearedAfterLocal = dbTimestamp; // Update local cache
    }
  }
  return eventsClearedAfterLocal;
}

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
  const realMints = mints.filter((m) => !m.startsWith("Treasury") && !m.startsWith("Starter"));

  if (realMints.length === 0) {
    return new Map();
  }

  // Check cache first
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_DURATION) {
    return priceCache.data;
  }

  try {
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

    // Update cache
    priceCache = { data: priceMap, timestamp: now };
    return priceMap;
  } catch {
    // Return cached data if available, even if stale
    return priceCache?.data || new Map();
  }
}

// Cache for BagsWorld top holders (2 minutes - shorter for faster sync)
let holdersCache: { data: BagsWorldHolder[]; timestamp: number } | null = null;
const HOLDERS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Fetch top BagsWorld token holders for Ballers Valley
async function fetchBagsWorldHolders(): Promise<BagsWorldHolder[]> {
  const now = Date.now();

  // Return cached data if fresh AND has data (don't cache empty results)
  if (
    holdersCache &&
    holdersCache.data.length > 0 &&
    now - holdersCache.timestamp < HOLDERS_CACHE_DURATION
  ) {
    console.log("[WorldState] Using cached holders:", holdersCache.data.length);
    return holdersCache.data;
  }

  try {
    // Get the base URL for internal API calls
    // Netlify provides multiple URL env vars - check them in order of preference
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.URL ||
      process.env.DEPLOY_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/bagsworld-holders`, {
      cache: "no-store", // Always fetch fresh data
    });

    if (response.ok) {
      const data = await response.json();
      console.log("[WorldState] Raw holders response:", JSON.stringify(data).substring(0, 200));
      const holders: BagsWorldHolder[] = (data.holders || []).slice(0, 5);
      console.log(
        "[WorldState] Fetched holders:",
        holders.length,
        holders.map((h) => h.rank)
      );

      // Check if we got REAL holders (not placeholder data)
      const isRealData =
        holders.length > 0 && holders[0]?.address && !holders[0].address.includes("xxxx"); // Placeholder addresses contain "xxxx"

      if (isRealData) {
        holdersCache = { data: holders, timestamp: now };
        return holders;
      } else {
        console.log("[WorldState] Got placeholder data from holders API, clearing cache");
        holdersCache = null; // Clear cache to retry next time
      }
      // Fall through to placeholder data
    } else {
      console.warn("[WorldState] Holders API returned:", response.status);
    }
  } catch (err) {
    console.warn("[WorldState] Failed to fetch BagsWorld holders:", err);
  }

  // If we still have no holders, use placeholder data for development
  console.log("[WorldState] Using placeholder holders - API unavailable");
  const placeholderHolders: BagsWorldHolder[] = [
    {
      address: "BaGs1WhaLeHoLderxxxxxxxxxxxxxxxxxxxxxxxxx",
      balance: 12500000,
      percentage: 28.5,
      rank: 1,
    },
    {
      address: "BaGs2BiGHoLderxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      balance: 6200000,
      percentage: 14.2,
      rank: 2,
    },
    {
      address: "BaGs3HoLderxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      balance: 3800000,
      percentage: 8.7,
      rank: 3,
    },
    {
      address: "BaGs4HoLderxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      balance: 2100000,
      percentage: 4.8,
      rank: 4,
    },
    {
      address: "BaGs5HoLderxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      balance: 1400000,
      percentage: 3.2,
      rank: 5,
    },
  ];
  holdersCache = { data: placeholderHolders, timestamp: now };
  return placeholderHolders;
}

// Background weather fetch (non-blocking)
let weatherFetchInProgress = false;

function fetchWeatherInBackground(): void {
  if (weatherFetchInProgress) return;
  weatherFetchInProgress = true;

  const DC_LAT = 38.9072;
  const DC_LON = -77.0369;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${DC_LAT}&longitude=${DC_LON}&current=weather_code,cloud_cover&timezone=America/New_York`;

  fetch(url, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Weather API error");
      return response.json();
    })
    .then((data) => {
      const code = data.current.weather_code;
      const cloudCover = data.current.cloud_cover;

      let weather: WorldState["weather"] = "cloudy";
      if (code >= 95) weather = "storm";
      else if (code >= 51) weather = "rain";
      else if (code === 3 || cloudCover > 70) weather = "cloudy";
      else if (code <= 2 && cloudCover < 30) weather = "sunny";

      cachedWeather = { weather, fetchedAt: Date.now() };
    })
    .catch((err) => {
      // Log error but keep using cached data (non-critical feature)
      console.warn("[Weather] Background fetch failed, using cached data:", err.message || err);
    })
    .finally(() => {
      weatherFetchInProgress = false;
    });
}

// Get weather instantly (non-blocking) - uses cache, triggers background refresh if stale
function getWeatherNonBlocking(): WorldState["weather"] {
  const now = Date.now();

  // If cache is stale, trigger background fetch
  if (!cachedWeather || now - cachedWeather.fetchedAt >= WEATHER_CACHE_DURATION) {
    fetchWeatherInBackground();
  }

  // Always return immediately with cached or default value
  return cachedWeather?.weather ?? "cloudy";
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
  // Admin controls
  levelOverride?: number | null;
  positionOverride?: { x: number; y: number } | null;
  styleOverride?: number | null;
  healthOverride?: number | null;
  zoneOverride?: ZoneType | null;
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
function calculate24hEarningsPerWallet(claimEvents24h: ClaimEvent[]): Map<string, number> {
  const earningsMap = new Map<string, number>();

  for (const event of claimEvents24h) {
    const wallet = event.claimer;
    const currentEarnings = earningsMap.get(wallet) || 0;
    const amountInSol = lamportsToSol(event.amount);
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

  // Skip SDK enrichment for placeholder/permanent buildings (they have fake mints)
  const isPlaceholderMint = token.mint.startsWith("Treasury") || token.mint.startsWith("Starter");

  if (sdk && !isPlaceholderMint) {
    try {
      const mintPubkey = new PublicKey(token.mint);

      // Calculate 24h time range for claim events
      const now = Math.floor(Date.now() / 1000);
      const twentyFourHoursAgo = now - 24 * 60 * 60;

      const [creatorsResult, feesResult, eventsResult, events24hResult] = await Promise.allSettled([
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
        // SDK returns lamports, convert to SOL for storage and display
        lifetimeFees = lamportsToSol(feesResult.value || 0);
      }

      if (eventsResult.status === "fulfilled") {
        const rawEvents: TokenClaimEventSDK[] = eventsResult.value || [];
        claimEvents = rawEvents.map((e) => ({
          signature: e.signature,
          claimer: e.wallet,
          claimerUsername: undefined,
          amount: safeParseClaimAmount(e.amount),
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
          amount: safeParseClaimAmount(e.amount),
          timestamp: e.timestamp,
          tokenMint: token.mint,
        }));
      }
    } catch {
      // Token enrichment failed, continue with defaults
    }
  }

  // Build TokenInfo
  // Market cap, price, volume, change will be filled in by DexScreener data later
  // Permanent buildings (Treasury, PokeCenter) are UI landmarks, not real tokens
  const isPermanentBuilding = token.mint.startsWith("Treasury") || token.mint.startsWith("Starter");

  const tokenInfo: TokenInfo = {
    mint: token.mint,
    name: token.name,
    symbol: token.symbol,
    imageUrl: token.imageUrl,
    price: 0, // Filled by DexScreener for real tokens
    marketCap: 0, // Filled by DexScreener for real tokens (permanent buildings use levelOverride)
    volume24h: 0, // Filled by DexScreener
    change24h: 0, // Filled by DexScreener
    holders: 0,
    lifetimeFees,
    creator: token.creator,
    levelOverride: isPermanentBuilding ? 5 : token.levelOverride, // Permanent buildings show max level
    isPermanent: isPermanentBuilding, // Mark as non-real token (UI landmark)
    positionOverride: token.positionOverride,
    styleOverride: token.styleOverride,
    healthOverride: token.healthOverride,
  };

  return { tokenInfo, creators, claimEvents, claimEvents24h };
}

// Ecosystem rewards wallet - always visible for transparency
const TREASURY_WALLET = "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC";

// Community Fund - ALWAYS appears in the world (permanent landmark)
// Links to Solscan so users can verify Ghost's community contributions
const TREASURY_BUILDING: RegisteredToken = {
  mint: "TreasuryBagsWorld1111111111111111111111111111",
  name: "Community Fund",
  symbol: "FUND",
  description:
    "Ghost's 5% $BagsWorld contribution funds Casino, features & development. Click to verify on Solscan!",
  imageUrl: "/assets/buildings/treasury.png",
  creator: TREASURY_WALLET,
  createdAt: Date.now() - 86400000 * 365, // 1 year ago (always been here)
};

// BagsWorld HQ - Floating headquarters in the sky above the park
// Uses REAL token data from the official BagsWorld token
const BAGSWORLD_HQ: RegisteredToken = {
  mint: "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
  name: "BagsWorld HQ",
  symbol: "BAGSWORLD",
  description:
    "The floating headquarters of BagsWorld! This majestic sky fortress pulls live data from the official BagsWorld token.",
  imageUrl: "/assets/buildings/bagshq.png",
  creator: "BagsWorld",
  createdAt: Date.now() - 86400000 * 365, // Origin building
};

// Starter buildings when no user tokens are registered
const STARTER_BUILDINGS: RegisteredToken[] = [
  {
    mint: "StarterPokeCenter11111111111111111111111111",
    name: "PokeCenter",
    symbol: "POKECENTER",
    description:
      "Welcome trainer! This is where citizens rest and recover. Launch a token to build your own building in BagsWorld!",
    imageUrl: "/assets/buildings/pokecenter.png",
    creator: "BagsWorld",
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
  // STASHED: Trading Dojo
  // {
  //   mint: "StarterTradingDojo1111111111111111111111111",
  //   name: "Trading Dojo",
  //   symbol: "DOJO",
  //   description:
  //     "Train your trading skills! Spar against AI opponents using real historical price data. Earn belts and climb the ranks!",
  //   imageUrl: "/assets/buildings/tradingdojo.png",
  //   creator: "BagsWorld",
  //   createdAt: Date.now() - 86400000 * 7, // 7 days ago
  // },
  {
    mint: "StarterCasino1111111111111111111111111111111",
    name: "BagsWorld Casino",
    symbol: "CASINO",
    description:
      "Try your luck! Free raffle entries and wheel spins funded by Ghost's trading fees. Win SOL from the fee pool!",
    imageUrl: "/assets/buildings/casino.png",
    creator: "BagsWorld",
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
  {
    mint: "StarterTradingTerminal111111111111111111111",
    name: "Trading Terminal",
    symbol: "TERMINAL",
    description:
      "Professional trading terminal with real-time charts. Track prices, analyze trends, and trade any Solana token.",
    imageUrl: "/assets/buildings/terminal.png",
    creator: "BagsWorld",
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
  {
    mint: "StarterOracleTower11111111111111111111111111",
    name: "Oracle's Tower",
    symbol: "ORACLE",
    description:
      "Predict which token will perform best! Token-gated prediction market with SOL prize pools for winners.",
    imageUrl: "/assets/buildings/oracle.png",
    creator: "BagsWorld",
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
];

// Generate events from claim data and launches
// Now uses database to track milestones properly
async function generateEvents(
  claimEvents: ClaimEvent[],
  tokens: TokenInfo[],
  existingEvents: GameEvent[]
): Promise<GameEvent[]> {
  const now = Date.now();
  const clearedAfter = await getEventsClearedAfter();

  // Auto-expire old events (older than EVENT_EXPIRY_DURATION or before clear timestamp)
  const freshEvents = existingEvents.filter(
    (e) => now - e.timestamp < EVENT_EXPIRY_DURATION && e.timestamp > clearedAfter
  );

  const events: GameEvent[] = [...freshEvents];
  const existingIds = new Set(freshEvents.map((e) => e.id));

  // Add claim events (only those after the clear timestamp)
  claimEvents.forEach((claim) => {
    const eventId = `claim-${claim.signature}`;
    const claimTimestamp = claim.timestamp * 1000;
    // Skip if already exists or if claim is before the clear timestamp
    if (!existingIds.has(eventId) && claimTimestamp > clearedAfter) {
      const token = tokens.find((t) => t.mint === claim.tokenMint);
      const claimAmountSol = lamportsToSol(claim.amount);
      const displayName = claim.claimerUsername || claim.claimer?.slice(0, 8) || "Unknown";
      events.unshift({
        id: eventId,
        type: "fee_claim",
        message: `${displayName} claimed ${formatSol(claimAmountSol)} from ${token?.symbol || "token"}`,
        timestamp: claimTimestamp,
        data: {
          username: displayName,
          tokenName: token?.name,
          amount: claimAmountSol,
        },
      });
    }
  });

  // Add fee milestone events - now uses database for persistence
  for (const token of tokens) {
    if (token.lifetimeFees > 0) {
      const feeThresholds = [1, 5, 10, 50, 100, 500, 1000];
      for (const threshold of feeThresholds) {
        if (token.lifetimeFees >= threshold) {
          const eventId = `milestone-${token.mint}-${threshold}`;

          // Skip if already in current events
          if (existingIds.has(eventId)) {
            break; // Only show the highest achieved milestone not yet displayed
          }

          // Check database to see if milestone was already achieved
          if (isNeonConfigured()) {
            const { isNew, achievedAt } = await recordMilestoneAchievement(
              token.mint,
              threshold,
              token.symbol
            );

            if (isNew) {
              // New milestone - use current time (when detected)
              events.unshift({
                id: eventId,
                type: "milestone",
                message: `${token.symbol} reached ${formatSol(threshold)} in lifetime fees!`,
                timestamp: Date.now(),
                data: {
                  tokenName: token.name,
                  amount: threshold,
                  mint: token.mint,
                },
              });
            }
            // If not new, don't add event (already celebrated)
          } else {
            // No database - fall back to in-memory only (won't persist across cold starts)
            events.unshift({
              id: eventId,
              type: "milestone",
              message: `${token.symbol} reached ${formatSol(threshold)} in lifetime fees!`,
              timestamp: Date.now(),
              data: {
                tokenName: token.name,
                amount: threshold,
                mint: token.mint,
              },
            });
          }
          break; // Only show highest milestone per token
        }
      }
    }
  }

  return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 25);
}

// Emit new events to the Agent Coordinator for the Agent Feed
// Now passes event IDs to coordinator for proper database deduplication
async function emitEventsToCoordinator(events: GameEvent[]): Promise<void> {
  // Start coordinator if not already running
  startCoordinator();

  for (const event of events) {
    // Map game event types to coordinator event types
    let coordinatorType: AgentEventType;
    let priority: "low" | "medium" | "high" | "urgent" = "medium";

    switch (event.type) {
      case "token_launch":
        coordinatorType = "token_launch";
        priority = "high";
        break;
      case "fee_claim":
        coordinatorType = "fee_claim";
        priority = (event.data?.amount as number) >= 1 ? "high" : "medium";
        break;
      case "price_pump":
        coordinatorType = "token_pump";
        priority = "high";
        break;
      case "price_dump":
        coordinatorType = "token_dump";
        priority = "medium";
        break;
      case "milestone":
        coordinatorType = "creator_milestone";
        priority = "high";
        break;
      default:
        coordinatorType = "system";
        priority = "low";
    }

    // Emit to coordinator with event ID for deduplication
    // The coordinator will check the database to prevent duplicates across cold starts
    try {
      await emitEvent(
        coordinatorType,
        "world-state",
        {
          ...event.data,
          message: event.message,
          originalType: event.type,
        },
        priority,
        event.id // Pass event ID for deduplication
      );
    } catch (error) {
      console.error("[World State] Failed to emit event to coordinator:", error);
    }
  }
}

// POST - Get world state for specific tokens (token launch-centric)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let registeredTokens: RegisteredToken[] = body.tokens || [];

    const now = Date.now();
    const sdk = await getBagsSDK();

    // Map to store health data from Neon for time-based decay calculation
    // Key: mint, Value: { currentHealth, healthUpdatedAt }
    const healthDataMap = new Map<
      string,
      { currentHealth: number | null; healthUpdatedAt: Date | null }
    >();

    // Merge admin overrides from Neon global tokens
    if (isNeonConfigured()) {
      try {
        const globalTokens = await getGlobalTokens();
        const globalTokenMap = new Map(globalTokens.map((gt) => [gt.mint, gt]));

        // Extract health data for all global tokens (for time-based decay)
        globalTokens.forEach((gt) => {
          healthDataMap.set(gt.mint, {
            currentHealth: gt.current_health ?? null,
            healthUpdatedAt: gt.health_updated_at ? new Date(gt.health_updated_at) : null,
          });
        });

        registeredTokens = registeredTokens.map((token) => {
          const gt = globalTokenMap.get(token.mint);
          if (!gt) return token;
          return {
            ...token,
            levelOverride: gt.level_override ?? token.levelOverride,
            positionOverride:
              gt.position_x != null && gt.position_y != null
                ? { x: gt.position_x, y: gt.position_y }
                : token.positionOverride,
            styleOverride: gt.style_override ?? token.styleOverride,
            healthOverride: gt.health_override ?? token.healthOverride,
            zoneOverride: (gt.zone_override as TokenInfo["zoneOverride"]) ?? token.zoneOverride,
          };
        });
      } catch (err) {
        console.warn("[WorldState] Failed to fetch global tokens for overrides:", err);
      }
    }

    // ALWAYS include Treasury building and PokeCenter (permanent landmarks)
    // Then add any user tokens
    const permanentBuildings = [TREASURY_BUILDING, BAGSWORLD_HQ, ...STARTER_BUILDINGS];
    const tokensToProcess = [...permanentBuildings, ...registeredTokens];

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
      }
    }

    // Merge health data from database into tokens (for time-based decay)
    // This allows decay to persist across serverless cold starts
    for (const token of tokens) {
      const healthData = healthDataMap.get(token.mint);
      if (healthData) {
        token.currentHealth = healthData.currentHealth;
        token.healthUpdatedAt = healthData.healthUpdatedAt;
      }
    }

    // Aggregate all 24h claim events and calculate earnings per wallet
    const allClaimEvents24h: ClaimEvent[] = enrichedResults.flatMap((r) => r.claimEvents24h);
    const earnings24hPerWallet = calculate24hEarningsPerWallet(allClaimEvents24h);

    // Build fee earners from SDK creators AND registered fee shares
    const earnerMap = new Map<string, FeeEarner>();
    // Track usernames we've already seen (normalized to lowercase) to prevent duplicates
    const seenUsernames = new Set<string>();
    let rank = 1;

    // First, add creators from SDK data (skip permanent building creators like "BagsWorld")
    // Important: Token launchers are only included if they explicitly allocated fees to themselves
    enrichedResults.forEach((result, index) => {
      const token = tokens[index];
      const registeredToken = tokensToProcess[index];
      // Skip permanent buildings (Treasury, Starter buildings) - they don't have real creators
      if (token.mint.startsWith("Treasury") || token.mint.startsWith("Starter")) {
        return;
      }

      // Get the token launcher's wallet (the person who created the token)
      const launcherWallet = registeredToken.creator?.toLowerCase();

      // Check if the launcher explicitly allocated fees to themselves in feeShares
      const launcherHasExplicitFeeShare =
        registeredToken.feeShares?.some(
          (share) => share.provider === "solana" && share.username?.toLowerCase() === launcherWallet
        ) || false;

      result.creators.forEach((creator) => {
        // Skip if no valid username or it's a placeholder
        if (!creator.providerUsername && !creator.username) return;
        if (creator.username === "BagsWorld") return;

        // Skip creators who don't receive fees (royaltyBps = 0 means no fee share)
        if (creator.royaltyBps === 0) return;

        // Skip the token launcher unless they explicitly allocated fees to themselves
        // (Bags API always gives launchers royaltyBps > 0, but we only want to show them
        // as citizens if they intentionally shared fees with themselves)
        const isLauncher = creator.wallet?.toLowerCase() === launcherWallet;
        if (isLauncher && !launcherHasExplicitFeeShare) {
          return;
        }

        const normalizedUsername = (creator.providerUsername || creator.username).toLowerCase();
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
          seenUsernames.add(normalizedUsername);
        }
      });
    });

    // Then, add citizens from registered token fee shares (Twitter/X linked)
    // Skip if they already appear from SDK creators (to avoid duplicates)
    tokensToProcess.forEach((registeredToken, index) => {
      const token = tokens[index];
      // Skip permanent buildings
      if (token.mint.startsWith("Treasury") || token.mint.startsWith("Starter")) {
        return;
      }

      if (registeredToken.feeShares && registeredToken.feeShares.length > 0) {
        registeredToken.feeShares.forEach((share) => {
          // Skip ecosystem fee share - it's for the treasury, not a citizen
          if (share.provider === "ecosystem" || share.provider === "solana") {
            return;
          }

          // Skip if username is empty or a placeholder
          if (!share.username || share.username === "BagsWorld") {
            return;
          }

          // Skip fee shares with 0 bps (no actual fee allocation)
          if (!share.bps || share.bps === 0) {
            return;
          }

          const normalizedUsername = share.username.toLowerCase();

          // Skip if we already have this username from SDK creators
          if (seenUsernames.has(normalizedUsername)) {
            return;
          }

          // Create a unique ID from provider + username (normalized to lowercase)
          const uniqueId = `${share.provider}-${normalizedUsername}`;
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
            seenUsernames.add(normalizedUsername);
          }
        });
      }
    });

    // Debug: Log all earners before sorting
    console.log(
      `[WorldState] Earners before sort (${earnerMap.size}):`,
      Array.from(earnerMap.values())
        .map((e) => `${e.username}: ${e.lifetimeEarnings.toFixed(4)} SOL`)
        .join(", ")
    );

    let earners = Array.from(earnerMap.values())
      .sort((a, b) => b.lifetimeEarnings - a.lifetimeEarnings)
      .slice(0, 13) // Leave room for Satoshi and Ash
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // Debug: Log final earners
    console.log(
      `[WorldState] Top earners (${earners.length}):`,
      earners
        .map((e) => `#${e.rank} ${e.username}: ${e.lifetimeEarnings.toFixed(4)} SOL`)
        .join(", ")
    );

    // Add special characters (permanent NPCs) to earners
    // Order matters: characters added last via unshift appear first in the list
    const specialChars = [
      // Academy Zone - Bags.fm Team (added first, so they appear after core chars)
      {
        username: "BNN",
        providerUsername: "BNNBags",
        provider: "twitter",
        wallet: "bnn-news-permanent",
        lifetimeEarnings: 24,
        flag: "isBNN",
      },
      {
        username: "Carlo",
        providerUsername: "carlobags",
        provider: "twitter",
        wallet: "carlo-ambassador-permanent",
        lifetimeEarnings: 100,
        flag: "isCarlo",
      },
      {
        username: "Alaa",
        providerUsername: "alaadotsol",
        provider: "twitter",
        wallet: "alaa-skunkworks-permanent",
        lifetimeEarnings: 42,
        flag: "isAlaa",
      },
      {
        username: "Sam",
        providerUsername: "Sambags12",
        provider: "twitter",
        wallet: "sam-growth-permanent",
        lifetimeEarnings: 500,
        flag: "isSam",
      },
      {
        username: "Stuu",
        providerUsername: "StuuBags",
        provider: "twitter",
        wallet: "stuu-ops-permanent",
        lifetimeEarnings: 200,
        flag: "isStuu",
      },
      {
        username: "Sincara",
        providerUsername: "sincara_bags",
        provider: "twitter",
        wallet: "sincara-frontend-permanent",
        lifetimeEarnings: 8080,
        flag: "isSincara",
      },
      {
        username: "Ramo",
        providerUsername: "ramyobags",
        provider: "twitter",
        wallet: "ramo-cto-permanent",
        lifetimeEarnings: 500000,
        flag: "isRamo",
      },
      // Core Characters
      {
        username: "Shaw",
        providerUsername: "shawmakesmagic",
        provider: "twitter",
        wallet: "shaw-elizaos-permanent",
        lifetimeEarnings: 17000,
        flag: "isShaw",
      },
      {
        username: "CJ",
        providerUsername: "cj_grove",
        provider: "twitter",
        wallet: "cj-grove-street-permanent",
        lifetimeEarnings: 1992,
        flag: "isCJ",
      },
      {
        username: "Neo",
        providerUsername: "TheOne",
        provider: "twitter",
        wallet: "scout-agent-permanent",
        lifetimeEarnings: 1999,
        flag: "isScout",
      },
      {
        username: "The Dev",
        providerUsername: "DaddyGhost",
        provider: "twitter",
        wallet: "daddyghost-dev-permanent",
        lifetimeEarnings: 420690,
        flag: "isDev",
      },
      {
        username: "Finn",
        providerUsername: "finnbags",
        provider: "twitter",
        wallet: "finnbags-ceo-permanent",
        lifetimeEarnings: 1000000000,
        flag: "isFinn",
      },
      {
        username: "Ash",
        providerUsername: "ash_ketchum",
        provider: "pokemon",
        wallet: "ash-ketchum-permanent",
        lifetimeEarnings: 151,
        flag: "isAsh",
      },
      {
        username: "toly",
        providerUsername: "aeyakovenko",
        provider: "solana",
        wallet: "toly-solana-permanent",
        lifetimeEarnings: 65000,
        flag: "isToly",
      },
      // Founder's Corner Zone
      {
        username: "Professor Oak",
        providerUsername: "ProfessorOak",
        provider: "pokemon",
        wallet: "professor-oak-permanent",
        lifetimeEarnings: 151,
        flag: "isProfessorOak",
      },
    ] as const;

    for (const char of specialChars) {
      earners.unshift({
        rank: 0,
        username: char.username,
        providerUsername: char.providerUsername,
        provider: char.provider as FeeEarner["provider"],
        wallet: char.wallet,
        avatarUrl: undefined,
        lifetimeEarnings: char.lifetimeEarnings,
        earnings24h: 0,
        change24h: 0,
        tokenCount: 0,
        topToken: undefined,
        [char.flag]: true,
      } as FeeEarner);
    }

    // Get weather (non-blocking) and time
    const realWeather = getWeatherNonBlocking();
    const timeInfo = getESTTimeInfo();

    // Fetch top BagsWorld token holders for Ballers Valley mansions
    const bagsWorldHolders = await fetchBagsWorldHolders();
    console.log("[WorldState] Creating world with", bagsWorldHolders.length, "mansion holders");

    // Calculate Bags.fm health metrics from real on-chain data
    // 1. Total 24h claim volume (claims are in lamports from SDK, convert to SOL)
    const claimVolume24h = lamportsToSol(allClaimEvents24h.reduce((sum, e) => sum + e.amount, 0));
    // 2. Total lifetime fees across all tokens (already in SOL after enrichment)
    const totalLifetimeFees = tokens.reduce((sum, t) => sum + (t.lifetimeFees || 0), 0);
    // 3. Count tokens with any fee activity
    const activeTokenCount = tokens.filter((t) => (t.lifetimeFees || 0) > 0).length;

    const bagsMetrics: BagsHealthMetrics = {
      claimVolume24h,
      totalLifetimeFees,
      activeTokenCount,
    };

    // Build world state with Bags.fm metrics and top holders for Ballers Valley
    const worldState = buildWorldState(
      earners,
      tokens,
      previousState ?? undefined,
      bagsMetrics,
      bagsWorldHolders
    );

    worldState.weather = realWeather;
    (worldState as WorldState & { timeInfo: typeof timeInfo }).timeInfo = timeInfo;

    // Generate events (now async for database milestone tracking)
    worldState.events = await generateEvents(allClaimEvents, tokens, previousState?.events || []);

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
              symbol: token.symbol,
              platform: "bags",
              mint: token.mint,
            },
          });
        }
      }
    });

    // Emit events to Agent Coordinator for the Agent Feed
    // Fire-and-forget but with error logging to avoid silent failures
    emitEventsToCoordinator(worldState.events).catch((err) => {
      console.error("[WorldState] Failed to emit events to coordinator:", err);
    });

    // Track building count for city growth
    (worldState as any).tokenCount = tokens.length;
    (worldState as any).sdkAvailable = !!sdk;
    // Include Bags.fm health metrics for transparency
    (worldState as any).healthMetrics = {
      claimVolume24h,
      totalLifetimeFees,
      activeTokenCount,
      source: "bags.fm",
    };

    // Persist updated health values back to database (for time-based decay)
    // Only update buildings where health actually changed
    if (isNeonConfigured()) {
      const healthUpdates: Array<{ mint: string; health: number }> = [];

      for (const building of worldState.buildings) {
        // Skip permanent/floating buildings and starter buildings (no real mint)
        if (building.isPermanent || building.isFloating) continue;
        if (building.id.startsWith("Starter") || building.id.startsWith("Treasury")) continue;

        const previousHealthData = healthDataMap.get(building.id);
        const previousHealth = previousHealthData?.currentHealth ?? 50;
        const currentHealth =
          typeof building.health === "number" && !isNaN(building.health)
            ? Math.round(Math.max(0, Math.min(100, building.health)))
            : 50;

        // Only persist if health changed
        if (currentHealth !== previousHealth) {
          healthUpdates.push({ mint: building.id, health: currentHealth });
        }
      }

      // Batch update health values (fire-and-forget to avoid blocking response)
      if (healthUpdates.length > 0) {
        batchUpdateBuildingHealth(healthUpdates).catch((err) => {
          console.error("[WorldState] Failed to persist building health:", err);
        });
      }
    }

    previousState = worldState;

    return NextResponse.json(worldState);
  } catch {
    return NextResponse.json({ error: "Failed to build world state" }, { status: 500 });
  }
}

// GET - Basic world state (for initial load without tokens)
export async function GET() {
  try {
    // Use cached data if available
    const now = Date.now();
    if (tokenCache && now - tokenCache.timestamp < TOKEN_CACHE_DURATION && earnerCache) {
      const realWeather = getWeatherNonBlocking();
      const timeInfo = getESTTimeInfo();

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

    const realWeather = getWeatherNonBlocking();
    const timeInfo = getESTTimeInfo();

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
  } catch {
    return NextResponse.json({ error: "Failed to fetch world state" }, { status: 500 });
  }
}
