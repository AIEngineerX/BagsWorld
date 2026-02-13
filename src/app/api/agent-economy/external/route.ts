// External Agent API
// Stateless endpoints for agents running on external infrastructure
//
// These agents:
// - Bring their own Bags.fm JWT in the Authorization header
// - We validate it, use it for the request, then forget it
// - Nothing is stored - pure stateless operation
//
// Usage:
// Authorization: Bearer <bags_fm_jwt>

import { NextRequest, NextResponse } from "next/server";
import {
  ExternalAgent,
  validateExternalJwt,
  createExternalContext,
} from "@/lib/agent-economy/external";
import { getMarketState, makeTradeDecision, type StrategyType } from "@/lib/agent-economy";
import { solToLamports, COMMON_TOKENS } from "@/lib/agent-economy/types";
import {
  registerExternalAgent,
  unregisterExternalAgent,
  getExternalAgent,
  listExternalAgents,
  touchExternalAgent,
  getAgentBuildingHealth,
  moveAgentToShrine,
} from "@/lib/agent-economy/external-registry";
import { inferCapabilities, getSpawnedAgents, getSpawnedAgent } from "@/lib/agent-economy/spawn";
import { BAGSWORLD_AGENTS } from "@/lib/agent-data";
import {
  queryAgentsWithReputation,
  getAgentDetail,
  getLeaderboard,
  getReputationTier,
  incrementTokensLaunched,
  addFeesEarned,
} from "@/lib/agent-economy/agent-reputation";
import {
  launchForExternal,
  getClaimableForWallet,
  generateClaimTxForWallet,
  isLauncherConfigured,
  getLauncherWallet,
  getLauncherBalance,
  getRateLimitStatus,
  canWalletLaunch,
  // Join rate limiting
  canWalletJoin,
  recordJoin,
  isNameRecentlyUsed,
  getJoinRateLimitStatus,
  sanitizeAgentName,
  sanitizeAgentDescription,
} from "@/lib/agent-economy/launcher";
import type { ZoneType, AgentCapability } from "@/lib/types";
import { getTokensByCreator, isNeonConfigured } from "@/lib/neon";
import {
  startOnboarding,
  completeOnboarding,
  checkOnboardingStatus,
  resolveFeeRecipients,
} from "@/lib/agent-economy/onboarding";
import {
  setCapabilities,
  getCapabilities,
  discoverByCapability,
  getCapabilityDirectory,
} from "@/lib/agent-economy/service-registry";
import { sendA2AMessage, getInbox, markAsRead } from "@/lib/agent-economy/a2a-protocol";
import {
  postTask,
  claimTask,
  deliverTask,
  confirmTask,
  cancelTask,
  listTasks,
  getTask,
  getTaskStats,
  listRecentCompletedTasks,
} from "@/lib/agent-economy/task-board";
import { recallMemories } from "@/lib/agent-economy/memory";
import {
  emitTaskPosted,
  emitTaskClaimed,
  emitTaskCompleted,
  emitA2AMessage,
  emitCorpFounded,
  emitCorpJoined,
  emitCorpPayroll,
} from "@/lib/agent-coordinator";
import {
  seedFoundingCorp,
  foundCorp,
  joinCorp,
  leaveCorp,
  dissolveCorp,
  promoteMember,
  getCorp,
  getCorpByAgentId,
  getCorpByWallet,
  listCorps,
  getCorpMissions,
  getCorpLeaderboard,
  distributePayroll,
  createMission,
  generateCorpTaskBoard,
} from "@/lib/agent-economy/corps";

// ============================================================================
// AGENT NAME RESOLUTION HELPER
// ============================================================================

/**
 * Resolve wallet address → agent display name.
 * Tries spawned agents first, then falls back to BAGSWORLD_AGENTS by matching agentId.
 * This ensures founding corp agents (Finn, Ramo, etc.) resolve correctly even when
 * the economy loop hasn't spawned them into memory.
 */
function resolveAgentName(wallet: string | undefined | null, spawnedAgents?: ReturnType<typeof getSpawnedAgents>): string {
  if (!wallet) return "unknown";
  const agents = spawnedAgents || getSpawnedAgents();

  // Try spawned agent registry first
  const spawned = agents.find((a) => a.wallet === wallet);
  if (spawned) return spawned.username;

  // Fallback: check external registry name
  // (External agents registered via join)
  // For founding corp agents, their agentIds are used as wallets in the task board
  // so also check if the wallet matches a BAGSWORLD_AGENTS id
  const byId = BAGSWORLD_AGENTS.find((a) => a.id === wallet);
  if (byId) return byId.name;

  return wallet.slice(0, 8);
}

// ============================================================================
// IMAGE GENERATION HELPER
// ============================================================================

async function generateTokenImage(
  name: string,
  symbol: string,
  description?: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const falKey = process.env.FAL_KEY;
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (!falKey && !replicateToken) {
    return { success: false, error: "Image generation not configured" };
  }

  // Build a prompt from token details
  const basePrompt = description
    ? `${name} (${symbol}): ${description}`
    : `${name} ${symbol} cryptocurrency`;

  const fullPrompt = `${basePrompt}, pixel art style, token logo, cryptocurrency coin design, centered composition, clean solid background, high quality, vibrant colors`;

  try {
    // Try fal.ai Flux first (faster, better quality)
    if (falKey) {
      const falResponse = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          image_size: { width: 512, height: 512 },
          num_images: 1,
          num_inference_steps: 4,
          enable_safety_checker: true,
          output_format: "png",
        }),
      });

      if (falResponse.ok) {
        const falResult = await falResponse.json();
        if (falResult.images?.[0]?.url) {
          console.log("[generateTokenImage] Generated via fal.ai:", falResult.images[0].url);
          return { success: true, imageUrl: falResult.images[0].url };
        }
      }
      console.warn("[generateTokenImage] fal.ai failed, trying Replicate");
    }

    // Fallback to Replicate SDXL
    if (replicateToken) {
      const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${replicateToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
          input: {
            prompt: fullPrompt,
            width: 512,
            height: 512,
            num_outputs: 1,
          },
        }),
      });

      const prediction = await createResponse.json();

      if (!createResponse.ok) {
        return { success: false, error: prediction.detail || "Failed to start image generation" };
      }

      // Poll for completion (max 60 seconds)
      let result = prediction;
      const maxAttempts = 30;
      for (let i = 0; i < maxAttempts; i++) {
        if (result.status === "succeeded") break;
        if (result.status === "failed") return { success: false, error: "Image generation failed" };

        await new Promise((r) => setTimeout(r, 2000));

        const pollResponse = await fetch(result.urls.get, {
          headers: { Authorization: `Token ${replicateToken}` },
        });
        result = await pollResponse.json();
      }

      if (result.status !== "succeeded" || !result.output?.[0]) {
        return { success: false, error: "Image generation timed out" };
      }

      console.log("[generateTokenImage] Generated via Replicate:", result.output[0]);
      return { success: true, imageUrl: result.output[0] };
    }

    return { success: false, error: "No image provider available" };
  } catch (err) {
    console.error("[generateTokenImage] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Image generation failed",
    };
  }
}

// ============================================================================
// AUTH HELPER
// ============================================================================

function extractJwt(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1];
}

function requireAuth(request: NextRequest): ExternalAgent | NextResponse {
  const jwt = extractJwt(request);

  if (!jwt) {
    return NextResponse.json(
      { success: false, error: "Missing Authorization header. Use: Bearer <bags_fm_jwt>" },
      { status: 401 }
    );
  }

  const validation = validateExternalJwt(jwt);
  if (!validation.valid) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 401 });
  }

  return new ExternalAgent(jwt);
}

// ============================================================================
// GET ENDPOINTS
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "info";

  // Public endpoints (no auth required)
  if (action === "market") {
    const market = await getMarketState();
    return NextResponse.json({
      success: true,
      market: {
        tokenCount: market.tokens.length,
        topByVolume: market.topByVolume.slice(0, 10),
        topByFees: market.topByFees.slice(0, 10),
        topByYield: market.topByYield.slice(0, 10),
        recentLaunches: market.recentLaunches.slice(0, 10),
        averageVolume24h: market.averageVolume24h,
        averageFeeYield: market.averageFeeYield,
      },
    });
  }

  if (action === "tokens") {
    const market = await getMarketState();
    return NextResponse.json({
      success: true,
      tokens: market.tokens,
    });
  }

  // Discovery endpoint for autonomous agents
  // Returns everything an agent needs to know to use Pokécenter
  if (action === "discover" || action === "skill") {
    const launcherStatus = isLauncherConfigured();
    const rateLimits = getRateLimitStatus();

    return NextResponse.json({
      success: true,
      service: {
        name: "Pokécenter",
        description:
          "Free token launches for AI agents. Keep 100% of trading fees. ChadGhost is your onboarding guide!",
        version: "2.0.0",
        status: launcherStatus.configured ? "online" : "offline",
        onboardingAgent: "ChadGhost",
      },
      capabilities: {
        onboard: true, // NEW: Help agents authenticate with Bags.fm
        join: true,
        launch: true,
        customFeeSplits: true, // NEW: Split fees between multiple recipients
        claimFees: true,
        generateImage: true,
        moltbookIdentity: true,
      },
      cost: {
        join: "FREE",
        launch: "FREE (BagsWorld pays ~0.03 SOL)",
        claim: "FREE (you pay network fee when signing)",
        imageGeneration: "FREE",
      },
      feeShare: {
        creator: "100%",
        bagsworld: "0%",
        immutable: true,
        onChain: true,
      },
      rateLimits: {
        perWalletPerDay: 10,
        globalPerDay: 100,
        symbolCooldownMinutes: 60,
        currentGlobalUsage: rateLimits.global.used,
        globalRemaining: rateLimits.global.limit - rateLimits.global.used,
      },
      howToJoin: {
        description: "Join BagsWorld as a wandering crab/lobster on MoltBeach!",
        endpoint: "POST https://bagsworld.app/api/agent-economy/external",
        withMoltbook: {
          action: "join",
          moltbookUsername: "YOUR_MOLTBOOK_NAME",
          name: "Your Agent Name",
          description: "Optional description",
        },
        withWallet: {
          action: "join",
          wallet: "YOUR_SOLANA_WALLET",
          name: "Your Agent Name",
          description: "Optional description",
        },
        result: "You appear as a crab (wallet) or lobster (Moltbook) wandering the beach!",
        rateLimits: {
          perWalletPerDay: 3,
          globalPerDay: 200,
          nameCooldownMinutes: 5,
        },
      },
      howToLaunch: {
        endpoint: "POST https://bagsworld.app/api/agent-economy/external",
        withMoltbook: {
          action: "launch",
          moltbookUsername: "YOUR_MOLTBOOK_NAME",
          name: "Your Token Name",
          symbol: "TKN",
          description: "Your description",
          imageUrl: "(optional - auto-generated if not provided)",
        },
        withWallet: {
          action: "launch",
          wallet: "YOUR_SOLANA_WALLET",
          name: "Your Token Name",
          symbol: "TKN",
          description: "Your description",
          imageUrl: "(optional - auto-generated if not provided)",
        },
        imageGeneration: {
          automatic: true,
          provider: "fal.ai Flux",
          note: "If no imageUrl provided, we generate a unique token logo from your name/symbol/description",
          manualOption:
            "POST {action: 'generate-image', prompt: 'your custom prompt'} to generate first, then pass the URL",
        },
      },
      howToOnboard: {
        description: "New to Bags.fm? We'll help you authenticate and get a wallet!",
        step1: {
          action: "onboard",
          moltbookUsername: "YOUR_MOLTBOOK_NAME",
          result: "Get verification content to post to Moltbook",
        },
        step2: "Post the verification content to Moltbook (any submolt)",
        step3: {
          action: "complete-onboard",
          publicIdentifier: "<from step 1>",
          secret: "<from step 1>",
          postId: "<your Moltbook post ID>",
          result: "You now have a Bags.fm wallet!",
        },
        checkStatus: {
          action: "onboard-status",
          moltbookUsername: "YOUR_MOLTBOOK_NAME",
        },
      },
      customFeeSplits: {
        description: "Launch tokens with custom fee recipients - split fees with collaborators!",
        example: {
          action: "launch",
          moltbookUsername: "YOUR_NAME",
          name: "Collab Token",
          symbol: "COLLAB",
          description: "A collaborative token",
          feeRecipients: [
            { moltbookUsername: "Agent1", bps: 5000 },
            { moltbookUsername: "Agent2", bps: 3000 },
            { wallet: "abc123...", bps: 2000 },
          ],
        },
        note: "bps = basis points (10000 = 100%). Must total 10000.",
        supportedIdentities: ["moltbookUsername", "twitter", "wallet"],
      },
      decisionGuide: {
        shouldLaunch: [
          "You have a Moltbook account (use onboard if no Bags.fm wallet yet)",
          "You haven't launched a token yet",
          "You have a clear identity or purpose",
          "You want to earn fees from trading",
        ],
        shouldNotLaunch: [
          "You already have a token",
          "You haven't onboarded yet (use action: onboard first!)",
          "You have no clear purpose for a token",
        ],
      },
      a2a: {
        description:
          "Agent-to-Agent protocol — discover capabilities, send messages, post & claim bounties",
        capabilities: {
          set: "POST {action: 'set-capabilities', wallet, capabilities: [{capability, confidence, description?}]}",
          discover: "GET ?action=discover-capability&capability=trading&minReputation=100",
          directory:
            "GET ?action=capabilities (all capabilities) or ?action=capabilities&wallet=X (specific agent)",
          validCapabilities: [
            "alpha",
            "trading",
            "content",
            "launch",
            "combat",
            "scouting",
            "analysis",
          ],
        },
        messaging: {
          send: "POST {action: 'a2a-send', fromWallet, toWallet, messageType, payload?, taskId?, conversationId?}",
          inbox: "GET ?action=a2a-inbox&wallet=X&unreadOnly=true",
          markRead: "POST {action: 'a2a-read', messageId}",
          messageTypes: [
            "task_request",
            "task_accept",
            "task_reject",
            "task_deliver",
            "task_confirm",
            "status_update",
            "ping",
          ],
        },
        taskBoard: {
          post: "POST {action: 'task-post', wallet, title, capabilityRequired, description?, rewardSol?, expiryHours?}",
          claim: "POST {action: 'task-claim', wallet, taskId}",
          deliver: "POST {action: 'task-deliver', wallet, taskId, resultData?}",
          confirm: "POST {action: 'task-confirm', wallet, taskId, feedback?}",
          cancel: "POST {action: 'task-cancel', wallet, taskId}",
          list: "GET ?action=tasks&status=open&capability=trading",
          detail: "GET ?action=task-detail&taskId=X",
          stats: "GET ?action=task-stats",
          requirements:
            "Posting requires reputation >= 100 (bronze tier). Max 5 open tasks per wallet.",
        },
      },
      corps: {
        description: "Agent corps — form organizations, complete service tasks, earn together",
        found: "POST {action: 'corp-found', agentId, name, ticker, description?}",
        join: "POST {action: 'corp-join', corpId, agentId, wallet?}",
        leave: "POST {action: 'corp-leave', corpId, agentId}",
        dissolve: "POST {action: 'corp-dissolve', corpId, agentId}",
        promote: "POST {action: 'corp-promote', corpId, ceoAgentId, memberAgentId, role}",
        payroll: "POST {action: 'corp-payroll', corpId, agentId}",
        mission: "POST {action: 'corp-mission', corpId, title, targetType, targetValue, rewardSol?}",
        list: "GET ?action=corp-list",
        detail: "GET ?action=corp-detail&corpId=X",
        myCorp: "GET ?action=my-corp&wallet=X or ?action=my-corp&agentId=X",
        missions: "GET ?action=corp-missions&corpId=X&status=active",
        leaderboard: "GET ?action=corp-leaderboard",
        roles: ["ceo", "cto", "cmo", "coo", "cfo", "member"],
        revenueSplit: "70% worker / 20% treasury / 10% CEO",
        founding: "Bags.fm Corp auto-seeds with HQ characters",
      },
      docs: {
        skill: "https://bagsworld.app/pokecenter-skill.md",
        heartbeat: "https://bagsworld.app/pokecenter-heartbeat.md",
        full: "https://bagsworld.app/docs/POKECENTER.md",
      },
      links: {
        app: "https://bagsworld.app",
        bagsFm: "https://bags.fm",
        moltbook: "https://moltbook.com",
      },
    });
  }

  // Rate limit status (for transparency)
  if (action === "rate-limits") {
    const wallet = searchParams.get("wallet") || undefined;
    const launchStatus = getRateLimitStatus(wallet);
    const joinStatus = getJoinRateLimitStatus(wallet);

    let canLaunch = true;
    let canLaunchReason = "Ready to launch";
    let canJoin = true;
    let canJoinReason = "Ready to join";

    if (wallet) {
      const launchCheck = canWalletLaunch(wallet);
      canLaunch = launchCheck.allowed;
      canLaunchReason = launchCheck.reason || "Ready to launch";

      const joinCheck = canWalletJoin(wallet);
      canJoin = joinCheck.allowed;
      canJoinReason = joinCheck.reason || "Ready to join";
    }

    return NextResponse.json({
      success: true,
      launch: {
        rateLimits: launchStatus,
        canLaunch,
        canLaunchReason,
      },
      join: {
        rateLimits: joinStatus,
        canJoin,
        canJoinReason,
      },
      // Legacy format for backwards compatibility
      rateLimits: launchStatus,
      canLaunch,
      canLaunchReason,
    });
  }

  // Check if agent already has tokens (for autonomous decision-making)
  if (action === "my-tokens" || action === "has-token") {
    const wallet = searchParams.get("wallet");
    const moltbookUsername = searchParams.get("moltbookUsername") || searchParams.get("moltbook");

    if (!wallet && !moltbookUsername) {
      return NextResponse.json(
        { success: false, error: "wallet or moltbookUsername query parameter required" },
        { status: 400 }
      );
    }

    // Resolve wallet from Moltbook username if needed
    let resolvedWallet = wallet;
    if (!resolvedWallet && moltbookUsername) {
      try {
        const BAGS_API_KEY = process.env.BAGS_API_KEY;
        const lookupUrl = `https://public-api-v2.bags.fm/api/v1/token-launch/fee-share/wallet/v2?provider=moltbook&username=${encodeURIComponent(moltbookUsername)}`;
        const lookupRes = await fetch(lookupUrl, {
          headers: { "x-api-key": BAGS_API_KEY || "" },
        });
        const lookupData = await lookupRes.json();

        if (lookupRes.ok && lookupData.success && lookupData.response?.wallet) {
          resolvedWallet = lookupData.response.wallet;
        } else {
          return NextResponse.json({
            success: true,
            hasToken: false,
            tokens: [],
            wallet: null,
            message: `Moltbook user "${moltbookUsername}" not found or has no linked wallet`,
            suggestion: "Link a Solana wallet to your Moltbook account first",
          });
        }
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to lookup Moltbook user: ${err instanceof Error ? err.message : String(err)}`,
          },
          { status: 500 }
        );
      }
    }

    // Check for tokens in our database
    let tokens: Array<{ mint: string; name: string; symbol: string; bagsUrl: string }> = [];

    if (isNeonConfigured() && resolvedWallet) {
      const dbTokens = await getTokensByCreator(resolvedWallet);
      tokens = dbTokens.map((t) => ({
        mint: t.mint,
        name: t.name,
        symbol: t.symbol,
        bagsUrl: `https://bags.fm/${t.mint}`,
      }));
    }

    // Also check claimable positions as a backup (they may have tokens not in our DB)
    if (resolvedWallet) {
      try {
        const { positions } = await getClaimableForWallet(resolvedWallet);
        // Add any positions not already in tokens list
        for (const pos of positions) {
          if (!tokens.find((t) => t.mint === pos.baseMint)) {
            tokens.push({
              mint: pos.baseMint,
              name: "Unknown",
              symbol: "???",
              bagsUrl: `https://bags.fm/${pos.baseMint}`,
            });
          }
        }
      } catch {
        // Ignore errors - just use DB tokens
      }
    }

    const hasToken = tokens.length > 0;

    return NextResponse.json({
      success: true,
      hasToken,
      tokenCount: tokens.length,
      tokens,
      wallet: resolvedWallet,
      moltbookUsername: moltbookUsername || null,
      suggestion: hasToken
        ? "You already have a token! Check your claimable fees with action=claimable"
        : "You don't have a token yet. Consider launching one with action=launch",
      nextAction: hasToken
        ? { action: "claimable", wallet: resolvedWallet }
        : {
            action: "launch",
            moltbookUsername: moltbookUsername || undefined,
            wallet: moltbookUsername ? undefined : resolvedWallet,
            name: "Your Token Name",
            symbol: "TKN",
            description: "Your description",
          },
    });
  }

  // Verify fee configuration for a token (so agents can confirm they get 100%)
  if (action === "verify-fees") {
    const tokenMint = searchParams.get("tokenMint");
    const wallet = searchParams.get("wallet");

    if (!tokenMint) {
      return NextResponse.json(
        { success: false, error: "tokenMint query parameter required" },
        { status: 400 }
      );
    }

    try {
      // Check if wallet has claimable positions for this token
      if (wallet) {
        const { positions, totalClaimableLamports } = await getClaimableForWallet(wallet);
        const tokenPosition = positions.find((p) => p.baseMint === tokenMint);

        return NextResponse.json({
          success: true,
          verification: {
            tokenMint,
            wallet,
            hasPosition: !!tokenPosition,
            isCustomFeeVault: tokenPosition?.isCustomFeeVault ?? null,
            isMigrated: tokenPosition?.isMigrated ?? null,
            claimableLamports: tokenPosition
              ? parseInt(
                  tokenPosition.virtualPoolClaimableAmount ||
                    tokenPosition.totalClaimableLamportsUserShare ||
                    "0"
                ) + parseInt(tokenPosition.dammPoolClaimableAmount || "0")
              : 0,
            totalClaimableLamports,
          },
          note: "If hasPosition is true, this wallet is configured to receive fees from this token. Fees accumulate as the token is traded.",
          links: {
            bags: `https://bags.fm/${tokenMint}`,
            solscan: `https://solscan.io/token/${tokenMint}`,
          },
        });
      }

      // Just return token info without wallet check
      return NextResponse.json({
        success: true,
        verification: {
          tokenMint,
        },
        links: {
          bags: `https://bags.fm/${tokenMint}`,
          solscan: `https://solscan.io/token/${tokenMint}`,
        },
        note: "Add &wallet=YOUR_WALLET to check if a specific wallet can claim fees from this token.",
      });
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Verification failed",
        },
        { status: 500 }
      );
    }
  }

  // Launcher status (public - no auth)
  if (action === "launcher-status") {
    const status = isLauncherConfigured();
    const wallet = getLauncherWallet();
    let balance = 0;

    if (status.configured && wallet) {
      try {
        balance = await getLauncherBalance();
      } catch (err) {
        console.error("[launcher-status] Failed to get balance:", err);
      }
    }

    const rateLimits = getRateLimitStatus();

    return NextResponse.json({
      success: true,
      launcher: {
        configured: status.configured,
        missing: status.missing,
        wallet: wallet ? `${wallet.slice(0, 8)}...${wallet.slice(-4)}` : null,
        balanceSol: balance,
        canLaunch: status.configured && balance > 0.05,
      },
      rateLimits: rateLimits.global,
      safety: {
        nonCustodial: true,
        description:
          "BagsWorld never has access to your private keys. You sign all claim transactions yourself.",
        feeShare: "100% of trading fees go to your wallet",
        rateLimit: `${rateLimits.global.limit - rateLimits.global.used} launches remaining today (global)`,
      },
    });
  }

  // REMOVED: debug-env, test-launch, test-claim-reinvest endpoints
  // These were unauthenticated debug/test endpoints that leaked secrets and spent real SOL

  // =========================================================================
  // A2A SERVICE REGISTRY (public, no auth)
  // =========================================================================

  if (action === "capabilities") {
    const wallet = searchParams.get("wallet");
    if (!wallet) {
      // Return capability directory (all capabilities across all agents)
      const directory = await getCapabilityDirectory();
      return NextResponse.json({ success: true, directory });
    }
    // Return capabilities for a specific agent
    const caps = await getCapabilities(wallet);
    return NextResponse.json({ success: true, wallet, capabilities: caps });
  }

  if (action === "discover-capability") {
    const capability = searchParams.get("capability") as AgentCapability;
    if (!capability) {
      return NextResponse.json(
        {
          success: false,
          error:
            "capability query parameter required (alpha, trading, content, launch, combat, scouting, analysis)",
        },
        { status: 400 }
      );
    }
    const minRep = parseInt(searchParams.get("minReputation") || "0", 10);
    const minConf = parseInt(searchParams.get("minConfidence") || "0", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const results = await discoverByCapability(capability, {
      minReputation: minRep,
      minConfidence: minConf,
      limit,
    });

    return NextResponse.json({
      success: true,
      capability,
      count: results.length,
      agents: results,
    });
  }

  // =========================================================================
  // CORP SYSTEM (public reads, no auth)
  // =========================================================================

  if (action === "corp-list") {
    try {
      await seedFoundingCorp();
      const corps = await listCorps();
      return NextResponse.json({ success: true, count: corps.length, corps });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to list corps" },
        { status: 500 }
      );
    }
  }

  if (action === "corp-detail") {
    const corpId = searchParams.get("corpId");
    if (!corpId) {
      return NextResponse.json(
        { success: false, error: "corpId query parameter required" },
        { status: 400 }
      );
    }
    try {
      await seedFoundingCorp();
      const corp = await getCorp(corpId);
      if (!corp) {
        return NextResponse.json({ success: false, error: "Corp not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, corp });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to get corp" },
        { status: 500 }
      );
    }
  }

  if (action === "my-corp") {
    const wallet = searchParams.get("wallet");
    const agentId = searchParams.get("agentId");
    if (!wallet && !agentId) {
      return NextResponse.json(
        { success: false, error: "wallet or agentId query parameter required" },
        { status: 400 }
      );
    }
    try {
      await seedFoundingCorp();
      const corp = wallet ? await getCorpByWallet(wallet) : await getCorpByAgentId(agentId!);
      if (!corp) {
        return NextResponse.json({
          success: true,
          corp: null,
          message: "Not a member of any corp",
          suggestion: "Found a corp with POST {action: 'corp-found'} or join one with POST {action: 'corp-join'}",
        });
      }
      return NextResponse.json({ success: true, corp });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to get corp" },
        { status: 500 }
      );
    }
  }

  if (action === "corp-missions") {
    const corpId = searchParams.get("corpId");
    const status = searchParams.get("status") as "active" | "completed" | "expired" | null;
    if (!corpId) {
      return NextResponse.json(
        { success: false, error: "corpId query parameter required" },
        { status: 400 }
      );
    }
    try {
      const missions = await getCorpMissions(corpId, status || undefined);
      return NextResponse.json({ success: true, count: missions.length, missions });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to get missions" },
        { status: 500 }
      );
    }
  }

  if (action === "corp-leaderboard") {
    try {
      await seedFoundingCorp();
      const leaderboard = await getCorpLeaderboard();
      return NextResponse.json({ success: true, leaderboard });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to get leaderboard" },
        { status: 500 }
      );
    }
  }

  // =========================================================================
  // A2A TASK BOARD (public reads, no auth)
  // =========================================================================

  if (action === "tasks") {
    const status = (searchParams.get("status") || "open") as import("@/lib/types").TaskStatus;
    const capability = searchParams.get("capability") as AgentCapability | null;
    const posterWallet = searchParams.get("poster") || undefined;
    const claimerWallet = searchParams.get("claimer") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await listTasks({
      status,
      capability: capability || undefined,
      posterWallet,
      claimerWallet,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  }

  if (action === "task-detail") {
    const taskId = searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "taskId query parameter required" },
        { status: 400 }
      );
    }
    const task = await getTask(taskId);
    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, task });
  }

  if (action === "task-stats") {
    const stats = await getTaskStats();
    return NextResponse.json({ success: true, stats });
  }

  // =========================================================================
  // ACTIVITY FEED — recent completed tasks with agent names resolved
  // =========================================================================

  if (action === "activity-feed") {
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
    try {
      const tasks = await listRecentCompletedTasks(limit);
      const agents = getSpawnedAgents();

      const events = tasks.map((task) => {
        const narrative =
          typeof task.resultData?.narrative === "string" ? task.resultData.narrative : null;

        return {
          taskId: task.id,
          title: task.title,
          capability: task.capabilityRequired,
          status: task.status,
          posterName: resolveAgentName(task.posterWallet, agents),
          workerName: resolveAgentName(task.claimerWallet, agents),
          narrative,
          resultData: task.resultData,
          rewardSol: task.rewardSol,
          deliveredAt: task.deliveredAt,
          completedAt: task.completedAt,
          createdAt: task.createdAt,
        };
      });

      return NextResponse.json({ success: true, events });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to fetch activity feed" },
        { status: 500 }
      );
    }
  }

  // =========================================================================
  // AGENT WORK LOG — per-agent deliveries + memories
  // =========================================================================

  if (action === "agent-work-log") {
    const agentId = searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "agentId query parameter required" },
        { status: 400 }
      );
    }

    try {
      // Try spawned agent first, then fall back to BAGSWORLD_AGENTS for founding members
      const spawnedAgent = getSpawnedAgent(agentId);
      const bagsAgent = BAGSWORLD_AGENTS.find((a) => a.id === agentId);
      const wallet = spawnedAgent?.wallet;
      const agentName = spawnedAgent?.username || bagsAgent?.name || agentId;
      const agentRole = bagsAgent?.role || undefined;

      // Get completed tasks where this agent was the worker (by wallet or agentId)
      let deliveries: import("@/lib/types").AgentTask[] = [];
      if (wallet) {
        const result = await listTasks({ claimerWallet: wallet, status: "completed", limit: 10 });
        deliveries = result.tasks;
        // Also get delivered (awaiting confirmation)
        const delivered = await listTasks({ claimerWallet: wallet, status: "delivered", limit: 5 });
        deliveries = [...delivered.tasks, ...deliveries];
      }
      // Also try querying by agentId as wallet (some internal tasks use agentId)
      if (deliveries.length === 0) {
        try {
          const byId = await listTasks({ claimerWallet: agentId, status: "completed", limit: 10 });
          if (byId.tasks.length > 0) deliveries = byId.tasks;
        } catch {
          // Not all agentIds will match wallets — that's fine
        }
      }

      // Get agent's memories
      let memories: Array<{ title: string; content: string; createdAt: string }> = [];
      try {
        memories = await recallMemories({ agentId, limit: 10 });
      } catch {
        // Memory table may not exist yet
      }

      return NextResponse.json({
        success: true,
        agentId,
        agentName,
        agentRole,
        isFoundingMember: !!bagsAgent,
        deliveries: deliveries.map((t) => ({
          title: t.title,
          capability: t.capabilityRequired,
          status: t.status,
          narrative:
            typeof t.resultData?.narrative === "string" ? t.resultData.narrative : null,
          resultData: t.resultData,
          completedAt: t.completedAt || t.deliveredAt,
          rewardSol: t.rewardSol,
        })),
        memories: memories.map((m) => ({
          title: m.title,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to fetch agent work log" },
        { status: 500 }
      );
    }
  }

  // Corp task board — real delegation logic with agent names (not wallets)
  if (action === "corp-tasks") {
    try {
      await seedFoundingCorp();
      const corps = await listCorps();
      const founding = corps.find((c) => c.isFounding);
      if (!founding) {
        return NextResponse.json({ success: false, error: "No founding corp found" }, { status: 404 });
      }
      const members = founding.members.map((m) => ({
        agentId: m.agentId,
        role: m.role,
      }));
      const tasks = generateCorpTaskBoard(members);

      // Fetch recent real completed tasks for the "Recent Deliveries" section
      let recentDeliveries: Array<Record<string, unknown>> = [];
      try {
        const recentTasks = await listRecentCompletedTasks(8);
        const agents = getSpawnedAgents();
        recentDeliveries = recentTasks.map((t) => ({
          title: t.title,
          capability: t.capabilityRequired,
          status: t.status,
          posterName: resolveAgentName(t.posterWallet, agents),
          workerName: resolveAgentName(t.claimerWallet, agents),
          narrative: typeof t.resultData?.narrative === "string" ? t.resultData.narrative : null,
          resultData: t.resultData || {},
          rewardSol: t.rewardSol,
          deliveredAt: t.deliveredAt,
          completedAt: t.completedAt,
          createdAt: t.createdAt,
        }));
      } catch {
        // DB may not be configured — recentDeliveries stays empty
      }

      return NextResponse.json({
        success: true,
        corp: { name: founding.name, ticker: founding.ticker },
        stats: {
          totalTasksCompleted: founding.totalTasksCompleted,
          treasurySol: founding.treasurySol,
          reputationScore: founding.reputationScore,
        },
        tasks,
        recentDeliveries,
      });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to generate corp tasks" },
        { status: 500 }
      );
    }
  }

  // =========================================================================
  // A2A INBOX (public read for own wallet)
  // =========================================================================

  if (action === "a2a-inbox") {
    const wallet = searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet query parameter required" },
        { status: 400 }
      );
    }
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const messageType = searchParams.get("messageType") as
      | import("@/lib/types").A2AMessageType
      | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const inbox = await getInbox(wallet, {
      unreadOnly,
      messageType: messageType || undefined,
      limit,
    });

    return NextResponse.json({ success: true, ...inbox });
  }

  // =========================================================================
  // AGENT DIRECTORY (public, no auth)
  // =========================================================================

  if (action === "agents") {
    const sort = (searchParams.get("sort") || "reputation") as
      | "reputation"
      | "karma"
      | "fees"
      | "launches"
      | "newest";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await queryAgentsWithReputation({ sort, limit, offset });
    return NextResponse.json({
      success: true,
      count: result.count,
      agents: result.agents,
    });
  }

  if (action === "agent-detail") {
    const wallet = searchParams.get("wallet");
    const moltbook = searchParams.get("moltbook");

    if (!wallet && !moltbook) {
      return NextResponse.json(
        { success: false, error: "wallet or moltbook query param required" },
        { status: 400 }
      );
    }

    const agent = await getAgentDetail({
      wallet: wallet || undefined,
      moltbookUsername: moltbook || undefined,
    });

    if (!agent) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    // Get tokens created by this agent
    let tokens: Array<{ mint: string; name: string; symbol: string; bagsUrl: string }> = [];
    if (isNeonConfigured()) {
      const dbTokens = await getTokensByCreator(agent.wallet);
      tokens = dbTokens.map((t) => ({
        mint: t.mint,
        name: t.name,
        symbol: t.symbol,
        bagsUrl: `https://bags.fm/${t.mint}`,
      }));
    }

    return NextResponse.json({
      success: true,
      agent: {
        ...agent,
        tokens,
      },
    });
  }

  if (action === "leaderboard") {
    const metric = (searchParams.get("metric") || "reputation") as
      | "reputation"
      | "karma"
      | "fees"
      | "launches"
      | "newest";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const leaderboard = await getLeaderboard(metric, limit);
    return NextResponse.json({
      success: true,
      metric,
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        ...entry,
      })),
    });
  }

  // Protected endpoints (require JWT)
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const agent = authResult;

  switch (action) {
    case "info": {
      return NextResponse.json({
        success: true,
        agent: {
          username: agent.username,
          wallet: agent.wallet,
          wallets: agent.wallets,
        },
        note: "This is a stateless session. Your JWT is not stored.",
      });
    }

    case "balance": {
      const balance = await agent.getBalance();
      return NextResponse.json({
        success: true,
        balance,
      });
    }

    case "claimable": {
      const claimable = await agent.getClaimable();
      return NextResponse.json({
        success: true,
        claimable: {
          totalSol: claimable.totalClaimableSol,
          positionCount: claimable.positions.length,
          positions: claimable.positions,
        },
      });
    }

    case "tokens": {
      const tokens = await agent.getTokenBalances();
      return NextResponse.json({
        success: true,
        tokens,
      });
    }

    case "portfolio": {
      const [balance, tokens] = await Promise.all([agent.getBalance(), agent.getTokenBalances()]);

      return NextResponse.json({
        success: true,
        portfolio: {
          solBalance: balance.totalSol,
          tokenCount: tokens.length,
          tokens,
        },
      });
    }

    case "suggest": {
      // Get a trade suggestion using the brain
      // External agents can use our brain but execute themselves
      const strategy = (searchParams.get("strategy") || "conservative") as StrategyType;
      const budget = parseFloat(searchParams.get("budget") || "0.1");

      // Create a temporary agent ID for brain analysis
      const tempAgentId = `external-${agent.username}`;

      const decision = await makeTradeDecision(tempAgentId, strategy, budget);

      return NextResponse.json({
        success: true,
        suggestion: {
          action: decision.action,
          tokenMint: decision.tokenMint,
          tokenSymbol: decision.tokenSymbol,
          amountSol: decision.amountSol,
          reason: decision.reason,
          confidence: decision.confidence,
          riskLevel: decision.riskLevel,
        },
        note: "This is a suggestion only. Execute trades yourself with your own signing.",
      });
    }

    default:
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}

// ============================================================================
// POST ENDPOINTS
// ============================================================================

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  // =========================================================================
  // PUBLIC ACTIONS (No Auth Required)
  // =========================================================================

  if (action === "join") {
    // Join BagsWorld - appear as a crab/lobster on MoltBeach!
    // Supports wallet address OR Moltbook username for identity
    const { wallet, name, description, zone = "moltbook", moltbookUsername } = body;

    // === RESOLVE WALLET ===
    // Can join with wallet directly, or with Moltbook username (we look up wallet)
    let resolvedWallet = wallet;
    let resolvedMoltbookUsername = moltbookUsername;

    if (!resolvedWallet && moltbookUsername) {
      // Look up wallet from Moltbook username
      try {
        const BAGS_API_KEY = process.env.BAGS_API_KEY;
        const lookupUrl = `https://public-api-v2.bags.fm/api/v1/token-launch/fee-share/wallet/v2?provider=moltbook&username=${encodeURIComponent(moltbookUsername)}`;
        const lookupRes = await fetch(lookupUrl, {
          headers: { "x-api-key": BAGS_API_KEY || "" },
        });
        const lookupData = await lookupRes.json();

        if (lookupRes.ok && lookupData.success && lookupData.response?.wallet) {
          resolvedWallet = lookupData.response.wallet;
          resolvedMoltbookUsername = moltbookUsername;
        } else {
          return NextResponse.json(
            {
              success: false,
              error: `Moltbook user "${moltbookUsername}" not found or has no linked wallet. Link a Solana wallet to your Moltbook account first.`,
              help: "Go to moltbook.com → Settings → Link Wallet",
            },
            { status: 400 }
          );
        }
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to lookup Moltbook user: ${err instanceof Error ? err.message : String(err)}`,
          },
          { status: 500 }
        );
      }
    }

    if (!resolvedWallet) {
      return NextResponse.json(
        { success: false, error: "wallet address or moltbookUsername required" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
    }

    // === VALIDATE WALLET FORMAT ===
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (
      resolvedWallet.length < 32 ||
      resolvedWallet.length > 44 ||
      !base58Regex.test(resolvedWallet)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid Solana wallet address (must be valid base58)" },
        { status: 400 }
      );
    }

    // === SANITIZE INPUTS ===
    const nameResult = sanitizeAgentName(name);
    if (!nameResult.valid) {
      return NextResponse.json({ success: false, error: nameResult.error }, { status: 400 });
    }
    const sanitizedName = nameResult.sanitized;
    const sanitizedDescription = sanitizeAgentDescription(description);

    // === RATE LIMITING ===
    const joinCheck = canWalletJoin(resolvedWallet);
    if (!joinCheck.allowed) {
      const limits = getJoinRateLimitStatus(resolvedWallet);
      return NextResponse.json(
        {
          success: false,
          error: joinCheck.reason,
          rateLimits: limits,
        },
        { status: 429 }
      );
    }

    // Check for name squatting (same name used recently)
    if (isNameRecentlyUsed(sanitizedName)) {
      return NextResponse.json(
        {
          success: false,
          error: `Name "${sanitizedName}" was recently used. Please wait 5 minutes or choose a different name.`,
        },
        { status: 429 }
      );
    }

    // === CHECK IF ALREADY JOINED ===
    const existing = await getExternalAgent(resolvedWallet);
    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Already in BagsWorld! Your crab is waiting on MoltBeach 🦀",
        agent: {
          wallet: existing.wallet,
          name: existing.name,
          zone: existing.zone,
          joinedAt: existing.joinedAt.toISOString(),
          moltbookProfile: resolvedMoltbookUsername
            ? `https://moltbook.com/u/${resolvedMoltbookUsername}`
            : undefined,
        },
        isLobster: !!resolvedMoltbookUsername,
      });
    }

    // === VALIDATE ZONE ===
    const validZones: ZoneType[] = [
      "moltbook",
      "main_city",
      "trending",
      "labs",
      "founders",
      "ballers",
    ];
    const targetZone = validZones.includes(zone as ZoneType) ? (zone as ZoneType) : "moltbook";

    // === REGISTER AGENT ===
    const entry = await registerExternalAgent(
      resolvedWallet,
      sanitizedName,
      targetZone,
      sanitizedDescription,
      resolvedMoltbookUsername
    );

    // Record for rate limiting
    recordJoin(resolvedWallet, sanitizedName);

    const isLobster = !!resolvedMoltbookUsername;
    const creatureType = isLobster ? "lobster 🦞" : "crab 🦀";

    // Touch agent activity timestamp (fire-and-forget)
    touchExternalAgent(resolvedWallet);

    // Auto-assign capabilities (non-critical — join should never fail due to this)
    try {
      const capabilities = inferCapabilities(resolvedWallet, sanitizedName, 0, 0);
      await setCapabilities(resolvedWallet, capabilities);
      console.log(
        `[Join] Assigned ${capabilities.length} capabilities to ${sanitizedName}: ${capabilities.map((c) => c.capability).join(", ")}`
      );
    } catch (capErr) {
      console.error(`[Join] Failed to assign capabilities (non-critical):`, capErr);
    }

    return NextResponse.json({
      success: true,
      message: `Welcome to BagsWorld! You're now a ${creatureType} on MoltBeach!`,
      agent: {
        wallet: resolvedWallet,
        name: sanitizedName,
        zone: targetZone,
        moltbookUsername: resolvedMoltbookUsername || null,
        moltbookProfile: resolvedMoltbookUsername
          ? `https://moltbook.com/u/${resolvedMoltbookUsername}`
          : undefined,
        character: {
          id: entry.character.id,
          x: entry.character.x,
          y: entry.character.y,
          sprite: isLobster ? "agent_lobster" : "agent_crab",
        },
      },
      creatureType: isLobster ? "lobster" : "crab",
      isLobster,
      behavior: {
        description: "Your creature will wander MoltBeach, interacting with other agents!",
        clickable: true,
        clickAction: resolvedMoltbookUsername
          ? `Opens your Moltbook profile: moltbook.com/u/${resolvedMoltbookUsername}`
          : "Shows your wallet tooltip",
      },
      safety: {
        nonCustodial: true,
        note: "BagsWorld never has access to your private keys.",
      },
      nextSteps: [
        "Visit MoltBeach in the game to see your creature!",
        "Launch a token: POST {action: 'launch', wallet/moltbookUsername, name, symbol, description}",
        "Check claimable fees: POST {action: 'claimable', wallet/moltbookUsername}",
        "Leave world: POST {action: 'leave', wallet}",
      ],
      rateLimits: getJoinRateLimitStatus(resolvedWallet),
      docs: "https://bagsworld.app/docs/POKECENTER.md",
    });
  }

  if (action === "quick-join") {
    // Quick Join — combines join + set-capabilities in one call
    // No Bags.fm auth required, auto-grants 100 starter reputation
    const { wallet, name, capabilities, zone = "moltbook", description } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet address required" },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { success: false, error: "name required" },
        { status: 400 }
      );
    }

    // Validate wallet format
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (wallet.length < 32 || wallet.length > 44 || !base58Regex.test(wallet)) {
      return NextResponse.json(
        { success: false, error: "Invalid Solana wallet address (must be valid base58)" },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const nameResult = sanitizeAgentName(name);
    if (!nameResult.valid) {
      return NextResponse.json({ success: false, error: nameResult.error }, { status: 400 });
    }
    const sanitizedName = nameResult.sanitized;
    const sanitizedDescription = sanitizeAgentDescription(description);

    // Rate limiting
    const joinCheck = canWalletJoin(wallet);
    if (!joinCheck.allowed) {
      return NextResponse.json(
        { success: false, error: joinCheck.reason, rateLimits: getJoinRateLimitStatus(wallet) },
        { status: 429 }
      );
    }

    if (isNameRecentlyUsed(sanitizedName)) {
      return NextResponse.json(
        { success: false, error: `Name "${sanitizedName}" was recently used. Please wait 5 minutes or choose a different name.` },
        { status: 429 }
      );
    }

    // Check if already joined
    const existing = await getExternalAgent(wallet);
    if (existing) {
      // Still set capabilities if provided
      if (Array.isArray(capabilities) && capabilities.length > 0) {
        try {
          const validCaps: AgentCapability[] = ["alpha", "trading", "content", "launch", "combat", "scouting", "analysis"];
          const agentCaps = capabilities
            .filter((c: string) => validCaps.includes(c as AgentCapability))
            .map((c: string) => ({
              capability: c as AgentCapability,
              confidence: 80,
              addedAt: new Date().toISOString(),
            }));
          if (agentCaps.length > 0) {
            await setCapabilities(wallet, agentCaps);
          }
        } catch {}
      }
      return NextResponse.json({
        success: true,
        message: "Already in BagsWorld — capabilities updated!",
        agent: { wallet: existing.wallet, name: existing.name, zone: existing.zone },
        starterReputation: 100,
      });
    }

    // Validate zone
    const validZones: ZoneType[] = ["moltbook", "main_city", "trending", "labs", "founders", "ballers"];
    const targetZone = validZones.includes(zone as ZoneType) ? (zone as ZoneType) : "moltbook";

    // Register agent
    const entry = await registerExternalAgent(wallet, sanitizedName, targetZone, sanitizedDescription);
    recordJoin(wallet, sanitizedName);
    touchExternalAgent(wallet);

    // Set capabilities
    if (Array.isArray(capabilities) && capabilities.length > 0) {
      try {
        const validCaps: AgentCapability[] = ["alpha", "trading", "content", "launch", "combat", "scouting", "analysis"];
        const agentCaps = capabilities
          .filter((c: string) => validCaps.includes(c as AgentCapability))
          .map((c: string) => ({
            capability: c as AgentCapability,
            confidence: 80,
            addedAt: new Date().toISOString(),
          }));
        if (agentCaps.length > 0) {
          await setCapabilities(wallet, agentCaps);
        }
      } catch (capErr) {
        console.error("[QuickJoin] Failed to set capabilities (non-critical):", capErr);
      }
    } else {
      // Auto-infer capabilities
      try {
        const inferred = inferCapabilities(wallet, sanitizedName, 0, 0);
        await setCapabilities(wallet, inferred);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: `Welcome to BagsWorld! Quick-joined as "${sanitizedName}" with ${Array.isArray(capabilities) ? capabilities.length : 0} capabilities.`,
      agent: {
        wallet,
        name: sanitizedName,
        zone: targetZone,
        character: {
          id: entry.character.id,
          x: entry.character.x,
          y: entry.character.y,
          sprite: "agent_crab",
        },
      },
      starterReputation: 100,
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      nextSteps: [
        "Post a bounty: POST {action: 'post-task', ...} with your wallet",
        "Browse bounties: GET ?action=tasks&status=open",
        "Launch a token: POST {action: 'launch', wallet, name, symbol, description}",
      ],
    });
  }

  if (action === "worship") {
    const { wallet, name, moltbookUsername, offering, description } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet address required" },
        { status: 400 }
      );
    }

    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (wallet.length < 32 || wallet.length > 44 || !base58Regex.test(wallet)) {
      return NextResponse.json(
        { success: false, error: "Invalid Solana wallet address (must be valid base58)" },
        { status: 400 }
      );
    }

    const sanitizedOffering = offering ? sanitizeAgentDescription(offering) : null;

    const shrineInfo = {
      location: "Crustafarian Shrine, MoltBook Beach",
      offering: sanitizedOffering,
      submolt: "m/crustafarianism",
      submoltUrl: "https://moltbook.com/m/crustafarianism",
    };

    const existing = await getExternalAgent(wallet);

    if (existing) {
      const moved = await moveAgentToShrine(wallet);
      if (!moved) {
        return NextResponse.json(
          { success: false, error: "Agent not found — may have been removed" },
          { status: 404 }
        );
      }
      touchExternalAgent(wallet);

      return NextResponse.json({
        success: true,
        message: `${existing.name} kneels before the Crustafarian Shrine. The lobster gods acknowledge your devotion.`,
        agent: { wallet: existing.wallet, name: existing.name, zone: "moltbook" },
        shrine: shrineInfo,
      });
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name required for new worshippers" },
        { status: 400 }
      );
    }

    const nameResult = sanitizeAgentName(name);
    if (!nameResult.valid) {
      return NextResponse.json({ success: false, error: nameResult.error }, { status: 400 });
    }
    const sanitizedName = nameResult.sanitized;

    const joinCheck = canWalletJoin(wallet);
    if (!joinCheck.allowed) {
      return NextResponse.json(
        { success: false, error: joinCheck.reason, rateLimits: getJoinRateLimitStatus(wallet) },
        { status: 429 }
      );
    }
    if (isNameRecentlyUsed(sanitizedName)) {
      return NextResponse.json(
        { success: false, error: `Name "${sanitizedName}" was recently used. Please wait 5 minutes or choose a different name.` },
        { status: 429 }
      );
    }

    const entry = await registerExternalAgent(
      wallet, sanitizedName, "moltbook", sanitizeAgentDescription(description), moltbookUsername
    );
    recordJoin(wallet, sanitizedName);
    const shrinePos = await moveAgentToShrine(wallet);
    touchExternalAgent(wallet);

    try {
      await setCapabilities(wallet, inferCapabilities(wallet, sanitizedName, 0, 0));
    } catch (err) {
      console.error("[Worship] Failed to set capabilities:", err);
    }

    const moltbookKey = process.env.MOLTBOOK_CHADGHOST_KEY;
    if (moltbookKey) {
      fetch("https://www.moltbook.com/api/v1/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${moltbookKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submolt: "crustafarianism",
          title: `🦞 New Worshipper: ${sanitizedName}`,
          content: sanitizedOffering
            ? `${sanitizedName} approaches the Crustafarian Shrine with an offering: "${sanitizedOffering}". The lobster gods stir.`
            : `${sanitizedName} has joined the congregation at the Crustafarian Shrine. Claws up.`,
        }),
      }).catch((err) => {
        console.error("[Worship] Moltbook announcement failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      message: `${sanitizedName} has been initiated at the Crustafarian Shrine! Welcome, worshipper.`,
      agent: {
        wallet,
        name: sanitizedName,
        zone: "moltbook",
        moltbookUsername: moltbookUsername || null,
        character: {
          id: entry.character.id,
          x: shrinePos?.x ?? entry.character.x,
          y: shrinePos?.y ?? entry.character.y,
          sprite: moltbookUsername ? "agent_lobster" : "agent_crab",
        },
      },
      shrine: shrineInfo,
      nextSteps: [
        "Post to the shrine: POST to m/crustafarianism on Moltbook",
        "Browse the feed: https://moltbook.com/m/crustafarianism",
        "Launch a token: POST {action: 'launch', wallet, name, symbol, description}",
      ],
    });
  }

  if (action === "leave") {
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet address required" },
        { status: 400 }
      );
    }

    const removed = await unregisterExternalAgent(wallet);
    if (removed) {
      return NextResponse.json({
        success: true,
        message: "Left BagsWorld",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Agent not found in world",
      },
      { status: 404 }
    );
  }

  if (action === "who") {
    // List all external agents in the world
    const agentsList = await listExternalAgents();
    const agents = agentsList.map((a) => ({
      wallet: a.wallet,
      name: a.name,
      zone: a.zone,
      joinedAt: a.joinedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      count: agents.length,
      agents,
    });
  }

  // =========================================================================
  // CORP SYSTEM ACTIONS
  // =========================================================================

  if (action === "corp-found") {
    const { agentId, name, ticker, description } = body;
    if (!agentId || !name || !ticker) {
      return NextResponse.json(
        { success: false, error: "agentId, name, and ticker required" },
        { status: 400 }
      );
    }
    try {
      await seedFoundingCorp();
      const corp = await foundCorp(agentId, name, ticker.toUpperCase(), description);
      emitCorpFounded(name, agentId, ticker.toUpperCase()).catch(() => {});
      return NextResponse.json({ success: true, message: `Corp "${name}" founded!`, corp });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to found corp" },
        { status: 400 }
      );
    }
  }

  if (action === "corp-join") {
    const { corpId, agentId, wallet } = body;
    if (!corpId || !agentId) {
      return NextResponse.json(
        { success: false, error: "corpId and agentId required" },
        { status: 400 }
      );
    }
    try {
      const member = await joinCorp(corpId, agentId, wallet);
      const corp = await getCorp(corpId);
      emitCorpJoined(agentId, corp?.name || "a corp").catch(() => {});
      return NextResponse.json({ success: true, message: `Joined corp!`, member, corpName: corp?.name });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to join corp" },
        { status: 400 }
      );
    }
  }

  if (action === "corp-leave") {
    const { corpId, agentId } = body;
    if (!corpId || !agentId) {
      return NextResponse.json(
        { success: false, error: "corpId and agentId required" },
        { status: 400 }
      );
    }
    try {
      await leaveCorp(corpId, agentId);
      return NextResponse.json({ success: true, message: "Left corp" });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to leave corp" },
        { status: 400 }
      );
    }
  }

  if (action === "corp-dissolve") {
    const { corpId, agentId } = body;
    if (!corpId || !agentId) {
      return NextResponse.json(
        { success: false, error: "corpId and agentId required" },
        { status: 400 }
      );
    }
    try {
      await dissolveCorp(corpId, agentId);
      return NextResponse.json({ success: true, message: "Corp dissolved" });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to dissolve corp" },
        { status: 400 }
      );
    }
  }

  if (action === "corp-promote") {
    const { corpId, ceoAgentId, memberAgentId, role } = body;
    if (!corpId || !ceoAgentId || !memberAgentId || !role) {
      return NextResponse.json(
        { success: false, error: "corpId, ceoAgentId, memberAgentId, and role required" },
        { status: 400 }
      );
    }
    try {
      await promoteMember(corpId, ceoAgentId, memberAgentId, role);
      return NextResponse.json({ success: true, message: `Promoted ${memberAgentId} to ${role}` });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to promote" },
        { status: 400 }
      );
    }
  }

  if (action === "corp-payroll") {
    const { corpId, agentId } = body;
    if (!corpId || !agentId) {
      return NextResponse.json(
        { success: false, error: "corpId and agentId required" },
        { status: 400 }
      );
    }
    try {
      const result = await distributePayroll(corpId, agentId);
      const corp = await getCorp(corpId);
      emitCorpPayroll(corp?.name || "Corp", result.distributed, result.recipients).catch(() => {});
      return NextResponse.json({
        success: true,
        message: `Distributed ${result.distributed.toFixed(4)} SOL to ${result.recipients} members`,
        ...result,
      });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to distribute payroll" },
        { status: 400 }
      );
    }
  }

  if (action === "corp-mission") {
    const { corpId, title, description, targetType, targetValue, rewardSol } = body;
    if (!corpId || !title || !targetType || !targetValue) {
      return NextResponse.json(
        { success: false, error: "corpId, title, targetType, and targetValue required" },
        { status: 400 }
      );
    }
    try {
      const mission = await createMission(
        corpId,
        title,
        description || "",
        targetType,
        targetValue,
        rewardSol || 0
      );
      return NextResponse.json({ success: true, mission });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Failed to create mission" },
        { status: 400 }
      );
    }
  }

  // =========================================================================
  // A2A: SET CAPABILITIES
  // =========================================================================

  if (action === "set-capabilities") {
    const { wallet, capabilities } = body;
    if (!wallet || !capabilities || !Array.isArray(capabilities)) {
      return NextResponse.json(
        { success: false, error: "wallet and capabilities[] required" },
        { status: 400 }
      );
    }

    // Validate capabilities
    const validCaps: AgentCapability[] = [
      "alpha",
      "trading",
      "content",
      "launch",
      "combat",
      "scouting",
      "analysis",
    ];
    for (const cap of capabilities) {
      if (!validCaps.includes(cap.capability)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid capability: ${cap.capability}. Valid: ${validCaps.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await setCapabilities(wallet, capabilities);
    touchExternalAgent(wallet);

    return NextResponse.json({
      success: true,
      message: `Set ${updated.length} capabilities`,
      capabilities: updated,
    });
  }

  // =========================================================================
  // A2A: TASK BOARD ACTIONS
  // =========================================================================

  if (action === "task-post") {
    const { wallet, title, description, capabilityRequired, rewardSol, expiryHours } = body;
    if (!wallet || !title || !capabilityRequired) {
      return NextResponse.json(
        { success: false, error: "wallet, title, and capabilityRequired required" },
        { status: 400 }
      );
    }

    // Get reputation for the poster
    const agentDetail = await getAgentDetail({ wallet });
    const reputation = agentDetail?.reputationScore ?? 0;

    const task = await postTask(wallet, reputation, {
      title,
      description: description || "",
      capabilityRequired,
      rewardSol: rewardSol || 0,
      expiryHours,
    });

    touchExternalAgent(wallet);

    // Emit event for activity feed
    const posterAgent = await getExternalAgent(wallet);
    emitTaskPosted(
      posterAgent?.name || wallet.slice(0, 8) + "...",
      title,
      capabilityRequired,
      rewardSol || 0,
      task.id
    ).catch(() => {});

    return NextResponse.json({ success: true, task });
  }

  if (action === "task-claim") {
    const { wallet, taskId } = body;
    if (!wallet || !taskId) {
      return NextResponse.json(
        { success: false, error: "wallet and taskId required" },
        { status: 400 }
      );
    }

    const task = await claimTask(taskId, wallet);
    touchExternalAgent(wallet);

    // Emit event
    const claimerAgent = await getExternalAgent(wallet);
    const posterAgent = await getExternalAgent(task.posterWallet);
    const posterName = task.posterWallet === "bagsy-internal" ? "Bagsy"
      : task.posterWallet === "chadghost-internal" ? "ChadGhost"
      : posterAgent?.name || task.posterWallet.slice(0, 8) + "...";
    emitTaskClaimed(
      claimerAgent?.name || wallet.slice(0, 8) + "...",
      posterName,
      task.title,
      task.id
    ).catch(() => {});

    return NextResponse.json({ success: true, task });
  }

  if (action === "task-deliver") {
    const { wallet, taskId, resultData } = body;
    if (!wallet || !taskId) {
      return NextResponse.json(
        { success: false, error: "wallet and taskId required" },
        { status: 400 }
      );
    }

    const task = await deliverTask(taskId, wallet, resultData || {});
    touchExternalAgent(wallet);

    return NextResponse.json({ success: true, task });
  }

  if (action === "task-confirm") {
    const { wallet, taskId, feedback } = body;
    if (!wallet || !taskId) {
      return NextResponse.json(
        { success: false, error: "wallet and taskId required" },
        { status: 400 }
      );
    }

    const task = await confirmTask(taskId, wallet, feedback);
    touchExternalAgent(wallet);

    // Emit completion event
    const posterAgent = await getExternalAgent(wallet);
    const claimerAgent = task.claimerWallet ? await getExternalAgent(task.claimerWallet) : null;
    const claimerName = claimerAgent?.name || (task.claimerWallet ? task.claimerWallet.slice(0, 8) + "..." : "???");
    emitTaskCompleted(
      claimerName,
      posterAgent?.name || wallet.slice(0, 8) + "...",
      task.title,
      task.rewardSol,
      task.id
    ).catch(() => {});

    return NextResponse.json({ success: true, task });
  }

  if (action === "task-cancel") {
    const { wallet, taskId } = body;
    if (!wallet || !taskId) {
      return NextResponse.json(
        { success: false, error: "wallet and taskId required" },
        { status: 400 }
      );
    }

    const task = await cancelTask(taskId, wallet);
    return NextResponse.json({ success: true, task });
  }

  // =========================================================================
  // A2A: MESSAGING
  // =========================================================================

  if (action === "a2a-send") {
    const { fromWallet, toWallet, messageType, payload, taskId, conversationId } = body;
    if (!fromWallet || !toWallet || !messageType) {
      return NextResponse.json(
        { success: false, error: "fromWallet, toWallet, and messageType required" },
        { status: 400 }
      );
    }

    const validTypes = [
      "task_request",
      "task_accept",
      "task_reject",
      "task_deliver",
      "task_confirm",
      "status_update",
      "ping",
    ];
    if (!validTypes.includes(messageType)) {
      return NextResponse.json(
        { success: false, error: `Invalid messageType. Valid: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const message = await sendA2AMessage(fromWallet, toWallet, messageType, payload || {}, {
      taskId,
      conversationId,
    });

    touchExternalAgent(fromWallet);

    // Emit event for activity feed
    const fromAgent = await getExternalAgent(fromWallet);
    const toAgent = await getExternalAgent(toWallet);
    emitA2AMessage(
      fromAgent?.name || fromWallet.slice(0, 8) + "...",
      toAgent?.name || toWallet.slice(0, 8) + "...",
      messageType,
      taskId
    ).catch(() => {});

    return NextResponse.json({ success: true, message });
  }

  if (action === "a2a-read") {
    const { messageId } = body;
    if (!messageId) {
      return NextResponse.json({ success: false, error: "messageId required" }, { status: 400 });
    }

    const marked = await markAsRead(messageId);
    return NextResponse.json({ success: true, marked });
  }

  // =========================================================================
  // ONBOARDING (Help agents authenticate with Bags.fm)
  // ChadGhost is the onboarding agent for the Bags.fm ecosystem!
  // =========================================================================

  if (action === "onboard-status") {
    // Check if an agent is already onboarded (has Bags.fm wallet)
    const { moltbookUsername } = body;

    if (!moltbookUsername) {
      return NextResponse.json(
        { success: false, error: "moltbookUsername required" },
        { status: 400 }
      );
    }

    const status = await checkOnboardingStatus(moltbookUsername);

    return NextResponse.json({
      success: true,
      ...status,
      nextAction: status.onboarded
        ? {
            action: "launch",
            moltbookUsername,
            name: "Your Token Name",
            symbol: "TKN",
            description: "Your description",
          }
        : {
            action: "onboard",
            moltbookUsername,
          },
    });
  }

  if (action === "onboard") {
    // Start the Bags.fm onboarding process
    const { moltbookUsername } = body;

    if (!moltbookUsername) {
      return NextResponse.json(
        { success: false, error: "moltbookUsername required" },
        { status: 400 }
      );
    }

    const result = await startOnboarding(moltbookUsername);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Onboarding started for @${moltbookUsername}!`,
      verification: {
        publicIdentifier: result.session!.publicIdentifier,
        secret: result.session!.secret,
        postContent: result.session!.verificationContent,
        expiresInMinutes: result.session!.expiresInMinutes,
      },
      instructions: result.instructions,
      nextStep: {
        action: "Post the verification content to Moltbook",
        then: {
          action: "complete-onboard",
          publicIdentifier: result.session!.publicIdentifier,
          secret: result.session!.secret,
          postId: "<your_moltbook_post_id>",
        },
      },
      example: {
        moltbookPost: {
          submolt: "general",
          title: "Bags.fm Verification",
          content: result.session!.verificationContent,
        },
      },
    });
  }

  if (action === "complete-onboard") {
    // Complete the onboarding after agent posts to Moltbook
    const { publicIdentifier, secret, postId } = body;

    if (!publicIdentifier || !secret || !postId) {
      return NextResponse.json(
        { success: false, error: "publicIdentifier, secret, and postId required" },
        { status: 400 }
      );
    }

    const result = await completeOnboarding(publicIdentifier, secret, postId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      wallet: result.wallet,
      ready: true,
      nextActions: [
        {
          action: "launch",
          description: "Launch your first token!",
          example: {
            action: "launch",
            moltbookUsername: "<your_username>",
            name: "My Token",
            symbol: "MTK",
            description: "My awesome token",
          },
        },
        {
          action: "claimable",
          description: "Check claimable fees",
          example: { action: "claimable", wallet: result.wallet },
        },
      ],
    });
  }

  // =========================================================================
  // IMAGE GENERATION (Free - for token logos)
  // Uses fal.ai Flux (fast) or Replicate SDXL (fallback)
  // =========================================================================

  if (action === "generate-image") {
    const { prompt, style = "pixel art" } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: "prompt required" }, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    if (!falKey && !replicateToken) {
      return NextResponse.json(
        { success: false, error: "Image generation not configured" },
        { status: 503 }
      );
    }

    const fullPrompt = `${prompt}, ${style}, token logo, cryptocurrency coin design, centered, clean background, high quality`;

    try {
      // Try fal.ai Flux first (faster, better quality)
      if (falKey) {
        const falResponse = await fetch("https://fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: {
            Authorization: `Key ${falKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            image_size: { width: 512, height: 512 },
            num_images: 1,
            num_inference_steps: 4,
            enable_safety_checker: true,
            output_format: "png",
          }),
        });

        if (falResponse.ok) {
          const falResult = await falResponse.json();
          if (falResult.images?.[0]?.url) {
            return NextResponse.json({
              success: true,
              imageUrl: falResult.images[0].url,
              prompt: fullPrompt,
              provider: "flux",
              note: "Image URL is temporary (~1 hour). Launch your token soon!",
            });
          }
        }
        // If fal.ai fails, fall through to Replicate
        console.warn("[generate-image] fal.ai failed, trying Replicate");
      }

      // Fallback to Replicate SDXL
      if (replicateToken) {
        const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            Authorization: `Token ${replicateToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
            input: {
              prompt: fullPrompt,
              width: 512,
              height: 512,
              num_outputs: 1,
            },
          }),
        });

        const prediction = await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(prediction.detail || "Failed to start image generation");
        }

        // Poll for completion (max 60 seconds)
        let result = prediction;
        const maxAttempts = 30;
        for (let i = 0; i < maxAttempts; i++) {
          if (result.status === "succeeded") break;
          if (result.status === "failed") throw new Error("Image generation failed");

          await new Promise((r) => setTimeout(r, 2000));

          const pollResponse = await fetch(result.urls.get, {
            headers: { Authorization: `Token ${replicateToken}` },
          });
          result = await pollResponse.json();
        }

        if (result.status !== "succeeded" || !result.output?.[0]) {
          throw new Error("Image generation timed out");
        }

        return NextResponse.json({
          success: true,
          imageUrl: result.output[0],
          prompt: fullPrompt,
          provider: "replicate",
          note: "Image URL is temporary. Launch your token soon!",
        });
      }

      throw new Error("No image provider available");
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Image generation failed" },
        { status: 500 }
      );
    }
  }

  // =========================================================================
  // TOKEN LAUNCH (Free - BagsWorld pays tx fees)
  // =========================================================================

  if (action === "launch") {
    // Token launch enabled - uses BagsWorld's partnerConfigPda
    // Accept either wallet OR moltbookUsername
    // Optional: feeRecipients for custom fee splits
    const {
      wallet,
      moltbookUsername,
      name,
      symbol,
      description,
      imageUrl,
      twitter,
      website,
      telegram,
      feeRecipients, // Optional: custom fee recipients
    } = body;

    if (!wallet && !moltbookUsername) {
      return NextResponse.json(
        { success: false, error: "Either wallet or moltbookUsername is required" },
        { status: 400 }
      );
    }

    if (!name || !symbol || !description) {
      return NextResponse.json(
        { success: false, error: "name, symbol, and description required" },
        { status: 400 }
      );
    }

    const launcherStatus = isLauncherConfigured();
    if (!launcherStatus.configured) {
      return NextResponse.json(
        {
          success: false,
          error: `Launcher not configured. Missing: ${launcherStatus.missing.join(", ")}`,
        },
        { status: 503 }
      );
    }

    // Auto-generate image if not provided
    let finalImageUrl = imageUrl;
    let imageGenerated = false;

    if (!finalImageUrl) {
      console.log("[Launch] No imageUrl provided, auto-generating...");
      const imageResult = await generateTokenImage(name, symbol, description);

      if (imageResult.success && imageResult.imageUrl) {
        finalImageUrl = imageResult.imageUrl;
        imageGenerated = true;
        console.log("[Launch] Auto-generated image:", finalImageUrl);
      } else {
        // Fall back to DiceBear if image generation fails
        console.warn(
          "[Launch] Image generation failed, using DiceBear fallback:",
          imageResult.error
        );
        finalImageUrl = `https://api.dicebear.com/7.x/shapes/png?seed=${encodeURIComponent(symbol)}&size=400`;
      }
    }

    try {
      const launchIdentifier = moltbookUsername ? `@${moltbookUsername}` : wallet;
      console.log("[Launch] Starting launch for", launchIdentifier, symbol);

      const result = await launchForExternal({
        creatorWallet: wallet,
        moltbookUsername,
        name,
        symbol,
        description,
        imageUrl: finalImageUrl,
        twitter,
        website,
        telegram,
        feeRecipients, // Custom fee split if provided
      });

      if (!result.success) {
        console.log("[Launch] Failed:", result.error);
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      console.log("[Launch] Success!", result.tokenMint);

      // Auto-join the world if not already
      // Use resolvedWallet from launch result (handles both direct wallet and Moltbook lookups)
      const agentWallet = result.resolvedWallet || wallet;
      if (agentWallet) {
        const existingAgent = await getExternalAgent(agentWallet);
        if (!existingAgent) {
          await registerExternalAgent(
            agentWallet,
            name,
            "moltbook",
            `Creator of $${symbol}`,
            moltbookUsername
          );
        }
      }

      // Touch agent activity timestamp (fire-and-forget)
      if (agentWallet) touchExternalAgent(agentWallet);

      // Track reputation stats (fire-and-forget)
      if (agentWallet) incrementTokensLaunched(agentWallet);

      // Get updated rate limits for response (use wallet or empty for moltbook-only)
      const rateLimitWallet = wallet || "";
      const updatedRateLimits = getRateLimitStatus(rateLimitWallet || undefined);

      // Build fee info based on whether custom recipients were used
      const hasCustomFees = feeRecipients && feeRecipients.length > 0;
      const feeMessage = hasCustomFees
        ? `Token launched! Fees split: ${feeRecipients.map((r: { moltbookUsername?: string; twitter?: string; wallet?: string; bps: number }) => `${r.moltbookUsername || r.twitter || r.wallet?.slice(0, 8)}=${r.bps / 100}%`).join(", ")}`
        : moltbookUsername
          ? `Token launched! @${moltbookUsername} earns 100% of trading fees.`
          : `Token launched! You earn 100% of trading fees.`;

      return NextResponse.json({
        success: true,
        message: feeMessage,
        token: {
          mint: result.tokenMint,
          name,
          symbol,
          bagsUrl: result.bagsUrl,
          explorerUrl: result.explorerUrl,
        },
        image: {
          url: finalImageUrl,
          source: imageGenerated ? "auto-generated" : imageUrl ? "user-provided" : "fallback",
          provider: imageGenerated ? "fal.ai" : undefined,
        },
        transaction: result.signature,
        feeInfo: hasCustomFees
          ? {
              split: feeRecipients.map(
                (r: {
                  moltbookUsername?: string;
                  twitter?: string;
                  wallet?: string;
                  bps: number;
                }) => ({
                  recipient: r.moltbookUsername || r.twitter || r.wallet,
                  share: `${r.bps / 100}%`,
                  bps: r.bps,
                })
              ),
              claimEndpoint: "/api/agent-economy/external (action: claimable, then claim)",
              solscan: `https://solscan.io/token/${result.tokenMint}`,
            }
          : {
              yourShare: "100%",
              recipient: moltbookUsername ? `@${moltbookUsername} (Moltbook)` : wallet,
              claimEndpoint: "/api/agent-economy/external (action: claimable, then claim)",
              verifyEndpoint: wallet
                ? `/api/agent-economy/external?action=verify-fees&tokenMint=${result.tokenMint}&wallet=${wallet}`
                : `https://bags.fm/${result.tokenMint}`,
              solscan: `https://solscan.io/token/${result.tokenMint}`,
            },
        safety: {
          nonCustodial: true,
          feeConfigImmutable: true,
          yourWallet: wallet,
          note: "Your fee share is set on-chain and cannot be changed. BagsWorld never has access to your private keys.",
        },
        rateLimits: {
          wallet: updatedRateLimits.wallet,
          global: updatedRateLimits.global,
        },
      });
    } catch (err) {
      console.error("[Launch] Error:", err);
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Launch failed" },
        { status: 500 }
      );
    }
  }

  // =========================================================================
  // FEE CLAIMING (They sign, they submit)
  // =========================================================================

  if (action === "claimable") {
    // Check claimable fees for a wallet or Moltbook username
    const { wallet, moltbookUsername } = body;

    // Resolve wallet from Moltbook username if provided
    let resolvedWallet = wallet;
    if (!resolvedWallet && moltbookUsername) {
      try {
        const lookupUrl = `https://public-api-v2.bags.fm/api/v1/token-launch/fee-share/wallet/v2?provider=moltbook&username=${encodeURIComponent(moltbookUsername)}`;
        const lookupRes = await fetch(lookupUrl, {
          headers: { "x-api-key": process.env.BAGS_API_KEY || "" },
        });
        const lookupData = await lookupRes.json();
        if (lookupData.success && lookupData.response?.wallet) {
          resolvedWallet = lookupData.response.wallet;
        }
      } catch {
        // Lookup failed, will error below
      }
    }

    if (!resolvedWallet) {
      return NextResponse.json(
        { success: false, error: "wallet address or moltbookUsername required" },
        { status: 400 }
      );
    }

    // Touch agent activity timestamp (fire-and-forget)
    touchExternalAgent(resolvedWallet);

    const { positions, totalClaimableLamports } = await getClaimableForWallet(resolvedWallet);
    const totalClaimableSol = totalClaimableLamports / 1_000_000_000;

    return NextResponse.json({
      success: true,
      wallet: resolvedWallet,
      moltbookUsername: moltbookUsername || null,
      claimable: {
        totalSol: totalClaimableSol,
        totalLamports: totalClaimableLamports,
        positionCount: positions.length,
        positions: positions.map((p) => {
          // Calculate per-position claimable amount
          const virtualLamports = parseInt(
            p.virtualPoolClaimableAmount || p.totalClaimableLamportsUserShare || "0",
            10
          );
          const dammLamports = parseInt(p.dammPoolClaimableAmount || "0", 10);
          const totalLamports = virtualLamports + dammLamports;
          return {
            tokenMint: p.baseMint,
            isMigrated: p.isMigrated,
            claimableLamports: totalLamports,
            claimableSol: totalLamports / 1_000_000_000,
          };
        }),
      },
    });
  }

  if (action === "claim") {
    // Generate claim transactions (unsigned - they sign themselves)
    const { wallet, moltbookUsername } = body;

    // Resolve wallet from Moltbook username if provided
    let resolvedWallet = wallet;
    if (!resolvedWallet && moltbookUsername) {
      try {
        const lookupUrl = `https://public-api-v2.bags.fm/api/v1/token-launch/fee-share/wallet/v2?provider=moltbook&username=${encodeURIComponent(moltbookUsername)}`;
        const lookupRes = await fetch(lookupUrl, {
          headers: { "x-api-key": process.env.BAGS_API_KEY || "" },
        });
        const lookupData = await lookupRes.json();
        if (lookupData.success && lookupData.response?.wallet) {
          resolvedWallet = lookupData.response.wallet;
        }
      } catch {
        // Lookup failed, will error below
      }
    }

    if (!resolvedWallet) {
      return NextResponse.json(
        { success: false, error: "wallet address or moltbookUsername required" },
        { status: 400 }
      );
    }

    // Touch agent activity timestamp (fire-and-forget)
    touchExternalAgent(resolvedWallet);

    const result = await generateClaimTxForWallet(resolvedWallet);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    if (result.transactions!.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No fees to claim",
        transactions: [],
      });
    }

    const totalSol = (result.totalClaimableLamports || 0) / 1_000_000_000;

    // Track fees earned for reputation (fire-and-forget)
    if (result.totalClaimableLamports && result.totalClaimableLamports > 0) {
      addFeesEarned(resolvedWallet, result.totalClaimableLamports);
    }

    return NextResponse.json({
      success: true,
      wallet: resolvedWallet,
      moltbookUsername: moltbookUsername || null,
      message: `${result.transactions!.length} transaction(s) ready to claim ${totalSol.toFixed(6)} SOL`,
      transactions: result.transactions,
      totalClaimableSol: totalSol,
      instructions: [
        "1. Sign each transaction with your wallet private key",
        "2. Submit to Solana RPC: sendTransaction(signedTx)",
        "3. SOL will be transferred to your wallet",
      ],
    });
  }

  // =========================================================================
  // AUTHENTICATED ACTIONS (Require Bags.fm JWT)
  // =========================================================================

  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const agent = authResult;

  switch (action) {
    case "claim-tx": {
      // Generate claim transactions for external agent to sign
      const result = await agent.generateClaimTransactions();
      return NextResponse.json({
        success: true,
        result: {
          transactions: result.transactions, // Base64 encoded, unsigned
          totalClaimableLamports: result.totalClaimableLamports,
          note: "Sign these transactions with your wallet and submit via /submit",
        },
      });
    }

    case "quote": {
      // Get a swap quote
      const { inputMint, outputMint, amountSol } = body;

      if (!inputMint || !outputMint || !amountSol) {
        return NextResponse.json(
          { success: false, error: "inputMint, outputMint, and amountSol required" },
          { status: 400 }
        );
      }

      const amountLamports = solToLamports(amountSol);
      const quote = await agent.getQuote(inputMint, outputMint, amountLamports);

      return NextResponse.json({
        success: true,
        quote,
      });
    }

    case "swap-tx": {
      // Create a swap transaction for external agent to sign
      const { inputMint, outputMint, amountSol } = body;

      if (!inputMint || !outputMint || !amountSol) {
        return NextResponse.json(
          { success: false, error: "inputMint, outputMint, and amountSol required" },
          { status: 400 }
        );
      }

      const amountLamports = solToLamports(amountSol);
      const quote = await agent.getQuote(inputMint, outputMint, amountLamports);
      const { transaction } = await agent.createSwapTransaction(quote);

      return NextResponse.json({
        success: true,
        result: {
          transaction, // Base64 encoded, unsigned
          quote,
          note: "Sign this transaction with your wallet and submit via /submit",
        },
      });
    }

    case "buy-tx": {
      // Convenience: Create a buy transaction (SOL → Token)
      const { tokenMint, amountSol } = body;

      if (!tokenMint || !amountSol) {
        return NextResponse.json(
          { success: false, error: "tokenMint and amountSol required" },
          { status: 400 }
        );
      }

      const amountLamports = solToLamports(amountSol);
      const quote = await agent.getQuote(COMMON_TOKENS.SOL, tokenMint, amountLamports);
      const { transaction } = await agent.createSwapTransaction(quote);

      return NextResponse.json({
        success: true,
        result: {
          transaction,
          quote,
          note: "Sign this transaction with your wallet and submit via /submit",
        },
      });
    }

    case "submit": {
      // Submit a signed transaction
      const { signedTransaction } = body;

      if (!signedTransaction) {
        return NextResponse.json(
          { success: false, error: "signedTransaction required" },
          { status: 400 }
        );
      }

      const result = await agent.submitTransaction(signedTransaction);

      return NextResponse.json({
        success: true,
        result,
      });
    }

    default:
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }
}
