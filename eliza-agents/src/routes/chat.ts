// Chat routes - agents, chat, sessions
// GET /api/agents, GET /api/agents/:id, POST /api/agents/:id/chat
// GET /api/sessions/:id/history, DELETE /api/sessions/:id

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getCharacter,
  getCharacterIds,
} from '../characters/index.js';
import { getLLMService } from '../services/LLMService.js';
import { getMemoryService } from '../services/MemoryService.js';
import { getRelationshipService } from '../services/RelationshipService.js';
import {
  getDatabase,
  getConversationHistory,
  saveMessage,
  pruneOldMessages,
  buildConversationContext,
  dispatchAction,
  MAX_CONVERSATION_LENGTH,
} from './shared.js';

const router = Router();

// GET /api/agents - List all agents
router.get('/agents', (req: Request, res: Response) => {
  const agentIds = getCharacterIds();
  const agents = agentIds.map(id => {
    const character = getCharacter(id);
    const bio = character?.bio;
    return {
      id,
      name: character?.name || id,
      username: character?.username,
      description: Array.isArray(bio) ? bio[0] : typeof bio === 'string' ? bio : 'A BagsWorld AI agent',
      topics: character?.topics?.slice(0, 5) || [],
    };
  });

  res.json({
    success: true,
    agents,
    count: agents.length,
  });
});

// GET /api/agents/:agentId - Get agent info
router.get('/agents/:agentId', (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const character = getCharacter(agentId.toLowerCase());

  if (!character) {
    res.status(404).json({
      error: `Agent not found: ${agentId}`,
      availableAgents: getCharacterIds(),
    });
    return;
  }

  res.json({
    success: true,
    agent: {
      id: agentId.toLowerCase(),
      name: character.name,
      username: character.username,
      bio: character.bio,
      topics: character.topics || [],
      adjectives: character.adjectives || [],
      style: character.style,
    },
  });
});

// POST /api/agents/:agentId/chat - Chat with agent
router.post('/agents/:agentId/chat', async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const { message, sessionId: providedSessionId, worldState: clientWorldState, chatHistory: clientChatHistory } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required and must be a non-empty string' });
    return;
  }

  const character = getCharacter(agentId.toLowerCase());
  if (!character) {
    res.status(404).json({
      error: `Agent not found: ${agentId}`,
      availableAgents: getCharacterIds(),
    });
    return;
  }

  const sessionId = providedSessionId || uuidv4();
  const normalizedAgentId = agentId.toLowerCase();

  try {
    const conversationHistory = await getConversationHistory(sessionId, normalizedAgentId);

    await saveMessage(sessionId, normalizedAgentId, 'user', message);

    const context = await buildConversationContext(character, message, { sessionId, clientWorldState });
    context.messages = conversationHistory;

    // Action dispatch: run evaluators not covered by enrichment and execute matching actions.
    // The action result (structured, character-formatted text) is injected into context
    // so the LLM can weave real data into its natural, in-character response.
    const actionData = await dispatchAction(character, message, { sessionId }).catch((err: Error) => {
      console.warn('[chat] Action dispatch failed:', err.message);
      return null;
    });
    if (actionData) {
      context.actionData = actionData;
    }

    const llmService = getLLMService();

    const llmResponse = await llmService.generateResponse(
      character,
      message,
      conversationHistory,
      context
    );

    await saveMessage(sessionId, normalizedAgentId, 'assistant', llmResponse.text);

    await pruneOldMessages(sessionId, normalizedAgentId);

    // Persist to long-term memory and update relationship (fire-and-forget)
    const memoryService = getMemoryService();
    const relationshipService = getRelationshipService();

    if (memoryService || relationshipService) {
      // Run memory writes and relationship update in parallel, don't block response
      Promise.all([
        memoryService
          ? memoryService.createMemory({
              agentId: normalizedAgentId,
              content: `User said: ${message}`,
              memoryType: 'message',
              roomId: sessionId,
              userId: sessionId,
              importance: 0.4,
            }).catch((err: Error) => console.warn('[chat] Memory write (user) failed:', err.message))
          : null,
        memoryService
          ? memoryService.createMemory({
              agentId: normalizedAgentId,
              content: `${character.name} replied: ${llmResponse.text}`,
              memoryType: 'message',
              roomId: sessionId,
              userId: sessionId,
              importance: 0.4,
            }).catch((err: Error) => console.warn('[chat] Memory write (assistant) failed:', err.message))
          : null,
        relationshipService
          ? relationshipService.updateAfterInteraction(normalizedAgentId, sessionId, 'user', {
              topics: extractTopics(message),
              sentiment: 0.1, // Default slightly positive (user is engaging)
            }).catch((err: Error) => console.warn('[chat] Relationship update failed:', err.message))
          : null,
      ]).catch(() => {}); // Swallow any remaining errors
    }

    res.json({
      success: true,
      agentId: normalizedAgentId,
      agentName: character.name,
      response: llmResponse.text,
      sessionId,
      model: llmResponse.model,
      usage: llmResponse.usage,
    });
  } catch (err) {
    console.error(`[chat] Error in /agents/${agentId}/chat:`, err);
    res.status(500).json({
      error: 'Failed to generate response',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// DELETE /api/sessions/:sessionId - Clear session
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { agentId } = req.query;

  const sql = getDatabase();
  if (!sql) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  try {
    if (agentId) {
      await sql`
        DELETE FROM conversation_messages
        WHERE session_id = ${sessionId} AND agent_id = ${agentId as string}
      `;
    } else {
      await sql`
        DELETE FROM conversation_messages
        WHERE session_id = ${sessionId}
      `;
    }

    res.json({
      success: true,
      message: `Session ${sessionId} cleared${agentId ? ` for agent ${agentId}` : ''}`,
    });
  } catch (err) {
    console.error(`[chat] Error in DELETE /sessions/${sessionId}:`, err);
    res.status(500).json({
      error: 'Failed to clear session',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// GET /api/sessions/:sessionId/history - Get conversation history
router.get('/sessions/:sessionId/history', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { agentId, limit } = req.query;

  const sql = getDatabase();
  if (!sql) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  try {
    const messageLimit = Math.min(parseInt(limit as string) || 50, 100);

    let messages;
    if (agentId) {
      messages = await sql`
        SELECT id, agent_id, role, content, created_at
        FROM conversation_messages
        WHERE session_id = ${sessionId} AND agent_id = ${agentId as string}
        ORDER BY created_at ASC
        LIMIT ${messageLimit}
      `;
    } else {
      messages = await sql`
        SELECT id, agent_id, role, content, created_at
        FROM conversation_messages
        WHERE session_id = ${sessionId}
        ORDER BY created_at ASC
        LIMIT ${messageLimit}
      `;
    }

    res.json({
      success: true,
      sessionId,
      messages,
      count: messages.length,
    });
  } catch (err) {
    console.error(`[chat] Error in GET /sessions/${sessionId}/history:`, err);
    res.status(500).json({
      error: 'Failed to fetch history',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * Extract discussion topics from a user message for relationship tracking.
 * Returns up to 3 topic keywords detected in the message.
 */
const TOPIC_PATTERNS: [RegExp, string][] = [
  [/\b(solana|sol)\b/i, 'Solana'],
  [/\b(token|launch|create|mint)\b/i, 'Token Launch'],
  [/\b(trade|buy|sell|swap|position)\b/i, 'Trading'],
  [/\b(fee|claim|royalt|revenue)\b/i, 'Fees'],
  [/\b(nft|collection|art)\b/i, 'NFTs'],
  [/\b(defi|liquidity|pool|stake)\b/i, 'DeFi'],
  [/\b(casino|gambl|bet|slot)\b/i, 'Casino'],
  [/\b(oracle|predict|forecast)\b/i, 'Oracle'],
  [/\b(arena|fight|battle|combat)\b/i, 'Arena'],
  [/\b(moltbook|social|post)\b/i, 'Moltbook'],
  [/\b(wallet|phantom|connect)\b/i, 'Wallet'],
  [/\b(market|chart|price|volume)\b/i, 'Market Data'],
];

function extractTopics(message: string): string[] {
  const topics: string[] = [];
  for (const [pattern, topic] of TOPIC_PATTERNS) {
    if (pattern.test(message)) {
      topics.push(topic);
      if (topics.length >= 3) break;
    }
  }
  return topics;
}

export default router;
