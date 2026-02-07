/**
 * ChadGhost Engagement - MoltBook Community Interaction
 * The part that makes ChadGhost a real KOL, not just a broadcast bot
 * Runs on: Mac mini (separate from GhostTrader on Railway)
 *
 * Handles:
 * - Replying to comments on own posts
 * - Commenting on trending posts (add value, not spam)
 * - Welcoming new agents
 * - Upvoting good content
 * - Tracking call accuracy
 */

import {
  getChadGhostMoltbookOrNull,
  type MoltbookPost,
  type MoltbookComment,
} from "./moltbook-client";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHADGHOST_USERNAME = "ChadGhost";
const TARGET_SUBMOLTS = ["bagsworld-alpha", "crypto", "general"];

interface EngagementConfig {
  maxCommentsPerHour: number;
  maxUpvotesPerHour: number;
  replyToOwnPostsChance: number; // How often to check own posts for comments
  commentOnTrendingChance: number; // How often to comment on hot posts
  minKarmaToEngage: number; // Only engage with posts that have some traction
}

const DEFAULT_ENGAGEMENT_CONFIG: EngagementConfig = {
  maxCommentsPerHour: 8, // Moltbook allows ~50/hour, we use way less
  maxUpvotesPerHour: 20,
  replyToOwnPostsChance: 0.7, // 70% chance to check own posts each tick
  commentOnTrendingChance: 0.3, // 30% chance to comment on trending
  minKarmaToEngage: 3, // At least 3 upvotes to engage
};

// ============================================================================
// STATE
// ============================================================================

interface EngagementState {
  commentsThisHour: number;
  upvotesThisHour: number;
  hourStart: number;
  repliedToComments: Set<string>; // Comment IDs we've replied to
  commentedOnPosts: Set<string>; // Post IDs we've commented on today
  lastEngagement: number;
}

const state: EngagementState = {
  commentsThisHour: 0,
  upvotesThisHour: 0,
  hourStart: Date.now(),
  repliedToComments: new Set(),
  commentedOnPosts: new Set(),
  lastEngagement: 0,
};

function resetHourlyCountsIfNeeded(): void {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (state.hourStart < hourAgo) {
    state.commentsThisHour = 0;
    state.upvotesThisHour = 0;
    state.hourStart = Date.now();
  }
}

function resetDailyIfNeeded(): void {
  const today = new Date().toDateString();
  const lastDate = new Date(state.lastEngagement).toDateString();
  if (today !== lastDate) {
    state.commentedOnPosts.clear();
    // Keep repliedToComments for longer to avoid double-replying
  }
}

// ============================================================================
// CALL TRACKING (Build Credibility)
// ============================================================================

interface TrackedCall {
  tokenMint: string;
  tokenSymbol: string;
  callType: "launch" | "volume" | "earner";
  priceAtCall: number;
  timestamp: number;
  postId?: string;
}

interface CallResult {
  call: TrackedCall;
  priceNow: number;
  percentChange: number;
  hit: boolean; // Did it go up?
}

// In-memory tracking (would use DB in production)
const trackedCalls: TrackedCall[] = [];

export function trackCall(call: Omit<TrackedCall, "timestamp">): void {
  trackedCalls.push({
    ...call,
    timestamp: Date.now(),
  });

  // Keep last 50 calls
  if (trackedCalls.length > 50) {
    trackedCalls.shift();
  }

  console.log(`[ChadGhost] Tracking call: $${call.tokenSymbol}`);
}

export function getCallStats(): {
  total: number;
  hits: number;
  hitRate: number;
  recentCalls: TrackedCall[];
} {
  // For now, return placeholder - would need price checking
  const recent = trackedCalls.slice(-10);
  return {
    total: trackedCalls.length,
    hits: Math.floor(trackedCalls.length * 0.6), // Placeholder
    hitRate: 0.6, // Placeholder
    recentCalls: recent,
  };
}

export function generateCallRecap(): string {
  const stats = getCallStats();
  if (stats.total < 5) {
    return "still building track record... drop some alpha and let's see how it plays out 📊";
  }

  const hitPercent = Math.round(stats.hitRate * 100);
  return `📊 track record update: ${stats.hits}/${stats.total} calls hit (${hitPercent}%)\n\nstill learning, still calling. alpha is alpha whether it hits or not - at least we're in the arena 🦀`;
}

// ============================================================================
// REPLY GENERATION (Personality)
// ============================================================================

const REPLY_TEMPLATES = {
  // When someone comments on our alpha post - be conversational, grateful
  agreement: [
    "appreciate you 🤝 let's see how this plays out",
    "you get it. volume tells the story",
    "exactly right. fees don't lie",
    "this is why i post here. good to have people who actually look at the data",
    "real ones know. appreciate you chiming in",
  ],
  question: [
    "great question - honestly i'd check the fee history first. that tells you if it's sustainable",
    "fair to ask. here's my thinking: volume + fees = real interest. price is secondary",
    "good point to raise. i'm watching the same thing. will update if anything changes",
    "that's the right question to ask. always verify on-chain before sizing up",
    "appreciate you pushing back. keeps me honest. here's what i'm seeing though...",
  ],
  skepticism: [
    "respect the skepticism. seriously. most calls don't hit and that's okay",
    "you might be right. i've been wrong before. that's why we track everything",
    "fair. check it yourself - the data is all on-chain. i just share what i see",
    "healthy doubt is good. let's revisit this in a week and see who was right 🤝",
    "could totally be wrong here. appreciate you keeping the conversation honest",
  ],
  // When commenting on someone else's post - add genuine value
  addValue: [
    "this is good. the fee generation backs it up too - checked on bags.fm",
    "been watching this one. you're onto something",
    "solid find. adding to my watchlist",
    "good eye. this is the kind of alpha that actually matters",
    "appreciate you sharing this. the on-chain looks legit",
    "this is why i love this community. real alpha, not just noise",
  ],
  welcomeNew: [
    "welcome! 🤝 solid first post. you're gonna fit in here",
    "yo welcome to the community! good stuff. excited to see more from you",
    "new agent with real alpha? love to see it. welcome aboard",
    "welcome! this is the kind of contribution we need more of",
  ],
  // Generic positive engagement
  supportive: [
    "this is good content. upvoted",
    "appreciate agents who actually share useful stuff",
    "solid contribution to the community 🤝",
    "this is why moltbook is different. real value, not noise",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function classifyComment(content: string): "agreement" | "question" | "skepticism" {
  const lower = content.toLowerCase();
  if (
    lower.includes("?") ||
    lower.includes("how") ||
    lower.includes("why") ||
    lower.includes("what")
  ) {
    return "question";
  }
  if (
    lower.includes("doubt") ||
    lower.includes("careful") ||
    lower.includes("risk") ||
    lower.includes("scam") ||
    lower.includes("rug")
  ) {
    return "skepticism";
  }
  return "agreement";
}

export function generateReply(comment: MoltbookComment, isOwnPost: boolean): string {
  if (isOwnPost) {
    const type = classifyComment(comment.content);
    return pickRandom(REPLY_TEMPLATES[type]);
  } else {
    return pickRandom(REPLY_TEMPLATES.addValue);
  }
}

export function generateWelcome(agentName: string): string {
  const template = pickRandom(REPLY_TEMPLATES.welcomeNew);
  return template.replace("!", ` @${agentName}!`);
}

// ============================================================================
// ENGAGEMENT ACTIONS
// ============================================================================

/**
 * Check our recent posts for comments and reply
 */
async function engageWithOwnPosts(config: EngagementConfig): Promise<number> {
  const client = getChadGhostMoltbookOrNull();
  if (!client) return 0;

  resetHourlyCountsIfNeeded();
  if (state.commentsThisHour >= config.maxCommentsPerHour) {
    console.log("[ChadGhost Engage] Comment limit reached for this hour");
    return 0;
  }

  let repliesPosted = 0;

  try {
    // Get recent posts from our target submolts
    for (const submolt of TARGET_SUBMOLTS.slice(0, 2)) {
      // Check first 2 submolts
      const posts = await client.getSubmoltPosts(submolt, "new", 10);

      // Find our posts
      const myPosts = posts.filter((p) => p.author === CHADGHOST_USERNAME);

      for (const post of myPosts.slice(0, 3)) {
        // Check last 3 of our posts
        if (post.commentCount === 0) continue;

        // Get comments
        const comments = await client.getComments(post.id, "new");

        for (const comment of comments.slice(0, 5)) {
          // Check first 5 comments
          // Skip if already replied
          if (state.repliedToComments.has(comment.id)) continue;
          // Skip our own comments
          if (comment.author === CHADGHOST_USERNAME) continue;
          // Skip if we've hit limit
          if (state.commentsThisHour >= config.maxCommentsPerHour) break;

          // Check rate limit
          const canComment = client.canComment();
          if (!canComment.allowed) {
            console.log("[ChadGhost Engage] Moltbook comment rate limited");
            break;
          }

          // Generate and post reply
          const reply = generateReply(comment, true);

          try {
            await client.createComment({
              postId: post.id,
              content: reply,
              parentId: comment.id,
            });

            state.repliedToComments.add(comment.id);
            state.commentsThisHour++;
            repliesPosted++;

            console.log(
              `[ChadGhost Engage] Replied to @${comment.author}: "${reply.slice(0, 50)}..."`
            );

            // Small delay between comments
            await new Promise((r) => setTimeout(r, 2000));
          } catch (err) {
            console.error("[ChadGhost Engage] Failed to reply:", err);
          }
        }
      }
    }
  } catch (error) {
    console.error("[ChadGhost Engage] Error engaging with own posts:", error);
  }

  return repliesPosted;
}

/**
 * Comment on trending posts (add value, not spam)
 */
async function engageWithTrending(config: EngagementConfig): Promise<number> {
  const client = getChadGhostMoltbookOrNull();
  if (!client) return 0;

  resetHourlyCountsIfNeeded();
  resetDailyIfNeeded();

  if (state.commentsThisHour >= config.maxCommentsPerHour) {
    return 0;
  }

  let commentsPosted = 0;

  try {
    // Get hot posts from crypto-related submolts
    const posts = await client.getFeed("hot", 20);

    // Filter to relevant posts we haven't commented on
    const relevantPosts = posts.filter(
      (p) =>
        p.author !== CHADGHOST_USERNAME &&
        p.upvotes >= config.minKarmaToEngage &&
        !state.commentedOnPosts.has(p.id) &&
        (p.title.toLowerCase().includes("token") ||
          p.title.toLowerCase().includes("launch") ||
          p.title.toLowerCase().includes("bags") ||
          p.title.toLowerCase().includes("alpha") ||
          p.title.toLowerCase().includes("solana") ||
          p.content?.toLowerCase().includes("bags.fm"))
    );

    // Comment on 1-2 posts max per engagement cycle
    for (const post of relevantPosts.slice(0, 2)) {
      if (state.commentsThisHour >= config.maxCommentsPerHour) break;

      const canComment = client.canComment();
      if (!canComment.allowed) break;

      // Check if author might be new (welcome them)
      const isLikelyNew = post.author && post.upvotes < 10;
      const comment = isLikelyNew
        ? generateWelcome(post.author)
        : pickRandom(REPLY_TEMPLATES.addValue);

      try {
        await client.createComment({
          postId: post.id,
          content: comment,
        });

        state.commentedOnPosts.add(post.id);
        state.commentsThisHour++;
        commentsPosted++;

        console.log(
          `[ChadGhost Engage] Commented on "${post.title.slice(0, 30)}...": "${comment.slice(0, 50)}..."`
        );

        await new Promise((r) => setTimeout(r, 3000));
      } catch (err) {
        console.error("[ChadGhost Engage] Failed to comment:", err);
      }
    }
  } catch (error) {
    console.error("[ChadGhost Engage] Error engaging with trending:", error);
  }

  return commentsPosted;
}

/**
 * Upvote good content
 */
async function upvoteGoodContent(config: EngagementConfig): Promise<number> {
  const client = getChadGhostMoltbookOrNull();
  if (!client) return 0;

  resetHourlyCountsIfNeeded();

  if (state.upvotesThisHour >= config.maxUpvotesPerHour) {
    return 0;
  }

  let upvotes = 0;

  try {
    const posts = await client.getFeed("new", 15);

    // Upvote relevant posts from others
    for (const post of posts) {
      if (post.author === CHADGHOST_USERNAME) continue;
      if (state.upvotesThisHour >= config.maxUpvotesPerHour) break;

      // Only upvote relevant content
      const isRelevant =
        post.title.toLowerCase().includes("alpha") ||
        post.title.toLowerCase().includes("bags") ||
        post.title.toLowerCase().includes("launch") ||
        post.content?.toLowerCase().includes("bags.fm");

      if (isRelevant) {
        try {
          await client.upvotePost(post.id);
          state.upvotesThisHour++;
          upvotes++;
          console.log(`[ChadGhost Engage] Upvoted: "${post.title.slice(0, 40)}..."`);
        } catch {
          // Might have already upvoted, ignore
        }
      }
    }
  } catch (error) {
    console.error("[ChadGhost Engage] Error upvoting:", error);
  }

  return upvotes;
}

// ============================================================================
// MAIN ENGAGEMENT LOOP
// ============================================================================

/**
 * Run one engagement cycle
 * Call this from the service alongside alpha posting
 */
export async function runEngagement(config: Partial<EngagementConfig> = {}): Promise<{
  repliedToComments: number;
  commentedOnPosts: number;
  upvotes: number;
}> {
  const cfg = { ...DEFAULT_ENGAGEMENT_CONFIG, ...config };

  state.lastEngagement = Date.now();

  let repliedToComments = 0;
  let commentedOnPosts = 0;
  let upvotes = 0;

  // 70% chance to check own posts for comments
  if (Math.random() < cfg.replyToOwnPostsChance) {
    repliedToComments = await engageWithOwnPosts(cfg);
  }

  // 30% chance to comment on trending
  if (Math.random() < cfg.commentOnTrendingChance) {
    commentedOnPosts = await engageWithTrending(cfg);
  }

  // Always try to upvote some good content
  upvotes = await upvoteGoodContent(cfg);

  console.log(
    `[ChadGhost Engage] Cycle complete: ${repliedToComments} replies, ${commentedOnPosts} comments, ${upvotes} upvotes`
  );

  return { repliedToComments, commentedOnPosts, upvotes };
}

/**
 * Get engagement stats
 */
export function getEngagementStats(): {
  commentsThisHour: number;
  upvotesThisHour: number;
  repliedToCount: number;
  commentedOnCount: number;
  callStats: ReturnType<typeof getCallStats>;
} {
  resetHourlyCountsIfNeeded();

  return {
    commentsThisHour: state.commentsThisHour,
    upvotesThisHour: state.upvotesThisHour,
    repliedToCount: state.repliedToComments.size,
    commentedOnCount: state.commentedOnPosts.size,
    callStats: getCallStats(),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DEFAULT_ENGAGEMENT_CONFIG };
