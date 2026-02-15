// HeliusService - Real-time Solana transaction tracking via Helius API
// Enables Ghost to learn from wallet trading patterns

const HELIUS_API_URL = "https://api.helius.xyz/v0";
const HELIUS_RPC_URL = "https://mainnet.helius-rpc.com";

export interface ParsedTransaction {
  signature: string;
  timestamp: number;
  type: "BUY" | "SELL" | "TRANSFER" | "UNKNOWN";
  tokenMint: string;
  tokenSymbol?: string;
  tokenAmount: number;
  solAmount: number;
  source: string; // DEX name (Jupiter, Raydium, etc.)
  success: boolean;
}

export interface WalletTradeHistory {
  wallet: string;
  trades: ParsedTransaction[];
  stats: {
    totalTrades: number;
    buys: number;
    sells: number;
    totalVolumeSol: number;
    uniqueTokens: number;
    winRate?: number;
  };
}

export interface TradeAlert {
  wallet: string;
  walletLabel?: string;
  trade: ParsedTransaction;
  isSmartMoney: boolean;
  timestamp: number;
}

let heliusServiceInstance: HeliusService | null = null;

export interface EarlyBuyer {
  wallet: string;
  solAmount: number;
  timestamp: number;
  signature: string;
}

export class HeliusService {
  private apiKey: string | null;
  private isConfigured: boolean;
  private tradeAlerts: TradeAlert[] = [];
  private readonly MAX_ALERTS = 100;

  // Wallets to track for alerts
  private trackedWallets: Map<string, string> = new Map(); // address -> label

  // Dedup: track processed transaction signatures to avoid double-counting across polls
  private processedSignatures: Set<string> = new Set();
  private static readonly MAX_PROCESSED_SIGNATURES = 500;

  // Rate limiting for Helius API calls
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL_MS = 1000;

  // Exponential backoff on 429s
  private backoffUntil = 0;
  private consecutiveRateLimits = 0;
  private readonly MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 min cap

  constructor() {
    this.apiKey = process.env.HELIUS_API_KEY || null;
    this.isConfigured = !!this.apiKey;

    if (!this.isConfigured) {
      console.log("[HeliusService] No HELIUS_API_KEY configured - limited functionality");
    } else {
      console.log("[HeliusService] Initialized with API key");
    }
  }

  static getInstance(): HeliusService {
    if (!heliusServiceInstance) {
      heliusServiceInstance = new HeliusService();
    }
    return heliusServiceInstance;
  }

  isReady(): boolean {
    return this.isConfigured;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  // Add wallet to tracking list
  trackWallet(address: string, label?: string): void {
    this.trackedWallets.set(address, label || address.slice(0, 8));
    console.log(`[HeliusService] Now tracking wallet: ${label || address.slice(0, 8)}...`);
  }

  // Remove wallet from tracking
  untrackWallet(address: string): void {
    this.trackedWallets.delete(address);
  }

  // Get tracked wallets
  getTrackedWallets(): Array<{ address: string; label: string }> {
    return Array.from(this.trackedWallets.entries()).map(([address, label]) => ({
      address,
      label,
    }));
  }

  // Fetch and parse transaction history for a wallet
  async getWalletTrades(wallet: string, limit: number = 50): Promise<WalletTradeHistory> {
    if (!this.isConfigured) {
      return this.getWalletTradesFallback(wallet, limit);
    }

    try {
      // Use Helius parsed transaction history (rate-limited with backoff)
      const response = await this.rateLimitedFetch(
        `${HELIUS_API_URL}/addresses/${wallet}/transactions?api-key=${this.apiKey}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`);
      }

      const transactions = await response.json() as Array<{
        signature: string;
        timestamp: number;
        type: string;
        source: string;
        tokenTransfers?: Array<{
          mint: string;
          tokenAmount: number;
          fromUserAccount: string;
          toUserAccount: string;
        }>;
        nativeTransfers?: Array<{
          amount: number;
          fromUserAccount: string;
          toUserAccount: string;
        }>;
        events?: {
          swap?: {
            nativeInput?: { amount: number };
            nativeOutput?: { amount: number };
            tokenInputs?: Array<{ mint: string; rawTokenAmount: { tokenAmount: string } }>;
            tokenOutputs?: Array<{ mint: string; rawTokenAmount: { tokenAmount: string } }>;
          };
        };
      }>;

      const trades: ParsedTransaction[] = [];

      for (const tx of transactions) {
        const parsed = this.parseTransaction(tx, wallet);
        if (parsed && parsed.type !== "UNKNOWN") {
          trades.push(parsed);
        }
      }

      // Calculate stats
      const buys = trades.filter(t => t.type === "BUY");
      const sells = trades.filter(t => t.type === "SELL");
      const uniqueTokens = new Set(trades.map(t => t.tokenMint)).size;
      const totalVolumeSol = trades.reduce((sum, t) => sum + t.solAmount, 0);

      return {
        wallet,
        trades,
        stats: {
          totalTrades: trades.length,
          buys: buys.length,
          sells: sells.length,
          totalVolumeSol,
          uniqueTokens,
        },
      };
    } catch (error) {
      console.error("[HeliusService] Failed to fetch wallet trades:", error);
      return this.getWalletTradesFallback(wallet, limit);
    }
  }

  // Fallback when no API key - use public RPC for basic info
  private async getWalletTradesFallback(wallet: string, limit: number): Promise<WalletTradeHistory> {
    console.log("[HeliusService] Using fallback (no API key) - limited data available");

    try {
      // Get recent signatures from public RPC
      const response = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignaturesForAddress",
          params: [wallet, { limit }],
        }),
      });

      const data = await response.json() as {
        result?: Array<{
          signature: string;
          blockTime: number;
          err: null | object;
        }>;
      };

      const signatures = data.result || [];

      return {
        wallet,
        trades: signatures.map(sig => ({
          signature: sig.signature,
          timestamp: sig.blockTime * 1000,
          type: "UNKNOWN" as const,
          tokenMint: "",
          tokenAmount: 0,
          solAmount: 0,
          source: "unknown",
          success: sig.err === null,
        })),
        stats: {
          totalTrades: signatures.length,
          buys: 0,
          sells: 0,
          totalVolumeSol: 0,
          uniqueTokens: 0,
        },
      };
    } catch (error) {
      console.error("[HeliusService] Fallback also failed:", error);
      return {
        wallet,
        trades: [],
        stats: { totalTrades: 0, buys: 0, sells: 0, totalVolumeSol: 0, uniqueTokens: 0 },
      };
    }
  }

  // Parse a Helius transaction into our format
  private parseTransaction(tx: {
    signature: string;
    timestamp: number;
    type: string;
    source: string;
    tokenTransfers?: Array<{
      mint: string;
      tokenAmount: number;
      fromUserAccount: string;
      toUserAccount: string;
    }>;
    nativeTransfers?: Array<{
      amount: number;
      fromUserAccount: string;
      toUserAccount: string;
    }>;
    events?: {
      swap?: {
        nativeInput?: { amount: number };
        nativeOutput?: { amount: number };
        tokenInputs?: Array<{ mint: string; rawTokenAmount: { tokenAmount: string } }>;
        tokenOutputs?: Array<{ mint: string; rawTokenAmount: { tokenAmount: string } }>;
      };
    };
  }, wallet: string): ParsedTransaction | null {
    // Focus on SWAP transactions (buys/sells)
    if (tx.type !== "SWAP" && !tx.events?.swap) {
      return null;
    }

    const swap = tx.events?.swap;
    if (!swap) return null;

    // Determine if BUY or SELL
    // BUY: SOL in, Token out
    // SELL: Token in, SOL out
    const solIn = swap.nativeInput?.amount || 0;
    const solOut = swap.nativeOutput?.amount || 0;
    const tokenIn = swap.tokenInputs?.[0];
    const tokenOut = swap.tokenOutputs?.[0];

    let type: "BUY" | "SELL" | "UNKNOWN" = "UNKNOWN";
    let tokenMint = "";
    let tokenAmount = 0;
    let solAmount = 0;

    if (solIn > 0 && tokenOut) {
      // Spent SOL, received token = BUY
      type = "BUY";
      tokenMint = tokenOut.mint;
      tokenAmount = parseFloat(tokenOut.rawTokenAmount.tokenAmount);
      solAmount = solIn / 1_000_000_000; // lamports to SOL
    } else if (tokenIn && solOut > 0) {
      // Spent token, received SOL = SELL
      type = "SELL";
      tokenMint = tokenIn.mint;
      tokenAmount = parseFloat(tokenIn.rawTokenAmount.tokenAmount);
      solAmount = solOut / 1_000_000_000;
    }

    if (type === "UNKNOWN") return null;

    return {
      signature: tx.signature,
      timestamp: tx.timestamp * 1000,
      type,
      tokenMint,
      tokenAmount,
      solAmount,
      source: tx.source || "unknown",
      success: true,
    };
  }

  /**
   * Rate-limited fetch wrapper for Helius API with exponential backoff on 429
   */
  private async rateLimitedFetch(url: string): Promise<Response> {
    // Check if we're in backoff from a previous 429
    const now = Date.now();
    if (now < this.backoffUntil) {
      const waitSec = Math.ceil((this.backoffUntil - now) / 1000);
      throw new Error(`Rate limited — backing off for ${waitSec}s`);
    }

    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_REQUEST_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, this.MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestTime = Date.now();

    const response = await fetch(url);

    if (response.status === 429) {
      this.consecutiveRateLimits++;
      const backoffMs = Math.min(
        this.MAX_BACKOFF_MS,
        Math.pow(2, this.consecutiveRateLimits) * 5000 // 10s, 20s, 40s, 80s, 160s, cap 300s
      );
      this.backoffUntil = Date.now() + backoffMs;
      console.warn(
        `[HeliusService] 429 rate limited (streak: ${this.consecutiveRateLimits}), backing off ${(backoffMs / 1000).toFixed(0)}s`
      );
      throw new Error(`Helius API rate limited (429) — backoff ${(backoffMs / 1000).toFixed(0)}s`);
    }

    // Reset streak on successful request
    if (this.consecutiveRateLimits > 0) {
      console.log(`[HeliusService] Rate limit cleared after ${this.consecutiveRateLimits} consecutive 429s`);
      this.consecutiveRateLimits = 0;
    }

    return response;
  }

  /**
   * Find wallets that bought a token early (within maxAgeSec of its first trade).
   * Reverse lookup: token mint -> wallets that swapped SOL for that token.
   */
  async getTokenEarlyBuyers(
    tokenMint: string,
    maxAgeSec: number = 3600
  ): Promise<EarlyBuyer[]> {
    if (!this.isConfigured) return [];

    try {
      const response = await this.rateLimitedFetch(
        `${HELIUS_API_URL}/addresses/${tokenMint}/transactions?api-key=${this.apiKey}&limit=50`
      );

      if (!response.ok) {
        console.warn(`[HeliusService] getTokenEarlyBuyers: API returned ${response.status}`);
        return [];
      }

      const transactions = await response.json() as Array<{
        signature: string;
        timestamp: number;
        type: string;
        feePayer?: string;
        events?: {
          swap?: {
            nativeInput?: { amount: number };
            nativeOutput?: { amount: number };
            tokenInputs?: Array<{ mint: string; rawTokenAmount: { tokenAmount: string } }>;
            tokenOutputs?: Array<{ mint: string; rawTokenAmount: { tokenAmount: string } }>;
          };
        };
      }>;

      if (transactions.length === 0) return [];

      // Find the earliest transaction timestamp to determine the "first trade" time
      const timestamps = transactions
        .map((tx) => tx.timestamp)
        .filter((t) => t > 0);
      if (timestamps.length === 0) return [];

      const earliestTimestamp = Math.min(...timestamps);
      const cutoff = earliestTimestamp + maxAgeSec;

      const earlyBuyers: EarlyBuyer[] = [];
      const seenWallets = new Set<string>();

      for (const tx of transactions) {
        // Only include transactions within the early window
        if (tx.timestamp > cutoff) continue;

        // Must be a swap where SOL was spent (nativeInput > 0)
        const swap = tx.events?.swap;
        if (!swap || !swap.nativeInput || swap.nativeInput.amount <= 0) continue;

        // Verify the token was received (tokenOutputs contains the target mint)
        const receivedTarget = swap.tokenOutputs?.some(
          (out) => out.mint === tokenMint
        );
        if (!receivedTarget) continue;

        const wallet = tx.feePayer || "";
        if (!wallet || seenWallets.has(wallet)) continue;
        seenWallets.add(wallet);

        earlyBuyers.push({
          wallet,
          solAmount: swap.nativeInput.amount / 1_000_000_000,
          timestamp: tx.timestamp * 1000,
          signature: tx.signature,
        });
      }

      return earlyBuyers;
    } catch (error) {
      console.error("[HeliusService] getTokenEarlyBuyers failed:", error);
      return [];
    }
  }

  // Get recent trade alerts
  getRecentAlerts(limit: number = 20): TradeAlert[] {
    return this.tradeAlerts.slice(0, limit);
  }

  // Add a trade alert (called when smart money trades detected)
  addTradeAlert(alert: TradeAlert): void {
    this.tradeAlerts.unshift(alert);
    if (this.tradeAlerts.length > this.MAX_ALERTS) {
      this.tradeAlerts.pop();
    }
  }

  // Analyze trading patterns for a wallet
  async analyzeWalletPatterns(wallet: string): Promise<{
    avgBuySize: number;
    avgSellSize: number;
    avgHoldTime: number;
    preferredDexes: string[];
    tradingHours: number[];
    winRate: number;
  }> {
    const history = await this.getWalletTrades(wallet, 100);
    const { trades } = history;

    if (trades.length === 0) {
      return {
        avgBuySize: 0,
        avgSellSize: 0,
        avgHoldTime: 0,
        preferredDexes: [],
        tradingHours: [],
        winRate: 0,
      };
    }

    const buys = trades.filter(t => t.type === "BUY");
    const sells = trades.filter(t => t.type === "SELL");

    const avgBuySize = buys.length > 0
      ? buys.reduce((sum, t) => sum + t.solAmount, 0) / buys.length
      : 0;

    const avgSellSize = sells.length > 0
      ? sells.reduce((sum, t) => sum + t.solAmount, 0) / sells.length
      : 0;

    // Count DEX usage
    const dexCounts = new Map<string, number>();
    for (const trade of trades) {
      dexCounts.set(trade.source, (dexCounts.get(trade.source) || 0) + 1);
    }
    const preferredDexes = Array.from(dexCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([dex]) => dex);

    // Trading hours (UTC)
    const hourCounts = new Map<number, number>();
    for (const trade of trades) {
      const hour = new Date(trade.timestamp).getUTCHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
    const tradingHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour);

    // Estimate win rate (simplified: if sold for more than bought)
    // This is a rough estimate - proper calculation needs price data
    const winRate = sells.length > 0 && buys.length > 0
      ? Math.min(0.6, sells.length / buys.length) // Cap at 60% as rough estimate
      : 0;

    return {
      avgBuySize,
      avgSellSize,
      avgHoldTime: 0, // Would need to match buys to sells for accurate calc
      preferredDexes,
      tradingHours,
      winRate,
    };
  }

  // Poll tracked wallets for new trades (call periodically)
  async pollTrackedWallets(): Promise<TradeAlert[]> {
    if (!this.isConfigured) {
      return [];
    }

    // If we're in backoff, skip the entire poll cycle
    if (Date.now() < this.backoffUntil) {
      const waitSec = Math.ceil((this.backoffUntil - Date.now()) / 1000);
      console.log(`[HeliusService] Skipping poll — rate limit backoff (${waitSec}s remaining)`);
      return [];
    }

    const newAlerts: TradeAlert[] = [];
    const lastCheckTime = Date.now() - 5 * 60 * 1000; // Last 5 minutes

    for (const [address, label] of this.trackedWallets) {
      // Abort remaining wallets if we hit rate limit mid-loop
      if (Date.now() < this.backoffUntil) {
        console.log(`[HeliusService] Rate limited mid-poll, skipping remaining wallets`);
        break;
      }

      try {
        const history = await this.getWalletTrades(address, 10);

        for (const trade of history.trades) {
          // Skip already-processed signatures (dedup across overlapping polls)
          if (this.processedSignatures.has(trade.signature)) continue;

          if (trade.timestamp > lastCheckTime && trade.type !== "UNKNOWN") {
            this.processedSignatures.add(trade.signature);

            const alert: TradeAlert = {
              wallet: address,
              walletLabel: label,
              trade,
              isSmartMoney: true,
              timestamp: Date.now(),
            };
            this.addTradeAlert(alert);
            newAlerts.push(alert);
          }
        }
      } catch (error) {
        // Don't log rate-limit errors per-wallet (already logged in rateLimitedFetch)
        const msg = error instanceof Error ? error.message : "";
        if (!msg.includes("Rate limited") && !msg.includes("429")) {
          console.error(`[HeliusService] Failed to poll wallet ${label}:`, error);
        }
      }
    }

    // Periodic cleanup: keep last MAX_PROCESSED_SIGNATURES to bound memory
    if (this.processedSignatures.size > HeliusService.MAX_PROCESSED_SIGNATURES) {
      const sigs = Array.from(this.processedSignatures);
      const toRemove = sigs.slice(0, sigs.length - HeliusService.MAX_PROCESSED_SIGNATURES);
      for (const sig of toRemove) {
        this.processedSignatures.delete(sig);
      }
    }

    return newAlerts;
  }
}

export function getHeliusService(): HeliusService {
  return HeliusService.getInstance();
}

export default HeliusService;
