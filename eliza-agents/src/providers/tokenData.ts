// tokenData Provider
// Injects relevant token data into agent context based on conversation

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService, TokenInfo, RecentLaunch } from '../services/BagsApiService.js';
import { formatNumber, getTimeAgo } from '../utils/index.js';

interface TokenDataContext {
  mentionedTokens: TokenInfo[];
  recentLaunches: RecentLaunch[];
  trendingTokens: TokenInfo[];
}

export const tokenDataProvider: Provider = {
  name: 'tokenData',
  description: 'Provides relevant token data based on conversation context and recent activity',

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    // Use runtime service if available, fallback to standalone
    const api = runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();
    const messageText = message.content?.text?.toLowerCase() || '';

    const context: TokenDataContext = {
      mentionedTokens: [],
      recentLaunches: [],
      trendingTokens: [],
    };

    const mintMatches = messageText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
    const symbolMatches = messageText.match(/\$([A-Za-z]{2,10})/g) || [];

    for (const mint of mintMatches.slice(0, 3)) {
      const token = await api.getToken(mint);
      if (token) {
        context.mentionedTokens.push(token);
      }
    }

    for (const symbolMatch of symbolMatches.slice(0, 3)) {
      const symbol = symbolMatch.replace('$', '');
      const tokens = await api.searchTokens(symbol);
      if (tokens.length > 0 && !context.mentionedTokens.some(t => t.symbol === tokens[0].symbol)) {
        context.mentionedTokens.push(tokens[0]);
      }
    }

    const wantsLaunches = [
      'new', 'recent', 'latest', 'launch', 'fresh', 'just'
    ].some(word => messageText.includes(word));

    if (wantsLaunches) {
      context.recentLaunches = await api.getRecentLaunches(5);
    }

    const wantsTrending = [
      'trending', 'hot', 'popular', 'top token', 'best token', 'pumping'
    ].some(word => messageText.includes(word));

    if (wantsTrending || context.mentionedTokens.length === 0) {
      const launches = await api.getRecentLaunches(3);
      for (const launch of launches) {
        const token = await api.getToken(launch.mint);
        if (token) {
          context.trendingTokens.push(token);
        }
      }
    }

    const textParts: string[] = [];

    if (context.mentionedTokens.length > 0) {
      const tokenLines = context.mentionedTokens.map(t => {
        return `- ${t.name} ($${t.symbol}): MC $${formatNumber(t.marketCap)}, ` +
          `Vol $${formatNumber(t.volume24h)}, Fees ${formatNumber(t.lifetimeFees)} SOL`;
      });
      textParts.push(`MENTIONED TOKENS:\n${tokenLines.join('\n')}`);
    }

    if (context.recentLaunches.length > 0) {
      const launchLines = context.recentLaunches.map(l => {
        const timeAgo = getTimeAgo(l.launchedAt);
        return `- ${l.name} ($${l.symbol}) - launched ${timeAgo}`;
      });
      textParts.push(`RECENT LAUNCHES:\n${launchLines.join('\n')}`);
    }

    if (context.trendingTokens.length > 0) {
      const trendingLines = context.trendingTokens.map(t => {
        return `- ${t.name} ($${t.symbol}): $${formatNumber(t.marketCap)} MC`;
      });
      textParts.push(`TRENDING TOKENS:\n${trendingLines.join('\n')}`);
    }

    const text = textParts.length > 0
      ? textParts.join('\n\n')
      : 'TOKEN DATA: No specific tokens mentioned. Ask about a token by name ($SYMBOL) or address.';

    return {
      text,
      values: {
        mentionedTokenCount: context.mentionedTokens.length,
        recentLaunchCount: context.recentLaunches.length,
        trendingTokenCount: context.trendingTokens.length,
      },
      data: context as unknown as Record<string, unknown>,
    };
  },
};

export default tokenDataProvider;
