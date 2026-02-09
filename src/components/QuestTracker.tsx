"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "bagsworld_quest";

// ── Types ──────────────────────────────────────────────────────────

interface QuestState {
  version: 3;
  skipped: boolean;
  completedAt: number | null;
  currentStep: number;
  stepsCompleted: boolean[];
}

// ── Quest definition ───────────────────────────────────────────────

interface QuestStep {
  npc: string | null; // null = auto-complete step
  npcIcon: string;
  event: string;
  zoneMatch?: string;
  objective: string;
  dialogue: string | null; // null = no dialogue (auto step)
  markerId: string | null; // characterId for ! marker, null = no marker
}

const QUEST_STEPS: QuestStep[] = [
  {
    npc: "Ash",
    npcIcon: "\uD83C\uDF92",
    event: "bagsworld-ash-click",
    objective: "Talk to Ash",
    dialogue: "Welcome! I'll show you around. Head to BagsCity \u2014 it's where the action is!",
    markerId: "ash",
  },
  {
    npc: null,
    npcIcon: "\uD83D\uDDFA\uFE0F",
    event: "bagsworld-zone-change",
    zoneMatch: "trending",
    objective: "Travel to BagsCity",
    dialogue: null,
    markerId: null,
  },
  {
    npc: "Neo",
    npcIcon: "\uD83D\uDD2D",
    event: "bagsworld-scout-click",
    objective: "Talk to Neo",
    dialogue:
      "Welcome to BagsCity! Head to Founder's Corner and talk to Professor Oak \u2014 he'll help you launch a token.",
    markerId: "neo",
  },
  {
    npc: "Professor Oak",
    npcIcon: "\uD83E\uDDEA",
    event: "bagsworld-professoroak-click",
    objective: "Visit Professor Oak",
    dialogue: "I can help you create a token with AI! Let me show you my laboratory.",
    markerId: "professorOak",
  },
  {
    npc: null,
    npcIcon: "\uD83D\uDDFA\uFE0F",
    event: "bagsworld-launch-prefill",
    objective: "Create with AI wizard",
    dialogue: null,
    markerId: null,
  },
  {
    npc: null,
    npcIcon: "\uD83D\uDDFA\uFE0F",
    event: "bagsworld-launch-opened",
    objective: "Launch your token",
    dialogue: null,
    markerId: null,
  },
  {
    npc: null,
    npcIcon: "\uD83D\uDDFA\uFE0F",
    event: "bagsworld-zone-change",
    zoneMatch: "moltbook",
    objective: "Travel to Moltbook Beach",
    dialogue: null,
    markerId: null,
  },
  {
    npc: null,
    npcIcon: "\uD83D\uDDFA\uFE0F",
    event: "bagsworld-moltbar-click",
    objective: "Find the Agent Bar",
    dialogue: null,
    markerId: null,
  },
];

// ── State helpers ──────────────────────────────────────────────────

function getDefaultState(): QuestState {
  return {
    version: 3,
    skipped: false,
    completedAt: null,
    currentStep: 0,
    stepsCompleted: new Array(8).fill(false),
  };
}

function migrateV1(old: Record<string, unknown>): QuestState {
  const steps = (old.steps ?? {}) as Record<string, boolean>;
  const s = getDefaultState();
  // Map v1 keys to linear step indices
  if (steps.talk_to_ash) s.stepsCompleted[0] = true;
  if (steps.visit_oak) s.stepsCompleted[3] = true;
  if (steps.launch_token) s.stepsCompleted[5] = true;
  if (steps.check_fees) s.stepsCompleted[7] = true;
  if (old.dismissed || old.skipped) s.skipped = true;
  if (old.completedAt) s.completedAt = old.completedAt as number;
  // Set currentStep to first incomplete
  s.currentStep = s.stepsCompleted.findIndex((v) => !v);
  if (s.currentStep === -1) s.currentStep = 7;
  return s;
}

function migrateV2(old: Record<string, unknown>): QuestState {
  const chapters = old.chapters as Record<
    string,
    { completed: boolean; completedAt: number | null; steps: Record<string, boolean> }
  >;
  const s = getDefaultState();

  // Map v2 chapter steps to linear indices (8 steps, no terminal)
  // Chapter 1: meet_community(0), check_bagscity(1)
  if (chapters?.chapter1?.steps?.meet_community) s.stepsCompleted[0] = true;
  if (chapters?.chapter1?.steps?.check_bagscity) s.stepsCompleted[1] = true;
  // check_market was terminal — dropped, no mapping
  // Chapter 2: meet_oak(3), generate_assets(4), launch_token(5)
  if (chapters?.chapter2?.steps?.meet_oak) s.stepsCompleted[3] = true;
  if (chapters?.chapter2?.steps?.generate_assets) s.stepsCompleted[4] = true;
  if (chapters?.chapter2?.steps?.launch_token) s.stepsCompleted[5] = true;
  // Chapter 3: meet_agents(6), agent_bar(7), claim_fees→agent_bar(7)
  if (chapters?.chapter3?.steps?.meet_agents) s.stepsCompleted[6] = true;
  if (chapters?.chapter3?.steps?.agent_bar) s.stepsCompleted[7] = true;
  if (chapters?.chapter3?.steps?.claim_fees) s.stepsCompleted[7] = true;

  if (old.dismissed) s.skipped = true;
  if (old.completedAt) s.completedAt = old.completedAt as number;

  // Set currentStep to first incomplete
  s.currentStep = s.stepsCompleted.findIndex((v) => !v);
  if (s.currentStep === -1) s.currentStep = 7;
  return s;
}

function loadState(): QuestState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version === 3) return parsed as QuestState;
    if (parsed.version === 2) {
      const migrated = migrateV2(parsed);
      saveState(migrated);
      return migrated;
    }
    // v1 (no version field)
    const migrated = migrateV1(parsed);
    saveState(migrated);
    return migrated;
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

function initState(): QuestState {
  const saved = loadState();
  if (saved) return saved;
  const fresh = getDefaultState();
  saveState(fresh);
  return fresh;
}

function dispatchMarkers(step: number) {
  if (step >= QUEST_STEPS.length) return;
  const quest = QUEST_STEPS[step];
  const markers: { characterId: string; type: string }[] = [];
  if (quest.markerId) {
    markers.push({ characterId: quest.markerId, type: "!" });
  }
  window.dispatchEvent(new CustomEvent("bagsworld-quest-markers", { detail: { markers } }));
}

// ── Component ──────────────────────────────────────────────────────

export function QuestTracker() {
  const [state, setState] = useState<QuestState>(initState);
  const [dialogueNpc, setDialogueNpc] = useState<string | null>(null);
  const [dialogueText, setDialogueText] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [stepFlash, setStepFlash] = useState(false);
  const dialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dispatch markers on mount and whenever currentStep changes
  useEffect(() => {
    if (state.skipped || state.completedAt) return;
    dispatchMarkers(state.currentStep);
  }, [state.currentStep, state.skipped, state.completedAt]);

  // Clear markers on unmount
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("bagsworld-quest-markers", { detail: { markers: [] } }));
    };
  }, []);

  const advanceStep = useCallback(
    (stepIndex: number) => {
      setState((prev) => {
        if (prev.stepsCompleted[stepIndex]) return prev;
        if (stepIndex !== prev.currentStep) return prev;

        const next: QuestState = {
          ...prev,
          stepsCompleted: [...prev.stepsCompleted],
          currentStep: prev.currentStep + 1,
        };
        next.stepsCompleted[stepIndex] = true;

        // Show dialogue if this is an NPC step
        const quest = QUEST_STEPS[stepIndex];
        if (quest.dialogue && quest.npc) {
          setDialogueNpc(quest.npc);
          setDialogueText(quest.dialogue);
          if (dialogueTimer.current) clearTimeout(dialogueTimer.current);
          dialogueTimer.current = setTimeout(() => {
            setDialogueNpc(null);
            setDialogueText(null);
          }, 4000);
        }

        // Brief green flash
        setStepFlash(true);
        setTimeout(() => setStepFlash(false), 400);

        // Check if all done
        if (next.stepsCompleted.every(Boolean)) {
          next.completedAt = Date.now();
          next.currentStep = 8;
          setShowComplete(true);
          // Clear markers
          window.dispatchEvent(
            new CustomEvent("bagsworld-quest-markers", { detail: { markers: [] } })
          );
        }

        saveState(next);
        return next;
      });
    },
    [dialogueTimer]
  );

  // Listen for quest events
  useEffect(() => {
    if (state.skipped || state.completedAt) return;
    if (state.currentStep >= QUEST_STEPS.length) return;

    const currentQuest = QUEST_STEPS[state.currentStep];

    const handler = ((e: Event) => {
      if (currentQuest.zoneMatch) {
        const detail = (e as CustomEvent).detail;
        if (detail?.zone !== currentQuest.zoneMatch) return;
      }
      advanceStep(state.currentStep);
    }) as EventListener;

    window.addEventListener(currentQuest.event, handler);
    return () => window.removeEventListener(currentQuest.event, handler);
  }, [state.currentStep, state.skipped, state.completedAt, advanceStep]);

  const handleSkip = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, skipped: true };
      saveState(next);
      return next;
    });
    // Clear markers
    window.dispatchEvent(new CustomEvent("bagsworld-quest-markers", { detail: { markers: [] } }));
  }, []);

  const dismissDialogue = useCallback(() => {
    setDialogueNpc(null);
    setDialogueText(null);
    if (dialogueTimer.current) clearTimeout(dialogueTimer.current);
  }, []);

  // Don't render if skipped or completed (and not showing celebration)
  if (state.skipped) return null;
  if (state.completedAt && !showComplete) return null;

  // ── Quest complete celebration ──────────────────────────────────
  if (showComplete) {
    return (
      <div
        className="fixed bottom-10 left-4 z-[55]"
        style={{ animation: "quest-ribbon-in 0.3s ease-out forwards" }}
      >
        <div className="flex items-center gap-2 bg-black/85 backdrop-blur-sm border border-yellow-500/50 rounded-full px-4 py-2 shadow-[0_0_16px_rgba(251,191,36,0.3)]">
          <span className="text-sm">{"\u2728"}</span>
          <span className="font-pixel text-[9px] text-yellow-400 tracking-wide">
            Quest Complete! Welcome to BagsWorld
          </span>
        </div>
        <style jsx>{`
          @keyframes quest-ribbon-in {
            from {
              opacity: 0;
              transform: translateX(-100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </div>
    );
  }

  const currentQuest = QUEST_STEPS[state.currentStep];
  const icon = currentQuest?.npcIcon ?? "\uD83D\uDDFA\uFE0F";

  // ── Minimized state ────────────────────────────────────────────
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-10 left-4 z-[55] bg-black/85 backdrop-blur-sm border border-amber-500/40 rounded-full w-8 h-8 flex items-center justify-center hover:border-amber-500/70 transition-all"
        style={{ animation: "quest-pulse 2s ease-in-out infinite" }}
        aria-label="Expand quest"
      >
        <span className="font-pixel text-[10px] text-amber-400">!</span>
        <style jsx>{`
          @keyframes quest-pulse {
            0%,
            100% {
              box-shadow: 0 0 4px rgba(245, 158, 11, 0.2);
            }
            50% {
              box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
            }
          }
        `}</style>
      </button>
    );
  }

  // ── Active quest ribbon ────────────────────────────────────────
  return (
    <div className="fixed bottom-10 left-4 z-[55]" style={{ maxWidth: "18rem" }}>
      {/* Dialogue bubble (above ribbon) */}
      {dialogueNpc && dialogueText && (
        <div
          className="mb-2 bg-black/90 backdrop-blur-sm border border-amber-500/30 rounded-lg px-3 py-2 shadow-lg"
          style={{ animation: "quest-dialogue-in 0.25s ease-out forwards" }}
        >
          <p className="font-pixel text-[8px] text-amber-400 mb-1">{dialogueNpc}:</p>
          <p className="font-pixel text-[8px] text-white/80 leading-relaxed">
            &ldquo;{dialogueText}&rdquo;
          </p>
          <button
            onClick={dismissDialogue}
            className="font-pixel text-[7px] text-gray-500 hover:text-white mt-1 float-right transition-colors"
          >
            [OK]
          </button>
          <div className="clear-both" />
        </div>
      )}

      {/* Quest ribbon */}
      <div
        className={`flex items-center gap-2 bg-black/85 backdrop-blur-sm border rounded-full px-3 py-1.5 transition-all duration-300 ${
          stepFlash
            ? "border-green-400/60 shadow-[0_0_8px_rgba(74,222,128,0.3)]"
            : "border-amber-500/30 shadow-[0_0_8px_rgba(0,0,0,0.3)]"
        }`}
        style={{ animation: "quest-ribbon-in 0.3s ease-out forwards" }}
      >
        {/* NPC icon */}
        <span className="text-sm shrink-0">{icon}</span>

        {/* Objective text */}
        <span className="font-pixel text-[8px] text-white/85 truncate flex-1">
          {currentQuest?.objective ?? "Quest complete!"}
        </span>

        {/* Quest marker indicator */}
        {currentQuest?.markerId && (
          <span className="font-pixel text-[9px] text-amber-400 shrink-0 animate-pulse">!</span>
        )}

        {/* Direction arrow for travel steps */}
        {currentQuest && !currentQuest.markerId && (
          <span className="font-pixel text-[8px] text-gray-500 shrink-0">{"\u25B8"}</span>
        )}

        {/* Minimize button */}
        <button
          onClick={() => setMinimized(true)}
          className="font-pixel text-[7px] text-gray-600 hover:text-gray-400 shrink-0 transition-colors ml-1"
          aria-label="Minimize quest"
        >
          {"\u2212"}
        </button>
      </div>

      {/* Skip link */}
      <div className="mt-1 pl-3">
        <button
          onClick={handleSkip}
          className="font-pixel text-[6px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          [SKIP]
        </button>
      </div>

      <style jsx>{`
        @keyframes quest-ribbon-in {
          from {
            opacity: 0;
            transform: translateX(-100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes quest-dialogue-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
