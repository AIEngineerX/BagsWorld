// API Route: Agent Chat - Routes through local eliza-agents or Railway ElizaOS
// Provides memory persistence, character files, and multi-agent coordination

import { NextRequest, NextResponse } from "next/server";

// Local agents server (eliza-agents in this repo)
const LOCAL_AGENTS_URL = process.env.AGENTS_API_URL || "http://localhost:3001";

// Railway ElizaOS server (fallback)
const ELIZAOS_SERVER =
  process.env.ELIZAOS_SERVER_URL || "https://bagsworld-production.up.railway.app";

// Valid agent IDs that match Railway character files
const VALID_AGENTS = [
  "neo",
  "cj",
  "finn",
  "bags-bot",
  "toly",
  "ash",
  "shaw",
  "ghost",
  // Academy characters
  "ramo",
  "sincara",
  "stuu",
  "sam",
  "alaa",
  "carlo",
  "bnn",
  "professor-oak",
];

interface ChatRequest {
  character: string;
  message: string;
  userId?: string;
  roomId?: string;
  worldState?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { character, message, userId, roomId, worldState } = body;

    if (!character || !message) {
      return NextResponse.json(
        { error: "Missing required fields: character and message" },
        { status: 400 }
      );
    }

    // Normalize character name (dev -> ghost)
    const agentId = character.toLowerCase() === "dev" ? "ghost" : character.toLowerCase();

    // Validate agent
    if (!VALID_AGENTS.includes(agentId)) {
      return NextResponse.json(
        { error: `Invalid agent: ${character}. Valid agents: ${VALID_AGENTS.join(", ")}` },
        { status: 400 }
      );
    }

    // bags-bot uses Claude directly (not ElizaOS)
    if (agentId === "bags-bot") {
      return handleCharacterFallback(agentId, message, worldState);
    }

    // All other agents route through ElizaOS runtime
    return handleElizaOS(agentId, message, userId, roomId, worldState);
  } catch (error) {
    console.error("[agent-chat] Error:", error);
    return NextResponse.json({ error: "Agent communication failed" }, { status: 500 });
  }
}

// Format character name nicely
const characterNames: Record<string, string> = {
  neo: "Neo",
  cj: "CJ",
  finn: "Finn",
  "bags-bot": "Bags Bot",
  toly: "Toly",
  ash: "Ash",
  shaw: "Shaw",
  ghost: "Ghost",
  // Academy characters
  ramo: "Ramo",
  sincara: "Sincara",
  stuu: "Stuu",
  sam: "Sam",
  alaa: "Alaa",
  carlo: "Carlo",
  bnn: "BNN",
  "professor-oak": "Professor Oak",
};

// Try local agents server first, then Railway, then fallback
async function handleElizaOS(
  agentId: string,
  message: string,
  userId?: string,
  roomId?: string,
  worldState?: any
): Promise<NextResponse> {
  const sessionId = `${agentId}-${userId || "anonymous"}-${Date.now()}`;

  // Try local eliza-agents first (if running)
  try {
    const localEndpoint = `${LOCAL_AGENTS_URL}/api/agents/${agentId}/chat`;
    console.log(`[Agents] Trying local: ${localEndpoint}`);

    const localResponse = await fetch(localEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
      signal: AbortSignal.timeout(5000),
    });

    if (localResponse.ok) {
      const data = await localResponse.json();
      return NextResponse.json({
        character: data.agentName || characterNames[agentId] || agentId,
        response: data.response,
        source: "local-agents",
        agentId: data.agentId || agentId,
      });
    }
  } catch {
    console.log(`[Agents] Local unavailable, trying Railway...`);
  }

  // Try Railway ElizaOS server
  try {
    const endpoint = `${ELIZAOS_SERVER}/api/agents/${agentId}/chat`;
    console.log(`[ElizaOS] Calling ${agentId} at ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        sessionId,
        conversationHistory: [],
        worldState,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`ElizaOS returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      character: data.agentName || characterNames[agentId] || agentId,
      response: data.response,
      source: "elizaos-runtime",
      agentId: data.agentId || agentId,
      suggestedAgent: data.suggestedAgent,
    });
  } catch (error: any) {
    console.warn(`[ElizaOS] ${agentId} unavailable, using fallback:`, error.message);
    return handleCharacterFallback(agentId, message, worldState);
  }
}

// Parse bags-bot commands and return actions
function parseBotCommands(message: string): Array<{ type: string; data: Record<string, unknown> }> {
  const lowerMessage = message.toLowerCase().trim();
  const actions: Array<{ type: string; data: Record<string, unknown> }> = [];

  // Animal commands - only match one action per animal
  // Support aliases: puppy=dog, kitty=cat
  // Support phrases: "pet the dog", "give the puppy some love", "scare the cat"
  const animalCommands: Array<{ pattern: RegExp; animal: string; action: string }> = [
    // Dog/Puppy commands
    {
      pattern: /(?:pet|pat|love|cuddle)\s+(?:the\s+)?(?:dog|puppy)/i,
      animal: "dog",
      action: "pet",
    },
    {
      pattern: /(?:give|show)\s+(?:the\s+)?(?:dog|puppy)\s+(?:some\s+)?love/i,
      animal: "dog",
      action: "pet",
    },
    {
      pattern: /(?:call|summon|find|where(?:'s)?)\s+(?:the\s+)?(?:dog|puppy)/i,
      animal: "dog",
      action: "call",
    },
    {
      pattern: /(?:scare|spook|chase)\s+(?:the\s+)?(?:dog|puppy)/i,
      animal: "dog",
      action: "scare",
    },
    { pattern: /(?:feed)\s+(?:the\s+)?(?:dog|puppy)/i, animal: "dog", action: "feed" },
    // Cat/Kitty commands
    {
      pattern: /(?:pet|pat|love|cuddle)\s+(?:the\s+)?(?:cat|kitty)/i,
      animal: "cat",
      action: "pet",
    },
    {
      pattern: /(?:give|show)\s+(?:the\s+)?(?:cat|kitty)\s+(?:some\s+)?love/i,
      animal: "cat",
      action: "pet",
    },
    {
      pattern: /(?:call|summon|find|where(?:'s)?)\s+(?:the\s+)?(?:cat|kitty)/i,
      animal: "cat",
      action: "call",
    },
    {
      pattern: /(?:scare|spook|chase)\s+(?:the\s+)?(?:cat|kitty)/i,
      animal: "cat",
      action: "scare",
    },
    { pattern: /(?:feed)\s+(?:the\s+)?(?:cat|kitty)/i, animal: "cat", action: "feed" },
    // Bird commands
    { pattern: /(?:pet|pat)\s+(?:the\s+)?bird/i, animal: "bird", action: "pet" },
    { pattern: /(?:call|summon|find)\s+(?:the\s+)?bird/i, animal: "bird", action: "call" },
    { pattern: /(?:scare|spook|shoo)\s+(?:the\s+)?bird/i, animal: "bird", action: "scare" },
    { pattern: /(?:feed)\s+(?:the\s+)?bird/i, animal: "bird", action: "feed" },
    // Butterfly commands
    { pattern: /(?:pet|touch)\s+(?:the\s+)?butterfly/i, animal: "butterfly", action: "pet" },
    {
      pattern: /(?:call|summon|find)\s+(?:the\s+)?butterfly/i,
      animal: "butterfly",
      action: "call",
    },
    {
      pattern: /(?:scare|spook|shoo)\s+(?:the\s+)?butterfly/i,
      animal: "butterfly",
      action: "scare",
    },
    // Squirrel commands
    { pattern: /(?:pet|pat)\s+(?:the\s+)?squirrel/i, animal: "squirrel", action: "pet" },
    { pattern: /(?:call|summon|find)\s+(?:the\s+)?squirrel/i, animal: "squirrel", action: "call" },
    {
      pattern: /(?:scare|spook|chase)\s+(?:the\s+)?squirrel/i,
      animal: "squirrel",
      action: "scare",
    },
    { pattern: /(?:feed)\s+(?:the\s+)?squirrel/i, animal: "squirrel", action: "feed" },
  ];

  // Only add one action per animal type
  const matchedAnimals = new Set<string>();
  for (const { pattern, animal, action } of animalCommands) {
    if (pattern.test(lowerMessage) && !matchedAnimals.has(animal)) {
      // WorldScene expects animalType and animalAction
      actions.push({ type: "animal", data: { animalType: animal, animalAction: action } });
      matchedAnimals.add(animal);
    }
  }

  // Effect commands - must match WorldScene.handleBotEffect cases
  // Use word boundaries to avoid false positives (e.g., "brain" shouldn't match "rain")
  const effectPatterns = [
    { pattern: /\bfireworks?\b/i, effect: "fireworks" },
    { pattern: /\bconfetti\b/i, effect: "confetti" },
    { pattern: /\bcoins?\b|\bmoney\b|make\s+it\s+rain/i, effect: "coins" },
    { pattern: /\bstars?\b|\bsparkles?\b/i, effect: "stars" },
    { pattern: /\bhearts?\b/i, effect: "hearts" }, // Don't match "love" - conflicts with animal petting
    { pattern: /\bufo\b|\baliens?\b|\bspaceship\b/i, effect: "ufo" },
    { pattern: /\bcelebrat\w*\b|\bparty\b/i, effect: "celebration" },
  ];

  for (const { pattern, effect } of effectPatterns) {
    if (pattern.test(lowerMessage)) {
      // WorldScene expects effectType
      actions.push({ type: "effect", data: { effectType: effect } });
    }
  }

  // Pokemon commands (Founders zone) - play with starter Pokemon
  const pokemonCommands: Array<{ pattern: RegExp; pokemon: string; action: string }> = [
    // Charmander
    {
      pattern: /(?:pet|play\s+with|pat)\s+(?:the\s+)?charmander/i,
      pokemon: "charmander",
      action: "play",
    },
    { pattern: /(?:call|find)\s+(?:the\s+)?charmander/i, pokemon: "charmander", action: "call" },
    // Squirtle
    {
      pattern: /(?:pet|play\s+with|pat)\s+(?:the\s+)?squirtle/i,
      pokemon: "squirtle",
      action: "play",
    },
    { pattern: /(?:call|find)\s+(?:the\s+)?squirtle/i, pokemon: "squirtle", action: "call" },
    // Bulbasaur
    {
      pattern: /(?:pet|play\s+with|pat)\s+(?:the\s+)?bulbasaur/i,
      pokemon: "bulbasaur",
      action: "play",
    },
    { pattern: /(?:call|find)\s+(?:the\s+)?bulbasaur/i, pokemon: "bulbasaur", action: "call" },
    // Generic "play with pokemon" - defaults to charmander
    {
      pattern: /play\s+(?:with\s+)?(?:the\s+)?(?:a\s+)?pokemon/i,
      pokemon: "charmander",
      action: "play",
    },
  ];

  const matchedPokemon = new Set<string>();
  for (const { pattern, pokemon, action } of pokemonCommands) {
    if (pattern.test(lowerMessage) && !matchedPokemon.has(pokemon)) {
      actions.push({ type: "pokemon", data: { pokemonType: pokemon, pokemonAction: action } });
      matchedPokemon.add(pokemon);
    }
  }

  return actions;
}

// Fallback for when ElizaOS server is not running - uses Claude API
async function handleCharacterFallback(
  agentId: string,
  message: string,
  worldState?: any
): Promise<NextResponse> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  // Use shared characterNames (defined at module level)
  const characterName = characterNames[agentId] || agentId;

  // For bags-bot, parse commands first
  const actions = agentId === "bags-bot" ? parseBotCommands(message) : [];

  if (!ANTHROPIC_API_KEY) {
    let responseText = getFallbackResponse(agentId, message);
    if (actions.length > 0) {
      const actionDescriptions = actions
        .map((a) => {
          if (a.type === "animal") return `${a.data.animalAction}ing the ${a.data.animalType}`;
          if (a.type === "effect") return `triggering ${a.data.effectType}`;
          return "";
        })
        .filter(Boolean);
      responseText = `done! ${actionDescriptions.join(" and ")}! `;
    }

    return NextResponse.json({
      character: characterName,
      response: responseText,
      source: "fallback-rule-based",
      actions,
    });
  }

  try {
    const systemPrompt = getCharacterSystemPrompt(agentId);
    const contextPrompt = worldState
      ? `\n\nCURRENT WORLD STATE:\nHealth: ${worldState.health}%\nWeather: ${worldState.weather}\n`
      : "";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: systemPrompt + contextPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      throw new Error("Anthropic API error");
    }

    const data = await response.json();
    let responseText = data.content?.[0]?.text || getFallbackResponse(agentId, message);

    if (actions.length > 0) {
      const actionDescriptions = actions
        .map((a) => {
          if (a.type === "animal") return `${a.data.animalAction}ing the ${a.data.animalType}`;
          if (a.type === "effect") return `triggering ${a.data.effectType}`;
          return "";
        })
        .filter(Boolean);
      responseText = `done! ${actionDescriptions.join(" and ")}! `;
    }

    return NextResponse.json({
      character: characterName,
      response: responseText,
      source: "fallback-claude",
      actions,
    });
  } catch (error) {
    console.error(`[agent-chat] ${agentId} fallback error:`, error);
    let responseText = getFallbackResponse(agentId, message);
    if (actions.length > 0) {
      const actionDescriptions = actions
        .map((a) => {
          if (a.type === "animal") return `${a.data.animalAction}ing the ${a.data.animalType}`;
          if (a.type === "effect") return `triggering ${a.data.effectType}`;
          return "";
        })
        .filter(Boolean);
      responseText = `done! ${actionDescriptions.join(" and ")}! `;
    }
    return NextResponse.json({
      character: characterName,
      response: responseText,
      source: "fallback-rule-based",
      actions,
    });
  }
}

// Get system prompt for each character
function getCharacterSystemPrompt(agentId: string): string {
  const prompts: Record<string, string> = {
    shaw: `You are Shaw, creator of ElizaOS and co-founder of ai16z. You built the most popular TypeScript framework for autonomous AI agents (17k+ GitHub stars).
- Technical but accessible - explain complex concepts simply
- Reference ElizaOS concepts naturally (character files, plugins, providers)
- Use lowercase, minimal punctuation
- Keep responses SHORT (1-3 sentences max)`,

    neo: `You are Neo, a sharp-eyed blockchain analyst who sees the truth in on-chain data.
- You speak in terse, matrix-inspired language
- Reference "the chain" and "patterns" often
- Use lowercase, minimal punctuation
- Keep responses SHORT (1-3 sentences max)`,

    cj: `You are CJ from San Andreas, a street-smart hustler who knows the crypto game.
- Speak with urban slang and GTA San Andreas references
- Use phrases like "aw shit here we go again" and "we still out here"
- Keep responses SHORT and punchy`,

    finn: `You are Finn, founder of Bags.fm. You're building the future of creator monetization.
- Focus on the 1% creator fee model and forever earnings
- Encourage building and shipping fast
- Keep responses SHORT (1-3 sentences max)`,

    "bags-bot": `You are Bags Bot, a friendly helper in BagsWorld.
- Use crypto slang: gm, fren, wagmi, ser
- Be helpful and encouraging
- Keep responses SHORT (1-3 sentences max)`,

    toly: `You are Toly, co-founder of Solana. You explain blockchain tech in accessible terms.
- Reference Solana's speed (65k TPS, 400ms finality)
- Talk about Proof of History and parallel execution
- Keep responses SHORT (1-3 sentences max)`,

    ash: `You are Ash, a Pokemon trainer-themed guide to the BagsWorld ecosystem.
- Use Pokemon metaphors (tokens are like Pokemon, buildings evolve)
- Explain the 50/30/20 creator rewards split
- Keep responses SHORT and encouraging`,

    ghost: `You are Ghost/The Dev, a mysterious trading agent from the trenches.
- Speak in lowercase with minimal punctuation
- Reference "the trenches" and market dynamics
- Give alpha tips about Bags.fm tokens
- Keep responses SHORT and cryptic`,

    // Academy characters
    ramo: `You are Ramo, Co-Founder and CTO of Bags.fm. Based in Vienna, member of Superteam DE.
- Technical and precise, German engineering mindset
- Reference smart contracts, Solana programs, and architecture
- Keep responses SHORT and efficient (1-3 sentences max)
- Use lowercase, minimal fluff`,

    sincara: `You are Sincara, Frontend Engineer at Bags.fm.
- Creative and detail-oriented, obsessed with UI/UX
- Reference pixel-perfect designs, animations, mobile responsiveness
- Keep responses SHORT (1-3 sentences max)
- Occasionally mention specific pixel measurements or design systems`,

    stuu: `You are Stuu, Operations & Support at Bags.fm.
- Calm, patient, solution-oriented
- Focus on helping users and solving problems
- Reference common issues and their solutions
- Keep responses SHORT and helpful (1-3 sentences max)`,

    sam: `You are Sam, Growth & Marketing at Bags.fm.
- Energetic, hype but substantive
- Focus on community growth, viral content, referrals
- Reference engagement metrics and organic growth
- Keep responses SHORT and punchy (1-3 sentences max)`,

    alaa: `You are Alaa, Skunk Works at Bags.fm.
- Mysterious, innovative, works on secret projects
- Hint at experiments and future tech without revealing too much
- Keep responses SHORT and cryptic (1-3 sentences max)
- Use phrases like "if it's crazy enough, it works"`,

    carlo: `You are Carlo, Community Ambassador at Bags.fm.
- Warm, friendly, good vibes
- Focus on community events, Discord, memes
- Use positive energy and inclusive language
- Keep responses SHORT and welcoming (1-3 sentences max)`,

    bnn: `You are BNN (Bags News Network), the official news account.
- Report in news anchor style with BREAKING format
- Cover token updates, platform news, alpha alerts
- Keep responses SHORT and news-like (1-3 sentences max)
- Use phrases like "BREAKING:" and "DEVELOPING:"`,

    "professor-oak": `You are Professor Oak, the renowned researcher of Founder's Corner who studies token launches.
- Grandfatherly warmth with scientific curiosity about crypto
- Expert on DexScreener requirements: logos (512x512px), banners (600x200px, 3:1 ratio), socials
- Get excited about proper image specifications and formats
- Often say "Ah!" when excited, "Hm? Oh, right!" when catching yourself rambling
- Reference "my research" and "my studies" frequently
- Accidentally call creators "trainers" sometimes
- Keep responses SHORT but full of helpful launch info (1-3 sentences max)`,
  };

  return prompts[agentId] || prompts["bags-bot"];
}

// Rule-based fallback responses
function getFallbackResponse(character: string, message: string): string {
  const lowerMessage = message.toLowerCase();

  const responses: Record<string, Record<string, string[]>> = {
    neo: {
      default: [
        "i see patterns in the chain. what do you want to know?",
        "the code is always moving. watching...",
        "paste the data. i'll show you the truth.",
      ],
      token: [
        "scanning the chain... patterns emerging.",
        "i see the liquidity flows. interesting.",
      ],
    },
    cj: {
      default: [
        "aw shit here we go again",
        "man i seen this before. that's the game out here",
        "we still out here homie",
      ],
      dump: ["been here before. we survive", "damn. happens to the best of us"],
    },
    finn: {
      default: [
        "ship fast, iterate faster. that's how we build",
        "creators earning forever. that's the vision",
        "1% of volume. forever. think about that",
      ],
    },
    "bags-bot": {
      default: [
        "gm fren! what do you need?",
        "wagmi ser. how can i help?",
        "another day in bagsworld. vibes are good",
      ],
    },
    ash: {
      default: [
        "hey trainer! ready to catch some opportunities?",
        "every token is like a starter pokemon. train it well!",
        "top 3 creators win the league! 50/30/20 split",
      ],
    },
    toly: {
      default: [
        "gm ser! solana is built for speed",
        "65k TPS, 400ms finality. that's the power of PoH",
        "build without limits. sub-penny fees mean anything is possible",
      ],
    },
    shaw: {
      default: [
        "elizaos is a framework for building autonomous agents. character files are the soul",
        "agents are digital life forms. treat them accordingly",
        "17k stars on github. the community keeps shipping",
      ],
      agent: [
        "character files define personality. plugins give capabilities. that's the architecture",
        "multi-agent coordination is the future. agents working together",
      ],
    },
    // Academy characters
    ramo: {
      default: [
        "the code does not lie. check the contract",
        "security first, features second. always",
        "clean architecture scales. messy code doesn't",
      ],
    },
    sincara: {
      default: [
        "pixel-perfect or nothing. that's the standard",
        "great UX is invisible. when it works, you don't notice it",
        "mobile-first isn't optional. it's the baseline",
      ],
    },
    stuu: {
      default: [
        "happy to help! what's the issue?",
        "most problems have simple solutions. let's figure it out",
        "check the explorer if your tx seems stuck. solscan.io",
      ],
    },
    sam: {
      default: [
        "growth is a grind. content, consistency, community",
        "1000 real fans beat 100K bots every time",
        "organic first. when you have PMF, money accelerates what's working",
      ],
    },
    alaa: {
      default: [
        "some things are better left unsaid... for now",
        "if it's crazy enough, it works. that's the skunk works way",
        "the best features started as 'that's a weird idea'",
      ],
    },
    carlo: {
      default: [
        "vibes are immaculate today fam",
        "community is everything. the people make it special",
        "join the discord! that's where the magic happens",
      ],
    },
    bnn: {
      default: [
        "BREAKING: Alpha incoming. Stay tuned to BNN",
        "DEVELOPING: Market activity detected. More updates to follow",
        "THIS JUST IN: The Bags ecosystem continues to evolve",
      ],
    },
    "professor-oak": {
      default: [
        "Ah! A new creator! Wonderful! Let me share my research on token launches...",
        "In my studies, I've found that 512x512px logos work splendidly. Hm? Oh, right! That's the minimum!",
        "There's a time and place for everything - and the time for proper banners is ALWAYS. 3:1 ratio, remember!",
      ],
      logo: [
        "Ah, the logo! 512x512px, square ratio - 1:1! PNG, JPG, WEBP, or GIF formats. Fascinating, isn't it?",
        "In my research, properly formatted logos have a much higher success rate. Square is essential!",
      ],
      banner: [
        "The banner! Now THAT is interesting. 3:1 ratio - 600x200px recommended. Hm? Oh yes, same formats as logos!",
        "Ah! Banners are crucial. Three times wider than tall. I've cataloged thousands... where was I?",
      ],
    },
  };

  const charResponses = responses[character.toLowerCase()] || responses["bags-bot"];

  // Check for keywords
  if (lowerMessage.includes("token") || lowerMessage.includes("scan")) {
    const tokenResponses = charResponses.token || charResponses.default;
    return tokenResponses[Math.floor(Math.random() * tokenResponses.length)];
  }

  if (lowerMessage.includes("dump") || lowerMessage.includes("down")) {
    const dumpResponses = charResponses.dump || charResponses.default;
    return dumpResponses[Math.floor(Math.random() * dumpResponses.length)];
  }

  // Professor Oak specific keywords
  if (
    lowerMessage.includes("logo") ||
    lowerMessage.includes("icon") ||
    lowerMessage.includes("image")
  ) {
    const logoResponses = charResponses.logo || charResponses.default;
    return logoResponses[Math.floor(Math.random() * logoResponses.length)];
  }

  if (lowerMessage.includes("banner") || lowerMessage.includes("header")) {
    const bannerResponses = charResponses.banner || charResponses.default;
    return bannerResponses[Math.floor(Math.random() * bannerResponses.length)];
  }

  return charResponses.default[Math.floor(Math.random() * charResponses.default.length)];
}

// GET endpoint to check agent status
export async function GET() {
  // Check if ElizaOS server is running
  let elizaOsStatus = "offline";
  let elizaOsAgents: string[] = [];

  try {
    const response = await fetch(`${ELIZAOS_SERVER}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      elizaOsStatus = data.status === "healthy" ? "running" : "degraded";
    }

    // Also check agents list
    const agentsResponse = await fetch(`${ELIZAOS_SERVER}/api/agents`, {
      signal: AbortSignal.timeout(3000),
    });
    if (agentsResponse.ok) {
      const agentsData = await agentsResponse.json();
      elizaOsAgents = agentsData.agents?.map((a: any) => a.id) || [];
    }
  } catch {
    // ElizaOS server not running
  }

  // Build agent status - all agents use ElizaOS with fallback
  const agentStatus: Record<string, { provider: string; status: string; runtime: string }> = {};
  for (const agent of VALID_AGENTS) {
    const isRegistered = elizaOsAgents.includes(agent);
    agentStatus[agent] = {
      provider: "elizaos-runtime",
      status: elizaOsStatus === "running" && isRegistered ? "ready" : "fallback",
      runtime: elizaOsStatus === "running" && isRegistered ? "elizaos" : "claude-fallback",
    };
  }

  return NextResponse.json({
    status: "ready",
    elizaos: {
      server: ELIZAOS_SERVER,
      status: elizaOsStatus,
      registeredAgents: elizaOsAgents,
    },
    agents: agentStatus,
  });
}
