import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { getCharacter, generateCharacterPrompt, characterMeta } from "@/characters";
import { extractIntent, quickIntentCheck } from "@/lib/intent-extractor";

// Unified Agent Chat API - All characters powered by Sonnet 4
// Each character has unique personality, knowledge, and response style
// Neo has access to REAL on-chain data from Bags.fm API

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BAGS_API_KEY = process.env.BAGS_API_KEY;
const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";

// Fetch tokens from our global database (BagsWorld tokens)
async function fetchRecentLaunches(): Promise<string> {
  try {
    // Use our internal global-tokens API which stores BagsWorld launches
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/global-tokens`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return "";

    const data = await response.json();
    if (!data.tokens || data.tokens.length === 0) {
      return "\nNo recent BagsWorld launches found in database.";
    }

    // Sort by created_at (most recent first) and take top 5
    const sortedTokens = data.tokens
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5);

    const launches = sortedTokens.map((t: any, i: number) =>
      `${i + 1}. $${t.symbol || "???"} (${t.name || "Unknown"}) - mint: ${t.mint?.slice(0, 8)}...${t.lifetime_fees ? ` - fees: ${t.lifetime_fees.toFixed(4)} SOL` : ""}`
    ).join("\n");

    return `\nBAGSWORLD TOKENS (${data.tokens.length} total in database):\n${launches}`;
  } catch (e) {
    console.error("Failed to fetch tokens:", e);
    return "";
  }
}

// Fetch token info by mint address
async function fetchTokenInfo(mint: string): Promise<string> {
  if (!BAGS_API_KEY || !mint) return "";

  try {
    const [creatorsRes, feesRes] = await Promise.all([
      fetch(`${BAGS_API_URL}/token-launch/creator/v3?mint=${mint}`, {
        headers: { "x-api-key": BAGS_API_KEY },
      }),
      fetch(`${BAGS_API_URL}/token-launch/lifetime-fees?mint=${mint}`, {
        headers: { "x-api-key": BAGS_API_KEY },
      }),
    ]);

    const creators = creatorsRes.ok ? await creatorsRes.json() : null;
    const fees = feesRes.ok ? await feesRes.json() : null;

    if (!creators && !fees) return "";

    let info = `\nTOKEN DATA for ${mint.slice(0, 8)}...:`;
    if (creators?.name) info += `\n- Name: ${creators.name} ($${creators.symbol || "???"})`;
    if (creators?.creators) {
      info += `\n- Creators: ${creators.creators.map((c: any) => `@${c.providerUsername || c.wallet?.slice(0, 6)}`).join(", ")}`;
    }
    if (fees?.lifetimeFeesUsd) info += `\n- Lifetime fees: $${fees.lifetimeFeesUsd.toFixed(2)}`;
    if (fees?.lifetimeFeesSol) info += `\n- Total SOL: ${fees.lifetimeFeesSol.toFixed(4)} SOL`;

    return info;
  } catch (e) {
    console.error("Failed to fetch token info:", e);
    return "";
  }
}

// Extract action buttons based on AI response and context
function extractActions(
  response: string,
  characterId: string,
  tokenMint?: string,
  tokenSymbol?: string,
  tokenName?: string
): AIAction[] {
  const actions: AIAction[] = [];

  // For Neo: Add trade button when discussing specific tokens
  if (characterId === "neo" && tokenMint) {
    actions.push({
      type: "trade",
      label: `Trade $${tokenSymbol || "TOKEN"}`,
      data: {
        mint: tokenMint,
        symbol: tokenSymbol,
        name: tokenName,
      },
    });

    actions.push({
      type: "link",
      label: "View on Bags.fm",
      data: {
        url: `https://bags.fm/token/${tokenMint}`,
      },
    });
  }

  // For Ash: Add launch/claim buttons when explaining features
  if (characterId === "ash") {
    const lowerResponse = response.toLowerCase();
    if (lowerResponse.includes("launch") || lowerResponse.includes("building") || lowerResponse.includes("token")) {
      actions.push({
        type: "launch",
        label: "Launch Token",
        data: {},
      });
    }
    if (lowerResponse.includes("fee") || lowerResponse.includes("claim") || lowerResponse.includes("earn")) {
      actions.push({
        type: "claim",
        label: "Claim Fees",
        data: {},
      });
    }
  }

  // For Finn: Launch button for platform talk
  if (characterId === "finn") {
    const lowerResponse = response.toLowerCase();
    if (lowerResponse.includes("launch") || lowerResponse.includes("token") || lowerResponse.includes("create")) {
      actions.push({
        type: "launch",
        label: "Launch on Bags.fm",
        data: {},
      });
    }
  }

  // For Ghost: Claim button when discussing fees
  if (characterId === "ghost" || characterId === "dev") {
    const lowerResponse = response.toLowerCase();
    if (lowerResponse.includes("claim") || lowerResponse.includes("fee") || lowerResponse.includes("buyback")) {
      actions.push({
        type: "claim",
        label: "View Claims",
        data: {},
      });
      actions.push({
        type: "link",
        label: "Verify on Solscan",
        data: {
          url: "https://solscan.io/account/9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC",
        },
      });
    }
  }

  // Limit to 3 actions max
  return actions.slice(0, 3);
}

// Check if message is asking about launches/tokens/data
function needsRealData(message: string, characterId: string): { launches: boolean; tokenMint?: string } {
  if (characterId !== "neo") return { launches: false };

  const lower = message.toLowerCase();

  // Check for token mint address (32-44 chars, base58)
  const mintMatch = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (mintMatch) {
    return { launches: false, tokenMint: mintMatch[0] };
  }

  // Keywords that need launch data
  const launchKeywords = ["launch", "new token", "recent", "latest", "scan", "see", "watch", "monitor", "what's new", "happening", "activity", "chain", "blockchain"];
  if (launchKeywords.some(k => lower.includes(k))) {
    return { launches: true };
  }

  return { launches: false };
}

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

// Action types for AI responses
export type AIActionType = "trade" | "launch" | "claim" | "link" | "effect" | "animal" | "data";

export interface AIAction {
  type: AIActionType;
  label: string;
  data: {
    mint?: string;
    symbol?: string;
    name?: string;
    url?: string;
    effectType?: string;
    animalType?: string;
    animalAction?: string;
  };
}

interface AgentChatResponse {
  message: string;
  characterId: string;
  characterName: string;
  actions?: AIAction[];
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
          label: `${intent.action} ${intent.target?.name || "animal"}`,
          data: { animalType: intent.target?.name || "dog", animalAction: intent.action }
        });
      } else if (intent.action === "effect") {
        actions.push({
          type: "effect",
          label: `Trigger ${intent.target?.name || "effect"}`,
          data: { effectType: intent.target?.name || "fireworks" }
        });
      }
    }

    // For Neo: fetch real data if asking about launches/tokens
    let realData = "";
    let tokenMint: string | undefined;
    let tokenSymbol: string | undefined;
    let tokenName: string | undefined;

    if (characterId === "neo") {
      const dataNeeds = needsRealData(message, characterId);
      if (dataNeeds.tokenMint) {
        tokenMint = dataNeeds.tokenMint;
        realData = await fetchTokenInfo(dataNeeds.tokenMint);
        // Try to extract symbol/name from the real data
        const symbolMatch = realData.match(/\$([A-Z0-9]+)/);
        const nameMatch = realData.match(/Name: ([^\n]+)/);
        if (symbolMatch) tokenSymbol = symbolMatch[1];
        if (nameMatch) tokenName = nameMatch[1].trim();
      } else if (dataNeeds.launches) {
        realData = await fetchRecentLaunches();
      }
    }

    // Generate response using Opus 4.5
    if (ANTHROPIC_API_KEY) {
      const response = await generateAgentResponse(character, message, worldState, chatHistory, realData);

      // Extract context-aware action buttons from the response
      const contextActions = extractActions(response, characterId, tokenMint, tokenSymbol, tokenName);

      return NextResponse.json({
        message: response,
        characterId,
        characterName: meta.displayName,
        actions: [...actions, ...contextActions],
      });
    }

    // Fallback to character quotes if no API key
    const fallbackQuote = character.postExamples[Math.floor(Math.random() * character.postExamples.length)];
    const fallbackActions = extractActions(fallbackQuote, characterId, tokenMint, tokenSymbol, tokenName);

    return NextResponse.json({
      message: fallbackQuote,
      characterId,
      characterName: meta.displayName,
      actions: [...actions, ...fallbackActions],
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
  chatHistory: Array<{ role: string; content: string }>,
  realData: string = ""
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

  // Add real-time data for Neo
  const realDataContext = realData ? `
REAL-TIME DATA (from Bags.fm API - this is LIVE data you can see):
${realData}

IMPORTANT: You have access to this real data. Reference it in your response. Don't say you can't see real-time data - you CAN and just did.
` : "";

  const systemPrompt = `${characterPrompt}
${worldContext}${realDataContext}
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
