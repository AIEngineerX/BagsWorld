// lookupToken Action
// Query token information by mint address or name

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService } from '../services/BagsApiService.js';
import { formatNumber, formatAddress } from '../utils/index.js';

export const lookupTokenAction: Action = {
  name: 'lookupToken',
  description: 'Look up token information by mint address or name on Bags.fm',

  similes: [
    'check token',
    'find token',
    'token info',
    'search token',
    'get token',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'can you check this token? 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
      },
      {
        name: 'Neo',
        content: { text: 'let me scan the chain for that mint address...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'look up $BAGS token' },
      },
      {
        name: 'Bags Bot',
        content: { text: 'checking the bags.fm api for $BAGS...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    // Check for token lookup intent
    const hasLookupIntent = [
      'check',
      'lookup',
      'look up',
      'find',
      'search',
      'get',
      'info',
      'token',
      'mint',
    ].some(keyword => text.includes(keyword));

    // Check for mint address pattern (base58, 32-44 chars)
    const hasMintAddress = /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);

    // Check for token symbol pattern ($SYMBOL)
    const hasTokenSymbol = /\$[A-Za-z]{2,10}/.test(text);

    return hasLookupIntent && (hasMintAddress || hasTokenSymbol);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const text = message.content?.text || '';

    // Extract mint address
    const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const symbolMatch = text.match(/\$([A-Za-z]{2,10})/);

    // Use runtime service if available, fallback to standalone
    const api = runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();

    try {
      let token = null;

      if (mintMatch) {
        token = await api.getToken(mintMatch[0]);
      } else if (symbolMatch) {
        const tokens = await api.searchTokens(symbolMatch[1]);
        token = tokens[0] || null;
      }

      if (!token) {
        const response = {
          text: "i scanned the chain but couldn't find that token. check the address and try again.",
        };

        if (callback) {
          await callback(response);
        }

        return {
          success: false,
          text: response.text,
          error: 'Token not found',
        };
      }

      // Format response based on character
      const characterName = runtime.character?.name?.toLowerCase() || '';
      let responseText = '';

      if (characterName === 'neo') {
        responseText = `*scanning* i see it. ${token.name} (${token.symbol}). ` +
          `market cap: $${formatNumber(token.marketCap)}. ` +
          `lifetime fees: ${formatNumber(token.lifetimeFees)} SOL. ` +
          `the code reveals its nature.`;
      } else if (characterName === 'ghost') {
        responseText = `${token.name} (${token.symbol}). ` +
          `lifetime fees: ${formatNumber(token.lifetimeFees)} SOL. ` +
          `creator: ${formatAddress(token.creator)}. ` +
          `check solscan to verify.`;
      } else {
        responseText = `found ${token.name} (${token.symbol})! ` +
          `market cap: $${formatNumber(token.marketCap)}, ` +
          `24h volume: $${formatNumber(token.volume24h)}, ` +
          `${token.holders || 0} holders.`;
      }

      const response = { text: responseText };

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        text: responseText,
        data: { token },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('lookupToken error:', errorMessage);

      const response = {
        text: 'something went wrong scanning the chain. try again in a moment.',
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: false,
        text: response.text,
        error: errorMessage,
      };
    }
  },
};

export default lookupTokenAction;
