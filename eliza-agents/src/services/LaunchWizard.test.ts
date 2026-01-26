// LaunchWizard tests
// Tests Professor Oak guided token launch flow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LaunchWizard, type LaunchSession, type LaunchStep } from './LaunchWizard.js';

// Mock LLM service
vi.mock('./LLMService.js', () => ({
  getLLMService: () => ({
    generateResponse: vi.fn().mockResolvedValue({
      text: 'Professor Oak says: Great question about your token launch!',
      tokensUsed: 100,
    }),
  }),
}));

// Mock characters
vi.mock('../characters/index.js', () => ({
  getCharacter: (id: string) => {
    if (id === 'professor-oak') {
      return {
        id: 'professor-oak',
        name: 'Professor Oak',
        bio: ['Token launch expert'],
        topics: ['tokens', 'launches'],
        style: { all: ['helpful'], chat: ['friendly'] },
      };
    }
    return null;
  },
}));

describe('LaunchWizard', () => {
  beforeEach(() => {
    // Clean up sessions before each test
    LaunchWizard.cleanupSessions(0); // Clean all sessions
  });

  describe('startSession', () => {
    it('creates a new session with correct initial state', () => {
      const session = LaunchWizard.startSession('user123');

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user123');
      expect(session.currentStep).toBe('welcome');
      expect(session.data).toEqual({});
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it('generates unique session IDs', () => {
      const session1 = LaunchWizard.startSession('user1');
      const session2 = LaunchWizard.startSession('user2');

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('getSession', () => {
    it('returns session by ID', () => {
      const created = LaunchWizard.startSession('user123');
      const found = LaunchWizard.getSession(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('returns null for unknown session', () => {
      const found = LaunchWizard.getSession('unknown-id');
      expect(found).toBeNull();
    });
  });

  describe('getSessionByUser', () => {
    beforeEach(() => {
      // Ensure clean state - mark all sessions as old and clean them
      const existing = LaunchWizard.getActiveSessions();
      for (const s of existing) {
        (s as any).updatedAt = 0;
      }
      LaunchWizard.cleanupSessions(1);
    });

    it('returns most recent session for user', () => {
      const session1 = LaunchWizard.startSession('user123');
      const session2 = LaunchWizard.startSession('user123');

      // Manually ensure session2 has a later timestamp
      const s1 = LaunchWizard.getSession(session1.id)!;
      const s2 = LaunchWizard.getSession(session2.id)!;
      (s1 as any).updatedAt = Date.now() - 1000; // 1 second ago
      (s2 as any).updatedAt = Date.now(); // Now

      const found = LaunchWizard.getSessionByUser('user123');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(session2.id);
    });

    it('returns null for user with no sessions', () => {
      const found = LaunchWizard.getSessionByUser('unknown-user');
      expect(found).toBeNull();
    });
  });

  describe('getStepGuidance', () => {
    it('returns guidance for welcome step', () => {
      const guidance = LaunchWizard.getStepGuidance('welcome');

      expect(guidance.title).toBe('Welcome to Token Launch');
      expect(guidance.oakAdvice).toContain('Professor Oak');
      expect(guidance.tips).toBeDefined();
      expect(guidance.tips!.length).toBeGreaterThan(0);
    });

    it('returns guidance with validation for token_name', () => {
      const guidance = LaunchWizard.getStepGuidance('token_name');

      expect(guidance.validation).toBeDefined();
      expect(guidance.examples).toBeDefined();
      expect(guidance.tips).toBeDefined();
    });

    it('returns guidance for all steps', () => {
      const steps: LaunchStep[] = [
        'welcome', 'token_name', 'token_symbol', 'token_description',
        'token_image', 'fee_config', 'review', 'confirmed', 'completed'
      ];

      for (const step of steps) {
        const guidance = LaunchWizard.getStepGuidance(step);
        expect(guidance.title).toBeDefined();
        expect(guidance.oakAdvice).toBeDefined();
      }
    });
  });

  describe('processInput', () => {
    describe('welcome step', () => {
      it('advances to token_name when user says ready', async () => {
        const session = LaunchWizard.startSession('user123');
        const result = await LaunchWizard.processInput(session.id, 'ready');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_name');
        expect(result.session.currentStep).toBe('token_name');
      });

      it('accepts various affirmative responses', async () => {
        const affirmatives = ['yes', 'start', "let's go", 'ok'];

        for (const word of affirmatives) {
          LaunchWizard.cleanupSessions(0);
          const session = LaunchWizard.startSession('user');
          const result = await LaunchWizard.processInput(session.id, word);
          expect(result.nextStep).toBe('token_name');
        }
      });

      it('stays on welcome for non-affirmative input', async () => {
        const session = LaunchWizard.startSession('user123');
        const result = await LaunchWizard.processInput(session.id, 'maybe later');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBeUndefined();
        expect(result.session.currentStep).toBe('welcome');
      });
    });

    describe('token_name step', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');
        sessionId = session.id;
      });

      it('accepts valid token name and advances', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'My Cool Token');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_symbol');
        expect(result.session.data.name).toBe('My Cool Token');
      });

      it('rejects name too short', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'AB');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBeUndefined();
        expect(result.response).toContain('at least 3 characters');
      });

      it('rejects name too long', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'A'.repeat(33));

        expect(result.response).toContain('32 characters or less');
      });

      it('rejects special characters', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'Token@#$');

        expect(result.response).toContain('letters, numbers, and spaces');
      });
    });

    describe('token_symbol step', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');
        sessionId = session.id;
      });

      it('accepts valid symbol and advances', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'TEST');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_description');
        expect(result.session.data.symbol).toBe('TEST');
      });

      it('handles $ prefix in symbol', async () => {
        const result = await LaunchWizard.processInput(sessionId, '$BAGS');

        expect(result.session.data.symbol).toBe('BAGS');
      });

      it('converts to uppercase', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'test');

        expect(result.session.data.symbol).toBe('TEST');
      });

      it('rejects symbol too short', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'A');

        expect(result.response).toContain('at least 2 characters');
      });

      it('rejects symbol with numbers', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'TEST123');

        expect(result.response).toContain('only contain letters');
      });
    });

    describe('token_description step', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');
        await LaunchWizard.processInput(session.id, 'TEST');
        sessionId = session.id;
      });

      it('accepts valid description and advances', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'A great token for testing purposes');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_image');
        expect(result.session.data.description).toBe('A great token for testing purposes');
      });

      it('rejects description too short', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'Short');

        expect(result.response).toContain('at least 10 characters');
      });
    });

    describe('token_image step', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');
        await LaunchWizard.processInput(session.id, 'TEST');
        await LaunchWizard.processInput(session.id, 'A great token for testing purposes');
        sessionId = session.id;
      });

      it('accepts valid image URL and advances', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'https://example.com/image.png');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('fee_config');
        expect(result.session.data.imageUrl).toBe('https://example.com/image.png');
      });

      it('accepts skip and advances without image', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'skip');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('fee_config');
        expect(result.session.data.imageUrl).toBeUndefined();
      });

      it('rejects non-https URL', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'http://example.com/image.png');

        expect(result.response).toContain('https://');
      });

      it('rejects invalid image extension', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'https://example.com/image.svg');

        expect(result.response).toContain('PNG, JPG, GIF, or WebP');
      });

      it('accepts various image formats', async () => {
        const formats = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

        for (const format of formats) {
          LaunchWizard.cleanupSessions(0);
          const session = LaunchWizard.startSession('user');
          await LaunchWizard.processInput(session.id, 'ready');
          await LaunchWizard.processInput(session.id, 'Token');
          await LaunchWizard.processInput(session.id, 'TKN');
          await LaunchWizard.processInput(session.id, 'A token description here');
          const result = await LaunchWizard.processInput(session.id, `https://x.com/i.${format}`);
          expect(result.nextStep).toBe('fee_config');
        }
      });
    });

    describe('fee_config step', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');
        await LaunchWizard.processInput(session.id, 'TEST');
        await LaunchWizard.processInput(session.id, 'A great token for testing purposes');
        await LaunchWizard.processInput(session.id, 'skip');
        sessionId = session.id;
      });

      it('accepts valid fee and advances to review', async () => {
        const result = await LaunchWizard.processInput(sessionId, '1');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('review');
        expect(result.session.data.creatorFeePercent).toBe(1);
      });

      it('accepts decimal fees', async () => {
        const result = await LaunchWizard.processInput(sessionId, '0.5');

        expect(result.session.data.creatorFeePercent).toBe(0.5);
      });

      it('accepts zero fee', async () => {
        const result = await LaunchWizard.processInput(sessionId, '0');

        expect(result.session.data.creatorFeePercent).toBe(0);
        expect(result.nextStep).toBe('review');
      });

      it('accepts maximum 5% fee', async () => {
        const result = await LaunchWizard.processInput(sessionId, '5');

        expect(result.session.data.creatorFeePercent).toBe(5);
      });

      it('rejects fee over 5%', async () => {
        const result = await LaunchWizard.processInput(sessionId, '6');

        expect(result.response).toContain('between 0% and 5%');
      });

      it('rejects negative fee', async () => {
        const result = await LaunchWizard.processInput(sessionId, '-1');

        expect(result.response).toContain('between 0% and 5%');
      });

      it('rejects non-numeric input', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'abc');

        expect(result.response).toContain('enter a number');
      });
    });

    describe('review step', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');
        await LaunchWizard.processInput(session.id, 'TEST');
        await LaunchWizard.processInput(session.id, 'A great token for testing purposes');
        await LaunchWizard.processInput(session.id, 'https://example.com/logo.png');
        await LaunchWizard.processInput(session.id, '1');
        sessionId = session.id;
      });

      it('shows token review summary', async () => {
        const session = LaunchWizard.getSession(sessionId);
        expect(session!.currentStep).toBe('review');

        const lastMessage = session!.messages[session!.messages.length - 1];
        expect(lastMessage.content).toContain('Test Token');
        expect(lastMessage.content).toContain('$TEST');
        expect(lastMessage.content).toContain('1%');
      });

      it('advances to confirmed on confirm', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'confirm');

        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('confirmed');
        expect(result.launchReady).toBe(true);
        expect(result.launchData).toBeDefined();
        expect(result.launchData!.name).toBe('Test Token');
      });

      it('goes back on back command', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'back');

        expect(result.nextStep).toBe('fee_config');
      });

      it('stays on review for other input', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'maybe');

        expect(result.session.currentStep).toBe('review');
        expect(result.response).toContain('confirm');
      });
    });

    describe('special commands', () => {
      it('handles back command', async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');

        const result = await LaunchWizard.processInput(session.id, 'back');

        expect(result.nextStep).toBe('token_name');
      });

      it('handles cancel command', async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');

        const result = await LaunchWizard.processInput(session.id, 'cancel');

        expect(result.success).toBe(true);
        expect(result.response).toContain('cancelled');

        // Session should be deleted
        expect(LaunchWizard.getSession(session.id)).toBeNull();
      });

      it('back on welcome stays on welcome', async () => {
        const session = LaunchWizard.startSession('user123');
        const result = await LaunchWizard.processInput(session.id, 'back');

        // When on welcome, back has no effect - stays on welcome
        expect(result.session.currentStep).toBe('welcome');
        expect(result.success).toBe(true);
      });
    });

    describe('unknown session', () => {
      it('returns error for unknown session', async () => {
        const result = await LaunchWizard.processInput('unknown-id', 'test');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Session not found');
      });
    });

    describe('message history', () => {
      it('records user and assistant messages', async () => {
        const session = LaunchWizard.startSession('user123');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'My Token');

        const updated = LaunchWizard.getSession(session.id)!;
        expect(updated.messages.length).toBeGreaterThanOrEqual(4);

        const userMessages = updated.messages.filter(m => m.role === 'user');
        const assistantMessages = updated.messages.filter(m => m.role === 'assistant');

        expect(userMessages.length).toBe(2);
        expect(assistantMessages.length).toBe(2);
      });
    });
  });

  describe('completeSession', () => {
    it('marks session as completed', async () => {
      const session = LaunchWizard.startSession('user123');
      await LaunchWizard.processInput(session.id, 'ready');
      await LaunchWizard.processInput(session.id, 'Test Token');
      await LaunchWizard.processInput(session.id, 'TEST');
      await LaunchWizard.processInput(session.id, 'A great token');
      await LaunchWizard.processInput(session.id, 'skip');
      await LaunchWizard.processInput(session.id, '1');
      await LaunchWizard.processInput(session.id, 'confirm');

      LaunchWizard.completeSession(session.id, 'mint123abc');

      const completed = LaunchWizard.getSession(session.id)!;
      expect(completed.currentStep).toBe('completed');
    });

    it('handles unknown session gracefully', () => {
      // Should not throw
      LaunchWizard.completeSession('unknown-id', 'mint123');
    });
  });

  describe('getPersonalizedAdvice', () => {
    it('returns advice from Professor Oak', async () => {
      const session = LaunchWizard.startSession('user123');
      await LaunchWizard.processInput(session.id, 'ready');

      const advice = await LaunchWizard.getPersonalizedAdvice(
        session,
        'What fee should I set?'
      );

      expect(advice).toContain('Professor Oak');
    });
  });

  describe('getActiveSessions', () => {
    beforeEach(() => {
      // Ensure clean state
      const existing = LaunchWizard.getActiveSessions();
      for (const s of existing) {
        (s as any).updatedAt = 0;
      }
      LaunchWizard.cleanupSessions(1);
    });

    it('returns active sessions', () => {
      LaunchWizard.startSession('user1');
      LaunchWizard.startSession('user2');

      const active = LaunchWizard.getActiveSessions();
      expect(active.length).toBe(2);
    });

    it('filters by age', () => {
      const session = LaunchWizard.startSession('user1');

      // Manually set old timestamp (older than 24h)
      const stored = LaunchWizard.getSession(session.id)!;
      (stored as any).updatedAt = Date.now() - 25 * 60 * 60 * 1000;

      const active = LaunchWizard.getActiveSessions();
      expect(active.length).toBe(0);
    });
  });

  describe('cleanupSessions', () => {
    it('removes old sessions', () => {
      const session = LaunchWizard.startSession('user1');

      // Manually set old timestamp
      const stored = LaunchWizard.getSession(session.id)!;
      (stored as any).updatedAt = Date.now() - 25 * 60 * 60 * 1000;

      const cleaned = LaunchWizard.cleanupSessions();
      expect(cleaned).toBe(1);
      expect(LaunchWizard.getSession(session.id)).toBeNull();
    });

    it('keeps recent sessions', () => {
      const session = LaunchWizard.startSession('user1');

      const cleaned = LaunchWizard.cleanupSessions();
      expect(cleaned).toBe(0);
      expect(LaunchWizard.getSession(session.id)).not.toBeNull();
    });
  });

  describe('boundary conditions', () => {
    describe('token_name boundaries', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user');
        await LaunchWizard.processInput(session.id, 'ready');
        sessionId = session.id;
      });

      it('accepts exactly 3 character name (minimum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'ABC');
        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_symbol');
        expect(result.session.data.name).toBe('ABC');
      });

      it('accepts exactly 32 character name (maximum)', async () => {
        const name = 'A'.repeat(32);
        const result = await LaunchWizard.processInput(sessionId, name);
        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_symbol');
        expect(result.session.data.name).toBe(name);
      });

      it('rejects 2 character name (below minimum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'AB');
        expect(result.success).toBe(true);
        expect(result.nextStep).toBeUndefined();
        expect(result.response).toContain('at least 3 characters');
      });

      it('rejects 33 character name (above maximum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'A'.repeat(33));
        expect(result.response).toContain('32 characters or less');
      });
    });

    describe('token_symbol boundaries', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');
        sessionId = session.id;
      });

      it('accepts exactly 2 character symbol (minimum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'AB');
        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_description');
        expect(result.session.data.symbol).toBe('AB');
      });

      it('accepts exactly 10 character symbol (maximum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'ABCDEFGHIJ');
        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_description');
        expect(result.session.data.symbol).toBe('ABCDEFGHIJ');
      });

      it('rejects 1 character symbol (below minimum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'A');
        expect(result.response).toContain('at least 2 characters');
      });

      it('rejects 11 character symbol (above maximum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, 'ABCDEFGHIJK');
        expect(result.response).toContain('10 characters or less');
      });
    });

    describe('token_description boundaries', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');
        await LaunchWizard.processInput(session.id, 'TEST');
        sessionId = session.id;
      });

      it('accepts exactly 10 character description (minimum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, '1234567890');
        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_image');
      });

      it('accepts 200 character description', async () => {
        const desc = 'A'.repeat(200);
        const result = await LaunchWizard.processInput(sessionId, desc);
        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('token_image');
      });

      it('rejects 9 character description (below minimum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, '123456789');
        expect(result.response).toContain('at least 10 characters');
      });
    });

    describe('fee_config boundaries', () => {
      let sessionId: string;

      beforeEach(async () => {
        const session = LaunchWizard.startSession('user');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Test Token');
        await LaunchWizard.processInput(session.id, 'TEST');
        await LaunchWizard.processInput(session.id, 'A great token here');
        await LaunchWizard.processInput(session.id, 'skip');
        sessionId = session.id;
      });

      it('accepts exactly 5% fee (maximum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, '5');
        expect(result.success).toBe(true);
        expect(result.nextStep).toBe('review');
        expect(result.session.data.creatorFeePercent).toBe(5);
      });

      it('rejects 5.01% fee (above maximum)', async () => {
        const result = await LaunchWizard.processInput(sessionId, '5.01');
        expect(result.response).toContain('between 0% and 5%');
      });

      it('accepts 0.01% fee (small but valid)', async () => {
        const result = await LaunchWizard.processInput(sessionId, '0.01');
        expect(result.success).toBe(true);
        expect(result.session.data.creatorFeePercent).toBe(0.01);
      });

      it('handles fee with % suffix', async () => {
        const result = await LaunchWizard.processInput(sessionId, '2%');
        expect(result.success).toBe(true);
        expect(result.session.data.creatorFeePercent).toBe(2);
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty string input', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      const result = await LaunchWizard.processInput(session.id, '');

      expect(result.success).toBe(true);
      expect(result.nextStep).toBeUndefined();
      expect(result.response).toContain('at least 3 characters');
    });

    it('handles whitespace-only input', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      const result = await LaunchWizard.processInput(session.id, '   ');

      expect(result.success).toBe(true);
      expect(result.nextStep).toBeUndefined();
    });

    it('trims leading and trailing spaces from token name', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      const result = await LaunchWizard.processInput(session.id, '  My Token  ');

      expect(result.session.data.name).toBe('My Token');
    });

    it('handles mixed case affirmatives', async () => {
      const cases = ['YES', 'Ready', 'OK', "LET'S GO"];
      for (const word of cases) {
        LaunchWizard.cleanupSessions(0);
        const session = LaunchWizard.startSession('user');
        const result = await LaunchWizard.processInput(session.id, word);
        expect(result.nextStep).toBe('token_name');
      }
    });

    it('handles token name with multiple internal spaces', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      const result = await LaunchWizard.processInput(session.id, 'My  Cool  Token');

      expect(result.success).toBe(true);
      expect(result.nextStep).toBe('token_symbol');
    });

    it('rejects image URL with query parameters (extension not at end)', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      await LaunchWizard.processInput(session.id, 'Token');
      await LaunchWizard.processInput(session.id, 'TKN');
      await LaunchWizard.processInput(session.id, 'A token description');
      const result = await LaunchWizard.processInput(
        session.id,
        'https://example.com/image.png?size=512&format=webp'
      );

      // Current validation requires extension at end of URL
      expect(result.success).toBe(true);
      expect(result.nextStep).toBeUndefined();
      expect(result.response).toContain('PNG, JPG, GIF, or WebP');
    });

    it('handles image URL with uppercase extension', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      await LaunchWizard.processInput(session.id, 'Token');
      await LaunchWizard.processInput(session.id, 'TKN');
      await LaunchWizard.processInput(session.id, 'A token description');
      const result = await LaunchWizard.processInput(
        session.id,
        'https://example.com/IMAGE.PNG'
      );

      expect(result.success).toBe(true);
      expect(result.nextStep).toBe('fee_config');
    });

    it('handles skip command case-insensitively in image step', async () => {
      // Validation uses toLowerCase() === 'skip'
      const skipVariants = ['skip', 'SKIP', 'Skip', 'sKiP'];
      for (const skipWord of skipVariants) {
        LaunchWizard.cleanupSessions(0);
        const session = LaunchWizard.startSession('user');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Token');
        await LaunchWizard.processInput(session.id, 'TKN');
        await LaunchWizard.processInput(session.id, 'A token description');
        const result = await LaunchWizard.processInput(session.id, skipWord);
        expect(result.nextStep).toBe('fee_config');
      }
    });

    it('rejects non-skip words like none and later in image step', async () => {
      const nonSkipWords = ['none', 'later', 'no image'];
      for (const word of nonSkipWords) {
        LaunchWizard.cleanupSessions(0);
        const session = LaunchWizard.startSession('user');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Token');
        await LaunchWizard.processInput(session.id, 'TKN');
        await LaunchWizard.processInput(session.id, 'A token description');
        const result = await LaunchWizard.processInput(session.id, word);
        // These are not valid skip words or valid URLs
        expect(result.nextStep).toBeUndefined();
      }
    });

    it('handles confirm command case-insensitively in review step', async () => {
      // Review step only accepts 'confirm' (case-insensitive)
      const confirmVariants = ['confirm', 'CONFIRM', 'Confirm', 'cOnFiRm'];
      for (const confirmWord of confirmVariants) {
        LaunchWizard.cleanupSessions(0);
        const session = LaunchWizard.startSession('user');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Token');
        await LaunchWizard.processInput(session.id, 'TKN');
        await LaunchWizard.processInput(session.id, 'A good description');
        await LaunchWizard.processInput(session.id, 'skip');
        await LaunchWizard.processInput(session.id, '1');
        const result = await LaunchWizard.processInput(session.id, confirmWord);
        expect(result.nextStep).toBe('confirmed');
        expect(result.launchReady).toBe(true);
      }
    });

    it('rejects non-confirm words like yes in review step', async () => {
      const nonConfirmWords = ['yes', 'ok', 'proceed'];
      for (const word of nonConfirmWords) {
        LaunchWizard.cleanupSessions(0);
        const session = LaunchWizard.startSession('user');
        await LaunchWizard.processInput(session.id, 'ready');
        await LaunchWizard.processInput(session.id, 'Token');
        await LaunchWizard.processInput(session.id, 'TKN');
        await LaunchWizard.processInput(session.id, 'A good description');
        await LaunchWizard.processInput(session.id, 'skip');
        await LaunchWizard.processInput(session.id, '1');
        const result = await LaunchWizard.processInput(session.id, word);
        // These are not valid confirm words
        expect(result.nextStep).toBeUndefined();
        expect(result.response).toContain('confirm');
      }
    });

    it('updates timestamp on each input', async () => {
      const session = LaunchWizard.startSession('user');
      const initialTime = session.updatedAt;

      // Wait a bit
      await new Promise(r => setTimeout(r, 10));

      await LaunchWizard.processInput(session.id, 'ready');
      const afterInput = LaunchWizard.getSession(session.id)!;

      expect(afterInput.updatedAt).toBeGreaterThan(initialTime);
    });

    it('handles cancel from any step', async () => {
      const steps = ['welcome', 'token_name', 'token_symbol', 'token_description', 'token_image', 'fee_config', 'review'];
      const inputs = ['', 'Token', 'TKN', 'Description here', 'skip', '1', ''];

      for (let i = 0; i < steps.length; i++) {
        LaunchWizard.cleanupSessions(0);
        const session = LaunchWizard.startSession('user');

        // Navigate to step
        for (let j = 0; j < i; j++) {
          if (j === 0) await LaunchWizard.processInput(session.id, 'ready');
          else await LaunchWizard.processInput(session.id, inputs[j]);
        }

        // Cancel
        const result = await LaunchWizard.processInput(session.id, 'cancel');
        expect(result.response).toContain('cancelled');
        expect(LaunchWizard.getSession(session.id)).toBeNull();
      }
    });
  });

  describe('step navigation', () => {
    it('can go back through all steps', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      await LaunchWizard.processInput(session.id, 'Token');
      await LaunchWizard.processInput(session.id, 'TKN');
      await LaunchWizard.processInput(session.id, 'Description');
      await LaunchWizard.processInput(session.id, 'skip');
      await LaunchWizard.processInput(session.id, '1');

      // Now on review, go back
      let result = await LaunchWizard.processInput(session.id, 'back');
      expect(result.session.currentStep).toBe('fee_config');

      result = await LaunchWizard.processInput(session.id, 'back');
      expect(result.session.currentStep).toBe('token_image');

      result = await LaunchWizard.processInput(session.id, 'back');
      expect(result.session.currentStep).toBe('token_description');

      result = await LaunchWizard.processInput(session.id, 'back');
      expect(result.session.currentStep).toBe('token_symbol');

      result = await LaunchWizard.processInput(session.id, 'back');
      expect(result.session.currentStep).toBe('token_name');

      result = await LaunchWizard.processInput(session.id, 'back');
      expect(result.session.currentStep).toBe('welcome');

      // Back from welcome stays on welcome
      result = await LaunchWizard.processInput(session.id, 'back');
      expect(result.session.currentStep).toBe('welcome');
    });

    it('preserves data when going back and re-entering', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      await LaunchWizard.processInput(session.id, 'Original Name');
      await LaunchWizard.processInput(session.id, 'ORIG');

      // Go back to name
      await LaunchWizard.processInput(session.id, 'back');
      await LaunchWizard.processInput(session.id, 'back');

      // Enter new name
      await LaunchWizard.processInput(session.id, 'New Name');

      const updated = LaunchWizard.getSession(session.id)!;
      expect(updated.data.name).toBe('New Name');
      // Symbol should still be preserved
      expect(updated.data.symbol).toBe('ORIG');
    });
  });

  describe('confirmed and completed steps', () => {
    it('cannot process input on confirmed step', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      await LaunchWizard.processInput(session.id, 'Token');
      await LaunchWizard.processInput(session.id, 'TKN');
      await LaunchWizard.processInput(session.id, 'Description here');
      await LaunchWizard.processInput(session.id, 'skip');
      await LaunchWizard.processInput(session.id, '1');
      await LaunchWizard.processInput(session.id, 'confirm');

      const current = LaunchWizard.getSession(session.id)!;
      expect(current.currentStep).toBe('confirmed');

      // Try to process more input
      const result = await LaunchWizard.processInput(session.id, 'something');
      expect(result.session.currentStep).toBe('confirmed');
    });

    it('cannot process input on completed step', async () => {
      const session = LaunchWizard.startSession('user');
      await LaunchWizard.processInput(session.id, 'ready');
      await LaunchWizard.processInput(session.id, 'Token');
      await LaunchWizard.processInput(session.id, 'TKN');
      await LaunchWizard.processInput(session.id, 'Description here');
      await LaunchWizard.processInput(session.id, 'skip');
      await LaunchWizard.processInput(session.id, '1');
      await LaunchWizard.processInput(session.id, 'confirm');

      LaunchWizard.completeSession(session.id, 'mint123');

      const result = await LaunchWizard.processInput(session.id, 'something');
      expect(result.session.currentStep).toBe('completed');
    });
  });

  describe('full flow integration', () => {
    it('completes entire token launch flow', async () => {
      const session = LaunchWizard.startSession('user123');

      // Welcome
      let result = await LaunchWizard.processInput(session.id, 'ready');
      expect(result.nextStep).toBe('token_name');

      // Token name
      result = await LaunchWizard.processInput(session.id, 'Awesome Token');
      expect(result.nextStep).toBe('token_symbol');

      // Token symbol
      result = await LaunchWizard.processInput(session.id, '$AWE');
      expect(result.nextStep).toBe('token_description');

      // Description
      result = await LaunchWizard.processInput(session.id, 'The most awesome token on Solana');
      expect(result.nextStep).toBe('token_image');

      // Image
      result = await LaunchWizard.processInput(session.id, 'https://awesome.io/logo.png');
      expect(result.nextStep).toBe('fee_config');

      // Fee
      result = await LaunchWizard.processInput(session.id, '1.5');
      expect(result.nextStep).toBe('review');

      // Review shows all data
      expect(result.response).toContain('Awesome Token');
      expect(result.response).toContain('$AWE');
      expect(result.response).toContain('1.5%');

      // Confirm
      result = await LaunchWizard.processInput(session.id, 'confirm');
      expect(result.nextStep).toBe('confirmed');
      expect(result.launchReady).toBe(true);
      expect(result.launchData).toEqual({
        name: 'Awesome Token',
        symbol: 'AWE',
        description: 'The most awesome token on Solana',
        imageUrl: 'https://awesome.io/logo.png',
        creatorFeePercent: 1.5,
      });

      // Complete
      LaunchWizard.completeSession(session.id, 'SoMeMiNtAdDrEsS');

      const completed = LaunchWizard.getSession(session.id)!;
      expect(completed.currentStep).toBe('completed');
    });
  });
});
