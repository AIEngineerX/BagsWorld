"use client";

import { useState, useEffect } from "react";

interface TrackChangeEvent extends CustomEvent {
  detail: {
    trackName: string;
    trackIndex: number;
  };
}

export function MusicButton() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [trackName, setTrackName] = useState("Adventure");

  useEffect(() => {
    const handleTrackChange = (event: TrackChangeEvent) => {
      setTrackName(event.detail.trackName);
    };

    window.addEventListener("bagsworld-track-changed", handleTrackChange as EventListener);
    return () => {
      window.removeEventListener("bagsworld-track-changed", handleTrackChange as EventListener);
    };
  }, []);

  const toggleMusic = () => {
    setIsPlaying(!isPlaying);
    window.dispatchEvent(new CustomEvent("bagsworld-toggle-music"));
  };

  const prevTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("bagsworld-prev-track"));
  };

  const skipTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("bagsworld-skip-track"));
  };

  return (
    <div className="flex items-center gap-1">
      {isPlaying && (
        <button
          onClick={prevTrack}
          className="px-2 py-1 bg-bags-darker border-2 border-bags-green font-pixel text-[10px] hover:bg-bags-green/20 transition-colors"
          title="Previous track"
        >
          <span className="text-sm">⏮️</span>
        </button>
      )}
      <button
        onClick={toggleMusic}
        className="px-2 py-1 bg-bags-darker border-2 border-bags-green font-pixel text-[10px] hover:bg-bags-green/20 transition-colors flex items-center gap-1"
        title={isPlaying ? "Mute music" : "Play music"}
      >
        <span className="text-sm">{isPlaying ? "🎵" : "🔇"}</span>
        <span className="hidden sm:inline text-bags-green max-w-20 truncate">
          {isPlaying ? trackName : "MUTED"}
        </span>
      </button>
      {isPlaying && (
        <button
          onClick={skipTrack}
          className="px-2 py-1 bg-bags-darker border-2 border-bags-green font-pixel text-[10px] hover:bg-bags-green/20 transition-colors"
          title="Next track"
        >
          <span className="text-sm">⏭️</span>
        </button>
      )}
    </div>
  );
}
