// Neon database client for shared global state
// Uses dynamic import because @netlify/neon only exists in Netlify runtime

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
}

// Check if Neon is configured (Netlify sets NETLIFY_DATABASE_URL automatically)
export function isNeonConfigured(): boolean {
  return !!process.env.NETLIFY_DATABASE_URL;
}

// Dynamically get SQL client (returns null if not configured or not on Netlify)
async function getSql() {
  if (!isNeonConfigured()) {
    return null;
  }

  try {
    // Use string variable to prevent webpack from analyzing the import
    const moduleName = "@netlify/neon";
    // eslint-disable-next-line
    const { neon } = require(moduleName);
    return neon();
  } catch (error) {
    console.log("Neon module not available (not running on Netlify)");
    return null;
  }
}

// Fetch all global tokens (visible to everyone)
export async function getGlobalTokens(): Promise<GlobalToken[]> {
  const sql = await getSql();
  if (!sql) {
    console.log("Neon not configured, using local storage only");
    return [];
  }

  try {
    console.log("Executing query: SELECT * FROM tokens ORDER BY created_at DESC");
    const rows = await sql`SELECT * FROM tokens ORDER BY created_at DESC`;
    console.log("Query returned rows:", rows?.length ?? 0);
    return rows as GlobalToken[];
  } catch (error) {
    console.error("Error fetching global tokens:", error);
    throw error; // Re-throw to see full error in status endpoint
  }
}

// Save a token to the global database
export async function saveGlobalToken(token: GlobalToken): Promise<boolean> {
  const sql = await getSql();
  if (!sql) {
    console.log("Neon not configured, cannot save globally");
    return false;
  }

  try {
    // Check if token already exists
    const existing = await sql`SELECT id FROM tokens WHERE mint = ${token.mint}`;

    if (existing.length > 0) {
      // Update existing token
      await sql`
        UPDATE tokens SET
          name = ${token.name},
          symbol = ${token.symbol},
          description = ${token.description || null},
          image_url = ${token.image_url || null},
          fee_shares = ${JSON.stringify(token.fee_shares) || null},
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
          ${JSON.stringify(token.fee_shares) || null},
          ${token.lifetime_fees || null},
          ${token.market_cap || null},
          ${token.volume_24h || null},
          false,
          false
        )
      `;
    }

    return true;
  } catch (error) {
    console.error("Neon save error:", error);
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

// Casino Functions

interface CasinoRaffle {
  id: number;
  status: "active" | "drawing" | "completed";
  potLamports: number;
  entryCount: number;
  threshold: number;
  entries?: string[];
}

interface CasinoHistoryEntry {
  id: string;
  type: "raffle" | "wheel";
  result: string;
  amount: number;
  timestamp: number;
  isWin: boolean;
}

// Get active raffle status
export async function getCasinoRaffle(): Promise<CasinoRaffle | null> {
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

    if (!tableCheck[0]?.exists) {
      // Tables not created yet, return null to use in-memory fallback
      return null;
    }

    const result = await sql`
      SELECT r.*,
        (SELECT COUNT(*) FROM casino_raffle_entries WHERE raffle_id = r.id) as entry_count,
        (SELECT json_agg(wallet) FROM casino_raffle_entries WHERE raffle_id = r.id) as entries
      FROM casino_raffles r
      WHERE r.status = 'active'
      ORDER BY r.created_at DESC
      LIMIT 1
    `;

    if (result.length === 0) return null;

    return {
      id: result[0].id,
      status: result[0].status,
      potLamports: parseInt(result[0].pot_lamports || "0"),
      entryCount: parseInt(result[0].entry_count || "0"),
      threshold: parseFloat(result[0].threshold_sol || "0.5"),
      entries: result[0].entries || [],
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

    if (!tableCheck[0]?.exists) {
      return { success: false, error: "Casino not initialized" };
    }

    // Get active raffle
    const raffle = await sql`
      SELECT id FROM casino_raffles WHERE status = 'active' LIMIT 1
    `;

    if (raffle.length === 0) {
      return { success: false, error: "No active raffle" };
    }

    const raffleId = raffle[0].id;

    // Check if already entered
    const existing = await sql`
      SELECT id FROM casino_raffle_entries
      WHERE raffle_id = ${raffleId} AND wallet = ${wallet}
    `;

    if (existing.length > 0) {
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
      entryCount: parseInt(countResult[0]?.count || "0"),
    };
  } catch (error) {
    console.error("Error entering raffle:", error);
    return { success: false, error: "Failed to enter raffle" };
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

    if (!tableCheck[0]?.exists) {
      return null;
    }

    const result = await sql`
      SELECT balance_lamports FROM casino_pot ORDER BY updated_at DESC LIMIT 1
    `;

    if (result.length === 0) return null;

    return parseInt(result[0].balance_lamports) / 1e9; // Convert to SOL
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

    if (!tableCheck[0]?.exists) {
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

// Get casino history for a wallet
export async function getCasinoHistory(
  wallet: string
): Promise<CasinoHistoryEntry[] | null> {
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

    if (!tableCheck[0]?.exists) {
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
    for (const spin of wheelSpins) {
      history.push({
        id: `wheel-${spin.id}`,
        type: "wheel",
        result: spin.result,
        amount: parseFloat(spin.prize_sol || "0"),
        timestamp: new Date(spin.created_at).getTime(),
        isWin: spin.is_win,
      });
    }

    // Add raffle entries
    for (const entry of raffleEntries) {
      const isWinner = entry.winner_wallet === wallet;
      history.push({
        id: `raffle-${entry.id}`,
        type: "raffle",
        result: entry.status === "completed"
          ? isWinner
            ? "WON"
            : "LOST"
          : "PENDING",
        amount: isWinner ? parseFloat(entry.prize_sol || "0") : 0,
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
