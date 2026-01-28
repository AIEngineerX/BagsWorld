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
import { getDatabase } from "../routes/shared.js";

// ============================================================================
// Constants
// ============================================================================

const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Default trading configuration
const DEFAULT_CONFIG = {
  enabled: false, // Must be explicitly enabled
  minPositionSol: 0.05,
  maxPositionSol: 0.1,
  maxTotalExposureSol: 1.0,
  maxOpenPositions: 5,
  takeProfitMultiplier: 2.0, // 2x = 100% profit
  stopLossPercent: 30, // -30%
  minLiquiditySol: 2.0,
  maxCreatorFeeBps: 300, // 3%
  minLaunchAgeSec: 60, // At least 1 minute old (avoid failed launches)
  maxLaunchAgeSec: 3600, // No older than 1 hour
  slippageBps: 500, // 5% slippage tolerance
};

// Top trader wallets to study (from user-provided list)
const SMART_MONEY_WALLETS = [
  "9bqx8GEcwuw4r3WzhWnJx8fpjt7aXdvVZhWE56bzWBoK",
  "FxN3VZ4BosL5urG2yoeQ156JSdmavm9K5fdLxjkPmaMR",
  "2fg5QD1eD7rzNNCsvnhmXFm5hqNgwTTG8p7kQ6f3rx6f",
  "suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK",
];

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
  shouldBuy: boolean;
  suggestedAmount: number;
}

export interface GhostTraderConfig {
  enabled: boolean;
  minPositionSol: number;
  maxPositionSol: number;
  maxTotalExposureSol: number;
  maxOpenPositions: number;
  takeProfitMultiplier: number;
  stopLossPercent: number;
  minLiquiditySol: number;
  maxCreatorFeeBps: number;
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
  private static readonly EVALUATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

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

      // Calculate P&L
      const priceChange = ((currentPriceSol - position.entryPriceSol) / position.entryPriceSol) * 100;

      // Check take-profit (2x = 100% profit)
      if (priceChange >= (this.config.takeProfitMultiplier - 1) * 100) {
        console.log(
          `[GhostTrader] Take profit triggered for ${position.tokenSymbol} (+${priceChange.toFixed(1)}%)`
        );
        await this.executeClose(position, "take_profit", currentPriceSol);
        continue;
      }

      // Check stop-loss
      if (priceChange <= -this.config.stopLossPercent) {
        console.log(
          `[GhostTrader] Stop loss triggered for ${position.tokenSymbol} (${priceChange.toFixed(1)}%)`
        );
        await this.executeClose(position, "stop_loss", currentPriceSol);
        continue;
      }
    }
  }

  /**
   * Evaluate a single launch
   */
  private async evaluateLaunch(launch: RecentLaunch): Promise<TradeEvaluation> {
    const reasons: string[] = [];
    let score = 0;

    // Get detailed token info
    const token = await this.bagsApi.getToken(launch.mint);

    // Check launch age
    const ageSeconds = Math.floor((Date.now() - launch.launchedAt) / 1000);
    if (ageSeconds < this.config.minLaunchAgeSec) {
      return { launch, token, score: 0, reasons: ["too new"], shouldBuy: false, suggestedAmount: 0 };
    }
    if (ageSeconds > this.config.maxLaunchAgeSec) {
      return { launch, token, score: 0, reasons: ["too old"], shouldBuy: false, suggestedAmount: 0 };
    }

    // Age score - prefer newer launches but not brand new
    if (ageSeconds >= 60 && ageSeconds <= 300) {
      score += 20;
      reasons.push("good timing");
    } else if (ageSeconds <= 600) {
      score += 10;
      reasons.push("decent timing");
    }

    // Check market cap / liquidity
    const marketCap = launch.initialMarketCap || token?.marketCap || 0;
    const estimatedLiquidity = marketCap * 0.1; // Rough estimate

    if (estimatedLiquidity < this.config.minLiquiditySol * LAMPORTS_PER_SOL) {
      return {
        launch,
        token,
        score: 0,
        reasons: ["low liquidity"],
        shouldBuy: false,
        suggestedAmount: 0,
      };
    }

    // Liquidity score
    if (estimatedLiquidity >= 10 * LAMPORTS_PER_SOL) {
      score += 25;
      reasons.push("strong liquidity");
    } else if (estimatedLiquidity >= 5 * LAMPORTS_PER_SOL) {
      score += 15;
      reasons.push("decent liquidity");
    } else {
      score += 5;
      reasons.push("minimum liquidity");
    }

    // Check if token has meaningful volume
    if (token && token.volume24h && token.volume24h > 1000) {
      score += 15;
      reasons.push("active trading");
    }

    // Check holder count
    if (token && token.holders && token.holders > 10) {
      score += 10;
      reasons.push("distributed holders");
    }

    // Check for fees earned (indicates real trading)
    if (token && token.lifetimeFees && token.lifetimeFees > 0.01) {
      score += 20;
      reasons.push("fees being generated");
    }

    // Require minimum score to buy
    const shouldBuy = score >= 40;

    // Calculate suggested amount based on score and available exposure
    const remainingExposure = this.config.maxTotalExposureSol - this.getTotalExposure();
    let suggestedAmount = this.config.minPositionSol;

    if (score >= 60) {
      suggestedAmount = this.config.maxPositionSol;
    } else if (score >= 50) {
      suggestedAmount = (this.config.minPositionSol + this.config.maxPositionSol) / 2;
    }

    suggestedAmount = Math.min(suggestedAmount, remainingExposure);

    return { launch, token, score, reasons, shouldBuy, suggestedAmount };
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
    reason: "take_profit" | "stop_loss" | "manual",
    currentPriceSol: number
  ): Promise<void> {
    if (!this.ghostWalletPublicKey) return;

    console.log(
      `[GhostTrader] Closing position: ${position.tokenSymbol} (${reason})`
    );

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
   */
  private async signAndSubmitTransaction(base64Transaction: string): Promise<string | null> {
    // Check if Solana service is configured
    if (!this.solanaService || !this.solanaService.isConfigured()) {
      console.log("[GhostTrader] Solana wallet not configured, simulating transaction");
      return `sim_${crypto.randomUUID().slice(0, 16)}`;
    }

    // If trading is disabled, simulate
    if (!this.config.enabled) {
      console.log("[GhostTrader] Trading disabled, simulating transaction");
      return `sim_${crypto.randomUUID().slice(0, 16)}`;
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
  private async announceTrade(
    type: "buy" | "sell",
    position: GhostPosition
  ): Promise<void> {
    if (!this.coordinator) return;

    let message: string;

    if (type === "buy") {
      message = `bought ${position.amountSol.toFixed(2)} SOL of $${position.tokenSymbol}. ${position.entryReason}. watching.`;
    } else {
      const pnlSign = (position.pnlSol || 0) >= 0 ? "+" : "";
      const pnlStr = `${pnlSign}${(position.pnlSol || 0).toFixed(4)} SOL`;
      message = `closed $${position.tokenSymbol} position. ${position.exitReason}. pnl: ${pnlStr}`;
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

  enableTrading(): void {
    this.config.enabled = true;
    console.log("[GhostTrader] Trading ENABLED");
  }

  disableTrading(): void {
    this.config.enabled = false;
    console.log("[GhostTrader] Trading DISABLED");
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
}

export function getGhostTrader(): GhostTrader {
  return GhostTrader.getInstance();
}

export default GhostTrader;
