import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAgentRuntime, Memory, State, Character } from '../types/elizaos.js';

// Mock the BagsApiService
vi.mock('../services/BagsApiService.js', () => ({
  BagsApiService: {
    serviceType: 'bags_api',
  },
  getBagsApiService: vi.fn(() => ({
    getWorldHealth: vi.fn(),
    getToken: vi.fn(),
    searchTokens: vi.fn(),
    getRecentLaunches: vi.fn(),
    getTopCreators: vi.fn(),
  })),
}));

// Mock characters
vi.mock('../characters/index.js', () => ({
  characters: {
    toly: { name: 'Toly', username: 'toly_sol' },
    finn: { name: 'Finn', username: 'finnbags' },
    ash: { name: 'Ash', username: 'ash_trainer' },
    ghost: { name: 'Ghost', username: 'daddyghost' },
    neo: { name: 'Neo', username: 'neo_scout' },
    cj: { name: 'CJ', username: 'cj_og' },
    shaw: { name: 'Shaw', username: 'shawmakesmagic' },
    'bags-bot': { name: 'Bags Bot', username: 'bagsbot' },
  },
  getCharacterDisplayName: vi.fn((id: string) => id.toUpperCase()),
}));

import { getBagsApiService } from '../services/BagsApiService.js';
import { worldStateProvider } from './worldState.js';
import { tokenDataProvider } from './tokenData.js';
import { agentContextProvider } from './agentContext.js';
import { topCreatorsProvider } from './topCreators.js';

// Helpers
function createMockRuntime(characterName = 'TestAgent'): IAgentRuntime {
  return {
    character: {
      name: characterName,
    } as Character,
    // Return undefined so providers fall back to getBagsApiService()
    getService: vi.fn(() => undefined),
  } as unknown as IAgentRuntime;
}

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

function createMockState(): State {
  return {} as State;
}

describe('worldStateProvider', () => {
  const mockApi = {
    getWorldHealth: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getBagsApiService as ReturnType<typeof vi.fn>).mockReturnValue(mockApi);
  });

  it('returns world health data', async () => {
    const mockHealth = {
      health: 75,
      weather: 'sunny',
      totalVolume24h: 1000000,
      totalFees24h: 500,
      activeTokens: 50,
      topCreators: [],
    };
    mockApi.getWorldHealth.mockResolvedValueOnce(mockHealth);

    const result = await worldStateProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.text).toContain('BAGSWORLD STATUS');
    expect(result.text).toContain('75%');
    expect(result.text).toContain('HEALTHY');
    expect(result.text).toContain('sunny');
    expect(result.values?.worldHealth).toBe(75);
    expect(result.values?.weather).toBe('sunny');
  });

  it('handles null world health', async () => {
    mockApi.getWorldHealth.mockResolvedValueOnce(null);

    const result = await worldStateProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.text).toContain('Unable to fetch');
    expect(result.values?.worldHealth).toBe('unknown');
  });

  it('handles API error', async () => {
    mockApi.getWorldHealth.mockRejectedValueOnce(new Error('Network error'));

    const result = await worldStateProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.text).toContain('Connection error');
    expect(result.values?.worldHealth).toBe('error');
  });

  it('formats numbers correctly', async () => {
    const mockHealth = {
      health: 80,
      weather: 'cloudy',
      totalVolume24h: 5500000,
      totalFees24h: 250.75,
      activeTokens: 100,
      topCreators: [],
    };
    mockApi.getWorldHealth.mockResolvedValueOnce(mockHealth);

    const result = await worldStateProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.text).toContain('$5.50M');
    expect(result.text).toContain('250.75 SOL');
  });

  it('returns all weather emojis correctly', async () => {
    const weatherTypes = [
      { weather: 'sunny', emoji: '☀️' },
      { weather: 'cloudy', emoji: '☁️' },
      { weather: 'rain', emoji: '🌧️' },
      { weather: 'storm', emoji: '⛈️' },
      { weather: 'apocalypse', emoji: '🌋' },
    ];

    for (const { weather, emoji } of weatherTypes) {
      mockApi.getWorldHealth.mockResolvedValueOnce({
        health: 50,
        weather,
        totalVolume24h: 0,
        totalFees24h: 0,
        activeTokens: 0,
        topCreators: [],
      });

      const result = await worldStateProvider.get(
        createMockRuntime(),
        createMockMemory('test'),
        createMockState()
      );

      expect(result.text).toContain(emoji);
    }
  });
});

describe('tokenDataProvider', () => {
  const mockApi = {
    getToken: vi.fn(),
    searchTokens: vi.fn(),
    getRecentLaunches: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getBagsApiService as ReturnType<typeof vi.fn>).mockReturnValue(mockApi);
  });

  it('fetches mentioned tokens by mint address', async () => {
    const mockToken = {
      mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      name: 'Test Token',
      symbol: 'TEST',
      marketCap: 1000000,
      volume24h: 50000,
      lifetimeFees: 100,
    };
    mockApi.getToken.mockResolvedValueOnce(mockToken);
    // Not called because mentionedTokens.length > 0 after finding token
    mockApi.getRecentLaunches.mockResolvedValue([]);

    const result = await tokenDataProvider.get(
      createMockRuntime(),
      createMockMemory('check 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
      createMockState()
    );

    expect(result.text).toContain('MENTIONED TOKENS');
    expect(result.text).toContain('Test Token');
    expect(result.text).toContain('$1.00M');
    expect(result.values?.mentionedTokenCount).toBe(1);
  });

  it('fetches mentioned tokens by symbol', async () => {
    const mockToken = {
      mint: 'test',
      name: 'BAGS Token',
      symbol: 'BAGS',
      marketCap: 5000000,
      volume24h: 100000,
      lifetimeFees: 500,
    };
    mockApi.searchTokens.mockResolvedValueOnce([mockToken]);
    // getRecentLaunches is called for trending when no tokens found initially
    mockApi.getRecentLaunches.mockResolvedValue([]);

    const result = await tokenDataProvider.get(
      createMockRuntime(),
      createMockMemory('check $BAGS'),
      createMockState()
    );

    expect(result.text).toContain('BAGS Token');
    // Text is lowercased before matching, so symbol is 'bags' not 'BAGS'
    expect(mockApi.searchTokens).toHaveBeenCalledWith('bags');
  });

  it('fetches recent launches when requested', async () => {
    const mockLaunches = [
      {
        mint: 'mint1',
        name: 'New Token',
        symbol: 'NEW',
        launchedAt: Date.now() - 3600000,
        creator: 'creator1',
      },
    ];
    // getRecentLaunches is called twice: once for recent (5) and once for trending (3)
    mockApi.getRecentLaunches.mockResolvedValue(mockLaunches);
    // getToken is called for each trending token
    mockApi.getToken.mockResolvedValue(null);

    const result = await tokenDataProvider.get(
      createMockRuntime(),
      createMockMemory('show recent launches'),
      createMockState()
    );

    expect(result.text).toContain('RECENT LAUNCHES');
    expect(result.text).toContain('New Token');
    expect(result.values?.recentLaunchCount).toBe(1);
  });

  it('fetches trending tokens when requested', async () => {
    const mockLaunches = [
      { mint: 'mint1', name: 'Hot', symbol: 'HOT', launchedAt: Date.now(), creator: 'c' },
    ];
    const mockToken = { mint: 'mint1', name: 'Hot Token', symbol: 'HOT', marketCap: 2000000 };

    mockApi.getRecentLaunches.mockResolvedValue(mockLaunches);
    mockApi.getToken.mockResolvedValueOnce(mockToken);

    const result = await tokenDataProvider.get(
      createMockRuntime(),
      createMockMemory('what is trending'),
      createMockState()
    );

    expect(result.text).toContain('TRENDING TOKENS');
    expect(result.values?.trendingTokenCount).toBe(1);
  });

  it('returns default message when no tokens mentioned', async () => {
    // Called for trending because mentionedTokens.length === 0
    mockApi.getRecentLaunches.mockResolvedValue([]);

    const result = await tokenDataProvider.get(
      createMockRuntime(),
      createMockMemory('hello'),
      createMockState()
    );

    expect(result.text).toContain('No specific tokens mentioned');
    expect(result.values?.mentionedTokenCount).toBe(0);
  });

  it('limits token lookups to 3', async () => {
    mockApi.getToken.mockResolvedValue({ mint: 't', name: 'T', symbol: 'T' });
    // Not called because mentionedTokens.length > 0 after finding tokens
    mockApi.getRecentLaunches.mockResolvedValue([]);

    const mints = 'a'.repeat(44) + ' ' + 'b'.repeat(44) + ' ' + 'c'.repeat(44) + ' ' + 'd'.repeat(44);
    await tokenDataProvider.get(
      createMockRuntime(),
      createMockMemory(mints),
      createMockState()
    );

    expect(mockApi.getToken).toHaveBeenCalledTimes(3);
  });

  it('handles token lookup failures gracefully', async () => {
    mockApi.getToken.mockResolvedValue(null);
    // Called for trending because mentionedTokens.length === 0 when token lookup fails
    mockApi.getRecentLaunches.mockResolvedValue([]);

    const result = await tokenDataProvider.get(
      createMockRuntime(),
      createMockMemory('check 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
      createMockState()
    );

    expect(result.values?.mentionedTokenCount).toBe(0);
  });
});

describe('agentContextProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list of other agents', async () => {
    const result = await agentContextProvider.get(
      createMockRuntime('TestAgent'),
      createMockMemory('hello'),
      createMockState()
    );

    expect(result.text).toContain('OTHER BAGSWORLD AGENTS');
    expect(result.text).toContain('Toly');
    expect(result.text).toContain('Finn');
    expect(result.values?.otherAgentCount).toBeGreaterThan(0);
  });

  it('excludes current agent from list', async () => {
    const result = await agentContextProvider.get(
      createMockRuntime('Toly'),
      createMockMemory('hello'),
      createMockState()
    );

    // Should not contain Toly in the other agents section
    // The agent list will show other agents, not the current one
    expect(result.data?.currentAgent).toBe('toly');
    const otherAgents = result.data?.otherAgents as Array<{ name: string }> | undefined;
    expect(otherAgents?.some((a) => a.name === 'Toly')).toBe(false);
  });

  it('detects mentioned agents', async () => {
    const result = await agentContextProvider.get(
      createMockRuntime('TestAgent'),
      createMockMemory('What does Finn think about this?'),
      createMockState()
    );

    expect(result.values?.mentionedAgentCount).toBeGreaterThan(0);
    expect(result.text).toContain('MENTIONED AGENTS');
  });

  it('suggests referral for topic experts', async () => {
    const result = await agentContextProvider.get(
      createMockRuntime('TestAgent'),
      createMockMemory('tell me about solana blockchain'),
      createMockState()
    );

    expect(result.values?.hasReferralSuggestion).toBe(true);
    expect(result.text).toContain('REFERRAL SUGGESTION');
  });

  it('includes agent roles and expertise', async () => {
    const result = await agentContextProvider.get(
      createMockRuntime('TestAgent'),
      createMockMemory('hello'),
      createMockState()
    );

    expect(result.text).toContain('Solana Co-Founder');
    expect(result.text).toContain('Bags.fm Founder');
  });

  it('handles empty message', async () => {
    const result = await agentContextProvider.get(
      createMockRuntime('TestAgent'),
      createMockMemory(''),
      createMockState()
    );

    expect(result).toBeDefined();
    expect(result.values?.mentionedAgentCount).toBe(0);
  });

  it('detects @mentions', async () => {
    const result = await agentContextProvider.get(
      createMockRuntime('TestAgent'),
      createMockMemory('@finnbags what do you think?'),
      createMockState()
    );

    expect(result.values?.mentionedAgentCount).toBeGreaterThan(0);
  });
});

describe('topCreatorsProvider', () => {
  const mockApi = {
    getTopCreators: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getBagsApiService as ReturnType<typeof vi.fn>).mockReturnValue(mockApi);
  });

  it('returns top creators leaderboard', async () => {
    const mockCreators = [
      { address: 'addr1', name: 'Creator 1', totalFees: 1000, rank: 1 },
      { address: 'addr2', name: 'Creator 2', totalFees: 500, rank: 2 },
      { address: 'addr3', totalFees: 250, rank: 3 },
    ];
    mockApi.getTopCreators.mockResolvedValueOnce(mockCreators);

    const result = await topCreatorsProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.text).toContain('TOP CREATORS');
    expect(result.text).toContain('Creator 1');
    expect(result.text).toContain('1000.00 SOL');
    expect(result.text).toContain('50/30/20');
    expect(result.values?.topCreatorCount).toBe(3);
  });

  it('formats addresses when no name provided', async () => {
    const mockCreators = [
      { address: 'abcdefghijklmnopqrstuvwxyz1234567890', totalFees: 100, rank: 1 },
    ];
    mockApi.getTopCreators.mockResolvedValueOnce(mockCreators);

    const result = await topCreatorsProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.text).toContain('abcdef...7890');
  });

  it('handles empty creator list', async () => {
    mockApi.getTopCreators.mockResolvedValueOnce([]);

    const result = await topCreatorsProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.text).toContain('No leaderboard data available');
    expect(result.values?.topCreatorCount).toBe(0);
  });

  it('handles API error', async () => {
    mockApi.getTopCreators.mockRejectedValueOnce(new Error('API error'));

    const result = await topCreatorsProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.text).toContain('Unable to fetch leaderboard');
    expect(result.values?.topCreatorCount).toBe(0);
  });

  it('returns top creator fees in values', async () => {
    const mockCreators = [
      { address: 'addr1', name: 'Top', totalFees: 5000, rank: 1 },
    ];
    mockApi.getTopCreators.mockResolvedValueOnce(mockCreators);

    const result = await topCreatorsProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(result.values?.topCreatorFees).toBe(5000);
  });

  it('fetches exactly 5 creators', async () => {
    mockApi.getTopCreators.mockResolvedValueOnce([]);

    await topCreatorsProvider.get(
      createMockRuntime(),
      createMockMemory('test'),
      createMockState()
    );

    expect(mockApi.getTopCreators).toHaveBeenCalledWith(5);
  });
});

describe('Provider metadata', () => {
  it('all providers have required properties', () => {
    const providers = [
      worldStateProvider,
      tokenDataProvider,
      agentContextProvider,
      topCreatorsProvider,
    ];

    for (const provider of providers) {
      expect(provider.name).toBeDefined();
      expect(provider.description).toBeDefined();
      expect(provider.get).toBeDefined();
      expect(typeof provider.get).toBe('function');
    }
  });
});
