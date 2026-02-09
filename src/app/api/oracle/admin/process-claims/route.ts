// Oracle Admin Process Claims API - View and process pending claims
import { NextRequest, NextResponse } from "next/server";
import {
  getAllPendingOracleClaims,
  markOracleClaimProcessing,
  completeOracleClaim,
  failOracleClaim,
  isNeonConfigured,
} from "@/lib/neon";

export const dynamic = "force-dynamic";

// GET: List all pending claims
export async function GET(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  // Verify admin using Bearer token auth
  const authHeader = request.headers.get("Authorization");
  const expectedToken = process.env.ADMIN_API_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const pendingClaims = await getAllPendingOracleClaims();

  return NextResponse.json({
    success: true,
    count: pendingClaims.length,
    claims: pendingClaims.map((claim) => ({
      id: claim.id,
      wallet: claim.wallet,
      walletShort: `${claim.wallet.slice(0, 4)}...${claim.wallet.slice(-4)}`,
      amountLamports: claim.amountLamports.toString(),
      amountSol: Number(claim.amountLamports) / 1_000_000_000,
      status: claim.status,
      createdAt: claim.createdAt.toISOString(),
    })),
    totalSol: pendingClaims.reduce((sum, c) => sum + Number(c.amountLamports) / 1_000_000_000, 0),
  });
}

// POST: Process a specific claim
export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  const body = await request.json();
  const { adminWallet, claimId, action, txSignature, reason } = body;

  // Verify admin using Bearer token auth
  const authHeaderPost = request.headers.get("Authorization");
  const expectedTokenPost = process.env.ADMIN_API_SECRET;
  if (!expectedTokenPost || authHeaderPost !== `Bearer ${expectedTokenPost}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  if (!claimId) {
    return NextResponse.json({ success: false, error: "Missing claimId" }, { status: 400 });
  }

  // Mark as processing
  if (action === "processing") {
    const result = await markOracleClaimProcessing(claimId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    console.log(`[Oracle Admin] Claim #${claimId} marked as processing by ${adminWallet}`);

    return NextResponse.json({
      success: true,
      message: "Claim marked as processing",
      claimId,
    });
  }

  // Complete the claim
  if (action === "complete") {
    if (!txSignature) {
      return NextResponse.json(
        { success: false, error: "Missing txSignature for completion" },
        { status: 400 }
      );
    }

    const result = await completeOracleClaim(claimId, txSignature);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    console.log(`[Oracle Admin] Claim #${claimId} completed by ${adminWallet}: ${txSignature}`);

    return NextResponse.json({
      success: true,
      message: "Claim completed successfully",
      claimId,
      txSignature,
    });
  }

  // Fail the claim (return balance to user)
  if (action === "fail") {
    const failReason = reason || "Processing failed";
    const result = await failOracleClaim(claimId, failReason);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    console.log(`[Oracle Admin] Claim #${claimId} failed by ${adminWallet}: ${failReason}`);

    return NextResponse.json({
      success: true,
      message: "Claim marked as failed, balance returned to user",
      claimId,
      reason: failReason,
    });
  }

  return NextResponse.json(
    { success: false, error: "Invalid action. Use: processing, complete, or fail" },
    { status: 400 }
  );
}
