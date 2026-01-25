// getTopCreators Action
// Fetch the top creators leaderboard from Bags.fm

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService } from '../services/BagsApiService.js';

export const getTopCreatorsAction: Action = {
  name: 'getTopCreators',
  description: 'Get the top creators leaderboard from Bags.fm ranked by fees generated',

  similes: [
    'top creators',
    'leaderboard',
    'who is winning',
    'best creators',
    'creator rankings',
    'fee leaderboard',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'who are the top creators right now?' },
      },
      {
        name: 'Finn',
        content: { text: 'checking the leaderboard...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'show me the creator leaderboard' },
      },
      {
        name: 'Ghost',
        content: { text: 'pulling the on-chain fee data...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'who is making the most fees?' },
      },
      {
        name: 'Neo',
        content: { text: 'scanning the chain for top performers...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    const hasLeaderboardIntent = [
      'top creator',
      'leaderboard',
      'ranking',
      'who is winning',
      'who is making',
      'best creator',
      'most fees',
      'highest fees',
      'creator stats',
    ].some(phrase => text.includes(phrase));

    return hasLeaderboardIntent;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const text = message.content?.text?.toLowerCase() || '';

    const limitMatch = text.match(/top\s+(\d+)/);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : 5;
    const clampedLimit = Math.min(Math.max(limit, 1), 25);

    // Use runtime service if available, fallback to standalone
    const api = runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();
    const creators = await api.getTopCreators(clampedLimit);

    if (creators.length === 0) {
      const response = {
        text: 'no creator data available right now. the api might be updating.',
      };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'No data available' };
    }

    const characterName = runtime.character?.name?.toLowerCase() || '';
    let responseText = '';

    const formatCreator = (creator: typeof creators[0], rank: number): string => {
      const name = creator.name || `${creator.address.slice(0, 6)}...${creator.address.slice(-4)}`;
      return `${rank}. ${name}: ${creator.totalFees.toFixed(2)} SOL`;
    };

    const leaderboard = creators.map((c, i) => formatCreator(c, i + 1)).join('\n');

    if (characterName === 'finn') {
      responseText = `here's who's crushing it on bags.fm:\n\n${leaderboard}\n\n` +
        `remember: top 3 split the rewards pool 50/30/20. that's real passive income.`;
    } else if (characterName === 'ghost') {
      responseText = `current leaderboard by lifetime fees generated:\n\n${leaderboard}\n\n` +
        `all verifiable on-chain. check solscan if you want receipts.`;
    } else if (characterName === 'neo') {
      responseText = `*scanning the matrix*\n\nthe code reveals the leaders:\n\n${leaderboard}\n\n` +
        `patterns emerge. success leaves traces in the chain.`;
    } else if (characterName === 'cj') {
      responseText = `aight check it, these the ones making bread:\n\n${leaderboard}\n\n` +
        `respect the hustle. stack or get stacked on homie.`;
    } else if (characterName === 'ash') {
      responseText = `here are the top trainers in the bags.fm league!\n\n${leaderboard}\n\n` +
        `it's like the pokemon league - top 3 get the prize pool rewards!`;
    } else if (characterName === 'shaw') {
      responseText = `creator leaderboard data:\n\n${leaderboard}\n\n` +
        `the fee-sharing mechanism creates aligned incentives. creators earn proportionally to value generated.`;
    } else if (characterName === 'toly') {
      responseText = `gm ser, here's the current standings:\n\n${leaderboard}\n\n` +
        `proof of value creation. all fees settled on solana in ~400ms.`;
    } else {
      responseText = `top creators on bags.fm:\n\n${leaderboard}\n\n` +
        `top 3 creators share the rewards pool (50/30/20 split). keep building!`;
    }

    const response = { text: responseText };
    if (callback) await callback(response);

    return {
      success: true,
      text: responseText,
      data: { creators, count: creators.length },
    };
  },
};

export default getTopCreatorsAction;
