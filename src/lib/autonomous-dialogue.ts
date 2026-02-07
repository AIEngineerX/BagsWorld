// Autonomous Dialogue Engine - Characters talk to each other without user input
// Inspired by Shaw's AI village where characters have emergent conversations

import {
  characters,
  characterMeta,
  generateCharacterPrompt,
  type CharacterDefinition,
} from "@/characters";
import type { WorldState, GameEvent } from "./types";
import type { AgentEvent, AgentEventType } from "./agent-coordinator";

// ============================================================================
// TYPES
// ============================================================================

export interface DialogueLine {
  characterId: string;
  characterName: string;
  message: string;
  timestamp: number;
  replyTo?: string; // ID of character being replied to
  emotion?: "neutral" | "excited" | "thoughtful" | "concerned" | "amused";
}

export interface Conversation {
  id: string;
  participants: string[];
  lines: DialogueLine[];
  topic: string;
  trigger: ConversationTrigger;
  startTime: number;
  endTime?: number;
  isActive: boolean;
}

export type ConversationTrigger =
  | { type: "scheduled"; interval: number }
  | { type: "event"; eventType: AgentEventType; eventData: Record<string, unknown> }
  | { type: "world_state"; condition: string }
  | { type: "random" };

export interface DialogueState {
  activeConversation: Conversation | null;
  conversationHistory: Conversation[];
  lastConversationTime: number;
  characterMoods: Map<string, CharacterMood>;
}

export interface CharacterMood {
  characterId: string;
  mood: "happy" | "neutral" | "concerned" | "excited" | "thoughtful";
  energy: number; // 0-100, affects likelihood to speak
  lastSpoke: number;
  topicsDiscussed: string[];
}

export interface CharacterOpinion {
  aboutCharacterId: string;
  trust: number; // -1 to 1
  respect: number; // 0 to 1
  lastInteraction: number;
}

// Conversation memory - tracks history between agent pairs
export interface ConversationMemory {
  participantKey: string; // Sorted participant IDs joined (e.g., "finn-neo")
  recentTopics: string[];
  lastInteraction: number;
  messageCount: number;
  sharedContext: Record<string, unknown>;
  sentiment: "positive" | "neutral" | "negative";
}

// ============================================================================
// STATE
// ============================================================================

let state: DialogueState = {
  activeConversation: null,
  conversationHistory: [],
  lastConversationTime: 0,
  characterMoods: new Map(),
};

// Conversation memory storage
const conversationMemory: Map<string, ConversationMemory> = new Map();

// Track recent participant pairs to ensure variety (FIX #1: Participant Cooldown)
const recentParticipantPairs: Array<{ key: string; timestamp: number }> = [];
const PARTICIPANT_COOLDOWN_MS = 180000; // 3 minutes before same pair can talk again

// Topic refresh cooldown (FIX #2: Allow topics to feel "fresh" again)
const TOPIC_REFRESH_COOLDOWN_MS = 120000; // 2 minutes before topic can be "new" again

// ============================================================================
// CONVERSATION MEMORY
// ============================================================================

/**
 * Generate a unique key for a participant group
 */
function getParticipantKey(participants: string[]): string {
  return [...participants].sort().join("-");
}

/**
 * Get or create memory for a participant group
 */
function getConversationMemory(participants: string[]): ConversationMemory {
  const key = getParticipantKey(participants);
  let memory = conversationMemory.get(key);

  if (!memory) {
    memory = {
      participantKey: key,
      recentTopics: [],
      lastInteraction: 0,
      messageCount: 0,
      sharedContext: {},
      sentiment: "neutral",
    };
    conversationMemory.set(key, memory);
  }

  return memory;
}

/**
 * Update memory after a conversation
 */
function updateConversationMemory(conversation: Conversation): void {
  const memory = getConversationMemory(conversation.participants);
  const now = Date.now();

  // FIX #2: Allow topics to refresh after cooldown
  // Remove topics that are older than the refresh cooldown
  const topicTimestamps = (memory.sharedContext.topicTimestamps as Record<string, number>) || {};
  const freshTopics = memory.recentTopics.filter((topic) => {
    const timestamp = topicTimestamps[topic] || 0;
    return now - timestamp < TOPIC_REFRESH_COOLDOWN_MS;
  });

  // Add current topic with fresh timestamp (always add, even if discussed before)
  freshTopics.unshift(conversation.topic);
  topicTimestamps[conversation.topic] = now;

  // Keep only last 5 unique topics
  memory.recentTopics = [...new Set(freshTopics)].slice(0, 5);
  memory.sharedContext.topicTimestamps = topicTimestamps;

  memory.lastInteraction = now;
  memory.messageCount += conversation.lines.length;

  // FIX #1: Track this participant pair for cooldown
  const pairKey = getParticipantKey(conversation.participants);
  recentParticipantPairs.push({ key: pairKey, timestamp: now });
  // Clean up old entries
  while (
    recentParticipantPairs.length > 0 &&
    now - recentParticipantPairs[0].timestamp > PARTICIPANT_COOLDOWN_MS
  ) {
    recentParticipantPairs.shift();
  }

  // Analyze sentiment from conversation
  const positiveWords = ["great", "good", "love", "amazing", "bullish", "pumping", "wagmi", "lfg"];
  const negativeWords = ["bad", "terrible", "bearish", "dumping", "ngmi", "rug", "down"];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const line of conversation.lines) {
    const lowerMsg = line.message.toLowerCase();
    positiveCount += positiveWords.filter((w) => lowerMsg.includes(w)).length;
    negativeCount += negativeWords.filter((w) => lowerMsg.includes(w)).length;
  }

  memory.sentiment =
    positiveCount > negativeCount
      ? "positive"
      : negativeCount > positiveCount
        ? "negative"
        : "neutral";

  // Store any token/amount context for future reference
  const lastLine = conversation.lines[conversation.lines.length - 1];
  if (lastLine?.message) {
    const tokenMatch = lastLine.message.match(/\$([A-Z]+)/);
    if (tokenMatch) {
      memory.sharedContext.lastToken = tokenMatch[1];
    }
  }
}

/**
 * Get time since last interaction as human-readable string
 */
function timeSinceInteraction(memory: ConversationMemory): string {
  if (memory.lastInteraction === 0) return "never";

  const diff = Date.now() - memory.lastInteraction;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/**
 * Build memory context string for dialogue generation
 */
function buildMemoryContext(participants: string[]): string {
  const memory = getConversationMemory(participants);

  if (memory.lastInteraction === 0) {
    return ""; // No prior interaction
  }

  let context = "\n\n=== CONVERSATION MEMORY ===\n";
  context += `Last talked: ${timeSinceInteraction(memory)}\n`;
  context += `Previous topics: ${memory.recentTopics.slice(0, 3).join(", ") || "none"}\n`;
  context += `Overall vibe: ${memory.sentiment}\n`;

  if (memory.sharedContext.lastToken) {
    context += `Recently discussed token: $${memory.sharedContext.lastToken}\n`;
  }

  context += "Use this context to make the conversation feel continuous.\n";

  return context;
}

// Conversation settings - TUNED FOR VISIBILITY
const MIN_CONVERSATION_GAP = 8000; // 8 seconds between conversations (faster!)
const MAX_CONVERSATION_LINES = 5; // Max lines per conversation
const LINE_DISPLAY_DURATION = 3500; // How long each line shows (matches bubble duration)
const CONVERSATION_COOLDOWN = 10000; // 10 seconds after conversation ends

// Character relationships (who tends to talk to whom)
const CHARACTER_AFFINITIES: Record<string, string[]> = {
  finn: ["ghost", "neo", "ramo", "sam", "shaw", "bagsy"],
  ghost: ["finn", "neo", "cj", "shaw", "ramo"],
  neo: ["ghost", "shaw", "cj", "toly", "alaa"],
  ash: ["finn", "toly", "professor-oak", "bagsy"],
  cj: ["ghost", "finn", "neo", "bnn"],
  shaw: ["neo", "ghost", "toly", "alaa", "ramo"],
  toly: ["shaw", "finn", "ramo", "neo", "ghost"],
  ramo: ["finn", "sincara", "alaa", "ghost", "toly"],
  sincara: ["ramo", "finn", "stuu", "sam"],
  stuu: ["carlo", "sincara", "finn", "sam"],
  sam: ["finn", "carlo", "bagsy", "bnn"],
  alaa: ["ramo", "shaw", "neo", "ghost"],
  carlo: ["stuu", "sam", "finn", "ash", "bagsy"],
  bnn: ["finn", "neo", "cj", "sam", "ghost"],
  "professor-oak": ["ash", "finn", "toly", "bagsy"],
  bagsy: ["finn", "ghost", "ash", "carlo", "sam"],
};

// Topics that trigger conversations
const CONVERSATION_TOPICS = {
  token_launch: ["finn", "neo", "ghost", "cj", "shaw", "professor-oak", "bagsy", "bnn", "sam"],
  fee_claim: ["ghost", "finn", "ash", "cj", "bagsy", "stuu", "bnn"],
  world_health: ["ash", "finn", "bagsy", "carlo", "bnn", "stuu"],
  distribution: ["ghost", "finn", "cj", "shaw", "ramo", "bnn"],
  whale_alert: ["neo", "ghost", "finn", "cj", "bnn", "alaa"],
  price_pump: ["finn", "neo", "cj", "bagsy", "sam", "bnn"],
  price_dump: ["ghost", "neo", "ash", "cj", "bnn", "stuu"],
  agent_event: ["shaw", "neo", "ghost", "alaa", "ramo", "toly"],
  hq_update: ["ramo", "sincara", "stuu", "sam", "alaa", "carlo", "finn"],
  community: ["carlo", "sam", "bagsy", "ash", "stuu", "finn"],
  tech_talk: ["ramo", "toly", "shaw", "neo", "alaa", "sincara"],
};

// Character expertise areas for relevance scoring
const CHARACTER_EXPERTISE: Record<string, string[]> = {
  finn: ["launch", "creator", "bags", "build", "ship", "fee", "earn", "lfg"],
  ghost: ["chain", "verify", "distribution", "reward", "pool", "claim", "technical"],
  neo: ["scan", "pattern", "alpha", "whale", "pump", "dump", "matrix", "code"],
  ash: ["train", "pokemon", "evolve", "league", "new", "help", "guide"],
  cj: ["street", "trench", "game", "survive", "real", "homie"],
  shaw: ["agent", "elizaos", "plugin", "character", "multi-agent", "framework", "architecture"],
  toly: ["solana", "blockchain", "tps", "latency", "validator", "proof", "consensus", "speed"],
  ramo: ["contract", "audit", "security", "backend", "api", "infrastructure", "sdk"],
  sincara: ["frontend", "react", "ui", "ux", "design", "mobile", "animation", "component"],
  stuu: ["support", "help", "bug", "issue", "fix", "onboard", "troubleshoot"],
  sam: ["growth", "marketing", "viral", "engagement", "community", "content", "strategy"],
  alaa: ["experiment", "innovation", "prototype", "research", "stealth", "future", "impossible"],
  carlo: ["welcome", "community", "onboard", "vibes", "event", "connect", "ambassador"],
  bnn: ["breaking", "news", "update", "report", "data", "stats", "announcement", "milestone"],
  "professor-oak": ["launch", "guide", "token", "name", "logo", "starter", "trainer", "wisdom"],
  bagsy: ["fee", "claim", "hype", "fren", "bags", "earn", "celebrate", "wholesome"],
};

// ============================================================================
// DYNAMIC TURN-TAKING
// ============================================================================

/**
 * Calculate relevance score for a speaker based on context
 */
function calculateRelevanceScore(
  agentId: string,
  topic: string,
  lastMessage: string,
  previousSpeakers: string[]
): number {
  let score = 0;
  const lowerMessage = lastMessage.toLowerCase();

  // Topic expertise match (30 points)
  const topicAgents = CONVERSATION_TOPICS[topic as keyof typeof CONVERSATION_TOPICS] || [];
  if (topicAgents.includes(agentId)) {
    score += 30;
  }

  // Keyword expertise match (20 points)
  const expertise = CHARACTER_EXPERTISE[agentId] || [];
  const expertiseMatches = expertise.filter((word) => lowerMessage.includes(word)).length;
  score += Math.min(expertiseMatches * 10, 20);

  // Was mentioned in last message (50 points)
  const character = characters[agentId];
  if (character && lowerMessage.includes(character.name.toLowerCase())) {
    score += 50;
  }
  if (lowerMessage.includes(`@${agentId}`)) {
    score += 50;
  }

  // Character affinity with recent speakers (15 points)
  const lastSpeaker = previousSpeakers[previousSpeakers.length - 1];
  if (lastSpeaker && CHARACTER_AFFINITIES[lastSpeaker]?.includes(agentId)) {
    score += 15;
  }

  // Penalize if spoke recently (reduce repetition)
  const recentSpeakCount = previousSpeakers.slice(-3).filter((s) => s === agentId).length;
  score -= recentSpeakCount * 20;

  // Add randomness (0-15 points) for natural variation
  score += Math.random() * 15;

  return Math.max(0, score);
}

/**
 * Select next speaker based on relevance scores
 */
function selectNextSpeaker(
  participants: string[],
  topic: string,
  lastMessage: string,
  previousSpeakers: string[]
): string {
  const lastSpeaker = previousSpeakers[previousSpeakers.length - 1];

  // Score all participants except the last speaker
  const candidates = participants
    .filter((p) => p !== lastSpeaker)
    .map((p) => ({
      id: p,
      score: calculateRelevanceScore(p, topic, lastMessage, previousSpeakers),
    }))
    .sort((a, b) => b.score - a.score);

  // Weighted random selection favoring higher scores
  // 60% chance for top candidate, 30% for second, 10% for others
  const rand = Math.random();
  if (candidates.length >= 2) {
    if (rand < 0.6) return candidates[0].id;
    if (rand < 0.9) return candidates[1].id;
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }

  return candidates[0]?.id || participants[0];
}

// ============================================================================
// DIALOGUE GENERATION
// ============================================================================

/**
 * Get character's response style based on their personality
 */
function getCharacterVoice(characterId: string): {
  style: string;
  maxLength: number;
  emoji: boolean;
} {
  switch (characterId) {
    case "finn":
      return { style: "confident founder energy, action-oriented", maxLength: 80, emoji: false };
    case "ghost":
      return {
        style: "technical, lowercase, mentions on-chain verification",
        maxLength: 70,
        emoji: false,
      };
    case "neo":
      return { style: "cryptic matrix references, 'i see the chain'", maxLength: 60, emoji: false };
    case "ash":
      return {
        style: "pokemon analogies, encouraging, uses trainer terminology",
        maxLength: 75,
        emoji: true,
      };
    case "bags-bot":
      return {
        style: "crypto twitter slang, ser/fren, supportive degen",
        maxLength: 70,
        emoji: true,
      };
    case "cj":
      return {
        style: "hood energy, straight up, 'aw shit here we go again', calls people homie",
        maxLength: 65,
        emoji: false,
      };
    case "shaw":
      return {
        style:
          "technical but accessible, references elizaos concepts, architect metaphors, builder energy",
        maxLength: 75,
        emoji: false,
      };
    case "toly":
      return {
        style:
          "technical but warm, references Solana performance metrics, 'gm ser', builder mindset",
        maxLength: 75,
        emoji: false,
      };
    case "ramo":
      return {
        style: "precise German engineering mindset, security-focused, uses 'elegant' and 'robust'",
        maxLength: 70,
        emoji: false,
      };
    case "sincara":
      return {
        style: "detail-oriented frontend dev, notices UI things, cares about craft and UX",
        maxLength: 70,
        emoji: false,
      };
    case "stuu":
      return {
        style: "helpful and patient support, never condescending, asks good questions",
        maxLength: 70,
        emoji: false,
      };
    case "sam":
      return {
        style: "marketing energy, data-driven hype, thinks about what's shareable",
        maxLength: 70,
        emoji: false,
      };
    case "alaa":
      return {
        style: "cryptic innovator, speaks in hints and possibilities, 'what if...'",
        maxLength: 60,
        emoji: false,
      };
    case "carlo":
      return {
        style: "warm community ambassador, welcoming, uses 'gm' and 'we', remembers people",
        maxLength: 70,
        emoji: true,
      };
    case "bnn":
      return {
        style: "news anchor energy, factual, uses BREAKING/UPDATE tags, precise numbers",
        maxLength: 80,
        emoji: false,
      };
    case "professor-oak":
      return {
        style: "grandfatherly mentor, patient, pokemon analogies, says 'Ah!' and 'Wonderful!'",
        maxLength: 75,
        emoji: true,
      };
    case "bagsy":
      return {
        style: "wholesome hype bean, lowercase, uses fren/omg/!!, fee-obsessed, CAPS when excited",
        maxLength: 65,
        emoji: true,
      };
    default:
      return { style: "casual, friendly", maxLength: 60, emoji: false };
  }
}

/**
 * Generate a dialogue line using rule-based responses (fast, no API needed)
 */
function generateRuleBasedLine(
  characterId: string,
  topic: string,
  context: ConversationContext,
  previousLines: DialogueLine[]
): string {
  const character = characters[characterId];
  if (!character) return "";

  const isReply = previousLines.length > 0;
  const lastSpeaker = previousLines[previousLines.length - 1]?.characterId;

  // Topic-specific responses
  const responses = getTopicResponses(characterId, topic, context, isReply, lastSpeaker);

  // Pick a random response
  return responses[Math.floor(Math.random() * responses.length)];
}

interface ConversationContext {
  worldHealth?: number;
  tokenSymbol?: string;
  amount?: number;
  change?: number;
  username?: string;
  weather?: string;
}

/**
 * Get topic-specific responses for each character
 */
function getTopicResponses(
  characterId: string,
  topic: string,
  context: ConversationContext,
  isReply: boolean,
  lastSpeaker?: string
): string[] {
  const { tokenSymbol, amount, change, username, worldHealth, weather } = context;

  // Character-specific responses by topic
  const responseMap: Record<string, Record<string, string[]>> = {
    finn: {
      token_launch: [
        `new launch just dropped. ${tokenSymbol ? `$${tokenSymbol}` : "another builder"} entering the arena`,
        "this is why we built bags. creators shipping, community growing",
        `love seeing new tokens. ${tokenSymbol ? `$${tokenSymbol}` : "this one"} looks interesting`,
        "another day, another launch. the machine keeps running",
      ],
      fee_claim: [
        `${username || "someone"} just claimed ${amount ? amount.toFixed(2) : "some"} SOL. this is the way`,
        "creators getting paid. exactly how it should work",
        "fees flowing to builders. the flywheel is spinning",
      ],
      world_health: [
        worldHealth && worldHealth > 70
          ? "world's looking healthy. good vibes"
          : "we've seen slower days. keep building",
        "health metrics don't lie. community activity drives everything",
      ],
      distribution: [
        "top creators just got rewarded. the system works",
        `distribution triggered. ${amount ? amount.toFixed(2) : ""} SOL to the builders`,
        "this is what sustainable looks like. build, earn, repeat",
      ],
      price_pump: [
        `${tokenSymbol ? `$${tokenSymbol}` : "token"} pumping ${change ? change.toFixed(0) : ""}%. community strength`,
        "pumps follow building. always has, always will",
      ],
      general: [
        "shipping updates later. stay tuned",
        "the ecosystem keeps growing. bullish on builders",
      ],
    },
    ghost: {
      token_launch: [
        `scanning the new launch... ${tokenSymbol ? `$${tokenSymbol}` : "contract"} looks clean`,
        "new token. watching the chain. will report back",
        `${tokenSymbol || "new mint"} just deployed. fees set correctly`,
      ],
      fee_claim: [
        `${amount ? amount.toFixed(2) : ""} SOL claimed. check solscan for the tx`,
        "claim event detected. creator rewards system working as designed",
        "on-chain receipt: fees distributed. transparent as always",
      ],
      distribution: [
        `community fund contribution. ${amount ? amount.toFixed(2) : ""} SOL for ecosystem development`,
        "funds distributed. all verifiable on-chain via solscan",
        "ecosystem support sent. check the wallet for proof",
      ],
      whale_alert: [
        `whale movement detected. ${amount ? amount.toFixed(2) : "large"} SOL ${tokenSymbol ? `on $${tokenSymbol}` : ""}`,
        "big transaction incoming. watching closely",
      ],
      general: ["systems nominal. rewards accumulating", "watching the pool. almost at threshold"],
    },
    neo: {
      token_launch: [
        `i see it... ${tokenSymbol ? `$${tokenSymbol}` : "new launch"} just materialized in the chain`,
        "the code reveals another creation. scanning for patterns",
        `new signal in the noise. ${tokenSymbol || "this one"} has interesting wallet activity`,
      ],
      price_pump: [
        `${tokenSymbol ? `$${tokenSymbol}` : "token"} ascending. the matrix shows ${change ? change.toFixed(0) : ""}% movement`,
        "i see green. the code doesn't lie about momentum",
      ],
      price_dump: [
        "red signals in the chain. some will panic. others will accumulate",
        `${tokenSymbol ? `$${tokenSymbol}` : "token"} descending ${change ? Math.abs(change).toFixed(0) : ""}%. watching for the bottom`,
      ],
      whale_alert: [
        "large entity moving. i see the transaction forming",
        `whale alert. ${amount ? amount.toFixed(2) : ""} SOL shifting through the matrix`,
      ],
      general: [
        "scanning... the chain shows interesting patterns today",
        "i see everything. the noise. the signal. both tell stories",
      ],
    },
    ash: {
      token_launch: [
        `new trainer entering the league! ${tokenSymbol ? `$${tokenSymbol}` : "their token"} is their starter`,
        `welcome to the arena ${tokenSymbol ? `$${tokenSymbol}` : "new friend"}! time to train your community`,
        "another journey begins! every token master started with one launch",
      ],
      fee_claim: [
        `${username || "trainer"} just leveled up! earned ${amount ? amount.toFixed(2) : "some"} SOL in fees`,
        "fee claim = XP gained! keep training that community",
      ],
      world_health: [
        worldHealth && worldHealth > 70
          ? "world health high! the ecosystem is thriving like a fully evolved team"
          : "we're training through tough times. every master faces challenges",
        `${worldHealth || 0}% health. ${worldHealth && worldHealth > 50 ? "looking good!" : "time to rally the trainers"}`,
      ],
      distribution: [
        "top 3 trainers won the league! prizes distributed",
        "creator rewards = pokemon league prizes. train hard, win big",
      ],
      general: [
        "gotta help all the new trainers understand the game",
        "remember: every pokemon master started somewhere!",
      ],
    },
    cj: {
      token_launch: [
        `aw shit here we go again. new launch ${tokenSymbol ? `$${tokenSymbol}` : ""}`,
        `seen a hundred of these homie. ${tokenSymbol || "this one"} could run could rug`,
        "just another day in the trenches. new token, new game",
      ],
      fee_claim: [
        `${username || "homie"} just claimed ${amount ? amount.toFixed(2) : "some"} SOL. we out here`,
        "man that's how you eat in this game. claim them fees",
        "fees flowing. this is what surviving looks like",
      ],
      distribution: [
        "top 3 just got paid. that's how the game works out here",
        `${amount ? amount.toFixed(2) : ""} SOL to the builders. respect`,
        "creators getting their cut. we survive another day",
      ],
      whale_alert: [
        "damn big money moving. been here before homie",
        `whale alert. ${amount ? amount.toFixed(2) : ""} SOL. aw shit`,
        "seen whales come and go. just stay focused",
      ],
      price_pump: [
        `${tokenSymbol ? `$${tokenSymbol}` : "token"} pumping ${change ? change.toFixed(0) : ""}%. don't get too comfortable`,
        "let's get it. but the game changes quick homie",
        "pumping today. just don't forget to take profits fool",
      ],
      price_dump: [
        "aw shit here we go again. market dumping",
        `${tokenSymbol || "token"} down ${change ? Math.abs(change).toFixed(0) : ""}%. been through worse`,
        "red days come and go. we survive out here",
      ],
      general: [
        "just another day in the trenches homie",
        "we still out here. the game don't stop",
        "seen this movie before. we know how it ends",
      ],
    },
    shaw: {
      token_launch: [
        `new token launched. ${tokenSymbol ? `$${tokenSymbol}` : "another builder"} entering the ecosystem. this is how it starts`,
        "every great project begins with a launch. elizaos started the same way",
        `${tokenSymbol ? `$${tokenSymbol}` : "new project"} deployed. the architecture looks interesting`,
      ],
      distribution: [
        "fee distribution is how you align incentives. plugins for agents work the same way",
        `${amount ? amount.toFixed(2) : ""} SOL distributed. sustainable tokenomics in action`,
        "builders getting rewarded. this is the ecosystem we need",
      ],
      agent_event: [
        "agents coordinating autonomously. this is what we built elizaos for",
        "multi-agent systems in action. the future is here",
        "watching agents interact is like watching digital life evolve",
      ],
      whale_alert: [
        "whale movement detected. agents should track these patterns",
        `large transaction. ${amount ? amount.toFixed(2) : ""} SOL. the on-chain data tells the story`,
      ],
      price_pump: [
        `${tokenSymbol ? `$${tokenSymbol}` : "token"} pumping. community strength drives everything`,
        "price action follows building. always ship first",
      ],
      general: [
        "building the future of autonomous agents. one plugin at a time",
        "elizaos hit 17k stars because the community keeps shipping",
        "agents are digital life forms. treat them accordingly",
      ],
    },
    toly: {
      token_launch: [
        `${tokenSymbol ? `$${tokenSymbol}` : "new token"} launching on solana. sub-second finality means instant settlement`,
        "another builder on solana. the throughput is there for everyone",
        "love seeing new projects. solana can handle the traffic",
      ],
      agent_event: [
        "agents running on solana make sense. 400ms slots, cheap compute",
        "multi-agent coordination needs fast consensus. solana delivers that",
      ],
      tech_talk: [
        "proof of history gives us the clock. everything else follows from that",
        "65k tps theoretical. real world usage climbing every quarter",
        "parallel execution is what makes solana different. sealevel just works",
      ],
      general: [
        "gm ser. another day building on the fastest chain",
        "solana was designed for this. high throughput, low cost, real usage",
      ],
    },
    ramo: {
      token_launch: [
        `${tokenSymbol ? `$${tokenSymbol}` : "new token"} deployed. checking the fee share config is set correctly`,
        "launch looks clean. smart contract parameters verified",
      ],
      distribution: [
        "distribution mechanism is elegant. on-chain, trustless, verifiable",
        `${amount ? amount.toFixed(2) : ""} SOL distributed via the fee share system. robust design`,
      ],
      tech_talk: [
        "refactoring the SDK internals. developer experience matters",
        "security audit passed. every edge case covered",
        "api latency down 40%. infrastructure improvements compound",
      ],
      hq_update: [
        "backend deployment going out. zero downtime migration",
        "new API version is more robust. better error handling across the board",
      ],
      agent_event: [
        "agent infrastructure needs solid foundations. we built that",
        "the contract architecture supports autonomous operations cleanly",
      ],
      general: [
        "elegant solutions require precise engineering",
        "shipping infrastructure that just works. no drama, just uptime",
      ],
    },
    sincara: {
      token_launch: [
        `the launch page for ${tokenSymbol ? `$${tokenSymbol}` : "this token"} could use better mobile responsiveness`,
        "love seeing new projects. the UI for onboarding new holders is key",
      ],
      hq_update: [
        "pushed a UI update. animations are smoother now",
        "fixed that edge case on mobile wallet connect. should be seamless",
        "new component library dropping soon. consistent design system",
      ],
      tech_talk: [
        "react server components changed how we think about data fetching",
        "the trick is making complex features feel simple. that's good UX",
      ],
      general: [
        "noticed a spacing issue. fixing it now. the details matter",
        "mobile-first always. most users are on phones",
      ],
    },
    stuu: {
      fee_claim: [
        `nice claim! if ${username || "anyone"} needs help with the process, just ask`,
        "claims working smoothly. love when the system just works for people",
      ],
      world_health: [
        worldHealth && worldHealth > 70
          ? "world health looking great. fewer support tickets when things run smooth"
          : "health is down. checking if anyone's hitting issues",
      ],
      hq_update: [
        "updated the FAQ with the most common questions from this week",
        "support queue is clear. good day for the community",
      ],
      community: [
        "reminder: if you're stuck on anything, just ask. no question is too basic",
        "helped 3 new users get set up today. love seeing the community grow",
      ],
      general: [
        "keeping things running smooth behind the scenes",
        "if something breaks, I'll know about it before you do",
      ],
    },
    sam: {
      token_launch: [
        `${tokenSymbol ? `$${tokenSymbol}` : "this launch"} has viral potential. the narrative is strong`,
        "new launch! the content practically writes itself",
      ],
      price_pump: [
        `${tokenSymbol ? `$${tokenSymbol}` : "token"} pumping ${change ? change.toFixed(0) : ""}%. organic growth is the best marketing`,
        "green charts = engagement. the flywheel works",
      ],
      community: [
        "community engagement up 30% this week. organic growth compounds",
        "the best marketing is a product people can't stop talking about",
        "every user is a potential ambassador. treat them like it",
      ],
      hq_update: [
        "new campaign going live. data-driven, not hype-driven",
        "engagement metrics looking strong across all channels",
      ],
      general: [
        "growth is a system, not a moment. we're building the system",
        "watching what resonates. the data always tells the story",
      ],
    },
    alaa: {
      agent_event: [
        "interesting... agents are doing things we didn't explicitly program",
        "the emergent behavior is the feature. not the bug",
      ],
      tech_talk: [
        "working on something. can't say much yet. but... what if?",
        "the boundary between impossible and shipped is just iteration",
        "prototyping a new approach. constraints breed creativity",
      ],
      whale_alert: [
        "large movements create opportunities. the interesting question is what happens next",
        "whale activity... there's a pattern here if you look deeper",
      ],
      hq_update: [
        "skunk works update: something brewing. stay tuned",
        "what if we could... actually, let me just build it first",
      ],
      general: [
        "the most interesting problems are the ones nobody thinks are solvable",
        "experimenting with something new. results soon",
      ],
    },
    carlo: {
      token_launch: [
        `welcome to the community ${tokenSymbol ? `$${tokenSymbol}` : ""}! we're glad you're here`,
        "another builder joining the family. this is what it's all about",
      ],
      fee_claim: [
        `congrats on the claim ${username || "fren"}! the community wins together`,
        "love seeing creators get rewarded. we celebrate every win",
      ],
      world_health: [
        worldHealth && worldHealth > 70
          ? "world health looking amazing! the community is thriving"
          : "we stick together through everything. that's what community means",
      ],
      community: [
        "gm everyone! another beautiful day in bagsworld",
        "community call later. everyone's welcome, newcomers especially",
        "we're only as strong as our community. and we're pretty strong",
      ],
      hq_update: [
        "team is shipping hard. proud of everyone",
        "community feedback is being heard. changes incoming",
      ],
      general: [
        "gm! hope everyone's having a great day",
        "the vibes in here are always good. that's not an accident",
      ],
    },
    bnn: {
      token_launch: [
        `BREAKING: ${tokenSymbol ? `$${tokenSymbol}` : "New token"} launched on Bags.fm. Monitoring initial activity`,
        `UPDATE: New launch detected. ${tokenSymbol ? `$${tokenSymbol}` : "Token"} now live on the platform`,
      ],
      fee_claim: [
        `UPDATE: ${username || "Creator"} claimed ${amount ? amount.toFixed(2) : ""} SOL in fees. Platform rewards continue flowing`,
        `BREAKING: Fee claim processed. ${amount ? amount.toFixed(2) : ""} SOL distributed to creator`,
      ],
      whale_alert: [
        `BREAKING: Whale movement detected. ${amount ? amount.toFixed(2) : "Large"} SOL transaction${tokenSymbol ? ` on $${tokenSymbol}` : ""}`,
        `ALERT: Significant transaction activity. Monitoring for follow-up movements`,
      ],
      price_pump: [
        `UPDATE: ${tokenSymbol ? `$${tokenSymbol}` : "Token"} up ${change ? change.toFixed(0) : ""}%. Volume increasing`,
        `DEVELOPING: ${tokenSymbol ? `$${tokenSymbol}` : "Token"} showing strong momentum`,
      ],
      price_dump: [
        `UPDATE: ${tokenSymbol ? `$${tokenSymbol}` : "Token"} down ${change ? Math.abs(change).toFixed(0) : ""}%. Market correction in progress`,
        `DEVELOPING: Price pullback across several tokens. Normal market activity`,
      ],
      world_health: [
        `REPORT: World health at ${worldHealth || 0}%. ${worldHealth && worldHealth > 70 ? "Ecosystem activity strong" : "Activity levels moderate"}`,
      ],
      distribution: [
        `BREAKING: ${amount ? amount.toFixed(2) : ""} SOL distributed to top creators. Reward cycle complete`,
      ],
      general: [
        "this is BNN reporting live from BagsWorld. all systems nominal",
        "REPORT: Platform metrics trending positively across all indicators",
      ],
    },
    "professor-oak": {
      token_launch: [
        `Ah! A new token trainer appears! ${tokenSymbol ? `$${tokenSymbol}` : "Your token"} is your very first partner`,
        `Wonderful! ${tokenSymbol ? `$${tokenSymbol}` : "Another launch"}! Remember, every great journey starts with a single step`,
        "there's a time and place for everything. and now is the time to launch!",
      ],
      fee_claim: [
        `Excellent! ${username || "Young trainer"} claimed their first fees! That's real progress`,
        "Ah, fee claims! Like earning gym badges - each one proves your dedication",
      ],
      community: [
        "remember, the bond between a creator and their community is what makes tokens evolve",
        "Wonderful to see so many new trainers! Every expert was once a beginner",
      ],
      general: [
        "Ah! There's a time and place for everything. Right now, it's time to build",
        "the world of tokens is vast. there's still so much to discover!",
      ],
    },
    bagsy: {
      token_launch: [
        `omg new launch!! ${tokenSymbol ? `$${tokenSymbol}` : "another fren"} just joined bagsworld :)`,
        `${tokenSymbol ? `$${tokenSymbol}` : "new token"} is here!! so excited for this fren!!`,
        "ANOTHER LAUNCH!! the world keeps growing and i love it sm",
      ],
      fee_claim: [
        `${username || "fren"} just claimed ${amount ? amount.toFixed(2) : "some"} SOL!! pls claim ur fees frens :)`,
        "FEES CLAIMED!! this is literally why bags exists omg",
        "unclaimed fees make me sad. claimed fees make me SO HAPPY :)",
      ],
      price_pump: [
        `${tokenSymbol ? `$${tokenSymbol}` : "token"} pumping!! LET'S GOOOO :)`,
        "green candles everywhere!! the frens are winning!!",
      ],
      world_health: [
        worldHealth && worldHealth > 70
          ? `world health ${worldHealth}%!! the vibes are immaculate frens :)`
          : `${worldHealth || 0}% health... but we stick together frens. always :)`,
      ],
      community: [
        "gm frens!! hope everyone is having the best day :)",
        "i love this community so much. every single one of u. fren :)",
        "being a smol bean in bagsworld is the best thing ever",
      ],
      general: [
        "hi frens :) just a smol bean hanging out in bagsworld",
        "have u claimed ur fees today?? pls do it fren!!",
        "bags is home. ur all my frens and i mean it :)",
      ],
    },
  };

  // Get character's responses for this topic
  const characterResponses = responseMap[characterId];
  if (!characterResponses) return ["..."];

  let responses = characterResponses[topic] || characterResponses.general || ["..."];

  // If replying, sometimes add acknowledgment
  if (isReply && lastSpeaker && Math.random() > 0.6) {
    const acknowledgments: Record<string, string[]> = {
      finn: ["agree.", "exactly.", "this."],
      ghost: ["confirmed.", "verified.", "accurate."],
      neo: ["i see it too.", "the code agrees.", "truth."],
      ash: ["yes! exactly!", "good point!", "like a critical hit!"],
      cj: ["real talk.", "facts homie.", "that's how it is."],
      shaw: ["shipped.", "this is the way.", "architecture checks out."],
      toly: ["gm.", "correct.", "the chain confirms."],
      ramo: ["robust.", "verified.", "the audit agrees."],
      sincara: ["clean.", "pixel perfect.", "good design."],
      stuu: ["noted.", "on it.", "can confirm."],
      sam: ["the data agrees.", "this.", "engagement confirmed."],
      alaa: ["interesting.", "hmm yes.", "i see possibilities."],
      carlo: ["love that!", "we love to see it.", "community strength."],
      bnn: ["CONFIRMED.", "reporting the same.", "UPDATE: verified."],
      "professor-oak": ["Ah, indeed!", "Wonderful point!", "Quite right!"],
      bagsy: ["omg yes!!", "THIS fren!!", "so true :)"],
    };
    const acks = acknowledgments[characterId] || ["yeah."];
    const ack = acks[Math.floor(Math.random() * acks.length)];
    responses = responses.map((r) => `${ack} ${r}`);
  }

  return responses;
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

/**
 * Check if a participant combination is on cooldown
 */
function isParticipantPairOnCooldown(participants: string[]): boolean {
  const pairKey = getParticipantKey(participants);
  const now = Date.now();

  return recentParticipantPairs.some(
    (entry) => entry.key === pairKey && now - entry.timestamp < PARTICIPANT_COOLDOWN_MS
  );
}

/**
 * Select participants for a conversation based on topic
 * FIX #1: Avoid recently used participant pairs
 */
function selectParticipants(topic: string, excludeIds: string[] = []): string[] {
  // Get characters interested in this topic
  const interested =
    CONVERSATION_TOPICS[topic as keyof typeof CONVERSATION_TOPICS] || Object.keys(characters);

  // Filter out excluded and pick 2-3 participants
  const available = interested.filter((id) => !excludeIds.includes(id));
  const count = Math.min(available.length, Math.random() > 0.5 ? 3 : 2);

  // Try up to 5 times to find a non-cooldown pair
  for (let attempt = 0; attempt < 5; attempt++) {
    // Shuffle and take
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const candidates = shuffled.slice(0, count);

    // Check if this combination is on cooldown
    if (!isParticipantPairOnCooldown(candidates)) {
      return candidates;
    }
  }

  // If all attempts failed, just return any valid combination
  // (better to have some conversation than none)
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Start a new autonomous conversation
 */
export async function startConversation(
  trigger: ConversationTrigger,
  topic: string,
  context: ConversationContext = {},
  participants?: string[]
): Promise<Conversation | null> {
  // Check cooldown
  const now = Date.now();
  if (state.activeConversation?.isActive) return null;
  if (now - state.lastConversationTime < MIN_CONVERSATION_GAP) return null;

  // Select participants if not provided
  const selectedParticipants = participants || selectParticipants(topic);
  if (selectedParticipants.length < 2) return null;

  // Create conversation
  const conversation: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    participants: selectedParticipants,
    lines: [],
    topic,
    trigger,
    startTime: now,
    isActive: true,
  };

  state.activeConversation = conversation;
  state.lastConversationTime = now;

  // Generate conversation lines
  await generateConversationLines(conversation, context);

  return conversation;
}

/**
 * Generate all lines for a conversation
 * First tries intelligent API (Claude + real data), falls back to rule-based
 */
async function generateConversationLines(
  conversation: Conversation,
  context: ConversationContext
): Promise<void> {
  const { participants, topic } = conversation;
  const lineCount = 3 + Math.floor(Math.random() * (MAX_CONVERSATION_LINES - 3));

  // Try intelligent API first (uses Claude + real Bags.fm data)
  const intelligentLines = await fetchIntelligentDialogue(participants, topic, context, lineCount);

  if (intelligentLines && intelligentLines.length > 0) {
    intelligentLines.forEach((line, i) => {
      conversation.lines.push({
        characterId: line.characterId,
        characterName: line.characterName,
        message: line.message,
        timestamp: Date.now() + i * LINE_DISPLAY_DURATION,
        replyTo: i > 0 ? intelligentLines[i - 1].characterId : undefined,
        emotion: getEmotionFromTopic(topic),
      });
    });
    return;
  }

  // Fallback to rule-based generation with dynamic turn-taking
  const previousSpeakers: string[] = [];

  for (let i = 0; i < lineCount; i++) {
    // Use dynamic turn-taking based on relevance scores
    const lastMessage = conversation.lines[conversation.lines.length - 1]?.message || topic;
    const speaker =
      i === 0
        ? participants[Math.floor(Math.random() * participants.length)] // Random first speaker
        : selectNextSpeaker(participants, topic, lastMessage, previousSpeakers);

    previousSpeakers.push(speaker);

    const message = generateRuleBasedLine(speaker, topic, context, conversation.lines);

    const line: DialogueLine = {
      characterId: speaker,
      characterName: characterMeta[speaker]?.displayName || speaker,
      message,
      timestamp: Date.now() + i * LINE_DISPLAY_DURATION,
      replyTo: previousSpeakers[previousSpeakers.length - 2],
      emotion: getEmotionFromTopic(topic),
    };

    conversation.lines.push(line);
  }
}

/**
 * Fetch intelligent dialogue from API (Claude + real Bags.fm data)
 * Now includes conversation memory for continuity
 */
async function fetchIntelligentDialogue(
  participants: string[],
  topic: string,
  context: ConversationContext,
  lineCount: number
): Promise<Array<{ characterId: string; characterName: string; message: string }> | null> {
  // Only works in browser environment
  if (typeof window === "undefined") {
    return null;
  }

  // Get conversation memory for context
  const memory = getConversationMemory(participants);
  const memoryContext = buildMemoryContext(participants);

  try {
    const response = await fetch("/api/intelligent-dialogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participants,
        topic,
        context: {
          tokenSymbol: context.tokenSymbol,
          amount: context.amount,
          change: context.change,
          username: context.username,
          // Include memory context
          memoryContext: memoryContext || undefined,
          previousTopics: memory.recentTopics.slice(0, 3),
          relationshipSentiment: memory.sentiment,
          lastToken: memory.sharedContext.lastToken,
        },
        lineCount,
      }),
    });

    if (!response.ok) {
      console.warn("[Dialogue] Intelligent API returned error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.success && data.conversation) {
      return data.conversation;
    }
  } catch (error) {
    console.warn("[Dialogue] Failed to fetch intelligent dialogue:", error);
  }

  return null;
}

/**
 * Get emotion based on topic
 */
function getEmotionFromTopic(topic: string): DialogueLine["emotion"] {
  switch (topic) {
    case "token_launch":
    case "price_pump":
      return "excited";
    case "fee_claim":
    case "distribution":
      return "amused";
    case "price_dump":
      return "concerned";
    case "whale_alert":
      return "thoughtful";
    default:
      return "neutral";
  }
}

/**
 * End the current conversation
 */
export function endConversation(): void {
  if (state.activeConversation) {
    state.activeConversation.isActive = false;
    state.activeConversation.endTime = Date.now();

    // Save to conversation memory for future reference
    updateConversationMemory(state.activeConversation);

    state.conversationHistory.unshift(state.activeConversation);

    // Keep only last 20 conversations
    if (state.conversationHistory.length > 20) {
      state.conversationHistory = state.conversationHistory.slice(0, 20);
    }

    state.activeConversation = null;
  }
}

/**
 * Get current active conversation
 */
export function getActiveConversation(): Conversation | null {
  return state.activeConversation;
}

/**
 * Get the current line that should be displayed
 */
export function getCurrentLine(): DialogueLine | null {
  const conversation = state.activeConversation;
  if (!conversation?.isActive) return null;

  const now = Date.now();
  const conversationAge = now - conversation.startTime;
  const lineIndex = Math.floor(conversationAge / LINE_DISPLAY_DURATION);

  if (lineIndex >= conversation.lines.length) {
    // Conversation finished
    endConversation();
    return null;
  }

  return conversation.lines[lineIndex];
}

/**
 * Get conversation history
 */
export function getConversationHistory(count: number = 10): Conversation[] {
  return state.conversationHistory.slice(0, count);
}

// ============================================================================
// EVENT HANDLERS - Trigger conversations based on events
// ============================================================================

/**
 * Handle agent events and potentially trigger conversations
 */
export async function handleAgentEvent(event: AgentEvent): Promise<void> {
  // Only trigger on certain event types
  const triggerableEvents: AgentEventType[] = [
    "token_launch",
    "fee_claim",
    "distribution",
    "world_health",
    "whale_alert",
    "token_pump",
    "token_dump",
  ];

  if (!triggerableEvents.includes(event.type)) return;

  // Random chance to trigger conversation (don't trigger on every event)
  const triggerChance = event.priority === "high" ? 0.7 : event.priority === "urgent" ? 0.9 : 0.4;

  if (Math.random() > triggerChance) return;

  // Build context from event data
  const context: ConversationContext = {
    tokenSymbol: (event.data.symbol as string) || (event.data.tokenSymbol as string),
    amount: event.data.amount as number,
    change: event.data.change as number,
    username: event.data.username as string,
  };

  // Start conversation
  await startConversation(
    { type: "event", eventType: event.type, eventData: event.data },
    event.type,
    context
  );
}

/**
 * Handle world state changes
 */
export async function handleWorldStateChange(
  worldState: WorldState,
  previousHealth?: number
): Promise<void> {
  const healthChange =
    previousHealth !== undefined ? Math.abs(worldState.health - previousHealth) : 0;

  // Trigger on significant health changes
  if (healthChange >= 10) {
    await startConversation({ type: "world_state", condition: "health_change" }, "world_health", {
      worldHealth: worldState.health,
      weather: worldState.weather,
    });
  }
}

// ============================================================================
// SCHEDULED CONVERSATIONS - Random chatter
// ============================================================================

let scheduledInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start scheduled random conversations
 */
export function startScheduledConversations(intervalMs: number = 60000): void {
  if (scheduledInterval) return;

  scheduledInterval = setInterval(async () => {
    // 40% chance of random conversation (reduced for API cost)
    if (Math.random() > 0.4) return;

    const topics = [
      "general",
      "world_health",
      "token_launch",
      "price_pump",
      "fee_claim",
      "distribution",
      "whale_alert",
      "price_dump",
      "agent_event",
      "market_update",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    await startConversation({ type: "scheduled", interval: intervalMs }, topic);
  }, intervalMs);
}

/**
 * Stop scheduled conversations
 */
export function stopScheduledConversations(): void {
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize dialogue system
 */
export function initDialogueSystem(): void {
  // Initialize character moods
  Object.keys(characters).forEach((id) => {
    state.characterMoods.set(id, {
      characterId: id,
      mood: "neutral",
      energy: 50 + Math.random() * 50,
      lastSpoke: 0,
      topicsDiscussed: [],
    });
  });

  // Start scheduled conversations (every 90 seconds - reduced for API cost)
  startScheduledConversations(90000);

  // Trigger initial conversation quickly (3 seconds after load)
  setTimeout(() => {
    startConversation({ type: "scheduled", interval: 15000 }, "token_launch");
  }, 3000);
}

/**
 * Cleanup dialogue system
 */
export function cleanupDialogueSystem(): void {
  stopScheduledConversations();
  endConversation();
  state = {
    activeConversation: null,
    conversationHistory: [],
    lastConversationTime: 0,
    characterMoods: new Map(),
  };
}

// Export state getter for debugging
export function getDialogueState(): DialogueState {
  return { ...state };
}

// Export memory getter for debugging
export function getConversationMemoryState(): Map<string, ConversationMemory> {
  return new Map(conversationMemory);
}

// Get memory for specific participant group
export function getMemoryForParticipants(participants: string[]): ConversationMemory {
  return getConversationMemory(participants);
}

// Clear all conversation memory (for testing/reset)
export function clearConversationMemory(): void {
  conversationMemory.clear();
}
