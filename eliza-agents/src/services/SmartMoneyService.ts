// SmartMoneyService - Track and learn from top traders
// Sources: GMGN.ai, Birdeye, on-chain analysis

import { Service, type IAgentRuntime } from "../types/elizaos.js";

export interface SmartMoneyWallet {
  address: string;
  label: string;
  winRate: number;
  totalPnlSol: number;
  avgHoldTime: number; // minutes
  preferredMcapRange: string; // "micro" | "small" | "mid"
  recentTrades: number;
  lastActive: number;
  source: "gmgn" | "birdeye" | "manual" | "learned";
}

export interface SmartMoneyAlert {
  wallet: string;
  walletLabel: string;
  action: "buy" | "sell";
  tokenMint: string;
  tokenSymbol: string;
  amountSol: number;
  timestamp: number;
  txSignature: string;
}

export interface TokenSmartMoneyActivity {
  tokenMint: string;
  buyCount: number;
  sellCount: number;
  netBuySol: number;
  uniqueBuyers: string[];
  uniqueSellers: string[];
  lastActivity: number;
}

let smartMoneyServiceInstance: SmartMoneyService | null = null;

export class SmartMoneyService extends Service {
  static readonly serviceType = "smart_money";
  readonly capabilityDescription = "Smart money wallet tracking and analysis";

  // Tracked wallets with metadata
  private wallets: Map<string, SmartMoneyWallet> = new Map();

  // Recent smart money activity per token
  private tokenActivity: Map<string, TokenSmartMoneyActivity> = new Map();

  // Recent alerts
  private alerts: SmartMoneyAlert[] = [];

  // GMGN API (unofficial, may need updating)
  private readonly GMGN_API = "https://gmgn.ai/defi/quotation/v1";

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
    this.initializeDefaultWallets();
  }

  static async start(runtime: IAgentRuntime): Promise<SmartMoneyService> {
    console.log("[SmartMoneyService] Starting...");
    const service = new SmartMoneyService(runtime);
    smartMoneyServiceInstance = service;

    // Fetch fresh smart money data on startup
    await service.refreshSmartMoneyList();

    console.log(`[SmartMoneyService] Tracking ${service.wallets.size} smart money wallets`);
    return service;
  }

  async stop(): Promise<void> {
    smartMoneyServiceInstance = null;
  }

  /**
   * Initialize with known profitable wallets
   */
  private initializeDefaultWallets(): void {
    const defaults: SmartMoneyWallet[] = [
      // Kolscan verified top traders
      {
        address: "7xwDKXNG9dxMsBSCmiAThp7PyDaUXbm23irLr7iPeh7w",
        label: "shah (Kolscan #1)",
        winRate: 0.68,
        totalPnlSol: 234,
        avgHoldTime: 15,
        preferredMcapRange: "micro",
        recentTrades: 50,
        lastActive: Date.now(),
        source: "manual",
      },
      {
        address: "4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9",
        label: "decu (High Volume)",
        winRate: 0.65,
        totalPnlSol: 180,
        avgHoldTime: 8,
        preferredMcapRange: "micro",
        recentTrades: 227,
        lastActive: Date.now(),
        source: "manual",
      },
      {
        address: "8deJ9xwuVbfjCb1jvrDjPBLGTsHnTKwgPhV9pMLe9rSK",
        label: "Cooker (76% WR)",
        winRate: 0.76,
        totalPnlSol: 95,
        avgHoldTime: 12,
        preferredMcapRange: "small",
        recentTrades: 130,
        lastActive: Date.now(),
        source: "manual",
      },
      // GMGN featured wallets
      {
        address: "H72yLkhTnoBfhBTXXaj1RBXuirm8s8G5fcVh2XpQLggM",
        label: "GMGN Alpha",
        winRate: 0.72,
        totalPnlSol: 150,
        avgHoldTime: 5,
        preferredMcapRange: "micro",
        recentTrades: 80,
        lastActive: Date.now(),
        source: "gmgn",
      },
      {
        address: "AVAZvHLR2PcWpDf8BXY4rVxNHYRBytycHkcB5z5QNXYm",
        label: "Pump.fun Sniper",
        winRate: 0.71,
        totalPnlSol: 200,
        avgHoldTime: 3,
        preferredMcapRange: "micro",
        recentTrades: 150,
        lastActive: Date.now(),
        source: "gmgn",
      },
      {
        address: "4Be9CvxqHW6BYiRAxW9Q3xu1ycTMWaL5z8NX4HR3ha7t",
        label: "50x Flipper",
        winRate: 0.58,
        totalPnlSol: 320,
        avgHoldTime: 20,
        preferredMcapRange: "micro",
        recentTrades: 45,
        lastActive: Date.now(),
        source: "manual",
      },
      // Dune alpha
      {
        address: "8zFZHuSRuDpuAR7J6FzwyF3vKNx4CVW3DFHJerQhc7Zd",
        label: "Dune Alpha",
        winRate: 0.69,
        totalPnlSol: 175,
        avgHoldTime: 10,
        preferredMcapRange: "small",
        recentTrades: 60,
        lastActive: Date.now(),
        source: "manual",
      },
    ];

    for (const wallet of defaults) {
      this.wallets.set(wallet.address, wallet);
    }
  }

  /**
   * Refresh smart money list using WalletDiscoveryService (Helius + DexScreener).
   * Replaces the old GMGN-based approach which is Cloudflare-blocked.
   */
  async refreshSmartMoneyList(): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency at module load time
      const { getWalletDiscoveryService } = await import("./WalletDiscoveryService.js");
      const discovery = getWalletDiscoveryService();
      const added = await discovery.discoverWallets();
      if (added > 0) {
        console.log(`[SmartMoneyService] Discovered ${added} new wallets via Helius+DexScreener`);
      }
    } catch (error) {
      console.warn("[SmartMoneyService] Wallet discovery failed:", error);
    }
  }

  /**
   * Remove a wallet from tracking (used for pruning stale learned wallets)
   */
  removeWallet(address: string): boolean {
    return this.wallets.delete(address);
  }

  /**
   * Check if smart money is buying a specific token
   * Returns a score 0-100 indicating smart money interest
   */
  async getSmartMoneyScore(tokenMint: string): Promise<{
    score: number;
    buyers: string[];
    signals: string[];
  }> {
    const activity = this.tokenActivity.get(tokenMint);
    const signals: string[] = [];
    let score = 0;

    if (!activity) {
      return { score: 0, buyers: [], signals: ["no smart money activity detected"] };
    }

    // Score based on buy count
    if (activity.buyCount >= 3) {
      score += 40;
      signals.push(`${activity.buyCount} smart money buys`);
    } else if (activity.buyCount >= 1) {
      score += 20;
      signals.push(`${activity.buyCount} smart money buy`);
    }

    // Score based on net buy volume
    if (activity.netBuySol >= 1) {
      score += 30;
      signals.push(`+${activity.netBuySol.toFixed(2)} SOL net bought`);
    } else if (activity.netBuySol > 0) {
      score += 15;
      signals.push(`+${activity.netBuySol.toFixed(3)} SOL net bought`);
    } else if (activity.netBuySol < 0) {
      score -= 20;
      signals.push(`smart money selling`);
    }

    // Score based on unique buyers (more wallets = stronger signal)
    if (activity.uniqueBuyers.length >= 2) {
      score += 20;
      signals.push(`${activity.uniqueBuyers.length} unique smart wallets buying`);
    }

    // Recency bonus
    const ageMinutes = (Date.now() - activity.lastActivity) / 60000;
    if (ageMinutes <= 5) {
      score += 10;
      signals.push("activity in last 5 minutes");
    }

    // Get wallet labels for display
    const buyerLabels = activity.uniqueBuyers.map(
      (addr) => this.wallets.get(addr)?.label || addr.slice(0, 8)
    );

    return {
      score: Math.min(100, Math.max(0, score)),
      buyers: buyerLabels,
      signals,
    };
  }

  /**
   * Record smart money activity for a token
   */
  recordActivity(
    tokenMint: string,
    wallet: string,
    action: "buy" | "sell",
    amountSol: number
  ): void {
    if (!this.wallets.has(wallet)) return; // Not a tracked wallet

    let activity = this.tokenActivity.get(tokenMint);
    if (!activity) {
      activity = {
        tokenMint,
        buyCount: 0,
        sellCount: 0,
        netBuySol: 0,
        uniqueBuyers: [],
        uniqueSellers: [],
        lastActivity: Date.now(),
      };
      this.tokenActivity.set(tokenMint, activity);
    }

    if (action === "buy") {
      activity.buyCount++;
      activity.netBuySol += amountSol;
      if (!activity.uniqueBuyers.includes(wallet)) {
        activity.uniqueBuyers.push(wallet);
      }
    } else {
      activity.sellCount++;
      activity.netBuySol -= amountSol;
      if (!activity.uniqueSellers.includes(wallet)) {
        activity.uniqueSellers.push(wallet);
      }
    }

    activity.lastActivity = Date.now();

    // Also record as alert
    const walletInfo = this.wallets.get(wallet);
    this.alerts.unshift({
      wallet,
      walletLabel: walletInfo?.label || wallet.slice(0, 8),
      action,
      tokenMint,
      tokenSymbol: "", // Would need token lookup
      amountSol,
      timestamp: Date.now(),
      txSignature: "",
    });

    // Keep alerts bounded
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }
  }

  /**
   * Check if a wallet is in our smart money list
   */
  isSmartMoney(wallet: string): boolean {
    return this.wallets.has(wallet);
  }

  /**
   * Get wallet info
   */
  getWalletInfo(wallet: string): SmartMoneyWallet | null {
    return this.wallets.get(wallet) || null;
  }

  /**
   * Get all tracked wallets
   */
  getAllWallets(): SmartMoneyWallet[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Get wallet addresses for monitoring
   */
  getWalletAddresses(): string[] {
    return Array.from(this.wallets.keys());
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 20): SmartMoneyAlert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Add a wallet to track (learned from successful trades)
   */
  addLearnedWallet(address: string, label: string, stats: Partial<SmartMoneyWallet>): void {
    if (this.wallets.has(address)) return;

    this.wallets.set(address, {
      address,
      label,
      winRate: stats.winRate || 0.5,
      totalPnlSol: stats.totalPnlSol || 0,
      avgHoldTime: stats.avgHoldTime || 10,
      preferredMcapRange: stats.preferredMcapRange || "micro",
      recentTrades: stats.recentTrades || 0,
      lastActive: Date.now(),
      source: "learned",
    });

    console.log(`[SmartMoneyService] Added learned wallet: ${label}`);
  }

  /**
   * Clean up old activity data
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const [mint, activity] of this.tokenActivity) {
      if (activity.lastActivity < oneHourAgo) {
        this.tokenActivity.delete(mint);
      }
    }
  }
}

export function getSmartMoneyService(): SmartMoneyService {
  if (!smartMoneyServiceInstance) {
    smartMoneyServiceInstance = new SmartMoneyService();
  }
  return smartMoneyServiceInstance;
}

export default SmartMoneyService;
