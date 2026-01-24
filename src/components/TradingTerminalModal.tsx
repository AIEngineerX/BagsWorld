"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";

interface TradingTerminalModalProps {
  onClose: () => void;
}

type TabType = "chart" | "portfolio" | "history" | "alerts" | "leaderboard";
type IntervalType = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  lifetimeFees: number;
  poolAddress?: string;
}

interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceAlert {
  id: string;
  tokenMint: string;
  symbol: string;
  targetPrice: number;
  direction: "above" | "below";
  createdAt: number;
  triggered: boolean;
}

interface PortfolioHolding {
  mint: string;
  symbol: string;
  balance: number;
  value: number;
  price: number;
}

interface TraderLeaderboardItem {
  wallet: string;
  username?: string;
  totalVolume: number;
  tradeCount: number;
  rank: number;
}

interface TradeHistoryItem {
  signature: string;
  claimer: string;
  claimerUsername?: string;
  amount: number;
  timestamp: number;
  tokenMint: string;
  tokenSymbol?: string;
}

export function TradingTerminalModal({ onClose }: TradingTerminalModalProps) {
  const { publicKey, connected } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>("chart");
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "mcap" | "newest" | "change">("volume");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([]);
  const [interval, setInterval] = useState<IntervalType>("1h");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Load alerts from localStorage on mount
  useEffect(() => {
    const savedAlerts = localStorage.getItem("bagsworld_price_alerts");
    if (savedAlerts) {
      setAlerts(JSON.parse(savedAlerts));
    }
  }, []);

  // Fetch tokens for browser
  const { data: tokensData, isLoading: tokensLoading } = useQuery({
    queryKey: ["terminal-tokens", sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/trading-terminal?action=tokens&sortBy=${sortBy}`);
      if (!res.ok) return { tokens: [] };
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Fetch OHLCV data for selected token
  const {
    data: ohlcvData,
    isLoading: ohlcvLoading,
    refetch: refetchOhlcv,
  } = useQuery({
    queryKey: ["terminal-ohlcv", selectedToken?.mint, interval],
    queryFn: async () => {
      if (!selectedToken?.mint) return { candles: [] };
      const res = await fetch(
        `/api/trading-terminal?action=ohlcv&mint=${selectedToken.mint}&interval=${interval}`
      );
      if (!res.ok) return { candles: [] };
      return res.json();
    },
    enabled: !!selectedToken?.mint,
    refetchInterval: 30000,
  });

  // Fetch trade history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["terminal-history"],
    queryFn: async () => {
      const res = await fetch("/api/trading-terminal?action=history");
      if (!res.ok) return { trades: [] };
      return res.json();
    },
    refetchInterval: 15000,
    enabled: activeTab === "history",
  });

  // Fetch leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["terminal-leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/trading-terminal?action=leaderboard");
      if (!res.ok) return { traders: [] };
      return res.json();
    },
    refetchInterval: 60000,
    enabled: activeTab === "leaderboard",
  });

  // Fetch portfolio when wallet connected
  const { data: portfolioData, isLoading: portfolioLoading } = useQuery({
    queryKey: ["terminal-portfolio", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return { holdings: [], totalValue: 0 };
      const res = await fetch(
        `/api/trading-terminal?action=portfolio&wallet=${publicKey.toBase58()}`
      );
      if (!res.ok) return { holdings: [], totalValue: 0 };
      return res.json();
    },
    refetchInterval: 30000,
    enabled: activeTab === "portfolio" && connected,
  });

  // Search for tokens
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const res = await fetch(
      `/api/trading-terminal?action=search&query=${encodeURIComponent(query)}`
    );
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.tokens || []);
    }
    setIsSearching(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || activeTab !== "chart") return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { color: "#0a0a0f" },
        textColor: "#e2e8f0",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: "#06b6d4",
          style: 2,
          labelBackgroundColor: "#06b6d4",
        },
        horzLine: {
          width: 1,
          color: "#06b6d4",
          style: 2,
          labelBackgroundColor: "#06b6d4",
        },
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#22c55e",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [activeTab]);

  // Update chart data when OHLCV data changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !ohlcvData?.candles) return;

    const candles = ohlcvData.candles as OHLCVCandle[];

    if (candles.length === 0) {
      candlestickSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      return;
    }

    const candlestickData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData: HistogramData[] = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? "#22c55e40" : "#ef444440",
    }));

    candlestickSeriesRef.current.setData(candlestickData);
    volumeSeriesRef.current.setData(volumeData);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [ohlcvData]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const displayTokens = searchQuery.length >= 2 ? searchResults : tokensData?.tokens || [];

  const formatPrice = (price: number): string => {
    if (price === 0) return "$0.00";
    if (price < 0.000001) return `$${price.toExponential(2)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatMarketCap = (value: number): string => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  const shortenAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const addAlert = (token: TokenInfo, targetPrice: number, direction: "above" | "below") => {
    const newAlert: PriceAlert = {
      id: `${token.mint}-${Date.now()}`,
      tokenMint: token.mint,
      symbol: token.symbol,
      targetPrice,
      direction,
      createdAt: Date.now(),
      triggered: false,
    };
    const newAlerts = [...alerts, newAlert];
    setAlerts(newAlerts);
    localStorage.setItem("bagsworld_price_alerts", JSON.stringify(newAlerts));
  };

  const removeAlert = (alertId: string) => {
    const newAlerts = alerts.filter((a) => a.id !== alertId);
    setAlerts(newAlerts);
    localStorage.setItem("bagsworld_price_alerts", JSON.stringify(newAlerts));
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "chart", label: "CHART" },
    { id: "portfolio", label: "PORTFOLIO" },
    { id: "history", label: "HISTORY" },
    { id: "alerts", label: "ALERTS" },
    { id: "leaderboard", label: "LEADERS" },
  ];

  const intervals: { id: IntervalType; label: string }[] = [
    { id: "1m", label: "1M" },
    { id: "5m", label: "5M" },
    { id: "15m", label: "15M" },
    { id: "1h", label: "1H" },
    { id: "4h", label: "4H" },
    { id: "1d", label: "1D" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0a0a0f] border border-[#1e293b] rounded-lg max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#12121a] border-b border-[#1e293b] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#22c55e]/20 border border-[#22c55e]/50 rounded flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#22c55e]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-pixel text-[#e2e8f0] text-sm tracking-wide">TRADING TERMINAL</h2>
              <p className="font-mono text-[#64748b] text-[10px]">
                {tokensData?.total || 0} tokens indexed
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`font-pixel text-[9px] px-3 py-1.5 rounded transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/50"
                    : "text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e293b]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="font-mono text-[#64748b] hover:text-[#e2e8f0] text-xs px-2 py-1 border border-[#1e293b] hover:border-[#64748b] rounded transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Token List */}
          <div className="w-48 border-r border-[#1e293b] flex flex-col bg-[#0a0a0f]">
            {/* Search */}
            <div className="p-2 border-b border-[#1e293b]">
              <input
                type="text"
                placeholder="Search any token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#12121a] border border-[#1e293b] rounded px-2 py-1.5 text-[11px] text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#22c55e]/50 font-mono"
              />
            </div>

            {/* Sort */}
            <div className="px-2 py-1.5 border-b border-[#1e293b] flex gap-1">
              {(["volume", "mcap", "change"] as const).map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`font-mono text-[8px] px-1.5 py-0.5 rounded ${
                    sortBy === sort
                      ? "bg-[#22c55e]/20 text-[#22c55e]"
                      : "text-[#64748b] hover:text-[#e2e8f0]"
                  }`}
                >
                  {sort.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto">
              {tokensLoading || isSearching ? (
                <div className="p-4 text-center">
                  <p className="text-[#64748b] font-mono text-[10px]">Loading...</p>
                </div>
              ) : displayTokens.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-[#64748b] font-mono text-[10px]">
                    {searchQuery.length >= 2 ? "No results" : "No tokens"}
                  </p>
                </div>
              ) : (
                displayTokens.map((token: TokenInfo) => (
                  <button
                    key={token.mint}
                    onClick={() => setSelectedToken(token)}
                    className={`w-full px-2 py-2 text-left border-b border-[#1e293b]/50 hover:bg-[#12121a] transition-colors ${
                      selectedToken?.mint === token.mint
                        ? "bg-[#12121a] border-l-2 border-l-[#22c55e]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#e2e8f0] text-[10px] truncate">
                        ${token.symbol}
                      </span>
                      <span
                        className={`font-mono text-[9px] ${token.change24h >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}
                      >
                        {token.change24h >= 0 ? "+" : ""}
                        {token.change24h.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono text-[#64748b] text-[8px]">
                        {formatPrice(token.price)}
                      </span>
                      <span className="font-mono text-[#64748b] text-[8px]">
                        {formatMarketCap(token.marketCap)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Main Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "chart" && (
              <>
                {/* Token Header */}
                {selectedToken ? (
                  <div className="px-4 py-3 border-b border-[#1e293b] bg-[#12121a]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-[#e2e8f0] text-sm">
                            ${selectedToken.symbol}
                          </span>
                          <span className="font-mono text-[#64748b] text-xs truncate max-w-[200px]">
                            {selectedToken.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="font-mono text-[#e2e8f0] text-lg">
                            {formatPrice(selectedToken.price)}
                          </span>
                          <span
                            className={`font-mono text-sm ${selectedToken.change24h >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}
                          >
                            {selectedToken.change24h >= 0 ? "+" : ""}
                            {selectedToken.change24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="font-mono text-[#64748b] text-[9px]">MCAP</p>
                          <p className="font-mono text-[#e2e8f0] text-xs">
                            {formatMarketCap(selectedToken.marketCap)}
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[#64748b] text-[9px]">24H VOL</p>
                          <p className="font-mono text-[#e2e8f0] text-xs">
                            {formatMarketCap(selectedToken.volume24h)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Interval Selector */}
                    <div className="flex items-center gap-1 mt-3">
                      {intervals.map((int) => (
                        <button
                          key={int.id}
                          onClick={() => setInterval(int.id)}
                          className={`font-mono text-[9px] px-2 py-1 rounded transition-colors ${
                            interval === int.id
                              ? "bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/50"
                              : "text-[#64748b] hover:text-[#e2e8f0] border border-transparent hover:border-[#1e293b]"
                          }`}
                        >
                          {int.label}
                        </button>
                      ))}
                      <div className="flex-1" />
                      <button
                        onClick={() => refetchOhlcv()}
                        className="font-mono text-[9px] px-2 py-1 text-[#64748b] hover:text-[#e2e8f0] border border-[#1e293b] hover:border-[#64748b] rounded transition-colors"
                      >
                        REFRESH
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-8 border-b border-[#1e293b] bg-[#12121a] text-center">
                    <p className="font-mono text-[#64748b] text-sm">Select a token to view chart</p>
                  </div>
                )}

                {/* Chart */}
                <div className="flex-1 p-4 overflow-hidden">
                  {selectedToken ? (
                    ohlcvLoading ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="font-mono text-[#64748b] text-sm">Loading chart data...</p>
                      </div>
                    ) : (ohlcvData?.candles?.length || 0) === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <p className="font-mono text-[#64748b] text-sm">
                            No trading data available
                          </p>
                          <p className="font-mono text-[#475569] text-xs mt-1">
                            This token may be too new or have low liquidity
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div ref={chartContainerRef} className="w-full h-80" />
                    )
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <svg
                          className="w-16 h-16 mx-auto text-[#1e293b]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          />
                        </svg>
                        <p className="font-mono text-[#64748b] text-sm mt-4">
                          Select a token from the sidebar
                        </p>
                        <p className="font-mono text-[#475569] text-xs mt-1">
                          or search for any Solana token
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Trade Actions */}
                {selectedToken && (
                  <div className="px-4 py-3 border-t border-[#1e293b] bg-[#12121a] flex items-center gap-3">
                    <a
                      href={`https://bags.fm/${selectedToken.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-pixel text-xs py-2.5 rounded text-center transition-colors"
                    >
                      TRADE ON BAGS.FM
                    </a>
                    <a
                      href={`https://jup.ag/swap/SOL-${selectedToken.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-[#12121a] border border-[#1e293b] hover:border-[#64748b] text-[#e2e8f0] font-pixel text-xs rounded text-center transition-colors"
                    >
                      JUPITER
                    </a>
                    <button
                      onClick={() => {
                        const target = prompt(
                          `Set price alert for $${selectedToken.symbol}\nCurrent: ${formatPrice(selectedToken.price)}\n\nEnter target price:`
                        );
                        if (target) {
                          const price = parseFloat(target.replace("$", ""));
                          if (!isNaN(price)) {
                            addAlert(
                              selectedToken,
                              price,
                              price > selectedToken.price ? "above" : "below"
                            );
                          }
                        }
                      }}
                      className="px-4 py-2.5 bg-[#12121a] border border-[#1e293b] hover:border-[#06b6d4] text-[#06b6d4] font-pixel text-xs rounded transition-colors"
                    >
                      SET ALERT
                    </button>
                  </div>
                )}
              </>
            )}

            {activeTab === "portfolio" && (
              <div className="flex-1 overflow-y-auto p-4">
                {!connected ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg
                        className="w-16 h-16 mx-auto text-[#1e293b]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                      <p className="font-mono text-[#64748b] text-sm mt-4">
                        Connect wallet to view portfolio
                      </p>
                    </div>
                  </div>
                ) : portfolioLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="font-mono text-[#64748b] text-sm">Loading portfolio...</p>
                  </div>
                ) : (portfolioData?.holdings || []).length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="font-mono text-[#64748b] text-sm">No token holdings found</p>
                      <p className="font-mono text-[#475569] text-xs mt-1">
                        Start trading to build your portfolio
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-[#12121a] border border-[#22c55e]/30 rounded-lg p-4 mb-4">
                      <p className="font-mono text-[#64748b] text-[10px]">TOTAL VALUE</p>
                      <p className="font-mono text-[#e2e8f0] text-2xl">
                        {formatMarketCap(portfolioData?.totalValue || 0)}
                      </p>
                    </div>
                    {(portfolioData?.holdings || []).map((holding: PortfolioHolding) => (
                      <div
                        key={holding.mint}
                        className="bg-[#12121a] rounded-lg p-3 border border-[#1e293b]"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-[#e2e8f0] text-sm">
                              ${holding.symbol}
                            </span>
                            <p className="font-mono text-[#64748b] text-[10px]">
                              {holding.balance.toLocaleString()} tokens
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-[#e2e8f0] text-sm">
                              {formatMarketCap(holding.value)}
                            </p>
                            <p className="font-mono text-[#64748b] text-[10px]">
                              {formatPrice(holding.price)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-[#12121a] border border-[#1e293b] rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
                    <span className="font-mono text-[#64748b] text-[10px]">
                      LIVE ECOSYSTEM ACTIVITY
                    </span>
                  </div>
                </div>

                {historyLoading ? (
                  <div className="text-center py-10">
                    <p className="font-mono text-[#64748b] text-sm">Loading history...</p>
                  </div>
                ) : (historyData?.trades || []).length === 0 ? (
                  <div className="text-center py-10">
                    <p className="font-mono text-[#64748b] text-sm">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(historyData?.trades || []).map((trade: TradeHistoryItem) => (
                      <div
                        key={trade.signature}
                        className="bg-[#12121a] rounded-lg p-3 border border-[#1e293b]/50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-[#e2e8f0] text-sm">
                              {trade.claimerUsername || shortenAddress(trade.claimer)}
                            </span>
                            <span className="font-mono text-[#64748b] text-xs ml-2">
                              claimed from ${trade.tokenSymbol || "TOKEN"}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-[#22c55e] text-sm">
                              +{trade.amount.toFixed(4)} SOL
                            </p>
                            <p className="font-mono text-[#475569] text-[10px]">
                              {formatTime(trade.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "alerts" && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-[#12121a] border border-[#06b6d4]/30 rounded-lg p-4 mb-4">
                  <p className="font-mono text-[#06b6d4] text-xs">PRICE ALERTS</p>
                  <p className="font-mono text-[#64748b] text-[10px] mt-1">
                    Get notified when tokens hit your target price (browser notifications)
                  </p>
                </div>

                {alerts.filter((a) => !a.triggered).length === 0 ? (
                  <div className="text-center py-10">
                    <p className="font-mono text-[#64748b] text-sm">No active alerts</p>
                    <p className="font-mono text-[#475569] text-xs mt-1">
                      Select a token and click SET ALERT
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts
                      .filter((a) => !a.triggered)
                      .map((alert) => (
                        <div
                          key={alert.id}
                          className="bg-[#12121a] rounded-lg p-3 border border-[#1e293b]"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono text-[#e2e8f0] text-sm">
                                ${alert.symbol}
                              </span>
                              <p className="font-mono text-[#64748b] text-[10px]">
                                Alert when {alert.direction} {formatPrice(alert.targetPrice)}
                              </p>
                            </div>
                            <button
                              onClick={() => removeAlert(alert.id)}
                              className="font-mono text-[#ef4444] hover:text-[#f87171] text-xs"
                            >
                              REMOVE
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "leaderboard" && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-[#12121a] border border-[#fbbf24]/30 rounded-lg p-4 mb-4">
                  <p className="font-mono text-[#fbbf24] text-xs">TOP TRADERS</p>
                  <p className="font-mono text-[#64748b] text-[10px] mt-1">
                    Leading traders by total claim volume
                  </p>
                </div>

                {leaderboardLoading ? (
                  <div className="text-center py-10">
                    <p className="font-mono text-[#64748b] text-sm">Loading leaderboard...</p>
                  </div>
                ) : (leaderboardData?.traders || []).length === 0 ? (
                  <div className="text-center py-10">
                    <p className="font-mono text-[#64748b] text-sm">No traders yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(leaderboardData?.traders || []).map(
                      (trader: TraderLeaderboardItem, index: number) => (
                        <div
                          key={trader.wallet}
                          className={`bg-[#12121a] rounded-lg p-4 border ${
                            index === 0
                              ? "border-[#fbbf24]/50"
                              : index === 1
                                ? "border-[#94a3b8]/30"
                                : index === 2
                                  ? "border-[#f97316]/30"
                                  : "border-[#1e293b]"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-8 h-8 rounded flex items-center justify-center font-mono text-sm ${
                                index === 0
                                  ? "bg-[#fbbf24] text-black"
                                  : index === 1
                                    ? "bg-[#94a3b8] text-black"
                                    : index === 2
                                      ? "bg-[#f97316] text-white"
                                      : "bg-[#1e293b] text-[#64748b]"
                              }`}
                            >
                              #{trader.rank}
                            </div>
                            <div className="flex-1">
                              <span className="font-mono text-[#e2e8f0] text-sm">
                                {trader.username || shortenAddress(trader.wallet)}
                              </span>
                              <p className="font-mono text-[#475569] text-[10px]">
                                {trader.tradeCount} claims
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-[#22c55e] text-sm">
                                {trader.totalVolume.toFixed(2)} SOL
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#1e293b] bg-[#12121a] flex items-center justify-between">
          <p className="font-mono text-[#475569] text-[9px]">
            Charts powered by{" "}
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#64748b] hover:text-[#e2e8f0]"
            >
              TradingView
            </a>
            {" | "}Data from GeckoTerminal
          </p>
          <p className="font-mono text-[#475569] text-[9px]">Press ESC to close</p>
        </div>
      </div>
    </div>
  );
}
