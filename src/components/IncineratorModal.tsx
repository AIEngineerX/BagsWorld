"use client";

import { useState, useEffect, useRef } from "react";
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

// 8x8 circular coin pattern for PixelDissolve (1 = visible pixel)
const COIN_GRID = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 0, 0],
];

/* Pixel coin dissolve animation for Close / Close All operations */
function PixelDissolve({
  size = 48,
  playing = false,
  label,
}: {
  size?: number;
  playing?: boolean;
  label?: string;
}) {
  // Stable random values per pixel (direction, rotation, delay)
  const randoms = useRef<{ tx: number; ty: number; rot: number; delay: number }[]>([]);
  if (randoms.current.length === 0) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 60;
        randoms.current.push({
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          rot: (Math.random() - 0.5) * 720,
          delay: Math.random() * 0.4,
        });
      }
    }
  }

  const pxSize = size / 8;

  return (
    <div className="flex flex-col items-center gap-1" aria-label="Account closing animation">
      <div className="relative" style={{ width: size, height: size }}>
        {COIN_GRID.flatMap((row, r) =>
          row.map((on, c) => {
            if (!on) return null;
            const idx = r * 8 + c;
            const rand = randoms.current[idx];
            const isEdge =
              r === 0 ||
              r === 7 ||
              c === 0 ||
              c === 7 ||
              !COIN_GRID[r - 1]?.[c] ||
              !COIN_GRID[r + 1]?.[c];
            return (
              <div
                key={`${r}-${c}`}
                className={playing ? "pixel-dissolve-active" : ""}
                style={{
                  position: "absolute",
                  left: c * pxSize,
                  top: r * pxSize,
                  width: pxSize,
                  height: pxSize,
                  backgroundColor: isEdge ? "#22c55e" : "#4ade80",
                  ["--tx-end" as string]: `${rand.tx}px`,
                  ["--ty-end" as string]: `${rand.ty}px`,
                  ["--rotate" as string]: `${rand.rot}deg`,
                  animationDelay: playing ? `${rand.delay}s` : undefined,
                }}
              />
            );
          })
        )}
      </div>
      {label && <span className="text-green-400 text-xs font-pixel">{label}</span>}
      <style jsx>{`
        @keyframes pixelDissolve {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 1;
          }
          30% {
            transform: translate(0, 0) rotate(0deg) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx-end), var(--ty-end)) rotate(var(--rotate)) scale(0);
            opacity: 0;
          }
        }
        .pixel-dissolve-active {
          animation: pixelDissolve 1.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pixel-dissolve-active {
            animation: pixelDissolveFade 1.8s ease-in-out infinite;
          }
          @keyframes pixelDissolveFade {
            0%,
            30% {
              opacity: 1;
            }
            80%,
            100% {
              opacity: 0.2;
            }
          }
        }
      `}</style>
    </div>
  );
}

/* Pixel furnace animation for Burn operations */
function PixelFurnace({ size = 64, playing = false }: { size?: number; playing?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1" aria-label="Token burning animation">
      <div style={{ width: size, height: size }} className="relative">
        <svg viewBox="0 0 32 32" width={size} height={size} className="block">
          {/* Brick body */}
          <rect x="4" y="8" width="24" height="20" fill="#7f1d1d" />
          {/* Mortar lines */}
          <line x1="4" y1="12" x2="28" y2="12" stroke="#ea580c" strokeWidth="0.5" />
          <line x1="4" y1="16" x2="28" y2="16" stroke="#ea580c" strokeWidth="0.5" />
          <line x1="4" y1="20" x2="28" y2="20" stroke="#ea580c" strokeWidth="0.5" />
          <line x1="4" y1="24" x2="28" y2="24" stroke="#ea580c" strokeWidth="0.5" />
          <line x1="16" y1="8" x2="16" y2="12" stroke="#ea580c" strokeWidth="0.5" />
          <line x1="10" y1="12" x2="10" y2="16" stroke="#ea580c" strokeWidth="0.5" />
          <line x1="22" y1="12" x2="22" y2="16" stroke="#ea580c" strokeWidth="0.5" />

          {/* Interior void */}
          <rect x="8" y="12" width="16" height="12" fill="#0a0a0a" />

          {/* Flames - 3 layers */}
          <g className={playing ? "furnace-flames" : ""}>
            {/* Red outer */}
            <rect x="9" y="18" width="4" height="5" fill="#dc2626" />
            <rect x="19" y="17" width="4" height="6" fill="#dc2626" />
            <rect x="14" y="19" width="3" height="4" fill="#dc2626" />
            {/* Orange middle */}
            <rect x="10" y="16" width="3" height="6" fill="#ea580c" />
            <rect x="16" y="17" width="3" height="5" fill="#ea580c" />
            <rect x="20" y="15" width="3" height="7" fill="#ea580c" />
            {/* Yellow core */}
            <rect x="12" y="17" width="2" height="4" fill="#fbbf24" />
            <rect x="17" y="18" width="2" height="3" fill="#fbbf24" />
            {/* White hot center */}
            <rect x="14" y="20" width="4" height="2" fill="#fef3c7" />
          </g>

          {/* Token dropping in */}
          <g className={playing ? "furnace-token" : ""} opacity={playing ? 1 : 0}>
            <rect x="14" y="2" width="4" height="4" rx="1" fill="#4ade80" />
            <rect x="15" y="3" width="2" height="2" fill="#22c55e" />
          </g>

          {/* Door (left half + right half that opens) */}
          <rect x="8" y="12" width="7" height="12" fill="#1a1a1a" opacity="0.3" />
          <g className={playing ? "furnace-door" : ""}>
            <rect x="15" y="12" width="9" height="12" fill="#1a1a1a" />
            {/* Rivets */}
            <rect x="17" y="14" width="1" height="1" fill="#fbbf24" />
            <rect x="21" y="14" width="1" height="1" fill="#fbbf24" />
            <rect x="17" y="21" width="1" height="1" fill="#fbbf24" />
            <rect x="21" y="21" width="1" height="1" fill="#fbbf24" />
            {/* Handle */}
            <rect x="16" y="17" width="1" height="3" fill="#a8a29e" />
          </g>

          {/* Embers rising */}
          {playing && (
            <g>
              <rect
                className="furnace-ember furnace-ember-1"
                x="11"
                y="11"
                width="1"
                height="1"
                fill="#fbbf24"
              />
              <rect
                className="furnace-ember furnace-ember-2"
                x="15"
                y="10"
                width="1"
                height="1"
                fill="#f97316"
              />
              <rect
                className="furnace-ember furnace-ember-3"
                x="20"
                y="11"
                width="1"
                height="1"
                fill="#fde047"
              />
              <rect
                className="furnace-ember furnace-ember-4"
                x="13"
                y="9"
                width="1"
                height="1"
                fill="#ef4444"
              />
              <rect
                className="furnace-ember furnace-ember-5"
                x="18"
                y="10"
                width="1"
                height="1"
                fill="#fbbf24"
              />
              <rect
                className="furnace-ember furnace-ember-6"
                x="22"
                y="9"
                width="1"
                height="1"
                fill="#f97316"
              />
            </g>
          )}

          {/* Top frame */}
          <rect x="3" y="7" width="26" height="2" fill="#451a03" />
          <rect x="3" y="27" width="26" height="2" fill="#451a03" />
        </svg>
      </div>
      <style jsx>{`
        @keyframes doorOpen {
          0% {
            transform: scaleX(1);
          }
          25%,
          75% {
            transform: scaleX(0);
          }
          85% {
            transform: scaleX(1.05);
          }
          90% {
            transform: scaleX(0.97);
          }
          100% {
            transform: scaleX(1);
          }
        }
        @keyframes tokenDrop {
          0%,
          35% {
            transform: translateY(0);
            opacity: 1;
          }
          55% {
            transform: translateY(14px);
            opacity: 1;
          }
          60%,
          100% {
            transform: translateY(14px);
            opacity: 0;
          }
        }
        @keyframes flamesRoar {
          0%,
          30% {
            transform: scaleY(1);
            filter: brightness(1);
          }
          50% {
            transform: scaleY(1.3);
            filter: brightness(1.4);
          }
          75% {
            transform: scaleY(1.1);
            filter: brightness(1.2);
          }
          100% {
            transform: scaleY(1);
            filter: brightness(1);
          }
        }
        @keyframes emberRise {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(-10px);
            opacity: 0;
          }
        }
        .furnace-door {
          animation: doorOpen 3s ease-in-out infinite;
          transform-origin: right center;
        }
        .furnace-token {
          animation: tokenDrop 3s ease-in infinite;
        }
        .furnace-flames {
          animation: flamesRoar 3s ease-in-out infinite;
          transform-origin: bottom center;
        }
        .furnace-ember {
          animation: emberRise 1.5s ease-out infinite;
        }
        .furnace-ember-1 {
          animation-delay: 0s;
        }
        .furnace-ember-2 {
          animation-delay: 0.3s;
        }
        .furnace-ember-3 {
          animation-delay: 0.6s;
        }
        .furnace-ember-4 {
          animation-delay: 0.9s;
        }
        .furnace-ember-5 {
          animation-delay: 1.2s;
        }
        .furnace-ember-6 {
          animation-delay: 1.5s;
        }
        @media (prefers-reduced-motion: reduce) {
          .furnace-door,
          .furnace-token,
          .furnace-flames,
          .furnace-ember {
            animation: furnaceFade 3s ease-in-out infinite;
          }
          @keyframes furnaceFade {
            0%,
            40% {
              opacity: 1;
            }
            70%,
            100% {
              opacity: 0.5;
            }
          }
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

  // Animation state
  const [animPhase, setAnimPhase] = useState<"idle" | "dissolve" | "furnace">("idle");
  const [txProgress, setTxProgress] = useState({ current: 0, total: 0 });

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

  /** Single retry on Solana RPC rate-limit errors (-32429 / "max usage reached") */
  const withRpcRetry = async <T,>(fn: () => Promise<T>, label: string): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("max usage reached") || msg.includes("-32429")) {
        console.warn(`[Incinerator] ${label} rate limited, retrying in 3s`);
        await new Promise((r) => setTimeout(r, 3000));
        return await fn();
      }
      throw err;
    }
  };

  /** Decode, simulate, sign, send, and confirm a Sol Incinerator transaction. */
  const signAndSend = async (serializedTransaction: string): Promise<string> => {
    // Sol Incinerator API always returns base58-encoded transactions
    const buffer = bs58.decode(serializedTransaction.trim());
    const transaction = VersionedTransaction.deserialize(buffer);

    await withRpcRetry(() => preSimulateTransaction(connection, transaction), "Simulate");

    const signature = await mobileSignAndSend(transaction, { maxRetries: 3 });

    await withRpcRetry(() => connection.confirmTransaction(signature, "confirmed"), "Confirm");

    return signature;
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
    setAnimPhase("furnace");
    try {
      const result: BurnResponse = await apiRequest("burn", {
        userPublicKey: publicKey.toBase58(),
        assetId: assetId.trim(),
      });
      const txid = await signAndSend(result.serializedTransaction);
      setSuccess(
        `Burned! Reclaimed ${result.solanaReclaimed.toFixed(4)} SOL. TX: ${txid.slice(0, 12)}...`
      );
      setAssetId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Burn failed");
    } finally {
      setIsLoading(false);
      setAnimPhase("idle");
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
    setAnimPhase("dissolve");
    try {
      const result: CloseResponse = await apiRequest("close", {
        userPublicKey: publicKey.toBase58(),
        assetId: assetId.trim(),
      });
      const txid = await signAndSend(result.serializedTransaction);
      setSuccess(
        `Closed! Reclaimed ${result.solanaReclaimed.toFixed(4)} SOL. TX: ${txid.slice(0, 12)}...`
      );
      setAssetId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close failed");
    } finally {
      setIsLoading(false);
      setAnimPhase("idle");
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
    setAnimPhase("dissolve");
    try {
      const result: BatchCloseAllResponse = await apiRequest("batch-close-all", {
        userPublicKey: publicKey.toBase58(),
      });

      if (result.accountsClosed === 0) {
        setSuccess("No empty accounts found to close.");
        return;
      }

      setTxProgress({ current: 0, total: result.transactions.length });

      let completed = 0;
      for (const serializedTx of result.transactions) {
        await signAndSend(serializedTx);
        completed++;
        setTxProgress({ current: completed, total: result.transactions.length });
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
      setAnimPhase("idle");
      setTxProgress({ current: 0, total: 0 });
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
            &bull; pNFT Editions &bull; MPL Core
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
                        <>
                          {isLoading && animPhase === "dissolve" && (
                            <div className="flex flex-col items-center py-2">
                              <PixelDissolve
                                size={48}
                                playing
                                label={
                                  txProgress.total > 0
                                    ? `${txProgress.current}/${txProgress.total} accounts`
                                    : "Preparing..."
                                }
                              />
                            </div>
                          )}
                          <button
                            onClick={() => guardAction(handleCloseAll)}
                            disabled={isLoading}
                            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-900 text-white py-3 rounded font-pixel text-sm"
                          >
                            {isLoading
                              ? "SIGNING TRANSACTIONS..."
                              : `CLOSE ALL & RECLAIM ${closeAllPreview.totalSolanaReclaimed.toFixed(4)} SOL`}
                          </button>
                        </>
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

                  {isLoading && animPhase === "furnace" && (
                    <div className="flex flex-col items-center py-2">
                      <PixelFurnace size={64} playing />
                      <span className="text-red-400 text-xs font-pixel mt-1">Incinerating...</span>
                    </div>
                  )}

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

                  {isLoading && animPhase === "dissolve" && (
                    <div className="flex flex-col items-center py-2">
                      <PixelDissolve size={48} playing label="Closing Account..." />
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
