// Dialogue Event Bridge - Connects agent-coordinator events to autonomous dialogue
// This enables characters to automatically discuss events happening in the world

import { subscribe, type AgentEvent, type AgentEventType } from "./agent-coordinator";
import { handleAgentEvent, handleWorldStateChange, startConversation } from "./autonomous-dialogue";
import type { WorldState } from "./types";

// ============================================================================
// STATE
// ============================================================================

let isInitialized = false;
let unsubscribeFunction: (() => void) | null = null;
let previousWorldHealth: number | undefined;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the dialogue event bridge
 * Call this once when the app starts
 */
export function initDialogueEventBridge(): void {
  if (isInitialized) {
    console.log("[DialogueBridge] Already initialized");
    return;
  }

  // Subscribe to all agent events
  unsubscribeFunction = subscribe(
    "*", // All event types
    handleEventForDialogue,
    ["low", "medium", "high", "urgent"]
  );

  isInitialized = true;
  console.log("[DialogueBridge] Initialized - listening for events");
}

/**
 * Cleanup the dialogue event bridge
 */
export function cleanupDialogueEventBridge(): void {
  if (unsubscribeFunction) {
    unsubscribeFunction();
    unsubscribeFunction = null;
  }
  isInitialized = false;
  previousWorldHealth = undefined;
  console.log("[DialogueBridge] Cleaned up");
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle an agent event and potentially trigger dialogue
 */
async function handleEventForDialogue(event: AgentEvent): Promise<void> {
  console.log(`[DialogueBridge] Received event: ${event.type} (${event.priority})`);

  // Pass to the dialogue system
  await handleAgentEvent(event);
}

/**
 * Handle world state updates for dialogue triggers
 * Call this when world state is updated
 */
export function onWorldStateUpdate(worldState: WorldState): void {
  // Check for significant health changes
  if (previousWorldHealth !== undefined) {
    handleWorldStateChange(worldState, previousWorldHealth);
  }

  // Store current health for next comparison
  previousWorldHealth = worldState.health;
}

// ============================================================================
// MANUAL TRIGGERS
// ============================================================================

/**
 * Manually trigger a conversation about a topic
 * Useful for testing or specific UI interactions
 */
export async function triggerConversation(
  topic: string,
  context?: {
    tokenSymbol?: string;
    amount?: number;
    change?: number;
    username?: string;
    worldHealth?: number;
    weather?: string;
  }
): Promise<boolean> {
  const conversation = await startConversation({ type: "random" }, topic, context);

  return conversation !== null;
}

/**
 * Trigger a welcome conversation when user first enters
 */
export async function triggerWelcomeConversation(): Promise<boolean> {
  return triggerConversation("general", {});
}

// ============================================================================
// BROWSER EVENT INTEGRATION
// ============================================================================

/**
 * Listen for browser-dispatched agent events
 * This catches events that come through the window event system
 */
export function initBrowserEventListener(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("bagsworld-agent-event", ((event: CustomEvent<AgentEvent>) => {
    handleEventForDialogue(event.detail);
  }) as EventListener);

  console.log("[DialogueBridge] Browser event listener initialized");
}

// ============================================================================
// EXPORTS
// ============================================================================

export { isInitialized as isBridgeInitialized };
