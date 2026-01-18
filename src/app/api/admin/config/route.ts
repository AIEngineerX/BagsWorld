import { NextRequest, NextResponse } from "next/server";
import {
  getWorldConfig,
  updateWorldConfig,
  resetWorldConfig,
  getDefaultConfig,
  type WorldConfig,
} from "@/lib/world-config";

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

/**
 * Validate admin access via wallet signature or simple wallet check
 * In production, you'd want proper signature verification
 */
function isAdminRequest(request: NextRequest): boolean {
  const adminWallet = request.headers.get("x-admin-wallet");
  return adminWallet === ADMIN_WALLET;
}

/**
 * GET /api/admin/config
 * Returns current world configuration
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    config: getWorldConfig(),
    defaults: getDefaultConfig(),
  });
}

/**
 * POST /api/admin/config
 * Update world configuration
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action, updates } = body;

    if (action === "reset") {
      const config = resetWorldConfig();
      return NextResponse.json({
        success: true,
        message: "Configuration reset to defaults",
        config,
      });
    }

    if (action === "update" && updates) {
      // Validate updates
      const validatedUpdates: Partial<WorldConfig> = {};

      if (typeof updates.maxBuildings === "number" && updates.maxBuildings > 0 && updates.maxBuildings <= 50) {
        validatedUpdates.maxBuildings = updates.maxBuildings;
      }

      if (typeof updates.maxCharacters === "number" && updates.maxCharacters > 0 && updates.maxCharacters <= 30) {
        validatedUpdates.maxCharacters = updates.maxCharacters;
      }

      if (typeof updates.buildingSpacing === "number" && updates.buildingSpacing >= 50 && updates.buildingSpacing <= 200) {
        validatedUpdates.buildingSpacing = updates.buildingSpacing;
      }

      if (typeof updates.minMarketCap === "number" && updates.minMarketCap >= 0) {
        validatedUpdates.minMarketCap = updates.minMarketCap;
      }

      if (typeof updates.decayThreshold === "number" && updates.decayThreshold >= 0 && updates.decayThreshold <= 100) {
        validatedUpdates.decayThreshold = updates.decayThreshold;
      }

      if (typeof updates.minLifetimeFees === "number" && updates.minLifetimeFees >= 0) {
        validatedUpdates.minLifetimeFees = updates.minLifetimeFees;
      }

      if (typeof updates.refreshIntervalMs === "number" && updates.refreshIntervalMs >= 5000 && updates.refreshIntervalMs <= 300000) {
        validatedUpdates.refreshIntervalMs = updates.refreshIntervalMs;
      }

      if (updates.volumeThresholds && typeof updates.volumeThresholds === "object") {
        validatedUpdates.volumeThresholds = {};
        const thresholds = ["thriving", "healthy", "normal", "struggling", "dying"] as const;
        for (const key of thresholds) {
          if (typeof updates.volumeThresholds[key] === "number" && updates.volumeThresholds[key] >= 0) {
            validatedUpdates.volumeThresholds[key] = updates.volumeThresholds[key];
          }
        }
      }

      const config = updateWorldConfig(validatedUpdates);
      return NextResponse.json({
        success: true,
        message: "Configuration updated",
        config,
        appliedUpdates: validatedUpdates,
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
