// Ghost Trading routes - Control and monitoring for Ghost's autonomous trading
// GET /api/ghost/status - Trading status and stats
// GET /api/ghost/positions - List all positions
// GET /api/ghost/positions/open - List open positions only
// POST /api/ghost/enable - Enable trading
// POST /api/ghost/disable - Disable trading (kill switch)
// POST /api/ghost/config - Update trading config
// POST /api/ghost/evaluate - Manually trigger evaluation
// GET /api/ghost/study-wallet/:address - Analyze a wallet's trading patterns

import { Router, Request, Response } from "express";
import { getGhostTrader } from "../services/GhostTrader.js";
import { getHeliusService } from "../services/HeliusService.js";
import { getSolanaService } from "../services/SolanaService.js";

// Solana RPC for wallet analysis
const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

const router = Router();

// GET /api/ghost/status - Get trading status and stats
router.get("/status", async (req: Request, res: Response) => {
  const trader = getGhostTrader();
  const solanaService = getSolanaService();
  const stats = trader.getStats();
  const config = trader.getConfig();

  // Fetch wallet balance
  let walletBalance = 0;
  try {
    walletBalance = await solanaService.getBalance();
  } catch (error) {
    console.error("[Ghost] Failed to fetch wallet balance:", error);
  }

  res.json({
    success: true,
    wallet: {
      address: solanaService.getPublicKey() || null,
      balanceSol: walletBalance,
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
      trailingStopPercent: config.trailingStopPercent,
      stopLossPercent: config.stopLossPercent,
      minLiquidityUsd: config.minLiquidityUsd,
      minBuySellRatio: config.minBuySellRatio,
      slippageBps: config.slippageBps,
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
    const mockTokenData: Record<string, { marketCap: number; volume24h: number; holders: number; lifetimeFees: number }> = {
      "MOCK1111111111111111111111111111111111111111": { marketCap: 250000, volume24h: 45000, holders: 35, lifetimeFees: 0.08 },
      "MOCK2222222222222222222222222222222222222222": { marketCap: 15000, volume24h: 500, holders: 5, lifetimeFees: 0.001 },
      "MOCK3333333333333333333333333333333333333333": { marketCap: 100000, volume24h: 8000, holders: 20, lifetimeFees: 0.02 },
      "MOCK4444444444444444444444444444444444444444": { marketCap: 500000, volume24h: 80000, holders: 60, lifetimeFees: 0.15 },
    };

    for (const launch of launches) {
      const token = usingMockData ? null : await bagsApi.getToken(launch.mint);
      const mockData = mockTokenData[launch.mint];
      const ageSeconds = Math.floor((Date.now() - launch.launchedAt) / 1000);
      const marketCapUsd = token?.marketCap || mockData?.marketCap || launch.initialMarketCap || 0;
      const liquidityUsd = marketCapUsd * 0.15;
      const volume24hUsd = token?.volume24h || mockData?.volume24h || 0;
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

      // Scoring
      if (liquidityUsd >= 100000) { score += 25; reasons.push("excellent liquidity"); }
      else if (liquidityUsd >= 50000) { score += 20; reasons.push("strong liquidity"); }
      else if (liquidityUsd >= 25000) { score += 12; reasons.push("adequate liquidity"); }

      if (volume24hUsd >= 50000) { score += 25; reasons.push("high volume"); }
      else if (volume24hUsd >= 20000) { score += 18; reasons.push("good volume"); }
      else if (volume24hUsd >= 5000) { score += 10; reasons.push("moderate volume"); }
      else { redFlags.push("low volume"); }

      if (holders >= 50) { score += 15; reasons.push("well distributed"); }
      else if (holders >= 25) { score += 10; reasons.push("decent distribution"); }
      else if (holders >= 10) { score += 5; reasons.push("minimum holders"); }
      else { redFlags.push(`low holders (${holders})`); }

      if (lifetimeFees > 0.05) { score += 20; reasons.push("strong fees"); }
      else if (lifetimeFees > 0.01) { score += 12; reasons.push("positive fees"); }

      if (ageSeconds >= 120 && ageSeconds <= 600) { score += 15; reasons.push("optimal timing"); }
      else if (ageSeconds <= 900) { score += 10; reasons.push("good timing"); }

      const shouldBuy = score >= 50 && redFlags.length === 0;

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
        requiredScore: 50,
      },
      evaluations,
      summary: {
        total: evaluations.length,
        buySignals: evaluations.filter(e => e.verdict === "BUY").length,
        passSignals: evaluations.filter(e => e.verdict === "PASS").length,
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
  const { address } = req.params;
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
    const balanceData = await balanceResponse.json() as { result?: { value: number } };
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
    const tokenData = await tokenResponse.json() as {
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
    for (const account of tokenAccounts.slice(0, 20)) { // Limit to 20 tokens
      const info = account.account.data.parsed.info;
      const balance = info.tokenAmount.uiAmount;

      if (balance > 0) {
        // Try to get token info from Bags.fm
        const tokenInfo = await bagsApi.getToken(info.mint);
        holdings.push({
          mint: info.mint,
          balance,
          tokenInfo: tokenInfo ? {
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            marketCap: tokenInfo.marketCap,
          } : null,
        });
      }
    }

    // 4. Identify Bags.fm tokens (tokens with info from Bags API)
    const bagsTokens = holdings.filter(h => h.tokenInfo !== null);
    const unknownTokens = holdings.filter(h => h.tokenInfo === null);

    // 5. Check if this is a smart money wallet
    const smartMoneyWallets = trader.getSmartMoneyWallets();
    const isSmartMoney = smartMoneyWallets.includes(address);

    // 6. Calculate trading style insights
    const avgMarketCap = bagsTokens.length > 0
      ? bagsTokens.reduce((sum, t) => sum + (t.tokenInfo?.marketCap || 0), 0) / bagsTokens.length
      : 0;

    const tradingStyle = avgMarketCap > 500000 ? "blue-chip"
      : avgMarketCap > 100000 ? "mid-cap"
      : avgMarketCap > 25000 ? "small-cap"
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
      bagsTokens: bagsTokens.map(t => ({
        symbol: t.tokenInfo?.symbol,
        name: t.tokenInfo?.name,
        mint: t.mint.slice(0, 8) + "...",
        balance: t.balance.toLocaleString(),
        marketCap: t.tokenInfo?.marketCap ? `$${(t.tokenInfo.marketCap / 1000).toFixed(1)}K` : "unknown",
      })),
      insights: {
        tradingStyle,
        avgMarketCap: avgMarketCap > 0 ? `$${(avgMarketCap / 1000).toFixed(1)}K` : "N/A",
        diversification: holdings.length > 10 ? "high" : holdings.length > 5 ? "medium" : "concentrated",
      },
      learningNotes: [
        isSmartMoney ? "This wallet is tracked as smart money" : "Add to smart money list with POST /api/ghost/add-wallet",
        bagsTokens.length > 0 ? `Holding ${bagsTokens.length} Bags.fm tokens - Ghost can learn from these` : "No Bags.fm tokens detected",
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

// POST /api/ghost/add-wallet - Add a wallet to smart money tracking
router.post("/add-wallet", (req: Request, res: Response) => {
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
  const { address } = req.params;
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
      trades: history.trades.map(t => ({
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
  const { address } = req.params;

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
        activeTradingHours: patterns.tradingHours.map(h => `${h}:00 UTC`),
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
    alerts: alerts.map(a => ({
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

// POST /api/ghost/helius/poll - Manually trigger polling of tracked wallets
router.post("/helius/poll", async (req: Request, res: Response) => {
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
      alerts: newAlerts.map(a => ({
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

// POST /api/ghost/learn-from-wallet - Have Ghost analyze and learn from a wallet's patterns
router.post("/learn-from-wallet", async (req: Request, res: Response) => {
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
        tradingHours: patterns.tradingHours.map(h => `${h}:00 UTC`),
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

export default router;
