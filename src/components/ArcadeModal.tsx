"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";

const loadScenes = () =>
  Promise.all([
    import("@/game/arcade/ArcadeBootScene"),
    import("@/game/arcade/ArcadeMenuScene"),
    import("@/game/arcade/ArcadeGameScene"),
    import("@/game/arcade/ArcadeHUDScene"),
    import("@/game/arcade/ArcadeGameOverScene"),
  ]);

interface ArcadeModalProps {
  onClose: () => void;
}

export function ArcadeModal({ onClose }: ArcadeModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let mounted = true;

    loadScenes()
      .then(([boot, menu, game, hud, gameOver]) => {
        if (!mounted || !containerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.CANVAS,
          parent: containerRef.current,
          width: 480,
          height: 270,
          backgroundColor: "#0a0a0f",
          pixelArt: true,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          physics: {
            default: "arcade",
            arcade: {
              gravity: { x: 0, y: 800 },
              debug: false,
            },
          },
          scene: [
            boot.ArcadeBootScene,
            menu.ArcadeMenuScene,
            game.ArcadeGameScene,
            hud.ArcadeHUDScene,
            gameOver.ArcadeGameOverScene,
          ],
          render: {
            antialias: false,
            roundPixels: true,
          },
          input: {
            keyboard: true,
          },
          audio: {
            noAudio: true,
          },
        };

        gameRef.current = new Phaser.Game(config);
      })
      .catch((err) => {
        console.error("Failed to load arcade scenes:", err);
      });

    return () => {
      mounted = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl mx-4 pt-14 sm:pt-0">
        <button
          onClick={onClose}
          className="absolute top-0 right-0 sm:-top-12 text-gray-400 hover:text-white font-pixel text-sm z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          [X] CLOSE
        </button>

        <div className="text-center mb-2">
          <h2 className="font-pixel text-lg text-bags-green">METAL BAGS</h2>
          <p className="font-pixel text-[8px] text-gray-500 hidden sm:block">
            Arrow Keys: Move &nbsp; Z: Shoot &nbsp; X: Jump &nbsp; C: Grenade
          </p>
          <p className="font-pixel text-[8px] text-gray-500 sm:hidden">Tap to play</p>
        </div>

        <div
          ref={containerRef}
          className="w-full border-2 border-bags-green/40 rounded-lg overflow-hidden bg-black"
          style={{
            aspectRatio: "16 / 9",
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
}
