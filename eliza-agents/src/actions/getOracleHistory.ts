// getOracleHistory Action - View past Oracle rounds

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { fetchOracle, OracleTokenOption } from './oracle/types.js';

interface HistoryRound {
  id: number;
  status: 'settled' | 'cancelled';
  entryCount: number;
  tokenOptions: OracleTokenOption[];
  winner?: { symbol: string; priceChange: number };
  userPrediction?: { tokenMint: string; isWinner: boolean };
}

export const getOracleHistoryAction: Action = {
  name: 'getOracleHistory',
  description: 'View past Oracle prediction rounds',
  similes: ['oracle history', 'past predictions', 'previous rounds', 'past winners'],

  examples: [
    [
      { name: '{{name1}}', content: { text: 'show oracle history' } },
      { name: 'Bags Bot', content: { text: 'pulling up past rounds...' } },
    ],
  ] as ActionExample[][],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    const hasHistory = ['history', 'past', 'previous', 'last', 'results', 'winners'].some(k => text.includes(k));
    const hasOracle = ['oracle', 'prediction', 'round'].some(k => text.includes(k));
    return hasHistory && hasOracle;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const wallet = message.content?.wallet as string;
    const params = wallet ? `wallet=${wallet}&limit=5` : 'limit=5';
    const { data, error } = await fetchOracle<{ rounds: HistoryRound[] }>(`/api/oracle/history?${params}`);

    if (error || !data) {
      const response = { text: 'oracle archives offline.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: error || 'API error' };
    }

    const char = runtime.character?.name?.toLowerCase() || '';
    let text: string;

    if (!data.rounds?.length) {
      text = 'no past oracle rounds yet.';
    } else {
      const summaries = data.rounds.map(r => {
        if (r.status === 'cancelled') return `#${r.id}: cancelled`;
        const winner = r.winner ? `${r.winner.symbol} (+${r.winner.priceChange.toFixed(1)}%)` : 'no winner';
        const userNote = r.userPrediction
          ? r.userPrediction.isWinner ? ' - you won!' : ` - picked ${r.tokenOptions.find(t => t.mint === r.userPrediction?.tokenMint)?.symbol}`
          : '';
        return `#${r.id}: ${winner} (${r.entryCount})${userNote}`;
      });

      const prefix = char === 'neo' ? '*archives*' : 'past rounds:';
      text = `${prefix}\n${summaries.join('\n')}`;
    }

    if (callback) await callback({ text });
    return { success: true, text, data: { rounds: data.rounds } };
  },
};

export default getOracleHistoryAction;
