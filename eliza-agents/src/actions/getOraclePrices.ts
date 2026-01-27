// getOraclePrices Action - Get live price changes for Oracle round

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { fetchOracle, PricesResponse, formatTimeRemaining } from './oracle/types.js';

export const getOraclePricesAction: Action = {
  name: 'getOraclePrices',
  description: 'Get live price changes for tokens in the Oracle round',
  similes: ['oracle prices', 'price changes', 'who is winning', 'current leader', 'live prices'],

  examples: [
    [
      { name: '{{name1}}', content: { text: 'which token is winning the oracle?' } },
      { name: 'Neo', content: { text: '*checking* scanning live prices...' } },
    ],
  ] as ActionExample[][],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    const hasPrice = ['price', 'winning', 'leader', 'leading', 'up', 'down', 'pump'].some(k => text.includes(k));
    const hasOracle = ['oracle', 'prediction', 'round', 'tower'].some(k => text.includes(k));
    return hasPrice && hasOracle;
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const { data, error } = await fetchOracle<PricesResponse>('/api/oracle/prices');

    if (error || !data) {
      const response = { text: 'prices offline. try again.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: error || 'API error' };
    }

    const char = runtime.character?.name?.toLowerCase() || '';
    let text: string;

    if (data.status === 'none' || !data.tokens) {
      text = data.message || 'no active oracle round.';
    } else {
      const timeLeft = formatTimeRemaining(data.remainingMs || 0);
      const tokenList = data.tokens
        .map(t => `${t.symbol}: ${t.priceChangePercent >= 0 ? '+' : ''}${t.priceChangePercent}%`)
        .join('\n');

      const leader = data.leader;
      const leaderStr = leader ? `leader: $${leader.symbol} (+${leader.priceChangePercent}%)` : '';

      text = char === 'neo'
        ? `*live* round #${data.roundId} - ${timeLeft}\n\n${tokenList}\n\n${leaderStr}`
        : char === 'cj'
          ? `yo ${timeLeft} left!\n${tokenList}\n$${leader?.symbol} in the lead!`
          : `round #${data.roundId} - ${timeLeft}\n${tokenList}\n${leaderStr}`;
    }

    if (callback) await callback({ text });
    return { success: true, text, data };
  },
};

export default getOraclePricesAction;
