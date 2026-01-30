// EngagementScorer.ts - X Algorithm-inspired engagement scoring for Bagsy
// Pipeline: Source → Hydrate → Filter → Score → Select → Act

export interface TwitterCandidate {
  tweetId: string;
  authorId: string;
  authorUsername: string;
  text: string;
  createdAt: Date;
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
  authorInfluence: number;
  contentRelevance: number;
  viralityPotential: number;
  penalties: number;
  total: number;
}

export interface TweetContentScore {
  score: number;
  factors: string[];
  suggestions: string[];
}

interface ScorerConfig {
  authorInfluenceWeight: number;
  contentRelevanceWeight: number;
  viralityPotentialWeight: number;
  minScoreToEngage: number;
  maxCandidatesPerCycle: number;
  minFollowers: number;
  maxFollowerRatio: number;
}

const DEFAULT_CONFIG: ScorerConfig = {
  authorInfluenceWeight: 40,
  contentRelevanceWeight: 35,
  viralityPotentialWeight: 25,
  minScoreToEngage: 30,
  maxCandidatesPerCycle: 3,
  minFollowers: 50,
  maxFollowerRatio: 10,
};

// Keyword banks
const HIGH_VALUE_KEYWORDS = [
  "bags.fm", "bagsfm", "@bagsfm", "@bagsapp", "bags app",
  "claim", "fees", "unclaimed", "royalties", "earnings",
  "creator", "launch", "token", "launched", "memecoin",
  "solana", "sol", "$sol",
  "help", "how do i", "how to", "anyone know", "question",
];

const MEDIUM_VALUE_KEYWORDS = [
  "crypto", "web3", "defi", "degen", "community", "gm", "wagmi", "lfg",
  "trading", "trade", "buy", "sell",
];

const NEGATIVE_KEYWORDS = [
  "airdrop", "giveaway", "free mint", "whitelist", "wl spot",
  "dm me", "send sol", "guaranteed", "100x",
  "follow back", "f4f", "follow for follow",
];

const BOT_PATTERNS = [/bot$/i, /^bot_/i, /_bot_/i, /\d{5,}$/, /^[a-z]{2,4}\d{6,}$/i];

const CTA_PATTERNS = [
  /\b(reply|comment|tell me|let me know|thoughts\??|agree\??)\b/i,
  /\b(tag|mention|share|drop)\b/i,
  /\bwho else\b/i,
  /\bwhat do (you|u)\b/i,
  /\b(tag a fren|tag someone|tag ur)\b/i,
  /\b(drop a|leave a|send a)\b/i,
  /\bif (this is|u are|ur)\b/i,
  /\breply (with|if)\b/i,
  /\bcomment (if|below|ur)\b/i,
];

const EMOTION_PATTERNS = [
  /\b(love|amazing|incredible|excited|happy|proud)\b/i,
  /\b(lets go|lfg|wagmi)\b/i,
  /!{2,}/,
];

const BAGS_KEYWORDS = ["bags.fm", "fees", "claim", "creators", "royalties", "earnings"];

// Utility functions
const countMatches = (text: string, pattern: RegExp): number =>
  (text.match(pattern) || []).length;

const hasAnyKeyword = (text: string, keywords: string[]): boolean =>
  keywords.some(kw => text.includes(kw));

const countKeywordMatches = (text: string, keywords: string[]): number =>
  keywords.filter(kw => text.includes(kw)).length;

const matchesAnyPattern = (text: string, patterns: RegExp[]): boolean =>
  patterns.some(p => p.test(text));

export class EngagementScorer {
  private config: ScorerConfig;
  private engagedAuthors = new Set<string>();
  private bearerToken: string | null;

  constructor(config?: Partial<ScorerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN || null;
  }

  async processCandidates(candidates: TwitterCandidate[]): Promise<ScoredCandidate[]> {
    if (candidates.length === 0) return [];

    console.log(`[EngagementScorer] Processing ${candidates.length} candidates`);

    const hydrated = await this.hydrateCandidates(candidates);
    const filtered = this.filterCandidates(hydrated);
    const scored = filtered.map(c => this.scoreCandidate(c)).sort((a, b) => b.score - a.score);
    const selected = this.selectTopCandidates(scored);

    console.log(`[EngagementScorer] Selected ${selected.length}/${candidates.length} candidates`);
    selected.forEach(c =>
      console.log(`[EngagementScorer] @${c.authorUsername} (${c.authorFollowers ?? "?"}) - Score: ${c.score.toFixed(1)}`)
    );

    return selected;
  }

  resetCycle(): void {
    this.engagedAuthors.clear();
  }

  markEngaged(authorUsername: string): void {
    this.engagedAuthors.add(authorUsername.toLowerCase());
  }

  scoreOne(candidate: TwitterCandidate): ScoredCandidate {
    return this.scoreCandidate(candidate);
  }

  scoreTweetContent(text: string): TweetContentScore {
    const factors: string[] = [];
    let score = 0;
    const textLower = text.toLowerCase();
    const len = text.length;

    // Length scoring - X algorithm favors 120-200 chars
    if (len >= 120 && len <= 200) { score += 20; factors.push("optimal_length"); }
    else if (len >= 80 && len <= 250) score += 10;
    else if (len < 50) score += 5;

    // Question hook (HIGHEST IMPACT - drives replies which X algorithm values most)
    if (text.includes("?")) { score += 30; factors.push("question_hook"); }

    // CTA patterns (HIGH IMPACT - drives direct engagement)
    if (matchesAnyPattern(text, CTA_PATTERNS)) { score += 20; factors.push("call_to_action"); }

    // Emotional triggers
    if (matchesAnyPattern(text, EMOTION_PATTERNS)) { score += 10; factors.push("emotional_trigger"); }

    // Personalization (you/your drives connection)
    if (/\b(you|your|u|ur)\b/i.test(text)) { score += 10; factors.push("personalization"); }

    // Structured content (numbers/lists)
    if (/\d+/.test(text) || /\b(first|second|third|top \d)\b/i.test(text)) {
      score += 5; factors.push("structured_content");
    }

    // Count-based scoring
    const emojiCount = countMatches(text, /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu);
    const hashtagCount = countMatches(text, /#\w+/g);
    const mentionCount = countMatches(text, /@\w+/g);
    const newlineCount = countMatches(text, /\n/g);

    if (emojiCount >= 1 && emojiCount <= 3) { score += 5; factors.push("optimal_emoji"); }
    else if (emojiCount > 5) score -= 5;

    if (hashtagCount === 0) { score += 5; factors.push("no_hashtags"); }
    else if (hashtagCount <= 2) score += 3;
    else score -= 5 * (hashtagCount - 2);

    if (mentionCount === 1 || mentionCount === 2) { score += 5; factors.push("strategic_mentions"); }
    else if (mentionCount > 4) score -= 10;

    if (newlineCount >= 1 && newlineCount <= 4) { score += 5; factors.push("good_formatting"); }

    // Bags.fm relevance
    if (countKeywordMatches(textLower, BAGS_KEYWORDS) >= 1) { score += 5; factors.push("on_topic"); }

    // Casual lowercase style
    const letters = text.match(/[a-zA-Z]/g) || [];
    const lowercase = text.match(/[a-z]/g) || [];
    if (letters.length > 0 && lowercase.length / letters.length > 0.8) {
      score += 5; factors.push("casual_style");
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      factors,
      suggestions: this.generateSuggestions(text, factors, hashtagCount),
    };
  }

  enhanceTweetForVirality(text: string): string {
    const currentScore = this.scoreTweetContent(text);
    if (currentScore.score >= 70 || text.length >= 240) return text;

    // X Algorithm optimized hooks - prioritized by engagement type
    const questionHooks = [
      "\n\nthoughts?",
      "\n\nagree?",
      "\n\nwho else?",
      "\n\nhave u claimed today?",
      "\n\nwhat do u think?",
    ];

    const ctaHooks = [
      "\n\ntag a fren who needs this",
      "\n\ndrop a 💚 if u agree",
      "\n\nreply if this is u",
    ];

    const softHooks = [
      "\n\nbags.fm",
      "\n\njust saying :)",
      "\n\niykyk",
    ];

    // If no question, prefer question hooks (highest engagement)
    if (!text.includes("?") && !currentScore.factors.includes("question_hook")) {
      const hook = questionHooks[Math.floor(Math.random() * questionHooks.length)];
      if ((text + hook).length <= 280) return text + hook;
    }

    // If no CTA, try CTA hooks
    if (!currentScore.factors.includes("call_to_action")) {
      const hook = ctaHooks[Math.floor(Math.random() * ctaHooks.length)];
      if ((text + hook).length <= 280) return text + hook;
    }

    // Fallback to soft hooks
    const hook = softHooks[Math.floor(Math.random() * softHooks.length)];
    return (text + hook).length <= 280 ? text + hook : text;
  }

  // Private methods

  private async hydrateCandidates(candidates: TwitterCandidate[]): Promise<TwitterCandidate[]> {
    if (!this.bearerToken) return candidates;

    const authorIds = [...new Set(candidates.map(c => c.authorId))];
    if (authorIds.length === 0) return candidates;

    const userMap = new Map<string, { followers: number; following: number; verified: boolean; tweetCount: number }>();

    try {
      const url = `https://api.twitter.com/2/users?ids=${authorIds.join(",")}&user.fields=public_metrics,verified`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${this.bearerToken}` } });

      if (response.ok) {
        const data = await response.json();
        for (const user of data.data || []) {
          userMap.set(user.id, {
            followers: user.public_metrics?.followers_count || 0,
            following: user.public_metrics?.following_count || 0,
            verified: user.verified || false,
            tweetCount: user.public_metrics?.tweet_count || 0,
          });
        }
      }
    } catch (error) {
      console.error("[EngagementScorer] Hydration error:", error);
    }

    return candidates.map(c => {
      const u = userMap.get(c.authorId);
      return u ? { ...c, authorFollowers: u.followers, authorFollowing: u.following, authorVerified: u.verified, authorTweetCount: u.tweetCount } : c;
    });
  }

  private filterCandidates(candidates: TwitterCandidate[]): TwitterCandidate[] {
    return candidates.filter(c => {
      const textLower = c.text.toLowerCase();
      const followerRatio = c.authorFollowers && c.authorFollowing
        ? c.authorFollowing / Math.max(c.authorFollowers, 1)
        : 0;

      return !(
        this.engagedAuthors.has(c.authorUsername.toLowerCase()) ||
        (c.authorFollowers !== undefined && c.authorFollowers < this.config.minFollowers) ||
        followerRatio > this.config.maxFollowerRatio ||
        BOT_PATTERNS.some(p => p.test(c.authorUsername)) ||
        hasAnyKeyword(textLower, NEGATIVE_KEYWORDS)
      );
    });
  }

  private scoreCandidate(c: TwitterCandidate): ScoredCandidate {
    const authorInfluence = this.scoreAuthor(c);
    const contentRelevance = this.scoreContent(c);
    const viralityPotential = this.scoreVirality(c);
    const penalties = this.calculatePenalties(c);
    const total = Math.max(0, authorInfluence + contentRelevance + viralityPotential + penalties);

    return { ...c, score: total, scoreBreakdown: { authorInfluence, contentRelevance, viralityPotential, penalties, total } };
  }

  private scoreAuthor(c: TwitterCandidate): number {
    let score = 0;
    const f = c.authorFollowers || 0;

    if (f >= 500000) score = 40;
    else if (f >= 100000) score = 35;
    else if (f >= 10000) score = 25;
    else if (f >= 1000) score = 15;
    else if (f >= 100) score = 5;

    if (c.authorVerified) score += 5;

    return Math.min(score, this.config.authorInfluenceWeight);
  }

  private scoreContent(c: TwitterCandidate): number {
    const textLower = c.text.toLowerCase();
    let score = 0;

    score += Math.min(countKeywordMatches(textLower, HIGH_VALUE_KEYWORDS) * 5, 20);
    score += Math.min(countKeywordMatches(textLower, MEDIUM_VALUE_KEYWORDS) * 2, 10);

    if (textLower.includes("?") || textLower.includes("how") || textLower.includes("help")) {
      score += 5;
    }

    return Math.min(score, this.config.contentRelevanceWeight);
  }

  private scoreVirality(c: TwitterCandidate): number {
    let score = 0;
    const ageMinutes = (Date.now() - c.createdAt.getTime()) / 60000;

    if (ageMinutes < 15) score += 15;
    else if (ageMinutes < 60) score += 10;
    else if (ageMinutes < 180) score += 5;

    if (c.tweetLikes !== undefined) {
      score += c.tweetLikes >= 100 ? 5 : c.tweetLikes >= 10 ? 3 : 0;
    }

    if (c.authorTweetCount !== undefined) {
      score += c.authorTweetCount >= 1000 ? 5 : c.authorTweetCount >= 100 ? 2 : 0;
    }

    return Math.min(score, this.config.viralityPotentialWeight);
  }

  private calculatePenalties(c: TwitterCandidate): number {
    let penalty = 0;

    if (c.authorFollowers && c.authorFollowing) {
      const ratio = c.authorFollowing / Math.max(c.authorFollowers, 1);
      if (ratio > 5) penalty -= 10;
      else if (ratio > 3) penalty -= 5;
    }

    if (c.authorTweetCount && c.authorFollowers && c.authorFollowers / c.authorTweetCount < 0.1) {
      penalty -= 10;
    }

    const text = c.text;
    const letters = text.match(/[a-zA-Z]/g) || [];
    const caps = text.match(/[A-Z]/g) || [];
    if (letters.length > 0 && caps.length / letters.length > 0.7) penalty -= 5;

    const hashtagCount = countMatches(text, /#\w+/g);
    if (hashtagCount > 5) penalty -= 10;
    else if (hashtagCount > 3) penalty -= 5;

    if (countMatches(text, /@\w+/g) > 5) penalty -= 10;

    return penalty;
  }

  private selectTopCandidates(scored: ScoredCandidate[]): ScoredCandidate[] {
    const selected: ScoredCandidate[] = [];
    const seenAuthors = new Set<string>();

    for (const c of scored) {
      if (c.score < this.config.minScoreToEngage) continue;

      const author = c.authorUsername.toLowerCase();
      if (seenAuthors.has(author)) continue;

      selected.push(c);
      seenAuthors.add(author);

      if (selected.length >= this.config.maxCandidatesPerCycle) break;
    }

    return selected;
  }

  private generateSuggestions(text: string, factors: string[], hashtagCount: number): string[] {
    const suggestions: string[] = [];

    if (!factors.includes("question_hook")) {
      suggestions.push("Add a question to encourage replies");
    }
    if (!factors.includes("call_to_action")) {
      suggestions.push("Add a soft CTA (e.g., 'thoughts?')");
    }
    if (!factors.includes("personalization")) {
      suggestions.push("Use 'you/your' for personal feel");
    }
    if (text.length > 250) {
      suggestions.push("Shorten to 120-200 chars");
    }
    if (hashtagCount > 2) {
      suggestions.push("Use 0-2 hashtags");
    }

    return suggestions;
  }
}

// Singleton
let instance: EngagementScorer | null = null;

export function getEngagementScorer(config?: Partial<ScorerConfig>): EngagementScorer {
  if (!instance) instance = new EngagementScorer(config);
  return instance;
}

export default EngagementScorer;
