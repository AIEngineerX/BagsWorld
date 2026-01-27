// Evaluators for BagsWorld ElizaOS plugin
// These score message relevance to help prioritize actions

import type { Evaluator, EvaluatorResult, IAgentRuntime, Memory, State } from '../types/elizaos.js';

/**
 * Scores higher when a Solana token mint address or symbol is mentioned.
 * Associated with: lookupToken action
 */
export const tokenMentionEvaluator: Evaluator = {
  name: 'tokenMention',
  description: 'Detects token mint addresses or $SYMBOL mentions',
  relatedActions: ['lookupToken'],

  evaluate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<EvaluatorResult> => {
    const text = message.content?.text || '';

    // Check for base58 mint address (32-44 chars)
    const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const hasMint = !!mintMatch;

    // Check for token symbol pattern ($SYMBOL)
    const symbolMatch = text.match(/\$([A-Za-z]{2,10})/);
    const hasSymbol = !!symbolMatch;

    // Check for token-related keywords
    const tokenKeywords = ['token', 'mint', 'contract', 'address', 'coin'];
    const hasKeyword = tokenKeywords.some(k => text.toLowerCase().includes(k));

    let score = 0;
    const reasons: string[] = [];

    if (hasMint) {
      score += 0.5;
      reasons.push(`mint address: ${mintMatch[0].slice(0, 8)}...`);
    }
    if (hasSymbol) {
      score += 0.3;
      reasons.push(`symbol: $${symbolMatch[1]}`);
    }
    if (hasKeyword) {
      score += 0.2;
      reasons.push('token keyword detected');
    }

    return {
      score: Math.min(score, 1),
      reason: reasons.length ? reasons.join(', ') : 'no token reference',
      data: {
        mint: mintMatch?.[0],
        symbol: symbolMatch?.[1],
      },
    };
  },
};

/**
 * Scores higher when user asks about fees, earnings, or revenue.
 * Associated with: getCreatorFees action
 */
export const feeQueryEvaluator: Evaluator = {
  name: 'feeQuery',
  description: 'Detects fee, earnings, and revenue related queries',
  relatedActions: ['getCreatorFees'],

  evaluate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<EvaluatorResult> => {
    const text = message.content?.text?.toLowerCase() || '';

    // Primary fee keywords (high signal)
    const primaryKeywords = ['fees', 'fee', 'earnings', 'earned', 'revenue', 'claimed', 'unclaimed', 'claim'];
    const primaryMatches = primaryKeywords.filter(k => text.includes(k));

    // Secondary keywords (medium signal)
    const secondaryKeywords = ['made', 'profit', 'income', 'payout', 'share', 'split'];
    const secondaryMatches = secondaryKeywords.filter(k => text.includes(k));

    // Question patterns that suggest fee inquiry
    const questionPatterns = [
      /how much.*(?:earn|made|fees)/,
      /what.*(?:fees|earnings)/,
      /(?:check|show|get).*(?:fees|earnings)/,
    ];
    const hasQuestionPattern = questionPatterns.some(p => p.test(text));

    let score = 0;
    const reasons: string[] = [];

    if (primaryMatches.length > 0) {
      score += Math.min(primaryMatches.length * 0.3, 0.6);
      reasons.push(`keywords: ${primaryMatches.join(', ')}`);
    }
    if (secondaryMatches.length > 0) {
      score += Math.min(secondaryMatches.length * 0.15, 0.3);
      reasons.push(`secondary: ${secondaryMatches.join(', ')}`);
    }
    if (hasQuestionPattern) {
      score += 0.2;
      reasons.push('fee question pattern');
    }

    return {
      score: Math.min(score, 1),
      reason: reasons.length ? reasons.join(', ') : 'no fee reference',
      data: {
        primaryKeywords: primaryMatches,
        secondaryKeywords: secondaryMatches,
      },
    };
  },
};

/**
 * Scores higher when user asks about new launches or recent tokens.
 * Associated with: getRecentLaunches action
 */
export const launchQueryEvaluator: Evaluator = {
  name: 'launchQuery',
  description: 'Detects queries about new token launches',
  relatedActions: ['getRecentLaunches'],

  evaluate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<EvaluatorResult> => {
    const text = message.content?.text?.toLowerCase() || '';

    // Launch-related keywords
    const launchKeywords = ['launch', 'launched', 'new', 'recent', 'latest', 'fresh', 'just dropped'];
    const launchMatches = launchKeywords.filter(k => text.includes(k));

    // Token context keywords
    const contextKeywords = ['token', 'tokens', 'coin', 'coins', 'project', 'projects'];
    const contextMatches = contextKeywords.filter(k => text.includes(k));

    // Time-based patterns
    const timePatterns = [
      /(?:today|yesterday|this week|24h|hour)/,
      /what.*(?:new|launched)/,
      /show.*(?:new|recent|latest)/,
    ];
    const hasTimePattern = timePatterns.some(p => p.test(text));

    let score = 0;
    const reasons: string[] = [];

    if (launchMatches.length > 0) {
      score += Math.min(launchMatches.length * 0.25, 0.5);
      reasons.push(`launch: ${launchMatches.join(', ')}`);
    }
    if (contextMatches.length > 0 && launchMatches.length > 0) {
      score += 0.25;
      reasons.push(`context: ${contextMatches.join(', ')}`);
    }
    if (hasTimePattern) {
      score += 0.25;
      reasons.push('time pattern');
    }

    return {
      score: Math.min(score, 1),
      reason: reasons.length ? reasons.join(', ') : 'no launch reference',
      data: {
        launchKeywords: launchMatches,
        contextKeywords: contextMatches,
      },
    };
  },
};

/**
 * Scores higher when user asks about world status, health, or weather.
 * Associated with: checkWorldHealth action
 */
export const worldStatusEvaluator: Evaluator = {
  name: 'worldStatus',
  description: 'Detects queries about BagsWorld status and health',
  relatedActions: ['checkWorldHealth'],

  evaluate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<EvaluatorResult> => {
    const text = message.content?.text?.toLowerCase() || '';

    // World status keywords
    const statusKeywords = ['health', 'status', 'state', 'weather', 'world', 'bagsworld', 'ecosystem'];
    const statusMatches = statusKeywords.filter(k => text.includes(k));

    // Condition keywords
    const conditionKeywords = ['thriving', 'healthy', 'growing', 'quiet', 'dormant', 'dying', 'sunny', 'cloudy', 'rain', 'storm'];
    const conditionMatches = conditionKeywords.filter(k => text.includes(k));

    // Question patterns
    const questionPatterns = [
      /how.*(?:is|are).*(?:world|things|ecosystem)/,
      /what.*(?:status|health|weather)/,
      /(?:check|show).*(?:world|status|health)/,
    ];
    const hasQuestionPattern = questionPatterns.some(p => p.test(text));

    let score = 0;
    const reasons: string[] = [];

    if (statusMatches.length > 0) {
      score += Math.min(statusMatches.length * 0.25, 0.5);
      reasons.push(`status: ${statusMatches.join(', ')}`);
    }
    if (conditionMatches.length > 0) {
      score += 0.3;
      reasons.push(`condition: ${conditionMatches.join(', ')}`);
    }
    if (hasQuestionPattern) {
      score += 0.3;
      reasons.push('status question');
    }

    return {
      score: Math.min(score, 1),
      reason: reasons.length ? reasons.join(', ') : 'no world status reference',
      data: {
        statusKeywords: statusMatches,
        conditionKeywords: conditionMatches,
      },
    };
  },
};

/**
 * Scores higher when user asks about top creators or leaderboard.
 * Associated with: getTopCreators action
 */
export const creatorQueryEvaluator: Evaluator = {
  name: 'creatorQuery',
  description: 'Detects queries about top creators and rankings',
  relatedActions: ['getTopCreators'],

  evaluate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<EvaluatorResult> => {
    const text = message.content?.text?.toLowerCase() || '';

    // Creator keywords
    const creatorKeywords = ['creator', 'creators', 'founder', 'founders', 'developer', 'devs'];
    const creatorMatches = creatorKeywords.filter(k => text.includes(k));

    // Ranking keywords
    const rankingKeywords = ['top', 'best', 'leading', 'biggest', 'leaderboard', 'ranking', 'ranked'];
    const rankingMatches = rankingKeywords.filter(k => text.includes(k));

    // Earner patterns
    const earnerPatterns = [
      /who.*(?:earning|made|top)/,
      /top.*(?:earners|creators|builders)/,
      /(?:best|biggest).*(?:creators|earners)/,
    ];
    const hasEarnerPattern = earnerPatterns.some(p => p.test(text));

    let score = 0;
    const reasons: string[] = [];

    if (creatorMatches.length > 0) {
      score += Math.min(creatorMatches.length * 0.25, 0.4);
      reasons.push(`creator: ${creatorMatches.join(', ')}`);
    }
    if (rankingMatches.length > 0) {
      score += Math.min(rankingMatches.length * 0.2, 0.4);
      reasons.push(`ranking: ${rankingMatches.join(', ')}`);
    }
    if (hasEarnerPattern) {
      score += 0.3;
      reasons.push('earner pattern');
    }

    // Boost if both creator and ranking keywords present
    if (creatorMatches.length > 0 && rankingMatches.length > 0) {
      score += 0.2;
    }

    return {
      score: Math.min(score, 1),
      reason: reasons.length ? reasons.join(', ') : 'no creator reference',
      data: {
        creatorKeywords: creatorMatches,
        rankingKeywords: rankingMatches,
      },
    };
  },
};

/**
 * Scores higher when user asks for explanations or how things work.
 * Useful for routing to educational responses.
 */
export const explanationQueryEvaluator: Evaluator = {
  name: 'explanationQuery',
  description: 'Detects requests for explanations and how-to guidance',
  relatedActions: [],

  evaluate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<EvaluatorResult> => {
    const text = message.content?.text?.toLowerCase() || '';

    // Explanation request patterns
    const explainPatterns = [
      /(?:what is|what's|what are)/,
      /(?:how does|how do|how to|how can)/,
      /(?:explain|tell me about|help me understand)/,
      /(?:why does|why is|why do)/,
      /(?:can you|could you).*(?:explain|tell)/,
    ];
    const hasExplainPattern = explainPatterns.some(p => p.test(text));

    // Educational keywords
    const eduKeywords = ['learn', 'understand', 'guide', 'tutorial', 'help', 'newbie', 'beginner'];
    const eduMatches = eduKeywords.filter(k => text.includes(k));

    // Topic keywords (what they want explained)
    const topicKeywords = ['bags', 'bagsworld', 'fee', 'token', 'launch', 'claim', 'wallet', 'solana'];
    const topicMatches = topicKeywords.filter(k => text.includes(k));

    let score = 0;
    const reasons: string[] = [];

    if (hasExplainPattern) {
      score += 0.4;
      reasons.push('explanation request');
    }
    if (eduMatches.length > 0) {
      score += Math.min(eduMatches.length * 0.2, 0.3);
      reasons.push(`edu: ${eduMatches.join(', ')}`);
    }
    if (topicMatches.length > 0 && hasExplainPattern) {
      score += 0.3;
      reasons.push(`topic: ${topicMatches.join(', ')}`);
    }

    return {
      score: Math.min(score, 1),
      reason: reasons.length ? reasons.join(', ') : 'not an explanation request',
      data: {
        eduKeywords: eduMatches,
        topicKeywords: topicMatches,
      },
    };
  },
};

// Export all evaluators as an array for plugin registration
export const allEvaluators: Evaluator[] = [
  tokenMentionEvaluator,
  feeQueryEvaluator,
  launchQueryEvaluator,
  worldStatusEvaluator,
  creatorQueryEvaluator,
  explanationQueryEvaluator,
];

export default allEvaluators;
