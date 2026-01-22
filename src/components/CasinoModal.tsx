"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getCasinoAccessInfo, BAGSWORLD_TOKEN_SYMBOL, BAGSWORLD_BUY_URL, MIN_TOKEN_BALANCE } from "../lib/token-balance";

interface CasinoModalProps {
  onClose: () => void;
}

interface RaffleState {
  id: number;
  status: "active" | "drawing" | "completed" | "none";
  potSol: number;
  entryCount: number;
  threshold: number;
  userEntered: boolean;
  winnerWallet?: string | null;
  prizeSol?: number | null;
  message?: string;
}

const AGE_VERIFIED_KEY = "bagsworld_casino_age_verified";

// Game definitions - raffle is now LIVE!
const CASINO_GAMES = [
  {
    id: "raffle",
    name: "RAFFLE",
    description: "Free entry, winner takes pot",
    icon: "TKT",
    color: "from-blue-600 to-indigo-700",
    borderColor: "border-blue-500/30",
    glowColor: "shadow-blue-500/20",
    comingSoon: false, // LIVE!
  },
  {
    id: "highlow",
    name: "HIGH / LOW",
    description: "Predict if the next card will be higher or lower",
    icon: "H/L",
    color: "from-red-600 to-red-800",
    borderColor: "border-red-500/30",
    glowColor: "shadow-red-500/20",
    comingSoon: true,
  },
  {
    id: "coinflip",
    name: "COIN FLIP",
    description: "Double or nothing - 50/50 odds",
    icon: "2x",
    color: "from-yellow-600 to-amber-700",
    borderColor: "border-yellow-500/30",
    glowColor: "shadow-yellow-500/20",
    comingSoon: true,
  },
  {
    id: "dice",
    name: "DICE ROLL",
    description: "Roll the dice, beat the house",
    icon: "D6",
    color: "from-green-600 to-emerald-700",
    borderColor: "border-green-500/30",
    glowColor: "shadow-green-500/20",
    comingSoon: true,
  },
  {
    id: "slots",
    name: "SLOT MACHINE",
    description: "Match symbols to win big",
    icon: "777",
    color: "from-purple-600 to-violet-700",
    borderColor: "border-purple-500/30",
    glowColor: "shadow-purple-500/20",
    comingSoon: true,
  },
  {
    id: "prediction",
    name: "PRICE PREDICT",
    description: "Predict token price movements",
    icon: "UP",
    color: "from-cyan-600 to-teal-700",
    borderColor: "border-cyan-500/30",
    glowColor: "shadow-cyan-500/20",
    comingSoon: true,
  },
];

// Truncate wallet address for display
function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function CasinoModal({ onClose }: CasinoModalProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);

  // Token gate states
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);

  // Raffle states
  const [raffle, setRaffle] = useState<RaffleState | null>(null);
  const [isLoadingRaffle, setIsLoadingRaffle] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [entryMessage, setEntryMessage] = useState<string | null>(null);

  // Wallet hooks
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Check localStorage on mount
  useEffect(() => {
    const verified = localStorage.getItem(AGE_VERIFIED_KEY);
    setAgeVerified(verified === "true");
  }, []);

  // Check token access when age verified and wallet connected
  const checkTokenAccess = useCallback(async () => {
    if (!publicKey || !connection) return;

    setIsCheckingAccess(true);
    try {
      const accessInfo = await getCasinoAccessInfo(connection, publicKey);
      setTokenBalance(accessInfo.balance);
      setHasAccess(accessInfo.hasAccess);
    } catch (error) {
      console.error("Error checking casino access:", error);
      setHasAccess(false);
      setTokenBalance(0);
    } finally {
      setIsCheckingAccess(false);
    }
  }, [publicKey, connection]);

  // Fetch raffle status
  const fetchRaffleStatus = useCallback(async () => {
    if (!publicKey) return;

    setIsLoadingRaffle(true);
    try {
      const res = await fetch(`/api/casino/raffle?wallet=${publicKey.toString()}&includeCompleted=true`);
      const data = await res.json();
      setRaffle(data);
    } catch (error) {
      console.error("Error fetching raffle:", error);
      setRaffle({ status: "none", message: "Failed to load raffle" } as RaffleState);
    } finally {
      setIsLoadingRaffle(false);
    }
  }, [publicKey]);

  // Trigger token check when age verified and wallet changes
  useEffect(() => {
    if (ageVerified && connected && publicKey) {
      checkTokenAccess();
    } else if (!connected) {
      setHasAccess(null);
      setTokenBalance(0);
    }
  }, [ageVerified, connected, publicKey, checkTokenAccess]);

  // Fetch raffle when game selected
  useEffect(() => {
    if (selectedGame === "raffle" && publicKey && hasAccess) {
      fetchRaffleStatus();
    }
  }, [selectedGame, publicKey, hasAccess, fetchRaffleStatus]);

  // Auto-refresh raffle every 30s when viewing
  useEffect(() => {
    if (selectedGame !== "raffle" || !publicKey || !hasAccess) return;

    const interval = setInterval(fetchRaffleStatus, 30000);
    return () => clearInterval(interval);
  }, [selectedGame, publicKey, hasAccess, fetchRaffleStatus]);

  const handleAgeVerification = (isOver18: boolean) => {
    if (isOver18) {
      localStorage.setItem(AGE_VERIFIED_KEY, "true");
      setAgeVerified(true);
    } else {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (selectedGame) {
        setSelectedGame(null);
        setEntryMessage(null);
      } else {
        onClose();
      }
    }
  };

  const handleEnterRaffle = async () => {
    if (!publicKey || isEntering) return;

    setIsEntering(true);
    setEntryMessage(null);

    try {
      const res = await fetch("/api/casino/raffle/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toString() }),
      });

      const data = await res.json();

      if (data.success) {
        setEntryMessage("You're in! Good luck!");
        // Refresh raffle status
        await fetchRaffleStatus();
      } else {
        setEntryMessage(data.error || "Failed to enter");
      }
    } catch (error) {
      console.error("Error entering raffle:", error);
      setEntryMessage("Failed to enter raffle");
    } finally {
      setIsEntering(false);
    }
  };

  // Loading state while checking localStorage
  if (ageVerified === null) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="font-pixel text-purple-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  // Age verification gate
  if (!ageVerified) {
    return (
      <div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-[#0a0a0f] border border-red-500/50 rounded-2xl max-w-md w-full overflow-hidden">
          {/* Warning Header */}
          <div className="bg-gradient-to-r from-red-900/60 to-red-800/40 p-6 border-b border-red-500/30">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-4xl">&#9888;&#65039;</span>
              <h2 className="font-pixel text-xl text-red-400 tracking-wider">AGE VERIFICATION</h2>
              <span className="text-4xl">&#9888;&#65039;</span>
            </div>
            <p className="text-center text-red-300/80 text-sm">This section contains gambling content</p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* 18+ Badge */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center border-4 border-red-400/50 shadow-lg shadow-red-500/30">
                <span className="font-pixel text-2xl text-white">18+</span>
              </div>
            </div>

            {/* Legal Text */}
            <div className="bg-black/50 border border-gray-700/50 rounded-lg p-4 max-h-40 overflow-y-auto">
              <p className="text-gray-300 text-xs leading-relaxed mb-3">
                By entering, you confirm that:
              </p>
              <ul className="text-gray-400 text-[11px] space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#8226;</span>
                  <span>You are <strong className="text-white">18 years of age or older</strong> (or the legal gambling age in your jurisdiction)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#8226;</span>
                  <span>Online gambling is <strong className="text-white">legal in your jurisdiction</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#8226;</span>
                  <span>You understand gambling involves <strong className="text-white">risk of financial loss</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#8226;</span>
                  <span>You are <strong className="text-white">not using funds you cannot afford to lose</strong></span>
                </li>
              </ul>
            </div>

            {/* Responsible Gambling Notice */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-400/90 text-[10px] text-center leading-relaxed">
                Gambling can be addictive. Play responsibly. If you have a gambling problem,
                please seek help at <span className="text-yellow-300">begambleaware.org</span>
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleAgeVerification(false)}
                className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-pixel text-xs transition-colors border border-gray-700"
              >
                EXIT
              </button>
              <button
                onClick={() => handleAgeVerification(true)}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-pixel text-xs transition-all shadow-lg shadow-green-500/20 border border-green-500/50"
              >
                I AM 18+ ENTER
              </button>
            </div>

            {/* Generic Legal Disclaimer */}
            <div className="border-t border-gray-800 pt-4 mt-2">
              <p className="text-gray-500 text-[9px] text-center leading-relaxed">
                <strong className="text-gray-400">DISCLAIMER:</strong> BagsWorld Casino is provided &quot;as is&quot; for entertainment purposes only.
                We make no guarantees regarding winnings or outcomes. By proceeding, you acknowledge that you are solely
                responsible for any losses incurred. BagsWorld, its developers, and affiliates shall not be held liable
                for any direct, indirect, incidental, or consequential damages arising from your use of this service.
                Gambling laws vary by jurisdiction - it is your responsibility to ensure compliance with local laws.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Token gate - wallet not connected
  if (!connected) {
    return (
      <div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-[#0a0a0f] border border-purple-500/50 rounded-2xl max-w-md w-full overflow-hidden">
          {/* Gate Header */}
          <div className="bg-gradient-to-r from-purple-900/60 to-purple-800/40 p-6 border-b border-purple-500/30">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-4xl">&#127920;</span>
              <h2 className="font-pixel text-xl text-purple-400 tracking-wider">TOKEN GATE</h2>
              <span className="text-4xl">&#128274;</span>
            </div>
            <p className="text-center text-purple-300/80 text-sm">Connect wallet to access the casino</p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Lock Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center border-4 border-purple-400/50 shadow-lg shadow-purple-500/30">
                <span className="font-pixel text-3xl">&#128272;</span>
              </div>
            </div>

            {/* Requirement Box */}
            <div className="bg-black/50 border border-purple-500/30 rounded-lg p-4">
              <p className="text-center text-white text-sm mb-2">
                <strong>Hold {MIN_TOKEN_BALANCE.toLocaleString()} {BAGSWORLD_TOKEN_SYMBOL}</strong>
              </p>
              <p className="text-center text-gray-400 text-xs">
                to unlock BagsWorld Casino games
              </p>
            </div>

            {/* Info */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <p className="text-purple-400/90 text-[11px] text-center leading-relaxed">
                Connect your Solana wallet to verify your {BAGSWORLD_TOKEN_SYMBOL} balance and access exclusive casino features.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-pixel text-xs transition-colors border border-gray-700"
              >
                EXIT
              </button>
              <button
                onClick={() => setWalletModalVisible(true)}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg font-pixel text-xs transition-all shadow-lg shadow-purple-500/20 border border-purple-500/50"
              >
                CONNECT WALLET
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Token gate - checking balance
  if (isCheckingAccess || hasAccess === null) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#0a0a0f] border border-purple-500/30 rounded-2xl p-8 max-w-sm w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center animate-pulse">
              <span className="font-pixel text-2xl">&#127920;</span>
            </div>
            <div className="font-pixel text-purple-400 text-center">
              Checking {BAGSWORLD_TOKEN_SYMBOL} balance...
            </div>
            <div className="text-gray-500 text-xs text-center">
              Verifying casino access
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Token gate - insufficient balance (show buy prompt)
  if (!hasAccess) {
    return (
      <div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-[#0a0a0f] border border-yellow-500/50 rounded-2xl max-w-md w-full overflow-hidden">
          {/* Gate Header */}
          <div className="bg-gradient-to-r from-yellow-900/60 to-orange-800/40 p-6 border-b border-yellow-500/30">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-4xl">&#129689;</span>
              <h2 className="font-pixel text-xl text-yellow-400 tracking-wider">ACCESS DENIED</h2>
              <span className="text-4xl">&#128683;</span>
            </div>
            <p className="text-center text-yellow-300/80 text-sm">Insufficient {BAGSWORLD_TOKEN_SYMBOL} balance</p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Balance Display */}
            <div className="bg-black/50 border border-yellow-500/30 rounded-lg p-5">
              <div className="text-center mb-4">
                <p className="text-gray-400 text-xs mb-1">Required to Enter</p>
                <p className="text-white font-bold text-2xl font-pixel">
                  {MIN_TOKEN_BALANCE.toLocaleString()} <span className="text-yellow-400">{BAGSWORLD_TOKEN_SYMBOL}</span>
                </p>
              </div>
              <div className="w-full h-px bg-yellow-500/20 mb-4" />
              <div className="text-center">
                <p className="text-gray-400 text-xs mb-1">Your Balance</p>
                <p className="text-red-400 font-bold text-xl font-pixel">
                  {tokenBalance.toLocaleString()} <span className="text-yellow-400/60">{BAGSWORLD_TOKEN_SYMBOL}</span>
                </p>
              </div>
              <div className="mt-4 text-center">
                <p className="text-gray-500 text-[10px]">
                  Need {(MIN_TOKEN_BALANCE - tokenBalance).toLocaleString()} more tokens
                </p>
              </div>
            </div>

            {/* Buy Prompt */}
            <div className="bg-gradient-to-r from-purple-500/10 to-yellow-500/10 border border-purple-500/20 rounded-lg p-4">
              <p className="text-white text-sm text-center mb-2 font-medium">
                Get {BAGSWORLD_TOKEN_SYMBOL} on Bags.fm
              </p>
              <p className="text-gray-400 text-[11px] text-center leading-relaxed">
                Buy {BAGSWORLD_TOKEN_SYMBOL} tokens to unlock casino access and exclusive features.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-pixel text-xs transition-colors border border-gray-700"
              >
                EXIT
              </button>
              <a
                href={BAGSWORLD_BUY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white rounded-lg font-pixel text-xs transition-all shadow-lg shadow-yellow-500/20 border border-yellow-500/50 text-center block"
              >
                BUY ON BAGS.FM
              </a>
            </div>

            {/* Refresh */}
            <button
              onClick={checkTokenAccess}
              className="w-full py-2 text-purple-400 hover:text-purple-300 text-xs transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Balance
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Raffle game view
  if (selectedGame === "raffle") {
    return (
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-[#0a0a0f] border border-blue-500/30 max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-2xl">
          {/* Header */}
          <div className="relative bg-gradient-to-b from-blue-900/40 to-transparent p-4 sm:p-6 border-b border-blue-500/20">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-indigo-700 border border-blue-400/50 flex items-center justify-center shadow-lg shadow-blue-500/30 rounded-xl flex-shrink-0">
                  <span className="font-pixel text-lg sm:text-xl text-white">TKT</span>
                </div>
                <div>
                  <h2 className="font-pixel text-lg sm:text-xl text-white tracking-wider">RAFFLE</h2>
                  <p className="font-pixel text-blue-400/80 text-[10px] sm:text-xs mt-1">Free entry, winner takes all</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedGame(null);
                  setEntryMessage(null);
                }}
                className="font-pixel text-xs p-2 text-gray-400 hover:text-white touch-target border border-blue-500/30 hover:border-blue-400/60 transition-colors flex-shrink-0 rounded"
                aria-label="Back"
              >
                [&lt;]
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isLoadingRaffle ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center animate-pulse">
                  <span className="font-pixel text-lg">TKT</span>
                </div>
                <p className="text-blue-400 font-pixel text-sm mt-4">Loading raffle...</p>
              </div>
            ) : raffle?.status === "none" || !raffle ? (
              // No active raffle
              <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <span className="font-pixel text-2xl text-gray-500">TKT</span>
                </div>
                <h3 className="font-pixel text-lg text-gray-400 mb-2">No Active Raffle</h3>
                <p className="text-gray-500 text-sm">
                  {raffle?.message || "Check back soon for the next raffle!"}
                </p>
              </div>
            ) : raffle.status === "completed" ? (
              // Completed raffle - show winner
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border border-yellow-500/30 rounded-xl p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                    <span className="font-pixel text-2xl">&#127942;</span>
                  </div>
                  <h3 className="font-pixel text-lg text-yellow-400 mb-2">RAFFLE COMPLETE!</h3>
                  <p className="text-gray-400 text-sm mb-4">Winner has been drawn</p>

                  <div className="bg-black/30 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Winner</p>
                      <p className="font-pixel text-white text-lg">
                        {raffle.winnerWallet ? truncateWallet(raffle.winnerWallet) : "Unknown"}
                      </p>
                      {raffle.winnerWallet === publicKey?.toString() && (
                        <p className="text-yellow-400 text-xs mt-1 animate-pulse">That&apos;s you!</p>
                      )}
                    </div>
                    <div className="w-full h-px bg-yellow-500/20" />
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Prize</p>
                      <p className="font-pixel text-green-400 text-xl">{raffle.prizeSol?.toFixed(2) || "0"} SOL</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-blue-400/90 text-xs text-center">
                    Stay tuned for the next raffle! Follow @BagsWorldApp for announcements.
                  </p>
                </div>
              </div>
            ) : raffle.status === "drawing" ? (
              // Drawing in progress
              <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center animate-spin">
                  <span className="font-pixel text-2xl">&#127922;</span>
                </div>
                <h3 className="font-pixel text-lg text-purple-400 mb-2">DRAWING WINNER...</h3>
                <p className="text-gray-400 text-sm">Please wait while we select the winner</p>
              </div>
            ) : (
              // Active raffle
              <div className="space-y-4">
                {/* Pot Display */}
                <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/20 border border-blue-500/30 rounded-xl p-6 text-center">
                  <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Prize Pool</p>
                  <p className="font-pixel text-4xl text-white mb-1">
                    {raffle.potSol?.toFixed(2) || "0"} <span className="text-blue-400">SOL</span>
                  </p>
                  <p className="text-gray-500 text-xs">Winner takes all!</p>
                </div>

                {/* Entry Progress */}
                <div className="bg-black/30 border border-gray-700/30 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-gray-400 text-xs">Entries</p>
                    <p className="text-white font-pixel text-sm">
                      {raffle.entryCount} / {raffle.threshold}
                    </p>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((raffle.entryCount / raffle.threshold) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-gray-500 text-[10px] mt-2 text-center">
                    {raffle.entryCount >= raffle.threshold
                      ? "Threshold reached! Draw incoming..."
                      : `${raffle.threshold - raffle.entryCount} more entries until draw`}
                  </p>
                </div>

                {/* Entry Button / Status */}
                {raffle.userEntered ? (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-green-400 text-lg">&#10003;</span>
                      <p className="font-pixel text-green-400">YOU&apos;RE IN!</p>
                    </div>
                    <p className="text-gray-400 text-xs">
                      Your entry has been recorded. Good luck!
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleEnterRaffle}
                    disabled={isEntering}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-pixel text-sm transition-all shadow-lg shadow-blue-500/20 border border-blue-500/50"
                  >
                    {isEntering ? "ENTERING..." : "ENTER RAFFLE (FREE)"}
                  </button>
                )}

                {/* Entry message */}
                {entryMessage && (
                  <p className={`text-center text-sm ${entryMessage.includes("in!") ? "text-green-400" : "text-red-400"}`}>
                    {entryMessage}
                  </p>
                )}

                {/* Rules */}
                <div className="bg-gray-900/30 border border-gray-700/30 rounded-lg p-4">
                  <h4 className="font-pixel text-xs text-gray-400 mb-2">HOW IT WORKS</h4>
                  <ul className="text-gray-500 text-[11px] space-y-1">
                    <li>&#8226; Free entry - one entry per wallet</li>
                    <li>&#8226; Winner drawn when threshold is reached</li>
                    <li>&#8226; Winner receives the entire prize pool</li>
                    <li>&#8226; Random selection using secure RNG</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-blue-500/20 bg-black/30">
            <button
              onClick={fetchRaffleStatus}
              className="w-full py-2 text-blue-400 hover:text-blue-300 text-xs transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main casino view
  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0a0a0f] border border-purple-500/30 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-b from-purple-900/40 to-transparent p-4 sm:p-6 border-b border-purple-500/20">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-purple-800 border border-purple-400/50 flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
                <span className="font-pixel text-base sm:text-xl text-white">777</span>
              </div>
              <div>
                <h2 className="font-pixel text-base sm:text-xl text-white tracking-wider">BAGSWORLD CASINO</h2>
                <p className="font-pixel text-purple-400/80 text-[8px] sm:text-xs mt-1">Play to earn SOL rewards</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="font-pixel text-xs p-2 text-gray-400 hover:text-white touch-target border border-purple-500/30 hover:border-purple-400/60 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              [X]
            </button>
          </div>
        </div>

        {/* Games Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CASINO_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                disabled={game.comingSoon}
                className={`relative group bg-gradient-to-br ${game.color} rounded-xl p-4 border ${game.borderColor} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${game.glowColor} disabled:opacity-70 disabled:cursor-not-allowed text-left`}
              >
                {/* Live Badge for raffle */}
                {!game.comingSoon && (
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
                    LIVE
                  </div>
                )}

                {/* Coming Soon Badge */}
                {game.comingSoon && (
                  <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[9px] font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
                    SOON
                  </div>
                )}

                {/* Icon */}
                <div className="font-pixel text-2xl text-white/90 mb-3 filter drop-shadow-lg">
                  {game.icon}
                </div>

                {/* Info */}
                <h3 className="font-pixel text-xs text-white mb-1 tracking-wider">
                  {game.name}
                </h3>
                <p className="text-white/60 text-[10px] leading-relaxed">
                  {game.description}
                </p>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-white/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="font-pixel text-lg text-green-500">[!]</div>
              <div>
                <h4 className="text-blue-400 font-medium text-sm mb-1">Raffle is LIVE!</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Enter the raffle for free and win the entire prize pool! More games coming soon.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-purple-500/20 bg-black/30">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-xs">
              Funded by <span className="text-purple-400">BagsWorld ecosystem fees</span>
            </p>
            <a
              href="https://x.com/BagsWorldApp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-xs transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow for updates
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
