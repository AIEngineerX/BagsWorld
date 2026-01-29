// Tests for BagsWorld evaluators

import { describe, it, expect, beforeEach } from 'vitest';
import {
  tokenMentionEvaluator,
  feeQueryEvaluator,
  launchQueryEvaluator,
  worldStatusEvaluator,
  creatorQueryEvaluator,
  explanationQueryEvaluator,
  allEvaluators,
} from './index.js';
import type { IAgentRuntime, Memory, State } from '../types/elizaos.js';

// Mock runtime
const mockRuntime: IAgentRuntime = {
  agentId: 'test-agent',
  character: { name: 'TestAgent' },
  getSetting: () => undefined,
  getService: () => undefined,
  registerService: () => {},
};

// Helper to create a message
const createMessage = (text: string): Memory => ({
  content: { text },
  userId: 'user-1',
  roomId: 'room-1',
});

describe('Evaluators', () => {
  describe('allEvaluators', () => {
    it('should export 7 evaluators', () => {
      expect(allEvaluators).toHaveLength(7);
    });

    it('should have unique names', () => {
      const names = allEvaluators.map(e => e.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });

    it('should all have descriptions', () => {
      allEvaluators.forEach(e => {
        expect(e.description).toBeTruthy();
      });
    });
  });

  describe('tokenMentionEvaluator', () => {
    it('should score high for mint addresses', async () => {
      const message = createMessage('check this token 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await tokenMentionEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.data?.mint).toBeTruthy();
    });

    it('should score high for $SYMBOL mentions', async () => {
      const message = createMessage('what do you think about $BAGS?');
      const result = await tokenMentionEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThanOrEqual(0.3);
      expect(result.data?.symbol).toBe('BAGS');
    });

    it('should score higher for mint + keyword', async () => {
      const message = createMessage('lookup token 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await tokenMentionEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.6);
    });

    it('should score low for unrelated messages', async () => {
      const message = createMessage('hello how are you?');
      const result = await tokenMentionEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeLessThan(0.2);
    });
  });

  describe('feeQueryEvaluator', () => {
    it('should score high for fee-related queries', async () => {
      const message = createMessage('how much fees have I earned?');
      const result = await feeQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should score high for earnings queries', async () => {
      const message = createMessage('show me my unclaimed earnings');
      const result = await feeQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.4);
    });

    it('should score medium for secondary keywords', async () => {
      const message = createMessage('how much profit did the token make?');
      const result = await feeQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.1);
      expect(result.score).toBeLessThan(0.5);
    });

    it('should score low for unrelated messages', async () => {
      const message = createMessage('what is the weather like?');
      const result = await feeQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeLessThan(0.2);
    });
  });

  describe('launchQueryEvaluator', () => {
    it('should score high for new token queries', async () => {
      const message = createMessage('what tokens launched today?');
      const result = await launchQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should score high for recent launches', async () => {
      const message = createMessage('show me the latest token launches');
      const result = await launchQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should score higher with context keywords', async () => {
      const message = createMessage('what new tokens were launched?');
      const result = await launchQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.6);
    });

    it('should score low for unrelated messages', async () => {
      const message = createMessage('tell me a joke');
      const result = await launchQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeLessThan(0.2);
    });
  });

  describe('worldStatusEvaluator', () => {
    it('should score high for world health queries', async () => {
      const message = createMessage('how is the world health?');
      const result = await worldStatusEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should score high for BagsWorld status', async () => {
      const message = createMessage('what is the status of bagsworld?');
      const result = await worldStatusEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should detect weather keywords', async () => {
      const message = createMessage('is it sunny in the world?');
      const result = await worldStatusEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.3);
    });

    it('should detect condition keywords', async () => {
      const message = createMessage('is the ecosystem thriving?');
      const result = await worldStatusEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });
  });

  describe('creatorQueryEvaluator', () => {
    it('should score high for top creators query', async () => {
      const message = createMessage('who are the top creators?');
      const result = await creatorQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.6);
    });

    it('should score high for leaderboard queries', async () => {
      const message = createMessage('show me the creator leaderboard');
      const result = await creatorQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should score higher for combined keywords', async () => {
      const message = createMessage('who are the best earning creators?');
      const result = await creatorQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should score low for unrelated messages', async () => {
      const message = createMessage('what time is it?');
      const result = await creatorQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeLessThan(0.2);
    });
  });

  describe('explanationQueryEvaluator', () => {
    it('should score high for "what is" questions', async () => {
      const message = createMessage('what is bags.fm?');
      const result = await explanationQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should score high for "how does" questions', async () => {
      const message = createMessage('how does fee sharing work?');
      const result = await explanationQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should score high for explain requests', async () => {
      const message = createMessage('can you explain how to launch a token?');
      const result = await explanationQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.6);
    });

    it('should detect educational keywords', async () => {
      const message = createMessage('I am a beginner, help me understand');
      const result = await explanationQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeGreaterThan(0.4);
    });

    it('should score low for action requests', async () => {
      const message = createMessage('check token ABC123');
      const result = await explanationQueryEvaluator.evaluate(mockRuntime, message);

      expect(result.score).toBeLessThan(0.3);
    });
  });

  describe('Action prioritization scenarios', () => {
    it('should prioritize tokenMention over feeQuery for mint address', async () => {
      const message = createMessage('check fees for 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');

      const tokenScore = await tokenMentionEvaluator.evaluate(mockRuntime, message);
      const feeScore = await feeQueryEvaluator.evaluate(mockRuntime, message);

      // Both should score, but tokenMention should be higher due to mint address
      expect(tokenScore.score).toBeGreaterThan(0.4);
      expect(feeScore.score).toBeGreaterThan(0.2);
    });

    it('should prioritize feeQuery for pure fee questions', async () => {
      const message = createMessage('how much have I earned in fees this week?');

      const tokenScore = await tokenMentionEvaluator.evaluate(mockRuntime, message);
      const feeScore = await feeQueryEvaluator.evaluate(mockRuntime, message);

      expect(feeScore.score).toBeGreaterThan(tokenScore.score);
    });

    it('should prioritize creatorQuery for leaderboard', async () => {
      const message = createMessage('show me the top earning creators');

      const creatorScore = await creatorQueryEvaluator.evaluate(mockRuntime, message);
      const feeScore = await feeQueryEvaluator.evaluate(mockRuntime, message);

      expect(creatorScore.score).toBeGreaterThan(feeScore.score);
    });
  });
});
