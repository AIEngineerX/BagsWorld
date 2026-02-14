"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ScreenProps } from "../types";
import { IntroMusic } from "../introMusic";

/*
 * Pokemon Crystal–inspired title screen:
 *
 *  0.0s  — Black void, dense twinkling starfield
 *  0.5s  — Shooting star streaks across with SFX whoosh
 *  1.2s  — Music starts (chiptune intro theme)
 *  1.6s  — Logo revealed via horizontal line-scan wipe (Crystal-style)
 *  2.2s  — Logo glow intensifies with chime SFX
 *  2.6s  — Subtitle fades in
 *  3.0s  — Running silhouette crosses the bottom (like Suicune)
 *  3.6s  — "PRESS START" hard-blinks
 *  4.0s  — Second shooting star from opposite direction
 */

const PHASE = {
  SHOOT1: 0.5,
  MUSIC: 1.2,
  LOGO: 1.6,
  LOGO_GLOW: 2.2,
  SUBTITLE: 2.6,
  RUNNER: 3.0,
  PRESS_START: 3.6,
  SHOOT2: 4.0,
} as const;

export function TitleScreen({ onAdvance }: ScreenProps) {
  const [ready, setReady] = useState(false);
  const musicRef = useRef<IntroMusic | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Start music after delay, stop on unmount
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      musicRef.current = new IntroMusic();
      musicRef.current.start(0.07);
    }, PHASE.MUSIC * 1000);

    return () => {
      clearTimeout(timer);
      musicRef.current?.stop();
      musicRef.current = null;
    };
  }, [ready]);

  // SFX triggers synced to animation phases
  useEffect(() => {
    if (!ready) return;
    const whooshTimer = setTimeout(() => IntroMusic.playSfx("whoosh"), PHASE.SHOOT1 * 1000);
    const chimeTimer = setTimeout(() => IntroMusic.playSfx("chime"), PHASE.LOGO_GLOW * 1000);
    return () => {
      clearTimeout(whooshTimer);
      clearTimeout(chimeTimer);
    };
  }, [ready]);

  // Layer 1: Dense static twinkling stars
  const twinkleStars = useMemo(() => {
    return Array.from({ length: 90 }, (_, i) => {
      const rng = Math.random();
      return {
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: rng > 0.9 ? 3 : rng > 0.7 ? 2 : 1,
        color: rng > 0.92 ? "#EAB308" : rng > 0.8 ? "#93C5FD" : "#FFFFFF",
        twinkleDuration: 1.2 + Math.random() * 2.5,
        twinkleDelay: Math.random() * 3,
        baseOpacity: 0.15 + Math.random() * 0.6,
      };
    });
  }, []);

  // Layer 2: Slow-drifting stars
  const driftStars = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      startTop: Math.random() * 100,
      size: Math.random() > 0.5 ? 2 : 1,
      duration: 10 + Math.random() * 15,
      delay: Math.random() * 5,
      opacity: 0.1 + Math.random() * 0.3,
    }));
  }, []);

  // Layer 3: Flash stars — brief bright flashes like Crystal
  const flashStars = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: 10 + Math.random() * 80,
      top: 5 + Math.random() * 50,
      flashDelay: 1 + Math.random() * 6,
      flashDuration: 0.4 + Math.random() * 0.4,
    }));
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        musicRef.current?.stop();
        onAdvance();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAdvance]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    musicRef.current?.stop();
    onAdvance();
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="absolute inset-0 bg-black overflow-hidden cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* ── Deep space gradient ── */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(ellipse at 30% 15%, rgba(30, 20, 70, 0.9) 0%, transparent 55%), " +
            "radial-gradient(ellipse at 70% 75%, rgba(10, 30, 60, 0.7) 0%, transparent 45%), " +
            "radial-gradient(ellipse at 50% 50%, rgba(20, 10, 40, 0.4) 0%, transparent 70%)",
        }}
      />

      {/* ── Layer 1: Static twinkling stars ── */}
      {twinkleStars.map((s) => (
        <span
          key={`tw-${s.id}`}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            opacity: s.baseOpacity,
            animation: ready
              ? `twinkle ${s.twinkleDuration}s ease-in-out ${s.twinkleDelay}s infinite`
              : "none",
          }}
        />
      ))}

      {/* ── Layer 2: Slow-drifting stars ── */}
      {driftStars.map((s) => (
        <span
          key={`dr-${s.id}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.startTop}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animation: ready
              ? `starDrift ${s.duration}s linear ${s.delay}s infinite`
              : "none",
          }}
        />
      ))}

      {/* ── Layer 3: Flash stars (brief bright flashes like Crystal) ── */}
      {flashStars.map((s) => (
        <span
          key={`fl-${s.id}`}
          className="absolute"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: 5,
            height: 5,
            opacity: 0,
            animation: ready
              ? `starFlash ${s.flashDuration}s ease-out ${s.flashDelay}s infinite`
              : "none",
          }}
        >
          {/* Cross-shaped flash */}
          <span
            className="absolute bg-white"
            style={{ width: 5, height: 1, top: 2, left: 0 }}
          />
          <span
            className="absolute bg-white"
            style={{ width: 1, height: 5, top: 0, left: 2 }}
          />
        </span>
      ))}

      {/* ── Shooting star 1 (left to right) ── */}
      <div
        className="absolute z-[2]"
        style={{
          top: "12%",
          left: "-5%",
          animation: ready
            ? `shootingStar 1.2s ease-out ${PHASE.SHOOT1}s both`
            : "none",
        }}
      >
        <div
          className="w-[4px] h-[4px] bg-white rounded-full"
          style={{
            boxShadow:
              "0 0 4px 2px #fff, 0 0 10px 4px rgba(34,197,94,0.5), 0 0 20px 8px rgba(34,197,94,0.2)",
          }}
        />
        <div
          className="absolute top-[1px] right-[4px] h-[2px]"
          style={{
            width: 70,
            background:
              "linear-gradient(to left, transparent 0%, rgba(255,255,255,0.9) 15%, rgba(34,197,94,0.4) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Shooting star 2 (right to left, delayed) ── */}
      <div
        className="absolute z-[2]"
        style={{
          top: "58%",
          right: "-5%",
          animation: ready
            ? `shootingStar2 0.9s ease-out ${PHASE.SHOOT2}s both`
            : "none",
        }}
      >
        <div
          className="w-[3px] h-[3px] bg-white rounded-full"
          style={{ boxShadow: "0 0 4px 1px #fff, 0 0 10px 3px rgba(234,179,8,0.4)" }}
        />
        <div
          className="absolute top-[0px] left-[3px] h-[1px]"
          style={{
            width: 40,
            background: "linear-gradient(to right, transparent, rgba(255,255,255,0.7), transparent)",
          }}
        />
      </div>

      {/* ── Centered content ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Logo — Crystal-style line-scan wipe reveal */}
        <div
          className="relative z-10 mb-1 overflow-hidden"
          style={{
            animation: ready
              ? `lineScanReveal 0.6s ease-out ${PHASE.LOGO}s both`
              : "none",
          }}
        >
          <h1
            className="font-pixel text-2xl sm:text-4xl text-bags-green whitespace-nowrap"
            style={{
              textShadow:
                "0 0 10px #22C55E, 0 0 20px #22C55E, 0 0 40px #16A34A, 0 2px 0 #0a4a1e",
              animation: ready
                ? `titleGlow 2s ease-in-out ${PHASE.LOGO_GLOW}s infinite`
                : "none",
            }}
          >
            BAGSWORLD
          </h1>
        </div>

        {/* Subtitle */}
        <p
          className="font-pixel text-[8px] text-gray-500 mb-8 z-10"
          style={{
            opacity: 0,
            animation: ready ? `fadeIn 0.6s ease-out ${PHASE.SUBTITLE}s both` : "none",
          }}
        >
          A Living Crypto World on Solana
        </p>

        {/* "PRESS START" */}
        <p
          className="font-pixel text-[10px] text-white z-10"
          style={{
            opacity: 0,
            animation: ready
              ? `fadeIn 0.3s ease-out ${PHASE.PRESS_START}s both, hardBlink 1s linear ${PHASE.PRESS_START + 0.3}s infinite`
              : "none",
          }}
        >
          [ PRESS START ]
        </p>
      </div>

      {/* ── Running silhouette at bottom (like Suicune in Crystal) ── */}
      <div
        className="absolute z-[3]"
        style={{
          bottom: "12%",
          left: "-15%",
          animation: ready
            ? `runAcross 3.5s linear ${PHASE.RUNNER}s both`
            : "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/agents/ash.png"
          alt=""
          width={32}
          height={32}
          className="opacity-30"
          style={{
            imageRendering: "pixelated",
            filter: "brightness(0) invert(0.3) sepia(1) saturate(3) hue-rotate(100deg)",
          }}
          draggable={false}
        />
      </div>

      {/* ── Ground line for runner ── */}
      <div
        className="absolute left-0 right-0 z-[2] h-[1px]"
        style={{
          bottom: "11%",
          opacity: 0,
          animation: ready ? `fadeIn 0.3s ease-out ${PHASE.RUNNER}s both` : "none",
          background: "linear-gradient(to right, transparent, rgba(34,197,94,0.15), transparent)",
        }}
      />

      {/* ── Copyright ── */}
      <p
        className="absolute bottom-3 left-0 right-0 text-center font-pixel text-[6px] text-gray-700 z-10"
        style={{
          opacity: 0,
          animation: ready ? `fadeIn 0.5s ease-out ${PHASE.PRESS_START}s both` : "none",
        }}
      >
        2026 BAGS.FM
      </p>

      {/* ── All keyframe animations ── */}
      <style jsx>{`
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.15;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.4);
          }
        }

        @keyframes starDrift {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(40px);
          }
        }

        @keyframes starFlash {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          15% {
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            opacity: 0;
            transform: scale(0.5);
          }
        }

        @keyframes shootingStar {
          0% {
            transform: translate(0, 0) scale(0.3);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          85% {
            opacity: 0.8;
          }
          100% {
            transform: translate(calc(100vw + 10%), 25vh) scale(1);
            opacity: 0;
          }
        }

        @keyframes shootingStar2 {
          0% {
            transform: translate(0, 0) scale(0.3);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          80% {
            opacity: 0.6;
          }
          100% {
            transform: translate(calc(-100vw - 10%), 12vh) scale(0.8);
            opacity: 0;
          }
        }

        @keyframes lineScanReveal {
          0% {
            clip-path: inset(0 100% 0 0);
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          100% {
            clip-path: inset(0 0% 0 0);
            opacity: 1;
          }
        }

        @keyframes titleGlow {
          0%,
          100% {
            text-shadow:
              0 0 10px #22c55e,
              0 0 20px #22c55e,
              0 0 40px #16a34a,
              0 2px 0 #0a4a1e;
          }
          50% {
            text-shadow:
              0 0 20px #22c55e,
              0 0 40px #22c55e,
              0 0 80px #16a34a,
              0 0 120px #0f5132,
              0 2px 0 #0a4a1e;
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

        @keyframes hardBlink {
          0% {
            opacity: 1;
          }
          59.9% {
            opacity: 1;
          }
          60% {
            opacity: 0;
          }
          99.9% {
            opacity: 0;
          }
        }

        @keyframes runAcross {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(100vw + 100px));
          }
        }
      `}</style>
    </div>
  );
}
