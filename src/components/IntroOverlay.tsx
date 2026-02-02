"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// PALETTE colors from BootScene.ts
const COLORS = {
  void: "#0a0a0f",
  bagsGreen: "#4ade80",
  darkGreen: "#14532d",
  forest: "#166534",
  mint: "#86efac",
  gold: "#fbbf24",
  purple: "#7c3aed",
  gray: "#374151",
  lightGray: "#6b7280",
  white: "#ffffff",
};

// Bagsy dialogue - matches bagsy.character.ts personality
const BAGSY_DIALOGUE = [
  "gm fren! im bagsy :)",
  "welcome to BagsWorld!",
  "a living world powered by Bags.fm",
  "creators earn 1% trading fees forever",
  "explore zones, meet characters, claim your bags!",
];

// Scene previews
const SCENE_PREVIEWS = [
  {
    title: "PARK",
    subtitle: "Meet the Team",
    description: "Chat with Ash, Toly, Finn & friends",
    gradient: ["#166534", "#14532d"],
  },
  {
    title: "BAGSCITY",
    subtitle: "Urban Hub",
    description: "Casino, Terminal, Trading Gym",
    gradient: ["#2d1b4e", "#1e3a8a"],
  },
  {
    title: "HQ",
    subtitle: "Headquarters",
    description: "The Bags.fm team at work",
    gradient: ["#1a1a2e", "#0a0a0f"],
  },
];

interface IntroOverlayProps {
  onComplete: () => void;
}

export function IntroOverlay({ onComplete }: IntroOverlayProps) {
  const [stage, setStage] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const stageInitialized = useRef<Set<number>>(new Set());

  // Generate pixel stars on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Fill background
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw pixel stars
    const starCount = Math.floor((canvas.width * canvas.height) / 8000);
    for (let i = 0; i < starCount; i++) {
      const x = Math.floor(Math.random() * canvas.width);
      const y = Math.floor(Math.random() * canvas.height);
      const size = Math.random() > 0.7 ? 2 : 1;
      const brightness = 0.3 + Math.random() * 0.7;

      ctx.fillStyle = `rgba(74, 222, 128, ${brightness * 0.5})`;
      ctx.fillRect(x, y, size, size);
    }

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = COLORS.void;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const newStarCount = Math.floor((canvas.width * canvas.height) / 8000);
      for (let i = 0; i < newStarCount; i++) {
        const x = Math.floor(Math.random() * canvas.width);
        const y = Math.floor(Math.random() * canvas.height);
        const size = Math.random() > 0.7 ? 2 : 1;
        const brightness = 0.3 + Math.random() * 0.7;
        ctx.fillStyle = `rgba(74, 222, 128, ${brightness * 0.5})`;
        ctx.fillRect(x, y, size, size);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Typewriter effect
  const typeText = useCallback((text: string, onDone: () => void) => {
    setIsTyping(true);
    setDisplayedText("");
    let index = 0;

    const type = () => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
        typewriterRef.current = setTimeout(type, 50);
      } else {
        setIsTyping(false);
        onDone();
      }
    };

    typewriterRef.current = setTimeout(type, 50);
  }, []);

  // Skip typewriter
  const skipTypewriter = useCallback(() => {
    if (typewriterRef.current) {
      clearTimeout(typewriterRef.current);
      typewriterRef.current = null;
    }
  }, []);

  // Handle click to advance
  const handleClick = useCallback(() => {
    if (showButtons) return; // Don't advance if buttons are showing

    if (isTyping) {
      // Skip to end of current text
      skipTypewriter();
      if (stage === 1) {
        setDisplayedText("Welcome to the world of...");
        setIsTyping(false);
      } else if (stage === 3 && dialogueIndex < BAGSY_DIALOGUE.length) {
        setDisplayedText(BAGSY_DIALOGUE[dialogueIndex]);
        setIsTyping(false);
      }
    } else {
      // Advance to next stage/dialogue
      if (stage === 3 && dialogueIndex < BAGSY_DIALOGUE.length - 1) {
        setDialogueIndex((prev) => prev + 1);
      } else if (stage < 6) {
        setStage((prev) => prev + 1);
      }
    }
  }, [isTyping, showButtons, skipTypewriter, stage, dialogueIndex]);

  // Stage progression
  useEffect(() => {
    // Prevent re-running stage initialization
    if (stageInitialized.current.has(stage)) return;

    if (stage === 0) {
      stageInitialized.current.add(0);
      const timer = setTimeout(() => setStage(1), 500);
      return () => clearTimeout(timer);
    }

    if (stage === 1) {
      stageInitialized.current.add(1);
      typeText("Welcome to the world of...", () => {
        setTimeout(() => setStage(2), 1000);
      });
    }

    if (stage === 2) {
      stageInitialized.current.add(2);
      const timer = setTimeout(() => setStage(3), 2000);
      return () => clearTimeout(timer);
    }

    if (stage === 3 && dialogueIndex === 0) {
      stageInitialized.current.add(3);
      typeText(BAGSY_DIALOGUE[0], () => {});
    }

    if (stage === 4) {
      stageInitialized.current.add(4);
      const interval = setInterval(() => {
        setSceneIndex((prev) => {
          if (prev >= SCENE_PREVIEWS.length - 1) {
            clearInterval(interval);
            setTimeout(() => setStage(5), 2000);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
      return () => clearInterval(interval);
    }

    if (stage === 5) {
      stageInitialized.current.add(5);
      const timer = setTimeout(() => setStage(6), 1000);
      return () => clearTimeout(timer);
    }

    if (stage === 6) {
      stageInitialized.current.add(6);
      setShowButtons(true);
    }
  }, [stage, typeText, dialogueIndex]);

  // Handle dialogue progression
  useEffect(() => {
    if (stage === 3 && dialogueIndex > 0 && dialogueIndex < BAGSY_DIALOGUE.length) {
      typeText(BAGSY_DIALOGUE[dialogueIndex], () => {
        if (dialogueIndex === BAGSY_DIALOGUE.length - 1) {
          setTimeout(() => setStage(4), 1500);
        }
      });
    }
  }, [dialogueIndex, stage, typeText]);

  const handleComplete = () => {
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      onClick={handleClick}
      style={{ backgroundColor: COLORS.void }}
    >
      {/* Pixel star background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ opacity: stage >= 1 ? 1 : 0, transition: "opacity 0.5s" }}
      />

      {/* Skip button - always visible */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleComplete();
        }}
        className="absolute top-4 right-4 z-10 font-pixel text-xs px-4 py-2 border-2 transition-all hover:bg-white/10"
        style={{
          color: COLORS.lightGray,
          borderColor: COLORS.gray,
        }}
      >
        SKIP
      </button>

      {/* Stage 1: Welcome text */}
      {stage >= 1 && stage < 2 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p
            className="font-pixel text-lg md:text-2xl text-center animate-pulse-slow"
            style={{ color: COLORS.bagsGreen }}
          >
            {displayedText}
            {isTyping && <span className="animate-blink">_</span>}
          </p>
        </div>
      )}

      {/* Stage 2: BAGSWORLD logo */}
      {stage >= 2 && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${
            stage === 2
              ? "opacity-100"
              : stage >= 3
                ? "opacity-100 -translate-y-24 md:-translate-y-32"
                : "opacity-0"
          }`}
        >
          {stage === 2 && (
            <p
              className="font-pixel text-sm md:text-lg mb-4 animate-fade-in"
              style={{ color: COLORS.lightGray }}
            >
              Welcome to the world of...
            </p>
          )}
          <h1
            className={`font-pixel text-4xl md:text-6xl lg:text-7xl tracking-wider ${
              stage === 2 ? "animate-logo-bounce" : ""
            }`}
            style={{
              color: COLORS.bagsGreen,
              textShadow: `0 0 20px ${COLORS.bagsGreen}40, 0 0 40px ${COLORS.bagsGreen}20`,
            }}
          >
            BAGSWORLD
          </h1>
          <p
            className="font-pixel text-xs md:text-sm mt-2 animate-fade-in"
            style={{ color: COLORS.lightGray, animationDelay: "0.5s" }}
          >
            A Living Crypto World
          </p>
        </div>
      )}

      {/* Stage 3: Bagsy character and dialogue */}
      {stage >= 3 && stage < 4 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-32 md:pt-40">
          {/* Bagsy mascot - CSS pixel art */}
          <div className="relative mb-6 animate-bagsy-idle">
            {/* Bagsy body - green money bag */}
            <div
              className="w-20 h-24 md:w-24 md:h-28 rounded-t-full relative"
              style={{
                background: `linear-gradient(135deg, ${COLORS.mint} 0%, ${COLORS.bagsGreen} 50%, ${COLORS.forest} 100%)`,
                boxShadow: `0 4px 0 ${COLORS.darkGreen}, inset -4px -4px 0 ${COLORS.forest}`,
              }}
            >
              {/* Knot/hat on top */}
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-4 md:w-8 md:h-5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.mint} 0%, ${COLORS.bagsGreen} 100%)`,
                  boxShadow: `0 2px 0 ${COLORS.darkGreen}`,
                }}
              />
              {/* Eyes */}
              <div className="absolute top-8 left-4 md:left-5 w-3 h-4 md:w-4 md:h-5 bg-black rounded-full" />
              <div className="absolute top-8 right-4 md:right-5 w-3 h-4 md:w-4 md:h-5 bg-black rounded-full" />
              {/* Eye shine */}
              <div className="absolute top-9 left-5 md:left-6 w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full" />
              <div className="absolute top-9 right-5 md:right-6 w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full" />
              {/* Smile */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-4 md:w-10 md:h-5 border-b-4 border-black rounded-b-full" />
              {/* Dollar sign */}
              <div
                className="absolute bottom-10 left-1/2 -translate-x-1/2 font-bold text-xl md:text-2xl"
                style={{ color: COLORS.darkGreen }}
              >
                $
              </div>
            </div>
          </div>

          {/* Dialogue box */}
          <div
            className="mx-4 md:mx-8 max-w-md w-full p-4 md:p-6 border-4 rounded-lg relative"
            style={{
              backgroundColor: `${COLORS.void}ee`,
              borderColor: COLORS.bagsGreen,
              boxShadow: `0 0 20px ${COLORS.bagsGreen}30`,
            }}
          >
            {/* Dialogue arrow */}
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: "12px solid transparent",
                borderRight: "12px solid transparent",
                borderBottom: `12px solid ${COLORS.bagsGreen}`,
              }}
            />
            <p
              className="font-pixel text-sm md:text-base text-center min-h-[3rem]"
              style={{ color: COLORS.bagsGreen }}
            >
              {displayedText}
              {isTyping && <span className="animate-blink">_</span>}
            </p>
            {/* Progress dots */}
            <div className="flex justify-center gap-2 mt-4">
              {BAGSY_DIALOGUE.map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    backgroundColor: i <= dialogueIndex ? COLORS.bagsGreen : COLORS.gray,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Tap to continue hint */}
          <p
            className="font-pixel text-[10px] mt-6 animate-pulse"
            style={{ color: COLORS.lightGray }}
          >
            [TAP TO CONTINUE]
          </p>
        </div>
      )}

      {/* Stage 4: Scene previews */}
      {stage === 4 && (
        <div className="absolute inset-0 flex items-center justify-center pt-24 md:pt-32">
          <div className="w-full max-w-lg mx-4">
            {SCENE_PREVIEWS.map((scene, i) => (
              <div
                key={scene.title}
                className={`transition-all duration-500 ${
                  i === sceneIndex
                    ? "opacity-100 translate-x-0"
                    : i < sceneIndex
                      ? "opacity-0 -translate-x-full absolute"
                      : "opacity-0 translate-x-full absolute"
                }`}
                style={{ display: i === sceneIndex ? "block" : "none" }}
              >
                {/* Scene card */}
                <div
                  className="p-6 md:p-8 border-4 rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${scene.gradient[0]} 0%, ${scene.gradient[1]} 100%)`,
                    borderColor: COLORS.bagsGreen,
                  }}
                >
                  <h3
                    className="font-pixel text-2xl md:text-3xl mb-2"
                    style={{ color: COLORS.bagsGreen }}
                  >
                    {scene.title}
                  </h3>
                  <p
                    className="font-pixel text-sm md:text-base mb-4"
                    style={{ color: COLORS.gold }}
                  >
                    {scene.subtitle}
                  </p>
                  <p className="font-pixel text-xs md:text-sm" style={{ color: COLORS.white }}>
                    {scene.description}
                  </p>
                </div>

                {/* Scene dots */}
                <div className="flex justify-center gap-2 mt-6">
                  {SCENE_PREVIEWS.map((_, j) => (
                    <div
                      key={j}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{
                        backgroundColor: j <= sceneIndex ? COLORS.bagsGreen : COLORS.gray,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage 5: Ready to explore */}
      {stage === 5 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p
            className="font-pixel text-xl md:text-2xl text-center animate-pulse"
            style={{ color: COLORS.bagsGreen }}
          >
            Ready to explore?
          </p>
        </div>
      )}

      {/* Stage 6: NEW GAME / CONTINUE buttons */}
      {stage === 6 && showButtons && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <h2
            className="font-pixel text-3xl md:text-4xl mb-12"
            style={{
              color: COLORS.bagsGreen,
              textShadow: `0 0 20px ${COLORS.bagsGreen}40`,
            }}
          >
            BAGSWORLD
          </h2>

          <div className="flex flex-col gap-4 w-64">
            {/* NEW GAME button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleComplete();
              }}
              className="group font-pixel text-lg py-4 px-8 border-4 rounded transition-all hover:scale-105 active:scale-95 animate-button-pulse"
              style={{
                backgroundColor: COLORS.void,
                borderColor: COLORS.bagsGreen,
                color: COLORS.bagsGreen,
                boxShadow: `0 0 20px ${COLORS.bagsGreen}30`,
              }}
            >
              <span className="group-hover:animate-pulse">NEW GAME</span>
            </button>

            {/* CONTINUE button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleComplete();
              }}
              className="group font-pixel text-lg py-4 px-8 border-4 rounded transition-all hover:scale-105 active:scale-95"
              style={{
                backgroundColor: COLORS.void,
                borderColor: COLORS.gray,
                color: COLORS.lightGray,
              }}
            >
              <span className="group-hover:text-white transition-colors">CONTINUE</span>
            </button>
          </div>

          {/* Hint text */}
          <p className="font-pixel text-[10px] mt-8" style={{ color: COLORS.lightGray }}>
            WASD or Arrow keys to move | E to interact
          </p>
        </div>
      )}

      {/* Custom styles */}
      <style jsx>{`
        @keyframes blink {
          0%,
          50% {
            opacity: 1;
          }
          51%,
          100% {
            opacity: 0;
          }
        }

        @keyframes logo-bounce {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          70% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bagsy-idle {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-4px) scale(1.02);
          }
        }

        @keyframes button-pulse {
          0%,
          100% {
            box-shadow: 0 0 20px ${COLORS.bagsGreen}30;
          }
          50% {
            box-shadow:
              0 0 30px ${COLORS.bagsGreen}50,
              0 0 40px ${COLORS.bagsGreen}20;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-blink {
          animation: blink 0.7s infinite;
        }

        .animate-logo-bounce {
          animation: logo-bounce 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }

        .animate-bagsy-idle {
          animation: bagsy-idle 2s ease-in-out infinite;
        }

        .animate-button-pulse {
          animation: button-pulse 2s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
          opacity: 0;
        }

        .animate-pulse-slow {
          animation: pulse 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
