/**
 * Agent Coordinator API Route Tests
 *
 * Tests GET/POST handlers, announcement queue, filtering, TTL,
 * deduplication, rate limits, and error handling.
 *
 * Note: jsdom environment means the module-level `typeof window === "undefined"`
 * check is false, so auto-init does NOT run. We initialize via POST start.
 */

// Capture the subscribe callback injected during initAnnouncementHandler()
let capturedSubscribeCallback: ((event: Record<string, unknown>) => void) | null = null;

// Mock next/server (NextResponse.json uses Response.json which isn't in jsdom)
jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    }),
  },
}));

jest.mock("@/lib/agent-coordinator", () => ({
  startCoordinator: jest.fn(),
  stopCoordinator: jest.fn(),
  getCoordinatorState: jest.fn(() => ({
    isRunning: true,
    stats: {
      totalEvents: 0,
      eventsByType: {},
      eventsBySource: {},
      lastEventTime: 0,
    },
    subscriptions: [{ id: "sub_1" }],
    eventQueue: [],
  })),
  getRecentEvents: jest.fn(() => []),
  getEventStats: jest.fn(() => ({
    totalEvents: 5,
    eventsByType: { token_launch: 3, system: 2 },
    eventsBySource: { scout: 3, manual: 2 },
    lastEventTime: 1000,
  })),
  emitEvent: jest.fn(async (type: string, source: string, data: unknown, priority: string) => ({
    id: `evt_${Date.now()}_test`,
    type,
    source,
    data,
    timestamp: Date.now(),
    priority: priority || "medium",
    processed: false,
    announcement: `Test: ${type} from ${source}`,
  })),
  subscribe: jest.fn(
    (_types: unknown, handler: (event: Record<string, unknown>) => void, _priorities: unknown) => {
      capturedSubscribeCallback = handler;
      return jest.fn(); // unsubscribe
    }
  ),
}));

jest.mock("@/lib/ai-agent", () => ({
  connectToCoordinator: jest.fn(),
}));

jest.mock("@/lib/neon", () => ({
  isNeonConfigured: jest.fn(() => false),
  getRecentEmittedEvents: jest.fn(async () => []),
  initializeAgentFeedTables: jest.fn(async () => {}),
}));

import { GET, POST } from "@/app/api/agent-coordinator/route";
import {
  startCoordinator,
  stopCoordinator,
  getRecentEvents,
  getEventStats,
  emitEvent,
  subscribe,
} from "@/lib/agent-coordinator";
import { connectToCoordinator as connectAIAgent } from "@/lib/ai-agent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(action: string, params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/agent-coordinator");
  url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/agent-coordinator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Inject an announcement via the captured subscribe callback */
function injectAnnouncement(
  overrides: Partial<{
    id: string;
    type: string;
    source: string;
    announcement: string;
    priority: string;
    timestamp: number;
    data: Record<string, unknown>;
    processed: boolean;
  }> = {}
) {
  if (!capturedSubscribeCallback) {
    throw new Error("Subscribe callback not captured — call POST start first");
  }
  capturedSubscribeCallback({
    id: overrides.id || `evt_${Math.random().toString(36).substr(2)}`,
    type: overrides.type || "system",
    source: overrides.source || "manual",
    data: overrides.data || {},
    timestamp: overrides.timestamp ?? Date.now(),
    priority: overrides.priority || "medium",
    processed: overrides.processed ?? false,
    announcement: overrides.announcement ?? "Test announcement",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent Coordinator API Route", () => {
  // Initialize the announcement handler once (captures subscribe callback)
  beforeAll(async () => {
    await POST(makePostRequest({ action: "start" }));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear announcement queue between tests
    await POST(makePostRequest({ action: "clear_announcements" }));
  });

  // =========================================================================
  // POST action=start (initialization)
  // =========================================================================

  describe("POST action=start", () => {
    it("should start coordinator and connect AI agent", async () => {
      jest.clearAllMocks();

      const res = await POST(makePostRequest({ action: "start" }));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.message).toBe("Coordinator started");
      expect(startCoordinator).toHaveBeenCalled();
      expect(connectAIAgent).toHaveBeenCalled();
    });

    it("should have captured the subscribe callback (announcement handler)", () => {
      // subscribe was called during beforeAll POST start, then clearAllMocks ran
      // We verify the callback was captured instead of checking mock call history
      expect(capturedSubscribeCallback).toBeInstanceOf(Function);
    });

    it("should not re-subscribe on second start call", async () => {
      jest.clearAllMocks();

      // Second start call — initAnnouncementHandler guards against re-subscribe
      await POST(makePostRequest({ action: "start" }));

      // subscribe should NOT be called again (guard: if announcementSubscription return)
      expect(subscribe).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET ?action=status
  // =========================================================================

  describe("GET ?action=status", () => {
    it("should return coordinator state", async () => {
      const res = await GET(makeGetRequest("status"));
      const json = await res.json();

      expect(json.isRunning).toBe(true);
      expect(json.stats).toBeDefined();
      expect(json.subscriptionCount).toBe(1);
      expect(json.queueSize).toBe(0);
    });

    it("should default to status when no action provided", async () => {
      const req = new Request("http://localhost:3000/api/agent-coordinator");
      const res = await GET(req);
      const json = await res.json();

      expect(json.isRunning).toBeDefined();
      expect(json.stats).toBeDefined();
    });
  });

  // =========================================================================
  // GET ?action=events
  // =========================================================================

  describe("GET ?action=events", () => {
    it("should return events with default count of 20", async () => {
      await GET(makeGetRequest("events"));
      // searchParams.get("type") returns null when absent
      expect(getRecentEvents).toHaveBeenCalledWith(20, null);
    });

    it("should pass custom count", async () => {
      await GET(makeGetRequest("events", { count: "5" }));
      expect(getRecentEvents).toHaveBeenCalledWith(5, null);
    });

    it("should pass type filter", async () => {
      await GET(makeGetRequest("events", { type: "token_launch" }));
      expect(getRecentEvents).toHaveBeenCalledWith(20, "token_launch");
    });

    it("should pass count and type together", async () => {
      await GET(makeGetRequest("events", { count: "3", type: "system" }));
      expect(getRecentEvents).toHaveBeenCalledWith(3, "system");
    });

    it("should return events array in response", async () => {
      const res = await GET(makeGetRequest("events"));
      const json = await res.json();
      expect(json.events).toBeDefined();
      expect(Array.isArray(json.events)).toBe(true);
    });
  });

  // =========================================================================
  // GET ?action=stats
  // =========================================================================

  describe("GET ?action=stats", () => {
    it("should return event stats", async () => {
      const res = await GET(makeGetRequest("stats"));
      const json = await res.json();

      expect(json.stats.totalEvents).toBe(5);
      expect(json.stats.eventsByType.token_launch).toBe(3);
      expect(getEventStats).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET ?action=announcements
  // =========================================================================

  describe("GET ?action=announcements", () => {
    it("should return empty announcements initially", async () => {
      const res = await GET(makeGetRequest("announcements"));
      const json = await res.json();

      expect(json.announcements).toEqual([]);
      expect(json.totalUnread).toBe(0);
    });

    it("should return injected announcements", async () => {
      injectAnnouncement({ id: "a1", announcement: "Hello!" });
      injectAnnouncement({ id: "a2", announcement: "World!" });

      const res = await GET(makeGetRequest("announcements"));
      const json = await res.json();

      expect(json.announcements).toHaveLength(2);
      expect(json.totalUnread).toBe(2);
    });

    it("should respect count parameter", async () => {
      injectAnnouncement({ id: "a1" });
      injectAnnouncement({ id: "a2" });
      injectAnnouncement({ id: "a3" });

      const res = await GET(makeGetRequest("announcements", { count: "2" }));
      const json = await res.json();

      expect(json.announcements).toHaveLength(2);
      expect(json.totalUnread).toBe(3); // totalUnread counts all unread
    });

    it("should default count to 10", async () => {
      for (let i = 0; i < 15; i++) {
        injectAnnouncement({ id: `a${i}` });
      }

      const res = await GET(makeGetRequest("announcements"));
      const json = await res.json();

      expect(json.announcements).toHaveLength(10);
    });

    it("should filter by unread when unread=true", async () => {
      injectAnnouncement({ id: "a1" });
      injectAnnouncement({ id: "a2" });

      await POST(makePostRequest({ action: "mark_read", ids: ["a1"] }));

      const res = await GET(makeGetRequest("announcements", { unread: "true" }));
      const json = await res.json();

      expect(json.announcements).toHaveLength(1);
      expect(json.announcements[0].id).toBe("a2");
    });

    it("should filter out announcements older than 24 hours", async () => {
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      injectAnnouncement({ id: "old", timestamp: twentyFiveHoursAgo });
      injectAnnouncement({ id: "new" });

      const res = await GET(makeGetRequest("announcements"));
      const json = await res.json();

      expect(json.announcements).toHaveLength(1);
      expect(json.announcements[0].id).toBe("new");
    });

    it("should not count expired announcements in totalUnread", async () => {
      const expired = Date.now() - 25 * 60 * 60 * 1000;
      injectAnnouncement({ id: "old", timestamp: expired });
      injectAnnouncement({ id: "new" });

      const res = await GET(makeGetRequest("announcements"));
      const json = await res.json();

      expect(json.totalUnread).toBe(1);
    });

    it("should skip events without announcement field", async () => {
      if (!capturedSubscribeCallback) throw new Error("No callback");
      capturedSubscribeCallback({
        id: "no-announce",
        type: "system",
        source: "manual",
        data: {},
        timestamp: Date.now(),
        priority: "medium",
        processed: false,
        // No announcement field
      });

      const res = await GET(makeGetRequest("announcements"));
      const json = await res.json();

      expect(json.announcements).toHaveLength(0);
    });

    it("should deduplicate announcements with same id", async () => {
      injectAnnouncement({ id: "dup", announcement: "First" });
      injectAnnouncement({ id: "dup", announcement: "Duplicate" });

      const res = await GET(makeGetRequest("announcements"));
      const json = await res.json();

      expect(json.announcements).toHaveLength(1);
      expect(json.announcements[0].message).toBe("First");
    });

    it("should include correct fields in each announcement", async () => {
      injectAnnouncement({
        id: "full",
        announcement: "Test message",
        priority: "high",
        type: "token_launch",
      });

      const res = await GET(makeGetRequest("announcements"));
      const json = await res.json();
      const a = json.announcements[0];

      expect(a.id).toBe("full");
      expect(a.message).toBe("Test message");
      expect(a.priority).toBe("high");
      expect(a.eventType).toBe("token_launch");
      expect(a.read).toBe(false);
      expect(typeof a.timestamp).toBe("number");
    });
  });

  // =========================================================================
  // GET ?action=poll
  // =========================================================================

  describe("GET ?action=poll", () => {
    it("should return announcements newer than since", async () => {
      const t1 = Date.now() - 5000;
      const t2 = Date.now();
      injectAnnouncement({ id: "old", timestamp: t1 });
      injectAnnouncement({ id: "new", timestamp: t2 });

      const res = await GET(makeGetRequest("poll", { since: String(t1) }));
      const json = await res.json();

      // Strictly greater than `since`
      expect(json.announcements).toHaveLength(1);
      expect(json.announcements[0].id).toBe("new");
    });

    it("should only return unread announcements", async () => {
      injectAnnouncement({ id: "r1" });
      injectAnnouncement({ id: "r2" });

      await POST(makePostRequest({ action: "mark_read", ids: ["r1"] }));

      const res = await GET(makeGetRequest("poll", { since: "0" }));
      const json = await res.json();

      expect(json.announcements).toHaveLength(1);
      expect(json.announcements[0].id).toBe("r2");
    });

    it("should return lastTimestamp from newest or fallback to since", async () => {
      const res = await GET(makeGetRequest("poll", { since: "12345" }));
      const json = await res.json();

      expect(json.announcements).toHaveLength(0);
      expect(json.lastTimestamp).toBe(12345);
    });

    it("should return lastTimestamp from newest announcement", async () => {
      const ts = Date.now();
      injectAnnouncement({ id: "p1", timestamp: ts });

      const res = await GET(makeGetRequest("poll", { since: "0" }));
      const json = await res.json();

      expect(json.lastTimestamp).toBe(ts);
    });

    it("should default since to 0", async () => {
      injectAnnouncement({ id: "p1" });

      const res = await GET(makeGetRequest("poll"));
      const json = await res.json();

      expect(json.announcements).toHaveLength(1);
    });

    it("should filter out announcements older than 24 hours", async () => {
      const expired = Date.now() - 25 * 60 * 60 * 1000;
      injectAnnouncement({ id: "expired", timestamp: expired });

      const res = await GET(makeGetRequest("poll", { since: "0" }));
      const json = await res.json();

      expect(json.announcements).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET unknown action
  // =========================================================================

  describe("GET unknown action", () => {
    it("should return 400", async () => {
      const res = await GET(makeGetRequest("nonexistent"));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Unknown action");
    });
  });

  // =========================================================================
  // POST action=stop
  // =========================================================================

  describe("POST action=stop", () => {
    it("should stop coordinator", async () => {
      const res = await POST(makePostRequest({ action: "stop" }));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.message).toBe("Coordinator stopped");
      expect(stopCoordinator).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // POST action=emit
  // =========================================================================

  describe("POST action=emit", () => {
    it("should emit a valid event", async () => {
      const res = await POST(
        makePostRequest({
          action: "emit",
          type: "token_launch",
          source: "scout",
          data: { name: "TestToken" },
          priority: "high",
        })
      );
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.event).toBeDefined();
      expect(emitEvent).toHaveBeenCalledWith(
        "token_launch",
        "scout",
        { name: "TestToken" },
        "high"
      );
    });

    it("should default priority to medium", async () => {
      await POST(
        makePostRequest({
          action: "emit",
          type: "system",
          source: "manual",
          data: { message: "test" },
        })
      );

      expect(emitEvent).toHaveBeenCalledWith("system", "manual", { message: "test" }, "medium");
    });

    it("should reject when type is missing", async () => {
      const res = await POST(
        makePostRequest({
          action: "emit",
          source: "scout",
          data: { name: "Test" },
        })
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Missing");
    });

    it("should reject when source is missing", async () => {
      const res = await POST(
        makePostRequest({
          action: "emit",
          type: "system",
          data: { message: "test" },
        })
      );

      expect(res.status).toBe(400);
    });

    it("should reject when data is missing", async () => {
      const res = await POST(
        makePostRequest({
          action: "emit",
          type: "system",
          source: "manual",
        })
      );

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // POST action=mark_read
  // =========================================================================

  describe("POST action=mark_read", () => {
    it("should mark announcements as read", async () => {
      injectAnnouncement({ id: "mr1" });
      injectAnnouncement({ id: "mr2" });

      const res = await POST(makePostRequest({ action: "mark_read", ids: ["mr1"] }));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.markedCount).toBe(1);

      // Verify via GET unread count
      const announceRes = await GET(makeGetRequest("announcements", { unread: "true" }));
      const announceJson = await announceRes.json();
      expect(announceJson.totalUnread).toBe(1);
    });

    it("should handle non-existent ids gracefully", async () => {
      const res = await POST(makePostRequest({ action: "mark_read", ids: ["nonexistent"] }));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.markedCount).toBe(0);
    });

    it("should reject when ids is missing", async () => {
      const res = await POST(makePostRequest({ action: "mark_read" }));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Missing ids");
    });

    it("should reject when ids is not an array", async () => {
      const res = await POST(makePostRequest({ action: "mark_read", ids: "not-array" }));

      expect(res.status).toBe(400);
    });

    it("should mark multiple ids at once", async () => {
      injectAnnouncement({ id: "m1" });
      injectAnnouncement({ id: "m2" });
      injectAnnouncement({ id: "m3" });

      const res = await POST(makePostRequest({ action: "mark_read", ids: ["m1", "m2", "m3"] }));
      const json = await res.json();

      expect(json.markedCount).toBe(3);
    });

    it("should count only existing ids in markedCount", async () => {
      injectAnnouncement({ id: "exists" });

      const res = await POST(
        makePostRequest({
          action: "mark_read",
          ids: ["exists", "ghost1", "ghost2"],
        })
      );
      const json = await res.json();

      expect(json.markedCount).toBe(1);
    });
  });

  // =========================================================================
  // POST action=clear_announcements
  // =========================================================================

  describe("POST action=clear_announcements", () => {
    it("should clear all announcements", async () => {
      injectAnnouncement({ id: "c1" });
      injectAnnouncement({ id: "c2" });

      const res = await POST(makePostRequest({ action: "clear_announcements" }));
      const json = await res.json();

      expect(json.success).toBe(true);

      const announceRes = await GET(makeGetRequest("announcements"));
      const announceJson = await announceRes.json();
      expect(announceJson.announcements).toHaveLength(0);
      expect(announceJson.totalUnread).toBe(0);
    });
  });

  // =========================================================================
  // POST action=test_event
  // =========================================================================

  describe("POST action=test_event", () => {
    it("should emit a test system event", async () => {
      const res = await POST(makePostRequest({ action: "test_event" }));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.event).toBeDefined();
      expect(emitEvent).toHaveBeenCalledWith(
        "system",
        "manual",
        { message: "Test event from API" },
        "medium"
      );
    });
  });

  // =========================================================================
  // POST unknown action
  // =========================================================================

  describe("POST unknown action", () => {
    it("should return 400", async () => {
      const res = await POST(makePostRequest({ action: "nonexistent" }));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Unknown action");
    });
  });

  // =========================================================================
  // POST error handling
  // =========================================================================

  describe("POST error handling", () => {
    it("should return 500 for invalid JSON body", async () => {
      const req = new Request("http://localhost:3000/api/agent-coordinator", {
        method: "POST",
        body: "not json",
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Internal server error");
    });

    it("should return 500 when emitEvent throws", async () => {
      (emitEvent as jest.Mock).mockRejectedValueOnce(new Error("DB error"));

      const res = await POST(
        makePostRequest({
          action: "emit",
          type: "system",
          source: "manual",
          data: { message: "boom" },
        })
      );

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // ANNOUNCEMENT QUEUE LIMITS
  // =========================================================================

  describe("announcement queue trimming", () => {
    it("should cap queue at 50 announcements", async () => {
      for (let i = 0; i < 55; i++) {
        injectAnnouncement({ id: `trim_${i}` });
      }

      const res = await GET(makeGetRequest("announcements", { count: "100" }));
      const json = await res.json();

      expect(json.announcements.length).toBeLessThanOrEqual(50);
    });

    it("should keep newest announcements when trimming", async () => {
      for (let i = 0; i < 55; i++) {
        injectAnnouncement({
          id: `trim_${i}`,
          timestamp: Date.now() + i,
        });
      }

      const res = await GET(makeGetRequest("announcements", { count: "100" }));
      const json = await res.json();

      // unshift adds newest to front, trim keeps first 50
      expect(json.announcements[0].id).toBe("trim_54");
    });
  });
});
