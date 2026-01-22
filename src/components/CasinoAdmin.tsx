"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

// Admin wallet that can manage the casino
const ADMIN_WALLET = "7BAHgz9Q2ubiTaVo9sCy5AdDvNMiJaK8FebGHTM3PEwm";

interface RaffleStatus {
  id?: number;
  status: string;
  potSol?: number;
  entryCount?: number;
  threshold?: number;
  winnerWallet?: string;
  prizeSol?: number;
  message?: string;
}

interface CasinoAdminProps {
  onClose: () => void;
}

export function CasinoAdmin({ onClose }: CasinoAdminProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [isAdmin, setIsAdmin] = useState(false);
  const [raffle, setRaffle] = useState<RaffleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [potSol, setPotSol] = useState("1");
  const [thresholdEntries, setThresholdEntries] = useState("50");

  // Check if connected wallet is admin
  useEffect(() => {
    if (publicKey) {
      setIsAdmin(publicKey.toString() === ADMIN_WALLET);
    } else {
      setIsAdmin(false);
    }
  }, [publicKey]);

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

  // Sign message helper
  const signAdminMessage = async (action: string): Promise<{ signature: string; timestamp: number } | null> => {
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

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0a0a0f] border border-green-500/50 rounded-2xl max-w-lg w-full p-6 my-4">
        <div className="flex justify-between items-start mb-6">
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

        {/* Current Raffle Status */}
        <div className="bg-black/30 border border-gray-700/30 rounded-lg p-4 mb-6">
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
                <span className={raffle.status === "active" ? "text-green-400" : raffle.status === "completed" ? "text-yellow-400" : "text-purple-400"}>
                  {raffle.status?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pot:</span>
                <span className="text-white">{raffle.potSol?.toFixed(2) || 0} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Entries:</span>
                <span className="text-white">{raffle.entryCount || 0} / {raffle.threshold || 50}</span>
              </div>
              {raffle.winnerWallet && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Winner:</span>
                  <span className="text-yellow-400 font-mono text-xs">
                    {raffle.winnerWallet.slice(0, 4)}...{raffle.winnerWallet.slice(-4)}
                  </span>
                </div>
              )}
            </div>
          )}
          <button
            onClick={fetchRaffle}
            className="mt-3 text-blue-400 hover:text-blue-300 text-xs"
          >
            Refresh
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

        {/* Actions */}
        <div className="space-y-4">
          {/* Initialize */}
          <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-4">
            <h4 className="font-pixel text-xs text-gray-400 mb-2">1. INITIALIZE TABLES</h4>
            <p className="text-gray-500 text-xs mb-3">First-time setup only. Creates database tables.</p>
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
              disabled={isLoading || raffle?.status === "active"}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-pixel text-xs"
            >
              {isLoading ? "CREATING..." : "CREATE RAFFLE"}
            </button>
            {raffle?.status === "active" && (
              <p className="text-yellow-400 text-xs mt-2">Draw current raffle first</p>
            )}
          </div>

          {/* Draw Winner */}
          <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-4">
            <h4 className="font-pixel text-xs text-gray-400 mb-2">3. DRAW WINNER</h4>
            <p className="text-gray-500 text-xs mb-3">
              Draws winner using crypto-secure RNG. Can draw manually or wait for threshold.
            </p>
            <button
              onClick={handleDraw}
              disabled={isLoading || raffle?.status !== "active" || !raffle?.entryCount}
              className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded font-pixel text-xs"
            >
              {isLoading ? "DRAWING..." : "DRAW WINNER"}
            </button>
            {raffle?.status !== "active" && (
              <p className="text-gray-500 text-xs mt-2">No active raffle to draw</p>
            )}
            {raffle?.status === "active" && !raffle?.entryCount && (
              <p className="text-yellow-400 text-xs mt-2">No entries yet</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <p className="text-gray-500 text-xs">
            After drawing, manually send {raffle?.potSol || "the prize"} SOL to the winner.
          </p>
        </div>
      </div>
    </div>
  );
}
