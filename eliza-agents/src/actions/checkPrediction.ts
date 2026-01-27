// checkPrediction Action
// Check user's prediction status in the Oracle

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';

const BAGSWORLD_API_URL = process.env.BAGSWORLD_API_URL || 'https://bags.world';

interface OracleTokenOption {
  mint: string;
  symbol: string;
  name: string;
  startPrice: number;
}

interface OracleRoundResponse {
  id?: number;
  status: 'active' | 'settled' | 'cancelled' | 'none';
  tokenOptions?: OracleTokenOption[];
  userPrediction?: {
    tokenMint: string;
    createdAt: string;
  };
  winningTokenMint?: string;
  winningPriceChange?: number;
  remainingMs?: number;
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

export const checkPredictionAction: Action = {
  name: 'checkPrediction',
  description: 'Check your prediction status in the Oracle prediction market',

  similes: [
    'my prediction',
    'check prediction',
    'prediction status',
    'did i win',
    'my pick',
    'what did i predict',
    'oracle status',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'did i win the oracle round?' },
      },
      {
        name: 'Bags Bot',
        content: { text: 'let me check your prediction status...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'whats my prediction' },
      },
      {
        name: 'Neo',
        content: { text: '*scanning* looking up your oracle entry...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    const hasPredictionRef = [
      'my prediction',
      'my pick',
      'my bet',
      'my entry',
      'did i win',
      'did i predict',
      'what did i',
      'check my',
      'prediction status',
    ].some(phrase => text.includes(phrase));

    const hasOracleContext = text.includes('oracle') || text.includes('predict');

    return hasPredictionRef || (hasOracleContext && text.includes('my'));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const walletAddress = message.content?.wallet as string;

    if (!walletAddress) {
      const response = { text: 'connect your wallet to check your predictions.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'No wallet connected' };
    }

    let round: OracleRoundResponse;
    try {
      const roundResponse = await fetch(`${BAGSWORLD_API_URL}/api/oracle/current?wallet=${walletAddress}`);
      if (!roundResponse.ok) {
        throw new Error(`API error: ${roundResponse.status}`);
      }
      round = await roundResponse.json();
    } catch (error) {
      console.error('[checkPrediction] Failed to fetch:', error);
      const response = { text: 'oracle is offline. try again in a moment.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'API error' };
    }

    const characterName = runtime.character?.name?.toLowerCase() || '';
    let responseText = '';

    if (round.status === 'none') {
      responseText = 'no active oracle round. check back for the next one!';
    } else if (!round.userPrediction) {
      if (round.status === 'active' && round.tokenOptions) {
        const tokens = round.tokenOptions.map(t => t.symbol).join(', ');
        responseText = `you haven't entered this round yet. available picks: ${tokens}`;
      } else {
        responseText = 'you didnt enter this round.';
      }
    } else {
      const predictedToken = round.tokenOptions?.find(t => t.mint === round.userPrediction?.tokenMint);
      const tokenSymbol = predictedToken?.symbol || 'unknown';

      if (round.status === 'active') {
        const timeLeft = formatTimeRemaining(round.remainingMs || 0);
        if (characterName === 'neo') {
          responseText = `*prediction found* you picked ${tokenSymbol}. ` +
            `${timeLeft} remaining. the oracle awaits the outcome.`;
        } else {
          responseText = `you predicted ${tokenSymbol}! ${timeLeft} left until results.`;
        }
      } else if (round.status === 'settled') {
        const isWinner = round.userPrediction.tokenMint === round.winningTokenMint;
        const winnerToken = round.tokenOptions?.find(t => t.mint === round.winningTokenMint);

        if (isWinner) {
          if (characterName === 'neo') {
            responseText = `*winner detected* you called it. ${tokenSymbol} won with ` +
              `+${round.winningPriceChange?.toFixed(2)}% gain. the matrix favored your prediction.`;
          } else if (characterName === 'ghost') {
            responseText = `you won! ${tokenSymbol} took it with +${round.winningPriceChange?.toFixed(2)}%. ` +
              `good call.`;
          } else {
            responseText = `congratulations! your pick ${tokenSymbol} won the round! ` +
              `+${round.winningPriceChange?.toFixed(2)}% gain.`;
          }
        } else {
          responseText = `you picked ${tokenSymbol}, but ${winnerToken?.symbol || 'another token'} won ` +
            `with +${round.winningPriceChange?.toFixed(2)}%. better luck next round!`;
        }
      } else {
        responseText = `round was cancelled. your ${tokenSymbol} prediction was voided.`;
      }
    }

    const result = { text: responseText };
    if (callback) await callback(result);

    return {
      success: true,
      text: responseText,
      data: { round, prediction: round.userPrediction },
    };
  },
};

export default checkPredictionAction;
