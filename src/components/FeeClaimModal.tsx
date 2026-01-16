"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import type { ClaimablePosition } from "@/lib/types";

interface FeeClaimModalProps {
  onClose: () => void;
}

export function FeeClaimModal({ onClose }: FeeClaimModalProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();

  const [positions, setPositions] = useState<ClaimablePosition[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [totalClaimable, setTotalClaimable] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!publicKey) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-positions",
          wallet: publicKey.toBase58(),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch positions");
      }

      const data = await response.json();
      setPositions(data.positions || []);
      setTotalClaimable(data.totalClaimable || 0);

      // Select all by default
      setSelectedPositions(new Set(data.positions?.map((p: ClaimablePosition) => p.virtualPool) || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load claimable positions");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchPositions();
    }
  }, [connected, publicKey, fetchPositions]);

  const togglePosition = (virtualPool: string) => {
    const newSelected = new Set(selectedPositions);
    if (newSelected.has(virtualPool)) {
      newSelected.delete(virtualPool);
    } else {
      newSelected.add(virtualPool);
    }
    setSelectedPositions(newSelected);
  };

  const selectAll = () => {
    setSelectedPositions(new Set(positions.map(p => p.virtualPool)));
  };

  const selectNone = () => {
    setSelectedPositions(new Set());
  };

  const selectedTotal = positions
    .filter(p => selectedPositions.has(p.virtualPool))
    .reduce((sum, p) => sum + p.claimableDisplayAmount, 0);

  const handleClaim = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setWalletModalVisible(true);
      return;
    }

    if (selectedPositions.size === 0) {
      setError("Select at least one position to claim");
      return;
    }

    setIsClaiming(true);
    setError(null);

    try {
      // Generate claim transactions
      const response = await fetch("/api/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-claim-tx",
          wallet: publicKey.toBase58(),
          positions: Array.from(selectedPositions),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate claim transactions");
      }

      const { transactions } = await response.json();

      if (!transactions || transactions.length === 0) {
        throw new Error("No transactions returned");
      }

      // Sign and send each transaction
      let successCount = 0;
      for (const txBase64 of transactions) {
        try {
          const txBuffer = Buffer.from(txBase64, "base64");
          const transaction = Transaction.from(txBuffer);

          // Sign the transaction
          const signedTx = await signTransaction(transaction);

          // Send the signed transaction
          const signature = await connection.sendRawTransaction(signedTx.serialize());

          // Wait for confirmation
          await connection.confirmTransaction(signature, "confirmed");
          successCount++;
        } catch (txError) {
          console.error("Transaction error:", txError);
          // Continue with other transactions
        }
      }

      if (successCount > 0) {
        setSuccess(`Successfully claimed from ${successCount} position${successCount > 1 ? "s" : ""}!`);
        // Refresh positions after successful claim
        setTimeout(() => {
          fetchPositions();
          setSuccess(null);
        }, 3000);
      } else {
        throw new Error("All claim transactions failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim fees");
    } finally {
      setIsClaiming(false);
    }
  };

  const formatSol = (lamports: number) => {
    return (lamports / 1e9).toFixed(4);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-bags-dark border-4 border-bags-gold w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-4 border-bags-gold sticky top-0 bg-bags-dark">
          <div>
            <h2 className="font-pixel text-sm text-bags-gold">
              CLAIM FEES
            </h2>
            <p className="font-pixel text-[8px] text-gray-400">
              Collect your earned trading fees
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs text-gray-400 hover:text-white"
          >
            [X]
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!connected ? (
            <div className="text-center py-8">
              <p className="font-pixel text-[10px] text-gray-400 mb-4">
                Connect your wallet to see claimable fees
              </p>
              <button
                onClick={() => setWalletModalVisible(true)}
                className="btn-retro"
              >
                CONNECT WALLET
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <p className="font-pixel text-[10px] text-bags-green animate-pulse">
                Loading positions...
              </p>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-pixel text-[10px] text-gray-400">
                No claimable fees found
              </p>
              <p className="font-pixel text-[8px] text-gray-500 mt-2">
                Launch tokens and earn fees from trades!
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-bags-darker p-3 border border-bags-gold/30">
                <div className="flex justify-between items-center">
                  <span className="font-pixel text-[10px] text-gray-400">Total Claimable:</span>
                  <span className="font-pixel text-sm text-bags-gold">
                    {formatSol(totalClaimable * 1e9)} SOL
                  </span>
                </div>
              </div>

              {/* Selection Controls */}
              <div className="flex justify-between items-center">
                <span className="font-pixel text-[8px] text-gray-400">
                  {selectedPositions.size} of {positions.length} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="font-pixel text-[8px] text-bags-green hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={selectNone}
                    className="font-pixel text-[8px] text-gray-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Positions List */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {positions.map((position) => (
                  <div
                    key={position.virtualPool}
                    onClick={() => togglePosition(position.virtualPool)}
                    className={`p-3 border cursor-pointer transition-colors ${
                      selectedPositions.has(position.virtualPool)
                        ? "border-bags-gold bg-bags-gold/10"
                        : "border-bags-green/30 hover:border-bags-green/50"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 border-2 ${
                            selectedPositions.has(position.virtualPool)
                              ? "border-bags-gold bg-bags-gold"
                              : "border-gray-500"
                          }`}
                        />
                        <div>
                          <p className="font-pixel text-[10px] text-white">
                            {position.baseMint.slice(0, 8)}...
                          </p>
                          <p className="font-pixel text-[8px] text-gray-400">
                            Your share: {(position.userBps / 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-pixel text-[10px] text-bags-green">
                          {position.claimableDisplayAmount.toFixed(4)} SOL
                        </p>
                        {position.isMigrated && (
                          <p className="font-pixel text-[6px] text-blue-400">
                            MIGRATED
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Total */}
              {selectedPositions.size > 0 && (
                <div className="bg-bags-green/10 border border-bags-green/30 p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-pixel text-[10px] text-gray-400">
                      Selected Total:
                    </span>
                    <span className="font-pixel text-sm text-bags-green">
                      {selectedTotal.toFixed(4)} SOL
                    </span>
                  </div>
                </div>
              )}
            </>
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
        {connected && positions.length > 0 && (
          <div className="p-4 border-t border-bags-gold/30">
            <button
              onClick={handleClaim}
              disabled={isClaiming || selectedPositions.size === 0}
              className="w-full btn-retro disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClaiming ? "CLAIMING..." : `CLAIM ${selectedTotal.toFixed(4)} SOL`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
