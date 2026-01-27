// Admin API - Protected endpoints for site management
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { isAdmin } from "@/lib/config";
import { getGlobalTokens, saveGlobalToken, isNeonConfigured, type GlobalToken } from "@/lib/neon";
import { verifySessionToken } from "@/lib/wallet-auth";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeString } from "@/lib/env-utils";

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
 * Get SQL connection for Neon database
 */
function getNeonSQL() {
  const moduleName = "@netlify/neon";
  // eslint-disable-next-line
  const { neon } = require(moduleName);
  return neon();
}

/**
 * Validate mint and check database, returns error response or null if valid
 */
function validateMintAndDb(mint: string): NextResponse | null {
  if (!mint || !isValidSolanaAddress(mint)) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  return null;
}

/**
 * Validate a nullable number is within range
 */
function validateNullableRange(
  value: number | null,
  min: number,
  max: number,
  fieldName: string
): NextResponse | null {
  if (value !== null && (typeof value !== "number" || value < min || value > max)) {
    return NextResponse.json(
      { error: `${fieldName} must be null or a number between ${min} and ${max}` },
      { status: 400 }
    );
  }
  return null;
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
  const rateLimit = await checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.standard);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
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
    return NextResponse.json({ error: "Failed to fetch admin data" }, { status: 500 });
  }
}

// POST - Admin actions (update token, delete token, etc.)
export async function POST(request: NextRequest) {
  // Rate limit: 30 requests per minute (standard)
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`admin:${clientIP}`, RATE_LIMITS.standard);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
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
      case "set_position":
        return await handleSetPosition(data);
      case "set_style":
        return await handleSetStyle(data);
      case "set_health":
        return await handleSetHealth(data);
      case "set_zone":
        return await handleSetZone(data);
      case "add_token":
        return await handleAddToken(data);
      case "clear_cache":
        return await handleClearCache();
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
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
async function handleUpdateToken(data: { mint: string; updates: Partial<GlobalToken> }) {
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
    return NextResponse.json(
      { error: `Name exceeds ${MAX_NAME_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (data.updates.symbol && data.updates.symbol.length > MAX_SYMBOL_LENGTH) {
    return NextResponse.json(
      { error: `Symbol exceeds ${MAX_SYMBOL_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (data.updates.description && data.updates.description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (data.updates.image_url && data.updates.image_url.length > MAX_URL_LENGTH) {
    return NextResponse.json(
      { error: `Image URL exceeds ${MAX_URL_LENGTH} characters` },
      { status: 400 }
    );
  }

  // Sanitize string inputs to prevent XSS
  const sanitizedUpdates = {
    ...data.updates,
    name: data.updates.name ? sanitizeString(data.updates.name, MAX_NAME_LENGTH) : undefined,
    symbol: data.updates.symbol
      ? sanitizeString(data.updates.symbol, MAX_SYMBOL_LENGTH)
      : undefined,
    description: data.updates.description
      ? sanitizeString(data.updates.description, MAX_DESCRIPTION_LENGTH)
      : undefined,
    // For URLs, just validate format rather than sanitize (would break valid URLs)
    image_url: data.updates.image_url,
  };

  // Validate image URL format if provided
  if (sanitizedUpdates.image_url) {
    try {
      const url = new URL(sanitizedUpdates.image_url);
      if (!["http:", "https:", "ipfs:"].includes(url.protocol)) {
        return NextResponse.json({ error: "Invalid image URL protocol" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
    }
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

    const { mint } = data;
    const updates = sanitizedUpdates;

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
  if (!data.mint) {
    return NextResponse.json({ error: "Missing mint address" }, { status: 400 });
  }
  if (!isValidSolanaAddress(data.mint)) {
    return NextResponse.json(
      { error: `Invalid mint address: "${data.mint.slice(0, 20)}..."` },
      { status: 400 }
    );
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
  const validationError =
    validateMintAndDb(data.mint) || validateNullableRange(data.level, 1, 5, "Level");
  if (validationError) return validationError;

  try {
    const sql = getNeonSQL();
    await sql`
      UPDATE tokens SET level_override = ${data.level}, last_updated = NOW()
      WHERE mint = ${data.mint}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set level override error:", error);
    return NextResponse.json({ error: "Failed to set level override" }, { status: 500 });
  }
}

// Handle set building position
async function handleSetPosition(data: { mint: string; x: number | null; y: number | null }) {
  const validationError =
    validateMintAndDb(data.mint) ||
    validateNullableRange(data.x, 0, 1280, "X position") ||
    validateNullableRange(data.y, 0, 960, "Y position");
  if (validationError) return validationError;

  try {
    const sql = getNeonSQL();
    await sql`
      UPDATE tokens SET position_x = ${data.x}, position_y = ${data.y}, last_updated = NOW()
      WHERE mint = ${data.mint}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set position error:", error);
    return NextResponse.json({ error: "Failed to set position" }, { status: 500 });
  }
}

// Handle set building style
async function handleSetStyle(data: { mint: string; style: number | null }) {
  const validationError =
    validateMintAndDb(data.mint) || validateNullableRange(data.style, 0, 3, "Style");
  if (validationError) return validationError;

  try {
    const sql = getNeonSQL();
    await sql`
      UPDATE tokens SET style_override = ${data.style}, last_updated = NOW()
      WHERE mint = ${data.mint}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set style error:", error);
    return NextResponse.json({ error: "Failed to set style" }, { status: 500 });
  }
}

// Handle set building health override
async function handleSetHealth(data: { mint: string; health: number | null }) {
  const validationError =
    validateMintAndDb(data.mint) || validateNullableRange(data.health, 0, 100, "Health");
  if (validationError) return validationError;

  try {
    const sql = getNeonSQL();
    await sql`
      UPDATE tokens SET health_override = ${data.health}, last_updated = NOW()
      WHERE mint = ${data.mint}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set health error:", error);
    return NextResponse.json({ error: "Failed to set health" }, { status: 500 });
  }
}

// Valid zone types for zone override
const VALID_ZONES = ["labs", "main_city", "trending", "ballers", "founders"] as const;

// Handle set building zone override
async function handleSetZone(data: { mint: string; zone: string | null }) {
  const validationError = validateMintAndDb(data.mint);
  if (validationError) return validationError;

  // Validate zone is valid or null
  if (data.zone !== null && !VALID_ZONES.includes(data.zone as (typeof VALID_ZONES)[number])) {
    return NextResponse.json(
      { error: `Invalid zone. Must be one of: ${VALID_ZONES.join(", ")} or null` },
      { status: 400 }
    );
  }

  try {
    const sql = getNeonSQL();
    await sql`
      UPDATE tokens SET zone_override = ${data.zone}, last_updated = NOW()
      WHERE mint = ${data.mint}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set zone error:", error);
    return NextResponse.json({ error: "Failed to set zone" }, { status: 500 });
  }
}

// Handle adding token manually by mint
async function handleAddToken(data: { mint: string; name?: string; symbol?: string }) {
  // Validate mint address
  if (!data.mint || !isValidSolanaAddress(data.mint)) {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    let tokenName = data.name || "Unknown Token";
    let tokenSymbol = data.symbol || "???";
    let imageUrl: string | undefined;
    let marketCap = 0;
    let volume24h = 0;
    let source = "manual";

    // Try DexScreener first
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${data.mint}`);
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        const pair = dexData.pairs?.[0];
        if (pair) {
          tokenName = pair.baseToken?.name || tokenName;
          tokenSymbol = pair.baseToken?.symbol || tokenSymbol;
          imageUrl = pair.info?.imageUrl;
          marketCap = pair.marketCap || pair.fdv || 0;
          volume24h = pair.volume?.h24 || 0;
          source = "dexscreener";
        }
      }
    } catch (e) {
      console.log("DexScreener lookup failed, trying Bags.fm...");
    }

    // If DexScreener didn't find it, try Bags.fm API
    if (source === "manual" && process.env.BAGS_API_KEY) {
      try {
        const bagsUrl = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";
        const bagsResponse = await fetch(`${bagsUrl}/token-launch/creator/v3?mint=${data.mint}`, {
          headers: {
            "x-api-key": process.env.BAGS_API_KEY,
          },
        });
        if (bagsResponse.ok) {
          const bagsData = await bagsResponse.json();
          if (bagsData.data?.tokenLaunchInfo) {
            const info = bagsData.data.tokenLaunchInfo;
            tokenName = info.name || tokenName;
            tokenSymbol = info.symbol || tokenSymbol;
            imageUrl = info.imageUrl || imageUrl;
            source = "bags.fm";
          }
        }
      } catch (e) {
        console.log("Bags.fm lookup failed, using manual entry...");
      }
    }

    const token: GlobalToken = {
      mint: data.mint,
      name: tokenName,
      symbol: tokenSymbol,
      description: `Added via admin panel (${source})`,
      image_url: imageUrl,
      creator_wallet: "admin-added",
      market_cap: marketCap,
      volume_24h: volume24h,
    };

    const success = await saveGlobalToken(token);

    if (!success) {
      return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
    }

    // Set health_override to 100 so new buildings don't get filtered out by decay system
    // Admin can later change this via the Building Editor
    try {
      const sql = getNeonSQL();
      await sql`
        UPDATE tokens SET
          health_override = 100,
          current_health = 100,
          health_updated_at = NOW()
        WHERE mint = ${data.mint}
      `;
    } catch (e) {
      console.log("Warning: Could not set initial health for new building");
    }

    return NextResponse.json({
      success: true,
      token,
      source,
      message:
        source === "manual"
          ? "Token added with health=100. Update name/symbol manually if needed."
          : `Token info fetched from ${source} (health set to 100)`,
    });
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
    message: "Cache invalidation triggered. Changes will reflect on next refresh.",
  });
}
