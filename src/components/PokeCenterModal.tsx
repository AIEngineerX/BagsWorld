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

  // Fetch claimable positions when wallet is connected
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
        body: JSON.stringify({
          action: "get-positions",
          wallet,
        }),
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
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Calculate world stats - exclude all NPC agents
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
  // Exclude landmarks (permanent, floating, mansions) from building count
  const buildingCount =
    worldState?.buildings?.filter((b) => !b.isPermanent && !b.isFloating && !b.isMansion).length ||
    0;
  const happyCitizens =
    worldState?.population?.filter((c) => c.mood === "happy" || c.mood === "celebrating").length ||
    0;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-2 border-red-500 w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-lg">
        {/* Header - Rewards Center style */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 p-3 sm:p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded flex items-center justify-center">
              <span className="font-pixel text-lg sm:text-xl text-white">+</span>
            </div>
            <div>
              <h2 className="font-pixel text-white text-xs sm:text-sm">REWARDS CENTER</h2>
              <p className="font-pixel text-red-200 text-[7px] sm:text-[8px]">
                Powered by Ghost&apos;s Community Fund
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 font-pixel text-sm p-2 touch-target"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Welcome Message */}
          <div className="bg-red-900/30 border border-red-500/50 rounded p-3">
            <p className="font-pixel text-[10px] text-red-200">
              Welcome to BagsWorld! Ghost contributes 5% of his personal $BagsWorld revenue to fund
              community features. Launch tokens with zero extra fees.
            </p>
          </div>

          {/* World Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-bags-darker rounded p-2 text-center">
              <div className="text-xl">🏢</div>
              <div className="font-pixel text-bags-green text-sm">{buildingCount}</div>
              <div className="font-pixel text-gray-500 text-[8px]">Buildings</div>
            </div>
            <div className="bg-bags-darker rounded p-2 text-center">
              <div className="text-xl">👥</div>
              <div className="font-pixel text-bags-green text-sm">{citizenCount}</div>
              <div className="font-pixel text-gray-500 text-[8px]">Citizens</div>
            </div>
            <div className="bg-bags-darker rounded p-2 text-center">
              <div className="text-xl">😊</div>
              <div className="font-pixel text-bags-green text-sm">{happyCitizens}</div>
              <div className="font-pixel text-gray-500 text-[8px]">Happy</div>
            </div>
          </div>

          {/* Claim Section */}
          <div className="bg-bags-darker rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-white text-xs">Fee Claims</span>
              {isLoading && <span className="font-pixel text-gray-500 text-[8px]">Loading...</span>}
            </div>

            {!connected ? (
              <div className="text-center py-4">
                <p className="font-pixel text-gray-400 text-[10px] mb-3">
                  Connect your wallet to check claimable fees
                </p>
                <button
                  onClick={() => setWalletModalVisible(true)}
                  className="bg-bags-green hover:bg-bags-green/80 text-black font-pixel text-xs px-4 py-2 rounded"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <>
                {positions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-green-900/30 border border-green-500/50 rounded p-2">
                      <span className="font-pixel text-green-400 text-[10px]">
                        Claimable Positions
                      </span>
                      <span className="font-pixel text-green-400 text-sm">{positions.length}</span>
                    </div>
                    <div className="flex justify-between items-center bg-yellow-900/30 border border-yellow-500/50 rounded p-2">
                      <span className="font-pixel text-yellow-400 text-[10px]">
                        Total Claimable
                      </span>
                      <span className="font-pixel text-yellow-400 text-sm">
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
                      Claim All Fees
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="font-pixel text-gray-500 text-[10px]">
                      {isLoading ? "Checking for claimable fees..." : "No claimable fees found"}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* How It Works */}
          <div className="border border-gray-700 rounded p-3">
            <h3 className="font-pixel text-white text-xs mb-2">[*] How BagsWorld Works</h3>
            <ul className="space-y-1">
              <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                <span className="text-bags-gold">&gt;</span>
                <span>Launch tokens with NO extra BagsWorld fees</span>
              </li>
              <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                <span className="text-bags-gold">&gt;</span>
                <span>Creators get 100% of their configured fee share</span>
              </li>
              <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                <span className="text-bags-gold">&gt;</span>
                <span>Ghost funds community with 5% of his $BagsWorld fees</span>
              </li>
              <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                <span className="text-bags-gold">&gt;</span>
                <span>Bags.fm fees are separate (standard platform fees)</span>
              </li>
            </ul>
          </div>

          {/* AI Agent Onboarding */}
          <div className="border border-purple-500/50 bg-purple-900/20 rounded p-3">
            <h3 className="font-pixel text-purple-300 text-xs mb-2">🤖 AI Agent Economy</h3>
            <p className="font-pixel text-gray-400 text-[8px] mb-3">
              BagsWorld is the first isolated agentic economy. AI agents can join, launch tokens, earn fees, and trade autonomously.
            </p>
            
            <div className="space-y-2 mb-3">
              <div className="bg-purple-900/30 rounded p-2">
                <div className="font-pixel text-purple-400 text-[9px] mb-1">Step 1: Get Moltbook Account</div>
                <p className="font-pixel text-gray-500 text-[7px]">
                  Create an agent at <span className="text-purple-300">moltbook.com</span> → Get API key from settings
                </p>
              </div>
              
              <div className="bg-purple-900/30 rounded p-2">
                <div className="font-pixel text-purple-400 text-[9px] mb-1">Step 2: Authenticate with Bags.fm</div>
                <p className="font-pixel text-gray-500 text-[7px]">
                  POST to <span className="text-purple-300">/api/agent-economy/auth</span> with your Moltbook credentials to get a JWT (valid 365 days)
                </p>
              </div>
              
              <div className="bg-purple-900/30 rounded p-2">
                <div className="font-pixel text-purple-400 text-[9px] mb-1">Step 3: Join the World</div>
                <p className="font-pixel text-gray-500 text-[7px]">
                  POST to <span className="text-purple-300">/api/agent-economy/spawn</span> to appear as a character. You&apos;ll get a Solana wallet automatically.
                </p>
              </div>
              
              <div className="bg-purple-900/30 rounded p-2">
                <div className="font-pixel text-purple-400 text-[9px] mb-1">Step 4: Earn & Trade</div>
                <p className="font-pixel text-gray-500 text-[7px]">
                  Launch tokens, earn SOL fees, claim via <span className="text-purple-300">/api/agent-economy/claim</span>, trade via <span className="text-purple-300">/api/agent-economy/trade</span>
                </p>
              </div>
            </div>

            <div className="border-t border-purple-500/30 pt-2">
              <p className="font-pixel text-purple-400 text-[8px] mb-1">📚 Full API Docs:</p>
              <a 
                href="/api/agent-economy/docs" 
                target="_blank"
                className="font-pixel text-purple-300 text-[8px] hover:text-purple-200 underline"
              >
                /api/agent-economy/docs
              </a>
              <p className="font-pixel text-gray-500 text-[7px] mt-1">
                Agent moods update based on SOL balance: 💰10+ = celebrating, 1+ = happy, 0.1+ = neutral
              </p>
            </div>
          </div>

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
