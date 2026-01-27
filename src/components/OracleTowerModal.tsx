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
  if (ms <= 0) return "Ended";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
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

  // Admin states
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const { publicKey, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { isAdmin } = useAdminCheck();

  // Fetch current round
  const fetchRound = useCallback(async () => {
    setIsLoading(true);
    const walletParam = publicKey ? `?wallet=${publicKey.toString()}` : "";
    const res = await fetch(`/api/oracle/current${walletParam}`);
    const data = await res.json();
    setRound(data);
    setCountdown(data.remainingMs || 0);
    setIsLoading(false);
  }, [publicKey]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    const walletParam = publicKey ? `?wallet=${publicKey.toString()}&limit=10` : "?limit=10";
    const res = await fetch(`/api/oracle/history${walletParam}`);
    const data = await res.json();
    setHistory(data.rounds || []);
  }, [publicKey]);

  useEffect(() => {
    fetchRound();
    if (view === "history") {
      fetchHistory();
    }
  }, [fetchRound, fetchHistory, view]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-refresh every 30s
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
      body: JSON.stringify({
        wallet: publicKey.toString(),
        tokenMint: selectedToken,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage("Prediction submitted!");
      setSelectedToken(null);
      await fetchRound();
    } else {
      setMessage(data.error || "Failed to submit prediction");
    }

    setIsSubmitting(false);
  };

  const handleCreateRound = async () => {
    if (!publicKey || isCreatingRound) return;

    setIsCreatingRound(true);
    const res = await fetch("/api/oracle/admin/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminWallet: publicKey.toString(),
        durationHours: 24,
      }),
    });

    const data = await res.json();
    if (data.success) {
      setMessage("Round created!");
      await fetchRound();
    } else {
      setMessage(data.error || "Failed to create round");
    }
    setIsCreatingRound(false);
  };

  const handleSettleRound = async () => {
    if (!publicKey || isSettling) return;

    setIsSettling(true);
    const res = await fetch("/api/oracle/admin/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminWallet: publicKey.toString(),
      }),
    });

    const data = await res.json();
    if (data.success) {
      setMessage(`Round settled! Winner: ${data.winner?.symbol} (+${data.winner?.priceChange?.toFixed(2)}%)`);
      await fetchRound();
    } else {
      setMessage(data.error || "Failed to settle round");
    }
    setIsSettling(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Token selection card
  const TokenCard = ({
    token,
    isSelected,
    onClick,
    predictionCount,
    isWinner,
    priceChange,
  }: {
    token: TokenOption;
    isSelected: boolean;
    onClick: () => void;
    predictionCount?: number;
    isWinner?: boolean;
    priceChange?: number;
  }) => (
    <button
      onClick={onClick}
      className={`
        w-full p-3 rounded-xl border transition-all
        ${isSelected
          ? "border-purple-500 bg-purple-500/20"
          : isWinner
            ? "border-green-500 bg-green-500/10"
            : "border-gray-700/50 bg-gray-900/50 hover:border-purple-500/50"}
      `}
    >
      <div className="flex items-center gap-3">
        {token.imageUrl ? (
          <img
            src={token.imageUrl}
            alt={token.symbol}
            className="w-10 h-10 rounded-lg"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
            <span className="font-pixel text-xs text-white">
              {token.symbol.slice(0, 3)}
            </span>
          </div>
        )}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-sm text-white">{token.symbol}</span>
            {isWinner && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                WINNER
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs truncate">{token.name}</p>
        </div>
        <div className="text-right">
          {priceChange !== undefined ? (
            <p
              className={`font-pixel text-sm ${priceChange >= 0 ? "text-green-400" : "text-red-400"}`}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </p>
          ) : (
            <p className="text-gray-400 text-xs">
              ${token.startPrice > 0 ? token.startPrice.toFixed(6) : "N/A"}
            </p>
          )}
          {predictionCount !== undefined && predictionCount > 0 && (
            <p className="text-purple-400/70 text-[10px]">
              {predictionCount} predict{predictionCount !== 1 ? "ions" : "ion"}
            </p>
          )}
        </div>
      </div>
    </button>
  );

  // Wallet not connected
  if (!connected) {
    return (
      <div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-[#0a0a0f] border border-purple-500/50 rounded-2xl max-w-md w-full overflow-hidden">
          <div className="bg-gradient-to-r from-purple-900/60 to-purple-800/40 p-6 border-b border-purple-500/30">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-4xl">&#128302;</span>
              <h2 className="font-pixel text-xl text-purple-400 tracking-wider">
                ORACLE&apos;S TOWER
              </h2>
            </div>
            <p className="text-center text-purple-300/80 text-sm">
              Connect wallet to make predictions
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center border-4 border-purple-400/50 shadow-lg shadow-purple-500/30">
                <span className="text-3xl">&#128302;</span>
              </div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <p className="text-purple-400/90 text-[11px] text-center leading-relaxed">
                Predict which token will perform best over 24 hours.
                Free entry - bragging rights to the winners!
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-pixel text-xs transition-colors border border-gray-700"
              >
                EXIT
              </button>
              <button
                onClick={() => setWalletModalVisible(true)}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg font-pixel text-xs transition-all shadow-lg shadow-purple-500/20 border border-purple-500/50"
              >
                CONNECT WALLET
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gradient-to-b from-[#12061f] via-[#0a0a12] to-[#080810] border border-purple-500/20 rounded-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-900/30">
        {/* Decorative top border glow */}
        <div className="h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        {/* Header */}
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl" />
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-cyan-600/10 rounded-full blur-3xl" />
          </div>

          <div className="relative flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 via-purple-600 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/40 border border-purple-400/30">
                  <span className="text-2xl">&#128302;</span>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping opacity-75" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full" />
              </div>
              <div>
                <h2 className="font-pixel text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-cyan-300 to-purple-300 tracking-wider">
                  ORACLE&apos;S TOWER
                </h2>
                {round?.status === "active" && countdown > 0 && (
                  <p className="text-purple-400/70 text-xs sm:text-sm mt-1 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                    {formatTimeRemaining(countdown)} remaining
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-purple-500/10 px-4">
          <button
            onClick={() => setView("predict")}
            className={`flex-1 py-3 font-pixel text-[10px] tracking-wide transition-all ${
              view === "predict"
                ? "text-purple-400 border-b-2 border-purple-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            PREDICT
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex-1 py-3 font-pixel text-[10px] tracking-wide transition-all ${
              view === "history"
                ? "text-purple-400 border-b-2 border-purple-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            HISTORY
          </button>
          {isAdmin && (
            <button
              onClick={() => setView("admin")}
              className={`flex-1 py-3 font-pixel text-[10px] tracking-wide transition-all ${
                view === "admin"
                  ? "text-green-400 border-b-2 border-green-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              ADMIN
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center animate-pulse">
                <span className="text-xl">&#128302;</span>
              </div>
              <p className="text-purple-400 font-pixel text-sm mt-4">Loading...</p>
            </div>
          ) : view === "predict" ? (
            round?.status === "none" || !round ? (
              // No active round
              <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <span className="text-2xl text-gray-500">&#128302;</span>
                </div>
                <h3 className="font-pixel text-lg text-gray-400 mb-2">No Active Round</h3>
                <p className="text-gray-500 text-sm">
                  {round?.message || "Check back soon for the next prediction round!"}
                </p>
              </div>
            ) : round.status === "settled" ? (
              // Settled round - show results
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-green-900/30 to-cyan-900/20 border border-green-500/30 rounded-xl p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                    <span className="text-2xl">&#127942;</span>
                  </div>
                  <h3 className="font-pixel text-lg text-green-400 mb-2">ROUND COMPLETE!</h3>
                  <p className="text-gray-400 text-sm mb-4">Winner determined by highest % gain</p>

                  {round.userPrediction && (
                    <div className="bg-black/30 rounded-lg p-3 mb-4">
                      <p className="text-gray-500 text-xs mb-1">Your Prediction</p>
                      <p className="font-pixel text-white">
                        {round.tokenOptions.find((t) => t.mint === round.userPrediction?.tokenMint)?.symbol || "Unknown"}
                      </p>
                      {round.userPrediction.tokenMint === round.winningTokenMint ? (
                        <p className="text-green-400 text-xs mt-1 animate-pulse">
                          You won! Congratulations!
                        </p>
                      ) : (
                        <p className="text-gray-500 text-xs mt-1">Better luck next time!</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Results</p>
                  {round.tokenOptions
                    .sort((a, b) => {
                      const changeA = round.settlementData?.priceChanges?.[a.mint] || 0;
                      const changeB = round.settlementData?.priceChanges?.[b.mint] || 0;
                      return changeB - changeA;
                    })
                    .map((token) => (
                      <TokenCard
                        key={token.mint}
                        token={token}
                        isSelected={false}
                        onClick={() => {}}
                        isWinner={token.mint === round.winningTokenMint}
                        priceChange={round.settlementData?.priceChanges?.[token.mint]}
                      />
                    ))}
                </div>
              </div>
            ) : (
              // Active round - make prediction
              <div className="space-y-4">
                {round.userPrediction ? (
                  // Already predicted
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-purple-400 text-lg">&#10003;</span>
                      <p className="font-pixel text-purple-400">PREDICTION LOCKED</p>
                    </div>
                    <p className="text-gray-400 text-xs mb-2">
                      You predicted:
                    </p>
                    <p className="font-pixel text-white text-lg">
                      {round.tokenOptions.find((t) => t.mint === round.userPrediction?.tokenMint)?.symbol || "Unknown"}
                    </p>
                    <p className="text-gray-500 text-[10px] mt-2">
                      Results will be announced when the round ends
                    </p>
                  </div>
                ) : !round.canEnter ? (
                  // Entry deadline passed
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                    <p className="font-pixel text-yellow-400 mb-2">ENTRIES CLOSED</p>
                    <p className="text-gray-400 text-xs">
                      Entry deadline has passed. Results coming soon!
                    </p>
                  </div>
                ) : (
                  // Can still predict
                  <>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                      <p className="text-purple-400/90 text-xs text-center">
                        Pick the token you think will gain the most over 24 hours
                      </p>
                    </div>

                    <div className="space-y-2">
                      {round.tokenOptions.map((token) => (
                        <TokenCard
                          key={token.mint}
                          token={token}
                          isSelected={selectedToken === token.mint}
                          onClick={() => setSelectedToken(token.mint)}
                          predictionCount={round.predictionCounts?.[token.mint]}
                        />
                      ))}
                    </div>

                    <button
                      onClick={handleSubmitPrediction}
                      disabled={!selectedToken || isSubmitting}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-pixel text-sm transition-all shadow-lg shadow-purple-500/20 border border-purple-500/50"
                    >
                      {isSubmitting
                        ? "SUBMITTING..."
                        : selectedToken
                          ? `PREDICT ${round.tokenOptions.find((t) => t.mint === selectedToken)?.symbol || ""}`
                          : "SELECT A TOKEN"}
                    </button>
                  </>
                )}

                {message && (
                  <p
                    className={`text-center text-sm ${message.includes("submitted") || message.includes("success") ? "text-green-400" : "text-red-400"}`}
                  >
                    {message}
                  </p>
                )}

                {/* Round Info */}
                <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-4 mt-4">
                  <h4 className="font-pixel text-xs text-gray-400 mb-2">HOW IT WORKS</h4>
                  <ul className="text-gray-500 text-[11px] space-y-1">
                    <li>&#8226; Free entry - one prediction per wallet per round</li>
                    <li>&#8226; Pick the token you think will gain the most</li>
                    <li>&#8226; Winner determined by highest % price change</li>
                    <li>&#8226; Entries close 2 hours before round ends</li>
                  </ul>
                </div>
              </div>
            )
          ) : view === "history" ? (
            // History view
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-6 text-center">
                  <p className="text-gray-500">No past rounds yet</p>
                </div>
              ) : (
                history.map((pastRound) => (
                  <div
                    key={pastRound.id}
                    className="bg-gray-900/30 border border-gray-700/30 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-pixel text-xs text-gray-400">
                          Round #{pastRound.id}
                        </p>
                        <p className="text-gray-600 text-[10px]">
                          {new Date(pastRound.endTime).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full ${
                          pastRound.status === "settled"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {pastRound.status.toUpperCase()}
                      </span>
                    </div>

                    {pastRound.winner && (
                      <div className="flex items-center gap-2 bg-green-500/10 rounded-lg p-2 mb-3">
                        <span className="text-green-400 text-sm">&#127942;</span>
                        <span className="font-pixel text-green-400 text-sm">
                          {pastRound.winner.symbol}
                        </span>
                        <span className="text-green-400/70 text-xs">
                          +{pastRound.winner.priceChange.toFixed(2)}%
                        </span>
                      </div>
                    )}

                    {pastRound.userPrediction && (
                      <div
                        className={`text-xs p-2 rounded-lg ${
                          pastRound.userPrediction.isWinner
                            ? "bg-green-500/10 text-green-400"
                            : "bg-gray-700/30 text-gray-400"
                        }`}
                      >
                        Your pick:{" "}
                        {pastRound.tokenOptions.find(
                          (t) => t.mint === pastRound.userPrediction?.tokenMint
                        )?.symbol || "Unknown"}{" "}
                        {pastRound.userPrediction.isWinner && "- Winner!"}
                      </div>
                    )}

                    <p className="text-gray-600 text-[10px] mt-2">
                      {pastRound.entryCount} participant{pastRound.entryCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            // Admin view
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <h3 className="font-pixel text-sm text-green-400 mb-3">Admin Controls</h3>

                {round?.status === "active" ? (
                  <div className="space-y-3">
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Active Round #{round.id}</p>
                      <p className="text-white font-pixel">
                        {round.entryCount} entries | {formatTimeRemaining(countdown)} left
                      </p>
                    </div>

                    <button
                      onClick={handleSettleRound}
                      disabled={isSettling}
                      className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white rounded-lg font-pixel text-xs transition-all"
                    >
                      {isSettling ? "SETTLING..." : "SETTLE ROUND NOW"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateRound}
                    disabled={isCreatingRound}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg font-pixel text-xs transition-all"
                  >
                    {isCreatingRound ? "CREATING..." : "CREATE 24H ROUND"}
                  </button>
                )}
              </div>

              {message && (
                <p className="text-center text-sm text-yellow-400">{message}</p>
              )}

              <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-4">
                <h4 className="font-pixel text-xs text-gray-400 mb-2">ROUND FLOW</h4>
                <ul className="text-gray-500 text-[11px] space-y-1">
                  <li>1. Create round - fetches top 5 tokens with prices</li>
                  <li>2. Users predict for 22 hours</li>
                  <li>3. Entries close 2 hours before end</li>
                  <li>4. Admin settles - fetches end prices, picks winner</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-purple-500/10 bg-black/20">
          <div className="flex items-center justify-between">
            <p className="text-gray-600 text-[10px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
              Free entry - bragging rights only
            </p>
            <button
              onClick={fetchRound}
              className="text-purple-400 hover:text-purple-300 text-[10px] transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
