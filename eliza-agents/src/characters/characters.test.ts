// Character validation tests
// Tests all characters have required fields and validates lookup functions

import { describe, it, expect } from 'vitest';
import {
  characters,
  allCharacters,
  getCharacter,
  getCharacterIds,
  getCharacterDisplayName,
  isValidCharacterId,
  tolyCharacter,
  finnCharacter,
  ashCharacter,
  ghostCharacter,
  neoCharacter,
  cjCharacter,
  shawCharacter,
  bagsBotCharacter,
} from './index.js';

describe('Character Registry', () => {
  describe('allCharacters array', () => {
    it('contains all 8 unique characters', () => {
      expect(allCharacters).toHaveLength(8);
    });

    it('has bagsBotCharacter first (main guide)', () => {
      expect(allCharacters[0]).toBe(bagsBotCharacter);
    });

    it('contains all expected characters', () => {
      const names = allCharacters.map(c => c.name);
      expect(names).toContain('Toly');
      expect(names).toContain('Finn');
      expect(names).toContain('Ash');
      expect(names).toContain('Ghost');
      expect(names).toContain('Neo');
      expect(names).toContain('CJ');
      expect(names).toContain('Shaw');
      expect(names).toContain('Bags Bot');
    });
  });

  describe('characters record', () => {
    it('has 10 entries (8 characters + 2 aliases)', () => {
      expect(Object.keys(characters)).toHaveLength(10);
    });

    it('includes aliases for bagsbot and dev', () => {
      expect(characters['bags-bot']).toBe(bagsBotCharacter);
      expect(characters['bagsbot']).toBe(bagsBotCharacter);
      expect(characters['ghost']).toBe(ghostCharacter);
      expect(characters['dev']).toBe(ghostCharacter);
    });
  });

  describe('getCharacter', () => {
    it('returns character for valid ID', () => {
      expect(getCharacter('toly')).toBe(tolyCharacter);
      expect(getCharacter('finn')).toBe(finnCharacter);
      expect(getCharacter('ash')).toBe(ashCharacter);
    });

    it('is case-insensitive', () => {
      expect(getCharacter('TOLY')).toBe(tolyCharacter);
      expect(getCharacter('Finn')).toBe(finnCharacter);
      expect(getCharacter('ASH')).toBe(ashCharacter);
    });

    it('normalizes underscores and spaces to hyphens', () => {
      expect(getCharacter('bags_bot')).toBe(bagsBotCharacter);
      expect(getCharacter('bags bot')).toBe(bagsBotCharacter);
    });

    it('returns undefined for invalid ID', () => {
      expect(getCharacter('invalid')).toBeUndefined();
      expect(getCharacter('')).toBeUndefined();
      expect(getCharacter('nonexistent')).toBeUndefined();
    });

    it('handles special characters gracefully', () => {
      expect(getCharacter('toly!')).toBeUndefined();
      expect(getCharacter('toly@test')).toBeUndefined();
    });
  });

  describe('getCharacterIds', () => {
    it('returns 8 primary character IDs', () => {
      const ids = getCharacterIds();
      expect(ids).toHaveLength(8);
    });

    it('excludes aliases', () => {
      const ids = getCharacterIds();
      expect(ids).not.toContain('bagsbot');
      expect(ids).not.toContain('dev');
    });

    it('includes all primary IDs', () => {
      const ids = getCharacterIds();
      expect(ids).toContain('toly');
      expect(ids).toContain('finn');
      expect(ids).toContain('ash');
      expect(ids).toContain('ghost');
      expect(ids).toContain('neo');
      expect(ids).toContain('cj');
      expect(ids).toContain('shaw');
      expect(ids).toContain('bags-bot');
    });
  });

  describe('getCharacterDisplayName', () => {
    it('returns character name for valid ID', () => {
      expect(getCharacterDisplayName('toly')).toBe('Toly');
      expect(getCharacterDisplayName('finn')).toBe('Finn');
      expect(getCharacterDisplayName('ghost')).toBe('Ghost');
    });

    it('returns ID as fallback for invalid character', () => {
      expect(getCharacterDisplayName('invalid')).toBe('invalid');
    });
  });

  describe('isValidCharacterId', () => {
    it('returns true for valid IDs', () => {
      expect(isValidCharacterId('toly')).toBe(true);
      expect(isValidCharacterId('finn')).toBe(true);
      expect(isValidCharacterId('bags-bot')).toBe(true);
    });

    it('returns true for aliases', () => {
      expect(isValidCharacterId('bagsbot')).toBe(true);
      expect(isValidCharacterId('dev')).toBe(true);
    });

    it('returns false for invalid IDs', () => {
      expect(isValidCharacterId('invalid')).toBe(false);
      expect(isValidCharacterId('')).toBe(false);
      expect(isValidCharacterId('nonexistent')).toBe(false);
    });
  });
});

describe('Character Structure Validation', () => {
  const requiredFields = ['name', 'system', 'bio', 'topics', 'adjectives', 'messageExamples', 'style'];

  describe.each(allCharacters)('$name character', (character) => {
    it('has name property', () => {
      expect(character.name).toBeDefined();
      expect(typeof character.name).toBe('string');
      expect(character.name.length).toBeGreaterThan(0);
    });

    it('has system prompt', () => {
      expect(character.system).toBeDefined();
      expect(typeof character.system).toBe('string');
      expect(character.system!.length).toBeGreaterThan(50); // Meaningful system prompt
    });

    it('has bio array', () => {
      expect(character.bio).toBeDefined();
      expect(Array.isArray(character.bio)).toBe(true);
      expect((character.bio as string[]).length).toBeGreaterThan(0);
    });

    it('has topics array', () => {
      expect(character.topics).toBeDefined();
      expect(Array.isArray(character.topics)).toBe(true);
      expect(character.topics!.length).toBeGreaterThan(0);
    });

    it('has adjectives array', () => {
      expect(character.adjectives).toBeDefined();
      expect(Array.isArray(character.adjectives)).toBe(true);
      expect(character.adjectives!.length).toBeGreaterThan(0);
    });

    it('has messageExamples array', () => {
      expect(character.messageExamples).toBeDefined();
      expect(Array.isArray(character.messageExamples)).toBe(true);
      expect(character.messageExamples!.length).toBeGreaterThan(0);
    });

    it('has style object with all and chat', () => {
      expect(character.style).toBeDefined();
      expect(character.style!.all).toBeDefined();
      expect(Array.isArray(character.style!.all)).toBe(true);
      expect(character.style!.chat).toBeDefined();
      expect(Array.isArray(character.style!.chat)).toBe(true);
    });

    it('has valid model setting', () => {
      // Model is optional but if present should be valid
      if (character.settings?.model) {
        expect(typeof character.settings.model).toBe('string');
        expect(character.settings.model.length).toBeGreaterThan(0);
      }
    });

    it('messageExamples have valid structure', () => {
      character.messageExamples!.forEach((example, index) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBeGreaterThanOrEqual(2);

        example.forEach((message, msgIndex) => {
          expect(message.name).toBeDefined();
          expect(message.content).toBeDefined();
          expect(message.content.text).toBeDefined();
        });
      });
    });
  });
});

describe('Individual Character Exports', () => {
  it('exports tolyCharacter', () => {
    expect(tolyCharacter).toBeDefined();
    expect(tolyCharacter.name).toBe('Toly');
  });

  it('exports finnCharacter', () => {
    expect(finnCharacter).toBeDefined();
    expect(finnCharacter.name).toBe('Finn');
  });

  it('exports ashCharacter', () => {
    expect(ashCharacter).toBeDefined();
    expect(ashCharacter.name).toBe('Ash');
  });

  it('exports ghostCharacter', () => {
    expect(ghostCharacter).toBeDefined();
    expect(ghostCharacter.name).toBe('Ghost');
  });

  it('exports neoCharacter', () => {
    expect(neoCharacter).toBeDefined();
    expect(neoCharacter.name).toBe('Neo');
  });

  it('exports cjCharacter', () => {
    expect(cjCharacter).toBeDefined();
    expect(cjCharacter.name).toBe('CJ');
  });

  it('exports shawCharacter', () => {
    expect(shawCharacter).toBeDefined();
    expect(shawCharacter.name).toBe('Shaw');
  });

  it('exports bagsBotCharacter', () => {
    expect(bagsBotCharacter).toBeDefined();
    expect(bagsBotCharacter.name).toBe('Bags Bot');
  });
});

describe('Character Content Quality', () => {
  describe.each(allCharacters)('$name character content', (character) => {
    it('system prompt mentions character name or role', () => {
      const system = character.system!.toLowerCase();
      const nameLower = character.name.toLowerCase();
      // System should mention the character name or have clear role definition
      const hasName = system.includes(nameLower) || system.includes('you are');
      expect(hasName).toBe(true);
    });

    it('topics are unique', () => {
      const topics = character.topics!;
      const uniqueTopics = new Set(topics);
      expect(uniqueTopics.size).toBe(topics.length);
    });

    it('adjectives are unique', () => {
      const adjectives = character.adjectives!;
      const uniqueAdj = new Set(adjectives);
      expect(uniqueAdj.size).toBe(adjectives.length);
    });

    it('bio entries are non-empty strings', () => {
      (character.bio as string[]).forEach(entry => {
        expect(typeof entry).toBe('string');
        expect(entry.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
