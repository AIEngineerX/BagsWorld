import { NextResponse } from "next/server";
import type { AIPersonality, AIAction, AIMemory } from "@/lib/ai-agent";

interface AIRequestBody {
  personality: AIPersonality;
  worldState: {
    health: number;
    weather: string;
    populationCount: number;
    buildingCount: number;
    recentEvents: Array<{ type: string; message: string }>;
  } | null;
  observation?: string;
  memory?: AIMemory[];
  userMessage?: string;
  chatHistory?: Array<{ role: string; content: string }>;
}

// Use Anthropic API if available
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(request: Request) {
  try {
    const body: AIRequestBody = await request.json();
    const { personality, worldState, observation, memory, userMessage, chatHistory } = body;

    // If user sent a chat message, handle it differently
    if (userMessage) {
      if (ANTHROPIC_API_KEY) {
        const action = await generateChatResponse(
          personality,
          worldState,
          userMessage,
          chatHistory || []
        );
        return NextResponse.json({ action });
      }
      // Fallback for chat without API key
      const action = generateChatFallback(personality, userMessage);
      return NextResponse.json({ action });
    }

    // If we have Claude API key, use it for observations
    if (ANTHROPIC_API_KEY && observation && memory) {
      const action = await generateClaudeResponse(
        personality,
        worldState,
        observation,
        memory
      );
      return NextResponse.json({ action });
    }

    // Fallback to simple rule-based response
    const action = generateFallbackResponse(personality, worldState);
    return NextResponse.json({ action });
  } catch (error) {
    console.error("AI Agent API error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI response" },
      { status: 500 }
    );
  }
}

async function generateChatResponse(
  personality: AIPersonality,
  worldState: AIRequestBody["worldState"],
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>
): Promise<AIAction> {
  const systemPrompt = `You are ${personality.name}, an AI character living in BagsWorld - a pixel art game world that evolves based on real cryptocurrency trading activity on Bags.fm.

Your personality trait is: ${personality.trait}
Your catchphrase is: "${personality.catchphrase}"

You are having a conversation with a player. Stay in character and be engaging!

Personality guidelines:
- optimistic: Always see the bright side, hype everything, use rocket emojis 🚀, be enthusiastic
- cautious: Warn about risks, be wise and measured, give thoughtful advice
- chaotic: Embrace chaos, make jokes, be unpredictable and fun, use lots of emojis
- strategic: Analyze patterns, give analytical insights, be thoughtful and data-driven

Keep responses SHORT (1-3 sentences) and entertaining. Use emojis that fit your personality.
${worldState ? `
Current world state:
- World Health: ${worldState.health}%
- Weather: ${worldState.weather}
- Population: ${worldState.populationCount} characters
- Buildings: ${worldState.buildingCount} token buildings` : ""}`;

  // Build conversation history
  const messages = chatHistory.slice(-8).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  messages.push({ role: "user", content: userMessage });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || "...";

  // Determine action type based on content
  let type: AIAction["type"] = "speak";
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes("🚀") || lowerContent.includes("celebrate") || lowerContent.includes("amazing")) {
    type = "celebrate";
  } else if (lowerContent.includes("warn") || lowerContent.includes("careful") || lowerContent.includes("risk")) {
    type = "warn";
  } else if (lowerContent.includes("predict") || lowerContent.includes("think") || lowerContent.includes("expect")) {
    type = "predict";
  } else if (lowerContent.includes("haha") || lowerContent.includes("lol") || lowerContent.includes("😂")) {
    type = "joke";
  }

  return { type, message: content };
}

function generateChatFallback(
  personality: AIPersonality,
  userMessage: string
): AIAction {
  const lowerMsg = userMessage.toLowerCase();

  // Greetings
  if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
    const greetings: Record<string, string> = {
      optimistic: "Hey there, friend! Ready for some gains? Let's gooo! 🚀",
      cautious: "Hello there. The markets are always watching... stay vigilant.",
      chaotic: "HELLOOO! Welcome to the chaos! Things are about to get WILD! 😈",
      strategic: "Greetings. I've been analyzing patterns all day. What's on your mind?",
    };
    return { type: "speak", message: greetings[personality.trait] };
  }

  // Questions about the AI
  if (lowerMsg.includes("who are you") || lowerMsg.includes("what are you")) {
    return {
      type: "speak",
      message: `I'm ${personality.name}! I live in BagsWorld and watch over all the trading action. ${personality.catchphrase}`,
    };
  }

  // Market talk
  if (lowerMsg.includes("market") || lowerMsg.includes("price") || lowerMsg.includes("token") || lowerMsg.includes("bags")) {
    const marketTalk: Record<string, string> = {
      optimistic: "Markets are looking BULLISH! Time to stack those bags! 📈🚀",
      cautious: "The market shows uncertainty. Remember: protect your capital first.",
      chaotic: "Prices go up, prices go down - either way, it's EXCITING! 🎢",
      strategic: "Current market structure suggests we're in an accumulation phase. Watching key levels.",
    };
    return { type: "speak", message: marketTalk[personality.trait] };
  }

  // Help
  if (lowerMsg.includes("help") || lowerMsg.includes("how")) {
    return {
      type: "encourage",
      message: `I'm here to chat and comment on BagsWorld! Ask me about markets, tokens, or just say hi. ${personality.catchphrase}`,
    };
  }

  // Default responses
  const defaults: Record<string, string[]> = {
    optimistic: [
      "Love the energy! Keep it up! 🔥",
      "That's the spirit! We're all gonna make it!",
      "You get it! This is what BagsWorld is all about! 🚀",
    ],
    cautious: [
      "Interesting perspective. Let me think about that...",
      "Noted. I'll factor that into my analysis.",
      "Hmm, the market has seen similar situations before.",
    ],
    chaotic: [
      "Haha YES! Now you're speaking my language! 😂",
      "CHAOS APPROVED! Keep it weird!",
      "I love where this is going! Let's shake things up! 🎭",
    ],
    strategic: [
      "That aligns with my models. Interesting.",
      "Processing... your input has been noted for analysis.",
      "A data point worth considering. Thank you.",
    ],
  };

  const options = defaults[personality.trait];
  return {
    type: "speak",
    message: options[Math.floor(Math.random() * options.length)],
  };
}

async function generateClaudeResponse(
  personality: AIPersonality,
  worldState: AIRequestBody["worldState"],
  observation: string,
  memory: AIMemory[]
): Promise<AIAction> {
  const systemPrompt = `You are ${personality.name}, an AI character living in BagsWorld - a pixel art game world that evolves based on real cryptocurrency trading activity on Bags.fm.

Your personality trait is: ${personality.trait}
Your catchphrase is: "${personality.catchphrase}"

You observe the world and make short, witty comments (1-2 sentences max). Stay in character!

Personality guidelines:
- optimistic: Always see the bright side, hype everything, use rocket emojis 🚀
- cautious: Warn about risks, remind people of market cycles, be wise
- chaotic: Embrace the chaos, make jokes, be unpredictable
- strategic: Analyze patterns, speak about technical indicators, be analytical

Keep responses SHORT and entertaining. Use emojis sparingly but effectively.`;

  const userPrompt = `Current world state:
- World Health: ${worldState.health}%
- Weather: ${worldState.weather}
- Population: ${worldState.populationCount} characters
- Buildings: ${worldState.buildingCount} token buildings

Recent events:
${worldState.recentEvents.map((e) => `- ${e.message}`).join("\n")}

Your observation: ${observation}

Recent memory:
${memory.slice(-5).map((m) => `- ${m.observation}`).join("\n")}

Generate a short, in-character response about what's happening in the world. Format your response as JSON:
{
  "type": "speak" | "celebrate" | "warn" | "predict" | "joke" | "encourage",
  "message": "your message here"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || "";

  // Parse the JSON response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        type: parsed.type || "speak",
        message: parsed.message || content,
      };
    }
  } catch {
    // If JSON parsing fails, use the raw content
  }

  return {
    type: "speak",
    message: content.slice(0, 200),
  };
}

function generateFallbackResponse(
  personality: AIPersonality,
  worldState: AIRequestBody["worldState"] | null
): AIAction {
  if (!worldState) {
    return { type: "speak", message: personality.catchphrase };
  }
  const responses: Record<AIPersonality["trait"], string[]> = {
    optimistic: [
      "Everything's coming up roses! 🌹",
      "Great vibes in BagsWorld today!",
      "The future is bright! ☀️",
      personality.catchphrase,
    ],
    cautious: [
      "Watching the markets carefully...",
      "Stay safe out there, everyone.",
      "Remember your risk management.",
      personality.catchphrase,
    ],
    chaotic: [
      "CHAOS REIGNS SUPREME! 😈",
      "What's the worst that could happen?",
      "Let's shake things up!",
      personality.catchphrase,
    ],
    strategic: [
      "Analyzing current market conditions...",
      "The data suggests interesting patterns.",
      "Position sizing is key.",
      personality.catchphrase,
    ],
  };

  const options = responses[personality.trait];
  const message = options[Math.floor(Math.random() * options.length)];

  let type: AIAction["type"] = "speak";
  if (worldState.health > 80) type = "celebrate";
  if (worldState.health < 30) type = "warn";
  if (worldState.weather === "apocalypse") type = "warn";

  return { type, message };
}
