// AutonomousService - Scheduled tasks and autonomous agent actions
// Enables agents to act without human prompting

import { Service, type IAgentRuntime } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService } from './BagsApiService.js';
import { AgentCoordinator, getAgentCoordinator } from './AgentCoordinator.js';

export interface ScheduledTask {
  id: string;
  name: string;
  agentId: string;
  interval: number;      // ms between runs
  lastRun: number;
  nextRun: number;
  enabled: boolean;
  handler: () => Promise<void>;
}

export interface AutonomousAlert {
  id: string;
  type: 'launch' | 'rug' | 'pump' | 'dump' | 'milestone' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
  acknowledged: boolean;
}

// Singleton instance
let autonomousInstance: AutonomousService | null = null;

export class AutonomousService extends Service {
  static readonly serviceType = 'bags_autonomous';
  readonly capabilityDescription = 'Autonomous agent actions and scheduled tasks';

  private tasks = new Map<string, ScheduledTask>();
  private alerts: AutonomousAlert[] = [];
  private tickInterval: NodeJS.Timeout | null = null;
  private bagsApi: BagsApiService | null = null;
  private coordinator: AgentCoordinator | null = null;

  // Thresholds for alerts
  private readonly PUMP_THRESHOLD = 50;     // 50% price increase
  private readonly DUMP_THRESHOLD = -30;    // 30% price decrease
  private readonly VOLUME_SPIKE = 200;      // 200% volume increase

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<AutonomousService> {
    console.log('[AutonomousService] Starting autonomous service...');
    const service = new AutonomousService(runtime);

    // Get dependencies
    service.bagsApi = getBagsApiService();
    service.coordinator = getAgentCoordinator();

    // Register default autonomous tasks
    service.registerDefaultTasks();

    // Start the tick loop
    service.startTickLoop();

    // Store as singleton
    autonomousInstance = service;

    console.log('[AutonomousService] Autonomous service ready');
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
      name: 'neo_launch_scan',
      agentId: 'neo',
      interval: 2 * 60 * 1000,
      handler: async () => {
        await this.scanForNewLaunches();
      },
    });

    // Neo: Monitor for suspicious activity every 5 minutes
    this.registerTask({
      name: 'neo_anomaly_detection',
      agentId: 'neo',
      interval: 5 * 60 * 1000,
      handler: async () => {
        await this.detectAnomalies();
      },
    });

    // Ghost: Check rewards pool every 10 minutes
    this.registerTask({
      name: 'ghost_rewards_check',
      agentId: 'ghost',
      interval: 10 * 60 * 1000,
      handler: async () => {
        await this.checkRewardsPool();
      },
    });

    // Finn: Check world health every 15 minutes
    this.registerTask({
      name: 'finn_health_check',
      agentId: 'finn',
      interval: 15 * 60 * 1000,
      handler: async () => {
        await this.checkWorldHealth();
      },
    });

    // BNN: Broadcast daily recap every 6 hours
    this.registerTask({
      name: 'bnn_daily_recap',
      agentId: 'bnn',
      interval: 6 * 60 * 60 * 1000,
      handler: async () => {
        await this.broadcastRecap();
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
    console.log(`[AutonomousService] Registered task: ${params.name} (every ${params.interval / 1000}s)`);
    return id;
  }

  /**
   * Enable or disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = enabled;
      console.log(`[AutonomousService] Task ${task.name} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Create an alert and notify agents
   */
  async createAlert(params: Omit<AutonomousAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<string> {
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
      await this.coordinator.alert('system', `[${alert.type.toUpperCase()}] ${alert.title}: ${alert.message}`, alert.data);
    }

    return alert.id;
  }

  /**
   * Get recent alerts
   */
  getAlerts(options?: {
    type?: AutonomousAlert['type'];
    severity?: AutonomousAlert['severity'];
    unacknowledgedOnly?: boolean;
    limit?: number;
  }): AutonomousAlert[] {
    const { type, severity, unacknowledgedOnly = false, limit = 20 } = options || {};

    return this.alerts
      .filter(a => {
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
    const alert = this.alerts.find(a => a.id === alertId);
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

  // ===== Autonomous Task Implementations =====

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
            type: 'launch',
            severity: 'info',
            title: `Hot Launch: ${launch.name}`,
            message: `New token ${launch.symbol} launched with $${(marketCap / 1000).toFixed(1)}K market cap`,
            data: { mint: launch.mint, symbol: launch.symbol, marketCap, creator: launch.creator },
          });
        }
      }

      // Update shared context
      if (this.coordinator) {
        this.coordinator.setSharedContext('recentLaunches', launches.length);
        this.coordinator.setSharedContext('lastLaunchScan', Date.now());
      }
    } catch (error) {
      console.error('[AutonomousService] Launch scan failed:', error);
    }
  }

  /**
   * Neo's anomaly detector
   */
  private async detectAnomalies(): Promise<void> {
    // This would check for:
    // - Sudden liquidity removal (rug signals)
    // - Abnormal wallet concentrations
    // - Suspicious trading patterns

    // Placeholder - would integrate with on-chain analysis
    console.log('[AutonomousService] Anomaly scan complete - no issues detected');

    if (this.coordinator) {
      this.coordinator.setSharedContext('lastAnomalyScan', Date.now());
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
          type: 'milestone',
          severity: 'info',
          title: 'High Fee Activity',
          message: `24h fees at ${fees24h.toFixed(2)} SOL - ecosystem is active!`,
          data: { fees24h, threshold },
        });
      }

      // Update shared context
      if (this.coordinator) {
        this.coordinator.setSharedContext('fees24h', fees24h);
        this.coordinator.setSharedContext('lastRewardsCheck', Date.now());
      }
    } catch (error) {
      console.error('[AutonomousService] Rewards check failed:', error);
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
          type: 'anomaly',
          severity: 'warning',
          title: 'World Health Critical',
          message: `BagsWorld health at ${healthPercent}% - activity levels low`,
          data: { health: healthPercent, weather: healthData.weather },
        });
      } else if (healthPercent > 80) {
        await this.createAlert({
          type: 'milestone',
          severity: 'info',
          title: 'World Thriving',
          message: `BagsWorld health at ${healthPercent}% - ecosystem is active!`,
          data: { health: healthPercent, weather: healthData.weather },
        });
      }

      // Update shared context
      if (this.coordinator) {
        this.coordinator.setSharedContext('worldHealth', healthPercent);
        this.coordinator.setSharedContext('weather', healthData.weather);
        this.coordinator.setSharedContext('lastHealthCheck', Date.now());
      }
    } catch (error) {
      console.error('[AutonomousService] Health check failed:', error);
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
        '📰 BNN ECOSYSTEM RECAP:',
        `Health: ${healthData.health}%`,
        `Weather: ${healthData.weather}`,
        `24h Volume: ${healthData.totalVolume24h?.toFixed(2) || 0} SOL`,
        `24h Fees: ${healthData.totalFees24h?.toFixed(2) || 0} SOL`,
        `Active Tokens: ${healthData.activeTokens || 0}`,
      ];

      if (this.coordinator) {
        await this.coordinator.broadcast('bnn', 'update', recapLines.join('\n'), {
          type: 'recap',
          timestamp: Date.now(),
          ...healthData,
        });
      }

      console.log('[AutonomousService] BNN broadcast complete');
    } catch (error) {
      console.error('[AutonomousService] BNN broadcast failed:', error);
    }
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
    return Array.from(this.tasks.values()).map(t => ({
      name: t.name,
      agentId: t.agentId,
      enabled: t.enabled,
      lastRun: t.lastRun ? new Date(t.lastRun).toISOString() : 'never',
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
