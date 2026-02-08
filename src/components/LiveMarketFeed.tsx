"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useGameStore } from "@/lib/store";
import type { GameBuilding, MarketEvent, MarketSummary } from "@/lib/types";
import { usePlatformActivity } from "@/hooks/usePlatformActivity";
import { MarketSummaryBar } from "./MarketSummaryBar";
import { MarketEventItem } from "./MarketEventItem";
import { SignalIcon, ChartUpIcon, ChartDownIcon } from "./icons";

type ViewMode = "tokens" | "activity";
type SortMode = "volume" | "mcap" | "change";
type MarketFilter = "all" | "launches" | "claims" | "trades";

const MAX_EVENTS = 50;

function formatMcap(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value > 0) return `$${value.toFixed(0)}`;
  return "-";
}

function formatVol(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value > 0) return `$${value.toFixed(0)}`;
  return "-";
}

function TokenRow({ token, rank }: { token: GameBuilding; rank: number }) {
  const change = token.change24h ?? 0;
  const isPositive = change >= 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-bags-green/5 transition-colors">
      <span className="font-pixel text-[7px] text-gray-600 w-3 text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[8px] text-gray-200 truncate">${token.symbol}</span>
          <span
            className={`font-pixel text-[8px] ${isPositive ? "text-bags-green" : "text-red-400"}`}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between mt-px">
          <span className="font-pixel text-[6px] text-gray-500">
            {formatMcap(token.marketCap ?? 0)}
          </span>
          <span className="font-pixel text-[6px] text-gray-500">
            {formatVol(token.volume24h ?? 0)} vol
          </span>
        </div>
      </div>
    </div>
  );
}

export function LiveMarketFeed() {
  const worldState = useGameStore((s) => s.worldState);
  const { platformEvents, platformSummary } = usePlatformActivity();
  const [viewMode, setViewMode] = useState<ViewMode>("tokens");
  const [sortMode, setSortMode] = useState<SortMode>("volume");
  const [activityFilter, setActivityFilter] = useState<MarketFilter>("all");
  const listRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const buildings = useMemo(() => worldState?.buildings ?? [], [worldState?.buildings]);
  const events = useMemo(() => worldState?.events ?? [], [worldState?.events]);

  // Sorted token list (non-permanent buildings with market data)
  const sortedTokens = useMemo(() => {
    const tokens = buildings.filter(
      (b) => !b.isPermanent && (b.marketCap || b.volume24h || b.change24h !== undefined)
    );

    switch (sortMode) {
      case "volume":
        return [...tokens].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
      case "mcap":
        return [...tokens].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
      case "change":
        return [...tokens].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
      default:
        return tokens;
    }
  }, [buildings, sortMode]);

  // Compute market summary from buildings + platform Bags.fm data
  const summary = useMemo<MarketSummary>(() => {
    let totalVolume24h = platformSummary.totalVolume24h;
    let totalFeesClaimed = platformSummary.totalFeesClaimed;
    let topGainer: MarketSummary["topGainer"] = null;
    let topLoser: MarketSummary["topLoser"] = null;

    for (const b of buildings) {
      if (!b.isPermanent) {
        totalVolume24h += b.volume24h ?? 0;
      }

      if (b.change24h != null) {
        if (!topGainer || b.change24h > topGainer.change) {
          topGainer = { symbol: b.symbol, change: b.change24h };
        }
        if (!topLoser || b.change24h < topLoser.change) {
          topLoser = { symbol: b.symbol, change: b.change24h };
        }
      }
    }

    for (const e of events) {
      if (e.type === "fee_claim" && e.data?.amount) {
        totalFeesClaimed += e.data.amount;
      }
    }

    const registeredTokenCount = buildings.filter((b) => !b.isPermanent).length;
    const activeTokenCount = platformSummary.activeTokenCount + registeredTokenCount;

    return { totalVolume24h, totalFeesClaimed, activeTokenCount, topGainer, topLoser };
  }, [buildings, events, platformSummary]);

  // Transform GameEvent[] into MarketEvent[], merging BagsWorld + platform events
  const marketEvents = useMemo<MarketEvent[]>(() => {
    const bwEvents: MarketEvent[] = events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      timestamp: e.timestamp,
      tokenSymbol: e.data?.symbol,
      tokenName: e.data?.tokenName,
      amount: e.data?.amount,
      change: e.data?.change,
      source: "bagsworld" as const,
    }));

    const pfEvents: MarketEvent[] = platformEvents.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      timestamp: e.timestamp,
      tokenSymbol: e.data?.symbol,
      tokenName: e.data?.tokenName,
      amount: e.data?.amount,
      change: e.data?.change,
      source: "platform" as const,
    }));

    const seen = new Set<string>();
    const merged: MarketEvent[] = [];

    for (const e of [...bwEvents, ...pfEvents]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        merged.push(e);
      }
    }

    return merged
      .sort((a, b) => {
        const timeDiff = b.timestamp - a.timestamp;
        if (timeDiff !== 0) return timeDiff;
        if (a.source === "bagsworld" && b.source !== "bagsworld") return -1;
        if (b.source === "bagsworld" && a.source !== "bagsworld") return 1;
        return 0;
      })
      .slice(0, MAX_EVENTS);
  }, [events, platformEvents]);

  // Apply filter to activity events
  const filteredEvents = useMemo(() => {
    switch (activityFilter) {
      case "launches":
        return marketEvents.filter(
          (e) =>
            e.type === "token_launch" ||
            e.type === "building_constructed" ||
            e.type === "platform_launch"
        );
      case "claims":
        return marketEvents.filter((e) => e.type === "fee_claim" || e.type === "milestone");
      case "trades":
        return marketEvents
          .filter(
            (e) => e.type === "price_pump" || e.type === "price_dump" || e.type === "whale_alert"
          )
          .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
      default:
        return marketEvents;
    }
  }, [marketEvents, activityFilter]);

  // Auto-scroll to top when new events arrive (unless user scrolled)
  useEffect(() => {
    if (!userScrolled && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [filteredEvents, userScrolled]);

  const handleScroll = useCallback(() => {
    if (listRef.current) {
      setUserScrolled(listRef.current.scrollTop > 10);
    }
  }, []);

  // Top gainer/loser mini-display
  const topGainer = summary.topGainer;
  const topLoser = summary.topLoser;

  return (
    <div className="h-full flex flex-col bg-bags-darker">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bags-green/30">
        <div className="flex items-center gap-2">
          <span className="text-bags-green animate-pulse">
            <SignalIcon size={12} />
          </span>
          <span className="font-pixel text-[9px] text-bags-green">MARKET</span>
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>
        {/* View toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("tokens")}
            className={`font-pixel text-[7px] px-1.5 py-0.5 transition-colors ${
              viewMode === "tokens"
                ? "text-bags-gold bg-bags-gold/10"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            TOKENS
          </button>
          <button
            onClick={() => setViewMode("activity")}
            className={`font-pixel text-[7px] px-1.5 py-0.5 transition-colors ${
              viewMode === "activity"
                ? "text-bags-gold bg-bags-gold/10"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            ACTIVITY
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <MarketSummaryBar summary={summary} />

      {/* Gainers/Losers Row */}
      {(topGainer || topLoser) && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/20 border-b border-bags-green/20">
          {topGainer && topGainer.change > 0 && (
            <div className="flex items-center gap-1">
              <ChartUpIcon size={10} />
              <span className="font-pixel text-[7px] text-bags-green">
                ${topGainer.symbol} +{topGainer.change.toFixed(1)}%
              </span>
            </div>
          )}
          {topLoser && topLoser.change < 0 && (
            <div className="flex items-center gap-1">
              <ChartDownIcon size={10} />
              <span className="font-pixel text-[7px] text-red-400">
                ${topLoser.symbol} {topLoser.change.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {viewMode === "tokens" ? (
        <>
          {/* Sort options */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-bags-green/10">
            {(["volume", "mcap", "change"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortMode(s)}
                className={`font-pixel text-[6px] px-1.5 py-0.5 transition-colors ${
                  sortMode === s
                    ? "text-bags-gold bg-bags-gold/10"
                    : "text-gray-600 hover:text-gray-400"
                }`}
              >
                {s === "volume" ? "VOL" : s === "mcap" ? "MCAP" : "24H%"}
              </button>
            ))}
            <span className="flex-1" />
            <span className="font-pixel text-[6px] text-gray-600">
              {sortedTokens.length} tokens
            </span>
          </div>

          {/* Token List */}
          <div
            className="flex-1 overflow-y-auto min-h-0"
            role="list"
            aria-label="Token market data"
          >
            {sortedTokens.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center py-4">
                  <p className="font-pixel text-[8px] text-gray-500">No tokens registered yet</p>
                  <p className="font-pixel text-[7px] text-gray-600 mt-1">
                    Launch a token to see market data
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-bags-green/5">
                {sortedTokens.map((token, idx) => (
                  <TokenRow key={token.id} token={token} rank={idx + 1} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Activity Filter Tabs */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-bags-green/10">
            {(["all", "launches", "claims", "trades"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setActivityFilter(f)}
                className={`font-pixel text-[6px] px-1.5 py-0.5 transition-colors ${
                  activityFilter === f
                    ? "text-bags-gold bg-bags-gold/10"
                    : "text-gray-600 hover:text-gray-400"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Event List */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto min-h-0"
            role="feed"
            aria-label="Market events feed"
          >
            {filteredEvents.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center py-4">
                  <p className="font-pixel text-[8px] text-gray-500">
                    Waiting for market activity...
                  </p>
                  <p className="font-pixel text-[7px] text-gray-600 mt-1">
                    Events appear as tokens are launched, traded, and claimed
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-bags-green/10">
                {filteredEvents.map((event) => (
                  <MarketEventItem key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default LiveMarketFeed;
