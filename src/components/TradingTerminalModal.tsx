"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
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

type TabType = "chart" | "trades" | "holders" | "info" | "portfolio";
type IntervalType = "1s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type TradeMode = "buy" | "sell";

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

interface TokenDetailedInfo {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  marketCap: number;
  fdv: number;
  volume24h: number;
  volume6h: number;
  volume1h: number;
  liquidity: number;
  change5m: number;
  change1h: number;
  change6h: number;
  change24h: number;
  holders?: number;
  txns24h: { buys: number; sells: number };
  pairAddress?: string;
  dexId?: string;
  priceNative?: string;
  supply?: number;
}

interface RecentTrade {
  signature: string;
  type: "buy" | "sell";
  amount: number;
  priceUsd: number;
  totalUsd: number;
  maker: string;
  timestamp: number;
}

interface TokenHolder {
  address: string;
  balance: number;
  percentage: number;
  rank: number;
}

interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PortfolioHolding {
  mint: string;
  symbol: string;
  balance: number;
  value: number;
  price: number;
}

interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

export function TradingTerminalModal({ onClose }: TradingTerminalModalProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>("chart");
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "mcap" | "newest" | "change">("volume");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([]);
  const [interval, setInterval] = useState<IntervalType>("1m");

  // Trading state
  const [tradeMode, setTradeMode] = useState<TradeMode>("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100); // 1% default
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "quoting" | "signing" | "confirming" | "success" | "error">("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Fetch SOL balance
  const { data: solBalance, refetch: refetchBalance } = useQuery({
    queryKey: ["sol-balance", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return 0;
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    },
    enabled: connected && !!publicKey,
    refetchInterval: 10000,
  });

  // Fetch token balance for selected token
  const { data: tokenBalance } = useQuery({
    queryKey: ["token-balance", publicKey?.toBase58(), selectedToken?.mint],
    queryFn: async () => {
      if (!publicKey || !selectedToken) return 0;
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: new PublicKey(selectedToken.mint),
      });
      if (tokenAccounts.value.length === 0) return 0;
      return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
    },
    enabled: connected && !!publicKey && !!selectedToken,
    refetchInterval: 10000,
  });

  // Jupiter quote
  const { data: jupiterQuote, isLoading: quoteLoading, refetch: refetchQuote } = useQuery({
    queryKey: ["jupiter-quote", selectedToken?.mint, tradeAmount, tradeMode, slippageBps],
    queryFn: async (): Promise<JupiterQuote | null> => {
      if (!selectedToken || !tradeAmount || parseFloat(tradeAmount) <= 0) return null;

      const inputMint = tradeMode === "buy" ? SOL_MINT : selectedToken.mint;
      const outputMint = tradeMode === "buy" ? selectedToken.mint : SOL_MINT;

      let amount: string;
      if (tradeMode === "buy") {
        // Convert SOL to lamports
        amount = Math.floor(parseFloat(tradeAmount) * LAMPORTS_PER_SOL).toString();
      } else {
        // For selling, we need to account for token decimals (assume 6 for most SPL tokens)
        const decimals = 6;
        amount = Math.floor(parseFloat(tradeAmount) * Math.pow(10, decimals)).toString();
      }

      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: slippageBps.toString(),
        swapMode: "ExactIn",
      });

      const response = await fetch(`${JUPITER_QUOTE_API}?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get quote");
      }
      return response.json();
    },
    enabled: !!selectedToken && !!tradeAmount && parseFloat(tradeAmount) > 0,
    refetchInterval: 3000, // Fast quote updates
    staleTime: 2000,
  });

  // Execute swap mutation
  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!publicKey || !signTransaction || !jupiterQuote) {
        throw new Error("Wallet not connected or no quote available");
      }

      setTxStatus("signing");

      // Get swap transaction from Jupiter
      const swapResponse = await fetch(JUPITER_SWAP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: jupiterQuote,
          userPublicKey: publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });

      if (!swapResponse.ok) {
        const error = await swapResponse.json();
        throw new Error(error.error || "Failed to create swap transaction");
      }

      const { swapTransaction } = await swapResponse.json();

      // Deserialize and sign transaction
      const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      const signedTransaction = await signTransaction(transaction);

      setTxStatus("confirming");

      // Send transaction
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 3,
      });

      // Confirm transaction
      const confirmation = await connection.confirmTransaction(signature, "confirmed");

      if (confirmation.value.err) {
        throw new Error("Transaction failed: " + JSON.stringify(confirmation.value.err));
      }

      return signature;
    },
    onSuccess: (signature) => {
      setTxStatus("success");
      setTxSignature(signature);
      setTradeAmount("");
      // Refetch balances
      refetchBalance();
      queryClient.invalidateQueries({ queryKey: ["token-balance"] });
      // Clear status after 5 seconds
      setTimeout(() => {
        setTxStatus("idle");
        setTxSignature(null);
      }, 5000);
    },
    onError: (error: Error) => {
      setTxStatus("error");
      setTxError(error.message);
      // Clear error after 5 seconds
      setTimeout(() => {
        setTxStatus("idle");
        setTxError(null);
      }, 5000);
    },
  });

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
    refetchInterval: 10000, // Fast refresh for live charts
    staleTime: 5000,
  });

  // Fetch detailed token info for selected token
  const { data: tokenDetailData, isLoading: tokenDetailLoading } = useQuery({
    queryKey: ["terminal-token-detail", selectedToken?.mint],
    queryFn: async () => {
      if (!selectedToken?.mint) return { token: null };
      const res = await fetch(`/api/trading-terminal?action=tokenInfo&mint=${selectedToken.mint}`);
      if (!res.ok) return { token: null };
      return res.json();
    },
    enabled: !!selectedToken?.mint,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Fetch recent trades for selected token
  const { data: tokenTradesData, isLoading: tokenTradesLoading } = useQuery({
    queryKey: ["terminal-token-trades", selectedToken?.mint],
    queryFn: async () => {
      if (!selectedToken?.mint) return { trades: [] };
      const res = await fetch(`/api/trading-terminal?action=trades&mint=${selectedToken.mint}`);
      if (!res.ok) return { trades: [] };
      return res.json();
    },
    enabled: !!selectedToken?.mint && activeTab === "trades",
    refetchInterval: 5000,
    staleTime: 3000,
  });

  // Fetch holders for selected token
  const { data: tokenHoldersData, isLoading: tokenHoldersLoading } = useQuery({
    queryKey: ["terminal-token-holders", selectedToken?.mint],
    queryFn: async () => {
      if (!selectedToken?.mint) return { holders: [] };
      const res = await fetch(`/api/trading-terminal?action=holders&mint=${selectedToken.mint}`);
      if (!res.ok) return { holders: [] };
      return res.json();
    },
    enabled: !!selectedToken?.mint && activeTab === "holders",
    refetchInterval: 60000,
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

  // Check if input is a valid Solana address (base58, 32-44 chars)
  const isSolanaAddress = (input: string): boolean => {
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(input.trim());
  };

  // Fetch token by contract address directly
  const fetchTokenByAddress = useCallback(async (address: string): Promise<TokenInfo | null> => {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    if (!response.ok) return null;

    const data = await response.json();
    const pair = data.pairs?.[0];
    if (!pair) return null;

    return {
      mint: address,
      name: pair.baseToken?.name || "Unknown",
      symbol: pair.baseToken?.symbol || "???",
      price: parseFloat(pair.priceUsd) || 0,
      marketCap: pair.marketCap || 0,
      volume24h: pair.volume?.h24 || 0,
      change24h: pair.priceChange?.h24 || 0,
      lifetimeFees: 0,
    };
  }, []);

  // Search for tokens (supports both name search and direct CA paste)
  const handleSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Check if it's a contract address
    if (isSolanaAddress(trimmedQuery)) {
      const token = await fetchTokenByAddress(trimmedQuery);
      if (token) {
        setSearchResults([token]);
        // Auto-select the token if it's a direct CA paste
        setSelectedToken(token);
        setTradeAmount("");
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
      return;
    }

    // Otherwise, do a regular name/symbol search
    const res = await fetch(
      `/api/trading-terminal?action=search&query=${encodeURIComponent(trimmedQuery)}`
    );
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.tokens || []);
    }
    setIsSearching(false);
  }, [fetchTokenByAddress]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Track if chart should be visible (has data and container should exist)
  const shouldShowChart = selectedToken && !ohlcvLoading && (ohlcvData?.candles?.length || 0) > 0;

  // Initialize chart when container becomes available
  useEffect(() => {
    if (!chartContainerRef.current || activeTab !== "chart" || !shouldShowChart) {
      return;
    }

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    }

    // Small delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
      if (!chartContainerRef.current) return;

      const containerWidth = chartContainerRef.current.clientWidth;
      const containerHeight = chartContainerRef.current.clientHeight || 288;

      const chart = createChart(chartContainerRef.current, {
        width: containerWidth,
        height: containerHeight,
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

      // Set initial data if available
      const candles = ohlcvData?.candles as OHLCVCandle[] | undefined;
      if (candles && candles.length > 0) {
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

        candlestickSeries.setData(candlestickData);
        volumeSeries.setData(volumeData);
        chart.timeScale().fitContent();
      }
    }, 50);

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
      clearTimeout(initTimer);
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, [activeTab, shouldShowChart, ohlcvData]);

  // Update chart data when OHLCV data changes (for live updates after initial load)
  useEffect(() => {
    // Only run if chart is already initialized and we have new data
    if (!chartRef.current || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;
    if (!ohlcvData?.candles) return;

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
    chartRef.current.timeScale().fitContent();
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

  // Preset SOL amounts for instant buy (like Axiom)
  const buyPresets = [0.1, 0.25, 0.5, 1];

  const handlePresetClick = (amount: number) => {
    if (tradeMode === "buy") {
      setTradeAmount(amount.toString());
    }
  };

  const handlePercentageClick = (percentage: number) => {
    if (tradeMode === "buy" && solBalance) {
      const maxAmount = solBalance * 0.995; // Leave some for fees
      setTradeAmount((maxAmount * percentage).toFixed(4));
    } else if (tradeMode === "sell" && tokenBalance) {
      setTradeAmount((tokenBalance * percentage).toFixed(6));
    }
  };

  const formatOutputAmount = (amount: string, decimals: number = 6): string => {
    const value = parseInt(amount) / Math.pow(10, decimals);
    if (value < 0.001) return value.toExponential(2);
    if (value < 1) return value.toFixed(6);
    if (value < 1000) return value.toFixed(4);
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "chart", label: "CHART" },
    { id: "trades", label: "TRADES" },
    { id: "holders", label: "HOLDERS" },
    { id: "info", label: "INFO" },
    { id: "portfolio", label: "PORTFOLIO" },
  ];

  // Get detailed token info or fallback to basic info
  const tokenDetail: TokenDetailedInfo | null = tokenDetailData?.token || null;

  const intervals: { id: IntervalType; label: string }[] = [
    { id: "1s", label: "1S" },
    { id: "1m", label: "1M" },
    { id: "5m", label: "5M" },
    { id: "15m", label: "15M" },
    { id: "1h", label: "1H" },
    { id: "1d", label: "1D" },
  ];

  // Stop all pointer events from propagating to the game canvas (Phaser)
  const stopAllPropagation = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    // Also prevent the native event from reaching Phaser
    e.nativeEvent.stopImmediatePropagation();
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4"
      style={{ pointerEvents: 'auto' }}
      onClick={handleBackdropClick}
      onMouseDown={stopAllPropagation}
      onPointerDown={stopAllPropagation}
    >
      <div
        className="bg-[#0a0a0f] border border-[#1e293b] rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col"
        style={{ pointerEvents: 'auto' }}
        onClick={stopAllPropagation}
        onMouseDown={stopAllPropagation}
        onPointerDown={stopAllPropagation}
      >
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
              <div className="flex items-center gap-2">
                <h2 className="font-pixel text-[#e2e8f0] text-sm tracking-wide">TRADING TERMINAL</h2>
                <span className="font-mono text-[8px] px-1.5 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 rounded">
                  BETA
                </span>
              </div>
              <p className="font-mono text-[#64748b] text-[10px]">
                {connected ? `${(solBalance || 0).toFixed(4)} SOL` : "Connect wallet"} | {tokensData?.total || 0} tokens
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
                placeholder="Search or paste CA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#12121a] border border-[#1e293b] rounded px-2 py-1.5 text-[11px] text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#22c55e]/50 font-mono"
              />
              {searchQuery && isSolanaAddress(searchQuery.trim()) && (
                <p className="font-mono text-[#06b6d4] text-[8px] mt-1">CA detected</p>
              )}
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
                    onClick={() => {
                      setSelectedToken(token);
                      setTradeAmount("");
                    }}
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
                {/* Token Header - Comprehensive Stats */}
                {selectedToken ? (
                  <div className="px-4 py-2 border-b border-[#1e293b] bg-[#12121a]">
                    {/* Row 1: Token name, price, and main changes */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {tokenDetail?.imageUrl && (
                          <img src={tokenDetail.imageUrl} alt={selectedToken.symbol} className="w-8 h-8 rounded-full" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-pixel text-[#e2e8f0] text-sm">${selectedToken.symbol}</span>
                            <span className="font-mono text-[#64748b] text-xs truncate max-w-[120px]">{selectedToken.name}</span>
                            {tokenDetail?.dexId && (
                              <span className="font-mono text-[8px] px-1.5 py-0.5 bg-[#1e293b] text-[#64748b] rounded">
                                {tokenDetail.dexId.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="font-mono text-[#e2e8f0] text-lg">{formatPrice(tokenDetail?.price || selectedToken.price)}</span>
                            {/* Price changes row */}
                            <div className="flex items-center gap-2">
                              {tokenDetail?.change5m !== undefined && (
                                <span className={`font-mono text-[9px] px-1 py-0.5 rounded ${tokenDetail.change5m >= 0 ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
                                  5m: {tokenDetail.change5m >= 0 ? "+" : ""}{tokenDetail.change5m.toFixed(1)}%
                                </span>
                              )}
                              {tokenDetail?.change1h !== undefined && (
                                <span className={`font-mono text-[9px] px-1 py-0.5 rounded ${tokenDetail.change1h >= 0 ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
                                  1h: {tokenDetail.change1h >= 0 ? "+" : ""}{tokenDetail.change1h.toFixed(1)}%
                                </span>
                              )}
                              <span className={`font-mono text-[9px] px-1 py-0.5 rounded ${(tokenDetail?.change24h || selectedToken.change24h) >= 0 ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
                                24h: {(tokenDetail?.change24h || selectedToken.change24h) >= 0 ? "+" : ""}{(tokenDetail?.change24h || selectedToken.change24h).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {connected && tokenBalance !== undefined && tokenBalance > 0 && (
                        <div className="text-right bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded px-3 py-1.5">
                          <p className="font-mono text-[#06b6d4] text-[9px]">YOUR BALANCE</p>
                          <p className="font-mono text-[#e2e8f0] text-sm">{tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                        </div>
                      )}
                    </div>

                    {/* Row 2: Key metrics */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="bg-[#1e293b]/50 rounded px-2 py-1">
                        <p className="font-mono text-[#64748b] text-[8px]">MCAP</p>
                        <p className="font-mono text-[#e2e8f0] text-[11px]">{formatMarketCap(tokenDetail?.marketCap || selectedToken.marketCap)}</p>
                      </div>
                      {tokenDetail?.fdv && tokenDetail.fdv !== tokenDetail.marketCap && (
                        <div className="bg-[#1e293b]/50 rounded px-2 py-1">
                          <p className="font-mono text-[#64748b] text-[8px]">FDV</p>
                          <p className="font-mono text-[#e2e8f0] text-[11px]">{formatMarketCap(tokenDetail.fdv)}</p>
                        </div>
                      )}
                      {tokenDetail?.liquidity !== undefined && tokenDetail.liquidity > 0 && (
                        <div className="bg-[#1e293b]/50 rounded px-2 py-1">
                          <p className="font-mono text-[#64748b] text-[8px]">LIQUIDITY</p>
                          <p className="font-mono text-[#22c55e] text-[11px]">{formatMarketCap(tokenDetail.liquidity)}</p>
                        </div>
                      )}
                      <div className="bg-[#1e293b]/50 rounded px-2 py-1">
                        <p className="font-mono text-[#64748b] text-[8px]">24H VOL</p>
                        <p className="font-mono text-[#e2e8f0] text-[11px]">{formatMarketCap(tokenDetail?.volume24h || selectedToken.volume24h)}</p>
                      </div>
                      {tokenDetail?.volume1h !== undefined && tokenDetail.volume1h > 0 && (
                        <div className="bg-[#1e293b]/50 rounded px-2 py-1">
                          <p className="font-mono text-[#64748b] text-[8px]">1H VOL</p>
                          <p className="font-mono text-[#e2e8f0] text-[11px]">{formatMarketCap(tokenDetail.volume1h)}</p>
                        </div>
                      )}
                      {tokenDetail?.txns24h && (
                        <div className="bg-[#1e293b]/50 rounded px-2 py-1">
                          <p className="font-mono text-[#64748b] text-[8px]">24H TXNS</p>
                          <p className="font-mono text-[11px]">
                            <span className="text-[#22c55e]">{tokenDetail.txns24h.buys}B</span>
                            <span className="text-[#64748b]"> / </span>
                            <span className="text-[#ef4444]">{tokenDetail.txns24h.sells}S</span>
                          </p>
                        </div>
                      )}
                      {tokenDetail?.holders !== undefined && tokenDetail.holders > 0 && (
                        <div className="bg-[#1e293b]/50 rounded px-2 py-1">
                          <p className="font-mono text-[#64748b] text-[8px]">HOLDERS</p>
                          <p className="font-mono text-[#e2e8f0] text-[11px]">{tokenDetail.holders.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Row 3: Interval Selector */}
                    <div className="flex items-center gap-1 mt-2">
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
                        onClick={() => {
                          navigator.clipboard.writeText(selectedToken.mint);
                        }}
                        className="font-mono text-[9px] px-2 py-1 text-[#64748b] hover:text-[#e2e8f0] border border-[#1e293b] hover:border-[#64748b] rounded transition-colors"
                        title="Copy CA"
                      >
                        COPY CA
                      </button>
                      <button
                        onClick={() => refetchOhlcv()}
                        className="font-mono text-[9px] px-2 py-1 text-[#64748b] hover:text-[#e2e8f0] border border-[#1e293b] hover:border-[#64748b] rounded transition-colors"
                      >
                        REFRESH
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-6 border-b border-[#1e293b] bg-[#12121a] text-center">
                    <p className="font-mono text-[#64748b] text-sm">Select a token to view chart</p>
                    <p className="font-mono text-[#475569] text-xs mt-1">Or paste a contract address in the search box</p>
                  </div>
                )}

                {/* Chart and Trading Panel Container */}
                <div className="flex-1 flex overflow-hidden">
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
                        <div className="relative w-full h-72" style={{ minHeight: '288px' }}>
                          {/* Price/MC Overlay */}
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-3 bg-[#0a0a0f]/90 backdrop-blur-sm rounded px-3 py-2 border border-[#1e293b]">
                            <div>
                              <p className="font-mono text-[#e2e8f0] text-lg font-bold">
                                {formatPrice(tokenDetail?.price || selectedToken.price)}
                              </p>
                              <p className={`font-mono text-[10px] ${(tokenDetail?.change24h || selectedToken.change24h) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                                {(tokenDetail?.change24h || selectedToken.change24h) >= 0 ? "+" : ""}
                                {(tokenDetail?.change24h || selectedToken.change24h).toFixed(2)}% 24h
                              </p>
                            </div>
                            <div className="border-l border-[#1e293b] pl-3">
                              <p className="font-mono text-[#64748b] text-[9px]">MC</p>
                              <p className="font-mono text-[#e2e8f0] text-sm">{formatMarketCap(tokenDetail?.marketCap || selectedToken.marketCap)}</p>
                            </div>
                            {tokenDetail?.liquidity !== undefined && tokenDetail.liquidity > 0 && (
                              <div className="border-l border-[#1e293b] pl-3">
                                <p className="font-mono text-[#64748b] text-[9px]">LIQ</p>
                                <p className="font-mono text-[#22c55e] text-sm">{formatMarketCap(tokenDetail.liquidity)}</p>
                              </div>
                            )}
                          </div>
                          {/* Chart Container */}
                          <div
                            key={selectedToken?.mint}
                            ref={chartContainerRef}
                            className="w-full h-full"
                          />
                        </div>
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

                  {/* Trading Panel */}
                  {selectedToken && (
                    <div className="w-72 border-l border-[#1e293b] bg-[#0a0a0f] flex flex-col">
                      {/* Buy/Sell Tabs */}
                      <div className="flex border-b border-[#1e293b]">
                        <button
                          onClick={() => setTradeMode("buy")}
                          className={`flex-1 py-2.5 font-pixel text-xs transition-colors ${
                            tradeMode === "buy"
                              ? "bg-[#22c55e]/20 text-[#22c55e] border-b-2 border-[#22c55e]"
                              : "text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e293b]"
                          }`}
                        >
                          BUY
                        </button>
                        <button
                          onClick={() => setTradeMode("sell")}
                          className={`flex-1 py-2.5 font-pixel text-xs transition-colors ${
                            tradeMode === "sell"
                              ? "bg-[#ef4444]/20 text-[#ef4444] border-b-2 border-[#ef4444]"
                              : "text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e293b]"
                          }`}
                        >
                          SELL
                        </button>
                      </div>

                      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                        {/* Amount Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-mono text-[#64748b] text-[10px]">
                              {tradeMode === "buy" ? "PAY (SOL)" : `SELL (${selectedToken.symbol})`}
                            </label>
                            <span className="font-mono text-[#64748b] text-[10px]">
                              Balance: {tradeMode === "buy"
                                ? `${(solBalance || 0).toFixed(4)} SOL`
                                : `${(tokenBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                              }
                            </span>
                          </div>
                          <input
                            type="number"
                            value={tradeAmount}
                            onChange={(e) => setTradeAmount(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-[#12121a] border border-[#1e293b] rounded px-3 py-2.5 text-[#e2e8f0] font-mono text-sm focus:outline-none focus:border-[#22c55e]/50"
                          />

                          {/* Quick Amount Buttons - SOL presets for buy, percentages for sell */}
                          {tradeMode === "buy" ? (
                            <div className="flex gap-1 mt-2">
                              {buyPresets.map((amt) => (
                                <button
                                  key={amt}
                                  onClick={() => handlePresetClick(amt)}
                                  className={`flex-1 py-1.5 font-mono text-[9px] rounded transition-colors ${
                                    tradeAmount === amt.toString()
                                      ? "bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/50"
                                      : "text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155]"
                                  }`}
                                >
                                  {amt} SOL
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex gap-1 mt-2">
                              {[0.25, 0.5, 0.75, 1].map((pct) => (
                                <button
                                  key={pct}
                                  onClick={() => handlePercentageClick(pct)}
                                  className="flex-1 py-1.5 font-mono text-[9px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded transition-colors"
                                >
                                  {pct === 1 ? "MAX" : `${pct * 100}%`}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Quote Display */}
                        {tradeAmount && parseFloat(tradeAmount) > 0 && (
                          <div className="bg-[#12121a] rounded-lg p-3 border border-[#1e293b]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-[#64748b] text-[10px]">
                                {tradeMode === "buy" ? "YOU RECEIVE" : "YOU RECEIVE (SOL)"}
                              </span>
                              {quoteLoading && (
                                <span className="font-mono text-[#06b6d4] text-[10px] animate-pulse">
                                  Getting quote...
                                </span>
                              )}
                            </div>
                            {jupiterQuote ? (
                              <>
                                <p className="font-mono text-[#e2e8f0] text-lg">
                                  {tradeMode === "buy"
                                    ? formatOutputAmount(jupiterQuote.outAmount, 6)
                                    : formatOutputAmount(jupiterQuote.outAmount, 9)
                                  }
                                  <span className="text-[#64748b] text-sm ml-2">
                                    {tradeMode === "buy" ? selectedToken.symbol : "SOL"}
                                  </span>
                                </p>
                                <div className="flex items-center justify-between mt-2 text-[10px]">
                                  <span className="font-mono text-[#64748b]">Price Impact</span>
                                  <span className={`font-mono ${
                                    parseFloat(jupiterQuote.priceImpactPct) > 1
                                      ? "text-[#ef4444]"
                                      : parseFloat(jupiterQuote.priceImpactPct) > 0.5
                                        ? "text-[#fbbf24]"
                                        : "text-[#22c55e]"
                                  }`}>
                                    {parseFloat(jupiterQuote.priceImpactPct).toFixed(2)}%
                                  </span>
                                </div>
                                {jupiterQuote.routePlan && jupiterQuote.routePlan.length > 0 && (
                                  <div className="flex items-center justify-between mt-1 text-[10px]">
                                    <span className="font-mono text-[#64748b]">Route</span>
                                    <span className="font-mono text-[#64748b]">
                                      {jupiterQuote.routePlan.map(r => r.swapInfo.label).join(" → ")}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : !quoteLoading ? (
                              <p className="font-mono text-[#64748b] text-sm">Enter amount to see quote</p>
                            ) : null}
                          </div>
                        )}

                        {/* Slippage Settings */}
                        <div>
                          <button
                            onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                            className="flex items-center justify-between w-full font-mono text-[10px] text-[#64748b] hover:text-[#e2e8f0]"
                          >
                            <span>Slippage: {(slippageBps / 100).toFixed(1)}%</span>
                            <svg
                              className={`w-3 h-3 transition-transform ${showSlippageSettings ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showSlippageSettings && (
                            <div className="mt-2 flex gap-1">
                              {[50, 100, 200, 500].map((bps) => (
                                <button
                                  key={bps}
                                  onClick={() => setSlippageBps(bps)}
                                  className={`flex-1 py-1.5 font-mono text-[9px] rounded transition-colors ${
                                    slippageBps === bps
                                      ? "bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/50"
                                      : "text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b]"
                                  }`}
                                >
                                  {(bps / 100).toFixed(1)}%
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Transaction Status */}
                        {txStatus !== "idle" && (
                          <div className={`rounded-lg p-3 border ${
                            txStatus === "success"
                              ? "bg-[#22c55e]/10 border-[#22c55e]/30"
                              : txStatus === "error"
                                ? "bg-[#ef4444]/10 border-[#ef4444]/30"
                                : "bg-[#06b6d4]/10 border-[#06b6d4]/30"
                          }`}>
                            <div className="flex items-center gap-2">
                              {(txStatus === "quoting" || txStatus === "signing" || txStatus === "confirming") && (
                                <svg className="w-4 h-4 animate-spin text-[#06b6d4]" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              )}
                              {txStatus === "success" && (
                                <svg className="w-4 h-4 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {txStatus === "error" && (
                                <svg className="w-4 h-4 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              <span className={`font-mono text-[10px] ${
                                txStatus === "success" ? "text-[#22c55e]" :
                                txStatus === "error" ? "text-[#ef4444]" : "text-[#06b6d4]"
                              }`}>
                                {txStatus === "quoting" && "Getting quote..."}
                                {txStatus === "signing" && "Sign in wallet..."}
                                {txStatus === "confirming" && "Confirming..."}
                                {txStatus === "success" && "Swap successful!"}
                                {txStatus === "error" && (txError || "Swap failed")}
                              </span>
                            </div>
                            {txStatus === "success" && txSignature && (
                              <a
                                href={`https://solscan.io/tx/${txSignature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[9px] text-[#64748b] hover:text-[#e2e8f0] mt-2 block"
                              >
                                View on Solscan →
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Swap Button */}
                      <div className="p-3 border-t border-[#1e293b]">
                        {!connected ? (
                          <button
                            disabled
                            className="w-full py-3 font-pixel text-xs bg-[#1e293b] text-[#64748b] rounded cursor-not-allowed"
                          >
                            CONNECT WALLET
                          </button>
                        ) : (
                          <button
                            onClick={() => swapMutation.mutate()}
                            disabled={
                              !jupiterQuote ||
                              swapMutation.isPending ||
                              txStatus !== "idle" ||
                              !tradeAmount ||
                              parseFloat(tradeAmount) <= 0
                            }
                            className={`w-full py-3 font-pixel text-xs rounded transition-colors ${
                              tradeMode === "buy"
                                ? "bg-[#22c55e] hover:bg-[#16a34a] text-black disabled:bg-[#1e293b] disabled:text-[#64748b]"
                                : "bg-[#ef4444] hover:bg-[#dc2626] text-white disabled:bg-[#1e293b] disabled:text-[#64748b]"
                            } disabled:cursor-not-allowed`}
                          >
                            {swapMutation.isPending || txStatus !== "idle"
                              ? "PROCESSING..."
                              : tradeMode === "buy"
                                ? `BUY ${selectedToken.symbol}`
                                : `SELL ${selectedToken.symbol}`
                            }
                          </button>
                        )}

                        {/* External Links */}
                        <div className="flex gap-2 mt-2">
                          <a
                            href={`https://bags.fm/${selectedToken.mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 font-mono text-[9px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded text-center transition-colors"
                          >
                            BAGS.FM
                          </a>
                          <a
                            href={`https://birdeye.so/token/${selectedToken.mint}?chain=solana`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 font-mono text-[9px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded text-center transition-colors"
                          >
                            BIRDEYE
                          </a>
                          <a
                            href={`https://solscan.io/token/${selectedToken.mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 font-mono text-[9px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded text-center transition-colors"
                          >
                            SOLSCAN
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Trades Tab */}
            {activeTab === "trades" && (
              <div className="flex-1 overflow-y-auto p-4">
                {!selectedToken ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="font-mono text-[#64748b] text-sm">Select a token to view trades</p>
                  </div>
                ) : tokenTradesLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="font-mono text-[#64748b] text-sm">Loading trades...</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-[#12121a] border border-[#1e293b] rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
                        <span className="font-mono text-[#64748b] text-[10px]">LIVE TRADES FOR ${selectedToken.symbol}</span>
                      </div>
                    </div>
                    {(tokenTradesData?.trades || []).length === 0 ? (
                      <div className="text-center py-10">
                        <p className="font-mono text-[#64748b] text-sm">No recent trades found</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {/* Header */}
                        <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[9px] font-mono text-[#64748b] border-b border-[#1e293b]">
                          <span>TYPE</span>
                          <span>AMOUNT</span>
                          <span>PRICE</span>
                          <span>MAKER</span>
                          <span className="text-right">TIME</span>
                        </div>
                        {(tokenTradesData?.trades || []).map((trade: RecentTrade, idx: number) => (
                          <div
                            key={trade.signature || idx}
                            className={`grid grid-cols-5 gap-2 px-3 py-2 text-[10px] font-mono rounded hover:bg-[#1e293b]/50 ${
                              trade.type === "buy" ? "bg-[#22c55e]/5" : "bg-[#ef4444]/5"
                            }`}
                          >
                            <span className={trade.type === "buy" ? "text-[#22c55e]" : "text-[#ef4444]"}>
                              {trade.type.toUpperCase()}
                            </span>
                            <span className="text-[#e2e8f0]">${trade.totalUsd.toFixed(2)}</span>
                            <span className="text-[#64748b]">{formatPrice(trade.priceUsd)}</span>
                            <span className="text-[#64748b] truncate">{shortenAddress(trade.maker)}</span>
                            <span className="text-[#64748b] text-right">{formatTime(trade.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Holders Tab */}
            {activeTab === "holders" && (
              <div className="flex-1 overflow-y-auto p-4">
                {!selectedToken ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="font-mono text-[#64748b] text-sm">Select a token to view holders</p>
                  </div>
                ) : tokenHoldersLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="font-mono text-[#64748b] text-sm">Loading holders...</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-[#12121a] border border-[#fbbf24]/30 rounded-lg p-4 mb-4">
                      <p className="font-mono text-[#fbbf24] text-xs">TOP HOLDERS</p>
                      <p className="font-mono text-[#64748b] text-[10px] mt-1">
                        Largest token holders for ${selectedToken.symbol}
                      </p>
                    </div>
                    {(tokenHoldersData?.holders || []).length === 0 ? (
                      <div className="text-center py-10">
                        <p className="font-mono text-[#64748b] text-sm">Holder data not available</p>
                        <p className="font-mono text-[#475569] text-xs mt-1">
                          Try checking on{" "}
                          <a
                            href={`https://solscan.io/token/${selectedToken.mint}#holders`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#06b6d4] hover:underline"
                          >
                            Solscan
                          </a>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(tokenHoldersData?.holders || []).map((holder: TokenHolder) => (
                          <div
                            key={holder.address}
                            className={`bg-[#12121a] rounded-lg p-3 border ${
                              holder.rank === 1
                                ? "border-[#fbbf24]/50"
                                : holder.rank === 2
                                  ? "border-[#94a3b8]/30"
                                  : holder.rank === 3
                                    ? "border-[#f97316]/30"
                                    : "border-[#1e293b]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-7 h-7 rounded flex items-center justify-center font-mono text-xs ${
                                  holder.rank === 1
                                    ? "bg-[#fbbf24] text-black"
                                    : holder.rank === 2
                                      ? "bg-[#94a3b8] text-black"
                                      : holder.rank === 3
                                        ? "bg-[#f97316] text-white"
                                        : "bg-[#1e293b] text-[#64748b]"
                                }`}
                              >
                                #{holder.rank}
                              </div>
                              <div className="flex-1">
                                <a
                                  href={`https://solscan.io/account/${holder.address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[#e2e8f0] text-sm hover:text-[#06b6d4]"
                                >
                                  {shortenAddress(holder.address)}
                                </a>
                                <p className="font-mono text-[#475569] text-[10px]">
                                  {holder.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono text-[#e2e8f0] text-sm">
                                  {holder.percentage.toFixed(2)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Info Tab */}
            {activeTab === "info" && (
              <div className="flex-1 overflow-y-auto p-4">
                {!selectedToken ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="font-mono text-[#64748b] text-sm">Select a token to view info</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Token Overview */}
                    <div className="bg-[#12121a] border border-[#1e293b] rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-4">
                        {tokenDetail?.imageUrl && (
                          <img src={tokenDetail.imageUrl} alt={selectedToken.symbol} className="w-12 h-12 rounded-full" />
                        )}
                        <div>
                          <h3 className="font-pixel text-[#e2e8f0] text-lg">${selectedToken.symbol}</h3>
                          <p className="font-mono text-[#64748b] text-sm">{selectedToken.name}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">CONTRACT ADDRESS</p>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-[#e2e8f0] text-xs truncate">{selectedToken.mint}</p>
                            <button
                              onClick={() => navigator.clipboard.writeText(selectedToken.mint)}
                              className="text-[#64748b] hover:text-[#e2e8f0]"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {tokenDetail?.pairAddress && (
                          <div>
                            <p className="font-mono text-[#64748b] text-[10px]">PAIR ADDRESS</p>
                            <p className="font-mono text-[#e2e8f0] text-xs truncate">{tokenDetail.pairAddress}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Market Stats */}
                    <div className="bg-[#12121a] border border-[#1e293b] rounded-lg p-4">
                      <h4 className="font-pixel text-[#e2e8f0] text-sm mb-3">MARKET STATS</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">PRICE</p>
                          <p className="font-mono text-[#e2e8f0] text-sm">{formatPrice(tokenDetail?.price || selectedToken.price)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">MARKET CAP</p>
                          <p className="font-mono text-[#e2e8f0] text-sm">{formatMarketCap(tokenDetail?.marketCap || selectedToken.marketCap)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">FDV</p>
                          <p className="font-mono text-[#e2e8f0] text-sm">{formatMarketCap(tokenDetail?.fdv || tokenDetail?.marketCap || selectedToken.marketCap)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">LIQUIDITY</p>
                          <p className="font-mono text-[#22c55e] text-sm">{formatMarketCap(tokenDetail?.liquidity || 0)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">24H VOLUME</p>
                          <p className="font-mono text-[#e2e8f0] text-sm">{formatMarketCap(tokenDetail?.volume24h || selectedToken.volume24h)}</p>
                        </div>
                        {tokenDetail?.priceNative && (
                          <div>
                            <p className="font-mono text-[#64748b] text-[10px]">PRICE (SOL)</p>
                            <p className="font-mono text-[#e2e8f0] text-sm">{parseFloat(tokenDetail.priceNative).toFixed(10)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price Changes */}
                    <div className="bg-[#12121a] border border-[#1e293b] rounded-lg p-4">
                      <h4 className="font-pixel text-[#e2e8f0] text-sm mb-3">PRICE CHANGES</h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">5 MIN</p>
                          <p className={`font-mono text-sm ${(tokenDetail?.change5m || 0) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {(tokenDetail?.change5m || 0) >= 0 ? "+" : ""}{(tokenDetail?.change5m || 0).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">1 HOUR</p>
                          <p className={`font-mono text-sm ${(tokenDetail?.change1h || 0) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {(tokenDetail?.change1h || 0) >= 0 ? "+" : ""}{(tokenDetail?.change1h || 0).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">6 HOURS</p>
                          <p className={`font-mono text-sm ${(tokenDetail?.change6h || 0) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {(tokenDetail?.change6h || 0) >= 0 ? "+" : ""}{(tokenDetail?.change6h || 0).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[#64748b] text-[10px]">24 HOURS</p>
                          <p className={`font-mono text-sm ${(tokenDetail?.change24h || selectedToken.change24h) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {(tokenDetail?.change24h || selectedToken.change24h) >= 0 ? "+" : ""}{(tokenDetail?.change24h || selectedToken.change24h).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Trading Activity */}
                    {tokenDetail?.txns24h && (
                      <div className="bg-[#12121a] border border-[#1e293b] rounded-lg p-4">
                        <h4 className="font-pixel text-[#e2e8f0] text-sm mb-3">24H TRADING ACTIVITY</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="font-mono text-[#64748b] text-[10px]">BUYS</p>
                            <p className="font-mono text-[#22c55e] text-lg">{tokenDetail.txns24h.buys.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="font-mono text-[#64748b] text-[10px]">SELLS</p>
                            <p className="font-mono text-[#ef4444] text-lg">{tokenDetail.txns24h.sells.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="font-mono text-[#64748b] text-[10px]">BUY/SELL RATIO</p>
                            <p className={`font-mono text-lg ${tokenDetail.txns24h.buys >= tokenDetail.txns24h.sells ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                              {tokenDetail.txns24h.sells > 0 ? (tokenDetail.txns24h.buys / tokenDetail.txns24h.sells).toFixed(2) : "∞"}
                            </p>
                          </div>
                        </div>
                        {/* Buy/Sell bar */}
                        <div className="mt-3 h-2 bg-[#1e293b] rounded-full overflow-hidden flex">
                          <div
                            className="bg-[#22c55e] h-full"
                            style={{
                              width: `${(tokenDetail.txns24h.buys / (tokenDetail.txns24h.buys + tokenDetail.txns24h.sells)) * 100}%`,
                            }}
                          />
                          <div
                            className="bg-[#ef4444] h-full"
                            style={{
                              width: `${(tokenDetail.txns24h.sells / (tokenDetail.txns24h.buys + tokenDetail.txns24h.sells)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* External Links */}
                    <div className="bg-[#12121a] border border-[#1e293b] rounded-lg p-4">
                      <h4 className="font-pixel text-[#e2e8f0] text-sm mb-3">LINKS</h4>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`https://bags.fm/${selectedToken.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 font-mono text-[10px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded transition-colors"
                        >
                          Bags.fm
                        </a>
                        <a
                          href={`https://dexscreener.com/solana/${selectedToken.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 font-mono text-[10px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded transition-colors"
                        >
                          DexScreener
                        </a>
                        <a
                          href={`https://birdeye.so/token/${selectedToken.mint}?chain=solana`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 font-mono text-[10px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded transition-colors"
                        >
                          Birdeye
                        </a>
                        <a
                          href={`https://solscan.io/token/${selectedToken.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 font-mono text-[10px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded transition-colors"
                        >
                          Solscan
                        </a>
                        <a
                          href={`https://www.geckoterminal.com/solana/pools/${tokenDetail?.pairAddress || selectedToken.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 font-mono text-[10px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded transition-colors"
                        >
                          GeckoTerminal
                        </a>
                        <a
                          href={`https://jup.ag/swap/SOL-${selectedToken.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 font-mono text-[10px] text-[#64748b] hover:text-[#e2e8f0] bg-[#1e293b] hover:bg-[#334155] rounded transition-colors"
                        >
                          Jupiter
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#1e293b] bg-[#12121a] flex items-center justify-between">
          <p className="font-mono text-[#475569] text-[9px]">
            Charts by{" "}
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#64748b] hover:text-[#e2e8f0]"
            >
              TradingView
            </a>
            {" | "}Swaps via{" "}
            <a
              href="https://jup.ag/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#64748b] hover:text-[#e2e8f0]"
            >
              Jupiter
            </a>
          </p>
          <p className="font-mono text-[#475569] text-[9px]">Press ESC to close</p>
        </div>
      </div>
    </div>
  );
}
