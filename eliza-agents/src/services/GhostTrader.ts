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
import { WorldSyncService, getWorldSyncService } from "./WorldSyncService.js";
import { getDatabase } from "../routes/shared.js";
import {
  TelegramBroadcaster,
  getTelegramBroadcaster,
  type TradeSignal,
} from "./TelegramBroadcaster.js";

// ============================================================================
// Constants
// ============================================================================

const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Default trading configuration (BagBot-inspired, tuned for Bags.fm reality)
// Reference: https://github.com/BagBotX/bagbot + DexScreener Bags runner analysis
// Updated Jan 2025: Relaxed filters based on GAS token success patterns
const DEFAULT_CONFIG = {
  enabled: false, // Must be explicitly enabled
  // Position sizing (BagBot uses 1 SOL max)
  minPositionSol: 0.25, // Meaningful positions
  maxPositionSol: 1.0, // Match BagBot
  maxTotalExposureSol: 3.0, // Allow 3 full positions
  maxOpenPositions: 3, // Conservative position limit
  // Profit taking - BagBot style: 33% at 1.5R, 33% at 2R, trailing
  takeProfitTiers: [1.5, 2.0, 3.0], // Take 33% at each tier
  trailingStopPercent: 10, // After 2x, trail by 10%
  // Risk management
  stopLossPercent: 15, // Cut losses at -15% (BagBot uses same)
  // Dead position detection
  maxHoldTimeMinutes: 480, // 8 hours - Bags runners need time
  minVolumeToHoldUsd: 500, // Need some volume to keep holding
  deadPositionDecayPercent: 25, // If down 25%+ and stale, consider dead
  // Liquidity requirements - BALANCED (BagBot uses $50K, but Bags tokens are smaller)
  minLiquidityUsd: 5000, // $5K minimum - prevents bad fills from low liquidity
  minMarketCapUsd: 5000, // $5K minimum (runners can start small)
  // Quality filters - aligned with BagBot patterns
  maxCreatorFeeBps: 500, // 5% max (some Bags creators set higher)
  minBuySellRatio: 1.15, // Bullish pressure required (BagBot uses 1.2)
  minHolders: 5, // New tokens start with few holders
  minVolume24hUsd: 5000, // $5K volume - lowered for more opportunities
  maxPriceImpactPercent: 3.0, // 3% max - tighter for better execution (BagBot uses 1%)
  // Timing - EXPANDED (Bags runners are days old, not minutes)
  minLaunchAgeSec: 300, // 5 minutes minimum (avoid instant rugs)
  maxLaunchAgeSec: 604800, // 7 DAYS max
  slippageBps: 300, // 3% slippage - tighter to match price impact limit
  // Bags-specific signals
  requireTokenClaimed: false, // Not required - many good tokens don't have claims yet
  minLifetimeFeesSol: 0.0, // Don't require fees (volume is better indicator)
  // Volume/MCap ratio - used in SCORING, not as hard filter
  // GAS token had 200% vol/mcap at peak, healthy tokens have 30-80%
  minVolumeMcapRatio: 0.0, // DISABLED as hard filter - incorporated into scoring instead
};

// Top trader wallets to study (from Kolscan & GMGN leaderboards)
// Prioritized: Owner wallet first, then verified profitable traders
const SMART_MONEY_WALLETS = [
  // === BAGBOT WALLET (Priority #1 - our benchmark) ===
  "bL7yksLLAUZDhSXvxhMEVpruqhUNn8T8C4jWzdnVChm", // BagBot - the bot to beat

  // === OWNER WALLET (Priority #2) ===
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
  bL7yksLLAUZDhSXvxhMEVpruqhUNn8T8C4jWzdnVChm: "BagBot (Benchmark)",
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

// BagBot wallet for special tracking
const BAGBOT_WALLET = "bL7yksLLAUZDhSXvxhMEVpruqhUNn8T8C4jWzdnVChm";

// ============================================================================
// Types
// ============================================================================

export interface SignalPerformance {
  signal: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnlSol: number;
  avgPnlSol: number;
  winRate: number;
  scoreAdjustment: number; // Learned adjustment to apply to this signal's score
}

export interface LearningInsights {
  signals: SignalPerformance[];
  bestSignals: string[];
  worstSignals: string[];
  totalTradesAnalyzed: number;
  lastUpdated: number;
}

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
    volumeMcapRatio?: number; // BagBot key metric
    lifetimeFeesSol?: number; // Bags-specific
    hasFeeClaims?: boolean; // Bags-specific
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
  // Dead position detection
  maxHoldTimeMinutes: number;
  minVolumeToHoldUsd: number;
  deadPositionDecayPercent: number;
  // Liquidity requirements
  minLiquidityUsd: number;
  minMarketCapUsd: number;
  // Quality filters
  maxCreatorFeeBps: number;
  minBuySellRatio: number;
  minHolders: number;
  minVolume24hUsd: number;
  maxPriceImpactPercent: number;
  minVolumeMcapRatio: number; // Set to 0 to disable hard filter (used in scoring instead)
  // Timing
  minLaunchAgeSec: number;
  maxLaunchAgeSec: number;
  slippageBps: number;
  // Bags-specific signals
  requireTokenClaimed: boolean; // Token must have fee claims (optional)
  minLifetimeFeesSol: number; // Minimum fees generated
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
  private worldSync: WorldSyncService | null;
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

  // Chatter cooldown (avoid spamming speech bubbles)
  private lastChatter: number = 0;
  private static readonly CHATTER_COOLDOWN_MS = 30000; // 30 seconds between random chatter

  // Self-learning: track which signals lead to wins/losses
  private signalPerformance: Map<string, SignalPerformance> = new Map();

  // Telegram broadcaster for trade signals
  private telegramBroadcaster: TelegramBroadcaster;

  // Store last evaluation for telegram broadcast (need metrics after position created)
  private lastEvaluation: TradeEvaluation | null = null;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.bagsApi = getBagsApiService();
    this.coordinator = getAgentCoordinator();
    this.solanaService = null; // Initialized in initialize()
    this.worldSync = null; // Initialized in initialize()
    this.db = getDatabase();
    this.telegramBroadcaster = getTelegramBroadcaster(this.db || undefined);

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

    // Initialize WorldSync for in-game visual feedback
    this.worldSync = getWorldSyncService();

    // Update public key from Solana service if not set
    if (this.solanaService.isConfigured() && !this.ghostWalletPublicKey) {
      this.ghostWalletPublicKey = this.solanaService.getPublicKey();
    }

    // Initialize database table
    await this.initializeDatabase();

    // Load existing positions from database
    await this.loadPositionsFromDatabase();

    // Load learning data
    await this.loadLearningData();

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

    // Learning table for signal performance tracking
    await this.db`
      CREATE TABLE IF NOT EXISTS ghost_learning (
        signal VARCHAR(100) PRIMARY KEY,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        total_pnl_sol DECIMAL(18, 9) DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Telegram broadcasts table for logging sent signals
    await this.db`
      CREATE TABLE IF NOT EXISTS telegram_broadcasts (
        id SERIAL PRIMARY KEY,
        token_mint VARCHAR(64) NOT NULL,
        token_symbol VARCHAR(20),
        score INTEGER,
        message_id BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await this.db`
      CREATE INDEX IF NOT EXISTS idx_telegram_broadcasts_created
      ON telegram_broadcasts(created_at)
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

    // Load ALL positions (open and closed) so stats are accurate
    const rows = (await this.db`
      SELECT * FROM ghost_positions
      ORDER BY created_at DESC
      LIMIT 100
    `) as Array<{
      id: string;
      token_mint: string;
      token_symbol: string;
      token_name: string;
      entry_price_sol: string;
      amount_sol: string;
      amount_tokens: string;
      entry_tx_signature: string;
      exit_tx_signature: string | null;
      status: string;
      entry_reason: string;
      exit_reason: string | null;
      pnl_sol: string | null;
      created_at: string;
      closed_at: string | null;
    }>;

    let openCount = 0;
    let closedCount = 0;

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
        exitTxSignature: row.exit_tx_signature || undefined,
        status: row.status as "open" | "closed" | "failed",
        entryReason: row.entry_reason,
        exitReason: row.exit_reason || undefined,
        pnlSol: row.pnl_sol ? parseFloat(row.pnl_sol) : undefined,
        createdAt: new Date(row.created_at),
        closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
      };
      this.positions.set(position.id, position);
      this.tradedMints.add(position.tokenMint);

      if (position.status === "open") openCount++;
      else if (position.status === "closed") closedCount++;
    }

    console.log(
      `[GhostTrader] Loaded ${rows.length} positions from database (${openCount} open, ${closedCount} closed)`
    );
  }

  // ==========================================================================
  // Self-Learning System
  // ==========================================================================

  private async loadLearningData(): Promise<void> {
    if (!this.db) return;

    try {
      const rows = (await this.db`
        SELECT * FROM ghost_learning
      `) as Array<{
        signal: string;
        total_trades: number;
        winning_trades: number;
        losing_trades: number;
        total_pnl_sol: string;
      }>;

      for (const row of rows) {
        const totalPnl = parseFloat(row.total_pnl_sol) || 0;
        const winRate = row.total_trades > 0 ? row.winning_trades / row.total_trades : 0;
        const avgPnl = row.total_trades > 0 ? totalPnl / row.total_trades : 0;

        // Calculate score adjustment based on performance
        // Good signals get bonus, bad signals get penalty
        let scoreAdjustment = 0;
        if (row.total_trades >= 3) {
          // Need at least 3 trades to learn from
          if (winRate >= 0.7) scoreAdjustment = 10; // 70%+ win rate = +10 score
          else if (winRate >= 0.5) scoreAdjustment = 5; // 50%+ win rate = +5 score
          else if (winRate <= 0.3) scoreAdjustment = -10; // 30% or less = -10 score
          else if (winRate <= 0.4) scoreAdjustment = -5; // 40% or less = -5 score
        }

        this.signalPerformance.set(row.signal, {
          signal: row.signal,
          totalTrades: row.total_trades,
          winningTrades: row.winning_trades,
          losingTrades: row.losing_trades,
          totalPnlSol: totalPnl,
          avgPnlSol: avgPnl,
          winRate,
          scoreAdjustment,
        });
      }

      console.log(`[GhostTrader] Loaded learning data for ${rows.length} signals`);
    } catch (error) {
      console.error("[GhostTrader] Failed to load learning data:", error);
    }
  }

  /**
   * Record the outcome of a trade for learning
   * Called when a position is closed
   */
  private async recordTradeOutcome(position: GhostPosition): Promise<void> {
    if (!this.db || !position.entryReason) return;

    const isWin = (position.pnlSol || 0) > 0;
    const pnl = position.pnlSol || 0;

    // Parse entry reasons (comma-separated signals)
    const signals = position.entryReason.split(",").map((s) => s.trim().toLowerCase());

    for (const signal of signals) {
      if (!signal) continue;

      try {
        // Upsert signal performance
        await this.db`
          INSERT INTO ghost_learning (signal, total_trades, winning_trades, losing_trades, total_pnl_sol, updated_at)
          VALUES (${signal}, 1, ${isWin ? 1 : 0}, ${isWin ? 0 : 1}, ${pnl}, NOW())
          ON CONFLICT (signal) DO UPDATE SET
            total_trades = ghost_learning.total_trades + 1,
            winning_trades = ghost_learning.winning_trades + ${isWin ? 1 : 0},
            losing_trades = ghost_learning.losing_trades + ${isWin ? 0 : 1},
            total_pnl_sol = ghost_learning.total_pnl_sol + ${pnl},
            updated_at = NOW()
        `;

        // Update in-memory cache
        const existing = this.signalPerformance.get(signal) || {
          signal,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalPnlSol: 0,
          avgPnlSol: 0,
          winRate: 0,
          scoreAdjustment: 0,
        };

        existing.totalTrades++;
        if (isWin) existing.winningTrades++;
        else existing.losingTrades++;
        existing.totalPnlSol += pnl;
        existing.avgPnlSol = existing.totalPnlSol / existing.totalTrades;
        existing.winRate = existing.winningTrades / existing.totalTrades;

        // Recalculate score adjustment
        if (existing.totalTrades >= 3) {
          if (existing.winRate >= 0.7) existing.scoreAdjustment = 10;
          else if (existing.winRate >= 0.5) existing.scoreAdjustment = 5;
          else if (existing.winRate <= 0.3) existing.scoreAdjustment = -10;
          else if (existing.winRate <= 0.4) existing.scoreAdjustment = -5;
          else existing.scoreAdjustment = 0;
        }

        this.signalPerformance.set(signal, existing);
      } catch (error) {
        console.error(`[GhostTrader] Failed to record learning for signal "${signal}":`, error);
      }
    }

    // Chatter about learning occasionally
    if (signals.length > 0) {
      const topSignal = signals[0];
      const perf = this.signalPerformance.get(topSignal);
      if (perf && perf.totalTrades >= 3) {
        const learningMessages = isWin
          ? [
              `"${topSignal}" keeps working... ${(perf.winRate * 100).toFixed(0)}% win rate`,
              `learning that ${topSignal} is reliable`,
              `noted: ${topSignal} = good signal`,
            ]
          : [
              `hmm "${topSignal}" not always working...`,
              `adjusting for ${topSignal} losses`,
              `learning from this L`,
            ];
        this.maybeChatter(
          learningMessages[Math.floor(Math.random() * learningMessages.length)],
          isWin ? "thoughtful" : "concerned"
        );
      }
    }

    console.log(
      `[GhostTrader] Recorded trade outcome: ${position.tokenSymbol} (${isWin ? "WIN" : "LOSS"}, signals: ${signals.join(", ")})`
    );
  }

  /**
   * Get the learned score adjustment for a set of reasons
   */
  private getLearningAdjustment(reasons: string[]): { adjustment: number; appliedSignals: string[] } {
    let totalAdjustment = 0;
    const appliedSignals: string[] = [];

    for (const reason of reasons) {
      const signal = reason.toLowerCase().trim();
      const perf = this.signalPerformance.get(signal);

      if (perf && perf.scoreAdjustment !== 0) {
        totalAdjustment += perf.scoreAdjustment;
        appliedSignals.push(`${signal} (${perf.scoreAdjustment > 0 ? "+" : ""}${perf.scoreAdjustment})`);
      }
    }

    return { adjustment: totalAdjustment, appliedSignals };
  }

  /**
   * Get learning insights for API/display
   */
  getLearningInsights(): LearningInsights {
    const signals = Array.from(this.signalPerformance.values());

    // Sort by win rate (with minimum trades filter)
    const reliableSignals = signals.filter((s) => s.totalTrades >= 3);
    const sortedByWinRate = [...reliableSignals].sort((a, b) => b.winRate - a.winRate);

    const bestSignals = sortedByWinRate.slice(0, 5).map((s) => s.signal);
    const worstSignals = sortedByWinRate
      .slice(-5)
      .reverse()
      .map((s) => s.signal);

    return {
      signals,
      bestSignals,
      worstSignals,
      totalTradesAnalyzed: signals.reduce((sum, s) => sum + s.totalTrades, 0),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Reset all learning data - use when strategy changes significantly
   */
  async resetLearning(): Promise<{ success: boolean; signalsCleared: number }> {
    const signalsCleared = this.signalPerformance.size;

    // Clear in-memory cache
    this.signalPerformance.clear();

    // Clear database
    if (this.db) {
      try {
        await this.db`DELETE FROM ghost_learning`;
        console.log(`[GhostTrader] Reset learning data: ${signalsCleared} signals cleared`);
      } catch (error) {
        console.error("[GhostTrader] Failed to reset learning data:", error);
        return { success: false, signalsCleared: 0 };
      }
    }

    return { success: true, signalsCleared };
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

    // Chatter about scanning (Bags runner hunting)
    const scanMessages = [
      "hunting vol/mcap monsters...",
      "looking for 5x+ vol/mcap...",
      "checking Bags runners...",
      "SLACKINT mode: vol > mcap",
      "scanning for the next LOBSTER...",
      "volume is the key...",
    ];
    this.maybeChatter(scanMessages[Math.floor(Math.random() * scanMessages.length)], "focused");

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

      // Chatter about finding something good (with score)
      this.chatter(`found one! $${best.launch.symbol} score: ${best.score}`, "excited");

      // Store evaluation for Telegram broadcast
      this.lastEvaluation = best;

      // Execute trade
      await this.executeBuy(best);
    } else {
      console.log("[GhostTrader] No suitable launches found (Bags runner standards)");

      // Occasional chatter about vol/mcap focus
      const boredMessages = [
        "vol/mcap too low everywhere...",
        "waiting for volume spike...",
        "no runners yet",
        "need that 100%+ vol/mcap...",
        "hunting for the next LOBSTER",
        "volume is king on Bags",
        "patient... runners take time",
      ];
      this.maybeChatter(boredMessages[Math.floor(Math.random() * boredMessages.length)], "focused");
    }
  }

  /**
   * Check positions for take-profit, stop-loss, or dead positions
   * Uses scaled exits, trailing stops, and dead position detection
   * Called periodically by AutonomousService
   */
  async checkPositions(): Promise<void> {
    if (!this.config.enabled) return;

    const openPositions = Array.from(this.positions.values()).filter((p) => p.status === "open");

    for (const position of openPositions) {
      // Get current price and market data - try Bags API first, then DexScreener
      let currentPriceSol = 0;
      let volume24hUsd = 0;
      let liquidityUsd = 0;

      const token = await this.bagsApi.getToken(position.tokenMint).catch(() => null);
      if (token?.price) {
        currentPriceSol = token.price;
        volume24hUsd = token.volume24h || 0;
      }

      // Always check DexScreener for more accurate volume/liquidity data
      try {
        const dexRes = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${position.tokenMint}`
        );
        if (dexRes.ok) {
          const dexData = await dexRes.json();
          const pair = dexData.pairs?.[0];
          if (pair) {
            if (pair.priceNative && !currentPriceSol) {
              currentPriceSol = parseFloat(pair.priceNative);
            }
            volume24hUsd = pair.volume?.h24 || volume24hUsd;
            liquidityUsd = pair.liquidity?.usd || 0;
          }
        }
      } catch {
        console.warn(`[GhostTrader] Failed to get DexScreener data for ${position.tokenSymbol}`);
      }

      if (currentPriceSol === 0) {
        console.warn(`[GhostTrader] No price data for ${position.tokenSymbol}, skipping`);
        continue;
      }

      // Calculate current multiplier (1.0 = breakeven)
      const currentMultiplier = currentPriceSol / position.entryPriceSol;
      const priceChangePercent = (currentMultiplier - 1) * 100;

      // Track highest multiplier for trailing stop
      const peakMultiplier = (position as any).peakMultiplier || currentMultiplier;
      if (currentMultiplier > peakMultiplier) {
        (position as any).peakMultiplier = currentMultiplier;
      }

      // Calculate hold time
      const holdTimeMinutes = (Date.now() - position.createdAt.getTime()) / 60000;

      // === STOP LOSS CHECK ===
      if (priceChangePercent <= -this.config.stopLossPercent) {
        console.log(
          `[GhostTrader] Stop loss triggered for ${position.tokenSymbol} (${priceChangePercent.toFixed(1)}%)`
        );
        await this.executeClose(position, "stop_loss", currentPriceSol);
        continue;
      }

      // === DEAD POSITION CHECK ===
      // Detect tokens that are slowly dying: held too long + no volume + decaying price
      const isHeldTooLong = holdTimeMinutes > this.config.maxHoldTimeMinutes;
      const isVolumeDead = volume24hUsd < this.config.minVolumeToHoldUsd;
      const isDecaying =
        priceChangePercent <= -this.config.deadPositionDecayPercent &&
        priceChangePercent > -this.config.stopLossPercent;
      const isLiquidityDrained = liquidityUsd > 0 && liquidityUsd < 200; // Less than $200 liquidity

      // Dead if: (held too long AND low volume) OR (decaying AND no volume) OR (liquidity drained)
      if ((isHeldTooLong && isVolumeDead) || (isDecaying && isVolumeDead) || isLiquidityDrained) {
        const reasons: string[] = [];
        if (isHeldTooLong) reasons.push(`held ${holdTimeMinutes.toFixed(0)}min`);
        if (isVolumeDead) reasons.push(`vol $${volume24hUsd.toFixed(0)}`);
        if (isDecaying) reasons.push(`down ${priceChangePercent.toFixed(1)}%`);
        if (isLiquidityDrained) reasons.push(`liq $${liquidityUsd.toFixed(0)}`);

        console.log(
          `[GhostTrader] Dead position detected: ${position.tokenSymbol} (${reasons.join(", ")})`
        );
        await this.executeClose(position, "dead_position", currentPriceSol);
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

      // === TAKE-PROFIT ===
      // Take profit at the FIRST tier hit (e.g., 1.5x) - don't wait and risk giving back gains
      // Memecoins can dump fast, so we take profits aggressively
      const firstTakeProfitTier = Math.min(...this.config.takeProfitTiers);
      if (currentMultiplier >= firstTakeProfitTier) {
        console.log(
          `[GhostTrader] Take profit triggered for ${position.tokenSymbol} at ${currentMultiplier.toFixed(2)}x (target was ${firstTakeProfitTier}x)`
        );

        // Chatter about the win
        const winMessages = [
          `locked in ${currentMultiplier.toFixed(1)}x on $${position.tokenSymbol} 💰`,
          `took profit on $${position.tokenSymbol} at ${currentMultiplier.toFixed(1)}x`,
          `$${position.tokenSymbol} +${((currentMultiplier - 1) * 100).toFixed(0)}% secured`,
          `gg $${position.tokenSymbol} ${currentMultiplier.toFixed(1)}x`,
        ];
        this.maybeChatter(winMessages[Math.floor(Math.random() * winMessages.length)], "happy");

        await this.executeClose(position, "take_profit", currentPriceSol);
        continue;
      }

      // Log position status for monitoring (not yet at take-profit)
      if (currentMultiplier >= 1.2) {
        console.log(
          `[GhostTrader] ${position.tokenSymbol} at ${currentMultiplier.toFixed(2)}x - approaching take-profit (${firstTakeProfitTier}x)`
        );
      } else if (holdTimeMinutes > 60) {
        // Log stale positions that haven't moved
        console.log(
          `[GhostTrader] ${position.tokenSymbol} held ${holdTimeMinutes.toFixed(0)}min at ${currentMultiplier.toFixed(2)}x, vol: $${volume24hUsd.toFixed(0)}`
        );

        // Occasional concern about slow positions
        if (currentMultiplier < 1) {
          const concernMessages = [
            `$${position.tokenSymbol} being slow...`,
            `cmon $${position.tokenSymbol}...`,
            `watching $${position.tokenSymbol} closely`,
          ];
          this.maybeChatter(concernMessages[Math.floor(Math.random() * concernMessages.length)], "concerned");
        }
      }
    }

    // Occasional summary if watching multiple positions
    if (openPositions.length >= 2) {
      const summaryMessages = [
        `watching ${openPositions.length} positions...`,
        `${openPositions.length} plays active rn`,
        `managing ${openPositions.length} trades`,
      ];
      this.maybeChatter(summaryMessages[Math.floor(Math.random() * summaryMessages.length)], "focused");
    }
  }

  /**
   * Evaluate a single launch for trading potential
   * BagBot-inspired scoring algorithm:
   * - Volume/MCap ratio: 0-25 points (organic trading indicator)
   * - Buy/Sell pressure: 0-25 points (momentum)
   * - Momentum signals: 0-20 points (price action)
   * - Liquidity depth: 0-15 points (execution safety)
   * - Token age/rug risk: 0-15 points (safety)
   * + Bags-specific bonuses: Token CLAIMED, lifetime fees
   * Total: 100+ points possible, need 80+ to buy (BagBot standard)
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
    const lifetimeFees = token?.lifetimeFees || 0;

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
      buySellRatio = lifetimeFees > 0.05 ? 1.3 : lifetimeFees > 0.01 ? 1.1 : 0.9;
    }

    // Price momentum from DexScreener
    const priceChange24h = launch._dexData?.priceChange24h || 0;

    // Volume/MCap ratio - key BagBot metric
    const volumeMcapRatio = marketCapUsd > 0 ? volume24hUsd / marketCapUsd : 0;

    const metrics = {
      marketCapUsd,
      liquidityUsd,
      volume24hUsd,
      holders,
      buySellRatio,
      ageSeconds,
      volumeMcapRatio,
      lifetimeFeesSol: lifetimeFees,
    };

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

    // === HARD FILTERS (BagBot-style instant rejection) ===

    // Check launch age
    if (ageSeconds < this.config.minLaunchAgeSec) {
      return reject(`too new (${ageSeconds}s < ${this.config.minLaunchAgeSec}s)`);
    }
    if (ageSeconds > this.config.maxLaunchAgeSec) {
      return reject(`too old (${ageSeconds}s > ${this.config.maxLaunchAgeSec}s)`);
    }

    // Check minimum liquidity (BagBot: $50K, we use $5K for Bags tokens)
    if (liquidityUsd < this.config.minLiquidityUsd) {
      return reject(
        `low liquidity ($${liquidityUsd.toFixed(0)} < $${this.config.minLiquidityUsd})`
      );
    }

    // Check minimum market cap
    if (marketCapUsd < this.config.minMarketCapUsd) {
      return reject(`low mcap ($${marketCapUsd.toFixed(0)} < $${this.config.minMarketCapUsd})`);
    }

    // Check minimum volume (KEY FILTER for Bags runners - they have MASSIVE volume)
    if (volume24hUsd < this.config.minVolume24hUsd) {
      return reject(`low volume ($${volume24hUsd.toFixed(0)} < $${this.config.minVolume24hUsd})`);
    }

    // === VOLUME/MCAP RATIO ===
    // No longer a hard filter - incorporated into scoring instead
    // GAS token had 200% vol/mcap, healthy tokens have 30-80%, lower is fine if other signals strong

    // Check buy/sell ratio
    if (buySellRatio < this.config.minBuySellRatio) {
      return reject(`weak buy pressure (${buySellRatio.toFixed(2)} < ${this.config.minBuySellRatio})`);
    }

    // Check minimum holders (soft - new runners start small)
    if (holders > 0 && holders < this.config.minHolders) {
      return reject(`too few holders (${holders} < ${this.config.minHolders})`);
    }

    // === BAGS-SPECIFIC SIGNALS (Optional bonuses, not hard requirements) ===

    // Check if token has fee claims (BONUS, not required)
    let hasFeeClaims = false;
    if (this.config.requireTokenClaimed || lifetimeFees > 0) {
      try {
        const claimEvents = await this.bagsApi.getClaimEvents(launch.mint, { limit: 5 });
        hasFeeClaims = claimEvents.length > 0;
        // Only reject if explicitly required AND no claims
        if (this.config.requireTokenClaimed && !hasFeeClaims && lifetimeFees < this.config.minLifetimeFeesSol) {
          return reject("no fee claims (token not CLAIMED on bags.fm)");
        }
      } catch {
        // API error - be lenient
        hasFeeClaims = lifetimeFees > 0;
      }
    }

    // === PRICE IMPACT CHECK ===
    // Use liquidity as proxy for micro-caps
    const estimatedImpact = (this.config.maxPositionSol * 170) / (liquidityUsd || 1) * 100;
    if (estimatedImpact > this.config.maxPriceImpactPercent) {
      return reject(`high price impact (est ${estimatedImpact.toFixed(1)}% > ${this.config.maxPriceImpactPercent}%)`);
    }

    // === SCORING SYSTEM (BagBot-aligned weights) ===
    // Weights: Vol/MCap 25%, Buy/Sell 25%, Momentum 20%, Liquidity 15%, Age 15%
    // Max possible: ~100 base + bonuses

    // 1. VOLUME/MCAP RATIO (0-25 points) - key activity indicator
    // GAS token: 200% vol/mcap, healthy active tokens: 30-80%
    if (volumeMcapRatio >= 2.0) {
      score += 25;
      reasons.push(`exceptional vol/mcap (${(volumeMcapRatio * 100).toFixed(0)}%)`);
    } else if (volumeMcapRatio >= 1.0) {
      score += 22;
      reasons.push(`strong vol/mcap (${(volumeMcapRatio * 100).toFixed(0)}%)`);
    } else if (volumeMcapRatio >= 0.5) {
      score += 18;
      reasons.push(`good vol/mcap (${(volumeMcapRatio * 100).toFixed(0)}%)`);
    } else if (volumeMcapRatio >= 0.3) {
      score += 14;
      reasons.push(`healthy vol/mcap (${(volumeMcapRatio * 100).toFixed(0)}%)`);
    } else if (volumeMcapRatio >= 0.1) {
      score += 8;
      reasons.push(`moderate vol/mcap (${(volumeMcapRatio * 100).toFixed(0)}%)`);
    } else {
      score += 3;
      reasons.push(`low vol/mcap (${(volumeMcapRatio * 100).toFixed(0)}%)`);
    }

    // 2. BUY/SELL PRESSURE (0-25 points) - momentum indicator
    if (buySellRatio >= 1.5) {
      score += 25;
      reasons.push("strong buy pressure");
    } else if (buySellRatio >= 1.3) {
      score += 20;
      reasons.push("good buy pressure");
    } else if (buySellRatio >= 1.2) {
      score += 15;
      reasons.push("positive buy pressure");
    } else if (buySellRatio >= 1.15) {
      score += 10;
      reasons.push("slight buy pressure");
    } else {
      score += 5;
      reasons.push("neutral pressure");
    }

    // 3. MOMENTUM SIGNALS (0-20 points) - price action
    if (priceChange24h > 100 && priceChange24h < 500) {
      score += 20;
      reasons.push(`pumping (+${priceChange24h.toFixed(0)}%)`);
    } else if (priceChange24h > 50 && priceChange24h <= 100) {
      score += 17;
      reasons.push(`strong momentum (+${priceChange24h.toFixed(0)}%)`);
    } else if (priceChange24h > 20 && priceChange24h <= 50) {
      score += 14;
      reasons.push(`good momentum (+${priceChange24h.toFixed(0)}%)`);
    } else if (priceChange24h > 5 && priceChange24h <= 20) {
      score += 10;
      reasons.push(`positive (+${priceChange24h.toFixed(0)}%)`);
    } else if (priceChange24h > -10) {
      score += 6;
      reasons.push("stable/consolidating");
    } else if (priceChange24h > -20) {
      score += 2;
      reasons.push("slight dip");
    } else {
      redFlags.push(`dumping (${priceChange24h.toFixed(0)}%)`);
    }

    // Late entry warning for massive pumps
    if (priceChange24h > 500) {
      reasons.push(`already pumped ${priceChange24h.toFixed(0)}% - late entry risk`);
    }

    // 4. LIQUIDITY (0-15 points) - execution quality
    // Minimum is now $5K, reward higher liquidity
    if (liquidityUsd >= 50000) {
      score += 15;
      reasons.push("excellent liquidity ($50K+)");
    } else if (liquidityUsd >= 20000) {
      score += 13;
      reasons.push("strong liquidity ($20K+)");
    } else if (liquidityUsd >= 10000) {
      score += 10;
      reasons.push("good liquidity ($10K+)");
    } else if (liquidityUsd >= 5000) {
      score += 7;
      reasons.push("adequate liquidity ($5K+)");
    } else {
      score += 3;
      reasons.push("minimum liquidity");
    }

    // 5. TOKEN AGE (0-15 points) - rug risk assessment
    const ageDays = ageSeconds / 86400;
    if (ageDays >= 2 && ageDays <= 7) {
      score += 15;
      reasons.push(`established (${ageDays.toFixed(1)} days)`);
    } else if (ageDays >= 1 && ageDays < 2) {
      score += 12;
      reasons.push(`young but proven (${ageDays.toFixed(1)} days)`);
    } else if (ageDays >= 0.25 && ageDays < 1) {
      score += 8;
      reasons.push("very young");
    } else if (ageDays < 0.25) {
      score += 4;
      reasons.push("brand new - higher risk");
    } else {
      score += 6;
      reasons.push(`older token (${ageDays.toFixed(0)} days)`);
    }

    // Holder distribution bonus (up to 5 points)
    if (holders >= 100) {
      score += 5;
      reasons.push("well distributed (100+ holders)");
    } else if (holders >= 50) {
      score += 4;
      reasons.push("good holder base (50+)");
    } else if (holders >= 20) {
      score += 2;
      reasons.push("growing holders");
    }

    // === BAGS-SPECIFIC BONUSES ===

    // Fee claims = real activity (bonus, not required)
    if (hasFeeClaims) {
      score += 10;
      reasons.push("TOKEN CLAIMED on bags.fm");
    }

    // Significant fees earned = sustained trading
    if (lifetimeFees >= 0.5) {
      score += 8;
      reasons.push(`significant fees (${lifetimeFees.toFixed(2)} SOL)`);
    } else if (lifetimeFees >= 0.1) {
      score += 4;
      reasons.push("fees accumulating");
    }

    // === SMART MONEY BONUS ===
    const smartMoneyService = getSmartMoneyService();
    const smartMoneyData = await smartMoneyService.getSmartMoneyScore(launch.mint);

    if (smartMoneyData.score >= 50) {
      score += 15;
      reasons.push(`smart money buying (${smartMoneyData.buyers.join(", ")})`);
    } else if (smartMoneyData.score >= 25) {
      score += 10;
      reasons.push("some smart money interest");
    } else if (smartMoneyData.score > 0) {
      score += 5;
      reasons.push("light smart money activity");
    }

    // Check specifically if BagBot is buying (our benchmark)
    if (smartMoneyData.buyers.some(b => b.includes("BagBot"))) {
      score += 15;
      reasons.push("BagBot is buying!");
    }

    // === SELF-LEARNING ADJUSTMENT ===
    const { adjustment, appliedSignals } = this.getLearningAdjustment(reasons);
    if (adjustment !== 0) {
      score += adjustment;
      if (adjustment > 0) {
        reasons.push(`learned bonus (+${adjustment})`);
      } else {
        redFlags.push(`learned penalty (${adjustment})`);
      }
      console.log(
        `[GhostTrader] Applied learning adjustment: ${adjustment} for ${launch.symbol} (${appliedSignals.join(", ")})`
      );
    }

    // === FINAL DECISION ===
    // Threshold: 55+ to trade (relaxed from 60 for more opportunities)
    // Max base score: ~100 (vol/mcap 25 + buy/sell 25 + momentum 20 + liq 15 + age 15)
    // + bonuses: holders 5 + bags fees 18 + smart money 30 + learning adjustment
    const shouldBuy = score >= 55 && redFlags.length === 0;

    // Calculate position size based on score (larger for higher conviction)
    const remainingExposure = this.config.maxTotalExposureSol - this.getTotalExposure();
    let suggestedAmount: number;

    // Position sizing based on score (55-120 range)
    if (score >= 95) {
      suggestedAmount = this.config.maxPositionSol; // Max conviction
    } else if (score >= 80) {
      suggestedAmount = this.config.maxPositionSol * 0.75; // High conviction
    } else if (score >= 65) {
      suggestedAmount = (this.config.minPositionSol + this.config.maxPositionSol) / 2; // Medium
    } else {
      suggestedAmount = this.config.minPositionSol; // Minimum size for borderline (55-65)
    }

    suggestedAmount = Math.min(suggestedAmount, remainingExposure);

    // Include vol/mcap in metrics for transparency
    const finalMetrics = {
      ...metrics,
      hasFeeClaims,
    };

    return { launch, token, score, reasons, redFlags, shouldBuy, suggestedAmount, metrics: finalMetrics };
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

      // BagBot check: verify price impact < 1%
      const priceImpact = parseFloat(quote.priceImpactPct || "0");
      if (priceImpact > this.config.maxPriceImpactPercent) {
        console.log(
          `[GhostTrader] Skipping ${launch.symbol}: price impact ${priceImpact.toFixed(2)}% > ${this.config.maxPriceImpactPercent}%`
        );
        this.chatter(`skipping $${launch.symbol}... impact too high`, "concerned");
        return;
      }
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
    reason: "take_profit" | "stop_loss" | "trailing_stop" | "dead_position" | "manual",
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

    // Record for learning
    await this.recordTradeOutcome(position);

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
   * Announce a trade to the world with visual feedback
   */
  private async announceTrade(type: "buy" | "sell", position: GhostPosition): Promise<void> {
    let message: string;
    let speechMessage: string;
    let emotion: string;

    if (type === "buy") {
      message = `bought ${position.amountSol.toFixed(2)} SOL of $${position.tokenSymbol}. ${position.entryReason}. watching.`;
      speechMessage = `aping into $${position.tokenSymbol}`;
      emotion = "excited";
    } else {
      const pnlSign = (position.pnlSol || 0) >= 0 ? "+" : "";
      const pnlStr = `${pnlSign}${(position.pnlSol || 0).toFixed(4)} SOL`;
      const isProfitable = (position.pnlSol || 0) >= 0;
      const exitReason =
        position.exitReason === "trailing_stop"
          ? "trailing stop locked in gains"
          : position.exitReason === "take_profit"
            ? "target hit"
            : position.exitReason === "stop_loss"
              ? "stopped out"
              : position.exitReason === "dead_position"
                ? "token died, cutting losses"
                : position.exitReason;
      message = `closed $${position.tokenSymbol}. ${exitReason}. pnl: ${pnlStr}`;
      speechMessage = isProfitable
        ? `banked ${pnlStr} on $${position.tokenSymbol}`
        : `cut losses on $${position.tokenSymbol}`;
      emotion = isProfitable ? "happy" : "sad";
    }

    // Send visual speech bubble in the game world
    if (this.worldSync) {
      this.worldSync.sendSpeak("ghost", speechMessage, emotion);

      // Update Ghost's activity status
      const activityEmoji = type === "buy" ? "📈" : (position.pnlSol || 0) >= 0 ? "💰" : "📉";
      const activityDesc =
        type === "buy"
          ? `trading $${position.tokenSymbol}`
          : `closed $${position.tokenSymbol}`;
      this.worldSync.updateAgentActivity("ghost", {
        description: activityDesc,
        emoji: activityEmoji,
        until: Date.now() + 30000, // 30 seconds
      });
    }

    // Broadcast to coordinator for other agents/systems
    if (this.coordinator) {
      await this.coordinator.broadcast("ghost", "update", message, {
        type: "trade",
        action: type,
        tokenMint: position.tokenMint,
        tokenSymbol: position.tokenSymbol,
        amountSol: position.amountSol,
        pnlSol: position.pnlSol,
      });
    }

    // Broadcast entry to Telegram channel (entries only)
    if (type === "buy" && this.lastEvaluation) {
      const signal: TradeSignal = {
        type: "entry",
        tokenSymbol: position.tokenSymbol,
        tokenName: position.tokenName,
        tokenMint: position.tokenMint,
        amountSol: position.amountSol,
        score: this.lastEvaluation.score,
        reasons: this.lastEvaluation.reasons,
        metrics: {
          marketCapUsd: this.lastEvaluation.metrics.marketCapUsd,
          liquidityUsd: this.lastEvaluation.metrics.liquidityUsd,
          volume24hUsd: this.lastEvaluation.metrics.volume24hUsd,
          buySellRatio: this.lastEvaluation.metrics.buySellRatio,
        },
      };
      this.telegramBroadcaster.broadcastEntry(signal);
      this.lastEvaluation = null; // Clear after use
    }
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
   * Random chatter - Ghost talks about what he's doing/thinking
   * Has cooldown to avoid spam
   */
  private maybeChatter(message: string, emotion: string = "neutral"): void {
    const now = Date.now();
    if (now - this.lastChatter < GhostTrader.CHATTER_COOLDOWN_MS) {
      return; // On cooldown
    }

    // 50% chance to chatter (makes Ghost more visible in the world)
    if (Math.random() > 0.5) {
      return;
    }

    if (this.worldSync) {
      this.worldSync.sendSpeak("ghost", message, emotion);
      this.lastChatter = now;
    }
  }

  /**
   * Force chatter - always sends (for important events)
   */
  private chatter(message: string, emotion: string = "neutral"): void {
    if (this.worldSync) {
      this.worldSync.sendSpeak("ghost", message, emotion);
      this.lastChatter = Date.now();
    }
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

    // Get token info - try Bags API first, then DexScreener
    let tokenSymbol = mint.slice(0, 8);
    let tokenName = "Unknown Token";

    // Try Bags API
    const token = await this.bagsApi.getToken(mint).catch(() => null);
    if (token?.symbol) {
      tokenSymbol = token.symbol;
      tokenName = token.name || tokenName;
    } else {
      // Fallback: fetch from DexScreener
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        if (dexRes.ok) {
          const dexData = await dexRes.json();
          const pair = dexData.pairs?.[0];
          if (pair?.baseToken) {
            tokenSymbol = pair.baseToken.symbol || tokenSymbol;
            tokenName = pair.baseToken.name || tokenName;
          }
        }
      } catch {
        // Keep defaults
      }
    }

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

  /**
   * Mark a position as closed without executing a trade
   * Use this when tokens were sold outside of Ghost (e.g., manually through wallet)
   */
  async markPositionClosed(
    positionId: string,
    pnlSol?: number,
    exitReason: string = "manual_external"
  ): Promise<{ success: boolean; error?: string }> {
    const position = this.positions.get(positionId);
    if (!position) {
      return { success: false, error: "Position not found" };
    }

    if (position.status !== "open") {
      return { success: false, error: "Position is not open" };
    }

    // Update position
    position.status = "closed";
    position.exitReason = exitReason;
    position.pnlSol = pnlSol ?? 0;
    position.closedAt = new Date();

    // Update in database
    await this.updatePositionInDatabase(position);

    console.log(
      `[GhostTrader] Position marked closed: ${position.tokenSymbol} (${exitReason}, PnL: ${pnlSol?.toFixed(4) || "unknown"} SOL)`
    );

    return { success: true };
  }
}

export function getGhostTrader(): GhostTrader {
  return GhostTrader.getInstance();
}

export default GhostTrader;
