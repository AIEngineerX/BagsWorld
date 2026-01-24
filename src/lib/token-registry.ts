// Token Registry - localStorage + Neon database for global building state

export interface LaunchedToken {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  creator: string; // wallet address
  createdAt: number; // timestamp
  feeShares?: Array<{
    provider: string;
    username: string;
    bps: number;
  }>;
  // Live data (updated from SDK)
  lifetimeFees?: number;
  marketCap?: number;
  volume24h?: number;
  lastUpdated?: number;
  // Source tracking
  isGlobal?: boolean; // From Neon
  isFeatured?: boolean;
  isVerified?: boolean;
  // Admin controls
  levelOverride?: number | null; // Admin override for building level (1-5)
}

const STORAGE_KEY = "bagsworld_tokens";
const GLOBAL_CACHE_KEY = "bagsworld_global_cache";
const GLOBAL_CACHE_DURATION = 2 * 60 * 1000; // 2 minute cache

// Cache for global tokens (to avoid excessive API calls)
let globalTokensCache: { tokens: LaunchedToken[]; timestamp: number } | null = null;

// In-flight promise to dedupe concurrent calls
let inFlightFetch: Promise<LaunchedToken[]> | null = null;

export const FEATURED_BAGS_TOKENS: LaunchedToken[] = [];

export function getLaunchedTokens(): LaunchedToken[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Corrupted token registry data:", error);
    return [];
  }
}

export function saveLaunchedToken(token: LaunchedToken): void {
  if (typeof window === "undefined") return;
  try {
    const tokens = getLaunchedTokens();
    const existingIndex = tokens.findIndex((t) => t.mint === token.mint);
    if (existingIndex >= 0) {
      tokens[existingIndex] = { ...tokens[existingIndex], ...token };
    } else {
      tokens.unshift(token);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // localStorage write failed
  }
}

export function updateTokenData(mint: string, data: Partial<LaunchedToken>): void {
  if (typeof window === "undefined") return;
  try {
    const tokens = getLaunchedTokens();
    const index = tokens.findIndex((t) => t.mint === mint);
    if (index >= 0) {
      tokens[index] = { ...tokens[index], ...data, lastUpdated: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }
  } catch {
    // localStorage write failed
  }
}

export function removeLaunchedToken(mint: string): void {
  if (typeof window === "undefined") return;
  try {
    const tokens = getLaunchedTokens().filter((t) => t.mint !== mint);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // localStorage write failed
  }
}
export async function fetchGlobalTokens(): Promise<LaunchedToken[]> {
  // Check cache first
  const now = Date.now();
  if (globalTokensCache && now - globalTokensCache.timestamp < GLOBAL_CACHE_DURATION) {
    return globalTokensCache.tokens;
  }

  // If there's already a fetch in progress, return that promise (dedupe concurrent calls)
  if (inFlightFetch) {
    return inFlightFetch;
  }

  // Start the fetch and store the promise
  inFlightFetch = (async () => {
    try {
      const response = await fetch("/api/global-tokens");
      if (!response.ok) return globalTokensCache?.tokens || [];

      const data = await response.json();
      if (!data.configured || !data.tokens || !Array.isArray(data.tokens)) {
        return [];
      }

      const tokens: LaunchedToken[] = data.tokens.map((t: any) => {
        const createdAt = t.created_at ? new Date(t.created_at).getTime() : Date.now();
        let feeShares: Array<{ provider: string; username: string; bps: number }> = [];
        if (Array.isArray(t.fee_shares)) {
          feeShares = t.fee_shares;
        } else if (typeof t.fee_shares === "string" && t.fee_shares.length > 2) {
          try {
            const parsed = JSON.parse(t.fee_shares);
            feeShares = Array.isArray(parsed) ? parsed : [];
          } catch {
            // Invalid fee_shares JSON
          }
        }

        return {
          mint: t.mint,
          name: t.name,
          symbol: t.symbol,
          description: t.description,
          imageUrl: t.image_url,
          creator: t.creator_wallet,
          createdAt: isNaN(createdAt) ? Date.now() : createdAt,
          feeShares,
          lifetimeFees: t.lifetime_fees,
          marketCap: t.market_cap,
          volume24h: t.volume_24h,
          lastUpdated: t.last_updated ? new Date(t.last_updated).getTime() : undefined,
          isGlobal: true,
          isFeatured: t.is_featured,
          isVerified: t.is_verified,
          levelOverride: t.level_override,
        };
      });

      globalTokensCache = { tokens, timestamp: Date.now() };

      return tokens;
    } catch (error) {
      console.error("[TokenRegistry] Error fetching global tokens:", error);
      return globalTokensCache?.tokens || [];
    } finally {
      // Clear in-flight promise so next call after cache expires will fetch fresh
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

export async function saveTokenGlobally(token: LaunchedToken): Promise<boolean> {
  try {
    const response = await fetch("/api/global-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        description: token.description,
        image_url: token.imageUrl,
        creator_wallet: token.creator,
        fee_shares: token.feeShares,
      }),
    });

    if (!response.ok) return false;
    globalTokensCache = null;
    return true;
  } catch {
    return false;
  }
}

// Get all tokens for the world (user's local + global from database)
export function getAllWorldTokens(): LaunchedToken[] {
  const userTokens = getLaunchedTokens();

  // Combine user tokens with cached global tokens
  // User tokens appear first, then global
  const allTokens = [...userTokens];

  // Add cached global tokens that aren't already in user's list
  if (globalTokensCache?.tokens) {
    globalTokensCache.tokens.forEach((global) => {
      if (!allTokens.some((t) => t.mint === global.mint)) {
        allTokens.push(global);
      }
    });
  }

  // Add featured tokens as fallback
  FEATURED_BAGS_TOKENS.forEach((featured) => {
    if (!allTokens.some((t) => t.mint === featured.mint)) {
      allTokens.push(featured);
    }
  });

  return allTokens;
}

// Async version that fetches fresh global tokens
export async function getAllWorldTokensAsync(): Promise<LaunchedToken[]> {
  const userTokens = getLaunchedTokens();
  const globalTokens = await fetchGlobalTokens();

  // Combine: user tokens first, then global (deduped by mint)
  const allTokens = [...userTokens];
  const seenMints = new Set(userTokens.map((t) => t.mint));

  globalTokens.forEach((global) => {
    if (!seenMints.has(global.mint)) {
      allTokens.push(global);
      seenMints.add(global.mint);
    }
  });

  // Add featured tokens as fallback
  FEATURED_BAGS_TOKENS.forEach((featured) => {
    if (!seenMints.has(featured.mint)) {
      allTokens.push(featured);
    }
  });

  return allTokens;
}

// Get token count for display
export function getTokenCount(): { user: number; featured: number; total: number } {
  const userTokens = getLaunchedTokens();
  return {
    user: userTokens.length,
    featured: FEATURED_BAGS_TOKENS.length,
    total: getAllWorldTokens().length,
  };
}

// Check if a token exists in registry
export function isTokenRegistered(mint: string): boolean {
  const tokens = getLaunchedTokens();
  return tokens.some((t) => t.mint === mint) || FEATURED_BAGS_TOKENS.some((t) => t.mint === mint);
}

// Get a specific token by mint
export function getTokenByMint(mint: string): LaunchedToken | null {
  const tokens = getAllWorldTokens();
  return tokens.find((t) => t.mint === mint) || null;
}

// Clear all user tokens (for testing/reset)
export function clearAllTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// Export tokens as JSON (for backup)
export function exportTokens(): string {
  const tokens = getLaunchedTokens();
  return JSON.stringify(tokens, null, 2);
}

// Import tokens from JSON (for restore)
export function importTokens(json: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const tokens = JSON.parse(json);
    if (!Array.isArray(tokens)) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    return true;
  } catch {
    return false;
  }
}
