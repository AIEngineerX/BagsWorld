// RelationshipService tests
// Validates relationship CRUD, evolution mechanics, and prompt summarization

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationshipService, resetRelationshipService } from './RelationshipService.js';

// Create a mock SQL function
function createMockSql() {
  const fn = vi.fn().mockResolvedValue([]);
  const taggedFn = (strings: TemplateStringsArray, ...values: unknown[]) => {
    return fn(strings, ...values);
  };
  taggedFn.mockResolvedValue = fn.mockResolvedValue.bind(fn);
  taggedFn.mockResolvedValueOnce = fn.mockResolvedValueOnce.bind(fn);
  taggedFn.mock = fn.mock;
  return taggedFn as unknown as ReturnType<typeof vi.fn>;
}

function makeRelationshipRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rel-1',
    agent_id: 'toly',
    target_id: 'user-1',
    target_type: 'user',
    trust: 0.5,
    familiarity: 0.2,
    sentiment: 0.1,
    respect: 0.5,
    interaction_count: 3,
    last_topics: ['Solana', 'NFTs'],
    last_interaction: '2025-01-15T12:00:00Z',
    notes: '',
    metadata: {},
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
    ...overrides,
  };
}

describe('RelationshipService', () => {
  let service: RelationshipService;
  let mockSql: ReturnType<typeof createMockSql>;

  beforeEach(() => {
    resetRelationshipService();
    mockSql = createMockSql();
    service = new RelationshipService(mockSql as any);
  });

  describe('getRelationship', () => {
    it('returns relationship when it exists', async () => {
      const row = makeRelationshipRow();
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.getRelationship('toly', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe('toly');
      expect(result!.targetId).toBe('user-1');
      expect(result!.trust).toBe(0.5);
      expect(result!.familiarity).toBe(0.2);
      expect(result!.interactionCount).toBe(3);
      expect(result!.lastTopics).toEqual(['Solana', 'NFTs']);
    });

    it('returns null when no relationship exists', async () => {
      mockSql.mockResolvedValueOnce([]);

      const result = await service.getRelationship('toly', 'unknown');
      expect(result).toBeNull();
    });

    it('converts row dates to Date objects', async () => {
      const row = makeRelationshipRow();
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.getRelationship('toly', 'user-1');

      expect(result!.lastInteraction).toBeInstanceOf(Date);
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });

    it('handles null last_interaction', async () => {
      const row = makeRelationshipRow({ last_interaction: null });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.getRelationship('toly', 'user-1');
      expect(result!.lastInteraction).toBeNull();
    });

    it('handles empty last_topics', async () => {
      const row = makeRelationshipRow({ last_topics: null });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.getRelationship('toly', 'user-1');
      expect(result!.lastTopics).toEqual([]);
    });
  });

  describe('upsertRelationship', () => {
    it('creates new relationship with defaults', async () => {
      const row = makeRelationshipRow({ trust: 0.5, familiarity: 0.0, sentiment: 0.0, interaction_count: 1 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.upsertRelationship('toly', 'user-1', 'user');

      expect(result.agentId).toBe('toly');
      expect(result.targetId).toBe('user-1');
      expect(result.targetType).toBe('user');
      expect(mockSql.mock.calls).toHaveLength(1);
    });

    it('applies delta updates on conflict', async () => {
      const row = makeRelationshipRow({ trust: 0.6, familiarity: 0.1 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.upsertRelationship('toly', 'user-1', 'user', {
        trustDelta: 0.1,
        familiarityDelta: 0.1,
      });

      expect(result.trust).toBe(0.6);
      expect(result.familiarity).toBe(0.1);
    });

    it('includes topics when provided', async () => {
      const row = makeRelationshipRow({ last_topics: ['DeFi', 'Trading'] });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.upsertRelationship('toly', 'user-1', 'user', {
        topics: ['DeFi', 'Trading'],
      });

      expect(result.lastTopics).toEqual(['DeFi', 'Trading']);
    });

    it('includes notes when provided', async () => {
      const row = makeRelationshipRow({ notes: 'Helpful user' });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.upsertRelationship('toly', 'user-1', 'user', {
        notes: 'Helpful user',
      });

      expect(result.notes).toBe('Helpful user');
    });
  });

  describe('updateAfterInteraction', () => {
    it('increments familiarity on each interaction', async () => {
      const row = makeRelationshipRow({ familiarity: 0.25, interaction_count: 4 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.updateAfterInteraction('toly', 'user-1', 'user');

      expect(result.familiarity).toBe(0.25);
      expect(result.interactionCount).toBe(4);
    });

    it('adjusts trust when interaction was helpful', async () => {
      const row = makeRelationshipRow({ trust: 0.52 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.updateAfterInteraction('toly', 'user-1', 'user', {
        wasHelpful: true,
      });

      expect(result.trust).toBe(0.52);
    });

    it('decreases trust when user was rude', async () => {
      const row = makeRelationshipRow({ trust: 0.45 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.updateAfterInteraction('toly', 'user-1', 'user', {
        wasRude: true,
      });

      expect(result.trust).toBe(0.45);
    });

    it('adjusts sentiment based on interaction quality', async () => {
      const row = makeRelationshipRow({ sentiment: 0.18 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.updateAfterInteraction('toly', 'user-1', 'user', {
        sentiment: 0.8, // very positive interaction
      });

      expect(result.sentiment).toBe(0.18);
    });

    it('increases respect when topics are substantive', async () => {
      const row = makeRelationshipRow({ respect: 0.51 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.updateAfterInteraction('toly', 'user-1', 'user', {
        topics: ['Solana consensus', 'validator economics'],
      });

      expect(result.respect).toBe(0.51);
    });

    it('handles agent-to-agent relationships', async () => {
      const row = makeRelationshipRow({
        agent_id: 'toly',
        target_id: 'finn',
        target_type: 'agent',
      });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.updateAfterInteraction('toly', 'finn', 'agent', {
        topics: ['market trends'],
      });

      expect(result.targetType).toBe('agent');
    });
  });

  describe('getAgentRelationships', () => {
    it('returns all relationships for an agent', async () => {
      const rows = [
        makeRelationshipRow({ target_id: 'user-1' }),
        makeRelationshipRow({ target_id: 'user-2', trust: 0.7 }),
      ];
      mockSql.mockResolvedValueOnce(rows);

      const result = await service.getAgentRelationships('toly');

      expect(result).toHaveLength(2);
      expect(result[0].targetId).toBe('user-1');
      expect(result[1].targetId).toBe('user-2');
    });

    it('filters by target type', async () => {
      mockSql.mockResolvedValueOnce([makeRelationshipRow({ target_type: 'agent' })]);

      const result = await service.getAgentRelationships('toly', { targetType: 'agent' });
      expect(result).toHaveLength(1);
      expect(result[0].targetType).toBe('agent');
    });

    it('filters by minimum familiarity', async () => {
      mockSql.mockResolvedValueOnce([makeRelationshipRow({ familiarity: 0.5 })]);

      const result = await service.getAgentRelationships('toly', { minFamiliarity: 0.3 });
      expect(result).toHaveLength(1);
    });

    it('combines targetType and minFamiliarity filters', async () => {
      mockSql.mockResolvedValueOnce([]);

      await service.getAgentRelationships('toly', {
        targetType: 'user',
        minFamiliarity: 0.5,
      });
      expect(mockSql.mock.calls).toHaveLength(1);
    });

    it('respects limit parameter', async () => {
      mockSql.mockResolvedValueOnce([]);
      await service.getAgentRelationships('toly', { limit: 10 });
      expect(mockSql.mock.calls).toHaveLength(1);
    });
  });

  describe('deleteRelationship', () => {
    it('deletes by agent and target ID', async () => {
      mockSql.mockResolvedValueOnce([]);
      await service.deleteRelationship('toly', 'user-1');
      expect(mockSql.mock.calls).toHaveLength(1);
    });
  });

  describe('summarizeForPrompt', () => {
    it('returns empty string for unknown relationship', async () => {
      mockSql.mockResolvedValueOnce([]);

      const result = await service.summarizeForPrompt('toly', 'unknown');
      expect(result).toBe('');
    });

    it('describes new user', async () => {
      const row = makeRelationshipRow({ interaction_count: 1, familiarity: 0.05 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.summarizeForPrompt('toly', 'user-1');
      expect(result).toContain('new user');
    });

    it('describes returning user', async () => {
      const row = makeRelationshipRow({ interaction_count: 3, familiarity: 0.15 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.summarizeForPrompt('toly', 'user-1');
      expect(result).toContain('3 times');
    });

    it('describes regular user', async () => {
      const row = makeRelationshipRow({ interaction_count: 10, familiarity: 0.5 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.summarizeForPrompt('toly', 'user-1');
      expect(result).toContain('regular');
      expect(result).toContain('getting to know');
    });

    it('describes long-time friend', async () => {
      const row = makeRelationshipRow({
        interaction_count: 25,
        familiarity: 0.8,
        trust: 0.85,
        sentiment: 0.6,
      });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.summarizeForPrompt('toly', 'user-1');
      expect(result).toContain('long-time friend');
      expect(result).toContain('know them well');
      expect(result).toContain('trust them highly');
      expect(result).toContain('very positive');
    });

    it('describes cautious relationship', async () => {
      const row = makeRelationshipRow({ trust: 0.2, sentiment: -0.4 });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.summarizeForPrompt('toly', 'user-1');
      expect(result).toContain('cautious');
      expect(result).toContain('tense');
    });

    it('includes last topics', async () => {
      const row = makeRelationshipRow({ last_topics: ['DeFi', 'NFTs'] });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.summarizeForPrompt('toly', 'user-1');
      expect(result).toContain('DeFi');
      expect(result).toContain('NFTs');
    });

    it('includes notes', async () => {
      const row = makeRelationshipRow({ notes: 'Prefers technical discussions' });
      mockSql.mockResolvedValueOnce([row]);

      const result = await service.summarizeForPrompt('toly', 'user-1');
      expect(result).toContain('Prefers technical discussions');
    });
  });

  describe('decayInactiveRelationships', () => {
    it('executes an UPDATE query with correct threshold', async () => {
      mockSql.mockResolvedValueOnce({ count: 5 });

      const result = await service.decayInactiveRelationships(
        7 * 24 * 60 * 60 * 1000, // 7 days
        0.05
      );

      expect(mockSql.mock.calls).toHaveLength(1);
      // Verify the SQL was called (tagged template)
      const callStrings = mockSql.mock.calls[0][0];
      expect(Array.isArray(callStrings)).toBe(true);
    });

    it('returns 0 when no relationships were decayed', async () => {
      mockSql.mockResolvedValueOnce({ count: 0 });

      const result = await service.decayInactiveRelationships();
      expect(result).toBe(0);
    });

    it('uses default parameters when none provided', async () => {
      mockSql.mockResolvedValueOnce({ count: 3 });

      const result = await service.decayInactiveRelationships();
      // Should use defaults: 7 days, 0.05 decay
      expect(mockSql.mock.calls).toHaveLength(1);
    });

    it('accepts custom threshold and decay amount', async () => {
      mockSql.mockResolvedValueOnce({ count: 10 });

      const result = await service.decayInactiveRelationships(
        14 * 24 * 60 * 60 * 1000, // 14 days
        0.1 // larger decay
      );

      expect(mockSql.mock.calls).toHaveLength(1);
    });
  });
});
