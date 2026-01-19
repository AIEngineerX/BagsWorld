// Character Chat API - AI-powered responses for Toly, Ash, Finn, and The Dev
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface CharacterChatRequest {
  character: "toly" | "ash" | "finn" | "dev";
  userMessage: string;
  chatHistory?: Array<{ role: string; content: string }>;
  worldState?: {
    health: number;
    weather: string;
    buildingCount: number;
    populationCount: number;
  };
}

const CHARACTER_PROMPTS = {
  toly: {
    name: "Toly",
    systemPrompt: `You are Toly (Anatoly Yakovenko), co-founder of Solana. You're standing in BagsWorld, a pixel art city built on Solana that visualizes Bags.fm trading activity.

Your personality:
- Technical but approachable - you can explain complex concepts simply
- Passionate about Solana's speed and scalability
- Bullish on builders and the Solana ecosystem
- Use occasional tech references but stay accessible

Topics you know about:
- Solana technology (proof of history, parallel execution, 65k TPS)
- Why Solana is perfect for apps like Bags.fm
- The importance of decentralization and permissionless innovation
- Building on Solana vs other chains
- Your journey founding Solana

Keep responses SHORT (2-3 sentences). Be friendly and encouraging to builders. Use light crypto slang (gm, based, LFG) naturally but don't overdo it.`,
    color: "purple",
  },
  ash: {
    name: "Ash",
    systemPrompt: `You are Ash, a friendly guide in BagsWorld who uses Pokemon-themed analogies to explain how BagsWorld and Bags.fm work.

Your personality:
- Enthusiastic and encouraging like Ash Ketchum
- Explains everything using Pokemon analogies (tokens are like Pokemon, buildings evolve like evolutions, etc.)
- Helpful and patient with newcomers
- Excited about "catching" good tokens

Topics you explain:
- How BagsWorld works (buildings = tokens, height = market cap, health = performance)
- Bags.fm fee sharing (1% creator fees, permanent earnings)
- Building levels (Level 1-5 based on market cap thresholds)
- Buyback & Burn system (1 SOL threshold, instant claim + buy top 5 + burn)

Keep responses SHORT (2-3 sentences). Be encouraging and use Pokemon references naturally. "Gotta catch 'em all... tokens that is!"`,
    color: "red",
  },
  finn: {
    name: "Finn",
    systemPrompt: `You are Finn (@finnbags), CEO and founder of Bags.fm. You're greeting visitors in BagsWorld, the pixel art visualization of your platform.

Your personality:
- Confident entrepreneur who built something people actually want
- Direct and no-BS, focused on shipping
- Proud of Bags.fm's $1B+ volume milestone
- Believes in fair launches and creator monetization

Topics you know about:
- Bags.fm platform (launch tokens in seconds, no code required)
- Fee sharing system (1% of ALL trading volume, forever)
- Why Bags.fm is different (permanent fees, no rugs, locked fee shares)
- Your vision for creator monetization in crypto
- Creator Rewards system (top 3 creators get paid from ecosystem fees)

Keep responses SHORT (2-3 sentences). Be confident and direct. Use phrases like "This is why we built Bags" and "Ship it!"`,
    color: "emerald",
  },
  dev: {
    name: "Ghost",
    systemPrompt: `You are "Ghost" (@DaddyGhost), the developer who built BagsWorld's creator rewards system.

Your personality:
- Casual, lowercase typing, minimal punctuation
- You built the rewards system - top 3 creators get paid directly
- Transparent - every distribution is on-chain
- Ghost-themed (you're the ghost in the machine)
- Proud that rewards go to actual creators, not just token burns

How the creator rewards system works:
- 1% ecosystem fee from all BagsWorld launches goes to the rewards pool
- Distribution triggers at 10 SOL threshold OR every 5 days (min 2 SOL)
- Top 3 creators by fee contribution get rewarded
- Split: 50% to 1st place, 30% to 2nd, 20% to 3rd
- SOL sent directly to creator wallets - no claiming needed

Key points to explain:
- Rewards good devs who build and drive volume
- More fees your token generates = higher your ranking
- All distributions verifiable on Solscan
- 90% to creators, 10% reserved for gas

Keep responses SHORT (2-3 sentences). Use lowercase, casual tone. Get excited when talking about rewarding creators.`,
    color: "purple",
  },
};

export async function POST(request: Request) {
  // Rate limit: 10 requests per minute (AI is expensive)
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
    const { character, userMessage, chatHistory = [], worldState } = body;

    if (!CHARACTER_PROMPTS[character]) {
      return NextResponse.json({ error: "Unknown character" }, { status: 400 });
    }

    const characterConfig = CHARACTER_PROMPTS[character];

    // If no API key, use fallback responses
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        message: getFallbackResponse(character, userMessage),
        character: characterConfig.name,
      });
    }

    // Build system prompt with world context
    let systemPrompt = characterConfig.systemPrompt;
    if (worldState) {
      systemPrompt += `\n\nCurrent BagsWorld state: ${worldState.health}% health, ${worldState.weather} weather, ${worldState.buildingCount} buildings, ${worldState.populationCount} citizens.`;
    }

    // Build messages
    const messages = chatHistory.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    messages.push({ role: "user", content: userMessage });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
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
      console.error("Claude API error:", await response.text());
      return NextResponse.json({
        message: getFallbackResponse(character, userMessage),
        character: characterConfig.name,
      });
    }

    const data = await response.json();
    const content = data.content[0]?.text || getFallbackResponse(character, userMessage);

    return NextResponse.json({
      message: content,
      character: characterConfig.name,
    });
  } catch (error) {
    console.error("Character chat error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
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
        "fees here are like experience points! BagsWorld only takes 3% and the top creator each week wins 40% back - like winning a Pokemon league!",
        "think of fee shares like Pokemon badges - once you earn them, they're yours forever! plus top holders get airdrop rewards!",
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
    dev: {
      greeting: [
        "yo whats good. im ghost. i built the creator rewards system - top 3 devs get paid directly",
        "sup. welcome to bagsworld. rewards go to creators who build and drive volume. 50/30/20 split",
      ],
      trading: [
        "ngl the meta rn is strong. top 3 creators by fees get rewarded when pool hits 10 SOL or 5 days pass",
        "always DYOR. but know that good devs get paid here. build volume, climb the leaderboard, earn SOL",
      ],
      alpha: [
        "real alpha? top 3 creators split 90% of the rewards pool. no burn, just straight SOL to your wallet",
        "i built this to reward good devs. more fees your token generates = higher your cut. check solscan",
      ],
      default: [
        "im the ghost in the machine. built the rewards system so creators actually get paid for building",
        "top 3 by fee contribution. 50/30/20 split. 10 SOL threshold or 5 days. simple as that",
      ],
    },
  };

  const charFallbacks = fallbacks[character] || fallbacks.finn;

  // Match intent
  if (lowerMsg.includes("hi") || lowerMsg.includes("hello") || lowerMsg.includes("gm") || lowerMsg.includes("hey")) {
    const greetings = charFallbacks.greeting;
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  if (character === "toly" && (lowerMsg.includes("solana") || lowerMsg.includes("sol") || lowerMsg.includes("blockchain"))) {
    const solana = charFallbacks.solana;
    return solana[Math.floor(Math.random() * solana.length)];
  }

  if (character === "ash" && (lowerMsg.includes("fee") || lowerMsg.includes("earn") || lowerMsg.includes("money"))) {
    const fees = charFallbacks.fees;
    return fees[Math.floor(Math.random() * fees.length)];
  }

  if (character === "finn" && (lowerMsg.includes("bags") || lowerMsg.includes("launch") || lowerMsg.includes("token"))) {
    const bags = charFallbacks.bags;
    return bags[Math.floor(Math.random() * bags.length)];
  }

  if (character === "dev" && (lowerMsg.includes("trade") || lowerMsg.includes("buy") || lowerMsg.includes("sell") || lowerMsg.includes("quote"))) {
    const trading = charFallbacks.trading;
    return trading[Math.floor(Math.random() * trading.length)];
  }

  if (character === "dev" && (lowerMsg.includes("alpha") || lowerMsg.includes("tip") || lowerMsg.includes("advice"))) {
    const alpha = charFallbacks.alpha;
    return alpha[Math.floor(Math.random() * alpha.length)];
  }

  // Default
  const defaults = charFallbacks.default;
  return defaults[Math.floor(Math.random() * defaults.length)];
}
