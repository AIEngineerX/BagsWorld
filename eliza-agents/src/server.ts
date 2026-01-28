// BagsWorld Agents Standalone Server
// Express server with full LLM integration and Neon DB persistence

import express from "express";
import cors from "cors";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";

import { getCharacterIds } from "./characters/index.js";
import { AgentCoordinator, getAgentCoordinator } from "./services/AgentCoordinator.js";
import { AutonomousService } from "./services/AutonomousService.js";
import { LaunchWizard } from "./services/LaunchWizard.js";
import { cleanupCache as cleanupApiCache } from "./services/BagsApiService.js";
import { getWorldSyncService } from "./services/WorldSyncService.js";
import { getAgentTickService } from "./services/AgentTickService.js";
import { getLLMService } from "./services/LLMService.js";
import type { Character } from "./types/elizaos.js";
import type { Server } from "http";

// Import route modules
import {
  chatRoutes,
  tokenRoutes,
  worldRoutes,
  autonomousRoutes,
  coordinationRoutes,
  launchWizardRoutes,
  creatorToolsRoutes,
  ghostRoutes,
  twitterRoutes,
  setDatabase,
} from "./routes/index.js";
import { GhostTrader, getGhostTrader } from "./services/GhostTrader.js";
import { SolanaService, getSolanaService } from "./services/SolanaService.js";
import { TwitterService, getTwitterService } from "./services/TwitterService.js";
import { createMockRuntime } from "./routes/shared.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "http://localhost:5173",
];

const DATABASE_URL =
  process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;

let sql: NeonQueryFunction<false, false> | null = null;

if (DATABASE_URL) {
  sql = neon(DATABASE_URL);
  setDatabase(sql);
  console.log("[Database] Connected to Neon");
} else {
  console.warn("[Database] No DATABASE_URL - running without persistence");
}

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// Health check endpoint
app.get("/health", async (req, res) => {
  const llmConfigured = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);

  let dbStatus = "not configured";
  if (sql) {
    try {
      await sql`SELECT 1`;
      dbStatus = "connected";
    } catch {
      dbStatus = "error";
    }
  }

  const isHealthy = dbStatus !== "error";
  const status = isHealthy ? (dbStatus === "connected" ? "healthy" : "degraded") : "unhealthy";

  res.status(isHealthy ? 200 : 503).json({
    status,
    timestamp: Date.now(),
    version: "1.0.0",
    database: dbStatus,
    llm: llmConfigured ? "configured" : "not configured",
    agents: getCharacterIds().length,
  });
});

// Mount route modules
app.use("/api", chatRoutes);
app.use("/api", tokenRoutes);
app.use("/api", worldRoutes);
app.use("/api/autonomous", autonomousRoutes);
app.use("/api/coordination", coordinationRoutes);
app.use("/api/launch-wizard", launchWizardRoutes);
app.use("/api/creator-tools", creatorToolsRoutes);
app.use("/api/ghost", ghostRoutes);
app.use("/api/twitter", twitterRoutes);

// Database initialization
async function initializeDatabase(): Promise<void> {
  if (!sql) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id UUID PRIMARY KEY,
        session_id UUID NOT NULL,
        agent_id VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_conv_session_agent
      ON conversation_messages(session_id, agent_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_conv_created
      ON conversation_messages(created_at)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id UUID PRIMARY KEY,
        agent_id VARCHAR(50) NOT NULL,
        user_identifier VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_agent
      ON agent_sessions(agent_id)
    `;

    console.log("[Database] Schema initialized");
  } catch (err: any) {
    console.error("[Database] Failed to initialize schema:", err.message);
    console.warn("[Database] Server will continue without database persistence");
  }
}

// Initialize autonomous services
async function initializeAutonomousServices(): Promise<void> {
  const mockRuntime = createMockRuntime({ name: "system" } as Character);

  // Start coordinator first (autonomous service depends on it)
  await AgentCoordinator.start(mockRuntime);
  console.log("[Autonomous] Agent coordinator initialized");

  // Start autonomous service
  const enableAutonomous = process.env.ENABLE_AUTONOMOUS !== "false";
  if (enableAutonomous) {
    await AutonomousService.start(mockRuntime);
    console.log("[Autonomous] Autonomous service initialized with scheduled tasks");
  } else {
    console.log("[Autonomous] Autonomous service disabled (ENABLE_AUTONOMOUS=false)");
  }

  // Initialize Solana Service (for Ghost trading)
  const solanaService = getSolanaService();
  await solanaService.initialize();
  console.log(
    `[SolanaService] Initialized (wallet: ${solanaService.isConfigured() ? solanaService.getPublicKey()?.slice(0, 8) + "..." : "NOT configured"})`
  );

  // Initialize Ghost Trader
  const ghostTrader = getGhostTrader();
  await ghostTrader.initialize();
  console.log(
    `[GhostTrader] Initialized (trading: ${ghostTrader.isEnabled() ? "ENABLED" : "DISABLED"})`
  );

  // Initialize Twitter Service (for Finn posting)
  const twitterService = getTwitterService();
  await twitterService.initialize();
  const twitterStats = twitterService.getStats();
  console.log(
    `[TwitterService] Initialized (${twitterStats.authenticated ? "@" + twitterStats.username : "NOT configured"}${twitterStats.dryRun ? " - DRY RUN" : ""})`
  );

  // Start LaunchWizard session cleanup timer (every hour)
  const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  setInterval(() => {
    const cleaned = LaunchWizard.cleanupSessions();
    if (cleaned > 0) {
      console.log(`[LaunchWizard] Cleaned ${cleaned} expired sessions`);
    }
  }, SESSION_CLEANUP_INTERVAL);
  console.log("[LaunchWizard] Session cleanup timer started (hourly)");

  // Start API cache cleanup timer (every 5 minutes)
  const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  setInterval(() => {
    const cleaned = cleanupApiCache();
    if (cleaned > 0) {
      console.log(`[BagsApi] Cleaned ${cleaned} stale cache entries`);
    }
  }, CACHE_CLEANUP_INTERVAL);
  console.log("[BagsApi] Cache cleanup timer started (every 5 minutes)");
}

// Initialize WorldSync WebSocket server and AgentTick loop
async function initializeWorldSyncAndTick(server: Server): Promise<void> {
  const enableWorldSync = process.env.ENABLE_WORLD_SYNC !== "false";

  if (!enableWorldSync) {
    console.log("[WorldSync] World sync disabled (ENABLE_WORLD_SYNC=false)");
    return;
  }

  // Initialize WorldSync WebSocket server
  const worldSync = getWorldSyncService();
  worldSync.initialize(server);
  console.log("[WorldSync] WebSocket server initialized on /ws");

  // Initialize AgentTickService
  const tickService = getAgentTickService();

  // Connect the coordinator
  const coordinator = getAgentCoordinator();
  if (coordinator) {
    tickService.setCoordinator(coordinator);
  }

  // Connect LLM service for complex decisions (if available)
  const llmConfigured = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  if (llmConfigured) {
    const llmService = getLLMService();
    tickService.setLLMService(llmService);
    console.log("[AgentTick] LLM service connected for complex decisions");
  } else {
    console.log("[AgentTick] Running without LLM (rules-based only)");
  }

  // Register all 16 agents with the tick service
  const agentIds = getCharacterIds();
  for (const agentId of agentIds) {
    tickService.registerAgent(agentId);
  }
  console.log(`[AgentTick] Registered ${agentIds.length} agents: ${agentIds.join(", ")}`);

  // Start the tick loop
  tickService.start();
  console.log("[AgentTick] Autonomous behavior tick loop started (4s interval)");

  // Add stats endpoint
  app.get("/api/agent-tick/stats", (req, res) => {
    res.json(tickService.getStats());
  });
}

async function main(): Promise<void> {
  console.log("Starting BagsWorld Agents Server...");

  await initializeDatabase();
  await initializeAutonomousServices();

  const llmConfigured = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  if (!llmConfigured) {
    console.error("[CRITICAL] No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY");
    console.error("[CRITICAL] Chat functionality will fail without an LLM API key");
  } else {
    console.log(`[LLM] Using ${process.env.ANTHROPIC_API_KEY ? "Anthropic Claude" : "OpenAI GPT"}`);
  }

  const server = app.listen(PORT, HOST, async () => {
    console.log(`\nBagsWorld Agents Server running at http://${HOST}:${PORT}`);
    console.log(`\nLoaded ${getCharacterIds().length} agents: ${getCharacterIds().join(", ")}`);

    // Initialize WorldSync WebSocket server after HTTP server is ready
    await initializeWorldSyncAndTick(server);

    console.log(`\nEndpoints:`);
    console.log(`  GET    /health                      - Health check`);
    console.log(`  GET    /api/agents                  - List all agents`);
    console.log(`  GET    /api/agents/:id              - Get agent info`);
    console.log(`  POST   /api/agents/:id/chat         - Chat with agent (requires LLM key)`);
    console.log(`  POST   /api/dialogue                - Generate multi-agent dialogue`);
    console.log(`  GET    /api/sessions/:id/history    - Get conversation history`);
    console.log(`  DELETE /api/sessions/:id            - Clear session`);
    console.log(`  GET    /api/tokens/:mint            - Get token info`);
    console.log(`  GET    /api/tokens/:mint/fees       - Get creator fees`);
    console.log(`  GET    /api/tokens/search/:query    - Search tokens`);
    console.log(`  GET    /api/creators/top            - Get top creators`);
    console.log(`  GET    /api/launches/recent         - Get recent launches`);
    console.log(`  GET    /api/world-health            - Get world health`);
    console.log(`  GET    /api/world-state             - Get world state with context`);
    console.log(`  GET    /api/autonomous/status       - Get autonomous tasks status`);
    console.log(`  GET    /api/autonomous/alerts       - Get recent alerts`);
    console.log(`  POST   /api/autonomous/trigger/:task - Manually trigger a task`);
    console.log(`  GET    /api/coordination/context    - Get agent coordination context`);
    console.log(`  GET    /api/agent-tick/stats        - Get tick service stats`);
    console.log(`\nWebSocket:`);
    console.log(`  WS     ws://${HOST}:${PORT}/ws      - World sync (Phaser game)`);
    console.log(`\nLaunch Wizard (Professor Oak):`);
    console.log(`  POST   /api/launch-wizard/start     - Start guided launch`);
    console.log(`  GET    /api/launch-wizard/session/:id - Get session status`);
    console.log(`  POST   /api/launch-wizard/session/:id/input - Process step input`);
    console.log(`  POST   /api/launch-wizard/session/:id/ask   - Ask Professor Oak`);
    console.log(`\nCreator Tools:`);
    console.log(`  GET    /api/creator-tools/analyze/:mint      - Full token analysis`);
    console.log(`  GET    /api/creator-tools/fee-advice/:mint   - Fee optimization (Ghost)`);
    console.log(`  GET    /api/creator-tools/marketing-advice/:mint - Marketing tips (Sam)`);
    console.log(`  GET    /api/creator-tools/community-advice/:mint - Community help (Carlo)`);
    console.log(`\nGhost Autonomous Trading:`);
    console.log(`  GET    /api/ghost/status                     - Trading status and stats`);
    console.log(`  GET    /api/ghost/positions                  - List all positions`);
    console.log(`  GET    /api/ghost/positions/open             - List open positions`);
    console.log(`  POST   /api/ghost/enable                     - Enable trading (requires confirmation)`);
    console.log(`  POST   /api/ghost/disable                    - Disable trading (kill switch)`);
    console.log(`  POST   /api/ghost/config                     - Update trading config`);
    console.log(`  POST   /api/ghost/evaluate                   - Manually trigger evaluation`);
    console.log(`  POST   /api/ghost/check-positions            - Manually check positions`);
    console.log(`\nFinn Twitter (Requires TWITTER_BEARER_TOKEN):`);
    console.log(`  GET    /api/twitter/status                   - Twitter service status`);
    console.log(`  GET    /api/twitter/history                  - Recent post history`);
    console.log(`  POST   /api/twitter/post                     - Post a tweet as Finn`);
    console.log(`  POST   /api/twitter/thread                   - Post a thread as Finn`);
    console.log(`  POST   /api/twitter/generate-shill           - Generate shill content for token`);
  });
}

main();
