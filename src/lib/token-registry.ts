// Token Registry - stores launched tokens in localStorage + global Neon database
// This is the core of the BagsWorld experience - tokens users launch become buildings
// Now supports GLOBAL state so everyone sees the same buildings!

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
const GLOBAL_CACHE_DURATION = 60 * 1000; // 1 minute cache

// Cache for global tokens (to avoid excessive API calls)
let globalTokensCache: { tokens: LaunchedToken[]; timestamp: number } | null = null;

// Featured Bags.fm tokens - fallback if database is empty
// Base buildings (Treasury, PokeCenter, etc.) are defined in world-state API
// Citizens come from fee share recipients of tokens launched through the app
export const FEATURED_BAGS_TOKENS: LaunchedToken[] = [];

// Get all launched tokens from localStorage
export function getLaunchedTokens(): LaunchedToken[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error reading launched tokens:", error);
    return [];
  }
}

// Save a newly launched token
export function saveLaunchedToken(token: LaunchedToken): void {
  if (typeof window === "undefined") return;

  try {
    const tokens = getLaunchedTokens();
    // Check if already exists
    const existingIndex = tokens.findIndex((t) => t.mint === token.mint);
    if (existingIndex >= 0) {
      // Update existing
      tokens[existingIndex] = { ...tokens[existingIndex], ...token };
    } else {
      // Add new
      tokens.unshift(token); // Add to beginning (newest first)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.error("Error saving launched token:", error);
  }
}

// Update token with live data from SDK
export function updateTokenData(
  mint: string,
  data: Partial<LaunchedToken>
): void {
  if (typeof window === "undefined") return;

  try {
    const tokens = getLaunchedTokens();
    const index = tokens.findIndex((t) => t.mint === mint);
    if (index >= 0) {
      tokens[index] = {
        ...tokens[index],
        ...data,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }
  } catch (error) {
    console.error("Error updating token data:", error);
  }
}

// Remove a token from registry
export function removeLaunchedToken(mint: string): void {
  if (typeof window === "undefined") return;

  try {
    const tokens = getLaunchedTokens();
    const filtered = tokens.filter((t) => t.mint !== mint);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing token:", error);
  }
}

// Fetch global tokens from API (with caching)
export async function fetchGlobalTokens(): Promise<LaunchedToken[]> {
  // Check cache first
  const now = Date.now();
  if (globalTokensCache && now - globalTokensCache.timestamp < GLOBAL_CACHE_DURATION) {
    return globalTokensCache.tokens;
  }

  try {
    const response = await fetch("/api/global-tokens");
    if (!response.ok) {
      console.error("[TokenRegistry] Failed to fetch global tokens:", response.status, response.statusText);
      return globalTokensCache?.tokens || [];
    }

    const data = await response.json();
    console.log(`[TokenRegistry] Global tokens response: configured=${data.configured}, count=${data.count || data.tokens?.length || 0}`);

    if (!data.configured) {
      console.log("[TokenRegistry] Database not configured");
      return [];
    }

    if (!data.tokens || !Array.isArray(data.tokens)) {
      console.log("[TokenRegistry] No tokens array in response");
      return [];
    }

    // Convert to LaunchedToken format with defensive parsing
    const tokens: LaunchedToken[] = data.tokens.map((t: any) => {
      // Parse createdAt safely
      let createdAt = Date.now();
      if (t.created_at) {
        const parsed = new Date(t.created_at).getTime();
        if (!isNaN(parsed)) {
          createdAt = parsed;
        }
      }

      // Parse fee_shares - might come as string from some DB drivers
      let feeShares: Array<{ provider: string; username: string; bps: number }> = [];
      if (Array.isArray(t.fee_shares)) {
        feeShares = t.fee_shares;
      } else if (typeof t.fee_shares === 'string' && t.fee_shares.length > 2) {
        // fee_shares came back as a JSON string, parse it
        try {
          const parsed = JSON.parse(t.fee_shares);
          feeShares = Array.isArray(parsed) ? parsed : [];
          console.log(`[TokenRegistry] Parsed fee_shares from string for ${t.symbol}: ${feeShares.length} shares`);
        } catch (e) {
          console.error(`[TokenRegistry] Failed to parse fee_shares for ${t.symbol}:`, t.fee_shares);
        }
      }

      return {
        mint: t.mint,
        name: t.name,
        symbol: t.symbol,
        description: t.description,
        imageUrl: t.image_url,
        creator: t.creator_wallet,
        createdAt,
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

    console.log(`[TokenRegistry] Parsed ${tokens.length} global tokens`);
    if (tokens.length > 0) {
      console.log(`[TokenRegistry] First token: ${tokens[0].symbol} by ${tokens[0].creator?.slice(0, 8)}...`);
    }

    // Update cache
    globalTokensCache = { tokens, timestamp: now };

    return tokens;
  } catch (error) {
    console.error("[TokenRegistry] Error fetching global tokens:", error);
    return globalTokensCache?.tokens || [];
  }
}

// Save token to global database
export async function saveTokenGlobally(token: LaunchedToken): Promise<boolean> {
  try {
    const payload = {
      mint: token.mint,
      name: token.name,
      symbol: token.symbol,
      description: token.description,
      image_url: token.imageUrl,
      creator_wallet: token.creator,
      fee_shares: token.feeShares,
    };

    console.log(`[TokenRegistry] Saving token globally: ${token.symbol} (${token.mint.slice(0, 8)}...) by ${token.creator?.slice(0, 8)}...`);
    console.log(`[TokenRegistry] Fee shares count: ${token.feeShares?.length || 0}`);

    const response = await fetch("/api/global-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[TokenRegistry] Failed to save token globally: ${response.status}`, errorData);
      return false;
    }

    const result = await response.json();
    console.log(`[TokenRegistry] Token saved globally: ${result.success ? 'success' : 'failed'}`);

    // Invalidate cache so next fetch gets fresh data
    globalTokensCache = null;

    return true;
  } catch (error) {
    console.error("[TokenRegistry] Error saving token globally:", error);
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
  const seenMints = new Set(userTokens.map(t => t.mint));

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
  return tokens.some((t) => t.mint === mint) ||
         FEATURED_BAGS_TOKENS.some((t) => t.mint === mint);
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
