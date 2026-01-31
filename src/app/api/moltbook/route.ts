/**
 * Moltbook API Routes
 * Handles posting to Moltbook and fetching feed for display
 */

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import {
  postToBagsworld,
  getBagsyPosts,
  getTrendingPosts,
  getQueueStatus,
  queueMoltbookPost,
  type BagsyEvent,
  type BagsyEventType,
} from "@/lib/moltbook-agent";
import { getMoltbookOrNull } from "@/lib/moltbook-client";

// Rate limit configs
const RATE_LIMITS = {
  read: { limit: 60, windowMs: 60000 },    // 60/min for reading
  write: { limit: 5, windowMs: 60000 },    // 5/min for posting
};

/**
 * GET /api/moltbook
 * Fetch Moltbook feed for display in game UI
 *
 * Query params:
 * - source: "bagsworld" | "trending" (default: "bagsworld")
 * - limit: number (default: 10, max: 25)
 */
export async function GET(request: Request) {
  const clientIP = getClientIP(request);

  // Rate limit
  const rateLimit = await checkRateLimit(`moltbook:read:${clientIP}`, RATE_LIMITS.read);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
      { status: 429 }
    );
  }

  try {
    const url = new URL(request.url);
    const source = url.searchParams.get("source") || "bagsworld";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 25);

    // Check if Moltbook is configured
    const client = getMoltbookOrNull();
    if (!client) {
      return NextResponse.json({
        success: true,
        configured: false,
        posts: [],
        message: "Moltbook integration not configured",
      });
    }

    let posts;
    if (source === "trending") {
      posts = await getTrendingPosts(limit);
    } else {
      posts = await getBagsyPosts(limit);
    }

    // Get queue status
    const queue = getQueueStatus();

    return NextResponse.json({
      success: true,
      configured: true,
      posts,
      queue: {
        pending: queue.length,
        nextPostIn: Math.ceil(queue.nextPostIn / 1000), // seconds
      },
    });
  } catch (error) {
    console.error("[Moltbook API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Moltbook feed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/moltbook
 * Post an update to Moltbook
 *
 * Body:
 * - type: BagsyEventType
 * - data: Record<string, unknown>
 * - priority?: "low" | "medium" | "high"
 * - immediate?: boolean (bypass queue)
 */
export async function POST(request: Request) {
  const clientIP = getClientIP(request);

  // Rate limit
  const rateLimit = await checkRateLimit(`moltbook:write:${clientIP}`, RATE_LIMITS.write);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { type, data, priority, immediate } = body as {
      type: BagsyEventType;
      data: Record<string, unknown>;
      priority?: "low" | "medium" | "high";
      immediate?: boolean;
    };

    // Validate event type
    const validTypes: BagsyEventType[] = [
      "gm",
      "hype",
      "feature_spotlight",
      "character_spotlight",
      "zone_spotlight",
      "invite",
      "token_launch",
      "fee_claim",
      "community_love",
      "building_hype",
    ];

    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid data object" },
        { status: 400 }
      );
    }

    // Check if Moltbook is configured
    const client = getMoltbookOrNull();
    if (!client) {
      return NextResponse.json(
        { error: "Moltbook integration not configured. Set MOLTBOOK_API_KEY." },
        { status: 503 }
      );
    }

    const event: BagsyEvent = { type, data, priority };

    if (immediate) {
      // Try to post immediately
      const post = await postToBagsworld(event);

      if (post) {
        return NextResponse.json({
          success: true,
          posted: true,
          post: {
            id: post.id,
            title: post.title,
            submolt: post.submolt,
          },
        });
      } else {
        // Added to queue instead (rate limited)
        const queue = getQueueStatus();
        return NextResponse.json({
          success: true,
          posted: false,
          queued: true,
          message: `Rate limited. Added to queue. Next post in ${Math.ceil(queue.nextPostIn / 60000)} minutes.`,
          queuePosition: queue.length,
        });
      }
    } else {
      // Add to queue
      queueMoltbookPost(event);
      const queue = getQueueStatus();

      return NextResponse.json({
        success: true,
        queued: true,
        queuePosition: queue.length,
        nextPostIn: Math.ceil(queue.nextPostIn / 1000),
      });
    }
  } catch (error) {
    console.error("[Moltbook API] POST error:", error);
    return NextResponse.json(
      { error: "Failed to post to Moltbook" },
      { status: 500 }
    );
  }
}
