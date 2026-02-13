"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface EnterWorldButtonProps {
  className?: string;
}

// Default sprite variants (fallback if AI generation fails)
// Colors match SHIRT_COLORS in BootScene.ts: green, blue, red, gold, purple, pink, cyan, orange, gray
const DEFAULT_SPRITES = [
  { id: 0, name: "Green Explorer", color: "#4ade80" },
  { id: 1, name: "Blue Adventurer", color: "#60a5fa" },
  { id: 2, name: "Red Warrior", color: "#f87171" },
  { id: 3, name: "Gold Knight", color: "#fbbf24" },
  { id: 4, name: "Purple Mage", color: "#a78bfa" },
];

// Popular meme suggestions
const MEME_SUGGESTIONS = [
  "Pepe the Frog",
  "Doge Shiba",
  "Wojak",
  "Chad",
  "Grumpy Cat",
  "Nyan Cat",
  "Deal With It sunglasses guy",
  "Trollface",
];

// Generation stages for visual feedback
const GENERATION_STAGES = [
  { id: 1, label: "Analyzing prompt", icon: "🔍" },
  { id: 2, label: "Generating character", icon: "🎨" },
  { id: 3, label: "Creating animations", icon: "✨" },
  { id: 4, label: "Finalizing sprite", icon: "🎮" },
];

// Floating pixel particle component
function FloatingPixels() {
  // Generate stable random positions on mount
  const particles = useRef(
    [...Array(20)].map(() => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
    }))
  ).current;

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-20px) scale(1.5);
            opacity: 0.6;
          }
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-green-400 rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              animation: `float ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// Pixel art character silhouette that animates during generation
function GeneratingAnimation({ stage }: { stage: number }) {
  return (
    <div className="relative w-32 h-32 mx-auto mb-4">
      {/* Glow backdrop */}
      <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />

      {/* Pixel grid assembling effect */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="grid grid-cols-8 gap-[2px]">
          {[...Array(64)].map((_, i) => {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const isCharacterPixel =
              (row >= 1 && row <= 2 && col >= 2 && col <= 5) || // Head
              (row >= 3 && row <= 5 && col >= 1 && col <= 6) || // Body
              (row >= 6 && row <= 7 && col >= 2 && col <= 3) || // Left leg
              (row >= 6 && row <= 7 && col >= 4 && col <= 5); // Right leg

            const shouldShow = isCharacterPixel && (i / 64) * 4 <= stage;
            const delay = (row * 8 + col) * 20;

            return (
              <div
                key={i}
                className={`w-3 h-3 rounded-sm transition-all duration-300 ${
                  shouldShow
                    ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]"
                    : "bg-gray-800/50"
                }`}
                style={{
                  transitionDelay: `${delay}ms`,
                  transform: shouldShow ? "scale(1)" : "scale(0.5)",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Scanning line effect */}
      <div
        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-60"
        style={{
          top: `${(stage / 4) * 100}%`,
          transition: "top 0.5s ease-out",
        }}
      />
    </div>
  );
}

export function EnterWorldButton({ className = "" }: EnterWorldButtonProps) {
  const [isInWorld, setIsInWorld] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [memePrompt, setMemePrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSpriteUrl, setGeneratedSpriteUrl] = useState<string | null>(null);
  const [walkSpriteSheetUrl, setWalkSpriteSheetUrl] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [useDefaultSprite, setUseDefaultSprite] = useState(false);
  const [selectedDefault, setSelectedDefault] = useState(0);
  const [isEntering, setIsEntering] = useState(false); // Prevent double-click during entry
  const [currentStage, setCurrentStage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Listen for player enter/exit events + Escape key to close modal
  useEffect(() => {
    const handleEntered = () => {
      setIsInWorld(true);
      setIsEntering(false);
    };
    const handleExited = () => {
      setIsInWorld(false);
      setIsEntering(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSelector(false);
      }
    };

    window.addEventListener("bagsworld-player-entered", handleEntered);
    window.addEventListener("bagsworld-player-exited", handleExited);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("bagsworld-player-entered", handleEntered);
      window.removeEventListener("bagsworld-player-exited", handleExited);
      window.removeEventListener("keydown", handleKeyDown);
      // Cancel any in-flight sprite generation on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const generateMemeSprite = async () => {
    if (!memePrompt.trim()) {
      setError("Enter a meme character to generate");
      return;
    }

    // Cancel any in-flight generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setError(null);
    setGeneratedSpriteUrl(null);
    setWalkSpriteSheetUrl(null);
    setCurrentStage(0);

    // 45-second overall timeout for the entire generation pipeline
    const timeoutId = setTimeout(() => controller.abort(), 45_000);

    try {
      // Stage 1: Analyzing
      setCurrentStage(1);
      setGenerationStep("Analyzing prompt...");
      await new Promise((r) => setTimeout(r, 500)); // Brief pause for visual feedback

      // Stage 2: Generate character sprite
      setCurrentStage(2);
      setGenerationStep("Creating character...");
      const response = await fetch("/api/generate-meme-sprite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: memePrompt }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setGeneratedSpriteUrl(data.imageUrl);

      // Stage 3: Generate walk animation sprite sheet
      setCurrentStage(3);
      setGenerationStep("Creating animations...");
      const walkResponse = await fetch("/api/generate-sprite-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl: data.imageUrl,
          type: "walk",
        }),
        signal: controller.signal,
      });

      const walkData = await walkResponse.json();

      if (walkResponse.ok && walkData.imageUrl) {
        setWalkSpriteSheetUrl(walkData.imageUrl);
      } else {
        // Walk animation failed — sprite still usable, notify the user
        console.warn("[EnterWorld] Walk animation generation failed, using static sprite");
      }

      // Stage 4: Finalizing
      setCurrentStage(4);
      setGenerationStep("Finalizing sprite...");
      await new Promise((r) => setTimeout(r, 300));

      setGenerationStep("");
      setCurrentStage(0);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Generation timed out — try a simpler prompt");
      } else {
        console.error("Sprite generation error:", err);
        setError(err instanceof Error ? err.message : "Failed to generate sprite");
      }
      setGenerationStep("");
      setCurrentStage(0);
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  // Stop keyboard events from reaching Phaser when typing
  const stopPropagation = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleEnterWorld = () => {
    if (isEntering) return; // Prevent double-click
    setIsEntering(true);

    // Switch to Park zone first
    window.dispatchEvent(
      new CustomEvent("bagsworld-zone-change", { detail: { zone: "main_city" } })
    );

    // Spawn the player — WorldScene queues this until zone transition completes
    if (useDefaultSprite || !generatedSpriteUrl) {
      window.dispatchEvent(
        new CustomEvent("bagsworld-enter-world", {
          detail: { spriteVariant: selectedDefault },
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("bagsworld-enter-world", {
          detail: {
            spriteVariant: -1, // Special flag for custom sprite
            customSpriteUrl: generatedSpriteUrl,
            walkSpriteSheetUrl: walkSpriteSheetUrl, // 4-frame walk cycle
            memeName: memePrompt,
          },
        })
      );
    }

    setShowSelector(false);
  };

  const handleExitWorld = () => {
    window.dispatchEvent(new CustomEvent("bagsworld-exit-world"));
  };

  const resetModal = () => {
    setMemePrompt("");
    setGeneratedSpriteUrl(null);
    setWalkSpriteSheetUrl(null);
    setGenerationStep("");
    setError(null);
    setUseDefaultSprite(false);
  };

  if (isInWorld) {
    return (
      <button
        onClick={handleExitWorld}
        className={`
          font-pixel text-xs px-4 py-2
          bg-gradient-to-b from-red-600 to-red-800
          border-2 border-red-400
          text-white shadow-lg
          hover:from-red-500 hover:to-red-700
          active:scale-95 transition-all
          ${className}
        `}
      >
        EXIT WORLD
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          resetModal();
          setShowSelector(true);
        }}
        className={`
          font-pixel text-xs px-4 py-2
          bg-gradient-to-b from-green-500 to-green-700
          border-2 border-green-300
          text-white shadow-lg
          hover:from-green-400 hover:to-green-600
          active:scale-95 transition-all
          animate-pulse hover:animate-none
          ${className}
        `}
      >
        ENTER WORLD
      </button>

      {/* Meme Sprite Selector Modal */}
      {showSelector && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowSelector(false)}
        >
          {/* Scanline overlay */}
          <div
            className="fixed inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
            }}
          />

          <div className="relative bg-gradient-to-b from-gray-900 via-gray-900 to-black border-2 border-green-500/80 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_0_40px_rgba(74,222,128,0.15),inset_0_1px_0_rgba(74,222,128,0.1)]">
            {/* Floating pixels background */}
            <FloatingPixels />

            {/* Corner decorations */}
            <div className="absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2 border-green-500/50" />
            <div className="absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2 border-green-500/50" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-l-2 border-b-2 border-green-500/50" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2 border-green-500/50" />

            {/* Header */}
            <div className="relative text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">🎮</span>
                <h2 className="font-pixel text-green-400 text-lg tracking-wide">
                  CREATE YOUR MEME AVATAR
                </h2>
                <span className="text-2xl">🎮</span>
              </div>
              <p className="font-pixel text-gray-400 text-[10px]">
                Type any meme character and AI will generate your sprite
              </p>
              <div className="mt-2 h-[2px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
            </div>

            {/* Toggle between AI and Default */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setUseDefaultSprite(false)}
                className={`flex-1 font-pixel text-[10px] py-2 rounded border-2 transition-all ${
                  !useDefaultSprite
                    ? "bg-green-600 border-green-400 text-white"
                    : "bg-gray-800 border-gray-600 text-gray-400"
                }`}
              >
                AI GENERATE
              </button>
              <button
                onClick={() => setUseDefaultSprite(true)}
                className={`flex-1 font-pixel text-[10px] py-2 rounded border-2 transition-all ${
                  useDefaultSprite
                    ? "bg-green-600 border-green-400 text-white"
                    : "bg-gray-800 border-gray-600 text-gray-400"
                }`}
              >
                DEFAULT SPRITES
              </button>
            </div>

            {!useDefaultSprite ? (
              <>
                {/* Meme Prompt Input */}
                <div className="mb-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={memePrompt}
                    onChange={(e) => setMemePrompt(e.target.value)}
                    placeholder="e.g., Pepe the Frog, Doge, Wojak..."
                    className="w-full bg-gray-800 border-2 border-gray-600 rounded px-4 py-3 font-pixel text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                    onKeyDown={(e) => {
                      stopPropagation(e);
                      if (e.key === "Enter" && !isGenerating) generateMemeSprite();
                    }}
                    onKeyUp={stopPropagation}
                    autoFocus
                  />
                </div>

                {/* Quick Suggestions */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {MEME_SUGGESTIONS.slice(0, 4).map((meme) => (
                    <button
                      key={meme}
                      onClick={() => setMemePrompt(meme)}
                      className="font-pixel text-[8px] px-2 py-1 bg-gray-800 border border-gray-600 rounded text-gray-300 hover:border-green-500 hover:text-green-400 transition-colors"
                    >
                      {meme}
                    </button>
                  ))}
                </div>

                {/* Generation In Progress UI */}
                {isGenerating ? (
                  <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-green-500/30">
                    {/* Animated character preview */}
                    <GeneratingAnimation stage={currentStage} />

                    {/* Progress stages */}
                    <div className="flex justify-center gap-2 mb-4">
                      {GENERATION_STAGES.map((stage) => (
                        <div
                          key={stage.id}
                          className={`flex flex-col items-center transition-all duration-300 ${
                            currentStage >= stage.id
                              ? "opacity-100 scale-100"
                              : "opacity-30 scale-90"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mb-1 transition-all ${
                              currentStage === stage.id
                                ? "bg-green-500 shadow-[0_0_12px_rgba(74,222,128,0.6)] animate-pulse"
                                : currentStage > stage.id
                                  ? "bg-green-600"
                                  : "bg-gray-700"
                            }`}
                          >
                            {stage.icon}
                          </div>
                          <span className="font-pixel text-[6px] text-gray-400 text-center w-12">
                            {stage.label.split(" ")[0]}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Current step text */}
                    <p className="font-pixel text-xs text-green-400 text-center animate-pulse">
                      {generationStep || "Preparing..."}
                    </p>
                    <p className="font-pixel text-[8px] text-gray-500 text-center mt-1">
                      This may take 10-20 seconds
                    </p>
                  </div>
                ) : (
                  /* Generate Button */
                  <button
                    onClick={generateMemeSprite}
                    disabled={!memePrompt.trim()}
                    className="group relative w-full font-pixel text-sm py-3 rounded border-2 mb-4 transition-all bg-gradient-to-b from-purple-600 to-purple-800 border-purple-400 text-white hover:from-purple-500 hover:to-purple-700 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <span>✨</span>
                      GENERATE SPRITE
                      <span>✨</span>
                    </span>
                  </button>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <p className="font-pixel text-[10px] text-red-400 flex items-center gap-2">
                      <span>⚠️</span> {error}
                    </p>
                  </div>
                )}

                {/* Generated Preview */}
                {generatedSpriteUrl && !isGenerating && (
                  <div className="mb-4 p-4 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border border-green-500 shadow-[0_0_20px_rgba(74,222,128,0.15)]">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <span className="text-lg">🎉</span>
                      <p className="font-pixel text-xs text-green-400">YOUR MEME SPRITE</p>
                      <span className="text-lg">🎉</span>
                    </div>
                    <div className="flex justify-center gap-4">
                      <div className="text-center">
                        <div className="relative">
                          <div className="absolute inset-0 bg-green-500/20 blur-md rounded" />
                          <img
                            src={generatedSpriteUrl}
                            alt="Generated meme sprite"
                            className="relative w-24 h-24 object-contain rounded border-2 border-green-500/50 bg-gray-900"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </div>
                        <p className="font-pixel text-[8px] text-green-400 mt-2">CHARACTER</p>
                      </div>
                      {walkSpriteSheetUrl && (
                        <div className="text-center">
                          <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/20 blur-md rounded" />
                            <img
                              src={walkSpriteSheetUrl}
                              alt="Walk animation sprite sheet"
                              className="relative w-24 h-24 object-contain rounded border-2 border-purple-500/50 bg-gray-900"
                              style={{ imageRendering: "pixelated" }}
                            />
                          </div>
                          <p className="font-pixel text-[8px] text-purple-400 mt-2">WALK CYCLE</p>
                        </div>
                      )}
                    </div>
                    <p className="font-pixel text-[10px] text-gray-300 text-center mt-3 px-4 py-2 bg-gray-800/50 rounded">
                      &quot;{memePrompt}&quot;
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* Default Sprite Selection */
              <div className="grid grid-cols-5 gap-2 mb-4">
                {DEFAULT_SPRITES.map((sprite) => (
                  <button
                    key={sprite.id}
                    onClick={() => setSelectedDefault(sprite.id)}
                    className={`p-2 rounded border-2 transition-all ${
                      selectedDefault === sprite.id
                        ? "border-green-400 bg-green-400/20"
                        : "border-gray-600 bg-gray-800 hover:border-gray-400"
                    }`}
                  >
                    <div className="w-10 h-10 mx-auto bg-gradient-to-b from-gray-600 to-gray-800 rounded flex items-center justify-center text-2xl">
                      {["🌿", "💙", "⚔️", "👑", "🔮"][sprite.id]}
                    </div>
                    <p className="font-pixel text-[6px] text-gray-400 text-center mt-1 truncate">
                      {sprite.name}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSelector(false)}
                className="flex-1 font-pixel text-xs py-3 bg-gray-700 border-2 border-gray-500 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleEnterWorld}
                disabled={!useDefaultSprite && !generatedSpriteUrl}
                className="flex-1 font-pixel text-xs py-3 bg-gradient-to-b from-green-500 to-green-700 border-2 border-green-300 text-white rounded hover:from-green-400 hover:to-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ENTER PARK
              </button>
            </div>

            {/* Instructions */}
            <div className="mt-4 p-3 bg-gray-800/50 rounded border border-gray-700">
              <p className="font-pixel text-[8px] text-gray-500 text-center">
                WASD or Arrow keys to move • E to interact
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
