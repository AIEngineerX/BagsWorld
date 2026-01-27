"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * Hook to check admin status via server-side API.
 * This avoids relying on client-side env vars which may not be embedded correctly.
 */
export function useAdminCheck() {
  const { publicKey, connected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      if (!connected || !publicKey) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/admin/check?wallet=${publicKey.toBase58()}`);
        const data = await response.json();
        setIsAdmin(data.isAdmin === true);
        setIsConfigured(data.configured === true);
      } catch (error) {
        console.error("[useAdminCheck] Failed to check admin status:", error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    checkAdmin();
  }, [connected, publicKey]);

  return { isAdmin, isLoading, isConfigured };
}
