"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useGameStore } from "@/lib/store";
import type { MarketEvent, MarketSummary } from "@/lib/types";
import { MarketSummaryBar } from "./MarketSummaryBar";
import { TokenPriceTicker } from "./TokenPriceTicker";
import { MarketEventItem } from "./MarketEventItem";
import { SignalIcon } from "./icons";

type MarketFilter = "all" | "launches" | "claims" | "trades";

const MAX_EVENTS = 50;

export function LiveMarketFeed() {
  const worldState = useGameStore((s) => s.worldState);
  const [filter, setFilter] = useState<MarketFilter>("all");
  const listRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const buildings = useMemo(() => worldState?.buildings ?? [], [worldState?.buildings]);
  const events = useMemo(() => worldState?.events ?? [], [worldState?.events]);

  // Compute market summary from buildings
  const summary = useMemo<MarketSummary>(() => {
    let totalVolume24h = 0;
    let totalFeesClaimed = 0;
    let topGainer: MarketSummary["topGainer"] = null;
    let topLoser: MarketSummary["topLoser"] = null;

    for (const b of buildings) {
      totalVolume24h += b.volume24h ?? 0;

      if (b.change24h != null) {
        if (!topGainer || b.change24h > topGainer.change) {
          topGainer = { symbol: b.symbol, change: b.change24h };
        }
        if (!topLoser || b.change24h < topLoser.change) {
          topLoser = { symbol: b.symbol, change: b.change24h };
        }
      }
    }

    // Estimate fees from fee_claim events
    for (const e of events) {
      if (e.type === "fee_claim" && e.data?.amount) {
        totalFeesClaimed += e.data.amount;
      }
    }

    return {
      totalVolume24h,
      totalFeesClaimed,
      activeTokenCount: buildings.filter((b) => !b.isPermanent).length,
      topGainer,
      topLoser,
    };
  }, [buildings, events]);

  // Transform GameEvent[] into MarketEvent[]
  const marketEvents = useMemo<MarketEvent[]>(() => {
    return events
      .map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        timestamp: e.timestamp,
        tokenSymbol: e.data?.symbol,
        tokenName: e.data?.tokenName,
        amount: e.data?.amount,
        change: e.data?.change,
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_EVENTS);
  }, [events]);

  // Apply filter
  const filteredEvents = useMemo(() => {
    switch (filter) {
      case "launches":
        return marketEvents.filter(
          (e) => e.type === "token_launch" || e.type === "building_constructed"
        );
      case "claims":
        return marketEvents.filter((e) => e.type === "fee_claim");
      case "trades":
        return marketEvents.filter(
          (e) => e.type === "price_pump" || e.type === "price_dump" || e.type === "whale_alert"
        );
      default:
        return marketEvents;
    }
  }, [marketEvents, filter]);

  // Auto-scroll to top when new events arrive (unless user scrolled)
  useEffect(() => {
    if (!userScrolled && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [filteredEvents, userScrolled]);

  // Detect user scroll
  const handleScroll = useCallback(() => {
    if (listRef.current) {
      setUserScrolled(listRef.current.scrollTop > 10);
    }
  }, []);

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
        {/* Filter Tabs */}
        <div className="flex gap-1">
          {(["all", "launches", "claims", "trades"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-pixel text-[7px] px-1.5 py-0.5 transition-colors ${
                filter === f
                  ? "text-bags-gold bg-bags-gold/10"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <MarketSummaryBar summary={summary} />

      {/* Price Ticker */}
      <TokenPriceTicker buildings={buildings} />

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
              <p className="font-pixel text-[8px] text-gray-500">Waiting for market activity...</p>
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
    </div>
  );
}

export default LiveMarketFeed;
