# Plugin Development Reference

Advanced patterns for building elizaOS plugins.

## Plugin Interface

```typescript
interface Plugin {
  name: string;
  description?: string;

  // Components
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
  services?: (typeof Service)[];
  models?: Record<string, ModelHandler[]>;

  // Dependencies
  dependencies?: string[];

  // Lifecycle Hooks
  init?: (config: any, runtime: IAgentRuntime) => Promise<void>;
  start?: (runtime: IAgentRuntime) => Promise<void>;
  stop?: (runtime: IAgentRuntime) => Promise<void>;

  // Message Hooks
  beforeMessage?: (message: Memory, runtime: IAgentRuntime) => Promise<Memory>;
  afterMessage?: (message: Memory, response: Memory, runtime: IAgentRuntime) => Promise<void>;

  // Action Hooks
  beforeAction?: (action: Action, message: Memory, runtime: IAgentRuntime) => Promise<boolean>;
  afterAction?: (action: Action, result: any, runtime: IAgentRuntime) => Promise<void>;
}
```

---

## Basic Plugin Structure

```typescript
import { Plugin, Action, Provider, Evaluator } from "@elizaos/core";

export const myPlugin: Plugin = {
  name: "@myorg/plugin-custom",
  description: "Custom functionality for my agent",
  dependencies: ["@elizaos/plugin-bootstrap"],

  actions: [],
  providers: [],
  evaluators: [],
  services: [],

  init: async (config, runtime) => {
    console.log("Plugin initializing with config:", config);
  },

  start: async (runtime) => {
    console.log("Plugin started");
  },

  stop: async (runtime) => {
    console.log("Plugin stopped");
  },
};

export default myPlugin;
```

---

## Actions (Agent Capabilities)

Actions are things the agent can DO.

### Action Interface

```typescript
interface Action {
  name: string;
  description: string;
  similes?: string[]; // Trigger phrases
  examples?: ActionExample[][]; // Training examples
  category?: string;
  disabled?: boolean;

  validate?: (runtime: IAgentRuntime, message: Memory, state: State) => Promise<boolean>;

  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: any) => void
  ) => Promise<string>;
}
```

### Decision Flow

```
1. Message received
2. All actions evaluated via validate()
3. Valid actions provided to LLM
4. LLM decides which action(s) to execute
5. Handler generates response
6. Response processed and sent
```

### Action Example

```typescript
const swapAction: Action = {
  name: "SWAP_TOKENS",
  description: "Swap one token for another on Solana",
  similes: ["swap", "exchange", "trade", "convert", "buy", "sell"],

  validate: async (runtime, message, state) => {
    // Check wallet is configured
    const wallet = runtime.getSetting("SOLANA_PRIVATE_KEY");
    if (!wallet) return false;

    // Check message intent
    const text = message.content.text.toLowerCase();
    return text.includes("swap") || text.includes("trade") || text.includes("buy");
  },

  handler: async (runtime, message, state, options, callback) => {
    try {
      const params = await extractSwapParams(runtime, message);

      callback({
        text: `Executing swap: ${params.amount} ${params.inputToken} → ${params.outputToken}...`,
      });

      const result = await executeSwap(params);

      callback({
        text: `Swap complete!\n${result.inputAmount} ${result.inputToken} → ${result.outputAmount} ${result.outputToken}\nTx: ${result.signature}`,
        action: "SWAP_TOKENS",
      });

      return result.signature;
    } catch (error) {
      callback({ text: `Swap failed: ${error.message}` });
      return "error";
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "swap 1 SOL for USDC" } },
      { user: "{{agentName}}", content: { text: "Executing swap...", action: "SWAP_TOKENS" } },
    ],
    [
      { user: "{{user1}}", content: { text: "buy $100 of BONK" } },
      { user: "{{agentName}}", content: { text: "Processing order...", action: "SWAP_TOKENS" } },
    ],
  ],
};
```

### Action with Confirmation

```typescript
const dangerousAction: Action = {
  name: "LARGE_TRANSFER",
  description: "Transfer large amounts (requires confirmation)",

  handler: async (runtime, message, state, options, callback) => {
    const amount = extractAmount(message.content.text);

    // Require confirmation for large amounts
    if (amount > 1) {
      callback({
        text: `This will transfer ${amount} SOL. Reply "confirm" to proceed.`,
        action: "CONFIRM_REQUIRED",
      });

      // Store pending action in state/memory
      await runtime.createMemory({
        content: {
          text: "Pending transfer confirmation",
          metadata: { type: "pending_action", amount, action: "LARGE_TRANSFER" },
        },
        roomId: message.roomId,
      });

      return "awaiting_confirmation";
    }

    // Execute small transfer immediately
    return executeTransfer(amount);
  },
};
```

---

## Providers (Data Sources)

Providers inject context before the LLM responds — the agent's "senses".

### Provider Interface

```typescript
interface Provider {
  name: string;

  get: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ) => Promise<{
    text: string; // Goes into LLM context
    data?: Record<string, unknown>; // Structured data for actions
  }>;
}
```

### Provider Examples

```typescript
// Time provider
const timeProvider: Provider = {
  name: "timeContext",

  get: async (runtime, message, state) => {
    const now = new Date();
    const timeOfDay =
      now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening";

    return {
      text: `Current time: ${now.toISOString()}, Period: ${timeOfDay}`,
      data: { timestamp: now.getTime(), timeOfDay },
    };
  },
};

// User context provider
const userContextProvider: Provider = {
  name: "userContext",

  get: async (runtime, message, state) => {
    const userProfile = await runtime.getEntity(message.entityId);

    if (!userProfile) {
      return { text: "", data: {} };
    }

    return {
      text: `User: ${userProfile.name}`,
      data: {
        userId: message.entityId,
        preferences: userProfile.metadata?.preferences,
        history: userProfile.metadata?.interactionCount,
      },
    };
  },
};

// Conversation history provider
const conversationProvider: Provider = {
  name: "conversationHistory",

  get: async (runtime, message, state) => {
    const recentMemories = await runtime.getMemories({
      roomId: message.roomId,
      count: 10,
      unique: true,
    });

    const history = recentMemories.map((m) => `${m.entityId}: ${m.content.text}`).join("\n");

    return {
      text: `Recent conversation:\n${history}`,
      data: { memoryCount: recentMemories.length },
    };
  },
};
```

### Conditional Provider

```typescript
const priceProvider: Provider = {
  name: "tokenPrices",

  get: async (runtime, message, state) => {
    // Only fetch if tokens are mentioned
    const tokens = extractTokenMentions(message.content.text);

    if (tokens.length === 0) {
      return { text: "", data: {} }; // No context needed
    }

    const prices = await fetchPrices(tokens);

    return {
      text: `Token Prices:\n${formatPrices(prices)}`,
      data: { prices },
    };
  },
};
```

---

## Evaluators (Post-Processing)

Evaluators run AFTER the response is sent.

### Evaluator Interface

```typescript
interface Evaluator {
  name: string;
  description: string;
  alwaysRun?: boolean; // Run on every message

  shouldRun?: (message: Memory, state: State) => boolean;

  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: string) => void,
    responses: Memory[]
  ) => Promise<string>;
}
```

### Evaluator Examples

```typescript
// Quality evaluator - always runs
const qualityEvaluator: Evaluator = {
  name: "QUALITY_EVALUATOR",
  description: "Evaluate response quality",
  alwaysRun: true,

  handler: async (runtime, message, state, options, callback, responses) => {
    const response = responses[0];

    if (!response?.content?.text) {
      return "empty";
    }

    const quality = response.content.text.length > 100 ? "detailed" : "brief";

    await runtime.createMemory({
      content: {
        text: `Quality: ${quality}`,
        metadata: { type: "quality_metric", quality },
      },
      roomId: message.roomId,
    });

    callback(`Quality: ${quality}`);
    return quality;
  },
};

// Fact extraction - conditional
const factEvaluator: Evaluator = {
  name: "EXTRACT_FACTS",
  description: "Extract facts from user messages",

  shouldRun: (message, state) => {
    const text = message.content.text.toLowerCase();
    return text.includes("my") || text.includes("i am") || text.includes("remember");
  },

  handler: async (runtime, message, state, options, callback, responses) => {
    const extraction = await runtime.completion({
      messages: [
        {
          role: "user",
          content: `Extract key facts from: "${message.content.text}"\nReturn as JSON array.`,
        },
      ],
    });

    const facts = JSON.parse(extraction);

    for (const fact of facts) {
      await runtime.createMemory({
        content: { text: fact, metadata: { type: "fact" } },
        roomId: message.roomId,
        embedding: await runtime.embed(fact),
      });
    }

    callback(`Extracted ${facts.length} facts`);
    return `facts: ${facts.length}`;
  },
};
```

---

## Services (Long-Running)

Services handle persistent background operations.

### Service Interface

```typescript
abstract class Service {
  static serviceType: ServiceTypeName;
  status: ServiceStatus;
  runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime);
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
```

### Service Example

```typescript
import { Service, IAgentRuntime } from "@elizaos/core";

class PriceMonitorService extends Service {
  static serviceType = "PRICE_MONITOR";
  private interval?: NodeJS.Timer;
  private watchlist: string[] = ["SOL", "BONK", "WIF"];

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  async start(): Promise<void> {
    this.status = "running";

    this.interval = setInterval(async () => {
      try {
        await this.checkPrices();
      } catch (error) {
        console.error("Price check failed:", error);
      }
    }, 60000);

    console.log("Price monitor started");
  }

  private async checkPrices(): Promise<void> {
    for (const token of this.watchlist) {
      const price = await fetchPrice(token);
      const previousPrice = await this.getPreviousPrice(token);

      if (previousPrice && Math.abs(price.change) > 10) {
        await this.alertPriceChange(token, price);
      }

      await this.storePrice(token, price);
    }
  }

  private async alertPriceChange(token: string, price: any): Promise<void> {
    // Emit event or store alert
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.status = "stopped";
    console.log("Price monitor stopped");
  }
}
```

---

## Lifecycle Hooks

### Message Hooks

```typescript
const loggingPlugin: Plugin = {
  name: "logging-plugin",

  beforeMessage: async (message, runtime) => {
    console.log(`[IN] ${message.content.text}`);

    // Modify message if needed
    return {
      ...message,
      metadata: { ...message.metadata, receivedAt: Date.now() },
    };
  },

  afterMessage: async (message, response, runtime) => {
    console.log(`[OUT] ${response.content.text}`);

    // Log to database, analytics, etc.
    await logConversation(message, response);
  },
};
```

### Action Hooks

```typescript
const auditPlugin: Plugin = {
  name: "audit-plugin",

  beforeAction: async (action, message, runtime) => {
    console.log(`About to execute: ${action.name}`);

    // Return false to cancel action
    if (isBlocked(message.entityId)) {
      console.log("User is blocked, canceling action");
      return false;
    }

    return true;
  },

  afterAction: async (action, result, runtime) => {
    console.log(`Action ${action.name} completed with result:`, result);

    // Audit log
    await logAction(action.name, result);
  },
};
```

---

## Runtime Operations

### Accessing Runtime

```typescript
const handler = async (runtime: IAgentRuntime, message: Memory) => {
  // Get settings
  const apiKey = runtime.getSetting("MY_API_KEY");

  // Access memory
  const memories = await runtime.getMemories({
    roomId: message.roomId,
    count: 10,
  });

  // Search memories
  const relevant = await runtime.searchMemories({
    query: "important facts",
    match_threshold: 0.75,
    count: 5,
  });

  // Create memory
  await runtime.createMemory({
    content: { text: "New fact", metadata: { type: "fact" } },
    roomId: message.roomId,
  });

  // Get service
  const service = runtime.getService("MY_SERVICE");

  // Embed text
  const embedding = await runtime.embed("text to embed");

  // Call LLM
  const response = await runtime.completion({
    messages: [{ role: "user", content: "prompt" }],
  });
};
```

---

## Plugin Registration

### Via Character File

```json
{
  "plugins": ["@elizaos/plugin-bootstrap", "@elizaos/plugin-solana", "./src/plugins/my-plugin"]
}
```

### Via Code

```typescript
const runtime = new AgentRuntime({
  character,
  plugins: [myPlugin, anotherPlugin],
});
```

### Conditional Registration

```typescript
plugins: [
  "@elizaos/plugin-bootstrap",
  ...(process.env.SOLANA_PRIVATE_KEY ? ["@elizaos/plugin-solana"] : []),
];
```

---

## Dependencies

Plugins can declare dependencies:

```typescript
const myPlugin: Plugin = {
  name: "my-plugin",
  dependencies: ["@elizaos/plugin-bootstrap", "@elizaos/plugin-solana"],
  // ...
};
```

elizaOS loads plugins in dependency order via topological sort.

---

## Best Practices

1. **Single responsibility** — Each plugin should do one thing well
2. **Validate inputs** — Check settings and message content
3. **Handle errors** — Never let errors crash the agent
4. **Clean up resources** — Stop services properly
5. **Document everything** — Describe what each component does
6. **Test thoroughly** — Test actions, providers, evaluators
7. **Use TypeScript** — Type safety prevents bugs
8. **Log appropriately** — Debug info, not spam

### Error Handling Pattern

```typescript
handler: async (runtime, message, state, options, callback) => {
  try {
    const result = await riskyOperation();
    callback({ text: `Success: ${result}` });
    return "success";
  } catch (error) {
    console.error("Operation failed:", error);
    callback({ text: `Error: ${error.message}` });
    return "error";
  }
};
```
