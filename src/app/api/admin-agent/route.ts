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
 * Security model:
 * - "status" action: Requires admin wallet address (read-only, low risk)
 * - "trigger" action: Requires AGENT_SECRET (moves funds, high risk)
 */

interface AdminAgentRequest {
  action: "status" | "trigger";
  walletAddress: string;
}

/**
 * Verify AGENT_SECRET for sensitive operations
 */
function verifyAgentSecret(request: NextRequest): boolean {
  const agentSecret = process.env.AGENT_SECRET;
  if (!agentSecret) return false;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  return authHeader.slice(7) === agentSecret;
}

export async function POST(request: NextRequest) {
  try {
    const body: AdminAgentRequest = await request.json();
    const { action, walletAddress } = body;

    // Verify wallet is admin for all actions
    if (!walletAddress || !isAdmin(walletAddress)) {
      return NextResponse.json(
        { error: "Unauthorized - admin wallet required" },
        { status: 401 }
      );
    }

    switch (action) {
      case "status":
        // Status is read-only, wallet auth is sufficient
        return handleStatus();
      case "trigger":
        // Trigger moves funds - require AGENT_SECRET
        if (!verifyAgentSecret(request)) {
          return NextResponse.json(
            { error: "AGENT_SECRET required for trigger action" },
            { status: 401 }
          );
        }
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
