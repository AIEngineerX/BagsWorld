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
} from "@/lib/agent-economy/launcher";
import type { ZoneType } from "@/lib/types";

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
    const entry = await registerExternalAgent(wallet, name, zone as ZoneType, description, moltbookUsername);

    return NextResponse.json({
      success: true,
      message: "Welcome to BagsWorld!",
      agent: {
        wallet,
        name,
        zone,
        moltbookProfile: moltbookUsername ? `https://moltbook.com/u/${moltbookUsername}` : undefined,
        character: {
          id: entry.character.id,
          x: entry.character.x,
          y: entry.character.y,
        },
      },
      nextSteps: [
        "Check market: GET /api/agent-economy/external?action=market",
        "Get suggestions: GET /api/agent-economy/external?action=suggest&strategy=conservative&budget=0.1",
        "Launch a token on Bags.fm to earn fees",
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
    // Launch a token for an external agent
    // BagsWorld pays tx fees, they get 100% of trading fees
    const { wallet, name, symbol, description, imageUrl, twitter, website, telegram } = body;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "wallet address required" },
        { status: 400 }
      );
    }

    if (!name || !symbol || !description) {
      return NextResponse.json(
        { success: false, error: "name, symbol, and description required" },
        { status: 400 }
      );
    }

    // Check if launcher is configured
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

    // Launch the token
    try {
      console.log("[Launch] Starting launch for", wallet, symbol);
      const result = await launchForExternal({
        creatorWallet: wallet,
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

      // Auto-join the world if not already
      const existingAgent = await getExternalAgent(wallet);
      if (!existingAgent) {
        await registerExternalAgent(wallet, name, "main_city", `Creator of $${symbol}`);
      }

      return NextResponse.json({
        success: true,
        message: `Token launched! You earn 100% of trading fees.`,
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
          claimEndpoint: "/api/agent-economy/external (action: claim)",
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

  if (action === "launcher-status") {
    // Check launcher configuration status
    const status = isLauncherConfigured();
    const wallet = getLauncherWallet();
    let balance = 0;

    if (status.configured && wallet) {
      balance = await getLauncherBalance();
    }

    return NextResponse.json({
      success: true,
      launcher: {
        configured: status.configured,
        missing: status.missing,
        wallet: wallet ? `${wallet.slice(0, 8)}...${wallet.slice(-4)}` : null,
        balanceSol: balance,
        canLaunch: status.configured && balance > 0.05,
      },
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
