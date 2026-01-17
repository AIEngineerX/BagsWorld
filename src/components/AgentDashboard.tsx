"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface AgentStatus {
  wallet: {
    configured: boolean;
    publicKey: string | null;
    balance: number;
  };
  agent: {
    isRunning: boolean;
    lastCheck: number;
    lastClaim: number;
    totalClaimed: number;
    claimCount: number;
    config?: {
      minClaimThresholdSol: number;
      checkIntervalMs: number;
      maxClaimsPerRun: number;
    };
    errors?: string[];
    pendingPositions?: Array<{
      baseMint: string;
      claimableDisplayAmount: number;
    }>;
  };
}

interface ClaimResult {
  success: boolean;
  positionsClaimed: number;
  totalSolClaimed: number;
  signatures: string[];
  errors: string[];
}

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

export function AgentDashboard() {
  const { publicKey, connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [lastResult, setLastResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if current wallet is admin
  const isAdmin = connected && publicKey?.toBase58() === ADMIN_WALLET;

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/agent");
      if (!response.ok) {
        throw new Error("Failed to fetch agent status");
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch status when opened
  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchStatus();
      // Refresh every 30 seconds while open
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isAdmin, fetchStatus]);

  const handleTriggerClaim = async () => {
    try {
      setIsClaiming(true);
      setError(null);
      setLastResult(null);

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Claim failed");
      }

      setLastResult(data.result);
      // Refresh status
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setIsClaiming(false);
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
  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-50 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-pixel text-[10px] border-2 border-purple-400 shadow-lg"
        title="Agent Dashboard (Admin Only)"
      >
        🤖 AGENT
      </button>

      {/* Dashboard Panel */}
      {isOpen && (
        <div className="fixed bottom-16 left-4 z-50 w-80 bg-bags-dark border-4 border-purple-500 shadow-xl max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b-2 border-purple-500 bg-purple-900/30">
            <div>
              <h2 className="font-pixel text-sm text-purple-300">
                🤖 AUTO-CLAIM AGENT
              </h2>
              <p className="font-pixel text-[8px] text-gray-400">
                Admin Dashboard
              </p>
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
              <p className="font-pixel text-[10px] text-purple-300 animate-pulse">
                Loading...
              </p>
            ) : status ? (
              <>
                {/* Wallet Status */}
                <div className="bg-bags-darker p-2 border border-purple-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-1">
                    AGENT WALLET
                  </p>
                  {status.wallet.configured ? (
                    <>
                      <p className="font-pixel text-[10px] text-white font-mono">
                        {status.wallet.publicKey?.slice(0, 8)}...
                        {status.wallet.publicKey?.slice(-6)}
                      </p>
                      <p className="font-pixel text-[10px] text-bags-green">
                        Balance: {status.wallet.balance.toFixed(4)} SOL
                      </p>
                    </>
                  ) : (
                    <p className="font-pixel text-[10px] text-red-400">
                      ⚠️ Not configured
                    </p>
                  )}
                </div>

                {/* Agent Stats */}
                <div className="bg-bags-darker p-2 border border-purple-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-1">
                    STATISTICS
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-pixel text-[8px] text-gray-500">
                        Total Claimed
                      </p>
                      <p className="font-pixel text-[10px] text-bags-green">
                        {status.agent.totalClaimed.toFixed(4)} SOL
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[8px] text-gray-500">
                        Claim Count
                      </p>
                      <p className="font-pixel text-[10px] text-white">
                        {status.agent.claimCount}
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[8px] text-gray-500">
                        Last Check
                      </p>
                      <p className="font-pixel text-[10px] text-white">
                        {formatTimeAgo(status.agent.lastCheck)}
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[8px] text-gray-500">
                        Last Claim
                      </p>
                      <p className="font-pixel text-[10px] text-white">
                        {formatTimeAgo(status.agent.lastClaim)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Config */}
                {status.agent.config && (
                  <div className="bg-bags-darker p-2 border border-purple-500/30">
                    <p className="font-pixel text-[8px] text-gray-400 mb-1">
                      CONFIGURATION
                    </p>
                    <div className="space-y-1">
                      <p className="font-pixel text-[8px] text-gray-300">
                        Min Threshold:{" "}
                        <span className="text-white">
                          {status.agent.config.minClaimThresholdSol} SOL
                        </span>
                      </p>
                      <p className="font-pixel text-[8px] text-gray-300">
                        Check Interval:{" "}
                        <span className="text-white">
                          {status.agent.config.checkIntervalMs / 60000}m
                        </span>
                      </p>
                      <p className="font-pixel text-[8px] text-gray-300">
                        Max Claims/Run:{" "}
                        <span className="text-white">
                          {status.agent.config.maxClaimsPerRun}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Pending Positions */}
                {status.agent.pendingPositions &&
                  status.agent.pendingPositions.length > 0 && (
                    <div className="bg-bags-darker p-2 border border-bags-green/30">
                      <p className="font-pixel text-[8px] text-gray-400 mb-1">
                        CLAIMABLE POSITIONS ({status.agent.pendingPositions.length})
                      </p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {status.agent.pendingPositions.map((pos, i) => (
                          <div
                            key={i}
                            className="flex justify-between font-pixel text-[8px]"
                          >
                            <span className="text-gray-400">
                              {pos.baseMint.slice(0, 6)}...
                            </span>
                            <span className="text-bags-green">
                              {pos.claimableDisplayAmount.toFixed(4)} SOL
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Last Result */}
                {lastResult && (
                  <div
                    className={`p-2 border ${
                      lastResult.success
                        ? "bg-bags-green/10 border-bags-green/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <p className="font-pixel text-[8px] text-gray-400 mb-1">
                      LAST RESULT
                    </p>
                    {lastResult.success ? (
                      <>
                        <p className="font-pixel text-[10px] text-bags-green">
                          ✅ Claimed {lastResult.totalSolClaimed.toFixed(4)} SOL
                        </p>
                        <p className="font-pixel text-[8px] text-gray-400">
                          {lastResult.positionsClaimed} positions
                        </p>
                      </>
                    ) : (
                      <p className="font-pixel text-[10px] text-red-400">
                        ❌ {lastResult.errors[0] || "Failed"}
                      </p>
                    )}
                  </div>
                )}

                {/* Errors */}
                {status.agent.errors && status.agent.errors.length > 0 && (
                  <div className="bg-red-500/10 p-2 border border-red-500/30">
                    <p className="font-pixel text-[8px] text-red-400 mb-1">
                      RECENT ERRORS
                    </p>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {status.agent.errors.slice(-3).map((err, i) => (
                        <p key={i} className="font-pixel text-[7px] text-red-300">
                          {err}
                        </p>
                      ))}
                    </div>
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
              <p className="font-pixel text-[10px] text-gray-400">
                Failed to load status
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="p-3 border-t border-purple-500/30 space-y-2">
            <button
              onClick={handleTriggerClaim}
              disabled={isClaiming || !status?.wallet.configured}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-bags-green text-white font-pixel text-[10px] hover:from-purple-500 hover:to-bags-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isClaiming ? "🔄 CLAIMING..." : "⚡ TRIGGER CLAIM NOW"}
            </button>

            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="w-full py-1 bg-bags-darker border border-purple-500/30 text-purple-300 font-pixel text-[8px] hover:bg-purple-500/10 disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "🔄 Refresh Status"}
            </button>
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-purple-500/30 bg-bags-darker">
            <p className="font-pixel text-[7px] text-gray-500 text-center">
              Scheduled via GitHub Actions every 5 mins
            </p>
          </div>
        </div>
      )}
    </>
  );
}
