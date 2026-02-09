/**
 * QuestTracker Component Tests
 *
 * Tests the WoW-style NPC quest system:
 * - Renders ribbon with first objective ("Talk to Ash")
 * - NPC-click steps show dialogue bubble + advance
 * - Zone-change events complete travel steps
 * - Steps advance linearly (can't skip ahead)
 * - v1/v2 migration preserves progress
 * - Skip button works, sets skipped=true
 * - All 8 steps → "Quest Complete!" celebration
 * - Quest markers dispatched for correct NPCs
 * - Ribbon never auto-dismisses (stays visible)
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QuestTracker } from "@/components/QuestTracker";

const STORAGE_KEY = "bagsworld_quest";

// localStorage is mocked in jest.setup.js with jest.fn() stubs.
let storageStore: Record<string, string> = {};

// Track dispatched quest marker events
let lastMarkerEvent: { markers: { characterId: string; type: string }[] } | null = null;

beforeEach(() => {
  storageStore = {};
  lastMarkerEvent = null;
  jest.useFakeTimers();

  (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
    return storageStore[key] ?? null;
  });
  (localStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
    storageStore[key] = value;
  });
  (localStorage.clear as jest.Mock).mockImplementation(() => {
    storageStore = {};
  });
  (localStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
    delete storageStore[key];
  });

  // Listen for quest marker dispatches
  window.addEventListener("bagsworld-quest-markers", ((e: CustomEvent) => {
    lastMarkerEvent = e.detail;
  }) as EventListener);
});

afterEach(() => {
  jest.useRealTimers();
});

function setStoredQuest(data: Record<string, unknown>) {
  storageStore[STORAGE_KEY] = JSON.stringify(data);
}

function getStoredQuest() {
  const raw = storageStore[STORAGE_KEY];
  return raw ? JSON.parse(raw) : null;
}

describe("QuestTracker", () => {
  describe("initial rendering", () => {
    it("renders ribbon with first objective 'Talk to Ash'", () => {
      render(<QuestTracker />);
      expect(screen.getByText("Talk to Ash")).toBeInTheDocument();
    });

    it("shows backpack icon for Ash step", () => {
      render(<QuestTracker />);
      expect(screen.getByText("\uD83C\uDF92")).toBeInTheDocument();
    });

    it("shows [SKIP] button", () => {
      render(<QuestTracker />);
      expect(screen.getByText("[SKIP]")).toBeInTheDocument();
    });

    it("shows quest marker indicator (!) for NPC steps", () => {
      render(<QuestTracker />);
      // The ! indicator in the ribbon for NPC steps
      const markers = screen.getAllByText("!");
      expect(markers.length).toBeGreaterThan(0);
    });

    it("saves v3 state to localStorage on first visit", () => {
      render(<QuestTracker />);
      const saved = getStoredQuest();
      expect(saved).toBeTruthy();
      expect(saved.version).toBe(3);
      expect(saved.skipped).toBe(false);
      expect(saved.completedAt).toBe(null);
      expect(saved.currentStep).toBe(0);
      expect(saved.stepsCompleted).toEqual(new Array(8).fill(false));
    });

    it("dispatches quest markers for Ash on mount", () => {
      render(<QuestTracker />);
      expect(lastMarkerEvent).toBeTruthy();
      expect(lastMarkerEvent!.markers).toEqual([{ characterId: "ash", type: "!" }]);
    });
  });

  describe("step completion", () => {
    it("completes step 0 (Talk to Ash) when ash-click fires", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      // Should now show step 1 objective
      expect(screen.getByText("Travel to BagsCity")).toBeInTheDocument();
      const saved = getStoredQuest();
      expect(saved.stepsCompleted[0]).toBe(true);
      expect(saved.currentStep).toBe(1);
    });

    it("shows dialogue bubble when NPC step completes", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      // Ash's dialogue should appear
      expect(screen.getByText("Ash:")).toBeInTheDocument();
      expect(
        screen.getByText(/Welcome! I'll show you around\. Head to BagsCity/)
      ).toBeInTheDocument();
      // OK button present
      expect(screen.getByText("[OK]")).toBeInTheDocument();
    });

    it("dialogue auto-dismisses after 4 seconds", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      expect(screen.getByText("Ash:")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(4100);
      });

      expect(screen.queryByText("Ash:")).not.toBeInTheDocument();
    });

    it("dialogue dismissed when OK clicked", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      expect(screen.getByText("Ash:")).toBeInTheDocument();
      fireEvent.click(screen.getByText("[OK]"));
      expect(screen.queryByText("Ash:")).not.toBeInTheDocument();
    });

    it("completes step 1 (Travel to BagsCity) on zone-change to trending", () => {
      render(<QuestTracker />);

      // Complete step 0 first
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      // Now complete step 1
      act(() => {
        window.dispatchEvent(
          new CustomEvent("bagsworld-zone-change", { detail: { zone: "trending" } })
        );
      });

      expect(screen.getByText("Talk to Neo")).toBeInTheDocument();
      const saved = getStoredQuest();
      expect(saved.stepsCompleted[1]).toBe(true);
      expect(saved.currentStep).toBe(2);
    });

    it("does NOT complete step 1 on zone-change to wrong zone", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      act(() => {
        window.dispatchEvent(
          new CustomEvent("bagsworld-zone-change", { detail: { zone: "labs" } })
        );
      });

      // Still on step 1
      expect(screen.getByText("Travel to BagsCity")).toBeInTheDocument();
    });

    it("does not double-count a step", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      // Should be on step 1, not step 2
      expect(screen.getByText("Travel to BagsCity")).toBeInTheDocument();
      const saved = getStoredQuest();
      expect(saved.currentStep).toBe(1);
    });

    it("steps advance linearly (cannot skip ahead)", () => {
      render(<QuestTracker />);

      // Try to complete step 2 (neo-click) without completing steps 0 and 1
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-scout-click"));
      });

      // Still on step 0
      expect(screen.getByText("Talk to Ash")).toBeInTheDocument();
      const saved = getStoredQuest();
      expect(saved.currentStep).toBe(0);
    });

    it("persists step completion to localStorage", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      const saved = getStoredQuest();
      expect(saved.stepsCompleted[0]).toBe(true);
      expect(saved.currentStep).toBe(1);
    });
  });

  describe("NPC dialogue for each NPC step", () => {
    it("Neo shows dialogue on step 2", () => {
      render(<QuestTracker />);

      // Complete steps 0-1
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });
      act(() => {
        window.dispatchEvent(
          new CustomEvent("bagsworld-zone-change", { detail: { zone: "trending" } })
        );
      });

      // Step 2: talk to Neo
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-scout-click"));
      });

      expect(screen.getByText("Neo:")).toBeInTheDocument();
      expect(screen.getByText(/Welcome to BagsCity! Head to Founder's Corner/)).toBeInTheDocument();
    });

    it("Professor Oak shows dialogue on step 3", () => {
      render(<QuestTracker />);

      // Complete steps 0-2
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });
      act(() => {
        window.dispatchEvent(
          new CustomEvent("bagsworld-zone-change", { detail: { zone: "trending" } })
        );
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-scout-click"));
      });

      // Step 3: talk to Prof Oak
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-professoroak-click"));
      });

      expect(screen.getByText("Professor Oak:")).toBeInTheDocument();
      expect(screen.getByText(/I can help you create a token with AI/)).toBeInTheDocument();
    });
  });

  describe("quest markers dispatched", () => {
    it("dispatches Ash marker at step 0", () => {
      render(<QuestTracker />);
      expect(lastMarkerEvent!.markers).toEqual([{ characterId: "ash", type: "!" }]);
    });

    it("dispatches Neo marker at step 2", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });
      act(() => {
        window.dispatchEvent(
          new CustomEvent("bagsworld-zone-change", { detail: { zone: "trending" } })
        );
      });

      // Step 2 has markerId "neo"
      expect(lastMarkerEvent!.markers).toEqual([{ characterId: "neo", type: "!" }]);
    });

    it("dispatches professorOak marker at step 3", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });
      act(() => {
        window.dispatchEvent(
          new CustomEvent("bagsworld-zone-change", { detail: { zone: "trending" } })
        );
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-scout-click"));
      });

      expect(lastMarkerEvent!.markers).toEqual([{ characterId: "professorOak", type: "!" }]);
    });

    it("dispatches empty markers for auto-complete steps (no NPC)", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      // Step 1 is a travel step, no markerId
      expect(lastMarkerEvent!.markers).toEqual([]);
    });
  });

  describe("quest complete", () => {
    function completeAllSteps() {
      // Each step must be in its own act() so the component re-renders
      // and registers the next step's event listener
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });
      act(() => {
        window.dispatchEvent(
          new CustomEvent("bagsworld-zone-change", { detail: { zone: "trending" } })
        );
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-scout-click"));
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-professoroak-click"));
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-launch-prefill"));
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-launch-opened"));
      });
      act(() => {
        window.dispatchEvent(
          new CustomEvent("bagsworld-zone-change", { detail: { zone: "moltbook" } })
        );
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-moltbar-click"));
      });
    }

    it("shows Quest Complete when all 8 steps done", () => {
      render(<QuestTracker />);
      completeAllSteps();
      expect(screen.getByText(/Quest Complete/)).toBeInTheDocument();
    });

    it("writes completedAt to localStorage when all steps done", () => {
      render(<QuestTracker />);
      completeAllSteps();
      const saved = getStoredQuest();
      expect(saved.completedAt).toBeGreaterThan(0);
    });

    it("ribbon stays visible (no auto-dismiss)", () => {
      render(<QuestTracker />);
      completeAllSteps();
      expect(screen.getByText(/Quest Complete/)).toBeInTheDocument();

      // Even after waiting, it stays
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(screen.getByText(/Quest Complete/)).toBeInTheDocument();
    });

    it("clears quest markers on completion", () => {
      render(<QuestTracker />);
      completeAllSteps();
      expect(lastMarkerEvent!.markers).toEqual([]);
    });
  });

  describe("minimize and expand", () => {
    it("minimizes to pulsing ! button", () => {
      render(<QuestTracker />);

      fireEvent.click(screen.getByLabelText("Minimize quest"));

      // Minimized shows ! button
      expect(screen.getByLabelText("Expand quest")).toBeInTheDocument();
      expect(screen.queryByText("Talk to Ash")).not.toBeInTheDocument();
    });

    it("expands from minimized when clicked", () => {
      render(<QuestTracker />);

      fireEvent.click(screen.getByLabelText("Minimize quest"));
      expect(screen.queryByText("Talk to Ash")).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Expand quest"));
      expect(screen.getByText("Talk to Ash")).toBeInTheDocument();
    });
  });

  describe("skip/dismissal", () => {
    it("hides when [SKIP] is clicked", () => {
      const { container } = render(<QuestTracker />);

      fireEvent.click(screen.getByText("[SKIP]"));

      expect(container.innerHTML).toBe("");
      const saved = getStoredQuest();
      expect(saved.skipped).toBe(true);
    });

    it("clears quest markers on skip", () => {
      render(<QuestTracker />);

      fireEvent.click(screen.getByText("[SKIP]"));

      expect(lastMarkerEvent!.markers).toEqual([]);
    });

    it("does not render when previously skipped", () => {
      setStoredQuest({
        version: 3,
        skipped: true,
        completedAt: null,
        currentStep: 0,
        stepsCompleted: new Array(8).fill(false),
      });

      const { container } = render(<QuestTracker />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("v1 migration", () => {
    it("migrates talk_to_ash to step 0", () => {
      setStoredQuest({
        dismissed: false,
        completedAt: null,
        steps: {
          talk_to_ash: true,
          visit_oak: false,
          launch_token: false,
          check_fees: false,
        },
      });

      render(<QuestTracker />);

      const saved = getStoredQuest();
      expect(saved.version).toBe(3);
      expect(saved.stepsCompleted[0]).toBe(true);
    });

    it("migrates visit_oak to step 3", () => {
      setStoredQuest({
        dismissed: false,
        completedAt: null,
        steps: {
          talk_to_ash: false,
          visit_oak: true,
          launch_token: false,
          check_fees: false,
        },
      });

      render(<QuestTracker />);

      const saved = getStoredQuest();
      expect(saved.stepsCompleted[3]).toBe(true);
    });

    it("migrates launch_token to step 5", () => {
      setStoredQuest({
        dismissed: false,
        completedAt: null,
        steps: {
          talk_to_ash: false,
          visit_oak: false,
          launch_token: true,
          check_fees: false,
        },
      });

      render(<QuestTracker />);

      const saved = getStoredQuest();
      expect(saved.stepsCompleted[5]).toBe(true);
    });

    it("migrates check_fees to step 7", () => {
      setStoredQuest({
        dismissed: false,
        completedAt: null,
        steps: {
          talk_to_ash: false,
          visit_oak: false,
          launch_token: false,
          check_fees: true,
        },
      });

      render(<QuestTracker />);

      const saved = getStoredQuest();
      expect(saved.stepsCompleted[7]).toBe(true);
    });

    it("preserves dismissed state from v1 as skipped", () => {
      setStoredQuest({
        dismissed: true,
        completedAt: null,
        steps: {
          talk_to_ash: true,
          visit_oak: false,
          launch_token: false,
          check_fees: false,
        },
      });

      const { container } = render(<QuestTracker />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("v2 migration", () => {
    it("migrates v2 chapter1 steps to v3", () => {
      setStoredQuest({
        version: 2,
        dismissed: false,
        completedAt: null,
        chapters: {
          chapter1: { completed: false, completedAt: null, steps: { meet_community: true } },
          chapter2: { completed: false, completedAt: null, steps: {} },
          chapter3: { completed: false, completedAt: null, steps: {} },
        },
      });

      render(<QuestTracker />);

      const saved = getStoredQuest();
      expect(saved.version).toBe(3);
      expect(saved.stepsCompleted[0]).toBe(true);
    });

    it("migrates v2 chapter2.meet_oak to step 3", () => {
      setStoredQuest({
        version: 2,
        dismissed: false,
        completedAt: null,
        chapters: {
          chapter1: {
            completed: true,
            completedAt: Date.now(),
            steps: { meet_community: true, check_bagscity: true, check_market: true },
          },
          chapter2: { completed: false, completedAt: null, steps: { meet_oak: true } },
          chapter3: { completed: false, completedAt: null, steps: {} },
        },
      });

      render(<QuestTracker />);

      const saved = getStoredQuest();
      expect(saved.stepsCompleted[3]).toBe(true);
    });

    it("preserves v2 dismissed state as skipped", () => {
      setStoredQuest({
        version: 2,
        dismissed: true,
        completedAt: null,
        chapters: {
          chapter1: { completed: false, completedAt: null, steps: {} },
          chapter2: { completed: false, completedAt: null, steps: {} },
          chapter3: { completed: false, completedAt: null, steps: {} },
        },
      });

      const { container } = render(<QuestTracker />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("restored state", () => {
    it("resumes from saved step", () => {
      setStoredQuest({
        version: 3,
        skipped: false,
        completedAt: null,
        currentStep: 3,
        stepsCompleted: [true, true, true, false, false, false, false, false],
      });

      render(<QuestTracker />);
      expect(screen.getByText("Visit Professor Oak")).toBeInTheDocument();
    });

    it("does not render when previously completed", () => {
      setStoredQuest({
        version: 3,
        skipped: false,
        completedAt: Date.now(),
        currentStep: 8,
        stepsCompleted: new Array(8).fill(true),
      });

      const { container } = render(<QuestTracker />);
      expect(container.innerHTML).toBe("");
    });
  });
});
