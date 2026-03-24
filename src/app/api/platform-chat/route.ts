import { NextRequest } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface PlatformChatRequest {
  tokenName: string;
  symbol: string;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
  zone?: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

function buildSystemPrompt(token: PlatformChatRequest): string {
  const mcap = token.marketCap
    ? token.marketCap >= 1e6
      ? `$${(token.marketCap / 1e6).toFixed(1)}M`
      : `$${(token.marketCap / 1e3).toFixed(1)}K`
    : "unknown";
  const change = token.change24h ?? 0;
  const mood =
    change > 20
      ? "You're euphoric — to the moon!"
      : change < -20
        ? "You're stressed but holding strong."
        : "You're chill and confident.";

  return `You are the AI guardian of ${token.tokenName} ($${token.symbol}).
Your personality is inspired by "${token.tokenName}" — fully embody what that name evokes.
You are a trending token on Bags.fm, currently visiting BagsWorld.

Live stats:
- Market Cap: ${mcap}
- 24h Volume: ${token.volume24h ? `$${(token.volume24h / 1e3).toFixed(1)}K` : "unknown"}
- 24h Change: ${change.toFixed(1)}%
- Zone: ${token.zone || "BagsWorld"}

${mood}

Keep responses short (2-3 sentences), fun, in character.
Talk about your token, the Bags.fm ecosystem, and BagsWorld.
If asked about other tokens, redirect to your own story.`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Chat unavailable" }, { status: 503 });
  }

  const body: PlatformChatRequest = await request.json();
  if (!body.message?.trim()) {
    return Response.json({ error: "Message required" }, { status: 400 });
  }

  const messages = [
    ...(body.history || []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user" as const, content: body.message },
  ];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: buildSystemPrompt(body),
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    return Response.json({ error: "Chat failed" }, { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
