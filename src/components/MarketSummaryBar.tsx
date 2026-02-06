"use client";

import type { MarketSummary } from "@/lib/types";

interface MarketSummaryBarProps {
  summary: MarketSummary;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatFees(value: number): string {
  return value.toFixed(2);
}

export function MarketSummaryBar({ summary }: MarketSummaryBarProps) {
  return (
    <div className="px-3 py-2 bg-black/30 border-b border-bags-green/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <span className="font-pixel text-[6px] text-gray-500 block">24H VOL</span>
            <span className="font-pixel text-[8px] text-bags-gold">
              {formatVolume(summary.totalVolume24h)}
            </span>
          </div>
          <div className="w-px h-4 bg-bags-green/20" />
          <div>
            <span className="font-pixel text-[6px] text-gray-500 block">FEES</span>
            <span className="font-pixel text-[8px] text-bags-gold">
              {formatFees(summary.totalFeesClaimed)} SOL
            </span>
          </div>
          <div className="w-px h-4 bg-bags-green/20" />
          <div>
            <span className="font-pixel text-[6px] text-gray-500 block">TOKENS</span>
            <span className="font-pixel text-[8px] text-white">{summary.activeTokenCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketSummaryBar;
