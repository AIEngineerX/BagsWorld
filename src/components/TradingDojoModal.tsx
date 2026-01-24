"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DOJO_OPPONENTS,
  type DojoOpponent,
  type SparSession,
  type Belt,
  type CoachingFeedback,
  startSpar,
  getCurrentSession,
  getPlayerStats,
  playerBuy,
  playerSell,
  getCurrentPrice,
  advanceCandle,
  endSpar,
  abandonSpar,
  getCoachingFeedback,
  getBeltColor,
  getBeltIndex,
  canChallenge,
  getAvailableOpponents,
} from "@/lib/trading-dojo";

interface TradingDojoModalProps {
  onClose: () => void;
}

type View = "lobby" | "opponent-select" | "spar" | "results";

export function TradingDojoModal({ onClose }: TradingDojoModalProps) {
  const [view, setView] = useState<View>("lobby");
  const [session, setSession] = useState<SparSession | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<DojoOpponent | null>(null);
  const [playerStats, setPlayerStatsState] = useState(getPlayerStats());
  const [coaching, setCoaching] = useState<CoachingFeedback | null>(null);
  const [isLoadingCoaching, setIsLoadingCoaching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [buyAmount, setBuyAmount] = useState("1");
  const [sellPercent, setSellPercent] = useState(100);
  const [liveTokens, setLiveTokens] = useState<any[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch live tokens for spar selection
  useEffect(() => {
    fetchLiveTokens();
  }, []);

  const fetchLiveTokens = async () => {
    try {
      const res = await fetch("https://api.dexscreener.com/latest/dex/search?q=BAGS");
      if (res.ok) {
        const data = await res.json();
        const tokens = (data.pairs || [])
          .filter((p: any) => p.dexId === "bags" || p.baseToken?.address?.endsWith("BAGS"))
          .slice(0, 10)
          .map((p: any) => ({
            symbol: p.baseToken?.symbol || "???",
            mint: p.baseToken?.address,
            name: p.baseToken?.name,
            price: parseFloat(p.priceUsd) || 0,
            change24h: p.priceChange?.h24 || 0,
          }));
        setLiveTokens(tokens);
      }
    } catch (e) {
      console.error("Failed to fetch tokens:", e);
    }
  };

  // Game loop
  useEffect(() => {
    if (view === "spar" && session?.status === "active" && !isPaused) {
      intervalRef.current = setInterval(() => {
        const continued = advanceCandle();
        setSession({ ...getCurrentSession()! });

        if (!continued) {
          setView("results");
          clearInterval(intervalRef.current!);
        }
      }, 1000); // 1 second per candle

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [view, session?.status, isPaused]);

  const handleStartSpar = async (token: any) => {
    if (!selectedOpponent) return;

    const newSession = await startSpar(selectedOpponent.id, token.symbol, token.mint);
    if (newSession) {
      setSession(newSession);
      setView("spar");
      setCoaching(null);
    }
  };

  const handleBuy = () => {
    const amount = parseFloat(buyAmount);
    if (isNaN(amount) || amount <= 0) return;
    playerBuy(amount);
    setSession({ ...getCurrentSession()! });
  };

  const handleSell = () => {
    if (!session) return;
    const tokenAmount = session.playerPosition.tokenAmount * (sellPercent / 100);
    if (tokenAmount <= 0) return;
    playerSell(tokenAmount);
    setSession({ ...getCurrentSession()! });
  };

  const handleEndSpar = () => {
    endSpar();
    setSession({ ...getCurrentSession()! });
    setView("results");
  };

  const handleGetCoaching = async () => {
    if (!session) return;
    setIsLoadingCoaching(true);
    const feedback = await getCoachingFeedback(session);
    setCoaching(feedback);
    setIsLoadingCoaching(false);
  };

  const handleBackToLobby = () => {
    setSession(null);
    setSelectedOpponent(null);
    setCoaching(null);
    setPlayerStatsState(getPlayerStats());
    setView("lobby");
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (session?.status === "active") {
        abandonSpar();
      }
      onClose();
    }
  };

  const formatPrice = (price: number): string => {
    if (price < 0.0001) return price.toExponential(2);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  const formatSol = (sol: number): string => sol.toFixed(2);

  const getGradeColor = (grade: string): string => {
    const colors: Record<string, string> = {
      S: "text-yellow-400",
      A: "text-green-400",
      B: "text-blue-400",
      C: "text-gray-400",
      D: "text-orange-400",
      F: "text-red-400",
    };
    return colors[grade] || "text-gray-400";
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-950 border border-gray-800 rounded-lg max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-800 p-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-mono text-white text-lg tracking-tight">TRADING DOJO</h2>
              <p className="font-mono text-gray-500 text-xs mt-1">Adversarial AI Sparring</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Belt Display */}
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-8 rounded-sm"
                  style={{ backgroundColor: getBeltColor(playerStats.belt) }}
                />
                <span className="font-mono text-xs text-gray-400 uppercase">
                  {playerStats.belt} belt
                </span>
              </div>
              <button
                onClick={() => {
                  if (session?.status === "active") abandonSpar();
                  onClose();
                }}
                className="font-mono text-xs text-gray-500 hover:text-white transition-colors"
              >
                [ESC]
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* LOBBY VIEW */}
          {view === "lobby" && (
            <div className="p-6 space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded p-4">
                  <p className="font-mono text-gray-500 text-xs">RECORD</p>
                  <p className="font-mono text-white text-xl mt-1">
                    {playerStats.wins}-{playerStats.losses}
                    {playerStats.draws > 0 && `-${playerStats.draws}`}
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded p-4">
                  <p className="font-mono text-gray-500 text-xs">WIN RATE</p>
                  <p className="font-mono text-white text-xl mt-1">
                    {playerStats.totalSpars > 0
                      ? ((playerStats.wins / playerStats.totalSpars) * 100).toFixed(0)
                      : 0}
                    %
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded p-4">
                  <p className="font-mono text-gray-500 text-xs">TOTAL PNL</p>
                  <p
                    className={`font-mono text-xl mt-1 ${
                      playerStats.totalPnl >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {playerStats.totalPnl >= 0 ? "+" : ""}
                    {playerStats.totalPnl.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded p-4">
                  <p className="font-mono text-gray-500 text-xs">BEST STREAK</p>
                  <p className="font-mono text-white text-xl mt-1">{playerStats.bestWinStreak}</p>
                </div>
              </div>

              {/* Opponents */}
              <div>
                <h3 className="font-mono text-gray-400 text-sm mb-4">SELECT OPPONENT</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DOJO_OPPONENTS.map((opponent) => {
                    const canFight = canChallenge(playerStats.belt, opponent);
                    const record = playerStats.opponentStats[opponent.id] || {
                      wins: 0,
                      losses: 0,
                    };

                    return (
                      <button
                        key={opponent.id}
                        onClick={() => {
                          if (canFight) {
                            setSelectedOpponent(opponent);
                            setView("opponent-select");
                          }
                        }}
                        disabled={!canFight}
                        className={`text-left p-4 rounded border transition-all ${
                          canFight
                            ? "bg-gray-900 border-gray-700 hover:border-gray-500"
                            : "bg-gray-900/50 border-gray-800 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: opponent.color }}
                              />
                              <span className="font-mono text-white">{opponent.name}</span>
                              <span className="font-mono text-xs text-gray-600">
                                LV.{opponent.difficulty}
                              </span>
                            </div>
                            <p className="font-mono text-xs text-gray-500 mt-1">{opponent.style}</p>
                            <p className="font-mono text-xs text-gray-600 mt-2 leading-relaxed">
                              {opponent.description}
                            </p>
                          </div>
                          {!canFight && (
                            <span
                              className="font-mono text-xs px-2 py-1 rounded"
                              style={{
                                backgroundColor: getBeltColor(opponent.requiredBelt) + "20",
                                color: getBeltColor(opponent.requiredBelt),
                              }}
                            >
                              {opponent.requiredBelt.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {canFight && (record.wins > 0 || record.losses > 0) && (
                          <p className="font-mono text-xs text-gray-600 mt-3">
                            Record: {record.wins}W - {record.losses}L
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* OPPONENT SELECT VIEW - Token Selection */}
          {view === "opponent-select" && selectedOpponent && (
            <div className="p-6 space-y-6">
              <button
                onClick={() => setView("lobby")}
                className="font-mono text-xs text-gray-500 hover:text-white"
              >
                &larr; Back
              </button>

              <div className="flex items-center gap-4">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedOpponent.color }}
                />
                <div>
                  <h3 className="font-mono text-white text-lg">{selectedOpponent.name}</h3>
                  <p className="font-mono text-xs text-gray-500">{selectedOpponent.style}</p>
                </div>
              </div>

              <div>
                <h4 className="font-mono text-gray-400 text-sm mb-3">SELECT TOKEN TO TRADE</h4>
                {liveTokens.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {liveTokens.map((token) => (
                      <button
                        key={token.mint}
                        onClick={() => handleStartSpar(token)}
                        className="text-left p-3 bg-gray-900 border border-gray-800 rounded hover:border-gray-600 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-mono text-white">${token.symbol}</p>
                            <p className="font-mono text-xs text-gray-600 truncate max-w-[120px]">
                              {token.name}
                            </p>
                          </div>
                          <span
                            className={`font-mono text-xs ${
                              token.change24h >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {token.change24h >= 0 ? "+" : ""}
                            {token.change24h.toFixed(1)}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="font-mono text-gray-500 text-sm">Loading tokens...</p>
                )}
              </div>
            </div>
          )}

          {/* SPAR VIEW */}
          {view === "spar" && session && (
            <div className="p-4 space-y-4">
              {/* Progress Bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-600 transition-all"
                    style={{
                      width: `${(session.currentCandleIndex / session.candles.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-gray-500">
                  {session.currentCandleIndex}/{session.candles.length}
                </span>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="font-mono text-xs text-gray-400 hover:text-white px-2 py-1 border border-gray-700 rounded"
                >
                  {isPaused ? "PLAY" : "PAUSE"}
                </button>
              </div>

              {/* Price Display */}
              <div className="bg-gray-900 border border-gray-800 rounded p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-mono text-gray-500 text-xs">${session.tokenSymbol}</p>
                    <p className="font-mono text-white text-2xl">
                      ${formatPrice(getCurrentPrice() || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-gray-500 text-xs">CANDLE</p>
                    <p className="font-mono text-gray-400">{session.currentCandleIndex + 1}</p>
                  </div>
                </div>

                {/* Mini Chart - Simple price line */}
                <div className="mt-4 h-16 flex items-end gap-px">
                  {session.candles.slice(0, session.currentCandleIndex + 1).map((candle, i) => {
                    const prices = session.candles
                      .slice(0, session.currentCandleIndex + 1)
                      .map((c) => c.close);
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    const range = max - min || 1;
                    const height = ((candle.close - min) / range) * 100;
                    const isGreen = candle.close >= candle.open;

                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-t ${isGreen ? "bg-green-500" : "bg-red-500"}`}
                        style={{ height: `${Math.max(5, height)}%`, opacity: 0.7 }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Scoreboard */}
              <div className="grid grid-cols-2 gap-4">
                {/* Player */}
                <div className="bg-gray-900 border border-blue-500/30 rounded p-3">
                  <p className="font-mono text-blue-400 text-xs mb-2">YOU</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-gray-500">SOL</span>
                      <span className="font-mono text-sm text-white">
                        {formatSol(session.playerSol)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-gray-500">Position</span>
                      <span className="font-mono text-sm text-white">
                        {session.playerPosition.tokenAmount > 0
                          ? session.playerPosition.tokenAmount.toFixed(2)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-gray-500">Value</span>
                      <span className="font-mono text-sm text-white">
                        {formatSol(
                          session.playerSol +
                            session.playerPosition.tokenAmount * (getCurrentPrice() || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Opponent */}
                <div className="bg-gray-900 border border-red-500/30 rounded p-3">
                  <p className="font-mono text-red-400 text-xs mb-2">
                    {selectedOpponent?.name.toUpperCase()}
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-gray-500">SOL</span>
                      <span className="font-mono text-sm text-white">
                        {formatSol(session.opponentSol)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-gray-500">Position</span>
                      <span className="font-mono text-sm text-white">
                        {session.opponentPosition.tokenAmount > 0
                          ? session.opponentPosition.tokenAmount.toFixed(2)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-gray-500">Value</span>
                      <span className="font-mono text-sm text-white">
                        {formatSol(
                          session.opponentSol +
                            session.opponentPosition.tokenAmount * (getCurrentPrice() || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trading Controls */}
              <div className="bg-gray-900 border border-gray-800 rounded p-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Buy */}
                  <div>
                    <p className="font-mono text-xs text-gray-500 mb-2">BUY</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 font-mono text-sm text-white focus:outline-none focus:border-gray-500"
                        placeholder="SOL"
                        step="0.1"
                        min="0"
                        max={session.playerSol}
                      />
                      <button
                        onClick={handleBuy}
                        disabled={
                          parseFloat(buyAmount) <= 0 || parseFloat(buyAmount) > session.playerSol
                        }
                        className="px-4 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-mono text-sm rounded transition-colors"
                      >
                        BUY
                      </button>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {[0.5, 1, 2, 5].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setBuyAmount(String(Math.min(amt, session.playerSol)))}
                          className="flex-1 font-mono text-xs py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded"
                        >
                          {amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sell */}
                  <div>
                    <p className="font-mono text-xs text-gray-500 mb-2">SELL</p>
                    <div className="flex gap-2">
                      <select
                        value={sellPercent}
                        onChange={(e) => setSellPercent(Number(e.target.value))}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 font-mono text-sm text-white focus:outline-none"
                      >
                        <option value={25}>25%</option>
                        <option value={50}>50%</option>
                        <option value={75}>75%</option>
                        <option value={100}>100%</option>
                      </select>
                      <button
                        onClick={handleSell}
                        disabled={session.playerPosition.tokenAmount <= 0}
                        className="px-4 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-mono text-sm rounded transition-colors"
                      >
                        SELL
                      </button>
                    </div>
                    <p className="font-mono text-xs text-gray-600 mt-2">
                      {session.playerPosition.tokenAmount > 0
                        ? `${(session.playerPosition.tokenAmount * (sellPercent / 100)).toFixed(2)} tokens`
                        : "No position"}
                    </p>
                  </div>
                </div>
              </div>

              {/* End Early */}
              <button
                onClick={handleEndSpar}
                className="w-full font-mono text-xs text-gray-500 hover:text-white py-2 border border-gray-800 rounded"
              >
                END SPAR EARLY
              </button>
            </div>
          )}

          {/* RESULTS VIEW */}
          {view === "results" && session && (
            <div className="p-6 space-y-6">
              {/* Winner Banner */}
              <div
                className={`text-center p-6 rounded border ${
                  session.winner === "player"
                    ? "bg-green-500/10 border-green-500/30"
                    : session.winner === "opponent"
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-gray-500/10 border-gray-500/30"
                }`}
              >
                <p className="font-mono text-xs text-gray-400 mb-2">RESULT</p>
                <p
                  className={`font-mono text-3xl ${
                    session.winner === "player"
                      ? "text-green-400"
                      : session.winner === "opponent"
                        ? "text-red-400"
                        : "text-gray-400"
                  }`}
                >
                  {session.winner === "player"
                    ? "VICTORY"
                    : session.winner === "opponent"
                      ? "DEFEAT"
                      : "DRAW"}
                </p>
              </div>

              {/* Final Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded p-4">
                  <p className="font-mono text-xs text-gray-500 mb-2">YOUR PNL</p>
                  <p
                    className={`font-mono text-2xl ${
                      (session.playerPnlPercent || 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {(session.playerPnlPercent || 0) >= 0 ? "+" : ""}
                    {(session.playerPnlPercent || 0).toFixed(2)}%
                  </p>
                  <p className="font-mono text-xs text-gray-600 mt-1">
                    {session.playerTrades.length} trades
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded p-4">
                  <p className="font-mono text-xs text-gray-500 mb-2">
                    {selectedOpponent?.name.toUpperCase()} PNL
                  </p>
                  <p
                    className={`font-mono text-2xl ${
                      (session.opponentPnlPercent || 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {(session.opponentPnlPercent || 0) >= 0 ? "+" : ""}
                    {(session.opponentPnlPercent || 0).toFixed(2)}%
                  </p>
                  <p className="font-mono text-xs text-gray-600 mt-1">
                    {session.opponentTrades.length} trades
                  </p>
                </div>
              </div>

              {/* Coaching Feedback */}
              <div className="bg-gray-900 border border-gray-800 rounded p-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="font-mono text-xs text-gray-500">COACHING</p>
                  {!coaching && (
                    <button
                      onClick={handleGetCoaching}
                      disabled={isLoadingCoaching}
                      className="font-mono text-xs text-gray-400 hover:text-white px-3 py-1 border border-gray-700 rounded"
                    >
                      {isLoadingCoaching ? "..." : "GET FEEDBACK"}
                    </button>
                  )}
                </div>

                {coaching ? (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`font-mono text-4xl ${getGradeColor(coaching.overallGrade)}`}
                      >
                        {coaching.overallGrade}
                      </span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedOpponent?.color }}
                      />
                      <span className="font-mono text-sm text-gray-400">
                        {selectedOpponent?.name}
                      </span>
                    </div>
                    <p className="font-mono text-sm text-gray-300 leading-relaxed">
                      {coaching.message}
                    </p>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-gray-600">
                    Get personalized feedback from {selectedOpponent?.name}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSession(null);
                    setCoaching(null);
                    setView("opponent-select");
                  }}
                  className="flex-1 font-mono text-sm py-3 bg-gray-800 hover:bg-gray-700 text-white rounded"
                >
                  REMATCH
                </button>
                <button
                  onClick={handleBackToLobby}
                  className="flex-1 font-mono text-sm py-3 border border-gray-700 hover:border-gray-500 text-gray-400 rounded"
                >
                  LOBBY
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 p-3">
          <p className="font-mono text-xs text-gray-600 text-center">
            Historical price simulation from Bags.fm tokens
          </p>
        </div>
      </div>
    </div>
  );
}

export default TradingDojoModal;
