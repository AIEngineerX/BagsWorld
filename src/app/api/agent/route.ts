import { NextRequest, NextResponse } from "next/server";
import {
  initCreatorRewardsAgent,
  startCreatorRewardsAgent,
  stopCreatorRewardsAgent,
  triggerDistribution,
  getCreatorRewardsState,
  updateCreatorRewardsConfig,
  getTimeUntilDistribution,
  type CreatorRewardsConfig,
} from "@/lib/creator-rewards-agent";
import {
  initScoutAgent,
  startScoutAgent,
  stopScoutAgent,
  getScoutState,
  updateScoutConfig,
  getRecentLaunches,
  blockCreator,
  unblockCreator,
  type ScoutConfig,
} from "@/lib/scout-agent";
import {
  getAgentWalletStatus,
  isAgentWalletConfigured,
} from "@/lib/agent-wallet";

interface AgentRequestBody {
  action:
    | "status" | "start" | "stop" | "trigger" | "config"
    | "rewards-status" | "rewards-start" | "rewards-stop" | "rewards-trigger" | "rewards-config"
    | "scout-status" | "scout-start" | "scout-stop" | "scout-config" | "scout-launches" | "scout-block" | "scout-unblock";
  config?: Partial<CreatorRewardsConfig>;
  rewardsConfig?: Partial<CreatorRewardsConfig>;
  scoutConfig?: Partial<ScoutConfig>;
  creatorAddress?: string;
  count?: number;
}

/**
 * Verify authorization for agent control
 *
 * SECURITY: Fail closed - if no secret is configured, reject all requests
 * in production environments. Only allow unauthenticated access in
 * explicit development mode.
 */
function isAuthorized(request: NextRequest): { authorized: boolean; error?: string } {
  const agentSecret = process.env.AGENT_SECRET;
  const isDevelopment = process.env.NODE_ENV === "development";

  // SECURITY FIX: Fail closed when no secret is configured in production
  if (!agentSecret) {
    if (isDevelopment) {
      // Allow in development for testing, but warn
      console.warn(
        "[Agent API] WARNING: AGENT_SECRET not set. " +
        "Allowing access in development mode only."
      );
      return { authorized: true };
    }

    // In production, reject if no secret is configured
    console.error(
      "[Agent API] SECURITY: AGENT_SECRET not configured. " +
      "Rejecting request. Set AGENT_SECRET environment variable."
    );
    return {
      authorized: false,
      error: "Agent API not configured. Contact administrator.",
    };
  }

  // Check bearer token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { authorized: false, error: "Missing or invalid Authorization header" };
  }

  const token = authHeader.slice(7);
  if (token !== agentSecret) {
    return { authorized: false, error: "Invalid authorization token" };
  }

  return { authorized: true };
}

export async function POST(request: NextRequest) {
  try {
    // Auth check for all actions
    const auth = isAuthorized(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const body: AgentRequestBody = await request.json();
    const { action, config, rewardsConfig, scoutConfig, creatorAddress, count } = body;

    switch (action) {
      // Creator Rewards actions (primary - aliased from old auto-claim names)
      case "status":
      case "rewards-status":
        return handleRewardsStatus();

      case "start":
      case "rewards-start":
        return handleRewardsStart();

      case "stop":
      case "rewards-stop":
        return handleRewardsStop();

      case "trigger":
      case "rewards-trigger":
        return handleRewardsTrigger();

      case "config":
      case "rewards-config":
        return handleRewardsConfig(config || rewardsConfig);

      // Scout actions
      case "scout-status":
        return handleScoutStatus();

      case "scout-start":
        return handleScoutStart();

      case "scout-stop":
        return handleScoutStop();

      case "scout-config":
        return handleScoutConfig(scoutConfig);

      case "scout-launches":
        return handleScoutLaunches(count);

      case "scout-block":
        return handleScoutBlock(creatorAddress);

      case "scout-unblock":
        return handleScoutUnblock(creatorAddress);

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    // Don't expose internal error details
    console.error("Agent API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// ============================================
// CREATOR REWARDS HANDLERS
// ============================================

async function handleRewardsStatus(): Promise<NextResponse> {
  const walletStatus = await getAgentWalletStatus();
  const rewardsState = getCreatorRewardsState();
  const timeUntil = getTimeUntilDistribution();

  return NextResponse.json({
    success: true,
    wallet: walletStatus,
    rewards: rewardsState,
    timeUntilDistribution: timeUntil,
  });
}

async function handleRewardsStart(): Promise<NextResponse> {
  if (!isAgentWalletConfigured()) {
    return NextResponse.json(
      { error: "Agent wallet not configured" },
      { status: 400 }
    );
  }

  const initialized = initCreatorRewardsAgent();
  if (!initialized) {
    return NextResponse.json(
      { error: "Failed to initialize creator rewards agent" },
      { status: 500 }
    );
  }

  const started = startCreatorRewardsAgent();
  if (!started) {
    return NextResponse.json(
      { error: "Failed to start creator rewards agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Creator rewards agent started",
    state: getCreatorRewardsState(),
  });
}

async function handleRewardsStop(): Promise<NextResponse> {
  stopCreatorRewardsAgent();

  return NextResponse.json({
    success: true,
    message: "Creator rewards agent stopped",
    state: getCreatorRewardsState(),
  });
}

async function handleRewardsTrigger(): Promise<NextResponse> {
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

function handleRewardsConfig(
  config?: Partial<CreatorRewardsConfig>
): NextResponse {
  if (!config) {
    // Return current config
    return NextResponse.json({
      success: true,
      config: getCreatorRewardsState().config,
    });
  }

  // Update config
  const newConfig = updateCreatorRewardsConfig(config);

  return NextResponse.json({
    success: true,
    config: newConfig,
  });
}

// ============================================
// SCOUT HANDLERS
// ============================================

function handleScoutStatus(): NextResponse {
  const scoutState = getScoutState();

  return NextResponse.json({
    success: true,
    scout: scoutState,
  });
}

function handleScoutStart(): NextResponse {
  const initialized = initScoutAgent();
  if (!initialized) {
    return NextResponse.json(
      { error: "Failed to initialize scout agent" },
      { status: 500 }
    );
  }

  const started = startScoutAgent();
  if (!started) {
    return NextResponse.json(
      { error: "Failed to start scout agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Scout agent started - scanning for new tokens",
    state: getScoutState(),
  });
}

function handleScoutStop(): NextResponse {
  stopScoutAgent();

  return NextResponse.json({
    success: true,
    message: "Scout agent stopped",
    state: getScoutState(),
  });
}

function handleScoutConfig(config?: Partial<ScoutConfig>): NextResponse {
  if (!config) {
    return NextResponse.json({
      success: true,
      config: getScoutState().config,
    });
  }

  const newConfig = updateScoutConfig(config);

  return NextResponse.json({
    success: true,
    config: newConfig,
  });
}

function handleScoutLaunches(count?: number): NextResponse {
  const launches = getRecentLaunches(count || 10);

  return NextResponse.json({
    success: true,
    launches,
    count: launches.length,
  });
}

function handleScoutBlock(creatorAddress?: string): NextResponse {
  if (!creatorAddress) {
    return NextResponse.json(
      { error: "creatorAddress required" },
      { status: 400 }
    );
  }

  blockCreator(creatorAddress);

  return NextResponse.json({
    success: true,
    message: `Blocked creator: ${creatorAddress}`,
    blockedCreators: getScoutState().config.filters.blockedCreators,
  });
}

function handleScoutUnblock(creatorAddress?: string): NextResponse {
  if (!creatorAddress) {
    return NextResponse.json(
      { error: "creatorAddress required" },
      { status: 400 }
    );
  }

  unblockCreator(creatorAddress);

  return NextResponse.json({
    success: true,
    message: `Unblocked creator: ${creatorAddress}`,
    blockedCreators: getScoutState().config.filters.blockedCreators,
  });
}

/**
 * GET endpoint for status check
 *
 * SECURITY: This endpoint requires authentication to prevent
 * information disclosure about agent wallet and status.
 */
export async function GET(request: NextRequest) {
  // Require authentication for status endpoint
  const auth = isAuthorized(request);
  if (!auth.authorized) {
    // Return minimal info for unauthenticated requests
    return NextResponse.json({
      configured: isAgentWalletConfigured(),
      authenticated: false,
      message: "Authentication required for full status",
    });
  }

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
      topCreators: rewardsState.topCreators.slice(0, 3),
      timeUntilDistribution: timeUntil,
    },
    scout: {
      isRunning: scoutState.isRunning,
      isConnected: scoutState.isConnected,
      launchesScanned: scoutState.launchesScanned,
      alertsSent: scoutState.alertsSent,
      recentLaunches: scoutState.recentLaunches.slice(0, 5),
    },
  });
}
