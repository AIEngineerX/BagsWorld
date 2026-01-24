// Agent Coordinator - Central event bus for inter-agent communication
// Connects Scout, AI Agent, Creator Rewards, and Bags Bot together

import type { TokenLaunch } from "./scout-agent";
import type { AIAction } from "./ai-agent";
import type { DistributionResult, CreatorRanking } from "./creator-rewards-agent";
import { formatSol } from "./solana-utils";

// ============================================================================
// EVENT TYPES
// ============================================================================

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
  | "system"; // System messages

export type AgentSource =
  | "scout"
  | "ai-agent"
  | "creator-rewards"
  | "world-state"
  | "price-monitor"
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

/**
 * Remove events older than EVENT_TTL_MS
 */
function cleanupExpiredEvents(): void {
  const cutoff = Date.now() - EVENT_TTL_MS;
  const beforeCount = state.processedEvents.length;

  state.processedEvents = state.processedEvents.filter(
    (event) => event.timestamp > cutoff
  );

  const removedCount = beforeCount - state.processedEvents.length;
  if (removedCount > 0) {
    console.log(`[Agent Coordinator] Cleaned up ${removedCount} expired events`);
  }
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start the coordinator
 */
export function startCoordinator(): void {
  if (state.isRunning) return;
  state.isRunning = true;

  // Start periodic cleanup of expired events
  if (!cleanupIntervalId) {
    cleanupIntervalId = setInterval(cleanupExpiredEvents, CLEANUP_INTERVAL_MS);
    // Run immediate cleanup on start
    cleanupExpiredEvents();
  }

  console.log("[Agent Coordinator] Started - agents can now communicate");
}

/**
 * Stop the coordinator
 */
export function stopCoordinator(): void {
  state.isRunning = false;

  // Stop cleanup interval
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }

  console.log("[Agent Coordinator] Stopped");
}

/**
 * Emit an event to the coordinator
 */
export async function emitEvent(
  type: AgentEventType,
  source: AgentSource,
  data: Record<string, unknown>,
  priority: EventPriority = "medium"
): Promise<AgentEvent> {
  const event: AgentEvent = {
    id: generateEventId(),
    type,
    source,
    data,
    timestamp: Date.now(),
    priority,
    processed: false,
  };

  // Generate announcement text for the event
  event.announcement = generateAnnouncement(event);

  // Add to queue
  state.eventQueue.push(event);
  if (state.eventQueue.length > MAX_QUEUE_SIZE) {
    state.eventQueue.shift();
  }

  // Update stats
  state.stats.totalEvents++;
  state.stats.eventsByType[type] = (state.stats.eventsByType[type] || 0) + 1;
  state.stats.eventsBySource[source] = (state.stats.eventsBySource[source] || 0) + 1;
  state.stats.lastEventTime = Date.now();

  console.log(`[Agent Coordinator] Event: ${type} from ${source} (${priority})`);

  // Process immediately if running
  if (state.isRunning) {
    await processEvent(event);
  }

  return event;
}

/**
 * Process a single event - notify all matching subscribers
 */
async function processEvent(event: AgentEvent): Promise<void> {
  const matchingSubscriptions = state.subscriptions.filter((sub) => {
    // Check type match
    const typeMatch = sub.types === "*" || sub.types.includes(event.type);
    // Check priority match
    const priorityMatch = sub.priority.includes(event.priority);
    return typeMatch && priorityMatch;
  });

  // Sort by priority (urgent handlers first)
  const priorityOrder: EventPriority[] = ["urgent", "high", "medium", "low"];
  matchingSubscriptions.sort((a, b) => {
    const aHighest = Math.min(...a.priority.map((p) => priorityOrder.indexOf(p)));
    const bHighest = Math.min(...b.priority.map((p) => priorityOrder.indexOf(p)));
    return aHighest - bHighest;
  });

  // Notify handlers
  for (const sub of matchingSubscriptions) {
    try {
      await sub.handler(event);
    } catch (error) {
      console.error(`[Agent Coordinator] Handler error (${sub.id}):`, error);
    }
  }

  // Mark as processed
  event.processed = true;
  state.processedEvents.unshift(event);
  if (state.processedEvents.length > MAX_PROCESSED_EVENTS) {
    state.processedEvents = state.processedEvents.slice(0, MAX_PROCESSED_EVENTS);
  }

  // Remove from queue
  state.eventQueue = state.eventQueue.filter((e) => e.id !== event.id);
}

/**
 * Subscribe to events
 */
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
  console.log(
    `[Agent Coordinator] New subscription: ${subscription.id} for ${types === "*" ? "all events" : types.join(", ")}`
  );

  // Return unsubscribe function
  return () => {
    state.subscriptions = state.subscriptions.filter((s) => s.id !== subscription.id);
    console.log(`[Agent Coordinator] Unsubscribed: ${subscription.id}`);
  };
}

// ============================================================================
// ANNOUNCEMENT GENERATION
// ============================================================================

/**
 * Generate human-readable announcement for an event
 */
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

    case "system":
    default:
      return (event.data?.message as string) || "System event";
  }
}

// ============================================================================
// CONVENIENCE EMITTERS
// ============================================================================

/**
 * Emit a token launch event (from Scout Agent)
 */
export async function emitTokenLaunch(launch: TokenLaunch): Promise<AgentEvent> {
  const priority: EventPriority = launch.platform === "bags" ? "high" : "medium";
  return emitEvent("token_launch", "scout", launch as unknown as Record<string, unknown>, priority);
}

/**
 * Emit a price pump event
 */
export async function emitPricePump(
  symbol: string,
  change: number,
  price?: number,
  mint?: string
): Promise<AgentEvent> {
  const priority: EventPriority = change >= 50 ? "high" : change >= 20 ? "medium" : "low";
  return emitEvent("token_pump", "price-monitor", { symbol, change, price, mint }, priority);
}

/**
 * Emit a price dump event
 */
export async function emitPriceDump(
  symbol: string,
  change: number,
  price?: number,
  mint?: string
): Promise<AgentEvent> {
  const priority: EventPriority = Math.abs(change) >= 50 ? "high" : "medium";
  return emitEvent("token_dump", "price-monitor", { symbol, change, price, mint }, priority);
}

/**
 * Emit a fee claim event
 */
export async function emitFeeClaim(
  username: string,
  amount: number,
  tokenSymbol?: string,
  mint?: string
): Promise<AgentEvent> {
  const priority: EventPriority = amount >= 1 ? "high" : amount >= 0.1 ? "medium" : "low";
  return emitEvent("fee_claim", "world-state", { username, amount, tokenSymbol, mint }, priority);
}

/**
 * Emit a distribution event (from Creator Rewards Agent)
 */
export async function emitDistribution(result: DistributionResult): Promise<AgentEvent> {
  return emitEvent(
    "distribution",
    "creator-rewards",
    result as unknown as Record<string, unknown>,
    "high"
  );
}

/**
 * Emit a world health change event
 */
export async function emitWorldHealthChange(
  health: number,
  previousHealth: number,
  status: string
): Promise<AgentEvent> {
  const change = Math.abs(health - previousHealth);
  const priority: EventPriority = change >= 20 ? "high" : change >= 10 ? "medium" : "low";
  return emitEvent(
    "world_health",
    "world-state",
    { health, previousHealth, status, change },
    priority
  );
}

/**
 * Emit an AI agent insight
 */
export async function emitAgentInsight(message: string, action?: AIAction): Promise<AgentEvent> {
  return emitEvent("agent_insight", "ai-agent", { message, action }, "low");
}

/**
 * Emit a whale alert
 */
export async function emitWhaleAlert(
  action: "buy" | "sell",
  amount: number,
  tokenSymbol: string,
  mint?: string,
  wallet?: string
): Promise<AgentEvent> {
  return emitEvent(
    "whale_alert",
    "price-monitor",
    { action, amount, tokenSymbol, mint, wallet },
    "high"
  );
}

// ============================================================================
// STATE ACCESS
// ============================================================================

/**
 * Get coordinator state
 */
export function getCoordinatorState(): CoordinatorState {
  return { ...state };
}

/**
 * Get recent events
 */
export function getRecentEvents(count: number = 20, type?: AgentEventType): AgentEvent[] {
  let events = state.processedEvents;
  if (type) {
    events = events.filter((e) => e.type === type);
  }
  return events.slice(0, count);
}

/**
 * Get pending events in queue
 */
export function getPendingEvents(): AgentEvent[] {
  return [...state.eventQueue];
}

/**
 * Get event statistics
 */
export function getEventStats(): CoordinatorState["stats"] {
  return { ...state.stats };
}

/**
 * Reset coordinator state
 */
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

// ============================================================================
// BUILT-IN HANDLERS
// ============================================================================

// Browser event dispatcher - sends events to the game UI
let browserEventTarget: EventTarget | null = null;

export function setBrowserEventTarget(target: EventTarget): void {
  browserEventTarget = target;
}

/**
 * Built-in handler that dispatches events to the browser
 */
function browserDispatchHandler(event: AgentEvent): void {
  if (browserEventTarget && typeof CustomEvent !== "undefined") {
    browserEventTarget.dispatchEvent(
      new CustomEvent("bagsworld-agent-event", {
        detail: event,
      })
    );
  }
}

/**
 * Initialize built-in handlers
 */
export function initBuiltInHandlers(): void {
  // Subscribe to all high/urgent events for browser dispatch
  subscribe("*", browserDispatchHandler, ["high", "urgent"]);

  console.log("[Agent Coordinator] Built-in handlers initialized");
}

// Auto-start in non-test environments
if (typeof window !== "undefined") {
  startCoordinator();
  initBuiltInHandlers();
}
