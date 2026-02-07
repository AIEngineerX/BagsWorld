import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ZoneNav, ZONE_ORDER, MAIN_ZONES } from "@/components/ZoneNav";
import { ZONES } from "@/lib/types";
import { useGameStore } from "@/lib/store";

const DUNGEON_BTN_INDEX = MAIN_ZONES.length;

let dispatchedEvents: CustomEvent[] = [];
const originalDispatchEvent = window.dispatchEvent;

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

  it("main zones first, dungeon last", () => {
    expect(ZONE_ORDER.slice(0, MAIN_ZONES.length)).toEqual(MAIN_ZONES);
    expect(ZONE_ORDER[ZONE_ORDER.length - 1]).toBe("dungeon");
  });
});

describe("ZoneNav rendering", () => {
  it("renders all zone buttons with icons and labels", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(ZONE_ORDER.length);

    ZONE_ORDER.forEach((zoneId) => {
      expect(screen.getByText(ZONES[zoneId].icon)).toBeInTheDocument();
    });
  });

  it("every button has 3 spans with non-empty short label", () => {
    render(<ZoneNav />);
    screen.getAllByRole("button").forEach((button) => {
      const spans = button.querySelectorAll("span");
      expect(spans).toHaveLength(3);
      expect(spans[1].textContent).toBeTruthy();
    });
  });

  it("main buttons are inside nav, dungeon button is outside", () => {
    const { container } = render(<ZoneNav />);
    const nav = container.querySelector("nav")!;
    expect(nav.querySelectorAll("button")).toHaveLength(MAIN_ZONES.length);
  });

  it("sets title attribute from zone description", () => {
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    ZONE_ORDER.forEach((zoneId, i) => {
      expect(buttons[i]).toHaveAttribute("title", ZONES[zoneId].description);
    });
  });
});

describe("ZoneNav active highlighting", () => {
  it("highlights active main zone with green", () => {
    useGameStore.setState({ currentZone: "main_city" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    const parkIndex = MAIN_ZONES.indexOf("main_city");

    expect(buttons[parkIndex].className).toContain("bg-bags-green");
    MAIN_ZONES.forEach((zone, i) => {
      if (zone !== "main_city") {
        expect(buttons[i].className).not.toContain("bg-bags-green");
      }
    });
  });

  it("updates highlight when zone changes", () => {
    const { rerender } = render(<ZoneNav />);
    act(() => useGameStore.setState({ currentZone: "labs" }));
    rerender(<ZoneNav />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[MAIN_ZONES.indexOf("labs")].className).toContain("bg-bags-green");
  });

  it("highlights dungeon with purple when active", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    const dungeon = buttons[DUNGEON_BTN_INDEX];

    expect(dungeon.className).toContain("bg-purple-600");
    expect(dungeon.className).toContain("text-white");
    expect(dungeon.className).toContain("border-purple-400");
  });

  it("dungeon has purple inactive styling when not active", () => {
    render(<ZoneNav />);
    const dungeon = screen.getAllByRole("button")[DUNGEON_BTN_INDEX];
    expect(dungeon.className).toContain("border-purple-500/50");
    expect(dungeon.className).toContain("text-purple-400");
    expect(dungeon.className).not.toContain("bg-purple-600");
  });

  it("no main zones highlighted when dungeon is active", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    const buttons = screen.getAllByRole("button");
    MAIN_ZONES.forEach((_zone, i) => {
      expect(buttons[i].className).not.toContain("bg-bags-green");
    });
  });
});

describe("ZoneNav click behavior", () => {
  it("dispatches event and updates store on zone click", () => {
    render(<ZoneNav />);
    fireEvent.click(screen.getAllByRole("button")[MAIN_ZONES.indexOf("labs")]);

    const zoneEvents = dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change");
    expect(zoneEvents).toHaveLength(1);
    expect(zoneEvents[0].detail).toEqual({ zone: "labs" });
    expect(useGameStore.getState().currentZone).toBe("labs");
  });

  it("no-ops when clicking the already-active zone", () => {
    useGameStore.setState({ currentZone: "trending" });
    render(<ZoneNav />);
    fireEvent.click(screen.getAllByRole("button")[MAIN_ZONES.indexOf("trending")]);

    expect(dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change")).toHaveLength(0);
  });

  it("emits correct detail for each main zone", () => {
    MAIN_ZONES.forEach((targetZone) => {
      dispatchedEvents = [];
      const otherZone = MAIN_ZONES.find((z) => z !== targetZone)!;
      useGameStore.setState({ currentZone: otherZone });

      const { unmount } = render(<ZoneNav />);
      fireEvent.click(screen.getAllByRole("button")[MAIN_ZONES.indexOf(targetZone)]);

      const zoneEvents = dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change");
      expect(zoneEvents).toHaveLength(1);
      expect(zoneEvents[0].detail.zone).toBe(targetZone);
      unmount();
    });
  });

  it("dispatches and updates store when clicking dungeon", () => {
    render(<ZoneNav />);
    fireEvent.click(screen.getAllByRole("button")[DUNGEON_BTN_INDEX]);

    const zoneEvents = dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change");
    expect(zoneEvents).toHaveLength(1);
    expect(zoneEvents[0].detail).toEqual({ zone: "dungeon" });
    expect(useGameStore.getState().currentZone).toBe("dungeon");
  });

  it("no-ops when clicking dungeon while already in dungeon", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    fireEvent.click(screen.getAllByRole("button")[DUNGEON_BTN_INDEX]);

    expect(dispatchedEvents.filter((e) => e.type === "bagsworld-zone-change")).toHaveLength(0);
  });

  it("navigates from dungeon to a main zone", () => {
    useGameStore.setState({ currentZone: "dungeon" });
    render(<ZoneNav />);
    fireEvent.click(screen.getAllByRole("button")[MAIN_ZONES.indexOf("labs")]);

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
  ];

  zoneColors.forEach(([zone, borderClass, textClass]) => {
    it(`${zone} has ${textClass} when inactive`, () => {
      useGameStore.setState({ currentZone: zone === "main_city" ? "labs" : "main_city" });
      render(<ZoneNav />);
      const button = screen.getAllByRole("button")[MAIN_ZONES.indexOf(zone as any)];
      expect(button.className).toContain(borderClass);
      expect(button.className).toContain(textClass);
    });
  });

  it("main_city has default gray styling (no zone-specific color)", () => {
    useGameStore.setState({ currentZone: "labs" });
    render(<ZoneNav />);
    const button = screen.getAllByRole("button")[MAIN_ZONES.indexOf("main_city")];
    expect(button.className).toContain("border-gray-600");
    expect(button.className).toContain("text-gray-400");
  });

  it("active zone loses zone-specific colors", () => {
    useGameStore.setState({ currentZone: "labs" });
    render(<ZoneNav />);
    const button = screen.getAllByRole("button")[MAIN_ZONES.indexOf("labs")];
    expect(button.className).not.toContain("text-green-400");
  });
});
