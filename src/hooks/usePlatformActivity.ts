"use client";

import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import type { GameEvent } from "@/lib/types";
import { useMemo } from "react";

async function fetchPlatformActivity(knownMints: string[]): Promise<GameEvent[]> {
  const params = new URLSearchParams();
  if (knownMints.length > 0) {
    params.set("knownMints", knownMints.join(","));
  }

  const response = await fetch(`/api/platform-activity?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch platform activity");
  }

  const data = await response.json();
  return data.events ?? [];
}

export function usePlatformActivity() {
  const worldState = useGameStore((s) => s.worldState);

  // Collect registered BagsWorld token mints for dedup
  const knownMints = useMemo(() => {
    if (!worldState?.buildings) return [];
    return worldState.buildings.filter((b) => !b.isPermanent).map((b) => b.tokenMint);
  }, [worldState?.buildings]);

  const query = useQuery({
    queryKey: ["platformActivity", knownMints.join(",")],
    queryFn: () => fetchPlatformActivity(knownMints),
    refetchInterval: 60_000,
    staleTime: 55_000,
    retry: 2,
  });

  return {
    platformEvents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
