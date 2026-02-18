// DexScreenerCache - Shared rate-limited cache for DexScreener API calls
// Prevents 429 errors by deduplicating and throttling requests across all services

interface CachedPair {
  priceNative: number;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  buys24h: number;
  sells24h: number;
  buysM5: number;   // 5-minute buy count — used for compound stop-loss (BagBot pattern)
  sellsM5: number;  // 5-minute sell count — sell pressure confirmation
  priceChange24h: number;
  marketCap: number;
  fdv: number;
  pairCreatedAt: number;
  fetchedAt: number;
}

interface PendingRequest {
  resolve: (value: CachedPair | null) => void;
  reject: (error: Error) => void;
}

const TOKEN_CACHE_TTL = 15_000; // 15 seconds
const SEARCH_CACHE_TTL = 60_000; // 60 seconds
const MIN_REQUEST_INTERVAL = 1_200; // 1.2s between requests (under 1/sec rate limit)

class DexScreenerCache {
  private tokenCache = new Map<string, CachedPair>();
  private searchCache = new Map<string, { data: any; fetchedAt: number }>();
  private requestQueue: Array<{ fn: () => Promise<void> }> = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  /**
   * Get token data with caching and rate limiting
   */
  async getTokenData(mint: string): Promise<CachedPair | null> {
    // Check cache first
    const cached = this.tokenCache.get(mint);
    if (cached && Date.now() - cached.fetchedAt < TOKEN_CACHE_TTL) {
      return cached;
    }

    // Queue the request
    return new Promise<CachedPair | null>((resolve, reject) => {
      this.requestQueue.push({
        fn: async () => {
          try {
            const result = await this.fetchTokenDirect(mint);
            resolve(result);
          } catch (error) {
            reject(error as Error);
          }
        },
      });
      this.processQueue();
    });
  }

  /**
   * Search DexScreener with caching
   */
  async search(query: string): Promise<any> {
    const cacheKey = query.toLowerCase();
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < SEARCH_CACHE_TTL) {
      return cached.data;
    }

    return new Promise<any>((resolve, reject) => {
      this.requestQueue.push({
        fn: async () => {
          try {
            const result = await this.fetchSearchDirect(query);
            resolve(result);
          } catch (error) {
            reject(error as Error);
          }
        },
      });
      this.processQueue();
    });
  }

  private async fetchTokenDirect(mint: string): Promise<CachedPair | null> {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${mint}`
      );
      if (!res.ok) {
        if (res.status === 429) {
          console.warn("[DexScreenerCache] Rate limited (429), will retry later");
        }
        return null;
      }

      const data = await res.json();
      const pair = data.pairs?.[0];
      if (!pair) return null;

      const cached: CachedPair = {
        priceNative: parseFloat(pair.priceNative) || 0,
        priceUsd: parseFloat(pair.priceUsd) || 0,
        liquidityUsd: pair.liquidity?.usd || 0,
        volume24hUsd: pair.volume?.h24 || 0,
        buys24h: pair.txns?.h24?.buys || 0,
        sells24h: pair.txns?.h24?.sells || 0,
        buysM5: pair.txns?.m5?.buys || 0,
        sellsM5: pair.txns?.m5?.sells || 0,
        priceChange24h: pair.priceChange?.h24 || 0,
        marketCap: pair.marketCap || 0,
        fdv: pair.fdv || 0,
        pairCreatedAt: pair.pairCreatedAt || 0,
        fetchedAt: Date.now(),
      };

      this.tokenCache.set(mint, cached);
      return cached;
    } catch (error) {
      console.error(`[DexScreenerCache] Fetch error for ${mint}:`, error);
      return null;
    }
  }

  private async fetchSearchDirect(query: string): Promise<any> {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        if (res.status === 429) {
          console.warn("[DexScreenerCache] Rate limited on search (429)");
        }
        return { pairs: [] };
      }

      const data = await res.json();
      this.searchCache.set(query.toLowerCase(), {
        data,
        fetchedAt: Date.now(),
      });
      return data;
    } catch (error) {
      console.error(`[DexScreenerCache] Search error for "${query}":`, error);
      return { pairs: [] };
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < MIN_REQUEST_INTERVAL) {
        await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
      }

      const item = this.requestQueue.shift();
      if (item) {
        this.lastRequestTime = Date.now();
        await item.fn();
      }
    }

    this.isProcessing = false;
  }

  /** Clear all cached data */
  clear(): void {
    this.tokenCache.clear();
    this.searchCache.clear();
  }

  /** Get cache stats for debugging */
  getStats(): { tokensCached: number; searchesCached: number; queueLength: number } {
    return {
      tokensCached: this.tokenCache.size,
      searchesCached: this.searchCache.size,
      queueLength: this.requestQueue.length,
    };
  }
}

// Singleton
let instance: DexScreenerCache | null = null;

export function getDexScreenerCache(): DexScreenerCache {
  if (!instance) {
    instance = new DexScreenerCache();
  }
  return instance;
}

export default DexScreenerCache;
