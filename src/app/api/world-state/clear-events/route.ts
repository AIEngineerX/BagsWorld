import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/config";
import { clearFeedEvents } from "../route";

/**
 * POST /api/world-state/clear-events
 * Admin-only endpoint to clear all feed events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "Wallet address required" },
        { status: 400 }
      );
    }

    if (!isAdmin(wallet)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - admin access required" },
        { status: 403 }
      );
    }

    await clearFeedEvents();

    return NextResponse.json({
      success: true,
      message: "Feed events cleared successfully",
    });
  } catch (error) {
    console.error("[ClearEvents] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear events" },
      { status: 500 }
    );
  }
}
