// Neon database client for shared global state
// Supports both:
// 1. Netlify's built-in Neon integration (@netlify/neon with NETLIFY_DATABASE_URL)
// 2. Direct Neon connection (@neondatabase/serverless with DATABASE_URL)

import { neon as neonServerless } from "@neondatabase/serverless";

// Database types
export interface GlobalToken {
  id?: number;
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_url?: string;
  creator_wallet: string;
  created_at?: string;
  fee_shares?: Array<{
    provider: string;
    username: string;
    bps: number;
  }>;
  // Live data from Bags SDK
  lifetime_fees?: number;
  market_cap?: number;
  volume_24h?: number;
  last_updated?: string;
  // Metadata
  is_featured?: boolean;
  is_verified?: boolean;
  // Admin controls
  level_override?: number | null; // Admin override for building level (1-5)
  position_x?: number | null; // X coordinate override
  position_y?: number | null; // Y coordinate override
  style_override?: number | null; // Building style (0-3)
  health_override?: number | null; // Health override (0-100)
  zone_override?: string | null; // Zone override (main_city, trending, ballers, founders, labs)
  // Building decay system - computed health that persists across serverless instances
  current_health?: number | null; // Computed health (0-100), decays over time
  health_updated_at?: string | null; // Last time health was calculated (ISO timestamp)
}

// Check if Neon is configured (either Netlify integration or direct DATABASE_URL)
export function isNeonConfigured(): boolean {
  // Check multiple possible env var names
  return !!(
    process.env.NETLIFY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL
  );
}

// Get which connection method is being used
export function getNeonConnectionType(): "netlify" | "direct" | "none" {
  if (process.env.NETLIFY_DATABASE_URL) return "netlify";
  if (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL)
    return "direct";
  return "none";
}

// SQL tagged template function type
type SqlFunction = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

// Safe parseInt with NaN fallback
function safeParseInt(value: string | number | null | undefined, fallback: number = 0): number {
  const parsed = parseInt(String(value ?? fallback), 10);
  return isNaN(parsed) ? fallback : parsed;
}

// Safe parseFloat with NaN fallback
function safeParseFloat(value: string | number | null | undefined, fallback: number = 0): number {
  const parsed = parseFloat(String(value ?? fallback));
  return isNaN(parsed) ? fallback : parsed;
}

// Dynamically get SQL client
async function getSql(): Promise<SqlFunction | null> {
  // Try Netlify's built-in Neon first (auto-configured)
  if (process.env.NETLIFY_DATABASE_URL) {
    try {
      // Use string variable to prevent webpack from analyzing the import
      const moduleName = "@netlify/neon";
      // eslint-disable-next-line
      const { neon } = require(moduleName);
      return neon();
    } catch {
      // Netlify Neon module not available, try direct connection
    }
  }

  // Fall back to direct Neon connection with DATABASE_URL (check multiple env var names)
  const directUrl =
    process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
  if (directUrl) {
    try {
      const sql = neonServerless(directUrl);
      return sql as unknown as SqlFunction;
    } catch (error) {
      console.error("[Neon] Failed to connect with direct URL:", error);
      return null;
    }
  }

  return null;
}

// Initialize database tables if they don't exist
export async function initializeDatabase(): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    // Create tokens table
    await sql`
      CREATE TABLE IF NOT EXISTS tokens (
        id SERIAL PRIMARY KEY,
        mint TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        creator_wallet TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        fee_shares JSONB DEFAULT '[]',
        lifetime_fees DECIMAL DEFAULT 0,
        market_cap DECIMAL DEFAULT 0,
        volume_24h DECIMAL DEFAULT 0,
        last_updated TIMESTAMP WITH TIME ZONE,
        is_featured BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        level_override INTEGER
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_tokens_mint ON tokens(mint)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tokens_featured ON tokens(is_featured)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens(created_at DESC)`;

    // Add building management columns (migration)
    await sql`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS position_x DECIMAL`;
    await sql`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS position_y DECIMAL`;
    await sql`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS style_override INTEGER`;
    await sql`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS health_override INTEGER`;

    // Add building decay system columns (migration)
    // current_health: Computed health that decays over time (0-100)
    // health_updated_at: Timestamp of last health calculation for time-based decay
    await sql`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS current_health INTEGER DEFAULT 50`;
    await sql`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS health_updated_at TIMESTAMP WITH TIME ZONE`;

    // Add zone override column (migration)
    // zone_override: Admin can override automatic zone assignment
    // Valid values: main_city, trending, ballers, founders, labs, or NULL for auto
    await sql`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS zone_override TEXT`;

    return true;
  } catch (error) {
    console.error("[Neon] Error initializing database:", error);
    return false;
  }
}

// Decay threshold - buildings with health <= this are hidden
const DECAY_REMOVE_THRESHOLD = 10;

// Fetch all global tokens (visible to everyone)
// Filters out decayed buildings (health <= 10)
export async function getGlobalTokens(): Promise<GlobalToken[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    // First ensure tables exist
    await initializeDatabase();
    // Only return tokens with health above decay threshold
    // NULL health means new token (not yet processed), so include those
    const rows = await sql`
      SELECT * FROM tokens
      WHERE current_health IS NULL OR current_health > ${DECAY_REMOVE_THRESHOLD}
      ORDER BY created_at DESC
    `;
    return rows as GlobalToken[];
  } catch (error) {
    console.error("[Neon] Error fetching global tokens:", error);
    throw error; // Re-throw to see full error in status endpoint
  }
}

// Save a token to the global database
export async function saveGlobalToken(token: GlobalToken): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    // Ensure tables exist
    await initializeDatabase();

    // Prepare fee_shares as JSON string for JSONB column
    const feeSharesJson = token.fee_shares ? JSON.stringify(token.fee_shares) : "[]";

    // Check if token already exists
    const existing = await sql`SELECT id, creator_wallet FROM tokens WHERE mint = ${token.mint}`;

    if ((existing as unknown[]).length > 0) {
      // Update existing token - INCLUDE creator_wallet in case it was missing
      await sql`
        UPDATE tokens SET
          name = ${token.name},
          symbol = ${token.symbol},
          description = ${token.description || null},
          image_url = ${token.image_url || null},
          creator_wallet = COALESCE(${token.creator_wallet}, creator_wallet),
          fee_shares = ${feeSharesJson}::jsonb,
          lifetime_fees = ${token.lifetime_fees || null},
          market_cap = ${token.market_cap || null},
          volume_24h = ${token.volume_24h || null},
          last_updated = NOW()
        WHERE mint = ${token.mint}
      `;
    } else {
      // Insert new token
      await sql`
        INSERT INTO tokens (
          mint, name, symbol, description, image_url,
          creator_wallet, fee_shares, lifetime_fees, market_cap,
          volume_24h, is_featured, is_verified
        ) VALUES (
          ${token.mint},
          ${token.name},
          ${token.symbol},
          ${token.description || null},
          ${token.image_url || null},
          ${token.creator_wallet},
          ${feeSharesJson}::jsonb,
          ${token.lifetime_fees || null},
          ${token.market_cap || null},
          ${token.volume_24h || null},
          false,
          false
        )
      `;
    }
    return true;
  } catch {
    return false;
  }
}

// Get featured tokens only
export async function getFeaturedTokens(): Promise<GlobalToken[]> {
  const sql = await getSql();
  if (!sql) {
    return [];
  }

  try {
    const rows = await sql`
      SELECT * FROM tokens
      WHERE is_featured = true
      ORDER BY market_cap DESC
    `;
    return rows as GlobalToken[];
  } catch (error) {
    console.error("Error fetching featured tokens:", error);
    return [];
  }
}

// Update token stats (called by world-state API)
export async function updateTokenStats(
  mint: string,
  stats: {
    lifetime_fees?: number;
    market_cap?: number;
    volume_24h?: number;
  }
): Promise<void> {
  const sql = await getSql();
  if (!sql) return;

  try {
    await sql`
      UPDATE tokens SET
        lifetime_fees = COALESCE(${stats.lifetime_fees || null}, lifetime_fees),
        market_cap = COALESCE(${stats.market_cap || null}, market_cap),
        volume_24h = COALESCE(${stats.volume_24h || null}, volume_24h),
        last_updated = NOW()
      WHERE mint = ${mint}
    `;
  } catch (error) {
    console.error("Error updating token stats:", error);
  }
}

// ============================================
// Building Health Persistence (Decay System)
// ============================================

export interface BuildingHealthUpdate {
  mint: string;
  health: number;
}

/**
 * Update building health for a single token.
 * Only updates if health has changed to minimize DB writes.
 */
export async function updateBuildingHealth(mint: string, health: number): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      UPDATE tokens SET
        current_health = ${health},
        health_updated_at = NOW()
      WHERE mint = ${mint}
    `;
    return true;
  } catch (error) {
    console.error("[Neon] Error updating building health:", error);
    return false;
  }
}

/**
 * Batch update building health for multiple tokens.
 * Only updates tokens where health has actually changed.
 * Uses a single query for efficiency.
 */
export async function batchUpdateBuildingHealth(
  updates: BuildingHealthUpdate[]
): Promise<{ updated: number; failed: number }> {
  const sql = await getSql();
  if (!sql) return { updated: 0, failed: 0 };

  if (updates.length === 0) return { updated: 0, failed: 0 };

  let updated = 0;
  let failed = 0;

  try {
    // For small batches, individual updates are fine and simpler
    // For larger batches, we could use a CTE but this is clearer
    for (const update of updates) {
      try {
        await sql`
          UPDATE tokens SET
            current_health = ${update.health},
            health_updated_at = NOW()
          WHERE mint = ${update.mint}
            AND (current_health IS NULL OR current_health != ${update.health})
        `;
        updated++;
      } catch {
        failed++;
      }
    }

    if (updated > 0) {
      console.log(`[Neon] Updated health for ${updated} buildings`);
    }

    return { updated, failed };
  } catch (error) {
    console.error("[Neon] Error in batch health update:", error);
    return { updated, failed: updates.length };
  }
}

/**
 * Get building health data for specific mints.
 * Returns a map of mint -> { health, updatedAt }
 */
export async function getBuildingHealthData(
  mints: string[]
): Promise<Map<string, { health: number; updatedAt: Date | null }>> {
  const sql = await getSql();
  const result = new Map<string, { health: number; updatedAt: Date | null }>();

  if (!sql || mints.length === 0) return result;

  try {
    // Fetch health data for all requested mints
    const rows = await sql`
      SELECT mint, current_health, health_updated_at
      FROM tokens
      WHERE mint = ANY(${mints})
    `;

    for (const row of rows as Array<{
      mint: string;
      current_health: number | null;
      health_updated_at: string | null;
    }>) {
      result.set(row.mint, {
        health: row.current_health ?? 50, // Default to 50 if null
        updatedAt: row.health_updated_at ? new Date(row.health_updated_at) : null,
      });
    }

    return result;
  } catch (error) {
    console.error("[Neon] Error fetching building health data:", error);
    return result;
  }
}

// ============================================
// Creator Rewards State Persistence
// ============================================

export interface RewardsStateRecord {
  id?: number;
  cycle_start_time: number;
  total_distributed: number;
  distribution_count: number;
  last_distribution: number;
  recent_distributions: Array<{
    timestamp: number;
    totalDistributed: number;
    recipients: Array<{
      wallet: string;
      tokenSymbol: string;
      amount: number;
      rank: number;
    }>;
  }>;
  updated_at?: string;
}

// Initialize rewards state table
export async function initializeRewardsTable(): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS rewards_state (
        id SERIAL PRIMARY KEY,
        cycle_start_time BIGINT NOT NULL,
        total_distributed DECIMAL DEFAULT 0,
        distribution_count INTEGER DEFAULT 0,
        last_distribution BIGINT DEFAULT 0,
        recent_distributions JSONB DEFAULT '[]',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Ensure there's at least one row
    const existing = await sql`SELECT id FROM rewards_state LIMIT 1`;
    if ((existing as unknown[]).length === 0) {
      await sql`
        INSERT INTO rewards_state (cycle_start_time, total_distributed, distribution_count, last_distribution, recent_distributions)
        VALUES (${Date.now()}, 0, 0, 0, '[]')
      `;
    }
    return true;
  } catch {
    return false;
  }
}

// Get persisted rewards state
export async function getRewardsState(): Promise<RewardsStateRecord | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    // Initialize table if needed
    await initializeRewardsTable();

    const result = await sql`
      SELECT * FROM rewards_state ORDER BY id DESC LIMIT 1
    `;

    if ((result as unknown[]).length === 0) return null;

    const row = (result as Array<Record<string, unknown>>)[0];
    return {
      id: row.id as number,
      cycle_start_time: safeParseInt(row.cycle_start_time as string, Date.now()),
      total_distributed: safeParseFloat(row.total_distributed as string, 0),
      distribution_count: safeParseInt(row.distribution_count as string, 0),
      last_distribution: safeParseInt(row.last_distribution as string, 0),
      recent_distributions:
        (row.recent_distributions as RewardsStateRecord["recent_distributions"]) || [],
      updated_at: row.updated_at as string,
    };
  } catch (error) {
    console.error("Error getting rewards state:", error);
    return null;
  }
}

// Save rewards state
export async function saveRewardsState(
  state: Omit<RewardsStateRecord, "id" | "updated_at">
): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    // Ensure table exists
    await initializeRewardsTable();

    // Check if a row exists
    const existing = await sql`SELECT id FROM rewards_state LIMIT 1`;

    if ((existing as unknown[]).length === 0) {
      // Insert new row
      await sql`
        INSERT INTO rewards_state (cycle_start_time, total_distributed, distribution_count, last_distribution, recent_distributions)
        VALUES (${state.cycle_start_time}, ${state.total_distributed}, ${state.distribution_count}, ${state.last_distribution}, ${JSON.stringify(state.recent_distributions)})
      `;
    } else {
      // Update existing row
      await sql`
        UPDATE rewards_state SET
          cycle_start_time = ${state.cycle_start_time},
          total_distributed = ${state.total_distributed},
          distribution_count = ${state.distribution_count},
          last_distribution = ${state.last_distribution},
          recent_distributions = ${JSON.stringify(state.recent_distributions)},
          updated_at = NOW()
        WHERE id = (SELECT id FROM rewards_state ORDER BY id DESC LIMIT 1)
      `;
    }

    return true;
  } catch (error) {
    console.error("Error saving rewards state:", error);
    return false;
  }
}

// Reset cycle (called after distribution)
export async function resetRewardsCycle(): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      UPDATE rewards_state SET
        cycle_start_time = ${Date.now()},
        updated_at = NOW()
      WHERE id = (SELECT id FROM rewards_state ORDER BY id DESC LIMIT 1)
    `;

    return true;
  } catch (error) {
    console.error("Error resetting rewards cycle:", error);
    return false;
  }
}

// ============================================
// Casino Functions
// ============================================

// Admin wallet for casino operations
const CASINO_ADMIN_WALLET = "7BAHgz9Q2ubiTaVo9sCy5AdDvNMiJaK8FebGHTM3PEwm";

export function getCasinoAdminWallet(): string {
  return CASINO_ADMIN_WALLET;
}

export interface CasinoRaffle {
  id: number;
  status: "active" | "paused" | "drawing" | "completed";
  potLamports: number;
  potSol: number;
  entryCount: number;
  threshold: number;
  entries?: string[];
  winnerWallet?: string | null;
  prizeSol?: number | null;
  createdAt?: string;
  drawnAt?: string | null;
}

// Initialize casino tables
export async function initializeCasinoTables(): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    // Create raffles table
    await sql`
      CREATE TABLE IF NOT EXISTS casino_raffles (
        id SERIAL PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        pot_lamports BIGINT NOT NULL DEFAULT 0,
        threshold_sol DECIMAL NOT NULL DEFAULT 0.5,
        winner_wallet VARCHAR(64),
        prize_sol DECIMAL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        drawn_at TIMESTAMP WITH TIME ZONE,
        draw_seed VARCHAR(128),
        CONSTRAINT valid_status CHECK (status IN ('active', 'drawing', 'completed'))
      )
    `;

    // Create raffle entries table with unique constraint
    await sql`
      CREATE TABLE IF NOT EXISTS casino_raffle_entries (
        id SERIAL PRIMARY KEY,
        raffle_id INTEGER NOT NULL REFERENCES casino_raffles(id) ON DELETE CASCADE,
        wallet VARCHAR(64) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(raffle_id, wallet)
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle ON casino_raffle_entries(raffle_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_raffle_entries_wallet ON casino_raffle_entries(wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_raffles_status ON casino_raffles(status)`;
    return true;
  } catch {
    return false;
  }
}

// Create a new raffle (admin only)
export async function createCasinoRaffle(
  potSol: number,
  thresholdEntries: number = 50
): Promise<{ success: boolean; raffleId?: number; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Initialize tables if needed
    await initializeCasinoTables();

    // Check for existing active raffle
    const existing = await sql`
      SELECT id FROM casino_raffles WHERE status = 'active' LIMIT 1
    `;

    if ((existing as unknown[]).length > 0) {
      return { success: false, error: "Active raffle already exists. Draw or cancel it first." };
    }

    // Create new raffle
    const potLamports = Math.floor(potSol * 1e9);
    const result = await sql`
      INSERT INTO casino_raffles (pot_lamports, threshold_sol, status)
      VALUES (${potLamports}, ${thresholdEntries}, 'active')
      RETURNING id
    `;

    const raffleId = (result as Array<{ id: number }>)[0]?.id;
    return { success: true, raffleId };
  } catch {
    return { success: false, error: "Failed to create raffle" };
  }
}

// Pause an active raffle (admin only)
export async function pauseCasinoRaffle(): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    const result = await sql`
      UPDATE casino_raffles
      SET status = 'paused'
      WHERE status = 'active'
      RETURNING id
    `;

    if ((result as unknown[]).length === 0) {
      return { success: false, error: "No active raffle to pause" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to pause raffle" };
  }
}

// Resume a paused raffle (admin only)
export async function resumeCasinoRaffle(): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    const result = await sql`
      UPDATE casino_raffles
      SET status = 'active'
      WHERE status = 'paused'
      RETURNING id
    `;

    if ((result as unknown[]).length === 0) {
      return { success: false, error: "No paused raffle to resume" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to resume raffle" };
  }
}

// Draw raffle winner using crypto-secure RNG (admin only)
export async function drawRaffleWinner(): Promise<{
  success: boolean;
  winner?: string;
  prize?: number;
  entryCount?: number;
  error?: string;
}> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Get active raffle with entries
    const raffleResult = await sql`
      SELECT r.id, r.pot_lamports,
        (SELECT json_agg(wallet) FROM casino_raffle_entries WHERE raffle_id = r.id) as entries,
        (SELECT COUNT(*) FROM casino_raffle_entries WHERE raffle_id = r.id) as entry_count
      FROM casino_raffles r
      WHERE r.status = 'active'
      LIMIT 1
    `;

    if ((raffleResult as unknown[]).length === 0) {
      return { success: false, error: "No active raffle found" };
    }

    const raffle = (
      raffleResult as Array<{
        id: number;
        pot_lamports: string;
        entries: string[] | null;
        entry_count: string;
      }>
    )[0];

    const entries = raffle.entries || [];
    const entryCount = safeParseInt(raffle.entry_count, 0);

    if (entryCount === 0) {
      return { success: false, error: "No entries in raffle" };
    }

    // Mark as drawing to prevent race conditions
    await sql`
      UPDATE casino_raffles SET status = 'drawing' WHERE id = ${raffle.id}
    `;

    // Generate crypto-secure random index
    const crypto = await import("crypto");
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0);
    const winnerIndex = randomValue % entryCount;
    const winner = entries[winnerIndex];

    // Calculate prize (full pot)
    const prizeSol = safeParseInt(raffle.pot_lamports, 0) / 1e9;

    // Store the seed for provability
    const drawSeed = randomBytes.toString("hex");

    // Update raffle with winner
    await sql`
      UPDATE casino_raffles SET
        status = 'completed',
        winner_wallet = ${winner},
        prize_sol = ${prizeSol},
        drawn_at = NOW(),
        draw_seed = ${drawSeed}
      WHERE id = ${raffle.id}
    `;

    return {
      success: true,
      winner,
      prize: prizeSol,
      entryCount,
    };
  } catch {
    return { success: false, error: "Failed to draw raffle" };
  }
}

// Get raffle by ID (for viewing completed raffles)
export async function getCasinoRaffleById(raffleId: number): Promise<CasinoRaffle | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const result = await sql`
      SELECT r.*,
        (SELECT COUNT(*) FROM casino_raffle_entries WHERE raffle_id = r.id) as entry_count,
        (SELECT json_agg(wallet) FROM casino_raffle_entries WHERE raffle_id = r.id) as entries
      FROM casino_raffles r
      WHERE r.id = ${raffleId}
    `;

    if ((result as unknown[]).length === 0) return null;

    const row = (result as Array<Record<string, unknown>>)[0];
    return {
      id: row.id as number,
      status: row.status as "active" | "paused" | "drawing" | "completed",
      potLamports: safeParseInt(row.pot_lamports as string, 0),
      potSol: safeParseInt(row.pot_lamports as string, 0) / 1e9,
      entryCount: safeParseInt(row.entry_count as string, 0),
      threshold: safeParseFloat(row.threshold_sol as string, 50),
      entries: (row.entries as string[]) || [],
      winnerWallet: row.winner_wallet as string | null,
      prizeSol: row.prize_sol ? safeParseFloat(row.prize_sol as string, 0) : null,
      createdAt: row.created_at as string,
      drawnAt: row.drawn_at as string | null,
    };
  } catch (error) {
    console.error("[Casino] Error getting raffle by ID:", error);
    return null;
  }
}

// Check if entry threshold is reached (for auto-draw trigger)
export async function checkRaffleThreshold(): Promise<{
  shouldDraw: boolean;
  entryCount: number;
  threshold: number;
}> {
  const sql = await getSql();
  if (!sql) return { shouldDraw: false, entryCount: 0, threshold: 50 };

  try {
    const result = await sql`
      SELECT r.threshold_sol as threshold,
        (SELECT COUNT(*) FROM casino_raffle_entries WHERE raffle_id = r.id) as entry_count
      FROM casino_raffles r
      WHERE r.status = 'active'
      LIMIT 1
    `;

    if ((result as unknown[]).length === 0) {
      return { shouldDraw: false, entryCount: 0, threshold: 50 };
    }

    const row = (result as Array<{ threshold: string; entry_count: string }>)[0];
    const entryCount = safeParseInt(row.entry_count, 0);
    const threshold = safeParseInt(row.threshold, 50);

    return {
      shouldDraw: entryCount >= threshold,
      entryCount,
      threshold,
    };
  } catch (error) {
    console.error("[Casino] Error checking threshold:", error);
    return { shouldDraw: false, entryCount: 0, threshold: 50 };
  }
}

interface CasinoHistoryEntry {
  id: string;
  type: "raffle" | "wheel";
  result: string;
  amount: number;
  timestamp: number;
  isWin: boolean;
}

// Get active raffle status (or most recent completed if no active)
export async function getCasinoRaffle(
  includeCompleted: boolean = false
): Promise<CasinoRaffle | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    // Check if casino tables exist first
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'casino_raffles'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      // Tables not created yet, return null to use in-memory fallback
      return null;
    }

    // First try to get active or paused raffle
    let result = await sql`
      SELECT r.*,
        (SELECT COUNT(*) FROM casino_raffle_entries WHERE raffle_id = r.id) as entry_count,
        (SELECT json_agg(wallet) FROM casino_raffle_entries WHERE raffle_id = r.id) as entries
      FROM casino_raffles r
      WHERE r.status IN ('active', 'paused')
      ORDER BY r.created_at DESC
      LIMIT 1
    `;

    // If no active/paused and includeCompleted, get most recent completed
    if ((result as unknown[]).length === 0 && includeCompleted) {
      result = await sql`
        SELECT r.*,
          (SELECT COUNT(*) FROM casino_raffle_entries WHERE raffle_id = r.id) as entry_count,
          (SELECT json_agg(wallet) FROM casino_raffle_entries WHERE raffle_id = r.id) as entries
        FROM casino_raffles r
        WHERE r.status = 'completed'
        ORDER BY r.drawn_at DESC
        LIMIT 1
      `;
    }

    if ((result as unknown[]).length === 0) return null;

    const row = (result as Array<Record<string, unknown>>)[0];
    const potLamports = safeParseInt(row.pot_lamports as string, 0);
    return {
      id: row.id as number,
      status: row.status as "active" | "paused" | "drawing" | "completed",
      potLamports,
      potSol: potLamports / 1e9,
      entryCount: safeParseInt(row.entry_count as string, 0),
      threshold: safeParseFloat(row.threshold_sol as string, 50),
      entries: (row.entries as string[]) || [],
      winnerWallet: row.winner_wallet as string | null,
      prizeSol: row.prize_sol ? safeParseFloat(row.prize_sol as string, 0) : null,
      createdAt: row.created_at as string,
      drawnAt: row.drawn_at as string | null,
    };
  } catch (error) {
    console.error("Error getting casino raffle:", error);
    return null;
  }
}

// Enter raffle
export async function enterCasinoRaffle(
  wallet: string
): Promise<{ success: boolean; error?: string; entryCount?: number }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Check if tables exist
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'casino_raffles'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return { success: false, error: "Casino not initialized" };
    }

    // Get active raffle
    const raffle = await sql`
      SELECT id FROM casino_raffles WHERE status = 'active' LIMIT 1
    `;

    if ((raffle as unknown[]).length === 0) {
      return { success: false, error: "No active raffle" };
    }

    const raffleId = (raffle as Array<{ id: number }>)[0].id;

    // Check if already entered
    const existing = await sql`
      SELECT id FROM casino_raffle_entries
      WHERE raffle_id = ${raffleId} AND wallet = ${wallet}
    `;

    if ((existing as unknown[]).length > 0) {
      return { success: false, error: "Already entered this raffle" };
    }

    // Enter raffle
    await sql`
      INSERT INTO casino_raffle_entries (raffle_id, wallet)
      VALUES (${raffleId}, ${wallet})
    `;

    const countResult = await sql`
      SELECT COUNT(*) as count FROM casino_raffle_entries WHERE raffle_id = ${raffleId}
    `;

    return {
      success: true,
      entryCount: safeParseInt((countResult as Array<{ count: string }>)[0]?.count, 0),
    };
  } catch (error) {
    console.error("Error entering raffle:", error);
    return { success: false, error: "Failed to enter raffle" };
  }
}

// Get entries for a specific raffle (admin)
export async function getRaffleEntries(
  raffleId: number
): Promise<{ wallet: string; enteredAt: string }[] | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const result = await sql`
      SELECT wallet, created_at
      FROM casino_raffle_entries
      WHERE raffle_id = ${raffleId}
      ORDER BY created_at DESC
    `;

    return (result as Array<{ wallet: string; created_at: string }>).map((row) => ({
      wallet: row.wallet,
      enteredAt: row.created_at,
    }));
  } catch (error) {
    console.error("Error getting raffle entries:", error);
    return null;
  }
}

// Get raffle history (admin)
export async function getRaffleHistory(limit: number = 10): Promise<
  | {
      id: number;
      status: string;
      potSol: number;
      entryCount: number;
      threshold: number;
      winnerWallet: string | null;
      prizeSol: number | null;
      createdAt: string;
      drawnAt: string | null;
    }[]
  | null
> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'casino_raffles'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return null;
    }

    const result = await sql`
      SELECT
        r.id,
        r.status,
        r.pot_lamports,
        r.threshold_sol,
        r.winner_wallet,
        r.prize_sol,
        r.created_at,
        r.drawn_at,
        (SELECT COUNT(*) FROM casino_raffle_entries WHERE raffle_id = r.id) as entry_count
      FROM casino_raffles r
      ORDER BY r.created_at DESC
      LIMIT ${limit}
    `;

    return (
      result as Array<{
        id: number;
        status: string;
        pot_lamports: string;
        threshold_sol: string;
        winner_wallet: string | null;
        prize_sol: string | null;
        created_at: string;
        drawn_at: string | null;
        entry_count: string;
      }>
    ).map((row) => ({
      id: row.id,
      status: row.status,
      potSol: safeParseInt(row.pot_lamports, 0) / 1e9,
      entryCount: safeParseInt(row.entry_count, 0),
      threshold: safeParseFloat(row.threshold_sol, 50),
      winnerWallet: row.winner_wallet,
      prizeSol: row.prize_sol ? safeParseFloat(row.prize_sol, 0) : null,
      createdAt: row.created_at,
      drawnAt: row.drawn_at,
    }));
  } catch (error) {
    console.error("Error getting raffle history:", error);
    return null;
  }
}

// Get casino pot balance
export async function getCasinoPot(): Promise<number | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'casino_pot'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return null;
    }

    const result = await sql`
      SELECT balance_lamports FROM casino_pot ORDER BY updated_at DESC LIMIT 1
    `;

    if ((result as unknown[]).length === 0) return null;

    return (
      safeParseInt((result as Array<{ balance_lamports: string }>)[0].balance_lamports, 0) / 1e9
    ); // Convert to SOL
  } catch (error) {
    console.error("Error getting casino pot:", error);
    return null;
  }
}

// Record wheel spin
export async function recordWheelSpin(
  wallet: string,
  prize: number,
  result: string
): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'casino_wheel_spins'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return false;
    }

    await sql`
      INSERT INTO casino_wheel_spins (wallet, result, prize_sol, is_win)
      VALUES (${wallet}, ${result}, ${prize}, ${prize > 0})
    `;

    // Deduct from pot if won
    if (prize > 0) {
      await sql`
        UPDATE casino_pot
        SET balance_lamports = balance_lamports - ${Math.floor(prize * 1e9)},
            updated_at = NOW()
      `;
    }

    return true;
  } catch (error) {
    console.error("Error recording wheel spin:", error);
    return false;
  }
}

// Get last wheel spin time for a wallet (for cooldown check)
export async function getLastWheelSpin(wallet: string): Promise<number | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'casino_wheel_spins'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return null;
    }

    const result = await sql`
      SELECT created_at FROM casino_wheel_spins
      WHERE wallet = ${wallet}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if ((result as unknown[]).length === 0) return null;

    return new Date((result as Array<{ created_at: string }>)[0].created_at).getTime();
  } catch (error) {
    console.error("Error getting last wheel spin:", error);
    return null;
  }
}

// ============================================
// Agent Feed Event Persistence
// ============================================

export interface EmittedEventRecord {
  id: string;
  event_type: string;
  message: string;
  priority: string;
  data: Record<string, unknown>;
  emitted_at: string;
}

export interface MilestoneRecord {
  id: string; // format: {mint}-{threshold}
  mint: string;
  threshold: number;
  token_symbol: string;
  achieved_at: string;
}

// Initialize agent feed tables
export async function initializeAgentFeedTables(): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    // Create emitted_events table for tracking events
    await sql`
      CREATE TABLE IF NOT EXISTS emitted_events (
        id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        message TEXT,
        priority VARCHAR(20),
        data JSONB,
        emitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create indexes for efficient queries
    await sql`CREATE INDEX IF NOT EXISTS idx_emitted_events_emitted_at ON emitted_events(emitted_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_emitted_events_type ON emitted_events(event_type)`;

    // Create milestone_achievements table
    await sql`
      CREATE TABLE IF NOT EXISTS milestone_achievements (
        id VARCHAR(255) PRIMARY KEY,
        mint VARCHAR(255) NOT NULL,
        threshold DECIMAL NOT NULL,
        token_symbol VARCHAR(50),
        achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_milestone_mint ON milestone_achievements(mint)`;

    return true;
  } catch (error) {
    console.error("[Neon] Error initializing agent feed tables:", error);
    return false;
  }
}

// Check if an event has already been emitted
export async function hasEventBeenEmitted(eventId: string): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    const result = await sql`
      SELECT id FROM emitted_events WHERE id = ${eventId} LIMIT 1
    `;
    return (result as unknown[]).length > 0;
  } catch {
    return false;
  }
}

// Record an emitted event
export async function recordEmittedEvent(event: {
  id: string;
  event_type: string;
  message: string;
  priority: string;
  data: Record<string, unknown>;
}): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      INSERT INTO emitted_events (id, event_type, message, priority, data)
      VALUES (${event.id}, ${event.event_type}, ${event.message}, ${event.priority}, ${JSON.stringify(event.data)})
      ON CONFLICT (id) DO NOTHING
    `;
    return true;
  } catch (error) {
    console.error("[Neon] Error recording emitted event:", error);
    return false;
  }
}

// Get recent emitted events (for loading on cold start)
export async function getRecentEmittedEvents(
  hoursBack: number = 24
): Promise<EmittedEventRecord[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT id, event_type, message, priority, data, emitted_at
      FROM emitted_events
      WHERE emitted_at > NOW() - INTERVAL '${hoursBack} hours'
      ORDER BY emitted_at DESC
      LIMIT 100
    `;
    return result as EmittedEventRecord[];
  } catch (error) {
    console.error("[Neon] Error fetching recent events:", error);
    return [];
  }
}

// Clean up old emitted events (older than 24 hours)
export async function cleanupOldEmittedEvents(): Promise<number> {
  const sql = await getSql();
  if (!sql) return 0;

  try {
    const result = await sql`
      DELETE FROM emitted_events
      WHERE emitted_at < NOW() - INTERVAL '24 hours'
      RETURNING id
    `;
    return (result as unknown[]).length;
  } catch (error) {
    console.error("[Neon] Error cleaning up old events:", error);
    return 0;
  }
}

// Check if a milestone has been achieved
export async function hasMilestoneBeenAchieved(mint: string, threshold: number): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    const milestoneId = `${mint}-${threshold}`;
    const result = await sql`
      SELECT id FROM milestone_achievements WHERE id = ${milestoneId} LIMIT 1
    `;
    return (result as unknown[]).length > 0;
  } catch {
    return false;
  }
}

// Record a milestone achievement
export async function recordMilestoneAchievement(
  mint: string,
  threshold: number,
  tokenSymbol: string
): Promise<{ isNew: boolean; achievedAt: Date }> {
  const sql = await getSql();
  if (!sql) return { isNew: false, achievedAt: new Date() };

  const milestoneId = `${mint}-${threshold}`;

  try {
    // First check if it exists
    const existing = await sql`
      SELECT achieved_at FROM milestone_achievements WHERE id = ${milestoneId} LIMIT 1
    `;

    if ((existing as unknown[]).length > 0) {
      // Already achieved
      const row = (existing as Array<{ achieved_at: string }>)[0];
      return { isNew: false, achievedAt: new Date(row.achieved_at) };
    }

    // Record new milestone
    await sql`
      INSERT INTO milestone_achievements (id, mint, threshold, token_symbol)
      VALUES (${milestoneId}, ${mint}, ${threshold}, ${tokenSymbol})
      ON CONFLICT (id) DO NOTHING
    `;

    return { isNew: true, achievedAt: new Date() };
  } catch (error) {
    console.error("[Neon] Error recording milestone:", error);
    return { isNew: false, achievedAt: new Date() };
  }
}

// Get all milestones for a token
export async function getTokenMilestones(mint: string): Promise<MilestoneRecord[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT id, mint, threshold, token_symbol, achieved_at
      FROM milestone_achievements
      WHERE mint = ${mint}
      ORDER BY threshold ASC
    `;
    return result as MilestoneRecord[];
  } catch (error) {
    console.error("[Neon] Error fetching token milestones:", error);
    return [];
  }
}

// Get all emitted event IDs (for deduplication on cold start)
export async function getEmittedEventIds(): Promise<Set<string>> {
  const sql = await getSql();
  if (!sql) return new Set();

  try {
    const result = await sql`
      SELECT id FROM emitted_events
      WHERE emitted_at > NOW() - INTERVAL '24 hours'
    `;
    return new Set((result as Array<{ id: string }>).map((r) => r.id));
  } catch (error) {
    console.error("[Neon] Error fetching emitted event IDs:", error);
    return new Set();
  }
}

// Get casino history for a wallet
export async function getCasinoHistory(wallet: string): Promise<CasinoHistoryEntry[] | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    // Check if tables exist
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'casino_wheel_spins'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return null;
    }

    const wheelSpins = await sql`
      SELECT id, result, prize_sol, is_win, created_at
      FROM casino_wheel_spins
      WHERE wallet = ${wallet}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const raffleEntries = await sql`
      SELECT e.id, r.status, r.winner_wallet, r.prize_sol, e.created_at
      FROM casino_raffle_entries e
      JOIN casino_raffles r ON r.id = e.raffle_id
      WHERE e.wallet = ${wallet}
      ORDER BY e.created_at DESC
      LIMIT 20
    `;

    const history: CasinoHistoryEntry[] = [];

    // Add wheel spins
    for (const spin of wheelSpins as Array<{
      id: number;
      result: string;
      prize_sol: string;
      is_win: boolean;
      created_at: string;
    }>) {
      history.push({
        id: `wheel-${spin.id}`,
        type: "wheel",
        result: spin.result,
        amount: safeParseFloat(spin.prize_sol, 0),
        timestamp: new Date(spin.created_at).getTime(),
        isWin: spin.is_win,
      });
    }

    // Add raffle entries
    for (const entry of raffleEntries as Array<{
      id: number;
      status: string;
      winner_wallet: string;
      prize_sol: string;
      created_at: string;
    }>) {
      const isWinner = entry.winner_wallet === wallet;
      history.push({
        id: `raffle-${entry.id}`,
        type: "raffle",
        result: entry.status === "completed" ? (isWinner ? "WON" : "LOST") : "PENDING",
        amount: isWinner ? safeParseFloat(entry.prize_sol, 0) : 0,
        timestamp: new Date(entry.created_at).getTime(),
        isWin: isWinner,
      });
    }

    // Sort by timestamp
    history.sort((a, b) => b.timestamp - a.timestamp);

    return history.slice(0, 20);
  } catch (error) {
    console.error("Error getting casino history:", error);
    return null;
  }
}

// ============================================
// Distributed Rate Limiting
// ============================================
// Persists rate limit state to database so it survives serverless cold starts.
// Uses atomic upsert for thread-safe counter increment.

// Track if rate limit table has been initialized
let rateLimitTableInitialized = false;

/**
 * Initialize rate limit table if it doesn't exist.
 * Called lazily on first rate limit check.
 */
export async function initializeRateLimitTable(): Promise<boolean> {
  if (rateLimitTableInitialized) return true;

  const sql = await getSql();
  if (!sql) return false;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        identifier VARCHAR(255) PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        window_start BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      )
    `;

    // Index for cleanup queries - find expired entries efficiently
    await sql`CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at)`;

    rateLimitTableInitialized = true;
    return true;
  } catch (error) {
    console.error("[Neon] Error creating rate_limits table:", error);
    return false;
  }
}

/**
 * Rate limit result returned by checkDistributedRateLimit
 */
export interface DistributedRateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * Check and increment rate limit atomically using database.
 *
 * Uses PostgreSQL UPSERT (INSERT ON CONFLICT) for atomic counter increment.
 * Handles window expiration within the same query for efficiency.
 *
 * @param identifier - Unique key for rate limiting (e.g., "admin-auth:192.168.1.1")
 * @param limit - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result with success, remaining, and resetIn
 */
export async function checkDistributedRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<DistributedRateLimitResult> {
  const sql = await getSql();
  const now = Date.now();
  const expiresAt = now + windowMs;

  // If database is not available, fail open (allow request) but log warning
  // This ensures availability even when DB is temporarily unreachable
  if (!sql) {
    console.warn("[RateLimit] Database unavailable, allowing request");
    return { success: true, remaining: limit - 1, resetIn: windowMs };
  }

  // Ensure table exists (lazy initialization)
  await initializeRateLimitTable();

  try {
    // Atomic upsert with conditional logic:
    // - If entry doesn't exist: insert with count=1
    // - If entry exists but expired: reset count to 1, update window
    // - If entry exists and valid: increment count
    const result = await sql`
      INSERT INTO rate_limits (identifier, count, window_start, expires_at)
      VALUES (${identifier}, 1, ${now}, ${expiresAt})
      ON CONFLICT (identifier) DO UPDATE SET
        count = CASE
          WHEN rate_limits.expires_at < ${now} THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.expires_at < ${now} THEN ${now}
          ELSE rate_limits.window_start
        END,
        expires_at = CASE
          WHEN rate_limits.expires_at < ${now} THEN ${expiresAt}
          ELSE rate_limits.expires_at
        END
      RETURNING count, expires_at
    `;

    const row = (result as Array<{ count: number; expires_at: string }>)[0];
    const count = row.count;
    const resetIn = Math.max(0, parseInt(String(row.expires_at), 10) - now);

    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      resetIn,
    };
  } catch (error) {
    console.error("[RateLimit] Database error:", error);
    // Fail open on database errors to maintain availability
    return { success: true, remaining: limit - 1, resetIn: windowMs };
  }
}

/**
 * Cleanup expired rate limit entries from the database.
 *
 * Should be called periodically to prevent table bloat.
 * The rate-limit module calls this lazily every 5 minutes.
 *
 * @returns Number of entries deleted
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const sql = await getSql();
  if (!sql) return 0;

  try {
    const result = await sql`
      DELETE FROM rate_limits
      WHERE expires_at < ${Date.now()}
      RETURNING identifier
    `;
    const deleted = (result as unknown[]).length;
    if (deleted > 0) {
      console.log(`[RateLimit] Cleaned up ${deleted} expired entries`);
    }
    return deleted;
  } catch (error) {
    console.error("[RateLimit] Cleanup error:", error);
    return 0;
  }
}
