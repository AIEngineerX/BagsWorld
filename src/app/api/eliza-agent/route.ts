// API Route: Agent Chat - ALL agents route through ElizaOS runtime on Railway
// ElizaOS provides memory persistence, character files, and multi-agent coordination

import { NextRequest, NextResponse } from "next/server";

// ElizaOS server URL - Railway deployment
const ELIZAOS_SERVER =
  process.env.ELIZAOS_SERVER_URL || "https://bagsworld-production.up.railway.app";

// Valid agent IDs that match Railway character files
const VALID_AGENTS = ["neo", "cj", "finn", "bags-bot", "toly", "ash", "shaw", "ghost"];

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

// Handle ALL agents through ElizaOS runtime on Railway
async function handleElizaOS(
  agentId: string,
  message: string,
  userId?: string,
  roomId?: string,
  worldState?: any
): Promise<NextResponse> {
  try {
    // Route to Railway ElizaOS server
    const endpoint = `${ELIZAOS_SERVER}/api/agents/${agentId}/chat`;
    console.log(`[ElizaOS] Calling ${agentId} at ${endpoint}`);

    const sessionId = `${agentId}-${userId || "anonymous"}-${Date.now()}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        sessionId,
        conversationHistory: [],
        worldState,
      }),
      // 15 second timeout for AI responses
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`ElizaOS returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

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
    };

    return NextResponse.json({
      character: data.agentName || characterNames[agentId] || agentId,
      response: data.response,
      source: "elizaos-runtime",
      agentId: data.agentId || agentId,
      suggestedAgent: data.suggestedAgent,
    });
  } catch (error: any) {
    console.warn(`[ElizaOS] ${agentId} unavailable, using fallback:`, error.message);

    // Fallback to direct Claude API
    return handleCharacterFallback(agentId, message, worldState);
  }
}

// Fallback for when ElizaOS server is not running - uses Claude API
async function handleCharacterFallback(
  agentId: string,
  message: string,
  worldState?: any
): Promise<NextResponse> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
  };
  const characterName = characterNames[agentId] || agentId;

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({
      character: characterName,
      response: getFallbackResponse(agentId, message),
      source: "fallback-rule-based",
    });
  }

  try {
    // Get character-specific system prompt
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
    const responseText = data.content?.[0]?.text || getFallbackResponse(agentId, message);

    return NextResponse.json({
      character: characterName,
      response: responseText,
      source: "fallback-claude",
    });
  } catch (error) {
    console.error(`[agent-chat] ${agentId} fallback error:`, error);
    return NextResponse.json({
      character: characterName,
      response: getFallbackResponse(agentId, message),
      source: "fallback-rule-based",
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
