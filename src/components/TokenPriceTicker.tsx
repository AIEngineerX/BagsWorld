"use client";

import React, { useMemo } from "react";
import type { GameBuilding } from "@/lib/types";

interface TokenPriceTickerProps {
  buildings: GameBuilding[];
}

const TokenPriceTicker = React.memo(function TokenPriceTicker({
  buildings,
}: TokenPriceTickerProps) {
  const tickerItems = useMemo(() => {
    const withChange = buildings.filter(
      (b) => !b.isPermanent && b.change24h !== undefined && b.change24h !== null
    );

    if (withChange.length === 0) return null;

    const sorted = [...withChange].sort((a, b) => Math.abs(b.change24h!) - Math.abs(a.change24h!));

    return sorted.map((b) => {
      const change = b.change24h!;
      return (
        <span key={b.id} className="inline-flex items-center gap-1 px-2 py-1">
          <span className="font-pixel text-[7px] text-gray-400">${b.symbol}</span>
          <span
            className={`font-pixel text-[7px] ${change >= 0 ? "text-bags-green" : "text-red-400"}`}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        </span>
      );
    });
  }, [buildings]);

  if (!tickerItems) return null;

  return (
    <div className="overflow-hidden bg-black/20 border-b border-bags-green/20">
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: "ticker-scroll 25s linear infinite",
        }}
      >
        {tickerItems}
        {tickerItems}
      </div>
      <style jsx>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
});

export { TokenPriceTicker };
export default TokenPriceTicker;
