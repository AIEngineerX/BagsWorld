// DexScreener API client for Solana token discovery
// No authentication required, 300 requests/minute limit

const DEXSCREENER_API_URL = "https://api.dexscreener.com";

export interface DexToken {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  pairAddress?: string;
}

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

export interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { type: string; label: string; url: string }[];
}

export interface BoostedToken {
  url: string;
  chainId: string;
  tokenAddress: string;
  amount: number;
  totalAmount: number;
  icon?: string;
  name?: string;
  description?: string;
}

// Cache for API responses
let tokenCache: { data: DexToken[]; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 1000; // 60 seconds

/**
 * Fetch latest token profiles from DexScreener
 */
export async function fetchLatestTokenProfiles(): Promise<TokenProfile[]> {
  try {
    const response = await fetch(`${DEXSCREENER_API_URL}/token-profiles/latest/v1`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching token profiles:", error);
    return [];
  }
}

/**
 * Fetch top boosted tokens from DexScreener
 */
export async function fetchTopBoostedTokens(): Promise<BoostedToken[]> {
  try {
    const response = await fetch(`${DEXSCREENER_API_URL}/token-boosts/top/v1`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching boosted tokens:", error);
    return [];
  }
}

/**
 * Search for tokens by query string
 */
export async function searchTokens(query: string): Promise<DexPair[]> {
  try {
    const response = await fetch(
      `${DEXSCREENER_API_URL}/latest/dex/search?q=${encodeURIComponent(query)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    // Filter for Solana pairs only
    return (data.pairs || []).filter((pair: DexPair) => pair.chainId === "solana");
  } catch (error) {
    console.error("Error searching tokens:", error);
    return [];
  }
}

/**
 * Get token pairs by mint address
 */
export async function getTokenPairs(tokenMint: string): Promise<DexPair[]> {
  try {
    const response = await fetch(
      `${DEXSCREENER_API_URL}/token-pairs/v1/solana/${tokenMint}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching token pairs:", error);
    return [];
  }
}

/**
 * Get multiple tokens by their mint addresses (up to 30)
 */
export async function getTokensByMints(mints: string[]): Promise<DexPair[]> {
  if (mints.length === 0) return [];
  if (mints.length > 30) {
    mints = mints.slice(0, 30);
  }

  try {
    const response = await fetch(
      `${DEXSCREENER_API_URL}/tokens/v1/solana/${mints.join(",")}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching tokens by mints:", error);
    return [];
  }
}

/**
 * Convert DexScreener pair to our DexToken format
 */
function pairToToken(pair: DexPair): DexToken {
  return {
    mint: pair.baseToken.address,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    imageUrl: pair.info?.imageUrl,
    price: parseFloat(pair.priceUsd) || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    volume24h: pair.volume?.h24 || 0,
    marketCap: pair.marketCap || pair.fdv || 0,
    liquidity: pair.liquidity?.usd || 0,
    pairAddress: pair.pairAddress,
  };
}

/**
 * Fetch trending Solana tokens from multiple sources
 * This is the main function to get tokens for the game
 */
export async function fetchTrendingTokens(): Promise<DexToken[]> {
  // Check cache first
  if (tokenCache && Date.now() - tokenCache.timestamp < CACHE_DURATION) {
    return tokenCache.data;
  }

  try {
    // Fetch from multiple sources in parallel
    const [boostedTokens, profiles] = await Promise.all([
      fetchTopBoostedTokens(),
      fetchLatestTokenProfiles(),
    ]);

    // Filter for Solana tokens
    const solanaBoosted = boostedTokens.filter((t) => t.chainId === "solana");
    const solanaProfiles = profiles.filter((t) => t.chainId === "solana");

    // Collect unique token addresses
    const tokenAddresses = new Set<string>();
    solanaBoosted.forEach((t) => tokenAddresses.add(t.tokenAddress));
    solanaProfiles.slice(0, 20).forEach((t) => tokenAddresses.add(t.tokenAddress));

    // If we don't have enough, search for popular memecoins
    if (tokenAddresses.size < 10) {
      const searchResults = await searchTokens("SOL");
      searchResults.slice(0, 15).forEach((pair) => {
        if (pair.chainId === "solana") {
          tokenAddresses.add(pair.baseToken.address);
        }
      });
    }

    // Get detailed data for all tokens
    const mints = Array.from(tokenAddresses).slice(0, 30);
    if (mints.length === 0) {
      return [];
    }

    const pairs = await getTokensByMints(mints);

    // Convert to our format and filter for valid tokens
    const tokens = pairs
      .filter((pair) => pair && pair.baseToken && parseFloat(pair.priceUsd) > 0)
      .map(pairToToken)
      .filter((token) => token.marketCap > 0 || token.volume24h > 0)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 15); // Limit to 15 tokens for performance

    // Update cache
    tokenCache = {
      data: tokens,
      timestamp: Date.now(),
    };

    return tokens;
  } catch (error) {
    console.error("Error fetching trending tokens:", error);
    // Return cached data if available, even if stale
    return tokenCache?.data || [];
  }
}

/**
 * Get a single token by mint address
 */
export async function getTokenByMint(mint: string): Promise<DexToken | null> {
  try {
    const pairs = await getTokenPairs(mint);
    if (pairs.length === 0) return null;

    // Find the most liquid pair
    const bestPair = pairs.reduce((best, current) => {
      const currentLiquidity = current.liquidity?.usd || 0;
      const bestLiquidity = best.liquidity?.usd || 0;
      return currentLiquidity > bestLiquidity ? current : best;
    });

    return pairToToken(bestPair);
  } catch (error) {
    console.error("Error fetching token:", error);
    return null;
  }
}
