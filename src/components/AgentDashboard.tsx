"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { isAdmin } from "@/lib/config";

interface AgentStatus {
  authenticated: boolean;
  wallet: {
    configured: boolean;
    publicKey: string | null;
    balance: number;
  };
  creatorRewards: {
    isRunning: boolean;
    lastCheck: number;
    lastDistribution: number;
    totalDistributed: number;
    distributionCount: number;
    pendingPoolSol: number;
    topCreators: Array<{
      wallet: string;
      tokenSymbol: string;
      feesGenerated: number;
    }>;
    timeUntilDistribution: {
      thresholdMet: boolean;
      timerExpired: boolean;
      msUntilTimer: number;
    };
  };
  scout: {
    isRunning: boolean;
    isConnected: boolean;
    launchesScanned: number;
    alertsSent: number;
  };
}

interface TriggerResult {
  success: boolean;
  result?: {
    distributed: boolean;
    reason?: string;
    totalDistributed?: number;
    recipients?: Array<{
      wallet: string;
      amount: number;
    }>;
  };
}

export function AgentDashboard() {
  const { publicKey, connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastResult, setLastResult] = useState<TriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if current wallet is admin using the config helper
  const isUserAdmin = connected && isAdmin(publicKey?.toBase58());

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // If admin wallet connected, use admin-agent endpoint for full status
      if (isUserAdmin && publicKey) {
        const response = await fetch("/api/admin-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "status",
            walletAddress: publicKey.toBase58(),
          }),
        });
        const data = await response.json();
        if (response.ok) {
          setStatus(data);
          return;
        }
      }

      // Fallback to regular endpoint (returns minimal info without auth)
      const response = await fetch("/api/agent");
      const data = await response.json();

      // Handle unauthenticated response
      if (!data.authenticated) {
        // Create a minimal status from the unauthenticated response
        setStatus({
          authenticated: false,
          wallet: {
            configured: data.configured || false,
            publicKey: null,
            balance: 0,
          },
          creatorRewards: {
            isRunning: false,
            lastCheck: 0,
            lastDistribution: 0,
            totalDistributed: 0,
            distributionCount: 0,
            pendingPoolSol: 0,
            topCreators: [],
            timeUntilDistribution: {
              thresholdMet: false,
              timerExpired: false,
              msUntilTimer: 0,
            },
          },
          scout: {
            isRunning: false,
            isConnected: false,
            launchesScanned: 0,
            alertsSent: 0,
          },
        });
        return;
      }

      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setIsLoading(false);
    }
  }, [isUserAdmin, publicKey]);

  // Fetch status when opened
  useEffect(() => {
    if (isOpen && isUserAdmin) {
      fetchStatus();
      // Refresh every 30 seconds while open
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isUserAdmin, fetchStatus]);

  const handleTriggerDistribution = async () => {
    if (!isUserAdmin || !publicKey) {
      setError("Admin wallet required");
      return;
    }

    try {
      setIsTriggering(true);
      setError(null);
      setLastResult(null);

      // Use admin-agent endpoint with wallet auth
      const response = await fetch("/api/admin-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger",
          walletAddress: publicKey.toBase58(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Trigger failed");
      }

      setLastResult(data);
      // Refresh status
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setIsTriggering(false);
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Don't render anything if not admin
  if (!isUserAdmin) {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 left-4 z-50 px-3 py-2 font-pixel text-[10px] border-2 shadow-lg transition-all ${
          isOpen
            ? "bg-purple-700 border-purple-300 text-white"
            : "bg-bags-dark border-purple-500 text-purple-300 hover:bg-purple-900 hover:border-purple-400 hover:text-purple-200"
        }`}
        title="Creator Rewards Agent (Admin Only)"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${status?.creatorRewards?.isRunning ? "bg-bags-green animate-pulse" : "bg-purple-400"}`}
          />
          REWARDS
        </span>
      </button>

      {/* Dashboard Panel */}
      {isOpen && (
        <div className="fixed bottom-16 left-4 z-50 w-80 bg-bags-dark border-4 border-purple-500 shadow-xl max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b-2 border-purple-500 bg-purple-900/30">
            <div>
              <h2 className="font-pixel text-sm text-purple-300">[ADMIN] CREATOR REWARDS</h2>
              <p className="font-pixel text-[8px] text-gray-400">Distribution Agent Status</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="font-pixel text-xs text-gray-400 hover:text-white"
            >
              [X]
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-3">
            {isLoading && !status ? (
              <p className="font-pixel text-[10px] text-purple-300 animate-pulse">Loading...</p>
            ) : status ? (
              <>
                {/* Auth Status */}
                {!status.authenticated && (
                  <div className="bg-yellow-500/10 p-2 border border-yellow-500/30">
                    <p className="font-pixel text-[8px] text-yellow-400">
                      [!] Limited view - AGENT_SECRET not configured
                    </p>
                  </div>
                )}

                {/* Wallet Status */}
                <div className="bg-bags-darker p-2 border border-purple-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-1">AGENT WALLET</p>
                  {status.wallet.configured ? (
                    <>
                      {status.wallet.publicKey && (
                        <p className="font-pixel text-[10px] text-white font-mono">
                          {status.wallet.publicKey.slice(0, 8)}...
                          {status.wallet.publicKey.slice(-6)}
                        </p>
                      )}
                      <p className="font-pixel text-[10px] text-bags-green">
                        Balance: {status.wallet.balance.toFixed(4)} SOL
                      </p>
                    </>
                  ) : (
                    <p className="font-pixel text-[10px] text-red-400">[!] Not configured</p>
                  )}
                </div>

                {/* Rewards Stats */}
                <div className="bg-bags-darker p-2 border border-purple-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-1">REWARD POOL</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-pixel text-[8px] text-gray-500">Pending Pool</p>
                      <p className="font-pixel text-[10px] text-bags-gold">
                        {status.creatorRewards.pendingPoolSol.toFixed(4)} SOL
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[8px] text-gray-500">Total Distributed</p>
                      <p className="font-pixel text-[10px] text-bags-green">
                        {status.creatorRewards.totalDistributed.toFixed(4)} SOL
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[8px] text-gray-500">Distributions</p>
                      <p className="font-pixel text-[10px] text-white">
                        {status.creatorRewards.distributionCount}
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[8px] text-gray-500">Last Distribution</p>
                      <p className="font-pixel text-[10px] text-white">
                        {formatTimeAgo(status.creatorRewards.lastDistribution)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top Creators */}
                {status.creatorRewards.topCreators.length > 0 && (
                  <div className="bg-bags-darker p-2 border border-bags-gold/30">
                    <p className="font-pixel text-[8px] text-gray-400 mb-1">TOP 3 CREATORS</p>
                    <div className="space-y-1">
                      {status.creatorRewards.topCreators.map((creator, i) => (
                        <div key={i} className="flex justify-between font-pixel text-[8px]">
                          <span
                            className={
                              i === 0
                                ? "text-bags-gold"
                                : i === 1
                                  ? "text-gray-300"
                                  : "text-amber-600"
                            }
                          >
                            #{i + 1} ${creator.tokenSymbol}
                          </span>
                          <span className="text-bags-green">
                            {creator.feesGenerated.toFixed(4)} SOL
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Distribution Status */}
                <div className="bg-bags-darker p-2 border border-purple-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-1">NEXT DISTRIBUTION</p>
                  <div className="space-y-1">
                    <p className="font-pixel text-[8px] text-gray-300">
                      Threshold:{" "}
                      <span
                        className={
                          status.creatorRewards.timeUntilDistribution.thresholdMet
                            ? "text-bags-green"
                            : "text-white"
                        }
                      >
                        {status.creatorRewards.timeUntilDistribution.thresholdMet
                          ? "[MET]"
                          : "[NOT MET]"}
                      </span>
                    </p>
                    <p className="font-pixel text-[8px] text-gray-300">
                      Timer:{" "}
                      <span
                        className={
                          status.creatorRewards.timeUntilDistribution.timerExpired
                            ? "text-bags-green"
                            : "text-white"
                        }
                      >
                        {status.creatorRewards.timeUntilDistribution.timerExpired
                          ? "[READY]"
                          : `${Math.floor(status.creatorRewards.timeUntilDistribution.msUntilTimer / 3600000)}h remaining`}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Last Result */}
                {lastResult && (
                  <div
                    className={`p-2 border ${
                      lastResult.success
                        ? "bg-bags-green/10 border-bags-green/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <p className="font-pixel text-[8px] text-gray-400 mb-1">TRIGGER RESULT</p>
                    {lastResult.success && lastResult.result?.distributed ? (
                      <p className="font-pixel text-[10px] text-bags-green">
                        [OK] Distributed {lastResult.result.totalDistributed?.toFixed(4)} SOL
                      </p>
                    ) : lastResult.success ? (
                      <p className="font-pixel text-[10px] text-yellow-400">
                        [SKIP] {lastResult.result?.reason || "Not ready"}
                      </p>
                    ) : (
                      <p className="font-pixel text-[10px] text-red-400">[ERR] Trigger failed</p>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 p-2 border border-red-500/30">
                    <p className="font-pixel text-[10px] text-red-400">{error}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="font-pixel text-[10px] text-gray-400">Failed to load status</p>
            )}
          </div>

          {/* Actions */}
          <div className="p-3 border-t border-purple-500/30 space-y-2">
            <button
              onClick={handleTriggerDistribution}
              disabled={isTriggering || !status?.wallet.configured}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-bags-green text-white font-pixel text-[10px] hover:from-purple-500 hover:to-bags-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isTriggering ? "[...] CHECKING" : "[>] TRIGGER DISTRIBUTION"}
            </button>

            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="w-full py-1 bg-bags-darker border border-purple-500/30 text-purple-300 font-pixel text-[8px] hover:bg-purple-500/10 disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "[~] Refresh Status"}
            </button>
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-purple-500/30 bg-bags-darker">
            <p className="font-pixel text-[7px] text-gray-500 text-center">
              Distributes at 10 SOL threshold or 5 days
            </p>
          </div>
        </div>
      )}
    </>
  );
}
