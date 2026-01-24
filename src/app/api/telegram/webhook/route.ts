// Telegram Webhook API Route
// Handles incoming Telegram updates for BagsWorld AI agents
// Note: Full Telegram bot functionality is in eliza-agents standalone server

import { NextResponse } from "next/server";
import { getCharacter } from "@/lib/characters";

// Telegram types
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

// Verify webhook secret (optional security)
function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  const headerSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  return headerSecret === secret;
}

// Send message via Telegram API
async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
      parse_mode: "Markdown",
    }),
  });
}

// Generate response using Claude API
async function generateAgentResponse(
  apiKey: string,
  agentId: string,
  message: string
): Promise<string> {
  const character = getCharacter(agentId);
  const systemPrompt = character?.system || "You are a helpful assistant.";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!response.ok) {
    throw new Error("AI service error");
  }

  const data = await response.json();
  return data.content?.[0]?.text || "Unable to generate response";
}

// POST handler - receive Telegram updates
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    console.warn("[Telegram Webhook] Invalid secret token");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ ok: true, message: "Bot not configured" });
  }

  try {
    const update: TelegramUpdate = await request.json();
    const message = update.message;

    if (!message?.text || !message.chat) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text;

    // Handle /start command
    if (text.startsWith("/start")) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `Welcome to BagsWorld! I'm Finn, your guide to the ecosystem.\n\nSend me a message to chat!`,
        message.message_id
      );
      return NextResponse.json({ ok: true });
    }

    // Generate response
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const defaultAgent = process.env.TELEGRAM_DEFAULT_AGENT || "finn";

    let response: string;
    if (apiKey) {
      response = await generateAgentResponse(apiKey, defaultAgent, text);
    } else {
      response = "AI service not configured. Please contact the admin.";
    }

    const character = getCharacter(defaultAgent);
    await sendTelegramMessage(
      botToken,
      chatId,
      `*${character?.name || "Agent"}*:\n${response}`,
      message.message_id
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    // Return 200 to prevent Telegram retries
    return NextResponse.json({ ok: true });
  }
}

// GET handler - webhook info and setup
export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({
      configured: false,
      message: "TELEGRAM_BOT_TOKEN not set",
    });
  }

  if (action === "info") {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const result = await response.json();
    return NextResponse.json({
      configured: true,
      webhookInfo: result.ok ? result.result : null,
      error: result.ok ? null : result.description,
    });
  }

  if (action === "setup") {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
    const webhookUrl = `${baseUrl}/api/telegram/webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    };

    if (secret) {
      body.secret_token = secret;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return NextResponse.json({
      success: result.ok,
      webhookUrl,
      message: result.ok ? "Webhook set successfully" : result.description,
    });
  }

  if (action === "delete") {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: "POST",
    });
    const result = await response.json();
    return NextResponse.json({
      success: result.ok,
      message: result.ok ? "Webhook deleted" : result.description,
    });
  }

  return NextResponse.json({
    configured: true,
    endpoints: {
      webhook: "/api/telegram/webhook",
      info: "/api/telegram/webhook?action=info",
      setup: "/api/telegram/webhook?action=setup",
      delete: "/api/telegram/webhook?action=delete",
    },
    defaultAgent: process.env.TELEGRAM_DEFAULT_AGENT || "finn",
    note: "For full multi-agent Telegram features, use the eliza-agents standalone server",
  });
}
