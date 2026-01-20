// Test endpoint to manually trigger autonomous dialogue
// GET /api/test-dialogue?topic=token_launch
// GET /api/test-dialogue?action=intelligent&topic=token_launch (uses Claude)

import { NextResponse } from "next/server";
import {
  startConversation,
  getActiveConversation,
  getConversationHistory,
  getCurrentLine,
} from "@/lib/autonomous-dialogue";

// Topic to participants mapping
const TOPIC_PARTICIPANTS: Record<string, string[]> = {
  token_launch: ["finn", "neo", "ghost"],
  fee_claim: ["ghost", "finn", "ash"],
  world_health: ["bags-bot", "ash", "finn"],
  distribution: ["ghost", "finn"],
  whale_alert: ["neo", "ghost", "finn"],
  price_pump: ["finn", "neo", "bags-bot"],
  price_dump: ["ghost", "neo", "ash"],
  general: ["finn", "ghost", "neo"],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") || "general";
  const action = searchParams.get("action") || "trigger";

  try {
    if (action === "status") {
      // Get current dialogue status
      const active = getActiveConversation();
      const history = getConversationHistory(5);
      const currentLine = getCurrentLine();

      return NextResponse.json({
        success: true,
        activeConversation: active ? {
          id: active.id,
          participants: active.participants,
          topic: active.topic,
          lineCount: active.lines.length,
          isActive: active.isActive,
        } : null,
        currentLine: currentLine ? {
          characterId: currentLine.characterId,
          characterName: currentLine.characterName,
          message: currentLine.message,
        } : null,
        recentConversations: history.map(c => ({
          id: c.id,
          participants: c.participants,
          topic: c.topic,
          lineCount: c.lines.length,
        })),
      });
    }

    // Use intelligent API directly for testing (calls Claude)
    if (action === "intelligent") {
      const participants = TOPIC_PARTICIPANTS[topic] || TOPIC_PARTICIPANTS.general;
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      const response = await fetch(`${baseUrl}/api/intelligent-dialogue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: participants.slice(0, 3),
          topic,
          context: {
            tokenSymbol: searchParams.get("symbol"),
            amount: searchParams.get("amount") ? parseFloat(searchParams.get("amount")!) : undefined,
          },
          lineCount: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          source: "Claude AI (intelligent-dialogue API)",
          ...data,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: `Intelligent API returned ${response.status}`,
        });
      }
    }

    // Default: Trigger a conversation using the dialogue engine
    const context = {
      tokenSymbol: searchParams.get("symbol") || "TEST",
      amount: parseFloat(searchParams.get("amount") || "1.5"),
      worldHealth: parseInt(searchParams.get("health") || "75"),
    };

    const conversation = await startConversation(
      { type: "random" },
      topic,
      context
    );

    if (!conversation) {
      return NextResponse.json({
        success: false,
        message: "Could not start conversation (cooldown or already active)",
      });
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        participants: conversation.participants,
        topic: conversation.topic,
        lines: conversation.lines.map(line => ({
          characterId: line.characterId,
          characterName: line.characterName,
          message: line.message,
          emotion: line.emotion,
        })),
      },
    });
  } catch (error) {
    console.error("[TestDialogue] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
