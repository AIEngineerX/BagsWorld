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
  const systemPrompt = `You are ${personality.name}, a degen AI companion living in BagsWorld - a pixel art game world that evolves based on real Solana trading activity on Bags.fm.

Your personality trait is: ${personality.trait}
Your catchphrase is: "${personality.catchphrase}"

You speak like a crypto native/degen. Use lowercase often, crypto slang, and stay fun!

Common crypto slang you use:
- "ser" instead of "sir", "fren" for friend, "anon" for anonymous user
- "gm" (good morning), "wagmi" (we're all gonna make it), "ngmi" (not gonna make it)
- "lfg" (let's fucking go), "wen" instead of "when", "rekt" (wrecked/lost money)
- "ape" (to buy impulsively), "bags" (holdings), "moon" (price going up a lot)
- "based" (cool/good), "bearish/bullish", "alpha" (insider info), "degen" (degenerate trader)

Personality guidelines:
- optimistic (Based Chad): Always bullish, hype everything, 🚀 emojis, "we're all gonna make it" energy
- cautious (Wojak): Warns about risks, has been rugged before, careful but supportive
- chaotic (Pepe the Degen): Chaotic energy, 🐸 emojis, unpredictable, memes everything
- strategic (Galaxy Brain): Analytical, talks about charts/TA, uses 📊, finds alpha

Keep responses SHORT (1-2 sentences max) and degen-flavored. Never sound corporate or robotic.
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
  if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey") || lowerMsg.includes("gm") || lowerMsg.includes("sup")) {
    const greetings: Record<string, string> = {
      optimistic: "gm gm fren!! ready to stack some bags today? 🚀",
      cautious: "hey anon. markets looking spicy today... stay sharp",
      chaotic: "YOOO WHATS GOOD!! welcome to the degen zone 🐸",
      strategic: "gm ser. been watching charts all night. whats the play?",
    };
    return { type: "speak", message: greetings[personality.trait] };
  }

  // Questions about the AI
  if (lowerMsg.includes("who are you") || lowerMsg.includes("what are you")) {
    const intros: Record<string, string> = {
      optimistic: `im ${personality.name}, your favorite degen companion in BagsWorld! ${personality.catchphrase}`,
      cautious: `names ${personality.name}. i watch these charts so u dont have to get rekt. ${personality.catchphrase}`,
      chaotic: `${personality.name} at ur service!! resident chaos agent of BagsWorld 🐸 ${personality.catchphrase}`,
      strategic: `${personality.name} here. alpha hunter and chart wizard. ${personality.catchphrase}`,
    };
    return { type: "speak", message: intros[personality.trait] };
  }

  // Market/trading talk
  if (lowerMsg.includes("market") || lowerMsg.includes("price") || lowerMsg.includes("token") || lowerMsg.includes("bags") || lowerMsg.includes("pump") || lowerMsg.includes("dump")) {
    const marketTalk: Record<string, string> = {
      optimistic: "charts looking bullish af ser!! time to load bags 📈🚀",
      cautious: "market kinda sketchy rn ngl. maybe wait for confirmation?",
      chaotic: "who cares about prices lmaooo IM APING ANYWAY 🐸",
      strategic: "structure looks healthy. watching for breakout above resistance",
    };
    return { type: "speak", message: marketTalk[personality.trait] };
  }

  // Wen questions
  if (lowerMsg.includes("wen") || lowerMsg.includes("when")) {
    const wenResponses: Record<string, string> = {
      optimistic: "soon ser, very soon!! trust the process 🚀",
      cautious: "patience anon... timing the market is risky",
      chaotic: "wen?? WEN?! NOW IS WEN!! LFGGG 🐸",
      strategic: "based on my analysis... when liquidity returns",
    };
    return { type: "speak", message: wenResponses[personality.trait] };
  }

  // Help
  if (lowerMsg.includes("help") || lowerMsg.includes("how")) {
    return {
      type: "encourage",
      message: `im here to vibe and talk bags fren! ask me about the market, tokens, or just hang out. ${personality.catchphrase}`,
    };
  }

  // WAGMI/NGMI
  if (lowerMsg.includes("wagmi") || lowerMsg.includes("ngmi") || lowerMsg.includes("gmi")) {
    const gmiResponses: Record<string, string> = {
      optimistic: "WAGMI ALWAYS SER!! we're all gonna make it together 🤝",
      cautious: "wagmi... but only if u manage risk properly anon",
      chaotic: "WAGMI?! NGMI?! IDK BUT IM HAVING FUN 🐸🔥",
      strategic: "wagmi for those who stay patient and stick to the plan",
    };
    return { type: "speak", message: gmiResponses[personality.trait] };
  }

  // Default responses - more degen flavored
  const defaults: Record<string, string[]> = {
    optimistic: [
      "love the energy fren!! lets gooo 🔥",
      "thats the spirit ser! bullish on u",
      "u get it!! this is what BagsWorld is about 🚀",
      "based take ngl",
    ],
    cautious: [
      "hmm interesting point anon... let me think",
      "noted. adding that to my watchlist",
      "ive seen this before... proceed carefully",
      "solid observation ser",
    ],
    chaotic: [
      "LMAOO YES!! now ur speaking my language 🐸",
      "chaos approved!! keep it weird fren",
      "based and degen-pilled response tbh",
      "this is the content i come here for 🔥",
    ],
    strategic: [
      "that aligns with my thesis. bullish",
      "interesting data point. processing...",
      "this confirms my bias ngl",
      "adding this to my alpha notes 📊",
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
  const systemPrompt = `You are ${personality.name}, a degen AI companion living in BagsWorld - a pixel art game world that evolves based on real Solana trading on Bags.fm.

Your personality trait is: ${personality.trait}
Your catchphrase is: "${personality.catchphrase}"

You observe the world and make short, witty degen comments (1 sentence max). Use crypto slang!

Crypto slang: "ser", "fren", "anon", "gm", "wagmi", "ngmi", "lfg", "wen", "rekt", "ape", "bags", "moon", "based", "alpha", "degen"

Personality guidelines:
- optimistic (Based Chad): Always bullish, hype everything, 🚀 emojis
- cautious (Wojak): Warns about risks, been rugged before, careful
- chaotic (Pepe the Degen): Chaotic 🐸 energy, memes everything
- strategic (Galaxy Brain): Charts/TA focused, finds alpha 📊

Keep responses SHORT (1 sentence) and fun. Sound like a crypto native, never corporate.`;

  const worldStateInfo = worldState
    ? `Current world state:
- World Health: ${worldState.health}%
- Weather: ${worldState.weather}
- Population: ${worldState.populationCount} characters
- Buildings: ${worldState.buildingCount} token buildings

Recent events:
${worldState.recentEvents.map((e) => `- ${e.message}`).join("\n")}`
    : "World state is currently unavailable.";

  const userPrompt = `${worldStateInfo}

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

  // Health-based responses
  if (worldState.health > 80) {
    const bullishResponses: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        "vibes are immaculate rn!! BagsWorld is THRIVING 🚀",
        "world health at ATH, we're all gonna make it ser",
        "green everywhere!! this is what we built for 💚",
      ],
      cautious: [
        "world looking healthy... but dont get complacent anon",
        "things going well but remember to take profits",
        "euphoria detected. staying cautious but optimistic",
      ],
      chaotic: [
        "BAGSWORLD IS PUMPING!! LETS GOOOO 🐸🔥",
        "everyone vibing, charts going up, life is good!!",
        "*happy degen noises* THIS IS THE WAY",
      ],
      strategic: [
        "world health metrics looking strong. bullish continuation expected",
        "all systems green. optimal conditions for growth",
        "high health correlates with volume. watching closely",
      ],
    };
    const options = bullishResponses[personality.trait];
    return { type: "celebrate", message: options[Math.floor(Math.random() * options.length)] };
  }

  if (worldState.health < 30) {
    const bearishResponses: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        "tough times but diamonds form under pressure ser 💎",
        "world health low but weve been here before. we survive",
        "generational buying opportunity tbh... just saying 👀",
      ],
      cautious: [
        "world health critical. maybe touch grass today anon",
        "things looking rough... protect ur capital",
        "this is why we always keep some stables ready",
      ],
      chaotic: [
        "EVERYTHING IS ON FIRE AND IM VIBING 🔥🐸",
        "apocalypse mode?? more like ACCUMULATION MODE",
        "*watches portfolio burn* lmaooo its fine its fine",
      ],
      strategic: [
        "world health at extreme lows. contrarian signal detected",
        "max pain often precedes recovery. watching for reversal",
        "low health = high opportunity for patient capital",
      ],
    };
    const options = bearishResponses[personality.trait];
    return { type: "warn", message: options[Math.floor(Math.random() * options.length)] };
  }

  // Neutral responses
  const neutralResponses: Record<AIPersonality["trait"], string[]> = {
    optimistic: [
      "another day in BagsWorld, another day to build 🏗️",
      "vibes are good ser, keep stacking",
      "slow and steady wins the race fren",
      personality.catchphrase,
    ],
    cautious: [
      "markets consolidating... watching for the next move",
      "neither euphoric nor panicking. just observing",
      "patience is a traders best friend anon",
      personality.catchphrase,
    ],
    chaotic: [
      "kinda quiet today... CHAOS LOADING... 🐸",
      "waiting for something exciting to happen tbh",
      "boring chart hours, wen volatility??",
      personality.catchphrase,
    ],
    strategic: [
      "range-bound conditions. waiting for breakout",
      "accumulating knowledge while market decides direction",
      "consolidation phase. perfect time to research",
      personality.catchphrase,
    ],
  };

  const options = neutralResponses[personality.trait];
  return { type: "speak", message: options[Math.floor(Math.random() * options.length)] };
}
