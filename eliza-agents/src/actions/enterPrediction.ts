// enterPrediction Action - Submit a prediction for the Oracle

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { OracleRoundResponse, fetchOracle, BAGSWORLD_API_URL } from './oracle/types.js';

export const enterPredictionAction: Action = {
  name: 'enterPrediction',
  description: 'Submit a prediction for a token in the Oracle',
  similes: ['predict token', 'enter prediction', 'bet on', 'pick token', 'i think', 'will pump'],

  examples: [
    [
      { name: '{{name1}}', content: { text: 'i predict $BAGS will win' } },
      { name: 'Bags Bot', content: { text: 'submitting your prediction...' } },
    ],
  ] as ActionExample[][],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    const hasIntent = ['predict', 'bet', 'pick', 'i think', 'will win', 'will pump'].some(k => text.includes(k));
    const hasToken = /\$[A-Za-z]{2,10}/.test(text) || /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);
    return hasIntent && hasToken;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const text = message.content?.text || '';
    const wallet = message.content?.wallet as string;

    if (!wallet) {
      const response = { text: 'connect your wallet to enter a prediction.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'No wallet' };
    }

    // Get current round
    const { data: round, error } = await fetchOracle<OracleRoundResponse>(`/api/oracle/current?wallet=${wallet}`);
    if (error || !round) {
      const response = { text: 'oracle is offline. try again.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: error || 'API error' };
    }

    // Validate round state
    if (round.status !== 'active' || !round.tokenOptions) {
      const response = { text: 'no active prediction round.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'No round' };
    }
    if (!round.canEnter) {
      const response = { text: 'entry deadline passed.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'Deadline passed' };
    }
    if (round.userPrediction) {
      const token = round.tokenOptions.find(t => t.mint === round.userPrediction?.tokenMint);
      const response = { text: `already predicted ${token?.symbol || '?'}. one per wallet!` };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'Already entered' };
    }

    // Find token
    const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const symbolMatch = text.match(/\$([A-Za-z]{2,10})/) || text.match(/\b([A-Z]{2,10})\b/);
    const target = mintMatch
      ? round.tokenOptions.find(t => t.mint === mintMatch[0])
      : symbolMatch
        ? round.tokenOptions.find(t => t.symbol.toUpperCase() === symbolMatch[1].toUpperCase())
        : undefined;

    if (!target) {
      const available = round.tokenOptions.map(t => t.symbol).join(', ');
      const response = { text: `token not in round. available: ${available}` };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'Invalid token' };
    }

    // Submit
    try {
      const res = await fetch(`${BAGSWORLD_API_URL}/api/oracle/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, tokenMint: target.mint }),
      });
      const result = await res.json();

      const char = runtime.character?.name?.toLowerCase() || '';
      const responseText = result.success
        ? (char === 'neo'
            ? `*locked* ${target.symbol}. may the code be with you.`
            : `prediction locked: ${target.symbol}!`)
        : `failed: ${result.error || 'unknown error'}`;

      if (callback) await callback({ text: responseText });
      return { success: result.success, text: responseText, data: { token: target } };
    } catch {
      const response = { text: 'failed to submit. try again.' };
      if (callback) await callback(response);
      return { success: false, text: response.text, error: 'Submit failed' };
    }
  },
};

export default enterPredictionAction;
