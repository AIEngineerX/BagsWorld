"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/store";
import { ZONES, type ZoneType } from "@/lib/types";
import { ZONE_ORDER } from "@/components/ZoneNav";
import { loadProgress, getLevelProgress } from "@/lib/encounter-xp";

interface ImmersiveHUDProps {
  visible: boolean;
  worldHealth: number;
}

export function ImmersiveHUD({ visible, worldHealth }: ImmersiveHUDProps) {
  const { currentZone, setZone } = useGameStore();
  const [showHint, setShowHint] = useState(true);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [xpPercent, setXpPercent] = useState(0);

  // Fade WASD hint after 4 seconds on first entry
  useEffect(() => {
    if (visible) {
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Load XP state on mount and listen for changes
  useEffect(() => {
    const refreshXp = () => {
      const progress = loadProgress();
      setPlayerLevel(progress.level);
      const levelProg = getLevelProgress();
      setXpPercent(levelProg.percent);
    };

    refreshXp();

    const onXpChanged = () => refreshXp();
    window.addEventListener("bagsworld-xp-changed", onXpChanged);
    return () => window.removeEventListener("bagsworld-xp-changed", onXpChanged);
  }, []);

  if (!visible) return null;

  const currentIndex = ZONE_ORDER.indexOf(currentZone);
  const canGoLeft = currentIndex > 0;
  const canGoRight = currentIndex < ZONE_ORDER.length - 1;

  const navigateZone = (direction: "left" | "right") => {
    const nextIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= ZONE_ORDER.length) return;
    const newZone = ZONE_ORDER[nextIndex];
    setZone(newZone);
    window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone: newZone } }));
  };

  const handleExit = () => {
    window.dispatchEvent(new Event("bagsworld-exit-world"));
  };

  const healthColor =
    worldHealth >= 80
      ? "text-green-400"
      : worldHealth >= 60
        ? "text-yellow-400"
        : worldHealth >= 40
          ? "text-orange-400"
          : "text-red-400";

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* Top center pill — zone name + health + XP */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-auto">
        {/* Left arrow */}
        <button
          onClick={() => navigateZone("left")}
          disabled={!canGoLeft}
          className={`font-pixel text-sm px-2 py-1 bg-black/60 border border-white/20 transition-all ${
            canGoLeft
              ? "text-bags-green hover:bg-black/80 hover:border-bags-green/50"
              : "text-gray-600 cursor-not-allowed"
          }`}
        >
          {"<"}
        </button>

        {/* Zone info pill */}
        <div className="flex items-center gap-3 px-4 py-1.5 bg-black/70 border border-white/20 backdrop-blur-sm">
          <span className="font-pixel text-[11px] text-bags-green tracking-wider">
            {ZONES[currentZone]?.name?.toUpperCase() ?? currentZone.toUpperCase()}
          </span>
          <span className="text-gray-500">|</span>
          <span className={`font-pixel text-[10px] ${healthColor}`}>
            {Math.round(worldHealth)}%
          </span>
          <span className="text-gray-500">|</span>
          <span className="font-pixel text-[10px] text-bags-gold">LV{playerLevel}</span>
          <div className="w-12 h-1.5 bg-gray-700 border border-gray-600 overflow-hidden">
            <div
              className="h-full bg-bags-gold transition-all duration-500"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={() => navigateZone("right")}
          disabled={!canGoRight}
          className={`font-pixel text-sm px-2 py-1 bg-black/60 border border-white/20 transition-all ${
            canGoRight
              ? "text-bags-green hover:bg-black/80 hover:border-bags-green/50"
              : "text-gray-600 cursor-not-allowed"
          }`}
        >
          {">"}
        </button>
      </div>

      {/* Exit button — top right */}
      <button
        onClick={handleExit}
        className="absolute top-3 right-3 pointer-events-auto font-pixel text-[10px] px-3 py-1.5 bg-red-900/70 border border-red-500/50 text-red-300 hover:bg-red-800/80 hover:text-red-200 hover:border-red-400/60 transition-all"
      >
        EXIT
      </button>

      {/* WASD hint — bottom center, fades after 4s */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 font-pixel text-[9px] text-white/50 bg-black/40 px-3 py-1 transition-opacity duration-1000 ${
          showHint ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        WASD to move · SHIFT to sprint · E to interact
      </div>
    </div>
  );
}
