import { describe, it, expect } from 'vitest';
import {
  getCharacterResponse,
  CHARACTER_INTROS,
  CHARACTER_OUTROS,
} from './responses.js';

describe('getCharacterResponse', () => {
  const mockResponses = {
    toly: 'gm ser, this is the Toly response',
    finn: 'Finn here with the bags.fm way',
    ash: 'Pokemon trainer response!',
    ghost: 'Verifiable on solscan',
    neo: 'Matrix vision activated',
    cj: 'Keeping it real homie',
    shaw: 'Agent architecture response',
    'bags-bot': 'LFG response',
  };

  const defaultResponse = 'Default fallback response';

  // Happy path
  it('returns character-specific response for known characters', () => {
    expect(getCharacterResponse('toly', mockResponses, defaultResponse))
      .toBe('gm ser, this is the Toly response');
    expect(getCharacterResponse('finn', mockResponses, defaultResponse))
      .toBe('Finn here with the bags.fm way');
    expect(getCharacterResponse('ash', mockResponses, defaultResponse))
      .toBe('Pokemon trainer response!');
    expect(getCharacterResponse('ghost', mockResponses, defaultResponse))
      .toBe('Verifiable on solscan');
    expect(getCharacterResponse('neo', mockResponses, defaultResponse))
      .toBe('Matrix vision activated');
    expect(getCharacterResponse('cj', mockResponses, defaultResponse))
      .toBe('Keeping it real homie');
    expect(getCharacterResponse('shaw', mockResponses, defaultResponse))
      .toBe('Agent architecture response');
    expect(getCharacterResponse('bags-bot', mockResponses, defaultResponse))
      .toBe('LFG response');
  });

  // Case insensitivity
  it('is case-insensitive for character names', () => {
    expect(getCharacterResponse('TOLY', mockResponses, defaultResponse))
      .toBe('gm ser, this is the Toly response');
    expect(getCharacterResponse('Finn', mockResponses, defaultResponse))
      .toBe('Finn here with the bags.fm way');
    expect(getCharacterResponse('ASH', mockResponses, defaultResponse))
      .toBe('Pokemon trainer response!');
    expect(getCharacterResponse('GhOsT', mockResponses, defaultResponse))
      .toBe('Verifiable on solscan');
  });

  // Edge cases
  it('returns default for unknown characters', () => {
    expect(getCharacterResponse('unknown', mockResponses, defaultResponse))
      .toBe('Default fallback response');
    expect(getCharacterResponse('random', mockResponses, defaultResponse))
      .toBe('Default fallback response');
  });

  it('returns default for empty character name', () => {
    expect(getCharacterResponse('', mockResponses, defaultResponse))
      .toBe('Default fallback response');
  });

  it('returns default when responses object has no match', () => {
    const emptyResponses = {};
    expect(getCharacterResponse('toly', emptyResponses, defaultResponse))
      .toBe('Default fallback response');
  });

  it('handles undefined response value', () => {
    const partialResponses = { toly: undefined as unknown as string };
    expect(getCharacterResponse('toly', partialResponses, defaultResponse))
      .toBe('Default fallback response');
  });
});

describe('CHARACTER_INTROS', () => {
  it('contains all main characters', () => {
    expect(CHARACTER_INTROS).toHaveProperty('toly');
    expect(CHARACTER_INTROS).toHaveProperty('finn');
    expect(CHARACTER_INTROS).toHaveProperty('ash');
    expect(CHARACTER_INTROS).toHaveProperty('ghost');
    expect(CHARACTER_INTROS).toHaveProperty('neo');
    expect(CHARACTER_INTROS).toHaveProperty('cj');
    expect(CHARACTER_INTROS).toHaveProperty('shaw');
    expect(CHARACTER_INTROS).toHaveProperty('bags-bot');
    expect(CHARACTER_INTROS).toHaveProperty('bagsbot');
  });

  it('has expected intro styles', () => {
    expect(CHARACTER_INTROS.toly).toBe('gm ser,');
    expect(CHARACTER_INTROS.neo).toBe('*scanning*');
    expect(CHARACTER_INTROS.cj).toBe('aight check it,');
  });

  it('allows empty intros for some characters', () => {
    expect(CHARACTER_INTROS.finn).toBe('');
    expect(CHARACTER_INTROS.ash).toBe('');
    expect(CHARACTER_INTROS.ghost).toBe('');
    expect(CHARACTER_INTROS.shaw).toBe('');
  });
});

describe('CHARACTER_OUTROS', () => {
  it('contains all main characters', () => {
    expect(CHARACTER_OUTROS).toHaveProperty('toly');
    expect(CHARACTER_OUTROS).toHaveProperty('finn');
    expect(CHARACTER_OUTROS).toHaveProperty('ash');
    expect(CHARACTER_OUTROS).toHaveProperty('ghost');
    expect(CHARACTER_OUTROS).toHaveProperty('neo');
    expect(CHARACTER_OUTROS).toHaveProperty('cj');
    expect(CHARACTER_OUTROS).toHaveProperty('shaw');
    expect(CHARACTER_OUTROS).toHaveProperty('bags-bot');
    expect(CHARACTER_OUTROS).toHaveProperty('bagsbot');
  });

  it('has expected outro styles', () => {
    expect(CHARACTER_OUTROS.toly).toBe('all settled on solana.');
    expect(CHARACTER_OUTROS.finn).toBe("that's the bags.fm way.");
    expect(CHARACTER_OUTROS.ash).toBe('gotta catch em all!');
    expect(CHARACTER_OUTROS.ghost).toBe('check solscan to verify.');
    expect(CHARACTER_OUTROS.neo).toBe('the code never lies.');
    expect(CHARACTER_OUTROS.cj).toBe('stack or get stacked on homie.');
    expect(CHARACTER_OUTROS['bags-bot']).toBe('lfg!');
    expect(CHARACTER_OUTROS.bagsbot).toBe('lfg!');
  });

  it('allows empty outros for some characters', () => {
    expect(CHARACTER_OUTROS.shaw).toBe('');
  });
});

describe('Character response integration', () => {
  it('can combine intro + response + outro pattern', () => {
    const responses = {
      toly: 'here is the analysis:',
      finn: 'the flywheel is spinning',
    };

    const getFullResponse = (name: string, content: string) => {
      const intro = CHARACTER_INTROS[name] || '';
      const outro = CHARACTER_OUTROS[name] || '';
      const parts = [intro, content, outro].filter(Boolean);
      return parts.join(' ');
    };

    expect(getFullResponse('toly', 'SOL is pumping'))
      .toBe('gm ser, SOL is pumping all settled on solana.');

    expect(getFullResponse('finn', 'creators are earning'))
      .toBe("creators are earning that's the bags.fm way.");

    expect(getFullResponse('neo', 'pattern detected'))
      .toBe('*scanning* pattern detected the code never lies.');
  });
});
