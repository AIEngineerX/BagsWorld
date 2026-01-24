"use client";

import { useState, useEffect } from "react";

interface RewardsState {
  pendingPoolSol: number;
  thresholdSol: number;
  minimumDistributionSol: number;
  cycleStartTime: number;
  backupTimerDays: number;
  totalDistributed: number;
  distributionCount: number;
  lastDistribution: number;
  topCreators: Array<{
    wallet: string;
    tokenSymbol?: string;
    feesGenerated: number;
    rank: number;
  }>;
  recentDistributions: Array<{
    timestamp: number;
    totalDistributed: number;
    recipients: Array<{
      wallet: string;
      tokenSymbol?: string;
      amount: number;
      rank: number;
    }>;
  }>;
  distribution: {
    first: number;
    second: number;
    third: number;
  };
}

interface CreatorRewardsModalProps {
  onClose: () => void;
}

export function CreatorRewardsModal({ onClose }: CreatorRewardsModalProps) {
  const [rewardsState, setRewardsState] = useState<RewardsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeUntil, setTimeUntil] = useState<{
    byThreshold: number | null;
    byTimer: number;
    estimatedTrigger: string;
  } | null>(null);

  // Fetch rewards state
  useEffect(() => {
    fetchRewardsState();
    const interval = setInterval(fetchRewardsState, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!rewardsState) return;

    const updateTimer = () => {
      const backupTimerMs = rewardsState.backupTimerDays * 24 * 60 * 60 * 1000;
      const timeRemaining = backupTimerMs - (Date.now() - rewardsState.cycleStartTime);
      const solNeeded = rewardsState.thresholdSol - rewardsState.pendingPoolSol;

      setTimeUntil({
        byThreshold: solNeeded > 0 ? solNeeded : null,
        byTimer: Math.max(0, timeRemaining),
        estimatedTrigger:
          rewardsState.pendingPoolSol >= rewardsState.thresholdSol
            ? "threshold"
            : timeRemaining <= 0 &&
                rewardsState.pendingPoolSol >= rewardsState.minimumDistributionSol
              ? "timer"
              : "pending",
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [rewardsState]);

  const fetchRewardsState = async () => {
    try {
      const response = await fetch("/api/ecosystem-stats");
      if (response.ok) {
        const data = await response.json();
        setRewardsState(data);
        setError(null);
      }
    } catch (err) {
      console.error("Error fetching rewards state:", err);
      setError("Unable to load rewards data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatTime = (ms: number): string => {
    if (ms <= 0) return "Ready";
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const shortenAddress = (address: string): string => {
    if (!address) return "...";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-2 border-bags-gold rounded-lg max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-amber-500 p-3 sm:p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black/20 border border-yellow-300/50 rounded flex items-center justify-center flex-shrink-0">
              <span className="font-pixel text-white text-sm sm:text-base">*</span>
            </div>
            <div>
              <h2 className="font-pixel text-white text-xs sm:text-sm">CREATOR REWARDS HUB</h2>
              <p className="font-pixel text-yellow-200 text-[7px] sm:text-[8px]">
                Top creators earn from ecosystem fees
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs text-white hover:text-yellow-200 p-2 touch-target border border-yellow-300/30 hover:border-yellow-300/60 rounded"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="font-pixel text-gray-400 text-xs animate-pulse">
                Loading rewards data...
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-500/50 rounded p-3">
              <p className="font-pixel text-red-400 text-[10px]">{error}</p>
            </div>
          ) : rewardsState ? (
            <>
              {/* Pool Status */}
              <div className="bg-bags-darker rounded-lg p-4 border border-bags-gold/30">
                <h3 className="font-pixel text-bags-gold text-xs mb-3">Rewards Pool</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/30 rounded p-3 text-center">
                    <div className="font-pixel text-2xl text-bags-green">
                      {rewardsState.pendingPoolSol.toFixed(2)}
                    </div>
                    <div className="font-pixel text-gray-500 text-[8px]">SOL in Pool</div>
                  </div>
                  <div className="bg-black/30 rounded p-3 text-center">
                    <div className="font-pixel text-2xl text-bags-gold">
                      {rewardsState.thresholdSol}
                    </div>
                    <div className="font-pixel text-gray-500 text-[8px]">SOL Threshold</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[8px] font-pixel text-gray-400 mb-1">
                    <span>Progress to Threshold</span>
                    <span>
                      {Math.min(
                        100,
                        (rewardsState.pendingPoolSol / rewardsState.thresholdSol) * 100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-bags-green to-bags-gold transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (rewardsState.pendingPoolSol / rewardsState.thresholdSol) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Time Until Distribution */}
              {timeUntil && (
                <div className="bg-bags-darker rounded-lg p-4 border border-blue-500/30">
                  <h3 className="font-pixel text-blue-400 text-xs mb-3">Next Distribution</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/30 rounded p-3">
                      <div className="font-pixel text-gray-400 text-[8px] mb-1">By Threshold</div>
                      <div className="font-pixel text-sm text-white">
                        {timeUntil.byThreshold !== null
                          ? `${timeUntil.byThreshold.toFixed(2)} SOL needed`
                          : "Ready!"}
                      </div>
                    </div>
                    <div className="bg-black/30 rounded p-3">
                      <div className="font-pixel text-gray-400 text-[8px] mb-1">By Timer</div>
                      <div className="font-pixel text-sm text-white">
                        {formatTime(timeUntil.byTimer)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <span
                      className={`font-pixel text-[10px] px-2 py-1 rounded ${
                        timeUntil.estimatedTrigger === "threshold"
                          ? "bg-green-900/50 text-green-400"
                          : timeUntil.estimatedTrigger === "timer"
                            ? "bg-blue-900/50 text-blue-400"
                            : "bg-gray-900/50 text-gray-400"
                      }`}
                    >
                      {timeUntil.estimatedTrigger === "threshold"
                        ? "Will trigger by threshold"
                        : timeUntil.estimatedTrigger === "timer"
                          ? "Will trigger by timer"
                          : "Accumulating..."}
                    </span>
                  </div>
                </div>
              )}

              {/* Distribution Split */}
              <div className="bg-bags-darker rounded-lg p-4 border border-purple-500/30">
                <h3 className="font-pixel text-purple-400 text-xs mb-3">Reward Split</h3>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl">💎</div>
                    <div className="font-pixel text-bags-gold text-lg">
                      {rewardsState.distribution.first}%
                    </div>
                    <div className="font-pixel text-gray-500 text-[8px]">1st Place</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl">✨</div>
                    <div className="font-pixel text-gray-300 text-lg">
                      {rewardsState.distribution.second}%
                    </div>
                    <div className="font-pixel text-gray-500 text-[8px]">2nd Place</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl">⚡</div>
                    <div className="font-pixel text-amber-600 text-lg">
                      {rewardsState.distribution.third}%
                    </div>
                    <div className="font-pixel text-gray-500 text-[8px]">3rd Place</div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bags-darker rounded p-3 text-center border border-gray-700">
                  <div className="font-pixel text-bags-green text-lg">
                    {rewardsState.totalDistributed.toFixed(2)}
                  </div>
                  <div className="font-pixel text-gray-500 text-[8px]">Total SOL Distributed</div>
                </div>
                <div className="bg-bags-darker rounded p-3 text-center border border-gray-700">
                  <div className="font-pixel text-bags-green text-lg">
                    {rewardsState.distributionCount}
                  </div>
                  <div className="font-pixel text-gray-500 text-[8px]">Distributions</div>
                </div>
              </div>

              {/* Top Creators */}
              {rewardsState.topCreators && rewardsState.topCreators.length > 0 && (
                <div className="bg-bags-darker rounded-lg p-4 border border-green-500/30">
                  <h3 className="font-pixel text-green-400 text-xs mb-3">Current Top Creators</h3>
                  <div className="space-y-2">
                    {rewardsState.topCreators.map((creator, i) => (
                      <div
                        key={i}
                        className="bg-black/30 rounded p-2 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{i === 0 ? "💎" : i === 1 ? "✨" : "⚡"}</span>
                          <div>
                            <div className="font-pixel text-white text-[10px]">
                              {creator.tokenSymbol || shortenAddress(creator.wallet)}
                            </div>
                            <div className="font-pixel text-gray-500 text-[8px]">
                              {shortenAddress(creator.wallet)}
                            </div>
                          </div>
                        </div>
                        <div className="font-pixel text-bags-green text-[10px]">
                          {creator.feesGenerated.toFixed(4)} SOL
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Distributions */}
              {rewardsState.recentDistributions && rewardsState.recentDistributions.length > 0 && (
                <div className="bg-bags-darker rounded-lg p-4 border border-gray-700">
                  <h3 className="font-pixel text-white text-xs mb-3">Recent Distributions</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {rewardsState.recentDistributions.slice(0, 3).map((dist, i) => (
                      <div key={i} className="bg-black/30 rounded p-2">
                        <div className="flex justify-between items-center">
                          <span className="font-pixel text-gray-400 text-[8px]">
                            {formatDate(dist.timestamp)}
                          </span>
                          <span className="font-pixel text-bags-green text-[10px]">
                            {dist.totalDistributed.toFixed(4)} SOL
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dist.recipients.map((r, j) => (
                            <span
                              key={j}
                              className="font-pixel text-[7px] bg-bags-dark px-1 py-0.5 rounded text-gray-300"
                            >
                              #{r.rank}: {r.tokenSymbol || shortenAddress(r.wallet)} (
                              {r.amount.toFixed(3)})
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* How It Works */}
              <div className="border border-gray-700 rounded-lg p-3">
                <h3 className="font-pixel text-white text-xs mb-2">How It Works</h3>
                <ul className="space-y-1">
                  <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                    <span className="text-bags-gold">1.</span>
                    <span>1% of all Bags.fm trading fees flow to this rewards pool</span>
                  </li>
                  <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                    <span className="text-bags-gold">2.</span>
                    <span>
                      Distributes when pool reaches {rewardsState.thresholdSol} SOL or after{" "}
                      {rewardsState.backupTimerDays} days (min {rewardsState.minimumDistributionSol}{" "}
                      SOL)
                    </span>
                  </li>
                  <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                    <span className="text-bags-gold">3.</span>
                    <span>Top 3 creators ranked by fee contribution get rewarded</span>
                  </li>
                  <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                    <span className="text-bags-gold">4.</span>
                    <span>Launch tokens, drive volume, climb the leaderboard!</span>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="font-pixel text-gray-400 text-xs">No rewards data available</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
