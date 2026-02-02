"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getLaunchedTokens,
  removeLaunchedToken,
  fetchGlobalTokens,
  type LaunchedToken,
} from "@/lib/token-registry";
import { TradeModal } from "./TradeModal";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useGameStore } from "@/lib/store";

interface YourBuildingsProps {
  onRefresh?: () => void;
}

export function YourBuildings({ onRefresh }: YourBuildingsProps) {
  const { publicKey } = useWallet();
  const [tokens, setTokens] = useState<LaunchedToken[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [tradeToken, setTradeToken] = useState<LaunchedToken | null>(null);
  const { worldState } = useGameStore();

  // Check if connected wallet is admin using server-side API
  const { isAdmin: isUserAdmin } = useAdminCheck();

  // Get active building mints from worldState (filters out decayed buildings)
  const activeBuildingMints = useMemo(() => {
    if (!worldState?.buildings) return new Set<string>();
    return new Set(
      worldState.buildings
        .filter((b) => !b.isPermanent && !b.isFloating && !b.isMansion)
        .map((b) => b.tokenMint)
    );
  }, [worldState?.buildings]);

  // Filter tokens to only show active buildings (not decayed)
  const activeTokens = useMemo(() => {
    // If worldState loaded but no buildings, show empty (all decayed)
    if (worldState?.buildings && activeBuildingMints.size === 0) {
      return [];
    }
    // If worldState not loaded yet, show tokens from database
    // (database already filters out decayed tokens with health <= 10)
    if (!worldState?.buildings) {
      return tokens;
    }
    // Filter to only show tokens that are active in the world
    return tokens.filter((t) => activeBuildingMints.has(t.mint));
  }, [tokens, activeBuildingMints, worldState?.buildings]);

  useEffect(() => {
    const loadTokens = async () => {
      // Load local tokens first for fast initial render
      const stored = getLaunchedTokens();
      setTokens(stored);

      // Then fetch global tokens from database
      try {
        const globalTokens = await fetchGlobalTokens();
        // Merge: local tokens first, then global (deduplicated by mint)
        const seenMints = new Set(stored.map((t) => t.mint));
        const allTokens = [...stored];
        globalTokens.forEach((gt) => {
          if (!seenMints.has(gt.mint)) {
            allTokens.push(gt);
          }
        });
        setTokens(allTokens);
      } catch (error) {
        console.error("Error loading global tokens:", error);
      }
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

  if (activeTokens.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <div className="w-8 h-8 mx-auto mb-2 border border-dashed border-gray-600 flex items-center justify-center">
          <span className="font-pixel text-gray-600 text-lg">+</span>
        </div>
        <p className="font-pixel text-[9px] text-gray-500">No active buildings</p>
        <p className="font-pixel text-[7px] text-gray-600 mt-1">Launch a token to add one</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-bags-green/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] text-bags-green">BUILDINGS</span>
          <span className="font-pixel text-[8px] text-gray-600">({activeTokens.length})</span>
        </div>
        <span className="font-pixel text-[8px] text-gray-600">{isExpanded ? "−" : "+"}</span>
      </div>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto max-h-36">
          {activeTokens.map((token) => (
            <div
              key={token.mint}
              className="px-3 py-2 border-t border-bags-green/10 hover:bg-bags-green/5 group transition-colors"
            >
              <div className="flex items-center gap-2">
                {/* Token Icon */}
                <div className="w-7 h-7 bg-black/40 border border-bags-green/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {token.imageUrl ? (
                    <img
                      src={token.imageUrl}
                      alt={token.symbol}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-pixel text-[8px] text-bags-green">
                      {token.symbol.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-pixel text-[9px] text-bags-gold">${token.symbol}</span>
                    {token.lifetimeFees && token.lifetimeFees > 0 && (
                      <span className="font-pixel text-[7px] text-bags-green">
                        +{token.lifetimeFees.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="font-pixel text-[7px] text-gray-500 truncate">{token.name}</p>
                </div>

                {/* Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTradeToken(token);
                  }}
                  className="font-pixel text-[7px] px-2 py-1 text-bags-green hover:text-bags-gold opacity-0 group-hover:opacity-100 transition-all"
                >
                  TRADE
                </button>
                {isUserAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(token.mint);
                    }}
                    className="font-pixel text-[7px] px-1 text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
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
