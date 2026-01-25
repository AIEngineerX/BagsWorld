// worldState Provider
// Injects BagsWorld health and status into agent context

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService } from '../services/BagsApiService.js';
import { formatNumber, getStatusLabel, getWeatherEmoji } from '../utils/index.js';

export const worldStateProvider: Provider = {
  name: 'worldState',
  description: 'Provides current BagsWorld health, weather, and ecosystem status',

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    // Use runtime service if available, fallback to standalone
    const api = runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();

    try {
      const worldHealth = await api.getWorldHealth();

      if (!worldHealth) {
        return {
          text: 'BAGSWORLD STATUS: Unable to fetch world data.',
          values: { worldHealth: 'unknown' },
          data: {},
        };
      }

      const statusLabel = getStatusLabel(worldHealth.health);
      const weatherEmoji = getWeatherEmoji(worldHealth.weather);

      const text = `BAGSWORLD STATUS:
- World Health: ${worldHealth.health}% (${statusLabel})
- Weather: ${weatherEmoji} ${worldHealth.weather}
- 24h Volume: $${formatNumber(worldHealth.totalVolume24h)}
- 24h Fees: ${worldHealth.totalFees24h.toFixed(2)} SOL
- Active Tokens: ${worldHealth.activeTokens}`;

      return {
        text,
        values: {
          worldHealth: worldHealth.health,
          weather: worldHealth.weather,
          status: statusLabel,
        },
        data: { worldHealth },
      };

    } catch (error) {
      console.error('worldState provider error:', error);
      return {
        text: 'BAGSWORLD STATUS: Connection error.',
        values: { worldHealth: 'error' },
        data: {},
      };
    }
  },
};

export default worldStateProvider;
