"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import type { TrendingToken, NewPair, TokenSafety, TradeQuote } from "@/lib/types";

type TerminalTab = "trending" | "new-pairs" | "trade";
type TradeDirection = "buy" | "sell";
type MevMode = "fast" | "secure";

interface TradingTerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Slippage presets in basis points
const SLIPPAGE_PRESETS = [
  { label: "1%", value: 100 },
  { label: "5%", value: 500 },
  { label: "10%", value: 1000 },
  { label: "20%", value: 2000 },
];

// Priority fee presets in SOL
const PRIORITY_PRESETS = [
  { label: "LOW", value: 0.0001, desc: "Slow" },
  { label: "MED", value: 0.001, desc: "Normal" },
  { label: "HIGH", value: 0.005, desc: "Fast" },
  { label: "TURBO", value: 0.01, desc: "Instant" },
];

// SOL amount presets
const AMOUNT_PRESETS = [0.1, 0.5, 1, 2, 5];

export function TradingTerminal({ isOpen, onClose }: TradingTerminalProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();

  const [activeTab, setActiveTab] = useState<TerminalTab>("trending");
  const [trending, setTrending] = useState<TrendingToken[]>([]);
  const [newPairs, setNewPairs] = useState<NewPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trade state
  const [selectedToken, setSelectedToken] = useState<TrendingToken | NewPair | null>(null);
  const [tradeDirection, setTradeDirection] = useState<TradeDirection>("buy");
  const [tradeAmount, setTradeAmount] = useState<number>(0.1);
  const [slippage, setSlippage] = useState<number>(500); // 5% default for memecoins
  const [priorityFee, setPriorityFee] = useState<number>(0.001);
  const [mevMode, setMevMode] = useState<MevMode>("secure");
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);

  // Fetch data on mount and tab change
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "trending") fetchTrending();
    else if (activeTab === "new-pairs") fetchNewPairs();
  }, [isOpen, activeTab]);

  const fetchTrending = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terminal?action=trending&limit=6");
      const data = await res.json();
      if (data.success) setTrending(data.trending || []);
      else setError(data.error || "Failed to fetch");
    } catch {
      setError("Failed to fetch trending");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNewPairs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terminal?action=new-pairs&limit=6");
      const data = await res.json();
      if (data.success) setNewPairs(data.pairs || []);
      else setError(data.error || "Failed to fetch");
    } catch {
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
            outputMint: tradeDirection === "buy" ? mint : "So11111111111111111111111111111111111111112",
            inputMint: tradeDirection === "buy" ? "So11111111111111111111111111111111111111112" : mint,
            amountSol: amount,
            slippageBps: slippage,
          },
        }),
      });
      const data = await res.json();
      if (data.success) setQuote(data.quote);
      else {
        setError(data.error || "Failed to get quote");
        setQuote(null);
      }
    } catch {
      setError("Failed to get quote");
      setQuote(null);
    } finally {
      setIsQuoting(false);
    }
  }, [slippage, tradeDirection]);

  const handleSelectToken = async (token: TrendingToken | NewPair) => {
    setSelectedToken(token);
    setActiveTab("trade");
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
      const response = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          data: {
            quoteResponse: quote,
            userPublicKey: publicKey.toBase58(),
            priorityFee,
            mevProtection: mevMode === "secure",
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Swap failed");
      }

      const { transaction: txBase64 } = await response.json();
      const txBuffer = Buffer.from(txBase64, "base64");
      const transaction = VersionedTransaction.deserialize(txBuffer);
      const signedTx = await signTransaction(transaction);

      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: mevMode === "fast",
        maxRetries: 3,
      });
      await connection.confirmTransaction(signature, "confirmed");

      setSwapSuccess(signature.slice(0, 8) + "...");
      setQuote(null);
      setTimeout(() => setSwapSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  // Debounced quote fetch
  useEffect(() => {
    if (selectedToken && activeTab === "trade") {
      const timer = setTimeout(() => fetchQuote(selectedToken.mint, tradeAmount), 300);
      return () => clearTimeout(timer);
    }
  }, [tradeAmount, selectedToken, activeTab, fetchQuote, tradeDirection]);

  const formatChange = (change: number) => `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  const formatMcap = (mc: number) => mc >= 1e6 ? `$${(mc / 1e6).toFixed(1)}M` : `$${(mc / 1e3).toFixed(0)}K`;
  const formatAge = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;

  const getSafetyBadge = (safety: TokenSafety) => {
    if (safety.score >= 70) return { label: "SAFE", color: "bg-bags-green text-black" };
    if (safety.score >= 40) return { label: "WARN", color: "bg-yellow-500 text-black" };
    return { label: "RISK", color: "bg-red-500 text-white" };
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 left-0 right-0 z-40 bg-bags-dark border-b-4 border-bags-green shadow-2xl">
      <div className="max-w-6xl mx-auto p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="font-pixel text-bags-green text-sm">TERMINAL</span>
            <div className="flex gap-1">
              {(["trending", "new-pairs", "trade"] as TerminalTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`font-pixel text-[10px] px-3 py-1 border-2 transition-all ${
                    activeTab === tab
                      ? "bg-bags-green text-black border-bags-green"
                      : "bg-transparent text-gray-400 border-gray-600 hover:border-bags-green hover:text-bags-green"
                  }`}
                >
                  {tab === "trending" ? "HOT" : tab === "new-pairs" ? "NEW" : "TRADE"}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-[10px] text-gray-400 hover:text-white px-2 py-1 border border-gray-600 hover:border-red-500"
          >
            [X] CLOSE
          </button>
        </div>

        {/* Content */}
        <div className="bg-bags-darker border-2 border-gray-700 p-3 min-h-[200px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="font-pixel text-bags-green animate-pulse">LOADING...</span>
            </div>
          ) : error && activeTab !== "trade" ? (
            <div className="flex items-center justify-center h-40">
              <span className="font-pixel text-red-400 text-xs">{error}</span>
            </div>
          ) : (
            <>
              {/* Trending Tab */}
              {activeTab === "trending" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {trending.length === 0 ? (
                    <p className="font-pixel text-gray-500 text-xs col-span-3 text-center py-8">No tokens found</p>
                  ) : (
                    trending.map((token, i) => (
                      <button
                        key={token.mint}
                        onClick={() => handleSelectToken(token)}
                        className="bg-bags-dark border-2 border-gray-600 hover:border-bags-green p-2 text-left transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-pixel text-xs text-bags-green">#{i + 1}</span>
                          <span className={`font-pixel text-[10px] ${token.change24h >= 0 ? "text-bags-green" : "text-red-400"}`}>
                            {formatChange(token.change24h)}
                          </span>
                        </div>
                        <div className="font-pixel text-white text-sm group-hover:text-bags-green truncate">
                          ${token.symbol}
                        </div>
                        <div className="font-pixel text-gray-500 text-[10px]">
                          MC: {formatMcap(token.marketCap)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* New Pairs Tab */}
              {activeTab === "new-pairs" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {newPairs.length === 0 ? (
                    <p className="font-pixel text-gray-500 text-xs col-span-3 text-center py-8">No new pairs</p>
                  ) : (
                    newPairs.map((pair) => {
                      const badge = getSafetyBadge(pair.safety);
                      return (
                        <button
                          key={pair.mint}
                          onClick={() => handleSelectToken(pair)}
                          className="bg-bags-dark border-2 border-gray-600 hover:border-bags-green p-2 text-left transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-pixel text-[10px] text-gray-400">{formatAge(pair.ageSeconds)}</span>
                            <span className={`font-pixel text-[8px] px-1 ${badge.color}`}>{badge.label}</span>
                          </div>
                          <div className="font-pixel text-white text-sm group-hover:text-bags-green truncate">
                            ${pair.symbol}
                          </div>
                          <div className="font-pixel text-gray-500 text-[10px]">
                            MC: {formatMcap(pair.marketCap)}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Trade Tab */}
              {activeTab === "trade" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left: Token Info */}
                  <div className="space-y-3">
                    {!selectedToken ? (
                      <div className="text-center py-8">
                        <p className="font-pixel text-gray-500 text-xs">Select a token from HOT or NEW</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-bags-dark border-2 border-bags-green p-3">
                          <div className="font-pixel text-bags-green text-lg">${selectedToken.symbol}</div>
                          <div className="font-pixel text-gray-400 text-[10px] truncate">{selectedToken.mint.slice(0, 16)}...</div>
                          <div className="font-pixel text-white text-xs mt-1">MC: {formatMcap(selectedToken.marketCap)}</div>
                        </div>

                        {/* Buy/Sell Toggle */}
                        <div className="flex border-2 border-gray-600">
                          <button
                            onClick={() => setTradeDirection("buy")}
                            className={`flex-1 font-pixel text-xs py-2 transition-all ${
                              tradeDirection === "buy"
                                ? "bg-bags-green text-black"
                                : "bg-transparent text-gray-400 hover:text-bags-green"
                            }`}
                          >
                            BUY
                          </button>
                          <button
                            onClick={() => setTradeDirection("sell")}
                            className={`flex-1 font-pixel text-xs py-2 transition-all ${
                              tradeDirection === "sell"
                                ? "bg-red-500 text-white"
                                : "bg-transparent text-gray-400 hover:text-red-400"
                            }`}
                          >
                            SELL
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Middle: Amount & Settings */}
                  <div className="space-y-3">
                    {/* Amount */}
                    <div>
                      <div className="font-pixel text-[10px] text-gray-400 mb-1">
                        AMOUNT ({tradeDirection === "buy" ? "SOL" : selectedToken?.symbol || "TOKEN"})
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {AMOUNT_PRESETS.map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setTradeAmount(amt)}
                            className={`font-pixel text-[10px] py-2 border-2 transition-all ${
                              tradeAmount === amt
                                ? "bg-bags-green text-black border-bags-green"
                                : "bg-transparent text-gray-400 border-gray-600 hover:border-bags-green"
                            }`}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Slippage */}
                    <div>
                      <div className="font-pixel text-[10px] text-gray-400 mb-1">SLIPPAGE</div>
                      <div className="grid grid-cols-4 gap-1">
                        {SLIPPAGE_PRESETS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => setSlippage(s.value)}
                            className={`font-pixel text-[10px] py-1 border-2 transition-all ${
                              slippage === s.value
                                ? "bg-bags-gold text-black border-bags-gold"
                                : "bg-transparent text-gray-400 border-gray-600 hover:border-bags-gold"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Priority Fee */}
                    <div>
                      <div className="font-pixel text-[10px] text-gray-400 mb-1">PRIORITY FEE</div>
                      <div className="grid grid-cols-4 gap-1">
                        {PRIORITY_PRESETS.map((p) => (
                          <button
                            key={p.value}
                            onClick={() => setPriorityFee(p.value)}
                            className={`font-pixel text-[8px] py-1 border-2 transition-all ${
                              priorityFee === p.value
                                ? "bg-blue-500 text-white border-blue-500"
                                : "bg-transparent text-gray-400 border-gray-600 hover:border-blue-500"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* MEV Mode */}
                    <div>
                      <div className="font-pixel text-[10px] text-gray-400 mb-1">MEV PROTECTION</div>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => setMevMode("secure")}
                          className={`font-pixel text-[10px] py-1 border-2 transition-all ${
                            mevMode === "secure"
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-transparent text-gray-400 border-gray-600 hover:border-green-600"
                          }`}
                        >
                          SECURE
                        </button>
                        <button
                          onClick={() => setMevMode("fast")}
                          className={`font-pixel text-[10px] py-1 border-2 transition-all ${
                            mevMode === "fast"
                              ? "bg-orange-500 text-white border-orange-500"
                              : "bg-transparent text-gray-400 border-gray-600 hover:border-orange-500"
                          }`}
                        >
                          FAST
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quote & Execute */}
                  <div className="space-y-3">
                    {/* Quote Display */}
                    <div className="bg-bags-dark border-2 border-gray-600 p-3 space-y-2">
                      <div className="font-pixel text-[10px] text-gray-400">QUOTE</div>
                      {isQuoting ? (
                        <div className="font-pixel text-xs text-bags-green animate-pulse">Getting quote...</div>
                      ) : quote ? (
                        <>
                          <div className="flex justify-between">
                            <span className="font-pixel text-[10px] text-gray-400">You receive:</span>
                            <span className="font-pixel text-xs text-white">
                              {(parseFloat(quote.outAmount) / (tradeDirection === "buy" ? 1e6 : 1e9)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              {" "}{tradeDirection === "buy" ? selectedToken?.symbol : "SOL"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-pixel text-[10px] text-gray-400">Min received:</span>
                            <span className="font-pixel text-[10px] text-gray-500">
                              {(parseFloat(quote.minOutAmount) / (tradeDirection === "buy" ? 1e6 : 1e9)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-pixel text-[10px] text-gray-400">Price impact:</span>
                            <span className={`font-pixel text-[10px] ${
                              parseFloat(quote.priceImpactPct) > 5 ? "text-red-400" : "text-gray-400"
                            }`}>
                              {parseFloat(quote.priceImpactPct).toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-pixel text-[10px] text-gray-400">Est. fee:</span>
                            <span className="font-pixel text-[10px] text-gray-500">{priorityFee} SOL</span>
                          </div>
                        </>
                      ) : (
                        <div className="font-pixel text-[10px] text-gray-500">Select token and amount</div>
                      )}
                    </div>

                    {/* Error/Success */}
                    {error && activeTab === "trade" && (
                      <div className="bg-red-900/30 border border-red-500 p-2">
                        <p className="font-pixel text-[10px] text-red-400">{error}</p>
                      </div>
                    )}
                    {swapSuccess && (
                      <div className="bg-green-900/30 border border-green-500 p-2">
                        <p className="font-pixel text-[10px] text-green-400">Success! {swapSuccess}</p>
                      </div>
                    )}

                    {/* Execute Button */}
                    <button
                      onClick={executeSwap}
                      disabled={isSwapping || isQuoting || !quote || !selectedToken}
                      className={`w-full font-pixel text-sm py-3 border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        tradeDirection === "buy"
                          ? "bg-bags-green text-black border-bags-green hover:bg-bags-green/80"
                          : "bg-red-500 text-white border-red-500 hover:bg-red-600"
                      }`}
                    >
                      {isSwapping
                        ? "EXECUTING..."
                        : !connected
                        ? "CONNECT WALLET"
                        : tradeDirection === "buy"
                        ? `BUY ${selectedToken?.symbol || ""}`
                        : `SELL ${selectedToken?.symbol || ""}`}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="font-pixel text-[8px] text-gray-500">
            MEV: {mevMode.toUpperCase()} | SLIP: {slippage / 100}% | FEE: {priorityFee} SOL
          </div>
          <div className="font-pixel text-[8px] text-gray-500">
            POWERED BY BAGS.FM
          </div>
        </div>
      </div>
    </div>
  );
}
