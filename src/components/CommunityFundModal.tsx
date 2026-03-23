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
  tokenLifetimeFeesSol: number;
  recentClaims: Array<{
    claimer: string;
    amount: number;
    timestamp: number;
    signature: string;
  }>;
  totalClaimsSol: number;
  claimCount: number;
  lastUpdated: string;
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function AnimatedNumber({ value, decimals = 4 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const duration = 1200;
    const steps = 30;
    let step = 0;

    const timer = setInterval(() => {
      step++;
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

const MARKETPLACE_APPS = [
  {
    name: "DividendsBot",
    pct: 30,
    emoji: "💰",
    color: "from-green-600 to-green-400",
    description: "Auto-pays top 100 holders daily when 10+ SOL unclaimed",
    verified: true,
  },
  {
    name: "DEX Boosts",
    pct: 30,
    emoji: "📈",
    color: "from-blue-600 to-blue-400",
    description: "Auto-buys DexScreener visibility",
    verified: false,
  },
  {
    name: "Compound Liquidity",
    pct: 20,
    emoji: "💧",
    color: "from-cyan-600 to-cyan-400",
    description: "Deepens token liquidity pool",
    verified: false,
  },
  {
    name: "BagsAMM",
    pct: 20,
    emoji: "🤖",
    color: "from-purple-600 to-purple-400",
    description: "Automated market maker for volume",
    verified: false,
  },
] as const;

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
  const [showContent, setShowContent] = useState(false);

  const walletAddress = ECOSYSTEM_CONFIG.ecosystem.wallet;
  const solscanUrl = `https://solscan.io/account/${walletAddress}`;

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana";
      const connection = new Connection(rpcUrl, "confirmed");
      const pubkey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(pubkey);
      setWalletInfo({ balance: balance / LAMPORTS_PER_SOL, isLoading: false, error: null });
    };

    fetchBalance().catch(() => {
      setWalletInfo({ balance: 0, isLoading: false, error: "Failed to load balance" });
    });

    const interval = setInterval(() => {
      fetchBalance().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const fetchFeeData = useCallback(async () => {
    setFeeLoading(true);
    setFeeError(null);
    try {
      const res = await fetch("/api/community-fund");
      if (!res.ok) throw new Error("Failed to fetch fee data");
      const data: FeeData = await res.json();
      setFeeData(data);
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
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (timestamp: number | string) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

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
              <h2 className="font-pixel text-white text-xs sm:text-sm">COMMUNITY BUILDING</h2>
              <p className="font-pixel text-green-200 text-[7px] sm:text-[8px]">
                Powered by Bags App Store
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
            HOW IT WORKS
          </button>
          <button
            onClick={() => setActiveTab("fees")}
            className={`flex-1 font-pixel text-[10px] sm:text-xs py-2.5 px-3 transition-colors border-b-2 ${
              activeTab === "fees"
                ? "text-bags-green border-bags-green bg-bags-green/10"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            ON-CHAIN DATA
          </button>
        </div>

        {/* How It Works Tab */}
        {activeTab === "fund" && (
          <div className="p-4 space-y-4">
            {/* Main Message — lead with what it does, not wallet balance */}
            <div className="bg-bags-darker rounded-lg p-4 border border-bags-green/30 text-center">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-pixel text-bags-green text-[11px] mb-2">Bags App Store</h3>
              <p className="font-pixel text-gray-300 text-[9px] leading-relaxed">
                $BagsWorld token fees auto-route to{" "}
                <span className="text-bags-gold">Bags App Store</span> apps for automated token
                growth — dividends, DEX boosts, liquidity, and volume support.
              </p>
            </div>

            {/* Ecosystem Wallet — compact inline, not hero element */}
            <div className="bg-gradient-to-br from-bags-darker to-black rounded-lg p-3 border border-bags-gold/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-pixel text-bags-gold text-[9px]">Ecosystem Wallet</h3>
                  {walletInfo.isLoading ? (
                    <span className="font-pixel text-gray-400 text-[9px] animate-pulse">...</span>
                  ) : walletInfo.error ? (
                    <span className="font-pixel text-red-400 text-[8px]">error</span>
                  ) : (
                    <span className="font-pixel text-bags-green text-[10px]">
                      {walletInfo.balance.toFixed(4)} SOL
                    </span>
                  )}
                </div>
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
              <p className="font-mono text-[7px] text-gray-600 mt-1 break-all">{walletAddress}</p>
              <p className="font-pixel text-[7px] text-gray-500 mt-1">
                Balance is low when fees are actively distributed to apps — that means the system is
                working.
              </p>
            </div>

            {/* Key Points */}
            <div className="bg-bags-darker rounded-lg p-4 border border-blue-500/30">
              <h3 className="font-pixel text-blue-400 text-xs mb-3">Zero Creator Fees</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-base">💰</span>
                  <div>
                    <p className="font-pixel text-white text-[9px]">Launch for Free</p>
                    <p className="font-pixel text-gray-500 text-[7px]">
                      Creators pay NO extra BagsWorld fees on token launches
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base">🤖</span>
                  <div>
                    <p className="font-pixel text-white text-[9px]">Agent Workforce</p>
                    <p className="font-pixel text-gray-500 text-[7px]">
                      17 AI agents promote, trade, and hype your token
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base">📈</span>
                  <div>
                    <p className="font-pixel text-white text-[9px]">Automated Growth</p>
                    <p className="font-pixel text-gray-500 text-[7px]">
                      Dividends, DEX boosts, liquidity, and AMM handled automatically
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base">🔍</span>
                  <div>
                    <p className="font-pixel text-white text-[9px]">100% Transparent</p>
                    <p className="font-pixel text-gray-500 text-[7px]">
                      All transactions verifiable on-chain via Solscan
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bags App Store Split */}
            <div className="bg-bags-darker rounded-lg p-3 border border-purple-500/30">
              <h3 className="font-pixel text-purple-400 text-xs mb-3">Fee Distribution</h3>
              <div className="space-y-2">
                {MARKETPLACE_APPS.map((app, i) => (
                  <div key={app.name}>
                    <div className="flex justify-between mb-1">
                      <span className="font-pixel text-[8px] text-white flex items-center gap-1.5">
                        <span>{app.emoji}</span> {app.name}
                      </span>
                      <span className="font-pixel text-[8px] text-bags-gold">{app.pct}%</span>
                    </div>
                    <div className="h-4 bg-black/60 rounded-sm border border-gray-700 overflow-hidden relative">
                      <AnimatedBar
                        percentage={(app.pct / 30) * 100}
                        color={`bg-gradient-to-r ${app.color}`}
                        delay={200 + i * 150}
                      />
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,rgba(0,0,0,0.15)_3px,rgba(0,0,0,0.15)_4px)]" />
                    </div>
                    <p className="font-pixel text-gray-500 text-[6px] mt-0.5">{app.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Services */}
            <div className="border border-gray-700 rounded-lg p-3">
              <h3 className="font-pixel text-white text-[10px] mb-2">Agent-as-a-Service</h3>
              <div className="space-y-1">
                {ECOSYSTEM_CONFIG.ecosystem.agentServices.map((service, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-green-500 text-xs">✓</span>
                    <span className="font-pixel text-gray-300 text-[7px]">{service}</span>
                  </div>
                ))}
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

        {/* On-Chain Data Tab */}
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
                  Loading on-chain data...
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
                {/* Lifetime Fees */}
                <div className="bg-gradient-to-br from-bags-darker via-black to-bags-darker rounded-lg p-5 border border-bags-green/40 relative overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none opacity-10">
                    {[...Array(6)].map((_, i) => (
                      <PixelCoin key={i} size={12} className="absolute animate-pulse" />
                    ))}
                  </div>
                  <div className="relative text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <PixelCoin size={20} />
                      <span className="font-pixel text-gray-400 text-[9px]">
                        $BagsWorld Lifetime Fees
                      </span>
                      <PixelCoin size={20} />
                    </div>
                    <div className="font-pixel text-4xl sm:text-5xl text-bags-green drop-shadow-[0_0_12px_rgba(34,197,94,0.4)]">
                      <AnimatedNumber value={feeData.tokenLifetimeFeesSol} />
                    </div>
                    <div className="font-pixel text-gray-500 text-[10px] mt-1">
                      SOL generated by $BagsWorld trading
                    </div>
                  </div>
                </div>

                {/* Marketplace Distribution Breakdown */}
                <div className="bg-bags-darker rounded-lg p-4 border border-bags-green/30 space-y-3">
                  <h3 className="font-pixel text-white text-[10px] flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-bags-green rounded-full animate-pulse" />
                    Where Fees Go
                  </h3>
                  <p className="font-pixel text-gray-500 text-[7px]">
                    100% of $BagsWorld trading fees route to Bags App Store apps
                  </p>

                  {MARKETPLACE_APPS.map((app, i) => (
                    <div key={app.name}>
                      <div className="flex justify-between mb-1">
                        <span className="font-pixel text-[8px] text-white flex items-center gap-1.5">
                          <span>{app.emoji}</span> {app.name}
                        </span>
                        <span className="font-pixel text-[8px] text-bags-gold">{app.pct}%</span>
                      </div>
                      <div className="h-5 bg-black/60 rounded-sm border border-gray-700 overflow-hidden relative">
                        <AnimatedBar
                          percentage={(app.pct / 30) * 100}
                          color={`bg-gradient-to-r ${app.color}`}
                          delay={300 + i * 200}
                        />
                        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,rgba(0,0,0,0.15)_3px,rgba(0,0,0,0.15)_4px)]" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Flow Diagram */}
                <div className="bg-bags-darker rounded-lg p-4 border border-bags-green/30">
                  <h3 className="font-pixel text-white text-[10px] mb-3 text-center">Fee Flow</h3>
                  <div className="flex items-center justify-between gap-2 px-2">
                    <div className="text-center flex-shrink-0">
                      <div className="text-2xl mb-1">💱</div>
                      <div className="font-pixel text-[7px] text-bags-gold">Trading</div>
                      <div className="font-pixel text-[7px] text-gray-500">fees generated</div>
                    </div>

                    <div className="flex-1 flex items-center justify-center gap-[2px] overflow-hidden relative h-8">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-bags-green/80 rounded-[1px] animate-pulse flex-shrink-0"
                          style={{ animationDelay: `${i * 150}ms`, animationDuration: "1.2s" }}
                        />
                      ))}
                    </div>

                    <div className="font-pixel text-bags-green text-xs flex-shrink-0">100%</div>

                    <div className="flex-1 flex items-center justify-center gap-[2px] overflow-hidden relative h-8">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-bags-green/80 rounded-[1px] animate-pulse flex-shrink-0"
                          style={{
                            animationDelay: `${i * 150 + 600}ms`,
                            animationDuration: "1.2s",
                          }}
                        />
                      ))}
                    </div>

                    <div className="text-center flex-shrink-0">
                      <div className="text-2xl mb-1">📱</div>
                      <div className="font-pixel text-[7px] text-bags-green">Bags</div>
                      <div className="font-pixel text-[7px] text-gray-500">App Store</div>
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/30 rounded-lg p-3 border border-gray-700 text-center">
                    <div className="font-pixel text-[8px] text-gray-400 mb-1">Total Claims</div>
                    <div className="font-pixel text-lg text-bags-green">
                      <AnimatedNumber value={feeData.totalClaimsSol} decimals={2} />
                    </div>
                    <div className="font-pixel text-[7px] text-gray-500">SOL claimed</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 border border-gray-700 text-center">
                    <div className="font-pixel text-[8px] text-gray-400 mb-1">Claim Events</div>
                    <div className="font-pixel text-lg text-bags-gold">{feeData.claimCount}</div>
                    <div className="font-pixel text-[7px] text-gray-500">transactions</div>
                  </div>
                </div>

                {/* Recent Claims */}
                {feeData.recentClaims.length > 0 && (
                  <div className="bg-bags-darker rounded-lg p-4 border border-blue-500/30">
                    <h3 className="font-pixel text-blue-400 text-xs mb-3">Recent Claims</h3>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {feeData.recentClaims.map((claim, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-black/30 rounded p-2"
                        >
                          <div className="flex items-center gap-2">
                            <PixelCoin size={12} />
                            <div>
                              <span className="font-pixel text-bags-green text-[10px]">
                                {claim.amount.toFixed(4)} SOL
                              </span>
                              <span className="font-pixel text-gray-600 text-[7px] ml-2">
                                {truncateWallet(claim.claimer)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-pixel text-gray-600 text-[7px]">
                              {formatDate(claim.timestamp)}
                            </span>
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Zero-state */}
            {!feeLoading &&
              !feeError &&
              feeData &&
              feeData.tokenLifetimeFeesSol === 0 &&
              feeData.recentClaims.length === 0 && (
                <div className="bg-bags-darker rounded-lg p-4 border border-gray-700 text-center">
                  <div className="text-2xl mb-2">📱</div>
                  <p className="font-pixel text-gray-400 text-[9px]">
                    No fee activity recorded yet. Fees will appear here once $BagsWorld trading
                    generates them.
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
