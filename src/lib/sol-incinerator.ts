const SOL_INCINERATOR_API_URL = "https://v1.api.sol-incinerator.com";

// --- Response Types ---

export interface BurnResponse {
  assetId: string;
  serializedTransaction: string;
  lamportsReclaimed: number;
  solanaReclaimed: number;
  transactionType: string;
  isDestructiveAction: boolean;
}

export interface CloseResponse {
  assetId: string;
  serializedTransaction: string;
  lamportsReclaimed: number;
  solanaReclaimed: number;
  transactionType: string;
  isDestructiveAction: boolean;
}

export interface BatchCloseAllResponse {
  transactions: string[];
  accountsClosed: number;
  totalLamportsReclaimed: number;
  totalSolanaReclaimed: number;
  hasDestructiveActions: boolean;
}

export interface AssetInfo {
  tokenAccount: string;
  mintAddress?: string;
  programId?: string;
  isMetaplexNFT?: boolean;
  isProgrammableNFT?: boolean;
  hasCollection?: boolean;
  tokenStandard?: number;
  frozen?: boolean;
  isZeroBalance?: boolean;
  tokenBalance?: string;
  hasHarvestFees?: boolean;
  isMplCoreNft?: boolean;
}

export interface FeeBreakdown {
  totalFee: number;
  rentReclaimed: {
    tokenAccount: number;
    metadata?: number;
    edition?: number;
    tokenRecord?: number;
  };
}

export interface BurnPreviewResponse {
  assetId: string;
  transactionType: string;
  lamportsReclaimed: number;
  solanaReclaimed: number;
  isDestructiveAction: boolean;
  assetInfo: AssetInfo;
  feeBreakdown: FeeBreakdown;
}

export interface ClosePreviewResponse {
  assetId: string;
  transactionType: string;
  lamportsReclaimed: number;
  solanaReclaimed: number;
  isDestructiveAction: boolean;
  assetInfo: AssetInfo;
  feeBreakdown: FeeBreakdown;
}

export interface BatchAccountPreview {
  assetId: string;
  transactionType: string;
  lamportsReclaimed: number;
  solanaReclaimed: number;
  isDestructiveAction: boolean;
  assetInfo: AssetInfo;
  feeBreakdown: FeeBreakdown;
}

export interface BatchCloseAllPreviewResponse {
  accountPreviews: BatchAccountPreview[];
  accountsToClose: number;
  totalLamportsReclaimed: number;
  totalSolanaReclaimed: number;
  estimatedTransactions: number;
  hasDestructiveActions: boolean;
  summary: {
    standardTokenAccounts: number;
    token2022Accounts: number;
    token2022HarvestAccounts: number;
  };
}

// --- Client ---

class SolIncineratorClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${SOL_INCINERATOR_API_URL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          let errorMessage = `API error: ${response.status} ${response.statusText}`;
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed.error?.message) errorMessage = parsed.error.message;
            else if (parsed.error) errorMessage = parsed.error;
          } catch {
            if (errorBody) errorMessage += ` - ${errorBody}`;
          }

          // Retry on 429 (upstream RPC rate limit) with longer backoff
          if (response.status === 429 && attempt < maxRetries) {
            const retryAfter = response.headers.get("Retry-After");
            const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt + 1) * 2000;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (response.status >= 500 && attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          throw new Error(errorMessage);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (
          error instanceof TypeError &&
          (error.message.includes("fetch") || error.message.includes("network")) &&
          attempt < maxRetries
        ) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        if (attempt === maxRetries) break;
        throw error;
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  async burn(params: {
    userPublicKey: string;
    assetId: string;
    feePayer?: string;
    autoCloseTokenAccounts?: boolean;
    priorityFeeMicroLamports?: number;
    burnAmount?: number;
  }): Promise<BurnResponse> {
    return this.request<BurnResponse>("/burn", params);
  }

  async close(params: {
    userPublicKey: string;
    assetId: string;
    feePayer?: string;
    priorityFeeMicroLamports?: number;
  }): Promise<CloseResponse> {
    return this.request<CloseResponse>("/close", params);
  }

  async batchCloseAll(params: {
    userPublicKey: string;
    feePayer?: string;
    priorityFeeMicroLamports?: number;
  }): Promise<BatchCloseAllResponse> {
    return this.request<BatchCloseAllResponse>("/batch/close-all", params);
  }

  async burnPreview(params: {
    userPublicKey: string;
    assetId: string;
    autoCloseTokenAccounts?: boolean;
    burnAmount?: number;
  }): Promise<BurnPreviewResponse> {
    return this.request<BurnPreviewResponse>("/burn/preview", params);
  }

  async closePreview(params: {
    userPublicKey: string;
    assetId: string;
  }): Promise<ClosePreviewResponse> {
    return this.request<ClosePreviewResponse>("/close/preview", params);
  }

  async batchCloseAllPreview(params: {
    userPublicKey: string;
  }): Promise<BatchCloseAllPreviewResponse> {
    return this.request<BatchCloseAllPreviewResponse>("/batch/close-all/preview", params);
  }

  async status(): Promise<{ status: string }> {
    const response = await fetch(`${SOL_INCINERATOR_API_URL}/`, {
      method: "GET",
    });
    return (await response.json()) as { status: string };
  }
}

// Singleton
let client: SolIncineratorClient | null = null;

export function initSolIncinerator(apiKey: string): SolIncineratorClient {
  client = new SolIncineratorClient(apiKey);
  return client;
}

export function getSolIncinerator(): SolIncineratorClient {
  if (!client) {
    const apiKey = process.env.SOL_INCINERATOR_API_KEY;
    if (!apiKey) {
      throw new Error("SOL_INCINERATOR_API_KEY not configured");
    }
    client = new SolIncineratorClient(apiKey);
  }
  return client;
}
