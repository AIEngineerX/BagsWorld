"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface OracleTowerModalProps {
  onClose: () => void;
}

interface TokenOption {
  mint: string;
  symbol: string;
  name: string;
  startPrice: number;
  imageUrl?: string;
}

interface OracleRoundData {
  id: number;
  status: "active" | "settled" | "cancelled" | "none";
  startTime?: string;
  endTime?: string;
  tokenOptions: TokenOption[];
  entryCount: number;
  predictionCounts?: Record<string, number>;
  userPrediction?: {
    tokenMint: string;
    createdAt: string;
  };
  remainingMs?: number;
  canEnter?: boolean;
  entryDeadline?: string;
  winningTokenMint?: string;
  winningPriceChange?: number;
  settlementData?: {
    priceChanges?: Record<string, number>;
  };
  message?: string;
}

interface HistoryRound {
  id: number;
  status: "settled" | "cancelled";
  startTime: string;
  endTime: string;
  tokenOptions: TokenOption[];
  entryCount: number;
  winner?: {
    mint: string;
    symbol: string;
    name: string;
    priceChange: number;
  };
  userPrediction?: {
    tokenMint: string;
    isWinner: boolean;
    createdAt: string;
  };
}

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  walletShort: string;
  wins: number;
  totalPredictions: number;
  winRate: number;
}

interface TokenGateError {
  required: number;
  balance: number;
  symbol: string;
  buyUrl: string;
  message: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Pixel art corner flourish SVG
function PixelCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const rotation = {
    tl: "rotate(0)",
    tr: "rotate(90deg)",
    br: "rotate(180deg)",
    bl: "rotate(270deg)",
  }[position];

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className="absolute"
      style={{
        transform: rotation,
        top: position.includes("t") ? "-2px" : "auto",
        bottom: position.includes("b") ? "-2px" : "auto",
        left: position.includes("l") ? "-2px" : "auto",
        right: position.includes("r") ? "-2px" : "auto",
      }}
    >
      <rect x="0" y="0" width="4" height="4" fill="#a855f7" />
      <rect x="4" y="0" width="4" height="4" fill="#7c3aed" />
      <rect x="0" y="4" width="4" height="4" fill="#7c3aed" />
      <rect x="8" y="0" width="4" height="4" fill="#6b21a8" />
      <rect x="0" y="8" width="4" height="4" fill="#6b21a8" />
    </svg>
  );
}

// Animated crystal ball for no market state
function CrystalBall() {
  return (
    <div className="relative w-16 h-16 mx-auto">
      {/* Outer glow */}
      <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-pulse" />
      {/* Crystal ball base - pixel art style */}
      <svg viewBox="0 0 32 32" className="w-full h-full animate-[float_3s_ease-in-out_infinite]">
        {/* Stand */}
        <rect x="10" y="26" width="12" height="2" fill="#4a4a4a" />
        <rect x="12" y="24" width="8" height="2" fill="#5a5a5a" />
        <rect x="13" y="22" width="6" height="2" fill="#6a6a6a" />
        {/* Ball outline */}
        <rect x="8" y="6" width="16" height="2" fill="#6b21a8" />
        <rect x="6" y="8" width="2" height="2" fill="#6b21a8" />
        <rect x="24" y="8" width="2" height="2" fill="#6b21a8" />
        <rect x="4" y="10" width="2" height="8" fill="#6b21a8" />
        <rect x="26" y="10" width="2" height="8" fill="#6b21a8" />
        <rect x="6" y="18" width="2" height="2" fill="#6b21a8" />
        <rect x="24" y="18" width="2" height="2" fill="#6b21a8" />
        <rect x="8" y="20" width="16" height="2" fill="#6b21a8" />
        {/* Ball fill */}
        <rect x="8" y="8" width="16" height="12" fill="#1a1a2e" />
        {/* Inner glow */}
        <rect x="10" y="10" width="4" height="2" fill="#a855f7" className="animate-pulse" />
        <rect x="10" y="12" width="2" height="2" fill="#7c3aed" className="animate-pulse" />
        {/* Eye */}
        <rect x="14" y="12" width="4" height="4" fill="#a855f7" className="animate-pulse" />
        <rect x="15" y="13" width="2" height="2" fill="#fff" />
      </svg>
      {/* Sparkles */}
      <div className="absolute top-1 right-2 w-1 h-1 bg-purple-300 animate-[twinkle_1.5s_ease-in-out_infinite]" />
      <div className="absolute top-3 left-2 w-1 h-1 bg-purple-400 animate-[twinkle_2s_ease-in-out_infinite_0.5s]" />
      <div className="absolute bottom-6 right-3 w-1 h-1 bg-purple-200 animate-[twinkle_1.8s_ease-in-out_infinite_0.3s]" />
    </div>
  );
}

export function OracleTowerModal({ onClose }: OracleTowerModalProps) {
  const [view, setView] = useState<"predict" | "leaders" | "history" | "admin">("predict");
  const [round, setRound] = useState<OracleRoundData | null>(null);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<{ wins: number; rank: number } | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [tokenGateError, setTokenGateError] = useState<TokenGateError | null>(null);

  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const { publicKey, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { isAdmin } = useAdminCheck();

  const fetchRound = useCallback(async () => {
    setIsLoading(true);
    const walletParam = publicKey ? `?wallet=${publicKey.toString()}` : "";
    const res = await fetch(`/api/oracle/current${walletParam}`);
    const data = await res.json();
    setRound(data);
    setCountdown(data.remainingMs || 0);
    setIsLoading(false);
  }, [publicKey]);

  const fetchHistory = useCallback(async () => {
    const walletParam = publicKey ? `?wallet=${publicKey.toString()}&limit=10` : "?limit=10";
    const res = await fetch(`/api/oracle/history${walletParam}`);
    const data = await res.json();
    setHistory(data.rounds || []);
  }, [publicKey]);

  const fetchLeaderboard = useCallback(async () => {
    const walletParam = publicKey ? `?wallet=${publicKey.toString()}&limit=10` : "?limit=10";
    const res = await fetch(`/api/oracle/leaderboard${walletParam}`);
    const data = await res.json();
    setLeaderboard(data.leaderboard || []);
    if (data.userStats) {
      setUserStats({ wins: data.userStats.wins, rank: data.userStats.rank });
    }
  }, [publicKey]);

  useEffect(() => {
    fetchRound();
    if (view === "history") fetchHistory();
    if (view === "leaders") fetchLeaderboard();
  }, [fetchRound, fetchHistory, fetchLeaderboard, view]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1000)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const interval = setInterval(() => fetchRound(), 30000);
    return () => clearInterval(interval);
  }, [fetchRound]);

  const handleSubmitPrediction = async () => {
    if (!publicKey || !selectedToken || isSubmitting) return;
    setIsSubmitting(true);
    setMessage(null);
    setTokenGateError(null);

    const res = await fetch("/api/oracle/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: publicKey.toString(), tokenMint: selectedToken }),
    });

    const data = await res.json();
    if (data.success) {
      setMessage("Prediction locked!");
      setSelectedToken(null);
      await fetchRound();
    } else if (data.tokenGate) {
      setTokenGateError(data.tokenGate);
    } else {
      setMessage(data.error || "Failed to submit");
    }
    setIsSubmitting(false);
  };

  const handleCreateRound = async () => {
    if (!publicKey || isCreatingRound) return;
    setIsCreatingRound(true);
    const res = await fetch("/api/oracle/admin/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminWallet: publicKey.toString(), durationHours: 24 }),
    });
    const data = await res.json();
    setMessage(data.success ? "Round created!" : data.error || "Failed");
    if (data.success) await fetchRound();
    setIsCreatingRound(false);
  };

  const handleSettleRound = async () => {
    if (!publicKey || isSettling) return;
    setIsSettling(true);
    const res = await fetch("/api/oracle/admin/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminWallet: publicKey.toString() }),
    });
    const data = await res.json();
    setMessage(data.success ? `Winner: ${data.winner?.symbol}` : data.error || "Failed");
    if (data.success) await fetchRound();
    setIsSettling(false);
  };

  const getTotalPredictions = () => {
    if (!round?.predictionCounts) return 0;
    return Object.values(round.predictionCounts).reduce((a, b) => a + b, 0);
  };

  const getTokenProbability = (mint: string) => {
    const total = getTotalPredictions();
    if (total === 0) return round?.tokenOptions?.length ? 100 / round.tokenOptions.length : 20;
    return ((round?.predictionCounts?.[mint] || 0) / total) * 100;
  };

  const tabs = ["predict", "leaders", "history", ...(isAdmin ? ["admin"] : [])] as const;

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Scanline overlay */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(168, 85, 247, 0.4), inset 0 0 8px rgba(168, 85, 247, 0.1); }
          50% { box-shadow: 0 0 16px rgba(168, 85, 247, 0.6), inset 0 0 12px rgba(168, 85, 247, 0.2); }
        }
        .rpg-border {
          border: 4px solid #6b21a8;
          box-shadow:
            inset 0 0 0 2px #1a1a2e,
            inset 0 0 0 4px #4c1d95,
            0 0 20px rgba(139, 92, 246, 0.3);
        }
        .rpg-border-inner {
          border: 2px solid #4c1d95;
          box-shadow: inset 0 0 0 1px #2e1065;
        }
        .rpg-button {
          border: 3px solid;
          border-color: #a855f7 #4c1d95 #4c1d95 #a855f7;
          background: linear-gradient(180deg, #6b21a8 0%, #4c1d95 100%);
          box-shadow: 2px 2px 0 #1a1a2e;
          transition: all 0.1s;
        }
        .rpg-button:hover:not(:disabled) {
          border-color: #c084fc #6b21a8 #6b21a8 #c084fc;
          background: linear-gradient(180deg, #7c3aed 0%, #6b21a8 100%);
        }
        .rpg-button:active:not(:disabled), .rpg-button.active {
          border-color: #4c1d95 #a855f7 #a855f7 #4c1d95;
          background: linear-gradient(180deg, #4c1d95 0%, #3b0764 100%);
          box-shadow: inset 2px 2px 0 #1a1a2e;
          transform: translate(1px, 1px);
        }
        .rpg-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .scanlines {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.1) 0px,
            rgba(0, 0, 0, 0.1) 1px,
            transparent 1px,
            transparent 2px
          );
          z-index: 100;
        }
        .crt-curve {
          box-shadow:
            inset 0 0 60px rgba(0, 0, 0, 0.3),
            inset 0 0 20px rgba(139, 92, 246, 0.1);
        }
        .glow-text {
          text-shadow: 0 0 8px rgba(168, 85, 247, 0.8), 0 0 16px rgba(168, 85, 247, 0.4);
        }
        .glow-green {
          text-shadow: 0 0 8px rgba(34, 197, 94, 0.8), 0 0 16px rgba(34, 197, 94, 0.4);
        }
      `}</style>

      <div className="rpg-border bg-[#0d0d0d] w-full max-w-lg max-h-[95vh] flex flex-col relative crt-curve overflow-hidden">
        {/* Scanlines effect */}
        <div className="scanlines" />

        {/* Corner flourishes */}
        <PixelCorner position="tl" />
        <PixelCorner position="tr" />
        <PixelCorner position="bl" />
        <PixelCorner position="br" />

        {/* Header */}
        <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0d0d0d] px-4 py-3 flex items-center justify-between shrink-0 relative">
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#6b21a8] to-transparent" />
          <div className="flex items-center gap-3">
            {/* Crystal ball icon */}
            <div className="w-10 h-10 rpg-border-inner bg-[#1a1a2e] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-purple-500/10 animate-pulse" />
              <svg viewBox="0 0 16 16" className="w-6 h-6">
                <rect x="4" y="2" width="8" height="1" fill="#a855f7" />
                <rect x="3" y="3" width="1" height="1" fill="#a855f7" />
                <rect x="12" y="3" width="1" height="1" fill="#a855f7" />
                <rect x="2" y="4" width="1" height="6" fill="#a855f7" />
                <rect x="13" y="4" width="1" height="6" fill="#a855f7" />
                <rect x="3" y="10" width="1" height="1" fill="#a855f7" />
                <rect x="12" y="10" width="1" height="1" fill="#a855f7" />
                <rect x="4" y="11" width="8" height="1" fill="#a855f7" />
                <rect x="3" y="3" width="10" height="8" fill="#1a1a2e" />
                <rect x="5" y="5" width="2" height="1" fill="#c084fc" />
                <rect x="5" y="6" width="1" height="1" fill="#a855f7" />
                <rect x="7" y="6" width="2" height="2" fill="#fff" className="animate-pulse" />
                <rect x="6" y="12" width="4" height="1" fill="#4a4a4a" />
                <rect x="5" y="13" width="6" height="1" fill="#3a3a3a" />
              </svg>
            </div>
            <div>
              <span className="font-pixel text-[#a855f7] text-sm block glow-text">ORACLE MARKET</span>
              {round?.status === "active" && countdown > 0 && (
                <span className="font-pixel text-[#22c55e] text-[10px] glow-green">{formatTimeRemaining(countdown)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {round?.status === "active" && (
              <span className="font-pixel text-[10px] px-2 py-1 rpg-border-inner bg-[#166534]/30 text-[#22c55e] glow-green animate-pulse">
                LIVE
              </span>
            )}
            <button
              onClick={onClose}
              className="rpg-button font-pixel text-[#fff] text-[10px] px-2 py-1"
            >
              X
            </button>
          </div>
        </div>

        {/* Tabs - RPG button style */}
        <div className="flex gap-1 px-2 py-2 bg-[#0a0a0a] shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab as typeof view)}
              className={`flex-1 font-pixel text-[10px] py-2 px-2 rpg-button ${
                view === tab ? "active" : ""
              } ${tab === "admin" ? "!bg-gradient-to-b !from-[#166534] !to-[#14532d]" : ""}`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Decorative divider */}
        <div className="h-[4px] bg-gradient-to-r from-[#6b21a8] via-[#a855f7] to-[#6b21a8] relative">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 relative z-10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rpg-border-inner bg-[#1a1a2e] flex items-center justify-center animate-[glow-pulse_2s_ease-in-out_infinite]">
                <span className="font-pixel text-[#a855f7] text-lg animate-pulse">...</span>
              </div>
              <p className="font-pixel text-[#666] text-[10px] mt-3">CONSULTING THE ORACLE</p>
            </div>
          ) : view === "predict" ? (
            round?.status === "none" || !round ? (
              /* No Active Market - Enhanced with crystal ball */
              <div className="rpg-border-inner bg-[#1a1a1a] p-6 text-center">
                <CrystalBall />
                <p className="font-pixel text-[#a855f7] text-sm mt-4 glow-text">NO ACTIVE MARKET</p>
                <p className="font-pixel text-[#666] text-[10px] mt-2">{round?.message || "The oracle rests..."}</p>
                <div className="mt-4 flex justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-[#6b21a8] animate-pulse"
                      style={{ animationDelay: `${i * 0.3}s` }}
                    />
                  ))}
                </div>
              </div>
            ) : round.status === "settled" ? (
              <div className="space-y-3">
                {/* Winner Banner */}
                <div className="rpg-border-inner bg-[#166534]/20 p-4 text-center animate-[glow-pulse_2s_ease-in-out_infinite]">
                  <p className="font-pixel text-[#22c55e] text-xs mb-1 glow-green">MARKET RESOLVED</p>
                  <p className="font-pixel text-white text-lg glow-text">
                    {round.tokenOptions.find((t) => t.mint === round.winningTokenMint)?.symbol || "?"}
                  </p>
                  <p className="font-pixel text-[#22c55e] text-sm glow-green">
                    +{round.winningPriceChange?.toFixed(2)}%
                  </p>
                </div>

                {/* User Result */}
                {round.userPrediction && (
                  <div className={`rpg-border-inner p-3 ${
                    round.userPrediction.tokenMint === round.winningTokenMint
                      ? "bg-[#166534]/10"
                      : "bg-[#1a1a1a]"
                  }`}>
                    <p className="font-pixel text-[#666] text-[10px]">YOUR PREDICTION</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-pixel text-white text-sm">
                        {round.tokenOptions.find((t) => t.mint === round.userPrediction?.tokenMint)?.symbol}
                      </span>
                      {round.userPrediction.tokenMint === round.winningTokenMint ? (
                        <span className="font-pixel text-[#22c55e] text-xs glow-green">WIN!</span>
                      ) : (
                        <span className="font-pixel text-[#ef4444] text-xs">MISS</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Results Grid */}
                <div className="space-y-1">
                  <p className="font-pixel text-[#666] text-[10px]">FINAL RESULTS</p>
                  {round.tokenOptions
                    .sort((a, b) => (round.settlementData?.priceChanges?.[b.mint] || 0) - (round.settlementData?.priceChanges?.[a.mint] || 0))
                    .map((token, i) => {
                      const change = round.settlementData?.priceChanges?.[token.mint] || 0;
                      const isWinner = token.mint === round.winningTokenMint;
                      return (
                        <div key={token.mint} className={`flex items-center gap-2 p-2 rpg-border-inner ${isWinner ? "bg-[#166534]/10" : "bg-[#1a1a1a]"}`}>
                          <span className="font-pixel text-[#666] text-[10px] w-4">{i + 1}</span>
                          {token.imageUrl ? (
                            <img src={token.imageUrl} alt="" className="w-6 h-6 pixelated" />
                          ) : (
                            <div className="w-6 h-6 rpg-border-inner bg-[#6b21a8] flex items-center justify-center">
                              <span className="font-pixel text-white text-[8px]">{token.symbol.slice(0, 2)}</span>
                            </div>
                          )}
                          <span className="font-pixel text-white text-xs flex-1">{token.symbol}</span>
                          <span className={`font-pixel text-xs ${change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                          </span>
                          {isWinner && <span className="font-pixel text-[#fbbf24] text-[10px] animate-pulse">★</span>}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* User Prediction Status */}
                {round.userPrediction ? (
                  <div className="rpg-border-inner bg-[#6b21a8]/20 p-4 text-center animate-[glow-pulse_2s_ease-in-out_infinite]">
                    <p className="font-pixel text-[#a855f7] text-[10px] mb-1">PREDICTION LOCKED</p>
                    <p className="font-pixel text-white text-lg glow-text">
                      {round.tokenOptions.find((t) => t.mint === round.userPrediction?.tokenMint)?.symbol}
                    </p>
                    <p className="font-pixel text-[#666] text-[10px] mt-2">Awaiting resolution...</p>
                  </div>
                ) : !round.canEnter ? (
                  <div className="rpg-border-inner bg-[#854d0e]/20 p-3 text-center">
                    <p className="font-pixel text-[#fbbf24] text-xs">ENTRIES CLOSED</p>
                    <p className="font-pixel text-[#666] text-[10px] mt-1">Market resolving soon</p>
                  </div>
                ) : (
                  <div className="rpg-border-inner bg-[#1a1a1a] p-2">
                    <p className="font-pixel text-[#a855f7] text-[10px] text-center glow-text">SELECT YOUR CHAMPION</p>
                  </div>
                )}

                {/* Market Question */}
                <div className="rpg-border-inner bg-[#1a1a2e] p-3">
                  <p className="font-pixel text-white text-xs text-center">
                    Which token gains the most in 24h?
                  </p>
                  <div className="flex justify-center gap-4 mt-2">
                    <span className="font-pixel text-[#a855f7] text-[10px]">{round.entryCount} seers</span>
                    <span className="font-pixel text-[#4c1d95] text-[10px]">|</span>
                    <span className="font-pixel text-[#a855f7] text-[10px]">Free entry</span>
                  </div>
                </div>

                {/* Token Options */}
                <div className="space-y-2">
                  {round.tokenOptions.map((token) => {
                    const probability = getTokenProbability(token.mint);
                    const predictions = round.predictionCounts?.[token.mint] || 0;
                    const isSelected = selectedToken === token.mint;
                    const isUserPick = round.userPrediction?.tokenMint === token.mint;

                    return (
                      <button
                        key={token.mint}
                        onClick={() => !round.userPrediction && round.canEnter && setSelectedToken(token.mint)}
                        disabled={!!round.userPrediction || !round.canEnter}
                        className={`w-full text-left transition-all ${
                          isSelected
                            ? "rpg-border bg-[#6b21a8]/20 animate-[glow-pulse_1s_ease-in-out_infinite]"
                            : isUserPick
                              ? "rpg-border-inner bg-[#6b21a8]/10"
                              : "rpg-border-inner bg-[#1a1a1a] hover:bg-[#1a1a2e]"
                        } ${round.userPrediction || !round.canEnter ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <div className="p-3">
                          <div className="flex items-center gap-3">
                            {token.imageUrl ? (
                              <img src={token.imageUrl} alt="" className="w-8 h-8 pixelated" />
                            ) : (
                              <div className="w-8 h-8 rpg-border-inner bg-[#6b21a8] flex items-center justify-center">
                                <span className="font-pixel text-white text-[10px]">{token.symbol.slice(0, 3)}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-pixel text-white text-sm">{token.symbol}</span>
                                <span className={`font-pixel text-sm ${isSelected ? "text-[#c084fc] glow-text" : "text-[#a855f7]"}`}>
                                  {probability.toFixed(0)}%
                                </span>
                              </div>
                              <p className="font-pixel text-[#666] text-[10px] truncate">{token.name}</p>
                            </div>
                          </div>

                          {/* Probability Bar - Pixel style */}
                          <div className="mt-2 h-3 bg-[#0a0a0a] rpg-border-inner relative overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#6b21a8] to-[#a855f7] transition-all relative"
                              style={{ width: `${probability}%` }}
                            >
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(255,255,255,0.1)_4px,rgba(255,255,255,0.1)_8px)]" />
                            </div>
                          </div>

                          <div className="flex justify-between mt-1">
                            <span className="font-pixel text-[#666] text-[10px]">
                              {predictions} prediction{predictions !== 1 ? "s" : ""}
                            </span>
                            <span className="font-pixel text-[#666] text-[10px]">
                              ${token.startPrice > 0 ? token.startPrice.toFixed(6) : "N/A"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Submit Button */}
                {!round.userPrediction && round.canEnter && (
                  connected ? (
                    <button
                      onClick={handleSubmitPrediction}
                      disabled={!selectedToken || isSubmitting}
                      className={`w-full font-pixel text-sm py-3 rpg-button ${
                        selectedToken ? "glow-text" : ""
                      }`}
                    >
                      {isSubmitting
                        ? "CONSULTING..."
                        : selectedToken
                          ? `PREDICT ${round.tokenOptions.find((t) => t.mint === selectedToken)?.symbol}`
                          : "SELECT TOKEN"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setWalletModalVisible(true)}
                      className="w-full font-pixel text-sm py-3 rpg-button glow-text"
                    >
                      CONNECT WALLET TO PREDICT
                    </button>
                  )
                )}

                {message && (
                  <p className={`font-pixel text-xs text-center ${message.includes("locked") || message.includes("success") ? "text-[#22c55e] glow-green" : "text-[#ef4444]"}`}>
                    {message}
                  </p>
                )}

                {/* Token Gate Error */}
                {tokenGateError && (
                  <div className="rpg-border-inner bg-[#7f1d1d]/20 p-4">
                    <p className="font-pixel text-[#ef4444] text-xs mb-2">TOKEN GATE</p>
                    <p className="font-pixel text-[#888] text-[10px] mb-3">{tokenGateError.message}</p>
                    <div className="rpg-border-inner bg-[#1a1a1a] p-2 mb-3">
                      <div className="flex justify-between font-pixel text-[10px]">
                        <span className="text-[#666]">Your Balance:</span>
                        <span className="text-white">{tokenGateError.balance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-pixel text-[10px]">
                        <span className="text-[#666]">Required:</span>
                        <span className="text-[#ef4444]">{tokenGateError.required.toLocaleString()}</span>
                      </div>
                    </div>
                    <a
                      href={tokenGateError.buyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full font-pixel text-xs py-2 text-center rpg-button"
                    >
                      BUY {tokenGateError.symbol}
                    </a>
                    <button
                      onClick={() => setTokenGateError(null)}
                      className="w-full mt-2 font-pixel text-[10px] text-[#666] hover:text-[#a855f7]"
                    >
                      [DISMISS]
                    </button>
                  </div>
                )}

                {/* Info Box */}
                <div className="rpg-border-inner bg-[#1a1a1a] p-3 mt-2">
                  <p className="font-pixel text-[#a855f7] text-[10px] mb-2 glow-text">HOW IT WORKS</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-start gap-1">
                      <span className="text-[#a855f7]">◆</span>
                      <span className="font-pixel text-[#888]">Free entry, 1 per wallet</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-[#a855f7]">◆</span>
                      <span className="font-pixel text-[#888]">Winner = most % gain</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-[#a855f7]">◆</span>
                      <span className="font-pixel text-[#888]">24h duration</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-[#a855f7]">◆</span>
                      <span className="font-pixel text-[#888]">Entries close 2h early</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : view === "leaders" ? (
            <div className="space-y-3">
              {/* User Stats */}
              {userStats && (
                <div className="rpg-border-inner bg-[#6b21a8]/20 p-3 animate-[glow-pulse_2s_ease-in-out_infinite]">
                  <div className="flex justify-between items-center">
                    <span className="font-pixel text-[#a855f7] text-xs glow-text">YOUR RANK</span>
                    <span className="font-pixel text-white text-lg glow-text">#{userStats.rank}</span>
                  </div>
                  <p className="font-pixel text-[#666] text-[10px] mt-1">{userStats.wins} win{userStats.wins !== 1 ? "s" : ""}</p>
                </div>
              )}

              {/* Leaderboard */}
              <div className="rpg-border-inner bg-[#1a1a1a]">
                <div className="border-b-2 border-[#4c1d95] px-3 py-2 bg-gradient-to-r from-[#1a1a2e] to-[#0d0d0d]">
                  <p className="font-pixel text-[#a855f7] text-[10px] glow-text">TOP ORACLES</p>
                </div>
                {leaderboard.length === 0 ? (
                  <div className="p-6 text-center">
                    <CrystalBall />
                    <p className="font-pixel text-[#666] text-xs mt-4">NO PREDICTIONS YET</p>
                    <p className="font-pixel text-[#444] text-[10px] mt-1">Be the first to win!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#2e1065]">
                    {leaderboard.map((entry) => (
                      <div key={entry.wallet} className={`flex items-center gap-3 p-3 ${entry.rank <= 3 ? "bg-[#1a1a2e]/50" : ""}`}>
                        <div className={`w-7 h-7 rpg-border-inner flex items-center justify-center font-pixel text-xs ${
                          entry.rank === 1 ? "bg-gradient-to-b from-[#fbbf24] to-[#b45309] text-black" :
                          entry.rank === 2 ? "bg-gradient-to-b from-[#9ca3af] to-[#6b7280] text-black" :
                          entry.rank === 3 ? "bg-gradient-to-b from-[#cd7f32] to-[#92400e] text-black" :
                          "bg-[#2a2a2a] text-[#666]"
                        }`}>
                          {entry.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-pixel text-white text-xs">{entry.walletShort}</p>
                          <p className="font-pixel text-[#666] text-[10px]">{entry.totalPredictions} predictions</p>
                        </div>
                        <div className="text-right">
                          <p className="font-pixel text-[#22c55e] text-sm glow-green">{entry.wins}</p>
                          <p className="font-pixel text-[#666] text-[10px]">{entry.winRate}% win</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={fetchLeaderboard}
                className="w-full font-pixel text-[10px] py-2 rpg-button"
              >
                REFRESH
              </button>
            </div>
          ) : view === "history" ? (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="rpg-border-inner bg-[#1a1a1a] p-6 text-center">
                  <CrystalBall />
                  <p className="font-pixel text-[#666] text-xs mt-4">NO PAST MARKETS</p>
                  <p className="font-pixel text-[#444] text-[10px] mt-1">History awaits...</p>
                </div>
              ) : (
                history.map((pastRound) => (
                  <div key={pastRound.id} className="rpg-border-inner bg-[#1a1a1a]">
                    <div className="flex items-center justify-between p-3 border-b-2 border-[#2e1065] bg-gradient-to-r from-[#1a1a2e] to-transparent">
                      <div>
                        <span className="font-pixel text-[#a855f7] text-[10px]">ROUND #{pastRound.id}</span>
                        <span className="font-pixel text-[#444] text-[10px] ml-2">
                          {new Date(pastRound.endTime).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`font-pixel text-[10px] px-2 py-0.5 rpg-border-inner ${
                        pastRound.status === "settled"
                          ? "bg-[#166534]/20 text-[#22c55e]"
                          : "bg-[#1a1a1a] text-[#666]"
                      }`}>
                        {pastRound.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="p-3">
                      {pastRound.winner && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-pixel text-[#fbbf24] text-xs animate-pulse">★</span>
                          <span className="font-pixel text-white text-sm">{pastRound.winner.symbol}</span>
                          <span className="font-pixel text-[#22c55e] text-xs glow-green">+{pastRound.winner.priceChange.toFixed(2)}%</span>
                        </div>
                      )}

                      {pastRound.userPrediction && (
                        <div className={`font-pixel text-[10px] p-2 rpg-border-inner ${
                          pastRound.userPrediction.isWinner
                            ? "bg-[#166534]/10 text-[#22c55e]"
                            : "bg-[#1a1a2e] text-[#666]"
                        }`}>
                          You: {pastRound.tokenOptions.find((t) => t.mint === pastRound.userPrediction?.tokenMint)?.symbol}
                          {pastRound.userPrediction.isWinner && " - WIN!"}
                        </div>
                      )}

                      <p className="font-pixel text-[#444] text-[10px] mt-2">
                        {pastRound.entryCount} seer{pastRound.entryCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rpg-border-inner bg-[#166534]/10 p-4">
                <p className="font-pixel text-[#22c55e] text-xs mb-3 glow-green">ADMIN CONTROLS</p>

                {round?.status === "active" ? (
                  <div className="space-y-3">
                    <div className="rpg-border-inner bg-[#1a1a1a] p-3">
                      <div className="grid grid-cols-2 gap-2 font-pixel text-[10px]">
                        <div>
                          <span className="text-[#666]">Round</span>
                          <span className="text-white ml-2">#{round.id}</span>
                        </div>
                        <div>
                          <span className="text-[#666]">Entries</span>
                          <span className="text-white ml-2">{round.entryCount}</span>
                        </div>
                        <div>
                          <span className="text-[#666]">Time Left</span>
                          <span className="text-[#22c55e] ml-2 glow-green">{formatTimeRemaining(countdown)}</span>
                        </div>
                        <div>
                          <span className="text-[#666]">Tokens</span>
                          <span className="text-white ml-2">{round.tokenOptions.length}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSettleRound}
                      disabled={isSettling}
                      className="w-full font-pixel text-xs py-3 rpg-button !bg-gradient-to-b !from-[#854d0e] !to-[#713f12]"
                    >
                      {isSettling ? "SETTLING..." : "SETTLE NOW"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateRound}
                    disabled={isCreatingRound}
                    className="w-full font-pixel text-xs py-3 rpg-button !bg-gradient-to-b !from-[#166534] !to-[#14532d]"
                  >
                    {isCreatingRound ? "CREATING..." : "CREATE 24H ROUND"}
                  </button>
                )}

                {message && (
                  <p className="font-pixel text-[#fbbf24] text-xs text-center mt-2">{message}</p>
                )}
              </div>

              <div className="rpg-border-inner bg-[#1a1a1a] p-3">
                <p className="font-pixel text-[#a855f7] text-[10px] mb-2 glow-text">ROUND FLOW</p>
                <div className="space-y-1 font-pixel text-[10px] text-[#888]">
                  <p>1. Create round - auto-fetches top tokens</p>
                  <p>2. Users predict for 22 hours</p>
                  <p>3. Entries close 2h before end</p>
                  <p>4. Settle - determine winner by % gain</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative shrink-0">
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#6b21a8] via-[#a855f7] to-[#6b21a8]">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]" />
          </div>
          <div className="px-4 py-2 flex items-center justify-between bg-gradient-to-b from-[#1a1a2e] to-[#0d0d0d]">
            <span className="font-pixel text-[#4c1d95] text-[10px]">Token-gated | Bragging rights</span>
            <button onClick={fetchRound} className="font-pixel text-[10px] rpg-button px-2 py-1">
              REFRESH
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
