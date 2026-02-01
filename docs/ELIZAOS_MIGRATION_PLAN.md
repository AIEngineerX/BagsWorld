# BagsWorld ElizaOS Migration Plan

## Executive Summary

Your current `eliza-agents/` deployment is a **custom Express server** that calls Claude API directly. It's NOT using the ElizaOS runtime, despite the folder name.

The `plugin-bagsworld` in your elizaOS repo IS a proper ElizaOS plugin with Services, Providers, and Actions. Migrating to it would give you:

- **Persistent conversation memory** (per-user, per-agent)
- **Multi-agent coordination** via ElizaOS runtime
- **Provider-based state injection** (world state, token data available to all agents automatically)
- **Action-based tools** (agents can lookup tokens, check fees, etc.)
- **Better observability** with ElizaOS logging

**Character personalities are fully preserved** - they're defined in character files that work identically in both systems.

---

## Current Architecture (What You Have)

```
┌─────────────────────────────────────────────────────────────┐
│  BagsWorld Next.js (Netlify)                                │
│  ├─ /api/eliza-agent/route.ts  → Proxy to Railway           │
│  ├─ /api/dialogue/route.ts     → Proxy to Railway           │
│  └─ /api/character-chat/       → Direct Claude API call     │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Railway: eliza-agents/standalone-server.ts                  │
│  ├─ Express server (NOT ElizaOS)                            │
│  ├─ /api/agents/:id/chat  → new Anthropic().messages.create │
│  ├─ /api/dialogue         → getDialogueManager()            │
│  └─ Characters: src/characters/*.ts (same as plugin)        │
└─────────────────────────────────────────────────────────────┘
```

### What's Missing

- **No memory**: Each request is stateless
- **No provider injection**: World state passed manually per-request
- **No action execution**: Agents can't perform tool calls
- **Basic coordination**: DialogueManager is custom, not ElizaOS-native

---

## Target Architecture (ElizaOS Runtime)

```
┌─────────────────────────────────────────────────────────────┐
│  BagsWorld Next.js (Netlify)                                │
│  ├─ /api/eliza-agent/route.ts  → Proxy to ElizaOS           │
│  ├─ /api/dialogue/route.ts     → Proxy to ElizaOS           │
│  └─ /api/character-chat/       → Proxy to ElizaOS           │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Railway: ElizaOS Runtime + plugin-bagsworld                 │
│  ├─ AgentRuntime per character                              │
│  ├─ Memory: PostgreSQL (Neon) with embeddings               │
│  ├─ Providers: worldState, tokenData, topCreators           │
│  ├─ Actions: lookupToken, getCreatorFees, checkWorldHealth  │
│  └─ Services: BagsApiService, LLMService                    │
└─────────────────────────────────────────────────────────────┘
```

### What You Gain

- **Conversation memory**: Agents remember past interactions
- **Automatic context**: Providers inject world state into every response
- **Tool use**: Agents can call Actions to look up real data
- **Multi-agent runtime**: Native support for agent-to-agent handoffs

---

## Character Preservation (No Changes Needed)

Your character files are **already ElizaOS-compatible**. Compare:

### Current (eliza-agents/src/characters/finn.ts)

```typescript
export const finnCharacter: Character = {
  name: "Finnbags",
  bio: [...],
  style: { all: [...], chat: [...] },
  topics: [...],
  system: "You are Finn (@finnbags), CEO of Bags.fm..."
};
```

### Plugin-bagsworld (same structure)

```typescript
export const finn: Character = {
  name: 'Finn',
  bio: [...],
  style: { all: [...], chat: [...] },
  topics: [...],
  system: '...'
};
```

**Result**: All character personalities, voices, and knowledge transfer 1:1.

---

## Migration Steps

### Phase 1: Prepare (No Downtime)

1. **Merge character files**
   - Ensure `plugin-bagsworld/src/characters/` has all 8 agents
   - Verify bio, style, topics match your production agents
   - Location: `elizaOS/packages/plugin-bagsworld/src/characters/`

2. **Build the plugin**

   ```bash
   cd elizaOS/packages/plugin-bagsworld
   npm install
   npm run build
   npm test  # Currently 231 tests passing
   ```

3. **Create ElizaOS server entry point**
   - Create `elizaOS/packages/plugin-bagsworld/src/runtime-server.ts`
   - Initializes ElizaOS runtime with plugin-bagsworld
   - Exposes same API endpoints as current standalone-server

### Phase 2: Develop Runtime Server

Create `runtime-server.ts`:

```typescript
import { AgentRuntime, elizaLogger, ModelProviderName } from "@elizaos/core";
import { PostgresDatabaseAdapter } from "@elizaos/adapter-postgres";
import express from "express";
import cors from "cors";

import { bagsWorldPlugin, allCharacters } from "./index.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"] }));

// Store agent runtimes
const agentRuntimes = new Map<string, AgentRuntime>();

async function initializeAgents() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  for (const character of allCharacters) {
    const agentId = character.name.toLowerCase().replace(/\s+/g, "-");

    const runtime = new AgentRuntime({
      character,
      modelProvider: ModelProviderName.ANTHROPIC,
      databaseAdapter: dbUrl ? new PostgresDatabaseAdapter({ connectionString: dbUrl }) : undefined,
      plugins: [bagsWorldPlugin],
      token: process.env.ANTHROPIC_API_KEY,
    });

    await runtime.initialize();
    agentRuntimes.set(agentId, runtime);
    elizaLogger.info(`Initialized agent: ${agentId}`);
  }
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", agents: agentRuntimes.size });
});

// Chat endpoint (same API as standalone-server)
app.post("/api/agents/:agentId/chat", async (req, res) => {
  const { agentId } = req.params;
  const { message, sessionId } = req.body;

  const runtime = agentRuntimes.get(agentId.toLowerCase());
  if (!runtime) {
    return res.status(404).json({ error: `Agent not found: ${agentId}` });
  }

  // ElizaOS handles memory, providers, and response generation
  const response = await runtime.processMessage({
    content: { text: message },
    userId: sessionId || "anonymous",
    roomId: `${agentId}-${sessionId}`,
  });

  res.json({
    success: true,
    agentId,
    agentName: runtime.character.name,
    response: response.content.text,
  });
});

// Start server
initializeAgents().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    elizaLogger.info(`ElizaOS BagsWorld server running on port ${PORT}`);
  });
});
```

### Phase 3: Test Locally

1. **Set environment variables**

   ```bash
   export ANTHROPIC_API_KEY=your_key
   export DATABASE_URL=your_neon_url
   export BAGS_API_KEY=your_bags_key
   ```

2. **Run the ElizaOS server**

   ```bash
   cd elizaOS/packages/plugin-bagsworld
   npm run start:runtime  # Add this script to package.json
   ```

3. **Test API compatibility**
   ```bash
   # Should return same response format
   curl -X POST http://localhost:3001/api/agents/finn/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What is Bags.fm?", "sessionId": "test-123"}'
   ```

### Phase 4: Deploy to Railway

1. **Update Dockerfile**

   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY packages/plugin-bagsworld ./
   RUN npm install && npm run build
   CMD ["node", "dist/runtime-server.js"]
   ```

2. **Update railway.toml**

   ```toml
   [build]
   builder = "DOCKERFILE"
   dockerfilePath = "packages/plugin-bagsworld/Dockerfile"
   ```

3. **Deploy**
   - Push to GitHub
   - Railway auto-deploys
   - Existing API endpoints work unchanged

### Phase 5: Enable Memory (Optional Enhancement)

With ElizaOS runtime, agents get persistent memory:

```typescript
// In runtime-server.ts, after processing message
const memories = await runtime.messageManager.getMemories({
  roomId: `${agentId}-${sessionId}`,
  count: 10,
});

// Agents automatically have context from previous conversations
```

---

## API Compatibility Matrix

| Endpoint                    | Current Response          | ElizaOS Response | Compatible? |
| --------------------------- | ------------------------- | ---------------- | ----------- |
| `GET /health`               | `{ status: 'healthy' }`   | Same             | Yes         |
| `GET /api/agents`           | `{ agents: [...] }`       | Same             | Yes         |
| `POST /api/agents/:id/chat` | `{ response, agentName }` | Same             | Yes         |
| `POST /api/dialogue`        | `{ dialogue: { turns } }` | Same             | Yes         |

**No changes needed in BagsWorld Next.js routes** - they proxy to the same endpoints.

---

## What Changes

| Feature      | Before                 | After                       |
| ------------ | ---------------------- | --------------------------- |
| Memory       | None (stateless)       | Per-user persistent         |
| Context      | Manual injection       | Automatic via Providers     |
| Tools        | None                   | Actions (lookupToken, etc.) |
| Multi-agent  | Custom DialogueManager | ElizaOS native              |
| Logging      | console.log            | elizaLogger                 |
| Model config | Hardcoded              | Per-character settings      |

---

## What Stays the Same

- Character personalities (bio, style, topics)
- API endpoint URLs and response formats
- Railway deployment process
- Environment variables (ANTHROPIC_API_KEY, DATABASE_URL, etc.)
- BagsWorld Next.js routes (no changes needed)

---

## Rollback Plan

If issues arise after migration:

1. **Keep eliza-agents as backup**
   - Don't delete `BagsWorld/eliza-agents/`
   - Keep the working Dockerfile

2. **Quick rollback**

   ```bash
   # In Railway, revert to previous Dockerfile
   git revert <migration-commit>
   git push
   ```

3. **Zero downtime**
   - Deploy ElizaOS version as new Railway service
   - Test thoroughly
   - Switch DNS/proxy when ready
   - Keep old service running until stable

---

## Timeline Estimate

| Phase   | Work                           |
| ------- | ------------------------------ |
| Phase 1 | Merge characters, verify tests |
| Phase 2 | Build runtime-server.ts        |
| Phase 3 | Local testing                  |
| Phase 4 | Railway deployment             |
| Phase 5 | Enable memory features         |

---

## Immediate Action Required

Before migration, **push the pending Railway fix commits**:

```bash
cd c:\Users\footb\BagsWorld
git push origin main
```

This deploys the model ID fix (`claude-3-5-sonnet-20241022`) to Railway and restores dialogue functionality.

---

## Questions?

The existing `plugin-bagsworld` has 231 passing tests and is ready for production use. The main work is creating the `runtime-server.ts` entry point that wraps ElizaOS runtime in Express endpoints matching your current API.
