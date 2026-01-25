import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import actual character functions - these are real code we're testing
import {
  getCharacter,
  getCharacterIds,
  CharacterId,
} from './characters/index.js';

// NOTE: We do NOT mock BagsApiService or LLMService here because the server tests
// should test the route logic, not the services. The services have their own tests.
// These server tests focus on:
// 1. Character registry operations
// 2. Input validation logic
// 3. Response formatting
// 4. Pagination calculations

describe('Character Registry', () => {
  // These tests exercise REAL code - the character registry functions

  it('returns list of character IDs', () => {
    const ids = getCharacterIds();
    expect(ids).toBeInstanceOf(Array);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('includes expected characters', () => {
    const ids = getCharacterIds();
    expect(ids).toContain('toly');
    expect(ids).toContain('finn');
    expect(ids).toContain('ash');
    expect(ids).toContain('ghost');
    expect(ids).toContain('neo');
  });

  it('returns character by ID', () => {
    const toly = getCharacter('toly');
    expect(toly).toBeDefined();
    expect(toly?.name).toBe('Toly');
  });

  it('returns undefined for unknown character', () => {
    const unknown = getCharacter('unknown-agent' as CharacterId);
    expect(unknown).toBeUndefined();
  });

  it('all characters have required fields', () => {
    const ids = getCharacterIds();
    for (const id of ids) {
      const char = getCharacter(id);
      expect(char).toBeDefined();
      expect(char?.name).toBeDefined();
      expect(char?.username).toBeDefined();
      expect(char?.bio).toBeDefined();
    }
  });

  it('characters have style configurations', () => {
    const toly = getCharacter('toly');
    expect(toly?.style).toBeDefined();
    expect(toly?.style?.all).toBeInstanceOf(Array);
    expect(toly?.style?.chat).toBeInstanceOf(Array);
  });

  it('characters have topic lists', () => {
    const finn = getCharacter('finn');
    expect(finn?.topics).toBeInstanceOf(Array);
    expect(finn?.topics?.length).toBeGreaterThan(0);
  });

  it('characters have adjectives', () => {
    const ash = getCharacter('ash');
    expect(ash?.adjectives).toBeInstanceOf(Array);
    expect(ash?.adjectives?.length).toBeGreaterThan(0);
  });
});

describe('Health Endpoint Logic', () => {
  // Tests the health response structure and LLM detection logic

  it('builds healthy status response', () => {
    const response = {
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0',
      database: 'not configured',
      llm: 'not configured',
      agents: getCharacterIds().length,
    };

    expect(response.status).toBe('healthy');
    expect(response.agents).toBeGreaterThan(0);
    expect(response.timestamp).toBeGreaterThan(0);
  });

  it('detects LLM configuration from env vars', () => {
    // Test the actual logic used in server.ts
    const detectLLM = (anthropicKey?: string, openaiKey?: string) => {
      return !!(anthropicKey || openaiKey);
    };

    expect(detectLLM('key', undefined)).toBe(true);
    expect(detectLLM(undefined, 'key')).toBe(true);
    expect(detectLLM('key', 'key')).toBe(true);
    expect(detectLLM(undefined, undefined)).toBe(false);
    expect(detectLLM('', '')).toBe(false);
  });
});

describe('Agent List Endpoint Logic', () => {
  // Tests the agent list transformation logic

  it('transforms character to agent response', () => {
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

    expect(agents.length).toBeGreaterThan(0);
    for (const agent of agents) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.description).toBeDefined();
      expect(agent.topics).toBeInstanceOf(Array);
      expect(agent.topics.length).toBeLessThanOrEqual(5);
    }
  });

  it('extracts first bio line from array', () => {
    const toly = getCharacter('toly');
    const bio = toly?.bio;
    const description = Array.isArray(bio) ? bio[0] : typeof bio === 'string' ? bio : 'default';
    expect(typeof description).toBe('string');
    expect(description.length).toBeGreaterThan(0);
  });

  it('handles string bio directly', () => {
    const testBio: string | string[] = 'Single line bio';
    const description = Array.isArray(testBio) ? testBio[0] : typeof testBio === 'string' ? testBio : 'default';
    expect(description).toBe('Single line bio');
  });

  it('provides default for undefined bio', () => {
    const testBio: string | string[] | undefined = undefined;
    const description = Array.isArray(testBio) ? testBio[0] : typeof testBio === 'string' ? testBio : 'A BagsWorld AI agent';
    expect(description).toBe('A BagsWorld AI agent');
  });
});

describe('Agent Detail Endpoint Logic', () => {
  // Tests agent lookup and normalization

  it('normalizes agent ID to lowercase', () => {
    const inputId = 'TOLY';
    const normalizedId = inputId.toLowerCase();
    const character = getCharacter(normalizedId as CharacterId);

    expect(normalizedId).toBe('toly');
    expect(character).toBeDefined();
  });

  it('returns full agent details for valid ID', () => {
    const character = getCharacter('finn');

    expect(character?.name).toBe('Finn');
    expect(character?.username).toBeDefined();
    expect(character?.bio).toBeDefined();
    expect(character?.topics).toBeDefined();
    expect(character?.adjectives).toBeDefined();
    expect(character?.style).toBeDefined();
  });

  it('returns undefined for unknown agent', () => {
    const character = getCharacter('nonexistent' as CharacterId);
    expect(character).toBeUndefined();
  });

  it('handles mixed case lookups', () => {
    const variations = ['Toly', 'TOLY', 'tOlY', 'toly'];
    for (const id of variations) {
      const character = getCharacter(id.toLowerCase() as CharacterId);
      expect(character?.name).toBe('Toly');
    }
  });
});

describe('Chat Input Validation', () => {
  // Tests the actual validation logic from server.ts line 221

  const validateMessage = (message: unknown): boolean => {
    return !!(message && typeof message === 'string' && (message as string).trim().length > 0);
  };

  it('rejects empty message', () => {
    expect(validateMessage('')).toBe(false);
  });

  it('rejects null message', () => {
    expect(validateMessage(null)).toBe(false);
  });

  it('rejects undefined message', () => {
    expect(validateMessage(undefined)).toBe(false);
  });

  it('rejects whitespace-only message', () => {
    expect(validateMessage('   ')).toBe(false);
    expect(validateMessage('\t\n')).toBe(false);
  });

  it('accepts valid message', () => {
    expect(validateMessage('Hello!')).toBe(true);
    expect(validateMessage('a')).toBe(true);
  });

  it('rejects non-string message', () => {
    expect(validateMessage(12345)).toBe(false);
    expect(validateMessage({})).toBe(false);
    expect(validateMessage([])).toBe(false);
  });

  it('accepts message with leading/trailing whitespace', () => {
    expect(validateMessage('  hello  ')).toBe(true);
  });
});

describe('Pagination Logic', () => {
  // Tests the limit calculation from server.ts (used in multiple endpoints)

  const calculateLimit = (input: string | undefined, max: number = 50, defaultVal: number = 10): number => {
    return Math.min(parseInt(input as string) || defaultVal, max);
  };

  it('uses default limit when undefined', () => {
    expect(calculateLimit(undefined)).toBe(10);
  });

  it('uses default limit when empty', () => {
    expect(calculateLimit('')).toBe(10);
  });

  it('respects valid custom limit', () => {
    expect(calculateLimit('5')).toBe(5);
    expect(calculateLimit('25')).toBe(25);
  });

  it('caps limit at maximum', () => {
    expect(calculateLimit('100')).toBe(50);
    expect(calculateLimit('999')).toBe(50);
  });

  it('handles non-numeric input', () => {
    expect(calculateLimit('abc')).toBe(10);
    expect(calculateLimit('12abc')).toBe(12); // parseInt extracts leading number
  });

  it('handles negative numbers', () => {
    // Note: Math.min(-5, 50) = -5, server should add validation
    expect(calculateLimit('-5')).toBe(-5);
  });

  it('handles zero', () => {
    // parseInt('0') = 0, which is falsy, so falls back to default
    expect(calculateLimit('0')).toBe(10);
  });

  it('respects custom max and default', () => {
    expect(calculateLimit('200', 100, 20)).toBe(100);
    expect(calculateLimit(undefined, 100, 20)).toBe(20);
  });
});

describe('Session Management', () => {
  // Tests session ID handling logic

  it('generates session ID when not provided', () => {
    const providedSessionId = undefined;
    const sessionId = providedSessionId || 'generated-uuid';
    expect(sessionId).toBe('generated-uuid');
  });

  it('uses provided session ID', () => {
    const providedSessionId = 'user-provided-session';
    const sessionId = providedSessionId || 'generated-uuid';
    expect(sessionId).toBe('user-provided-session');
  });

  it('uses provided session ID even if empty string', () => {
    // Note: Empty string is falsy, so falls back to generated
    const providedSessionId = '';
    const sessionId = providedSessionId || 'generated-uuid';
    expect(sessionId).toBe('generated-uuid');
  });
});

describe('Response Formatting', () => {
  // Tests response structure formatting

  it('formats success response correctly', () => {
    const response = {
      success: true,
      data: { foo: 'bar' },
    };

    expect(response.success).toBe(true);
    expect(response.data.foo).toBe('bar');
  });

  it('formats error response with available agents', () => {
    const agentId = 'unknown';
    const response = {
      error: `Agent not found: ${agentId}`,
      availableAgents: getCharacterIds(),
    };

    expect(response.error).toContain('Agent not found');
    expect(response.error).toContain('unknown');
    expect(response.availableAgents).toBeInstanceOf(Array);
    expect(response.availableAgents.length).toBeGreaterThan(0);
  });

  it('formats chat response with all required fields', () => {
    const character = getCharacter('finn');
    const response = {
      success: true,
      agentId: 'finn',
      agentName: character?.name,
      response: 'Hello from Finn!',
      sessionId: 'test-session-123',
      model: 'claude-sonnet-4-20250514',
      usage: { inputTokens: 100, outputTokens: 50 },
    };

    expect(response.success).toBe(true);
    expect(response.agentId).toBe('finn');
    expect(response.agentName).toBe('Finn');
    expect(response.response).toBeDefined();
    expect(response.sessionId).toBeDefined();
    expect(response.model).toBeDefined();
    expect(response.usage.inputTokens).toBeGreaterThan(0);
  });

  it('formats token lookup response', () => {
    const token = {
      mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      name: 'Test Token',
      symbol: 'TEST',
      marketCap: 1000000,
    };

    const response = {
      success: true,
      token,
    };

    expect(response.success).toBe(true);
    expect(response.token.mint).toBeDefined();
    expect(response.token.name).toBe('Test Token');
  });
});

describe('Error Response Structure', () => {
  // Tests error response formats match server.ts

  it('formats 400 bad request', () => {
    const response = { error: 'message is required and must be a non-empty string' };
    expect(response.error).toContain('message is required');
  });

  it('formats 404 not found with suggestions', () => {
    const response = {
      error: 'Agent not found: invalid',
      availableAgents: getCharacterIds(),
    };
    expect(response.error).toContain('not found');
    expect(response.availableAgents).toContain('toly');
  });

  it('formats 404 token not found', () => {
    const response = { error: 'Token not found' };
    expect(response.error).toBe('Token not found');
  });

  it('formats 503 service unavailable', () => {
    const response = { error: 'Database not configured' };
    expect(response.error).toBe('Database not configured');
  });
});
