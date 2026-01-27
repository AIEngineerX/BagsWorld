import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { AgentEventType, EventPriority } from "@/lib/agent-coordinator";

// Event TTL - filter out events older than this (24 hours)
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface Announcement {
  id: string;
  message: string;
  priority: EventPriority;
  timestamp: number;
  eventType: AgentEventType;
  read: boolean;
}

export interface AgentEventsState {
  announcements: Announcement[];
  unreadCount: number;
  isConnected: boolean;
  lastUpdate: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAgentEvents(options?: {
  pollInterval?: number;
  maxAnnouncements?: number;
  autoMarkRead?: boolean;
}) {
  const {
    pollInterval = 5000, // Poll every 5 seconds
    maxAnnouncements = 20,
    autoMarkRead = false,
  } = options || {};

  const [state, setState] = useState<AgentEventsState>({
    announcements: [],
    unreadCount: 0,
    isConnected: false,
    lastUpdate: 0,
  });

  const lastTimestampRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter out old announcements (older than 24 hours)
  const filterOldAnnouncements = useCallback((announcements: Announcement[]): Announcement[] => {
    const cutoff = Date.now() - EVENT_TTL_MS;
    return announcements.filter((a) => a.timestamp > cutoff);
  }, []);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/agent-coordinator?action=poll&since=${lastTimestampRef.current}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch announcements");
      }

      const data = await response.json();
      const newAnnouncements: Announcement[] = data.announcements || [];

      setState((prev) => {
        // Merge new announcements, avoiding duplicates
        const existingIds = new Set(prev.announcements.map((a) => a.id));
        const uniqueNew = newAnnouncements.filter((a) => !existingIds.has(a.id));

        // Combine and filter out old events
        const merged = filterOldAnnouncements([...uniqueNew, ...prev.announcements]).slice(
          0,
          maxAnnouncements
        );

        const unreadCount = merged.filter((a) => !a.read).length;

        if (newAnnouncements.length > 0) {
          lastTimestampRef.current = data.lastTimestamp;
        }

        return {
          ...prev,
          announcements: merged,
          unreadCount,
          isConnected: true,
          lastUpdate: Date.now(),
        };
      });

      // Auto-mark as read if enabled
      if (autoMarkRead && newAnnouncements.length > 0) {
        // Mark as read inline to avoid dependency on markAsRead
        try {
          await fetch("/api/agent-coordinator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "mark_read", ids: newAnnouncements.map((a) => a.id) }),
          });
        } catch {
          // Ignore errors for auto-mark
        }
      }
    } catch (error) {
      console.error("[useAgentEvents] Fetch error:", error);
      setState((prev) => ({
        ...prev,
        isConnected: false,
      }));
    }
  }, [maxAnnouncements, autoMarkRead, filterOldAnnouncements]);

  // Mark announcements as read
  const markAsRead = useCallback(async (ids: string[]) => {
    try {
      await fetch("/api/agent-coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", ids }),
      });

      setState((prev) => ({
        ...prev,
        announcements: prev.announcements.map((a) =>
          ids.includes(a.id) ? { ...a, read: true } : a
        ),
        unreadCount: prev.announcements.filter((a) => !a.read && !ids.includes(a.id)).length,
      }));
    } catch (error) {
      console.error("[useAgentEvents] Mark read error:", error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const unreadIds = state.announcements.filter((a) => !a.read).map((a) => a.id);
    if (unreadIds.length > 0) {
      try {
        await fetch("/api/agent-coordinator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read", ids: unreadIds }),
        });

        setState((prev) => ({
          ...prev,
          announcements: prev.announcements.map((a) =>
            unreadIds.includes(a.id) ? { ...a, read: true } : a
          ),
          unreadCount: 0,
        }));
      } catch (error) {
        console.error("[useAgentEvents] Mark all read error:", error);
      }
    }
  }, [state.announcements]);

  // Clear all announcements
  const clearAnnouncements = useCallback(async () => {
    try {
      await fetch("/api/agent-coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_announcements" }),
      });

      setState((prev) => ({
        ...prev,
        announcements: [],
        unreadCount: 0,
      }));
    } catch (error) {
      console.error("[useAgentEvents] Clear error:", error);
    }
  }, []);

  // Start coordinator
  const startCoordinator = useCallback(async () => {
    try {
      await fetch("/api/agent-coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
    } catch (error) {
      console.error("[useAgentEvents] Start error:", error);
    }
  }, []);

  // Get latest announcement (for display)
  const getLatestAnnouncement = useCallback((): Announcement | null => {
    const unread = state.announcements.filter((a) => !a.read);
    return unread[0] || null;
  }, [state.announcements]);

  // Get announcements by type
  const getAnnouncementsByType = useCallback(
    (type: AgentEventType): Announcement[] => {
      return state.announcements.filter((a) => a.eventType === type);
    },
    [state.announcements]
  );

  // Start polling on mount
  useEffect(() => {
    // Start coordinator on first mount
    startCoordinator();

    // Initial fetch
    fetchAnnouncements();

    // Set up polling
    pollIntervalRef.current = setInterval(fetchAnnouncements, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchAnnouncements, pollInterval, startCoordinator]);

  // Also listen for browser events from the coordinator
  useEffect(() => {
    const handleAgentEvent = (event: CustomEvent) => {
      const agentEvent = event.detail;
      if (agentEvent?.announcement) {
        setState((prev) => {
          // Check for duplicate by ID
          const exists = prev.announcements.some((a) => a.id === agentEvent.id);
          if (exists) return prev;

          // Skip if event is too old
          const cutoff = Date.now() - EVENT_TTL_MS;
          if (agentEvent.timestamp < cutoff) return prev;

          const newAnnouncement: Announcement = {
            id: agentEvent.id,
            message: agentEvent.announcement,
            priority: agentEvent.priority,
            timestamp: agentEvent.timestamp,
            eventType: agentEvent.type,
            read: false,
          };

          // Filter out old events when merging
          const filtered = prev.announcements.filter((a) => a.timestamp > cutoff);
          const merged = [newAnnouncement, ...filtered].slice(0, maxAnnouncements);

          return {
            ...prev,
            announcements: merged,
            unreadCount: merged.filter((a) => !a.read).length,
          };
        });
      }
    };

    window.addEventListener("bagsworld-agent-event", handleAgentEvent as EventListener);

    return () => {
      window.removeEventListener("bagsworld-agent-event", handleAgentEvent as EventListener);
    };
  }, [maxAnnouncements]);

  return {
    ...state,
    markAsRead,
    markAllAsRead,
    clearAnnouncements,
    getLatestAnnouncement,
    getAnnouncementsByType,
    refetch: fetchAnnouncements,
  };
}

export default useAgentEvents;
