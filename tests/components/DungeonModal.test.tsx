import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DungeonModal } from "@/components/DungeonModal";

let onClose: jest.Mock;

beforeEach(() => {
  onClose = jest.fn();
});

describe("DungeonModal rendering", () => {
  it("renders header, close button, and iframe", () => {
    const { container } = render(<DungeonModal onClose={onClose} />);

    expect(screen.getByText("[D]")).toBeInTheDocument();
    expect(screen.getByText("BAGSDUNGEON")).toBeInTheDocument();

    const closeButton = screen.getByRole("button");
    expect(closeButton.textContent).toContain("CLOSE");

    const iframe = container.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute("src")).toBe("/games/dungeon/?embed=true");
    expect(iframe?.getAttribute("title")).toBe("BagsDungeon MMORPG");
    expect(iframe?.getAttribute("allow")).toContain("autoplay");
    expect(iframe?.getAttribute("allow")).toContain("fullscreen");
  });
});

describe("DungeonModal close behavior", () => {
  it("calls onClose when ESC key is pressed", () => {
    render(<DungeonModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    render(<DungeonModal onClose={onClose} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on bagsdungeon-close postMessage", () => {
    render(<DungeonModal onClose={onClose} />);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { type: "bagsdungeon-close" } }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores non-Escape keys", () => {
    render(<DungeonModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores unrelated postMessages", () => {
    render(<DungeonModal onClose={onClose} />);
    act(() => {
      for (const data of [{ type: "other" }, "string", null, undefined]) {
        window.dispatchEvent(new MessageEvent("message", { data }));
      }
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("DungeonModal cleanup", () => {
  it("removes listeners on unmount", () => {
    const { unmount } = render(<DungeonModal onClose={onClose} />);
    unmount();

    fireEvent.keyDown(window, { key: "Escape" });
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { type: "bagsdungeon-close" } }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("re-registers listeners on onClose prop change", () => {
    const onClose1 = jest.fn();
    const onClose2 = jest.fn();

    const { rerender } = render(<DungeonModal onClose={onClose1} />);
    rerender(<DungeonModal onClose={onClose2} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose1).not.toHaveBeenCalled();
    expect(onClose2).toHaveBeenCalledTimes(1);
  });
});
