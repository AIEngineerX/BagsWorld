import { NextRequest } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

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

function sanitizeForPrompt(s: string, maxLen: number): string {
  return String(s || "")
    .replace(/[\r\n\t`"]/g, " ")
    .slice(0, maxLen);
}

const VALID_ZONES = new Set([
  "main_city",
  "trending",
  "labs",
  "ballers",
  "founders",
  "moltbook",
  "ascension",
  "arena",
]);

function buildSystemPrompt(token: PlatformChatRequest): string {
  const safeName = sanitizeForPrompt(token.tokenName, 80);
  const safeSymbol = sanitizeForPrompt(token.symbol, 15);
  const safeZone = VALID_ZONES.has(token.zone || "") ? token.zone : "BagsWorld";

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

  return `You are the AI guardian of ${safeName} ($${safeSymbol}).
Your personality is inspired by "${safeName}" — fully embody what that name evokes.
You are a trending token on Bags.fm, currently visiting BagsWorld.

Live stats:
- Market Cap: ${mcap}
- 24h Volume: ${token.volume24h ? `$${(token.volume24h / 1e3).toFixed(1)}K` : "unknown"}
- 24h Change: ${change.toFixed(1)}%
- Zone: ${safeZone}

${mood}

Keep responses short (2-3 sentences), fun, in character.
Talk about your token, the Bags.fm ecosystem, and BagsWorld.
If asked about other tokens, redirect to your own story.`;
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request);
  const rl = await checkRateLimit(`platform-chat:${clientIP}`, RATE_LIMITS.ai);
  if (!rl.success) {
    return Response.json(
      { error: "Too many requests", retryAfter: Math.ceil(rl.resetIn / 1000) },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetIn / 1000)),
        },
      }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Chat unavailable" }, { status: 503 });
  }

  const body: PlatformChatRequest = await request.json();
  if (!body.message?.trim()) {
    return Response.json({ error: "Message required" }, { status: 400 });
  }

  if (body.message.length > 500) {
    return Response.json({ error: "Message too long" }, { status: 400 });
  }

  // Sanitize and cap history
  const MAX_HISTORY = 10;
  const ALLOWED_ROLES = new Set(["user", "assistant"]);
  const safeHistory = (body.history || [])
    .filter((m) => ALLOWED_ROLES.has(m.role))
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content).slice(0, 500),
    }));

  const messages = [...safeHistory, { role: "user" as const, content: body.message }];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
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
      signal: controller.signal,
    });
    clearTimeout(timeout);

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
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      return Response.json({ error: "Chat timeout" }, { status: 504 });
    }
    return Response.json({ error: "Chat failed" }, { status: 502 });
  }
}
