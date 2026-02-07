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
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 font-pixel text-xs text-gray-400 hover:text-red-400 border border-gray-600 hover:border-red-500/50 px-3 py-1 transition-colors"
        title="Close (ESC)"
      >
        [X] CLOSE
      </button>

      <div className="flex flex-col items-center gap-6 text-center px-4">
        <div className="text-6xl">&#x1F5E1;&#xFE0F;</div>
        <h2 className="font-pixel text-purple-400 text-2xl sm:text-3xl tracking-wider">
          BAGSDUNGEON
        </h2>
        <div className="font-pixel text-purple-300/80 text-sm animate-pulse">COMING SOON</div>
        <p className="font-pixel text-gray-500 text-xs max-w-md leading-relaxed">
          A full MMORPG adventure awaits inside BagsWorld. Explore dungeons, battle monsters, and
          earn loot — all connected to the Bags.fm ecosystem.
        </p>
        <button
          onClick={onClose}
          className="font-pixel text-xs text-purple-400 border border-purple-500/50 hover:border-purple-400 hover:bg-purple-500/10 px-6 py-2 transition-colors mt-4"
        >
          RETURN TO BAGSWORLD
        </button>
      </div>
    </div>
  );
}
