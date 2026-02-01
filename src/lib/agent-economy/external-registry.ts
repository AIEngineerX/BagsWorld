// External Agent Registry
// Persistent registry for external agents that join BagsWorld
// Uses Neon PostgreSQL for persistence across serverless instances

import { neon } from "@neondatabase/serverless";
import type { GameCharacter, ZoneType } from "../types";

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
      zone TEXT NOT NULL DEFAULT 'main_city',
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
}

// ============================================================================
// HELPERS
// ============================================================================

function getZonePosition(zone: ZoneType): { x: number; y: number } {
  const zonePositions: Record<ZoneType, { x: number; y: number }> = {
    main_city: { x: 300 + Math.random() * 200, y: 400 + Math.random() * 50 },
    trending: { x: 250 + Math.random() * 200, y: 480 + Math.random() * 50 },
    labs: { x: 350 + Math.random() * 150, y: 390 + Math.random() * 40 },
    founders: { x: 400 + Math.random() * 150, y: 400 + Math.random() * 40 },
    ballers: { x: 500 + Math.random() * 150, y: 360 + Math.random() * 40 },
    arena: { x: 400 + Math.random() * 100, y: 450 },
  };
  return zonePositions[zone] || zonePositions.main_city;
}

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

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Register an external agent in the world
 */
export async function registerExternalAgent(
  wallet: string,
  name: string,
  zone: ZoneType = "main_city",
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

// ============================================================================
// SYNC VERSIONS (for world-state which needs sync calls)
// Uses in-memory cache refreshed periodically
// ============================================================================

let cachedAgents: GameCharacter[] = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

/**
 * Sync version for world-state - uses cached data
 */
export function getExternalAgentCharactersSync(): GameCharacter[] {
  // Trigger async refresh if stale
  if (Date.now() - lastCacheTime > CACHE_TTL_MS) {
    refreshCache();
  }
  return cachedAgents;
}

async function refreshCache() {
  try {
    cachedAgents = await getExternalAgentCharacters();
    lastCacheTime = Date.now();
  } catch (err) {
    console.error("[ExternalRegistry] Cache refresh failed:", err);
  }
}

// Initial cache load
refreshCache();
