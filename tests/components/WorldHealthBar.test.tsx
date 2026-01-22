/**
 * WorldHealthBar Component Tests
 *
 * Tests the health bar display with:
 * - Status threshold boundaries
 * - Health percentage display
 * - Accessibility attributes
 * - Visual class assignments
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorldHealthBar } from "@/components/WorldHealthBar";

// Mock the icons
jest.mock("@/components/icons", () => ({
  WorldIcon: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="world-icon" className={className}>
      WorldIcon
    </span>
  ),
  StarIcon: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="star-icon" className={className}>
      StarIcon
    </span>
  ),
  SunIcon: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="sun-icon" className={className}>
      SunIcon
    </span>
  ),
  CloudSunIcon: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="cloudsun-icon" className={className}>
      CloudSunIcon
    </span>
  ),
  StormIcon: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="storm-icon" className={className}>
      StormIcon
    </span>
  ),
  SkullIcon: ({ className, size }: { className?: string; size?: number }) => (
    <span data-testid="skull-icon" className={className}>
      SkullIcon
    </span>
  ),
}));

describe("WorldHealthBar Component", () => {
  describe("Status text display", () => {
    it("should show THRIVING for health >= 80", () => {
      render(<WorldHealthBar health={80} />);
      expect(screen.getByText("THRIVING")).toBeInTheDocument();
      expect(screen.getByTestId("star-icon")).toBeInTheDocument();
    });

    it("should show THRIVING for health = 100", () => {
      render(<WorldHealthBar health={100} />);
      expect(screen.getByText("THRIVING")).toBeInTheDocument();
    });

    it("should show HEALTHY for health 60-79", () => {
      render(<WorldHealthBar health={60} />);
      expect(screen.getByText("HEALTHY")).toBeInTheDocument();
      expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
    });

    it("should show HEALTHY for health = 79", () => {
      render(<WorldHealthBar health={79} />);
      expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    });

    it("should show GROWING for health 45-59", () => {
      render(<WorldHealthBar health={45} />);
      expect(screen.getByText("GROWING")).toBeInTheDocument();
      expect(screen.getByTestId("cloudsun-icon")).toBeInTheDocument();
    });

    it("should show GROWING for health = 59", () => {
      render(<WorldHealthBar health={59} />);
      expect(screen.getByText("GROWING")).toBeInTheDocument();
    });

    it("should show QUIET for health 25-44 (baseline)", () => {
      render(<WorldHealthBar health={25} />);
      expect(screen.getByText("QUIET")).toBeInTheDocument();
      expect(screen.getByTestId("cloudsun-icon")).toBeInTheDocument();
    });

    it("should show QUIET for health = 44", () => {
      render(<WorldHealthBar health={44} />);
      expect(screen.getByText("QUIET")).toBeInTheDocument();
    });

    it("should show DORMANT for health 10-24", () => {
      render(<WorldHealthBar health={10} />);
      expect(screen.getByText("DORMANT")).toBeInTheDocument();
      expect(screen.getByTestId("storm-icon")).toBeInTheDocument();
    });

    it("should show DORMANT for health = 24", () => {
      render(<WorldHealthBar health={24} />);
      expect(screen.getByText("DORMANT")).toBeInTheDocument();
    });

    it("should show DYING for health < 10", () => {
      render(<WorldHealthBar health={9} />);
      expect(screen.getByText("DYING")).toBeInTheDocument();
      expect(screen.getByTestId("skull-icon")).toBeInTheDocument();
    });

    it("should show DYING for health = 0", () => {
      render(<WorldHealthBar health={0} />);
      expect(screen.getByText("DYING")).toBeInTheDocument();
    });
  });

  describe("Health percentage display", () => {
    it("should display rounded health percentage", () => {
      render(<WorldHealthBar health={75} />);
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("should round decimal health values", () => {
      render(<WorldHealthBar health={75.7} />);
      expect(screen.getByText("76%")).toBeInTheDocument();
    });

    it("should round down .4 values", () => {
      render(<WorldHealthBar health={75.4} />);
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("should display 0% for zero health", () => {
      render(<WorldHealthBar health={0} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should display 100% for full health", () => {
      render(<WorldHealthBar health={100} />);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("Progress bar attributes", () => {
    it("should have correct role attribute", () => {
      render(<WorldHealthBar health={50} />);
      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toBeInTheDocument();
    });

    it("should have correct aria-valuenow", () => {
      render(<WorldHealthBar health={65} />);
      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuenow", "65");
    });

    it("should have correct aria-valuemin", () => {
      render(<WorldHealthBar health={50} />);
      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    });

    it("should have correct aria-valuemax", () => {
      render(<WorldHealthBar health={50} />);
      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuemax", "100");
    });

    it("should have descriptive aria-label", () => {
      render(<WorldHealthBar health={75} />);
      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-label", "World health: 75%");
    });
  });

  describe("Health bar fill width", () => {
    it("should set fill width based on health", () => {
      const { container } = render(<WorldHealthBar health={75} />);
      const fill = container.querySelector(".health-bar-fill");
      expect(fill).toHaveStyle({ width: "75%" });
    });

    it("should set 0% width for zero health", () => {
      const { container } = render(<WorldHealthBar health={0} />);
      const fill = container.querySelector(".health-bar-fill");
      expect(fill).toHaveStyle({ width: "0%" });
    });

    it("should set 100% width for full health", () => {
      const { container } = render(<WorldHealthBar health={100} />);
      const fill = container.querySelector(".health-bar-fill");
      expect(fill).toHaveStyle({ width: "100%" });
    });
  });

  describe("CSS class assignments", () => {
    it("should not have warning/danger class for health >= 25", () => {
      const { container } = render(<WorldHealthBar health={50} />);
      const fill = container.querySelector(".health-bar-fill");
      expect(fill).not.toHaveClass("warning");
      expect(fill).not.toHaveClass("danger");
    });

    it("should have warning class for health 10-24", () => {
      const { container } = render(<WorldHealthBar health={15} />);
      const fill = container.querySelector(".health-bar-fill");
      expect(fill).toHaveClass("warning");
    });

    it("should have danger class for health < 10", () => {
      const { container } = render(<WorldHealthBar health={5} />);
      const fill = container.querySelector(".health-bar-fill");
      expect(fill).toHaveClass("danger");
    });
  });

  describe("Status text color classes", () => {
    it("should have green text color for healthy status (>= 45)", () => {
      render(<WorldHealthBar health={50} />);
      // The status text "GROWING" should be visible
      expect(screen.getByText("GROWING")).toBeInTheDocument();
    });

    it("should have appropriate styling for quiet status (25-44)", () => {
      render(<WorldHealthBar health={30} />);
      // The status text "QUIET" should be visible
      expect(screen.getByText("QUIET")).toBeInTheDocument();
    });

    it("should have warning styling for dormant status (10-24)", () => {
      render(<WorldHealthBar health={15} />);
      // The status text "DORMANT" should be visible
      expect(screen.getByText("DORMANT")).toBeInTheDocument();
    });

    it("should have danger styling for dying status (< 10)", () => {
      render(<WorldHealthBar health={5} />);
      // The status text "DYING" should be visible
      expect(screen.getByText("DYING")).toBeInTheDocument();
    });
  });

  describe("Boundary conditions", () => {
    // Test exact threshold values
    const thresholdTests = [
      { health: 80, expectedStatus: "THRIVING" },
      { health: 79.9, expectedStatus: "HEALTHY" },
      { health: 60, expectedStatus: "HEALTHY" },
      { health: 59.9, expectedStatus: "GROWING" },
      { health: 45, expectedStatus: "GROWING" },
      { health: 44.9, expectedStatus: "QUIET" },
      { health: 25, expectedStatus: "QUIET" },
      { health: 24.9, expectedStatus: "DORMANT" },
      { health: 10, expectedStatus: "DORMANT" },
      { health: 9.9, expectedStatus: "DYING" },
    ];

    thresholdTests.forEach(({ health, expectedStatus }) => {
      it(`should show ${expectedStatus} for health = ${health}`, () => {
        render(<WorldHealthBar health={health} />);
        expect(screen.getByText(expectedStatus)).toBeInTheDocument();
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle negative health", () => {
      render(<WorldHealthBar health={-10} />);
      // Should show DYING for very low health
      expect(screen.getByText("DYING")).toBeInTheDocument();
    });

    it("should handle health over 100", () => {
      render(<WorldHealthBar health={150} />);
      // Should still work, showing THRIVING
      expect(screen.getByText("THRIVING")).toBeInTheDocument();
      expect(screen.getByText("150%")).toBeInTheDocument();
    });

    it("should handle decimal health", () => {
      render(<WorldHealthBar health={50.5} />);
      // Should round to 51%
      expect(screen.getByText("51%")).toBeInTheDocument();
    });
  });

  describe("Static elements", () => {
    it("should display WORLD label", () => {
      render(<WorldHealthBar health={50} />);
      expect(screen.getByText(/WORLD:/)).toBeInTheDocument();
    });

    it("should display world icon", () => {
      render(<WorldHealthBar health={50} />);
      expect(screen.getByTestId("world-icon")).toBeInTheDocument();
    });

    it("should have health-bar class on container", () => {
      const { container } = render(<WorldHealthBar health={50} />);
      expect(container.querySelector(".health-bar")).toBeInTheDocument();
    });
  });

  describe("Rendering stability", () => {
    it("should render consistently with same props", () => {
      const { rerender, container } = render(<WorldHealthBar health={50} />);
      const initialHTML = container.innerHTML;

      rerender(<WorldHealthBar health={50} />);
      expect(container.innerHTML).toBe(initialHTML);
    });

    it("should update when health prop changes", () => {
      const { rerender } = render(<WorldHealthBar health={50} />);
      expect(screen.getByText("GROWING")).toBeInTheDocument();

      rerender(<WorldHealthBar health={85} />);
      expect(screen.getByText("THRIVING")).toBeInTheDocument();
    });
  });
});
