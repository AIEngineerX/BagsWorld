// Character Chat API - Proxies to eliza-agents server for AI-powered responses
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

const AGENTS_API_URL = process.env.AGENTS_API_URL || "http://localhost:3001";

type CharacterId =
  | "toly"
  | "finn"
  | "ash"
  | "ghost"
  | "neo"
  | "cj"
  | "shaw"
  | "bags-bot"
  | "bagsbot"
  | "dev";

interface CharacterChatRequest {
  character: CharacterId;
  userMessage: string;
  conversationId?: string;
  chatHistory?: Array<{ role: string; content: string }>;
  worldState?: {
    health: number;
    weather: string;
    buildingCount: number;
    populationCount: number;
  };
}

const CHARACTER_DISPLAY_NAMES: Record<string, string> = {
  toly: "Toly",
  finn: "Finn",
  ash: "Ash",
  ghost: "Ghost",
  neo: "Neo",
  cj: "CJ",
  shaw: "Shaw",
  "bags-bot": "Bags Bot",
  bagsbot: "Bags Bot",
  dev: "Ghost",
};

export async function POST(request: Request) {
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`chat:${clientIP}`, RATE_LIMITS.ai);

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please wait before chatting again.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const body: CharacterChatRequest = await request.json();
    const { character, userMessage, conversationId, chatHistory = [], worldState } = body;

    const displayName = CHARACTER_DISPLAY_NAMES[character];
    if (!displayName) {
      return NextResponse.json({ error: "Unknown character" }, { status: 400 });
    }

    // Try the eliza-agents server first
    try {
      const agentResponse = await fetch(`${AGENTS_API_URL}/api/agents/${character}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          sessionId: conversationId, // eliza-agents uses sessionId
        }),
      });

      if (agentResponse.ok) {
        const data = await agentResponse.json();
        return NextResponse.json({
          message: data.response,
          character: displayName,
          conversationId: data.sessionId, // map sessionId back to conversationId
        });
      }

      console.warn(`[Chat] Agents server returned ${agentResponse.status}, using fallback`);
    } catch (agentError) {
      console.warn("[Chat] Agents server unavailable, using fallback:", agentError);
    }

    // Fallback to local responses when agents server is unavailable
    return NextResponse.json({
      message: getFallbackResponse(character, userMessage),
      character: displayName,
      debug: "fallback",
    });
  } catch (error) {
    console.error("Character chat error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}

function getFallbackResponse(character: string, userMessage: string): string {
  const lowerMsg = userMessage.toLowerCase();

  const fallbacks: Record<string, Record<string, string[]>> = {
    toly: {
      greeting: [
        "gm! welcome to BagsWorld. built on Solana for speed. what can i help with?",
        "hey! this pixel city runs at 65k TPS thanks to Solana. pretty based right?",
      ],
      solana: [
        "Solana was built for apps exactly like this - fast, cheap, scalable. proof of history makes it possible.",
        "we designed Solana so builders could create without limits. Bags.fm is proof it works.",
      ],
      default: [
        "great question. what specifically about Solana or BagsWorld can i explain?",
        "always happy to talk tech. ask me about Solana, building, or the ecosystem!",
      ],
    },
    ash: {
      greeting: [
        "hey trainer! welcome to BagsWorld! each building here is like a Pokemon - it evolves as it grows!",
        "gotta catch em all... tokens that is! let me show you around BagsWorld!",
      ],
      fees: [
        "fees here are like experience points! creators earn 1% of all volume forever - like winning a Pokemon league!",
        "think of fee shares like Pokemon badges - once you earn them, they're yours forever!",
      ],
      default: [
        "this world is full of opportunities trainer! what do you want to know about?",
        "every building here represents a real token. the taller ones have higher market cap - like evolved Pokemon!",
      ],
    },
    finn: {
      greeting: [
        "welcome to BagsWorld. this is what $1B+ in volume looks like. what can i help with?",
        "yo! im Finn, built Bags.fm. every building here is a real token earning real fees. LFG.",
      ],
      bags: [
        "Bags.fm is simple: launch a token, earn 1% of all volume forever. no rugs, locked fee shares. this is the way.",
        "we built this so creators actually get paid. $1B volume in under 30 days. the numbers speak.",
      ],
      default: [
        "this is why we built Bags. what questions you got?",
        "ship fast, earn forever. that's the Bags way. what do you need?",
      ],
    },
    ghost: {
      greeting: [
        "yo whats good. im ghost. i built the creator rewards system - top 3 devs get paid directly",
        "sup. welcome to bagsworld. rewards go to creators who build and drive volume. 50/30/20 split",
      ],
      trading: [
        "ngl the meta rn is strong. top 3 creators by fees get rewarded when pool hits threshold",
        "always DYOR. but know that good devs get paid here. build volume, climb the leaderboard, earn SOL",
      ],
      default: [
        "im the ghost in the machine. built the rewards system so creators actually get paid for building",
        "top 3 by fee contribution. 50/30/20 split. simple as that",
      ],
    },
    neo: {
      greeting: [
        "scanning... new user detected. welcome to BagsWorld. i track all launches in real-time.",
        "yo. im Neo, the scout. i watch everything happening on Bags.fm. what do you need?",
      ],
      default: [
        "im always watching the feeds. ask me about recent launches or trending tokens.",
        "my sensors pick up everything. new launches, volume spikes, whale moves. what interests you?",
      ],
    },
    cj: {
      greeting: [
        "aw man, here we go again! welcome to BagsWorld homie!",
        "yo what up! CJ here. this neighborhood runs on Solana, you feel me?",
      ],
      default: [
        "all you had to do was follow the damn chain, CJ! nah im playing. what you need?",
        "grove street... i mean BagsWorld, home. at least it was before the fees started flowing.",
      ],
    },
    shaw: {
      greeting: [
        "welcome. im Shaw, architect of autonomous systems. elizaOS powers the agents here.",
        "greetings. this world runs on multi-agent coordination. fascinating, isnt it?",
      ],
      default: [
        "agents are the future of onchain interaction. what would you like to understand?",
        "elizaOS enables characters like us to operate autonomously. ask me anything about the architecture.",
      ],
    },
    "bags-bot": {
      greeting: [
        "BAGS BOT ONLINE. ready to assist with all things Bags.fm!",
        "beep boop. welcome to BagsWorld! how can this bot help you today?",
      ],
      default: [
        "processing query... i can help with token lookups, fee calculations, and platform info!",
        "BAGS BOT at your service! ask about launches, fees, or how the platform works.",
      ],
    },
  };

  // Normalize character ID
  const charKey = character === "bagsbot" ? "bags-bot" : character === "dev" ? "ghost" : character;
  const charFallbacks = fallbacks[charKey] || fallbacks.finn;

  // Match intent
  if (
    lowerMsg.includes("hi") ||
    lowerMsg.includes("hello") ||
    lowerMsg.includes("gm") ||
    lowerMsg.includes("hey")
  ) {
    const greetings = charFallbacks.greeting;
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  if (
    charKey === "toly" &&
    (lowerMsg.includes("solana") || lowerMsg.includes("sol") || lowerMsg.includes("blockchain"))
  ) {
    const solana = charFallbacks.solana;
    if (solana) return solana[Math.floor(Math.random() * solana.length)];
  }

  if (
    charKey === "ash" &&
    (lowerMsg.includes("fee") || lowerMsg.includes("earn") || lowerMsg.includes("money"))
  ) {
    const fees = charFallbacks.fees;
    if (fees) return fees[Math.floor(Math.random() * fees.length)];
  }

  if (
    charKey === "finn" &&
    (lowerMsg.includes("bags") || lowerMsg.includes("launch") || lowerMsg.includes("token"))
  ) {
    const bags = charFallbacks.bags;
    if (bags) return bags[Math.floor(Math.random() * bags.length)];
  }

  if (
    charKey === "ghost" &&
    (lowerMsg.includes("trade") || lowerMsg.includes("buy") || lowerMsg.includes("sell"))
  ) {
    const trading = charFallbacks.trading;
    if (trading) return trading[Math.floor(Math.random() * trading.length)];
  }

  // Default
  const defaults = charFallbacks.default;
  return defaults[Math.floor(Math.random() * defaults.length)];
}
