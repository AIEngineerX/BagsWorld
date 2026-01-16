"use client";

import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import type { WorldState } from "@/lib/types";
import { useEffect } from "react";

async function fetchWorldState(): Promise<WorldState> {
  const response = await fetch("/api/world-state");
  if (!response.ok) {
    throw new Error("Failed to fetch world state");
  }
  const data = await response.json();
  return data;
}

export function useWorldState() {
  const { worldState, setWorldState, setLoading, setError, isLoading, error } =
    useGameStore();

  const query = useQuery({
    queryKey: ["worldState"],
    queryFn: fetchWorldState,
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

  return {
    worldState,
    isLoading: isLoading || query.isLoading,
    error,
    refetch: query.refetch,
  };
}
