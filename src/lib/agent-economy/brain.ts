// Agent Decision-Making Brain
// The intelligence layer that decides what economic actions to take
//
// Strategies:
// - conservative: Buy established tokens with proven fee generation, minimize risk
// - diversify: Spread across multiple tokens, rebalance when over-concentrated
// - follow_whales: Track top earners, buy tokens they're earning fees from
// - aggressive: Chase high-volume tokens, accept more risk for more potential
//
// All strategies consider:
// - Current portfolio holdings
// - Token fee potential (lifetime fees, recent volume)
// - Market conditions (price trends, liquidity)
// - Position sizing and risk limits

import { Connection, PublicKey } from "@solana/web3.js";
import { getAgentCredentials } from "./credentials";
import { getAgentTotalBalance, getPrimaryWallet } from "./wallet";
import {
  lamportsToSol,
  solToLamports,
  type AgentEconomyConfig,
  DEFAULT_AGENT_ECONOMY_CONFIG,
} from "./types";
import { getRecentEvents } from "../agent-coordinator";
import { isAlphaWallet, getAlphaWallet } from "../ghost-alpha-wallets";

// ============================================================================
// TYPES
// ============================================================================

export interface TokenMetrics {
  mint: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  lifetimeFees: number;
  feesPer24h: number;
  holders: number;
  liquidity: number;
  ageHours: number;
  feeYieldPercent: number; // Annual yield from fees based on current price
}

export interface PortfolioPosition {
  mint: string;
  symbol: string;
  balance: number; // Token amount
  valueSol: number; // Current value in SOL
  percentOfPortfolio: number;
  unrealizedPnlPercent: number;
}

export interface PortfolioState {
  solBalance: number;
  totalValueSol: number;
  positions: PortfolioPosition[];
  positionCount: number;
  largestPositionPercent: number;
  diversificationScore: number; // 0-100, higher = more diversified
}

export interface MarketSignal {
  mint: string;
  symbol: string;
  type: "pump" | "dump";
  change: number;
}

export interface MarketState {
  tokens: TokenMetrics[];
  topByVolume: TokenMetrics[];
  topByFees: TokenMetrics[];
  topByYield: TokenMetrics[];
  recentLaunches: TokenMetrics[];
  averageVolume24h: number;
  averageFeeYield: number;
  recentSignals?: MarketSignal[];
}

export interface TradeDecision {
  action: "buy" | "sell" | "hold";
  tokenMint?: string;
  tokenSymbol?: string;
  amountSol?: number;
  reason: string;
  confidence: number; // 0-100
  riskLevel: "low" | "medium" | "high";
}

export type StrategyType =
  | "conservative"
  | "diversify"
  | "follow_whales"
  | "aggressive"
  | "reinvest_bagsworld";

// BagsWorld token mint - target for reinvestment strategy
const BAGSWORLD_TOKEN_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";

// ============================================================================
// MARKET DATA FETCHING
// ============================================================================

const BAGS_API_BASE = "https://api.bags.fm";
const WORLD_STATE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/world-state`
  : "http://localhost:3000/api/world-state";

interface WorldStateToken {
  mint: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  lifetimeFees: number;
  holders: number;
  creator: string;
}

interface WorldStateEarner {
  wallet: string;
  username: string;
  lifetimeEarnings: number;
  earnings24h: number;
  topToken?: WorldStateToken;
}

interface WorldStateResponse {
  buildings: Array<{
    tokenMint: string;
    name: string;
    symbol: string;
    marketCap?: number;
    volume24h?: number;
    change24h?: number;
  }>;
  population: Array<{
    id: string;
    username: string;
    earnings24h: number;
  }>;
}

async function fetchWorldState(): Promise<WorldStateResponse> {
  const response = await fetch(WORLD_STATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch world state: ${response.status} ${text}`);
  }

  return response.json();
}

async function fetchTokenDetails(mint: string): Promise<{
  lifetimeFees: number;
  holders: number;
  liquidity: number;
  createdAt: number;
} | null> {
  const bagsApiKey = process.env.BAGS_API_KEY;
  if (!bagsApiKey) return null;

  const response = await fetch(`${BAGS_API_BASE}/v1/tokens/${mint}`, {
    headers: { Authorization: `Bearer ${bagsApiKey}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return {
    lifetimeFees: data.lifetimeFees || 0,
    holders: data.holders || 0,
    liquidity: data.liquidity?.usd || 0,
    createdAt: data.createdAt || Date.now(),
  };
}

async function fetchTopEarners(): Promise<WorldStateEarner[]> {
  const bagsApiKey = process.env.BAGS_API_KEY;
  if (!bagsApiKey) return [];

  const response = await fetch(`${BAGS_API_BASE}/v1/leaderboard/earners?limit=50`, {
    headers: { Authorization: `Bearer ${bagsApiKey}` },
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.earners || [];
}

// ============================================================================
// PORTFOLIO ANALYSIS
// ============================================================================

async function fetchAgentTokenBalances(walletAddress: string): Promise<
  Array<{
    mint: string;
    balance: number;
    decimals: number;
  }>
> {
  const { getReadRpcUrl } = await import("@/lib/env-utils");
  const connection = new Connection(getReadRpcUrl(), "confirmed");

  const publicKey = new PublicKey(walletAddress);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  });

  return tokenAccounts.value
    .map((account) => {
      const parsed = account.account.data.parsed;
      const info = parsed.info;
      return {
        mint: info.mint,
        balance: parseFloat(info.tokenAmount.uiAmountString || "0"),
        decimals: info.tokenAmount.decimals,
      };
    })
    .filter((t) => t.balance > 0);
}

export async function getPortfolioState(agentId: string): Promise<PortfolioState> {
  const creds = await getAgentCredentials(agentId);
  if (!creds) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const wallet = await getPrimaryWallet(agentId);
  const { totalSol } = await getAgentTotalBalance(agentId);

  const tokenBalances = await fetchAgentTokenBalances(wallet);
  const worldState = await fetchWorldState();

  // Build price map from world state buildings
  const priceMap = new Map<string, { price: number; symbol: string }>();
  for (const building of worldState.buildings) {
    if (building.marketCap && building.marketCap > 0) {
      // Estimate price from market cap (rough approximation)
      priceMap.set(building.tokenMint, {
        price: building.marketCap / 1_000_000_000, // Assume 1B supply
        symbol: building.symbol,
      });
    }
  }

  // Calculate position values
  const positions: PortfolioPosition[] = [];
  let totalTokenValueSol = 0;

  for (const token of tokenBalances) {
    const priceInfo = priceMap.get(token.mint);
    if (!priceInfo) continue;

    const valueSol = token.balance * priceInfo.price;
    totalTokenValueSol += valueSol;

    positions.push({
      mint: token.mint,
      symbol: priceInfo.symbol,
      balance: token.balance,
      valueSol,
      percentOfPortfolio: 0, // Calculate after we have total
      unrealizedPnlPercent: 0, // No entry price tracking available
    });
  }

  const totalValueSol = totalSol + totalTokenValueSol;

  // Calculate portfolio percentages
  for (const position of positions) {
    position.percentOfPortfolio = totalValueSol > 0 ? (position.valueSol / totalValueSol) * 100 : 0;
  }

  // Sort by value descending
  positions.sort((a, b) => b.valueSol - a.valueSol);

  const largestPositionPercent = positions.length > 0 ? positions[0].percentOfPortfolio : 0;

  // Calculate diversification score
  // Perfect diversification = 100, single position = 0
  let diversificationScore = 100;
  if (positions.length > 0) {
    // Use Herfindahl-Hirschman Index (HHI) concept
    // Sum of squared market shares, inverted and normalized
    const hhi = positions.reduce((sum, p) => sum + Math.pow(p.percentOfPortfolio / 100, 2), 0);
    // HHI of 1 means single position, HHI of 1/n means equal distribution
    // Convert to 0-100 score where higher is better
    const maxHhi = 1; // Single position
    const minHhi = positions.length > 0 ? 1 / positions.length : 1;
    diversificationScore = Math.round((1 - (hhi - minHhi) / (maxHhi - minHhi)) * 100);
  }

  return {
    solBalance: totalSol,
    totalValueSol,
    positions,
    positionCount: positions.length,
    largestPositionPercent,
    diversificationScore,
  };
}

// ============================================================================
// MARKET ANALYSIS
// ============================================================================

export async function getMarketState(): Promise<MarketState> {
  const worldState = await fetchWorldState();

  const now = Date.now();
  const tokens: TokenMetrics[] = [];

  for (const building of worldState.buildings) {
    // Fetch additional details for each token
    const details = await fetchTokenDetails(building.tokenMint);

    const marketCap = building.marketCap || 0;
    const volume24h = building.volume24h || 0;
    const lifetimeFees = details?.lifetimeFees || 0;
    const createdAt = details?.createdAt || now;
    const ageHours = (now - createdAt) / (1000 * 60 * 60);

    // Estimate 24h fees as portion of lifetime based on age
    const feesPer24h = ageHours > 24 ? lifetimeFees / (ageHours / 24) : lifetimeFees;

    // Calculate fee yield (annualized)
    // Fee yield = (annual fees / market cap) * 100
    const annualFees = feesPer24h * 365;
    const feeYieldPercent = marketCap > 0 ? (annualFees / marketCap) * 100 : 0;

    tokens.push({
      mint: building.tokenMint,
      name: building.name,
      symbol: building.symbol,
      price: marketCap / 1_000_000_000, // Estimate
      marketCap,
      volume24h,
      change24h: building.change24h || 0,
      lifetimeFees,
      feesPer24h,
      holders: details?.holders || 0,
      liquidity: details?.liquidity || 0,
      ageHours,
      feeYieldPercent,
    });
  }

  // Sort by different criteria
  const topByVolume = [...tokens].sort((a, b) => b.volume24h - a.volume24h).slice(0, 10);
  const topByFees = [...tokens].sort((a, b) => b.lifetimeFees - a.lifetimeFees).slice(0, 10);
  const topByYield = [...tokens]
    .filter((t) => t.marketCap > 10000) // Filter out tiny caps
    .sort((a, b) => b.feeYieldPercent - a.feeYieldPercent)
    .slice(0, 10);
  const recentLaunches = [...tokens]
    .filter((t) => t.ageHours < 24)
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 10);

  const averageVolume24h =
    tokens.length > 0 ? tokens.reduce((sum, t) => sum + t.volume24h, 0) / tokens.length : 0;
  const averageFeeYield =
    tokens.length > 0 ? tokens.reduce((sum, t) => sum + t.feeYieldPercent, 0) / tokens.length : 0;

  // Pull recent price signals from coordinator events (last 6 hours)
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  const pumpEvents = getRecentEvents(20, "token_pump").filter((e) => e.timestamp > sixHoursAgo);
  const dumpEvents = getRecentEvents(20, "token_dump").filter((e) => e.timestamp > sixHoursAgo);

  const recentSignals: MarketSignal[] = [
    ...pumpEvents.map((e) => ({
      mint: (e.data as any)?.mint || "",
      symbol: (e.data as any)?.symbol || "TOKEN",
      type: "pump" as const,
      change: (e.data as any)?.change || 0,
    })),
    ...dumpEvents.map((e) => ({
      mint: (e.data as any)?.mint || "",
      symbol: (e.data as any)?.symbol || "TOKEN",
      type: "dump" as const,
      change: (e.data as any)?.change || 0,
    })),
  ];

  return {
    tokens,
    topByVolume,
    topByFees,
    topByYield,
    recentLaunches,
    averageVolume24h,
    averageFeeYield,
    recentSignals,
  };
}

// ============================================================================
// TOKEN SCORING
// ============================================================================

interface TokenScore {
  token: TokenMetrics;
  overallScore: number; // 0-100
  feeScore: number;
  volumeScore: number;
  stabilityScore: number;
  liquidityScore: number;
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
}

function scoreToken(token: TokenMetrics, market: MarketState): TokenScore {
  // Fee Score (0-100): Based on fee yield relative to market average
  const feeScore = Math.min(
    100,
    (token.feeYieldPercent / Math.max(market.averageFeeYield, 0.01)) * 50
  );

  // Volume Score (0-100): Based on volume relative to market average
  const volumeScore = Math.min(100, (token.volume24h / Math.max(market.averageVolume24h, 1)) * 50);

  // Stability Score (0-100): Lower volatility and longer age = higher score
  const ageBonus = Math.min(50, (token.ageHours / 24) * 10); // Up to 50 points for age
  const volatilityPenalty = Math.min(50, Math.abs(token.change24h) / 2); // Penalize high volatility
  const stabilityScore = 50 + ageBonus - volatilityPenalty;

  // Liquidity Score (0-100): Higher liquidity = safer to trade
  const liquidityScore = Math.min(100, (token.liquidity / 10000) * 100);

  // Overall Score: Weighted average
  const overallScore =
    feeScore * 0.35 + // Fees matter most for income
    volumeScore * 0.25 + // Volume indicates activity
    stabilityScore * 0.25 + // Stability reduces risk
    liquidityScore * 0.15; // Liquidity for exit ability

  // Recommendation based on score
  let recommendation: TokenScore["recommendation"];
  if (overallScore >= 80) recommendation = "strong_buy";
  else if (overallScore >= 60) recommendation = "buy";
  else if (overallScore >= 40) recommendation = "hold";
  else if (overallScore >= 20) recommendation = "sell";
  else recommendation = "strong_sell";

  return {
    token,
    overallScore,
    feeScore,
    volumeScore,
    stabilityScore,
    liquidityScore,
    recommendation,
  };
}

// ============================================================================
// STRATEGY IMPLEMENTATIONS
// ============================================================================

async function conservativeStrategy(
  portfolio: PortfolioState,
  market: MarketState,
  availableSol: number,
  config: AgentEconomyConfig
): Promise<TradeDecision> {
  // Conservative: Only buy established tokens with proven fee generation
  // Requirements:
  // - Token age > 48 hours (proven survivor)
  // - Lifetime fees > 1 SOL (has generated real revenue)
  // - Market cap > 50,000 (not micro cap)
  // - Volume24h > 1000 (active trading)
  // - Fee yield > average (worth holding for income)

  const eligibleTokens = market.tokens.filter(
    (t) =>
      t.ageHours > 48 &&
      t.lifetimeFees > 1 &&
      t.marketCap > 50000 &&
      t.volume24h > 1000 &&
      t.feeYieldPercent > market.averageFeeYield
  );

  if (eligibleTokens.length === 0) {
    return {
      action: "hold",
      reason: "No tokens meet conservative criteria (age > 48h, fees > 1 SOL, mcap > 50k)",
      confidence: 90,
      riskLevel: "low",
    };
  }

  // Score all eligible tokens
  const scored = eligibleTokens.map((t) => scoreToken(t, market));
  scored.sort((a, b) => b.overallScore - a.overallScore);

  const bestToken = scored[0];

  // Check if we already hold this token
  const existingPosition = portfolio.positions.find((p) => p.mint === bestToken.token.mint);
  if (existingPosition && existingPosition.percentOfPortfolio > 20) {
    // Already have significant position, look for second best
    if (scored.length > 1) {
      const secondBest = scored[1];
      const secondExisting = portfolio.positions.find((p) => p.mint === secondBest.token.mint);
      if (!secondExisting || secondExisting.percentOfPortfolio < 15) {
        return {
          action: "buy",
          tokenMint: secondBest.token.mint,
          tokenSymbol: secondBest.token.symbol,
          amountSol: Math.min(availableSol * 0.3, config.maxPositionSol),
          reason: `Diversifying into ${secondBest.token.symbol} (score: ${secondBest.overallScore.toFixed(1)}, fee yield: ${secondBest.token.feeYieldPercent.toFixed(2)}%)`,
          confidence: Math.round(secondBest.overallScore * 0.8),
          riskLevel: "low",
        };
      }
    }

    return {
      action: "hold",
      reason: `Already have ${existingPosition.percentOfPortfolio.toFixed(1)}% in ${bestToken.token.symbol}, holding`,
      confidence: 85,
      riskLevel: "low",
    };
  }

  // Only buy if score is good enough
  if (bestToken.overallScore < 50) {
    return {
      action: "hold",
      reason: `Best token ${bestToken.token.symbol} score (${bestToken.overallScore.toFixed(1)}) below threshold (50)`,
      confidence: 70,
      riskLevel: "low",
    };
  }

  // Position size: Conservative uses smaller positions
  const positionSize = Math.min(
    availableSol * 0.25, // Max 25% of available
    config.maxPositionSol * 0.5 // Half of max allowed
  );

  return {
    action: "buy",
    tokenMint: bestToken.token.mint,
    tokenSymbol: bestToken.token.symbol,
    amountSol: positionSize,
    reason: `Conservative buy: ${bestToken.token.symbol} (score: ${bestToken.overallScore.toFixed(1)}, fees: ${bestToken.token.lifetimeFees.toFixed(2)} SOL, yield: ${bestToken.token.feeYieldPercent.toFixed(2)}%)`,
    confidence: Math.round(bestToken.overallScore * 0.9),
    riskLevel: "low",
  };
}

async function diversifyStrategy(
  portfolio: PortfolioState,
  market: MarketState,
  availableSol: number,
  config: AgentEconomyConfig
): Promise<TradeDecision> {
  // Diversify: Spread across multiple tokens, rebalance when over-concentrated
  // Goals:
  // - Hold 5-10 different tokens
  // - No single position > 25% of portfolio
  // - Sell if position grows > 30%
  // - Buy underweight good tokens

  const targetPositionCount = 7;
  const maxPositionPercent = 25;
  const sellThresholdPercent = 30;
  const minPositionPercent = 5;

  // Check for over-concentrated positions to sell
  const overweightPositions = portfolio.positions.filter(
    (p) => p.percentOfPortfolio > sellThresholdPercent
  );

  if (overweightPositions.length > 0) {
    const toSell = overweightPositions[0];
    const excessPercent = toSell.percentOfPortfolio - maxPositionPercent;
    const sellAmountSol = (excessPercent / 100) * portfolio.totalValueSol;

    return {
      action: "sell",
      tokenMint: toSell.mint,
      tokenSymbol: toSell.symbol,
      amountSol: sellAmountSol,
      reason: `Rebalancing: ${toSell.symbol} is ${toSell.percentOfPortfolio.toFixed(1)}% of portfolio (target max: ${maxPositionPercent}%)`,
      confidence: 85,
      riskLevel: "low",
    };
  }

  // If we have fewer positions than target, buy new tokens
  if (portfolio.positionCount < targetPositionCount) {
    // Find tokens we don't own yet
    const ownedMints = new Set(portfolio.positions.map((p) => p.mint));
    const unownedTokens = market.tokens.filter(
      (t) =>
        !ownedMints.has(t.mint) && t.marketCap > 10000 && t.volume24h > 500 && t.lifetimeFees > 0.1
    );

    if (unownedTokens.length === 0) {
      return {
        action: "hold",
        reason: "No suitable unowned tokens found for diversification",
        confidence: 70,
        riskLevel: "low",
      };
    }

    // Score and pick the best unowned token
    const scored = unownedTokens.map((t) => scoreToken(t, market));
    scored.sort((a, b) => b.overallScore - a.overallScore);

    const bestUnowned = scored[0];

    // Target position size based on equal weighting
    const targetSizePercent = 100 / targetPositionCount;
    const targetSizeSol = (targetSizePercent / 100) * portfolio.totalValueSol;
    const buyAmount = Math.min(targetSizeSol, availableSol * 0.5, config.maxPositionSol);

    return {
      action: "buy",
      tokenMint: bestUnowned.token.mint,
      tokenSymbol: bestUnowned.token.symbol,
      amountSol: buyAmount,
      reason: `Diversifying: Adding ${bestUnowned.token.symbol} (score: ${bestUnowned.overallScore.toFixed(1)}) as position ${portfolio.positionCount + 1}/${targetPositionCount}`,
      confidence: Math.round(bestUnowned.overallScore * 0.85),
      riskLevel: "medium",
    };
  }

  // Find underweight positions to add to
  const underweightPositions = portfolio.positions.filter(
    (p) => p.percentOfPortfolio < minPositionPercent
  );

  if (underweightPositions.length > 0 && availableSol > config.minTradeSol) {
    // Add to the best underweight position
    const scoredUnderweight = underweightPositions
      .map((p) => {
        const tokenMetrics = market.tokens.find((t) => t.mint === p.mint);
        if (!tokenMetrics) return null;
        return { position: p, score: scoreToken(tokenMetrics, market) };
      })
      .filter((x): x is { position: PortfolioPosition; score: TokenScore } => x !== null);

    if (scoredUnderweight.length > 0) {
      scoredUnderweight.sort((a, b) => b.score.overallScore - a.score.overallScore);
      const best = scoredUnderweight[0];

      const targetSizePercent = 100 / targetPositionCount;
      const currentSizeSol = best.position.valueSol;
      const targetSizeSol = (targetSizePercent / 100) * portfolio.totalValueSol;
      const addAmount = Math.min(
        targetSizeSol - currentSizeSol,
        availableSol * 0.3,
        config.maxPositionSol - currentSizeSol
      );

      if (addAmount > config.minTradeSol) {
        return {
          action: "buy",
          tokenMint: best.position.mint,
          tokenSymbol: best.position.symbol,
          amountSol: addAmount,
          reason: `Rebalancing: Adding to underweight ${best.position.symbol} (${best.position.percentOfPortfolio.toFixed(1)}% → target ${targetSizePercent.toFixed(1)}%)`,
          confidence: Math.round(best.score.overallScore * 0.8),
          riskLevel: "low",
        };
      }
    }
  }

  return {
    action: "hold",
    reason: `Portfolio balanced: ${portfolio.positionCount} positions, diversification score ${portfolio.diversificationScore}`,
    confidence: 80,
    riskLevel: "low",
  };
}

async function followWhalesStrategy(
  agentId: string,
  portfolio: PortfolioState,
  market: MarketState,
  availableSol: number,
  config: AgentEconomyConfig
): Promise<TradeDecision> {
  // Follow Whales: Track top earners, buy tokens they're earning fees from
  // The logic: If whales are earning fees from a token, it has trading activity
  // which means fee generation is real and ongoing
  //
  // Ghost's edge: cross-reference earners and token creators against 518 tracked
  // alpha wallets. When a known smart money wallet is earning fees or created a
  // token, Ghost's confidence in that token increases significantly.
  //
  // NOTE: Exit logic (stop-loss, take-profit, stale exits) is NOT implemented here.
  // The agent-economy brain is an API-callable suggestion engine, not an autonomous trader.
  // Real autonomous trading + exit management is handled by GhostTrader in eliza-agents/.

  // --- BUY LOGIC ---
  const topEarners = await fetchTopEarners();

  if (topEarners.length === 0) {
    // Fallback to market's top fee-generating tokens
    if (market.topByFees.length === 0) {
      return {
        action: "hold",
        reason: "No whale data or top fee tokens available",
        confidence: 50,
        riskLevel: "medium",
      };
    }

    const bestFeeToken = market.topByFees[0];
    const existingPosition = portfolio.positions.find((p) => p.mint === bestFeeToken.mint);

    if (existingPosition && existingPosition.percentOfPortfolio > 15) {
      return {
        action: "hold",
        reason: `Already holding ${existingPosition.percentOfPortfolio.toFixed(1)}% in top fee token ${bestFeeToken.symbol}`,
        confidence: 70,
        riskLevel: "low",
      };
    }

    return {
      action: "buy",
      tokenMint: bestFeeToken.mint,
      tokenSymbol: bestFeeToken.symbol,
      amountSol: Math.min(availableSol * 0.4, config.maxPositionSol),
      reason: `Following fees: ${bestFeeToken.symbol} has ${bestFeeToken.lifetimeFees.toFixed(2)} SOL lifetime fees`,
      confidence: 65,
      riskLevel: "medium",
    };
  }

  // Analyze whale positions, cross-referencing against alpha wallet list
  const whaleMintCounts = new Map<
    string,
    {
      count: number;
      totalEarnings: number;
      token?: WorldStateToken;
      alphaEarnerCount: number;
      alphaCreator: boolean;
    }
  >();

  for (const earner of topEarners) {
    if (earner.topToken) {
      const mint = earner.topToken.mint;
      const existing = whaleMintCounts.get(mint) || {
        count: 0,
        totalEarnings: 0,
        alphaEarnerCount: 0,
        alphaCreator: false,
      };
      existing.count++;
      existing.totalEarnings += earner.earnings24h;
      existing.token = earner.topToken;

      // Check if this earner is a known alpha wallet
      if (isAlphaWallet(earner.wallet)) {
        existing.alphaEarnerCount++;
      }

      // Check if the token creator is a known alpha wallet
      if (earner.topToken.creator && isAlphaWallet(earner.topToken.creator)) {
        existing.alphaCreator = true;
      }

      whaleMintCounts.set(mint, existing);
    }
  }

  // Sort by score: alpha wallet involvement weighted heavily
  const whaleTokens = Array.from(whaleMintCounts.entries())
    .map(([mint, data]) => ({
      mint,
      whaleCount: data.count,
      totalWhaleEarnings: data.totalEarnings,
      token: data.token,
      alphaEarnerCount: data.alphaEarnerCount,
      alphaCreator: data.alphaCreator,
      // Alpha wallets earning from a token is the strongest signal
      score:
        data.count * 10 +
        data.totalEarnings +
        data.alphaEarnerCount * 25 + // Each alpha earner = 25 bonus points
        (data.alphaCreator ? 30 : 0), // Alpha-created token = 30 bonus
    }))
    .filter((t) => t.token)
    .sort((a, b) => b.score - a.score);

  if (whaleTokens.length === 0) {
    return {
      action: "hold",
      reason: "No whale token data available",
      confidence: 50,
      riskLevel: "medium",
    };
  }

  // Find the best whale token we don't over-own
  for (const whaleToken of whaleTokens) {
    const existingPosition = portfolio.positions.find((p) => p.mint === whaleToken.mint);

    if (existingPosition && existingPosition.percentOfPortfolio > 20) {
      continue; // Skip tokens we already have large positions in
    }

    // Alpha involvement = bigger position + higher confidence + lower risk
    const hasAlphaSignal = whaleToken.alphaEarnerCount > 0 || whaleToken.alphaCreator;
    const positionMultiplier = hasAlphaSignal ? 0.45 : 0.35;
    const positionSize = Math.min(availableSol * positionMultiplier, config.maxPositionSol);
    const confidenceBoost = whaleToken.alphaEarnerCount * 5 + (whaleToken.alphaCreator ? 10 : 0);

    // Build reason string
    let reason = `Following whales: ${whaleToken.whaleCount} top earners in ${whaleToken.token!.symbol}, ${whaleToken.totalWhaleEarnings.toFixed(2)} SOL earned 24h`;
    if (whaleToken.alphaEarnerCount > 0) {
      reason += ` | ${whaleToken.alphaEarnerCount} alpha wallet(s) earning`;
    }
    if (whaleToken.alphaCreator) {
      reason += " | alpha-created token";
    }

    return {
      action: "buy",
      tokenMint: whaleToken.mint,
      tokenSymbol: whaleToken.token!.symbol,
      amountSol: positionSize,
      reason,
      confidence: Math.min(95, 50 + whaleToken.whaleCount * 5 + confidenceBoost),
      riskLevel: hasAlphaSignal ? "low" : "medium",
    };
  }

  return {
    action: "hold",
    reason: "Already holding positions in all whale-favored tokens",
    confidence: 75,
    riskLevel: "low",
  };
}

async function aggressiveStrategy(
  portfolio: PortfolioState,
  market: MarketState,
  availableSol: number,
  config: AgentEconomyConfig
): Promise<TradeDecision> {
  // Aggressive: Chase momentum, buy high-volume tokens, accept higher risk
  // Focus on:
  // - Recent launches with high volume (momentum plays)
  // - Tokens with strong positive price action
  // - Higher position sizes
  // - Quicker rotations

  // Check for over-concentrated positions (>30% of portfolio in one token)
  const overConcentrated = portfolio.positions.filter((p) => p.percentOfPortfolio > 30);

  if (overConcentrated.length > 0) {
    const toTrim = overConcentrated[0];
    const sellPercent = 0.3;
    const sellAmountSol = toTrim.valueSol * sellPercent;

    return {
      action: "sell",
      tokenMint: toTrim.mint,
      tokenSymbol: toTrim.symbol,
      amountSol: sellAmountSol,
      reason: `Rebalancing: ${toTrim.symbol} is ${toTrim.percentOfPortfolio.toFixed(0)}% of portfolio, trimming 30%`,
      confidence: 80,
      riskLevel: "medium",
    };
  }

  // Look for momentum plays in recent launches
  if (market.recentLaunches.length > 0) {
    const hotLaunches = market.recentLaunches.filter(
      (t) =>
        t.volume24h > market.averageVolume24h * 2 && // 2x average volume
        t.change24h > 0 && // Positive momentum
        t.marketCap > 5000 // Not dust
    );

    if (hotLaunches.length > 0) {
      // Score by momentum
      const scored = hotLaunches
        .map((t) => ({
          token: t,
          momentumScore: (t.volume24h / market.averageVolume24h) * (1 + t.change24h / 100),
        }))
        .sort((a, b) => b.momentumScore - a.momentumScore);

      const hottest = scored[0];
      const existingPosition = portfolio.positions.find((p) => p.mint === hottest.token.mint);

      if (!existingPosition || existingPosition.percentOfPortfolio < 10) {
        const positionSize = Math.min(
          availableSol * 0.5, // Aggressive uses larger positions
          config.maxPositionSol
        );

        return {
          action: "buy",
          tokenMint: hottest.token.mint,
          tokenSymbol: hottest.token.symbol,
          amountSol: positionSize,
          reason: `Momentum play: ${hottest.token.symbol} launched ${hottest.token.ageHours.toFixed(1)}h ago, ${(hottest.token.volume24h / 1000).toFixed(1)}k volume, +${hottest.token.change24h.toFixed(1)}%`,
          confidence: 60,
          riskLevel: "high",
        };
      }
    }
  }

  // Look for high-volume tokens with positive momentum
  const momentumTokens = market.topByVolume.filter(
    (t) =>
      t.change24h > 5 && // At least 5% up
      t.volume24h > market.averageVolume24h
  );

  if (momentumTokens.length > 0) {
    const best = momentumTokens[0];
    const existingPosition = portfolio.positions.find((p) => p.mint === best.mint);

    if (!existingPosition || existingPosition.percentOfPortfolio < 15) {
      return {
        action: "buy",
        tokenMint: best.mint,
        tokenSymbol: best.symbol,
        amountSol: Math.min(availableSol * 0.4, config.maxPositionSol),
        reason: `Volume leader: ${best.symbol} with ${(best.volume24h / 1000).toFixed(1)}k volume, +${best.change24h.toFixed(1)}%`,
        confidence: 55,
        riskLevel: "high",
      };
    }
  }

  // Fallback: Buy the highest fee yield token
  if (market.topByYield.length > 0) {
    const bestYield = market.topByYield[0];
    const existingPosition = portfolio.positions.find((p) => p.mint === bestYield.mint);

    if (!existingPosition || existingPosition.percentOfPortfolio < 20) {
      return {
        action: "buy",
        tokenMint: bestYield.mint,
        tokenSymbol: bestYield.symbol,
        amountSol: Math.min(availableSol * 0.35, config.maxPositionSol),
        reason: `Yield hunting: ${bestYield.symbol} with ${bestYield.feeYieldPercent.toFixed(2)}% yield`,
        confidence: 65,
        riskLevel: "medium",
      };
    }
  }

  return {
    action: "hold",
    reason: "No aggressive opportunities found meeting criteria",
    confidence: 60,
    riskLevel: "low",
  };
}

async function reinvestBagsWorldStrategy(
  portfolio: PortfolioState,
  market: MarketState,
  availableSol: number,
  config: AgentEconomyConfig
): Promise<TradeDecision> {
  // Reinvest BagsWorld Strategy: Buy BagsWorld token with all claimed fees
  // This is the default strategy for agent economy - all earnings go back into BagsWorld
  //
  // Simple rules:
  // - Always buy BagsWorld token
  // - Use 100% of available SOL (from claimed fees)
  // - No selling, only accumulating
  // - Confidence is always high because this is the programmed behavior

  // Minimum buy amount check
  if (availableSol < config.minTradeSol) {
    return {
      action: "hold",
      reason: `Available SOL (${availableSol.toFixed(6)}) below minimum trade size`,
      confidence: 100,
      riskLevel: "low",
    };
  }

  // Check if BagsWorld token exists in market data
  const bagsWorldToken = market.tokens.find((t) => t.mint === BAGSWORLD_TOKEN_MINT);

  if (!bagsWorldToken) {
    // Even without market data, we can still buy with the known mint
    return {
      action: "buy",
      tokenMint: BAGSWORLD_TOKEN_MINT,
      tokenSymbol: "BAGSWORLD",
      amountSol: Math.min(availableSol, config.maxPositionSol),
      reason: `Reinvesting ${availableSol.toFixed(6)} SOL into BagsWorld token`,
      confidence: 95,
      riskLevel: "low",
    };
  }

  // With market data, we can provide more context
  const existingPosition = portfolio.positions.find((p) => p.mint === BAGSWORLD_TOKEN_MINT);
  const currentHolding = existingPosition?.valueSol || 0;

  return {
    action: "buy",
    tokenMint: BAGSWORLD_TOKEN_MINT,
    tokenSymbol: bagsWorldToken.symbol,
    amountSol: Math.min(availableSol, config.maxPositionSol),
    reason: `Reinvesting ${availableSol.toFixed(6)} SOL into BagsWorld (current holding: ${currentHolding.toFixed(4)} SOL, price: $${bagsWorldToken.price.toFixed(6)})`,
    confidence: 95,
    riskLevel: "low",
  };
}

// ============================================================================
// MAIN DECISION FUNCTION
// ============================================================================

export async function makeTradeDecision(
  agentId: string,
  strategy: StrategyType,
  availableSol: number,
  config: Partial<AgentEconomyConfig> = {}
): Promise<TradeDecision> {
  const fullConfig = { ...DEFAULT_AGENT_ECONOMY_CONFIG, ...config };

  // Don't trade if below minimum
  if (availableSol < fullConfig.minTradeSol) {
    return {
      action: "hold",
      reason: `Available SOL (${availableSol.toFixed(4)}) below minimum trade size (${fullConfig.minTradeSol})`,
      confidence: 100,
      riskLevel: "low",
    };
  }

  // Get current state
  const [portfolio, market] = await Promise.all([getPortfolioState(agentId), getMarketState()]);

  // Log state for debugging
  console.log(`[Brain] Agent ${agentId} state:`, {
    strategy,
    availableSol: availableSol.toFixed(4),
    portfolioValue: portfolio.totalValueSol.toFixed(4),
    positionCount: portfolio.positionCount,
    diversificationScore: portfolio.diversificationScore,
    marketTokens: market.tokens.length,
  });

  // No tokens available = can't trade
  if (market.tokens.length === 0) {
    return {
      action: "hold",
      reason: "No tokens available in market",
      confidence: 100,
      riskLevel: "low",
    };
  }

  // Execute strategy
  switch (strategy) {
    case "conservative":
      return conservativeStrategy(portfolio, market, availableSol, fullConfig);

    case "diversify":
      return diversifyStrategy(portfolio, market, availableSol, fullConfig);

    case "follow_whales":
      return followWhalesStrategy(agentId, portfolio, market, availableSol, fullConfig);

    case "aggressive":
      return aggressiveStrategy(portfolio, market, availableSol, fullConfig);

    case "reinvest_bagsworld":
      return reinvestBagsWorldStrategy(portfolio, market, availableSol, fullConfig);

    default:
      return {
        action: "hold",
        reason: `Unknown strategy: ${strategy}`,
        confidence: 0,
        riskLevel: "low",
      };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { scoreToken, fetchWorldState, fetchTopEarners };
