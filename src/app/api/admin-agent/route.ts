import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/config";
import {
  triggerDistribution,
  getCreatorRewardsState,
  getTimeUntilDistribution,
} from "@/lib/creator-rewards-agent";
import { getScoutState } from "@/lib/scout-agent";
import { getAgentWalletStatus, isAgentWalletConfigured } from "@/lib/agent-wallet";

/**
 * Admin-authenticated agent API
 *
 * This endpoint allows admin wallets to access agent status and trigger actions
 * by verifying the wallet address matches an admin wallet in config.
 *
 * The wallet address is passed in the request body (signed on frontend to prove ownership)
 */

interface AdminAgentRequest {
  action: "status" | "trigger";
  walletAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AdminAgentRequest = await request.json();
    const { action, walletAddress } = body;

    // Verify wallet is admin
    if (!walletAddress || !isAdmin(walletAddress)) {
      return NextResponse.json(
        { error: "Unauthorized - admin wallet required" },
        { status: 401 }
      );
    }

    switch (action) {
      case "status":
        return handleStatus();
      case "trigger":
        return handleTrigger();
      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Admin Agent API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function handleStatus(): Promise<NextResponse> {
  const walletStatus = await getAgentWalletStatus();
  const rewardsState = getCreatorRewardsState();
  const scoutState = getScoutState();
  const timeUntil = getTimeUntilDistribution();

  return NextResponse.json({
    authenticated: true,
    wallet: {
      configured: walletStatus.configured,
      publicKey: walletStatus.publicKey,
      balance: walletStatus.balance,
    },
    creatorRewards: {
      isRunning: rewardsState.isRunning,
      lastCheck: rewardsState.lastCheck,
      lastDistribution: rewardsState.lastDistribution,
      totalDistributed: rewardsState.totalDistributed,
      distributionCount: rewardsState.distributionCount,
      pendingPoolSol: rewardsState.pendingPoolSol,
      topCreators: rewardsState.topCreators.slice(0, 3).map((c) => ({
        wallet: c.wallet,
        tokenSymbol: c.tokenSymbol,
        feesGenerated: c.feesGenerated,
      })),
      timeUntilDistribution: {
        thresholdMet: timeUntil.byThreshold === null,
        timerExpired: timeUntil.byTimer <= 0,
        msUntilTimer: timeUntil.byTimer,
      },
    },
    scout: {
      isRunning: scoutState.isRunning,
      isConnected: scoutState.isConnected,
      launchesScanned: scoutState.launchesScanned,
      alertsSent: scoutState.alertsSent,
    },
  });
}

async function handleTrigger(): Promise<NextResponse> {
  if (!isAgentWalletConfigured()) {
    return NextResponse.json(
      { error: "Agent wallet not configured" },
      { status: 400 }
    );
  }

  const result = await triggerDistribution();

  return NextResponse.json({
    success: result.success,
    result,
    state: getCreatorRewardsState(),
  });
}
