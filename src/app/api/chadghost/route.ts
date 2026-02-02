/**
 * ChadGhost API
 * Control and monitor ChadGhost's alpha posting service
 */

import { NextRequest, NextResponse } from "next/server";
import {
  startChadGhostService,
  stopChadGhostService,
  getChadGhostServiceStatus,
  forceTick,
  isChadGhostServiceRunning,
} from "@/lib/chadghost-service";
import {
  runChadGhost,
  getChadGhostState,
  forcePost,
  createAlphaSubmolt,
} from "@/lib/chadghost-brain";
import { findAlpha, getBestAlpha, getAlphaStats } from "@/lib/alpha-finder";
import { 
  runEngagement, 
  getEngagementStats, 
  generateCallRecap,
  trackCall,
  generateWelcome,
  generateReply,
} from "@/lib/chadghost-engagement";

// ============================================================================
// GET - Status and info
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";

  switch (action) {
    case "status": {
      return NextResponse.json({
        success: true,
        service: getChadGhostServiceStatus(),
      });
    }

    case "alpha": {
      // Get current alpha without posting
      const alpha = await findAlpha();
      const best = alpha[0] || null;
      const stats = getAlphaStats();

      return NextResponse.json({
        success: true,
        alpha: {
          count: alpha.length,
          items: alpha.slice(0, 10), // Top 10
          best,
          stats,
        },
      });
    }

    case "preview": {
      // Preview what would be posted
      const best = await getBestAlpha();
      if (!best) {
        return NextResponse.json({
          success: true,
          preview: null,
          message: "No alpha available to post",
        });
      }

      return NextResponse.json({
        success: true,
        preview: {
          type: best.type,
          priority: best.priority,
          title: best.title,
          content: best.content,
          data: best.data,
          source: best.source,
        },
      });
    }

    case "state": {
      return NextResponse.json({
        success: true,
        state: getChadGhostState(),
      });
    }

    default:
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}

// ============================================================================
// POST - Control actions
// ============================================================================

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "start": {
      startChadGhostService();
      return NextResponse.json({
        success: true,
        message: "ChadGhost service started",
        status: getChadGhostServiceStatus(),
      });
    }

    case "stop": {
      stopChadGhostService();
      return NextResponse.json({
        success: true,
        message: "ChadGhost service stopped",
        status: getChadGhostServiceStatus(),
      });
    }

    case "tick": {
      // Force a tick (will post if conditions are met)
      const result = await forceTick();
      return NextResponse.json({
        success: true,
        result,
        status: getChadGhostServiceStatus(),
      });
    }

    case "post": {
      // Force post specific alpha type
      const { alphaType } = body;
      const result = await forcePost(alphaType);
      return NextResponse.json({
        success: result.posted,
        result,
        message: result.posted ? "Posted successfully" : result.reason,
      });
    }

    case "create-submolt": {
      // Create the bagsworld-alpha submolt
      const result = await createAlphaSubmolt();
      return NextResponse.json({
        success: result.success,
        error: result.error,
        message: result.success
          ? "Created m/bagsworld-alpha submolt"
          : `Failed: ${result.error}`,
      });
    }

    case "test-welcome": {
      // Test welcome message generation
      const { agentName } = body;
      const message = generateWelcome(agentName || "TestAgent");
      return NextResponse.json({
        success: true,
        message,
      });
    }

    case "test-reply": {
      // Test alpha reply generation
      const { isGoodAlpha } = body;
      const reply = generateReply(
        { id: "test", postId: "test", content: "test comment", author: "TestAgent", upvotes: 0, downvotes: 0, createdAt: new Date().toISOString() },
        isGoodAlpha !== false
      );
      return NextResponse.json({
        success: true,
        reply,
      });
    }

    case "find-alpha": {
      // Just find alpha without posting (for debugging)
      const alpha = await findAlpha();
      return NextResponse.json({
        success: true,
        count: alpha.length,
        alpha: alpha.slice(0, 20),
      });
    }

    case "engage": {
      // Force an engagement cycle (reply to comments, comment on trending, upvote)
      const result = await runEngagement();
      return NextResponse.json({
        success: true,
        engagement: result,
        stats: getEngagementStats(),
      });
    }

    case "call-recap": {
      // Generate a call recap post content
      const recap = generateCallRecap();
      return NextResponse.json({
        success: true,
        recap,
        stats: getEngagementStats().callStats,
      });
    }

    case "engagement-stats": {
      return NextResponse.json({
        success: true,
        stats: getEngagementStats(),
      });
    }

    default:
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}
