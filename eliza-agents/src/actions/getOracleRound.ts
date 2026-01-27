// getOracleRound Action
// Get current Oracle prediction market round

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { formatNumber } from '../utils/index.js';

const BAGSWORLD_API_URL = process.env.BAGSWORLD_API_URL || 'https://bags.world';

interface OracleTokenOption {
  mint: string;
  symbol: string;
  name: string;
  startPrice: number;
  imageUrl?: string;
}

interface OracleRoundResponse {
  id?: number;
  status: 'active' | 'settled' | 'cancelled' | 'none';
  startTime?: string;
  endTime?: string;
  tokenOptions?: OracleTokenOption[];
  entryCount?: number;
  predictionCounts?: Record<string, number>;
  remainingMs?: number;
  canEnter?: boolean;
  winningTokenMint?: string;
  winningPriceChange?: number;
  message?: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'ended';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export const getOracleRoundAction: Action = {
  name: 'getOracleRound',
  description: 'Get the current Oracle prediction market round - see which Bags.fm tokens are available to predict',

  similes: [
    'oracle round',
    'prediction market',
    'current predictions',
    'oracle status',
    'prediction round',
    'whats in the oracle',
    'oracle tower',
    'show predictions',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'whats the current oracle round?' },
      },
      {
        name: 'Bags Bot',
        content: { text: 'let me check the oracle tower for the current prediction round...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'show me the prediction market' },
      },
      {
        name: 'Neo',
        content: { text: '*scanning oracle* analyzing current prediction round...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    const hasOracleIntent = [
      'oracle',
      'prediction',
      'predict',
      'round',
      'tower',
      'forecast',
    ].some(keyword => text.includes(keyword));

    const hasViewIntent = [
      'show',
      'get',
      'check',
      'whats',
      'what is',
      'current',
      'status',
      'view',
      'see',
    ].some(keyword => text.includes(keyword));

    return hasOracleIntent && hasViewIntent;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const walletAddress = (message.content?.wallet as string) || '';
    const walletParam = walletAddress ? `?wallet=${walletAddress}` : '';

    const response = await fetch(`${BAGSWORLD_API_URL}/api/oracle/current${walletParam}`);
    const data: OracleRoundResponse = await response.json();

    const characterName = runtime.character?.name?.toLowerCase() || '';
    let responseText = '';

    if (data.status === 'none' || !data.tokenOptions) {
      responseText = characterName === 'neo'
        ? '*scanning* the oracle is silent. no active prediction round detected.'
        : 'no active prediction round right now. check back soon for the next one!';
    } else if (data.status === 'active') {
      const timeLeft = formatTimeRemaining(data.remainingMs || 0);
      const tokenList = data.tokenOptions.map(t =>
        `${t.symbol} ($${formatNumber(t.startPrice)})`
      ).join(', ');

      if (characterName === 'neo') {
        responseText = `*oracle active* round #${data.id}. ${timeLeft} remaining. ` +
          `${data.entryCount || 0} predictions locked. ` +
          `tokens in play: ${tokenList}. ` +
          `${data.canEnter ? 'entries open.' : 'entries closed - awaiting settlement.'}`;
      } else if (characterName === 'ghost') {
        responseText = `oracle round #${data.id} is live. ` +
          `${data.entryCount || 0} predictions so far. ` +
          `pick from: ${tokenList}. ` +
          `${timeLeft} left on the clock.`;
      } else {
        responseText = `oracle prediction round #${data.id} is active! ` +
          `${timeLeft} remaining with ${data.entryCount || 0} predictions. ` +
          `tokens: ${tokenList}. ` +
          `${data.canEnter ? 'you can still enter!' : 'entry deadline passed.'}`;
      }
    } else if (data.status === 'settled') {
      const winner = data.tokenOptions?.find(t => t.mint === data.winningTokenMint);
      responseText = `round #${data.id} is settled! winner: ${winner?.symbol || 'unknown'} ` +
        `with ${data.winningPriceChange?.toFixed(2)}% gain. check /oracle history for details.`;
    }

    const result = { text: responseText };

    if (callback) {
      await callback(result);
    }

    return {
      success: true,
      text: responseText,
      data: { round: data },
    };
  },
};

export default getOracleRoundAction;
