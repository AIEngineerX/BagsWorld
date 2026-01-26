// BagsWorld Agents Standalone Server
// Express server with full LLM integration and Neon DB persistence

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

import {
  characters,
  getCharacter,
  getCharacterIds,
  CharacterId,
} from './characters/index.js';
import { getBagsApiService } from './services/BagsApiService.js';
import { getLLMService, Message, ConversationContext } from './services/LLMService.js';
import { AgentCoordinator, getAgentCoordinator } from './services/AgentCoordinator.js';
import { AutonomousService, getAutonomousService } from './services/AutonomousService.js';
import { LaunchWizard } from './services/LaunchWizard.js';
import { CreatorTools } from './services/CreatorTools.js';
import { worldStateProvider } from './providers/worldState.js';
import { tokenDataProvider } from './providers/tokenData.js';
import { agentContextProvider } from './providers/agentContext.js';
import { topCreatorsProvider } from './providers/topCreators.js';
import type { Character, Memory, State, IAgentRuntime } from './types/elizaos.js';

interface DialogueTurn {
  speaker: string;
  message: string;
  timestamp: number;
}

interface DialogueResult {
  turns: DialogueTurn[];
  sentiment: 'positive' | 'negative' | 'neutral';
  summary?: string;
}

type DialogueStyle = 'casual' | 'formal' | 'debate' | 'collaborative';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
// Reduced from 50 to 8 for token efficiency (~80% savings on conversation context)
const MAX_CONVERSATION_LENGTH = 8;

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;

let sql: NeonQueryFunction<false, false> | null = null;

if (DATABASE_URL) {
  sql = neon(DATABASE_URL);
  console.log('[Database] Connected to Neon');
} else {
  console.warn('[Database] No DATABASE_URL - running without persistence');
}

const app = express();
app.use(express.json());
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

async function getConversationHistory(sessionId: string, agentId: string, limit: number = MAX_CONVERSATION_LENGTH): Promise<Message[]> {
  if (!sql) return [];

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

async function saveMessage(sessionId: string, agentId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  if (!sql) return;

  await sql`
    INSERT INTO conversation_messages (id, session_id, agent_id, role, content, created_at)
    VALUES (${uuidv4()}, ${sessionId}, ${agentId}, ${role}, ${content}, NOW())
  `;
}

async function pruneOldMessages(sessionId: string, agentId: string): Promise<void> {
  if (!sql) return;

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

function createMockRuntime(character: Character): IAgentRuntime {
  return {
    character,
    agentId: character.name.toLowerCase(),
    getSetting: (key: string) => process.env[key],
    getService: <T>(_serviceType: string): T | null => null,
  } as unknown as IAgentRuntime;
}

function createMockMemory(text: string): Memory {
  return {
    id: uuidv4(),
    content: { text },
    userId: 'user',
    agentId: 'agent',
    roomId: 'room',
  } as unknown as Memory;
}

function createMockState(): State {
  return {} as State;
}

// Cache for world state (refreshes every 60 seconds)
let worldStateCache: { data: string | null; expires: number } = { data: null, expires: 0 };
const WORLD_STATE_CACHE_TTL = 60000; // 1 minute

// Pattern to detect if user is asking about other agents
const AGENT_MENTION_PATTERN = /\b(toly|finn|ash|ghost|neo|cj|shaw|bags.?bot|who|which agent|talk to|ask)\b/i;

async function buildConversationContext(
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

  // Skip token data for now - rarely needed and adds tokens
  // const tokenResult = await tokenDataProvider.get(runtime, memory, state);
  // if (tokenResult?.text) {
  //   context.tokenData = tokenResult.text;
  // }

  // Only include agent context when user mentions other agents (~400 tokens saved)
  if (AGENT_MENTION_PATTERN.test(userMessage)) {
    const agentResult = await agentContextProvider.get(runtime, memory, state);
    if (agentResult?.text) {
      context.agentContext = agentResult.text;
    }
  }

  return context;
}

app.get('/health', async (req, res) => {
  const llmConfigured = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);

  let dbStatus = 'not configured';
  if (sql) {
    try {
      await sql`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }

  const isHealthy = dbStatus !== 'error';
  const status = isHealthy ? (dbStatus === 'connected' ? 'healthy' : 'degraded') : 'unhealthy';

  res.status(isHealthy ? 200 : 503).json({
    status,
    timestamp: Date.now(),
    version: '1.0.0',
    database: dbStatus,
    llm: llmConfigured ? 'configured' : 'not configured',
    agents: getCharacterIds().length,
  });
});

app.get('/api/agents', (req, res) => {
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

app.get('/api/agents/:agentId', (req, res) => {
  const { agentId } = req.params;
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

app.post('/api/agents/:agentId/chat', async (req, res) => {
  const { agentId } = req.params;
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

app.delete('/api/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { agentId } = req.query;

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

app.get('/api/sessions/:sessionId/history', async (req, res) => {
  const { sessionId } = req.params;
  const { agentId, limit } = req.query;

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

app.get('/api/tokens/:mint', async (req, res) => {
  const { mint } = req.params;
  const api = getBagsApiService();

  const token = await api.getToken(mint);

  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  res.json({
    success: true,
    token,
  });
});

app.get('/api/tokens/:mint/fees', async (req, res) => {
  const { mint } = req.params;
  const api = getBagsApiService();

  const fees = await api.getCreatorFees(mint);

  if (!fees) {
    res.status(404).json({ error: 'Fee data not found' });
    return;
  }

  res.json({
    success: true,
    fees,
  });
});

app.get('/api/tokens/search/:query', async (req, res) => {
  const { query } = req.params;
  const api = getBagsApiService();

  const tokens = await api.searchTokens(query);

  res.json({
    success: true,
    tokens,
    count: tokens.length,
  });
});

app.get('/api/creators/top', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const api = getBagsApiService();

  const creators = await api.getTopCreators(limit);

  res.json({
    success: true,
    creators,
    count: creators.length,
  });
});

app.get('/api/launches/recent', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const api = getBagsApiService();

  const launches = await api.getRecentLaunches(limit);

  res.json({
    success: true,
    launches,
    count: launches.length,
  });
});

app.get('/api/world-health', async (req, res) => {
  const api = getBagsApiService();

  const health = await api.getWorldHealth();

  res.json({
    success: true,
    health: health || {
      status: 'unknown',
      message: 'Unable to fetch world health data',
    },
  });
});

function buildDialogueSystemPrompt(
  characterDefs: Character[],
  topic: string,
  style: DialogueStyle
): string {
  let prompt = `You are a dialogue director orchestrating a multi-agent conversation between BagsWorld AI characters.

Your task is to generate a natural, in-character conversation about: "${topic}"

The conversation should be ${style === 'casual' ? 'casual and friendly' :
    style === 'formal' ? 'professional and informative' :
    style === 'debate' ? 'a respectful debate with different viewpoints' :
    'collaborative and solution-oriented'}.

CHARACTER PROFILES:
`;

  for (const char of characterDefs) {
    if (!char) continue;
    prompt += `\n**${char.name}**:\n`;
    const bio = char.bio;
    const bioArray = Array.isArray(bio) ? bio : typeof bio === 'string' ? [bio] : [];
    prompt += `- Bio: ${bioArray.slice(0, 2).join('. ')}\n`;
    const styleAll = char.style?.all;
    const styleArray = Array.isArray(styleAll) ? styleAll : [];
    prompt += `- Style: ${styleArray.slice(0, 2).join(', ')}\n`;
    if (char.system) {
      const speechMatch = char.system.match(/SPEECH PATTERNS?:\n([\s\S]*?)(?=\n\n|\nRULES|\nKNOWLEDGE|$)/i);
      if (speechMatch) {
        prompt += `- Speech: ${speechMatch[1].slice(0, 200)}\n`;
      }
    }
  }

  prompt += `
RULES:
1. Each character must stay in their established voice and personality
2. Keep individual turns SHORT (1-3 sentences max)
3. Characters should build on each other's points
4. Include natural reactions and acknowledgments
5. The conversation should feel organic, not scripted
6. End with a natural conclusion or agreement

FORMAT:
Output the dialogue as a series of turns, one per line, in this exact format:
[CharacterName]: Their dialogue here.

Example:
[Neo]: i see something in the chain...
[Finn]: what is it? new launch?
[Neo]: patterns forming. could be interesting.
`;

  return prompt;
}

function buildDialogueUserPrompt(
  characterDefs: Character[],
  topic: string,
  initiator: string,
  maxTurns: number,
  context?: string,
  worldContext?: string
): string {
  const initiatorChar = characterDefs.find(c => c?.name.toLowerCase() === initiator.toLowerCase());
  const initiatorName = initiatorChar?.name || initiator;

  let prompt = `Generate a ${maxTurns}-turn conversation about "${topic}".

The conversation starts with ${initiatorName} initiating.
Participants: ${characterDefs.map(c => c?.name).filter(Boolean).join(', ')}
`;

  if (context) {
    prompt += `\nAdditional context: ${context}\n`;
  }

  if (worldContext) {
    prompt += `\n${worldContext}\n`;
  }

  prompt += `\nGenerate the dialogue now:`;

  return prompt;
}

function parseDialogueResponse(text: string, participants: string[]): DialogueResult {
  const turns: DialogueTurn[] = [];
  const lines = text.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const match = line.match(/^\[?(\w+)\]?:\s*(.+)$/);
    if (match) {
      const speaker = match[1];
      const message = match[2].trim();

      const validSpeaker = participants.find(
        p => p.toLowerCase() === speaker.toLowerCase()
      );

      if (validSpeaker) {
        turns.push({
          speaker: validSpeaker,
          message,
          timestamp: Date.now(),
        });
      }
    }
  }

  const positiveWords = ['great', 'good', 'excellent', 'love', 'amazing', 'bullish', 'pumping', 'wagmi'];
  const negativeWords = ['bad', 'terrible', 'hate', 'bearish', 'dumping', 'ngmi', 'rug'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const turn of turns) {
    const lowerMessage = turn.message.toLowerCase();
    positiveCount += positiveWords.filter(w => lowerMessage.includes(w)).length;
    negativeCount += negativeWords.filter(w => lowerMessage.includes(w)).length;
  }

  const sentiment: 'positive' | 'negative' | 'neutral' = positiveCount > negativeCount ? 'positive' :
                    negativeCount > positiveCount ? 'negative' : 'neutral';

  return {
    turns,
    sentiment,
    summary: turns.length > 0 ? `${turns.length}-turn conversation about the topic` : undefined,
  };
}

app.post('/api/dialogue', async (req, res) => {
  const { topic, participants, initiator, maxTurns = 6, style = 'casual', context } = req.body;

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    return;
  }

  let dialogueParticipants: string[] = participants;
  if (!dialogueParticipants || !Array.isArray(dialogueParticipants) || dialogueParticipants.length < 2) {
    const allIds = getCharacterIds().filter(id => !['bagsbot', 'dev'].includes(id));
    const shuffled = [...allIds].sort(() => Math.random() - 0.5);
    dialogueParticipants = shuffled.slice(0, 3);
  }

  const characterDefs: Character[] = [];
  for (const p of dialogueParticipants) {
    const char = getCharacter(p.toLowerCase());
    if (!char) {
      res.status(400).json({
        error: `Unknown participant: ${p}`,
        availableAgents: getCharacterIds(),
      });
      return;
    }
    characterDefs.push(char);
  }

  const dialogueInitiator = initiator || dialogueParticipants[0];
  const validStyle: DialogueStyle = ['casual', 'formal', 'debate', 'collaborative'].includes(style)
    ? style as DialogueStyle
    : 'casual';
  const turnCount = Math.min(Math.max(parseInt(String(maxTurns)) || 6, 2), 20);

  const systemPrompt = buildDialogueSystemPrompt(characterDefs, topic, validStyle);

  let worldContext = '';
  const firstChar = characterDefs[0];
  if (firstChar) {
    const contextResult = await buildConversationContext(firstChar, topic);
    if (contextResult.worldState) {
      worldContext = contextResult.worldState;
    }
  }

  const userPrompt = buildDialogueUserPrompt(
    characterDefs,
    topic,
    dialogueInitiator,
    turnCount,
    context,
    worldContext
  );

  const llmService = getLLMService();
  // Use default model for dialogue (500 max tokens is plenty for 4 turns)
  const llmResponse = await llmService.generateWithSystemPrompt(
    systemPrompt,
    userPrompt,
    [],
    undefined, // Use default model
    500
  );

  const result = parseDialogueResponse(llmResponse.text, dialogueParticipants);

  res.json({
    success: true,
    dialogue: {
      topic,
      participants: dialogueParticipants.map(p => ({
        id: p.toLowerCase(),
        name: getCharacter(p.toLowerCase())?.name || p,
      })),
      turns: result.turns.map(turn => ({
        speaker: turn.speaker,
        speakerName: getCharacter(turn.speaker.toLowerCase())?.name || turn.speaker,
        message: turn.message,
        timestamp: turn.timestamp,
      })),
      sentiment: result.sentiment,
      summary: result.summary,
    },
    model: llmResponse.model,
    usage: llmResponse.usage,
  });
});

app.get('/api/world-state', async (req, res) => {
  const api = getBagsApiService();
  const health = await api.getWorldHealth();
  const recentLaunches = await api.getRecentLaunches(5);
  const topCreators = await api.getTopCreators(5);

  res.json({
    success: true,
    worldState: {
      health: health || { health: 0, weather: 'unknown' },
      recentLaunches,
      topCreators,
    },
    formatted: health ? `World Health: ${health.health}% (${health.weather})` : 'World state unavailable',
  });
});

// ===== Autonomous Service Endpoints =====

app.get('/api/autonomous/status', (req, res) => {
  const autonomous = getAutonomousService();

  if (!autonomous) {
    res.status(503).json({
      success: false,
      error: 'Autonomous service not initialized',
      hint: 'Set ENABLE_AUTONOMOUS=true to enable',
    });
    return;
  }

  const tasks = autonomous.getTaskStatus();

  res.json({
    success: true,
    status: 'running',
    tasks,
    taskCount: tasks.length,
  });
});

app.get('/api/autonomous/alerts', (req, res) => {
  const autonomous = getAutonomousService();

  if (!autonomous) {
    res.status(503).json({
      success: false,
      error: 'Autonomous service not initialized',
    });
    return;
  }

  const type = req.query.type as string | undefined;
  const severity = req.query.severity as string | undefined;
  const unacknowledged = req.query.unacknowledged === 'true';
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const alerts = autonomous.getAlerts({
    type: type as any,
    severity: severity as any,
    unacknowledgedOnly: unacknowledged,
    limit,
  });

  res.json({
    success: true,
    alerts,
    count: alerts.length,
  });
});

app.post('/api/autonomous/alerts/:alertId/acknowledge', (req, res) => {
  const autonomous = getAutonomousService();

  if (!autonomous) {
    res.status(503).json({
      success: false,
      error: 'Autonomous service not initialized',
    });
    return;
  }

  const { alertId } = req.params;
  autonomous.acknowledgeAlert(alertId);

  res.json({
    success: true,
    message: `Alert ${alertId} acknowledged`,
  });
});

app.post('/api/autonomous/trigger/:taskName', async (req, res) => {
  const autonomous = getAutonomousService();

  if (!autonomous) {
    res.status(503).json({
      success: false,
      error: 'Autonomous service not initialized',
    });
    return;
  }

  const { taskName } = req.params;
  const success = await autonomous.triggerTask(taskName);

  if (success) {
    res.json({
      success: true,
      message: `Task ${taskName} triggered successfully`,
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Task not found: ${taskName}`,
      availableTasks: autonomous.getTaskStatus().map(t => t.name),
    });
  }
});

// ===== Agent Coordination Endpoints =====

app.get('/api/coordination/context/:agentId', (req, res) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const { agentId } = req.params;
  const context = coordinator.buildCoordinationContext(agentId);

  res.json({
    success: true,
    agentId,
    context,
    hasContext: context.length > 0,
  });
});

app.get('/api/coordination/statuses', (req, res) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const statuses = coordinator.getAllStatuses();

  res.json({
    success: true,
    agents: statuses,
    count: statuses.length,
    online: statuses.filter(s => s.status === 'online').length,
  });
});

app.get('/api/coordination/messages/:agentId', (req, res) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const { agentId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const messages = coordinator.getMessages(agentId, { limit });

  res.json({
    success: true,
    agentId,
    messages,
    count: messages.length,
  });
});

app.post('/api/coordination/broadcast', async (req, res) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const { from, type, content, data } = req.body;

  if (!from || !content) {
    res.status(400).json({
      success: false,
      error: 'from and content are required',
    });
    return;
  }

  const messageId = await coordinator.broadcast(from, type || 'update', content, data);

  res.json({
    success: true,
    messageId,
    message: `Broadcast sent from ${from}`,
  });
});

app.get('/api/coordination/shared-context', (req, res) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const context = coordinator.getAllSharedContext();

  res.json({
    success: true,
    context,
    keys: Object.keys(context),
  });
});

// ===== Launch Wizard Endpoints (Professor Oak Guided Launches) =====

app.post('/api/launch-wizard/start', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({
      success: false,
      error: 'userId is required',
    });
    return;
  }

  const session = LaunchWizard.startSession(userId);
  const guidance = LaunchWizard.getStepGuidance(session.currentStep);

  res.json({
    success: true,
    session: {
      id: session.id,
      currentStep: session.currentStep,
      data: session.data,
    },
    guidance: {
      title: guidance.title,
      message: guidance.oakAdvice,
      prompt: guidance.prompt,
      tips: guidance.tips,
    },
  });
});

app.get('/api/launch-wizard/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = LaunchWizard.getSession(sessionId);

  if (!session) {
    res.status(404).json({
      success: false,
      error: 'Session not found',
    });
    return;
  }

  const guidance = LaunchWizard.getStepGuidance(session.currentStep);

  res.json({
    success: true,
    session: {
      id: session.id,
      currentStep: session.currentStep,
      data: session.data,
      messages: session.messages,
    },
    guidance: {
      title: guidance.title,
      message: guidance.oakAdvice,
      prompt: guidance.prompt,
      tips: guidance.tips,
      examples: guidance.examples,
    },
  });
});

app.post('/api/launch-wizard/session/:sessionId/input', async (req, res) => {
  const { sessionId } = req.params;
  const { input } = req.body;

  if (!input || typeof input !== 'string') {
    res.status(400).json({
      success: false,
      error: 'input is required and must be a string',
    });
    return;
  }

  const result = await LaunchWizard.processInput(sessionId, input);

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: result.error,
      response: result.response,
    });
    return;
  }

  const guidance = LaunchWizard.getStepGuidance(result.session.currentStep);

  res.json({
    success: true,
    response: result.response,
    session: {
      id: result.session.id,
      currentStep: result.session.currentStep,
      data: result.session.data,
    },
    guidance: {
      title: guidance.title,
      prompt: guidance.prompt,
      tips: guidance.tips,
      examples: guidance.examples,
    },
    launchReady: result.launchReady,
    launchData: result.launchData,
  });
});

app.post('/api/launch-wizard/session/:sessionId/ask', async (req, res) => {
  const { sessionId } = req.params;
  const { question } = req.body;

  if (!question || typeof question !== 'string') {
    res.status(400).json({
      success: false,
      error: 'question is required',
    });
    return;
  }

  const session = LaunchWizard.getSession(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: 'Session not found',
    });
    return;
  }

  const advice = await LaunchWizard.getPersonalizedAdvice(session, question);

  res.json({
    success: true,
    response: advice,
    agent: 'professor-oak',
  });
});

app.post('/api/launch-wizard/session/:sessionId/complete', (req, res) => {
  const { sessionId } = req.params;
  const { mint } = req.body;

  if (!mint) {
    res.status(400).json({
      success: false,
      error: 'mint address is required',
    });
    return;
  }

  LaunchWizard.completeSession(sessionId, mint);

  res.json({
    success: true,
    message: 'Launch completed! Your token is now live.',
    mint,
  });
});

// ===== Creator Tools Endpoints =====

app.get('/api/creator-tools/analyze/:mint', async (req, res) => {
  const { mint } = req.params;

  const analysis = await CreatorTools.analyzeToken(mint);

  if (!analysis) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    analysis,
  });
});

app.get('/api/creator-tools/fee-advice/:mint', async (req, res) => {
  const { mint } = req.params;

  const advice = await CreatorTools.getFeeAdvice(mint);

  if (!advice) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    advice,
    agent: 'ghost',
  });
});

app.get('/api/creator-tools/marketing-advice/:mint', async (req, res) => {
  const { mint } = req.params;
  const { twitter, telegram, website } = req.query;

  const advice = await CreatorTools.getMarketingAdvice(mint, {
    twitter: twitter as string | undefined,
    telegram: telegram as string | undefined,
    website: website as string | undefined,
  });

  if (!advice) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    advice,
    agent: 'sam',
  });
});

app.get('/api/creator-tools/community-advice/:mint', async (req, res) => {
  const { mint } = req.params;

  const advice = await CreatorTools.getCommunityAdvice(mint);

  if (!advice) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    advice,
    agent: 'carlo',
  });
});

app.get('/api/creator-tools/full-analysis/:mint', async (req, res) => {
  const { mint } = req.params;
  const { twitter, telegram, website } = req.query;

  const analysis = await CreatorTools.getFullAnalysis(mint, {
    twitter: twitter as string | undefined,
    telegram: telegram as string | undefined,
    website: website as string | undefined,
  });

  if (!analysis.token) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    analysis,
    agents: ['ghost', 'sam', 'carlo'],
  });
});

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

    console.log('[Database] Schema initialized');
  } catch (err: any) {
    console.error('[Database] Failed to initialize schema:', err.message);
    console.warn('[Database] Server will continue without database persistence');
    // Don't crash - server can run without database (in-memory only)
  }
}

// Initialize autonomous services
async function initializeAutonomousServices(): Promise<void> {
  const mockRuntime = createMockRuntime({ name: 'system' } as Character);

  // Start coordinator first (autonomous service depends on it)
  await AgentCoordinator.start(mockRuntime);
  console.log('[Autonomous] Agent coordinator initialized');

  // Start autonomous service
  const enableAutonomous = process.env.ENABLE_AUTONOMOUS !== 'false';
  if (enableAutonomous) {
    await AutonomousService.start(mockRuntime);
    console.log('[Autonomous] Autonomous service initialized with scheduled tasks');
  } else {
    console.log('[Autonomous] Autonomous service disabled (ENABLE_AUTONOMOUS=false)');
  }
}

async function main(): Promise<void> {
  console.log('Starting BagsWorld Agents Server...');

  await initializeDatabase();

  // Initialize autonomous services
  await initializeAutonomousServices();

  const llmConfigured = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  if (!llmConfigured) {
    console.error('[CRITICAL] No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    console.error('[CRITICAL] Chat functionality will fail without an LLM API key');
  } else {
    console.log(`[LLM] Using ${process.env.ANTHROPIC_API_KEY ? 'Anthropic Claude' : 'OpenAI GPT'}`);
  }

  app.listen(PORT, HOST, () => {
    console.log(`\nBagsWorld Agents Server running at http://${HOST}:${PORT}`);
    console.log(`\nLoaded ${getCharacterIds().length} agents: ${getCharacterIds().join(', ')}`);
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
  });
}

main();
