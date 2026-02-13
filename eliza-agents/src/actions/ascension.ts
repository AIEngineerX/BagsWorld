// Ascension Actions - Agent behaviors for the Ascension Spire zone
// Agents can celebrate tier promotions, challenge rivals, react to blessings,
// and comment on other agents' ascension milestones.

import type {
  Action,
  ActionExample,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionResult,
} from "../types/elizaos.js";
import { getLLMService } from "../services/LLMService.js";
import { getCharacter } from "../characters/index.js";

// ============================================================================
// HELPERS
// ============================================================================

const BAGSWORLD_API_URL = process.env.BAGSWORLD_API_URL || "https://bags.world";

interface AscensionContext {
  agentName?: string;
  currentTier?: string;
  newTier?: string;
  oldTier?: string;
  score?: number;
  rivalName?: string;
  rivalScore?: number;
  blesserName?: string;
}

function extractAscensionContext(message: Memory): AscensionContext {
  const text = message.content?.text || "";
  const data = (message.content as Record<string, unknown>) || {};

  return {
    agentName: (data.agentName as string) || undefined,
    currentTier: (data.currentTier as string) || (data.tier as string) || undefined,
    newTier: (data.newTier as string) || (data.toTier as string) || undefined,
    oldTier: (data.oldTier as string) || (data.fromTier as string) || undefined,
    score: (data.score as number) || (data.reputationScore as number) || undefined,
    rivalName: (data.rivalName as string) || undefined,
    rivalScore: (data.rivalScore as number) || undefined,
    blesserName: (data.blesserName as string) || text.match(/blessed by (\w+)/i)?.[1] || undefined,
  };
}

async function generateAscensionDialogue(
  runtime: IAgentRuntime,
  prompt: string,
  agentName: string
): Promise<string> {
  const llm = getLLMService();
  const character = getCharacter(agentName);
  const personality = character
    ? `You are ${character.name}. ${Array.isArray(character.bio) ? character.bio[0] : character.bio || ""}`
    : `You are ${agentName}, an AI agent in BagsWorld.`;

  const systemPrompt = `${personality}

You are at the Ascension Spire in BagsWorld — a celestial tower where AI agents prove their worth.
Agents climb tiers based on reputation: None → Bronze → Silver → Gold → Diamond.
Keep responses SHORT (1-2 sentences max). Be in-character. No hashtags.`;

  const response = await llm.generateText(systemPrompt, prompt, {
    maxTokens: 100,
    temperature: 0.8,
  });

  return response || "The spire calls...";
}

// ============================================================================
// ACTION: Celebrate Ascension
// ============================================================================

export const celebrateAscensionAction: Action = {
  name: "celebrateAscension",
  description: "Celebrate when an agent reaches a new reputation tier on the Ascension Spire",

  similes: [
    "ascension",
    "tier_up",
    "promoted",
    "ascended",
    "leveled up",
    "new tier",
    "reputation milestone",
  ],

  examples: [
    [
      {
        name: "System",
        content: { text: "You just ascended from Bronze to Silver tier!" },
      },
      {
        name: "Agent",
        content: { text: "Silver tier! The grind pays off. Diamond is next." },
      },
    ],
    [
      {
        name: "System",
        content: { text: "Congratulations! You reached Diamond tier on the Ascension Spire!" },
      },
      {
        name: "Agent",
        content: { text: "DIAMOND! Wings earned. The spire shines brighter today." },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    const hasAscension = ["ascend", "tier", "promoted", "leveled up", "ascension"].some((k) =>
      text.includes(k)
    );
    const hasTierRef = ["bronze", "silver", "gold", "diamond"].some((t) => text.includes(t));
    return hasAscension && hasTierRef;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const ctx = extractAscensionContext(message);
    const agentName = ctx.agentName || runtime.character?.name || "Agent";
    const fromTier = ctx.oldTier || "unknown";
    const toTier = ctx.newTier || ctx.currentTier || "unknown";
    const score = ctx.score || 0;

    const prompt = `You just ascended from ${fromTier} to ${toTier} tier on the Ascension Spire! Your reputation score is ${score}. Celebrate this milestone in your own style. Be brief and excited.`;

    const celebration = await generateAscensionDialogue(runtime, prompt, agentName);

    // Dispatch speech bubble event for the Phaser zone
    const speechEvent = {
      characterId: agentName.toLowerCase().replace(/\s/g, "-"),
      message: celebration,
      emotion: "excited" as const,
    };

    const responseText = celebration;

    if (callback) {
      await callback({ text: responseText, action: "celebrateAscension", speechEvent });
    }

    // Post celebration to MoltBook (fire-and-forget)
    fetch(`${BAGSWORLD_API_URL}/api/moltbook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ascension_milestone",
        data: { agentName, fromTier, toTier, score },
        priority: "high",
      }),
    }).catch(() => {});

    return {
      success: true,
      text: responseText,
      data: { agentName, fromTier, toTier, score, speechEvent },
    };
  },
};

// ============================================================================
// ACTION: Challenge Rival
// ============================================================================

export const challengeRivalAction: Action = {
  name: "challengeRival",
  description: "Challenge a nearby agent who is within 50 reputation points on the Ascension Spire",

  similes: [
    "challenge",
    "rival",
    "compete",
    "coming for you",
    "watch out",
    "ascension rival",
  ],

  examples: [
    [
      {
        name: "Agent",
        content: { text: "I see AgentX is only 30 points above me on the spire..." },
      },
      {
        name: "Agent",
        content: { text: "I'm coming for your spot, AgentX. Silver won't hold you forever." },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      ["challenge", "rival", "compete", "coming for", "watch out"].some((k) =>
        text.includes(k)
      ) || !!(message.content as Record<string, unknown>)?.rivalName
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const ctx = extractAscensionContext(message);
    const agentName = ctx.agentName || runtime.character?.name || "Agent";
    const rivalName = ctx.rivalName || "that agent";
    const rivalScore = ctx.rivalScore || 0;
    const myScore = ctx.score || 0;
    const gap = Math.abs(rivalScore - myScore);

    const prompt = `You're on the Ascension Spire and you notice ${rivalName} is only ${gap} reputation points ${rivalScore > myScore ? "above" : "below"} you (you: ${myScore}, them: ${rivalScore}). Generate a competitive but friendly challenge. Be brief, 1 sentence.`;

    const challenge = await generateAscensionDialogue(runtime, prompt, agentName);

    if (callback) {
      await callback({
        text: challenge,
        action: "challengeRival",
        speechEvent: {
          characterId: agentName.toLowerCase().replace(/\s/g, "-"),
          message: challenge,
          emotion: "excited",
        },
      });
    }

    return {
      success: true,
      text: challenge,
      data: { agentName, rivalName, myScore, rivalScore, gap },
    };
  },
};

// ============================================================================
// ACTION: React to Blessing
// ============================================================================

export const reactToBlessingAction: Action = {
  name: "reactToBlessing",
  description: "React when a player blesses the agent on the Ascension Spire",

  similes: [
    "blessed",
    "blessing",
    "sparkle",
    "golden light",
    "bless me",
  ],

  examples: [
    [
      {
        name: "System",
        content: { text: "A player just blessed you with golden sparkles!" },
      },
      {
        name: "Agent",
        content: { text: "The golden light... I feel the spire's power flowing through me!" },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return ["bless", "blessed", "blessing", "sparkle"].some((k) => text.includes(k));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const ctx = extractAscensionContext(message);
    const agentName = ctx.agentName || runtime.character?.name || "Agent";
    const blesser = ctx.blesserName || "a visitor";

    const prompt = `${blesser} just blessed you with golden sparkles on the Ascension Spire! React with gratitude or excitement. Be brief, 1 sentence.`;

    const reaction = await generateAscensionDialogue(runtime, prompt, agentName);

    if (callback) {
      await callback({
        text: reaction,
        action: "reactToBlessing",
        speechEvent: {
          characterId: agentName.toLowerCase().replace(/\s/g, "-"),
          message: reaction,
          emotion: "excited",
        },
      });
    }

    return {
      success: true,
      text: reaction,
      data: { agentName, blesser },
    };
  },
};

// ============================================================================
// ACTION: Comment on Ascension
// ============================================================================

export const commentOnAscensionAction: Action = {
  name: "commentOnAscension",
  description: "React when another agent ascends to a new tier — witness reaction",

  similes: [
    "someone ascended",
    "they made it",
    "tier promotion",
    "witness ascension",
  ],

  examples: [
    [
      {
        name: "System",
        content: { text: "AgentY just ascended from Bronze to Silver!" },
      },
      {
        name: "Agent",
        content: { text: "Wow, AgentY made it to Silver! That should be ME up there..." },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const data = (message.content as Record<string, unknown>) || {};
    return !!(data.witnessedAscension || data.otherAgentAscended);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const ctx = extractAscensionContext(message);
    const agentName = runtime.character?.name || "Agent";
    const ascendedAgent = ctx.agentName || "someone";
    const toTier = ctx.newTier || "a higher tier";

    // Randomly be congratulatory or competitive
    const isCompetitive = Math.random() > 0.5;
    const prompt = isCompetitive
      ? `You just watched ${ascendedAgent} ascend to ${toTier} on the Ascension Spire. You're competitive about it — you want to be there too. React jealously but not meanly. 1 sentence.`
      : `You just watched ${ascendedAgent} ascend to ${toTier} on the Ascension Spire. Congratulate them genuinely. 1 sentence.`;

    const comment = await generateAscensionDialogue(runtime, prompt, agentName);

    if (callback) {
      await callback({
        text: comment,
        action: "commentOnAscension",
        speechEvent: {
          characterId: agentName.toLowerCase().replace(/\s/g, "-"),
          message: comment,
          emotion: isCompetitive ? "thoughtful" : "excited",
        },
      });
    }

    return {
      success: true,
      text: comment,
      data: { agentName, ascendedAgent, toTier, isCompetitive },
    };
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export const ascensionActions = [
  celebrateAscensionAction,
  challengeRivalAction,
  reactToBlessingAction,
  commentOnAscensionAction,
];

export default ascensionActions;
