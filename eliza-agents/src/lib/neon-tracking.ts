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
