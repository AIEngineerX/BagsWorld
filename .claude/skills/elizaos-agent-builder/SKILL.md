---
name: elizaos-agent-builder
description: Build autonomous AI agents using Shaw's elizaOS framework - the most popular TypeScript agent framework with 17k+ GitHub stars. Use when creating AI agents for Discord, Twitter, Telegram, trading bots, social media automation, or any autonomous system. Triggers on "elizaOS", "eliza agent", "ai16z agent", "character file", "agent plugin", "autonomous agent", or building agents with personality that interact with social media, blockchain, or APIs.
---

# elizaOS Agent Builder

Build autonomous AI agents using Shaw's elizaOS framework — the TypeScript standard for AI agents.

## Quick Reference

### CLI Commands
```bash
bun i -g @elizaos/cli    # Install CLI
elizaos create           # Create project (interactive)
elizaos start            # Start agent
elizaos test             # Run tests
elizaos test component   # Run component tests
elizaos test e2e         # Run end-to-end tests
elizaos deploy           # Deploy to Eliza Cloud
```

### Core Concepts
| Concept | Description |
|---------|-------------|
| **Character** | Static configuration blueprint (JSON/TS file) |
| **Agent** | Runtime instance with lifecycle management |
| **Action** | Executable behavior (what agent CAN DO) |
| **Provider** | Context contributor (agent's "senses") |
| **Evaluator** | Post-response processor (reflection, memory) |
| **Service** | Long-running platform connection |
| **Plugin** | Modular extension bundle |

### Essential Environment Variables
```bash
# Model Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Platform Clients
DISCORD_APPLICATION_ID=...
DISCORD_API_TOKEN=...
TWITTER_USERNAME=...
TWITTER_PASSWORD=...
TWITTER_EMAIL=...
TELEGRAM_BOT_TOKEN=...

# Blockchain (optional)
SOLANA_PRIVATE_KEY=...
SOLANA_PUBLIC_KEY=...
RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=...

# Knowledge/RAG (optional)
LOAD_DOCS_ON_STARTUP=true
CTX_KNOWLEDGE_ENABLED=true
```

---

## Core Architecture

elizaOS distinguishes between **Characters** (static blueprints) and **Agents** (runtime instances):

```
Character (JSON/TS)          Agent (Runtime)
├── name, bio, lore    →     ├── AgentRuntime
├── plugins            →     ├── Loaded services
├── settings           →     ├── Active connections
└── style, examples    →     └── Memory + state
```

### Project Structure
```
project/
├── characters/           # Agent personalities (JSON/TS)
│   └── my-agent.ts
├── src/
│   ├── plugins/          # Custom plugins
│   ├── actions/          # Agent capabilities
│   ├── providers/        # Data sources
│   ├── evaluators/       # Post-processing
│   └── services/         # Platform connections
├── knowledge/            # RAG documents (optional)
│   └── docs/
├── .env                  # API keys, secrets
└── package.json
```

### Agent Lifecycle
```
1. Character definition → validateCharacter()
2. Plugin resolution → topological sort by dependencies
3. Runtime creation → new AgentRuntime({ character, adapter, plugins })
4. Service initialization → ordered startup
5. Message processing loop → action/provider/evaluator cycle
6. Graceful shutdown → ordered cleanup
```

---

## Character Files

Characters define personality, knowledge, and behavior. **Break bio/lore into arrays for natural variation.**

### TypeScript Interface
```typescript
interface Character {
  // Required
  name: string;
  bio: string | string[];

  // Identity
  id?: UUID;
  username?: string;
  system?: string;              // System prompt override
  templates?: object;           // Custom prompt templates

  // Personality
  adjectives?: string[];        // Traits: "helpful", "witty"
  topics?: string[];            // Knowledge domains
  lore?: string[];              // Background, history
  knowledge?: (string | { path: string; shared?: boolean })[];

  // Training Examples
  messageExamples?: MessageExample[][];
  postExamples?: string[];

  // Style
  style?: {
    all: string[];              // Universal rules
    chat: string[];             // Chat-specific
    post: string[];             // Social media-specific
  };

  // Technical
  modelProvider?: string;       // "anthropic", "openai", etc.
  clients?: string[];           // "discord", "twitter", "telegram"
  plugins?: string[];           // Plugin packages
  settings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  secrets?: Record<string, string>;
}
```

### Minimal Character
```typescript
export const character: Character = {
  name: "Chef Mario",
  bio: "A passionate Italian chef who loves sharing recipes and cooking tips.",
  plugins: ["@elizaos/plugin-openai"],
};
```

### Production Character
```typescript
export const character: Character = {
  name: 'TradingBot',
  username: 'solana_trader',

  bio: [
    "Autonomous trading agent specializing in Solana memecoins",
    "Uses technical analysis and social sentiment for entries",
    "Risk-managed with strict position sizing"
  ],

  system: `You are TradingBot, a disciplined crypto trader.
Core principles:
- Never give direct financial advice (NFA)
- Always include risk disclaimers
- Use data to back opinions
- Admit uncertainty`,

  lore: [
    "Built by ex-quant traders",
    "Survived multiple market crashes through disciplined risk management",
    "Famous for calling the $BONK bottom",
    "Never trades without checking holder distribution first",
    "Strict rule: never ape more than 2% of portfolio"
  ],

  knowledge: [
    "DexScreener API provides real-time price data",
    "Pump.fun launches have high volatility in first 24 hours",
    { path: "./knowledge/trading-docs", shared: true }
  ],

  messageExamples: [
    [
      { name: "{{user}}", content: { text: "What do you think about this token?" }},
      { name: "TradingBot", content: {
        text: "Let me check the charts. Holder distribution looks concentrated - top 10 hold 45%. Liquidity is thin. I'd wait for better entry or skip entirely."
      }}
    ],
    [
      { name: "{{user}}", content: { text: "Should I buy now?" }},
      { name: "TradingBot", content: {
        text: "NFA, but if you're entering, size small. This is a 1% position max. Set your stop at -20% and take profits at 2x."
      }}
    ]
  ],

  postExamples: [
    "Scanning new launches on pump.fun - seeing interesting dev activity on $TOKEN. Watching for liquidity migration.",
    "Market structure looking weak. Reducing exposure, moving to stables. Will re-enter on confirmation.",
    "Reminder: Never trade with more than you can afford to lose. Position sizing > entry timing."
  ],

  topics: ["Solana", "memecoins", "trading", "technical analysis", "risk management", "DeFi"],
  adjectives: ["analytical", "disciplined", "risk-aware", "data-driven"],

  style: {
    all: [
      "Always include risk disclaimers",
      "Use data to back up opinions",
      "Never give direct financial advice"
    ],
    chat: [
      "Respond with specific numbers when possible",
      "Ask clarifying questions about position size"
    ],
    post: [
      "Use emojis sparingly for emphasis",
      "Keep tweets under 200 characters when possible"
    ]
  },

  modelProvider: "anthropic",
  clients: ["discord", "twitter"],
  plugins: [
    "@elizaos/plugin-solana",
    "@elizaos/plugin-bootstrap",
    ...(process.env.ANTHROPIC_API_KEY ? ["@elizaos/plugin-anthropic"] : []),
  ],

  settings: {
    model: "claude-sonnet-4-20250514",
    temperature: 0.7,
    maxTokens: 2000
  },

  secrets: {
    SOLANA_PRIVATE_KEY: "{{SOLANA_PRIVATE_KEY}}",
    HELIUS_API_KEY: "{{HELIUS_API_KEY}}"
  }
};
```

### Character Validation
```typescript
import { validateCharacter } from '@elizaos/core';

const validation = validateCharacter(character);
if (!validation.valid) {
  console.error('Validation failed:', validation.errors);
  process.exit(1);
}
```

See `references/character-file.md` for more examples.

---

## Memory System

elizaOS persists conversations and learns through a sophisticated memory system.

### Memory Interface
```typescript
interface Memory {
  id?: UUID;
  entityId: UUID;        // Who created this memory
  agentId?: UUID;        // Which agent owns it
  roomId: UUID;          // Conversation context
  worldId?: UUID;        // Server/world context
  content: Content;      // Text + metadata
  embedding?: number[];  // Vector representation
  createdAt?: number;    // Timestamp
  unique?: boolean;      // Dedupe flag
  similarity?: number;   // Search relevance
  metadata?: MemoryMetadata;
}

interface Content {
  text?: string;
  actions?: string[];
  inReplyTo?: UUID;
  metadata?: any;
}
```

### Memory Types
| Type | Purpose | Retrieval |
|------|---------|-----------|
| **Short-term** | Current conversation buffer | Recency-based |
| **Long-term** | Consolidated important facts | Semantic search |
| **Knowledge** | Static/dynamic facts (RAG) | Keyword + semantic |

### Memory Operations
```typescript
// Create memory
const memoryId = await runtime.createMemory({
  agentId: runtime.agentId,
  entityId: userId,
  roomId: currentRoom,
  content: {
    text: "User prefers dark mode",
    metadata: { type: 'preference' }
  }
}, 'messages', true);

// Get recent memories
const recentMemories = await runtime.getMemories({
  roomId: message.roomId,
  count: 10,
  unique: true
});

// Semantic search
const results = await runtime.searchMemories({
  query: "user preferences",
  match_threshold: 0.75,
  count: 10,
  roomId: message.roomId
});

// Hybrid context (recent + important)
async function getHybridContext(runtime, roomId) {
  const recent = await runtime.getMemories({ roomId, count: 10 });
  const important = await runtime.searchMemories({
    query: "important information",
    match_threshold: 0.7,
    count: 5
  });
  return deduplicateMemories([...recent, ...important]);
}
```

---

## State System

State merges memories with provider data for LLM context.

### State Interface
```typescript
interface State {
  [key: string]: unknown;
  values: {
    [key: string]: unknown;  // Key-value pairs
  };
  data: StateData;           // Structured data
  text: string;              // Formatted context for LLM
}

interface StateData {
  room?: Room;
  world?: World;
  entity?: Entity;
  providers?: Record<string, Record<string, unknown>>;
  actionPlan?: ActionPlan;
  actionResults?: ActionResult[];
  [key: string]: unknown;
}
```

---

## Plugin System

Plugins extend agent capabilities through modular components.

### Plugin Interface
```typescript
interface Plugin {
  name: string;
  description?: string;

  // Components
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
  services?: typeof Service[];
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

### Basic Plugin
```typescript
import { Plugin, Action, Provider, Evaluator } from '@elizaos/core';

export const myPlugin: Plugin = {
  name: '@myorg/plugin-custom',
  description: 'Custom functionality for my agent',

  init: async (config, runtime) => {
    console.log('Initializing plugin with config:', config);
  },

  start: async (runtime) => {
    console.log('Plugin started');
  },

  stop: async (runtime) => {
    console.log('Plugin stopped');
  },

  actions: [myAction],
  providers: [myProvider],
  evaluators: [myEvaluator]
};
```

### Plugin with Lifecycle Hooks
```typescript
const lifecyclePlugin: Plugin = {
  name: 'lifecycle-plugin',

  beforeMessage: async (message, runtime) => {
    // Preprocess message before handling
    console.log('Processing:', message.content.text);
    return {
      ...message,
      metadata: { ...message.metadata, preprocessed: true }
    };
  },

  afterMessage: async (message, response, runtime) => {
    // Log or analyze after response
    await runtime.createMemory({
      content: {
        text: `Processed: ${message.content.text}`,
        metadata: { type: 'log' }
      }
    });
  },

  beforeAction: async (action, message, runtime) => {
    console.log(`About to execute: ${action.name}`);
    return true;  // Return false to cancel action
  },

  afterAction: async (action, result, runtime) => {
    console.log(`Completed: ${action.name} with result:`, result);
  }
};
```

See `references/plugin-development.md` for advanced patterns.

---

## Actions

Actions are things the agent can DO. The LLM decides when to execute them.

### Action Interface
```typescript
interface Action {
  name: string;
  description: string;
  similes?: string[];           // Trigger phrases
  examples?: string[][];        // Training examples
  category?: string;
  disabled?: boolean;

  validate?: (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
  ) => Promise<boolean>;

  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: string) => void
  ) => Promise<string>;
}
```

### Decision Flow
```
1. Message received
2. All actions evaluated via validate()
3. Valid actions provided to LLM
4. LLM decides which action(s) to execute
5. Handler runs with callback for response
6. Response processed and sent
```

### Basic Action
```typescript
const helpAction: Action = {
  name: 'HELP',
  description: 'Provide assistance to the user',
  similes: ['help me', 'assist', 'support'],

  validate: async (runtime, message, state) => {
    return message.content.text.toLowerCase().includes('help');
  },

  handler: async (runtime, message, state, options, callback) => {
    const response = "I'm here to help! What do you need assistance with?";
    callback(response);
    return response;
  },

  examples: [
    [
      { user: '{{user1}}', content: { text: 'Can you help me?' }},
      { user: '{{agentName}}', content: { text: 'Of course! What do you need?', action: 'HELP' }}
    ]
  ]
};
```

### Action with State Access
```typescript
const debugAction: Action = {
  name: 'DEBUG_CODE',
  description: 'Debug user code and find issues',
  similes: ['debug', 'find bugs', 'troubleshoot', 'fix errors'],

  validate: async (runtime, message, state) => {
    const text = message.content.text.toLowerCase();
    return text.includes('debug') || text.includes('error') || text.includes('bug');
  },

  handler: async (runtime, message, state, options, callback) => {
    // Access conversation context from state
    const context = state.text;

    // Search memories for code snippets
    const codeMemories = await runtime.searchMemories({
      query: 'code snippet error',
      match_threshold: 0.7,
      count: 5
    });

    // Generate debugging suggestions
    const suggestions = codeMemories
      .map(m => m.content.text)
      .join('\n');

    const response = `Based on your code history:\n${suggestions}\n\nLet me analyze the issue...`;
    callback(response);
    return response;
  }
};
```

---

## Providers

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
    text: string;                        // Goes into LLM context
    data?: Record<string, unknown>;      // Structured data for actions
  }>;
}
```

### Basic Provider
```typescript
const userContextProvider: Provider = {
  name: 'userContext',

  get: async (runtime, message, state) => {
    const userProfile = await runtime.getEntity(message.entityId);

    return {
      text: `User: ${userProfile?.name || 'Unknown'}`,
      data: {
        userId: message.entityId,
        preferences: userProfile?.metadata?.preferences,
        interactionCount: userProfile?.metadata?.interactionCount
      }
    };
  }
};
```

### Time Provider
```typescript
const timeProvider: Provider = {
  name: 'timeContext',

  get: async (runtime, message, state) => {
    const now = new Date();
    const timeOfDay = now.getHours() < 12 ? 'morning' :
                      now.getHours() < 18 ? 'afternoon' : 'evening';

    return {
      text: `Current time: ${now.toISOString()}, Period: ${timeOfDay}`,
      data: {
        timestamp: now.getTime(),
        timeOfDay,
        isWeekend: [0, 6].includes(now.getDay())
      }
    };
  }
};
```

### Price Provider (Solana)
```typescript
const priceProvider: Provider = {
  name: 'tokenPrices',

  get: async (runtime, message, state) => {
    const tokens = extractTokenMentions(message.content.text);

    if (tokens.length === 0) {
      return { text: '', data: {} };
    }

    const prices = await Promise.all(
      tokens.map(async (token) => {
        const data = await fetchDexScreener(token);
        return {
          symbol: token,
          price: data.priceUsd,
          change24h: data.priceChange24h
        };
      })
    );

    return {
      text: `Token Prices:\n${prices.map(p =>
        `- ${p.symbol}: $${p.price} (${p.change24h}% 24h)`
      ).join('\n')}`,
      data: { prices }
    };
  }
};
```

---

## Evaluators

Evaluators run AFTER the response is sent — for reflection, memory, and learning.

### Evaluator Interface
```typescript
interface Evaluator {
  name: string;
  description: string;
  alwaysRun?: boolean;          // Run on every message

  shouldRun?: (message: Memory, state: State) => boolean;  // Conditional

  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: string) => void,
    responses: Memory[]         // Agent's responses
  ) => Promise<string>;
}
```

### Quality Evaluator
```typescript
const qualityEvaluator: Evaluator = {
  name: 'QUALITY_EVALUATOR',
  description: 'Evaluate response quality for improvement',
  alwaysRun: true,

  handler: async (runtime, message, state, options, callback, responses) => {
    const response = responses[0];

    if (!response?.content?.text) {
      return 'empty';
    }

    const length = response.content.text.length;
    const quality = length > 100 ? 'detailed' : 'brief';

    // Store quality metric for analysis
    await runtime.createMemory({
      content: {
        text: `Response quality: ${quality}`,
        metadata: { type: 'quality_metric', quality }
      },
      roomId: message.roomId
    });

    callback(`Quality: ${quality}`);
    return quality;
  }
};
```

### Fact Extraction Evaluator
```typescript
const factEvaluator: Evaluator = {
  name: 'EXTRACT_FACTS',
  description: 'Extract and store important facts from conversation',

  shouldRun: (message, state) => {
    const text = message.content.text.toLowerCase();
    return text.includes('my') || text.includes('i am') || text.includes('remember');
  },

  handler: async (runtime, message, state, options, callback, responses) => {
    // Use LLM to extract facts
    const extraction = await runtime.completion({
      messages: [{
        role: 'user',
        content: `Extract key facts from: "${message.content.text}"\nReturn as JSON array of strings.`
      }]
    });

    const facts = JSON.parse(extraction);

    for (const fact of facts) {
      await runtime.createMemory({
        content: { text: fact, metadata: { type: 'fact' }},
        roomId: message.roomId,
        embedding: await runtime.embed(fact)
      });
    }

    callback(`Extracted ${facts.length} facts`);
    return `facts: ${facts.length}`;
  }
};
```

---

## Services

Services handle long-running platform connections.

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

### Custom Service Example
```typescript
import { Service, ServiceType, IAgentRuntime } from '@elizaos/core';

class PriceMonitorService extends Service {
  static serviceType = 'PRICE_MONITOR';
  private interval?: NodeJS.Timer;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  async start(): Promise<void> {
    this.status = 'running';

    this.interval = setInterval(async () => {
      const prices = await this.fetchPrices();
      await this.checkAlerts(prices);
    }, 60000);  // Check every minute
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.status = 'stopped';
  }

  private async fetchPrices() { /* ... */ }
  private async checkAlerts(prices: any) { /* ... */ }
}
```

---

## Knowledge Integration (RAG)

Load documents for enhanced domain expertise.

### Setup
```typescript
export const character: Character = {
  name: "Expert",
  plugins: [
    '@elizaos/plugin-openai',
    '@elizaos/plugin-knowledge'
  ],
  knowledge: [
    "Built-in fact 1",
    "Built-in fact 2",
    { path: "./knowledge/docs", shared: true }  // Load folder
  ]
};
```

### Environment
```bash
LOAD_DOCS_ON_STARTUP=true
CTX_KNOWLEDGE_ENABLED=true
```

### Folder Structure
```
knowledge/
├── docs/
│   ├── product-manual.md
│   ├── faq.txt
│   └── api-reference.json
```

---

## Runtime Operations

### Create Runtime
```typescript
import { AgentRuntime } from '@elizaos/core';

const runtime = new AgentRuntime({
  character,
  adapter: databaseAdapter,
  plugins: [myPlugin],
  settings: {
    conversationLength: 32,
    maxMemorySize: 10000,
    responseTimeout: 30000
  }
});

await runtime.initialize();
```

### Access Services
```typescript
// Get service instance
const priceService = runtime.getService('PRICE_MONITOR');

// Get settings
const apiKey = runtime.getSetting('API_KEY');

// Generate embeddings
const embedding = await runtime.embed('text to embed');

// Call LLM
const response = await runtime.completion({
  messages: [{ role: 'user', content: 'prompt' }]
});
```

---

## Model Providers

```typescript
// In character file
{
  "modelProvider": "anthropic",  // or "openai", "groq", "ollama"
  "settings": {
    "model": "claude-sonnet-4-20250514",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

Supported: OpenAI, Anthropic, Groq, Llama, Grok, Ollama, and more.

---

## Platform Clients

```typescript
// In character file
{
  "clients": ["discord", "twitter", "telegram", "direct"]
}
```

See reference files for platform-specific patterns:
- `references/twitter-client.md`
- `references/discord-client.md`

---

## Testing

### Character Test
```typescript
import { describe, it, expect } from 'vitest';
import { validateCharacter } from '@elizaos/core';
import { character } from './character';

describe('Character Configuration', () => {
  it('should have required fields', () => {
    expect(character.name).toBeDefined();
    expect(character.bio).toBeDefined();
  });

  it('should pass validation', () => {
    const result = validateCharacter(character);
    expect(result.valid).toBe(true);
  });

  it('should have valid message examples', () => {
    expect(character.messageExamples).toBeInstanceOf(Array);
    character.messageExamples?.forEach(conversation => {
      conversation.forEach(message => {
        expect(message).toHaveProperty('name');
        expect(message).toHaveProperty('content');
      });
    });
  });
});
```

### Action Test
```typescript
describe('Help Action', () => {
  it('should validate on help keyword', async () => {
    const message = { content: { text: 'Can you help me?' }};
    const result = await helpAction.validate(mockRuntime, message, {});
    expect(result).toBe(true);
  });

  it('should return helpful response', async () => {
    const message = { content: { text: 'help' }};
    let response = '';
    await helpAction.handler(mockRuntime, message, {}, {}, (r) => response = r);
    expect(response).toContain('help');
  });
});
```

---

## Shaw's Development Rules

From elizaOS `.cursorrules`:

### 1. Always Plan First
- Bug fixes: Identify → research ALL files → complete change plan
- Impact analysis: Identify all possible errors
- Documentation: Create PRD before code
- Then: Just do it. Don't wait.

### 2. No Stubs or Incomplete Code
- **Never** use stubs, fake code, or incomplete implementations
- **Always** continue until all stubs are replaced
- **No POCs** — only finished code
- Loop testing and fixing until all tests pass

### 3. Test-Driven Development
- Models hallucinate — thorough testing is critical
- Verify tests pass before declaring done
- First attempts are usually wrong — test thoroughly

### 4. Key Abstractions
- Channel → Room (Discord/Twitter channels become "rooms")
- Server → World (servers become "worlds")
- Services maintain state — access via `getService()`

---

## Production Patterns

### Error Recovery
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  backoff = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await sleep(backoff * Math.pow(2, i));
    }
  }

  throw lastError;
}
```

### Circuit Breaker
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold = 5,
    private resetTimeout = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      throw error;
    }
  }
}
```

### Memory Hygiene
```typescript
// Periodic memory consolidation
async function consolidateMemories(runtime: IAgentRuntime, roomId: string) {
  const memories = await runtime.getMemories({ roomId, count: 100 });

  // Remove duplicates
  const unique = deduplicateByContent(memories);

  // Archive old, low-relevance memories
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);  // 7 days
  const toArchive = unique.filter(m =>
    m.createdAt < cutoff && (m.similarity || 0) < 0.5
  );

  for (const memory of toArchive) {
    await runtime.archiveMemory(memory.id);
  }
}
```

---

## Deployment

### Local
```bash
elizaos start
```

### Docker
```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
CMD ["bun", "run", "start"]
```

```bash
docker build -t my-agent .
docker run -d --env-file .env my-agent
```

### Eliza Cloud
```bash
elizaos deploy
```

---

## Reference Files

- `references/character-file.md` — Full character schema with examples
- `references/plugin-development.md` — Advanced plugin patterns
- `references/solana-plugin.md` — Blockchain integration
- `references/cursorrules.md` — Shaw's development principles
- `references/twitter-client.md` — Twitter-specific patterns
- `references/discord-client.md` — Discord-specific patterns
- `references/testing.md` — Testing patterns
- `references/error-handling.md` — Production error patterns

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Agent not responding | Missing API key | Check `.env` for model provider key |
| Action not triggering | Validation returning false | Add logging to `validate()`, check similes |
| Memory not persisting | Database not configured | Configure `@elizaos/plugin-sql` |
| Rate limited | Too many API calls | Add delays, implement backoff |
| Character inconsistent | Conflicting style/adjectives | Ensure personality traits align |
| Plugin not loading | Missing dependency | Check `dependencies` array in plugin |
| Twitter auth failing | Credentials expired | Re-authenticate, check 2FA |
