/**
 * ErrorBoundary Component Tests
 *
 * Tests the error boundary wrapper for:
 * - Catching child component errors without crashing the page
 * - Displaying default fallback UI with error message
 * - Displaying custom fallback when provided
 * - Reset functionality (clearing error state)
 * - onError callback invocation
 * - Custom resetLabel text
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// A component that throws on render
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test component error");
  }
  return <div>Child rendered successfully</div>;
}

// A component that throws with a specific message
function ThrowingWithMessage({ message }: { message: string }) {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  // Suppress console.error for expected error boundary logs
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("when children render without errors", () => {
    it("renders children normally", () => {
      render(
        <ErrorBoundary>
          <div>Hello World</div>
        </ErrorBoundary>
      );

      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("does not show fallback UI", () => {
      render(
        <ErrorBoundary>
          <div>Content</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });
  });

  describe("when children throw an error", () => {
    it("catches the error and shows default fallback UI", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("displays the error message in the fallback", () => {
      render(
        <ErrorBoundary>
          <ThrowingWithMessage message="Specific failure reason" />
        </ErrorBoundary>
      );

      expect(screen.getByText("Specific failure reason")).toBeInTheDocument();
    });

    it("shows 'Try Again' button by default", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    it("shows custom resetLabel on the button", () => {
      render(
        <ErrorBoundary resetLabel="Close">
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Close")).toBeInTheDocument();
      expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
    });

    it("does not render the child that threw", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.queryByText("Child rendered successfully")).not.toBeInTheDocument();
    });
  });

  describe("custom fallback", () => {
    it("renders custom fallback instead of default UI", () => {
      render(
        <ErrorBoundary fallback={<div>Custom error view</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Custom error view")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });
  });

  describe("onError callback", () => {
    it("calls onError with the error and errorInfo", () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingWithMessage message="callback test" />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "callback test" }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it("does not call onError when children render successfully", () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <div>No error</div>
        </ErrorBoundary>
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("reset functionality", () => {
    it("clears error state when reset button is clicked", () => {
      function TestWrapper() {
        const [shouldThrow, setShouldThrow] = React.useState(true);

        return (
          <div>
            <button onClick={() => setShouldThrow(false)}>Fix error</button>
            <ErrorBoundary>
              <ThrowingComponent shouldThrow={shouldThrow} />
            </ErrorBoundary>
          </div>
        );
      }

      render(<TestWrapper />);

      // Error boundary should catch the error
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Fix the error source — but boundary still shows fallback
      fireEvent.click(screen.getByText("Fix error"));
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.queryByText("Child rendered successfully")).not.toBeInTheDocument();

      // Only clicking "Try Again" resets the boundary and re-renders children
      fireEvent.click(screen.getByText("Try Again"));

      expect(screen.getByText("Child rendered successfully")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("re-catches if child still throws after reset", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Reset without fixing the error — boundary should catch again
      fireEvent.click(screen.getByText("Try Again"));

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("error message display", () => {
    it("shows generic message when error has no message", () => {
      function ThrowNull() {
        throw new Error("");
      }

      render(
        <ErrorBoundary>
          <ThrowNull />
        </ErrorBoundary>
      );

      // Empty error message falls through to the || fallback
      expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
    });
  });
});
