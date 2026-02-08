// Oracle Predict API - Enter prediction with OP deduction
// Replaces /enter for OP-based markets while keeping backward compatibility
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveOracleMarkets,
  enterOraclePrediction,
  isNeonConfigured,
  initializeOracleTables,
  type OracleRoundDB,
} from "@/lib/neon";
import { getOrCreateUser, deductOP, addOP, claimFirstPredictionBonus } from "@/lib/op-economy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const { wallet, roundId, tokenMint, outcomeId } = body as {
    wallet?: string;
    roundId?: number;
    tokenMint?: string;
    outcomeId?: string;
  };

  if (!wallet) {
    return NextResponse.json({ success: false, error: "Missing wallet" }, { status: 400 });
  }

  if (!roundId) {
    return NextResponse.json({ success: false, error: "Missing roundId" }, { status: 400 });
  }

  if (!tokenMint && !outcomeId) {
    return NextResponse.json(
      { success: false, error: "Missing tokenMint or outcomeId" },
      { status: 400 }
    );
  }

  // Get or create user (auto-creates with 1000 OP if new)
  const user = await getOrCreateUser(wallet);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Failed to initialize user profile" },
      { status: 500 }
    );
  }

  // Find the specific round
  const allActive = await getActiveOracleMarkets();
  const round: OracleRoundDB | undefined = allActive.find((r) => r.id === roundId);

  if (!round) {
    return NextResponse.json(
      { success: false, error: "Market not found or not active" },
      { status: 400 }
    );
  }

  const entryCostOp = round.entryCostOp || 100;

  // Check OP balance
  if (user.opBalance < entryCostOp) {
    return NextResponse.json(
      {
        success: false,
        error: `Insufficient OP. Need ${entryCostOp} OP, have ${user.opBalance} OP`,
        opRequired: entryCostOp,
        opBalance: user.opBalance,
      },
      { status: 400 }
    );
  }

  // Deduct OP
  const deductResult = await deductOP(wallet, entryCostOp, "prediction_entry", roundId);
  if (!deductResult.success) {
    return NextResponse.json(
      { success: false, error: deductResult.error || "Failed to deduct OP" },
      { status: 400 }
    );
  }

  // Enter prediction
  const result = await enterOraclePrediction(round.id, wallet, tokenMint || "", {
    outcomeId: outcomeId || undefined,
    opWagered: entryCostOp,
  });

  if (!result.success) {
    // Refund OP on failure
    await addOP(wallet, entryCostOp, "prediction_entry", roundId);
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  // Award first prediction bonus if applicable
  await claimFirstPredictionBonus(wallet);

  // Award participation OP (+10)
  const participationResult = await addOP(wallet, 10, "participation", roundId);
  const actualParticipation = participationResult.success ? 10 : 0;

  // Report the actual balance from the last successful operation
  const finalBalance = participationResult.success
    ? participationResult.newBalance || (deductResult.newBalance || 0) + 10
    : deductResult.newBalance || 0;

  return NextResponse.json({
    success: true,
    message: "Prediction submitted!",
    roundId: round.id,
    tokenMint: tokenMint || undefined,
    outcomeId: outcomeId || undefined,
    opDeducted: entryCostOp,
    opParticipation: actualParticipation,
    newOpBalance: finalBalance,
    marketType: round.marketType || "price_prediction",
  });
}
