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
  canChallenge,
} from "@/lib/trading-dojo";

interface TradingDojoModalProps {
  onClose: () => void;
}

type View = "welcome" | "instructions" | "lobby" | "opponent-select" | "spar" | "results";

// Dojo theme colors
const DOJO_COLORS = {
  primary: "#f97316", // Orange-500
  secondary: "#ea580c", // Orange-600
  dark: "#7c2d12", // Orange-900
  accent: "#fbbf24", // Amber-400
  bg: "#1c1917", // Stone-900
  bgDark: "#0c0a09", // Stone-950
};

export function TradingDojoModal({ onClose }: TradingDojoModalProps) {
  const [view, setView] = useState<View>("welcome");
  const [session, setSession] = useState<SparSession | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<DojoOpponent | null>(null);
  const [playerStats, setPlayerStatsState] = useState(getPlayerStats());
  const [coaching, setCoaching] = useState<CoachingFeedback | null>(null);
  const [isLoadingCoaching, setIsLoadingCoaching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [buyAmount, setBuyAmount] = useState("1");
  const [sellPercent, setSellPercent] = useState(100);
  const [liveTokens, setLiveTokens] = useState<any[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch live tokens with MC data
  useEffect(() => {
    if (view === "opponent-select") {
      fetchLiveTokens();
    }
  }, [view]);

  const fetchLiveTokens = async () => {
    setIsLoadingTokens(true);
    try {
      const res = await fetch("https://api.dexscreener.com/latest/dex/search?q=SOL");
      if (res.ok) {
        const data = await res.json();
        const tokens = (data.pairs || [])
          .filter((p: any) => p.chainId === "solana" && p.liquidity?.usd > 10000)
          .slice(0, 12)
          .map((p: any) => ({
            symbol: p.baseToken?.symbol || "???",
            mint: p.baseToken?.address,
            name: p.baseToken?.name,
            price: parseFloat(p.priceUsd) || 0,
            mc: p.fdv || p.marketCap || 0,
            change24h: p.priceChange?.h24 || 0,
          }));
        setLiveTokens(tokens);
      }
    } catch (e) {
      console.error("Failed to fetch tokens:", e);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Game loop - smoother with requestAnimationFrame timing
  useEffect(() => {
    if (view === "spar" && session?.status === "active" && !isPaused) {
      intervalRef.current = setInterval(() => {
        const continued = advanceCandle();
        setSession({ ...getCurrentSession()! });

        if (!continued) {
          setView("results");
          clearInterval(intervalRef.current!);
        }
      }, 800); // Slightly faster for smoother feel

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

  const formatMC = (mc: number): string => {
    if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
    if (mc >= 1e3) return `$${(mc / 1e3).toFixed(0)}K`;
    return `$${mc.toFixed(0)}`;
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
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gradient-to-b from-stone-900 to-stone-950 border border-orange-500/30 rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl shadow-orange-500/10">

        {/* ===== WELCOME VIEW ===== */}
        {view === "welcome" && (
          <>
            {/* Dojo Header */}
            <div className="bg-gradient-to-r from-orange-900/60 to-amber-900/40 p-6 border-b border-orange-500/30">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-3xl">&#x1F94B;</span>
                <h2 className="font-pixel text-xl text-orange-400 tracking-wider">TRADING DOJO</h2>
                <span className="text-3xl">&#x1F525;</span>
              </div>
              <p className="text-center text-orange-300/80 text-sm">
                Master the art of trading through combat
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Dojo Banner */}
              <div className="relative bg-gradient-to-br from-orange-950 to-stone-900 border border-orange-500/20 rounded-lg p-6 text-center overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(251,191,36,0.1) 10px, rgba(251,191,36,0.1) 20px)`
                }} />
                <div className="relative">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center border-4 border-orange-400/50 shadow-lg shadow-orange-500/30">
                    <span className="text-4xl">&#x2694;</span>
                  </div>
                  <h3 className="font-pixel text-lg text-orange-300 mb-2">Welcome, Trader</h3>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
                    Test your skills against AI opponents using real historical price data.
                    Win spars to earn belts and climb the ranks.
                  </p>
                </div>
              </div>

              {/* Belt Display */}
              <div className="flex items-center justify-center gap-4 py-3 bg-black/30 rounded-lg border border-orange-500/10">
                <div
                  className="w-4 h-12 rounded-sm shadow-lg"
                  style={{ backgroundColor: getBeltColor(playerStats.belt) }}
                />
                <div>
                  <p className="font-pixel text-xs text-gray-500 uppercase">Your Rank</p>
                  <p className="font-pixel text-lg text-orange-400 uppercase tracking-wider">
                    {playerStats.belt} Belt
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-pixel text-xs text-gray-500">Record</p>
                  <p className="font-mono text-lg text-white">
                    {playerStats.wins}W - {playerStats.losses}L
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setView("instructions")}
                  className="flex-1 py-4 px-4 bg-stone-800 hover:bg-stone-700 text-gray-300 rounded-lg font-pixel text-sm transition-all border border-stone-700"
                >
                  HOW TO SPAR
                </button>
                <button
                  onClick={() => setView("lobby")}
                  className="flex-1 py-4 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg font-pixel text-sm transition-all shadow-lg shadow-orange-500/20 border border-orange-500/50"
                >
                  ENTER DOJO
                </button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/20 rounded p-2">
                  <p className="font-mono text-lg text-orange-400">{playerStats.totalSpars}</p>
                  <p className="font-pixel text-[8px] text-gray-500">TOTAL SPARS</p>
                </div>
                <div className="bg-black/20 rounded p-2">
                  <p className={`font-mono text-lg ${playerStats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {playerStats.totalPnl >= 0 ? "+" : ""}{playerStats.totalPnl.toFixed(0)}%
                  </p>
                  <p className="font-pixel text-[8px] text-gray-500">TOTAL PNL</p>
                </div>
                <div className="bg-black/20 rounded p-2">
                  <p className="font-mono text-lg text-amber-400">{playerStats.bestWinStreak}</p>
                  <p className="font-pixel text-[8px] text-gray-500">BEST STREAK</p>
                </div>
              </div>
            </div>

            {/* Close button */}
            <div className="border-t border-orange-500/20 p-3">
              <button
                onClick={onClose}
                className="w-full font-pixel text-xs text-gray-500 hover:text-white py-2 transition-colors"
              >
                [ESC] CLOSE
              </button>
            </div>
          </>
        )}

        {/* ===== INSTRUCTIONS VIEW ===== */}
        {view === "instructions" && (
          <>
            <div className="bg-gradient-to-r from-orange-900/60 to-amber-900/40 p-4 border-b border-orange-500/30">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setView("welcome")}
                  className="font-pixel text-xs text-orange-400 hover:text-white"
                >
                  &larr; BACK
                </button>
                <h2 className="font-pixel text-lg text-orange-400">HOW TO SPAR</h2>
                <div className="w-12" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center flex-shrink-0">
                  <span className="font-pixel text-orange-400">1</span>
                </div>
                <div>
                  <h4 className="font-pixel text-sm text-orange-300 mb-1">Choose Your Opponent</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Each AI opponent has a unique trading style. Start with easier opponents and work your way up.
                    Higher belt opponents require you to earn belts first.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center flex-shrink-0">
                  <span className="font-pixel text-orange-400">2</span>
                </div>
                <div>
                  <h4 className="font-pixel text-sm text-orange-300 mb-1">Select a Token</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Pick any live Solana token to trade. You&apos;ll see its current market cap (MC).
                    The spar uses real historical price data - you&apos;re replaying actual market moves.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center flex-shrink-0">
                  <span className="font-pixel text-orange-400">3</span>
                </div>
                <div>
                  <h4 className="font-pixel text-sm text-orange-300 mb-1">Trade to Win</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Both you and the AI start with 10 SOL. Buy and sell tokens as the price moves.
                    Whoever has more value at the end wins. The AI will actively try to beat you!
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center flex-shrink-0">
                  <span className="font-pixel text-orange-400">4</span>
                </div>
                <div>
                  <h4 className="font-pixel text-sm text-orange-300 mb-1">Earn Belts</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Win spars to progress through belt ranks: White → Yellow → Green → Blue → Purple → Black.
                    Each belt unlocks tougher opponents with smarter strategies.
                  </p>
                </div>
              </div>

              {/* Belt Progress */}
              <div className="bg-black/30 rounded-lg p-4 border border-orange-500/10">
                <h4 className="font-pixel text-xs text-gray-500 mb-3">BELT PROGRESSION</h4>
                <div className="flex justify-between">
                  {(["white", "yellow", "green", "blue", "purple", "black"] as Belt[]).map((belt) => (
                    <div key={belt} className="text-center">
                      <div
                        className={`w-4 h-8 mx-auto rounded-sm mb-1 ${
                          playerStats.belt === belt ? "ring-2 ring-orange-400" : ""
                        }`}
                        style={{ backgroundColor: getBeltColor(belt) }}
                      />
                      <span className="font-pixel text-[7px] text-gray-500 uppercase">{belt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h4 className="font-pixel text-xs text-amber-400 mb-2">PRO TIPS</h4>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>&#x2022; Watch the AI&apos;s moves - they reveal their strategy</li>
                  <li>&#x2022; Don&apos;t go all-in - keep SOL to buy dips</li>
                  <li>&#x2022; Take profits - a win is a win</li>
                  <li>&#x2022; Get coaching after each spar to improve</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-orange-500/20 p-4">
              <button
                onClick={() => setView("lobby")}
                className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg font-pixel text-sm transition-all"
              >
                START TRAINING
              </button>
            </div>
          </>
        )}

        {/* ===== LOBBY VIEW ===== */}
        {view === "lobby" && (
          <>
            <div className="bg-gradient-to-r from-orange-900/40 to-amber-900/30 p-4 border-b border-orange-500/30">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setView("welcome")}
                  className="font-pixel text-xs text-orange-400 hover:text-white"
                >
                  &larr; EXIT
                </button>
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-8 rounded-sm"
                    style={{ backgroundColor: getBeltColor(playerStats.belt) }}
                  />
                  <span className="font-pixel text-sm text-orange-400 uppercase">
                    {playerStats.belt} Belt
                  </span>
                </div>
                <span className="font-mono text-xs text-gray-500">
                  {playerStats.wins}W-{playerStats.losses}L
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h3 className="font-pixel text-xs text-gray-500 uppercase tracking-wider">Select Opponent</h3>

              <div className="grid grid-cols-1 gap-3">
                {DOJO_OPPONENTS.map((opponent) => {
                  const canFight = canChallenge(playerStats.belt, opponent);
                  const record = playerStats.opponentStats[opponent.id] || { wins: 0, losses: 0 };

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
                      className={`text-left p-4 rounded-lg border transition-all ${
                        canFight
                          ? "bg-stone-900/80 border-orange-500/30 hover:border-orange-500/60 hover:bg-stone-800/80"
                          : "bg-stone-900/40 border-stone-700/50 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                            style={{ backgroundColor: opponent.color + "30", borderColor: opponent.color }}
                          >
                            {opponent.difficulty <= 2 ? "&#x1F94B;" : opponent.difficulty <= 4 ? "&#x1F525;" : "&#x2694;"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-pixel text-sm text-white">{opponent.name}</span>
                              <span className="font-mono text-[10px] text-gray-600">
                                LV.{opponent.difficulty}
                              </span>
                            </div>
                            <p className="font-mono text-xs text-gray-500">{opponent.style}</p>
                          </div>
                        </div>

                        {!canFight ? (
                          <span
                            className="font-pixel text-[10px] px-2 py-1 rounded"
                            style={{
                              backgroundColor: getBeltColor(opponent.requiredBelt) + "30",
                              color: getBeltColor(opponent.requiredBelt),
                            }}
                          >
                            {opponent.requiredBelt.toUpperCase()} REQ
                          </span>
                        ) : (record.wins > 0 || record.losses > 0) ? (
                          <span className="font-mono text-xs text-gray-600">
                            {record.wins}W-{record.losses}L
                          </span>
                        ) : (
                          <span className="font-pixel text-[10px] text-orange-400">NEW</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ===== OPPONENT SELECT VIEW ===== */}
        {view === "opponent-select" && selectedOpponent && (
          <>
            <div className="bg-gradient-to-r from-orange-900/40 to-amber-900/30 p-4 border-b border-orange-500/30">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setView("lobby")}
                  className="font-pixel text-xs text-orange-400 hover:text-white"
                >
                  &larr; BACK
                </button>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedOpponent.color }}
                  />
                  <span className="font-pixel text-sm text-white">{selectedOpponent.name}</span>
                </div>
                <div className="w-12" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-center py-2">
                <p className="font-pixel text-xs text-gray-500 mb-1">OPPONENT STYLE</p>
                <p className="font-mono text-sm text-orange-300">{selectedOpponent.style}</p>
              </div>

              <h3 className="font-pixel text-xs text-gray-500 uppercase tracking-wider">Select Token to Trade</h3>

              {isLoadingTokens ? (
                <div className="text-center py-8">
                  <p className="font-pixel text-sm text-orange-400 animate-pulse">Loading tokens...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {liveTokens.map((token) => (
                    <button
                      key={token.mint}
                      onClick={() => handleStartSpar(token)}
                      className="text-left p-3 bg-stone-900/80 border border-stone-700/50 rounded-lg hover:border-orange-500/50 hover:bg-stone-800/80 transition-all"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-sm text-white">${token.symbol}</span>
                        <span
                          className={`font-mono text-xs ${
                            token.change24h >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(0)}%
                        </span>
                      </div>
                      <p className="font-mono text-xs text-gray-500">MC: {formatMC(token.mc)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== SPAR VIEW ===== */}
        {view === "spar" && session && (
          <>
            {/* Compact Header */}
            <div className="bg-stone-900 p-3 border-b border-orange-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white">${session.tokenSymbol}</span>
                  <span className="font-mono text-xs text-gray-500">
                    vs {selectedOpponent?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">
                    {session.currentCandleIndex + 1}/{session.candles.length}
                  </span>
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className={`px-2 py-1 rounded text-xs font-mono ${
                      isPaused ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"
                    }`}
                  >
                    {isPaused ? "PLAY" : "PAUSE"}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-1 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                  style={{ width: `${(session.currentCandleIndex / session.candles.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Price Chart */}
              <div className="bg-stone-900/80 border border-stone-700/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-2xl text-white">
                    ${getCurrentPrice()?.toFixed(6) || "0.00"}
                  </span>
                </div>

                {/* Mini Chart */}
                <div className="h-20 flex items-end gap-px">
                  {session.candles.slice(0, session.currentCandleIndex + 1).map((candle, i) => {
                    const prices = session.candles.slice(0, session.currentCandleIndex + 1).map(c => c.close);
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    const range = max - min || 1;
                    const height = ((candle.close - min) / range) * 100;
                    const isGreen = candle.close >= candle.open;

                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-t transition-all duration-200 ${isGreen ? "bg-green-500" : "bg-red-500"}`}
                        style={{ height: `${Math.max(8, height)}%`, opacity: 0.8 }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Scoreboard */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="font-pixel text-xs text-blue-400 mb-2">YOU</p>
                  <div className="space-y-1 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">SOL</span>
                      <span className="text-white">{formatSol(session.playerSol)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tokens</span>
                      <span className="text-white">
                        {session.playerPosition.tokenAmount > 0 ? session.playerPosition.tokenAmount.toFixed(1) : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-blue-500/20 pt-1">
                      <span className="text-gray-500">Value</span>
                      <span className="text-blue-400 font-bold">
                        {formatSol(session.playerSol + session.playerPosition.tokenAmount * (getCurrentPrice() || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="font-pixel text-xs text-red-400 mb-2">{selectedOpponent?.name.toUpperCase()}</p>
                  <div className="space-y-1 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">SOL</span>
                      <span className="text-white">{formatSol(session.opponentSol)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tokens</span>
                      <span className="text-white">
                        {session.opponentPosition.tokenAmount > 0 ? session.opponentPosition.tokenAmount.toFixed(1) : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-red-500/20 pt-1">
                      <span className="text-gray-500">Value</span>
                      <span className="text-red-400 font-bold">
                        {formatSol(session.opponentSol + session.opponentPosition.tokenAmount * (getCurrentPrice() || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trading Controls */}
              <div className="bg-stone-900/80 border border-stone-700/50 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-4">
                  {/* Buy */}
                  <div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="number"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-2 font-mono text-sm text-white focus:outline-none focus:border-green-500/50"
                        placeholder="SOL"
                        step="0.5"
                        min="0"
                        max={session.playerSol}
                      />
                      <button
                        onClick={handleBuy}
                        disabled={parseFloat(buyAmount) <= 0 || parseFloat(buyAmount) > session.playerSol}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-stone-700 disabled:text-gray-500 text-white font-pixel text-xs rounded transition-colors"
                      >
                        BUY
                      </button>
                    </div>
                    <div className="flex gap-1">
                      {[0.5, 1, 2, 5].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setBuyAmount(String(Math.min(amt, session.playerSol)))}
                          className="flex-1 font-mono text-[10px] py-1 bg-stone-800 hover:bg-stone-700 text-gray-400 rounded"
                        >
                          {amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sell */}
                  <div>
                    <div className="flex gap-2 mb-2">
                      <select
                        value={sellPercent}
                        onChange={(e) => setSellPercent(Number(e.target.value))}
                        className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-2 font-mono text-sm text-white focus:outline-none"
                      >
                        <option value={25}>25%</option>
                        <option value={50}>50%</option>
                        <option value={75}>75%</option>
                        <option value={100}>100%</option>
                      </select>
                      <button
                        onClick={handleSell}
                        disabled={session.playerPosition.tokenAmount <= 0}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-stone-700 disabled:text-gray-500 text-white font-pixel text-xs rounded transition-colors"
                      >
                        SELL
                      </button>
                    </div>
                    <p className="font-mono text-[10px] text-gray-600 text-center">
                      {session.playerPosition.tokenAmount > 0
                        ? `${(session.playerPosition.tokenAmount * (sellPercent / 100)).toFixed(1)} tokens`
                        : "No position"}
                    </p>
                  </div>
                </div>
              </div>

              {/* End Early */}
              <button
                onClick={handleEndSpar}
                className="w-full font-pixel text-xs text-gray-500 hover:text-orange-400 py-2 border border-stone-700/50 rounded-lg transition-colors"
              >
                END SPAR EARLY
              </button>
            </div>
          </>
        )}

        {/* ===== RESULTS VIEW ===== */}
        {view === "results" && session && (
          <>
            <div className="bg-gradient-to-r from-orange-900/40 to-amber-900/30 p-4 border-b border-orange-500/30">
              <h2 className="font-pixel text-lg text-center text-orange-400">SPAR COMPLETE</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Winner Banner */}
              <div
                className={`text-center p-6 rounded-lg border ${
                  session.winner === "player"
                    ? "bg-green-500/10 border-green-500/30"
                    : session.winner === "opponent"
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-gray-500/10 border-gray-500/30"
                }`}
              >
                <p
                  className={`font-pixel text-3xl ${
                    session.winner === "player"
                      ? "text-green-400"
                      : session.winner === "opponent"
                        ? "text-red-400"
                        : "text-gray-400"
                  }`}
                >
                  {session.winner === "player" ? "VICTORY" : session.winner === "opponent" ? "DEFEAT" : "DRAW"}
                </p>
              </div>

              {/* Final Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-900/80 border border-stone-700/50 rounded-lg p-4">
                  <p className="font-pixel text-xs text-gray-500 mb-2">YOUR PNL</p>
                  <p
                    className={`font-mono text-2xl ${
                      (session.playerPnlPercent || 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {(session.playerPnlPercent || 0) >= 0 ? "+" : ""}
                    {(session.playerPnlPercent || 0).toFixed(1)}%
                  </p>
                  <p className="font-mono text-xs text-gray-600 mt-1">
                    {session.playerTrades.length} trades
                  </p>
                </div>
                <div className="bg-stone-900/80 border border-stone-700/50 rounded-lg p-4">
                  <p className="font-pixel text-xs text-gray-500 mb-2">{selectedOpponent?.name.toUpperCase()}</p>
                  <p
                    className={`font-mono text-2xl ${
                      (session.opponentPnlPercent || 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {(session.opponentPnlPercent || 0) >= 0 ? "+" : ""}
                    {(session.opponentPnlPercent || 0).toFixed(1)}%
                  </p>
                  <p className="font-mono text-xs text-gray-600 mt-1">
                    {session.opponentTrades.length} trades
                  </p>
                </div>
              </div>

              {/* Coaching */}
              <div className="bg-stone-900/80 border border-orange-500/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="font-pixel text-xs text-orange-400">COACHING</p>
                  {!coaching && (
                    <button
                      onClick={handleGetCoaching}
                      disabled={isLoadingCoaching}
                      className="font-pixel text-xs text-gray-400 hover:text-orange-400 px-3 py-1 border border-orange-500/30 rounded transition-colors"
                    >
                      {isLoadingCoaching ? "..." : "GET FEEDBACK"}
                    </button>
                  )}
                </div>

                {coaching ? (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`font-mono text-4xl ${getGradeColor(coaching.overallGrade)}`}>
                        {coaching.overallGrade}
                      </span>
                    </div>
                    <p className="font-mono text-sm text-gray-300 leading-relaxed">
                      {coaching.message}
                    </p>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-gray-600">
                    Get feedback from {selectedOpponent?.name}
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
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white font-pixel text-sm rounded-lg transition-colors"
                >
                  REMATCH
                </button>
                <button
                  onClick={handleBackToLobby}
                  className="flex-1 py-3 border border-stone-600 hover:border-stone-500 text-gray-400 font-pixel text-sm rounded-lg transition-colors"
                >
                  LOBBY
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TradingDojoModal;
