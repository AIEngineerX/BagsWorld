// Shared utilities for route handlers
// Database helpers, mock creators, and context builders

import { v4 as uuidv4 } from 'uuid';
import { NeonQueryFunction } from '@neondatabase/serverless';
import type { Character, Memory, State, IAgentRuntime } from '../types/elizaos.js';
import { Message, ConversationContext } from '../services/LLMService.js';
import { worldStateProvider } from '../providers/worldState.js';
import { agentContextProvider } from '../providers/agentContext.js';
import { oracleDataProvider } from '../providers/oracleData.js';
import { ghostTradingProvider } from '../providers/ghostTrading.js';
import { getBagsApiService } from '../services/BagsApiService.js';
import {
  tokenMentionEvaluator,
  feeQueryEvaluator,
  launchQueryEvaluator,
} from '../evaluators/index.js';

// Reduced from 50 to 8 for token efficiency (~80% savings on conversation context)
export const MAX_CONVERSATION_LENGTH = 8;

// Cache for world state (refreshes every 60 seconds)
let worldStateCache: { data: string | null; expires: number } = { data: null, expires: 0 };
const WORLD_STATE_CACHE_TTL = 60000; // 1 minute

// Pattern to detect if user is asking about other agents
const AGENT_MENTION_PATTERN = /\b(toly|finn|ash|ghost|neo|cj|shaw|bags.?bot|who|which agent|talk to|ask)\b/i;

// Pattern to detect Oracle-related queries
const ORACLE_PATTERN = /\b(oracle|predict|prediction|forecast|tower|bet|pick|winner|round)\b/i;

// Pattern to detect trading-related queries
const TRADING_PATTERN = /\b(trad|position|buy|sell|pnl|profit|loss|exposure|performance|portfolio|stats|holding|wallet)\b/i;

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
    console.warn('[shared] getConversationHistory: Database not configured, returning empty history');
    return [];
  }

  const rows = await sql`
    SELECT role, content
    FROM conversation_messages
    WHERE session_id = ${sessionId} AND agent_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  ` as Array<{ role: 'user' | 'assistant'; content: string }>;

  return rows.reverse().map(row => ({
    role: row.role,
    content: row.content,
  }));
}

export async function saveMessage(
  sessionId: string,
  agentId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const sql = dbInstance;
  if (!sql) {
    console.warn('[shared] saveMessage: Database not configured, message not persisted');
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
    console.warn('[shared] pruneOldMessages: Database not configured, skipping prune');
    return;
  }

  const countResult = await sql`
    SELECT COUNT(*) as count FROM conversation_messages
    WHERE session_id = ${sessionId} AND agent_id = ${agentId}
  ` as Array<{ count: string }>;

  const count = parseInt(countResult[0]?.count || '0', 10);

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
    userId: 'user',
    agentId: 'agent',
    roomId: 'room',
  } as unknown as Memory;
}

export function createMockState(): State {
  return {} as State;
}

export async function buildConversationContext(
  character: Character,
  userMessage: string
): Promise<ConversationContext> {
  const runtime = createMockRuntime(character);
  const memory = createMockMemory(userMessage);
  const state = createMockState();

  const context: ConversationContext = {
    messages: [],
  };

  // Use cached world state if available (saves API calls + tokens)
  const now = Date.now();
  if (worldStateCache.data && now < worldStateCache.expires) {
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
  const isGhost = character.name.toLowerCase() === 'ghost';
  const askingAboutTrading = TRADING_PATTERN.test(userMessage);

  if (isGhost || askingAboutTrading) {
    const tradingResult = await ghostTradingProvider.get(runtime, memory, state);
    if (tradingResult?.text) {
      context.tradingState = tradingResult.text;
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
          ? (await api.searchTokens(symbol).catch(() => []))[0] ?? null
          : null;

      if (token) {
        const parts = [`${token.name} ($${token.symbol})`];
        if (token.marketCap) parts.push(`Market Cap: $${token.marketCap.toLocaleString()}`);
        if (token.volume24h) parts.push(`24h Volume: $${token.volume24h.toLocaleString()}`);
        if (token.lifetimeFees) parts.push(`Lifetime Fees: ${token.lifetimeFees.toFixed(4)} SOL`);
        if (token.holders) parts.push(`Holders: ${token.holders}`);
        if (token.price) parts.push(`Price: $${token.price}`);
        if (token.change24h !== undefined) parts.push(`24h Change: ${token.change24h > 0 ? '+' : ''}${token.change24h.toFixed(2)}%`);
        tokenDataParts.push(`TOKEN: ${parts.join(' | ')}`);

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
        const tokenMint = mint || (symbol ? (await api.searchTokens(symbol).catch(() => []))[0]?.mint : null);
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
        const launchLines = launches.map(l => {
          const age = Date.now() - l.launchedAt;
          const hours = Math.floor(age / 3600000);
          const timeStr = hours < 1 ? 'just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
          const mc = l.initialMarketCap ? `MC: $${l.initialMarketCap.toLocaleString()}` : '';
          return `- ${l.name} ($${l.symbol}) ${timeStr} ${mc}`.trim();
        });
        tokenDataParts.push(`RECENT LAUNCHES:\n${launchLines.join('\n')}`);
      }
    }

    if (tokenDataParts.length > 0) {
      context.tokenData = tokenDataParts.join('\n\n');
    }
  } catch (error) {
    // Enrichment is best-effort - don't break chat if it fails
    console.warn('[shared] Evaluator enrichment failed:', error instanceof Error ? error.message : error);
  }

  return context;
}
