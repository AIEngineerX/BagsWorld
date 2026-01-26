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
import {
  getDatabase,
  getConversationHistory,
  saveMessage,
  pruneOldMessages,
  buildConversationContext,
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
  const { message, sessionId: providedSessionId } = req.body;

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

  const conversationHistory = await getConversationHistory(sessionId, normalizedAgentId);

  await saveMessage(sessionId, normalizedAgentId, 'user', message);

  const context = await buildConversationContext(character, message);
  context.messages = conversationHistory;

  const llmService = getLLMService();

  const llmResponse = await llmService.generateResponse(
    character,
    message,
    conversationHistory,
    context
  );

  await saveMessage(sessionId, normalizedAgentId, 'assistant', llmResponse.text);

  await pruneOldMessages(sessionId, normalizedAgentId);

  res.json({
    success: true,
    agentId: normalizedAgentId,
    agentName: character.name,
    response: llmResponse.text,
    sessionId,
    model: llmResponse.model,
    usage: llmResponse.usage,
  });
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
});

export default router;
