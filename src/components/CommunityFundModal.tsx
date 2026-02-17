"use client";

import { useState, useEffect, useCallback } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

interface CommunityFundModalProps {
  onClose: () => void;
}

interface WalletInfo {
  balance: number;
  isLoading: boolean;
  error: string | null;
}

interface FeeData {
  ghostTotalClaimedSol: number;
  communityContributionSol: number;
  contributionPercentage: number;
  tokenLifetimeFeesSol: number;
  recentClaims: Array<{
    amount: number;
    timestamp: number;
    signature: string;
  }>;
  lastUpdated: string;
}

interface RaffleData {
  raffles: Array<{
    id: number;
    prizeSol: number;
    entryCount: number;
    winnerWallet: string | null;
    drawnAt: string | null;
  }>;
  totalGivenAwaySol: number;
  totalRaffles: number;
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

/** Animated counting number */
function AnimatedNumber({ value, decimals = 4 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const duration = 1200;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, value);
      // Ease out — slow down near the end
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}

/** Animated bar that grows from 0 to target width */
function AnimatedBar({
  percentage,
  color,
  delay: animDelay = 0,
}: {
  percentage: number;
  color: string;
  delay?: number;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(percentage), animDelay);
    return () => clearTimeout(timer);
  }, [percentage, animDelay]);

  return (
    <div
      className={`h-full ${color} transition-all duration-1000 ease-out`}
      style={{ width: `${width}%` }}
    />
  );
}

/** Pixel-art SOL coin SVG */
function PixelCoin({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <rect x="4" y="1" width="8" height="1" fill="#d4a017" />
      <rect x="3" y="2" width="10" height="1" fill="#f5d442" />
      <rect x="2" y="3" width="12" height="1" fill="#f5d442" />
      <rect x="2" y="4" width="12" height="8" fill="#fde68a" />
      <rect x="3" y="12" width="10" height="1" fill="#f5d442" />
      <rect x="4" y="13" width="8" height="1" fill="#d4a017" />
      <rect x="6" y="5" width="4" height="1" fill="#d4a017" />
      <rect x="5" y="6" width="2" height="1" fill="#d4a017" />
      <rect x="6" y="7" width="4" height="1" fill="#d4a017" />
      <rect x="9" y="8" width="2" height="1" fill="#d4a017" />
      <rect x="6" y="9" width="4" height="1" fill="#d4a017" />
    </svg>
  );
}

export function CommunityFundModal({ onClose }: CommunityFundModalProps) {
  const [activeTab, setActiveTab] = useState<"fund" | "fees">("fund");
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    balance: 0,
    isLoading: true,
    error: null,
  });
  const [feeData, setFeeData] = useState<FeeData | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [raffleData, setRaffleData] = useState<RaffleData | null>(null);
  const [showContent, setShowContent] = useState(false);

  const walletAddress = ECOSYSTEM_CONFIG.ecosystem.wallet;
  const solscanUrl = `https://solscan.io/account/${walletAddress}`;

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana";
        const connection = new Connection(rpcUrl, "confirmed");
        const pubkey = new PublicKey(walletAddress);
        const balance = await connection.getBalance(pubkey);
        setWalletInfo({
          balance: balance / LAMPORTS_PER_SOL,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error("Error fetching wallet balance:", err);
        setWalletInfo({
          balance: 0,
          isLoading: false,
          error: "Failed to load balance",
        });
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Lazy-load fee data + raffle data when fees tab is selected
  const fetchFeeData = useCallback(async () => {
    setFeeLoading(true);
    setFeeError(null);
    try {
      const [feeRes, raffleRes] = await Promise.all([
        fetch("/api/community-fund"),
        fetch("/api/community-fund/raffles"),
      ]);
      if (!feeRes.ok) throw new Error("Failed to fetch fee data");
      const fee: FeeData = await feeRes.json();
      setFeeData(fee);

      if (raffleRes.ok) {
        const raffle: RaffleData = await raffleRes.json();
        if (!raffle.raffles) raffle.raffles = [];
        setRaffleData(raffle);
      }
    } catch (err) {
      console.error("Error fetching fee data:", err);
      setFeeError("Failed to load fee data");
    } finally {
      setFeeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "fees" && !feeData && !feeLoading && !feeError) {
      fetchFeeData();
    }
  }, [activeTab, feeData, feeLoading, feeError, fetchFeeData]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (timestamp: number | string) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const ghostKeeps = feeData ? feeData.ghostTotalClaimedSol - feeData.communityContributionSol : 0;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-bags-dark border-2 border-bags-green rounded-t-xl sm:rounded-lg max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto transition-all duration-300 ${
          showContent ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-3 sm:p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black/20 border border-green-300/50 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🏛️</span>
            </div>
            <div>
              <h2 className="font-pixel text-white text-xs sm:text-sm">COMMUNITY FUND</h2>
              <p className="font-pixel text-green-200 text-[7px] sm:text-[8px]">
                Funded by Ghost&apos;s 5% contribution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs text-white hover:text-green-200 p-2 touch-target border border-green-300/30 hover:border-green-300/60 rounded"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b-2 border-bags-green/30 bg-bags-darker">
          <button
            onClick={() => setActiveTab("fund")}
            className={`flex-1 font-pixel text-[10px] sm:text-xs py-2.5 px-3 transition-colors border-b-2 ${
              activeTab === "fund"
                ? "text-bags-green border-bags-green bg-bags-green/10"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            FUND
          </button>
          <button
            onClick={() => setActiveTab("fees")}
            className={`flex-1 font-pixel text-[10px] sm:text-xs py-2.5 px-3 transition-colors border-b-2 ${
              activeTab === "fees"
                ? "text-bags-green border-bags-green bg-bags-green/10"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            FEES
          </button>
        </div>

        {/* Fund Tab Content */}
        {activeTab === "fund" && (
          <div className="p-4 space-y-4">
            {/* Wallet Balance Display */}
            <div className="bg-gradient-to-br from-bags-darker to-black rounded-lg p-4 border border-bags-gold/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-pixel text-bags-gold text-xs">Community Wallet</h3>
                <a
                  href={solscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-pixel text-[8px] text-gray-500 hover:text-bags-green transition-colors flex items-center gap-1"
                >
                  Solscan
                  <svg
                    className="w-2.5 h-2.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>

              {/* Balance Display */}
              <div className="bg-black/50 rounded-lg p-4 text-center mb-3">
                {walletInfo.isLoading ? (
                  <div className="font-pixel text-gray-400 text-sm animate-pulse">Loading...</div>
                ) : walletInfo.error ? (
                  <div className="font-pixel text-red-400 text-[10px]">{walletInfo.error}</div>
                ) : (
                  <>
                    <div className="font-pixel text-4xl text-bags-green mb-1">
                      {walletInfo.balance.toFixed(4)}
                    </div>
                    <div className="font-pixel text-gray-500 text-[10px]">SOL Balance</div>
                  </>
                )}
              </div>

              {/* Wallet Address */}
              <div className="bg-black/30 rounded p-2">
                <p className="font-mono text-[8px] text-gray-500 break-all text-center">
                  {walletAddress}
                </p>
              </div>
            </div>

            {/* Main Message */}
            <div className="bg-bags-darker rounded-lg p-4 border border-bags-green/30 text-center">
              <div className="text-3xl mb-2">👻</div>
              <h3 className="font-pixel text-bags-green text-[11px] mb-2">
                Ghost&apos;s Contribution
              </h3>
              <p className="font-pixel text-gray-300 text-[9px] leading-relaxed">
                Ghost (@DaddyGhost) personally contributes{" "}
                <span className="text-bags-gold">5% of his $BagsWorld token revenue</span> to fund
                community features and development.
              </p>
            </div>

            {/* Key Points */}
            <div className="bg-bags-darker rounded-lg p-4 border border-blue-500/30">
              <h3 className="font-pixel text-blue-400 text-xs mb-3">How It Works</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-base">💰</span>
                  <div>
                    <p className="font-pixel text-white text-[9px]">Zero Creator Fees</p>
                    <p className="font-pixel text-gray-500 text-[7px]">
                      Creators pay NO extra BagsWorld fees on token launches
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base">🎰</span>
                  <div>
                    <p className="font-pixel text-white text-[9px]">Casino Funded</p>
                    <p className="font-pixel text-gray-500 text-[7px]">
                      Raffle prizes and games powered by the fund
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base">🛠️</span>
                  <div>
                    <p className="font-pixel text-white text-[9px]">Feature Development</p>
                    <p className="font-pixel text-gray-500 text-[7px]">
                      New zones, characters, and improvements
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base">🔍</span>
                  <div>
                    <p className="font-pixel text-white text-[9px]">100% Transparent</p>
                    <p className="font-pixel text-gray-500 text-[7px]">
                      All transactions verifiable on-chain
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* What It Funds */}
            <div className="bg-bags-darker rounded-lg p-3 border border-purple-500/30">
              <h3 className="font-pixel text-purple-400 text-xs mb-2">What It Funds</h3>
              <div className="grid grid-cols-3 gap-2">
                {ECOSYSTEM_CONFIG.ecosystem.founderContribution.fundedFeatures.map((feature, i) => (
                  <div key={i} className="bg-black/30 rounded p-2 text-center">
                    <span className="text-base">{i === 0 ? "🎰" : i === 1 ? "🎁" : "🚀"}</span>
                    <p className="font-pixel text-gray-300 text-[7px] mt-1">{feature}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparison */}
            <div className="border border-gray-700 rounded-lg p-3">
              <h3 className="font-pixel text-white text-[10px] mb-2">Why This Model?</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-red-500 text-xs">✗</span>
                  <span className="font-pixel text-gray-500 text-[7px] line-through">
                    Old: Mandatory ecosystem fees on every launch
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500 text-xs">✓</span>
                  <span className="font-pixel text-gray-300 text-[7px]">
                    New: Ghost funds it himself - creators keep 100%
                  </span>
                </div>
              </div>
            </div>

            {/* Follow Ghost */}
            <div className="text-center pt-1">
              <a
                href="https://x.com/DaddyGhost"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-pixel text-[9px] text-gray-400 hover:text-bags-green transition-colors"
              >
                <span>Follow @DaddyGhost for updates</span>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* Fees Tab Content */}
        {activeTab === "fees" && (
          <div className="p-4 space-y-4">
            {feeLoading && (
              <div className="bg-bags-darker rounded-lg p-8 border border-bags-green/30 text-center">
                <div className="flex justify-center gap-1 mb-3">
                  {[0, 1, 2].map((i) => (
                    <PixelCoin key={i} size={20} className="animate-bounce" />
                  ))}
                </div>
                <div className="font-pixel text-gray-400 text-[10px] animate-pulse">
                  Loading fee data...
                </div>
              </div>
            )}

            {feeError && (
              <div className="bg-bags-darker rounded-lg p-4 border border-red-500/30 text-center">
                <p className="font-pixel text-red-400 text-[10px] mb-3">{feeError}</p>
                <button
                  onClick={() => {
                    setFeeData(null);
                    setFeeError(null);
                    fetchFeeData();
                  }}
                  className="font-pixel text-[9px] text-bags-green border border-bags-green/50 rounded px-3 py-1.5 hover:bg-bags-green/10 transition-colors"
                >
                  RETRY
                </button>
              </div>
            )}

            {!feeLoading && !feeError && feeData && (
              <>
                {/* Hero Stats — Animated SOL counter with coin */}
                <div className="bg-gradient-to-br from-bags-darker via-black to-bags-darker rounded-lg p-5 border border-bags-green/40 relative overflow-hidden">
                  {/* Floating pixel coins background */}
                  <div className="absolute inset-0 pointer-events-none opacity-10">
                    {[...Array(6)].map((_, i) => (
                      <PixelCoin key={i} size={12} className="absolute animate-pulse" />
                    ))}
                  </div>

                  <div className="relative text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <PixelCoin size={20} />
                      <span className="font-pixel text-gray-400 text-[9px]">
                        Ghost&apos;s Total Claimed
                      </span>
                      <PixelCoin size={20} />
                    </div>
                    <div className="font-pixel text-4xl sm:text-5xl text-bags-green drop-shadow-[0_0_12px_rgba(34,197,94,0.4)]">
                      <AnimatedNumber value={feeData.ghostTotalClaimedSol} />
                    </div>
                    <div className="font-pixel text-gray-500 text-[10px] mt-1">
                      SOL from $BagsWorld fees
                    </div>
                  </div>
                </div>

                {/* Animated Revenue Split Bars */}
                <div className="bg-bags-darker rounded-lg p-4 border border-bags-green/30 space-y-3">
                  <h3 className="font-pixel text-white text-[10px] flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-bags-green rounded-full animate-pulse" />
                    Revenue Split
                  </h3>

                  {/* Ghost keeps */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-pixel text-[8px] text-green-400">
                        Ghost keeps: <AnimatedNumber value={ghostKeeps} /> SOL
                      </span>
                      <span className="font-pixel text-[8px] text-gray-500">95%</span>
                    </div>
                    <div className="h-5 bg-black/60 rounded-sm border border-gray-700 overflow-hidden relative">
                      <AnimatedBar
                        percentage={95}
                        color="bg-gradient-to-r from-green-600 to-green-400"
                        delay={300}
                      />
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,rgba(0,0,0,0.15)_3px,rgba(0,0,0,0.15)_4px)]" />
                    </div>
                  </div>

                  {/* Community fund */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-pixel text-[8px] text-yellow-400">
                        Community Fund: <AnimatedNumber value={feeData.communityContributionSol} />{" "}
                        SOL
                      </span>
                      <span className="font-pixel text-[8px] text-gray-500">5%</span>
                    </div>
                    <div className="h-5 bg-black/60 rounded-sm border border-gray-700 overflow-hidden relative">
                      <AnimatedBar
                        percentage={100}
                        color="bg-gradient-to-r from-yellow-600 to-yellow-400"
                        delay={600}
                      />
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,rgba(0,0,0,0.15)_3px,rgba(0,0,0,0.15)_4px)]" />
                    </div>
                  </div>
                </div>

                {/* Animated Pixel Flow — coins flowing from Ghost to Community */}
                <div className="bg-bags-darker rounded-lg p-4 border border-bags-green/30">
                  <h3 className="font-pixel text-white text-[10px] mb-3 text-center">
                    How the 5% flows
                  </h3>
                  <div className="flex items-center justify-between gap-2 px-2">
                    {/* Ghost */}
                    <div className="text-center flex-shrink-0">
                      <div className="text-2xl mb-1">👻</div>
                      <div className="font-pixel text-[7px] text-green-400">Ghost</div>
                      <div className="font-pixel text-[7px] text-gray-500">claims fees</div>
                    </div>

                    {/* Animated flow arrow */}
                    <div className="flex-1 flex items-center justify-center gap-[2px] overflow-hidden relative h-8">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-yellow-500/80 rounded-[1px] animate-pulse flex-shrink-0"
                          style={{
                            animationDelay: `${i * 150}ms`,
                            animationDuration: "1.2s",
                          }}
                        />
                      ))}
                    </div>

                    {/* Arrow */}
                    <div className="font-pixel text-yellow-500 text-xs flex-shrink-0">5%</div>

                    {/* Animated flow arrow */}
                    <div className="flex-1 flex items-center justify-center gap-[2px] overflow-hidden relative h-8">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-yellow-500/80 rounded-[1px] animate-pulse flex-shrink-0"
                          style={{
                            animationDelay: `${i * 150 + 600}ms`,
                            animationDuration: "1.2s",
                          }}
                        />
                      ))}
                    </div>

                    {/* Community */}
                    <div className="text-center flex-shrink-0">
                      <div className="text-2xl mb-1">🏛️</div>
                      <div className="font-pixel text-[7px] text-yellow-400">Community</div>
                      <div className="font-pixel text-[7px] text-gray-500">fund</div>
                    </div>
                  </div>
                </div>

                {/* Raffle Giveaways — The Proof */}
                {raffleData && raffleData.totalRaffles > 0 && (
                  <div className="bg-gradient-to-br from-purple-900/30 to-bags-darker rounded-lg p-4 border border-purple-500/40">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-pixel text-purple-400 text-xs flex items-center gap-2">
                        <span className="animate-bounce inline-block">🎰</span>
                        Raffle Giveaways
                      </h3>
                      <div className="bg-purple-500/20 border border-purple-500/30 rounded px-2 py-0.5">
                        <span className="font-pixel text-purple-300 text-[9px]">
                          {raffleData.totalRaffles} drawn
                        </span>
                      </div>
                    </div>

                    {/* Total given away hero */}
                    <div className="bg-black/40 rounded-lg p-3 mb-3 text-center border border-purple-500/20">
                      <div className="font-pixel text-[8px] text-gray-400 mb-1">
                        Total Given Away
                      </div>
                      <div className="font-pixel text-2xl text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                        <AnimatedNumber value={raffleData.totalGivenAwaySol} /> SOL
                      </div>
                    </div>

                    {/* Raffle history list */}
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                      {raffleData.raffles.map((raffle, i) => (
                        <div
                          key={raffle.id}
                          className="flex items-center gap-2 bg-black/30 rounded p-2 border border-purple-500/10 hover:border-purple-500/30 transition-colors"
                          style={{
                            animationDelay: `${i * 100}ms`,
                          }}
                        >
                          <div className="flex-shrink-0">
                            <PixelCoin size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-pixel text-purple-300 text-[10px]">
                                {raffle.prizeSol.toFixed(4)} SOL
                              </span>
                              <span className="font-pixel text-gray-600 text-[7px]">
                                Raffle #{raffle.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {raffle.winnerWallet && (
                                <span className="font-pixel text-green-500 text-[7px]">
                                  Winner: {truncateWallet(raffle.winnerWallet)}
                                </span>
                              )}
                              <span className="font-pixel text-gray-600 text-[7px]">
                                {raffle.entryCount} entries
                              </span>
                            </div>
                          </div>
                          {raffle.drawnAt && (
                            <span className="font-pixel text-gray-600 text-[7px] flex-shrink-0">
                              {formatDate(raffle.drawnAt)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Fee Claims */}
                {feeData.recentClaims.length > 0 && (
                  <div className="bg-bags-darker rounded-lg p-4 border border-blue-500/30">
                    <h3 className="font-pixel text-blue-400 text-xs mb-3">Recent Fee Claims</h3>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {feeData.recentClaims.map((claim, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-black/30 rounded p-2"
                        >
                          <div className="flex items-center gap-2">
                            <PixelCoin size={12} />
                            <span className="font-pixel text-bags-green text-[10px]">
                              {claim.amount.toFixed(4)} SOL
                            </span>
                            <span className="font-pixel text-gray-600 text-[8px]">
                              {formatDate(claim.timestamp)}
                            </span>
                          </div>
                          <a
                            href={`https://solscan.io/tx/${claim.signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-pixel text-[7px] text-gray-500 hover:text-bags-green transition-colors"
                          >
                            TX
                            <svg
                              className="w-2 h-2 inline ml-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Token Lifetime Context */}
                {feeData.tokenLifetimeFeesSol > 0 && (
                  <div className="bg-black/30 rounded-lg p-3 border border-gray-700 flex items-center justify-between">
                    <span className="font-pixel text-gray-500 text-[8px]">
                      $BagsWorld Lifetime Fees
                    </span>
                    <span className="font-pixel text-bags-gold text-[10px]">
                      <AnimatedNumber value={feeData.tokenLifetimeFeesSol} /> SOL
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Zero-state */}
            {!feeLoading &&
              !feeError &&
              feeData &&
              feeData.ghostTotalClaimedSol === 0 &&
              feeData.recentClaims.length === 0 && (
                <div className="bg-bags-darker rounded-lg p-4 border border-gray-700 text-center">
                  <div className="text-2xl mb-2">👻</div>
                  <p className="font-pixel text-gray-400 text-[9px]">
                    No fee claims recorded yet. Check back soon!
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
