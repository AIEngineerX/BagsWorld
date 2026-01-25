// Multi-Agent Dialogue API Route
// Triggers conversations between BagsWorld AI agents

import { NextResponse } from "next/server";
import { getCharacter, type Character } from "@/lib/characters";

const AVAILABLE_AGENTS = ["neo", "cj", "finn", "bags-bot", "toly", "ash", "shaw", "ghost"] as const;

interface DialogueTurn {
  speaker: string;
  speakerName: string;
  message: string;
  timestamp: number;
}

// Build dialogue system prompt
function buildDialogueSystemPrompt(
  characters: Array<Character | undefined>,
  topic: string,
  style: string
): string {
  let prompt = `You are a dialogue director orchestrating a multi-agent conversation between BagsWorld AI characters.

Your task is to generate a natural, in-character conversation about: "${topic}"

The conversation should be ${
    style === "casual"
      ? "casual and friendly"
      : style === "formal"
        ? "professional and informative"
        : style === "debate"
          ? "a respectful debate with different viewpoints"
          : "collaborative and solution-oriented"
  }.

CHARACTER PROFILES:
`;

  for (const char of characters) {
    if (!char) continue;
    const bio = Array.isArray(char.bio) ? char.bio : [char.bio || ""];
    const styleAll = char.style?.all || [];
    prompt += `\n**${char.name}**:\n`;
    prompt += `- Bio: ${bio.slice(0, 2).join(". ")}\n`;
    prompt += `- Style: ${styleAll.slice(0, 2).join(", ")}\n`;
  }

  prompt += `
RULES:
1. Each character must stay in their established voice and personality
2. Keep individual turns SHORT (1-3 sentences max)
3. Characters should build on each other's points
4. Include natural reactions and acknowledgments
5. The conversation should feel organic, not scripted
6. End with a natural conclusion or agreement

FORMAT:
Output the dialogue as a series of turns, one per line, in this exact format:
[CharacterName]: Their dialogue here.

Example:
[Neo]: i see something in the chain...
[Finn]: what is it? new launch?
[Neo]: patterns forming. could be interesting.
`;

  return prompt;
}

// Parse dialogue response
function parseDialogueResponse(text: string, participants: string[]): DialogueTurn[] {
  const turns: DialogueTurn[] = [];
  const lines = text.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const match = line.match(/^\[?(\w+)\]?:\s*(.+)$/);
    if (match) {
      const speaker = match[1];
      const message = match[2].trim();

      const validSpeaker = participants.find((p) => p.toLowerCase() === speaker.toLowerCase());

      if (validSpeaker) {
        const character = getCharacter(validSpeaker);
        turns.push({
          speaker: validSpeaker,
          speakerName: character?.name || validSpeaker,
          message,
          timestamp: Date.now(),
        });
      }
    }
  }

  return turns;
}

// Generate dialogue using Claude API
async function generateDialogue(
  apiKey: string,
  topic: string,
  participants: string[],
  initiator: string,
  maxTurns: number,
  style: string,
  context?: string
): Promise<{ turns: DialogueTurn[]; sentiment: string }> {
  const characters = participants.map((p) => getCharacter(p));
  const systemPrompt = buildDialogueSystemPrompt(characters, topic, style);

  const initiatorChar = characters.find((c) => c?.name.toLowerCase() === initiator.toLowerCase());
  const initiatorName = initiatorChar?.name || initiator;

  let userPrompt = `Generate a ${maxTurns}-turn conversation about "${topic}".

The conversation starts with ${initiatorName} initiating.
Participants: ${characters
    .map((c) => c?.name)
    .filter(Boolean)
    .join(", ")}
`;

  if (context) {
    userPrompt += `\nAdditional context: ${context}\n`;
  }

  userPrompt += `\nGenerate the dialogue now:`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0];

  if (content?.type !== "text") {
    throw new Error("Unexpected response format");
  }

  const turns = parseDialogueResponse(content.text, participants);

  // Determine sentiment
  const positiveWords = [
    "great",
    "good",
    "excellent",
    "love",
    "amazing",
    "bullish",
    "pumping",
    "wagmi",
  ];
  const negativeWords = ["bad", "terrible", "hate", "bearish", "dumping", "ngmi", "rug"];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const turn of turns) {
    const lower = turn.message.toLowerCase();
    positiveCount += positiveWords.filter((w) => lower.includes(w)).length;
    negativeCount += negativeWords.filter((w) => lower.includes(w)).length;
  }

  const sentiment =
    positiveCount > negativeCount
      ? "positive"
      : negativeCount > positiveCount
        ? "negative"
        : "neutral";

  return { turns, sentiment };
}

// POST handler - generate a dialogue
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, participants, initiator, maxTurns = 6, style = "casual", context } = body;

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    // Default to 2 random agents if none specified
    let dialogueParticipants = participants;
    if (!dialogueParticipants || dialogueParticipants.length < 2) {
      const shuffled = [...AVAILABLE_AGENTS].sort(() => Math.random() - 0.5);
      dialogueParticipants = shuffled.slice(0, Math.random() > 0.5 ? 3 : 2);
    }

    // Validate all participants exist
    for (const participant of dialogueParticipants) {
      if (!getCharacter(participant)) {
        return NextResponse.json(
          {
            error: `Unknown participant: ${participant}. Available: ${AVAILABLE_AGENTS.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Determine initiator
    const dialogueInitiator = initiator || dialogueParticipants[0];
    if (!dialogueParticipants.includes(dialogueInitiator)) {
      dialogueParticipants.unshift(dialogueInitiator);
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Please set ANTHROPIC_API_KEY." },
        { status: 503 }
      );
    }

    // Generate the dialogue
    const result = await generateDialogue(
      apiKey,
      topic,
      dialogueParticipants,
      dialogueInitiator,
      maxTurns,
      style,
      context
    );

    return NextResponse.json({
      success: true,
      dialogue: {
        topic,
        participants: dialogueParticipants.map((p: string) => ({
          id: p,
          name: getCharacter(p)?.name || p,
        })),
        initiator: dialogueInitiator,
        turns: result.turns,
        sentiment: result.sentiment,
        summary: `${result.turns.length}-turn conversation about the topic`,
        style,
      },
    });
  } catch (error) {
    console.error("[Dialogue API] Error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Claude API")) {
        return NextResponse.json({ error: "AI service error. Please try again." }, { status: 503 });
      }
    }

    return NextResponse.json({ error: "Failed to generate dialogue" }, { status: 500 });
  }
}

// Agent expertise mapping
const AGENT_EXPERTISE: Record<string, string[]> = {
  neo: ["alpha", "scanning", "patterns"],
  cj: ["community", "vibes", "culture"],
  finn: ["launches", "bags.fm", "creators"],
  "bags-bot": ["market data", "trading", "metrics"],
  toly: ["solana", "blockchain", "PoH"],
  ash: ["evolution", "growth", "exploration"],
  shaw: ["elizaos", "agents", "multi-agent"],
  ghost: ["rewards", "fees", "distribution"],
};

const SUGGESTED_TOPICS = [
  {
    topic: "Creator rewards on Solana",
    participants: ["finn", "ghost", "toly"],
    style: "collaborative",
  },
  {
    topic: "Is this token going to pump?",
    participants: ["neo", "cj", "bags-bot"],
    style: "debate",
  },
  {
    topic: "Building the AI agent ecosystem",
    participants: ["shaw", "toly", "finn"],
    style: "casual",
  },
  { topic: "Evolving your token", participants: ["ash", "finn", "ghost"], style: "collaborative" },
  { topic: "Early alpha on launches", participants: ["neo", "finn", "cj"], style: "casual" },
];

// GET handler - list available dialogue topics and agents
export async function GET() {
  const agents = AVAILABLE_AGENTS.map((id) => {
    const character = getCharacter(id);
    const bio = character?.bio;
    return {
      id,
      name: character?.name || id,
      description: Array.isArray(bio) ? bio[0] : "A BagsWorld AI agent",
      expertise: AGENT_EXPERTISE[id] || [],
    };
  });

  return NextResponse.json({
    success: true,
    agents,
    suggestedTopics: SUGGESTED_TOPICS,
    styles: ["casual", "formal", "debate", "collaborative"],
    maxTurnsRange: { min: 4, max: 12, default: 6 },
  });
}
