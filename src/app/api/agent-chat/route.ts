import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { getCharacter, generateCharacterPrompt, characterMeta } from "@/characters";
import { extractIntent, quickIntentCheck } from "@/lib/intent-extractor";

// Unified Agent Chat API - All characters powered by Opus 4.5
// Each character has unique personality, knowledge, and response style

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface AgentChatRequest {
  characterId: string; // neo, finn, ghost, ash, bags-bot
  message: string;
  worldState?: {
    health: number;
    weather: string;
    buildingCount: number;
    populationCount: number;
    topToken?: string;
  };
  chatHistory?: Array<{ role: string; content: string }>;
}

interface AgentChatResponse {
  message: string;
  characterId: string;
  characterName: string;
  actions?: Array<{
    type: "effect" | "animal" | "data" | "link";
    data: Record<string, unknown>;
  }>;
}

export async function POST(request: Request) {
  // Rate limit
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`agent:${clientIP}`, RATE_LIMITS.standard);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Slow down! Try again in a moment.", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
      { status: 429 }
    );
  }

  try {
    const body: AgentChatRequest = await request.json();
    const { characterId, message, worldState, chatHistory = [] } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Get character
    const character = getCharacter(characterId);
    const meta = characterMeta[characterId] || characterMeta["bags-bot"];

    // Check for action intents (Neo doesn't do animal control, etc.)
    let actions: AgentChatResponse["actions"] = [];

    // Only bags-bot handles animal/effect commands
    if (characterId === "bags-bot" && ANTHROPIC_API_KEY) {
      const quickIntent = quickIntentCheck(message);
      const intent = quickIntent || await extractIntent(message, ANTHROPIC_API_KEY, worldState);

      if (intent.action === "pet" || intent.action === "scare" || intent.action === "call" || intent.action === "feed") {
        actions.push({
          type: "animal",
          data: { animalType: intent.target?.name || "dog", animalAction: intent.action }
        });
      } else if (intent.action === "effect") {
        actions.push({
          type: "effect",
          data: { effectType: intent.target?.name || "fireworks" }
        });
      }
    }

    // Generate response using Opus 4.5
    if (ANTHROPIC_API_KEY) {
      const response = await generateAgentResponse(character, message, worldState, chatHistory);
      return NextResponse.json({
        message: response,
        characterId,
        characterName: meta.displayName,
        actions,
      });
    }

    // Fallback to character quotes if no API key
    const fallbackQuote = character.postExamples[Math.floor(Math.random() * character.postExamples.length)];
    return NextResponse.json({
      message: fallbackQuote,
      characterId,
      characterName: meta.displayName,
      actions,
    });

  } catch (error) {
    console.error("Agent chat error:", error);
    return NextResponse.json({ error: "Agent had a hiccup" }, { status: 500 });
  }
}

async function generateAgentResponse(
  character: ReturnType<typeof getCharacter>,
  message: string,
  worldState: AgentChatRequest["worldState"],
  chatHistory: Array<{ role: string; content: string }>
): Promise<string> {
  // Build character-specific system prompt
  const characterPrompt = generateCharacterPrompt(character);

  // Add world context
  const worldContext = worldState ? `
CURRENT BAGSWORLD STATE:
- World Health: ${worldState.health}% ${worldState.health >= 80 ? "(thriving)" : worldState.health <= 30 ? "(struggling)" : ""}
- Weather: ${worldState.weather}
- Active Buildings: ${worldState.buildingCount}
- Citizens: ${worldState.populationCount}
${worldState.topToken ? `- Top Token: $${worldState.topToken}` : ""}
` : "";

  const systemPrompt = `${characterPrompt}
${worldContext}
IMPORTANT: Stay in character. Keep responses concise (1-3 sentences). Be helpful and engaging.`;

  // Build message history
  const messages = chatHistory.slice(-8).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content
  }));
  messages.push({ role: "user", content: message });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5-20251101",
      max_tokens: 300,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "...";
}

// GET endpoint to list available characters
export async function GET() {
  return NextResponse.json({
    characters: Object.entries(characterMeta).map(([id, meta]) => ({
      id,
      ...meta,
    })),
  });
}
