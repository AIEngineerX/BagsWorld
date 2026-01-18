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
  getAgentWalletStatus,
  isAgentWalletConfigured,
} from "@/lib/agent-wallet";

interface AgentRequestBody {
  action: "status" | "start" | "stop" | "trigger" | "config";
  config?: {
    enabled?: boolean;
    minClaimThresholdSol?: number;
    checkIntervalMs?: number;
    maxClaimsPerRun?: number;
  };
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
    const { action, config } = body;

    switch (action) {
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

  return NextResponse.json({
    authenticated: true,
    wallet: {
      configured: walletStatus.configured,
      publicKey: walletStatus.publicKey,
      balance: walletStatus.balance,
    },
    agent: {
      isRunning: agentState.isRunning,
      lastCheck: agentState.lastCheck,
      lastClaim: agentState.lastClaim,
      totalClaimed: agentState.totalClaimed,
      claimCount: agentState.claimCount,
    },
  });
}
