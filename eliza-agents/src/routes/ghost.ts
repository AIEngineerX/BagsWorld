// Ghost Trading routes - Control and monitoring for Ghost's autonomous trading
// GET /api/ghost/status - Trading status and stats
// GET /api/ghost/positions - List all positions
// GET /api/ghost/positions/open - List open positions only
// POST /api/ghost/positions/:id/mark-closed - Mark position as closed (external sale)
// POST /api/ghost/enable - Enable trading
// POST /api/ghost/disable - Disable trading (kill switch)
// POST /api/ghost/config - Update trading config
// POST /api/ghost/evaluate - Manually trigger evaluation
// GET /api/ghost/study-wallet/:address - Analyze a wallet's trading patterns

import { Router, Request, Response, NextFunction } from "express";
import { getGhostTrader } from "../services/GhostTrader.js";
import { getHeliusService } from "../services/HeliusService.js";
import { getSolanaService } from "../services/SolanaService.js";
import { getSmartMoneyService } from "../services/SmartMoneyService.js";
import { getCopyTraderService } from "../services/CopyTraderService.js";
import { getTelegramBroadcaster } from "../services/TelegramBroadcaster.js";

// ============================================================================
// Authentication Middleware
// ============================================================================

const GHOST_ADMIN_KEY = process.env.GHOST_ADMIN_KEY;

/**
 * Middleware to protect sensitive endpoints
 * Requires header: x-ghost-admin-key: YOUR_SECRET
 */
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  // SECURITY: Require admin key - do NOT allow unprotected access
  if (!GHOST_ADMIN_KEY) {
    console.error("[Ghost] CRITICAL: GHOST_ADMIN_KEY not set - blocking request for security");
    res.status(503).json({
      success: false,
      error: "Service Unavailable",
      message: "Ghost trading endpoints require GHOST_ADMIN_KEY to be configured",
    });
    return;
  }

  const providedKey = req.headers["x-ghost-admin-key"];

  if (providedKey !== GHOST_ADMIN_KEY) {
    res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Invalid or missing x-ghost-admin-key header",
    });
    return;
  }

  next();
}

// Solana RPC for wallet analysis
const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

const router = Router();

// GET /api/ghost/learning - Get self-learning insights
router.get("/learning", (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const insights = trader.getLearningInsights();

  res.json({
    success: true,
    learning: {
      totalSignalsTracked: insights.signals.length,
      totalTradesAnalyzed: insights.totalTradesAnalyzed,
      bestSignals: insights.bestSignals,
      worstSignals: insights.worstSignals,
      lastUpdated: new Date(insights.lastUpdated).toISOString(),
    },
    signals: insights.signals.map((s) => ({
      signal: s.signal,
      trades: s.totalTrades,
      wins: s.winningTrades,
      losses: s.losingTrades,
      winRate: (s.winRate * 100).toFixed(1) + "%",
      totalPnl: s.totalPnlSol.toFixed(4) + " SOL",
      avgPnl: s.avgPnlSol.toFixed(4) + " SOL",
      scoreAdjustment: s.scoreAdjustment,
    })),
  });
});

// POST /api/ghost/learning/reset - Reset learning data (PROTECTED)
// SECURITY: Requires admin key to prevent malicious reset of learned patterns
router.post("/learning/reset", requireAdminKey, async (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const result = await trader.resetLearning();

  res.json({
    success: result.success,
    message: result.success
      ? `Learning data reset. ${result.signalsCleared} signals cleared, ${result.memoriesCleared} poisoned memories removed.`
      : "Failed to reset learning data",
    signalsCleared: result.signalsCleared,
    memoriesCleared: result.memoriesCleared,
  });
});

// GET /api/ghost/status - Get trading status and stats
// Public endpoint - trading stats are transparent for community trust
router.get("/status", async (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const solanaService = getSolanaService();
  const stats = trader.getStats();
  const config = trader.getConfig();

  // Fetch wallet balance (falls back to public RPC if primary is rate-limited)
  let walletBalance = 0;
  let balanceError: string | undefined;
  try {
    walletBalance = await solanaService.getBalance();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Ghost] Failed to fetch wallet balance:", msg);
    balanceError = msg;
  }

  res.json({
    success: true,
    wallet: {
      address: solanaService.getPublicKey() || null,
      balanceSol: walletBalance,
      ...(balanceError && { balanceError }),
    },
    trading: {
      enabled: stats.enabled,
      openPositions: stats.openPositions,
      totalExposureSol: stats.totalExposureSol,
      maxExposureSol: config.maxTotalExposureSol,
      maxPositions: config.maxOpenPositions,
    },
    performance: {
      totalTrades: stats.totalTrades,
      winningTrades: stats.winningTrades,
      losingTrades: stats.losingTrades,
      totalPnlSol: stats.totalPnlSol,
      winRate: (stats.winRate * 100).toFixed(1) + "%",
    },
    config: {
      minPositionSol: config.minPositionSol,
      maxPositionSol: config.maxPositionSol,
      takeProfitTiers: config.takeProfitTiers,
      partialSellPercent: config.partialSellPercent,
      trailingStopPercent: config.trailingStopPercent,
      stopLossPercent: config.stopLossPercent,
      deadPositionDecayPercent: config.deadPositionDecayPercent,
      maxHoldTimeMinutes: config.maxHoldTimeMinutes,
      minVolumeToHoldUsd: config.minVolumeToHoldUsd,
      minLiquidityUsd: config.minLiquidityUsd,
      minBuySellRatio: config.minBuySellRatio,
      slippageBps: config.slippageBps,
      maxPriceImpactPercent: config.maxPriceImpactPercent,
    },
    buyAndBurn: {
      enabled: config.burnEnabled,
      burnPercent: config.burnPercent,
      totalBagsBurned: stats.totalBagsBurned,
      totalSolSpentOnBurns: stats.totalSolSpentOnBurns,
      burnCount: stats.burnCount,
    },
    smartMoneyWallets: trader.getSmartMoneyWalletsWithLabels(),
  });
});

// GET /api/ghost/positions - Get all positions
router.get("/positions", (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const positions = trader.getAllPositions();

  res.json({
    success: true,
    count: positions.length,
    positions: positions.map((p) => ({
      id: p.id,
      tokenMint: p.tokenMint,
      tokenSymbol: p.tokenSymbol,
      tokenName: p.tokenName,
      status: p.status,
      entryPriceSol: p.entryPriceSol,
      amountSol: p.amountSol,
      amountTokens: p.amountTokens,
      entryReason: p.entryReason,
      exitReason: p.exitReason,
      pnlSol: p.pnlSol,
      entryTxSignature: p.entryTxSignature,
      exitTxSignature: p.exitTxSignature,
      createdAt: p.createdAt.toISOString(),
      closedAt: p.closedAt?.toISOString(),
    })),
  });
});

// GET /api/ghost/positions/open - Get open positions only
router.get("/positions/open", (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const positions = trader.getOpenPositions();

  res.json({
    success: true,
    count: positions.length,
    totalExposureSol: trader.getTotalExposure(),
    positions: positions.map((p) => ({
      id: p.id,
      tokenMint: p.tokenMint,
      tokenSymbol: p.tokenSymbol,
      tokenName: p.tokenName,
      status: p.status,
      entryPriceSol: p.entryPriceSol,
      amountSol: p.amountSol,
      amountTokens: p.amountTokens,
      entryReason: p.entryReason,
      entryTxSignature: p.entryTxSignature,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

// POST /api/ghost/positions/:id/mark-closed - Mark position as closed (PROTECTED)
// SECURITY: Requires admin key - modifying position state can affect PnL tracking
router.post("/positions/:id/mark-closed", requireAdminKey, async (req: Request, res: Response) => {
  const positionId = req.params.id as string;
  const { pnlSol, exitReason } = req.body;

  const trader = getGhostTrader();
  const result = await trader.markPositionClosed(
    positionId,
    pnlSol !== undefined ? parseFloat(pnlSol) : undefined,
    exitReason || "manual_external"
  );

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: result.error,
    });
    return;
  }

  res.json({
    success: true,
    message: `Position ${positionId} marked as closed`,
    pnlSol: pnlSol !== undefined ? parseFloat(pnlSol) : 0,
    exitReason: exitReason || "manual_external",
  });
});

// POST /api/ghost/enable - Enable trading (PROTECTED)
router.post("/enable", requireAdminKey, async (req: Request, res: Response) => {
  const { confirmPhrase } = req.body;

  // Require confirmation phrase for safety
  if (confirmPhrase !== "i understand the risks") {
    res.status(400).json({
      success: false,
      error: "Safety check failed",
      message: "To enable trading, send { confirmPhrase: 'i understand the risks' }",
    });
    return;
  }

  const trader = getGhostTrader();

  // Check if wallet is configured
  if (!process.env.GHOST_WALLET_PRIVATE_KEY) {
    res.status(400).json({
      success: false,
      error: "Wallet not configured",
      message: "GHOST_WALLET_PRIVATE_KEY environment variable is required",
    });
    return;
  }

  await trader.enableTrading();

  res.json({
    success: true,
    message: "Ghost trading ENABLED",
    warning: "Ghost will now execute real trades with real SOL. Monitor closely.",
    stats: trader.getStats(),
  });
});

// POST /api/ghost/disable - Disable trading (kill switch) (PROTECTED)
router.post("/disable", requireAdminKey, async (req: Request, res: Response) => {
  const trader = getGhostTrader();
  await trader.disableTrading();

  res.json({
    success: true,
    message: "Ghost trading DISABLED",
    openPositions: trader.getOpenPositionCount(),
    note: "Existing positions remain open. Monitor them manually or close via the API.",
  });
});

// Alias: POST /api/ghost/stop-trading (PROTECTED)
router.post("/stop-trading", requireAdminKey, async (req: Request, res: Response) => {
  const trader = getGhostTrader();
  await trader.disableTrading();

  res.json({
    success: true,
    message: "Ghost trading STOPPED",
    openPositions: trader.getOpenPositionCount(),
  });
});

// POST /api/ghost/config - Update trading configuration
router.post("/config", requireAdminKey, (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const allowedNumericUpdates = [
    "minPositionSol",
    "maxPositionSol",
    "maxTotalExposureSol",
    "maxOpenPositions",
    "stopLossPercent",
    "partialSellPercent",
    "trailingStopPercent",
    "deadPositionDecayPercent",
    "maxHoldTimeMinutes",
    "minVolumeToHoldUsd",
    "minLiquidityUsd",
    "maxCreatorFeeBps",
    "slippageBps",
    "maxPriceImpactPercent",
  ];

  const updates: Record<string, number | number[]> = {};

  // Handle numeric fields
  for (const key of allowedNumericUpdates) {
    if (req.body[key] !== undefined) {
      const value = parseFloat(req.body[key]);
      if (isNaN(value)) {
        res.status(400).json({
          success: false,
          error: `Invalid value for ${key}: must be a number`,
        });
        return;
      }
      updates[key] = value;
    }
  }

  // Handle takeProfitTiers (array of numbers)
  // Accepts: [1.5, 2.0, 3.0] or "1.5,2.0,3.0"
  if (req.body.takeProfitTiers !== undefined) {
    let tiers: number[];
    if (Array.isArray(req.body.takeProfitTiers)) {
      tiers = req.body.takeProfitTiers.map(Number);
    } else if (typeof req.body.takeProfitTiers === "string") {
      tiers = req.body.takeProfitTiers.split(",").map((s: string) => parseFloat(s.trim()));
    } else {
      res.status(400).json({
        success: false,
        error: "takeProfitTiers must be an array of numbers or comma-separated string",
      });
      return;
    }

    if (tiers.some(isNaN) || tiers.length === 0) {
      res.status(400).json({
        success: false,
        error: "takeProfitTiers must contain valid numbers (e.g. [1.5, 2.0, 3.0])",
      });
      return;
    }

    updates.takeProfitTiers = tiers;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({
      success: false,
      error: "No valid updates provided",
      allowedFields: [...allowedNumericUpdates, "takeProfitTiers"],
    });
    return;
  }

  trader.setConfig(updates);

  res.json({
    success: true,
    message: "Config updated",
    updates,
    currentConfig: trader.getConfig(),
  });
});

// POST /api/ghost/evaluate - Manually trigger evaluation (PROTECTED)
// Works in both enabled (live) and disabled (dry-run) modes
// SECURITY: Requires admin key because live mode executes REAL trades
router.post("/evaluate", requireAdminKey, async (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const isEnabled = trader.isEnabled();
  const statsBefore = trader.getStats();

  try {
    if (isEnabled) {
      // Live mode - actually execute trades
      await trader.evaluateAndTrade();
      const statsAfter = trader.getStats();

      res.json({
        success: true,
        mode: "live",
        message: "Live evaluation completed",
        positionsBefore: statsBefore.openPositions,
        positionsAfter: statsAfter.openPositions,
        newPositions: statsAfter.openPositions - statsBefore.openPositions,
      });
    } else {
      // Dry-run mode - evaluate but don't trade
      const bagsApi = (await import("../services/BagsApiService.js")).getBagsApiService();
      const launches = await bagsApi.getRecentLaunches(20);

      // Run evaluation logic without executing
      const evaluations = [];
      for (const launch of launches) {
        const evaluation = await trader.evaluateLaunchPublic(launch);
        evaluations.push({
          token: { name: launch.name, symbol: launch.symbol, mint: launch.mint },
          score: evaluation.score,
          shouldBuy: evaluation.shouldBuy,
          reasons: evaluation.reasons,
          redFlags: evaluation.redFlags,
          suggestedAmount: evaluation.suggestedAmount,
          metrics: evaluation.metrics,
        });
      }

      evaluations.sort((a, b) => b.score - a.score);

      res.json({
        success: true,
        mode: "dry-run",
        message: `Evaluated ${launches.length} launches (trading disabled)`,
        launchesFound: launches.length,
        buySignals: evaluations.filter((e) => e.shouldBuy).length,
        evaluations: evaluations.slice(0, 10), // Top 10
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Evaluation failed",
    });
  }
});

// GET /api/ghost/debug-evaluate - Debug: show actual GhostTrader evaluation results
router.get("/debug-evaluate", async (req: Request, res: Response) => {
  try {
    const trader = getGhostTrader();
    const bagsApi = (await import("../services/BagsApiService.js")).getBagsApiService();

    // Get launches with _dexData
    const launches = await bagsApi.getRecentLaunches(10);

    // Evaluate each through actual GhostTrader
    const evaluations = [];
    for (const launch of launches) {
      const evaluation = await trader.evaluateLaunchPublic(launch);
      evaluations.push({
        token: { name: launch.name, symbol: launch.symbol, mint: launch.mint },
        _dexData: launch._dexData, // Show the raw DexScreener data
        score: evaluation.score,
        shouldBuy: evaluation.shouldBuy,
        reasons: evaluation.reasons,
        redFlags: evaluation.redFlags,
        metrics: evaluation.metrics,
      });
    }

    evaluations.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      tradingEnabled: trader.isEnabled(),
      launchesFound: launches.length,
      buySignals: evaluations.filter(e => e.shouldBuy).length,
      evaluations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Debug evaluation failed",
    });
  }
});

// POST /api/ghost/check-positions - Manually trigger position check (PROTECTED)
// SECURITY: Requires admin key because live mode can CLOSE positions (sell tokens)
router.post("/check-positions", requireAdminKey, async (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const openBefore = trader.getOpenPositionCount();

  if (openBefore === 0) {
    res.json({
      success: true,
      message: "No open positions to check",
      openPositions: 0,
    });
    return;
  }

  if (!trader.isEnabled()) {
    // Return position status without executing closes
    const positions = trader.getOpenPositions();
    res.json({
      success: true,
      mode: "dry-run",
      message: "Position status (trading disabled - no closes executed)",
      openPositions: positions.length,
      positions: positions.map((p) => ({
        symbol: p.tokenSymbol,
        amountSol: p.amountSol,
        entryReason: p.entryReason,
      })),
    });
    return;
  }

  try {
    await trader.checkPositions();
    const openAfter = trader.getOpenPositionCount();

    res.json({
      success: true,
      mode: "live",
      message: "Position check completed",
      openPositionsBefore: openBefore,
      openPositionsAfter: openAfter,
      positionsClosed: openBefore - openAfter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Position check failed",
    });
  }
});

// POST /api/ghost/buy - Manually buy a specific token (PROTECTED)
router.post("/buy", requireAdminKey, async (req: Request, res: Response) => {
  const { mint, amountSol } = req.body;
  const trader = getGhostTrader();

  if (!mint || typeof mint !== "string") {
    res.status(400).json({ success: false, error: "Missing or invalid mint address" });
    return;
  }

  if (!trader.isEnabled()) {
    res.status(400).json({
      success: false,
      error: "Trading is disabled",
      message: "Enable trading first to execute manual buys",
    });
    return;
  }

  const amount = amountSol ? parseFloat(amountSol) : 0.1;
  if (isNaN(amount) || amount < 0.01 || amount > 1) {
    res.status(400).json({
      success: false,
      error: "Invalid amount",
      message: "Amount must be between 0.01 and 1 SOL",
    });
    return;
  }

  try {
    const result = await trader.manualBuy(mint, amount);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Manual buy failed",
    });
  }
});

// POST /api/ghost/sell - Manually sell a position (PROTECTED)
router.post("/sell", requireAdminKey, async (req: Request, res: Response) => {
  const { positionId } = req.body;
  const trader = getGhostTrader();

  if (!positionId || typeof positionId !== "string") {
    res.status(400).json({ success: false, error: "Missing or invalid positionId" });
    return;
  }

  if (!trader.isEnabled()) {
    res.status(400).json({
      success: false,
      error: "Trading is disabled",
      message: "Enable trading first to execute manual sells",
    });
    return;
  }

  try {
    const result = await trader.manualSell(positionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Manual sell failed",
    });
  }
});

// GET /api/ghost/dry-run - Evaluate launches without trading (no wallet required)
// Add ?mock=true to use test data when no real launches available
router.get("/dry-run", async (req: Request, res: Response) => {
  const useMockData = req.query.mock === "true";
  const trader = getGhostTrader();
  const bagsApi = (await import("../services/BagsApiService.js")).getBagsApiService();

  try {
    // Fetch recent launches or use mock data for testing
    let launches = await bagsApi.getRecentLaunches(10);
    let usingMockData = false;

    // Mock data for testing when no real launches available
    if (launches.length === 0 && useMockData) {
      usingMockData = true;
      const now = Date.now();
      launches = [
        {
          mint: "MOCK1111111111111111111111111111111111111111",
          name: "Strong Token",
          symbol: "STRONG",
          launchedAt: now - 180000, // 3 min ago
          creator: "creator1",
          initialMarketCap: 250000,
        },
        {
          mint: "MOCK2222222222222222222222222222222222222222",
          name: "Weak Token",
          symbol: "WEAK",
          launchedAt: now - 300000, // 5 min ago
          creator: "creator2",
          initialMarketCap: 15000, // Below minimum
        },
        {
          mint: "MOCK3333333333333333333333333333333333333333",
          name: "Old Token",
          symbol: "OLD",
          launchedAt: now - 7200000, // 2 hours ago (too old)
          creator: "creator3",
          initialMarketCap: 100000,
        },
        {
          mint: "MOCK4444444444444444444444444444444444444444",
          name: "Hot Token",
          symbol: "HOT",
          launchedAt: now - 240000, // 4 min ago
          creator: "creator4",
          initialMarketCap: 500000,
        },
      ];
    }

    if (launches.length === 0) {
      res.json({
        success: true,
        message: "No recent launches found. Add ?mock=true to test with mock data.",
        evaluations: [],
      });
      return;
    }

    // Evaluate each launch (using the internal method via reflection)
    const evaluations = [];
    const config = trader.getConfig();

    // Mock token data for testing
    const mockTokenData: Record<
      string,
      { marketCap: number; volume24h: number; holders: number; lifetimeFees: number }
    > = {
      MOCK1111111111111111111111111111111111111111: {
        marketCap: 250000,
        volume24h: 45000,
        holders: 35,
        lifetimeFees: 0.08,
      },
      MOCK2222222222222222222222222222222222222222: {
        marketCap: 15000,
        volume24h: 500,
        holders: 5,
        lifetimeFees: 0.001,
      },
      MOCK3333333333333333333333333333333333333333: {
        marketCap: 100000,
        volume24h: 8000,
        holders: 20,
        lifetimeFees: 0.02,
      },
      MOCK4444444444444444444444444444444444444444: {
        marketCap: 500000,
        volume24h: 80000,
        holders: 60,
        lifetimeFees: 0.15,
      },
    };

    for (const launch of launches) {
      const token = usingMockData ? null : await bagsApi.getToken(launch.mint);
      const mockData = mockTokenData[launch.mint];
      const ageSeconds = Math.floor((Date.now() - launch.launchedAt) / 1000);
      const marketCapUsd = token?.marketCap || mockData?.marketCap || launch.initialMarketCap || 0;
      // Use REAL DexScreener data if available, otherwise estimate
      const liquidityUsd = launch._dexData?.liquidityUsd || marketCapUsd * 0.15;
      const volume24hUsd = launch._dexData?.volume24hUsd || token?.volume24h || mockData?.volume24h || 0;
      const buys24h = launch._dexData?.buys24h || 0;
      const sells24h = launch._dexData?.sells24h || 0;
      const buySellRatio = sells24h > 0 ? buys24h / sells24h : buys24h > 0 ? 2.0 : 1.0;
      const holders = token?.holders || mockData?.holders || 0;
      const lifetimeFees = token?.lifetimeFees || mockData?.lifetimeFees || 0;

      // Simplified scoring (mirrors GhostTrader.evaluateLaunch)
      let score = 0;
      const reasons: string[] = [];
      const redFlags: string[] = [];

      // Hard filters
      if (ageSeconds < config.minLaunchAgeSec) {
        redFlags.push(`too new (${ageSeconds}s)`);
      } else if (ageSeconds > config.maxLaunchAgeSec) {
        redFlags.push(`too old (${ageSeconds}s)`);
      }
      if (liquidityUsd < config.minLiquidityUsd) {
        redFlags.push(`low liquidity ($${liquidityUsd.toFixed(0)})`);
      }
      if (marketCapUsd < config.minMarketCapUsd) {
        redFlags.push(`low mcap ($${marketCapUsd.toFixed(0)})`);
      }

      // Scoring (matched to GhostTrader micro-cap thresholds)
      if (liquidityUsd >= 10000) {
        score += 25;
        reasons.push("excellent liquidity ($10K+)");
      } else if (liquidityUsd >= 5000) {
        score += 20;
        reasons.push("strong liquidity ($5K+)");
      } else if (liquidityUsd >= 2000) {
        score += 15;
        reasons.push("good liquidity ($2K+)");
      } else if (liquidityUsd >= 1000) {
        score += 10;
        reasons.push("adequate liquidity");
      } else if (liquidityUsd >= 500) {
        score += 5;
        reasons.push("minimal liquidity");
      }

      if (volume24hUsd >= 10000) {
        score += 25;
        reasons.push("high volume ($10K+)");
      } else if (volume24hUsd >= 5000) {
        score += 20;
        reasons.push("good volume ($5K+)");
      } else if (volume24hUsd >= 1000) {
        score += 15;
        reasons.push("active trading");
      } else if (volume24hUsd >= 100) {
        score += 10;
        reasons.push("some volume");
      } else {
        score += 5;
        reasons.push("fresh token");
      }

      // Buy/sell ratio scoring
      if (buySellRatio >= 1.5) {
        score += 20;
        reasons.push(`strong buy pressure (${buySellRatio.toFixed(1)}x)`);
      } else if (buySellRatio >= 1.2) {
        score += 15;
        reasons.push("bullish ratio");
      } else if (buySellRatio >= 1.0) {
        score += 10;
        reasons.push("balanced trading");
      }

      if (holders >= 30) {
        score += 15;
        reasons.push("well distributed");
      } else if (holders >= 15) {
        score += 12;
        reasons.push("growing holders");
      } else if (holders >= 5) {
        score += 8;
        reasons.push("accumulating");
      } else {
        score += 5;
        reasons.push("early stage");
      }

      if (lifetimeFees > 0.05) {
        score += 20;
        reasons.push("strong fees");
      } else if (lifetimeFees > 0.01) {
        score += 12;
        reasons.push("positive fees");
      }

      if (ageSeconds >= 120 && ageSeconds <= 600) {
        score += 15;
        reasons.push("optimal timing");
      } else if (ageSeconds <= 900) {
        score += 10;
        reasons.push("good timing");
      }

      // Note: Actual GhostTrader uses vol/mcap scoring with threshold 60
      // This dry-run uses simplified scoring - actual results may differ
      const shouldBuy = score >= 60 && redFlags.length === 0;

      evaluations.push({
        token: {
          name: launch.name,
          symbol: launch.symbol,
          mint: launch.mint,
        },
        metrics: {
          ageSeconds,
          marketCapUsd: Math.round(marketCapUsd),
          liquidityUsd: Math.round(liquidityUsd),
          volume24hUsd: Math.round(volume24hUsd),
          buySellRatio: buySellRatio.toFixed(2),
          holders,
          lifetimeFees: lifetimeFees.toFixed(4),
        },
        score,
        reasons,
        redFlags,
        verdict: shouldBuy ? "BUY" : "PASS",
      });
    }

    // Sort by score
    evaluations.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      message: usingMockData
        ? `Evaluated ${evaluations.length} MOCK launches (no real launches available)`
        : `Evaluated ${evaluations.length} recent launches`,
      mockData: usingMockData,
      config: {
        minLiquidityUsd: config.minLiquidityUsd,
        minMarketCapUsd: config.minMarketCapUsd,
        minLaunchAgeSec: config.minLaunchAgeSec,
        maxLaunchAgeSec: config.maxLaunchAgeSec,
        requiredScore: 60, // Actual threshold used by GhostTrader
      },
      evaluations,
      summary: {
        total: evaluations.length,
        buySignals: evaluations.filter((e) => e.verdict === "BUY").length,
        passSignals: evaluations.filter((e) => e.verdict === "PASS").length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Dry run failed",
    });
  }
});

// GET /api/ghost/study-wallet/:address - Analyze wallet's token holdings and trading patterns
router.get("/study-wallet/:address", async (req: Request, res: Response) => {
  const address = req.params.address as string;
  const trader = getGhostTrader();
  const bagsApi = (await import("../services/BagsApiService.js")).getBagsApiService();

  // Validate Solana address format
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    res.status(400).json({ success: false, error: "Invalid Solana address format" });
    return;
  }

  try {
    // 1. Get SOL balance
    const balanceResponse = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
    });
    const balanceData = (await balanceResponse.json()) as { result?: { value: number } };
    const solBalance = (balanceData.result?.value || 0) / 1_000_000_000;

    // 2. Get token accounts (holdings)
    const tokenResponse = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "getTokenAccountsByOwner",
        params: [
          address,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed" },
        ],
      }),
    });
    const tokenData = (await tokenResponse.json()) as {
      result?: {
        value: Array<{
          account: {
            data: {
              parsed: {
                info: {
                  mint: string;
                  tokenAmount: { uiAmount: number; decimals: number };
                };
              };
            };
          };
        }>;
      };
    };

    const holdings: Array<{
      mint: string;
      balance: number;
      tokenInfo: { name?: string; symbol?: string; marketCap?: number } | null;
    }> = [];

    // 3. Analyze each token holding
    const tokenAccounts = tokenData.result?.value || [];
    for (const account of tokenAccounts.slice(0, 20)) {
      // Limit to 20 tokens
      const info = account.account.data.parsed.info;
      const balance = info.tokenAmount.uiAmount;

      if (balance > 0) {
        // Try to get token info from Bags.fm
        const tokenInfo = await bagsApi.getToken(info.mint);
        holdings.push({
          mint: info.mint,
          balance,
          tokenInfo: tokenInfo
            ? {
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                marketCap: tokenInfo.marketCap,
              }
            : null,
        });
      }
    }

    // 4. Identify Bags.fm tokens (tokens with info from Bags API)
    const bagsTokens = holdings.filter((h) => h.tokenInfo !== null);
    const unknownTokens = holdings.filter((h) => h.tokenInfo === null);

    // 5. Check if this is a smart money wallet
    const smartMoneyWallets = trader.getSmartMoneyWallets();
    const isSmartMoney = smartMoneyWallets.includes(address);

    // 6. Calculate trading style insights
    const avgMarketCap =
      bagsTokens.length > 0
        ? bagsTokens.reduce((sum, t) => sum + (t.tokenInfo?.marketCap || 0), 0) / bagsTokens.length
        : 0;

    const tradingStyle =
      avgMarketCap > 500000
        ? "blue-chip"
        : avgMarketCap > 100000
          ? "mid-cap"
          : avgMarketCap > 25000
            ? "small-cap"
            : "micro-cap";

    res.json({
      success: true,
      wallet: {
        address,
        solBalance: solBalance.toFixed(4),
        isSmartMoney,
        isOwnerWallet: address === "Ccs9wSrEwmKx7iBD9H4xqd311eJUd2ufDk2ip87Knbo3",
      },
      holdings: {
        total: holdings.length,
        bagsTokens: bagsTokens.length,
        unknownTokens: unknownTokens.length,
      },
      bagsTokens: bagsTokens.map((t) => ({
        symbol: t.tokenInfo?.symbol,
        name: t.tokenInfo?.name,
        mint: t.mint.slice(0, 8) + "...",
        balance: t.balance.toLocaleString(),
        marketCap: t.tokenInfo?.marketCap
          ? `$${(t.tokenInfo.marketCap / 1000).toFixed(1)}K`
          : "unknown",
      })),
      insights: {
        tradingStyle,
        avgMarketCap: avgMarketCap > 0 ? `$${(avgMarketCap / 1000).toFixed(1)}K` : "N/A",
        diversification:
          holdings.length > 10 ? "high" : holdings.length > 5 ? "medium" : "concentrated",
      },
      learningNotes: [
        isSmartMoney
          ? "This wallet is tracked as smart money"
          : "Add to smart money list with POST /api/ghost/add-wallet",
        bagsTokens.length > 0
          ? `Holding ${bagsTokens.length} Bags.fm tokens - Ghost can learn from these`
          : "No Bags.fm tokens detected",
        `Trading style appears to be ${tradingStyle} focused`,
      ],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Wallet analysis failed",
    });
  }
});

// POST /api/ghost/add-wallet - Add a wallet to smart money tracking (PROTECTED)
// SECURITY: Requires admin key - adding wallets affects copy trading decisions
router.post("/add-wallet", requireAdminKey, (req: Request, res: Response) => {
  const { address, label } = req.body;

  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    res.status(400).json({ success: false, error: "Invalid Solana address" });
    return;
  }

  const trader = getGhostTrader();
  const helius = getHeliusService();
  const currentWallets = trader.getSmartMoneyWallets();

  // Add to Helius tracking for real-time alerts
  helius.trackWallet(address, label);

  if (currentWallets.includes(address)) {
    res.json({
      success: true,
      message: "Wallet already in smart money list, now also tracking via Helius",
      wallets: currentWallets,
    });
    return;
  }

  res.json({
    success: true,
    message: `Wallet ${address.slice(0, 8)}... added to tracking`,
    label: label || "unnamed",
    heliusTracking: helius.isReady(),
    note: helius.isReady()
      ? "Real-time trade alerts enabled"
      : "Set HELIUS_API_KEY for real-time tracking",
    currentWallets: [...currentWallets, address],
  });
});

// ============================================================================
// HELIUS INTEGRATION - Real-time trade tracking
// ============================================================================

// GET /api/ghost/helius/status - Check Helius integration status
router.get("/helius/status", (req: Request, res: Response) => {
  const helius = getHeliusService();

  res.json({
    success: true,
    helius: {
      configured: helius.isReady(),
      apiKeySet: !!helius.getApiKey(),
      trackedWallets: helius.getTrackedWallets(),
    },
    instructions: helius.isReady()
      ? "Helius is ready for real-time trade tracking"
      : "Set HELIUS_API_KEY environment variable to enable real-time tracking",
  });
});

// GET /api/ghost/helius/trades/:address - Get parsed trade history for a wallet
router.get("/helius/trades/:address", async (req: Request, res: Response) => {
  const address = req.params.address as string;
  const limit = parseInt(req.query.limit as string) || 50;

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    res.status(400).json({ success: false, error: "Invalid Solana address" });
    return;
  }

  const helius = getHeliusService();

  try {
    const history = await helius.getWalletTrades(address, limit);

    res.json({
      success: true,
      heliusEnabled: helius.isReady(),
      wallet: address,
      stats: history.stats,
      trades: history.trades.map((t) => ({
        signature: t.signature.slice(0, 16) + "...",
        type: t.type,
        tokenMint: t.tokenMint ? t.tokenMint.slice(0, 8) + "..." : null,
        tokenAmount: t.tokenAmount.toLocaleString(),
        solAmount: t.solAmount.toFixed(4),
        source: t.source,
        time: new Date(t.timestamp).toISOString(),
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch trades",
    });
  }
});

// GET /api/ghost/helius/patterns/:address - Analyze trading patterns
router.get("/helius/patterns/:address", async (req: Request, res: Response) => {
  const address = req.params.address as string;

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    res.status(400).json({ success: false, error: "Invalid Solana address" });
    return;
  }

  const helius = getHeliusService();

  try {
    const patterns = await helius.analyzeWalletPatterns(address);
    const history = await helius.getWalletTrades(address, 50);

    res.json({
      success: true,
      heliusEnabled: helius.isReady(),
      wallet: address,
      tradingStats: history.stats,
      patterns: {
        avgBuySize: patterns.avgBuySize.toFixed(4) + " SOL",
        avgSellSize: patterns.avgSellSize.toFixed(4) + " SOL",
        preferredDexes: patterns.preferredDexes,
        activeTradingHours: patterns.tradingHours.map((h) => `${h}:00 UTC`),
        estimatedWinRate: (patterns.winRate * 100).toFixed(1) + "%",
      },
      learningInsights: [
        patterns.avgBuySize > 0.1
          ? `Trades with avg ${patterns.avgBuySize.toFixed(2)} SOL - consider similar position sizes`
          : "Small position sizes detected",
        patterns.preferredDexes.length > 0
          ? `Prefers: ${patterns.preferredDexes.join(", ")}`
          : "No DEX preference detected",
        patterns.tradingHours.length > 0
          ? `Most active around ${patterns.tradingHours[0]}:00 UTC`
          : "No clear trading schedule",
      ],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze patterns",
    });
  }
});

// GET /api/ghost/helius/alerts - Get recent smart money trade alerts
router.get("/helius/alerts", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const helius = getHeliusService();
  const alerts = helius.getRecentAlerts(limit);

  res.json({
    success: true,
    heliusEnabled: helius.isReady(),
    alertCount: alerts.length,
    alerts: alerts.map((a) => ({
      wallet: a.walletLabel || a.wallet.slice(0, 8) + "...",
      type: a.trade.type,
      token: a.trade.tokenMint ? a.trade.tokenMint.slice(0, 8) + "..." : null,
      solAmount: a.trade.solAmount.toFixed(4),
      source: a.trade.source,
      time: new Date(a.timestamp).toISOString(),
      isSmartMoney: a.isSmartMoney,
    })),
  });
});

// POST /api/ghost/helius/poll - Manually trigger polling of tracked wallets (PROTECTED)
// SECURITY: Requires admin key - polling can trigger copy trades
router.post("/helius/poll", requireAdminKey, async (req: Request, res: Response) => {
  const helius = getHeliusService();

  if (!helius.isReady()) {
    res.status(400).json({
      success: false,
      error: "Helius not configured",
      message: "Set HELIUS_API_KEY to enable real-time tracking",
    });
    return;
  }

  try {
    const newAlerts = await helius.pollTrackedWallets();

    res.json({
      success: true,
      newAlerts: newAlerts.length,
      alerts: newAlerts.map((a) => ({
        wallet: a.walletLabel || a.wallet.slice(0, 8) + "...",
        type: a.trade.type,
        token: a.trade.tokenMint?.slice(0, 8) + "...",
        solAmount: a.trade.solAmount.toFixed(4),
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Polling failed",
    });
  }
});

// POST /api/ghost/learn-from-wallet - Have Ghost analyze and learn from a wallet's patterns (PROTECTED)
// SECURITY: Requires admin key - learning affects trading strategy
router.post("/learn-from-wallet", requireAdminKey, async (req: Request, res: Response) => {
  const { address } = req.body;

  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    res.status(400).json({ success: false, error: "Invalid Solana address" });
    return;
  }

  const helius = getHeliusService();
  const trader = getGhostTrader();

  try {
    // Get trading history
    const history = await helius.getWalletTrades(address, 100);
    const patterns = await helius.analyzeWalletPatterns(address);

    // Add to tracking
    helius.trackWallet(address, "learning-target");

    // Generate learning recommendations
    const currentConfig = trader.getConfig();
    const recommendations: string[] = [];

    // Position sizing recommendation
    if (patterns.avgBuySize > 0) {
      if (patterns.avgBuySize > currentConfig.maxPositionSol) {
        recommendations.push(
          `Consider increasing maxPositionSol to ${patterns.avgBuySize.toFixed(2)} SOL to match trading style`
        );
      } else if (patterns.avgBuySize < currentConfig.minPositionSol) {
        recommendations.push(
          `Consider decreasing minPositionSol to ${patterns.avgBuySize.toFixed(2)} SOL`
        );
      }
    }

    // Activity recommendation
    if (history.stats.totalTrades > 20) {
      recommendations.push(
        `Active trader with ${history.stats.totalTrades} trades - consider more frequent evaluations`
      );
    }

    // Win rate
    if (patterns.winRate > 0.5) {
      recommendations.push(
        `Estimated ${(patterns.winRate * 100).toFixed(0)}% win rate - study entry timing`
      );
    }

    res.json({
      success: true,
      wallet: address,
      heliusEnabled: helius.isReady(),
      analysis: {
        totalTrades: history.stats.totalTrades,
        buys: history.stats.buys,
        sells: history.stats.sells,
        volumeSol: history.stats.totalVolumeSol.toFixed(2),
        uniqueTokens: history.stats.uniqueTokens,
      },
      patterns: {
        avgBuySize: patterns.avgBuySize.toFixed(4) + " SOL",
        avgSellSize: patterns.avgSellSize.toFixed(4) + " SOL",
        preferredDexes: patterns.preferredDexes,
        tradingHours: patterns.tradingHours.map((h) => `${h}:00 UTC`),
      },
      recommendations,
      status: "Wallet added to tracking - Ghost will learn from future trades",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Learning analysis failed",
    });
  }
});

// ============================================================================
// Smart Money Routes
// ============================================================================

// GET /api/ghost/smart-money - List all tracked smart money wallets
router.get("/smart-money", (req: Request, res: Response) => {
  const smartMoney = getSmartMoneyService();
  const wallets = smartMoney.getAllWallets();

  res.json({
    success: true,
    count: wallets.length,
    wallets: wallets.map((w) => ({
      address: w.address,
      label: w.label,
      winRate: (w.winRate * 100).toFixed(1) + "%",
      totalPnlSol: w.totalPnlSol.toFixed(2),
      avgHoldTime: w.avgHoldTime + " min",
      preferredMcap: w.preferredMcapRange,
      source: w.source,
    })),
  });
});

// GET /api/ghost/smart-money/alerts - Recent smart money activity
router.get("/smart-money/alerts", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const smartMoney = getSmartMoneyService();
  const alerts = smartMoney.getRecentAlerts(limit);

  res.json({
    success: true,
    count: alerts.length,
    alerts: alerts.map((a) => ({
      wallet: a.walletLabel,
      action: a.action,
      tokenMint: a.tokenMint.slice(0, 8) + "...",
      tokenSymbol: a.tokenSymbol || "???",
      amountSol: a.amountSol.toFixed(4),
      time: new Date(a.timestamp).toISOString(),
    })),
  });
});

// GET /api/ghost/smart-money/score/:mint - Get smart money score for a token
router.get("/smart-money/score/:mint", async (req: Request, res: Response) => {
  const mint = req.params.mint as string;
  const smartMoney = getSmartMoneyService();

  const score = await smartMoney.getSmartMoneyScore(mint);

  res.json({
    success: true,
    tokenMint: mint,
    smartMoneyScore: score.score,
    buyerCount: score.buyers.length,
    buyers: score.buyers,
    signals: score.signals,
    recommendation:
      score.score >= 50
        ? "STRONG BUY SIGNAL"
        : score.score >= 25
          ? "moderate interest"
          : "no significant activity",
  });
});

// POST /api/ghost/smart-money/refresh - Refresh smart money wallet list from GMGN (PROTECTED)
// SECURITY: Requires admin key - modifying wallet list affects trading decisions
router.post("/smart-money/refresh", requireAdminKey, async (req: Request, res: Response) => {
  const smartMoney = getSmartMoneyService();
  const beforeCount = smartMoney.getAllWallets().length;

  await smartMoney.refreshSmartMoneyList();

  const afterCount = smartMoney.getAllWallets().length;

  res.json({
    success: true,
    message: "Smart money list refreshed",
    walletsBefore: beforeCount,
    walletsAfter: afterCount,
    newWallets: afterCount - beforeCount,
  });
});

// POST /api/ghost/smart-money/record - Record smart money activity (PROTECTED)
// SECURITY: Requires admin key - injecting fake activity could manipulate trading
router.post("/smart-money/record", requireAdminKey, (req: Request, res: Response) => {
  const { wallet, tokenMint, action, amountSol } = req.body;

  if (!wallet || !tokenMint || !action || !amountSol) {
    res.status(400).json({ success: false, error: "Missing required fields" });
    return;
  }

  const smartMoney = getSmartMoneyService();

  if (!smartMoney.isSmartMoney(wallet)) {
    res.status(400).json({ success: false, error: "Wallet is not in smart money list" });
    return;
  }

  smartMoney.recordActivity(tokenMint, wallet, action, parseFloat(amountSol));

  res.json({
    success: true,
    message: "Activity recorded",
    wallet: smartMoney.getWalletInfo(wallet)?.label || wallet.slice(0, 8),
    action,
    tokenMint: tokenMint.slice(0, 8) + "...",
    amountSol,
  });
});

// ============================================================================
// Helius Webhook - Real-time smart money alerts
// ============================================================================

// POST /api/ghost/webhook/helius - Helius webhook endpoint
// Set this URL in your Helius dashboard: https://your-app.up.railway.app/api/ghost/webhook/helius
router.post("/webhook/helius", async (req: Request, res: Response) => {
  // Verify webhook secret
  const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;
  const authHeader = req.headers["authorization"];

  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    console.warn("[Webhook] Invalid authorization header");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const events = Array.isArray(req.body) ? req.body : [req.body];
  const smartMoney = getSmartMoneyService();
  const copyTrader = getCopyTraderService();

  let processed = 0;
  let copySignals = 0;

  for (const event of events) {
    try {
      // Parse Helius enhanced transaction format
      const { type, feePayer, signature, tokenTransfers, nativeTransfers } = event;

      // Skip if not a swap/trade
      if (type !== "SWAP" && type !== "TRANSFER") continue;

      // Check if feePayer is a tracked smart money wallet
      if (!smartMoney.isSmartMoney(feePayer)) continue;

      // Parse the trade
      let action: "buy" | "sell" = "buy";
      let tokenMint = "";
      let tokenSymbol = "";
      let amountSol = 0;

      // Check token transfers for the trade details
      if (tokenTransfers && tokenTransfers.length > 0) {
        const transfer = tokenTransfers[0];
        tokenMint = transfer.mint;
        tokenSymbol = transfer.tokenStandard || "???";

        // If wallet received tokens, it's a buy
        if (transfer.toUserAccount === feePayer) {
          action = "buy";
        } else {
          action = "sell";
        }
      }

      // Get SOL amount from native transfers
      if (nativeTransfers && nativeTransfers.length > 0) {
        for (const nt of nativeTransfers) {
          if (nt.fromUserAccount === feePayer) {
            amountSol += nt.amount / 1_000_000_000;
          }
        }
      }

      if (!tokenMint || amountSol === 0) continue;

      // Record the activity
      smartMoney.recordActivity(tokenMint, feePayer, action, amountSol);

      // Check if we should copy this trade
      const copyResult = await copyTrader.handleSmartMoneyTrade({
        wallet: feePayer,
        action,
        tokenMint,
        tokenSymbol,
        amountSol,
        txSignature: signature,
      });

      if (copyResult.shouldCopy) {
        copySignals++;
        console.log(
          `[Webhook] Smart money ${action}: ${amountSol.toFixed(2)} SOL of ${tokenSymbol} - ${copyResult.reason}`
        );
      }

      processed++;
    } catch (error) {
      console.error("[Webhook] Error processing event:", error);
    }
  }

  res.json({
    success: true,
    processed,
    copySignals,
  });
});

// ============================================================================
// Copy Trader Routes
// ============================================================================

// GET /api/ghost/copy-trader/status - Copy trader status and stats
router.get("/copy-trader/status", (req: Request, res: Response) => {
  const copyTrader = getCopyTraderService();
  const stats = copyTrader.getStats();
  const config = copyTrader.getConfig();
  const limits = copyTrader.getSafetyLimits();

  res.json({
    success: true,
    enabled: stats.enabled,
    config: {
      sizeMultiplier: config.sizeMultiplier,
      copyBuysOnly: config.copyBuysOnly,
      requireApproval: config.requireApproval,
      whitelistCount: config.walletWhitelist.length,
    },
    stats: {
      totalCopied: stats.totalCopied,
      successfulCopies: stats.successfulCopies,
      failedCopies: stats.failedCopies,
      copiesThisHour: stats.copiesThisHour,
      maxCopiesPerHour: limits.MAX_COPIES_PER_HOUR,
      pendingApprovals: stats.pendingApprovals,
      lastCopyTime: stats.lastCopyTime ? new Date(stats.lastCopyTime).toISOString() : null,
    },
    safetyLimits: {
      maxCopyAmountSol: limits.MAX_COPY_AMOUNT_SOL,
      maxCopyExposureSol: limits.MAX_COPY_EXPOSURE_SOL,
      minWalletWinRate: (limits.MIN_WALLET_WIN_RATE * 100).toFixed(0) + "%",
      minTradeIntervalSec: limits.MIN_TRADE_INTERVAL_MS / 1000,
      lossCooldownMin: limits.LOSS_COOLDOWN_MS / 60000,
    },
  });
});

// POST /api/ghost/copy-trader/enable - Enable copy trading (DANGEROUS) (PROTECTED)
router.post("/copy-trader/enable", requireAdminKey, async (req: Request, res: Response) => {
  const { confirmPhrase } = req.body;
  const copyTrader = getCopyTraderService();

  const result = await copyTrader.enable(confirmPhrase);

  if (result.success) {
    res.json({
      success: true,
      message: "⚠️ COPY TRADING ENABLED",
      warning: [
        "Ghost will now AUTOMATICALLY execute trades when smart money buys",
        "This uses REAL SOL from your wallet",
        "Monitor closely and disable if needed",
      ],
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error,
      hint: "Send { confirmPhrase: 'i accept copy trading risks' }",
    });
  }
});

// POST /api/ghost/copy-trader/disable - Disable copy trading (PROTECTED)
router.post("/copy-trader/disable", requireAdminKey, async (req: Request, res: Response) => {
  const copyTrader = getCopyTraderService();
  await copyTrader.disable();

  res.json({
    success: true,
    message: "Copy trading DISABLED",
  });
});

// GET /api/ghost/copy-trader/pending - List pending trade approvals
router.get("/copy-trader/pending", (req: Request, res: Response) => {
  const copyTrader = getCopyTraderService();
  const pending = copyTrader.getPendingTrades();

  res.json({
    success: true,
    count: pending.length,
    trades: pending.map((t) => ({
      id: t.id,
      sourceWallet: t.sourceWalletLabel,
      action: t.action,
      tokenMint: t.tokenMint.slice(0, 8) + "...",
      tokenSymbol: t.tokenSymbol,
      originalAmountSol: t.originalAmountSol.toFixed(4),
      suggestedAmountSol: t.suggestedAmountSol.toFixed(4),
      expiresIn: Math.max(0, Math.floor((t.expiresAt - Date.now()) / 1000)) + "s",
    })),
  });
});

// POST /api/ghost/copy-trader/approve/:id - Approve a pending trade (PROTECTED)
router.post("/copy-trader/approve/:id", requireAdminKey, async (req: Request, res: Response) => {
  const tradeId = req.params.id as string;
  const copyTrader = getCopyTraderService();

  const result = await copyTrader.approveTrade(tradeId);

  if (result.success) {
    res.json({
      success: true,
      message: "Trade executed",
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error,
    });
  }
});

// POST /api/ghost/copy-trader/reject/:id - Reject a pending trade (PROTECTED)
router.post("/copy-trader/reject/:id", requireAdminKey, async (req: Request, res: Response) => {
  const tradeId = req.params.id as string;
  const copyTrader = getCopyTraderService();

  await copyTrader.rejectTrade(tradeId);

  res.json({
    success: true,
    message: "Trade rejected",
  });
});

// POST /api/ghost/copy-trader/config - Update copy trader config (PROTECTED)
router.post("/copy-trader/config", requireAdminKey, async (req: Request, res: Response) => {
  const copyTrader = getCopyTraderService();

  try {
    await copyTrader.updateConfig(req.body);

    res.json({
      success: true,
      message: "Config updated",
      config: copyTrader.getConfig(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Invalid config",
    });
  }
});

// GET /api/ghost/copy-trader/history - Recent copy trade executions
router.get("/copy-trader/history", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const copyTrader = getCopyTraderService();
  const executions = copyTrader.getRecentExecutions(limit);

  res.json({
    success: true,
    count: executions.length,
    executions: executions.map((t) => ({
      sourceWallet: t.sourceWalletLabel,
      action: t.action,
      tokenSymbol: t.tokenSymbol,
      amountSol: t.suggestedAmountSol.toFixed(4),
      status: t.status,
      time: new Date(t.timestamp).toISOString(),
    })),
  });
});

// ============================================================================
// Telegram Broadcasting Routes
// ============================================================================

// GET /api/ghost/telegram/status - Get Telegram broadcast status (PROTECTED)
router.get("/telegram/status", requireAdminKey, async (req: Request, res: Response) => {
  const broadcaster = getTelegramBroadcaster();
  const stats = await broadcaster.getStats();
  const config = broadcaster.getConfig();

  res.json({
    success: true,
    telegram: {
      enabled: stats.enabled,
      configured: stats.configured,
      channelId: config.channelId || "(not set)",
      minScoreToPost: config.minScoreToPost,
      includeRiskLevel: config.includeRiskLevel,
      includeDexscreenerLink: config.includeDexscreenerLink,
      includeBagsLink: config.includeBagsLink,
    },
    stats: {
      messagesSentLast1h: stats.messagesSentLast1h,
      messagesSentLast24h: stats.messagesSentLast24h,
      pendingMessages: stats.pendingMessages,
      rateLimited: stats.rateLimited,
    },
  });
});

// POST /api/ghost/telegram/enable - Enable Telegram broadcasting (PROTECTED)
router.post("/telegram/enable", requireAdminKey, (req: Request, res: Response) => {
  const broadcaster = getTelegramBroadcaster();

  if (!broadcaster.isConfigured()) {
    res.status(400).json({
      success: false,
      error: "Telegram not configured",
      message: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID environment variables",
    });
    return;
  }

  broadcaster.enable();

  res.json({
    success: true,
    message: "Telegram broadcasting enabled",
    enabled: broadcaster.isEnabled(),
  });
});

// POST /api/ghost/telegram/disable - Disable Telegram broadcasting (PROTECTED)
router.post("/telegram/disable", requireAdminKey, (req: Request, res: Response) => {
  const broadcaster = getTelegramBroadcaster();
  broadcaster.disable();

  res.json({
    success: true,
    message: "Telegram broadcasting disabled",
    enabled: broadcaster.isEnabled(),
  });
});

// POST /api/ghost/telegram/config - Update Telegram config (PROTECTED)
router.post("/telegram/config", requireAdminKey, (req: Request, res: Response) => {
  const broadcaster = getTelegramBroadcaster();
  const { minScoreToPost, includeRiskLevel, includeDexscreenerLink, includeBagsLink } = req.body;

  broadcaster.updateConfig({
    minScoreToPost,
    includeRiskLevel,
    includeDexscreenerLink,
    includeBagsLink,
  });

  res.json({
    success: true,
    message: "Telegram config updated",
    config: broadcaster.getConfig(),
  });
});

// POST /api/ghost/telegram/test - Send a test message (PROTECTED)
router.post("/telegram/test", requireAdminKey, async (req: Request, res: Response) => {
  const broadcaster = getTelegramBroadcaster();

  if (!broadcaster.isConfigured()) {
    res.status(400).json({
      success: false,
      error: "Telegram not configured",
      message: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID environment variables",
    });
    return;
  }

  const connectionTest = await broadcaster.testConnection();
  if (!connectionTest.success) {
    res.status(500).json({
      success: false,
      error: "Bot connection failed",
      message: connectionTest.error,
    });
    return;
  }

  const messageTest = await broadcaster.sendTestMessage();
  if (!messageTest.success) {
    res.status(500).json({
      success: false,
      error: "Failed to send test message",
      message: messageTest.error,
    });
    return;
  }

  res.json({
    success: true,
    message: "Test message sent successfully",
    botName: connectionTest.botName,
    messageId: messageTest.messageId,
  });
});

// GET /api/ghost/burns - Get buy & burn history and stats
// Public endpoint - burn stats are transparent for community trust
router.get("/burns", async (req: Request, res: Response) => {
  const trader = getGhostTrader();

  try {
    const burnStats = await trader.getBurnStats();
    const config = trader.getConfig();

    res.json({
      success: true,
      burnEnabled: config.burnEnabled,
      burnPercent: config.burnPercent,
      totals: {
        totalBagsBurned: burnStats.totalBagsBurned,
        totalSolSpent: burnStats.totalSolSpent,
        burnCount: burnStats.burnCount,
      },
      burns: burnStats.burns,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch burn stats",
    });
  }
});

export default router;
