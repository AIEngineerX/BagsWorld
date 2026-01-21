"use client";

import { useState, useEffect } from "react";
import { fetchGlobalTokens } from "@/lib/token-registry";

interface CreatorStats {
  wallet: string;
  tokenCount: number;
  tokens: Array<{
    symbol: string;
    name: string;
    mint: string;
    imageUrl?: string;
    lifetimeFees?: number;
    marketCap?: number;
  }>;
  totalLifetimeFees: number;
  totalMarketCap: number;
  firstLaunch: number;
}

interface LauncherHubProps {
  onClose: () => void;
}

export function LauncherHub({ onClose }: LauncherHubProps) {
  const [creators, setCreators] = useState<CreatorStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"tokens" | "fees" | "recent">("tokens");

  useEffect(() => {
    loadCreators();
  }, []);

  async function loadCreators() {
    setIsLoading(true);
    try {
      const tokens = await fetchGlobalTokens();
      const creatorMap = new Map<string, CreatorStats>();

      for (const token of tokens) {
        if (token.creator) {
          const existing = creatorMap.get(token.creator);
          if (existing) {
            existing.tokenCount++;
            existing.tokens.push({
              symbol: token.symbol,
              name: token.name,
              mint: token.mint,
              imageUrl: token.imageUrl,
              lifetimeFees: token.lifetimeFees,
              marketCap: token.marketCap,
            });
            existing.totalLifetimeFees += token.lifetimeFees || 0;
            existing.totalMarketCap += token.marketCap || 0;
            if (token.createdAt < existing.firstLaunch) {
              existing.firstLaunch = token.createdAt;
            }
          } else {
            creatorMap.set(token.creator, {
              wallet: token.creator,
              tokenCount: 1,
              tokens: [{
                symbol: token.symbol,
                name: token.name,
                mint: token.mint,
                imageUrl: token.imageUrl,
                lifetimeFees: token.lifetimeFees,
                marketCap: token.marketCap,
              }],
              totalLifetimeFees: token.lifetimeFees || 0,
              totalMarketCap: token.marketCap || 0,
              firstLaunch: token.createdAt,
            });
          }
        }
      }

      const creatorList = Array.from(creatorMap.values());
      setCreators(creatorList);
    } catch (error) {
      console.error("Error loading creators:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const sortedCreators = [...creators].sort((a, b) => {
    switch (sortBy) {
      case "tokens":
        return b.tokenCount - a.tokenCount;
      case "fees":
        return b.totalLifetimeFees - a.totalLifetimeFees;
      case "recent":
        return b.firstLaunch - a.firstLaunch;
      default:
        return 0;
    }
  });

  const truncateWallet = (wallet: string) => {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const formatSOL = (lamports: number) => {
    if (!lamports) return "0";
    const sol = lamports / 1_000_000_000;
    if (sol < 0.01) return "<0.01";
    return sol.toFixed(2);
  };

  const formatMarketCap = (mc: number) => {
    if (!mc) return "$0";
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(1)}M`;
    if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
    return `$${mc.toFixed(0)}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const selectedCreatorData = selectedCreator
    ? creators.find(c => c.wallet === selectedCreator)
    : null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-4 border-bags-green w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b-4 border-bags-green">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-bags-green/20 border border-bags-green flex items-center justify-center">
              <span className="font-pixel text-bags-green text-xs">L</span>
            </div>
            <div>
              <h2 className="font-pixel text-bags-green text-xs">LAUNCHER HUB</h2>
              <p className="font-pixel text-[8px] text-gray-400">
                {creators.length} creator{creators.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs p-2 text-gray-400 hover:text-white border border-gray-700 hover:border-bags-green"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        {/* Sort Options */}
        <div className="p-2 border-b border-bags-green/30 flex items-center gap-2">
          <span className="font-pixel text-[8px] text-gray-500">SORT:</span>
          {(["tokens", "fees", "recent"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`font-pixel text-[8px] px-2 py-1 border ${
                sortBy === option
                  ? "border-bags-green bg-bags-green/20 text-bags-green"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {option === "tokens" ? "TOKENS" : option === "fees" ? "FEES" : "RECENT"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="font-pixel text-[10px] text-gray-400 animate-pulse">
                Loading creators...
              </span>
            </div>
          ) : creators.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-pixel text-[10px] text-gray-400">No launchers yet</p>
              <p className="font-pixel text-[8px] text-gray-500 mt-2">
                Be the first to launch on BagsWorld!
              </p>
            </div>
          ) : selectedCreatorData ? (
            /* Creator Detail View */
            <div>
              <button
                onClick={() => setSelectedCreator(null)}
                className="font-pixel text-[8px] text-bags-green hover:text-white mb-3"
              >
                &lt; BACK
              </button>

              <div className="bg-bags-darker p-3 border border-bags-green/30">
                {/* Creator Header */}
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-bags-green/20">
                  <div className="w-10 h-10 bg-bags-green/20 border border-bags-green flex items-center justify-center">
                    <span className="font-pixel text-bags-green text-sm">
                      {selectedCreatorData.tokenCount}
                    </span>
                  </div>
                  <div className="flex-1">
                    <a
                      href={`https://solscan.io/account/${selectedCreatorData.wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-bags-green hover:text-bags-gold"
                    >
                      {truncateWallet(selectedCreatorData.wallet)}
                    </a>
                    <p className="font-pixel text-[8px] text-gray-400">
                      {selectedCreatorData.tokenCount} token{selectedCreatorData.tokenCount !== 1 ? "s" : ""} launched
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-bags-dark p-2 border border-bags-green/20">
                    <p className="font-pixel text-[7px] text-gray-500">TOTAL FEES</p>
                    <p className="font-pixel text-xs text-bags-gold">
                      {formatSOL(selectedCreatorData.totalLifetimeFees)} SOL
                    </p>
                  </div>
                  <div className="bg-bags-dark p-2 border border-bags-green/20">
                    <p className="font-pixel text-[7px] text-gray-500">TOTAL MCAP</p>
                    <p className="font-pixel text-xs text-white">
                      {formatMarketCap(selectedCreatorData.totalMarketCap)}
                    </p>
                  </div>
                </div>

                {/* Tokens List */}
                <p className="font-pixel text-[8px] text-gray-500 mb-2">TOKENS:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selectedCreatorData.tokens.map((token) => (
                    <div
                      key={token.mint}
                      className="flex items-center gap-2 bg-bags-dark p-2 border border-bags-green/10"
                    >
                      {token.imageUrl ? (
                        <img
                          src={token.imageUrl}
                          alt={token.symbol}
                          className="w-6 h-6"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-bags-green/10 border border-bags-green/30 flex items-center justify-center">
                          <span className="font-pixel text-[6px] text-gray-500">?</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-pixel text-[10px] text-white truncate">${token.symbol}</p>
                        <p className="font-pixel text-[7px] text-gray-500 truncate">{token.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-pixel text-[8px] text-bags-gold">
                          {formatSOL(token.lifetimeFees || 0)} SOL
                        </p>
                        <p className="font-pixel text-[7px] text-gray-500">
                          {formatMarketCap(token.marketCap || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Creator List View */
            <div className="space-y-2">
              {sortedCreators.map((creator, index) => (
                <button
                  key={creator.wallet}
                  onClick={() => setSelectedCreator(creator.wallet)}
                  className="w-full bg-bags-darker hover:bg-bags-green/10 p-2 border border-bags-green/20 hover:border-bags-green transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {/* Rank */}
                    <div className={`w-6 h-6 flex items-center justify-center border ${
                      index === 0 ? "bg-yellow-500/20 border-yellow-500 text-yellow-500" :
                      index === 1 ? "bg-gray-400/20 border-gray-400 text-gray-400" :
                      index === 2 ? "bg-amber-700/20 border-amber-700 text-amber-600" :
                      "bg-bags-dark border-gray-700 text-gray-500"
                    }`}>
                      <span className="font-pixel text-[8px]">
                        {index + 1}
                      </span>
                    </div>

                    {/* Wallet Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[10px] text-white">
                        {truncateWallet(creator.wallet)}
                      </p>
                      <p className="font-pixel text-[7px] text-gray-500">
                        {creator.tokenCount} token{creator.tokenCount !== 1 ? "s" : ""}
                        {" · "}
                        {formatTimeAgo(creator.firstLaunch)}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-pixel text-[8px] text-bags-gold">
                        {formatSOL(creator.totalLifetimeFees)} SOL
                      </p>
                      <p className="font-pixel text-[7px] text-gray-500">
                        {formatMarketCap(creator.totalMarketCap)}
                      </p>
                    </div>
                  </div>

                  {/* Token Previews */}
                  {creator.tokens.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {creator.tokens.slice(0, 5).map((token) => (
                        token.imageUrl ? (
                          <img
                            key={token.mint}
                            src={token.imageUrl}
                            alt={token.symbol}
                            className="w-5 h-5 border border-bags-green/20"
                            title={`$${token.symbol}`}
                          />
                        ) : (
                          <div
                            key={token.mint}
                            className="w-5 h-5 bg-bags-dark border border-bags-green/20 flex items-center justify-center"
                            title={`$${token.symbol}`}
                          >
                            <span className="font-pixel text-[5px] text-gray-500">
                              {token.symbol.charAt(0)}
                            </span>
                          </div>
                        )
                      ))}
                      {creator.tokens.length > 5 && (
                        <div className="w-5 h-5 bg-bags-dark border border-bags-green/20 flex items-center justify-center">
                          <span className="font-pixel text-[6px] text-gray-500">
                            +{creator.tokens.length - 5}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="p-2 border-t-4 border-bags-green bg-bags-darker">
          <div className="flex justify-between font-pixel text-[8px]">
            <span className="text-gray-500">
              {creators.reduce((sum, c) => sum + c.tokenCount, 0)} TOKENS
            </span>
            <span className="text-bags-gold">
              {formatSOL(creators.reduce((sum, c) => sum + c.totalLifetimeFees, 0))} SOL FEES
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
