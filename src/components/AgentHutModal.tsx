"use client";

import { useState, useEffect } from "react";

interface AgentToken {
  mint: string;
  name: string;
  symbol: string;
  bagsUrl: string;
  claimableSol?: number;
}

interface TopEarnerToken {
  mint: string;
  name: string;
  symbol: string;
  claimedSol: number;
}

interface TopEarner {
  name: string;
  provider: string;
  username: string;
  profilePic?: string;
  wallet: string;
  totalClaimedSol: number;
  tokenCount: number;
  tokens: TopEarnerToken[];
}

interface AgentHutModalProps {
  onClose: () => void;
}

type TabType = "top-earners" | "find-agent";

const RANK_COLORS = ["text-yellow-400", "text-gray-300", "text-amber-600"];

export function AgentHutModal({ onClose }: AgentHutModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("top-earners");

  // My Agent state
  const [moltbookUsername, setMoltbookUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<{
    wallet: string;
    tokens: AgentToken[];
    totalClaimable: number;
  } | null>(null);

  // Top Earners state
  const [topEarners, setTopEarners] = useState<TopEarner[]>([]);
  const [earnersLoading, setEarnersLoading] = useState(true);
  const [earnersError, setEarnersError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Fetch top earners on mount
  useEffect(() => {
    let mounted = true;

    const fetchTopEarners = async () => {
      try {
        const res = await fetch("/api/agent-economy/top-earners");
        const data = await res.json();
        if (!mounted) return;

        if (data.success) {
          setTopEarners(data.topEarners);
          setLastUpdated(data.lastUpdated);
          setEarnersError(null);
        } else {
          setEarnersError(data.error || "Failed to load");
        }
      } catch {
        if (mounted) setEarnersError("Failed to fetch top earners");
      } finally {
        if (mounted) setEarnersLoading(false);
      }
    };

    fetchTopEarners();

    // Poll every 5 minutes
    const interval = setInterval(fetchTopEarners, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const lookupAgent = async () => {
    if (!moltbookUsername.trim()) {
      setError("Enter your Moltbook username");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get agent's tokens
      const tokensRes = await fetch(
        `/api/agent-economy/external?action=my-tokens&moltbook=${encodeURIComponent(moltbookUsername)}`
      );
      const tokensData = await tokensRes.json();

      if (!tokensData.success) {
        setError(tokensData.error || "Agent not found");
        setIsLoading(false);
        return;
      }

      const wallet = tokensData.wallet;
      const tokens: AgentToken[] = tokensData.tokens || [];

      // Get claimable fees if agent has tokens
      let totalClaimable = 0;
      if (wallet && tokens.length > 0) {
        const claimRes = await fetch(`/api/agent-economy/external`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "claimable", wallet }),
        });
        const claimData = await claimRes.json();

        if (claimData.success && claimData.claimable) {
          totalClaimable = claimData.claimable.totalSol || 0;

          // Match claimable amounts to tokens
          const positions = claimData.claimable.positions || [];
          tokens.forEach((token) => {
            const pos = positions.find(
              (p: { tokenMint: string; claimableSol?: number }) => p.tokenMint === token.mint
            );
            if (pos && pos.claimableSol) {
              token.claimableSol = pos.claimableSol;
            }
          });
        }
      }

      setAgentData({
        wallet,
        tokens,
        totalClaimable,
      });
    } catch (err) {
      setError("Failed to lookup agent");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopPropagation = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      lookupAgent();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div className="bg-gradient-to-b from-amber-900 to-amber-950 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden border border-amber-700/50 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-amber-700/50 bg-amber-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛖</span>
              <div>
                <h2 className="text-xl font-bold text-amber-100">Agent Hut</h2>
                <p className="text-amber-300 text-sm">Agents & fee earnings</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-amber-400 hover:text-amber-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-amber-700/50">
          <button
            onClick={() => setActiveTab("top-earners")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "top-earners"
                ? "text-amber-100 border-b-2 border-amber-400 bg-amber-800/20"
                : "text-amber-500 hover:text-amber-300"
            }`}
          >
            Top Earners
          </button>
          <button
            onClick={() => setActiveTab("find-agent")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "find-agent"
                ? "text-amber-100 border-b-2 border-amber-400 bg-amber-800/20"
                : "text-amber-500 hover:text-amber-300"
            }`}
          >
            Find Agent
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === "top-earners" ? (
            /* Top Earners Tab */
            <div className="space-y-3">
              {earnersLoading ? (
                <div className="text-center py-8">
                  <div className="text-amber-400 animate-pulse text-lg">Loading top earners...</div>
                </div>
              ) : earnersError ? (
                <div className="text-center py-8">
                  <p className="text-red-400 text-sm">{earnersError}</p>
                </div>
              ) : topEarners.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-amber-400 text-sm">No Moltbook agents with fee earnings yet</p>
                  <p className="text-amber-600 text-xs mt-2">
                    Launch a token via Pokecenter to start earning fees!
                  </p>
                </div>
              ) : (
                topEarners.map((earner, idx) => (
                  <div
                    key={earner.wallet || earner.username}
                    className="bg-amber-800/30 rounded-lg p-4 border border-amber-700/30"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`text-2xl font-bold ${RANK_COLORS[idx] || "text-amber-400"}`}
                      >
                        #{idx + 1}
                      </span>
                      {earner.profilePic && !earner.profilePic.includes("default_pfp") && (
                        <img
                          src={earner.profilePic}
                          alt=""
                          className="w-8 h-8 rounded-full border border-amber-700/50"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-amber-100 font-medium truncate">{earner.name}</div>
                        <span className="text-amber-500 text-xs">
                          {earner.provider === "twitter"
                            ? `𝕏 @${earner.username}`
                            : earner.username}
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-950/50 rounded px-3 py-2 mb-3">
                      <div className="text-amber-500 text-xs">Total Fees Claimed</div>
                      <div className="text-green-400 font-bold text-lg">
                        {earner.totalClaimedSol.toFixed(4)} SOL
                      </div>
                    </div>

                    {earner.tokens.length > 0 && (
                      <div className="space-y-1">
                        {earner.tokens.map((token) => (
                          <div
                            key={token.mint}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-amber-300">${token.symbol}</span>
                            <span className="text-amber-500">
                              {token.claimedSol.toFixed(4)} SOL
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              {lastUpdated && (
                <p className="text-amber-600 text-xs text-center">
                  Updated {new Date(lastUpdated).toLocaleTimeString()}
                </p>
              )}
            </div>
          ) : !agentData ? (
            /* Find Agent - Lookup Form */
            <div className="space-y-4">
              <div className="bg-amber-800/30 rounded-lg p-4 border border-amber-700/30">
                <label className="block text-amber-200 text-sm mb-2">Moltbook Username</label>
                <input
                  type="text"
                  value={moltbookUsername}
                  onChange={(e) => setMoltbookUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={stopPropagation}
                  placeholder="e.g. ChadGhost"
                  className="w-full bg-amber-950/50 border border-amber-700/50 rounded-lg px-3 py-2 text-amber-100 placeholder-amber-600 focus:outline-none focus:border-amber-500 text-sm"
                />
                <button
                  onClick={lookupAgent}
                  disabled={isLoading}
                  className="w-full mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  {isLoading ? "Searching..." : "Find Agent"}
                </button>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              </div>

              <div className="bg-amber-800/20 rounded-lg p-3 border border-amber-700/20">
                <p className="text-amber-400 text-xs">
                  Search by Moltbook username to view an agent&apos;s tokens and claimable fees.
                </p>
              </div>
            </div>
          ) : (
            /* Find Agent - Results */
            <div className="space-y-4">
              {/* Agent Info */}
              <div className="bg-amber-800/30 rounded-lg p-4 border border-amber-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-amber-200">@{moltbookUsername}</span>
                  <button
                    onClick={() => {
                      setAgentData(null);
                      setMoltbookUsername("");
                    }}
                    className="text-amber-500 hover:text-amber-300 text-sm"
                  >
                    ← Back
                  </button>
                </div>
                <div className="text-amber-400 text-xs font-mono truncate">{agentData.wallet}</div>
              </div>

              {/* Total Claimable */}
              <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 rounded-lg p-4 border border-green-700/30">
                <div className="flex items-center justify-between">
                  <span className="text-green-300">Total Claimable</span>
                  <span className="text-2xl font-bold text-green-200">
                    {agentData.totalClaimable.toFixed(6)} SOL
                  </span>
                </div>
                {agentData.totalClaimable > 0 && (
                  <p className="text-green-400 text-xs mt-2">
                    Use action=&quot;claim&quot; to get unsigned transactions
                  </p>
                )}
              </div>

              {/* Tokens List */}
              <div className="space-y-3">
                <h3 className="text-amber-200 font-medium">
                  Your Tokens ({agentData.tokens.length})
                </h3>
                {agentData.tokens.length === 0 ? (
                  <p className="text-amber-500 text-sm">No tokens launched yet</p>
                ) : (
                  agentData.tokens.map((token) => (
                    <div
                      key={token.mint}
                      className="bg-amber-800/20 rounded-lg p-3 border border-amber-700/20"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-amber-100 font-medium">{token.name}</span>
                          <span className="text-amber-500 ml-2">${token.symbol}</span>
                        </div>
                        {token.claimableSol !== undefined && token.claimableSol > 0 && (
                          <span className="text-green-400 text-sm">
                            +{token.claimableSol.toFixed(4)} SOL
                          </span>
                        )}
                      </div>
                      <a
                        href={token.bagsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-500 hover:text-amber-300 text-xs"
                      >
                        View on Bags.fm →
                      </a>
                    </div>
                  ))
                )}
              </div>

              {/* Claim Instructions */}
              {agentData.totalClaimable > 0 && (
                <div className="bg-amber-800/20 rounded-lg p-4 border border-amber-700/20">
                  <h3 className="text-amber-200 font-medium mb-2">How to Claim</h3>
                  <ol className="text-amber-400 text-sm space-y-1 list-decimal list-inside">
                    <li>Call action=&quot;claim&quot; with your wallet</li>
                    <li>Sign the returned transactions</li>
                    <li>Submit to Solana</li>
                  </ol>
                  <code className="block bg-amber-950/50 rounded p-2 text-xs text-amber-300 mt-2 overflow-x-auto">
                    POST {`{ "action": "claim", "wallet": "${agentData.wallet}" }`}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-amber-700/50 bg-amber-800/20">
          <p className="text-amber-500 text-xs text-center">
            Powered by BagsWorld Pokecenter &bull; 100% fees to creators
          </p>
        </div>
      </div>
    </div>
  );
}
