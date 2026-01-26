# ElizaOS Reference Documentation

Summary of key ElizaOS concepts for BagsWorld migration.
Source: https://docs.elizaos.ai/llms-full.txt

---

## Core Concepts

### AgentRuntime

The central orchestrator that manages an agent's lifecycle, memory, and capabilities.

```typescript
import { AgentRuntime, ModelProviderName } from '@elizaos/core';

const runtime = new AgentRuntime({
  character: myCharacter,
  modelProvider: ModelProviderName.ANTHROPIC,
  databaseAdapter: myDatabaseAdapter,
  plugins: [myPlugin],
  token: process.env.ANTHROPIC_API_KEY,
});

await runtime.initialize();
```

Key methods:
- `runtime.processMessage(message)` - Process user input and generate response
- `runtime.getService<T>(serviceType)` - Get registered service
- `runtime.getSetting(key)` - Get configuration value
- `runtime.messageManager` - Access conversation memory

---

### Plugins

Bundles of functionality that extend agents.

```typescript
import type { Plugin, IAgentRuntime } from '@elizaos/core';

export const myPlugin: Plugin = {
  name: '@my/plugin',
  description: 'Plugin description',

  // Called when plugin loads
  init: async (config: Record<string, string>, runtime: IAgentRuntime): Promise<void> => {
    console.log('Plugin initializing...');
  },

  // Components
  actions: [...],      // Tools agents can use
  providers: [...],    // Context injected into prompts
  evaluators: [...],   // Response evaluation
  services: [...],     // Singleton services
};
```

---

### Services

Long-running singletons that provide capabilities to agents.

```typescript
import { Service, IAgentRuntime } from '@elizaos/core';

export class MyService extends Service {
  static readonly serviceType = 'my_service';
  readonly capabilityDescription = 'What this service does';

  // Lifecycle: start
  static async start(runtime: IAgentRuntime): Promise<MyService> {
    const service = new MyService(runtime);
    // Initialize resources
    return service;
  }

  // Lifecycle: stop
  async stop(): Promise<void> {
    // Cleanup resources
  }

  // Custom methods
  async doSomething(): Promise<string> {
    return 'result';
  }
}

// Access in other code
const service = runtime.getService<MyService>('my_service');
```

---

### Providers

Supply context that gets injected into agent prompts. Run in parallel.

```typescript
import { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';

export const worldStateProvider: Provider = {
  name: 'worldState',
  description: 'Current BagsWorld state',

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<string> => {
    const worldData = await fetchWorldState();
    return `
CURRENT WORLD STATE:
- Health: ${worldData.health}%
- Weather: ${worldData.weather}
- Buildings: ${worldData.buildingCount}
    `;
  },
};
```

Multiple providers run in parallel; their outputs are concatenated into the system prompt.

---

### Actions

Tools that agents can invoke during conversation.

```typescript
import { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

export const lookupTokenAction: Action = {
  name: 'LOOKUP_TOKEN',
  description: 'Look up information about a Bags.fm token',

  // When should this action be considered?
  similes: ['check token', 'find token', 'token info'],

  // Validation: should this action run?
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes('token') || text.includes('look up');
  },

  // Execute the action
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback
  ): Promise<void> => {
    const bagsApi = runtime.getService<BagsApiService>('bags_api');
    const tokenData = await bagsApi.getTokenInfo(options.mint);

    callback({
      text: `Token: ${tokenData.name}\nPrice: $${tokenData.price}\nVolume: ${tokenData.volume}`,
    });
  },

  examples: [
    [
      { user: 'user', content: { text: 'Look up the BAGS token' } },
      { user: 'agent', content: { text: 'Let me check that token for you...' } },
    ],
  ],
};
```

---

### Characters

Define agent personality and behavior.

```typescript
import type { Character } from '@elizaos/core';

export const myCharacter: Character = {
  name: 'MyAgent',

  // Background and knowledge
  bio: [
    'First line of background',
    'Second line of background',
  ],

  // Communication style
  style: {
    all: ['Uses technical language', 'Stays concise'],
    chat: ['Friendly tone', 'Uses emojis sparingly'],
  },

  // Areas of expertise
  topics: ['Solana', 'DeFi', 'Trading'],

  // Personality traits
  adjectives: ['helpful', 'knowledgeable', 'witty'],

  // System prompt (optional, overrides auto-generated)
  system: 'You are MyAgent, an expert in...',

  // Model settings
  settings: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
  },

  // Plugin configuration
  plugins: ['@elizaos/plugin-bagsworld'],
};
```

---

### Memory System

ElizaOS stores conversation history and can retrieve relevant context.

```typescript
// Store a memory
await runtime.messageManager.createMemory({
  id: uuidv4(),
  userId: 'user-123',
  agentId: runtime.agentId,
  roomId: 'room-456',
  content: { text: 'User message here' },
  createdAt: Date.now(),
});

// Retrieve recent memories
const memories = await runtime.messageManager.getMemories({
  roomId: 'room-456',
  count: 10,
  unique: true,
});

// Search memories by embedding similarity
const relevantMemories = await runtime.messageManager.searchMemoriesByEmbedding(
  embedding,
  { roomId: 'room-456', count: 5 }
);
```

---

### Database Adapters

ElizaOS supports multiple databases:

```typescript
// PostgreSQL (Neon)
import { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres';
const adapter = new PostgresDatabaseAdapter({
  connectionString: process.env.DATABASE_URL,
});

// SQLite (local development)
import { SqliteDatabaseAdapter } from '@elizaos/adapter-sqlite';
const adapter = new SqliteDatabaseAdapter('./data/agent.db');
```

---

## Model Configuration

### Anthropic (Claude)

```typescript
import { ModelProviderName } from '@elizaos/core';

const runtime = new AgentRuntime({
  modelProvider: ModelProviderName.ANTHROPIC,
  token: process.env.ANTHROPIC_API_KEY,
  // ...
});
```

Available models:
- `claude-sonnet-4-20250514` (recommended)
- `claude-3-5-sonnet-20241022`
- `claude-3-haiku-20240307`

### OpenAI

```typescript
const runtime = new AgentRuntime({
  modelProvider: ModelProviderName.OPENAI,
  token: process.env.OPENAI_API_KEY,
  // ...
});
```

---

## Plugin Ecosystem

Common ElizaOS plugins:

| Plugin | Purpose |
|--------|---------|
| `@elizaos/plugin-solana` | Solana blockchain integration |
| `@elizaos/plugin-telegram` | Telegram bot client |
| `@elizaos/plugin-discord` | Discord bot client |
| `@elizaos/plugin-twitter` | Twitter/X integration |
| `@elizaos/adapter-postgres` | PostgreSQL database |
| `@elizaos/adapter-sqlite` | SQLite database |

---

## Multi-Agent Coordination

ElizaOS supports running multiple agents with shared context:

```typescript
// Initialize multiple agents
const agents = new Map<string, AgentRuntime>();

for (const character of characters) {
  const runtime = new AgentRuntime({
    character,
    databaseAdapter: sharedDatabase,  // Shared database for cross-agent memory
    plugins: [sharedPlugin],
  });
  await runtime.initialize();
  agents.set(character.name.toLowerCase(), runtime);
}

// Route messages to appropriate agent
app.post('/chat/:agentId', async (req, res) => {
  const runtime = agents.get(req.params.agentId);
  const response = await runtime.processMessage(req.body);
  res.json(response);
});
```

---

## Logging

```typescript
import { elizaLogger } from '@elizaos/core';

elizaLogger.info('Information message');
elizaLogger.warn('Warning message');
elizaLogger.error('Error message', error);
elizaLogger.debug('Debug details', { data });
```

---

## Environment Variables

Common configuration:

```bash
# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Database
DATABASE_URL=postgresql://...
NEON_DATABASE_URL=postgresql://...

# Plugin-specific
BAGS_API_KEY=...
BAGS_API_URL=https://public-api-v2.bags.fm/api/v1
SOLANA_RPC_URL=...

# Server
PORT=3001
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000
```

---

## BagsWorld Plugin Components

Your `plugin-bagsworld` includes:

### Services
- `BagsApiService` - Bags.fm API integration
- `LLMService` - Claude/OpenAI API wrapper

### Providers
- `worldStateProvider` - Injects current world health/weather
- `tokenDataProvider` - Injects relevant token data
- `topCreatorsProvider` - Injects creator leaderboard

### Actions
- `lookupToken` - Look up token by mint address
- `getCreatorFees` - Get fee data for a creator
- `getTopCreators` - Get top creators leaderboard
- `getRecentLaunches` - Get recent token launches
- `checkWorldHealth` - Get current world state

### Characters (8 agents)
- `toly` - Solana co-founder, blockchain expert
- `finn` - Bags.fm CEO, creator monetization
- `ash` - Pokemon-themed guide
- `ghost` - Trading agent, market analysis
- `neo` - Scout agent, alpha hunting
- `cj` - Community vibes
- `shaw` - ElizaOS creator, multi-agent systems
- `bags-bot` - Market data bot

---

## Further Reading

- ElizaOS GitHub: https://github.com/elizaOS/eliza
- Full Documentation: https://docs.elizaos.ai
- Plugin Development: https://docs.elizaos.ai/plugins
