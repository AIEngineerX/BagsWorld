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
    const rows = await sql`SELECT * FROM tokens ORDER BY created_at DESC`;
    return rows as GlobalToken[];
  } catch (error) {
    console.error("Error fetching global tokens:", error);
    return [];
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
          is_featured, is_verified
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
