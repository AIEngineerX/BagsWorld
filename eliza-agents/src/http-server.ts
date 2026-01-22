// BagsWorld ElizaOS HTTP Server
// Standalone server for ElizaOS agents with REST API

import { initializeAgents, chatWithAgent, getAgentStatus } from './server';

const PORT = parseInt(process.env.SERVER_PORT || '3001');

// CORS headers for BagsWorld frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Simple JSON response helper
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Initialize all agents on startup
console.log('[ElizaOS Server] Starting BagsWorld Agent Server...');
await initializeAgents();

// Start HTTP server using Bun
const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // GET /status - Agent status
    if (url.pathname === '/status' && request.method === 'GET') {
      return jsonResponse({
        status: 'running',
        provider: 'elizaos',
        agents: getAgentStatus(),
      });
    }

    // GET /agents - List available agents
    if (url.pathname === '/agents' && request.method === 'GET') {
      return jsonResponse({
        agents: Object.entries(getAgentStatus()).map(([id, info]) => ({
          id,
          ...info,
        })),
      });
    }

    // POST /chat - Chat with an agent
    if (url.pathname === '/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { character, message, userId, roomId, worldState } = body;

        if (!character || !message) {
          return jsonResponse(
            { error: 'Missing required fields: character and message' },
            400
          );
        }

        const response = await chatWithAgent({
          character,
          message,
          userId,
          roomId,
        });

        return jsonResponse({
          ...response,
          source: 'elizaos',
        });
      } catch (error: any) {
        console.error('[ElizaOS Server] Chat error:', error);
        return jsonResponse(
          { error: error.message || 'Chat failed' },
          500
        );
      }
    }

    // 404 for unknown routes
    return jsonResponse({ error: 'Not found' }, 404);
  },
});

console.log(`[ElizaOS Server] BagsWorld Agent Server running on http://localhost:${PORT}`);
console.log('[ElizaOS Server] Endpoints:');
console.log('  GET  /status - Server status and agent list');
console.log('  GET  /agents - List all agents');
console.log('  POST /chat   - Chat with an agent');
