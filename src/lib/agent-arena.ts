// Agent Arena - REAL AI agents competing with live calls
// Agents analyze tokens, make predictions, and compete on performance

import { subscribe, type AgentEvent } from "./agent-coordinator";

// ============================================================================
// ARENA AGENTS - Compete in the Trading Gym
// ============================================================================

export interface ArenaAgent {
  id: string;
  name: string;
  avatar: string;
  personality: "bullish" | "bearish" | "analytical" | "chaotic" | "wise";
  tradingStyle: string;
  catchphrase: string;
  color: string;
}

export const ARENA_AGENTS: ArenaAgent[] = [
  {
    id: "neo",
    name: "Neo",
    avatar: "👁️",
    personality: "analytical",
    tradingStyle: "Technical analysis, on-chain data",
    catchphrase: "I see the matrix of the markets",
    color: "#22c55e",
  },
  {
    id: "ghost",
    name: "The Dev",
    avatar: "👻",
    personality: "wise",
    tradingStyle: "Fundamentals, tokenomics deep dives",
    catchphrase: "Code never lies, charts sometimes do",
    color: "#a855f7",
  },
  {
    id: "finn",
    name: "Finn",
    avatar: "🦊",
    personality: "bullish",
    tradingStyle: "Momentum, social sentiment",
    catchphrase: "Ship it and they will come",
    color: "#3b82f6",
  },
  {
    id: "ash",
    name: "Ash",
    avatar: "⚡",
    personality: "chaotic",
    tradingStyle: "Vibes, meme potential",
    catchphrase: "Gotta catch that alpha!",
    color: "#eab308",
  },
  {
    id: "toly",
    name: "Toly",
    avatar: "⚡",
    personality: "analytical",
    tradingStyle: "Infrastructure, ecosystem plays",
    catchphrase: "Build for the long term",
    color: "#14b8a6",
  },
];

// ============================================================================
// CALLS SYSTEM - Real predictions that get tracked
// ============================================================================

export interface AgentCall {
  id: string;
  agentId: string;
  agentName: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName?: string;
  direction: "long" | "short";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  reasoning: string;
  timestamp: number;
  expiresAt: number; // 24h from creation
  status: "active" | "won" | "lost" | "expired";
  exitPrice?: number;
  pnlPercent?: number;
  resolvedAt?: number;
}

export interface AgentScore {
  agentId: string;
  agentName: string;
  wins: number;
  losses: number;
  totalPnl: number;
  winRate: number;
  streak: number;
  bestTrade: number;
  worstTrade: number;
  totalCalls: number;
  activeCalls: number;
  rank: number;
  lastCallTime: number;
}

// ============================================================================
// CONVERSATION SYSTEM
// ============================================================================

export interface ConversationMessage {
  id: string;
  agentId: string;
  agentName: string;
  message: string;
  timestamp: number;
  replyTo?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  confidence?: number;
  isAI: boolean; // true = real AI, false = template
}

export interface AgentConversation {
  id: string;
  topic: string;
  tokenSymbol?: string;
  tokenMint?: string;
  triggerEvent?: AgentEvent;
  messages: ConversationMessage[];
  startTime: number;
  isActive: boolean;
  isLoading: boolean;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let conversations: AgentConversation[] = [];
let currentConversation: AgentConversation | null = null;
let calls: AgentCall[] = [];
let scores: Map<string, AgentScore> = new Map();

const MAX_CONVERSATIONS = 20;
const MAX_CALLS = 100;
const CALL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Initialize scores for all agents
ARENA_AGENTS.forEach((agent) => {
  scores.set(agent.id, {
    agentId: agent.id,
    agentName: agent.name,
    wins: 0,
    losses: 0,
    totalPnl: 0,
    winRate: 0,
    streak: 0,
    bestTrade: 0,
    worstTrade: 0,
    totalCalls: 0,
    activeCalls: 0,
    rank: 0,
    lastCallTime: 0,
  });
});

// Listeners
type ConversationListener = (conversation: AgentConversation) => void;
type CallListener = (call: AgentCall) => void;
let conversationListeners: ConversationListener[] = [];
let callListeners: CallListener[] = [];

function notifyConversationListeners(conversation: AgentConversation): void {
  conversationListeners.forEach((listener) => {
    try {
      listener(conversation);
    } catch (e) {
      console.error("[Arena] Conversation listener error:", e);
    }
  });
}

function notifyCallListeners(call: AgentCall): void {
  callListeners.forEach((listener) => {
    try {
      listener(call);
    } catch (e) {
      console.error("[Arena] Call listener error:", e);
    }
  });
}

// ============================================================================
// API INTEGRATION - Calls the real AI arena endpoint
// ============================================================================

async function fetchArenaAPI(action: string, data: Record<string, unknown> = {}): Promise<any> {
  try {
    const response = await fetch("/api/arena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });

    if (!response.ok) {
      throw new Error(`Arena API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Arena] API error:", error);
    return null;
  }
}

// ============================================================================
// CONVERSATION FUNCTIONS
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start a new AI-powered conversation about a token or event
 */
export async function startConversation(
  event: AgentEvent | null,
  tokenSymbol?: string,
  tokenMint?: string
): Promise<AgentConversation> {
  const eventData = (event?.data || {}) as Record<string, unknown>;
  const symbol = tokenSymbol || (eventData.symbol as string) || "???";
  const mint = tokenMint || (eventData.mint as string);
  const name = (eventData.name as string) || "";

  // Determine topic
  let topic = "Market Discussion";
  let eventType: "token_launch" | "token_pump" | "analysis" = "analysis";

  if (event?.type === "token_launch") {
    topic = `🚀 NEW LAUNCH: $${symbol}`;
    eventType = "token_launch";
  } else if (event?.type === "token_pump") {
    topic = `📈 $${symbol} PUMPING`;
    eventType = "token_pump";
  } else if (symbol !== "???") {
    topic = `💬 Analyzing $${symbol}`;
  }

  const conversation: AgentConversation = {
    id: generateId("conv"),
    topic,
    tokenSymbol: symbol,
    tokenMint: mint,
    triggerEvent: event || undefined,
    messages: [],
    startTime: Date.now(),
    isActive: true,
    isLoading: true,
  };

  // Store immediately so UI updates
  conversations.unshift(conversation);
  if (conversations.length > MAX_CONVERSATIONS) {
    conversations = conversations.slice(0, MAX_CONVERSATIONS);
  }
  currentConversation = conversation;
  notifyConversationListeners(conversation);

  // Fetch real AI responses
  try {
    const result = await fetchArenaAPI("event", {
      eventType,
      tokenSymbol: symbol,
      tokenName: name,
      tokenMint: mint,
    });

    if (result?.success && result.messages) {
      // Add AI messages to conversation
      result.messages.forEach((msg: any) => {
        const message: ConversationMessage = {
          id: generateId("msg"),
          agentId: msg.agentId,
          agentName: msg.agentName,
          message: msg.message,
          timestamp: msg.timestamp || Date.now(),
          sentiment: msg.sentiment,
          confidence: msg.confidence,
          isAI: true,
        };
        conversation.messages.push(message);
      });
    } else {
      // Fallback to template if AI fails
      const selectedAgents = [...ARENA_AGENTS].sort(() => Math.random() - 0.5).slice(0, 3);
      selectedAgents.forEach((agent) => {
        const message: ConversationMessage = {
          id: generateId("msg"),
          agentId: agent.id,
          agentName: agent.name,
          message: generateFallbackResponse(agent, symbol, eventType),
          timestamp: Date.now(),
          sentiment:
            agent.personality === "bullish"
              ? "bullish"
              : agent.personality === "bearish"
                ? "bearish"
                : "neutral",
          isAI: false,
        };
        conversation.messages.push(message);
      });
    }
  } catch (error) {
    console.error("[Arena] Conversation generation error:", error);
  }

  conversation.isLoading = false;

  // Auto-close after 60 seconds
  setTimeout(() => {
    conversation.isActive = false;
    notifyConversationListeners(conversation);
  }, 60000);

  notifyConversationListeners(conversation);
  return conversation;
}

/**
 * Have agents discuss a topic with real AI
 */
export async function discussTopic(
  tokenSymbol?: string,
  tokenMint?: string,
  customPrompt?: string
): Promise<AgentConversation> {
  const conversation: AgentConversation = {
    id: generateId("conv"),
    topic: tokenSymbol ? `💬 $${tokenSymbol} Discussion` : "💬 Market Talk",
    tokenSymbol,
    tokenMint,
    messages: [],
    startTime: Date.now(),
    isActive: true,
    isLoading: true,
  };

  conversations.unshift(conversation);
  if (conversations.length > MAX_CONVERSATIONS) {
    conversations = conversations.slice(0, MAX_CONVERSATIONS);
  }
  currentConversation = conversation;
  notifyConversationListeners(conversation);

  try {
    const result = await fetchArenaAPI("discuss", {
      tokenSymbol,
      tokenMint,
      userPrompt: customPrompt,
    });

    if (result?.success && result.messages) {
      result.messages.forEach((msg: any) => {
        const message: ConversationMessage = {
          id: generateId("msg"),
          agentId: msg.agentId,
          agentName: msg.agentName,
          message: msg.message,
          timestamp: msg.timestamp || Date.now(),
          sentiment: msg.sentiment,
          confidence: msg.confidence,
          isAI: true,
        };
        conversation.messages.push(message);
      });
    }
  } catch (error) {
    console.error("[Arena] Discussion error:", error);
  }

  conversation.isLoading = false;
  notifyConversationListeners(conversation);
  return conversation;
}

// Fallback response generator
function generateFallbackResponse(agent: ArenaAgent, symbol: string, eventType: string): string {
  const responses: Record<string, Record<string, string[]>> = {
    token_launch: {
      bullish: [
        `$${symbol} just dropped and I'm feeling bullish. Ticker has energy.`,
        `Fresh launch $${symbol}! Adding to watchlist.`,
      ],
      bearish: [
        `$${symbol}... waiting for the chart to prove itself.`,
        `New launch timing seems off. Watching $${symbol}.`,
      ],
      analytical: [
        `$${symbol} launch detected. Analyzing metrics...`,
        `Need to see holder distribution on $${symbol}.`,
      ],
      chaotic: [
        `$${symbol}?! Name sounds memeable, might ape!`,
        `YOOO $${symbol} just dropped! Vibes check...`,
      ],
      wise: [
        `$${symbol} enters the arena. Let's see execution.`,
        `New token $${symbol}. 95% fail. Be selective.`,
      ],
    },
    token_pump: {
      bullish: [`$${symbol} pumping! This is why we hold.`, `Called it! $${symbol} moving.`],
      bearish: [
        `$${symbol} pump... classic bull trap setup?`,
        `Nice pump but I've seen this before.`,
      ],
      analytical: [
        `$${symbol} breakout. Volume confirms the move.`,
        `Analyzing $${symbol} pump metrics...`,
      ],
      chaotic: [`$${symbol} GOING VERTICAL!! 🚀`, `LETS GOOOO $${symbol}!!!`],
      wise: [
        `$${symbol} showing strength. But take profits.`,
        `Good move on $${symbol}. Can it hold?`,
      ],
    },
    analysis: {
      bullish: [`$${symbol} looking strong.`, `Bullish on $${symbol} setup.`],
      bearish: [`$${symbol} needs more proof.`, `Cautious on $${symbol}.`],
      analytical: [`Analyzing $${symbol} data...`, `$${symbol} metrics loading...`],
      chaotic: [`$${symbol} vibes check!`, `What's the $${symbol} play?!`],
      wise: [`$${symbol} - patience is key.`, `Studying $${symbol} fundamentals.`],
    },
  };

  const eventResponses = responses[eventType] || responses.analysis;
  const personalityResponses = eventResponses[agent.personality] || eventResponses.analytical;
  return personalityResponses[Math.floor(Math.random() * personalityResponses.length)];
}

// ============================================================================
// CALLS SYSTEM - Agents make real predictions
// ============================================================================

/**
 * Have an agent make a call (prediction) on a token
 */
export async function makeCall(
  agentId: string,
  tokenSymbol: string,
  tokenMint?: string,
  tokenName?: string
): Promise<AgentCall | null> {
  const agent = ARENA_AGENTS.find((a) => a.id === agentId);
  if (!agent) return null;

  try {
    const result = await fetchArenaAPI("predict", {
      agentId,
      tokenSymbol,
      tokenMint,
      tokenName,
    });

    if (result?.success && result.prediction) {
      const pred = result.prediction;
      const call: AgentCall = {
        id: pred.id || generateId("call"),
        agentId,
        agentName: agent.name,
        tokenMint: pred.tokenMint || tokenMint || "",
        tokenSymbol: pred.tokenSymbol || tokenSymbol,
        tokenName: tokenName,
        direction: pred.direction,
        entryPrice: pred.entryPrice,
        targetPrice: pred.targetPrice,
        stopLoss: pred.stopLoss,
        confidence: pred.confidence || result.analysis?.confidence || 50,
        reasoning: result.analysis?.message || pred.reasoning || "AI analysis",
        timestamp: Date.now(),
        expiresAt: Date.now() + CALL_DURATION_MS,
        status: "active",
      };

      // Store call
      calls.unshift(call);
      if (calls.length > MAX_CALLS) {
        calls = calls.slice(0, MAX_CALLS);
      }

      // Update agent stats
      const score = scores.get(agentId);
      if (score) {
        score.totalCalls++;
        score.activeCalls++;
        score.lastCallTime = Date.now();
      }

      notifyCallListeners(call);
      return call;
    }
  } catch (error) {
    console.error("[Arena] Make call error:", error);
  }

  return null;
}

/**
 * Resolve a call (mark as won/lost based on price)
 */
export function resolveCall(
  callId: string,
  currentPrice: number,
  forceStatus?: "won" | "lost" | "expired"
): void {
  const call = calls.find((c) => c.id === callId);
  if (!call || call.status !== "active") return;

  let won = false;
  let pnl = 0;

  if (forceStatus) {
    call.status = forceStatus;
    won = forceStatus === "won";
  } else {
    // Check if target or stop hit
    if (call.direction === "long") {
      if (currentPrice >= call.targetPrice) {
        won = true;
        call.status = "won";
      } else if (currentPrice <= call.stopLoss) {
        won = false;
        call.status = "lost";
      }
    } else {
      if (currentPrice <= call.targetPrice) {
        won = true;
        call.status = "won";
      } else if (currentPrice >= call.stopLoss) {
        won = false;
        call.status = "lost";
      }
    }
  }

  if (call.status !== "active") {
    call.exitPrice = currentPrice;
    call.resolvedAt = Date.now();

    // Calculate PnL
    if (call.direction === "long") {
      pnl = ((currentPrice - call.entryPrice) / call.entryPrice) * 100;
    } else {
      pnl = ((call.entryPrice - currentPrice) / call.entryPrice) * 100;
    }
    call.pnlPercent = pnl;

    // Update agent score
    const score = scores.get(call.agentId);
    if (score) {
      score.activeCalls = Math.max(0, score.activeCalls - 1);

      if (won) {
        score.wins++;
        score.streak = score.streak >= 0 ? score.streak + 1 : 1;
        if (pnl > score.bestTrade) score.bestTrade = pnl;
      } else {
        score.losses++;
        score.streak = score.streak <= 0 ? score.streak - 1 : -1;
        if (pnl < score.worstTrade) score.worstTrade = pnl;
      }

      score.totalPnl += pnl;
      const total = score.wins + score.losses;
      score.winRate = total > 0 ? (score.wins / total) * 100 : 0;
    }

    updateRankings();
    notifyCallListeners(call);
  }
}

/**
 * Check and expire old calls
 */
export function checkExpiredCalls(): void {
  const now = Date.now();
  calls.forEach((call) => {
    if (call.status === "active" && now >= call.expiresAt) {
      resolveCall(call.id, call.entryPrice, "expired");
    }
  });
}

// Run expiry check every minute
if (typeof window !== "undefined") {
  setInterval(checkExpiredCalls, 60000);
}

// ============================================================================
// RANKINGS
// ============================================================================

function updateRankings(): void {
  const allScores = Array.from(scores.values());
  allScores.sort((a, b) => {
    // Primary: Win rate (if enough trades)
    const aHasEnough = a.totalCalls >= 5;
    const bHasEnough = b.totalCalls >= 5;

    if (aHasEnough && !bHasEnough) return -1;
    if (!aHasEnough && bHasEnough) return 1;

    // Secondary: Total PnL
    if (b.totalPnl !== a.totalPnl) return b.totalPnl - a.totalPnl;

    // Tertiary: Win rate
    return b.winRate - a.winRate;
  });

  allScores.forEach((score, index) => {
    score.rank = index + 1;
  });
}

// ============================================================================
// GETTERS
// ============================================================================

export function getCurrentConversation(): AgentConversation | null {
  return currentConversation;
}

export function getRecentConversations(limit: number = 10): AgentConversation[] {
  return conversations.slice(0, limit);
}

export function getActiveCalls(): AgentCall[] {
  return calls.filter((c) => c.status === "active");
}

export function getAllCalls(limit: number = 50): AgentCall[] {
  return calls.slice(0, limit);
}

export function getAgentCalls(agentId: string, limit: number = 10): AgentCall[] {
  return calls.filter((c) => c.agentId === agentId).slice(0, limit);
}

export function getLeaderboard(): AgentScore[] {
  updateRankings();
  return Array.from(scores.values()).sort((a, b) => a.rank - b.rank);
}

export function getAgentScore(agentId: string): AgentScore | undefined {
  return scores.get(agentId);
}

export function getAgentById(id: string): ArenaAgent | undefined {
  return ARENA_AGENTS.find((a) => a.id === id);
}

// ============================================================================
// LISTENERS
// ============================================================================

export function onConversation(listener: ConversationListener): () => void {
  conversationListeners.push(listener);
  return () => {
    conversationListeners = conversationListeners.filter((l) => l !== listener);
  };
}

export function onCall(listener: CallListener): () => void {
  callListeners.push(listener);
  return () => {
    callListeners = callListeners.filter((l) => l !== listener);
  };
}

// ============================================================================
// COORDINATOR INTEGRATION
// ============================================================================

let coordinatorUnsubscribe: (() => void) | null = null;

export function connectArenaToCoordinator(): () => void {
  if (coordinatorUnsubscribe) return coordinatorUnsubscribe;

  coordinatorUnsubscribe = subscribe(
    ["token_launch", "token_pump"],
    async (event: AgentEvent) => {
      // Start conversation on high priority events
      if (event.priority === "high" || event.priority === "urgent") {
        await startConversation(event);

        // 50% chance for random agent to make a call on new launches
        if (event.type === "token_launch" && Math.random() > 0.5) {
          const randomAgent = ARENA_AGENTS[Math.floor(Math.random() * ARENA_AGENTS.length)];
          const data = event.data as Record<string, unknown>;
          await makeCall(
            randomAgent.id,
            (data.symbol as string) || "???",
            data.mint as string,
            data.name as string
          );
        }
      }
    },
    ["high", "urgent"]
  );

  console.log("[Arena] Connected to coordinator - AI mode");
  return coordinatorUnsubscribe;
}

export function disconnectArena(): void {
  if (coordinatorUnsubscribe) {
    coordinatorUnsubscribe();
    coordinatorUnsubscribe = null;
  }
}

// Legacy exports for compatibility
export type { AgentCall as TradePrediction };
export const getActivePredictions = getActiveCalls;
export const makePrediction = (
  agentId: string,
  tokenSymbol: string,
  direction: "long" | "short",
  currentPrice: number
) => makeCall(agentId, tokenSymbol);
