"use client";

// Mini trading widget for Ghost's chat interface
// Shows live trading stats at a glance

import { useGhostStatus, useGhostOpenPositions } from "@/hooks/useElizaAgents";

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
  const exposure = status?.trading?.totalExposureSol || 0;
  const totalPnl = status?.performance?.totalPnlSol || 0;
  const winRate = status?.performance?.winRate || "0%";
  const totalTrades = status?.performance?.totalTrades || 0;

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
        {totalTrades > 0 && (
          <span className="font-pixel text-[7px] text-gray-500">{totalTrades} trades</span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <div>
          <p className="font-pixel text-[6px] text-gray-500">POSITIONS</p>
          <p className="font-pixel text-[10px] text-white">{openCount}/3</p>
        </div>
        <div>
          <p className="font-pixel text-[6px] text-gray-500">EXPOSURE</p>
          <p className="font-pixel text-[10px] text-yellow-400">{exposure.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-pixel text-[6px] text-gray-500">WIN RATE</p>
          <p className="font-pixel text-[10px] text-white">{winRate}</p>
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
          <p className="font-pixel text-[6px] text-gray-500 mb-1">OPEN POSITIONS</p>
          <div className="space-y-1">
            {positions.positions.slice(0, 2).map((pos) => (
              <div key={pos.id} className="flex justify-between items-center">
                <span className="font-pixel text-[8px] text-purple-300">${pos.tokenSymbol}</span>
                <span className="font-pixel text-[7px] text-gray-400">
                  {pos.amountSol.toFixed(3)} SOL
                </span>
              </div>
            ))}
            {positions.positions.length > 2 && (
              <p className="font-pixel text-[6px] text-gray-500 text-center">
                +{positions.positions.length - 2} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick tip */}
      <p className="font-pixel text-[6px] text-purple-400/60 text-center mt-2">
        ask me about my trades or strategy
      </p>
    </div>
  );
}

export default GhostTradingMini;
