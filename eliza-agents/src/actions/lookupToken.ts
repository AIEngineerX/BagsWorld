// lookupToken Action
// Query token information by mint address or name

import type { Action, ActionExample, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '../types/elizaos.js';
import { BagsApiService, getBagsApiService } from '../services/BagsApiService.js';
import { formatNumber, formatAddress } from '../utils/index.js';

// Validation patterns
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SYMBOL_PATTERN = /^[A-Za-z0-9]{1,10}$/;

// System addresses that aren't valid tokens
const SYSTEM_ADDRESSES = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'So11111111111111111111111111111111111111112',
]);

// Reserved symbols that shouldn't be looked up on Bags.fm
const RESERVED_SYMBOLS = new Set(['SOL', 'WSOL', 'USDC', 'USDT']);

/** Validate Solana address format */
const isValidSolanaAddress = (addr: string): boolean =>
  SOLANA_ADDRESS_PATTERN.test(addr) && !SYSTEM_ADDRESSES.has(addr);

/** Validate token symbol format */
const isValidSymbol = (sym: string): boolean =>
  SYMBOL_PATTERN.test(sym) && !RESERVED_SYMBOLS.has(sym.toUpperCase());

/** Sanitize input text */
const sanitize = (text: string): string =>
  text.replace(/[<>'"&]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);

/** Extract first valid mint address from text */
function extractMintAddress(text: string): string | null {
  const matches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
  return matches?.find(isValidSolanaAddress) ?? null;
}

/** Extract token symbol from text (e.g., $BAGS) */
function extractTokenSymbol(text: string): string | null {
  const match = text.match(/\$([A-Za-z0-9]{1,10})/);
  if (!match?.[1]) return null;
  const symbol = match[1].toUpperCase();
  return isValidSymbol(symbol) ? symbol : null;
}

export const lookupTokenAction: Action = {
  name: 'lookupToken',
  description: 'Look up token information by mint address or name on Bags.fm',

  similes: [
    'check token',
    'find token',
    'token info',
    'search token',
    'get token',
  ],

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'can you check this token? 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
      },
      {
        name: 'Neo',
        content: { text: 'let me scan the chain for that mint address...' },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'look up $BAGS token' },
      },
      {
        name: 'Bags Bot',
        content: { text: 'checking the bags.fm api for $BAGS...' },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const rawText = message.content?.text || '';
    const text = sanitize(rawText).toLowerCase();

    if (text.length < 3) return false;

    const LOOKUP_KEYWORDS = ['check', 'lookup', 'look up', 'find', 'search', 'get', 'info', 'token', 'mint'];
    const hasLookupIntent = LOOKUP_KEYWORDS.some(kw => text.includes(kw));
    const hasIdentifier = extractMintAddress(rawText) !== null || extractTokenSymbol(rawText) !== null;

    return hasLookupIntent && hasIdentifier;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const text = sanitize(message.content?.text || '');

    // Helper to send response and return result
    const respond = async (success: boolean, text: string, error?: string, data?: unknown): Promise<ActionResult> => {
      if (callback) await callback({ text });
      const result: ActionResult = { success, text };
      if (error) result.error = error;
      if (data) result.data = data;
      return result;
    };

    if (text.length < 3 || text.length > 500) {
      return respond(false, 'invalid input - message too short or too long.', 'Invalid input length');
    }

    const mintAddress = extractMintAddress(text);
    const tokenSymbol = extractTokenSymbol(text);

    if (!mintAddress && !tokenSymbol) {
      return respond(false, 'could not find a valid token address or symbol in your message.', 'No valid token identifier');
    }

    const api = runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();

    try {
      const token = mintAddress
        ? await api.getToken(mintAddress)
        : (await api.searchTokens(tokenSymbol!))[0] ?? null;

      if (!token) {
        return respond(false, "i scanned the chain but couldn't find that token. check the address and try again.", 'Token not found');
      }

      // Format response based on character
      const char = runtime.character?.name?.toLowerCase() || '';
      const responseText = char === 'neo'
        ? `*scanning* i see it. ${token.name} (${token.symbol}). market cap: $${formatNumber(token.marketCap)}. lifetime fees: ${formatNumber(token.lifetimeFees)} SOL. the code reveals its nature.`
        : char === 'ghost'
        ? `${token.name} (${token.symbol}). lifetime fees: ${formatNumber(token.lifetimeFees)} SOL. creator: ${formatAddress(token.creator)}. check solscan to verify.`
        : `found ${token.name} (${token.symbol})! market cap: $${formatNumber(token.marketCap)}, 24h volume: $${formatNumber(token.volume24h)}, ${token.holders || 0} holders.`;

      return respond(true, responseText, undefined, { token });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('lookupToken error:', errorMessage);
      return respond(false, 'something went wrong scanning the chain. try again in a moment.', errorMessage);
    }
  },
};

export default lookupTokenAction;
