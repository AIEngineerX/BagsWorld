"use client";

import { useState } from "react";

export function MusicButton() {
  const [isPlaying, setIsPlaying] = useState(true);

  const toggleMusic = () => {
    setIsPlaying(!isPlaying);
    window.dispatchEvent(new CustomEvent("bagsworld-toggle-music"));
  };

  return (
    <button
      onClick={toggleMusic}
      className="px-3 py-1 bg-bags-darker border-2 border-bags-green font-pixel text-[10px] hover:bg-bags-green/20 transition-colors flex items-center gap-1"
      title={isPlaying ? "Mute music" : "Play music"}
    >
      <span className="text-sm">{isPlaying ? "🎵" : "🔇"}</span>
      <span className="hidden sm:inline text-bags-green">
        {isPlaying ? "MUSIC" : "MUTED"}
      </span>
    </button>
  );
}
