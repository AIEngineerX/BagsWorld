"use client";

import { useState, useEffect, useCallback } from "react";

interface CreatorRanking {
  wallet: string;
  tokenSymbol: string;
  feesGenerated: number;
  rank: number;
}

interface TriggerInfo {
  byThreshold: number | null; // SOL needed to hit threshold
  byTimer: number; // ms until timer expires
  estimatedTrigger: "threshold" | "timer" | "unknown";
}

interface EcosystemStatsData {
  // Reward pool stats
  pendingPoolSol: number;
  thresholdSol: number;
  minimumDistributionSol: number;

  // Timer stats
  cycleStartTime: number;
  backupTimerDays: number;

  // Distribution stats
  totalDistributed: number;
  distributionCount: number;
  lastDistribution: number;

  // Top creators
  topCreators: CreatorRanking[];

  // Recent distributions
  recentDistributions: Array<{
    timestamp: number;
    totalDistributed: number;
    recipients: Array<{
      wallet: string;
      tokenSymbol: string;
      amount: number;
      rank: number;
    }>;
  }>;

  // Trigger info
  triggerInfo?: TriggerInfo;
}

export function EcosystemStats() {
  const [stats, setStats] = useState<EcosystemStatsData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [countdown, setCountdown] = useState<string>("--:--:--");

  // Calculate countdown from stats
  const calculateCountdown = useCallback((cycleStartTime: number, backupTimerDays: number) => {
    const backupTimerMs = backupTimerDays * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - cycleStartTime;
    const remaining = backupTimerMs - elapsed;

    if (remaining <= 0) return "READY!";

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  }, []);

  // Fetch stats from API
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
    const interval = setInterval(fetchStats, 30 * 1000); // Update every 30 seconds for fresher data
    return () => clearInterval(interval);
  }, []);

  // Live countdown ticker - updates every second
  useEffect(() => {
    if (!stats) return;

    // Initial calculation
    setCountdown(calculateCountdown(stats.cycleStartTime, stats.backupTimerDays));

    // Update every second
    const ticker = setInterval(() => {
      setCountdown(calculateCountdown(stats.cycleStartTime, stats.backupTimerDays));
    }, 1000);

    return () => clearInterval(ticker);
  }, [stats, calculateCountdown]);

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const truncateWallet = (wallet: string) => {
    if (!wallet) return "Unknown";
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const getProgressPercentage = () => {
    if (!stats) return 0;
    return Math.min(100, (stats.pendingPoolSol / stats.thresholdSol) * 100);
  };

  if (!stats) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-gray-400 hover:text-bags-green transition-colors"
        title="Creator Rewards - Click for details"
      >
        POOL:{" "}
        <span className="text-bags-green">{stats.pendingPoolSol.toFixed(2)}</span>
        <span className="text-gray-500">/{stats.thresholdSol} SOL</span>
        {" | "}
        DISTRIBUTED:{" "}
        <span className="text-bags-gold">{stats.totalDistributed.toFixed(2)} SOL</span>
      </button>

      {isExpanded && (
        <div className="absolute bottom-8 left-0 bg-bags-dark border-2 border-bags-green p-3 min-w-72 z-50 shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-pixel text-xs text-bags-green">CREATOR REWARDS</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-white"
            >
              [X]
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-[8px] font-pixel text-gray-400 mb-1">
              <span>Pool Progress</span>
              <span>{stats.pendingPoolSol.toFixed(2)} / {stats.thresholdSol} SOL</span>
            </div>
            <div className="h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-bags-green transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          {/* Dual Trigger Display */}
          <div className="space-y-2 font-pixel text-[10px]">
            {/* By Threshold */}
            <div className={`p-2 rounded ${stats.triggerInfo?.estimatedTrigger === "threshold" ? "bg-bags-green/20 border border-bags-green/50" : "bg-gray-800/50"}`}>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">
                  By Threshold:
                  {stats.triggerInfo?.estimatedTrigger === "threshold" && (
                    <span className="ml-1 text-bags-green">(READY!)</span>
                  )}
                </span>
                <span className="text-white font-mono">
                  {stats.pendingPoolSol.toFixed(2)} / {stats.thresholdSol} SOL
                </span>
              </div>
              {stats.triggerInfo && stats.triggerInfo.byThreshold !== null && stats.triggerInfo.byThreshold > 0 && (
                <div className="text-[8px] text-gray-500 mt-1">
                  Need {stats.triggerInfo.byThreshold.toFixed(2)} more SOL
                </div>
              )}
            </div>

            {/* By Timer */}
            <div className={`p-2 rounded ${stats.triggerInfo?.estimatedTrigger === "timer" ? "bg-bags-green/20 border border-bags-green/50" : "bg-gray-800/50"}`}>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">
                  By Timer:
                  {countdown === "READY!" && (
                    <span className="ml-1 text-bags-green">(READY!)</span>
                  )}
                </span>
                <span className={`font-mono ${countdown === "READY!" ? "text-bags-green animate-pulse" : "text-white"}`}>
                  {countdown}
                </span>
              </div>
              <div className="text-[8px] text-gray-500 mt-1">
                Min {stats.minimumDistributionSol} SOL required for timer trigger
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-1 font-pixel text-[10px] mt-3 pt-2 border-t border-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Distributed:</span>
              <span className="text-bags-gold">{stats.totalDistributed.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Distributions:</span>
              <span className="text-white">{stats.distributionCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Distribution:</span>
              <span className="text-white">{formatTimeAgo(stats.lastDistribution)}</span>
            </div>
          </div>

          {/* Top Creators */}
          {stats.topCreators && stats.topCreators.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-700">
              <h4 className="font-pixel text-[9px] text-gray-400 mb-1">CURRENT TOP 3</h4>
              <div className="space-y-1">
                {stats.topCreators.slice(0, 3).map((creator, index) => (
                  <div key={creator.wallet} className="flex justify-between font-pixel text-[9px]">
                    <span className={
                      index === 0 ? "text-bags-gold" :
                      index === 1 ? "text-gray-300" :
                      "text-amber-600"
                    }>
                      #{index + 1} ${creator.tokenSymbol}
                    </span>
                    <span className="text-gray-400">
                      {truncateWallet(creator.wallet)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distribution Split Info */}
          <div className="mt-3 pt-2 border-t border-gray-700">
            <p className="font-pixel text-[8px] text-gray-500">
              Distribution: 50% / 30% / 20% to top 3 creators by fees generated.
              Triggers at {stats.thresholdSol} SOL or {stats.backupTimerDays} days (min {stats.minimumDistributionSol} SOL).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
