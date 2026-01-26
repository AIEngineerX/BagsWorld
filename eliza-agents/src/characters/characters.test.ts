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
  // Core characters
  tolyCharacter,
  finnCharacter,
  ashCharacter,
  ghostCharacter,
  neoCharacter,
  cjCharacter,
  shawCharacter,
  bagsBotCharacter,
  // Academy characters
  alaaCharacter,
  bnnCharacter,
  carloCharacter,
  ramoCharacter,
  samCharacter,
  sincaraCharacter,
  stuuCharacter,
  professorOakCharacter,
} from './index.js';

describe('Character Registry', () => {
  describe('allCharacters array', () => {
    it('contains all 16 unique characters', () => {
      expect(allCharacters).toHaveLength(16);
    });

    it('has bagsBotCharacter first (main guide)', () => {
      expect(allCharacters[0]).toBe(bagsBotCharacter);
    });

    it('contains all expected characters', () => {
      const names = allCharacters.map(c => c.name);
      // Core characters
      expect(names).toContain('Toly');
      expect(names).toContain('Finn');
      expect(names).toContain('Ash');
      expect(names).toContain('Ghost');
      expect(names).toContain('Neo');
      expect(names).toContain('CJ');
      expect(names).toContain('Shaw');
      expect(names).toContain('Bags Bot');
      // Academy characters
      expect(names).toContain('Alaa');
      expect(names).toContain('BNN');
      expect(names).toContain('Carlo');
      expect(names).toContain('Ramo');
      expect(names).toContain('Sam');
      expect(names).toContain('Sincara');
      expect(names).toContain('Stuu');
      expect(names).toContain('Professor Oak');
    });
  });

  describe('characters record', () => {
    it('has 20 entries (16 characters + 4 aliases)', () => {
      expect(Object.keys(characters)).toHaveLength(20);
    });

    it('includes aliases for bagsbot and dev', () => {
      expect(characters['bags-bot']).toBe(bagsBotCharacter);
      expect(characters['bagsbot']).toBe(bagsBotCharacter);
      expect(characters['ghost']).toBe(ghostCharacter);
      expect(characters['dev']).toBe(ghostCharacter);
    });

    it('includes aliases for professor-oak', () => {
      expect(characters['professor-oak']).toBe(professorOakCharacter);
      expect(characters['professoroak']).toBe(professorOakCharacter);
      expect(characters['oak']).toBe(professorOakCharacter);
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
    it('returns 16 primary character IDs', () => {
      const ids = getCharacterIds();
      expect(ids).toHaveLength(16);
    });

    it('excludes aliases', () => {
      const ids = getCharacterIds();
      expect(ids).not.toContain('bagsbot');
      expect(ids).not.toContain('dev');
      expect(ids).not.toContain('professoroak');
      expect(ids).not.toContain('oak');
    });

    it('includes all primary IDs', () => {
      const ids = getCharacterIds();
      // Core
      expect(ids).toContain('toly');
      expect(ids).toContain('finn');
      expect(ids).toContain('ash');
      expect(ids).toContain('ghost');
      expect(ids).toContain('neo');
      expect(ids).toContain('cj');
      expect(ids).toContain('shaw');
      expect(ids).toContain('bags-bot');
      // Academy
      expect(ids).toContain('alaa');
      expect(ids).toContain('bnn');
      expect(ids).toContain('carlo');
      expect(ids).toContain('ramo');
      expect(ids).toContain('sam');
      expect(ids).toContain('sincara');
      expect(ids).toContain('stuu');
      expect(ids).toContain('professor-oak');
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

  // Academy character exports
  it('exports alaaCharacter', () => {
    expect(alaaCharacter).toBeDefined();
    expect(alaaCharacter.name).toBe('Alaa');
  });

  it('exports bnnCharacter', () => {
    expect(bnnCharacter).toBeDefined();
    expect(bnnCharacter.name).toBe('BNN');
  });

  it('exports carloCharacter', () => {
    expect(carloCharacter).toBeDefined();
    expect(carloCharacter.name).toBe('Carlo');
  });

  it('exports ramoCharacter', () => {
    expect(ramoCharacter).toBeDefined();
    expect(ramoCharacter.name).toBe('Ramo');
  });

  it('exports samCharacter', () => {
    expect(samCharacter).toBeDefined();
    expect(samCharacter.name).toBe('Sam');
  });

  it('exports sincaraCharacter', () => {
    expect(sincaraCharacter).toBeDefined();
    expect(sincaraCharacter.name).toBe('Sincara');
  });

  it('exports stuuCharacter', () => {
    expect(stuuCharacter).toBeDefined();
    expect(stuuCharacter.name).toBe('Stuu');
  });

  it('exports professorOakCharacter', () => {
    expect(professorOakCharacter).toBeDefined();
    expect(professorOakCharacter.name).toBe('Professor Oak');
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
