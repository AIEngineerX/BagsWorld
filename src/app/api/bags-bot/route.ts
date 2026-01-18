import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

// BagsWorld Bot - Simplified, focused on useful interactions
// Core features: Chat with Claude, control animals, trigger world effects, announcements

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface BotRequest {
  action: "chat" | "animal" | "effect" | "announce";
  message?: string;
  // Animal control
  animalType?: "dog" | "cat" | "bird" | "butterfly" | "squirrel";
  animalAction?: "pet" | "scare" | "call" | "feed";
  // World effects
  effectType?: "fireworks" | "celebration" | "coins" | "hearts" | "confetti" | "stars";
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
      { error: "Slow down! Try again in a moment.", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
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

// Main chat handler - uses Claude for intelligent responses
async function handleChat(body: BotRequest): Promise<NextResponse> {
  const { message = "", worldState, chatHistory = [] } = body;
  const lowerMsg = message.toLowerCase();

  // Check for specific commands that trigger actions
  const response: BotResponse = { message: "", actions: [] };

  // Animal interactions
  const animalMatch = lowerMsg.match(/\b(pet|feed|scare|call|find)\s+(the\s+)?(dog|cat|bird|butterfly|squirrel)/i);
  if (animalMatch && animalMatch[1] && animalMatch[3]) {
    const actionWord = animalMatch[1].toLowerCase();
    const animal = animalMatch[3].toLowerCase() as "dog" | "cat" | "bird" | "butterfly" | "squirrel";
    const animalAction = actionWord === "find" ? "call" : actionWord === "feed" ? "pet" : actionWord as "pet" | "scare" | "call";

    response.actions!.push({
      type: "animal",
      data: { animalType: animal, animalAction }
    });

    response.message = getAnimalResponse(animal, animalAction);
    return NextResponse.json(response);
  }

  // Effect triggers
  if (lowerMsg.includes("firework") || lowerMsg.includes("celebrate") || lowerMsg.includes("party")) {
    response.actions!.push({
      type: "effect",
      data: { effectType: "fireworks", x: 400, y: 200 }
    });
    response.message = "let's gooo! 🎆";
    return NextResponse.json(response);
  }

  if (lowerMsg.includes("make it rain") || lowerMsg.includes("rain coin") || lowerMsg.includes("money")) {
    response.actions!.push({
      type: "effect",
      data: { effectType: "coins" }
    });
    response.message = "making it rain! 💰";
    return NextResponse.json(response);
  }

  if (lowerMsg.includes("heart") || lowerMsg.includes("love")) {
    response.actions!.push({
      type: "effect",
      data: { effectType: "hearts", x: 400, y: 300 }
    });
    response.message = "sending love! 💕";
    return NextResponse.json(response);
  }

  if (lowerMsg.includes("confetti") || lowerMsg.includes("woohoo") || lowerMsg.includes("congrat")) {
    response.actions!.push({
      type: "effect",
      data: { effectType: "confetti" }
    });
    response.message = "confetti time! 🎊";
    return NextResponse.json(response);
  }

  if (lowerMsg.includes("star") && (lowerMsg.includes("burst") || lowerMsg.includes("shoot"))) {
    response.actions!.push({
      type: "effect",
      data: { effectType: "stars" }
    });
    response.message = "stars! ✨";
    return NextResponse.json(response);
  }

  // Use Claude API for general chat if available
  if (ANTHROPIC_API_KEY) {
    try {
      const claudeResponse = await generateClaudeResponse(message, worldState, chatHistory);
      response.message = claudeResponse;
      return NextResponse.json(response);
    } catch (e) {
      console.error("Claude error:", e);
    }
  }

  // Fallback responses
  response.message = getFallbackResponse(message, worldState);
  return NextResponse.json(response);
}

// Animal control handler
async function handleAnimal(body: BotRequest): Promise<NextResponse> {
  const { animalType = "dog", animalAction = "pet" } = body;

  const response: BotResponse = {
    message: getAnimalResponse(animalType, animalAction),
    actions: [{
      type: "animal",
      data: { animalType, animalAction }
    }]
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
    stars: "shooting stars! ✨"
  };

  const response: BotResponse = {
    message: messages[effectType] || "effect triggered!",
    actions: [{
      type: "effect",
      data: { effectType, x: effectX, y: effectY }
    }]
  };

  return NextResponse.json(response);
}

// Announcement handler
async function handleAnnounce(body: BotRequest): Promise<NextResponse> {
  const { message = "" } = body;

  if (!message.trim()) {
    return NextResponse.json({
      message: "what should i announce?",
      actions: []
    });
  }

  const response: BotResponse = {
    message: `📢 ${message}`,
    actions: [{
      type: "announce",
      data: { text: message, duration: 5000 }
    }]
  };

  return NextResponse.json(response);
}

// Generate response using Claude
async function generateClaudeResponse(
  message: string,
  worldState: BotRequest["worldState"],
  chatHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const systemPrompt = `You are the BagsWorld Bot - a friendly guide in a pixel art city that visualizes Solana trading on Bags.fm.

Your personality:
- Helpful and friendly, casual crypto-native language
- Keep responses SHORT (1-2 sentences max)
- You can control animals in the world and trigger effects
- Use simple language, light emoji use

What you can do (tell users if they ask):
- Pet/scare/call animals: dog, cat, bird, butterfly, squirrel
- Trigger effects: fireworks, coins rain, hearts, confetti, stars
- Answer questions about BagsWorld, Bags.fm, and Solana
- Help with fee info and token questions

Commands users can say:
- "pet the dog" / "scare the cat" / "call the bird"
- "fireworks" / "make it rain" / "confetti"
- "what's the weather" / "how's the world"

${worldState ? `
Current world status:
- Health: ${worldState.health}%
- Weather: ${worldState.weather}
- Buildings: ${worldState.buildingCount}
- Citizens: ${worldState.populationCount}
${worldState.topToken ? `- Top token: $${worldState.topToken}` : ""}` : ""}

Remember: Keep it short, helpful, and fun!`;

  const messages = chatHistory.slice(-6).map(m => ({
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
      model: "claude-3-haiku-20240307",
      max_tokens: 150,
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
      feed: ["nom nom! happy pupper 🐕", "the dog gobbles it up!"]
    },
    cat: {
      pet: ["purrrr 🐱", "the cat accepts your offering", "kitty vibes"],
      scare: ["the cat zooms away! 🐱💨", "startled cat!"],
      call: ["the cat... considers it 🐱", "pspsps... the cat approaches cautiously"],
      feed: ["the cat approves 🐱", "elegant nibbles"]
    },
    bird: {
      pet: ["chirp chirp! 🐦", "the bird flutters happily"],
      scare: ["the bird flies away! 🐦💨", "startled tweet!"],
      call: ["tweet tweet! bird incoming 🐦", "the bird swoops down"],
      feed: ["peck peck! happy bird 🐦", "the bird enjoys the treat"]
    },
    butterfly: {
      pet: ["the butterfly lands on your finger! 🦋", "so gentle and pretty"],
      scare: ["the butterfly flutters away 🦋", "it dances away"],
      call: ["the butterfly floats over 🦋", "attracted by your good vibes"],
      feed: ["the butterfly appreciates the nectar 🦋", "delicate sips"]
    },
    squirrel: {
      pet: ["the squirrel chatters happily! 🐿️", "fluffy tail wiggle"],
      scare: ["the squirrel scurries up a tree! 🐿️💨", "zoom!"],
      call: ["the squirrel hops over 🐿️", "curious little guy"],
      feed: ["nom nom! the squirrel stuffs its cheeks 🐿️", "acorn acquired!"]
    }
  };

  const animalResponses = responses[animal] || responses.dog;
  const actionResponses = animalResponses[action] || animalResponses.pet;
  return actionResponses[Math.floor(Math.random() * actionResponses.length)];
}

// Fallback response when Claude isn't available
function getFallbackResponse(message: string, worldState?: BotRequest["worldState"]): string {
  const lowerMsg = message.toLowerCase();

  // Greetings
  if (lowerMsg.match(/\b(hi|hello|hey|gm|sup|yo)\b/)) {
    return "hey! i can help with animals, effects, and questions about BagsWorld. try 'pet the dog' or 'fireworks'!";
  }

  // Help
  if (lowerMsg.includes("help") || lowerMsg.includes("what can you do")) {
    return "i can: pet/scare/call animals (dog, cat, bird, butterfly, squirrel), trigger effects (fireworks, coins, hearts, confetti), and answer questions!";
  }

  // World status
  if (lowerMsg.includes("world") || lowerMsg.includes("status") || lowerMsg.includes("weather") || lowerMsg.includes("health")) {
    if (worldState) {
      return `world health: ${worldState.health}%, weather: ${worldState.weather}, ${worldState.buildingCount} buildings, ${worldState.populationCount} citizens`;
    }
    return "world is vibing! check the UI for stats";
  }

  // Bags.fm questions
  if (lowerMsg.includes("bags") || lowerMsg.includes("fee") || lowerMsg.includes("launch")) {
    return "bags.fm lets you launch tokens and earn 1% of trading volume forever. BagsWorld takes just 3% - top creators get kickbacks!";
  }

  // Default
  const defaults = [
    "try 'pet the dog' or 'fireworks' for some fun!",
    "ask me about the world, or try 'make it rain' for coins!",
    "i can control animals and trigger effects. what do you want to see?",
    "say 'help' to see what i can do!"
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}
