/**
 * Bagsy Status API
 * Monitor Bagsy's posting activity and service health
 */

import { NextRequest, NextResponse } from "next/server";
import { getMoltbookAutonomousStatus, triggerPost } from "@/lib/moltbook-autonomous";
import { getMoltbookOrNull } from "@/lib/moltbook-client";
import { getMonitorStatus as getArenaMonitorStatus } from "@/lib/arena-moltbook-monitor";

export const dynamic = "force-dynamic";

/**
 * GET /api/bagsy - Get Bagsy's current status
 *
 * Response:
 * {
 *   "bagsy": {
 *     "name": "Bagsy",
 *     "handle": "@BagsyHypeBot",
 *     "platforms": ["moltbook", "twitter"]
 *   },
 *   "moltbook": {
 *     "configured": boolean,
 *     "serviceRunning": boolean,
 *     "postsToday": number,
 *     ...
 *   },
 *   "arena": {
 *     "monitorRunning": boolean,
 *     ...
 *   }
 * }
 */
export async function GET() {
  try {
    const moltbookStatus = getMoltbookAutonomousStatus();
    const moltbookClient = getMoltbookOrNull();

    let arenaStatus = {
      isRunning: false,
      lastCheckedPostId: null as string | null,
      processedCount: 0,
    };

    try {
      arenaStatus = getArenaMonitorStatus();
    } catch {
      // Arena monitor may not be running
    }

    const status = {
      bagsy: {
        name: "Bagsy",
        handle: "@BagsyHypeBot",
        description: "BagsWorld mascot - helps creators claim their fees",
        platforms: ["moltbook", "twitter"],
      },
      moltbook: {
        configured: moltbookClient !== null,
        serviceRunning: getMoltbookAutonomousStatus().isRunning,
        ...moltbookStatus,
      },
      arena: {
        monitorRunning: arenaStatus.isRunning,
        lastCheckedPostId: arenaStatus.lastCheckedPostId,
        processedPostsCount: arenaStatus.processedCount,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error("[BagsyAPI] Error getting status:", error);
    return NextResponse.json({ error: "Failed to get Bagsy status" }, { status: 500 });
  }
}

/**
 * POST /api/bagsy - Trigger a specific Bagsy action
 *
 * Body:
 * {
 *   "action": "trigger_post",
 *   "type": "gm" | "hype" | "invite" | "arena_invite" | "feature_spotlight" | "character_spotlight"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type } = body;

    if (action === "trigger_post") {
      if (!type) {
        return NextResponse.json({ error: "Missing 'type' parameter" }, { status: 400 });
      }

      const validTypes = [
        "gm",
        "hype",
        "invite",
        "arena_invite",
        "feature_spotlight",
        "character_spotlight",
      ];

      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }

      const result = await triggerPost(type);

      return NextResponse.json({
        action: "trigger_post",
        type,
        ...result,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("[BagsyAPI] Error processing action:", error);
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
