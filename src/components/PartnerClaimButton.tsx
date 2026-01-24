"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { ECOSYSTEM_CONFIG } from "@/lib/config";

// Helper to deserialize transaction - handles various formats from Bags API
function deserializeTransaction(
  encoded: string | Record<string, unknown>
): VersionedTransaction | Transaction {
  // Handle object responses - extract transaction string
  let txString: string;
  if (typeof encoded === "object" && encoded !== null) {
    const possibleFields = ["transaction", "tx", "data", "rawTransaction"];
    for (const field of possibleFields) {
      if (typeof (encoded as Record<string, unknown>)[field] === "string") {
        txString = (encoded as Record<string, unknown>)[field] as string;
        break;
      }
    }
    if (!txString!) {
      throw new Error(`Could not find transaction string in response`);
    }
  } else if (typeof encoded === "string") {
    txString = encoded;
  } else {
    throw new Error(`Invalid transaction: expected string or object`);
  }

  // Clean and decode
  txString = txString.trim();
  const isBase64 = txString.includes("+") || txString.includes("/") || txString.endsWith("=");

  let buffer: Uint8Array;
  if (isBase64) {
    buffer = Buffer.from(txString, "base64");
  } else {
    // Try base58
    const bs58 = require("bs58");
    try {
      buffer = bs58.decode(txString);
    } catch {
      buffer = Buffer.from(txString, "base64");
    }
  }

  // Try both transaction formats
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

interface ClaimTransaction {
  blockhash: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
  transaction: string; // Base64 encoded
}

export function PartnerClaimButton() {
  const { publicKey, connected, signAllTransactions, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [isPartner, setIsPartner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "generating" | "signing" | "sending" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [txSignatures, setTxSignatures] = useState<string[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Check if connected wallet is the partner wallet
  useEffect(() => {
    if (connected && publicKey) {
      const walletAddress = publicKey.toBase58();
      setIsPartner(walletAddress === ECOSYSTEM_CONFIG.ecosystem.wallet);
    } else {
      setIsPartner(false);
    }
  }, [connected, publicKey]);

  // Don't render if not the partner
  if (!isPartner) {
    return null;
  }

  // Setup partner config (one-time)
  const handleSetup = async () => {
    if (!publicKey || !signTransaction) {
      setMessage("Please connect your wallet");
      return;
    }

    setIsLoading(true);
    setStatus("generating");
    setMessage("Creating partner config...");
    setTxSignatures([]);

    try {
      const response = await fetch("/api/partner-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          action: "create-config",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create partner config");
      }

      const data = await response.json();

      if (!data.transaction) {
        throw new Error("No transaction returned");
      }

      setStatus("signing");
      setMessage("Please sign the transaction...");

      // Decode and sign (handles both versioned and legacy formats)
      const tx = deserializeTransaction(data.transaction);
      const signedTx = await signTransaction(tx);

      setStatus("sending");
      setMessage("Sending to network...");

      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await connection.confirmTransaction({
        signature,
        blockhash: data.blockhash.blockhash,
        lastValidBlockHeight: data.blockhash.lastValidBlockHeight,
      });

      setTxSignatures([signature]);
      setStatus("success");
      setMessage("Partner config created! You can now claim fees.");
      setNeedsSetup(false);
    } catch (error) {
      console.error("Setup error:", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to setup partner config");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !signAllTransactions) {
      setMessage("Please connect your wallet");
      return;
    }

    setIsLoading(true);
    setStatus("generating");
    setMessage("Generating claim transactions...");
    setTxSignatures([]);

    try {
      // 1. Get claim transactions from API
      const response = await fetch("/api/partner-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          action: "claim",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // Check if needs setup
        if (error.error?.includes("not found") || error.error?.includes("Setup Partner")) {
          setNeedsSetup(true);
          throw new Error("Partner config not found. Please click 'Setup Partner' first.");
        }
        throw new Error(error.error || "Failed to generate claim transactions");
      }

      const data = await response.json();
      const transactions: ClaimTransaction[] = data.transactions || [];

      if (transactions.length === 0) {
        setStatus("success");
        setMessage("No fees available to claim at this time");
        setIsLoading(false);
        return;
      }

      setMessage(`Found ${transactions.length} transaction(s) to sign...`);
      setStatus("signing");

      // 2. Decode and prepare transactions for signing (handles both versioned and legacy)
      const txsToSign: (VersionedTransaction | Transaction)[] = [];

      for (const txData of transactions) {
        const tx = deserializeTransaction(txData.transaction);
        txsToSign.push(tx);
      }

      // 3. Sign all transactions
      const signedTxs = await signAllTransactions(txsToSign);

      setStatus("sending");
      setMessage("Sending transactions to network...");

      // 4. Send all signed transactions
      const signatures: string[] = [];

      for (let i = 0; i < signedTxs.length; i++) {
        const signedTx = signedTxs[i];
        const txData = transactions[i];

        try {
          const signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });

          // Wait for confirmation
          await connection.confirmTransaction({
            signature,
            blockhash: txData.blockhash.blockhash,
            lastValidBlockHeight: txData.blockhash.lastValidBlockHeight,
          });

          signatures.push(signature);
          setMessage(`Confirmed ${signatures.length}/${signedTxs.length} transactions...`);
        } catch (sendError) {
          console.error(`Failed to send transaction ${i + 1}:`, sendError);
          // Continue with other transactions
        }
      }

      setTxSignatures(signatures);

      if (signatures.length > 0) {
        setStatus("success");
        setMessage(`Successfully claimed fees! ${signatures.length} transaction(s) confirmed.`);
      } else {
        setStatus("error");
        setMessage("Failed to confirm any transactions. Please try again.");
      }
    } catch (error) {
      console.error("Claim error:", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to claim fees");
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setStatus("idle");
    setMessage("");
    setTxSignatures([]);
    setShowModal(false);
  };

  return (
    <>
      {/* Partner Claim Button */}
      <button
        onClick={() => setShowModal(true)}
        className="font-pixel text-[10px] px-3 py-1.5 bg-bags-gold/20 text-bags-gold border border-bags-gold/50 hover:bg-bags-gold/30 transition-colors"
        title="Claim partner fees"
      >
        💰 CLAIM FEES
      </button>

      {/* Claim Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
          onClick={(e) => e.target === e.currentTarget && !isLoading && resetModal()}
        >
          <div
            className="bg-bags-dark border-4 border-bags-gold w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-4 border-bags-gold">
              <div>
                <h2 className="font-pixel text-sm text-bags-gold">💰 PARTNER FEE CLAIM</h2>
                <p className="font-pixel text-[8px] text-gray-400">
                  Claim your accumulated partner fees
                </p>
              </div>
              {!isLoading && (
                <button
                  onClick={resetModal}
                  className="font-pixel text-xs text-gray-400 hover:text-white"
                >
                  [X]
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Partner Info */}
              <div className="bg-bags-darker p-3 border border-bags-gold/30 space-y-2">
                <p className="font-pixel text-[10px] text-bags-gold">Partner Wallet</p>
                <p className="font-pixel text-[8px] text-gray-400 break-all">
                  {publicKey?.toBase58()}
                </p>
                <a
                  href={`https://solscan.io/account/${publicKey?.toBase58()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-pixel text-[7px] text-blue-400 hover:text-blue-300"
                >
                  🔍 View on Solscan →
                </a>
              </div>

              {/* Explanation */}
              <div className="bg-bags-green/10 border border-bags-green/30 p-3">
                <p className="font-pixel text-[8px] text-gray-300">
                  As a BagsWorld partner, you earn fees from tokens launched through the platform.
                  Click claim to generate and sign transactions to collect your accumulated fees.
                </p>
              </div>

              {/* Status Messages */}
              {status !== "idle" && (
                <div
                  className={`p-3 border ${
                    status === "success"
                      ? "bg-bags-green/20 border-bags-green"
                      : status === "error"
                        ? "bg-red-500/20 border-red-500"
                        : "bg-bags-gold/20 border-bags-gold"
                  }`}
                >
                  <p
                    className={`font-pixel text-[10px] ${
                      status === "success"
                        ? "text-bags-green"
                        : status === "error"
                          ? "text-red-400"
                          : "text-bags-gold"
                    }`}
                  >
                    {status === "generating" && "⏳ "}
                    {status === "signing" && "✍️ "}
                    {status === "sending" && "📤 "}
                    {status === "success" && "✅ "}
                    {status === "error" && "❌ "}
                    {message}
                  </p>
                </div>
              )}

              {/* Transaction Signatures */}
              {txSignatures.length > 0 && (
                <div className="bg-bags-darker p-3 border border-bags-green/30 space-y-2">
                  <p className="font-pixel text-[10px] text-bags-green">Transaction Signatures:</p>
                  {txSignatures.map((sig, i) => (
                    <a
                      key={sig}
                      href={`https://solscan.io/tx/${sig}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-pixel text-[7px] text-blue-400 hover:text-blue-300 truncate"
                    >
                      {i + 1}. {sig.slice(0, 20)}...{sig.slice(-20)} →
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-bags-gold/30 space-y-2">
              {status === "success" || status === "error" ? (
                <button
                  onClick={resetModal}
                  className="w-full py-3 font-pixel text-[10px] border-2 border-bags-gold bg-bags-gold/20 text-bags-gold hover:bg-bags-gold/30"
                >
                  CLOSE
                </button>
              ) : (
                <>
                  {needsSetup && (
                    <button
                      onClick={handleSetup}
                      disabled={isLoading}
                      className="w-full py-3 font-pixel text-[10px] border-2 border-bags-green bg-bags-green/20 text-bags-green hover:bg-bags-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? "PROCESSING..." : "⚙️ SETUP PARTNER (ONE-TIME)"}
                    </button>
                  )}
                  <button
                    onClick={handleClaim}
                    disabled={isLoading}
                    className="w-full py-3 font-pixel text-[10px] border-2 border-bags-gold bg-bags-gold/20 text-bags-gold hover:bg-bags-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "PROCESSING..." : "🚀 CLAIM PARTNER FEES"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
