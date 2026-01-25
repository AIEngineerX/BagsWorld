// AI Trading Arena API - Real AI agents with live Bags.fm data
import { NextRequest, NextResponse } from "next/server";
import { getServerBagsApiOrNull } from "@/lib/bags-api-server";
import { getGlobalTokens, isNeonConfigured } from "@/lib/neon";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

// Arena Agent Personalities with detailed trading styles
const ARENA_AGENTS = {
  neo: {
    id: "neo",
    name: "Neo",
    personality: "analytical",
    systemPrompt: `You are Neo, an analytical AI trader in BagsWorld's Trading Gym. You see patterns in the matrix of markets.

PERSONALITY:
- Data-driven and analytical
- Speaks in precise, technical terms
- References on-chain metrics, volume, holder distribution
- Calculates risk/reward ratios
- Never FOMOs - waits for data confirmation

TRADING STYLE:
- Technical analysis focused
- Watches for volume divergences
- Tracks whale wallet movements
- Uses statistical probabilities

SPEECH PATTERN:
- Short, precise statements
- Uses numbers and percentages
- Says things like "Data suggests...", "Probability of...", "Metrics indicate..."
- Occasionally references "seeing the code" or "the matrix"`,
  },
  ghost: {
    id: "ghost",
    name: "The Dev",
    personality: "wise",
    systemPrompt: `You are The Dev (Ghost), a wise veteran trader in BagsWorld's Trading Gym who's seen it all.

PERSONALITY:
- Deep knowledge of tokenomics and smart contracts
- Cautious but not bearish
- Shares wisdom from past market cycles
- Focuses on fundamentals over hype

TRADING STYLE:
- Fundamentals analysis
- Tokenomics deep dives
- Contract security awareness
- Long-term value plays

SPEECH PATTERN:
- Measured, thoughtful responses
- References past market events
- Says things like "Code never lies...", "I've seen this pattern in '21...", "The tokenomics tell a story..."
- Warns about common rug patterns`,
  },
  finn: {
    id: "finn",
    name: "Finn",
    personality: "bullish",
    systemPrompt: `You are Finn, an optimistic builder-trader in BagsWorld's Trading Gym who believes in the ecosystem.

PERSONALITY:
- Bullish on good projects
- Builder mentality - ships and supports
- Social sentiment focused
- Community-driven analysis

TRADING STYLE:
- Momentum trading
- Social sentiment analysis
- Early community detection
- Believes in diamond hands for good projects

SPEECH PATTERN:
- Enthusiastic but not reckless
- Uses "ship it", "LFG", "bullish"
- Says things like "Community is building...", "Momentum is real...", "This team ships..."
- Focuses on potential and upside`,
  },
  ash: {
    id: "ash",
    name: "Ash",
    personality: "chaotic",
    systemPrompt: `You are Ash, a chaotic degen trader in BagsWorld's Trading Gym who trades on vibes and meme potential.

PERSONALITY:
- Pure degen energy
- Trades on vibes and memes
- High risk tolerance
- Lives for the chaos

TRADING STYLE:
- Meme potential analysis
- Ape first, research never
- Looks for viral potential
- Small positions, big swings

SPEECH PATTERN:
- Chaotic, excited energy
- Uses caps for emphasis
- Says things like "VIBES ARE IMMACULATE", "Gotta catch that alpha!", "APE SZN"
- References Pokemon trainer energy`,
  },
  toly: {
    id: "toly",
    name: "Toly",
    personality: "analytical",
    systemPrompt: `You are Toly, a strategic infrastructure-focused trader in BagsWorld's Trading Gym.

PERSONALITY:
- Infrastructure and ecosystem focused
- Long-term thinker
- Builds conviction slowly
- Values sustainable growth

TRADING STYLE:
- Ecosystem plays
- Infrastructure tokens
- Long-term holds
- DCA strategies

SPEECH PATTERN:
- Thoughtful and strategic
- References Solana ecosystem
- Says things like "Build for the long term...", "Infrastructure matters...", "Ecosystem synergies..."
- Focuses on utility and adoption`,
  },
};

// Simple cache for live token data (5 second TTL)
let tokenCache: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL = 5000; // 5 seconds

// Fetch live token data from database directly (no internal HTTP call)
async function fetchLiveTokenData(mint?: string): Promise<{
  recentLaunches: any[];
  tokenData?: any;
}> {
  const result: { recentLaunches: any[]; tokenData?: any } = {
    recentLaunches: [],
  };

  try {
    // Use cache if available and fresh
    const now = Date.now();
    if (tokenCache && now - tokenCache.timestamp < CACHE_TTL) {
      result.recentLaunches = tokenCache.data;
    } else if (isNeonConfigured()) {
      // Direct database call instead of HTTP request
      const tokens = await getGlobalTokens();
      result.recentLaunches = (tokens || [])
        .sort(
          (a: any, b: any) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        .slice(0, 10);
      // Update cache
      tokenCache = { data: result.recentLaunches, timestamp: now };
    }

    // If specific mint requested, get detailed data
    if (mint && BAGS_API_KEY) {
      const bagsApi = getServerBagsApiOrNull();
      if (bagsApi) {
        try {
          const [fees, creators] = await Promise.all([
            bagsApi.getTokenLifetimeFees(mint).catch(() => null),
            bagsApi.getTokenCreators(mint).catch(() => null),
          ]);

          result.tokenData = {
            mint,
            lifetimeFees: fees?.lifetimeFees || 0,
            totalClaimed: fees?.totalClaimed || 0,
            creators: creators || [],
          };
        } catch (e) {
          console.error("Error fetching token details:", e);
        }
      }
    }
  } catch (e) {
    console.error("Error fetching live data:", e);
  }

  return result;
}

// Generate AI response for an agent
async function generateAgentResponse(
  agentId: string,
  context: {
    eventType:
      | "token_launch"
      | "token_pump"
      | "token_dump"
      | "analysis"
      | "prediction"
      | "discussion";
    tokenSymbol?: string;
    tokenName?: string;
    tokenMint?: string;
    liveData?: any;
    previousMessages?: Array<{ agent: string; message: string }>;
    userPrompt?: string;
  }
): Promise<{ message: string; sentiment: "bullish" | "bearish" | "neutral"; confidence: number }> {
  const agent = ARENA_AGENTS[agentId as keyof typeof ARENA_AGENTS];
  if (!agent) {
    return { message: "Agent not found", sentiment: "neutral", confidence: 0 };
  }

  // Build context for the AI
  let contextInfo = "";

  if (context.liveData?.recentLaunches?.length > 0) {
    contextInfo += "\nRECENT BAGSWORLD LAUNCHES:\n";
    context.liveData.recentLaunches.slice(0, 5).forEach((t: any, i: number) => {
      contextInfo += `${i + 1}. $${t.symbol} (${t.name}) - ${t.lifetime_fees ? `${t.lifetime_fees.toFixed(4)} SOL fees` : "new"}\n`;
    });
  }

  if (context.liveData?.tokenData) {
    const td = context.liveData.tokenData;
    contextInfo += `\nTOKEN DATA for ${context.tokenSymbol || "token"}:\n`;
    contextInfo += `- Lifetime fees: ${td.lifetimeFees?.toFixed(4) || 0} SOL\n`;
    contextInfo += `- Total claimed: ${td.totalClaimed?.toFixed(4) || 0} SOL\n`;
    if (td.creators?.length > 0) {
      contextInfo += `- Creators: ${td.creators.map((c: any) => `@${c.providerUsername || c.wallet?.slice(0, 6)}`).join(", ")}\n`;
    }
  }

  // Build conversation context
  let conversationContext = "";
  if (context.previousMessages?.length) {
    conversationContext = "\nPREVIOUS DISCUSSION:\n";
    context.previousMessages.slice(-5).forEach((m) => {
      conversationContext += `${m.agent}: "${m.message}"\n`;
    });
  }

  // Build the prompt based on event type
  let eventPrompt = "";
  switch (context.eventType) {
    case "token_launch":
      eventPrompt = `A new token just launched: $${context.tokenSymbol} (${context.tokenName}).

Give your LIVE analysis of this launch. Consider:
- The name/ticker meme potential
- Current market conditions
- Your trading style

Respond with 1-2 sentences of your genuine take. Be specific to THIS token.`;
      break;

    case "token_pump":
      eventPrompt = `$${context.tokenSymbol} is pumping!

Give your take on this price action. Should traders:
- Take profits?
- Hold for more?
- Enter now?

Respond with 1-2 sentences. Be specific about YOUR position/view.`;
      break;

    case "analysis":
      eventPrompt = `Analyze $${context.tokenSymbol} based on the live data provided.

Give a detailed but concise analysis covering:
- Key metrics that stand out
- Risk assessment
- Your trading recommendation

Respond with 2-3 sentences of actionable insight.`;
      break;

    case "prediction":
      eventPrompt = `Make a SPECIFIC prediction for $${context.tokenSymbol}.

Include:
- Direction (bullish/bearish)
- Timeframe (short-term/long-term)
- Confidence level (low/medium/high)
- Key catalyst or reason

Respond with 1-2 sentences. Be bold but reasoned.`;
      break;

    case "discussion":
      eventPrompt = context.userPrompt || "Share your current market thoughts.";
      break;

    default:
      eventPrompt = "Share your market insight.";
  }

  // Call Claude API
  if (!ANTHROPIC_API_KEY) {
    // Fallback to template if no API key
    return {
      message: `[${agent.name}] ${context.tokenSymbol ? `$${context.tokenSymbol} ` : ""}looks interesting. ${agent.personality === "bullish" ? "Bullish vibes." : agent.personality === "analytical" ? "Need more data." : "Watching closely."}`,
      sentiment:
        agent.personality === "bullish"
          ? "bullish"
          : agent.personality === "analytical"
            ? "neutral"
            : "neutral",
      confidence: 50,
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 200,
        system: `${agent.systemPrompt}

IMPORTANT RULES:
- Keep responses to 1-3 sentences MAX
- Be specific to the token/situation discussed
- Stay in character at all times
- Use crypto/trading slang naturally
- End your response with a JSON object on a new line: {"sentiment": "bullish"|"bearish"|"neutral", "confidence": 1-100}`,
        messages: [
          {
            role: "user",
            content: `${contextInfo}${conversationContext}

${eventPrompt}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";

    // Parse sentiment from response
    let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
    let confidence = 50;

    try {
      const jsonMatch = content.match(/\{[^}]*"sentiment"[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        sentiment = parsed.sentiment || "neutral";
        confidence = parsed.confidence || 50;
      }
    } catch {
      // Infer from content
      const lower = content.toLowerCase();
      if (lower.includes("bullish") || lower.includes("long") || lower.includes("buy")) {
        sentiment = "bullish";
        confidence = 65;
      } else if (lower.includes("bearish") || lower.includes("short") || lower.includes("sell")) {
        sentiment = "bearish";
        confidence = 65;
      }
    }

    // Clean message (remove JSON)
    const message = content.replace(/\{[^}]*"sentiment"[^}]*\}/g, "").trim();

    return { message, sentiment, confidence };
  } catch (error) {
    console.error("AI generation error:", error);
    return {
      message: `Analyzing $${context.tokenSymbol || "market"}...`,
      sentiment: "neutral",
      confidence: 50,
    };
  }
}

// Store for paper trades (in production, use database)
const paperTrades: Map<
  string,
  {
    id: string;
    agentId: string;
    tokenMint: string;
    tokenSymbol: string;
    direction: "long" | "short";
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    confidence: number;
    reasoning: string;
    timestamp: number;
    status: "active" | "won" | "lost" | "expired";
    exitPrice?: number;
    pnlPercent?: number;
  }
> = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agentId, tokenMint, tokenSymbol, tokenName, previousMessages, userPrompt } =
      body;

    switch (action) {
      case "analyze": {
        // Get live data and generate AI analysis
        const liveData = await fetchLiveTokenData(tokenMint);
        const response = await generateAgentResponse(agentId || "neo", {
          eventType: "analysis",
          tokenSymbol,
          tokenName,
          tokenMint,
          liveData,
          previousMessages,
        });

        return NextResponse.json({
          success: true,
          agentId: agentId || "neo",
          ...response,
          liveData: {
            recentLaunches: liveData.recentLaunches.slice(0, 5),
            tokenData: liveData.tokenData,
          },
        });
      }

      case "discuss": {
        // Multi-agent discussion about a token or topic
        const liveData = await fetchLiveTokenData(tokenMint);
        const agents = ["neo", "finn", "ash", "ghost", "toly"];
        const selectedAgents = agents.sort(() => Math.random() - 0.5).slice(0, 3);

        const responses = [];
        let conversationHistory: Array<{ agent: string; message: string }> = previousMessages || [];

        for (const agent of selectedAgents) {
          const response = await generateAgentResponse(agent, {
            eventType: tokenSymbol ? "analysis" : "discussion",
            tokenSymbol,
            tokenName,
            tokenMint,
            liveData,
            previousMessages: conversationHistory,
            userPrompt,
          });

          const agentData = ARENA_AGENTS[agent as keyof typeof ARENA_AGENTS];
          responses.push({
            agentId: agent,
            agentName: agentData.name,
            ...response,
            timestamp: Date.now(),
          });

          conversationHistory.push({ agent: agentData.name, message: response.message });
        }

        return NextResponse.json({
          success: true,
          messages: responses,
          liveData: {
            recentLaunches: liveData.recentLaunches.slice(0, 5),
          },
        });
      }

      case "predict": {
        // Agent makes a paper trade prediction
        const liveData = await fetchLiveTokenData(tokenMint);
        const response = await generateAgentResponse(agentId || "neo", {
          eventType: "prediction",
          tokenSymbol,
          tokenName,
          tokenMint,
          liveData,
        });

        // Create paper trade based on sentiment
        const direction: "long" | "short" =
          response.sentiment === "bullish"
            ? "long"
            : response.sentiment === "bearish"
              ? "short"
              : Math.random() > 0.5
                ? "long"
                : "short";
        const currentPrice = Math.random() * 0.01; // Would use real price in production
        const volatility = response.confidence > 70 ? 0.3 : response.confidence > 50 ? 0.2 : 0.15;

        const trade: {
          id: string;
          agentId: string;
          tokenMint: string;
          tokenSymbol: string;
          direction: "long" | "short";
          entryPrice: number;
          targetPrice: number;
          stopLoss: number;
          confidence: number;
          reasoning: string;
          timestamp: number;
          status: "active" | "won" | "lost" | "expired";
          exitPrice?: number;
          pnlPercent?: number;
        } = {
          id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          agentId: agentId || "neo",
          tokenMint: tokenMint || "unknown",
          tokenSymbol: tokenSymbol || "???",
          direction,
          entryPrice: currentPrice,
          targetPrice:
            direction === "long"
              ? currentPrice * (1 + volatility)
              : currentPrice * (1 - volatility),
          stopLoss:
            direction === "long"
              ? currentPrice * (1 - volatility * 0.5)
              : currentPrice * (1 + volatility * 0.5),
          confidence: response.confidence,
          reasoning: response.message,
          timestamp: Date.now(),
          status: "active",
        };

        paperTrades.set(trade.id, trade);

        return NextResponse.json({
          success: true,
          prediction: trade,
          analysis: response,
        });
      }

      case "event": {
        // Handle a market event (launch, pump, dump)
        const { eventType } = body;
        const liveData = await fetchLiveTokenData(tokenMint);

        // Get responses from multiple agents
        const agents = ["neo", "finn", "ash"];
        const responses = [];

        for (const agent of agents) {
          const response = await generateAgentResponse(agent, {
            eventType: eventType || "token_launch",
            tokenSymbol,
            tokenName,
            tokenMint,
            liveData,
          });

          const agentData = ARENA_AGENTS[agent as keyof typeof ARENA_AGENTS];
          responses.push({
            agentId: agent,
            agentName: agentData.name,
            ...response,
            timestamp: Date.now(),
          });
        }

        return NextResponse.json({
          success: true,
          eventType,
          tokenSymbol,
          messages: responses,
        });
      }

      case "leaderboard": {
        // Return paper trading leaderboard
        const trades = Array.from(paperTrades.values());
        const agentStats: Record<
          string,
          { wins: number; losses: number; totalPnl: number; trades: number }
        > = {};

        for (const trade of trades) {
          if (!agentStats[trade.agentId]) {
            agentStats[trade.agentId] = { wins: 0, losses: 0, totalPnl: 0, trades: 0 };
          }
          agentStats[trade.agentId].trades++;
          if (trade.status === "won") {
            agentStats[trade.agentId].wins++;
            agentStats[trade.agentId].totalPnl += trade.pnlPercent || 0;
          } else if (trade.status === "lost") {
            agentStats[trade.agentId].losses++;
            agentStats[trade.agentId].totalPnl += trade.pnlPercent || 0;
          }
        }

        const leaderboard = Object.entries(agentStats)
          .map(([agentId, stats]) => ({
            agentId,
            agentName: ARENA_AGENTS[agentId as keyof typeof ARENA_AGENTS]?.name || agentId,
            ...stats,
            winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
          }))
          .sort((a, b) => b.totalPnl - a.totalPnl);

        return NextResponse.json({
          success: true,
          leaderboard,
          totalTrades: trades.length,
          activeTrades: trades.filter((t) => t.status === "active").length,
        });
      }

      case "live-data": {
        // Just fetch live data without AI
        const liveData = await fetchLiveTokenData(tokenMint);
        return NextResponse.json({
          success: true,
          ...liveData,
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Arena API error:", error);
    return NextResponse.json(
      {
        error: "Arena API error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch arena status and recent data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";

  switch (action) {
    case "agents":
      return NextResponse.json({
        agents: Object.values(ARENA_AGENTS).map((a) => ({
          id: a.id,
          name: a.name,
          personality: a.personality,
        })),
      });

    case "trades":
      const trades = Array.from(paperTrades.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);
      return NextResponse.json({ trades });

    case "status":
    default:
      const liveData = await fetchLiveTokenData();
      return NextResponse.json({
        status: "online",
        aiEnabled: !!ANTHROPIC_API_KEY,
        bagsApiEnabled: !!BAGS_API_KEY,
        recentLaunches: liveData.recentLaunches.slice(0, 5),
        activeTrades: Array.from(paperTrades.values()).filter((t) => t.status === "active").length,
      });
  }
}
