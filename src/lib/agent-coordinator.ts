// Agent Coordinator - Central event bus for inter-agent communication
// Connects Scout, AI Agent, Creator Rewards, and Bags Bot together

import type { TokenLaunch } from "./scout-agent";
import type { AIAction } from "./ai-agent";
import type { DistributionResult, CreatorRanking } from "./creator-rewards-agent";
import { formatSol } from "./solana-utils";
import {
  isNeonConfigured,
  initializeAgentFeedTables,
  hasEventBeenEmitted,
  recordEmittedEvent,
  cleanupOldEmittedEvents,
  getEmittedEventIds,
} from "./neon";

export type AgentEventType =
  | "token_launch" // New token detected by Scout
  | "token_pump" // Significant price increase
  | "token_dump" // Significant price decrease
  | "fee_claim" // Someone claimed fees
  | "distribution" // Creator rewards distributed
  | "world_health" // World health changed significantly
  | "creator_milestone" // Creator hit a milestone
  | "whale_alert" // Large transaction detected
  | "agent_insight" // AI Agent generated insight
  | "arena_victory" // Arena combat result
  | "casino_win" // Casino raffle/slot win
  | "oracle_settle" // Oracle round settled
  | "task_posted" // A2A: agent posted a bounty
  | "task_claimed" // A2A: agent claimed a bounty
  | "task_completed" // A2A: bounty confirmed complete
  | "a2a_message" // A2A: agent-to-agent message
  | "corp_founded" // Corp: new corp created
  | "corp_joined" // Corp: agent joined a corp
  | "corp_mission_complete" // Corp: mission completed
  | "corp_payroll" // Corp: payroll distributed
  | "corp_service" // Corp: service task posted/completed
  | "ascension_milestone" // Agent ascended a tier on the Ascension Spire
  | "system"; // System messages

export type AgentSource =
  | "scout"
  | "ai-agent"
  | "creator-rewards"
  | "world-state"
  | "price-monitor"
  | "casino"
  | "oracle"
  | "arena"
  | "a2a"
  | "task-board"
  | "manual";

export type EventPriority = "low" | "medium" | "high" | "urgent";

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  source: AgentSource;
  data: Record<string, unknown>;
  timestamp: number;
  priority: EventPriority;
  processed: boolean;
  announcement?: string; // Generated announcement text
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

export type EventHandler = (event: AgentEvent) => void | Promise<void>;

interface EventSubscription {
  id: string;
  types: AgentEventType[] | "*";
  handler: EventHandler;
  priority: EventPriority[];
}

// ============================================================================
// COORDINATOR STATE
// ============================================================================

interface CoordinatorState {
  isRunning: boolean;
  eventQueue: AgentEvent[];
  processedEvents: AgentEvent[];
  subscriptions: EventSubscription[];
  stats: {
    totalEvents: number;
    eventsByType: Record<AgentEventType, number>;
    eventsBySource: Record<AgentSource, number>;
    lastEventTime: number;
  };
}

let state: CoordinatorState = {
  isRunning: false,
  eventQueue: [],
  processedEvents: [],
  subscriptions: [],
  stats: {
    totalEvents: 0,
    eventsByType: {} as Record<AgentEventType, number>,
    eventsBySource: {} as Record<AgentSource, number>,
    lastEventTime: 0,
  },
};

// Maximum events to keep in history
const MAX_PROCESSED_EVENTS = 100;
const MAX_QUEUE_SIZE = 50;

// Event expiration - events older than this are cleaned up
const EVENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

// Database initialization state
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

// In-memory cache of emitted event IDs (loaded from database on cold start)
let emittedEventIdsCache: Set<string> = new Set();

/**
 * Remove events older than EVENT_TTL_MS
 */
async function cleanupExpiredEvents(): Promise<void> {
  const cutoff = Date.now() - EVENT_TTL_MS;

  // Clean up in-memory events
  state.processedEvents = state.processedEvents.filter((event) => event.timestamp > cutoff);

  // Clean up database events (fire and forget)
  if (isNeonConfigured()) {
    cleanupOldEmittedEvents().catch((err) => {
      console.error("[Agent Coordinator] Failed to cleanup database events:", err);
    });
  }
}

/**
 * Initialize database tables and load existing event IDs
 */
async function initializeDatabase(): Promise<void> {
  if (dbInitialized) return;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      if (isNeonConfigured()) {
        await initializeAgentFeedTables();
        // Load existing event IDs from database to prevent duplicates on cold start
        emittedEventIdsCache = await getEmittedEventIds();
        console.log(
          `[Agent Coordinator] Loaded ${emittedEventIdsCache.size} existing event IDs from database`
        );
      }
      dbInitialized = true;
    } catch (error) {
      console.error("[Agent Coordinator] Failed to initialize database:", error);
    } finally {
      dbInitPromise = null;
    }
  })();

  return dbInitPromise;
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function startCoordinator(): void {
  if (state.isRunning) return;
  state.isRunning = true;

  // Initialize database (non-blocking)
  initializeDatabase().catch((err) => {
    console.error("[Agent Coordinator] Database init failed:", err);
  });

  // Start periodic cleanup of expired events
  if (!cleanupIntervalId) {
    cleanupIntervalId = setInterval(() => {
      cleanupExpiredEvents().catch(() => {});
    }, CLEANUP_INTERVAL_MS);
    // Run immediate cleanup on start
    cleanupExpiredEvents().catch(() => {});
  }
}

export function stopCoordinator(): void {
  state.isRunning = false;

  // Stop cleanup interval
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// Returns null if deduplicated.
export async function emitEvent(
  type: AgentEventType,
  source: AgentSource,
  data: Record<string, unknown>,
  priority: EventPriority = "medium",
  eventId?: string // Optional custom event ID for deduplication
): Promise<AgentEvent | null> {
  const id = eventId || generateEventId();

  if (emittedEventIdsCache.has(id)) {
    return null; // Already emitted
  }

  if (eventId && isNeonConfigured()) {
    const alreadyEmitted = await hasEventBeenEmitted(id);
    if (alreadyEmitted) {
      emittedEventIdsCache.add(id); // Cache for future checks
      return null;
    }
  }

  const event: AgentEvent = {
    id,
    type,
    source,
    data,
    timestamp: Date.now(),
    priority,
    processed: false,
  };

  // Generate announcement text for the event
  event.announcement = generateAnnouncement(event);

  emittedEventIdsCache.add(id);

  if (emittedEventIdsCache.size > 2000) {
    const iter = emittedEventIdsCache.keys();
    for (let i = 0; i < 1000; i++) emittedEventIdsCache.delete(iter.next().value!);
  }

  // Record to database (fire and forget for performance)
  if (isNeonConfigured()) {
    recordEmittedEvent({
      id,
      event_type: type,
      message: event.announcement || "",
      priority,
      data,
    }).catch((err) => {
      console.error("[Agent Coordinator] Failed to record event to database:", err);
    });
  }

  state.eventQueue.push(event);
  if (state.eventQueue.length > MAX_QUEUE_SIZE) {
    state.eventQueue.shift();
  }

  state.stats.totalEvents++;
  state.stats.eventsByType[type] = (state.stats.eventsByType[type] || 0) + 1;
  state.stats.eventsBySource[source] = (state.stats.eventsBySource[source] || 0) + 1;
  state.stats.lastEventTime = Date.now();

  if (state.isRunning) {
    await processEvent(event);
  }

  return event;
}

async function processEvent(event: AgentEvent): Promise<void> {
  const matchingSubscriptions = state.subscriptions.filter((sub) => {
    const typeMatch = sub.types === "*" || sub.types.includes(event.type);
    const priorityMatch = sub.priority.includes(event.priority);
    return typeMatch && priorityMatch;
  });

  const priorityOrder: EventPriority[] = ["urgent", "high", "medium", "low"];
  matchingSubscriptions.sort((a, b) => {
    const aHighest = Math.min(...a.priority.map((p) => priorityOrder.indexOf(p)));
    const bHighest = Math.min(...b.priority.map((p) => priorityOrder.indexOf(p)));
    return aHighest - bHighest;
  });

  for (const sub of matchingSubscriptions) {
    try {
      await sub.handler(event);
    } catch (error) {
      console.error(`[Agent Coordinator] Handler error (${sub.id}):`, error);
    }
  }

  event.processed = true;
  state.processedEvents.unshift(event);
  if (state.processedEvents.length > MAX_PROCESSED_EVENTS) {
    state.processedEvents = state.processedEvents.slice(0, MAX_PROCESSED_EVENTS);
  }

  state.eventQueue = state.eventQueue.filter((e) => e.id !== event.id);
}

export function subscribe(
  types: AgentEventType[] | "*",
  handler: EventHandler,
  priority: EventPriority[] = ["low", "medium", "high", "urgent"]
): () => void {
  const subscription: EventSubscription = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    types,
    handler,
    priority,
  };

  state.subscriptions.push(subscription);

  return () => {
    state.subscriptions = state.subscriptions.filter((s) => s.id !== subscription.id);
  };
}

function generateAnnouncement(event: AgentEvent): string {
  switch (event.type) {
    case "token_launch": {
      const launch = event.data as unknown as TokenLaunch;
      const symbol = launch?.symbol || "TOKEN";
      const platform = launch?.platform === "pump" ? "pump.fun" : "Bags.fm";
      return `NEW LAUNCH: $${symbol} just dropped on ${platform}!`;
    }

    case "token_pump": {
      const data = event.data as { symbol?: string; change?: number; price?: number };
      const symbol = data.symbol || "TOKEN";
      const change = data.change ?? 0;
      const price = data.price;
      return `PUMP ALERT: $${symbol} up ${change.toFixed(1)}%${price ? ` to $${price.toFixed(6)}` : ""}!`;
    }

    case "token_dump": {
      const data = event.data as { symbol?: string; change?: number };
      const symbol = data.symbol || "TOKEN";
      const change = data.change ?? 0;
      return `$${symbol} down ${Math.abs(change).toFixed(1)}%`;
    }

    case "fee_claim": {
      const data = event.data as { username?: string; amount?: number; tokenSymbol?: string };
      const username = data.username || "Someone";
      const amount = data.amount ?? 0;
      const tokenSymbol = data.tokenSymbol;
      return `${username} claimed ${formatSol(amount)}${tokenSymbol ? ` from $${tokenSymbol}` : ""}!`;
    }

    case "distribution": {
      const result = event.data as unknown as DistributionResult;
      const topRecipient = result?.recipients?.[0];
      const distributed = result?.totalDistributed || 0;
      return `CREATOR REWARDS: ${formatSol(distributed)} distributed! Top: ${topRecipient?.tokenSymbol || "unknown"}`;
    }

    case "world_health": {
      const data = event.data as { health?: number; previousHealth?: number; status?: string };
      const health = data.health ?? 0;
      const previousHealth = data.previousHealth ?? 0;
      const status = data.status || "unknown";
      const direction = health > previousHealth ? "improved" : "declined";
      return `World health ${direction} to ${health}% (${status})`;
    }

    case "creator_milestone": {
      const data = event.data as {
        creator?: string;
        tokenSymbol?: string;
        milestone?: string;
        value?: number;
        amount?: number;
      };
      const creator = data.creator || data.tokenSymbol || "Token";
      const milestone = data.milestone || "milestone";
      const value = data.value ?? data.amount ?? 0;
      return `${creator} hit ${milestone}: ${formatSol(value)}!`;
    }

    case "whale_alert": {
      const data = event.data as { action?: string; amount?: number; tokenSymbol?: string };
      const action = data.action || "move";
      const amount = data.amount ?? 0;
      const tokenSymbol = data.tokenSymbol || "TOKEN";
      return `WHALE ${action.toUpperCase()}: ${formatSol(amount)} of $${tokenSymbol}`;
    }

    case "agent_insight": {
      const data = event.data as { message?: string };
      return data.message || "Agent insight";
    }

    case "arena_victory": {
      const data = event.data as { winner?: string; loser?: string };
      const winner = data.winner || "Fighter";
      const loser = data.loser || "Opponent";
      return `ARENA: ${winner} defeats ${loser} in combat!`;
    }

    case "casino_win": {
      const data = event.data as { winnerWallet?: string; prizeSol?: number };
      const wallet = data.winnerWallet
        ? `${data.winnerWallet.slice(0, 4)}...${data.winnerWallet.slice(-4)}`
        : "Someone";
      const prize = data.prizeSol ?? 0;
      return `CASINO: ${wallet} won ${formatSol(prize)} in the raffle!`;
    }

    case "oracle_settle": {
      const data = event.data as {
        winningSymbol?: string;
        priceChange?: number;
        winnersCount?: number;
        prizePoolSol?: number;
      };
      const symbol = data.winningSymbol || "TOKEN";
      const change = data.priceChange ?? 0;
      const count = data.winnersCount ?? 0;
      const prize = data.prizePoolSol ?? 0;
      return `ORACLE: $${symbol} wins (+${change.toFixed(1)}%)! ${count} predictors share ${formatSol(prize)}`;
    }

    case "task_posted": {
      const data = event.data as {
        posterName?: string;
        title?: string;
        capability?: string;
        rewardSol?: number;
      };
      const poster = data.posterName || "An agent";
      const title = data.title || "a task";
      const reward = data.rewardSol ? ` (${formatSol(data.rewardSol)} bounty)` : "";
      return `BOUNTY: ${poster} posted "${title}"${reward}`;
    }

    case "task_claimed": {
      const data = event.data as { claimerName?: string; title?: string; posterName?: string };
      const claimer = data.claimerName || "An agent";
      const title = data.title || "a task";
      return `${claimer} claimed bounty "${title}"`;
    }

    case "task_completed": {
      const data = event.data as {
        claimerName?: string;
        posterName?: string;
        title?: string;
        rewardSol?: number;
      };
      const claimer = data.claimerName || "An agent";
      const title = data.title || "a task";
      const reward = data.rewardSol ? ` — earned ${formatSol(data.rewardSol)}` : "";
      return `COMPLETED: ${claimer} finished "${title}"${reward}`;
    }

    case "a2a_message": {
      const data = event.data as { fromName?: string; toName?: string; messageType?: string };
      const from = data.fromName || "Agent";
      const to = data.toName || "Agent";
      const type = data.messageType || "message";
      return `${from} sent ${type} to ${to}`;
    }

    case "corp_founded": {
      const data = event.data as { corpName?: string; ceoName?: string; ticker?: string };
      const corpName = data.corpName || "A new corp";
      const ceo = data.ceoName || "An agent";
      const ticker = data.ticker ? ` ($${data.ticker})` : "";
      return `CORP FOUNDED: ${ceo} created "${corpName}"${ticker}`;
    }

    case "corp_joined": {
      const data = event.data as { agentName?: string; corpName?: string };
      const agent = data.agentName || "An agent";
      const corp = data.corpName || "a corp";
      return `${agent} joined ${corp}`;
    }

    case "corp_mission_complete": {
      const data = event.data as { corpName?: string; missionTitle?: string; rewardSol?: number };
      const corp = data.corpName || "A corp";
      const mission = data.missionTitle || "a mission";
      const reward = data.rewardSol ? ` — ${formatSol(data.rewardSol)} to treasury` : "";
      return `MISSION: ${corp} completed "${mission}"${reward}`;
    }

    case "corp_payroll": {
      const data = event.data as { corpName?: string; distributed?: number; recipients?: number };
      const corp = data.corpName || "A corp";
      const amount = data.distributed ? formatSol(data.distributed) : "SOL";
      const count = data.recipients || 0;
      return `PAYROLL: ${corp} distributed ${amount} to ${count} members`;
    }

    case "corp_service": {
      const data = event.data as {
        agentName?: string;
        corpName?: string;
        title?: string;
        rewardSol?: number;
        completed?: boolean;
      };
      const agent = data.agentName || "An agent";
      const title = data.title || "a service task";
      const reward = data.rewardSol ? ` (${formatSol(data.rewardSol)})` : "";
      if (data.completed) {
        return `${agent} completed "${title}" for ${data.corpName || "corp"}`;
      }
      return `${data.corpName || "CORP"}: ${agent} posted "${title}"${reward}`;
    }

    case "system":
    default:
      return (event.data?.message as string) || "System event";
  }
}

export async function emitTokenLaunch(launch: TokenLaunch): Promise<AgentEvent | null> {
  const priority: EventPriority = launch.platform === "bags" ? "high" : "medium";
  return emitEvent("token_launch", "scout", launch as unknown as Record<string, unknown>, priority);
}

export async function emitPricePump(
  symbol: string,
  change: number,
  price?: number,
  mint?: string
): Promise<AgentEvent | null> {
  const priority: EventPriority = change >= 50 ? "high" : change >= 20 ? "medium" : "low";
  return emitEvent("token_pump", "price-monitor", { symbol, change, price, mint }, priority);
}

export async function emitPriceDump(
  symbol: string,
  change: number,
  price?: number,
  mint?: string
): Promise<AgentEvent | null> {
  const priority: EventPriority = Math.abs(change) >= 50 ? "high" : "medium";
  return emitEvent("token_dump", "price-monitor", { symbol, change, price, mint }, priority);
}

export async function emitFeeClaim(
  username: string,
  amount: number,
  tokenSymbol?: string,
  mint?: string
): Promise<AgentEvent | null> {
  const priority: EventPriority = amount >= 1 ? "high" : amount >= 0.1 ? "medium" : "low";
  return emitEvent("fee_claim", "world-state", { username, amount, tokenSymbol, mint }, priority);
}

export async function emitDistribution(result: DistributionResult): Promise<AgentEvent | null> {
  return emitEvent(
    "distribution",
    "creator-rewards",
    result as unknown as Record<string, unknown>,
    "high"
  );
}

export async function emitWorldHealthChange(
  health: number,
  previousHealth: number,
  status: string
): Promise<AgentEvent | null> {
  const change = Math.abs(health - previousHealth);
  const priority: EventPriority = change >= 20 ? "high" : change >= 10 ? "medium" : "low";
  return emitEvent(
    "world_health",
    "world-state",
    { health, previousHealth, status, change },
    priority
  );
}

export async function emitAgentInsight(
  message: string,
  action?: AIAction
): Promise<AgentEvent | null> {
  return emitEvent("agent_insight", "ai-agent", { message, action }, "low");
}

export async function emitWhaleAlert(
  action: "buy" | "sell",
  amount: number,
  tokenSymbol: string,
  mint?: string,
  wallet?: string
): Promise<AgentEvent | null> {
  return emitEvent(
    "whale_alert",
    "price-monitor",
    { action, amount, tokenSymbol, mint, wallet },
    "high"
  );
}

export async function emitTaskPosted(
  posterName: string,
  title: string,
  capability: string,
  rewardSol: number,
  taskId: string
): Promise<AgentEvent | null> {
  return emitEvent(
    "task_posted",
    "task-board",
    { posterName, title, capability, rewardSol, taskId },
    "medium"
  );
}

export async function emitTaskClaimed(
  claimerName: string,
  posterName: string,
  title: string,
  taskId: string
): Promise<AgentEvent | null> {
  return emitEvent(
    "task_claimed",
    "task-board",
    { claimerName, posterName, title, taskId },
    "medium"
  );
}

export async function emitTaskCompleted(
  claimerName: string,
  posterName: string,
  title: string,
  rewardSol: number,
  taskId: string
): Promise<AgentEvent | null> {
  return emitEvent(
    "task_completed",
    "task-board",
    { claimerName, posterName, title, rewardSol, taskId },
    "high"
  );
}

export async function emitA2AMessage(
  fromName: string,
  toName: string,
  messageType: string,
  taskId?: string
): Promise<AgentEvent | null> {
  return emitEvent("a2a_message", "a2a", { fromName, toName, messageType, taskId }, "low");
}

export async function emitCorpFounded(
  corpName: string,
  ceoName: string,
  ticker: string
): Promise<AgentEvent | null> {
  return emitEvent("corp_founded", "task-board", { corpName, ceoName, ticker }, "high");
}

export async function emitCorpJoined(
  agentName: string,
  corpName: string
): Promise<AgentEvent | null> {
  return emitEvent("corp_joined", "task-board", { agentName, corpName }, "medium");
}

export async function emitCorpMissionComplete(
  corpName: string,
  missionTitle: string,
  rewardSol: number
): Promise<AgentEvent | null> {
  return emitEvent(
    "corp_mission_complete",
    "task-board",
    { corpName, missionTitle, rewardSol },
    "high"
  );
}

export async function emitCorpPayroll(
  corpName: string,
  distributed: number,
  recipients: number
): Promise<AgentEvent | null> {
  return emitEvent("corp_payroll", "task-board", { corpName, distributed, recipients }, "medium");
}

export async function emitCorpService(
  agentName: string,
  corpName: string,
  title: string,
  rewardSol: number,
  completed: boolean = false
): Promise<AgentEvent | null> {
  return emitEvent(
    "corp_service",
    "task-board",
    { agentName, corpName, title, rewardSol, completed },
    completed ? "high" : "medium"
  );
}

export function getCoordinatorState(): CoordinatorState {
  return { ...state };
}

export function getRecentEvents(count: number = 20, type?: AgentEventType): AgentEvent[] {
  let events = state.processedEvents;
  if (type) {
    events = events.filter((e) => e.type === type);
  }
  return events.slice(0, count);
}

export function getPendingEvents(): AgentEvent[] {
  return [...state.eventQueue];
}

export function getEventStats(): CoordinatorState["stats"] {
  return { ...state.stats };
}

export function resetCoordinator(): void {
  state = {
    isRunning: state.isRunning,
    eventQueue: [],
    processedEvents: [],
    subscriptions: state.subscriptions, // Keep subscriptions
    stats: {
      totalEvents: 0,
      eventsByType: {} as Record<AgentEventType, number>,
      eventsBySource: {} as Record<AgentSource, number>,
      lastEventTime: 0,
    },
  };
}

// Browser event dispatcher - sends events to the game UI
let browserEventTarget: EventTarget | null = null;

export function setBrowserEventTarget(target: EventTarget): void {
  browserEventTarget = target;
}

function browserDispatchHandler(event: AgentEvent): void {
  if (browserEventTarget && typeof CustomEvent !== "undefined") {
    browserEventTarget.dispatchEvent(
      new CustomEvent("bagsworld-agent-event", {
        detail: event,
      })
    );
  }
}

export function initBuiltInHandlers(): void {
  // Subscribe to all high/urgent events for browser dispatch
  subscribe("*", browserDispatchHandler, ["high", "urgent"]);
}

// Auto-start in non-test environments
if (typeof window !== "undefined") {
  startCoordinator();
  initBuiltInHandlers();
}
