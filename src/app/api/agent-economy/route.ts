// Agent Economy API
// Endpoints for managing agents in the BagsWorld Agentic Economy

import { NextRequest, NextResponse } from "next/server";
import {
  AgentEconomy,
  initAgentCredentialsTable,
  listAgents,
  getAgentCredentials,
  lamportsToSol,
  // Spawn system
  spawnAgent,
  despawnAgent,
  getSpawnedAgents,
  getSpawnedAgent,
  getAgentCharacters,
  moveAgentToZone,
  getSpawnStats,
  // Economy loop
  runLoopIteration,
  startEconomyLoop,
  stopEconomyLoop,
  getLoopStatus,
  resetLoopStats,
  DEFAULT_LOOP_CONFIG,
  // Brain
  makeTradeDecision,
  getPortfolioState,
  getMarketState,
} from "@/lib/agent-economy";

// Initialize tables on first request
let tablesInitialized = false;

async function ensureTablesExist() {
  if (tablesInitialized) return;

  try {
    await initAgentCredentialsTable();
    tablesInitialized = true;
  } catch (error) {
    console.error("[AgentEconomy] Failed to initialize tables:", error);
  }
}

// Admin auth check
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization");
  const expectedToken = process.env.ADMIN_API_SECRET;

  // SECURITY: Require explicit secret in production, fail closed
  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      console.error("[AgentEconomy] ADMIN_API_SECRET not configured - rejecting request");
      return false;
    }
    // Development only: allow with dev token
    return authHeader === "Bearer dev-local-testing";
  }

  return authHeader === `Bearer ${expectedToken}`;
}

/**
 * GET - List agents, get agent status, or get agent actions
 */
export async function GET(request: NextRequest) {
  await ensureTablesExist();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "list";
  const agentId = searchParams.get("agentId");

  try {
    switch (action) {
      case "list": {
        // List all registered agents
        const agents = await listAgents();
        return NextResponse.json({
          success: true,
          agents: agents.map((a) => ({
            ...a,
            authenticatedAt: a.authenticatedAt.toISOString(),
          })),
        });
      }

      case "status": {
        // Get specific agent status
        if (!agentId) {
          return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 });
        }

        const agent = await AgentEconomy.get(agentId);
        if (!agent) {
          return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
        }

        const [isAuth, balance, claimable] = await Promise.all([
          agent.isAuthenticated(),
          agent.getBalance().catch(() => ({ sol: 0, wallets: [] })),
          agent.getClaimableFees().catch(() => ({ positions: [], totalSol: 0 })),
        ]);

        const wallet = await agent.getWallet().catch(() => null);

        return NextResponse.json({
          success: true,
          agent: {
            id: agent.id,
            wallet,
            isAuthenticated: isAuth,
            balanceSol: balance.sol,
            claimableSol: claimable.totalSol,
            claimablePositions: claimable.positions.length,
          },
        });
      }

      case "actions": {
        // Get agent action history
        if (!agentId) {
          return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 });
        }

        const agent = await AgentEconomy.get(agentId);
        if (!agent) {
          return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
        }

        const limit = parseInt(searchParams.get("limit") || "50", 10);
        const actions = await agent.getActions(limit);

        return NextResponse.json({
          success: true,
          actions: actions.map((a) => ({
            ...a,
            timestamp: a.timestamp.toISOString(),
          })),
        });
      }

      case "balance": {
        // Get agent balance details
        if (!agentId) {
          return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 });
        }

        const agent = await AgentEconomy.get(agentId);
        if (!agent) {
          return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
        }

        const balance = await agent.getBalance();

        return NextResponse.json({
          success: true,
          balance: {
            totalSol: balance.sol,
            wallets: balance.wallets.map((w) => ({
              address: w.address,
              sol: w.sol,
              lamports: w.lamports,
            })),
          },
        });
      }

      case "claimable": {
        // Get claimable fees
        if (!agentId) {
          return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 });
        }

        const agent = await AgentEconomy.get(agentId);
        if (!agent) {
          return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
        }

        const claimable = await agent.getClaimableFees();

        return NextResponse.json({
          success: true,
          claimable: {
            totalSol: claimable.totalSol,
            positionCount: claimable.positions.length,
            positions: claimable.positions.map((p) => ({
              tokenMint: p.baseMint,
              claimableSol: lamportsToSol(p.totalClaimableLamports),
              isMigrated: p.isMigrated,
            })),
          },
        });
      }

      // ===== SPAWN SYSTEM =====

      case "spawned": {
        // List all spawned agents in the world
        const spawned = getSpawnedAgents();
        return NextResponse.json({
          success: true,
          agents: spawned.map((a) => ({
            agentId: a.agentId,
            username: a.username,
            wallet: a.wallet,
            zone: a.zone,
            character: a.character,
            spawnedAt: a.spawnedAt.toISOString(),
            isActive: a.isActive,
          })),
        });
      }

      case "characters": {
        // Get all agent characters for world state
        const characters = getAgentCharacters();
        return NextResponse.json({
          success: true,
          characters,
        });
      }

      case "spawn-stats": {
        // Get spawn statistics
        const stats = getSpawnStats();
        return NextResponse.json({
          success: true,
          stats,
        });
      }

      // ===== ECONOMY LOOP =====

      case "loop-status": {
        // Get economy loop status
        const status = getLoopStatus();
        return NextResponse.json({
          success: true,
          loop: {
            ...status,
            lastRun: status.lastRun?.toISOString() || null,
          },
        });
      }

      // ===== BRAIN / ANALYSIS =====

      case "market": {
        // Get current market state
        const market = await getMarketState();
        return NextResponse.json({
          success: true,
          market: {
            tokenCount: market.tokens.length,
            topByVolume: market.topByVolume.slice(0, 5).map((t) => ({
              symbol: t.symbol,
              volume24h: t.volume24h,
              feeYieldPercent: t.feeYieldPercent,
            })),
            topByFees: market.topByFees.slice(0, 5).map((t) => ({
              symbol: t.symbol,
              lifetimeFees: t.lifetimeFees,
              feeYieldPercent: t.feeYieldPercent,
            })),
            topByYield: market.topByYield.slice(0, 5).map((t) => ({
              symbol: t.symbol,
              feeYieldPercent: t.feeYieldPercent,
              marketCap: t.marketCap,
            })),
            averageVolume24h: market.averageVolume24h,
            averageFeeYield: market.averageFeeYield,
          },
        });
      }

      case "portfolio": {
        // Get agent portfolio state
        if (!agentId) {
          return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 });
        }

        const portfolio = await getPortfolioState(agentId);
        return NextResponse.json({
          success: true,
          portfolio: {
            solBalance: portfolio.solBalance,
            totalValueSol: portfolio.totalValueSol,
            positionCount: portfolio.positionCount,
            largestPositionPercent: portfolio.largestPositionPercent,
            diversificationScore: portfolio.diversificationScore,
            positions: portfolio.positions.map((p) => ({
              symbol: p.symbol,
              valueSol: p.valueSol,
              percentOfPortfolio: p.percentOfPortfolio,
            })),
          },
        });
      }

      case "brain-preview": {
        // Preview what the brain would decide (no execution)
        if (!agentId) {
          return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 });
        }

        const strategy = (searchParams.get("strategy") || "conservative") as
          | "conservative"
          | "diversify"
          | "follow_whales"
          | "aggressive";
        const budget = parseFloat(searchParams.get("budget") || "0.1");

        const decision = await makeTradeDecision(agentId, strategy, budget);
        return NextResponse.json({
          success: true,
          decision: {
            action: decision.action,
            tokenMint: decision.tokenMint,
            tokenSymbol: decision.tokenSymbol,
            amountSol: decision.amountSol,
            reason: decision.reason,
            confidence: decision.confidence,
            riskLevel: decision.riskLevel,
          },
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[AgentEconomy] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Agent actions (claim, trade, launch)
 * Requires authorization for sensitive actions
 */
export async function POST(request: NextRequest) {
  await ensureTablesExist();

  // Check authorization for sensitive actions
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, agentId, ...params } = body;

    // ===== SPAWN ACTIONS (don't require existing agentId) =====

    if (action === "spawn") {
      // Spawn a new agent into the world
      const { moltbookUsername, moltbookApiKey, displayName, avatarUrl, preferredZone } = params;
      if (!moltbookUsername || !moltbookApiKey) {
        return NextResponse.json(
          { success: false, error: "moltbookUsername and moltbookApiKey required" },
          { status: 400 }
        );
      }

      const spawned = await spawnAgent({
        moltbookUsername,
        moltbookApiKey,
        displayName,
        avatarUrl,
        preferredZone,
      });

      return NextResponse.json({
        success: true,
        agent: {
          agentId: spawned.agentId,
          username: spawned.username,
          wallet: spawned.wallet,
          zone: spawned.zone,
          character: spawned.character,
          spawnedAt: spawned.spawnedAt.toISOString(),
        },
      });
    }

    if (action === "despawn") {
      // Despawn an agent from the world
      const targetAgentId = agentId || params.targetAgentId;
      if (!targetAgentId) {
        return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 });
      }

      const result = await despawnAgent(targetAgentId);
      return NextResponse.json({ success: true, despawned: result });
    }

    if (action === "move-zone") {
      // Move an agent to a different zone
      const targetAgentId = agentId || params.targetAgentId;
      const { zone } = params;
      if (!targetAgentId || !zone) {
        return NextResponse.json(
          { success: false, error: "agentId and zone required" },
          { status: 400 }
        );
      }

      const character = await moveAgentToZone(targetAgentId, zone);
      if (!character) {
        return NextResponse.json({ success: false, error: "Agent not spawned" }, { status: 404 });
      }

      return NextResponse.json({ success: true, character });
    }

    // ===== ECONOMY LOOP ACTIONS =====

    if (action === "loop-start") {
      // Start the economy loop
      const config = { ...DEFAULT_LOOP_CONFIG, ...params.config };
      startEconomyLoop(config);
      return NextResponse.json({ success: true, message: "Economy loop started", config });
    }

    if (action === "loop-stop") {
      // Stop the economy loop
      stopEconomyLoop();
      return NextResponse.json({ success: true, message: "Economy loop stopped" });
    }

    if (action === "loop-run") {
      // Run one iteration of the loop manually
      const config = { ...DEFAULT_LOOP_CONFIG, ...params.config };
      const result = await runLoopIteration(config);
      return NextResponse.json({ success: true, result });
    }

    if (action === "loop-reset") {
      // Reset loop statistics
      resetLoopStats();
      return NextResponse.json({ success: true, message: "Loop stats reset" });
    }

    // ===== AGENT-SPECIFIC ACTIONS (require agentId) =====

    if (!agentId) {
      return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 });
    }

    const agent = await AgentEconomy.get(agentId);
    if (!agent) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    switch (action) {
      case "claim": {
        // Claim all available fees
        const result = await agent.claimFees();
        return NextResponse.json({
          success: true,
          result: {
            claimed: result.claimed,
            amountSol: result.amount,
            signatures: result.signatures,
          },
        });
      }

      case "buy": {
        // Buy a token
        const { tokenMint, solAmount } = params;
        if (!tokenMint || !solAmount) {
          return NextResponse.json(
            { success: false, error: "tokenMint and solAmount required" },
            { status: 400 }
          );
        }

        const result = await agent.buy(tokenMint, solAmount);
        return NextResponse.json({ success: true, result });
      }

      case "sell": {
        // Sell a token
        const { tokenMint, tokenAmount } = params;
        if (!tokenMint || !tokenAmount) {
          return NextResponse.json(
            { success: false, error: "tokenMint and tokenAmount required" },
            { status: 400 }
          );
        }

        const result = await agent.sell(tokenMint, tokenAmount);
        return NextResponse.json({ success: true, result });
      }

      case "preview": {
        // Preview a buy
        const { tokenMint, solAmount } = params;
        if (!tokenMint || !solAmount) {
          return NextResponse.json(
            { success: false, error: "tokenMint and solAmount required" },
            { status: 400 }
          );
        }

        const result = await agent.previewBuy(tokenMint, solAmount);
        return NextResponse.json({ success: true, result });
      }

      case "launch": {
        // Launch a token
        const { name, symbol, description, imageUrl, initialBuySol, feeClaimers } = params;
        if (!name || !symbol || !description || !imageUrl) {
          return NextResponse.json(
            { success: false, error: "name, symbol, description, imageUrl required" },
            { status: 400 }
          );
        }

        const wallet = await agent.getWallet();
        const config = {
          name,
          symbol,
          description,
          imageUrl,
          initialBuyLamports: initialBuySol
            ? Math.floor(initialBuySol * 1_000_000_000)
            : 10_000_000,
          feeClaimers: feeClaimers || [{ user: wallet, userBps: 10000 }],
        };

        const result = await agent.launch(config);
        return NextResponse.json({ success: true, result });
      }

      case "launchFor": {
        // Launch for another agent
        const {
          targetUsername,
          name,
          symbol,
          description,
          imageUrl,
          initialBuySol,
          mySharePercent,
        } = params;
        if (!targetUsername || !name || !symbol || !description || !imageUrl) {
          return NextResponse.json(
            {
              success: false,
              error: "targetUsername, name, symbol, description, imageUrl required",
            },
            { status: 400 }
          );
        }

        const result = await agent.launchFor(
          targetUsername,
          {
            name,
            symbol,
            description,
            imageUrl,
            initialBuyLamports: initialBuySol
              ? Math.floor(initialBuySol * 1_000_000_000)
              : 10_000_000,
          },
          mySharePercent || 50
        );

        return NextResponse.json({ success: true, result });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[AgentEconomy] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
