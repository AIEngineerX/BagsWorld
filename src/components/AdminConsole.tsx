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
  recentDistributions?: Array<{
    timestamp: number;
    totalDistributed: number;
    recipients: Array<{
      wallet: string;
      tokenSymbol: string;
      amount: number;
      rank: number;
    }>;
  }>;
}

interface SystemDiagnostics {
  timestamp: number;
  environment: string;
  netlify: boolean;
  neonDb: {
    configured: boolean;
    status: string;
    tokenCount?: number;
    error?: string;
  };
  bagsApi: {
    configured: boolean;
    keyLength: number;
  };
  solanaRpc: {
    configured: boolean;
    url: string;
    status?: string;
  };
  anthropicApi: {
    configured: boolean;
  };
  memory?: {
    heapUsed: string;
    heapTotal: string;
  };
}

interface GlobalToken {
  id?: number;
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_url?: string;
  creator_wallet: string;
  created_at?: string;
  lifetime_fees?: number;
  market_cap?: number;
  volume_24h?: number;
  last_updated?: string;
  is_featured?: boolean;
  is_verified?: boolean;
  level_override?: number | null;
}

type TabType = "overview" | "diagnostics" | "global" | "local" | "analytics" | "logs";

export function AdminConsole() {
  const { publicKey, connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [stats, setStats] = useState<EcosystemStats | null>(null);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [globalTokens, setGlobalTokens] = useState<GlobalToken[]>([]);
  const [localBuildings, setLocalBuildings] = useState<LaunchedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [newTokenMint, setNewTokenMint] = useState("");
  const [editingToken, setEditingToken] = useState<GlobalToken | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | "auto">("auto");

  const isUserAdmin = connected && isAdmin(publicKey?.toBase58());

  const addLog = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === "error" ? "[ERR]" : type === "success" ? "[OK]" : "[LOG]";
    setLogs((prev) => [`[${timestamp}] ${prefix} ${message}`, ...prev.slice(0, 99)]);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/ecosystem-stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        addLog("Ecosystem stats refreshed", "success");
      }
    } catch (err) {
      addLog(`Error fetching stats: ${err}`, "error");
    }
  }, [addLog]);

  const fetchAdminData = useCallback(async () => {
    if (!publicKey) return;

    try {
      setIsLoading(true);
      const response = await fetch("/api/admin", {
        headers: {
          "x-admin-wallet": publicKey.toBase58(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDiagnostics(data.diagnostics);
        setGlobalTokens(data.globalTokens || []);
        addLog("Admin data fetched", "success");
      } else {
        addLog("Failed to fetch admin data", "error");
      }
    } catch (err) {
      addLog(`Admin fetch error: ${err}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, addLog]);

  const loadLocalBuildings = useCallback(() => {
    const tokens = getLaunchedTokens();
    setLocalBuildings(tokens);
    addLog(`Loaded ${tokens.length} local buildings`);
  }, [addLog]);

  useEffect(() => {
    if (isOpen && isUserAdmin) {
      fetchStats();
      fetchAdminData();
      loadLocalBuildings();
    }
  }, [isOpen, isUserAdmin, fetchStats, fetchAdminData, loadLocalBuildings]);

  // Admin actions
  const adminAction = async (action: string, data: any) => {
    if (!publicKey) return false;

    try {
      setIsLoading(true);
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-wallet": publicKey.toBase58(),
        },
        body: JSON.stringify({ action, data }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        addLog(`Action "${action}" completed`, "success");
        return true;
      } else {
        addLog(`Action "${action}" failed: ${result.error}`, "error");
        return false;
      }
    } catch (err) {
      addLog(`Action error: ${err}`, "error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLocalBuilding = (mint: string, symbol: string) => {
    if (confirm(`Remove local building $${symbol}?`)) {
      removeLaunchedToken(mint);
      setLocalBuildings((prev) => prev.filter((b) => b.mint !== mint));
      window.dispatchEvent(new CustomEvent("bagsworld-token-update"));
      addLog(`Removed local building: $${symbol}`, "success");
    }
  };

  const handleDeleteGlobalToken = async (mint: string, symbol: string) => {
    if (confirm(`Delete $${symbol} from GLOBAL database? This affects all users!`)) {
      const success = await adminAction("delete_token", { mint });
      if (success) {
        setGlobalTokens((prev) => prev.filter((t) => t.mint !== mint));
      }
    }
  };

  const handleToggleFeatured = async (token: GlobalToken) => {
    const success = await adminAction("set_featured", {
      mint: token.mint,
      featured: !token.is_featured,
    });
    if (success) {
      setGlobalTokens((prev) =>
        prev.map((t) => (t.mint === token.mint ? { ...t, is_featured: !t.is_featured } : t))
      );
    }
  };

  const handleToggleVerified = async (token: GlobalToken) => {
    const success = await adminAction("set_verified", {
      mint: token.mint,
      verified: !token.is_verified,
    });
    if (success) {
      setGlobalTokens((prev) =>
        prev.map((t) => (t.mint === token.mint ? { ...t, is_verified: !t.is_verified } : t))
      );
    }
  };

  const handleSetLevelOverride = async (token: GlobalToken, level: number | null) => {
    const success = await adminAction("set_level_override", {
      mint: token.mint,
      level,
    });
    if (success) {
      setGlobalTokens((prev) =>
        prev.map((t) => (t.mint === token.mint ? { ...t, level_override: level } : t))
      );
      addLog(`Set level ${level === null ? "auto" : level} for $${token.symbol}`, "success");
    }
  };

  const handleAddToken = async () => {
    if (!newTokenMint.trim()) return;

    const success = await adminAction("add_token", { mint: newTokenMint.trim() });
    if (success) {
      setNewTokenMint("");
      await fetchAdminData(); // Refresh list
    }
  };

  const handleClearCache = async () => {
    await adminAction("clear_cache", {});
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
    if (!wallet) return "???";
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const formatMarketCap = (mc: number | undefined) => {
    if (!mc) return "$0";
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
    return `$${mc.toFixed(0)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
      case "healthy":
        return "text-bags-green";
      case "degraded":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
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
              <h2 className="font-pixel text-sm text-red-300">[ADMIN] BAGSWORLD CONSOLE</h2>
              <p className="font-pixel text-[8px] text-gray-400">Site Management Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchStats();
                  fetchAdminData();
                  loadLocalBuildings();
                }}
                disabled={isLoading}
                className="font-pixel text-[8px] text-red-400 hover:text-red-300 px-2 py-1 border border-red-500/30"
              >
                {isLoading ? "[...]" : "[REFRESH ALL]"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="font-pixel text-xs text-gray-400 hover:text-white px-2"
              >
                [X]
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-red-500/30 overflow-x-auto">
            {(["overview", "diagnostics", "global", "local", "analytics", "logs"] as TabType[]).map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-shrink-0 px-4 py-2 font-pixel text-[9px] transition-colors ${
                    activeTab === tab
                      ? "bg-red-500/20 text-red-300 border-b-2 border-red-400"
                      : "text-gray-500 hover:text-gray-300 hover:bg-red-500/10"
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              )
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-bags-darker p-3 border border-red-500/30">
                    <p className="font-pixel text-[8px] text-gray-500">Reward Pool</p>
                    <p className="font-pixel text-lg text-bags-gold">
                      {stats?.pendingPoolSol.toFixed(4) || "0"} SOL
                    </p>
                  </div>
                  <div className="bg-bags-darker p-3 border border-red-500/30">
                    <p className="font-pixel text-[8px] text-gray-500">Total Distributed</p>
                    <p className="font-pixel text-lg text-bags-green">
                      {stats?.totalDistributed.toFixed(4) || "0"} SOL
                    </p>
                  </div>
                  <div className="bg-bags-darker p-3 border border-red-500/30">
                    <p className="font-pixel text-[8px] text-gray-500">Global Tokens</p>
                    <p className="font-pixel text-lg text-white">{globalTokens.length}</p>
                  </div>
                  <div className="bg-bags-darker p-3 border border-red-500/30">
                    <p className="font-pixel text-[8px] text-gray-500">Local Tokens</p>
                    <p className="font-pixel text-lg text-white">{localBuildings.length}</p>
                  </div>
                </div>

                {/* System Status Summary */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">SYSTEM STATUS</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${diagnostics?.neonDb.status === "connected" ? "bg-green-400" : "bg-red-400"}`}
                      />
                      <span className="font-pixel text-[9px] text-gray-300">Neon DB</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${diagnostics?.bagsApi.configured ? "bg-green-400" : "bg-red-400"}`}
                      />
                      <span className="font-pixel text-[9px] text-gray-300">Bags API</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${diagnostics?.solanaRpc.status === "healthy" ? "bg-green-400" : diagnostics?.solanaRpc.configured ? "bg-yellow-400" : "bg-red-400"}`}
                      />
                      <span className="font-pixel text-[9px] text-gray-300">Solana RPC</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${diagnostics?.anthropicApi.configured ? "bg-green-400" : "bg-yellow-400"}`}
                      />
                      <span className="font-pixel text-[9px] text-gray-300">AI Chat</span>
                    </div>
                  </div>
                </div>

                {/* Top Creators */}
                {stats?.topCreators && stats.topCreators.length > 0 && (
                  <div className="bg-bags-darker p-3 border border-bags-gold/30">
                    <p className="font-pixel text-[8px] text-gray-400 mb-2">TOP CREATORS</p>
                    <div className="space-y-2">
                      {stats.topCreators.slice(0, 5).map((creator, i) => (
                        <div key={creator.wallet} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-pixel text-[10px] ${
                                i === 0
                                  ? "text-bags-gold"
                                  : i === 1
                                    ? "text-gray-300"
                                    : i === 2
                                      ? "text-amber-600"
                                      : "text-gray-500"
                              }`}
                            >
                              #{i + 1}
                            </span>
                            <span className="font-pixel text-[10px] text-white">
                              ${creator.tokenSymbol}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-pixel text-[8px] text-gray-500">
                              {truncateWallet(creator.wallet)}
                            </span>
                            <span className="font-pixel text-[10px] text-bags-green">
                              {creator.feesGenerated.toFixed(4)} SOL
                            </span>
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
                      href="https://app.netlify.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-pixel text-[8px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 border border-blue-500/30"
                    >
                      [Netlify Dashboard]
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* DIAGNOSTICS TAB */}
            {activeTab === "diagnostics" && (
              <div className="space-y-4">
                {/* Environment */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">ENVIRONMENT</p>
                  <div className="grid grid-cols-2 gap-3 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mode:</span>
                      <span className="text-white">{diagnostics?.environment || "unknown"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Netlify:</span>
                      <span className={diagnostics?.netlify ? "text-green-400" : "text-gray-400"}>
                        {diagnostics?.netlify ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Database Status */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">NEON DATABASE</p>
                  <div className="space-y-2 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Configured:</span>
                      <span
                        className={
                          diagnostics?.neonDb.configured ? "text-green-400" : "text-red-400"
                        }
                      >
                        {diagnostics?.neonDb.configured ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className={getStatusColor(diagnostics?.neonDb.status || "")}>
                        {diagnostics?.neonDb.status || "unknown"}
                      </span>
                    </div>
                    {diagnostics?.neonDb.tokenCount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Token Count:</span>
                        <span className="text-white">{diagnostics.neonDb.tokenCount}</span>
                      </div>
                    )}
                    {diagnostics?.neonDb.error && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[8px]">
                        {diagnostics.neonDb.error}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bags API Status */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">BAGS API</p>
                  <div className="space-y-2 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Configured:</span>
                      <span
                        className={
                          diagnostics?.bagsApi.configured ? "text-green-400" : "text-red-400"
                        }
                      >
                        {diagnostics?.bagsApi.configured ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Key Length:</span>
                      <span className="text-white">
                        {diagnostics?.bagsApi.keyLength || 0} chars
                      </span>
                    </div>
                  </div>
                </div>

                {/* Solana RPC Status */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">SOLANA RPC</p>
                  <div className="space-y-2 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Configured:</span>
                      <span
                        className={
                          diagnostics?.solanaRpc.configured ? "text-green-400" : "text-red-400"
                        }
                      >
                        {diagnostics?.solanaRpc.configured ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">URL:</span>
                      <span className="text-white truncate max-w-[200px]">
                        {diagnostics?.solanaRpc.url}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Health:</span>
                      <span className={getStatusColor(diagnostics?.solanaRpc.status || "")}>
                        {diagnostics?.solanaRpc.status || "unknown"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Memory */}
                {diagnostics?.memory && (
                  <div className="bg-bags-darker p-3 border border-red-500/30">
                    <p className="font-pixel text-[8px] text-gray-400 mb-2">MEMORY USAGE</p>
                    <div className="space-y-2 font-mono text-[9px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Heap Used:</span>
                        <span className="text-white">{diagnostics.memory.heapUsed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Heap Total:</span>
                        <span className="text-white">{diagnostics.memory.heapTotal}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cache Actions */}
                <div className="bg-bags-darker p-3 border border-yellow-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">CACHE MANAGEMENT</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearCache}
                      disabled={isLoading}
                      className="font-pixel text-[8px] text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 px-3 py-1.5 border border-yellow-500/30"
                    >
                      [CLEAR ALL CACHES]
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* GLOBAL TOKENS TAB */}
            {activeTab === "global" && (
              <div className="space-y-4">
                {/* Add Token */}
                <div className="bg-bags-darker p-3 border border-bags-green/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">ADD TOKEN BY MINT</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTokenMint}
                      onChange={(e) => setNewTokenMint(e.target.value)}
                      placeholder="Enter token mint address..."
                      className="flex-1 bg-black/50 border border-gray-700 px-2 py-1 font-mono text-[10px] text-white placeholder-gray-600"
                    />
                    <button
                      onClick={handleAddToken}
                      disabled={isLoading || !newTokenMint.trim()}
                      className="font-pixel text-[8px] text-bags-green hover:text-green-300 bg-green-500/10 px-3 py-1 border border-green-500/30 disabled:opacity-50"
                    >
                      [ADD]
                    </button>
                  </div>
                </div>

                {/* Token List */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="font-pixel text-[10px] text-gray-400">
                      {globalTokens.length} tokens in global database
                    </p>
                  </div>

                  {globalTokens.length === 0 ? (
                    <p className="font-pixel text-[10px] text-gray-500 text-center py-8">
                      {diagnostics?.neonDb.configured
                        ? "No global tokens"
                        : "Database not configured (Netlify only)"}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {globalTokens.map((token) => (
                        <div
                          key={token.mint}
                          className="bg-bags-darker p-3 border border-red-500/20"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {token.image_url && (
                                <img
                                  src={token.image_url}
                                  alt={token.symbol}
                                  className="w-10 h-10 border border-bags-green/30 flex-shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-pixel text-[11px] text-bags-gold">
                                    ${token.symbol}
                                  </p>
                                  {token.is_featured && (
                                    <span className="font-pixel text-[7px] text-yellow-400 bg-yellow-500/20 px-1">
                                      FEATURED
                                    </span>
                                  )}
                                  {token.is_verified && (
                                    <span className="font-pixel text-[7px] text-blue-400 bg-blue-500/20 px-1">
                                      VERIFIED
                                    </span>
                                  )}
                                  {token.level_override && (
                                    <span className="font-pixel text-[7px] text-purple-400 bg-purple-500/20 px-1">
                                      LVL {token.level_override}
                                    </span>
                                  )}
                                </div>
                                <p className="font-pixel text-[8px] text-gray-400 truncate">
                                  {token.name}
                                </p>
                                <p className="font-pixel text-[7px] text-gray-600 font-mono truncate">
                                  {truncateWallet(token.mint)}
                                </p>
                                <div className="flex gap-3 mt-1">
                                  <span className="font-pixel text-[7px] text-gray-500">
                                    MC: {formatMarketCap(token.market_cap)}
                                  </span>
                                  <span className="font-pixel text-[7px] text-gray-500">
                                    Fees: {(token.lifetime_fees || 0).toFixed(2)} SOL
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 flex-shrink-0">
                              {/* Level Override */}
                              <select
                                value={token.level_override || "auto"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleSetLevelOverride(
                                    token,
                                    val === "auto" ? null : parseInt(val)
                                  );
                                }}
                                className="bg-black/50 border border-gray-700 px-1 py-0.5 font-pixel text-[8px] text-white"
                              >
                                <option value="auto">Auto</option>
                                <option value="1">Lvl 1</option>
                                <option value="2">Lvl 2</option>
                                <option value="3">Lvl 3</option>
                                <option value="4">Lvl 4</option>
                                <option value="5">Lvl 5</option>
                              </select>

                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleToggleFeatured(token)}
                                  className={`font-pixel text-[7px] px-1.5 py-0.5 border ${
                                    token.is_featured
                                      ? "text-yellow-400 border-yellow-500/50 bg-yellow-500/20"
                                      : "text-gray-500 border-gray-600 hover:text-yellow-400"
                                  }`}
                                  title="Toggle Featured"
                                >
                                  *
                                </button>
                                <button
                                  onClick={() => handleToggleVerified(token)}
                                  className={`font-pixel text-[7px] px-1.5 py-0.5 border ${
                                    token.is_verified
                                      ? "text-blue-400 border-blue-500/50 bg-blue-500/20"
                                      : "text-gray-500 border-gray-600 hover:text-blue-400"
                                  }`}
                                  title="Toggle Verified"
                                >
                                  V
                                </button>
                              </div>

                              <div className="flex gap-1">
                                <a
                                  href={`https://solscan.io/token/${token.mint}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-pixel text-[7px] text-blue-400 hover:text-blue-300 px-1"
                                >
                                  [VIEW]
                                </a>
                                <button
                                  onClick={() => handleDeleteGlobalToken(token.mint, token.symbol)}
                                  className="font-pixel text-[7px] text-red-400 hover:text-red-300 px-1"
                                >
                                  [DEL]
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LOCAL BUILDINGS TAB */}
            {activeTab === "local" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-pixel text-[10px] text-gray-400">
                    {localBuildings.length} buildings in localStorage
                  </p>
                  <button
                    onClick={loadLocalBuildings}
                    className="font-pixel text-[8px] text-red-400 hover:text-red-300"
                  >
                    [REFRESH]
                  </button>
                </div>

                {localBuildings.length === 0 ? (
                  <p className="font-pixel text-[10px] text-gray-500 text-center py-8">
                    No local buildings
                  </p>
                ) : (
                  <div className="space-y-2">
                    {localBuildings.map((building) => (
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
                            <p className="font-pixel text-[10px] text-bags-gold">
                              ${building.symbol}
                            </p>
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
                            onClick={() =>
                              handleRemoveLocalBuilding(building.mint, building.symbol)
                            }
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

            {/* ANALYTICS TAB */}
            {activeTab === "analytics" && (
              <div className="space-y-4">
                {/* Distribution History */}
                <div className="bg-bags-darker p-3 border border-bags-gold/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">DISTRIBUTION STATS</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="font-pixel text-[7px] text-gray-500">Total Distributed</p>
                      <p className="font-pixel text-lg text-bags-green">
                        {stats?.totalDistributed.toFixed(4) || "0"} SOL
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[7px] text-gray-500">Distribution Count</p>
                      <p className="font-pixel text-lg text-white">
                        {stats?.distributionCount || 0}
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[7px] text-gray-500">Last Distribution</p>
                      <p className="font-pixel text-sm text-white">
                        {formatTimeAgo(stats?.lastDistribution || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Distributions */}
                {stats?.recentDistributions && stats.recentDistributions.length > 0 && (
                  <div className="bg-bags-darker p-3 border border-red-500/30">
                    <p className="font-pixel text-[8px] text-gray-400 mb-2">RECENT DISTRIBUTIONS</p>
                    <div className="space-y-3">
                      {stats.recentDistributions.map((dist, i) => (
                        <div key={i} className="border-b border-gray-800 pb-2 last:border-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-pixel text-[8px] text-gray-500">
                              {new Date(dist.timestamp).toLocaleDateString()}
                            </span>
                            <span className="font-pixel text-[10px] text-bags-gold">
                              {dist.totalDistributed.toFixed(4)} SOL
                            </span>
                          </div>
                          <div className="space-y-1">
                            {dist.recipients.map((r, j) => (
                              <div key={j} className="flex justify-between items-center">
                                <span className="font-pixel text-[8px] text-gray-400">
                                  #{r.rank} ${r.tokenSymbol}
                                </span>
                                <span className="font-pixel text-[8px] text-bags-green">
                                  {r.amount.toFixed(4)} SOL
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Token Stats Summary */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">TOKEN SUMMARY</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="font-pixel text-[7px] text-gray-500">Total Market Cap</p>
                      <p className="font-pixel text-sm text-white">
                        {formatMarketCap(
                          globalTokens.reduce((sum, t) => sum + (t.market_cap || 0), 0)
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[7px] text-gray-500">Total Lifetime Fees</p>
                      <p className="font-pixel text-sm text-bags-green">
                        {globalTokens
                          .reduce((sum, t) => sum + (t.lifetime_fees || 0), 0)
                          .toFixed(2)}{" "}
                        SOL
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[7px] text-gray-500">Featured Tokens</p>
                      <p className="font-pixel text-sm text-yellow-400">
                        {globalTokens.filter((t) => t.is_featured).length}
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[7px] text-gray-500">Verified Tokens</p>
                      <p className="font-pixel text-sm text-blue-400">
                        {globalTokens.filter((t) => t.is_verified).length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Config Summary */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">REWARDS CONFIG</p>
                  <div className="grid grid-cols-2 gap-3 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Threshold:</span>
                      <span className="text-white">
                        {ECOSYSTEM_CONFIG.ecosystem.rewards.thresholdSol} SOL
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Backup Timer:</span>
                      <span className="text-white">
                        {ECOSYSTEM_CONFIG.ecosystem.rewards.backupTimerDays} days
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Distribution:</span>
                      <span className="text-white">
                        {ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.first}/
                        {ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.second}/
                        {ECOSYSTEM_CONFIG.ecosystem.rewards.distribution.third}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fee BPS:</span>
                      <span className="text-white">{ECOSYSTEM_CONFIG.ecosystem.feeBps} (1%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LOGS TAB */}
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
                      <p
                        key={i}
                        className={
                          log.includes("[ERR]")
                            ? "text-red-400"
                            : log.includes("[OK]")
                              ? "text-green-400"
                              : "text-gray-400"
                        }
                      >
                        {log}
                      </p>
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
            <p className="font-pixel text-[7px] text-gray-600">
              Last refresh: {diagnostics ? formatTimeAgo(diagnostics.timestamp) : "Never"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
