// Diagnostic endpoint for intelligent dialogue system
// Tests Bags API connection and shows full intelligent output with mock data

import { NextResponse } from "next/server";
import { characters } from "@/characters";

const BAGS_API_KEY = process.env.BAGS_API_KEY;
const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ============================================================================
// BAGS API DIAGNOSTICS
// ============================================================================

async function testBagsAPI(): Promise<{
  status: "connected" | "error" | "no_key";
  endpoints: Record<string, { status: string; data?: any; error?: string }>;
}> {
  if (!BAGS_API_KEY) {
    return { status: "no_key", endpoints: {} };
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${BAGS_API_KEY}`,
  };

  const endpoints: Record<string, { status: string; data?: any; error?: string }> = {};

  // Test trending tokens
  try {
    const res = await fetch(`${BAGS_API_URL}/token-launch/trending?limit=5`, { headers });
    if (res.ok) {
      const data = await res.json();
      endpoints["trending"] = { status: "ok", data: { count: data.tokens?.length || 0, sample: data.tokens?.[0] } };
    } else {
      endpoints["trending"] = { status: "error", error: `HTTP ${res.status}` };
    }
  } catch (e) {
    endpoints["trending"] = { status: "error", error: String(e) };
  }

  // Test fee leaderboard
  try {
    const res = await fetch(`${BAGS_API_URL}/fee-share/leaderboard?limit=5`, { headers });
    if (res.ok) {
      const data = await res.json();
      endpoints["leaderboard"] = { status: "ok", data: { count: data.earners?.length || 0, sample: data.earners?.[0] } };
    } else {
      endpoints["leaderboard"] = { status: "error", error: `HTTP ${res.status}` };
    }
  } catch (e) {
    endpoints["leaderboard"] = { status: "error", error: String(e) };
  }

  const hasErrors = Object.values(endpoints).some(e => e.status === "error");
  return { status: hasErrors ? "error" : "connected", endpoints };
}

// ============================================================================
// MOCK DATA FOR DEMO
// ============================================================================

const MOCK_DATA = {
  topTokens: [
    { mint: "BAGS111", symbol: "BAGS", name: "Bags Token", marketCap: 2500000, volume24h: 450000, change24h: 23.5, lifetimeFees: 4500 },
    { mint: "MOON222", symbol: "MOON", name: "MoonBag", marketCap: 890000, volume24h: 125000, change24h: -8.2, lifetimeFees: 1250 },
    { mint: "DEGEN333", symbol: "DEGEN", name: "Degen Finance", marketCap: 650000, volume24h: 89000, change24h: 156.7, lifetimeFees: 890 },
    { mint: "PUMP444", symbol: "PUMP", name: "PumpIt", marketCap: 420000, volume24h: 67000, change24h: 45.0, lifetimeFees: 670 },
    { mint: "ALPHA555", symbol: "ALPHA", name: "Alpha Hunters", marketCap: 180000, volume24h: 23000, change24h: 12.3, lifetimeFees: 230 },
  ],
  topCreators: [
    { username: "cryptobuilder", lifetimeEarnings: 125.5, tokenCount: 3, topToken: "BAGS" },
    { username: "degenwhale", lifetimeEarnings: 89.2, tokenCount: 2, topToken: "MOON" },
    { username: "alphahunter", lifetimeEarnings: 45.8, tokenCount: 5, topToken: "DEGEN" },
    { username: "pumpmaster", lifetimeEarnings: 34.1, tokenCount: 1, topToken: "PUMP" },
    { username: "solanadev", lifetimeEarnings: 28.9, tokenCount: 4, topToken: "ALPHA" },
  ],
  ecosystemStats: {
    totalVolume24h: 754000,
    totalFees24h: 7540,
    activeTokens: 47,
    totalCreators: 156,
  },
};

// ============================================================================
// CLAUDE INTEGRATION TEST
// ============================================================================

async function generateWithClaude(mockData: typeof MOCK_DATA): Promise<{
  status: "generated" | "fallback" | "no_key";
  conversation: Array<{ speaker: string; message: string }>;
  rawResponse?: string;
}> {
  if (!ANTHROPIC_API_KEY) {
    return { status: "no_key", conversation: [] };
  }

  const dataContext = `
=== REAL-TIME BAGS.FM DATA ===

TOP TOKENS BY VOLUME:
1. $${mockData.topTokens[0].symbol} - MC: $2.5M, Vol: $450K, +23.5%
2. $${mockData.topTokens[1].symbol} - MC: $890K, Vol: $125K, -8.2%
3. $${mockData.topTokens[2].symbol} - MC: $650K, Vol: $89K, +156.7% (HOT!)
4. $${mockData.topTokens[3].symbol} - MC: $420K, Vol: $67K, +45.0%
5. $${mockData.topTokens[4].symbol} - MC: $180K, Vol: $23K, +12.3%

TOP CREATORS BY EARNINGS:
1. @${mockData.topCreators[0].username} - ${mockData.topCreators[0].lifetimeEarnings} SOL earned (${mockData.topCreators[0].tokenCount} tokens, top: $${mockData.topCreators[0].topToken})
2. @${mockData.topCreators[1].username} - ${mockData.topCreators[1].lifetimeEarnings} SOL earned
3. @${mockData.topCreators[2].username} - ${mockData.topCreators[2].lifetimeEarnings} SOL earned
4. @${mockData.topCreators[3].username} - ${mockData.topCreators[3].lifetimeEarnings} SOL earned
5. @${mockData.topCreators[4].username} - ${mockData.topCreators[4].lifetimeEarnings} SOL earned

ECOSYSTEM STATS:
- 24h Volume: $754,000
- 24h Fees Generated: 7,540 SOL
- Active Tokens: 47
- Total Creators: 156
`;

  const prompt = `You are simulating a conversation between 3 AI characters in BagsWorld, a pixel art game that visualizes Bags.fm trading activity.

CHARACTERS:
- Finn: Confident founder of Bags.fm. Direct, uses stats to make points. Says things like "this is why we built bags"
- Ghost: Backend dev (@DaddyGhost). Lowercase typing, mentions on-chain verification. Runs the creator rewards system.
- Neo: Matrix-themed scout. Speaks cryptically about "the chain" and "the code". Sees patterns others miss.

TOPIC: Discussing today's market activity and top performers

${dataContext}

Generate a natural 5-line conversation where:
1. Each line is SHORT (under 80 characters)
2. Characters reference SPECIFIC data points (token symbols, percentages, usernames, SOL amounts)
3. They react to each other naturally
4. Stay in character voice

FORMAT AS JSON:
[
  {"speaker": "finn", "message": "..."},
  {"speaker": "ghost", "message": "..."},
  ...
]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Diagnose] Claude error:", errorText);
      return { status: "fallback", conversation: [], rawResponse: errorText };
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";

    // Parse JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        status: "generated",
        conversation: parsed,
        rawResponse: content,
      };
    }

    return { status: "fallback", conversation: [], rawResponse: content };
  } catch (error) {
    return { status: "fallback", conversation: [], rawResponse: String(error) };
  }
}

// ============================================================================
// FALLBACK DEMO (no API needed)
// ============================================================================

function generateFallbackDemo(mockData: typeof MOCK_DATA): Array<{ speaker: string; message: string }> {
  return [
    { speaker: "finn", message: `$DEGEN up 156% today. $650K mcap and climbing. this is why we built bags` },
    { speaker: "ghost", message: `watching @cryptobuilder at 125.5 SOL earned. top creator rn. all on-chain` },
    { speaker: "neo", message: `i see the pattern. $BAGS at $2.5M mcap. the code shows strength` },
    { speaker: "finn", message: `$754K in 24h volume across 47 tokens. ecosystem is shipping` },
    { speaker: "ghost", message: `7,540 SOL in fees today. creators getting paid. check solscan` },
    { speaker: "neo", message: `@degenwhale accumulating. 89 SOL earned. the matrix rewards builders` },
  ];
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET() {
  // Test Bags API
  const bagsStatus = await testBagsAPI();

  // Test Claude with mock data
  const claudeResult = await generateWithClaude(MOCK_DATA);

  // Generate fallback demo
  const fallbackDemo = generateFallbackDemo(MOCK_DATA);

  return NextResponse.json({
    diagnosis: {
      bags_api: {
        status: bagsStatus.status,
        key_configured: !!BAGS_API_KEY,
        url: BAGS_API_URL,
        endpoints: bagsStatus.endpoints,
      },
      claude_api: {
        status: claudeResult.status,
        key_configured: !!ANTHROPIC_API_KEY,
        key_preview: ANTHROPIC_API_KEY ? `${ANTHROPIC_API_KEY.substring(0, 10)}...` : null,
      },
    },
    mock_data_used: MOCK_DATA,
    intelligent_output: claudeResult.status === "generated" ? {
      source: "Claude AI with real-time data context",
      conversation: claudeResult.conversation,
    } : null,
    fallback_output: {
      source: "Rule-based with mock data (used when Claude unavailable)",
      conversation: fallbackDemo,
    },
    raw_claude_response: claudeResult.rawResponse,
    instructions: {
      to_enable_full_intelligence: [
        "1. Add ANTHROPIC_API_KEY to .env.local",
        "2. Ensure BAGS_API_KEY is set for real data",
        "3. Restart the dev server",
      ],
      current_behavior: claudeResult.status === "generated"
        ? "Full intelligent mode - Claude generates contextual dialogue with real data"
        : claudeResult.status === "no_key"
        ? "Fallback mode - Using rule-based responses (no Claude API key)"
        : "Fallback mode - Claude API error, using rule-based responses",
    },
  });
}
