# Multi-Agent Patterns Reference

Coordination patterns for building systems with multiple elizaOS agents.

## Core Concepts

| Concept             | Description                       |
| ------------------- | --------------------------------- |
| **Agent Swarm**     | Multiple agents working together  |
| **Coordinator**     | Agent that orchestrates others    |
| **Specialist**      | Agent focused on one domain       |
| **Shared Memory**   | Cross-agent knowledge pool        |
| **Message Routing** | Directing messages between agents |

---

## Agent Hierarchy

### Parent-Child Pattern

```typescript
// Parent coordinator agent
const coordinator: Character = {
  name: "Coordinator",
  bio: "Orchestrates specialist agents for complex tasks",

  knowledge: [
    "Delegates trading tasks to TradingAgent",
    "Delegates research to ResearchAgent",
    "Delegates social tasks to SocialAgent",
  ],
};

// Child specialist agents
const tradingAgent: Character = {
  name: "TradingAgent",
  bio: "Specialist in executing trades and monitoring prices",
  // Focused knowledge and actions
};

const researchAgent: Character = {
  name: "ResearchAgent",
  bio: "Specialist in analyzing tokens and market trends",
};
```

### Permission Model

```typescript
interface AgentPermissions {
  canCreateChild: boolean;
  canControlSiblings: boolean;
  memoryAccessLevel: "own" | "parent" | "shared" | "all";
  actionScope: string[]; // Allowed action names
}

const coordinatorPermissions: AgentPermissions = {
  canCreateChild: true,
  canControlSiblings: true,
  memoryAccessLevel: "all",
  actionScope: ["*"],
};

const specialistPermissions: AgentPermissions = {
  canCreateChild: false,
  canControlSiblings: false,
  memoryAccessLevel: "parent",
  actionScope: ["TRADE", "ANALYZE", "REPORT"],
};
```

---

## Message Routing

### Inter-Agent Communication

```typescript
interface AgentMessage {
  from: string; // Agent ID
  to: string; // Target agent ID or 'broadcast'
  type: "request" | "response" | "event" | "command";
  payload: any;
  correlationId?: string;
  timestamp: number;
}

class AgentMessageBus {
  private agents: Map<string, IAgentRuntime> = new Map();
  private queues: Map<string, AgentMessage[]> = new Map();

  register(agentId: string, runtime: IAgentRuntime): void {
    this.agents.set(agentId, runtime);
    this.queues.set(agentId, []);
  }

  async send(message: AgentMessage): Promise<void> {
    if (message.to === "broadcast") {
      for (const [id, queue] of this.queues) {
        if (id !== message.from) {
          queue.push(message);
        }
      }
    } else {
      const queue = this.queues.get(message.to);
      if (queue) {
        queue.push(message);
      }
    }
  }

  async receive(agentId: string): Promise<AgentMessage | null> {
    const queue = this.queues.get(agentId);
    return queue?.shift() || null;
  }
}
```

### Delegation Pattern

```typescript
const delegateAction: Action = {
  name: "DELEGATE_TASK",
  description: "Delegate task to specialist agent",

  handler: async (runtime, message, state, options, callback) => {
    const { task, targetAgent } = parseTaskRequest(message.content.text);

    // Send task to specialist
    const messageBus = runtime.getService("messageBus") as AgentMessageBus;

    const delegationMessage: AgentMessage = {
      from: runtime.agentId,
      to: targetAgent,
      type: "request",
      payload: { task, context: state.text },
      correlationId: generateId(),
      timestamp: Date.now(),
    };

    await messageBus.send(delegationMessage);

    callback(`Task delegated to ${targetAgent}. Awaiting response...`);
    return delegationMessage.correlationId;
  },
};
```

---

## Shared Memory

### Cross-Agent Memory Pool

```typescript
class SharedMemoryPool {
  private memories: Map<string, Memory[]> = new Map();

  async add(memory: Memory, accessGroups: string[] = ["all"]): Promise<string> {
    const id = generateId();

    for (const group of accessGroups) {
      const pool = this.memories.get(group) || [];
      pool.push({ ...memory, id });
      this.memories.set(group, pool);
    }

    return id;
  }

  async query(accessGroup: string, filter: (m: Memory) => boolean): Promise<Memory[]> {
    const pool = this.memories.get(accessGroup) || [];
    return pool.filter(filter);
  }

  async searchSemantic(
    accessGroup: string,
    embedding: number[],
    threshold: number = 0.7
  ): Promise<Memory[]> {
    const pool = this.memories.get(accessGroup) || [];

    return pool
      .filter((m) => m.embedding)
      .map((m) => ({
        memory: m,
        similarity: cosineSimilarity(embedding, m.embedding!),
      }))
      .filter((r) => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .map((r) => r.memory);
  }
}
```

### Shared Knowledge Provider

```typescript
const sharedKnowledgeProvider: Provider = {
  name: "sharedKnowledge",

  get: async (runtime, message, state) => {
    const sharedMemory = runtime.getService("sharedMemory") as SharedMemoryPool;
    const agentGroup = runtime.getSetting("AGENT_GROUP") || "default";

    // Get relevant shared knowledge
    const embedding = await runtime.embed(message.content.text);
    const relevant = await sharedMemory.searchSemantic(agentGroup, embedding, 0.75);

    if (relevant.length === 0) {
      return { text: "", data: {} };
    }

    const knowledge = relevant
      .slice(0, 5)
      .map((m) => m.content.text)
      .join("\n- ");

    return {
      text: `Shared knowledge:\n- ${knowledge}`,
      data: { sharedMemories: relevant },
    };
  },
};
```

---

## Coordinator Patterns

### Task Distribution

```typescript
interface Task {
  id: string;
  type: string;
  priority: number;
  payload: any;
  assignedTo?: string;
  status: "pending" | "assigned" | "in_progress" | "completed" | "failed";
}

class TaskCoordinator {
  private tasks: Map<string, Task> = new Map();
  private agents: Map<string, { capabilities: string[]; load: number }> = new Map();

  registerAgent(agentId: string, capabilities: string[]): void {
    this.agents.set(agentId, { capabilities, load: 0 });
  }

  async assignTask(task: Task): Promise<string | null> {
    // Find best agent for task
    let bestAgent: string | null = null;
    let lowestLoad = Infinity;

    for (const [agentId, info] of this.agents) {
      if (info.capabilities.includes(task.type) && info.load < lowestLoad) {
        bestAgent = agentId;
        lowestLoad = info.load;
      }
    }

    if (bestAgent) {
      task.assignedTo = bestAgent;
      task.status = "assigned";
      this.tasks.set(task.id, task);

      const agentInfo = this.agents.get(bestAgent)!;
      agentInfo.load++;

      return bestAgent;
    }

    return null;
  }

  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.assignedTo) {
      task.status = "completed";
      const agentInfo = this.agents.get(task.assignedTo);
      if (agentInfo) agentInfo.load--;
    }
  }
}
```

### Load Balancing

```typescript
type LoadBalanceStrategy = "round_robin" | "least_loaded" | "random" | "capability";

class LoadBalancer {
  private roundRobinIndex = 0;

  selectAgent(agents: string[], loads: Map<string, number>, strategy: LoadBalanceStrategy): string {
    switch (strategy) {
      case "round_robin":
        const agent = agents[this.roundRobinIndex % agents.length];
        this.roundRobinIndex++;
        return agent;

      case "least_loaded":
        return agents.reduce((best, current) =>
          (loads.get(current) || 0) < (loads.get(best) || 0) ? current : best
        );

      case "random":
        return agents[Math.floor(Math.random() * agents.length)];

      default:
        return agents[0];
    }
  }
}
```

---

## Event-Driven Coordination

### Event Bus

```typescript
type EventType = "price_alert" | "new_token" | "trade_executed" | "error" | "status_update";

interface AgentEvent {
  type: EventType;
  source: string;
  data: any;
  timestamp: number;
}

class AgentEventBus {
  private subscribers: Map<EventType, Set<(event: AgentEvent) => void>> = new Map();

  subscribe(eventType: EventType, handler: (event: AgentEvent) => void): () => void {
    const handlers = this.subscribers.get(eventType) || new Set();
    handlers.add(handler);
    this.subscribers.set(eventType, handlers);

    // Return unsubscribe function
    return () => handlers.delete(handler);
  }

  publish(event: AgentEvent): void {
    const handlers = this.subscribers.get(event.type) || new Set();
    handlers.forEach((handler) => handler(event));

    // Also publish to 'all' subscribers
    const allHandlers = this.subscribers.get("*" as EventType) || new Set();
    allHandlers.forEach((handler) => handler(event));
  }
}
```

### Event-Driven Agent

```typescript
const eventPlugin: Plugin = {
  name: "event-listener",

  start: async (runtime) => {
    const eventBus = runtime.getService("eventBus") as AgentEventBus;

    // Subscribe to relevant events
    eventBus.subscribe("price_alert", async (event) => {
      console.log(`[${runtime.agentId}] Price alert:`, event.data);
      // React to price alert
      await handlePriceAlert(runtime, event.data);
    });

    eventBus.subscribe("new_token", async (event) => {
      console.log(`[${runtime.agentId}] New token:`, event.data);
      // Analyze new token
      await analyzeNewToken(runtime, event.data);
    });
  },
};

// Publishing events
const priceMonitorPlugin: Plugin = {
  name: "price-monitor",

  start: async (runtime) => {
    const eventBus = runtime.getService("eventBus") as AgentEventBus;

    setInterval(async () => {
      const prices = await fetchPrices();

      for (const price of prices) {
        if (price.change24h > 20) {
          eventBus.publish({
            type: "price_alert",
            source: runtime.agentId,
            data: { token: price.symbol, change: price.change24h },
            timestamp: Date.now(),
          });
        }
      }
    }, 60000);
  },
};
```

---

## Consensus Patterns

### Voting Mechanism

```typescript
interface Vote {
  agentId: string;
  decision: string;
  confidence: number;
  reasoning: string;
}

class ConsensusManager {
  async collectVotes(
    agents: IAgentRuntime[],
    question: string,
    options: string[],
    timeout: number = 30000
  ): Promise<Vote[]> {
    const votePromises = agents.map(async (agent) => {
      const response = await agent.completion({
        messages: [
          {
            role: "user",
            content: `Question: ${question}\nOptions: ${options.join(", ")}\n\nChoose one option and explain your reasoning. Format: DECISION: <option>\nCONFIDENCE: <0-1>\nREASONING: <explanation>`,
          },
        ],
      });

      return parseVote(agent.agentId, response);
    });

    const results = await Promise.allSettled(votePromises);
    return results
      .filter((r): r is PromiseFulfilledResult<Vote> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  determineConsensus(votes: Vote[]): { decision: string; confidence: number } {
    // Weight by confidence
    const weighted: Map<string, number> = new Map();

    for (const vote of votes) {
      const current = weighted.get(vote.decision) || 0;
      weighted.set(vote.decision, current + vote.confidence);
    }

    // Find winner
    let winner = "";
    let maxWeight = 0;
    for (const [decision, weight] of weighted) {
      if (weight > maxWeight) {
        winner = decision;
        maxWeight = weight;
      }
    }

    const totalWeight = Array.from(weighted.values()).reduce((a, b) => a + b, 0);

    return {
      decision: winner,
      confidence: maxWeight / totalWeight,
    };
  }
}
```

---

## Multi-Agent System Setup

### System Bootstrap

```typescript
async function createAgentSwarm(config: {
  coordinator: Character;
  specialists: Character[];
  sharedMemoryEnabled: boolean;
}): Promise<{
  coordinator: AgentRuntime;
  specialists: AgentRuntime[];
  messageBus: AgentMessageBus;
}> {
  // Create shared services
  const messageBus = new AgentMessageBus();
  const eventBus = new AgentEventBus();
  const sharedMemory = config.sharedMemoryEnabled ? new SharedMemoryPool() : null;

  // Create coordinator
  const coordinatorRuntime = new AgentRuntime({
    character: config.coordinator,
    plugins: [coordinatorPlugin, ...(sharedMemory ? [sharedMemoryPlugin] : [])],
  });

  messageBus.register(coordinatorRuntime.agentId, coordinatorRuntime);

  // Create specialists
  const specialistRuntimes = await Promise.all(
    config.specialists.map(async (char) => {
      const runtime = new AgentRuntime({
        character: char,
        plugins: [specialistPlugin, ...(sharedMemory ? [sharedMemoryPlugin] : [])],
      });

      messageBus.register(runtime.agentId, runtime);
      return runtime;
    })
  );

  // Initialize all
  await coordinatorRuntime.initialize();
  await Promise.all(specialistRuntimes.map((r) => r.initialize()));

  return {
    coordinator: coordinatorRuntime,
    specialists: specialistRuntimes,
    messageBus,
  };
}
```

---

## Best Practices

1. **Single responsibility** — Each agent should have one clear purpose
2. **Loose coupling** — Agents communicate via messages, not direct calls
3. **Shared nothing** — Use explicit shared memory, not implicit state
4. **Graceful degradation** — System works if agents fail
5. **Clear hierarchy** — Define who controls whom
6. **Event-driven** — React to events, don't poll constantly
7. **Consensus for critical decisions** — Multiple agents vote on important choices
8. **Monitor health** — Track agent status and load
9. **Rate limit inter-agent communication** — Prevent message storms
10. **Log all coordination** — Debug multi-agent issues

### Anti-Patterns to Avoid

- **Chatty agents** — Too many small messages
- **Tight coupling** — Direct runtime references
- **Circular dependencies** — A delegates to B delegates to A
- **Single point of failure** — Coordinator that can't recover
- **Memory leaks** — Unbounded shared memory growth
