"use client";

import { useState, useEffect } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ECOSYSTEM_CONFIG } from "@/lib/config";

export function EcosystemStats() {
  const [balance, setBalance] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const walletAddress = ECOSYSTEM_CONFIG.ecosystem.wallet;
  const solscanUrl = `https://solscan.io/account/${walletAddress}`;

  // Fetch Community Fund wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const rpcUrl =
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
        const connection = new Connection(rpcUrl, "confirmed");
        const pubkey = new PublicKey(walletAddress);
        const lamports = await connection.getBalance(pubkey);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch {
        // Silent fail - stats are optional
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [walletAddress]);

  if (balance === null) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-gray-400 hover:text-bags-green transition-colors"
        title="Community Fund - Click for details"
      >
        FUND: <span className="text-bags-green">{balance.toFixed(2)} SOL</span>
        <span className="text-gray-500 ml-1">👻</span>
      </button>

      {isExpanded && (
        <div className="absolute bottom-8 left-0 bg-bags-dark border-2 border-bags-green p-3 min-w-64 z-50 shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-pixel text-xs text-bags-green">COMMUNITY FUND</h3>
            <button onClick={() => setIsExpanded(false)} className="text-gray-500 hover:text-white">
              [X]
            </button>
          </div>

          {/* Balance Display */}
          <div className="bg-black/50 rounded-lg p-3 text-center mb-3">
            <div className="font-pixel text-2xl text-bags-green mb-1">{balance.toFixed(4)}</div>
            <div className="font-pixel text-gray-500 text-[9px]">SOL Balance</div>
          </div>

          {/* How It Works */}
          <div className="space-y-2 font-pixel text-[9px]">
            <div className="flex items-center gap-2">
              <span>👻</span>
              <span className="text-gray-300">Ghost&apos;s 5% contribution</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🎰</span>
              <span className="text-gray-400">Funds Casino prizes</span>
            </div>
            <div className="flex items-center gap-2">
              <span>💰</span>
              <span className="text-gray-400">Zero creator fees</span>
            </div>
          </div>

          {/* Verify Link */}
          <div className="mt-3 pt-2 border-t border-gray-700">
            <a
              href={solscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 font-pixel text-[8px] text-gray-500 hover:text-bags-green transition-colors"
            >
              Verify on Solscan
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
        </div>
      )}
    </div>
  );
}
