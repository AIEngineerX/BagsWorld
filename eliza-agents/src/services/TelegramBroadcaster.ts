// TelegramBroadcaster - Broadcasts Ghost trading signals to Telegram channel
// Rate-limited to respect Telegram's 30 messages/second limit for channels

import { Bot } from "grammy";
import { NeonQueryFunction } from "@neondatabase/serverless";

// Telegram rate limits:
// - Channels: 30 messages per second
// - Groups: 20 messages per minute
// We use conservative limits to avoid hitting them
const RATE_LIMIT_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MIN_MESSAGE_INTERVAL_MS = 3_000; // 3 seconds between messages

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  channelId: string; // Can be @channelname or numeric ID
  minScoreToPost: number; // Only post signals with score >= this
  includeRiskLevel: boolean;
  includeDexscreenerLink: boolean;
  includeBagsLink: boolean;
}

export interface TradeSignal {
  type: "entry";
  tokenSymbol: string;
  tokenName: string;
  tokenMint: string;
  amountSol: number;
  score: number;
  reasons: string[];
  metrics: {
    marketCapUsd: number;
    liquidityUsd: number;
    volume24hUsd: number;
    buySellRatio: number;
  };
}

interface MessageRecord {
  timestamp: number;
  tokenMint: string;
}

const DEFAULT_CONFIG: TelegramConfig = {
  enabled: false,
  botToken: "",
  channelId: "",
  minScoreToPost: 60, // Only post high-conviction trades
  includeRiskLevel: true,
  includeDexscreenerLink: true,
  includeBagsLink: true,
};

export class TelegramBroadcaster {
  private config: TelegramConfig;
  private bot: Bot | null = null;
  private messageHistory: MessageRecord[] = [];
  private lastMessageTime: number = 0;
  private db: NeonQueryFunction<false, false> | null = null;
  private pendingMessages: Array<{ signal: TradeSignal; retries: number }> = [];
  private isProcessing: boolean = false;

  constructor(db?: NeonQueryFunction<false, false>) {
    this.config = { ...DEFAULT_CONFIG };
    this.db = db || null;
    this.loadConfigFromEnv();
    this.initBot();
  }

  private loadConfigFromEnv(): void {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (botToken && channelId) {
      this.config.botToken = botToken;
      this.config.channelId = channelId;
      this.config.enabled = process.env.TELEGRAM_BROADCAST_ENABLED === "true";
      console.log(
        `[TelegramBroadcaster] Configured for channel ${channelId}, enabled: ${this.config.enabled}`
      );
    } else {
      console.log("[TelegramBroadcaster] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID");
    }
  }

  private initBot(): void {
    if (!this.config.botToken) {
      return;
    }

    this.bot = new Bot(this.config.botToken);
    console.log("[TelegramBroadcaster] Bot initialized");
  }

  isConfigured(): boolean {
    return !!(this.config.botToken && this.config.channelId && this.bot);
  }

  isEnabled(): boolean {
    return this.config.enabled && this.isConfigured();
  }

  enable(): void {
    if (!this.isConfigured()) {
      console.warn("[TelegramBroadcaster] Cannot enable - not configured");
      return;
    }
    this.config.enabled = true;
    console.log("[TelegramBroadcaster] Enabled");
  }

  disable(): void {
    this.config.enabled = false;
    console.log("[TelegramBroadcaster] Disabled");
  }

  getConfig(): TelegramConfig {
    return { ...this.config, botToken: this.config.botToken ? "***" : "" };
  }

  updateConfig(updates: Partial<TelegramConfig>): void {
    if (updates.minScoreToPost !== undefined) {
      this.config.minScoreToPost = Math.max(0, Math.min(100, updates.minScoreToPost));
    }
    if (updates.includeRiskLevel !== undefined) {
      this.config.includeRiskLevel = updates.includeRiskLevel;
    }
    if (updates.includeDexscreenerLink !== undefined) {
      this.config.includeDexscreenerLink = updates.includeDexscreenerLink;
    }
    if (updates.includeBagsLink !== undefined) {
      this.config.includeBagsLink = updates.includeBagsLink;
    }
    console.log("[TelegramBroadcaster] Config updated:", this.getConfig());
  }

  // Check if we're within rate limits
  private isRateLimited(): boolean {
    const now = Date.now();

    // Clean old messages from history
    this.messageHistory = this.messageHistory.filter(
      (m) => now - m.timestamp < RATE_LIMIT_WINDOW_MS
    );

    // Check if we've hit the rate limit
    if (this.messageHistory.length >= RATE_LIMIT_MESSAGES) {
      return true;
    }

    // Check minimum interval between messages
    if (now - this.lastMessageTime < MIN_MESSAGE_INTERVAL_MS) {
      return true;
    }

    return false;
  }

  // Check if we already posted about this token recently (prevent spam)
  private hasRecentlyPosted(tokenMint: string): boolean {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return this.messageHistory.some(
      (m) => m.tokenMint === tokenMint && m.timestamp > oneHourAgo
    );
  }

  // Calculate risk level from score
  private getRiskLevel(score: number): { emoji: string; label: string } {
    if (score >= 80) return { emoji: "🟢", label: "LOW RISK" };
    if (score >= 65) return { emoji: "🟡", label: "MEDIUM RISK" };
    if (score >= 50) return { emoji: "🟠", label: "HIGHER RISK" };
    return { emoji: "🔴", label: "HIGH RISK" };
  }

  // Format the trading signal as a clean Telegram message
  private formatSignalMessage(signal: TradeSignal): string {
    const risk = this.getRiskLevel(signal.score);
    const mcapFormatted = this.formatUsd(signal.metrics.marketCapUsd);
    const liqFormatted = this.formatUsd(signal.metrics.liquidityUsd);
    const volFormatted = this.formatUsd(signal.metrics.volume24hUsd);

    // Clean up reasons - take top 3 most relevant
    const topReasons = signal.reasons
      .slice(0, 3)
      .map((r) => `• ${r}`)
      .join("\n");

    let message = `👻 *GHOST ENTRY*\n\n`;
    message += `*$${this.escapeMarkdown(signal.tokenSymbol)}* — ${this.escapeMarkdown(signal.tokenName)}\n\n`;

    // Risk level
    if (this.config.includeRiskLevel) {
      message += `${risk.emoji} ${risk.label} (Score: ${signal.score}/100)\n\n`;
    }

    // Why this trade
    message += `*Why this trade:*\n${topReasons}\n\n`;

    // Key metrics
    message += `📊 *Metrics*\n`;
    message += `MCap: ${mcapFormatted} | Liq: ${liqFormatted}\n`;
    message += `24h Vol: ${volFormatted} | B/S: ${signal.metrics.buySellRatio.toFixed(2)}x\n\n`;

    // Contract address
    message += `\`${signal.tokenMint}\`\n\n`;

    // Links
    const links: string[] = [];
    if (this.config.includeDexscreenerLink) {
      links.push(`[DexScreener](https://dexscreener.com/solana/${signal.tokenMint})`);
    }
    if (this.config.includeBagsLink) {
      links.push(`[Bags.fm](https://bags.fm/t/${signal.tokenMint})`);
    }
    if (links.length > 0) {
      message += links.join(" | ");
    }

    return message;
  }

  private formatUsd(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }

  // Escape special characters for Telegram MarkdownV2
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
  }

  // Process pending messages queue
  private async processPendingMessages(): Promise<void> {
    if (this.isProcessing || this.pendingMessages.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.pendingMessages.length > 0) {
      if (this.isRateLimited()) {
        // Wait for rate limit window
        await new Promise((resolve) => setTimeout(resolve, MIN_MESSAGE_INTERVAL_MS));
        continue;
      }

      const pending = this.pendingMessages[0];
      const success = await this.sendMessageInternal(pending.signal);

      if (success) {
        this.pendingMessages.shift();
      } else {
        pending.retries++;
        if (pending.retries >= 3) {
          console.error(
            `[TelegramBroadcaster] Failed to send after 3 retries: $${pending.signal.tokenSymbol}`
          );
          this.pendingMessages.shift();
        } else {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    this.isProcessing = false;
  }

  private async sendMessageInternal(signal: TradeSignal): Promise<boolean> {
    if (!this.bot || !this.config.channelId) {
      return false;
    }

    const message = this.formatSignalMessage(signal);

    const result = await this.bot.api.sendMessage(this.config.channelId, message, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });

    // Record successful send
    this.messageHistory.push({
      timestamp: Date.now(),
      tokenMint: signal.tokenMint,
    });
    this.lastMessageTime = Date.now();

    console.log(
      `[TelegramBroadcaster] Sent signal for $${signal.tokenSymbol} (msg_id: ${result.message_id})`
    );

    // Log to database if available
    if (this.db) {
      await this.logBroadcast(signal, result.message_id);
    }

    return true;
  }

  // Main broadcast method - called by GhostTrader
  async broadcastEntry(signal: TradeSignal): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    // Check minimum score threshold
    if (signal.score < this.config.minScoreToPost) {
      console.log(
        `[TelegramBroadcaster] Skipping $${signal.tokenSymbol} - score ${signal.score} < min ${this.config.minScoreToPost}`
      );
      return false;
    }

    // Check if we already posted about this token
    if (this.hasRecentlyPosted(signal.tokenMint)) {
      console.log(
        `[TelegramBroadcaster] Skipping $${signal.tokenSymbol} - already posted within 1 hour`
      );
      return false;
    }

    // Add to queue and process
    this.pendingMessages.push({ signal, retries: 0 });
    this.processPendingMessages();

    return true;
  }

  // Log broadcast to database for analytics
  private async logBroadcast(signal: TradeSignal, messageId: number): Promise<void> {
    if (!this.db) return;

    await this.db`
      INSERT INTO telegram_broadcasts (
        token_mint, token_symbol, score, message_id, created_at
      ) VALUES (
        ${signal.tokenMint}, ${signal.tokenSymbol}, ${signal.score},
        ${messageId}, ${new Date().toISOString()}
      )
    `.catch((err) => {
      console.error("[TelegramBroadcaster] Failed to log broadcast:", err);
    });
  }

  // Get broadcast statistics
  async getStats(): Promise<{
    enabled: boolean;
    configured: boolean;
    messagesSentLast1h: number;
    messagesSentLast24h: number;
    pendingMessages: number;
    rateLimited: boolean;
  }> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let last24hCount = 0;
    if (this.db) {
      const result = await this.db`
        SELECT COUNT(*) as count FROM telegram_broadcasts
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `.catch(() => [{ count: 0 }]);
      last24hCount = Number(result[0]?.count || 0);
    }

    return {
      enabled: this.isEnabled(),
      configured: this.isConfigured(),
      messagesSentLast1h: this.messageHistory.filter((m) => m.timestamp > oneHourAgo).length,
      messagesSentLast24h: last24hCount,
      pendingMessages: this.pendingMessages.length,
      rateLimited: this.isRateLimited(),
    };
  }

  // Test the bot connection
  async testConnection(): Promise<{ success: boolean; botName?: string; error?: string }> {
    if (!this.bot) {
      return { success: false, error: "Bot not initialized" };
    }

    const me = await this.bot.api.getMe();
    return { success: true, botName: me.username };
  }

  // Send a test message
  async sendTestMessage(): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot || !this.config.channelId) {
      return { success: false, error: "Bot not configured" };
    }

    const testMessage = `🧪 *Test Message*\n\nGhost Telegram broadcaster is working\\!\n\n_Sent at ${new Date().toISOString()}_`;

    const result = await this.bot.api.sendMessage(this.config.channelId, testMessage, {
      parse_mode: "MarkdownV2",
    });

    return { success: true, messageId: result.message_id };
  }
}

// Singleton instance
let broadcasterInstance: TelegramBroadcaster | null = null;

export function getTelegramBroadcaster(
  db?: NeonQueryFunction<false, false>
): TelegramBroadcaster {
  if (!broadcasterInstance) {
    broadcasterInstance = new TelegramBroadcaster(db);
  }
  return broadcasterInstance;
}
