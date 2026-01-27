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

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function OracleTowerModal({ onClose }: OracleTowerModalProps) {
  const [view, setView] = useState<"predict" | "history" | "admin">("predict");
  const [round, setRound] = useState<OracleRoundData | null>(null);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

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

  useEffect(() => {
    fetchRound();
    if (view === "history") fetchHistory();
  }, [fetchRound, fetchHistory, view]);

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

  // Calculate probability distribution
  const getTotalPredictions = () => {
    if (!round?.predictionCounts) return 0;
    return Object.values(round.predictionCounts).reduce((a, b) => a + b, 0);
  };

  const getTokenProbability = (mint: string) => {
    const total = getTotalPredictions();
    if (total === 0) return round?.tokenOptions?.length ? 100 / round.tokenOptions.length : 20;
    return ((round?.predictionCounts?.[mint] || 0) / total) * 100;
  };

  // Wallet not connected
  if (!connected) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-[#0d0d0d] border-2 border-[#2a2a2a] w-full max-w-md">
          {/* Pixel Header Bar */}
          <div className="bg-[#1a1a2e] border-b-2 border-[#2a2a2a] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#6b21a8] flex items-center justify-center">
                <span className="text-white text-xs">&#9650;</span>
              </div>
              <span className="font-pixel text-[#a855f7] text-sm">ORACLE</span>
            </div>
            <button onClick={onClose} className="font-pixel text-[#666] hover:text-white text-xs">[X]</button>
          </div>

          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#1a1a2e] border-2 border-[#6b21a8] flex items-center justify-center">
                <span className="font-pixel text-[#a855f7] text-2xl">?</span>
              </div>
              <p className="font-pixel text-[#888] text-xs">CONNECT WALLET TO PREDICT</p>
            </div>

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-3">
              <p className="font-pixel text-[#666] text-[10px] text-center leading-relaxed">
                Predict which token gains most in 24h. Free entry. Bragging rights to winners.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="font-pixel text-xs py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#444] transition-colors">
                CANCEL
              </button>
              <button onClick={() => setWalletModalVisible(true)} className="font-pixel text-xs py-3 bg-[#6b21a8] border border-[#7c3aed] text-white hover:bg-[#7c3aed] transition-colors">
                CONNECT
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0d0d0d] border-2 border-[#2a2a2a] w-full max-w-lg max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#1a1a2e] border-b-2 border-[#2a2a2a] px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#6b21a8] border border-[#7c3aed] flex items-center justify-center">
              <span className="text-white text-sm">&#9650;</span>
            </div>
            <div>
              <span className="font-pixel text-[#a855f7] text-sm block">ORACLE MARKET</span>
              {round?.status === "active" && countdown > 0 && (
                <span className="font-pixel text-[#22c55e] text-[10px]">{formatTimeRemaining(countdown)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {round?.status === "active" && (
              <span className="font-pixel text-[10px] px-2 py-1 bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30">LIVE</span>
            )}
            <button onClick={onClose} className="font-pixel text-[#666] hover:text-white text-xs">[X]</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-[#2a2a2a] shrink-0">
          {["predict", "history", ...(isAdmin ? ["admin"] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab as typeof view)}
              className={`flex-1 font-pixel text-[10px] py-2 border-r border-[#2a2a2a] last:border-r-0 transition-colors ${
                view === tab
                  ? tab === "admin" ? "bg-[#166534] text-[#22c55e]" : "bg-[#1a1a2e] text-[#a855f7]"
                  : "bg-[#0d0d0d] text-[#666] hover:text-[#888]"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 bg-[#1a1a2e] border border-[#6b21a8] flex items-center justify-center animate-pulse">
                <span className="font-pixel text-[#a855f7]">...</span>
              </div>
            </div>
          ) : view === "predict" ? (
            round?.status === "none" || !round ? (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-[#1a1a2e] border border-[#2a2a2a] flex items-center justify-center">
                  <span className="font-pixel text-[#444] text-lg">-</span>
                </div>
                <p className="font-pixel text-[#666] text-xs">NO ACTIVE MARKET</p>
                <p className="font-pixel text-[#444] text-[10px] mt-2">{round?.message || "Check back soon"}</p>
              </div>
            ) : round.status === "settled" ? (
              <div className="space-y-3">
                {/* Winner Banner */}
                <div className="bg-[#166534]/20 border-2 border-[#22c55e]/50 p-4 text-center">
                  <p className="font-pixel text-[#22c55e] text-xs mb-1">MARKET RESOLVED</p>
                  <p className="font-pixel text-white text-lg">
                    {round.tokenOptions.find((t) => t.mint === round.winningTokenMint)?.symbol || "?"}
                  </p>
                  <p className="font-pixel text-[#22c55e] text-sm">
                    +{round.winningPriceChange?.toFixed(2)}%
                  </p>
                </div>

                {/* User Result */}
                {round.userPrediction && (
                  <div className={`border p-3 ${
                    round.userPrediction.tokenMint === round.winningTokenMint
                      ? "bg-[#166534]/10 border-[#22c55e]/30"
                      : "bg-[#1a1a1a] border-[#2a2a2a]"
                  }`}>
                    <p className="font-pixel text-[#666] text-[10px]">YOUR PREDICTION</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-pixel text-white text-sm">
                        {round.tokenOptions.find((t) => t.mint === round.userPrediction?.tokenMint)?.symbol}
                      </span>
                      {round.userPrediction.tokenMint === round.winningTokenMint ? (
                        <span className="font-pixel text-[#22c55e] text-xs">WIN</span>
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
                        <div key={token.mint} className={`flex items-center gap-2 p-2 border ${isWinner ? "bg-[#166534]/10 border-[#22c55e]/30" : "bg-[#1a1a1a] border-[#2a2a2a]"}`}>
                          <span className="font-pixel text-[#666] text-[10px] w-4">{i + 1}</span>
                          {token.imageUrl ? (
                            <img src={token.imageUrl} alt="" className="w-6 h-6" />
                          ) : (
                            <div className="w-6 h-6 bg-[#6b21a8] flex items-center justify-center">
                              <span className="font-pixel text-white text-[8px]">{token.symbol.slice(0, 2)}</span>
                            </div>
                          )}
                          <span className="font-pixel text-white text-xs flex-1">{token.symbol}</span>
                          <span className={`font-pixel text-xs ${change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                          </span>
                          {isWinner && <span className="font-pixel text-[#fbbf24] text-[10px]">&#9733;</span>}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* User Prediction Status */}
                {round.userPrediction ? (
                  <div className="bg-[#6b21a8]/20 border-2 border-[#7c3aed]/50 p-4 text-center">
                    <p className="font-pixel text-[#a855f7] text-[10px] mb-1">PREDICTION LOCKED</p>
                    <p className="font-pixel text-white text-lg">
                      {round.tokenOptions.find((t) => t.mint === round.userPrediction?.tokenMint)?.symbol}
                    </p>
                    <p className="font-pixel text-[#666] text-[10px] mt-2">Awaiting resolution...</p>
                  </div>
                ) : !round.canEnter ? (
                  <div className="bg-[#854d0e]/20 border border-[#fbbf24]/30 p-3 text-center">
                    <p className="font-pixel text-[#fbbf24] text-xs">ENTRIES CLOSED</p>
                    <p className="font-pixel text-[#666] text-[10px] mt-1">Market resolving soon</p>
                  </div>
                ) : (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-2">
                    <p className="font-pixel text-[#666] text-[10px] text-center">SELECT WINNER</p>
                  </div>
                )}

                {/* Market Question */}
                <div className="bg-[#1a1a2e] border border-[#2a2a2a] p-3">
                  <p className="font-pixel text-white text-xs text-center">
                    Which token gains the most in 24h?
                  </p>
                  <div className="flex justify-center gap-4 mt-2">
                    <span className="font-pixel text-[#666] text-[10px]">{round.entryCount} predictions</span>
                    <span className="font-pixel text-[#666] text-[10px]">|</span>
                    <span className="font-pixel text-[#666] text-[10px]">Free entry</span>
                  </div>
                </div>

                {/* Token Options - Polymarket Style */}
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
                        className={`w-full text-left transition-colors ${
                          isSelected
                            ? "bg-[#6b21a8]/20 border-2 border-[#7c3aed]"
                            : isUserPick
                              ? "bg-[#6b21a8]/10 border-2 border-[#6b21a8]/50"
                              : "bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#444]"
                        } ${round.userPrediction || !round.canEnter ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <div className="p-3">
                          <div className="flex items-center gap-3">
                            {token.imageUrl ? (
                              <img src={token.imageUrl} alt="" className="w-8 h-8" />
                            ) : (
                              <div className="w-8 h-8 bg-[#6b21a8] flex items-center justify-center">
                                <span className="font-pixel text-white text-[10px]">{token.symbol.slice(0, 3)}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-pixel text-white text-sm">{token.symbol}</span>
                                <span className="font-pixel text-[#a855f7] text-sm">{probability.toFixed(0)}%</span>
                              </div>
                              <p className="font-pixel text-[#666] text-[10px] truncate">{token.name}</p>
                            </div>
                          </div>

                          {/* Probability Bar */}
                          <div className="mt-2 h-2 bg-[#1a1a2e] border border-[#2a2a2a]">
                            <div
                              className="h-full bg-[#6b21a8] transition-all"
                              style={{ width: `${probability}%` }}
                            />
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
                  <button
                    onClick={handleSubmitPrediction}
                    disabled={!selectedToken || isSubmitting}
                    className={`w-full font-pixel text-sm py-3 border-2 transition-colors ${
                      selectedToken
                        ? "bg-[#6b21a8] border-[#7c3aed] text-white hover:bg-[#7c3aed]"
                        : "bg-[#1a1a1a] border-[#2a2a2a] text-[#666] cursor-not-allowed"
                    }`}
                  >
                    {isSubmitting
                      ? "SUBMITTING..."
                      : selectedToken
                        ? `PREDICT ${round.tokenOptions.find((t) => t.mint === selectedToken)?.symbol}`
                        : "SELECT TOKEN"}
                  </button>
                )}

                {message && (
                  <p className={`font-pixel text-xs text-center ${message.includes("locked") || message.includes("success") ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    {message}
                  </p>
                )}

                {/* Info Box */}
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-3 mt-2">
                  <p className="font-pixel text-[#666] text-[10px] mb-2">HOW IT WORKS</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-start gap-1">
                      <span className="text-[#6b21a8]">&#9632;</span>
                      <span className="font-pixel text-[#888]">Free entry, 1 per wallet</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-[#6b21a8]">&#9632;</span>
                      <span className="font-pixel text-[#888]">Winner = most % gain</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-[#6b21a8]">&#9632;</span>
                      <span className="font-pixel text-[#888]">24h duration</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="text-[#6b21a8]">&#9632;</span>
                      <span className="font-pixel text-[#888]">Entries close 2h early</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : view === "history" ? (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 text-center">
                  <p className="font-pixel text-[#666] text-xs">NO PAST MARKETS</p>
                </div>
              ) : (
                history.map((pastRound) => (
                  <div key={pastRound.id} className="bg-[#1a1a1a] border border-[#2a2a2a]">
                    <div className="flex items-center justify-between p-3 border-b border-[#2a2a2a]">
                      <div>
                        <span className="font-pixel text-[#666] text-[10px]">ROUND #{pastRound.id}</span>
                        <span className="font-pixel text-[#444] text-[10px] ml-2">
                          {new Date(pastRound.endTime).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`font-pixel text-[10px] px-2 py-0.5 ${
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
                          <span className="font-pixel text-[#fbbf24] text-xs">&#9733;</span>
                          <span className="font-pixel text-white text-sm">{pastRound.winner.symbol}</span>
                          <span className="font-pixel text-[#22c55e] text-xs">+{pastRound.winner.priceChange.toFixed(2)}%</span>
                        </div>
                      )}

                      {pastRound.userPrediction && (
                        <div className={`font-pixel text-[10px] p-2 ${
                          pastRound.userPrediction.isWinner
                            ? "bg-[#166534]/10 text-[#22c55e]"
                            : "bg-[#1a1a2e] text-[#666]"
                        }`}>
                          You: {pastRound.tokenOptions.find((t) => t.mint === pastRound.userPrediction?.tokenMint)?.symbol}
                          {pastRound.userPrediction.isWinner && " - WIN!"}
                        </div>
                      )}

                      <p className="font-pixel text-[#444] text-[10px] mt-2">
                        {pastRound.entryCount} participant{pastRound.entryCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-[#166534]/10 border border-[#22c55e]/30 p-4">
                <p className="font-pixel text-[#22c55e] text-xs mb-3">ADMIN CONTROLS</p>

                {round?.status === "active" ? (
                  <div className="space-y-3">
                    <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-3">
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
                          <span className="text-[#22c55e] ml-2">{formatTimeRemaining(countdown)}</span>
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
                      className="w-full font-pixel text-xs py-3 bg-[#854d0e] border border-[#fbbf24]/50 text-[#fbbf24] hover:bg-[#a16207] disabled:opacity-50 transition-colors"
                    >
                      {isSettling ? "SETTLING..." : "SETTLE NOW"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateRound}
                    disabled={isCreatingRound}
                    className="w-full font-pixel text-xs py-3 bg-[#166534] border border-[#22c55e]/50 text-[#22c55e] hover:bg-[#15803d] disabled:opacity-50 transition-colors"
                  >
                    {isCreatingRound ? "CREATING..." : "CREATE 24H ROUND"}
                  </button>
                )}

                {message && (
                  <p className="font-pixel text-[#fbbf24] text-xs text-center mt-2">{message}</p>
                )}
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-3">
                <p className="font-pixel text-[#666] text-[10px] mb-2">ROUND FLOW</p>
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
        <div className="border-t-2 border-[#2a2a2a] px-4 py-2 flex items-center justify-between shrink-0 bg-[#0d0d0d]">
          <span className="font-pixel text-[#444] text-[10px]">Free entry | Bragging rights</span>
          <button onClick={fetchRound} className="font-pixel text-[#666] hover:text-[#a855f7] text-[10px] transition-colors">
            [REFRESH]
          </button>
        </div>
      </div>
    </div>
  );
}
