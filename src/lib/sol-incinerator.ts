const SOL_INCINERATOR_API_URL = "https://v1.api.sol-incinerator.com";
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 5_000;
const RATE_LIMIT_MSG = "Sol Incinerator's RPC is at capacity. Please try again in ~30 seconds.";

// --- Response Types ---

export interface BurnResponse {
  assetId: string;
  serializedTransaction: string;
  lamportsReclaimed: number;
  solanaReclaimed: number;
  transactionType: string;
  isDestructiveAction: boolean;
}

// Identical shape — separate type for semantic clarity
export type CloseResponse = BurnResponse;

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

// Identical shapes — separate types for semantic clarity
export type ClosePreviewResponse = BurnPreviewResponse;
export type BatchAccountPreview = BurnPreviewResponse;

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

function isRpcRateLimit(msg: string): boolean {
  return msg.includes("max usage reached") || msg.includes("-32429");
}

class SolIncineratorClient {
  constructor(private apiKey: string) {}

  /** Single fetch with timeout. Throws on any error. */
  private async fetchApi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${SOL_INCINERATOR_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        let msg = `API error: ${response.status} ${response.statusText}`;
        try {
          const parsed = JSON.parse(text);
          msg = parsed.error?.message || parsed.error || msg;
        } catch {
          if (text) msg += ` - ${text}`;
        }
        throw new Error(msg);
      }

      const json = await response.json();
      if (json?.error?.message) throw new Error(json.error.message);
      return json as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Fetch with a single retry on rate-limit or network errors. */
  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    try {
      return await this.fetchApi<T>(endpoint, body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const retryable = isRpcRateLimit(msg) || msg.includes("fetch") || msg.includes("network");
      if (!retryable) throw err;

      console.warn(`[Sol Incinerator] ${msg}, retrying in ${RETRY_DELAY_MS}ms`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

      try {
        return await this.fetchApi<T>(endpoint, body);
      } catch (retryErr) {
        if (retryErr instanceof Error && isRpcRateLimit(retryErr.message)) {
          throw new Error(RATE_LIMIT_MSG);
        }
        throw retryErr;
      }
    }
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${SOL_INCINERATOR_API_URL}/`, { signal: controller.signal });
      return (await response.json()) as { status: string };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Singleton — lazy-initialized from env
let client: SolIncineratorClient | null = null;

export function getSolIncinerator(): SolIncineratorClient {
  if (!client) {
    const apiKey = process.env.SOL_INCINERATOR_API_KEY;
    if (!apiKey) throw new Error("SOL_INCINERATOR_API_KEY not configured");
    client = new SolIncineratorClient(apiKey);
  }
  return client;
}
