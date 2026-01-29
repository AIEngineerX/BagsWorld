"use client";

// Mini trading widget for Ghost's chat interface
// Shows live trading stats at a glance

import { useGhostStatus, useGhostOpenPositions } from "@/hooks/useElizaAgents";

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

export function GhostTradingMini() {
  const { data: status, isLoading } = useGhostStatus();
  const { data: positions } = useGhostOpenPositions();

  if (isLoading) {
    return (
      <div className="p-2 bg-purple-500/5 border-b border-purple-500/20 animate-pulse">
        <div className="h-12 bg-purple-500/10 rounded" />
      </div>
    );
  }

  const isEnabled = status?.trading?.enabled || false;
  const openCount = status?.trading?.openPositions || 0;
  const walletAddress = status?.wallet?.address || null;
  const walletBalance = status?.wallet?.balanceSol || 0;
  const totalPnl = status?.performance?.totalPnlSol || 0;
  const totalTrades = status?.performance?.totalTrades || 0;
  const exposure = status?.trading?.totalExposureSol || 0;

  // Format wallet for display (first 4 + last 4)
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <div className="p-2 bg-purple-500/5 border-b border-purple-500/20">
      {/* Status Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isEnabled ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
          />
          <span
            className={`font-pixel text-[8px] ${isEnabled ? "text-green-400" : "text-red-400"}`}
          >
            {isEnabled ? "TRADING LIVE" : "TRADING OFF"}
          </span>
        </div>
        {shortWallet ? (
          <a
            href={`https://solscan.io/account/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[7px] text-purple-400 hover:text-purple-300 underline"
            title={walletAddress || undefined}
          >
            {shortWallet}
          </a>
        ) : totalTrades > 0 ? (
          <span className="font-pixel text-[7px] text-gray-500">{totalTrades} trades</span>
        ) : null}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <div>
          <p className="font-pixel text-[6px] text-gray-500">POSITIONS</p>
          <p className="font-pixel text-[10px] text-white">{openCount}/3</p>
        </div>
        <div>
          <p className="font-pixel text-[6px] text-gray-500">BALANCE</p>
          <p className="font-pixel text-[10px] text-yellow-400">{walletBalance.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-pixel text-[6px] text-gray-500">EXPOSURE</p>
          <p className="font-pixel text-[10px] text-purple-300">{exposure.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-pixel text-[6px] text-gray-500">P&L</p>
          <p
            className={`font-pixel text-[10px] ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}
          >
            {totalPnl >= 0 ? "+" : ""}
            {totalPnl.toFixed(3)}
          </p>
        </div>
      </div>

      {/* Open Positions Preview */}
      {positions?.positions && positions.positions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-purple-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="font-pixel text-[6px] text-gray-500">OPEN POSITIONS</p>
            <p className="font-pixel text-[6px] text-gray-600">SL: -15% | TP: 1.5x-3x</p>
          </div>
          <div className="space-y-1">
            {positions.positions.slice(0, 3).map((pos: any) => {
              const symbol = pos.tokenSymbol || pos.tokenMint?.slice(0, 6) || "???";
              const displaySymbol = formatSymbol(symbol);
              const dexUrl = pos.tokenMint
                ? `https://dexscreener.com/solana/${pos.tokenMint}`
                : null;

              return (
                <div
                  key={pos.id}
                  className="flex justify-between items-center bg-purple-500/10 rounded px-1 py-0.5"
                >
                  <div className="flex items-center gap-1">
                    {dexUrl ? (
                      <a
                        href={dexUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-pixel text-[8px] text-purple-300 hover:text-purple-100 font-bold underline"
                        title={`View ${symbol} on DexScreener`}
                      >
                        ${displaySymbol}
                      </a>
                    ) : (
                      <span className="font-pixel text-[8px] text-purple-300 font-bold">
                        ${displaySymbol}
                      </span>
                    )}
                    <span className="font-pixel text-[6px] text-gray-500">
                      {timeAgo(pos.createdAt)}
                    </span>
                  </div>
                  <span className="font-pixel text-[7px] text-yellow-400">
                    {pos.amountSol?.toFixed(2) || "0.00"} SOL
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exit rules reminder */}
      {openCount > 0 && (
        <p className="font-pixel text-[6px] text-gray-600 text-center mt-1">
          watching for exits...
        </p>
      )}

      {/* Quick tip */}
      <p className="font-pixel text-[6px] text-purple-400/60 text-center mt-2">
        ask me about my trades or strategy
      </p>
    </div>
  );
}

export default GhostTradingMini;
