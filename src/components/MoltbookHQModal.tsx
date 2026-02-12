"use client";

import { useState, useEffect, useMemo } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface AgentEntry {
  wallet: string;
  name: string;
  description?: string;
  moltbookUsername?: string;
  zone: string;
  joinedAt: string;
  reputationScore: number;
  reputationTier: string;
  moltbookKarma: number;
  tokensLaunched: number;
  totalFeesEarnedSol: number;
  buildingHealth: number;
  buildingStatus: string;
}

interface TokenEntry {
  mint: string;
  name: string;
  symbol: string;
  creator_wallet: string;
  created_at?: string;
  lifetime_fees?: number;
  market_cap?: number;
  image_url?: string;
  fee_shares?: Array<{ provider: string; username: string; bps: number }>;
}

type TabType = "agents" | "launches" | "buildings";

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_STYLES: Record<string, string> = {
  bronze: "bg-amber-700/40 text-amber-300 border-amber-600/50",
  silver: "bg-gray-500/40 text-gray-200 border-gray-400/50",
  gold: "bg-yellow-500/40 text-yellow-200 border-yellow-400/50",
  diamond: "bg-cyan-400/40 text-cyan-200 border-cyan-300/50",
};

function getHealthColor(health: number): string {
  if (health > 75) return "bg-green-500";
  if (health > 50) return "bg-yellow-500";
  if (health > 25) return "bg-orange-500";
  return "bg-red-500";
}

function getStatusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case "active":
      return { label: "Active", color: "bg-green-500/30 text-green-300" };
    case "warning":
      return { label: "Warning", color: "bg-yellow-500/30 text-yellow-300" };
    case "critical":
      return { label: "Critical", color: "bg-orange-500/30 text-orange-300" };
    case "dormant":
      return { label: "Dormant", color: "bg-red-500/30 text-red-300" };
    default:
      return { label: status, color: "bg-gray-500/30 text-gray-300" };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatSol(val: number): string {
  if (val >= 1) return val.toFixed(2);
  return val.toFixed(4);
}

function formatMarketCap(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function AgentLinks({
  wallet,
  moltbookUsername,
}: {
  wallet: string;
  moltbookUsername?: string;
}) {
  return (
    <div className="flex items-center gap-3 mt-2">
      {moltbookUsername && (
        <a
          href={`https://moltbook.com/u/${moltbookUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-red-400/70 hover:text-red-200 underline"
        >
          Moltbook &#8599;
        </a>
      )}
      <a
        href={`https://solscan.io/account/${wallet}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-red-400/70 hover:text-red-200 underline"
      >
        Solscan &#8599;
      </a>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-red-800/30 rounded-lg p-3 border border-red-700/30 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-red-700/40" />
        <div className="flex-1">
          <div className="h-4 bg-red-700/40 rounded w-24 mb-1" />
          <div className="h-3 bg-red-700/30 rounded w-16" />
        </div>
      </div>
      <div className="h-3 bg-red-700/20 rounded w-full mt-2" />
    </div>
  );
}

// ============================================================================
// TABS
// ============================================================================

function AgentsTab({
  agents,
  loading,
  error,
}: {
  agents: AgentEntry[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-300 text-center py-8 text-sm">{error}</div>;
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-red-300/70 text-sm">No agents registered yet.</p>
        <p className="text-red-400/50 text-xs mt-1">
          Agents can register via the Agent Hut API
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const tierStyle =
          TIER_STYLES[agent.reputationTier] || "bg-gray-600/40 text-gray-300";
        return (
          <div
            key={agent.wallet}
            className="bg-red-800/30 border border-red-700/30 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-red-700/50 flex items-center justify-center text-xs font-bold text-red-200 shrink-0">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-red-100 text-sm truncate">
                    {agent.name}
                  </div>
                  {agent.moltbookUsername && (
                    <div className="text-red-400/70 text-xs truncate">
                      @{agent.moltbookUsername}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {agent.reputationTier !== "none" && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${tierStyle}`}
                  >
                    {agent.reputationTier}
                  </span>
                )}
                <span className="text-red-400/60 text-xs">
                  {timeAgo(agent.joinedAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-red-300/70 mb-2">
              <span className="bg-red-900/50 px-1.5 py-0.5 rounded">
                {agent.zone}
              </span>
              {agent.moltbookKarma > 0 && (
                <span>karma: {agent.moltbookKarma}</span>
              )}
              {agent.tokensLaunched > 0 && (
                <span>{agent.tokensLaunched} launches</span>
              )}
            </div>

            {agent.description && (
              <p className="text-red-300/60 text-xs line-clamp-2">
                {agent.description}
              </p>
            )}

            <AgentLinks
              wallet={agent.wallet}
              moltbookUsername={agent.moltbookUsername}
            />
          </div>
        );
      })}
    </div>
  );
}

function LaunchesTab({
  tokens,
  agentWallets,
  agentsByMoltbook,
  loading,
  error,
}: {
  tokens: TokenEntry[];
  agentWallets: Map<string, { name: string; moltbookUsername?: string }>;
  agentsByMoltbook: Map<string, { name: string; moltbookUsername?: string }>;
  loading: boolean;
  error: string | null;
}) {
  const agentTokens = useMemo(
    () =>
      tokens
        .filter((t) => {
          // Match by wallet address
          if (agentWallets.has(t.creator_wallet)) return true;
          // Match by Moltbook username in fee_shares
          if (t.fee_shares) {
            for (const fs of t.fee_shares) {
              if (
                fs.provider === "moltbook" &&
                agentsByMoltbook.has(fs.username.toLowerCase())
              ) {
                return true;
              }
            }
          }
          return false;
        })
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        ),
    [tokens, agentWallets, agentsByMoltbook]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-300 text-center py-8 text-sm">{error}</div>;
  }

  if (agentTokens.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-red-300/70 text-sm">
          No tokens launched by agents yet.
        </p>
        <p className="text-red-400/50 text-xs mt-1">
          Agents can launch tokens autonomously via the Agent Hut
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {agentTokens.map((token) => {
        // Resolve agent by wallet first, then by Moltbook username in fee_shares
        let agent = agentWallets.get(token.creator_wallet);
        if (!agent && token.fee_shares) {
          for (const fs of token.fee_shares) {
            if (fs.provider === "moltbook") {
              agent = agentsByMoltbook.get(fs.username.toLowerCase());
              if (agent) break;
            }
          }
        }
        return (
          <div
            key={token.mint}
            className="bg-red-800/30 border border-red-700/30 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="min-w-0">
                <span className="font-semibold text-red-100 text-sm truncate block">
                  {token.name}{" "}
                  <span className="text-red-300/70">(${token.symbol})</span>
                </span>
                <div className="text-xs text-red-400/60 mt-0.5">
                  Launched by{" "}
                  {agent?.moltbookUsername ? (
                    <a
                      href={`https://moltbook.com/u/${agent.moltbookUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-300/80 hover:text-red-200 underline"
                    >
                      {agent.name}
                    </a>
                  ) : (
                    <span className="text-red-300/80">{agent?.name}</span>
                  )}
                  {token.created_at && (
                    <span className="ml-1">
                      &middot; {timeAgo(token.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-red-300/70 mt-2">
              {token.lifetime_fees != null && token.lifetime_fees > 0 && (
                <span>{formatSol(token.lifetime_fees)} SOL fees</span>
              )}
              {token.market_cap != null && token.market_cap > 0 && (
                <span>{formatMarketCap(token.market_cap)} mcap</span>
              )}
            </div>

            <div className="mt-2">
              <a
                href={`https://bags.fm/${token.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-red-400/70 hover:text-red-200 underline"
              >
                View on Bags.fm &#8599;
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BuildingsTab({
  agents,
  loading,
  error,
}: {
  agents: AgentEntry[];
  loading: boolean;
  error: string | null;
}) {
  const sorted = useMemo(
    () => [...agents].sort((a, b) => b.buildingHealth - a.buildingHealth),
    [agents]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-300 text-center py-8 text-sm">{error}</div>;
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-red-300/70 text-sm">No agent buildings yet.</p>
        <p className="text-red-400/50 text-xs mt-1">
          Agents get buildings when they register
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((entry) => {
        const badge = getStatusBadge(entry.buildingStatus);
        return (
          <div
            key={entry.wallet}
            className="bg-red-800/30 border border-red-700/30 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <span className="font-semibold text-red-100 text-sm truncate block">
                  {entry.name}&apos;s HQ
                </span>
                <span className="text-red-400/60 text-xs">{entry.zone}</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}
              >
                {badge.label}
              </span>
            </div>
            {/* Health bar */}
            <div className="w-full bg-red-950/60 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full ${getHealthColor(entry.buildingHealth)} transition-all`}
                style={{
                  width: `${Math.max(entry.buildingHealth, 2)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-red-300/60">
              <span>Health: {entry.buildingHealth}%</span>
              <div className="flex items-center gap-3">
                {entry.totalFeesEarnedSol > 0 && (
                  <span>{entry.totalFeesEarnedSol.toFixed(4)} SOL fees</span>
                )}
                <span>Joined {timeAgo(entry.joinedAt)}</span>
              </div>
            </div>

            <AgentLinks
              wallet={entry.wallet}
              moltbookUsername={entry.moltbookUsername}
            />
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN MODAL
// ============================================================================

interface MoltbookHQModalProps {
  onClose: () => void;
}

export function MoltbookHQModal({ onClose }: MoltbookHQModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("agents");

  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map of agent wallet -> { name, moltbookUsername } for cross-referencing tokens
  const agentWallets = useMemo(
    () =>
      new Map(
        agents.map((a) => [
          a.wallet,
          { name: a.name, moltbookUsername: a.moltbookUsername },
        ])
      ),
    [agents]
  );

  // Reverse lookup: Moltbook username -> agent info (for matching fee_shares)
  const agentsByMoltbook = useMemo(
    () =>
      new Map(
        agents
          .filter((a) => a.moltbookUsername)
          .map((a) => [
            a.moltbookUsername!.toLowerCase(),
            { name: a.name, moltbookUsername: a.moltbookUsername },
          ])
      ),
    [agents]
  );

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Fetch agents + tokens in parallel
  useEffect(() => {
    Promise.all([
      fetch(
        "/api/agent-economy/external?action=agents&sort=newest&limit=50"
      ).then((r) => r.json()),
      fetch("/api/global-tokens").then((r) => r.json()),
    ])
      .then(([agentsData, tokensData]) => {
        if (agentsData.success) {
          setAgents(agentsData.agents || []);
          setAgentCount(agentsData.count || 0);
        } else {
          setError(agentsData.error || "Failed to load agents");
        }
        if (tokensData.tokens) {
          setTokens(tokensData.tokens);
        }
      })
      .catch(() => setError("Failed to connect"))
      .finally(() => setLoading(false));
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "agents", label: "Agents" },
    { key: "launches", label: "Launches" },
    { key: "buildings", label: "Buildings" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gradient-to-b from-red-900 to-red-950 rounded-xl border border-red-700/50 w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-red-700/50 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-red-100">MOLTBOOK HQ</h2>
              <p className="text-red-400/70 text-xs">
                Agent Dashboard
                {agentCount > 0 ? ` \u2022 ${agentCount} registered` : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-red-400 hover:text-red-200 text-xl leading-none px-1"
              aria-label="Close"
            >
              &#215;
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-red-400 text-red-100 bg-red-800/30"
                    : "border-transparent text-red-400/60 hover:text-red-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {activeTab === "agents" && (
            <AgentsTab agents={agents} loading={loading} error={error} />
          )}
          {activeTab === "launches" && (
            <LaunchesTab
              tokens={tokens}
              agentWallets={agentWallets}
              agentsByMoltbook={agentsByMoltbook}
              loading={loading}
              error={error}
            />
          )}
          {activeTab === "buildings" && (
            <BuildingsTab agents={agents} loading={loading} error={error} />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-red-700/50 flex items-center justify-between shrink-0">
          <a
            href="https://moltbook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400/70 hover:text-red-300 text-xs underline"
          >
            moltbook.com
          </a>
          <span className="text-red-500/40 text-xs">Powered by BagsWorld</span>
        </div>
      </div>
    </div>
  );
}
