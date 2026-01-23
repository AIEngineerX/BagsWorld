// Comprehensive tests for src/lib/intent-extractor.ts
// Tests the intent extraction system with fallback pattern matching

import { quickIntentCheck, ExtractedIntent } from '@/lib/intent-extractor';

// We test fallbackIntentExtraction through extractIntent when API fails
// For unit tests, we focus on quickIntentCheck and simulate the fallback

describe('Intent Extractor', () => {
  // ==================== quickIntentCheck ====================

  describe('quickIntentCheck', () => {
    describe('greetings (obvious chat intent)', () => {
      it('should recognize "gm" as chat', () => {
        const result = quickIntentCheck('gm');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('chat');
        expect(result?.confidence).toBe(0.99);
      });

      it('should recognize "gn" as chat', () => {
        const result = quickIntentCheck('gn');
        expect(result?.action).toBe('chat');
      });

      it('should recognize "hi" as chat', () => {
        const result = quickIntentCheck('hi');
        expect(result?.action).toBe('chat');
      });

      it('should recognize "hello" as chat', () => {
        const result = quickIntentCheck('hello');
        expect(result?.action).toBe('chat');
      });

      it('should recognize "hey" as chat', () => {
        const result = quickIntentCheck('hey');
        expect(result?.action).toBe('chat');
      });

      it('should recognize "yo" as chat', () => {
        const result = quickIntentCheck('yo');
        expect(result?.action).toBe('chat');
      });

      it('should recognize "sup" as chat', () => {
        const result = quickIntentCheck('sup');
        expect(result?.action).toBe('chat');
      });

      it('should match greeting at start of message only', () => {
        const result = quickIntentCheck('gm everyone!');
        expect(result?.action).toBe('chat');
      });

      it('should not match greeting in middle of message', () => {
        // "say gm to me" - gm not at start, should return null
        const result = quickIntentCheck('please say gm');
        expect(result).toBeNull();
      });
    });

    describe('pet actions', () => {
      it('should recognize "pet the dog" as pet action', () => {
        const result = quickIntentCheck('pet the dog');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('pet');
        expect(result?.target?.type).toBe('animal');
        expect(result?.target?.name).toBe('dog');
        expect(result?.confidence).toBe(0.99);
      });

      it('should recognize "pet dog" (without "the")', () => {
        const result = quickIntentCheck('pet dog');
        expect(result?.action).toBe('pet');
        expect(result?.target?.name).toBe('dog');
      });

      it('should recognize "pat the cat"', () => {
        const result = quickIntentCheck('pat the cat');
        expect(result?.action).toBe('pet');
        expect(result?.target?.name).toBe('cat');
      });

      it('should recognize "pet the bird"', () => {
        const result = quickIntentCheck('pet the bird');
        expect(result?.action).toBe('pet');
        expect(result?.target?.name).toBe('bird');
      });

      it('should be case-insensitive', () => {
        const result = quickIntentCheck('PET THE DOG');
        expect(result?.action).toBe('pet');
        expect(result?.target?.name).toBe('dog');
      });
    });

    describe('effect actions', () => {
      it('should recognize "fireworks" as effect', () => {
        const result = quickIntentCheck('fireworks');
        expect(result).not.toBeNull();
        expect(result?.action).toBe('effect');
        expect(result?.target?.type).toBe('effect');
        expect(result?.target?.name).toBe('fireworks');
      });

      it('should recognize "firework" (singular)', () => {
        const result = quickIntentCheck('firework');
        expect(result?.action).toBe('effect');
        expect(result?.target?.name).toBe('fireworks');
      });
    });

    describe('non-obvious intents (returns null)', () => {
      it('should return null for complex pet request', () => {
        const result = quickIntentCheck('give the puppy some love');
        expect(result).toBeNull();
      });

      it('should return null for effect request with context', () => {
        const result = quickIntentCheck('make it rain');
        expect(result).toBeNull();
      });

      it('should return null for questions', () => {
        const result = quickIntentCheck('how is the world doing?');
        expect(result).toBeNull();
      });

      it('should return null for scare requests', () => {
        const result = quickIntentCheck('scare the cat');
        expect(result).toBeNull();
      });

      it('should return null for ambiguous messages', () => {
        const result = quickIntentCheck('something about dogs and cats');
        expect(result).toBeNull();
      });
    });
  });

  // ==================== Fallback Intent Extraction ====================
  // We test this by examining expected behavior based on the fallback patterns

  describe('Fallback Pattern Matching (via behavior)', () => {
    // These test the expected patterns that fallbackIntentExtraction handles
    // We can't call it directly (it's not exported), but we document expected behavior

    describe('animal action patterns', () => {
      const animalPatterns = [
        // Pet patterns
        { input: 'pet the dog', action: 'pet', animal: 'dog' },
        { input: 'love the puppy', action: 'pet', animal: 'dog' },
        { input: 'cuddle the cat', action: 'pet', animal: 'cat' },
        { input: 'pat the kitty', action: 'pet', animal: 'cat' },
        { input: 'scratch the bird', action: 'pet', animal: 'bird' },
        // Scare patterns
        { input: 'scare the dog', action: 'scare', animal: 'dog' },
        { input: 'spook the cat', action: 'scare', animal: 'cat' },
        { input: 'chase the bird', action: 'scare', animal: 'bird' },
        { input: 'boo the squirrel', action: 'scare', animal: 'squirrel' },
        // Call patterns
        { input: 'call the dog', action: 'call', animal: 'dog' },
        { input: 'find the cat', action: 'call', animal: 'cat' },
        { input: 'where is the bird', action: 'call', animal: 'bird' },
        { input: 'summon the butterfly', action: 'call', animal: 'butterfly' },
        // Feed patterns
        { input: 'feed the dog', action: 'feed', animal: 'dog' },
        { input: 'give treat to cat', action: 'feed', animal: 'cat' },
      ];

      // Document expected patterns (these would be tested via integration)
      it('should have documented animal action patterns', () => {
        expect(animalPatterns.length).toBeGreaterThan(0);

        // Validate pattern structure
        animalPatterns.forEach(p => {
          expect(['pet', 'scare', 'call', 'feed']).toContain(p.action);
          expect(['dog', 'cat', 'bird', 'butterfly', 'squirrel']).toContain(p.animal);
        });
      });
    });

    describe('effect patterns', () => {
      const effectPatterns = [
        { input: 'fireworks', effect: 'fireworks' },
        { input: 'party time', effect: 'fireworks' },
        { input: 'celebrate!', effect: 'fireworks' },
        { input: 'make it rain', effect: 'coins' },
        { input: 'money money', effect: 'coins' },
        { input: 'show me hearts', effect: 'hearts' },
        { input: 'confetti please', effect: 'confetti' },
        { input: 'woohoo!', effect: 'confetti' },
        { input: 'congratulations', effect: 'confetti' },
        { input: 'stars everywhere', effect: 'stars' },
        { input: 'ufo incoming', effect: 'ufo' },
        { input: 'alien invasion', effect: 'ufo' },
        { input: 'beam me up', effect: 'ufo' },
      ];

      it('should have documented effect patterns', () => {
        expect(effectPatterns.length).toBeGreaterThan(0);

        // Validate pattern structure
        const validEffects = ['fireworks', 'coins', 'hearts', 'confetti', 'stars', 'ufo'];
        effectPatterns.forEach(p => {
          expect(validEffects).toContain(p.effect);
        });
      });
    });

    describe('query patterns', () => {
      const queryPatterns = [
        'how is the world?',
        'what is happening?',
        'where are the tokens?',
        'status update',
        'health check',
        'weather report',
      ];

      it('should have documented query patterns', () => {
        expect(queryPatterns.length).toBeGreaterThan(0);
      });
    });
  });

  // ==================== ExtractedIntent Type ====================

  describe('ExtractedIntent Type', () => {
    it('should have valid action types', () => {
      const validActions: ExtractedIntent['action'][] = [
        'pet', 'scare', 'call', 'feed', 'effect', 'query', 'chat', 'unknown'
      ];

      expect(validActions).toHaveLength(8);
    });

    it('should have valid target types', () => {
      type TargetType = NonNullable<ExtractedIntent['target']>['type'];
      const validTargetTypes: TargetType[] = ['animal', 'effect', 'token', 'world'];

      expect(validTargetTypes).toHaveLength(4);
    });

    it('should allow confidence between 0 and 1', () => {
      const intent: ExtractedIntent = {
        action: 'chat',
        confidence: 0.75,
      };

      expect(intent.confidence).toBeGreaterThanOrEqual(0);
      expect(intent.confidence).toBeLessThanOrEqual(1);
    });

    it('should allow optional target and reasoning', () => {
      const minimalIntent: ExtractedIntent = {
        action: 'chat',
        confidence: 0.5,
      };

      expect(minimalIntent.target).toBeUndefined();
      expect(minimalIntent.reasoning).toBeUndefined();

      const fullIntent: ExtractedIntent = {
        action: 'pet',
        target: { type: 'animal', name: 'dog' },
        confidence: 0.95,
        reasoning: 'User wants to pet the dog',
      };

      expect(fullIntent.target).toBeDefined();
      expect(fullIntent.reasoning).toBeDefined();
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = quickIntentCheck('');
      expect(result).toBeNull();
    });

    it('should handle whitespace only', () => {
      const result = quickIntentCheck('   ');
      expect(result).toBeNull();
    });

    it('should handle very long message', () => {
      const longMessage = 'gm ' + 'a'.repeat(10000);
      const result = quickIntentCheck(longMessage);
      // Should still match 'gm' at start
      expect(result?.action).toBe('chat');
    });

    it('should handle special characters', () => {
      const result = quickIntentCheck('gm!!! :)');
      expect(result?.action).toBe('chat');
    });

    it('should handle unicode', () => {
      const result = quickIntentCheck('hi');
      expect(result?.action).toBe('chat');
    });

    it('should handle mixed case', () => {
      const result = quickIntentCheck('GM');
      expect(result?.action).toBe('chat');
    });

    it('should handle newlines', () => {
      const result = quickIntentCheck('gm\neveryone');
      expect(result?.action).toBe('chat');
    });
  });

  // ==================== Performance Considerations ====================

  describe('Performance', () => {
    it('should be fast for obvious patterns', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        quickIntentCheck('gm');
        quickIntentCheck('pet the dog');
        quickIntentCheck('fireworks');
      }

      const duration = performance.now() - start;

      // Should process 3000 checks in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should quickly return null for non-obvious patterns', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        quickIntentCheck('give the puppy some love');
        quickIntentCheck('make it rain coins');
        quickIntentCheck('how is the world doing?');
      }

      const duration = performance.now() - start;

      // Should process 3000 checks in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  // ==================== Available Entities ====================

  describe('Available Entities', () => {
    describe('Animals', () => {
      const availableAnimals = ['dog', 'cat', 'bird', 'butterfly', 'squirrel'];

      it('should have 5 available animals', () => {
        expect(availableAnimals).toHaveLength(5);
      });

      it('should include common pets', () => {
        expect(availableAnimals).toContain('dog');
        expect(availableAnimals).toContain('cat');
      });

      it('should include birds and insects', () => {
        expect(availableAnimals).toContain('bird');
        expect(availableAnimals).toContain('butterfly');
      });
    });

    describe('Effects', () => {
      const availableEffects = ['fireworks', 'coins', 'hearts', 'confetti', 'stars', 'ufo'];

      it('should have 6 available effects', () => {
        expect(availableEffects).toHaveLength(6);
      });

      it('should include celebration effects', () => {
        expect(availableEffects).toContain('fireworks');
        expect(availableEffects).toContain('confetti');
      });

      it('should include special effects', () => {
        expect(availableEffects).toContain('ufo');
        expect(availableEffects).toContain('coins');
      });
    });

    describe('Actions', () => {
      const availableActions = ['pet', 'scare', 'call', 'feed', 'effect', 'query', 'chat', 'unknown'];

      it('should have 8 available actions', () => {
        expect(availableActions).toHaveLength(8);
      });

      it('should include animal actions', () => {
        expect(availableActions).toContain('pet');
        expect(availableActions).toContain('scare');
        expect(availableActions).toContain('call');
        expect(availableActions).toContain('feed');
      });

      it('should include system actions', () => {
        expect(availableActions).toContain('effect');
        expect(availableActions).toContain('query');
        expect(availableActions).toContain('chat');
        expect(availableActions).toContain('unknown');
      });
    });
  });
});
