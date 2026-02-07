"use client";

import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import type { GameEvent } from "@/lib/types";
import { useMemo } from "react";

interface PlatformSummary {
  totalVolume24h: number;
  totalFeesClaimed: number;
  activeTokenCount: number;
}

interface PlatformActivityResult {
  events: GameEvent[];
  summary: PlatformSummary;
}

async function fetchPlatformActivity(knownMints: string[]): Promise<PlatformActivityResult> {
  const params = new URLSearchParams();
  if (knownMints.length > 0) {
    params.set("knownMints", knownMints.join(","));
  }

  const response = await fetch(`/api/platform-activity?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch platform activity");
  }

  const data = await response.json();
  return {
    events: data.events ?? [],
    summary: data.summary ?? { totalVolume24h: 0, totalFeesClaimed: 0, activeTokenCount: 0 },
  };
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
    refetchInterval: 3 * 60_000, // 3 min — matches server cache TTL
    staleTime: 2.5 * 60_000,
    retry: 2,
  });

  const defaultSummary: PlatformSummary = {
    totalVolume24h: 0,
    totalFeesClaimed: 0,
    activeTokenCount: 0,
  };

  return {
    platformEvents: query.data?.events ?? [],
    platformSummary: query.data?.summary ?? defaultSummary,
    isLoading: query.isLoading,
    error: query.error,
  };
}
