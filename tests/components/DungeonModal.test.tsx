/**
 * DungeonModal Component Tests
 *
 * Tests the fullscreen dungeon iframe modal with:
 * - Rendering: iframe src, title, close button, header text
 * - Close behavior: ESC key, close button click, postMessage
 * - Event cleanup: listeners removed on unmount
 * - Edge cases: multiple ESC presses, non-matching postMessages, rapid open/close
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DungeonModal } from "@/components/DungeonModal";

describe("DungeonModal rendering", () => {
  it("renders the close button", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);
    const closeButton = screen.getByRole("button");
    expect(closeButton).toBeInTheDocument();
    expect(closeButton.textContent).toContain("CLOSE");
  });

  it("renders the header with BAGSDUNGEON text", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);
    expect(screen.getByText("BAGSDUNGEON")).toBeInTheDocument();
  });

  it("renders the dungeon icon [D]", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);
    expect(screen.getByText("[D]")).toBeInTheDocument();
  });

  it("renders an iframe with correct src", () => {
    const onClose = jest.fn();
    const { container } = render(<DungeonModal onClose={onClose} />);
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute("src")).toBe("/games/dungeon/?embed=true");
  });

  it("iframe has correct title for accessibility", () => {
    const onClose = jest.fn();
    const { container } = render(<DungeonModal onClose={onClose} />);
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("title")).toBe("BagsDungeon MMORPG");
  });

  it("iframe allows autoplay and fullscreen", () => {
    const onClose = jest.fn();
    const { container } = render(<DungeonModal onClose={onClose} />);
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("allow")).toContain("autoplay");
    expect(iframe?.getAttribute("allow")).toContain("fullscreen");
  });

  it("modal covers full screen (fixed inset-0)", () => {
    const onClose = jest.fn();
    const { container } = render(<DungeonModal onClose={onClose} />);
    const overlay = container.firstElementChild;
    expect(overlay?.className).toContain("fixed");
    expect(overlay?.className).toContain("inset-0");
  });

  it("modal has high z-index to sit above game", () => {
    const onClose = jest.fn();
    const { container } = render(<DungeonModal onClose={onClose} />);
    const overlay = container.firstElementChild;
    expect(overlay?.className).toContain("z-[100]");
  });

  it("close button has title mentioning ESC shortcut", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);
    const closeButton = screen.getByRole("button");
    expect(closeButton.getAttribute("title")).toContain("ESC");
  });
});

describe("DungeonModal close behavior", () => {
  it("calls onClose when ESC key is pressed", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);

    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when bagsdungeon-close postMessage is received", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "bagsdungeon-close" },
        })
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose for non-Escape keys", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: " " });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT call onClose for unrelated postMessages", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "some-other-event" },
        })
      );
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: "plain string message",
        })
      );
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: null,
        })
      );
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: undefined,
        })
      );
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "bagsdungeon-level-up" },
        })
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("handles multiple ESC presses (calls onClose each time)", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("DungeonModal event cleanup", () => {
  it("removes keydown listener on unmount", () => {
    const onClose = jest.fn();
    const { unmount } = render(<DungeonModal onClose={onClose} />);

    unmount();

    // After unmount, ESC should not trigger onClose
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes message listener on unmount", () => {
    const onClose = jest.fn();
    const { unmount } = render(<DungeonModal onClose={onClose} />);

    unmount();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "bagsdungeon-close" },
        })
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("cleans up and re-registers listeners on onClose prop change", () => {
    const onClose1 = jest.fn();
    const onClose2 = jest.fn();

    const { rerender } = render(<DungeonModal onClose={onClose1} />);
    rerender(<DungeonModal onClose={onClose2} />);

    fireEvent.keyDown(window, { key: "Escape" });

    // Old callback should not fire, new one should
    expect(onClose1).not.toHaveBeenCalled();
    expect(onClose2).toHaveBeenCalledTimes(1);
  });
});

describe("DungeonModal edge cases", () => {
  it("renders with empty postMessage data without crashing", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);

    // Should not throw
    expect(() => {
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { data: {} }));
      });
    }).not.toThrow();

    expect(onClose).not.toHaveBeenCalled();
  });

  it("handles postMessage with nested type property correctly", () => {
    const onClose = jest.fn();
    render(<DungeonModal onClose={onClose} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: { nested: "bagsdungeon-close" } },
        })
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
