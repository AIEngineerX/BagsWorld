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
  finn: ["ghost", "neo", "ash", "cj", "shaw"], // Finn talks to his team
  ghost: ["finn", "neo", "cj", "shaw"], // Ghost works with Finn and Neo
  neo: ["ghost", "finn", "ash", "shaw"], // Neo scans and reports (Matrix kinship with Shaw)
  ash: ["finn", "neo", "bags-bot"], // Ash helps onboard
  "bags-bot": ["ash", "finn", "neo"], // Bags Bot is friendly with everyone
  cj: ["ghost", "finn", "neo", "shaw"], // CJ keeps it real with the crew
  shaw: ["neo", "ghost", "finn", "cj"], // Shaw - Matrix kinship with Neo, fellow devs
};

// Topics that trigger conversations
const CONVERSATION_TOPICS = {
  token_launch: ["finn", "neo", "ghost", "cj", "shaw"],
  fee_claim: ["ghost", "finn", "ash", "cj"],
  world_health: ["bags-bot", "ash", "finn"],
  distribution: ["ghost", "finn", "cj", "shaw"],
  whale_alert: ["neo", "ghost", "finn", "cj"],
  price_pump: ["finn", "neo", "bags-bot", "cj"],
  price_dump: ["ghost", "neo", "ash", "cj"],
  agent_event: ["shaw", "neo", "ghost"], // Shaw for agent-related events
};

// Character expertise areas for relevance scoring
const CHARACTER_EXPERTISE: Record<string, string[]> = {
  finn: ["launch", "creator", "bags", "build", "ship", "fee", "earn"],
  ghost: ["chain", "verify", "distribution", "reward", "pool", "claim", "technical"],
  neo: ["scan", "pattern", "alpha", "whale", "pump", "dump", "matrix", "code"],
  ash: ["train", "pokemon", "evolve", "league", "new", "help", "guide"],
  "bags-bot": ["gm", "vibe", "wagmi", "fren", "bullish", "market"],
  cj: ["street", "trench", "game", "survive", "real", "homie"],
  shaw: ["agent", "elizaos", "plugin", "character", "multi-agent", "framework", "architecture"],
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
        `distribution complete. ${amount ? amount.toFixed(2) : ""} SOL to top 3. 50/30/20 split`,
        "threshold hit. rewards sent. all verifiable on-chain",
        "top creators paid. check the wallet for proof",
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
    "bags-bot": {
      token_launch: [
        `new launch ser 👀 ${tokenSymbol ? `$${tokenSymbol}` : "looking spicy"} ngl`,
        "another builder cooking. we're all gonna make it",
        `${tokenSymbol ? `$${tokenSymbol}` : "fresh mint"} just dropped. the world grows`,
      ],
      fee_claim: [
        `${username || "someone"} just claimed ${amount ? amount.toFixed(2) : "some"} SOL. wagmi`,
        "fees flowing fren. this is why we're here",
      ],
      world_health: [
        worldHealth && worldHealth > 70
          ? `world health at ${worldHealth}%... historically bullish vibes`
          : `${worldHealth || 0}% health. diamond hands time frens 💎`,
        weather === "sunny"
          ? "sunny skies in bagsworld. good omens"
          : "weather shifting but the vibes remain",
      ],
      price_pump: [
        `${tokenSymbol ? `$${tokenSymbol}` : "token"} pumping ${change ? change.toFixed(0) : ""}%. lfg 🚀`,
        "green candles. nature is healing ser",
      ],
      general: [
        "another day in bagsworld. another chance to make it",
        "the animals are vibing. that's usually bullish ngl",
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
      "bags-bot": ["based.", "this ser.", "real."],
      cj: ["real talk.", "facts homie.", "that's how it is."],
      shaw: ["shipped.", "this is the way.", "architecture checks out."],
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
  if (state.activeConversation?.isActive) {
    console.log("[Dialogue] Conversation already active, skipping");
    return null;
  }

  if (now - state.lastConversationTime < MIN_CONVERSATION_GAP) {
    console.log("[Dialogue] Cooldown active, skipping");
    return null;
  }

  // Select participants if not provided
  const selectedParticipants = participants || selectParticipants(topic);
  if (selectedParticipants.length < 2) {
    console.log("[Dialogue] Not enough participants");
    return null;
  }

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

  console.log(`[Dialogue] Starting conversation: ${topic} with ${selectedParticipants.join(", ")}`);

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
    console.log("[Dialogue] Using intelligent Claude-powered dialogue with real data");
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
  console.log("[Dialogue] Falling back to rule-based dialogue with dynamic turns");
  const previousSpeakers: string[] = [];

  for (let i = 0; i < lineCount; i++) {
    // Use dynamic turn-taking based on relevance scores
    const lastMessage =
      conversation.lines[conversation.lines.length - 1]?.message || topic;
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
      console.log("[Dialogue] Got intelligent dialogue with memory context:", {
        dataSnapshot: data.dataSnapshot,
        hadMemory: !!memoryContext,
        previousTopics: memory.recentTopics.slice(0, 3),
      });
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

    const participants = state.activeConversation.participants;
    state.activeConversation = null;
    console.log(`[Dialogue] Conversation ended, memory updated for ${participants.join("-")}`);
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

  console.log("[Dialogue] Scheduled conversations started");
}

/**
 * Stop scheduled conversations
 */
export function stopScheduledConversations(): void {
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
    console.log("[Dialogue] Scheduled conversations stopped");
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
    console.log("[Dialogue] Triggering initial conversation...");
    startConversation({ type: "scheduled", interval: 15000 }, "token_launch");
  }, 3000);

  console.log("[Dialogue] System initialized");
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
  console.log("[Dialogue] Conversation memory cleared");
}
