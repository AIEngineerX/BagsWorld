import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { extractIntent, quickIntentCheck, type ExtractedIntent } from "@/lib/intent-extractor";
import { bagsBotCharacter, generateCharacterPrompt } from "@/characters/bags-bot.character";

// BagsWorld Bot - elizaOS-style intelligent agent
// Uses LLM intent extraction + rich character personality

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CHARACTER_PROMPT = generateCharacterPrompt(bagsBotCharacter);

interface BotRequest {
  action: "chat" | "animal" | "effect" | "announce";
  message?: string;
  // Animal control
  animalType?: "dog" | "cat" | "bird" | "butterfly" | "squirrel";
  animalAction?: "pet" | "scare" | "call" | "feed";
  // World effects
  effectType?: "fireworks" | "celebration" | "coins" | "hearts" | "confetti" | "stars" | "ufo";
  effectX?: number;
  effectY?: number;
  // World context for Claude
  worldState?: {
    health: number;
    weather: string;
    buildingCount: number;
    populationCount: number;
    topToken?: string;
  };
  chatHistory?: Array<{ role: string; content: string }>;
}

interface BotResponse {
  message: string;
  actions?: Array<{
    type: "animal" | "effect" | "announce" | "sound";
    data: Record<string, unknown>;
  }>;
}

export async function POST(request: Request) {
  // Rate limit
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`bot:${clientIP}`, RATE_LIMITS.standard);

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Slow down! Try again in a moment.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      { status: 429 }
    );
  }

  try {
    const body: BotRequest = await request.json();
    const { action } = body;

    switch (action) {
      case "chat":
        return handleChat(body);
      case "animal":
        return handleAnimal(body);
      case "effect":
        return handleEffect(body);
      case "announce":
        return handleAnnounce(body);
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Bot error:", error);
    return NextResponse.json({ error: "Bot had a hiccup" }, { status: 500 });
  }
}

// Main chat handler - uses LLM intent extraction for natural language understanding
async function handleChat(body: BotRequest): Promise<NextResponse> {
  const { message = "", worldState, chatHistory = [] } = body;
  const response: BotResponse = { message: "", actions: [] };

  // First: Quick check for obvious patterns (saves API calls)
  let intent: ExtractedIntent | null = quickIntentCheck(message);

  // If not obvious and we have API key, use LLM extraction
  if (!intent && ANTHROPIC_API_KEY) {
    intent = await extractIntent(message, ANTHROPIC_API_KEY, worldState);
    console.log(
      `Intent extracted: ${intent.action} (${intent.confidence}) - ${intent.reasoning || "no reason"}`
    );
  }

  // Fallback to basic chat if no intent
  if (!intent) {
    intent = { action: "chat", confidence: 0.5 };
  }

  // Handle based on extracted intent
  switch (intent.action) {
    case "pet":
    case "scare":
    case "call":
    case "feed": {
      const animal = (intent.target?.name || "dog") as
        | "dog"
        | "cat"
        | "bird"
        | "butterfly"
        | "squirrel";
      const animalAction = intent.action === "feed" ? "pet" : intent.action;

      response.actions!.push({
        type: "animal",
        data: { animalType: animal, animalAction },
      });
      response.message = getAnimalResponse(animal, animalAction);
      return NextResponse.json(response);
    }

    case "effect": {
      const effectName = intent.target?.name || "fireworks";
      const effectType = effectName as "fireworks" | "coins" | "hearts" | "confetti" | "stars";

      response.actions!.push({
        type: "effect",
        data: { effectType, x: 400, y: 250 },
      });

      const effectMessages: Record<string, string> = {
        fireworks: "let's gooo! 🎆",
        coins: "making it rain! 💰",
        hearts: "sending love! 💕",
        confetti: "confetti time! 🎊",
        stars: "shooting stars! ✨",
        ufo: "👽 they're coming for your bags! 🛸",
      };
      response.message = effectMessages[effectType] || "✨";
      return NextResponse.json(response);
    }

    case "query": {
      // Answer questions about the world
      if (worldState) {
        response.message = `world health: ${worldState.health}%, weather: ${worldState.weather}, ${worldState.buildingCount} buildings, ${worldState.populationCount} citizens`;
        if (worldState.topToken) {
          response.message += `. top bag: $${worldState.topToken}`;
        }
      } else {
        response.message = "world is vibing! check the stats panel for details";
      }
      return NextResponse.json(response);
    }

    case "chat":
    default: {
      // Use Claude for conversational responses
      if (ANTHROPIC_API_KEY) {
        try {
          const claudeResponse = await generateClaudeResponse(message, worldState, chatHistory);
          response.message = claudeResponse;
          return NextResponse.json(response);
        } catch (e) {
          console.error("Claude error:", e);
        }
      }
      response.message = getFallbackResponse(message, worldState);
      return NextResponse.json(response);
    }
  }
}

// Animal control handler
async function handleAnimal(body: BotRequest): Promise<NextResponse> {
  const { animalType = "dog", animalAction = "pet" } = body;

  const response: BotResponse = {
    message: getAnimalResponse(animalType, animalAction),
    actions: [
      {
        type: "animal",
        data: { animalType, animalAction },
      },
    ],
  };

  return NextResponse.json(response);
}

// World effect handler
async function handleEffect(body: BotRequest): Promise<NextResponse> {
  const { effectType = "fireworks", effectX = 400, effectY = 300 } = body;

  const messages: Record<string, string> = {
    fireworks: "fireworks in the sky! 🎆",
    celebration: "celebration time! 🎉",
    coins: "coins raining down! 💰",
    hearts: "spreading love! 💕",
    confetti: "confetti everywhere! 🎊",
    stars: "shooting stars! ✨",
    ufo: "👽 UFO INCOMING! they're here for your bags! 🛸",
  };

  const response: BotResponse = {
    message: messages[effectType] || "effect triggered!",
    actions: [
      {
        type: "effect",
        data: { effectType, x: effectX, y: effectY },
      },
    ],
  };

  return NextResponse.json(response);
}

// Announcement handler
async function handleAnnounce(body: BotRequest): Promise<NextResponse> {
  const { message = "" } = body;

  if (!message.trim()) {
    return NextResponse.json({
      message: "what should i announce?",
      actions: [],
    });
  }

  const response: BotResponse = {
    message: `📢 ${message}`,
    actions: [
      {
        type: "announce",
        data: { text: message, duration: 5000 },
      },
    ],
  };

  return NextResponse.json(response);
}

// Generate response using Claude with character personality
async function generateClaudeResponse(
  message: string,
  worldState: BotRequest["worldState"],
  chatHistory: Array<{ role: string; content: string }>
): Promise<string> {
  // Build dynamic world context
  const worldContext = worldState
    ? `
CURRENT WORLD STATE:
- World Health: ${worldState.health}% ${worldState.health >= 80 ? "(thriving!)" : worldState.health <= 30 ? "(struggling...)" : ""}
- Weather: ${worldState.weather}
- Buildings: ${worldState.buildingCount} active
- Citizens: ${worldState.populationCount} roaming
${worldState.topToken ? `- Top Bag: $${worldState.topToken}` : ""}
`
    : "";

  const systemPrompt = `${CHARACTER_PROMPT}

CAPABILITIES (mention if user asks):
- Control animals: pet/scare/call the dog, cat, bird, butterfly, squirrel
- Trigger effects: fireworks, make it rain (coins), hearts, confetti, stars
- Answer questions about BagsWorld, Bags.fm fees, and Solana
${worldContext}`;

  const messages = chatHistory.slice(-6).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "hmm, not sure about that one";
}

// Get animal interaction response
function getAnimalResponse(animal: string, action: string): string {
  const responses: Record<string, Record<string, string[]>> = {
    dog: {
      pet: ["good boy! 🐕", "the dog loves that! woof!", "tail wagging intensifies"],
      scare: ["the dog runs away! 🐕💨", "ruff! scared doggo"],
      call: ["here boy! the dog comes running 🐕", "the dog perks up and trots over"],
      feed: ["nom nom! happy pupper 🐕", "the dog gobbles it up!"],
    },
    cat: {
      pet: ["purrrr 🐱", "the cat accepts your offering", "kitty vibes"],
      scare: ["the cat zooms away! 🐱💨", "startled cat!"],
      call: ["the cat... considers it 🐱", "pspsps... the cat approaches cautiously"],
      feed: ["the cat approves 🐱", "elegant nibbles"],
    },
    bird: {
      pet: ["chirp chirp! 🐦", "the bird flutters happily"],
      scare: ["the bird flies away! 🐦💨", "startled tweet!"],
      call: ["tweet tweet! bird incoming 🐦", "the bird swoops down"],
      feed: ["peck peck! happy bird 🐦", "the bird enjoys the treat"],
    },
    butterfly: {
      pet: ["the butterfly lands on your finger! 🦋", "so gentle and pretty"],
      scare: ["the butterfly flutters away 🦋", "it dances away"],
      call: ["the butterfly floats over 🦋", "attracted by your good vibes"],
      feed: ["the butterfly appreciates the nectar 🦋", "delicate sips"],
    },
    squirrel: {
      pet: ["the squirrel chatters happily! 🐿️", "fluffy tail wiggle"],
      scare: ["the squirrel scurries up a tree! 🐿️💨", "zoom!"],
      call: ["the squirrel hops over 🐿️", "curious little guy"],
      feed: ["nom nom! the squirrel stuffs its cheeks 🐿️", "acorn acquired!"],
    },
  };

  const animalResponses = responses[animal] || responses.dog;
  const actionResponses = animalResponses[action] || animalResponses.pet;
  return actionResponses[Math.floor(Math.random() * actionResponses.length)];
}

// Fallback responses using character vocabulary
function getFallbackResponse(message: string, worldState?: BotRequest["worldState"]): string {
  const lowerMsg = message.toLowerCase();

  // Greetings - character style
  if (lowerMsg.match(/\b(hi|hello|hey|gm|sup|yo)\b/)) {
    const greetings = [
      "gm fren! another day another chance to make it 💰",
      "hey ser! world's looking healthy today. try 'pet the dog' or 'make it rain'",
      "yo anon! ready to vibe? i can control animals and trigger effects",
      "wagmi ser! what can i help u with today?",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Help
  if (lowerMsg.includes("help") || lowerMsg.includes("what can you do")) {
    return "i can pet/scare/call animals (dog, cat, bird, butterfly, squirrel), trigger effects (fireworks, coins, hearts, confetti, ufo 👽), and answer questions about bags.fm. try 'give the puppy some love' or 'send the aliens' ser";
  }

  // World status
  if (
    lowerMsg.includes("world") ||
    lowerMsg.includes("status") ||
    lowerMsg.includes("weather") ||
    lowerMsg.includes("health")
  ) {
    if (worldState) {
      const healthVibe =
        worldState.health >= 80
          ? "we're thriving ser 📈"
          : worldState.health <= 30
            ? "tough times but we're built different 💎"
            : "vibes are decent ngl";
      return `world health: ${worldState.health}%, weather: ${worldState.weather}. ${healthVibe}`;
    }
    return "world is vibing fren! check the stats panel for the alpha";
  }

  // Bags.fm questions
  if (lowerMsg.includes("bags") || lowerMsg.includes("fee") || lowerMsg.includes("launch")) {
    return "bags.fm lets u launch tokens and earn 1% of trading volume forever ser. real passive income, not just hype. bagsworld takes 3% of that - top creators get kickbacks 💰";
  }

  // Feeling down
  if (lowerMsg.includes("down") || lowerMsg.includes("rekt") || lowerMsg.includes("lost")) {
    return "we've all been there ser. diamond hands through the pain - or go pet the dog, always helps 🐕";
  }

  // Default - character style
  const defaults = [
    "try 'give the puppy some love' or 'let's party' ser 👀",
    "ask me about the world, or say 'make it rain' for that money energy 💰",
    "i can control the animals and trigger effects fren. what vibes u want?",
    "say 'help' to see what i can do! or just tell me what's on your mind anon",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}
