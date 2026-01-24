// Trading Dojo - Adversarial AI Sparring System
// Spar against AI opponents using real historical Bags.fm price data
// Each opponent has a distinct trading style and tries to beat you

const ELIZAOS_SERVER =
  process.env.NEXT_PUBLIC_ELIZAOS_SERVER_URL || "https://bagsworld-production.up.railway.app";

// ============================================================================
// TYPES
// ============================================================================

export type Belt = "white" | "yellow" | "green" | "blue" | "purple" | "black";

export interface DojoOpponent {
  id: string;
  name: string;
  style: string;
  description: string;
  color: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  requiredBelt: Belt;
  tradingTraits: {
    aggression: number; // 0-1: how often they trade
    patience: number; // 0-1: how long they hold
    riskTolerance: number; // 0-1: position sizing
    technicalWeight: number; // 0-1: reliance on TA vs intuition
  };
}

export interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  id: string;
  timestamp: number;
  candleIndex: number;
  type: "buy" | "sell";
  price: number;
  amount: number; // SOL amount
  tokenAmount: number;
  trader: "player" | string; // player or agentId
}

export interface Position {
  tokenAmount: number;
  avgEntryPrice: number;
  totalCost: number;
}

export interface SparSession {
  id: string;
  opponentId: string;
  tokenSymbol: string;
  tokenMint: string;
  startTime: number;
  endTime?: number;
  status: "active" | "completed" | "abandoned";
  // Price data
  candles: PriceCandle[];
  currentCandleIndex: number;
  playbackSpeed: number; // 1 = realtime, 10 = 10x speed
  // Balances
  playerSol: number;
  playerPosition: Position;
  opponentSol: number;
  opponentPosition: Position;
  // Trade history
  playerTrades: Trade[];
  opponentTrades: Trade[];
  // Results
  winner?: "player" | "opponent" | "draw";
  playerFinalValue?: number;
  opponentFinalValue?: number;
  playerPnlPercent?: number;
  opponentPnlPercent?: number;
}

export interface PlayerStats {
  belt: Belt;
  totalSpars: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestWinStreak: number;
  totalPnl: number;
  avgPnlPerSpar: number;
  opponentStats: Record<string, { wins: number; losses: number }>;
  lastSparTime: number;
}

export interface CoachingFeedback {
  opponentId: string;
  sessionId: string;
  overallGrade: "S" | "A" | "B" | "C" | "D" | "F";
  message: string;
  strengths: string[];
  improvements: string[];
  specificTrades: Array<{
    tradeIndex: number;
    assessment: "good" | "neutral" | "mistake";
    reason: string;
  }>;
}

// ============================================================================
// OPPONENTS
// ============================================================================

export const DOJO_OPPONENTS: DojoOpponent[] = [
  {
    id: "neo",
    name: "Neo",
    style: "Pattern Recognition",
    description: "Sees the matrix of price action. Trades breakouts and breakdowns with precision.",
    color: "#00ff41",
    difficulty: 3,
    requiredBelt: "yellow",
    tradingTraits: {
      aggression: 0.4,
      patience: 0.7,
      riskTolerance: 0.5,
      technicalWeight: 0.95,
    },
  },
  {
    id: "ghost",
    name: "Ghost",
    style: "On-Chain Analysis",
    description: "Follows the money. Tracks whale wallets and smart money movements.",
    color: "#8b5cf6",
    difficulty: 4,
    requiredBelt: "green",
    tradingTraits: {
      aggression: 0.3,
      patience: 0.8,
      riskTolerance: 0.4,
      technicalWeight: 0.6,
    },
  },
  {
    id: "shaw",
    name: "Shaw",
    style: "Systematic",
    description: "Algorithmic precision. Never emotional, always calculated entries and exits.",
    color: "#f97316",
    difficulty: 5,
    requiredBelt: "blue",
    tradingTraits: {
      aggression: 0.5,
      patience: 0.6,
      riskTolerance: 0.3,
      technicalWeight: 0.85,
    },
  },
  {
    id: "cj",
    name: "CJ",
    style: "Trench Warfare",
    description: "Survived the trenches. High risk, high reward. All or nothing plays.",
    color: "#22c55e",
    difficulty: 2,
    requiredBelt: "white",
    tradingTraits: {
      aggression: 0.8,
      patience: 0.2,
      riskTolerance: 0.9,
      technicalWeight: 0.3,
    },
  },
  {
    id: "ash",
    name: "Ash",
    style: "Momentum Rider",
    description: "Catches trends early and rides them. Quick to cut losses.",
    color: "#ef4444",
    difficulty: 1,
    requiredBelt: "white",
    tradingTraits: {
      aggression: 0.6,
      patience: 0.4,
      riskTolerance: 0.6,
      technicalWeight: 0.5,
    },
  },
];

// ============================================================================
// BELT SYSTEM
// ============================================================================

const BELT_ORDER: Belt[] = ["white", "yellow", "green", "blue", "purple", "black"];

const BELT_REQUIREMENTS: Record<Belt, { wins: number; minWinRate: number }> = {
  white: { wins: 0, minWinRate: 0 },
  yellow: { wins: 3, minWinRate: 0.4 },
  green: { wins: 10, minWinRate: 0.45 },
  blue: { wins: 25, minWinRate: 0.5 },
  purple: { wins: 50, minWinRate: 0.55 },
  black: { wins: 100, minWinRate: 0.6 },
};

export function getBeltColor(belt: Belt): string {
  const colors: Record<Belt, string> = {
    white: "#f5f5f5",
    yellow: "#fbbf24",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#8b5cf6",
    black: "#1f2937",
  };
  return colors[belt];
}

export function getBeltIndex(belt: Belt): number {
  return BELT_ORDER.indexOf(belt);
}

export function canChallenge(playerBelt: Belt, opponent: DojoOpponent): boolean {
  const playerBeltIndex = getBeltIndex(playerBelt);
  const requiredBeltIndex = getBeltIndex(opponent.requiredBelt);
  return playerBeltIndex >= requiredBeltIndex;
}

export function checkBeltPromotion(stats: PlayerStats): Belt | null {
  const currentIndex = getBeltIndex(stats.belt);
  if (currentIndex >= BELT_ORDER.length - 1) return null;

  const nextBelt = BELT_ORDER[currentIndex + 1];
  const requirements = BELT_REQUIREMENTS[nextBelt];
  const winRate = stats.totalSpars > 0 ? stats.wins / stats.totalSpars : 0;

  if (stats.wins >= requirements.wins && winRate >= requirements.minWinRate) {
    return nextBelt;
  }

  return null;
}

// ============================================================================
// SESSION STATE
// ============================================================================

let currentSession: SparSession | null = null;
let playerStats: PlayerStats = loadPlayerStats();

function loadPlayerStats(): PlayerStats {
  if (typeof window === "undefined") {
    return getDefaultStats();
  }

  const saved = localStorage.getItem("dojo_player_stats");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return getDefaultStats();
    }
  }
  return getDefaultStats();
}

function getDefaultStats(): PlayerStats {
  return {
    belt: "white",
    totalSpars: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winStreak: 0,
    bestWinStreak: 0,
    totalPnl: 0,
    avgPnlPerSpar: 0,
    opponentStats: {},
    lastSparTime: 0,
  };
}

function savePlayerStats(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("dojo_player_stats", JSON.stringify(playerStats));
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export async function startSpar(
  opponentId: string,
  tokenSymbol: string,
  tokenMint: string
): Promise<SparSession | null> {
  const opponent = DOJO_OPPONENTS.find((o) => o.id === opponentId);
  if (!opponent) return null;

  if (!canChallenge(playerStats.belt, opponent)) {
    console.warn("[Dojo] Belt too low to challenge this opponent");
    return null;
  }

  // Fetch historical price data
  const candles = await fetchHistoricalCandles(tokenMint, tokenSymbol);
  if (!candles || candles.length < 20) {
    console.warn("[Dojo] Insufficient price data for spar");
    return null;
  }

  const startingSol = 10; // Both start with 10 SOL

  const session: SparSession = {
    id: `spar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    opponentId,
    tokenSymbol,
    tokenMint,
    startTime: Date.now(),
    status: "active",
    candles,
    currentCandleIndex: 0,
    playbackSpeed: 1,
    playerSol: startingSol,
    playerPosition: { tokenAmount: 0, avgEntryPrice: 0, totalCost: 0 },
    opponentSol: startingSol,
    opponentPosition: { tokenAmount: 0, avgEntryPrice: 0, totalCost: 0 },
    playerTrades: [],
    opponentTrades: [],
  };

  currentSession = session;
  return session;
}

export function getCurrentSession(): SparSession | null {
  return currentSession;
}

export function getPlayerStats(): PlayerStats {
  return { ...playerStats };
}

// ============================================================================
// PRICE DATA
// ============================================================================

async function fetchHistoricalCandles(
  tokenMint: string,
  tokenSymbol: string
): Promise<PriceCandle[]> {
  try {
    // Try DexScreener for historical data
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`
    );

    if (!response.ok) {
      return generateSyntheticCandles(tokenSymbol);
    }

    const data = await response.json();
    const pair = data.pairs?.[0];

    if (!pair) {
      return generateSyntheticCandles(tokenSymbol);
    }

    // DexScreener doesn't provide OHLC, so we generate from price history
    // In production, you'd want to use a proper OHLC API
    return generateCandlesFromPair(pair);
  } catch (error) {
    console.error("[Dojo] Error fetching candles:", error);
    return generateSyntheticCandles(tokenSymbol);
  }
}

function generateCandlesFromPair(pair: any): PriceCandle[] {
  const candles: PriceCandle[] = [];
  const currentPrice = parseFloat(pair.priceUsd) || 0.001;
  const priceChange24h = pair.priceChange?.h24 || 0;

  // Generate 60 candles (representing 60 hours of data)
  const basePrice = currentPrice / (1 + priceChange24h / 100);
  const volatility = Math.abs(priceChange24h) / 100 + 0.05;

  let price = basePrice;

  for (let i = 0; i < 60; i++) {
    const changePercent = (Math.random() - 0.5) * volatility * 2;
    const trendBias = (priceChange24h / 100) / 60; // Gradual trend

    const open = price;
    const change = price * (changePercent + trendBias);
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = (pair.volume?.h24 || 10000) / 60 * (0.5 + Math.random());

    candles.push({
      timestamp: Date.now() - (60 - i) * 3600000,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return candles;
}

function generateSyntheticCandles(symbol: string): PriceCandle[] {
  const candles: PriceCandle[] = [];
  let price = 0.001 + Math.random() * 0.01;
  const volatility = 0.1 + Math.random() * 0.2;

  // Create a random trend pattern
  const patterns = ["pump", "dump", "sideways", "volatile"];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  for (let i = 0; i < 60; i++) {
    let changePercent = (Math.random() - 0.5) * volatility;

    // Apply pattern bias
    if (pattern === "pump" && i > 20) changePercent += 0.02;
    if (pattern === "dump" && i > 20) changePercent -= 0.02;
    if (pattern === "volatile") changePercent *= 2;

    const open = price;
    const close = price * (1 + changePercent);
    const high = Math.max(open, close) * (1 + Math.random() * 0.03);
    const low = Math.min(open, close) * (1 - Math.random() * 0.03);

    candles.push({
      timestamp: Date.now() - (60 - i) * 3600000,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 5000,
    });

    price = close;
  }

  return candles;
}

// ============================================================================
// TRADING ACTIONS
// ============================================================================

export function playerBuy(solAmount: number): Trade | null {
  if (!currentSession || currentSession.status !== "active") return null;
  if (solAmount <= 0 || solAmount > currentSession.playerSol) return null;

  const currentPrice = getCurrentPrice();
  if (!currentPrice) return null;

  const tokenAmount = solAmount / currentPrice;

  const trade: Trade = {
    id: `trade_${Date.now()}`,
    timestamp: Date.now(),
    candleIndex: currentSession.currentCandleIndex,
    type: "buy",
    price: currentPrice,
    amount: solAmount,
    tokenAmount,
    trader: "player",
  };

  // Update player state
  currentSession.playerSol -= solAmount;
  const pos = currentSession.playerPosition;
  const newTotalCost = pos.totalCost + solAmount;
  const newTokenAmount = pos.tokenAmount + tokenAmount;
  pos.avgEntryPrice = newTotalCost / newTokenAmount;
  pos.tokenAmount = newTokenAmount;
  pos.totalCost = newTotalCost;

  currentSession.playerTrades.push(trade);
  return trade;
}

export function playerSell(tokenAmount: number): Trade | null {
  if (!currentSession || currentSession.status !== "active") return null;
  if (tokenAmount <= 0 || tokenAmount > currentSession.playerPosition.tokenAmount) return null;

  const currentPrice = getCurrentPrice();
  if (!currentPrice) return null;

  const solAmount = tokenAmount * currentPrice;

  const trade: Trade = {
    id: `trade_${Date.now()}`,
    timestamp: Date.now(),
    candleIndex: currentSession.currentCandleIndex,
    type: "sell",
    price: currentPrice,
    amount: solAmount,
    tokenAmount,
    trader: "player",
  };

  // Update player state
  currentSession.playerSol += solAmount;
  const pos = currentSession.playerPosition;
  pos.tokenAmount -= tokenAmount;
  if (pos.tokenAmount <= 0) {
    pos.tokenAmount = 0;
    pos.avgEntryPrice = 0;
    pos.totalCost = 0;
  } else {
    pos.totalCost = pos.tokenAmount * pos.avgEntryPrice;
  }

  currentSession.playerTrades.push(trade);
  return trade;
}

export function getCurrentPrice(): number | null {
  if (!currentSession) return null;
  const candle = currentSession.candles[currentSession.currentCandleIndex];
  return candle?.close || null;
}

// ============================================================================
// AI OPPONENT LOGIC
// ============================================================================

export function processOpponentTurn(): Trade | null {
  if (!currentSession || currentSession.status !== "active") return null;

  const opponent = DOJO_OPPONENTS.find((o) => o.id === currentSession.opponentId);
  if (!opponent) return null;

  const decision = makeOpponentDecision(opponent, currentSession);
  if (!decision) return null;

  const currentPrice = getCurrentPrice();
  if (!currentPrice) return null;

  if (decision.action === "buy" && decision.amount > 0) {
    const solAmount = Math.min(decision.amount, currentSession.opponentSol);
    if (solAmount < 0.1) return null;

    const tokenAmount = solAmount / currentPrice;

    const trade: Trade = {
      id: `trade_${Date.now()}_ai`,
      timestamp: Date.now(),
      candleIndex: currentSession.currentCandleIndex,
      type: "buy",
      price: currentPrice,
      amount: solAmount,
      tokenAmount,
      trader: opponent.id,
    };

    currentSession.opponentSol -= solAmount;
    const pos = currentSession.opponentPosition;
    const newTotalCost = pos.totalCost + solAmount;
    const newTokenAmount = pos.tokenAmount + tokenAmount;
    pos.avgEntryPrice = newTotalCost / newTokenAmount;
    pos.tokenAmount = newTokenAmount;
    pos.totalCost = newTotalCost;

    currentSession.opponentTrades.push(trade);
    return trade;
  }

  if (decision.action === "sell" && decision.amount > 0) {
    const tokenAmount = Math.min(decision.amount, currentSession.opponentPosition.tokenAmount);
    if (tokenAmount < 0.0001) return null;

    const solAmount = tokenAmount * currentPrice;

    const trade: Trade = {
      id: `trade_${Date.now()}_ai`,
      timestamp: Date.now(),
      candleIndex: currentSession.currentCandleIndex,
      type: "sell",
      price: currentPrice,
      amount: solAmount,
      tokenAmount,
      trader: opponent.id,
    };

    currentSession.opponentSol += solAmount;
    const pos = currentSession.opponentPosition;
    pos.tokenAmount -= tokenAmount;
    if (pos.tokenAmount <= 0) {
      pos.tokenAmount = 0;
      pos.avgEntryPrice = 0;
      pos.totalCost = 0;
    }

    currentSession.opponentTrades.push(trade);
    return trade;
  }

  return null;
}

interface OpponentDecision {
  action: "buy" | "sell" | "hold";
  amount: number;
  confidence: number;
}

function makeOpponentDecision(
  opponent: DojoOpponent,
  session: SparSession
): OpponentDecision | null {
  const traits = opponent.tradingTraits;
  const candles = session.candles;
  const idx = session.currentCandleIndex;

  if (idx < 5) return null; // Need some history

  // Calculate indicators
  const recentCandles = candles.slice(Math.max(0, idx - 10), idx + 1);
  const prices = recentCandles.map((c) => c.close);
  const currentPrice = prices[prices.length - 1];

  // Simple momentum
  const momentum = (currentPrice - prices[0]) / prices[0];

  // Volatility
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const volatility =
    Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length) /
    avgPrice;

  // Trend detection
  let upCandles = 0;
  for (let i = 1; i < recentCandles.length; i++) {
    if (recentCandles[i].close > recentCandles[i - 1].close) upCandles++;
  }
  const trendStrength = (upCandles / (recentCandles.length - 1) - 0.5) * 2;

  // Decision based on opponent style
  const hasPosition = session.opponentPosition.tokenAmount > 0;
  const positionPnl = hasPosition
    ? (currentPrice - session.opponentPosition.avgEntryPrice) /
      session.opponentPosition.avgEntryPrice
    : 0;

  // Random factor based on aggression
  const actionRoll = Math.random();
  const shouldAct = actionRoll < traits.aggression;

  if (!shouldAct) return null;

  // Technical signal
  let technicalSignal = 0;
  if (traits.technicalWeight > 0.5) {
    // More technical: follow momentum and trend
    technicalSignal = momentum * 0.5 + trendStrength * 0.5;
  } else {
    // Less technical: more random/gut feeling
    technicalSignal = (Math.random() - 0.5) * 0.4 + trendStrength * 0.2;
  }

  // Buy logic
  if (!hasPosition || session.opponentPosition.tokenAmount * currentPrice < session.opponentSol) {
    const buySignal =
      technicalSignal > 0.1 * (1 - traits.riskTolerance) && momentum > -0.05;

    if (buySignal && session.opponentSol > 0.5) {
      const buyAmount = session.opponentSol * traits.riskTolerance * (0.3 + Math.random() * 0.4);
      return {
        action: "buy",
        amount: buyAmount,
        confidence: 0.5 + technicalSignal * 0.5,
      };
    }
  }

  // Sell logic
  if (hasPosition) {
    // Take profit
    const takeProfitThreshold = 0.1 + (1 - traits.patience) * 0.2;
    if (positionPnl > takeProfitThreshold) {
      const sellRatio = 0.3 + (1 - traits.patience) * 0.5;
      return {
        action: "sell",
        amount: session.opponentPosition.tokenAmount * sellRatio,
        confidence: 0.7,
      };
    }

    // Stop loss
    const stopLossThreshold = -0.1 - traits.riskTolerance * 0.1;
    if (positionPnl < stopLossThreshold) {
      return {
        action: "sell",
        amount: session.opponentPosition.tokenAmount * 0.5,
        confidence: 0.8,
      };
    }

    // Technical exit
    if (technicalSignal < -0.15 && !traits.patience) {
      return {
        action: "sell",
        amount: session.opponentPosition.tokenAmount * 0.3,
        confidence: 0.6,
      };
    }
  }

  return null;
}

// ============================================================================
// SESSION PROGRESSION
// ============================================================================

export function advanceCandle(): boolean {
  if (!currentSession || currentSession.status !== "active") return false;

  currentSession.currentCandleIndex++;

  // Process opponent turn
  processOpponentTurn();

  // Check if session should end
  if (currentSession.currentCandleIndex >= currentSession.candles.length - 1) {
    endSpar();
    return false;
  }

  return true;
}

export function endSpar(): void {
  if (!currentSession || currentSession.status !== "active") return;

  const finalPrice = getCurrentPrice() || 0;

  // Calculate final values (liquidate all positions at current price)
  const playerValue =
    currentSession.playerSol + currentSession.playerPosition.tokenAmount * finalPrice;
  const opponentValue =
    currentSession.opponentSol + currentSession.opponentPosition.tokenAmount * finalPrice;

  const startValue = 10; // Both started with 10 SOL
  const playerPnl = ((playerValue - startValue) / startValue) * 100;
  const opponentPnl = ((opponentValue - startValue) / startValue) * 100;

  currentSession.playerFinalValue = playerValue;
  currentSession.opponentFinalValue = opponentValue;
  currentSession.playerPnlPercent = playerPnl;
  currentSession.opponentPnlPercent = opponentPnl;

  // Determine winner
  if (playerValue > opponentValue * 1.01) {
    currentSession.winner = "player";
  } else if (opponentValue > playerValue * 1.01) {
    currentSession.winner = "opponent";
  } else {
    currentSession.winner = "draw";
  }

  currentSession.status = "completed";
  currentSession.endTime = Date.now();

  // Update player stats
  playerStats.totalSpars++;
  playerStats.totalPnl += playerPnl;
  playerStats.avgPnlPerSpar = playerStats.totalPnl / playerStats.totalSpars;
  playerStats.lastSparTime = Date.now();

  if (!playerStats.opponentStats[currentSession.opponentId]) {
    playerStats.opponentStats[currentSession.opponentId] = { wins: 0, losses: 0 };
  }

  if (currentSession.winner === "player") {
    playerStats.wins++;
    playerStats.winStreak++;
    playerStats.bestWinStreak = Math.max(playerStats.bestWinStreak, playerStats.winStreak);
    playerStats.opponentStats[currentSession.opponentId].wins++;
  } else if (currentSession.winner === "opponent") {
    playerStats.losses++;
    playerStats.winStreak = 0;
    playerStats.opponentStats[currentSession.opponentId].losses++;
  } else {
    playerStats.draws++;
  }

  // Check for belt promotion
  const newBelt = checkBeltPromotion(playerStats);
  if (newBelt) {
    playerStats.belt = newBelt;
  }

  savePlayerStats();
}

export function abandonSpar(): void {
  if (!currentSession) return;
  currentSession.status = "abandoned";
  currentSession.endTime = Date.now();
  currentSession = null;
}

// ============================================================================
// ELIZAOS COACHING
// ============================================================================

export async function getCoachingFeedback(session: SparSession): Promise<CoachingFeedback | null> {
  const opponent = DOJO_OPPONENTS.find((o) => o.id === session.opponentId);
  if (!opponent) return null;

  try {
    const response = await fetch(`${ELIZAOS_SERVER}/api/agents/${session.opponentId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: buildCoachingPrompt(session, opponent),
        sessionId: `coaching_${session.id}`,
      }),
    });

    if (!response.ok) {
      return generateFallbackCoaching(session, opponent);
    }

    const data = await response.json();
    return parseCoachingResponse(data, session, opponent);
  } catch (error) {
    console.error("[Dojo] Coaching error:", error);
    return generateFallbackCoaching(session, opponent);
  }
}

function buildCoachingPrompt(session: SparSession, opponent: DojoOpponent): string {
  const playerPnl = session.playerPnlPercent?.toFixed(2) || "0";
  const opponentPnl = session.opponentPnlPercent?.toFixed(2) || "0";
  const winner = session.winner;

  const playerTradesSummary = session.playerTrades
    .map((t, i) => `${i + 1}. ${t.type.toUpperCase()} at ${t.price.toFixed(6)} (candle ${t.candleIndex})`)
    .join("\n");

  return `You just finished a trading spar against a student. Review their performance.

RESULTS:
- Student PnL: ${playerPnl}%
- Your PnL: ${opponentPnl}%
- Winner: ${winner === "player" ? "Student" : winner === "opponent" ? "You" : "Draw"}

STUDENT TRADES:
${playerTradesSummary || "No trades made"}

TOTAL CANDLES: ${session.candles.length}

Give brief, direct feedback. No fluff. Grade them S/A/B/C/D/F. Point out 1-2 specific mistakes or good plays. Keep it under 100 words. Be harsh if they deserve it, encouraging if they did well.`;
}

function parseCoachingResponse(
  data: any,
  session: SparSession,
  opponent: DojoOpponent
): CoachingFeedback {
  const message = data.response || data.text || data.message || "";

  // Extract grade from response
  const gradeMatch = message.match(/\b([SABCDF])\b/);
  const grade = (gradeMatch?.[1] as CoachingFeedback["overallGrade"]) || "C";

  return {
    opponentId: opponent.id,
    sessionId: session.id,
    overallGrade: grade,
    message,
    strengths: [],
    improvements: [],
    specificTrades: [],
  };
}

function generateFallbackCoaching(
  session: SparSession,
  opponent: DojoOpponent
): CoachingFeedback {
  const playerPnl = session.playerPnlPercent || 0;
  const winner = session.winner;

  let grade: CoachingFeedback["overallGrade"];
  let message: string;

  if (winner === "player" && playerPnl > 20) {
    grade = "A";
    message = "Solid performance. You read the price action well and managed risk. Keep that discipline.";
  } else if (winner === "player") {
    grade = "B";
    message = "You won, but the margin was thin. Work on position sizing and conviction in your entries.";
  } else if (winner === "draw") {
    grade = "C";
    message = "A draw means neither of us dominated. You need to find an edge. Study the setups more carefully.";
  } else if (playerPnl > -10) {
    grade = "C";
    message = "You lost but limited the damage. Review your entry points. You were late on most trades.";
  } else if (playerPnl > -25) {
    grade = "D";
    message = "Poor risk management. You held losers too long and cut winners too early. Classic mistake.";
  } else {
    grade = "F";
    message = "That was rough. Go back to basics. Paper trade more before challenging me again.";
  }

  return {
    opponentId: opponent.id,
    sessionId: session.id,
    overallGrade: grade,
    message,
    strengths: winner === "player" ? ["Profitable outcome"] : [],
    improvements: winner !== "player" ? ["Risk management", "Entry timing"] : [],
    specificTrades: [],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export function getAvailableOpponents(): DojoOpponent[] {
  return DOJO_OPPONENTS.filter((o) => canChallenge(playerStats.belt, o));
}

export function getAllOpponents(): DojoOpponent[] {
  return DOJO_OPPONENTS;
}

export function resetPlayerStats(): void {
  playerStats = getDefaultStats();
  savePlayerStats();
}
