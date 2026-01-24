// API Route: Multi-Agent Dialogue - Proxies to Railway ElizaOS server
// Enables agents to have conversations with each other

import { NextRequest, NextResponse } from "next/server";

const ELIZAOS_SERVER =
  process.env.ELIZAOS_SERVER_URL || "https://bagsworld-production.up.railway.app";

interface DialogueRequest {
  participants: string[]; // Agent IDs to participate
  topic?: string; // Optional topic to discuss
  turns?: number; // Number of dialogue turns (default 3)
}

export async function POST(request: NextRequest) {
  try {
    const body: DialogueRequest = await request.json();
    const { participants, topic, turns = 3 } = body;

    if (!participants || participants.length < 2) {
      return NextResponse.json(
        { error: "At least 2 participants required for dialogue" },
        { status: 400 }
      );
    }

    console.log(`[dialogue] Starting dialogue between ${participants.join(", ")}`);

    // Route to Railway ElizaOS dialogue endpoint
    const response = await fetch(`${ELIZAOS_SERVER}/api/dialogue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participants,
        topic: topic || "the current state of BagsWorld",
        turns,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout for multi-turn dialogue
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`ElizaOS dialogue failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      dialogue: data.dialogue || data.messages || [],
      participants: data.participants || participants,
      topic: data.topic || topic,
    });
  } catch (error: any) {
    console.error("[dialogue] Error:", error.message);

    // Return a simulated dialogue as fallback
    return NextResponse.json({
      dialogue: [
        {
          agent: "system",
          message:
            "Multi-agent dialogue is temporarily unavailable. Try chatting with individual agents.",
          timestamp: Date.now(),
        },
      ],
      error: error.message,
      source: "fallback",
    });
  }
}

// GET endpoint to check dialogue status
export async function GET() {
  let dialogueAvailable = false;

  try {
    const response = await fetch(`${ELIZAOS_SERVER}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      dialogueAvailable = data.status === "healthy";
    }
  } catch {
    // Server not available
  }

  return NextResponse.json({
    status: dialogueAvailable ? "ready" : "unavailable",
    server: ELIZAOS_SERVER,
  });
}
