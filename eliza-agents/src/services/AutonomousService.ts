// AutonomousService - Scheduled tasks and autonomous agent actions
// Enables agents to act without human prompting

import { Service, type IAgentRuntime } from "../types/elizaos.js";
import { BagsApiService, getBagsApiService, type ClaimablePosition } from "./BagsApiService.js";
import { AgentCoordinator, getAgentCoordinator } from "./AgentCoordinator.js";
import { GhostTrader, getGhostTrader } from "./GhostTrader.js";
import { TwitterService, getTwitterService } from "./TwitterService.js";

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

  // Wallet tracking for Finn's fee reminders
  private trackedWallets = new Map<string, TrackedWallet>();

  // Bagsy: Track last processed mention ID for pagination
  private lastMentionId: string | null = null;

  // Bagsy: Track high-value fee alert history (wallet -> lastAlertTimestamp)
  private highValueAlertHistory = new Map<string, number>();

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

    // Initialize Twitter service
    await service.twitterService.initialize();

    // Register default autonomous tasks
    service.registerDefaultTasks();

    // Start the tick loop
    service.startTickLoop();

    // Store as singleton
    autonomousInstance = service;

    console.log("[AutonomousService] Autonomous service ready");
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
      message = `BRO! You have ${unclaimedSol.toFixed(2)} SOL unclaimed! Go to bags.fm/claim right now!`;
    } else {
      message = `Hey! You've got ${unclaimedSol.toFixed(3)} SOL waiting to be claimed at bags.fm/claim`;
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
        `PSA: ${walletsWithFees} creators have ${totalUnclaimedSol.toFixed(1)} SOL unclaimed right now\n\nbro go claim your fees at bags.fm/claim\n\nthat's YOUR money sitting there`
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
   * Bagsy's Twitter update - posts cute hype content
   */
  private async postBagsyTwitterUpdate(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping Bagsy update");
      return;
    }

    if (!this.bagsApi) return;

    try {
      const healthData = await this.bagsApi.getWorldHealth();
      if (!healthData) return;

      // Build Bagsy-style tweet
      const tweets = this.generateBagsyTweets(healthData);

      // Pick a random tweet style
      const tweet = tweets[Math.floor(Math.random() * tweets.length)];

      const result = await this.twitterService.post(tweet);

      if (result.success) {
        console.log(`[AutonomousService] Bagsy posted: ${result.tweet?.url}`);

        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy Twitter Update",
          message: tweet,
          data: { tweetId: result.tweet?.id },
        });
      } else {
        console.error(`[AutonomousService] Bagsy tweet failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[AutonomousService] Bagsy Twitter update failed:", error);
    }
  }

  /**
   * Bagsy's fee reminder post
   */
  private async postBagsyFeeReminder(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      return;
    }

    const walletsWithFees = this.getWalletsWithUnclaimedFees().length;
    const totalUnclaimedSol = this.getWalletsWithUnclaimedFees().reduce(
      (sum, w) => sum + w.unclaimedLamports / 1_000_000_000,
      0
    );

    // Only post if there are significant unclaimed fees
    if (walletsWithFees < 1 || totalUnclaimedSol < 0.5) {
      console.log("[AutonomousService] Not enough unclaimed fees for Bagsy reminder");
      return;
    }

    try {
      const feeReminders = [
        `psa: there is ${totalUnclaimedSol.toFixed(1)} SOL sitting unclaimed on @BagsFM rn\n\nis some of it yours?\n\nbags.fm/claim`,
        `${walletsWithFees} creators have fees waiting to be claimed\n\nare u one of them?\n\nbags.fm/claim`,
        `me refreshing the unclaimed fees dashboard: concerned\n\n${totalUnclaimedSol.toFixed(1)} SOL just sitting there\n\npls claim frens`,
        `friendly reminder from ur fren bagsy:\n\nCLAIM UR FEES\n\n${totalUnclaimedSol.toFixed(1)} SOL unclaimed rn\n\nbags.fm/claim`,
      ];

      const tweet = feeReminders[Math.floor(Math.random() * feeReminders.length)];
      const result = await this.twitterService.post(tweet);

      if (result.success) {
        console.log(`[AutonomousService] Bagsy fee reminder posted: ${result.tweet?.url}`);
      }
    } catch (error) {
      console.error("[AutonomousService] Bagsy fee reminder failed:", error);
    }
  }

  /**
   * Generate Bagsy-style tweets based on ecosystem data
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

    // Cute ecosystem updates
    tweets.push(
      `ecosystem check:\n\n${fees24h} SOL in fees today\n${activeTokens} tokens cooking\n\nvibes: immaculate :)`
    );

    tweets.push(
      `@BagsFM creators earned ${fees24h} SOL in fees today\n\nthe flywheel keeps spinning :)`
    );

    // Health-based posts
    if (health >= 80) {
      tweets.push(
        `health check: ${health}%\n\necosystem is thriving, creators are eating, bagsy is happy\n\nwe're all gonna make it`
      );
    } else if (health >= 50) {
      tweets.push(
        `daily update:\n\nfees: flowing\ncreators: eating\nbagsy: happy\n\nbags.fm`
      );
    }

    // Memeable posts
    tweets.push(
      `me: exists\n\nalso me: have u claimed ur fees tho\n\nbags.fm/claim`
    );

    tweets.push(
      `im just a smol green bean who wants u to have passive income\n\nis that too much to ask\n\nbags.fm/claim`
    );

    tweets.push(
      `things that make bagsy happy:\n\n1. fee claims\n2. new launches\n3. creators winning\n4. u :)`
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
  // Bagsy: Mention Handling
  // ==========================================================================

  /**
   * Handle Twitter mentions for Bagsy
   * Polls for @BagsWorldApp mentions and replies with helpful fee info
   */
  private async handleBagsyMentions(): Promise<void> {
    if (!this.twitterService || !this.twitterService.isConfigured()) {
      console.log("[AutonomousService] Twitter not configured, skipping Bagsy mention poll");
      return;
    }

    const username = "BagsWorldApp";

    const mentions = await this.twitterService.getMentions(username, this.lastMentionId || undefined);

    if (mentions.length === 0) {
      return;
    }

    console.log(`[AutonomousService] Bagsy found ${mentions.length} new mentions`);

    for (const mention of mentions) {
      // Skip if already processed
      if (this.twitterService.isProcessed(mention.tweetId)) {
        continue;
      }

      // Generate Bagsy-style reply
      const reply = this.generateBagsyMentionReply(mention.authorUsername);

      // Reply to the tweet
      const result = await this.twitterService.reply(mention.tweetId, reply);

      if (result.success) {
        this.twitterService.markProcessed(mention.tweetId);
        console.log(`[AutonomousService] Bagsy replied to @${mention.authorUsername}: ${result.tweet?.url}`);

        await this.createAlert({
          type: "milestone",
          severity: "info",
          title: "Bagsy Reply",
          message: `Replied to @${mention.authorUsername}`,
          data: { tweetId: result.tweet?.id, originalTweetId: mention.tweetId },
        });
      } else {
        console.log(`[AutonomousService] Bagsy reply failed: ${result.error}`);
      }

      // Small delay between replies to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Update last mention ID for pagination
    if (mentions.length > 0) {
      this.lastMentionId = mentions[0].tweetId;
    }
  }

  /**
   * Generate a Bagsy-style reply to a mention
   */
  private generateBagsyMentionReply(authorUsername: string): string {
    const templates = [
      `hey @${authorUsername}! have u claimed ur fees today? bags.fm/claim :)`,
      `gm @${authorUsername}! hope ur having a great day fren. remember to claim at bags.fm/claim :)`,
      `hi @${authorUsername}! if u have tokens on @BagsFM, u might have fees waiting at bags.fm/claim :)`,
      `hey fren @${authorUsername}! just checking - did u claim ur fees? bags.fm/claim`,
      `@${authorUsername} gm! ur fees wont claim themselves :) bags.fm/claim`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
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
      `hey @${xUsername} u have ${unclaimedSol.toFixed(1)} SOL unclaimed on @BagsFM!\n\ngo claim fren: bags.fm/claim :)`,
      `@${xUsername} ur leaving ${unclaimedSol.toFixed(1)} SOL on the table!!\n\nclaim ur fees at bags.fm/claim\n\nthats ur money fren`,
      `psa: @${xUsername} has ${unclaimedSol.toFixed(1)} SOL waiting at bags.fm/claim\n\ngo get ur bag :)`,
      `friendly reminder @${xUsername}:\n\nu have ${unclaimedSol.toFixed(1)} SOL in unclaimed fees\n\nbags.fm/claim\n\nim begging u`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Fetch fee earners with their X/Twitter usernames
   * Returns earners who have twitter as their provider
   */
  private async fetchFeeEarnersWithXUsernames(): Promise<Array<{ wallet: string; xUsername: string | null }>> {
    // Fetch world state which includes fee earners
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/world-state`, {
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
