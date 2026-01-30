// Twitter/Agent Tracking Functions for eliza-agents
// Persists processed tweet IDs and agent state to survive serverless restarts.
// Prevents duplicate replies, intro tweets, and re-processing old mentions.

import { neon } from "@neondatabase/serverless";

// SQL tagged template function type
type SqlFunction = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

// Get SQL client from environment
function getSql(): SqlFunction | null {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NETLIFY_DATABASE_URL;

  if (!dbUrl) {
    console.warn("[NeonTracking] No database URL configured");
    return null;
  }

  try {
    return neon(dbUrl) as unknown as SqlFunction;
  } catch (error) {
    console.error("[NeonTracking] Failed to connect:", error);
    return null;
  }
}

let tablesInitialized = false;

/**
 * Initialize Twitter tracking tables for agent state persistence.
 */
export async function initializeTwitterTrackingTables(): Promise<boolean> {
  if (tablesInitialized) return true;

  const sql = getSql();
  if (!sql) return false;

  try {
    // Track processed tweets to prevent duplicate replies
    await sql`
      CREATE TABLE IF NOT EXISTS processed_tweets (
        tweet_id VARCHAR(64) PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        action_type VARCHAR(32) NOT NULL DEFAULT 'reply',
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Track pagination cursors for each agent
    await sql`
      CREATE TABLE IF NOT EXISTS agent_cursors (
        id VARCHAR(128) PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        cursor_type VARCHAR(64) NOT NULL,
        cursor_value VARCHAR(128) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Track agent state (intro posted, etc.)
    await sql`
      CREATE TABLE IF NOT EXISTS agent_state (
        id VARCHAR(128) PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        state_key VARCHAR(64) NOT NULL,
        state_value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Indexes for efficient lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_processed_tweets_agent ON processed_tweets(agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_processed_tweets_time ON processed_tweets(processed_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_agent_cursors_agent ON agent_cursors(agent_id)`;

    tablesInitialized = true;
    console.log("[NeonTracking] Twitter tracking tables initialized");
    return true;
  } catch (error) {
    console.error("[NeonTracking] Error creating tables:", error);
    return false;
  }
}

/**
 * Check if a tweet has already been processed by an agent.
 */
export async function isTwitterProcessed(
  tweetId: string,
  agentId: string = "bagsy"
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;

  try {
    await initializeTwitterTrackingTables();
    const result = await sql`
      SELECT tweet_id FROM processed_tweets
      WHERE tweet_id = ${tweetId} AND agent_id = ${agentId}
      LIMIT 1
    `;
    return (result as unknown[]).length > 0;
  } catch (error) {
    console.error("[NeonTracking] Error checking processed tweet:", error);
    return false;
  }
}

/**
 * Mark a tweet as processed by an agent.
 */
export async function markTwitterProcessed(
  tweetId: string,
  agentId: string = "bagsy",
  actionType: string = "reply"
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;

  try {
    await initializeTwitterTrackingTables();
    await sql`
      INSERT INTO processed_tweets (tweet_id, agent_id, action_type)
      VALUES (${tweetId}, ${agentId}, ${actionType})
      ON CONFLICT (tweet_id) DO NOTHING
    `;
    return true;
  } catch (error) {
    console.error("[NeonTracking] Error marking tweet processed:", error);
    return false;
  }
}

/**
 * Get a pagination cursor for an agent (e.g., last mention ID).
 */
export async function getAgentCursor(
  agentId: string,
  cursorType: string
): Promise<string | null> {
  const sql = getSql();
  if (!sql) return null;

  try {
    await initializeTwitterTrackingTables();
    const id = `${agentId}:${cursorType}`;
    const result = await sql`
      SELECT cursor_value FROM agent_cursors WHERE id = ${id} LIMIT 1
    `;
    return (result as Array<{ cursor_value: string }>)[0]?.cursor_value || null;
  } catch (error) {
    console.error("[NeonTracking] Error getting agent cursor:", error);
    return null;
  }
}

/**
 * Set a pagination cursor for an agent.
 */
export async function setAgentCursor(
  agentId: string,
  cursorType: string,
  cursorValue: string
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;

  try {
    await initializeTwitterTrackingTables();
    const id = `${agentId}:${cursorType}`;
    await sql`
      INSERT INTO agent_cursors (id, agent_id, cursor_type, cursor_value, updated_at)
      VALUES (${id}, ${agentId}, ${cursorType}, ${cursorValue}, NOW())
      ON CONFLICT (id) DO UPDATE SET cursor_value = ${cursorValue}, updated_at = NOW()
    `;
    return true;
  } catch (error) {
    console.error("[NeonTracking] Error setting agent cursor:", error);
    return false;
  }
}

/**
 * Get agent state (e.g., has posted intro).
 */
export async function getAgentState(
  agentId: string,
  stateKey: string
): Promise<string | null> {
  const sql = getSql();
  if (!sql) return null;

  try {
    await initializeTwitterTrackingTables();
    const id = `${agentId}:${stateKey}`;
    const result = await sql`
      SELECT state_value FROM agent_state WHERE id = ${id} LIMIT 1
    `;
    return (result as Array<{ state_value: string }>)[0]?.state_value || null;
  } catch (error) {
    console.error("[NeonTracking] Error getting agent state:", error);
    return null;
  }
}

/**
 * Set agent state (e.g., mark intro as posted).
 */
export async function setAgentState(
  agentId: string,
  stateKey: string,
  stateValue: string
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;

  try {
    await initializeTwitterTrackingTables();
    const id = `${agentId}:${stateKey}`;
    await sql`
      INSERT INTO agent_state (id, agent_id, state_key, state_value, updated_at)
      VALUES (${id}, ${agentId}, ${stateKey}, ${stateValue}, NOW())
      ON CONFLICT (id) DO UPDATE SET state_value = ${stateValue}, updated_at = NOW()
    `;
    return true;
  } catch (error) {
    console.error("[NeonTracking] Error setting agent state:", error);
    return false;
  }
}

/**
 * Clean up old processed tweets (older than 7 days).
 */
export async function cleanupOldProcessedTweets(): Promise<number> {
  const sql = getSql();
  if (!sql) return 0;

  try {
    await initializeTwitterTrackingTables();
    const result = await sql`
      DELETE FROM processed_tweets
      WHERE processed_at < NOW() - INTERVAL '7 days'
      RETURNING tweet_id
    `;
    const count = (result as unknown[]).length;
    if (count > 0) {
      console.log(`[NeonTracking] Cleaned up ${count} old processed tweets`);
    }
    return count;
  } catch (error) {
    console.error("[NeonTracking] Error cleaning up:", error);
    return 0;
  }
}

/**
 * Get all processed tweet IDs for an agent (for loading into memory cache).
 */
export async function getProcessedTweetIds(agentId: string = "bagsy"): Promise<Set<string>> {
  const sql = getSql();
  if (!sql) return new Set();

  try {
    await initializeTwitterTrackingTables();
    const result = await sql`
      SELECT tweet_id FROM processed_tweets
      WHERE agent_id = ${agentId}
      AND processed_at > NOW() - INTERVAL '7 days'
    `;
    return new Set((result as Array<{ tweet_id: string }>).map((r) => r.tweet_id));
  } catch (error) {
    console.error("[NeonTracking] Error fetching processed tweet IDs:", error);
    return new Set();
  }
}

// ============================================================================
// Engagement Tracking (for virality optimization feedback loop)
// ============================================================================

let engagementTableInitialized = false;

/**
 * Initialize engagement tracking table for storing tweet performance data.
 */
async function initializeEngagementTable(): Promise<boolean> {
  if (engagementTableInitialized) return true;

  const sql = getSql();
  if (!sql) return false;

  try {
    // Track engagement outcomes for Bagsy's tweets
    await sql`
      CREATE TABLE IF NOT EXISTS engagement_tracking (
        tweet_id VARCHAR(64) PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        tweet_type VARCHAR(32) NOT NULL,
        content_hash VARCHAR(64),
        virality_score INTEGER,
        score_factors TEXT,
        author_followers INTEGER,
        target_username VARCHAR(64),
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        engagement_rate DECIMAL(5,4) DEFAULT 0,
        posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Index for analytics queries
    await sql`CREATE INDEX IF NOT EXISTS idx_engagement_agent ON engagement_tracking(agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_engagement_type ON engagement_tracking(tweet_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_engagement_score ON engagement_tracking(virality_score)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_engagement_time ON engagement_tracking(posted_at)`;

    engagementTableInitialized = true;
    console.log("[NeonTracking] Engagement tracking table initialized");
    return true;
  } catch (error) {
    console.error("[NeonTracking] Error creating engagement table:", error);
    return false;
  }
}

export interface EngagementRecord {
  tweetId: string;
  agentId: string;
  tweetType: "post" | "reply" | "quote" | "mention_reply" | "fee_help";
  contentHash?: string;
  viralityScore?: number;
  scoreFactors?: string[];
  authorFollowers?: number;
  targetUsername?: string;
}

/**
 * Record a tweet for engagement tracking.
 * Called when Bagsy posts or replies to track performance.
 */
export async function recordEngagement(record: EngagementRecord): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;

  try {
    await initializeEngagementTable();

    const factorsJson = record.scoreFactors ? JSON.stringify(record.scoreFactors) : null;

    await sql`
      INSERT INTO engagement_tracking (
        tweet_id, agent_id, tweet_type, content_hash, virality_score,
        score_factors, author_followers, target_username
      )
      VALUES (
        ${record.tweetId},
        ${record.agentId},
        ${record.tweetType},
        ${record.contentHash || null},
        ${record.viralityScore || null},
        ${factorsJson},
        ${record.authorFollowers || null},
        ${record.targetUsername || null}
      )
      ON CONFLICT (tweet_id) DO NOTHING
    `;
    return true;
  } catch (error) {
    console.error("[NeonTracking] Error recording engagement:", error);
    return false;
  }
}

export interface EngagementMetrics {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
}

/**
 * Update engagement metrics for a tracked tweet.
 * Called periodically to fetch actual performance data.
 */
export async function updateEngagementMetrics(
  tweetId: string,
  metrics: EngagementMetrics
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;

  try {
    await initializeEngagementTable();

    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies;
    const engagementRate = metrics.impressions > 0
      ? totalEngagement / metrics.impressions
      : 0;

    await sql`
      UPDATE engagement_tracking
      SET
        likes = ${metrics.likes},
        retweets = ${metrics.retweets},
        replies = ${metrics.replies},
        impressions = ${metrics.impressions},
        engagement_rate = ${engagementRate},
        last_checked_at = NOW()
      WHERE tweet_id = ${tweetId}
    `;
    return true;
  } catch (error) {
    console.error("[NeonTracking] Error updating engagement metrics:", error);
    return false;
  }
}

export interface EngagementStats {
  avgViralityScore: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  avgEngagementRate: number;
  topFactors: string[];
  totalTweets: number;
}

/**
 * Get engagement statistics for an agent over a time period.
 * Used to analyze what's working and adjust scoring weights.
 */
export async function getEngagementStats(
  agentId: string,
  days: number = 7
): Promise<EngagementStats | null> {
  const sql = getSql();
  if (!sql) return null;

  try {
    await initializeEngagementTable();

    const result = await sql`
      SELECT
        AVG(virality_score) as avg_score,
        AVG(likes) as avg_likes,
        AVG(retweets) as avg_retweets,
        AVG(replies) as avg_replies,
        AVG(engagement_rate) as avg_engagement_rate,
        COUNT(*) as total_tweets
      FROM engagement_tracking
      WHERE agent_id = ${agentId}
      AND posted_at > NOW() - INTERVAL '1 day' * ${days}
    `;

    const stats = (result as Array<{
      avg_score: number | null;
      avg_likes: number | null;
      avg_retweets: number | null;
      avg_replies: number | null;
      avg_engagement_rate: number | null;
      total_tweets: string;
    }>)[0];

    if (!stats || parseInt(stats.total_tweets) === 0) {
      return null;
    }

    // Get top performing factors
    const factorsResult = await sql`
      SELECT score_factors
      FROM engagement_tracking
      WHERE agent_id = ${agentId}
      AND posted_at > NOW() - INTERVAL '1 day' * ${days}
      AND engagement_rate > 0.02
      AND score_factors IS NOT NULL
      ORDER BY engagement_rate DESC
      LIMIT 20
    `;

    const factorCounts = new Map<string, number>();
    for (const row of factorsResult as Array<{ score_factors: string }>) {
      const factors = JSON.parse(row.score_factors) as string[];
      for (const factor of factors) {
        factorCounts.set(factor, (factorCounts.get(factor) || 0) + 1);
      }
    }

    const topFactors = [...factorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor]) => factor);

    return {
      avgViralityScore: stats.avg_score || 0,
      avgLikes: stats.avg_likes || 0,
      avgRetweets: stats.avg_retweets || 0,
      avgReplies: stats.avg_replies || 0,
      avgEngagementRate: stats.avg_engagement_rate || 0,
      topFactors,
      totalTweets: parseInt(stats.total_tweets),
    };
  } catch (error) {
    console.error("[NeonTracking] Error getting engagement stats:", error);
    return null;
  }
}

/**
 * Get tweets that need engagement metrics updated.
 * Returns tweets posted in the last 24 hours that haven't been checked recently.
 */
export async function getTweetsNeedingMetricsUpdate(
  agentId: string,
  limit: number = 10
): Promise<string[]> {
  const sql = getSql();
  if (!sql) return [];

  try {
    await initializeEngagementTable();

    const result = await sql`
      SELECT tweet_id
      FROM engagement_tracking
      WHERE agent_id = ${agentId}
      AND posted_at > NOW() - INTERVAL '24 hours'
      AND last_checked_at < NOW() - INTERVAL '1 hour'
      ORDER BY posted_at DESC
      LIMIT ${limit}
    `;

    return (result as Array<{ tweet_id: string }>).map(r => r.tweet_id);
  } catch (error) {
    console.error("[NeonTracking] Error getting tweets needing update:", error);
    return [];
  }
}

/**
 * Get high-performing tweets for analysis.
 * Returns tweets with above-average engagement.
 */
export async function getHighPerformingTweets(
  agentId: string,
  minEngagementRate: number = 0.03,
  limit: number = 10
): Promise<Array<{
  tweetId: string;
  tweetType: string;
  viralityScore: number;
  scoreFactors: string[];
  likes: number;
  retweets: number;
  replies: number;
  engagementRate: number;
}>> {
  const sql = getSql();
  if (!sql) return [];

  try {
    await initializeEngagementTable();

    const result = await sql`
      SELECT
        tweet_id, tweet_type, virality_score, score_factors,
        likes, retweets, replies, engagement_rate
      FROM engagement_tracking
      WHERE agent_id = ${agentId}
      AND engagement_rate >= ${minEngagementRate}
      ORDER BY engagement_rate DESC
      LIMIT ${limit}
    `;

    return (result as Array<{
      tweet_id: string;
      tweet_type: string;
      virality_score: number | null;
      score_factors: string | null;
      likes: number;
      retweets: number;
      replies: number;
      engagement_rate: number;
    }>).map(r => ({
      tweetId: r.tweet_id,
      tweetType: r.tweet_type,
      viralityScore: r.virality_score || 0,
      scoreFactors: r.score_factors ? JSON.parse(r.score_factors) : [],
      likes: r.likes,
      retweets: r.retweets,
      replies: r.replies,
      engagementRate: r.engagement_rate,
    }));
  } catch (error) {
    console.error("[NeonTracking] Error getting high performing tweets:", error);
    return [];
  }
}
