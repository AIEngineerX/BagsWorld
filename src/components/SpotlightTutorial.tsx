"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type TutorialStep = 0 | 1 | 2 | 3;

const STEPS: {
  desktop: string;
  mobile: string;
  hint: string;
}[] = [
  {
    desktop: "Use WASD to walk around",
    mobile: "Use the joystick to walk",
    hint: "Try moving in any direction",
  },
  {
    desktop: "Walk to a character and press E to talk",
    mobile: "Walk to a character and tap the interact button",
    hint: "Look for the bouncing arrow above them",
  },
  {
    desktop: "Click a building to see its token data",
    mobile: "Tap a building to see its token data",
    hint: "Buildings represent real tokens on Bags.fm",
  },
  {
    desktop: "You\u2019re ready! Explore zones, talk to characters, launch your own token.",
    mobile: "You\u2019re ready! Explore zones, talk to characters, launch your own token.",
    hint: "",
  },
];

const MOVE_THRESHOLD = 50;

interface SpotlightTutorialProps {
  active: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function SpotlightTutorial({ active, onComplete, onSkip }: SpotlightTutorialProps) {
  const [step, setStep] = useState<TutorialStep>(0);
  const [visible, setVisible] = useState(false);
  const isMobile = useRef(false);
  const cumulativeMove = useRef(0);
  const lastPlayerPos = useRef<{ x: number; y: number } | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    isMobile.current =
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      window.matchMedia("(pointer: coarse)").matches;
  }, []);

  // Fade in
  useEffect(() => {
    if (active) {
      const timer = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [active]);

  // Tell Phaser which tutorial step we're on so it can show quest markers
  useEffect(() => {
    if (!active) {
      window.dispatchEvent(new CustomEvent("bagsworld-tutorial-step", { detail: { step: -1 } }));
      return;
    }
    window.dispatchEvent(new CustomEvent("bagsworld-tutorial-step", { detail: { step } }));
  }, [active, step]);

  // Step 0: track movement
  useEffect(() => {
    if (!active || step !== 0) return;

    const handlePosition = (e: Event) => {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (lastPlayerPos.current) {
        const dx = x - lastPlayerPos.current.x;
        const dy = y - lastPlayerPos.current.y;
        cumulativeMove.current += Math.sqrt(dx * dx + dy * dy);
      }
      lastPlayerPos.current = { x, y };
      if (cumulativeMove.current >= MOVE_THRESHOLD) setStep(1);
    };

    window.addEventListener("bagsworld-player-position", handlePosition);
    return () => window.removeEventListener("bagsworld-player-position", handlePosition);
  }, [active, step]);

  // Step 1: any NPC interaction
  useEffect(() => {
    if (!active || step !== 1) return;

    const advance = () => setStep(2);
    const events = [
      "bagsworld-ash-click",
      "bagsworld-toly-click",
      "bagsworld-finn-click",
      "bagsworld-shaw-click",
      "bagsworld-dev-click",
      "bagsworld-neo-click",
      "bagsworld-cj-click",
      "bagsworld-ramo-click",
      "bagsworld-bagsy-click",
    ];
    events.forEach((e) => window.addEventListener(e, advance));
    return () => events.forEach((e) => window.removeEventListener(e, advance));
  }, [active, step]);

  // Step 2: building click
  useEffect(() => {
    if (!active || step !== 2) return;

    const advance = () => setStep(3);
    window.addEventListener("bagsworld-building-click", advance);
    return () => window.removeEventListener("bagsworld-building-click", advance);
  }, [active, step]);

  // Step 3: auto-dismiss
  useEffect(() => {
    if (!active || step !== 3 || completedRef.current) return;
    completedRef.current = true;
    const timer = setTimeout(onComplete, 5000);
    return () => clearTimeout(timer);
  }, [active, step, onComplete]);

  // ESC to skip
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, onSkip]);

  const handleSkipClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSkip();
    },
    [onSkip]
  );

  if (!active) return null;

  const currentStep = STEPS[step];
  const text = isMobile.current ? currentStep.mobile : currentStep.desktop;

  return (
    <div
      className={`fixed bottom-20 sm:bottom-12 left-1/2 -translate-x-1/2 z-[55] w-[92vw] max-w-md transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="bg-black/85 border border-green-500/60 rounded-lg px-4 py-3 backdrop-blur-sm shadow-[0_0_20px_rgba(34,197,94,0.1)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Step counter + dots */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-pixel text-[9px] text-green-400 shrink-0">
                {step < 3 ? `${step + 1}/${STEPS.length}` : "DONE"}
              </span>
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                      i <= step ? "bg-green-400" : "bg-gray-700"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Instruction */}
            <p className="font-pixel text-[10px] sm:text-[11px] text-white leading-relaxed">
              {text}
            </p>

            {/* Hint */}
            {currentStep.hint && (
              <p className="font-pixel text-[7px] text-gray-500 mt-1">{currentStep.hint}</p>
            )}
          </div>

          {/* Skip button */}
          {step < 3 && (
            <button
              onClick={handleSkipClick}
              className="font-pixel text-[8px] text-gray-600 hover:text-gray-400 transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              SKIP
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
