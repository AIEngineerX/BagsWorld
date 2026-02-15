import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/** Verifies a Solana wallet signature for admin authentication. */
export function verifyAdminSignature(
  wallet: string,
  signature: string,
  action: string,
  timestamp: number,
  adminWallet: string | string[]
): { verified: boolean; error?: string } {
  try {
    const adminWallets = Array.isArray(adminWallet) ? adminWallet : [adminWallet];
    if (!adminWallets.includes(wallet)) {
      return { verified: false, error: "Not admin wallet" };
    }

    if (Math.abs(Date.now() - timestamp) > SIGNATURE_MAX_AGE_MS) {
      return { verified: false, error: "Signature expired" };
    }

    const message = `casino-admin:${action}:${timestamp}`;
    const messageBytes = new Uint8Array(Buffer.from(message, "utf-8"));
    const signatureBytes = new Uint8Array(Buffer.from(signature, "base64"));

    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(wallet);
    } catch {
      return { verified: false, error: "Invalid wallet address" };
    }

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      new Uint8Array(publicKey.toBytes())
    );

    return isValid ? { verified: true } : { verified: false, error: "Invalid signature" };
  } catch (error) {
    console.error("[Auth] Signature verification error:", error);
    return { verified: false, error: "Verification failed" };
  }
}
