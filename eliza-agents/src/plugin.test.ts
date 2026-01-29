// Plugin initialization tests
// Tests plugin structure and init behavior

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bagsWorldPlugin, {
  allCharacters,
  characters,
  getCharacter,
  getCharacterIds,
  getCharacterDisplayName,
  isValidCharacterId,
} from './index.js';
import { allActions } from './actions/index.js';
import { allProviders } from './providers/index.js';
import type { IAgentRuntime } from './types/elizaos.js';

describe('bagsWorldPlugin', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  describe('plugin metadata', () => {
    it('has correct name', () => {
      expect(bagsWorldPlugin.name).toBe('@elizaos/plugin-bagsworld');
    });

    it('has description', () => {
      expect(bagsWorldPlugin.description).toBeDefined();
      expect(bagsWorldPlugin.description!.length).toBeGreaterThan(0);
    });

    it('description mentions key features', () => {
      const desc = bagsWorldPlugin.description!.toLowerCase();
      expect(desc).toContain('bags');
      expect(desc).toContain('oracle');
      expect(desc).toContain('prediction');
    });
  });

  describe('plugin structure', () => {
    it('exports actions array', () => {
      expect(bagsWorldPlugin.actions).toBeDefined();
      expect(Array.isArray(bagsWorldPlugin.actions)).toBe(true);
      expect(bagsWorldPlugin.actions!.length).toBeGreaterThan(0);
    });

    it('exports providers array', () => {
      expect(bagsWorldPlugin.providers).toBeDefined();
      expect(Array.isArray(bagsWorldPlugin.providers)).toBe(true);
      expect(bagsWorldPlugin.providers!.length).toBeGreaterThan(0);
    });

    it('exports services array', () => {
      expect(bagsWorldPlugin.services).toBeDefined();
      expect(Array.isArray(bagsWorldPlugin.services)).toBe(true);
      expect(bagsWorldPlugin.services!.length).toBe(2); // BagsApiService, LLMService
    });

    it('exports evaluators array', () => {
      expect(bagsWorldPlugin.evaluators).toBeDefined();
      expect(Array.isArray(bagsWorldPlugin.evaluators)).toBe(true);
      expect(bagsWorldPlugin.evaluators!.length).toBe(7);
    });

    it('has init function', () => {
      expect(bagsWorldPlugin.init).toBeDefined();
      expect(typeof bagsWorldPlugin.init).toBe('function');
    });
  });

  describe('init function', () => {
    const mockRuntime = {} as IAgentRuntime;

    it('initializes without error when API key is set', async () => {
      const config = { BAGS_API_KEY: 'test-key' };
      await expect(bagsWorldPlugin.init!(config, mockRuntime)).resolves.toBeUndefined();
    });

    it('initializes without error when API key is missing', async () => {
      const config = {};
      await expect(bagsWorldPlugin.init!(config, mockRuntime)).resolves.toBeUndefined();
    });

    it('logs warning when BAGS_API_KEY is missing', async () => {
      const config = {};
      await bagsWorldPlugin.init!(config, mockRuntime);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BAGS_API_KEY not set')
      );
    });

    it('does not warn when BAGS_API_KEY is provided via config', async () => {
      const config = { BAGS_API_KEY: 'test-key' };
      await bagsWorldPlugin.init!(config, mockRuntime);
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('BAGS_API_KEY not set')
      );
    });

    it('logs custom API URL when provided', async () => {
      const config = {
        BAGS_API_KEY: 'test-key',
        BAGS_API_URL: 'https://custom.api.bags.fm',
      };
      await bagsWorldPlugin.init!(config, mockRuntime);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://custom.api.bags.fm')
      );
    });

    it('logs action and provider counts', async () => {
      const config = { BAGS_API_KEY: 'test-key' };
      await bagsWorldPlugin.init!(config, mockRuntime);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${allActions.length} actions`)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${allProviders.length} providers`)
      );
    });

    it('logs initialization start and completion', async () => {
      const config = { BAGS_API_KEY: 'test-key' };
      await bagsWorldPlugin.init!(config, mockRuntime);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Initializing')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('initialized successfully')
      );
    });
  });

  describe('actions content', () => {
    it('all actions have name property', () => {
      bagsWorldPlugin.actions!.forEach(action => {
        expect(action.name).toBeDefined();
        expect(typeof action.name).toBe('string');
      });
    });

    it('all actions have description property', () => {
      bagsWorldPlugin.actions!.forEach(action => {
        expect(action.description).toBeDefined();
        expect(typeof action.description).toBe('string');
      });
    });

    it('all actions have handler function', () => {
      bagsWorldPlugin.actions!.forEach(action => {
        expect(action.handler).toBeDefined();
        expect(typeof action.handler).toBe('function');
      });
    });

    it('all actions have validate function', () => {
      bagsWorldPlugin.actions!.forEach(action => {
        expect(action.validate).toBeDefined();
        expect(typeof action.validate).toBe('function');
      });
    });

    it('action names are unique', () => {
      const names = bagsWorldPlugin.actions!.map(a => a.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('providers content', () => {
    it('all providers have name property', () => {
      bagsWorldPlugin.providers!.forEach(provider => {
        expect(provider.name).toBeDefined();
        expect(typeof provider.name).toBe('string');
      });
    });

    it('all providers have get function', () => {
      bagsWorldPlugin.providers!.forEach(provider => {
        expect(provider.get).toBeDefined();
        expect(typeof provider.get).toBe('function');
      });
    });

    it('provider names are unique', () => {
      const names = bagsWorldPlugin.providers!.map(p => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });
});

describe('Plugin exports', () => {
  describe('character exports', () => {
    it('exports allCharacters', () => {
      expect(allCharacters).toBeDefined();
      expect(Array.isArray(allCharacters)).toBe(true);
      expect(allCharacters.length).toBe(16);
    });

    it('exports characters record', () => {
      expect(characters).toBeDefined();
      expect(typeof characters).toBe('object');
    });

    it('exports getCharacter function', () => {
      expect(getCharacter).toBeDefined();
      expect(typeof getCharacter).toBe('function');
    });

    it('exports getCharacterIds function', () => {
      expect(getCharacterIds).toBeDefined();
      expect(typeof getCharacterIds).toBe('function');
    });

    it('exports getCharacterDisplayName function', () => {
      expect(getCharacterDisplayName).toBeDefined();
      expect(typeof getCharacterDisplayName).toBe('function');
    });

    it('exports isValidCharacterId function', () => {
      expect(isValidCharacterId).toBeDefined();
      expect(typeof isValidCharacterId).toBe('function');
    });
  });

  describe('action exports', () => {
    it('exports allActions', () => {
      expect(allActions).toBeDefined();
      expect(Array.isArray(allActions)).toBe(true);
    });
  });

  describe('provider exports', () => {
    it('exports allProviders', () => {
      expect(allProviders).toBeDefined();
      expect(Array.isArray(allProviders)).toBe(true);
    });
  });
});

describe('Plugin default export', () => {
  it('default export is the plugin object', () => {
    expect(bagsWorldPlugin).toBeDefined();
    expect(bagsWorldPlugin.name).toBe('@elizaos/plugin-bagsworld');
  });

  it('default export matches named export', () => {
    const defaultExport = bagsWorldPlugin;
    expect(defaultExport.name).toBe('@elizaos/plugin-bagsworld');
    expect(defaultExport.actions).toBeDefined();
    expect(defaultExport.providers).toBeDefined();
    expect(defaultExport.services).toBeDefined();
  });
});
