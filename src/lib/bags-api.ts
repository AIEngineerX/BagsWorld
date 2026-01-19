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
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = 3;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        // Try to get error details from response body
        let errorDetail = "";
        let parsedError: { success?: boolean; response?: string; error?: string } | null = null;
        try {
          const errorBody = await response.text();
          errorDetail = errorBody ? ` - ${errorBody}` : "";
          console.error(`Bags API error response (${endpoint}):`, errorBody);

          // Try to parse as JSON to get more specific error
          try {
            parsedError = JSON.parse(errorBody);
          } catch {
            // Not JSON, use raw text
          }
        } catch {
          // Ignore if we can't read the body
        }

        // Handle 500 errors with retry for transient issues
        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Bags API 500 error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetch<T>(endpoint, options, retryCount + 1);
        }

        // Extract error message from parsed response
        const errorMessage = parsedError?.error ||
          (typeof parsedError?.response === 'string' ? parsedError.response : null) ||
          `API error: ${response.status} ${response.statusText}${errorDetail}`;

        throw new Error(errorMessage);
      }

      const data: ApiResponse<T> = await response.json();
      console.log("Bags API raw json response:", JSON.stringify(data, null, 2));

      if (!data.success) {
        // Handle error in both 'error' and 'response' fields
        const errorMessage = data.error ||
          (typeof data.response === 'string' ? data.response : null) ||
          "Unknown API error";
        throw new Error(errorMessage);
      }

      return data.response as T;
    } catch (error) {
      // Retry on network errors
      if (error instanceof TypeError && error.message.includes('fetch') && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetch<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    }
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
    items: Array<{ provider: string; username: string }>
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
      body: JSON.stringify({ items }),
    });
  }

  // Analytics Endpoints

  async getTokenLifetimeFees(tokenMint: string): Promise<{
    mint: string;
    lifetimeFees: number;
    totalClaimed: number;
    totalUnclaimed: number;
  }> {
    const params = new URLSearchParams({ tokenMint });
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
    const params = new URLSearchParams({ tokenMint });
    return this.fetch(`/token-launch/creator/v3?${params}`);
  }

  async getClaimStats(tokenMint: string): Promise<ClaimStats[]> {
    const params = new URLSearchParams({ tokenMint });
    return this.fetch(`/token-launch/claim-stats?${params}`);
  }

  async getTokenClaimEvents(
    tokenMint: string,
    limit?: number
  ): Promise<ClaimEvent[]> {
    const params = new URLSearchParams({ tokenMint });
    if (limit) {
      params.set("limit", limit.toString());
    }
    return this.fetch(`/fee-share/token/claim-events?${params}`);
  }

  /**
   * Get claim events for a token within a time range (for 24h earnings)
   * Uses time-based filtering mode from Bags API v1.2.0+
   */
  async getTokenClaimEvents24h(tokenMint: string): Promise<ClaimEvent[]> {
    const now = Math.floor(Date.now() / 1000);
    const twentyFourHoursAgo = now - 24 * 60 * 60;

    const params = new URLSearchParams({
      tokenMint,
      mode: "time",
      from: twentyFourHoursAgo.toString(),
      to: now.toString(),
    });

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

  async createTokenInfo(
    data: {
      name: string;
      symbol: string;
      description: string;
      imageBlob?: Blob;
      imageName?: string;
      imageUrl?: string;
      twitter?: string;
      telegram?: string;
      website?: string;
    },
    retryCount: number = 0
  ): Promise<{
    tokenMint: string;
    tokenMetadata: string;
  }> {
    const maxRetries = 3;
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

    try {
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
        console.error(`createTokenInfo error response:`, errorText);

        // Try to parse JSON error
        let parsedError: { success?: boolean; response?: string; error?: string } | null = null;
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          // Not JSON
        }

        // Retry on 500 errors
        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`createTokenInfo 500 error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.createTokenInfo(data, retryCount + 1);
        }

        const errorMessage = parsedError?.error ||
          (typeof parsedError?.response === 'string' ? parsedError.response : null) ||
          `API error: ${response.status} - ${errorText}`;

        throw new Error(errorMessage);
      }

      const result: ApiResponse<{ tokenMint: string; tokenMetadata: string }> = await response.json();

      if (!result.success) {
        // Handle error in both 'error' and 'response' fields
        const errorMessage = result.error ||
          (typeof result.response === 'string' ? result.response : null) ||
          "Unknown API error";
        throw new Error(errorMessage);
      }

      return result.response as { tokenMint: string; tokenMetadata: string };
    } catch (error) {
      // Retry on network errors
      if (error instanceof TypeError && error.message.includes('fetch') && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`createTokenInfo network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.createTokenInfo(data, retryCount + 1);
      }
      throw error;
    }
  }

  async createLaunchTransaction(data: {
    ipfs: string;
    tokenMint: string;
    wallet: string;
    initialBuyLamports: number;
    configKey: string;
    tipWallet?: string;
    tipLamports?: number;
  }): Promise<{ transaction: string; lastValidBlockHeight?: number }> {
    console.log("Bags API createLaunchTransaction request:", JSON.stringify(data, null, 2));
    try {
      // The API may return either a string directly or an object with transaction field
      const result = await this.fetch<string | { transaction: string; lastValidBlockHeight?: number }>("/token-launch/create-launch-transaction", {
        method: "POST",
        body: JSON.stringify(data),
      });
      console.log("Bags API createLaunchTransaction response:", result);
      console.log("Response type:", typeof result);

      // Handle both string and object responses
      if (typeof result === "string") {
        console.log("Transaction string length:", result.length);
        console.log("Transaction preview:", result.substring(0, 100) + "...");
        if (!result || result.length < 100) {
          throw new Error(`Launch transaction API returned empty or invalid transaction (length: ${result?.length || 0})`);
        }
        return { transaction: result };
      } else if (result && typeof result === "object" && "transaction" in result) {
        const tx = (result as { transaction: string }).transaction;
        console.log("Transaction string length:", tx?.length);
        console.log("Transaction preview:", tx?.substring(0, 100) + "...");
        if (!tx || tx.length < 100) {
          throw new Error(`Launch transaction API returned empty or invalid transaction (length: ${tx?.length || 0})`);
        }
        return result;
      } else {
        console.error("Unexpected response format:", result);
        throw new Error("Invalid response format from launch transaction API");
      }
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
    }>,
    payer: string
  ): Promise<{
    configId: string;
    totalBps: number;
    needsCreation?: boolean;
    transactions?: Array<{ transaction: string; blockhash: { blockhash: string; lastValidBlockHeight: number } }>;
  }> {
    // Separate solana wallets from social usernames
    const solanaClaimers = feeClaimers.filter(fc => fc.provider === "solana");
    const socialClaimers = feeClaimers.filter(fc => fc.provider !== "solana");

    // Build wallet map
    const walletMap = new Map<string, string>();

    // Solana addresses are already wallets
    for (const fc of solanaClaimers) {
      const key = `${fc.provider}:${fc.providerUsername}`;
      walletMap.set(key, fc.providerUsername);
    }

    // Bulk lookup social usernames
    if (socialClaimers.length > 0) {
      try {
        const lookupItems = socialClaimers.map(fc => ({
          provider: fc.provider,
          username: fc.providerUsername,
        }));
        console.log("Bulk wallet lookup items:", lookupItems);

        const results = await this.bulkWalletLookup(lookupItems);
        console.log("Bulk wallet lookup results:", results);

        for (const result of results) {
          const key = `${result.provider}:${result.username}`;
          walletMap.set(key, result.wallet);
        }
      } catch (error) {
        console.error("Bulk wallet lookup failed:", error);
        throw new Error("Failed to lookup wallets for fee claimers. Make sure all users have linked their wallets at bags.fm/settings");
      }
    }

    // Build arrays and deduplicate by wallet address (combine BPS for duplicates)
    const walletBpsMap = new Map<string, number>();

    for (const fc of feeClaimers) {
      const key = `${fc.provider}:${fc.providerUsername}`;
      const wallet = walletMap.get(key);
      if (!wallet) {
        throw new Error(`Could not find wallet for ${fc.provider} user: ${fc.providerUsername}`);
      }
      // Combine BPS if wallet already exists (handles duplicates)
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

    console.log(`Fee claimers deduplicated: ${feeClaimers.length} entries -> ${claimersArray.length} unique wallets`);

    const requestBody = {
      baseMint: mint,
      payer,
      claimersArray,
      basisPointsArray,
    };
    console.log("Bags API createFeeShareConfig request:", JSON.stringify(requestBody, null, 2));
    try {
      const result = await this.fetch<Record<string, unknown>>("/fee-share/config", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
      console.log("Bags API createFeeShareConfig raw response:", JSON.stringify(result, null, 2));
      console.log("Response keys:", Object.keys(result));
      console.log("Response type:", typeof result);
      console.log("meteoraConfigKey:", result.meteoraConfigKey);
      console.log("configKey:", result.configKey);
      console.log("config:", result.config);

      // Handle different possible response field names - check all variations
      // The API returns "meteoraConfigKey" as the config key to use for launch
      const configId = (
        result.meteoraConfigKey ||
        result.configId ||
        result.configKey ||
        result.config_id ||
        result.config_key ||
        result.key ||
        result.id ||
        result.config ||
        // Sometimes the response is just the string directly
        (typeof result === "string" ? result : null)
      ) as string;

      const totalBps = (result.totalBps || result.total_bps || result.bps || 0) as number;
      const needsCreation = result.needsCreation as boolean | undefined;
      const transactions = result.transactions as Array<{ transaction: string; blockhash: { blockhash: string; lastValidBlockHeight: number } }> | undefined;

      console.log("Extracted configId:", configId, "totalBps:", totalBps, "needsCreation:", needsCreation);

      if (!configId) {
        console.error("Could not find configId in response. Full response:", result);
        throw new Error(
          `Fee share config created but no configKey returned. API response keys: ${Object.keys(result).join(", ")}. ` +
          `This may indicate a Bags.fm API change. Please report this issue.`
        );
      }

      return {
        configId,
        totalBps,
        needsCreation,
        transactions,
      };
    } catch (error) {
      console.error("Bags API createFeeShareConfig error:", error);
      throw error;
    }
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
