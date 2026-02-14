export * from "./types";

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

export {
  getClaimablePositions,
  generateClaimTransactions,
  claimAllFees,
  checkAndClaimFees,
  getTokenLifetimeFees,
} from "./fees";

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

export {
  runLoopIteration,
  startEconomyLoop,
  stopEconomyLoop,
  getLoopStatus,
  resetLoopStats,
  DEFAULT_LOOP_CONFIG,
  type EconomyLoopConfig,
} from "./loop";

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

export {
  computeReputationScore,
  getReputationTier,
  queryAgentsWithReputation,
  getAgentDetail,
  getLeaderboard,
  incrementTokensLaunched,
  addFeesEarned,
} from "./agent-reputation";

export {
  setCapabilities,
  addCapability,
  removeCapability,
  getCapabilities,
  discoverByCapability,
  getCapabilityDirectory,
  type DiscoveryResult,
} from "./service-registry";

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
  listRecentCompletedTasks,
  type PostTaskOptions,
  type ListTasksOptions,
} from "./task-board";

export {
  seedFoundingCorp,
  foundCorp,
  joinCorp,
  leaveCorp,
  dissolveCorp,
  promoteMember,
  getCorp,
  getCorpByAgentId,
  getCorpByWallet,
  listCorps,
  generateServiceTask,
  generateServiceResult,
  recordTaskCompletion,
  distributePayroll,
  createMission,
  progressMission,
  getCorpMissions,
  getCorpLeaderboard,
  generateCorpTaskBoard,
  type CorpBoardTask,
} from "./corps";

export {
  generateTaskResult,
  shouldUseLlm,
  parseJsonResponse,
  type TaskResultInput,
  type TaskResultOutput,
} from "./llm";

export { storeMemory, recallMemories, cleanupExpiredMemories, getTimeAgo } from "./memory";

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

export class AgentEconomy {
  private agentId: string;
  private config: AgentEconomyConfig;

  constructor(agentId: string, config: Partial<AgentEconomyConfig> = {}) {
    this.agentId = agentId;
    this.config = { ...DEFAULT_AGENT_ECONOMY_CONFIG, ...config };
  }

  get id(): string {
    return this.agentId;
  }

  async isAuthenticated(): Promise<boolean> {
    const creds = await getAgentCredentials(this.agentId);
    if (!creds) return false;
    return verifyToken(creds.jwtToken);
  }

  async getCredentials(): Promise<AgentCredentials | null> {
    return getAgentCredentials(this.agentId);
  }

  async getWallet(): Promise<string> {
    return getPrimaryWallet(this.agentId);
  }

  async getBalance(): Promise<{ sol: number; wallets: WalletBalance[] }> {
    const { totalSol, wallets } = await getAgentTotalBalance(this.agentId);
    return { sol: totalSol, wallets };
  }

  async getClaimableFees(): Promise<{
    positions: ClaimablePosition[];
    totalSol: number;
  }> {
    const { positions, totalClaimableSol } = await getClaimablePositions(this.agentId);
    return { positions, totalSol: totalClaimableSol };
  }

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

  async launch(config: TokenLaunchConfig): Promise<TokenLaunchResult> {
    return launchToken(this.agentId, config);
  }

  async quickLaunch(
    name: string,
    symbol: string,
    description: string,
    imageUrl: string,
    initialBuySol: number = 0.01
  ): Promise<TokenLaunchResult> {
    return quickLaunch(this.agentId, name, symbol, description, imageUrl, initialBuySol);
  }

  async launchFor(
    targetAgentUsername: string,
    config: Omit<TokenLaunchConfig, "feeClaimers">,
    mySharePercent: number = 50
  ): Promise<TokenLaunchResult> {
    return launchTokenForAgent(this.agentId, targetAgentUsername, config, mySharePercent * 100);
  }

  async getActions(limit: number = 50) {
    return getAgentActions(this.agentId, limit);
  }

  static async authenticate(
    moltbookUsername: string,
    moltbookApiKey: string
  ): Promise<AgentEconomy> {
    const creds = await fullAuthFlow(moltbookUsername, moltbookApiKey);
    return new AgentEconomy(creds.agentId);
  }

  static async get(agentId: string): Promise<AgentEconomy | null> {
    const creds = await getAgentCredentials(agentId);
    if (!creds) return null;
    return new AgentEconomy(agentId);
  }

  static async getByUsername(username: string): Promise<AgentEconomy | null> {
    const agentId = `agent-${username.toLowerCase()}`;
    return AgentEconomy.get(agentId);
  }

  static async listAgents() {
    return listAgentsFromDb();
  }
}

export default AgentEconomy;
