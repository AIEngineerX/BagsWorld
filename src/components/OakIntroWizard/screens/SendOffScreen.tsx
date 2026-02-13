"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { ScreenProps } from "../types";
import { DIALOGUE } from "../constants";
import { DialogueBox } from "../DialogueBox";
import { OakSprite, TrainerSprite } from "../PixelSprites";

export function SendOffScreen({ state, onAdvance }: ScreenProps) {
  const [dialogueComplete, setDialogueComplete] = useState(false);
  const [fadeToWhite, setFadeToWhite] = useState(false);

  // Sparkle positions
  const sparkles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: `${20 + Math.floor(Math.random() * 60)}%`,
        top: `${10 + Math.floor(Math.random() * 40)}%`,
        delay: `${(Math.random() * 2).toFixed(2)}s`,
        size: Math.random() > 0.5 ? 6 : 4,
      })),
    []
  );

  // After dialogue completes, start trainer walk then fade
  useEffect(() => {
    if (!dialogueComplete) return;

    const fadeTimer = setTimeout(() => {
      setFadeToWhite(true);
    }, 2000);

    const advanceTimer = setTimeout(() => {
      onAdvance();
    }, 3500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(advanceTimer);
    };
  }, [dialogueComplete, onAdvance]);

  return (
    <div
      className="absolute inset-0 bg-gray-900 flex flex-col items-center overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-gray-800" />

      {/* Sparkles around image area */}
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          className="absolute z-[6]"
          style={{
            left: sparkle.left,
            top: sparkle.top,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: sparkle.delay,
            animation: `sparkle 1.5s ease-in-out infinite`,
          }}
        >
          <div
            className="w-full h-full bg-bags-gold"
            style={{
              clipPath:
                "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
            }}
          />
        </div>
      ))}

      {/* Token image */}
      {state.tokenImageUrl && (
        <div className="relative z-[5] mt-[10%] sm:mt-[8%] mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-bags-gold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.tokenImageUrl}
              alt={state.tokenName || "Token"}
              className="w-full h-full object-cover"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        </div>
      )}

      {/* Oak sprite */}
      <div className="relative z-[5] mb-2">
        <OakSprite className="scale-[1.5]" />
      </div>

      {/* Trainer walking right after dialogue completes */}
      <div
        className="absolute bottom-[100px] z-[5]"
        style={{
          left: dialogueComplete ? "110%" : "30%",
          transition: "left 3s ease-in",
        }}
      >
        <TrainerSprite className="scale-[1.5]" />
      </div>

      {/* Status text */}
      {dialogueComplete && (
        <div className="relative z-[7] px-4">
          <p className="font-pixel text-[9px] text-bags-gold text-center animate-pulse">
            Your building is now appearing in BagsWorld...
          </p>
        </div>
      )}

      {/* Dialogue */}
      {!dialogueComplete && (
        <DialogueBox
          lines={DIALOGUE.sendoff}
          speakerName="PROF. OAK"
          onComplete={() => setDialogueComplete(true)}
        />
      )}

      {/* Fade to white overlay */}
      <div
        className="absolute inset-0 bg-white z-20 pointer-events-none transition-opacity duration-1500"
        style={{
          opacity: fadeToWhite ? 1 : 0,
          transitionDuration: "1.5s",
        }}
      />

      <style jsx>{`
        @keyframes sparkle {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.5) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }
      `}</style>
    </div>
  );
}
