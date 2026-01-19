"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import { BootScene } from "@/game/scenes/BootScene";
import { WorldScene } from "@/game/scenes/WorldScene";
import { UIScene } from "@/game/scenes/UIScene";
import type { WorldState } from "@/lib/types";

// Animal control event types
interface AnimalControlEvent {
  action: "move" | "pet" | "scare" | "call";
  animalType: "dog" | "cat" | "bird" | "butterfly" | "squirrel";
  targetX?: number;
}

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
        expandParent: true,
      },
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [BootScene, WorldScene, UIScene],
      input: {
        activePointers: 3, // Support multi-touch
      },
    };

    gameRef.current = new Phaser.Game(config);

    // Handle resize/orientation changes
    const handleResize = () => {
      if (gameRef.current) {
        gameRef.current.scale.refresh();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
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

  // Listen for animal control events from Bags Bot
  useEffect(() => {
    const handleAnimalControl = (event: CustomEvent<AnimalControlEvent>) => {
      if (!gameRef.current) return;

      const worldScene = gameRef.current.scene.getScene("WorldScene") as WorldScene;
      if (!worldScene || !worldScene.scene.isActive()) return;

      const { action, animalType, targetX } = event.detail;

      switch (action) {
        case "move":
          worldScene.moveAnimalTo(animalType, targetX ?? 400);
          break;
        case "pet":
          worldScene.petAnimal(animalType);
          break;
        case "scare":
          worldScene.scareAnimal(animalType);
          break;
        case "call":
          worldScene.callAnimal(animalType, targetX ?? 400);
          break;
      }
    };

    window.addEventListener("bagsworld-animal-control", handleAnimalControl as EventListener);

    return () => {
      window.removeEventListener("bagsworld-animal-control", handleAnimalControl as EventListener);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
    />
  );
}
