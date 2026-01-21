// Partner Fee Claim API
// Generates transactions to claim accumulated partner fees from Bags.fm
// SECURITY: Requires cryptographic signature verification to prove wallet ownership
//
// Actions:
// - "create-config": One-time setup to register as a partner (creates on-chain config)
// - "claim": Generate transactions to claim accumulated fees

import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { verifySessionToken } from "@/lib/wallet-auth";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

// Partner wallet - same as ecosystem wallet for simplicity
const PARTNER_WALLET = ECOSYSTEM_CONFIG.ecosystem.wallet;

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
 * Verify partner access via session token
 * Requires: Authorization: Bearer <sessionToken>
 * Returns the wallet address if valid and matches partner, null otherwise
 */
function verifyPartner(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const sessionToken = authHeader.replace("Bearer ", "");

  if (!sessionToken) {
    return null;
  }

  const wallet = verifySessionToken(sessionToken);

  if (!wallet) {
    return null;
  }

  // Verify wallet is the partner wallet
  if (wallet !== PARTNER_WALLET) {
    return null;
  }

  return wallet;
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per minute (strict - financial operations)
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`partner-claim:${clientIP}`, RATE_LIMITS.strict);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Try again later.", retryAfter: Math.ceil(rateLimit.resetIn / 1000) },
      { status: 429 }
    );
  }

  try {
    // Verify API key is configured
    if (!BAGS_API_KEY) {
      return NextResponse.json(
        { error: "Bags API key not configured" },
        { status: 500 }
      );
    }

    // SECURITY: Verify wallet ownership via session token
    const walletAddress = verifyPartner(request);

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized - valid session token required for partner wallet" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action = "claim" } = body;

    // Handle different actions
    if (action === "create-config") {
      return handleCreateConfig(walletAddress);
    } else {
      return handleClaimFees(walletAddress);
    }

  } catch (error) {
    console.error("Partner claim error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

// Create partner config (one-time setup)
async function handleCreateConfig(walletAddress: string) {
  const response = await fetch(`${BAGS_API_URL}/fee-share/partner-config/creation-tx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BAGS_API_KEY!,
    },
    body: JSON.stringify({
      partnerWallet: walletAddress,
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let errorMessage = "Failed to create partner config";
    try {
      const errorJson = JSON.parse(rawText);
      errorMessage = errorJson.message || errorJson.error || errorJson.response || errorMessage;
    } catch {
      errorMessage = rawText || errorMessage;
    }
    console.error("[partner-claim] Create config failed:", response.status);
    return NextResponse.json(
      { error: errorMessage },
      { status: response.status }
    );
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("[partner-claim] Invalid JSON response from API");
    return NextResponse.json(
      { error: "Invalid response from API" },
      { status: 500 }
    );
  }

  // Handle various response formats
  const transaction = data.response?.transaction || data.transaction;
  const blockhash = data.response?.blockhash || data.blockhash;

  if (!transaction) {
    return NextResponse.json(
      { error: `No transaction in response. Keys: ${Object.keys(data).join(", ")}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    action: "create-config",
    transaction,
    blockhash,
    message: "Partner config creation transaction generated. Sign to complete setup.",
  });
}

// Claim accumulated fees
async function handleClaimFees(walletAddress: string) {
  const response = await fetch(`${BAGS_API_URL}/fee-share/partner-config/claim-tx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BAGS_API_KEY!,
    },
    body: JSON.stringify({
      partnerWallet: walletAddress,
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let errorMessage = "Failed to generate claim transactions";
    try {
      const errorJson = JSON.parse(rawText);
      errorMessage = errorJson.message || errorJson.error || errorJson.response || errorMessage;

      // Check if partner config doesn't exist yet
      if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
        errorMessage = "Partner config not found. Click 'Setup Partner' first to register.";
      }
    } catch {
      errorMessage = rawText || errorMessage;
    }
    console.error("[partner-claim] Claim failed:", response.status);
    return NextResponse.json(
      { error: errorMessage },
      { status: response.status }
    );
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("[partner-claim] Invalid JSON response from API");
    return NextResponse.json(
      { error: "Invalid response from API" },
      { status: 500 }
    );
  }

  // Handle various response formats
  const transactions = data.response?.transactions || data.transactions || [];

  return NextResponse.json({
    success: true,
    action: "claim",
    transactions,
    message: transactions.length
      ? `Generated ${transactions.length} claim transaction(s)`
      : "No fees available to claim",
  });
}

// GET - Check partner status (for UI)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      );
    }

    // Check if this wallet is the partner wallet
    const isPartner = walletAddress === PARTNER_WALLET;

    return NextResponse.json({
      isPartner,
      partnerWallet: isPartner ? PARTNER_WALLET : null,
      solscanUrl: isPartner ? `https://solscan.io/account/${PARTNER_WALLET}` : null,
    });

  } catch (error) {
    console.error("Partner status error:", error);
    return NextResponse.json(
      { error: "Failed to check partner status" },
      { status: 500 }
    );
  }
}
