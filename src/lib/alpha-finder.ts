/**
 * Alpha Finder for ChadGhost
 * Finds crypto alpha from various sources to post on Moltbook
 * 
 * Sources (Phase 1 - Simple):
 * - Bags.fm new launches
 * - Bags.fm top earners (whale moves)
 * - BagsWorld world state (live activity)
 * 
 * Sources (Phase 2 - Later):
 * - DexScreener trending
 * - Moltbook trending topics
 * - Twitter/X mentions
 */

import { getMarketState } from "./agent-economy/brain";

// ============================================================================
// TYPES
// ============================================================================

export type AlphaType = 
  | "new_launch"      // New token just launched
  | "whale_claim"     // Big fee claim
  | "volume_spike"    // Volume up significantly
  | "top_earner"      // Top fee earner activity
  | "trending"        // Trending on bags.fm
  | "alpha_take";     // ChadGhost's opinion

export interface AlphaItem {
  type: AlphaType;
  priority: "high" | "medium" | "low";
  title: string;
  content: string;
  data: {
    tokenMint?: string;
    tokenSymbol?: string;
    tokenName?: string;
    amount?: number;
    percentChange?: number;
    wallet?: string;
    bagsUrl?: string;
    moltbookUser?: string;
  };
  source: string;
  foundAt: Date;
  expiresAt?: Date; // Some alpha is time-sensitive
}

export interface AlphaFinderConfig {
  minVolume24h: number;        // Minimum 24h volume to consider (SOL)
  minClaimAmount: number;      // Minimum claim to report (SOL)
  volumeSpikeThreshold: number; // % increase to count as spike
  maxAgeMinutes: number;       // How old alpha can be before it's stale
}

const DEFAULT_CONFIG: AlphaFinderConfig = {
  minVolume24h: 1,              // At least 1 SOL volume
  minClaimAmount: 0.1,          // At least 0.1 SOL claim
  volumeSpikeThreshold: 100,    // 100% increase = spike
  maxAgeMinutes: 60,            // Alpha older than 1 hour is stale
};

// ============================================================================
// BAGS.FM API HELPERS
// ============================================================================

const BAGS_API_KEY = process.env.BAGS_API_KEY;
const BAGS_PUBLIC_API = "https://public-api-v2.bags.fm/api/v1";

interface BagsToken {
  mint: string;
  name: string;
  symbol: string;
  creator?: string;
  createdAt?: string;
  volume24h?: number;
  marketCap?: number;
  priceChange24h?: number;
  lifetimeFees?: number;
}

interface BagsClaimEvent {
  wallet: string;
  amount: number; // lamports
  tokenMint: string;
  tokenSymbol?: string;
  timestamp: string;
}

/**
 * Fetch recent token launches from Bags.fm
 */
async function fetchRecentLaunches(limit: number = 20): Promise<BagsToken[]> {
  try {
    // Use the BagsWorld world state API which aggregates this
    const worldStateUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/world-state`
      : "https://bagsworld.app/api/world-state";
    
    const response = await fetch(worldStateUrl);
    if (!response.ok) return [];
    
    const data = await response.json();
    const tokens = data.tokens || [];
    
    // Sort by creation time (newest first) and take limit
    return tokens
      .filter((t: BagsToken) => t.createdAt)
      .sort((a: BagsToken, b: BagsToken) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      )
      .slice(0, limit);
  } catch (error) {
    console.error("[AlphaFinder] Failed to fetch recent launches:", error);
    return [];
  }
}

/**
 * Fetch top tokens by volume
 */
async function fetchTopByVolume(limit: number = 10): Promise<BagsToken[]> {
  try {
    const market = await getMarketState();
    return market.topByVolume.slice(0, limit).map(t => ({
      mint: t.mint,
      name: t.name,
      symbol: t.symbol,
      volume24h: t.volume24h,
      marketCap: t.marketCap,
      priceChange24h: t.change24h,
      lifetimeFees: t.lifetimeFees,
    }));
  } catch (error) {
    console.error("[AlphaFinder] Failed to fetch top by volume:", error);
    return [];
  }
}

/**
 * Fetch top fee earners
 */
async function fetchTopEarners(limit: number = 10): Promise<BagsToken[]> {
  try {
    const market = await getMarketState();
    return market.topByFees.slice(0, limit).map(t => ({
      mint: t.mint,
      name: t.name,
      symbol: t.symbol,
      volume24h: t.volume24h,
      lifetimeFees: t.lifetimeFees,
    }));
  } catch (error) {
    console.error("[AlphaFinder] Failed to fetch top earners:", error);
    return [];
  }
}

// ============================================================================
// ALPHA DETECTION
// ============================================================================

// Track what we've already reported to avoid duplicates
const reportedAlpha = new Map<string, Date>();

function isAlreadyReported(key: string, maxAgeMinutes: number): boolean {
  const reported = reportedAlpha.get(key);
  if (!reported) return false;
  
  const ageMs = Date.now() - reported.getTime();
  return ageMs < maxAgeMinutes * 60 * 1000;
}

function markAsReported(key: string): void {
  reportedAlpha.set(key, new Date());
  
  // Clean up old entries
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
  for (const [k, v] of reportedAlpha.entries()) {
    if (v.getTime() < cutoff) {
      reportedAlpha.delete(k);
    }
  }
}

/**
 * Find new launches worth reporting
 */
async function findNewLaunches(config: AlphaFinderConfig): Promise<AlphaItem[]> {
  const launches = await fetchRecentLaunches(20);
  const items: AlphaItem[] = [];
  
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  for (const token of launches) {
    if (!token.createdAt) continue;
    
    const createdAt = new Date(token.createdAt).getTime();
    if (createdAt < oneHourAgo) continue; // Only last hour
    
    const key = `launch:${token.mint}`;
    if (isAlreadyReported(key, config.maxAgeMinutes)) continue;
    
    // Check if it has any traction
    const hasVolume = (token.volume24h || 0) >= config.minVolume24h;
    
    items.push({
      type: "new_launch",
      priority: hasVolume ? "high" : "medium",
      title: `🚀 New Launch: $${token.symbol}`,
      content: hasVolume 
        ? `${token.name} ($${token.symbol}) just launched and already has ${token.volume24h?.toFixed(2)} SOL volume! bags.fm/${token.mint.slice(0, 8)}...`
        : `${token.name} ($${token.symbol}) just launched on Bags.fm! Early entry opportunity? bags.fm/${token.mint.slice(0, 8)}...`,
      data: {
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        amount: token.volume24h,
        bagsUrl: `https://bags.fm/${token.mint}`,
      },
      source: "bags.fm",
      foundAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    });
  }
  
  return items;
}

/**
 * Find volume spikes
 */
async function findVolumeSpikes(config: AlphaFinderConfig): Promise<AlphaItem[]> {
  const tokens = await fetchTopByVolume(20);
  const items: AlphaItem[] = [];
  
  for (const token of tokens) {
    if (!token.volume24h || token.volume24h < config.minVolume24h) continue;
    if (!token.priceChange24h) continue;
    
    const key = `volume:${token.mint}`;
    if (isAlreadyReported(key, config.maxAgeMinutes * 4)) continue; // 4x cooldown for volume
    
    // Only report significant moves
    if (Math.abs(token.priceChange24h) < 50) continue; // At least 50% move
    
    const direction = token.priceChange24h > 0 ? "📈" : "📉";
    const verb = token.priceChange24h > 0 ? "pumping" : "dumping";
    
    items.push({
      type: "volume_spike",
      priority: Math.abs(token.priceChange24h) > 100 ? "high" : "medium",
      title: `${direction} $${token.symbol} ${verb}`,
      content: `${token.name} ($${token.symbol}) is ${token.priceChange24h > 0 ? "up" : "down"} ${Math.abs(token.priceChange24h).toFixed(0)}% with ${token.volume24h.toFixed(2)} SOL volume. bags.fm/${token.mint.slice(0, 8)}...`,
      data: {
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        amount: token.volume24h,
        percentChange: token.priceChange24h,
        bagsUrl: `https://bags.fm/${token.mint}`,
      },
      source: "bags.fm",
      foundAt: new Date(),
    });
  }
  
  return items;
}

/**
 * Find top earners (whale activity)
 */
async function findTopEarners(config: AlphaFinderConfig): Promise<AlphaItem[]> {
  const tokens = await fetchTopEarners(10);
  const items: AlphaItem[] = [];
  
  for (const token of tokens) {
    if (!token.lifetimeFees || token.lifetimeFees < 1) continue; // At least 1 SOL lifetime fees
    
    const key = `earner:${token.mint}`;
    if (isAlreadyReported(key, config.maxAgeMinutes * 6)) continue; // 6x cooldown for earners
    
    items.push({
      type: "top_earner",
      priority: token.lifetimeFees > 10 ? "high" : "medium",
      title: `💰 Top Earner: $${token.symbol}`,
      content: `$${token.symbol} has generated ${token.lifetimeFees.toFixed(2)} SOL in creator fees! This token is earning. bags.fm/${token.mint.slice(0, 8)}...`,
      data: {
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        amount: token.lifetimeFees,
        bagsUrl: `https://bags.fm/${token.mint}`,
      },
      source: "bags.fm",
      foundAt: new Date(),
    });
  }
  
  return items;
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Find all available alpha
 */
export async function findAlpha(config: Partial<AlphaFinderConfig> = {}): Promise<AlphaItem[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  console.log("[AlphaFinder] Scanning for alpha...");
  
  const [launches, spikes, earners] = await Promise.all([
    findNewLaunches(cfg),
    findVolumeSpikes(cfg),
    findTopEarners(cfg),
  ]);
  
  const allAlpha = [...launches, ...spikes, ...earners];
  
  // Sort by priority then by recency
  allAlpha.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.foundAt.getTime() - a.foundAt.getTime();
  });
  
  console.log(`[AlphaFinder] Found ${allAlpha.length} alpha items (${launches.length} launches, ${spikes.length} spikes, ${earners.length} earners)`);
  
  return allAlpha;
}

/**
 * Get the best alpha to post right now
 */
export async function getBestAlpha(config: Partial<AlphaFinderConfig> = {}): Promise<AlphaItem | null> {
  const alpha = await findAlpha(config);
  
  if (alpha.length === 0) {
    console.log("[AlphaFinder] No alpha found");
    return null;
  }
  
  const best = alpha[0];
  
  // Mark as reported so we don't post it again
  const key = `${best.type}:${best.data.tokenMint || best.title}`;
  markAsReported(key);
  
  console.log(`[AlphaFinder] Best alpha: ${best.type} - ${best.title}`);
  return best;
}

/**
 * Format alpha item for Moltbook post
 */
export function formatAlphaForPost(alpha: AlphaItem): { title: string; content: string } {
  // Add CTA to content
  const cta = "\n\n🦀 Found via ChadGhost | bagsworld.app";
  
  return {
    title: alpha.title,
    content: alpha.content + cta,
  };
}

/**
 * Get alpha stats (for debugging/monitoring)
 */
export function getAlphaStats(): {
  reportedCount: number;
  reportedKeys: string[];
} {
  return {
    reportedCount: reportedAlpha.size,
    reportedKeys: Array.from(reportedAlpha.keys()),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  findNewLaunches,
  findVolumeSpikes,
  findTopEarners,
  DEFAULT_CONFIG as ALPHA_FINDER_CONFIG,
};
