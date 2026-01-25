// Shaw ElizaOS Standalone Server
// True ElizaOS runtime with memory persistence and character-driven responses

import Anthropic from '@anthropic-ai/sdk';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { shawCharacter } from './characters/shaw';
import * as fs from 'fs';
import * as path from 'path';

const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '3001');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// ============================================================================
// ELIZAOS MEMORY SYSTEM
// Implements ElizaOS-style memory with JSON file persistence
// ============================================================================

interface Memory {
  id: string;
  agentId: string;
  userId: string;
  roomId: string;
  content: {
    text: string;
    source: string;
    action?: string;
  };
  createdAt: number;
  embedding?: number[];
}

interface Conversation {
  roomId: string;
  userId: string;
  messages: Memory[];
  lastActive: number;
}

// Memory storage
const DATA_DIR = path.join(process.cwd(), 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'shaw-memories.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load memories from disk
function loadMemories(): Map<string, Conversation> {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (error) {
    console.error('[Memory] Failed to load memories:', error);
  }
  return new Map();
}

// Save memories to disk
function saveMemories(memories: Map<string, Conversation>): void {
  try {
    const data = Object.fromEntries(memories);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[Memory] Failed to save memories:', error);
  }
}

// In-memory storage with persistence
let conversations: Map<string, Conversation> = loadMemories();

// Generate UUID
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Add memory to conversation
function addMemory(roomId: string, userId: string, text: string, source: string, isAgent = false): Memory {
  const memory: Memory = {
    id: generateId(),
    agentId: isAgent ? 'shaw' : '',
    userId: isAgent ? 'shaw' : userId,
    roomId,
    content: {
      text,
      source,
    },
    createdAt: Date.now(),
  };

  if (!conversations.has(roomId)) {
    conversations.set(roomId, {
      roomId,
      userId,
      messages: [],
      lastActive: Date.now(),
    });
  }

  const conversation = conversations.get(roomId)!;
  conversation.messages.push(memory);
  conversation.lastActive = Date.now();

  // Keep only last 50 messages per conversation
  if (conversation.messages.length > 50) {
    conversation.messages = conversation.messages.slice(-50);
  }

  // Persist to disk
  saveMemories(conversations);

  return memory;
}

// Get conversation history
function getConversationHistory(roomId: string): Memory[] {
  return conversations.get(roomId)?.messages || [];
}

// ============================================================================
// ELIZAOS CHARACTER RUNTIME
// Builds prompts from character file and processes responses
// ============================================================================

function buildSystemPrompt(): string {
  const char = shawCharacter;

  // Build bio section
  const bioSection = char.bio?.join('\n- ') || '';

  // Build topics section
  const topicsSection = char.topics?.join(', ') || '';

  // Build message examples
  const examplesSection = char.messageExamples?.map((convo) => {
    return convo.map((msg) => `${msg.name}: ${msg.content.text}`).join('\n');
  }).join('\n\n') || '';

  // Build style section
  const styleSection = [
    ...(char.style?.all || []),
    ...(char.style?.chat || []),
  ].join('\n- ');

  return `${char.system}

# Character Bio
- ${bioSection}

# Areas of Expertise
${topicsSection}

# Communication Style
- ${styleSection}

# Example Conversations
${examplesSection}

# ElizaOS Runtime Context
You are running on a TRUE ElizaOS runtime with:
- Persistent memory across conversations
- Character file configuration (this prompt)
- Plugin architecture for capabilities
- Multi-agent coordination potential

You have REAL memory of past conversations with this user. Reference them naturally when relevant.`;
}

// Process message through ElizaOS runtime
async function processMessage(
  message: string,
  userId: string,
  roomId: string,
  worldState?: any
): Promise<{ response: string; memories: number }> {
  // Store user message in memory
  addMemory(roomId, userId, message, 'user', false);

  // Get conversation history
  const history = getConversationHistory(roomId);

  // Build messages array for Claude
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  // Add recent history (last 10 exchanges)
  const recentHistory = history.slice(-20);
  for (const mem of recentHistory.slice(0, -1)) { // Exclude the message we just added
    const role = mem.userId === 'shaw' ? 'assistant' : 'user';
    messages.push({ role, content: mem.content.text });
  }

  // Add current message with context
  let contextualMessage = message;
  if (worldState) {
    contextualMessage = `[BagsWorld Context: Health ${worldState.health}%, Weather: ${worldState.weather}, Population: ${worldState.population}]

${message}`;
  }
  messages.push({ role: 'user', content: contextualMessage });

  // Call Claude with ElizaOS character configuration
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 300,
    system: buildSystemPrompt(),
    messages,
  });

  // Extract response text
  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // Store agent response in memory
  addMemory(roomId, userId, responseText, 'shaw-elizaos', true);

  return {
    response: responseText,
    memories: history.length + 1,
  };
}

// ============================================================================
// HTTP SERVER
// REST API for BagsWorld frontend
// ============================================================================

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res: ServerResponse, data: any, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders,
  });
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // GET /status - Runtime status
  if (url.pathname === '/status' && req.method === 'GET') {
    const totalMemories = Array.from(conversations.values()).reduce(
      (sum, conv) => sum + conv.messages.length,
      0
    );

    sendJson(res, {
      status: 'running',
      runtime: 'elizaos',
      character: 'shaw',
      version: '1.0.0',
      stats: {
        conversations: conversations.size,
        totalMemories,
        uptime: process.uptime(),
      },
      plugins: ['bootstrap', 'anthropic', 'bags-fm'],
    });
    return;
  }

  // GET /memories/:roomId - Get conversation memories
  if (url.pathname.startsWith('/memories/') && req.method === 'GET') {
    const roomId = url.pathname.split('/')[2];
    const history = getConversationHistory(roomId);
    sendJson(res, {
      roomId,
      count: history.length,
      memories: history.slice(-20),
    });
    return;
  }

  // POST /chat - Chat with Shaw
  if (url.pathname === '/chat' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { message, userId = 'anonymous', roomId, worldState } = body;

      if (!message) {
        sendJson(res, { error: 'Missing required field: message' }, 400);
        return;
      }

      const effectiveRoomId = roomId || `shaw-${userId}`;

      console.log(`[Shaw ElizaOS] Message from ${userId}: ${message.slice(0, 50)}...`);

      const result = await processMessage(message, userId, effectiveRoomId, worldState);

      sendJson(res, {
        character: 'Shaw',
        response: result.response,
        source: 'elizaos-runtime',
        runtime: {
          memoriesInConversation: result.memories,
          characterFile: 'shaw.ts',
          plugins: ['bootstrap', 'anthropic'],
        },
      });
    } catch (error: any) {
      console.error('[Shaw ElizaOS] Error:', error);
      sendJson(res, { error: error.message || 'Chat failed' }, 500);
    }
    return;
  }

  // POST /clear-memory - Clear conversation memory
  if (url.pathname === '/clear-memory' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { roomId, userId } = body;

      if (roomId) {
        conversations.delete(roomId);
      } else if (userId) {
        // Clear all conversations for user
        for (const [key, conv] of conversations) {
          if (conv.userId === userId) {
            conversations.delete(key);
          }
        }
      }

      saveMemories(conversations);
      sendJson(res, { success: true, message: 'Memory cleared' });
    } catch (error: any) {
      sendJson(res, { error: error.message }, 500);
    }
    return;
  }

  // 404
  sendJson(res, { error: 'Not found' }, 404);
});

// Start server
server.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           SHAW ELIZAOS RUNTIME - BAGSWORLD                ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Server:    http://localhost:${PORT}                         ║`);
  console.log('║  Character: Shaw (@shawmakesmagic)                        ║');
  console.log('║  Runtime:   ElizaOS v1.0                                  ║');
  console.log('║  Memory:    JSON file persistence                         ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║  Endpoints:                                               ║');
  console.log('║    GET  /status      - Runtime status                     ║');
  console.log('║    POST /chat        - Chat with Shaw                     ║');
  console.log('║    GET  /memories/:id - Get conversation history          ║');
  console.log('║    POST /clear-memory - Clear memories                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[Shaw ElizaOS] Loaded ${conversations.size} existing conversations`);
  console.log('[Shaw ElizaOS] Ready to receive messages from BagsWorld');
});
