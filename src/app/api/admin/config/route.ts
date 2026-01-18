import { NextRequest, NextResponse } from "next/server";
import {
  getWorldConfigAsync,
  updateWorldConfig,
  resetWorldConfig,
  getDefaultConfig,
} from "@/lib/world-config";
import {
  generateChallenge,
  verifyAdminSignature,
  createSessionToken,
  verifySessionToken,
} from "@/lib/wallet-auth";

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

/**
 * Validate admin access via cryptographic signature or session token
 * Returns the admin wallet address if valid, null otherwise
 */
function validateAdminAuth(request: NextRequest): { wallet: string | null; error?: string } {
  // Method 1: Session token (for subsequent requests after initial auth)
  const sessionToken = request.headers.get("x-admin-session");
  if (sessionToken) {
    const wallet = verifySessionToken(sessionToken);
    if (wallet && wallet === ADMIN_WALLET) {
      return { wallet };
    }
    return { wallet: null, error: "Invalid or expired session" };
  }

  // Method 2: Signature verification (for initial auth)
  const walletAddress = request.headers.get("x-admin-wallet");
  const signature = request.headers.get("x-admin-signature");
  const message = request.headers.get("x-admin-message");

  if (!walletAddress || !signature || !message) {
    return { wallet: null, error: "Missing authentication headers" };
  }

  const result = verifyAdminSignature(walletAddress, signature, message, ADMIN_WALLET);
  if (!result.valid) {
    return { wallet: null, error: result.error };
  }

  return { wallet: walletAddress };
}

/**
 * GET /api/admin/config
 *
 * Query params:
 * - action=challenge&wallet=<address> : Get a challenge message to sign
 * - (no action) : Get current config (requires auth)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Challenge request - no auth required
  if (action === "challenge") {
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "Missing wallet parameter" },
        { status: 400 }
      );
    }

    // Check if this wallet is the admin before generating challenge
    if (wallet !== ADMIN_WALLET) {
      return NextResponse.json(
        { error: "Unauthorized wallet" },
        { status: 403 }
      );
    }

    const challenge = generateChallenge(wallet);
    return NextResponse.json({
      success: true,
      challenge,
      expiresIn: 300, // 5 minutes
    });
  }

  // Config request - requires auth
  const auth = validateAdminAuth(request);
  if (!auth.wallet) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const config = await getWorldConfigAsync();
    const defaults = getDefaultConfig();

    return NextResponse.json({
      success: true,
      config,
      defaults,
      persistent: true,
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
 *
 * Actions:
 * - authenticate: Verify signature and get session token
 * - update: Update configuration
 * - reset: Reset to defaults
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Authentication action - verify signature and issue session token
    if (action === "authenticate") {
      const { wallet, signature, message } = body;

      if (!wallet || !signature || !message) {
        return NextResponse.json(
          { error: "Missing wallet, signature, or message" },
          { status: 400 }
        );
      }

      const result = verifyAdminSignature(wallet, signature, message, ADMIN_WALLET);
      if (!result.valid) {
        return NextResponse.json(
          { error: result.error || "Authentication failed" },
          { status: 401 }
        );
      }

      // Create session token for subsequent requests
      const sessionToken = createSessionToken(wallet);

      return NextResponse.json({
        success: true,
        message: "Authentication successful",
        sessionToken,
        expiresIn: 3600, // 1 hour
      });
    }

    // All other actions require authentication
    const auth = validateAdminAuth(request);
    if (!auth.wallet) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const adminWallet = auth.wallet;

    if (action === "reset") {
      const config = await resetWorldConfig(adminWallet);
      return NextResponse.json({
        success: true,
        message: "Configuration reset to defaults and saved to database",
        config,
        persistent: true,
      });
    }

    if (action === "update") {
      const { updates } = body;
      if (!updates) {
        return NextResponse.json(
          { error: "Missing updates object" },
          { status: 400 }
        );
      }

      const config = await updateWorldConfig(updates, adminWallet);

      return NextResponse.json({
        success: true,
        message: "Configuration saved to database - changes are now live",
        config,
        persistent: true,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'authenticate', 'update', or 'reset'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Admin Config] Error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
