/**
 * useAgentEvents Hook Comprehensive Tests
 *
 * Tests agent event handling with:
 * - Polling behavior
 * - Announcement management
 * - Mark as read functionality
 * - Event filtering and deduplication
 * - Custom event handling
 * - Error handling
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useAgentEvents, Announcement } from "@/hooks/useAgentEvents";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock timers
jest.useFakeTimers();

describe("useAgentEvents", () => {
  const mockAnnouncements: Announcement[] = [
    {
      id: "ann-1",
      message: "Token launched!",
      priority: "high",
      timestamp: Date.now(),
      eventType: "token_launch",
      read: false,
    },
    {
      id: "ann-2",
      message: "Fee claimed!",
      priority: "medium",
      timestamp: Date.now() - 1000,
      eventType: "fee_claim",
      read: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          announcements: [],
          lastTimestamp: Date.now(),
        }),
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe("Initialization", () => {
    it("should initialize with empty state", async () => {
      const { result } = renderHook(() => useAgentEvents());

      expect(result.current.announcements).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.lastUpdate).toBe(0);
    });

    it("should start coordinator on mount", async () => {
      renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/agent-coordinator",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ action: "start" }),
          })
        );
      });
    });

    it("should fetch announcements immediately on mount", async () => {
      renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/agent-coordinator?action=poll")
        );
      });
    });
  });

  describe("Polling Behavior", () => {
    it("should use default poll interval of 5000ms", async () => {
      renderHook(() => useAgentEvents());

      // Clear initial calls
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      mockFetch.mockClear();

      // Advance time by default interval
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/agent-coordinator?action=poll")
        );
      });
    });

    it("should respect custom poll interval", async () => {
      const { result } = renderHook(() => useAgentEvents({ pollInterval: 10000 }));

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      mockFetch.mockClear();

      // Advance by default interval - should not poll
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/agent-coordinator?action=poll")
      );

      // Advance to custom interval - should poll
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("should include last timestamp in poll request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            announcements: mockAnnouncements,
            lastTimestamp: 123456789,
          }),
      });

      renderHook(() => useAgentEvents());

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      // Clear and wait for next poll
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ announcements: [], lastTimestamp: 999999999 }),
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("since=")
        );
      });
    });

    it("should stop polling on unmount", async () => {
      const { unmount } = renderHook(() => useAgentEvents());

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      mockFetch.mockClear();

      unmount();

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/agent-coordinator?action=poll")
      );
    });
  });

  describe("Announcement Management", () => {
    it("should merge new announcements with existing ones", async () => {
      const initialAnnouncements = [mockAnnouncements[0]];
      const newAnnouncements = [mockAnnouncements[1]];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // start
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ announcements: initialAnnouncements, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(1);
      });

      // Simulate new announcements coming in
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: newAnnouncements, lastTimestamp: 2 }),
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });
    });

    it("should avoid duplicate announcements", async () => {
      const sameAnnouncement = [mockAnnouncements[0]];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: sameAnnouncement, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(1);
      });

      // Try to add the same announcement again
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: sameAnnouncement, lastTimestamp: 2 }),
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(1); // Still 1
      });
    });

    it("should respect maxAnnouncements limit", async () => {
      const manyAnnouncements = Array.from({ length: 30 }, (_, i) => ({
        id: `ann-${i}`,
        message: `Announcement ${i}`,
        priority: "low" as const,
        timestamp: Date.now() - i * 1000,
        eventType: "token_launch" as const,
        read: false,
      }));

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: manyAnnouncements, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents({ maxAnnouncements: 10 }));

      await waitFor(() => {
        expect(result.current.announcements.length).toBeLessThanOrEqual(10);
      });
    });

    it("should filter out old announcements (> 24 hours)", async () => {
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const oldAnnouncement = {
        ...mockAnnouncements[0],
        id: "old-ann",
        timestamp: oldTimestamp,
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              announcements: [oldAnnouncement, mockAnnouncements[1]],
              lastTimestamp: 1,
            }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(1);
        expect(result.current.announcements[0].id).toBe("ann-2");
      });
    });
  });

  describe("Unread Count", () => {
    it("should calculate unread count correctly", async () => {
      const mixedAnnouncements = [
        { ...mockAnnouncements[0], read: false },
        { ...mockAnnouncements[1], read: true },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mixedAnnouncements, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(1);
      });
    });

    it("should update unread count when marking as read", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(2);
      });

      // Mock mark read API
      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.markAsRead(["ann-1"]);
      });

      expect(result.current.unreadCount).toBe(1);
    });
  });

  describe("Mark As Read", () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        });
    });

    it("should mark single announcement as read", async () => {
      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.markAsRead(["ann-1"]);
      });

      const ann1 = result.current.announcements.find((a) => a.id === "ann-1");
      expect(ann1?.read).toBe(true);
    });

    it("should mark multiple announcements as read", async () => {
      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.markAsRead(["ann-1", "ann-2"]);
      });

      expect(result.current.announcements.every((a) => a.read)).toBe(true);
    });

    it("should send mark_read request to API", async () => {
      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.markAsRead(["ann-1"]);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/agent-coordinator",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "mark_read", ids: ["ann-1"] }),
        })
      );
    });

    it("should handle mark read API error gracefully", async () => {
      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await act(async () => {
        await result.current.markAsRead(["ann-1"]);
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Mark All As Read", () => {
    it("should mark all unread announcements as read", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(2);
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
      expect(result.current.announcements.every((a) => a.read)).toBe(true);
    });

    it("should not call API if no unread announcements", async () => {
      const allRead = mockAnnouncements.map((a) => ({ ...a, read: true }));

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: allRead, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(0);
      });

      mockFetch.mockClear();

      await act(async () => {
        await result.current.markAllAsRead();
      });

      // Should not have made any API calls
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Clear Announcements", () => {
    it("should clear all announcements", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.clearAnnouncements();
      });

      expect(result.current.announcements).toHaveLength(0);
      expect(result.current.unreadCount).toBe(0);
    });

    it("should send clear_announcements request to API", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.clearAnnouncements();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/agent-coordinator",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "clear_announcements" }),
        })
      );
    });
  });

  describe("Helper Functions", () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        });
    });

    it("should get latest unread announcement", async () => {
      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      const latest = result.current.getLatestAnnouncement();
      expect(latest).not.toBeNull();
      expect(latest?.read).toBe(false);
    });

    it("should return null when no unread announcements", async () => {
      const allRead = mockAnnouncements.map((a) => ({ ...a, read: true }));

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: allRead, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      const latest = result.current.getLatestAnnouncement();
      expect(latest).toBeNull();
    });

    it("should get announcements by type", async () => {
      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      const launchEvents = result.current.getAnnouncementsByType("token_launch");
      expect(launchEvents).toHaveLength(1);
      expect(launchEvents[0].eventType).toBe("token_launch");

      const claimEvents = result.current.getAnnouncementsByType("fee_claim");
      expect(claimEvents).toHaveLength(1);
    });

    it("should return empty array for non-existent event type", async () => {
      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      const unknownEvents = result.current.getAnnouncementsByType("unknown_type" as any);
      expect(unknownEvents).toHaveLength(0);
    });
  });

  describe("Manual Refetch", () => {
    it("should refetch announcements when refetch is called", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: [], lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 2 }),
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.current.announcements).toHaveLength(2);
    });
  });

  describe("Auto Mark Read", () => {
    it("should auto-mark new announcements as read when enabled", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        })
        .mockResolvedValueOnce({ ok: true }); // mark_read call

      const { result } = renderHook(() => useAgentEvents({ autoMarkRead: true }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/agent-coordinator",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("mark_read"),
          })
        );
      });
    });

    it("should not auto-mark when disabled (default)", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(2);
      });

      // Should not have called mark_read
      expect(mockFetch).not.toHaveBeenCalledWith(
        "/api/agent-coordinator",
        expect.objectContaining({
          body: expect.stringContaining("mark_read"),
        })
      );
    });
  });

  describe("Connection State", () => {
    it("should set isConnected to true on successful fetch", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: [], lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    it("should set isConnected to false on fetch error", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      consoleSpy.mockRestore();
    });

    it("should set isConnected to false on non-ok response", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Custom Event Handling", () => {
    it("should handle browser custom events", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: [], lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Dispatch custom event
      const customEvent = new CustomEvent("bagsworld-agent-event", {
        detail: {
          id: "custom-1",
          announcement: "Custom announcement!",
          priority: "high",
          timestamp: Date.now(),
          type: "custom_event",
        },
      });

      act(() => {
        window.dispatchEvent(customEvent);
      });

      expect(result.current.announcements).toHaveLength(1);
      expect(result.current.announcements[0].message).toBe("Custom announcement!");
    });

    it("should ignore duplicate custom events", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              announcements: [{ ...mockAnnouncements[0], id: "existing-1" }],
              lastTimestamp: 1,
            }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.announcements).toHaveLength(1);
      });

      // Dispatch event with same ID
      const duplicateEvent = new CustomEvent("bagsworld-agent-event", {
        detail: {
          id: "existing-1", // Same ID
          announcement: "Duplicate!",
          priority: "high",
          timestamp: Date.now(),
          type: "token_launch",
        },
      });

      act(() => {
        window.dispatchEvent(duplicateEvent);
      });

      expect(result.current.announcements).toHaveLength(1);
    });

    it("should ignore old custom events (> 24 hours)", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: [], lastTimestamp: 1 }),
        });

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      const oldEvent = new CustomEvent("bagsworld-agent-event", {
        detail: {
          id: "old-1",
          announcement: "Old announcement",
          priority: "low",
          timestamp: oldTimestamp,
          type: "fee_claim",
        },
      });

      act(() => {
        window.dispatchEvent(oldEvent);
      });

      expect(result.current.announcements).toHaveLength(0);
    });

    it("should remove custom event listener on unmount", async () => {
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: [], lastTimestamp: 1 }),
        });

      const { unmount } = renderHook(() => useAgentEvents());

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "bagsworld-agent-event",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    it("should handle fetch throwing errors", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockRejectedValueOnce(new Error("Fetch failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "[useAgentEvents] Fetch error:",
          expect.any(Error)
        );
      });

      expect(result.current.isConnected).toBe(false);
      consoleSpy.mockRestore();
    });

    it("should handle JSON parse errors", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.reject(new Error("Invalid JSON")),
        });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      consoleSpy.mockRestore();
    });

    it("should continue polling after error", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ announcements: mockAnnouncements, lastTimestamp: 1 }),
        });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAgentEvents());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      // Advance to next poll
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.announcements).toHaveLength(2);
      });

      consoleSpy.mockRestore();
    });
  });
});
