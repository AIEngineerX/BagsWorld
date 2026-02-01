// Agent Economy Types
// Core type definitions for the BagsWorld Agentic Economy

/**
 * Agent credentials stored securely server-side
 */
export interface AgentCredentials {
  agentId: string;
  moltbookUsername: string;
  jwtToken: string;
  apiKey: string;
  wallets: string[];
  authenticatedAt: Date;
  expiresAt: Date; // JWT expires after 365 days
}

/**
 * Auth session during Moltbook verification
 */
export interface AuthSession {
  publicIdentifier: string;
  secret: string;
  agentUsername: string;
  agentUserId: string;
  verificationPostContent: string;
  createdAt: Date;
  expiresAt: Date; // 15 minute expiry
}

/**
 * Claimable fee position from a token
 */
export interface ClaimablePosition {
  baseMint: string;
  quoteMint?: string;
  virtualPoolAddress?: string;
  virtualPool?: string;
  virtualPoolClaimableAmount?: string;
  virtualPoolClaimableLamportsUserShare?: string;
  dammPoolClaimableAmount?: string;
  totalClaimableLamports: number;
  totalClaimableLamportsUserShare?: string;
  isCustomFeeVault: boolean;
  customFeeVaultBps?: number;
  isMigrated: boolean;
  programId?: string;
}

/**
 * Trade quote from Bags API
 */
export interface TradeQuote {
  requestId: string;
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: Array<{
    venue: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
  }>;
  platformFee?: {
    amount: string;
    feeBps: number;
    feeAccount: string;
  };
}

/**
 * Token launch configuration
 */
export interface TokenLaunchConfig {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitter?: string;
  website?: string;
  telegram?: string;
  initialBuyLamports?: number;
  feeClaimers: Array<{
    user: string; // Wallet address
    userBps: number; // Basis points (10000 = 100%)
  }>;
}

/**
 * Token launch result
 */
export interface TokenLaunchResult {
  tokenMint: string;
  metadataUrl: string;
  configKey: string;
  signature: string;
  bagsUrl: string;
  solscanUrl: string;
}

/**
 * Agent wallet balance
 */
export interface WalletBalance {
  address: string;
  lamports: number;
  sol: number;
}

/**
 * Agent action types for logging/events
 */
export type AgentActionType = "auth" | "claim_fees" | "trade" | "launch_token" | "check_balance";

/**
 * Agent action log entry
 */
export interface AgentAction {
  id: string;
  agentId: string;
  actionType: AgentActionType;
  timestamp: Date;
  data: Record<string, unknown>;
  signature?: string;
  success: boolean;
  error?: string;
}

/**
 * Agent economy configuration
 */
export interface AgentEconomyConfig {
  // Risk management
  maxPositionSol: number; // Max SOL per trade
  maxTotalExposureSol: number; // Max total open positions
  minClaimThresholdSol: number; // Min amount to bother claiming
  minTradeSol: number; // Min SOL for a trade to be worth executing

  // Trading
  defaultSlippageBps: number;
  maxPriceImpactPct: number;

  // Behavior
  autoClaimEnabled: boolean;
  autoTradeEnabled: boolean;
  claimCheckIntervalMs: number;
}

/**
 * Default agent economy config
 */
export const DEFAULT_AGENT_ECONOMY_CONFIG: AgentEconomyConfig = {
  maxPositionSol: 0.15,
  maxTotalExposureSol: 1.5,
  minClaimThresholdSol: 0.001,
  minTradeSol: 0.005,
  defaultSlippageBps: 100, // 1%
  maxPriceImpactPct: 5,
  autoClaimEnabled: true,
  autoTradeEnabled: false, // Requires explicit enable
  claimCheckIntervalMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Bags API response wrapper
 */
export interface BagsApiResponse<T> {
  success: boolean;
  response?: T;
  error?: string;
}

/**
 * Common token addresses
 */
export const COMMON_TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
} as const;

/**
 * Bags API base URLs
 */
export const BAGS_API = {
  AGENT_BASE: "https://public-api-v2.bags.fm/api/v1/agent",
  PUBLIC_BASE: "https://public-api-v2.bags.fm/api/v1",
} as const;

/**
 * Lamports conversion helpers
 */
export const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number | string): number {
  const l = typeof lamports === "string" ? parseInt(lamports, 10) : lamports;
  return l / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}
