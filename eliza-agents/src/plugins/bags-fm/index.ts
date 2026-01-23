// Bags.fm Plugin for ElizaOS
// Enables autonomous agents to interact with Bags.fm ecosystem

import type { Plugin } from '../../types/elizaos';
import { BagsFmService } from './bags-service';
import { bagsActions } from './actions';
import { bagsProviders } from './providers';

export * from './types';
export { BagsFmService } from './bags-service';
export { bagsActions } from './actions';
export { bagsProviders } from './providers';

/**
 * Bags.fm Plugin
 *
 * Provides ElizaOS agents with:
 * - Real-time Bags.fm token data
 * - World state monitoring
 * - Event streams (launches, pumps, distributions)
 * - Creator leaderboards
 * - Token analysis capabilities
 *
 * Configuration via environment variables:
 * - BAGSWORLD_API_URL: BagsWorld API endpoint
 */
export const bagsFmPlugin: Plugin = {
  name: 'bags-fm',
  description: 'Bags.fm ecosystem integration - token data, creator stats, and autonomous market monitoring',

  // Service for API interactions
  services: [BagsFmService],

  // Actions agents can take
  actions: bagsActions,

  // Providers for context injection
  providers: bagsProviders,

  // Initialize plugin
  init: async (config, runtime) => {
    console.log('[bags-fm] Plugin initializing...');

    // Validate configuration
    const apiUrl = process.env.BAGSWORLD_API_URL;
    if (!apiUrl) {
      console.warn('[bags-fm] BAGSWORLD_API_URL not set, using default localhost:3000');
    }

    console.log('[bags-fm] Plugin initialized successfully');
  },
};

export default bagsFmPlugin;
