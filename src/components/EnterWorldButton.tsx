"use client";

import { useState, useEffect, useRef } from "react";

interface EnterWorldButtonProps {
  className?: string;
}

// Default sprite variants (fallback if AI generation fails)
// Colors match SHIRT_COLORS in BootScene.ts: green, blue, red, gold, purple, pink, cyan, orange, gray
const DEFAULT_SPRITES = [
  { id: 0, name: "Green Explorer" },
  { id: 1, name: "Blue Adventurer" },
  { id: 2, name: "Red Warrior" },
  { id: 3, name: "Gold Knight" },
  { id: 4, name: "Purple Mage" },
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for player enter/exit events
  useEffect(() => {
    const handleEntered = () => setIsInWorld(true);
    const handleExited = () => setIsInWorld(false);

    window.addEventListener("bagsworld-player-entered", handleEntered);
    window.addEventListener("bagsworld-player-exited", handleExited);

    return () => {
      window.removeEventListener("bagsworld-player-entered", handleEntered);
      window.removeEventListener("bagsworld-player-exited", handleExited);
    };
  }, []);

  const generateMemeSprite = async () => {
    if (!memePrompt.trim()) {
      setError("Enter a meme character to generate");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedSpriteUrl(null);
    setWalkSpriteSheetUrl(null);

    try {
      // Step 1: Generate character sprite
      setGenerationStep("Creating character...");
      const response = await fetch("/api/generate-meme-sprite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: memePrompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setGeneratedSpriteUrl(data.imageUrl);

      // Step 2: Generate walk animation sprite sheet
      setGenerationStep("Creating walk animation...");
      const walkResponse = await fetch("/api/generate-sprite-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl: data.imageUrl,
          type: "walk",
        }),
      });

      const walkData = await walkResponse.json();

      if (walkResponse.ok && walkData.imageUrl) {
        setWalkSpriteSheetUrl(walkData.imageUrl);
      }
      // Don't fail if walk animation fails - character is still usable

      setGenerationStep("");
    } catch (err) {
      console.error("Sprite generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate sprite");
      setGenerationStep("");
    } finally {
      setIsGenerating(false);
    }
  };

  // Stop keyboard events from reaching Phaser when typing
  const stopPropagation = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleEnterWorld = () => {
    // Switch to Park zone first
    window.dispatchEvent(
      new CustomEvent("bagsworld-zone-change", { detail: { zone: "main_city" } })
    );

    // Spawn the player with either generated sprite or default
    setTimeout(() => {
      if (useDefaultSprite || !generatedSpriteUrl) {
        // Use default sprite variant
        window.dispatchEvent(
          new CustomEvent("bagsworld-enter-world", {
            detail: { spriteVariant: selectedDefault },
          })
        );
      } else {
        // Use AI-generated meme sprite with optional walk animation
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
    }, 100);

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
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowSelector(false)}
        >
          <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-green-500 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="font-pixel text-green-400 text-lg mb-2">CREATE YOUR MEME AVATAR</h2>
              <p className="font-pixel text-gray-400 text-[10px]">
                Type any meme character and AI will generate your sprite
              </p>
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
                    onKeyPress={stopPropagation}
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

                {/* Generate Button */}
                <button
                  onClick={generateMemeSprite}
                  disabled={isGenerating || !memePrompt.trim()}
                  className={`w-full font-pixel text-sm py-3 rounded border-2 mb-4 transition-all ${
                    isGenerating
                      ? "bg-yellow-600 border-yellow-400 text-white animate-pulse"
                      : "bg-purple-600 border-purple-400 text-white hover:bg-purple-500"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isGenerating ? generationStep || "GENERATING..." : "GENERATE SPRITE"}
                </button>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded">
                    <p className="font-pixel text-[10px] text-red-400">{error}</p>
                  </div>
                )}

                {/* Generated Preview */}
                {generatedSpriteUrl && (
                  <div className="mb-4 p-4 bg-gray-800 rounded border border-green-500">
                    <p className="font-pixel text-[10px] text-green-400 mb-2 text-center">
                      YOUR MEME SPRITE
                    </p>
                    <div className="flex justify-center gap-4">
                      <div className="text-center">
                        <img
                          src={generatedSpriteUrl}
                          alt="Generated meme sprite"
                          className="w-24 h-24 object-contain rounded border-2 border-gray-600 bg-gray-900"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <p className="font-pixel text-[6px] text-gray-500 mt-1">CHARACTER</p>
                      </div>
                      {walkSpriteSheetUrl && (
                        <div className="text-center">
                          <img
                            src={walkSpriteSheetUrl}
                            alt="Walk animation sprite sheet"
                            className="w-24 h-24 object-contain rounded border-2 border-purple-600 bg-gray-900"
                            style={{ imageRendering: "pixelated" }}
                          />
                          <p className="font-pixel text-[6px] text-purple-400 mt-1">WALK CYCLE</p>
                        </div>
                      )}
                    </div>
                    <p className="font-pixel text-[8px] text-gray-400 text-center mt-2">
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
