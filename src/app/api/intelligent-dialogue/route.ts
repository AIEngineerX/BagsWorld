// Intelligent Dialogue API - Claude-powered conversations with real Bags.fm data
// Characters discuss actual on-chain events, market conditions, and ecosystem stats

import { NextResponse } from "next/server";
import { characters, generateCharacterPrompt } from "@/characters";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BAGS_API_KEY = process.env.BAGS_API_KEY;
const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";

// ============================================================================
// TYPES
// ============================================================================

interface DialogueRequest {
  participants: string[]; // Character IDs
  topic: string;
  context?: {
    tokenSymbol?: string;
    tokenMint?: string;
    amount?: number;
    change?: number;
    username?: string;
  };
  lineCount?: number;
}

interface RealWorldData {
  topTokens: TokenData[];
  recentClaims: ClaimData[];
  ecosystemStats: EcosystemStats;
  topCreators: CreatorData[];
  timestamp: number;
}

interface TokenData {
  mint: string;
  symbol: string;
  name: string;
  marketCap: number;
  volume24h: number;
  change24h: number;
  lifetimeFees: number;
}

interface ClaimData {
  username: string;
  amount: number;
  tokenSymbol: string;
  timestamp: number;
}

interface CreatorData {
  username: string;
  lifetimeEarnings: number;
  tokenCount: number;
  topToken?: string;
}

interface EcosystemStats {
  totalVolume24h: number;
  totalFees24h: number;
  activeTokens: number;
  totalCreators: number;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch LIVE Bags.fm tokens directly from DexScreener
 * Searches for tokens on the "bags" dex (CA ends with BAGS)
 */
async function fetchLiveBagsTokens(): Promise<TokenData[]> {
  try {
    // Search DexScreener for tokens on the Bags.fm DEX
    const response = await fetch("https://api.dexscreener.com/latest/dex/search?q=BAGS", {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[IntelligentDialogue] DexScreener API error:", response.status);
      return [];
    }

    const data = await response.json();
    const pairs = data.pairs || [];

    // Filter for actual Bags.fm tokens (dexId === "bags" or CA ends with "BAGS")
    // Exclude placeholder tokens like REWARDS, POKECENTER, GYM
    const EXCLUDED_SYMBOLS = ["REWARDS", "POKECENTER", "GYM"];
    const bagsTokens = pairs
      .filter((pair: any) => {
        const isBagsDex = pair.dexId === "bags";
        const caEndsBags = pair.baseToken?.address?.endsWith("BAGS");
        const isExcluded = EXCLUDED_SYMBOLS.includes(pair.baseToken?.symbol?.toUpperCase());
        return (isBagsDex || caEndsBags) && pair.baseToken?.address && !isExcluded;
      })
      .map((pair: any) => ({
        mint: pair.baseToken.address,
        symbol: pair.baseToken.symbol || "???",
        name: pair.baseToken.name || "Unknown",
        marketCap: pair.marketCap || pair.fdv || 0,
        volume24h: pair.volume?.h24 || 0,
        change24h: pair.priceChange?.h24 || 0,
        lifetimeFees: 0,
        creator: pair.info?.socials?.[0]?.url || undefined,
      }))
      // Remove duplicates by mint address
      .filter(
        (token: TokenData, index: number, self: TokenData[]) =>
          index === self.findIndex((t) => t.mint === token.mint)
      )
      // Sort by 24h volume (most active first)
      .sort((a: TokenData, b: TokenData) => b.volume24h - a.volume24h)
      .slice(0, 10); // Top 10 tokens

    console.log(`[IntelligentDialogue] Found ${bagsTokens.length} live Bags.fm tokens`);
    return bagsTokens;
  } catch (error) {
    console.error("[IntelligentDialogue] Error fetching from DexScreener:", error);
    return [];
  }
}

/**
 * Extract creator usernames from token socials/info
 */
function extractCreators(tokens: TokenData[]): CreatorData[] {
  const creators: CreatorData[] = [];
  const seenUsernames = new Set<string>();

  tokens.forEach((token: any) => {
    // Try to extract Twitter username from socials
    if (token.creator && token.creator.includes("x.com/")) {
      const match = token.creator.match(/x\.com\/([^\/\?]+)/);
      if (match && match[1] && !seenUsernames.has(match[1])) {
        seenUsernames.add(match[1]);
        creators.push({
          username: match[1],
          lifetimeEarnings: token.volume24h * 0.01, // Estimate 1% fees
          tokenCount: 1,
          topToken: token.symbol,
        });
      }
    }
  });

  return creators.slice(0, 5);
}

/**
 * Fetch real data from Bags.fm - combines DexScreener + ecosystem stats
 */
async function fetchRealWorldData(): Promise<RealWorldData> {
  const data: RealWorldData = {
    topTokens: [],
    recentClaims: [],
    ecosystemStats: {
      totalVolume24h: 0,
      totalFees24h: 0,
      activeTokens: 0,
      totalCreators: 0,
    },
    topCreators: [],
    timestamp: Date.now(),
  };

  // Fetch LIVE Bags.fm tokens from DexScreener
  data.topTokens = await fetchLiveBagsTokens();

  // Extract creators from token data
  data.topCreators = extractCreators(data.topTokens);

  // Also try ecosystem-stats API for additional creator data
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const statsRes = await fetch(`${baseUrl}/api/ecosystem-stats`, {
      cache: "no-store",
    });

    if (statsRes.ok) {
      const stats = await statsRes.json();
      if (stats.topCreators && stats.topCreators.length > 0) {
        // Merge with DexScreener creators
        stats.topCreators.forEach((c: any) => {
          const username = c.username || c.providerUsername;
          if (username && !data.topCreators.some((tc) => tc.username === username)) {
            data.topCreators.push({
              username,
              lifetimeEarnings: c.lifetimeEarnings || c.feeContribution || 0,
              tokenCount: c.tokenCount || 1,
              topToken: c.topToken?.symbol,
            });
          }
        });
      }

      // Get pending pool info
      if (stats.pendingPoolSol > 0) {
        data.ecosystemStats.totalFees24h = stats.pendingPoolSol;
      }
    }
  } catch (e) {
    console.error("[IntelligentDialogue] Error fetching ecosystem stats:", e);
  }

  // Calculate ecosystem stats from live token data
  if (data.topTokens.length > 0) {
    data.ecosystemStats.totalVolume24h = data.topTokens.reduce((sum, t) => sum + t.volume24h, 0);
    data.ecosystemStats.activeTokens = data.topTokens.length;
    if (data.ecosystemStats.totalFees24h === 0) {
      data.ecosystemStats.totalFees24h = data.ecosystemStats.totalVolume24h * 0.01; // 1% fees
    }
  }

  data.ecosystemStats.totalCreators = data.topCreators.length;

  console.log("[IntelligentDialogue] Fetched LIVE Bags.fm data:", {
    tokens: data.topTokens.length,
    creators: data.topCreators.length,
    volume: data.ecosystemStats.totalVolume24h,
    topToken: data.topTokens[0]?.symbol,
  });

  return data;
}

/**
 * Format numbers for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(2);
}

function formatSOL(lamports: number): string {
  return (lamports / 1e9).toFixed(2);
}

// ============================================================================
// DIALOGUE GENERATION
// ============================================================================

/**
 * Build context string from real-world data
 */
function buildDataContext(data: RealWorldData, topic: string): string {
  let context = `\n\n=== REAL-TIME BAGS.FM DATA (use this in your conversation) ===\n`;
  context += `Timestamp: ${new Date(data.timestamp).toISOString()}\n\n`;

  // Top tokens
  if (data.topTokens.length > 0) {
    context += `TOP TOKENS BY VOLUME:\n`;
    data.topTokens.forEach((t, i) => {
      context += `${i + 1}. $${t.symbol} - MC: $${formatNumber(t.marketCap)}, Vol: $${formatNumber(t.volume24h)}, ${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(1)}%\n`;
    });
    context += "\n";
  }

  // Top creators
  if (data.topCreators.length > 0) {
    context += `TOP CREATORS BY EARNINGS:\n`;
    data.topCreators.forEach((c, i) => {
      context += `${i + 1}. @${c.username} - ${c.lifetimeEarnings.toFixed(2)} SOL earned${c.topToken ? ` (top: $${c.topToken})` : ""}\n`;
    });
    context += "\n";
  }

  // Ecosystem stats
  context += `ECOSYSTEM STATS:\n`;
  context += `- 24h Volume: $${formatNumber(data.ecosystemStats.totalVolume24h)}\n`;
  context += `- 24h Fees Generated: ${data.ecosystemStats.totalFees24h.toFixed(2)} SOL\n`;
  context += `- Active Tokens: ${data.ecosystemStats.activeTokens}\n`;

  return context;
}

/**
 * Generate character-specific system prompt for dialogue
 */
function buildCharacterPrompt(
  characterId: string,
  otherParticipants: string[],
  topic: string
): string {
  const character = characters[characterId];
  if (!character) return "";

  let prompt = generateCharacterPrompt(character);

  // Add dialogue-specific instructions
  prompt += `\n\n=== AUTONOMOUS DIALOGUE MODE ===
You are having a natural conversation with other characters in BagsWorld.
Other participants: ${otherParticipants.map((id) => characters[id]?.name || id).join(", ")}
Topic: ${topic}

RULES FOR THIS CONVERSATION:
1. Speak naturally as ${character.name} - use your personality and speech patterns
2. Reference REAL DATA provided below - mention actual token symbols, numbers, usernames
3. Keep each response to 1-2 SHORT sentences (under 100 characters ideally)
4. React to what others say - agree, disagree, add insights
5. Stay in character but make it feel like a real conversation
6. Don't be generic - use specific data points to make your point
7. You can express opinions about tokens, market conditions, creators
8. No hashtags, no @ mentions in your speech (except when referencing creators)`;

  return prompt;
}

/**
 * Generate a full conversation using Claude
 */
async function generateIntelligentConversation(
  participants: string[],
  topic: string,
  realData: RealWorldData,
  context: DialogueRequest["context"],
  lineCount: number = 4
): Promise<Array<{ characterId: string; characterName: string; message: string }>> {
  if (!ANTHROPIC_API_KEY) {
    // Fallback to simple responses if no API key
    return generateFallbackConversation(participants, topic, realData, lineCount);
  }

  const dataContext = buildDataContext(realData, topic);
  const lines: Array<{ characterId: string; characterName: string; message: string }> = [];

  // Build conversation prompt
  let conversationPrompt = `You are simulating a conversation between ${participants.length} AI characters in BagsWorld, a pixel art game that visualizes Bags.fm trading activity.

CHARACTERS IN THIS CONVERSATION:
${participants
  .map((id) => {
    const char = characters[id];
    return char ? `- ${char.name}: ${char.style.tone}` : `- ${id}`;
  })
  .join("\n")}

TOPIC: ${topic}
${context?.tokenSymbol ? `Related Token: $${context.tokenSymbol}` : ""}
${context?.amount ? `Amount: ${context.amount} SOL` : ""}
${context?.change ? `Change: ${context.change}%` : ""}
${context?.username ? `User: @${context.username}` : ""}

${dataContext}

Generate a natural conversation with EXACTLY ${lineCount} lines. Each line should be:
1. Short (under 100 characters)
2. In character for the speaker
3. Reference real data when relevant
4. Flow naturally from the previous line

FORMAT YOUR RESPONSE AS JSON:
[
  {"speaker": "character_id", "message": "their line"},
  ...
]

The conversation should feel natural, like these characters are actually discussing what's happening on Bags.fm right now.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 800,
        messages: [{ role: "user", content: conversationPrompt }],
      }),
    });

    if (!response.ok) {
      console.error("[IntelligentDialogue] Claude API error:", await response.text());
      return generateFallbackConversation(participants, topic, realData, lineCount);
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";

    // Parse JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((line: any) => ({
        characterId: line.speaker,
        characterName: characters[line.speaker]?.name || line.speaker,
        message: line.message,
      }));
    }
  } catch (error) {
    console.error("[IntelligentDialogue] Error generating conversation:", error);
  }

  return generateFallbackConversation(participants, topic, realData, lineCount);
}

/**
 * Fallback conversation using real data but without Claude
 */
function generateFallbackConversation(
  participants: string[],
  topic: string,
  data: RealWorldData,
  lineCount: number
): Array<{ characterId: string; characterName: string; message: string }> {
  const lines: Array<{ characterId: string; characterName: string; message: string }> = [];

  const topToken = data.topTokens[0];
  const topCreator = data.topCreators[0];

  // Topic-specific openers with real data
  const openers: Record<string, Record<string, string>> = {
    finn: {
      token_launch: topToken
        ? `$${topToken.symbol} doing ${formatNumber(topToken.volume24h)} in volume. this is what we built for`
        : "new launch cooking. let's see the numbers",
      fee_claim: topCreator
        ? `@${topCreator.username} leading with ${topCreator.lifetimeEarnings.toFixed(1)} SOL earned. creators getting paid`
        : "fees flowing to builders. exactly how it should be",
      price_pump: topToken
        ? `$${topToken.symbol} up ${topToken.change24h.toFixed(0)}%. volume driving this`
        : "pumps follow building. always",
      general: `${formatNumber(data.ecosystemStats.totalVolume24h)} in 24h volume. ecosystem is shipping`,
    },
    ghost: {
      token_launch: topToken
        ? `scanning $${topToken.symbol}... ${formatNumber(topToken.marketCap)} mcap, fees look healthy`
        : "new contract deployed. checking the chain",
      fee_claim: `${data.ecosystemStats.totalFees24h.toFixed(2)} SOL in fees today. all verifiable on-chain`,
      distribution: topCreator
        ? `top creator @${topCreator.username} at ${topCreator.lifetimeEarnings.toFixed(1)} SOL. distribution coming`
        : "pool accumulating. almost at threshold",
      general: "systems running clean. watching the metrics",
    },
    neo: {
      token_launch: topToken
        ? `i see $${topToken.symbol} in the chain. ${topToken.change24h >= 0 ? "green" : "red"} signals`
        : "new patterns forming in the matrix",
      price_pump: topToken
        ? `$${topToken.symbol} ascending. ${topToken.change24h.toFixed(0)}% movement detected`
        : "green flowing through the code",
      whale_alert: `large movements detected. ${formatNumber(data.ecosystemStats.totalVolume24h)} flowing today`,
      general: "the chain reveals all. watching the patterns",
    },
    ash: {
      token_launch: topToken
        ? `new trainer with $${topToken.symbol}! already at ${formatNumber(topToken.marketCap)} market cap!`
        : "another trainer entering the league!",
      fee_claim: topCreator
        ? `@${topCreator.username} is top trainer with ${topCreator.lifetimeEarnings.toFixed(1)} SOL in XP!`
        : "trainers leveling up with fees!",
      general: `${data.ecosystemStats.activeTokens} pokemon... i mean tokens in the wild today!`,
    },
    "bags-bot": {
      token_launch: topToken
        ? `$${topToken.symbol} just dropped ser. ${formatNumber(topToken.volume24h)} volume already 👀`
        : "fresh launch ngl looking spicy",
      price_pump: topToken
        ? `$${topToken.symbol} pumping ${topToken.change24h.toFixed(0)}%. wagmi`
        : "green candles. nature is healing",
      general: `${formatNumber(data.ecosystemStats.totalVolume24h)} in volume today. bullish vibes`,
    },
  };

  for (let i = 0; i < lineCount; i++) {
    const speakerId = participants[i % participants.length];
    const charOpeners = openers[speakerId] || openers["bags-bot"];
    const message = charOpeners[topic] || charOpeners.general || "interesting developments...";

    lines.push({
      characterId: speakerId,
      characterName: characters[speakerId]?.name || speakerId,
      message,
    });
  }

  return lines;
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: Request) {
  try {
    const body: DialogueRequest = await request.json();
    const { participants, topic, context, lineCount = 4 } = body;

    if (!participants || participants.length < 2) {
      return NextResponse.json({ error: "Need at least 2 participants" }, { status: 400 });
    }

    // Fetch real-world data
    const realData = await fetchRealWorldData();

    // Generate intelligent conversation
    const conversation = await generateIntelligentConversation(
      participants,
      topic,
      realData,
      context,
      Math.min(lineCount, 8)
    );

    return NextResponse.json({
      success: true,
      conversation,
      dataSnapshot: {
        topToken: realData.topTokens[0]?.symbol,
        topCreator: realData.topCreators[0]?.username,
        volume24h: realData.ecosystemStats.totalVolume24h,
        timestamp: realData.timestamp,
      },
    });
  } catch (error) {
    console.error("[IntelligentDialogue] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") || "general";
  const participantStr = searchParams.get("participants") || "finn,ghost,neo";
  const participants = participantStr.split(",");

  // Redirect to POST
  const body: DialogueRequest = {
    participants,
    topic,
    lineCount: 4,
  };

  // Fetch real-world data
  const realData = await fetchRealWorldData();

  // Generate conversation
  const conversation = await generateIntelligentConversation(participants, topic, realData, {}, 4);

  return NextResponse.json({
    success: true,
    conversation,
    dataSnapshot: {
      topToken: realData.topTokens[0]?.symbol,
      topCreator: realData.topCreators[0]?.username,
      volume24h: realData.ecosystemStats.totalVolume24h,
    },
  });
}
