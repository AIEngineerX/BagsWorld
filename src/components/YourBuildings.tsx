"use client";

import { useState, useEffect } from "react";
import {
  getLaunchedTokens,
  removeLaunchedToken,
  type LaunchedToken,
} from "@/lib/token-registry";
import { TradeModal } from "./TradeModal";

interface YourBuildingsProps {
  onRefresh?: () => void;
}

export function YourBuildings({ onRefresh }: YourBuildingsProps) {
  const [tokens, setTokens] = useState<LaunchedToken[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [tradeToken, setTradeToken] = useState<LaunchedToken | null>(null);

  useEffect(() => {
    const loadTokens = () => {
      const stored = getLaunchedTokens();
      setTokens(stored);
    };

    loadTokens();

    // Listen for token updates
    const handleUpdate = () => loadTokens();
    window.addEventListener("bagsworld-token-update", handleUpdate);
    window.addEventListener("storage", (e) => {
      if (e.key === "bagsworld_tokens") loadTokens();
    });

    return () => {
      window.removeEventListener("bagsworld-token-update", handleUpdate);
    };
  }, []);

  const handleRemove = (mint: string) => {
    if (confirm("Remove this building from your world?")) {
      removeLaunchedToken(mint);
      setTokens(tokens.filter((t) => t.mint !== mint));
      window.dispatchEvent(new CustomEvent("bagsworld-token-update"));
      if (onRefresh) onRefresh();
    }
  };

  const formatAge = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (tokens.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-2xl mb-2">🏗️</div>
        <p className="font-pixel text-[10px] text-gray-400 mb-2">
          No buildings yet!
        </p>
        <p className="font-pixel text-[8px] text-gray-500">
          Launch a token to build your first structure
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="p-2 border-b border-bags-green/30 flex items-center justify-between cursor-pointer hover:bg-bags-green/5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🏢</span>
          <span className="font-pixel text-[10px] text-bags-green">
            YOUR BUILDINGS
          </span>
          <span className="font-pixel text-[8px] text-gray-500">
            ({tokens.length})
          </span>
        </div>
        <span className="font-pixel text-[10px] text-gray-500">
          {isExpanded ? "▼" : "▶"}
        </span>
      </div>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto">
          {tokens.map((token, index) => (
            <div
              key={token.mint}
              className="p-3 border-b border-bags-green/10 hover:bg-bags-green/5 group"
            >
              <div className="flex items-start gap-3">
                {/* Building Icon/Image */}
                <div className="w-10 h-10 bg-bags-darker border border-bags-green/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {token.imageUrl ? (
                    <img
                      src={token.imageUrl}
                      alt={token.symbol}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg">
                      {index === 0
                        ? "🏛️"
                        : index === 1
                          ? "🏢"
                          : index === 2
                            ? "🏠"
                            : "🏗️"}
                    </span>
                  )}
                </div>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-[10px] text-bags-gold">
                      ${token.symbol}
                    </span>
                    <span className="font-pixel text-[8px] text-gray-500">
                      {formatAge(token.createdAt)}
                    </span>
                  </div>
                  <p className="font-pixel text-[8px] text-gray-400 truncate">
                    {token.name}
                  </p>
                  {token.lifetimeFees && token.lifetimeFees > 0 ? (
                    <p className="font-pixel text-[8px] text-bags-green mt-1">
                      +{token.lifetimeFees.toFixed(2)} SOL fees
                    </p>
                  ) : null}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTradeToken(token);
                    }}
                    className="font-pixel text-[7px] px-2 py-1 bg-bags-green/20 text-bags-green hover:bg-bags-green/30 border border-bags-green/30"
                    title="Trade token"
                  >
                    TRADE
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(token.mint);
                    }}
                    className="font-pixel text-[7px] px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    title="Remove building"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Fee Shares */}
              {token.feeShares && token.feeShares.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {token.feeShares.slice(0, 3).map((share, i) => (
                    <span
                      key={i}
                      className="font-pixel text-[7px] px-1 py-0.5 bg-bags-green/10 text-bags-green rounded"
                    >
                      @{share.username} {(share.bps / 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Trade Modal */}
      {tradeToken && (
        <TradeModal
          tokenMint={tradeToken.mint}
          tokenSymbol={tradeToken.symbol}
          tokenName={tradeToken.name}
          onClose={() => setTradeToken(null)}
        />
      )}
    </div>
  );
}
