// Character Behavior System - Makes characters feel alive with AI-driven movement
// Polls the behavior API and dispatches commands to the game scene

import type { WorldState, GameCharacter, GameBuilding } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export interface BehaviorCommand {
  characterId: string;
  action: "moveTo" | "idle" | "observe" | "celebrate" | "patrol" | "approach";
  target?: {
    type: "position" | "character" | "building";
    x?: number;
    y?: number;
    id?: string;
  };
  dialogue?: string;
  emotion?: "neutral" | "excited" | "thoughtful" | "concerned" | "happy";
  duration?: number;
}

interface CharacterBehaviorState {
  isInitialized: boolean;
  pollInterval: ReturnType<typeof setInterval> | null;
  lastPollTime: number;
  currentCommands: Map<string, BehaviorCommand>;
  worldState: WorldState | null;
}

// ============================================================================
// STATE
// ============================================================================

const state: CharacterBehaviorState = {
  isInitialized: false,
  pollInterval: null,
  lastPollTime: 0,
  currentCommands: new Map(),
  worldState: null,
};

// How often to ask Claude for new behaviors (ms)
const BEHAVIOR_POLL_INTERVAL = 120000; // 2 minutes (reduced for API cost)

// Minimum time between polls
const MIN_POLL_GAP = 15000;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Initialize the character behavior system
 */
export function initCharacterBehavior(): void {
  if (state.isInitialized) {
    console.log("[CharacterBehavior] Already initialized");
    return;
  }

  state.isInitialized = true;
  console.log("[CharacterBehavior] System initialized");

  // Start polling for behaviors
  state.pollInterval = setInterval(pollBehaviors, BEHAVIOR_POLL_INTERVAL);

  // Initial poll after short delay (let world load)
  setTimeout(pollBehaviors, 3000);
}

/**
 * Cleanup the behavior system
 */
export function cleanupCharacterBehavior(): void {
  if (state.pollInterval) {
    clearInterval(state.pollInterval);
    state.pollInterval = null;
  }
  state.isInitialized = false;
  state.currentCommands.clear();
  state.worldState = null;
  console.log("[CharacterBehavior] System cleaned up");
}

/**
 * Update with latest world state
 */
export function updateWorldStateForBehavior(worldState: WorldState): void {
  state.worldState = worldState;
}

/**
 * Get current command for a character
 */
export function getCharacterCommand(characterId: string): BehaviorCommand | null {
  return state.currentCommands.get(characterId) || null;
}

/**
 * Clear command after it's been executed
 */
export function clearCharacterCommand(characterId: string): void {
  state.currentCommands.delete(characterId);
}

/**
 * Check if a character has a pending command
 */
export function hasCharacterCommand(characterId: string): boolean {
  return state.currentCommands.has(characterId);
}

// ============================================================================
// POLLING & API
// ============================================================================

async function pollBehaviors(): Promise<void> {
  // Check cooldown
  const now = Date.now();
  if (now - state.lastPollTime < MIN_POLL_GAP) {
    return;
  }

  // Need world state to generate behaviors
  if (!state.worldState) {
    console.log("[CharacterBehavior] No world state, skipping poll");
    return;
  }

  state.lastPollTime = now;

  try {
    // Build context for API
    const context = buildContext(state.worldState);

    const response = await fetch("/api/character-behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
    });

    if (!response.ok) {
      console.warn("[CharacterBehavior] API error:", response.status);
      return;
    }

    const data = await response.json();

    if (data.success && data.commands) {
      // Store commands for each character
      data.commands.forEach((cmd: BehaviorCommand) => {
        state.currentCommands.set(cmd.characterId, cmd);
      });

      // Dispatch event for WorldScene to pick up
      dispatchBehaviorCommands(data.commands, data.narrative);

      console.log("[CharacterBehavior] Received", data.commands.length, "commands");
      if (data.narrative) {
        console.log("[CharacterBehavior] Scene:", data.narrative);
      }
    }
  } catch (error) {
    console.warn("[CharacterBehavior] Poll error:", error);
  }
}

function buildContext(worldState: WorldState) {
  // Extract character positions
  const characters = worldState.population
    .filter((c) => isSpecialCharacter(c.id))
    .map((c) => ({
      id: getCharacterId(c.id),
      name: c.username || c.id,
      x: c.x || 400,
      y: c.y || 570,
      isMoving: c.isMoving || false,
      mood: c.mood,
    }));

  // Extract building info
  const buildings = worldState.buildings.slice(0, 10).map((b) => ({
    id: b.id,
    name: b.name,
    symbol: b.symbol,
    x: b.x || 400,
    y: b.y || 500,
    level: b.level,
    isGlowing: b.glowing,
  }));

  // Special buildings
  const specialBuildings = ["PokeCenter", "TradingGym", "Treasury", "Casino"];

  // Recent events
  const recentEvents = worldState.events?.slice(0, 5).map((e) => e.message) || [];

  return {
    characters,
    buildings,
    specialBuildings,
    recentEvents,
    worldHealth: worldState.health,
    weather: worldState.weather,
    timeOfDay: worldState.timeInfo?.isNight ? "night" : "day",
  };
}

// Check if this is a special NPC character
function isSpecialCharacter(id: string): boolean {
  const specialIds = ["finn", "ghost", "neo", "ash", "toly", "dev", "scout", "cj"];
  const lowerName = id.toLowerCase();
  return (
    specialIds.some((s) => lowerName.includes(s)) ||
    id.includes("Finnbags") ||
    id.includes("The Dev") ||
    id.includes("Neo") ||
    id.includes("Ash") ||
    id.includes("Toly") ||
    id.includes("CJ")
  );
}

// Map character display ID to behavior system ID
function getCharacterId(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes("finn")) return "finn";
  if (lower.includes("dev") || lower.includes("ghost")) return "ghost";
  if (lower.includes("neo") || lower.includes("scout")) return "neo";
  if (lower.includes("ash")) return "ash";
  if (lower.includes("toly")) return "toly";
  if (lower.includes("cj")) return "cj";
  return id;
}

// ============================================================================
// EVENT DISPATCHING
// ============================================================================

function dispatchBehaviorCommands(commands: BehaviorCommand[], narrative?: string): void {
  // Dispatch individual movement commands for each character
  commands.forEach((cmd) => {
    window.dispatchEvent(
      new CustomEvent("bagsworld-character-behavior", {
        detail: cmd,
      })
    );
  });

  // Only ONE character speaks per behavior cycle (pick randomly from those with dialogue)
  const commandsWithDialogue = commands.filter((cmd) => cmd.dialogue);
  if (commandsWithDialogue.length > 0) {
    const speaker = commandsWithDialogue[Math.floor(Math.random() * commandsWithDialogue.length)];
    window.dispatchEvent(
      new CustomEvent("bagsworld-character-speak", {
        detail: {
          characterId: speaker.characterId,
          message: speaker.dialogue,
          emotion: speaker.emotion,
        },
      })
    );
  }

  // Dispatch scene narrative if present
  if (narrative) {
    window.dispatchEvent(
      new CustomEvent("bagsworld-scene-narrative", {
        detail: { narrative },
      })
    );
  }
}

// ============================================================================
// MANUAL TRIGGERS
// ============================================================================

/**
 * Force an immediate behavior poll
 */
export function forceBehaviorPoll(): void {
  state.lastPollTime = 0; // Reset cooldown
  pollBehaviors();
}

/**
 * Manually set a behavior command (for testing or events)
 */
export function setCharacterBehavior(command: BehaviorCommand): void {
  state.currentCommands.set(command.characterId, command);
  dispatchBehaviorCommands([command]);
}

// ============================================================================
// DEBUG
// ============================================================================

export function getBehaviorState() {
  return {
    isInitialized: state.isInitialized,
    lastPollTime: state.lastPollTime,
    commandCount: state.currentCommands.size,
    commands: Array.from(state.currentCommands.entries()),
  };
}
