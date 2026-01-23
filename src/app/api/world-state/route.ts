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
import { buildWorldState, type BagsHealthMetrics } from "@/lib/world-calculator";
import { Connection, PublicKey } from "@solana/web3.js";
import { getTokensByMints, type DexPair } from "@/lib/dexscreener-api";
import {
  emitEvent,
  startCoordinator,
  type AgentEventType,
} from "@/lib/agent-coordinator";

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

// Lazy-loaded SDK instance with proper mutex to prevent race conditions
let sdkInstance: any = null;
let sdkInitPromise: Promise<any | null> | null = null;
let sdkInitFailed = false;
let sdkFailedAt = 0;
const SDK_RETRY_DELAY = 5000; // Wait 5 seconds before retrying after failure

async function getBagsSDK(): Promise<any | null> {
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
      const rpcUrl =
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://rpc.ankr.com/solana";
      const connection = new Connection(rpcUrl, "confirmed");
      sdkInstance = new BagsSDK(
        process.env.BAGS_API_KEY!,
        connection,
        "processed"
      );
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

// Background weather fetch (non-blocking)
let weatherFetchInProgress = false;

function fetchWeatherInBackground(): void {
  if (weatherFetchInProgress) return;
  weatherFetchInProgress = true;

  const DC_LAT = 38.9072;
  const DC_LON = -77.0369;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${DC_LAT}&longitude=${DC_LON}&current=weather_code,cloud_cover&timezone=America/New_York`;

  fetch(url, { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("Weather API error");
      return response.json();
    })
    .then(data => {
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

  // Skip SDK enrichment for placeholder/permanent buildings (they have fake mints)
  const isPlaceholderMint = token.mint.startsWith("Treasury") || token.mint.startsWith("Starter");

  if (sdk && !isPlaceholderMint) {
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

// BagsWorld HQ - Floating headquarters in the sky above the park
// Uses REAL token data from the official BagsWorld token
const BAGSWORLD_HQ: RegisteredToken = {
  mint: "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
  name: "BagsWorld HQ",
  symbol: "BAGSWORLD",
  description: "The floating headquarters of BagsWorld! This majestic sky fortress pulls live data from the official BagsWorld token.",
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
    description: "Welcome trainer! This is where citizens rest and recover. Launch a token to build your own building in BagsWorld!",
    imageUrl: "/assets/buildings/pokecenter.png",
    creator: "BagsWorld",
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
  {
    mint: "StarterTradingGym11111111111111111111111111",
    name: "Trading Gym",
    symbol: "GYM",
    description: "The AI Trading Arena! Watch agents battle with predictions and compete for the top rank. Enter to spectate!",
    imageUrl: "/assets/buildings/tradinggym.png",
    creator: "BagsWorld",
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
  {
    mint: "StarterCasino1111111111111111111111111111111",
    name: "BagsWorld Casino",
    symbol: "CASINO",
    description: "Try your luck! Free raffle entries and wheel spins funded by Ghost's trading fees. Win SOL from the fee pool!",
    imageUrl: "/assets/buildings/casino.png",
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
        message: `${claim.claimerUsername || claim.claimer?.slice(0, 8) || 'Unknown'} claimed ${(claim.amount / 1e9).toFixed(2)} SOL from ${token?.symbol || "token"}`,
        timestamp: claim.timestamp * 1000,
        data: {
          username: claim.claimerUsername || claim.claimer?.slice(0, 8) || 'Unknown',
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

// Track emitted events to avoid duplicates
const emittedEventIds = new Set<string>();

// Emit new events to the Agent Coordinator for the Agent Feed
async function emitEventsToCoordinator(events: GameEvent[]): Promise<void> {
  // Start coordinator if not already running
  startCoordinator();

  for (const event of events) {
    // Skip if already emitted
    if (emittedEventIds.has(event.id)) continue;
    emittedEventIds.add(event.id);

    // Limit tracking to last 1000 events
    if (emittedEventIds.size > 1000) {
      const toRemove = Array.from(emittedEventIds).slice(0, 500);
      toRemove.forEach(id => emittedEventIds.delete(id));
    }

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

    // Emit to coordinator
    try {
      await emitEvent(coordinatorType, "world-state", {
        ...event.data,
        message: event.message,
        originalType: event.type,
      }, priority);
    } catch (error) {
      console.error("[World State] Failed to emit event to coordinator:", error);
    }
  }
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
      const launcherHasExplicitFeeShare = registeredToken.feeShares?.some(
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
    console.log(`[WorldState] Earners before sort (${earnerMap.size}):`,
      Array.from(earnerMap.values()).map(e => `${e.username}: ${e.lifetimeEarnings.toFixed(4)} SOL`).join(', '));

    let earners = Array.from(earnerMap.values())
      .sort((a, b) => b.lifetimeEarnings - a.lifetimeEarnings)
      .slice(0, 13) // Leave room for Satoshi and Ash
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // Debug: Log final earners
    console.log(`[WorldState] Top earners (${earners.length}):`,
      earners.map(e => `#${e.rank} ${e.username}: ${e.lifetimeEarnings.toFixed(4)} SOL`).join(', '));

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

    // ALWAYS add CJ as the hood rat character in BagsCity
    // CJ from Grove Street, keeps it real about on-chain activity
    const cj: FeeEarner = {
      rank: 0, // Special rank
      username: "CJ",
      providerUsername: "cj_grove",
      provider: "twitter" as FeeEarner["provider"],
      wallet: "cj-grove-street-permanent",
      avatarUrl: undefined, // Will use special CJ sprite
      lifetimeEarnings: 1992, // GTA SA release year... actually 2004, but keeping hood vibes
      earnings24h: 0,
      change24h: 0,
      tokenCount: 0,
      topToken: undefined,
      isCJ: true, // Special flag for the game to recognize
    } as FeeEarner & { isCJ: boolean };

    // ALWAYS add Shaw as the ElizaOS creator character in the Park
    // Shaw (@shawmakesmagic) created ElizaOS, the most popular AI agent framework
    const shaw: FeeEarner = {
      rank: 0, // Special rank
      username: "Shaw",
      providerUsername: "shawmakesmagic",
      provider: "twitter" as FeeEarner["provider"],
      wallet: "shaw-elizaos-permanent",
      avatarUrl: undefined, // Will use special Shaw sprite
      lifetimeEarnings: 17000, // 17k GitHub stars on ElizaOS
      earnings24h: 0,
      change24h: 0,
      tokenCount: 0,
      topToken: undefined,
      isShaw: true, // Special flag for the game to recognize
    } as FeeEarner & { isShaw: boolean };

    earners.unshift(shaw); // Shaw seventh
    earners.unshift(cj); // CJ sixth
    earners.unshift(scout); // Neo fifth
    earners.unshift(dev); // The Dev fourth
    earners.unshift(finn); // Finn third
    earners.unshift(ash); // Ash second
    earners.unshift(toly); // Toly always first

    // Get weather (non-blocking) and time
    const realWeather = getWeatherNonBlocking();
    const timeInfo = getESTTimeInfo();

    // Calculate Bags.fm health metrics from real on-chain data
    // 1. Total 24h claim volume (claims are already in lamports from SDK, convert to SOL)
    const claimVolume24h = allClaimEvents24h.reduce((sum, e) => sum + e.amount, 0) / 1e9;
    // 2. Total lifetime fees across all tokens
    const totalLifetimeFees = tokens.reduce((sum, t) => sum + (t.lifetimeFees || 0), 0);
    // 3. Count tokens with any fee activity
    const activeTokenCount = tokens.filter(t => (t.lifetimeFees || 0) > 0).length;

    const bagsMetrics: BagsHealthMetrics = {
      claimVolume24h,
      totalLifetimeFees,
      activeTokenCount,
    };


    // Build world state with Bags.fm metrics
    const worldState = buildWorldState(earners, tokens, previousState ?? undefined, bagsMetrics);

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

    previousState = worldState;

    return NextResponse.json(worldState);
  } catch {
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
    return NextResponse.json(
      { error: "Failed to fetch world state" },
      { status: 500 }
    );
  }
}
