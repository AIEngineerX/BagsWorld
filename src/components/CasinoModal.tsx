"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface CasinoModalProps {
  onClose: () => void;
}

type CasinoTab = "raffle" | "wheel" | "history";

interface RaffleState {
  id: number;
  status: "active" | "drawing" | "completed";
  potLamports: number;
  entryCount: number;
  threshold: number;
  userEntered: boolean;
  winner?: string;
}

interface WheelState {
  potBalance: number;
  lastSpin?: {
    result: string;
    prize: number;
    timestamp: number;
  };
  canSpin: boolean;
  cooldownEnds?: number;
}

interface HistoryEntry {
  id: string;
  type: "raffle" | "wheel";
  result: string;
  amount: number;
  timestamp: number;
  isWin: boolean;
}

// Wheel segments with better colors
const WHEEL_SEGMENTS = [
  { label: "MISS", color: "#18181b", textColor: "#52525b", prize: 0 },
  { label: "0.01", color: "#065f46", textColor: "#34d399", prize: 0.01 },
  { label: "MISS", color: "#27272a", textColor: "#52525b", prize: 0 },
  { label: "0.05", color: "#1e40af", textColor: "#60a5fa", prize: 0.05 },
  { label: "MISS", color: "#18181b", textColor: "#52525b", prize: 0 },
  { label: "0.1", color: "#581c87", textColor: "#c084fc", prize: 0.1 },
  { label: "MISS", color: "#27272a", textColor: "#52525b", prize: 0 },
  { label: "0.5", color: "#991b1b", textColor: "#fbbf24", prize: 0.5 },
];

export function CasinoModal({ onClose }: CasinoModalProps) {
  const { publicKey, connected } = useWallet();
  const [activeTab, setActiveTab] = useState<CasinoTab>("raffle");
  const [raffleState, setRaffleState] = useState<RaffleState | null>(null);
  const [wheelState, setWheelState] = useState<WheelState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinResult, setSpinResult] = useState<{ label: string; prize: number } | null>(null);
  const [enteringRaffle, setEnteringRaffle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownTime, setCooldownTime] = useState<string>("");

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Format time remaining
  const formatTimeRemaining = useCallback((endTime: number) => {
    const remaining = Math.max(0, endTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Update cooldown timer
  useEffect(() => {
    if (wheelState?.cooldownEnds && !wheelState.canSpin) {
      const interval = setInterval(() => {
        const time = formatTimeRemaining(wheelState.cooldownEnds!);
        setCooldownTime(time);
        if (wheelState.cooldownEnds! <= Date.now()) {
          setWheelState(prev => prev ? { ...prev, canSpin: true } : null);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [wheelState?.cooldownEnds, wheelState?.canSpin, formatTimeRemaining]);

  // Fetch casino state
  useEffect(() => {
    const fetchCasinoState = async () => {
      setIsLoading(true);
      try {
        const [raffleRes, wheelRes] = await Promise.all([
          fetch("/api/casino/raffle"),
          fetch("/api/casino/wheel"),
        ]);

        if (raffleRes.ok) setRaffleState(await raffleRes.json());
        if (wheelRes.ok) setWheelState(await wheelRes.json());

        if (publicKey) {
          const historyRes = await fetch(`/api/casino/history?wallet=${publicKey.toBase58()}`);
          if (historyRes.ok) {
            const data = await historyRes.json();
            setHistory(data.history || []);
          }
        }
      } catch (err) {
        console.error("Error fetching casino state:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCasinoState();
  }, [publicKey]);

  const handleEnterRaffle = async () => {
    if (!connected || !publicKey) {
      setError("Connect wallet to enter");
      return;
    }
    setEnteringRaffle(true);
    setError(null);

    try {
      const res = await fetch("/api/casino/raffle/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      if (res.ok) {
        setRaffleState((prev) => prev ? { ...prev, userEntered: true, entryCount: prev.entryCount + 1 } : null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to enter");
      }
    } catch {
      setError("Network error");
    } finally {
      setEnteringRaffle(false);
    }
  };

  const handleSpin = async () => {
    if (!connected || !publicKey || isSpinning) return;

    setIsSpinning(true);
    setSpinResult(null);
    setError(null);

    try {
      const res = await fetch("/api/casino/wheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      if (res.ok) {
        const data = await res.json();
        const segmentIndex = WHEEL_SEGMENTS.findIndex((s) => s.prize === data.prize);
        const segmentAngle = 360 / WHEEL_SEGMENTS.length;
        const targetAngle = segmentIndex * segmentAngle + segmentAngle / 2;
        const finalRotation = wheelRotation + 360 * 6 + (360 - targetAngle);

        setWheelRotation(finalRotation);

        setTimeout(() => {
          setSpinResult({ label: data.result, prize: data.prize });
          setIsSpinning(false);
          setWheelState((prev) => prev ? {
            ...prev,
            canSpin: false,
            cooldownEnds: Date.now() + 10 * 60 * 1000,
          } : null);
        }, 5000);
      } else {
        const data = await res.json();
        setError(data.error || "Spin failed");
        setIsSpinning(false);
      }
    } catch {
      setError("Network error");
      setIsSpinning(false);
    }
  };

  const formatSol = (lamports: number) => (lamports / 1e9).toFixed(3);

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0c0c0f] border border-purple-500/30 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-b from-purple-900/40 to-transparent p-5 border-b border-purple-500/20">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-pixel text-lg text-white tracking-wider">BAGSWORLD CASINO</h2>
              <p className="text-purple-400/80 text-xs mt-1">Funded by BagsWorld</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5">
            {([
              { id: "raffle", label: "Raffle" },
              { id: "wheel", label: "Wheel" },
              { id: "history", label: "History" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Raffle Tab */}
              {activeTab === "raffle" && (
                <div className="space-y-5">
                  {/* Pot Card */}
                  <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/20 rounded-xl p-6 border border-purple-500/20">
                    <div className="text-center">
                      <p className="text-purple-400 text-xs uppercase tracking-wider mb-2">Current Pot</p>
                      <p className="text-4xl font-bold text-white mb-1">
                        {raffleState ? formatSol(raffleState.potLamports) : "0.000"}
                        <span className="text-lg text-purple-400 ml-2">SOL</span>
                      </p>
                      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                        <span className="text-gray-400">
                          <span className="text-white font-medium">{raffleState?.entryCount || 0}</span> entries
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-400">
                          Draws at <span className="text-purple-400 font-medium">{raffleState?.threshold || 0.5} SOL</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Entry */}
                  <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                    {!connected ? (
                      <p className="text-center text-gray-500 text-sm py-4">Connect wallet to enter</p>
                    ) : raffleState?.userEntered ? (
                      <div className="text-center py-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-green-400 font-medium">You&apos;re in!</p>
                        <p className="text-gray-500 text-xs mt-1">Good luck</p>
                      </div>
                    ) : (
                      <button
                        onClick={handleEnterRaffle}
                        disabled={enteringRaffle}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                      >
                        {enteringRaffle ? "Entering..." : "Enter Free Raffle"}
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>• Free entry, one per wallet</p>
                    <p>• Winner takes 100% of pot</p>
                    <p>• Drawing when threshold reached</p>
                  </div>
                </div>
              )}

              {/* Wheel Tab */}
              {activeTab === "wheel" && (
                <div className="space-y-5">
                  {/* Wheel */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-56 h-56 mb-6">
                      {/* Pointer */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                        <div className="w-4 h-6 bg-yellow-400 clip-triangle" style={{
                          clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)"
                        }} />
                      </div>

                      {/* Wheel */}
                      <div
                        className="w-full h-full rounded-full border-4 border-purple-500/50 shadow-lg shadow-purple-500/20 overflow-hidden"
                        style={{
                          transform: `rotate(${wheelRotation}deg)`,
                          transition: isSpinning ? "transform 5s cubic-bezier(0.2, 0.8, 0.3, 1)" : "none",
                        }}
                      >
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                          {WHEEL_SEGMENTS.map((segment, i) => {
                            const angle = (360 / WHEEL_SEGMENTS.length) * i;
                            const endAngle = angle + 360 / WHEEL_SEGMENTS.length;
                            const startRad = (angle - 90) * (Math.PI / 180);
                            const endRad = (endAngle - 90) * (Math.PI / 180);
                            const x1 = 100 + 100 * Math.cos(startRad);
                            const y1 = 100 + 100 * Math.sin(startRad);
                            const x2 = 100 + 100 * Math.cos(endRad);
                            const y2 = 100 + 100 * Math.sin(endRad);
                            const midRad = (startRad + endRad) / 2;
                            const textX = 100 + 65 * Math.cos(midRad);
                            const textY = 100 + 65 * Math.sin(midRad);

                            return (
                              <g key={i}>
                                <path
                                  d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`}
                                  fill={segment.color}
                                />
                                <text
                                  x={textX}
                                  y={textY}
                                  fill={segment.textColor}
                                  fontSize="11"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  transform={`rotate(${(angle + endAngle) / 2}, ${textX}, ${textY})`}
                                >
                                  {segment.label}
                                </text>
                              </g>
                            );
                          })}
                          {/* Center */}
                          <circle cx="100" cy="100" r="20" fill="#1a1a1e" stroke="#7c3aed" strokeWidth="3" />
                          <text x="100" y="100" fill="#a855f7" fontSize="8" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">SPIN</text>
                        </svg>
                      </div>
                    </div>

                    {/* Result */}
                    {spinResult && (
                      <div className={`w-full p-4 rounded-xl mb-4 text-center ${
                        spinResult.prize > 0 ? "bg-green-500/10 border border-green-500/30" : "bg-white/5 border border-white/10"
                      }`}>
                        {spinResult.prize > 0 ? (
                          <p className="text-green-400 font-medium">
                            Won <span className="text-white">{spinResult.prize} SOL</span>
                          </p>
                        ) : (
                          <p className="text-gray-400">No win this time</p>
                        )}
                      </div>
                    )}

                    {/* Spin Button */}
                    {!connected ? (
                      <p className="text-gray-500 text-sm">Connect wallet to spin</p>
                    ) : wheelState && !wheelState.canSpin ? (
                      <div className="text-center">
                        <p className="text-purple-400 font-mono text-lg">{cooldownTime}</p>
                        <p className="text-gray-500 text-xs mt-1">until next spin</p>
                      </div>
                    ) : (
                      <button
                        onClick={handleSpin}
                        disabled={isSpinning}
                        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 border border-purple-400/30"
                      >
                        {isSpinning ? "Spinning..." : "Spin Free"}
                      </button>
                    )}
                  </div>

                  {/* Prizes */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-green-900/20 rounded-lg p-2">
                      <p className="text-green-400 font-medium">0.01</p>
                      <p className="text-gray-500">25%</p>
                    </div>
                    <div className="bg-blue-900/20 rounded-lg p-2">
                      <p className="text-blue-400 font-medium">0.05</p>
                      <p className="text-gray-500">15%</p>
                    </div>
                    <div className="bg-purple-900/20 rounded-lg p-2">
                      <p className="text-purple-400 font-medium">0.10</p>
                      <p className="text-gray-500">8%</p>
                    </div>
                    <div className="bg-red-900/20 rounded-lg p-2">
                      <p className="text-yellow-400 font-medium">0.50</p>
                      <p className="text-gray-500">2%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === "history" && (
                <div>
                  {!connected ? (
                    <p className="text-center text-gray-500 py-12">Connect wallet to view history</p>
                  ) : history.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No history yet</p>
                      <p className="text-gray-600 text-xs mt-1">Play to see your results here</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((entry) => (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            entry.isWin ? "bg-green-500/10" : "bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{entry.type === "raffle" ? "🎟️" : "🎡"}</span>
                            <div>
                              <p className="text-white text-sm capitalize">{entry.type}</p>
                              <p className="text-gray-500 text-xs">
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className={`font-medium ${entry.isWin ? "text-green-400" : "text-gray-500"}`}>
                            {entry.isWin ? `+${entry.amount.toFixed(3)}` : entry.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
