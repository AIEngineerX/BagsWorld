import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ZoneNav, ZONE_ORDER, MAIN_ZONES } from "@/components/ZoneNav";
import { ZONES, ZoneType } from "@/lib/types";
import { useGameStore } from "@/lib/store";

/** Return the first button matching `[data-zone="<zone>"]`. */
function getZoneButton(zone: ZoneType): HTMLElement {
  const btn = document.querySelector(`[data-zone="${zone}"]`);
  if (!btn) throw new Error(`No button with data-zone="${zone}"`);
  return btn as HTMLElement;
}

let dispatchedEvents: CustomEvent[] = [];
const originalDispatchEvent = window.dispatchEvent;

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  dispatchedEvents = [];
  window.dispatchEvent = jest.fn((event: Event) => {
    if (event instanceof CustomEvent) dispatchedEvents.push(event);
    return originalDispatchEvent.call(window, event);
  }) as typeof window.dispatchEvent;
  useGameStore.setState({ currentZone: "main_city" });
});

afterEach(() => {
  window.dispatchEvent = originalDispatchEvent;
});

describe("ZONE_ORDER constant", () => {
  it("has no duplicates and matches ZONES keys", () => {
    expect(new Set(ZONE_ORDER).size).toBe(ZONE_ORDER.length);
    expect(ZONE_ORDER).toHaveLength(Object.keys(ZONES).length);
    ZONE_ORDER.forEach((zone) => expect(ZONES[zone]).toBeDefined());
  });

  it("main zones first, special zones after", () => {
    // ZONE_ORDER = [ascension, ...MAIN_ZONES, dungeon]
    // ascension is a special zone at the start
    expect(ZONE_ORDER.slice(1, MAIN_ZONES.length + 1)).toEqual(MAIN_ZONES);
    const specialZones = [ZONE_ORDER[0], ZONE_ORDER[ZONE_ORDER.length - 1]];
    expect(specialZones).toContain("dungeon");
    expect(specialZones).toContain("ascension");
  });
});

describe("ZoneNav rendering", () => {
  it("renders all zone buttons with icons and labels", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(ZONE_ORDER.length);

    ZONE_ORDER.forEach((zoneId) => {
      expect(screen.getAllByText(ZONES[zoneId].icon).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("every button has 4 spans (icon + 3 label variants) with non-empty short label", () => {
    render(<ZoneNav />);
    screen.getAllByRole("button").forEach((button) => {
      const spans = button.querySelectorAll("span");
      expect(spans).toHaveLength(4);
      // spans[0] = icon, spans[1] = mobile short label, spans[2] = tablet label, spans[3] = desktop full name
      expect(spans[1].textContent).toBeTruthy();
    });
  });

  it("mobile nav contains all zones, desktop nav has all zones in 3 rows", () => {
    const { container } = render(<ZoneNav />);
    const navs = container.querySelectorAll("nav");
    // Mobile nav (first) has all zones
    expect(navs[0].querySelectorAll("button")).toHaveLength(ZONE_ORDER.length);
    // Desktop nav (second) has ascension + main zones + dungeon
    expect(navs[1].querySelectorAll("button")).toHaveLength(MAIN_ZONES.length + 2);
  });

  it("sets title attribute from zone description", () => {
    render(<ZoneNav />);
    ZONE_ORDER.forEach((zoneId) => {
      const btn = getZoneButton(zoneId);
      expect(btn).toHaveAttribute("title", ZONES[zoneId].description);
    });
  });
});

describe("ZoneNav active highlighting", () => {
  it("highlights active main zone with green", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const parkBtn = getZoneButton("main_city");
    expect(parkBtn.className).toContain("bg-bags-green");

    MAIN_ZONES.forEach((zone) => {
      if (zone !== "main_city") {
        expect(getZoneButton(zone).className).not.toContain("bg-bags-green");
      }
    });
  });

  it("updates highlight when zone changes", () => {
    const { rerender } = render(<ZoneNav />);
    act(() => useGameStore.setState({ currentZone: "labs" }));
    rerender(<ZoneNav />);

    expect(getZoneButton("labs").className).toContain("bg-bags-green");
  });

  it("highlights dungeon with purple when active", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    const dungeon = getZoneButton("dungeon");

    expect(dungeon.className).toContain("bg-purple-600");
    expect(dungeon.className).toContain("text-white");
    expect(dungeon.className).toContain("border-purple-400");
  });

  it("dungeon has purple inactive styling when not active", () => {
    render(<ZoneNav />);
    const dungeon = getZoneButton("dungeon");
    expect(dungeon.className).toContain("border-purple-500/50");
    expect(dungeon.className).toContain("text-purple-400");
    expect(dungeon.className).not.toContain("bg-purple-600");
  });

  it("no main zones highlighted when dungeon is active", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    MAIN_ZONES.forEach((zone) => {
      expect(getZoneButton(zone).className).not.toContain("bg-bags-green");
    });
  });
});

describe("ZoneNav click behavior", () => {
  it("dispatches event and updates store on zone click", () => {
    render(<ZoneNav />);
    fireEvent.click(getZoneButton("labs"));

    const zoneEvents = dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change");
    expect(zoneEvents).toHaveLength(1);
    expect(zoneEvents[0].detail).toEqual({ zone: "labs" });
    expect(useGameStore.getState().currentZone).toBe("labs");
  });

  it("no-ops when clicking the already-active zone", () => {
    useGameStore.setState({ currentZone: "trending" });
    render(<ZoneNav />);
    fireEvent.click(getZoneButton("trending"));

    expect(dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change")).toHaveLength(0);
  });

  it("emits correct detail for each main zone", () => {
    MAIN_ZONES.forEach((targetZone) => {
      dispatchedEvents = [];
      const otherZone = MAIN_ZONES.find((z) => z !== targetZone)!;
      useGameStore.setState({ currentZone: otherZone });

      const { unmount } = render(<ZoneNav />);
      fireEvent.click(getZoneButton(targetZone));

      const zoneEvents = dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change");
      expect(zoneEvents).toHaveLength(1);
      expect(zoneEvents[0].detail.zone).toBe(targetZone);
      unmount();
    });
  });

  it("dispatches and updates store when clicking dungeon", () => {
    render(<ZoneNav />);
    fireEvent.click(getZoneButton("dungeon"));

    const zoneEvents = dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change");
    expect(zoneEvents).toHaveLength(1);
    expect(zoneEvents[0].detail).toEqual({ zone: "dungeon" });
    expect(useGameStore.getState().currentZone).toBe("dungeon");
  });

  it("no-ops when clicking dungeon while already in dungeon", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    fireEvent.click(getZoneButton("dungeon"));

    expect(dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change")).toHaveLength(0);
  });

  it("navigates from dungeon to a main zone", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    fireEvent.click(getZoneButton("labs"));

    expect(useGameStore.getState().currentZone).toBe("labs");
  });
});

describe("ZoneNav zone-specific colors", () => {
  const zoneColors: [string, string, string][] = [
    ["labs", "border-green-500/50", "text-green-400"],
    ["moltbook", "border-red-500/50", "text-red-400"],
    ["trending", "border-yellow-500/50", "text-bags-gold"],
    ["ballers", "border-yellow-500/50", "text-yellow-400"],
    ["founders", "border-amber-500/50", "text-amber-400"],
    ["arena", "border-red-500/50", "text-red-400"],
    ["disclosure", "border-teal-500/50", "text-teal-400"],
  ];

  zoneColors.forEach(([zone, borderClass, textClass]) => {
    it(`${zone} has ${textClass} when inactive`, () => {
      useGameStore.setState({ currentZone: zone === "main_city" ? "labs" : "main_city" });
      render(<ZoneNav />);
      const button = getZoneButton(zone as ZoneType);
      expect(button.className).toContain(borderClass);
      expect(button.className).toContain(textClass);
    });
  });

  it("main_city has default gray styling (no zone-specific color)", () => {
    useGameStore.setState({ currentZone: "labs" });
    render(<ZoneNav />);
    const button = getZoneButton("main_city");
    expect(button.className).toContain("border-gray-600");
    expect(button.className).toContain("text-gray-400");
  });

  it("active zone loses zone-specific colors", () => {
    useGameStore.setState({ currentZone: "labs" });
    render(<ZoneNav />);
    const button = getZoneButton("labs");
    expect(button.className).not.toContain("text-green-400");
  });
});
