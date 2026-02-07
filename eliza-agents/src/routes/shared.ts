// Shared utilities for route handlers
// Database helpers, mock creators, and context builders

import { v4 as uuidv4 } from "uuid";
import { NeonQueryFunction } from "@neondatabase/serverless";
import type { Character, Memory, State, IAgentRuntime } from "../types/elizaos.js";
import { Message, ConversationContext } from "../services/LLMService.js";
import { worldStateProvider } from "../providers/worldState.js";
import { agentContextProvider } from "../providers/agentContext.js";
import { oracleDataProvider } from "../providers/oracleData.js";
import { ghostTradingProvider } from "../providers/ghostTrading.js";
import { getBagsApiService } from "../services/BagsApiService.js";
import { getMemoryService } from "../services/MemoryService.js";
import { getRelationshipService } from "../services/RelationshipService.js";
import {
  tokenMentionEvaluator,
  feeQueryEvaluator,
  launchQueryEvaluator,
  worldStatusEvaluator,
  creatorQueryEvaluator,
  oracleQueryEvaluator,
} from "../evaluators/index.js";
import type { Action, ActionResult } from "../types/elizaos.js";
import { checkWorldHealthAction } from "../actions/checkWorldHealth.js";
import { getTopCreatorsAction } from "../actions/getTopCreators.js";
import { getOracleRoundAction } from "../actions/getOracleRound.js";
import { enterPredictionAction } from "../actions/enterPrediction.js";
import { checkPredictionAction } from "../actions/checkPrediction.js";
import { getOracleHistoryAction } from "../actions/getOracleHistory.js";
import { getOracleLeaderboardAction } from "../actions/getOracleLeaderboard.js";
import { getOraclePricesAction } from "../actions/getOraclePrices.js";
import { claimFeesReminderAction } from "../actions/claimFeesReminderAction.js";
import { shillTokenAction } from "../actions/shillTokenAction.js";

// Reduced from 50 to 8 for token efficiency (~80% savings on conversation context)
export const MAX_CONVERSATION_LENGTH = 8;

// Cache for world state (refreshes every 60 seconds)
let worldStateCache: { data: string | null; expires: number } = { data: null, expires: 0 };
const WORLD_STATE_CACHE_TTL = 60000; // 1 minute

// Pattern to detect if user is asking about other agents
const AGENT_MENTION_PATTERN =
  /\b(toly|finn|ash|ghost|neo|cj|shaw|bags.?bot|who|which agent|talk to|ask)\b/i;

// Pattern to detect Oracle-related queries
const ORACLE_PATTERN = /\b(oracle|predict|prediction|forecast|tower|bet|pick|winner|round)\b/i;

// Pattern to detect trading-related queries
const TRADING_PATTERN =
  /\b(trad|position|buy|sell|pnl|profit|loss|exposure|performance|portfolio|stats|holding|wallet)\b/i;

// Database instance - set by server.ts
let dbInstance: NeonQueryFunction<false, false> | null = null;

export function setDatabase(sql: NeonQueryFunction<false, false> | null): void {
  dbInstance = sql;
}

export function getDatabase(): NeonQueryFunction<false, false> | null {
  return dbInstance;
}

export async function getConversationHistory(
  sessionId: string,
  agentId: string,
  limit: number = MAX_CONVERSATION_LENGTH
): Promise<Message[]> {
  const sql = dbInstance;
  if (!sql) {
    console.warn(
      "[shared] getConversationHistory: Database not configured, returning empty history"
    );
    return [];
  }

  const rows = (await sql`
    SELECT role, content
    FROM conversation_messages
    WHERE session_id = ${sessionId} AND agent_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Array<{ role: "user" | "assistant"; content: string }>;

  return rows.reverse().map((row) => ({
    role: row.role,
    content: row.content,
  }));
}

export async function saveMessage(
  sessionId: string,
  agentId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const sql = dbInstance;
  if (!sql) {
    console.warn("[shared] saveMessage: Database not configured, message not persisted");
    return;
  }

  await sql`
    INSERT INTO conversation_messages (id, session_id, agent_id, role, content, created_at)
    VALUES (${uuidv4()}, ${sessionId}, ${agentId}, ${role}, ${content}, NOW())
  `;
}

export async function pruneOldMessages(sessionId: string, agentId: string): Promise<void> {
  const sql = dbInstance;
  if (!sql) {
    console.warn("[shared] pruneOldMessages: Database not configured, skipping prune");
    return;
  }

  const countResult = (await sql`
    SELECT COUNT(*) as count FROM conversation_messages
    WHERE session_id = ${sessionId} AND agent_id = ${agentId}
  `) as Array<{ count: string }>;

  const count = parseInt(countResult[0]?.count || "0", 10);

  if (count > MAX_CONVERSATION_LENGTH) {
    const deleteCount = count - MAX_CONVERSATION_LENGTH;

    await sql`
      DELETE FROM conversation_messages
      WHERE id IN (
        SELECT id FROM conversation_messages
        WHERE session_id = ${sessionId} AND agent_id = ${agentId}
        ORDER BY created_at ASC
        LIMIT ${deleteCount}
      )
    `;
  }
}

export function createMockRuntime(character: Character): IAgentRuntime {
  return {
    character,
    agentId: character.name.toLowerCase(),
    getSetting: (key: string) => process.env[key],
    getService: <T>(_serviceType: string): T | null => null,
  } as unknown as IAgentRuntime;
}

export function createMockMemory(text: string): Memory {
  return {
    id: uuidv4(),
    content: { text },
    userId: "user",
    agentId: "agent",
    roomId: "room",
  } as unknown as Memory;
}

export function createMockState(): State {
  return {} as State;
}

export async function buildConversationContext(
  character: Character,
  userMessage: string,
  options?: {
    sessionId?: string;
    clientWorldState?: {
      health: number;
      weather: string;
      buildingCount: number;
      populationCount: number;
    };
  }
): Promise<ConversationContext> {
  const runtime = createMockRuntime(character);
  const memory = createMockMemory(userMessage);
  const state = createMockState();
  const agentId = character.name.toLowerCase().replace(/\s+/g, "-");

  const context: ConversationContext = {
    messages: [],
  };

  // Use client-provided world state if available (more current than server cache),
  // then fall back to cached server state, then fetch fresh
  const now = Date.now();
  if (options?.clientWorldState) {
    const ws = options.clientWorldState;
    context.worldState = `BAGSWORLD STATUS (from game client):\n- World Health: ${ws.health}%\n- Weather: ${ws.weather}\n- Buildings: ${ws.buildingCount}\n- Population: ${ws.populationCount}`;
  } else if (worldStateCache.data && now < worldStateCache.expires) {
    context.worldState = worldStateCache.data;
  } else {
    const worldResult = await worldStateProvider.get(runtime, memory, state);
    if (worldResult?.text) {
      context.worldState = worldResult.text;
      worldStateCache = { data: worldResult.text, expires: now + WORLD_STATE_CACHE_TTL };
    }
  }

  // Only include agent context when user mentions other agents (~400 tokens saved)
  if (AGENT_MENTION_PATTERN.test(userMessage)) {
    const agentResult = await agentContextProvider.get(runtime, memory, state);
    if (agentResult?.text) {
      context.agentContext = agentResult.text;
    }
  }

  // Include Oracle context when user asks about predictions
  if (ORACLE_PATTERN.test(userMessage)) {
    const oracleResult = await oracleDataProvider.get(runtime, memory, state);
    if (oracleResult?.text) {
      context.oracleState = oracleResult.text;
    }
  }

  // Include Ghost trading context when talking to Ghost or asking about trading
  const isGhost = character.name.toLowerCase() === "ghost";
  const askingAboutTrading = TRADING_PATTERN.test(userMessage);

  if (isGhost || askingAboutTrading) {
    const tradingResult = await ghostTradingProvider.get(runtime, memory, state);
    if (tradingResult?.text) {
      context.tradingState = tradingResult.text;
    }
  }

  // Memory and relationship context: query Week 2 services if initialized
  const memoryService = getMemoryService();
  const relationshipService = getRelationshipService();

  if (memoryService || relationshipService) {
    const sessionId = options?.sessionId;

    // Run memory and relationship lookups in parallel
    const [memoryResult, relationshipResult] = await Promise.all([
      memoryService
        ? memoryService
            .summarizeForPrompt(agentId, userMessage, {
              userId: sessionId,
              maxTokenBudget: 600,
            })
            .catch((err: Error) => {
              console.warn("[shared] Memory summarize failed:", err.message);
              return "";
            })
        : Promise.resolve(""),
      relationshipService && sessionId
        ? relationshipService.summarizeForPrompt(agentId, sessionId).catch((err: Error) => {
            console.warn("[shared] Relationship summarize failed:", err.message);
            return "";
          })
        : Promise.resolve(""),
    ]);

    if (memoryResult) {
      context.memoryContext = memoryResult;
    }
    if (relationshipResult) {
      context.relationshipContext = relationshipResult;
    }
  }

  // Evaluator-driven data enrichment: run evaluators and fetch real data when relevant
  try {
    const tokenDataParts: string[] = [];

    // Run evaluators in parallel
    const [tokenResult, feeResult, launchResult] = await Promise.all([
      tokenMentionEvaluator.evaluate(runtime, memory, state),
      feeQueryEvaluator.evaluate(runtime, memory, state),
      launchQueryEvaluator.evaluate(runtime, memory, state),
    ]);

    const api = getBagsApiService();

    // Token mention: auto-lookup when user pastes a mint or $SYMBOL
    if (tokenResult.score >= 0.5) {
      const mint = tokenResult.data?.mint as string | undefined;
      const symbol = tokenResult.data?.symbol as string | undefined;

      const token = mint
        ? await api.getToken(mint).catch(() => null)
        : symbol
          ? ((await api.searchTokens(symbol).catch(() => []))[0] ?? null)
          : null;

      if (token) {
        const parts = [`${token.name} ($${token.symbol})`];
        if (token.marketCap) parts.push(`Market Cap: $${token.marketCap.toLocaleString()}`);
        if (token.volume24h) parts.push(`24h Volume: $${token.volume24h.toLocaleString()}`);
        if (token.lifetimeFees) parts.push(`Lifetime Fees: ${token.lifetimeFees.toFixed(4)} SOL`);
        if (token.holders) parts.push(`Holders: ${token.holders}`);
        if (token.price) parts.push(`Price: $${token.price}`);
        if (token.change24h !== undefined)
          parts.push(`24h Change: ${token.change24h > 0 ? "+" : ""}${token.change24h.toFixed(2)}%`);
        tokenDataParts.push(`TOKEN: ${parts.join(" | ")}`);

        // Also fetch fees if the fee evaluator triggered or token was found
        if (feeResult.score >= 0.3 && (mint || token.mint)) {
          const fees = await api.getCreatorFees(mint || token.mint).catch(() => null);
          if (fees) {
            tokenDataParts.push(
              `FEES: Total: ${fees.totalFees.toFixed(4)} SOL | Claimed: ${fees.claimedFees.toFixed(4)} SOL | Unclaimed: ${fees.unclaimedFees.toFixed(4)} SOL`
            );
          }
        }
      }
    }
    // Fee query without a specific token mention (general fee question)
    else if (feeResult.score >= 0.5) {
      const mint = userMessage.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0];
      const symbol = userMessage.match(/\$([A-Za-z]{2,10})/)?.[1];

      if (mint || symbol) {
        const tokenMint =
          mint || (symbol ? (await api.searchTokens(symbol).catch(() => []))[0]?.mint : null);
        if (tokenMint) {
          const fees = await api.getCreatorFees(tokenMint).catch(() => null);
          if (fees) {
            tokenDataParts.push(
              `FEES for ${tokenMint.slice(0, 8)}...: Total: ${fees.totalFees.toFixed(4)} SOL | Claimed: ${fees.claimedFees.toFixed(4)} SOL | Unclaimed: ${fees.unclaimedFees.toFixed(4)} SOL`
            );
          }
        }
      }
    }

    // Launch query: auto-fetch recent launches
    if (launchResult.score >= 0.5) {
      const launches = await api.getRecentLaunches(5).catch(() => []);
      if (launches.length > 0) {
        const launchLines = launches.map((l) => {
          const age = Date.now() - l.launchedAt;
          const hours = Math.floor(age / 3600000);
          const timeStr =
            hours < 1
              ? "just now"
              : hours < 24
                ? `${hours}h ago`
                : `${Math.floor(hours / 24)}d ago`;
          const mc = l.initialMarketCap ? `MC: $${l.initialMarketCap.toLocaleString()}` : "";
          return `- ${l.name} ($${l.symbol}) ${timeStr} ${mc}`.trim();
        });
        tokenDataParts.push(`RECENT LAUNCHES:\n${launchLines.join("\n")}`);
      }
    }

    if (tokenDataParts.length > 0) {
      context.tokenData = tokenDataParts.join("\n\n");
    }
  } catch (error) {
    // Enrichment is best-effort - don't break chat if it fails
    console.warn(
      "[shared] Evaluator enrichment failed:",
      error instanceof Error ? error.message : error
    );
  }

  return context;
}

// ---------------------------------------------------------------------------
// ACTION DISPATCH ARCHITECTURE
// ---------------------------------------------------------------------------
//
// The chat pipeline uses two mechanisms to inject live data into the LLM context:
//
// 1. ENRICHMENT (buildConversationContext, above)
//    - Runs evaluators: tokenMention, feeQuery, launchQuery
//    - On match, calls BagsApiService methods directly (getToken, getCreatorFees,
//      getRecentLaunches) and injects the data into context.tokenData.
//    - This means the corresponding ACTION handlers (lookupToken, getCreatorFees,
//      getRecentLaunches) are NOT called here. Their handler() methods exist for
//      the autonomous tick pipeline (AgentTickService), not the chat pipeline.
//
// 2. DISPATCH (dispatchAction, below)
//    - Runs evaluators: worldStatus, creatorQuery, oracleQuery
//    - On match, calls the corresponding action's validate() + handler() and
//      injects the result into context.actionData.
//    - Also handles character-specific actions: claimFeesReminder (any character),
//      shillToken (Finn only).
//
// WALLET LIMITATION:
//    Oracle actions (enterPrediction, checkPrediction) require a wallet address
//    passed via message.content.wallet. The chat route forwards the optional
//    `wallet` field from the request body. If the game client doesn't send a
//    wallet, these actions will return "connect your wallet" — this is expected.
//
// MOCK RUNTIME:
//    All actions receive a mock IAgentRuntime where getService() returns null.
//    Actions fall back to singleton service instances (getBagsApiService(), etc).
//    This is intentional: the full ElizaOS runtime is not instantiated in the
//    chat pipeline. Only type compatibility is maintained.
// ---------------------------------------------------------------------------

// Minimum evaluator score to trigger action dispatch
const ACTION_DISPATCH_THRESHOLD = 0.5;

// Oracle actions ordered by specificity — most specific first so we pick the best match
const ORACLE_ACTIONS_BY_PRIORITY: Action[] = [
  enterPredictionAction, // "I predict $X will win" — most specific intent
  checkPredictionAction, // "Did I win?" / "Check my prediction"
  getOracleLeaderboardAction, // "Who are the top predictors?"
  getOraclePricesAction, // "Which token is winning?" / live prices
  getOracleHistoryAction, // "Show past oracle rounds"
  getOracleRoundAction, // "What's the oracle round?" — most general
];

/**
 * Dispatch actions based on evaluator scoring for queries not already handled
 * by the data enrichment pipeline in buildConversationContext.
 *
 * Enrichment already handles: tokenMention, feeQuery, launchQuery.
 * This function handles: worldStatus, creatorQuery, oracleQuery,
 * plus character-specific actions (claimFeesReminder, shillToken).
 *
 * Returns the action result text to inject into ConversationContext.actionData,
 * or null if no action was dispatched.
 */
export async function dispatchAction(
  character: Character,
  userMessage: string,
  options?: { sessionId?: string; wallet?: string }
): Promise<string | null> {
  const runtime = createMockRuntime(character);
  const memory = createMockMemory(userMessage);
  if (options?.wallet) {
    memory.content.wallet = options.wallet;
  }
  const state = createMockState();

  // Run evaluators that aren't covered by the enrichment pipeline, in parallel.
  // Each evaluator is individually guarded so one failure doesn't block the others.
  const noMatch = { score: 0, reason: "evaluator failed" };
  const [worldResult, creatorResult, oracleResult] = await Promise.all([
    worldStatusEvaluator.evaluate(runtime, memory, state).catch((err: Error) => {
      console.warn("[shared] worldStatusEvaluator failed:", err.message);
      return noMatch;
    }),
    creatorQueryEvaluator.evaluate(runtime, memory, state).catch((err: Error) => {
      console.warn("[shared] creatorQueryEvaluator failed:", err.message);
      return noMatch;
    }),
    oracleQueryEvaluator.evaluate(runtime, memory, state).catch((err: Error) => {
      console.warn("[shared] oracleQueryEvaluator failed:", err.message);
      return noMatch;
    }),
  ]);

  // Build candidate list: { action, score, priority (lower = more important), preValidated }
  // preValidated tracks whether validate() was already called during candidate selection,
  // so we don't call it again in the execution loop.
  const candidates: Array<{
    action: Action;
    score: number;
    priority: number;
    preValidated: boolean;
  }> = [];

  if (worldResult.score >= ACTION_DISPATCH_THRESHOLD) {
    candidates.push({
      action: checkWorldHealthAction,
      score: worldResult.score,
      priority: 10,
      preValidated: false,
    });
  }

  if (creatorResult.score >= ACTION_DISPATCH_THRESHOLD) {
    candidates.push({
      action: getTopCreatorsAction,
      score: creatorResult.score,
      priority: 10,
      preValidated: false,
    });
  }

  // Oracle: pick the most specific action that validates
  if (oracleResult.score >= ACTION_DISPATCH_THRESHOLD) {
    for (const oracleAction of ORACLE_ACTIONS_BY_PRIORITY) {
      try {
        if (oracleAction.validate) {
          const valid = await oracleAction.validate(runtime, memory, state);
          if (valid) {
            candidates.push({
              action: oracleAction,
              score: oracleResult.score,
              priority: 5,
              preValidated: true,
            });
            break;
          }
        }
      } catch (err) {
        console.warn(
          `[shared] Oracle action ${oracleAction.name} validate failed:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  // Character-specific actions: claimFeesReminder works for any character,
  // shillToken is Finn-specific
  const characterName = character.name.toLowerCase();

  try {
    if (claimFeesReminderAction.validate) {
      const valid = await claimFeesReminderAction.validate(runtime, memory, state);
      if (valid) {
        candidates.push({
          action: claimFeesReminderAction,
          score: 0.8,
          priority: 3,
          preValidated: true,
        });
      }
    }
  } catch (err) {
    console.warn(
      "[shared] claimFeesReminder validate failed:",
      err instanceof Error ? err.message : err
    );
  }

  try {
    if (characterName === "finn" && shillTokenAction.validate) {
      const valid = await shillTokenAction.validate(runtime, memory, state);
      if (valid) {
        candidates.push({ action: shillTokenAction, score: 0.8, priority: 3, preValidated: true });
      }
    }
  } catch (err) {
    console.warn("[shared] shillToken validate failed:", err instanceof Error ? err.message : err);
  }

  if (candidates.length === 0) return null;

  // Sort by priority (lower first), then by evaluator score (higher first)
  candidates.sort((a, b) => a.priority - b.priority || b.score - a.score);

  // Try each candidate until one validates and executes successfully
  for (const candidate of candidates) {
    try {
      // Only validate if we haven't already (oracle/character actions were pre-validated)
      if (!candidate.preValidated && candidate.action.validate) {
        const valid = await candidate.action.validate(runtime, memory, state);
        if (!valid) continue;
      }

      const result = await candidate.action.handler(runtime, memory, state);
      if (!result) continue;

      const actionResult = result as ActionResult;
      if (actionResult.success && actionResult.text) {
        console.log(
          `[shared] Action dispatched: ${candidate.action.name} (score: ${candidate.score.toFixed(2)})`
        );
        return actionResult.text;
      }

      // Action returned but wasn't successful — still include its text if it has useful info
      // (e.g., "connect your wallet to enter a prediction" is helpful context)
      if (actionResult.text) {
        console.log(`[shared] Action ${candidate.action.name} returned non-success with message`);
        return actionResult.text;
      }
    } catch (err) {
      console.warn(
        `[shared] Action ${candidate.action.name} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return null;
}
