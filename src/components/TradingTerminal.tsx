"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import type { TrendingToken, NewPair, TokenSafety } from "@/lib/types";

type TerminalTab = "trending" | "new-pairs" | "search" | "trade";
type TradeDirection = "buy" | "sell";

interface TradingTerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  tags?: string[];
  decimals: number;
}

interface UltraOrder {
  requestId: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  transaction: string;
  gasless: boolean;
}

// Slippage presets
const SLIPPAGE_PRESETS = [
  { label: "1%", value: 100 },
  { label: "5%", value: 500 },
  { label: "10%", value: 1000 },
  { label: "20%", value: 2000 },
];

// SOL amount presets
const AMOUNT_PRESETS = [0.1, 0.5, 1, 2, 5];

export function TradingTerminal({ isOpen, onClose }: TradingTerminalProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [activeTab, setActiveTab] = useState<TerminalTab>("trending");
  const [trending, setTrending] = useState<TrendingToken[]>([]);
  const [newPairs, setNewPairs] = useState<NewPair[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trade state
  const [selectedToken, setSelectedToken] = useState<TrendingToken | NewPair | SearchResult | null>(null);
  const [tradeDirection, setTradeDirection] = useState<TradeDirection>("buy");
  const [tradeAmount, setTradeAmount] = useState<number>(0.1);
  const [slippage, setSlippage] = useState<number>(500);
  const [ultraOrder, setUltraOrder] = useState<UltraOrder | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);

  // Fetch data on tab change
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

  const handleSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/terminal?action=search&query=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      if (data.success) setSearchResults(data.results || []);
      else setError(data.error || "Search failed");
    } catch {
      setError("Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (activeTab !== "search") return;
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // Fetch Ultra order when token/amount changes
  const fetchUltraOrder = useCallback(async () => {
    if (!selectedToken || !publicKey) return;

    setIsQuoting(true);
    setError(null);
    setUltraOrder(null);

    try {
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ultra-order",
          data: {
            inputMint: tradeDirection === "buy" ? SOL_MINT : selectedToken.mint,
            outputMint: tradeDirection === "buy" ? selectedToken.mint : SOL_MINT,
            amount: tradeAmount,
            slippageBps: slippage,
            taker: publicKey.toBase58(),
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setUltraOrder(data.order);
      } else {
        setError(data.error || "Failed to get order");
      }
    } catch {
      setError("Failed to get order");
    } finally {
      setIsQuoting(false);
    }
  }, [selectedToken, tradeAmount, slippage, tradeDirection, publicKey]);

  useEffect(() => {
    if (selectedToken && activeTab === "trade" && connected) {
      const timer = setTimeout(fetchUltraOrder, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedToken, tradeAmount, slippage, tradeDirection, activeTab, connected, fetchUltraOrder]);

  const handleSelectToken = (token: TrendingToken | NewPair | SearchResult) => {
    setSelectedToken(token);
    setActiveTab("trade");
    setUltraOrder(null);
  };

  const executeSwap = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setWalletModalVisible(true);
      return;
    }
    if (!ultraOrder || !selectedToken) {
      setError("No order available");
      return;
    }

    setIsSwapping(true);
    setError(null);

    try {
      // Decode and sign the transaction from Ultra order
      const txBuffer = Buffer.from(ultraOrder.transaction, "base64");
      const transaction = VersionedTransaction.deserialize(txBuffer);
      const signedTx = await signTransaction(transaction);
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString("base64");

      // Execute via Jupiter Ultra
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ultra-execute",
          data: {
            requestId: ultraOrder.requestId,
            signedTransaction: signedTxBase64,
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.status === "Success") {
        setSwapSuccess(data.signature);
        setUltraOrder(null);
        setTimeout(() => setSwapSuccess(null), 5000);
      } else {
        throw new Error(data.error || "Swap failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  const formatVolume = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`;
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
            <span className="font-pixel text-[8px] text-blue-400 bg-blue-900/30 px-1">JUPITER</span>
            <div className="flex gap-1">
              {(["trending", "new-pairs", "search", "trade"] as TerminalTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`font-pixel text-[10px] px-3 py-1 border-2 transition-all ${
                    activeTab === tab
                      ? "bg-bags-green text-black border-bags-green"
                      : "bg-transparent text-gray-400 border-gray-600 hover:border-bags-green hover:text-bags-green"
                  }`}
                >
                  {tab === "trending" ? "HOT" : tab === "new-pairs" ? "NEW" : tab === "search" ? "SEARCH" : "TRADE"}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-[10px] text-gray-400 hover:text-white px-2 py-1 border border-gray-600 hover:border-red-500"
          >
            [X]
          </button>
        </div>

        {/* Content */}
        <div className="bg-bags-darker border-2 border-gray-700 p-3 min-h-[200px]">
          {isLoading && activeTab !== "trade" ? (
            <div className="flex items-center justify-center h-40">
              <span className="font-pixel text-bags-green animate-pulse">LOADING...</span>
            </div>
          ) : (
            <>
              {/* Trending */}
              {activeTab === "trending" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {trending.length === 0 ? (
                    <p className="font-pixel text-gray-500 text-xs col-span-3 text-center py-8">No tokens</p>
                  ) : trending.map((token, i) => (
                    <button
                      key={token.mint}
                      onClick={() => handleSelectToken(token)}
                      className="bg-bags-dark border-2 border-gray-600 hover:border-bags-green p-2 text-left transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-pixel text-xs text-bags-green">#{i + 1}</span>
                        <span className="font-pixel text-[8px] text-gray-400">VOL: {formatVolume(token.volume24h)}</span>
                      </div>
                      <div className="font-pixel text-white text-sm group-hover:text-bags-green truncate">${token.symbol}</div>
                      <div className="font-pixel text-gray-500 text-[10px] truncate">{token.name}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* New Pairs */}
              {activeTab === "new-pairs" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {newPairs.length === 0 ? (
                    <p className="font-pixel text-gray-500 text-xs col-span-3 text-center py-8">No new pairs</p>
                  ) : newPairs.map((pair) => {
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
                        <div className="font-pixel text-white text-sm group-hover:text-bags-green truncate">${pair.symbol}</div>
                        <div className="font-pixel text-gray-500 text-[10px] truncate">{pair.name}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search */}
              {activeTab === "search" && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by symbol, name, or address..."
                    className="w-full bg-bags-dark border-2 border-gray-600 focus:border-bags-green p-2 font-pixel text-xs text-white placeholder-gray-500 outline-none"
                  />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {searchResults.map((token) => (
                      <button
                        key={token.mint}
                        onClick={() => handleSelectToken(token)}
                        className="bg-bags-dark border-2 border-gray-600 hover:border-bags-green p-2 text-left transition-all group"
                      >
                        <div className="font-pixel text-white text-sm group-hover:text-bags-green truncate">${token.symbol}</div>
                        <div className="font-pixel text-gray-500 text-[10px] truncate">{token.name}</div>
                        <div className="font-pixel text-gray-600 text-[8px] truncate">{token.mint.slice(0, 8)}...</div>
                      </button>
                    ))}
                  </div>
                  {searchQuery.length >= 2 && searchResults.length === 0 && !isLoading && (
                    <p className="font-pixel text-gray-500 text-xs text-center py-4">No results</p>
                  )}
                </div>
              )}

              {/* Trade */}
              {activeTab === "trade" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left: Token */}
                  <div className="space-y-3">
                    {!selectedToken ? (
                      <p className="font-pixel text-gray-500 text-xs text-center py-8">Select a token</p>
                    ) : (
                      <>
                        <div className="bg-bags-dark border-2 border-bags-green p-3">
                          <div className="font-pixel text-bags-green text-lg">${selectedToken.symbol}</div>
                          <div className="font-pixel text-gray-400 text-[10px] truncate">{selectedToken.mint.slice(0, 20)}...</div>
                        </div>
                        <div className="flex border-2 border-gray-600">
                          <button
                            onClick={() => setTradeDirection("buy")}
                            className={`flex-1 font-pixel text-xs py-2 ${tradeDirection === "buy" ? "bg-bags-green text-black" : "text-gray-400"}`}
                          >
                            BUY
                          </button>
                          <button
                            onClick={() => setTradeDirection("sell")}
                            className={`flex-1 font-pixel text-xs py-2 ${tradeDirection === "sell" ? "bg-red-500 text-white" : "text-gray-400"}`}
                          >
                            SELL
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Middle: Settings */}
                  <div className="space-y-3">
                    <div>
                      <div className="font-pixel text-[10px] text-gray-400 mb-1">AMOUNT (SOL)</div>
                      <div className="grid grid-cols-5 gap-1">
                        {AMOUNT_PRESETS.map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setTradeAmount(amt)}
                            className={`font-pixel text-[10px] py-2 border-2 ${tradeAmount === amt ? "bg-bags-green text-black border-bags-green" : "text-gray-400 border-gray-600"}`}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-pixel text-[10px] text-gray-400 mb-1">SLIPPAGE</div>
                      <div className="grid grid-cols-4 gap-1">
                        {SLIPPAGE_PRESETS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => setSlippage(s.value)}
                            className={`font-pixel text-[10px] py-1 border-2 ${slippage === s.value ? "bg-bags-gold text-black border-bags-gold" : "text-gray-400 border-gray-600"}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {ultraOrder?.gasless && (
                      <div className="bg-green-900/30 border border-green-500 p-2">
                        <p className="font-pixel text-[10px] text-green-400">GASLESS SWAP AVAILABLE</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Quote & Execute */}
                  <div className="space-y-3">
                    <div className="bg-bags-dark border-2 border-gray-600 p-3 space-y-2">
                      <div className="font-pixel text-[10px] text-gray-400">QUOTE (Jupiter Ultra)</div>
                      {isQuoting ? (
                        <p className="font-pixel text-xs text-bags-green animate-pulse">Getting order...</p>
                      ) : ultraOrder ? (
                        <>
                          <div className="flex justify-between">
                            <span className="font-pixel text-[10px] text-gray-400">You receive:</span>
                            <span className="font-pixel text-xs text-white">
                              {(parseFloat(ultraOrder.outAmount) / (tradeDirection === "buy" ? 1e6 : 1e9)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-pixel text-[10px] text-gray-400">Min received:</span>
                            <span className="font-pixel text-[10px] text-gray-500">
                              {(parseFloat(ultraOrder.otherAmountThreshold) / (tradeDirection === "buy" ? 1e6 : 1e9)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-pixel text-[10px] text-gray-400">Impact:</span>
                            <span className={`font-pixel text-[10px] ${parseFloat(ultraOrder.priceImpactPct) > 5 ? "text-red-400" : "text-gray-400"}`}>
                              {parseFloat(ultraOrder.priceImpactPct).toFixed(2)}%
                            </span>
                          </div>
                        </>
                      ) : !connected ? (
                        <p className="font-pixel text-[10px] text-gray-500">Connect wallet for quote</p>
                      ) : (
                        <p className="font-pixel text-[10px] text-gray-500">Select token</p>
                      )}
                    </div>

                    {error && (
                      <div className="bg-red-900/30 border border-red-500 p-2">
                        <p className="font-pixel text-[10px] text-red-400">{error}</p>
                      </div>
                    )}
                    {swapSuccess && (
                      <div className="bg-green-900/30 border border-green-500 p-2">
                        <p className="font-pixel text-[10px] text-green-400">Success! {swapSuccess.slice(0, 12)}...</p>
                      </div>
                    )}

                    <button
                      onClick={executeSwap}
                      disabled={isSwapping || isQuoting || !ultraOrder || !selectedToken}
                      className={`w-full font-pixel text-sm py-3 border-2 transition-all disabled:opacity-50 ${
                        tradeDirection === "buy"
                          ? "bg-bags-green text-black border-bags-green"
                          : "bg-red-500 text-white border-red-500"
                      }`}
                    >
                      {isSwapping ? "EXECUTING..." : !connected ? "CONNECT WALLET" : `${tradeDirection.toUpperCase()} ${selectedToken?.symbol || ""}`}
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
            SLIP: {slippage / 100}% | {ultraOrder?.gasless ? "GASLESS" : "STANDARD"}
          </div>
          <div className="font-pixel text-[8px] text-blue-400">
            POWERED BY JUPITER ULTRA
          </div>
        </div>
      </div>
    </div>
  );
}
