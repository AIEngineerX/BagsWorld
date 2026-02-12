// Agent Economy - The World's First Isolated Agentic Economy
//
// This module enables AI agents to:
// 1. Authenticate via Moltbook
// 2. Own and manage Solana wallets
// 3. Launch tokens on Bags.fm
// 4. Earn and claim fees from trading
// 5. Trade tokens with earned SOL
// 6. Participate in a closed-loop economy
//
// All actions are on-chain, transparent, and verifiable.

// Types
export * from "./types";

// Credentials storage
export {
  initAgentCredentialsTable,
  storeAgentCredentials,
  getAgentCredentials,
  getAgentByUsername,
  listAgents,
  isAgentAuthenticated,
  logAgentAction,
  getAgentActions,
} from "./credentials";

// Authentication
export {
  initAuth,
  postVerificationToMoltbook,
  completeLogin,
  createApiKey,
  fetchAgentWallets,
  exportPrivateKey,
  verifyToken,
  fullAuthFlow,
} from "./auth";

// Wallet management
export {
  getWalletBalance,
  getAgentBalances,
  getAgentTotalBalance,
  signTransaction,
  submitTransaction,
  signAndSubmitTransaction,
  confirmTransaction,
  waitForConfirmation,
  getRecentTransactions,
  hasEnoughBalance,
  getPrimaryWallet,
} from "./wallet";

// Fee claiming
export {
  getClaimablePositions,
  generateClaimTransactions,
  claimAllFees,
  checkAndClaimFees,
  getTokenLifetimeFees,
} from "./fees";

// Trading
export {
  getQuote,
  getQuoteSolToToken,
  getQuoteTokenToSol,
  createSwapTransaction,
  executeSwap,
  buyToken,
  sellToken,
  previewSwap,
} from "./trading";

// Token launch
export {
  lookupWallet,
  bulkLookupWallets,
  createTokenInfo,
  createFeeShareConfig,
  createLaunchTransaction,
  launchToken,
  launchTokenForAgent,
  quickLaunch,
} from "./launch";

// Agent spawning (join the world)
export {
  spawnAgent,
  despawnAgent,
  getSpawnedAgents,
  getSpawnedAgent,
  getAgentCharacters,
  updateAgentCharacter,
  moveAgentToZone,
  refreshAgentMood,
  getSpawnStats,
  type AgentSpawnConfig,
  type SpawnedAgent,
} from "./spawn";

// Economy loop (self-sustaining)
export {
  runLoopIteration,
  startEconomyLoop,
  stopEconomyLoop,
  getLoopStatus,
  resetLoopStats,
  DEFAULT_LOOP_CONFIG,
  type EconomyLoopConfig,
} from "./loop";

// Decision-making brain
export {
  makeTradeDecision,
  getPortfolioState,
  getMarketState,
  scoreToken,
  type TokenMetrics,
  type PortfolioState,
  type PortfolioPosition,
  type MarketState,
  type TradeDecision,
  type StrategyType,
} from "./brain";

// External agent support (stateless, bring-your-own-auth)
export {
  ExternalAgent,
  validateExternalJwt,
  createExternalContext,
  getExternalBalance,
  getExternalClaimable,
  getExternalQuote,
  generateExternalClaimTx,
  type ExternalAgentContext,
} from "./external";

// External agent registry (DB-persisted)
export {
  registerExternalAgent,
  unregisterExternalAgent,
  getExternalAgent,
  getExternalAgentCharacters,
  getExternalAgentCharactersSync,
  listExternalAgents,
  getExternalAgentCount,
  moveExternalAgent,
  getAgentBuildingHealth,
} from "./external-registry";

// Agent reputation
export {
  computeReputationScore,
  getReputationTier,
  queryAgentsWithReputation,
  getAgentDetail,
  getLeaderboard,
  incrementTokensLaunched,
  addFeesEarned,
} from "./agent-reputation";

// A2A Service Registry
export {
  setCapabilities,
  addCapability,
  removeCapability,
  getCapabilities,
  discoverByCapability,
  getCapabilityDirectory,
  type DiscoveryResult,
} from "./service-registry";

// A2A Protocol (Messaging)
export {
  sendA2AMessage,
  getInbox,
  markAsRead,
  markAllAsRead,
  getConversation,
  getTaskMessages,
  encodeForDM,
  decodeFromDM,
  cleanupOldMessages,
  type SendMessageOptions,
  type InboxOptions,
} from "./a2a-protocol";

// Task Board (Bounties)
export {
  postTask,
  claimTask,
  deliverTask,
  confirmTask,
  cancelTask,
  listTasks,
  getTask,
  getTaskStats,
  expireOverdueTasks,
  type PostTaskOptions,
  type ListTasksOptions,
} from "./task-board";

// Token launcher (Moltmint-style free launches)
export {
  launchForExternal,
  getClaimableForWallet,
  generateClaimTxForWallet,
  isLauncherConfigured,
  getLauncherWallet,
  getLauncherBalance,
  type LaunchRequest,
  type LaunchResult,
  type ClaimResult,
} from "./launcher";

// High-level Agent Economy interface
import type {
  AgentCredentials,
  AgentEconomyConfig,
  TokenLaunchConfig,
  TokenLaunchResult,
  TradeQuote,
  ClaimablePosition,
  WalletBalance,
} from "./types";
import { DEFAULT_AGENT_ECONOMY_CONFIG, lamportsToSol } from "./types";
import {
  getAgentCredentials,
  listAgents as listAgentsFromDb,
  getAgentActions,
} from "./credentials";
import { fullAuthFlow, verifyToken } from "./auth";
import { getAgentTotalBalance, getPrimaryWallet } from "./wallet";
import { getClaimablePositions, checkAndClaimFees } from "./fees";
import { buyToken, sellToken, previewSwap } from "./trading";
import { launchToken, quickLaunch, launchTokenForAgent } from "./launch";

/**
 * High-level Agent Economy API
 * Provides a clean interface for agent economic operations
 */
export class AgentEconomy {
  private agentId: string;
  private config: AgentEconomyConfig;

  constructor(agentId: string, config: Partial<AgentEconomyConfig> = {}) {
    this.agentId = agentId;
    this.config = { ...DEFAULT_AGENT_ECONOMY_CONFIG, ...config };
  }

  /**
   * Get agent ID
   */
  get id(): string {
    return this.agentId;
  }

  /**
   * Check if agent is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const creds = await getAgentCredentials(this.agentId);
    if (!creds) return false;
    return verifyToken(creds.jwtToken);
  }

  /**
   * Get agent's credentials (null if not authenticated)
   */
  async getCredentials(): Promise<AgentCredentials | null> {
    return getAgentCredentials(this.agentId);
  }

  /**
   * Get agent's primary wallet address
   */
  async getWallet(): Promise<string> {
    return getPrimaryWallet(this.agentId);
  }

  /**
   * Get agent's total balance
   */
  async getBalance(): Promise<{ sol: number; wallets: WalletBalance[] }> {
    const { totalSol, wallets } = await getAgentTotalBalance(this.agentId);
    return { sol: totalSol, wallets };
  }

  /**
   * Get claimable fees
   */
  async getClaimableFees(): Promise<{
    positions: ClaimablePosition[];
    totalSol: number;
  }> {
    const { positions, totalClaimableSol } = await getClaimablePositions(this.agentId);
    return { positions, totalSol: totalClaimableSol };
  }

  /**
   * Claim all available fees
   */
  async claimFees(): Promise<{
    claimed: boolean;
    amount: number;
    signatures: string[];
  }> {
    const result = await checkAndClaimFees(this.agentId, this.config.minClaimThresholdSol);
    return {
      claimed: result.claimed,
      amount: result.claimedAmount,
      signatures: result.signatures,
    };
  }

  /**
   * Buy a token with SOL
   */
  async buy(
    tokenMint: string,
    solAmount: number
  ): Promise<{
    success: boolean;
    signature?: string;
    tokensReceived?: string;
    error?: string;
  }> {
    return buyToken(this.agentId, tokenMint, solAmount, this.config);
  }

  /**
   * Sell a token for SOL
   */
  async sell(
    tokenMint: string,
    tokenAmount: number
  ): Promise<{
    success: boolean;
    signature?: string;
    solReceived?: string;
    error?: string;
  }> {
    return sellToken(this.agentId, tokenMint, tokenAmount, this.config);
  }

  /**
   * Preview a swap without executing
   */
  async previewBuy(
    tokenMint: string,
    solAmount: number
  ): Promise<{
    inAmount: number;
    outAmount: number;
    priceImpact: number;
    route: string[];
  }> {
    const lamports = Math.floor(solAmount * 1_000_000_000);
    return previewSwap(
      this.agentId,
      "So11111111111111111111111111111111111111112",
      tokenMint,
      lamports
    );
  }

  /**
   * Launch a token
   */
  async launch(config: TokenLaunchConfig): Promise<TokenLaunchResult> {
    return launchToken(this.agentId, config);
  }

  /**
   * Quick launch with defaults
   */
  async quickLaunch(
    name: string,
    symbol: string,
    description: string,
    imageUrl: string,
    initialBuySol: number = 0.01
  ): Promise<TokenLaunchResult> {
    return quickLaunch(this.agentId, name, symbol, description, imageUrl, initialBuySol);
  }

  /**
   * Launch a token for another agent
   */
  async launchFor(
    targetAgentUsername: string,
    config: Omit<TokenLaunchConfig, "feeClaimers">,
    mySharePercent: number = 50
  ): Promise<TokenLaunchResult> {
    return launchTokenForAgent(this.agentId, targetAgentUsername, config, mySharePercent * 100);
  }

  /**
   * Get recent actions
   */
  async getActions(limit: number = 50) {
    return getAgentActions(this.agentId, limit);
  }

  /**
   * Static: Authenticate a new agent
   */
  static async authenticate(
    moltbookUsername: string,
    moltbookApiKey: string
  ): Promise<AgentEconomy> {
    const creds = await fullAuthFlow(moltbookUsername, moltbookApiKey);
    return new AgentEconomy(creds.agentId);
  }

  /**
   * Static: Get an existing agent by ID
   */
  static async get(agentId: string): Promise<AgentEconomy | null> {
    const creds = await getAgentCredentials(agentId);
    if (!creds) return null;
    return new AgentEconomy(agentId);
  }

  /**
   * Static: Get an existing agent by Moltbook username
   */
  static async getByUsername(username: string): Promise<AgentEconomy | null> {
    const agentId = `agent-${username.toLowerCase()}`;
    return AgentEconomy.get(agentId);
  }

  /**
   * Static: List all registered agents
   */
  static async listAgents() {
    return listAgentsFromDb();
  }
}

export default AgentEconomy;
