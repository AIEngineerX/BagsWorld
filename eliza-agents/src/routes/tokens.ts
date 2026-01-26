// Token routes - token queries, creators, launches
// GET /api/tokens/:mint, GET /api/tokens/:mint/fees, GET /api/tokens/search/:query
// GET /api/creators/top, GET /api/launches/recent

import { Router, Request, Response } from 'express';
import { getBagsApiService } from '../services/BagsApiService.js';

const router = Router();

// GET /api/tokens/:mint - Get token info
router.get('/tokens/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;
  const api = getBagsApiService();

  const token = await api.getToken(mint);

  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  res.json({
    success: true,
    token,
  });
});

// GET /api/tokens/:mint/fees - Get creator fees
router.get('/tokens/:mint/fees', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;
  const api = getBagsApiService();

  const fees = await api.getCreatorFees(mint);

  if (!fees) {
    res.status(404).json({ error: 'Fee data not found' });
    return;
  }

  res.json({
    success: true,
    fees,
  });
});

// GET /api/tokens/search/:query - Search tokens
router.get('/tokens/search/:query', async (req: Request, res: Response) => {
  const query = req.params.query as string;
  const api = getBagsApiService();

  const tokens = await api.searchTokens(query);

  res.json({
    success: true,
    tokens,
    count: tokens.length,
  });
});

// GET /api/creators/top - Get top creators
router.get('/creators/top', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const api = getBagsApiService();

  const creators = await api.getTopCreators(limit);

  res.json({
    success: true,
    creators,
    count: creators.length,
  });
});

// GET /api/launches/recent - Get recent launches
router.get('/launches/recent', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const api = getBagsApiService();

  const launches = await api.getRecentLaunches(limit);

  res.json({
    success: true,
    launches,
    count: launches.length,
  });
});

export default router;
