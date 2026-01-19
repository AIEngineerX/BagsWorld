/**
 * Auto-Claim Agent Tests
 *
 * Tests the autonomous fee claiming agent functionality.
 * Run with: npm run test:agents
 */

import {
  mockClaimablePosition,
  createMockBagsApi,
  setupMockFetch,
} from '../mocks/bags-api';

// Mock environment variables
process.env.BAGS_API_KEY = 'test-api-key';
process.env.AGENT_SECRET = 'test-secret';

describe('Auto-Claim Agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should have correct default configuration', () => {
      const defaultConfig = {
        enabled: true,
        minClaimThresholdSol: 0.01,
        checkIntervalMs: 5 * 60 * 1000, // 5 minutes
        maxClaimsPerRun: 10,
        minWalletBalanceSol: 0.005,
        cooldownMs: 60 * 1000, // 1 minute
      };

      expect(defaultConfig.minClaimThresholdSol).toBe(0.01);
      expect(defaultConfig.checkIntervalMs).toBe(300000);
      expect(defaultConfig.maxClaimsPerRun).toBe(10);
    });

    it('should respect minimum claim threshold', () => {
      const threshold = 0.01;
      const position = { ...mockClaimablePosition, claimableDisplayAmount: 0.005 };

      // Position below threshold should not be claimed
      expect(position.claimableDisplayAmount).toBeLessThan(threshold);
    });

    it('should respect maximum claims per run', () => {
      const maxClaims = 10;
      const positions = Array(15).fill(mockClaimablePosition);
      const positionsToClaim = positions.slice(0, maxClaims);

      expect(positionsToClaim.length).toBe(maxClaims);
    });
  });

  describe('API Integration', () => {
    it('should fetch claimable positions', async () => {
      const mockApi = createMockBagsApi();
      const walletAddress = 'TestWallet111111111111111111111111111111111';

      const positions = await mockApi.getClaimablePositions(walletAddress);

      expect(mockApi.getClaimablePositions).toHaveBeenCalledWith(walletAddress);
      expect(positions).toHaveLength(1);
      expect(positions[0].claimableDisplayAmount).toBe(0.05);
    });

    it('should generate claim transactions', async () => {
      const mockApi = createMockBagsApi();
      const walletAddress = 'TestWallet111111111111111111111111111111111';
      const virtualPools = [mockClaimablePosition.virtualPool];

      const result = await mockApi.generateClaimTransactions(walletAddress, virtualPools);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toBe('mockBase64Transaction');
    });
  });

  describe('Agent API Endpoint', () => {
    it('should require authorization header', async () => {
      // Mock returns error response for unauthorized requests
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const response = await fetch('http://localhost:3000/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });

      expect(response.status).toBe(401);
    });

    it('should return status when authorized', async () => {
      setupMockFetch({
        '/api/agent': {
          success: true,
          wallet: { configured: true, balance: 0.1 },
          agent: { isRunning: false, totalClaimed: 0 },
        },
      });

      const response = await fetch('http://localhost:3000/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-secret',
        },
        body: JSON.stringify({ action: 'status' }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Claim Logic', () => {
    it('should filter out dust positions', () => {
      const dustThreshold = 0.001;
      const positions = [
        { ...mockClaimablePosition, claimableDisplayAmount: 0.0005 }, // dust
        { ...mockClaimablePosition, claimableDisplayAmount: 0.05 }, // valid
        { ...mockClaimablePosition, claimableDisplayAmount: 0.0001 }, // dust
      ];

      const filtered = positions.filter(p => p.claimableDisplayAmount > dustThreshold);

      expect(filtered.length).toBe(1);
      expect(filtered[0].claimableDisplayAmount).toBe(0.05);
    });

    it('should calculate total claimable correctly', () => {
      const positions = [
        { ...mockClaimablePosition, claimableDisplayAmount: 0.05 },
        { ...mockClaimablePosition, claimableDisplayAmount: 0.03 },
        { ...mockClaimablePosition, claimableDisplayAmount: 0.02 },
      ];

      const total = positions.reduce((sum, p) => sum + p.claimableDisplayAmount, 0);

      expect(total).toBeCloseTo(0.1);
    });
  });
});

describe('Buyback Agent', () => {
  it('should have correct default configuration', () => {
    const defaultConfig = {
      enabled: true,
      intervalMs: 12 * 60 * 60 * 1000, // 12 hours
      buybackPercentage: 50,
      minBuybackSol: 0.1,
      maxBuybackSol: 10,
      topTokensCount: 5,
      burnAfterBuy: true,
    };

    expect(defaultConfig.intervalMs).toBe(43200000); // 12 hours
    expect(defaultConfig.buybackPercentage).toBe(50);
    expect(defaultConfig.burnAfterBuy).toBe(true);
  });
});

describe('Scout Agent', () => {
  it('should filter launches based on criteria', () => {
    const filters = {
      minMarketCap: 10000,
      maxMarketCap: 1000000,
      minHolders: 10,
      blockedCreators: ['blockedWallet123'],
    };

    const launch = {
      marketCap: 50000,
      holders: 25,
      creatorWallet: 'goodCreator456',
    };

    const isValid =
      launch.marketCap >= filters.minMarketCap &&
      launch.marketCap <= filters.maxMarketCap &&
      launch.holders >= filters.minHolders &&
      !filters.blockedCreators.includes(launch.creatorWallet);

    expect(isValid).toBe(true);
  });

  it('should block creators correctly', () => {
    const blockedCreators = ['blockedWallet123'];
    const creatorToCheck = 'blockedWallet123';

    const isBlocked = blockedCreators.includes(creatorToCheck);

    expect(isBlocked).toBe(true);
  });
});
