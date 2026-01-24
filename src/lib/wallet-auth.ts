/**
 * Wallet Authentication Utilities
 *
 * Provides cryptographic verification of wallet ownership using
 * Solana message signing. Used for admin authentication and
 * other privileged operations.
 */

import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

// Challenge message prefix - prevents signature reuse across apps
const MESSAGE_PREFIX = "BagsWorld Auth";

// Challenge expiry time (5 minutes)
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

// In-memory challenge store (for serverless, use Redis/DB in production)
const challengeStore = new Map<string, { challenge: string; expires: number }>();

/**
 * Generate a unique challenge for a wallet to sign
 */
export function generateChallenge(walletAddress: string): string {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2, 15);
  const challenge = `${MESSAGE_PREFIX}\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

  // Store challenge with expiry
  challengeStore.set(walletAddress, {
    challenge,
    expires: timestamp + CHALLENGE_EXPIRY_MS,
  });

  // Clean up expired challenges periodically
  cleanupExpiredChallenges();

  return challenge;
}

/**
 * Verify a signed challenge from a wallet
 */
export function verifySignature(
  walletAddress: string,
  signature: string,
  message: string
): boolean {
  try {
    // Verify the message matches a valid challenge
    const stored = challengeStore.get(walletAddress);

    if (!stored) {
      console.warn("[WalletAuth] No challenge found for wallet:", walletAddress);
      return false;
    }

    if (Date.now() > stored.expires) {
      console.warn("[WalletAuth] Challenge expired for wallet:", walletAddress);
      challengeStore.delete(walletAddress);
      return false;
    }

    if (message !== stored.challenge) {
      console.warn("[WalletAuth] Message doesn't match challenge");
      return false;
    }

    // Decode the signature and public key
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(walletAddress).toBytes();
    const messageBytes = new TextEncoder().encode(message);

    // Verify the signature using nacl
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (isValid) {
      // Remove used challenge to prevent replay attacks
      challengeStore.delete(walletAddress);
    }

    return isValid;
  } catch (error) {
    console.error("[WalletAuth] Signature verification error:", error);
    return false;
  }
}

/**
 * Verify admin access with signature
 */
export function verifyAdminSignature(
  walletAddress: string,
  signature: string,
  message: string,
  adminWallet: string | undefined
): { valid: boolean; error?: string } {
  // Check if wallet is the admin wallet
  if (!adminWallet) {
    return { valid: false, error: "Admin wallet not configured" };
  }

  if (walletAddress !== adminWallet) {
    return { valid: false, error: "Wallet is not an admin" };
  }

  // Verify the signature
  if (!verifySignature(walletAddress, signature, message)) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

/**
 * Clean up expired challenges
 */
function cleanupExpiredChallenges(): void {
  const now = Date.now();
  for (const [wallet, data] of challengeStore.entries()) {
    if (now > data.expires) {
      challengeStore.delete(wallet);
    }
  }
}

/**
 * Session token management for authenticated admins
 * Uses HMAC for token generation/verification
 */

// Session store (use Redis/DB in production for distributed systems)
const sessionStore = new Map<string, { wallet: string; expires: number }>();

// Session duration (1 hour)
const SESSION_DURATION_MS = 60 * 60 * 1000;

/**
 * Create a session token after successful signature verification
 */
export function createSessionToken(walletAddress: string): string {
  const sessionId = generateSecureToken();
  const expires = Date.now() + SESSION_DURATION_MS;

  sessionStore.set(sessionId, {
    wallet: walletAddress,
    expires,
  });

  return sessionId;
}

/**
 * Verify a session token and return the wallet address
 */
export function verifySessionToken(token: string): string | null {
  const session = sessionStore.get(token);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expires) {
    sessionStore.delete(token);
    return null;
  }

  return session.wallet;
}

/**
 * Invalidate a session token
 */
export function invalidateSession(token: string): void {
  sessionStore.delete(token);
}

/**
 * Generate a cryptographically secure token
 */
function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bs58.encode(bytes);
}
