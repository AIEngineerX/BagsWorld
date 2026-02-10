"use client";

import { useState, useEffect } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useActionGuard } from "@/hooks/useActionGuard";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { useMobileWallet } from "@/hooks/useMobileWallet";
import { preSimulateTransaction } from "@/lib/transaction-utils";
import type {
  BurnResponse,
  CloseResponse,
  BatchCloseAllResponse,
  BurnPreviewResponse,
  ClosePreviewResponse,
  BatchCloseAllPreviewResponse,
} from "@/lib/sol-incinerator";

interface IncineratorModalProps {
  onClose: () => void;
}

type Tab = "burn" | "close" | "close-all";

/* Animated pixel fire for the header */
function PixelFire({ size = 28, burning = false }: { size?: number; burning?: boolean }) {
  return (
    <div
      className={`relative ${burning ? "animate-pulse" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 16 16" width={size} height={size} className="block">
        {/* Outer flame (orange) */}
        <rect x="5" y="1" width="2" height="1" fill="#f97316" className="animate-flicker-fast" />
        <rect x="9" y="1" width="2" height="1" fill="#f97316" className="animate-flicker-fast" />
        <rect x="4" y="2" width="4" height="1" fill="#f97316" />
        <rect x="8" y="2" width="4" height="1" fill="#f97316" />
        <rect x="3" y="3" width="10" height="2" fill="#f97316" />
        <rect x="3" y="5" width="10" height="2" fill="#ef4444" />
        {/* Core flame (yellow) */}
        <rect x="5" y="3" width="6" height="2" fill="#fbbf24" />
        <rect x="6" y="2" width="4" height="2" fill="#fde047" />
        <rect x="5" y="5" width="6" height="2" fill="#fbbf24" />
        {/* Inner white-hot core */}
        <rect x="7" y="4" width="2" height="2" fill="#fef3c7" />
        {/* Base (dark red embers) */}
        <rect x="2" y="7" width="12" height="2" fill="#dc2626" />
        <rect x="3" y="9" width="10" height="2" fill="#991b1b" />
        {/* Embers/ash at base */}
        <rect x="4" y="11" width="8" height="1" fill="#78350f" />
        <rect x="5" y="12" width="6" height="1" fill="#451a03" />
        {/* Green glow (incinerator brand) */}
        <rect x="6" y="7" width="4" height="1" fill="#22c55e" opacity="0.6" />
      </svg>
      <style jsx>{`
        @keyframes flicker {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        .animate-flicker-fast {
          animation: flicker 0.3s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
}

export function IncineratorModal({ onClose }: IncineratorModalProps) {
  const { publicKey, connected, mobileSignAndSend } = useMobileWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { connection } = useConnection();
  const guardAction = useActionGuard();

  const [activeTab, setActiveTab] = useState<Tab>("close-all");
  const [assetId, setAssetId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [burnConfirmed, setBurnConfirmed] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  // Preview state
  const [burnPreview, setBurnPreview] = useState<BurnPreviewResponse | null>(null);
  const [closePreview, setClosePreview] = useState<ClosePreviewResponse | null>(null);
  const [closeAllPreview, setCloseAllPreview] = useState<BatchCloseAllPreviewResponse | null>(null);

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

  // Check API health on mount
  useEffect(() => {
    fetch("/api/sol-incinerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status" }),
    })
      .then((r) => setApiOnline(r.ok))
      .catch(() => setApiOnline(false));
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const resetState = () => {
    setError(null);
    setSuccess(null);
    setBurnPreview(null);
    setClosePreview(null);
    setCloseAllPreview(null);
    setBurnConfirmed(false);
  };

  const apiRequest = async (action: string, data?: Record<string, unknown>) => {
    const response = await fetch("/api/sol-incinerator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json();
  };

  const signAndSend = async (serializedTransaction: string) => {
    const txString = serializedTransaction.trim().replace(/\s/g, "");
    const isLikelyBase64 =
      txString.includes("+") || txString.includes("/") || txString.endsWith("=");

    let buffer: Uint8Array;
    try {
      buffer = isLikelyBase64 ? Buffer.from(txString, "base64") : bs58.decode(txString);
      if (buffer.length < 50) throw new Error("Buffer too small");
    } catch {
      // Try the other encoding
      buffer = isLikelyBase64 ? bs58.decode(txString) : Buffer.from(txString, "base64");
    }

    const transaction = VersionedTransaction.deserialize(buffer);

    // Pre-simulate to catch errors before wallet popup
    await preSimulateTransaction(connection, transaction);

    // Use signAndSendTransaction — Phantom's recommended method.
    // Sol Incinerator txs are unsigned (single-signer), so this is safe.
    const signature = await mobileSignAndSend(transaction, { maxRetries: 3 });

    // Wait for confirmation
    await connection.confirmTransaction(signature, "confirmed");

    return { txid: signature };
  };

  // --- Handlers ---

  const handleBurnPreview = async () => {
    if (!connected || !publicKey) return;
    if (!assetId.trim()) {
      setError("Enter a token mint or account address");
      return;
    }
    resetState();
    setIsLoading(true);
    try {
      const preview: BurnPreviewResponse = await apiRequest("burn-preview", {
        userPublicKey: publicKey.toBase58(),
        assetId: assetId.trim(),
      });
      setBurnPreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBurn = async () => {
    if (!connected || !publicKey) return;
    if (!assetId.trim()) {
      setError("Enter a token mint or account address");
      return;
    }
    if (!burnConfirmed) {
      setError("You must confirm that you understand this action is irreversible");
      return;
    }
    resetState();
    setBurnConfirmed(false);
    setIsLoading(true);
    try {
      const result: BurnResponse = await apiRequest("burn", {
        userPublicKey: publicKey.toBase58(),
        assetId: assetId.trim(),
      });
      const txResult = await signAndSend(result.serializedTransaction);
      setSuccess(
        `Burned! Reclaimed ${result.solanaReclaimed.toFixed(4)} SOL. TX: ${txResult.txid?.slice(0, 12)}...`
      );
      setAssetId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Burn failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClosePreview = async () => {
    if (!connected || !publicKey) return;
    if (!assetId.trim()) {
      setError("Enter a token account address");
      return;
    }
    resetState();
    setIsLoading(true);
    try {
      const preview: ClosePreviewResponse = await apiRequest("close-preview", {
        userPublicKey: publicKey.toBase58(),
        assetId: assetId.trim(),
      });
      setClosePreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = async () => {
    if (!connected || !publicKey) return;
    if (!assetId.trim()) {
      setError("Enter a token account address");
      return;
    }
    resetState();
    setIsLoading(true);
    try {
      const result: CloseResponse = await apiRequest("close", {
        userPublicKey: publicKey.toBase58(),
        assetId: assetId.trim(),
      });
      const txResult = await signAndSend(result.serializedTransaction);
      setSuccess(
        `Closed! Reclaimed ${result.solanaReclaimed.toFixed(4)} SOL. TX: ${txResult.txid?.slice(0, 12)}...`
      );
      setAssetId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseAllPreview = async () => {
    if (!connected || !publicKey) return;
    resetState();
    setIsLoading(true);
    try {
      const preview: BatchCloseAllPreviewResponse = await apiRequest("batch-close-all-preview", {
        userPublicKey: publicKey.toBase58(),
      });
      setCloseAllPreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseAll = async () => {
    if (!connected || !publicKey) return;
    resetState();
    setIsLoading(true);
    try {
      const result: BatchCloseAllResponse = await apiRequest("batch-close-all", {
        userPublicKey: publicKey.toBase58(),
      });

      if (result.accountsClosed === 0) {
        setSuccess("No empty accounts found to close.");
        return;
      }

      let completed = 0;
      for (const serializedTx of result.transactions) {
        await signAndSend(serializedTx);
        completed++;
        setSuccess(`Processing: ${completed}/${result.transactions.length} transactions signed...`);
      }

      setSuccess(
        `Done! Closed ${result.accountsClosed} accounts, reclaimed ${result.totalSolanaReclaimed.toFixed(4)} SOL`
      );
      setCloseAllPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch close failed");
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; color: string }[] = [
    { id: "close-all", label: "CLOSE ALL", color: "#4ade80" },
    { id: "burn", label: "BURN", color: "#ef4444" },
    { id: "close", label: "CLOSE", color: "#22c55e" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0a1a0a] border border-green-500/30 rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-green-500/20">
          <div className="flex items-center gap-2">
            <PixelFire size={32} burning={isLoading && activeTab === "burn"} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-green-400 font-bold text-lg font-pixel">SOL INCINERATOR</h2>
                {apiOnline !== null && (
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${apiOnline ? "bg-green-400 shadow-[0_0_4px_#4ade80]" : "bg-red-500 shadow-[0_0_4px_#ef4444]"}`}
                    title={apiOnline ? "API online" : "API offline"}
                  />
                )}
              </div>
              <p className="text-green-700 text-xs">
                Burn tokens & reclaim SOL from empty accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-green-700 hover:text-green-400 text-xl px-2 w-11 h-11 flex items-center justify-center"
          >
            x
          </button>
        </div>

        {/* Supported Assets Info */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-green-800 text-[10px] font-pixel">
            SUPPORTS: SPL Tokens &bull; Token-2022 &bull; Metaplex NFTs &bull; pNFTs &bull; Editions
            &bull; pNFT Editions &bull; MPL Core &bull; Magic Eden OCP
          </p>
          <p className="text-green-900/60 text-[9px] font-pixel mt-0.5">
            NOT SUPPORTED: Bubblegum cNFTs &bull; Frozen tokens (must thaw first)
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-green-900/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                resetState();
              }}
              className={`flex-1 min-h-[44px] py-3 text-xs font-pixel font-bold transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 text-white"
                  : "text-green-800 hover:text-green-500"
              }`}
              style={{
                borderColor: activeTab === tab.id ? tab.color : "transparent",
                color: activeTab === tab.id ? tab.color : undefined,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!connected ? (
            <div className="text-center py-8">
              <p className="text-green-600 mb-4 text-sm">
                Connect your wallet to use the Incinerator
              </p>
              <button
                onClick={() => setWalletModalVisible(true)}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-pixel text-sm"
              >
                CONNECT WALLET
              </button>
            </div>
          ) : (
            <>
              {/* Close All Tab */}
              {activeTab === "close-all" && (
                <div className="space-y-4">
                  <div className="bg-green-900/20 border border-green-500/20 rounded p-3">
                    <p className="text-green-400 text-xs font-bold mb-1">SAFE OPERATION</p>
                    <p className="text-green-600 text-xs">
                      Closes all empty token accounts in your wallet and returns the rent SOL back
                      to you. ~0.002 SOL per account. No tokens are destroyed.
                    </p>
                  </div>

                  {!closeAllPreview ? (
                    <button
                      onClick={handleCloseAllPreview}
                      disabled={isLoading}
                      className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-900 text-white py-3 rounded font-pixel text-sm"
                    >
                      {isLoading ? "SCANNING..." : "SCAN EMPTY ACCOUNTS"}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-[#0d2b0d] rounded p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Empty accounts:</span>
                          <span className="text-green-300 font-bold">
                            {closeAllPreview.accountsToClose}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">SOL to reclaim:</span>
                          <span className="text-green-400 font-bold">
                            {closeAllPreview.totalSolanaReclaimed.toFixed(4)} SOL
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Transactions needed:</span>
                          <span className="text-green-300">
                            {closeAllPreview.estimatedTransactions}
                          </span>
                        </div>
                        {closeAllPreview.summary && (
                          <div className="border-t border-green-900/50 pt-2 mt-2">
                            <p className="text-green-700 text-xs mb-1">Breakdown:</p>
                            <div className="text-xs space-y-1">
                              {closeAllPreview.summary.standardTokenAccounts > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-green-600">Standard token accounts:</span>
                                  <span className="text-green-300">
                                    {closeAllPreview.summary.standardTokenAccounts}
                                  </span>
                                </div>
                              )}
                              {closeAllPreview.summary.token2022Accounts > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-green-600">Token-2022 accounts:</span>
                                  <span className="text-green-300">
                                    {closeAllPreview.summary.token2022Accounts}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {closeAllPreview.accountsToClose > 0 ? (
                        <button
                          onClick={() => guardAction(handleCloseAll)}
                          disabled={isLoading}
                          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-900 text-white py-3 rounded font-pixel text-sm"
                        >
                          {isLoading
                            ? "SIGNING TRANSACTIONS..."
                            : `CLOSE ALL & RECLAIM ${closeAllPreview.totalSolanaReclaimed.toFixed(4)} SOL`}
                        </button>
                      ) : (
                        <p className="text-green-700 text-center text-sm">
                          No empty accounts found.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Burn Tab */}
              {activeTab === "burn" && (
                <div className="space-y-4">
                  <div className="bg-red-900/20 border border-red-500/20 rounded p-3">
                    <p className="text-red-400 text-xs font-bold mb-1">
                      DESTRUCTIVE - IRREVERSIBLE
                    </p>
                    <p className="text-red-300/70 text-xs">
                      Permanently destroys a token or NFT and reclaims the account rent. This action
                      CANNOT be undone. Your asset will be gone forever.
                    </p>
                  </div>

                  <div>
                    <label className="text-green-600 text-xs mb-1 block">
                      Token Mint or Account Address
                    </label>
                    <input
                      type="text"
                      value={assetId}
                      onChange={(e) => setAssetId(e.target.value)}
                      placeholder="Enter mint address or token account..."
                      className="w-full bg-[#0d2b0d] border border-green-900 rounded px-3 py-2 text-green-300 text-sm font-mono focus:border-green-500 focus:outline-none placeholder:text-green-900"
                    />
                  </div>

                  {burnPreview && (
                    <div className="bg-[#0d2b0d] rounded p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Type:</span>
                        <span className="text-green-300">{burnPreview.transactionType}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">SOL to reclaim:</span>
                        <span className="text-green-400 font-bold">
                          {burnPreview.solanaReclaimed.toFixed(4)} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Destructive:</span>
                        <span
                          className={
                            burnPreview.isDestructiveAction ? "text-red-400" : "text-green-400"
                          }
                        >
                          {burnPreview.isDestructiveAction ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Burn confirmation checkbox */}
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={burnConfirmed}
                      onChange={(e) => setBurnConfirmed(e.target.checked)}
                      className="mt-0.5 accent-red-500"
                    />
                    <span className="text-red-400/80 text-xs">
                      I understand this is irreversible and my asset will be permanently destroyed
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={handleBurnPreview}
                      disabled={isLoading || !assetId.trim()}
                      className="flex-1 bg-green-900 hover:bg-green-800 disabled:bg-green-950 text-green-300 py-2 rounded font-pixel text-xs"
                    >
                      {isLoading ? "..." : "PREVIEW"}
                    </button>
                    <button
                      onClick={() => guardAction(handleBurn)}
                      disabled={isLoading || !assetId.trim() || !burnConfirmed}
                      className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-red-900/50 disabled:text-red-400/50 text-white py-2 rounded font-pixel text-xs"
                    >
                      {isLoading ? "BURNING..." : "BURN"}
                    </button>
                  </div>
                </div>
              )}

              {/* Close Tab */}
              {activeTab === "close" && (
                <div className="space-y-4">
                  <div className="bg-green-900/20 border border-green-500/20 rounded p-3">
                    <p className="text-green-400 text-xs font-bold mb-1">SAFE OPERATION</p>
                    <p className="text-green-600 text-xs">
                      Close a single empty token account and reclaim ~0.002 SOL rent. Account must
                      have zero balance.
                    </p>
                  </div>

                  <div>
                    <label className="text-green-600 text-xs mb-1 block">
                      Token Account Address
                    </label>
                    <input
                      type="text"
                      value={assetId}
                      onChange={(e) => setAssetId(e.target.value)}
                      placeholder="Enter token account address..."
                      className="w-full bg-[#0d2b0d] border border-green-900 rounded px-3 py-2 text-green-300 text-sm font-mono focus:border-green-500 focus:outline-none placeholder:text-green-900"
                    />
                  </div>

                  {closePreview && (
                    <div className="bg-[#0d2b0d] rounded p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Type:</span>
                        <span className="text-green-300">{closePreview.transactionType}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">SOL to reclaim:</span>
                        <span className="text-green-400 font-bold">
                          {closePreview.solanaReclaimed.toFixed(4)} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Destructive:</span>
                        <span className="text-green-400">NO</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleClosePreview}
                      disabled={isLoading || !assetId.trim()}
                      className="flex-1 bg-green-900 hover:bg-green-800 disabled:bg-green-950 text-green-300 py-2 rounded font-pixel text-xs"
                    >
                      {isLoading ? "..." : "PREVIEW"}
                    </button>
                    <button
                      onClick={() => guardAction(handleClose)}
                      disabled={isLoading || !assetId.trim()}
                      className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-green-900 text-white py-2 rounded font-pixel text-xs"
                    >
                      {isLoading ? "CLOSING..." : "CLOSE"}
                    </button>
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {error && (
                <div className="bg-red-900/30 border border-red-500/30 rounded p-3">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}
              {success && (
                <div className="bg-green-900/30 border border-green-500/30 rounded p-3">
                  <p className="text-green-400 text-xs">{success}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-green-900/50 p-3 space-y-1">
          <p className="text-green-700 text-center text-[10px]">
            Powered by <span className="text-green-500 font-pixel">Sol Incinerator</span> &bull;
            Transactions signed by your wallet
          </p>
          <p className="text-green-900 text-center text-[9px]">
            Accounts ~0.002 SOL each &bull; NFT rent varies by metadata size
          </p>
          <p className="text-yellow-700/60 text-center text-[9px]">
            Sol Incinerator charges a 2-5% fee on reclaimed SOL
          </p>
        </div>
      </div>
    </div>
  );
}
