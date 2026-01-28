// TwitterService - Twitter/X posting and engagement for Finn
// Handles authentication, posting, rate limiting, and content moderation

import { Service, type IAgentRuntime } from "../types/elizaos.js";

// ============================================================================
// Types
// ============================================================================

export interface Tweet {
  id: string;
  text: string;
  createdAt: Date;
  url: string;
  author?: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface PostResult {
  success: boolean;
  tweet?: Tweet;
  error?: string;
}

export interface TwitterConfig {
  username?: string;
  dryRun?: boolean;
  postCooldownMs?: number;
  replyCooldownMs?: number;
}

// ============================================================================
// Content Moderation
// ============================================================================

const BANNED_WORDS = ["guaranteed", "100x", "moonshot", "rugproof", "safu"];
const RISKY_PATTERNS = [
  /guaranteed\s+\d+x/i,
  /\d+x\s+guaranteed/i,
  /can't lose/i,
  /free money/i,
  /send.*sol.*get/i,
];

interface ContentValidation {
  valid: boolean;
  issues: string[];
}

function validateContent(content: string): ContentValidation {
  const issues: string[] = [];

  // Length check
  if (content.length > 280) {
    issues.push(`Too long (${content.length}/280 chars)`);
  }

  // Hashtag count
  const hashtags = content.match(/#\w+/g) || [];
  if (hashtags.length > 5) {
    issues.push(`Too many hashtags (${hashtags.length}/5)`);
  }

  // Mention spam check
  const mentions = content.match(/@\w+/g) || [];
  if (mentions.length > 5) {
    issues.push("Too many mentions");
  }

  // Banned words check
  for (const word of BANNED_WORDS) {
    if (content.toLowerCase().includes(word.toLowerCase())) {
      issues.push(`Contains flagged word: ${word}`);
    }
  }

  // Risky patterns check
  for (const pattern of RISKY_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(`Contains risky pattern`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

const COOLDOWNS = {
  post: 15 * 60 * 1000, // 15 min between posts
  reply: 2 * 60 * 1000, // 2 min between replies
  like: 30 * 1000, // 30s between likes
  retweet: 5 * 60 * 1000, // 5 min between retweets
};

class TwitterCooldown {
  private lastAction: Map<string, number> = new Map();

  canAct(action: string): boolean {
    const last = this.lastAction.get(action) || 0;
    const cooldown = COOLDOWNS[action as keyof typeof COOLDOWNS] || 0;
    return Date.now() - last >= cooldown;
  }

  recordAction(action: string): void {
    this.lastAction.set(action, Date.now());
  }

  timeUntilReady(action: string): number {
    const last = this.lastAction.get(action) || 0;
    const cooldown = COOLDOWNS[action as keyof typeof COOLDOWNS] || 0;
    return Math.max(0, cooldown - (Date.now() - last));
  }
}

// ============================================================================
// Thread Splitting
// ============================================================================

function splitIntoThread(content: string, maxLength = 270): string[] {
  const paragraphs = content.split("\n\n");
  const tweets: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length <= maxLength) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) tweets.push(current);
      current = para;
    }
  }

  if (current) tweets.push(current);

  // Add thread markers if multiple tweets
  if (tweets.length > 1) {
    return tweets.map((tweet, i) => `${i + 1}/${tweets.length} ${tweet}`);
  }

  return tweets;
}

// ============================================================================
// TwitterService
// ============================================================================

let twitterServiceInstance: TwitterService | null = null;

export class TwitterService extends Service {
  static readonly serviceType = "twitter";
  readonly capabilityDescription = "Twitter/X posting and engagement";

  private config: TwitterConfig;
  private cooldown: TwitterCooldown;
  private postHistory: Tweet[] = [];
  private isAuthenticated: boolean = false;

  // Twitter API credentials (from environment)
  private bearerToken: string | null = null;
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private accessToken: string | null = null;
  private accessTokenSecret: string | null = null;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);

    this.config = {
      username: process.env.TWITTER_USERNAME,
      dryRun: process.env.TWITTER_DRY_RUN === "true",
      postCooldownMs: parseInt(process.env.TWITTER_POST_COOLDOWN || "900000"), // 15 min
      replyCooldownMs: parseInt(process.env.TWITTER_REPLY_COOLDOWN || "120000"), // 2 min
    };

    this.cooldown = new TwitterCooldown();

    // Load API credentials
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN || null;
    this.apiKey = process.env.TWITTER_API_KEY || null;
    this.apiSecret = process.env.TWITTER_API_SECRET || null;
    this.accessToken = process.env.TWITTER_ACCESS_TOKEN || null;
    this.accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || null;
  }

  static async start(runtime: IAgentRuntime): Promise<TwitterService> {
    console.log("[TwitterService] Starting service...");
    const service = new TwitterService(runtime);
    await service.initialize();
    twitterServiceInstance = service;
    return service;
  }

  async stop(): Promise<void> {
    twitterServiceInstance = null;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    const hasCredentials =
      (this.bearerToken || (this.apiKey && this.apiSecret && this.accessToken && this.accessTokenSecret));

    if (!hasCredentials) {
      console.warn("[TwitterService] No Twitter API credentials configured");
      console.warn("[TwitterService] Set TWITTER_BEARER_TOKEN or full OAuth credentials");
      return;
    }

    // Verify credentials
    try {
      await this.verifyCredentials();
      this.isAuthenticated = true;
      console.log(`[TwitterService] Authenticated as @${this.config.username || "unknown"}`);
      console.log(`[TwitterService] Dry run mode: ${this.config.dryRun ? "ENABLED" : "DISABLED"}`);
    } catch (error) {
      console.error("[TwitterService] Authentication failed:", error);
      this.isAuthenticated = false;
    }
  }

  private async verifyCredentials(): Promise<void> {
    if (!this.bearerToken) {
      throw new Error("Bearer token required for API access");
    }

    const response = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    this.config.username = data.data?.username;
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  isConfigured(): boolean {
    return this.isAuthenticated;
  }

  isDryRun(): boolean {
    return this.config.dryRun || false;
  }

  /**
   * Post a tweet
   */
  async post(content: string): Promise<PostResult> {
    // Validate content
    const validation = validateContent(content);
    if (!validation.valid) {
      return {
        success: false,
        error: `Content validation failed: ${validation.issues.join(", ")}`,
      };
    }

    // Check cooldown
    if (!this.cooldown.canAct("post")) {
      const waitTime = this.cooldown.timeUntilReady("post");
      return {
        success: false,
        error: `Rate limited. Wait ${Math.ceil(waitTime / 1000)}s before posting again.`,
      };
    }

    // Dry run mode
    if (this.config.dryRun) {
      const fakeTweet: Tweet = {
        id: `dry_${Date.now()}`,
        text: content,
        createdAt: new Date(),
        url: `https://twitter.com/${this.config.username}/status/dry_${Date.now()}`,
      };
      console.log(`[TwitterService] DRY RUN - Would post: ${content}`);
      this.cooldown.recordAction("post");
      this.postHistory.push(fakeTweet);
      return { success: true, tweet: fakeTweet };
    }

    // Check authentication
    if (!this.isAuthenticated) {
      return {
        success: false,
        error: "Twitter not authenticated",
      };
    }

    // Post tweet
    try {
      const tweet = await this.postTweet(content);
      this.cooldown.recordAction("post");
      this.postHistory.push(tweet);
      console.log(`[TwitterService] Posted tweet: ${tweet.url}`);
      return { success: true, tweet };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TwitterService] Failed to post: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Post a thread
   */
  async postThread(content: string): Promise<PostResult> {
    const tweets = splitIntoThread(content);

    if (tweets.length === 1) {
      return this.post(tweets[0]);
    }

    // Validate all tweets
    for (const tweet of tweets) {
      const validation = validateContent(tweet);
      if (!validation.valid) {
        return {
          success: false,
          error: `Thread tweet validation failed: ${validation.issues.join(", ")}`,
        };
      }
    }

    // Dry run mode
    if (this.config.dryRun) {
      console.log(`[TwitterService] DRY RUN - Would post thread (${tweets.length} tweets):`);
      tweets.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

      const fakeTweet: Tweet = {
        id: `dry_thread_${Date.now()}`,
        text: tweets[0],
        createdAt: new Date(),
        url: `https://twitter.com/${this.config.username}/status/dry_thread_${Date.now()}`,
      };
      return { success: true, tweet: fakeTweet };
    }

    // Post thread
    try {
      let replyToId: string | null = null;
      let firstTweet: Tweet | null = null;

      for (const tweetContent of tweets) {
        const tweet = await this.postTweet(tweetContent, replyToId || undefined);
        if (!firstTweet) firstTweet = tweet;
        replyToId = tweet.id;

        // Small delay between tweets
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.cooldown.recordAction("post");
      console.log(`[TwitterService] Posted thread (${tweets.length} tweets): ${firstTweet?.url}`);
      return { success: true, tweet: firstTweet! };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TwitterService] Failed to post thread: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Reply to a tweet
   */
  async reply(tweetId: string, content: string): Promise<PostResult> {
    const validation = validateContent(content);
    if (!validation.valid) {
      return {
        success: false,
        error: `Content validation failed: ${validation.issues.join(", ")}`,
      };
    }

    if (!this.cooldown.canAct("reply")) {
      const waitTime = this.cooldown.timeUntilReady("reply");
      return {
        success: false,
        error: `Rate limited. Wait ${Math.ceil(waitTime / 1000)}s before replying.`,
      };
    }

    if (this.config.dryRun) {
      console.log(`[TwitterService] DRY RUN - Would reply to ${tweetId}: ${content}`);
      this.cooldown.recordAction("reply");
      return {
        success: true,
        tweet: {
          id: `dry_reply_${Date.now()}`,
          text: content,
          createdAt: new Date(),
          url: `https://twitter.com/${this.config.username}/status/dry_reply_${Date.now()}`,
        },
      };
    }

    if (!this.isAuthenticated) {
      return { success: false, error: "Twitter not authenticated" };
    }

    try {
      const tweet = await this.postTweet(content, tweetId);
      this.cooldown.recordAction("reply");
      console.log(`[TwitterService] Replied to ${tweetId}: ${tweet.url}`);
      return { success: true, tweet };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get recent post history
   */
  getPostHistory(limit: number = 10): Tweet[] {
    return this.postHistory.slice(-limit);
  }

  /**
   * Get service stats
   */
  getStats(): {
    authenticated: boolean;
    dryRun: boolean;
    username: string | undefined;
    totalPosts: number;
    canPost: boolean;
    nextPostIn: number;
  } {
    return {
      authenticated: this.isAuthenticated,
      dryRun: this.config.dryRun || false,
      username: this.config.username,
      totalPosts: this.postHistory.length,
      canPost: this.cooldown.canAct("post"),
      nextPostIn: this.cooldown.timeUntilReady("post"),
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async postTweet(content: string, replyToId?: string): Promise<Tweet> {
    if (!this.bearerToken) {
      throw new Error("Bearer token not configured");
    }

    const body: Record<string, unknown> = { text: content };

    if (replyToId) {
      body.reply = { in_reply_to_tweet_id: replyToId };
    }

    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const tweetId = data.data?.id;

    return {
      id: tweetId,
      text: content,
      createdAt: new Date(),
      url: `https://twitter.com/${this.config.username}/status/${tweetId}`,
    };
  }
}

// ============================================================================
// Singleton Access
// ============================================================================

export function getTwitterService(): TwitterService {
  if (!twitterServiceInstance) {
    twitterServiceInstance = new TwitterService();
  }
  return twitterServiceInstance;
}

export default TwitterService;
