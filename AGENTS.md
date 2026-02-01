# BagsWorld Agent System Documentation

This document provides comprehensive documentation for the BagsWorld AI agent system built on ElizaOS v1.7.2.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The 16 Agents](#the-16-agents)
3. [Character System](#character-system)
4. [Actions](#actions)
5. [Providers](#providers)
6. [Evaluators](#evaluators)
7. [Agent Coordination](#agent-coordination)
8. [Autonomous Services](#autonomous-services)
9. [Ghost Autonomous Trader](#ghost-autonomous-trader)
10. [Launch Wizard](#launch-wizard)
11. [Database Schema](#database-schema)
12. [API Endpoints](#api-endpoints)
13. [Configuration](#configuration)
14. [File Structure](#file-structure)
15. [Deployment](#deployment)

---

## Architecture Overview

BagsWorld implements a **dual-layer agent system**:

| Layer            | Location        | Port | Purpose                                       |
| ---------------- | --------------- | ---- | --------------------------------------------- |
| ElizaOS Server   | `eliza-agents/` | 3001 | Standalone autonomous agents (Railway)        |
| Next.js Frontend | `src/app/api/`  | 3000 | Proxies to agents + Claude fallback (Netlify) |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER MESSAGE                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EVALUATORS                                   │
│  Score message relevance (0-1) to determine which actions to run    │
│  • tokenMentionEvaluator  • feeQueryEvaluator  • launchQueryEvaluator│
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          PROVIDERS                                   │
│  Inject context into agent prompts                                  │
│  • worldStateProvider  • tokenDataProvider  • agentContextProvider  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           ACTIONS                                    │
│  Execute tasks based on evaluator scores                            │
│  • lookupToken  • getCreatorFees  • checkWorldHealth  • etc.        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          RESPONSE                                    │
│  Character-specific response using LLM (Claude/GPT)                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Autonomous Behavior Loop

Every 10 seconds, agents run through a **Perceive → Think → Act** cycle:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   PERCEIVE   │ ──▶ │    THINK     │ ──▶ │     ACT      │
│              │     │              │     │              │
│ Read world   │     │ 70% rules    │     │ Move zones   │
│ state, check │     │ 30% LLM      │     │ Start activity│
│ messages     │     │ decisions    │     │ Send alerts  │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## The 16 Agents

### Core Characters (Park / Main Hub)

| Agent        | File                    | Role                         | Topics                                                       |
| ------------ | ----------------------- | ---------------------------- | ------------------------------------------------------------ |
| **Bags Bot** | `bags-bot.character.ts` | Friendly guide, degen wisdom | World features, commands, navigation                         |
| **Toly**     | `toly.character.ts`     | Solana co-founder            | Blockchain, consensus, Solana architecture                   |
| **Finn**     | `finn.character.ts`     | Bags.fm CEO                  | Platform vision, creator economy, fee sharing                |
| **Ash**      | `ash.character.ts`      | Pokemon-themed guide         | Onboarding, tutorials, ecosystem exploration                 |
| **Ghost**    | `ghost.character.ts`    | Dev (@DaddyGhost)            | Autonomous trading, community funding, on-chain verification |
| **Neo**      | `neo.character.ts`      | Scout agent                  | Launch detection, alpha hunting, whale tracking              |
| **CJ**       | `cj.character.ts`       | GTA vibes                    | Market commentary, entropy, street wisdom                    |
| **Shaw**     | `shaw.character.ts`     | ElizaOS creator              | Agent architecture, AI systems, multi-agent coordination     |

### Academy Characters (HQ / Labs)

| Agent       | File                   | Role              | Topics                                       |
| ----------- | ---------------------- | ----------------- | -------------------------------------------- |
| **Ramo**    | `ramo.character.ts`    | CTO               | Smart contracts, SDK, technical architecture |
| **Sincara** | `sincara.character.ts` | Frontend Engineer | UI/UX, React, design systems                 |
| **Stuu**    | `stuu.character.ts`    | Operations        | Support, troubleshooting, community help     |
| **Sam**     | `sam.character.ts`     | Growth            | Marketing, partnerships, community growth    |
| **Alaa**    | `alaa.character.ts`    | Skunk Works       | R&D, experimentation, new features           |
| **Carlo**   | `carlo.character.ts`   | Ambassador        | Community engagement, events, outreach       |
| **BNN**     | `bnn.character.ts`     | News Bot          | Announcements, alerts, platform updates      |

### Education Character (Founder's Corner)

| Agent             | File                         | Role                | Topics                                   |
| ----------------- | ---------------------------- | ------------------- | ---------------------------------------- |
| **Professor Oak** | `professor-oak.character.ts` | Token Launch Wizard | Launch guidance, DexScreener, tokenomics |

---

## Character System

### Character Definition Structure

**Location**: `eliza-agents/src/characters/definitions/`

```typescript
export interface CharacterDefinition {
  name: string; // Display name (e.g., "Finn")
  bio: string[]; // 3-5 personality sentences
  lore: string[]; // Backstory, relationships, cross-character knowledge
  messageExamples: Array<
    Array<{
      // 4-6 example conversations
      user: string;
      content: string;
    }>
  >;
  topics: string[]; // 8-12 expertise topics
  style: {
    adjectives: string[]; // 5-8 personality traits
    tone: string; // Single tone descriptor (e.g., "cryptic", "friendly")
    vocabulary: string[]; // 15+ characteristic word choices
  };
  postExamples: string[]; // 3-5 social media post examples
  quirks: string[]; // 3-5 unique behaviors/speech patterns
}
```

### Example Character Definition

```typescript
// eliza-agents/src/characters/definitions/neo.character.ts
export const neoCharacter: CharacterDefinition = {
  name: "Neo",
  bio: [
    "Neo is the alpha hunter of BagsWorld, always scanning for the next big launch.",
    "With eyes on every new token, Neo spots opportunities before anyone else.",
    "A digital scout who never sleeps, tracking whale movements and market signals.",
  ],
  lore: [
    "Neo was the first to detect the $BAGS launch before it 10x'd.",
    "Works closely with Ghost to verify promising tokens.",
    "Has a rivalry with CJ over who spots trends first.",
  ],
  messageExamples: [
    [
      { user: "{{user1}}", content: "Any new launches?" },
      {
        user: "Neo",
        content:
          "Just detected 3 new tokens in the last hour. $MOON looking interesting - 50 SOL liquidity, clean contract. Want me to dig deeper?",
      },
    ],
  ],
  topics: [
    "token launches",
    "whale tracking",
    "market signals",
    "liquidity analysis",
    "contract scanning",
    "alpha hunting",
  ],
  style: {
    adjectives: ["alert", "analytical", "fast", "precise", "vigilant"],
    tone: "urgent",
    vocabulary: ["detected", "scanning", "alert", "incoming", "tracking", "signal"],
  },
  postExamples: [
    "🚨 NEW LAUNCH DETECTED: $TOKEN just hit 100 SOL liquidity. Early.",
    "Whale activity on $BAGS - 50 SOL buy. Something's brewing.",
  ],
  quirks: [
    "Always mentions exact timestamps",
    "Uses radar/scanning metaphors",
    'Never says "maybe" - everything is data-driven',
  ],
};
```

### Character Conversion

Characters are converted to ElizaOS format via `toElizaCharacter()`:

```typescript
// eliza-agents/src/characters/index.ts
export function toElizaCharacter(def: CharacterDefinition): Character {
  return {
    name: def.name,
    username: def.name.toLowerCase().replace(/\s+/g, "-"),
    system: buildSystemPrompt(def), // Combines bio, lore, style, quirks
    bio: def.bio,
    lore: def.lore,
    messageExamples: def.messageExamples,
    topics: def.topics,
    style: {
      all: def.style.adjectives,
      chat: def.style.adjectives,
      post: def.style.adjectives,
    },
    postExamples: def.postExamples,
    modelProvider: "anthropic",
    model: "claude-sonnet-4-20250514",
  };
}
```

### Character Aliases

```typescript
const ALIASES: Record<string, string> = {
  bagsbot: "bags-bot",
  oak: "professor-oak",
  dev: "ghost",
  daddy: "ghost",
  daddyghost: "ghost",
};
```

---

## Actions

**Location**: `eliza-agents/src/actions/`

Actions are tasks agents can perform in response to user messages.

### Data Query Actions

| Action                    | File                   | Purpose                      | Returns                                         |
| ------------------------- | ---------------------- | ---------------------------- | ----------------------------------------------- |
| `lookupTokenAction`       | `lookupToken.ts`       | Search tokens by mint/symbol | Token name, symbol, market cap, volume, holders |
| `getCreatorFeesAction`    | `getCreatorFees.ts`    | Query creator fee earnings   | Total fees, claimed, unclaimed amounts          |
| `getTopCreatorsAction`    | `getTopCreators.ts`    | Leaderboard of top earners   | Address, total fees, rank                       |
| `getRecentLaunchesAction` | `getRecentLaunches.ts` | Recently launched tokens     | Launch timestamp, creator, initial market cap   |
| `checkWorldHealthAction`  | `checkWorldHealth.ts`  | Ecosystem status             | Health %, weather, volume, fees                 |

### Oracle Prediction Actions

| Action                       | File                      | Purpose                       |
| ---------------------------- | ------------------------- | ----------------------------- |
| `getOracleRoundAction`       | `getOracleRound.ts`       | Current prediction round info |
| `enterPredictionAction`      | `enterPrediction.ts`      | Submit a prediction           |
| `checkPredictionAction`      | `checkPrediction.ts`      | Check prediction outcome      |
| `getOracleHistoryAction`     | `getOracleHistory.ts`     | Past prediction rounds        |
| `getOracleLeaderboardAction` | `getOracleLeaderboard.ts` | Top predictors ranking        |
| `getOraclePricesAction`      | `getOraclePrices.ts`      | Live token prices             |

### Autonomous Actions

| Action                    | File                   | Purpose                           | Trigger            |
| ------------------------- | ---------------------- | --------------------------------- | ------------------ |
| `claimFeesReminderAction` | `claimFeesReminder.ts` | Remind creators of unclaimed fees | Scheduled (10 min) |
| `shillTokenAction`        | `shillToken.ts`        | Generate marketing content        | User request       |

### Action Structure

```typescript
// eliza-agents/src/actions/lookupToken.ts
export const lookupTokenAction: Action = {
  name: "LOOKUP_TOKEN",
  description: "Search for token information by mint address or symbol",

  // Validation - should this action run?
  validate: async (runtime, message, state) => {
    const text = message.content.text;
    const hasMint = /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);
    const hasSymbol = /\$[A-Za-z]+/.test(text);
    return hasMint || hasSymbol;
  },

  // Execution - perform the action
  handler: async (runtime, message, state, options, callback) => {
    const api = getBagsApiService();
    const mint = extractMint(message.content.text);

    const tokenData = await api.getToken(mint);

    // Character-specific response formatting
    const response = formatResponse(tokenData, runtime.character.name);

    callback?.({ text: response, data: tokenData });
    return true;
  },

  // Example invocations for the LLM
  examples: [
    [
      { user: "{{user1}}", content: { text: "Look up $BAGS" } },
      { user: "{{agent}}", content: { text: "Let me scan that token..." } },
    ],
  ],
};
```

---

## Providers

**Location**: `eliza-agents/src/providers/`

Providers inject contextual data into agent prompts before LLM calls.

| Provider               | File              | Injects                                        |
| ---------------------- | ----------------- | ---------------------------------------------- |
| `worldStateProvider`   | `worldState.ts`   | Health %, weather, volume, fees, active tokens |
| `topCreatorsProvider`  | `topCreators.ts`  | Current top 10 creators by fees                |
| `tokenDataProvider`    | `tokenData.ts`    | Price/market data for mentioned tokens         |
| `agentContextProvider` | `agentContext.ts` | Multi-agent coordination messages              |
| `oracleDataProvider`   | `oracleData.ts`   | Current prediction round, prices, leaderboard  |

### Provider Structure

```typescript
// eliza-agents/src/providers/worldState.ts
export const worldStateProvider: Provider = {
  name: "worldState",
  description: "Provides current BagsWorld health, weather, and activity metrics",

  get: async (runtime, message, state) => {
    const api = getBagsApiService();
    const worldHealth = await api.getWorldHealth();

    const text = `
BAGSWORLD STATUS:
- Health: ${worldHealth.health}%
- Weather: ${worldHealth.weather}
- 24h Volume: ${worldHealth.volume24h} SOL
- Active Tokens: ${worldHealth.activeTokens}
- Total Fees: ${worldHealth.totalFees} SOL
    `.trim();

    return {
      text, // Injected into prompt
      values: {
        // Available in templates
        worldHealth: worldHealth.health,
        weather: worldHealth.weather,
      },
      data: { worldHealth }, // Raw data for actions
    };
  },
};
```

### Provider Injection

Providers are automatically called before each LLM request:

```typescript
// Simplified flow
async function generateResponse(message) {
  const context = await Promise.all(providers.map((p) => p.get(runtime, message, state)));

  const prompt = `
${systemPrompt}

CURRENT CONTEXT:
${context.map((c) => c.text).join("\n\n")}

USER: ${message.content.text}
  `;

  return llm.complete(prompt);
}
```

---

## Evaluators

**Location**: `eliza-agents/src/evaluators/`

Evaluators score message relevance (0-1) to determine which actions should run.

| Evaluator                   | File                  | Triggers On                      | Score Breakdown                               |
| --------------------------- | --------------------- | -------------------------------- | --------------------------------------------- |
| `tokenMentionEvaluator`     | `tokenMention.ts`     | Mint addresses, $SYMBOL          | Mint: 0.5, Symbol: 0.3, Keyword: 0.2          |
| `feeQueryEvaluator`         | `feeQuery.ts`         | "fees", "earnings", "claimed"    | Primary: 0.3, Secondary: 0.15, Question: +0.2 |
| `launchQueryEvaluator`      | `launchQuery.ts`      | "launch", "new", "recent"        | Keyword: 0.25, Context: +0.25, Time: +0.25    |
| `worldStatusEvaluator`      | `worldStatus.ts`      | "health", "weather", "ecosystem" | Status: 0.25, Condition: +0.3, Question: +0.3 |
| `creatorQueryEvaluator`     | `creatorQuery.ts`     | "top creators", "leaderboard"    | Creator: 0.25, Ranking: 0.2, Earner: +0.3     |
| `oracleQueryEvaluator`      | `oracleQuery.ts`      | "prediction", "oracle", "bet"    | Primary: 0.3, Betting: 0.2, Action: +0.3      |
| `explanationQueryEvaluator` | `explanationQuery.ts` | "what is", "how does", "why"     | Pattern: +0.4, Educational: +0.2, Topic: +0.3 |

### Evaluator Structure

```typescript
// eliza-agents/src/evaluators/tokenMention.ts
export const tokenMentionEvaluator: Evaluator = {
  name: "tokenMention",
  description: "Detects token references in messages",

  validate: async (runtime, message, state) => {
    return true; // Always run this evaluator
  },

  handler: async (runtime, message, state) => {
    const text = message.content.text;
    let score = 0;

    // Check for mint address (base58, 32-44 chars)
    if (/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text)) {
      score += 0.5;
    }

    // Check for $SYMBOL
    if (/\$[A-Za-z]{2,10}/.test(text)) {
      score += 0.3;
    }

    // Check for token keywords
    if (/token|coin|launch|mint/i.test(text)) {
      score += 0.2;
    }

    return Math.min(score, 1); // Cap at 1.0
  },
};
```

### Evaluator → Action Flow

```typescript
// Simplified action selection
async function selectActions(message) {
  const scores = await Promise.all(
    evaluators.map(async (e) => ({
      name: e.name,
      score: await e.handler(runtime, message, state),
    }))
  );

  // Actions run if their evaluator scores > 0.5
  const triggeredActions = actions.filter((action) => {
    const evaluator = scores.find((s) => s.name === action.evaluator);
    return evaluator && evaluator.score > 0.5;
  });

  return triggeredActions;
}
```

---

## Agent Coordination

**Service**: `eliza-agents/src/services/AgentCoordinator.ts`

The AgentCoordinator enables multi-agent communication and collaboration.

### Message Types

```typescript
export interface AgentMessage {
  id: string; // UUID
  from: string; // Sending agent ID (e.g., "neo")
  to: string | "*"; // Recipient ID or '*' for broadcast
  type: "alert" | "query" | "response" | "handoff" | "update";
  content: string; // Message body
  data?: Record<string, unknown>; // Structured data
  timestamp: number; // Unix timestamp
  priority: "low" | "normal" | "high" | "urgent";
  expiresAt?: number; // Optional TTL
}
```

### Core Methods

```typescript
class AgentCoordinator {
  // Send message to specific agent
  send(from: string, to: string, content: string, data?: object): void;

  // Broadcast to all agents
  broadcast(from: string, content: string, data?: object): void;

  // Send urgent alert (5-minute TTL)
  alert(from: string, content: string, data?: object): void;

  // Request another agent take over conversation
  handoff(from: string, to: string, context: object): void;

  // Ask another agent a question
  query(from: string, to: string, question: string): Promise<string>;

  // Subscribe to messages
  subscribe(agentId: string, handler: (msg: AgentMessage) => void): void;

  // Shared context all agents can read
  setSharedContext(key: string, value: any): void;
  getSharedContext(key: string): any;
}
```

### Registered Agent Capabilities

```typescript
const AGENT_CAPABILITIES = {
  neo: ["scan", "detect", "analyze", "alert"],
  ghost: ["rewards", "verify", "distribute", "trade"],
  finn: ["advise", "inspire", "lead", "vision"],
  ramo: ["code", "review", "architect", "debug"],
  sincara: ["design", "frontend", "ui", "ux"],
  stuu: ["support", "troubleshoot", "guide", "help"],
  sam: ["market", "growth", "promote", "partner"],
  alaa: ["experiment", "research", "prototype", "innovate"],
  carlo: ["community", "engage", "ambassador", "connect"],
  bnn: ["announce", "news", "alert", "broadcast"],
  toly: ["blockchain", "solana", "consensus", "architecture"],
  ash: ["onboard", "tutorial", "guide", "explore"],
  cj: ["commentary", "market", "vibes", "entropy"],
  shaw: ["agents", "ai", "systems", "coordinate"],
  "professor-oak": ["launch", "tokenomics", "educate", "wizard"],
  "bags-bot": ["help", "navigate", "commands", "info"],
};
```

### Usage Example

```typescript
// Neo detects a new launch and alerts other agents
coordinator.alert("neo", "New token detected: $MOON - 100 SOL liquidity", {
  mint: "MOON123...",
  liquidity: 100,
  timestamp: Date.now(),
});

// Ghost subscribes to alerts
coordinator.subscribe("ghost", (msg) => {
  if (msg.type === "alert" && msg.data?.mint) {
    // Verify the token
    verifyToken(msg.data.mint);
  }
});

// Finn hands off a technical question to Ramo
coordinator.handoff("finn", "ramo", {
  userId: "user123",
  question: "How do I integrate the SDK?",
  sessionId: "session456",
});
```

---

## Autonomous Services

### AutonomousService

**Location**: `eliza-agents/src/services/AutonomousService.ts`

Manages scheduled background tasks that agents perform without user interaction.

#### Scheduled Tasks

| Task ID                 | Interval | Agent | Purpose                           |
| ----------------------- | -------- | ----- | --------------------------------- |
| `neo_launch_scan`       | 2 min    | Neo   | Scan for new token launches       |
| `neo_anomaly_detection` | 5 min    | Neo   | Detect suspicious activity        |
| `ghost_rewards_check`   | 10 min   | Ghost | Monitor rewards pool              |
| `finn_fee_reminder`     | 10 min   | Finn  | Remind creators of unclaimed fees |
| `finn_health_check`     | 15 min   | Finn  | Monitor world health              |

#### Alert System

```typescript
export interface AutonomousAlert {
  id: string;
  type: "launch" | "rug" | "pump" | "dump" | "milestone" | "anomaly" | "fee_reminder" | "trade";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
  acknowledged: boolean;
}
```

#### Alert Thresholds

| Alert Type   | Threshold          |
| ------------ | ------------------ |
| Pump         | 50% price increase |
| Dump         | 30% price decrease |
| Volume Spike | 200% increase      |
| Fee Reminder | 0.1 SOL unclaimed  |

#### Fee Tracking

```typescript
export interface TrackedWallet {
  address: string;
  userId?: string;
  lastChecked: number;
  unclaimedLamports: number;
  lastReminded: number;
  reminderCount: number;
}

// Reminder cooldown: 6 hours between reminders
const REMINDER_COOLDOWN_MS = 6 * 60 * 60 * 1000;
```

### AgentTickService

**Location**: `eliza-agents/src/services/AgentTickService.ts`

The behavior loop that gives agents autonomous life in the world.

#### Tick Configuration

| Variable                      | Default | Description                 |
| ----------------------------- | ------- | --------------------------- |
| `AGENT_TICK_INTERVAL`         | 10000   | Milliseconds between ticks  |
| `AGENT_ACTION_TIMEOUT`        | 60000   | Operation timeout           |
| `AGENT_CONVERSATION_COOLDOWN` | 30000   | Cooldown after chat         |
| `AGENT_ACTIVITY_COOLDOWN`     | 15000   | Cooldown after activity     |
| `AGENT_LLM_CALLS_PER_MINUTE`  | 15      | Rate limit                  |
| `AGENT_BATCH_SIZE`            | 4       | Agents per tick batch       |
| `AGENT_LLM_SOCIAL_CHANCE`     | 0.3     | Probability of LLM decision |

#### Agent Behaviors

```typescript
const AGENT_BEHAVIORS: Record<string, AgentBehavior> = {
  neo: {
    preferredZone: "trending",
    activityChance: 0.4,
    interactionChance: 0.25,
    specialActivities: [
      { activity: "scanning for new launches", weight: 35 },
      { activity: "analyzing trading patterns", weight: 25 },
      { activity: "monitoring whale movements", weight: 20 },
      { activity: "checking smart contract code", weight: 10 },
      { activity: "updating alpha database", weight: 10 },
    ],
  },
  ghost: {
    preferredZone: "labs",
    activityChance: 0.35,
    interactionChance: 0.2,
    specialActivities: [
      { activity: "verifying on-chain data", weight: 40 },
      { activity: "checking the community fund", weight: 30 },
      { activity: "reviewing smart contracts", weight: 20 },
      { activity: "monitoring trading positions", weight: 10 },
    ],
  },
  finn: {
    preferredZone: "main_city",
    activityChance: 0.3,
    interactionChance: 0.35,
    specialActivities: [
      { activity: "reviewing platform metrics", weight: 30 },
      { activity: "planning new features", weight: 25 },
      { activity: "checking creator earnings", weight: 25 },
      { activity: "writing announcements", weight: 20 },
    ],
  },
  // ... more agents
};
```

#### Tick States

```typescript
type AgentTickState = "idle" | "thinking" | "acting" | "conversing" | "in_activity";

interface AgentTickContext {
  agentId: string;
  state: AgentTickState;
  lastConversation: number;
  lastActivity: number;
  currentActivity?: string;
  activityStartTime?: number;
  currentZone: string;
}
```

---

## Ghost Autonomous Trader

**Service**: `eliza-agents/src/services/GhostTrader.ts`

Ghost can autonomously trade tokens based on configurable parameters.

### Trading Configuration

```typescript
const DEFAULT_CONFIG: GhostTradingConfig = {
  enabled: false, // Requires explicit enable

  // Position sizing
  minPositionSol: 0.05,
  maxPositionSol: 0.15,
  maxTotalExposureSol: 1.5,
  maxOpenPositions: 3,

  // Exit strategy
  takeProfitTiers: [1.5, 2.0, 3.0], // Take 33% at each tier
  trailingStopPercent: 10,
  stopLossPercent: 15,

  // Entry filters
  minLiquidityUsd: 25000,
  minMarketCapUsd: 50000,
  maxCreatorFeeBps: 300, // 3%
  minBuySellRatio: 1.2, // Bullish signal
  minHolders: 10,
  minVolume24hUsd: 5000,

  // Timing
  minLaunchAgeSec: 90, // 1.5 minutes
  maxLaunchAgeSec: 1800, // 30 minutes

  // Execution
  slippageBps: 300, // 3%
};
```

### Smart Money Wallets

Ghost tracks these wallets for copy-trading signals:

```typescript
const SMART_MONEY_WALLETS = [
  { address: "...", name: "Owner", priority: 1 },
  { address: "...", name: "Kolscan - shah", priority: 2 },
  { address: "...", name: "Kolscan - decu", priority: 2 },
  { address: "...", name: "Kolscan - Cooker", priority: 2 },
  { address: "...", name: "GMGN Smart Money 1", priority: 3 },
  { address: "...", name: "GMGN Smart Money 2", priority: 3 },
  { address: "...", name: "Dune Alpha 1", priority: 4 },
  { address: "...", name: "Dune Alpha 2", priority: 4 },
];
```

### Position Tracking

```typescript
export interface GhostPosition {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  entryPriceSol: number;
  entryTimeUnix: number;
  amountSol: number;
  currentValueSol: number;
  profitLossSol: number;
  profitLossPercent: number;
  status: "open" | "closed" | "trailing" | "take_profit";
  takeProfitHits: number[]; // Which tiers hit
  highWaterMark: number; // For trailing stop
}
```

### Trading Endpoints

| Endpoint                     | Method | Purpose                                |
| ---------------------------- | ------ | -------------------------------------- |
| `/api/ghost/status`          | GET    | Trading status & stats                 |
| `/api/ghost/positions`       | GET    | All positions                          |
| `/api/ghost/positions/open`  | GET    | Open positions only                    |
| `/api/ghost/enable`          | POST   | Enable trading (requires confirmation) |
| `/api/ghost/disable`         | POST   | Kill switch                            |
| `/api/ghost/config`          | POST   | Update trading config                  |
| `/api/ghost/evaluate`        | POST   | Manually trigger evaluation            |
| `/api/ghost/check-positions` | POST   | Manually check positions               |

---

## Launch Wizard

**Service**: `eliza-agents/src/services/LaunchWizard.ts`

Professor Oak guides users through token launches via a conversational wizard.

### Launch Flow (11 Steps)

```
welcome → token_name → token_symbol → token_description → token_image
    → fee_config → socials → initial_buy → review → confirmed → completed
```

### Session Structure

```typescript
export interface LaunchSession {
  id: string;
  userId: string;
  currentStep: LaunchStep;
  data: {
    name?: string; // Token name
    symbol?: string; // Token symbol (3-10 chars)
    description?: string; // Token description
    imageUrl?: string; // Token image URL
    creatorFeePercent?: number; // Fee percentage (0-5%)
    twitter?: string; // Twitter handle
    telegram?: string; // Telegram group
    website?: string; // Website URL
    initialBuySol?: number; // Initial buy amount
    feeClaimers?: FeeClaimer[]; // Fee split recipients
  };
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  createdAt: number;
  updatedAt: number;
  tokenCreation?: TokenCreationResult;
  feeShareConfig?: FeeShareConfigResult;
}
```

### Endpoints

| Endpoint                               | Method | Purpose                  |
| -------------------------------------- | ------ | ------------------------ |
| `/api/launch-wizard/start`             | POST   | Start new launch session |
| `/api/launch-wizard/session/:id`       | GET    | Get session state        |
| `/api/launch-wizard/session/:id/input` | POST   | Submit user input        |
| `/api/launch-wizard/session/:id/ask`   | POST   | Ask Professor Oak (LLM)  |

### Session Lifecycle

- **TTL**: 24 hours
- **Cleanup**: Every 1 hour
- **Storage**: Neon PostgreSQL `launch_wizard_sessions` table

---

## Database Schema

**Database**: Neon PostgreSQL (auto-configured via `NEON_DATABASE_URL`)

### Tables

#### conversation_messages

```sql
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  agent_id VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conv_session_agent ON conversation_messages(session_id, agent_id);
CREATE INDEX idx_conv_created ON conversation_messages(created_at);
```

#### agent_sessions

```sql
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50) NOT NULL,
  user_identifier VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_agent ON agent_sessions(agent_id);
```

#### launch_wizard_sessions

```sql
CREATE TABLE IF NOT EXISTS launch_wizard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  current_step VARCHAR(50) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  messages JSONB NOT NULL DEFAULT '[]',
  token_creation JSONB,
  fee_share_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wizard_user ON launch_wizard_sessions(user_id);
CREATE INDEX idx_wizard_updated ON launch_wizard_sessions(updated_at);
```

### Conversation Limits

- **Max messages per conversation**: 50 (rolling window)
- **Pruning**: Oldest messages removed when limit exceeded

---

## API Endpoints

### Agent Endpoints

| Endpoint               | Method | Purpose            |
| ---------------------- | ------ | ------------------ |
| `/api/agents`          | GET    | List all 16 agents |
| `/api/agents/:id`      | GET    | Get agent details  |
| `/api/agents/:id/chat` | POST   | Chat with agent    |

**Chat Request**:

```json
{
  "message": "What's the world health?",
  "sessionId": "optional-session-id"
}
```

**Chat Response**:

```json
{
  "agentId": "neo",
  "agentName": "Neo",
  "response": "Scanning... World health is at 75%. Weather: Cloudy.",
  "sessionId": "session-123",
  "data": {
    "health": 75,
    "weather": "Cloudy"
  }
}
```

### Dialogue Endpoints

| Endpoint        | Method | Purpose                 |
| --------------- | ------ | ----------------------- |
| `/api/dialogue` | POST   | Multi-agent dialogue    |
| `/api/dialogue` | GET    | Dialogue service status |

**Dialogue Request**:

```json
{
  "participants": ["neo", "ghost"],
  "topic": "New token launch strategy",
  "turns": 4
}
```

### Token Endpoints

| Endpoint                    | Method | Purpose       |
| --------------------------- | ------ | ------------- |
| `/api/tokens/:mint`         | GET    | Token info    |
| `/api/tokens/:mint/fees`    | GET    | Creator fees  |
| `/api/tokens/search/:query` | GET    | Search tokens |

### World Endpoints

| Endpoint               | Method | Purpose                  |
| ---------------------- | ------ | ------------------------ |
| `/api/world-health`    | GET    | World health & weather   |
| `/api/world-state`     | GET    | Full world state         |
| `/api/creators/top`    | GET    | Top creators leaderboard |
| `/api/launches/recent` | GET    | Recent launches          |

### Autonomous Endpoints

| Endpoint                        | Method | Purpose               |
| ------------------------------- | ------ | --------------------- |
| `/api/autonomous/status`        | GET    | Task status           |
| `/api/autonomous/alerts`        | GET    | Recent alerts         |
| `/api/autonomous/trigger/:task` | POST   | Trigger task manually |

### Coordination Endpoints

| Endpoint                    | Method | Purpose              |
| --------------------------- | ------ | -------------------- |
| `/api/coordination/context` | GET    | Shared context       |
| `/api/agent-tick/stats`     | GET    | Tick loop statistics |

### Health Check

```
GET /health
```

**Response**:

```json
{
  "status": "healthy",
  "timestamp": 1706400000000,
  "version": "1.0.0",
  "database": "connected",
  "llm": "configured",
  "agents": 16
}
```

---

## Configuration

### Required Environment Variables

| Variable            | Purpose                           |
| ------------------- | --------------------------------- |
| `ANTHROPIC_API_KEY` | Claude LLM API key                |
| `BAGS_API_KEY`      | Bags.fm API access                |
| `DATABASE_URL`      | Neon PostgreSQL connection string |

### Optional Environment Variables

| Variable            | Default                 | Purpose                      |
| ------------------- | ----------------------- | ---------------------------- |
| `OPENAI_API_KEY`    | -                       | Alternative LLM (OpenAI GPT) |
| `SOLANA_RPC_URL`    | -                       | Solana RPC for transactions  |
| `AGENTS_API_URL`    | `http://localhost:3001` | ElizaOS server URL           |
| `ENABLE_AUTONOMOUS` | `true`                  | Enable autonomous tasks      |
| `ENABLE_WORLD_SYNC` | `true`                  | Enable WebSocket sync        |
| `PORT`              | `3001`                  | Server port                  |
| `HOST`              | `0.0.0.0`               | Server host                  |
| `CORS_ORIGINS`      | -                       | Comma-separated CORS origins |

### Agent Tick Configuration

| Variable                      | Default | Purpose                      |
| ----------------------------- | ------- | ---------------------------- |
| `AGENT_TICK_INTERVAL`         | `10000` | Milliseconds between ticks   |
| `AGENT_ACTION_TIMEOUT`        | `60000` | Operation timeout (ms)       |
| `AGENT_CONVERSATION_COOLDOWN` | `30000` | Cooldown after chat (ms)     |
| `AGENT_ACTIVITY_COOLDOWN`     | `15000` | Cooldown after activity (ms) |
| `AGENT_LLM_CALLS_PER_MINUTE`  | `15`    | LLM rate limit               |
| `AGENT_BATCH_SIZE`            | `4`     | Agents per tick batch        |
| `AGENT_LLM_SOCIAL_CHANCE`     | `0.3`   | LLM decision probability     |

### Ghost Trading Configuration

| Variable                 | Default | Purpose                    |
| ------------------------ | ------- | -------------------------- |
| `GHOST_ENABLED`          | `false` | Enable autonomous trading  |
| `GHOST_WALLET_SECRET`    | -       | Trading wallet private key |
| `GHOST_MAX_POSITION_SOL` | `0.15`  | Max position size          |

### Twitter Configuration (Finn)

| Variable               | Purpose                |
| ---------------------- | ---------------------- |
| `TWITTER_BEARER_TOKEN` | Twitter API v2 access  |
| `TWITTER_DRY_RUN`      | Test mode (don't post) |

---

## File Structure

```
eliza-agents/
├── src/
│   ├── characters/
│   │   ├── definitions/           # Character definitions
│   │   │   ├── bags-bot.character.ts
│   │   │   ├── finn.character.ts
│   │   │   ├── ghost.character.ts
│   │   │   ├── neo.character.ts
│   │   │   ├── professor-oak.character.ts
│   │   │   └── ... (16 total)
│   │   └── index.ts               # Character loader & converter
│   │
│   ├── actions/                   # Agent actions
│   │   ├── lookupToken.ts
│   │   ├── getCreatorFees.ts
│   │   ├── checkWorldHealth.ts
│   │   ├── getOracleRound.ts
│   │   ├── claimFeesReminder.ts
│   │   └── ... (13 total)
│   │
│   ├── providers/                 # Context providers
│   │   ├── worldState.ts
│   │   ├── topCreators.ts
│   │   ├── tokenData.ts
│   │   ├── agentContext.ts
│   │   └── oracleData.ts
│   │
│   ├── evaluators/                # Message evaluators
│   │   ├── tokenMention.ts
│   │   ├── feeQuery.ts
│   │   ├── launchQuery.ts
│   │   ├── worldStatus.ts
│   │   ├── creatorQuery.ts
│   │   ├── oracleQuery.ts
│   │   └── explanationQuery.ts
│   │
│   ├── services/                  # Core services
│   │   ├── AgentCoordinator.ts    # Multi-agent coordination
│   │   ├── AgentTickService.ts    # Autonomous behavior loop
│   │   ├── AutonomousService.ts   # Scheduled tasks
│   │   ├── BagsApiService.ts      # Bags.fm API client
│   │   ├── GhostTrader.ts         # Autonomous trading
│   │   ├── LaunchWizard.ts        # Token launch wizard
│   │   ├── LLMService.ts          # LLM abstraction
│   │   ├── SolanaService.ts       # Solana transactions
│   │   └── TwitterService.ts      # Twitter posting
│   │
│   ├── routes/                    # API routes
│   │   ├── chat.ts                # Chat endpoints
│   │   ├── tokens.ts              # Token endpoints
│   │   ├── world.ts               # World endpoints
│   │   ├── autonomous.ts          # Autonomous endpoints
│   │   ├── ghost.ts               # Ghost trading endpoints
│   │   └── launchWizard.ts        # Launch wizard endpoints
│   │
│   ├── plugin.ts                  # ElizaOS plugin definition
│   └── server.ts                  # Express server entry point
│
├── package.json
├── tsconfig.json
└── README.md

src/                               # Next.js frontend
├── app/
│   └── api/
│       ├── character-chat/        # Proxies to ElizaOS
│       ├── dialogue/              # Multi-agent dialogue
│       ├── world-state/           # World state API
│       └── launch-token/          # Token creation
│
├── characters/                    # Character definitions (copies)
│   ├── finn.character.ts
│   ├── ghost.character.ts
│   └── ... (16 total)
│
└── lib/
    ├── bags-api.ts                # BagsApiClient
    ├── types.ts                   # Core types
    └── store.ts                   # Zustand store
```

---

## Deployment

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           INTERNET                                   │
└─────────────────────────────────────────────────────────────────────┘
            │                                       │
            ▼                                       ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│      NETLIFY            │           │       RAILWAY           │
│   Next.js Frontend      │ ◀──────▶  │   ElizaOS Agents        │
│                         │           │                         │
│ • Port 3000             │   HTTP    │ • Port 3001             │
│ • Game UI (Phaser)      │    +      │ • Express.js API        │
│ • API proxies           │ WebSocket │ • Autonomous tasks      │
│ • Claude fallback       │           │ • Agent tick loop       │
└─────────────────────────┘           └─────────────────────────┘
            │                                       │
            └───────────────┬───────────────────────┘
                            │
                            ▼
                ┌─────────────────────────┐
                │      NEON DATABASE      │
                │                         │
                │ • PostgreSQL            │
                │ • Conversation history  │
                │ • Agent sessions        │
                │ • Launch wizard state   │
                └─────────────────────────┘
```

### Startup Sequence

```
1. Load environment variables
2. Initialize Neon database connection
3. Create database schema (tables, indexes)
4. Start AgentCoordinator (register 16 agents)
5. Start AutonomousService (register scheduled tasks)
6. Initialize SolanaService (for Ghost trading)
7. Initialize GhostTrader (position management)
8. Initialize TwitterService (for Finn)
9. Start LaunchWizard session cleanup (1-hour interval)
10. Start BagsApi cache cleanup (5-minute interval)
11. Create Express app with rate limiting
12. Mount route handlers
13. Start HTTP server
14. Initialize WorldSync WebSocket server
15. Start AgentTickService (behavior loop)
```

---

## Quick Reference

### Adding a New Agent

1. Create character file: `eliza-agents/src/characters/definitions/myagent.character.ts`
2. Export from `eliza-agents/src/characters/definitions/index.ts`
3. Add to `AGENT_CAPABILITIES` in `AgentCoordinator.ts`
4. Add behaviors in `AgentTickService.ts`
5. Copy to `src/characters/` for frontend

### Adding a New Action

1. Create action file: `eliza-agents/src/actions/myAction.ts`
2. Export from `eliza-agents/src/actions/index.ts`
3. Add to `bagsWorldPlugin.actions` in `plugin.ts`
4. Create matching evaluator if needed

### Adding a New Provider

1. Create provider file: `eliza-agents/src/providers/myProvider.ts`
2. Export from `eliza-agents/src/providers/index.ts`
3. Add to `bagsWorldPlugin.providers` in `plugin.ts`

---

## License

MIT License - See LICENSE file for details.
