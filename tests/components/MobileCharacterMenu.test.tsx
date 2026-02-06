/**
 * MobileCharacterMenu Component Tests
 *
 * Tests the floating character chat menu with:
 * - Position: renders at bottom-left (not right)
 * - Toggle open/close behavior
 * - Character button clicks dispatch correct events
 * - Menu closes after character selection
 * - All characters present in both sections
 * - Font size classes for readability
 * - Only visible on mobile (sm:hidden)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MobileCharacterMenu } from "@/components/MobileCharacterMenu";

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
});

afterEach(() => {
  window.dispatchEvent = originalDispatchEvent;
});

describe("MobileCharacterMenu", () => {
  describe("initial rendering", () => {
    it("renders the toggle button", () => {
      render(<MobileCharacterMenu />);
      expect(screen.getByLabelText("Open character menu")).toBeInTheDocument();
    });

    it("shows [?] text on closed toggle", () => {
      render(<MobileCharacterMenu />);
      expect(screen.getByText("[?]")).toBeInTheDocument();
    });

    it("does not show character list initially", () => {
      render(<MobileCharacterMenu />);
      expect(screen.queryByText("[TALK TO]")).not.toBeInTheDocument();
    });

    it("has sm:hidden class for mobile-only visibility", () => {
      const { container } = render(<MobileCharacterMenu />);
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain("sm:hidden");
    });

    it("is positioned at bottom-left (left-4)", () => {
      const { container } = render(<MobileCharacterMenu />);
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain("left-4");
      expect(wrapper.className).not.toContain("right-4");
    });
  });

  describe("toggle behavior", () => {
    it("opens menu when toggle button is clicked", () => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
      expect(screen.getByText("[TALK TO]")).toBeInTheDocument();
    });

    it("shows [X] when menu is open", () => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
      expect(screen.getByText("[X]")).toBeInTheDocument();
    });

    it("closes menu when toggle clicked again", () => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
      expect(screen.getByText("[TALK TO]")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Open character menu"));
      expect(screen.queryByText("[TALK TO]")).not.toBeInTheDocument();
    });
  });

  describe("character list contents", () => {
    beforeEach(() => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
    });

    it("shows all main characters", () => {
      expect(screen.getByText("ASH")).toBeInTheDocument();
      expect(screen.getByText("TOLY")).toBeInTheDocument();
      expect(screen.getByText("FINN")).toBeInTheDocument();
      expect(screen.getByText("GHOST")).toBeInTheDocument();
      expect(screen.getByText("NEO")).toBeInTheDocument();
    });

    it("shows academy section header", () => {
      expect(screen.getByText("[ACADEMY]")).toBeInTheDocument();
    });

    it("shows all academy characters", () => {
      expect(screen.getByText("RAMO")).toBeInTheDocument();
      expect(screen.getByText("SINCARA")).toBeInTheDocument();
      expect(screen.getByText("STUU")).toBeInTheDocument();
      expect(screen.getByText("SAM")).toBeInTheDocument();
      expect(screen.getByText("ALAA")).toBeInTheDocument();
      expect(screen.getByText("CARLO")).toBeInTheDocument();
      expect(screen.getByText("BNN")).toBeInTheDocument();
    });

    it("has 12 total character buttons (5 main + 7 academy)", () => {
      // Toggle button + 12 character buttons = 13 total
      const allButtons = screen.getAllByRole("button");
      // Filter out the toggle button
      const charButtons = allButtons.filter(
        (b) => !b.getAttribute("aria-label")?.includes("character menu")
      );
      expect(charButtons).toHaveLength(12);
    });
  });

  describe("character click events", () => {
    const expectedEvents: Record<string, string> = {
      ASH: "bagsworld-ash-click",
      TOLY: "bagsworld-toly-click",
      FINN: "bagsworld-finn-click",
      GHOST: "bagsworld-dev-click",
      NEO: "bagsworld-neo-click",
      RAMO: "bagsworld-ramo-click",
      SINCARA: "bagsworld-sincara-click",
      STUU: "bagsworld-stuu-click",
      SAM: "bagsworld-sam-click",
      ALAA: "bagsworld-alaa-click",
      CARLO: "bagsworld-carlo-click",
      BNN: "bagsworld-bnn-click",
    };

    Object.entries(expectedEvents).forEach(([charName, eventName]) => {
      it(`clicking ${charName} dispatches "${eventName}"`, () => {
        render(<MobileCharacterMenu />);
        fireEvent.click(screen.getByLabelText("Open character menu"));
        dispatchedEvents = [];

        // Find the button containing the character name
        const charButton = screen.getByText(charName).closest("button")!;
        fireEvent.click(charButton);

        const matchingEvents = dispatchedEvents.filter(
          (e) => e.type === eventName
        );
        expect(matchingEvents).toHaveLength(1);
      });
    });

    it("closes menu after character is clicked", () => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
      expect(screen.getByText("[TALK TO]")).toBeInTheDocument();

      const ashButton = screen.getByText("ASH").closest("button")!;
      fireEvent.click(ashButton);

      expect(screen.queryByText("[TALK TO]")).not.toBeInTheDocument();
    });
  });

  describe("font sizes for readability", () => {
    it("header text is 10px (not 8px)", () => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
      const header = screen.getByText("[TALK TO]");
      expect(header.className).toContain("text-[10px]");
      expect(header.className).not.toContain("text-[8px]");
    });

    it("character name text is 11px", () => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
      const ashName = screen.getByText("ASH");
      expect(ashName.className).toContain("text-[11px]");
    });

    it("academy header text is 10px", () => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
      const academyHeader = screen.getByText("[ACADEMY]");
      expect(academyHeader.className).toContain("text-[10px]");
    });
  });

  describe("expanded menu positioning", () => {
    it("expanded menu anchors to left-0 (not right-0)", () => {
      render(<MobileCharacterMenu />);
      fireEvent.click(screen.getByLabelText("Open character menu"));
      const expandedMenu = screen.getByText("[TALK TO]").closest(
        ".absolute"
      ) as HTMLElement;
      expect(expandedMenu?.className).toContain("left-0");
      expect(expandedMenu?.className).not.toContain("right-0");
    });
  });
});
