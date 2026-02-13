"use client";

import React, { useState, useEffect } from "react";
import type { ScreenProps, FeeShareConfig } from "../types";
import { DIALOGUE } from "../constants";
import { DialogueBox } from "../DialogueBox";

type SplitPreset = "100" | "70_30" | "50_50";

const PROVIDERS = [
  { value: "twitter", label: "Twitter / X" },
  { value: "moltbook", label: "Moltbook" },
  { value: "github", label: "GitHub" },
  { value: "kick", label: "Kick" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
];

export function RivalScreen({ state, dispatch, onAdvance, onSkip }: ScreenProps) {
  const isIntro = state.currentScreen === "rival_intro";

  // Bagsy bounce-in animation
  const [entered, setEntered] = useState(false);

  // Fee share form state
  const [provider, setProvider] = useState("twitter");
  const [username, setUsername] = useState("");
  const [splitPreset, setSplitPreset] = useState<SplitPreset>("100");

  useEffect(() => {
    if (isIntro) {
      const timer = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(timer);
    }
  }, [isIntro]);

  const handleSkip = () => {
    // 100% to self
    const shares: FeeShareConfig[] = [
      { provider: "self", username: state.creatorName || "creator", bps: 10000 },
    ];
    dispatch({ type: "SET_FEE_SHARES", shares });
    onSkip();
  };

  const handleConfirm = () => {
    const shares: FeeShareConfig[] = [];

    if (splitPreset === "100") {
      shares.push({
        provider: "self",
        username: state.creatorName || "creator",
        bps: 10000,
      });
    } else {
      const selfBps = splitPreset === "70_30" ? 7000 : 5000;
      const claimerBps = splitPreset === "70_30" ? 3000 : 5000;

      shares.push({
        provider: "self",
        username: state.creatorName || "creator",
        bps: selfBps,
      });

      if (username.trim()) {
        shares.push({
          provider,
          username: username.trim().replace(/^@/, ""),
          bps: claimerBps,
        });
      } else {
        // No username entered, give all to self
        shares[0].bps = 10000;
      }
    }

    dispatch({ type: "SET_FEE_SHARES", shares });
    onAdvance();
  };

  const selfPercentage = splitPreset === "100" ? 100 : splitPreset === "70_30" ? 70 : 50;
  const claimerPercentage = 100 - selfPercentage;

  // --- Bagsy intro phase ---
  if (isIntro) {
    return (
      <div
        className="absolute inset-0 bg-gray-900 flex flex-col items-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-gray-800" />

        {/* Bagsy bouncing in */}
        <div
          className="relative z-[5] mt-[20%] sm:mt-[15%]"
          style={{
            transform: entered ? "translateY(0) scale(1)" : "translateY(-100vh) scale(0.5)",
            transition: "transform 1.0s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/agents/bagsy.png"
            alt="Bagsy"
            width={64}
            height={64}
            className="scale-[2] sm:scale-[2.5]"
            style={{ imageRendering: "pixelated" }}
            draggable={false}
          />
        </div>

        <DialogueBox lines={DIALOGUE.rival_intro} speakerName="BAGSY" onComplete={onAdvance} />
      </div>
    );
  }

  // --- Fee claimer setup phase ---
  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center px-4 pt-6 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <h2 className="font-pixel text-[11px] sm:text-sm text-white mb-1">Add a fee claimer</h2>
      <p className="font-pixel text-[7px] text-gray-500 mb-4">or keep 100% for yourself</p>

      {/* Provider select */}
      <div className="w-full max-w-[300px] mb-3">
        <label className="font-pixel text-[9px] text-gray-400 mb-1 block">Platform</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[10px] px-3 py-2 rounded focus:border-bags-green focus:outline-none"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Username input */}
      <div className="w-full max-w-[300px] mb-4">
        <label className="font-pixel text-[9px] text-gray-400 mb-1 block">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@username"
          className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[10px] px-3 py-2 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
          onKeyDown={(e) => e.stopPropagation()}
        />
        <p className="font-pixel text-[7px] text-gray-600 mt-1">
          They verify their account on Bags to claim earnings
        </p>
      </div>

      {/* BPS split presets */}
      <div className="w-full max-w-[300px] mb-4">
        <label className="font-pixel text-[9px] text-gray-400 mb-2 block">Fee Split</label>
        <div className="flex gap-2">
          {(
            [
              { key: "100", label: "100% Me" },
              { key: "70_30", label: "70 / 30" },
              { key: "50_50", label: "50 / 50" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`flex-1 font-pixel text-[9px] py-2 border rounded cursor-pointer transition-colors ${splitPreset === key ? "bg-bags-green text-black border-bags-green" : "bg-gray-800 text-gray-400 border-gray-600 hover:border-gray-400"}`}
              onClick={() => setSplitPreset(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Visual split bar */}
      <div className="w-full max-w-[300px] mb-4">
        <div className="flex h-6 rounded overflow-hidden border border-gray-600">
          <div
            className="bg-bags-green flex items-center justify-center font-pixel text-[8px] text-black transition-all duration-300"
            style={{ width: `${selfPercentage}%` }}
          >
            YOU {selfPercentage}%
          </div>
          {claimerPercentage > 0 && (
            <div
              className="bg-purple-600 flex items-center justify-center font-pixel text-[8px] text-white transition-all duration-300"
              style={{ width: `${claimerPercentage}%` }}
            >
              CLAIMER {claimerPercentage}%
            </div>
          )}
        </div>
      </div>

      {/* Permanent warning */}
      <p className="font-pixel text-[8px] text-bags-gold text-center mb-3 max-w-[300px]">
        Fee shares are locked permanently at launch.
      </p>

      {/* Action buttons */}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          className="font-pixel text-[10px] text-gray-500 hover:text-gray-300 px-4 py-2 border border-gray-700 hover:border-gray-500 rounded cursor-pointer transition-colors"
          onClick={handleSkip}
        >
          [SKIP]
        </button>
        <button
          type="button"
          className="font-pixel text-[10px] text-black bg-bags-green hover:bg-green-400 px-6 py-2 rounded cursor-pointer transition-colors border border-bags-green"
          onClick={handleConfirm}
        >
          [OK]
        </button>
      </div>
    </div>
  );
}
