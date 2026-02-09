"use client";

import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import type { WorldState } from "@/lib/types";
import { useEffect, useCallback, useState, useRef } from "react";
import {
  getAllWorldTokens,
  getAllWorldTokensAsync,
  type LaunchedToken,
} from "@/lib/token-registry";

// Pause polling when the tab is in the background to save CPU/network
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

// Fetch world state by POSTing registered tokens
async function fetchWorldState(tokens: LaunchedToken[]): Promise<WorldState> {
  // Convert LaunchedToken to the format expected by the API
  const registeredTokens = tokens.map((t) => ({
    mint: t.mint,
    name: t.name,
    symbol: t.symbol,
    description: t.description,
    imageUrl: t.imageUrl,
    creator: t.creator,
    createdAt: t.createdAt,
    feeShares: t.feeShares,
  }));

  const response = await fetch("/api/world-state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tokens: registeredTokens }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch world state");
  }

  const data = await response.json();
  return data;
}

export function useWorldState() {
  const { worldState, setWorldState, setLoading, setError, isLoading, error } = useGameStore();
  const isPageVisible = usePageVisible();

  const [registeredTokens, setRegisteredTokens] = useState<LaunchedToken[]>([]);
  const registeredTokensRef = useRef<LaunchedToken[]>([]);

  // Load tokens from localStorage AND global database on mount and when storage changes
  useEffect(() => {
    const loadTokens = async () => {
      // First load local tokens immediately for fast initial render
      const localTokens = getAllWorldTokens();
      setRegisteredTokens(localTokens);

      // Then fetch global tokens (async) for complete world state
      try {
        const allTokens = await getAllWorldTokensAsync();
        setRegisteredTokens(allTokens);
      } catch (error) {
        console.error("Error loading global tokens:", error);
        // Keep using local tokens if global fetch fails
      }
    };

    // Initial load
    loadTokens();

    // Listen for storage changes (from other tabs or LaunchModal)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "bagsworld_tokens") {
        loadTokens();
      }
    };

    // Listen for custom event (from same tab)
    const handleTokenUpdate = () => {
      loadTokens();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("bagsworld-token-update", handleTokenUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("bagsworld-token-update", handleTokenUpdate);
    };
  }, []);

  useEffect(() => {
    registeredTokensRef.current = registeredTokens;
  }, [registeredTokens]);

  const query = useQuery({
    queryKey: ["worldState", registeredTokens.map((t) => t.mint).join(",")],
    queryFn: () => fetchWorldState(registeredTokensRef.current),
    refetchInterval: isPageVisible ? 60000 : false, // Pause polling when tab is hidden
    staleTime: 55000,
    retry: 3,
  });

  // Performance: combine effects into single update to reduce re-renders
  useEffect(() => {
    if (query.data) {
      setWorldState(query.data);
    }
    setLoading(query.isLoading);
    if (query.error) {
      setError(query.error instanceof Error ? query.error.message : "Unknown error");
    }
  }, [query.data, query.isLoading, query.error, setWorldState, setLoading, setError]);

  const refreshAfterLaunch = useCallback(() => {
    const tokens = getAllWorldTokens();
    setRegisteredTokens(tokens);
  }, []);

  return {
    worldState,
    isLoading: isLoading || query.isLoading,
    error,
    refetch: query.refetch,
    refreshAfterLaunch,
    tokenCount: registeredTokens.length,
  };
}
