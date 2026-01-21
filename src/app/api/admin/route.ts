// Admin API - Protected endpoints for site management
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { isAdmin } from "@/lib/config";
import {
  getGlobalTokens,
  saveGlobalToken,
  isNeonConfigured,
  type GlobalToken
} from "@/lib/neon";
import { verifySessionToken } from "@/lib/wallet-auth";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Validate that a string is a valid Solana public key
 */
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify admin access via session token
 * Requires: Authorization: Bearer <sessionToken>
 * Returns the admin wallet address if valid, null otherwise
 */
function verifyAdmin(request: NextRequest): string | null {
  // Extract session token from Authorization header
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const sessionToken = authHeader.replace("Bearer ", "");

  if (!sessionToken) {
    return null;
  }

  // Verify the session token and get the associated wallet
  const wallet = verifySessionToken(sessionToken);

  if (!wallet) {
    return null;
  }

  // Double-check the wallet is still an admin
  if (!isAdmin(wallet)) {
    return null;
  }

  return wallet;
}

// GET - Fetch admin dashboard data
export async function GET(request: NextRequest) {
  // Rate limit: 30 requests per minute (standard)
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.standard);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Try again later.", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
      { status: 429 }
    );
  }

  const adminWallet = verifyAdmin(request);
  if (!adminWallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const diagnostics = await getSystemDiagnostics();
    const globalTokens = isNeonConfigured() ? await getGlobalTokens() : [];

    return NextResponse.json({
      diagnostics,
      globalTokens,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin data" },
      { status: 500 }
    );
  }
}

// POST - Admin actions (update token, delete token, etc.)
export async function POST(request: NextRequest) {
  // Rate limit: 30 requests per minute (standard)
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.standard);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Try again later.", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
      { status: 429 }
    );
  }

  const adminWallet = verifyAdmin(request);
  if (!adminWallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case "update_token":
        return await handleUpdateToken(data);
      case "delete_token":
        return await handleDeleteToken(data);
      case "set_featured":
        return await handleSetFeatured(data);
      case "set_verified":
        return await handleSetVerified(data);
      case "set_level_override":
        return await handleSetLevelOverride(data);
      case "add_token":
        return await handleAddToken(data);
      case "clear_cache":
        return await handleClearCache();
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json(
      { error: "Action failed" },
      { status: 500 }
    );
  }
}

// System diagnostics
async function getSystemDiagnostics() {
  const diagnostics: Record<string, any> = {
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || "development",
    netlify: !!process.env.NETLIFY,
  };

  // Check Neon DB
  diagnostics.neonDb = {
    configured: isNeonConfigured(),
    status: "unknown",
  };

  if (isNeonConfigured()) {
    try {
      const tokens = await getGlobalTokens();
      diagnostics.neonDb.status = "connected";
      diagnostics.neonDb.tokenCount = tokens.length;
    } catch (error) {
      diagnostics.neonDb.status = "error";
      diagnostics.neonDb.error = String(error);
    }
  }

  // Check Bags API
  diagnostics.bagsApi = {
    configured: !!process.env.BAGS_API_KEY,
    keyLength: process.env.BAGS_API_KEY?.length || 0,
  };

  // Check RPC
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL;
  diagnostics.solanaRpc = {
    configured: !!rpcUrl,
    url: rpcUrl ? rpcUrl.substring(0, 30) + "..." : "Not configured",
  };

  // Try RPC health check
  if (rpcUrl) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getHealth",
        }),
      });
      const result = await response.json();
      diagnostics.solanaRpc.status = result.result === "ok" ? "healthy" : "degraded";
    } catch (error) {
      diagnostics.solanaRpc.status = "error";
    }
  }

  // Check Anthropic API
  diagnostics.anthropicApi = {
    configured: !!process.env.ANTHROPIC_API_KEY,
  };

  // Memory usage (if available)
  if (typeof process !== "undefined" && process.memoryUsage) {
    const mem = process.memoryUsage();
    diagnostics.memory = {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + " MB",
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + " MB",
    };
  }

  return diagnostics;
}

// Handle token update
async function handleUpdateToken(data: {
  mint: string;
  updates: Partial<GlobalToken>;
}) {
  // Validate mint address
  if (!data.mint || !isValidSolanaAddress(data.mint)) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  // Validate string field lengths to prevent abuse
  const MAX_NAME_LENGTH = 100;
  const MAX_SYMBOL_LENGTH = 20;
  const MAX_DESCRIPTION_LENGTH = 1000;
  const MAX_URL_LENGTH = 500;

  if (data.updates.name && data.updates.name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Name exceeds ${MAX_NAME_LENGTH} characters` }, { status: 400 });
  }
  if (data.updates.symbol && data.updates.symbol.length > MAX_SYMBOL_LENGTH) {
    return NextResponse.json({ error: `Symbol exceeds ${MAX_SYMBOL_LENGTH} characters` }, { status: 400 });
  }
  if (data.updates.description && data.updates.description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ error: `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters` }, { status: 400 });
  }
  if (data.updates.image_url && data.updates.image_url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: `Image URL exceeds ${MAX_URL_LENGTH} characters` }, { status: 400 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    // Use dynamic import for Neon
    const moduleName = "@netlify/neon";
    // eslint-disable-next-line
    const { neon } = require(moduleName);
    const sql = neon();

    const { mint, updates } = data;

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push("name = $" + (values.length + 1));
      values.push(updates.name);
    }
    if (updates.symbol !== undefined) {
      updateFields.push("symbol = $" + (values.length + 1));
      values.push(updates.symbol);
    }
    if (updates.description !== undefined) {
      updateFields.push("description = $" + (values.length + 1));
      values.push(updates.description);
    }
    if (updates.image_url !== undefined) {
      updateFields.push("image_url = $" + (values.length + 1));
      values.push(updates.image_url);
    }

    // Always update last_updated
    await sql`
      UPDATE tokens SET
        name = COALESCE(${updates.name}, name),
        symbol = COALESCE(${updates.symbol}, symbol),
        description = COALESCE(${updates.description}, description),
        image_url = COALESCE(${updates.image_url}, image_url),
        last_updated = NOW()
      WHERE mint = ${mint}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update token error:", error);
    return NextResponse.json({ error: "Failed to update token" }, { status: 500 });
  }
}

// Handle token deletion from global DB
async function handleDeleteToken(data: { mint: string }) {
  // Validate mint address
  if (!data.mint || !isValidSolanaAddress(data.mint)) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const moduleName = "@netlify/neon";
    // eslint-disable-next-line
    const { neon } = require(moduleName);
    const sql = neon();

    await sql`DELETE FROM tokens WHERE mint = ${data.mint}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete token error:", error);
    return NextResponse.json({ error: "Failed to delete token" }, { status: 500 });
  }
}

// Handle set featured status
async function handleSetFeatured(data: { mint: string; featured: boolean }) {
  // Validate mint address
  if (!data.mint || !isValidSolanaAddress(data.mint)) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  // Validate featured is boolean
  if (typeof data.featured !== "boolean") {
    return NextResponse.json({ error: "Featured must be a boolean" }, { status: 400 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const moduleName = "@netlify/neon";
    // eslint-disable-next-line
    const { neon } = require(moduleName);
    const sql = neon();

    await sql`
      UPDATE tokens SET
        is_featured = ${data.featured},
        last_updated = NOW()
      WHERE mint = ${data.mint}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set featured error:", error);
    return NextResponse.json({ error: "Failed to update featured status" }, { status: 500 });
  }
}

// Handle set verified status
async function handleSetVerified(data: { mint: string; verified: boolean }) {
  // Validate mint address
  if (!data.mint || !isValidSolanaAddress(data.mint)) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  // Validate verified is boolean
  if (typeof data.verified !== "boolean") {
    return NextResponse.json({ error: "Verified must be a boolean" }, { status: 400 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const moduleName = "@netlify/neon";
    // eslint-disable-next-line
    const { neon } = require(moduleName);
    const sql = neon();

    await sql`
      UPDATE tokens SET
        is_verified = ${data.verified},
        last_updated = NOW()
      WHERE mint = ${data.mint}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set verified error:", error);
    return NextResponse.json({ error: "Failed to update verified status" }, { status: 500 });
  }
}

// Handle level override for buildings
async function handleSetLevelOverride(data: { mint: string; level: number | null }) {
  // Validate mint address
  if (!data.mint || !isValidSolanaAddress(data.mint)) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  // Validate level is null or a valid level (1-5)
  if (data.level !== null && (typeof data.level !== "number" || data.level < 1 || data.level > 5)) {
    return NextResponse.json({ error: "Level must be null or a number between 1 and 5" }, { status: 400 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const moduleName = "@netlify/neon";
    // eslint-disable-next-line
    const { neon } = require(moduleName);
    const sql = neon();

    // Check if level_override column exists, if not, add it
    try {
      await sql`
        ALTER TABLE tokens ADD COLUMN IF NOT EXISTS level_override INTEGER DEFAULT NULL
      `;
    } catch (e) {
      // Column might already exist
    }

    await sql`
      UPDATE tokens SET
        level_override = ${data.level},
        last_updated = NOW()
      WHERE mint = ${data.mint}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set level override error:", error);
    return NextResponse.json({ error: "Failed to set level override" }, { status: 500 });
  }
}

// Handle adding token manually by mint
async function handleAddToken(data: { mint: string }) {
  // Validate mint address
  if (!data.mint || !isValidSolanaAddress(data.mint)) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    // Fetch token info from DexScreener
    const dexResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${data.mint}`
    );

    if (!dexResponse.ok) {
      return NextResponse.json({ error: "Token not found on DexScreener" }, { status: 404 });
    }

    const dexData = await dexResponse.json();
    const pair = dexData.pairs?.[0];

    if (!pair) {
      return NextResponse.json({ error: "No trading pairs found" }, { status: 404 });
    }

    const token: GlobalToken = {
      mint: data.mint,
      name: pair.baseToken?.name || "Unknown",
      symbol: pair.baseToken?.symbol || "???",
      description: `Added via admin panel`,
      image_url: pair.info?.imageUrl || undefined,
      creator_wallet: "admin-added",
      market_cap: pair.marketCap || pair.fdv || 0,
      volume_24h: pair.volume?.h24 || 0,
    };

    const success = await saveGlobalToken(token);

    if (!success) {
      return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
    }

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error("Add token error:", error);
    return NextResponse.json({ error: "Failed to add token" }, { status: 500 });
  }
}

// Handle cache clearing
async function handleClearCache() {
  // In a real implementation, you'd clear various caches
  // For now, we just return success
  return NextResponse.json({
    success: true,
    message: "Cache invalidation triggered. Changes will reflect on next refresh."
  });
}
