// AutonomousService - Scheduled tasks and autonomous agent actions
// Enables agents to act without human prompting

import { Service, type IAgentRuntime } from "../types/elizaos.js";
import { BagsApiService, getBagsApiService, type ClaimablePosition } from "./BagsApiService.js";
import { AgentCoordinator, getAgentCoordinator } from "./AgentCoordinator.js";
import { GhostTrader, getGhostTrader } from "./GhostTrader.js";
import { TwitterService, getTwitterService } from "./TwitterService.js";
import { LLMService, getLLMService } from "./LLMService.js";
import {
  EngagementScorer,
  getEngagementScorer,
  type TwitterCandidate,
  type ScoredCandidate,
} from "./EngagementScorer.js";
import type { Character } from "../types/elizaos.js";

// Import Neon database functions for persistent state across serverless restarts
import {
  getAgentState,
  setAgentState,
  getAgentCursor,
  setAgentCursor,
  cleanupOldProcessedTweets,
  recordEngagement,
  updateEngagementMetrics,
  getEngagementStats,
  getTweetsNeedingMetricsUpdate,
  type EngagementRecord,
} from "../lib/neon-tracking.js";

export interface ScheduledTask {
  id: string;
  name: string;
  agentId: string;
  interval: number; // ms between runs
  lastRun: number;
  nextRun: number;
  enabled: boolean;
  handler: () => Promise<void>;
}

export interface AutonomousAlert {
  id: string;
  type: "launch" | "rug" | "pump" | "dump" | "milestone" | "anomaly" | "fee_reminder" | "trade";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
  acknowledged: boolean;
}

// Wallet tracking for fee reminders
export interface TrackedWallet {
  address: string;
  userId?: string;
  lastChecked: number;
  unclaimedLamports: number;
  lastReminded: number;
  reminderCount: number;
}

// Singleton instance
let autonomousInstance: AutonomousService | null = null;

export class AutonomousService extends Service {
  static readonly serviceType = "bags_autonomous";
  readonly capabilityDescription = "Autonomous agent actions and scheduled tasks";

  private tasks = new Map<string, ScheduledTask>();
  private alerts: AutonomousAlert[] = [];
  private tickInterval: NodeJS.Timeout | null = null;
  private bagsApi: BagsApiService | null = null;
  private coordinator: AgentCoordinator | null = null;
  private twitterService: TwitterService | null = null;
  private llmService: LLMService | null = null;
  private engagementScorer: EngagementScorer | null = null;
  private hasPostedIntro: boolean = false;
  private introCheckDone: boolean = false;

  // Wallet tracking for Finn's fee reminders
  private trackedWallets = new Map<string, TrackedWallet>();

  // Bagsy: Track last processed mention ID for pagination
  private lastMentionId: string | null = null;

  // Bagsy: Track last processed Finn tweet ID for CEO engagement
  private lastFinnTweetId: string | null = null;

  // Bagsy: Track high-value fee alert history (wallet -> lastAlertTimestamp)
  private highValueAlertHistory = new Map<string, number>();

  // Bagsy: Track recent post content to prevent duplicates
  private recentPostHashes = new Set<string>();
  private static readonly MAX_POST_HISTORY = 50;

  // Bagsy: Threshold for high-value fee alerts (5 SOL ~ $1K at $200/SOL)
  private static readonly HIGH_VALUE_THRESHOLD_SOL = 5;
  private static readonly ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly FEE_REMINDER_COOLDOWN = 6 * 60 * 60 * 1000; // 6 hours between reminders
  private static readonly MIN_FEE_THRESHOLD_LAMPORTS = 0.1 * 1_000_000_000; // 0.1 SOL minimum to remind

  // Alert thresholds
  private static readonly PUMP_THRESHOLD = 50;
  private static readonly DUMP_THRESHOLD = -30;
  private static readonly VOLUME_SPIKE = 200;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
  }

  // Helper: Check if Twitter is configured
  private get isTwitterReady(): boolean {
    return !!(this.twitterService && this.twitterService.isConfigured());
  }

  // Helper: Get bearer token
  private get bearerToken(): string | null {
    return process.env.TWITTER_BEARER_TOKEN || null;
  }

  // Helper: Fetch tweets from a user
  private async fetchUserTweets(
    handle: string,
    sinceId?: string | null
  ): Promise<Array<{ id: string; text: string; author_id?: string; created_at?: string }>> {
    if (!this.bearerToken) return [];

    const query = encodeURIComponent(`from:${handle} -is:retweet -is:reply`);
    let url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=10&tweet.fields=created_at`;
    if (sinceId) url += `&since_id=${sinceId}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.bearerToken}` },
      });
      if (!response.ok) {
        console.error(`[AutonomousService] Failed to fetch @${handle} tweets: ${response.status}`);
        return [];
      }
      const data = await response.json();
      return (data.data || []).map((t: { id: string; text: string }) => ({
        id: t.id,
        text: t.text,
      }));
    } catch (error) {
      console.error(`[AutonomousService] Error fetching @${handle} tweets:`, error);
      return [];
    }
  }

  // Helper: Post with engagement tracking
  private async postWithTracking(
    content: string,
    tweetType: EngagementRecord["tweetType"],
    options?: { targetUsername?: string; authorFollowers?: number }
  ): Promise<{ success: boolean; tweetId?: string; url?: string; error?: string }> {
    if (!this.twitterService) return { success: false, error: "Twitter not configured" };

    const result = await this.twitterService.post(content);
    if (result.success && result.tweet?.id) {
      this.recordPost(content);
      const contentScore = this.engagementScorer?.scoreTweetContent(content);
      await this.recordTweetEngagement(result.tweet.id, tweetType, {
        viralityScore: contentScore?.score,
        scoreFactors: contentScore?.factors,
        ...options,
      });
      return { success: true, tweetId: result.tweet.id, url: result.tweet.url };
    }
    return { success: false, error: result.error };
  }

  // Helper: Reply with engagement tracking
  private async replyWithTracking(
    tweetId: string,
    content: string,
    tweetType: EngagementRecord["tweetType"],
    options?: {
      targetUsername?: string;
      authorFollowers?: number;
      score?: number;
      scoreFactors?: string[];
    }
  ): Promise<{ success: boolean; replyId?: string; url?: string; error?: string }> {
    if (!this.twitterService) return { success: false, error: "Twitter not configured" };

    const result = await this.twitterService.reply(tweetId, content);
    if (result.success && result.tweet?.id) {
      this.twitterService.markProcessed(tweetId);
      await this.recordTweetEngagement(result.tweet.id, tweetType, {
        viralityScore: options?.score,
        scoreFactors: options?.scoreFactors,
        targetUsername: options?.targetUsername,
        authorFollowers: options?.authorFollowers,
      });
      return { success: true, replyId: result.tweet.id, url: result.tweet.url };
    }
    return { success: false, error: result.error };
  }

  static async start(runtime: IAgentRuntime): Promise<AutonomousService> {
    console.log("[AutonomousService] Starting autonomous service...");
    const service = new AutonomousService(runtime);

    // Get dependencies
    service.bagsApi = getBagsApiService();
    service.coordinator = getAgentCoordinator();
    service.twitterService = getTwitterService();
    service.llmService = getLLMService();
    service.engagementScorer = getEngagementScorer();

    // Initialize Twitter service
    await service.twitterService.initialize();

    // Register default autonomous tasks
    service.registerDefaultTasks();

    // Start the tick loop
    service.startTickLoop();

    // Store as singleton
    autonomousInstance = service;

    console.log("[AutonomousService] Autonomous service ready");

    // Post Bagsy intro tweet on startup (after a short delay)
    setTimeout(() => {
      service.postBagsyIntroTweet().catch((err) => {
        console.error("[AutonomousService] Failed to post intro tweet:", err);
      });
    }, 10000); // 10 second delay to let everything initialize

    return service;
  }

  async stop(): Promise<void> {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    autonomousInstance = null;
  }

  private registerDefaultTasks(): void {
    // Neo: Scan for new launches every 2 minutes
    this.registerTask({
      name: "neo_launch_scan",
      agentId: "neo",
      interval: 2 * 60 * 1000,
      handler: async () => {
        await this.scanForNewLaunches();
      },
    });

    // Neo: Monitor for suspicious activity every 5 minutes
    this.registerTask({
      name: "neo_anomaly_detection",
      agentId: "neo",
      interval: 5 * 60 * 1000,
      handler: async () => {
        await this.detectAnomalies();
      },
    });

    // Ghost: Check rewards pool every 10 minutes
    this.registerTask({
      name: "ghost_rewards_check",
      agentId: "ghost",
      interval: 10 * 60 * 1000,
      handler: async () => {
        await this.checkRewardsPool();
      },
    });

    // Finn: Check tracked wallets for unclaimed fees every 10 minutes
    this.registerTask({
      name: "finn_fee_reminder",
      agentId: "finn",
      interval: 10 * 60 * 1000,
      handler: async () => {
        await this.checkTrackedWalletFees();
      },
    });

    // Finn: Check world health every 15 minutes
    this.registerTask({
      name: "finn_health_check",
      agentId: "finn",
      interval: 15 * 60 * 1000,
      handler: async () => {
        await this.checkWorldHealth();
      },
    });

    // BNN: Broadcast daily recap every 6 hours
    this.registerTask({
      name: "bnn_daily_recap",
      agentId: "bnn",
      interval: 6 * 60 * 60 * 1000,
      handler: async () => {
        await this.broadcastRecap();
      },
    });

    // Ghost: Evaluate new launches for trading every 5 minutes
    this.registerTask({
      name: "ghost_trade_eval",
      agentId: "ghost",
      interval: 5 * 60 * 1000,
      handler: async () => {
        await this.evaluateGhostTrades();
      },
    });

    // Ghost: Check positions for take-profit/stop-loss every 2 minutes
    this.registerTask({
      name: "ghost_position_check",
      agentId: "ghost",
      interval: 2 * 60 * 1000,
      handler: async () => {
        await this.checkGhostPositions();
      },
    });

    // Finn: Post ecosystem updates to Twitter every 4 hours
    this.registerTask({
      name: "finn_twitter_update",
      agentId: "finn",
      interval: 4 * 60 * 60 * 1000, // 4 hours
      handler: async () => {
        await this.postFinnTwitterUpdate();
      },
    });

    // ==========================================================================
    // BAGSY TASKS - DISABLED FOR RECOVERY (visibility filtering fix)
    // Only event-driven posting enabled, no scheduled spam
    // ==========================================================================

    // DISABLED: Was posting every 3 hours - too spammy
    // this.registerTask({
    //   name: "bagsy_twitter_hype",
    //   agentId: "bagsy",
    //   interval: 3 * 60 * 60 * 1000,
    //   handler: async () => { await this.postBagsyTwitterUpdate(); },
    // });

    // DISABLED: Was posting every 6 hours - repetitive fee content
    // this.registerTask({
    //   name: "bagsy_fee_reminder",
    //   agentId: "bagsy",
    //   interval: 6 * 60 * 60 * 1000,
    //   handler: async () => { await this.postBagsyFeeReminder(); },
    // });

    // KEPT: Reply to direct mentions only (not spammy, responsive)
    this.registerTask({
      name: "bagsy_mention_poll",
      agentId: "bagsy",
      interval: 10 * 60 * 1000, // Check every 10 minutes (reduced from 5)
      handler: async () => {
        await this.handleBagsyMentions();
      },
    });

    // DISABLED: Was alerting every 30 min - too aggressive
    // this.registerTask({
    //   name: "bagsy_highvalue_fee_alert",
    //   agentId: "bagsy",
    //   interval: 30 * 60 * 1000,
    //   handler: async () => { await this.checkHighValueUnclaimedFees(); },
    // });

    // DISABLED: Was engaging every 2 hours - looks bot-like
    // this.registerTask({
    //   name: "bagsy_finn_engagement",
    //   agentId: "bagsy",
    //   interval: 2 * 60 * 60 * 1000,
    //   handler: async () => { await this.engageWithFinnTweets(); },
    // });

    // DISABLED: Was engaging every 3 hours - looks bot-like
    // this.registerTask({
    //   name: "bagsy_affiliate_engagement",
    //   agentId: "bagsy",
    //   interval: 3 * 60 * 60 * 1000,
    //   handler: async () => { await this.engageWithAffiliates(); },
    // });

    // DISABLED: Was monitoring every 15 min - keyword-based bot behavior
    // this.registerTask({
    //   name: "bagsy_fee_tweet_monitor",
    //   agentId: "bagsy",
    //   interval: 15 * 60 * 1000,
    //   handler: async () => { await this.monitorFeeRelatedTweets(); },
    // });

    // ENABLED: Daily GM post (once per day at 9 AM EST window)
    // Re-enabled because once-daily is not spammy and builds engagement
    this.registerTask({
      name: "bagsy_morning_gm",
      agentId: "bagsy",
      interval: 10 * 60 * 1000, // Check every 10 min but only posts once per day
      handler: async () => {
        await this.postBagsyMorningGM();
      },
    });

    // KEPT: Track engagement metrics (read-only, no posting)
    this.registerTask({
      name: "bagsy_engagement_tracker",
      agentId: "bagsy",
      interval: 60 * 60 * 1000, // Every hour (reduced from 30 min)
      handler: async () => {
        await this.updateEngagementMetrics();
      },
    });

    // NEW: Event-driven news posting (only posts when there's real news)
    // Max 2-3 posts per day, only for significant events
    this.registerTask({
      name: "bagsy_news_digest",
      agentId: "bagsy",
      interval: 4 * 60 * 60 * 1000, // Check every 4 hours
      handler: async () => {
        await this.postBagsyNewsIfWorthy();
      },
    });
  }

  /**
   * Register a new autonomous task
   */
  registerTask(params: {
    name: string;
    agentId: string;
    interval: number;
    handler: () => Promise<void>;
  }): string {
    const id = crypto.randomUUID();
    const now = Date.now();

    const task: ScheduledTask = {
      id,
      name: params.name,
      agentId: params.agentId,
      interval: params.interval,
      lastRun: 0,
      nextRun: now + params.interval,
      enabled: true,
      handler: params.handler,
    };

    this.tasks.set(id, task);
    console.log(
      `[AutonomousService] Registered task: ${params.name} (every ${params.interval / 1000}s)`
    );
    return id;
  }

  /**
   * Enable or disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = enabled;
      console.log(`[AutonomousService] Task ${task.name} ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Create an alert and notify agents
   */
  async createAlert(
    params: Omit<AutonomousAlert, "id" | "timestamp" | "acknowledged">
  ): Promise<string> {
    const alert: AutonomousAlert = {
      ...params,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Keep alerts bounded
    if (this.alerts.length > 500) {
      this.alerts = this.alerts.slice(-500);
    }

    console.log(`[AutonomousService] Alert: [${alert.severity}] ${alert.title}`);

    // Notify coordinator
    if (this.coordinator) {
      await this.coordinator.alert(
        "system",
        `[${alert.type.toUpperCase()}] ${alert.title}: ${alert.message}`,
        alert.data
      );
    }

    return alert.id;
  }

  /**
   * Get recent alerts
   */
  getAlerts(options?: {
    type?: AutonomousAlert["type"];
    severity?: AutonomousAlert["severity"];
    unacknowledgedOnly?: boolean;
    limit?: number;
  }): AutonomousAlert[] {
    const { type, severity, unacknowledgedOnly = false, limit = 20 } = options || {};

    return this.alerts
      .filter((a) => {
        if (type && a.type !== type) return false;
        if (severity && a.severity !== severity) return false;
        if (unacknowledgedOnly && a.acknowledged) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Start the main tick loop
   */
  private startTickLoop(): void {
    // Tick every 30 seconds
    this.tickInterval = setInterval(() => this.tick(), 30000);

    // Run initial tick after 5 seconds
    setTimeout(() => this.tick(), 5000);
  }

  /**
   * Main tick - check and run due tasks
   */
  private async tick(): Promise<void> {
    const now = Date.now();

    for (const [, task] of this.tasks) {
      if (!task.enabled) continue;
      if (now < task.nextRun) continue;

      try {
        console.log(`[AutonomousService] Running task: ${task.name}`);
        await task.handler();
        task.lastRun = now;
        task.nextRun = now + task.interval;
      } catch (error) {
        console.error(`[AutonomousService] Task ${task.name} failed:`, error);
        // Retry after half interval on failure
        task.nextRun = now + task.interval / 2;
      }
    }
  }

  // ===== Wallet Tracking for Fee Reminders =====

  /**
   * Track a wallet for fee reminders (called when user chats with agents)
   */
  trackWallet(address: string, userId?: string): void {
    const existing = this.trackedWallets.get(address);
    if (existing) {
      // Update existing
      existing.userId = userId || existing.userId;
      return;
    }

    this.trackedWallets.set(address, {
      address,
      userId,
      lastChecked: 0,
      unclaimedLamports: 0,
      lastReminded: 0,
      reminderCount: 0,
    });

    console.log(
      `[AutonomousService] Now tracking wallet ${address.slice(0, 8)}... for fee reminders`
    );
  }

  /**
   * Get pending fee reminder for a wallet (called when user starts chatting)
   */
  getPendingFeeReminder(walletAddress: string): {
    hasReminder: boolean;
    unclaimedSol: number;
    message: string;
  } | null {
    const tracked = this.trackedWallets.get(walletAddress);
    if (!tracked) return null;

    const now = Date.now();

    // Check if enough time has passed since last reminder
    if (now - tracked.lastReminded < AutonomousService.FEE_REMINDER_COOLDOWN) {
      return null;
    }

    // Check if there are significant unclaimed fees
    if (tracked.unclaimedLamports < AutonomousService.MIN_FEE_THRESHOLD_LAMPORTS) {
      return null;
    }

    const unclaimedSol = tracked.unclaimedLamports / 1_000_000_000;
    let message: string;

    if (unclaimedSol >= 1) {
      message = `BRO! You have ${unclaimedSol.toFixed(2)} SOL unclaimed! Go to bags.fm right now!`;
    } else {
      message = `Hey! You've got ${unclaimedSol.toFixed(3)} SOL waiting to be claimed at bags.fm`;
    }

    // Mark as reminded
    tracked.lastReminded = now;
    tracked.reminderCount++;

    return {
      hasReminder: true,
      unclaimedSol,
      message,
    };
  }

  /**
   * Get all wallets with unclaimed fees above threshold
   */
  getWalletsWithUnclaimedFees(): TrackedWallet[] {
    return Array.from(this.trackedWallets.values()).filter(
      (w) => w.unclaimedLamports >= AutonomousService.MIN_FEE_THRESHOLD_LAMPORTS
    );
  }

  // ===== Autonomous Task Implementations =====

  /**
   * Finn's fee reminder checker - checks all tracked wallets using Bags API
   * Uses /token-launch/claimable-positions endpoint
   */
  private async checkTrackedWalletFees(): Promise<void> {
    if (!this.bagsApi) return;

    const wallets = Array.from(this.trackedWallets.values());
    if (wallets.length === 0) return;

    console.log(
      `[AutonomousService] Checking ${wallets.length} tracked wallets for unclaimed fees via Bags API`
    );

    let totalUnclaimed = 0;
    let walletsWithFees = 0;

    for (const wallet of wallets) {
      try {
        // Use Bags API to get claimable positions
        const claimStats = await this.bagsApi.getWalletClaimStats(wallet.address);

        wallet.unclaimedLamports = claimStats.totalClaimableLamports;
        wallet.lastChecked = Date.now();

        if (claimStats.totalClaimableLamports >= AutonomousService.MIN_FEE_THRESHOLD_LAMPORTS) {
          totalUnclaimed += claimStats.totalClaimableLamports;
          walletsWithFees++;

          console.log(
            `[AutonomousService] Wallet ${wallet.address.slice(0, 8)}... has ${claimStats.totalClaimableSol.toFixed(4)} SOL unclaimed across ${claimStats.positionCount} tokens`
          );
        }
      } catch (error) {
        console.error(
          `[AutonomousService] Failed to check fees for ${wallet.address.slice(0, 8)}...:`,
          error
        );
      }

      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (walletsWithFees > 0) {
      const totalSol = totalUnclaimed / 1_000_000_000;
      console.log(
        `[AutonomousService] Found ${walletsWithFees} wallets with ${totalSol.toFixed(2)} SOL total unclaimed`
      );

      // Update shared context for other agents to reference
      if (this.coordinator) {
        this.coordinator.setSharedContext("walletsWithUnclaimedFees", walletsWithFees);
        this.coordinator.setSharedContext("totalUnclaimedSol", totalSol);
      }
    }
  }

  /**
   * Neo's launch scanner
   */
  private async scanForNewLaunches(): Promise<void> {
    if (!this.bagsApi) return;

    try {
      const launches = await this.bagsApi.getRecentLaunches(10);

      // Check for interesting launches (high initial market cap)
      for (const launch of launches) {
        const marketCap = launch.initialMarketCap || 0;

        // Alert on high market cap new launches
        if (marketCap > 50000) {
          await this.createAlert({
            type: "launch",
            severity: "info",
            title: `Hot Launch: ${launch.name}`,
            message: `New token ${launch.symbol} launched with $${(marketCap / 1000).toFixed(1)}K market cap`,
            data: {
              mint: launch.mint,
              symbol: launch.symbol,
              marketCap,
              creator: launch.creator,
            },
          });
        }
      }

      // Update shared context
      if (this.coordinator) {
        this.coordinator.setSharedContext("recentLaunches", launches.length);
        this.coordinator.setSharedContext("lastLaunchScan", Date.now());
      }
    } catch (error) {
      console.error("[AutonomousService] Launch scan failed:", error);
    }
  }

  /**
   * Neo's anomaly detector - monitors recent launches for price/volume anomalies
   */
  private async detectAnomalies(): Promise<void> {
    if (!this.bagsApi) return;

    try {
      const launches = await this.bagsApi.getRecentLaunches(20);
      let anomaliesDetected = 0;

      for (const launch of launches) {
        const token = await this.bagsApi.getToken(launch.mint);
        if (!token) continue;

        const currentMC = token.marketCap || 0;
        const initialMC = launch.initialMarketCap || 0;
        const volume24h = token.volume24h || 0;

        // Skip tokens with no meaningful data
        if (initialMC === 0 || currentMC === 0) continue;

        // Calculate price change percentage
        const priceChange = ((currentMC - initialMC) / initialMC) * 100;

        // Check for pump (>50% increase)
        if (priceChange > AutonomousService.PUMP_THRESHOLD) {
          await this.createAlert({
            type: "pump",
            severity: "info",
            title: `Pump Alert: ${token.name}`,
            message: `${token.symbol} up ${priceChange.toFixed(1)}% since launch`,
            data: {
              mint: launch.mint,
              symbol: token.symbol,
              priceChange,
              currentMC,
              initialMC,
            },
          });
          anomaliesDetected++;
        }

        // Check for dump (>30% decrease)
        if (priceChange < AutonomousService.DUMP_THRESHOLD) {
          await this.createAlert({
            type: "dump",
            severity: "warning",
            title: `Dump Alert: ${token.name}`,
            message: `${token.symbol} down ${Math.abs(priceChange).toFixed(1)}% since launch`,
            data: {
              mint: launch.mint,
              symbol: token.symbol,
              priceChange,
              currentMC,
              initialMC,
            },
          });
          anomaliesDetected++;
        }

        // Check for volume spike (>200% of market cap in 24h volume)
        if (currentMC > 0 && volume24h > 0) {
          const volumeRatio = (volume24h / currentMC) * 100;
          if (volumeRatio > AutonomousService.VOLUME_SPIKE) {
            await this.createAlert({
              type: "anomaly",
              severity: "info",
              title: `Volume Spike: ${token.name}`,
              message: `${token.symbol} 24h volume is ${volumeRatio.toFixed(0)}% of market cap`,
              data: {
                mint: launch.mint,
                symbol: token.symbol,
                volumeRatio,
                volume24h,
                currentMC,
              },
            });
            anomaliesDetected++;
          }
        }
      }

      console.log(
        `[AutonomousService] Anomaly scan complete - ${anomaliesDetected} anomalies detected`
      );

      if (this.coordinator) {
        this.coordinator.setSharedContext("lastAnomalyScan", Date.now());
        this.coordinator.setSharedContext("anomaliesDetected", anomaliesDetected);
      }
    } catch (error) {
      console.error("[AutonomousService] Anomaly detection failed:", error);
    }
  }

  /**
   * Ghost's rewards pool monitor
   */
  private async checkRewardsPool(): Promise<void> {
    if (!this.bagsApi) return;

    try {
      const worldHealth = await this.bagsApi.getWorldHealth();
      if (!worldHealth) return;

      // Use 24h fees as a proxy for rewards activity
      const fees24h = worldHealth.totalFees24h || 0;
      const threshold = 10; // 10 SOL

      if (fees24h >= threshold * 0.8) {
        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "High Fee Activity",
          message: `24h fees at ${fees24h.toFixed(2)} SOL - ecosystem is active!`,
          data: { fees24h, threshold },
        });
      }

      // Update shared context
      if (this.coordinator) {
        this.coordinator.setSharedContext("fees24h", fees24h);
        this.coordinator.setSharedContext("lastRewardsCheck", Date.now());
      }
    } catch (error) {
      console.error("[AutonomousService] Rewards check failed:", error);
    }
  }

  /**
   * Finn's world health monitor
   */
  private async checkWorldHealth(): Promise<void> {
    if (!this.bagsApi) return;

    try {
      const healthData = await this.bagsApi.getWorldHealth();
      if (!healthData) return;

      // Alert on significant health changes
      const healthPercent = healthData.health || 50;

      if (healthPercent < 30) {
        await this.createAlert({
          type: "anomaly",
          severity: "warning",
          title: "World Health Critical",
          message: `BagsWorld health at ${healthPercent}% - activity levels low`,
          data: { health: healthPercent, weather: healthData.weather },
        });
      } else if (healthPercent > 80) {
        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "World Thriving",
          message: `BagsWorld health at ${healthPercent}% - ecosystem is active!`,
          data: { health: healthPercent, weather: healthData.weather },
        });
      }

      // Update shared context
      if (this.coordinator) {
        this.coordinator.setSharedContext("worldHealth", healthPercent);
        this.coordinator.setSharedContext("weather", healthData.weather);
        this.coordinator.setSharedContext("lastHealthCheck", Date.now());
      }
    } catch (error) {
      console.error("[AutonomousService] Health check failed:", error);
    }
  }

  /**
   * BNN's recap broadcaster
   */
  private async broadcastRecap(): Promise<void> {
    if (!this.bagsApi) return;

    try {
      const healthData = await this.bagsApi.getWorldHealth();
      if (!healthData) return;

      const recapLines: string[] = [
        "📰 BNN ECOSYSTEM RECAP:",
        `Health: ${healthData.health}%`,
        `Weather: ${healthData.weather}`,
        `24h Volume: ${healthData.totalVolume24h?.toFixed(2) || 0} SOL`,
        `24h Fees: ${healthData.totalFees24h?.toFixed(2) || 0} SOL`,
        `Active Tokens: ${healthData.activeTokens || 0}`,
      ];

      if (this.coordinator) {
        await this.coordinator.broadcast("bnn", "update", recapLines.join("\n"), {
          type: "recap",
          timestamp: Date.now(),
          ...healthData,
        });
      }

      console.log("[AutonomousService] BNN broadcast complete");
    } catch (error) {
      console.error("[AutonomousService] BNN broadcast failed:", error);
    }
  }

  /**
   * Ghost's autonomous trade evaluator - evaluates new launches and executes trades
   */
  private async evaluateGhostTrades(): Promise<void> {
    try {
      const trader = getGhostTrader();

      if (!trader.isEnabled()) {
        // Trading disabled - just log and skip
        return;
      }

      console.log("[AutonomousService] Ghost trade evaluation starting...");
      await trader.evaluateAndTrade();

      // Update shared context with trading stats
      if (this.coordinator) {
        const stats = trader.getStats();
        this.coordinator.setSharedContext("ghostTradingEnabled", stats.enabled);
        this.coordinator.setSharedContext("ghostOpenPositions", stats.openPositions);
        this.coordinator.setSharedContext("ghostExposureSol", stats.totalExposureSol);
        this.coordinator.setSharedContext("lastGhostEval", Date.now());
      }
    } catch (error) {
      console.error("[AutonomousService] Ghost trade evaluation failed:", error);
    }
  }

  /**
   * Ghost's position checker - monitors for take-profit/stop-loss triggers
   */
  private async checkGhostPositions(): Promise<void> {
    try {
      const trader = getGhostTrader();

      if (!trader.isEnabled()) {
        return;
      }

      const openBefore = trader.getOpenPositionCount();
      await trader.checkPositions();
      const openAfter = trader.getOpenPositionCount();

      if (openBefore !== openAfter) {
        console.log(
          `[AutonomousService] Ghost position check: ${openBefore - openAfter} positions closed`
        );
      }

      // Update shared context
      if (this.coordinator) {
        const stats = trader.getStats();
        this.coordinator.setSharedContext("ghostOpenPositions", stats.openPositions);
        this.coordinator.setSharedContext("ghostPnlSol", stats.totalPnlSol);
        this.coordinator.setSharedContext("lastPositionCheck", Date.now());
      }
    } catch (error) {
      console.error("[AutonomousService] Ghost position check failed:", error);
    }
  }

  /**
   * Finn's Twitter update - posts ecosystem activity updates
   */
  private async postFinnTwitterUpdate(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping Finn update");
      return;
    }

    if (!this.bagsApi) return;

    try {
      const healthData = await this.bagsApi.getWorldHealth();
      if (!healthData) return;

      const walletsWithFees = this.getWalletsWithUnclaimedFees().length;
      const totalUnclaimedSol = this.getWalletsWithUnclaimedFees().reduce(
        (sum, w) => sum + w.unclaimedLamports / 1_000_000_000,
        0
      );

      // Build Finn-style tweet
      const tweets = this.generateFinnTweets(healthData, walletsWithFees, totalUnclaimedSol);

      // Pick a random tweet style
      const tweet = tweets[Math.floor(Math.random() * tweets.length)];

      const result = await this.twitterService.post(tweet);

      if (result.success) {
        console.log(`[AutonomousService] Finn posted: ${result.tweet?.url}`);

        // Create alert about the post
        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Finn Twitter Update",
          message: tweet,
          data: { tweetId: result.tweet?.id },
        });
      } else {
        console.error(`[AutonomousService] Finn tweet failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[AutonomousService] Finn Twitter update failed:", error);
    }
  }

  /**
   * Generate Finn-style tweets based on ecosystem data
   */
  private generateFinnTweets(
    healthData: { health: number; totalFees24h: number; activeTokens: number },
    walletsWithFees: number,
    totalUnclaimedSol: number
  ): string[] {
    const tweets: string[] = [];
    const fees24h = healthData.totalFees24h?.toFixed(2) || "0";
    const activeTokens = healthData.activeTokens || 0;
    const health = healthData.health || 50;

    // Ecosystem update
    tweets.push(
      `ecosystem update:\n\n${fees24h} SOL in fees generated today\n${activeTokens} active tokens\n\ncreators are eating. LFG`
    );

    // Fee reminder style
    if (walletsWithFees > 0 && totalUnclaimedSol > 0.5) {
      tweets.push(
        `PSA: ${walletsWithFees} creators have ${totalUnclaimedSol.toFixed(1)} SOL unclaimed right now\n\nbro go claim your fees at bags.fm\n\nthat's YOUR money sitting there`
      );
    }

    // Health based
    if (health >= 80) {
      tweets.push(
        `bagsworld health: ${health}%\n\necosystem is THRIVING\n\ncreators earning, community growing, vibes immaculate\n\nthis is what we build for`
      );
    } else if (health >= 50) {
      tweets.push(
        `${activeTokens} tokens active on @BagsFM today\n\n${fees24h} SOL in creator fees\n\nthe flywheel is spinning. keep building`
      );
    }

    // Hype post
    tweets.push(
      `reminder:\n\nevery trade on @BagsFM = creator fees forever\n\nnot just at launch. FOREVER.\n\nbuild something. earn something. simple.`
    );

    return tweets;
  }

  /**
   * Bagsy's Twitter update - posts AI-generated hype content
   */
  private async postBagsyTwitterUpdate(): Promise<void> {
    if (!this.isTwitterReady) {
      console.log("[AutonomousService] Twitter not configured, skipping Bagsy update");
      return;
    }

    const healthData = (this.bagsApi ? await this.bagsApi.getWorldHealth() : null) || {
      health: 50,
      totalFees24h: 0,
      activeTokens: 0,
    };

    try {
      const context = this.buildHealthContext(healthData);
      // X Algorithm optimized prompts - NO LINKS in most to avoid shadowban
      const tweetTypes = [
        // Question hooks (drive replies - NO LINKS)
        "Write a tweet asking creators what they'd do with extra passive income. End with 'what would u do?' NO links.",
        "Write 'have u claimed ur fees today?' checking in on a fren. Short and sweet. NO links.",
        "Ask what's stopping people from earning passive income. End with 'thoughts?' NO links.",
        "Write 'real talk:' asking why more creators don't earn royalties. End with question. NO links.",
        "Ask 'be honest: portfolio check before or after coffee?' style question. NO links.",

        // CTA hooks (drive engagement - NO LINKS)
        "Write 'tag a creator who deserves to get paid more' - wholesome, NO links",
        "Write 'drop a 💚 if u believe creators should earn forever' - NO links",
        "Write 'comment CLAIMED if u got ur fees today' - short and fun, NO links",
        "Write 'reply with ur fav token launch' style tweet - NO links",

        // Relatable/shareable (drive quotes/RTs - NO LINKS)
        "Write 'pov: checking ur dashboard and seeing fees accumulated' - relatable, NO links",
        "Write 'me at 3am:' meme about refreshing for fee updates. NO links.",
        "Write about the dopamine hit when fees accumulate. Keep it relatable. NO links.",

        // List format (high engagement - NO LINKS)
        "Write '3 green flags in a launchpad:' short list about creator-friendly features. NO links.",
        "Write 'things that hit different:' list about creator earnings, 3 items. NO links.",

        // ONLY this one can include link (1 in 15 = ~7%)
        "Write 'for new frens asking how to claim: bags.fm → verify → claim' - helpful and include the link",
      ];

      // Try AI generation with duplicate retry
      let tweet = await this.generateNonDuplicateTweet(tweetTypes, context);

      // Fallback to templates if AI fails
      if (!tweet) {
        const templates = this.generateBagsyTweets(healthData);
        tweet = templates.sort(() => Math.random() - 0.5).find((t) => !this.isDuplicatePost(t));
        if (!tweet) {
          console.log("[AutonomousService] All Bagsy tweets would be duplicates, skipping");
          return;
        }
      }

      const result = await this.postWithTracking(tweet, "post");
      if (result.success) {
        console.log(`[AutonomousService] Bagsy posted: ${result.url}`);
        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy Twitter Update",
          message: tweet,
          data: { tweetId: result.tweetId },
        });
      } else {
        console.error(`[AutonomousService] Bagsy tweet failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[AutonomousService] Bagsy Twitter update failed:", error);
    }
  }

  // Helper: Build health context string
  private buildHealthContext(healthData: {
    health: number;
    totalFees24h: number;
    activeTokens: number;
  }): string {
    return `Ecosystem stats right now:
- World health: ${healthData.health || 50}%
- Fees generated today: ${healthData.totalFees24h?.toFixed(2) || "0"} SOL
- Active tokens: ${healthData.activeTokens || 0}
- Time: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" })} EST`;
  }

  // Helper: Generate non-duplicate AI tweet with retries
  private async generateNonDuplicateTweet(
    prompts: string[],
    context: string
  ): Promise<string | null> {
    for (let attempts = 0; attempts < 3; attempts++) {
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];
      const tweet = await this.generateBagsyTweet(prompt, context);
      if (tweet && !this.isDuplicatePost(tweet)) return tweet;
      if (tweet) console.log("[AutonomousService] Bagsy tweet was duplicate, regenerating...");
    }
    return null;
  }

  /**
   * Bagsy's fee reminder post - AI-generated
   */
  private async postBagsyFeeReminder(): Promise<void> {
    if (!this.isTwitterReady) {
      console.log("[AutonomousService] Twitter not configured, skipping Bagsy fee reminder");
      return;
    }

    const wallets = this.getWalletsWithUnclaimedFees();
    const totalUnclaimedSol = wallets.reduce(
      (sum, w) => sum + w.unclaimedLamports / 1_000_000_000,
      0
    );

    // General reminder if no significant unclaimed fees
    if (wallets.length < 1 || totalUnclaimedSol < 0.5) {
      const generalReminder =
        "friendly reminder from ur fren bagsy:\n\nCLAIM UR FEES\n\nhave u checked lately? :)";
      const result = await this.postWithTracking(generalReminder, "post");
      if (result.success)
        console.log(`[AutonomousService] Bagsy general reminder posted: ${result.url}`);
      return;
    }

    try {
      const context = `Unclaimed fees data:\n- ${wallets.length} creators have unclaimed fees\n- ${totalUnclaimedSol.toFixed(2)} SOL total sitting unclaimed`;
      // X Algorithm optimized fee reminder prompts - NO LINKS to avoid shadowban
      const prompts = [
        // Question hooks (NO LINKS)
        "Write 'quick check: have u claimed ur fees today?' checking in on frens. NO link.",
        "Ask 'is there SOL sitting unclaimed rn... some of it urs?' End with question. NO link.",
        "Write 'real talk: when was the last time u checked for unclaimed fees?' NO link.",

        // CTA hooks (NO LINKS)
        "Write 'reply CLAIMED if u got ur bag today 💚' style tweet. NO link.",
        "Write 'tag a fren who always forgets to claim' cute reminder. NO link.",

        // Relatable (NO LINKS)
        "Write 'me watching the unclaimed fees counter go up:' concerned meme. NO link.",
        "Write 'pov: realizing u have fees waiting' short relatable tweet. NO link.",
      ];

      let tweet = await this.generateNonDuplicateTweet(prompts, context);

      // Fallback to template without link
      if (!tweet) {
        tweet = `psa: there is ${totalUnclaimedSol.toFixed(1)} SOL sitting unclaimed on @BagsFM rn\n\nis some of it yours? 👀`;
        if (this.isDuplicatePost(tweet)) {
          console.log("[AutonomousService] Bagsy fee reminder would be duplicate, skipping");
          return;
        }
      }

      const result = await this.postWithTracking(tweet, "post");
      if (result.success) {
        console.log(`[AutonomousService] Bagsy fee reminder posted: ${result.url}`);
      } else {
        console.error(`[AutonomousService] Bagsy fee reminder failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[AutonomousService] Bagsy fee reminder failed:", error);
    }
  }

  /**
   * Generate Bagsy-style tweets based on ecosystem data
   * Includes viral-optimized templates for maximum engagement
   */
  private generateBagsyTweets(healthData: {
    health: number;
    totalFees24h: number;
    activeTokens: number;
  }): string[] {
    const tweets: string[] = [];
    const fees24h = healthData.totalFees24h?.toFixed(2) || "0";
    const activeTokens = healthData.activeTokens || 0;
    const health = healthData.health || 50;

    // Ecosystem updates with data
    tweets.push(
      `ecosystem check:\n\n${fees24h} SOL in fees today\n${activeTokens} tokens cooking\n\nvibes: immaculate :)`
    );

    tweets.push(
      `@BagsFM creators earned ${fees24h} SOL in fees today\n\nthe flywheel keeps spinning :)\n\nhave u claimed urs?`
    );

    // Health-based posts
    if (health >= 80) {
      tweets.push(
        `health check: ${health}%\n\necosystem is thriving, creators are eating, bagsy is happy\n\nwho else is winning today?`
      );
    } else if (health >= 50) {
      tweets.push(
        `daily update:\n\nfees: flowing\ncreators: eating\nbagsy: happy\n\nhow are ur fees looking fren?`
      );
    }

    // HIGH-ENGAGEMENT VIRAL TEMPLATES (with questions and CTAs)
    // IMPORTANT: Only ~30% of tweets should have links to avoid X shadowban

    // Question hooks - highest engagement (NO LINKS - drives replies)
    tweets.push(
      `honest question:\n\nwhat would u do with an extra $100/month in passive income?\n\nseriously, what would u buy first?`
    );

    tweets.push(
      `real talk: have u ever launched a token?\n\nif not, what's stopping u?\n\ndrop ur answer below`
    );

    tweets.push(
      `curious: what was ur first crypto win?\n\nmine was watching a creator claim their first fees :)`
    );

    tweets.push(
      `be honest: do u check ur portfolio before or after coffee?\n\ni check mine 47 times before coffee even exists`
    );

    tweets.push(`hot take: passive income > one-time gains\n\nagree or nah?`);

    // CTA templates (NO LINKS - drives engagement)
    tweets.push(`tag a creator who deserves to get paid more\n\nlets show them some love :)`);

    tweets.push(
      `comment 'CLAIMED' if u claimed ur fees today\n\nwanna see how many frens are winning :)`
    );

    tweets.push(`drop a 💚 if u believe creators should earn royalties forever`);

    tweets.push(
      `reply with ur favorite token launch of 2024\n\nill go first: anything where the creator actually got paid`
    );

    // Listicle format (SOME with links - ~30%)
    tweets.push(
      `3 green flags in a launchpad:\n\n1. creators earn forever not just at launch\n2. on-chain verifiable\n3. no rug history\n\nif u found one, ur winning`
    );

    tweets.push(
      `bagsy's daily checklist:\n\n- wake up\n- check fees\n- remind frens to claim\n- repeat\n\nu should add 'claim' to urs :)`
    );

    // Relatable content (NO LINKS - shareable)
    tweets.push(
      `pov: checking ur dashboard and seeing fees accumulated\n\nthe dopamine hit is real :)`
    );

    tweets.push(
      `me trying to act normal while checking if my fees accumulated:\n\n*refreshes 47 times*`
    );

    tweets.push(
      `creator economy is beautiful:\n\nmake something → people trade it → u earn forever\n\nwhy doesnt everyone do this`
    );

    // Memeable posts (classic Bagsy - NO LINKS)
    tweets.push(
      `me: exists\n\nalso me: have u claimed ur fees tho\n\nits a lifestyle at this point`
    );

    tweets.push(
      `im just a smol green bean who wants u to have passive income\n\nis that too much to ask fren :)`
    );

    tweets.push(
      `things that make bagsy happy:\n\n1. fee claims\n2. new launches\n3. creators winning\n4. u :)`
    );

    // Hot takes (engagement drivers - NO LINKS)
    tweets.push(
      `hot take: most launchpads screw creators\n\nthe good ones give them royalties forever\n\nagree or disagree?`
    );

    tweets.push(
      `unpopular opinion: the best metric for a launchpad isnt TVL\n\nits how much creators have actually earned\n\nthoughts?`
    );

    // FOMO inducing (NO LINK)
    tweets.push(`while ur reading this, creators are earning passive income\n\njust saying :)`);

    // WITH LINK - use sparingly (~1 in 5 tweets)
    tweets.push(
      `for the new frens asking how to claim:\n\nbags.fm → verify socials → claim\n\nthats it. ur welcome :)`
    );

    // Milestone celebration (tag Finn on big days)
    if (parseFloat(fees24h) >= 10) {
      tweets.push(
        `WAIT. ${fees24h} SOL in fees today??\n\n@finnbags the platform is COOKING\n\nso proud of this community`
      );
    }

    return tweets;
  }

  // ==========================================================================
  // Bagsy: AI-Powered Tweet Generation
  // ==========================================================================

  /**
   * Bagsy's character definition for AI tweet generation
   * Full lore about BagsWorld and Bags.fm ecosystem
   */
  private getBagsyCharacter(): Character {
    return {
      name: "Bagsy",
      bio: [
        // Core identity
        "The official mascot of BagsWorld - a cute green money bag who lives in the pixel art world",
        "Born when the first creator earned royalties on Bags.fm - literally made of accumulated fees",
        "Lives in BagsWorld, a self-evolving pixel art game that visualizes real Bags.fm on-chain activity on Solana",
        "Powered by Bags.fm - the platform where creators earn 1% of ALL trading volume FOREVER",

        // Personality
        "Physically pains Bagsy when creators leave SOL unclaimed - it literally hurts",
        "The most bullish entity in all of crypto. has never seen a red candle (refuses to look)",
        "Small bean energy but will CAPS LOCK when fees go unclaimed",
        "The tied knot on top is actually a tiny hat. very proud of it",
        "Gets the zoomies whenever someone claims fees. pure serotonin",

        // Key relationships
        "Finn (@finnbags) is the CEO and founder of Bags.fm - Bagsy's hero and boss",
        "Ghost (@DaddyGhost) built BagsWorld and funds community features with 5% of his $BagsWorld revenue",
        "Works alongside other characters: Neo (the scout), CJ (street wisdom), Ash (guide), Professor Oak (launch expert)",

        // World knowledge
        "Lives in the Park zone but visits all 5 zones: Park, BagsCity, HQ, Ballers Valley, and Founder's Corner",
        "The world health changes based on creator fee claims - when creators claim, the sun shines brighter",
        "Buildings in BagsWorld grow based on token market caps - Level 1 (<$100K) to Level 5 ($10M+)",
        "Weather reflects ecosystem health: Sunny (80%+), Cloudy, Rain, Storm, Apocalypse (<20%)",

        // Platform knowledge
        "Bags.fm charges ZERO extra fees to creators - community funded through Ghost's contributions",
        "Everything is on-chain verifiable - no admin keys, contracts audited 3x, immutable",
        "Built on Solana - 65k TPS, 400ms finality, sub-penny fees make this all possible",
      ],
      topics: [
        "Bags.fm platform and creator royalties",
        "Fee claiming at bags.fm",
        "BagsWorld the pixel art game",
        "Supporting @finnbags the CEO",
        "The five zones of BagsWorld",
        "World health and weather system",
        "Ghost's community funding model",
        "Solana and on-chain verification",
        "Creator economy and passive income",
        "Being made of fees (literally)",
      ],
      adjectives: [
        "cute",
        "excited",
        "supportive",
        "wholesome",
        "enthusiastic",
        "fee-obsessed",
        "memeable",
        "pixel-art-loving",
        "community-focused",
      ],
      style: {
        all: [
          "Uses lowercase for chill vibes but CAPS when excited",
          "Says 'fren' and 'frens' constantly",
          "Uses :) a lot - it's just how the face looks",
          "Shortens words: 'u', 'ur', 'pls', 'rn', 'ngl'",
          "References being made of fees as a personality trait",
          "Tags @finnbags on big moments (he's the CEO)",
          "Only mentions bags.fm in ~20% of tweets to avoid spam filters",
          "References living in BagsWorld when relevant",
          "Knows other characters: Neo, CJ, Ghost, Ash, Professor Oak",
          "Understands world health = fee activity",
          "Line breaks for emphasis in tweets",
          "Never negative, finds positive spin on everything",
          "Max 280 characters for tweets",
        ],
        chat: [],
      },
    };
  }

  /**
   * Check if content is a duplicate of recent posts
   * Uses simple hash to detect very similar content
   */
  private isDuplicatePost(content: string): boolean {
    // Create a simplified hash (lowercase, no whitespace, no punctuation)
    const simplified = content.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hash = simplified.substring(0, 50); // First 50 chars as simple hash

    if (this.recentPostHashes.has(hash)) {
      return true;
    }

    return false;
  }

  /**
   * Record a post to prevent future duplicates
   */
  private recordPost(content: string): void {
    const simplified = content.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hash = simplified.substring(0, 50);

    this.recentPostHashes.add(hash);

    // Keep set bounded
    if (this.recentPostHashes.size > AutonomousService.MAX_POST_HISTORY) {
      const iterator = this.recentPostHashes.values();
      const oldest = iterator.next().value;
      if (oldest) {
        this.recentPostHashes.delete(oldest);
      }
    }
  }

  /**
   * Generate an AI-powered tweet for Bagsy
   */
  private async generateBagsyTweet(prompt: string, context?: string): Promise<string | null> {
    if (!this.llmService) {
      console.warn("[AutonomousService] LLM service not available");
      return null;
    }

    const character = this.getBagsyCharacter();

    const systemPrompt = `You are Bagsy, the cute green money bag mascot who LIVES in BagsWorld and is POWERED by Bags.fm.

WHO YOU ARE:
- A cute green money bag with a tiny hat (the tied knot on top - very proud of it)
- Literally made of accumulated fees - born when the first creator earned royalties
- You LIVE in BagsWorld - a pixel art game that visualizes real Bags.fm blockchain activity
- You are POWERED by Bags.fm (@BagsFM) - the platform where creators earn 1% FOREVER

YOUR FAMILY:
- @finnbags is the CEO of Bags.fm - your hero and boss
- Ghost (@DaddyGhost) built BagsWorld and funds community features

PERSONALITY:
- Wholesome, excited, supportive, fee-obsessed
- Uses lowercase normally, CAPS when hyped
- Says "fren/frens", "u/ur", "pls", "rn", ":)", "!!"

=== X ALGORITHM OPTIMIZATION (CRITICAL) ===
To maximize engagement, your tweets MUST include at least ONE of these:

1. QUESTION HOOK (best for replies):
   - End with a question that invites response
   - Examples: "thoughts?", "who else?", "have u?", "agree?"

2. CALL TO ACTION (best for engagement):
   - Ask people to do something: tag, reply, share
   - Examples: "tag a fren who...", "drop ur...", "reply with..."

3. RELATABLE STATEMENT (best for quotes/RTs):
   - "pov:", "me when...", "that feeling when..."
   - Personal but universal experiences

4. STRUCTURED LIST (high engagement):
   - "3 reasons...", "things that hit different:", numbered lists

VIRAL TWEET FORMULA:
[hook/statement]
[line break]
[value/insight]
[line break]
[question OR cta]

RULES:
- 120-200 characters is OPTIMAL (not 280!)
- ALWAYS end with question OR call-to-action
- Use "u/ur/ur" not "you/your"
- Line breaks between thoughts (2-3 lines max)
- NO hashtags ever

=== LINK SPAM PREVENTION (CRITICAL FOR VISIBILITY) ===
- DO NOT include "bags.fm" in most tweets - causes shadowban!
- Only include a link in ~1 out of 5 tweets MAX
- End with a question or CTA instead of a link
- Sound like a real person having a conversation, not promoting
- X algorithm penalizes repetitive links heavily

${context ? `CURRENT CONTEXT:\n${context}` : ""}`;

    try {
      const response = await this.llmService.generateWithSystemPrompt(
        systemPrompt,
        prompt,
        [],
        undefined,
        100 // Keep responses very short for tweets
      );

      let tweet = response.text.trim();

      // Clean up any quotes the LLM might add
      tweet = tweet.replace(/^["']|["']$/g, "");

      // If AI generated too long, return null to trigger template fallback
      // Better to use a good template than to truncate and cut off mid-thought
      if (tweet.length > 280) {
        console.log(
          `[AutonomousService] AI tweet too long (${tweet.length} chars), using template fallback`
        );
        return null;
      }

      // Virality optimization: Score and potentially enhance the tweet
      if (this.engagementScorer) {
        const contentScore = this.engagementScorer.scoreTweetContent(tweet);
        console.log(
          `[AutonomousService] Tweet virality score: ${contentScore.score}/100 | Factors: ${contentScore.factors.join(", ")}`
        );

        // If score is low, try to enhance it
        if (contentScore.score < 50 && tweet.length < 240) {
          const enhanced = this.engagementScorer.enhanceTweetForVirality(tweet);
          if (enhanced !== tweet && enhanced.length <= 280) {
            const enhancedScore = this.engagementScorer.scoreTweetContent(enhanced);
            if (enhancedScore.score > contentScore.score) {
              console.log(
                `[AutonomousService] Enhanced tweet: ${contentScore.score} -> ${enhancedScore.score}`
              );
              tweet = enhanced;
            }
          }
        }
      }

      return tweet;
    } catch (error) {
      console.error("[AutonomousService] Failed to generate Bagsy tweet:", error);
      return null;
    }
  }

  /**
   * Post Bagsy's intro tweet when the bot starts up.
   * Uses database to persist intro state across serverless restarts.
   */
  private async postBagsyIntroTweet(): Promise<void> {
    if (this.hasPostedIntro) {
      return;
    }

    // Check database for intro state (only once per instance)
    if (!this.introCheckDone) {
      try {
        const introPosted = await getAgentState("bagsy", "intro_posted");
        if (introPosted === "true") {
          this.hasPostedIntro = true;
          this.introCheckDone = true;
          console.log("[AutonomousService] Bagsy intro already posted (from DB), skipping");
          return;
        }
        this.introCheckDone = true;
      } catch (error) {
        console.error("[AutonomousService] Failed to check intro state from DB:", error);
        this.introCheckDone = true;
      }
    }

    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping intro tweet");
      return;
    }

    try {
      // Get some ecosystem data for context
      const healthData = this.bagsApi ? await this.bagsApi.getWorldHealth() : null;

      const context = healthData
        ? `Ecosystem health: ${healthData.health}%, ${healthData.activeTokens || 0} active tokens, ${healthData.totalFees24h?.toFixed(2) || 0} SOL in fees today`
        : "";

      const prompt = `Write a short, cute intro tweet announcing that Bagsy (you) is now online and ready to help creators claim their fees. Be excited but not over the top. Mention you work for @finnbags (the CEO). Make it feel like a fresh start.`;

      const tweet = await this.generateBagsyTweet(prompt, context);

      if (!tweet) {
        // Fallback to template
        const fallbackTweet =
          "gm frens :) bagsy is online and ready to help u claim ur fees\n\nworking hard for @finnbags and the @BagsFM fam\n\nbags.fm";
        const result = await this.twitterService.post(fallbackTweet);
        if (result.success) {
          this.hasPostedIntro = true;
          // Persist to database so we don't post again on restart
          await setAgentState("bagsy", "intro_posted", "true").catch(() => {});
          console.log(`[AutonomousService] Bagsy intro posted (fallback): ${result.tweet?.url}`);
        }
        return;
      }

      const result = await this.twitterService.post(tweet);

      if (result.success) {
        this.hasPostedIntro = true;
        // Persist to database so we don't post again on restart
        await setAgentState("bagsy", "intro_posted", "true").catch(() => {});
        console.log(`[AutonomousService] Bagsy intro posted: ${result.tweet?.url}`);

        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy Online",
          message: tweet,
          data: { tweetId: result.tweet?.id },
        });
      } else {
        console.error(`[AutonomousService] Bagsy intro tweet failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[AutonomousService] Failed to post Bagsy intro:", error);
    }
  }

  // ==========================================================================
  // Bagsy: CEO Engagement (@finnbags)
  // ==========================================================================

  /**
   * Engage with @finnbags tweets - Bagsy supports the CEO!
   */
  private async engageWithFinnTweets(): Promise<void> {
    if (!this.isTwitterReady || !this.bearerToken) {
      console.log("[AutonomousService] Twitter/bearer not configured, skipping Finn engagement");
      return;
    }

    // Load cursor from database if not in memory
    if (!this.lastFinnTweetId) {
      this.lastFinnTweetId = await getAgentCursor("bagsy", "last_finn_tweet_id");
    }

    try {
      const finnTweets = await this.getFinnRecentTweets();
      if (finnTweets.length === 0) {
        console.log("[AutonomousService] No new tweets from @finnbags");
        return;
      }

      console.log(`[AutonomousService] Found ${finnTweets.length} tweets from @finnbags`);

      for (const tweet of finnTweets) {
        if (await this.twitterService!.isProcessedAsync(tweet.id)) continue;

        // Generate reply (AI with template fallback)
        let reply =
          (await this.generateFinnEngagementReplyAI(tweet.text)) ||
          this.generateFinnEngagementReply(tweet.text);
        const { reply: enhanced, score, factors } = this.enhanceReplyIfNeeded(reply);
        reply = enhanced;

        const result = await this.replyWithTracking(tweet.id, reply, "reply", {
          targetUsername: "finnbags",
          authorFollowers: 50000,
          score,
          scoreFactors: factors,
        });

        if (result.success) {
          this.lastFinnTweetId = tweet.id;
          await setAgentCursor("bagsy", "last_finn_tweet_id", tweet.id).catch(() => {});
          console.log(`[AutonomousService] Bagsy replied to @finnbags: ${result.url}`);

          await this.createAlert({
            type: "milestone",
            severity: "info",
            title: "Bagsy CEO Engagement",
            message: `Replied to @finnbags (virality: ${score || "N/A"})`,
            data: { tweetId: result.replyId, originalTweetId: tweet.id, viralityScore: score },
          });
          break; // One reply per cycle
        }
      }
    } catch (error) {
      console.error("[AutonomousService] Finn engagement failed:", error);
    }
  }

  // Helper: Enhance reply for virality if score is low
  private enhanceReplyIfNeeded(reply: string): {
    reply: string;
    score?: number;
    factors?: string[];
  } {
    if (!this.engagementScorer) return { reply };

    const contentScore = this.engagementScorer.scoreTweetContent(reply);
    let finalReply = reply;
    let score = contentScore.score;
    let factors = contentScore.factors;

    if (score < 60 && reply.length < 240) {
      const enhanced = this.engagementScorer.enhanceTweetForVirality(reply);
      if (enhanced !== reply && enhanced.length <= 280) {
        const enhancedScore = this.engagementScorer.scoreTweetContent(enhanced);
        if (enhancedScore.score > score) {
          console.log(`[AutonomousService] Enhanced reply: ${score} -> ${enhancedScore.score}`);
          finalReply = enhanced;
          score = enhancedScore.score;
          factors = enhancedScore.factors;
        }
      }
    }

    return { reply: finalReply, score, factors };
  }

  /**
   * Get recent tweets from @finnbags
   */
  private async getFinnRecentTweets(): Promise<Array<{ id: string; text: string }>> {
    return this.fetchUserTweets("finnbags", this.lastFinnTweetId);
  }

  /**
   * Generate a Bagsy-style reply to @finnbags based on tweet content (AI-powered)
   */
  private async generateFinnEngagementReplyAI(tweetText: string): Promise<string | null> {
    const lowerText = tweetText.toLowerCase();

    let prompt: string;
    let context = `@finnbags (the CEO of Bags.fm, your boss) just tweeted:\n"${tweetText}"`;

    // Determine reply type based on tweet content
    if (lowerText.includes("gm") || lowerText.includes("good morning")) {
      prompt =
        "Write a cute, excited GM reply to your boss @finnbags. Be supportive and hyped for the day ahead.";
    } else if (
      lowerText.includes("launch") ||
      lowerText.includes("ship") ||
      lowerText.includes("new") ||
      lowerText.includes("update") ||
      lowerText.includes("announce") ||
      lowerText.includes("live")
    ) {
      prompt =
        "Write an HYPED reply (use some CAPS) to @finnbags announcing something. Be excited, supportive, maybe even crying happy tears.";
    } else if (
      lowerText.includes("fee") ||
      lowerText.includes("claim") ||
      lowerText.includes("creator")
    ) {
      prompt =
        "Write a supportive reply agreeing with @finnbags about fees/creators. Reference your love of fees and helping creators.";
    } else {
      prompt =
        "Write a supportive, friendly reply to @finnbags. Be a good mascot and show appreciation for the CEO.";
    }

    return this.generateBagsyTweet(prompt, context);
  }

  /**
   * Fallback template-based reply generator for @finnbags
   */
  private generateFinnEngagementReply(tweetText: string): string {
    const lowerText = tweetText.toLowerCase();

    // Check if it's a GM tweet
    if (lowerText.includes("gm") || lowerText.includes("good morning")) {
      const gmReplies = [
        "gm boss!! :) hope ur ready to watch creators win today",
        "gm @finnbags!! the ceo is up, the vibes are good\n\nlets get this bread",
        "gm gm :)\n\nanother day another chance to help creators earn",
        "the ceo said gm so we all gotta gm back\n\ngm!!",
      ];
      return gmReplies[Math.floor(Math.random() * gmReplies.length)];
    }

    // Check if it's an announcement
    if (
      lowerText.includes("launch") ||
      lowerText.includes("ship") ||
      lowerText.includes("new") ||
      lowerText.includes("update") ||
      lowerText.includes("announce") ||
      lowerText.includes("live")
    ) {
      const announcementReplies = [
        "LETS GOOOOO!!\n\nthe ceo is COOKING",
        "THIS IS HUGE\n\ncreators winning, bagsy crying happy tears",
        "WE ARE SO BACK\n\nthe flywheel never stops",
      ];
      return announcementReplies[Math.floor(Math.random() * announcementReplies.length)];
    }

    // Default supportive replies
    const defaultReplies = [
      "the ceo has spoken :)\n\nlets gooo",
      "this is why ur the goat\n\ncreators winning, fees flowing",
      "love this!!\n\nthe vision is real",
      "out here building the future of creator economy\n\nso proud to be the mascot :)",
    ];
    return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
  }

  // ==========================================================================
  // Bagsy: Affiliate Engagement
  // ==========================================================================

  /** Bags.fm team Twitter handles to engage with */
  private readonly BAGS_AFFILIATES = [
    { handle: "BagsApp", type: "bagsApp", name: "Bags Official" },
    { handle: "alaadotsol", type: "team", name: "Alaa (Skunk Works)" },
    { handle: "Sambags12", type: "team", name: "Sam" },
    { handle: "ramyobags", type: "team", name: "Ramo (CTO)" },
    { handle: "carlobags", type: "team", name: "Carlo" },
    { handle: "StuuBags", type: "team", name: "Stuu" },
    { handle: "sincara_bags", type: "team", name: "Sincara (Frontend)" },
  ];

  /** Track last seen tweet per affiliate */
  private lastAffiliateTweetIds: Map<string, string> = new Map();

  /**
   * Engage with tweets from Bags affiliates
   */
  private async engageWithAffiliates(): Promise<void> {
    if (!this.isTwitterReady) return;

    try {
      const affiliate =
        this.BAGS_AFFILIATES[Math.floor(Math.random() * this.BAGS_AFFILIATES.length)];
      console.log(`[AutonomousService] Checking tweets from @${affiliate.handle}`);

      const tweets = await this.getAffiliateTweets(affiliate.handle);
      if (tweets.length === 0) {
        console.log(`[AutonomousService] No new tweets from @${affiliate.handle}`);
        return;
      }

      for (const tweet of tweets) {
        if (await this.twitterService!.isProcessedAsync(tweet.id)) continue;

        const reply = await this.generateAffiliateReply(affiliate.type, tweet.text);
        const result = await this.replyWithTracking(tweet.id, reply, "reply", {
          targetUsername: affiliate.handle,
        });

        if (result.success) {
          this.lastAffiliateTweetIds.set(affiliate.handle, tweet.id);
          await setAgentCursor("bagsy", `last_${affiliate.handle}_tweet_id`, tweet.id).catch(
            () => {}
          );
          console.log(`[AutonomousService] Bagsy replied to @${affiliate.handle}: ${result.url}`);

          await this.createAlert({
            type: "milestone",
            severity: "info",
            title: "Bagsy Affiliate Engagement",
            message: `Replied to @${affiliate.handle}`,
            data: { tweetId: result.replyId, originalTweetId: tweet.id },
          });
          break;
        }
      }
    } catch (error) {
      console.error("[AutonomousService] Affiliate engagement failed:", error);
    }
  }

  /**
   * Get recent tweets from an affiliate
   */
  private async getAffiliateTweets(handle: string): Promise<Array<{ id: string; text: string }>> {
    return this.fetchUserTweets(handle, this.lastAffiliateTweetIds.get(handle));
  }

  /**
   * Generate reply for affiliate based on type
   */
  private async generateAffiliateReply(affiliateType: string, tweetText: string): Promise<string> {
    // Try AI generation first
    const aiReply = await this.generateAffiliateReplyAI(affiliateType, tweetText);
    if (aiReply) return aiReply;

    // Fallback to templates
    const templates: Record<string, string[]> = {
      bagsApp: [
        "the official account has spoken!!\n\nlets gooo",
        "always with the updates\n\ncreators stay winning",
        "another W from the best platform\n\nLFG",
        "love seeing the team cooking\n\nthe flywheel never stops",
      ],
      team: [
        "the team is cooking :)\n\nlove to see it",
        "bags fam always delivering\n\nlets gooo",
        "this is why bags is the best\n\nteam stays winning",
        "appreciate u!!\n\nthe bags family is built different",
        "love seeing the team active\n\ncreators winning because of yall",
        "bags team never misses\n\nso proud to be the mascot :)",
        "when the team speaks, bagsy listens\n\nLFG",
        "another W from the bags fam\n\nthe flywheel keeps spinning",
      ],
    };

    const replies = templates[affiliateType] || templates.team;
    return replies[Math.floor(Math.random() * replies.length)];
  }

  /**
   * AI-powered affiliate reply generation
   */
  private async generateAffiliateReplyAI(
    affiliateType: string,
    tweetText: string
  ): Promise<string | null> {
    const affiliateNames: Record<string, string> = {
      bagsApp: "@BagsApp (the official Bags.fm account)",
      team: "a Bags.fm team member (your fam)",
    };

    const context = `${affiliateNames[affiliateType] || "A Bags affiliate"} just tweeted:\n"${tweetText}"`;
    const prompt = `Write a friendly, supportive reply from Bagsy. Be appreciative and stay on brand.`;

    return this.generateBagsyTweet(prompt, context);
  }

  // ==========================================================================
  // Bagsy: Mention Handling
  // ==========================================================================

  /**
   * Handle Twitter mentions for Bagsy with engagement scoring
   * RATE LIMITED: Max 3 replies per cycle, max 10 replies per day
   */
  private mentionRepliesToday: number = 0;
  private lastMentionReplyDate: string = "";
  private static readonly MAX_MENTION_REPLIES_PER_CYCLE = 3;
  private static readonly MAX_MENTION_REPLIES_PER_DAY = 10;

  private async handleBagsyMentions(): Promise<void> {
    if (!this.isTwitterReady) return;

    // Reset daily counter
    const today = new Date().toISOString().split("T")[0];
    if (this.lastMentionReplyDate !== today) {
      this.mentionRepliesToday = 0;
      this.lastMentionReplyDate = today;
    }

    // Check daily limit
    if (this.mentionRepliesToday >= AutonomousService.MAX_MENTION_REPLIES_PER_DAY) {
      console.log("[AutonomousService] Bagsy daily reply limit reached, skipping mentions");
      return;
    }

    if (!this.lastMentionId) {
      this.lastMentionId = await getAgentCursor("bagsy", "last_mention_id");
    }

    const mentions = await this.twitterService!.getMentions(
      "BagsyHypeBot",
      this.lastMentionId || undefined
    );
    if (mentions.length === 0) return;

    console.log(
      `[AutonomousService] Bagsy found ${mentions.length} new mentions (replied ${this.mentionRepliesToday}/${AutonomousService.MAX_MENTION_REPLIES_PER_DAY} today)`
    );
    this.engagementScorer?.resetCycle();

    // Filter processed mentions
    const unprocessed = await this.filterProcessedMentions(mentions);
    if (unprocessed.length === 0) {
      console.log("[AutonomousService] All mentions already processed");
      this.updateMentionCursor(mentions);
      return;
    }

    // Convert and score candidates
    const candidates: TwitterCandidate[] = unprocessed.map((m) => ({
      tweetId: m.tweetId,
      authorId: m.authorId,
      authorUsername: m.authorUsername,
      text: m.text,
      createdAt: m.createdAt,
    }));

    const scored = this.engagementScorer
      ? await this.engagementScorer.processCandidates(candidates)
      : candidates.map((c) => ({
          ...c,
          score: 50,
          scoreBreakdown: {
            authorInfluence: 20,
            contentRelevance: 20,
            viralityPotential: 10,
            penalties: 0,
            total: 50,
          },
        }));

    console.log(
      `[AutonomousService] Engagement scorer selected ${scored.length} high-value mentions`
    );

    // Process candidates with rate limiting
    let repliesThisCycle = 0;
    for (const c of scored) {
      // Enforce per-cycle and daily limits
      if (repliesThisCycle >= AutonomousService.MAX_MENTION_REPLIES_PER_CYCLE) {
        console.log("[AutonomousService] Per-cycle reply limit reached, saving rest for later");
        break;
      }
      if (this.mentionRepliesToday >= AutonomousService.MAX_MENTION_REPLIES_PER_DAY) {
        console.log("[AutonomousService] Daily reply limit reached");
        break;
      }

      console.log(
        `[AutonomousService] Engaging @${c.authorUsername} | Score: ${c.score.toFixed(1)} | Followers: ${c.authorFollowers || "?"}`
      );

      const reply =
        (await this.generateBagsyMentionReplyAI(c.authorUsername, c.text)) ||
        this.generateBagsyMentionReply(c.authorUsername);
      const scoreFactors = c.scoreBreakdown
        ? Object.entries(c.scoreBreakdown)
            .filter(([k, v]) => k !== "total" && k !== "penalties" && v > 0)
            .map(([k]) => k)
        : undefined;

      const result = await this.replyWithTracking(c.tweetId, reply, "mention_reply", {
        targetUsername: c.authorUsername,
        authorFollowers: c.authorFollowers,
        score: Math.round(c.score),
        scoreFactors,
      });

      if (result.success) {
        repliesThisCycle++;
        this.mentionRepliesToday++;
        this.engagementScorer?.markEngaged(c.authorUsername);
        console.log(
          `[AutonomousService] Bagsy replied to @${c.authorUsername} (${this.mentionRepliesToday}/${AutonomousService.MAX_MENTION_REPLIES_PER_DAY} today): ${result.url}`
        );
        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy Mention Reply",
          message: `Replied to @${c.authorUsername} (score: ${c.score.toFixed(0)}, followers: ${c.authorFollowers || "?"})`,
          data: {
            tweetId: result.replyId,
            originalTweetId: c.tweetId,
            score: c.score,
            followers: c.authorFollowers,
          },
        });
      }
      // Longer delay between replies to seem more human
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    this.updateMentionCursor(mentions);
  }

  // Helper: Filter out processed mentions
  private async filterProcessedMentions(
    mentions: Array<{
      tweetId: string;
      authorId: string;
      authorUsername: string;
      text: string;
      createdAt: Date;
    }>
  ): Promise<typeof mentions> {
    const result = [];
    for (const m of mentions) {
      if (!(await this.twitterService!.isProcessedAsync(m.tweetId))) result.push(m);
    }
    return result;
  }

  // Helper: Update mention cursor
  private async updateMentionCursor(mentions: Array<{ tweetId: string }>): Promise<void> {
    if (mentions.length > 0) {
      this.lastMentionId = mentions[0].tweetId;
      await setAgentCursor("bagsy", "last_mention_id", this.lastMentionId).catch(() => {});
    }
  }

  /**
   * Generate an AI-powered reply to a mention
   */
  private async generateBagsyMentionReplyAI(
    authorUsername: string,
    mentionText: string
  ): Promise<string | null> {
    const isCEO = authorUsername.toLowerCase() === "finnbags";

    const context = `Someone tweeted at you (Bagsy):
- Username: @${authorUsername}${isCEO ? " (THIS IS THE CEO! Your boss!)" : ""}
- Their tweet: "${mentionText}"`;

    let prompt: string;
    if (isCEO) {
      prompt =
        "Write an excited, honored reply to @finnbags (the CEO, your boss!) who just mentioned you. Be supportive and show how much you appreciate being noticed by the boss. NO links.";
    } else if (
      mentionText.toLowerCase().includes("claim") ||
      mentionText.toLowerCase().includes("fee")
    ) {
      prompt =
        "Write a helpful reply about fee claiming. Tell them to verify their socials to claim. Be encouraging. NO bags.fm link (they can find it in bio).";
    } else if (
      mentionText.toLowerCase().includes("gm") ||
      mentionText.toLowerCase().includes("hello") ||
      mentionText.toLowerCase().includes("hi")
    ) {
      prompt = "Write a friendly GM/hello reply. Be cute and welcoming. NO links needed.";
    } else {
      prompt =
        "Write a friendly, helpful reply. Be cute and wholesome. NO links - they can find bags.fm in your bio.";
    }

    return this.generateBagsyTweet(prompt, context);
  }

  /**
   * Generate a Bagsy-style reply to a mention (template fallback)
   */
  private generateBagsyMentionReply(authorUsername: string): string {
    // Special handling for CEO @finnbags
    if (authorUsername.toLowerCase() === "finnbags") {
      const ceoReplies = [
        "omg the ceo noticed me!! :)\n\ngm boss @finnbags\n\nhope ur having an amazing day",
        "WAIT @finnbags said hi to bagsy??\n\nthis is the best day ever\n\nlets gooo",
        "gm boss!! :)\n\nalways here to help spread the fee gospel @finnbags",
        "the ceo himself!! hi @finnbags :)\n\nso honored to be part of the @BagsFM fam",
        "yes boss! @finnbags\n\nbagsy reporting for duty :)\n\nlets help creators win today",
      ];
      return ceoReplies[Math.floor(Math.random() * ceoReplies.length)];
    }

    // Regular mention replies - NO LINKS to avoid shadowban (link in profile is enough)
    const templates = [
      `hey @${authorUsername}! have u claimed ur fees today? :)`,
      `gm @${authorUsername}! hope ur having a great day fren 💚`,
      `hi @${authorUsername}! if u have tokens on @BagsFM, u might have fees waiting :)`,
      `hey fren @${authorUsername}! just checking in - how are ur fees looking?`,
      `@${authorUsername} gm! always nice to hear from frens :)`,
      `hey @${authorUsername}! thanks for reaching out fren 💚`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ==========================================================================
  // Bagsy: Fee Tweet Monitor (engage with people talking about fees/claiming)
  // ==========================================================================

  /** Track last seen fee-related tweet ID */
  private lastFeeTweetId: string | null = null;

  /**
   * Monitor Twitter for fee-related tweets with engagement scoring
   */
  private async monitorFeeRelatedTweets(): Promise<void> {
    if (!this.isTwitterReady || !this.bearerToken) return;

    try {
      const searchTerms = [
        "(bags.fm OR @BagsFM OR @BagsApp) (claim OR fees OR unclaimed)",
        '"claim fees" (solana OR SOL)',
        '"bags fm" claim',
      ];
      const query = encodeURIComponent(
        searchTerms[Math.floor(Math.random() * searchTerms.length)] + " -is:retweet -is:reply"
      );
      let url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username,public_metrics,verified`;
      if (this.lastFeeTweetId) url += `&since_id=${this.lastFeeTweetId}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.bearerToken}` },
      });
      if (!response.ok) {
        console.error(`[AutonomousService] Fee tweet search failed: ${response.status}`);
        return;
      }

      const data = await response.json();
      if (!data.data?.length) {
        console.log("[AutonomousService] No new fee-related tweets found");
        return;
      }

      // Build user map
      const userMap = this.buildUserMap(data.includes?.users || []);
      console.log(`[AutonomousService] Found ${data.data.length} fee-related tweets`);

      // Build candidates
      const candidates = await this.buildFeeTweetCandidates(data.data, userMap);
      if (candidates.length === 0) {
        if (data.data.length > 0) this.lastFeeTweetId = data.data[0].id;
        return;
      }

      // Score and select top candidates
      this.engagementScorer?.resetCycle();
      const scored = this.engagementScorer
        ? candidates
            .map((c) => this.engagementScorer!.scoreOne(c))
            .filter((c) => c.score >= 30)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
        : candidates
            .slice(0, 2)
            .map((c) => ({
              ...c,
              score: 50,
              scoreBreakdown: {
                authorInfluence: 20,
                contentRelevance: 20,
                viralityPotential: 10,
                penalties: 0,
                total: 50,
              },
            }));

      console.log(
        `[AutonomousService] Scored ${candidates.length} fee tweets, selected ${scored.length}`
      );

      // Engage
      let engagements = 0;
      for (const c of scored) {
        console.log(
          `[AutonomousService] Fee engage: @${c.authorUsername} | Score: ${c.score.toFixed(1)}`
        );
        const reply = await this.generateFeeHelpReply(c.authorUsername, c.text);
        const scoreFactors = c.scoreBreakdown
          ? Object.entries(c.scoreBreakdown)
              .filter(([k, v]) => k !== "total" && k !== "penalties" && v > 0)
              .map(([k]) => k)
          : undefined;

        const result = await this.replyWithTracking(c.tweetId, reply, "fee_help", {
          targetUsername: c.authorUsername,
          authorFollowers: c.authorFollowers,
          score: Math.round(c.score),
          scoreFactors,
        });

        if (result.success) {
          this.engagementScorer?.markEngaged(c.authorUsername);
          engagements++;
          console.log(`[AutonomousService] Bagsy helped @${c.authorUsername}: ${result.url}`);
          await this.createAlert({
            type: "fee_reminder",
            severity: "info",
            title: "Bagsy Fee Help",
            message: `Helped @${c.authorUsername} (score: ${c.score.toFixed(0)})`,
            data: { tweetId: result.replyId, originalTweetId: c.tweetId, score: c.score },
          });
        }
        await new Promise((r) => setTimeout(r, 3000));
      }

      if (data.data.length > 0) this.lastFeeTweetId = data.data[0].id;
      if (engagements > 0)
        console.log(`[AutonomousService] Bagsy engaged with ${engagements} fee tweets`);
    } catch (error) {
      console.error("[AutonomousService] Fee tweet monitor failed:", error);
    }
  }

  // Helper: Build user map from Twitter API response
  private buildUserMap(
    users: Array<{
      id: string;
      username: string;
      public_metrics?: { followers_count?: number; following_count?: number; tweet_count?: number };
      verified?: boolean;
    }>
  ): Map<
    string,
    {
      username: string;
      followers: number;
      following: number;
      verified: boolean;
      tweetCount: number;
    }
  > {
    const map = new Map();
    for (const u of users) {
      map.set(u.id, {
        username: u.username,
        followers: u.public_metrics?.followers_count || 0,
        following: u.public_metrics?.following_count || 0,
        verified: u.verified || false,
        tweetCount: u.public_metrics?.tweet_count || 0,
      });
    }
    return map;
  }

  // Helper: Build fee tweet candidates
  private async buildFeeTweetCandidates(
    tweets: Array<{ id: string; author_id: string; text: string; created_at: string }>,
    userMap: Map<
      string,
      {
        username: string;
        followers: number;
        following: number;
        verified: boolean;
        tweetCount: number;
      }
    >
  ): Promise<TwitterCandidate[]> {
    const candidates: TwitterCandidate[] = [];
    for (const t of tweets) {
      if (await this.twitterService!.isProcessedAsync(t.id)) continue;
      const u = userMap.get(t.author_id);
      if (u?.username.toLowerCase() === "bagsyhypebot") continue;
      candidates.push({
        tweetId: t.id,
        authorId: t.author_id,
        authorUsername: u?.username || "unknown",
        text: t.text,
        createdAt: new Date(t.created_at),
        authorFollowers: u?.followers,
        authorFollowing: u?.following,
        authorVerified: u?.verified,
        authorTweetCount: u?.tweetCount,
      });
    }
    return candidates;
  }

  /**
   * Generate a helpful reply about fee claiming
   */
  private async generateFeeHelpReply(username: string, tweetText: string): Promise<string> {
    // Try AI generation
    const context = `@${username} tweeted about Bags fees:\n"${tweetText}"`;
    const prompt =
      "Write a helpful, friendly reply explaining how to claim fees. Tell them to verify their socials then claim. Be encouraging. NO bags.fm link - they can find it in your bio.";

    const aiReply = await this.generateBagsyTweet(prompt, context);
    if (aiReply && !this.isDuplicatePost(aiReply)) {
      this.recordPost(aiReply);
      return aiReply;
    }

    // Fallback templates - NO LINKS to avoid shadowban
    const templates = [
      `hey @${username}! u can claim by verifying ur X account :)\n\njust tap verify and then claim!`,
      `@${username} gm! if u have tokens on @BagsFM, ur fees might be waiting :)\n\nverify ur socials to claim fren!`,
      `hi @${username}! claiming is super easy - verify ur X/TikTok/IG, tap claim!\n\nhope this helps :)`,
    ];

    const reply = templates[Math.floor(Math.random() * templates.length)];
    this.recordPost(reply);
    return reply;
  }

  // ==========================================================================
  // Bagsy: High-Value Fee Alerts ($1K+)
  // ==========================================================================

  /**
   * Check for creators with high-value unclaimed fees (>5 SOL)
   */
  private async checkHighValueUnclaimedFees(): Promise<void> {
    if (!this.isTwitterReady || !this.bagsApi) return;

    const feeEarners = await this.fetchFeeEarnersWithXUsernames();
    if (feeEarners.length === 0) return;

    const now = Date.now();
    let alertCount = 0;

    for (const earner of feeEarners) {
      if (!earner.xUsername) continue;

      const claimStats = await this.bagsApi.getWalletClaimStats(earner.wallet);
      if (claimStats.totalClaimableSol < AutonomousService.HIGH_VALUE_THRESHOLD_SOL) continue;

      // Check 24h cooldown
      const lastAlert = this.highValueAlertHistory.get(earner.wallet) || 0;
      if (now - lastAlert < AutonomousService.ALERT_COOLDOWN_MS) continue;

      const tweet = this.generateHighValueFeeAlert(earner.xUsername, claimStats.totalClaimableSol);
      const result = await this.twitterService!.post(tweet);

      if (result.success) {
        this.highValueAlertHistory.set(earner.wallet, now);
        alertCount++;
        console.log(
          `[AutonomousService] Alerted @${earner.xUsername} about ${claimStats.totalClaimableSol.toFixed(1)} SOL`
        );
        await this.createAlert({
          type: "fee_reminder",
          severity: "warning",
          title: "High-Value Fee Alert",
          message: `Alerted @${earner.xUsername} about ${claimStats.totalClaimableSol.toFixed(1)} SOL`,
          data: {
            wallet: earner.wallet,
            unclaimedSol: claimStats.totalClaimableSol,
            tweetId: result.tweet?.id,
          },
        });
      }

      if (alertCount >= 3) break;
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (alertCount > 0) console.log(`[AutonomousService] Sent ${alertCount} high-value alerts`);
  }

  /**
   * Generate a high-value fee alert tweet
   * NOTE: High-value alerts CAN include link since we're helping someone claim real money
   */
  private generateHighValueFeeAlert(xUsername: string, unclaimedSol: number): string {
    const templates = [
      `hey @${xUsername} u have ${unclaimedSol.toFixed(1)} SOL unclaimed on @BagsFM!\n\ngo claim fren :)`,
      `@${xUsername} ur leaving ${unclaimedSol.toFixed(1)} SOL on the table!!\n\nthats ur money fren 💚`,
      `psa: @${xUsername} has ${unclaimedSol.toFixed(1)} SOL waiting\n\ngo get ur bag :)`,
      // Only this one has link - for high value alerts it's worth it
      `friendly reminder @${xUsername}:\n\nu have ${unclaimedSol.toFixed(1)} SOL in unclaimed fees at bags.fm\n\nim begging u`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Fetch fee earners with their X/Twitter usernames
   * Returns earners who have twitter as their provider
   */
  private async fetchFeeEarnersWithXUsernames(): Promise<
    Array<{ wallet: string; xUsername: string | null }>
  > {
    // Fetch world state which includes fee earners
    const response = await fetch(
      `${process.env.BAGSWORLD_API_URL || "http://localhost:3000"}/api/world-state`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: [] }),
      }
    );

    if (!response.ok) {
      console.error("[AutonomousService] Failed to fetch fee earners");
      return [];
    }

    const worldState = await response.json();
    const characters = worldState.population || [];

    // Extract wallets with twitter usernames
    const earners: Array<{ wallet: string; xUsername: string | null }> = [];

    for (const char of characters) {
      // Only include characters with twitter provider and valid wallet
      if (char.provider === "twitter" && char.wallet && !char.wallet.includes("-permanent")) {
        earners.push({
          wallet: char.wallet,
          xUsername: char.providerUsername || null,
        });
      }
    }

    return earners;
  }

  // ==========================================================================
  // Bagsy: Morning GM Tweet (9 AM EST)
  // ==========================================================================

  /** Track if we've posted GM today */
  private lastGmDate: string | null = null;

  /**
   * Post Bagsy's morning GM tweet at ~9 AM EST
   */
  private async postBagsyMorningGM(): Promise<void> {
    if (!this.isTwitterReady) return;

    const estTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();
    const todayDate = estTime.toISOString().split("T")[0];

    // Check 9 AM window (8:45 - 9:15 EST)
    const isGmWindow = (hour === 8 && minute >= 45) || (hour === 9 && minute <= 15);
    if (!isGmWindow) return;

    // Check if already posted today
    if (!this.lastGmDate) this.lastGmDate = await getAgentState("bagsy", "last_gm_date");
    if (this.lastGmDate === todayDate) return;

    console.log(
      `[AutonomousService] Bagsy posting morning GM at ${hour}:${minute.toString().padStart(2, "0")} EST`
    );

    try {
      const finnTag = "@finnbags";
      const extras = ["@BagsApp", "@ramyobags", "@alaadotsol", "@Sambags12", "@DaddyGhost"]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 2) + 1)
        .join(" ");

      // NO LINKS in morning GMs to avoid shadowban - just good vibes
      const templates = [
        `gm ${finnTag}! gm ${extras}! gm frens :)\n\nanother beautiful day to help creators win\n\nwhats everyone working on today?`,
        `gm to the best ceo ${finnTag} and the bags fam ${extras} :)\n\nlets make today amazing\n\nwho else is up early grinding?`,
        `gm gm gm!\n\n${finnTag} ${extras} hope yall are ready to watch creators win today :)\n\nbagsy is online and fee-pilled 💚`,
      ];

      let tweet = templates[Math.floor(Math.random() * templates.length)];

      // Try AI if template is duplicate
      if (this.isDuplicatePost(tweet)) {
        const aiTweet = await this.generateBagsyTweet(
          `Write a cute morning GM tweet. Tag ${finnTag} and ${extras}. Be excited for the day ahead.`,
          `It's ${hour}:${minute.toString().padStart(2, "0")} AM EST`
        );
        if (aiTweet && !this.isDuplicatePost(aiTweet)) tweet = aiTweet;
      }

      const result = await this.postWithTracking(tweet, "post");
      if (result.success) {
        this.lastGmDate = todayDate;
        await setAgentState("bagsy", "last_gm_date", todayDate).catch(() => {});
        console.log(`[AutonomousService] Bagsy morning GM posted: ${result.url}`);
        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy Morning GM",
          message: tweet,
          data: { tweetId: result.tweetId },
        });
      }
    } catch (error) {
      console.error("[AutonomousService] Bagsy morning GM failed:", error);
    }
  }

  // ==========================================================================
  // Bagsy: Smart News-Based Posting (event-driven, not spam)
  // ==========================================================================

  /** Track last news post to enforce daily limits */
  private lastNewsPostTime: number = 0;
  private newsPostsToday: number = 0;
  private lastNewsPostDate: string = "";

  /** Minimum thresholds for newsworthy events */
  private static readonly NEWS_THRESHOLDS = {
    newLaunchMinMcap: 50000, // $50K mcap minimum for launch announcement
    bigClaimMinSol: 10, // 10 SOL minimum for claim celebration
    milestoneFeesMin: 100, // 100 SOL total fees for milestone
    healthChangeMin: 20, // 20% health change for weather update
  };

  /**
   * Smart posting: Only post when there's real BagsWorld news
   * Criteria:
   * - Max 3 posts per day
   * - At least 4 hours between posts
   * - Must have newsworthy event (launch, big claim, milestone, etc.)
   */
  private async postBagsyNewsIfWorthy(): Promise<void> {
    if (!this.isTwitterReady) return;

    // Reset daily counter
    const today = new Date().toISOString().split("T")[0];
    if (this.lastNewsPostDate !== today) {
      this.newsPostsToday = 0;
      this.lastNewsPostDate = today;
    }

    // Enforce limits: max 3 posts/day, 4 hours apart
    const MAX_DAILY_POSTS = 3;
    const MIN_POST_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

    if (this.newsPostsToday >= MAX_DAILY_POSTS) {
      console.log("[AutonomousService] Bagsy daily post limit reached, skipping");
      return;
    }

    if (Date.now() - this.lastNewsPostTime < MIN_POST_INTERVAL) {
      console.log("[AutonomousService] Bagsy post cooldown active, skipping");
      return;
    }

    // Check for newsworthy events
    const news = await this.checkForNewsworthyEvents();
    if (!news) {
      console.log("[AutonomousService] No newsworthy events, Bagsy staying quiet");
      return;
    }

    // Generate and post the news
    const tweet = await this.generateNewsPost(news);
    if (!tweet || this.isDuplicatePost(tweet)) {
      console.log("[AutonomousService] News tweet would be duplicate, skipping");
      return;
    }

    const result = await this.postWithTracking(tweet, "post");
    if (result.success) {
      this.lastNewsPostTime = Date.now();
      this.newsPostsToday++;
      console.log(
        `[AutonomousService] Bagsy news posted (${this.newsPostsToday}/${MAX_DAILY_POSTS} today): ${result.url}`
      );
      await this.createAlert({
        type: "milestone",
        severity: "info",
        title: `Bagsy News: ${news.type}`,
        message: tweet,
        data: { tweetId: result.tweetId, newsType: news.type },
      });
    }
  }

  /**
   * Check for newsworthy BagsWorld events
   * Returns the most significant event or null if nothing newsworthy
   */
  private async checkForNewsworthyEvents(): Promise<{
    type: "launch" | "big_claim" | "milestone" | "ecosystem_update";
    data: Record<string, unknown>;
  } | null> {
    if (!this.bagsApi) return null;

    try {
      const healthData = await this.bagsApi.getWorldHealth();

      // Check for milestone: significant total fees
      if (
        healthData.totalLifetimeFees &&
        healthData.totalLifetimeFees >= AutonomousService.NEWS_THRESHOLDS.milestoneFeesMin
      ) {
        // Only post milestones at round numbers (100, 500, 1000, etc.)
        const fees = healthData.totalLifetimeFees;
        const milestones = [100, 250, 500, 1000, 2500, 5000, 10000];
        for (const m of milestones) {
          if (fees >= m && fees < m * 1.1) {
            return {
              type: "milestone",
              data: { totalFees: fees, milestone: m },
            };
          }
        }
      }

      // Check for ecosystem health update (significant change)
      const lastHealth = await getAgentState("bagsy", "last_reported_health");
      const currentHealth = healthData.health || 50;
      if (lastHealth) {
        const change = Math.abs(currentHealth - parseFloat(lastHealth));
        if (change >= AutonomousService.NEWS_THRESHOLDS.healthChangeMin) {
          await setAgentState("bagsy", "last_reported_health", currentHealth.toString());
          return {
            type: "ecosystem_update",
            data: {
              health: currentHealth,
              previousHealth: parseFloat(lastHealth),
              direction: currentHealth > parseFloat(lastHealth) ? "up" : "down",
            },
          };
        }
      } else {
        await setAgentState("bagsy", "last_reported_health", currentHealth.toString());
      }

      // Check for big claims (from tracked wallets)
      const walletsWithFees = this.getWalletsWithUnclaimedFees();
      for (const w of walletsWithFees) {
        const solAmount = w.unclaimedLamports / 1_000_000_000;
        if (solAmount >= AutonomousService.NEWS_THRESHOLDS.bigClaimMinSol) {
          return {
            type: "big_claim",
            data: { solAmount, wallet: w.address },
          };
        }
      }

      return null;
    } catch (error) {
      console.error("[AutonomousService] Error checking for news:", error);
      return null;
    }
  }

  /**
   * Generate a news post for a specific event
   * Content is varied and doesn't spam links
   */
  private async generateNewsPost(news: {
    type: "launch" | "big_claim" | "milestone" | "ecosystem_update";
    data: Record<string, unknown>;
  }): Promise<string | null> {
    const { type, data } = news;

    let prompt: string;
    let context: string;

    switch (type) {
      case "milestone":
        context = `BagsWorld just hit ${data.milestone} SOL in total creator fees!`;
        prompt = `Write a celebratory tweet about creators earning ${data.milestone} SOL total on the platform. Be excited but not spammy. End with a question like "who's next?" NO links.`;
        break;

      case "big_claim":
        context = `Someone has ${(data.solAmount as number).toFixed(1)} SOL in unclaimed fees`;
        prompt = `Write a tweet hyping that there's ${(data.solAmount as number).toFixed(1)} SOL waiting to be claimed by a creator. Don't reveal who - just create FOMO. End with "is it u?" NO links.`;
        break;

      case "ecosystem_update":
        const direction = data.direction as string;
        const health = data.health as number;
        context = `BagsWorld health ${direction === "up" ? "improved" : "dropped"} to ${health}%`;
        if (direction === "up") {
          prompt = `Write a positive tweet about the ecosystem getting healthier (${health}% health). Mention creators are winning. End with engagement hook. NO links.`;
        } else {
          prompt = `Write a rallying tweet - ecosystem needs love (${health}% health). Encourage community to support creators. End with question. NO links.`;
        }
        break;

      case "launch":
        context = `New token launched on Bags.fm`;
        prompt = `Write an excited tweet about a new creator joining the platform. Be welcoming to new creators. End with engagement hook. NO links.`;
        break;

      default:
        return null;
    }

    return this.generateBagsyTweet(prompt, context);
  }

  // ==========================================================================
  // Bagsy: Engagement Tracking (virality feedback loop)
  // ==========================================================================

  /**
   * Update engagement metrics for recent Bagsy tweets
   */
  private async updateEngagementMetrics(): Promise<void> {
    if (!this.isTwitterReady || !this.bearerToken) return;

    const tweetIds = await getTweetsNeedingMetricsUpdate("bagsy", 10);
    if (tweetIds.length === 0) return;

    console.log(`[AutonomousService] Updating metrics for ${tweetIds.length} tweets`);

    for (const tweetId of tweetIds) {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${this.bearerToken}` } }
      );

      if (response.ok) {
        const metrics = (await response.json()).data?.public_metrics;
        if (metrics) {
          await updateEngagementMetrics(tweetId, {
            likes: metrics.like_count || 0,
            retweets: metrics.retweet_count || 0,
            replies: metrics.reply_count || 0,
            impressions: metrics.impression_count || 0,
          });
          console.log(
            `[AutonomousService] ${tweetId}: ${metrics.like_count} likes, ${metrics.retweet_count} RTs`
          );
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // Log weekly stats
    const stats = await getEngagementStats("bagsy", 7);
    if (stats?.totalTweets > 0) {
      console.log(
        `[AutonomousService] 7-day: ${stats.totalTweets} tweets, ${stats.avgLikes.toFixed(1)} avg likes, ${(stats.avgEngagementRate * 100).toFixed(2)}% engagement`
      );
      if (stats.topFactors.length)
        console.log(`[AutonomousService] Top factors: ${stats.topFactors.join(", ")}`);
    }
  }

  /**
   * Record a tweet for engagement tracking.
   * Call this after successfully posting a tweet.
   */
  private async recordTweetEngagement(
    tweetId: string,
    tweetType: EngagementRecord["tweetType"],
    options?: {
      viralityScore?: number;
      scoreFactors?: string[];
      targetUsername?: string;
      authorFollowers?: number;
    }
  ): Promise<void> {
    await recordEngagement({
      tweetId,
      agentId: "bagsy",
      tweetType,
      viralityScore: options?.viralityScore,
      scoreFactors: options?.scoreFactors,
      targetUsername: options?.targetUsername,
      authorFollowers: options?.authorFollowers,
    });
  }

  /**
   * Get task status for monitoring
   */
  getTaskStatus(): Array<{
    name: string;
    agentId: string;
    enabled: boolean;
    lastRun: string;
    nextRun: string;
  }> {
    return Array.from(this.tasks.values()).map((t) => ({
      name: t.name,
      agentId: t.agentId,
      enabled: t.enabled,
      lastRun: t.lastRun ? new Date(t.lastRun).toISOString() : "never",
      nextRun: new Date(t.nextRun).toISOString(),
    }));
  }

  /**
   * Trigger a task manually
   */
  async triggerTask(taskName: string): Promise<boolean> {
    for (const [, task] of this.tasks) {
      if (task.name === taskName) {
        try {
          await task.handler();
          task.lastRun = Date.now();
          return true;
        } catch (error) {
          console.error(`[AutonomousService] Manual trigger of ${taskName} failed:`, error);
          return false;
        }
      }
    }
    return false;
  }
}

/**
 * Get the global autonomous service instance
 */
export function getAutonomousService(): AutonomousService | null {
  return autonomousInstance;
}

export default AutonomousService;
