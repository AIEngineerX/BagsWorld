"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import type { TrendingToken, NewPair, TokenSafety, TradeQuote } from "@/lib/types";

type TerminalTab = "trending" | "new-pairs" | "quick-trade";

interface TradingTerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TradingTerminal({ isOpen, onClose }: TradingTerminalProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();

  const [activeTab, setActiveTab] = useState<TerminalTab>("trending");
  const [trending, setTrending] = useState<TrendingToken[]>([]);
  const [newPairs, setNewPairs] = useState<NewPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick trade state
  const [selectedToken, setSelectedToken] = useState<TrendingToken | NewPair | null>(null);
  const [tradeAmount, setTradeAmount] = useState<number>(0.1);
  const [slippage, setSlippage] = useState<number>(100); // 1% in bps
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);

  // Fetch data on mount and tab change
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === "trending") {
      fetchTrending();
    } else if (activeTab === "new-pairs") {
      fetchNewPairs();
    }
  }, [isOpen, activeTab]);

  const fetchTrending = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terminal?action=trending&limit=5");
      const data = await res.json();
      if (data.success) {
        setTrending(data.trending || []);
      } else {
        setError(data.error || "Failed to fetch trending");
      }
    } catch (err) {
      setError("Failed to fetch trending tokens");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNewPairs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terminal?action=new-pairs&limit=5");
      const data = await res.json();
      if (data.success) {
        setNewPairs(data.pairs || []);
      } else {
        setError(data.error || "Failed to fetch new pairs");
      }
    } catch (err) {
      setError("Failed to fetch new pairs");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQuote = useCallback(async (mint: string, amount: number) => {
    setIsQuoting(true);
    setError(null);
    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quick-quote",
          data: {
            outputMint: mint,
            amountSol: amount,
            slippageBps: slippage,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuote(data.quote);
      } else {
        setError(data.error || "Failed to get quote");
        setQuote(null);
      }
    } catch (err) {
      setError("Failed to get quote");
      setQuote(null);
    } finally {
      setIsQuoting(false);
    }
  }, [slippage]);

  const handleQuickBuy = async (token: TrendingToken | NewPair) => {
    setSelectedToken(token);
    setActiveTab("quick-trade");
    await fetchQuote(token.mint, tradeAmount);
  };

  const executeSwap = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setWalletModalVisible(true);
      return;
    }

    if (!quote || !selectedToken) {
      setError("No quote available");
      return;
    }

    setIsSwapping(true);
    setError(null);

    try {
      // Get swap transaction
      const response = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          data: {
            quoteResponse: quote,
            userPublicKey: publicKey.toBase58(),
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create swap transaction");
      }

      const { transaction: txBase64 } = await response.json();

      // Decode and sign
      const txBuffer = Buffer.from(txBase64, "base64");
      const transaction = VersionedTransaction.deserialize(txBuffer);
      const signedTx = await signTransaction(transaction);

      // Send and confirm
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      setSwapSuccess(`Success! ${signature.slice(0, 8)}...`);
      setQuote(null);

      setTimeout(() => setSwapSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  // Update quote when amount changes
  useEffect(() => {
    if (selectedToken && activeTab === "quick-trade") {
      const timer = setTimeout(() => {
        fetchQuote(selectedToken.mint, tradeAmount);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [tradeAmount, selectedToken, activeTab, fetchQuote]);

  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  const formatMarketCap = (mc: number) => {
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
    if (mc >= 1e3) return `$${(mc / 1e3).toFixed(0)}K`;
    return `$${mc.toFixed(0)}`;
  };

  const formatAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const getSafetyColor = (score: number) => {
    if (score >= 70) return "text-green-400";
    if (score >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getSafetyLabel = (safety: TokenSafety) => {
    if (safety.score >= 70) return "SAFE";
    if (safety.score >= 40) return "CAUTION";
    return "RISK";
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 left-0 right-0 z-40 bg-bags-dark border-b-4 border-bags-green shadow-2xl">
      {/* Pokemon-style frame */}
      <div className="mx-4 my-2 border-4 border-gray-600 rounded-lg bg-gradient-to-b from-gray-800 to-gray-900 overflow-hidden">
        {/* Top bar with screen effect */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-red-700 px-3 py-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-lg shadow-blue-400/50" />
            <span className="font-pixel text-[10px] text-white tracking-wider">TERMINAL v1.0</span>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-[10px] text-white/70 hover:text-white px-2 py-0.5 bg-red-800 rounded"
          >
            CLOSE
          </button>
        </div>

        {/* Tab buttons - Pokemon menu style */}
        <div className="flex border-b-2 border-gray-700 bg-gray-800">
          <button
            onClick={() => setActiveTab("trending")}
            className={`flex-1 py-2 font-pixel text-[10px] flex items-center justify-center gap-1 transition-all ${
              activeTab === "trending"
                ? "bg-red-600 text-white border-b-2 border-red-400"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            <span className="text-lg">🔥</span> TRENDING
          </button>
          <button
            onClick={() => setActiveTab("new-pairs")}
            className={`flex-1 py-2 font-pixel text-[10px] flex items-center justify-center gap-1 transition-all ${
              activeTab === "new-pairs"
                ? "bg-green-600 text-white border-b-2 border-green-400"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            <span className="text-lg">🆕</span> NEW PAIRS
          </button>
          <button
            onClick={() => setActiveTab("quick-trade")}
            className={`flex-1 py-2 font-pixel text-[10px] flex items-center justify-center gap-1 transition-all ${
              activeTab === "quick-trade"
                ? "bg-blue-600 text-white border-b-2 border-blue-400"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            <span className="text-lg">⚡</span> QUICK TRADE
          </button>
        </div>

        {/* Content area - LCD screen style */}
        <div className="bg-[#9bbc0f] p-3 min-h-[180px] relative">
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_4px)]" />

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="font-pixel text-[12px] text-[#0f380f] animate-pulse">LOADING...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <p className="font-pixel text-[10px] text-red-800">{error}</p>
            </div>
          ) : (
            <>
              {/* Trending Tab */}
              {activeTab === "trending" && (
                <div className="space-y-1">
                  {trending.length === 0 ? (
                    <p className="font-pixel text-[10px] text-[#0f380f] text-center py-8">
                      No trending tokens yet
                    </p>
                  ) : (
                    trending.map((token, index) => (
                      <div
                        key={token.mint}
                        className="flex items-center justify-between bg-[#8bac0f] px-2 py-1 rounded border border-[#306230]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-[10px] text-[#0f380f] w-4">
                            #{index + 1}
                          </span>
                          <span className="font-pixel text-[12px] text-[#0f380f] font-bold">
                            ${token.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-pixel text-[10px] ${
                            token.change24h >= 0 ? "text-[#0f380f]" : "text-red-800"
                          }`}>
                            {formatChange(token.change24h)}
                          </span>
                          <span className="font-pixel text-[9px] text-[#306230]">
                            {formatMarketCap(token.marketCap)}
                          </span>
                          <button
                            onClick={() => handleQuickBuy(token)}
                            className="px-2 py-0.5 bg-[#0f380f] text-[#9bbc0f] font-pixel text-[8px] rounded hover:bg-[#306230] transition-colors"
                          >
                            [A] BUY
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* New Pairs Tab */}
              {activeTab === "new-pairs" && (
                <div className="space-y-1">
                  {newPairs.length === 0 ? (
                    <p className="font-pixel text-[10px] text-[#0f380f] text-center py-8">
                      No new pairs found
                    </p>
                  ) : (
                    newPairs.map((pair) => (
                      <div
                        key={pair.mint}
                        className="flex items-center justify-between bg-[#8bac0f] px-2 py-1 rounded border border-[#306230]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-[12px] text-[#0f380f] font-bold">
                            ${pair.symbol}
                          </span>
                          <span className="font-pixel text-[8px] text-[#306230]">
                            {formatAge(pair.ageSeconds)} ago
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-pixel text-[8px] px-1 rounded ${getSafetyColor(pair.safety.score)} bg-[#0f380f]`}>
                            {getSafetyLabel(pair.safety)}
                          </span>
                          <span className="font-pixel text-[9px] text-[#306230]">
                            {formatMarketCap(pair.marketCap)}
                          </span>
                          <button
                            onClick={() => handleQuickBuy(pair)}
                            className="px-2 py-0.5 bg-[#0f380f] text-[#9bbc0f] font-pixel text-[8px] rounded hover:bg-[#306230] transition-colors"
                          >
                            [A] BUY
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Quick Trade Tab */}
              {activeTab === "quick-trade" && (
                <div className="space-y-3">
                  {!selectedToken ? (
                    <p className="font-pixel text-[10px] text-[#0f380f] text-center py-8">
                      Select a token from TRENDING or NEW PAIRS
                    </p>
                  ) : (
                    <>
                      {/* Selected token */}
                      <div className="bg-[#8bac0f] px-3 py-2 rounded border-2 border-[#306230]">
                        <div className="flex items-center justify-between">
                          <span className="font-pixel text-[14px] text-[#0f380f] font-bold">
                            ${selectedToken.symbol}
                          </span>
                          <span className="font-pixel text-[10px] text-[#306230]">
                            {formatMarketCap(selectedToken.marketCap)}
                          </span>
                        </div>
                      </div>

                      {/* Amount buttons - Pokeball style */}
                      <div>
                        <p className="font-pixel text-[8px] text-[#0f380f] mb-1">AMOUNT (SOL):</p>
                        <div className="flex gap-1">
                          {[0.1, 0.5, 1, 5].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setTradeAmount(amt)}
                              className={`flex-1 py-2 font-pixel text-[10px] rounded border-2 transition-all ${
                                tradeAmount === amt
                                  ? "bg-[#0f380f] text-[#9bbc0f] border-[#0f380f]"
                                  : "bg-[#8bac0f] text-[#0f380f] border-[#306230] hover:bg-[#7a9b0e]"
                              }`}
                            >
                              {amt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Slippage */}
                      <div>
                        <p className="font-pixel text-[8px] text-[#0f380f] mb-1">SLIPPAGE:</p>
                        <div className="flex gap-1">
                          {[50, 100, 300, 500].map((bps) => (
                            <button
                              key={bps}
                              onClick={() => setSlippage(bps)}
                              className={`flex-1 py-1 font-pixel text-[8px] rounded border transition-all ${
                                slippage === bps
                                  ? "bg-[#0f380f] text-[#9bbc0f] border-[#0f380f]"
                                  : "bg-[#8bac0f] text-[#0f380f] border-[#306230] hover:bg-[#7a9b0e]"
                              }`}
                            >
                              {bps / 100}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quote */}
                      {isQuoting ? (
                        <p className="font-pixel text-[10px] text-[#0f380f] animate-pulse">
                          Getting quote...
                        </p>
                      ) : quote ? (
                        <div className="bg-[#8bac0f] px-2 py-1 rounded border border-[#306230]">
                          <div className="flex justify-between">
                            <span className="font-pixel text-[8px] text-[#306230]">You receive:</span>
                            <span className="font-pixel text-[10px] text-[#0f380f]">
                              {(parseFloat(quote.outAmount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedToken.symbol}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {/* Success message */}
                      {swapSuccess && (
                        <div className="bg-green-800 px-2 py-1 rounded">
                          <p className="font-pixel text-[10px] text-green-200">{swapSuccess}</p>
                        </div>
                      )}

                      {/* Execute button - Game Boy A button style */}
                      <button
                        onClick={executeSwap}
                        disabled={isSwapping || isQuoting || !quote}
                        className={`w-full py-3 font-pixel text-[12px] rounded-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSwapping
                            ? "bg-gray-600 text-gray-400"
                            : "bg-[#0f380f] text-[#9bbc0f] hover:bg-[#1a4a1a] shadow-lg"
                        }`}
                      >
                        {isSwapping
                          ? "SWAPPING..."
                          : !connected
                          ? "[START] CONNECT WALLET"
                          : "[A] EXECUTE BUY"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom bar - D-pad hint */}
        <div className="bg-gray-800 px-3 py-1 flex items-center justify-between border-t-2 border-gray-700">
          <div className="flex items-center gap-4">
            <span className="font-pixel text-[8px] text-gray-500">
              [A] BUY • [B] BACK • [SELECT] REFRESH
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-[10px]">🎮</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
