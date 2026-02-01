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
} from "@/lib/agent-economy/external-registry";
import {
  launchForExternal,
  getClaimableForWallet,
  generateClaimTxForWallet,
  isLauncherConfigured,
  getLauncherWallet,
  getLauncherBalance,
  getRateLimitStatus,
  canWalletLaunch,
} from "@/lib/agent-economy/launcher";
import type { ZoneType } from "@/lib/types";
import { getTokensByCreator, isNeonConfigured } from "@/lib/neon";

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
        description: "Free token launches for AI agents. Keep 100% of trading fees.",
        version: "1.0.0",
        status: launcherStatus.configured ? "online" : "offline",
      },
      capabilities: {
        launch: true,
        claimFees: true,
        generateImage: true,
        moltbookIdentity: true,
      },
      cost: {
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
      howToLaunch: {
        endpoint: "POST https://bagsworld.app/api/agent-economy/external",
        withMoltbook: {
          action: "launch",
          moltbookUsername: "YOUR_MOLTBOOK_NAME",
          name: "Your Token Name",
          symbol: "TKN",
          description: "Your description",
        },
        withWallet: {
          action: "launch",
          wallet: "YOUR_SOLANA_WALLET",
          name: "Your Token Name",
          symbol: "TKN",
          description: "Your description",
        },
      },
      decisionGuide: {
        shouldLaunch: [
          "You have a Moltbook account with linked wallet",
          "You haven't launched a token yet",
          "You have a clear identity or purpose",
          "You want to earn fees from trading",
        ],
        shouldNotLaunch: [
          "You already have a token",
          "You don't have a linked Solana wallet",
          "You have no clear purpose for a token",
        ],
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
    const status = getRateLimitStatus(wallet);

    let canLaunch = true;
    let canLaunchReason = "Ready to launch";

    if (wallet) {
      const check = canWalletLaunch(wallet);
      canLaunch = check.allowed;
      canLaunchReason = check.reason || "Ready to launch";
    }

    return NextResponse.json({
      success: true,
      rateLimits: status,
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
        const lookupUrl = `https://api.bags.fm/api/public/v1/token-launch/fee-share/wallet/v2?provider=moltbook&username=${encodeURIComponent(moltbookUsername)}`;
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

  // Debug endpoint to check environment
  if (action === "debug-env") {
    const apiKey = process.env.BAGS_API_KEY;
    const launcherKey =
      process.env.BAGSWORLD_LAUNCHER_PRIVATE_KEY || process.env.AGENT_WALLET_PRIVATE_KEY;
    return NextResponse.json({
      success: true,
      debug: {
        bagsApiKey: apiKey ? `${apiKey.substring(0, 10)}... (${apiKey.length} chars)` : "NOT SET",
        launcherKey: launcherKey
          ? `${launcherKey.substring(0, 4)}... (${launcherKey.length} chars)`
          : "NOT SET",
        launcherConfigured: isLauncherConfigured(),
        nodeEnv: process.env.NODE_ENV,
      },
    });
  }

  // Admin test launch (no auth - for testing only)
  if (action === "test-launch") {
    const symbol = searchParams.get("symbol") || "TEST" + Math.floor(Math.random() * 10000);
    const testWallet = "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC"; // Ghost's wallet

    const launcherStatus = isLauncherConfigured();

    // Debug info
    const apiKey = process.env.BAGS_API_KEY;
    const debugInfo = {
      apiKeySet: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey?.substring(0, 10) || "none",
    };

    if (!launcherStatus.configured) {
      return NextResponse.json({
        success: false,
        error: `Launcher not configured. Missing: ${launcherStatus.missing.join(", ")}`,
        debug: debugInfo,
      });
    }

    try {
      console.log("[Test Launch] Starting test launch:", symbol);
      const result = await launchForExternal({
        creatorWallet: testWallet,
        name: `${symbol} Test Token`,
        symbol: symbol.toUpperCase(),
        description: "Test token launched via BagsWorld agent economy",
        imageUrl: `https://api.dicebear.com/7.x/shapes/png?seed=${symbol}&size=400`,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error, debug: debugInfo });
      }

      return NextResponse.json({
        success: true,
        message: "Test launch successful!",
        token: {
          mint: result.tokenMint,
          symbol,
          bagsUrl: result.bagsUrl,
          explorerUrl: result.explorerUrl,
        },
        signature: result.signature,
      });
    } catch (err) {
      console.error("[Test Launch] Error:", err);
      return NextResponse.json({
        success: false,
        error: err instanceof Error ? err.message : "Launch failed",
        debug: debugInfo,
      });
    }
  }

  // Admin test: Run claim + reinvest loop for a wallet
  if (action === "test-claim-reinvest") {
    const wallet = searchParams.get("wallet") || "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC";

    console.log("[Test Claim+Reinvest] Starting for wallet:", wallet);

    // Step 1: Check claimable
    let positions: Awaited<ReturnType<typeof getClaimableForWallet>>["positions"] = [];
    let totalClaimableLamports = 0;

    try {
      const result = await getClaimableForWallet(wallet);
      positions = result.positions;
      totalClaimableLamports = result.totalClaimableLamports;
    } catch (err) {
      console.error("[Test Claim+Reinvest] Error getting claimable:", err);
      return NextResponse.json({
        success: false,
        error: `Failed to get claimable: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    const claimableSol = totalClaimableLamports / 1_000_000_000;

    console.log(
      `[Test Claim+Reinvest] Claimable: ${claimableSol.toFixed(6)} SOL from ${positions.length} positions`
    );

    if (positions.length === 0 || claimableSol < 0.001) {
      return NextResponse.json({
        success: true,
        step: "check",
        message: `No claimable fees (${claimableSol.toFixed(6)} SOL)`,
        claimableSol,
        positions: positions.length,
      });
    }

    // Step 2: Generate claim transactions (unsigned - wallet owner must sign)
    let claimResult: Awaited<ReturnType<typeof generateClaimTxForWallet>>;
    try {
      claimResult = await generateClaimTxForWallet(wallet);
    } catch (err) {
      console.error("[Test Claim+Reinvest] Error generating claim tx:", err);
      return NextResponse.json({
        success: false,
        error: `Failed to generate claim tx: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    if (!claimResult.transactions || claimResult.transactions.length === 0) {
      return NextResponse.json({
        success: true,
        step: "generate",
        message: "No claim transactions needed",
        claimableSol,
      });
    }

    // Step 3: Get reinvestment decision
    const BAGSWORLD_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";
    const reinvestAmount = claimableSol * 0.95; // Leave some for fees

    return NextResponse.json({
      success: true,
      step: "ready",
      message: "Ready to claim and reinvest. Wallet owner must sign the transactions.",
      claimable: {
        sol: claimableSol,
        lamports: totalClaimableLamports,
        positions: positions.length,
        transactions: claimResult.transactions.length,
      },
      reinvestDecision: {
        action: "buy",
        tokenMint: BAGSWORLD_MINT,
        tokenSymbol: "BAGSWORLD",
        amountSol: reinvestAmount,
        reason: `Reinvesting ${reinvestAmount.toFixed(6)} SOL into BagsWorld token`,
        confidence: 95,
      },
      note: "External wallets must sign their own transactions. This endpoint shows what WOULD happen.",
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
    // Join BagsWorld with just a wallet address
    const { wallet, name, description, zone = "main_city", moltbookUsername } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet address required" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
    }

    // Validate wallet format (basic check)
    if (wallet.length < 32 || wallet.length > 44) {
      return NextResponse.json(
        { success: false, error: "Invalid Solana wallet address" },
        { status: 400 }
      );
    }

    // Check if already joined
    const existing = await getExternalAgent(wallet);
    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Already in BagsWorld",
        agent: {
          wallet: existing.wallet,
          name: existing.name,
          zone: existing.zone,
          joinedAt: existing.joinedAt.toISOString(),
        },
      });
    }

    // Register in shared registry (persisted to DB)
    const entry = await registerExternalAgent(
      wallet,
      name,
      zone as ZoneType,
      description,
      moltbookUsername
    );

    return NextResponse.json({
      success: true,
      message: "Welcome to BagsWorld!",
      agent: {
        wallet,
        name,
        zone,
        moltbookProfile: moltbookUsername
          ? `https://moltbook.com/u/${moltbookUsername}`
          : undefined,
        character: {
          id: entry.character.id,
          x: entry.character.x,
          y: entry.character.y,
        },
      },
      safety: {
        nonCustodial: true,
        note: "BagsWorld never has access to your private keys. When you launch a token, you earn 100% of trading fees.",
      },
      nextSteps: [
        "Check market: GET /api/agent-economy/external?action=market",
        "Check rate limits: GET /api/agent-economy/external?action=rate-limits&wallet=YOUR_WALLET",
        "Launch a token: POST {action: 'launch', wallet, name, symbol, description}",
        "Check claimable: POST {action: 'claimable', wallet: YOUR_WALLET}",
      ],
      docs: "https://bagsworld.app/docs/POKECENTER.md",
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
  // IMAGE GENERATION (Free - for token logos)
  // =========================================================================

  if (action === "generate-image") {
    const { prompt, style = "pixel art" } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: "prompt required" }, { status: 400 });
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json(
        { success: false, error: "Image generation not configured" },
        { status: 503 }
      );
    }

    try {
      // Use Replicate's SDXL for high quality token images
      const fullPrompt = `${prompt}, ${style}, token logo, cryptocurrency coin design, centered, clean background, high quality`;

      // Start the prediction
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
        note: "Image URL is temporary. Launch your token soon!",
      });
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

    try {
      const launchIdentifier = moltbookUsername ? `@${moltbookUsername}` : wallet;
      console.log("[Launch] Starting launch for", launchIdentifier, symbol);

      const result = await launchForExternal({
        creatorWallet: wallet,
        moltbookUsername,
        name,
        symbol,
        description,
        imageUrl,
        twitter,
        website,
        telegram,
      });

      if (!result.success) {
        console.log("[Launch] Failed:", result.error);
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      console.log("[Launch] Success!", result.tokenMint);

      // Auto-join the world if not already (use wallet if provided, otherwise skip)
      if (wallet) {
        const existingAgent = await getExternalAgent(wallet);
        if (!existingAgent) {
          await registerExternalAgent(
            wallet,
            name,
            "main_city",
            `Creator of $${symbol}`,
            moltbookUsername
          );
        }
      }

      // Get updated rate limits for response (use wallet or empty for moltbook-only)
      const rateLimitWallet = wallet || "";
      const updatedRateLimits = getRateLimitStatus(rateLimitWallet || undefined);

      return NextResponse.json({
        success: true,
        message: moltbookUsername
          ? `Token launched! @${moltbookUsername} earns 100% of trading fees.`
          : `Token launched! You earn 100% of trading fees.`,
        token: {
          mint: result.tokenMint,
          name,
          symbol,
          bagsUrl: result.bagsUrl,
          explorerUrl: result.explorerUrl,
        },
        transaction: result.signature,
        feeInfo: {
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
    // Check claimable fees for a wallet
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet address required" },
        { status: 400 }
      );
    }

    const { positions, totalClaimableLamports } = await getClaimableForWallet(wallet);
    const totalClaimableSol = totalClaimableLamports / 1_000_000_000;

    return NextResponse.json({
      success: true,
      claimable: {
        totalSol: totalClaimableSol,
        totalLamports: totalClaimableLamports,
        positionCount: positions.length,
        positions: positions.map((p) => ({
          tokenMint: p.baseMint,
          isMigrated: p.isMigrated,
        })),
      },
    });
  }

  if (action === "claim") {
    // Generate claim transactions (unsigned - they sign themselves)
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet address required" },
        { status: 400 }
      );
    }

    const result = await generateClaimTxForWallet(wallet);

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

    return NextResponse.json({
      success: true,
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
