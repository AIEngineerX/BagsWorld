// getOracleHistory Action
// View past Oracle prediction rounds

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';

const BAGSWORLD_API_URL = process.env.BAGSWORLD_API_URL || 'https://bags.world';

interface OracleTokenOption {
  mint: string;
  symbol: string;
  name: string;
  startPrice: number;
}

interface HistoryRound {
  id: number;
  status: 'settled' | 'cancelled';
  startTime: string;
  endTime: string;
  tokenOptions: OracleTokenOption[];
  entryCount: number;
  winner?: {
    mint: string;
    symbol: string;
    name: string;
    priceChange: number;
  };
  userPrediction?: {
    tokenMint: string;
    isWinner: boolean;
    createdAt: string;
  };
}

interface HistoryResponse {
  rounds: HistoryRound[];
}

export const getOracleHistoryAction: Action = {
  name: 'getOracleHistory',
  description: 'View past Oracle prediction rounds and results',

  similes: [
    'oracle history',
    'past predictions',
    'previous rounds',
    'prediction history',
    'past winners',
    'old rounds',
    'oracle results',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'show me oracle history' },
      },
      {
        name: 'Bags Bot',
        content: { text: 'pulling up past prediction rounds...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'who won the last prediction round?' },
      },
      {
        name: 'Neo',
        content: { text: '*accessing archives* scanning past oracle rounds...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    const hasHistoryIntent = [
      'history',
      'past',
      'previous',
      'old',
      'last',
      'results',
      'winners',
      'archive',
    ].some(keyword => text.includes(keyword));

    const hasOracleContext = [
      'oracle',
      'prediction',
      'round',
    ].some(keyword => text.includes(keyword));

    return hasHistoryIntent && hasOracleContext;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const walletAddress = message.content?.wallet as string;
    const walletParam = walletAddress ? `wallet=${walletAddress}&` : '';

    let data: HistoryResponse;
    try {
      const response = await fetch(`${BAGSWORLD_API_URL}/api/oracle/history?${walletParam}limit=5`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error('[getOracleHistory] Failed to fetch:', error);
      const errorResponse = { text: 'oracle archives offline. try again in a moment.' };
      if (callback) await callback(errorResponse);
      return { success: false, text: errorResponse.text, error: 'API error' };
    }

    const characterName = runtime.character?.name?.toLowerCase() || '';
    let responseText = '';

    if (!data.rounds || data.rounds.length === 0) {
      responseText = 'no past oracle rounds yet. be the first to predict!';
    } else {
      const roundSummaries = data.rounds.map(round => {
        if (round.status === 'cancelled') {
          return `round #${round.id}: cancelled`;
        }

        const winnerInfo = round.winner
          ? `${round.winner.symbol} (+${round.winner.priceChange.toFixed(1)}%)`
          : 'no winner';

        let userResult = '';
        if (round.userPrediction) {
          const predictedToken = round.tokenOptions.find(t => t.mint === round.userPrediction?.tokenMint);
          userResult = round.userPrediction.isWinner
            ? ` - you won with ${predictedToken?.symbol}!`
            : ` - you picked ${predictedToken?.symbol}`;
        }

        return `#${round.id}: ${winnerInfo} (${round.entryCount} entries)${userResult}`;
      });

      if (characterName === 'neo') {
        responseText = `*archives accessed* past oracle rounds:\n${roundSummaries.join('\n')}`;
      } else if (characterName === 'ghost') {
        responseText = `oracle history:\n${roundSummaries.join('\n')}\nall results verifiable on-chain.`;
      } else {
        responseText = `past oracle rounds:\n${roundSummaries.join('\n')}`;
      }
    }

    const result = { text: responseText };
    if (callback) await callback(result);

    return {
      success: true,
      text: responseText,
      data: { rounds: data.rounds },
    };
  },
};

export default getOracleHistoryAction;
