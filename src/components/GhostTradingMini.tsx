"use client";

// Mini trading widget for Ghost's chat interface
// Shows live trading stats with real-time price action and recent trade feed

import { useState, useEffect, useCallback } from "react";
import {
  useGhostStatus,
  useGhostOpenPositions,
  useGhostPositions,
} from "@/hooks/useElizaAgents";

// Live price data for a token
interface LivePrice {
  priceUsd: number;
  priceNative: number; // SOL price
  priceChange24h: number;
  lastUpdated: number;
}

// Cache for price data
const priceCache = new Map<string, LivePrice>();

// Format time ago
function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Clean up symbol display
function formatSymbol(symbol: string): string {
  // If it looks like a mint address (long alphanumeric), truncate
  if (symbol.length > 10 && /^[A-Za-z0-9]+$/.test(symbol)) {
    return symbol.slice(0, 6) + "...";
  }
  return symbol;
}

// Fetch live price from DexScreener
async function fetchTokenPrice(mint: string): Promise<LivePrice | null> {
  // Check cache (valid for 10 seconds)
  const cached = priceCache.get(mint);
  if (cached && Date.now() - cached.lastUpdated < 10000) {
    return cached;
  }

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (!res.ok) return null;

    const data = await res.json();
    const pair = data.pairs?.[0];
    if (!pair) return null;

    const price: LivePrice = {
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceNative: parseFloat(pair.priceNative) || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      lastUpdated: Date.now(),
    };

    priceCache.set(mint, price);
    return price;
  } catch {
    return null;
  }
}

// Hook to track live prices for multiple tokens
function useLivePrices(mints: string[]) {
  const [prices, setPrices] = useState<Map<string, LivePrice>>(new Map());

  const fetchPrices = useCallback(async () => {
    if (mints.length === 0) return;

    const newPrices = new Map<string, LivePrice>();
    await Promise.all(
      mints.map(async (mint) => {
        const price = await fetchTokenPrice(mint);
        if (price) newPrices.set(mint, price);
      })
    );

    setPrices(newPrices);
  }, [mints.join(",")]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return prices;
}

export function GhostTradingMini() {
  const { data: status, isLoading } = useGhostStatus();
  const { data: positions } = useGhostOpenPositions();
  const { data: allPositions } = useGhostPositions();

  // Get mints for open positions to fetch live prices
  const openMints = positions?.positions?.map((p: any) => p.tokenMint).filter(Boolean) || [];
  const livePrices = useLivePrices(openMints);

  // Get recent closed trades for the feed
  const closedTrades = (allPositions?.positions || [])
    .filter((p: any) => p.status === "closed" && p.closedAt)
    .sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="p-3 bg-purple-500/5 border-b border-purple-500/20 animate-pulse">
        <div className="h-16 bg-purple-500/10 rounded" />
      </div>
    );
  }

  const isEnabled = status?.trading?.enabled || false;
  const openCount = status?.trading?.openPositions || 0;
  const walletAddress = status?.wallet?.address || null;
  const totalTrades = status?.performance?.totalTrades || 0;
  const winRate = status?.performance?.winRate as number | undefined;

  // Handle masked data (returns "***" for non-admin requests)
  const rawBalance = status?.wallet?.balanceSol;
  const rawPnl = status?.performance?.totalPnlSol;
  const rawExposure = status?.trading?.totalExposureSol;

  const walletBalance = typeof rawBalance === "number" ? rawBalance : null;
  const totalPnl = typeof rawPnl === "number" ? rawPnl : null;
  const exposure = typeof rawExposure === "number" ? rawExposure : null;

  // Format wallet for display (first 4 + last 4)
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <div className="p-3 bg-purple-500/8 border-b-2 border-purple-500/30">
      {/* Status Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${isEnabled ? "bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-red-400"}`}
          />
          <span
            className={`font-pixel text-[11px] font-bold tracking-wide ${isEnabled ? "text-green-400" : "text-red-400"}`}
          >
            {isEnabled ? "TRADING LIVE" : "TRADING OFF"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalTrades > 0 && (
            <span className="font-pixel text-[9px] text-gray-400">
              {totalTrades} trades
              {typeof winRate === "number" ? ` | ${winRate.toFixed(0)}% WR` : ""}
            </span>
          )}
          {shortWallet && (
            <a
              href={`https://solscan.io/account/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-[9px] text-purple-400 hover:text-purple-300 underline"
              title={walletAddress || undefined}
            >
              {shortWallet}
            </a>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 text-center bg-purple-500/10 rounded-md p-2 mb-2">
        <div>
          <p className="font-pixel text-[8px] text-gray-400 mb-0.5">POSITIONS</p>
          <p className="font-pixel text-[13px] text-white font-bold">{openCount}/3</p>
        </div>
        <div>
          <p className="font-pixel text-[8px] text-gray-400 mb-0.5">BALANCE</p>
          <p className="font-pixel text-[13px] text-yellow-400 font-bold">
            {walletBalance !== null ? `${walletBalance.toFixed(2)}` : "***"}
          </p>
        </div>
        <div>
          <p className="font-pixel text-[8px] text-gray-400 mb-0.5">EXPOSURE</p>
          <p className="font-pixel text-[13px] text-purple-300 font-bold">
            {exposure !== null ? exposure.toFixed(2) : "***"}
          </p>
        </div>
        <div>
          <p className="font-pixel text-[8px] text-gray-400 mb-0.5">P&L</p>
          <p
            className={`font-pixel text-[13px] font-bold ${totalPnl === null ? "text-gray-500" : totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}
          >
            {totalPnl !== null ? `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(3)}` : "***"}
          </p>
        </div>
      </div>

      {/* Open Positions */}
      {positions?.positions && positions.positions.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <p className="font-pixel text-[9px] text-gray-400 font-bold">OPEN POSITIONS</p>
            <p className="font-pixel text-[8px] text-gray-500">SL: -15% | TP: 1.5x-3x</p>
          </div>
          <div className="space-y-1">
            {positions.positions.slice(0, 3).map((pos: any) => {
              const symbol = pos.tokenSymbol || pos.tokenMint?.slice(0, 6) || "???";
              const displaySymbol = formatSymbol(symbol);
              const dexUrl = pos.tokenMint
                ? `https://dexscreener.com/solana/${pos.tokenMint}`
                : null;

              // Calculate live P&L if we have price data
              const livePrice = pos.tokenMint ? livePrices.get(pos.tokenMint) : null;
              const entryPrice = pos.entryPriceSol || pos.entryPriceNative || pos.entryPrice || 0;
              let pnlPercent: number | null = null;
              if (livePrice && entryPrice > 0) {
                pnlPercent = ((livePrice.priceNative - entryPrice) / entryPrice) * 100;
              }

              return (
                <div
                  key={pos.id}
                  className="flex justify-between items-center bg-purple-500/15 rounded-md px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    {dexUrl ? (
                      <a
                        href={dexUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-pixel text-[11px] text-purple-300 hover:text-purple-100 font-bold underline"
                        title={`View ${symbol} on DexScreener`}
                      >
                        ${displaySymbol}
                      </a>
                    ) : (
                      <span className="font-pixel text-[11px] text-purple-300 font-bold">
                        ${displaySymbol}
                      </span>
                    )}
                    <span className="font-pixel text-[8px] text-gray-500">
                      {timeAgo(pos.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pnlPercent !== null && (
                      <span
                        className={`font-pixel text-[10px] font-bold ${pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {pnlPercent >= 0 ? "+" : ""}
                        {pnlPercent.toFixed(1)}%
                      </span>
                    )}
                    <span className="font-pixel text-[10px] text-yellow-400">
                      {pos.amountSol?.toFixed(2) || "0.00"} SOL
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Trades Feed */}
      {closedTrades.length > 0 && (
        <div className="border-t border-purple-500/20 pt-2">
          <p className="font-pixel text-[9px] text-gray-400 font-bold mb-1">RECENT TRADES</p>
          <div className="space-y-1">
            {closedTrades.map((trade: any) => {
              const symbol = trade.tokenSymbol || trade.tokenMint?.slice(0, 6) || "???";
              const displaySymbol = formatSymbol(symbol);
              const pnl = trade.pnlSol || 0;
              const isWin = pnl > 0;
              const dexUrl = trade.tokenMint
                ? `https://dexscreener.com/solana/${trade.tokenMint}`
                : null;

              return (
                <div
                  key={trade.id}
                  className={`flex justify-between items-center rounded-md px-2 py-1 ${isWin ? "bg-green-500/10" : "bg-red-500/10"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-pixel text-[9px] ${isWin ? "text-green-500" : "text-red-500"}`}>
                      {isWin ? "W" : "L"}
                    </span>
                    {dexUrl ? (
                      <a
                        href={dexUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-pixel text-[10px] text-gray-300 hover:text-white underline"
                      >
                        ${displaySymbol}
                      </a>
                    ) : (
                      <span className="font-pixel text-[10px] text-gray-300">
                        ${displaySymbol}
                      </span>
                    )}
                    <span className="font-pixel text-[8px] text-gray-500">
                      {timeAgo(trade.closedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-pixel text-[10px] font-bold ${isWin ? "text-green-400" : "text-red-400"}`}
                    >
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(3)} SOL
                    </span>
                    {trade.exitReason && (
                      <span className="font-pixel text-[7px] text-gray-500">
                        {trade.exitReason}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exit rules reminder */}
      {openCount > 0 && (
        <p className="font-pixel text-[8px] text-gray-500 text-center mt-2 animate-pulse">
          watching for exits...
        </p>
      )}

      {/* Quick tip */}
      <p className="font-pixel text-[8px] text-purple-400/60 text-center mt-2">
        ask me about my trades or strategy
      </p>
    </div>
  );
}

export default GhostTradingMini;
