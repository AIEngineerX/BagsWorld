// getOracleLeaderboard Action - Get top Oracle predictors

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { fetchOracle, LeaderboardResponse } from './oracle/types.js';

export const getOracleLeaderboardAction: Action = {
  name: 'getOracleLeaderboard',
  description: 'Get the Oracle leaderboard - top predictors',
  similes: ['oracle leaderboard', 'top predictors', 'prediction leaders', 'best predictions', 'oracle rankings'],

  examples: [
    [
      { name: '{{name1}}', content: { text: 'who are the top oracle predictors?' } },
      { name: 'Bags Bot', content: { text: 'checking the leaderboard...' } },
    ],
  ] as ActionExample[][],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    const hasLeaderboard = ['leaderboard', 'top', 'best', 'ranking', 'winners'].some(k => text.includes(k));
    const hasOracle = ['oracle', 'prediction', 'predictor'].some(k => text.includes(k));
    return hasLeaderboard && hasOracle;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const wallet = (message.content?.wallet as string) || '';
    const { data, error } = await fetchOracle<LeaderboardResponse>(
      `/api/oracle/leaderboard${wallet ? `?wallet=${wallet}` : ''}`
    );

    if (error || !data) {
      const response = { text: 'leaderboard offline. try again.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: error || 'API error' };
    }

    const char = runtime.character?.name?.toLowerCase() || '';
    let text: string;

    if (!data.leaderboard?.length) {
      text = 'no predictions yet. be the first!';
    } else {
      const top5 = data.leaderboard.slice(0, 5)
        .map(e => `${e.rank}. ${e.walletShort} - ${e.wins} win${e.wins !== 1 ? 's' : ''} (${e.winRate}%)`)
        .join('\n');

      const userRank = data.userStats ? `\nyour rank: #${data.userStats.rank} (${data.userStats.wins} wins)` : '';
      const prefix = char === 'neo' ? '*scanning*' : 'top oracles:';
      text = `${prefix}\n${top5}${userRank}`;
    }

    if (callback) await callback({ text });
    return { success: true, text, data };
  },
};

export default getOracleLeaderboardAction;
