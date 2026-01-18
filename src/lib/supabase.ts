// Supabase client for shared global state
import { createClient } from "@supabase/supabase-js";

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

// Supabase client is created lazily to avoid build-time errors when env vars aren't set
// Using 'any' for database types since we don't have generated types
let supabaseClient: ReturnType<typeof createClient<any>> | null = null;

function getSupabaseClient(): ReturnType<typeof createClient<any>> | null {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  supabaseClient = createClient<any>(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_KEY);
}

// Export a getter for the client (may be null if not configured)
export const supabase = {
  get client() {
    return getSupabaseClient();
  }
};

// Fetch all global tokens (visible to everyone)
export async function getGlobalTokens(): Promise<GlobalToken[]> {
  const client = getSupabaseClient();
  if (!client) {
    console.log("Supabase not configured, using local storage only");
    return [];
  }

  try {
    const { data, error } = await client
      .from("tokens")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching global tokens:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Supabase fetch error:", error);
    return [];
  }
}

// Save a token to the global database
export async function saveGlobalToken(token: GlobalToken): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    console.log("Supabase not configured, cannot save globally");
    return false;
  }

  try {
    // Check if token already exists
    const { data: existing } = await client
      .from("tokens")
      .select("id")
      .eq("mint", token.mint)
      .single();

    if (existing) {
      // Update existing token
      const { error } = await client
        .from("tokens")
        .update({
          name: token.name,
          symbol: token.symbol,
          description: token.description,
          image_url: token.image_url,
          fee_shares: token.fee_shares,
          lifetime_fees: token.lifetime_fees,
          market_cap: token.market_cap,
          volume_24h: token.volume_24h,
          last_updated: new Date().toISOString(),
        })
        .eq("mint", token.mint);

      if (error) {
        console.error("Error updating token:", error);
        return false;
      }
    } else {
      // Insert new token
      const { error } = await client.from("tokens").insert({
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        description: token.description,
        image_url: token.image_url,
        creator_wallet: token.creator_wallet,
        fee_shares: token.fee_shares,
        lifetime_fees: token.lifetime_fees,
        market_cap: token.market_cap,
        is_featured: false,
        is_verified: false,
      });

      if (error) {
        console.error("Error inserting token:", error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Supabase save error:", error);
    return false;
  }
}

// Get featured tokens only
export async function getFeaturedTokens(): Promise<GlobalToken[]> {
  const client = getSupabaseClient();
  if (!client) {
    return [];
  }

  try {
    const { data, error } = await client
      .from("tokens")
      .select("*")
      .eq("is_featured", true)
      .order("market_cap", { ascending: false });

    if (error) {
      console.error("Error fetching featured tokens:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Supabase fetch error:", error);
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
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client
      .from("tokens")
      .update({
        ...stats,
        last_updated: new Date().toISOString(),
      })
      .eq("mint", mint);
  } catch (error) {
    console.error("Error updating token stats:", error);
  }
}

// ============================================
// World Config Persistence
// ============================================

const CONFIG_KEY = "world_config";

export interface StoredWorldConfig {
  id?: number;
  key: string;
  config: Record<string, unknown>;
  updated_at?: string;
  updated_by?: string;
}

/**
 * Load world config from Supabase
 * Returns null if not found or Supabase not configured
 */
export async function loadWorldConfig(): Promise<Record<string, unknown> | null> {
  const client = getSupabaseClient();
  if (!client) {
    console.log("[WorldConfig] Supabase not configured, using defaults");
    return null;
  }

  try {
    const { data, error } = await client
      .from("world_config")
      .select("config")
      .eq("key", CONFIG_KEY)
      .single();

    if (error) {
      // PGRST116 = no rows found, which is fine for first run
      if (error.code !== "PGRST116") {
        console.error("[WorldConfig] Error loading from Supabase:", error);
      }
      return null;
    }

    console.log("[WorldConfig] Loaded from Supabase");
    return data?.config || null;
  } catch (error) {
    console.error("[WorldConfig] Supabase load error:", error);
    return null;
  }
}

/**
 * Save world config to Supabase
 * Uses upsert to create or update
 */
export async function saveWorldConfig(
  config: Record<string, unknown>,
  updatedBy?: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    console.log("[WorldConfig] Supabase not configured, cannot persist");
    return false;
  }

  try {
    const { error } = await client
      .from("world_config")
      .upsert(
        {
          key: CONFIG_KEY,
          config,
          updated_at: new Date().toISOString(),
          updated_by: updatedBy || "admin",
        },
        { onConflict: "key" }
      );

    if (error) {
      console.error("[WorldConfig] Error saving to Supabase:", error);
      return false;
    }

    console.log("[WorldConfig] Saved to Supabase");
    return true;
  } catch (error) {
    console.error("[WorldConfig] Supabase save error:", error);
    return false;
  }
}
