# Migration Plan: BagsWorld → Official @elizaos/core

Based on [eliza-town](https://github.com/cayden970207/eliza-town) architecture.

---

## Overview

**Current State:** Custom standalone implementation with local type definitions
**Target State:** Official `@elizaos/core@1.7.2` with tick-based autonomy

---

## Phase 1: Install @elizaos/core (Day 1)

### 1.1 Add Dependencies

```bash
cd eliza-agents
npm install @elizaos/core@1.7.2
```

### 1.2 Update package.json

```json
{
  "dependencies": {
    "@elizaos/core": "^1.7.2",
    "@neondatabase/serverless": "^0.10.4",
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "uuid": "^11.1.0",
    "tsx": "^4.19.2",
    "ws": "^8.18.0"
  }
}
```

### 1.3 Add WebSocket Types

```bash
npm install --save-dev @types/ws
```

---

## Phase 2: Replace Local Types (Day 1-2)

### 2.1 Delete Local Types File

```bash
# Backup first
mv src/types/elizaos.ts src/types/elizaos.backup.ts

# Create re-export file
```

### 2.2 Create New Types File

**File: `eliza-agents/src/types/elizaos.ts`**

```typescript
// Re-export from official @elizaos/core
export type {
  Character,
  Action,
  ActionExample,
  Provider,
  Evaluator,
  Memory,
  State,
  IAgentRuntime,
  Plugin,
  Service,
  HandlerCallback,
} from "@elizaos/core";

// BagsWorld-specific extensions
export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ProviderResult {
  text: string;
  values?: Record<string, unknown>;
  data?: unknown;
}

export interface EvaluatorResult {
  triggered: boolean;
  score?: number;
  data?: unknown;
}
```

### 2.3 Update All Imports

Run this across all files:

```typescript
// BEFORE
import type { Character, Action } from "./types/elizaos.js";

// AFTER (same import, but now comes from @elizaos/core)
import type { Character, Action } from "./types/elizaos.js";
```

No changes needed since we're re-exporting!

---

## Phase 3: Add Agent Tick System (Day 2-3)

Based on eliza-town's `convex/aiTown/agent.ts`:

### 3.1 Create AgentState Interface

**File: `eliza-agents/src/services/AgentState.ts`**

```typescript
import type { GameId } from "./types";

export interface AgentState {
  id: string;
  playerId: string; // Sprite ID in Phaser

  // Position from game
  position: { x: number; y: number };
  zone: string;
  isMoving: boolean;

  // Behavioral state
  lastConversation?: number;
  lastActivity?: number;
  currentActivity?: {
    description: string;
    emoji: string;
    until: number;
  };

  // Operation tracking (like eliza-town)
  inProgressOperation?: {
    name: string;
    operationId: string;
    started: number;
  };
}

export interface WorldState {
  agents: Map<string, AgentState>;
  zone: string;
  weather: string;
  health: number;
  timestamp: number;
}
```

### 3.2 Create Agent Tick Loop

**File: `eliza-agents/src/services/AgentTickService.ts`**

```typescript
import { Service } from "@elizaos/core";
import type { AgentState, WorldState } from "./AgentState";
import { WorldSyncService } from "./WorldSyncService";
import { AgentCoordinator } from "./AgentCoordinator";

// Constants (from eliza-town)
const ACTION_TIMEOUT = 60_000; // 60s timeout for operations
const CONVERSATION_COOLDOWN = 30_000; // 30s after conversation ends
const ACTIVITY_COOLDOWN = 15_000; // 15s after activity ends
const CONVERSATION_DISTANCE = 100; // Pixels to start conversation
const TICK_INTERVAL = 4_000; // 4 second tick (your requirement)

export class AgentTickService {
  private worldSync: WorldSyncService;
  private coordinator: AgentCoordinator;
  private agentStates: Map<string, AgentState> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;

  constructor(worldSync: WorldSyncService, coordinator: AgentCoordinator) {
    this.worldSync = worldSync;
    this.coordinator = coordinator;
  }

  start(): void {
    if (this.tickInterval) return;

    console.log("[AgentTick] Starting tick loop (4s interval)");
    this.tickInterval = setInterval(() => this.tick(), TICK_INTERVAL);

    // Run first tick after 2 seconds
    setTimeout(() => this.tick(), 2000);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const worldState = this.worldSync.getWorldState();

    if (!worldState) {
      console.log("[AgentTick] No world state, skipping tick");
      return;
    }

    // Process each agent
    for (const [agentId, state] of this.agentStates) {
      try {
        await this.tickAgent(agentId, state, worldState, now);
      } catch (error) {
        console.error(`[AgentTick] Error processing ${agentId}:`, error);
      }
    }
  }

  private async tickAgent(
    agentId: string,
    state: AgentState,
    worldState: WorldState,
    now: number
  ): Promise<void> {
    // Update position from game
    const gameState = worldState.agents.get(agentId);
    if (gameState) {
      state.position = gameState.position;
      state.zone = gameState.zone;
      state.isMoving = gameState.isMoving;
    }

    // Check if operation in progress
    if (state.inProgressOperation) {
      if (now < state.inProgressOperation.started + ACTION_TIMEOUT) {
        // Still waiting for operation
        return;
      }
      // Timeout - clear operation
      console.log(`[AgentTick] Operation timeout: ${state.inProgressOperation.name}`);
      delete state.inProgressOperation;
    }

    // Check if doing activity
    const doingActivity = state.currentActivity && state.currentActivity.until > now;

    // Check cooldowns
    const justLeftConversation =
      state.lastConversation && now < state.lastConversation + CONVERSATION_COOLDOWN;
    const recentActivity = state.lastActivity && now < state.lastActivity + ACTIVITY_COOLDOWN;

    // DECISION: What should this agent do?
    if (!doingActivity && !state.isMoving) {
      await this.agentDoSomething(agentId, state, worldState, now, {
        justLeftConversation,
        recentActivity,
      });
    }
  }

  private async agentDoSomething(
    agentId: string,
    state: AgentState,
    worldState: WorldState,
    now: number,
    context: { justLeftConversation?: boolean; recentActivity?: boolean }
  ): Promise<void> {
    // Find nearby agents
    const nearbyAgents = this.findNearbyAgents(agentId, state.position, worldState);

    // 70% rules-based decision
    if (Math.random() < 0.7) {
      const decision = this.rulesBasedDecision(agentId, state, nearbyAgents, context);
      await this.executeDecision(agentId, decision);
    } else {
      // 30% LLM-based decision
      const decision = await this.llmBasedDecision(agentId, state, nearbyAgents, context);
      await this.executeDecision(agentId, decision);
    }
  }

  private rulesBasedDecision(
    agentId: string,
    state: AgentState,
    nearbyAgents: string[],
    context: { justLeftConversation?: boolean; recentActivity?: boolean }
  ): AgentDecision {
    // Character-specific rules
    switch (agentId) {
      case "neo":
        // Neo: Prioritize scanning, then patrol
        if (!context.recentActivity && Math.random() < 0.4) {
          return {
            type: "activity",
            description: "Scanning the chain...",
            emoji: "👁️",
            duration: 10000,
          };
        }
        return { type: "wander", zone: "trending" };

      case "ash":
        // Ash: Greet nearby agents, patrol park
        if (nearbyAgents.length > 0 && !context.justLeftConversation) {
          return { type: "approach", targetAgentId: nearbyAgents[0] };
        }
        return { type: "wander", zone: "main_city" };

      case "ghost":
        // Ghost: Observe, verify
        if (Math.random() < 0.3) {
          return {
            type: "activity",
            description: "Verifying on-chain data...",
            emoji: "🔍",
            duration: 8000,
          };
        }
        return { type: "wander", zone: "labs" };

      case "finn":
        // Finn: Visit zones, interact
        if (nearbyAgents.length > 0 && Math.random() < 0.5) {
          return { type: "approach", targetAgentId: nearbyAgents[0] };
        }
        const zones = ["main_city", "trending", "labs", "founders"];
        return { type: "wander", zone: zones[Math.floor(Math.random() * zones.length)] };

      case "cj":
        // CJ: Street patrol, react to events
        return { type: "wander", zone: "trending" };

      case "shaw":
        // Shaw: Work in HQ
        if (Math.random() < 0.4) {
          return {
            type: "activity",
            description: "Reviewing agent architectures...",
            emoji: "🏗️",
            duration: 12000,
          };
        }
        return { type: "wander", zone: "labs" };

      default:
        return { type: "wander" };
    }
  }

  private async llmBasedDecision(
    agentId: string,
    state: AgentState,
    nearbyAgents: string[],
    context: { justLeftConversation?: boolean; recentActivity?: boolean }
  ): Promise<AgentDecision> {
    // Use LLM to decide (implement based on your LLMService)
    // For now, fallback to rules
    return this.rulesBasedDecision(agentId, state, nearbyAgents, context);
  }

  private async executeDecision(agentId: string, decision: AgentDecision): Promise<void> {
    switch (decision.type) {
      case "wander":
        const destination = this.getWanderDestination(decision.zone);
        this.worldSync.sendCommand({
          type: "character-behavior",
          characterId: agentId,
          action: "moveTo",
          target: { type: "position", x: destination.x, y: destination.y },
        });
        break;

      case "approach":
        this.worldSync.sendCommand({
          type: "character-behavior",
          characterId: agentId,
          action: "moveTo",
          target: { type: "character", id: decision.targetAgentId! },
        });
        break;

      case "activity":
        const state = this.agentStates.get(agentId);
        if (state) {
          state.currentActivity = {
            description: decision.description!,
            emoji: decision.emoji!,
            until: Date.now() + (decision.duration || 10000),
          };
        }
        this.worldSync.sendCommand({
          type: "character-speak",
          characterId: agentId,
          message: `${decision.emoji} ${decision.description}`,
          emotion: "neutral",
        });
        break;

      case "speak":
        this.worldSync.sendCommand({
          type: "character-speak",
          characterId: agentId,
          message: decision.message!,
          emotion: decision.emotion || "neutral",
        });
        break;
    }
  }

  private findNearbyAgents(
    agentId: string,
    position: { x: number; y: number },
    worldState: WorldState
  ): string[] {
    const nearby: string[] = [];

    for (const [otherId, otherState] of worldState.agents) {
      if (otherId === agentId) continue;

      const dx = otherState.position.x - position.x;
      const dy = otherState.position.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < CONVERSATION_DISTANCE) {
        nearby.push(otherId);
      }
    }

    return nearby;
  }

  private getWanderDestination(zone?: string): { x: number; y: number } {
    // Zone-specific wander areas
    const zoneAreas: Record<string, { minX: number; maxX: number; y: number }> = {
      main_city: { minX: 100, maxX: 700, y: 555 },
      trending: { minX: 100, maxX: 700, y: 555 },
      labs: { minX: 100, maxX: 700, y: 555 },
      founders: { minX: 100, maxX: 700, y: 555 },
      ballers: { minX: 100, maxX: 700, y: 555 },
    };

    const area = zone ? zoneAreas[zone] : zoneAreas.main_city;

    return {
      x: area.minX + Math.floor(Math.random() * (area.maxX - area.minX)),
      y: area.y,
    };
  }

  // Register agent for tick processing
  registerAgent(agentId: string, initialState: Partial<AgentState>): void {
    this.agentStates.set(agentId, {
      id: agentId,
      playerId: agentId,
      position: { x: 400, y: 555 },
      zone: "main_city",
      isMoving: false,
      ...initialState,
    });
  }
}

interface AgentDecision {
  type: "wander" | "approach" | "activity" | "speak" | "idle";
  zone?: string;
  targetAgentId?: string;
  message?: string;
  emotion?: string;
  description?: string;
  emoji?: string;
  duration?: number;
}
```

---

## Phase 4: Add WebSocket Bridge (Day 3-4)

### 4.1 Create WorldSyncService

**File: `eliza-agents/src/services/WorldSyncService.ts`**

```typescript
import WebSocket, { WebSocketServer } from "ws";
import type { Server } from "http";

export interface GameCommand {
  type: "character-behavior" | "character-speak" | "zone-transition";
  characterId: string;
  action?: string;
  target?: { type: string; x?: number; y?: number; id?: string };
  message?: string;
  emotion?: string;
}

export interface WorldStateUpdate {
  type: "world-state-update";
  timestamp: number;
  zone: string;
  characters: Record<
    string,
    {
      x: number;
      y: number;
      isMoving: boolean;
    }
  >;
  weather?: string;
  health?: number;
}

export class WorldSyncService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private worldState: WorldStateUpdate | null = null;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      console.log("[WorldSync] Client connected");
      this.clients.add(ws);

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error("[WorldSync] Invalid message:", error);
        }
      });

      ws.on("close", () => {
        console.log("[WorldSync] Client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("[WorldSync] WebSocket error:", error);
        this.clients.delete(ws);
      });
    });

    console.log("[WorldSync] WebSocket server initialized on /ws");
  }

  private handleMessage(message: any): void {
    if (message.type === "world-state-update") {
      this.worldState = message as WorldStateUpdate;
    }
  }

  sendCommand(command: GameCommand): void {
    const data = JSON.stringify(command);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  getWorldState(): WorldStateUpdate | null {
    return this.worldState;
  }

  getAgentPosition(agentId: string): { x: number; y: number } | null {
    if (!this.worldState?.characters[agentId]) return null;

    const char = this.worldState.characters[agentId];
    return { x: char.x, y: char.y };
  }
}
```

### 4.2 Update Server.ts

**File: `eliza-agents/src/server.ts` (modifications)**

```typescript
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WorldSyncService } from "./services/WorldSyncService";
import { AgentTickService } from "./services/AgentTickService";
import { AgentCoordinator } from "./services/AgentCoordinator";

const app = express();
const server = createServer(app);

// Initialize services
const worldSync = new WorldSyncService();
const coordinator = new AgentCoordinator();
const tickService = new AgentTickService(worldSync, coordinator);

// Initialize WebSocket
worldSync.initialize(server);

// Register all agents
const AGENT_IDS = ["neo", "ghost", "finn", "ash", "cj", "shaw", "toly", "bags-bot"];
AGENT_IDS.forEach((id) => tickService.registerAgent(id, { zone: "main_city" }));

// Start tick loop
tickService.start();

// ... rest of routes ...

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Agent server running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
```

---

## Phase 5: Update Phaser WorldScene (Day 4-5)

### 5.1 Add WebSocket Client

**File: `src/game/scenes/WorldScene.ts` (additions)**

```typescript
// Add to class properties
private agentSocket: WebSocket | null = null;
private reconnectAttempts = 0;
private maxReconnectAttempts = 5;

// Add to create() method
this.connectToAgentServer();

// New methods
private connectToAgentServer(): void {
  const wsUrl = process.env.NEXT_PUBLIC_AGENTS_WS_URL || 'ws://localhost:3001/ws';

  try {
    this.agentSocket = new WebSocket(wsUrl);

    this.agentSocket.onopen = () => {
      console.log('[WorldScene] Connected to agent server');
      this.reconnectAttempts = 0;

      // Start sending world state updates
      this.time.addEvent({
        delay: 1000,
        callback: () => this.sendWorldStateUpdate(),
        loop: true
      });
    };

    this.agentSocket.onmessage = (event) => {
      try {
        const command = JSON.parse(event.data);
        this.handleAgentCommand(command);
      } catch (error) {
        console.error('[WorldScene] Invalid command:', error);
      }
    };

    this.agentSocket.onclose = () => {
      console.log('[WorldScene] Disconnected from agent server');
      this.scheduleReconnect();
    };

    this.agentSocket.onerror = (error) => {
      console.error('[WorldScene] WebSocket error:', error);
    };
  } catch (error) {
    console.error('[WorldScene] Failed to connect:', error);
    this.scheduleReconnect();
  }
}

private scheduleReconnect(): void {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.log('[WorldScene] Max reconnect attempts reached');
    return;
  }

  this.reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

  console.log(`[WorldScene] Reconnecting in ${delay}ms...`);
  setTimeout(() => this.connectToAgentServer(), delay);
}

private sendWorldStateUpdate(): void {
  if (!this.agentSocket || this.agentSocket.readyState !== WebSocket.OPEN) return;

  const characters: Record<string, { x: number; y: number; isMoving: boolean }> = {};

  for (const [id, sprite] of this.characterSprites) {
    const character = this.characterById.get(id);
    characters[this.getSpriteAgentId(id, sprite)] = {
      x: Math.round(sprite.x),
      y: Math.round(sprite.y),
      isMoving: character?.isMoving || false
    };
  }

  this.agentSocket.send(JSON.stringify({
    type: 'world-state-update',
    timestamp: Date.now(),
    zone: this.currentZone,
    characters,
    weather: this.worldState?.weather,
    health: this.worldState?.health
  }));
}

private getSpriteAgentId(id: string, sprite: Phaser.GameObjects.Sprite): string {
  // Map sprite flags to agent IDs
  const spriteData = sprite as any;
  if (spriteData.isFinn) return 'finn';
  if (spriteData.isDev) return 'ghost';
  if (spriteData.isScout) return 'neo';
  if (spriteData.isAsh) return 'ash';
  if (spriteData.isCJ) return 'cj';
  if (spriteData.isShaw) return 'shaw';
  if (spriteData.isToly) return 'toly';
  return id;
}

private handleAgentCommand(command: any): void {
  switch (command.type) {
    case 'character-behavior':
      window.dispatchEvent(new CustomEvent('bagsworld-character-behavior', {
        detail: command
      }));
      break;

    case 'character-speak':
      window.dispatchEvent(new CustomEvent('bagsworld-character-speak', {
        detail: command
      }));
      break;
  }
}
```

---

## Phase 6: Test & Tune (Day 5-6)

### 6.1 Test Checklist

- [ ] @elizaos/core imports work
- [ ] WebSocket connects between game and agent server
- [ ] World state updates flow every 1 second
- [ ] Agent tick loop runs every 4 seconds
- [ ] Agents wander to destinations
- [ ] Agents show activities with speech bubbles
- [ ] Agents approach nearby agents
- [ ] 70/30 rule/LLM split works

### 6.2 Monitoring

Add to server startup:

```typescript
// Log tick stats every minute
setInterval(() => {
  console.log("[Stats] Active agents:", tickService.getActiveCount());
  console.log("[Stats] WS clients:", worldSync.getClientCount());
  console.log("[Stats] Last tick:", tickService.getLastTickTime());
}, 60000);
```

---

## File Changes Summary

### New Files

- `eliza-agents/src/services/AgentTickService.ts`
- `eliza-agents/src/services/WorldSyncService.ts`
- `eliza-agents/src/services/AgentState.ts`

### Modified Files

- `eliza-agents/package.json` - Add @elizaos/core, ws
- `eliza-agents/src/types/elizaos.ts` - Re-export from @elizaos/core
- `eliza-agents/src/server.ts` - Initialize WebSocket, tick service
- `src/game/scenes/WorldScene.ts` - Add WebSocket client

### No Changes Needed

- `eliza-agents/src/characters/*` - Already compatible
- `eliza-agents/src/actions/*` - Already compatible
- `eliza-agents/src/providers/*` - Already compatible
- `eliza-agents/src/evaluators/*` - Already compatible

---

## Timeline

| Day | Task                                        |
| --- | ------------------------------------------- |
| 1   | Install @elizaos/core, update types         |
| 2   | Create AgentState, start AgentTickService   |
| 3   | Implement tick logic, rules-based decisions |
| 4   | Create WorldSyncService, WebSocket server   |
| 5   | Update WorldScene.ts, WebSocket client      |
| 6   | Test, tune, fix issues                      |

---

Ready to start? Run:

```bash
cd eliza-agents
npm install @elizaos/core@1.7.2 ws
npm install --save-dev @types/ws
```
