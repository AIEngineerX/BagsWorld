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

  try {
    const analysis = await CreatorTools.analyzeToken(mint);

    if (!analysis) {
      res.status(404).json({ success: false, error: 'Token not found' });
      return;
    }

    res.json({ success: true, analysis });
  } catch (err) {
    console.error(`[creator-tools] Error in /analyze/${mint}:`, err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Analysis failed' });
  }
});

// GET /api/creator-tools/fee-advice/:mint - Fee optimization (Ghost agent)
router.get('/fee-advice/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;

  try {
    const advice = await CreatorTools.getFeeAdvice(mint);

    if (!advice) {
      res.status(404).json({ success: false, error: 'Token not found' });
      return;
    }

    res.json({ success: true, advice, agent: 'ghost' });
  } catch (err) {
    console.error(`[creator-tools] Error in /fee-advice/${mint}:`, err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Fee advice failed' });
  }
});

// GET /api/creator-tools/marketing-advice/:mint - Marketing tips (Sam agent)
router.get('/marketing-advice/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;
  const { twitter, telegram, website } = req.query;

  try {
    const advice = await CreatorTools.getMarketingAdvice(mint, {
      twitter: twitter as string | undefined,
      telegram: telegram as string | undefined,
      website: website as string | undefined,
    });

    if (!advice) {
      res.status(404).json({ success: false, error: 'Token not found' });
      return;
    }

    res.json({ success: true, advice, agent: 'sam' });
  } catch (err) {
    console.error(`[creator-tools] Error in /marketing-advice/${mint}:`, err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Marketing advice failed' });
  }
});

// GET /api/creator-tools/community-advice/:mint - Community help (Carlo agent)
router.get('/community-advice/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;

  try {
    const advice = await CreatorTools.getCommunityAdvice(mint);

    if (!advice) {
      res.status(404).json({ success: false, error: 'Token not found' });
      return;
    }

    res.json({ success: true, advice, agent: 'carlo' });
  } catch (err) {
    console.error(`[creator-tools] Error in /community-advice/${mint}:`, err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Community advice failed' });
  }
});

// GET /api/creator-tools/full-analysis/:mint - Combined analysis from all agents
router.get('/full-analysis/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;
  const { twitter, telegram, website } = req.query;

  try {
    const analysis = await CreatorTools.getFullAnalysis(mint, {
      twitter: twitter as string | undefined,
      telegram: telegram as string | undefined,
      website: website as string | undefined,
    });

    if (!analysis.token) {
      res.status(404).json({ success: false, error: 'Token not found' });
      return;
    }

    res.json({ success: true, analysis, agents: ['ghost', 'sam', 'carlo'] });
  } catch (err) {
    console.error(`[creator-tools] Error in /full-analysis/${mint}:`, err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Full analysis failed' });
  }
});

export default router;
