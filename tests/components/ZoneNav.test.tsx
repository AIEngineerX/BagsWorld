/**
 * ZoneNav Component Tests
 *
 * Tests the zone navigation bar with:
 * - ZONE_ORDER constant integrity (all zones, correct order)
 * - ZONE_SHORT_LABELS mapping completeness
 * - Rendering all 7 zone buttons
 * - Active zone highlighting
 * - Click handler: same zone no-op, different zone dispatches event + updates store
 * - Custom event detail structure
 * - Mobile responsive classes (short labels, touch targets)
 * - Accessibility: title attributes
 * - Zone-specific color styling
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ZoneNav, ZONE_ORDER } from "@/components/ZoneNav";
import { ZONES, ZoneType } from "@/lib/types";
import { useGameStore } from "@/lib/store";

// Track dispatched events
let dispatchedEvents: CustomEvent[] = [];
const originalDispatchEvent = window.dispatchEvent;

beforeEach(() => {
  dispatchedEvents = [];
  window.dispatchEvent = jest.fn((event: Event) => {
    if (event instanceof CustomEvent) {
      dispatchedEvents.push(event);
    }
    return originalDispatchEvent.call(window, event);
  }) as typeof window.dispatchEvent;

  // Reset store to default
  useGameStore.setState({
    currentZone: "main_city",
  });
});

afterEach(() => {
  window.dispatchEvent = originalDispatchEvent;
});

describe("ZONE_ORDER constant", () => {
  it("contains exactly 7 zones", () => {
    expect(ZONE_ORDER).toHaveLength(7);
  });

  it("contains all valid ZoneType values", () => {
    const allZones: ZoneType[] = [
      "labs",
      "moltbook",
      "main_city",
      "trending",
      "ballers",
      "founders",
      "arena",
    ];
    allZones.forEach((zone) => {
      expect(ZONE_ORDER).toContain(zone);
    });
  });

  it("has no duplicate zones", () => {
    const unique = new Set(ZONE_ORDER);
    expect(unique.size).toBe(ZONE_ORDER.length);
  });

  it("matches all keys in ZONES constant", () => {
    const zoneKeys = Object.keys(ZONES);
    expect(ZONE_ORDER).toHaveLength(zoneKeys.length);
    ZONE_ORDER.forEach((zone) => {
      expect(ZONES[zone]).toBeDefined();
    });
  });

  it("starts with 'labs' and ends with 'arena'", () => {
    expect(ZONE_ORDER[0]).toBe("labs");
    expect(ZONE_ORDER[ZONE_ORDER.length - 1]).toBe("arena");
  });
});

describe("ZoneNav rendering", () => {
  it("renders 7 zone buttons", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(7);
  });

  it("renders icons for all zones", () => {
    render(<ZoneNav />);
    ZONE_ORDER.forEach((zoneId) => {
      const zone = ZONES[zoneId];
      expect(screen.getByText(zone.icon)).toBeInTheDocument();
    });
  });

  it("renders short labels for mobile (sm:hidden text)", () => {
    render(<ZoneNav />);
    // "HQ" appears twice: short label + full name (both "HQ" for labs zone)
    // "PARK" appears twice: short label + full name (both "PARK" for main_city)
    expect(screen.getAllByText("HQ").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("BEACH")).toBeInTheDocument();
    expect(screen.getAllByText("PARK").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CITY")).toBeInTheDocument();
    // "BALLERS" short label is distinct from full "BALLERS VALLEY"
    expect(screen.getByText("BALLERS")).toBeInTheDocument();
    expect(screen.getByText("LAUNCH")).toBeInTheDocument();
    expect(screen.getByText("ARENA")).toBeInTheDocument();
  });

  it("renders full zone names for desktop (hidden sm:inline text)", () => {
    render(<ZoneNav />);
    ZONE_ORDER.forEach((zoneId) => {
      const zone = ZONES[zoneId];
      const upperName = zone.name.toUpperCase();
      // Some names match short labels (HQ, PARK) so use getAllByText
      const matches = screen.getAllByText(upperName);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("sets title attribute with zone description on each button", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button, i) => {
      const zone = ZONES[ZONE_ORDER[i]];
      expect(button).toHaveAttribute("title", zone.description);
    });
  });

  it("renders nav element as container", () => {
    const { container } = render(<ZoneNav />);
    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();
  });

  it("nav has scrollbar-hide class for mobile horizontal scroll", () => {
    const { container } = render(<ZoneNav />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("scrollbar-hide");
    expect(nav?.className).toContain("overflow-x-auto");
  });

  it("buttons have mobile-responsive text size classes", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      // Check mobile-first text-[11px] and desktop sm:text-[10px]
      expect(button.className).toContain("text-[11px]");
      expect(button.className).toContain("sm:text-[10px]");
    });
  });

  it("buttons have 44px min height for mobile touch targets", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button.className).toContain("min-h-[44px]");
    });
  });
});

describe("ZoneNav active zone highlighting", () => {
  it("highlights the current zone with active styles", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    // main_city is at index 2 in ZONE_ORDER
    const parkIndex = ZONE_ORDER.indexOf("main_city");
    expect(buttons[parkIndex].className).toContain("bg-bags-green");
    expect(buttons[parkIndex].className).toContain("text-bags-dark");
  });

  it("does not highlight inactive zones with active class", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    ZONE_ORDER.forEach((zone, i) => {
      if (zone !== "main_city") {
        // Inactive buttons should not have the active background
        expect(buttons[i].className).not.toContain("bg-bags-green text-bags-dark border-bags-green shadow");
      }
    });
  });

  it("changes highlight when currentZone changes", () => {
    const { rerender } = render(<ZoneNav />);

    act(() => {
      useGameStore.setState({ currentZone: "labs" });
    });
    rerender(<ZoneNav />);

    const buttons = screen.getAllByRole("button");
    const labsIndex = ZONE_ORDER.indexOf("labs");
    expect(buttons[labsIndex].className).toContain("bg-bags-green");
  });
});

describe("ZoneNav click behavior", () => {
  it("dispatches zone change event when clicking a different zone", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);

    const labsIndex = ZONE_ORDER.indexOf("labs");
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[labsIndex]);

    const zoneEvents = dispatchedEvents.filter(
      (e) => e.type === "bagsworld-zone-change"
    );
    expect(zoneEvents).toHaveLength(1);
    expect(zoneEvents[0].detail).toEqual({ zone: "labs" });
  });

  it("updates store zone when clicking a different zone", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);

    const arenaIndex = ZONE_ORDER.indexOf("arena");
    fireEvent.click(screen.getAllByRole("button")[arenaIndex]);
    expect(useGameStore.getState().currentZone).toBe("arena");
  });

  it("does NOT dispatch event when clicking the already-active zone", () => {
    useGameStore.setState({ currentZone: "trending" });
    render(<ZoneNav />);

    const trendingIndex = ZONE_ORDER.indexOf("trending");
    fireEvent.click(screen.getAllByRole("button")[trendingIndex]);

    const zoneEvents = dispatchedEvents.filter(
      (e) => e.type === "bagsworld-zone-change"
    );
    expect(zoneEvents).toHaveLength(0);
  });

  it("emits correct zone detail for each zone", () => {
    ZONE_ORDER.forEach((targetZone) => {
      dispatchedEvents = [];
      // Set to a zone that is NOT the target
      const otherZone = ZONE_ORDER.find((z) => z !== targetZone)!;
      useGameStore.setState({ currentZone: otherZone });

      const { unmount } = render(<ZoneNav />);
      const targetIndex = ZONE_ORDER.indexOf(targetZone);
      fireEvent.click(screen.getAllByRole("button")[targetIndex]);

      const zoneEvents = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-zone-change"
      );
      expect(zoneEvents).toHaveLength(1);
      expect(zoneEvents[0].detail.zone).toBe(targetZone);
      unmount();
    });
  });
});

describe("ZoneNav zone-specific styling", () => {
  it("labs button has green-specific inactive styling", () => {
    useGameStore.setState({ currentZone: "trending" }); // not labs
    render(<ZoneNav />);
    const labsIndex = ZONE_ORDER.indexOf("labs");
    const button = screen.getAllByRole("button")[labsIndex];
    expect(button.className).toContain("border-green-500/50");
    expect(button.className).toContain("text-green-400");
  });

  it("moltbook button has red-specific inactive styling", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const idx = ZONE_ORDER.indexOf("moltbook");
    const button = screen.getAllByRole("button")[idx];
    expect(button.className).toContain("border-red-500/50");
    expect(button.className).toContain("text-red-400");
  });

  it("trending button has yellow/gold inactive styling", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const idx = ZONE_ORDER.indexOf("trending");
    const button = screen.getAllByRole("button")[idx];
    expect(button.className).toContain("border-yellow-500/50");
    expect(button.className).toContain("text-bags-gold");
  });

  it("arena button has red-specific inactive styling", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const idx = ZONE_ORDER.indexOf("arena");
    const button = screen.getAllByRole("button")[idx];
    expect(button.className).toContain("border-red-500/50");
    expect(button.className).toContain("text-red-400");
  });

  it("active zone does NOT get zone-specific colors (overridden by active)", () => {
    useGameStore.setState({ currentZone: "labs" });
    render(<ZoneNav />);
    const labsIndex = ZONE_ORDER.indexOf("labs");
    const button = screen.getAllByRole("button")[labsIndex];
    // When active, should NOT have the inactive zone-specific colors
    expect(button.className).not.toContain("border-green-500/50 text-green-400");
  });
});
