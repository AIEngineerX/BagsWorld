"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback } from "react";

export function WalletButton() {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const handleClick = useCallback(() => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  }, [connected, disconnect, setVisible]);

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className={`font-pixel text-[10px] px-3 py-2 border-2 transition-colors ${
        connected
          ? "border-bags-green bg-bags-green/10 text-bags-green hover:bg-bags-green/20"
          : "border-bags-gold bg-bags-gold/10 text-bags-gold hover:bg-bags-gold/20"
      } ${connecting ? "opacity-50 cursor-wait" : ""}`}
    >
      {connecting ? (
        "CONNECTING..."
      ) : connected && publicKey ? (
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-bags-green rounded-full animate-pulse" />
          {truncateAddress(publicKey.toBase58())}
        </span>
      ) : (
        "CONNECT WALLET"
      )}
    </button>
  );
}
