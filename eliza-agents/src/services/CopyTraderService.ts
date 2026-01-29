// CopyTraderService - Mirror trades from smart money wallets
// CAUTION: This executes real trades. Use with extreme care.

import { NeonQueryFunction } from "@neondatabase/serverless";
import { getSmartMoneyService, SmartMoneyWallet } from "./SmartMoneyService.js";
import { getGhostTrader } from "./GhostTrader.js";
import { getBagsApiService } from "./BagsApiService.js";
import { getDatabase } from "../routes/shared.js";

// ============================================================================
// Safety Constants - DO NOT MODIFY WITHOUT CAREFUL CONSIDERATION
// ============================================================================

const SAFETY_LIMITS = {
  // Maximum SOL per copied trade
  MAX_COPY_AMOUNT_SOL: 0.1,

  // Maximum total exposure from copy trades
  MAX_COPY_EXPOSURE_SOL: 0.5,

  // Minimum time between copy trades (prevent rapid-fire)
  MIN_TRADE_INTERVAL_MS: 60 * 1000, // 1 minute

  // Maximum copies per hour
  MAX_COPIES_PER_HOUR: 5,

  // Only copy wallets with this minimum win rate
  MIN_WALLET_WIN_RATE: 0.6,

  // Ignore trades smaller than this (noise)
  MIN_TRADE_SIZE_SOL: 0.05,

  // Ignore trades larger than this (whale manipulation risk)
  MAX_TRADE_SIZE_SOL: 10,

  // Only copy buys on tokens with minimum liquidity
  MIN_LIQUIDITY_USD: 10000,

  // Cooldown after a loss before copying again
  LOSS_COOLDOWN_MS: 30 * 60 * 1000, // 30 minutes
};

// ============================================================================
// Types
// ============================================================================

export interface CopyTradeConfig {
  enabled: boolean;
  // Which wallets to copy (empty = all tracked smart money)
  walletWhitelist: string[];
  // Scale factor for position sizes (0.5 = half size, 1 = same size)
  sizeMultiplier: number;
  // Only copy buys (safer) or also sells
  copyBuysOnly: boolean;
  // Require manual approval for each trade
  requireApproval: boolean;
}

export interface PendingCopyTrade {
  id: string;
  sourceWallet: string;
  sourceWalletLabel: string;
  action: "buy" | "sell";
  tokenMint: string;
  tokenSymbol: string;
  originalAmountSol: number;
  suggestedAmountSol: number;
  timestamp: number;
  expiresAt: number;
  status: "pending" | "approved" | "rejected" | "executed" | "expired";
  txSignature?: string;
}

export interface CopyTradeStats {
  enabled: boolean;
  totalCopied: number;
  successfulCopies: number;
  failedCopies: number;
  totalPnlSol: number;
  copiesThisHour: number;
  lastCopyTime: number;
  pendingApprovals: number;
}

// ============================================================================
// Service
// ============================================================================

let copyTraderInstance: CopyTraderService | null = null;

export class CopyTraderService {
  private config: CopyTradeConfig = {
    enabled: false,
    walletWhitelist: [],
    sizeMultiplier: 0.5, // Default to half size for safety
    copyBuysOnly: true, // Default to buys only
    requireApproval: true, // Default to requiring approval
  };

  private pendingTrades: Map<string, PendingCopyTrade> = new Map();
  private executedTrades: PendingCopyTrade[] = [];
  private copiesThisHour: number = 0;
  private lastCopyTime: number = 0;
  private lastLossTime: number = 0;
  private hourlyResetTime: number = Date.now();

  private db: NeonQueryFunction<false, false> | null = null;

  constructor() {
    this.db = getDatabase();
  }

  async initialize(): Promise<void> {
    // Load config from database if available
    if (this.db) {
      try {
        const rows = (await this.db`
          SELECT value FROM ghost_config WHERE key = 'copy_trader_config'
        `) as Array<{ value: string }>;

        if (rows.length > 0) {
          const saved = JSON.parse(rows[0].value);
          this.config = { ...this.config, ...saved };
          console.log(
            `[CopyTrader] Loaded config: enabled=${this.config.enabled}, approval=${this.config.requireApproval}`
          );
        }
      } catch (error) {
        console.warn("[CopyTrader] Could not load config:", error);
      }
    }

    // Start hourly reset timer
    setInterval(() => this.resetHourlyCounter(), 60 * 60 * 1000);

    console.log("[CopyTrader] Initialized (DISABLED by default for safety)");
  }

  private resetHourlyCounter(): void {
    this.copiesThisHour = 0;
    this.hourlyResetTime = Date.now();
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  async enable(confirmPhrase: string): Promise<{ success: boolean; error?: string }> {
    if (confirmPhrase !== "i accept copy trading risks") {
      return {
        success: false,
        error: "Invalid confirmation. Send: 'i accept copy trading risks'",
      };
    }

    // Check that regular trading is enabled
    const trader = getGhostTrader();
    if (!trader.isEnabled()) {
      return {
        success: false,
        error: "Enable regular trading first before copy trading",
      };
    }

    this.config.enabled = true;
    await this.saveConfig();

    console.log("[CopyTrader] ⚠️ COPY TRADING ENABLED - Real trades will be mirrored");

    return { success: true };
  }

  async disable(): Promise<void> {
    this.config.enabled = false;
    await this.saveConfig();
    console.log("[CopyTrader] Copy trading DISABLED");
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): CopyTradeConfig {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<CopyTradeConfig>): Promise<void> {
    // Validate sizeMultiplier
    if (updates.sizeMultiplier !== undefined) {
      if (updates.sizeMultiplier < 0.1 || updates.sizeMultiplier > 1) {
        throw new Error("sizeMultiplier must be between 0.1 and 1");
      }
    }

    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  private async saveConfig(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db`
        INSERT INTO ghost_config (key, value, updated_at)
        VALUES ('copy_trader_config', ${JSON.stringify(this.config)}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(this.config)}, updated_at = NOW()
      `;
    } catch (error) {
      console.error("[CopyTrader] Failed to save config:", error);
    }
  }

  // ============================================================================
  // Webhook Handler - Called when smart money trades
  // ============================================================================

  async handleSmartMoneyTrade(params: {
    wallet: string;
    action: "buy" | "sell";
    tokenMint: string;
    tokenSymbol: string;
    amountSol: number;
    txSignature: string;
  }): Promise<{
    shouldCopy: boolean;
    reason: string;
    pendingTradeId?: string;
  }> {
    const { wallet, action, tokenMint, tokenSymbol, amountSol, txSignature } = params;

    // === SAFETY CHECKS ===

    // 1. Is copy trading enabled?
    if (!this.config.enabled) {
      return { shouldCopy: false, reason: "copy trading disabled" };
    }

    // 2. Is this a tracked smart money wallet?
    const smartMoney = getSmartMoneyService();
    if (!smartMoney.isSmartMoney(wallet)) {
      return { shouldCopy: false, reason: "wallet not in smart money list" };
    }

    const walletInfo = smartMoney.getWalletInfo(wallet);

    // 3. Is wallet in whitelist (if whitelist is set)?
    if (this.config.walletWhitelist.length > 0) {
      if (!this.config.walletWhitelist.includes(wallet)) {
        return { shouldCopy: false, reason: "wallet not in whitelist" };
      }
    }

    // 4. Check wallet win rate
    if (walletInfo && walletInfo.winRate < SAFETY_LIMITS.MIN_WALLET_WIN_RATE) {
      return {
        shouldCopy: false,
        reason: `wallet win rate ${(walletInfo.winRate * 100).toFixed(0)}% below minimum ${SAFETY_LIMITS.MIN_WALLET_WIN_RATE * 100}%`,
      };
    }

    // 5. Is this a buy? (if copyBuysOnly)
    if (this.config.copyBuysOnly && action !== "buy") {
      return { shouldCopy: false, reason: "only copying buys" };
    }

    // 6. Check trade size limits
    if (amountSol < SAFETY_LIMITS.MIN_TRADE_SIZE_SOL) {
      return { shouldCopy: false, reason: `trade too small (${amountSol} SOL)` };
    }
    if (amountSol > SAFETY_LIMITS.MAX_TRADE_SIZE_SOL) {
      return { shouldCopy: false, reason: `trade too large (${amountSol} SOL) - whale risk` };
    }

    // 7. Check rate limits
    if (this.copiesThisHour >= SAFETY_LIMITS.MAX_COPIES_PER_HOUR) {
      return { shouldCopy: false, reason: "hourly copy limit reached" };
    }

    // 8. Check minimum interval
    const timeSinceLastCopy = Date.now() - this.lastCopyTime;
    if (timeSinceLastCopy < SAFETY_LIMITS.MIN_TRADE_INTERVAL_MS) {
      const waitSec = Math.ceil((SAFETY_LIMITS.MIN_TRADE_INTERVAL_MS - timeSinceLastCopy) / 1000);
      return { shouldCopy: false, reason: `cooldown: wait ${waitSec}s` };
    }

    // 9. Check loss cooldown
    if (this.lastLossTime > 0) {
      const timeSinceLoss = Date.now() - this.lastLossTime;
      if (timeSinceLoss < SAFETY_LIMITS.LOSS_COOLDOWN_MS) {
        const waitMin = Math.ceil((SAFETY_LIMITS.LOSS_COOLDOWN_MS - timeSinceLoss) / 60000);
        return { shouldCopy: false, reason: `loss cooldown: wait ${waitMin}min` };
      }
    }

    // 10. Check exposure limits
    const trader = getGhostTrader();
    const currentExposure = trader.getTotalExposure();
    const copyExposure = this.getCopyTradeExposure();

    if (copyExposure >= SAFETY_LIMITS.MAX_COPY_EXPOSURE_SOL) {
      return { shouldCopy: false, reason: "copy trade exposure limit reached" };
    }

    // 11. Check token liquidity (for buys)
    if (action === "buy") {
      const bagsApi = getBagsApiService();
      const token = await bagsApi.getToken(tokenMint);
      const liquidity = (token?.marketCap || 0) * 0.15; // Estimate

      if (liquidity < SAFETY_LIMITS.MIN_LIQUIDITY_USD) {
        return {
          shouldCopy: false,
          reason: `insufficient liquidity ($${liquidity.toFixed(0)})`,
        };
      }
    }

    // === ALL CHECKS PASSED ===

    // Calculate copy amount
    let copyAmount = amountSol * this.config.sizeMultiplier;
    copyAmount = Math.min(copyAmount, SAFETY_LIMITS.MAX_COPY_AMOUNT_SOL);
    copyAmount = Math.min(copyAmount, SAFETY_LIMITS.MAX_COPY_EXPOSURE_SOL - copyExposure);

    // Create pending trade
    const pendingTrade: PendingCopyTrade = {
      id: crypto.randomUUID(),
      sourceWallet: wallet,
      sourceWalletLabel: walletInfo?.label || wallet.slice(0, 8),
      action,
      tokenMint,
      tokenSymbol,
      originalAmountSol: amountSol,
      suggestedAmountSol: copyAmount,
      timestamp: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute expiry
      status: this.config.requireApproval ? "pending" : "approved",
    };

    this.pendingTrades.set(pendingTrade.id, pendingTrade);

    // Record activity
    smartMoney.recordActivity(tokenMint, wallet, action, amountSol);

    // If approval not required, execute immediately
    if (!this.config.requireApproval) {
      await this.executeCopyTrade(pendingTrade.id);
      return {
        shouldCopy: true,
        reason: `auto-executed: ${copyAmount.toFixed(3)} SOL`,
        pendingTradeId: pendingTrade.id,
      };
    }

    console.log(
      `[CopyTrader] ⏳ Pending approval: ${action} ${copyAmount.toFixed(3)} SOL of ${tokenSymbol} (copied from ${walletInfo?.label})`
    );

    return {
      shouldCopy: true,
      reason: `awaiting approval: ${copyAmount.toFixed(3)} SOL`,
      pendingTradeId: pendingTrade.id,
    };
  }

  // ============================================================================
  // Trade Execution
  // ============================================================================

  async approveTrade(tradeId: string): Promise<{ success: boolean; error?: string }> {
    const trade = this.pendingTrades.get(tradeId);

    if (!trade) {
      return { success: false, error: "Trade not found" };
    }

    if (trade.status !== "pending") {
      return { success: false, error: `Trade already ${trade.status}` };
    }

    if (Date.now() > trade.expiresAt) {
      trade.status = "expired";
      return { success: false, error: "Trade expired" };
    }

    return this.executeCopyTrade(tradeId);
  }

  async rejectTrade(tradeId: string): Promise<void> {
    const trade = this.pendingTrades.get(tradeId);
    if (trade) {
      trade.status = "rejected";
      console.log(`[CopyTrader] Rejected trade: ${trade.tokenSymbol}`);
    }
  }

  private async executeCopyTrade(tradeId: string): Promise<{ success: boolean; error?: string }> {
    const trade = this.pendingTrades.get(tradeId);

    if (!trade) {
      return { success: false, error: "Trade not found" };
    }

    // Final safety check
    if (!this.config.enabled) {
      trade.status = "rejected";
      return { success: false, error: "Copy trading was disabled" };
    }

    const trader = getGhostTrader();
    if (!trader.isEnabled()) {
      trade.status = "rejected";
      return { success: false, error: "Trading is disabled" };
    }

    try {
      if (trade.action === "buy") {
        const result = await trader.manualBuy(trade.tokenMint, trade.suggestedAmountSol);

        if (result.success) {
          trade.status = "executed";
          trade.txSignature = result.position?.entryTxSignature;
          this.copiesThisHour++;
          this.lastCopyTime = Date.now();

          console.log(
            `[CopyTrader] ✅ Copied: ${trade.suggestedAmountSol.toFixed(3)} SOL of ${trade.tokenSymbol}`
          );

          // Move to executed list
          this.executedTrades.unshift(trade);
          this.pendingTrades.delete(tradeId);

          return { success: true };
        } else {
          trade.status = "rejected";
          return { success: false, error: result.error };
        }
      } else {
        // Sell - find matching position
        const positions = trader.getOpenPositions();
        const matchingPosition = positions.find((p) => p.tokenMint === trade.tokenMint);

        if (!matchingPosition) {
          trade.status = "rejected";
          return { success: false, error: "No matching position to sell" };
        }

        const result = await trader.manualSell(matchingPosition.id);

        if (result.success) {
          trade.status = "executed";
          this.copiesThisHour++;
          this.lastCopyTime = Date.now();

          // Check if this was a loss
          if (result.pnlSol && result.pnlSol < 0) {
            this.lastLossTime = Date.now();
            console.log(
              `[CopyTrader] ❌ Loss on copy: ${result.pnlSol.toFixed(4)} SOL - cooldown activated`
            );
          }

          this.executedTrades.unshift(trade);
          this.pendingTrades.delete(tradeId);

          return { success: true };
        } else {
          trade.status = "rejected";
          return { success: false, error: result.error };
        }
      }
    } catch (error) {
      trade.status = "rejected";
      return {
        success: false,
        error: error instanceof Error ? error.message : "Execution failed",
      };
    }
  }

  // ============================================================================
  // Stats & Info
  // ============================================================================

  private getCopyTradeExposure(): number {
    const trader = getGhostTrader();
    const positions = trader.getOpenPositions();

    // Sum positions that came from copy trades
    return positions
      .filter((p) => p.entryReason?.includes("copy"))
      .reduce((sum, p) => sum + p.amountSol, 0);
  }

  getStats(): CopyTradeStats {
    const successful = this.executedTrades.filter((t) => t.status === "executed").length;
    const failed = this.executedTrades.filter((t) => t.status === "rejected").length;

    return {
      enabled: this.config.enabled,
      totalCopied: this.executedTrades.length,
      successfulCopies: successful,
      failedCopies: failed,
      totalPnlSol: 0, // Would need to track this
      copiesThisHour: this.copiesThisHour,
      lastCopyTime: this.lastCopyTime,
      pendingApprovals: Array.from(this.pendingTrades.values()).filter(
        (t) => t.status === "pending"
      ).length,
    };
  }

  getPendingTrades(): PendingCopyTrade[] {
    return Array.from(this.pendingTrades.values())
      .filter((t) => t.status === "pending")
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getRecentExecutions(limit: number = 10): PendingCopyTrade[] {
    return this.executedTrades.slice(0, limit);
  }

  getSafetyLimits(): typeof SAFETY_LIMITS {
    return { ...SAFETY_LIMITS };
  }
}

// ============================================================================
// Singleton
// ============================================================================

export function getCopyTraderService(): CopyTraderService {
  if (!copyTraderInstance) {
    copyTraderInstance = new CopyTraderService();
  }
  return copyTraderInstance;
}

export default CopyTraderService;
