// Eliza Agents API Client
// Provides typed access to the eliza-agents backend at :3001

const ELIZA_API_BASE = process.env.NEXT_PUBLIC_ELIZA_API_URL || "http://localhost:3001";

// ============================================================================
// Types
// ============================================================================

export interface AgentStatus {
  agentId: string;
  status: "online" | "busy" | "offline";
  lastSeen: number;
  currentTask?: string;
  capabilities: string[];
}

export interface GhostTradingStatus {
  wallet?: {
    address: string | null;
    balanceSol: number;
  };
  trading: {
    enabled: boolean;
    openPositions: number;
    totalExposureSol: number;
    maxExposureSol: number;
    maxPositions: number;
  };
  performance: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnlSol: number;
    winRate: string;
  };
  config: GhostConfig;
  smartMoneyWallets: Array<{ address: string; label: string }>;
}

export interface GhostConfig {
  minPositionSol: number;
  maxPositionSol: number;
  takeProfitMultiplier: number;
  takeProfitTiers?: number[];
  trailingStopPercent?: number;
  stopLossPercent: number;
  slippageBps: number;
  maxTotalExposureSol?: number;
  maxOpenPositions?: number;
  minLiquiditySol?: number;
  maxCreatorFeeBps?: number;
}

export interface GhostPosition {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  status: "open" | "closed" | "failed";
  entryPriceSol: number;
  amountSol: number;
  amountTokens: number;
  entryReason: string;
  exitReason?: string;
  pnlSol?: number;
  entryTxSignature: string;
  exitTxSignature?: string;
  createdAt: string;
  closedAt?: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  agentId: string;
  interval: number;
  lastRun: number;
  nextRun: number;
  enabled: boolean;
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

export interface AlertFilters {
  type?: AutonomousAlert["type"];
  severity?: AutonomousAlert["severity"];
  unacknowledgedOnly?: boolean;
  limit?: number;
}

export interface TwitterStatus {
  twitter: {
    authenticated: boolean;
    dryRun: boolean;
    username: string | null;
    canPost: boolean;
    nextPostInSeconds: number;
  };
  stats: {
    totalPosts: number;
  };
}

export interface Tweet {
  id: string;
  text: string;
  url: string;
  createdAt: string;
}

export interface SharedContext {
  recentLaunches?: number;
  lastLaunchScan?: number;
  lastAnomalyScan?: number;
  anomaliesDetected?: number;
  fees24h?: number;
  worldHealth?: number;
  weather?: string;
  walletsWithUnclaimedFees?: number;
  totalUnclaimedSol?: number;
  ghostTradingEnabled?: boolean;
  ghostOpenPositions?: number;
  ghostExposureSol?: number;
  ghostPnlSol?: number;
  [key: string]: unknown;
}

export interface ServerHealth {
  status: string;
  timestamp: string;
  version?: string;
  database?: {
    status: string;
    error?: string;
  };
  llm?: {
    provider: string;
    configured: boolean;
  };
  agents?: number;
}

// ============================================================================
// API Client
// ============================================================================

export class ElizaApiClient {
  private baseUrl: string;

  constructor(baseUrl = ELIZA_API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async getHealth(): Promise<ServerHealth> {
    return this.fetch<ServerHealth>("/health");
  }

  // -------------------------------------------------------------------------
  // Agent Coordination
  // -------------------------------------------------------------------------

  async getAgentStatuses(): Promise<{
    success: boolean;
    agents: AgentStatus[];
    count: number;
    online: number;
  }> {
    return this.fetch("/api/coordination/statuses");
  }

  async getSharedContext(): Promise<{
    success: boolean;
    context: SharedContext;
    keys: string[];
  }> {
    return this.fetch("/api/coordination/shared-context");
  }

  async getAgentMessages(
    agentId: string,
    limit = 20
  ): Promise<{
    success: boolean;
    agentId: string;
    messages: Array<{
      id: string;
      from: string;
      to: string;
      type: string;
      content: string;
      timestamp: number;
      priority: string;
    }>;
    count: number;
  }> {
    return this.fetch(`/api/coordination/messages/${agentId}?limit=${limit}`);
  }

  async broadcastMessage(
    from: string,
    content: string,
    type = "update",
    data?: Record<string, unknown>
  ): Promise<{ success: boolean; messageId: string; message: string }> {
    return this.fetch("/api/coordination/broadcast", {
      method: "POST",
      body: JSON.stringify({ from, type, content, data }),
    });
  }

  // -------------------------------------------------------------------------
  // Ghost Trading
  // -------------------------------------------------------------------------

  async getGhostStatus(): Promise<{ success: boolean } & GhostTradingStatus> {
    return this.fetch("/api/ghost/status");
  }

  async getGhostPositions(): Promise<{
    success: boolean;
    count: number;
    positions: GhostPosition[];
  }> {
    return this.fetch("/api/ghost/positions");
  }

  async getGhostOpenPositions(): Promise<{
    success: boolean;
    count: number;
    totalExposureSol: number;
    positions: GhostPosition[];
  }> {
    return this.fetch("/api/ghost/positions/open");
  }

  async enableGhostTrading(confirmPhrase: string): Promise<{
    success: boolean;
    message: string;
    warning?: string;
    stats?: { enabled: boolean; openPositions: number };
    error?: string;
  }> {
    return this.fetch("/api/ghost/enable", {
      method: "POST",
      body: JSON.stringify({ confirmPhrase }),
    });
  }

  async disableGhostTrading(): Promise<{
    success: boolean;
    message: string;
    openPositions: number;
    note?: string;
  }> {
    return this.fetch("/api/ghost/disable", {
      method: "POST",
    });
  }

  async updateGhostConfig(updates: Partial<GhostConfig>): Promise<{
    success: boolean;
    message: string;
    updates: Record<string, number>;
    currentConfig: GhostConfig;
  }> {
    return this.fetch("/api/ghost/config", {
      method: "POST",
      body: JSON.stringify(updates),
    });
  }

  async triggerGhostEvaluate(): Promise<{
    success: boolean;
    message: string;
    positionsBefore: number;
    positionsAfter: number;
    newPositions: number;
    error?: string;
  }> {
    return this.fetch("/api/ghost/evaluate", {
      method: "POST",
    });
  }

  async triggerGhostCheckPositions(): Promise<{
    success: boolean;
    message: string;
    openPositionsBefore: number;
    openPositionsAfter: number;
    positionsClosed: number;
    error?: string;
  }> {
    return this.fetch("/api/ghost/check-positions", {
      method: "POST",
    });
  }

  async markPositionClosed(
    positionId: string,
    pnlSol?: number,
    exitReason?: string
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.fetch(`/api/ghost/positions/${positionId}/mark-closed`, {
      method: "POST",
      body: JSON.stringify({
        pnlSol,
        exitReason: exitReason || "manual_external",
      }),
    });
  }

  // -------------------------------------------------------------------------
  // Autonomous Tasks
  // -------------------------------------------------------------------------

  async getTaskStatus(): Promise<{
    success: boolean;
    status: string;
    tasks: ScheduledTask[];
    taskCount: number;
  }> {
    return this.fetch("/api/autonomous/status");
  }

  async getAlerts(filters?: AlertFilters): Promise<{
    success: boolean;
    alerts: AutonomousAlert[];
    count: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.unacknowledgedOnly) params.set("unacknowledged", "true");
    if (filters?.limit) params.set("limit", String(filters.limit));

    const query = params.toString();
    return this.fetch(`/api/autonomous/alerts${query ? `?${query}` : ""}`);
  }

  async acknowledgeAlert(alertId: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/api/autonomous/alerts/${alertId}/acknowledge`, {
      method: "POST",
    });
  }

  async triggerTask(taskName: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
    availableTasks?: string[];
  }> {
    return this.fetch(`/api/autonomous/trigger/${taskName}`, {
      method: "POST",
    });
  }

  // -------------------------------------------------------------------------
  // Twitter
  // -------------------------------------------------------------------------

  async getTwitterStatus(): Promise<{ success: boolean } & TwitterStatus> {
    return this.fetch("/api/twitter/status");
  }

  async getTwitterHistory(limit = 10): Promise<{
    success: boolean;
    count: number;
    posts: Tweet[];
  }> {
    return this.fetch(`/api/twitter/history?limit=${limit}`);
  }

  async postTweet(content: string): Promise<{
    success: boolean;
    message: string;
    tweet?: { id: string; text: string; url: string };
    error?: string;
  }> {
    return this.fetch("/api/twitter/post", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  async postThread(content: string): Promise<{
    success: boolean;
    message: string;
    tweet?: { id: string; text: string; url: string };
    error?: string;
  }> {
    return this.fetch("/api/twitter/thread", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  async generateShillContent(mintOrSymbol: { mint?: string; symbol?: string }): Promise<{
    success: boolean;
    token?: { mint: string; name: string; symbol: string; marketCap?: number };
    templates?: string[];
    error?: string;
  }> {
    return this.fetch("/api/twitter/generate-shill", {
      method: "POST",
      body: JSON.stringify(mintOrSymbol),
    });
  }

  // -------------------------------------------------------------------------
  // Agents
  // -------------------------------------------------------------------------

  async getAgents(): Promise<{
    success: boolean;
    agents: Array<{
      id: string;
      name: string;
      username: string;
      description: string;
      topics: string[];
    }>;
    count: number;
  }> {
    return this.fetch("/api/agents");
  }

  async getAgent(agentId: string): Promise<{
    success: boolean;
    agent: {
      id: string;
      name: string;
      username: string;
      bio: string[];
      topics: string[];
      adjectives: string[];
      style: Record<string, unknown>;
    };
  }> {
    return this.fetch(`/api/agents/${agentId}`);
  }
}

// Singleton instance
export const elizaApi = new ElizaApiClient();
