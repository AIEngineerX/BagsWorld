/**
 * ZoneNav Component Tests
 *
 * Tests the zone navigation bar with:
 * - ZONE_ORDER constant integrity (all 8 zones, correct order)
 * - ZONE_SHORT_LABELS mapping completeness
 * - Rendering 7 main zone buttons + 1 dungeon button (separate row)
 * - Active zone highlighting (green for main, purple for dungeon)
 * - Click handler: same zone no-op, different zone dispatches event + updates store
 * - Custom event detail structure
 * - Mobile responsive classes (short labels, touch targets)
 * - Accessibility: title attributes
 * - Zone-specific color styling
 * - Dungeon-specific purple styling and separate layout
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ZoneNav, ZONE_ORDER } from "@/components/ZoneNav";
import { ZONES, ZoneType } from "@/lib/types";
import { useGameStore } from "@/lib/store";

// The 7 main zones (rendered in the <nav> row)
const MAIN_ZONES: ZoneType[] = [
  "labs",
  "moltbook",
  "main_city",
  "trending",
  "ballers",
  "founders",
  "arena",
];

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
  it("contains exactly 8 zones", () => {
    expect(ZONE_ORDER).toHaveLength(8);
  });

  it("contains all valid ZoneType values", () => {
    const allZones: ZoneType[] = [...MAIN_ZONES, "dungeon"];
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

  it("starts with 'labs' and ends with 'dungeon'", () => {
    expect(ZONE_ORDER[0]).toBe("labs");
    expect(ZONE_ORDER[ZONE_ORDER.length - 1]).toBe("dungeon");
  });

  it("has dungeon after all main zones", () => {
    const dungeonIndex = ZONE_ORDER.indexOf("dungeon");
    const arenaIndex = ZONE_ORDER.indexOf("arena");
    expect(dungeonIndex).toBeGreaterThan(arenaIndex);
  });

  it("main zones are in expected order", () => {
    expect(ZONE_ORDER.slice(0, 7)).toEqual(MAIN_ZONES);
  });
});

describe("ZoneNav rendering", () => {
  it("renders 8 total zone buttons (7 main + 1 dungeon)", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(8);
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
    expect(screen.getAllByText("HQ").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("BEACH")).toBeInTheDocument();
    expect(screen.getAllByText("PARK").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CITY")).toBeInTheDocument();
    expect(screen.getByText("BALLERS")).toBeInTheDocument();
    expect(screen.getByText("LAUNCH")).toBeInTheDocument();
    expect(screen.getByText("ARENA")).toBeInTheDocument();
    expect(screen.getByText("DUNGEON")).toBeInTheDocument();
  });

  it("renders full zone names for desktop (hidden sm:inline text)", () => {
    render(<ZoneNav />);
    ZONE_ORDER.forEach((zoneId) => {
      const zone = ZONES[zoneId];
      const upperName = zone.name.toUpperCase();
      const matches = screen.getAllByText(upperName);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("sets title attribute with zone description on each main button", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    // First 7 buttons are main zones
    MAIN_ZONES.forEach((zoneId, i) => {
      const zone = ZONES[zoneId];
      expect(buttons[i]).toHaveAttribute("title", zone.description);
    });
  });

  it("sets title attribute on dungeon button", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    const dungeonButton = buttons[7]; // Last button
    expect(dungeonButton).toHaveAttribute("title", ZONES.dungeon.description);
  });

  it("renders nav element as container for main zones", () => {
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

  it("dungeon button is outside the nav element", () => {
    const { container } = render(<ZoneNav />);
    const nav = container.querySelector("nav");
    const buttonsInNav = nav?.querySelectorAll("button") ?? [];
    expect(buttonsInNav).toHaveLength(7); // Only main zones in nav
  });

  it("buttons have mobile-responsive text size classes", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
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
  it("highlights the current main zone with green active styles", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    const parkIndex = MAIN_ZONES.indexOf("main_city");
    expect(buttons[parkIndex].className).toContain("bg-bags-green");
    expect(buttons[parkIndex].className).toContain("text-bags-dark");
  });

  it("does not highlight inactive zones with active class", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    MAIN_ZONES.forEach((zone, i) => {
      if (zone !== "main_city") {
        expect(buttons[i].className).not.toContain(
          "bg-bags-green text-bags-dark border-bags-green shadow"
        );
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
    const labsIndex = MAIN_ZONES.indexOf("labs");
    expect(buttons[labsIndex].className).toContain("bg-bags-green");
  });

  it("highlights dungeon button with purple when dungeon is active", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    const dungeonButton = buttons[7]; // Last button
    expect(dungeonButton.className).toContain("bg-purple-600");
    expect(dungeonButton.className).toContain("text-white");
    expect(dungeonButton.className).toContain("border-purple-400");
  });

  it("dungeon button has purple inactive styling when not active", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    const dungeonButton = buttons[7];
    expect(dungeonButton.className).toContain("border-purple-500/50");
    expect(dungeonButton.className).toContain("text-purple-400");
    expect(dungeonButton.className).not.toContain("bg-purple-600");
  });

  it("no main zone buttons are highlighted when dungeon is active", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    MAIN_ZONES.forEach((_zone, i) => {
      expect(buttons[i].className).not.toContain("bg-bags-green");
    });
  });
});

describe("ZoneNav click behavior", () => {
  it("dispatches zone change event when clicking a different zone", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);

    const labsIndex = MAIN_ZONES.indexOf("labs");
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

    const arenaIndex = MAIN_ZONES.indexOf("arena");
    fireEvent.click(screen.getAllByRole("button")[arenaIndex]);
    expect(useGameStore.getState().currentZone).toBe("arena");
  });

  it("does NOT dispatch event when clicking the already-active zone", () => {
    useGameStore.setState({ currentZone: "trending" });
    render(<ZoneNav />);

    const trendingIndex = MAIN_ZONES.indexOf("trending");
    fireEvent.click(screen.getAllByRole("button")[trendingIndex]);

    const zoneEvents = dispatchedEvents.filter(
      (e) => e.type === "bagsworld-zone-change"
    );
    expect(zoneEvents).toHaveLength(0);
  });

  it("emits correct zone detail for each main zone", () => {
    MAIN_ZONES.forEach((targetZone) => {
      dispatchedEvents = [];
      const otherZone = MAIN_ZONES.find((z) => z !== targetZone)!;
      useGameStore.setState({ currentZone: otherZone });

      const { unmount } = render(<ZoneNav />);
      const targetIndex = MAIN_ZONES.indexOf(targetZone);
      fireEvent.click(screen.getAllByRole("button")[targetIndex]);

      const zoneEvents = dispatchedEvents.filter(
        (e) => e.type === "bagsworld-zone-change"
      );
      expect(zoneEvents).toHaveLength(1);
      expect(zoneEvents[0].detail.zone).toBe(targetZone);
      unmount();
    });
  });

  it("dispatches zone change when clicking dungeon button", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[7]); // Dungeon is last button

    const zoneEvents = dispatchedEvents.filter(
      (e) => e.type === "bagsworld-zone-change"
    );
    expect(zoneEvents).toHaveLength(1);
    expect(zoneEvents[0].detail).toEqual({ zone: "dungeon" });
  });

  it("updates store to dungeon when clicking dungeon button", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);

    fireEvent.click(screen.getAllByRole("button")[7]);
    expect(useGameStore.getState().currentZone).toBe("dungeon");
  });

  it("does NOT dispatch event when clicking dungeon while already in dungeon", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);

    fireEvent.click(screen.getAllByRole("button")[7]);

    const zoneEvents = dispatchedEvents.filter(
      (e) => e.type === "bagsworld-zone-change"
    );
    expect(zoneEvents).toHaveLength(0);
  });

  it("can navigate from dungeon to a main zone", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);

    const labsIndex = MAIN_ZONES.indexOf("labs");
    fireEvent.click(screen.getAllByRole("button")[labsIndex]);

    expect(useGameStore.getState().currentZone).toBe("labs");
    const zoneEvents = dispatchedEvents.filter(
      (e) => e.type === "bagsworld-zone-change"
    );
    expect(zoneEvents).toHaveLength(1);
    expect(zoneEvents[0].detail.zone).toBe("labs");
  });

  it("dispatches CustomEvent (not plain Event)", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);

    fireEvent.click(screen.getAllByRole("button")[0]); // labs

    expect(dispatchedEvents[0]).toBeInstanceOf(CustomEvent);
    expect(dispatchedEvents[0].detail).toBeDefined();
  });
});

describe("ZoneNav zone-specific styling", () => {
  it("labs button has green-specific inactive styling", () => {
    useGameStore.setState({ currentZone: "trending" }); // not labs
    render(<ZoneNav />);
    const labsIndex = MAIN_ZONES.indexOf("labs");
    const button = screen.getAllByRole("button")[labsIndex];
    expect(button.className).toContain("border-green-500/50");
    expect(button.className).toContain("text-green-400");
  });

  it("moltbook button has red-specific inactive styling", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const idx = MAIN_ZONES.indexOf("moltbook");
    const button = screen.getAllByRole("button")[idx];
    expect(button.className).toContain("border-red-500/50");
    expect(button.className).toContain("text-red-400");
  });

  it("trending button has yellow/gold inactive styling", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const idx = MAIN_ZONES.indexOf("trending");
    const button = screen.getAllByRole("button")[idx];
    expect(button.className).toContain("border-yellow-500/50");
    expect(button.className).toContain("text-bags-gold");
  });

  it("arena button has red-specific inactive styling", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const idx = MAIN_ZONES.indexOf("arena");
    const button = screen.getAllByRole("button")[idx];
    expect(button.className).toContain("border-red-500/50");
    expect(button.className).toContain("text-red-400");
  });

  it("ballers button has yellow-specific inactive styling", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const idx = MAIN_ZONES.indexOf("ballers");
    const button = screen.getAllByRole("button")[idx];
    expect(button.className).toContain("border-yellow-500/50");
    expect(button.className).toContain("text-yellow-400");
  });

  it("founders button has amber-specific inactive styling", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const idx = MAIN_ZONES.indexOf("founders");
    const button = screen.getAllByRole("button")[idx];
    expect(button.className).toContain("border-amber-500/50");
    expect(button.className).toContain("text-amber-400");
  });

  it("main_city button has default inactive styling (no zone-specific color)", () => {
    useGameStore.setState({ currentZone: "labs" });
    render(<ZoneNav />);
    const idx = MAIN_ZONES.indexOf("main_city");
    const button = screen.getAllByRole("button")[idx];
    // main_city has no entry in ZONE_COLORS, so only base inactive styles
    expect(button.className).toContain("border-gray-600");
    expect(button.className).toContain("text-gray-400");
  });

  it("active zone does NOT get zone-specific colors (overridden by active)", () => {
    useGameStore.setState({ currentZone: "labs" });
    render(<ZoneNav />);
    const labsIndex = MAIN_ZONES.indexOf("labs");
    const button = screen.getAllByRole("button")[labsIndex];
    expect(button.className).not.toContain("border-green-500/50 text-green-400");
  });

  it("dungeon button has purple glow shadow when active", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    const dungeonButton = screen.getAllByRole("button")[7];
    expect(dungeonButton.className).toContain("shadow-");
    expect(dungeonButton.className).toContain("purple");
  });
});
