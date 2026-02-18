// Dialogue Event Bridge - Connects agent-coordinator events to autonomous dialogue
// This enables characters to automatically discuss events happening in the world

import { subscribe, type AgentEvent } from "./agent-coordinator";
import { handleAgentEvent, handleWorldStateChange, startConversation } from "./autonomous-dialogue";
import type { WorldState } from "./types";

let isInitialized = false;
let unsubscribeFunction: (() => void) | null = null;
let previousWorldHealth: number | undefined;

export function initDialogueEventBridge(): void {
  if (isInitialized) {
    console.log("[DialogueBridge] Already initialized");
    return;
  }

  unsubscribeFunction = subscribe(
    "*", // All event types
    async (event) => {
      console.log(`[DialogueBridge] Event: ${event.type} (${event.priority})`);
      await handleAgentEvent(event);
    },
    ["low", "medium", "high", "urgent"]
  );

  isInitialized = true;
  console.log("[DialogueBridge] Initialized - listening for events");
}

export function cleanupDialogueEventBridge(): void {
  if (unsubscribeFunction) {
    unsubscribeFunction();
    unsubscribeFunction = null;
  }
  isInitialized = false;
  previousWorldHealth = undefined;
  console.log("[DialogueBridge] Cleaned up");
}

export function onWorldStateUpdate(worldState: WorldState): void {
  if (previousWorldHealth !== undefined) {
    handleWorldStateChange(worldState, previousWorldHealth);
  }

  previousWorldHealth = worldState.health;
}

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

export function initBrowserEventListener(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("bagsworld-agent-event", ((event: CustomEvent<AgentEvent>) => {
    handleAgentEvent(event.detail);
  }) as EventListener);

  console.log("[DialogueBridge] Browser event listener initialized");
}

export { isInitialized as isBridgeInitialized };
