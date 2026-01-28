// Twitter routes - Control and monitoring for Finn's Twitter posting
// GET /api/twitter/status - Twitter service status
// GET /api/twitter/history - Recent post history
// POST /api/twitter/post - Manually post a tweet (as Finn)
// POST /api/twitter/thread - Post a thread (as Finn)

import { Router, Request, Response } from "express";
import { getTwitterService } from "../services/TwitterService.js";
import { getBagsApiService } from "../services/BagsApiService.js";

const router = Router();

// GET /api/twitter/status - Get Twitter service status
router.get("/status", (req: Request, res: Response) => {
  const twitter = getTwitterService();
  const stats = twitter.getStats();

  res.json({
    success: true,
    twitter: {
      authenticated: stats.authenticated,
      dryRun: stats.dryRun,
      username: stats.username ? `@${stats.username}` : null,
      canPost: stats.canPost,
      nextPostInSeconds: Math.ceil(stats.nextPostIn / 1000),
    },
    stats: {
      totalPosts: stats.totalPosts,
    },
  });
});

// GET /api/twitter/history - Get recent post history
router.get("/history", (req: Request, res: Response) => {
  const twitter = getTwitterService();
  const limit = parseInt(req.query.limit as string) || 10;
  const history = twitter.getPostHistory(limit);

  res.json({
    success: true,
    count: history.length,
    posts: history.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      url: tweet.url,
      createdAt: tweet.createdAt.toISOString(),
    })),
  });
});

// POST /api/twitter/post - Manually post a tweet as Finn
router.post("/post", async (req: Request, res: Response) => {
  const { content, confirmOverride } = req.body;

  if (!content) {
    res.status(400).json({
      success: false,
      error: "Missing 'content' field",
    });
    return;
  }

  if (content.length > 280) {
    res.status(400).json({
      success: false,
      error: `Tweet too long (${content.length}/280 characters)`,
    });
    return;
  }

  const twitter = getTwitterService();

  if (!twitter.isConfigured() && !twitter.isDryRun()) {
    res.status(400).json({
      success: false,
      error: "Twitter not configured",
      message: "Set TWITTER_BEARER_TOKEN or enable TWITTER_DRY_RUN=true",
    });
    return;
  }

  const result = await twitter.post(content);

  if (result.success) {
    res.json({
      success: true,
      message: twitter.isDryRun() ? "Tweet simulated (dry run)" : "Tweet posted!",
      tweet: {
        id: result.tweet?.id,
        text: result.tweet?.text,
        url: result.tweet?.url,
      },
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error,
    });
  }
});

// POST /api/twitter/thread - Post a thread as Finn
router.post("/thread", async (req: Request, res: Response) => {
  const { content } = req.body;

  if (!content) {
    res.status(400).json({
      success: false,
      error: "Missing 'content' field",
    });
    return;
  }

  const twitter = getTwitterService();

  if (!twitter.isConfigured() && !twitter.isDryRun()) {
    res.status(400).json({
      success: false,
      error: "Twitter not configured",
    });
    return;
  }

  const result = await twitter.postThread(content);

  if (result.success) {
    res.json({
      success: true,
      message: twitter.isDryRun() ? "Thread simulated (dry run)" : "Thread posted!",
      tweet: {
        id: result.tweet?.id,
        text: result.tweet?.text,
        url: result.tweet?.url,
      },
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error,
    });
  }
});

// POST /api/twitter/generate-shill - Generate shill content for a token
router.post("/generate-shill", async (req: Request, res: Response) => {
  const { mint, symbol } = req.body;

  if (!mint && !symbol) {
    res.status(400).json({
      success: false,
      error: "Missing 'mint' or 'symbol' field",
    });
    return;
  }

  const bagsApi = getBagsApiService();
  let token;

  if (mint) {
    token = await bagsApi.getToken(mint);
  } else if (symbol) {
    const tokens = await bagsApi.searchTokens(symbol);
    token = tokens[0];
  }

  if (!token) {
    res.status(404).json({
      success: false,
      error: "Token not found",
    });
    return;
  }

  // Generate Finn-style shill content
  const templates = generateShillContent(token);

  res.json({
    success: true,
    token: {
      mint: token.mint,
      name: token.name,
      symbol: token.symbol,
      marketCap: token.marketCap,
    },
    templates,
  });
});

// Helper: Generate shill templates
function generateShillContent(token: {
  mint: string;
  name: string;
  symbol: string;
  marketCap?: number;
  volume24h?: number;
  lifetimeFees?: number;
}): string[] {
  const symbol = `$${token.symbol}`;
  const mcap = token.marketCap
    ? token.marketCap >= 1_000_000
      ? `$${(token.marketCap / 1_000_000).toFixed(1)}M`
      : `$${(token.marketCap / 1_000).toFixed(0)}K`
    : "early";
  const fees = token.lifetimeFees
    ? (token.lifetimeFees / 1_000_000_000).toFixed(2)
    : "0";

  return [
    // Short tweet
    `${symbol} on @BagsFM\n\ncreator earning fees forever. not just at launch - FOREVER.\n\n${mcap} MC | ${fees} SOL in fees\n\nbags.fm/token/${token.mint}`,

    // Thread opener
    `${symbol} just launched on @BagsFM\n\n${token.name}\n\nwhy this one?\n\n🧵👇`,

    // Hype one-liner
    `${symbol} creators are earning fees while you're still launching on pump.fun\n\njust saying\n\nbags.fm/token/${token.mint}`,

    // Call to action
    `looking for alpha?\n\n${symbol} - ${mcap} MC, ${fees} SOL in creator fees already\n\ncreator gets 1% of every trade. forever.\n\nbags.fm/token/${token.mint}`,
  ];
}

export default router;
