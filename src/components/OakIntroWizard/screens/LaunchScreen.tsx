"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { ScreenProps } from "../types";
import { DIALOGUE } from "../constants";
import { DialogueBox } from "../DialogueBox";
import { OakSprite } from "../PixelSprites";

/* ─── Sub-screen: Wallet Connect ─── */
function WalletConnectView({ onAdvance }: Pick<ScreenProps, "onAdvance">) {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [showDialogue, setShowDialogue] = useState(false);

  // If already connected, auto-advance after a brief message
  useEffect(() => {
    if (connected) {
      const timer = setTimeout(() => setShowDialogue(true), 300);
      return () => clearTimeout(timer);
    }
  }, [connected]);

  // Watch for wallet connection
  useEffect(() => {
    if (connected && showDialogue) {
      // Give the dialogue a moment to show before advancing
    }
  }, [connected, showDialogue]);

  const handleConnectClick = () => {
    setVisible(true);
  };

  if (connected) {
    return (
      <div
        className="absolute inset-0 bg-gray-900 flex flex-col items-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-gray-800" />
        <div className="relative z-[5] mt-[15%] sm:mt-[10%]">
          <OakSprite className="scale-[2] sm:scale-[2.5]" />
        </div>
        {showDialogue && (
          <DialogueBox
            lines={["I see you're already equipped! Your wallet is connected."]}
            speakerName="PROF. OAK"
            onComplete={onAdvance}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 bg-gray-900 flex flex-col items-center overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-gray-800" />

      <div className="relative z-[5] mt-[15%] sm:mt-[10%]">
        <OakSprite className="scale-[2] sm:scale-[2.5]" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <div className="bg-black/95 border-2 border-white rounded-lg p-3 mx-2 mb-2">
          <p className="font-pixel text-[11px] text-white leading-relaxed mb-3">
            You&apos;ll need a Solana wallet for this adventure!
          </p>
          <button
            type="button"
            className="w-full font-pixel text-[10px] text-black bg-bags-green hover:bg-green-400 py-2 rounded cursor-pointer transition-colors"
            onClick={handleConnectClick}
          >
            [CONNECT WALLET]
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-screen: Launch Review ─── */
function LaunchReviewView({
  state,
  dispatch,
}: Pick<ScreenProps, "state" | "dispatch">) {
  const handleLaunch = () => {
    dispatch({ type: "SET_SCREEN", screen: "launching" });
  };

  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center px-4 pt-4 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {/* Trainer card style header */}
      <div className="w-full max-w-[340px] bg-gray-900 border-2 border-bags-green rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-2 border-b border-gray-700 pb-2">
          <span className="font-pixel text-[8px] text-bags-gold">TRAINER CARD</span>
          <span className="font-pixel text-[8px] text-gray-500 ml-auto">{state.creatorName}</span>
        </div>

        <div className="flex gap-3">
          {/* Token image */}
          <div className="w-16 h-16 rounded border border-gray-600 overflow-hidden flex-shrink-0 bg-gray-800">
            {state.tokenImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.tokenImageUrl}
                alt={state.tokenName}
                className="w-full h-full object-cover"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-pixel text-[8px] text-gray-600">
                ?
              </div>
            )}
          </div>

          {/* Token info */}
          <div className="flex-1 min-w-0">
            <p className="font-pixel text-[11px] text-white truncate">{state.tokenName}</p>
            <p className="font-pixel text-[9px] text-bags-gold">${state.tokenSymbol}</p>
            <p className="font-pixel text-[8px] text-gray-400 mt-1 line-clamp-2">
              {state.tokenDescription}
            </p>
          </div>
        </div>

        {/* Social links if set */}
        {(state.tokenTwitter || state.tokenWebsite) && (
          <div className="mt-2 pt-2 border-t border-gray-700 space-y-0.5">
            {state.tokenTwitter && (
              <p className="font-pixel text-[7px] text-gray-400 truncate">
                X: <span className="text-gray-300">{state.tokenTwitter}</span>
              </p>
            )}
            {state.tokenWebsite && (
              <p className="font-pixel text-[7px] text-gray-400 truncate">
                Web: <span className="text-gray-300">{state.tokenWebsite}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Fee share breakdown */}
      <div className="w-full max-w-[340px] bg-gray-900 border border-gray-700 rounded-lg p-3 mb-3">
        <div className="flex justify-between items-center mb-2">
          <p className="font-pixel text-[8px] text-bags-gold">FEE CLAIMERS</p>
          <span className="font-pixel text-[6px] text-gray-500">PERMANENT</span>
        </div>
        {state.feeShares.length > 0 ? (
          state.feeShares.map((share, i) => (
            <div key={i} className="flex justify-between font-pixel text-[9px] mb-1">
              <span className="text-gray-400">
                {share.provider === "self"
                  ? "You (creator)"
                  : `${share.provider}/@${share.username}`}
              </span>
              <span className="text-white">{(share.bps / 100).toFixed(0)}%</span>
            </div>
          ))
        ) : (
          <p className="font-pixel text-[8px] text-gray-500">100% to creator (default)</p>
        )}
      </div>

      {/* Initial buy SOL */}
      <div className="w-full max-w-[340px] mb-3">
        <label className="font-pixel text-[9px] text-gray-400 mb-1 block">
          Initial Buy (SOL) - optional
        </label>
        <input
          type="number"
          value={state.initialBuySOL}
          onChange={(e) => dispatch({ type: "SET_INITIAL_BUY", amount: e.target.value })}
          placeholder="0"
          min="0"
          step="0.1"
          className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[10px] px-3 py-2 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Oak quote */}
      <p className="font-pixel text-[8px] text-bags-gold text-center mb-3 px-4 max-w-[340px]">
        &quot;Your very own TOKEN legend is about to unfold!&quot;
      </p>

      {/* Launch button */}
      <button
        type="button"
        className="font-pixel text-sm text-black bg-bags-green hover:bg-green-400 px-8 py-3 rounded cursor-pointer transition-colors mb-4"
        style={{
          animation: "launchPulse 1.5s ease-in-out infinite",
        }}
        onClick={handleLaunch}
      >
        [LAUNCH!]
      </button>

      <style jsx>{`
        @keyframes launchPulse {
          0%,
          100% {
            box-shadow: 0 0 8px #22c55e;
            transform: scale(1);
          }
          50% {
            box-shadow:
              0 0 20px #22c55e,
              0 0 40px #16a34a;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}

/* ─── Sub-screen: Launching ─── */
function LaunchingView({ state, dispatch }: Pick<ScreenProps, "state" | "dispatch">) {
  const phaseLabels = DIALOGUE.launching;
  const totalPhases = 3;
  const progressPercent = Math.min(((state.launchPhase + 1) / totalPhases) * 100, 100);

  const handleRetry = () => {
    dispatch({ type: "SET_LAUNCH_ERROR", error: null });
    dispatch({ type: "SET_LAUNCH_PHASE", phase: 0 });
    dispatch({ type: "SET_SCREEN", screen: "launch_review" });
  };

  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {/* Oak with subtle animation */}
      <div className="mb-6" style={{ animation: "oakBob 2s ease-in-out infinite" }}>
        <OakSprite className="scale-[1.5] sm:scale-[2]" />
      </div>

      {/* HP-bar style progress */}
      <div className="w-full max-w-[300px] mb-4">
        <div className="flex justify-between mb-1">
          <span className="font-pixel text-[8px] text-bags-gold">PROGRESS</span>
          <span className="font-pixel text-[8px] text-gray-500">
            {state.launchPhase + 1}/{totalPhases}
          </span>
        </div>
        <div className="h-4 bg-gray-800 border border-gray-600 rounded overflow-hidden">
          <div
            className="h-full bg-bags-green transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Status text */}
      <p className="font-pixel text-[10px] text-white mb-2 text-center">
        {state.launchStatus || phaseLabels[state.launchPhase] || "Processing..."}
      </p>

      {/* Phase indicator */}
      <div className="flex gap-2 mb-4">
        {phaseLabels.map((label, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${i <= state.launchPhase ? "bg-bags-green" : "bg-gray-700"}`}
            title={label}
          />
        ))}
      </div>

      {/* Error state */}
      {state.launchError && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="font-pixel text-[9px] text-red-400 text-center max-w-[280px]">
            {state.launchError}
          </p>
          <button
            type="button"
            className="font-pixel text-[10px] text-bags-green border border-bags-green px-4 py-2 rounded cursor-pointer hover:bg-bags-green hover:text-black transition-colors"
            onClick={handleRetry}
          >
            [RETRY]
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes oakBob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}

/* ─── Main LaunchScreen ─── */
export function LaunchScreen(props: ScreenProps) {
  const { state } = props;

  switch (state.currentScreen) {
    case "wallet_connect":
      return <WalletConnectView {...props} />;
    case "launch_review":
      return <LaunchReviewView {...props} />;
    case "launching":
      return <LaunchingView {...props} />;
    default:
      return <WalletConnectView {...props} />;
  }
}
