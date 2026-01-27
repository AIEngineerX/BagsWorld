// Oracle Data Provider
// Injects current Oracle prediction market state into agent context

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '../types/elizaos.js';

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
  entryCount?: number;
  remainingMs?: number;
  canEnter?: boolean;
  winningTokenMint?: string;
  winningPriceChange?: number;
}

// Cache to avoid excessive API calls
let oracleCache: { data: OracleRoundResponse; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 1000; // 30 seconds

async function getOracleRound(): Promise<OracleRoundResponse> {
  const now = Date.now();

  if (oracleCache && (now - oracleCache.timestamp) < CACHE_DURATION) {
    return oracleCache.data;
  }

  const response = await fetch(`${BAGSWORLD_API_URL}/api/oracle/current`);
  const data: OracleRoundResponse = await response.json();

  oracleCache = { data, timestamp: now };
  return data;
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

export const oracleDataProvider: Provider = {
  name: 'oracleData',
  description: 'Provides current Oracle prediction market round information',

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
  ): Promise<ProviderResult> => {
    const round = await getOracleRound();

    if (round.status === 'none' || !round.tokenOptions) {
      return {
        text: 'Oracle Status: No active prediction round.',
        oracleActive: false,
      };
    }

    const timeLeft = formatTimeRemaining(round.remainingMs || 0);
    const tokens = round.tokenOptions.map(t => `${t.symbol} ($${t.startPrice.toFixed(6)})`).join(', ');

    let statusText = '';

    if (round.status === 'active') {
      statusText = `Oracle Round #${round.id} ACTIVE:\n` +
        `- Time remaining: ${timeLeft}\n` +
        `- Entries: ${round.entryCount || 0}\n` +
        `- Can enter: ${round.canEnter ? 'Yes' : 'No (deadline passed)'}\n` +
        `- Token options: ${tokens}\n` +
        `Users can predict which token will gain the most by the round end.`;
    } else if (round.status === 'settled') {
      const winner = round.tokenOptions.find(t => t.mint === round.winningTokenMint);
      statusText = `Oracle Round #${round.id} SETTLED:\n` +
        `- Winner: ${winner?.symbol || 'Unknown'}\n` +
        `- Price change: +${round.winningPriceChange?.toFixed(2)}%\n` +
        `Round complete. Next round coming soon.`;
    } else {
      statusText = `Oracle Round #${round.id}: ${round.status}`;
    }

    return {
      text: statusText,
      oracleActive: round.status === 'active',
      oracleRound: round,
      canEnterPrediction: round.canEnter || false,
      tokenOptions: round.tokenOptions,
    };
  },
};

export default oracleDataProvider;
