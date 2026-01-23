// Providers for Bags.fm - Supply context to agent prompts
import type { Provider, IAgentRuntime, Memory, State } from '../../types/elizaos';
import { BagsFmService } from './bags-service';

/**
 * World State Provider - Supplies current BagsWorld state to agent
 */
export const worldStateProvider: Provider = {
  name: 'bagsworld-state',
  description: 'Provides current BagsWorld state including health, weather, volume, and top tokens',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<BagsFmService>('bags-fm');
    if (!service) {
      return {
        text: 'BagsWorld connection unavailable',
        values: {},
        data: {},
      };
    }

    try {
      const worldState = await service.getWorldState();
      const topTokens = await service.getTopTokens(5);

      const tokenList = topTokens.map((t, i) =>
        `${i + 1}. ${t.symbol} - $${(t.marketCap / 1000).toFixed(1)}K mcap, ${t.priceChange24h >= 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%`
      ).join('\n');

      return {
        text: `
BAGSWORLD CURRENT STATE:
Health: ${worldState.health}%
Weather: ${worldState.weather}
Total 24h Volume: $${(worldState.totalVolume / 1000000).toFixed(2)}M
Total Fees Generated: $${(worldState.totalFees / 1000).toFixed(2)}K
Active Tokens: ${worldState.activeTokens}

TOP 5 TOKENS:
${tokenList || 'No tokens tracked yet'}
`.trim(),
        values: {
          health: worldState.health,
          weather: worldState.weather,
          volume: worldState.totalVolume,
          fees: worldState.totalFees,
        },
        data: { worldState, topTokens },
      };
    } catch (error) {
      return {
        text: 'Unable to fetch BagsWorld state',
        values: {},
        data: { error: String(error) },
      };
    }
  },
};

/**
 * Recent Events Provider - Supplies recent ecosystem events
 */
export const recentEventsProvider: Provider = {
  name: 'bags-events',
  description: 'Provides recent BagsWorld events like launches, pumps, and distributions',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<BagsFmService>('bags-fm');
    if (!service) {
      return {
        text: 'Event stream unavailable',
        values: {},
        data: {},
      };
    }

    const events = service.getRecentEvents(5);

    if (events.length === 0) {
      return {
        text: 'No recent events in BagsWorld',
        values: { eventCount: 0 },
        data: { events: [] },
      };
    }

    const eventDescriptions = events.map(e => {
      switch (e.type) {
        case 'token_launch':
          return `NEW LAUNCH: ${e.token.symbol} by ${e.token.creator.slice(0, 8)}...`;
        case 'price_pump':
          return `PUMP: ${e.token.symbol} up ${e.changePercent.toFixed(1)}%`;
        case 'price_dump':
          return `DUMP: ${e.token.symbol} down ${Math.abs(e.changePercent).toFixed(1)}%`;
        case 'fee_claim':
          return `FEE CLAIM: ${e.amount.toFixed(3)} SOL from ${e.token.symbol}`;
        case 'distribution':
          return `DISTRIBUTION: ${e.totalAmount.toFixed(2)} SOL to top ${e.recipients.length} creators`;
        default:
          return `Event: ${e.type}`;
      }
    });

    return {
      text: `RECENT BAGSWORLD EVENTS:\n${eventDescriptions.join('\n')}`,
      values: { eventCount: events.length },
      data: { events },
    };
  },
};

/**
 * Token Intel Provider - Deep analysis on specific tokens
 */
export const tokenIntelProvider: Provider = {
  name: 'token-intel',
  description: 'Provides detailed intelligence on Bags.fm tokens when discussing specific projects',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<BagsFmService>('bags-fm');
    if (!service) {
      return { text: '', values: {}, data: {} };
    }

    // Extract potential token symbols from the message
    const text = message.content?.text || '';
    const symbolMatches = text.match(/\$([A-Z]{2,10})/gi) || [];

    if (symbolMatches.length === 0) {
      return { text: '', values: {}, data: {} };
    }

    const symbols = symbolMatches.map(s => s.replace('$', '').toUpperCase());
    const tokenData: string[] = [];

    for (const symbol of symbols.slice(0, 3)) {
      const results = await service.searchTokens(symbol);
      const token = results.find(t => t.symbol.toUpperCase() === symbol);

      if (token) {
        tokenData.push(service.formatTokenForDisplay(token));
      }
    }

    if (tokenData.length === 0) {
      return { text: '', values: {}, data: {} };
    }

    return {
      text: `TOKEN DATA:\n${tokenData.join('\n\n')}`,
      values: { tokensFound: tokenData.length },
      data: { symbols, tokenData },
    };
  },
};

/**
 * Creator Leaderboard Provider
 */
export const creatorLeaderboardProvider: Provider = {
  name: 'creator-leaderboard',
  description: 'Provides top creator rankings by fees earned',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const service = runtime.getService<BagsFmService>('bags-fm');
    if (!service) {
      return { text: '', values: {}, data: {} };
    }

    const creators = await service.getTopCreators(5);

    if (creators.length === 0) {
      return { text: '', values: {}, data: {} };
    }

    const leaderboard = creators.map((c, i) =>
      `${i + 1}. ${c.username || c.wallet.slice(0, 8) + '...'} - ${c.totalFeesEarned.toFixed(2)} SOL earned (${c.tokensCreated} tokens)`
    ).join('\n');

    return {
      text: `TOP CREATORS:\n${leaderboard}`,
      values: { creatorCount: creators.length },
      data: { creators },
    };
  },
};

export const bagsProviders = [
  worldStateProvider,
  recentEventsProvider,
  tokenIntelProvider,
  creatorLeaderboardProvider,
];
