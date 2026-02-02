/**
 * Admin Authentication API
 *
 * Implements challenge-response authentication flow:
 * 1. GET: Client requests a challenge for their wallet
 * 2. POST: Client signs the challenge and submits for verification
 * 3. On success, returns a session token for subsequent requests
 */

import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { isAdmin } from "@/lib/config";
import {
  generateChallenge,
  verifySignature,
  createSessionToken,
  invalidateSession,
  verifySessionToken,
} from "@/lib/wallet-auth";
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
 * GET /api/admin/auth?wallet=<address>
 * Request a challenge to sign for authentication
 */
export async function GET(request: NextRequest) {
  // Rate limit: 5 requests per minute (strict)
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`admin-auth:${clientIP}`, RATE_LIMITS.strict);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      { status: 429 }
    );
  }

  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 });
  }

  // Validate wallet address format
  if (!isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }

  // Check if wallet is an admin before generating challenge
  if (!isAdmin(wallet)) {
    // Return same error as invalid wallet to prevent enumeration
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate challenge for wallet to sign
  const challenge = generateChallenge(wallet);

  return NextResponse.json({
    challenge,
    expiresIn: 300, // 5 minutes in seconds
  });
}

/**
 * POST /api/admin/auth
 * Submit signed challenge for verification
 * Body: { wallet, signature, message }
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per minute (strict)
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`admin-auth:${clientIP}`, RATE_LIMITS.strict);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { wallet, signature, message } = body;

    // Validate required fields
    if (!wallet || !signature || !message) {
      return NextResponse.json(
        { error: "Missing required fields: wallet, signature, message" },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!isValidSolanaAddress(wallet)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
    }

    // Validate signature format (base58 encoded)
    if (typeof signature !== "string" || signature.length < 64 || signature.length > 128) {
      return NextResponse.json({ error: "Invalid signature format" }, { status: 400 });
    }

    // Check if wallet is an admin
    if (!isAdmin(wallet)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the signature against the challenge
    const isValid = verifySignature(wallet, signature, message);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid or expired signature" }, { status: 401 });
    }

    // Create session token
    const sessionToken = createSessionToken(wallet);

    return NextResponse.json({
      success: true,
      sessionToken,
      expiresIn: 3600, // 1 hour in seconds
    });
  } catch (error) {
    console.error("[AdminAuth] Authentication error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/auth
 * Logout - invalidate session token
 */
export async function DELETE(request: NextRequest) {
  const sessionToken = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token" }, { status: 400 });
  }

  // Verify the token exists before invalidating
  const wallet = verifySessionToken(sessionToken);

  if (wallet) {
    invalidateSession(sessionToken);
  }

  return NextResponse.json({ success: true });
}
