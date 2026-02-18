/**
 * GhostTrader - ElizaOS Autonomous Trading Agent
 * Evaluates new launches, executes trades, manages positions
 * Runs on: Railway (deployed as part of the ElizaOS agent server)
 * NOT related to ChadGhost (MoltBook alpha-posting agent on Mac mini)
 */

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
import { getDatabase, envBool } from "../routes/shared.js";
import {
  TelegramBroadcaster,
  getTelegramBroadcaster,
  type TradeSignal,
  type ExitSignal,
} from "./TelegramBroadcaster.js";
import { getDexScreenerCache } from "./DexScreenerCache.js";
import { getMemoryService } from "./MemoryService.js";

// ============================================================================
// Constants
// ============================================================================

const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Buy & Burn configuration
const BAGS_TOKEN_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";
const SOL_INCINERATOR_API_URL = "https://v1.api.sol-incinerator.com";
const DEFAULT_BURN_PERCENT = 25; // 25% of profits
const MIN_BURN_SOL = 0.005; // Minimum SOL worth burning (below this, tx fees aren't worth it)

// Default token decimals for Bags.fm tokens (Meteora DBC uses 6 decimals, same as pump.fun)
const DEFAULT_TOKEN_DECIMALS = 6;

// Approximate SOL price in USD — used for price impact estimates.
// Doesn't need to be exact since impact calc is relative (over/under-estimate by 2x still safe).
// Update periodically or replace with a live feed if SOL moves significantly from this range.
const APPROX_SOL_PRICE_USD = 170;

// Default trading configuration — realigned with BagBot (https://github.com/BagBotX/bagbot)
// Key differences from previous config: tighter slippage, compound stop-loss, no breakeven trap
const DEFAULT_CONFIG = {
  enabled: false, // Must be explicitly enabled
  // Position sizing (BagBot uses 1 SOL max)
  minPositionSol: 0.2, // Meaningful positions (lowered for better liquidity fit)
  maxPositionSol: 1.0, // Match BagBot
  maxTotalExposureSol: 3.0, // Allow 3 full positions
  maxOpenPositions: 3, // Conservative position limit
  // Profit taking - BagBot style: 33% at +50%, 33% at +100%, 33% at +200%
  takeProfitTiers: [1.5, 2.0, 3.0], // BagBot: first tier at +50% (was 1.3x — too close to buy impact)
  partialSellPercent: 33, // Sell 33% of remaining tokens at each take-profit tier
  trailingStopPercent: 25, // After 2x, trail by 25% — micro-caps routinely retrace 20-30%
  // Risk management — BagBot compound stop: price drop AND sell pressure required
  stopLossPercent: 15, // BagBot: -15% (was -30% — too loose, and breakeven fired first anyway)
  // Dead position detection
  maxHoldTimeMinutes: 2880, // 48 hours - Bags runners need days, not hours
  minVolumeToHoldUsd: 500, // Need some volume to keep holding
  deadPositionDecayPercent: 25, // If down 25%+ and stale, consider dead
  // Liquidity requirements - TUNED FOR BAGS.FM (most tokens have $400-$4K liquidity)
  minLiquidityUsd: 1200, // $1.2K minimum — aligns with impact cap
  minMarketCapUsd: 2000, // $2K minimum (runners can start small)
  // Quality filters - aligned with BagBot patterns
  maxCreatorFeeBps: 500, // 5% max (some Bags creators set higher)
  minBuySellRatio: 1.05, // Light bullish pressure (relaxed from 1.15 — sideways markets need room)
  minHolders: 5, // New tokens start with few holders
  minVolume24hUsd: 1500, // $1.5K volume - lowered for Bags.fm market reality
  maxPriceImpactPercent: 5.0, // 5% max (BagBot uses 1%, we allow a bit more for Bags.fm bonding curves)
  // Timing - EXPANDED (Bags runners are days old, not minutes)
  minLaunchAgeSec: 300, // 5 minutes minimum (avoid instant rugs)
  maxLaunchAgeSec: 604800, // 7 DAYS max
  slippageBps: 100, // 1% slippage — BagBot uses 50-100 bps (was 300 — way too loose)
  // Bags-specific signals
  requireTokenClaimed: false, // Not required - many good tokens don't have claims yet
  minLifetimeFeesSol: 0.0, // Don't require fees (volume is better indicator)
  // Bundle/concentration detection
  maxTop5ConcentrationPct: 80, // Hard reject: top 5 wallets hold > 80%
  maxSingleHolderPct: 50, // Hard reject: single wallet holds > 50%
  // Buy & Burn
  burnEnabled: false, // Must be explicitly enabled via GHOST_BURN_ENABLED
  burnPercent: DEFAULT_BURN_PERCENT,
};

// Env var → config key mapping for DRY loading and override detection
const ENV_CONFIG_MAP: Array<{ env: string; key: keyof GhostTraderConfig; parse: (v: string) => unknown }> = [
  { env: "GHOST_MAX_POSITION_SOL", key: "maxPositionSol", parse: parseFloat },
  { env: "GHOST_MAX_TOTAL_EXPOSURE", key: "maxTotalExposureSol", parse: parseFloat },
  { env: "GHOST_MAX_POSITIONS", key: "maxOpenPositions", parse: (v) => parseInt(v) },
  { env: "GHOST_STOP_LOSS_PERCENT", key: "stopLossPercent", parse: parseFloat },
  { env: "GHOST_TRAILING_STOP_PERCENT", key: "trailingStopPercent", parse: parseFloat },
  { env: "GHOST_PARTIAL_SELL_PERCENT", key: "partialSellPercent", parse: parseFloat },
  { env: "GHOST_BURN_PERCENT", key: "burnPercent", parse: (v) => parseInt(v) },
];

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
  sellAttempts: number;
  noPriceCount: number;
  peakMultiplier: number;
  tiersSold: number;      // How many take-profit tiers already sold (0, 1, 2)
}

export interface TradeEvaluation {
  launch: RecentLaunch;
  token: TokenInfo | null;
  score: number;
  reasons: string[];
  redFlags: string[];
  shouldBuy: boolean;
  suggestedAmount: number;
  shortRetry?: boolean;
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
    top5HolderPct?: number; // Bundle detection
    largestHolderPct?: number; // Bundle detection
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
  partialSellPercent: number; // % of remaining tokens to sell at each take-profit tier
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
  // Timing
  minLaunchAgeSec: number;
  maxLaunchAgeSec: number;
  slippageBps: number;
  // Bags-specific signals
  requireTokenClaimed: boolean; // Token must have fee claims (optional)
  minLifetimeFeesSol: number; // Minimum fees generated
  // Bundle/concentration detection
  maxTop5ConcentrationPct: number; // Hard reject: top 5 wallets hold > X%
  maxSingleHolderPct: number; // Hard reject: single wallet holds > X%
  // Buy & Burn
  burnEnabled: boolean; // Enable BAGS buy & burn on profitable trades
  burnPercent: number; // % of trade profit to allocate to buy & burn
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
  // Buy & Burn stats
  totalBagsBurned: number;
  totalSolSpentOnBurns: number;
  burnCount: number;
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

  // Tracking which launches we've already traded (cleared every 4h to allow re-evaluation)
  private tradedMints: Set<string> = new Set();
  private tradedMintsLastClear: number = Date.now();
  private static readonly TRADED_MINTS_CLEAR_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

  // Chatter cooldown (avoid spamming speech bubbles)
  private lastChatter: number = 0;
  private static readonly CHATTER_COOLDOWN_MS = 30000; // 30 seconds between random chatter

  // Self-learning: track which signals lead to wins/losses
  private signalPerformance: Map<string, SignalPerformance> = new Map();

  // Telegram broadcaster for trade signals
  private telegramBroadcaster: TelegramBroadcaster;

  // Cached burn stats (refreshed on burns and on init)
  private cachedBurnStats = { totalBagsBurned: 0, totalSolSpent: 0, burnCount: 0 };

  // Store last evaluation for telegram broadcast (need metrics after position created)
  private lastEvaluation: TradeEvaluation | null = null;

  // Cache token decimals to avoid repeated RPC calls
  private tokenDecimalsCache: Map<string, number> = new Map();

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

    // Load config from environment (table-driven for numeric/int values)
    if (envBool("GHOST_TRADING_ENABLED")) this.config.enabled = true;
    if (envBool("GHOST_BURN_ENABLED")) this.config.burnEnabled = true;
    if (process.env.GHOST_TAKE_PROFIT_TIERS) {
      this.config.takeProfitTiers = process.env.GHOST_TAKE_PROFIT_TIERS
        .split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    }
    for (const { env, key, parse } of ENV_CONFIG_MAP) {
      const val = process.env[env];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (val) (this.config as any)[key] = parse(val);
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

    // Load burn stats cache
    await this.refreshBurnStatsCache();

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

    // Add sell_attempts and no_price_count columns if missing (migration)
    await this.db`
      ALTER TABLE ghost_positions
      ADD COLUMN IF NOT EXISTS sell_attempts INTEGER DEFAULT 0
    `;
    await this.db`
      ALTER TABLE ghost_positions
      ADD COLUMN IF NOT EXISTS no_price_count INTEGER DEFAULT 0
    `;
    await this.db`
      ALTER TABLE ghost_positions
      ADD COLUMN IF NOT EXISTS peak_multiplier DECIMAL(18, 9) DEFAULT 1.0
    `;
    await this.db`
      ALTER TABLE ghost_positions
      ADD COLUMN IF NOT EXISTS tiers_sold INTEGER DEFAULT 0
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

    // Buy & burn tracking table
    await this.db`
      CREATE TABLE IF NOT EXISTS ghost_burns (
        id UUID PRIMARY KEY,
        sol_spent DECIMAL(18, 9) NOT NULL,
        bags_bought DECIMAL(30, 0) NOT NULL,
        bags_burned DECIMAL(30, 0) NOT NULL,
        buy_tx_signature VARCHAR(128),
        burn_tx_signature VARCHAR(128),
        trigger_trade_id VARCHAR(64),
        cumulative_pnl_at_burn DECIMAL(18, 9),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await this.db`
      CREATE INDEX IF NOT EXISTS idx_ghost_burns_created
      ON ghost_burns(created_at)
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

    // Load persisted config overrides from database
    // Priority: defaults → DB persisted → env vars (env wins, set in constructor before this)
    // Since env vars are already applied in constructor, we only apply DB values for keys
    // that DON'T have env var overrides (env vars take precedence).
    // Build set of config keys overridden by env vars (env takes precedence over DB)
    const envOverriddenKeys = new Set<string>();
    for (const { env, key } of ENV_CONFIG_MAP) {
      if (process.env[env]) envOverriddenKeys.add(`config_${key}`);
    }
    if (process.env.GHOST_TAKE_PROFIT_TIERS) envOverriddenKeys.add("config_takeProfitTiers");
    if (process.env.GHOST_BURN_ENABLED) envOverriddenKeys.add("config_burnEnabled");

    const allConfigRows = (await this.db`
      SELECT key, value FROM ghost_config WHERE key LIKE 'config_%'
    `) as Array<{ key: string; value: string }>;

    let dbOverrides = 0;
    for (const row of allConfigRows) {
      if (envOverriddenKeys.has(row.key)) continue; // env var takes precedence

      const configKey = row.key.replace("config_", "") as keyof GhostTraderConfig;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = this.config as any;
      if (configKey === "takeProfitTiers") {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) {
          cfg[configKey] = parsed;
          dbOverrides++;
        }
      } else if (configKey === "burnEnabled") {
        cfg[configKey] = row.value === "true";
        dbOverrides++;
      } else if (configKey in this.config) {
        const numValue = parseFloat(row.value);
        if (!isNaN(numValue)) {
          cfg[configKey] = numValue;
          dbOverrides++;
        }
      }
    }

    if (dbOverrides > 0) {
      console.log(`[GhostTrader] Loaded ${dbOverrides} persisted config overrides from database`);
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
      sell_attempts: number | null;
      no_price_count: number | null;
      peak_multiplier: string | null;
      tiers_sold: number | null;
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
        sellAttempts: row.sell_attempts || 0,
        noPriceCount: row.no_price_count || 0,
        peakMultiplier: row.peak_multiplier ? parseFloat(row.peak_multiplier) : 1.0,
        tiersSold: row.tiers_sold || 0,
      };
      this.positions.set(position.id, position);
      // Only block re-evaluation for open positions.
      // Failed/closed positions let the mint be retried after restart.
      if (position.status === "open") {
        this.tradedMints.add(position.tokenMint);
        openCount++;
      } else if (position.status === "closed") {
        closedCount++;
      }
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

        const scoreAdjustment = GhostTrader.calcScoreAdjustment(winRate, row.total_trades);

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

      // Detect corrupted learning data from the pre-fix entry price bug:
      // If we have 5+ signals with 3+ trades each and the aggregate win rate is < 5%,
      // the data is almost certainly poisoned by the old LAMPORTS_PER_SOL unit mismatch.
      const reliableSignals = Array.from(this.signalPerformance.values()).filter(
        (s) => s.totalTrades >= 3
      );
      if (reliableSignals.length >= 5) {
        const totalWins = reliableSignals.reduce((sum, s) => sum + s.winningTrades, 0);
        const totalTrades = reliableSignals.reduce((sum, s) => sum + s.totalTrades, 0);
        const aggregateWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;

        if (aggregateWinRate < 0.05) {
          console.warn(
            `[GhostTrader] CORRUPTED LEARNING DATA DETECTED: ${reliableSignals.length} signals, ` +
            `${totalWins}/${totalTrades} wins (${(aggregateWinRate * 100).toFixed(1)}% win rate). ` +
            `Auto-resetting to clean slate.`
          );
          await this.resetLearning();
        }
      }
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

    const isWin = (position.pnlSol ?? 0) > 0;
    const pnl = position.pnlSol ?? 0;

    // Parse entry reasons (comma-separated signals), normalize to stable keys
    const signals = position.entryReason.split(",").map((s) => this.normalizeSignalKey(s)).filter(Boolean);

    for (const signal of signals) {
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

        existing.scoreAdjustment = GhostTrader.calcScoreAdjustment(existing.winRate, existing.totalTrades);

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
   * Persist a trade event as a high-importance memory for Ghost.
   * These memories are surfaced in chat (via MemoryService.summarizeForPrompt)
   * and in autonomous tick decisions (via AgentTickService.llmDecision).
   */
  private persistTradeMemory(
    action: "buy" | "sell",
    position: GhostPosition,
    extra?: { score?: number; pnlSol?: number; exitReason?: string }
  ): void {
    const memoryService = getMemoryService();
    if (!memoryService) return;

    let content: string;

    if (action === "buy") {
      content = `Bought ${position.amountSol.toFixed(2)} SOL of $${position.tokenSymbol} (${position.tokenMint.slice(0, 8)}...). Score: ${extra?.score ?? "N/A"}. Reasons: ${position.entryReason}`;
    } else {
      const pnl = extra?.pnlSol ?? position.pnlSol ?? 0;
      const pnlSign = pnl >= 0 ? "+" : "";
      content = `Closed $${position.tokenSymbol} position. ${extra?.exitReason || position.exitReason || "unknown"}. PnL: ${pnlSign}${pnl.toFixed(4)} SOL`;
    }

    memoryService
      .createMemory({
        agentId: "ghost",
        content,
        memoryType: "fact",
        importance: 0.8,
        metadata: {
          tradeType: action,
          tokenMint: position.tokenMint,
          tokenSymbol: position.tokenSymbol,
          amountSol: position.amountSol,
          ...(extra?.score !== undefined && { score: extra.score }),
          ...(extra?.pnlSol !== undefined && { pnlSol: extra.pnlSol }),
          ...(extra?.exitReason && { exitReason: extra.exitReason }),
        },
      })
      .catch((err: Error) =>
        console.warn("[GhostTrader] Memory write failed:", err.message)
      );
  }

  /**
   * Calculate score adjustment from win rate. Requires 3+ trades minimum.
   */
  private static calcScoreAdjustment(winRate: number, totalTrades: number): number {
    if (totalTrades < 3) return 0;
    if (winRate >= 0.7) return 10;
    if (winRate >= 0.5) return 5;
    if (winRate <= 0.3) return -10;
    if (winRate <= 0.4) return -5;
    return 0;
  }

  /**
   * Normalize a reason string into a stable signal key for learning.
   * Strips dynamic values (percentages, dollar amounts, SOL amounts, day counts)
   * so that e.g. "exceptional vol/mcap (200%)" and "exceptional vol/mcap (150%)"
   * both map to the same signal key: "exceptional vol/mcap".
   */
  private normalizeSignalKey(reason: string): string {
    return reason
      .toLowerCase()
      .trim()
      .replace(/\s*\([^)]*\)\s*/g, "")       // strip parenthetical content: "(200%)", "(2.3 days)"
      .replace(/\s*\+\d+[\d.]*%/g, "")        // strip "+45%", "+342%"
      .replace(/\s*-\d+[\d.]*%/g, "")          // strip "-18.3%"
      .replace(/\s*\$[\d,.]+[km]?/gi, "")      // strip "$500", "$1,234", "$10K"
      .replace(/\s*[\d.]+\s*sol\b/gi, "")      // strip "0.52 SOL", "5.5 sol"
      .replace(/\s*\d+min\b/g, "")             // strip "320min"
      .replace(/\s+/g, " ")                    // collapse multiple spaces
      .trim();
  }

  /**
   * Get the learned score adjustment for a set of reasons
   */
  private getLearningAdjustment(reasons: string[]): { adjustment: number; appliedSignals: string[] } {
    let totalAdjustment = 0;
    const appliedSignals: string[] = [];

    for (const reason of reasons) {
      const signal = this.normalizeSignalKey(reason);
      if (!signal) continue;
      const perf = this.signalPerformance.get(signal);

      if (perf && perf.scoreAdjustment !== 0) {
        totalAdjustment += perf.scoreAdjustment;
        // Cap cumulative penalties at -15 to prevent learning death spiral
        // (multiple -10 signals would otherwise make 65 threshold unreachable)
        if (totalAdjustment < -15) totalAdjustment = -15;
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
  async resetLearning(): Promise<{ success: boolean; signalsCleared: number; memoriesCleared: number }> {
    const signalsCleared = this.signalPerformance.size;
    let memoriesCleared = 0;

    // Clear in-memory learning cache
    this.signalPerformance.clear();

    // Clear learning database
    if (this.db) {
      await this.db`DELETE FROM ghost_learning`;
      console.log(`[GhostTrader] Reset learning data: ${signalsCleared} signals cleared`);
    }

    // Clear poisoned trade memories from MemoryService
    // These contain false "stop_loss" / "stopped out" outcomes from the old entry price bug
    const memoryService = getMemoryService();
    if (memoryService) {
      const poisonedMemories = await memoryService.getMemories("ghost", {
        memoryType: "fact",
        limit: 200,
      });

      const tradeMemoryKeywords = ["stop_loss", "stopped out", "dead_position", "token died", "Closed $", "failed"];
      const toDelete = poisonedMemories.filter((m) =>
        tradeMemoryKeywords.some((kw) => m.content.includes(kw))
      );

      for (const mem of toDelete) {
        await memoryService.deleteMemory(mem.id);
      }
      memoriesCleared = toDelete.length;

      if (memoriesCleared > 0) {
        console.log(`[GhostTrader] Cleared ${memoriesCleared} poisoned trade memories`);
      }
    }

    return { success: true, signalsCleared, memoriesCleared };
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

    // Periodically clear tradedMints so tokens can be re-evaluated
    // (market conditions change — a token rejected 4h ago may now qualify)
    const now = Date.now();
    if (now - this.tradedMintsLastClear > GhostTrader.TRADED_MINTS_CLEAR_INTERVAL_MS) {
      // Keep mints we currently have open positions on
      const openMints = new Set<string>();
      for (const p of this.positions.values()) {
        if (p.status === "open") openMints.add(p.tokenMint);
      }
      const prevSize = this.tradedMints.size;
      this.tradedMints = openMints;
      this.tradedMintsLastClear = now;
      console.log(
        `[GhostTrader] Cleared tradedMints (${prevSize} -> ${openMints.size}), allowing re-evaluation`
      );
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
    let evaluatedCount = 0;

    for (const launch of launches) {
      // Skip if already traded or recently evaluated
      if (this.tradedMints.has(launch.mint)) continue;
      if (this.wasRecentlyEvaluated(launch.mint)) continue;

      // Stagger RPC calls: 500ms between evaluations to avoid bursting
      // the Helius rate limit (each evaluation fires 2+ RPC calls for
      // concentration checks, plus API calls for token info)
      if (evaluatedCount > 0) {
        await new Promise((r) => setTimeout(r, 500));
      }

      const evaluation = await this.evaluateLaunch(launch);
      // Use a short 30s retry window for young tokens with no DexScreener data yet
      const ttlMs = evaluation.shortRetry ? 30_000 : undefined;
      this.markAsEvaluated(launch.mint, ttlMs);
      evaluatedCount++;

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
      const success = await this.executeBuy(best);
      if (!success) {
        this.chatter(`failed to execute buy on $${best.launch.symbol}`, "concerned");
        console.error(`[GhostTrader] Buy execution failed for ${best.launch.symbol} — evaluation passed but trade did not go through`);
      }
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
      // Get current price and market data
      // Priority: bags.fm bonding curve quote (ground truth) > DexScreener > Bags API
      let currentPriceSol = 0;
      let volume24hUsd = 0;
      let liquidityUsd = 0;
      let buySellRatioM5 = 1.0; // Default neutral — used for compound stop-loss
      let usedBondingCurve = false;
      let noM5Activity = false; // Only true when DexScreener CONFIRMS both buysM5 and sellsM5 are 0

      // 1. Try bags.fm bonding curve sell quote first (BagBot approach — most accurate)
      // This tells us what we'd ACTUALLY get for selling, not theoretical spot price
      try {
        const sellQuote = await this.bagsApi.getBondingCurveSellQuote(
          position.tokenMint,
          position.amountTokens
        );
        if (sellQuote && sellQuote.outSol > 0) {
          const decimals = await this.getTokenDecimals(position.tokenMint);
          const wholeTokens = position.amountTokens / (10 ** decimals);
          currentPriceSol = sellQuote.outSol / wholeTokens;
          usedBondingCurve = true;
        }
      } catch {
        // Non-fatal, fall through to spot price sources
      }

      // 2. Fall back to Bags API spot price
      if (!usedBondingCurve) {
        const token = await this.bagsApi.getToken(position.tokenMint).catch(() => null);
        if (token?.price) {
          currentPriceSol = token.price;
          volume24hUsd = token.volume24h || 0;
        }
      }

      // 3. Always check DexScreener for volume/liquidity/m5 data (needed for compound stop-loss)
      let dexPriceSol = 0;
      try {
        const dexData = await getDexScreenerCache().getTokenData(position.tokenMint);
        if (dexData) {
          dexPriceSol = dexData.priceNative || 0;
          if (dexPriceSol && !currentPriceSol) {
            currentPriceSol = dexPriceSol;
          }
          // Capture m5 buy/sell ratio for compound stop-loss (BagBot pattern)
          if (dexData.sellsM5 > 0) {
            buySellRatioM5 = dexData.buysM5 / dexData.sellsM5;
            noM5Activity = false;
          } else if (dexData.buysM5 > 0) {
            buySellRatioM5 = 10.0; // All buys, no sells = very bullish
            noM5Activity = false;
          } else {
            // DexScreener responded but both m5 counts are 0 — token has gone quiet.
            // Fire compound stop unconditionally at -stopLossPercent.
            noM5Activity = true;
          }
          volume24hUsd = dexData.volume24hUsd || volume24hUsd;
          liquidityUsd = dexData.liquidityUsd || 0;
        }
      } catch {
        console.warn(`[GhostTrader] Failed to get DexScreener data for ${position.tokenSymbol}`);
      }

      // Cross-validate: if NOT using bonding curve and both APIs have prices that differ >10x
      if (!usedBondingCurve && currentPriceSol > 0 && dexPriceSol > 0) {
        const ratio = currentPriceSol / dexPriceSol;
        if (ratio > 10 || ratio < 0.1) {
          console.warn(
            `[GhostTrader] Price mismatch for ${position.tokenSymbol}: Bags=${currentPriceSol}, DexScreener=${dexPriceSol} (ratio ${ratio.toFixed(1)}x) — using DexScreener`
          );
          currentPriceSol = dexPriceSol;
        }
      }

      if (currentPriceSol === 0) {
        position.noPriceCount = (position.noPriceCount || 0) + 1;
        console.warn(
          `[GhostTrader] No price data for ${position.tokenSymbol} (attempt ${position.noPriceCount}/10)`
        );
        // After 10 consecutive checks with no price (~20 min), mark as failed
        if (position.noPriceCount >= 10) {
          console.log(
            `[GhostTrader] Marking ${position.tokenSymbol} as failed - no price data after ${position.noPriceCount} checks`
          );
          position.status = "failed";
          position.exitReason = "no_price_data";
          position.pnlSol = -position.amountSol; // Assume total loss
          position.closedAt = new Date();
          await this.updatePositionInDatabase(position);
          await this.recordTradeOutcome(position);
        } else {
          await this.updatePositionInDatabase(position);
        }
        continue;
      }

      // Reset no-price counter if we got price data
      if (position.noPriceCount > 0) {
        position.noPriceCount = 0;
      }

      // Calculate current multiplier (1.0 = breakeven)
      const currentMultiplier = currentPriceSol / position.entryPriceSol;
      const priceChangePercent = (currentMultiplier - 1) * 100;

      // Calculate hold time
      const holdTimeMinutes = (Date.now() - position.createdAt.getTime()) / 60000;

      // Track highest multiplier for trailing stop (persisted to DB).
      // Skip the first 5 minutes: own buy-impact on thin bonding curves temporarily
      // inflates the spot price, causing a fake peakMultiplier that can trip the
      // trailing stop when the price naturally reverts.
      const hasSettled = holdTimeMinutes >= 5;
      if (hasSettled && currentMultiplier > position.peakMultiplier) {
        position.peakMultiplier = currentMultiplier;
        await this.updatePositionInDatabase(position);
      }

      // === COMPOUND STOP LOSS (BagBot pattern) ===
      // BagBot requires BOTH conditions: price drop AND active sell pressure.
      // This prevents stopping out on normal volatility where price dips but buys resume.
      // Condition: price <= -stopLossPercent AND m5 buy/sell ratio < 0.5 (sellers dominating)
      //
      // No-m5 fallback: if the token has gone quiet (buysM5 = sellsM5 = 0), treat the stop
      // as unconditional. A position at -15%+ with zero 5-minute activity is not recovering —
      // without this fallback, buySellRatioM5 stays at 1.0 and the compound stop NEVER fires,
      // creating zombie positions that occupy slots indefinitely.
      const stopLossHit = priceChangePercent <= -this.config.stopLossPercent;
      const sellPressureConfirmed = buySellRatioM5 < 0.5;
      // noM5Activity stop requires 30-minute settle time: own buy-impact on thin
      // bonding curves can cause brief quiet windows in the first 30 min.
      const isSettled = holdTimeMinutes >= 30;
      if (stopLossHit && (sellPressureConfirmed || (noM5Activity && isSettled))) {
        const stopReason = sellPressureConfirmed
          ? `m5 buy/sell: ${buySellRatioM5.toFixed(2)}`
          : `no m5 activity after ${holdTimeMinutes.toFixed(0)}min`;
        console.log(
          `[GhostTrader] Compound stop loss triggered for ${position.tokenSymbol} ` +
            `(price: ${priceChangePercent.toFixed(1)}%, ${stopReason})`
        );
        await this.executeClose(position, "stop_loss", currentPriceSol);
        continue;
      }
      // Hard stop at 2x the configured stop-loss — unconditional safety net
      // Even if buy pressure is present, a -30% drop (at default 15% config) means exit
      if (priceChangePercent <= -(this.config.stopLossPercent * 2)) {
        console.log(
          `[GhostTrader] Hard stop loss triggered for ${position.tokenSymbol} (${priceChangePercent.toFixed(1)}%)`
        );
        await this.executeClose(position, "stop_loss", currentPriceSol);
        continue;
      }

      // BREAKEVEN PROTECTION: REMOVED
      // BagBot never had breakeven stops. On thin-liquidity bonding curves, the bot's
      // own buy impact inflates the post-trade spot price (e.g., to 1.3-1.6x), setting
      // a fake peakMultiplier. When the price naturally reverts, the breakeven stop fires
      // and the bot sells at a ~5% loss from round-trip slippage. Every. Single. Trade.
      // The trailing stop at 2x handles real winners; no need for premature breakeven exits.

      // === NEAR-ENTRY POSITION TIMEOUT ===
      // Catches buy-impact zombies: positions that peaked from bonding curve buy impact
      // (~1.3x fake) then reverted to near-entry. Since the first TP tier is at 1.5x,
      // these positions never trigger a TP. Without this check they'd sit open for up to
      // 48h (maxHoldTimeMinutes), occupying a slot and blocking new entries.
      // Fires after 6h when: below +5% AND at least -2% down (not bouncing around 0).
      // Guard: NOT in profit — genuine runners above +5% are left to run.
      const isInProfitForTimeout = currentMultiplier > 1.05;
      const isFlatTooLong =
        !isInProfitForTimeout &&
        holdTimeMinutes > 360 && // 6 hours
        priceChangePercent <= -2; // at least -2% below entry
      if (isFlatTooLong) {
        console.log(
          `[GhostTrader] Near-entry timeout for ${position.tokenSymbol} ` +
            `(${priceChangePercent.toFixed(1)}% after ${holdTimeMinutes.toFixed(0)}min, ` +
            `peak was ${position.peakMultiplier.toFixed(2)}x)`
        );
        this.chatter(`cutting $${position.tokenSymbol} flat — not moving after 6h`, "concerned");
        await this.executeClose(position, "stop_loss", currentPriceSol);
        continue;
      }

      // === DEAD POSITION CHECK ===
      // Detect tokens that are slowly dying: held too long + no volume + decaying price
      // IMPORTANT: Never kill a position that's currently in profit — only dead if losing
      const isInProfit = currentMultiplier > 1.05; // 5% buffer above breakeven
      const isHeldTooLong = holdTimeMinutes > this.config.maxHoldTimeMinutes;
      const isVolumeDead = volume24hUsd < this.config.minVolumeToHoldUsd;
      const isDecaying =
        priceChangePercent <= -this.config.deadPositionDecayPercent &&
        priceChangePercent > -(this.config.stopLossPercent * 2); // Above hard stop (2x stopLoss)
      const isLiquidityDrained = liquidityUsd < 200; // Less than $200 liquidity (including $0)

      // Dead if: liquidity drained (always exit — can't sell at any price)
      // OR NOT in profit AND: (held too long AND low volume) OR (decaying AND no volume)
      if (isLiquidityDrained || (!isInProfit && ((isHeldTooLong && isVolumeDead) || (isDecaying && isVolumeDead)))) {
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
      if (position.peakMultiplier >= 2.0) {
        const trailingStopLevel = position.peakMultiplier * (1 - this.config.trailingStopPercent / 100);
        if (currentMultiplier <= trailingStopLevel) {
          console.log(
            `[GhostTrader] Trailing stop triggered for ${position.tokenSymbol} ` +
              `(peak: ${position.peakMultiplier.toFixed(2)}x, current: ${currentMultiplier.toFixed(2)}x)`
          );
          await this.executeClose(position, "trailing_stop", currentPriceSol);
          continue;
        }
      }

      // === TAKE-PROFIT (Partial Exit Ladder) ===
      // Sell partialSellPercent% at each tier, then trailing stop manages the rest
      const sortedTiers = [...this.config.takeProfitTiers].sort((a, b) => a - b);
      const nextTierIndex = position.tiersSold || 0;

      if (nextTierIndex < sortedTiers.length) {
        // Partial exit tiers (e.g., 1.3x, 2.0x, 3.0x) — trailing stop manages remainder
        const nextTier = sortedTiers[nextTierIndex];
        if (currentMultiplier >= nextTier) {
          console.log(
            `[GhostTrader] Partial take-profit tier ${nextTierIndex + 1} triggered for ${position.tokenSymbol} at ${currentMultiplier.toFixed(2)}x (target was ${nextTier}x)`
          );

          // Chatter about the partial win (percentage-based messaging)
          const pctGain = ((currentMultiplier - 1) * 100).toFixed(0);
          const sellPct = this.config.partialSellPercent;
          const winMessages = [
            `taking ${sellPct}% off $${position.tokenSymbol} at +${pctGain}%, letting the rest ride`,
            `partial exit on $${position.tokenSymbol} at +${pctGain}%`,
            `$${position.tokenSymbol} +${pctGain}% — securing ${sellPct}%, riding more`,
          ];
          this.maybeChatter(winMessages[Math.floor(Math.random() * winMessages.length)], "happy");

          await this.executePartialClose(position, nextTierIndex, currentPriceSol);
          continue;
        }
      }
      // else: final tier — trailing stop (above) manages the remaining position

      // Log position status for monitoring (not yet at take-profit)
      if (currentMultiplier >= 1.2) {
        console.log(
          `[GhostTrader] ${position.tokenSymbol} at +${priceChangePercent.toFixed(1)}% - approaching take-profit (tier ${nextTierIndex + 1}: +${((sortedTiers[nextTierIndex] || sortedTiers[sortedTiers.length - 1]) - 1) * 100}%)`
        );
      } else if (holdTimeMinutes > 60) {
        // Log stale positions that haven't moved
        console.log(
          `[GhostTrader] ${position.tokenSymbol} held ${holdTimeMinutes.toFixed(0)}min at ${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(1)}%, vol: $${volume24hUsd.toFixed(0)}`
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
   * Total: 100+ points possible, need 65+ to buy (tuned for Bags.fm micro-caps)
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

    const metrics: TradeEvaluation["metrics"] = {
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
      // Young tokens (< 15 min) may not be indexed by DexScreener yet — retry soon
      const isUnhydrated = liquidityUsd === 0 && ageSeconds < 900;
      const result = reject(`low liquidity ($${liquidityUsd.toFixed(0)} < $${this.config.minLiquidityUsd})`);
      return isUnhydrated ? { ...result, shortRetry: true } : result;
    }

    // Check minimum market cap
    if (marketCapUsd < this.config.minMarketCapUsd) {
      return reject(`low mcap ($${marketCapUsd.toFixed(0)} < $${this.config.minMarketCapUsd})`);
    }

    // Check minimum volume (KEY FILTER for Bags runners - they have MASSIVE volume)
    if (volume24hUsd < this.config.minVolume24hUsd) {
      // Young tokens (< 15 min) may not be indexed by DexScreener yet — retry soon
      const isUnhydrated = volume24hUsd === 0 && ageSeconds < 900;
      const result = reject(`low volume ($${volume24hUsd.toFixed(0)} < $${this.config.minVolume24hUsd})`);
      return isUnhydrated ? { ...result, shortRetry: true } : result;
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
    // Use minimum position size for impact estimate (actual size adjusted later by score)
    const estimatedImpact = (this.config.minPositionSol * APPROX_SOL_PRICE_USD) / (liquidityUsd || 1) * 100;
    if (estimatedImpact > this.config.maxPriceImpactPercent) {
      return reject(`high price impact (est ${estimatedImpact.toFixed(1)}% > ${this.config.maxPriceImpactPercent}%)`);
    }

    // === BUNDLE / CONCENTRATION CHECK ===
    // Detect tokens where deployer self-buys from multiple wallets
    const concentration = this.solanaService
      ? await this.solanaService.getTopHolderConcentration(launch.mint)
      : null;
    if (concentration) {
      metrics.top5HolderPct = Math.round(concentration.top5Pct * 10) / 10;
      metrics.largestHolderPct = Math.round(concentration.largestPct * 10) / 10;

      console.log(
        `[GhostTrader] ${launch.symbol} concentration: top5=${concentration.top5Pct.toFixed(1)}%, largest=${concentration.largestPct.toFixed(1)}%`
      );

      // Hard reject: single wallet holds majority
      if (concentration.largestPct > this.config.maxSingleHolderPct) {
        return reject(
          `bundled (single wallet holds ${concentration.largestPct.toFixed(1)}%)`
        );
      }

      // Hard reject: top 5 wallets hold extreme concentration
      if (concentration.top5Pct > this.config.maxTop5ConcentrationPct) {
        return reject(
          `bundled (top 5 hold ${concentration.top5Pct.toFixed(1)}%)`
        );
      }

      // Score penalty for concentration (no redFlag — micro-cap Bags tokens
      // commonly have top-5 > 60% early on; the score penalty is sufficient)
      if (concentration.top5Pct > 50) {
        score -= 10;
      } else if (concentration.top5Pct > 40) {
        score -= 5;
      }

      // Bonus for well-distributed tokens
      if (concentration.top5Pct < 25) {
        score += 5;
        reasons.push("well distributed supply");
      }
    }
    // If concentration is null (RPC error/timeout), continue without penalty

    // === FAKE VOLUME DETECTION (BagBot pattern) ===
    // Detect wash trading: high avg transaction size + low transaction count = likely fake volume.
    // Only escalate to a RED FLAG (hard block) for extreme cases. Borderline patterns get a score
    // penalty only — Bags.fm micro-caps frequently have $1500-$3K volume with just a handful of
    // transactions ($500 avg tx with < 50 txns was triggering on legitimate low-activity tokens).
    const totalTxns24h = buys24h + sells24h;
    const avgTxSizeUsd = totalTxns24h > 0 ? volume24hUsd / totalTxns24h : 0;
    if (avgTxSizeUsd > 1000 && totalTxns24h < 20) {
      // Extreme: $1K+ avg tx with almost no transactions — almost certainly wash trading
      score -= 25;
      redFlags.push(`likely wash trading (avg tx $${avgTxSizeUsd.toFixed(0)}, only ${totalTxns24h} txns)`);
    } else if (avgTxSizeUsd > 500 && totalTxns24h < 50) {
      // Borderline: score penalty only, don't hard-block — could be a few large legitimate buys
      score -= 15;
      reasons.push(`suspicious volume pattern (avg tx $${avgTxSizeUsd.toFixed(0)}, ${totalTxns24h} txns)`);
    } else if (avgTxSizeUsd > 200 && totalTxns24h < 100) {
      score -= 10;
      reasons.push(`low tx count (avg tx $${avgTxSizeUsd.toFixed(0)}, ${totalTxns24h} txns)`);
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

    // 4. LIQUIDITY (0-15 points) - execution quality (tuned for Bags.fm micro-caps)
    if (liquidityUsd >= 10000) {
      score += 15;
      reasons.push("excellent liquidity ($10K+)");
    } else if (liquidityUsd >= 5000) {
      score += 13;
      reasons.push("strong liquidity ($5K+)");
    } else if (liquidityUsd >= 2000) {
      score += 10;
      reasons.push("good liquidity ($2K+)");
    } else if (liquidityUsd >= 1000) {
      score += 7;
      reasons.push("adequate liquidity ($1K+)");
    } else if (liquidityUsd >= 500) {
      score += 4;
      reasons.push("minimum liquidity ($500+)");
    } else {
      score += 2;
      reasons.push("very low liquidity");
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
        reasons.push(`learned penalty (${adjustment})`);
      }
      console.log(
        `[GhostTrader] Applied learning adjustment: ${adjustment} for ${launch.symbol} (${appliedSignals.join(", ")})`
      );
    }

    // === MEMORY-INFORMED ADJUSTMENT ===
    // Check if Ghost has past experience with this token (e.g., previously evaluated, traded)
    const memoryService = getMemoryService();
    if (memoryService) {
      const tokenMemories = await memoryService.searchSimilar(
        "ghost",
        `$${launch.symbol} ${launch.mint.slice(0, 8)}`,
        { limit: 3, minSimilarity: 0.5 }
      ).catch(() => []);

      if (tokenMemories.length > 0) {
        const hasNegativeExperience = tokenMemories.some(
          (m) =>
            m.memory.content.includes("stop_loss") ||
            m.memory.content.includes("dead_position") ||
            m.memory.content.includes("failed") ||
            m.memory.content.includes("stopped out")
        );

        if (hasNegativeExperience) {
          score -= 10;
          reasons.push("negative past experience (-10)");
          // NOTE: no redFlag here — prior fixes (4defe6a, 9fc70d4) showed that
          // redFlag vetoes on learned data cause Ghost to stop trading entirely.
          // The -10 score penalty is sufficient without a hard veto.
        }

        const hasPositiveExperience = tokenMemories.some(
          (m) =>
            m.memory.content.includes("take_profit") ||
            m.memory.content.includes("trailing_stop") ||
            m.memory.content.includes("target hit")
        );

        if (hasPositiveExperience && !hasNegativeExperience) {
          score += 5;
          reasons.push("positive past experience");
        }
      }
    }

    // === FINAL DECISION ===
    // Threshold: 55+ to trade — tuned for Bags.fm micro-caps where signals are weaker
    // Max base score: ~100 (vol/mcap 25 + buy/sell 25 + momentum 20 + liq 15 + age 15)
    // + bonuses: holders 5 + bags fees 18 + smart money 30 + learning adjustment
    const shouldBuy = score >= 55 && redFlags.length === 0;

    // Calculate position size based on score (larger for higher conviction)
    const remainingExposure = this.config.maxTotalExposureSol - this.getTotalExposure();
    let suggestedAmount: number;

    // Position sizing based on score (55+ range, since shouldBuy requires >= 55)
    if (score >= 90) {
      suggestedAmount = this.config.maxPositionSol; // Max conviction
    } else if (score >= 75) {
      suggestedAmount = this.config.maxPositionSol * 0.75; // High conviction
    } else if (score >= 65) {
      suggestedAmount = (this.config.minPositionSol + this.config.maxPositionSol) / 2; // Medium
    } else {
      suggestedAmount = this.config.minPositionSol; // Minimum size for 55-64 range
    }

    suggestedAmount = Math.min(suggestedAmount, remainingExposure);

    // Cap position size by maximum acceptable price impact (3%)
    const maxImpactPercent = 3.0;
    const maxSolByImpact = (maxImpactPercent / 100) * ((liquidityUsd || 1) / APPROX_SOL_PRICE_USD);
    if (maxSolByImpact < this.config.minPositionSol) {
      // Even minimum position would cause too much impact — reject
      return {
        launch, token, score, reasons,
        redFlags: [...redFlags, `insufficient liquidity for min position (impact: ${((this.config.minPositionSol * APPROX_SOL_PRICE_USD) / (liquidityUsd || 1) * 100).toFixed(1)}%)`],
        shouldBuy: false, suggestedAmount: 0, metrics,
      };
    } else if (maxSolByImpact < suggestedAmount) {
      suggestedAmount = maxSolByImpact;
      reasons.push(`size capped by liquidity (${maxSolByImpact.toFixed(2)} SOL for <3% impact)`);
    }

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
  private async executeBuy(evaluation: TradeEvaluation): Promise<boolean> {
    if (!this.ghostWalletPublicKey) return false;

    const { launch, suggestedAmount, reasons } = evaluation;
    const amountLamports = Math.floor(suggestedAmount * LAMPORTS_PER_SOL);

    // Check SOL balance before hitting Jupiter APIs (need trade amount + ~0.01 SOL for tx fees)
    if (this.solanaService) {
      const balance = await this.solanaService.getBalance();
      if (balance < suggestedAmount + 0.01) {
        console.warn(
          `[GhostTrader] Skipping buy of ${launch.symbol}: insufficient balance (${balance.toFixed(4)} SOL, need ${(suggestedAmount + 0.01).toFixed(4)})`
        );
        return false;
      }
    }

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
        return false;
      }
    } catch (error) {
      console.error(`[GhostTrader] Failed to get quote for ${launch.symbol}:`, error);
      return false;
    }

    // Build swap transaction
    let swapResult;
    try {
      swapResult = await this.bagsApi.createSwapTransaction(quote, this.ghostWalletPublicKey);
    } catch (error) {
      console.error(`[GhostTrader] Failed to create swap tx for ${launch.symbol}:`, error);
      return false;
    }

    // Sign and submit transaction
    const txSignature = await this.signAndSubmitTransaction(swapResult.swapTransaction);

    if (!txSignature) {
      console.error(`[GhostTrader] Failed to submit transaction for ${launch.symbol}`);
      return false;
    }

    // Calculate entry price (SOL per whole token, adjusted for token decimals)
    const tokensReceived = parseFloat(quote.outAmount);
    const { entryPriceSol } = await this.calculateEntryPrice(
      suggestedAmount,
      quote.outAmount,
      launch.mint
    );

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
      sellAttempts: 0,
      noPriceCount: 0,
      peakMultiplier: 1.0,
      tiersSold: 0,
    };

    // Save to memory and database
    this.positions.set(position.id, position);
    this.tradedMints.add(launch.mint);
    await this.savePositionToDatabase(position);

    // Persist trade as long-term memory (fire-and-forget)
    this.persistTradeMemory("buy", position, { score: evaluation.score });

    // Announce trade
    await this.announceTrade("buy", position);

    console.log(`[GhostTrader] Buy executed: ${position.amountSol} SOL of ${position.tokenSymbol}`);
    return true;
  }

  /**
   * Execute a close/sell trade
   * Tracks sell attempts and escalates slippage on retries.
   * After 5 failed attempts, marks the position as failed.
   */
  private async executeClose(
    position: GhostPosition,
    reason: "take_profit" | "stop_loss" | "trailing_stop" | "dead_position" | "manual",
    currentPriceSol: number
  ): Promise<void> {
    if (!this.ghostWalletPublicKey) return;

    // Guard against concurrent close attempts on the same position
    if (position.status !== "open") {
      console.log(`[GhostTrader] Position ${position.tokenSymbol} already ${position.status}, skipping close`);
      return;
    }

    // Check actual token balance before attempting sell (prevents 0x1 errors)
    try {
      if (!this.solanaService) throw new Error("SolanaService not initialized");
      const actualBalance = await this.solanaService.getTokenBalance(position.tokenMint);

      if (actualBalance === 0) {
        console.log(
          `[GhostTrader] No token balance for ${position.tokenSymbol} — marking as failed`
        );
        position.status = "failed";
        position.exitReason = `${reason}_no_balance`;
        position.pnlSol = -position.amountSol;
        position.closedAt = new Date();
        await this.updatePositionInDatabase(position);
        await this.recordTradeOutcome(position);
        await this.announceTrade("sell", position);
        return;
      }

      if (actualBalance !== position.amountTokens) {
        console.log(
          `[GhostTrader] Balance mismatch for ${position.tokenSymbol}: recorded ${position.amountTokens}, actual ${actualBalance} — selling actual`
        );
        position.amountTokens = actualBalance;
      }
    } catch (error) {
      console.warn(
        `[GhostTrader] Failed to check token balance for ${position.tokenSymbol}, proceeding with sell:`,
        error instanceof Error ? error.message : error
      );
      // Non-blocking: continue with sell attempt using recorded amount
    }

    const MAX_SELL_ATTEMPTS = 5;
    position.sellAttempts = (position.sellAttempts || 0) + 1;

    // After max attempts, give up and mark as failed
    if (position.sellAttempts > MAX_SELL_ATTEMPTS) {
      console.log(
        `[GhostTrader] Marking ${position.tokenSymbol} as FAILED after ${MAX_SELL_ATTEMPTS} sell attempts`
      );
      position.status = "failed";
      position.exitReason = `${reason}_sell_failed`;
      // Estimate P&L from last known price
      const estimatedSolBack = currentPriceSol > 0
        ? (currentPriceSol / position.entryPriceSol) * position.amountSol
        : 0;
      position.pnlSol = estimatedSolBack - position.amountSol;
      position.closedAt = new Date();
      await this.updatePositionInDatabase(position);
      await this.recordTradeOutcome(position);
      await this.announceTrade("sell", position);
      return;
    }

    // Escalate slippage for distressed sells: 3% → 5% → 8% → 12% → 15%
    const slippageEscalation = [300, 500, 800, 1200, 1500];
    const sellSlippageBps = slippageEscalation[Math.min(position.sellAttempts - 1, slippageEscalation.length - 1)];

    console.log(
      `[GhostTrader] Closing position: ${position.tokenSymbol} (${reason}, attempt ${position.sellAttempts}/${MAX_SELL_ATTEMPTS}, slippage ${sellSlippageBps}bps)`
    );

    // Get trade quote for selling tokens back to SOL
    let quote: TradeQuote;
    try {
      quote = await this.bagsApi.getTradeQuote(
        position.tokenMint,
        SOL_MINT,
        position.amountTokens,
        sellSlippageBps
      );
    } catch (error) {
      console.error(`[GhostTrader] Failed to get sell quote for ${position.tokenSymbol} (attempt ${position.sellAttempts}):`, error);
      await this.updatePositionInDatabase(position);
      return;
    }

    // Build swap transaction
    let swapResult;
    try {
      swapResult = await this.bagsApi.createSwapTransaction(quote, this.ghostWalletPublicKey);
    } catch (error) {
      console.error(`[GhostTrader] Failed to create sell tx for ${position.tokenSymbol} (attempt ${position.sellAttempts}):`, error);
      await this.updatePositionInDatabase(position);
      return;
    }

    // Sign and submit
    const txSignature = await this.signAndSubmitTransaction(swapResult.swapTransaction);

    if (!txSignature) {
      console.error(`[GhostTrader] Failed to submit sell transaction for ${position.tokenSymbol} (attempt ${position.sellAttempts})`);
      await this.updatePositionInDatabase(position);
      return;
    }

    // Success — reset attempt counter
    position.sellAttempts = 0;

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

    // Persist trade outcome as long-term memory (fire-and-forget)
    this.persistTradeMemory("sell", position, {
      pnlSol: pnlSol,
      exitReason: reason,
    });

    // Announce trade
    await this.announceTrade("sell", position);

    // Buy & burn: allocate portion of profit if Ghost is cumulatively profitable
    if (pnlSol > 0 && this.config.burnEnabled) {
      const currentStats = this.getStats();
      if (currentStats.totalPnlSol > 0) {
        this.executeBuyAndBurn(pnlSol, position.id).catch((err) =>
          console.error("[GhostTrader] Buy & burn failed:", err)
        );
      }
    }

    console.log(
      `[GhostTrader] Position closed: ${position.tokenSymbol}, PnL: ${pnlSol.toFixed(4)} SOL`
    );
  }

  /**
   * Execute a partial close (sell configurable % of remaining tokens at a take-profit tier)
   * Keeps the position open for further upside
   */
  private async executePartialClose(
    position: GhostPosition,
    tierIndex: number,
    currentPriceSol: number
  ): Promise<void> {
    if (!this.ghostWalletPublicKey) return;

    // Guard against concurrent close attempts
    if (position.status !== "open") {
      console.log(`[GhostTrader] Position ${position.tokenSymbol} already ${position.status}, skipping partial close`);
      return;
    }

    // Calculate sell amount: configurable % of remaining tokens
    const sellFraction = this.config.partialSellPercent / 100;
    let sellAmountTokens = Math.floor(position.amountTokens * sellFraction);

    // Check actual token balance before attempting sell
    try {
      if (!this.solanaService) throw new Error("SolanaService not initialized");
      const actualBalance = await this.solanaService.getTokenBalance(position.tokenMint);

      if (actualBalance === 0) {
        console.log(
          `[GhostTrader] No token balance for ${position.tokenSymbol} — marking as failed`
        );
        position.status = "failed";
        position.exitReason = "partial_close_no_balance";
        position.pnlSol = -position.amountSol;
        position.closedAt = new Date();
        await this.updatePositionInDatabase(position);
        return;
      }

      if (actualBalance < position.amountTokens) {
        console.log(
          `[GhostTrader] Balance mismatch for ${position.tokenSymbol}: recorded ${position.amountTokens}, actual ${actualBalance} — using actual`
        );
        position.amountTokens = actualBalance;
        sellAmountTokens = Math.floor(actualBalance * sellFraction);
      }
    } catch (error) {
      console.warn(
        `[GhostTrader] Failed to check token balance for partial close of ${position.tokenSymbol}, proceeding:`,
        error instanceof Error ? error.message : error
      );
    }

    if (sellAmountTokens <= 0) {
      console.warn(`[GhostTrader] Sell amount too small for partial close of ${position.tokenSymbol}`);
      return;
    }

    // Escalate slippage on retries (use same pattern as executeClose)
    position.sellAttempts = (position.sellAttempts || 0) + 1;
    const MAX_SELL_ATTEMPTS = 5;

    if (position.sellAttempts > MAX_SELL_ATTEMPTS) {
      console.log(
        `[GhostTrader] Partial close failed after ${MAX_SELL_ATTEMPTS} attempts for ${position.tokenSymbol}, skipping tier`
      );
      position.sellAttempts = 0;
      await this.updatePositionInDatabase(position);
      return;
    }

    const slippageEscalation = [300, 500, 800, 1200, 1500];
    const sellSlippageBps = slippageEscalation[Math.min(position.sellAttempts - 1, slippageEscalation.length - 1)];

    const sortedTiers = [...this.config.takeProfitTiers].sort((a, b) => a - b);
    const tierMultiplier = sortedTiers[tierIndex];

    console.log(
      `[GhostTrader] Partial close: ${position.tokenSymbol} tier ${tierIndex + 1} (+${((tierMultiplier - 1) * 100).toFixed(0)}%), selling ${this.config.partialSellPercent}% (${sellAmountTokens} tokens), attempt ${position.sellAttempts}/${MAX_SELL_ATTEMPTS}`
    );

    // Get trade quote for selling partial tokens back to SOL
    let quote: TradeQuote;
    try {
      quote = await this.bagsApi.getTradeQuote(
        position.tokenMint,
        SOL_MINT,
        sellAmountTokens,
        sellSlippageBps
      );
    } catch (error) {
      console.error(`[GhostTrader] Failed to get partial sell quote for ${position.tokenSymbol}:`, error);
      await this.updatePositionInDatabase(position);
      return;
    }

    // Build swap transaction
    let swapResult;
    try {
      swapResult = await this.bagsApi.createSwapTransaction(quote, this.ghostWalletPublicKey);
    } catch (error) {
      console.error(`[GhostTrader] Failed to create partial sell tx for ${position.tokenSymbol}:`, error);
      await this.updatePositionInDatabase(position);
      return;
    }

    // Sign and submit
    const txSignature = await this.signAndSubmitTransaction(swapResult.swapTransaction);

    if (!txSignature) {
      console.error(`[GhostTrader] Failed to submit partial sell for ${position.tokenSymbol}`);
      await this.updatePositionInDatabase(position);
      return;
    }

    // Success — update position tracking
    position.sellAttempts = 0;
    const solReceived = parseFloat(quote.outAmount) / LAMPORTS_PER_SOL;
    const tokensSold = sellAmountTokens;

    // Calculate partial P&L (proportional to SOL invested)
    const solProportionSold = sellFraction;
    const solCostBasis = position.amountSol * solProportionSold;
    const partialPnl = solReceived - solCostBasis;

    // Update position: reduce tokens and SOL basis, increment tier
    position.amountTokens -= tokensSold;
    position.amountSol -= solCostBasis;
    position.tiersSold = tierIndex + 1;

    // Accumulate P&L from partial exits
    position.pnlSol = (position.pnlSol ?? 0) + partialPnl;

    // Position stays open
    await this.updatePositionInDatabase(position);

    // Persist partial exit as memory
    this.persistTradeMemory("sell", position, {
      pnlSol: partialPnl,
      exitReason: `partial_take_profit_tier${tierIndex + 1}`,
    });

    // Broadcast partial exit to Telegram
    const holdTimeMinutes = (Date.now() - position.createdAt.getTime()) / 60000;
    const exitSignal: ExitSignal = {
      type: "exit",
      tokenSymbol: position.tokenSymbol,
      tokenName: position.tokenName,
      tokenMint: position.tokenMint,
      amountSol: solCostBasis,
      pnlSol: partialPnl,
      exitReason: `partial_take_profit_tier${tierIndex + 1}`,
      holdTimeMinutes,
      partialPercent: this.config.partialSellPercent,
    };
    this.telegramBroadcaster.broadcastExit(exitSignal);

    // Visual feedback in game world (percentage-based)
    if (this.worldSync) {
      const pctGain = ((currentPriceSol / position.entryPriceSol - 1) * 100).toFixed(0);
      this.worldSync.sendSpeak(
        "ghost",
        `took ${this.config.partialSellPercent}% off $${position.tokenSymbol} at +${pctGain}%, letting rest ride`,
        "happy"
      );
    }

    // Buy & burn: allocate portion of partial profit if Ghost is cumulatively profitable
    if (partialPnl > 0 && this.config.burnEnabled) {
      const currentStats = this.getStats();
      if (currentStats.totalPnlSol > 0) {
        this.executeBuyAndBurn(partialPnl, position.id).catch((err) =>
          console.error("[GhostTrader] Buy & burn (partial) failed:", err)
        );
      }
    }

    console.log(
      `[GhostTrader] Partial close complete: ${position.tokenSymbol} tier ${tierIndex + 1}, sold ${tokensSold} tokens for ${solReceived.toFixed(4)} SOL (PnL: ${partialPnl >= 0 ? "+" : ""}${partialPnl.toFixed(4)} SOL)`
    );
  }

  // ==========================================================================
  // Buy & Burn - Deflationary BAGS mechanism
  // ==========================================================================

  /**
   * Buy BAGS with a portion of trade profit and burn the tokens.
   * Called after profitable position closes when Ghost is cumulatively profitable.
   * Fire-and-forget — never blocks the close flow.
   */
  private async executeBuyAndBurn(profitSol: number, triggerTradeId: string): Promise<void> {
    const burnAllocation = profitSol * (this.config.burnPercent / 100);

    // Skip if allocation too small (not worth tx fees)
    if (burnAllocation < MIN_BURN_SOL) {
      console.log(`[GhostTrader] Buy & burn skipped: ${burnAllocation.toFixed(4)} SOL < ${MIN_BURN_SOL} minimum`);
      return;
    }

    if (!this.ghostWalletPublicKey || !this.solanaService) {
      console.warn("[GhostTrader] Buy & burn skipped: wallet or SolanaService not configured");
      return;
    }

    // Check SOL balance — need enough for buy + burn tx fees (~0.01 SOL buffer)
    const balance = await this.solanaService.getBalance();
    if (balance < burnAllocation + 0.01) {
      console.warn(`[GhostTrader] Buy & burn skipped: insufficient balance (${balance.toFixed(4)} SOL, need ${(burnAllocation + 0.01).toFixed(4)})`);
      return;
    }

    const stats = this.getStats();
    console.log(`[GhostTrader] Buy & burn: allocating ${burnAllocation.toFixed(4)} SOL (${this.config.burnPercent}% of ${profitSol.toFixed(4)} profit)`);

    // Step 1: Buy BAGS with allocated SOL
    const amountLamports = Math.floor(burnAllocation * LAMPORTS_PER_SOL);
    let buyQuote;
    try {
      buyQuote = await this.bagsApi.getTradeQuote(
        SOL_MINT,
        BAGS_TOKEN_MINT,
        amountLamports,
        this.config.slippageBps
      );
    } catch (error) {
      console.error("[GhostTrader] Buy & burn: failed to get BAGS quote:", error);
      return;
    }

    let buySwapResult;
    try {
      buySwapResult = await this.bagsApi.createSwapTransaction(buyQuote, this.ghostWalletPublicKey);
    } catch (error) {
      console.error("[GhostTrader] Buy & burn: failed to create buy tx:", error);
      return;
    }

    const buyTxSignature = await this.signAndSubmitTransaction(buySwapResult.swapTransaction);
    if (!buyTxSignature) {
      console.error("[GhostTrader] Buy & burn: buy transaction failed");
      return;
    }

    const bagsBought = parseFloat(buyQuote.outAmount);
    console.log(`[GhostTrader] Buy & burn: bought ${bagsBought} BAGS tokens (tx: ${buyTxSignature.slice(0, 16)}...)`);

    // Step 2: Wait briefly for buy to settle
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 3: Get actual BAGS balance to burn
    const bagsBalance = await this.solanaService.getTokenBalance(BAGS_TOKEN_MINT);
    if (bagsBalance <= 0) {
      console.error("[GhostTrader] Buy & burn: no BAGS balance found after buy");
      return;
    }

    const bagsToBurn = bagsBalance; // Burn entire BAGS balance

    // Step 4: Burn via Sol Incinerator API (if API key available)
    let burnTxSignature: string | null = null;
    const solIncineratorApiKey = process.env.SOL_INCINERATOR_API_KEY;

    if (solIncineratorApiKey) {
      try {
        const burnResponse = await fetch(`${SOL_INCINERATOR_API_URL}/burn`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": solIncineratorApiKey,
          },
          body: JSON.stringify({
            userPublicKey: this.ghostWalletPublicKey,
            assetId: BAGS_TOKEN_MINT,
            burnAmount: bagsToBurn,
          }),
        });

        if (!burnResponse.ok) {
          const errText = await burnResponse.text();
          throw new Error(`Sol Incinerator API error ${burnResponse.status}: ${errText}`);
        }

        const burnData = await burnResponse.json();
        const serializedTx = burnData.transaction || burnData.serializedTransaction;

        if (serializedTx) {
          const result = await this.solanaService.signAndSendTransaction(serializedTx, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          });

          if (result.confirmed && !result.error) {
            burnTxSignature = result.signature;
            console.log(`[GhostTrader] Buy & burn: burned ${bagsToBurn} BAGS (tx: ${burnTxSignature.slice(0, 16)}...)`);
          } else {
            console.error("[GhostTrader] Buy & burn: burn tx failed:", result.error);
          }
        } else {
          console.error("[GhostTrader] Buy & burn: no transaction in Sol Incinerator response");
        }
      } catch (error) {
        console.error("[GhostTrader] Buy & burn: Sol Incinerator burn failed:", error);
      }
    } else {
      console.warn("[GhostTrader] Buy & burn: SOL_INCINERATOR_API_KEY not set — burn step skipped, BAGS held in wallet");
    }

    // Step 5: Log burn to database
    if (this.db) {
      try {
        const burnId = crypto.randomUUID();
        await this.db`
          INSERT INTO ghost_burns (id, sol_spent, bags_bought, bags_burned, buy_tx_signature, burn_tx_signature, trigger_trade_id, cumulative_pnl_at_burn)
          VALUES (${burnId}, ${burnAllocation}, ${bagsBought}, ${burnTxSignature ? bagsToBurn : 0}, ${buyTxSignature}, ${burnTxSignature}, ${triggerTradeId}, ${stats.totalPnlSol})
        `;
      } catch (error) {
        console.error("[GhostTrader] Buy & burn: failed to log to database:", error);
      }
    }

    // Step 6: Announce
    const burnMessages = [
      `burning $BAGS... deflationary vibes`,
      `${this.config.burnPercent}% of profits → burn. this is the way`,
      `just burned ${bagsToBurn} BAGS tokens. supply going down`,
      `profitable trade → buy & burn $BAGS. less supply, more value`,
      `${burnAllocation.toFixed(4)} SOL of profit → bought & burned BAGS`,
    ];
    const announceMsg = burnMessages[Math.floor(Math.random() * burnMessages.length)];
    this.chatter(announceMsg, "happy");

    if (this.coordinator) {
      await this.coordinator.broadcast("ghost", "update", `Buy & Burn: spent ${burnAllocation.toFixed(4)} SOL, burned ${bagsToBurn} BAGS`, {
        type: "burn",
        solSpent: burnAllocation,
        bagsBurned: bagsToBurn,
        buyTx: buyTxSignature,
        burnTx: burnTxSignature,
      });
    }

    // Telegram announcement via exit signal (reusing existing infrastructure)
    if (this.telegramBroadcaster && this.telegramBroadcaster.isEnabled()) {
      const burnExitSignal: ExitSignal = {
        type: "exit",
        tokenSymbol: "BAGS",
        tokenName: "BagsWorld (Buy & Burn)",
        tokenMint: BAGS_TOKEN_MINT,
        amountSol: burnAllocation,
        pnlSol: 0, // Not a PnL event — it's a burn
        exitReason: `buy_and_burn (${bagsToBurn} BAGS burned)`,
        holdTimeMinutes: 0,
      };
      this.telegramBroadcaster.broadcastExit(burnExitSignal);
    }

    // Refresh cached burn stats
    await this.refreshBurnStatsCache();

    console.log(`[GhostTrader] Buy & burn complete: ${burnAllocation.toFixed(4)} SOL → ${bagsToBurn} BAGS ${burnTxSignature ? "burned" : "held (no API key)"}`);
  }

  /**
   * Get buy & burn statistics from the database
   */
  async getBurnStats(): Promise<{ totalBagsBurned: number; totalSolSpent: number; burnCount: number; burns: Array<{ id: string; solSpent: number; bagsBought: number; bagsBurned: number; buyTx: string | null; burnTx: string | null; createdAt: string }> }> {
    if (!this.db) {
      return { totalBagsBurned: 0, totalSolSpent: 0, burnCount: 0, burns: [] };
    }

    try {
      const rows = await this.db`
        SELECT id, sol_spent, bags_bought, bags_burned, buy_tx_signature, burn_tx_signature, created_at
        FROM ghost_burns
        ORDER BY created_at DESC
        LIMIT 50
      ` as Array<{ id: string; sol_spent: string; bags_bought: string; bags_burned: string; buy_tx_signature: string | null; burn_tx_signature: string | null; created_at: Date }>;

      const totals = await this.db`
        SELECT COALESCE(SUM(bags_burned), 0) as total_burned, COALESCE(SUM(sol_spent), 0) as total_sol, COUNT(*) as burn_count
        FROM ghost_burns
      ` as Array<{ total_burned: string; total_sol: string; burn_count: string }>;

      return {
        totalBagsBurned: parseFloat(totals[0]?.total_burned || "0"),
        totalSolSpent: parseFloat(totals[0]?.total_sol || "0"),
        burnCount: parseInt(totals[0]?.burn_count || "0"),
        burns: rows.map((r) => ({
          id: r.id,
          solSpent: parseFloat(r.sol_spent),
          bagsBought: parseFloat(r.bags_bought),
          bagsBurned: parseFloat(r.bags_burned),
          buyTx: r.buy_tx_signature,
          burnTx: r.burn_tx_signature,
          createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        })),
      };
    } catch (error) {
      console.error("[GhostTrader] Failed to fetch burn stats:", error);
      return { totalBagsBurned: 0, totalSolSpent: 0, burnCount: 0, burns: [] };
    }
  }

  /**
   * Refresh the cached burn stats from the database
   */
  private async refreshBurnStatsCache(): Promise<void> {
    if (!this.db) return;
    try {
      const totals = await this.db`
        SELECT COALESCE(SUM(bags_burned), 0) as total_burned, COALESCE(SUM(sol_spent), 0) as total_sol, COUNT(*) as burn_count
        FROM ghost_burns
      ` as Array<{ total_burned: string; total_sol: string; burn_count: string }>;
      this.cachedBurnStats = {
        totalBagsBurned: parseFloat(totals[0]?.total_burned || "0"),
        totalSolSpent: parseFloat(totals[0]?.total_sol || "0"),
        burnCount: parseInt(totals[0]?.burn_count || "0"),
      };
    } catch {
      // Non-critical — keep existing cached values
    }
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
      const pnl = position.pnlSol ?? 0;
      const pnlSign = pnl >= 0 ? "+" : "";
      const pnlStr = `${pnlSign}${pnl.toFixed(4)} SOL`;
      const pnlPct = position.amountSol > 0
        ? `${pnlSign}${((pnl / position.amountSol) * 100).toFixed(1)}%`
        : "";
      const isProfitable = pnl >= 0;
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
      message = `closed $${position.tokenSymbol}. ${exitReason}. pnl: ${pnlStr} (${pnlPct})`;
      speechMessage = isProfitable
        ? `banked ${pnlPct} on $${position.tokenSymbol}`
        : `cut losses on $${position.tokenSymbol} (${pnlPct})`;
      emotion = isProfitable ? "happy" : "sad";
    }

    // Send visual speech bubble in the game world
    if (this.worldSync) {
      this.worldSync.sendSpeak("ghost", speechMessage, emotion);

      // Update Ghost's activity status
      const activityEmoji = type === "buy" ? "📈" : (position.pnlSol ?? 0) >= 0 ? "💰" : "📉";
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

    // Broadcast to Telegram channel
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
    } else if (type === "sell" && position.exitReason) {
      const holdTimeMinutes = position.closedAt
        ? (position.closedAt.getTime() - position.createdAt.getTime()) / 60000
        : 0;
      const exitSignal: ExitSignal = {
        type: "exit",
        tokenSymbol: position.tokenSymbol,
        tokenName: position.tokenName,
        tokenMint: position.tokenMint,
        amountSol: position.amountSol,
        pnlSol: position.pnlSol ?? 0,
        exitReason: position.exitReason,
        holdTimeMinutes,
      };
      this.telegramBroadcaster.broadcastExit(exitSignal);
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
        pnl_sol = ${position.pnlSol ?? null},
        closed_at = ${position.closedAt?.toISOString() || null},
        sell_attempts = ${position.sellAttempts || 0},
        no_price_count = ${position.noPriceCount || 0},
        peak_multiplier = ${position.peakMultiplier || 1.0},
        tiers_sold = ${position.tiersSold || 0},
        amount_sol = ${position.amountSol},
        amount_tokens = ${position.amountTokens}
      WHERE id = ${position.id}
    `;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get token decimals with caching. Fetches from RPC, defaults to 6 (Bags.fm standard).
   */
  private async getTokenDecimals(mint: string): Promise<number> {
    const cached = this.tokenDecimalsCache.get(mint);
    if (cached !== undefined) return cached;

    let decimals = DEFAULT_TOKEN_DECIMALS;
    if (this.solanaService) {
      decimals = await this.solanaService.getTokenDecimals(mint);
    }

    this.tokenDecimalsCache.set(mint, decimals);
    return decimals;
  }

  /**
   * Calculate entry price per whole token in SOL from Jupiter quote amounts.
   * outAmount is in token's smallest units, so we must adjust by token decimals.
   */
  private async calculateEntryPrice(
    solSpent: number,
    outAmountRaw: string,
    tokenMint: string
  ): Promise<{ entryPriceSol: number; wholeTokensReceived: number }> {
    const rawTokens = parseFloat(outAmountRaw);
    const decimals = await this.getTokenDecimals(tokenMint);
    const wholeTokensReceived = rawTokens / (10 ** decimals);
    const entryPriceSol = solSpent / wholeTokensReceived;

    console.log(
      `[GhostTrader] Entry price calc: ${solSpent} SOL / ${wholeTokensReceived.toFixed(2)} tokens (${decimals} decimals) = ${entryPriceSol.toExponential(4)} SOL/token`
    );

    return { entryPriceSol, wholeTokensReceived };
  }

  private wasRecentlyEvaluated(mint: string): boolean {
    const expiry = this.recentlyEvaluated.get(mint);
    if (!expiry) return false;
    return Date.now() < expiry;
  }

  private markAsEvaluated(mint: string, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs ?? GhostTrader.EVALUATION_COOLDOWN_MS);
    this.recentlyEvaluated.set(mint, expiry);

    // Cleanup expired entries
    const now = Date.now();
    for (const [key, exp] of this.recentlyEvaluated) {
      if (now > exp) {
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

    // Persist changed config fields to database (fire-and-forget)
    this.persistConfigToDatabase(updates);
  }

  private async persistConfigToDatabase(updates: Partial<GhostTraderConfig>): Promise<void> {
    if (!this.db) return;

    // Persistable config keys (excludes 'enabled' which has its own enable/disable methods)
    const persistableKeys: Array<keyof GhostTraderConfig> = [
      "minPositionSol", "maxPositionSol", "maxTotalExposureSol", "maxOpenPositions",
      "takeProfitTiers", "partialSellPercent", "trailingStopPercent",
      "stopLossPercent", "maxHoldTimeMinutes", "minVolumeToHoldUsd", "deadPositionDecayPercent",
      "minLiquidityUsd", "minMarketCapUsd", "maxCreatorFeeBps", "minBuySellRatio",
      "minHolders", "minVolume24hUsd", "maxPriceImpactPercent",
      "minLaunchAgeSec", "maxLaunchAgeSec", "slippageBps",
      "burnEnabled", "burnPercent",
      "maxTop5ConcentrationPct", "maxSingleHolderPct",
    ];

    for (const key of persistableKeys) {
      if (updates[key] === undefined) continue;

      const value = Array.isArray(updates[key])
        ? JSON.stringify(updates[key])
        : String(updates[key]);

      await this.db`
        INSERT INTO ghost_config (key, value, updated_at)
        VALUES (${`config_${key}`}, ${value}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
      `;
    }

    console.log(`[GhostTrader] Persisted ${Object.keys(updates).length} config fields to database`);
  }

  getStats(): GhostTraderStats {
    const allPositions = Array.from(this.positions.values());
    const closedPositions = allPositions.filter((p) => p.status === "closed");
    const openPositions = allPositions.filter((p) => p.status === "open");

    const winningTrades = closedPositions.filter((p) => (p.pnlSol || 0) > 0).length;
    const losingTrades = closedPositions.filter((p) => (p.pnlSol || 0) < 0).length;
    const totalPnlSol = closedPositions.reduce((sum, p) => sum + (p.pnlSol || 0), 0);

    // Burn stats are loaded synchronously from cached values (async fetch happens on init/burn)
    return {
      enabled: this.config.enabled,
      openPositions: openPositions.length,
      totalExposureSol: this.getTotalExposure(),
      totalTrades: closedPositions.length,
      winningTrades,
      losingTrades,
      totalPnlSol,
      winRate: closedPositions.length > 0 ? winningTrades / closedPositions.length : 0,
      totalBagsBurned: this.cachedBurnStats.totalBagsBurned,
      totalSolSpentOnBurns: this.cachedBurnStats.totalSolSpent,
      burnCount: this.cachedBurnStats.burnCount,
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

    // Calculate entry price (SOL per whole token, adjusted for token decimals)
    const tokensReceived = parseFloat(quote.outAmount);
    const { entryPriceSol } = await this.calculateEntryPrice(
      amountSol,
      quote.outAmount,
      mint
    );

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
      sellAttempts: 0,
      noPriceCount: 0,
      peakMultiplier: 1.0,
      tiersSold: 0,
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
