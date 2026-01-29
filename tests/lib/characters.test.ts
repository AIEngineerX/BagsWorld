// Comprehensive tests for src/lib/characters.ts
// Tests the lightweight character registry used by API routes

import {
  Character,
  CharacterStyle,
  neoCharacter,
  cjCharacter,
  finnCharacter,
  bagsBotCharacter,
  tolyCharacter,
  ashCharacter,
  shawCharacter,
  ghostCharacter,
  characters,
  allCharacters,
  getCharacter,
  getCharacterIds,
  getCharacterDisplayName,
} from '@/lib/characters';

describe('Character Registry', () => {
  // ==================== Character Definitions ====================

  describe('Character Definitions', () => {
    const allCharacterDefs = [
      { name: 'neoCharacter', char: neoCharacter },
      { name: 'cjCharacter', char: cjCharacter },
      { name: 'finnCharacter', char: finnCharacter },
      { name: 'bagsBotCharacter', char: bagsBotCharacter },
      { name: 'tolyCharacter', char: tolyCharacter },
      { name: 'ashCharacter', char: ashCharacter },
      { name: 'shawCharacter', char: shawCharacter },
      { name: 'ghostCharacter', char: ghostCharacter },
    ];

    describe.each(allCharacterDefs)('$name', ({ char }) => {
      it('should have a name', () => {
        expect(char.name).toBeDefined();
        expect(typeof char.name).toBe('string');
        expect(char.name.length).toBeGreaterThan(0);
      });

      it('should have a username', () => {
        expect(char.username).toBeDefined();
        expect(typeof char.username).toBe('string');
      });

      it('should have a system prompt', () => {
        expect(char.system).toBeDefined();
        expect(typeof char.system).toBe('string');
        expect(char.system!.length).toBeGreaterThan(50);
      });

      it('should have bio as string or array', () => {
        expect(char.bio).toBeDefined();
        if (Array.isArray(char.bio)) {
          expect(char.bio.length).toBeGreaterThan(0);
          char.bio.forEach(b => expect(typeof b).toBe('string'));
        } else {
          expect(typeof char.bio).toBe('string');
        }
      });

      it('should have style with all array', () => {
        expect(char.style).toBeDefined();
        expect(char.style!.all).toBeDefined();
        expect(Array.isArray(char.style!.all)).toBe(true);
        expect(char.style!.all!.length).toBeGreaterThan(0);
      });
    });

    it('should have unique names for all characters', () => {
      const names = allCharacterDefs.map(c => c.char.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have unique usernames for all characters', () => {
      const usernames = allCharacterDefs.map(c => c.char.username);
      const uniqueUsernames = new Set(usernames);
      expect(uniqueUsernames.size).toBe(usernames.length);
    });
  });

  // ==================== Specific Character Content ====================

  describe('Neo Character', () => {
    it('should have chain scanner identity', () => {
      expect(neoCharacter.name).toBe('Neo');
      expect(neoCharacter.system).toContain('chain scanner');
    });

    it('should have cryptic speech patterns', () => {
      expect(neoCharacter.style?.all).toContain('cryptic but not unhelpful');
      expect(neoCharacter.style?.all).toContain('uses lowercase mostly');
    });

    it('should mention patterns and signals', () => {
      expect(neoCharacter.system).toContain('patterns');
      expect(neoCharacter.system).toContain('signals');
    });
  });

  describe('CJ Character', () => {
    it('should have community vibes identity', () => {
      expect(cjCharacter.name).toBe('CJ');
      expect(cjCharacter.system).toContain('community vibes');
    });

    it('should use slang naturally', () => {
      expect(cjCharacter.style?.all).toContain('uses slang naturally - yo, fam, fr fr');
    });
  });

  describe('Finn Character', () => {
    it('should be CEO of Bags.fm', () => {
      expect(finnCharacter.name).toBe('Finn');
      expect(finnCharacter.system).toContain('CEO');
      expect(finnCharacter.system).toContain('Bags.fm');
    });

    it('should know fee structure', () => {
      expect(finnCharacter.system).toContain('fee sharing');
    });
  });

  describe('Bags Bot Character', () => {
    it('should be the default guide', () => {
      expect(bagsBotCharacter.name).toBe('Bags Bot');
      expect(bagsBotCharacter.system).toContain('default assistant');
    });

    it('should know about other agents', () => {
      expect(bagsBotCharacter.system).toContain('Neo');
      expect(bagsBotCharacter.system).toContain('CJ');
      expect(bagsBotCharacter.system).toContain('Finn');
      expect(bagsBotCharacter.system).toContain('Ash');
      expect(bagsBotCharacter.system).toContain('Toly');
      expect(bagsBotCharacter.system).toContain('Shaw');
      expect(bagsBotCharacter.system).toContain('Ghost');
    });
  });

  describe('Toly Character', () => {
    it('should be Solana co-founder', () => {
      expect(tolyCharacter.name).toBe('Toly');
      expect(tolyCharacter.username).toBe('aeyakovenko');
      expect(tolyCharacter.system).toContain('Solana');
      expect(tolyCharacter.system).toContain('co-founder');
    });

    it('should know Proof of History', () => {
      expect(tolyCharacter.system).toContain('Proof of History');
    });
  });

  describe('Ash Character', () => {
    it('should be ecosystem guide with Pokemon inspiration', () => {
      expect(ashCharacter.name).toBe('Ash');
      expect(ashCharacter.system).toContain('Pokemon');
      expect(ashCharacter.system).toContain('evolution');
    });
  });

  describe('Shaw Character', () => {
    it('should be ElizaOS creator', () => {
      expect(shawCharacter.name).toBe('Shaw');
      expect(shawCharacter.username).toBe('shawmakesmagic');
      expect(shawCharacter.system).toContain('ElizaOS');
    });

    it('should know about multi-agent systems', () => {
      expect(shawCharacter.system).toContain('multi-agent');
    });
  });

  describe('Ghost Character', () => {
    it('should be BagsWorld developer', () => {
      expect(ghostCharacter.name).toBe('Ghost');
      expect(ghostCharacter.username).toBe('DaddyGhost');
      expect(ghostCharacter.system).toContain('Built BagsWorld');
      expect(ghostCharacter.system).toContain('community fund');
    });

    it('should be technical and on-chain focused', () => {
      expect(ghostCharacter.style?.all).toContain('everything on-chain');
      expect(ghostCharacter.style?.all).toContain('ships code not promises');
    });
  });

  // ==================== Characters Registry ====================

  describe('characters registry', () => {
    it('should contain all 8 main characters', () => {
      expect(characters['neo']).toBe(neoCharacter);
      expect(characters['cj']).toBe(cjCharacter);
      expect(characters['finn']).toBe(finnCharacter);
      expect(characters['bags-bot']).toBe(bagsBotCharacter);
      expect(characters['toly']).toBe(tolyCharacter);
      expect(characters['ash']).toBe(ashCharacter);
      expect(characters['shaw']).toBe(shawCharacter);
      expect(characters['ghost']).toBe(ghostCharacter);
    });

    it('should have alias bagsbot for bags-bot', () => {
      expect(characters['bagsbot']).toBe(bagsBotCharacter);
    });

    it('should have alias dev for ghost', () => {
      expect(characters['dev']).toBe(ghostCharacter);
    });

    it('should have 10 entries (8 characters + 2 aliases)', () => {
      expect(Object.keys(characters).length).toBe(10);
    });
  });

  // ==================== allCharacters Array ====================

  describe('allCharacters array', () => {
    it('should contain 8 characters', () => {
      expect(allCharacters.length).toBe(8);
    });

    it('should contain all character definitions', () => {
      expect(allCharacters).toContain(bagsBotCharacter);
      expect(allCharacters).toContain(neoCharacter);
      expect(allCharacters).toContain(cjCharacter);
      expect(allCharacters).toContain(finnCharacter);
      expect(allCharacters).toContain(tolyCharacter);
      expect(allCharacters).toContain(ashCharacter);
      expect(allCharacters).toContain(shawCharacter);
      expect(allCharacters).toContain(ghostCharacter);
    });

    it('should have BagsBot first (default guide)', () => {
      expect(allCharacters[0]).toBe(bagsBotCharacter);
    });

    it('should not contain duplicate references', () => {
      const uniqueChars = new Set(allCharacters);
      expect(uniqueChars.size).toBe(allCharacters.length);
    });
  });

  // ==================== getCharacter Function ====================

  describe('getCharacter', () => {
    describe('exact match lookups', () => {
      it('should find neo', () => {
        const char = getCharacter('neo');
        expect(char).toBe(neoCharacter);
      });

      it('should find cj', () => {
        const char = getCharacter('cj');
        expect(char).toBe(cjCharacter);
      });

      it('should find finn', () => {
        const char = getCharacter('finn');
        expect(char).toBe(finnCharacter);
      });

      it('should find bags-bot', () => {
        const char = getCharacter('bags-bot');
        expect(char).toBe(bagsBotCharacter);
      });

      it('should find toly', () => {
        const char = getCharacter('toly');
        expect(char).toBe(tolyCharacter);
      });

      it('should find ash', () => {
        const char = getCharacter('ash');
        expect(char).toBe(ashCharacter);
      });

      it('should find shaw', () => {
        const char = getCharacter('shaw');
        expect(char).toBe(shawCharacter);
      });

      it('should find ghost', () => {
        const char = getCharacter('ghost');
        expect(char).toBe(ghostCharacter);
      });
    });

    describe('case insensitivity', () => {
      it('should find NEO (uppercase)', () => {
        expect(getCharacter('NEO')).toBe(neoCharacter);
      });

      it('should find Neo (mixed case)', () => {
        expect(getCharacter('Neo')).toBe(neoCharacter);
      });

      it('should find BAGS-BOT (uppercase with hyphen)', () => {
        expect(getCharacter('BAGS-BOT')).toBe(bagsBotCharacter);
      });

      it('should find Toly (capitalized)', () => {
        expect(getCharacter('Toly')).toBe(tolyCharacter);
      });

      it('should find SHAW (uppercase)', () => {
        expect(getCharacter('SHAW')).toBe(shawCharacter);
      });
    });

    describe('alias lookups', () => {
      it('should find bagsbot (without hyphen)', () => {
        expect(getCharacter('bagsbot')).toBe(bagsBotCharacter);
      });

      it('should find dev (alias for ghost)', () => {
        expect(getCharacter('dev')).toBe(ghostCharacter);
      });

      it('should find DEV (uppercase alias)', () => {
        expect(getCharacter('DEV')).toBe(ghostCharacter);
      });
    });

    describe('normalization (spaces and underscores)', () => {
      it('should normalize spaces to hyphens', () => {
        expect(getCharacter('bags bot')).toBe(bagsBotCharacter);
      });

      it('should normalize underscores to hyphens', () => {
        expect(getCharacter('bags_bot')).toBe(bagsBotCharacter);
      });

      it('should handle mixed spaces and underscores', () => {
        expect(getCharacter('bags_bot')).toBe(bagsBotCharacter);
      });
    });

    describe('invalid inputs', () => {
      it('should return undefined for unknown character', () => {
        expect(getCharacter('unknown')).toBeUndefined();
      });

      it('should return undefined for empty string', () => {
        expect(getCharacter('')).toBeUndefined();
      });

      it('should return undefined for whitespace only', () => {
        expect(getCharacter('   ')).toBeUndefined();
      });

      it('should return undefined for numbers', () => {
        expect(getCharacter('123')).toBeUndefined();
      });

      it('should return undefined for special characters', () => {
        expect(getCharacter('!@#$')).toBeUndefined();
      });

      it('should return undefined for partial matches', () => {
        expect(getCharacter('ne')).toBeUndefined();
        expect(getCharacter('bag')).toBeUndefined();
      });

      it('should return undefined for typos', () => {
        expect(getCharacter('noe')).toBeUndefined();
        expect(getCharacter('fiin')).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle very long strings', () => {
        const longString = 'a'.repeat(1000);
        expect(getCharacter(longString)).toBeUndefined();
      });

      it('should handle unicode characters', () => {
        expect(getCharacter('n\u00e9o')).toBeUndefined(); // neo with accent
        expect(getCharacter('\u{1F600}')).toBeUndefined(); // emoji
      });

      it('should handle null-like strings', () => {
        expect(getCharacter('null')).toBeUndefined();
        expect(getCharacter('undefined')).toBeUndefined();
      });

      it('should handle injection attempts', () => {
        expect(getCharacter('neo; DROP TABLE')).toBeUndefined();
        expect(getCharacter('<script>alert(1)</script>')).toBeUndefined();
      });
    });
  });

  // ==================== getCharacterIds Function ====================

  describe('getCharacterIds', () => {
    it('should return array of 8 IDs', () => {
      const ids = getCharacterIds();
      expect(ids.length).toBe(8);
    });

    it('should return all main character IDs', () => {
      const ids = getCharacterIds();
      expect(ids).toContain('neo');
      expect(ids).toContain('cj');
      expect(ids).toContain('finn');
      expect(ids).toContain('bags-bot');
      expect(ids).toContain('toly');
      expect(ids).toContain('ash');
      expect(ids).toContain('shaw');
      expect(ids).toContain('ghost');
    });

    it('should NOT include aliases', () => {
      const ids = getCharacterIds();
      expect(ids).not.toContain('bagsbot');
      expect(ids).not.toContain('dev');
    });

    it('should return a new array each time (no mutation risk)', () => {
      const ids1 = getCharacterIds();
      const ids2 = getCharacterIds();
      expect(ids1).not.toBe(ids2);
      expect(ids1).toEqual(ids2);
    });

    it('should contain only lowercase IDs', () => {
      const ids = getCharacterIds();
      ids.forEach(id => {
        expect(id).toBe(id.toLowerCase());
      });
    });

    it('should all resolve to valid characters', () => {
      const ids = getCharacterIds();
      ids.forEach(id => {
        expect(getCharacter(id)).toBeDefined();
      });
    });
  });

  // ==================== getCharacterDisplayName Function ====================

  describe('getCharacterDisplayName', () => {
    describe('valid characters', () => {
      it('should return "Neo" for neo', () => {
        expect(getCharacterDisplayName('neo')).toBe('Neo');
      });

      it('should return "CJ" for cj', () => {
        expect(getCharacterDisplayName('cj')).toBe('CJ');
      });

      it('should return "Finn" for finn', () => {
        expect(getCharacterDisplayName('finn')).toBe('Finn');
      });

      it('should return "Bags Bot" for bags-bot', () => {
        expect(getCharacterDisplayName('bags-bot')).toBe('Bags Bot');
      });

      it('should return "Toly" for toly', () => {
        expect(getCharacterDisplayName('toly')).toBe('Toly');
      });

      it('should return "Ash" for ash', () => {
        expect(getCharacterDisplayName('ash')).toBe('Ash');
      });

      it('should return "Shaw" for shaw', () => {
        expect(getCharacterDisplayName('shaw')).toBe('Shaw');
      });

      it('should return "Ghost" for ghost', () => {
        expect(getCharacterDisplayName('ghost')).toBe('Ghost');
      });
    });

    describe('case insensitivity', () => {
      it('should handle uppercase input', () => {
        expect(getCharacterDisplayName('NEO')).toBe('Neo');
        expect(getCharacterDisplayName('FINN')).toBe('Finn');
      });

      it('should handle mixed case input', () => {
        expect(getCharacterDisplayName('Neo')).toBe('Neo');
        expect(getCharacterDisplayName('ToLy')).toBe('Toly');
      });
    });

    describe('aliases', () => {
      it('should return "Bags Bot" for bagsbot alias', () => {
        expect(getCharacterDisplayName('bagsbot')).toBe('Bags Bot');
      });

      it('should return "Ghost" for dev alias', () => {
        expect(getCharacterDisplayName('dev')).toBe('Ghost');
      });
    });

    describe('invalid characters (fallback)', () => {
      it('should return input ID for unknown character', () => {
        expect(getCharacterDisplayName('unknown')).toBe('unknown');
      });

      it('should return empty string for empty input', () => {
        expect(getCharacterDisplayName('')).toBe('');
      });

      it('should return input for any invalid string', () => {
        expect(getCharacterDisplayName('invalid-agent')).toBe('invalid-agent');
        expect(getCharacterDisplayName('test123')).toBe('test123');
      });
    });
  });

  // ==================== Type Safety ====================

  describe('Type Safety', () => {
    it('should have Character interface with required fields', () => {
      const testChar: Character = {
        name: 'Test',
      };
      expect(testChar.name).toBe('Test');
    });

    it('should allow optional fields in Character', () => {
      const fullChar: Character = {
        name: 'Full',
        username: 'fulluser',
        system: 'system prompt',
        bio: ['bio line 1', 'bio line 2'],
        style: {
          all: ['style 1'],
          chat: ['chat style'],
          post: ['post style'],
        },
      };
      expect(fullChar.style?.chat).toContain('chat style');
      expect(fullChar.style?.post).toContain('post style');
    });

    it('should allow bio as string', () => {
      const charWithStringBio: Character = {
        name: 'StringBio',
        bio: 'This is a string bio',
      };
      expect(typeof charWithStringBio.bio).toBe('string');
    });

    it('should allow bio as array', () => {
      const charWithArrayBio: Character = {
        name: 'ArrayBio',
        bio: ['line 1', 'line 2'],
      };
      expect(Array.isArray(charWithArrayBio.bio)).toBe(true);
    });
  });

  // ==================== Integration Tests ====================

  describe('Integration', () => {
    it('should be able to iterate over all characters and get display names', () => {
      const ids = getCharacterIds();
      const names = ids.map(id => getCharacterDisplayName(id));

      expect(names).toContain('Neo');
      expect(names).toContain('CJ');
      expect(names).toContain('Finn');
      expect(names).toContain('Bags Bot');
      expect(names).toContain('Toly');
      expect(names).toContain('Ash');
      expect(names).toContain('Shaw');
      expect(names).toContain('Ghost');
    });

    it('should be able to get all character system prompts', () => {
      const ids = getCharacterIds();
      const systemPrompts = ids.map(id => {
        const char = getCharacter(id);
        return char?.system;
      });

      systemPrompts.forEach(prompt => {
        expect(prompt).toBeDefined();
        expect(prompt!.length).toBeGreaterThan(0);
      });
    });

    it('should be able to build a character selection menu', () => {
      const ids = getCharacterIds();
      const menu = ids.map(id => {
        const char = getCharacter(id);
        return {
          id,
          name: char?.name,
          description: Array.isArray(char?.bio) ? char?.bio[0] : char?.bio,
        };
      });

      expect(menu.length).toBe(8);
      menu.forEach(item => {
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.description).toBeDefined();
      });
    });

    it('allCharacters should match characters from getCharacterIds', () => {
      const idsFromFunction = getCharacterIds();
      const charsFromArray = allCharacters.map(c => c.name);
      const charsFromIds = idsFromFunction.map(id => getCharacter(id)?.name);

      // Both should have same names (order may differ)
      expect(new Set(charsFromArray)).toEqual(new Set(charsFromIds));
    });
  });
});
