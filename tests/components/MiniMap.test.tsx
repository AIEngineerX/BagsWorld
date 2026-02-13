/**
 * MiniMap Component Tests
 *
 * Tests the mini-map floating button with:
 * - Default position at bottom-right with safe area inset
 * - Open/close toggle via pointer events (drag/tap)
 * - Zone grid navigation and event dispatch
 * - Location list for expanded zone
 * - Quick action buttons (Launch, Claim)
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MiniMap } from "@/components/MiniMap";
import { useGameStore } from "@/lib/store";

let dispatchedEvents: CustomEvent[] = [];
const originalDispatchEvent = window.dispatchEvent;

// The component opens via pointer events (tap = pointerDown + pointerUp without drag)
function openMap() {
  const button = screen.getByLabelText("Open map");
  fireEvent.pointerDown(button);
  fireEvent.pointerUp(window);
}

// Expand a zone's locations by clicking its tile within the zone grid
// (avoids matching the header which also shows the current zone name)
function expandZone(label: string) {
  const grid = document.querySelector("[data-zone-grid]")!;
  fireEvent.click(within(grid as HTMLElement).getByText(label));
}

// Get the zone grid for scoped queries
function getZoneGrid() {
  return within(document.querySelector("[data-zone-grid]") as HTMLElement);
}

beforeEach(() => {
  dispatchedEvents = [];
  // Intercept CustomEvents for assertions while passing all events through
  // so pointer event listeners still work
  window.dispatchEvent = jest.fn((event: Event) => {
    if (event instanceof CustomEvent) {
      dispatchedEvents.push(event);
    }
    return originalDispatchEvent.call(window, event);
  }) as typeof window.dispatchEvent;

  useGameStore.setState({ currentZone: "main_city" });
});

afterEach(() => {
  window.dispatchEvent = originalDispatchEvent;
});

describe("MiniMap", () => {
  describe("initial rendering", () => {
    it("renders the map button", () => {
      render(<MiniMap />);
      expect(screen.getByLabelText("Open map")).toBeInTheDocument();
    });

    it("does not show map panel initially", () => {
      render(<MiniMap />);
      expect(screen.queryByText("WORLD MAP")).not.toBeInTheDocument();
    });

    it("default position uses fixed class (safe-area bottom is CSS calc)", () => {
      const { container } = render(<MiniMap />);
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain("fixed");
      expect(wrapper.style.left).toBe("");
      expect(wrapper.style.top).toBe("");
    });

    it("default position is right-aligned", () => {
      const { container } = render(<MiniMap />);
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.style.right).toBe("12px");
    });
  });

  describe("open/close behavior", () => {
    it("opens map panel when button is tapped", () => {
      render(<MiniMap />);
      openMap();
      expect(screen.getByText("WORLD MAP")).toBeInTheDocument();
    });

    it("closes map panel when [X] is clicked", () => {
      render(<MiniMap />);
      openMap();
      expect(screen.getByText("WORLD MAP")).toBeInTheDocument();

      fireEvent.click(screen.getByText("[X]"));
      expect(screen.queryByText("WORLD MAP")).not.toBeInTheDocument();
    });

    it("hides the floating button when panel is open", () => {
      render(<MiniMap />);
      openMap();
      expect(screen.queryByLabelText("Open map")).not.toBeInTheDocument();
    });
  });

  describe("zone navigation", () => {
    it("shows zone tiles when open", () => {
      render(<MiniMap />);
      openMap();

      // Query within the zone grid to avoid matching the header zone name
      const grid = getZoneGrid();
      expect(grid.getByText("HQ")).toBeInTheDocument();
      expect(grid.getByText("PARK")).toBeInTheDocument();
      expect(grid.getByText("CITY")).toBeInTheDocument();
      expect(grid.getByText("BALLERS")).toBeInTheDocument();
      expect(grid.getByText("ARENA")).toBeInTheDocument();
      expect(grid.getByText("BEACH")).toBeInTheDocument();
      expect(grid.getByText("DUNGEON")).toBeInTheDocument();
      expect(grid.getByText("LAUNCH")).toBeInTheDocument();
    });

    it("clicking zone tile dispatches zone-change event", () => {
      render(<MiniMap />);
      openMap();
      dispatchedEvents = [];

      fireEvent.click(screen.getByText("HQ"));

      const zoneEvents = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-zone-change"
      );
      expect(zoneEvents).toHaveLength(1);
      expect(zoneEvents[0].detail.zone).toBe("labs");
    });

    it("clicking zone tile updates store", () => {
      render(<MiniMap />);
      openMap();

      fireEvent.click(screen.getByText("ARENA"));
      expect(useGameStore.getState().currentZone).toBe("arena");
    });
  });

  describe("zone-specific locations", () => {
    it("shows Park locations when PARK tile is expanded", () => {
      useGameStore.setState({ currentZone: "main_city" });
      render(<MiniMap />);
      openMap();

      // Click current zone tile to expand locations
      expandZone("PARK");

      expect(screen.getByText("Rewards Center")).toBeInTheDocument();
      expect(screen.getByText("Community Fund")).toBeInTheDocument();
    });

    it("shows BagsCity locations when CITY tile is expanded", () => {
      useGameStore.setState({ currentZone: "trending" });
      render(<MiniMap />);
      openMap();

      expandZone("CITY");

      expect(screen.getByText("Casino")).toBeInTheDocument();
      expect(screen.getByText("Oracle")).toBeInTheDocument();
    });

    it("shows HQ locations when HQ tile is expanded", () => {
      useGameStore.setState({ currentZone: "labs" });
      render(<MiniMap />);
      openMap();

      expandZone("HQ");

      expect(screen.getByText("Bags.FM HQ")).toBeInTheDocument();
    });
  });

  describe("location clicks", () => {
    it("clicking a location with an event dispatches it", () => {
      useGameStore.setState({ currentZone: "main_city" });
      render(<MiniMap />);
      openMap();
      expandZone("PARK");
      dispatchedEvents = [];

      fireEvent.click(screen.getByText("Rewards Center"));

      const events = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-pokecenter-click"
      );
      expect(events).toHaveLength(1);
    });

    it("clicking a location with null event does nothing", () => {
      useGameStore.setState({ currentZone: "ballers" });
      render(<MiniMap />);
      openMap();
      expandZone("BALLERS");
      dispatchedEvents = [];

      // Mansions has event: null
      const mansionsBtn = screen.getByText("Mansions").closest("button")!;
      fireEvent.click(mansionsBtn);

      expect(dispatchedEvents).toHaveLength(0);
    });
  });

  describe("quick actions", () => {
    it("renders LAUNCH and CLAIM buttons", () => {
      render(<MiniMap />);
      openMap();

      // "LAUNCH" appears in zone tile + quick action; CLAIM is unique
      expect(screen.getAllByText("LAUNCH").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("CLAIM")).toBeInTheDocument();
    });

    it("LAUNCH button dispatches launch-click event", () => {
      render(<MiniMap />);
      openMap();
      dispatchedEvents = [];

      // Find the quick action LAUNCH button (not inside the zone grid)
      const launchButtons = screen.getAllByText("LAUNCH");
      const quickLaunchBtn = launchButtons.find(
        (el) => !el.closest("[data-zone-grid]")
      )!;
      fireEvent.click(quickLaunchBtn);

      const events = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-launch-click"
      );
      expect(events).toHaveLength(1);
    });

    it("CLAIM button dispatches claim-click event", () => {
      render(<MiniMap />);
      openMap();
      dispatchedEvents = [];

      fireEvent.click(screen.getByText("CLAIM"));

      const events = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-claim-click"
      );
      expect(events).toHaveLength(1);
    });
  });

  describe("onNavigate callback", () => {
    it("calls onNavigate prop when zone is changed", () => {
      const onNavigate = jest.fn();
      render(<MiniMap onNavigate={onNavigate} />);
      openMap();

      fireEvent.click(screen.getByText("CITY"));

      expect(onNavigate).toHaveBeenCalledWith("trending");
    });
  });
});
