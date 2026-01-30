// Token routes - token queries, creators, launches
// GET /api/tokens/:mint, GET /api/tokens/:mint/fees, GET /api/tokens/search/:query
// GET /api/creators/top, GET /api/launches/recent

import { Router, Request, Response } from 'express';
import { getBagsApiService } from '../services/BagsApiService.js';

const router = Router();

// Solana address/mint validation regex (Base58, 32-44 chars)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Validate mint address helper
function isValidMint(mint: string): boolean {
  return !!mint && SOLANA_ADDRESS_REGEX.test(mint);
}

// GET /api/tokens/:mint - Get token info
router.get('/tokens/:mint', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;

  if (!isValidMint(mint)) {
    res.status(400).json({ error: 'Invalid mint address' });
    return;
  }

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

  if (!isValidMint(mint)) {
    res.status(400).json({ error: 'Invalid mint address' });
    return;
  }

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

// GET /api/wallet/:address/claimable - Get claimable fees for a wallet
// Uses Bags.fm API: /token-launch/claimable-positions
router.get('/wallet/:address/claimable', async (req: Request, res: Response) => {
  const address = req.params.address as string;

  // Basic Solana address validation
  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    res.status(400).json({
      success: false,
      error: 'Invalid wallet address'
    });
    return;
  }

  const api = getBagsApiService();

  try {
    const claimStats = await api.getWalletClaimStats(address);

    res.json({
      success: true,
      wallet: address,
      totalClaimableSol: claimStats.totalClaimableSol,
      totalClaimableLamports: claimStats.totalClaimableLamports,
      positionCount: claimStats.positionCount,
      positions: claimStats.positions,
      claimUrl: `https://bags.fm/claim`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// GET /api/tokens/:mint/claim-events - Get claim history for a token
router.get('/tokens/:mint/claim-events', async (req: Request, res: Response) => {
  const mint = req.params.mint as string;

  if (!isValidMint(mint)) {
    res.status(400).json({ success: false, error: 'Invalid mint address' });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const api = getBagsApiService();

  try {
    const events = await api.getClaimEvents(mint, { limit, offset });

    res.json({
      success: true,
      tokenMint: mint,
      events,
      count: events.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;
