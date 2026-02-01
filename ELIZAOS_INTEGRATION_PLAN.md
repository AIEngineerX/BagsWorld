# BagsWorld ElizaOS Integration Plan

## Executive Summary

This document outlines the plan to integrate all BagsWorld AI agents into the official ElizaOS framework as a proper plugin package. This is the "strongest" integration approach - not a quick hack, but production-ready infrastructure.

---

## 1. Current State Analysis

### BagsWorld Agents Inventory

You have **14 agent character files** across two locations:

#### Primary Agents (ElizaOS-ready format) - `eliza-agents/src/characters/`

| Agent        | Role              | Username        | Key Trait                             |
| ------------ | ----------------- | --------------- | ------------------------------------- |
| **Toly**     | Solana Co-Founder | @aeyakovenko    | Technical blockchain expert           |
| **Finn**     | Bags.fm CEO       | @finnbags       | Visionary founder energy              |
| **Ash**      | Ecosystem Guide   | @ash_bagsworld  | Pokemon analogies for onboarding      |
| **Ghost**    | The Dev           | @DaddyGhost     | Rewards system, on-chain verification |
| **Neo**      | Scout Agent       | @neo_scout      | Matrix-themed chain scanner           |
| **CJ**       | Hood Rat          | @cj_bagsworld   | Street wisdom, market survivor        |
| **Shaw**     | ElizaOS Creator   | @shawmakesmagic | Agent architecture expert             |
| **Bags Bot** | Main Guide        | @bags_bot       | Friendly degen, CT culture            |

#### Extended Team (BagsWorld format) - `src/characters/`

| Agent       | Role                 | Key Trait                            |
| ----------- | -------------------- | ------------------------------------ |
| **Alaa**    | Skunk Works          | Mysterious R&D, stealth projects     |
| **BNN**     | News Network         | Breaking news, professional reporter |
| **Carlo**   | Community Ambassador | Welcoming, "gm" energy               |
| **Ramo**    | CTO                  | German engineering, security-focused |
| **Sam**     | Growth Lead          | Marketing, viral content             |
| **Sincara** | Frontend Engineer    | UI/UX, pixel-perfect                 |
| **Stuu**    | Operations           | Support, troubleshooting             |

### Character Format Comparison

**Your ElizaOS format (`eliza-agents/`):**

```typescript
{
  name: string,
  username: string,
  plugins: string[],
  system: string,          // Full system prompt
  bio: string[],
  topics: string[],
  messageExamples: Array,
  style: { all, chat, post },
  settings: { model, voice }
}
```

**Official ElizaOS format:**

```typescript
{
  name: string,
  username?: string,
  system?: string,
  bio: string | string[],
  topics?: string[],
  adjectives?: string[],    // Missing in yours
  messageExamples?: Array,
  postExamples?: string[],  // Missing in yours
  style?: { all, chat, post },
  plugins?: string[],
  settings?: Record<string, unknown>,
  secrets?: Record<string, unknown>,
  knowledge?: Array          // Missing in yours
}
```

**BagsWorld format (`src/characters/`):**

```typescript
{
  name: string,
  bio: string[],
  lore: string[],           // Not in ElizaOS
  messageExamples: Array,   // Different format (user vs name)
  topics: string[],
  style: {
    adjectives: string[],   // Nested differently
    tone: string,           // Not in ElizaOS
    vocabulary: string[]    // Not in ElizaOS
  },
  postExamples: string[],
  quirks: string[]          // Not in ElizaOS
}
```

---

## 2. Goal Definition

### Primary Objective

Create a production-ready ElizaOS plugin (`@elizaos/plugin-bagsworld`) that:

1. Registers all 14 BagsWorld agents as proper ElizaOS characters
2. Provides custom actions for Bags.fm API interactions
3. Provides data providers that inject live chain data into agent context
4. Enables multi-agent coordination and cross-agent awareness
5. Deploys as a standalone server or integrates with existing ElizaOS installations

### Success Criteria

- [x] 8 primary agents load and respond correctly in ElizaOS (Phase 1 complete)
- [x] Agents can query live Bags.fm API data (tokens, fees, creators)
- [x] Agents reference each other naturally (cross-agent lore via agentContext provider)
- [x] Plugin passes ElizaOS TypeScript validation
- [x] Deployable via Docker (Dockerfile + docker-compose.yml included)
- [ ] Compatible with Discord, Telegram, Twitter clients (API-only mode implemented per user request)
- [ ] Extended team (6 additional agents) - deferred to Phase 2

---

## 3. Architecture

### Package Structure

```
@elizaos/plugin-bagsworld/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Main plugin export
│   ├── characters/
│   │   ├── index.ts             # Character registry
│   │   ├── toly.ts
│   │   ├── finn.ts
│   │   ├── ash.ts
│   │   ├── ghost.ts
│   │   ├── neo.ts
│   │   ├── cj.ts
│   │   ├── shaw.ts
│   │   ├── bags-bot.ts
│   │   ├── alaa.ts
│   │   ├── bnn.ts
│   │   ├── carlo.ts
│   │   ├── ramo.ts
│   │   ├── sam.ts
│   │   ├── sincara.ts
│   │   └── stuu.ts
│   ├── actions/
│   │   ├── index.ts
│   │   ├── lookupToken.ts       # Query token by mint/name
│   │   ├── getCreatorFees.ts    # Get creator fee stats
│   │   ├── getTopCreators.ts    # Leaderboard data
│   │   ├── getRecentLaunches.ts # New token launches
│   │   └── checkWorldHealth.ts  # BagsWorld health metrics
│   ├── providers/
│   │   ├── index.ts
│   │   ├── worldState.ts        # Inject world health into context
│   │   ├── tokenData.ts         # Inject relevant token data
│   │   ├── leaderboard.ts       # Top creators/fees
│   │   └── agentContext.ts      # Cross-agent awareness
│   ├── services/
│   │   ├── BagsApiService.ts    # Bags.fm API client
│   │   └── CacheService.ts      # Data caching layer
│   └── utils/
│       ├── characterConverter.ts # Convert formats
│       └── validation.ts
└── server.ts                    # Standalone server entry
```

### Data Flow

```
User Message
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ ElizaOS Runtime                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Character (e.g., Finn)                                  ││
│  │  - system prompt                                        ││
│  │  - bio, topics, style                                   ││
│  └─────────────────────────────────────────────────────────┘│
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────────┐│
│  │ Providers (inject context before LLM call)              ││
│  │  - worldState: "World health: 75%, weather: sunny"      ││
│  │  - tokenData: "Hot tokens: $BAGS up 200%"               ││
│  │  - agentContext: "Neo just scanned 5 new launches"      ││
│  └─────────────────────────────────────────────────────────┘│
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────────┐│
│  │ LLM Call (Claude/GPT)                                   ││
│  │  System: Finn's prompt + provider data                  ││
│  │  User: "What's hot right now?"                          ││
│  └─────────────────────────────────────────────────────────┘│
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────────┐│
│  │ Actions (post-response execution)                       ││
│  │  - lookupToken: Fetch detailed token data               ││
│  │  - getCreatorFees: Query fee stats                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
    │
    ▼
Response to User
```

---

## 4. Constraints & Dependencies

### Technical Constraints

| Constraint                          | Impact                  | Mitigation                            |
| ----------------------------------- | ----------------------- | ------------------------------------- |
| ElizaOS requires Node.js v23+ / Bun | Must use modern runtime | Docker container with correct version |
| Character format differences        | Need converter          | Build `characterConverter.ts` utility |
| Bags.fm API rate limits             | Throttle requests       | CacheService with 30s TTL             |
| ElizaOS plugin validation           | Must pass schema        | Test against `validateCharacter()`    |
| 14 agents = memory overhead         | ~1GB RAM for all        | Lazy loading, selective deployment    |

### Dependencies

**Required NPM Packages:**

```json
{
  "dependencies": {
    "@elizaos/core": "workspace:*", // If in monorepo
    // OR
    "@elizaos/core": "^1.7.0" // If standalone
  },
  "peerDependencies": {
    "@elizaos/plugin-sql": "^1.7.0",
    "@elizaos/plugin-bootstrap": "^1.7.0"
  }
}
```

**Environment Variables:**

```bash
# Required
ANTHROPIC_API_KEY=sk-...           # Or OPENAI_API_KEY

# BagsWorld
BAGS_API_KEY=your-key              # For Bags.fm API
BAGS_API_URL=https://public-api-v2.bags.fm/api/v1
SOLANA_RPC_URL=https://...         # For on-chain queries

# Optional
BAGSWORLD_API_URL=http://localhost:3000  # BagsWorld game API
LOG_LEVEL=debug
```

### Edge Cases

| Scenario                      | Handling                            |
| ----------------------------- | ----------------------------------- |
| Bags.fm API down              | Graceful fallback to cached data    |
| User asks about unknown token | Action returns "Token not found"    |
| Cross-agent reference loop    | Max depth limit on agent mentions   |
| Rate limit exceeded           | Exponential backoff + queue         |
| Invalid character format      | Validation errors at startup        |
| Memory exhaustion             | Conversation pruning at 50 messages |

---

## 5. Character Conversion Strategy

### Converting `src/characters/` → ElizaOS format

The BagsWorld characters use a different format. Conversion needed:

**Before (BagsWorld):**

```typescript
{
  name: "Alaa",
  bio: ["Skunk Works at Bags.fm..."],
  lore: ["The 'skunk works' title was earned..."],
  messageExamples: [
    [
      { user: "anon", content: "what are you working on?" },
      { user: "Alaa", content: "Can't say yet..." }
    ]
  ],
  style: {
    adjectives: ["mysterious", "innovative"],
    tone: "mysterious innovator...",
    vocabulary: ["experiment", "prototype"]
  },
  quirks: ["Speaks in vague hints..."]
}
```

**After (ElizaOS):**

```typescript
{
  name: "Alaa",
  username: "alaa_bagsworld",
  bio: ["Skunk Works at Bags.fm..."],
  system: `You are Alaa, the Skunk Works at Bags.fm.

CORE IDENTITY:
${bio.join('\n')}

BACKSTORY:
${lore.join('\n')}

SPEECH PATTERNS:
- ${style.tone}
- Use vocabulary: ${style.vocabulary.join(', ')}

QUIRKS:
${quirks.map(q => '- ' + q).join('\n')}

RULES:
- Keep responses SHORT (1-3 sentences)
- Stay mysterious about upcoming features
- Never reveal specific timelines`,

  topics: [...topics],
  adjectives: style.adjectives,
  messageExamples: messageExamples.map(convo =>
    convo.map(msg => ({
      name: msg.user === 'anon' ? '{{name1}}' : msg.user,
      content: { text: msg.content }
    }))
  ),
  postExamples: postExamples,
  style: {
    all: [...style.adjectives.map(a => `Be ${a}`)],
    chat: ["Keep responses short", "Stay in character"],
    post: ["Share cryptic updates"]
  },
  plugins: [],
  settings: {
    model: 'claude-sonnet-4-20250514'
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Core Plugin Structure (Week 1)

- [ ] Create package.json, tsconfig.json
- [ ] Set up directory structure
- [ ] Implement character converter utility
- [ ] Convert all 14 characters to ElizaOS format
- [ ] Create character registry with getters

### Phase 2: Bags.fm Integration (Week 1-2)

- [ ] Implement BagsApiService (API client)
- [ ] Implement CacheService (30s TTL)
- [ ] Create actions: lookupToken, getCreatorFees, getTopCreators
- [ ] Create providers: worldState, tokenData

### Phase 3: Multi-Agent Features (Week 2)

- [ ] Implement agentContext provider
- [ ] Add cross-agent lore injection
- [ ] Create agent handoff logic
- [ ] Test multi-agent conversations

### Phase 4: Testing & Validation (Week 2)

- [ ] Write unit tests for character validation
- [ ] Integration tests with mock API
- [ ] Load testing with all 14 agents
- [ ] Validate against ElizaOS schema

### Phase 5: Deployment (Week 3)

- [ ] Create standalone server entry point
- [ ] Docker configuration
- [ ] Railway/Render deployment config
- [ ] Documentation

---

## 7. Risks & Unknowns

| Risk                             | Probability | Impact | Mitigation                                |
| -------------------------------- | ----------- | ------ | ----------------------------------------- |
| ElizaOS API changes              | Medium      | High   | Pin to specific version, monitor releases |
| Character format incompatibility | Low         | Medium | Thorough converter testing                |
| Bags.fm API instability          | Medium      | High   | Robust caching, fallback responses        |
| Memory/performance issues        | Medium      | Medium | Selective agent loading, pruning          |
| LLM costs with 14 agents         | High        | Medium | Shared context, rate limiting             |

### Open Questions

1. **Agent Selection**: Should users be able to select which agents to load, or always load all 14?
2. **Database**: Use ElizaOS's PGLite or connect to existing BagsWorld Neon DB?
3. **Platform Priority**: Discord first, or Telegram, or API-only?
4. **Cost Management**: How to handle LLM costs with 14 active agents?
5. **Deployment Target**: In ElizaOS monorepo or standalone package?

---

## 8. Deliverables

### Package Files

```
@elizaos/plugin-bagsworld/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts
│   ├── characters/  (14 files)
│   ├── actions/     (5 files)
│   ├── providers/   (4 files)
│   ├── services/    (2 files)
│   └── utils/       (2 files)
├── server.ts
├── Dockerfile
└── railway.toml
```

### API Endpoints (Standalone Server)

```
GET  /health                    - Health check
GET  /api/agents                - List all agents
GET  /api/agents/:id            - Get agent info
POST /api/agents/:id/message    - Chat with agent
POST /api/dialogue              - Multi-agent dialogue
GET  /api/world-state           - BagsWorld data
```

---

## 9. Next Steps

**Awaiting your approval on:**

1. **Scope**: All 14 agents, or subset?
2. **Deployment**: Monorepo integration or standalone?
3. **Platform**: Which clients first (Discord/Telegram/API)?
4. **Database**: PGLite or Neon?
5. **Timeline**: Priority level?

Once approved, I'll begin Phase 1 implementation.

---

## Appendix: Character Quick Reference

| Agent    | Personality           | Example Response                                                           |
| -------- | --------------------- | -------------------------------------------------------------------------- |
| Toly     | Technical, "gm ser"   | "Proof of History creates a cryptographic clock - 65k TPS, 400ms finality" |
| Finn     | Founder energy        | "1% of all trading volume. forever. that's real passive income"            |
| Ash      | Pokemon analogies     | "think of it like Pokemon! your token is your starter"                     |
| Ghost    | On-chain verification | "check the wallet on solscan. all on-chain"                                |
| Neo      | Matrix cryptic        | "i see the chain. the code never lies"                                     |
| CJ       | Hood wisdom           | "aw shit here we go again. been here before homie"                         |
| Shaw     | Architect             | "character files are the DNA of an agent"                                  |
| Bags Bot | Degen friendly        | "gm fren! another day another chance to make it"                           |
| Alaa     | Mysterious R&D        | "Can't say yet. But imagine if [redacted]"                                 |
| BNN      | News anchor           | "BREAKING: New fee record set today"                                       |
| Carlo    | Welcoming             | "gm! Welcome to Bags. First time here?"                                    |
| Ramo     | German engineering    | "Triple audited contracts, no admin keys"                                  |
| Sam      | Marketing hype        | "Content, consistency, community. Growth is a grind"                       |
| Sincara  | UI/UX obsessed        | "Optimistic updates, skeleton loaders, details matter"                     |
| Stuu     | Support               | "Drop your wallet address and I'll check"                                  |
