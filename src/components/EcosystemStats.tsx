"use client";

import { useState, useEffect } from "react";

interface EcosystemStatsData {
  totalClaimed: number;
  totalBuybacksSol: number;
  totalTokensBurned: number;
  lastBuyback: number;
  buybackCount: number;
}

export function EcosystemStats() {
  const [stats, setStats] = useState<EcosystemStatsData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/ecosystem-stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch {
        // Silent fail - stats are optional
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (!stats) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-gray-400 hover:text-bags-green transition-colors"
        title="Buyback Stats - Click for details"
      >
        BUYBACKS:{" "}
        <span className="text-bags-green">{stats.totalBuybacksSol.toFixed(2)} SOL</span>
        {" | "}
        BURNED:{" "}
        <span className="text-bags-gold">{stats.totalTokensBurned}</span>
      </button>

      {isExpanded && (
        <div className="absolute bottom-8 left-0 bg-bags-dark border-2 border-bags-green p-3 min-w-64 z-50 shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-pixel text-xs text-bags-green">BUYBACK STATS</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-white"
            >
              [X]
            </button>
          </div>

          <div className="space-y-1 font-pixel text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Buybacks:</span>
              <span className="text-bags-green">{stats.totalBuybacksSol.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tokens Burned:</span>
              <span className="text-bags-gold">{stats.totalTokensBurned}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Buyback Cycles:</span>
              <span className="text-white">{stats.buybackCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Buyback:</span>
              <span className="text-white">{formatTimeAgo(stats.lastBuyback)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fees Collected:</span>
              <span className="text-white">{stats.totalClaimed.toFixed(4)} SOL</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-700">
            <p className="font-pixel text-[8px] text-gray-500">
              1% fee funds buybacks every 12h. Top 5 tokens bought & burned.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
