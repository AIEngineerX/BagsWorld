// Creator Tools routes - AI-powered creator advice
// GET /api/creator-tools/analyze/:mint, GET /api/creator-tools/fee-advice/:mint
// GET /api/creator-tools/marketing-advice/:mint, GET /api/creator-tools/community-advice/:mint
// GET /api/creator-tools/full-analysis/:mint

import { Router, Request, Response } from 'express';
import { CreatorTools } from '../services/CreatorTools.js';

const router = Router();

// GET /api/creator-tools/analyze/:mint - Token analysis
router.get('/analyze/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;

  const analysis = await CreatorTools.analyzeToken(mint);

  if (!analysis) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    analysis,
  });
});

// GET /api/creator-tools/fee-advice/:mint - Fee optimization (Ghost agent)
router.get('/fee-advice/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;

  const advice = await CreatorTools.getFeeAdvice(mint);

  if (!advice) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    advice,
    agent: 'ghost',
  });
});

// GET /api/creator-tools/marketing-advice/:mint - Marketing tips (Sam agent)
router.get('/marketing-advice/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;
  const { twitter, telegram, website } = req.query;

  const advice = await CreatorTools.getMarketingAdvice(mint, {
    twitter: twitter as string | undefined,
    telegram: telegram as string | undefined,
    website: website as string | undefined,
  });

  if (!advice) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    advice,
    agent: 'sam',
  });
});

// GET /api/creator-tools/community-advice/:mint - Community help (Carlo agent)
router.get('/community-advice/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;

  const advice = await CreatorTools.getCommunityAdvice(mint);

  if (!advice) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    advice,
    agent: 'carlo',
  });
});

// GET /api/creator-tools/full-analysis/:mint - Combined analysis from all agents
router.get('/full-analysis/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;
  const { twitter, telegram, website } = req.query;

  const analysis = await CreatorTools.getFullAnalysis(mint, {
    twitter: twitter as string | undefined,
    telegram: telegram as string | undefined,
    website: website as string | undefined,
  });

  if (!analysis.token) {
    res.status(404).json({
      success: false,
      error: 'Token not found',
    });
    return;
  }

  res.json({
    success: true,
    analysis,
    agents: ['ghost', 'sam', 'carlo'],
  });
});

export default router;
