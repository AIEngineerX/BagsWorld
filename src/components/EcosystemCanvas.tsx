"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { EcosystemBootScene } from "@/game/scenes/EcosystemBootScene";
import { EcosystemScene } from "@/game/scenes/EcosystemScene";

export default function EcosystemCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const gameConfig: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS,
      parent: containerRef.current,
      width: 1200,
      height: 500,
      backgroundColor: "#0a0a0f",
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [EcosystemBootScene, EcosystemScene],
      render: {
        antialias: false,
        roundPixels: true,
      },
      audio: {
        noAudio: true,
      },
    };

    gameRef.current = new Phaser.Game(gameConfig);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full border-2 border-bags-green/30 rounded-lg overflow-hidden"
      style={{
        aspectRatio: "12 / 5",
        imageRendering: "pixelated",
      }}
    />
  );
}
