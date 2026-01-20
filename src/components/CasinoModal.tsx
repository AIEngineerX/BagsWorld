"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface CasinoModalProps {
  onClose: () => void;
}

// Tab types
type CasinoTab = "raffle" | "wheel" | "history";

// Types for casino data
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

// Wheel segments
const WHEEL_SEGMENTS = [
  { label: "MISS", color: "#1f2937", prize: 0, probability: 50 },
  { label: "0.01", color: "#059669", prize: 0.01, probability: 25 },
  { label: "MISS", color: "#374151", prize: 0, probability: 50 },
  { label: "0.05", color: "#2563eb", prize: 0.05, probability: 15 },
  { label: "MISS", color: "#1f2937", prize: 0, probability: 50 },
  { label: "0.1", color: "#7c3aed", prize: 0.1, probability: 8 },
  { label: "MISS", color: "#374151", prize: 0, probability: 50 },
  { label: "JACKPOT", color: "#dc2626", prize: 0.5, probability: 2 },
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

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Fetch casino state
  useEffect(() => {
    const fetchCasinoState = async () => {
      setIsLoading(true);
      try {
        // Fetch raffle state
        const raffleRes = await fetch("/api/casino/raffle");
        if (raffleRes.ok) {
          const data = await raffleRes.json();
          setRaffleState(data);
        }

        // Fetch wheel state
        const wheelRes = await fetch("/api/casino/wheel");
        if (wheelRes.ok) {
          const data = await wheelRes.json();
          setWheelState(data);
        }

        // Fetch history if connected
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

  // Handle raffle entry
  const handleEnterRaffle = async () => {
    if (!connected || !publicKey) {
      setError("Please connect your wallet first");
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
        setError(data.error || "Failed to enter raffle");
      }
    } catch (err) {
      setError("Network error - please try again");
    } finally {
      setEnteringRaffle(false);
    }
  };

  // Handle wheel spin
  const handleSpin = async () => {
    if (!connected || !publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    if (isSpinning) return;

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

        // Calculate rotation to land on result
        const segmentIndex = WHEEL_SEGMENTS.findIndex((s) => s.label === data.result || (s.prize === data.prize && s.label !== "MISS"));
        const segmentAngle = 360 / WHEEL_SEGMENTS.length;
        const targetAngle = segmentIndex * segmentAngle + segmentAngle / 2;
        const spins = 5; // Number of full rotations
        const finalRotation = wheelRotation + 360 * spins + (360 - targetAngle);

        setWheelRotation(finalRotation);

        // Show result after animation
        setTimeout(() => {
          setSpinResult({ label: data.result, prize: data.prize });
          setIsSpinning(false);

          // Update wheel state with cooldown
          setWheelState((prev) => prev ? {
            ...prev,
            canSpin: false,
            cooldownEnds: Date.now() + 10 * 60 * 1000,
            lastSpin: {
              result: data.result,
              prize: data.prize,
              timestamp: Date.now(),
            },
          } : null);
        }, 4000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to spin wheel");
        setIsSpinning(false);
      }
    } catch (err) {
      setError("Network error - please try again");
      setIsSpinning(false);
    }
  };

  // Format SOL amount
  const formatSol = (lamports: number) => {
    return (lamports / 1e9).toFixed(4);
  };

  // Format time remaining
  const formatTimeRemaining = (endTime: number) => {
    const remaining = Math.max(0, endTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-purple-500 rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 p-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)" }} />
          </div>

          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black/30 rounded-xl flex items-center justify-center border border-yellow-400/50">
                <span className="text-2xl">🎰</span>
              </div>
              <div>
                <h2 className="font-pixel text-white text-base sm:text-lg tracking-wide">BAGSWORLD CASINO</h2>
                <p className="text-purple-200 text-[10px] sm:text-xs flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  Funded by Ghost&apos;s Trading Fees
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-black/30 hover:bg-black/50 rounded-lg flex items-center justify-center text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 relative z-10">
            {([
              { id: "raffle", label: "FREE RAFFLE", icon: "🎟️" },
              { id: "wheel", label: "WHEEL", icon: "🎡" },
              { id: "history", label: "HISTORY", icon: "📜" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 font-pixel text-[10px] px-3 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "bg-black/50 text-white border border-white/20"
                    : "bg-black/20 text-purple-200 hover:bg-black/30"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-4xl animate-bounce mb-2">🎰</div>
                <p className="font-pixel text-xs text-purple-300">Loading casino...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Raffle Tab */}
              {activeTab === "raffle" && (
                <div className="space-y-4">
                  {/* Pot Display */}
                  <div className="bg-gradient-to-br from-purple-900/50 to-purple-950/50 rounded-xl border border-yellow-500/50 p-6 text-center">
                    <p className="font-pixel text-[10px] text-purple-300 mb-2">CURRENT POT</p>
                    <div className="text-3xl sm:text-4xl font-pixel text-yellow-400 animate-pulse">
                      {raffleState ? formatSol(raffleState.potLamports) : "0.0000"} SOL
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-4 text-[10px] sm:text-xs">
                      <div className="text-gray-400">
                        <span className="text-white font-pixel">{raffleState?.entryCount || 0}</span> entries
                      </div>
                      <div className="text-gray-400">
                        Draws at <span className="text-yellow-400 font-pixel">{raffleState?.threshold || 0.5} SOL</span>
                      </div>
                    </div>
                  </div>

                  {/* Entry Section */}
                  <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
                    <h3 className="font-pixel text-sm text-yellow-400 mb-3">FREE ENTRY</h3>
                    <p className="text-xs text-gray-300 mb-4">
                      Enter for free! One entry per wallet per round. When the pot reaches the threshold,
                      a random winner takes the entire pot.
                    </p>

                    {!connected ? (
                      <div className="text-center py-4 text-gray-400 font-pixel text-[10px]">
                        Connect your wallet to enter
                      </div>
                    ) : raffleState?.userEntered ? (
                      <div className="text-center py-4">
                        <div className="text-2xl mb-2">✅</div>
                        <p className="font-pixel text-xs text-green-400">You&apos;re entered!</p>
                        <p className="text-[10px] text-gray-400 mt-1">Good luck!</p>
                      </div>
                    ) : (
                      <button
                        onClick={handleEnterRaffle}
                        disabled={enteringRaffle}
                        className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-pixel text-xs rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {enteringRaffle ? "ENTERING..." : "ENTER RAFFLE (FREE)"}
                      </button>
                    )}
                  </div>

                  {/* How it works */}
                  <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
                    <h4 className="font-pixel text-[10px] text-purple-300 mb-2">HOW IT WORKS</h4>
                    <ul className="text-[10px] text-gray-400 space-y-1">
                      <li>• Ghost&apos;s trading fees fill the pot</li>
                      <li>• Enter for free (one entry per wallet)</li>
                      <li>• When pot reaches threshold, drawing begins</li>
                      <li>• Winner takes 100% of the pot</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Wheel Tab */}
              {activeTab === "wheel" && (
                <div className="space-y-4">
                  {/* Wheel Display */}
                  <div className="flex flex-col items-center">
                    {/* Wheel Container */}
                    <div className="relative w-48 h-48 sm:w-64 sm:h-64 mb-4">
                      {/* Pointer */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] sm:border-l-[12px] sm:border-r-[12px] sm:border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-400" />
                      </div>

                      {/* Wheel SVG */}
                      <svg
                        viewBox="0 0 200 200"
                        className="w-full h-full transition-transform"
                        style={{
                          transform: `rotate(${wheelRotation}deg)`,
                          transitionDuration: isSpinning ? "4s" : "0s",
                          transitionTimingFunction: "cubic-bezier(0.17, 0.67, 0.12, 0.99)",
                        }}
                      >
                        {WHEEL_SEGMENTS.map((segment, i) => {
                          const angle = (360 / WHEEL_SEGMENTS.length) * i;
                          const endAngle = angle + 360 / WHEEL_SEGMENTS.length;
                          const startRad = (angle - 90) * (Math.PI / 180);
                          const endRad = (endAngle - 90) * (Math.PI / 180);
                          const x1 = 100 + 90 * Math.cos(startRad);
                          const y1 = 100 + 90 * Math.sin(startRad);
                          const x2 = 100 + 90 * Math.cos(endRad);
                          const y2 = 100 + 90 * Math.sin(endRad);
                          const largeArc = 360 / WHEEL_SEGMENTS.length > 180 ? 1 : 0;

                          return (
                            <g key={i}>
                              <path
                                d={`M100,100 L${x1},${y1} A90,90 0 ${largeArc},1 ${x2},${y2} Z`}
                                fill={segment.color}
                                stroke="#0a0a0f"
                                strokeWidth="2"
                              />
                              <text
                                x={100 + 55 * Math.cos((startRad + endRad) / 2)}
                                y={100 + 55 * Math.sin((startRad + endRad) / 2)}
                                fill="white"
                                fontSize="8"
                                fontWeight="bold"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                transform={`rotate(${(angle + endAngle) / 2}, ${100 + 55 * Math.cos((startRad + endRad) / 2)}, ${100 + 55 * Math.sin((startRad + endRad) / 2)})`}
                              >
                                {segment.label}
                              </text>
                            </g>
                          );
                        })}
                        <circle cx="100" cy="100" r="15" fill="#2d1b4e" stroke="#fbbf24" strokeWidth="3" />
                        <text x="100" y="100" fill="#fbbf24" fontSize="10" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">SOL</text>
                      </svg>
                    </div>

                    {/* Spin Result */}
                    {spinResult && (
                      <div className={`text-center mb-4 p-3 rounded-xl w-full ${spinResult.prize > 0 ? "bg-green-900/30 border border-green-500/50" : "bg-gray-800/50 border border-gray-600/50"}`}>
                        <p className="font-pixel text-sm">
                          {spinResult.prize > 0 ? (
                            <>
                              <span className="text-green-400">YOU WON!</span>
                              <span className="text-yellow-400 ml-2">{spinResult.prize} SOL</span>
                            </>
                          ) : (
                            <span className="text-gray-400">Better luck next time!</span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Pot Balance */}
                    <div className="text-center mb-4">
                      <p className="font-pixel text-[10px] text-purple-300">POT BALANCE</p>
                      <p className="font-pixel text-xl text-yellow-400">{wheelState?.potBalance?.toFixed(4) || "0.0000"} SOL</p>
                    </div>

                    {/* Spin Button */}
                    {!connected ? (
                      <div className="text-center py-4 text-gray-400 font-pixel text-[10px]">
                        Connect your wallet to spin
                      </div>
                    ) : wheelState && !wheelState.canSpin && wheelState.cooldownEnds ? (
                      <div className="text-center py-4">
                        <p className="font-pixel text-xs text-yellow-400">Cooldown: {formatTimeRemaining(wheelState.cooldownEnds)}</p>
                        <p className="text-[10px] text-gray-400 mt-1">One spin every 10 minutes</p>
                      </div>
                    ) : (
                      <button
                        onClick={handleSpin}
                        disabled={isSpinning || Boolean(wheelState && !wheelState.canSpin)}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-pixel text-sm rounded-xl transition-all transform hover:scale-[1.05] disabled:opacity-50 disabled:cursor-not-allowed border-2 border-yellow-500/50"
                      >
                        {isSpinning ? "SPINNING..." : "🎰 SPIN (FREE)"}
                      </button>
                    )}
                  </div>

                  {/* Prize Table */}
                  <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
                    <h4 className="font-pixel text-[10px] text-purple-300 mb-3">PRIZES</h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">0.01 SOL</span>
                        <span className="text-green-400 font-pixel">25%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">0.05 SOL</span>
                        <span className="text-blue-400 font-pixel">15%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">0.1 SOL</span>
                        <span className="text-purple-400 font-pixel">8%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">JACKPOT</span>
                        <span className="text-red-400 font-pixel">2%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === "history" && (
                <div className="space-y-3">
                  {!connected ? (
                    <div className="text-center py-12 text-gray-400 font-pixel text-[10px]">
                      Connect your wallet to view history
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-4">📜</div>
                      <p className="font-pixel text-xs text-gray-400">No casino history yet</p>
                      <p className="text-[10px] text-gray-500 mt-1">Try your luck at the raffle or wheel!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((entry) => (
                        <div
                          key={entry.id}
                          className={`p-3 rounded-xl border ${
                            entry.isWin ? "bg-green-900/20 border-green-700/50" : "bg-gray-800/30 border-gray-700/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span>{entry.type === "raffle" ? "🎟️" : "🎡"}</span>
                              <span className="font-pixel text-[10px] text-white">
                                {entry.type.toUpperCase()}
                              </span>
                            </div>
                            <span className={`font-pixel text-[10px] ${entry.isWin ? "text-green-400" : "text-gray-400"}`}>
                              {entry.isWin ? `+${entry.amount.toFixed(4)} SOL` : entry.result}
                            </span>
                          </div>
                          <p className="text-[9px] text-gray-500 mt-1">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-red-300 text-[10px] font-pixel">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700/50 bg-gray-900/50 px-4 py-3">
          <p className="font-pixel text-[9px] text-gray-500 text-center">
            All prizes funded by Ghost&apos;s trading fees. Play responsibly!
          </p>
        </div>
      </div>
    </div>
  );
}
