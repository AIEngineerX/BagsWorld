"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useGameStore } from "@/lib/store";
import { useAchievements, CATEGORY_INFO } from "@/hooks/useAchievements";
import type { ClaimablePosition } from "@/lib/types";
import type { Achievement } from "@/lib/achievements";

interface PokeCenterModalProps {
  onClose: () => void;
  onOpenFeeClaimModal: () => void;
}

type TabType = "stats" | "claims" | "achievements";

export function PokeCenterModal({ onClose, onOpenFeeClaimModal }: PokeCenterModalProps) {
  const { publicKey, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { worldState } = useGameStore();
  const {
    achievements,
    unlockedCount,
    totalCount,
    percentage,
    isLoading: achievementsLoading,
    unlock,
    checkAndUnlock,
    getByCategory,
  } = useAchievements();

  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [positions, setPositions] = useState<ClaimablePosition[]>([]);
  const [totalClaimable, setTotalClaimable] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

  // Unlock "Nurse Joy" achievement on mount
  useEffect(() => {
    if (connected) {
      unlock("nurse_joy");
    }
  }, [connected, unlock]);

  // Check for achievements when modal opens
  useEffect(() => {
    if (connected && worldState) {
      checkAndUnlock().then((unlocked) => {
        if (unlocked.length > 0) {
          setNewlyUnlocked(unlocked);
          setTimeout(() => setNewlyUnlocked([]), 5000);
        }
      });
    }
  }, [connected, worldState, checkAndUnlock]);

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

  // Calculate world stats
  const citizenCount = worldState?.population?.filter(
    (c) => !c.isToly && !c.isAsh && !c.isFinn && !c.isDev
  ).length || 0;
  const buildingCount = worldState?.buildings?.filter(
    (b) => !b.id.startsWith("Treasury") && !b.id.startsWith("Starter")
  ).length || 0;
  const happyCitizens = worldState?.population?.filter(
    (c) => c.mood === "happy" || c.mood === "celebrating"
  ).length || 0;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-2 border-red-500 rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - PokeCenter style */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🏥</div>
            <div>
              <h2 className="font-pixel text-white text-sm">POKECENTER</h2>
              <p className="font-pixel text-red-200 text-[8px]">Healing Hub & Achievement Center</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-200 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Newly Unlocked Toast */}
        {newlyUnlocked.length > 0 && (
          <div className="bg-yellow-500 text-black px-4 py-2 font-pixel text-[10px] text-center animate-pulse">
            🏆 Achievement Unlocked! +{newlyUnlocked.length} new badge{newlyUnlocked.length > 1 ? "s" : ""}!
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-red-500/50">
          {[
            { id: "stats" as TabType, label: "Stats", icon: "📊" },
            { id: "claims" as TabType, label: "Claims", icon: "💰" },
            { id: "achievements" as TabType, label: "Badges", icon: "🏆" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 font-pixel text-[10px] flex items-center justify-center gap-1 transition-colors ${
                activeTab === tab.id
                  ? "bg-red-900/50 text-white border-b-2 border-red-400"
                  : "text-gray-400 hover:text-white hover:bg-red-900/30"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === "achievements" && (
                <span className="ml-1 bg-red-600 text-white text-[8px] px-1 rounded">
                  {unlockedCount}/{totalCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stats Tab */}
          {activeTab === "stats" && (
            <>
              <div className="bg-red-900/30 border border-red-500/50 rounded p-3">
                <p className="font-pixel text-[10px] text-red-200">
                  Welcome, trainer! This is the BagsWorld healing hub.
                  Check your stats, claim fees, and earn badges!
                </p>
              </div>

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

              <div className="border border-gray-700 rounded p-3">
                <h3 className="font-pixel text-white text-xs mb-2">💡 Tips</h3>
                <ul className="space-y-1">
                  <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                    <span>•</span>
                    <span>Launch tokens to create buildings and earn fees</span>
                  </li>
                  <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                    <span>•</span>
                    <span>Add fee shares to bring citizens into your world</span>
                  </li>
                  <li className="font-pixel text-gray-400 text-[8px] flex items-start gap-2">
                    <span>•</span>
                    <span>Check the Badges tab to see your achievements</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Claims Tab */}
          {activeTab === "claims" && (
            <div className="bg-bags-darker rounded p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-pixel text-white text-xs">Fee Claims</span>
                {isLoading && (
                  <span className="font-pixel text-gray-500 text-[8px]">Loading...</span>
                )}
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
                        <span className="font-pixel text-green-400 text-sm">
                          {positions.length}
                        </span>
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
                    <div className="text-center py-4">
                      <p className="font-pixel text-gray-500 text-[10px]">
                        {isLoading ? "Checking for claimable fees..." : "No claimable fees found"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Achievements Tab */}
          {activeTab === "achievements" && (
            <>
              {/* Progress Bar */}
              <div className="bg-bags-darker rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-pixel text-white text-xs">Badge Progress</span>
                  <span className="font-pixel text-yellow-400 text-xs">
                    {unlockedCount}/{totalCount} ({percentage}%)
                  </span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {!connected ? (
                <div className="text-center py-4">
                  <p className="font-pixel text-gray-400 text-[10px] mb-3">
                    Connect your wallet to track achievements
                  </p>
                  <button
                    onClick={() => setWalletModalVisible(true)}
                    className="bg-bags-green hover:bg-bags-green/80 text-black font-pixel text-xs px-4 py-2 rounded"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : achievementsLoading ? (
                <div className="text-center py-4">
                  <p className="font-pixel text-gray-500 text-[10px] animate-pulse">
                    Loading achievements...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(["launcher", "earner", "builder", "trader", "world", "special"] as const).map(
                    (category) => {
                      const categoryAchievements = getByCategory(category);
                      const categoryUnlocked = categoryAchievements.filter((a) => a.unlocked).length;
                      const info = CATEGORY_INFO[category];

                      return (
                        <div key={category} className="border border-gray-700 rounded overflow-hidden">
                          <div className="bg-gray-800 px-3 py-2 flex justify-between items-center">
                            <span className="font-pixel text-white text-[10px]">
                              {info.icon} {info.name}
                            </span>
                            <span className="font-pixel text-gray-400 text-[8px]">
                              {categoryUnlocked}/{categoryAchievements.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 p-2">
                            {categoryAchievements.map((ap) => {
                              const isHidden = ap.achievement.hidden && !ap.unlocked;
                              const isNew = newlyUnlocked.includes(ap.achievement.id);

                              return (
                                <div
                                  key={ap.achievement.id}
                                  className={`p-2 rounded text-center transition-all ${
                                    ap.unlocked
                                      ? isNew
                                        ? "bg-yellow-500/30 border border-yellow-500 animate-pulse"
                                        : "bg-green-900/30 border border-green-500/50"
                                      : isHidden
                                      ? "bg-gray-900/50 border border-gray-700"
                                      : "bg-gray-800/50 border border-gray-700 opacity-60"
                                  }`}
                                  title={isHidden ? "???" : ap.achievement.description}
                                >
                                  <div className="text-xl mb-1">
                                    {isHidden ? "❓" : ap.achievement.icon}
                                  </div>
                                  <div className="font-pixel text-[8px] text-white truncate">
                                    {isHidden ? "???" : ap.achievement.name}
                                  </div>
                                  {!ap.unlocked && !isHidden && (
                                    <div className="font-pixel text-[7px] text-gray-500">
                                      {ap.progress}/{ap.achievement.requirement}
                                    </div>
                                  )}
                                  {ap.unlocked && (
                                    <div className="font-pixel text-[7px] text-green-400">
                                      Unlocked!
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Close Button */}
        <div className="p-4 border-t border-red-500/30">
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
