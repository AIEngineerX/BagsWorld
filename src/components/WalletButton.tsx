"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useState, useRef, useEffect } from "react";

export function WalletButton() {
  const { publicKey, disconnect, connecting, connected, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClick = useCallback(() => {
    if (connected) {
      setShowDropdown(!showDropdown);
    } else {
      setVisible(true);
    }
  }, [connected, setVisible, showDropdown]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setShowDropdown(false);
  }, [disconnect]);

  const handleChangeWallet = useCallback(() => {
    setShowDropdown(false);
    setVisible(true);
  }, [setVisible]);

  const handleCopyAddress = useCallback(() => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setShowDropdown(false);
    }
  }, [publicKey]);

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleClick}
        disabled={connecting}
        className={`font-pixel text-[9px] sm:text-[10px] px-2 py-1.5 sm:px-3 sm:py-2 border-2 transition-colors max-w-[130px] sm:max-w-none ${
          connected
            ? "border-bags-green bg-bags-green/10 text-bags-green hover:bg-bags-green/20"
            : "border-bags-gold bg-bags-gold/10 text-bags-gold hover:bg-bags-gold/20"
        } ${connecting ? "opacity-50 cursor-wait" : ""}`}
      >
        {connecting ? (
          <span>
            <span className="hidden xs:inline">CONNECTING...</span>
            <span className="xs:hidden">...</span>
          </span>
        ) : connected && publicKey ? (
          <span className="flex items-center gap-1 sm:gap-2 truncate">
            <span className="w-2 h-2 bg-bags-green rounded-full animate-pulse shrink-0" />
            <span className="truncate">{truncateAddress(publicKey.toBase58())}</span>
            <span className="text-[8px] opacity-60 shrink-0">▼</span>
          </span>
        ) : (
          <span>CONNECT</span>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && connected && (
        <div className="absolute right-0 top-full mt-1 bg-bags-dark border-2 border-bags-green/50 shadow-lg z-50 min-w-[160px]">
          {/* Wallet Info */}
          <div className="px-3 py-2 border-b border-bags-green/20">
            <div className="font-pixel text-[8px] text-gray-400">Connected with</div>
            <div className="font-pixel text-[10px] text-bags-green">
              {wallet?.adapter.name || "Wallet"}
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={handleCopyAddress}
            className="w-full px-3 py-2 font-pixel text-[10px] text-left text-gray-300 hover:bg-bags-green/10 hover:text-white transition-colors flex items-center gap-2"
          >
            <span className="opacity-60">📋</span> Copy Address
          </button>
          <a
            href={`https://solscan.io/account/${publicKey?.toBase58()}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setShowDropdown(false)}
            className="block w-full px-3 py-2 font-pixel text-[10px] text-left text-gray-300 hover:bg-bags-green/10 hover:text-white transition-colors flex items-center gap-2"
          >
            <span className="opacity-60">↗</span> View on Solscan
          </a>
          <button
            onClick={handleChangeWallet}
            className="w-full px-3 py-2 font-pixel text-[10px] text-left text-gray-300 hover:bg-bags-green/10 hover:text-white transition-colors flex items-center gap-2"
          >
            <span className="opacity-60">↻</span> Change Wallet
          </button>
          <button
            onClick={handleDisconnect}
            className="w-full px-3 py-2 font-pixel text-[10px] text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border-t border-bags-green/20 flex items-center gap-2"
          >
            <span className="opacity-60">✕</span> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
