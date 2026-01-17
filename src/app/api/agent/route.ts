import { NextResponse } from "next/server";
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

// Verify authorization for agent control
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const agentSecret = process.env.AGENT_SECRET;

  // If no secret configured, allow (for local dev)
  if (!agentSecret) {
    return true;
  }

  // Check bearer token
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === agentSecret;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    // Auth check for sensitive actions
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
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
    console.error("Agent API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
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
      { error: "Agent wallet not configured. Set AGENT_WALLET_PRIVATE_KEY in environment." },
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

// GET endpoint for simple status check
export async function GET() {
  const walletStatus = await getAgentWalletStatus();
  const agentState = getAutoClaimState();

  return NextResponse.json({
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
