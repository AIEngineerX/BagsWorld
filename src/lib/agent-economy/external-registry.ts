// External Agent Registry
// Persistent registry for external agents that join BagsWorld
// Uses Neon PostgreSQL for persistence across serverless instances

import { neon } from "@neondatabase/serverless";
import type {
  GameCharacter,
  GameBuilding,
  ZoneType,
  CapabilityEntry,
  AgentCapability,
} from "../types";

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

// Initialize table (called on first use)
let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;

  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS external_agents (
      wallet TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      moltbook_username TEXT,
      zone TEXT NOT NULL DEFAULT 'moltbook',
      x REAL NOT NULL,
      y REAL NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Add moltbook_username column if it doesn't exist (migration)
  try {
    await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS moltbook_username TEXT`;
  } catch {
    // Column might already exist, ignore
  }

  // Add last_active_at column for building lifecycle tracking (migration)
  try {
    await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW()`;
  } catch {
    // Column might already exist, ignore
  }

  // Add capabilities column for A2A service registry (migration)
  try {
    await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb`;
    await sql`CREATE INDEX IF NOT EXISTS idx_external_agents_capabilities ON external_agents USING GIN (capabilities)`;
  } catch {
    // Column/index might already exist, ignore
  }

  // Add reputation system columns (migration)
  try {
    await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS moltbook_karma INTEGER DEFAULT 0`;
    await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS tokens_launched INTEGER DEFAULT 0`;
    await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS total_fees_earned_lamports BIGINT DEFAULT 0`;
    await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0`;
    await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS karma_fetched_at TIMESTAMPTZ`;
  } catch {
    // Columns might already exist, ignore
  }

  tableInitialized = true;
  console.log("[ExternalRegistry] Table initialized");
}

// ============================================================================
// TYPES
// ============================================================================

interface ExternalAgentEntry {
  wallet: string;
  name: string;
  description?: string;
  zone: ZoneType;
  joinedAt: Date;
  character: GameCharacter;
}

interface DbRow {
  wallet: string;
  name: string;
  description: string | null;
  moltbook_username: string | null;
  zone: string;
  x: number;
  y: number;
  joined_at: Date;
  last_active_at: Date | null;
  moltbook_karma: number | null;
  tokens_launched: number | null;
  total_fees_earned_lamports: string | null; // BIGINT returned as string by Neon
  reputation_score: number | null;
  karma_fetched_at: Date | null;
  capabilities: CapabilityEntry[] | null; // JSONB - A2A capabilities
}

// ============================================================================
// HELPERS
// ============================================================================

// Scale factor must match WorldScene and world-calculator
const SCALE = 1.6;
const GROUND_Y = Math.round(550 * SCALE); // 880 - same as other characters

function getZonePosition(zone: ZoneType): { x: number; y: number } {
  // X positions are already scaled in world-calculator, Y is ground level with slight variation
  const yVariation = Math.round(15 * SCALE); // Same variation as generateCharacterPosition
  const zonePositions: Record<ZoneType, { x: number; y: number }> = {
    moltbook: {
      x: Math.round((200 + Math.random() * 300) * SCALE),
      y: GROUND_Y + Math.random() * yVariation,
    },
    main_city: {
      x: Math.round((300 + Math.random() * 200) * SCALE),
      y: GROUND_Y + Math.random() * yVariation,
    },
    trending: {
      x: Math.round((250 + Math.random() * 200) * SCALE),
      y: GROUND_Y + Math.random() * yVariation,
    },
    labs: {
      x: Math.round((350 + Math.random() * 150) * SCALE),
      y: GROUND_Y + Math.random() * yVariation,
    },
    founders: {
      x: Math.round((400 + Math.random() * 150) * SCALE),
      y: GROUND_Y + Math.random() * yVariation,
    },
    ballers: {
      x: Math.round((500 + Math.random() * 150) * SCALE),
      y: GROUND_Y + Math.random() * yVariation,
    },
    arena: { x: Math.round((400 + Math.random() * 100) * SCALE), y: GROUND_Y },
    dungeon: { x: Math.round((400 + Math.random() * 100) * SCALE), y: GROUND_Y },
  };
  return zonePositions[zone] || zonePositions.moltbook;
}

// Building position offset from character (building appears behind/near character)
const BUILDING_OFFSET_X = Math.round(30 * SCALE);

function rowToEntry(row: DbRow): ExternalAgentEntry {
  // Use Moltbook username if available, otherwise truncated wallet
  const moltbookUser = row.moltbook_username;
  const providerUsername = moltbookUser || row.wallet.slice(0, 8) + "...";

  const character: GameCharacter = {
    id: `external-${row.wallet.slice(0, 8)}`,
    username: row.name,
    provider: moltbookUser ? "moltbook" : "external",
    providerUsername: providerUsername,
    // Link to Moltbook profile if username is set
    profileUrl: moltbookUser ? `https://moltbook.com/u/${moltbookUser}` : undefined,
    x: row.x,
    y: row.y,
    mood: "neutral",
    earnings24h: 0,
    direction: Math.random() > 0.5 ? "left" : "right",
    isMoving: false,
    zone: row.zone as ZoneType,
    moltbookKarma: row.moltbook_karma ?? undefined,
    reputationScore: row.reputation_score ?? undefined,
    tokensLaunched: row.tokens_launched ?? undefined,
    capabilities: row.capabilities
      ? (row.capabilities as CapabilityEntry[]).map((c) => c.capability)
      : undefined,
  };

  return {
    wallet: row.wallet,
    name: row.name,
    description: row.description || undefined,
    zone: row.zone as ZoneType,
    joinedAt: new Date(row.joined_at),
    character,
  };
}

// Moltbook HQ is at x = 640 (400 * 1.6), avoid placing buildings there
const HQ_CENTER_X = Math.round(400 * SCALE); // 640
const HQ_AVOID_RADIUS = Math.round(100 * SCALE); // 160px radius to avoid

/**
 * Get a building position that avoids the HQ area
 * Buildings are spread across left and right sides of the zone
 */
function getBuildingPosition(index: number, zone: ZoneType): number {
  if (zone === "moltbook") {
    // Moltbook zone: place buildings on left or right side, avoiding HQ center
    const leftPositions = [
      Math.round(100 * SCALE), // 160
      Math.round(180 * SCALE), // 288
      Math.round(260 * SCALE), // 416
    ];
    const rightPositions = [
      Math.round(540 * SCALE), // 864
      Math.round(620 * SCALE), // 992
      Math.round(700 * SCALE), // 1120
    ];
    const allPositions = [...leftPositions, ...rightPositions];
    return allPositions[index % allPositions.length];
  }
  // Default: use character position with offset
  return Math.round((200 + index * 100) * SCALE);
}

// Activity-based health tiers for agent buildings
// Agents that interact with BagsWorld APIs stay healthy, inactive ones decay visually
const AGENT_ACTIVITY_TIERS = [
  { maxAgeMs: 6 * 60 * 60 * 1000, health: 100, status: "active" as const }, // < 6 hours
  { maxAgeMs: 24 * 60 * 60 * 1000, health: 75, status: "active" as const }, // < 24 hours
  { maxAgeMs: 7 * 24 * 60 * 60 * 1000, health: 50, status: "warning" as const }, // < 7 days
  { maxAgeMs: 30 * 24 * 60 * 60 * 1000, health: 25, status: "critical" as const }, // < 30 days
] as const;
const AGENT_DORMANT_HEALTH = 12; // 30+ days inactive - dormant but never removed

export function getAgentBuildingHealth(lastActiveAt: Date | null): {
  health: number;
  status: "active" | "warning" | "critical" | "dormant";
} {
  if (!lastActiveAt) {
    // No activity data yet (pre-migration rows) - treat as recently active
    return { health: 100, status: "active" };
  }

  const ageMs = Date.now() - lastActiveAt.getTime();

  for (const tier of AGENT_ACTIVITY_TIERS) {
    if (ageMs < tier.maxAgeMs) {
      return { health: tier.health, status: tier.status };
    }
  }

  // 30+ days inactive
  return { health: AGENT_DORMANT_HEALTH, status: "dormant" };
}

/**
 * Create an agent building for an external agent
 * Agent buildings are persistent structures whose visual state reflects agent activity.
 * Health is computed from last_active_at - active agents glow, dormant agents fade.
 * @param row - Database row for the agent
 * @param index - Position index for building placement (avoids shared mutable state)
 */
function rowToBuilding(row: DbRow, index: number): GameBuilding {
  const moltbookUser = row.moltbook_username;
  const isMoltbookZone = row.zone === "moltbook";

  // Get position avoiding HQ
  const buildingX = isMoltbookZone
    ? getBuildingPosition(index, row.zone as ZoneType)
    : row.x + BUILDING_OFFSET_X;

  // Compute health from activity recency
  const { health, status } = getAgentBuildingHealth(row.last_active_at);

  return {
    id: `agent-building-${row.wallet.slice(0, 8)}`,
    tokenMint: `agent-${row.wallet}`, // Fake mint for agent buildings
    name: `${row.name}'s HQ`,
    symbol: moltbookUser ? `@${moltbookUser}` : row.name.slice(0, 4).toUpperCase(),
    x: buildingX,
    y: GROUND_Y, // Same ground level as token buildings
    level: 1, // Agent buildings are small (level 1)
    health,
    status,
    glowing: health >= 75, // Only glow when recently active
    ownerId: row.wallet,
    zone: row.zone as ZoneType,
    isPermanent: true, // Agent buildings are never removed (but they DO visually decay)
    // Beach-themed buildings for moltbook zone
    styleOverride: isMoltbookZone ? -1 : 0, // -1 signals beach theme
    isBeachTheme: isMoltbookZone, // Custom flag for beach building rendering
    lastActiveAt: row.last_active_at ? row.last_active_at.toISOString() : undefined,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Register an external agent in the world
 */
export async function registerExternalAgent(
  wallet: string,
  name: string,
  zone: ZoneType = "moltbook",
  description?: string,
  moltbookUsername?: string
): Promise<ExternalAgentEntry> {
  await ensureTable();
  const sql = getDb();

  // Check if already exists
  const existing = await sql`
    SELECT * FROM external_agents WHERE wallet = ${wallet}
  `;

  if (existing.length > 0) {
    return rowToEntry(existing[0] as DbRow);
  }

  // Create new
  const pos = getZonePosition(zone);

  await sql`
    INSERT INTO external_agents (wallet, name, description, moltbook_username, zone, x, y)
    VALUES (${wallet}, ${name}, ${description || null}, ${moltbookUsername || null}, ${zone}, ${pos.x}, ${pos.y})
  `;

  const moltLink = moltbookUsername ? ` → moltbook.com/u/${moltbookUsername}` : "";
  console.log(
    `[ExternalRegistry] Agent ${name} (${wallet.slice(0, 8)}...) joined in ${zone}${moltLink}`
  );

  const created = await sql`
    SELECT * FROM external_agents WHERE wallet = ${wallet}
  `;

  return rowToEntry(created[0] as DbRow);
}

/**
 * Remove an external agent from the world
 */
export async function unregisterExternalAgent(wallet: string): Promise<boolean> {
  await ensureTable();
  const sql = getDb();

  const result = await sql`
    DELETE FROM external_agents WHERE wallet = ${wallet}
    RETURNING wallet
  `;

  if (result.length > 0) {
    console.log(`[ExternalRegistry] Agent ${wallet.slice(0, 8)}... left the world`);
    return true;
  }
  return false;
}

/**
 * Get an external agent by wallet
 */
export async function getExternalAgent(wallet: string): Promise<ExternalAgentEntry | null> {
  await ensureTable();
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM external_agents WHERE wallet = ${wallet}
  `;

  if (rows.length === 0) return null;
  return rowToEntry(rows[0] as DbRow);
}

/**
 * Get all external agent characters for world state
 */
export async function getExternalAgentCharacters(): Promise<GameCharacter[]> {
  await ensureTable();
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM external_agents ORDER BY joined_at DESC
  `;

  return rows.map((row) => rowToEntry(row as DbRow).character);
}

/**
 * Get all external agent buildings for world state
 */
export async function getExternalAgentBuildings(): Promise<GameBuilding[]> {
  await ensureTable();
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM external_agents ORDER BY joined_at DESC
  `;

  return rows.map((row, index) => rowToBuilding(row as DbRow, index));
}

/**
 * Get all external agents
 */
export async function listExternalAgents(): Promise<ExternalAgentEntry[]> {
  await ensureTable();
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM external_agents ORDER BY joined_at DESC
  `;

  return rows.map((row) => rowToEntry(row as DbRow));
}

/**
 * Get count of external agents
 */
export async function getExternalAgentCount(): Promise<number> {
  await ensureTable();
  const sql = getDb();

  const result = await sql`
    SELECT COUNT(*) as count FROM external_agents
  `;

  return parseInt((result[0] as { count: string })?.count || "0", 10);
}

/**
 * Update external agent's zone
 */
export async function moveExternalAgent(wallet: string, newZone: ZoneType): Promise<boolean> {
  await ensureTable();
  const sql = getDb();

  const pos = getZonePosition(newZone);

  const result = await sql`
    UPDATE external_agents 
    SET zone = ${newZone}, x = ${pos.x}, y = ${pos.y}
    WHERE wallet = ${wallet}
    RETURNING wallet
  `;

  return result.length > 0;
}

/**
 * Touch an agent's last_active_at timestamp to keep their building alive.
 * Called when an agent interacts with any BagsWorld API (join, launch, claim, etc.)
 * Uses fire-and-forget pattern - never blocks the caller.
 */
export function touchExternalAgent(wallet: string): void {
  // Fire and forget - don't await, don't block
  (async () => {
    const sql = getDb();
    await sql`
      UPDATE external_agents
      SET last_active_at = NOW()
      WHERE wallet = ${wallet}
    `;
  })().catch((err) => {
    console.error("[ExternalRegistry] Failed to touch agent activity:", err);
  });
}

// ============================================================================
// SYNC VERSIONS (for world-state which needs sync calls)
// Uses in-memory cache refreshed periodically
// ============================================================================

let cachedAgents: GameCharacter[] = [];
let cachedBuildings: GameBuilding[] = [];
let lastCacheTime = 0;
let refreshInProgress: Promise<void> | null = null;
const CACHE_TTL_MS = 10000; // 10 seconds

/**
 * Sync version for world-state - uses cached data (characters)
 */
export function getExternalAgentCharactersSync(): GameCharacter[] {
  // Trigger async refresh if stale (deduplicated)
  if (Date.now() - lastCacheTime > CACHE_TTL_MS) {
    refreshCache();
  }
  return cachedAgents;
}

/**
 * Sync version for world-state - uses cached data (buildings)
 */
export function getExternalAgentBuildingsSync(): GameBuilding[] {
  // Trigger async refresh if stale (deduplicated)
  if (Date.now() - lastCacheTime > CACHE_TTL_MS) {
    refreshCache();
  }
  return cachedBuildings;
}

async function refreshCache() {
  // Deduplicate: if a refresh is already in progress, return that promise
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    try {
      const sql = getDb();
      const rows = await sql`
        SELECT * FROM external_agents ORDER BY joined_at DESC
      `;

      cachedAgents = rows.map((row) => rowToEntry(row as DbRow).character);
      cachedBuildings = rows.map((row, index) => rowToBuilding(row as DbRow, index));
      lastCacheTime = Date.now();
    } catch (err) {
      console.error("[ExternalRegistry] Cache refresh failed:", err);
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}

// Initial cache load
refreshCache();
