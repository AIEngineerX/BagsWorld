"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ScreenProps } from "../types";

/*
 * Pokemon Red/Blue–inspired title screen with phased animation sequence:
 *
 *  0.0s  — Black screen, falling stars begin
 *  0.4s  — Shooting star streaks diagonally across screen
 *  1.4s  — Logo drops in from above with bounce
 *  2.0s  — Subtitle fades in
 *  2.6s  — Token sprite fades in below logo
 *  3.2s  — "PRESS START" begins hard blink
 */

// Animation phase delays (seconds)
const PHASE = {
  STAR: 0.4,
  LOGO: 1.4,
  SUBTITLE: 2.0,
  SPRITE: 2.6,
  PRESS_START: 3.2,
} as const;

export function TitleScreen({ onAdvance }: ScreenProps) {
  const [ready, setReady] = useState(false);

  // Trigger the animation sequence on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Falling star field — stars drift downward continuously
  const stars = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() > 0.7 ? 2 : 1,
      // Stagger start positions so stars are already distributed on screen
      startOffset: Math.random() * 100,
      duration: 4 + Math.random() * 6,
      delay: Math.random() * 4,
      color: Math.random() > 0.85 ? "#EAB308" : "#FFFFFF",
      opacity: 0.3 + Math.random() * 0.7,
    }));
  }, []);

  // Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        onAdvance();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAdvance]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="absolute inset-0 bg-black overflow-hidden cursor-pointer select-none"
      onClick={(e) => {
        e.stopPropagation();
        onAdvance();
      }}
    >
      {/* ── Falling star field ── */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            opacity: s.opacity,
            animation: ready ? `starFall ${s.duration}s linear ${s.delay}s infinite` : "none",
            top: `-${s.startOffset}%`,
          }}
        />
      ))}

      {/* ── Shooting star / comet ── */}
      <div
        className="absolute z-[2]"
        style={{
          top: "15%",
          left: "-10%",
          opacity: ready ? 1 : 0,
          animation: ready ? `shootingStar 1.0s ease-out ${PHASE.STAR}s both` : "none",
        }}
      >
        {/* Comet head */}
        <div
          className="w-[3px] h-[3px] bg-white rounded-full"
          style={{
            boxShadow: "0 0 6px 2px #fff, 0 0 12px 4px #22C55E",
          }}
        />
        {/* Comet tail */}
        <div
          className="absolute top-[1px] right-[3px] h-[1px]"
          style={{
            width: 40,
            background: "linear-gradient(to left, transparent, rgba(255,255,255,0.8), transparent)",
          }}
        />
      </div>

      {/* ── Centered content ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Logo — drops in from above with bounce */}
        <h1
          className="font-pixel text-2xl sm:text-4xl text-bags-green z-10 mb-1"
          style={{
            textShadow: "0 0 10px #22C55E, 0 0 20px #22C55E, 0 0 40px #16A34A",
            opacity: ready ? 1 : 0,
            animation: ready
              ? `logoDrop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${PHASE.LOGO}s both, titleGlow 2s ease-in-out ${PHASE.LOGO + 0.8}s infinite`
              : "none",
          }}
        >
          BAGSWORLD
        </h1>

        {/* Version / subtitle — fades in */}
        <p
          className="font-pixel text-[8px] text-gray-500 mb-6 z-10"
          style={{
            opacity: ready ? 1 : 0,
            animation: ready ? `fadeIn 0.6s ease-out ${PHASE.SUBTITLE}s both` : "none",
          }}
        >
          A Living Crypto World on Solana
        </p>

        {/* "PRESS START" — hard on/off blink like original Pokemon */}
        <p
          className="font-pixel text-[10px] text-white z-10"
          style={{
            opacity: ready ? 1 : 0,
            animation: ready
              ? `fadeIn 0.3s ease-out ${PHASE.PRESS_START}s both, hardBlink 1s step-end ${PHASE.PRESS_START + 0.3}s infinite`
              : "none",
          }}
        >
          [ PRESS START ]
        </p>
      </div>

      {/* ── Copyright line at bottom (like Pokemon) ── */}
      <p
        className="absolute bottom-3 left-0 right-0 text-center font-pixel text-[6px] text-gray-700 z-10"
        style={{
          opacity: ready ? 1 : 0,
          animation: ready ? `fadeIn 0.5s ease-out ${PHASE.PRESS_START}s both` : "none",
        }}
      >
        2025 BAGS.FM
      </p>

      {/* ── All keyframe animations ── */}
      <style jsx>{`
        @keyframes starFall {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(calc(100vh + 100%));
          }
        }

        @keyframes shootingStar {
          0% {
            transform: translate(0, 0) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translate(calc(100vw + 10%), 30vh) scale(1);
            opacity: 0;
          }
        }

        @keyframes logoDrop {
          0% {
            transform: translateY(-60px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes titleGlow {
          0%,
          100% {
            text-shadow:
              0 0 10px #22c55e,
              0 0 20px #22c55e,
              0 0 40px #16a34a;
          }
          50% {
            text-shadow:
              0 0 5px #22c55e,
              0 0 10px #22c55e,
              0 0 20px #16a34a;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes spriteReveal {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes hardBlink {
          0%,
          49.9% {
            opacity: 1;
          }
          50%,
          99.9% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
