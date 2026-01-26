// CreatorTools - AI-powered advice for token creators
// Ghost for fee optimization, Sam for marketing, Carlo for community

import { getCharacter } from '../characters/index.js';
import { getLLMService } from './LLMService.js';
import { getBagsApiService, type TokenInfo, type CreatorFees } from './BagsApiService.js';

// Volume thresholds for analysis
const VOLUME_HIGH = 100000;
const VOLUME_MEDIUM = 10000;
const VOLUME_LOW = 1000;

// Holder thresholds for community stages
const HOLDERS_ESTABLISHED = 1000;
const HOLDERS_GROWING = 100;
const HOLDERS_EARLY = 10;

// Static content for marketing advice
const CONTENT_IDEAS = [
  'Share your token story - why did you create it?',
  'Post trading milestones (volume, holders, fees earned)',
  'Create memes featuring your token',
  'Host AMAs or Twitter Spaces',
  'Collaborate with other creators',
];

const PLATFORM_RECOMMENDATIONS = [
  'Twitter/X - Primary platform for CT (Crypto Twitter)',
  'Telegram - Community discussions and updates',
  'DexScreener - Paid listing ($299) for visibility',
  'Bags.fm - Native platform, engage with other creators',
];

const WARNING_SIGNS = [
  'Watch for: declining daily active users',
  'Watch for: increasing FUD or negativity',
  'Watch for: key community members leaving',
];

/** Map a value to a score based on thresholds */
function thresholdScore(value: number, thresholds: [number, number][]): number {
  for (const [threshold, score] of thresholds) {
    if (value > threshold) return score;
  }
  return thresholds[thresholds.length - 1]?.[1] ?? 0;
}

export interface TokenAnalysis {
  mint: string;
  token: TokenInfo;
  fees?: CreatorFees;
  metrics: {
    healthScore: number;           // 0-100
    feeEfficiency: number;         // 0-100
    communityStrength: number;     // 0-100
    marketingReach: number;        // 0-100
  };
  recommendations: string[];
}

export interface FeeAdvice {
  currentFee: number;
  suggestedFee: number;
  reasoning: string;
  potentialImpact: string;
  unclaimedAmount: number;
  claimRecommendation: string;
}

export interface MarketingAdvice {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  actionItems: string[];
  contentIdeas: string[];
  platformRecommendations: string[];
}

export interface CommunityAdvice {
  overallScore: number;
  currentState: string;
  growthTips: string[];
  engagementIdeas: string[];
  warningsSigns: string[];
  nextSteps: string[];
}

export class CreatorTools {
  /**
   * Get comprehensive token analysis
   */
  static async analyzeToken(mint: string): Promise<TokenAnalysis | null> {
    const api = getBagsApiService();

    const token = await api.getToken(mint);
    if (!token) return null;

    const fees = await api.getCreatorFees(mint);

    // Calculate metrics
    const metrics = this.calculateMetrics(token);

    // Generate recommendations
    const recommendations = this.generateRecommendations(token, fees, metrics);

    return {
      mint,
      token,
      fees: fees || undefined,
      metrics,
      recommendations,
    };
  }

  /**
   * Get fee optimization advice from Ghost
   */
  static async getFeeAdvice(mint: string): Promise<FeeAdvice | null> {
    const api = getBagsApiService();
    const ghost = getCharacter('ghost');

    const token = await api.getToken(mint);
    if (!token) return null;

    const fees = await api.getCreatorFees(mint);

    const currentFee = 1; // Default assumption, would need actual fee from API
    const volume24h = token.volume24h || 0;
    const lifetimeFees = token.lifetimeFees || 0;
    const unclaimedAmount = fees?.unclaimedFees || 0;

    // Fee analysis based on volume
    let suggestedFee: number;
    let reasoning: string;
    let potentialImpact: string;

    if (volume24h > VOLUME_HIGH) {
      suggestedFee = 0.5;
      reasoning = 'High volume token - lower fee encourages more trading';
      potentialImpact = 'Could increase volume by 20-30% while maintaining fee income';
    } else if (volume24h < VOLUME_LOW) {
      suggestedFee = 1.5;
      reasoning = 'Lower volume - slightly higher fee to maximize per-trade income';
      potentialImpact = 'May reduce volume slightly but increase per-trade earnings';
    } else {
      suggestedFee = 1;
      reasoning = 'Current volume is healthy - standard 1% fee is optimal';
      potentialImpact = 'Balanced approach for sustainable growth';
    }

    // Claim recommendation
    let claimRecommendation = '';
    if (unclaimedAmount > 1) {
      claimRecommendation = `You have ${unclaimedAmount.toFixed(2)} SOL unclaimed! Consider claiming to secure your earnings.`;
    } else if (unclaimedAmount > 0.1) {
      claimRecommendation = `${unclaimedAmount.toFixed(4)} SOL unclaimed. You can claim now or wait for it to accumulate.`;
    } else {
      claimRecommendation = 'Fees are low - let them accumulate before claiming to save on transaction costs.';
    }

    // Get personalized advice from Ghost if available
    if (ghost) {
      const llm = getLLMService();
      const context = `Token: ${token.name} ($${token.symbol})
Market Cap: $${token.marketCap?.toLocaleString() || 'unknown'}
24h Volume: $${volume24h.toLocaleString()}
Lifetime Fees: ${lifetimeFees.toFixed(2)} SOL
Unclaimed: ${unclaimedAmount.toFixed(4)} SOL`;

      const response = await llm.generateResponse(
        ghost,
        `Analyze this token's fee performance and give brief advice: ${context}`,
        [],
        { messages: [] }
      );

      reasoning = response.text;
    }

    return {
      currentFee,
      suggestedFee,
      reasoning,
      potentialImpact,
      unclaimedAmount,
      claimRecommendation,
    };
  }

  /**
   * Get marketing advice from Sam
   */
  static async getMarketingAdvice(mint: string, socialLinks?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  }): Promise<MarketingAdvice | null> {
    const api = getBagsApiService();
    const sam = getCharacter('sam');

    const token = await api.getToken(mint);
    if (!token) return null;

    // Base analysis
    const hasTwitter = !!socialLinks?.twitter;
    const hasTelegram = !!socialLinks?.telegram;
    const hasWebsite = !!socialLinks?.website;
    const hasImage = !!token.image;
    const hasDescription = !!token.description && token.description.length > 20;

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const actionItems: string[] = [];

    // Analyze presence
    if (hasTwitter) strengths.push('Active Twitter/X presence');
    else {
      weaknesses.push('No Twitter/X presence');
      actionItems.push('Create a Twitter/X account for your token');
    }

    if (hasTelegram) strengths.push('Telegram community exists');
    else {
      weaknesses.push('No Telegram group');
      actionItems.push('Create a Telegram group for community building');
    }

    if (hasWebsite) strengths.push('Has dedicated website');
    else actionItems.push('Consider creating a simple landing page');

    if (hasImage) strengths.push('Has token logo/image');
    else {
      weaknesses.push('Missing token image');
      actionItems.push('Add a professional logo (512x512 PNG)');
    }

    if (hasDescription) strengths.push('Has token description');
    else {
      weaknesses.push('Missing or weak description');
      actionItems.push('Write a compelling token description');
    }

    // Volume-based analysis
    const volume24h = token.volume24h || 0;
    if (volume24h > 50000) {
      strengths.push('Strong trading volume');
    } else if (volume24h < VOLUME_LOW) {
      weaknesses.push('Low trading volume');
      actionItems.push('Focus on driving awareness and trading activity');
    }

    // Calculate overall score
    const overallScore = Math.min(100, Math.max(0,
      (strengths.length * 15) +
      (hasImage ? 10 : 0) +
      (hasDescription ? 10 : 0) +
      (volume24h > VOLUME_MEDIUM ? 20 : volume24h > VOLUME_LOW ? 10 : 0)
    ));


    // Get personalized advice from Sam if available
    if (sam) {
      const llm = getLLMService();
      const response = await llm.generateResponse(
        sam,
        `Give 3 specific marketing tips for this token: ${token.name} ($${token.symbol}), market cap: $${token.marketCap?.toLocaleString() || 'unknown'}, volume: $${volume24h.toLocaleString()}`,
        [],
        { messages: [] }
      );

      // Add Sam's personalized tips to action items
      const samTips = response.text.split('\n').filter(line => line.trim().length > 0);
      actionItems.push(...samTips.slice(0, 3));
    }

    return {
      overallScore,
      strengths,
      weaknesses,
      actionItems,
      contentIdeas: CONTENT_IDEAS,
      platformRecommendations: PLATFORM_RECOMMENDATIONS,
    };
  }

  /**
   * Get community building advice from Carlo
   */
  static async getCommunityAdvice(mint: string): Promise<CommunityAdvice | null> {
    const api = getBagsApiService();
    const carlo = getCharacter('carlo');

    const token = await api.getToken(mint);
    if (!token) return null;

    const holders = token.holders || 0;
    const volume24h = token.volume24h || 0;

    // Determine community state based on holder thresholds
    let currentState: string;
    let overallScore: number;

    if (holders > HOLDERS_ESTABLISHED) {
      currentState = 'Established community with strong holder base';
      overallScore = 80;
    } else if (holders > HOLDERS_GROWING) {
      currentState = 'Growing community - critical phase for retention';
      overallScore = 50;
    } else if (holders > HOLDERS_EARLY) {
      currentState = 'Early stage - focus on finding your first believers';
      overallScore = 30;
    } else {
      currentState = 'Just launched - time to spread the word!';
      overallScore = 10;
    }

    // Adjust for volume
    if (volume24h > VOLUME_MEDIUM) overallScore = Math.min(100, overallScore + 15);

    // Growth tips based on stage
    const growthTips: string[] = [];
    const engagementIdeas: string[] = [];
    const warningsSigns: string[] = [];
    const nextSteps: string[] = [];

    if (holders < 50) {
      growthTips.push(
        'Focus on quality over quantity - find true believers',
        'Engage personally with early holders',
        'Share your vision and roadmap',
        'Be active in Bags.fm and CT communities'
      );
      engagementIdeas.push(
        'Host a launch celebration on Twitter Spaces',
        'Create a founding holders channel',
        'Share behind-the-scenes content'
      );
      nextSteps.push(
        'Post daily updates on progress',
        'Respond to every comment and question',
        'Collaborate with other small creators'
      );
    } else if (holders < 500) {
      growthTips.push(
        'Create rituals (daily GMs, weekly updates)',
        'Empower community moderators',
        'Start community initiatives',
        'Consider holder-gated content or perks'
      );
      engagementIdeas.push(
        'Meme contests with prizes',
        'Holder spotlights',
        'Community polls for decisions',
        'Weekly recap threads'
      );
      nextSteps.push(
        'Set up proper moderation in Telegram',
        'Create community guidelines',
        'Plan your first community event'
      );
    } else {
      growthTips.push(
        'Delegate to trusted community members',
        'Create tiers of engagement',
        'Build sustainable community programs',
        'Consider DAO governance'
      );
      engagementIdeas.push(
        'Ambassador programs',
        'Community-led initiatives',
        'IRL meetups or virtual events',
        'Educational content series'
      );
      nextSteps.push(
        'Document community processes',
        'Create onboarding for new members',
        'Develop long-term community roadmap'
      );
    }

    // Warning signs
    if (volume24h < 100 && holders > 50) {
      warningsSigns.push('Low trading volume despite holder count - engagement may be declining');
    }
    warningsSigns.push(...WARNING_SIGNS);

    // Get personalized advice from Carlo if available
    if (carlo) {
      const llm = getLLMService();
      const response = await llm.generateResponse(
        carlo,
        `Give community building advice for ${token.name} with ${holders} holders and $${volume24h.toLocaleString()} daily volume. Keep it brief and actionable.`,
        [],
        { messages: [] }
      );

      // Add Carlo's tips
      nextSteps.unshift(response.text.split('\n')[0] || 'Engage with your community daily!');
    }

    return {
      overallScore,
      currentState,
      growthTips,
      engagementIdeas,
      warningsSigns,
      nextSteps,
    };
  }

  /**
   * Get comprehensive advice from all agents
   */
  static async getFullAnalysis(mint: string, socialLinks?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  }): Promise<{
    token: TokenAnalysis | null;
    fees: FeeAdvice | null;
    marketing: MarketingAdvice | null;
    community: CommunityAdvice | null;
  }> {
    const [token, fees, marketing, community] = await Promise.all([
      this.analyzeToken(mint),
      this.getFeeAdvice(mint),
      this.getMarketingAdvice(mint, socialLinks),
      this.getCommunityAdvice(mint),
    ]);

    return { token, fees, marketing, community };
  }

  /**
   * Calculate token health metrics
   */
  private static calculateMetrics(token: TokenInfo): TokenAnalysis['metrics'] {
    const volume24h = token.volume24h || 0;
    const marketCap = token.marketCap || 0;
    const holders = token.holders || 0;
    const lifetimeFees = token.lifetimeFees || 0;

    // Health score based on activity
    const healthScore = thresholdScore(volume24h, [
      [VOLUME_HIGH, 90], [50000, 75], [VOLUME_MEDIUM, 60],
      [VOLUME_LOW, 40], [100, 20], [0, 10],
    ]);

    // Fee efficiency - lifetime fees relative to market cap
    const feeEfficiency = marketCap > 0
      ? Math.min(100, Math.round((lifetimeFees * 100) / (marketCap / 1000) * 10))
      : 0;

    // Community strength based on holders
    const communityStrength = thresholdScore(holders, [
      [HOLDERS_ESTABLISHED, 90], [500, 70], [HOLDERS_GROWING, 50], [50, 30], [0, 10],
    ]);

    // Marketing reach - combination of factors
    const hasImage = token.image ? 20 : 0;
    const hasDescription = token.description && token.description.length > 20 ? 20 : 0;
    const volumeScore = Math.min(40, volume24h / 2500);
    const holderScore = Math.min(20, holders / 50);
    const marketingReach = hasImage + hasDescription + volumeScore + holderScore;

    return {
      healthScore: Math.round(healthScore),
      feeEfficiency,
      communityStrength: Math.round(communityStrength),
      marketingReach: Math.round(marketingReach),
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  private static generateRecommendations(
    token: TokenInfo,
    fees: CreatorFees | null,
    metrics: TokenAnalysis['metrics']
  ): string[] {
    const recommendations: string[] = [];

    // Health-based recommendations
    if (metrics.healthScore < 30) {
      recommendations.push('Priority: Increase trading activity through marketing and community engagement');
    }

    // Fee recommendations
    if (fees && fees.unclaimedFees > 1) {
      recommendations.push(`Claim your ${fees.unclaimedFees.toFixed(2)} SOL in unclaimed fees`);
    }

    // Community recommendations
    if (metrics.communityStrength < 50) {
      recommendations.push('Build community: Focus on engagement and holder retention');
    }

    // Marketing recommendations
    if (metrics.marketingReach < 40) {
      if (!token.image) recommendations.push('Add a professional token logo');
      if (!token.description || token.description.length < 20) {
        recommendations.push('Write a compelling token description');
      }
      recommendations.push('Increase social media presence');
    }

    // Volume recommendations
    if ((token.volume24h || 0) < VOLUME_LOW) {
      recommendations.push('Consider running promotions or events to boost trading');
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }
}

export default CreatorTools;
