// Tests for route handlers
// Tests actual HTTP request/response behavior with the REAL routes

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { getCharacterIds } from '../characters/index.js';

// Import actual routes
import chatRoutes from './chat.js';

// Mock only external services, not the route logic
vi.mock('../services/LLMService.js', () => ({
  getLLMService: () => ({
    generateResponse: vi.fn().mockResolvedValue({
      text: 'Mocked LLM response',
      model: 'mock-model',
      usage: { inputTokens: 10, outputTokens: 20 },
    }),
  }),
}));

// Mock database operations (but keep route logic intact)
vi.mock('./shared.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getDatabase: () => null, // No database in tests
    getConversationHistory: vi.fn().mockResolvedValue([]),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    pruneOldMessages: vi.fn().mockResolvedValue(undefined),
    buildConversationContext: vi.fn().mockResolvedValue({ messages: [] }),
  };
});

// Create test app with ACTUAL routes
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', chatRoutes);
  return app;
}

describe('GET /api/agents (real routes)', () => {
  const app = createTestApp();

  it('returns list of agents', async () => {
    const res = await request(app).get('/api/agents');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agents).toBeInstanceOf(Array);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('includes expected agent structure', async () => {
    const res = await request(app).get('/api/agents');

    const agents = res.body.agents;
    for (const agent of agents) {
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('topics');
      expect(agent.topics.length).toBeLessThanOrEqual(5);
    }
  });

  it('includes finn in agent list', async () => {
    const res = await request(app).get('/api/agents');

    const finn = res.body.agents.find((a: { id: string }) => a.id === 'finn');
    expect(finn).toBeDefined();
    expect(finn.name).toBe('Finn');
  });

  it('includes all 16 expected agents', async () => {
    const res = await request(app).get('/api/agents');

    expect(res.body.count).toBe(16);
    const ids = res.body.agents.map((a: { id: string }) => a.id);
    expect(ids).toContain('finn');
    expect(ids).toContain('toly');
    expect(ids).toContain('ash');
    expect(ids).toContain('ghost');
    expect(ids).toContain('neo');
  });
});

describe('GET /api/agents/:agentId (real routes)', () => {
  const app = createTestApp();

  it('returns agent by ID', async () => {
    const res = await request(app).get('/api/agents/finn');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agent.name).toBe('Finn');
  });

  it('normalizes agent ID to lowercase', async () => {
    const res = await request(app).get('/api/agents/FINN');

    expect(res.status).toBe(200);
    expect(res.body.agent.id).toBe('finn');
  });

  it('handles mixed case agent ID', async () => {
    const res = await request(app).get('/api/agents/FiNn');

    expect(res.status).toBe(200);
    expect(res.body.agent.id).toBe('finn');
  });

  it('returns 404 for unknown agent', async () => {
    const res = await request(app).get('/api/agents/unknown');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Agent not found');
    expect(res.body.availableAgents).toBeInstanceOf(Array);
  });

  it('includes available agents in 404 response', async () => {
    const res = await request(app).get('/api/agents/nonexistent');

    expect(res.body.availableAgents).toContain('finn');
    expect(res.body.availableAgents).toContain('toly');
  });

  it('returns full agent details', async () => {
    const res = await request(app).get('/api/agents/toly');

    expect(res.body.agent).toHaveProperty('id');
    expect(res.body.agent).toHaveProperty('name');
    expect(res.body.agent).toHaveProperty('username');
    expect(res.body.agent).toHaveProperty('bio');
    expect(res.body.agent).toHaveProperty('topics');
    expect(res.body.agent).toHaveProperty('adjectives');
    expect(res.body.agent).toHaveProperty('style');
  });

  it('handles special characters in agent ID', async () => {
    const res = await request(app).get('/api/agents/test%20agent');

    expect(res.status).toBe(404);
  });

  it('handles empty agent ID', async () => {
    const res = await request(app).get('/api/agents/');

    // Express treats /api/agents/ same as /api/agents, returning the list
    expect(res.status).toBe(200);
    expect(res.body.agents).toBeInstanceOf(Array);
  });
});

describe('POST /api/agents/:agentId/chat (real routes)', () => {
  const app = createTestApp();

  it('accepts valid chat request', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: 'Hello!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agentId).toBe('finn');
    expect(res.body.agentName).toBe('Finn');
  });

  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('message is required');
  });

  it('rejects whitespace-only message', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('message is required');
  });

  it('rejects null message', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: null });

    expect(res.status).toBe(400);
  });

  it('rejects undefined message', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects numeric message', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: 12345 });

    expect(res.status).toBe(400);
  });

  it('rejects array message', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: ['hello'] });

    expect(res.status).toBe(400);
  });

  it('rejects object message', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: { text: 'hello' } });

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown agent', async () => {
    const res = await request(app)
      .post('/api/agents/unknown/chat')
      .send({ message: 'Hello!' });

    expect(res.status).toBe(404);
    expect(res.body.availableAgents).toBeInstanceOf(Array);
  });

  it('normalizes agent ID to lowercase', async () => {
    const res = await request(app)
      .post('/api/agents/FINN/chat')
      .send({ message: 'Hello!' });

    expect(res.status).toBe(200);
    expect(res.body.agentId).toBe('finn');
  });

  it('accepts custom sessionId', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: 'Hello!', sessionId: 'custom-session-123' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('custom-session-123');
  });

  it('generates sessionId if not provided', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: 'Hello!' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
  });

  it('handles very long message', async () => {
    const longMessage = 'x'.repeat(10000);
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: longMessage });

    expect(res.status).toBe(200);
  });

  it('handles unicode message', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: 'こんにちは 🚀 مرحبا' });

    expect(res.status).toBe(200);
  });

  it('handles message with special characters', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: '<script>alert(1)</script>' });

    expect(res.status).toBe(200);
  });

  it('handles message with newlines', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: 'Hello\nWorld\nTest' });

    expect(res.status).toBe(200);
  });

  it('handles message with JSON-like content', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: '{"key": "value"}' });

    expect(res.status).toBe(200);
  });

  it('handles all agents', async () => {
    const agentIds = getCharacterIds();
    for (const id of agentIds) {
      const res = await request(app)
        .post(`/api/agents/${id}/chat`)
        .send({ message: 'Hello!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });
});

describe('Input sanitization edge cases (real routes)', () => {
  const app = createTestApp();

  it('handles null body', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .set('Content-Type', 'application/json')
      .send('null');

    // Express parses null as falsy
    expect(res.status).toBe(400);
  });

  it('handles boolean body', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .set('Content-Type', 'application/json')
      .send('true');

    expect(res.status).toBe(400);
  });

  it('handles array body', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .set('Content-Type', 'application/json')
      .send('[{"message": "hello"}]');

    expect(res.status).toBe(400);
  });

  it('handles empty object body', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({});

    expect(res.status).toBe(400);
  });

  it('handles deeply nested object', async () => {
    const nested = {
      message: 'hello',
      nested: { deeply: { nested: { value: 'test' } } },
    };
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send(nested);

    expect(res.status).toBe(200);
  });

  it('handles extra fields in body', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: 'Hello!', extra: 'ignored', another: 123 });

    expect(res.status).toBe(200);
  });
});

describe('Response structure (real routes)', () => {
  const app = createTestApp();

  it('agent list has correct structure', async () => {
    const res = await request(app).get('/api/agents');

    expect(res.body).toEqual({
      success: true,
      agents: expect.any(Array),
      count: expect.any(Number),
    });
  });

  it('agent detail has correct structure', async () => {
    const res = await request(app).get('/api/agents/finn');

    expect(res.body).toEqual({
      success: true,
      agent: {
        id: 'finn',
        name: expect.any(String),
        username: expect.any(String),
        bio: expect.anything(),
        topics: expect.any(Array),
        adjectives: expect.any(Array),
        style: expect.any(Object),
      },
    });
  });

  it('chat response has correct structure', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({ message: 'Hello!' });

    expect(res.body).toEqual({
      success: true,
      agentId: 'finn',
      agentName: 'Finn',
      response: expect.any(String),
      sessionId: expect.any(String),
      model: expect.any(String),
      usage: expect.any(Object),
    });
  });

  it('404 response has correct structure', async () => {
    const res = await request(app).get('/api/agents/unknown');

    expect(res.body).toEqual({
      error: expect.stringContaining('Agent not found'),
      availableAgents: expect.any(Array),
    });
  });

  it('400 response has correct structure', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .send({});

    expect(res.body).toEqual({
      error: expect.any(String),
    });
  });
});

describe('Content-Type handling (real routes)', () => {
  const app = createTestApp();

  it('accepts application/json', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .set('Content-Type', 'application/json')
      .send({ message: 'Hello!' });

    expect(res.status).toBe(200);
  });

  it('accepts application/json with charset', async () => {
    const res = await request(app)
      .post('/api/agents/finn/chat')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send({ message: 'Hello!' });

    expect(res.status).toBe(200);
  });

  it('returns application/json', async () => {
    const res = await request(app).get('/api/agents');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('URL encoding (real routes)', () => {
  const app = createTestApp();

  it('handles URL-encoded agent ID', async () => {
    // %20 is space
    const res = await request(app).get('/api/agents/finn%20test');

    expect(res.status).toBe(404); // No such agent
  });

  it('handles percent signs in query params', async () => {
    const res = await request(app).get('/api/agents?filter=%25test');

    expect(res.status).toBe(200);
  });
});
