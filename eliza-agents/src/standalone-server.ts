// BagsWorld Agents Standalone Server
// Deployable Express server for Render/Railway

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

import { getCharacter, getCharacterIds } from './characters';
import { getDatabaseAdapter } from './db';
import { initializeCoordination, cleanupCoordination } from './coordination';
import { getAgentBus } from './coordination/agent-bus';
import { getSharedContext } from './coordination/shared-context';
import { getDialogueManager } from './coordination/dialogue-manager';
import { getTelegramBot } from './telegram';

// Environment configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// List all agents
app.get('/api/agents', (req, res) => {
  const agentIds = getCharacterIds();
  const agents = agentIds.map(id => {
    const character = getCharacter(id);
    const bio = character?.bio;
    return {
      id,
      name: character?.name || id,
      description: Array.isArray(bio) ? bio[0] : 'A BagsWorld AI agent',
    };
  });

  res.json({
    success: true,
    agents,
    count: agents.length,
  });
});

// Get single agent info
app.get('/api/agents/:agentId', (req, res) => {
  const { agentId } = req.params;
  const character = getCharacter(agentId.toLowerCase());

  if (!character) {
    return res.status(404).json({
      error: `Agent not found: ${agentId}`,
      availableAgents: getCharacterIds(),
    });
  }

  res.json({
    success: true,
    agent: {
      id: agentId.toLowerCase(),
      name: character.name,
      bio: character.bio,
      style: character.style,
      topics: character.topics || [],
    },
  });
});

// Chat with an agent
app.post('/api/agents/:agentId/chat', async (req, res) => {
  const { agentId } = req.params;
  const { message, sessionId, conversationHistory = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const character = getCharacter(agentId.toLowerCase());
  if (!character) {
    return res.status(404).json({ error: `Agent not found: ${agentId}` });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sharedContext = getSharedContext();
    const worldContext = sharedContext.formatWorldStateForPrompt();

    // Build system prompt
    let systemPrompt = character.system || '';
    if (character.bio && Array.isArray(character.bio)) {
      systemPrompt += '\n\nABOUT YOU:\n' + (character.bio as string[]).slice(0, 3).join('\n');
    }
    if (worldContext) {
      systemPrompt += '\n\n' + worldContext;
    }

    // Build messages
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Detect mentions of other agents
    const bus = getAgentBus();
    const mention = bus.detectMention(message);

    res.json({
      success: true,
      agentId: agentId.toLowerCase(),
      agentName: character.name,
      response: content.text,
      suggestedAgent: mention?.agentId,
      sessionId: sessionId || uuidv4(),
    });

  } catch (error) {
    console.error(`[Chat] Error with ${agentId}:`, error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Generate multi-agent dialogue
app.post('/api/dialogue', async (req, res) => {
  const { topic, participants, initiator, maxTurns = 6, style = 'casual', context } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'topic is required' });
  }

  try {
    const dialogueManager = getDialogueManager();

    // Default participants if not specified
    let dialogueParticipants = participants;
    if (!dialogueParticipants || dialogueParticipants.length < 2) {
      const allIds = getCharacterIds().filter(id => !['bagsbot', 'dev'].includes(id));
      const shuffled = [...allIds].sort(() => Math.random() - 0.5);
      dialogueParticipants = shuffled.slice(0, 3);
    }

    const result = await dialogueManager.generateDialogue({
      topic,
      participants: dialogueParticipants,
      initiator: initiator || dialogueParticipants[0],
      maxTurns,
      style,
      context,
    });

    res.json({
      success: true,
      dialogue: {
        topic,
        participants: dialogueParticipants.map((p: string) => ({
          id: p,
          name: getCharacter(p)?.name || p,
        })),
        turns: result.turns.map(turn => ({
          speaker: turn.speaker,
          speakerName: getCharacter(turn.speaker)?.name || turn.speaker,
          message: turn.message,
          timestamp: turn.timestamp,
        })),
        sentiment: result.sentiment,
        summary: result.summary,
      },
    });

  } catch (error) {
    console.error('[Dialogue] Error:', error);
    res.status(500).json({ error: 'Failed to generate dialogue' });
  }
});

// Get world state
app.get('/api/world-state', (req, res) => {
  const sharedContext = getSharedContext();
  const worldState = sharedContext.getWorldState();
  const recentEvents = sharedContext.getRecentEvents(10);

  res.json({
    success: true,
    worldState,
    recentEvents,
    formatted: sharedContext.formatWorldStateForPrompt(),
  });
});

// Telegram webhook endpoint
app.post('/api/telegram/webhook', async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.json({ ok: true, message: 'Bot not configured' });
  }

  try {
    const bot = getTelegramBot({
      botToken,
      defaultAgentId: process.env.TELEGRAM_DEFAULT_AGENT || 'finn',
      bagsWorldApiUrl: process.env.BAGSWORLD_API_URL || 'http://localhost:3000',
    });

    await bot.handleUpdate(req.body);
    res.json({ ok: true });

  } catch (error) {
    console.error('[Telegram] Error:', error);
    res.json({ ok: true });
  }
});

// Setup Telegram webhook
app.get('/api/telegram/setup', async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  }

  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
    }),
  });

  const result = await response.json();

  res.json({
    success: result.ok,
    webhookUrl,
    message: result.ok ? 'Webhook set successfully' : result.description,
  });
});

// Initialize and start server
async function main() {
  console.log('Starting BagsWorld Agents Server...');

  // Initialize database
  console.log('Initializing database...');
  const db = getDatabaseAdapter();
  await db.initialize();

  // Initialize coordination system
  console.log('Initializing coordination system...');
  const { bus } = await initializeCoordination();

  // Register all agents with the bus
  console.log('Registering agents...');
  const agentIds = getCharacterIds().filter(id => !['bagsbot', 'dev'].includes(id));
  for (const agentId of agentIds) {
    const character = getCharacter(agentId);
    if (character) {
      bus.registerAgent({
        id: agentId,
        character,
        capabilities: {
          canGenerateDialogue: true,
          canReceiveMentions: true,
          canHandoffConversation: true,
        },
        status: 'ready',
        lastActive: Date.now(),
      });
    }
  }

  console.log(`Registered ${agentIds.length} agents: ${agentIds.join(', ')}`);

  // Start the server
  app.listen(PORT, HOST, () => {
    console.log(`BagsWorld Agents Server running at http://${HOST}:${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /health                    - Health check`);
    console.log(`  GET  /api/agents                - List all agents`);
    console.log(`  GET  /api/agents/:id            - Get agent info`);
    console.log(`  POST /api/agents/:id/chat       - Chat with agent`);
    console.log(`  POST /api/dialogue              - Generate multi-agent dialogue`);
    console.log(`  GET  /api/world-state           - Get world state`);
    console.log(`  POST /api/telegram/webhook      - Telegram webhook`);
    console.log(`  GET  /api/telegram/setup        - Setup Telegram webhook`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await cleanupCoordination();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
