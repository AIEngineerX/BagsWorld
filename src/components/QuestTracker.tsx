"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/lib/store";

const STORAGE_KEY = "bagsworld_quest";

interface QuestState {
  dismissed: boolean;
  completedAt: number | null;
  steps: {
    talk_to_ash: boolean;
    visit_oak: boolean;
    launch_token: boolean;
    check_fees: boolean;
  };
}

const QUEST_STEPS = [
  {
    key: "talk_to_ash" as const,
    title: "Talk to Ash",
    description: "Learn how the ecosystem works",
    event: "bagsworld-ash-click",
  },
  {
    key: "visit_oak" as const,
    title: "Visit Professor Oak",
    description: "Get AI guidance on launching",
    event: "bagsworld-professoroak-click",
  },
  {
    key: "launch_token" as const,
    title: "Launch a Token",
    description: "Open the token launcher",
    event: "bagsworld-launch-opened",
  },
  {
    key: "check_fees" as const,
    title: "Check Your Fees",
    description: "See how creators earn from trades",
    event: "bagsworld-claim-click",
  },
];

function getDefaultState(): QuestState {
  return {
    dismissed: false,
    completedAt: null,
    steps: {
      talk_to_ash: false,
      visit_oak: false,
      launch_token: false,
      check_fees: false,
    },
  };
}

function loadState(): QuestState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QuestState;
  } catch {
    return null;
  }
}

function saveState(state: QuestState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable
  }
}

function initState(): { state: QuestState; isFirstVisit: boolean } {
  const saved = loadState();
  if (saved) {
    return { state: saved, isFirstVisit: false };
  }
  const fresh = getDefaultState();
  saveState(fresh);
  return { state: fresh, isFirstVisit: true };
}

export function QuestTracker() {
  const [{ state: initialState, isFirstVisit }] = useState(initState);
  const [state, setState] = useState<QuestState>(initialState);
  const [expanded, setExpanded] = useState(isFirstVisit);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mobileCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentZone = useGameStore((s) => s.currentZone);

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Auto-collapse on mobile after 5s
  useEffect(() => {
    if (!expanded) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    if (isMobile) {
      mobileCollapseTimer.current = setTimeout(() => {
        setExpanded(false);
      }, 5000);
      return () => {
        if (mobileCollapseTimer.current) clearTimeout(mobileCollapseTimer.current);
      };
    }
  }, [expanded]);

  // Listen for quest completion events
  useEffect(() => {
    if (state.dismissed || state.completedAt) return;

    const handlers: Array<{ event: string; handler: () => void }> = QUEST_STEPS.map((step) => ({
      event: step.event,
      handler: () => {
        setState((prev) => {
          if (prev.steps[step.key]) return prev;
          const next = {
            ...prev,
            steps: { ...prev.steps, [step.key]: true },
          };
          setJustCompleted(step.key);
          setTimeout(() => setJustCompleted(null), 1200);
          saveState(next);

          // Check if all done
          const done = Object.values(next.steps).every(Boolean);
          if (done) {
            const completed = { ...next, completedAt: Date.now() };
            saveState(completed);
            setAllDone(true);
            setTimeout(() => {
              setState(completed);
            }, 4000);
          }
          return next;
        });
      },
    }));

    handlers.forEach(({ event, handler }) => {
      window.addEventListener(event, handler);
    });

    return () => {
      handlers.forEach(({ event, handler }) => {
        window.removeEventListener(event, handler);
      });
    };
  }, [state]);

  const handleDismiss = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, dismissed: true };
      saveState(next);
      return next;
    });
  }, []);

  const handleMinimize = useCallback(() => {
    setExpanded(false);
  }, []);

  // Don't render if dismissed or completed
  if (state.dismissed || state.completedAt) return null;

  const completedCount = Object.values(state.steps).filter(Boolean).length;
  const progress = completedCount / QUEST_STEPS.length;
  const nextStepIndex = QUEST_STEPS.findIndex((s) => !state.steps[s.key]);

  // All done celebration
  if (allDone) {
    return (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-20 sm:bottom-16 z-[60]">
        <div className="quest-complete-container bg-black/95 backdrop-blur-md border border-yellow-500/60 rounded-lg px-6 py-3 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
          <p className="font-pixel text-sm text-yellow-400 text-center quest-complete-text tracking-wider">
            QUEST COMPLETE!
          </p>
          <div className="flex justify-center gap-1.5 mt-1.5">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className="inline-block text-yellow-400 font-pixel text-[10px] quest-sparkle"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                *
              </span>
            ))}
          </div>
        </div>
        <style jsx>{`
          .quest-complete-container {
            animation: complete-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          .quest-complete-text {
            text-shadow:
              0 0 8px rgba(251, 191, 36, 0.6),
              0 0 16px rgba(251, 191, 36, 0.3);
          }
          .quest-sparkle {
            animation: sparkle 0.6s ease-in-out infinite alternate;
          }
          @keyframes complete-pop {
            0% {
              transform: scale(0.8);
              opacity: 0;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
          @keyframes sparkle {
            0% {
              opacity: 0.2;
              transform: scale(0.6) translateY(2px);
            }
            100% {
              opacity: 1;
              transform: scale(1.2) translateY(-2px);
            }
          }
        `}</style>
      </div>
    );
  }

  // Collapsed pill — centered at bottom, small and unobtrusive
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`fixed left-1/2 -translate-x-1/2 bottom-12 sm:bottom-11 z-[60] bg-black/80 backdrop-blur-sm border border-bags-green/40 rounded-full px-4 py-1.5 hover:border-bags-green/70 hover:bg-black/90 transition-all duration-300 quest-pill ${mounted ? "quest-slide-up" : "opacity-0 translate-y-4"}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] text-bags-green/70">Q</span>
          <div className="flex gap-0.5">
            {QUEST_STEPS.map((step) => (
              <div
                key={step.key}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  state.steps[step.key] ? "bg-bags-green" : "bg-gray-700"
                }`}
              />
            ))}
          </div>
          <span className="font-pixel text-[8px] text-gray-500">
            {completedCount}/{QUEST_STEPS.length}
          </span>
        </div>
        <style jsx>{`
          .quest-pill {
            animation: pill-glow 3s ease-in-out infinite;
          }
          .quest-slide-up {
            animation: slide-up 0.3s ease-out forwards;
          }
          @keyframes pill-glow {
            0%,
            100% {
              box-shadow: 0 0 8px rgba(74, 222, 128, 0.05);
            }
            50% {
              box-shadow: 0 0 12px rgba(74, 222, 128, 0.15);
            }
          }
          @keyframes slide-up {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}</style>
      </button>
    );
  }

  // Expanded panel — centered bottom, compact card
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-12 sm:bottom-11 z-[60] w-72 sm:w-80 max-w-[calc(100vw-2rem)] ${mounted ? "quest-panel-enter" : "opacity-0 translate-y-4"}`}
    >
      <div
        className={`bg-black/95 backdrop-blur-md border rounded-lg overflow-hidden ${isFirstVisit ? "quest-glow border-bags-green/50" : "border-bags-green/25 shadow-[0_0_20px_rgba(0,0,0,0.5)]"}`}
      >
        {/* Header — slim */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-bags-green/5 border-b border-bags-green/15">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-bags-green/20 flex items-center justify-center">
              <span className="font-pixel text-[8px] text-bags-green">Q</span>
            </div>
            <span className="font-pixel text-[9px] text-bags-green/80 tracking-wide">
              WELCOME QUEST
            </span>
          </div>
          <div className="flex items-center">
            <button
              onClick={handleMinimize}
              className="font-pixel text-[9px] text-gray-600 hover:text-bags-green p-1 transition-colors"
              aria-label="Minimize"
            >
              [-]
            </button>
            <button
              onClick={handleDismiss}
              className="font-pixel text-[9px] text-gray-600 hover:text-red-400 p-1 transition-colors"
              aria-label="Close"
            >
              [X]
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="px-3 py-2 space-y-0.5">
          {QUEST_STEPS.map((step, i) => {
            const completed = state.steps[step.key];
            const isNext = i === nextStepIndex;
            const wasJustCompleted = justCompleted === step.key;

            return (
              <div
                key={step.key}
                className={`flex items-center gap-2 py-1 px-1.5 rounded transition-all duration-500 ${
                  wasJustCompleted
                    ? "quest-step-complete bg-bags-green/10"
                    : isNext
                      ? "bg-white/[0.02]"
                      : ""
                }`}
              >
                {/* Step indicator */}
                <div
                  className={`w-4 h-4 rounded-sm flex items-center justify-center shrink-0 transition-all duration-500 ${
                    completed
                      ? "bg-bags-green/20 border border-bags-green/50"
                      : isNext
                        ? "border border-white/30"
                        : "border border-gray-800"
                  } ${wasJustCompleted ? "quest-check-pop" : ""}`}
                >
                  {completed ? (
                    <span className="font-pixel text-[8px] text-bags-green">+</span>
                  ) : isNext ? (
                    <span className="font-pixel text-[7px] text-white/50 quest-caret">&gt;</span>
                  ) : (
                    <span className="font-pixel text-[7px] text-gray-700">&middot;</span>
                  )}
                </div>

                {/* Step text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-pixel text-[9px] leading-tight transition-all duration-500 ${
                      completed ? "text-bags-green/80" : isNext ? "text-white/90" : "text-gray-600"
                    } ${wasJustCompleted ? "text-bags-green" : ""}`}
                  >
                    {step.title}
                    {isNext && !completed && (
                      <span className="text-gray-500 ml-1 text-[7px]">- {step.description}</span>
                    )}
                  </p>
                </div>

                {/* Completed flash */}
                {wasJustCompleted && (
                  <span className="font-pixel text-[7px] text-bags-green quest-done-badge">
                    DONE
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar + skip — combined footer */}
        <div className="px-3 pb-2 pt-0.5 flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-800/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-bags-green/80 to-emerald-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="font-pixel text-[7px] text-gray-500">
            {completedCount}/{QUEST_STEPS.length}
          </span>
          <button
            onClick={handleDismiss}
            className="font-pixel text-[7px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            [SKIP]
          </button>
        </div>
      </div>

      <style jsx>{`
        .quest-glow {
          animation:
            panel-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards,
            glow-pulse 1.8s ease-in-out 0.4s 3;
        }
        @keyframes glow-pulse {
          0%,
          100% {
            box-shadow:
              0 0 8px rgba(74, 222, 128, 0.15),
              0 0 20px rgba(74, 222, 128, 0.05);
          }
          50% {
            box-shadow:
              0 0 15px rgba(74, 222, 128, 0.4),
              0 0 35px rgba(74, 222, 128, 0.15),
              0 0 50px rgba(74, 222, 128, 0.05);
          }
        }
        .quest-panel-enter {
          animation: panel-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes panel-enter {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
        .quest-step-complete {
          animation: step-flash 1.2s ease-out forwards;
        }
        @keyframes step-flash {
          0% {
            background-color: rgba(74, 222, 128, 0.2);
          }
          60% {
            background-color: rgba(74, 222, 128, 0.08);
          }
          100% {
            background-color: transparent;
          }
        }
        .quest-check-pop {
          animation: check-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes check-pop {
          0% {
            transform: scale(0.5);
          }
          60% {
            transform: scale(1.3);
          }
          100% {
            transform: scale(1);
          }
        }
        .quest-done-badge {
          animation: badge-in 0.3s ease-out forwards;
        }
        @keyframes badge-in {
          from {
            opacity: 0;
            transform: translateX(4px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .quest-caret {
          animation: caret-blink 1.5s ease-in-out infinite;
        }
        @keyframes caret-blink {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
