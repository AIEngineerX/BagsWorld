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
    check_terminal: boolean;
  };
}

const QUEST_STEPS = [
  {
    key: "talk_to_ash" as const,
    title: "Talk to Ash",
    description: "Learn how the ecosystem works",
    event: "bagsworld-ash-click",
    zoneHint: "Park",
  },
  {
    key: "visit_oak" as const,
    title: "Visit Professor Oak",
    description: "Get AI guidance on launching",
    event: "bagsworld-professoroak-click",
    zoneHint: "Founder's Corner",
  },
  {
    key: "launch_token" as const,
    title: "Launch a Token",
    description: "Open the token launcher",
    event: "bagsworld-launch-opened",
    zoneHint: "Header or Oak",
  },
  {
    key: "check_terminal" as const,
    title: "Check the Terminal",
    description: "View live market data",
    event: "bagsworld-terminal-click",
    zoneHint: "BagsCity",
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
      check_terminal: false,
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
  const mobileCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentZone = useGameStore((s) => s.currentZone);

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
          setTimeout(() => setJustCompleted(null), 600);
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

  // Find next incomplete step
  const nextStepIndex = QUEST_STEPS.findIndex((s) => !state.steps[s.key]);

  // All done celebration
  if (allDone) {
    return (
      <div className="fixed left-4 bottom-14 sm:left-4 sm:bottom-14 z-[60] w-80 max-w-[calc(100vw-1rem)]">
        <div className="bg-black/90 backdrop-blur-sm border border-yellow-500/50 p-4 shadow-[0_0_20px_rgba(251,191,36,0.2)] animate-pulse">
          <p className="font-pixel text-sm text-yellow-400 text-center quest-complete-text">
            QUEST COMPLETE!
          </p>
          <div className="flex justify-center gap-1 mt-2">
            {[...Array(6)].map((_, i) => (
              <span
                key={i}
                className="inline-block text-yellow-400 quest-sparkle"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                *
              </span>
            ))}
          </div>
        </div>
        <style jsx>{`
          .quest-complete-text {
            text-shadow:
              0 0 10px rgba(251, 191, 36, 0.5),
              0 0 20px rgba(251, 191, 36, 0.3);
          }
          .quest-sparkle {
            animation: sparkle 0.8s ease-in-out infinite alternate;
          }
          @keyframes sparkle {
            0% {
              opacity: 0.3;
              transform: scale(0.8);
            }
            100% {
              opacity: 1;
              transform: scale(1.3);
            }
          }
        `}</style>
      </div>
    );
  }

  // Collapsed pill
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed left-2 bottom-24 sm:left-4 sm:bottom-14 z-[60] bg-black/90 backdrop-blur-sm border border-bags-green/30 px-3 py-2 shadow-[0_0_15px_rgba(74,222,128,0.1)] hover:border-bags-green/60 transition-all quest-pill"
      >
        <span className="font-pixel text-[10px] text-bags-green">
          [Q] QUEST {completedCount}/{QUEST_STEPS.length}
        </span>
        <style jsx>{`
          .quest-pill {
            animation: pill-pulse 2s ease-in-out infinite;
          }
          @keyframes pill-pulse {
            0%,
            100% {
              box-shadow: 0 0 15px rgba(74, 222, 128, 0.1);
            }
            50% {
              box-shadow:
                0 0 15px rgba(74, 222, 128, 0.2),
                0 0 25px rgba(74, 222, 128, 0.1);
            }
          }
        `}</style>
      </button>
    );
  }

  // Expanded panel
  return (
    <div className="fixed left-2 bottom-24 sm:left-4 sm:bottom-14 z-[60] w-[calc(100vw-1rem)] max-w-80">
      <div className="bg-black/90 backdrop-blur-sm border border-bags-green/30 shadow-[0_0_15px_rgba(74,222,128,0.1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-bags-green/20">
          <span className="font-pixel text-[10px] text-bags-green">[Q] WELCOME QUEST</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMinimize}
              className="font-pixel text-[10px] text-gray-500 hover:text-bags-green px-1 transition-colors"
              aria-label="Minimize"
            >
              [-]
            </button>
            <button
              onClick={handleDismiss}
              className="font-pixel text-[10px] text-gray-500 hover:text-red-400 px-1 transition-colors"
              aria-label="Close"
            >
              [X]
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="px-3 py-2 space-y-1.5">
          {QUEST_STEPS.map((step, i) => {
            const completed = state.steps[step.key];
            const isNext = i === nextStepIndex;
            const wasJustCompleted = justCompleted === step.key;

            return (
              <div
                key={step.key}
                className={`transition-all duration-300 ${wasJustCompleted ? "scale-105" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`font-pixel text-[10px] mt-0.5 transition-all duration-300 ${
                      completed ? "text-bags-green" : isNext ? "text-white" : "text-gray-600"
                    } ${wasJustCompleted ? "scale-125" : ""}`}
                  >
                    {completed ? "+" : isNext ? ">" : "o"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-pixel text-[10px] transition-colors duration-300 ${
                        completed ? "text-bags-green" : isNext ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </p>
                    {(isNext || completed) && (
                      <p
                        className={`font-pixel text-[8px] ${
                          completed ? "text-bags-green/60" : "text-gray-400"
                        }`}
                      >
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-bags-green to-emerald-400 transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="font-pixel text-[8px] text-gray-400">
              {completedCount}/{QUEST_STEPS.length}
            </span>
          </div>
        </div>

        {/* Skip button */}
        <div className="px-3 pb-2">
          <button
            onClick={handleDismiss}
            className="w-full font-pixel text-[8px] text-gray-600 hover:text-gray-400 py-1 transition-colors"
          >
            [SKIP]
          </button>
        </div>
      </div>
    </div>
  );
}
