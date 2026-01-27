// Oracle Enter Prediction API - Submit a prediction
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveOracleRound,
  enterOraclePrediction,
  isNeonConfigured,
} from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json(
      { success: false, error: "Oracle not initialized" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { wallet, tokenMint } = body;

  if (!wallet || !tokenMint) {
    return NextResponse.json(
      { success: false, error: "Missing wallet or tokenMint" },
      { status: 400 }
    );
  }

  // Get active round
  const round = await getActiveOracleRound();
  if (!round) {
    return NextResponse.json(
      { success: false, error: "No active prediction round" },
      { status: 400 }
    );
  }

  // Enter prediction
  const result = await enterOraclePrediction(round.id, wallet, tokenMint);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Prediction submitted successfully",
    roundId: round.id,
    tokenMint,
  });
}
