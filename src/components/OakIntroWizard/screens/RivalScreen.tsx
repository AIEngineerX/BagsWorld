"use client";

import React, { useState, useEffect } from "react";
import type { ScreenProps, FeeShareConfig } from "../types";
import { DIALOGUE } from "../constants";
import { DialogueBox } from "../DialogueBox";

type SplitPreset = "100" | "70_30" | "50_50" | "custom";

const PROVIDERS = [
  { value: "twitter", label: "Twitter / X" },
  { value: "moltbook", label: "Moltbook" },
  { value: "github", label: "GitHub" },
  { value: "kick", label: "Kick" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
];

export function RivalScreen({ state, dispatch, onAdvance }: ScreenProps) {
  const isIntro = state.currentScreen === "rival_intro";

  // Bagsy bounce-in animation
  const [entered, setEntered] = useState(false);

  // Fee share form state
  const [provider, setProvider] = useState("twitter");
  const [username, setUsername] = useState("");
  const [splitPreset, setSplitPreset] = useState<SplitPreset>("100");
  const [customSelfPct, setCustomSelfPct] = useState(80);

  useEffect(() => {
    if (isIntro) {
      const timer = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(timer);
    }
  }, [isIntro]);

  const handleSkip = () => {
    // 100% to self — skip the fee claimer, advance to next screen
    const shares: FeeShareConfig[] = [
      { provider: "self", username: state.creatorName || "creator", bps: 10000 },
    ];
    dispatch({ type: "SET_FEE_SHARES", shares });
    onAdvance();
  };

  const handleConfirm = () => {
    const shares: FeeShareConfig[] = [];

    const selfPct =
      splitPreset === "100"
        ? 100
        : splitPreset === "70_30"
          ? 70
          : splitPreset === "50_50"
            ? 50
            : customSelfPct;

    const selfBps = selfPct * 100;
    const claimerBps = 10000 - selfBps;

    if (claimerBps === 0 || !username.trim()) {
      // 100% to self
      shares.push({
        provider: "self",
        username: state.creatorName || "creator",
        bps: 10000,
      });
    } else {
      shares.push({
        provider: "self",
        username: state.creatorName || "creator",
        bps: selfBps,
      });
      shares.push({
        provider,
        username: username.trim().replace(/^@/, ""),
        bps: claimerBps,
      });
    }

    dispatch({ type: "SET_FEE_SHARES", shares });
    onAdvance();
  };

  const selfPercentage =
    splitPreset === "100"
      ? 100
      : splitPreset === "70_30"
        ? 70
        : splitPreset === "50_50"
          ? 50
          : customSelfPct;
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

        {/* Spotlight glow behind Bagsy */}
        <div
          className="absolute z-[3]"
          style={{
            top: "12%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 180,
            height: 180,
            opacity: entered ? 0.25 : 0,
            transition: "opacity 0.8s ease-out 0.6s",
            background: "radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 70%)",
          }}
        />

        {/* Bagsy bouncing in from above */}
        <div
          className="relative z-[5] mt-[15%] sm:mt-[12%]"
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
      className="absolute inset-0 bg-black flex flex-col items-center px-4 pt-4 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <h2 className="font-pixel text-[11px] sm:text-sm text-white mb-0.5">Add a fee claimer</h2>
      <p className="font-pixel text-[7px] text-gray-500 mb-3">or keep 100% for yourself</p>

      {/* Provider + Username inline row */}
      <div className="w-full max-w-[300px] mb-1 flex gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-[110px] flex-shrink-0 bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded focus:border-bags-green focus:outline-none"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@username"
          className="flex-1 min-w-0 bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      <p className="font-pixel text-[7px] text-gray-600 mb-3 w-full max-w-[300px]">
        They verify their account on Bags to claim earnings
      </p>

      {/* BPS split presets + Custom */}
      <div className="w-full max-w-[300px] mb-2">
        <label className="font-pixel text-[8px] text-gray-400 mb-1 block">Fee Split</label>
        <div className="flex gap-1.5">
          {(
            [
              { key: "100", label: "100%" },
              { key: "70_30", label: "70/30" },
              { key: "50_50", label: "50/50" },
              { key: "custom", label: "Custom" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`flex-1 font-pixel text-[8px] py-1.5 border rounded cursor-pointer transition-colors ${splitPreset === key ? "bg-bags-green text-black border-bags-green" : "bg-gray-800 text-gray-400 border-gray-600 hover:border-gray-400"}`}
              onClick={() => setSplitPreset(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom slider — only visible when Custom selected */}
      {splitPreset === "custom" && (
        <div className="w-full max-w-[300px] mb-2">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[7px] text-bags-green w-8 text-right">
              {customSelfPct}%
            </span>
            <input
              type="range"
              min={1}
              max={99}
              value={customSelfPct}
              onChange={(e) => setCustomSelfPct(Number(e.target.value))}
              className="flex-1 h-1.5 appearance-none bg-gray-700 rounded-full outline-none accent-green-500"
              style={{ accentColor: "#22C55E" }}
            />
            <span className="font-pixel text-[7px] text-purple-400 w-8">
              {100 - customSelfPct}%
            </span>
          </div>
          <div className="flex justify-between font-pixel text-[6px] text-gray-600 mt-0.5 px-8">
            <span>You</span>
            <span>Claimer</span>
          </div>
        </div>
      )}

      {/* Visual split bar */}
      <div className="w-full max-w-[300px] mb-2">
        <div className="flex h-5 rounded overflow-hidden border border-gray-600">
          <div
            className="bg-bags-green flex items-center justify-center font-pixel text-[7px] text-black transition-all duration-300"
            style={{ width: `${selfPercentage}%` }}
          >
            {selfPercentage >= 20 ? `YOU ${selfPercentage}%` : ""}
          </div>
          {claimerPercentage > 0 && (
            <div
              className="bg-purple-600 flex items-center justify-center font-pixel text-[7px] text-white transition-all duration-300"
              style={{ width: `${claimerPercentage}%` }}
            >
              {claimerPercentage >= 20 ? `CLAIMER ${claimerPercentage}%` : ""}
            </div>
          )}
        </div>
      </div>

      {/* Permanent warning */}
      <p className="font-pixel text-[7px] text-bags-gold text-center mb-2 max-w-[300px]">
        Fee shares are locked permanently at launch.
      </p>

      {/* Action buttons */}
      <div className="flex gap-3">
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
