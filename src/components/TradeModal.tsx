"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { TradeQuote } from "@/lib/types";
import { getTokenDecimals } from "@/lib/token-balance";

// Helper to deserialize transaction - tries both formats
function deserializeTransaction(base64: string): VersionedTransaction | Transaction {
  const buffer = Buffer.from(base64, "base64");
  try {
    return VersionedTransaction.deserialize(buffer);
  } catch {
    try {
      return Transaction.from(buffer);
    } catch (e) {
      throw new Error(`Failed to deserialize transaction: ${e}`);
    }
  }
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface TradeModalProps {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  onClose: () => void;
}

type TradeDirection = "buy" | "sell";

export function TradeModal({ tokenMint, tokenSymbol, tokenName, onClose }: TradeModalProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();

  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(0.5); // 0.5% default

  const inputMint = direction === "buy" ? SOL_MINT : tokenMint;
  const outputMint = direction === "buy" ? tokenMint : SOL_MINT;

  const fetchQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    setError(null);

    try {
      // Fetch actual token decimals from chain metadata
      const inputDecimals = await getTokenDecimals(connection, inputMint);
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, inputDecimals));

      const response = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          data: {
            inputMint,
            outputMint,
            amount: amountInSmallestUnit,
            slippageBps: slippage * 100, // Convert to basis points
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to get quote");
      }

      const { quote: quoteData } = await response.json();
      setQuote(quoteData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get quote");
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [amount, direction, inputMint, outputMint, slippage, connection]);

  // Debounce quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuote();
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchQuote]);

  const handleSwap = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setWalletModalVisible(true);
      return;
    }

    if (!quote) {
      setError("Get a quote first");
      return;
    }

    setIsSwapping(true);
    setError(null);

    try {
      // Get swap transaction
      const response = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          data: {
            quoteResponse: quote,
            userPublicKey: publicKey.toBase58(),
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create swap transaction");
      }

      const { transaction: txBase64 } = await response.json();

      // Decode and sign transaction (handles both versioned and legacy formats)
      const transaction = deserializeTransaction(txBase64);
      const signedTx = await signTransaction(transaction);

      // Send transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      setSuccess(`Swap successful! Signature: ${signature.slice(0, 8)}...`);
      setAmount("");
      setQuote(null);

      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  const formatAmount = (value: string, decimals: number = 9) => {
    const num = parseFloat(value) / Math.pow(10, decimals);
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-bags-dark border-4 border-bags-green w-full sm:max-w-sm max-h-[85vh] sm:max-h-[95vh] overflow-y-auto rounded-t-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b-4 border-bags-green">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bags-green/20 border border-bags-green rounded flex items-center justify-center flex-shrink-0">
              <span className="font-pixel text-bags-green text-[10px] sm:text-xs">$</span>
            </div>
            <div>
              <h2 className="font-pixel text-xs sm:text-sm text-bags-green">
                TRADE ${tokenSymbol}
              </h2>
              <p className="font-pixel text-[7px] sm:text-[8px] text-gray-400 truncate max-w-[150px] sm:max-w-none">
                {tokenName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs p-2 text-gray-400 hover:text-white touch-target border border-gray-700 hover:border-bags-green rounded flex-shrink-0"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        {/* Direction Toggle */}
        <div className="flex border-b border-bags-green/30">
          <button
            onClick={() => setDirection("buy")}
            className={`flex-1 py-3 font-pixel text-[10px] transition-colors ${
              direction === "buy"
                ? "bg-bags-green/20 text-bags-green border-b-2 border-bags-green"
                : "text-gray-400 hover:text-white"
            }`}
          >
            BUY
          </button>
          <button
            onClick={() => setDirection("sell")}
            className={`flex-1 py-3 font-pixel text-[10px] transition-colors ${
              direction === "sell"
                ? "bg-bags-red/20 text-bags-red border-b-2 border-bags-red"
                : "text-gray-400 hover:text-white"
            }`}
          >
            SELL
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block font-pixel text-[8px] text-gray-400 mb-1">
              {direction === "buy" ? "SOL AMOUNT" : `${tokenSymbol} AMOUNT`}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-bags-darker border-2 border-bags-green p-3 pr-16 font-pixel text-sm text-white focus:outline-none focus:border-bags-gold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-pixel text-[10px] text-gray-400">
                {direction === "buy" ? "SOL" : tokenSymbol}
              </span>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {[0.1, 0.5, 1, 5].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val.toString())}
                className="flex-1 py-1 border border-bags-green/30 font-pixel text-[8px] text-bags-green hover:bg-bags-green/10"
              >
                {val}
              </button>
            ))}
          </div>

          {/* Slippage */}
          <div>
            <label className="block font-pixel text-[8px] text-gray-400 mb-1">
              SLIPPAGE TOLERANCE
            </label>
            <div className="flex gap-2">
              {[0.5, 1, 2, 5].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`flex-1 py-1 border font-pixel text-[8px] transition-colors ${
                    slippage === val
                      ? "border-bags-gold bg-bags-gold/10 text-bags-gold"
                      : "border-bags-green/30 text-gray-400 hover:border-bags-green"
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {/* Quote Display */}
          {isLoadingQuote && (
            <div className="bg-bags-darker p-3 border border-bags-green/30">
              <p className="font-pixel text-[10px] text-gray-400 animate-pulse">
                Getting quote...
              </p>
            </div>
          )}

          {quote && !isLoadingQuote && (
            <div className="bg-bags-darker p-3 border border-bags-green/30 space-y-2">
              <div className="flex justify-between">
                <span className="font-pixel text-[8px] text-gray-400">You receive:</span>
                <span className="font-pixel text-[10px] text-bags-green">
                  {formatAmount(quote.outAmount, direction === "buy" ? 6 : 9)}{" "}
                  {direction === "buy" ? tokenSymbol : "SOL"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-pixel text-[8px] text-gray-400">Min received:</span>
                <span className="font-pixel text-[8px] text-gray-400">
                  {formatAmount(quote.minOutAmount, direction === "buy" ? 6 : 9)}{" "}
                  {direction === "buy" ? tokenSymbol : "SOL"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-pixel text-[8px] text-gray-400">Price impact:</span>
                <span className={`font-pixel text-[8px] ${
                  parseFloat(quote.priceImpactPct) > 5 ? "text-bags-red" : "text-gray-400"
                }`}>
                  {parseFloat(quote.priceImpactPct).toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Error/Success */}
          {error && (
            <div className="bg-bags-red/20 border-2 border-bags-red p-2">
              <p className="font-pixel text-[8px] text-bags-red">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-bags-green/20 border-2 border-bags-green p-2">
              <p className="font-pixel text-[8px] text-bags-green">{success}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-bags-green/30">
          <button
            onClick={handleSwap}
            disabled={isSwapping || !quote || isLoadingQuote}
            className={`w-full py-3 font-pixel text-[10px] border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              direction === "buy"
                ? "border-bags-green bg-bags-green/20 text-bags-green hover:bg-bags-green/30"
                : "border-bags-red bg-bags-red/20 text-bags-red hover:bg-bags-red/30"
            }`}
          >
            {isSwapping
              ? "SWAPPING..."
              : !connected
              ? "CONNECT WALLET"
              : direction === "buy"
              ? `BUY ${tokenSymbol}`
              : `SELL ${tokenSymbol}`}
          </button>
        </div>
      </div>
    </div>
  );
}
