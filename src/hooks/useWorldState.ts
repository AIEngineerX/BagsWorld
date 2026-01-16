"use client";

import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import type { WorldState } from "@/lib/types";
import { useEffect, useCallback, useState } from "react";
import { getAllWorldTokens, type LaunchedToken } from "@/lib/token-registry";

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
  const { worldState, setWorldState, setLoading, setError, isLoading, error } =
    useGameStore();

  // Track registered tokens from localStorage
  const [registeredTokens, setRegisteredTokens] = useState<LaunchedToken[]>([]);

  // Load tokens from localStorage on mount and when storage changes
  useEffect(() => {
    const loadTokens = () => {
      const tokens = getAllWorldTokens();
      setRegisteredTokens(tokens);
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

  const query = useQuery({
    queryKey: ["worldState", registeredTokens.map((t) => t.mint).join(",")],
    queryFn: () => fetchWorldState(registeredTokens),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 25000,
    retry: 3,
  });

  useEffect(() => {
    if (query.data) {
      setWorldState(query.data);
    }
  }, [query.data, setWorldState]);

  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  useEffect(() => {
    if (query.error) {
      setError(query.error instanceof Error ? query.error.message : "Unknown error");
    }
  }, [query.error, setError]);

  // Function to trigger refresh after token launch
  const refreshAfterLaunch = useCallback(() => {
    const tokens = getAllWorldTokens();
    setRegisteredTokens(tokens);
    query.refetch();
  }, [query]);

  return {
    worldState,
    isLoading: isLoading || query.isLoading,
    error,
    refetch: query.refetch,
    refreshAfterLaunch,
    tokenCount: registeredTokens.length,
  };
}
