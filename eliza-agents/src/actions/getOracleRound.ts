// getOracleRound Action - View current Oracle prediction round

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { OracleRoundResponse, fetchOracle, formatTimeRemaining } from './oracle/types.js';
import { formatNumber } from '../utils/index.js';

export const getOracleRoundAction: Action = {
  name: 'getOracleRound',
  description: 'Get the current Oracle prediction market round',
  similes: ['oracle round', 'prediction market', 'oracle status', 'oracle tower', 'show predictions'],

  examples: [
    [
      { name: '{{name1}}', content: { text: 'whats the current oracle round?' } },
      { name: 'Bags Bot', content: { text: 'let me check the oracle tower...' } },
    ],
  ] as ActionExample[][],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    const hasOracle = ['oracle', 'prediction', 'tower', 'forecast'].some(k => text.includes(k));
    const hasView = ['show', 'get', 'check', 'whats', 'current', 'status', 'view'].some(k => text.includes(k));
    return hasOracle && hasView;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const wallet = (message.content?.wallet as string) || '';
    const { data, error } = await fetchOracle<OracleRoundResponse>(
      `/api/oracle/current${wallet ? `?wallet=${wallet}` : ''}`
    );

    if (error || !data) {
      const response = { text: 'oracle is offline. try again in a moment.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: error || 'API error' };
    }

    const char = runtime.character?.name?.toLowerCase() || '';
    let text: string;

    if (data.status === 'none' || !data.tokenOptions) {
      text = char === 'neo'
        ? '*scanning* the oracle is silent. no active round.'
        : 'no active prediction round. check back soon!';
    } else if (data.status === 'active') {
      const timeLeft = formatTimeRemaining(data.remainingMs || 0);
      const tokens = data.tokenOptions.map(t => `${t.symbol} ($${formatNumber(t.startPrice)})`).join(', ');
      const entries = data.entryCount || 0;
      const status = data.canEnter ? 'entries open' : 'entries closed';

      text = char === 'neo'
        ? `*oracle active* round #${data.id}. ${timeLeft} left. ${entries} predictions. tokens: ${tokens}. ${status}.`
        : `oracle round #${data.id} is live! ${timeLeft} left, ${entries} predictions. tokens: ${tokens}. ${status}.`;
    } else {
      const winner = data.tokenOptions?.find(t => t.mint === data.winningTokenMint);
      text = `round #${data.id} settled! winner: ${winner?.symbol || '?'} (+${data.winningPriceChange?.toFixed(2)}%)`;
    }

    if (callback) await callback({ text });
    return { success: true, text, data: { round: data } };
  },
};

export default getOracleRoundAction;
