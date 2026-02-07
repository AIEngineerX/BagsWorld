"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
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
import type { TradeQuote } from "@/lib/types";
import { getTokenDecimals } from "@/lib/token-balance";
import { useMobileWallet } from "@/hooks/useMobileWallet";

function deserializeTransaction(base64: string): VersionedTransaction | Transaction {
  const buffer = Buffer.from(base64, "base64");
  try {
    return VersionedTransaction.deserialize(buffer);
  } catch {
    try {
      return Transaction.from(buffer);
    } catch (e) {
      throw new Error(`Failed to deserialize transaction: ${e}`);
    }
  }
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface BuildingModalProps {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokenUrl?: string;
  onClose: () => void;
}

type TradeDirection = "buy" | "sell";
type IntervalType = "5m" | "15m" | "1h" | "4h" | "1d";

interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const formatPrice = (price: number): string => {
  if (price === 0) return "$0.00";
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};

const formatMarketCap = (value: number): string => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export function BuildingModal({
  tokenMint,
  tokenSymbol,
  tokenName,
  tokenUrl,
  onClose,
}: BuildingModalProps) {
  const { publicKey, connected, mobileSignTransaction: signTransaction } = useMobileWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();

  // Trade state
  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(0.5);

  // Chart state
  const [interval, setInterval] = useState<IntervalType>("1h");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const inputMint = direction === "buy" ? SOL_MINT : tokenMint;
  const outputMint = direction === "buy" ? tokenMint : SOL_MINT;

  // Fetch token info
  const { data: tokenInfoData } = useQuery({
    queryKey: ["buildingTokenInfo", tokenMint],
    queryFn: async () => {
      const res = await fetch(`/api/trading-terminal?action=tokenInfo&mint=${tokenMint}`);
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Fetch OHLCV
  const { data: ohlcvData } = useQuery({
    queryKey: ["buildingOhlcv", tokenMint, interval],
    queryFn: async () => {
      const res = await fetch(
        `/api/trading-terminal?action=ohlcv&mint=${tokenMint}&interval=${interval}`
      );
      return res.json();
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  // Fetch lifetime fees
  const { data: feesData } = useQuery({
    queryKey: ["buildingFees", tokenMint],
    queryFn: async () => {
      const res = await fetch(`/api/trading-terminal?action=fees&mint=${tokenMint}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const tokenInfo = tokenInfoData?.token;
  const lifetimeFees = feesData?.fees?.lifetimeFeesSol;

  // Chart initialization
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const initTimer = setTimeout(() => {
      if (!chartContainerRef.current) return;

      const containerWidth = chartContainerRef.current.clientWidth;
      const containerHeight = chartContainerRef.current.clientHeight || 220;

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
          vertLine: { width: 1, color: "#06b6d4", style: 2, labelBackgroundColor: "#06b6d4" },
          horzLine: { width: 1, color: "#06b6d4", style: 2, labelBackgroundColor: "#06b6d4" },
        },
        rightPriceScale: {
          borderColor: "#1e293b",
          scaleMargins: { top: 0.1, bottom: 0.2 },
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
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;
      volumeSeriesRef.current = volumeSeries;

      const candles = ohlcvData?.candles as OHLCVCandle[] | undefined;
      if (candles && candles.length > 0) {
        candlestickSeries.setData(
          candles.map((c) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        volumeSeries.setData(
          candles.map((c) => ({
            time: c.time as Time,
            value: c.volume,
            color: c.close >= c.open ? "#22c55e40" : "#ef444440",
          }))
        );
        chart.timeScale().fitContent();
      }
    }, 50);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
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
  }, [interval, ohlcvData]);

  // Update chart data on OHLCV changes
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;
    if (!ohlcvData?.candles) return;

    const candles = ohlcvData.candles as OHLCVCandle[];
    if (candles.length === 0) {
      candlestickSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      return;
    }

    candlestickSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volumeSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? "#22c55e40" : "#ef444440",
      }))
    );
    chartRef.current.timeScale().fitContent();
  }, [ohlcvData]);

  // Quote fetching
  const fetchQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    setError(null);

    try {
      const inputDecimals = await getTokenDecimals(connection, inputMint);
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, inputDecimals));

      const response = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          data: {
            inputMint,
            outputMint,
            amount: amountInSmallestUnit,
            slippageBps: slippage * 100,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to get quote");
      }

      const { quote: quoteData } = await response.json();
      setQuote(quoteData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get quote");
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [amount, inputMint, outputMint, slippage, connection]);

  // Debounce quote
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuote();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  const handleSwap = async () => {
    if (!connected || !publicKey) {
      setWalletModalVisible(true);
      return;
    }
    if (!quote) {
      setError("Get a quote first");
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
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create swap transaction");
      }

      const { transaction: txBase64 } = await response.json();
      const transaction = deserializeTransaction(txBase64);
      const signedTx = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      setSuccess(`Swap successful! ${signature.slice(0, 8)}...`);
      setAmount("");
      setQuote(null);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  const formatAmount = (value: string, decimals: number = 9) => {
    const num = parseFloat(value) / Math.pow(10, decimals);
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const change24h = tokenInfo?.change24h ?? 0;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-bags-dark border-4 border-bags-green w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[95vh] overflow-y-auto rounded-t-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b-4 border-bags-green">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bags-green/20 border border-bags-green rounded flex items-center justify-center flex-shrink-0">
              <span className="font-pixel text-bags-green text-[10px] sm:text-xs">HQ</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-pixel text-xs sm:text-sm text-bags-green truncate">
                {tokenName}
              </h2>
              <p className="font-pixel text-[7px] sm:text-[8px] text-gray-400">${tokenSymbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {tokenUrl && (
              <a
                href={tokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel text-[8px] px-2 py-1 text-bags-green border border-bags-green/30 hover:bg-bags-green/10 rounded"
              >
                BAGS.FM
              </a>
            )}
            <button
              onClick={onClose}
              className="font-pixel text-xs p-2 text-gray-400 hover:text-white touch-target border border-gray-700 hover:border-bags-green rounded"
              aria-label="Close"
            >
              [X]
            </button>
          </div>
        </div>

        {/* Two-column layout on desktop, single column on mobile */}
        <div className="flex flex-col sm:flex-row">
          {/* Left Column: Stats + Chart */}
          <div className="flex-1 min-w-0">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-px bg-bags-green/10 border-b border-bags-green/30">
              <div className="bg-bags-dark p-2 sm:p-3">
                <div className="font-pixel text-[7px] text-gray-500">PRICE</div>
                <div className="font-pixel text-[10px] sm:text-xs text-white">
                  {tokenInfo ? formatPrice(tokenInfo.price) : "..."}
                </div>
              </div>
              <div className="bg-bags-dark p-2 sm:p-3">
                <div className="font-pixel text-[7px] text-gray-500">MCAP</div>
                <div className="font-pixel text-[10px] sm:text-xs text-white">
                  {tokenInfo ? formatMarketCap(tokenInfo.marketCap) : "..."}
                </div>
              </div>
              <div className="bg-bags-dark p-2 sm:p-3">
                <div className="font-pixel text-[7px] text-gray-500">24H VOL</div>
                <div className="font-pixel text-[10px] sm:text-xs text-white">
                  {tokenInfo ? formatMarketCap(tokenInfo.volume24h) : "..."}
                </div>
              </div>
              <div className="bg-bags-dark p-2 sm:p-3">
                <div className="font-pixel text-[7px] text-gray-500">24H</div>
                <div
                  className={`font-pixel text-[10px] sm:text-xs ${change24h >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {tokenInfo ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(1)}%` : "..."}
                </div>
              </div>
              <div className="bg-bags-dark p-2 sm:p-3">
                <div className="font-pixel text-[7px] text-gray-500">LIQUIDITY</div>
                <div className="font-pixel text-[10px] sm:text-xs text-white">
                  {tokenInfo ? formatMarketCap(tokenInfo.liquidity) : "..."}
                </div>
              </div>
              <div className="bg-bags-dark p-2 sm:p-3">
                <div className="font-pixel text-[7px] text-gray-500">FEES (SOL)</div>
                <div className="font-pixel text-[10px] sm:text-xs text-bags-gold">
                  {lifetimeFees !== undefined && lifetimeFees !== null
                    ? lifetimeFees.toFixed(2)
                    : "..."}
                </div>
              </div>
            </div>

            {/* Chart Interval Buttons */}
            <div className="flex gap-1 p-2 border-b border-bags-green/30">
              {(["5m", "15m", "1h", "4h", "1d"] as IntervalType[]).map((iv) => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={`flex-1 py-1 font-pixel text-[8px] transition-colors rounded ${
                    interval === iv
                      ? "bg-bags-green/20 text-bags-green border border-bags-green"
                      : "text-gray-500 border border-gray-700 hover:border-bags-green/50"
                  }`}
                >
                  {iv.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Chart */}
            <div className="p-2">
              <div
                ref={chartContainerRef}
                className="w-full h-[180px] sm:h-[220px] bg-[#0a0a0f] rounded border border-gray-800"
              />
            </div>
          </div>

          {/* Right Column: Trade Panel */}
          <div className="sm:w-72 border-t sm:border-t-0 sm:border-l border-bags-green/30">
            {/* Direction Toggle */}
            <div className="flex border-b border-bags-green/30">
              <button
                onClick={() => setDirection("buy")}
                className={`flex-1 py-2.5 font-pixel text-[10px] transition-colors ${
                  direction === "buy"
                    ? "bg-bags-green/20 text-bags-green border-b-2 border-bags-green"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setDirection("sell")}
                className={`flex-1 py-2.5 font-pixel text-[10px] transition-colors ${
                  direction === "sell"
                    ? "bg-bags-red/20 text-bags-red border-b-2 border-bags-red"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                SELL
              </button>
            </div>

            {/* Trade Form */}
            <div className="p-3 space-y-3">
              {/* Amount Input */}
              <div>
                <label className="block font-pixel text-[8px] text-gray-400 mb-1">
                  {direction === "buy" ? "SOL AMOUNT" : `${tokenSymbol} AMOUNT`}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-bags-darker border-2 border-bags-green p-2.5 pr-14 font-pixel text-sm text-white focus:outline-none focus:border-bags-gold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-pixel text-[10px] text-gray-400">
                    {direction === "buy" ? "SOL" : tokenSymbol}
                  </span>
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-1.5">
                {[0.1, 0.5, 1, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className="flex-1 py-1 border border-bags-green/30 font-pixel text-[8px] text-bags-green hover:bg-bags-green/10"
                  >
                    {val}
                  </button>
                ))}
              </div>

              {/* Slippage */}
              <div>
                <label className="block font-pixel text-[8px] text-gray-400 mb-1">SLIPPAGE</label>
                <div className="flex gap-1.5">
                  {[0.5, 1, 2, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSlippage(val)}
                      className={`flex-1 py-1 border font-pixel text-[8px] transition-colors ${
                        slippage === val
                          ? "border-bags-gold bg-bags-gold/10 text-bags-gold"
                          : "border-bags-green/30 text-gray-400 hover:border-bags-green"
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Quote */}
              {isLoadingQuote && (
                <div className="bg-bags-darker p-2 border border-bags-green/30">
                  <p className="font-pixel text-[10px] text-gray-400 animate-pulse">
                    Getting quote...
                  </p>
                </div>
              )}

              {quote && !isLoadingQuote && (
                <div className="bg-bags-darker p-2 border border-bags-green/30 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-pixel text-[8px] text-gray-400">You receive:</span>
                    <span className="font-pixel text-[10px] text-bags-green">
                      {formatAmount(quote.outAmount, direction === "buy" ? 6 : 9)}{" "}
                      {direction === "buy" ? tokenSymbol : "SOL"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-pixel text-[8px] text-gray-400">Min received:</span>
                    <span className="font-pixel text-[8px] text-gray-400">
                      {formatAmount(quote.minOutAmount, direction === "buy" ? 6 : 9)}{" "}
                      {direction === "buy" ? tokenSymbol : "SOL"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-pixel text-[8px] text-gray-400">Price impact:</span>
                    <span
                      className={`font-pixel text-[8px] ${
                        parseFloat(quote.priceImpactPct) > 5 ? "text-bags-red" : "text-gray-400"
                      }`}
                    >
                      {parseFloat(quote.priceImpactPct).toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Error/Success */}
              {error && (
                <div className="bg-bags-red/20 border-2 border-bags-red p-2">
                  <p className="font-pixel text-[8px] text-bags-red">{error}</p>
                </div>
              )}
              {success && (
                <div className="bg-bags-green/20 border-2 border-bags-green p-2">
                  <p className="font-pixel text-[8px] text-bags-green">{success}</p>
                </div>
              )}

              {/* Swap Button */}
              <button
                onClick={handleSwap}
                disabled={isSwapping || !quote || isLoadingQuote}
                className={`w-full py-2.5 font-pixel text-[10px] border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  direction === "buy"
                    ? "border-bags-green bg-bags-green/20 text-bags-green hover:bg-bags-green/30"
                    : "border-bags-red bg-bags-red/20 text-bags-red hover:bg-bags-red/30"
                }`}
              >
                {isSwapping
                  ? "SWAPPING..."
                  : !connected
                    ? "CONNECT WALLET"
                    : direction === "buy"
                      ? `BUY ${tokenSymbol}`
                      : `SELL ${tokenSymbol}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
