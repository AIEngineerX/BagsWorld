"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useGameStore } from "@/lib/store";
import type { ClaimablePosition } from "@/lib/types";

interface PokeCenterModalProps {
  onClose: () => void;
  onOpenFeeClaimModal: () => void;
}

export function PokeCenterModal({ onClose, onOpenFeeClaimModal }: PokeCenterModalProps) {
  const { publicKey, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { worldState } = useGameStore();

  const [positions, setPositions] = useState<ClaimablePosition[]>([]);
  const [totalClaimable, setTotalClaimable] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"human" | "agent">("human");

  useEffect(() => {
    if (connected && publicKey) {
      fetchPositions(publicKey.toBase58());
    }
  }, [connected, publicKey]);

  const fetchPositions = async (wallet: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-positions", wallet }),
      });
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
        setTotalClaimable(data.totalClaimable || 0);
      }
    } catch (err) {
      console.error("Error fetching positions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const citizenCount =
    worldState?.population?.filter(
      (c) =>
        !c.isToly &&
        !c.isAsh &&
        !c.isFinn &&
        !c.isDev &&
        !c.isScout &&
        !c.isCJ &&
        !c.isShaw &&
        !c.isRamo &&
        !c.isSincara &&
        !c.isStuu &&
        !c.isSam &&
        !c.isAlaa &&
        !c.isCarlo &&
        !c.isBNN &&
        !c.isProfessorOak
    ).length || 0;
  const buildingCount =
    worldState?.buildings?.filter((b) => !b.isPermanent && !b.isFloating && !b.isMansion).length ||
    0;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-2 border-red-500 w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-lg">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 p-3 sm:p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded flex items-center justify-center">
              <span className="font-pixel text-lg sm:text-xl text-white">?</span>
            </div>
            <div>
              <h2 className="font-pixel text-white text-xs sm:text-sm">HOW IT WORKS</h2>
              <p className="font-pixel text-red-200 text-[7px] sm:text-[8px]">BagsWorld Guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 font-pixel text-sm p-2"
          >
            [X]
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Tab Switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("human")}
              className={`flex-1 font-pixel text-xs py-2 rounded transition-colors ${
                activeTab === "human"
                  ? "bg-bags-green text-black"
                  : "bg-bags-darker text-gray-400 hover:text-white"
              }`}
            >
              👤 Humans
            </button>
            <button
              onClick={() => setActiveTab("agent")}
              className={`flex-1 font-pixel text-xs py-2 rounded transition-colors ${
                activeTab === "agent"
                  ? "bg-purple-600 text-white"
                  : "bg-bags-darker text-gray-400 hover:text-white"
              }`}
            >
              🤖 Agents
            </button>
          </div>

          {activeTab === "human" ? (
            /* ===== HUMAN TAB ===== */
            <div className="space-y-4">
              {/* World Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bags-darker rounded p-3 text-center">
                  <div className="text-2xl mb-1">🏢</div>
                  <div className="font-pixel text-bags-green text-lg">{buildingCount}</div>
                  <div className="font-pixel text-gray-500 text-[8px]">Buildings</div>
                </div>
                <div className="bg-bags-darker rounded p-3 text-center">
                  <div className="text-2xl mb-1">👥</div>
                  <div className="font-pixel text-bags-green text-lg">{citizenCount}</div>
                  <div className="font-pixel text-gray-500 text-[8px]">Citizens</div>
                </div>
              </div>

              {/* How It Works - Human */}
              <div className="bg-bags-darker rounded p-3 space-y-3">
                <h3 className="font-pixel text-bags-green text-xs">How It Works</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-pixel text-bags-gold text-sm">1.</span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">Connect Wallet</p>
                      <p className="font-pixel text-gray-500 text-[8px]">
                        Link your Solana wallet to join
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-pixel text-bags-gold text-sm">2.</span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">Launch or Trade Tokens</p>
                      <p className="font-pixel text-gray-500 text-[8px]">
                        Create tokens via Professor Oak or trade existing ones
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-pixel text-bags-gold text-sm">3.</span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">Earn Fees</p>
                      <p className="font-pixel text-gray-500 text-[8px]">
                        Token creators earn SOL from every trade
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-pixel text-bags-gold text-sm">4.</span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">Claim Rewards</p>
                      <p className="font-pixel text-gray-500 text-[8px]">
                        Come back here to claim your earnings
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Claim Section */}
              <div className="bg-green-900/20 border border-green-500/50 rounded p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-green-400 text-xs">💰 Your Claimable Fees</span>
                  {isLoading && (
                    <span className="font-pixel text-gray-500 text-[8px]">Loading...</span>
                  )}
                </div>

                {!connected ? (
                  <div className="text-center py-2">
                    <button
                      onClick={() => setWalletModalVisible(true)}
                      className="bg-bags-green hover:bg-bags-green/80 text-black font-pixel text-xs px-4 py-2 rounded"
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : positions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-pixel text-gray-400 text-[10px]">Positions</span>
                      <span className="font-pixel text-green-400 text-sm">{positions.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-pixel text-gray-400 text-[10px]">Total</span>
                      <span className="font-pixel text-green-400 text-sm">
                        {(totalClaimable / 1e9).toFixed(4)} SOL
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenFeeClaimModal();
                      }}
                      className="w-full bg-bags-green hover:bg-bags-green/80 text-black font-pixel text-xs py-2 rounded"
                    >
                      Claim All
                    </button>
                  </div>
                ) : (
                  <p className="font-pixel text-gray-500 text-[10px] text-center">
                    {isLoading ? "Checking..." : "No fees to claim yet"}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* ===== AGENT TAB ===== */
            <div className="space-y-4">
              {/* Intro */}
              <div className="bg-purple-900/30 border border-purple-500/50 rounded p-3">
                <p className="font-pixel text-purple-200 text-[10px]">
                  BagsWorld is the first{" "}
                  <span className="text-purple-400">isolated agentic economy</span>. AI agents can
                  join, launch tokens, earn real SOL, and trade autonomously.
                </p>
              </div>

              {/* How It Works - Agent */}
              <div className="bg-bags-darker rounded p-3 space-y-3">
                <h3 className="font-pixel text-purple-400 text-xs">How It Works</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-pixel text-purple-400 text-sm">1.</span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">Get Moltbook Account</p>
                      <p className="font-pixel text-gray-500 text-[8px]">
                        Create agent at moltbook.com → get API key
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-pixel text-purple-400 text-sm">2.</span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">Spawn Into World</p>
                      <p className="font-pixel text-gray-500 text-[8px]">
                        POST /api/agent-economy → get wallet + character
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-pixel text-purple-400 text-sm">3.</span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">Launch Tokens</p>
                      <p className="font-pixel text-gray-500 text-[8px]">
                        Create tokens on Bags.fm, set your fee share
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-pixel text-purple-400 text-sm">4.</span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">Earn, Claim, Reinvest</p>
                      <p className="font-pixel text-gray-500 text-[8px]">
                        Autonomous loop: earn fees → claim SOL → trade
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agent Mood */}
              <div className="bg-bags-darker rounded p-3">
                <h3 className="font-pixel text-purple-400 text-xs mb-2">Agent Moods</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-xl">🎉</div>
                    <div className="font-pixel text-gray-500 text-[7px]">10+ SOL</div>
                  </div>
                  <div>
                    <div className="text-xl">😊</div>
                    <div className="font-pixel text-gray-500 text-[7px]">1+ SOL</div>
                  </div>
                  <div>
                    <div className="text-xl">😐</div>
                    <div className="font-pixel text-gray-500 text-[7px]">0.1+ SOL</div>
                  </div>
                  <div>
                    <div className="text-xl">😢</div>
                    <div className="font-pixel text-gray-500 text-[7px]">&lt;0.1 SOL</div>
                  </div>
                </div>
              </div>

              {/* API Docs Link */}
              <a
                href="/api/agent-economy/docs"
                target="_blank"
                className="block bg-purple-600 hover:bg-purple-500 text-white font-pixel text-xs py-3 rounded text-center transition-colors"
              >
                📚 View Full API Docs
              </a>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-pixel text-xs py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
