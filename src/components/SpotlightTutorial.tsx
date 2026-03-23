"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type TutorialStep = 0 | 1 | 2 | 3;

const STEPS: {
  desktop: string;
  mobile: string;
  hint: string;
}[] = [
  {
    desktop: "Use WASD to walk around the world",
    mobile: "Use the joystick to walk around the world",
    hint: "Try moving in any direction",
  },
  {
    desktop: "Walk to Ash and press E to talk",
    mobile: "Walk to Ash and tap the interact button",
    hint: "Ash is the green character nearby",
  },
  {
    desktop: "Click a building to see its token data",
    mobile: "Tap a building to see its token data",
    hint: "Buildings represent real tokens on Bags.fm",
  },
  {
    desktop:
      "You\u2019re ready! Explore zones with the arrows, talk to characters, and launch your own token.",
    mobile: "You\u2019re ready! Swipe zones above, talk to characters, and launch your own token.",
    hint: "",
  },
];

const MOVE_THRESHOLD = 50; // pixels of cumulative movement to complete step 0

interface SpotlightTutorialProps {
  active: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function SpotlightTutorial({ active, onComplete, onSkip }: SpotlightTutorialProps) {
  const [step, setStep] = useState<TutorialStep>(0);
  const [visible, setVisible] = useState(false);
  const [targetPos, setTargetPos] = useState<{ x: number; y: number } | null>(null);
  const isMobile = useRef(false);
  const cumulativeMove = useRef(0);
  const lastPlayerPos = useRef<{ x: number; y: number } | null>(null);
  const completedRef = useRef(false);

  // Detect mobile once on mount
  useEffect(() => {
    isMobile.current =
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      window.matchMedia("(pointer: coarse)").matches;
  }, []);

  // Fade in on activation
  useEffect(() => {
    if (active) {
      const timer = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [active]);

  // Step 0 completion: track player movement
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

      if (cumulativeMove.current >= MOVE_THRESHOLD) {
        setStep(1);
      }
    };

    window.addEventListener("bagsworld-player-position", handlePosition);
    return () => window.removeEventListener("bagsworld-player-position", handlePosition);
  }, [active, step]);

  // Step 1 completion: NPC interaction (any character click event from Ash)
  useEffect(() => {
    if (!active || step !== 1) return;

    const handleNpcClick = () => setStep(2);

    // Listen for Ash specifically, but accept any NPC interaction
    const events = [
      "bagsworld-ash-click",
      "bagsworld-toly-click",
      "bagsworld-finn-click",
      "bagsworld-shaw-click",
      "bagsworld-dev-click",
    ];
    events.forEach((e) => window.addEventListener(e, handleNpcClick));
    return () => events.forEach((e) => window.removeEventListener(e, handleNpcClick));
  }, [active, step]);

  // Step 2 completion: building click
  useEffect(() => {
    if (!active || step !== 2) return;

    const handleBuildingClick = () => setStep(3);
    window.addEventListener("bagsworld-building-click", handleBuildingClick);
    return () => window.removeEventListener("bagsworld-building-click", handleBuildingClick);
  }, [active, step]);

  // Step 3: auto-dismiss after 5 seconds
  useEffect(() => {
    if (!active || step !== 3 || completedRef.current) return;
    completedRef.current = true;
    const timer = setTimeout(() => {
      onComplete();
    }, 5000);
    return () => clearTimeout(timer);
  }, [active, step, onComplete]);

  // Listen for target position updates (Ash's position from Phaser)
  useEffect(() => {
    if (!active || step !== 1) {
      setTargetPos(null);
      return;
    }

    const handleTarget = (e: Event) => {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
      setTargetPos({ x, y });
    };

    window.addEventListener("bagsworld-tutorial-target", handleTarget);
    return () => window.removeEventListener("bagsworld-tutorial-target", handleTarget);
  }, [active, step]);

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
      className={`fixed inset-0 z-[60] pointer-events-none transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Dark overlay — pointer-events none so joystick/game still works */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Spotlight cutout for step 1 (target NPC) */}
      {step === 1 && targetPos && (
        <>
          {/* Pulsing arrow above target */}
          <div
            className="absolute z-[62] animate-bounce"
            style={{
              left: targetPos.x - 10,
              top: targetPos.y - 50,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 16L4 6h12L10 16z" fill="#22c55e" />
            </svg>
          </div>
          {/* Glow ring around target */}
          <div
            className="absolute z-[61] rounded-full border-2 border-green-400 animate-pulse"
            style={{
              left: targetPos.x - 30,
              top: targetPos.y - 30,
              width: 60,
              height: 60,
              boxShadow: "0 0 20px rgba(34,197,94,0.4), inset 0 0 20px rgba(34,197,94,0.1)",
            }}
          />
        </>
      )}

      {/* Bottom speech bubble */}
      <div className="absolute bottom-20 sm:bottom-16 left-1/2 -translate-x-1/2 z-[63] pointer-events-auto w-[90vw] max-w-sm">
        <div className="bg-black/90 border-2 border-green-500 rounded-lg px-5 py-4 backdrop-blur-sm shadow-[0_0_30px_rgba(34,197,94,0.15)]">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-pixel text-[10px] text-green-400">
              {step < 3 ? `STEP ${step + 1} of ${STEPS.length}` : "READY!"}
            </span>
            {/* Progress dots */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    i <= step ? "bg-green-400" : "bg-gray-600"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Instruction */}
          <p className="font-pixel text-[11px] text-white leading-relaxed mb-2">{text}</p>

          {/* Hint */}
          {currentStep.hint && (
            <p className="font-pixel text-[8px] text-gray-500 mb-3">{currentStep.hint}</p>
          )}

          {/* Skip / controls hint */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkipClick}
              className="font-pixel text-[9px] text-gray-500 hover:text-gray-300 transition-colors min-w-[44px] min-h-[44px] flex items-center"
            >
              {step < 3 ? "SKIP TUTORIAL" : ""}
            </button>
            <span className="font-pixel text-[7px] text-gray-600">
              {!isMobile.current && step < 3 ? "ESC to skip" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
