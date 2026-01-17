import type {
  FeeEarner,
  TokenInfo,
  ClaimablePosition,
  ClaimStats,
  ClaimEvent,
  TradeQuote,
} from "./types";

const BAGS_API_URL =
  process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";

interface ApiResponse<T> {
  success: boolean;
  response?: T;
  error?: string;
}

class BagsApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = BAGS_API_URL;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Unknown API error");
    }

    return data.response as T;
  }

  // Fee Share Endpoints

  async getWalletByUsername(
    provider: string,
    username: string
  ): Promise<{
    wallet: string;
    platformData: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl?: string;
    };
  }> {
    const params = new URLSearchParams({ provider, username });
    return this.fetch(`/token-launch/fee-share/wallet/v2?${params}`);
  }

  async bulkWalletLookup(
    lookups: Array<{ provider: string; username: string }>
  ): Promise<
    Array<{
      wallet: string;
      provider: string;
      username: string;
      platformData?: {
        avatarUrl?: string;
        displayName?: string;
      };
    }>
  > {
    return this.fetch("/token-launch/fee-share/wallet/v2/bulk", {
      method: "POST",
      body: JSON.stringify({ lookups }),
    });
  }

  // Analytics Endpoints

  async getTokenLifetimeFees(tokenMint: string): Promise<{
    mint: string;
    lifetimeFees: number;
    totalClaimed: number;
    totalUnclaimed: number;
  }> {
    const params = new URLSearchParams({ mint: tokenMint });
    return this.fetch(`/token-launch/lifetime-fees?${params}`);
  }

  async getTokenCreators(tokenMint: string): Promise<
    Array<{
      wallet: string;
      provider: string;
      providerUsername: string;
      username?: string;
    }>
  > {
    const params = new URLSearchParams({ mint: tokenMint });
    return this.fetch(`/token-launch/creator/v3?${params}`);
  }

  async getClaimStats(tokenMint: string): Promise<ClaimStats[]> {
    const params = new URLSearchParams({ mint: tokenMint });
    return this.fetch(`/token-launch/claim-stats?${params}`);
  }

  async getTokenClaimEvents(
    tokenMint: string,
    limit?: number
  ): Promise<ClaimEvent[]> {
    const params = new URLSearchParams({ mint: tokenMint });
    if (limit) {
      params.set("limit", limit.toString());
    }
    return this.fetch(`/fee-share/token/claim-events?${params}`);
  }

  // Fee Claiming Endpoints

  async getClaimablePositions(wallet: string): Promise<ClaimablePosition[]> {
    const params = new URLSearchParams({ wallet });
    return this.fetch(`/token-launch/claimable-positions?${params}`);
  }

  async generateClaimTransactions(
    wallet: string,
    positions: string[]
  ): Promise<{
    transactions: string[];
    computeUnitLimit: number;
  }> {
    return this.fetch("/token-launch/claim-txs/v2", {
      method: "POST",
      body: JSON.stringify({ wallet, positions }),
    });
  }

  // Trading Endpoints

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
    });
    if (slippageBps) {
      params.set("slippageBps", slippageBps.toString());
    }
    return this.fetch(`/trade/quote?${params}`);
  }

  async createSwapTransaction(
    quoteResponse: TradeQuote,
    userPublicKey: string
  ): Promise<{
    swapTransaction: string;
    computeUnitLimit: number;
    lastValidBlockHeight: number;
    prioritizationFeeLamports: number;
  }> {
    return this.fetch("/trade/swap", {
      method: "POST",
      body: JSON.stringify({ quoteResponse, userPublicKey }),
    });
  }

  // Token Launch Endpoints

  async createTokenInfo(data: {
    name: string;
    symbol: string;
    description: string;
    imageBlob?: Blob;
    imageName?: string;
    imageUrl?: string;
    twitter?: string;
    telegram?: string;
    website?: string;
  }): Promise<{
    tokenMint: string;
    tokenMetadata: string;
  }> {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("symbol", data.symbol);
    formData.append("description", data.description);

    if (data.imageBlob) {
      // FormData.append with 3 args: (name, blob, filename)
      formData.append("image", data.imageBlob, data.imageName || "token-image.png");
    } else if (data.imageUrl) {
      formData.append("imageUrl", data.imageUrl);
    }

    if (data.twitter) formData.append("twitter", data.twitter);
    if (data.telegram) formData.append("telegram", data.telegram);
    if (data.website) formData.append("website", data.website);

    const url = `${this.baseUrl}/token-launch/create-token-info`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        // Note: Don't set Content-Type for FormData - browser sets it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result: ApiResponse<{ tokenMint: string; tokenMetadata: string }> = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Unknown API error");
    }

    return result.response as { tokenMint: string; tokenMetadata: string };
  }

  async createLaunchTransaction(data: {
    ipfs: string;
    tokenMint: string;
    wallet: string;
    initialBuyLamports: number;
    configKey: string;
    tipWallet?: string;
    tipLamports?: number;
  }): Promise<string> {
    console.log("Bags API createLaunchTransaction request:", JSON.stringify(data, null, 2));
    try {
      const result = await this.fetch<string>("/token-launch/create-launch-transaction", {
        method: "POST",
        body: JSON.stringify(data),
      });
      console.log("Bags API createLaunchTransaction response:", result);
      return result;
    } catch (error) {
      console.error("Bags API createLaunchTransaction error:", error);
      throw error;
    }
  }

  // Fee Share Configuration
  async createFeeShareConfig(
    mint: string,
    feeClaimers: Array<{
      provider: string;
      providerUsername: string;
      bps: number; // basis points (100 = 1%)
    }>
  ): Promise<{
    configId: string;
    totalBps: number;
  }> {
    return this.fetch("/fee-share/config", {
      method: "POST",
      body: JSON.stringify({ mint, feeClaimers }),
    });
  }

  // Partner Fee Claiming
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
}

// Singleton instance - will be initialized with API key
let apiClient: BagsApiClient | null = null;

export function initBagsApi(apiKey: string): BagsApiClient {
  apiClient = new BagsApiClient(apiKey);
  return apiClient;
}

export function getBagsApi(): BagsApiClient {
  if (!apiClient) {
    throw new Error("Bags API not initialized. Call initBagsApi first.");
  }
  return apiClient;
}

export { BagsApiClient };
