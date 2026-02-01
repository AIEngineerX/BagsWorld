# Plan: Upgrading All AI to ElizaOS Full Functions

## DECISIONS CONFIRMED

| Question           | Answer                                  |
| ------------------ | --------------------------------------- |
| Hosting Strategy   | **A: Separate server (Render/Railway)** |
| Platform Connector | **Telegram Bot**                        |
| Priority Feature   | **Multi-agent coordination**            |
| Database           | **Existing Neon DB**                    |

---

## 1. Goal Clarification

**Objective**: Migrate all 7 BagsWorld AI characters from the current hybrid Claude/ElizaOS system to a **fully autonomous ElizaOS runtime** with complete feature parity.

**Current State**:

- 7 characters exist: Neo, CJ, Finn, Bags-Bot, Toly, Ash, Shaw
- Only Shaw runs on TRUE ElizaOS runtime (port 3001)
- Others use Claude Opus 4.5 fallback with character definitions
- Partial `eliza-agents` implementation exists but incomplete
- Package.json missing core ElizaOS dependencies (@elizaos/core not installed)

**Target State**:

- ALL characters run on ElizaOS with persistent memory
- Multi-agent coordination (characters can talk to each other)
- Telegram bot connector for external access
- Real-time Bags.fm data integration for ALL characters
- Single unified API endpoint
- Hosted on Render/Railway (separate from Netlify frontend)
- Memory persistence using existing Neon PostgreSQL

---

## 2. Constraints & Dependencies

### Technical Constraints

| Constraint                                   | Impact                               |
| -------------------------------------------- | ------------------------------------ |
| ElizaOS requires Node.js 23+ or Bun          | May need runtime upgrade             |
| Separate server process (port 3001)          | Operational complexity on Netlify    |
| SQLite default (PostgreSQL for prod)         | Database migration needed            |
| Twitter API rate limits                      | Autonomous posting frequency limited |
| ANTHROPIC_API_KEY or OPENAI_API_KEY required | Cost implications per message        |

### Dependencies

| Dependency                         | Version | Purpose                    |
| ---------------------------------- | ------- | -------------------------- |
| @elizaos/core                      | ^1.7.2  | Agent runtime              |
| @elizaos/plugin-bootstrap          | latest  | Core communication         |
| @elizaos/plugin-sql                | latest  | PostgreSQL/SQLite memory   |
| @elizaos/plugin-twitter (optional) | latest  | Autonomous Twitter posting |
| @elizaos/plugin-discord (optional) | latest  | Discord bot                |
| Bun runtime                        | 1.0+    | Required by ElizaOS        |

### Infrastructure Requirements

- **Local Dev**: ElizaOS server must run alongside Next.js (port 3001)
- **Production**: Either:
  - Co-located process (Render, Railway, Fly.io)
  - Serverless function with cold-start penalty
  - Dedicated agent server (separate deployment)

---

## 3. Edge Cases

1. **ElizaOS Server Unavailable**
   - Must maintain Claude fallback for reliability
   - Health check endpoint `/api/eliza-agent?check=true`

2. **Memory Overflow**
   - Conversations can grow large; need pruning strategy
   - Limit context to last 50 messages per room

3. **Cross-Character Conversations**
   - When Neo mentions Finn, should Finn be aware?
   - Shared room vs isolated rooms decision

4. **Rate Limiting**
   - Multiple users hitting same agent
   - Queue system or per-user rate limits

5. **Character Inconsistency**
   - Same character definitions in `src/characters/` AND `eliza-agents/src/characters/`
   - Need single source of truth

6. **Autonomous Action Conflicts**
   - Neo and CJ both want to tweet about same launch
   - Coordination/deduplication needed

7. **Cold Starts**
   - ElizaOS initialization is slow (~5-10s)
   - Pre-warm or persistent process needed

---

## 4. Architecture Design

### Current Architecture (Hybrid)

```
┌─────────────────────────────────────────────────────────────┐
│                    BagsWorld Frontend                        │
│              (React + Phaser + Chat Components)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
   /api/character-chat  /api/agent-chat  /api/eliza-agent
   (Legacy - Haiku)     (Opus 4.5)       (Hybrid)
           │               │               │
           └───────────────┴───────┬───────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     Shaw only → ElizaOS     │
                    │     Others → Claude API     │
                    └─────────────────────────────┘
```

### Target Architecture (Full ElizaOS)

```
┌─────────────────────────────────────────────────────────────┐
│                    BagsWorld Frontend                        │
│              (React + Phaser + Chat Components)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   /api/agents (NEW)    │  ◄── Single unified endpoint
              │   - Chat routing       │
              │   - Health checks      │
              │   - Event dispatch     │
              └────────────┬───────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                 ElizaOS Agent Runtime (port 3001)            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │
│  │  Neo   │ │   CJ   │ │  Finn  │ │  Ash   │ │  Shaw  │ ... │
│  └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘     │
│       └──────────┴──────────┴──────────┴──────────┘         │
│                          │                                   │
│              ┌───────────┴───────────┐                       │
│              │    Bags.fm Plugin     │                       │
│              │  - World State        │                       │
│              │  - Token Intel        │                       │
│              │  - Event Stream       │                       │
│              └───────────┬───────────┘                       │
│                          │                                   │
│   ┌──────────────────────┼──────────────────────┐           │
│   │     Memory Layer     │    Action Layer      │           │
│   │  (PostgreSQL/SQLite) │  (Twitter, Discord)  │           │
│   └──────────────────────┴──────────────────────┘           │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │     Bags.fm API        │
              │     Solana RPC         │
              └────────────────────────┘
```

### Data Flow (Chat Request)

```
1. User types message in FinnChat component
2. POST /api/agents { character: "finn", message: "how do fees work?" }
3. API route forwards to ElizaOS: POST http://localhost:3001/chat
4. ElizaOS:
   a. Load character (finnCharacter)
   b. Retrieve memory (last N messages with this user)
   c. Run providers (worldStateProvider, tokenIntelProvider)
   d. Inject context into prompt
   e. Call LLM (Anthropic/OpenAI)
   f. Extract actions from response
   g. Store memory
   h. Return response + actions
5. API route returns to frontend
6. FinnChat displays response + action buttons
```

### Data Flow (Autonomous Event)

```
1. New token launched on Bags.fm
2. World State API detects event
3. POST /api/agents/event { type: "token_launch", data: {...} }
4. ElizaOS:
   a. Dispatch to relevant agents (Neo is primary)
   b. Neo processes event, generates commentary
   c. If Twitter configured: post tweet
   d. Store event in memory
   e. Notify other agents (optional coordination)
5. Frontend receives event via WebSocket/polling
6. UI shows "Neo spotted a new launch!"
```

---

## 5. Implementation Tasks

### Phase 1: Foundation (Required)

| Task | Description                                       | Files                                              |
| ---- | ------------------------------------------------- | -------------------------------------------------- |
| 1.1  | Complete missing character files in eliza-agents  | `eliza-agents/src/characters/*.ts`                 |
| 1.2  | Consolidate character definitions (single source) | Remove duplicates from `src/characters/`           |
| 1.3  | Complete Bags.fm service implementation           | `eliza-agents/src/plugins/bags-fm/bags-service.ts` |
| 1.4  | Add database adapter (PostgreSQL)                 | `eliza-agents/src/db/`                             |
| 1.5  | Update package.json with all ElizaOS deps         | `eliza-agents/package.json`                        |
| 1.6  | Create unified API route                          | `src/app/api/agents/route.ts`                      |

### Phase 2: Migration (Required)

| Task | Description                                    | Files                                                        |
| ---- | ---------------------------------------------- | ------------------------------------------------------------ |
| 2.1  | Update all chat components to use new endpoint | `src/components/*Chat.tsx`                                   |
| 2.2  | Implement graceful fallback to Claude          | `src/app/api/agents/route.ts`                                |
| 2.3  | Add health check polling                       | `src/hooks/useElizaStatus.ts`                                |
| 2.4  | Migrate behavior system to ElizaOS events      | `src/lib/character-behavior.ts`                              |
| 2.5  | Deprecate old API routes                       | `src/app/api/character-chat/`, `agent-chat/`, `eliza-agent/` |

### Phase 3: Autonomous Features (Optional)

| Task | Description                                          | Files                                        |
| ---- | ---------------------------------------------------- | -------------------------------------------- |
| 3.1  | Add Twitter plugin configuration                     | `eliza-agents/.env`, character configs       |
| 3.2  | Implement event-driven autonomous posting            | `eliza-agents/src/plugins/bags-fm/events.ts` |
| 3.3  | Add Discord bot connector                            | Character configs                            |
| 3.4  | Multi-agent coordination (cross-character awareness) | `eliza-agents/src/coordination/`             |
| 3.5  | Scheduled world reports                              | Cron/interval system                         |

### Phase 4: Production (Required for Deploy)

| Task | Description                               | Files                     |
| ---- | ----------------------------------------- | ------------------------- |
| 4.1  | Docker configuration for ElizaOS          | `eliza-agents/Dockerfile` |
| 4.2  | Production database setup (Neon/Supabase) | Environment variables     |
| 4.3  | Process management (PM2 or similar)       | Deployment config         |
| 4.4  | Monitoring and logging                    | Observability setup       |
| 4.5  | Rate limiting per user                    | Middleware                |

---

## 6. Unknowns & Risks

### High Risk

| Risk                          | Likelihood | Impact | Mitigation                      |
| ----------------------------- | ---------- | ------ | ------------------------------- |
| ElizaOS API breaking changes  | Medium     | High   | Pin versions, maintain fallback |
| Production hosting complexity | High       | High   | Consider serverless alternative |
| Cost explosion (LLM calls)    | Medium     | High   | Implement caching, rate limits  |

### Medium Risk

| Risk                        | Likelihood | Impact | Mitigation                       |
| --------------------------- | ---------- | ------ | -------------------------------- |
| Memory consistency issues   | Medium     | Medium | Regular cleanup, TTL on memories |
| Character personality drift | Low        | Medium | Strong character files, examples |
| Multi-agent conflicts       | Medium     | Medium | Coordination layer, locks        |

### Low Risk

| Risk                   | Likelihood | Impact | Mitigation           |
| ---------------------- | ---------- | ------ | -------------------- |
| Twitter API suspension | Low        | Low    | Graceful degradation |
| Discord bot issues     | Low        | Low    | Optional feature     |

### Unknown (Requires Investigation)

1. **Netlify Compatibility**: Can ElizaOS run as a Netlify Function or does it need a separate server?
2. **Bun on Windows**: Development workflow on Windows with Bun requirement
3. **Memory Limits**: How much memory does 7 concurrent agents require?
4. **Latency**: What's the cold-start penalty for ElizaOS initialization?

---

## 7. Questions for Clarification

Before implementation, please confirm:

1. **Hosting Strategy**:
   - Option A: Separate server for ElizaOS (Render/Railway/Fly.io)
   - Option B: Attempt to run ElizaOS in Netlify Functions
   - Option C: Keep hybrid (ElizaOS local dev, Claude fallback in prod)

2. **Platform Connectors**:
   - Do you want Twitter autonomous posting? (Requires API keys)
   - Do you want Discord bot? (Requires Discord app setup)
   - Do you want Telegram bot?

3. **Memory Persistence**:
   - Option A: Use existing Neon database
   - Option B: Separate PostgreSQL for agents
   - Option C: SQLite (local only, no persistence in prod)

4. **Priority Features**:
   - Full memory persistence?
   - Autonomous event reactions?
   - Multi-agent coordination?
   - Cross-platform posting?

5. **Development Workflow**:
   - Are you comfortable running Bun alongside npm/Node?
   - Do you need Windows-specific instructions?

---

## 8. Recommended Approach

Given the complexity, I recommend a **phased rollout**:

### Week 1: Foundation

- Complete Phase 1 tasks
- Get all 7 agents running on ElizaOS locally
- Verify Bags.fm plugin works with all characters

### Week 2: Migration

- Create unified `/api/agents` endpoint
- Update chat components one by one
- Maintain Claude fallback for reliability

### Week 3: Testing & Stability

- Load testing with multiple concurrent users
- Memory leak detection
- Character consistency verification

### Week 4: Production (if needed)

- Set up production ElizaOS hosting
- Database migration
- Monitoring setup

### Future: Autonomous Features

- Twitter/Discord connectors
- Event-driven posting
- Multi-agent coordination

---

## 9. File Changes Summary

### New Files

```
src/app/api/agents/route.ts           # Unified agent API
src/app/api/agents/event/route.ts     # Event dispatch endpoint
src/hooks/useElizaStatus.ts           # ElizaOS health monitoring
eliza-agents/src/db/adapter.ts        # Database adapter
eliza-agents/src/coordination/        # Multi-agent coordination
eliza-agents/Dockerfile               # Production container
```

### Modified Files

```
eliza-agents/package.json             # Add missing deps
eliza-agents/src/characters/*.ts      # Complete all 7 characters
eliza-agents/src/plugins/bags-fm/     # Complete service impl
src/components/*Chat.tsx              # Update API endpoints
src/lib/character-behavior.ts         # Migrate to ElizaOS events
```

### Deprecated (Remove Later)

```
src/app/api/character-chat/route.ts   # Legacy
src/app/api/agent-chat/route.ts       # Replaced by /api/agents
src/app/api/eliza-agent/route.ts      # Replaced by /api/agents
src/characters/*.character.ts         # Duplicates of eliza-agents
```

---

## 10. Decision Required

Please review this plan and answer the clarification questions in Section 7. Once I understand your preferences for:

- Hosting strategy
- Platform connectors
- Memory persistence
- Priority features
- Development workflow

I can begin implementation with a detailed, step-by-step approach.
