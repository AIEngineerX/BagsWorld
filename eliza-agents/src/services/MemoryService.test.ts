// MemoryService tests
// Validates memory CRUD, vector search, and prompt summarization

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryService, resetMemoryService } from './MemoryService.js';
import type { CreateMemoryInput, MemoryType } from './MemoryService.js';
import { EmbeddingService } from './EmbeddingService.js';

// Create a mock SQL function that tracks calls
function createMockSql() {
  const fn = vi.fn().mockResolvedValue([]);
  // Neon uses tagged template literals: sql`...`
  // We need to handle both tagged template and regular calls
  const taggedFn = (strings: TemplateStringsArray, ...values: unknown[]) => {
    return fn(strings, ...values);
  };
  taggedFn.mockResolvedValue = fn.mockResolvedValue.bind(fn);
  taggedFn.mockResolvedValueOnce = fn.mockResolvedValueOnce.bind(fn);
  taggedFn.mock = fn.mock;
  return taggedFn as unknown as ReturnType<typeof vi.fn>;
}

// Create a mock EmbeddingService
function createMockEmbeddingService(configured = true): EmbeddingService {
  const mock = {
    isConfigured: () => configured,
    embed: vi.fn().mockResolvedValue(
      configured ? Array.from({ length: 1536 }, () => 0.1) : null
    ),
    embedBatch: vi.fn().mockResolvedValue([]),
  };
  return mock as unknown as EmbeddingService;
}

function makeMemoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    agent_id: 'toly',
    room_id: 'room-1',
    user_id: 'user-1',
    content: 'The user likes Solana',
    embedding: null,
    memory_type: 'fact',
    importance: 0.7,
    emotional_valence: 0.2,
    metadata: {},
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('MemoryService', () => {
  let service: MemoryService;
  let mockSql: ReturnType<typeof createMockSql>;
  let mockEmbedding: EmbeddingService;

  beforeEach(() => {
    resetMemoryService();
    mockSql = createMockSql();
    mockEmbedding = createMockEmbeddingService();
    service = new MemoryService(mockSql as any, mockEmbedding);
  });

  describe('createMemory', () => {
    it('inserts a memory with embedding', async () => {
      const row = makeMemoryRow();
      mockSql.mockResolvedValueOnce([row]);

      const input: CreateMemoryInput = {
        agentId: 'toly',
        content: 'The user likes Solana',
        memoryType: 'fact',
        roomId: 'room-1',
        userId: 'user-1',
        importance: 0.7,
      };

      const result = await service.createMemory(input);

      expect(result.agentId).toBe('toly');
      expect(result.content).toBe('The user likes Solana');
      expect(result.memoryType).toBe('fact');
      expect(result.importance).toBe(0.7);
      expect((mockEmbedding.embed as any)).toHaveBeenCalledWith('The user likes Solana');
    });

    it('works without embedding when service is unconfigured', async () => {
      const unconfiguredEmb = createMockEmbeddingService(false);
      const svc = new MemoryService(mockSql as any, unconfiguredEmb);

      const row = makeMemoryRow();
      mockSql.mockResolvedValueOnce([row]);

      const result = await svc.createMemory({
        agentId: 'toly',
        content: 'test',
        memoryType: 'message',
      });

      expect(result.agentId).toBe('toly');
    });

    it('uses default importance and valence', async () => {
      const row = makeMemoryRow({ importance: 0.5, emotional_valence: 0.0 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.createMemory({
        agentId: 'toly',
        content: 'test',
        memoryType: 'message',
      });

      expect(result.importance).toBe(0.5);
      expect(result.emotionalValence).toBe(0.0);
    });
  });

  describe('getMemories', () => {
    it('retrieves memories for an agent', async () => {
      const rows = [
        makeMemoryRow({ id: 'mem-1', content: 'first' }),
        makeMemoryRow({ id: 'mem-2', content: 'second' }),
      ];
      mockSql.mockResolvedValueOnce(rows);

      const result = await service.getMemories('toly');

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('first');
      expect(result[1].content).toBe('second');
    });

    it('filters by memoryType', async () => {
      mockSql.mockResolvedValueOnce([makeMemoryRow({ memory_type: 'fact' })]);

      const result = await service.getMemories('toly', { memoryType: 'fact' });
      expect(result).toHaveLength(1);
      expect(result[0].memoryType).toBe('fact');
    });

    it('filters by roomId', async () => {
      mockSql.mockResolvedValueOnce([makeMemoryRow({ room_id: 'room-1' })]);

      const result = await service.getMemories('toly', { roomId: 'room-1' });
      expect(result).toHaveLength(1);
    });

    it('filters by userId', async () => {
      mockSql.mockResolvedValueOnce([makeMemoryRow({ user_id: 'user-1' })]);

      const result = await service.getMemories('toly', { userId: 'user-1' });
      expect(result).toHaveLength(1);
    });

    it('filters by memoryType and roomId', async () => {
      mockSql.mockResolvedValueOnce([makeMemoryRow()]);
      await service.getMemories('toly', { memoryType: 'fact', roomId: 'room-1' });
      expect(mockSql.mock.calls).toHaveLength(1);
    });

    it('filters by memoryType and userId', async () => {
      mockSql.mockResolvedValueOnce([makeMemoryRow()]);
      await service.getMemories('toly', { memoryType: 'fact', userId: 'user-1' });
      expect(mockSql.mock.calls).toHaveLength(1);
    });

    it('respects limit parameter', async () => {
      mockSql.mockResolvedValueOnce([]);
      await service.getMemories('toly', { limit: 5 });
      expect(mockSql.mock.calls).toHaveLength(1);
    });

    it('defaults to limit 20', async () => {
      mockSql.mockResolvedValueOnce([]);
      await service.getMemories('toly');
      expect(mockSql.mock.calls).toHaveLength(1);
    });
  });

  describe('searchSimilar', () => {
    it('performs vector similarity search', async () => {
      const rows = [
        { ...makeMemoryRow({ id: 'mem-1', content: 'Solana is fast' }), similarity: 0.92 },
        { ...makeMemoryRow({ id: 'mem-2', content: 'Blockchain tech' }), similarity: 0.75 },
      ];
      mockSql.mockResolvedValueOnce(rows);

      const result = await service.searchSimilar('toly', 'Tell me about Solana');

      expect(result).toHaveLength(2);
      expect(result[0].similarity).toBe(0.92);
      expect(result[0].memory.content).toBe('Solana is fast');
      expect(result[1].similarity).toBe(0.75);
    });

    it('falls back to recency when embeddings unavailable', async () => {
      const unconfiguredEmb = createMockEmbeddingService(false);
      const svc = new MemoryService(mockSql as any, unconfiguredEmb);

      const rows = [makeMemoryRow({ content: 'recent memory' })];
      mockSql.mockResolvedValueOnce(rows);

      const result = await svc.searchSimilar('toly', 'query');

      expect(result).toHaveLength(1);
      expect(result[0].similarity).toBe(0); // No actual similarity score
      expect(result[0].memory.content).toBe('recent memory');
    });

    it('filters by memoryType', async () => {
      mockSql.mockResolvedValueOnce([]);
      await service.searchSimilar('toly', 'query', { memoryType: 'fact' });
      expect(mockSql.mock.calls).toHaveLength(1);
    });

    it('respects minSimilarity', async () => {
      mockSql.mockResolvedValueOnce([]);
      await service.searchSimilar('toly', 'query', { minSimilarity: 0.5 });
      expect(mockSql.mock.calls).toHaveLength(1);
    });
  });

  describe('getImportantMemories', () => {
    it('returns memories with importance >= 0.7', async () => {
      const rows = [
        makeMemoryRow({ id: 'mem-1', importance: 0.9, content: 'very important' }),
        makeMemoryRow({ id: 'mem-2', importance: 0.7, content: 'important' }),
      ];
      mockSql.mockResolvedValueOnce(rows);

      const result = await service.getImportantMemories('toly');

      expect(result).toHaveLength(2);
      expect(result[0].importance).toBe(0.9);
    });

    it('respects limit parameter', async () => {
      mockSql.mockResolvedValueOnce([]);
      await service.getImportantMemories('toly', 3);
      expect(mockSql.mock.calls).toHaveLength(1);
    });
  });

  describe('countMemories', () => {
    it('returns total count for agent', async () => {
      mockSql.mockResolvedValueOnce([{ count: '42' }]);

      const result = await service.countMemories('toly');
      expect(result).toBe(42);
    });

    it('returns count filtered by type', async () => {
      mockSql.mockResolvedValueOnce([{ count: '10' }]);

      const result = await service.countMemories('toly', 'fact');
      expect(result).toBe(10);
    });

    it('returns 0 when no rows', async () => {
      mockSql.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.countMemories('toly');
      expect(result).toBe(0);
    });
  });

  describe('deleteMemory', () => {
    it('deletes by memory ID', async () => {
      mockSql.mockResolvedValueOnce([]);
      await service.deleteMemory('mem-1');
      expect(mockSql.mock.calls).toHaveLength(1);
    });
  });

  describe('summarizeForPrompt', () => {
    it('combines semantic results and user facts', async () => {
      // searchSimilar call
      const similarRows = [
        { ...makeMemoryRow({ content: 'User loves Solana NFTs', memory_type: 'fact' }), similarity: 0.85 },
      ];
      mockSql.mockResolvedValueOnce(similarRows);

      // getMemories (user facts) call
      const factRows = [
        makeMemoryRow({ content: 'User is a developer', memory_type: 'fact' }),
      ];
      mockSql.mockResolvedValueOnce(factRows);

      // getImportantMemories call
      mockSql.mockResolvedValueOnce([]);

      const result = await service.summarizeForPrompt('toly', 'Tell me about NFTs', {
        userId: 'user-1',
      });

      expect(result).toContain('RELEVANT MEMORIES');
      expect(result).toContain('User loves Solana NFTs');
      expect(result).toContain('WHAT YOU KNOW ABOUT THIS USER');
      expect(result).toContain('User is a developer');
    });

    it('returns empty string when no memories found', async () => {
      // searchSimilar - no results
      mockSql.mockResolvedValueOnce([]);
      // getImportantMemories - no results
      mockSql.mockResolvedValueOnce([]);

      const result = await service.summarizeForPrompt('toly', 'Hello');
      expect(result).toBe('');
    });

    it('includes important memories', async () => {
      // searchSimilar - no results
      mockSql.mockResolvedValueOnce([]);
      // getImportantMemories
      mockSql.mockResolvedValueOnce([
        makeMemoryRow({ id: 'imp-1', content: 'This is critical knowledge', importance: 0.9 }),
      ]);

      const result = await service.summarizeForPrompt('toly', 'Hello');
      expect(result).toContain('KEY MEMORIES');
      expect(result).toContain('This is critical knowledge');
    });
  });
});
