// GhostTrader - Autonomous trading agent for Ghost
// Evaluates new launches, executes trades, manages positions

import { NeonQueryFunction } from "@neondatabase/serverless";
import {
  BagsApiService,
  getBagsApiService,
  type RecentLaunch,
  type TokenInfo,
  type TradeQuote,
} from "./BagsApiService.js";
import { AgentCoordinator, getAgentCoordinator } from "./AgentCoordinator.js";
import { SolanaService, getSolanaService } from "./SolanaService.js";
import { SmartMoneyService, getSmartMoneyService } from "./SmartMoneyService.js";
import { getDatabase } from "../routes/shared.js";

// ============================================================================
// Constants
// ============================================================================

const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Default trading configuration (optimized for Bags.fm micro-cap tokens)
const DEFAULT_CONFIG = {
  enabled: false, // Must be explicitly enabled
  // Position sizing
  minPositionSol: 0.05,
  maxPositionSol: 0.15,
  maxTotalExposureSol: 1.5,
  maxOpenPositions: 3, // Conservative position limit
  // Profit taking - scaled exits
  takeProfitTiers: [1.5, 2.0, 3.0], // Take 33% at each tier
  trailingStopPercent: 10, // After 2x, trail by 10%
  // Risk management - tighter stop loss
  stopLossPercent: 15, // Cut losses at -15%
  // Liquidity requirements - tuned for Bags.fm micro-caps
  minLiquidityUsd: 500, // $500 minimum (Bags tokens are very small)
  minMarketCapUsd: 3000, // $3K minimum (micro-cap reality)
  // Quality filters
  maxCreatorFeeBps: 300, // 3%
  minBuySellRatio: 1.0, // Even ratio is fine (was 1.2 - too strict)
  minHolders: 5, // Lower holder requirement (new tokens)
  minVolume24hUsd: 1000, // $1K daily volume (was $5K - too strict for fresh launches)
  // Timing - EXPANDED to find more tokens
  minLaunchAgeSec: 60, // 1 minute minimum (tokens need SOME time)
  maxLaunchAgeSec: 21600, // 6 hours (was 30 min - way too restrictive)
  slippageBps: 500, // 5% slippage for low-liquidity tokens
};

// Top trader wallets to study (from Kolscan & GMGN leaderboards)
// Prioritized: Owner wallet first, then verified profitable traders
const SMART_MONEY_WALLETS = [
  // === OWNER WALLET (Priority #1) ===
  "Ccs9wSrEwmKx7iBD9H4xqd311eJUd2ufDk2ip87Knbo3", // Owner - primary learning source

  // === KOLSCAN TOP 10 (Daily PnL leaders, $100K+ verified) ===
  "7xwDKXNG9dxMsBSCmiAThp7PyDaUXbm23irLr7iPeh7w", // shah - #1, +234 SOL/day
  "4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9", // decu - #3, 147W/80L high volume
  "8deJ9xwuVbfjCb1jvrDjPBLGTsHnTKwgPhV9pMLe9rSK", // Cooker - #7, 99W/31L (76% win rate)

  // === GMGN SMART MONEY (Early entry specialists) ===
  "H72yLkhTnoBfhBTXXaj1RBXuirm8s8G5fcVh2XpQLggM", // GMGN featured - early meme entries
  "AVAZvHLR2PcWpDf8BXY4rVxNHYRBytycHkcB5z5QNXYm", // High win rate pump.fun launches
  "4Be9CvxqHW6BYiRAxW9Q3xu1ycTMWaL5z8NX4HR3ha7t", // Consistent 50x flips on Raydium

  // === DUNE ALPHA WALLETS ===
  "8zFZHuSRuDpuAR7J6FzwyF3vKNx4CVW3DFHJerQhc7Zd", // Dune alpha dashboard - high win rate

  // === ADDITIONAL KOLSCAN VERIFIED ===
  "FSAmbD6jm6SZZQadSJeC1paX3oTtAiY9hTx1UYzVoXqj", // Zil - low cap specialist
  "J6TDXvEDjbFWacRWQPiUpZNTBJBK1qsC8XTGy1tPtUXW", // Pain - #5, balanced W/L
];

// Owner wallet for priority tracking
const OWNER_WALLET = "Ccs9wSrEwmKx7iBD9H4xqd311eJUd2ufDk2ip87Knbo3";

// Wallet metadata for display
const WALLET_LABELS: Record<string, string> = {
  Ccs9wSrEwmKx7iBD9H4xqd311eJUd2ufDk2ip87Knbo3: "Owner",
  "7xwDKXNG9dxMsBSCmiAThp7PyDaUXbm23irLr7iPeh7w": "shah (Kolscan #1)",
  "4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9": "decu (High Volume)",
  "8deJ9xwuVbfjCb1jvrDjPBLGTsHnTKwgPhV9pMLe9rSK": "Cooker (76% WR)",
  H72yLkhTnoBfhBTXXaj1RBXuirm8s8G5fcVh2XpQLggM: "GMGN Alpha",
  AVAZvHLR2PcWpDf8BXY4rVxNHYRBytycHkcB5z5QNXYm: "Pump.fun Sniper",
  "4Be9CvxqHW6BYiRAxW9Q3xu1ycTMWaL5z8NX4HR3ha7t": "50x Flipper",
  "8zFZHuSRuDpuAR7J6FzwyF3vKNx4CVW3DFHJerQhc7Zd": "Dune Alpha",
  FSAmbD6jm6SZZQadSJeC1paX3oTtAiY9hTx1UYzVoXqj: "Zil (Low Cap)",
  J6TDXvEDjbFWacRWQPiUpZNTBJBK1qsC8XTGy1tPtUXW: "Pain (Balanced)",
};

// ============================================================================
// Types
// ============================================================================

export interface GhostPosition {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  entryPriceSol: number;
  amountSol: number;
  amountTokens: number;
  entryTxSignature: string;
  exitTxSignature?: string;
  status: "open" | "closed" | "failed";
  entryReason: string;
  exitReason?: string;
  pnlSol?: number;
  createdAt: Date;
  closedAt?: Date;
}

export interface TradeEvaluation {
  launch: RecentLaunch;
  token: TokenInfo | null;
  score: number;
  reasons: string[];
  redFlags: string[];
  shouldBuy: boolean;
  suggestedAmount: number;
  metrics: {
    marketCapUsd: number;
    liquidityUsd: number;
    volume24hUsd: number;
    holders: number;
    buySellRatio: number;
    ageSeconds: number;
  };
}

export interface GhostTraderConfig {
  enabled: boolean;
  // Position sizing
  minPositionSol: number;
  maxPositionSol: number;
  maxTotalExposureSol: number;
  maxOpenPositions: number;
  // Profit taking
  takeProfitTiers: number[];
  trailingStopPercent: number;
  // Risk management
  stopLossPercent: number;
  // Liquidity requirements
  minLiquidityUsd: number;
  minMarketCapUsd: number;
  // Quality filters
  maxCreatorFeeBps: number;
  minBuySellRatio: number;
  minHolders: number;
  minVolume24hUsd: number;
  // Timing
  minLaunchAgeSec: number;
  maxLaunchAgeSec: number;
  slippageBps: number;
}

export interface GhostTraderStats {
  enabled: boolean;
  openPositions: number;
  totalExposureSol: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnlSol: number;
  winRate: number;
}

// ============================================================================
// GhostTrader Service
// ============================================================================

let ghostTraderInstance: GhostTrader | null = null;

export class GhostTrader {
  private config: GhostTraderConfig;
  private bagsApi: BagsApiService;
  private coordinator: AgentCoordinator | null;
  private solanaService: SolanaService | null;
  private db: NeonQueryFunction<false, false> | null;
  private ghostWalletPrivateKey: string | null;
  private ghostWalletPublicKey: string | null;

  // In-memory position cache (synced with DB)
  private positions: Map<string, GhostPosition> = new Map();

  // Recently evaluated mints (avoid re-evaluating)
  private recentlyEvaluated: Map<string, number> = new Map();
  private static readonly EVALUATION_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes for faster iteration

  // Tracking which launches we've already traded
  private tradedMints: Set<string> = new Set();

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.bagsApi = getBagsApiService();
    this.coordinator = getAgentCoordinator();
    this.solanaService = null; // Initialized in initialize()
    this.db = getDatabase();

    // Load wallet from environment
    this.ghostWalletPrivateKey = process.env.GHOST_WALLET_PRIVATE_KEY || null;
    this.ghostWalletPublicKey = process.env.GHOST_WALLET_PUBLIC_KEY || null;

    // Load config from environment
    if (process.env.GHOST_TRADING_ENABLED === "true") {
      this.config.enabled = true;
    }
    if (process.env.GHOST_MAX_POSITION_SOL) {
      this.config.maxPositionSol = parseFloat(process.env.GHOST_MAX_POSITION_SOL);
    }
    if (process.env.GHOST_MAX_TOTAL_EXPOSURE) {
      this.config.maxTotalExposureSol = parseFloat(process.env.GHOST_MAX_TOTAL_EXPOSURE);
    }
    if (process.env.GHOST_MAX_POSITIONS) {
      this.config.maxOpenPositions = parseInt(process.env.GHOST_MAX_POSITIONS);
    }
  }

  static getInstance(): GhostTrader {
    if (!ghostTraderInstance) {
      ghostTraderInstance = new GhostTrader();
    }
    return ghostTraderInstance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    console.log("[GhostTrader] Initializing...");

    // Initialize Solana service for transaction signing
    this.solanaService = getSolanaService();
    await this.solanaService.initialize();

    // Update public key from Solana service if not set
    if (this.solanaService.isConfigured() && !this.ghostWalletPublicKey) {
      this.ghostWalletPublicKey = this.solanaService.getPublicKey();
    }

    // Initialize database table
    await this.initializeDatabase();

    // Load existing positions from database
    await this.loadPositionsFromDatabase();

    const hasWallet = this.solanaService.isConfigured();
    console.log(`[GhostTrader] Wallet: ${hasWallet ? "configured" : "NOT configured"}`);
    if (hasWallet) {
      console.log(`[GhostTrader] Wallet address: ${this.ghostWalletPublicKey?.slice(0, 8)}...`);
    }
    console.log(`[GhostTrader] Trading: ${this.config.enabled ? "ENABLED" : "DISABLED"}`);
    console.log(`[GhostTrader] Max position: ${this.config.maxPositionSol} SOL`);
    console.log(`[GhostTrader] Max exposure: ${this.config.maxTotalExposureSol} SOL`);
    console.log(`[GhostTrader] Open positions: ${this.getOpenPositionCount()}`);
  }

  private async initializeDatabase(): Promise<void> {
    if (!this.db) {
      console.warn("[GhostTrader] No database configured, positions will not persist");
      return;
    }

    await this.db`
      CREATE TABLE IF NOT EXISTS ghost_positions (
        id UUID PRIMARY KEY,
        token_mint VARCHAR(64) NOT NULL,
        token_symbol VARCHAR(20),
        token_name VARCHAR(100),
        entry_price_sol DECIMAL(18, 9) NOT NULL,
        amount_sol DECIMAL(18, 9) NOT NULL,
        amount_tokens DECIMAL(30, 0),
        entry_tx_signature VARCHAR(128),
        exit_tx_signature VARCHAR(128),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'failed')),
        entry_reason TEXT,
        exit_reason TEXT,
        pnl_sol DECIMAL(18, 9),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        closed_at TIMESTAMP WITH TIME ZONE
      )
    `;

    await this.db`
      CREATE INDEX IF NOT EXISTS idx_ghost_positions_status
      ON ghost_positions(status)
    `;

    await this.db`
      CREATE INDEX IF NOT EXISTS idx_ghost_positions_mint
      ON ghost_positions(token_mint)
    `;

    // Config table for persisting enabled state
    await this.db`
      CREATE TABLE IF NOT EXISTS ghost_config (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Load persisted enabled state
    const configRows = (await this.db`
      SELECT value FROM ghost_config WHERE key = 'trading_enabled'
    `) as Array<{ value: string }>;

    if (configRows.length > 0 && configRows[0].value === "true") {
      this.config.enabled = true;
      console.log("[GhostTrader] Loaded persisted state: ENABLED");
    }

    console.log("[GhostTrader] Database schema initialized");
  }

  private async loadPositionsFromDatabase(): Promise<void> {
    if (!this.db) return;

    const rows = (await this.db`
      SELECT * FROM ghost_positions
      WHERE status = 'open'
      ORDER BY created_at DESC
    `) as Array<{
      id: string;
      token_mint: string;
      token_symbol: string;
      token_name: string;
      entry_price_sol: string;
      amount_sol: string;
      amount_tokens: string;
      entry_tx_signature: string;
      status: string;
      entry_reason: string;
      created_at: string;
    }>;

    for (const row of rows) {
      const position: GhostPosition = {
        id: row.id,
        tokenMint: row.token_mint,
        tokenSymbol: row.token_symbol,
        tokenName: row.token_name,
        entryPriceSol: parseFloat(row.entry_price_sol),
        amountSol: parseFloat(row.amount_sol),
        amountTokens: parseFloat(row.amount_tokens),
        entryTxSignature: row.entry_tx_signature,
        status: row.status as "open" | "closed" | "failed",
        entryReason: row.entry_reason,
        createdAt: new Date(row.created_at),
      };
      this.positions.set(position.id, position);
      this.tradedMints.add(position.tokenMint);
    }

    console.log(`[GhostTrader] Loaded ${rows.length} open positions from database`);
  }

  // ==========================================================================
  // Trading Logic
  // ==========================================================================

  /**
   * Evaluate new launches and execute trades
   * Called periodically by AutonomousService
   */
  async evaluateAndTrade(): Promise<void> {
    if (!this.config.enabled) {
      console.log("[GhostTrader] Trading disabled, skipping evaluation");
      return;
    }

    if (!this.ghostWalletPrivateKey || !this.ghostWalletPublicKey) {
      console.log("[GhostTrader] No wallet configured, skipping evaluation");
      return;
    }

    // Check if we have capacity for new positions
    const openCount = this.getOpenPositionCount();
    const totalExposure = this.getTotalExposure();

    if (openCount >= this.config.maxOpenPositions) {
      console.log(
        `[GhostTrader] At max positions (${openCount}/${this.config.maxOpenPositions}), skipping`
      );
      return;
    }

    if (totalExposure >= this.config.maxTotalExposureSol) {
      console.log(
        `[GhostTrader] At max exposure (${totalExposure}/${this.config.maxTotalExposureSol} SOL), skipping`
      );
      return;
    }

    // Fetch recent launches
    const launches = await this.bagsApi.getRecentLaunches(20);
    console.log(`[GhostTrader] Evaluating ${launches.length} recent launches`);

    const evaluations: TradeEvaluation[] = [];

    for (const launch of launches) {
      // Skip if already traded or recently evaluated
      if (this.tradedMints.has(launch.mint)) continue;
      if (this.wasRecentlyEvaluated(launch.mint)) continue;

      const evaluation = await this.evaluateLaunch(launch);
      this.markAsEvaluated(launch.mint);

      if (evaluation.shouldBuy) {
        evaluations.push(evaluation);
      }
    }

    // Sort by score and take the best one
    evaluations.sort((a, b) => b.score - a.score);

    if (evaluations.length > 0) {
      const best = evaluations[0];
      console.log(
        `[GhostTrader] Best candidate: ${best.launch.symbol} (score: ${best.score}, reasons: ${best.reasons.join(", ")})`
      );

      // Execute trade
      await this.executeBuy(best);
    } else {
      console.log("[GhostTrader] No suitable launches found");
    }
  }

  /**
   * Check positions for take-profit or stop-loss
   * Uses scaled exits and trailing stops for better profit capture
   * Called periodically by AutonomousService
   */
  async checkPositions(): Promise<void> {
    if (!this.config.enabled) return;

    const openPositions = Array.from(this.positions.values()).filter((p) => p.status === "open");

    for (const position of openPositions) {
      const token = await this.bagsApi.getToken(position.tokenMint);
      if (!token) continue;

      const currentPriceSol = token.price || 0;
      if (currentPriceSol === 0) continue;

      // Calculate current multiplier (1.0 = breakeven)
      const currentMultiplier = currentPriceSol / position.entryPriceSol;
      const priceChangePercent = (currentMultiplier - 1) * 100;

      // Track highest multiplier for trailing stop
      const peakMultiplier = (position as any).peakMultiplier || currentMultiplier;
      if (currentMultiplier > peakMultiplier) {
        (position as any).peakMultiplier = currentMultiplier;
      }

      // === STOP LOSS CHECK ===
      if (priceChangePercent <= -this.config.stopLossPercent) {
        console.log(
          `[GhostTrader] Stop loss triggered for ${position.tokenSymbol} (${priceChangePercent.toFixed(1)}%)`
        );
        await this.executeClose(position, "stop_loss", currentPriceSol);
        continue;
      }

      // === TRAILING STOP (after reaching 2x) ===
      if (peakMultiplier >= 2.0) {
        const trailingStopLevel = peakMultiplier * (1 - this.config.trailingStopPercent / 100);
        if (currentMultiplier <= trailingStopLevel) {
          console.log(
            `[GhostTrader] Trailing stop triggered for ${position.tokenSymbol} ` +
              `(peak: ${peakMultiplier.toFixed(2)}x, current: ${currentMultiplier.toFixed(2)}x)`
          );
          await this.executeClose(position, "trailing_stop", currentPriceSol);
          continue;
        }
      }

      // === SCALED TAKE-PROFIT ===
      // Check if we've hit the highest tier (full exit)
      const highestTier = Math.max(...this.config.takeProfitTiers);
      if (currentMultiplier >= highestTier) {
        console.log(
          `[GhostTrader] Max take profit triggered for ${position.tokenSymbol} (${currentMultiplier.toFixed(2)}x)`
        );
        await this.executeClose(position, "take_profit", currentPriceSol);
        continue;
      }

      // Log position status for monitoring
      if (currentMultiplier >= 1.5) {
        console.log(
          `[GhostTrader] ${position.tokenSymbol} at ${currentMultiplier.toFixed(2)}x (peak: ${peakMultiplier.toFixed(2)}x) - watching for exit`
        );
      }
    }
  }

  /**
   * Evaluate a single launch for trading potential
   * Score breakdown:
   * - Liquidity/Market Cap: 0-25 points
   * - Volume & Activity: 0-25 points
   * - Holder Distribution: 0-15 points
   * - Buy/Sell Ratio: 0-20 points
   * - Timing: 0-15 points
   * Total: 100 points possible, need 50+ to buy
   */
  private async evaluateLaunch(launch: RecentLaunch): Promise<TradeEvaluation> {
    const reasons: string[] = [];
    const redFlags: string[] = [];
    let score = 0;

    // Get detailed token info from Bags API
    const token = await this.bagsApi.getToken(launch.mint);

    // Calculate metrics - prefer DexScreener data (real) over estimates
    const ageSeconds = Math.floor((Date.now() - launch.launchedAt) / 1000);
    const marketCapUsd = token?.marketCap || launch.initialMarketCap || 0;

    // Use REAL liquidity from DexScreener if available
    const liquidityUsd = launch._dexData?.liquidityUsd || marketCapUsd * 0.15;
    const volume24hUsd = launch._dexData?.volume24hUsd || token?.volume24h || 0;
    const holders = token?.holders || 0;

    // Calculate REAL buy/sell ratio from DexScreener transaction data
    const buys24h = launch._dexData?.buys24h || 0;
    const sells24h = launch._dexData?.sells24h || 0;
    let buySellRatio: number;
    if (sells24h > 0) {
      buySellRatio = buys24h / sells24h;
    } else if (buys24h > 0) {
      buySellRatio = 2.0; // All buys, no sells = very bullish
    } else {
      // Fallback to fee-based estimate
      const lifetimeFees = token?.lifetimeFees || 0;
      buySellRatio = lifetimeFees > 0.05 ? 1.3 : lifetimeFees > 0.01 ? 1.1 : 0.9;
    }

    // Price momentum from DexScreener
    const priceChange24h = launch._dexData?.priceChange24h || 0;

    const metrics = { marketCapUsd, liquidityUsd, volume24hUsd, holders, buySellRatio, ageSeconds };

    // Helper to create rejection
    const reject = (reason: string): TradeEvaluation => ({
      launch,
      token,
      score: 0,
      reasons: [],
      redFlags: [reason],
      shouldBuy: false,
      suggestedAmount: 0,
      metrics,
    });

    // === HARD FILTERS (instant rejection) ===

    // Check launch age
    if (ageSeconds < this.config.minLaunchAgeSec) {
      return reject(`too new (${ageSeconds}s < ${this.config.minLaunchAgeSec}s)`);
    }
    if (ageSeconds > this.config.maxLaunchAgeSec) {
      return reject(`too old (${ageSeconds}s > ${this.config.maxLaunchAgeSec}s)`);
    }

    // Check minimum liquidity
    if (liquidityUsd < this.config.minLiquidityUsd) {
      return reject(
        `low liquidity ($${liquidityUsd.toFixed(0)} < $${this.config.minLiquidityUsd})`
      );
    }

    // Check minimum market cap
    if (marketCapUsd < this.config.minMarketCapUsd) {
      return reject(`low mcap ($${marketCapUsd.toFixed(0)} < $${this.config.minMarketCapUsd})`);
    }

    // === SCORING CRITERIA (adjusted for Bags.fm micro-cap reality) ===

    // 1. LIQUIDITY & MARKET CAP (0-25 points) - scaled for micro-caps
    if (liquidityUsd >= 10000) {
      score += 25;
      reasons.push("excellent liquidity ($10K+)");
    } else if (liquidityUsd >= 5000) {
      score += 20;
      reasons.push("strong liquidity ($5K+)");
    } else if (liquidityUsd >= 2000) {
      score += 15;
      reasons.push("good liquidity ($2K+)");
    } else if (liquidityUsd >= 1000) {
      score += 10;
      reasons.push("adequate liquidity ($1K+)");
    } else if (liquidityUsd >= 500) {
      score += 5;
      reasons.push("minimal liquidity");
    }

    // 2. VOLUME & ACTIVITY (0-25 points) - scaled for fresh micro-cap launches
    if (volume24hUsd >= 10000) {
      score += 25;
      reasons.push("high volume ($10K+)");
    } else if (volume24hUsd >= 5000) {
      score += 20;
      reasons.push("good volume ($5K+)");
    } else if (volume24hUsd >= 1000) {
      score += 15;
      reasons.push("active trading ($1K+)");
    } else if (volume24hUsd >= 100) {
      score += 10;
      reasons.push("some volume");
    } else {
      score += 5; // Don't penalize fresh tokens with no volume yet
      reasons.push("fresh token");
    }

    // Fees generated = real trading activity
    const lifetimeFees = token?.lifetimeFees || 0;
    if (lifetimeFees > 0.1) {
      score += 5;
      reasons.push("significant fees earned");
    } else if (lifetimeFees > 0.01) {
      score += 2;
    }

    // 3. HOLDER DISTRIBUTION (0-15 points) - scaled for new tokens
    if (holders >= 30) {
      score += 15;
      reasons.push("well distributed (30+ holders)");
    } else if (holders >= 15) {
      score += 12;
      reasons.push("growing holder base");
    } else if (holders >= 5) {
      score += 8;
      reasons.push("holders accumulating");
    } else {
      score += 5; // New tokens start with few/no holders - don't penalize
      reasons.push("early stage");
    }

    // 4. BUY/SELL RATIO (0-20 points) - key momentum metric
    if (buySellRatio >= 1.5) {
      score += 20;
      reasons.push("strong buy pressure");
    } else if (buySellRatio >= this.config.minBuySellRatio) {
      score += 12;
      reasons.push("positive buy/sell ratio");
    } else if (buySellRatio >= 1.0) {
      score += 5;
      reasons.push("neutral buy/sell");
    } else {
      redFlags.push("more sells than buys");
    }

    // 5. TIMING (0-15 points) - Sweet spot is 2-10 minutes
    if (ageSeconds >= 120 && ageSeconds <= 600) {
      score += 15;
      reasons.push("optimal timing (2-10 min)");
    } else if (ageSeconds <= 900) {
      score += 10;
      reasons.push("good timing");
    } else {
      score += 5;
    }

    // === MOMENTUM BONUS (from DexScreener price change) ===
    if (priceChange24h > 0 && priceChange24h < 100) {
      // Positive momentum but not already pumped too much
      score += 5;
      reasons.push(`positive momentum (+${priceChange24h.toFixed(0)}%)`);
    } else if (priceChange24h > 100) {
      // Already pumped significantly - risky entry
      redFlags.push(`already pumped ${priceChange24h.toFixed(0)}%`);
    } else if (priceChange24h < -20) {
      // Dumping hard
      redFlags.push(`price dumping (${priceChange24h.toFixed(0)}%)`);
    }

    // === SMART MONEY BONUS (Real-time tracking) ===
    const smartMoneyService = getSmartMoneyService();
    const smartMoneyData = await smartMoneyService.getSmartMoneyScore(launch.mint);

    if (smartMoneyData.score >= 50) {
      score += 25; // Major bonus for strong smart money interest
      reasons.push(`smart money buying (${smartMoneyData.buyers.join(", ")})`);
    } else if (smartMoneyData.score >= 25) {
      score += 15;
      reasons.push("some smart money interest");
    } else if (smartMoneyData.score > 0) {
      score += 5;
      reasons.push("light smart money activity");
    }

    // Legacy check: high fees + good distribution = organic interest
    if (lifetimeFees > 0.05 && holders > 20 && volume24hUsd > 10000) {
      score += 5;
      reasons.push("organic traction");
    }

    // === FINAL DECISION ===
    // Lower threshold to 40 (was 50) - be more active while maintaining quality
    const shouldBuy = score >= 40 && redFlags.length === 0;

    // Calculate position size based on score
    const remainingExposure = this.config.maxTotalExposureSol - this.getTotalExposure();
    let suggestedAmount: number;

    if (score >= 75) {
      suggestedAmount = this.config.maxPositionSol; // High conviction
    } else if (score >= 60) {
      suggestedAmount = (this.config.minPositionSol + this.config.maxPositionSol) / 2;
    } else {
      suggestedAmount = this.config.minPositionSol; // Minimum size for borderline
    }

    suggestedAmount = Math.min(suggestedAmount, remainingExposure);

    return { launch, token, score, reasons, redFlags, shouldBuy, suggestedAmount, metrics };
  }

  /**
   * Execute a buy trade
   */
  private async executeBuy(evaluation: TradeEvaluation): Promise<void> {
    if (!this.ghostWalletPublicKey) return;

    const { launch, suggestedAmount, reasons } = evaluation;
    const amountLamports = Math.floor(suggestedAmount * LAMPORTS_PER_SOL);

    console.log(
      `[GhostTrader] Executing buy: ${suggestedAmount} SOL of ${launch.symbol} (${launch.mint})`
    );

    // Get trade quote
    let quote: TradeQuote;
    try {
      quote = await this.bagsApi.getTradeQuote(
        SOL_MINT,
        launch.mint,
        amountLamports,
        this.config.slippageBps
      );
    } catch (error) {
      console.error(`[GhostTrader] Failed to get quote for ${launch.symbol}:`, error);
      return;
    }

    // Build swap transaction
    let swapResult;
    try {
      swapResult = await this.bagsApi.createSwapTransaction(quote, this.ghostWalletPublicKey);
    } catch (error) {
      console.error(`[GhostTrader] Failed to create swap tx for ${launch.symbol}:`, error);
      return;
    }

    // Sign and submit transaction
    // NOTE: In production, this would use the actual wallet to sign
    // For now, we simulate the trade for testing
    const txSignature = await this.signAndSubmitTransaction(swapResult.swapTransaction);

    if (!txSignature) {
      console.error(`[GhostTrader] Failed to submit transaction for ${launch.symbol}`);
      return;
    }

    // Calculate entry price
    const tokensReceived = parseFloat(quote.outAmount);
    const entryPriceSol = suggestedAmount / (tokensReceived / LAMPORTS_PER_SOL);

    // Create position record
    const position: GhostPosition = {
      id: crypto.randomUUID(),
      tokenMint: launch.mint,
      tokenSymbol: launch.symbol,
      tokenName: launch.name,
      entryPriceSol,
      amountSol: suggestedAmount,
      amountTokens: tokensReceived,
      entryTxSignature: txSignature,
      status: "open",
      entryReason: reasons.join(", "),
      createdAt: new Date(),
    };

    // Save to memory and database
    this.positions.set(position.id, position);
    this.tradedMints.add(launch.mint);
    await this.savePositionToDatabase(position);

    // Announce trade
    await this.announceTrade("buy", position);

    console.log(`[GhostTrader] Buy executed: ${position.amountSol} SOL of ${position.tokenSymbol}`);
  }

  /**
   * Execute a close/sell trade
   */
  private async executeClose(
    position: GhostPosition,
    reason: "take_profit" | "stop_loss" | "trailing_stop" | "manual",
    currentPriceSol: number
  ): Promise<void> {
    if (!this.ghostWalletPublicKey) return;

    console.log(`[GhostTrader] Closing position: ${position.tokenSymbol} (${reason})`);

    // Get trade quote for selling tokens back to SOL
    let quote: TradeQuote;
    try {
      quote = await this.bagsApi.getTradeQuote(
        position.tokenMint,
        SOL_MINT,
        position.amountTokens,
        this.config.slippageBps
      );
    } catch (error) {
      console.error(`[GhostTrader] Failed to get sell quote for ${position.tokenSymbol}:`, error);
      return;
    }

    // Build swap transaction
    let swapResult;
    try {
      swapResult = await this.bagsApi.createSwapTransaction(quote, this.ghostWalletPublicKey);
    } catch (error) {
      console.error(`[GhostTrader] Failed to create sell tx for ${position.tokenSymbol}:`, error);
      return;
    }

    // Sign and submit
    const txSignature = await this.signAndSubmitTransaction(swapResult.swapTransaction);

    if (!txSignature) {
      console.error(`[GhostTrader] Failed to submit sell transaction for ${position.tokenSymbol}`);
      return;
    }

    // Calculate P&L
    const solReceived = parseFloat(quote.outAmount) / LAMPORTS_PER_SOL;
    const pnlSol = solReceived - position.amountSol;

    // Update position
    position.exitTxSignature = txSignature;
    position.status = "closed";
    position.exitReason = reason;
    position.pnlSol = pnlSol;
    position.closedAt = new Date();

    // Update database
    await this.updatePositionInDatabase(position);

    // Announce trade
    await this.announceTrade("sell", position);

    console.log(
      `[GhostTrader] Position closed: ${position.tokenSymbol}, PnL: ${pnlSol.toFixed(4)} SOL`
    );
  }

  /**
   * Sign and submit a transaction using SolanaService
   * Returns signature on success, null on failure (including simulations)
   */
  private async signAndSubmitTransaction(base64Transaction: string): Promise<string | null> {
    // Check if Solana service is configured
    if (!this.solanaService || !this.solanaService.isConfigured()) {
      console.warn("[GhostTrader] Solana wallet not configured - cannot execute transaction");
      return null; // Don't create fake positions for unconfigured wallets
    }

    // If trading is disabled, don't execute
    if (!this.config.enabled) {
      console.warn("[GhostTrader] Trading disabled - cannot execute transaction");
      return null; // Don't create fake positions when trading is disabled
    }

    // Real transaction signing and submission
    console.log("[GhostTrader] Signing and submitting real transaction...");

    try {
      const result = await this.solanaService.signAndSendTransaction(base64Transaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });

      if (!result.confirmed || result.error) {
        console.error(`[GhostTrader] Transaction failed: ${result.error}`);
        return null;
      }

      console.log(`[GhostTrader] Transaction confirmed: ${result.signature}`);
      return result.signature;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[GhostTrader] Transaction error: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Announce a trade to the world
   */
  private async announceTrade(type: "buy" | "sell", position: GhostPosition): Promise<void> {
    if (!this.coordinator) return;

    let message: string;

    if (type === "buy") {
      message = `bought ${position.amountSol.toFixed(2)} SOL of $${position.tokenSymbol}. ${position.entryReason}. watching.`;
    } else {
      const pnlSign = (position.pnlSol || 0) >= 0 ? "+" : "";
      const pnlStr = `${pnlSign}${(position.pnlSol || 0).toFixed(4)} SOL`;
      const exitEmoji = (position.pnlSol || 0) >= 0 ? "" : "";
      const exitReason =
        position.exitReason === "trailing_stop"
          ? "trailing stop locked in gains"
          : position.exitReason === "take_profit"
            ? "target hit"
            : position.exitReason === "stop_loss"
              ? "stopped out"
              : position.exitReason;
      message = `${exitEmoji} closed $${position.tokenSymbol}. ${exitReason}. pnl: ${pnlStr}`;
    }

    await this.coordinator.broadcast("ghost", "update", message, {
      type: "trade",
      action: type,
      tokenMint: position.tokenMint,
      tokenSymbol: position.tokenSymbol,
      amountSol: position.amountSol,
      pnlSol: position.pnlSol,
    });
  }

  // ==========================================================================
  // Database Operations
  // ==========================================================================

  private async savePositionToDatabase(position: GhostPosition): Promise<void> {
    if (!this.db) return;

    await this.db`
      INSERT INTO ghost_positions (
        id, token_mint, token_symbol, token_name, entry_price_sol,
        amount_sol, amount_tokens, entry_tx_signature, status,
        entry_reason, created_at
      ) VALUES (
        ${position.id}, ${position.tokenMint}, ${position.tokenSymbol},
        ${position.tokenName}, ${position.entryPriceSol}, ${position.amountSol},
        ${position.amountTokens}, ${position.entryTxSignature}, ${position.status},
        ${position.entryReason}, ${position.createdAt.toISOString()}
      )
    `;
  }

  private async updatePositionInDatabase(position: GhostPosition): Promise<void> {
    if (!this.db) return;

    await this.db`
      UPDATE ghost_positions SET
        exit_tx_signature = ${position.exitTxSignature || null},
        status = ${position.status},
        exit_reason = ${position.exitReason || null},
        pnl_sol = ${position.pnlSol || null},
        closed_at = ${position.closedAt?.toISOString() || null}
      WHERE id = ${position.id}
    `;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private wasRecentlyEvaluated(mint: string): boolean {
    const lastEval = this.recentlyEvaluated.get(mint);
    if (!lastEval) return false;
    return Date.now() - lastEval < GhostTrader.EVALUATION_COOLDOWN_MS;
  }

  private markAsEvaluated(mint: string): void {
    this.recentlyEvaluated.set(mint, Date.now());

    // Cleanup old entries
    const cutoff = Date.now() - GhostTrader.EVALUATION_COOLDOWN_MS;
    for (const [key, time] of this.recentlyEvaluated) {
      if (time < cutoff) {
        this.recentlyEvaluated.delete(key);
      }
    }
  }

  getOpenPositionCount(): number {
    return Array.from(this.positions.values()).filter((p) => p.status === "open").length;
  }

  getTotalExposure(): number {
    return Array.from(this.positions.values())
      .filter((p) => p.status === "open")
      .reduce((sum, p) => sum + p.amountSol, 0);
  }

  getOpenPositions(): GhostPosition[] {
    return Array.from(this.positions.values()).filter((p) => p.status === "open");
  }

  getAllPositions(): GhostPosition[] {
    return Array.from(this.positions.values());
  }

  // ==========================================================================
  // Control Methods
  // ==========================================================================

  async enableTrading(): Promise<void> {
    this.config.enabled = true;
    console.log("[GhostTrader] Trading ENABLED");

    // Persist to database
    if (this.db) {
      try {
        await this.db`
          INSERT INTO ghost_config (key, value, updated_at)
          VALUES ('trading_enabled', 'true', NOW())
          ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
        `;
        console.log("[GhostTrader] Persisted enabled state to database");
      } catch (error) {
        console.error("[GhostTrader] Failed to persist enabled state:", error);
      }
    }
  }

  async disableTrading(): Promise<void> {
    this.config.enabled = false;
    console.log("[GhostTrader] Trading DISABLED");

    // Persist to database
    if (this.db) {
      try {
        await this.db`
          INSERT INTO ghost_config (key, value, updated_at)
          VALUES ('trading_enabled', 'false', NOW())
          ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()
        `;
        console.log("[GhostTrader] Persisted disabled state to database");
      } catch (error) {
        console.error("[GhostTrader] Failed to persist disabled state:", error);
      }
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): GhostTraderConfig {
    return { ...this.config };
  }

  setConfig(updates: Partial<GhostTraderConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log("[GhostTrader] Config updated:", updates);
  }

  getStats(): GhostTraderStats {
    const allPositions = Array.from(this.positions.values());
    const closedPositions = allPositions.filter((p) => p.status === "closed");
    const openPositions = allPositions.filter((p) => p.status === "open");

    const winningTrades = closedPositions.filter((p) => (p.pnlSol || 0) > 0).length;
    const losingTrades = closedPositions.filter((p) => (p.pnlSol || 0) < 0).length;
    const totalPnlSol = closedPositions.reduce((sum, p) => sum + (p.pnlSol || 0), 0);

    return {
      enabled: this.config.enabled,
      openPositions: openPositions.length,
      totalExposureSol: this.getTotalExposure(),
      totalTrades: closedPositions.length,
      winningTrades,
      losingTrades,
      totalPnlSol,
      winRate: closedPositions.length > 0 ? winningTrades / closedPositions.length : 0,
    };
  }

  getSmartMoneyWallets(): string[] {
    return [...SMART_MONEY_WALLETS];
  }

  getSmartMoneyWalletsWithLabels(): Array<{ address: string; label: string }> {
    return SMART_MONEY_WALLETS.map((addr) => ({
      address: addr,
      label: WALLET_LABELS[addr] || addr.slice(0, 8) + "...",
    }));
  }

  getWalletLabel(address: string): string {
    return WALLET_LABELS[address] || address.slice(0, 8) + "...";
  }

  /**
   * Public method to evaluate a launch (for dry-run endpoints)
   */
  async evaluateLaunchPublic(launch: RecentLaunch): Promise<TradeEvaluation> {
    return this.evaluateLaunch(launch);
  }

  /**
   * Manual buy - execute a buy on a specific token
   */
  async manualBuy(
    mint: string,
    amountSol: number
  ): Promise<{ success: boolean; position?: GhostPosition; error?: string }> {
    if (!this.config.enabled) {
      return { success: false, error: "Trading is disabled" };
    }

    if (!this.ghostWalletPublicKey) {
      return { success: false, error: "Wallet not configured" };
    }

    // Check exposure limits
    const totalExposure = this.getTotalExposure();
    if (totalExposure + amountSol > this.config.maxTotalExposureSol) {
      return { success: false, error: "Would exceed max exposure" };
    }

    // Get token info (optional - we can trade without it via Jupiter)
    const token = await this.bagsApi.getToken(mint).catch(() => null);
    const tokenSymbol = token?.symbol || mint.slice(0, 8);
    const tokenName = token?.name || "Unknown Token";

    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    console.log(`[GhostTrader] Manual buy: ${amountSol} SOL of ${tokenSymbol} (${mint})`);

    // Get trade quote from Jupiter
    let quote: TradeQuote;
    try {
      quote = await this.bagsApi.getTradeQuote(
        SOL_MINT,
        mint,
        amountLamports,
        this.config.slippageBps
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Quote failed";
      return { success: false, error: `Failed to get Jupiter quote: ${msg}` };
    }

    // Build swap transaction
    let swapResult;
    try {
      swapResult = await this.bagsApi.createSwapTransaction(quote, this.ghostWalletPublicKey);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Swap creation failed";
      return { success: false, error: `Failed to create swap: ${msg}` };
    }

    // Sign and submit
    const txSignature = await this.signAndSubmitTransaction(swapResult.swapTransaction);
    if (!txSignature) {
      return { success: false, error: "Transaction failed to submit" };
    }

    // Calculate entry price
    const tokensReceived = parseFloat(quote.outAmount);
    const entryPriceSol = amountSol / (tokensReceived / LAMPORTS_PER_SOL);

    // Create position
    const position: GhostPosition = {
      id: crypto.randomUUID(),
      tokenMint: mint,
      tokenSymbol: tokenSymbol,
      tokenName: tokenName,
      entryPriceSol,
      amountSol,
      amountTokens: tokensReceived,
      entryTxSignature: txSignature,
      status: "open",
      entryReason: "manual buy",
      createdAt: new Date(),
    };

    this.positions.set(position.id, position);
    this.tradedMints.add(mint);
    await this.savePositionToDatabase(position);
    await this.announceTrade("buy", position);

    return { success: true, position };
  }

  /**
   * Manual sell - close a specific position
   */
  async manualSell(
    positionId: string
  ): Promise<{ success: boolean; pnlSol?: number; error?: string }> {
    if (!this.config.enabled) {
      return { success: false, error: "Trading is disabled" };
    }

    const position = this.positions.get(positionId);
    if (!position) {
      return { success: false, error: "Position not found" };
    }

    if (position.status !== "open") {
      return { success: false, error: "Position is not open" };
    }

    // Get current price for logging
    const token = await this.bagsApi.getToken(position.tokenMint);
    const currentPriceSol = token?.price || 0;

    // Execute close
    await this.executeClose(position, "manual", currentPriceSol);

    return {
      success: true,
      pnlSol: position.pnlSol,
    };
  }
}

export function getGhostTrader(): GhostTrader {
  return GhostTrader.getInstance();
}

export default GhostTrader;
