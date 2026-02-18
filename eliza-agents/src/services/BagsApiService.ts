import { Service, type IAgentRuntime } from "../types/elizaos.js";

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  creator?: string;
  marketCap?: number;
  volume24h?: number;
  lifetimeFees?: number;
  holders?: number;
  price?: number;
  change24h?: number;
}

export interface CreatorFees {
  mint: string;
  totalFees: number;
  claimedFees: number;
  unclaimedFees: number;
  creatorAddress: string;
}

export interface TopCreator {
  address: string;
  name?: string;
  totalFees: number;
  rank: number;
}

export interface RecentLaunch {
  mint: string;
  name: string;
  symbol: string;
  launchedAt: number;
  creator: string;
  initialMarketCap?: number;
  imageUrl?: string;
  // DexScreener data for better evaluation
  _dexData?: {
    liquidityUsd: number;
    volume24hUsd: number;
    buys24h: number;
    sells24h: number;
    priceChange24h: number;
  };
}

export interface WorldHealthData {
  health: number;
  weather: string;
  totalVolume24h: number;
  totalFees24h: number;
  totalLifetimeFees?: number;
  activeTokens: number;
  topCreators: TopCreator[];
}

export interface ClaimablePosition {
  baseMint: string;
  quoteMint: string;
  virtualPool: string;
  isMigrated: boolean;
  totalClaimableLamportsUserShare: number;
  claimableDisplayAmount: number;
  userBps: number;
  tokenName?: string;
  tokenSymbol?: string;
  tokenLogoUrl?: string;
}

export interface TradeQuote {
  requestId: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: RouteLeg[];
  _jupiterQuote?: unknown;
}

export interface RouteLeg {
  venue: string;
  inAmount: string;
  outAmount: string;
  inputMint: string;
  outputMint: string;
}

export interface TokenCreationResult {
  tokenMint: string;
  tokenMetadata: string;
}

export interface FeeShareConfigResult {
  configId: string;
  totalBps: number;
  needsCreation?: boolean;
  transactions?: Array<{
    transaction: string;
    blockhash: { blockhash: string; lastValidBlockHeight: number };
  }>;
}

export interface LaunchTransactionResult {
  transaction: string;
  lastValidBlockHeight?: number;
}

export interface SwapTransactionResult {
  swapTransaction: string;
  computeUnitLimit: number;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface ClaimTransactionsResult {
  transactions: string[];
  computeUnitLimit: number;
}

export interface WalletLookupResult {
  wallet: string;
  platformData: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface BulkWalletLookupItem {
  wallet: string;
  provider: string;
  username: string;
  platformData?: {
    avatarUrl?: string;
    displayName?: string;
  };
}

export interface FeeClaimer {
  provider: string;
  providerUsername: string;
  bps: number;
}

export interface TokenCreationData {
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface LaunchTransactionData {
  ipfs: string;
  tokenMint: string;
  wallet: string;
  initialBuyLamports: number;
  configKey: string;
  tipWallet?: string;
  tipLamports?: number;
}

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000;
const MAX_CACHE_SIZE = 500;

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    cleanupCache();
  }
  cache.set(key, { data, timestamp: Date.now() });
}

export function cleanupCache(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
      cleaned++;
    }
  }
  return cleaned;
}

interface ApiResponse<T> {
  success: boolean;
  response?: T;
  error?: string;
}

interface BagsApiConfig {
  baseUrl?: string;
  apiKey?: string;
  bagsWorldUrl?: string;
  /** When true, API errors are thrown instead of returning null/empty. Default: false */
  throwOnError?: boolean;
}

function isRuntime(arg: unknown): arg is IAgentRuntime {
  return arg !== null && typeof arg === "object" && "getSetting" in arg;
}

export class BagsApiService extends Service {
  static readonly serviceType = "bags_api";

  readonly capabilityDescription = "Bags.fm API integration";

  private baseUrl: string;
  private apiKey: string;
  private bagsWorldUrl: string;
  /** When true, API errors are thrown instead of returning null/empty arrays */
  private throwOnError: boolean;

  // BagsWorld partner config for fee sharing
  static readonly PARTNER_CONFIG_PDA = "5TcACd9yCLEBewdRrhk9hb6A22oS2gFLzG7oH5YCq1Po";

  constructor(runtimeOrConfig?: IAgentRuntime | BagsApiConfig) {
    super(isRuntime(runtimeOrConfig) ? runtimeOrConfig : undefined);

    if (isRuntime(runtimeOrConfig)) {
      this.baseUrl =
        (runtimeOrConfig.getSetting("BAGS_API_URL") as string) ||
        "https://public-api-v2.bags.fm/api/v1";
      this.apiKey = (runtimeOrConfig.getSetting("BAGS_API_KEY") as string) || "";
      this.bagsWorldUrl =
        (runtimeOrConfig.getSetting("BAGSWORLD_API_URL") as string) || "http://localhost:3000";
      this.throwOnError = runtimeOrConfig.getSetting("BAGS_API_THROW_ON_ERROR") === "true";
    } else if (runtimeOrConfig) {
      this.baseUrl =
        runtimeOrConfig.baseUrl ||
        process.env.BAGS_API_URL ||
        "https://public-api-v2.bags.fm/api/v1";
      this.apiKey = runtimeOrConfig.apiKey || process.env.BAGS_API_KEY || "";
      this.bagsWorldUrl =
        runtimeOrConfig.bagsWorldUrl || process.env.BAGSWORLD_API_URL || "http://localhost:3000";
      this.throwOnError = runtimeOrConfig.throwOnError ?? false;
    } else {
      this.baseUrl = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";
      this.apiKey = process.env.BAGS_API_KEY || "";
      this.bagsWorldUrl = process.env.BAGSWORLD_API_URL || "http://localhost:3000";
      this.throwOnError = ["true", "1", "yes"].includes(
        (process.env.BAGS_API_THROW_ON_ERROR || "").toLowerCase()
      );
    }
  }

  /**
   * Enable or disable strict mode (throw on API errors)
   */
  setThrowOnError(value: boolean): void {
    this.throwOnError = value;
  }

  static async start(runtime: IAgentRuntime): Promise<BagsApiService> {
    console.log("[BagsApiService] Starting service...");
    const service = new BagsApiService(runtime);

    const hasApiKey = !!service.apiKey;
    console.log(`[BagsApiService] Initialized with API URL: ${service.baseUrl}`);
    console.log(`[BagsApiService] API Key: ${hasApiKey ? "configured" : "not configured"}`);

    return service;
  }

  async stop(): Promise<void> {
    this.clearCache();
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit,
    retryCount: number = 0
  ): Promise<T> {
    const cacheKey = `${endpoint}`;
    const cached = getCached<T>(cacheKey);
    if (cached && !options?.method) return cached;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const maxRetries = 3;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorDetail = "";
        let parsedError: { success?: boolean; response?: string; error?: string } | null = null;

        const errorBody = await response.text();
        errorDetail = errorBody ? ` - ${errorBody}` : "";

        try {
          parsedError = JSON.parse(errorBody);
        } catch {
          // Not JSON, use raw text
        }

        // Handle 500 errors with retry
        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.fetch<T>(endpoint, options, retryCount + 1);
        }

        const errorMessage =
          parsedError?.error ||
          (typeof parsedError?.response === "string" ? parsedError.response : null) ||
          `API error: ${response.status} ${response.statusText}${errorDetail}`;

        throw new Error(errorMessage);
      }

      const data: ApiResponse<T> = await response.json();

      if (!data.success) {
        const errorMessage =
          data.error ||
          (typeof data.response === "string" ? data.response : null) ||
          "Unknown API error";
        throw new Error(errorMessage);
      }

      if (!options?.method) {
        setCache(cacheKey, data.response);
      }
      return data.response as T;
    } catch (error) {
      // Retry on network errors
      if (
        error instanceof TypeError &&
        error.message.includes("fetch") &&
        retryCount < maxRetries
      ) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetch<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchRaw<T>(
    endpoint: string,
    options?: RequestInit,
    retryCount: number = 0
  ): Promise<T> {
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    if (options?.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const maxRetries = 3;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.fetchRaw<T>(endpoint, options, retryCount + 1);
        }
        throw new Error(`API error ${response.status}: ${rawText}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error(`Invalid JSON response: ${rawText.substring(0, 200)}`);
      }

      // Handle wrapped response
      const result = parsed.response || parsed;
      return result as T;
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes("fetch") &&
        retryCount < maxRetries
      ) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchRaw<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getToken(mint: string): Promise<TokenInfo | null> {
    try {
      const data = await this.fetch<{ token: TokenInfo }>(`/token-launch/creator/v3?tokenMint=${mint}`);
      return data.token || null;
    } catch (error) {
      console.error(`Failed to fetch token ${mint}:`, error);
      if (this.throwOnError) throw error;
      return null;
    }
  }

  async getCreatorFees(mint: string): Promise<CreatorFees | null> {
    try {
      const data = await this.fetch<CreatorFees>(`/token-launch/lifetime-fees?tokenMint=${mint}`);
      return data;
    } catch (error) {
      console.error(`Failed to fetch fees for ${mint}:`, error);
      if (this.throwOnError) throw error;
      return null;
    }
  }

  async getTopCreators(limit: number = 10): Promise<TopCreator[]> {
    try {
      const data = await this.fetch<{ creators: TopCreator[] }>(`/creators/top?limit=${limit}`);
      return data.creators || [];
    } catch (error) {
      console.error("Failed to fetch top creators:", error);
      if (this.throwOnError) throw error;
      return [];
    }
  }

  async getRecentLaunches(limit: number = 10): Promise<RecentLaunch[]> {
    try {
      // Use DexScreener search endpoint via shared cache to prevent 429 rate limiting
      const { getDexScreenerCache } = await import("./DexScreenerCache.js");
      const data = await getDexScreenerCache().search("bags");
      const now = Date.now();

      // Filter for Bags.fm pairs on Solana
      // 24-hour window to catch runners that are still active
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

      const launches: RecentLaunch[] = (data.pairs || [])
        .filter(
          (pair: {
            chainId: string;
            dexId?: string;
            pairCreatedAt?: number;
            liquidity?: { usd?: number };
            fdv?: number;
          }) => {
            // Must be Solana + Bags.fm DEX
            if (pair.chainId !== "solana") return false;
            if (pair.dexId !== "bags") return false;
            // Filter by age - include tokens up to 24 hours old
            if (pair.pairCreatedAt && pair.pairCreatedAt < twentyFourHoursAgo) return false;
            // Must have some market cap (indicates trading activity)
            if (!pair.fdv || pair.fdv < 1000) return false;
            return true;
          }
        )
        .sort(
          (a: { pairCreatedAt?: number }, b: { pairCreatedAt?: number }) =>
            (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0)
        )
        .slice(0, limit)
        .map(
          (pair: {
            baseToken?: { address?: string; name?: string; symbol?: string };
            pairCreatedAt?: number;
            fdv?: number;
            marketCap?: number;
            liquidity?: { usd?: number };
            volume?: { h24?: number };
            txns?: { h24?: { buys?: number; sells?: number } };
            priceChange?: { h24?: number };
          }) => ({
            mint: pair.baseToken?.address || "",
            name: pair.baseToken?.name || "Unknown",
            symbol: pair.baseToken?.symbol || "???",
            launchedAt: pair.pairCreatedAt || now,
            creator: "",
            initialMarketCap: pair.marketCap || pair.fdv || 0,
            // Include DexScreener data for better evaluation
            _dexData: {
              liquidityUsd: pair.liquidity?.usd || 0,
              volume24hUsd: pair.volume?.h24 || 0,
              buys24h: pair.txns?.h24?.buys || 0,
              sells24h: pair.txns?.h24?.sells || 0,
              priceChange24h: pair.priceChange?.h24 || 0,
            },
          })
        );

      console.log(`[BagsApi] Found ${launches.length} recent Bags.fm tokens from DexScreener`);
      return launches;
    } catch (error) {
      console.error("Failed to fetch recent launches:", error);
      if (this.throwOnError) throw error;
      return [];
    }
  }

  /**
   * Fallback method using search endpoint
   */
  private async getRecentLaunchesFallback(limit: number): Promise<RecentLaunch[]> {
    try {
      // Search for common memecoin terms on Bags
      const searches = ["SOL", "MEME", "DEGEN", "PUMP"];
      const allPairs: any[] = [];

      for (const term of searches) {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${term}`);
        if (response.ok) {
          const data = await response.json();
          const bagsPairs = (data.pairs || []).filter(
            (p: { chainId: string; dexId?: string }) => p.chainId === "solana" && p.dexId === "bags"
          );
          allPairs.push(...bagsPairs);
        }
        // Small delay between searches
        await new Promise((r) => setTimeout(r, 200));
      }

      // Dedupe by mint address
      const seenMints = new Set<string>();
      const uniquePairs = allPairs.filter((p) => {
        const mint = p.baseToken?.address;
        if (!mint || seenMints.has(mint)) return false;
        seenMints.add(mint);
        return true;
      });

      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      return uniquePairs
        .filter((p) => !p.pairCreatedAt || p.pairCreatedAt >= twoHoursAgo)
        .sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0))
        .slice(0, limit)
        .map((pair) => ({
          mint: pair.baseToken?.address || "",
          name: pair.baseToken?.name || "Unknown",
          symbol: pair.baseToken?.symbol || "???",
          launchedAt: pair.pairCreatedAt || now,
          creator: "",
          initialMarketCap: pair.marketCap || pair.fdv || 0,
          _dexData: {
            liquidityUsd: pair.liquidity?.usd || 0,
            volume24hUsd: pair.volume?.h24 || 0,
            buys24h: pair.txns?.h24?.buys || 0,
            sells24h: pair.txns?.h24?.sells || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
          },
        }));
    } catch (error) {
      console.error("[BagsApi] Fallback search failed:", error);
      return [];
    }
  }

  async getWorldHealth(): Promise<WorldHealthData | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${this.bagsWorldUrl}/api/world-state`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(
          `World health API error: ${response.status} ${response.statusText}`
        );
        if (this.throwOnError) throw error;
        return null;
      }

      const data = await response.json();
      return {
        health: data.health || 50,
        weather: data.weather || "cloudy",
        totalVolume24h: data.volume24h || 0,
        totalFees24h: data.fees24h || 0,
        activeTokens: data.activeTokens || 0,
        topCreators: data.topCreators || [],
      };
    } catch (error) {
      console.error("Failed to fetch world health:", error);
      if (this.throwOnError) throw error;
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async searchTokens(query: string): Promise<TokenInfo[]> {
    try {
      const data = await this.fetch<{ tokens: TokenInfo[] }>(
        `/tokens/search?q=${encodeURIComponent(query)}`
      );
      return data.tokens || [];
    } catch (error) {
      console.error(`Failed to search tokens for "${query}":`, error);
      if (this.throwOnError) throw error;
      return [];
    }
  }

  async getTokenCreators(tokenMint: string): Promise<
    Array<{
      wallet: string;
      provider: string;
      providerUsername: string;
      username?: string;
    }>
  > {
    const params = new URLSearchParams({ tokenMint });
    return this.fetch(`/token-launch/creator/v3?${params}`);
  }

  async getTokenLifetimeFees(tokenMint: string): Promise<{
    mint: string;
    lifetimeFees: number;
    totalClaimed: number;
    totalUnclaimed: number;
  }> {
    const params = new URLSearchParams({ tokenMint });
    return this.fetch(`/token-launch/lifetime-fees?${params}`);
  }

  async getWalletByUsername(provider: string, username: string): Promise<WalletLookupResult> {
    const params = new URLSearchParams({ provider, username });
    return this.fetch(`/token-launch/fee-share/wallet/v2?${params}`);
  }

  async bulkWalletLookup(
    items: Array<{ provider: string; username: string }>
  ): Promise<BulkWalletLookupItem[]> {
    return this.fetch("/token-launch/fee-share/wallet/v2/bulk", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }
  async getClaimablePositions(wallet: string): Promise<ClaimablePosition[]> {
    try {
      const params = new URLSearchParams({ wallet });
      const result = await this.fetch<ClaimablePosition[]>(
        `/token-launch/claimable-positions?${params}`
      );
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(`[BagsApiService] Failed to get claimable positions for ${wallet}:`, error);
      if (this.throwOnError) throw error;
      return [];
    }
  }

  /**
   * Get a summary of total claimable fees for a wallet
   */
  async getWalletClaimStats(wallet: string): Promise<{
    totalClaimableLamports: number;
    totalClaimableSol: number;
    positionCount: number;
    positions: Array<{
      mint: string;
      symbol: string;
      claimableLamports: number;
      claimableSol: number;
    }>;
  }> {
    const positions = await this.getClaimablePositions(wallet);

    const totalClaimableLamports = positions.reduce(
      (sum, pos) => sum + (pos.totalClaimableLamportsUserShare || 0),
      0
    );

    return {
      totalClaimableLamports,
      totalClaimableSol: totalClaimableLamports / 1_000_000_000,
      positionCount: positions.length,
      positions: positions
        .filter((p) => p.totalClaimableLamportsUserShare > 0)
        .map((p) => ({
          mint: p.baseMint,
          symbol: p.tokenSymbol || "Unknown",
          claimableLamports: p.totalClaimableLamportsUserShare,
          claimableSol: p.totalClaimableLamportsUserShare / 1_000_000_000,
        }))
        .sort((a, b) => b.claimableLamports - a.claimableLamports),
    };
  }

  /**
   * Get claim history/events for a token
   * Uses Bags.fm API: /fee-share/token/claim-events
   */
  async getClaimEvents(
    tokenMint: string,
    options?: { limit?: number; offset?: number }
  ): Promise<
    Array<{
      wallet: string;
      amount: number;
      timestamp: number;
      txSignature: string;
    }>
  > {
    try {
      const params = new URLSearchParams({
        tokenMint,
        limit: String(options?.limit || 20),
        offset: String(options?.offset || 0),
      });
      const result = await this.fetch<
        Array<{
          wallet: string;
          amount: number;
          timestamp: number;
          txSignature: string;
        }>
      >(`/fee-share/token/claim-events?${params}`);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(`[BagsApiService] Failed to get claim events for ${tokenMint}:`, error);
      if (this.throwOnError) throw error;
      return [];
    }
  }

  async generateClaimTransactions(
    wallet: string,
    positions: string[]
  ): Promise<ClaimTransactionsResult> {
    return this.fetch("/token-launch/claim-txs/v2", {
      method: "POST",
      body: JSON.stringify({ wallet, positions }),
    });
  }

  /**
   * Get trade quote from Jupiter API
   * Jupiter provides better liquidity access across all Solana DEXes
   */
  async getTradeQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps?: number
  ): Promise<TradeQuote> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: (slippageBps || 100).toString(),
      restrictIntermediateTokens: "true", // More stable routes
    });

    const response = await fetch(`https://lite-api.jup.ag/swap/v1/quote?${params}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter quote failed: ${response.status} - ${error}`);
    }

    const quote = await response.json();
    return {
      requestId: quote.requestId ?? '',
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      minOutAmount: quote.otherAmountThreshold ?? quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
      slippageBps: quote.slippageBps ?? (slippageBps || 300),
      routePlan: quote.routePlan ?? [],
      _jupiterQuote: quote,
    } as TradeQuote;
  }

  /**
   * Get a sell quote directly from the bags.fm bonding curve.
   * This returns the ACTUAL SOL you'd receive for selling tokens — more accurate
   * than spot price for P&L calculation on bonding curve tokens.
   * Reference: BagBot position-value.ts
   */
  async getBondingCurveSellQuote(
    tokenMint: string,
    tokenAmountRaw: number
  ): Promise<{ outSol: number; priceImpactPct: number } | null> {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const LAMPORTS_PER_SOL = 1_000_000_000;

    try {
      const params = new URLSearchParams({
        inputMint: tokenMint,
        outputMint: SOL_MINT,
        amount: Math.floor(tokenAmountRaw).toString(),
        slippageBps: "100",
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.apiKey) {
        headers["x-api-key"] = this.apiKey;
      }

      const response = await fetch(
        `${this.baseUrl}/trade/quote?${params}`,
        { headers, signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!response.ok) return null;

      const data = await response.json();
      if (data.success && data.response) {
        return {
          outSol: Number(data.response.outAmount) / LAMPORTS_PER_SOL,
          priceImpactPct: parseFloat(data.response.priceImpactPct || "0"),
        };
      }
      return null;
    } catch {
      return null; // Non-fatal — fall back to spot price
    }
  }

  /**
   * Create swap transaction via Jupiter API
   */
  async createSwapTransaction(
    quoteResponse: TradeQuote,
    userPublicKey: string
  ): Promise<SwapTransactionResult> {
    // Use the stored Jupiter quote
    const jupiterQuote = (quoteResponse as any)._jupiterQuote;
    if (!jupiterQuote) {
      throw new Error("Invalid quote - missing Jupiter quote data");
    }

    const response = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quoteResponse: jupiterQuote,
        userPublicKey,
        dynamicComputeUnitLimit: true, // Let Jupiter calculate optimal compute
        prioritizationFeeLamports: "auto", // Auto priority fee
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter swap failed: ${response.status} - ${error}`);
    }

    const swap = await response.json();
    return {
      swapTransaction: swap.swapTransaction,
      lastValidBlockHeight: swap.lastValidBlockHeight,
    } as SwapTransactionResult;
  }

  async createTokenInfo(data: TokenCreationData): Promise<TokenCreationResult> {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("symbol", data.symbol);
    formData.append("description", data.description);

    if (data.imageUrl) {
      formData.append("imageUrl", data.imageUrl);
    }

    if (data.twitter) formData.append("twitter", data.twitter);
    if (data.telegram) formData.append("telegram", data.telegram);
    if (data.website) formData.append("website", data.website);

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.baseUrl}/token-launch/create-token-info`, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${rawText}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error(`Invalid JSON response: ${rawText.substring(0, 200)}`);
      }

      if (!parsed.success) {
        const errorMessage =
          parsed.error ||
          (typeof parsed.response === "string" ? parsed.response : null) ||
          "Unknown API error";
        throw new Error(errorMessage);
      }

      return parsed.response as TokenCreationResult;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createFeeShareConfig(
    mint: string,
    feeClaimers: FeeClaimer[],
    payer: string,
    partnerWallet?: string,
    partnerConfigPda?: string
  ): Promise<FeeShareConfigResult> {
    // Separate solana wallets from social usernames
    const solanaClaimers = feeClaimers.filter((fc) => fc.provider === "solana");
    const socialClaimers = feeClaimers.filter((fc) => fc.provider !== "solana");

    // Build wallet map
    const walletMap = new Map<string, string>();

    // Solana addresses are already wallets
    for (const fc of solanaClaimers) {
      const key = `${fc.provider}:${fc.providerUsername}`;
      walletMap.set(key, fc.providerUsername);
    }

    // Bulk lookup social usernames
    if (socialClaimers.length > 0) {
      const lookupItems = socialClaimers.map((fc) => ({
        provider: fc.provider,
        username: fc.providerUsername,
      }));

      const results = await this.bulkWalletLookup(lookupItems);

      for (const result of results) {
        const key = `${result.provider}:${result.username}`;
        walletMap.set(key, result.wallet);
      }

      // Check for any missing wallets
      const missingUsers: string[] = [];
      for (const fc of socialClaimers) {
        const key = `${fc.provider}:${fc.providerUsername}`;
        if (!walletMap.has(key)) {
          missingUsers.push(`@${fc.providerUsername} (${fc.provider})`);
        }
      }
      if (missingUsers.length > 0) {
        throw new Error(
          `Could not find wallets for: ${missingUsers.join(", ")}. These users need to link their wallet at bags.fm/settings`
        );
      }
    }

    // Build arrays and deduplicate by wallet address
    const walletBpsMap = new Map<string, number>();

    for (const fc of feeClaimers) {
      const key = `${fc.provider}:${fc.providerUsername}`;
      const wallet = walletMap.get(key);
      if (!wallet) {
        throw new Error(`Could not find wallet for ${fc.provider} user: ${fc.providerUsername}`);
      }
      const existingBps = walletBpsMap.get(wallet) || 0;
      walletBpsMap.set(wallet, existingBps + fc.bps);
    }

    // Convert map to arrays
    const claimersArray: string[] = [];
    const basisPointsArray: number[] = [];

    for (const [wallet, bps] of walletBpsMap) {
      claimersArray.push(wallet);
      basisPointsArray.push(bps);
    }

    const requestBody: Record<string, unknown> = {
      baseMint: mint,
      payer,
      claimersArray,
      basisPointsArray,
    };

    // Include partner config if provided
    if (partnerWallet) {
      requestBody.partner = partnerWallet;
    }
    if (partnerConfigPda) {
      requestBody.partnerConfig = partnerConfigPda;
    }

    const result = await this.fetchRaw<{
      meteoraConfigKey?: string;
      configId?: string;
      configKey?: string;
      totalBps?: number;
      needsCreation?: boolean;
      transactions?: Array<{
        transaction: string;
        blockhash: { blockhash: string; lastValidBlockHeight: number };
      }>;
    }>("/fee-share/config", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    // Handle different possible response field names
    const configId =
      result.meteoraConfigKey ||
      result.configId ||
      result.configKey ||
      (typeof result === "string" ? result : null);

    if (!configId) {
      throw new Error(
        `Fee share config created but no configKey returned. Response keys: ${Object.keys(result).join(", ")}`
      );
    }

    return {
      configId: configId as string,
      totalBps: result.totalBps || 0,
      needsCreation: result.needsCreation,
      transactions: result.transactions,
    };
  }

  async createLaunchTransaction(data: LaunchTransactionData): Promise<LaunchTransactionResult> {
    const apiBody = {
      ipfs: data.ipfs,
      tokenMint: data.tokenMint,
      wallet: data.wallet,
      initialBuyLamports: data.initialBuyLamports,
      configKey: data.configKey,
      ...(data.tipWallet && data.tipLamports
        ? {
            tipWallet: data.tipWallet,
            tipLamports: data.tipLamports,
          }
        : {}),
    };

    const result = await this.fetchRaw<{
      transaction?: string;
      lastValidBlockHeight?: number;
    }>("/token-launch/create-launch-transaction", {
      method: "POST",
      body: JSON.stringify(apiBody),
    });

    // Extract transaction from various possible locations
    let transaction: string | undefined;
    let lastValidBlockHeight: number | undefined;

    if (typeof result === "string") {
      transaction = result;
    } else if (result.transaction) {
      transaction = result.transaction;
      lastValidBlockHeight = result.lastValidBlockHeight;
    }

    if (!transaction) {
      throw new Error(
        `No transaction found in response. Keys: ${typeof result === "object" ? Object.keys(result).join(", ") : "string"}`
      );
    }

    if (transaction.length < 100) {
      throw new Error(
        `Transaction too short (${transaction.length} chars) - API may have returned an error`
      );
    }

    return { transaction, lastValidBlockHeight };
  }

  async generatePartnerClaimTx(
    partnerKey: string,
    wallet: string
  ): Promise<{
    transaction: string;
    lastValidBlockHeight: number;
  }> {
    return this.fetch("/fee-share/partner-config/claim-tx", {
      method: "POST",
      body: JSON.stringify({ partnerKey, wallet }),
    });
  }

  async getPartnerStats(partnerKey: string): Promise<{
    totalFees: number;
    claimedFees: number;
    unclaimedFees: number;
    claimerCount: number;
  }> {
    const params = new URLSearchParams({ partnerKey });
    return this.fetch(`/fee-share/partner-config/stats?${params}`);
  }

  clearCache(): void {
    cache.clear();
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }
}

let standaloneInstance: BagsApiService | null = null;

export function getBagsApiService(
  runtimeOrConfig?: IAgentRuntime | { baseUrl?: string; apiKey?: string }
): BagsApiService {
  if (runtimeOrConfig && "getService" in runtimeOrConfig) {
    const runtime = runtimeOrConfig as IAgentRuntime;
    const service = runtime.getService<BagsApiService>(BagsApiService.serviceType);
    if (service) return service;
  }

  if (!standaloneInstance) {
    standaloneInstance = new BagsApiService();
  }
  return standaloneInstance;
}

export function resetBagsApiService(): void {
  standaloneInstance = null;
}

export default BagsApiService;
