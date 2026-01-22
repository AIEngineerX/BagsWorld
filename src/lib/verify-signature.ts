// Solana signature verification for admin authentication
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verifies a Solana wallet signature for admin authentication.
 * The message must be: "casino-admin:{action}:{timestamp}"
 *
 * @param wallet - The wallet address claiming to be admin
 * @param signature - Base64 encoded signature
 * @param action - The action being performed (e.g., "create-raffle", "draw")
 * @param timestamp - Unix timestamp in milliseconds
 * @param adminWallet - The expected admin wallet address
 * @returns Object with verified status and error message if failed
 */
export function verifyAdminSignature(
  wallet: string,
  signature: string,
  action: string,
  timestamp: number,
  adminWallet: string
): { verified: boolean; error?: string } {
  try {
    // Check if wallet matches admin
    if (wallet !== adminWallet) {
      return { verified: false, error: "Not admin wallet" };
    }

    // Check timestamp freshness (prevent replay attacks)
    const now = Date.now();
    if (Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_MS) {
      return { verified: false, error: "Signature expired" };
    }

    // Reconstruct the message that was signed
    const message = `casino-admin:${action}:${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);

    // Decode signature from base64
    const signatureBytes = Buffer.from(signature, "base64");

    // Verify public key format
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(wallet);
    } catch {
      return { verified: false, error: "Invalid wallet address" };
    }

    // Verify signature using nacl
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!isValid) {
      return { verified: false, error: "Invalid signature" };
    }

    return { verified: true };
  } catch (error) {
    console.error("[Auth] Signature verification error:", error);
    return { verified: false, error: "Verification failed" };
  }
}

/**
 * Creates the message that needs to be signed by the admin wallet.
 * Use this on the client side.
 */
export function createAdminMessage(action: string, timestamp: number): string {
  return `casino-admin:${action}:${timestamp}`;
}
