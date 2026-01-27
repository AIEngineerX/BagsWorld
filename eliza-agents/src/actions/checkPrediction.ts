// checkPrediction Action - Check user's Oracle prediction status

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { OracleRoundResponse, fetchOracle, formatTimeRemaining } from './oracle/types.js';

export const checkPredictionAction: Action = {
  name: 'checkPrediction',
  description: 'Check your prediction status in the Oracle',
  similes: ['my prediction', 'check prediction', 'did i win', 'my pick', 'prediction status'],

  examples: [
    [
      { name: '{{name1}}', content: { text: 'did i win the oracle round?' } },
      { name: 'Bags Bot', content: { text: 'let me check your prediction...' } },
    ],
  ] as ActionExample[][],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    const hasMyPrediction = ['my prediction', 'my pick', 'did i win', 'check my', 'what did i'].some(p => text.includes(p));
    const hasOracleMy = (text.includes('oracle') || text.includes('predict')) && text.includes('my');
    return hasMyPrediction || hasOracleMy;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const wallet = message.content?.wallet as string;
    if (!wallet) {
      const response = { text: 'connect your wallet to check predictions.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'No wallet' };
    }

    const { data, error } = await fetchOracle<OracleRoundResponse>(`/api/oracle/current?wallet=${wallet}`);
    if (error || !data) {
      const response = { text: 'oracle is offline. try again.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: error || 'API error' };
    }

    const char = runtime.character?.name?.toLowerCase() || '';
    let text: string;

    if (data.status === 'none') {
      text = 'no active oracle round.';
    } else if (!data.userPrediction) {
      const tokens = data.tokenOptions?.map(t => t.symbol).join(', ') || '';
      text = data.status === 'active' && tokens
        ? `you haven't entered this round. picks: ${tokens}`
        : 'you didn\'t enter this round.';
    } else {
      const token = data.tokenOptions?.find(t => t.mint === data.userPrediction?.tokenMint);
      const symbol = token?.symbol || '?';

      if (data.status === 'active') {
        const timeLeft = formatTimeRemaining(data.remainingMs || 0);
        text = char === 'neo'
          ? `*found* you picked ${symbol}. ${timeLeft} left.`
          : `you predicted ${symbol}! ${timeLeft} until results.`;
      } else if (data.status === 'settled') {
        const isWinner = data.userPrediction.tokenMint === data.winningTokenMint;
        const change = data.winningPriceChange?.toFixed(2) || '0';
        const winnerSymbol = data.tokenOptions?.find(t => t.mint === data.winningTokenMint)?.symbol || '?';

        text = isWinner
          ? (char === 'neo' ? `*winner* ${symbol} won (+${change}%)!` : `you won! ${symbol} +${change}%!`)
          : `you picked ${symbol}, but ${winnerSymbol} won (+${change}%).`;
      } else {
        text = `round cancelled. your ${symbol} prediction voided.`;
      }
    }

    if (callback) await callback({ text });
    return { success: true, text, data: { round: data } };
  },
};

export default checkPredictionAction;
