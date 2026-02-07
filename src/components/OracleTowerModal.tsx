"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import bs58 from "bs58";
import { OracleMarketsTab } from "./oracle/OracleMarketsTab";
import { OracleMyBetsTab } from "./oracle/OracleMyBetsTab";
import { OracleTournamentsTab } from "./oracle/OracleTournamentsTab";
import { OracleProfileTab } from "./oracle/OracleProfileTab";

interface OracleTowerModalProps {
  onClose: () => void;
}

interface OracleBalance {
  balance: { lamports: string; sol: number };
  totalEarned: { lamports: string; sol: number };
  totalClaimed: { lamports: string; sol: number };
  pendingClaim?: {
    id: number;
    amountSol: number;
    status: string;
    createdAt: string;
  };
}

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  walletShort: string;
  wins: number;
  totalPredictions: number;
  winRate: number;
}

interface TokenGateError {
  required: number;
  balance: number;
  symbol: string;
  buyUrl: string;
  message: string;
}

type OracleView = "markets" | "my_bets" | "tournaments" | "leaders" | "profile" | "admin";

/* eslint-disable */
type MarketData = any;
type ProfileData = any;
type LedgerEntry = any;
type ActiveBet = any;
type RecentResult = any;
type TournamentData = any;
type TournamentLeaderboardEntry = any;
/* eslint-enable */

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Pixel art corner flourish SVG
function PixelCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const rotation = {
    tl: "rotate(0)",
    tr: "rotate(90deg)",
    br: "rotate(180deg)",
    bl: "rotate(270deg)",
  }[position];

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className="absolute"
      style={{
        transform: rotation,
        top: position.includes("t") ? "-2px" : "auto",
        bottom: position.includes("b") ? "-2px" : "auto",
        left: position.includes("l") ? "-2px" : "auto",
        right: position.includes("r") ? "-2px" : "auto",
      }}
    >
      <rect x="0" y="0" width="4" height="4" fill="#a855f7" />
      <rect x="4" y="0" width="4" height="4" fill="#7c3aed" />
      <rect x="0" y="4" width="4" height="4" fill="#7c3aed" />
      <rect x="8" y="0" width="4" height="4" fill="#6b21a8" />
      <rect x="0" y="8" width="4" height="4" fill="#6b21a8" />
    </svg>
  );
}

// Animated crystal ball for empty states
function CrystalBall() {
  return (
    <div className="relative w-16 h-16 mx-auto">
      <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-pulse" />
      <svg viewBox="0 0 32 32" className="w-full h-full animate-[float_3s_ease-in-out_infinite]">
        <rect x="10" y="26" width="12" height="2" fill="#4a4a4a" />
        <rect x="12" y="24" width="8" height="2" fill="#5a5a5a" />
        <rect x="13" y="22" width="6" height="2" fill="#6a6a6a" />
        <rect x="8" y="6" width="16" height="2" fill="#6b21a8" />
        <rect x="6" y="8" width="2" height="2" fill="#6b21a8" />
        <rect x="24" y="8" width="2" height="2" fill="#6b21a8" />
        <rect x="4" y="10" width="2" height="8" fill="#6b21a8" />
        <rect x="26" y="10" width="2" height="8" fill="#6b21a8" />
        <rect x="6" y="18" width="2" height="2" fill="#6b21a8" />
        <rect x="24" y="18" width="2" height="2" fill="#6b21a8" />
        <rect x="8" y="20" width="16" height="2" fill="#6b21a8" />
        <rect x="8" y="8" width="16" height="12" fill="#1a1a2e" />
        <rect x="10" y="10" width="4" height="2" fill="#a855f7" className="animate-pulse" />
        <rect x="10" y="12" width="2" height="2" fill="#7c3aed" className="animate-pulse" />
        <rect x="14" y="12" width="4" height="4" fill="#a855f7" className="animate-pulse" />
        <rect x="15" y="13" width="2" height="2" fill="#fff" />
      </svg>
      <div className="absolute top-1 right-2 w-1 h-1 bg-purple-300 animate-[twinkle_1.5s_ease-in-out_infinite]" />
      <div className="absolute top-3 left-2 w-1 h-1 bg-purple-400 animate-[twinkle_2s_ease-in-out_infinite_0.5s]" />
      <div className="absolute bottom-6 right-3 w-1 h-1 bg-purple-200 animate-[twinkle_1.8s_ease-in-out_infinite_0.3s]" />
    </div>
  );
}

export function OracleTowerModal({ onClose }: OracleTowerModalProps) {
  const [view, setView] = useState<OracleView>("markets");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tokenGateError, setTokenGateError] = useState<TokenGateError | null>(null);

  // Admin state
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [prizePoolInput, setPrizePoolInput] = useState("0.5");

  // SOL balance and claiming state (legacy)
  const [balance, setBalance] = useState<OracleBalance | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Markets tab state
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [opBalance, setOpBalance] = useState(0);

  // My Bets tab state
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);

  // Tournaments tab state
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [activeTournament, setActiveTournament] = useState<TournamentData | null>(null);
  const [tournamentLeaderboard, setTournamentLeaderboard] = useState<TournamentLeaderboardEntry[]>(
    []
  );
  const [isJoiningTournament, setIsJoiningTournament] = useState(false);
  const [hasJoinedTournament, setHasJoinedTournament] = useState(false);

  // Leaderboard tab state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<{ wins: number; rank: number } | null>(null);

  // Profile tab state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);

  // Admin active round info (for settle display)
  const [adminRoundInfo, setAdminRoundInfo] = useState<{
    id: number;
    entryCount: number;
    tokenCount: number;
    countdown: number;
    status: string;
  } | null>(null);

  const { publicKey, connected, signMessage } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { isAdmin } = useAdminCheck();

  // ─── Fetch Functions ────────────────────────────────────────────

  const fetchMarkets = useCallback(async () => {
    try {
      const walletParam = publicKey ? `?wallet=${publicKey.toString()}` : "";
      const res = await fetch(`/api/oracle/markets${walletParam}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setMarkets(data.markets || []);
      }
    } catch (error) {
      console.error("[Oracle] Error fetching markets:", error);
    }
  }, [publicKey]);

  const fetchProfile = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/oracle/profile?wallet=${publicKey.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        setLedger(data.ledger || []);
        setOpBalance(data.profile.opBalance || 0);
      }
    } catch (error) {
      console.error("[Oracle] Error fetching profile:", error);
    }
  }, [publicKey]);

  const fetchMyBets = useCallback(async () => {
    if (!publicKey) return;
    try {
      // Derive active bets from already-fetched markets state (no duplicate API call)
      const bets: ActiveBet[] = markets
        .filter((m: MarketData) => m.userPrediction)
        .map((m: MarketData) => ({
          prediction: {
            tokenMint: m.userPrediction.tokenMint,
            outcomeId: m.userPrediction.outcomeId,
            opWagered: m.userPrediction.opWagered || 0,
            createdAt: m.userPrediction.createdAt || m.startTime,
          },
          round: {
            id: m.id,
            endTime: m.endTime,
            marketType: m.marketType,
            question: m.question,
            tokenOptions: m.tokenOptions,
            marketConfig: { outcomes: m.outcomes },
          },
        }));
      setActiveBets(bets);

      // Fetch history (only this needs an API call)
      const walletParam = `?wallet=${publicKey.toString()}&limit=20`;
      const historyRes = await fetch(`/api/oracle/history${walletParam}`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const rounds = historyData.rounds || [];
        const results: RecentResult[] = rounds
          .filter((r: MarketData) => r.userPrediction)
          .map((r: MarketData) => ({
            prediction: {
              tokenMint: r.userPrediction.tokenMint,
              outcomeId: r.userPrediction.outcomeId,
              opWagered: r.userPrediction.opWagered || 0,
              opPayout: r.userPrediction.opPayout || 0,
              isWinner: r.userPrediction.isWinner,
              rank: r.userPrediction.rank,
            },
            round: {
              id: r.id,
              endTime: r.endTime,
              marketType: r.marketType || "price_prediction",
              question: r.marketConfig?.question,
              tokenOptions: r.tokenOptions,
              marketConfig: { outcomes: r.marketConfig?.outcomes },
              winningTokenMint: r.winningTokenMint,
              winningOutcomeId: r.winningOutcomeId,
            },
          }));
        setRecentResults(results);
      }
    } catch (error) {
      console.error("[Oracle] Error fetching my bets:", error);
    }
  }, [publicKey, markets]);

  const fetchTournaments = useCallback(async () => {
    try {
      const res = await fetch("/api/oracle/tournaments");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const allTournaments = data.tournaments || [];
        setTournaments(allTournaments);

        // Find active tournament and fetch its leaderboard
        const active = allTournaments.find((t: TournamentData) => t.status === "active");
        if (active) {
          setActiveTournament(active);
          const lbRes = await fetch(`/api/oracle/tournaments?id=${active.id}`);
          if (lbRes.ok) {
            const lbData = await lbRes.json();
            if (lbData.success) {
              setTournamentLeaderboard(lbData.leaderboard || []);
              // Check if user has joined
              if (publicKey) {
                const userEntry = (lbData.leaderboard || []).find(
                  (e: TournamentLeaderboardEntry) => e.wallet === publicKey.toString()
                );
                setHasJoinedTournament(!!userEntry);
              }
            }
          }
        } else {
          setActiveTournament(null);
          setTournamentLeaderboard([]);
        }
      }
    } catch (error) {
      console.error("[Oracle] Error fetching tournaments:", error);
    }
  }, [publicKey]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const walletParam = publicKey ? `?wallet=${publicKey.toString()}&limit=10` : "?limit=10";
      const res = await fetch(`/api/oracle/leaderboard${walletParam}`);
      if (!res.ok) return;
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
      if (data.userStats) {
        setUserStats({ wins: data.userStats.wins, rank: data.userStats.rank });
      }
    } catch (error) {
      console.error("[Oracle] Error fetching leaderboard:", error);
      setLeaderboard([]);
    }
  }, [publicKey]);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/oracle/balance?wallet=${publicKey.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setBalance(data);
    } catch (error) {
      console.error("[Oracle] Error fetching balance:", error);
    }
  }, [publicKey]);

  const fetchAdminRoundInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/oracle/current`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "active") {
        setAdminRoundInfo({
          id: data.id,
          entryCount: data.entryCount || 0,
          tokenCount: data.tokenOptions?.length || 0,
          countdown: data.remainingMs || 0,
          status: data.status,
        });
      } else {
        setAdminRoundInfo(null);
      }
    } catch (error) {
      console.error("[Oracle] Error fetching admin round:", error);
    }
  }, []);

  // ─── Initial Load & Tab-Based Fetching ─────────────────────────

  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      await fetchMarkets();
      if (publicKey) {
        await fetchProfile();
        await fetchBalance();
      }
      setIsLoading(false);
    };
    loadInitial();
  }, [fetchMarkets, fetchProfile, fetchBalance, publicKey]);

  useEffect(() => {
    if (view === "my_bets") fetchMyBets();
    if (view === "tournaments") fetchTournaments();
    if (view === "leaders") fetchLeaderboard();
    if (view === "profile" && publicKey) fetchProfile();
    if (view === "admin") fetchAdminRoundInfo();
  }, [
    view,
    fetchMyBets,
    fetchTournaments,
    fetchLeaderboard,
    fetchProfile,
    fetchAdminRoundInfo,
    publicKey,
  ]);

  // Auto-refresh markets every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarkets();
      if (view === "admin") fetchAdminRoundInfo();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMarkets, fetchAdminRoundInfo, view]);

  // Countdown timer for admin round info
  useEffect(() => {
    if (!adminRoundInfo || adminRoundInfo.countdown <= 0) return;
    const timer = setInterval(() => {
      setAdminRoundInfo((prev) =>
        prev ? { ...prev, countdown: Math.max(0, prev.countdown - 1000) } : null
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [adminRoundInfo]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handlePredict = async (roundId: number, tokenMint: string, outcomeId?: string) => {
    if (!publicKey || isSubmitting) return;
    setIsSubmitting(true);
    setMessage(null);
    setTokenGateError(null);

    try {
      const res = await fetch("/api/oracle/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          roundId,
          tokenMint: tokenMint || undefined,
          outcomeId: outcomeId || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage("Prediction submitted!");
        setOpBalance(data.newOpBalance || opBalance);
        await fetchMarkets();
        if (view === "my_bets") await fetchMyBets();
      } else if (data.tokenGate) {
        setTokenGateError(data.tokenGate);
      } else {
        setMessage(data.error || "Failed to submit");
      }
    } catch {
      setMessage("Network error");
    }
    setIsSubmitting(false);
  };

  const handleClaimDaily = async () => {
    if (!publicKey || isClaimingDaily) return;
    setIsClaimingDaily(true);
    try {
      const res = await fetch("/api/oracle/claim-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toString() }),
      });
      const data = await res.json();
      if (data.success) {
        setOpBalance(data.newBalance || opBalance + (data.amount || 50));
        await fetchProfile();
      }
    } catch (error) {
      console.error("[Oracle] Error claiming daily:", error);
    }
    setIsClaimingDaily(false);
  };

  const handleJoinTournament = async (tournamentId: number) => {
    if (!publicKey || isJoiningTournament) return;
    setIsJoiningTournament(true);
    try {
      const res = await fetch("/api/oracle/tournaments/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toString(), tournamentId }),
      });
      const data = await res.json();
      if (data.success) {
        setHasJoinedTournament(true);
        await fetchTournaments();
      } else {
        setMessage(data.error || "Failed to join tournament");
      }
    } catch {
      setMessage("Network error");
    }
    setIsJoiningTournament(false);
  };

  const handleConnectWallet = () => setWalletModalVisible(true);

  // Admin handlers
  const handleCreateRound = async () => {
    if (!publicKey || isCreatingRound) return;
    setIsCreatingRound(true);
    const prizePoolSol = parseFloat(prizePoolInput) || 0;
    const res = await fetch("/api/oracle/admin/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminWallet: publicKey.toString(),
        durationHours: 24,
        prizePoolSol,
      }),
    });
    const data = await res.json();
    setMessage(data.success ? `Round created! Prize: ${prizePoolSol} SOL` : data.error || "Failed");
    if (data.success) {
      await fetchMarkets();
      await fetchAdminRoundInfo();
    }
    setIsCreatingRound(false);
  };

  const handleSettleRound = async () => {
    if (!publicKey || isSettling) return;
    setIsSettling(true);
    const res = await fetch("/api/oracle/admin/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminWallet: publicKey.toString() }),
    });
    const data = await res.json();
    const prizeInfo = data.prizePool?.sol > 0 ? ` (${data.prizePool.sol} SOL distributed)` : "";
    setMessage(
      data.success ? `Winner: ${data.winner?.symbol}${prizeInfo}` : data.error || "Failed"
    );
    if (data.success) {
      await fetchMarkets();
      await fetchBalance();
      await fetchAdminRoundInfo();
    }
    setIsSettling(false);
  };

  const handleClaimSOL = async () => {
    if (!publicKey || !signMessage || isClaiming) return;
    if (!balance || balance.balance.sol <= 0) {
      setMessage("No balance to claim");
      return;
    }

    setIsClaiming(true);
    setMessage(null);

    const claimMessage = "Sign to claim your Oracle winnings from BagsWorld";
    const messageBytes = new TextEncoder().encode(claimMessage);

    let signature: string;
    try {
      const signatureBytes = await signMessage(messageBytes);
      signature = bs58.encode(signatureBytes);
    } catch {
      setMessage("Failed to sign claim request");
      setIsClaiming(false);
      return;
    }

    const res = await fetch("/api/oracle/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: publicKey.toString(), signature }),
    });

    const data = await res.json();
    if (data.success) {
      setMessage(`Claim submitted! ${data.amount.sol} SOL processing...`);
      await fetchBalance();
    } else {
      setMessage(data.error || "Failed to submit claim");
    }
    setIsClaiming(false);
  };

  // ─── Tab Configuration ─────────────────────────────────────────

  const tabConfig: Array<{ key: OracleView; label: string; show: boolean }> = [
    { key: "markets", label: "MARKETS", show: true },
    { key: "my_bets", label: "BETS", show: true },
    { key: "tournaments", label: "TOURNEYS", show: true },
    { key: "leaders", label: "LEADERS", show: true },
    { key: "profile", label: "PROFILE", show: true },
    { key: "admin", label: "ADMIN", show: isAdmin },
  ];

  const visibleTabs = tabConfig.filter((t) => t.show);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes glow-pulse {
          0%,
          100% {
            box-shadow:
              0 0 8px rgba(168, 85, 247, 0.4),
              inset 0 0 8px rgba(168, 85, 247, 0.1);
          }
          50% {
            box-shadow:
              0 0 16px rgba(168, 85, 247, 0.6),
              inset 0 0 12px rgba(168, 85, 247, 0.2);
          }
        }
        .rpg-border {
          border: 4px solid #6b21a8;
          box-shadow:
            inset 0 0 0 2px #1a1a2e,
            inset 0 0 0 4px #4c1d95,
            0 0 20px rgba(139, 92, 246, 0.3);
        }
        .rpg-border-inner {
          border: 2px solid #4c1d95;
          box-shadow: inset 0 0 0 1px #2e1065;
        }
        .rpg-button {
          border: 3px solid;
          border-color: #a855f7 #4c1d95 #4c1d95 #a855f7;
          background: linear-gradient(180deg, #6b21a8 0%, #4c1d95 100%);
          box-shadow: 2px 2px 0 #1a1a2e;
          transition: all 0.1s;
        }
        .rpg-button:hover:not(:disabled) {
          border-color: #c084fc #6b21a8 #6b21a8 #c084fc;
          background: linear-gradient(180deg, #7c3aed 0%, #6b21a8 100%);
        }
        .rpg-button:active:not(:disabled),
        .rpg-button.active {
          border-color: #4c1d95 #a855f7 #a855f7 #4c1d95;
          background: linear-gradient(180deg, #4c1d95 0%, #3b0764 100%);
          box-shadow: inset 2px 2px 0 #1a1a2e;
          transform: translate(1px, 1px);
        }
        .rpg-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .scanlines {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.1) 0px,
            rgba(0, 0, 0, 0.1) 1px,
            transparent 1px,
            transparent 2px
          );
          z-index: 100;
        }
        .crt-curve {
          box-shadow:
            inset 0 0 60px rgba(0, 0, 0, 0.3),
            inset 0 0 20px rgba(139, 92, 246, 0.1);
        }
        .glow-text {
          text-shadow:
            0 0 8px rgba(168, 85, 247, 0.8),
            0 0 16px rgba(168, 85, 247, 0.4);
        }
        .glow-green {
          text-shadow:
            0 0 8px rgba(34, 197, 94, 0.8),
            0 0 16px rgba(34, 197, 94, 0.4);
        }
      `}</style>

      <div className="rpg-border bg-[#0d0d0d] w-full max-w-lg max-h-[95vh] flex flex-col relative crt-curve overflow-hidden">
        <div className="scanlines" />

        <PixelCorner position="tl" />
        <PixelCorner position="tr" />
        <PixelCorner position="bl" />
        <PixelCorner position="br" />

        {/* Header */}
        <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0d0d0d] px-4 py-3 flex items-center justify-between shrink-0 relative">
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#6b21a8] to-transparent" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rpg-border-inner bg-[#1a1a2e] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-purple-500/10 animate-pulse" />
              <svg viewBox="0 0 16 16" className="w-6 h-6">
                <rect x="4" y="2" width="8" height="1" fill="#a855f7" />
                <rect x="3" y="3" width="1" height="1" fill="#a855f7" />
                <rect x="12" y="3" width="1" height="1" fill="#a855f7" />
                <rect x="2" y="4" width="1" height="6" fill="#a855f7" />
                <rect x="13" y="4" width="1" height="6" fill="#a855f7" />
                <rect x="3" y="10" width="1" height="1" fill="#a855f7" />
                <rect x="12" y="10" width="1" height="1" fill="#a855f7" />
                <rect x="4" y="11" width="8" height="1" fill="#a855f7" />
                <rect x="3" y="3" width="10" height="8" fill="#1a1a2e" />
                <rect x="5" y="5" width="2" height="1" fill="#c084fc" />
                <rect x="5" y="6" width="1" height="1" fill="#a855f7" />
                <rect x="7" y="6" width="2" height="2" fill="#fff" className="animate-pulse" />
                <rect x="6" y="12" width="4" height="1" fill="#4a4a4a" />
                <rect x="5" y="13" width="6" height="1" fill="#3a3a3a" />
              </svg>
            </div>
            <div>
              <span className="font-pixel text-[#a855f7] text-sm block glow-text">
                ORACLE MARKET
              </span>
              <div className="flex items-center gap-2">
                {connected && opBalance > 0 && (
                  <span className="font-pixel text-[#a855f7] text-[10px]">
                    {opBalance.toLocaleString()} OP
                  </span>
                )}
                {markets.length > 0 && (
                  <span className="font-pixel text-[#22c55e] text-[10px] glow-green">
                    {markets.length} LIVE
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {markets.length > 0 && (
              <span className="font-pixel text-[10px] px-2 py-1 rpg-border-inner bg-[#166534]/30 text-[#22c55e] glow-green animate-pulse">
                LIVE
              </span>
            )}
            <button
              onClick={onClose}
              className="rpg-button font-pixel text-[#fff] text-[10px] px-2 py-1"
            >
              X
            </button>
          </div>
        </div>

        {/* SOL Balance Section - Show if user has claimable SOL balance */}
        {connected && balance && (balance.balance.sol > 0 || balance.pendingClaim) && (
          <div className="px-4 py-2 bg-[#0a0a0a] border-b border-[#2e1065] shrink-0">
            <div className="rpg-border-inner bg-[#1a1a2e] p-2 flex items-center justify-between">
              <div>
                <p className="font-pixel text-[#666] text-[8px]">SOL BALANCE</p>
                <p className="font-pixel text-[#fbbf24] text-sm glow-text">
                  {balance.balance.sol.toFixed(4)} SOL
                </p>
              </div>
              {balance.pendingClaim ? (
                <div className="text-right">
                  <span className="font-pixel text-[#666] text-[8px] block">CLAIM PENDING</span>
                  <span className="font-pixel text-[#fbbf24] text-[10px]">
                    {balance.pendingClaim.amountSol.toFixed(4)} SOL
                  </span>
                </div>
              ) : balance.balance.sol >= 0.001 ? (
                <button
                  onClick={handleClaimSOL}
                  disabled={isClaiming}
                  className="rpg-button font-pixel text-[10px] px-3 py-1 !bg-gradient-to-b !from-[#fbbf24] !to-[#b45309] text-black"
                >
                  {isClaiming ? "..." : "CLAIM SOL"}
                </button>
              ) : (
                <span className="font-pixel text-[#666] text-[8px]">Min: 0.001 SOL</span>
              )}
            </div>
          </div>
        )}

        {/* Tabs - RPG button style with scrollable tabs */}
        <div className="flex gap-1 px-2 py-2 bg-[#0a0a0a] shrink-0 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex-1 min-w-0 font-pixel text-[9px] py-2 px-1 rpg-button whitespace-nowrap ${
                view === tab.key ? "active" : ""
              } ${tab.key === "admin" ? "!bg-gradient-to-b !from-[#166534] !to-[#14532d]" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Decorative divider */}
        <div className="h-[4px] bg-gradient-to-r from-[#6b21a8] via-[#a855f7] to-[#6b21a8] relative">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 relative z-10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rpg-border-inner bg-[#1a1a2e] flex items-center justify-center animate-[glow-pulse_2s_ease-in-out_infinite]">
                <span className="font-pixel text-[#a855f7] text-lg animate-pulse">...</span>
              </div>
              <p className="font-pixel text-[#666] text-[10px] mt-3">CONSULTING THE ORACLE</p>
            </div>
          ) : view === "markets" ? (
            <>
              <OracleMarketsTab
                markets={markets}
                opBalance={opBalance}
                walletConnected={connected}
                onPredict={handlePredict}
                onConnectWallet={handleConnectWallet}
                isSubmitting={isSubmitting}
              />
              {message && (
                <p
                  className={`font-pixel text-xs text-center mt-2 ${
                    message.includes("submitted") || message.includes("success")
                      ? "text-[#22c55e] glow-green"
                      : "text-[#ef4444]"
                  }`}
                >
                  {message}
                </p>
              )}
              {tokenGateError && (
                <div className="rpg-border-inner bg-[#7f1d1d]/20 p-4 mt-3">
                  <p className="font-pixel text-[#ef4444] text-xs mb-2">TOKEN GATE</p>
                  <p className="font-pixel text-[#888] text-[10px] mb-3">
                    {tokenGateError.message}
                  </p>
                  <div className="rpg-border-inner bg-[#1a1a1a] p-2 mb-3">
                    <div className="flex justify-between font-pixel text-[10px]">
                      <span className="text-[#666]">Your Balance:</span>
                      <span className="text-white">{tokenGateError.balance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-pixel text-[10px]">
                      <span className="text-[#666]">Required:</span>
                      <span className="text-[#ef4444]">
                        {tokenGateError.required.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <a
                    href={tokenGateError.buyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full font-pixel text-xs py-2 text-center rpg-button"
                  >
                    BUY {tokenGateError.symbol}
                  </a>
                  <button
                    onClick={() => setTokenGateError(null)}
                    className="w-full mt-2 font-pixel text-[10px] text-[#666] hover:text-[#a855f7]"
                  >
                    [DISMISS]
                  </button>
                </div>
              )}
            </>
          ) : view === "my_bets" ? (
            connected ? (
              <OracleMyBetsTab activeBets={activeBets} recentResults={recentResults} />
            ) : (
              <div className="rpg-border-inner bg-[#1a1a1a] p-6 text-center">
                <p className="font-pixel text-[#a855f7] text-sm glow-text">CONNECT WALLET</p>
                <p className="font-pixel text-[#666] text-[10px] mt-2">
                  Connect your wallet to view your bets
                </p>
                <button
                  onClick={handleConnectWallet}
                  className="mt-4 font-pixel text-[10px] px-4 py-2 rpg-button glow-text"
                >
                  CONNECT
                </button>
              </div>
            )
          ) : view === "tournaments" ? (
            <OracleTournamentsTab
              tournaments={tournaments}
              activeTournament={activeTournament || undefined}
              leaderboard={tournamentLeaderboard}
              wallet={publicKey?.toString()}
              onJoin={handleJoinTournament}
              isJoining={isJoiningTournament}
              hasJoined={hasJoinedTournament}
            />
          ) : view === "leaders" ? (
            <div className="space-y-3">
              {userStats && (
                <div className="rpg-border-inner bg-[#6b21a8]/20 p-3 animate-[glow-pulse_2s_ease-in-out_infinite]">
                  <div className="flex justify-between items-center">
                    <span className="font-pixel text-[#a855f7] text-xs glow-text">YOUR RANK</span>
                    <span className="font-pixel text-white text-lg glow-text">
                      #{userStats.rank}
                    </span>
                  </div>
                  <p className="font-pixel text-[#666] text-[10px] mt-1">
                    {userStats.wins} win{userStats.wins !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              <div className="rpg-border-inner bg-[#1a1a1a]">
                <div className="border-b-2 border-[#4c1d95] px-3 py-2 bg-gradient-to-r from-[#1a1a2e] to-[#0d0d0d]">
                  <p className="font-pixel text-[#a855f7] text-[10px] glow-text">TOP ORACLES</p>
                </div>
                {leaderboard.length === 0 ? (
                  <div className="p-6 text-center">
                    <CrystalBall />
                    <p className="font-pixel text-[#666] text-xs mt-4">NO PREDICTIONS YET</p>
                    <p className="font-pixel text-[#444] text-[10px] mt-1">Be the first to win!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#2e1065]">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.wallet}
                        className={`flex items-center gap-3 p-3 ${entry.rank <= 3 ? "bg-[#1a1a2e]/50" : ""}`}
                      >
                        <div
                          className={`w-7 h-7 rpg-border-inner flex items-center justify-center font-pixel text-xs ${
                            entry.rank === 1
                              ? "bg-gradient-to-b from-[#fbbf24] to-[#b45309] text-black"
                              : entry.rank === 2
                                ? "bg-gradient-to-b from-[#9ca3af] to-[#6b7280] text-black"
                                : entry.rank === 3
                                  ? "bg-gradient-to-b from-[#cd7f32] to-[#92400e] text-black"
                                  : "bg-[#2a2a2a] text-[#666]"
                          }`}
                        >
                          {entry.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-pixel text-white text-xs">{entry.walletShort}</p>
                          <p className="font-pixel text-[#666] text-[10px]">
                            {entry.totalPredictions} predictions
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-pixel text-[#22c55e] text-sm glow-green">
                            {entry.wins}
                          </p>
                          <p className="font-pixel text-[#666] text-[10px]">{entry.winRate}% win</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={fetchLeaderboard}
                className="w-full font-pixel text-[10px] py-2 rpg-button"
              >
                REFRESH
              </button>
            </div>
          ) : view === "profile" ? (
            <OracleProfileTab
              profile={profile}
              ledger={ledger}
              onClaimDaily={handleClaimDaily}
              isClaiming={isClaimingDaily}
              walletConnected={connected}
              onConnectWallet={handleConnectWallet}
            />
          ) : view === "admin" ? (
            <div className="space-y-3">
              <div className="rpg-border-inner bg-[#166534]/10 p-4">
                <p className="font-pixel text-[#22c55e] text-xs mb-3 glow-green">ADMIN CONTROLS</p>

                {adminRoundInfo ? (
                  <div className="space-y-3">
                    <div className="rpg-border-inner bg-[#1a1a1a] p-3">
                      <div className="grid grid-cols-2 gap-2 font-pixel text-[10px]">
                        <div>
                          <span className="text-[#666]">Round</span>
                          <span className="text-white ml-2">#{adminRoundInfo.id}</span>
                        </div>
                        <div>
                          <span className="text-[#666]">Entries</span>
                          <span className="text-white ml-2">{adminRoundInfo.entryCount}</span>
                        </div>
                        <div>
                          <span className="text-[#666]">Time Left</span>
                          <span className="text-[#22c55e] ml-2 glow-green">
                            {formatTimeRemaining(adminRoundInfo.countdown)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#666]">Tokens</span>
                          <span className="text-white ml-2">{adminRoundInfo.tokenCount}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSettleRound}
                      disabled={isSettling}
                      className="w-full font-pixel text-xs py-3 rpg-button !bg-gradient-to-b !from-[#854d0e] !to-[#713f12]"
                    >
                      {isSettling ? "SETTLING..." : "SETTLE NOW"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rpg-border-inner bg-[#0d0d0d] p-3">
                      <label className="font-pixel text-[#fbbf24] text-[10px] block mb-2">
                        PRIZE POOL (SOL)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.1"
                          max="1.0"
                          step="0.1"
                          value={prizePoolInput}
                          onChange={(e) => setPrizePoolInput(e.target.value)}
                          className="flex-1 bg-[#1a1a1a] border-2 border-[#333] font-pixel text-white text-xs px-2 py-2 rounded focus:border-[#fbbf24] focus:outline-none"
                          placeholder="0.5"
                        />
                        <span className="font-pixel text-[#888] text-[10px]">Max: 1.0 SOL</span>
                      </div>
                      <p className="font-pixel text-[#666] text-[8px] mt-1">
                        Winners split this amount based on prediction order
                      </p>
                    </div>

                    <button
                      onClick={handleCreateRound}
                      disabled={isCreatingRound}
                      className="w-full font-pixel text-xs py-3 rpg-button !bg-gradient-to-b !from-[#166534] !to-[#14532d]"
                    >
                      {isCreatingRound ? "CREATING..." : "CREATE 24H ROUND"}
                    </button>
                  </div>
                )}

                {message && (
                  <p className="font-pixel text-[#fbbf24] text-xs text-center mt-2">{message}</p>
                )}
              </div>

              {/* Active Markets Overview */}
              <div className="rpg-border-inner bg-[#1a1a1a] p-3">
                <p className="font-pixel text-[#a855f7] text-[10px] mb-2 glow-text">
                  ACTIVE MARKETS ({markets.length})
                </p>
                {markets.length === 0 ? (
                  <p className="font-pixel text-[#666] text-[9px]">No active markets</p>
                ) : (
                  <div className="space-y-1">
                    {markets.map((m: MarketData) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between font-pixel text-[9px] p-1 rpg-border-inner bg-[#0d0d0d]"
                      >
                        <span className="text-white">
                          #{m.id} {m.marketType}
                        </span>
                        <span className="text-[#666]">{m.entryCount} entries</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rpg-border-inner bg-[#1a1a1a] p-3">
                <p className="font-pixel text-[#a855f7] text-[10px] mb-2 glow-text">ROUND FLOW</p>
                <div className="space-y-1 font-pixel text-[10px] text-[#888]">
                  <p>1. Create round - auto-fetches top tokens</p>
                  <p>2. Users predict for 22 hours</p>
                  <p>3. Entries close 2h before end</p>
                  <p>4. Settle - determine winner by % gain</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="relative shrink-0">
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#6b21a8] via-[#a855f7] to-[#6b21a8]">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]" />
          </div>
          <div className="px-4 py-2 flex items-center justify-between bg-gradient-to-b from-[#1a1a2e] to-[#0d0d0d]">
            <span className="font-pixel text-[#4c1d95] text-[10px]">Free OP | Predict & Earn</span>
            <button onClick={fetchMarkets} className="font-pixel text-[10px] rpg-button px-2 py-1">
              REFRESH
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
