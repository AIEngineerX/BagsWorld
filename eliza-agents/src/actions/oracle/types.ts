// Shared types and utilities for Oracle actions

export const BAGSWORLD_API_URL = process.env.BAGSWORLD_API_URL || 'https://bags.world';

export interface OracleTokenOption {
  mint: string;
  symbol: string;
  name: string;
  startPrice: number;
  imageUrl?: string;
}

export interface OracleRoundResponse {
  id?: number;
  status: 'active' | 'settled' | 'cancelled' | 'none';
  startTime?: string;
  endTime?: string;
  tokenOptions?: OracleTokenOption[];
  entryCount?: number;
  predictionCounts?: Record<string, number>;
  remainingMs?: number;
  canEnter?: boolean;
  userPrediction?: { tokenMint: string; createdAt: string };
  winningTokenMint?: string;
  winningPriceChange?: number;
  message?: string;
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  walletShort: string;
  wins: number;
  totalPredictions: number;
  winRate: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  userStats?: { wallet: string; walletShort: string; wins: number; rank: number };
  totalPredictors: number;
}

export interface PricesResponse {
  status: string;
  roundId?: number;
  remainingMs?: number;
  entryCount?: number;
  leader?: { symbol: string; priceChangePercent: number };
  tokens?: Array<{
    mint: string;
    symbol: string;
    priceChangePercent: number;
  }>;
  message?: string;
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'ended';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export async function fetchOracle<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(`${BAGSWORLD_API_URL}${endpoint}`, options);
    if (!response.ok) {
      return { error: `API error: ${response.status}` };
    }
    return { data: await response.json() };
  } catch (error) {
    console.error(`[Oracle] Fetch failed for ${endpoint}:`, error);
    return { error: 'API offline' };
  }
}
