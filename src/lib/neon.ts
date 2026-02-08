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
export type SqlFunction = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown[]>;

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
export async function getSql(): Promise<SqlFunction | null> {
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

// Get tokens by creator wallet
export async function getTokensByCreator(creatorWallet: string): Promise<GlobalToken[]> {
  const sql = await getSql();
  if (!sql) {
    return [];
  }

  try {
    const rows = await sql`
      SELECT * FROM tokens
      WHERE creator_wallet = ${creatorWallet}
      ORDER BY created_at DESC
    `;
    return rows as GlobalToken[];
  } catch (error) {
    console.error("Error fetching tokens by creator:", error);
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

// Get admin wallets from environment (uses same config as general admin)
// SECURITY: Only use server-side env vars, never NEXT_PUBLIC_ for admin wallets
export function getCasinoAdminWallets(): string[] {
  const adminWalletsEnv = process.env.ADMIN_WALLETS || process.env.ADMIN_WALLET;
  if (adminWalletsEnv) {
    return adminWalletsEnv
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
  }
  return [];
}

// Legacy function for backwards compatibility - returns first admin wallet
export function getCasinoAdminWallet(): string {
  const wallets = getCasinoAdminWallets();
  return wallets[0] || "";
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

// ============================================
// Oracle Prediction Market Functions
// ============================================

export interface OracleTokenOptionDB {
  mint: string;
  symbol: string;
  name: string;
  startPrice: number;
  imageUrl?: string;
}

export interface OracleRoundDB {
  id: number;
  status: "active" | "settled" | "cancelled";
  startTime: Date;
  endTime: Date;
  tokenOptions: OracleTokenOptionDB[];
  winningTokenMint?: string;
  winningPriceChange?: number;
  settlementData?: Record<string, unknown>;
  entryCount: number;
  prizePoolLamports: bigint;
  prizeDistributed: boolean;
  createdAt: Date;
  // Virtual market fields
  marketType?: string;
  marketConfig?: Record<string, unknown>;
  autoResolve?: boolean;
  resolutionSource?: string;
  createdBy?: string;
  entryCostOp?: number;
  isTournamentMarket?: boolean;
  tournamentId?: number;
  winningOutcomeId?: string;
}

export interface OraclePredictionDB {
  id: number;
  roundId: number;
  wallet: string;
  tokenMint: string;
  isWinner: boolean;
  predictionRank?: number;
  prizeLamports: bigint;
  claimed: boolean;
  createdAt: Date;
  // Virtual market fields
  outcomeId?: string;
  opWagered?: number;
  opPayout?: number;
}

// Oracle Users (OP economy)
export interface OracleUserDB {
  wallet: string;
  opBalance: number;
  totalOpEarned: number;
  totalOpSpent: number;
  firstPredictionBonus: boolean;
  lastDailyClaim?: Date;
  currentStreak: number;
  bestStreak: number;
  reputationScore: number;
  reputationTier: string;
  totalMarketsEntered: number;
  totalMarketsWon: number;
  achievements: Record<string, { unlockedAt: string; opAwarded: number }>;
  createdAt: Date;
}

// Oracle OP Ledger
export interface OracleOPLedgerDB {
  id: number;
  wallet: string;
  amount: number;
  balanceAfter: number;
  txType: string;
  referenceId?: number;
  createdAt: Date;
}

// Oracle Tournament
export interface OracleTournamentDB {
  id: number;
  name: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status: string;
  prizePoolLamports: bigint;
  prizeDistribution: Array<{ rank: number; pct: number }>;
  scoringType: string;
  maxParticipants?: number;
  createdBy: string;
  createdAt: Date;
}

// Oracle Tournament Entry
export interface OracleTournamentEntryDB {
  tournamentId: number;
  wallet: string;
  score: number;
  marketsEntered: number;
  marketsWon: number;
  finalRank?: number;
  prizeLamports?: bigint;
}

export interface OracleBalanceDB {
  wallet: string;
  balanceLamports: bigint;
  totalEarnedLamports: bigint;
  totalClaimedLamports: bigint;
  lastClaimAt?: Date;
  updatedAt: Date;
}

export interface OracleClaimDB {
  id: number;
  wallet: string;
  amountLamports: bigint;
  txSignature?: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
}

export interface PrizeDistribution {
  wallet: string;
  rank: number;
  prizeLamports: bigint;
  prizeSol: number;
}

// Initialize Oracle tables
export async function initializeOracleTables(): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    // Create oracle_rounds table
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_rounds (
        id SERIAL PRIMARY KEY,
        status VARCHAR(20) DEFAULT 'active',
        start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        token_options JSONB NOT NULL,
        winning_token_mint VARCHAR(64),
        winning_price_change DECIMAL,
        settlement_data JSONB,
        entry_count INTEGER DEFAULT 0,
        prize_pool_lamports BIGINT DEFAULT 0,
        prize_distributed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create oracle_predictions table
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_predictions (
        id SERIAL PRIMARY KEY,
        round_id INTEGER REFERENCES oracle_rounds(id) ON DELETE CASCADE,
        wallet VARCHAR(64) NOT NULL,
        token_mint VARCHAR(64) NOT NULL,
        is_winner BOOLEAN DEFAULT FALSE,
        prediction_rank INTEGER,
        prize_lamports BIGINT DEFAULT 0,
        claimed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(round_id, wallet)
      )
    `;

    // Create oracle_balances table - aggregate claimable balance per wallet
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_balances (
        wallet VARCHAR(64) PRIMARY KEY,
        balance_lamports BIGINT DEFAULT 0,
        total_earned_lamports BIGINT DEFAULT 0,
        total_claimed_lamports BIGINT DEFAULT 0,
        last_claim_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create oracle_claims table - claim request history
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_claims (
        id SERIAL PRIMARY KEY,
        wallet VARCHAR(64) NOT NULL,
        amount_lamports BIGINT NOT NULL,
        tx_signature VARCHAR(128),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_rounds_status ON oracle_rounds(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_predictions_round ON oracle_predictions(round_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_predictions_wallet ON oracle_predictions(wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_balances_balance ON oracle_balances(balance_lamports) WHERE balance_lamports > 0`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_claims_wallet ON oracle_claims(wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_claims_status ON oracle_claims(status)`;

    // Add new columns to existing tables if they don't exist (migration)
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'prize_pool_lamports') THEN
          ALTER TABLE oracle_rounds ADD COLUMN prize_pool_lamports BIGINT DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'prize_distributed') THEN
          ALTER TABLE oracle_rounds ADD COLUMN prize_distributed BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_predictions' AND column_name = 'prediction_rank') THEN
          ALTER TABLE oracle_predictions ADD COLUMN prediction_rank INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_predictions' AND column_name = 'prize_lamports') THEN
          ALTER TABLE oracle_predictions ADD COLUMN prize_lamports BIGINT DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_predictions' AND column_name = 'claimed') THEN
          ALTER TABLE oracle_predictions ADD COLUMN claimed BOOLEAN DEFAULT FALSE;
        END IF;
        -- Virtual market columns on oracle_rounds
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'market_type') THEN
          ALTER TABLE oracle_rounds ADD COLUMN market_type TEXT DEFAULT 'price_prediction';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'market_config') THEN
          ALTER TABLE oracle_rounds ADD COLUMN market_config JSONB DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'auto_resolve') THEN
          ALTER TABLE oracle_rounds ADD COLUMN auto_resolve BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'resolution_source') THEN
          ALTER TABLE oracle_rounds ADD COLUMN resolution_source TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'created_by') THEN
          ALTER TABLE oracle_rounds ADD COLUMN created_by TEXT DEFAULT 'admin';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'entry_cost_op') THEN
          ALTER TABLE oracle_rounds ADD COLUMN entry_cost_op BIGINT DEFAULT 100;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'is_tournament_market') THEN
          ALTER TABLE oracle_rounds ADD COLUMN is_tournament_market BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'tournament_id') THEN
          ALTER TABLE oracle_rounds ADD COLUMN tournament_id INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_rounds' AND column_name = 'winning_outcome_id') THEN
          ALTER TABLE oracle_rounds ADD COLUMN winning_outcome_id TEXT;
        END IF;
        -- Virtual market columns on oracle_predictions
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_predictions' AND column_name = 'outcome_id') THEN
          ALTER TABLE oracle_predictions ADD COLUMN outcome_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_predictions' AND column_name = 'op_wagered') THEN
          ALTER TABLE oracle_predictions ADD COLUMN op_wagered BIGINT DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_predictions' AND column_name = 'op_payout') THEN
          ALTER TABLE oracle_predictions ADD COLUMN op_payout BIGINT DEFAULT 0;
        END IF;
      END $$
    `;

    // Create oracle_users table - Virtual credit (OP) balances and stats
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_users (
        wallet TEXT PRIMARY KEY,
        op_balance BIGINT DEFAULT 1000,
        total_op_earned BIGINT DEFAULT 0,
        total_op_spent BIGINT DEFAULT 0,
        first_prediction_bonus BOOLEAN DEFAULT FALSE,
        last_daily_claim TIMESTAMP WITH TIME ZONE,
        current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        daily_claim_streak INTEGER DEFAULT 0,
        best_daily_streak INTEGER DEFAULT 0,
        reputation_score INTEGER DEFAULT 1000,
        reputation_tier TEXT DEFAULT 'novice',
        total_markets_entered INTEGER DEFAULT 0,
        total_markets_won INTEGER DEFAULT 0,
        achievements JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Migrate: add daily_claim_streak columns for existing tables
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_users' AND column_name = 'daily_claim_streak') THEN
          ALTER TABLE oracle_users ADD COLUMN daily_claim_streak INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oracle_users' AND column_name = 'best_daily_streak') THEN
          ALTER TABLE oracle_users ADD COLUMN best_daily_streak INTEGER DEFAULT 0;
        END IF;
      END $$
    `;

    // Create oracle_op_ledger table - Audit trail for all OP changes
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_op_ledger (
        id SERIAL PRIMARY KEY,
        wallet TEXT NOT NULL,
        amount BIGINT NOT NULL,
        balance_after BIGINT NOT NULL,
        tx_type TEXT NOT NULL,
        reference_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create oracle_tournaments table
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_tournaments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT DEFAULT 'upcoming',
        prize_pool_lamports BIGINT DEFAULT 0,
        prize_distribution JSONB,
        scoring_type TEXT DEFAULT 'op_earned',
        max_participants INTEGER,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create oracle_tournament_entries table
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_tournament_entries (
        tournament_id INTEGER REFERENCES oracle_tournaments(id) ON DELETE CASCADE,
        wallet TEXT NOT NULL,
        score BIGINT DEFAULT 0,
        markets_entered INTEGER DEFAULT 0,
        markets_won INTEGER DEFAULT 0,
        final_rank INTEGER,
        prize_lamports BIGINT DEFAULT 0,
        PRIMARY KEY (tournament_id, wallet)
      )
    `;

    // Additional indexes for new tables
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_op_ledger_wallet ON oracle_op_ledger(wallet)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_op_ledger_type ON oracle_op_ledger(tx_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_rounds_market_type ON oracle_rounds(market_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_tournaments_status ON oracle_tournaments(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_tournament_entries_wallet ON oracle_tournament_entries(wallet)`;

    return true;
  } catch (error) {
    console.error("[Oracle] Error initializing tables:", error);
    return false;
  }
}

// Parse a DB row into OracleRoundDB
function parseOracleRoundRow(row: Record<string, unknown>): OracleRoundDB {
  return {
    id: row.id as number,
    status: row.status as "active" | "settled" | "cancelled",
    startTime: new Date(row.start_time as string),
    endTime: new Date(row.end_time as string),
    tokenOptions: row.token_options as OracleTokenOptionDB[],
    winningTokenMint: row.winning_token_mint as string | undefined,
    winningPriceChange: row.winning_price_change
      ? safeParseFloat(row.winning_price_change as string, 0)
      : undefined,
    settlementData: row.settlement_data as Record<string, unknown> | undefined,
    entryCount: safeParseInt(row.entry_count as string, 0),
    prizePoolLamports: BigInt((row.prize_pool_lamports as string) || "0"),
    prizeDistributed: (row.prize_distributed as boolean) || false,
    createdAt: new Date(row.created_at as string),
    marketType: (row.market_type as string) || "price_prediction",
    marketConfig: row.market_config as Record<string, unknown> | undefined,
    autoResolve: (row.auto_resolve as boolean) || false,
    resolutionSource: row.resolution_source as string | undefined,
    createdBy: (row.created_by as string) || "admin",
    entryCostOp: safeParseInt(row.entry_cost_op as string, 100),
    isTournamentMarket: (row.is_tournament_market as boolean) || false,
    tournamentId: row.tournament_id as number | undefined,
    winningOutcomeId: row.winning_outcome_id as string | undefined,
  };
}

// Get active Oracle round (or most recent if none active) - backward compatible
export async function getActiveOracleRound(): Promise<OracleRoundDB | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    // Check if tables exist
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'oracle_rounds'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return null;
    }

    const result = await sql`
      SELECT r.*,
        (SELECT COUNT(*) FROM oracle_predictions WHERE round_id = r.id) as entry_count
      FROM oracle_rounds r
      WHERE r.status = 'active'
      ORDER BY r.created_at DESC
      LIMIT 1
    `;

    if ((result as unknown[]).length === 0) return null;

    return parseOracleRoundRow((result as Array<Record<string, unknown>>)[0]);
  } catch (error) {
    console.error("[Oracle] Error getting active round:", error);
    return null;
  }
}

// Get all active Oracle markets (supports multiple concurrent markets)
export async function getActiveOracleMarkets(marketType?: string): Promise<OracleRoundDB[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'oracle_rounds'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return [];
    }

    let result;
    if (marketType) {
      result = await sql`
        SELECT r.*,
          (SELECT COUNT(*) FROM oracle_predictions WHERE round_id = r.id) as entry_count
        FROM oracle_rounds r
        WHERE r.status = 'active'
        AND COALESCE(r.market_type, 'price_prediction') = ${marketType}
        ORDER BY r.end_time ASC
      `;
    } else {
      result = await sql`
        SELECT r.*,
          (SELECT COUNT(*) FROM oracle_predictions WHERE round_id = r.id) as entry_count
        FROM oracle_rounds r
        WHERE r.status = 'active'
        ORDER BY r.end_time ASC
      `;
    }

    return (result as Array<Record<string, unknown>>).map(parseOracleRoundRow);
  } catch (error) {
    console.error("[Oracle] Error getting active markets:", error);
    return [];
  }
}

// Get markets that need auto-resolution (expired and auto_resolve=true)
export async function getMarketsToResolve(): Promise<OracleRoundDB[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT r.*,
        (SELECT COUNT(*) FROM oracle_predictions WHERE round_id = r.id) as entry_count
      FROM oracle_rounds r
      WHERE r.status = 'active'
      AND r.end_time <= NOW()
      AND r.auto_resolve = TRUE
      ORDER BY r.end_time ASC
    `;

    return (result as Array<Record<string, unknown>>).map(parseOracleRoundRow);
  } catch (error) {
    console.error("[Oracle] Error getting markets to resolve:", error);
    return [];
  }
}

// Create a new Oracle round with optional prize pool
export async function createOracleRound(
  tokenOptions: OracleTokenOptionDB[],
  endTime: Date,
  prizePoolLamports: bigint = BigInt(0),
  options?: {
    marketType?: string;
    marketConfig?: Record<string, unknown>;
    autoResolve?: boolean;
    resolutionSource?: string;
    createdBy?: string;
    entryCostOp?: number;
    isTournamentMarket?: boolean;
    tournamentId?: number;
  }
): Promise<{ success: boolean; roundId?: number; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Initialize tables if needed
    await initializeOracleTables();

    const marketType = options?.marketType || "price_prediction";

    // For legacy price_prediction markets without market config, enforce single active round
    // For new market types, allow up to 2 active rounds per type
    const existing = await sql`
      SELECT id, market_type FROM oracle_rounds
      WHERE status = 'active'
      AND COALESCE(market_type, 'price_prediction') = ${marketType}
    `;

    const maxPerType = marketType === "price_prediction" && !options?.marketConfig ? 1 : 2;
    if ((existing as unknown[]).length >= maxPerType) {
      return {
        success: false,
        error: `Maximum active ${marketType} markets reached (${maxPerType}). Settle or cancel existing ones first.`,
      };
    }

    // Validate prize pool (max 1 SOL = 1_000_000_000 lamports)
    const maxPrizeLamports = BigInt(1_000_000_000);
    if (prizePoolLamports > maxPrizeLamports) {
      return { success: false, error: "Prize pool exceeds maximum of 1 SOL" };
    }

    // Create new round with prize pool and market type fields
    const result = await sql`
      INSERT INTO oracle_rounds (
        token_options, end_time, status, prize_pool_lamports, prize_distributed,
        market_type, market_config, auto_resolve, resolution_source, created_by,
        entry_cost_op, is_tournament_market, tournament_id
      )
      VALUES (
        ${JSON.stringify(tokenOptions)}, ${endTime.toISOString()}, 'active',
        ${prizePoolLamports.toString()}, FALSE,
        ${marketType},
        ${JSON.stringify(options?.marketConfig || {})},
        ${options?.autoResolve || false},
        ${options?.resolutionSource || null},
        ${options?.createdBy || "admin"},
        ${options?.entryCostOp || 100},
        ${options?.isTournamentMarket || false},
        ${options?.tournamentId || null}
      )
      RETURNING id
    `;

    const roundId = (result as Array<{ id: number }>)[0]?.id;
    return { success: true, roundId };
  } catch (error) {
    console.error("[Oracle] Error creating round:", error);
    return { success: false, error: "Failed to create round" };
  }
}

// Enter a prediction for a round
export async function enterOraclePrediction(
  roundId: number,
  wallet: string,
  tokenMint: string,
  options?: { outcomeId?: string; opWagered?: number }
): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Check if round exists and is active
    const round = await sql`
      SELECT id, status, end_time, token_options, market_config FROM oracle_rounds
      WHERE id = ${roundId}
    `;

    if ((round as unknown[]).length === 0) {
      return { success: false, error: "Round not found" };
    }

    const roundData = (round as Array<Record<string, unknown>>)[0];

    if (roundData.status !== "active") {
      return { success: false, error: "Round is not active" };
    }

    // Check if entry deadline passed (2 hours before end)
    const endTime = new Date(roundData.end_time as string);
    const entryDeadline = new Date(endTime.getTime() - 2 * 60 * 60 * 1000);
    if (new Date() > entryDeadline) {
      return { success: false, error: "Entry deadline has passed" };
    }

    // Validate selection - either token mint or outcome_id
    const marketConfig = roundData.market_config as Record<string, unknown> | null;
    if (options?.outcomeId && marketConfig) {
      const outcomes = (marketConfig.outcomes || []) as Array<{ id: string }>;
      const validOutcome = outcomes.some((o) => o.id === options.outcomeId);
      if (!validOutcome) {
        return { success: false, error: "Invalid outcome selection" };
      }
    } else {
      const tokenOptions = roundData.token_options as OracleTokenOptionDB[];
      const validToken = tokenOptions.some((t) => t.mint === tokenMint);
      if (!validToken) {
        return { success: false, error: "Invalid token selection" };
      }
    }

    // Check if already entered
    const existing = await sql`
      SELECT id FROM oracle_predictions
      WHERE round_id = ${roundId} AND wallet = ${wallet}
    `;

    if ((existing as unknown[]).length > 0) {
      return { success: false, error: "Already entered this round" };
    }

    // Enter prediction with optional OP and outcome fields
    await sql`
      INSERT INTO oracle_predictions (round_id, wallet, token_mint, outcome_id, op_wagered)
      VALUES (${roundId}, ${wallet}, ${tokenMint}, ${options?.outcomeId || null}, ${options?.opWagered || 0})
    `;

    // Update entry count
    await sql`
      UPDATE oracle_rounds SET entry_count = entry_count + 1
      WHERE id = ${roundId}
    `;

    return { success: true };
  } catch (error) {
    console.error("[Oracle] Error entering prediction:", error);
    return { success: false, error: "Failed to enter prediction" };
  }
}

// Get user's prediction for a round
export async function getUserOraclePrediction(
  roundId: number,
  wallet: string
): Promise<OraclePredictionDB | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const result = await sql`
      SELECT * FROM oracle_predictions
      WHERE round_id = ${roundId} AND wallet = ${wallet}
    `;

    if ((result as unknown[]).length === 0) return null;

    const row = (result as Array<Record<string, unknown>>)[0];
    return {
      id: row.id as number,
      roundId: row.round_id as number,
      wallet: row.wallet as string,
      tokenMint: row.token_mint as string,
      isWinner: row.is_winner as boolean,
      predictionRank: row.prediction_rank as number | undefined,
      prizeLamports: BigInt((row.prize_lamports as string) || "0"),
      claimed: (row.claimed as boolean) || false,
      createdAt: new Date(row.created_at as string),
    };
  } catch (error) {
    console.error("[Oracle] Error getting user prediction:", error);
    return null;
  }
}

// Calculate first-come weighted prize distribution
// Weight = (totalWinners - rank + 1)^1.5
// Exported for testing
export function calculatePrizeDistribution(
  winnersCount: number,
  prizePoolLamports: bigint
): bigint[] {
  if (winnersCount === 0) return [];
  if (winnersCount === 1) return [prizePoolLamports];

  // Calculate weights for each rank
  const weights: number[] = [];
  let totalWeight = 0;

  for (let rank = 1; rank <= winnersCount; rank++) {
    const weight = Math.pow(winnersCount - rank + 1, 1.5);
    weights.push(weight);
    totalWeight += weight;
  }

  // Calculate prize for each rank
  const prizes: bigint[] = [];
  let distributedTotal = BigInt(0);

  for (let i = 0; i < winnersCount - 1; i++) {
    const share = weights[i] / totalWeight;
    const prize = BigInt(Math.floor(Number(prizePoolLamports) * share));
    prizes.push(prize);
    distributedTotal += prize;
  }

  // Last person gets remainder to avoid rounding errors
  prizes.push(prizePoolLamports - distributedTotal);

  return prizes;
}

// Settle an Oracle round and distribute prizes
export async function settleOracleRound(
  roundId: number,
  winningTokenMint: string,
  winningPriceChange: number,
  settlementData: Record<string, unknown>
): Promise<{
  success: boolean;
  winnersCount?: number;
  distributions?: PrizeDistribution[];
  error?: string;
}> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Verify round exists and is active
    const round = await sql`
      SELECT id, status, prize_pool_lamports FROM oracle_rounds WHERE id = ${roundId}
    `;

    if ((round as unknown[]).length === 0) {
      return { success: false, error: "Round not found" };
    }

    const roundData = (round as Array<Record<string, unknown>>)[0];
    if (roundData.status !== "active") {
      return { success: false, error: "Round is not active" };
    }

    const prizePoolLamports = BigInt((roundData.prize_pool_lamports as string) || "0");

    // Get winning predictions ordered by creation time (first-come)
    const winningPredictions = await sql`
      SELECT id, wallet, created_at
      FROM oracle_predictions
      WHERE round_id = ${roundId} AND token_mint = ${winningTokenMint}
      ORDER BY created_at ASC
    `;

    const winners = winningPredictions as Array<{
      id: number;
      wallet: string;
      created_at: string;
    }>;
    const winnersCount = winners.length;

    // Calculate prize distribution
    const prizeAmounts = calculatePrizeDistribution(winnersCount, prizePoolLamports);

    // Update each winning prediction with rank and prize
    const distributions: PrizeDistribution[] = [];

    for (let i = 0; i < winnersCount; i++) {
      const winner = winners[i];
      const rank = i + 1;
      const prizeLamports = prizeAmounts[i] || BigInt(0);

      // Update prediction with rank and prize
      await sql`
        UPDATE oracle_predictions
        SET is_winner = TRUE, prediction_rank = ${rank}, prize_lamports = ${prizeLamports.toString()}
        WHERE id = ${winner.id}
      `;

      // Credit winner's balance if prize > 0
      if (prizeLamports > BigInt(0)) {
        const creditResult = await creditOracleBalance(winner.wallet, prizeLamports, roundId);
        if (!creditResult.success) {
          console.error(
            `[Oracle] Failed to credit ${prizeLamports} lamports to ${winner.wallet} for round #${roundId}: ${creditResult.error}`
          );
        }
      }

      distributions.push({
        wallet: winner.wallet,
        rank,
        prizeLamports,
        prizeSol: Number(prizeLamports) / 1_000_000_000,
      });
    }

    // Update round with settlement data including prize distribution
    const extendedSettlementData = {
      ...settlementData,
      prizeDistributed: true,
      prizePoolLamports: prizePoolLamports.toString(),
      winnersCount,
      distributions: distributions.map((d) => ({
        wallet: d.wallet,
        rank: d.rank,
        prizeLamports: d.prizeLamports.toString(),
        prizeSol: d.prizeSol,
      })),
    };

    await sql`
      UPDATE oracle_rounds SET
        status = 'settled',
        winning_token_mint = ${winningTokenMint},
        winning_price_change = ${winningPriceChange},
        settlement_data = ${JSON.stringify(extendedSettlementData)},
        prize_distributed = TRUE
      WHERE id = ${roundId}
    `;

    return { success: true, winnersCount, distributions };
  } catch (error) {
    console.error("[Oracle] Error settling round:", error);
    return { success: false, error: "Failed to settle round" };
  }
}

// Credit balance to a wallet (internal function)
async function creditOracleBalance(
  wallet: string,
  amountLamports: bigint,
  roundId: number
): Promise<{ success: boolean; newBalance?: bigint; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Upsert balance record
    const result = await sql`
      INSERT INTO oracle_balances (wallet, balance_lamports, total_earned_lamports, updated_at)
      VALUES (${wallet}, ${amountLamports.toString()}, ${amountLamports.toString()}, NOW())
      ON CONFLICT (wallet) DO UPDATE SET
        balance_lamports = oracle_balances.balance_lamports + ${amountLamports.toString()},
        total_earned_lamports = oracle_balances.total_earned_lamports + ${amountLamports.toString()},
        updated_at = NOW()
      RETURNING balance_lamports
    `;

    const newBalance = BigInt(
      (result as Array<{ balance_lamports: string }>)[0]?.balance_lamports || "0"
    );
    return { success: true, newBalance };
  } catch (error) {
    console.error("[Oracle] Error crediting balance:", error);
    return { success: false, error: "Failed to credit balance" };
  }
}

// Cancel an Oracle round
export async function cancelOracleRound(
  roundId: number
): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    const result = await sql`
      UPDATE oracle_rounds SET status = 'cancelled'
      WHERE id = ${roundId} AND status = 'active'
      RETURNING id
    `;

    if ((result as unknown[]).length === 0) {
      return { success: false, error: "No active round found with that ID" };
    }

    return { success: true };
  } catch (error) {
    console.error("[Oracle] Error cancelling round:", error);
    return { success: false, error: "Failed to cancel round" };
  }
}

// Get Oracle history
export async function getOracleHistory(
  limit: number = 10,
  wallet?: string
): Promise<
  Array<{
    round: OracleRoundDB;
    userPrediction?: OraclePredictionDB;
  }>
> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    // Check if tables exist
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'oracle_rounds'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return [];
    }

    const rounds = await sql`
      SELECT r.*,
        (SELECT COUNT(*) FROM oracle_predictions WHERE round_id = r.id) as entry_count
      FROM oracle_rounds r
      WHERE r.status IN ('settled', 'cancelled')
      ORDER BY r.created_at DESC
      LIMIT ${limit}
    `;

    const results: Array<{
      round: OracleRoundDB;
      userPrediction?: OraclePredictionDB;
    }> = [];

    for (const row of rounds as Array<Record<string, unknown>>) {
      const round = parseOracleRoundRow(row);

      let userPrediction: OraclePredictionDB | undefined;
      if (wallet) {
        const prediction = await getUserOraclePrediction(round.id, wallet);
        if (prediction) {
          userPrediction = prediction;
        }
      }

      results.push({ round, userPrediction });
    }

    return results;
  } catch (error) {
    console.error("[Oracle] Error getting history:", error);
    return [];
  }
}

// Get prediction counts by token for a round
export async function getOraclePredictionCounts(roundId: number): Promise<Record<string, number>> {
  const sql = await getSql();
  if (!sql) return {};

  try {
    // Use COALESCE to group by outcome_id for outcome-based markets,
    // or token_mint for price prediction markets
    const result = await sql`
      SELECT
        COALESCE(NULLIF(outcome_id, ''), NULLIF(token_mint, ''), 'unknown') as choice_key,
        COUNT(*) as count
      FROM oracle_predictions
      WHERE round_id = ${roundId}
      GROUP BY choice_key
    `;

    const counts: Record<string, number> = {};
    for (const row of result as Array<{ choice_key: string; count: string }>) {
      counts[row.choice_key] = safeParseInt(row.count, 0);
    }

    return counts;
  } catch (error) {
    console.error("[Oracle] Error getting prediction counts:", error);
    return {};
  }
}

// Get Oracle leaderboard - top predictors by wins
export interface OracleLeaderboardEntry {
  wallet: string;
  wins: number;
  totalPredictions: number;
  winRate: number;
  lastWin?: Date;
}

export async function getOracleLeaderboard(limit: number = 10): Promise<OracleLeaderboardEntry[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    // Check if tables exist
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'oracle_predictions'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return [];
    }

    const result = await sql`
      SELECT
        wallet,
        COUNT(*) FILTER (WHERE is_winner = true) as wins,
        COUNT(*) as total_predictions,
        MAX(created_at) FILTER (WHERE is_winner = true) as last_win
      FROM oracle_predictions
      GROUP BY wallet
      HAVING COUNT(*) FILTER (WHERE is_winner = true) > 0
      ORDER BY wins DESC, total_predictions ASC
      LIMIT ${limit}
    `;

    return (result as Array<Record<string, unknown>>).map((row) => ({
      wallet: row.wallet as string,
      wins: safeParseInt(row.wins as string, 0),
      totalPredictions: safeParseInt(row.total_predictions as string, 0),
      winRate:
        safeParseInt(row.wins as string, 0) /
        Math.max(1, safeParseInt(row.total_predictions as string, 1)),
      lastWin: row.last_win ? new Date(row.last_win as string) : undefined,
    }));
  } catch (error) {
    console.error("[Oracle] Error getting leaderboard:", error);
    return [];
  }
}

// Get user's Oracle stats
export async function getUserOracleStats(
  wallet: string
): Promise<{ wins: number; total: number; rank: number } | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'oracle_predictions'
      )
    `;

    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) {
      return null;
    }

    // Get user stats
    const userStats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_winner = true) as wins,
        COUNT(*) as total
      FROM oracle_predictions
      WHERE wallet = ${wallet}
    `;

    const stats = (userStats as Array<Record<string, unknown>>)[0];
    const wins = safeParseInt(stats?.wins as string, 0);
    const total = safeParseInt(stats?.total as string, 0);

    if (total === 0) return null;

    // Get rank
    const rankResult = await sql`
      SELECT COUNT(*) + 1 as rank
      FROM (
        SELECT wallet, COUNT(*) FILTER (WHERE is_winner = true) as wins
        FROM oracle_predictions
        GROUP BY wallet
        HAVING COUNT(*) FILTER (WHERE is_winner = true) > ${wins}
      ) as better_wallets
    `;

    const rank = safeParseInt((rankResult as Array<{ rank: string }>)[0]?.rank, 0);

    return { wins, total, rank };
  } catch (error) {
    console.error("[Oracle] Error getting user stats:", error);
    return null;
  }
}

// ============================================================================
// ORACLE BALANCE & CLAIM MANAGEMENT
// ============================================================================

// Get user's Oracle balance
export async function getOracleBalance(wallet: string): Promise<OracleBalanceDB | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const result = await sql`
      SELECT * FROM oracle_balances WHERE wallet = ${wallet}
    `;

    if ((result as unknown[]).length === 0) return null;

    const row = (result as Array<Record<string, unknown>>)[0];
    return {
      wallet: row.wallet as string,
      balanceLamports: BigInt((row.balance_lamports as string) || "0"),
      totalEarnedLamports: BigInt((row.total_earned_lamports as string) || "0"),
      totalClaimedLamports: BigInt((row.total_claimed_lamports as string) || "0"),
      lastClaimAt: row.last_claim_at ? new Date(row.last_claim_at as string) : undefined,
      updatedAt: new Date(row.updated_at as string),
    };
  } catch (error) {
    console.error("[Oracle] Error getting balance:", error);
    return null;
  }
}

// Create a claim request
export async function createOracleClaimRequest(
  wallet: string
): Promise<{ success: boolean; claimId?: number; amountLamports?: bigint; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Get current balance
    const balance = await getOracleBalance(wallet);
    if (!balance || balance.balanceLamports <= BigInt(0)) {
      return { success: false, error: "No balance to claim" };
    }

    // Minimum claim amount: 0.001 SOL (1,000,000 lamports)
    const minClaimLamports = BigInt(1_000_000);
    if (balance.balanceLamports < minClaimLamports) {
      return { success: false, error: "Balance below minimum claim amount (0.001 SOL)" };
    }

    // Check for existing pending claim
    const pendingCheck = await sql`
      SELECT id FROM oracle_claims
      WHERE wallet = ${wallet} AND status IN ('pending', 'processing')
      LIMIT 1
    `;

    if ((pendingCheck as unknown[]).length > 0) {
      return { success: false, error: "You already have a pending claim" };
    }

    const amountLamports = balance.balanceLamports;

    // Create claim request and zero out balance atomically using a CTE
    // This ensures both operations happen in a single transaction
    const claimResult = await sql`
      WITH new_claim AS (
        INSERT INTO oracle_claims (wallet, amount_lamports, status)
        VALUES (${wallet}, ${amountLamports.toString()}, 'pending')
        RETURNING id
      ),
      update_balance AS (
        UPDATE oracle_balances SET
          balance_lamports = 0,
          updated_at = NOW()
        WHERE wallet = ${wallet}
        RETURNING wallet
      )
      SELECT id FROM new_claim
    `;

    const claimId = (claimResult as Array<{ id: number }>)[0]?.id;

    if (!claimId) {
      return { success: false, error: "Failed to create claim record" };
    }

    return { success: true, claimId, amountLamports };
  } catch (error) {
    console.error("[Oracle] Error creating claim:", error);
    return { success: false, error: "Failed to create claim request" };
  }
}

// Get pending claim for a wallet
export async function getOraclePendingClaim(wallet: string): Promise<OracleClaimDB | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const result = await sql`
      SELECT * FROM oracle_claims
      WHERE wallet = ${wallet} AND status IN ('pending', 'processing')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if ((result as unknown[]).length === 0) return null;

    const row = (result as Array<Record<string, unknown>>)[0];
    return {
      id: row.id as number,
      wallet: row.wallet as string,
      amountLamports: BigInt((row.amount_lamports as string) || "0"),
      txSignature: row.tx_signature as string | undefined,
      status: row.status as "pending" | "processing" | "completed" | "failed",
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  } catch (error) {
    console.error("[Oracle] Error getting pending claim:", error);
    return null;
  }
}

// Get all pending claims (for admin processing)
export async function getAllPendingOracleClaims(): Promise<OracleClaimDB[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT * FROM oracle_claims
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `;

    return (result as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as number,
      wallet: row.wallet as string,
      amountLamports: BigInt((row.amount_lamports as string) || "0"),
      txSignature: row.tx_signature as string | undefined,
      status: row.status as "pending" | "processing" | "completed" | "failed",
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    }));
  } catch (error) {
    console.error("[Oracle] Error getting pending claims:", error);
    return [];
  }
}

// Mark claim as processing
export async function markOracleClaimProcessing(
  claimId: number
): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    const result = await sql`
      UPDATE oracle_claims SET status = 'processing'
      WHERE id = ${claimId} AND status = 'pending'
      RETURNING id
    `;

    if ((result as unknown[]).length === 0) {
      return { success: false, error: "Claim not found or already processing" };
    }

    return { success: true };
  } catch (error) {
    console.error("[Oracle] Error marking claim processing:", error);
    return { success: false, error: "Failed to update claim" };
  }
}

// Complete a claim (after admin sends SOL)
export async function completeOracleClaim(
  claimId: number,
  txSignature: string
): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Get claim details
    const claimResult = await sql`
      SELECT wallet, amount_lamports FROM oracle_claims
      WHERE id = ${claimId} AND status IN ('pending', 'processing')
    `;

    if ((claimResult as unknown[]).length === 0) {
      return { success: false, error: "Claim not found or already completed" };
    }

    const claim = (claimResult as Array<{ wallet: string; amount_lamports: string }>)[0];

    // Update claim as completed
    await sql`
      UPDATE oracle_claims SET
        status = 'completed',
        tx_signature = ${txSignature},
        completed_at = NOW()
      WHERE id = ${claimId}
    `;

    // Update balance stats
    await sql`
      UPDATE oracle_balances SET
        total_claimed_lamports = total_claimed_lamports + ${claim.amount_lamports},
        last_claim_at = NOW(),
        updated_at = NOW()
      WHERE wallet = ${claim.wallet}
    `;

    return { success: true };
  } catch (error) {
    console.error("[Oracle] Error completing claim:", error);
    return { success: false, error: "Failed to complete claim" };
  }
}

// Fail a claim (return balance to wallet)
export async function failOracleClaim(
  claimId: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Get claim details
    const claimResult = await sql`
      SELECT wallet, amount_lamports FROM oracle_claims
      WHERE id = ${claimId} AND status IN ('pending', 'processing')
    `;

    if ((claimResult as unknown[]).length === 0) {
      return { success: false, error: "Claim not found or already completed" };
    }

    const claim = (claimResult as Array<{ wallet: string; amount_lamports: string }>)[0];

    // Update claim as failed
    await sql`
      UPDATE oracle_claims SET
        status = 'failed',
        tx_signature = ${reason},
        completed_at = NOW()
      WHERE id = ${claimId}
    `;

    // Return balance to wallet
    await sql`
      UPDATE oracle_balances SET
        balance_lamports = balance_lamports + ${claim.amount_lamports},
        updated_at = NOW()
      WHERE wallet = ${claim.wallet}
    `;

    return { success: true };
  } catch (error) {
    console.error("[Oracle] Error failing claim:", error);
    return { success: false, error: "Failed to fail claim" };
  }
}

// Get claim history for a wallet
export async function getOracleClaimHistory(
  wallet: string,
  limit: number = 10
): Promise<OracleClaimDB[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT * FROM oracle_claims
      WHERE wallet = ${wallet}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return (result as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as number,
      wallet: row.wallet as string,
      amountLamports: BigInt((row.amount_lamports as string) || "0"),
      txSignature: row.tx_signature as string | undefined,
      status: row.status as "pending" | "processing" | "completed" | "failed",
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    }));
  } catch (error) {
    console.error("[Oracle] Error getting claim history:", error);
    return [];
  }
}

// Get user's prize earnings for a specific round
export async function getUserRoundPrize(
  roundId: number,
  wallet: string
): Promise<{ prizeLamports: bigint; rank: number } | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const result = await sql`
      SELECT prize_lamports, prediction_rank
      FROM oracle_predictions
      WHERE round_id = ${roundId} AND wallet = ${wallet} AND is_winner = TRUE
    `;

    if ((result as unknown[]).length === 0) return null;

    const row = (result as Array<Record<string, unknown>>)[0];
    return {
      prizeLamports: BigInt((row.prize_lamports as string) || "0"),
      rank: row.prediction_rank as number,
    };
  } catch (error) {
    console.error("[Oracle] Error getting user round prize:", error);
    return null;
  }
}

// ============================================================================
// ORACLE TOURNAMENT MANAGEMENT
// ============================================================================

// Create a tournament
export async function createOracleTournament(
  name: string,
  description: string | undefined,
  startTime: Date,
  endTime: Date,
  prizePoolLamports: bigint,
  prizeDistribution: Array<{ rank: number; pct: number }>,
  scoringType: string,
  maxParticipants: number | undefined,
  createdBy: string
): Promise<{ success: boolean; tournamentId?: number; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    await initializeOracleTables();

    const result = await sql`
      INSERT INTO oracle_tournaments (
        name, description, start_time, end_time, status,
        prize_pool_lamports, prize_distribution, scoring_type,
        max_participants, created_by
      )
      VALUES (
        ${name}, ${description || null}, ${startTime.toISOString()}, ${endTime.toISOString()},
        ${startTime <= new Date() ? "active" : "upcoming"},
        ${prizePoolLamports.toString()}, ${JSON.stringify(prizeDistribution)},
        ${scoringType}, ${maxParticipants || null}, ${createdBy}
      )
      RETURNING id
    `;

    const tournamentId = (result as Array<{ id: number }>)[0]?.id;
    return { success: true, tournamentId };
  } catch (error) {
    console.error("[Oracle] Error creating tournament:", error);
    return { success: false, error: "Failed to create tournament" };
  }
}

// Get tournaments by status
export async function getOracleTournaments(status?: string): Promise<OracleTournamentDB[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'oracle_tournaments'
      )
    `;
    if (!(tableCheck as Array<{ exists: boolean }>)[0]?.exists) return [];

    let result;
    if (status) {
      result = await sql`
        SELECT t.*,
          (SELECT COUNT(*) FROM oracle_tournament_entries WHERE tournament_id = t.id) as participant_count
        FROM oracle_tournaments t
        WHERE t.status = ${status}
        ORDER BY t.start_time ASC
      `;
    } else {
      result = await sql`
        SELECT t.*,
          (SELECT COUNT(*) FROM oracle_tournament_entries WHERE tournament_id = t.id) as participant_count
        FROM oracle_tournaments t
        WHERE t.status IN ('upcoming', 'active')
        ORDER BY t.start_time ASC
      `;
    }

    return (result as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as number,
      name: row.name as string,
      description: row.description as string | undefined,
      startTime: new Date(row.start_time as string),
      endTime: new Date(row.end_time as string),
      status: row.status as string,
      prizePoolLamports: BigInt((row.prize_pool_lamports as string) || "0"),
      prizeDistribution: (row.prize_distribution || []) as Array<{ rank: number; pct: number }>,
      scoringType: (row.scoring_type as string) || "op_earned",
      maxParticipants: row.max_participants as number | undefined,
      createdBy: row.created_by as string,
      createdAt: new Date(row.created_at as string),
    }));
  } catch (error) {
    console.error("[Oracle] Error getting tournaments:", error);
    return [];
  }
}

// Join a tournament
export async function joinOracleTournament(
  tournamentId: number,
  wallet: string
): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Check tournament exists and is active/upcoming
    const tournament = await sql`
      SELECT id, status, max_participants FROM oracle_tournaments
      WHERE id = ${tournamentId}
    `;

    if ((tournament as unknown[]).length === 0) {
      return { success: false, error: "Tournament not found" };
    }

    const t = (tournament as Array<Record<string, unknown>>)[0];
    if (t.status !== "active" && t.status !== "upcoming") {
      return { success: false, error: "Tournament is not accepting entries" };
    }

    // Check max participants
    if (t.max_participants) {
      const countResult = await sql`
        SELECT COUNT(*) as count FROM oracle_tournament_entries
        WHERE tournament_id = ${tournamentId}
      `;
      const count = safeParseInt((countResult as Array<{ count: string }>)[0]?.count, 0);
      if (count >= (t.max_participants as number)) {
        return { success: false, error: "Tournament is full" };
      }
    }

    // Check if already joined
    const existing = await sql`
      SELECT tournament_id FROM oracle_tournament_entries
      WHERE tournament_id = ${tournamentId} AND wallet = ${wallet}
    `;

    if ((existing as unknown[]).length > 0) {
      return { success: false, error: "Already joined this tournament" };
    }

    // Join
    await sql`
      INSERT INTO oracle_tournament_entries (tournament_id, wallet)
      VALUES (${tournamentId}, ${wallet})
    `;

    return { success: true };
  } catch (error) {
    console.error("[Oracle] Error joining tournament:", error);
    return { success: false, error: "Failed to join tournament" };
  }
}

// Get tournament leaderboard
export async function getOracleTournamentLeaderboard(
  tournamentId: number,
  limit: number = 20
): Promise<OracleTournamentEntryDB[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT * FROM oracle_tournament_entries
      WHERE tournament_id = ${tournamentId}
      ORDER BY score DESC, markets_won DESC
      LIMIT ${limit}
    `;

    return (result as Array<Record<string, unknown>>).map((row) => ({
      tournamentId: row.tournament_id as number,
      wallet: row.wallet as string,
      score: safeParseInt(row.score as string, 0),
      marketsEntered: safeParseInt(row.markets_entered as string, 0),
      marketsWon: safeParseInt(row.markets_won as string, 0),
      finalRank: row.final_rank as number | undefined,
      prizeLamports: row.prize_lamports ? BigInt((row.prize_lamports as string) || "0") : undefined,
    }));
  } catch (error) {
    console.error("[Oracle] Error getting tournament leaderboard:", error);
    return [];
  }
}

// Update tournament entry score (called when a user wins/enters a market during a tournament)
export async function updateTournamentScore(
  tournamentId: number,
  wallet: string,
  opEarned: number,
  won: boolean
): Promise<void> {
  const sql = await getSql();
  if (!sql) return;

  try {
    await sql`
      UPDATE oracle_tournament_entries SET
        score = score + ${opEarned},
        markets_entered = markets_entered + 1,
        markets_won = markets_won + ${won ? 1 : 0}
      WHERE tournament_id = ${tournamentId} AND wallet = ${wallet}
    `;
  } catch (error) {
    console.error("[Oracle] Error updating tournament score:", error);
  }
}

// Settle a round with winning outcome (generalized for all market types)
export async function settleOracleRoundWithOutcome(
  roundId: number,
  winningOutcomeId: string,
  settlementData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Fetch the round to validate the outcome ID
    const roundRows = await sql`
      SELECT market_config FROM oracle_rounds WHERE id = ${roundId} AND status = 'active'
    `;

    if (roundRows.length === 0) {
      return { success: false, error: `Round ${roundId} not found or not active` };
    }

    // Validate that the outcome ID exists in the market's configured outcomes
    const roundRow = roundRows[0] as Record<string, unknown>;
    const marketConfig = roundRow.market_config as Record<string, unknown> | null;
    if (marketConfig) {
      const outcomes = (marketConfig.outcomes ?? []) as Array<{ id: string }>;
      if (outcomes.length > 0 && !outcomes.some((o) => o.id === winningOutcomeId)) {
        return {
          success: false,
          error: `Outcome "${winningOutcomeId}" not in configured outcomes: [${outcomes.map((o) => o.id).join(", ")}]`,
        };
      }
    }

    // Get prize pool and winning predictions for SOL prize distribution
    const roundInfo = await sql`
      SELECT prize_pool_lamports FROM oracle_rounds WHERE id = ${roundId}
    `;
    const prizePoolLamports = BigInt(
      ((roundInfo[0] as Record<string, unknown>)?.prize_pool_lamports as string) || "0"
    );

    // Get winning predictions (those that picked this outcome)
    const winningPredictions = await sql`
      SELECT id, wallet, created_at
      FROM oracle_predictions
      WHERE round_id = ${roundId} AND outcome_id = ${winningOutcomeId}
      ORDER BY created_at ASC
    `;

    const winners = winningPredictions as Array<{
      id: number;
      wallet: string;
      created_at: string;
    }>;
    const winnersCount = winners.length;

    // Distribute SOL prizes if pool exists
    const distributions: PrizeDistribution[] = [];
    if (prizePoolLamports > BigInt(0) && winnersCount > 0) {
      const prizeAmounts = calculatePrizeDistribution(winnersCount, prizePoolLamports);

      for (let i = 0; i < winnersCount; i++) {
        const winner = winners[i];
        const rank = i + 1;
        const prizeLamports = prizeAmounts[i] || BigInt(0);

        await sql`
          UPDATE oracle_predictions
          SET is_winner = TRUE, prediction_rank = ${rank}, prize_lamports = ${prizeLamports.toString()}
          WHERE id = ${winner.id}
        `;

        if (prizeLamports > BigInt(0)) {
          const creditResult = await creditOracleBalance(winner.wallet, prizeLamports, roundId);
          if (!creditResult.success) {
            console.error(
              `[Oracle] Failed to credit ${prizeLamports} lamports to ${winner.wallet} for round #${roundId}: ${creditResult.error}`
            );
          }
        }

        distributions.push({
          wallet: winner.wallet,
          rank,
          prizeLamports,
          prizeSol: Number(prizeLamports) / 1_000_000_000,
        });
      }
    } else if (winnersCount > 0) {
      // No SOL prize pool, but still mark winners
      for (let i = 0; i < winnersCount; i++) {
        const winner = winners[i];
        await sql`
          UPDATE oracle_predictions
          SET is_winner = TRUE, prediction_rank = ${i + 1}
          WHERE id = ${winner.id}
        `;
      }
    }

    const extendedSettlementData = {
      ...settlementData,
      prizeDistributed: prizePoolLamports > BigInt(0),
      prizePoolLamports: prizePoolLamports.toString(),
      winnersCount,
      distributions: distributions.map((d) => ({
        wallet: d.wallet,
        rank: d.rank,
        prizeLamports: d.prizeLamports.toString(),
        prizeSol: d.prizeSol,
      })),
    };

    await sql`
      UPDATE oracle_rounds SET
        status = 'settled',
        winning_outcome_id = ${winningOutcomeId},
        settlement_data = ${JSON.stringify(extendedSettlementData)},
        prize_distributed = ${prizePoolLamports > BigInt(0)}
      WHERE id = ${roundId} AND status = 'active'
    `;

    return { success: true };
  } catch (error) {
    console.error("[Oracle] Error settling round with outcome:", error);
    return { success: false, error: "Failed to settle round" };
  }
}

// Get all predictions for a round
export async function getOracleRoundPredictions(roundId: number): Promise<OraclePredictionDB[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT * FROM oracle_predictions
      WHERE round_id = ${roundId}
      ORDER BY created_at ASC
    `;

    return (result as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as number,
      roundId: row.round_id as number,
      wallet: row.wallet as string,
      tokenMint: row.token_mint as string,
      isWinner: row.is_winner as boolean,
      predictionRank: row.prediction_rank as number | undefined,
      prizeLamports: BigInt((row.prize_lamports as string) || "0"),
      claimed: (row.claimed as boolean) || false,
      createdAt: new Date(row.created_at as string),
      outcomeId: row.outcome_id as string | undefined,
      opWagered: safeParseInt(row.op_wagered as string, 0),
      opPayout: safeParseInt(row.op_payout as string, 0),
    }));
  } catch (error) {
    console.error("[Oracle] Error getting round predictions:", error);
    return [];
  }
}

// Update prediction with OP payout
export async function updatePredictionOPPayout(
  predictionId: number,
  opPayout: number,
  isWinner: boolean,
  rank?: number
): Promise<{ success: boolean; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not configured" };

  try {
    // Use RETURNING to confirm the row was actually updated
    const result = await sql`
      UPDATE oracle_predictions SET
        op_payout = ${opPayout},
        is_winner = ${isWinner},
        prediction_rank = ${rank || null}
      WHERE id = ${predictionId}
      RETURNING id
    `;

    if (result.length === 0) {
      return { success: false, error: `Prediction ${predictionId} not found` };
    }

    return { success: true };
  } catch (error) {
    console.error("[Oracle] Error updating prediction OP payout:", error);
    return { success: false, error: error instanceof Error ? error.message : "Database error" };
  }
}

// Get user's active predictions across all markets
export async function getUserActivePredictions(
  wallet: string
): Promise<Array<{ prediction: OraclePredictionDB; round: OracleRoundDB }>> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT p.*, r.status as round_status, r.end_time as round_end_time,
             r.token_options, r.market_type, r.market_config,
             r.start_time as round_start_time, r.prize_pool_lamports,
             r.prize_distributed, r.created_at as round_created_at,
             r.winning_token_mint, r.winning_price_change,
             r.settlement_data, r.auto_resolve, r.resolution_source,
             r.created_by, r.entry_cost_op, r.is_tournament_market,
             r.tournament_id, r.winning_outcome_id,
             (SELECT COUNT(*) FROM oracle_predictions WHERE round_id = r.id) as round_entry_count
      FROM oracle_predictions p
      JOIN oracle_rounds r ON p.round_id = r.id
      WHERE p.wallet = ${wallet}
      AND r.status = 'active'
      ORDER BY r.end_time ASC
    `;

    return (result as Array<Record<string, unknown>>).map((row) => ({
      prediction: {
        id: row.id as number,
        roundId: row.round_id as number,
        wallet: row.wallet as string,
        tokenMint: row.token_mint as string,
        isWinner: row.is_winner as boolean,
        predictionRank: row.prediction_rank as number | undefined,
        prizeLamports: BigInt((row.prize_lamports as string) || "0"),
        claimed: (row.claimed as boolean) || false,
        createdAt: new Date(row.created_at as string),
        outcomeId: row.outcome_id as string | undefined,
        opWagered: safeParseInt(row.op_wagered as string, 0),
        opPayout: safeParseInt(row.op_payout as string, 0),
      },
      round: {
        id: row.round_id as number,
        status: row.round_status as "active" | "settled" | "cancelled",
        startTime: new Date(row.round_start_time as string),
        endTime: new Date(row.round_end_time as string),
        tokenOptions: row.token_options as OracleTokenOptionDB[],
        winningTokenMint: row.winning_token_mint as string | undefined,
        winningPriceChange: row.winning_price_change
          ? safeParseFloat(row.winning_price_change as string, 0)
          : undefined,
        settlementData: row.settlement_data as Record<string, unknown> | undefined,
        entryCount: safeParseInt(row.round_entry_count as string, 0),
        prizePoolLamports: BigInt((row.prize_pool_lamports as string) || "0"),
        prizeDistributed: (row.prize_distributed as boolean) || false,
        createdAt: new Date(row.round_created_at as string),
        marketType: (row.market_type as string) || "price_prediction",
        marketConfig: row.market_config as Record<string, unknown> | undefined,
        autoResolve: (row.auto_resolve as boolean) || false,
        resolutionSource: row.resolution_source as string | undefined,
        createdBy: (row.created_by as string) || "admin",
        entryCostOp: safeParseInt(row.entry_cost_op as string, 100),
        isTournamentMarket: (row.is_tournament_market as boolean) || false,
        tournamentId: row.tournament_id as number | undefined,
        winningOutcomeId: row.winning_outcome_id as string | undefined,
      },
    }));
  } catch (error) {
    console.error("[Oracle] Error getting user active predictions:", error);
    return [];
  }
}

// Get user's recent prediction results
export async function getUserRecentResults(
  wallet: string,
  limit: number = 20
): Promise<Array<{ prediction: OraclePredictionDB; round: OracleRoundDB }>> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const result = await sql`
      SELECT p.*, r.status as round_status, r.end_time as round_end_time,
             r.token_options, r.market_type, r.market_config,
             r.start_time as round_start_time, r.prize_pool_lamports,
             r.prize_distributed, r.created_at as round_created_at,
             r.winning_token_mint, r.winning_price_change,
             r.settlement_data, r.auto_resolve, r.resolution_source,
             r.created_by, r.entry_cost_op, r.is_tournament_market,
             r.tournament_id, r.winning_outcome_id,
             (SELECT COUNT(*) FROM oracle_predictions WHERE round_id = r.id) as round_entry_count
      FROM oracle_predictions p
      JOIN oracle_rounds r ON p.round_id = r.id
      WHERE p.wallet = ${wallet}
      AND r.status = 'settled'
      ORDER BY r.end_time DESC
      LIMIT ${limit}
    `;

    return (result as Array<Record<string, unknown>>).map((row) => ({
      prediction: {
        id: row.id as number,
        roundId: row.round_id as number,
        wallet: row.wallet as string,
        tokenMint: row.token_mint as string,
        isWinner: row.is_winner as boolean,
        predictionRank: row.prediction_rank as number | undefined,
        prizeLamports: BigInt((row.prize_lamports as string) || "0"),
        claimed: (row.claimed as boolean) || false,
        createdAt: new Date(row.created_at as string),
        outcomeId: row.outcome_id as string | undefined,
        opWagered: safeParseInt(row.op_wagered as string, 0),
        opPayout: safeParseInt(row.op_payout as string, 0),
      },
      round: {
        id: row.round_id as number,
        status: row.round_status as "active" | "settled" | "cancelled",
        startTime: new Date(row.round_start_time as string),
        endTime: new Date(row.round_end_time as string),
        tokenOptions: row.token_options as OracleTokenOptionDB[],
        winningTokenMint: row.winning_token_mint as string | undefined,
        winningPriceChange: row.winning_price_change
          ? safeParseFloat(row.winning_price_change as string, 0)
          : undefined,
        settlementData: row.settlement_data as Record<string, unknown> | undefined,
        entryCount: safeParseInt(row.round_entry_count as string, 0),
        prizePoolLamports: BigInt((row.prize_pool_lamports as string) || "0"),
        prizeDistributed: (row.prize_distributed as boolean) || false,
        createdAt: new Date(row.round_created_at as string),
        marketType: (row.market_type as string) || "price_prediction",
        marketConfig: row.market_config as Record<string, unknown> | undefined,
        autoResolve: (row.auto_resolve as boolean) || false,
        resolutionSource: row.resolution_source as string | undefined,
        createdBy: (row.created_by as string) || "admin",
        entryCostOp: safeParseInt(row.entry_cost_op as string, 100),
        isTournamentMarket: (row.is_tournament_market as boolean) || false,
        tournamentId: row.tournament_id as number | undefined,
        winningOutcomeId: row.winning_outcome_id as string | undefined,
      },
    }));
  } catch (error) {
    console.error("[Oracle] Error getting user recent results:", error);
    return [];
  }
}

// ============================================================================
// ADMIN SETTINGS (Simple key-value store for global settings)
// ============================================================================

// Initialize admin settings table
async function initializeSettingsTable(): Promise<void> {
  const sql = await getSql();
  if (!sql) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
  } catch (error) {
    console.error("[Settings] Error initializing table:", error);
  }
}

// Get a setting value
export async function getSetting(key: string): Promise<string | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    await initializeSettingsTable();
    const result = await sql`
      SELECT value FROM admin_settings WHERE key = ${key}
    `;
    return (result as Array<{ value: string }>)[0]?.value || null;
  } catch (error) {
    console.error("[Settings] Error getting setting:", error);
    return null;
  }
}

// Set a setting value
export async function setSetting(key: string, value: string): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    await initializeSettingsTable();
    await sql`
      INSERT INTO admin_settings (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `;
    return true;
  } catch (error) {
    console.error("[Settings] Error setting value:", error);
    return false;
  }
}

// Get events cleared timestamp (returns 0 if not set)
export async function getEventsClearedTimestamp(): Promise<number> {
  const value = await getSetting("events_cleared_after");
  return value ? parseInt(value, 10) : 0;
}

// Set events cleared timestamp
export async function setEventsClearedTimestamp(timestamp: number): Promise<boolean> {
  return setSetting("events_cleared_after", timestamp.toString());
}

// ============================================
// Twitter/Agent Tracking Functions
// ============================================
// Persists processed tweet IDs and agent state to survive serverless restarts.
// Prevents duplicate replies, intro tweets, and re-processing old mentions.

let twitterTrackingTableInitialized = false;

/**
 * Initialize Twitter tracking tables for agent state persistence.
 * Creates tables for:
 * - processed_tweets: Track tweets already replied to
 * - agent_cursors: Track pagination cursors (last mention ID, etc.)
 * - agent_state: Track agent state (has posted intro, etc.)
 */
export async function initializeTwitterTrackingTables(): Promise<boolean> {
  if (twitterTrackingTableInitialized) return true;

  const sql = await getSql();
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

    twitterTrackingTableInitialized = true;
    console.log("[Neon] Twitter tracking tables initialized");
    return true;
  } catch (error) {
    console.error("[Neon] Error creating Twitter tracking tables:", error);
    return false;
  }
}

/**
 * Check if a tweet has already been processed by an agent.
 * Used to prevent duplicate replies.
 */
export async function isTwitterProcessed(
  tweetId: string,
  agentId: string = "bagsy"
): Promise<boolean> {
  const sql = await getSql();
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
    console.error("[Neon] Error checking processed tweet:", error);
    return false;
  }
}

/**
 * Mark a tweet as processed by an agent.
 * Prevents future duplicate actions on the same tweet.
 */
export async function markTwitterProcessed(
  tweetId: string,
  agentId: string = "bagsy",
  actionType: string = "reply"
): Promise<boolean> {
  const sql = await getSql();
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
    console.error("[Neon] Error marking tweet processed:", error);
    return false;
  }
}

/**
 * Get a pagination cursor for an agent (e.g., last mention ID).
 */
export async function getAgentCursor(agentId: string, cursorType: string): Promise<string | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    await initializeTwitterTrackingTables();
    const id = `${agentId}:${cursorType}`;
    const result = await sql`
      SELECT cursor_value FROM agent_cursors WHERE id = ${id} LIMIT 1
    `;
    return (result as Array<{ cursor_value: string }>)[0]?.cursor_value || null;
  } catch (error) {
    console.error("[Neon] Error getting agent cursor:", error);
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
  const sql = await getSql();
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
    console.error("[Neon] Error setting agent cursor:", error);
    return false;
  }
}

/**
 * Check if an agent has performed a one-time action (e.g., posted intro).
 */
export async function getAgentState(agentId: string, stateKey: string): Promise<string | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    await initializeTwitterTrackingTables();
    const id = `${agentId}:${stateKey}`;
    const result = await sql`
      SELECT state_value FROM agent_state WHERE id = ${id} LIMIT 1
    `;
    return (result as Array<{ state_value: string }>)[0]?.state_value || null;
  } catch (error) {
    console.error("[Neon] Error getting agent state:", error);
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
  const sql = await getSql();
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
    console.error("[Neon] Error setting agent state:", error);
    return false;
  }
}

/**
 * Clean up old processed tweets (older than 7 days) to prevent table bloat.
 */
export async function cleanupOldProcessedTweets(): Promise<number> {
  const sql = await getSql();
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
      console.log(`[Neon] Cleaned up ${count} old processed tweets`);
    }
    return count;
  } catch (error) {
    console.error("[Neon] Error cleaning up old processed tweets:", error);
    return 0;
  }
}

/**
 * Get all processed tweet IDs for an agent (for loading into memory cache).
 * Returns tweets from the last 7 days.
 */
export async function getProcessedTweetIds(agentId: string = "bagsy"): Promise<Set<string>> {
  const sql = await getSql();
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
    console.error("[Neon] Error fetching processed tweet IDs:", error);
    return new Set();
  }
}
