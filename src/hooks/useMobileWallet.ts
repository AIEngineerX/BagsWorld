/**
 * Mobile-aware wallet hook.
 *
 * Drop-in replacement for the signTransaction pattern used across components.
 * On web: delegates to standard @solana/wallet-adapter signTransaction.
 * On iOS native (Capacitor): uses Phantom deep-link to sign + send in one step.
 *
 * Usage in components:
 *   // Replace:
 *   const { signTransaction } = useWallet();
 *   // With:
 *   const { mobileSignTransaction } = useMobileWallet();
 *
 *   // Then use it identically:
 *   const signedTx = await mobileSignTransaction(transaction);
 */

"use client";

import { useCallback, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { shouldUseDeepLink } from "@/lib/platform";
import {
  connect as phantomConnect,
  signTransaction as phantomSignTx,
  signAndSendTransaction as phantomSignAndSend,
  isConnected as phantomIsConnected,
  getConnectedPublicKey,
} from "@/lib/phantom-deeplink";

export function useMobileWallet() {
  const wallet = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();
  const isNative = shouldUseDeepLink();

  // Track Phantom deep-link connection state
  const [phantomPubKey, setPhantomPubKey] = useState(getConnectedPublicKey());

  // Sync deep-link connection state
  useEffect(() => {
    if (isNative) {
      const interval = setInterval(() => {
        setPhantomPubKey(getConnectedPublicKey());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isNative]);

  // Effective connection state — merges wallet adapter + deep-link
  const connected = isNative ? phantomIsConnected() : wallet.connected;
  const publicKey = isNative ? phantomPubKey : wallet.publicKey;

  /**
   * Ensure wallet is connected. Opens connection flow if needed.
   * Returns true if connected, false if user needs to connect.
   */
  const ensureConnected = useCallback(async (): Promise<boolean> => {
    if (connected && publicKey) return true;

    if (isNative) {
      try {
        const result = await phantomConnect();
        setPhantomPubKey(result.publicKey);
        return true;
      } catch {
        return false;
      }
    } else {
      setWalletModalVisible(true);
      return false;
    }
  }, [connected, publicKey, isNative, setWalletModalVisible]);

  /**
   * Sign a transaction. Works on both web and iOS native.
   * On web: uses wallet adapter signTransaction.
   * On iOS native: deep-links to Phantom for signing.
   */
  const mobileSignTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction
    ): Promise<Transaction | VersionedTransaction> => {
      if (isNative) {
        return phantomSignTx(transaction);
      }

      if (!wallet.signTransaction) {
        throw new Error("Wallet does not support transaction signing");
      }
      return wallet.signTransaction(transaction);
    },
    [isNative, wallet]
  );

  /**
   * Sign and send a transaction in one step.
   * On web: signs via wallet adapter, then sends via connection.
   * On iOS native: Phantom handles both signing and broadcasting.
   */
  const mobileSignAndSend = useCallback(
    async (transaction: Transaction | VersionedTransaction): Promise<string> => {
      if (isNative) {
        const result = await phantomSignAndSend(transaction);
        return result.signature;
      }

      if (!wallet.signTransaction) {
        throw new Error("Wallet does not support transaction signing");
      }
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      return signature;
    },
    [isNative, wallet, connection]
  );

  return {
    /** Whether we're in iOS native deep-link mode */
    isNative,
    /** Whether wallet is connected (works for both web and native) */
    connected,
    /** Connected public key (works for both web and native) */
    publicKey,
    /** Ensure wallet is connected, prompting if needed */
    ensureConnected,
    /** Sign a transaction — drop-in replacement for wallet.signTransaction */
    mobileSignTransaction,
    /** Sign and send in one step */
    mobileSignAndSend,
    /** The underlying wallet adapter (for accessing signAllTransactions etc.) */
    wallet,
  };
}
