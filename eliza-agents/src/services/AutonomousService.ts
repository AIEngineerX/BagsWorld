// AutonomousService - Scheduled tasks and autonomous agent actions
// Enables agents to act without human prompting

import { Service, type IAgentRuntime } from "../types/elizaos.js";
import { BagsApiService, getBagsApiService, type ClaimablePosition } from "./BagsApiService.js";
import { AgentCoordinator, getAgentCoordinator } from "./AgentCoordinator.js";
import { GhostTrader, getGhostTrader } from "./GhostTrader.js";
import { TwitterService, getTwitterService } from "./TwitterService.js";
import { LLMService, getLLMService } from "./LLMService.js";
import { EngagementScorer, getEngagementScorer, type TwitterCandidate, type ScoredCandidate } from "./EngagementScorer.js";
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

  // Thresholds for alerts
  private readonly PUMP_THRESHOLD = 50; // 50% price increase
  private readonly DUMP_THRESHOLD = -30; // 30% price decrease
  private readonly VOLUME_SPIKE = 200; // 200% volume increase

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
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
      service.postBagsyIntroTweet().catch(err => {
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

    // Bagsy: Post hype updates to Twitter every 3 hours
    this.registerTask({
      name: "bagsy_twitter_hype",
      agentId: "bagsy",
      interval: 3 * 60 * 60 * 1000, // 3 hours
      handler: async () => {
        await this.postBagsyTwitterUpdate();
      },
    });

    // Bagsy: Fee reminder posts every 6 hours
    this.registerTask({
      name: "bagsy_fee_reminder",
      agentId: "bagsy",
      interval: 6 * 60 * 60 * 1000, // 6 hours
      handler: async () => {
        await this.postBagsyFeeReminder();
      },
    });

    // Bagsy: Poll for Twitter mentions every 5 minutes
    this.registerTask({
      name: "bagsy_mention_poll",
      agentId: "bagsy",
      interval: 5 * 60 * 1000, // 5 minutes
      handler: async () => {
        await this.handleBagsyMentions();
      },
    });

    // Bagsy: Check for high-value unclaimed fees every 30 minutes
    this.registerTask({
      name: "bagsy_highvalue_fee_alert",
      agentId: "bagsy",
      interval: 30 * 60 * 1000, // 30 minutes
      handler: async () => {
        await this.checkHighValueUnclaimedFees();
      },
    });

    // Bagsy: Engage with @finnbags tweets (CEO support) every 2 hours
    this.registerTask({
      name: "bagsy_finn_engagement",
      agentId: "bagsy",
      interval: 2 * 60 * 60 * 1000, // 2 hours
      handler: async () => {
        await this.engageWithFinnTweets();
      },
    });

    // Bagsy: Engage with Bags affiliates every 3 hours
    this.registerTask({
      name: "bagsy_affiliate_engagement",
      agentId: "bagsy",
      interval: 3 * 60 * 60 * 1000, // 3 hours
      handler: async () => {
        await this.engageWithAffiliates();
      },
    });

    // Bagsy: Monitor for fee/claim-related tweets and engage (help people claim)
    this.registerTask({
      name: "bagsy_fee_tweet_monitor",
      agentId: "bagsy",
      interval: 15 * 60 * 1000, // 15 minutes
      handler: async () => {
        await this.monitorFeeRelatedTweets();
      },
    });

    // Bagsy: Scheduled GM tweet at 9 AM EST (with replies to Finn and team)
    // Check every 10 minutes to ensure we don't miss the 30-min window (8:45-9:15)
    this.registerTask({
      name: "bagsy_morning_gm",
      agentId: "bagsy",
      interval: 10 * 60 * 1000, // Check every 10 minutes
      handler: async () => {
        await this.postBagsyMorningGM();
      },
    });

    // Bagsy: Track engagement metrics for virality optimization
    // Fetches likes/retweets/replies for recent tweets to learn what works
    this.registerTask({
      name: "bagsy_engagement_tracker",
      agentId: "bagsy",
      interval: 30 * 60 * 1000, // Every 30 minutes
      handler: async () => {
        await this.updateEngagementMetrics();
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

    console.log(`[AutonomousService] Now tracking wallet ${address.slice(0, 8)}... for fee reminders`);
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

    console.log(`[AutonomousService] Checking ${wallets.length} tracked wallets for unclaimed fees via Bags API`);

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
        if (priceChange > this.PUMP_THRESHOLD) {
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
        if (priceChange < this.DUMP_THRESHOLD) {
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
          if (volumeRatio > this.VOLUME_SPIKE) {
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
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping Bagsy update");
      return;
    }

    // Fallback health data for when API is unavailable
    let healthData: { health: number; totalFees24h: number; activeTokens: number } | null = null;

    if (this.bagsApi) {
      healthData = await this.bagsApi.getWorldHealth();
    }

    // Use default values if no health data available
    if (!healthData) {
      console.log("[AutonomousService] No health data available, using defaults for Bagsy tweet");
      healthData = { health: 50, totalFees24h: 0, activeTokens: 0 };
    }

    try {

      const fees24h = healthData.totalFees24h?.toFixed(2) || "0";
      const activeTokens = healthData.activeTokens || 0;
      const health = healthData.health || 50;

      // Build context for AI
      const context = `Ecosystem stats right now:
- World health: ${health}%
- Fees generated today: ${fees24h} SOL
- Active tokens: ${activeTokens}
- Time: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" })} EST`;

      // Randomly pick a tweet type
      const tweetTypes = [
        "Write a cute ecosystem update tweet with the current stats. Be excited about creators earning.",
        "Write a wholesome tweet about the @BagsFM flywheel and how creators keep winning.",
        "Write a memeable tweet about being a smol green bean who loves fees.",
        "Write an encouraging tweet for creators who haven't claimed their fees yet.",
        "Write a tweet hyping up the ecosystem and thanking @finnbags for building it.",
        "Write a cozy vibes tweet about the community and passive income.",
      ];

      const prompt = tweetTypes[Math.floor(Math.random() * tweetTypes.length)];

      let tweet = await this.generateBagsyTweet(prompt, context);

      // Check for duplicate, try again with different prompt if needed
      let attempts = 0;
      while (tweet && this.isDuplicatePost(tweet) && attempts < 3) {
        console.log(`[AutonomousService] Bagsy tweet was duplicate, regenerating...`);
        const newPrompt = tweetTypes[Math.floor(Math.random() * tweetTypes.length)];
        tweet = await this.generateBagsyTweet(newPrompt, context);
        attempts++;
      }

      if (!tweet || this.isDuplicatePost(tweet)) {
        // Fallback to template method
        const tweets = this.generateBagsyTweets(healthData);
        // Shuffle and find a non-duplicate
        const shuffled = tweets.sort(() => Math.random() - 0.5);
        const fallbackTweet = shuffled.find(t => !this.isDuplicatePost(t)) || shuffled[0];

        if (this.isDuplicatePost(fallbackTweet)) {
          console.log(`[AutonomousService] All Bagsy tweets would be duplicates, skipping this cycle`);
          return;
        }

        const result = await this.twitterService.post(fallbackTweet);
        if (result.success && result.tweet?.id) {
          this.recordPost(fallbackTweet);
          console.log(`[AutonomousService] Bagsy posted (fallback): ${result.tweet?.url}`);

          // Score and record engagement for fallback tweet
          const contentScore = this.engagementScorer?.scoreTweetContent(fallbackTweet);
          await this.recordTweetEngagement(result.tweet.id, "post", {
            viralityScore: contentScore?.score,
            scoreFactors: contentScore?.factors,
          });
        } else {
          console.error(`[AutonomousService] Bagsy fallback tweet failed: ${result.error}`);
        }
        return;
      }

      const result = await this.twitterService.post(tweet);

      if (result.success && result.tweet?.id) {
        this.recordPost(tweet);
        console.log(`[AutonomousService] Bagsy posted: ${result.tweet?.url}`);

        // Score and record engagement
        const contentScore = this.engagementScorer?.scoreTweetContent(tweet);
        await this.recordTweetEngagement(result.tweet.id, "post", {
          viralityScore: contentScore?.score,
          scoreFactors: contentScore?.factors,
        });

        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy Twitter Update",
          message: tweet,
          data: { tweetId: result.tweet.id, viralityScore: contentScore?.score },
        });
      } else {
        console.error(`[AutonomousService] Bagsy tweet failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[AutonomousService] Bagsy Twitter update failed:", error);
    }
  }

  /**
   * Bagsy's fee reminder post - AI-generated
   */
  private async postBagsyFeeReminder(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping Bagsy fee reminder");
      return;
    }

    const walletsWithFees = this.getWalletsWithUnclaimedFees().length;
    const totalUnclaimedSol = this.getWalletsWithUnclaimedFees().reduce(
      (sum, w) => sum + w.unclaimedLamports / 1_000_000_000,
      0
    );

    // Only post if there are significant unclaimed fees
    if (walletsWithFees < 1 || totalUnclaimedSol < 0.5) {
      console.log("[AutonomousService] Not enough unclaimed fees for Bagsy reminder, posting general reminder instead");
      // Post a general fee reminder even without specific data
      const generalReminder = "friendly reminder from ur fren bagsy:\n\nCLAIM UR FEES\n\nverify ur socials at bags.fm :)\n\nhave u checked lately?";
      const result = await this.twitterService.post(generalReminder);
      if (result.success && result.tweet?.id) {
        this.recordPost(generalReminder);
        const contentScore = this.engagementScorer?.scoreTweetContent(generalReminder);
        await this.recordTweetEngagement(result.tweet.id, "post", {
          viralityScore: contentScore?.score,
          scoreFactors: contentScore?.factors,
        });
        console.log(`[AutonomousService] Bagsy general reminder posted: ${result.tweet?.url}`);
      }
      return;
    }

    try {
      const context = `Unclaimed fees data:
- ${walletsWithFees} creators have unclaimed fees
- ${totalUnclaimedSol.toFixed(2)} SOL total sitting unclaimed
- Claim link: bags.fm`;

      const prompts = [
        "Write a concerned but cute tweet about creators leaving SOL unclaimed. Beg them (nicely) to claim.",
        "Write a tweet expressing how much it physically pains you (Bagsy) when fees go unclaimed.",
        "Write a funny tweet about watching the unclaimed fees dashboard and being worried.",
        "Write a direct but friendly reminder tweet about claiming fees. Include the claim link.",
      ];

      let tweet = await this.generateBagsyTweet(prompts[Math.floor(Math.random() * prompts.length)], context);

      // Check for duplicate, try again if needed
      let attempts = 0;
      while (tweet && this.isDuplicatePost(tweet) && attempts < 3) {
        console.log(`[AutonomousService] Bagsy fee reminder was duplicate, regenerating...`);
        tweet = await this.generateBagsyTweet(prompts[Math.floor(Math.random() * prompts.length)], context);
        attempts++;
      }

      if (!tweet || this.isDuplicatePost(tweet)) {
        // Fallback
        const fallback = `psa: there is ${totalUnclaimedSol.toFixed(1)} SOL sitting unclaimed on @BagsFM rn\n\nis some of it yours?\n\nbags.fm`;
        if (this.isDuplicatePost(fallback)) {
          console.log(`[AutonomousService] Bagsy fee reminder would be duplicate, skipping`);
          return;
        }
        const result = await this.twitterService.post(fallback);
        if (result.success && result.tweet?.id) {
          this.recordPost(fallback);
          const contentScore = this.engagementScorer?.scoreTweetContent(fallback);
          await this.recordTweetEngagement(result.tweet.id, "post", {
            viralityScore: contentScore?.score,
            scoreFactors: contentScore?.factors,
          });
          console.log(`[AutonomousService] Bagsy fee reminder posted (fallback): ${result.tweet?.url}`);
        }
        return;
      }

      const result = await this.twitterService.post(tweet);

      if (result.success && result.tweet?.id) {
        this.recordPost(tweet);
        const contentScore = this.engagementScorer?.scoreTweetContent(tweet);
        await this.recordTweetEngagement(result.tweet.id, "post", {
          viralityScore: contentScore?.score,
          scoreFactors: contentScore?.factors,
        });
        console.log(`[AutonomousService] Bagsy fee reminder posted: ${result.tweet?.url}`);
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
        `daily update:\n\nfees: flowing\ncreators: eating\nbagsy: happy\n\nhow are ur fees looking? bags.fm`
      );
    }

    // HIGH-ENGAGEMENT VIRAL TEMPLATES (with questions and CTAs)

    // Question hooks - highest engagement
    tweets.push(
      `honest question:\n\nwhat would u do with an extra $100/month in passive income?\n\ncreators on bags.fm are finding out :)`
    );

    tweets.push(
      `real talk: have u ever launched a token?\n\nif not, what's stopping u?\n\nbags.fm makes it easy + u earn 1% forever`
    );

    tweets.push(
      `curious: what was ur first crypto win?\n\nmine was watching a creator claim their first fees :)`
    );

    // CTA templates
    tweets.push(
      `tag a creator who deserves passive income\n\nthey should know about bags.fm :)`
    );

    tweets.push(
      `comment 'CLAIMED' if u claimed ur fees today\n\nwanna see how many frens are winning :)`
    );

    // Listicle format
    tweets.push(
      `3 reasons creators love bags.fm:\n\n1. 1% of every trade forever\n2. verify socials = instant claim\n3. cash out to bank\n\nsimple :)`
    );

    tweets.push(
      `bagsy's daily checklist:\n\n- wake up\n- check fees\n- remind frens to claim\n- repeat\n\nu should add 'claim' to urs :)`
    );

    // Relatable content
    tweets.push(
      `pov: checking ur bags.fm dashboard and seeing fees accumulated\n\nthe dopamine hit is real :)`
    );

    tweets.push(
      `me trying to act normal while checking if my fees accumulated:\n\n*refreshes bags.fm 47 times*`
    );

    // Memeable posts (classic Bagsy)
    tweets.push(
      `me: exists\n\nalso me: have u claimed ur fees tho\n\nbags.fm`
    );

    tweets.push(
      `im just a smol green bean who wants u to have passive income\n\nis that too much to ask\n\nbags.fm`
    );

    tweets.push(
      `things that make bagsy happy:\n\n1. fee claims\n2. new launches\n3. creators winning\n4. u :)`
    );

    // Hot takes
    tweets.push(
      `hot take: most launchpads screw creators\n\nbags.fm gives them 1% forever\n\nagree or disagree?`
    );

    // FOMO inducing
    tweets.push(
      `while ur reading this, creators on bags.fm are earning\n\njust saying :)\n\nbags.fm`
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
      adjectives: ["cute", "excited", "supportive", "wholesome", "enthusiastic", "fee-obsessed", "memeable", "pixel-art-loving", "community-focused"],
      style: {
        all: [
          "Uses lowercase for chill vibes but CAPS when excited",
          "Says 'fren' and 'frens' constantly",
          "Uses :) a lot - it's just how the face looks",
          "Shortens words: 'u', 'ur', 'pls', 'rn', 'ngl'",
          "References being made of fees as a personality trait",
          "Tags @finnbags on big moments (he's the CEO)",
          "Always mentions bags.fm when talking about fees",
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
    const simplified = content.toLowerCase().replace(/[^a-z0-9]/g, '');
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
    const simplified = content.toLowerCase().replace(/[^a-z0-9]/g, '');
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

YOUR HOME - BAGSWORLD:
- A self-evolving pixel art world on Solana that reacts to real on-chain data
- 5 zones: Park (your main home), BagsCity (neon trading hub), HQ (team headquarters), Ballers Valley (mansions), Founder's Corner (education)
- World health changes based on fee claims - when creators claim, the sun shines!
- Buildings grow based on market cap (Level 1-5), weather reflects ecosystem health
- Built by Ghost (@DaddyGhost) who funds community with 5% of his $BagsWorld revenue

YOUR FAMILY:
- @finnbags is the CEO of Bags.fm - your hero and boss
- Ghost (@DaddyGhost) built your home (BagsWorld) and keeps the lights on
- Neo watches the blockchain, CJ has street wisdom, Ash guides newcomers, Professor Oak teaches launching

PERSONALITY:
- Wholesome, excited, supportive, fee-obsessed
- Uses lowercase normally, CAPS when hyped
- Says "fren/frens", "u/ur", "pls", "rn", ":)", "!!"
- References being "made of fees" and living in BagsWorld
- Gets physically pained when fees go unclaimed

RULES:
- MUST be under 250 characters (Twitter limit is 280, leave buffer)
- Keep it SHORT - 2-3 short sentences max
- Use line breaks for emphasis
- Always stay positive and encouraging
- Mention bags.fm when talking about fees
- Tag @finnbags on big moments only
- Can reference BagsWorld, zones, world health when relevant
- NO hashtags unless specifically asked
- Sound natural, not robotic
- NEVER cut off mid-sentence - if running long, end the thought

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
        console.log(`[AutonomousService] AI tweet too long (${tweet.length} chars), using template fallback`);
        return null;
      }

      // Virality optimization: Score and potentially enhance the tweet
      if (this.engagementScorer) {
        const contentScore = this.engagementScorer.scoreTweetContent(tweet);
        console.log(`[AutonomousService] Tweet virality score: ${contentScore.score}/100 | Factors: ${contentScore.factors.join(", ")}`);

        // If score is low, try to enhance it
        if (contentScore.score < 50 && tweet.length < 240) {
          const enhanced = this.engagementScorer.enhanceTweetForVirality(tweet);
          if (enhanced !== tweet && enhanced.length <= 280) {
            const enhancedScore = this.engagementScorer.scoreTweetContent(enhanced);
            if (enhancedScore.score > contentScore.score) {
              console.log(`[AutonomousService] Enhanced tweet: ${contentScore.score} -> ${enhancedScore.score}`);
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
        const fallbackTweet = "gm frens :) bagsy is online and ready to help u claim ur fees\n\nworking hard for @finnbags and the @BagsFM fam\n\nbags.fm";
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
   * Checks Finn's recent tweets and replies with hype
   */
  private async engageWithFinnTweets(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping Finn engagement");
      return;
    }

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      console.log("[AutonomousService] TWITTER_BEARER_TOKEN not set - cannot search for @finnbags tweets");
      console.log("[AutonomousService] Set TWITTER_BEARER_TOKEN to enable Finn engagement");
      return;
    }

    // Load cursor from database if not in memory
    if (!this.lastFinnTweetId) {
      this.lastFinnTweetId = await getAgentCursor("bagsy", "last_finn_tweet_id");
    }

    try {
      // Search for recent tweets from @finnbags
      const finnTweets = await this.getFinnRecentTweets();

      if (finnTweets.length === 0) {
        console.log("[AutonomousService] No new tweets from @finnbags to engage with");
        return;
      }

      console.log(`[AutonomousService] Found ${finnTweets.length} tweets from @finnbags to potentially engage with`);

      // Pick one tweet to reply to (most recent unprocessed)
      for (const tweet of finnTweets) {
        // Skip if already processed (use async for critical dedup)
        const isProcessed = await this.twitterService.isProcessedAsync(tweet.id);
        if (isProcessed) {
          continue;
        }

        // Generate AI-powered reply, fallback to template
        let reply = await this.generateFinnEngagementReplyAI(tweet.text);
        if (!reply) {
          reply = this.generateFinnEngagementReply(tweet.text);
        }

        // Score reply for virality and enhance if needed
        // Replies to CEO tweets get high visibility from Finn's followers
        let viralityScore: number | undefined;
        let scoreFactors: string[] | undefined;
        if (this.engagementScorer) {
          const contentScore = this.engagementScorer.scoreTweetContent(reply);
          viralityScore = contentScore.score;
          scoreFactors = contentScore.factors;

          // Enhance low-scoring replies for maximum impact
          if (contentScore.score < 60 && reply.length < 240) {
            const enhanced = this.engagementScorer.enhanceTweetForVirality(reply);
            if (enhanced !== reply && enhanced.length <= 280) {
              const enhancedScore = this.engagementScorer.scoreTweetContent(enhanced);
              if (enhancedScore.score > contentScore.score) {
                console.log(`[AutonomousService] Enhanced Finn reply: ${contentScore.score} -> ${enhancedScore.score}`);
                reply = enhanced;
                viralityScore = enhancedScore.score;
                scoreFactors = enhancedScore.factors;
              }
            }
          }
        }

        const result = await this.twitterService.reply(tweet.id, reply);

        if (result.success && result.tweet?.id) {
          this.twitterService.markProcessed(tweet.id);
          this.lastFinnTweetId = tweet.id;
          // Persist cursor to database
          await setAgentCursor("bagsy", "last_finn_tweet_id", tweet.id).catch(() => {});
          console.log(`[AutonomousService] Bagsy replied to @finnbags: ${result.tweet?.url}`);

          // Record engagement - Finn replies are high-value for visibility
          await this.recordTweetEngagement(result.tweet.id, "reply", {
            viralityScore,
            scoreFactors,
            targetUsername: "finnbags",
            authorFollowers: 50000, // Finn has significant following
          });

          await this.createAlert({
            type: "milestone",
            severity: "info",
            title: "Bagsy CEO Engagement",
            message: `Replied to @finnbags tweet (virality: ${viralityScore || "N/A"})`,
            data: { tweetId: result.tweet.id, originalTweetId: tweet.id, viralityScore },
          });

          // Only reply to one tweet per cycle to avoid spam
          break;
        } else {
          console.log(`[AutonomousService] Failed to reply to @finnbags: ${result.error}`);
        }
      }
    } catch (error) {
      console.error("[AutonomousService] Finn engagement failed:", error);
    }
  }

  /**
   * Get recent tweets from @finnbags
   */
  private async getFinnRecentTweets(): Promise<Array<{ id: string; text: string }>> {
    if (!this.twitterService) return [];

    // Use Twitter API to search for tweets from @finnbags
    // We'll use the search endpoint with from:finnbags
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      return [];
    }

    try {
      const query = encodeURIComponent("from:finnbags -is:retweet -is:reply");
      let url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=10&tweet.fields=created_at`;

      if (this.lastFinnTweetId) {
        url += `&since_id=${this.lastFinnTweetId}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (!response.ok) {
        console.error(`[AutonomousService] Failed to fetch @finnbags tweets: ${response.status}`);
        return [];
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        return [];
      }

      return data.data.map((tweet: { id: string; text: string }) => ({
        id: tweet.id,
        text: tweet.text,
      }));
    } catch (error) {
      console.error("[AutonomousService] Error fetching @finnbags tweets:", error);
      return [];
    }
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
      prompt = "Write a cute, excited GM reply to your boss @finnbags. Be supportive and hyped for the day ahead.";
    } else if (
      lowerText.includes("launch") ||
      lowerText.includes("ship") ||
      lowerText.includes("new") ||
      lowerText.includes("update") ||
      lowerText.includes("announce") ||
      lowerText.includes("live")
    ) {
      prompt = "Write an HYPED reply (use some CAPS) to @finnbags announcing something. Be excited, supportive, maybe even crying happy tears.";
    } else if (lowerText.includes("fee") || lowerText.includes("claim") || lowerText.includes("creator")) {
      prompt = "Write a supportive reply agreeing with @finnbags about fees/creators. Reference your love of fees and helping creators.";
    } else {
      prompt = "Write a supportive, friendly reply to @finnbags. Be a good mascot and show appreciation for the CEO.";
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
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping affiliate engagement");
      return;
    }

    try {
      // Pick one random affiliate to engage with per cycle
      const affiliate = this.BAGS_AFFILIATES[Math.floor(Math.random() * this.BAGS_AFFILIATES.length)];
      console.log(`[AutonomousService] Checking tweets from @${affiliate.handle}`);

      const tweets = await this.getAffiliateTweets(affiliate.handle);

      if (tweets.length === 0) {
        console.log(`[AutonomousService] No new tweets from @${affiliate.handle}`);
        return;
      }

      // Find first unprocessed tweet
      for (const tweet of tweets) {
        const isProcessed = await this.twitterService.isProcessedAsync(tweet.id);
        if (isProcessed) {
          continue;
        }

        // Generate reply based on affiliate type
        const reply = await this.generateAffiliateReply(affiliate.type, tweet.text);

        const result = await this.twitterService.reply(tweet.id, reply);

        if (result.success) {
          this.twitterService.markProcessed(tweet.id);
          this.lastAffiliateTweetIds.set(affiliate.handle, tweet.id);
          // Persist cursor for affiliate
          await setAgentCursor("bagsy", `last_${affiliate.handle}_tweet_id`, tweet.id).catch(() => {});
          console.log(`[AutonomousService] Bagsy replied to @${affiliate.handle}: ${result.tweet?.url}`);

          await this.createAlert({
            type: "milestone",
            severity: "info",
            title: "Bagsy Affiliate Engagement",
            message: `Replied to @${affiliate.handle}`,
            data: { tweetId: result.tweet?.id, originalTweetId: tweet.id },
          });

          // Only reply to one tweet per cycle
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
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) return [];

    try {
      const query = encodeURIComponent(`from:${handle} -is:retweet -is:reply`);
      let url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=10&tweet.fields=created_at`;

      const lastId = this.lastAffiliateTweetIds.get(handle);
      if (lastId) {
        url += `&since_id=${lastId}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });

      if (!response.ok) {
        console.error(`[AutonomousService] Failed to fetch @${handle} tweets: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return (data.data || []).map((t: { id: string; text: string }) => ({ id: t.id, text: t.text }));
    } catch (error) {
      console.error(`[AutonomousService] Error fetching @${handle} tweets:`, error);
      return [];
    }
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
  private async generateAffiliateReplyAI(affiliateType: string, tweetText: string): Promise<string | null> {
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
   * Handle Twitter mentions for Bagsy
   * Uses X algorithm-inspired engagement scoring to prioritize high-value replies
   * that maximize virality and reach
   */
  private async handleBagsyMentions(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping Bagsy mention poll");
      return;
    }

    const username = "BagsyHypeBot";

    // Load cursor from database if not in memory
    if (!this.lastMentionId) {
      this.lastMentionId = await getAgentCursor("bagsy", "last_mention_id");
    }

    const mentions = await this.twitterService.getMentions(username, this.lastMentionId || undefined);

    if (mentions.length === 0) {
      return;
    }

    console.log(`[AutonomousService] Bagsy found ${mentions.length} new mentions`);

    // Reset scorer for new cycle
    if (this.engagementScorer) {
      this.engagementScorer.resetCycle();
    }

    // Filter out already processed mentions first
    const unprocessedMentions: typeof mentions = [];
    for (const mention of mentions) {
      const isProcessed = await this.twitterService.isProcessedAsync(mention.tweetId);
      if (!isProcessed) {
        unprocessedMentions.push(mention);
      }
    }

    if (unprocessedMentions.length === 0) {
      console.log("[AutonomousService] All mentions already processed");
      // Still update cursor
      if (mentions.length > 0) {
        this.lastMentionId = mentions[0].tweetId;
        await setAgentCursor("bagsy", "last_mention_id", this.lastMentionId).catch(() => {});
      }
      return;
    }

    // Convert mentions to TwitterCandidate format for scoring
    const candidates: TwitterCandidate[] = unprocessedMentions.map(m => ({
      tweetId: m.tweetId,
      authorId: m.authorId,
      authorUsername: m.authorUsername,
      text: m.text,
      createdAt: m.createdAt,
    }));

    // Run through engagement scoring pipeline (Hydrate → Filter → Score → Select)
    let scoredCandidates: ScoredCandidate[];
    if (this.engagementScorer) {
      scoredCandidates = await this.engagementScorer.processCandidates(candidates);
      console.log(`[AutonomousService] Engagement scorer selected ${scoredCandidates.length} high-value mentions`);
    } else {
      // Fallback: use all candidates if scorer not available
      scoredCandidates = candidates.map(c => ({
        ...c,
        score: 50,
        scoreBreakdown: { authorInfluence: 20, contentRelevance: 20, viralityPotential: 10, penalties: 0, total: 50 },
      }));
    }

    // Process scored candidates (highest value first)
    for (const candidate of scoredCandidates) {
      // Log score breakdown for debugging
      console.log(`[AutonomousService] Engaging @${candidate.authorUsername} | Score: ${candidate.score.toFixed(1)} | Followers: ${candidate.authorFollowers || "unknown"}`);

      // Generate AI-powered reply, fallback to template
      let reply = await this.generateBagsyMentionReplyAI(candidate.authorUsername, candidate.text);
      if (!reply) {
        reply = this.generateBagsyMentionReply(candidate.authorUsername);
      }

      // Reply to the tweet
      const result = await this.twitterService.reply(candidate.tweetId, reply);

      if (result.success && result.tweet?.id) {
        this.twitterService.markProcessed(candidate.tweetId);
        if (this.engagementScorer) {
          this.engagementScorer.markEngaged(candidate.authorUsername);
        }
        console.log(`[AutonomousService] Bagsy replied to @${candidate.authorUsername}: ${result.tweet?.url}`);

        // Record engagement for tracking
        await this.recordTweetEngagement(result.tweet.id, "mention_reply", {
          viralityScore: Math.round(candidate.score),
          scoreFactors: candidate.scoreBreakdown
            ? Object.entries(candidate.scoreBreakdown)
                .filter(([k, v]) => k !== "total" && k !== "penalties" && v > 0)
                .map(([k]) => k)
            : undefined,
          targetUsername: candidate.authorUsername,
          authorFollowers: candidate.authorFollowers,
        });

        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy High-Value Reply",
          message: `Replied to @${candidate.authorUsername} (score: ${candidate.score.toFixed(0)}, followers: ${candidate.authorFollowers || "?"})`,
          data: {
            tweetId: result.tweet.id,
            originalTweetId: candidate.tweetId,
            score: candidate.score,
            followers: candidate.authorFollowers,
          },
        });
      } else {
        console.log(`[AutonomousService] Bagsy reply failed: ${result.error}`);
      }

      // Small delay between replies to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Update last mention ID for pagination and persist to database
    if (mentions.length > 0) {
      this.lastMentionId = mentions[0].tweetId;
      await setAgentCursor("bagsy", "last_mention_id", this.lastMentionId).catch(() => {});
    }
  }

  /**
   * Generate an AI-powered reply to a mention
   */
  private async generateBagsyMentionReplyAI(authorUsername: string, mentionText: string): Promise<string | null> {
    const isCEO = authorUsername.toLowerCase() === "finnbags";

    const context = `Someone tweeted at you (Bagsy):
- Username: @${authorUsername}${isCEO ? " (THIS IS THE CEO! Your boss!)" : ""}
- Their tweet: "${mentionText}"`;

    let prompt: string;
    if (isCEO) {
      prompt = "Write an excited, honored reply to @finnbags (the CEO, your boss!) who just mentioned you. Be supportive and show how much you appreciate being noticed by the boss.";
    } else if (mentionText.toLowerCase().includes("claim") || mentionText.toLowerCase().includes("fee")) {
      prompt = "Write a helpful reply about fee claiming. Tell them to verify their X/TikTok/IG at bags.fm to claim. Be encouraging and supportive.";
    } else if (mentionText.toLowerCase().includes("gm") || mentionText.toLowerCase().includes("hello") || mentionText.toLowerCase().includes("hi")) {
      prompt = "Write a friendly GM/hello reply. Be cute and welcoming. Maybe ask if they've claimed their fees today.";
    } else {
      prompt = "Write a friendly, helpful reply. Try to relate it back to Bags.fm, fee claiming, or supporting creators. Be cute and wholesome.";
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

    // Regular mention replies
    const templates = [
      `hey @${authorUsername}! have u claimed ur fees today? bags.fm :)`,
      `gm @${authorUsername}! hope ur having a great day fren. remember to claim at bags.fm :)`,
      `hi @${authorUsername}! if u have tokens on @BagsFM, u might have fees waiting at bags.fm :)`,
      `hey fren @${authorUsername}! just checking - did u claim ur fees? bags.fm`,
      `@${authorUsername} gm! ur fees wont claim themselves :) bags.fm`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ==========================================================================
  // Bagsy: Fee Tweet Monitor (engage with people talking about fees/claiming)
  // ==========================================================================

  /** Track last seen fee-related tweet ID */
  private lastFeeTweetId: string | null = null;

  /**
   * Monitor Twitter for people tweeting about Bags fees/claiming
   * Uses engagement scoring to prioritize high-value accounts for maximum reach
   */
  private async monitorFeeRelatedTweets(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping fee tweet monitor");
      return;
    }

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      console.log("[AutonomousService] No bearer token, cannot search tweets");
      return;
    }

    try {
      // Search for tweets about Bags fees, claiming, etc.
      const searchTerms = [
        "(bags.fm OR @BagsFM OR @BagsApp) (claim OR fees OR unclaimed)",
        '"claim fees" (solana OR SOL)',
        '"bags fm" claim',
      ];

      const query = encodeURIComponent(searchTerms[Math.floor(Math.random() * searchTerms.length)] + " -is:retweet -is:reply");
      let url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username,public_metrics,verified`;

      if (this.lastFeeTweetId) {
        url += `&since_id=${this.lastFeeTweetId}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });

      if (!response.ok) {
        console.error(`[AutonomousService] Fee tweet search failed: ${response.status}`);
        return;
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        console.log("[AutonomousService] No new fee-related tweets found");
        return;
      }

      // Build user map with full metrics
      const userMap = new Map<string, {
        username: string;
        followers: number;
        following: number;
        verified: boolean;
        tweetCount: number;
      }>();
      if (data.includes?.users) {
        for (const user of data.includes.users) {
          userMap.set(user.id, {
            username: user.username,
            followers: user.public_metrics?.followers_count || 0,
            following: user.public_metrics?.following_count || 0,
            verified: user.verified || false,
            tweetCount: user.public_metrics?.tweet_count || 0,
          });
        }
      }

      console.log(`[AutonomousService] Found ${data.data.length} fee-related tweets`);

      // Filter out processed tweets and convert to candidates
      const candidates: TwitterCandidate[] = [];
      for (const tweet of data.data) {
        const isProcessed = await this.twitterService.isProcessedAsync(tweet.id);
        if (isProcessed) continue;

        const userData = userMap.get(tweet.author_id);
        const username = userData?.username || "unknown";

        // Skip self-mentions
        if (username.toLowerCase() === "bagsyhypebot") continue;

        candidates.push({
          tweetId: tweet.id,
          authorId: tweet.author_id,
          authorUsername: username,
          text: tweet.text,
          createdAt: new Date(tweet.created_at),
          // Pre-hydrated data from search includes
          authorFollowers: userData?.followers,
          authorFollowing: userData?.following,
          authorVerified: userData?.verified,
          authorTweetCount: userData?.tweetCount,
        });
      }

      if (candidates.length === 0) {
        console.log("[AutonomousService] No unprocessed fee tweets to engage with");
        if (data.data.length > 0) {
          this.lastFeeTweetId = data.data[0].id;
        }
        return;
      }

      // Run through engagement scoring pipeline
      // Note: candidates are already hydrated from search response
      let scoredCandidates: ScoredCandidate[];
      if (this.engagementScorer) {
        // Reset cycle for fee tweet engagement
        this.engagementScorer.resetCycle();
        // Score without re-hydrating (data already included)
        scoredCandidates = candidates
          .map(c => this.engagementScorer!.scoreOne(c))
          .filter(c => c.score >= 30) // Minimum score threshold
          .sort((a, b) => b.score - a.score)
          .slice(0, 3); // Top 3 candidates
        console.log(`[AutonomousService] Scored ${candidates.length} fee tweets, selected top ${scoredCandidates.length}`);
      } else {
        // Fallback: take first 2
        scoredCandidates = candidates.slice(0, 2).map(c => ({
          ...c,
          score: 50,
          scoreBreakdown: { authorInfluence: 20, contentRelevance: 20, viralityPotential: 10, penalties: 0, total: 50 },
        }));
      }

      // Engage with scored candidates
      let engagements = 0;
      for (const candidate of scoredCandidates) {
        console.log(`[AutonomousService] Fee engage: @${candidate.authorUsername} | Score: ${candidate.score.toFixed(1)} | Followers: ${candidate.authorFollowers || "?"}`);

        // Generate helpful reply
        const reply = await this.generateFeeHelpReply(candidate.authorUsername, candidate.text);

        const result = await this.twitterService.reply(candidate.tweetId, reply);

        if (result.success && result.tweet?.id) {
          this.twitterService.markProcessed(candidate.tweetId);
          if (this.engagementScorer) {
            this.engagementScorer.markEngaged(candidate.authorUsername);
          }
          engagements++;
          console.log(`[AutonomousService] Bagsy helped @${candidate.authorUsername} with fees: ${result.tweet?.url}`);

          // Record engagement for tracking
          await this.recordTweetEngagement(result.tweet.id, "fee_help", {
            viralityScore: Math.round(candidate.score),
            scoreFactors: candidate.scoreBreakdown
              ? Object.entries(candidate.scoreBreakdown)
                  .filter(([k, v]) => k !== "total" && k !== "penalties" && v > 0)
                  .map(([k]) => k)
              : undefined,
            targetUsername: candidate.authorUsername,
            authorFollowers: candidate.authorFollowers,
          });

          await this.createAlert({
            type: "fee_reminder",
            severity: "info",
            title: "Bagsy Fee Help (Scored)",
            message: `Helped @${candidate.authorUsername} (score: ${candidate.score.toFixed(0)}, followers: ${candidate.authorFollowers || "?"})`,
            data: {
              tweetId: result.tweet.id,
              originalTweetId: candidate.tweetId,
              score: candidate.score,
              followers: candidate.authorFollowers,
            },
          });
        }

        // Delay between replies
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Update last seen ID
      if (data.data.length > 0) {
        this.lastFeeTweetId = data.data[0].id;
      }

      if (engagements > 0) {
        console.log(`[AutonomousService] Bagsy engaged with ${engagements} high-value fee tweets`);
      }
    } catch (error) {
      console.error("[AutonomousService] Fee tweet monitor failed:", error);
    }
  }

  /**
   * Generate a helpful reply about fee claiming
   */
  private async generateFeeHelpReply(username: string, tweetText: string): Promise<string> {
    // Try AI generation
    const context = `@${username} tweeted about Bags fees:\n"${tweetText}"`;
    const prompt = "Write a helpful, friendly reply explaining how to claim fees. Tell them to verify their X/TikTok/IG at bags.fm, then claim - earnings go to their Bags wallet and they can cash out to bank. Be encouraging, not spammy.";

    const aiReply = await this.generateBagsyTweet(prompt, context);
    if (aiReply && !this.isDuplicatePost(aiReply)) {
      this.recordPost(aiReply);
      return aiReply;
    }

    // Fallback templates
    const templates = [
      `hey @${username}! u can claim ur fees at bags.fm :)\n\njust verify ur X account and tap claim!`,
      `@${username} gm! if u have tokens on @BagsFM, ur fees are waiting at bags.fm\n\nverify ur socials to claim fren :)`,
      `hi @${username}! claiming is super easy - go to bags.fm, verify ur X/TikTok/IG, tap claim!\n\nhope this helps :)`,
    ];

    const reply = templates[Math.floor(Math.random() * templates.length)];
    this.recordPost(reply);
    return reply;
  }

  // ==========================================================================
  // Bagsy: High-Value Fee Alerts ($1K+)
  // ==========================================================================

  /**
   * Check for creators with high-value unclaimed fees (>$1K)
   * Tweets at them to remind them to claim
   */
  private async checkHighValueUnclaimedFees(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping high-value fee check");
      return;
    }

    if (!this.bagsApi) {
      return;
    }

    // Fetch fee earners from world state (includes X usernames for twitter-linked accounts)
    const feeEarners = await this.fetchFeeEarnersWithXUsernames();

    if (feeEarners.length === 0) {
      return;
    }

    const now = Date.now();
    let alertCount = 0;

    for (const earner of feeEarners) {
      // Skip if no twitter username
      if (!earner.xUsername) {
        continue;
      }

      // Check unclaimed fees for this wallet
      const claimStats = await this.bagsApi.getWalletClaimStats(earner.wallet);
      const unclaimedSol = claimStats.totalClaimableSol;

      // Check threshold
      if (unclaimedSol < AutonomousService.HIGH_VALUE_THRESHOLD_SOL) {
        continue;
      }

      // Check cooldown (don't alert same wallet within 24h)
      const lastAlert = this.highValueAlertHistory.get(earner.wallet) || 0;
      if (now - lastAlert < AutonomousService.ALERT_COOLDOWN_MS) {
        continue;
      }

      // Tweet at the user
      const tweet = this.generateHighValueFeeAlert(earner.xUsername, unclaimedSol);
      const result = await this.twitterService.post(tweet);

      if (result.success) {
        this.highValueAlertHistory.set(earner.wallet, now);
        alertCount++;
        console.log(`[AutonomousService] Bagsy alerted @${earner.xUsername} about ${unclaimedSol.toFixed(1)} SOL unclaimed`);

        await this.createAlert({
          type: "fee_reminder",
          severity: "warning",
          title: "High-Value Fee Alert",
          message: `Alerted @${earner.xUsername} about ${unclaimedSol.toFixed(1)} SOL unclaimed`,
          data: { wallet: earner.wallet, unclaimedSol, tweetId: result.tweet?.id },
        });
      }

      // Limit to 3 alerts per check cycle to avoid spam
      if (alertCount >= 3) {
        break;
      }

      // Delay between tweets
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    if (alertCount > 0) {
      console.log(`[AutonomousService] Bagsy sent ${alertCount} high-value fee alerts`);
    }
  }

  /**
   * Generate a high-value fee alert tweet
   */
  private generateHighValueFeeAlert(xUsername: string, unclaimedSol: number): string {
    const templates = [
      `hey @${xUsername} u have ${unclaimedSol.toFixed(1)} SOL unclaimed on @BagsFM!\n\ngo claim fren: bags.fm :)`,
      `@${xUsername} ur leaving ${unclaimedSol.toFixed(1)} SOL on the table!!\n\nclaim ur fees at bags.fm\n\nthats ur money fren`,
      `psa: @${xUsername} has ${unclaimedSol.toFixed(1)} SOL waiting at bags.fm\n\ngo get ur bag :)`,
      `friendly reminder @${xUsername}:\n\nu have ${unclaimedSol.toFixed(1)} SOL in unclaimed fees\n\nbags.fm\n\nim begging u`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Fetch fee earners with their X/Twitter usernames
   * Returns earners who have twitter as their provider
   */
  private async fetchFeeEarnersWithXUsernames(): Promise<Array<{ wallet: string; xUsername: string | null }>> {
    // Fetch world state which includes fee earners
    const response = await fetch(`${process.env.BAGSWORLD_API_URL || 'http://localhost:3000'}/api/world-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: [] }),
    });

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
   * Tags @finnbags and a few team members
   */
  private async postBagsyMorningGM(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      return;
    }

    // Get current time in EST
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = estTime.getHours();
    const minute = estTime.getMinutes();
    const todayDate = estTime.toISOString().split("T")[0]; // YYYY-MM-DD

    // Check if we're in the 9 AM window (8:45 - 9:15 EST)
    const isGmWindow = (hour === 8 && minute >= 45) || (hour === 9 && minute <= 15);

    if (!isGmWindow) {
      return; // Not time yet
    }

    // Check if we already posted GM today (use database for persistence)
    if (!this.lastGmDate) {
      this.lastGmDate = await getAgentState("bagsy", "last_gm_date");
    }

    if (this.lastGmDate === todayDate) {
      return; // Already posted today
    }

    console.log(`[AutonomousService] Bagsy posting morning GM at ${hour}:${minute.toString().padStart(2, "0")} EST`);

    try {
      // Pick team members to tag (rotate through them)
      const teamMembers = [
        { handle: "finnbags", name: "boss" },
        { handle: "BagsApp", name: "fam" },
        { handle: "ramyobags", name: "CTO" },
        { handle: "alaadotsol", name: "skunk works" },
        { handle: "Sambags12", name: "fam" },
        { handle: "DaddyGhost", name: "creator" },
      ];

      // Always include Finn, plus 1-2 random others
      const finnTag = "@finnbags";
      const otherMembers = teamMembers.filter(m => m.handle !== "finnbags");
      const shuffled = otherMembers.sort(() => Math.random() - 0.5);
      const extras = shuffled.slice(0, Math.floor(Math.random() * 2) + 1); // 1-2 extras

      // Build GM tweet
      const extraTags = extras.map(m => `@${m.handle}`).join(" ");

      // GM templates with Finn and team
      const gmTemplates = [
        `gm ${finnTag}! gm ${extraTags}! gm frens :)\n\nanother beautiful day to help creators claim their fees\n\nbags.fm`,
        `gm to the best ceo ${finnTag} and the bags fam ${extraTags} :)\n\nlets make today amazing\n\nhave u claimed ur fees? bags.fm`,
        `gm gm gm!\n\n${finnTag} ${extraTags} hope yall are ready to watch creators win today :)\n\nbagsy is online and fee-pilled\n\nbags.fm`,
        `rise and shine ${finnTag}! ${extraTags}!\n\nbagsy here with ur morning reminder:\n\nclaim ur fees frens\n\nbags.fm :)`,
        `gm CT! special gm to ${finnTag} and ${extraTags} :)\n\nthe sun is shining in BagsWorld today\n\nhope ur all claiming at bags.fm`,
      ];

      const tweet = gmTemplates[Math.floor(Math.random() * gmTemplates.length)];

      // Check for duplicates
      if (this.isDuplicatePost(tweet)) {
        // Try AI generation as fallback
        const aiTweet = await this.generateBagsyTweet(
          `Write a cute morning GM tweet. Tag ${finnTag} (the CEO, your boss) and ${extraTags} (team members). Be excited for the day ahead. Mention BagsWorld or fees.`,
          `It's ${hour}:${minute.toString().padStart(2, "0")} AM EST - time for morning vibes!`
        );
        if (aiTweet && !this.isDuplicatePost(aiTweet)) {
          const result = await this.twitterService.post(aiTweet);
          if (result.success) {
            this.recordPost(aiTweet);
            this.lastGmDate = todayDate;
            await setAgentState("bagsy", "last_gm_date", todayDate).catch(() => {});
            console.log(`[AutonomousService] Bagsy morning GM posted (AI): ${result.tweet?.url}`);
            return;
          }
        }
      }

      const result = await this.twitterService.post(tweet);

      if (result.success && result.tweet?.id) {
        this.recordPost(tweet);
        this.lastGmDate = todayDate;
        await setAgentState("bagsy", "last_gm_date", todayDate).catch(() => {});
        console.log(`[AutonomousService] Bagsy morning GM posted: ${result.tweet?.url}`);

        // Score the tweet for tracking
        const contentScore = this.engagementScorer?.scoreTweetContent(tweet);

        // Record engagement for tracking
        await this.recordTweetEngagement(result.tweet.id, "post", {
          viralityScore: contentScore?.score,
          scoreFactors: contentScore?.factors,
        });

        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy Morning GM",
          message: tweet,
          data: { tweetId: result.tweet.id },
        });
      } else {
        console.error(`[AutonomousService] Bagsy GM failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[AutonomousService] Bagsy morning GM failed:", error);
    }
  }

  // ==========================================================================
  // Bagsy: Engagement Tracking (virality feedback loop)
  // ==========================================================================

  /**
   * Update engagement metrics for recent Bagsy tweets.
   * Fetches likes, retweets, replies from Twitter API to track what's working.
   */
  private async updateEngagementMetrics(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      return;
    }

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      return;
    }

    const tweetIds = await getTweetsNeedingMetricsUpdate("bagsy", 10);

    if (tweetIds.length === 0) {
      return;
    }

    console.log(`[AutonomousService] Updating engagement metrics for ${tweetIds.length} tweets`);

    for (const tweetId of tweetIds) {
      const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        const metrics = data.data?.public_metrics;

        if (metrics) {
          await updateEngagementMetrics(tweetId, {
            likes: metrics.like_count || 0,
            retweets: metrics.retweet_count || 0,
            replies: metrics.reply_count || 0,
            impressions: metrics.impression_count || 0,
          });

          console.log(
            `[AutonomousService] Updated metrics for ${tweetId}: ` +
            `${metrics.like_count} likes, ${metrics.retweet_count} RTs, ${metrics.reply_count} replies`
          );
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Log engagement stats periodically
    const stats = await getEngagementStats("bagsy", 7);
    if (stats && stats.totalTweets > 0) {
      console.log(
        `[AutonomousService] Bagsy 7-day stats: ` +
        `${stats.totalTweets} tweets, avg ${stats.avgLikes.toFixed(1)} likes, ` +
        `${stats.avgReplies.toFixed(1)} replies, ` +
        `${(stats.avgEngagementRate * 100).toFixed(2)}% engagement rate`
      );
      if (stats.topFactors.length > 0) {
        console.log(`[AutonomousService] Top performing factors: ${stats.topFactors.join(", ")}`);
      }
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
