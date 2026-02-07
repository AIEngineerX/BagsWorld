import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DungeonModal } from "@/components/DungeonModal";

let onClose: jest.Mock;

beforeEach(() => {
  onClose = jest.fn();
});

describe("DungeonModal rendering", () => {
  it("renders coming soon teaser with title and description", () => {
    render(<DungeonModal onClose={onClose} />);

    expect(screen.getByText("BAGSDUNGEON")).toBeInTheDocument();
    expect(screen.getByText("COMING SOON")).toBeInTheDocument();
    expect(screen.getByText(/MMORPG adventure/)).toBeInTheDocument();
    expect(screen.getByText("RETURN TO BAGSWORLD")).toBeInTheDocument();
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
    fireEvent.click(screen.getByTitle("Close (ESC)"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when return button is clicked", () => {
    render(<DungeonModal onClose={onClose} />);
    fireEvent.click(screen.getByText("RETURN TO BAGSWORLD"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores non-Escape keys", () => {
    render(<DungeonModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("DungeonModal cleanup", () => {
  it("removes listeners on unmount", () => {
    const { unmount } = render(<DungeonModal onClose={onClose} />);
    unmount();

    fireEvent.keyDown(window, { key: "Escape" });
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
