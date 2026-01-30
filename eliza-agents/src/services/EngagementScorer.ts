// EngagementScorer.ts - X Algorithm-inspired engagement scoring for Bagsy
// Goal: Maximize virality by prioritizing high-value engagement opportunities
//
// Based on X's recommendation algorithm principles:
// - Source → Hydrate → Filter → Score → Select → Act pipeline
// - Weighted multi-signal scoring
// - Author diversity to avoid spam patterns
// - Negative signals for bot/spam detection

// ============================================================================
// Types
// ============================================================================

export interface TwitterCandidate {
  tweetId: string;
  authorId: string;
  authorUsername: string;
  text: string;
  createdAt: Date;
  // Hydrated fields (filled by hydrateCandidate)
  authorFollowers?: number;
  authorFollowing?: number;
  authorVerified?: boolean;
  authorTweetCount?: number;
  tweetLikes?: number;
  tweetRetweets?: number;
  tweetReplies?: number;
}

export interface ScoredCandidate extends TwitterCandidate {
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  authorInfluence: number;      // 0-40 points
  contentRelevance: number;     // 0-35 points
  viralityPotential: number;    // 0-25 points
  penalties: number;            // Negative deductions
  total: number;
}

export interface EngagementScorerConfig {
  // Weights (should sum to 100)
  authorInfluenceWeight: number;
  contentRelevanceWeight: number;
  viralityPotentialWeight: number;
  // Thresholds
  minScoreToEngage: number;
  maxCandidatesPerCycle: number;
  // Filters
  minFollowers: number;
  maxFollowerRatio: number;  // following/followers - high ratio = likely bot
}

// ============================================================================
// Default Configuration (tuned for virality)
// ============================================================================

const DEFAULT_CONFIG: EngagementScorerConfig = {
  // Weights
  authorInfluenceWeight: 40,
  contentRelevanceWeight: 35,
  viralityPotentialWeight: 25,
  // Thresholds
  minScoreToEngage: 30,       // Minimum score to consider engaging
  maxCandidatesPerCycle: 3,   // Max engagements per cycle
  // Filters
  minFollowers: 50,           // Skip accounts with <50 followers
  maxFollowerRatio: 10,       // Skip if following 10x more than followers
};

// ============================================================================
// Keyword Banks for Content Analysis
// ============================================================================

const HIGH_VALUE_KEYWORDS = [
  // Direct Bags.fm references
  "bags.fm", "bagsfm", "@bagsfm", "@bagsapp", "bags app",
  // Fee/claim related
  "claim", "fees", "unclaimed", "royalties", "earnings",
  // Creator economy
  "creator", "launch", "token", "launched", "memecoin",
  // Solana ecosystem
  "solana", "sol", "$sol",
  // Engagement signals
  "help", "how do i", "how to", "anyone know", "question",
];

const MEDIUM_VALUE_KEYWORDS = [
  // Crypto general
  "crypto", "web3", "defi", "degen",
  // Community
  "community", "gm", "wagmi", "lfg",
  // Trading
  "trading", "trade", "buy", "sell",
];

const NEGATIVE_KEYWORDS = [
  // Spam indicators
  "airdrop", "giveaway", "free mint", "whitelist", "wl spot",
  // Scam patterns
  "dm me", "send sol", "guaranteed", "100x",
  // Bot patterns
  "follow back", "f4f", "follow for follow",
];

const BOT_USERNAME_PATTERNS = [
  /bot$/i,
  /^bot_/i,
  /_bot_/i,
  /\d{5,}$/,      // Ends with 5+ digits
  /^[a-z]{2,4}\d{6,}$/i,  // Short letters + many numbers
];

// ============================================================================
// EngagementScorer Class
// ============================================================================

export class EngagementScorer {
  private config: EngagementScorerConfig;
  private engagedAuthors: Set<string> = new Set();  // Track authors engaged this cycle
  private bearerToken: string | null;

  constructor(config?: Partial<EngagementScorerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN || null;
  }

  // ==========================================================================
  // Main Pipeline: Source → Hydrate → Filter → Score → Select
  // ==========================================================================

  /**
   * Process candidates through the full engagement pipeline
   * Returns top candidates sorted by score, ready for engagement
   */
  async processCandidates(candidates: TwitterCandidate[]): Promise<ScoredCandidate[]> {
    console.log(`[EngagementScorer] Processing ${candidates.length} candidates`);

    // Step 1: Hydrate - Enrich with author metrics
    const hydrated = await this.hydrateCandidates(candidates);
    console.log(`[EngagementScorer] Hydrated ${hydrated.length} candidates`);

    // Step 2: Filter - Remove ineligible candidates
    const filtered = this.filterCandidates(hydrated);
    console.log(`[EngagementScorer] ${filtered.length} passed filters`);

    // Step 3: Score - Calculate engagement potential
    const scored = filtered.map(c => this.scoreCandidate(c));

    // Step 4: Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Step 5: Select - Apply diversity and limits
    const selected = this.selectTopCandidates(scored);
    console.log(`[EngagementScorer] Selected ${selected.length} top candidates`);

    // Log top candidates for debugging
    for (const c of selected) {
      console.log(`[EngagementScorer] @${c.authorUsername} (${c.authorFollowers || "?"} followers) - Score: ${c.score.toFixed(1)}`);
    }

    return selected;
  }

  /**
   * Reset the engaged authors set (call at start of new cycle)
   */
  resetCycle(): void {
    this.engagedAuthors.clear();
  }

  /**
   * Mark an author as engaged (for diversity tracking)
   */
  markEngaged(authorUsername: string): void {
    this.engagedAuthors.add(authorUsername.toLowerCase());
  }

  // ==========================================================================
  // Step 1: Hydrate - Enrich candidates with author metrics
  // ==========================================================================

  private async hydrateCandidates(candidates: TwitterCandidate[]): Promise<TwitterCandidate[]> {
    if (!this.bearerToken) {
      console.log("[EngagementScorer] No bearer token, skipping hydration");
      return candidates;
    }

    // Collect unique author IDs
    const authorIds = [...new Set(candidates.map(c => c.authorId))];

    if (authorIds.length === 0) return candidates;

    // Batch fetch user data (Twitter allows up to 100 per request)
    const userMap = new Map<string, {
      followers: number;
      following: number;
      verified: boolean;
      tweetCount: number;
    }>();

    try {
      const url = `https://api.twitter.com/2/users?ids=${authorIds.join(",")}&user.fields=public_metrics,verified`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.bearerToken}` },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.data) {
          for (const user of data.data) {
            userMap.set(user.id, {
              followers: user.public_metrics?.followers_count || 0,
              following: user.public_metrics?.following_count || 0,
              verified: user.verified || false,
              tweetCount: user.public_metrics?.tweet_count || 0,
            });
          }
        }
      } else {
        console.warn(`[EngagementScorer] User lookup failed: ${response.status}`);
      }
    } catch (error) {
      console.error("[EngagementScorer] Hydration error:", error);
    }

    // Enrich candidates with user data
    return candidates.map(c => {
      const userData = userMap.get(c.authorId);
      if (userData) {
        return {
          ...c,
          authorFollowers: userData.followers,
          authorFollowing: userData.following,
          authorVerified: userData.verified,
          authorTweetCount: userData.tweetCount,
        };
      }
      return c;
    });
  }

  // ==========================================================================
  // Step 2: Filter - Remove ineligible candidates
  // ==========================================================================

  private filterCandidates(candidates: TwitterCandidate[]): TwitterCandidate[] {
    return candidates.filter(c => {
      // Skip if already engaged this cycle (diversity)
      if (this.engagedAuthors.has(c.authorUsername.toLowerCase())) {
        return false;
      }

      // Skip low-follower accounts (unlikely to amplify)
      if (c.authorFollowers !== undefined && c.authorFollowers < this.config.minFollowers) {
        return false;
      }

      // Skip accounts with suspicious follower ratio (likely bots)
      if (c.authorFollowers && c.authorFollowing) {
        const ratio = c.authorFollowing / Math.max(c.authorFollowers, 1);
        if (ratio > this.config.maxFollowerRatio) {
          return false;
        }
      }

      // Skip bot-like usernames
      if (this.looksLikeBot(c.authorUsername)) {
        return false;
      }

      // Skip tweets with negative keywords (spam/scam)
      const textLower = c.text.toLowerCase();
      for (const keyword of NEGATIVE_KEYWORDS) {
        if (textLower.includes(keyword)) {
          return false;
        }
      }

      return true;
    });
  }

  private looksLikeBot(username: string): boolean {
    for (const pattern of BOT_USERNAME_PATTERNS) {
      if (pattern.test(username)) {
        return true;
      }
    }
    return false;
  }

  // ==========================================================================
  // Step 3: Score - Calculate engagement potential
  // ==========================================================================

  private scoreCandidate(candidate: TwitterCandidate): ScoredCandidate {
    const authorScore = this.scoreAuthorInfluence(candidate);
    const contentScore = this.scoreContentRelevance(candidate);
    const viralityScore = this.scoreViralityPotential(candidate);
    const penalties = this.calculatePenalties(candidate);

    const total = Math.max(0, authorScore + contentScore + viralityScore + penalties);

    return {
      ...candidate,
      score: total,
      scoreBreakdown: {
        authorInfluence: authorScore,
        contentRelevance: contentScore,
        viralityPotential: viralityScore,
        penalties,
        total,
      },
    };
  }

  /**
   * Score based on author influence (0-40 points)
   * High-follower, verified accounts amplify reach
   */
  private scoreAuthorInfluence(candidate: TwitterCandidate): number {
    let score = 0;
    const maxScore = this.config.authorInfluenceWeight;

    // Follower count (log scale: 100=5, 1K=15, 10K=25, 100K=35)
    if (candidate.authorFollowers) {
      const followers = candidate.authorFollowers;
      if (followers >= 100000) score += 35;
      else if (followers >= 10000) score += 25;
      else if (followers >= 1000) score += 15;
      else if (followers >= 100) score += 5;
      // Bonus for very large accounts
      if (followers >= 500000) score += 5;
    }

    // Verified badge bonus
    if (candidate.authorVerified) {
      score += 5;
    }

    return Math.min(score, maxScore);
  }

  /**
   * Score based on content relevance (0-35 points)
   * Bags.fm and fee-related content is highest value
   */
  private scoreContentRelevance(candidate: TwitterCandidate): number {
    let score = 0;
    const maxScore = this.config.contentRelevanceWeight;
    const textLower = candidate.text.toLowerCase();

    // High-value keywords (5 points each, max 20)
    let highValueMatches = 0;
    for (const keyword of HIGH_VALUE_KEYWORDS) {
      if (textLower.includes(keyword)) {
        highValueMatches++;
      }
    }
    score += Math.min(highValueMatches * 5, 20);

    // Medium-value keywords (2 points each, max 10)
    let mediumValueMatches = 0;
    for (const keyword of MEDIUM_VALUE_KEYWORDS) {
      if (textLower.includes(keyword)) {
        mediumValueMatches++;
      }
    }
    score += Math.min(mediumValueMatches * 2, 10);

    // Question signal (someone asking for help = high engagement opportunity)
    if (textLower.includes("?") || textLower.includes("how") || textLower.includes("help")) {
      score += 5;
    }

    return Math.min(score, maxScore);
  }

  /**
   * Score based on virality potential (0-25 points)
   * Recency, engagement velocity, and amplification potential
   */
  private scoreViralityPotential(candidate: TwitterCandidate): number {
    let score = 0;
    const maxScore = this.config.viralityPotentialWeight;

    // Recency score (newer = higher, stale = lower)
    const ageMinutes = (Date.now() - candidate.createdAt.getTime()) / (1000 * 60);
    if (ageMinutes < 15) score += 15;        // Very fresh
    else if (ageMinutes < 60) score += 10;   // Recent
    else if (ageMinutes < 180) score += 5;   // Somewhat recent
    // Older than 3 hours = no recency bonus

    // Tweet engagement (if available)
    if (candidate.tweetLikes !== undefined) {
      if (candidate.tweetLikes >= 100) score += 5;
      else if (candidate.tweetLikes >= 10) score += 3;
    }

    // Author activity level (active accounts engage more)
    if (candidate.authorTweetCount !== undefined) {
      if (candidate.authorTweetCount >= 1000) score += 5;
      else if (candidate.authorTweetCount >= 100) score += 2;
    }

    return Math.min(score, maxScore);
  }

  /**
   * Calculate penalty deductions
   * Returns negative number to subtract from total
   */
  private calculatePenalties(candidate: TwitterCandidate): number {
    let penalty = 0;

    // Suspicious follower/following ratio
    if (candidate.authorFollowers && candidate.authorFollowing) {
      const ratio = candidate.authorFollowing / Math.max(candidate.authorFollowers, 1);
      if (ratio > 5) penalty -= 10;
      else if (ratio > 3) penalty -= 5;
    }

    // Very low engagement rate (lots of tweets, few followers)
    if (candidate.authorTweetCount && candidate.authorFollowers) {
      const engagementIndicator = candidate.authorFollowers / candidate.authorTweetCount;
      if (engagementIndicator < 0.1) penalty -= 10;  // 10 tweets per follower = low quality
    }

    // All caps (spam signal)
    const capsRatio = (candidate.text.match(/[A-Z]/g) || []).length / candidate.text.length;
    if (capsRatio > 0.7) penalty -= 5;

    // Excessive hashtags
    const hashtagCount = (candidate.text.match(/#\w+/g) || []).length;
    if (hashtagCount > 5) penalty -= 10;
    else if (hashtagCount > 3) penalty -= 5;

    // Excessive mentions (likely spam)
    const mentionCount = (candidate.text.match(/@\w+/g) || []).length;
    if (mentionCount > 5) penalty -= 10;

    return penalty;
  }

  // ==========================================================================
  // Step 4: Select - Apply diversity and limits
  // ==========================================================================

  private selectTopCandidates(scored: ScoredCandidate[]): ScoredCandidate[] {
    const selected: ScoredCandidate[] = [];
    const seenAuthors = new Set<string>();

    for (const candidate of scored) {
      // Skip if below minimum score
      if (candidate.score < this.config.minScoreToEngage) {
        continue;
      }

      // Diversity: Only one engagement per author per cycle
      const authorLower = candidate.authorUsername.toLowerCase();
      if (seenAuthors.has(authorLower)) {
        continue;
      }

      selected.push(candidate);
      seenAuthors.add(authorLower);

      // Limit total selections
      if (selected.length >= this.config.maxCandidatesPerCycle) {
        break;
      }
    }

    return selected;
  }

  // ==========================================================================
  // Utility: Score a single candidate (for debugging/testing)
  // ==========================================================================

  scoreOne(candidate: TwitterCandidate): ScoredCandidate {
    return this.scoreCandidate(candidate);
  }

  // ==========================================================================
  // Tweet Content Optimization (for outbound tweets)
  // ==========================================================================

  /**
   * Score a tweet's virality potential before posting
   * Returns 0-100 score based on engagement-driving factors
   */
  scoreTweetContent(text: string): TweetContentScore {
    let score = 0;
    const factors: string[] = [];

    // Length optimization (120-200 chars is optimal for engagement)
    const len = text.length;
    if (len >= 120 && len <= 200) {
      score += 15;
      factors.push("optimal_length");
    } else if (len >= 80 && len <= 250) {
      score += 10;
    } else if (len < 50) {
      score += 5; // Very short can work for punchy content
    }

    // Question mark = reply bait (huge for engagement)
    if (text.includes("?")) {
      score += 20;
      factors.push("question_hook");
    }

    // Call to action patterns
    const ctaPatterns = [
      /\b(reply|comment|tell me|let me know|thoughts\??|agree\??)\b/i,
      /\b(tag|mention|share)\b/i,
      /\bwho else\b/i,
      /\bwhat do you\b/i,
    ];
    for (const pattern of ctaPatterns) {
      if (pattern.test(text)) {
        score += 10;
        factors.push("call_to_action");
        break;
      }
    }

    // Emotional triggers (positive)
    const emotionalPatterns = [
      /\b(love|amazing|incredible|excited|happy|proud)\b/i,
      /\b(lets go|lfg|wagmi)\b/i,
      /!{2,}/,  // Multiple exclamation marks
    ];
    for (const pattern of emotionalPatterns) {
      if (pattern.test(text)) {
        score += 8;
        factors.push("emotional_trigger");
        break;
      }
    }

    // Personalization (feels like direct conversation)
    if (/\b(you|your|u|ur)\b/i.test(text)) {
      score += 8;
      factors.push("personalization");
    }

    // Lists/numbers (structured content performs well)
    if (/\d+/.test(text) || /\b(first|second|third|top \d)\b/i.test(text)) {
      score += 5;
      factors.push("structured_content");
    }

    // Emoji usage (1-3 is optimal)
    const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu) || []).length;
    if (emojiCount >= 1 && emojiCount <= 3) {
      score += 5;
      factors.push("optimal_emoji");
    } else if (emojiCount > 5) {
      score -= 5; // Too many emojis = spam signal
    }

    // Hashtag count (0-2 is best, more looks spammy)
    const hashtagCount = (text.match(/#\w+/g) || []).length;
    if (hashtagCount === 0) {
      score += 5;
      factors.push("no_hashtags"); // Clean look
    } else if (hashtagCount <= 2) {
      score += 3;
    } else {
      score -= 5 * (hashtagCount - 2); // Penalty for excess hashtags
    }

    // Mention count (1-2 strategic mentions is good)
    const mentionCount = (text.match(/@\w+/g) || []).length;
    if (mentionCount === 1 || mentionCount === 2) {
      score += 5;
      factors.push("strategic_mentions");
    } else if (mentionCount > 4) {
      score -= 10; // Looks like spam
    }

    // Bags.fm specific keywords (relevant to audience)
    const bagsKeywords = ["bags.fm", "fees", "claim", "creators", "royalties", "earnings"];
    let bagsMatches = 0;
    for (const kw of bagsKeywords) {
      if (text.toLowerCase().includes(kw)) bagsMatches++;
    }
    if (bagsMatches >= 1) {
      score += 5;
      factors.push("on_topic");
    }

    // Lowercase casual style (performs well on CT)
    const lowercaseRatio = (text.match(/[a-z]/g) || []).length / Math.max((text.match(/[a-zA-Z]/g) || []).length, 1);
    if (lowercaseRatio > 0.8) {
      score += 5;
      factors.push("casual_style");
    }

    // Newlines for readability (breaks perform well)
    const newlineCount = (text.match(/\n/g) || []).length;
    if (newlineCount >= 1 && newlineCount <= 4) {
      score += 5;
      factors.push("good_formatting");
    }

    // Cap at 100
    score = Math.min(100, Math.max(0, score));

    return {
      score,
      factors,
      suggestions: this.generateTweetSuggestions(text, factors, score),
    };
  }

  /**
   * Generate suggestions to improve tweet virality
   */
  private generateTweetSuggestions(text: string, factors: string[], score: number): string[] {
    const suggestions: string[] = [];

    if (!factors.includes("question_hook")) {
      suggestions.push("Add a question to encourage replies (e.g., 'have u claimed ur fees today?')");
    }

    if (!factors.includes("call_to_action")) {
      suggestions.push("Add a soft CTA (e.g., 'thoughts?', 'who else?', 'tag a fren')");
    }

    if (!factors.includes("personalization")) {
      suggestions.push("Use 'you/your' to make it feel personal");
    }

    if (text.length > 250) {
      suggestions.push("Consider shortening - 120-200 chars gets more engagement");
    }

    const hashtagCount = (text.match(/#\w+/g) || []).length;
    if (hashtagCount > 2) {
      suggestions.push("Remove some hashtags - 0-2 performs better");
    }

    return suggestions;
  }

  /**
   * Add engagement hooks to a tweet
   * Returns enhanced version with higher virality potential
   */
  enhanceTweetForVirality(text: string): string {
    let enhanced = text;

    // Don't enhance if already has good engagement hooks
    const currentScore = this.scoreTweetContent(text);
    if (currentScore.score >= 70) {
      return text; // Already optimized
    }

    // Add question hook if missing (highest impact)
    if (!text.includes("?") && text.length < 250) {
      const questionHooks = [
        "\n\nhave u claimed ur fees today?",
        "\n\nthoughts?",
        "\n\nwho else is bullish?",
        "\n\nfren have u checked bags.fm lately?",
      ];
      const hook = questionHooks[Math.floor(Math.random() * questionHooks.length)];
      if ((enhanced + hook).length <= 280) {
        enhanced += hook;
      }
    }

    return enhanced;
  }
}

// ============================================================================
// Tweet Content Score Type
// ============================================================================

export interface TweetContentScore {
  score: number;           // 0-100
  factors: string[];       // What contributed to the score
  suggestions: string[];   // How to improve
}

// ============================================================================
// Singleton Export
// ============================================================================

let scorerInstance: EngagementScorer | null = null;

export function getEngagementScorer(config?: Partial<EngagementScorerConfig>): EngagementScorer {
  if (!scorerInstance) {
    scorerInstance = new EngagementScorer(config);
  }
  return scorerInstance;
}

export default EngagementScorer;
