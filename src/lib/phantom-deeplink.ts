/**
 * Phantom Wallet deep-link adapter for iOS (Capacitor).
 *
 * When running inside a Capacitor native shell on iOS, the browser extension
 * wallet adapter won't work. Instead we use Phantom's universal link protocol:
 *   https://docs.phantom.com/phantom-deeplinks/provider-methods
 *
 * Flow:
 *   1. App opens phantom://ul/v1/<method>?params... with a callback URL
 *   2. Phantom app opens, user approves
 *   3. Phantom redirects back to bagsworld://phantom/<method>?data=...
 *   4. Capacitor App plugin catches the URL, we parse the response
 */

import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { PHANTOM_DEEP_LINK_BASE, buildCallbackUrl } from "./platform";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface PhantomConnectResult {
  publicKey: PublicKey;
  session: string;
}

export interface PhantomSignResult {
  signature: string;
  publicKey: PublicKey;
}

type PendingResolver = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  method: string;
};

// -------------------------------------------------------------------
// Singleton state — one pending deep-link at a time
// -------------------------------------------------------------------

let pendingRequest: PendingResolver | null = null;
let currentSession: string | null = null;
let connectedPublicKey: PublicKey | null = null;

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------

/** Get the currently connected public key (null if not connected) */
export function getConnectedPublicKey(): PublicKey | null {
  return connectedPublicKey;
}

/** Check if we have an active Phantom session */
export function isConnected(): boolean {
  return !!currentSession && !!connectedPublicKey;
}

/**
 * Connect to Phantom wallet via deep-link.
 * Opens Phantom app, user approves, then Phantom redirects back.
 */
export function connect(): Promise<PhantomConnectResult> {
  return new Promise((resolve, reject) => {
    pendingRequest = { resolve: resolve as (v: unknown) => void, reject, method: "connect" };

    const params = new URLSearchParams({
      app_url: "https://bagsworld.app",
      dapp_encryption_public_key: "", // Not using encryption for simplicity
      redirect_link: buildCallbackUrl("phantom/connect"),
      cluster: "mainnet-beta",
    });

    const url = `${PHANTOM_DEEP_LINK_BASE}/connect?${params.toString()}`;
    window.open(url, "_system");
  });
}

/**
 * Disconnect from Phantom wallet.
 */
export function disconnect(): void {
  currentSession = null;
  connectedPublicKey = null;
}

/**
 * Sign and send a transaction via Phantom deep-link.
 * Phantom signs AND broadcasts the transaction, returning the signature.
 */
export function signAndSendTransaction(
  transaction: Transaction | VersionedTransaction
): Promise<PhantomSignResult> {
  if (!currentSession) {
    return Promise.reject(new Error("Not connected to Phantom. Call connect() first."));
  }

  return new Promise((resolve, reject) => {
    pendingRequest = {
      resolve: resolve as (v: unknown) => void,
      reject,
      method: "signAndSendTransaction",
    };

    const serialized = serializeTransaction(transaction);

    const params = new URLSearchParams({
      session: currentSession!,
      transaction: bs58.encode(serialized),
      redirect_link: buildCallbackUrl("phantom/signAndSendTransaction"),
    });

    const url = `${PHANTOM_DEEP_LINK_BASE}/signAndSendTransaction?${params.toString()}`;
    window.open(url, "_system");
  });
}

/**
 * Sign a transaction without sending (for cases where the app broadcasts).
 */
export function signTransaction(
  transaction: Transaction | VersionedTransaction
): Promise<Transaction | VersionedTransaction> {
  if (!currentSession) {
    return Promise.reject(new Error("Not connected to Phantom. Call connect() first."));
  }

  return new Promise((resolve, reject) => {
    pendingRequest = {
      resolve: resolve as (v: unknown) => void,
      reject,
      method: "signTransaction",
    };

    const serialized = serializeTransaction(transaction);

    const params = new URLSearchParams({
      session: currentSession!,
      transaction: bs58.encode(serialized),
      redirect_link: buildCallbackUrl("phantom/signTransaction"),
    });

    const url = `${PHANTOM_DEEP_LINK_BASE}/signTransaction?${params.toString()}`;
    window.open(url, "_system");
  });
}

// -------------------------------------------------------------------
// Deep-link response handler — called by useDeepLinks hook
// -------------------------------------------------------------------

/**
 * Handle an incoming deep-link URL from Phantom.
 * Called by the Capacitor App 'appUrlOpen' listener.
 *
 * @returns true if this URL was handled as a Phantom callback
 */
export function handlePhantomDeepLink(url: string): boolean {
  if (!url.startsWith("bagsworld://phantom/")) return false;

  const parsed = new URL(url);
  const method = parsed.pathname.replace(/^\/phantom\//, "").replace(/^phantom\//, "");
  const params = parsed.searchParams;

  // Check for errors
  const errorCode = params.get("errorCode");
  if (errorCode) {
    const errorMessage = params.get("errorMessage") || `Phantom error: ${errorCode}`;
    if (pendingRequest?.method === method) {
      pendingRequest.reject(new Error(errorMessage));
      pendingRequest = null;
    }
    return true;
  }

  switch (method) {
    case "connect": {
      const phantomPubKey = params.get("phantom_encryption_public_key");
      const session = params.get("session");
      const publicKeyStr = params.get("public_key");

      if (publicKeyStr && session) {
        currentSession = session;
        connectedPublicKey = new PublicKey(publicKeyStr);

        if (pendingRequest?.method === "connect") {
          pendingRequest.resolve({
            publicKey: connectedPublicKey,
            session: currentSession,
          } as PhantomConnectResult);
          pendingRequest = null;
        }
      }
      break;
    }

    case "signAndSendTransaction": {
      const signature = params.get("signature");
      if (signature && pendingRequest?.method === "signAndSendTransaction") {
        pendingRequest.resolve({
          signature,
          publicKey: connectedPublicKey,
        } as PhantomSignResult);
        pendingRequest = null;
      }
      break;
    }

    case "signTransaction": {
      const transactionStr = params.get("transaction");
      if (transactionStr && pendingRequest?.method === "signTransaction") {
        const buffer = bs58.decode(transactionStr);
        let signedTx: Transaction | VersionedTransaction;
        try {
          signedTx = VersionedTransaction.deserialize(buffer);
        } catch {
          signedTx = Transaction.from(buffer);
        }
        pendingRequest.resolve(signedTx);
        pendingRequest = null;
      }
      break;
    }

    default:
      return false;
  }

  return true;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function serializeTransaction(tx: Transaction | VersionedTransaction): Uint8Array {
  if (tx instanceof VersionedTransaction) {
    return tx.serialize();
  }
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}
