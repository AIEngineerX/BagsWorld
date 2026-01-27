"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface RaffleStatus {
  id?: number;
  status: "active" | "paused" | "drawing" | "completed" | "none";
  potSol?: number;
  entryCount?: number;
  threshold?: number;
  winnerWallet?: string;
  prizeSol?: number;
  message?: string;
}

interface RaffleEntry {
  wallet: string;
  enteredAt: string;
}

interface RaffleHistoryItem {
  id: number;
  status: string;
  potSol: number;
  entryCount: number;
  threshold: number;
  winnerWallet: string | null;
  prizeSol: number | null;
  createdAt: string;
  drawnAt: string | null;
}

interface CasinoAdminProps {
  onClose: () => void;
}

type AdminTab = "current" | "entries" | "history";

export function CasinoAdmin({ onClose }: CasinoAdminProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { isAdmin } = useAdminCheck();

  const [raffle, setRaffle] = useState<RaffleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>("current");

  // Entries state
  const [entries, setEntries] = useState<RaffleEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  // History state
  const [history, setHistory] = useState<RaffleHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Form states
  const [potSol, setPotSol] = useState("1");
  const [thresholdEntries, setThresholdEntries] = useState("50");

  // Fetch current raffle status
  const fetchRaffle = useCallback(async () => {
    try {
      const res = await fetch(`/api/casino/raffle?includeCompleted=true`);
      const data = await res.json();
      setRaffle(data);
    } catch (err) {
      console.error("Error fetching raffle:", err);
    }
  }, []);

  useEffect(() => {
    fetchRaffle();
  }, [fetchRaffle]);

  // Fetch entries for current raffle
  const fetchEntries = useCallback(async () => {
    if (!publicKey || !raffle?.id) return;

    setIsLoadingEntries(true);
    try {
      const res = await fetch(
        `/api/casino/admin/entries?wallet=${publicKey.toString()}&raffleId=${raffle.id}`
      );
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error("Error fetching entries:", err);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [publicKey, raffle?.id]);

  // Fetch raffle history
  const fetchHistory = useCallback(async () => {
    if (!publicKey) return;

    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/casino/admin/history?wallet=${publicKey.toString()}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [publicKey]);

  // Fetch entries when tab changes to entries
  useEffect(() => {
    if (activeTab === "entries" && raffle?.id) {
      fetchEntries();
    }
  }, [activeTab, raffle?.id, fetchEntries]);

  // Fetch history when tab changes to history
  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Sign message helper
  const signAdminMessage = async (
    action: string
  ): Promise<{ signature: string; timestamp: number } | null> => {
    if (!signMessage || !publicKey) {
      setError("Wallet not connected or doesn't support signing");
      return null;
    }

    try {
      const timestamp = Date.now();
      const message = `casino-admin:${action}:${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");
      return { signature, timestamp };
    } catch (err) {
      console.error("Error signing message:", err);
      setError("Failed to sign message. Please try again.");
      return null;
    }
  };

  // Initialize casino tables
  const handleInit = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);

    const signed = await signAdminMessage("init");
    if (!signed) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/casino/admin/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          signature: signed.signature,
          timestamp: signed.timestamp,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage("Casino tables initialized successfully!");
      } else {
        setError(data.error || "Failed to initialize");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Create new raffle
  const handleCreateRaffle = async () => {
    if (!publicKey) return;

    const pot = parseFloat(potSol);
    const threshold = parseInt(thresholdEntries);

    if (isNaN(pot) || pot <= 0) {
      setError("Invalid pot amount");
      return;
    }

    if (isNaN(threshold) || threshold <= 0) {
      setError("Invalid threshold");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    const signed = await signAdminMessage("create-raffle");
    if (!signed) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/casino/admin/create-raffle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          signature: signed.signature,
          timestamp: signed.timestamp,
          potSol: pot,
          thresholdEntries: threshold,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`Raffle #${data.raffleId} created with ${pot} SOL pot!`);
        await fetchRaffle();
      } else {
        setError(data.error || "Failed to create raffle");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle raffle (pause/resume)
  const handleToggle = async (action: "pause" | "resume") => {
    if (!publicKey) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);

    const signed = await signAdminMessage(`toggle-${action}`);
    if (!signed) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/casino/admin/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          signature: signed.signature,
          timestamp: signed.timestamp,
          action,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`Raffle ${action === "pause" ? "paused" : "resumed"} successfully!`);
        await fetchRaffle();
      } else {
        setError(data.error || `Failed to ${action} raffle`);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Draw winner
  const handleDraw = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);

    const signed = await signAdminMessage("draw");
    if (!signed) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/casino/admin/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          signature: signed.signature,
          timestamp: signed.timestamp,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`Winner: ${data.winner}\nPrize: ${data.prize} SOL\nEntries: ${data.entryCount}`);
        await fetchRaffle();
      } else {
        setError(data.error || "Failed to draw");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Not connected
  if (!connected) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#0a0a0f] border border-red-500/50 rounded-2xl max-w-md w-full p-6">
          <h2 className="font-pixel text-xl text-red-400 mb-4">CASINO ADMIN</h2>
          <p className="text-gray-400 mb-4">Connect your admin wallet to continue.</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-pixel text-xs"
            >
              CLOSE
            </button>
            <button
              onClick={() => setWalletModalVisible(true)}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-pixel text-xs"
            >
              CONNECT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#0a0a0f] border border-red-500/50 rounded-2xl max-w-md w-full p-6">
          <h2 className="font-pixel text-xl text-red-400 mb-4">ACCESS DENIED</h2>
          <p className="text-gray-400 mb-2">Connected wallet is not admin.</p>
          <p className="text-gray-500 text-xs mb-4 break-all">
            Your wallet: {publicKey?.toString()}
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-pixel text-xs"
          >
            CLOSE
          </button>
        </div>
      </div>
    );
  }

  // Helper to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  // Helper to truncate wallet
  const truncateWallet = (wallet: string) => {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0a0a0f] border border-green-500/50 rounded-2xl max-w-lg w-full p-6 my-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-pixel text-xl text-green-400">CASINO ADMIN</h2>
            <p className="text-gray-500 text-xs mt-1">Manage raffles and draws</p>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs p-2 text-gray-400 hover:text-white border border-green-500/30 rounded"
          >
            [X]
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-800 pb-3">
          <button
            onClick={() => setActiveTab("current")}
            className={`px-4 py-2 rounded-lg font-pixel text-xs transition-colors ${
              activeTab === "current"
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            MANAGE
          </button>
          <button
            onClick={() => setActiveTab("entries")}
            className={`px-4 py-2 rounded-lg font-pixel text-xs transition-colors ${
              activeTab === "entries"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            ENTRIES {raffle?.entryCount ? `(${raffle.entryCount})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg font-pixel text-xs transition-colors ${
              activeTab === "history"
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            HISTORY
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
            <p className="text-green-400 text-sm whitespace-pre-line">{message}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* MANAGE TAB */}
          {activeTab === "current" && (
            <div className="space-y-4">
              {/* Current Raffle Status */}
              <div className="bg-black/30 border border-gray-700/30 rounded-lg p-4">
                <h3 className="font-pixel text-sm text-gray-400 mb-3">CURRENT RAFFLE</h3>
                {raffle?.status === "none" || !raffle?.id ? (
                  <p className="text-gray-500 text-sm">No active raffle</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ID:</span>
                      <span className="text-white">#{raffle.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span
                        className={
                          raffle.status === "active"
                            ? "text-green-400"
                            : raffle.status === "paused"
                              ? "text-yellow-400"
                              : raffle.status === "completed"
                                ? "text-blue-400"
                                : "text-purple-400"
                        }
                      >
                        {raffle.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pot:</span>
                      <span className="text-white">{raffle.potSol?.toFixed(2) || 0} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Entries:</span>
                      <span className="text-white">
                        {raffle.entryCount || 0} / {raffle.threshold || 50}
                      </span>
                    </div>
                    {raffle.winnerWallet && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Winner:</span>
                        <span className="text-yellow-400 font-mono text-xs">
                          {truncateWallet(raffle.winnerWallet)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={fetchRaffle}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    Refresh
                  </button>
                  {raffle && (raffle.status === "active" || raffle.status === "paused") && (
                    <>
                      <span className="text-gray-600">|</span>
                      {raffle.status === "active" ? (
                        <button
                          onClick={() => handleToggle("pause")}
                          disabled={isLoading}
                          className="text-yellow-400 hover:text-yellow-300 text-xs disabled:opacity-50"
                        >
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggle("resume")}
                          disabled={isLoading}
                          className="text-green-400 hover:text-green-300 text-xs disabled:opacity-50"
                        >
                          Resume
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Initialize */}
              <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-4">
                <h4 className="font-pixel text-xs text-gray-400 mb-2">1. INITIALIZE TABLES</h4>
                <p className="text-gray-500 text-xs mb-3">
                  First-time setup only. Creates database tables.
                </p>
                <button
                  onClick={handleInit}
                  disabled={isLoading}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded font-pixel text-xs"
                >
                  {isLoading ? "LOADING..." : "INITIALIZE"}
                </button>
              </div>

              {/* Create Raffle */}
              <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-4">
                <h4 className="font-pixel text-xs text-gray-400 mb-2">2. CREATE RAFFLE</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Pot (SOL)</label>
                    <input
                      type="number"
                      value={potSol}
                      onChange={(e) => setPotSol(e.target.value)}
                      className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                      min="0.01"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Draw Threshold</label>
                    <input
                      type="number"
                      value={thresholdEntries}
                      onChange={(e) => setThresholdEntries(e.target.value)}
                      className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                      min="1"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateRaffle}
                  disabled={isLoading || raffle?.status === "active" || raffle?.status === "paused"}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-pixel text-xs"
                >
                  {isLoading ? "CREATING..." : "CREATE RAFFLE"}
                </button>
                {(raffle?.status === "active" || raffle?.status === "paused") && (
                  <p className="text-yellow-400 text-xs mt-2">Draw current raffle first</p>
                )}
              </div>

              {/* Draw Winner */}
              <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-4">
                <h4 className="font-pixel text-xs text-gray-400 mb-2">3. DRAW WINNER</h4>
                <p className="text-gray-500 text-xs mb-3">
                  Draws winner using crypto-secure RNG. Can draw manually anytime.
                </p>
                <button
                  onClick={handleDraw}
                  disabled={
                    isLoading ||
                    (raffle?.status !== "active" && raffle?.status !== "paused") ||
                    !raffle?.entryCount
                  }
                  className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded font-pixel text-xs"
                >
                  {isLoading ? "DRAWING..." : "DRAW WINNER"}
                </button>
                {raffle?.status !== "active" && raffle?.status !== "paused" && (
                  <p className="text-gray-500 text-xs mt-2">No active raffle to draw</p>
                )}
                {(raffle?.status === "active" || raffle?.status === "paused") &&
                  !raffle?.entryCount && (
                    <p className="text-yellow-400 text-xs mt-2">No entries yet</p>
                  )}
              </div>

              {/* Footer note */}
              <div className="pt-4 border-t border-gray-800">
                <p className="text-gray-500 text-xs">
                  After drawing, manually send {raffle?.potSol || "the prize"} SOL to the winner.
                </p>
              </div>
            </div>
          )}

          {/* ENTRIES TAB */}
          {activeTab === "entries" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-pixel text-sm text-blue-400">
                  RAFFLE #{raffle?.id || "?"} ENTRIES
                </h3>
                <button
                  onClick={fetchEntries}
                  disabled={isLoadingEntries}
                  className="text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50"
                >
                  {isLoadingEntries ? "Loading..." : "Refresh"}
                </button>
              </div>

              {!raffle?.id ? (
                <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-6 text-center">
                  <p className="text-gray-500 text-sm">No active raffle</p>
                </div>
              ) : isLoadingEntries ? (
                <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-6 text-center">
                  <p className="text-blue-400 text-sm animate-pulse">Loading entries...</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-6 text-center">
                  <p className="text-gray-500 text-sm">No entries yet</p>
                </div>
              ) : (
                <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg overflow-hidden">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-800/50 sticky top-0">
                        <tr>
                          <th className="text-left text-gray-400 p-3 font-pixel">#</th>
                          <th className="text-left text-gray-400 p-3 font-pixel">WALLET</th>
                          <th className="text-right text-gray-400 p-3 font-pixel">ENTERED</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, idx) => (
                          <tr
                            key={entry.wallet}
                            className="border-t border-gray-800/50 hover:bg-gray-800/30"
                          >
                            <td className="p-3 text-gray-500">{idx + 1}</td>
                            <td className="p-3">
                              <span className="font-mono text-white">
                                {truncateWallet(entry.wallet)}
                              </span>
                              <button
                                onClick={() => navigator.clipboard.writeText(entry.wallet)}
                                className="ml-2 text-gray-500 hover:text-blue-400"
                                title="Copy full address"
                              >
                                <svg
                                  className="w-3 h-3 inline"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                              </button>
                            </td>
                            <td className="p-3 text-right text-gray-500">
                              {formatDate(entry.enteredAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-center text-gray-500 text-xs">
                Total: {entries.length} entries
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-pixel text-sm text-purple-400">RAFFLE HISTORY</h3>
                <button
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="text-purple-400 hover:text-purple-300 text-xs disabled:opacity-50"
                >
                  {isLoadingHistory ? "Loading..." : "Refresh"}
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-6 text-center">
                  <p className="text-purple-400 text-sm animate-pulse">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-6 text-center">
                  <p className="text-gray-500 text-sm">No raffle history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-gray-900/30 border rounded-lg p-4 ${
                        item.status === "completed"
                          ? "border-green-500/30"
                          : item.status === "active"
                            ? "border-blue-500/30"
                            : item.status === "paused"
                              ? "border-yellow-500/30"
                              : "border-gray-700/30"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-white">#{item.id}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded ${
                              item.status === "completed"
                                ? "bg-green-500/20 text-green-400"
                                : item.status === "active"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : item.status === "paused"
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-gray-500/20 text-gray-400"
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-gray-500 text-[10px]">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Pot:</span>
                          <span className="text-white ml-2">{item.potSol.toFixed(2)} SOL</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Entries:</span>
                          <span className="text-white ml-2">
                            {item.entryCount} / {item.threshold}
                          </span>
                        </div>
                      </div>

                      {item.winnerWallet && (
                        <div className="mt-2 pt-2 border-t border-gray-800">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 text-xs">Winner:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-yellow-400 text-xs">
                                {truncateWallet(item.winnerWallet)}
                              </span>
                              <button
                                onClick={() => navigator.clipboard.writeText(item.winnerWallet!)}
                                className="text-gray-500 hover:text-yellow-400"
                                title="Copy winner address"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {item.prizeSol && (
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-gray-500 text-xs">Prize:</span>
                              <span className="text-green-400 text-xs">
                                {item.prizeSol.toFixed(2)} SOL
                              </span>
                            </div>
                          )}
                          {item.drawnAt && (
                            <div className="text-gray-600 text-[10px] mt-1">
                              Drawn: {formatDate(item.drawnAt)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
