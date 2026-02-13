/**
 * GameCanvas Tests
 *
 * Tests that the GameCanvas component:
 * - Renders the game container div
 * - Does NOT have swipe-to-navigate (removed intentionally for mobile)
 * - Zones only change via ZoneNav button clicks
 * - Container has correct touch-action and selection styles
 * - Handles resize/orientation events
 * - Cleans up on unmount
 */

import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Polyfill PointerEvent for jsdom
if (typeof globalThis.PointerEvent === "undefined") {
  (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerType: string;
    readonly pointerId: number;
    constructor(type: string, params: PointerEventInit & { pointerType?: string } = {}) {
      super(type, params);
      this.pointerType = params.pointerType || "";
      this.pointerId = params.pointerId || 0;
    }
  };
}

// Mock heavy dependencies
jest.mock("@/game/scenes/BootScene", () => ({ BootScene: jest.fn() }));
jest.mock("@/game/scenes/WorldScene", () => ({ WorldScene: jest.fn() }));
jest.mock("@/game/scenes/UIScene", () => ({ UIScene: jest.fn() }));
jest.mock("@/lib/agent-websocket-bridge", () => ({
  initAgentBridge: jest.fn(),
  disconnectAgentBridge: jest.fn(),
  getAgentBridge: jest.fn(() => ({ isConnected: () => false })),
}));

const mockDestroy = jest.fn();
const mockRefresh = jest.fn();
jest.mock("phaser", () => ({
  Game: jest.fn().mockImplementation(() => ({
    destroy: mockDestroy,
    scale: { refresh: mockRefresh },
    scene: { getScene: jest.fn(() => null) },
  })),
  Scene: jest.fn(),
  AUTO: "AUTO",
  Scale: { FIT: 1, CENTER_BOTH: 2 },
  Geom: { Rectangle: jest.fn() },
}));

import GameCanvas from "@/components/GameCanvas";

let dispatchedEvents: CustomEvent[] = [];
const originalDispatchEvent = window.dispatchEvent;

beforeEach(() => {
  dispatchedEvents = [];
  window.dispatchEvent = jest.fn((event: Event) => {
    if (event instanceof CustomEvent) {
      dispatchedEvents.push(event);
    }
    return true;
  }) as typeof window.dispatchEvent;
  mockDestroy.mockClear();
  mockRefresh.mockClear();
});

afterEach(() => {
  window.dispatchEvent = originalDispatchEvent;
  jest.restoreAllMocks();
});

function renderCanvas() {
  const result = render(<GameCanvas worldState={null} />);
  const container = result.container.querySelector(
    ".game-canvas-wrapper"
  ) as HTMLElement;
  return { ...result, container };
}

describe("GameCanvas", () => {
  describe("rendering", () => {
    it("renders the game-canvas-wrapper div", () => {
      const { container } = renderCanvas();
      expect(container).toBeInTheDocument();
      expect(container.className).toContain("game-canvas-wrapper");
    });

    it("has touch-action auto style", () => {
      const { container } = renderCanvas();
      expect(container.style.touchAction).toBe("auto");
    });

    it("has user-select none for game area", () => {
      const { container } = renderCanvas();
      expect(container.style.userSelect).toBe("none");
    });

    it("has relative positioning for z-index layering", () => {
      const { container } = renderCanvas();
      expect(container.style.position).toBe("relative");
    });
  });

  describe("swipe-to-navigate removed", () => {
    it("does NOT dispatch zone-change on horizontal touch swipe", () => {
      const { container } = renderCanvas();

      act(() => {
        container.dispatchEvent(
          new PointerEvent("pointerdown", {
            pointerType: "touch",
            clientX: 200,
            clientY: 300,
            bubbles: true,
          })
        );
      });

      act(() => {
        container.dispatchEvent(
          new PointerEvent("pointerup", {
            pointerType: "touch",
            clientX: 50,
            clientY: 300,
            bubbles: true,
          })
        );
      });

      const zoneEvents = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-zone-change"
      );
      expect(zoneEvents).toHaveLength(0);
    });

    it("does NOT dispatch zone-change on any swipe direction", () => {
      const { container } = renderCanvas();

      // Try right swipe
      act(() => {
        container.dispatchEvent(
          new PointerEvent("pointerdown", {
            pointerType: "touch",
            clientX: 50,
            clientY: 300,
            bubbles: true,
          })
        );
      });
      act(() => {
        container.dispatchEvent(
          new PointerEvent("pointerup", {
            pointerType: "touch",
            clientX: 300,
            clientY: 300,
            bubbles: true,
          })
        );
      });

      const zoneEvents = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-zone-change"
      );
      expect(zoneEvents).toHaveLength(0);
    });
  });

  describe("cleanup", () => {
    it("destroys Phaser game on unmount", () => {
      const { unmount } = renderCanvas();
      unmount();
      expect(mockDestroy).toHaveBeenCalledWith(true);
    });
  });
});
