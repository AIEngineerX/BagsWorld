// Token Registry - stores launched tokens in localStorage
// This is the core of the BagsWorld experience - tokens users launch become buildings

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
  lastUpdated?: number;
}

const STORAGE_KEY = "bagsworld_tokens";
const FEATURED_TOKENS_KEY = "bagsworld_featured";

// Featured Bags.fm tokens - curated list that shows for all users
// These are example/popular tokens from the Bags.fm ecosystem
export const FEATURED_BAGS_TOKENS: LaunchedToken[] = [
  // Add real Bags.fm tokens here as they're discovered
  // Example format:
  // {
  //   mint: "CyXBDcVQuHyEDbG661Jf3iHqxyd9wNHhE2SiQdNrBAGS",
  //   name: "Example Token",
  //   symbol: "EX",
  //   creator: "...",
  //   createdAt: Date.now(),
  // }
];

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

// Get all tokens for the world (user's + featured)
export function getAllWorldTokens(): LaunchedToken[] {
  const userTokens = getLaunchedTokens();

  // Combine user tokens with featured tokens
  // User tokens appear first, then featured
  const allTokens = [...userTokens];

  // Add featured tokens that aren't already in user's list
  FEATURED_BAGS_TOKENS.forEach((featured) => {
    if (!allTokens.some((t) => t.mint === featured.mint)) {
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
