/**
 * React hook for Phantom wallet on iOS native (Capacitor).
 *
 * Provides the same signTransaction/signAndSendTransaction API as @solana/wallet-adapter-react
 * but routes through Phantom deep-links instead of browser extension.
 *
 * Components can use this alongside useWallet() — the hook auto-detects
 * whether to use deep-link flow or fall through to the standard adapter.
 *
 * Usage:
 *   const { signTransaction, signAndSendTransaction, connectPhantom, isNative } = usePhantomMobile();
 *
 *   // In your transaction flow:
 *   if (isNative) {
 *     const result = await signAndSendTransaction(tx);
 *   } else {
 *     // Use standard useWallet() signTransaction
 *   }
 */

"use client";

import { useState, useCallback } from "react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { shouldUseDeepLink } from "@/lib/platform";
import {
  connect as phantomConnect,
  disconnect as phantomDisconnect,
  signTransaction as phantomSignTx,
  signAndSendTransaction as phantomSignAndSend,
  getConnectedPublicKey,
  isConnected as phantomIsConnected,
} from "@/lib/phantom-deeplink";

export function usePhantomMobile() {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(getConnectedPublicKey());
  const [connecting, setConnecting] = useState(false);
  const isNative = shouldUseDeepLink();

  const connectPhantom = useCallback(async () => {
    if (!isNative) return;
    setConnecting(true);
    try {
      const result = await phantomConnect();
      setPublicKey(result.publicKey);
    } finally {
      setConnecting(false);
    }
  }, [isNative]);

  const disconnectPhantom = useCallback(() => {
    phantomDisconnect();
    setPublicKey(null);
  }, []);

  const signTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction) => {
      if (!isNative) throw new Error("Not in native context");
      return phantomSignTx(tx);
    },
    [isNative]
  );

  const signAndSendTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction) => {
      if (!isNative) throw new Error("Not in native context");
      return phantomSignAndSend(tx);
    },
    [isNative]
  );

  return {
    /** Whether we're in a native context that requires deep-link flow */
    isNative,
    /** Connected public key (null if not connected) */
    publicKey,
    /** Whether a connection is in progress */
    connecting,
    /** Whether the wallet is connected */
    connected: phantomIsConnected(),
    /** Connect to Phantom via deep-link */
    connectPhantom,
    /** Disconnect from Phantom */
    disconnectPhantom,
    /** Sign a transaction via deep-link (returns signed tx, app broadcasts) */
    signTransaction,
    /** Sign and send a transaction via deep-link (Phantom broadcasts) */
    signAndSendTransaction,
  };
}
