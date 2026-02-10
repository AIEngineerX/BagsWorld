"use client";

import { useState, useEffect, useCallback } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import type { ClaimablePosition } from "@/lib/types";
import { useMobileWallet } from "@/hooks/useMobileWallet";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { useActionGuard } from "@/hooks/useActionGuard";
import {
  deserializeTransaction,
  preSimulateTransaction,
  sendSignedTransaction,
} from "@/lib/transaction-utils";
import { useXAuth } from "@/hooks/useXAuth";

interface FeeClaimModalProps {
  onClose: () => void;
}

export function FeeClaimModal({ onClose }: FeeClaimModalProps) {
  const { publicKey, connected, mobileSignTransaction: signTransaction, wallet } =
    useMobileWallet();
  const { signAllTransactions } = wallet;
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { translateY, isDismissing, handlers: swipeHandlers } = useSwipeToDismiss(onClose);
  const guardAction = useActionGuard();
  const { connection } = useConnection();
  const {
    user: xUser,
    isLoading: xAuthLoading,
    error: xAuthError,
    signIn: xSignIn,
    signOut: xSignOut,
    clearError: clearXError,
  } = useXAuth();

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const [positions, setPositions] = useState<ClaimablePosition[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [totalClaimable, setTotalClaimable] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // X-linked wallet state
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null);
  const [walletLookupError, setWalletLookupError] = useState<string | null>(null);
  const [isLookingUpWallet, setIsLookingUpWallet] = useState(false);

  // Look up X-linked wallet when user signs in
  useEffect(() => {
    if (xUser?.username) {
      lookupLinkedWallet(xUser.username);
    } else {
      setLinkedWallet(null);
      setWalletLookupError(null);
    }
  }, [xUser?.username]);

  // Fetch positions when we have a wallet to query
  const walletToQuery = linkedWallet || (connected && publicKey ? publicKey.toBase58() : null);

  useEffect(() => {
    if (walletToQuery) {
      fetchPositions(walletToQuery);
    } else {
      setPositions([]);
      setTotalClaimable(0);
    }
  }, [walletToQuery]);

  const lookupLinkedWallet = async (username: string) => {
    setIsLookingUpWallet(true);
    setWalletLookupError(null);

    try {
      const response = await fetch("/api/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup-by-x",
          xUsername: username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to look up wallet");
      }

      if (data.wallet) {
        setLinkedWallet(data.wallet);
      } else {
        throw new Error("No wallet linked to this X account");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to look up wallet";
      setWalletLookupError(errorMessage);
      setLinkedWallet(null);
    } finally {
      setIsLookingUpWallet(false);
    }
  };

  const fetchPositions = async (wallet: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-positions",
          wallet,
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
      setSelectedPositions(
        new Set(data.positions?.map((p: ClaimablePosition) => p.virtualPool) || [])
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load claimable positions");
    } finally {
      setIsLoading(false);
    }
  };

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
    setSelectedPositions(new Set(positions.map((p) => p.virtualPool)));
  };

  const selectNone = () => {
    setSelectedPositions(new Set());
  };

  const selectedTotal = positions
    .filter((p) => selectedPositions.has(p.virtualPool))
    .reduce((sum, p) => sum + (p.claimableDisplayAmount ?? 0), 0);

  // Check if connected wallet matches the X-linked wallet
  const walletMatches = !linkedWallet || (publicKey && publicKey.toBase58() === linkedWallet);

  const handleClaim = async () => {
    if (!connected || !publicKey) {
      setWalletModalVisible(true);
      return;
    }

    // Must use the wallet that owns the positions
    const claimWallet = linkedWallet || publicKey.toBase58();

    // Verify connected wallet matches
    if (linkedWallet && publicKey.toBase58() !== linkedWallet) {
      setError("Connect the wallet linked to your X account to claim");
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
          wallet: claimWallet,
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

      // Deserialize all transactions
      const txObjects = transactions.map((txBase64: string, i: number) =>
        deserializeTransaction(txBase64, `claim-tx-${i + 1}`)
      );

      // Pre-simulate each to catch errors before wallet popups
      for (let i = 0; i < txObjects.length; i++) {
        try {
          await preSimulateTransaction(connection, txObjects[i]);
        } catch (simError) {
          console.warn(`Claim tx ${i + 1} simulation warning:`, simError);
          // Non-fatal: continue to wallet signing
        }
      }

      // Batch-sign all transactions at once if wallet supports it (single popup)
      let signedTxs;
      if (signAllTransactions && txObjects.length > 1) {
        signedTxs = await signAllTransactions(txObjects);
      } else {
        // Fallback: sign one at a time
        signedTxs = [];
        for (const tx of txObjects) {
          signedTxs.push(await signTransaction(tx));
        }
      }

      // Send and confirm each signed transaction
      let successCount = 0;
      for (const signedTx of signedTxs) {
        try {
          const signature = await sendSignedTransaction(connection, signedTx);
          await connection.confirmTransaction(signature, "confirmed");
          successCount++;
        } catch (txError) {
          console.error("Transaction error:", txError);
          // Continue with remaining transactions
        }
      }

      if (successCount > 0) {
        setSuccess(
          `Successfully claimed from ${successCount} position${successCount > 1 ? "s" : ""}!`
        );
        // Refresh positions after successful claim
        setTimeout(() => {
          if (walletToQuery) {
            fetchPositions(walletToQuery);
          }
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

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-bags-dark border-4 border-bags-gold w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl ${isDismissing ? "modal-sheet-dismiss" : ""}`}
        onClick={(e) => e.stopPropagation()}
        {...swipeHandlers}
        style={{
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: translateY === 0 && !isDismissing ? "transform 0.2s ease" : undefined,
        }}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b-4 border-bags-gold sticky top-0 bg-bags-dark z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bags-gold/20 border border-bags-gold rounded flex items-center justify-center flex-shrink-0">
              <span className="font-pixel text-bags-gold text-[10px] sm:text-xs">$!</span>
            </div>
            <div>
              <h2 className="font-pixel text-xs sm:text-sm text-bags-gold">CLAIM FEES</h2>
              <p className="font-pixel text-[7px] sm:text-[8px] text-gray-400">
                Collect your earned trading fees
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs p-2 text-gray-400 hover:text-white touch-target border border-gray-700 hover:border-bags-gold rounded"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* X Authentication Section */}
          <div className="bg-bags-darker border border-bags-gold/30 p-3">
            {xUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {xUser.profileImage && (
                    <img
                      src={xUser.profileImage}
                      alt={xUser.name || xUser.username}
                      className="w-6 h-6 rounded-sm"
                    />
                  )}
                  <div>
                    <p className="font-pixel text-[10px] text-white">@{xUser.username}</p>
                    {linkedWallet && (
                      <p className="font-pixel text-[8px] text-gray-400">
                        Wallet: {shortenAddress(linkedWallet)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={xSignOut}
                  className="font-pixel text-[8px] text-gray-400 hover:text-white"
                >
                  [Sign Out]
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-pixel text-[8px] text-gray-400 mb-2">
                  Sign in with X to claim fees for your linked wallet
                </p>
                <button
                  onClick={xSignIn}
                  disabled={xAuthLoading}
                  className="btn-retro text-[10px] px-4 py-2"
                >
                  {xAuthLoading ? "CONNECTING..." : "SIGN IN WITH X"}
                </button>
              </div>
            )}
          </div>

          {/* X Auth Error */}
          {xAuthError && (
            <div className="bg-bags-red/20 border-2 border-bags-red p-2 flex justify-between items-center">
              <p className="font-pixel text-[8px] text-bags-red">{xAuthError}</p>
              <button
                onClick={clearXError}
                className="font-pixel text-[8px] text-bags-red hover:text-white"
              >
                [X]
              </button>
            </div>
          )}

          {/* Wallet Lookup Status */}
          {xUser && isLookingUpWallet && (
            <div className="text-center py-2">
              <p className="font-pixel text-[10px] text-bags-green animate-pulse">
                Looking up linked wallet...
              </p>
            </div>
          )}

          {/* Wallet Lookup Error */}
          {walletLookupError && (
            <div className="bg-bags-red/20 border-2 border-bags-red p-2">
              <p className="font-pixel text-[8px] text-bags-red">{walletLookupError}</p>
              <p className="font-pixel text-[8px] text-gray-400 mt-1">
                Link your wallet at{" "}
                <a
                  href="https://bags.fm/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bags-gold hover:underline"
                >
                  bags.fm/settings
                </a>
              </p>
            </div>
          )}

          {/* Wallet Mismatch Warning */}
          {linkedWallet && connected && publicKey && !walletMatches && (
            <div className="bg-yellow-500/20 border-2 border-yellow-500 p-2">
              <p className="font-pixel text-[8px] text-yellow-400">
                Connected wallet does not match your X-linked wallet.
              </p>
              <p className="font-pixel text-[8px] text-gray-400 mt-1">
                Connect {shortenAddress(linkedWallet)} to claim.
              </p>
            </div>
          )}

          {/* Not signed in with X and no wallet connected */}
          {!xUser && !connected ? (
            <div className="text-center py-4">
              <p className="font-pixel text-[10px] text-gray-400 mb-2">
                Or connect your wallet directly
              </p>
              <button onClick={() => setWalletModalVisible(true)} className="btn-retro">
                CONNECT WALLET
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <p className="font-pixel text-[10px] text-bags-green animate-pulse">
                Loading positions...
              </p>
            </div>
          ) : !walletToQuery ? (
            <div className="text-center py-4">
              <p className="font-pixel text-[10px] text-gray-400">
                Sign in with X or connect a wallet to view fees
              </p>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-pixel text-[10px] text-gray-400">No claimable fees found</p>
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
                          className={`w-3 h-3 border-2 flex-shrink-0 ${
                            selectedPositions.has(position.virtualPool)
                              ? "border-bags-gold bg-bags-gold"
                              : "border-gray-500"
                          }`}
                        />
                        {position.tokenLogoUrl ? (
                          <img
                            src={position.tokenLogoUrl}
                            alt={position.tokenSymbol || "Token"}
                            className="w-6 h-6 rounded-sm flex-shrink-0"
                            onError={(e) => {
                              // Hide broken images
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-6 h-6 bg-bags-gold/20 rounded-sm flex items-center justify-center flex-shrink-0">
                            <span className="font-pixel text-[8px] text-bags-gold">
                              {position.tokenSymbol?.slice(0, 2) || "??"}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-pixel text-[10px] text-white">
                            ${position.tokenSymbol || position.baseMint?.slice(0, 6) || "Unknown"}
                          </p>
                          <p className="font-pixel text-[8px] text-gray-400">
                            Your share: {((position.userBps ?? 0) / 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-pixel text-[10px] text-bags-green">
                          {(position.claimableDisplayAmount ?? 0).toFixed(4)} SOL
                        </p>
                        {position.isMigrated && (
                          <p className="font-pixel text-[6px] text-blue-400">MIGRATED</p>
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
                    <span className="font-pixel text-[10px] text-gray-400">Selected Total:</span>
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
        {positions.length > 0 && (
          <div className="p-4 border-t border-bags-gold/30">
            {!connected ? (
              <button onClick={() => setWalletModalVisible(true)} className="w-full btn-retro">
                CONNECT WALLET TO CLAIM
              </button>
            ) : linkedWallet && !walletMatches ? (
              <button
                onClick={() => setWalletModalVisible(true)}
                className="w-full btn-retro bg-yellow-600 hover:bg-yellow-500"
              >
                SWITCH WALLET
              </button>
            ) : (
              <button
                onClick={() => guardAction(handleClaim)}
                disabled={isClaiming || selectedPositions.size === 0}
                className="w-full btn-retro disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClaiming ? "CLAIMING..." : `CLAIM ${selectedTotal.toFixed(4)} SOL`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
