import { NextRequest, NextResponse } from "next/server";
import {
  getWorldConfigAsync,
  updateWorldConfig,
  resetWorldConfig,
  getDefaultConfig,
} from "@/lib/world-config";

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

/**
 * Validate admin access via wallet header
 */
function isAdminRequest(request: NextRequest): boolean {
  const adminWallet = request.headers.get("x-admin-wallet");
  return adminWallet === ADMIN_WALLET;
}

function getAdminWallet(request: NextRequest): string {
  return request.headers.get("x-admin-wallet") || "unknown";
}

/**
 * GET /api/admin/config
 * Returns current world configuration (loaded from Supabase)
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Load fresh config from Supabase
    const config = await getWorldConfigAsync();
    const defaults = getDefaultConfig();

    return NextResponse.json({
      success: true,
      config,
      defaults,
      persistent: true, // Indicates config is saved to Supabase
    });
  } catch (error) {
    console.error("[Admin Config] Error loading config:", error);
    return NextResponse.json(
      { error: "Failed to load configuration" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/config
 * Update world configuration (saves to Supabase)
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, updates } = body;
    const adminWallet = getAdminWallet(request);

    if (action === "reset") {
      const config = await resetWorldConfig(adminWallet);
      return NextResponse.json({
        success: true,
        message: "Configuration reset to defaults and saved to database",
        config,
        persistent: true,
      });
    }

    if (action === "update" && updates) {
      // The updateWorldConfig function handles saving to Supabase
      const config = await updateWorldConfig(updates, adminWallet);

      return NextResponse.json({
        success: true,
        message: "Configuration saved to database - changes are now live",
        config,
        persistent: true,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'update' or 'reset'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Admin Config] Error:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
