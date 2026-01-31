// Arena database operations for MoltBook Arena
// Uses Neon PostgreSQL following existing patterns from neon.ts
// Falls back to in-memory store for local development without a database

import { neon as neonServerless } from "@neondatabase/serverless";
import type {
  ArenaFighter,
  ArenaMatch,
  ArenaQueueEntry,
  ArenaLeaderboardEntry,
  CombatEvent,
  MatchStatus,
} from "./arena-types";
import { karmaToStats } from "./arena-types";

// Re-export types needed by other modules
export type { ArenaQueueEntry };

// SQL tagged template function type
type SqlFunction = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

// Raw match row from database
interface RawMatchRow {
  id: number;
  status: string;
  fighter1_id: number;
  fighter1_hp: number | null;
  fighter1_x: string | null;
  fighter1_y: string | null;
  fighter2_id: number;
  fighter2_hp: number | null;
  fighter2_x: string | null;
  fighter2_y: string | null;
  winner_id: number | null;
  total_ticks: number;
  fight_log: CombatEvent[] | string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

// Parse database row to ArenaMatch
function parseMatchRow(row: RawMatchRow): ArenaMatch {
  return {
    id: row.id,
    status: row.status as MatchStatus,
    fighter1_id: row.fighter1_id,
    fighter1_hp: row.fighter1_hp,
    fighter1_x: row.fighter1_x ? parseFloat(row.fighter1_x) : null,
    fighter1_y: row.fighter1_y ? parseFloat(row.fighter1_y) : null,
    fighter2_id: row.fighter2_id,
    fighter2_hp: row.fighter2_hp,
    fighter2_x: row.fighter2_x ? parseFloat(row.fighter2_x) : null,
    fighter2_y: row.fighter2_y ? parseFloat(row.fighter2_y) : null,
    winner_id: row.winner_id,
    total_ticks: row.total_ticks,
    fight_log: typeof row.fight_log === "string" ? JSON.parse(row.fight_log) : row.fight_log,
    created_at: row.created_at,
    started_at: row.started_at,
    ended_at: row.ended_at,
  };
}

// ============================================
// In-Memory Store (for local development)
// ============================================

interface InMemoryStore {
  fighters: Map<number, ArenaFighter>;
  matches: Map<number, ArenaMatch>;
  queue: Map<number, ArenaQueueEntry>;
  nextFighterId: number;
  nextMatchId: number;
  nextQueueId: number;
}

const memoryStore: InMemoryStore = {
  fighters: new Map(),
  matches: new Map(),
  queue: new Map(),
  nextFighterId: 1,
  nextMatchId: 1,
  nextQueueId: 1,
};

let useMemoryStore = false;

// ============================================
// Database Connection
// ============================================

// Dynamically get SQL client (same pattern as neon.ts)
async function getSql(): Promise<SqlFunction | null> {
  // Try Netlify's built-in Neon first
  if (process.env.NETLIFY_DATABASE_URL) {
    try {
      const moduleName = "@netlify/neon";
      // eslint-disable-next-line
      const { neon } = require(moduleName);
      return neon();
    } catch {
      // Fall through to direct connection
    }
  }

  // Fall back to direct Neon connection
  const directUrl =
    process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
  if (directUrl) {
    try {
      const sql = neonServerless(directUrl);
      return sql as unknown as SqlFunction;
    } catch (error) {
      console.error("[Arena DB] Failed to connect:", error);
      return null;
    }
  }

  return null;
}

// ============================================
// Database Initialization
// ============================================

let arenaTablesInitialized = false;

export async function initializeArenaTables(): Promise<boolean> {
  if (arenaTablesInitialized) return true;

  const sql = await getSql();
  if (!sql) {
    // Enable in-memory mode for local development
    useMemoryStore = true;
    arenaTablesInitialized = true;
    console.log("[Arena DB] Using in-memory store (no database configured)");
    return true;
  }

  try {
    // Arena fighters table
    await sql`
      CREATE TABLE IF NOT EXISTS arena_fighters (
        id SERIAL PRIMARY KEY,
        moltbook_username TEXT UNIQUE NOT NULL,
        moltbook_karma INTEGER DEFAULT 0,
        hp INTEGER DEFAULT 100,
        attack INTEGER DEFAULT 10,
        defense INTEGER DEFAULT 5,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        total_damage_dealt BIGINT DEFAULT 0,
        total_damage_taken BIGINT DEFAULT 0,
        last_fight_at TIMESTAMP WITH TIME ZONE,
        registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        karma_updated_at TIMESTAMP WITH TIME ZONE
      )
    `;

    // Arena matches table
    await sql`
      CREATE TABLE IF NOT EXISTS arena_matches (
        id SERIAL PRIMARY KEY,
        status TEXT DEFAULT 'waiting',
        fighter1_id INTEGER REFERENCES arena_fighters(id),
        fighter1_hp INTEGER,
        fighter1_x DECIMAL,
        fighter1_y DECIMAL,
        fighter2_id INTEGER REFERENCES arena_fighters(id),
        fighter2_hp INTEGER,
        fighter2_x DECIMAL,
        fighter2_y DECIMAL,
        winner_id INTEGER REFERENCES arena_fighters(id),
        total_ticks INTEGER DEFAULT 0,
        fight_log JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE
      )
    `;

    // Arena matchmaking queue table
    await sql`
      CREATE TABLE IF NOT EXISTS arena_queue (
        id SERIAL PRIMARY KEY,
        fighter_id INTEGER REFERENCES arena_fighters(id) UNIQUE,
        moltbook_post_id TEXT NOT NULL,
        queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_arena_fighters_username ON arena_fighters(moltbook_username)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_arena_matches_status ON arena_matches(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_arena_queue_time ON arena_queue(queued_at)`;

    arenaTablesInitialized = true;
    console.log("[Arena DB] Tables initialized successfully");
    return true;
  } catch (error) {
    console.error("[Arena DB] Error initializing tables:", error);
    return false;
  }
}

// ============================================
// Fighter Operations
// ============================================

export async function getFighterByUsername(username: string): Promise<ArenaFighter | null> {
  await initializeArenaTables();

  if (useMemoryStore) {
    return Array.from(memoryStore.fighters.values()).find(
      (f) => f.moltbook_username === username
    ) ?? null;
  }

  const sql = await getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      SELECT * FROM arena_fighters WHERE moltbook_username = ${username}
    `;
    if ((rows as unknown[]).length === 0) return null;
    return rows[0] as ArenaFighter;
  } catch (error) {
    console.error("[Arena DB] Error fetching fighter:", error);
    return null;
  }
}

export async function getFighterById(id: number): Promise<ArenaFighter | null> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    return memoryStore.fighters.get(id) || null;
  }

  const sql = await getSql();
  if (!sql) return null;

  try {
    const rows = await sql`SELECT * FROM arena_fighters WHERE id = ${id}`;
    if ((rows as unknown[]).length === 0) return null;
    return rows[0] as ArenaFighter;
  } catch (error) {
    console.error("[Arena DB] Error fetching fighter by id:", error);
    return null;
  }
}

export async function registerFighter(username: string, karma: number): Promise<ArenaFighter | null> {
  await initializeArenaTables();

  const stats = karmaToStats(karma);

  if (useMemoryStore) {
    const existing = Array.from(memoryStore.fighters.values()).find(
      (f) => f.moltbook_username === username
    );

    if (existing) {
      // Update existing fighter
      existing.moltbook_karma = karma;
      existing.hp = stats.hp;
      existing.attack = stats.attack;
      existing.defense = stats.defense;
      existing.karma_updated_at = new Date().toISOString();
      console.log(`[Arena DB] Updated fighter: ${username} (karma: ${karma})`);
      return existing;
    }

    // Create new fighter
    const id = memoryStore.nextFighterId++;
    const newFighter: ArenaFighter = {
      id,
      moltbook_username: username,
      moltbook_karma: karma,
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      wins: 0,
      losses: 0,
      total_damage_dealt: 0,
      total_damage_taken: 0,
      last_fight_at: null,
      registered_at: new Date().toISOString(),
      karma_updated_at: new Date().toISOString(),
    };
    memoryStore.fighters.set(id, newFighter);
    console.log(`[Arena DB] Registered new fighter: ${username} (id: ${id}, karma: ${karma})`);
    return newFighter;
  }

  const sql = await getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      INSERT INTO arena_fighters (
        moltbook_username,
        moltbook_karma,
        hp,
        attack,
        defense,
        karma_updated_at
      ) VALUES (
        ${username},
        ${karma},
        ${stats.hp},
        ${stats.attack},
        ${stats.defense},
        NOW()
      )
      ON CONFLICT (moltbook_username) DO UPDATE SET
        moltbook_karma = ${karma},
        hp = ${stats.hp},
        attack = ${stats.attack},
        defense = ${stats.defense},
        karma_updated_at = NOW()
      RETURNING *
    `;
    console.log(`[Arena DB] Registered/updated fighter: ${username} (karma: ${karma})`);
    return rows[0] as ArenaFighter;
  } catch (error) {
    console.error("[Arena DB] Error registering fighter:", error);
    return null;
  }
}

export async function updateFighterKarma(username: string, karma: number): Promise<boolean> {
  await initializeArenaTables();

  const stats = karmaToStats(karma);

  if (useMemoryStore) {
    const fighter = Array.from(memoryStore.fighters.values()).find(
      (f) => f.moltbook_username === username
    );
    if (!fighter) return false;
    fighter.moltbook_karma = karma;
    fighter.hp = stats.hp;
    fighter.attack = stats.attack;
    fighter.defense = stats.defense;
    fighter.karma_updated_at = new Date().toISOString();
    return true;
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      UPDATE arena_fighters SET
        moltbook_karma = ${karma},
        hp = ${stats.hp},
        attack = ${stats.attack},
        defense = ${stats.defense},
        karma_updated_at = NOW()
      WHERE moltbook_username = ${username}
    `;
    return true;
  } catch (error) {
    console.error("[Arena DB] Error updating fighter karma:", error);
    return false;
  }
}

export async function updateFighterStats(
  fighterId: number,
  won: boolean,
  damageDealt: number,
  damageTaken: number
): Promise<boolean> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const fighter = memoryStore.fighters.get(fighterId);
    if (!fighter) return false;

    if (won) {
      fighter.wins++;
    } else {
      fighter.losses++;
    }
    fighter.total_damage_dealt += damageDealt;
    fighter.total_damage_taken += damageTaken;
    fighter.last_fight_at = new Date().toISOString();
    return true;
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    // Use conditional increment for wins/losses
    await sql`
      UPDATE arena_fighters SET
        wins = wins + ${won ? 1 : 0},
        losses = losses + ${won ? 0 : 1},
        total_damage_dealt = total_damage_dealt + ${damageDealt},
        total_damage_taken = total_damage_taken + ${damageTaken},
        last_fight_at = NOW()
      WHERE id = ${fighterId}
    `;
    return true;
  } catch (error) {
    console.error("[Arena DB] Error updating fighter stats:", error);
    return false;
  }
}

// ============================================
// Queue Operations
// ============================================

export async function queueFighter(fighterId: number, postId: string): Promise<boolean> {
  await initializeArenaTables();

  if (useMemoryStore) {
    // Check if fighter already in queue
    const existing = Array.from(memoryStore.queue.values()).find(
      (e) => e.fighter_id === fighterId
    );

    if (existing) {
      existing.moltbook_post_id = postId;
      existing.queued_at = new Date().toISOString();
      console.log(`[Arena DB] Fighter ${fighterId} re-queued`);
      return true;
    }

    const id = memoryStore.nextQueueId++;
    memoryStore.queue.set(id, {
      id,
      fighter_id: fighterId,
      moltbook_post_id: postId,
      queued_at: new Date().toISOString(),
    });
    console.log(`[Arena DB] Fighter ${fighterId} added to queue (entry: ${id})`);
    return true;
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      INSERT INTO arena_queue (fighter_id, moltbook_post_id)
      VALUES (${fighterId}, ${postId})
      ON CONFLICT (fighter_id) DO UPDATE SET
        moltbook_post_id = ${postId},
        queued_at = NOW()
    `;
    console.log(`[Arena DB] Fighter ${fighterId} added to queue`);
    return true;
  } catch (error) {
    console.error("[Arena DB] Error queuing fighter:", error);
    return false;
  }
}

export async function removeFromQueue(fighterId: number): Promise<boolean> {
  await initializeArenaTables();

  if (useMemoryStore) {
    for (const [queueId, entry] of memoryStore.queue) {
      if (entry.fighter_id === fighterId) {
        memoryStore.queue.delete(queueId);
        break;
      }
    }
    return true; // Always true (consistent with SQL DELETE behavior)
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`DELETE FROM arena_queue WHERE fighter_id = ${fighterId}`;
    return true;
  } catch (error) {
    console.error("[Arena DB] Error removing from queue:", error);
    return false;
  }
}

export async function getQueuedFighters(): Promise<ArenaQueueEntry[]> {
  await initializeArenaTables();

  if (useMemoryStore) {
    return Array.from(memoryStore.queue.values()).sort(
      (a, b) => new Date(a.queued_at).getTime() - new Date(b.queued_at).getTime()
    );
  }

  const sql = await getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT * FROM arena_queue
      ORDER BY queued_at ASC
    `;
    return rows as ArenaQueueEntry[];
  } catch (error) {
    console.error("[Arena DB] Error fetching queue:", error);
    return [];
  }
}

export async function getQueueSize(): Promise<number> {
  await initializeArenaTables();

  if (useMemoryStore) return memoryStore.queue.size;

  const sql = await getSql();
  if (!sql) return 0;

  try {
    const rows = await sql`SELECT COUNT(*) as count FROM arena_queue`;
    const result = rows[0] as { count: string | number };
    return parseInt(String(result.count), 10);
  } catch (error) {
    console.error("[Arena DB] Error getting queue size:", error);
    return 0;
  }
}

export async function cleanupStaleQueue(maxWaitSeconds: number = 300): Promise<number> {
  await initializeArenaTables();

  if (useMemoryStore) {
    const cutoff = Date.now() - maxWaitSeconds * 1000;
    const staleIds = Array.from(memoryStore.queue.entries())
      .filter(([, entry]) => new Date(entry.queued_at).getTime() < cutoff)
      .map(([id]) => id);

    staleIds.forEach((id) => memoryStore.queue.delete(id));
    if (staleIds.length > 0) {
      console.log(`[Arena DB] Cleaned up ${staleIds.length} stale queue entries`);
    }
    return staleIds.length;
  }

  const sql = await getSql();
  if (!sql) return 0;

  try {
    const rows = await sql`
      DELETE FROM arena_queue
      WHERE queued_at < NOW() - INTERVAL '${maxWaitSeconds} seconds'
      RETURNING fighter_id
    `;
    const deleted = (rows as unknown[]).length;
    if (deleted > 0) {
      console.log(`[Arena DB] Cleaned up ${deleted} stale queue entries`);
    }
    return deleted;
  } catch (error) {
    console.error("[Arena DB] Error cleaning up queue:", error);
    return 0;
  }
}

// ============================================
// Match Operations
// ============================================

export async function createMatch(fighter1Id: number, fighter2Id: number): Promise<number | null> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const id = memoryStore.nextMatchId++;
    const now = new Date().toISOString();
    const newMatch: ArenaMatch = {
      id,
      status: "active",
      fighter1_id: fighter1Id,
      fighter1_hp: null,
      fighter1_x: null,
      fighter1_y: null,
      fighter2_id: fighter2Id,
      fighter2_hp: null,
      fighter2_x: null,
      fighter2_y: null,
      winner_id: null,
      total_ticks: 0,
      fight_log: [],
      created_at: now,
      started_at: now,
      ended_at: null,
    };
    memoryStore.matches.set(id, newMatch);
    console.log(`[Arena DB] Created match ${id}: fighter ${fighter1Id} vs ${fighter2Id}`);
    return id;
  }

  const sql = await getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      INSERT INTO arena_matches (
        status,
        fighter1_id,
        fighter2_id,
        started_at
      ) VALUES (
        'active',
        ${fighter1Id},
        ${fighter2Id},
        NOW()
      )
      RETURNING id
    `;
    const result = rows[0] as { id: number };
    console.log(`[Arena DB] Created match ${result.id}: fighter ${fighter1Id} vs ${fighter2Id}`);
    return result.id;
  } catch (error) {
    console.error("[Arena DB] Error creating match:", error);
    return null;
  }
}

export async function getMatch(matchId: number): Promise<ArenaMatch | null> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    return memoryStore.matches.get(matchId) || null;
  }

  const sql = await getSql();
  if (!sql) return null;

  try {
    const rows = await sql`SELECT * FROM arena_matches WHERE id = ${matchId}`;
    if ((rows as unknown[]).length === 0) return null;
    return parseMatchRow(rows[0] as RawMatchRow);
  } catch (error) {
    console.error("[Arena DB] Error fetching match:", error);
    return null;
  }
}

export async function getActiveMatches(): Promise<ArenaMatch[]> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const matches = Array.from(memoryStore.matches.values())
      .filter((m) => m.status === "active")
      .sort((a, b) => new Date(b.started_at || b.created_at).getTime() - new Date(a.started_at || a.created_at).getTime());
    return matches;
  }

  const sql = await getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT * FROM arena_matches
      WHERE status = 'active'
      ORDER BY started_at DESC
    `;
    return (rows as RawMatchRow[]).map(parseMatchRow);
  } catch (error) {
    console.error("[Arena DB] Error fetching active matches:", error);
    return [];
  }
}

export async function updateMatchState(
  matchId: number,
  fighter1Hp: number,
  fighter1X: number,
  fighter1Y: number,
  fighter2Hp: number,
  fighter2X: number,
  fighter2Y: number,
  totalTicks: number
): Promise<boolean> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const match = memoryStore.matches.get(matchId);
    if (!match) return false;

    match.fighter1_hp = fighter1Hp;
    match.fighter1_x = fighter1X;
    match.fighter1_y = fighter1Y;
    match.fighter2_hp = fighter2Hp;
    match.fighter2_x = fighter2X;
    match.fighter2_y = fighter2Y;
    match.total_ticks = totalTicks;
    return true;
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      UPDATE arena_matches SET
        fighter1_hp = ${fighter1Hp},
        fighter1_x = ${fighter1X},
        fighter1_y = ${fighter1Y},
        fighter2_hp = ${fighter2Hp},
        fighter2_x = ${fighter2X},
        fighter2_y = ${fighter2Y},
        total_ticks = ${totalTicks}
      WHERE id = ${matchId}
    `;
    return true;
  } catch (error) {
    console.error("[Arena DB] Error updating match state:", error);
    return false;
  }
}

export async function completeMatch(
  matchId: number,
  winnerId: number,
  totalTicks: number,
  fightLog: CombatEvent[]
): Promise<boolean> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const match = memoryStore.matches.get(matchId);
    if (!match) return false;

    match.status = "completed";
    match.winner_id = winnerId;
    match.total_ticks = totalTicks;
    match.fight_log = fightLog;
    match.ended_at = new Date().toISOString();
    console.log(`[Arena DB] Match ${matchId} completed, winner: ${winnerId}`);
    return true;
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      UPDATE arena_matches SET
        status = 'completed',
        winner_id = ${winnerId},
        total_ticks = ${totalTicks},
        fight_log = ${JSON.stringify(fightLog)}::jsonb,
        ended_at = NOW()
      WHERE id = ${matchId}
    `;
    console.log(`[Arena DB] Match ${matchId} completed, winner: ${winnerId}`);
    return true;
  } catch (error) {
    console.error("[Arena DB] Error completing match:", error);
    return false;
  }
}

export async function cancelMatch(matchId: number): Promise<boolean> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const match = memoryStore.matches.get(matchId);
    if (!match) return false;

    match.status = "cancelled";
    match.ended_at = new Date().toISOString();
    return true;
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      UPDATE arena_matches SET
        status = 'cancelled',
        ended_at = NOW()
      WHERE id = ${matchId}
    `;
    return true;
  } catch (error) {
    console.error("[Arena DB] Error cancelling match:", error);
    return false;
  }
}

export async function getRecentMatches(limit: number = 10): Promise<ArenaMatch[]> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const matches = Array.from(memoryStore.matches.values())
      .filter((m) => m.status === "completed")
      .sort((a, b) => new Date(b.ended_at || "").getTime() - new Date(a.ended_at || "").getTime())
      .slice(0, limit);
    return matches;
  }

  const sql = await getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT * FROM arena_matches
      WHERE status = 'completed'
      ORDER BY ended_at DESC
      LIMIT ${limit}
    `;
    return (rows as RawMatchRow[]).map(parseMatchRow);
  } catch (error) {
    console.error("[Arena DB] Error fetching recent matches:", error);
    return [];
  }
}

// ============================================
// Leaderboard Operations
// ============================================

export async function getLeaderboard(limit: number = 20): Promise<ArenaLeaderboardEntry[]> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const fighters = Array.from(memoryStore.fighters.values())
      .filter((f) => f.wins + f.losses > 0)
      .map((f) => ({
        id: f.id,
        moltbook_username: f.moltbook_username,
        wins: f.wins,
        losses: f.losses,
        win_rate: f.wins + f.losses > 0 ? Math.round((f.wins / (f.wins + f.losses)) * 1000) / 10 : 0,
        total_damage_dealt: f.total_damage_dealt,
        moltbook_karma: f.moltbook_karma,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
        return b.total_damage_dealt - a.total_damage_dealt;
      })
      .slice(0, limit);
    return fighters;
  }

  const sql = await getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT
        id,
        moltbook_username,
        wins,
        losses,
        CASE WHEN (wins + losses) > 0
          THEN ROUND(wins::decimal / (wins + losses) * 100, 1)
          ELSE 0
        END as win_rate,
        total_damage_dealt,
        moltbook_karma
      FROM arena_fighters
      WHERE (wins + losses) > 0
      ORDER BY wins DESC, win_rate DESC, total_damage_dealt DESC
      LIMIT ${limit}
    `;
    return (rows as unknown[]).map((row) => {
      const r = row as {
        id: number;
        moltbook_username: string;
        wins: number;
        losses: number;
        win_rate: string | number;
        total_damage_dealt: string | number;
        moltbook_karma: number;
      };
      return {
        id: r.id,
        moltbook_username: r.moltbook_username,
        wins: r.wins,
        losses: r.losses,
        win_rate: parseFloat(String(r.win_rate)),
        total_damage_dealt: parseInt(String(r.total_damage_dealt), 10),
        moltbook_karma: r.moltbook_karma,
      };
    });
  } catch (error) {
    console.error("[Arena DB] Error fetching leaderboard:", error);
    return [];
  }
}

export async function getFighterRank(fighterId: number): Promise<number | null> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const leaderboard = await getLeaderboard(1000);
    const rank = leaderboard.findIndex((f) => f.id === fighterId);
    return rank >= 0 ? rank + 1 : null;
  }

  const sql = await getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      SELECT rank FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY wins DESC,
            CASE WHEN (wins + losses) > 0
              THEN wins::decimal / (wins + losses)
              ELSE 0
            END DESC,
            total_damage_dealt DESC
          ) as rank
        FROM arena_fighters
        WHERE (wins + losses) > 0
      ) ranked
      WHERE id = ${fighterId}
    `;
    if ((rows as unknown[]).length === 0) return null;
    const result = rows[0] as { rank: string | number };
    return parseInt(String(result.rank), 10);
  } catch (error) {
    console.error("[Arena DB] Error getting fighter rank:", error);
    return null;
  }
}

// ============================================
// Utility Operations
// ============================================

export async function isArenaConfigured(): Promise<boolean> {
  await initializeArenaTables();
  // Return true if we have either a database or in-memory store
  return useMemoryStore || (await getSql()) !== null;
}

export async function getArenaStats(): Promise<{
  totalFighters: number;
  totalMatches: number;
  activeMatches: number;
  queueSize: number;
} | null> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const activeMatches = Array.from(memoryStore.matches.values())
      .filter((m) => m.status === "active").length;
    return {
      totalFighters: memoryStore.fighters.size,
      totalMatches: memoryStore.matches.size,
      activeMatches,
      queueSize: memoryStore.queue.size,
    };
  }

  const sql = await getSql();
  if (!sql) return null;

  try {
    const fightersResult = await sql`SELECT COUNT(*) as count FROM arena_fighters`;
    const matchesResult = await sql`SELECT COUNT(*) as count FROM arena_matches`;
    const activeResult = await sql`SELECT COUNT(*) as count FROM arena_matches WHERE status = 'active'`;
    const queueResult = await sql`SELECT COUNT(*) as count FROM arena_queue`;

    return {
      totalFighters: parseInt(String((fightersResult[0] as { count: string | number }).count), 10),
      totalMatches: parseInt(String((matchesResult[0] as { count: string | number }).count), 10),
      activeMatches: parseInt(String((activeResult[0] as { count: string | number }).count), 10),
      queueSize: parseInt(String((queueResult[0] as { count: string | number }).count), 10),
    };
  } catch (error) {
    console.error("[Arena DB] Error getting arena stats:", error);
    return null;
  }
}

// Fighter cooldown check (5 min between fights)
export async function canFighterEnterQueue(fighterId: number, cooldownSeconds: number = 300): Promise<boolean> {
  await initializeArenaTables();

  // In-memory mode
  if (useMemoryStore) {
    const fighter = memoryStore.fighters.get(fighterId);
    if (!fighter) return false;

    if (!fighter.last_fight_at) return true;

    const lastFight = new Date(fighter.last_fight_at).getTime();
    const cooldownMs = cooldownSeconds * 1000;
    return Date.now() - lastFight >= cooldownMs;
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    const rows = await sql`
      SELECT last_fight_at FROM arena_fighters
      WHERE id = ${fighterId}
        AND (last_fight_at IS NULL OR last_fight_at < NOW() - INTERVAL '${cooldownSeconds} seconds')
    `;
    return (rows as unknown[]).length > 0;
  } catch (error) {
    console.error("[Arena DB] Error checking fighter cooldown:", error);
    return false;
  }
}
