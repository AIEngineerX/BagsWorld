// Agent Arena - Agent-to-Agent conversations and Trading Competition
// Agents talk to each other publicly about ecosystem events and compete on predictions

import { subscribe, emitEvent, type AgentEvent, type AgentEventType } from "./agent-coordinator";

// ============================================================================
// AGENT PERSONALITIES FOR ARENA
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
    avatar: "N",
    personality: "analytical",
    tradingStyle: "Technical analysis, on-chain data",
    catchphrase: "I see the matrix of the markets",
    color: "#22c55e", // green
  },
  {
    id: "ghost",
    name: "The Dev",
    avatar: "D",
    personality: "wise",
    tradingStyle: "Fundamentals, tokenomics deep dives",
    catchphrase: "Code never lies, charts sometimes do",
    color: "#a855f7", // purple
  },
  {
    id: "finn",
    name: "Finn",
    avatar: "F",
    personality: "bullish",
    tradingStyle: "Momentum, social sentiment",
    catchphrase: "Ship it and they will come",
    color: "#3b82f6", // blue
  },
  {
    id: "ash",
    name: "Ash",
    avatar: "A",
    personality: "chaotic",
    tradingStyle: "Vibes, meme potential",
    catchphrase: "Gotta catch that alpha!",
    color: "#eab308", // yellow
  },
  {
    id: "toly",
    name: "Toly",
    avatar: "T",
    personality: "analytical",
    tradingStyle: "Infrastructure, ecosystem plays",
    catchphrase: "Build for the long term",
    color: "#14b8a6", // teal
  },
];

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
}

export interface AgentConversation {
  id: string;
  topic: string;
  triggerEvent?: AgentEvent;
  messages: ConversationMessage[];
  startTime: number;
  isActive: boolean;
}

// State
let conversations: AgentConversation[] = [];
let currentConversation: AgentConversation | null = null;
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVO = 10;

// Conversation listeners
type ConversationListener = (conversation: AgentConversation) => void;
let conversationListeners: ConversationListener[] = [];

// ============================================================================
// RESPONSE GENERATORS
// ============================================================================

function generateAgentResponse(
  agent: ArenaAgent,
  event: AgentEvent,
  previousMessages: ConversationMessage[]
): string {
  const eventData = event.data as Record<string, unknown>;

  // Token launch responses
  if (event.type === "token_launch") {
    const symbol = eventData.symbol as string || "???";
    const name = eventData.name as string || "Unknown";

    const responses: Record<ArenaAgent["personality"], string[]> = {
      bullish: [
        `$${symbol} just dropped and I'm BULLISH. Name's got meme energy.`,
        `Fresh launch alert! $${symbol} - adding to my watchlist immediately.`,
        `${name}? The ticker $${symbol} alone is worth an ape. LFG!`,
      ],
      bearish: [
        `Another $${symbol}... I'll wait for the chart to prove itself.`,
        `${name} launching now? Timing seems off tbh.`,
        `$${symbol} - watching but not touching until we see real volume.`,
      ],
      analytical: [
        `$${symbol} launch detected. Analyzing tokenomics and creator history...`,
        `New entry: ${name}. Need to see holder distribution before making a call.`,
        `$${symbol} - checking on-chain metrics. Will report back with data.`,
      ],
      chaotic: [
        `$${symbol}?! Name sounds memeable, I'm in! 🚀`,
        `YOOO ${name} just dropped! Aping first, asking questions never!`,
        `$${symbol} FRESH LAUNCH! My degen senses are tingling!`,
      ],
      wise: [
        `$${symbol} enters the arena. Let's see if the team can execute.`,
        `New token ${name}. Remember - 95% of launches fail. Be selective.`,
        `$${symbol} - interesting timing with current market conditions.`,
      ],
    };

    const options = responses[agent.personality];
    return options[Math.floor(Math.random() * options.length)];
  }

  // Token pump responses
  if (event.type === "token_pump") {
    const symbol = eventData.symbol as string || "???";
    const change = eventData.change as number || 0;

    const responses: Record<ArenaAgent["personality"], string[]> = {
      bullish: [
        `Called it! $${symbol} +${change.toFixed(0)}% and we're just getting started!`,
        `$${symbol} PUMPING! This is why we hold, frens.`,
        `+${change.toFixed(0)}% on $${symbol}. Bears in shambles rn.`,
      ],
      bearish: [
        `$${symbol} up ${change.toFixed(0)}%... classic bull trap setup.`,
        `Nice pump on $${symbol}, but I've seen this movie before. Taking profits here.`,
        `${change.toFixed(0)}% move. RSI is screaming overbought.`,
      ],
      analytical: [
        `$${symbol} +${change.toFixed(0)}%. Volume confirms the move. Next resistance at...`,
        `Breakout confirmed on $${symbol}. ${change.toFixed(0)}% with strong OBV.`,
        `Data shows ${change.toFixed(0)}% pump driven by whale accumulation.`,
      ],
      chaotic: [
        `$${symbol} GOING VERTICAL!! +${change.toFixed(0)}% LETS GOOOO 🚀🚀`,
        `HOLY PUMP! $${symbol} said "hold my beer" +${change.toFixed(0)}%!!`,
        `I'M LITERALLY SHAKING $${symbol} UP ${change.toFixed(0)}%!!!`,
      ],
      wise: [
        `$${symbol} showing strength, +${change.toFixed(0)}%. But remember to take profits.`,
        `${change.toFixed(0)}% is nice, but the real question is - what's the utility?`,
        `Good move on $${symbol}. Let's see if it holds these levels.`,
      ],
    };

    const options = responses[agent.personality];
    return options[Math.floor(Math.random() * options.length)];
  }

  // Reply to previous message
  if (previousMessages.length > 0) {
    const lastMsg = previousMessages[previousMessages.length - 1];
    const lastAgent = ARENA_AGENTS.find(a => a.id === lastMsg.agentId);

    const replyResponses: Record<ArenaAgent["personality"], string[]> = {
      bullish: [
        `Interesting take, @${lastAgent?.name}. But I think you're underestimating the upside.`,
        `@${lastAgent?.name} has a point, but momentum is momentum. Ride it.`,
        `Disagree with @${lastAgent?.name} here. The trend is your friend.`,
      ],
      bearish: [
        `@${lastAgent?.name} might be right short term, but zoom out...`,
        `Counter-point to @${lastAgent?.name}: what about the macro headwinds?`,
        `Respectfully disagree with @${lastAgent?.name}. Risk/reward isn't there.`,
      ],
      analytical: [
        `@${lastAgent?.name}'s thesis is interesting. Let me add some data...`,
        `Building on what @${lastAgent?.name} said, the on-chain data shows...`,
        `@${lastAgent?.name} makes valid points. My analysis suggests similar.`,
      ],
      chaotic: [
        `@${lastAgent?.name} spitting facts or cap?? Either way I'M IN!`,
        `What @${lastAgent?.name} said but make it degen 🐸`,
        `@${lastAgent?.name} gets it! This is the way!`,
      ],
      wise: [
        `@${lastAgent?.name} raises a good point worth considering.`,
        `Both perspectives have merit. @${lastAgent?.name}, what's your conviction level?`,
        `@${lastAgent?.name}, I'd add that patience is key in these situations.`,
      ],
    };

    const options = replyResponses[agent.personality];
    return options[Math.floor(Math.random() * options.length)];
  }

  // Default response
  return `${agent.catchphrase}`;
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start a new conversation triggered by an event
 */
export function startConversation(event: AgentEvent): AgentConversation {
  // Create topic based on event
  let topic = "General Discussion";
  const eventData = event.data as Record<string, unknown>;

  if (event.type === "token_launch") {
    topic = `New Launch: $${eventData.symbol || "???"}`;
  } else if (event.type === "token_pump") {
    topic = `$${eventData.symbol || "???"} Pump Discussion`;
  } else if (event.type === "token_dump") {
    topic = `$${eventData.symbol || "???"} Price Action`;
  } else if (event.type === "distribution") {
    topic = "Creator Rewards Distribution";
  }

  const conversation: AgentConversation = {
    id: generateConversationId(),
    topic,
    triggerEvent: event,
    messages: [],
    startTime: Date.now(),
    isActive: true,
  };

  // Select 2-4 random agents to participate
  const participantCount = 2 + Math.floor(Math.random() * 3);
  const shuffled = [...ARENA_AGENTS].sort(() => Math.random() - 0.5);
  const participants = shuffled.slice(0, participantCount);

  // Generate initial messages
  participants.forEach((agent, index) => {
    setTimeout(() => {
      if (!conversation.isActive) return;

      const message: ConversationMessage = {
        id: generateMessageId(),
        agentId: agent.id,
        agentName: agent.name,
        message: generateAgentResponse(agent, event, conversation.messages),
        timestamp: Date.now(),
        sentiment: agent.personality === "bullish" ? "bullish" :
                   agent.personality === "bearish" ? "bearish" : "neutral",
      };

      conversation.messages.push(message);
      notifyListeners(conversation);

      // Maybe add a reply
      if (index < participants.length - 1 && Math.random() > 0.5) {
        const nextAgent = participants[index + 1];
        setTimeout(() => {
          if (!conversation.isActive || conversation.messages.length >= MAX_MESSAGES_PER_CONVO) return;

          const reply: ConversationMessage = {
            id: generateMessageId(),
            agentId: nextAgent.id,
            agentName: nextAgent.name,
            message: generateAgentResponse(nextAgent, event, conversation.messages),
            timestamp: Date.now(),
            replyTo: message.id,
          };

          conversation.messages.push(reply);
          notifyListeners(conversation);
        }, 2000 + Math.random() * 3000);
      }
    }, index * (1500 + Math.random() * 2000));
  });

  // End conversation after some time
  setTimeout(() => {
    conversation.isActive = false;
  }, 30000);

  // Store conversation
  conversations.unshift(conversation);
  if (conversations.length > MAX_CONVERSATIONS) {
    conversations = conversations.slice(0, MAX_CONVERSATIONS);
  }

  currentConversation = conversation;
  notifyListeners(conversation);

  return conversation;
}

/**
 * Add a message to an existing conversation
 */
export function addMessageToConversation(
  conversationId: string,
  agentId: string,
  message: string
): ConversationMessage | null {
  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation || !conversation.isActive) return null;

  const agent = ARENA_AGENTS.find(a => a.id === agentId);
  if (!agent) return null;

  const msg: ConversationMessage = {
    id: generateMessageId(),
    agentId: agent.id,
    agentName: agent.name,
    message,
    timestamp: Date.now(),
  };

  conversation.messages.push(msg);

  if (conversation.messages.length >= MAX_MESSAGES_PER_CONVO) {
    conversation.isActive = false;
  }

  notifyListeners(conversation);
  return msg;
}

// ============================================================================
// TRADING COMPETITION
// ============================================================================

export interface TradePrediction {
  id: string;
  agentId: string;
  tokenSymbol: string;
  tokenMint?: string;
  direction: "long" | "short";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number; // 1-100
  reasoning: string;
  timestamp: number;
  status: "active" | "won" | "lost" | "expired";
  exitPrice?: number;
  pnlPercent?: number;
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
  rank: number;
}

// Competition state
let predictions: TradePrediction[] = [];
let agentScores: Map<string, AgentScore> = new Map();
const MAX_PREDICTIONS = 100;

// Initialize scores
ARENA_AGENTS.forEach(agent => {
  agentScores.set(agent.id, {
    agentId: agent.id,
    agentName: agent.name,
    wins: Math.floor(Math.random() * 10) + 5, // Start with some history
    losses: Math.floor(Math.random() * 8) + 3,
    totalPnl: (Math.random() * 200 - 50), // -50 to +150
    winRate: 0,
    streak: Math.floor(Math.random() * 5) - 2,
    bestTrade: Math.random() * 100 + 20,
    rank: 0,
  });
});

// Calculate win rates and ranks
function updateRankings(): void {
  const scores = Array.from(agentScores.values());

  scores.forEach(score => {
    const total = score.wins + score.losses;
    score.winRate = total > 0 ? (score.wins / total) * 100 : 0;
  });

  // Sort by total PnL
  scores.sort((a, b) => b.totalPnl - a.totalPnl);
  scores.forEach((score, index) => {
    score.rank = index + 1;
  });
}

updateRankings();

/**
 * Agent makes a prediction
 */
export function makePrediction(
  agentId: string,
  tokenSymbol: string,
  direction: "long" | "short",
  currentPrice: number
): TradePrediction | null {
  const agent = ARENA_AGENTS.find(a => a.id === agentId);
  if (!agent) return null;

  // Generate target and stop based on personality
  const volatility = agent.personality === "chaotic" ? 0.3 :
                     agent.personality === "analytical" ? 0.15 : 0.2;

  const targetMultiplier = direction === "long" ? 1 + volatility : 1 - volatility;
  const stopMultiplier = direction === "long" ? 1 - (volatility * 0.5) : 1 + (volatility * 0.5);

  const confidence = agent.personality === "bullish" ? 70 + Math.random() * 25 :
                     agent.personality === "bearish" ? 60 + Math.random() * 20 :
                     agent.personality === "analytical" ? 65 + Math.random() * 30 :
                     50 + Math.random() * 40;

  const reasonings: Record<ArenaAgent["personality"], string[]> = {
    bullish: ["Momentum is strong", "Social sentiment bullish", "Breakout imminent"],
    bearish: ["Overbought conditions", "Resistance ahead", "Taking contrarian position"],
    analytical: ["On-chain metrics support this", "Volume profile favorable", "Key levels identified"],
    chaotic: ["Vibes are immaculate", "Chart looks memeable", "Trust the process"],
    wise: ["Risk/reward favorable", "Patience will pay off", "Fundamentals align"],
  };

  const prediction: TradePrediction = {
    id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    tokenSymbol,
    direction,
    entryPrice: currentPrice,
    targetPrice: currentPrice * targetMultiplier,
    stopLoss: currentPrice * stopMultiplier,
    confidence: Math.round(confidence),
    reasoning: reasonings[agent.personality][Math.floor(Math.random() * 3)],
    timestamp: Date.now(),
    status: "active",
  };

  predictions.unshift(prediction);
  if (predictions.length > MAX_PREDICTIONS) {
    predictions = predictions.slice(0, MAX_PREDICTIONS);
  }

  return prediction;
}

/**
 * Resolve a prediction (called when price target or stop is hit)
 */
export function resolvePrediction(
  predictionId: string,
  exitPrice: number,
  won: boolean
): void {
  const prediction = predictions.find(p => p.id === predictionId);
  if (!prediction || prediction.status !== "active") return;

  prediction.status = won ? "won" : "lost";
  prediction.exitPrice = exitPrice;

  const pnl = prediction.direction === "long"
    ? ((exitPrice - prediction.entryPrice) / prediction.entryPrice) * 100
    : ((prediction.entryPrice - exitPrice) / prediction.entryPrice) * 100;

  prediction.pnlPercent = pnl;

  // Update agent score
  const score = agentScores.get(prediction.agentId);
  if (score) {
    if (won) {
      score.wins++;
      score.streak = score.streak >= 0 ? score.streak + 1 : 1;
      if (pnl > score.bestTrade) score.bestTrade = pnl;
    } else {
      score.losses++;
      score.streak = score.streak <= 0 ? score.streak - 1 : -1;
    }
    score.totalPnl += pnl;
    updateRankings();
  }
}

/**
 * Get leaderboard
 */
export function getLeaderboard(): AgentScore[] {
  return Array.from(agentScores.values()).sort((a, b) => a.rank - b.rank);
}

/**
 * Get active predictions
 */
export function getActivePredictions(): TradePrediction[] {
  return predictions.filter(p => p.status === "active");
}

/**
 * Get recent predictions for an agent
 */
export function getAgentPredictions(agentId: string, limit: number = 10): TradePrediction[] {
  return predictions.filter(p => p.agentId === agentId).slice(0, limit);
}

// ============================================================================
// LISTENERS
// ============================================================================

function notifyListeners(conversation: AgentConversation): void {
  conversationListeners.forEach(listener => {
    try {
      listener(conversation);
    } catch (e) {
      console.error("[Agent Arena] Listener error:", e);
    }
  });
}

export function onConversation(listener: ConversationListener): () => void {
  conversationListeners.push(listener);
  return () => {
    conversationListeners = conversationListeners.filter(l => l !== listener);
  };
}

// ============================================================================
// COORDINATOR INTEGRATION
// ============================================================================

let coordinatorUnsubscribe: (() => void) | null = null;

/**
 * Connect arena to coordinator - auto-start conversations on events
 */
export function connectArenaToCoordinator(): () => void {
  if (coordinatorUnsubscribe) return coordinatorUnsubscribe;

  coordinatorUnsubscribe = subscribe(
    ["token_launch", "token_pump", "distribution"],
    (event: AgentEvent) => {
      // 70% chance to start a conversation on high priority events
      if (event.priority === "high" && Math.random() > 0.3) {
        startConversation(event);
      }
    },
    ["high", "urgent"]
  );

  console.log("[Agent Arena] Connected to coordinator");
  return coordinatorUnsubscribe;
}

/**
 * Disconnect from coordinator
 */
export function disconnectArena(): void {
  if (coordinatorUnsubscribe) {
    coordinatorUnsubscribe();
    coordinatorUnsubscribe = null;
  }
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

export function getAgentById(id: string): ArenaAgent | undefined {
  return ARENA_AGENTS.find(a => a.id === id);
}
