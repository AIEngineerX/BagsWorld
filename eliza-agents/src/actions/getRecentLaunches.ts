// getRecentLaunches Action
// Fetch recent token launches from Bags.fm

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService } from '../services/BagsApiService.js';
import { formatNumber, getTimeAgo } from '../utils/index.js';

export const getRecentLaunchesAction: Action = {
  name: 'getRecentLaunches',
  description: 'Get recent token launches from Bags.fm',

  similes: [
    'new launches',
    'recent tokens',
    'latest launches',
    'new tokens',
    'fresh launches',
    'just launched',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'what tokens just launched?' },
      },
      {
        name: 'Neo',
        content: { text: 'scanning for recent deployments...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'show me the latest launches' },
      },
      {
        name: 'Bags Bot',
        content: { text: 'pulling up the fresh drops...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'any new tokens today?' },
      },
      {
        name: 'Finn',
        content: { text: 'let me check what shipped recently...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    const hasLaunchIntent = [
      'new launch',
      'recent launch',
      'latest launch',
      'new token',
      'recent token',
      'just launched',
      'fresh launch',
      'fresh token',
      'today launch',
      'what launched',
      'any launches',
    ].some(phrase => text.includes(phrase));

    return hasLaunchIntent;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const text = message.content?.text?.toLowerCase() || '';

    const limitMatch = text.match(/(\d+)\s+(launch|token)/);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : 5;
    const clampedLimit = Math.min(Math.max(limit, 1), 20);

    // Use runtime service if available, fallback to standalone
    const api = runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();
    const launches = await api.getRecentLaunches(clampedLimit);

    if (launches.length === 0) {
      const response = {
        text: 'no recent launches found. either the chain is quiet or the api is catching up.',
      };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'No launches found' };
    }

    const characterName = runtime.character?.name?.toLowerCase() || '';
    let responseText = '';

    const formatLaunch = (launch: typeof launches[0]): string => {
      const timeAgo = getTimeAgo(launch.launchedAt);
      const marketCap = launch.initialMarketCap
        ? `$${formatNumber(launch.initialMarketCap)}`
        : 'TBD';
      return `${launch.name} ($${launch.symbol}) - ${timeAgo} - MC: ${marketCap}`;
    };

    const launchList = launches.map(formatLaunch).join('\n');

    if (characterName === 'neo') {
      responseText = `*matrix vision activated*\n\nnew signatures detected on the chain:\n\n${launchList}\n\n` +
        `i see them all. every deployment leaves a trace.`;
    } else if (characterName === 'finn') {
      responseText = `fresh off the launchpad:\n\n${launchList}\n\n` +
        `every token launched on bags.fm = 1% trading fees to creators forever. that's the model.`;
    } else if (characterName === 'ghost') {
      responseText = `recent deployments:\n\n${launchList}\n\n` +
        `each one's on-chain and verifiable. dyor - check the contracts.`;
    } else if (characterName === 'ash') {
      responseText = `new pokemon - i mean tokens - have appeared!\n\n${launchList}\n\n` +
        `each launch is like a new starter pokemon entering the bags.fm world!`;
    } else if (characterName === 'cj') {
      responseText = `yo new drops incoming:\n\n${launchList}\n\n` +
        `some of these might moon, some might rug. that's the game homie. stay sharp.`;
    } else if (characterName === 'shaw') {
      responseText = `new token launches detected:\n\n${launchList}\n\n` +
        `each launch creates a new autonomous economic entity. agents can interact with these on-chain.`;
    } else if (characterName === 'toly') {
      responseText = `gm, new launches on solana via bags.fm:\n\n${launchList}\n\n` +
        `sub-second finality. all settled and ready to trade.`;
    } else {
      responseText = `recent launches on bags.fm:\n\n${launchList}\n\n` +
        `creators earn 1% of all trading volume forever on their tokens. lfg!`;
    }

    const response = { text: responseText };
    if (callback) await callback(response);

    return {
      success: true,
      text: responseText,
      data: { launches, count: launches.length },
    };
  },
};

export default getRecentLaunchesAction;
