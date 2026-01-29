import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAgentRuntime, Memory, State, Character } from '../types/elizaos.js';

// Import all actions
import { lookupTokenAction } from './lookupToken.js';
import { getCreatorFeesAction } from './getCreatorFees.js';
import { getTopCreatorsAction } from './getTopCreators.js';
import { getRecentLaunchesAction } from './getRecentLaunches.js';
import { checkWorldHealthAction } from './checkWorldHealth.js';

// Mock the BagsApiService
vi.mock('../services/BagsApiService.js', () => ({
  BagsApiService: {
    serviceType: 'bags_api',
  },
  getBagsApiService: vi.fn(() => ({
    getToken: vi.fn(),
    getCreatorFees: vi.fn(),
    getTopCreators: vi.fn(),
    getRecentLaunches: vi.fn(),
    getWorldHealth: vi.fn(),
    searchTokens: vi.fn(),
  })),
}));

import { getBagsApiService } from '../services/BagsApiService.js';

// Helper to create mock runtime
function createMockRuntime(characterName = 'TestAgent'): IAgentRuntime {
  return {
    character: {
      name: characterName,
    } as Character,
    // Return undefined so actions fall back to getBagsApiService()
    getService: vi.fn(() => undefined),
  } as unknown as IAgentRuntime;
}

// Helper to create mock memory
function createMockMemory(text: string): Memory {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    content: { text },
    userId: 'user-1',
    agentId: 'agent-1',
    roomId: 'room-1',
    entityId: 'entity-1',
  } as unknown as Memory;
}

// Helper to create mock state
function createMockState(): State {
  return {} as State;
}

describe('lookupTokenAction', () => {
  let mockApi: {
    getToken: ReturnType<typeof vi.fn>;
    searchTokens: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockApi = {
      getToken: vi.fn(),
      searchTokens: vi.fn(),
    };
    (getBagsApiService as ReturnType<typeof vi.fn>).mockReturnValue(mockApi);
  });

  describe('validate', () => {
    it('returns true for mint address with lookup intent', async () => {
      const message = createMockMemory('check this token 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await lookupTokenAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(true);
    });

    it('returns true for token symbol with lookup intent', async () => {
      const message = createMockMemory('find token $BAGS');
      const result = await lookupTokenAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(true);
    });

    it('returns false for message without lookup intent', async () => {
      const message = createMockMemory('hello there 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await lookupTokenAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(false);
    });

    it('returns false for message without token reference', async () => {
      const message = createMockMemory('check something');
      const result = await lookupTokenAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(false);
    });

    it('handles empty message', async () => {
      const message = createMockMemory('');
      const result = await lookupTokenAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(false);
    });

    it('handles missing content', async () => {
      const message = { content: null } as unknown as Memory;
      const result = await lookupTokenAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    const mockToken = {
      mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      name: 'Test Token',
      symbol: 'TEST',
      marketCap: 1000000,
      volume24h: 50000,
      lifetimeFees: 100,
      holders: 500,
      creator: 'Creator123456789012345678901234567890123456',
    };

    it('looks up token by mint address', async () => {
      mockApi.getToken.mockResolvedValueOnce(mockToken);

      const message = createMockMemory('check 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const callback = vi.fn();

      const result = await lookupTokenAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {},
        callback
      );

      expect(result.success).toBe(true);
      expect(result.text).toContain('Test Token');
      expect(result.text).toContain('TEST');
      expect(callback).toHaveBeenCalled();
    });

    it('looks up token by symbol', async () => {
      mockApi.searchTokens.mockResolvedValueOnce([mockToken]);

      const message = createMockMemory('find $TEST');
      const callback = vi.fn();

      const result = await lookupTokenAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {},
        callback
      );

      expect(result.success).toBe(true);
      expect(mockApi.searchTokens).toHaveBeenCalledWith('TEST');
    });

    it('returns error when token not found', async () => {
      mockApi.getToken.mockResolvedValueOnce(null);

      // Use a valid-looking base58 address that will pass validation but return null from API
      const message = createMockMemory('check BagsNotExistingTokenAddressXYZABCDEFGHJK');
      const callback = vi.fn();

      const result = await lookupTokenAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {},
        callback
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token not found');
    });

    it('uses Neo character-specific response', async () => {
      mockApi.getToken.mockResolvedValueOnce(mockToken);

      const message = createMockMemory('check 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await lookupTokenAction.handler(
        createMockRuntime('Neo'),
        message,
        createMockState(),
        {}
      );

      expect(result.text).toContain('*scanning*');
      expect(result.text).toContain('the code reveals its nature');
    });

    it('uses Ghost character-specific response', async () => {
      mockApi.getToken.mockResolvedValueOnce(mockToken);

      const message = createMockMemory('check 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await lookupTokenAction.handler(
        createMockRuntime('Ghost'),
        message,
        createMockState(),
        {}
      );

      expect(result.text).toContain('check solscan to verify');
    });

    it('handles API errors gracefully', async () => {
      mockApi.getToken.mockRejectedValueOnce(new Error('Network error'));

      const message = createMockMemory('check 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await lookupTokenAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});

describe('getCreatorFeesAction', () => {
  const mockApi = {
    getCreatorFees: vi.fn(),
    searchTokens: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getBagsApiService as ReturnType<typeof vi.fn>).mockReturnValue(mockApi);
  });

  describe('validate', () => {
    it('returns true for fee-related query with mint', async () => {
      const message = createMockMemory('how much fees for 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await getCreatorFeesAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(true);
    });

    it('returns true for earnings query with symbol', async () => {
      const message = createMockMemory('what are the earnings for $BAGS');
      const result = await getCreatorFeesAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(true);
    });

    it('returns false without fee intent', async () => {
      const message = createMockMemory('check 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await getCreatorFeesAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    const mockFees = {
      mint: 'test',
      totalFees: 100.5,
      claimedFees: 50.25,
      unclaimedFees: 50.25,
      creatorAddress: 'Creator',
    };

    it('fetches fees successfully', async () => {
      mockApi.getCreatorFees.mockResolvedValueOnce(mockFees);

      const message = createMockMemory('fees for 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      const result = await getCreatorFeesAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(true);
      expect(result.text).toContain('100.5000 SOL');
    });

    it('searches by symbol when no mint provided', async () => {
      mockApi.searchTokens.mockResolvedValueOnce([{ mint: 'found-mint' }]);
      mockApi.getCreatorFees.mockResolvedValueOnce(mockFees);

      const message = createMockMemory('fees for $BAGS');
      await getCreatorFeesAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(mockApi.searchTokens).toHaveBeenCalledWith('BAGS');
      expect(mockApi.getCreatorFees).toHaveBeenCalledWith('found-mint');
    });

    it('returns error when no mint or symbol', async () => {
      mockApi.searchTokens.mockResolvedValueOnce([]);

      const message = createMockMemory('fees for something');
      const result = await getCreatorFeesAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No mint address provided');
    });

    it('uses character-specific responses', async () => {
      mockApi.getCreatorFees.mockResolvedValueOnce(mockFees);

      const message = createMockMemory('fees for 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');

      const finnResult = await getCreatorFeesAction.handler(
        createMockRuntime('Finn'),
        message,
        createMockState(),
        {}
      );
      expect(finnResult.text).toContain('real passive income');

      mockApi.getCreatorFees.mockResolvedValueOnce(mockFees);
      const ashResult = await getCreatorFeesAction.handler(
        createMockRuntime('Ash'),
        message,
        createMockState(),
        {}
      );
      expect(ashResult.text).toContain('trained up');
    });
  });
});

describe('getTopCreatorsAction', () => {
  const mockApi = {
    getTopCreators: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getBagsApiService as ReturnType<typeof vi.fn>).mockReturnValue(mockApi);
  });

  describe('validate', () => {
    it('returns true for leaderboard queries', async () => {
      const queries = [
        'who are the top creators',
        'show leaderboard',
        'creator rankings',
        'who is making the most fees',
      ];

      for (const query of queries) {
        const message = createMockMemory(query);
        const result = await getTopCreatorsAction.validate!(
          createMockRuntime(),
          message,
          createMockState()
        );
        expect(result).toBe(true);
      }
    });

    it('returns false for unrelated queries', async () => {
      const message = createMockMemory('hello world');
      const result = await getTopCreatorsAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    const mockCreators = [
      { address: 'addr1', name: 'Creator 1', totalFees: 1000, rank: 1 },
      { address: 'addr2', name: 'Creator 2', totalFees: 500, rank: 2 },
    ];

    it('fetches top creators with default limit', async () => {
      mockApi.getTopCreators.mockResolvedValueOnce(mockCreators);

      const message = createMockMemory('show top creators');
      const result = await getTopCreatorsAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(true);
      expect(result.text).toContain('Creator 1');
      expect(result.text).toContain('1000.00 SOL');
    });

    it('parses custom limit from message', async () => {
      mockApi.getTopCreators.mockResolvedValueOnce(mockCreators);

      const message = createMockMemory('show top 10 creators');
      await getTopCreatorsAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(mockApi.getTopCreators).toHaveBeenCalledWith(10);
    });

    it('clamps limit to valid range', async () => {
      mockApi.getTopCreators.mockResolvedValueOnce([]);

      const message = createMockMemory('show top 100 creators');
      await getTopCreatorsAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(mockApi.getTopCreators).toHaveBeenCalledWith(25);
    });

    it('handles empty results', async () => {
      mockApi.getTopCreators.mockResolvedValueOnce([]);

      const message = createMockMemory('show top creators');
      const result = await getTopCreatorsAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No data available');
    });

    it('uses character-specific responses', async () => {
      mockApi.getTopCreators.mockResolvedValue(mockCreators);

      const characters = ['finn', 'ghost', 'neo', 'cj', 'ash', 'shaw', 'toly'];
      for (const char of characters) {
        const message = createMockMemory('show leaderboard');
        const result = await getTopCreatorsAction.handler(
          createMockRuntime(char),
          message,
          createMockState(),
          {}
        );
        expect(result.success).toBe(true);
        expect(result.text.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('getRecentLaunchesAction', () => {
  const mockApi = {
    getRecentLaunches: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getBagsApiService as ReturnType<typeof vi.fn>).mockReturnValue(mockApi);
  });

  describe('validate', () => {
    it('returns true for launch queries', async () => {
      const queries = [
        'what tokens just launched',
        'show recent launches',
        'new tokens',
        'fresh launches',
      ];

      for (const query of queries) {
        const message = createMockMemory(query);
        const result = await getRecentLaunchesAction.validate!(
          createMockRuntime(),
          message,
          createMockState()
        );
        expect(result).toBe(true);
      }
    });

    it('returns false for unrelated queries', async () => {
      const message = createMockMemory('check token price');
      const result = await getRecentLaunchesAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    const mockLaunches = [
      {
        mint: 'mint1',
        name: 'Token 1',
        symbol: 'TK1',
        launchedAt: Date.now() - 3600000,
        creator: 'creator1',
        initialMarketCap: 100000,
      },
    ];

    it('fetches recent launches', async () => {
      mockApi.getRecentLaunches.mockResolvedValueOnce(mockLaunches);

      const message = createMockMemory('show recent launches');
      const result = await getRecentLaunchesAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(true);
      expect(result.text).toContain('Token 1');
      expect(result.text).toContain('TK1');
    });

    it('handles empty results', async () => {
      mockApi.getRecentLaunches.mockResolvedValueOnce([]);

      const message = createMockMemory('recent launches');
      const result = await getRecentLaunchesAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No launches found');
    });

    it('formats time ago correctly', async () => {
      mockApi.getRecentLaunches.mockResolvedValueOnce(mockLaunches);

      const message = createMockMemory('recent launches');
      const result = await getRecentLaunchesAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.text).toContain('1h ago');
    });
  });
});

describe('checkWorldHealthAction', () => {
  const mockApi = {
    getWorldHealth: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getBagsApiService as ReturnType<typeof vi.fn>).mockReturnValue(mockApi);
  });

  describe('validate', () => {
    it('returns true for health queries', async () => {
      const queries = [
        'how is bagsworld doing',
        'world health',
        'ecosystem status',
        'world state',
        'what is the weather',
      ];

      for (const query of queries) {
        const message = createMockMemory(query);
        const result = await checkWorldHealthAction.validate!(
          createMockRuntime(),
          message,
          createMockState()
        );
        expect(result).toBe(true);
      }
    });

    it('returns false for unrelated queries', async () => {
      const message = createMockMemory('check token price');
      const result = await checkWorldHealthAction.validate!(
        createMockRuntime(),
        message,
        createMockState()
      );
      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    const mockHealth = {
      health: 75,
      weather: 'sunny',
      totalVolume24h: 1000000,
      totalFees24h: 500,
      activeTokens: 50,
      topCreators: [],
    };

    it('fetches world health', async () => {
      mockApi.getWorldHealth.mockResolvedValueOnce(mockHealth);

      const message = createMockMemory('world health');
      const result = await checkWorldHealthAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(true);
      expect(result.text).toContain('75%');
      expect(result.text).toContain('sunny');
    });

    it('handles null health data', async () => {
      mockApi.getWorldHealth.mockResolvedValueOnce(null);

      const message = createMockMemory('world health');
      const result = await checkWorldHealthAction.handler(
        createMockRuntime(),
        message,
        createMockState(),
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('World health unavailable');
    });

    it('uses Ash pokemon analogies', async () => {
      mockApi.getWorldHealth.mockResolvedValueOnce({
        ...mockHealth,
        health: 85,
      });

      const message = createMockMemory('world health');
      const result = await checkWorldHealthAction.handler(
        createMockRuntime('Ash'),
        message,
        createMockState(),
        {}
      );

      expect(result.text).toContain('charizard');
    });

    it('returns correct status labels', async () => {
      const healthLevels = [
        { health: 90, expected: 'THRIVING' },
        { health: 65, expected: 'HEALTHY' },
        { health: 50, expected: 'GROWING' },
        { health: 30, expected: 'QUIET' },
        { health: 15, expected: 'DORMANT' },
        { health: 5, expected: 'CRITICAL' },
      ];

      for (const { health, expected } of healthLevels) {
        mockApi.getWorldHealth.mockResolvedValueOnce({
          ...mockHealth,
          health,
        });

        const message = createMockMemory('world health');
        const result = await checkWorldHealthAction.handler(
          createMockRuntime(),
          message,
          createMockState(),
          {}
        );

        expect(result.text).toContain(expected);
      }
    });

    it('returns correct weather emojis', async () => {
      const weatherTypes = ['sunny', 'cloudy', 'rain', 'storm', 'apocalypse'];

      for (const weather of weatherTypes) {
        mockApi.getWorldHealth.mockResolvedValueOnce({
          ...mockHealth,
          weather,
        });

        const message = createMockMemory('world health');
        const result = await checkWorldHealthAction.handler(
          createMockRuntime(),
          message,
          createMockState(),
          {}
        );

        expect(result.text).toContain(weather);
      }
    });
  });
});

describe('Action metadata', () => {
  it('all actions have required properties', () => {
    const actions = [
      lookupTokenAction,
      getCreatorFeesAction,
      getTopCreatorsAction,
      getRecentLaunchesAction,
      checkWorldHealthAction,
    ];

    for (const action of actions) {
      expect(action.name).toBeDefined();
      expect(action.description).toBeDefined();
      expect(action.similes).toBeDefined();
      expect(action.examples).toBeDefined();
      expect(action.validate).toBeDefined();
      expect(action.handler).toBeDefined();
    }
  });

  it('all actions have non-empty similes', () => {
    const actions = [
      lookupTokenAction,
      getCreatorFeesAction,
      getTopCreatorsAction,
      getRecentLaunchesAction,
      checkWorldHealthAction,
    ];

    for (const action of actions) {
      expect(action.similes!.length).toBeGreaterThan(0);
    }
  });

  it('all actions have at least one example', () => {
    const actions = [
      lookupTokenAction,
      getCreatorFeesAction,
      getTopCreatorsAction,
      getRecentLaunchesAction,
      checkWorldHealthAction,
    ];

    for (const action of actions) {
      expect(action.examples!.length).toBeGreaterThan(0);
    }
  });
});
