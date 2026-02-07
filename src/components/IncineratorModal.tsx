"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import type {
  BurnResponse,
  CloseResponse,
  BatchCloseAllResponse,
  BurnPreviewResponse,
  BatchCloseAllPreviewResponse,
} from "@/lib/sol-incinerator";

interface IncineratorModalProps {
  onClose: () => void;
}

type Tab = "burn" | "close" | "close-all";

export function IncineratorModal({ onClose }: IncineratorModalProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [activeTab, setActiveTab] = useState<Tab>("close-all");
  const [assetId, setAssetId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Preview state
  const [burnPreview, setBurnPreview] = useState<BurnPreviewResponse | null>(null);
  const [closeAllPreview, setCloseAllPreview] = useState<BatchCloseAllPreviewResponse | null>(null);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const resetState = () => {
    setError(null);
    setSuccess(null);
    setBurnPreview(null);
    setCloseAllPreview(null);
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
    if (!signTransaction) {
      throw new Error("Wallet does not support transaction signing");
    }

    const txBytes = Uint8Array.from(
      atob(serializedTransaction.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    // Try base58 decode first (API returns base58)
    let transaction: VersionedTransaction;
    try {
      // base58 decode
      const bs58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      let decoded = BigInt(0);
      for (const char of serializedTransaction) {
        const index = bs58Chars.indexOf(char);
        if (index === -1) throw new Error("not base58");
        decoded = decoded * BigInt(58) + BigInt(index);
      }
      const hex = decoded.toString(16).padStart(2, "0");
      const bytes = new Uint8Array((hex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)));
      transaction = VersionedTransaction.deserialize(bytes);
    } catch {
      // Fallback: try raw bytes
      transaction = VersionedTransaction.deserialize(txBytes);
    }

    const signedTx = await signTransaction(transaction);
    const serialized = Buffer.from(signedTx.serialize()).toString("base64");

    const result = await fetch("/api/send-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedTransaction: serialized }),
    });

    if (!result.ok) {
      const err = await result.json();
      throw new Error(err.error || "Transaction failed");
    }

    return result.json();
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
    resetState();
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
    { id: "burn", label: "BURN", color: "#f97316" },
    { id: "close", label: "CLOSE", color: "#38bdf8" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0a0a0f] border border-orange-500/30 rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-orange-500/20">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <h2 className="text-orange-400 font-bold text-lg font-pixel">SOL INCINERATOR</h2>
              <p className="text-gray-500 text-xs">Burn tokens & reclaim SOL from empty accounts</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl px-2">
            x
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                resetState();
              }}
              className={`flex-1 py-3 text-xs font-pixel font-bold transition-colors ${
                activeTab === tab.id ? "border-b-2 text-white" : "text-gray-500 hover:text-gray-300"
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
              <p className="text-gray-400 mb-4 text-sm">
                Connect your wallet to use the Incinerator
              </p>
              <button
                onClick={() => setWalletModalVisible(true)}
                className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded font-pixel text-sm"
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
                    <p className="text-gray-400 text-xs">
                      Closes all empty token accounts in your wallet and returns the rent SOL back
                      to you. ~0.002 SOL per account. No tokens are destroyed.
                    </p>
                  </div>

                  {!closeAllPreview ? (
                    <button
                      onClick={handleCloseAllPreview}
                      disabled={isLoading}
                      className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white py-3 rounded font-pixel text-sm"
                    >
                      {isLoading ? "SCANNING..." : "SCAN EMPTY ACCOUNTS"}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-gray-900 rounded p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Empty accounts:</span>
                          <span className="text-white font-bold">
                            {closeAllPreview.accountsToClose}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">SOL to reclaim:</span>
                          <span className="text-green-400 font-bold">
                            {closeAllPreview.totalSolanaReclaimed.toFixed(4)} SOL
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Transactions needed:</span>
                          <span className="text-white">
                            {closeAllPreview.estimatedTransactions}
                          </span>
                        </div>
                        {closeAllPreview.summary && (
                          <div className="border-t border-gray-700 pt-2 mt-2">
                            <p className="text-gray-500 text-xs mb-1">Breakdown:</p>
                            <div className="text-xs space-y-1">
                              {closeAllPreview.summary.standardTokenAccounts > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Standard token accounts:</span>
                                  <span className="text-white">
                                    {closeAllPreview.summary.standardTokenAccounts}
                                  </span>
                                </div>
                              )}
                              {closeAllPreview.summary.token2022Accounts > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Token-2022 accounts:</span>
                                  <span className="text-white">
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
                          onClick={handleCloseAll}
                          disabled={isLoading}
                          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white py-3 rounded font-pixel text-sm"
                        >
                          {isLoading
                            ? "SIGNING TRANSACTIONS..."
                            : `CLOSE ALL & RECLAIM ${closeAllPreview.totalSolanaReclaimed.toFixed(4)} SOL`}
                        </button>
                      ) : (
                        <p className="text-gray-500 text-center text-sm">
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
                    <p className="text-gray-400 text-xs">
                      Permanently destroys a token or NFT and reclaims the account rent. This cannot
                      be undone.
                    </p>
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      Token Mint or Account Address
                    </label>
                    <input
                      type="text"
                      value={assetId}
                      onChange={(e) => setAssetId(e.target.value)}
                      placeholder="Enter mint address or token account..."
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  {burnPreview && (
                    <div className="bg-gray-900 rounded p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Type:</span>
                        <span className="text-white">{burnPreview.transactionType}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">SOL to reclaim:</span>
                        <span className="text-green-400 font-bold">
                          {burnPreview.solanaReclaimed.toFixed(4)} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Destructive:</span>
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

                  <div className="flex gap-2">
                    <button
                      onClick={handleBurnPreview}
                      disabled={isLoading || !assetId.trim()}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white py-2 rounded font-pixel text-xs"
                    >
                      {isLoading ? "..." : "PREVIEW"}
                    </button>
                    <button
                      onClick={handleBurn}
                      disabled={isLoading || !assetId.trim()}
                      className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white py-2 rounded font-pixel text-xs"
                    >
                      {isLoading ? "BURNING..." : "BURN"}
                    </button>
                  </div>
                </div>
              )}

              {/* Close Tab */}
              {activeTab === "close" && (
                <div className="space-y-4">
                  <div className="bg-blue-900/20 border border-blue-500/20 rounded p-3">
                    <p className="text-blue-400 text-xs font-bold mb-1">SAFE OPERATION</p>
                    <p className="text-gray-400 text-xs">
                      Close a single empty token account and reclaim ~0.002 SOL rent. Account must
                      have zero balance.
                    </p>
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      Token Account Address
                    </label>
                    <input
                      type="text"
                      value={assetId}
                      onChange={(e) => setAssetId(e.target.value)}
                      placeholder="Enter token account address..."
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleClose}
                    disabled={isLoading || !assetId.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white py-3 rounded font-pixel text-sm"
                  >
                    {isLoading ? "CLOSING..." : "CLOSE ACCOUNT"}
                  </button>
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
        <div className="border-t border-gray-800 p-3">
          <p className="text-gray-600 text-center text-[10px]">
            Powered by Sol Incinerator API &bull; Transactions signed by your wallet
          </p>
        </div>
      </div>
    </div>
  );
}
