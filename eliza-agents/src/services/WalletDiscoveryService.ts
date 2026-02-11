// WalletDiscoveryService - Discover profitable wallets organically
// Watches who trades trending tokens early and profitably using Helius + DexScreener

import { getHeliusService, type ParsedTransaction } from "./HeliusService.js";
import { getSmartMoneyService } from "./SmartMoneyService.js";
import { getDexScreenerCache } from "./DexScreenerCache.js";

interface EarlyBuyer {
  wallet: string;
  solAmount: number;
  timestamp: number;
  signature: string;
}

interface WalletScore {
  wallet: string;
  winRate: number;
  avgProfitMultiple: number;
  tradeCount: number;
  consistency: number; // 0-1, how consistent are profits
  totalScore: number; // 0-100 composite
}

interface HotToken {
  mint: string;
  symbol: string;
  priceChange24h: number;
  volume24hUsd: number;
  liquidityUsd: number;
  pairCreatedAt: number;
}

let walletDiscoveryInstance: WalletDiscoveryService | null = null;

export class WalletDiscoveryService {
  // Rate limiting: 500ms between Helius calls (free tier safe)
  private readonly REQUEST_DELAY_MS = 500;

  // Discovery settings
  private readonly MAX_TOKENS_TO_SCAN = 10;
  private readonly MAX_EARLY_BUYERS_PER_TOKEN = 20;
  private readonly MIN_WIN_RATE = 0.55;
  private readonly MIN_TRADES = 10;
  private readonly MAX_DISCOVERED_WALLETS = 30;

  // Early buyer window: first hour after token creation
  private readonly EARLY_BUYER_WINDOW_SEC = 3600;

  // Scoring weights (total = 100)
  private readonly WEIGHT_WIN_RATE = 40;
  private readonly WEIGHT_AVG_PROFIT = 30;
  private readonly WEIGHT_CONSISTENCY = 20;
  private readonly WEIGHT_TRADE_COUNT = 10;

  // Minimum score to add as learned wallet
  private readonly MIN_SCORE_THRESHOLD = 60;

  static getInstance(): WalletDiscoveryService {
    if (!walletDiscoveryInstance) {
      walletDiscoveryInstance = new WalletDiscoveryService();
    }
    return walletDiscoveryInstance;
  }

  /**
   * Main discovery flow:
   * 1. Find hot tokens from DexScreener
   * 2. Find early buyers for each token via Helius
   * 3. Analyze each wallet's trade history
   * 4. Add high-scoring wallets to SmartMoneyService
   *
   * Returns: number of new wallets added
   */
  async discoverWallets(): Promise<number> {
    const helius = getHeliusService();
    if (!helius.isReady()) {
      console.log("[WalletDiscovery] Helius not configured, skipping discovery");
      return 0;
    }

    console.log("[WalletDiscovery] Starting wallet discovery run...");

    // Step 1: Find hot tokens
    const hotTokens = await this.findHotTokens();
    if (hotTokens.length === 0) {
      console.log("[WalletDiscovery] No hot tokens found, skipping");
      return 0;
    }
    console.log(`[WalletDiscovery] Scanning ${hotTokens.length} hot tokens...`);

    // Step 2: Find early buyers across all hot tokens
    const earlyBuyerMap = new Map<string, Set<string>>(); // wallet -> set of token mints bought early
    for (const token of hotTokens) {
      try {
        const buyers = await helius.getTokenEarlyBuyers(
          token.mint,
          this.EARLY_BUYER_WINDOW_SEC
        );

        console.log(
          `[WalletDiscovery] Token $${token.symbol}: found ${buyers.length} early buyers`
        );

        for (const buyer of buyers.slice(0, this.MAX_EARLY_BUYERS_PER_TOKEN)) {
          if (!earlyBuyerMap.has(buyer.wallet)) {
            earlyBuyerMap.set(buyer.wallet, new Set());
          }
          earlyBuyerMap.get(buyer.wallet)!.add(token.mint);
        }

        // Rate limit between token scans
        await this.delay(this.REQUEST_DELAY_MS);
      } catch (error) {
        console.error(
          `[WalletDiscovery] Failed to get early buyers for ${token.symbol}:`,
          error
        );
      }
    }

    if (earlyBuyerMap.size === 0) {
      console.log("[WalletDiscovery] No early buyers found");
      return 0;
    }

    console.log(
      `[WalletDiscovery] Found ${earlyBuyerMap.size} unique early buyer wallets`
    );

    // Prioritize wallets that appeared as early buyers on multiple tokens
    const sortedWallets = Array.from(earlyBuyerMap.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 50) // Analyze top 50 most frequent early buyers
      .map(([wallet]) => wallet);

    // Step 3: Analyze wallet profitability
    const smartMoney = getSmartMoneyService();
    const scores: WalletScore[] = [];

    for (const wallet of sortedWallets) {
      // Skip wallets already tracked
      if (smartMoney.isSmartMoney(wallet)) continue;

      try {
        const score = await this.analyzeWalletProfitability(wallet);
        if (score) {
          scores.push(score);
          console.log(
            `[WalletDiscovery] Wallet ${wallet.slice(0, 8)}... scored ${score.totalScore.toFixed(0)}/100 ` +
              `(${(score.winRate * 100).toFixed(0)}% WR, ${score.tradeCount} trades)`
          );
        }

        // Rate limit between wallet analyses
        await this.delay(this.REQUEST_DELAY_MS);
      } catch (error) {
        console.error(
          `[WalletDiscovery] Failed to analyze wallet ${wallet.slice(0, 8)}:`,
          error
        );
      }
    }

    // Step 4: Add winners
    const existingLearned = smartMoney
      .getAllWallets()
      .filter((w) => w.source === "learned").length;
    const slotsAvailable = this.MAX_DISCOVERED_WALLETS - existingLearned;

    const winners = scores
      .filter((s) => s.totalScore >= this.MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, Math.max(0, slotsAvailable));

    let added = 0;
    for (const winner of winners) {
      const tokenCount = earlyBuyerMap.get(winner.wallet)?.size || 0;
      smartMoney.addLearnedWallet(
        winner.wallet,
        `Discovered (${(winner.winRate * 100).toFixed(0)}% WR, ${tokenCount} early)`,
        {
          winRate: winner.winRate,
          recentTrades: winner.tradeCount,
          totalPnlSol: winner.avgProfitMultiple * winner.tradeCount, // rough estimate
          preferredMcapRange: "micro",
        }
      );
      added++;
    }

    // Prune stale learned wallets
    const pruned = this.pruneStaleWallets();

    console.log(
      `[WalletDiscovery] Discovery complete: +${added} new wallets, -${pruned} pruned, ` +
        `${smartMoney.getAllWallets().length} total tracked`
    );

    return added;
  }

  /**
   * Find hot tokens from DexScreener (top gainers on Solana, recently launched)
   */
  private async findHotTokens(): Promise<HotToken[]> {
    const dex = getDexScreenerCache();
    const hotTokens: HotToken[] = [];

    try {
      // Search for trending Solana tokens
      const searchResult = await dex.search("solana");
      const pairs = searchResult?.pairs || [];

      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const pair of pairs) {
        if (!pair || pair.chainId !== "solana") continue;

        const priceChange24h = pair.priceChange?.h24 || 0;
        const volume24h = pair.volume?.h24 || 0;
        const liquidity = pair.liquidity?.usd || 0;
        const createdAt = pair.pairCreatedAt || 0;

        // Filter: >50% gain, >$10K volume, >$1K liquidity, launched in last 7 days
        if (
          priceChange24h > 50 &&
          volume24h > 10_000 &&
          liquidity > 1_000 &&
          createdAt > sevenDaysAgo
        ) {
          hotTokens.push({
            mint: pair.baseToken?.address || "",
            symbol: pair.baseToken?.symbol || "???",
            priceChange24h,
            volume24hUsd: volume24h,
            liquidityUsd: liquidity,
            pairCreatedAt: createdAt,
          });
        }
      }

      // Sort by price change descending, take top N
      hotTokens.sort((a, b) => b.priceChange24h - a.priceChange24h);
      return hotTokens.slice(0, this.MAX_TOKENS_TO_SCAN);
    } catch (error) {
      console.error("[WalletDiscovery] Failed to find hot tokens:", error);
      return [];
    }
  }

  /**
   * Analyze a wallet's trade history to determine profitability
   * Returns null if insufficient data
   */
  private async analyzeWalletProfitability(
    wallet: string
  ): Promise<WalletScore | null> {
    const helius = getHeliusService();
    const history = await helius.getWalletTrades(wallet, 50);
    const trades = history.trades;

    if (trades.length < this.MIN_TRADES) return null;

    // Group trades by token mint to match buys with sells
    const tokenTrades = new Map<string, ParsedTransaction[]>();
    for (const trade of trades) {
      if (!trade.tokenMint) continue;
      if (!tokenTrades.has(trade.tokenMint)) {
        tokenTrades.set(trade.tokenMint, []);
      }
      tokenTrades.get(trade.tokenMint)!.push(trade);
    }

    let wins = 0;
    let losses = 0;
    const profitMultiples: number[] = [];

    for (const [, tokenGroup] of tokenTrades) {
      const buys = tokenGroup.filter((t) => t.type === "BUY");
      const sells = tokenGroup.filter((t) => t.type === "SELL");

      if (buys.length === 0) continue;

      const totalBuySol = buys.reduce((sum, t) => sum + t.solAmount, 0);
      const totalSellSol = sells.reduce((sum, t) => sum + t.solAmount, 0);

      if (totalBuySol === 0) continue;

      if (sells.length > 0) {
        // Completed round-trip: can calculate P&L
        const profitMultiple = totalSellSol / totalBuySol;
        profitMultiples.push(profitMultiple);

        if (profitMultiple > 1.0) {
          wins++;
        } else {
          losses++;
        }
      }
      // If no sells yet, skip (position still open)
    }

    const totalRoundTrips = wins + losses;
    if (totalRoundTrips < 3) return null; // Need at least 3 completed trades

    const winRate = wins / totalRoundTrips;
    const avgProfitMultiple =
      profitMultiples.length > 0
        ? profitMultiples.reduce((a, b) => a + b, 0) / profitMultiples.length
        : 0;

    // Consistency: standard deviation of profits (lower = more consistent)
    const mean = avgProfitMultiple;
    const variance =
      profitMultiples.length > 1
        ? profitMultiples.reduce((sum, p) => sum + (p - mean) ** 2, 0) /
          (profitMultiples.length - 1)
        : 0;
    const stdDev = Math.sqrt(variance);
    // Normalize consistency: 1.0 = perfectly consistent, 0 = highly variable
    const consistency = Math.max(0, 1 - stdDev / Math.max(mean, 1));

    // Score components (each normalized to 0-1, then weighted)
    const winRateScore = Math.min(1, winRate / 0.8); // 80% WR = max score
    const profitScore = Math.min(1, Math.max(0, (avgProfitMultiple - 1) / 2)); // 3x avg = max
    const consistencyScore = consistency;
    const tradeCountScore = Math.min(1, totalRoundTrips / 20); // 20+ trades = max

    const totalScore =
      winRateScore * this.WEIGHT_WIN_RATE +
      profitScore * this.WEIGHT_AVG_PROFIT +
      consistencyScore * this.WEIGHT_CONSISTENCY +
      tradeCountScore * this.WEIGHT_TRADE_COUNT;

    return {
      wallet,
      winRate,
      avgProfitMultiple,
      tradeCount: totalRoundTrips,
      consistency,
      totalScore,
    };
  }

  /**
   * Remove learned wallets that haven't been active in 7 days
   * Manual wallets are kept forever
   */
  private pruneStaleWallets(): number {
    const smartMoney = getSmartMoneyService();
    const allWallets = smartMoney.getAllWallets();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let pruned = 0;
    for (const wallet of allWallets) {
      if (wallet.source === "learned" && wallet.lastActive < sevenDaysAgo) {
        smartMoney.removeWallet(wallet.address);
        pruned++;
      }
    }

    return pruned;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function getWalletDiscoveryService(): WalletDiscoveryService {
  return WalletDiscoveryService.getInstance();
}

export default WalletDiscoveryService;
