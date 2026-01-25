import type { Plugin, IAgentRuntime } from './types/elizaos.js';

export * from './characters/index.js';
export {
  allCharacters,
  characters,
  getCharacter,
  getCharacterIds,
  getCharacterDisplayName,
  isValidCharacterId,
} from './characters/index.js';

export * from './services/index.js';
import { BagsApiService } from './services/BagsApiService.js';
import { LLMService } from './services/LLMService.js';

export * from './actions/index.js';
import { allActions } from './actions/index.js';

export * from './providers/index.js';
import { allProviders } from './providers/index.js';

export const bagsWorldPlugin: Plugin = {
  name: '@elizaos/plugin-bagsworld',
  description: 'BagsWorld AI agents - Toly, Finn, Ash, Ghost, Neo, CJ, Shaw, and Bags Bot. Includes Bags.fm API integration for token lookups and fee queries.',

  init: async (config: Record<string, string>, runtime: IAgentRuntime): Promise<void> => {
    console.log('[plugin-bagsworld] Initializing BagsWorld plugin...');

    const bagsApiKey = config.BAGS_API_KEY || process.env.BAGS_API_KEY;
    if (!bagsApiKey) {
      console.warn('[plugin-bagsworld] BAGS_API_KEY not set - some features may be limited');
    }

    const bagsApiUrl = config.BAGS_API_URL || process.env.BAGS_API_URL;
    if (bagsApiUrl) {
      console.log(`[plugin-bagsworld] Using Bags API: ${bagsApiUrl}`);
    }

    console.log('[plugin-bagsworld] Plugin initialized successfully');
    console.log(`[plugin-bagsworld] Loaded ${allActions.length} actions, ${allProviders.length} providers`);
  },

  actions: allActions,
  providers: allProviders,
  evaluators: [],
  services: [BagsApiService, LLMService],
};

export default bagsWorldPlugin;

export type { CharacterId } from './characters/index.js';
export type {
  TokenInfo,
  CreatorFees,
  TopCreator,
  RecentLaunch,
  WorldHealthData,
} from './services/index.js';
