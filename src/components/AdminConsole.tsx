"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { isAdmin, ECOSYSTEM_CONFIG } from "@/lib/config";
import { getLaunchedTokens, removeLaunchedToken, type LaunchedToken } from "@/lib/token-registry";

interface EcosystemStats {
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
    tokenSymbol: string;
    feesGenerated: number;
    rank: number;
  }>;
}

type TabType = "overview" | "buildings" | "config" | "logs";

export function AdminConsole() {
  const { publicKey, connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [stats, setStats] = useState<EcosystemStats | null>(null);
  const [buildings, setBuildings] = useState<LaunchedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const isUserAdmin = connected && isAdmin(publicKey?.toBase58());

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/ecosystem-stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        addLog("Stats refreshed");
      }
    } catch (err) {
      addLog(`Error fetching stats: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  const loadBuildings = useCallback(() => {
    const tokens = getLaunchedTokens();
    setBuildings(tokens);
    addLog(`Loaded ${tokens.length} buildings`);
  }, [addLog]);

  useEffect(() => {
    if (isOpen && isUserAdmin) {
      fetchStats();
      loadBuildings();
    }
  }, [isOpen, isUserAdmin, fetchStats, loadBuildings]);

  const handleRemoveBuilding = (mint: string, symbol: string) => {
    if (confirm(`Remove building $${symbol}?`)) {
      removeLaunchedToken(mint);
      setBuildings(prev => prev.filter(b => b.mint !== mint));
      window.dispatchEvent(new CustomEvent("bagsworld-token-update"));
      addLog(`Removed building: $${symbol}`);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const truncateWallet = (wallet: string) => {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  if (!isUserAdmin) {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 left-28 z-50 px-3 py-2 font-pixel text-[10px] border-2 shadow-lg transition-all ${
          isOpen
            ? "bg-red-700 border-red-300 text-white"
            : "bg-bags-dark border-red-500 text-red-300 hover:bg-red-900 hover:border-red-400 hover:text-red-200"
        }`}
        title="Admin Console"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-400" />
          ADMIN
        </span>
      </button>

      {/* Admin Console Panel */}
      {isOpen && (
        <div className="fixed inset-4 z-50 bg-bags-dark border-4 border-red-500 shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b-2 border-red-500 bg-red-900/30">
            <div>
              <h2 className="font-pixel text-sm text-red-300">
                [ADMIN] BAGSWORLD CONSOLE
              </h2>
              <p className="font-pixel text-[8px] text-gray-400">
                Ecosystem Management
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="font-pixel text-xs text-gray-400 hover:text-white px-2"
            >
              [X]
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-red-500/30">
            {(["overview", "buildings", "config", "logs"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 font-pixel text-[10px] transition-colors ${
                  activeTab === tab
                    ? "bg-red-500/20 text-red-300 border-b-2 border-red-400"
                    : "text-gray-500 hover:text-gray-300 hover:bg-red-500/10"
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Wallet Info */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">ADMIN WALLET</p>
                  <p className="font-pixel text-[10px] text-white font-mono">
                    {publicKey?.toBase58()}
                  </p>
                </div>

                {/* Ecosystem Stats */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-pixel text-[8px] text-gray-400">ECOSYSTEM STATS</p>
                    <button
                      onClick={fetchStats}
                      disabled={isLoading}
                      className="font-pixel text-[7px] text-red-400 hover:text-red-300"
                    >
                      {isLoading ? "[...]" : "[~] REFRESH"}
                    </button>
                  </div>
                  {stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="font-pixel text-[8px] text-gray-500">Reward Pool</p>
                        <p className="font-pixel text-sm text-bags-gold">{stats.pendingPoolSol.toFixed(4)} SOL</p>
                      </div>
                      <div>
                        <p className="font-pixel text-[8px] text-gray-500">Total Distributed</p>
                        <p className="font-pixel text-sm text-bags-green">{stats.totalDistributed.toFixed(4)} SOL</p>
                      </div>
                      <div>
                        <p className="font-pixel text-[8px] text-gray-500">Distributions</p>
                        <p className="font-pixel text-sm text-white">{stats.distributionCount}</p>
                      </div>
                      <div>
                        <p className="font-pixel text-[8px] text-gray-500">Last Distribution</p>
                        <p className="font-pixel text-sm text-white">{formatTimeAgo(stats.lastDistribution)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="font-pixel text-[10px] text-gray-500">Loading stats...</p>
                  )}
                </div>

                {/* Top Creators */}
                {stats?.topCreators && stats.topCreators.length > 0 && (
                  <div className="bg-bags-darker p-3 border border-bags-gold/30">
                    <p className="font-pixel text-[8px] text-gray-400 mb-2">TOP CREATORS</p>
                    <div className="space-y-2">
                      {stats.topCreators.slice(0, 5).map((creator, i) => (
                        <div key={creator.wallet} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className={`font-pixel text-[10px] ${
                              i === 0 ? "text-bags-gold" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"
                            }`}>
                              #{i + 1}
                            </span>
                            <span className="font-pixel text-[10px] text-white">${creator.tokenSymbol}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-pixel text-[8px] text-gray-500">{truncateWallet(creator.wallet)}</span>
                            <span className="font-pixel text-[10px] text-bags-green">{creator.feesGenerated.toFixed(4)} SOL</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Links */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">QUICK LINKS</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://solscan.io/account/${ECOSYSTEM_CONFIG.ecosystem.wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-pixel text-[8px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 border border-blue-500/30"
                    >
                      [Ecosystem Wallet]
                    </a>
                    <a
                      href="https://bags.fm"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-pixel text-[8px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 border border-blue-500/30"
                    >
                      [Bags.fm]
                    </a>
                    <a
                      href="https://docs.bags.fm"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-pixel text-[8px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 border border-blue-500/30"
                    >
                      [API Docs]
                    </a>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "buildings" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-pixel text-[10px] text-gray-400">
                    {buildings.length} buildings registered
                  </p>
                  <button
                    onClick={loadBuildings}
                    className="font-pixel text-[8px] text-red-400 hover:text-red-300"
                  >
                    [~] REFRESH
                  </button>
                </div>

                {buildings.length === 0 ? (
                  <p className="font-pixel text-[10px] text-gray-500 text-center py-8">
                    No buildings registered
                  </p>
                ) : (
                  <div className="space-y-2">
                    {buildings.map((building) => (
                      <div
                        key={building.mint}
                        className="bg-bags-darker p-3 border border-red-500/20 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {building.imageUrl && (
                            <img
                              src={building.imageUrl}
                              alt={building.symbol}
                              className="w-8 h-8 border border-bags-green/30"
                            />
                          )}
                          <div>
                            <p className="font-pixel text-[10px] text-bags-gold">${building.symbol}</p>
                            <p className="font-pixel text-[8px] text-gray-400">{building.name}</p>
                            <p className="font-pixel text-[7px] text-gray-600 font-mono">
                              {truncateWallet(building.mint)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://solscan.io/token/${building.mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-pixel text-[7px] text-blue-400 hover:text-blue-300"
                          >
                            [VIEW]
                          </a>
                          <button
                            onClick={() => handleRemoveBuilding(building.mint, building.symbol)}
                            className="font-pixel text-[7px] text-red-400 hover:text-red-300"
                          >
                            [DELETE]
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "config" && (
              <div className="space-y-4">
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">ECOSYSTEM CONFIG</p>
                  <div className="space-y-2 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ecosystem Wallet:</span>
                      <span className="text-white">{truncateWallet(ECOSYSTEM_CONFIG.ecosystem.wallet)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fee BPS:</span>
                      <span className="text-white">{ECOSYSTEM_CONFIG.ecosystem.feeBps} ({ECOSYSTEM_CONFIG.ecosystem.feeBps / 100}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Provider:</span>
                      <span className="text-white">{ECOSYSTEM_CONFIG.ecosystem.provider}/@{ECOSYSTEM_CONFIG.ecosystem.providerUsername}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">REWARDS CONFIG</p>
                  <div className="space-y-2 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Threshold:</span>
                      <span className="text-white">{ECOSYSTEM_CONFIG.ecosystem.rewards.thresholdSol} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Backup Timer:</span>
                      <span className="text-white">{ECOSYSTEM_CONFIG.ecosystem.rewards.backupTimerDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Min Distribution:</span>
                      <span className="text-white">{ECOSYSTEM_CONFIG.ecosystem.rewards.minimumDistributionSol} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Reserve %:</span>
                      <span className="text-white">{ECOSYSTEM_CONFIG.ecosystem.rewards.reservePercentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Distribution Split:</span>
                      <span className="text-white">
                        {ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.first}/
                        {ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.second}/
                        {ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.third}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">ADMIN WALLETS</p>
                  <div className="space-y-1">
                    {ECOSYSTEM_CONFIG.admin.wallets.map((wallet, i) => (
                      <p key={i} className="font-mono text-[9px] text-white">
                        {wallet}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-500/10 p-3 border border-yellow-500/30">
                  <p className="font-pixel text-[8px] text-yellow-400">
                    [!] Config changes require code deployment
                  </p>
                </div>
              </div>
            )}

            {activeTab === "logs" && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-pixel text-[10px] text-gray-400">
                    Session Logs ({logs.length})
                  </p>
                  <button
                    onClick={() => setLogs([])}
                    className="font-pixel text-[8px] text-red-400 hover:text-red-300"
                  >
                    [CLEAR]
                  </button>
                </div>
                <div className="bg-black/50 p-2 border border-gray-700 h-96 overflow-y-auto font-mono text-[9px]">
                  {logs.length === 0 ? (
                    <p className="text-gray-600">No logs yet...</p>
                  ) : (
                    logs.map((log, i) => (
                      <p key={i} className="text-gray-400">{log}</p>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-red-500/30 bg-bags-darker flex justify-between items-center">
            <p className="font-pixel text-[7px] text-gray-500">
              Admin: {truncateWallet(publicKey?.toBase58() || "")}
            </p>
            {error && (
              <p className="font-pixel text-[7px] text-red-400">{error}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
