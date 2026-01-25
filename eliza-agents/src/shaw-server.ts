// Shaw ElizaOS Server
// Uses ElizaOS character file format with Claude API

import Anthropic from '@anthropic-ai/sdk';
import { shawCharacter } from './characters/shaw';

const PORT = parseInt(process.env.SERVER_PORT || '3001');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Build ElizaOS-style system prompt from character file
function buildSystemPrompt(): string {
  const char = shawCharacter;

  // Combine bio
  const bio = Array.isArray(char.bio) ? char.bio.join('\n') : char.bio || '';

  // Style instructions
  const styleAll = char.style?.all?.join('\n') || '';
  const styleChat = char.style?.chat?.join('\n') || '';

  // Topics
  const topics = char.topics?.join(', ') || '';

  // Message examples for few-shot learning
  const examples = char.messageExamples?.map(convo =>
    convo.map(msg => `${msg.name}: ${msg.content?.text || msg.content}`).join('\n')
  ).join('\n\n') || '';

  return `${char.system || ''}

CHARACTER BIO:
${bio}

STYLE GUIDELINES:
${styleAll}
${styleChat}

TOPICS OF EXPERTISE:
${topics}

EXAMPLE CONVERSATIONS:
${examples}

Remember: You are Shaw. Stay in character. Keep responses SHORT (1-3 sentences).`;
}

console.log('[Shaw ElizaOS] Starting Shaw agent server...');
console.log('[Shaw ElizaOS] Character loaded:', shawCharacter.name);
console.log('[Shaw ElizaOS] Anthropic API:', anthropic ? 'Connected' : 'Not configured');

// Start HTTP server
const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // GET /status
    if (url.pathname === '/status' && request.method === 'GET') {
      return jsonResponse({
        status: 'running',
        agent: 'shaw',
        provider: 'elizaos',
        character: {
          name: shawCharacter.name,
          username: shawCharacter.username,
          topics: shawCharacter.topics,
        },
      });
    }

    // POST /chat - Chat with Shaw
    if (url.pathname === '/chat' && request.method === 'POST') {
      if (!anthropic) {
        return jsonResponse({
          character: 'Shaw',
          response: 'elizaos needs an anthropic api key. character files are ready, just need the model provider',
          source: 'elizaos-fallback',
        });
      }

      try {
        const body = await request.json();
        const { message } = body;

        if (!message) {
          return jsonResponse({ error: 'Missing message' }, 400);
        }

        // Call Claude with ElizaOS character prompt
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 300,
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: message }],
        });

        const responseText = response.content[0].type === 'text'
          ? response.content[0].text
          : 'No response generated';

        return jsonResponse({
          character: 'Shaw',
          response: responseText,
          source: 'elizaos',
        });
      } catch (error: any) {
        console.error('[Shaw ElizaOS] Chat error:', error);
        return jsonResponse({
          character: 'Shaw',
          response: 'elizaos runtime hiccup. the character file is solid though - try again',
          source: 'elizaos-fallback',
        });
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
});

console.log(`[Shaw ElizaOS] Server running on http://localhost:${PORT}`);
console.log('[Shaw ElizaOS] Endpoints:');
console.log('  GET  /status - Server status');
console.log('  POST /chat   - Chat with Shaw');
