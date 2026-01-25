// topCreators Provider
// Injects top creator leaderboard data into agent context

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService } from '../services/BagsApiService.js';

export const topCreatorsProvider: Provider = {
  name: 'topCreators',
  description: 'Provides current top creator leaderboard from Bags.fm',

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    // Use runtime service if available, fallback to standalone
    const api = runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();

    try {
      const topCreators = await api.getTopCreators(5);

      if (!topCreators.length) {
        return {
          text: 'TOP CREATORS: No leaderboard data available.',
          values: { topCreatorCount: 0 },
          data: { topCreators: [] },
        };
      }

      const leaderboard = topCreators
        .map((creator, i) => {
          const name = creator.name || `${creator.address.slice(0, 6)}...${creator.address.slice(-4)}`;
          return `${i + 1}. ${name}: ${creator.totalFees.toFixed(2)} SOL`;
        })
        .join('\n');

      const text = `TOP CREATORS (by fees generated):
${leaderboard}

Remember: Top 3 creators share the rewards pool (50/30/20 split).`;

      return {
        text,
        values: {
          topCreatorCount: topCreators.length,
          topCreatorFees: topCreators[0]?.totalFees || 0,
        },
        data: { topCreators },
      };

    } catch (error) {
      console.error('topCreators provider error:', error);
      return {
        text: 'TOP CREATORS: Unable to fetch leaderboard.',
        values: { topCreatorCount: 0 },
        data: { topCreators: [] },
      };
    }
  },
};

export default topCreatorsProvider;
