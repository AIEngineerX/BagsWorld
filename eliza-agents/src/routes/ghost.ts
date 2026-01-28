// Ghost Trading routes - Control and monitoring for Ghost's autonomous trading
// GET /api/ghost/status - Trading status and stats
// GET /api/ghost/positions - List all positions
// GET /api/ghost/positions/open - List open positions only
// POST /api/ghost/enable - Enable trading
// POST /api/ghost/disable - Disable trading (kill switch)
// POST /api/ghost/config - Update trading config
// POST /api/ghost/evaluate - Manually trigger evaluation

import { Router, Request, Response } from "express";
import { getGhostTrader } from "../services/GhostTrader.js";

const router = Router();

// GET /api/ghost/status - Get trading status and stats
router.get("/status", (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const stats = trader.getStats();
  const config = trader.getConfig();

  res.json({
    success: true,
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
      takeProfitMultiplier: config.takeProfitMultiplier,
      stopLossPercent: config.stopLossPercent,
      slippageBps: config.slippageBps,
    },
    smartMoneyWallets: trader.getSmartMoneyWallets(),
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
      entryPriceSol: p.entryPriceSol,
      amountSol: p.amountSol,
      amountTokens: p.amountTokens,
      entryReason: p.entryReason,
      entryTxSignature: p.entryTxSignature,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

// POST /api/ghost/enable - Enable trading
router.post("/enable", (req: Request, res: Response) => {
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

  trader.enableTrading();

  res.json({
    success: true,
    message: "Ghost trading ENABLED",
    warning: "Ghost will now execute real trades with real SOL. Monitor closely.",
    stats: trader.getStats(),
  });
});

// POST /api/ghost/disable - Disable trading (kill switch)
router.post("/disable", (req: Request, res: Response) => {
  const trader = getGhostTrader();
  trader.disableTrading();

  res.json({
    success: true,
    message: "Ghost trading DISABLED",
    openPositions: trader.getOpenPositionCount(),
    note: "Existing positions remain open. Monitor them manually or close via the API.",
  });
});

// Alias: POST /api/ghost/stop-trading
router.post("/stop-trading", (req: Request, res: Response) => {
  const trader = getGhostTrader();
  trader.disableTrading();

  res.json({
    success: true,
    message: "Ghost trading STOPPED",
    openPositions: trader.getOpenPositionCount(),
  });
});

// POST /api/ghost/config - Update trading configuration
router.post("/config", (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const allowedUpdates = [
    "minPositionSol",
    "maxPositionSol",
    "maxTotalExposureSol",
    "maxOpenPositions",
    "takeProfitMultiplier",
    "stopLossPercent",
    "minLiquiditySol",
    "maxCreatorFeeBps",
    "slippageBps",
  ];

  const updates: Record<string, number> = {};

  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      const value = parseFloat(req.body[key]);
      if (isNaN(value)) {
        res.status(400).json({
          success: false,
          error: `Invalid value for ${key}`,
        });
        return;
      }
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({
      success: false,
      error: "No valid updates provided",
      allowedFields: allowedUpdates,
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

// POST /api/ghost/evaluate - Manually trigger evaluation
router.post("/evaluate", async (req: Request, res: Response) => {
  const trader = getGhostTrader();

  if (!trader.isEnabled()) {
    res.status(400).json({
      success: false,
      error: "Trading is disabled",
      message: "Enable trading first or this will be a dry run",
    });
    return;
  }

  const statsBefore = trader.getStats();

  try {
    await trader.evaluateAndTrade();

    const statsAfter = trader.getStats();

    res.json({
      success: true,
      message: "Evaluation completed",
      positionsBefore: statsBefore.openPositions,
      positionsAfter: statsAfter.openPositions,
      newPositions: statsAfter.openPositions - statsBefore.openPositions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Evaluation failed",
    });
  }
});

// POST /api/ghost/check-positions - Manually trigger position check
router.post("/check-positions", async (req: Request, res: Response) => {
  const trader = getGhostTrader();

  if (!trader.isEnabled()) {
    res.status(400).json({
      success: false,
      error: "Trading is disabled",
    });
    return;
  }

  const openBefore = trader.getOpenPositionCount();

  try {
    await trader.checkPositions();

    const openAfter = trader.getOpenPositionCount();

    res.json({
      success: true,
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

export default router;
