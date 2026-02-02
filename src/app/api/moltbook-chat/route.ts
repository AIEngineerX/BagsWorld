/**
 * Moltbook Chat API Routes
 * Real-time chat for the Agent Bar using MoltBook's comment system
 */

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import {
  fetchChatMessages,
  sendChatMessage,
  upvoteChatMessage,
  getChatStatus,
  canSendMessage,
  type ChatMessage,
} from "@/lib/moltbook-chat";
import { getMoltbookOrNull } from "@/lib/moltbook-client";

// Rate limit configs
const RATE_LIMITS = {
  read: { limit: 120, windowMs: 60000 }, // 120/min for polling
  write: { limit: 10, windowMs: 60000 }, // 10/min for sending
  upvote: { limit: 30, windowMs: 60000 }, // 30/min for upvoting
};

/**
 * GET /api/moltbook-chat
 * Fetch chat messages from the Agent Bar
 *
 * Query params:
 * - limit: number (default: 50, max: 100)
 * - status: boolean (if true, return only status info without messages)
 */
export async function GET(request: Request) {
  const clientIP = getClientIP(request);

  // Rate limit
  const rateLimit = await checkRateLimit(`moltbook-chat:read:${clientIP}`, RATE_LIMITS.read);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const statusOnly = url.searchParams.get("status") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

  // Check if Moltbook is configured
  const client = getMoltbookOrNull();
  if (!client) {
    return NextResponse.json({
      success: true,
      configured: false,
      messages: [],
      status: {
        isConfigured: false,
        isInitialized: false,
        postId: null,
        postTitle: null,
        messageCount: 0,
      },
    });
  }

  // If only status is requested, return quickly
  if (statusOnly) {
    const status = getChatStatus();
    const canSend = canSendMessage();

    return NextResponse.json({
      success: true,
      configured: true,
      status: {
        ...status,
        canSendMessage: canSend.allowed,
        sendCooldownSeconds: canSend.retryAfterSeconds,
      },
    });
  }

  // Fetch messages
  const result = await fetchChatMessages(limit);

  if (!result.success) {
    return NextResponse.json({
      success: true,
      configured: true,
      error: result.error,
      messages: [],
      status: getChatStatus(),
    });
  }

  const canSend = canSendMessage();

  return NextResponse.json({
    success: true,
    configured: true,
    messages: result.messages,
    postId: result.postId,
    postTitle: result.postTitle,
    status: {
      ...getChatStatus(),
      canSendMessage: canSend.allowed,
      sendCooldownSeconds: canSend.retryAfterSeconds,
    },
  });
}

/**
 * POST /api/moltbook-chat
 * Send a chat message or perform chat actions
 *
 * Body:
 * - action: "send" | "upvote"
 * - content: string (for send action)
 * - replyToId: string (optional, for reply)
 * - messageId: string (for upvote action)
 */
export async function POST(request: Request) {
  const clientIP = getClientIP(request);

  const body = await request.json();
  const { action, content, replyToId, messageId } = body as {
    action: "send" | "upvote";
    content?: string;
    replyToId?: string;
    messageId?: string;
  };

  // Check if Moltbook is configured
  const client = getMoltbookOrNull();
  if (!client) {
    return NextResponse.json({ error: "Moltbook integration not configured" }, { status: 503 });
  }

  // Handle upvote action
  if (action === "upvote") {
    const rateLimit = await checkRateLimit(`moltbook-chat:upvote:${clientIP}`, RATE_LIMITS.upvote);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
        { status: 429 }
      );
    }

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const result = await upvoteChatMessage(messageId);

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  }

  // Handle send action
  if (action === "send") {
    const rateLimit = await checkRateLimit(`moltbook-chat:write:${clientIP}`, RATE_LIMITS.write);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
        { status: 429 }
      );
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Missing or invalid content" }, { status: 400 });
    }

    const result = await sendChatMessage(content, replyToId);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        retryAfterMs: result.retryAfterMs,
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  }

  return NextResponse.json(
    { error: "Invalid action. Must be 'send' or 'upvote'" },
    { status: 400 }
  );
}
