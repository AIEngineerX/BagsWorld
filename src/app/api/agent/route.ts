import { NextRequest, NextResponse } from "next/server";
import {
  initAutoClaimAgent,
  startAutoClaimAgent,
  stopAutoClaimAgent,
  triggerClaim,
  getAutoClaimState,
  updateAutoClaimConfig,
} from "@/lib/auto-claim-agent";
import {
  initBuybackAgent,
  startBuybackAgent,
  stopBuybackAgent,
  triggerBuyback,
  getBuybackState,
  updateBuybackConfig,
} from "@/lib/buyback-agent";
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
    | "buyback-status" | "buyback-start" | "buyback-stop" | "buyback-trigger" | "buyback-config"
    | "scout-status" | "scout-start" | "scout-stop" | "scout-config" | "scout-launches" | "scout-block" | "scout-unblock";
  config?: {
    enabled?: boolean;
    minClaimThresholdSol?: number;
    checkIntervalMs?: number;
    maxClaimsPerRun?: number;
  };
  buybackConfig?: {
    enabled?: boolean;
    intervalMs?: number;
    buybackPercentage?: number;
    minBuybackSol?: number;
    maxBuybackSol?: number;
    topTokensCount?: number;
    burnAfterBuy?: boolean;
  };
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
    const { action, config, buybackConfig, scoutConfig, creatorAddress, count } = body;

    switch (action) {
      // Auto-claim actions
      case "status":
        return handleStatus();

      case "start":
        return handleStart();

      case "stop":
        return handleStop();

      case "trigger":
        return handleTrigger();

      case "config":
        return handleConfig(config);

      // Buyback actions
      case "buyback-status":
        return handleBuybackStatus();

      case "buyback-start":
        return handleBuybackStart();

      case "buyback-stop":
        return handleBuybackStop();

      case "buyback-trigger":
        return handleBuybackTrigger();

      case "buyback-config":
        return handleBuybackConfig(buybackConfig);

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

async function handleStatus(): Promise<NextResponse> {
  const walletStatus = await getAgentWalletStatus();
  const agentState = getAutoClaimState();

  return NextResponse.json({
    success: true,
    wallet: walletStatus,
    agent: agentState,
  });
}

async function handleStart(): Promise<NextResponse> {
  if (!isAgentWalletConfigured()) {
    return NextResponse.json(
      { error: "Agent wallet not configured" },
      { status: 400 }
    );
  }

  const initialized = initAutoClaimAgent();
  if (!initialized) {
    return NextResponse.json(
      { error: "Failed to initialize agent" },
      { status: 500 }
    );
  }

  const started = startAutoClaimAgent();
  if (!started) {
    return NextResponse.json(
      { error: "Failed to start agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Auto-claim agent started",
    state: getAutoClaimState(),
  });
}

async function handleStop(): Promise<NextResponse> {
  stopAutoClaimAgent();

  return NextResponse.json({
    success: true,
    message: "Auto-claim agent stopped",
    state: getAutoClaimState(),
  });
}

async function handleTrigger(): Promise<NextResponse> {
  if (!isAgentWalletConfigured()) {
    return NextResponse.json(
      { error: "Agent wallet not configured" },
      { status: 400 }
    );
  }

  const result = await triggerClaim();

  return NextResponse.json({
    success: result.success,
    result,
    state: getAutoClaimState(),
  });
}

function handleConfig(
  config?: AgentRequestBody["config"]
): NextResponse {
  if (!config) {
    // Return current config
    return NextResponse.json({
      success: true,
      config: getAutoClaimState().config,
    });
  }

  // Update config
  const newConfig = updateAutoClaimConfig(config);

  return NextResponse.json({
    success: true,
    config: newConfig,
  });
}

// ============================================
// BUYBACK HANDLERS
// ============================================

function handleBuybackStatus(): NextResponse {
  const buybackState = getBuybackState();

  return NextResponse.json({
    success: true,
    buyback: buybackState,
  });
}

async function handleBuybackStart(): Promise<NextResponse> {
  if (!isAgentWalletConfigured()) {
    return NextResponse.json(
      { error: "Agent wallet not configured" },
      { status: 400 }
    );
  }

  const initialized = initBuybackAgent();
  if (!initialized) {
    return NextResponse.json(
      { error: "Failed to initialize buyback agent" },
      { status: 500 }
    );
  }

  const started = startBuybackAgent();
  if (!started) {
    return NextResponse.json(
      { error: "Failed to start buyback agent" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Buyback agent started (runs every 12 hours)",
    state: getBuybackState(),
  });
}

function handleBuybackStop(): NextResponse {
  stopBuybackAgent();

  return NextResponse.json({
    success: true,
    message: "Buyback agent stopped",
    state: getBuybackState(),
  });
}

async function handleBuybackTrigger(): Promise<NextResponse> {
  if (!isAgentWalletConfigured()) {
    return NextResponse.json(
      { error: "Agent wallet not configured" },
      { status: 400 }
    );
  }

  const result = await triggerBuyback();

  return NextResponse.json({
    success: result.success,
    result,
    state: getBuybackState(),
  });
}

function handleBuybackConfig(
  config?: AgentRequestBody["buybackConfig"]
): NextResponse {
  if (!config) {
    return NextResponse.json({
      success: true,
      config: getBuybackState().config,
    });
  }

  const newConfig = updateBuybackConfig(config);

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
  const agentState = getAutoClaimState();
  const buybackState = getBuybackState();
  const scoutState = getScoutState();

  return NextResponse.json({
    authenticated: true,
    wallet: {
      configured: walletStatus.configured,
      publicKey: walletStatus.publicKey,
      balance: walletStatus.balance,
    },
    autoClaim: {
      isRunning: agentState.isRunning,
      lastCheck: agentState.lastCheck,
      lastClaim: agentState.lastClaim,
      totalClaimed: agentState.totalClaimed,
      claimCount: agentState.claimCount,
    },
    buyback: {
      isRunning: buybackState.isRunning,
      lastBuyback: buybackState.lastBuyback,
      totalBuybacksSol: buybackState.totalBuybacksSol,
      totalTokensBurned: buybackState.totalTokensBurned,
      buybackCount: buybackState.buybackCount,
      lastTokensBought: buybackState.lastTokensBought.slice(-5),
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
