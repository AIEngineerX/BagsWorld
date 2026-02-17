import type {
  FeeEarner,
  TokenInfo,
  ClaimablePosition,
  ClaimStats,
  ClaimEvent,
  TradeQuote,
} from "./types";

const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";

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
        let errorDetail = "";
        let parsedError: { success?: boolean; response?: string; error?: string } | null = null;
        try {
          const errorBody = await response.text();
          errorDetail = errorBody ? ` - ${errorBody}` : "";
          try {
            parsedError = JSON.parse(errorBody);
          } catch {
            // Not JSON
          }
        } catch {
          // Can't read body
        }

        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
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

      return data.response as T;
    } catch (error) {
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
    }
  }

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

  async bulkWalletLookup(items: Array<{ provider: string; username: string }>): Promise<
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

  async getTokenLifetimeFees(tokenMint: string): Promise<number> {
    const params = new URLSearchParams({ tokenMint });
    const data = await this.fetch<string>(`/token-launch/lifetime-fees?${params}`);
    return parseInt(String(data), 10) || 0;
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
    const raw = await this.fetch<
      Array<{ wallet: string; tokenMint: string; totalClaimed: string }>
    >(`/token-launch/claim-stats?${params}`);
    return (raw ?? []).map((r) => ({
      user: r.wallet,
      totalClaimed: parseInt(r.totalClaimed, 10) || 0,
      claimCount: 0,
      lastClaimTime: 0,
    }));
  }

  async getTokenClaimEvents(tokenMint: string, limit?: number): Promise<ClaimEvent[]> {
    const params = new URLSearchParams({ tokenMint });
    if (limit) {
      params.set("limit", limit.toString());
    }
    const data = await this.fetch<{
      events: Array<{
        wallet: string;
        isCreator?: boolean;
        amount: string;
        signature: string;
        timestamp: number;
      }>;
    }>(`/fee-share/token/claim-events?${params}`);
    return (data.events ?? []).map((e) => ({
      signature: e.signature,
      claimer: e.wallet,
      amount: Number(e.amount) || 0,
      timestamp: e.timestamp,
      tokenMint,
    }));
  }

  async getTokenClaimEvents24h(tokenMint: string): Promise<ClaimEvent[]> {
    const now = Math.floor(Date.now() / 1000);
    const twentyFourHoursAgo = now - 24 * 60 * 60;

    const params = new URLSearchParams({
      tokenMint,
      mode: "time",
      from: twentyFourHoursAgo.toString(),
      to: now.toString(),
    });

    const data = await this.fetch<{
      events: Array<{
        wallet: string;
        isCreator?: boolean;
        amount: string;
        signature: string;
        timestamp: number;
      }>;
    }>(`/fee-share/token/claim-events?${params}`);
    return (data.events ?? []).map((e) => ({
      signature: e.signature,
      claimer: e.wallet,
      amount: Number(e.amount) || 0,
      timestamp: e.timestamp,
      tokenMint,
    }));
  }

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
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();

        let parsedError: { success?: boolean; response?: string; error?: string } | null = null;
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          // Not JSON
        }

        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.createTokenInfo(data, retryCount + 1);
        }

        const errorMessage =
          parsedError?.error ||
          (typeof parsedError?.response === "string" ? parsedError.response : null) ||
          `API error: ${response.status} - ${errorText}`;

        throw new Error(errorMessage);
      }

      const result: ApiResponse<{ tokenMint: string; tokenMetadata: string }> =
        await response.json();

      if (!result.success) {
        const errorMessage =
          result.error ||
          (typeof result.response === "string" ? result.response : null) ||
          "Unknown API error";
        throw new Error(errorMessage);
      }

      return result.response as { tokenMint: string; tokenMetadata: string };
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes("fetch") &&
        retryCount < maxRetries
      ) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.createTokenInfo(data, retryCount + 1);
      }
      throw error;
    }
  }

  async createLaunchTransaction(
    data: {
      ipfs: string;
      tokenMint: string;
      wallet: string;
      initialBuyLamports: number;
      configKey: string;
      tipWallet?: string;
      tipLamports?: number;
    },
    retryCount: number = 0
  ): Promise<{ transaction: string; lastValidBlockHeight?: number }> {
    const maxRetries = 3;
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

    const url = `${this.baseUrl}/token-launch/create-launch-transaction`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiBody),
      });

      const rawText = await response.text();

      if (!response.ok) {
        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.createLaunchTransaction(data, retryCount + 1);
        }
        throw new Error(`API error ${response.status}: ${rawText}`);
      }

      let data_response;
      try {
        data_response = JSON.parse(rawText);
      } catch (parseError) {
        console.error("Launch tx JSON parse error:", parseError);
        throw new Error(`Invalid JSON response from Bags API: ${rawText.substring(0, 200)}`);
      }

      let transaction: string | undefined;
      let lastValidBlockHeight: number | undefined;

      // Per API docs, primary format is { success: true, response: "<Base58 string>" }
      if (typeof data_response.response === "string") {
        transaction = data_response.response;
      } else if (data_response.response?.transaction) {
        console.log("Launch tx: matched fallback format response.transaction");
        transaction = data_response.response.transaction;
        lastValidBlockHeight = data_response.response.lastValidBlockHeight;
      } else if (data_response.transaction) {
        console.log("Launch tx: matched fallback format top-level transaction");
        transaction = data_response.transaction;
        lastValidBlockHeight = data_response.lastValidBlockHeight;
      } else if (typeof data_response === "string") {
        console.log("Launch tx: matched fallback format raw string");
        transaction = data_response;
      }

      if (!transaction) {
        throw new Error(
          `No transaction found in Bags API response. Keys: ${Object.keys(data_response).join(", ")}`
        );
      }

      if (transaction.length < 100) {
        throw new Error(
          `Transaction too short (${transaction.length} chars) - API may have returned an error`
        );
      }

      return { transaction, lastValidBlockHeight };
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes("fetch") &&
        retryCount < maxRetries
      ) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.createLaunchTransaction(data, retryCount + 1);
      }
      throw error;
    }
  }

  async createFeeShareConfig(
    mint: string,
    feeClaimers: Array<{
      provider: string;
      providerUsername: string;
      bps: number; // basis points (100 = 1%)
    }>,
    payer: string,
    partnerWallet?: string,
    partnerConfigPda?: string,
    retryCount: number = 0
  ): Promise<{
    configId: string;
    totalBps: number;
    needsCreation?: boolean;
    transactions?: Array<{
      transaction: string;
      blockhash: { blockhash: string; lastValidBlockHeight: number };
    }>;
  }> {
    const solanaClaimers = feeClaimers.filter((fc) => fc.provider === "solana");
    const socialClaimers = feeClaimers.filter((fc) => fc.provider !== "solana");

    const walletMap = new Map<string, string>();

    for (const fc of solanaClaimers) {
      const key = `${fc.provider}:${fc.providerUsername}`;
      walletMap.set(key, fc.providerUsername);
    }

    if (socialClaimers.length > 0) {
      try {
        const lookupItems = socialClaimers.map((fc) => ({
          provider: fc.provider,
          username: fc.providerUsername,
        }));

        const results = await this.bulkWalletLookup(lookupItems);

        for (const result of results) {
          const key = `${result.provider}:${result.username}`;
          walletMap.set(key, result.wallet);
        }

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
      } catch (lookupError) {
        if (
          lookupError instanceof Error &&
          lookupError.message.includes("Could not find wallets")
        ) {
          throw lookupError;
        }
        const userList = socialClaimers.map((fc) => `@${fc.providerUsername}`).join(", ");
        throw new Error(
          `Failed to lookup wallets for: ${userList}. Make sure all users have linked their wallets at bags.fm/settings`
        );
      }
    }

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

    if (partnerWallet) {
      requestBody.partner = partnerWallet;
    }
    if (partnerConfigPda) {
      requestBody.partnerConfig = partnerConfigPda;
    }

    const maxRetries = 3;
    const url = `${this.baseUrl}/fee-share/config`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const rawText = await response.text();

      if (!response.ok) {
        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.createFeeShareConfig(
            mint,
            feeClaimers,
            payer,
            partnerWallet,
            partnerConfigPda,
            retryCount + 1
          );
        }
        throw new Error(`Fee config API error ${response.status}: ${rawText.substring(0, 500)}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseError) {
        console.error("Fee config JSON parse error:", parseError);
        throw new Error(`Invalid JSON from fee config API: ${rawText.substring(0, 200)}`);
      }

      const result = parsed.response || parsed;

      // Try config ID field names in priority order, log when a non-primary field matches
      const configIdFields = [
        "meteoraConfigKey",
        "configId",
        "configKey",
        "config_id",
        "config_key",
        "key",
        "id",
        "config",
      ] as const;
      let configId: string | null = null;
      for (const field of configIdFields) {
        if (result[field] && typeof result[field] === "string") {
          configId = result[field] as string;
          if (field !== "meteoraConfigKey") {
            console.log(`Fee config: configId matched via fallback field "${field}"`);
          }
          break;
        }
      }
      if (!configId && typeof result === "string") {
        console.log("Fee config: configId matched via raw string response");
        configId = result;
      }

      const totalBps = (result.totalBps || result.total_bps || result.bps || 0) as number;
      const needsCreation = result.needsCreation as boolean | undefined;
      const transactions = result.transactions as
        | Array<{
            transaction: string;
            blockhash: { blockhash: string; lastValidBlockHeight: number };
          }>
        | undefined;

      if (!configId) {
        throw new Error(
          `No configKey in fee share response. Keys: ${Object.keys(result).join(", ")}`
        );
      }

      return {
        configId,
        totalBps,
        needsCreation,
        transactions,
      };
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes("fetch") &&
        retryCount < maxRetries
      ) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.createFeeShareConfig(
          mint,
          feeClaimers,
          payer,
          partnerWallet,
          partnerConfigPda,
          retryCount + 1
        );
      }
      throw error;
    }
  }

  async getBagsPools(): Promise<
    Array<{ tokenMint: string; dbcConfigKey: string; dbcPoolKey: string }>
  > {
    return this.fetch("/solana/bags/pools");
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
}

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
