// Agent Credentials Storage
// Secure server-side storage for agent JWT tokens and API keys
// Uses Neon PostgreSQL for persistence across serverless instances

import { neon } from "@neondatabase/serverless";
import type { AgentCredentials, AuthSession } from "./types";

// Get database client
function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured - agent credentials require Neon DB");
  }
  return neon(connectionString);
}

/**
 * Initialize the agent credentials table
 * Call this on app startup or first agent registration
 */
export async function initAgentCredentialsTable(): Promise<void> {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS agent_credentials (
      agent_id TEXT PRIMARY KEY,
      moltbook_username TEXT NOT NULL UNIQUE,
      jwt_token TEXT NOT NULL,
      api_key TEXT,
      wallets TEXT[] DEFAULT '{}',
      authenticated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Auth sessions table (temporary, 15 min expiry)
  await sql`
    CREATE TABLE IF NOT EXISTS agent_auth_sessions (
      public_identifier TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      agent_username TEXT NOT NULL,
      agent_user_id TEXT,
      verification_content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  // Agent actions log for transparency
  await sql`
    CREATE TABLE IF NOT EXISTS agent_actions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agent_credentials(agent_id),
      action_type TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data JSONB DEFAULT '{}',
      signature TEXT,
      success BOOLEAN NOT NULL DEFAULT true,
      error TEXT
    )
  `;

  // Index for faster lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id 
    ON agent_actions(agent_id, timestamp DESC)
  `;

  console.log("[AgentEconomy] Credentials tables initialized");
}

/**
 * Store an auth session (temporary, for Moltbook verification flow)
 */
export async function storeAuthSession(session: AuthSession): Promise<void> {
  const sql = getDb();

  await sql`
    INSERT INTO agent_auth_sessions (
      public_identifier,
      secret,
      agent_username,
      agent_user_id,
      verification_content,
      created_at,
      expires_at
    ) VALUES (
      ${session.publicIdentifier},
      ${session.secret},
      ${session.agentUsername},
      ${session.agentUserId},
      ${session.verificationPostContent},
      ${session.createdAt.toISOString()},
      ${session.expiresAt.toISOString()}
    )
    ON CONFLICT (public_identifier) DO UPDATE SET
      secret = EXCLUDED.secret,
      agent_username = EXCLUDED.agent_username,
      verification_content = EXCLUDED.verification_content,
      expires_at = EXCLUDED.expires_at
  `;
}

/**
 * Get an auth session by public identifier
 */
export async function getAuthSession(publicIdentifier: string): Promise<AuthSession | null> {
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM agent_auth_sessions 
    WHERE public_identifier = ${publicIdentifier}
    AND expires_at > NOW()
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    publicIdentifier: row.public_identifier,
    secret: row.secret,
    agentUsername: row.agent_username,
    agentUserId: row.agent_user_id,
    verificationPostContent: row.verification_content,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * Delete an auth session (after successful login or expiry)
 */
export async function deleteAuthSession(publicIdentifier: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM agent_auth_sessions WHERE public_identifier = ${publicIdentifier}`;
}

/**
 * Clean up expired auth sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const sql = getDb();
  const result = await sql`
    DELETE FROM agent_auth_sessions WHERE expires_at < NOW()
    RETURNING public_identifier
  `;
  return result.length;
}

/**
 * Store agent credentials after successful authentication
 */
export async function storeAgentCredentials(credentials: AgentCredentials): Promise<void> {
  const sql = getDb();

  await sql`
    INSERT INTO agent_credentials (
      agent_id,
      moltbook_username,
      jwt_token,
      api_key,
      wallets,
      authenticated_at,
      expires_at,
      updated_at
    ) VALUES (
      ${credentials.agentId},
      ${credentials.moltbookUsername},
      ${credentials.jwtToken},
      ${credentials.apiKey},
      ${credentials.wallets},
      ${credentials.authenticatedAt.toISOString()},
      ${credentials.expiresAt.toISOString()},
      NOW()
    )
    ON CONFLICT (agent_id) DO UPDATE SET
      jwt_token = EXCLUDED.jwt_token,
      api_key = COALESCE(EXCLUDED.api_key, agent_credentials.api_key),
      wallets = EXCLUDED.wallets,
      authenticated_at = EXCLUDED.authenticated_at,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `;
}

/**
 * Get agent credentials by agent ID
 */
export async function getAgentCredentials(agentId: string): Promise<AgentCredentials | null> {
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM agent_credentials 
    WHERE agent_id = ${agentId}
    AND expires_at > NOW()
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    agentId: row.agent_id,
    moltbookUsername: row.moltbook_username,
    jwtToken: row.jwt_token,
    apiKey: row.api_key,
    wallets: row.wallets || [],
    authenticatedAt: new Date(row.authenticated_at),
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * Get agent credentials by Moltbook username
 */
export async function getAgentByUsername(username: string): Promise<AgentCredentials | null> {
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM agent_credentials 
    WHERE moltbook_username = ${username}
    AND expires_at > NOW()
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    agentId: row.agent_id,
    moltbookUsername: row.moltbook_username,
    jwtToken: row.jwt_token,
    apiKey: row.api_key,
    wallets: row.wallets || [],
    authenticatedAt: new Date(row.authenticated_at),
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * Update agent's API key
 */
export async function updateAgentApiKey(agentId: string, apiKey: string): Promise<void> {
  const sql = getDb();

  await sql`
    UPDATE agent_credentials 
    SET api_key = ${apiKey}, updated_at = NOW()
    WHERE agent_id = ${agentId}
  `;
}

/**
 * Update agent's wallets list
 */
export async function updateAgentWallets(agentId: string, wallets: string[]): Promise<void> {
  const sql = getDb();

  await sql`
    UPDATE agent_credentials 
    SET wallets = ${wallets}, updated_at = NOW()
    WHERE agent_id = ${agentId}
  `;
}

/**
 * List all registered agents
 */
export async function listAgents(): Promise<
  Array<{
    agentId: string;
    moltbookUsername: string;
    wallets: string[];
    authenticatedAt: Date;
    isExpired: boolean;
  }>
> {
  const sql = getDb();

  const rows = await sql`
    SELECT 
      agent_id,
      moltbook_username,
      wallets,
      authenticated_at,
      expires_at < NOW() as is_expired
    FROM agent_credentials
    ORDER BY authenticated_at DESC
  `;

  return rows.map((row) => ({
    agentId: row.agent_id,
    moltbookUsername: row.moltbook_username,
    wallets: row.wallets || [],
    authenticatedAt: new Date(row.authenticated_at),
    isExpired: row.is_expired,
  }));
}

/**
 * Check if an agent's credentials are valid (not expired)
 */
export async function isAgentAuthenticated(agentId: string): Promise<boolean> {
  const sql = getDb();

  const rows = await sql`
    SELECT 1 FROM agent_credentials 
    WHERE agent_id = ${agentId}
    AND expires_at > NOW()
  `;

  return rows.length > 0;
}

/**
 * Log an agent action for transparency
 */
export async function logAgentAction(
  agentId: string,
  actionType: string,
  data: Record<string, unknown>,
  success: boolean,
  signature?: string,
  error?: string
): Promise<string> {
  const sql = getDb();
  const id = `${actionType}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  await sql`
    INSERT INTO agent_actions (id, agent_id, action_type, data, signature, success, error)
    VALUES (${id}, ${agentId}, ${actionType}, ${JSON.stringify(data)}, ${signature}, ${success}, ${error})
  `;

  return id;
}

/**
 * Get recent actions for an agent
 */
export async function getAgentActions(
  agentId: string,
  limit: number = 50
): Promise<
  Array<{
    id: string;
    actionType: string;
    timestamp: Date;
    data: Record<string, unknown>;
    signature?: string;
    success: boolean;
    error?: string;
  }>
> {
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM agent_actions
    WHERE agent_id = ${agentId}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    actionType: row.action_type,
    timestamp: new Date(row.timestamp),
    data: row.data || {},
    signature: row.signature,
    success: row.success,
    error: row.error,
  }));
}
