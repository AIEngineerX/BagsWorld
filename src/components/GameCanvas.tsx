"use client";

import { useEffect, useRef, Component, ReactNode } from "react";
import * as Phaser from "phaser";
import { BootScene } from "@/game/scenes/BootScene";
import { WorldScene } from "@/game/scenes/WorldScene";
import { UIScene } from "@/game/scenes/UIScene";
import type { WorldState } from "@/lib/types";
import {
  initAgentBridge,
  disconnectAgentBridge,
  getAgentBridge,
} from "@/lib/agent-websocket-bridge";

// Error boundary to catch Phaser/game errors without crashing the entire UI
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GameErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("GameCanvas error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || "Unknown error";
      const errorStack = this.state.error?.stack?.split("\n").slice(0, 3).join("\n") || "";

      return (
        this.props.fallback || (
          <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center p-4 max-w-md">
              <p className="text-lg mb-2">Game failed to load</p>
              <p className="text-sm text-red-400 mb-2 break-words">{errorMessage}</p>
              {errorStack && (
                <pre className="text-xs text-gray-500 mb-4 text-left overflow-auto max-h-20 bg-gray-800 p-2 rounded">
                  {errorStack}
                </pre>
              )}
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload(); // Full reload to reset Phaser
                }}
                className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700"
              >
                Retry
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Animal control event types
interface AnimalControlEvent {
  action: "move" | "pet" | "scare" | "call";
  animalType: "dog" | "cat" | "bird" | "butterfly" | "squirrel";
  targetX?: number;
}

interface GameCanvasProps {
  worldState: WorldState | null;
}

function GameCanvasInner({ worldState }: GameCanvasProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    // Detect mobile for performance optimizations
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isLowPower = navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency <= 4
      : isMobile;

    // Use responsive canvas size based on device
    // Mobile: Use screen dimensions for better fit
    // Desktop: Use standard 1280x960
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isPortrait = screenHeight > screenWidth;

    // For mobile portrait, use a more portrait-friendly aspect ratio
    let gameWidth = 1280;
    let gameHeight = 960;

    if (isMobile) {
      if (isPortrait) {
        // Portrait mobile: swap dimensions for better fit
        gameWidth = 960;
        gameHeight = 1280;
      }
      // Scale down for performance on mobile
      const scaleFactor = Math.min(screenWidth / gameWidth, screenHeight / gameHeight);
      if (scaleFactor < 0.5) {
        gameWidth = Math.round(gameWidth * 0.75);
        gameHeight = Math.round(gameHeight * 0.75);
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: gameWidth,
      height: gameHeight,
      backgroundColor: "#0a0a0f",
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: true,
        // On mobile, allow the game to resize with the window
        min: {
          width: isMobile ? 320 : 640,
          height: isMobile ? 480 : 480,
        },
        max: {
          width: 1920,
          height: 1440,
        },
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
        touch: {
          target: containerRef.current,
          capture: false, // Don't capture - let browser handle scrolling
        },
      },
      // Mobile performance optimizations
      fps: {
        target: isMobile ? 30 : 60, // Lower FPS on mobile for battery
        forceSetTimeOut: isLowPower, // More stable on low-power devices
      },
      render: {
        antialias: false, // Disable for pixel art
        roundPixels: true, // Crisp pixel art
        powerPreference: isMobile ? "low-power" : "high-performance",
      },
    };

    gameRef.current = new Phaser.Game(config);

    // Expose sprite export function globally for development
    // Usage: Open browser console and run window.exportAgentSprites()
    (window as unknown as { exportAgentSprites: () => void }).exportAgentSprites = () => {
      const bootScene = gameRef.current?.scene.getScene("BootScene") as BootScene | undefined;
      if (bootScene) {
        bootScene.exportAgentSprites();
      } else {
        console.error("BootScene not found. Make sure the game is loaded.");
      }
    };
    console.log(
      "%c[BagsWorld] Sprite export ready! Run window.exportAgentSprites() in console to download agent PNGs.",
      "color: #4ade80; font-weight: bold;"
    );

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

  // Track whether WorldScene is ready to accept updates
  const sceneReadyRef = useRef(false);
  const pendingWorldStateRef = useRef<WorldState | null>(null);

  // Listen for scene-ready event (fired once from WorldScene.create())
  useEffect(() => {
    const onReady = () => {
      sceneReadyRef.current = true;
      // Flush any buffered worldState
      if (pendingWorldStateRef.current && gameRef.current) {
        const worldScene = gameRef.current.scene.getScene("WorldScene") as WorldScene | undefined;
        if (worldScene && worldScene.scene.isActive()) {
          worldScene.updateWorldState(pendingWorldStateRef.current);
          pendingWorldStateRef.current = null;
        }
      }
    };
    window.addEventListener("worldscene-ready", onReady);
    return () => window.removeEventListener("worldscene-ready", onReady);
  }, []);

  // Update world state in the game
  useEffect(() => {
    if (!gameRef.current || !worldState) return;

    if (!sceneReadyRef.current) {
      // Scene not ready yet — buffer for delivery when ready
      pendingWorldStateRef.current = worldState;
      return;
    }

    const worldScene = gameRef.current.scene.getScene("WorldScene") as WorldScene | undefined;
    if (worldScene && worldScene.scene.isActive()) {
      worldScene.updateWorldState(worldState);
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

  // Initialize WebSocket bridge to agent server
  useEffect(() => {
    // Only connect if agent server is configured
    const agentWsUrl = process.env.NEXT_PUBLIC_AGENT_WS_URL;
    if (!agentWsUrl) {
      console.log(
        "[AgentBridge] No NEXT_PUBLIC_AGENT_WS_URL configured, skipping agent connection"
      );
      return;
    }

    const bridge = initAgentBridge(agentWsUrl);
    console.log("[AgentBridge] Initialized connection to agent server");

    return () => {
      disconnectAgentBridge();
    };
  }, []);

  // Send world state updates to agent bridge
  useEffect(() => {
    if (!worldState) return;

    const bridge = getAgentBridge();
    if (!bridge.isConnected()) return;

    // Get character positions from the game
    const worldScene = gameRef.current?.scene.getScene("WorldScene") as WorldScene | undefined;
    if (!worldScene || !worldScene.scene.isActive()) return;

    // Build character positions map
    const positions = new Map<string, { x: number; y: number }>();
    if (worldState.population) {
      for (const char of worldState.population) {
        // Get actual sprite position if available
        const sprite = worldScene.getCharacterSprite?.(char.id);
        if (sprite) {
          positions.set(char.id, { x: sprite.x, y: sprite.y });
        } else {
          // Use character's x/y from world state
          positions.set(char.id, { x: char.x || 400, y: char.y || 555 });
        }
      }
    }

    // Get current zone from the scene or use main_city default
    const currentZone =
      (worldScene as unknown as { currentZone?: string }).currentZone || "main_city";
    bridge.sendWorldStateUpdate(
      worldState,
      positions,
      currentZone as "main_city" | "trending" | "labs" | "founders" | "ballers"
    );
  }, [worldState]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center game-canvas-wrapper"
      style={{
        touchAction: "auto",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        position: "relative",
        zIndex: 0,
      }}
    />
  );
}

// Wrapped export with error boundary
export default function GameCanvasWithErrorBoundary(props: GameCanvasProps) {
  return (
    <GameErrorBoundary>
      <GameCanvasInner {...props} />
    </GameErrorBoundary>
  );
}
