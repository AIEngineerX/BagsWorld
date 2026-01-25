// checkWorldHealth Action
// Check the current health and status of BagsWorld

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService, WorldHealthData } from '../services/BagsApiService.js';
import { formatNumber, getStatusLabel, getWeatherEmoji } from '../utils/index.js';

export const checkWorldHealthAction: Action = {
  name: 'checkWorldHealth',
  description: 'Check the current health, weather, and activity status of BagsWorld',

  similes: [
    'world health',
    'world status',
    'how is the world',
    'bagsworld status',
    'ecosystem health',
    'world state',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'how is bagsworld doing?' },
      },
      {
        name: 'Ash',
        content: { text: 'let me check the world status...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'what is the world health?' },
      },
      {
        name: 'Finn',
        content: { text: 'pulling ecosystem metrics...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'is the ecosystem healthy?' },
      },
      {
        name: 'Ghost',
        content: { text: 'checking on-chain activity...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    const hasHealthIntent = [
      'world health',
      'world status',
      'ecosystem health',
      'ecosystem status',
      'bagsworld status',
      'bagsworld health',
      'how is the world',
      'how is bagsworld',
      'is the world',
      'world doing',
      'world state',
      'weather',
    ].some(phrase => text.includes(phrase));

    return hasHealthIntent;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    // Use runtime service if available, fallback to standalone
    const api = runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();
    const worldHealth = await api.getWorldHealth();

    if (!worldHealth) {
      const response = {
        text: 'unable to fetch world health data right now. the api might be temporarily unavailable.',
      };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'World health unavailable' };
    }

    const characterName = runtime.character?.name?.toLowerCase() || '';
    let responseText = '';

    const statusLabel = getStatusLabel(worldHealth.health);
    const weatherEmoji = getWeatherEmoji(worldHealth.weather);

    const stats = `Health: ${worldHealth.health}% (${statusLabel})
Weather: ${weatherEmoji} ${worldHealth.weather}
24h Volume: $${formatNumber(worldHealth.totalVolume24h)}
24h Fees: ${worldHealth.totalFees24h.toFixed(2)} SOL
Active Tokens: ${worldHealth.activeTokens}`;

    if (characterName === 'ash') {
      const pokemonAnalogy = getPokemonAnalogy(worldHealth.health, worldHealth.weather);
      responseText = `let me check the bagsworld pokedex!\n\n${stats}\n\n${pokemonAnalogy}`;
    } else if (characterName === 'finn') {
      responseText = `ecosystem status:\n\n${stats}\n\n` +
        `${worldHealth.health >= 60 ? 'looking healthy. the flywheel is spinning.' : 'needs more activity. time to ship.'}`;
    } else if (characterName === 'ghost') {
      responseText = `on-chain metrics:\n\n${stats}\n\n` +
        `all numbers verifiable. check the contracts for source of truth.`;
    } else if (characterName === 'neo') {
      responseText = `*reading the matrix*\n\n${stats}\n\n` +
        `the code flows ${worldHealth.health >= 50 ? 'strong' : 'weak'}. i see ${worldHealth.weather === 'sunny' ? 'clear paths ahead' : 'turbulence in the data streams'}.`;
    } else if (characterName === 'cj') {
      responseText = `aight here's the hood report:\n\n${stats}\n\n` +
        `${worldHealth.health >= 60 ? 'streets are hot. money moving.' : 'bit quiet out here. perfect time to position.'}`;
    } else if (characterName === 'shaw') {
      responseText = `bagsworld metrics:\n\n${stats}\n\n` +
        `world state affects all agent behaviors. health drives the simulation dynamics.`;
    } else if (characterName === 'toly') {
      responseText = `gm ser, bagsworld status:\n\n${stats}\n\n` +
        `all transactions settled on solana. ${worldHealth.totalFees24h.toFixed(2)} SOL in fees today across the ecosystem.`;
    } else {
      responseText = `bagsworld status:\n\n${stats}\n\n` +
        `${worldHealth.health >= 70 ? 'ecosystem is thriving!' : worldHealth.health >= 40 ? 'steady growth. keep building!' : 'bit quiet - great time to launch!'}`;
    }

    const response = { text: responseText };
    if (callback) await callback(response);

    return {
      success: true,
      text: responseText,
      data: { worldHealth },
    };
  },
};

function getPokemonAnalogy(health: number, weather: string): string {
  if (health >= 80 && weather === 'sunny') {
    return 'bagsworld is like a fully evolved charizard - powerful and burning bright! all pokemon are happy!';
  }
  if (health >= 60) {
    return 'the ecosystem is healthy like a pokemon center - trainers are battling and trading!';
  }
  if (health >= 40) {
    return 'like a pokemon gym before a big battle - quiet but full of potential energy!';
  }
  if (weather === 'storm' || weather === 'apocalypse') {
    return 'it\'s like when team rocket attacks - challenging times but the trainers will prevail!';
  }
  return 'like early morning in pallet town - peaceful and waiting for adventure to begin!';
}

export default checkWorldHealthAction;
