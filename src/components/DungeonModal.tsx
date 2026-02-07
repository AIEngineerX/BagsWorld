"use client";

import { useEffect } from "react";

interface DungeonModalProps {
  onClose: () => void;
}

export function DungeonModal({ onClose }: DungeonModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "bagsdungeon-close") onClose();
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("message", handleMessage);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="h-10 bg-black/95 border-b border-purple-500/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-purple-400 text-xs">[D]</span>
          <span className="font-pixel text-purple-300 text-sm">BAGSDUNGEON</span>
          <span className="font-pixel text-gray-500 text-[10px] hidden sm:inline">
            — MMORPG Adventure
          </span>
        </div>
        <button
          onClick={onClose}
          className="font-pixel text-xs text-gray-400 hover:text-red-400 border border-gray-600 hover:border-red-500/50 px-3 py-1 transition-colors"
          title="Close Dungeon (ESC)"
        >
          [X] CLOSE
        </button>
      </div>
      <iframe
        src="/games/dungeon/?embed=true"
        className="flex-1 w-full border-0"
        allow="autoplay; fullscreen"
        title="BagsDungeon MMORPG"
      />
    </div>
  );
}
