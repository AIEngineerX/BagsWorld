// CreatorTools tests
// Tests AI-powered advice for token creators

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatorTools, type TokenAnalysis, type FeeAdvice, type MarketingAdvice, type CommunityAdvice } from './CreatorTools.js';

// Mock BagsApiService
const mockGetToken = vi.fn();
const mockGetCreatorFees = vi.fn();

vi.mock('./BagsApiService.js', () => ({
  getBagsApiService: () => ({
    getToken: mockGetToken,
    getCreatorFees: mockGetCreatorFees,
  }),
}));

// Mock LLM service
vi.mock('./LLMService.js', () => ({
  getLLMService: () => ({
    generateResponse: vi.fn().mockResolvedValue({
      text: 'Agent advice: Consider adjusting your strategy based on market conditions.',
      tokensUsed: 50,
    }),
  }),
}));

// Mock characters
vi.mock('../characters/index.js', () => ({
  getCharacter: (id: string) => {
    const characters: Record<string, any> = {
      ghost: {
        id: 'ghost',
        name: 'Ghost',
        bio: ['Fee optimization expert'],
        topics: ['fees', 'trading'],
        style: { all: ['analytical'], chat: ['direct'] },
      },
      sam: {
        id: 'sam',
        name: 'Sam',
        bio: ['Marketing expert'],
        topics: ['marketing', 'growth'],
        style: { all: ['creative'], chat: ['enthusiastic'] },
      },
      carlo: {
        id: 'carlo',
        name: 'Carlo',
        bio: ['Community builder'],
        topics: ['community', 'engagement'],
        style: { all: ['friendly'], chat: ['supportive'] },
      },
    };
    return characters[id] || null;
  },
}));

describe('CreatorTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeToken', () => {
    it('returns token analysis with metrics', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        marketCap: 500000,
        volume24h: 25000,
        holders: 150,
        lifetimeFees: 10,
        image: 'https://example.com/logo.png',
        description: 'A test token with good description',
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 2.5,
        claimedFees: 7.5,
      });

      const analysis = await CreatorTools.analyzeToken('token123');

      expect(analysis).not.toBeNull();
      expect(analysis!.mint).toBe('token123');
      expect(analysis!.token.name).toBe('Test Token');
      expect(analysis!.metrics).toBeDefined();
      expect(analysis!.metrics.healthScore).toBeGreaterThan(0);
      expect(analysis!.metrics.feeEfficiency).toBeGreaterThanOrEqual(0);
      expect(analysis!.metrics.communityStrength).toBeGreaterThan(0);
      expect(analysis!.metrics.marketingReach).toBeGreaterThan(0);
      expect(analysis!.recommendations).toBeDefined();
      expect(Array.isArray(analysis!.recommendations)).toBe(true);
    });

    it('returns null for unknown token', async () => {
      mockGetToken.mockResolvedValue(null);

      const analysis = await CreatorTools.analyzeToken('unknown');

      expect(analysis).toBeNull();
    });

    it('handles token without fees', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'New Token',
        symbol: 'NEW',
        marketCap: 10000,
        volume24h: 500,
        holders: 20,
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const analysis = await CreatorTools.analyzeToken('token123');

      expect(analysis).not.toBeNull();
      expect(analysis!.fees).toBeUndefined();
    });

    it('includes unclaimed fees in recommendations', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        marketCap: 100000,
        volume24h: 5000,
        holders: 50,
        lifetimeFees: 15,
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 5.0,
        claimedFees: 10,
      });

      const analysis = await CreatorTools.analyzeToken('token123');

      const feeRecommendation = analysis!.recommendations.find(r =>
        r.toLowerCase().includes('unclaimed') || r.toLowerCase().includes('claim')
      );
      expect(feeRecommendation).toBeDefined();
    });
  });

  describe('getFeeAdvice', () => {
    it('returns fee optimization advice', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        marketCap: 200000,
        volume24h: 50000,
        lifetimeFees: 20,
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 3.0,
        claimedFees: 17,
      });

      const advice = await CreatorTools.getFeeAdvice('token123');

      expect(advice).not.toBeNull();
      expect(advice!.currentFee).toBeDefined();
      expect(advice!.suggestedFee).toBeDefined();
      expect(advice!.reasoning).toBeDefined();
      expect(advice!.potentialImpact).toBeDefined();
      expect(advice!.unclaimedAmount).toBe(3.0);
      expect(advice!.claimRecommendation).toBeDefined();
    });

    it('returns null for unknown token', async () => {
      mockGetToken.mockResolvedValue(null);

      const advice = await CreatorTools.getFeeAdvice('unknown');

      expect(advice).toBeNull();
    });

    it('suggests lower fee for high volume tokens', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'High Volume Token',
        symbol: 'HVT',
        marketCap: 1000000,
        volume24h: 150000, // High volume
        lifetimeFees: 100,
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 5.0,
      });

      const advice = await CreatorTools.getFeeAdvice('token123');

      expect(advice!.suggestedFee).toBeLessThanOrEqual(1);
    });

    it('suggests higher fee for low volume tokens', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Low Volume Token',
        symbol: 'LVT',
        marketCap: 10000,
        volume24h: 500, // Low volume
        lifetimeFees: 0.5,
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 0.1,
      });

      const advice = await CreatorTools.getFeeAdvice('token123');

      expect(advice!.suggestedFee).toBeGreaterThanOrEqual(1);
    });

    it('recommends claiming when unclaimed fees are high', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 10000,
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 5.0, // High unclaimed
      });

      const advice = await CreatorTools.getFeeAdvice('token123');

      expect(advice!.claimRecommendation.toLowerCase()).toContain('claim');
    });

    it('suggests waiting when unclaimed fees are low', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 10000,
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 0.05, // Very low
      });

      const advice = await CreatorTools.getFeeAdvice('token123');

      expect(advice!.claimRecommendation.toLowerCase()).toContain('accumulate');
    });
  });

  describe('getMarketingAdvice', () => {
    it('returns marketing advice with scores', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        marketCap: 100000,
        volume24h: 20000,
        holders: 100,
        image: 'https://example.com/logo.png',
        description: 'A great token for the community',
      });

      const advice = await CreatorTools.getMarketingAdvice('token123', {
        twitter: '@testtoken',
        telegram: 't.me/testtoken',
      });

      expect(advice).not.toBeNull();
      expect(advice!.overallScore).toBeGreaterThanOrEqual(0);
      expect(advice!.overallScore).toBeLessThanOrEqual(100);
      expect(advice!.strengths).toBeDefined();
      expect(Array.isArray(advice!.strengths)).toBe(true);
      expect(advice!.weaknesses).toBeDefined();
      expect(advice!.actionItems).toBeDefined();
      expect(advice!.contentIdeas).toBeDefined();
      expect(advice!.platformRecommendations).toBeDefined();
    });

    it('returns null for unknown token', async () => {
      mockGetToken.mockResolvedValue(null);

      const advice = await CreatorTools.getMarketingAdvice('unknown');

      expect(advice).toBeNull();
    });

    it('identifies missing twitter as weakness', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 5000,
        image: 'https://example.com/logo.png',
        description: 'Test description here',
      });

      const advice = await CreatorTools.getMarketingAdvice('token123', {
        telegram: 't.me/test',
        // No twitter
      });

      expect(advice!.weaknesses.some(w => w.toLowerCase().includes('twitter'))).toBe(true);
      expect(advice!.actionItems.some(a => a.toLowerCase().includes('twitter'))).toBe(true);
    });

    it('identifies missing telegram as weakness', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 5000,
        image: 'https://example.com/logo.png',
        description: 'Test description here',
      });

      const advice = await CreatorTools.getMarketingAdvice('token123', {
        twitter: '@test',
        // No telegram
      });

      expect(advice!.weaknesses.some(w => w.toLowerCase().includes('telegram'))).toBe(true);
    });

    it('identifies missing image as weakness', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 5000,
        // No image
        description: 'Test description here',
      });

      const advice = await CreatorTools.getMarketingAdvice('token123');

      expect(advice!.weaknesses.some(w => w.toLowerCase().includes('image'))).toBe(true);
    });

    it('identifies weak description as weakness', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 5000,
        image: 'https://example.com/logo.png',
        description: 'Short', // Too short
      });

      const advice = await CreatorTools.getMarketingAdvice('token123');

      expect(advice!.weaknesses.some(w => w.toLowerCase().includes('description'))).toBe(true);
    });

    it('identifies strong volume as strength', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 100000, // High volume
        image: 'https://example.com/logo.png',
        description: 'A great token with good description',
      });

      const advice = await CreatorTools.getMarketingAdvice('token123', {
        twitter: '@test',
      });

      expect(advice!.strengths.some(s => s.toLowerCase().includes('volume'))).toBe(true);
    });

    it('calculates higher score for well-marketed token', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 60000,
        image: 'https://example.com/logo.png',
        description: 'A great token with excellent features and community focus',
      });

      const adviceGood = await CreatorTools.getMarketingAdvice('token123', {
        twitter: '@test',
        telegram: 't.me/test',
        website: 'https://test.com',
      });

      mockGetToken.mockResolvedValue({
        mint: 'token456',
        name: 'Poor Token',
        symbol: 'POOR',
        volume24h: 100,
        // No image, no description
      });

      const advicePoor = await CreatorTools.getMarketingAdvice('token456');

      expect(adviceGood!.overallScore).toBeGreaterThan(advicePoor!.overallScore);
    });
  });

  describe('getCommunityAdvice', () => {
    it('returns community advice', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        holders: 200,
        volume24h: 10000,
      });

      const advice = await CreatorTools.getCommunityAdvice('token123');

      expect(advice).not.toBeNull();
      expect(advice!.overallScore).toBeGreaterThanOrEqual(0);
      expect(advice!.currentState).toBeDefined();
      expect(advice!.growthTips).toBeDefined();
      expect(Array.isArray(advice!.growthTips)).toBe(true);
      expect(advice!.engagementIdeas).toBeDefined();
      expect(advice!.warningsSigns).toBeDefined();
      expect(advice!.nextSteps).toBeDefined();
    });

    it('returns null for unknown token', async () => {
      mockGetToken.mockResolvedValue(null);

      const advice = await CreatorTools.getCommunityAdvice('unknown');

      expect(advice).toBeNull();
    });

    it('identifies early stage for low holder count', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'New Token',
        symbol: 'NEW',
        holders: 5,
        volume24h: 100,
      });

      const advice = await CreatorTools.getCommunityAdvice('token123');

      expect(advice!.currentState.toLowerCase()).toContain('launch');
      expect(advice!.overallScore).toBeLessThan(20);
    });

    it('identifies growing stage for medium holder count', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Growing Token',
        symbol: 'GROW',
        holders: 150,
        volume24h: 5000,
      });

      const advice = await CreatorTools.getCommunityAdvice('token123');

      expect(advice!.currentState.toLowerCase()).toContain('growing');
    });

    it('identifies established stage for high holder count', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Established Token',
        symbol: 'EST',
        holders: 2000,
        volume24h: 50000,
      });

      const advice = await CreatorTools.getCommunityAdvice('token123');

      expect(advice!.currentState.toLowerCase()).toContain('established');
      expect(advice!.overallScore).toBeGreaterThan(70);
    });

    it('provides appropriate tips for early stage', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'New Token',
        symbol: 'NEW',
        holders: 25,
        volume24h: 500,
      });

      const advice = await CreatorTools.getCommunityAdvice('token123');

      // Early stage tips should focus on finding believers
      expect(advice!.growthTips.some(t =>
        t.toLowerCase().includes('quality') ||
        t.toLowerCase().includes('believer') ||
        t.toLowerCase().includes('early')
      )).toBe(true);
    });

    it('warns about low volume despite holders', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Stale Token',
        symbol: 'STALE',
        holders: 100,
        volume24h: 50, // Very low
      });

      const advice = await CreatorTools.getCommunityAdvice('token123');

      expect(advice!.warningsSigns.some(w =>
        w.toLowerCase().includes('volume') || w.toLowerCase().includes('declin')
      )).toBe(true);
    });

    it('adjusts score for high volume', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Active Token',
        symbol: 'ACT',
        holders: 100,
        volume24h: 50000, // High volume
      });

      const adviceHigh = await CreatorTools.getCommunityAdvice('token123');

      mockGetToken.mockResolvedValue({
        mint: 'token456',
        name: 'Quiet Token',
        symbol: 'QUIET',
        holders: 100,
        volume24h: 100, // Low volume
      });

      const adviceLow = await CreatorTools.getCommunityAdvice('token456');

      expect(adviceHigh!.overallScore).toBeGreaterThan(adviceLow!.overallScore);
    });
  });

  describe('getFullAnalysis', () => {
    it('returns combined analysis from all agents', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        marketCap: 200000,
        volume24h: 30000,
        holders: 300,
        lifetimeFees: 25,
        image: 'https://example.com/logo.png',
        description: 'A comprehensive test token',
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 4.0,
        claimedFees: 21,
      });

      const analysis = await CreatorTools.getFullAnalysis('token123', {
        twitter: '@testtoken',
        telegram: 't.me/test',
      });

      expect(analysis.token).not.toBeNull();
      expect(analysis.fees).not.toBeNull();
      expect(analysis.marketing).not.toBeNull();
      expect(analysis.community).not.toBeNull();

      // Check each section has data
      expect(analysis.token!.metrics).toBeDefined();
      expect(analysis.fees!.suggestedFee).toBeDefined();
      expect(analysis.marketing!.contentIdeas.length).toBeGreaterThan(0);
      expect(analysis.community!.growthTips.length).toBeGreaterThan(0);
    });

    it('returns null token for unknown mint', async () => {
      mockGetToken.mockResolvedValue(null);

      const analysis = await CreatorTools.getFullAnalysis('unknown');

      expect(analysis.token).toBeNull();
      expect(analysis.fees).toBeNull();
      expect(analysis.marketing).toBeNull();
      expect(analysis.community).toBeNull();
    });

    it('runs all analyses in parallel', async () => {
      const startTime = Date.now();

      mockGetToken.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            mint: 'token123',
            name: 'Test Token',
            symbol: 'TEST',
            marketCap: 100000,
            volume24h: 10000,
            holders: 100,
            lifetimeFees: 5,
            image: 'https://example.com/logo.png',
            description: 'Test description here',
          }), 50)
        )
      );
      mockGetCreatorFees.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({ unclaimedFees: 1 }), 50)
        )
      );

      await CreatorTools.getFullAnalysis('token123');

      const elapsed = Date.now() - startTime;
      // If parallel, should take ~50ms, not 4x50ms
      expect(elapsed).toBeLessThan(300);
    });
  });

  describe('metrics calculation', () => {
    it('calculates health score based on volume', async () => {
      // High volume = high health
      mockGetToken.mockResolvedValue({
        mint: 'high',
        name: 'High Volume',
        symbol: 'HIGH',
        volume24h: 120000,
        marketCap: 500000,
        holders: 200,
        lifetimeFees: 50,
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const high = await CreatorTools.analyzeToken('high');

      // Low volume = low health
      mockGetToken.mockResolvedValue({
        mint: 'low',
        name: 'Low Volume',
        symbol: 'LOW',
        volume24h: 50,
        marketCap: 5000,
        holders: 10,
        lifetimeFees: 0.1,
      });

      const low = await CreatorTools.analyzeToken('low');

      expect(high!.metrics.healthScore).toBeGreaterThan(low!.metrics.healthScore);
    });

    it('calculates community strength based on holders', async () => {
      // Many holders
      mockGetToken.mockResolvedValue({
        mint: 'many',
        name: 'Many Holders',
        symbol: 'MANY',
        holders: 1500,
        volume24h: 10000,
        marketCap: 100000,
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const many = await CreatorTools.analyzeToken('many');

      // Few holders
      mockGetToken.mockResolvedValue({
        mint: 'few',
        name: 'Few Holders',
        symbol: 'FEW',
        holders: 15,
        volume24h: 10000,
        marketCap: 100000,
      });

      const few = await CreatorTools.analyzeToken('few');

      expect(many!.metrics.communityStrength).toBeGreaterThan(few!.metrics.communityStrength);
    });

    it('calculates marketing reach based on presence', async () => {
      // Has image and description
      mockGetToken.mockResolvedValue({
        mint: 'good',
        name: 'Good Marketing',
        symbol: 'GOOD',
        volume24h: 20000,
        holders: 100,
        marketCap: 100000,
        image: 'https://example.com/logo.png',
        description: 'A well-described token with clear utility',
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const good = await CreatorTools.analyzeToken('good');

      // Missing image and description
      mockGetToken.mockResolvedValue({
        mint: 'poor',
        name: 'Poor Marketing',
        symbol: 'POOR',
        volume24h: 20000,
        holders: 100,
        marketCap: 100000,
        // No image, no description
      });

      const poor = await CreatorTools.analyzeToken('poor');

      expect(good!.metrics.marketingReach).toBeGreaterThan(poor!.metrics.marketingReach);
    });
  });

  describe('boundary conditions', () => {
    describe('volume thresholds', () => {
      // VOLUME_HIGH = 100000, VOLUME_MEDIUM = 10000, VOLUME_LOW = 1000

      it('fee advice: volume exactly at VOLUME_HIGH (100000) suggests lower fee', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 100000,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0.5 });

        const advice = await CreatorTools.getFeeAdvice('token');
        expect(advice!.suggestedFee).toBeLessThanOrEqual(1);
      });

      it('fee advice: volume just below VOLUME_HIGH (99999) uses standard fee', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 99999,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0.5 });

        const advice = await CreatorTools.getFeeAdvice('token');
        expect(advice!.suggestedFee).toBe(1);
      });

      it('fee advice: volume just above VOLUME_HIGH (100001) suggests lower fee', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 100001,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0.5 });

        const advice = await CreatorTools.getFeeAdvice('token');
        expect(advice!.suggestedFee).toBe(0.5);
      });

      it('fee advice: volume at VOLUME_LOW (1000) uses standard fee', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 1000,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0.05 });

        const advice = await CreatorTools.getFeeAdvice('token');
        expect(advice!.suggestedFee).toBe(1);
      });

      it('fee advice: volume below VOLUME_LOW (999) suggests higher fee', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 999,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0.05 });

        const advice = await CreatorTools.getFeeAdvice('token');
        expect(advice!.suggestedFee).toBe(1.5);
      });

      it('health score varies by volume thresholds', async () => {
        const volumes = [100001, 50001, 10001, 1001, 101, 1, 0];
        const scores: number[] = [];

        for (const vol of volumes) {
          mockGetToken.mockResolvedValue({
            mint: `v${vol}`,
            name: 'Test',
            symbol: 'TEST',
            volume24h: vol,
            marketCap: 10000,
            holders: 50,
          });
          mockGetCreatorFees.mockResolvedValue(null);

          const analysis = await CreatorTools.analyzeToken(`v${vol}`);
          scores.push(analysis!.metrics.healthScore);
        }

        // Scores should decrease as volume decreases
        for (let i = 0; i < scores.length - 1; i++) {
          expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
      });
    });

    describe('holder thresholds', () => {
      // HOLDERS_ESTABLISHED = 1000, HOLDERS_GROWING = 100, HOLDERS_EARLY = 10

      it('community: exactly 1000 holders is growing (threshold is > 1000)', async () => {
        // HOLDERS_ESTABLISHED = 1000 means holders must be > 1000 for established
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 1000,
          volume24h: 10000,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('growing');
      });

      it('community: 1001 holders is established', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 1001,
          volume24h: 10000,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('established');
        expect(advice!.overallScore).toBeGreaterThanOrEqual(80);
      });

      it('community: 999 holders is growing', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 999,
          volume24h: 10000,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('growing');
      });

      it('community: exactly 100 holders is early (threshold is > 100)', async () => {
        // HOLDERS_GROWING = 100 means holders must be > 100 for growing
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 100,
          volume24h: 5000,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('early');
      });

      it('community: 101 holders is growing', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 101,
          volume24h: 5000,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('growing');
      });

      it('community: 99 holders is early stage', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 99,
          volume24h: 2000,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('early');
      });

      it('community: exactly 10 holders is just launched (threshold is > 10)', async () => {
        // HOLDERS_EARLY = 10 means holders must be > 10 for early stage
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 10,
          volume24h: 1000,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('launch');
      });

      it('community: 11 holders is early stage', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 11,
          volume24h: 1000,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('early');
      });

      it('community: 9 holders is just launched', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          holders: 9,
          volume24h: 500,
        });

        const advice = await CreatorTools.getCommunityAdvice('token');
        expect(advice!.currentState.toLowerCase()).toContain('launch');
        expect(advice!.overallScore).toBeLessThanOrEqual(10);
      });

      it('community strength varies by holder thresholds', async () => {
        const holderCounts = [1001, 501, 101, 51, 1];
        const scores: number[] = [];

        for (const count of holderCounts) {
          mockGetToken.mockResolvedValue({
            mint: `h${count}`,
            name: 'Test',
            symbol: 'TEST',
            holders: count,
            volume24h: 10000,
            marketCap: 100000,
          });
          mockGetCreatorFees.mockResolvedValue(null);

          const analysis = await CreatorTools.analyzeToken(`h${count}`);
          scores.push(analysis!.metrics.communityStrength);
        }

        // Scores should decrease as holders decrease
        for (let i = 0; i < scores.length - 1; i++) {
          expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
      });
    });

    describe('unclaimed fee thresholds', () => {
      it('claim recommendation: exactly 1.0 SOL is in can-claim-or-wait category', async () => {
        // Threshold is > 1 for "strongly recommend", so 1.0 exactly is in middle tier
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 10000,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 1.0 });

        const advice = await CreatorTools.getFeeAdvice('token');
        // 1.0 SOL is NOT > 1.0, so it's in the "can claim or wait" category
        expect(advice!.claimRecommendation.toLowerCase()).toContain('claim');
        expect(advice!.claimRecommendation.toLowerCase()).toContain('wait');
      });

      it('claim recommendation: 1.01 SOL strongly recommends claiming', async () => {
        // > 1 SOL triggers "strongly recommend claiming"
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 10000,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 1.01 });

        const advice = await CreatorTools.getFeeAdvice('token');
        expect(advice!.claimRecommendation.toLowerCase()).toContain('claim');
        expect(advice!.claimRecommendation.toLowerCase()).not.toContain('wait');
      });

      it('claim recommendation: 0.99 SOL suggests claiming or waiting', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 10000,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0.99 });

        const advice = await CreatorTools.getFeeAdvice('token');
        // Between 0.1 and 1 SOL - can claim or wait
        expect(advice!.claimRecommendation).toBeDefined();
        expect(advice!.claimRecommendation.toLowerCase()).toContain('claim');
      });

      it('claim recommendation: exactly 0.1 SOL can claim or wait', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 10000,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0.1 });

        const advice = await CreatorTools.getFeeAdvice('token');
        expect(advice!.claimRecommendation).toBeDefined();
      });

      it('claim recommendation: 0.09 SOL suggests accumulating', async () => {
        mockGetToken.mockResolvedValue({
          mint: 'token',
          name: 'Test',
          symbol: 'TEST',
          volume24h: 10000,
        });
        mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0.09 });

        const advice = await CreatorTools.getFeeAdvice('token');
        expect(advice!.claimRecommendation.toLowerCase()).toContain('accumulate');
      });
    });
  });

  describe('edge cases', () => {
    it('handles zero values for all metrics', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Zero Token',
        symbol: 'ZERO',
        volume24h: 0,
        marketCap: 0,
        holders: 0,
        lifetimeFees: 0,
      });
      mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 0 });

      const analysis = await CreatorTools.analyzeToken('token');

      expect(analysis).not.toBeNull();
      expect(analysis!.metrics.healthScore).toBeDefined();
      expect(analysis!.metrics.feeEfficiency).toBe(0);
      expect(analysis!.metrics.communityStrength).toBeDefined();
    });

    it('handles undefined optional fields', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Minimal',
        symbol: 'MIN',
        // No optional fields
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const analysis = await CreatorTools.analyzeToken('token');

      expect(analysis).not.toBeNull();
      expect(analysis!.metrics).toBeDefined();
    });

    it('handles very large numbers', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Whale Token',
        symbol: 'WHALE',
        volume24h: 999999999,
        marketCap: 999999999999,
        holders: 999999,
        lifetimeFees: 999999,
      });
      mockGetCreatorFees.mockResolvedValue({ unclaimedFees: 99999 });

      const analysis = await CreatorTools.analyzeToken('token');

      expect(analysis).not.toBeNull();
      expect(analysis!.metrics.healthScore).toBeGreaterThanOrEqual(0);
      expect(analysis!.metrics.healthScore).toBeLessThanOrEqual(100);
    });

    it('handles empty description in marketing advice', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'No Desc',
        symbol: 'ND',
        volume24h: 5000,
        description: '',
      });

      const advice = await CreatorTools.getMarketingAdvice('token');

      expect(advice!.weaknesses.some(w => w.toLowerCase().includes('description'))).toBe(true);
    });

    it('handles description at exactly 20 characters (threshold)', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Test',
        symbol: 'TEST',
        volume24h: 5000,
        description: '12345678901234567890', // Exactly 20 chars
        image: 'https://example.com/logo.png',
      });

      const advice = await CreatorTools.getMarketingAdvice('token');

      // 20 chars should NOT be flagged as weak (threshold is > 20)
      expect(advice!.weaknesses.some(w => w.toLowerCase().includes('description'))).toBe(true);
    });

    it('handles description at 21 characters (above threshold)', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Test',
        symbol: 'TEST',
        volume24h: 5000,
        description: '123456789012345678901', // 21 chars
        image: 'https://example.com/logo.png',
      });

      const advice = await CreatorTools.getMarketingAdvice('token');

      // 21 chars should be fine
      expect(advice!.weaknesses.some(w => w.toLowerCase().includes('description'))).toBe(false);
    });

    it('fee efficiency caps at 100', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'High Fee',
        symbol: 'HF',
        marketCap: 1000, // Very low
        lifetimeFees: 10000, // Very high relative to market cap
        volume24h: 10000,
        holders: 100,
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const analysis = await CreatorTools.analyzeToken('token');

      expect(analysis!.metrics.feeEfficiency).toBeLessThanOrEqual(100);
    });

    it('marketing score is bounded 0-100', async () => {
      // Test maximum score
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Perfect',
        symbol: 'PERF',
        volume24h: 1000000,
        holders: 10000,
        image: 'https://example.com/logo.png',
        description: 'A very well described token with lots of information',
      });

      const adviceMax = await CreatorTools.getMarketingAdvice('token', {
        twitter: '@test',
        telegram: 't.me/test',
        website: 'https://test.com',
      });

      expect(adviceMax!.overallScore).toBeLessThanOrEqual(100);
      expect(adviceMax!.overallScore).toBeGreaterThanOrEqual(0);

      // Test minimum score
      mockGetToken.mockResolvedValue({
        mint: 'token2',
        name: 'Empty',
        symbol: 'EMPTY',
        volume24h: 0,
        holders: 0,
      });

      const adviceMin = await CreatorTools.getMarketingAdvice('token2');

      expect(adviceMin!.overallScore).toBeLessThanOrEqual(100);
      expect(adviceMin!.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('handles no social links provided', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Test',
        symbol: 'TEST',
        volume24h: 5000,
      });

      // Call without social links
      const advice = await CreatorTools.getMarketingAdvice('token');

      expect(advice).not.toBeNull();
      expect(advice!.weaknesses.length).toBeGreaterThan(0);
    });

    it('handles empty social links object', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Test',
        symbol: 'TEST',
        volume24h: 5000,
      });

      const advice = await CreatorTools.getMarketingAdvice('token', {});

      expect(advice).not.toBeNull();
    });
  });

  describe('recommendations generation', () => {
    it('recommends claiming fees when high', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 10000,
        holders: 100,
        marketCap: 100000,
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 10, // High unclaimed
      });

      const analysis = await CreatorTools.analyzeToken('token123');

      expect(analysis!.recommendations.some(r =>
        r.toLowerCase().includes('claim')
      )).toBe(true);
    });

    it('recommends building community when low holders', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 10000,
        holders: 30, // Low
        marketCap: 50000,
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const analysis = await CreatorTools.analyzeToken('token123');

      expect(analysis!.recommendations.some(r =>
        r.toLowerCase().includes('community') || r.toLowerCase().includes('engagement')
      )).toBe(true);
    });

    it('recommends marketing when low reach', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Test Token',
        symbol: 'TEST',
        volume24h: 500,
        holders: 50,
        marketCap: 10000,
        // No image, no description
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const analysis = await CreatorTools.analyzeToken('token123');

      expect(analysis!.recommendations.some(r =>
        r.toLowerCase().includes('logo') ||
        r.toLowerCase().includes('description') ||
        r.toLowerCase().includes('social')
      )).toBe(true);
    });

    it('limits recommendations to 5', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token123',
        name: 'Poor Token',
        symbol: 'POOR',
        volume24h: 10,
        holders: 5,
        marketCap: 1000,
        // Everything is wrong with this token
      });
      mockGetCreatorFees.mockResolvedValue({
        unclaimedFees: 5,
      });

      const analysis = await CreatorTools.analyzeToken('token123');

      expect(analysis!.recommendations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('error handling', () => {
    it('handles API error gracefully in analyzeToken', async () => {
      mockGetToken.mockRejectedValue(new Error('API Error'));

      await expect(CreatorTools.analyzeToken('token')).rejects.toThrow('API Error');
    });

    it('handles API error gracefully in getFeeAdvice', async () => {
      mockGetToken.mockRejectedValue(new Error('Network Error'));

      await expect(CreatorTools.getFeeAdvice('token')).rejects.toThrow('Network Error');
    });

    it('handles API error gracefully in getMarketingAdvice', async () => {
      mockGetToken.mockRejectedValue(new Error('Timeout'));

      await expect(CreatorTools.getMarketingAdvice('token')).rejects.toThrow('Timeout');
    });

    it('handles API error gracefully in getCommunityAdvice', async () => {
      mockGetToken.mockRejectedValue(new Error('Server Error'));

      await expect(CreatorTools.getCommunityAdvice('token')).rejects.toThrow('Server Error');
    });

    it('handles partial API failure in getFullAnalysis', async () => {
      // First call succeeds, but fee call fails
      let callCount = 0;
      mockGetToken.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          return Promise.resolve({
            mint: 'token',
            name: 'Test',
            symbol: 'TEST',
            volume24h: 10000,
            holders: 100,
          });
        }
        return Promise.resolve(null);
      });
      mockGetCreatorFees.mockResolvedValue(null);

      // Should not throw, returns null for failed parts
      const result = await CreatorTools.getFullAnalysis('token');
      expect(result).toBeDefined();
    });

    it('handles fee API returning null', async () => {
      mockGetToken.mockResolvedValue({
        mint: 'token',
        name: 'Test',
        symbol: 'TEST',
        volume24h: 10000,
      });
      mockGetCreatorFees.mockResolvedValue(null);

      const advice = await CreatorTools.getFeeAdvice('token');

      expect(advice).not.toBeNull();
      expect(advice!.unclaimedAmount).toBe(0);
    });
  });
});
