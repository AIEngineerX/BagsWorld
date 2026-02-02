/**
 * useScoutAlerts Hook Comprehensive Tests
 *
 * Tests the scout alerts hook with:
 * - Fetching scout data and state
 * - Starting/stopping scout agent
 * - Alert management (dismiss, clear)
 * - Polling behavior
 * - New launch notifications
 * - Error handling
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useScoutAlerts, TokenLaunch } from "@/hooks/useScoutAlerts";

// Helper to set up mock fetch responses
function setupMockFetch(
  responses: Record<string, { status?: number; data: unknown }[]>
) {
  const callCounts: Record<string, number> = {};

  (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
    const urlPath = url.replace(/^http:\/\/localhost(:\d+)?/, "");

    // Parse body to determine the action
    let action = "";
    if (options?.body) {
      try {
        const body = JSON.parse(options.body as string);
        action = body.action || "";
      } catch {
        // Ignore parse errors
      }
    }

    const key = action ? `${urlPath}:${action}` : urlPath;

    // Check for specific action responses first
    for (const [path, responseQueue] of Object.entries(responses)) {
      if (key.includes(path) || urlPath.includes(path)) {
        if (!callCounts[path]) callCounts[path] = 0;
        const responseIndex = Math.min(callCounts[path], responseQueue.length - 1);
        const response = responseQueue[responseIndex];
        callCounts[path]++;

        return Promise.resolve({
          ok: response.status ? response.status >= 200 && response.status < 400 : true,
          status: response.status || 200,
          json: () => Promise.resolve(response.data),
        });
      }
    }

    // Default response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ launches: [], scout: null }),
    });
  });
}

describe("useScoutAlerts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Initial Loading", () => {
    it("should start with loading state", async () => {
      setupMockFetch({
        "/api/agent": [{ data: { launches: [] } }],
      });

      const { result } = renderHook(() => useScoutAlerts());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should fetch scout data and state on mount", async () => {
      const mockLaunches = [
        { mint: "Token1", name: "Token One", symbol: "T1", timestamp: Date.now() },
        { mint: "Token2", name: "Token Two", symbol: "T2", timestamp: Date.now() - 1000 },
      ];

      setupMockFetch({
        "/api/agent": [
          { data: { launches: mockLaunches } },
          { data: { scout: { isRunning: true, launchesScanned: 100 } } },
        ],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.alerts).toHaveLength(2);
      });
    });
  });

  describe("Alert Management", () => {
    it("should dismiss a specific alert", async () => {
      const mockLaunches = [
        { mint: "Token1", name: "Token One", symbol: "T1" },
        { mint: "Token2", name: "Token Two", symbol: "T2" },
      ];

      setupMockFetch({
        "/api/agent": [{ data: { launches: mockLaunches } }],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.alerts).toHaveLength(2);
      });

      act(() => {
        result.current.dismissAlert("Token1");
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].mint).toBe("Token2");
    });

    it("should clear all alerts", async () => {
      const mockLaunches = [
        { mint: "Token1" },
        { mint: "Token2" },
        { mint: "Token3" },
      ];

      setupMockFetch({
        "/api/agent": [{ data: { launches: mockLaunches } }],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.alerts).toHaveLength(3);
      });

      act(() => {
        result.current.clearAlerts();
      });

      expect(result.current.alerts).toHaveLength(0);
    });
  });

  describe("Scout Control", () => {
    it("should start scout agent", async () => {
      setupMockFetch({
        "/api/agent": [
          { data: { launches: [] } },
          { data: { scout: null } },
          { data: { success: true } }, // start response
          { data: { scout: { isRunning: true } } }, // updated state
        ],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;
      await act(async () => {
        success = await result.current.startScout();
      });

      expect(success).toBe(true);
    });

    it("should stop scout agent", async () => {
      setupMockFetch({
        "/api/agent": [
          { data: { launches: [] } },
          { data: { scout: { isRunning: true } } },
          { data: { success: true } }, // stop response
          { data: { scout: { isRunning: false } } }, // updated state
        ],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;
      await act(async () => {
        success = await result.current.stopScout();
      });

      expect(success).toBe(true);
    });

    it("should handle start error", async () => {
      setupMockFetch({
        "/api/agent": [
          { data: { launches: [] } },
          { data: { scout: null } },
          { status: 500, data: { error: "Failed to start scout" } },
        ],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;
      await act(async () => {
        success = await result.current.startScout();
      });

      expect(success).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it("should handle stop error", async () => {
      setupMockFetch({
        "/api/agent": [
          { data: { launches: [] } },
          { data: { scout: { isRunning: true } } },
          { status: 500, data: { error: "Failed to stop scout" } },
        ],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;
      await act(async () => {
        success = await result.current.stopScout();
      });

      expect(success).toBe(false);
    });
  });

  describe("Polling", () => {
    it("should poll for data at specified interval", async () => {
      setupMockFetch({
        "/api/agent": [{ data: { launches: [] } }],
      });

      renderHook(() => useScoutAlerts({ pollIntervalMs: 5000 }));

      await waitFor(() => {
        // Initial calls: fetchScoutData + fetchScoutState
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Advance timers by poll interval
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        // Should have made 2 more calls
        expect(global.fetch).toHaveBeenCalledTimes(4);
      });
    });

    it("should stop polling on unmount", async () => {
      setupMockFetch({
        "/api/agent": [{ data: { launches: [] } }],
      });

      const { unmount } = renderHook(() =>
        useScoutAlerts({ pollIntervalMs: 1000 })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const callCountBeforeUnmount = (global.fetch as jest.Mock).mock.calls.length;

      unmount();

      // Advance timers
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should not have made more calls
      expect(global.fetch).toHaveBeenCalledTimes(callCountBeforeUnmount);
    });
  });

  describe("New Launch Notifications", () => {
    it("should call onNewLaunch for new launches", async () => {
      const onNewLaunch = jest.fn();

      // First fetch returns one launch
      const launch1 = { mint: "Token1", name: "First", symbol: "T1" };
      // Second fetch returns a new launch
      const launch2 = { mint: "Token2", name: "Second", symbol: "T2" };

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // Initial calls
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                launches: [launch1],
                scout: null,
              }),
          });
        } else {
          // Subsequent calls with new launch
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                launches: [launch2, launch1],
                scout: null,
              }),
          });
        }
      });

      const { result } = renderHook(() =>
        useScoutAlerts({ pollIntervalMs: 1000, onNewLaunch })
      );

      await waitFor(() => {
        expect(result.current.alerts).toHaveLength(1);
      });

      // Advance to trigger poll
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.alerts).toHaveLength(2);
      });

      // onNewLaunch should have been called for the new launch
      expect(onNewLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ mint: "Token2" })
      );
    });
  });

  describe("Manual Refresh", () => {
    it("should refresh data when refresh is called", async () => {
      setupMockFetch({
        "/api/agent": [
          { data: { launches: [{ mint: "Token1" }] } },
          { data: { scout: null } },
          { data: { launches: [{ mint: "Token2" }] } },
        ],
      });

      const { result } = renderHook(() =>
        useScoutAlerts({ pollIntervalMs: 60000 })
      );

      await waitFor(() => {
        expect(result.current.alerts[0]?.mint).toBe("Token1");
      });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.alerts[0]?.mint).toBe("Token2");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle fetch errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should handle non-ok responses", async () => {
      setupMockFetch({
        "/api/agent": [
          { status: 500, data: { error: "Server error" } },
        ],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });

    it("should clear error on successful fetch", async () => {
      let shouldFail = true;

      (global.fetch as jest.Mock).mockImplementation(() => {
        if (shouldFail) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ launches: [] }),
        });
      });

      const { result } = renderHook(() =>
        useScoutAlerts({ pollIntervalMs: 1000 })
      );

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      // Fix the network
      shouldFail = false;

      // Trigger refresh
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe("Scout State", () => {
    it("should track scout state", async () => {
      setupMockFetch({
        "/api/agent": [
          { data: { launches: [] } },
          {
            data: {
              scout: {
                isRunning: true,
                isConnected: true,
                launchesScanned: 150,
                alertsSent: 5,
              },
            },
          },
        ],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.scoutState).toBeDefined();
        expect(result.current.scoutState?.isRunning).toBe(true);
        expect(result.current.scoutState?.launchesScanned).toBe(150);
      });
    });

    it("should handle missing scout state gracefully", async () => {
      setupMockFetch({
        "/api/agent": [
          { data: { launches: [] } },
          { data: {} }, // No scout field
        ],
      });

      const { result } = renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not throw, scoutState should be null/undefined
      expect(result.current.scoutState).toBeFalsy();
    });
  });

  describe("Max Alerts", () => {
    it("should respect maxAlerts option", async () => {
      setupMockFetch({
        "/api/agent": [{ data: { launches: [] } }],
      });

      renderHook(() => useScoutAlerts({ maxAlerts: 10 }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/agent",
          expect.objectContaining({
            body: expect.stringContaining('"count":10'),
          })
        );
      });
    });

    it("should use default maxAlerts of 20", async () => {
      setupMockFetch({
        "/api/agent": [{ data: { launches: [] } }],
      });

      renderHook(() => useScoutAlerts());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/agent",
          expect.objectContaining({
            body: expect.stringContaining('"count":20'),
          })
        );
      });
    });
  });
});
