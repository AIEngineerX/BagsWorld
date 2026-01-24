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
  }>;
  totalLifetimeFees: number;
  firstLaunch: number;
}

interface LauncherHubProps {
  onClose: () => void;
}

export function LauncherHub({ onClose }: LauncherHubProps) {
  const [creators, setCreators] = useState<CreatorStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);

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
            });
            existing.totalLifetimeFees += token.lifetimeFees || 0;
            if (token.createdAt < existing.firstLaunch) {
              existing.firstLaunch = token.createdAt;
            }
          } else {
            creatorMap.set(token.creator, {
              wallet: token.creator,
              tokenCount: 1,
              tokens: [
                {
                  symbol: token.symbol,
                  name: token.name,
                  mint: token.mint,
                  imageUrl: token.imageUrl,
                },
              ],
              totalLifetimeFees: token.lifetimeFees || 0,
              firstLaunch: token.createdAt,
            });
          }
        }
      }

      // Sort by token count
      const creatorList = Array.from(creatorMap.values()).sort(
        (a, b) => b.tokenCount - a.tokenCount
      );
      setCreators(creatorList);
    } catch (error) {
      console.error("Error loading creators:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const truncateWallet = (wallet: string) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  const formatSOL = (lamports: number) => {
    if (!lamports) return "0";
    const sol = lamports / 1_000_000_000;
    return sol < 0.01 ? "<0.01" : sol.toFixed(2);
  };

  const selectedCreatorData = selectedCreator
    ? creators.find((c) => c.wallet === selectedCreator)
    : null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border-2 border-bags-green w-full max-w-sm max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-bags-green px-3 py-2 flex justify-between items-center">
          <span className="font-pixel text-black text-xs">LAUNCHERS</span>
          <button onClick={onClose} className="font-pixel text-black hover:text-red-800 text-xs">
            [X]
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <span className="font-pixel text-[10px] text-gray-500 animate-pulse">LOADING...</span>
            </div>
          ) : creators.length === 0 ? (
            <div className="p-4 text-center">
              <p className="font-pixel text-[10px] text-gray-500">NO LAUNCHERS YET</p>
            </div>
          ) : selectedCreatorData ? (
            /* Detail View */
            <div className="p-3">
              <button
                onClick={() => setSelectedCreator(null)}
                className="font-pixel text-[8px] text-bags-green hover:text-white mb-2"
              >
                {"<"} BACK
              </button>

              <div className="border border-bags-green/50 p-2 mb-2">
                <a
                  href={`https://solscan.io/account/${selectedCreatorData.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-bags-green hover:text-bags-gold block"
                >
                  {truncateWallet(selectedCreatorData.wallet)}
                </a>
                <div className="font-pixel text-[8px] text-gray-500 mt-1">
                  {selectedCreatorData.tokenCount} TOKENS |{" "}
                  {formatSOL(selectedCreatorData.totalLifetimeFees)} SOL FEES
                </div>
              </div>

              <div className="space-y-1">
                {selectedCreatorData.tokens.map((token) => (
                  <div
                    key={token.mint}
                    className="flex items-center gap-2 border border-bags-green/30 p-1"
                  >
                    {token.imageUrl ? (
                      <img src={token.imageUrl} alt="" className="w-5 h-5" />
                    ) : (
                      <div className="w-5 h-5 bg-bags-green/20 flex items-center justify-center">
                        <span className="font-pixel text-[6px] text-bags-green">?</span>
                      </div>
                    )}
                    <span className="font-pixel text-[9px] text-white">${token.symbol}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* List View */
            <div>
              {creators.map((creator, i) => (
                <button
                  key={creator.wallet}
                  onClick={() => setSelectedCreator(creator.wallet)}
                  className="w-full flex items-center gap-2 p-2 border-b border-bags-green/20 hover:bg-bags-green/10 text-left"
                >
                  <span
                    className={`font-pixel text-[8px] w-4 ${
                      i === 0
                        ? "text-yellow-400"
                        : i === 1
                          ? "text-gray-400"
                          : i === 2
                            ? "text-amber-600"
                            : "text-gray-600"
                    }`}
                  >
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[9px] text-white">
                      {truncateWallet(creator.wallet)}
                    </span>
                  </div>
                  <span className="font-pixel text-[8px] text-bags-green">
                    {creator.tokenCount}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-bags-green/20 px-3 py-1 border-t border-bags-green">
          <span className="font-pixel text-[8px] text-bags-green">
            {creators.length} CREATORS | {creators.reduce((s, c) => s + c.tokenCount, 0)} TOKENS
          </span>
        </div>
      </div>
    </div>
  );
}
