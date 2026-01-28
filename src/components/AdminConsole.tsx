"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { getLaunchedTokens, removeLaunchedToken, type LaunchedToken } from "@/lib/token-registry";
import { BuildingEditor } from "./BuildingEditor";
import { AgentDashboard } from "./admin/AgentDashboard";
import bs58 from "bs58";

const SESSION_TOKEN_KEY = "bagsworld_admin_session";

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
  position_x?: number | null;
  position_y?: number | null;
  style_override?: number | null;
  health_override?: number | null;
  zone_override?: string | null;
}

type TabType = "overview" | "buildings" | "diagnostics" | "global" | "local" | "analytics" | "logs" | "agents";

export function AdminConsole() {
  const { publicKey, connected, signMessage } = useWallet();
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
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [positionInputs, setPositionInputs] = useState<{
    [mint: string]: { x: string; y: string };
  }>({});
  const [healthInputs, setHealthInputs] = useState<{ [mint: string]: string }>({});

  // Authentication state
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const authPromiseRef = useRef<{ resolve: (value: boolean) => void } | null>(null);

  // Use API-based admin check instead of client-side env vars
  const { isAdmin: isUserAdmin, isLoading: isAdminLoading } = useAdminCheck();

  // Load session token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_TOKEN_KEY);
    if (stored) {
      try {
        const { token, wallet, expiry } = JSON.parse(stored);
        // Check if token is for current wallet and not expired
        if (wallet === publicKey?.toBase58() && expiry > Date.now()) {
          setSessionToken(token);
        } else {
          localStorage.removeItem(SESSION_TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_TOKEN_KEY);
      }
    }
  }, [publicKey]);

  // Clear session when wallet changes
  useEffect(() => {
    if (!connected) {
      setSessionToken(null);
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }, [connected]);

  const addLog = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === "error" ? "[ERR]" : type === "success" ? "[OK]" : "[LOG]";
    setLogs((prev) => [`[${timestamp}] ${prefix} ${message}`, ...prev.slice(0, 99)]);
  }, []);

  // Authenticate with wallet signature - returns the token on success, null on failure
  const authenticate = useCallback(async (): Promise<string | null> => {
    if (!publicKey || !signMessage) {
      setAuthError("Wallet not connected or doesn't support signing");
      return null;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    setShowAuthModal(true);

    try {
      // 1. Request challenge from server
      addLog("Requesting authentication challenge...");
      const challengeRes = await fetch(`/api/admin/auth?wallet=${publicKey.toBase58()}`);

      if (!challengeRes.ok) {
        const err = await challengeRes.json();
        throw new Error(err.error || "Failed to get challenge");
      }

      const { challenge } = await challengeRes.json();
      addLog("Challenge received, please sign with your wallet");

      // 2. Sign the challenge with wallet
      const messageBytes = new TextEncoder().encode(challenge);
      const signature = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      addLog("Signature received, verifying...");

      // 3. Submit signature for verification
      const authRes = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          signature: signatureBase58,
          message: challenge,
        }),
      });

      if (!authRes.ok) {
        const err = await authRes.json();
        throw new Error(err.error || "Authentication failed");
      }

      const { sessionToken: token } = await authRes.json();

      // 4. Store session token (expires in 1 hour)
      const expiry = Date.now() + 55 * 60 * 1000; // 55 minutes (buffer before actual expiry)
      localStorage.setItem(
        SESSION_TOKEN_KEY,
        JSON.stringify({ token, wallet: publicKey.toBase58(), expiry })
      );
      setSessionToken(token);

      addLog("Authentication successful!", "success");
      setShowAuthModal(false);
      return token; // Return the actual token
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      setAuthError(message);
      addLog(`Authentication failed: ${message}`, "error");
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, [publicKey, signMessage, addLog]);

  // Authenticated fetch wrapper - ensures valid session token
  const adminFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Use current token or authenticate to get one
      let token = sessionToken;

      if (!token) {
        token = await authenticate();
        if (!token) {
          throw new Error("Authentication required");
        }
      }

      // Make the request with session token
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });

      // If unauthorized, try to re-authenticate once
      if (response.status === 401) {
        addLog("Session expired, re-authenticating...");
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setSessionToken(null);

        const newToken = await authenticate();
        if (!newToken) {
          throw new Error("Re-authentication failed");
        }

        // Retry with new token
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      }

      return response;
    },
    [sessionToken, authenticate, addLog]
  );

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
      const response = await adminFetch("/api/admin");

      if (response.ok) {
        const data = await response.json();
        setDiagnostics(data.diagnostics);
        setGlobalTokens(data.globalTokens || []);
        addLog("Admin data fetched", "success");
      } else {
        const err = await response.json();
        addLog(`Failed to fetch admin data: ${err.error || response.status}`, "error");
      }
    } catch (err) {
      addLog(`Admin fetch error: ${err}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, addLog, adminFetch]);

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
      const response = await adminFetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, data }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const msg = result.message || `Action "${action}" completed`;
        addLog(msg, "success");
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

  // Generic token update helper
  const updateToken = async (
    token: GlobalToken,
    action: string,
    data: Record<string, unknown>,
    updates: Partial<GlobalToken>,
    logMessage: string
  ) => {
    const success = await adminAction(action, { mint: token.mint, ...data });
    if (success) {
      setGlobalTokens((prev) =>
        prev.map((t) => (t.mint === token.mint ? { ...t, ...updates } : t))
      );
      addLog(logMessage, "success");
    }
    return success;
  };

  const handleSetLevelOverride = (token: GlobalToken, level: number | null) =>
    updateToken(
      token,
      "set_level_override",
      { level },
      { level_override: level },
      `Set level ${level ?? "auto"} for $${token.symbol}`
    );

  const handleSetPosition = (token: GlobalToken, x: number | null, y: number | null) =>
    updateToken(
      token,
      "set_position",
      { x, y },
      { position_x: x, position_y: y },
      `Set position ${x === null ? "auto" : `(${x}, ${y})`} for $${token.symbol}`
    );

  const handleSetStyle = (token: GlobalToken, style: number | null) =>
    updateToken(
      token,
      "set_style",
      { style },
      { style_override: style },
      `Set style ${style ?? "auto"} for $${token.symbol}`
    );

  const handleSetHealth = (token: GlobalToken, health: number | null) =>
    updateToken(
      token,
      "set_health",
      { health },
      { health_override: health },
      `Set health ${health ?? "auto"} for $${token.symbol}`
    );

  const getHealthStatus = (health: number | null | undefined): string => {
    if (health == null) return "auto";
    if (health <= 10) return "dormant";
    if (health <= 25) return "critical";
    if (health <= 50) return "warning";
    return "active";
  };

  const healthStatusColors: Record<string, string> = {
    active: "text-green-400",
    warning: "text-yellow-400",
    critical: "text-orange-400",
    dormant: "text-red-400",
  };

  const getHealthStatusColor = (status: string) => healthStatusColors[status] ?? "text-gray-400";

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

  const formatMarketCap = (mc: number | string | undefined | null) => {
    const num = Number(mc) || 0;
    if (num === 0) return "$0";
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
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

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="bg-bags-dark border-4 border-red-500 p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="font-pixel text-sm text-red-300 mb-4">ADMIN AUTHENTICATION</h3>

            {isAuthenticating ? (
              <div className="text-center py-8">
                <div className="animate-pulse mb-4">
                  <span className="font-pixel text-[10px] text-yellow-400">
                    {sessionToken ? "VERIFYING..." : "AWAITING WALLET SIGNATURE..."}
                  </span>
                </div>
                <p className="font-pixel text-[8px] text-gray-400">
                  Please sign the message in your wallet to authenticate as admin.
                </p>
              </div>
            ) : authError ? (
              <div className="py-4">
                <div className="bg-red-500/20 border border-red-500/50 p-3 mb-4">
                  <p className="font-pixel text-[9px] text-red-400">{authError}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => authenticate()}
                    className="flex-1 font-pixel text-[9px] text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 px-3 py-2 border border-yellow-500/30"
                  >
                    [RETRY]
                  </button>
                  <button
                    onClick={() => {
                      setShowAuthModal(false);
                      setAuthError(null);
                    }}
                    className="flex-1 font-pixel text-[9px] text-gray-400 hover:text-gray-300 px-3 py-2 border border-gray-600"
                  >
                    [CANCEL]
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4">
                <p className="font-pixel text-[8px] text-gray-400 mb-4">
                  You need to sign a message with your wallet to access admin features.
                </p>
                <button
                  onClick={() => authenticate()}
                  className="w-full font-pixel text-[9px] text-bags-green hover:text-green-300 bg-green-500/10 px-3 py-2 border border-green-500/30"
                >
                  [SIGN TO AUTHENTICATE]
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Console Panel */}
      {isOpen && (
        <div className="fixed inset-4 z-50 bg-bags-dark border-4 border-red-500 shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b-2 border-red-500 bg-red-900/30">
            <div>
              <h2 className="font-pixel text-sm text-red-300">[ADMIN] BAGSWORLD CONSOLE</h2>
              <div className="flex items-center gap-2">
                <p className="font-pixel text-[8px] text-gray-400">Site Management Dashboard</p>
                {sessionToken ? (
                  <span className="font-pixel text-[7px] text-green-400 bg-green-500/20 px-1">
                    AUTHENTICATED
                  </span>
                ) : (
                  <span className="font-pixel text-[7px] text-yellow-400 bg-yellow-500/20 px-1">
                    NOT SIGNED IN
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sessionToken && (
                <button
                  onClick={() => {
                    localStorage.removeItem(SESSION_TOKEN_KEY);
                    setSessionToken(null);
                    addLog("Logged out", "info");
                  }}
                  className="font-pixel text-[8px] text-gray-400 hover:text-red-300 px-2 py-1 border border-gray-600"
                >
                  [LOGOUT]
                </button>
              )}
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
            {(
              [
                "overview",
                "buildings",
                "diagnostics",
                "global",
                "local",
                "analytics",
                "logs",
                "agents",
              ] as TabType[]
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 py-2 font-pixel text-[9px] transition-colors relative ${
                  activeTab === tab
                    ? "bg-red-500/20 text-red-300 border-b-2 border-red-400"
                    : "text-gray-500 hover:text-gray-300 hover:bg-red-500/10"
                } ${tab === "agents" ? "text-bags-green" : ""}`}
              >
                {tab.toUpperCase()}
                {tab === "agents" && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-bags-green rounded-full animate-pulse" />
                )}
              </button>
            ))}
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
                      {Number(stats?.pendingPoolSol ?? 0).toFixed(4)} SOL
                    </p>
                  </div>
                  <div className="bg-bags-darker p-3 border border-red-500/30">
                    <p className="font-pixel text-[8px] text-gray-500">Total Distributed</p>
                    <p className="font-pixel text-lg text-bags-green">
                      {Number(stats?.totalDistributed ?? 0).toFixed(4)} SOL
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
                              {Number(creator.feesGenerated ?? 0).toFixed(4)} SOL
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

            {/* BUILDINGS TAB */}
            {activeTab === "buildings" && (
              <BuildingEditor
                tokens={globalTokens}
                sessionToken={sessionToken}
                onRefresh={fetchAdminData}
                addLog={addLog}
              />
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
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {globalTokens.map((token) => (
                        <div key={token.mint} className="bg-bags-darker border border-red-500/20">
                          <div className="p-3">
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
                                  <div className="flex items-center gap-2 flex-wrap">
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
                                    {(token.position_x != null ||
                                      token.style_override != null ||
                                      token.health_override != null) && (
                                      <span className="font-pixel text-[7px] text-cyan-400 bg-cyan-500/20 px-1">
                                        CUSTOM
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
                                      Fees: {Number(token.lifetime_fees ?? 0).toFixed(2)} SOL
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
                                  <button
                                    onClick={() =>
                                      setExpandedToken(
                                        expandedToken === token.mint ? null : token.mint
                                      )
                                    }
                                    className={`font-pixel text-[7px] px-1.5 py-0.5 border ${
                                      expandedToken === token.mint
                                        ? "text-cyan-400 border-cyan-500/50 bg-cyan-500/20"
                                        : "text-gray-500 border-gray-600 hover:text-cyan-400"
                                    }`}
                                    title="Building Controls"
                                  >
                                    {expandedToken === token.mint ? "^" : "v"}
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
                                    onClick={() =>
                                      handleDeleteGlobalToken(token.mint, token.symbol)
                                    }
                                    className="font-pixel text-[7px] text-red-400 hover:text-red-300 px-1"
                                  >
                                    [DEL]
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expandable Building Controls */}
                          {expandedToken === token.mint && (
                            <div className="border-t border-red-500/20 p-3 bg-black/30">
                              <p className="font-pixel text-[8px] text-cyan-400 mb-3">
                                BUILDING CONTROLS
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Position Controls */}
                                <div className="space-y-2">
                                  <p className="font-pixel text-[7px] text-gray-500">Position</p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className="font-pixel text-[7px] text-gray-500">
                                        X:
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="1280"
                                        value={
                                          positionInputs[token.mint]?.x ?? token.position_x ?? ""
                                        }
                                        onChange={(e) =>
                                          setPositionInputs((prev) => ({
                                            ...prev,
                                            [token.mint]: {
                                              ...prev[token.mint],
                                              x: e.target.value,
                                              y:
                                                prev[token.mint]?.y ??
                                                String(token.position_y ?? ""),
                                            },
                                          }))
                                        }
                                        placeholder="auto"
                                        className="w-16 bg-black/50 border border-gray-700 px-1 py-0.5 font-mono text-[8px] text-white"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="font-pixel text-[7px] text-gray-500">
                                        Y:
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="960"
                                        value={
                                          positionInputs[token.mint]?.y ?? token.position_y ?? ""
                                        }
                                        onChange={(e) =>
                                          setPositionInputs((prev) => ({
                                            ...prev,
                                            [token.mint]: {
                                              ...prev[token.mint],
                                              x:
                                                prev[token.mint]?.x ??
                                                String(token.position_x ?? ""),
                                              y: e.target.value,
                                            },
                                          }))
                                        }
                                        placeholder="auto"
                                        className="w-16 bg-black/50 border border-gray-700 px-1 py-0.5 font-mono text-[8px] text-white"
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        const x = positionInputs[token.mint]?.x;
                                        const y = positionInputs[token.mint]?.y;
                                        handleSetPosition(
                                          token,
                                          x ? parseFloat(x) : null,
                                          y ? parseFloat(y) : null
                                        );
                                      }}
                                      className="font-pixel text-[7px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 border border-cyan-500/30"
                                    >
                                      Set
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleSetPosition(token, null, null);
                                        setPositionInputs((prev) => {
                                          const { [token.mint]: _, ...rest } = prev;
                                          return rest;
                                        });
                                      }}
                                      className="font-pixel text-[7px] text-gray-400 hover:text-gray-300 px-2 py-0.5 border border-gray-600"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                  {token.position_x != null && (
                                    <p className="font-pixel text-[6px] text-gray-600">
                                      Current: ({token.position_x}, {token.position_y})
                                    </p>
                                  )}
                                </div>

                                {/* Style Controls */}
                                <div className="space-y-2">
                                  <p className="font-pixel text-[7px] text-gray-500">Style</p>
                                  <select
                                    value={token.style_override ?? "auto"}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleSetStyle(token, val === "auto" ? null : parseInt(val));
                                    }}
                                    className="bg-black/50 border border-gray-700 px-2 py-1 font-pixel text-[8px] text-white"
                                  >
                                    <option value="auto">Auto (from mint)</option>
                                    <option value="0">Style 0</option>
                                    <option value="1">Style 1</option>
                                    <option value="2">Style 2</option>
                                    <option value="3">Style 3</option>
                                  </select>
                                </div>

                                {/* Health Controls */}
                                <div className="space-y-2">
                                  <p className="font-pixel text-[7px] text-gray-500">Health</p>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={
                                        healthInputs[token.mint] ?? token.health_override ?? ""
                                      }
                                      onChange={(e) =>
                                        setHealthInputs((prev) => ({
                                          ...prev,
                                          [token.mint]: e.target.value,
                                        }))
                                      }
                                      placeholder="auto"
                                      className="w-16 bg-black/50 border border-gray-700 px-1 py-0.5 font-mono text-[8px] text-white"
                                    />
                                    <span className="font-pixel text-[7px] text-gray-500">
                                      / 100
                                    </span>
                                    <button
                                      onClick={() => {
                                        const health = healthInputs[token.mint];
                                        handleSetHealth(token, health ? parseInt(health) : null);
                                      }}
                                      className="font-pixel text-[7px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 border border-cyan-500/30"
                                    >
                                      Set
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleSetHealth(token, null);
                                        setHealthInputs((prev) => {
                                          const { [token.mint]: _, ...rest } = prev;
                                          return rest;
                                        });
                                      }}
                                      className="font-pixel text-[7px] text-gray-400 hover:text-gray-300 px-2 py-0.5 border border-gray-600"
                                    >
                                      Auto
                                    </button>
                                  </div>
                                </div>

                                {/* Status Indicator */}
                                <div className="space-y-2">
                                  <p className="font-pixel text-[7px] text-gray-500">Status</p>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        getHealthStatus(token.health_override) === "active"
                                          ? "bg-green-400"
                                          : getHealthStatus(token.health_override) === "warning"
                                            ? "bg-yellow-400"
                                            : getHealthStatus(token.health_override) === "critical"
                                              ? "bg-orange-400"
                                              : getHealthStatus(token.health_override) === "dormant"
                                                ? "bg-red-400"
                                                : "bg-gray-400"
                                      }`}
                                    />
                                    <span
                                      className={`font-pixel text-[8px] ${getHealthStatusColor(getHealthStatus(token.health_override))}`}
                                    >
                                      {getHealthStatus(token.health_override).toUpperCase()}
                                    </span>
                                    {token.health_override != null && (
                                      <span className="font-pixel text-[7px] text-gray-600">
                                        ({token.health_override}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
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
                        {Number(stats?.totalDistributed ?? 0).toFixed(4)} SOL
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
                              {Number(dist.totalDistributed ?? 0).toFixed(4)} SOL
                            </span>
                          </div>
                          <div className="space-y-1">
                            {dist.recipients.map((r, j) => (
                              <div key={j} className="flex justify-between items-center">
                                <span className="font-pixel text-[8px] text-gray-400">
                                  #{r.rank} ${r.tokenSymbol}
                                </span>
                                <span className="font-pixel text-[8px] text-bags-green">
                                  {Number(r.amount ?? 0).toFixed(4)} SOL
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
                          globalTokens.reduce((sum, t) => sum + Number(t.market_cap ?? 0), 0)
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-pixel text-[7px] text-gray-500">Total Lifetime Fees</p>
                      <p className="font-pixel text-sm text-bags-green">
                        {globalTokens
                          .reduce((sum, t) => sum + Number(t.lifetime_fees ?? 0), 0)
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
                {/* REWARDS CONFIG - DEPRECATED: Now funded by Ghost's 5% contribution */}
                <div className="bg-bags-darker p-3 border border-red-500/30">
                  <p className="font-pixel text-[8px] text-gray-400 mb-2">FUNDING MODEL</p>
                  <div className="grid grid-cols-2 gap-3 font-mono text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Source:</span>
                      <span className="text-white">Ghost&apos;s 5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Launch Fees:</span>
                      <span className="text-white">0% (free)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fee BPS:</span>
                      <span className="text-white">
                        {ECOSYSTEM_CONFIG.ecosystem.feeBps} (
                        {ECOSYSTEM_CONFIG.ecosystem.feeBps / 100}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className="text-green-400">Community Funded</span>
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

            {/* AGENTS TAB */}
            {activeTab === "agents" && (
              <AgentDashboard addLog={addLog} />
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
