"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { BootScene } from "@/game/scenes/BootScene";
import { WorldScene } from "@/game/scenes/WorldScene";
import { UIScene } from "@/game/scenes/UIScene";
import type { WorldState } from "@/lib/types";

interface GameCanvasProps {
  worldState: WorldState | null;
}

export default function GameCanvas({ worldState }: GameCanvasProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 800,
      height: 600,
      backgroundColor: "#0a0a0f",
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [BootScene, WorldScene, UIScene],
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Update world state in the game
  useEffect(() => {
    if (gameRef.current && worldState) {
      const worldScene = gameRef.current.scene.getScene(
        "WorldScene"
      ) as WorldScene;
      if (worldScene && worldScene.scene.isActive()) {
        worldScene.updateWorldState(worldState);
      }
    }
  }, [worldState]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
    />
  );
}
