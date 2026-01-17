/**
 * Jupiter API Client
 * Uses Jupiter Ultra Swap API for best execution across all Solana DEXs
 * Docs: https://dev.jup.ag/docs/ultra
 *
 * Ultra Swap features:
 * - RPC-less architecture (Jupiter handles everything)
 * - Gasless swaps when possible via Jupiter Z (RFQ)
 * - 50-66% faster landing via Jupiter Beam
 * - Auto MEV protection
 */

const JUPITER_ULTRA_API = "https://api.jup.ag/ultra/v1";
const JUPITER_QUOTE_API = "https://api.jup.ag/quote/v1";
const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";
const JUPITER_TOKEN_API = "https://tokens.jup.ag";

export interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  daily_volume?: number;
  created_at?: string;
  freeze_authority?: string | null;
  mint_authority?: string | null;
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface TokenPrice {
  id: string;
  type: string;
  price: string;
}

export class JupiterApiClient {
  private tokenCache: Map<string, JupiterToken> = new Map();
  private allTokens: JupiterToken[] = [];
  private lastTokenFetch = 0;
  private TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch all tradeable tokens from Jupiter
   */
  async getTokenList(): Promise<JupiterToken[]> {
    const now = Date.now();
    if (this.allTokens.length > 0 && now - this.lastTokenFetch < this.TOKEN_CACHE_TTL) {
      return this.allTokens;
    }

    try {
      const response = await fetch(`${JUPITER_TOKEN_API}/tokens?tags=verified,community`);
      if (!response.ok) throw new Error("Failed to fetch token list");

      this.allTokens = await response.json();
      this.lastTokenFetch = now;

      // Update cache
      this.allTokens.forEach(token => {
        this.tokenCache.set(token.address, token);
      });

      return this.allTokens;
    } catch (error) {
      console.error("Jupiter token list error:", error);
      return this.allTokens; // Return cached if available
    }
  }

  /**
   * Search tokens by symbol or name
   */
  async searchTokens(query: string, limit: number = 10): Promise<JupiterToken[]> {
    const tokens = await this.getTokenList();
    const q = query.toLowerCase();

    return tokens
      .filter(t =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q
      )
      .slice(0, limit);
  }

  /**
   * Get token by mint address
   */
  async getToken(mint: string): Promise<JupiterToken | null> {
    if (this.tokenCache.has(mint)) {
      return this.tokenCache.get(mint)!;
    }

    try {
      const response = await fetch(`${JUPITER_TOKEN_API}/token/${mint}`);
      if (!response.ok) return null;

      const token = await response.json();
      this.tokenCache.set(mint, token);
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Get trending tokens by volume (top traded)
   */
  async getTrendingTokens(limit: number = 10): Promise<JupiterToken[]> {
    try {
      // Use the tokens with daily_volume sorted
      const response = await fetch(`${JUPITER_TOKEN_API}/tokens_with_markets`);
      if (!response.ok) {
        // Fallback to regular token list
        const tokens = await this.getTokenList();
        return tokens.slice(0, limit);
      }

      const tokens: JupiterToken[] = await response.json();

      // Sort by daily volume and return top tokens
      return tokens
        .filter(t => t.daily_volume && t.daily_volume > 0)
        .sort((a, b) => (b.daily_volume || 0) - (a.daily_volume || 0))
        .slice(0, limit);
    } catch (error) {
      console.error("Trending tokens error:", error);
      const tokens = await this.getTokenList();
      return tokens.slice(0, limit);
    }
  }

  /**
   * Get token prices
   */
  async getTokenPrices(mints: string[]): Promise<Record<string, TokenPrice>> {
    try {
      const ids = mints.join(",");
      const response = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`);
      if (!response.ok) throw new Error("Failed to fetch prices");

      const data = await response.json();
      return data.data || {};
    } catch (error) {
      console.error("Price fetch error:", error);
      return {};
    }
  }

  /**
   * Get swap quote using Jupiter Quote API
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number, // in smallest unit (lamports for SOL)
    slippageBps: number = 100
  ): Promise<JupiterQuote> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: "false",
      asLegacyTransaction: "false",
    });

    const response = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Quote failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Create Ultra Swap order
   * Ultra Swap handles everything: fees, MEV protection, transaction landing
   */
  async createUltraOrder(
    inputMint: string,
    outputMint: string,
    amount: number,
    taker: string, // user wallet address
    slippageBps: number = 100
  ): Promise<{
    requestId: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapType: string;
    priceImpactPct: string;
    routePlan: any[];
    transaction: string; // base64 encoded transaction
    prioritizationType: { computeBudget: { microLamports: number; estimatedMicroLamports: number } };
    gasless: boolean;
  }> {
    const response = await fetch(`${JUPITER_ULTRA_API}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputMint,
        outputMint,
        amount: amount.toString(),
        taker,
        slippageBps,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ultra order failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Execute Ultra Swap (sign and send)
   * Returns transaction signature after Jupiter lands the transaction
   */
  async executeUltraSwap(
    requestId: string,
    signedTransaction: string // base64 encoded signed transaction
  ): Promise<{
    signature: string;
    status: "Success" | "Failed";
    slot: number;
  }> {
    const response = await fetch(`${JUPITER_ULTRA_API}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        signedTransaction,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ultra execute failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Build swap transaction (legacy method for compatibility)
   */
  async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
    options?: {
      priorityFeeLamports?: number;
      dynamicComputeUnitLimit?: boolean;
      wrapUnwrapSOL?: boolean;
    }
  ): Promise<JupiterSwapResponse> {
    const response = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: options?.wrapUnwrapSOL ?? true,
        dynamicComputeUnitLimit: options?.dynamicComputeUnitLimit ?? true,
        prioritizationFeeLamports: options?.priorityFeeLamports ?? "auto",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Swap transaction failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get new token pairs (recently listed)
   * Note: Jupiter doesn't have a direct "new pairs" endpoint,
   * so we filter by created_at if available
   */
  async getNewPairs(limit: number = 10): Promise<JupiterToken[]> {
    try {
      const response = await fetch(`${JUPITER_TOKEN_API}/tokens_with_markets`);
      if (!response.ok) return [];

      const tokens: JupiterToken[] = await response.json();

      // Filter tokens with created_at and sort by newest
      return tokens
        .filter(t => t.created_at)
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, limit);
    } catch (error) {
      console.error("New pairs error:", error);
      return [];
    }
  }
}

// Singleton instance
let jupiterClient: JupiterApiClient | null = null;

export function getJupiterClient(): JupiterApiClient {
  if (!jupiterClient) {
    jupiterClient = new JupiterApiClient();
  }
  return jupiterClient;
}
