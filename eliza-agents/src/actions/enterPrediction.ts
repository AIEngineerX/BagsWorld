// enterPrediction Action
// Submit a prediction for the Oracle prediction market

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
  canEnter?: boolean;
  userPrediction?: {
    tokenMint: string;
    createdAt: string;
  };
}

interface EnterPredictionResponse {
  success: boolean;
  error?: string;
  roundId?: number;
  tokenMint?: string;
}

export const enterPredictionAction: Action = {
  name: 'enterPrediction',
  description: 'Submit a prediction for a Bags.fm token in the Oracle prediction market',

  similes: [
    'predict token',
    'enter prediction',
    'bet on',
    'pick token',
    'choose token',
    'submit prediction',
    'oracle predict',
    'i think',
    'will pump',
    'will moon',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'i predict $BAGS will win' },
      },
      {
        name: 'Bags Bot',
        content: { text: 'submitting your prediction for $BAGS in the oracle...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'enter my prediction for PUMP token' },
      },
      {
        name: 'Neo',
        content: { text: '*processing* locking in your prediction for PUMP...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'bet on 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
      },
      {
        name: 'Ghost',
        content: { text: 'entering your prediction for that mint...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';

    const hasPredictionIntent = [
      'predict',
      'bet',
      'pick',
      'choose',
      'enter',
      'submit',
      'i think',
      'will win',
      'will pump',
      'will moon',
      'going to pump',
    ].some(keyword => text.includes(keyword));

    // Check for token reference (symbol or mint)
    const hasTokenSymbol = /\$[A-Za-z]{2,10}/.test(text) || /\b[A-Z]{2,10}\b/.test(message.content?.text || '');
    const hasMintAddress = /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);

    return hasPredictionIntent && (hasTokenSymbol || hasMintAddress);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const text = message.content?.text || '';
    const walletAddress = message.content?.wallet as string;

    if (!walletAddress) {
      const response = { text: 'you need to connect your wallet to enter a prediction.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'No wallet connected' };
    }

    // Extract token reference
    const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const symbolMatch = text.match(/\$([A-Za-z]{2,10})/) || text.match(/\b([A-Z]{2,10})\b/);

    // Get current round to find the token
    let round: OracleRoundResponse;
    try {
      const roundResponse = await fetch(`${BAGSWORLD_API_URL}/api/oracle/current?wallet=${walletAddress}`);
      if (!roundResponse.ok) {
        throw new Error(`API error: ${roundResponse.status}`);
      }
      round = await roundResponse.json();
    } catch (error) {
      console.error('[enterPrediction] Failed to fetch round:', error);
      const response = { text: 'oracle is offline. try again in a moment.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'API error' };
    }

    if (round.status !== 'active' || !round.tokenOptions) {
      const response = { text: 'no active prediction round. wait for the next one!' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'No active round' };
    }

    if (!round.canEnter) {
      const response = { text: 'entry deadline has passed for this round. catch the next one!' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'Entry deadline passed' };
    }

    if (round.userPrediction) {
      const existingToken = round.tokenOptions.find(t => t.mint === round.userPrediction?.tokenMint);
      const response = { text: `you already predicted ${existingToken?.symbol || 'a token'} this round. one prediction per wallet!` };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'Already entered' };
    }

    // Find matching token in round options
    let targetToken: OracleTokenOption | undefined;

    if (mintMatch) {
      targetToken = round.tokenOptions.find(t => t.mint === mintMatch[0]);
    } else if (symbolMatch) {
      const symbol = symbolMatch[1].toUpperCase();
      targetToken = round.tokenOptions.find(t => t.symbol.toUpperCase() === symbol);
    }

    if (!targetToken) {
      const availableTokens = round.tokenOptions.map(t => t.symbol).join(', ');
      const response = { text: `that token isn't in this round. available picks: ${availableTokens}` };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'Token not in round' };
    }

    // Submit prediction
    let enterData: EnterPredictionResponse;
    try {
      const enterResponse = await fetch(`${BAGSWORLD_API_URL}/api/oracle/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          tokenMint: targetToken.mint,
        }),
      });
      enterData = await enterResponse.json();
    } catch (error) {
      console.error('[enterPrediction] Failed to submit:', error);
      const response = { text: 'failed to submit prediction. try again.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'Submission failed' };
    }

    const characterName = runtime.character?.name?.toLowerCase() || '';
    let responseText = '';

    if (enterData.success) {
      if (characterName === 'neo') {
        responseText = `*prediction locked* your pick: ${targetToken.symbol}. ` +
          `the oracle has recorded your choice. may the code be with you.`;
      } else if (characterName === 'ghost') {
        responseText = `locked in ${targetToken.symbol}. ` +
          `prediction recorded on-chain. we'll see who called it right.`;
      } else {
        responseText = `your prediction for ${targetToken.symbol} is locked in! ` +
          `good luck - winner announced when the round ends.`;
      }
    } else {
      responseText = `couldn't submit prediction: ${enterData.error || 'unknown error'}`;
    }

    const result = { text: responseText };
    if (callback) await callback(result);

    return {
      success: enterData.success,
      text: responseText,
      data: { token: targetToken, roundId: round.id },
    };
  },
};

export default enterPredictionAction;
