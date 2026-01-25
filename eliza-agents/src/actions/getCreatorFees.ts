// getCreatorFees Action
// Query creator fee statistics for a token

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService } from '../services/BagsApiService.js';

export const getCreatorFeesAction: Action = {
  name: 'getCreatorFees',
  description: 'Get creator fee statistics for a token on Bags.fm',

  similes: [
    'check fees',
    'creator fees',
    'fee stats',
    'how much fees',
    'earnings',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'how much fees has this token generated? 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
      },
      {
        name: 'Ghost',
        content: { text: 'let me check the fee accumulation for that token...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: "what are the creator earnings for $BAGS?" },
      },
      {
        name: 'Finn',
        content: { text: "let me pull the fee data - this is where creators really win" },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    // Check for fee-related intent
    const hasFeeIntent = [
      'fees',
      'earnings',
      'revenue',
      'claimed',
      'unclaimed',
      'creator earn',
      'how much',
    ].some(keyword => text.includes(keyword));

    // Check for mint address or token symbol
    const hasMintAddress = /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);
    const hasTokenSymbol = /\$[A-Za-z]{2,10}/.test(text);

    return hasFeeIntent && (hasMintAddress || hasTokenSymbol);
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
      let mint = mintMatch?.[0];

      // If symbol provided, search for token first
      if (!mint && symbolMatch) {
        const tokens = await api.searchTokens(symbolMatch[1]);
        mint = tokens[0]?.mint;
      }

      if (!mint) {
        const response = {
          text: "need a mint address or token symbol to check fees. paste the address and i'll pull the data.",
        };

        if (callback) {
          await callback(response);
        }

        return {
          success: false,
          text: response.text,
          error: 'No mint address provided',
        };
      }

      const fees = await api.getCreatorFees(mint);

      if (!fees) {
        const response = {
          text: "couldn't find fee data for that token. might be too new or not on bags.fm.",
        };

        if (callback) {
          await callback(response);
        }

        return {
          success: false,
          text: response.text,
          error: 'Fee data not found',
        };
      }

      // Format response based on character
      const characterName = runtime.character?.name?.toLowerCase() || '';
      let responseText = '';

      if (characterName === 'ghost') {
        responseText = `fee stats for ${mint.slice(0, 8)}...${mint.slice(-4)}: ` +
          `total: ${fees.totalFees.toFixed(4)} SOL. ` +
          `claimed: ${fees.claimedFees.toFixed(4)} SOL. ` +
          `unclaimed: ${fees.unclaimedFees.toFixed(4)} SOL. ` +
          `all verifiable on solscan.`;
      } else if (characterName === 'finn') {
        responseText = `this creator has earned ${fees.totalFees.toFixed(4)} SOL in fees! ` +
          `${fees.unclaimedFees.toFixed(4)} SOL still waiting to be claimed. ` +
          `this is real passive income - 1% of volume, forever.`;
      } else if (characterName === 'ash') {
        responseText = `fee check complete! this token has trained up ${fees.totalFees.toFixed(4)} SOL in total fees. ` +
          `${fees.claimedFees.toFixed(4)} already claimed, ${fees.unclaimedFees.toFixed(4)} ready to collect!`;
      } else {
        responseText = `fees for this token: ${fees.totalFees.toFixed(4)} SOL total. ` +
          `claimed: ${fees.claimedFees.toFixed(4)} SOL, unclaimed: ${fees.unclaimedFees.toFixed(4)} SOL.`;
      }

      const response = { text: responseText };

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        text: responseText,
        data: { fees },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('getCreatorFees error:', errorMessage);

      const response = {
        text: 'error pulling fee data. the chain might be congested - try again.',
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

export default getCreatorFeesAction;
