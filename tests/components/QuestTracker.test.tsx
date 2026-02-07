/**
 * QuestTracker Component Tests
 *
 * Tests the first-time quest onboarding system:
 * - Renders expanded on first visit (no localStorage)
 * - Renders collapsed on return visit with incomplete quest
 * - Does not render when dismissed or completed
 * - Step completion via window events
 * - Out-of-order step completion
 * - Progress bar updates
 * - Minimize/expand toggle
 * - Dismiss (close/skip) writes to localStorage
 * - Quest complete celebration and auto-dismiss
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QuestTracker } from "@/components/QuestTracker";

const STORAGE_KEY = "bagsworld_quest";

// Mock useGameStore
jest.mock("@/lib/store", () => ({
  useGameStore: jest.fn((selector) => {
    if (typeof selector === "function") {
      return selector({ currentZone: "main_city" });
    }
    return { currentZone: "main_city" };
  }),
}));

// localStorage is mocked in jest.setup.js with jest.fn() stubs.
// We use a backing store to make getItem/setItem work together.
let storageStore: Record<string, string> = {};

beforeEach(() => {
  storageStore = {};
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
    it("renders expanded on first visit (no localStorage)", () => {
      render(<QuestTracker />);
      expect(screen.getByText("[Q] WELCOME QUEST")).toBeInTheDocument();
      expect(screen.getByText("Talk to Ash")).toBeInTheDocument();
      expect(screen.getByText("Visit Professor Oak")).toBeInTheDocument();
      expect(screen.getByText("Launch a Token")).toBeInTheDocument();
      expect(screen.getByText("Check the Terminal")).toBeInTheDocument();
    });

    it("shows progress as 0/4 on first visit", () => {
      render(<QuestTracker />);
      expect(screen.getByText("0/4")).toBeInTheDocument();
    });

    it("shows skip button", () => {
      render(<QuestTracker />);
      expect(screen.getByText("[SKIP]")).toBeInTheDocument();
    });

    it("saves initial state to localStorage on first visit", () => {
      render(<QuestTracker />);
      const saved = getStoredQuest();
      expect(saved).toBeTruthy();
      expect(saved.dismissed).toBe(false);
      expect(saved.completedAt).toBe(null);
    });

    it("renders collapsed on return visit with incomplete quest", () => {
      setStoredQuest({
        dismissed: false,
        completedAt: null,
        steps: {
          talk_to_ash: true,
          visit_oak: false,
          launch_token: false,
          check_terminal: false,
        },
      });

      render(<QuestTracker />);
      // Collapsed pill should show
      expect(screen.getByText(/QUEST 1\/4/)).toBeInTheDocument();
      // Expanded content should not be visible
      expect(screen.queryByText("[Q] WELCOME QUEST")).not.toBeInTheDocument();
    });

    it("does not render when dismissed", () => {
      setStoredQuest({
        dismissed: true,
        completedAt: null,
        steps: {
          talk_to_ash: false,
          visit_oak: false,
          launch_token: false,
          check_terminal: false,
        },
      });

      const { container } = render(<QuestTracker />);
      expect(container.innerHTML).toBe("");
    });

    it("does not render when completed", () => {
      setStoredQuest({
        dismissed: false,
        completedAt: Date.now(),
        steps: {
          talk_to_ash: true,
          visit_oak: true,
          launch_token: true,
          check_terminal: true,
        },
      });

      const { container } = render(<QuestTracker />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("step completion", () => {
    it("completes talk_to_ash step when event fires", () => {
      render(<QuestTracker />);
      expect(screen.getByText("0/4")).toBeInTheDocument();

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      expect(screen.getByText("1/4")).toBeInTheDocument();
    });

    it("completes visit_oak step when event fires", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-professoroak-click"));
      });

      expect(screen.getByText("1/4")).toBeInTheDocument();
    });

    it("completes launch_token step when event fires", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-launch-opened"));
      });

      expect(screen.getByText("1/4")).toBeInTheDocument();
    });

    it("completes check_terminal step when event fires", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-terminal-click"));
      });

      expect(screen.getByText("1/4")).toBeInTheDocument();
    });

    it("supports out-of-order completion", () => {
      render(<QuestTracker />);

      // Complete step 4 first, then step 1
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-terminal-click"));
      });
      expect(screen.getByText("1/4")).toBeInTheDocument();

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });
      expect(screen.getByText("2/4")).toBeInTheDocument();
    });

    it("does not double-count a step", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });
      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      expect(screen.getByText("1/4")).toBeInTheDocument();
    });

    it("persists step completion to localStorage", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
      });

      const saved = getStoredQuest();
      expect(saved.steps.talk_to_ash).toBe(true);
      expect(saved.steps.visit_oak).toBe(false);
    });
  });

  describe("quest complete", () => {
    it("shows celebration when all steps complete", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
        window.dispatchEvent(new CustomEvent("bagsworld-professoroak-click"));
        window.dispatchEvent(new CustomEvent("bagsworld-launch-opened"));
        window.dispatchEvent(new CustomEvent("bagsworld-terminal-click"));
      });

      expect(screen.getByText("QUEST COMPLETE!")).toBeInTheDocument();
    });

    it("writes completedAt to localStorage when all steps done", () => {
      render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
        window.dispatchEvent(new CustomEvent("bagsworld-professoroak-click"));
        window.dispatchEvent(new CustomEvent("bagsworld-launch-opened"));
        window.dispatchEvent(new CustomEvent("bagsworld-terminal-click"));
      });

      const saved = getStoredQuest();
      expect(saved.completedAt).toBeGreaterThan(0);
    });

    it("auto-dismisses after 4 seconds", () => {
      const { container } = render(<QuestTracker />);

      act(() => {
        window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
        window.dispatchEvent(new CustomEvent("bagsworld-professoroak-click"));
        window.dispatchEvent(new CustomEvent("bagsworld-launch-opened"));
        window.dispatchEvent(new CustomEvent("bagsworld-terminal-click"));
      });

      expect(screen.getByText("QUEST COMPLETE!")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(4100);
      });

      // Should unmount - completedAt is set so component returns null
      expect(container.innerHTML).toBe("");
    });
  });

  describe("minimize and expand", () => {
    it("minimizes to pill when [-] is clicked", () => {
      render(<QuestTracker />);
      expect(screen.getByText("[Q] WELCOME QUEST")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Minimize"));

      // Should show collapsed pill
      expect(screen.getByText(/QUEST 0\/4/)).toBeInTheDocument();
      expect(screen.queryByText("[Q] WELCOME QUEST")).not.toBeInTheDocument();
    });

    it("expands from pill when clicked", () => {
      render(<QuestTracker />);

      // Minimize
      fireEvent.click(screen.getByLabelText("Minimize"));
      expect(screen.queryByText("[Q] WELCOME QUEST")).not.toBeInTheDocument();

      // Click pill to expand
      fireEvent.click(screen.getByText(/QUEST 0\/4/));
      expect(screen.getByText("[Q] WELCOME QUEST")).toBeInTheDocument();
    });
  });

  describe("dismissal", () => {
    it("dismisses when [X] is clicked", () => {
      const { container } = render(<QuestTracker />);

      fireEvent.click(screen.getByLabelText("Close"));

      expect(container.innerHTML).toBe("");
      const saved = getStoredQuest();
      expect(saved.dismissed).toBe(true);
    });

    it("dismisses when [SKIP] is clicked", () => {
      const { container } = render(<QuestTracker />);

      fireEvent.click(screen.getByText("[SKIP]"));

      expect(container.innerHTML).toBe("");
      const saved = getStoredQuest();
      expect(saved.dismissed).toBe(true);
    });
  });
});
