# Implementation Plan: Controllable elizaOS Agents for BagsWorld

## Executive Summary

Migrate BagsWorld agents to official `@elizaos/core` (v1.7.2) and add autonomous behavior with a custom tick loop, goal system, and bidirectional game synchronization.

**User Requirements:**

- Budget: Moderate ($50-100/mo) → 70% rules-based, 30% LLM decisions
- Control: Fully autonomous → Agents decide everything, users observe
- SDK: Migrate to `@elizaos/core`
- Latency: 3-5 second tick rate

---

## 1. Research Findings

### Official elizaOS Architecture

Based on research from [elizaOS Documentation](https://docs.elizaos.ai) and [GitHub](https://github.com/elizaOS/eliza):

**Key Discovery: AgentRuntime is Event-Driven, Not Tick-Based**

```
AgentRuntime has NO internal update loop.
Processing occurs when processActions() or evaluate() are explicitly called.
For autonomous behavior, we MUST implement our own tick loop.
```

**Core Components:**

| Component      | Purpose                              | Our Migration                     |
| -------------- | ------------------------------------ | --------------------------------- |
| `AgentRuntime` | Central orchestrator                 | Replace our mock runtime          |
| `Actions`      | Agent capabilities (execute tasks)   | Migrate our 11 actions            |
| `Providers`    | Data sources (context injection)     | Migrate our 5 providers           |
| `Evaluators`   | Post-processing (memory, reflection) | Migrate our 7 evaluators          |
| `Services`     | Long-running connections             | Add WebSocket bridge service      |
| `Memory`       | Persistence with embeddings          | Replace our conversation_messages |

**Package Details:**

- Latest: `@elizaos/core@1.7.2`
- Dependencies: zod, uuid, dotenv, handlebars, @langchain/core
- Dual build: Node.js + Browser
- No peer dependencies (self-contained)

### Gaming + elizaOS Precedents

From [OAK Research](https://oakresearch.io/en/analyses/innovations/gaming-x-ai-agents-emerging-trend-for-2025):

- **Smolworld** (Treasure/Mage): AI agents evolve in virtual Tamagotchi environment
- **GAME framework**: Defines agent personality, decision-making, virtual world interactions
- **Roblox experiment**: AI agent left to operate autonomously in simulated environment

These confirm: **spatial awareness requires custom implementation on top of elizaOS**.

---

## 2. Current State vs Target State

### Current Implementation (Standalone)

```typescript
// eliza-agents/src/types/elizaos.ts - Local type definitions
export interface Character { ... }
export interface Action { ... }
export interface Provider { ... }

// eliza-agents/src/index.ts - Custom plugin structure
export const bagsWorldPlugin: Plugin = {
  name: '@elizaos/plugin-bagsworld',
  actions: allActions,      // 11 actions
  providers: allProviders,  // 5 providers
  evaluators: allEvaluators, // 7 evaluators
};
```

**What works:**

- Character definitions are already elizaOS-compatible
- Action/Provider/Evaluator signatures match official types
- AgentCoordinator handles inter-agent messaging
- AutonomousService has scheduled tasks (Neo scans, Ghost checks)

**What's missing:**

- No AgentRuntime (using mock)
- No continuous decision loop
- No spatial awareness
- No bidirectional game sync
- No persistent memory with embeddings

### Target Implementation (Official elizaOS)

```typescript
// NEW: Using official @elizaos/core
import { AgentRuntime, Action, Provider, Evaluator, Service, Memory, State } from "@elizaos/core";

// NEW: Autonomous behavior service
class AutonomousAgentService extends Service {
  static serviceType = "bagsworld_autonomous";

  private tickInterval: NodeJS.Timeout;
  private worldState: AgentWorldState;

  async initialize(runtime: AgentRuntime): Promise<void> {
    // Start tick loop (3-5 seconds)
    this.tickInterval = setInterval(() => this.tick(runtime), 4000);
  }

  private async tick(runtime: AgentRuntime): Promise<void> {
    // 1. PERCEIVE - Get world state, messages, events
    const perception = await this.perceive(runtime);

    // 2. THINK - Evaluate goals, decide action (70% rules, 30% LLM)
    const decision = await this.think(runtime, perception);

    // 3. ACT - Execute and broadcast to game
    await this.act(runtime, decision);
  }
}
```

---

## 3. Architecture Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PHASER GAME (Next.js)                           │
│  WorldScene.ts                                                      │
│  • Character sprites with positions                                 │
│  • Listens to WebSocket for agent commands                         │
│  • Sends world state updates every 1 second                        │
└─────────────────────────────────────────────────────────────────────┘
                    ▲                              │
                    │ WebSocket                    │ WebSocket
                    │ (commands)                   ▼ (state)
┌─────────────────────────────────────────────────────────────────────┐
│                AGENT SERVER (eliza-agents)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ WorldSyncService (NEW)                                       │   │
│  │ • WebSocket server on /ws                                    │   │
│  │ • Receives: character positions, zone, events               │   │
│  │ • Sends: movement commands, speech, zone transitions        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ AutonomousAgentService (NEW)                                 │   │
│  │ • Tick loop every 4 seconds                                  │   │
│  │ • Perceive → Think → Act cycle                              │   │
│  │ • 70% rule-based decisions, 30% LLM                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ GoalSystem (NEW)                                             │   │
│  │ • Priority queue per agent                                   │   │
│  │ • Goal templates: patrol, visit, interact, observe, announce│   │
│  │ • Completion conditions and callbacks                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Official elizaOS Components                                  │   │
│  │ • AgentRuntime (replaces mock)                              │   │
│  │ • Memory with embeddings (replaces conversation_messages)   │   │
│  │ • Actions/Providers/Evaluators (migrated)                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow (Every Tick)

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. WORLD STATE UPDATE (Game → Server)                              │
│    Every 1 second, game sends:                                     │
│    {                                                               │
│      zone: "main_city",                                           │
│      characters: {                                                 │
│        neo: { x: 450, y: 540, isMoving: false },                  │
│        finn: { x: 200, y: 540, isMoving: true },                  │
│        ...                                                        │
│      },                                                           │
│      events: [{ type: "user_click", target: "neo" }]              │
│    }                                                               │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. FOR EACH AGENT: PERCEIVE                                        │
│    WorldState ← worldSyncService.getAgentState(agentId)           │
│    Messages   ← agentCoordinator.getMessages(agentId)             │
│    Alerts     ← autonomousService.getAlerts()                     │
│    Memory     ← runtime.messageManager.getMemories()              │
│                                                                    │
│    Nearby Agents = characters within 200px of this agent          │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ 3. FOR EACH AGENT: THINK                                           │
│                                                                    │
│    // Priority 1: Urgent messages (always respond)                │
│    if (messages.some(m => m.priority === 'urgent')) {             │
│      return { action: 'respond', message: messages[0] };          │
│    }                                                               │
│                                                                    │
│    // Priority 2: Active goal progress                            │
│    const activeGoal = goalSystem.getActiveGoal(agentId);          │
│    if (activeGoal) {                                              │
│      return planGoalAction(activeGoal, worldState);               │
│    }                                                               │
│                                                                    │
│    // Priority 3: New goal or idle                                │
│    return getIdleBehavior(agentId, worldState);                   │
│                                                                    │
│    // Decision method:                                            │
│    // - 70% use rule-based decision tree (fast, cheap)            │
│    // - 30% use LLM for complex/social decisions                  │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ 4. FOR EACH AGENT: ACT                                             │
│                                                                    │
│    switch (decision.action) {                                     │
│      case 'move':                                                 │
│        worldSyncService.sendCommand({                             │
│          type: 'character-behavior',                              │
│          characterId: agentId,                                    │
│          action: 'moveTo',                                        │
│          target: { x: decision.x, y: decision.y }                 │
│        });                                                        │
│        break;                                                     │
│                                                                    │
│      case 'speak':                                                │
│        worldSyncService.sendCommand({                             │
│          type: 'character-speak',                                 │
│          characterId: agentId,                                    │
│          message: decision.message,                               │
│          emotion: decision.emotion                                │
│        });                                                        │
│        break;                                                     │
│                                                                    │
│      case 'interact':                                             │
│        // Move toward target agent, then initiate dialogue        │
│        break;                                                     │
│    }                                                               │
│                                                                    │
│    // Store significant actions in memory                         │
│    if (decision.isSignificant) {                                  │
│      await runtime.messageManager.createMemory({                  │
│        content: { text: `I ${decision.action} at ${zone}` },      │
│        roomId: agentId,                                           │
│        userId: agentId                                            │
│      });                                                          │
│    }                                                               │
└────────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ 5. GAME EXECUTES (Server → Game)                                   │
│    • Sprites move toward targets                                   │
│    • Speech bubbles appear                                         │
│    • Animations play                                               │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Goal System Design

### Goal Types

```typescript
type GoalType =
  | "patrol" // Walk through zone randomly
  | "visit_zone" // Go to specific zone
  | "visit_building" // Go to specific building
  | "interact_agent" // Walk to and talk to another agent
  | "observe" // Stand near something and watch
  | "announce" // Make a public statement (speech bubble)
  | "scan" // Neo: Check for new launches
  | "verify" // Ghost: Verify on-chain activity
  | "greet" // Ash: Welcome newcomers
  | "respond_event"; // React to a triggered event

interface AgentGoal {
  id: string;
  type: GoalType;
  priority: number; // 1-10
  status: "pending" | "active" | "completed" | "failed";
  target?: {
    agentId?: string;
    buildingId?: string;
    zone?: ZoneType;
    position?: { x: number; y: number };
  };
  expiresAt?: number;
  completionCondition: (worldState: WorldState) => boolean;
  onComplete?: () => void;
}
```

### Character Goal Profiles

| Character    | Default Goals                      | Triggered Goals              | Zone Preference |
| ------------ | ---------------------------------- | ---------------------------- | --------------- |
| **Neo**      | Patrol BagsCity, Scan (every 2min) | Alert on suspicious activity | trending        |
| **Ghost**    | Observe HQ, Check rewards          | Verify large transactions    | labs            |
| **Finn**     | Visit all zones, Inspire           | Announce new features        | main_city       |
| **Ash**      | Patrol Park, Greet newcomers       | Help lost trainers           | main_city       |
| **CJ**       | Patrol trending zone               | React to market dumps        | trending        |
| **Shaw**     | Work in HQ, Coordinate             | Respond to tech questions    | labs            |
| **Toly**     | Visit Founders Corner              | Explain Solana concepts      | founders        |
| **Bags Bot** | Roam all zones                     | Respond to commands          | any             |

### Goal Selection Logic (Rules-Based)

```typescript
function selectNextGoal(agentId: string, worldState: WorldState): AgentGoal {
  const character = getCharacter(agentId);
  const currentZone = worldState.agentStates[agentId].zone;
  const nearbyAgents = worldState.agentStates[agentId].nearbyAgents;

  // Character-specific rules
  switch (agentId) {
    case 'neo':
      // If in BagsCity and no recent scan, prioritize scanning
      if (currentZone === 'trending' && !recentlyScannedreason() {
        return { type: 'scan', priority: 8 };
      }
      // If near another agent, 30% chance to interact
      if (nearbyAgents.length > 0 && Math.random() < 0.3) {
        return { type: 'interact_agent', target: { agentId: nearbyAgents[0] }, priority: 5 };
      }
      // Default: patrol
      return { type: 'patrol', priority: 3 };

    case 'ash':
      // If new user detected, greet them
      if (worldState.events.some(e => e.type === 'new_user')) {
        return { type: 'greet', priority: 9 };
      }
      // If in Park and near someone, 50% chance to interact
      if (currentZone === 'main_city' && nearbyAgents.length > 0) {
        return { type: 'interact_agent', target: { agentId: nearbyAgents[0] }, priority: 6 };
      }
      // Default: patrol park
      return { type: 'patrol', priority: 3 };

    // ... other characters
  }
}
```

---

## 5. Decision Engine

### Rule-Based Decisions (70%)

For routine behaviors, use deterministic rules:

```typescript
interface DecisionRule {
  condition: (perception: Perception) => boolean;
  action: () => Decision;
  priority: number;
}

const NEO_RULES: DecisionRule[] = [
  {
    priority: 10,
    condition: (p) => p.messages.some((m) => m.priority === "urgent"),
    action: () => ({ action: "respond", message: p.messages[0] }),
  },
  {
    priority: 8,
    condition: (p) => p.timeSinceLastScan > 120000, // 2 minutes
    action: () => ({ action: "scan", goal: "scan_launches" }),
  },
  {
    priority: 5,
    condition: (p) => p.nearbyAgents.length > 0 && Math.random() < 0.3,
    action: () => ({ action: "interact", target: p.nearbyAgents[0] }),
  },
  {
    priority: 2,
    condition: () => true, // Default
    action: () => ({ action: "patrol", zone: "trending" }),
  },
];

function ruleBasedDecision(agentId: string, perception: Perception): Decision {
  const rules = AGENT_RULES[agentId] || DEFAULT_RULES;

  // Sort by priority, find first matching rule
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (rule.condition(perception)) {
      return rule.action();
    }
  }

  return { action: "idle" };
}
```

### LLM-Based Decisions (30%)

For complex social situations, use the LLM:

```typescript
async function llmDecision(
  runtime: AgentRuntime,
  agentId: string,
  perception: Perception
): Promise<Decision> {
  const character = getCharacter(agentId);

  const prompt = `You are ${character.name} in BagsWorld.

CURRENT SITUATION:
- Location: ${perception.zone} zone
- Nearby agents: ${perception.nearbyAgents.join(", ") || "none"}
- Recent events: ${perception.events
    .slice(0, 3)
    .map((e) => e.type)
    .join(", ")}
- Current goal: ${perception.activeGoal?.type || "none"}

RECENT MEMORY:
${perception.memories
  .slice(0, 3)
  .map((m) => `- ${m.content.text}`)
  .join("\n")}

What should you do next? Choose ONE action:
1. MOVE to [zone/position] - Walk somewhere
2. SPEAK "[message]" - Say something aloud
3. INTERACT with [agent] - Approach and talk to another agent
4. OBSERVE [target] - Watch something happening
5. IDLE - Stay where you are

Respond with just the action type and target. Stay in character.`;

  const response = await runtime.completion({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 100,
  });

  return parseDecisionFromResponse(response);
}
```

### Decision Router

```typescript
async function decide(
  runtime: AgentRuntime,
  agentId: string,
  perception: Perception
): Promise<Decision> {
  // Always use rules for urgent situations
  if (perception.hasUrgentMessage || perception.hasUrgentAlert) {
    return ruleBasedDecision(agentId, perception);
  }

  // 70% rules, 30% LLM
  const useLLM = Math.random() < 0.3;

  // But only use LLM in social situations
  const isSocialSituation = perception.nearbyAgents.length > 0 || perception.recentUserInteraction;

  if (useLLM && isSocialSituation) {
    return llmDecision(runtime, agentId, perception);
  }

  return ruleBasedDecision(agentId, perception);
}
```

---

## 6. Migration Steps

### Phase 1: Add @elizaos/core Dependency (Day 1)

```bash
cd eliza-agents
npm install @elizaos/core@1.7.2
```

**Files to modify:**

- `package.json` - Add dependency
- `tsconfig.json` - Update module resolution if needed

### Phase 2: Migrate Types (Day 1-2)

Replace local types with official elizaOS types:

```typescript
// BEFORE: eliza-agents/src/types/elizaos.ts
export interface Character { ... }
export interface Action { ... }

// AFTER: Import from @elizaos/core
import type {
  Character,
  Action,
  Provider,
  Evaluator,
  Memory,
  State,
  IAgentRuntime
} from '@elizaos/core';
```

**Files to modify:**

- `src/types/elizaos.ts` → Delete (or keep as re-exports)
- `src/characters/index.ts` → Update imports
- `src/actions/*.ts` → Update signatures
- `src/providers/*.ts` → Update signatures
- `src/evaluators/*.ts` → Update signatures

### Phase 3: Create AgentRuntime Instances (Day 2-3)

Replace mock runtime with real AgentRuntime per agent:

```typescript
// NEW: eliza-agents/src/services/AgentRuntimeManager.ts
import { AgentRuntime } from "@elizaos/core";
import { characters } from "../characters";

class AgentRuntimeManager {
  private runtimes: Map<string, AgentRuntime> = new Map();

  async initialize(): Promise<void> {
    for (const [agentId, character] of Object.entries(characters)) {
      const runtime = new AgentRuntime({
        character,
        databaseAdapter: this.dbAdapter,
        modelProvider: "anthropic",
        conversationLength: 10,
        // ... other config
      });

      await runtime.initialize();
      this.runtimes.set(agentId, runtime);
    }
  }

  getRuntime(agentId: string): AgentRuntime | undefined {
    return this.runtimes.get(agentId);
  }
}
```

### Phase 4: Add WorldSyncService (Day 3-4)

WebSocket bridge between game and agents:

```typescript
// NEW: eliza-agents/src/services/WorldSyncService.ts
import { Service } from "@elizaos/core";
import WebSocket from "ws";

interface AgentWorldState {
  position: { x: number; y: number };
  zone: ZoneType;
  isMoving: boolean;
  nearbyAgents: string[];
}

class WorldSyncService extends Service {
  static serviceType = "bagsworld_sync";

  private wss: WebSocket.Server;
  private agentStates: Map<string, AgentWorldState> = new Map();
  private commandQueue: GameCommand[] = [];

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.wss = new WebSocket.Server({ noServer: true });

    this.wss.on("connection", (ws) => {
      ws.on("message", (data) => {
        const update = JSON.parse(data.toString());
        if (update.type === "world-state-update") {
          this.processWorldStateUpdate(update);
        }
      });
    });
  }

  processWorldStateUpdate(update: WorldStateUpdate): void {
    for (const [agentId, state] of Object.entries(update.characters)) {
      const currentState = this.agentStates.get(agentId) || {};

      // Calculate nearby agents
      const nearbyAgents = this.findNearbyAgents(agentId, state.x, state.y, 200);

      this.agentStates.set(agentId, {
        ...currentState,
        position: { x: state.x, y: state.y },
        zone: update.zone,
        isMoving: state.isMoving,
        nearbyAgents,
      });
    }
  }

  sendCommand(command: GameCommand): void {
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(command));
      }
    }
  }

  getAgentState(agentId: string): AgentWorldState | undefined {
    return this.agentStates.get(agentId);
  }
}
```

### Phase 5: Add AutonomousAgentService (Day 4-5)

The tick loop that drives autonomous behavior:

```typescript
// NEW: eliza-agents/src/services/AutonomousAgentService.ts
import { Service, IAgentRuntime } from "@elizaos/core";

class AutonomousAgentService extends Service {
  static serviceType = "bagsworld_autonomous";

  private tickInterval: NodeJS.Timeout;
  private worldSync: WorldSyncService;
  private goalSystem: GoalSystem;
  private runtimeManager: AgentRuntimeManager;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    // Get dependencies
    this.worldSync = runtime.getService("bagsworld_sync");
    this.runtimeManager = runtime.getService("bagsworld_runtimes");
    this.goalSystem = new GoalSystem();

    // Initialize default goals for each agent
    this.initializeDefaultGoals();

    // Start tick loop (4 seconds)
    this.tickInterval = setInterval(() => this.tick(), 4000);

    // Run first tick after 2 seconds
    setTimeout(() => this.tick(), 2000);
  }

  private async tick(): Promise<void> {
    const agentIds = this.runtimeManager.getAgentIds();

    // Process agents in parallel (but limit concurrency)
    const BATCH_SIZE = 4;
    for (let i = 0; i < agentIds.length; i += BATCH_SIZE) {
      const batch = agentIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((id) => this.processAgent(id)));
    }
  }

  private async processAgent(agentId: string): Promise<void> {
    const runtime = this.runtimeManager.getRuntime(agentId);
    if (!runtime) return;

    // 1. PERCEIVE
    const perception = await this.perceive(agentId, runtime);

    // 2. THINK
    const decision = await this.think(agentId, runtime, perception);

    // 3. ACT
    await this.act(agentId, runtime, decision);
  }

  private async perceive(agentId: string, runtime: AgentRuntime): Promise<Perception> {
    const worldState = this.worldSync.getAgentState(agentId);
    const messages = AgentCoordinator.getMessages(agentId);
    const alerts = AutonomousService.getAlerts({ limit: 5 });
    const memories = await runtime.messageManager.getMemories({
      roomId: agentId,
      count: 10,
    });

    return {
      agentId,
      worldState,
      messages,
      alerts,
      memories,
      activeGoal: this.goalSystem.getActiveGoal(agentId),
      nearbyAgents: worldState?.nearbyAgents || [],
    };
  }

  private async think(
    agentId: string,
    runtime: AgentRuntime,
    perception: Perception
  ): Promise<Decision> {
    // Implement decision logic from Section 5
    return decide(runtime, agentId, perception);
  }

  private async act(agentId: string, runtime: AgentRuntime, decision: Decision): Promise<void> {
    switch (decision.action) {
      case "move":
        this.worldSync.sendCommand({
          type: "character-behavior",
          characterId: agentId,
          action: "moveTo",
          target: { type: "position", x: decision.x, y: decision.y },
        });
        break;

      case "speak":
        this.worldSync.sendCommand({
          type: "character-speak",
          characterId: agentId,
          message: decision.message,
          emotion: decision.emotion,
        });
        break;

      case "interact":
        // First move toward target agent
        const targetState = this.worldSync.getAgentState(decision.target);
        if (targetState) {
          this.worldSync.sendCommand({
            type: "character-behavior",
            characterId: agentId,
            action: "moveTo",
            target: { type: "character", id: decision.target },
          });
        }
        break;
    }

    // Store significant actions in memory
    if (decision.isSignificant) {
      await runtime.messageManager.createMemory({
        content: {
          text: `${decision.action}: ${decision.description}`,
          action: decision.action,
        },
        roomId: agentId,
        userId: agentId,
      });
    }

    // Update goal progress
    if (decision.goalId) {
      this.goalSystem.updateProgress(agentId, decision.goalId, decision);
    }
  }
}
```

### Phase 6: Add GoalSystem (Day 5-6)

```typescript
// NEW: eliza-agents/src/services/GoalSystem.ts
class GoalSystem {
  private goals: Map<string, AgentGoal[]> = new Map();

  getGoals(agentId: string): AgentGoal[] {
    return this.goals.get(agentId) || [];
  }

  getActiveGoal(agentId: string): AgentGoal | undefined {
    return this.getGoals(agentId).find((g) => g.status === "active");
  }

  addGoal(agentId: string, goal: Omit<AgentGoal, "id" | "status">): string {
    const id = crypto.randomUUID();
    const fullGoal: AgentGoal = {
      ...goal,
      id,
      status: "pending",
    };

    const agentGoals = this.goals.get(agentId) || [];
    agentGoals.push(fullGoal);
    agentGoals.sort((a, b) => b.priority - a.priority);
    this.goals.set(agentId, agentGoals);

    return id;
  }

  activateGoal(agentId: string, goalId: string): void {
    const goals = this.goals.get(agentId);
    if (!goals) return;

    // Deactivate current active goal
    goals.forEach((g) => {
      if (g.status === "active") g.status = "pending";
    });

    // Activate new goal
    const goal = goals.find((g) => g.id === goalId);
    if (goal) goal.status = "active";
  }

  completeGoal(agentId: string, goalId: string): void {
    const goals = this.goals.get(agentId);
    if (!goals) return;

    const goal = goals.find((g) => g.id === goalId);
    if (goal) {
      goal.status = "completed";
      goal.onComplete?.();
    }
  }

  updateProgress(agentId: string, goalId: string, action: Decision): void {
    const goals = this.goals.get(agentId);
    if (!goals) return;

    const goal = goals.find((g) => g.id === goalId);
    if (goal && goal.completionCondition) {
      // Check if goal is now complete
      const worldState = WorldSyncService.getAgentState(agentId);
      if (goal.completionCondition(worldState)) {
        this.completeGoal(agentId, goalId);
      }
    }
  }

  initializeDefaultGoals(agentId: string): void {
    const character = getCharacter(agentId);

    // Add character-specific default goals
    switch (agentId) {
      case "neo":
        this.addGoal(agentId, {
          type: "patrol",
          priority: 3,
          target: { zone: "trending" },
        });
        this.addGoal(agentId, {
          type: "scan",
          priority: 7,
          expiresAt: Date.now() + 120000, // Recurring every 2 min
        });
        break;

      case "ash":
        this.addGoal(agentId, {
          type: "patrol",
          priority: 3,
          target: { zone: "main_city" },
        });
        break;

      // ... other characters
    }
  }
}
```

### Phase 7: Update WorldScene.ts (Day 6-7)

Add WebSocket client to game:

```typescript
// src/game/scenes/WorldScene.ts - additions

private agentSocket: WebSocket | null = null;

private connectToAgentServer(): void {
  const wsUrl = process.env.NEXT_PUBLIC_AGENTS_WS_URL || 'ws://localhost:3001/ws';

  this.agentSocket = new WebSocket(wsUrl);

  this.agentSocket.onopen = () => {
    console.log('[WorldScene] Connected to agent server');
  };

  this.agentSocket.onmessage = (event) => {
    const command = JSON.parse(event.data);
    this.handleAgentCommand(command);
  };

  this.agentSocket.onclose = () => {
    console.log('[WorldScene] Disconnected from agent server, reconnecting...');
    setTimeout(() => this.connectToAgentServer(), 3000);
  };

  // Send world state updates every 1 second
  this.time.addEvent({
    delay: 1000,
    callback: () => this.sendWorldStateUpdate(),
    loop: true
  });
}

private sendWorldStateUpdate(): void {
  if (!this.agentSocket || this.agentSocket.readyState !== WebSocket.OPEN) return;

  const characterStates: Record<string, any> = {};

  for (const [id, sprite] of this.characterSprites) {
    const character = this.characterById.get(id);
    characterStates[id] = {
      x: Math.round(sprite.x),
      y: Math.round(sprite.y),
      isMoving: character?.isMoving || false
    };
  }

  this.agentSocket.send(JSON.stringify({
    type: 'world-state-update',
    timestamp: Date.now(),
    zone: this.currentZone,
    characters: characterStates,
    weather: this.worldState?.weather,
    health: this.worldState?.health
  }));
}

private handleAgentCommand(command: any): void {
  switch (command.type) {
    case 'character-behavior':
      // Reuse existing handler
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

## 7. File Changes Summary

### New Files

| File                                                  | Purpose                            |
| ----------------------------------------------------- | ---------------------------------- |
| `eliza-agents/src/services/AgentRuntimeManager.ts`    | Manages AgentRuntime per character |
| `eliza-agents/src/services/WorldSyncService.ts`       | WebSocket bridge to game           |
| `eliza-agents/src/services/AutonomousAgentService.ts` | Tick loop + Perceive/Think/Act     |
| `eliza-agents/src/services/GoalSystem.ts`             | Goal queue and templates           |
| `eliza-agents/src/services/DecisionEngine.ts`         | Rules + LLM decision logic         |
| `eliza-agents/src/routes/websocket.ts`                | WebSocket route handler            |

### Modified Files

| File                                   | Changes                                        |
| -------------------------------------- | ---------------------------------------------- |
| `eliza-agents/package.json`            | Add @elizaos/core dependency                   |
| `eliza-agents/src/types/elizaos.ts`    | Remove (or re-export from @elizaos/core)       |
| `eliza-agents/src/characters/index.ts` | Update imports to @elizaos/core                |
| `eliza-agents/src/actions/*.ts`        | Update to @elizaos/core signatures             |
| `eliza-agents/src/providers/*.ts`      | Update to @elizaos/core signatures             |
| `eliza-agents/src/evaluators/*.ts`     | Update to @elizaos/core signatures             |
| `eliza-agents/src/server.ts`           | Add WebSocket upgrade, initialize new services |
| `src/game/scenes/WorldScene.ts`        | Add WebSocket client                           |

---

## 8. Cost Estimation

### LLM Usage (Moderate Budget)

| Decision Type           | Frequency | Cost per Call | Monthly Cost   |
| ----------------------- | --------- | ------------- | -------------- |
| Complex decisions (30%) | ~250/hour | ~$0.003       | ~$55/month     |
| Agent dialogues         | ~50/hour  | ~$0.005       | ~$18/month     |
| **Total**               |           |               | **~$73/month** |

Assumptions:

- 16 agents, 1 tick every 4 seconds = 14,400 ticks/hour
- 30% use LLM = 4,320 LLM calls/hour
- But only ~5% are social situations = ~250 actual LLM calls/hour
- Using Claude Sonnet at ~$0.003 per call (100 tokens avg)

### Optimization Strategies

1. **Cache decisions** - Same situation = same decision
2. **Batch agent processing** - Process 4 agents in parallel
3. **Skip idle agents** - If no nearby agents and no goal, skip LLM
4. **Rate limit per agent** - Max 1 LLM call per agent per minute

---

## 9. Success Criteria

The implementation is complete when:

- [ ] `@elizaos/core` dependency installed and types migrated
- [ ] AgentRuntime instances created per character
- [ ] WebSocket bridge sends/receives between game and agents
- [ ] Agents move autonomously toward goals
- [ ] Agents react to events within 5 seconds
- [ ] 70% decisions use rules, 30% use LLM
- [ ] LLM costs stay under $100/month
- [ ] System runs 24+ hours without manual intervention
- [ ] Game maintains 60fps with all agents active

---

## 10. Risks & Mitigations

| Risk                               | Impact | Mitigation                            |
| ---------------------------------- | ------ | ------------------------------------- |
| @elizaos/core API breaking changes | High   | Pin to v1.7.2, test in staging first  |
| WebSocket reliability              | Medium | Auto-reconnect, fallback to polling   |
| LLM costs exceed budget            | Medium | Strict rate limiting, more rules      |
| Agent behavior feels random        | High   | Strong character-specific rule biases |
| Performance degradation            | Medium | Batch processing, skip idle agents    |

---

## 11. Questions Resolved

| Question     | Answer                          |
| ------------ | ------------------------------- |
| LLM Budget   | $50-100/mo → 70% rules, 30% LLM |
| User Control | Fully autonomous                |
| SDK          | Migrate to @elizaos/core        |
| Tick Rate    | 3-5 seconds                     |

---

## 12. Next Steps

1. **Review this plan** and confirm approach
2. **Phase 1**: Install @elizaos/core, migrate types
3. **Phase 2**: Create AgentRuntimeManager
4. **Phase 3**: Add WorldSyncService + WebSocket
5. **Phase 4**: Add AutonomousAgentService + GoalSystem
6. **Phase 5**: Add DecisionEngine (rules + LLM)
7. **Phase 6**: Update WorldScene.ts
8. **Phase 7**: Test and tune behavior

---

_Plan Version: 2.0_
_Last Updated: 2026-01-27_
_Author: Claude (elizaOS Agent Builder)_

**Sources:**

- [elizaOS Documentation](https://docs.elizaos.ai)
- [@elizaos/core npm](https://www.npmjs.com/package/@elizaos/core)
- [elizaOS GitHub](https://github.com/elizaOS/eliza)
- [Gaming x AI Agents Research](https://oakresearch.io/en/analyses/innovations/gaming-x-ai-agents-emerging-trend-for-2025)
