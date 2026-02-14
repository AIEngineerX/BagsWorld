"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  getCasinoAccessInfo,
  BAGSWORLD_TOKEN_SYMBOL,
  BAGSWORLD_BUY_URL,
  MIN_TOKEN_BALANCE,
} from "../lib/token-balance";
import { CasinoAdmin } from "./CasinoAdmin";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface CasinoModalProps {
  onClose: () => void;
}

interface RaffleState {
  id: number;
  status: "active" | "paused" | "drawing" | "completed" | "none";
  potSol: number;
  entryCount: number;
  threshold: number;
  userEntered: boolean;
  winnerWallet?: string | null;
  prizeSol?: number | null;
  message?: string;
}

const AGE_VERIFIED_KEY = "bagsworld_casino_age_verified";

// Slot machine symbols
const SLOT_SYMBOLS = [
  { id: "seven", emoji: "7", color: "#ef4444", name: "Lucky Seven" },
  { id: "bar", emoji: "B", color: "#fbbf24", name: "Bar" },
  { id: "diamond", emoji: "D", color: "#60a5fa", name: "Diamond" },
  { id: "bell", emoji: "N", color: "#fde047", name: "Bell" },
  { id: "cherry", emoji: "C", color: "#f87171", name: "Cherry" },
  { id: "coin", emoji: "$", color: "#a3e635", name: "Coin" },
];

// Slot payout table
const SLOT_PAYOUTS: { combo: string[]; multiplier: number; name: string }[] = [
  { combo: ["seven", "seven", "seven"], multiplier: 100, name: "JACKPOT!" },
  { combo: ["bar", "bar", "bar"], multiplier: 50, name: "Triple Bar" },
  { combo: ["diamond", "diamond", "diamond"], multiplier: 30, name: "Diamonds" },
  { combo: ["bell", "bell", "bell"], multiplier: 20, name: "Bells" },
  { combo: ["cherry", "cherry", "cherry"], multiplier: 15, name: "Cherries" },
  { combo: ["coin", "coin", "coin"], multiplier: 10, name: "Coins" },
  { combo: ["seven", "seven", "*"], multiplier: 5, name: "Double Seven" },
  { combo: ["cherry", "cherry", "*"], multiplier: 3, name: "Double Cherry" },
];

// Bet options
const BET_OPTIONS = [0.01, 0.05, 0.1];

// Truncate wallet address for display
function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

// Enhanced pixel art corner with rivets
function CasinoCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const rotation = {
    tl: "rotate(0)",
    tr: "rotate(90deg)",
    br: "rotate(180deg)",
    bl: "rotate(270deg)",
  }[position];

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="absolute z-20"
      style={{
        transform: rotation,
        top: position.includes("t") ? "-4px" : "auto",
        bottom: position.includes("b") ? "-4px" : "auto",
        left: position.includes("l") ? "-4px" : "auto",
        right: position.includes("r") ? "-4px" : "auto",
      }}
    >
      {/* Outer diamond shape */}
      <rect x="0" y="0" width="4" height="4" fill="#fbbf24" />
      <rect x="4" y="0" width="4" height="4" fill="#dc2626" />
      <rect x="8" y="0" width="4" height="4" fill="#fbbf24" />
      <rect x="12" y="0" width="4" height="4" fill="#dc2626" />
      <rect x="0" y="4" width="4" height="4" fill="#dc2626" />
      <rect x="0" y="8" width="4" height="4" fill="#fbbf24" />
      <rect x="0" y="12" width="4" height="4" fill="#dc2626" />
      <rect x="16" y="0" width="4" height="4" fill="#b91c1c" />
      <rect x="0" y="16" width="4" height="4" fill="#b91c1c" />
      {/* Rivet/stud effect */}
      <rect x="6" y="6" width="4" height="4" fill="#fde047" />
      <rect x="7" y="7" width="2" height="2" fill="#d97706" />
    </svg>
  );
}

// Enhanced casino chip with more detail
function CasinoChip({ size = 24, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={`inline-block ${animated ? "animate-[spin_3s_linear_infinite]" : ""}`}
    >
      {/* Outer ring */}
      <rect x="6" y="1" width="8" height="2" fill="#dc2626" />
      <rect x="3" y="3" width="3" height="2" fill="#dc2626" />
      <rect x="14" y="3" width="3" height="2" fill="#dc2626" />
      <rect x="1" y="6" width="2" height="8" fill="#dc2626" />
      <rect x="17" y="6" width="2" height="8" fill="#dc2626" />
      <rect x="3" y="15" width="3" height="2" fill="#dc2626" />
      <rect x="14" y="15" width="3" height="2" fill="#dc2626" />
      <rect x="6" y="17" width="8" height="2" fill="#dc2626" />
      {/* Notches */}
      <rect x="8" y="0" width="2" height="1" fill="#fbbf24" />
      <rect x="0" y="9" width="1" height="2" fill="#fbbf24" />
      <rect x="19" y="9" width="1" height="2" fill="#fbbf24" />
      <rect x="8" y="19" width="2" height="1" fill="#fbbf24" />
      {/* Inner gold circle */}
      <rect x="5" y="5" width="10" height="10" fill="#fbbf24" />
      <rect x="4" y="6" width="1" height="8" fill="#fbbf24" />
      <rect x="15" y="6" width="1" height="8" fill="#fbbf24" />
      {/* Center emblem */}
      <rect x="7" y="7" width="6" height="6" fill="#dc2626" />
      <rect x="8" y="8" width="4" height="4" fill="#b91c1c" />
      <rect x="9" y="9" width="2" height="2" fill="#fde047" />
    </svg>
  );
}

// Animated pixel art roulette wheel
function RouletteWheel({ size = 40 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer frame (stationary) */}
      <svg width={size} height={size} viewBox="0 0 32 32" className="absolute inset-0">
        {/* Gold outer rim */}
        <rect x="12" y="0" width="8" height="2" fill="#d97706" />
        <rect x="8" y="2" width="4" height="2" fill="#d97706" />
        <rect x="20" y="2" width="4" height="2" fill="#d97706" />
        <rect x="4" y="4" width="4" height="2" fill="#d97706" />
        <rect x="24" y="4" width="4" height="2" fill="#d97706" />
        <rect x="2" y="6" width="2" height="4" fill="#d97706" />
        <rect x="28" y="6" width="2" height="4" fill="#d97706" />
        <rect x="0" y="10" width="2" height="12" fill="#d97706" />
        <rect x="30" y="10" width="2" height="12" fill="#d97706" />
        <rect x="2" y="22" width="2" height="4" fill="#d97706" />
        <rect x="28" y="22" width="2" height="4" fill="#d97706" />
        <rect x="4" y="26" width="4" height="2" fill="#d97706" />
        <rect x="24" y="26" width="4" height="2" fill="#d97706" />
        <rect x="8" y="28" width="4" height="2" fill="#d97706" />
        <rect x="20" y="28" width="4" height="2" fill="#d97706" />
        <rect x="12" y="30" width="8" height="2" fill="#d97706" />
        {/* Ball track (gold inner ring) */}
        <rect x="12" y="2" width="8" height="1" fill="#fbbf24" />
        <rect x="2" y="12" width="1" height="8" fill="#fbbf24" />
        <rect x="29" y="12" width="1" height="8" fill="#fbbf24" />
        <rect x="12" y="29" width="8" height="1" fill="#fbbf24" />
      </svg>
      {/* Spinning wheel */}
      <svg
        width={size * 0.75}
        height={size * 0.75}
        viewBox="0 0 24 24"
        className="absolute animate-[spin_4s_linear_infinite]"
        style={{ top: size * 0.125, left: size * 0.125 }}
      >
        {/* Wheel segments - alternating red/black */}
        <rect x="10" y="0" width="4" height="4" fill="#dc2626" />
        <rect x="16" y="2" width="4" height="4" fill="#1a1a1a" />
        <rect x="20" y="6" width="4" height="4" fill="#dc2626" />
        <rect x="20" y="12" width="4" height="4" fill="#1a1a1a" />
        <rect x="18" y="18" width="4" height="4" fill="#dc2626" />
        <rect x="12" y="20" width="4" height="4" fill="#1a1a1a" />
        <rect x="6" y="20" width="4" height="4" fill="#dc2626" />
        <rect x="0" y="16" width="4" height="4" fill="#1a1a1a" />
        <rect x="0" y="10" width="4" height="4" fill="#dc2626" />
        <rect x="0" y="4" width="4" height="4" fill="#1a1a1a" />
        <rect x="4" y="0" width="4" height="4" fill="#dc2626" />
        <rect x="14" y="4" width="4" height="4" fill="#1a1a1a" />
        {/* Green zero */}
        <rect x="8" y="2" width="2" height="2" fill="#16a34a" />
        {/* Inner circle */}
        <rect x="8" y="8" width="8" height="8" fill="#fbbf24" />
        <rect x="6" y="10" width="2" height="4" fill="#fbbf24" />
        <rect x="16" y="10" width="2" height="4" fill="#fbbf24" />
        {/* Center hub */}
        <rect x="10" y="10" width="4" height="4" fill="#d97706" />
        <rect x="11" y="11" width="2" height="2" fill="#fde047" />
      </svg>
      {/* Ball (bouncing on the wheel) */}
      <div
        className="absolute w-2 h-2 bg-white rounded-full shadow-lg animate-[roulette-ball_2s_ease-in-out_infinite]"
        style={{
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          boxShadow: "0 0 4px rgba(255,255,255,0.8), inset 1px 1px 0 rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

// Detailed pixel art raffle ticket
function RaffleTicket({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
      {/* Ticket body */}
      <rect x="1" y="4" width="18" height="12" fill="#fbbf24" />
      <rect x="2" y="5" width="16" height="10" fill="#0a0505" />
      {/* Gold border detail */}
      <rect x="1" y="4" width="18" height="1" fill="#fde047" />
      <rect x="1" y="15" width="18" height="1" fill="#d97706" />
      {/* Perforations */}
      <rect x="6" y="4" width="1" height="1" fill="#0a0505" />
      <rect x="6" y="6" width="1" height="1" fill="#fbbf24" />
      <rect x="6" y="8" width="1" height="1" fill="#0a0505" />
      <rect x="6" y="10" width="1" height="1" fill="#fbbf24" />
      <rect x="6" y="12" width="1" height="1" fill="#0a0505" />
      <rect x="6" y="14" width="1" height="1" fill="#fbbf24" />
      <rect x="6" y="15" width="1" height="1" fill="#0a0505" />
      {/* Star emblem */}
      <rect x="11" y="7" width="1" height="1" fill="#fbbf24" />
      <rect x="10" y="8" width="3" height="1" fill="#fbbf24" />
      <rect x="9" y="9" width="5" height="1" fill="#fde047" />
      <rect x="10" y="10" width="3" height="1" fill="#fbbf24" />
      <rect x="9" y="11" width="2" height="1" fill="#fbbf24" />
      <rect x="12" y="11" width="2" height="1" fill="#fbbf24" />
      {/* Ticket number lines */}
      <rect x="3" y="7" width="2" height="1" fill="#fbbf24" opacity="0.5" />
      <rect x="3" y="9" width="2" height="1" fill="#fbbf24" opacity="0.5" />
      <rect x="3" y="11" width="2" height="1" fill="#fbbf24" opacity="0.5" />
    </svg>
  );
}

// Pixel art slot machine icon
function SlotIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="inline-block">
      {/* Machine body */}
      <rect x="2" y="3" width="16" height="14" fill="#dc2626" />
      <rect x="3" y="4" width="14" height="12" fill="#b91c1c" />
      {/* Screen area */}
      <rect x="4" y="5" width="12" height="7" fill="#0a0505" />
      <rect x="5" y="6" width="10" height="5" fill="#1a0a0a" />
      {/* Three 7s */}
      <rect x="5" y="7" width="2" height="3" fill="#fbbf24" />
      <rect x="9" y="7" width="2" height="3" fill="#fbbf24" />
      <rect x="13" y="7" width="2" height="3" fill="#fbbf24" />
      {/* Lever */}
      <rect x="17" y="6" width="2" height="6" fill="#fbbf24" />
      <rect x="16" y="5" width="4" height="2" fill="#fde047" />
      {/* Coin slot */}
      <rect x="8" y="13" width="4" height="2" fill="#0a0505" />
      <rect x="9" y="13" width="2" height="1" fill="#fbbf24" />
      {/* Top decoration */}
      <rect x="6" y="2" width="8" height="2" fill="#fde047" />
      <rect x="8" y="1" width="4" height="1" fill="#fbbf24" />
    </svg>
  );
}

// Pixel padlock icon for coming soon
function PixelLock({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className="inline-block">
      <rect x="3" y="5" width="6" height="6" fill="#4a4a4a" />
      <rect x="4" y="6" width="4" height="4" fill="#3a3a3a" />
      <rect x="4" y="2" width="1" height="4" fill="#5a5a5a" />
      <rect x="7" y="2" width="1" height="4" fill="#5a5a5a" />
      <rect x="4" y="2" width="4" height="1" fill="#5a5a5a" />
      <rect x="5" y="7" width="2" height="2" fill="#fbbf24" />
    </svg>
  );
}

// Animated pixel chevron
function PixelChevron() {
  return (
    <div className="flex items-center animate-[bounce-x_1s_ease-in-out_infinite]">
      <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
        <rect x="2" y="5" width="2" height="2" fill="#fbbf24" />
        <rect x="4" y="4" width="2" height="2" fill="#fbbf24" />
        <rect x="4" y="6" width="2" height="2" fill="#fbbf24" />
        <rect x="6" y="3" width="2" height="2" fill="#fde047" />
        <rect x="6" y="7" width="2" height="2" fill="#fde047" />
        <rect x="8" y="4" width="2" height="2" fill="#fbbf24" />
        <rect x="8" y="6" width="2" height="2" fill="#fbbf24" />
      </svg>
    </div>
  );
}

// Pixel star bullet
function PixelStar() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" className="inline-block flex-shrink-0">
      <rect x="3" y="0" width="2" height="2" fill="#fbbf24" />
      <rect x="0" y="3" width="2" height="2" fill="#fbbf24" />
      <rect x="6" y="3" width="2" height="2" fill="#fbbf24" />
      <rect x="2" y="2" width="4" height="4" fill="#fde047" />
      <rect x="3" y="6" width="2" height="2" fill="#fbbf24" />
    </svg>
  );
}

// Slot reel symbol component
function SlotSymbol({ symbol, spinning }: { symbol: (typeof SLOT_SYMBOLS)[0]; spinning: boolean }) {
  return (
    <div
      className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center casino-reel-symbol ${spinning ? "animate-slot-blur" : ""}`}
      style={{ backgroundColor: "#0a0505" }}
    >
      <span
        className="font-pixel text-2xl sm:text-3xl"
        style={{ color: symbol.color, textShadow: `0 0 8px ${symbol.color}40` }}
      >
        {symbol.emoji}
      </span>
    </div>
  );
}

export function CasinoModal({ onClose }: CasinoModalProps) {
  const [view, setView] = useState<"lobby" | "raffle" | "slots" | "admin">("lobby");
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Token gate states
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);

  // Raffle states
  const [raffle, setRaffle] = useState<RaffleState | null>(null);
  const [isLoadingRaffle, setIsLoadingRaffle] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [entryMessage, setEntryMessage] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Slot machine states
  const [slotReels, setSlotReels] = useState<(typeof SLOT_SYMBOLS)[0][]>([
    SLOT_SYMBOLS[0],
    SLOT_SYMBOLS[0],
    SLOT_SYMBOLS[0],
  ]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelsStopped, setReelsStopped] = useState([true, true, true]);
  const [selectedBet, setSelectedBet] = useState(BET_OPTIONS[0]);
  const [slotResult, setSlotResult] = useState<{
    win: boolean;
    amount: number;
    name: string;
  } | null>(null);
  const [slotCredits, setSlotCredits] = useState(1.0);
  const spinTimeouts = useRef<NodeJS.Timeout[]>([]);

  // Wallet hooks
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { isAdmin: isUserAdmin } = useAdminCheck();

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Entry animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Check localStorage on mount
  useEffect(() => {
    const verified = localStorage.getItem(AGE_VERIFIED_KEY);
    setAgeVerified(verified === "true");
  }, []);

  // Check token access when age verified and wallet connected
  const checkTokenAccess = useCallback(async () => {
    if (!publicKey || !connection) return;

    // Admin wallet bypasses token gate
    if (isUserAdmin) {
      setTokenBalance(0);
      setHasAccess(true);
      return;
    }

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
  }, [publicKey, connection, isUserAdmin]);

  // Fetch raffle status
  const fetchRaffleStatus = useCallback(
    async (silent = false) => {
      if (!publicKey) return;

      if (!silent) {
        setIsLoadingRaffle(true);
      }
      try {
        const res = await fetch(
          `/api/casino/raffle?wallet=${publicKey.toString()}&includeCompleted=true`
        );
        const data = await res.json();
        setRaffle(data);
        setLastRefresh(new Date());
      } catch (error) {
        console.error("Error fetching raffle:", error);
        if (!silent) {
          setRaffle({ status: "none", message: "Failed to load raffle" } as RaffleState);
        }
      } finally {
        if (!silent) {
          setIsLoadingRaffle(false);
        }
      }
    },
    [publicKey]
  );

  // Trigger token check when age verified and wallet changes
  useEffect(() => {
    if (ageVerified && connected && publicKey) {
      checkTokenAccess();
    } else if (!connected) {
      setHasAccess(null);
      setTokenBalance(0);
    }
  }, [ageVerified, connected, publicKey, checkTokenAccess]);

  // Fetch raffle when view is raffle
  useEffect(() => {
    if (view === "raffle" && publicKey && hasAccess) {
      fetchRaffleStatus();
    }
  }, [view, publicKey, hasAccess, fetchRaffleStatus]);

  // Auto-refresh raffle every 10s
  useEffect(() => {
    if (view !== "raffle" || !publicKey || !hasAccess) return;
    const interval = setInterval(() => fetchRaffleStatus(true), 10000);
    return () => clearInterval(interval);
  }, [view, publicKey, hasAccess, fetchRaffleStatus]);

  // Cleanup spin timeouts
  useEffect(() => {
    return () => {
      spinTimeouts.current.forEach(clearTimeout);
    };
  }, []);

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
      onClose();
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

  // Slot machine functions
  const spinSlots = () => {
    if (isSpinning || slotCredits < selectedBet) return;

    setSlotCredits((prev) => prev - selectedBet);
    setIsSpinning(true);
    setSlotResult(null);
    setReelsStopped([false, false, false]);

    spinTimeouts.current.forEach(clearTimeout);
    spinTimeouts.current = [];

    const finalReels = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];

    const stopTimes = [500, 1000, 1500];

    stopTimes.forEach((time, index) => {
      const timeout = setTimeout(() => {
        setSlotReels((prev) => {
          const newReels = [...prev];
          newReels[index] = finalReels[index];
          return newReels;
        });
        setReelsStopped((prev) => {
          const newStopped = [...prev];
          newStopped[index] = true;
          return newStopped;
        });

        if (index === 2) {
          setTimeout(() => {
            checkWin(finalReels);
            setIsSpinning(false);
          }, 200);
        }
      }, time);
      spinTimeouts.current.push(timeout);
    });
  };

  const checkWin = (reels: (typeof SLOT_SYMBOLS)[0][]) => {
    const reelIds = reels.map((r) => r.id);

    for (const payout of SLOT_PAYOUTS) {
      const matches = payout.combo.every((symbol, i) => {
        if (symbol === "*") return true;
        return symbol === reelIds[i];
      });

      if (matches) {
        const winAmount = selectedBet * payout.multiplier;
        setSlotCredits((prev) => prev + winAmount);
        setSlotResult({ win: true, amount: winAmount, name: payout.name });
        return;
      }
    }

    setSlotResult({ win: false, amount: 0, name: "No win" });
  };

  // Loading state
  if (ageVerified === null) {
    return (
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <button
          onClick={onClose}
          className="absolute top-14 right-4 sm:top-4 font-pixel text-xs text-gray-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          [X]
        </button>
        <div className="font-pixel text-red-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  // Shared styles
  const modalStyles = `
    @keyframes neon-flicker {
      0%, 100% { opacity: 1; text-shadow: 0 0 4px #fbbf24, 0 0 8px #fbbf24, 0 0 12px #dc2626, 0 0 20px #dc2626; }
      50% { opacity: 0.95; text-shadow: 0 0 2px #fbbf24, 0 0 4px #fbbf24, 0 0 8px #dc2626; }
      52% { opacity: 1; }
      54% { opacity: 0.9; }
      56% { opacity: 1; }
    }
    @keyframes slot-blur {
      0% { filter: blur(0px); transform: translateY(0); }
      50% { filter: blur(2px); transform: translateY(-2px); }
      100% { filter: blur(0px); transform: translateY(0); }
    }
    @keyframes jackpot-flash {
      0%, 100% { background-color: #dc2626; }
      25% { background-color: #fbbf24; }
      50% { background-color: #ef4444; }
      75% { background-color: #fde047; }
    }
    @keyframes bounce-x {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(4px); }
    }
    @keyframes roulette-ball {
      0% { top: 15%; left: 50%; }
      25% { top: 50%; left: 85%; }
      50% { top: 85%; left: 50%; }
      75% { top: 50%; left: 15%; }
      100% { top: 15%; left: 50%; }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 8px rgba(251, 191, 36, 0.4); }
      50% { box-shadow: 0 0 16px rgba(251, 191, 36, 0.8), 0 0 24px rgba(251, 191, 36, 0.4); }
    }
    @keyframes modal-enter {
      0% { opacity: 0; transform: scale(0.95) translateY(-10px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .casino-border {
      border: 4px solid #dc2626;
      box-shadow:
        inset 0 0 0 2px #7f1d1d,
        inset 0 0 0 4px #b91c1c,
        inset 4px 4px 8px rgba(0,0,0,0.5),
        0 0 20px rgba(239, 68, 68, 0.3),
        0 0 40px rgba(251, 191, 36, 0.1);
    }
    .casino-border-inner {
      border: 2px solid #b91c1c;
      box-shadow:
        inset 0 0 0 1px #7f1d1d,
        inset 2px 2px 4px rgba(0,0,0,0.4);
    }
    .casino-border-double {
      border: 3px solid #dc2626;
      box-shadow:
        inset 0 0 0 1px #0a0505,
        inset 0 0 0 3px #b91c1c,
        inset 0 0 0 4px #0a0505,
        inset 0 0 0 6px #7f1d1d,
        inset 4px 4px 8px rgba(0,0,0,0.5);
    }
    .casino-button {
      border: 3px solid;
      border-color: #fbbf24 #7f1d1d #7f1d1d #fbbf24;
      background: linear-gradient(180deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
      box-shadow:
        2px 2px 0 #1a0a0a,
        inset 1px 1px 0 rgba(255,255,255,0.1);
      transition: all 0.1s;
    }
    .casino-button:hover:not(:disabled) {
      border-color: #fde047 #b91c1c #b91c1c #fde047;
      background: linear-gradient(180deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
      box-shadow:
        2px 2px 0 #1a0a0a,
        0 0 12px rgba(251, 191, 36, 0.3),
        inset 1px 1px 0 rgba(255,255,255,0.2);
    }
    .casino-button:active:not(:disabled),
    .casino-button.active {
      border-color: #7f1d1d #fbbf24 #fbbf24 #7f1d1d;
      background: linear-gradient(180deg, #991b1b 0%, #7f1d1d 50%, #450a0a 100%);
      box-shadow: inset 2px 2px 4px rgba(0,0,0,0.5);
      transform: translate(1px, 1px);
    }
    .casino-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .casino-button-gold {
      border-color: #fde047 #92400e #92400e #fde047;
      background: linear-gradient(180deg, #fbbf24 0%, #d97706 50%, #b45309 100%);
      color: #1a0a0a;
      text-shadow: 0 1px 0 rgba(255,255,255,0.3);
    }
    .casino-button-gold:hover:not(:disabled) {
      background: linear-gradient(180deg, #fde047 0%, #fbbf24 50%, #d97706 100%);
    }
    .casino-button-green {
      border-color: #4ade80 #14532d #14532d #4ade80;
      background: linear-gradient(180deg, #22c55e 0%, #16a34a 50%, #166534 100%);
      color: white;
    }
    .casino-tab {
      position: relative;
      border: 2px solid #7f1d1d;
      background: linear-gradient(180deg, #1a0a0a 0%, #0a0505 100%);
      opacity: 0.7;
      transition: all 0.15s;
    }
    .casino-tab:hover:not(.active) {
      opacity: 0.9;
      border-color: #b91c1c;
    }
    .casino-tab.active {
      opacity: 1;
      border-color: #fbbf24;
      background: linear-gradient(180deg, #2a1515 0%, #1a0a0a 100%);
      box-shadow:
        inset 0 -2px 0 #fbbf24,
        0 0 8px rgba(251, 191, 36, 0.3);
    }
    .casino-tab.active::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 20%;
      right: 20%;
      height: 2px;
      background: #fbbf24;
      box-shadow: 0 0 8px #fbbf24;
    }
    .neon-sign {
      animation: neon-flicker 3s ease-in-out infinite;
      color: #fbbf24;
    }
    .casino-carpet {
      background-color: #1a0a0a;
      background-image:
        repeating-linear-gradient(45deg, #2a1515 0px, #2a1515 2px, transparent 2px, transparent 12px),
        repeating-linear-gradient(-45deg, #2a1515 0px, #2a1515 2px, transparent 2px, transparent 12px);
    }
    .slot-reel {
      background: #0a0505;
      border: 3px solid #fbbf24;
      box-shadow:
        inset 0 0 10px rgba(0, 0, 0, 0.8),
        inset 0 0 20px rgba(0, 0, 0, 0.4),
        0 0 8px rgba(251, 191, 36, 0.3);
    }
    .casino-scanlines {
      pointer-events: none;
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.1) 0px, rgba(0, 0, 0, 0.1) 1px, transparent 1px, transparent 2px);
      z-index: 100;
    }
    .glow-red { text-shadow: 0 0 8px rgba(239, 68, 68, 0.8), 0 0 16px rgba(239, 68, 68, 0.4); }
    .glow-gold { text-shadow: 0 0 8px rgba(251, 191, 36, 0.8), 0 0 16px rgba(251, 191, 36, 0.4); }
    .glow-green { text-shadow: 0 0 8px rgba(34, 197, 94, 0.8), 0 0 16px rgba(34, 197, 94, 0.4); }
    .animate-slot-blur { animation: slot-blur 0.1s linear infinite; }
    .game-card {
      position: relative;
      transition: all 0.2s ease;
    }
    .game-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(251, 191, 36, 0) 0%, rgba(251, 191, 36, 0.1) 50%, rgba(251, 191, 36, 0) 100%);
      opacity: 0;
      transition: opacity 0.2s;
    }
    .game-card:hover::before {
      opacity: 1;
    }
    .game-card:hover {
      transform: translateX(2px);
      box-shadow:
        inset 0 0 0 1px #7f1d1d,
        inset 2px 2px 4px rgba(0,0,0,0.4),
        0 0 12px rgba(251, 191, 36, 0.2);
    }
    .parchment-bg {
      background: linear-gradient(180deg, #2a1a10 0%, #1a0a05 100%);
      background-image:
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(251, 191, 36, 0.02) 2px, rgba(251, 191, 36, 0.02) 4px);
    }
    .pixel-badge {
      border: 2px solid;
      border-color: #fde047 #92400e #92400e #fde047;
      background: linear-gradient(180deg, #fbbf24 0%, #d97706 100%);
      box-shadow: 1px 1px 0 #1a0a0a;
    }
    .pixel-badge-demo {
      border-color: #a3e635 #365314 #365314 #a3e635;
      background: linear-gradient(180deg, #84cc16 0%, #65a30d 100%);
    }
    .follow-pulse {
      animation: pulse-glow 2s ease-in-out infinite;
    }
    .coming-soon-card {
      position: relative;
      border: 2px solid #3a3a3a;
      background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);
      box-shadow: inset 2px 2px 4px rgba(0,0,0,0.5);
    }
    .coming-soon-card::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.2) 4px, rgba(0,0,0,0.2) 8px);
    }
  `;

  // Age verification gate
  if (!ageVerified) {
    return (
      <div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 safe-area-bottom"
        onClick={handleBackdropClick}
      >
        <style jsx global>
          {modalStyles}
        </style>
        <div
          className={`casino-border bg-[#0a0505] max-w-md w-full overflow-hidden relative transition-all duration-300 rounded-t-xl sm:rounded-xl ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
          style={{ animation: isVisible ? "modal-enter 0.3s ease-out" : "none" }}
        >
          <div className="casino-scanlines" />
          <CasinoCorner position="tl" />
          <CasinoCorner position="tr" />
          <CasinoCorner position="bl" />
          <CasinoCorner position="br" />

          <div className="bg-gradient-to-b from-[#1a0a0a] to-[#0a0505] p-6 border-b-2 border-[#b91c1c]">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="font-pixel text-2xl text-yellow-400 animate-pulse">!</span>
              <h2 className="font-pixel text-xl text-red-400 tracking-wider glow-red">
                AGE VERIFICATION
              </h2>
              <span className="font-pixel text-2xl text-yellow-400 animate-pulse">!</span>
            </div>
            <p className="text-center text-red-300/80 text-sm font-pixel">Gambling content ahead</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex justify-center">
              <div className="w-20 h-20 casino-border-double bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center">
                <span className="font-pixel text-2xl text-white glow-gold">18+</span>
              </div>
            </div>

            <div className="casino-border-inner parchment-bg p-4 max-h-40 overflow-y-auto">
              <p className="text-gray-300 text-xs leading-relaxed mb-3 font-pixel">
                By entering, you confirm:
              </p>
              <ul className="text-gray-400 text-[11px] space-y-2 font-pixel">
                <li className="flex items-start gap-2">
                  <PixelStar />
                  <span>
                    You are <strong className="text-white">18+ years old</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <PixelStar />
                  <span>
                    Gambling is <strong className="text-white">legal</strong> in your area
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <PixelStar />
                  <span>
                    You understand <strong className="text-white">risk of loss</strong>
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleAgeVerification(false)}
                className="flex-1 py-3 px-4 casino-border-inner bg-[#1a0a0a] hover:bg-[#2a1515] text-gray-300 font-pixel text-xs transition-colors"
              >
                EXIT
              </button>
              <button
                onClick={() => handleAgeVerification(true)}
                className="flex-1 py-3 px-4 casino-button casino-button-gold font-pixel text-xs"
              >
                I AM 18+ ENTER
              </button>
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
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 safe-area-bottom"
        onClick={handleBackdropClick}
      >
        <style jsx global>
          {modalStyles}
        </style>
        <div
          className={`casino-border bg-[#0a0505] max-w-md w-full overflow-hidden relative transition-all duration-300 rounded-t-xl sm:rounded-xl ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
          style={{ animation: isVisible ? "modal-enter 0.3s ease-out" : "none" }}
        >
          <div className="casino-scanlines" />
          <CasinoCorner position="tl" />
          <CasinoCorner position="tr" />
          <CasinoCorner position="bl" />
          <CasinoCorner position="br" />

          <div className="bg-gradient-to-b from-[#1a0a0a] to-[#0a0505] p-6 border-b-2 border-[#b91c1c]">
            <div className="flex items-center justify-center gap-3 mb-2">
              <CasinoChip size={32} />
              <h2 className="font-pixel text-xl text-yellow-400 tracking-wider glow-gold">
                TOKEN GATE
              </h2>
              <CasinoChip size={32} />
            </div>
            <p className="text-center text-red-300/80 text-sm font-pixel">
              Connect wallet to enter
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="casino-border-inner parchment-bg p-4">
              <p className="text-center text-white text-sm mb-2 font-pixel">
                <strong>
                  Hold {MIN_TOKEN_BALANCE.toLocaleString()} {BAGSWORLD_TOKEN_SYMBOL}
                </strong>
              </p>
              <p className="text-center text-gray-400 text-xs font-pixel">
                to unlock BagsWorld Casino
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 casino-border-inner bg-[#1a0a0a] hover:bg-[#2a1515] text-gray-300 font-pixel text-xs transition-colors"
              >
                EXIT
              </button>
              <button
                onClick={() => setWalletModalVisible(true)}
                className="flex-1 py-3 px-4 casino-button font-pixel text-xs text-white"
              >
                CONNECT WALLET
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Token gate - checking
  if (isCheckingAccess || hasAccess === null) {
    return (
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <button
          onClick={onClose}
          className="absolute top-14 right-4 sm:top-4 font-pixel text-xs text-gray-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          [X]
        </button>
        <style jsx global>
          {modalStyles}
        </style>
        <div className="casino-border bg-[#0a0505] p-8 max-w-sm w-full relative">
          <div className="casino-scanlines" />
          <div className="flex flex-col items-center gap-4">
            <CasinoChip size={48} animated />
            <div className="font-pixel text-red-400 text-center">
              Checking {BAGSWORLD_TOKEN_SYMBOL}...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Token gate - insufficient balance
  if (!hasAccess) {
    return (
      <div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 safe-area-bottom"
        onClick={handleBackdropClick}
      >
        <style jsx global>
          {modalStyles}
        </style>
        <div
          className={`casino-border bg-[#0a0505] max-w-md w-full overflow-hidden relative transition-all duration-300 rounded-t-xl sm:rounded-xl ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <div className="casino-scanlines" />
          <CasinoCorner position="tl" />
          <CasinoCorner position="tr" />
          <CasinoCorner position="bl" />
          <CasinoCorner position="br" />

          <div className="bg-gradient-to-b from-[#1a0a0a] to-[#0a0505] p-6 border-b-2 border-[#b91c1c]">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="font-pixel text-2xl text-red-400">X</span>
              <h2 className="font-pixel text-xl text-yellow-400 tracking-wider glow-gold">
                ACCESS DENIED
              </h2>
              <span className="font-pixel text-2xl text-red-400">X</span>
            </div>
            <p className="text-center text-red-300/80 text-sm font-pixel">
              Insufficient {BAGSWORLD_TOKEN_SYMBOL}
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="casino-border-inner parchment-bg p-5">
              <div className="text-center mb-4">
                <p className="text-gray-400 text-xs mb-1 font-pixel">Required to Enter</p>
                <p className="text-white font-bold text-2xl font-pixel">
                  {MIN_TOKEN_BALANCE.toLocaleString()}{" "}
                  <span className="text-yellow-400">{BAGSWORLD_TOKEN_SYMBOL}</span>
                </p>
              </div>
              <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent mb-4" />
              <div className="text-center">
                <p className="text-gray-400 text-xs mb-1 font-pixel">Your Balance</p>
                <p className="text-red-400 font-bold text-xl font-pixel">
                  {tokenBalance.toLocaleString()}{" "}
                  <span className="text-yellow-400/60">{BAGSWORLD_TOKEN_SYMBOL}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 casino-border-inner bg-[#1a0a0a] hover:bg-[#2a1515] text-gray-300 font-pixel text-xs transition-colors"
              >
                EXIT
              </button>
              <a
                href={BAGSWORLD_BUY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 casino-button casino-button-gold font-pixel text-xs text-center block"
              >
                BUY ON BAGS.FM
              </a>
            </div>

            <button
              onClick={checkTokenAccess}
              className="w-full py-2 text-yellow-400 hover:text-yellow-300 text-xs transition-colors flex items-center justify-center gap-2 font-pixel"
            >
              [REFRESH BALANCE]
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin panel
  if (showAdminPanel && isUserAdmin) {
    return <CasinoAdmin onClose={() => setShowAdminPanel(false)} />;
  }

  // Main casino modal
  return (
    <div
      className="fixed inset-0 bg-black/95 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <style jsx global>
        {modalStyles}
      </style>

      <div
        className={`casino-border bg-[#0a0505] w-full max-w-lg max-h-[95vh] flex flex-col relative overflow-hidden transition-all duration-300 rounded-t-xl sm:rounded-xl ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        style={{ animation: isVisible ? "modal-enter 0.3s ease-out" : "none" }}
      >
        <div className="casino-scanlines" />
        <CasinoCorner position="tl" />
        <CasinoCorner position="tr" />
        <CasinoCorner position="bl" />
        <CasinoCorner position="br" />

        {/* Header */}
        <div className="bg-gradient-to-b from-[#1a0a0a] to-[#0a0505] px-4 py-3 flex items-center justify-between shrink-0 relative">
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#dc2626] to-transparent" />
          <div className="flex items-center gap-3">
            <RouletteWheel size={42} />
            <div>
              <span className="font-pixel text-lg neon-sign">CASINO</span>
              <span className="font-pixel text-[10px] text-gray-500 block">BAGSWORLD</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[8px] px-2 py-1 pixel-badge text-[#1a0a0a]">BETA</span>
            <button
              onClick={onClose}
              className="casino-button font-pixel text-white text-[10px] px-2 py-1"
            >
              X
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-2 py-2 bg-[#0a0505] shrink-0">
          {(["lobby", "raffle", "slots", ...(isUserAdmin ? ["admin"] : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (tab === "admin") {
                  setShowAdminPanel(true);
                } else {
                  setView(tab as "lobby" | "raffle" | "slots");
                }
              }}
              className={`flex-1 font-pixel text-[10px] py-2 px-2 casino-tab ${view === tab ? "active" : ""} ${tab === "admin" ? "!border-green-500/50" : ""}`}
            >
              <span className={view === tab ? "text-yellow-400 glow-gold" : "text-gray-400"}>
                {tab.toUpperCase()}
              </span>
            </button>
          ))}
        </div>

        {/* Decorative divider */}
        <div className="h-[4px] bg-gradient-to-r from-[#dc2626] via-[#fbbf24] to-[#dc2626] relative">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto casino-carpet p-4 relative z-10">
          {/* LOBBY VIEW */}
          {view === "lobby" && (
            <div className="space-y-4">
              {/* Welcome Banner */}
              <div className="casino-border-double bg-[#0a0505] p-4 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-transparent" />
                <p className="font-pixel text-yellow-400 text-xs mb-2 glow-gold relative z-10">
                  WELCOME TO THE
                </p>
                <p className="font-pixel text-2xl neon-sign relative z-10">BAGSWORLD CASINO</p>
                <p className="font-pixel text-gray-500 text-[10px] mt-2 relative z-10">
                  Select a game to begin
                </p>
              </div>

              {/* Game Cards */}
              <div className="space-y-3">
                {/* Raffle - LIVE */}
                <button
                  onClick={() => setView("raffle")}
                  className="w-full text-left casino-border-inner bg-[#1a0a0a] p-4 game-card group"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <RaffleTicket size={40} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-pixel text-white text-sm group-hover:text-yellow-400 transition-colors">
                          RAFFLE
                        </span>
                        <span className="font-pixel text-[8px] px-2 py-0.5 pixel-badge pixel-badge-demo text-[#1a0a0a] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          LIVE
                        </span>
                      </div>
                      <p className="font-pixel text-gray-500 text-[10px] mt-1">
                        Free entry, winner takes pot
                      </p>
                    </div>
                    <PixelChevron />
                  </div>
                </button>

                {/* Slots */}
                <button
                  onClick={() => setView("slots")}
                  className="w-full text-left casino-border-inner bg-[#1a0a0a] p-4 game-card group"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <SlotIcon size={40} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-pixel text-white text-sm group-hover:text-yellow-400 transition-colors">
                          SLOT MACHINE
                        </span>
                        <span className="font-pixel text-[8px] px-2 py-0.5 pixel-badge text-[#1a0a0a]">
                          DEMO
                        </span>
                      </div>
                      <p className="font-pixel text-gray-500 text-[10px] mt-1">
                        Spin to win up to 100x
                      </p>
                    </div>
                    <PixelChevron />
                  </div>
                </button>

                {/* Coming Soon Section */}
                <div className="casino-border-inner bg-[#0a0505] p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <PixelLock size={12} />
                    <p className="font-pixel text-gray-500 text-[10px]">COMING SOON</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: "H/L", name: "HIGH/LOW" },
                      { icon: "2x", name: "COIN FLIP" },
                      { icon: "D6", name: "DICE" },
                    ].map((game) => (
                      <div key={game.name} className="coming-soon-card p-2 text-center">
                        <div className="relative z-10">
                          <span className="font-pixel text-gray-600 text-sm block">
                            {game.icon}
                          </span>
                          <span className="font-pixel text-gray-700 text-[8px]">{game.name}</span>
                        </div>
                        <div className="absolute top-1 right-1 z-10">
                          <PixelLock size={10} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="casino-border-inner parchment-bg overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-600/30 via-yellow-500/20 to-yellow-600/30 px-3 py-1.5 border-b border-yellow-600/30">
                  <p className="font-pixel text-yellow-400 text-[10px] glow-gold flex items-center gap-2">
                    <PixelStar /> INFO <PixelStar />
                  </p>
                </div>
                <div className="p-3 space-y-1.5">
                  {[
                    `Hold ${BAGSWORLD_TOKEN_SYMBOL} to play`,
                    "Funded by ecosystem",
                    "Play responsibly",
                  ].map((text, i) => (
                    <p
                      key={i}
                      className="font-pixel text-[10px] text-gray-400 flex items-center gap-2"
                    >
                      <PixelStar /> {text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RAFFLE VIEW */}
          {view === "raffle" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RaffleTicket size={36} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-white text-sm">RAFFLE</span>
                      {raffle?.status === "paused" ? (
                        <span className="font-pixel text-[8px] px-2 py-0.5 pixel-badge text-[#1a0a0a]">
                          PAUSED
                        </span>
                      ) : raffle?.status === "active" ? (
                        <span className="font-pixel text-[8px] px-2 py-0.5 pixel-badge pixel-badge-demo text-[#1a0a0a] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          LIVE
                        </span>
                      ) : null}
                    </div>
                    <p className="font-pixel text-gray-500 text-[10px] mt-1">
                      Free entry, winner takes all
                      {lastRefresh && <span className="text-gray-600 ml-2">(auto-refresh)</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setView("lobby")}
                  className="casino-button font-pixel text-white text-[10px] px-2 py-1"
                >
                  &lt;
                </button>
              </div>

              {isLoadingRaffle ? (
                <div className="casino-border-inner bg-[#0a0505] p-8 text-center">
                  <CasinoChip size={48} animated />
                  <p className="font-pixel text-red-400 text-sm mt-4">Loading raffle...</p>
                </div>
              ) : raffle?.status === "none" || !raffle ? (
                <div className="casino-border-inner bg-[#0a0505] p-6 text-center">
                  <RaffleTicket size={48} />
                  <p className="font-pixel text-gray-400 text-sm mt-4">No Active Raffle</p>
                  <p className="font-pixel text-gray-600 text-[10px] mt-2">
                    {raffle?.message || "Check back soon!"}
                  </p>
                </div>
              ) : raffle.status === "completed" ? (
                <div className="space-y-4">
                  <div className="casino-border-double bg-gradient-to-b from-[#2a1515] to-[#1a0a0a] p-6 text-center">
                    <span className="font-pixel text-3xl">&#127942;</span>
                    <p className="font-pixel text-yellow-400 text-lg mt-2 glow-gold">
                      RAFFLE COMPLETE!
                    </p>
                    <p className="font-pixel text-gray-400 text-sm mt-2">Winner has been drawn</p>

                    <div className="casino-border-inner bg-[#0a0505] p-4 mt-4 space-y-3">
                      <div>
                        <p className="font-pixel text-gray-500 text-[10px]">WINNER</p>
                        <p className="font-pixel text-white text-lg">
                          {raffle.winnerWallet ? truncateWallet(raffle.winnerWallet) : "Unknown"}
                        </p>
                        {raffle.winnerWallet === publicKey?.toString() && (
                          <p className="font-pixel text-yellow-400 text-xs mt-1 animate-pulse glow-gold">
                            That&apos;s you!
                          </p>
                        )}
                      </div>
                      <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
                      <div>
                        <p className="font-pixel text-gray-500 text-[10px]">PRIZE</p>
                        <p className="font-pixel text-green-400 text-xl glow-green">
                          {raffle.prizeSol?.toFixed(2) || "0"} SOL
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : raffle.status === "drawing" ? (
                <div className="casino-border-inner bg-[#0a0505] p-6 text-center">
                  <CasinoChip size={48} animated />
                  <p className="font-pixel text-yellow-400 text-lg mt-4 glow-gold">
                    DRAWING WINNER...
                  </p>
                  <p className="font-pixel text-gray-500 text-sm mt-2">Please wait</p>
                </div>
              ) : raffle.status === "paused" ? (
                <div className="space-y-4">
                  <div className="casino-border-inner bg-[#1a0a0a] p-6 text-center">
                    <span className="font-pixel text-3xl text-yellow-400">||</span>
                    <p className="font-pixel text-yellow-400 text-lg mt-2">RAFFLE PAUSED</p>
                    <p className="font-pixel text-gray-500 text-sm mt-2">
                      Entries temporarily disabled
                    </p>

                    <div className="casino-border-inner bg-[#0a0505] p-4 mt-4 space-y-2">
                      <div className="flex justify-between font-pixel text-[10px]">
                        <span className="text-gray-500">Prize Pool</span>
                        <span className="text-white">{raffle.potSol?.toFixed(2) || "0"} SOL</span>
                      </div>
                      <div className="flex justify-between font-pixel text-[10px]">
                        <span className="text-gray-500">Entries</span>
                        <span className="text-white">
                          {raffle.entryCount} / {raffle.threshold}
                        </span>
                      </div>
                      {raffle.userEntered && (
                        <div className="pt-2 border-t border-[#b91c1c]">
                          <p className="font-pixel text-green-400 text-[10px] flex items-center justify-center gap-1">
                            <PixelStar /> You&apos;re entered
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="casino-border-double bg-gradient-to-b from-[#2a1515] to-[#1a0a0a] p-6 text-center">
                    <p className="font-pixel text-gray-400 text-[10px] uppercase tracking-wider">
                      Prize Pool
                    </p>
                    <p className="font-pixel text-4xl text-white mt-1 glow-gold">
                      {raffle.potSol?.toFixed(2) || "0"}{" "}
                      <span className="text-yellow-400">SOL</span>
                    </p>
                    <p className="font-pixel text-gray-500 text-[10px] mt-1">Winner takes all!</p>
                  </div>

                  <div className="casino-border-inner bg-[#0a0505] p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-pixel text-gray-400 text-[10px]">Entries</p>
                      <p className="font-pixel text-white text-sm">
                        {raffle.entryCount} / {raffle.threshold}
                      </p>
                    </div>
                    <div className="w-full bg-[#1a0a0a] casino-border-inner h-4 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#dc2626] to-[#fbbf24] transition-all duration-500 relative"
                        style={{
                          width: `${Math.min((raffle.entryCount / raffle.threshold) * 100, 100)}%`,
                        }}
                      >
                        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(255,255,255,0.1)_4px,rgba(255,255,255,0.1)_8px)]" />
                      </div>
                    </div>
                    <p className="font-pixel text-gray-500 text-[10px] mt-2 text-center">
                      {raffle.entryCount >= raffle.threshold
                        ? "Threshold reached! Draw incoming..."
                        : `${raffle.threshold - raffle.entryCount} more entries until draw`}
                    </p>
                  </div>

                  {raffle.userEntered ? (
                    <div className="casino-border-inner bg-green-500/10 p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <PixelStar />
                        <p className="font-pixel text-green-400 glow-green">YOU&apos;RE IN!</p>
                        <PixelStar />
                      </div>
                      <p className="font-pixel text-gray-400 text-[10px]">
                        Your entry is recorded. Good luck!
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleEnterRaffle}
                      disabled={isEntering}
                      className="w-full py-4 casino-button casino-button-gold font-pixel text-sm"
                    >
                      {isEntering ? "ENTERING..." : "ENTER RAFFLE (FREE)"}
                    </button>
                  )}

                  {entryMessage && (
                    <p
                      className={`font-pixel text-center text-sm ${entryMessage.includes("in!") ? "text-green-400 glow-green" : "text-red-400"}`}
                    >
                      {entryMessage}
                    </p>
                  )}

                  <div className="casino-border-inner parchment-bg overflow-hidden">
                    <div className="bg-gradient-to-r from-yellow-600/30 via-yellow-500/20 to-yellow-600/30 px-3 py-1.5 border-b border-yellow-600/30">
                      <p className="font-pixel text-yellow-400 text-[10px] glow-gold">
                        HOW IT WORKS
                      </p>
                    </div>
                    <div className="p-3 space-y-1">
                      {[
                        "Free entry - one per wallet",
                        "Winner drawn at threshold",
                        "Winner gets entire pot",
                        "Secure random selection",
                      ].map((text, i) => (
                        <p
                          key={i}
                          className="font-pixel text-[10px] text-gray-400 flex items-center gap-2"
                        >
                          <PixelStar /> {text}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => fetchRaffleStatus()}
                className="w-full py-2 casino-button font-pixel text-white text-[10px]"
              >
                [REFRESH]
              </button>
            </div>
          )}

          {/* SLOTS VIEW */}
          {view === "slots" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SlotIcon size={36} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-white text-sm">SLOT MACHINE</span>
                      <span className="font-pixel text-[8px] px-2 py-0.5 pixel-badge text-[#1a0a0a]">
                        DEMO
                      </span>
                    </div>
                    <p className="font-pixel text-gray-500 text-[10px] mt-1">Spin to win big!</p>
                  </div>
                </div>
                <button
                  onClick={() => setView("lobby")}
                  className="casino-button font-pixel text-white text-[10px] px-2 py-1"
                >
                  &lt;
                </button>
              </div>

              <div className="casino-border-inner bg-[#0a0505] p-3 flex justify-between items-center">
                <span className="font-pixel text-gray-500 text-[10px]">CREDITS</span>
                <span className="font-pixel text-yellow-400 text-lg glow-gold">
                  {slotCredits.toFixed(2)} SOL
                </span>
              </div>

              <div
                className={`casino-border-double bg-[#0a0505] p-4 ${slotResult?.win && slotResult.amount > selectedBet * 10 ? "animate-[jackpot-flash_0.5s_ease-in-out_5]" : ""}`}
              >
                <div className="flex justify-center gap-2 mb-4">
                  {slotReels.map((symbol, index) => (
                    <div key={index} className="slot-reel p-1">
                      <SlotSymbol symbol={symbol} spinning={isSpinning && !reelsStopped[index]} />
                    </div>
                  ))}
                </div>

                {slotResult && (
                  <div
                    className={`text-center py-2 ${slotResult.win ? "casino-border-inner bg-green-500/10" : ""}`}
                  >
                    {slotResult.win ? (
                      <>
                        <p className="font-pixel text-yellow-400 text-lg glow-gold animate-pulse">
                          {slotResult.name}
                        </p>
                        <p className="font-pixel text-green-400 text-xl glow-green">
                          +{slotResult.amount.toFixed(2)} SOL
                        </p>
                      </>
                    ) : (
                      <p className="font-pixel text-gray-500 text-sm">Try again!</p>
                    )}
                  </div>
                )}
              </div>

              <div className="casino-border-inner bg-[#0a0505] p-3">
                <p className="font-pixel text-gray-500 text-[10px] mb-2">SELECT BET</p>
                <div className="flex gap-2">
                  {BET_OPTIONS.map((bet) => (
                    <button
                      key={bet}
                      onClick={() => setSelectedBet(bet)}
                      disabled={isSpinning}
                      className={`flex-1 py-2 font-pixel text-[10px] ${
                        selectedBet === bet
                          ? "casino-button casino-button-gold"
                          : "casino-button text-white"
                      }`}
                    >
                      {bet} SOL
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={spinSlots}
                disabled={isSpinning || slotCredits < selectedBet}
                className={`w-full py-4 casino-button font-pixel text-lg ${isSpinning ? "" : "casino-button-gold"}`}
              >
                {isSpinning ? "SPINNING..." : "PULL LEVER"}
              </button>

              <div className="casino-border-inner parchment-bg overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-600/30 via-yellow-500/20 to-yellow-600/30 px-3 py-1.5 border-b border-yellow-600/30">
                  <p className="font-pixel text-yellow-400 text-[10px] glow-gold">PAYOUTS</p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-1 font-pixel text-[9px]">
                  {SLOT_PAYOUTS.slice(0, 6).map((payout) => (
                    <div key={payout.name} className="flex justify-between text-gray-500">
                      <span>
                        {payout.combo
                          .map((s) => (s === "*" ? "?" : s.charAt(0).toUpperCase()))
                          .join("-")}
                      </span>
                      <span className="text-yellow-400">x{payout.multiplier}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="casino-border-inner bg-yellow-500/10 p-3">
                <p className="font-pixel text-yellow-400 text-[10px] text-center flex items-center justify-center gap-2">
                  <PixelStar /> DEMO MODE - Play with virtual credits <PixelStar />
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative shrink-0">
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#dc2626] via-[#fbbf24] to-[#dc2626]">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]" />
          </div>
          <div className="px-4 py-2 flex items-center justify-between bg-gradient-to-b from-[#1a0a0a] to-[#0a0505]">
            <span className="font-pixel text-[#7f1d1d] text-[10px] flex items-center gap-1">
              <PixelStar /> Funded by BagsWorld
            </span>
            <a
              href="https://x.com/BagsWorldApp"
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-[10px] casino-button px-2 py-1 text-white follow-pulse"
            >
              FOLLOW
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
