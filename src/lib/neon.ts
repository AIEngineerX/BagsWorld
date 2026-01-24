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
    console.log("[Neon] Using NETLIFY_DATABASE_URL");
    try {
      // Use string variable to prevent webpack from analyzing the import
      const moduleName = "@netlify/neon";
      // eslint-disable-next-line
      const { neon } = require(moduleName);
      return neon();
    } catch (error) {
      console.log("[Neon] Netlify Neon module not available, trying direct connection...", error);
    }
  }

  // Fall back to direct Neon connection with DATABASE_URL (check multiple env var names)
  const directUrl =
    process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
  if (directUrl) {
    console.log("[Neon] Using direct connection URL");
    try {
      const sql = neonServerless(directUrl);
      return sql as unknown as SqlFunction;
    } catch (error) {
      console.error("[Neon] Failed to connect with direct URL:", error);
      return null;
    }
  }

  console.log(
    "[Neon] No database configured (set DATABASE_URL, NEON_DATABASE_URL, or POSTGRES_URL)"
  );
  return null;
}

// Initialize database tables if they don't exist
export async function initializeDatabase(): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;

  try {
    console.log("[Neon] Initializing database tables...");

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

    // Verify table exists and check row count
    const countResult = await sql`SELECT COUNT(*) as count FROM tokens`;
    const count = (countResult as Array<{ count: string }>)[0]?.count || "0";
    console.log(`[Neon] Database initialized. Token count: ${count}`);

    return true;
  } catch (error) {
    console.error("[Neon] Error initializing database:", error);
    return false;
  }
}

// Fetch all global tokens (visible to everyone)
export async function getGlobalTokens(): Promise<GlobalToken[]> {
  const sql = await getSql();
  if (!sql) {
    console.log("[Neon] Not configured, using local storage only");
    return [];
  }

  try {
    // First ensure tables exist
    await initializeDatabase();

    console.log("[Neon] Fetching tokens from database...");
    const rows = await sql`SELECT * FROM tokens ORDER BY created_at DESC`;
    const tokenCount = (rows as unknown[])?.length ?? 0;
    console.log(`[Neon] Query returned ${tokenCount} tokens`);

    // Log first token for debugging (if any)
    if (tokenCount > 0) {
      const firstToken = (rows as GlobalToken[])[0];
      console.log(
        `[Neon] First token: ${firstToken.symbol} (${firstToken.mint?.slice(0, 8)}...) by ${firstToken.creator_wallet?.slice(0, 8)}...`
      );
    }

    return rows as GlobalToken[];
  } catch (error) {
    console.error("[Neon] Error fetching global tokens:", error);
    throw error; // Re-throw to see full error in status endpoint
  }
}

// Save a token to the global database
export async function saveGlobalToken(token: GlobalToken): Promise<boolean> {
  const sql = await getSql();
  if (!sql) {
    console.log("[Neon] Not configured, cannot save globally");
    return false;
  }

  try {
    // Ensure tables exist
    await initializeDatabase();

    // Prepare fee_shares as JSON string for JSONB column
    const feeSharesJson = token.fee_shares ? JSON.stringify(token.fee_shares) : "[]";

    console.log(`[Neon] Saving token: ${token.mint} (${token.symbol}) by ${token.creator_wallet}`);

    // Check if token already exists
    const existing = await sql`SELECT id, creator_wallet FROM tokens WHERE mint = ${token.mint}`;

    if ((existing as unknown[]).length > 0) {
      // Update existing token - INCLUDE creator_wallet in case it was missing
      console.log(`[Neon] Updating existing token: ${token.mint}`);
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
      console.log(`[Neon] Inserting new token: ${token.mint}`);
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

    console.log(`[Neon] Successfully saved token: ${token.symbol}`);
    return true;
  } catch (error) {
    console.error("[Neon] Save error:", error);
    console.error("[Neon] Token data:", JSON.stringify(token, null, 2));
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

    console.log("Rewards state table initialized");
    return true;
  } catch (error) {
    console.error("Error initializing rewards table:", error);
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
    console.log("[Casino] Initializing casino tables...");

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

    console.log("[Casino] Casino tables initialized successfully");
    return true;
  } catch (error) {
    console.error("[Casino] Error initializing casino tables:", error);
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
    console.log(`[Casino] Created raffle #${raffleId} with ${potSol} SOL pot`);

    return { success: true, raffleId };
  } catch (error) {
    console.error("[Casino] Error creating raffle:", error);
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

    const raffleId = (result as Array<{ id: number }>)[0].id;
    console.log(`[Casino] Raffle #${raffleId} paused`);
    return { success: true };
  } catch (error) {
    console.error("[Casino] Error pausing raffle:", error);
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

    const raffleId = (result as Array<{ id: number }>)[0].id;
    console.log(`[Casino] Raffle #${raffleId} resumed`);
    return { success: true };
  } catch (error) {
    console.error("[Casino] Error resuming raffle:", error);
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

    console.log(`[Casino] Raffle #${raffle.id} drawn. Winner: ${winner}, Prize: ${prizeSol} SOL`);

    return {
      success: true,
      winner,
      prize: prizeSol,
      entryCount,
    };
  } catch (error) {
    console.error("[Casino] Error drawing raffle:", error);
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
