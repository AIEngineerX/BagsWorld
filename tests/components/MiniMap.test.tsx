/**
 * MiniMap Component Tests
 *
 * Tests the mini-map floating button with:
 * - Default position at bottom-right with safe area inset
 * - Open/close toggle
 * - Zone navigation buttons and event dispatch
 * - Location list for current zone
 * - Dragging behavior
 * - Quick action buttons (Launch, Claim)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MiniMap } from "@/components/MiniMap";
import { useGameStore } from "@/lib/store";

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
      expect(screen.queryByText("NAVIGATE")).not.toBeInTheDocument();
    });

    it("default position uses fixed class (safe-area bottom is CSS calc)", () => {
      const { container } = render(<MiniMap />);
      const wrapper = container.firstElementChild as HTMLElement;
      // jsdom doesn't support CSS env() so we can't read wrapper.style.bottom
      // Instead verify it has fixed positioning and no explicit left/top
      // (which means it uses the right/bottom default branch)
      expect(wrapper.className).toContain("fixed");
      expect(wrapper.style.left).toBe("");
      expect(wrapper.style.top).toBe("");
    });

    it("default position is right-aligned", () => {
      const { container } = render(<MiniMap />);
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.style.right).toBe("16px");
    });
  });

  describe("open/close behavior", () => {
    it("opens map panel when button is clicked", () => {
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));
      expect(screen.getByText("NAVIGATE")).toBeInTheDocument();
    });

    it("closes map panel when X is clicked", () => {
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));
      expect(screen.getByText("NAVIGATE")).toBeInTheDocument();

      // Find close button (×)
      fireEvent.click(screen.getByText("×"));
      expect(screen.queryByText("NAVIGATE")).not.toBeInTheDocument();
    });

    it("hides the floating button when panel is open", () => {
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));
      expect(screen.queryByLabelText("Open map")).not.toBeInTheDocument();
    });
  });

  describe("zone navigation", () => {
    it("shows zone tabs when open", () => {
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));

      expect(screen.getByText("HQ")).toBeInTheDocument();
      expect(screen.getByText("PARK")).toBeInTheDocument();
      expect(screen.getByText("CITY")).toBeInTheDocument();
      expect(screen.getByText("BALLERS")).toBeInTheDocument();
      expect(screen.getByText("FOUNDERS")).toBeInTheDocument();
      expect(screen.getByText("ARENA")).toBeInTheDocument();
    });

    it("clicking zone tab dispatches zone-change event", () => {
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));
      dispatchedEvents = [];

      fireEvent.click(screen.getByText("HQ"));

      const zoneEvents = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-zone-change"
      );
      expect(zoneEvents).toHaveLength(1);
      expect(zoneEvents[0].detail.zone).toBe("labs");
    });

    it("clicking zone tab updates store", () => {
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));

      fireEvent.click(screen.getByText("ARENA"));
      expect(useGameStore.getState().currentZone).toBe("arena");
    });
  });

  describe("zone-specific locations", () => {
    it("shows Park locations for main_city zone", () => {
      useGameStore.setState({ currentZone: "main_city" });
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));

      expect(screen.getByText("Rewards Center")).toBeInTheDocument();
      expect(screen.getByText("Community Fund")).toBeInTheDocument();
    });

    it("shows BagsCity locations for trending zone", () => {
      useGameStore.setState({ currentZone: "trending" });
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));

      expect(screen.getByText("Casino")).toBeInTheDocument();
      expect(screen.getByText("Oracle")).toBeInTheDocument();
      expect(screen.getByText("Terminal")).toBeInTheDocument();
    });

    it("shows HQ locations for labs zone", () => {
      useGameStore.setState({ currentZone: "labs" });
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));

      expect(screen.getByText("Bags.FM HQ")).toBeInTheDocument();
    });
  });

  describe("location clicks", () => {
    it("clicking a location with an event dispatches it", () => {
      useGameStore.setState({ currentZone: "main_city" });
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));
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
      fireEvent.click(screen.getByLabelText("Open map"));
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
      fireEvent.click(screen.getByLabelText("Open map"));

      expect(screen.getByText("LAUNCH")).toBeInTheDocument();
      expect(screen.getByText("CLAIM")).toBeInTheDocument();
    });

    it("LAUNCH button dispatches launch-click event", () => {
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));
      dispatchedEvents = [];

      fireEvent.click(screen.getByText("LAUNCH"));

      const events = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-launch-click"
      );
      expect(events).toHaveLength(1);
    });

    it("CLAIM button dispatches claim-click event", () => {
      render(<MiniMap />);
      fireEvent.click(screen.getByLabelText("Open map"));
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
      fireEvent.click(screen.getByLabelText("Open map"));

      fireEvent.click(screen.getByText("CITY"));

      expect(onNavigate).toHaveBeenCalledWith("trending");
    });
  });
});
