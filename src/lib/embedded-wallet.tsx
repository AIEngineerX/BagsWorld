"use client";

/**
 * Embedded Wallet Context for One-Click Trading
 *
 * Uses Privy for embedded wallets in the Trading Terminal.
 * External wallets (Phantom/Solflare) are still used for:
 * - Token launching
 * - Fee claiming
 * - Partner claims
 *
 * This hybrid approach allows:
 * - One-click swaps (no popup) via embedded wallet
 * - Existing wallet positions remain accessible via external wallet
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { VersionedTransaction, Connection } from "@solana/web3.js";

// Types for embedded wallet state
interface EmbeddedWalletState {
  // Wallet info
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;

  // Balance
  balance: number;

  // Actions
  login: () => Promise<void>;
  logout: () => Promise<void>;
  signAndSendTransaction: (transaction: VersionedTransaction) => Promise<string>;

  // Status
  error: string | null;
  isPrivyAvailable: boolean;
}

const EmbeddedWalletContext = createContext<EmbeddedWalletState | null>(null);

// Check if Privy is configured
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/**
 * Embedded Wallet Provider
 *
 * When Privy is configured (NEXT_PUBLIC_PRIVY_APP_ID env var):
 * - Provides one-click trading via embedded wallet
 * - Signs transactions without popup
 *
 * When Privy is NOT configured:
 * - Falls back to requiring external wallet
 * - All features still work, just with manual signing
 */
export function EmbeddedWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // For now, this is a placeholder implementation
  // When Privy is added, this will use their SDK
  const isPrivyAvailable = !!PRIVY_APP_ID;

  // Simulated login (will be replaced with Privy)
  const login = useCallback(async () => {
    if (!isPrivyAvailable) {
      setError("Embedded wallet not configured. Use external wallet.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with Privy login
      // const { user } = await privy.login();
      // const wallet = user.wallet;
      // setAddress(wallet.address);
      // setIsConnected(true);

      setError("Privy integration pending. Please use external wallet for now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }, [isPrivyAvailable]);

  const logout = useCallback(async () => {
    setAddress(null);
    setIsConnected(false);
    setBalance(0);
  }, []);

  // Sign and send transaction (one-click, no popup)
  const signAndSendTransaction = useCallback(async (
    transaction: VersionedTransaction
  ): Promise<string> => {
    if (!isConnected || !address) {
      throw new Error("Embedded wallet not connected");
    }

    // TODO: Replace with Privy signAndSendTransaction
    // const { signature } = await privy.signAndSendTransaction({
    //   transaction: transaction.serialize(),
    //   wallet: embeddedWallet,
    //   options: { uiOptions: { showWalletUIs: false } } // No popup!
    // });
    // return signature;

    throw new Error("Privy integration pending");
  }, [isConnected, address]);

  // Fetch balance when connected
  useEffect(() => {
    if (!address) return;

    const fetchBalance = async () => {
      try {
        const connection = new Connection(
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
        );
        // const bal = await connection.getBalance(new PublicKey(address));
        // setBalance(bal / 1e9);
      } catch (err) {
        console.error("Failed to fetch balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [address]);

  const value: EmbeddedWalletState = {
    address,
    isConnected,
    isLoading,
    balance,
    login,
    logout,
    signAndSendTransaction,
    error,
    isPrivyAvailable,
  };

  return (
    <EmbeddedWalletContext.Provider value={value}>
      {children}
    </EmbeddedWalletContext.Provider>
  );
}

/**
 * Hook to use embedded wallet
 */
export function useEmbeddedWallet() {
  const context = useContext(EmbeddedWalletContext);
  if (!context) {
    throw new Error("useEmbeddedWallet must be used within EmbeddedWalletProvider");
  }
  return context;
}

/**
 * Hook for hybrid wallet usage
 *
 * Returns the best available wallet for trading:
 * - Embedded wallet if connected (one-click)
 * - Falls back to external wallet
 */
export function useHybridWallet() {
  const embedded = useContext(EmbeddedWalletContext);

  // This will be enhanced when Privy is integrated
  return {
    // Use embedded if available and connected
    useEmbeddedForTrading: embedded?.isConnected && embedded?.isPrivyAvailable,
    embedded,
  };
}
