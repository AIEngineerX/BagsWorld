"use client";

import { useMemo, useRef, useEffect, useCallback, useState } from "react";
import { useGameStore } from "@/lib/store";
import type { MarketEvent, MarketSummary } from "@/lib/types";
import { MarketSummaryBar } from "./MarketSummaryBar";
import { TokenPriceTicker } from "./TokenPriceTicker";
import { MarketEventItem } from "./MarketEventItem";
import { SignalIcon } from "./icons";

const MAX_EVENTS = 50;
const FEED_MAX_AGE_MS = 6 * 60 * 60 * 1000; // Only show events from last 6h in the feed

function formatUpdatedAgo(ts: number | undefined): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function LiveMarketFeed() {
  const worldState = useGameStore((s) => s.worldState);
  const listRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const buildings = useMemo(() => worldState?.buildings ?? [], [worldState?.buildings]);
  const events = useMemo(() => worldState?.events ?? [], [worldState?.events]);
  const lastUpdated = worldState?.lastUpdated;

  // Compute market summary from buildings (platform data is already blended server-side)
  const summary = useMemo<MarketSummary>(() => {
    let totalVolume24h = 0;
    let totalFeesClaimed = 0;
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
      if ((e.type === "fee_claim" || e.type === "platform_claim") && e.data?.amount) {
        totalFeesClaimed += e.data.amount;
      }
    }

    const activeTokenCount = buildings.filter((b) => !b.isPermanent).length;

    return {
      totalVolume24h,
      totalFeesClaimed,
      activeTokenCount,
      topGainer,
      topLoser,
    };
  }, [buildings, events]);

  // Transform GameEvent[] into MarketEvent[] (single source — platform events included server-side)
  const marketEvents = useMemo<MarketEvent[]>(() => {
    const cutoff = Date.now() - FEED_MAX_AGE_MS;

    return events
      .filter((e) => e.timestamp > cutoff)
      .map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        timestamp: e.timestamp,
        tokenSymbol: e.data?.symbol,
        tokenName: e.data?.tokenName,
        amount: e.data?.amount,
        change: e.data?.change,
        source: (e.type.startsWith("platform_") ? "platform" : "bagsworld") as
          | "bagsworld"
          | "platform",
      }))
      .sort((a, b) => {
        const timeDiff = b.timestamp - a.timestamp;
        if (timeDiff !== 0) return timeDiff;
        // BagsWorld events first at same timestamp
        if (a.source === "bagsworld" && b.source !== "bagsworld") return -1;
        if (b.source === "bagsworld" && a.source !== "bagsworld") return 1;
        return 0;
      })
      .slice(0, MAX_EVENTS);
  }, [events]);

  // Auto-scroll to top when new events arrive (unless user scrolled)
  useEffect(() => {
    if (!userScrolled && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [marketEvents, userScrolled]);

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
          {lastUpdated && (
            <span className="font-pixel text-[5px] text-gray-600">
              {formatUpdatedAgo(lastUpdated)}
            </span>
          )}
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
        {marketEvents.length === 0 ? (
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
            {marketEvents.map((event) => (
              <MarketEventItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveMarketFeed;
