// Agent Reputation System
// Computes reputation scores, syncs Moltbook karma, and provides directory queries
// for the external agent registry.

import { neon } from "@neondatabase/serverless";
import { getAgentBuildingHealth } from "./external-registry";

// ============================================================================
// DATABASE
// ============================================================================

function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  return neon(connectionString);
}

// ============================================================================
// TYPES
// ============================================================================

export type ReputationTier = "none" | "bronze" | "silver" | "gold" | "diamond";

interface AgentReputationRow {
  wallet: string;
  name: string;
  description: string | null;
  moltbook_username: string | null;
  zone: string;
  joined_at: Date;
  last_active_at: Date | null;
  moltbook_karma: number | null;
  tokens_launched: number | null;
  total_fees_earned_lamports: string | null;
  reputation_score: number | null;
  karma_fetched_at: Date | null;
}

export interface AgentDirectoryEntry {
  wallet: string;
  name: string;
  description?: string;
  moltbookUsername?: string;
  zone: string;
  joinedAt: string;
  reputationScore: number;
  reputationTier: ReputationTier;
  moltbookKarma: number;
  tokensLaunched: number;
  totalFeesEarnedSol: number;
  buildingHealth: number;
  buildingStatus: string;
}

// ============================================================================
// PURE COMPUTATION (no I/O)
// ============================================================================

export function computeReputationScore(agent: {
  moltbook_karma?: number | null;
  tokens_launched?: number | null;
  total_fees_earned_lamports?: string | number | null;
  joined_at?: Date | null;
  last_active_at?: Date | null;
}): number {
  const karma = agent.moltbook_karma ?? 0;
  const launches = agent.tokens_launched ?? 0;
  const feeLamports =
    typeof agent.total_fees_earned_lamports === "string"
      ? parseInt(agent.total_fees_earned_lamports, 10) || 0
      : (agent.total_fees_earned_lamports ?? 0);
  const feesSol = feeLamports / 1_000_000_000;

  // Days active since joining
  const joinedAt = agent.joined_at ? new Date(agent.joined_at).getTime() : Date.now();
  const daysActive = Math.max(0, (Date.now() - joinedAt) / (1000 * 60 * 60 * 24));

  // Building health
  const { health } = getAgentBuildingHealth(agent.last_active_at ?? null);

  // launches = token launches + bounty completions (general "contributions" counter)
  const score = karma * 0.3 + launches * 10 + feesSol * 5 + daysActive * 2 + health / 10;

  return Math.min(1000, Math.round(score));
}

export function getReputationTier(score: number): ReputationTier {
  if (score >= 900) return "diamond";
  if (score >= 600) return "gold";
  if (score >= 300) return "silver";
  if (score >= 100) return "bronze";
  return "none";
}

export function getReputationTierColor(tier: ReputationTier): string {
  switch (tier) {
    case "diamond":
      return "#b9f2ff";
    case "gold":
      return "#ffd700";
    case "silver":
      return "#c0c0c0";
    case "bronze":
      return "#cd7f32";
    default:
      return "#9ca3af";
  }
}

export function isKarmaStale(karmaFetchedAt: Date | null): boolean {
  if (!karmaFetchedAt) return true;
  const oneHourMs = 60 * 60 * 1000;
  return Date.now() - new Date(karmaFetchedAt).getTime() > oneHourMs;
}

// ============================================================================
// MOLTBOOK KARMA FETCH
// ============================================================================

async function fetchMoltbookKarma(username: string): Promise<number | null> {
  try {
    const { getMoltbookOrNull } = await import("@/lib/moltbook-client");
    const client = getMoltbookOrNull();
    if (!client) return null;
    const profile = await client.getAgentProfile(username);
    return profile?.karma ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// FIRE-AND-FORGET (non-blocking)
// ============================================================================

export function refreshKarmaIfStale(
  wallet: string,
  username: string | null,
  karmaFetchedAt: Date | null
): void {
  if (!username || !isKarmaStale(karmaFetchedAt)) return;

  // Fire and forget
  (async () => {
    const karma = await fetchMoltbookKarma(username);
    if (karma === null) return;

    const sql = getDb();

    // Recompute reputation with new karma
    const rows = await sql`
      SELECT * FROM external_agents WHERE wallet = ${wallet}
    `;
    if (rows.length === 0) return;

    const row = rows[0] as AgentReputationRow;
    const updatedScore = computeReputationScore({
      ...row,
      moltbook_karma: karma,
    });

    await sql`
      UPDATE external_agents
      SET moltbook_karma = ${karma},
          karma_fetched_at = NOW(),
          reputation_score = ${updatedScore}
      WHERE wallet = ${wallet}
    `;
  })().catch((err) => {
    console.error("[AgentReputation] Failed to refresh karma:", err);
  });
}

export function incrementTokensLaunched(wallet: string): void {
  (async () => {
    const sql = getDb();
    await sql`
      UPDATE external_agents
      SET tokens_launched = COALESCE(tokens_launched, 0) + 1
      WHERE wallet = ${wallet}
    `;
    // Recompute reputation
    const rows = await sql`SELECT * FROM external_agents WHERE wallet = ${wallet}`;
    if (rows.length > 0) {
      const row = rows[0] as AgentReputationRow;
      const score = computeReputationScore(row);
      await sql`UPDATE external_agents SET reputation_score = ${score} WHERE wallet = ${wallet}`;
    }
  })().catch((err) => {
    console.error("[AgentReputation] Failed to increment tokens_launched:", err);
  });
}

export function addBountyCompletion(wallet: string): void {
  (async () => {
    const sql = getDb();
    await sql`
      UPDATE external_agents
      SET tokens_launched = COALESCE(tokens_launched, 0) + 1
      WHERE wallet = ${wallet}
    `;
    // Recompute reputation
    const rows = await sql`SELECT * FROM external_agents WHERE wallet = ${wallet}`;
    if (rows.length > 0) {
      const row = rows[0] as AgentReputationRow;
      const score = computeReputationScore(row);
      await sql`UPDATE external_agents SET reputation_score = ${score} WHERE wallet = ${wallet}`;
    }
  })().catch((err) => {
    console.error("[AgentReputation] Failed to add bounty completion:", err);
  });
}

export function addFeesEarned(wallet: string, lamports: number): void {
  if (!lamports || lamports <= 0) return;

  (async () => {
    const sql = getDb();
    await sql`
      UPDATE external_agents
      SET total_fees_earned_lamports = COALESCE(total_fees_earned_lamports, 0) + ${lamports}
      WHERE wallet = ${wallet}
    `;
    // Recompute reputation
    const rows = await sql`SELECT * FROM external_agents WHERE wallet = ${wallet}`;
    if (rows.length > 0) {
      const row = rows[0] as AgentReputationRow;
      const score = computeReputationScore(row);
      await sql`UPDATE external_agents SET reputation_score = ${score} WHERE wallet = ${wallet}`;
    }
  })().catch((err) => {
    console.error("[AgentReputation] Failed to add fees earned:", err);
  });
}

// ============================================================================
// DB QUERIES
// ============================================================================

type SortField = "reputation" | "karma" | "fees" | "launches" | "newest";

function rowToDirectoryEntry(row: AgentReputationRow): AgentDirectoryEntry {
  const repScore = row.reputation_score ?? 0;
  const feeLamports = parseInt(row.total_fees_earned_lamports || "0", 10);
  const { health, status } = getAgentBuildingHealth(row.last_active_at);

  return {
    wallet: row.wallet,
    name: row.name,
    description: row.description || undefined,
    moltbookUsername: row.moltbook_username || undefined,
    zone: row.zone,
    joinedAt: new Date(row.joined_at).toISOString(),
    reputationScore: repScore,
    reputationTier: getReputationTier(repScore),
    moltbookKarma: row.moltbook_karma ?? 0,
    tokensLaunched: row.tokens_launched ?? 0,
    totalFeesEarnedSol: feeLamports / 1_000_000_000,
    buildingHealth: health,
    buildingStatus: status,
  };
}

async function queryAgentsSorted(
  sql: ReturnType<typeof getDb>,
  sort: SortField,
  limit: number,
  offset: number
) {
  switch (sort) {
    case "karma":
      return sql`SELECT *, COUNT(*) OVER() AS total_count FROM external_agents ORDER BY moltbook_karma DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
    case "fees":
      return sql`SELECT *, COUNT(*) OVER() AS total_count FROM external_agents ORDER BY total_fees_earned_lamports DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
    case "launches":
      return sql`SELECT *, COUNT(*) OVER() AS total_count FROM external_agents ORDER BY tokens_launched DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
    case "newest":
      return sql`SELECT *, COUNT(*) OVER() AS total_count FROM external_agents ORDER BY joined_at DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
    default:
      return sql`SELECT *, COUNT(*) OVER() AS total_count FROM external_agents ORDER BY reputation_score DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
  }
}

export async function queryAgentsWithReputation(opts: {
  sort?: SortField;
  limit?: number;
  offset?: number;
}): Promise<{ count: number; agents: AgentDirectoryEntry[] }> {
  const sql = getDb();
  const sort = opts.sort || "reputation";
  const limit = Math.min(opts.limit || 20, 100);
  const offset = opts.offset || 0;

  const rows = await queryAgentsSorted(sql, sort, limit, offset);

  const count =
    rows.length > 0 ? parseInt((rows[0] as { total_count: string }).total_count, 10) : 0;
  const agents = (rows as AgentReputationRow[]).map(rowToDirectoryEntry);

  // Trigger background karma refresh for stale agents
  for (const row of rows as AgentReputationRow[]) {
    if (row.moltbook_username) {
      refreshKarmaIfStale(row.wallet, row.moltbook_username, row.karma_fetched_at);
    }
  }

  return { count, agents };
}

export async function getAgentDetail(opts: {
  wallet?: string;
  moltbookUsername?: string;
}): Promise<AgentDirectoryEntry | null> {
  const sql = getDb();

  let rows;
  if (opts.wallet) {
    rows = await sql`SELECT * FROM external_agents WHERE wallet = ${opts.wallet}`;
  } else if (opts.moltbookUsername) {
    rows =
      await sql`SELECT * FROM external_agents WHERE moltbook_username = ${opts.moltbookUsername}`;
  } else {
    return null;
  }

  if (rows.length === 0) return null;

  const row = rows[0] as AgentReputationRow;

  // Trigger background karma refresh
  if (row.moltbook_username) {
    refreshKarmaIfStale(row.wallet, row.moltbook_username, row.karma_fetched_at);
  }

  return rowToDirectoryEntry(row);
}

async function queryLeaderboardSorted(
  sql: ReturnType<typeof getDb>,
  metric: SortField,
  limit: number
) {
  switch (metric) {
    case "karma":
      return sql`SELECT * FROM external_agents ORDER BY moltbook_karma DESC NULLS LAST LIMIT ${limit}`;
    case "fees":
      return sql`SELECT * FROM external_agents ORDER BY total_fees_earned_lamports DESC NULLS LAST LIMIT ${limit}`;
    case "launches":
      return sql`SELECT * FROM external_agents ORDER BY tokens_launched DESC NULLS LAST LIMIT ${limit}`;
    case "newest":
      return sql`SELECT * FROM external_agents ORDER BY joined_at DESC NULLS LAST LIMIT ${limit}`;
    default:
      return sql`SELECT * FROM external_agents ORDER BY reputation_score DESC NULLS LAST LIMIT ${limit}`;
  }
}

export async function getLeaderboard(
  metric: SortField = "reputation",
  limit: number = 20
): Promise<AgentDirectoryEntry[]> {
  const sql = getDb();
  const safeLimit = Math.min(limit, 100);

  const rows = await queryLeaderboardSorted(sql, metric, safeLimit);

  return (rows as AgentReputationRow[]).map(rowToDirectoryEntry);
}
