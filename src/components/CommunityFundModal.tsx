"use client";

import { useState, useEffect } from "react";
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

export function CommunityFundModal({ onClose }: CommunityFundModalProps) {
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    balance: 0,
    isLoading: true,
    error: null,
  });

  const walletAddress = ECOSYSTEM_CONFIG.ecosystem.wallet;
  const solscanUrl = `https://solscan.io/account/${walletAddress}`;

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
        const rpcUrl =
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
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
    // Refresh every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-2 border-bags-green rounded-t-xl sm:rounded-lg max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
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
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>
    </div>
  );
}
