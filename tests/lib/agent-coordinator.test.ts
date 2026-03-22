/**
 * Agent Coordinator Unit Tests
 *
 * Tests the real coordinator module: emitEvent, subscribe, generateAnnouncement,
 * deduplication, queue overflow, priority routing, and convenience emitters.
 * No mocking of the module under test.
 */

// Mock neon before importing the module (coordinator depends on it)
jest.mock("@/lib/neon", () => ({
  isNeonConfigured: jest.fn().mockReturnValue(false),
  initializeAgentFeedTables: jest.fn().mockResolvedValue(undefined),
  hasEventBeenEmitted: jest.fn().mockResolvedValue(false),
  recordEmittedEvent: jest.fn().mockResolvedValue(undefined),
  cleanupOldEmittedEvents: jest.fn().mockResolvedValue(undefined),
  getEmittedEventIds: jest.fn().mockResolvedValue(new Set()),
}));

import {
  startCoordinator,
  stopCoordinator,
  emitEvent,
  subscribe,
  emitTokenLaunch,
  emitPricePump,
  emitPriceDump,
  emitFeeClaim,
  emitWorldHealthChange,
  emitAgentInsight,
  getCoordinatorState,
  getRecentEvents,
  getEventStats,
  emitTaskPosted,
  emitTaskClaimed,
  emitTaskCompleted,
  emitA2AMessage,
  emitCorpFounded,
  emitCorpJoined,
  emitCorpPayroll,
} from "@/lib/agent-coordinator";

describe("agent-coordinator — unit tests", () => {
  beforeEach(() => {
    stopCoordinator();
    startCoordinator();
  });

  afterEach(() => {
    stopCoordinator();
  });

  // ========================================================================
  // emitEvent basics
  // ========================================================================
  describe("emitEvent", () => {
    it("returns an AgentEvent with correct fields", async () => {
      const event = await emitEvent("system", "manual", { message: "hello" }, "low");
      expect(event).not.toBeNull();
      expect(event!.type).toBe("system");
      expect(event!.source).toBe("manual");
      expect(event!.data).toEqual({ message: "hello" });
      expect(event!.priority).toBe("low");
      expect(typeof event!.id).toBe("string");
      expect(typeof event!.timestamp).toBe("number");
      expect(event!.processed).toBe(true); // Processed because coordinator is running
    });

    it("generates an announcement string", async () => {
      const event = await emitEvent("system", "manual", { message: "test msg" });
      expect(event!.announcement).toBe("test msg");
    });

    it("increments stats on each emit", async () => {
      await emitEvent("system", "manual", {});
      await emitEvent("system", "manual", {});
      const stats = getEventStats();
      expect(stats.totalEvents).toBeGreaterThanOrEqual(2);
      expect(stats.eventsByType["system"]).toBeGreaterThanOrEqual(2);
      expect(stats.eventsBySource["manual"]).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // Deduplication
  // ========================================================================
  describe("deduplication", () => {
    it("returns null for duplicate custom event IDs", async () => {
      const first = await emitEvent("system", "manual", {}, "low", "unique-id-123");
      expect(first).not.toBeNull();

      const second = await emitEvent("system", "manual", {}, "low", "unique-id-123");
      expect(second).toBeNull();
    });

    it("auto-generated IDs are unique (no dedup on auto IDs)", async () => {
      const e1 = await emitEvent("system", "manual", {});
      const e2 = await emitEvent("system", "manual", {});
      expect(e1).not.toBeNull();
      expect(e2).not.toBeNull();
      expect(e1!.id).not.toBe(e2!.id);
    });
  });

  // ========================================================================
  // Subscribe & handler routing
  // ========================================================================
  describe("subscribe", () => {
    it("handler receives matching events", async () => {
      const received: string[] = [];
      subscribe(["fee_claim"], (event) => {
        received.push(event.type);
      });

      await emitEvent("fee_claim", "world-state", { amount: 1 });
      await emitEvent("system", "manual", {}); // Should NOT trigger handler

      expect(received).toEqual(["fee_claim"]);
    });

    it("wildcard subscriber receives all events", async () => {
      const received: string[] = [];
      subscribe("*", (event) => {
        received.push(event.type);
      });

      await emitEvent("system", "manual", {});
      await emitEvent("fee_claim", "world-state", {});

      expect(received).toContain("system");
      expect(received).toContain("fee_claim");
    });

    it("unsubscribe function removes the handler", async () => {
      const received: string[] = [];
      const unsub = subscribe("*", (event) => {
        received.push(event.type);
      });

      await emitEvent("system", "manual", {});
      expect(received.length).toBe(1);

      unsub();
      await emitEvent("system", "manual", {});
      expect(received.length).toBe(1); // No additional call
    });

    it("priority filter only delivers matching priorities", async () => {
      const received: string[] = [];
      subscribe("*", (event) => {
        received.push(event.priority);
      }, ["high", "urgent"]);

      await emitEvent("system", "manual", {}, "low");
      await emitEvent("system", "manual", {}, "high");

      expect(received).toEqual(["high"]);
    });

    it("handler error does not break other handlers", async () => {
      const received: string[] = [];

      subscribe("*", () => {
        throw new Error("handler exploded");
      });

      subscribe("*", (event) => {
        received.push(event.type);
      });

      // Should not throw
      await emitEvent("system", "manual", {});
      expect(received).toEqual(["system"]);
    });
  });

  // ========================================================================
  // getRecentEvents
  // ========================================================================
  describe("getRecentEvents", () => {
    it("returns recent events in order", async () => {
      await emitEvent("fee_claim", "world-state", { order: 1 });
      await emitEvent("system", "manual", { order: 2 });

      const events = getRecentEvents(10);
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it("filters by type", async () => {
      await emitEvent("fee_claim", "world-state", {});
      await emitEvent("system", "manual", {});

      const feeClaims = getRecentEvents(10, "fee_claim");
      expect(feeClaims.every((e) => e.type === "fee_claim")).toBe(true);
    });

    it("respects count limit", async () => {
      for (let i = 0; i < 5; i++) {
        await emitEvent("system", "manual", { i });
      }
      const limited = getRecentEvents(2);
      expect(limited.length).toBe(2);
    });
  });

  // ========================================================================
  // generateAnnouncement (via emitEvent)
  // ========================================================================
  describe("generateAnnouncement", () => {
    it("token_launch with bags platform", async () => {
      const event = await emitEvent("token_launch", "scout", {
        symbol: "PEPE",
        platform: "bags",
      });
      expect(event!.announcement).toContain("$PEPE");
      expect(event!.announcement).toContain("Bags.fm");
    });

    it("token_launch with pump platform", async () => {
      const event = await emitEvent("token_launch", "scout", {
        symbol: "DOGE",
        platform: "pump",
      });
      expect(event!.announcement).toContain("pump.fun");
    });

    it("token_pump includes change percentage", async () => {
      const event = await emitEvent("token_pump", "price-monitor", {
        symbol: "SOL",
        change: 25.5,
      });
      expect(event!.announcement).toContain("25.5%");
      expect(event!.announcement).toContain("$SOL");
    });

    it("token_dump uses absolute value of change", async () => {
      const event = await emitEvent("token_dump", "price-monitor", {
        symbol: "BTC",
        change: -30.2,
      });
      expect(event!.announcement).toContain("30.2%");
    });

    it("fee_claim formats SOL amount", async () => {
      const event = await emitEvent("fee_claim", "world-state", {
        username: "alice",
        amount: 5.5,
        tokenSymbol: "BAGS",
      });
      expect(event!.announcement).toContain("alice");
      expect(event!.announcement).toContain("5.50 SOL");
      expect(event!.announcement).toContain("$BAGS");
    });

    it("fee_claim with zero amount", async () => {
      const event = await emitEvent("fee_claim", "world-state", {
        username: "bob",
        amount: 0,
      });
      expect(event!.announcement).toContain("0 SOL");
    });

    it("casino_win truncates wallet address", async () => {
      const event = await emitEvent("casino_win", "casino", {
        winnerWallet: "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC",
        prizeSol: 2.5,
      });
      expect(event!.announcement).toContain("9Luw...iFUC");
    });

    it("casino_win with short wallet still works", async () => {
      const event = await emitEvent("casino_win", "casino", {
        winnerWallet: "ABCD",
        prizeSol: 1,
      });
      // slice(0,4) + slice(-4) on 4-char string → "ABCD...ABCD"
      expect(event!.announcement).toContain("ABCD");
    });

    it("corp_service completed vs posted produces different messages", async () => {
      const posted = await emitEvent("corp_service", "task-board", {
        agentName: "Ghost",
        corpName: "TradeCorp",
        title: "Market Analysis",
        completed: false,
      });
      expect(posted!.announcement).toContain("posted");

      const completed = await emitEvent("corp_service", "task-board", {
        agentName: "Ghost",
        corpName: "TradeCorp",
        title: "Market Analysis",
        completed: true,
      });
      expect(completed!.announcement).toContain("completed");
    });

    it("system event with message uses the message", async () => {
      const event = await emitEvent("system", "manual", { message: "Custom system msg" });
      expect(event!.announcement).toBe("Custom system msg");
    });

    it("system event without message falls back to 'System event'", async () => {
      const event = await emitEvent("system", "manual", {});
      expect(event!.announcement).toBe("System event");
    });

    it("world_health shows improvement direction", async () => {
      const event = await emitEvent("world_health", "world-state", {
        health: 80,
        previousHealth: 60,
        status: "HEALTHY",
      });
      expect(event!.announcement).toContain("improved");
      expect(event!.announcement).toContain("80%");
    });

    it("world_health shows decline direction", async () => {
      const event = await emitEvent("world_health", "world-state", {
        health: 30,
        previousHealth: 60,
        status: "STRUGGLING",
      });
      expect(event!.announcement).toContain("declined");
    });
  });

  // ========================================================================
  // Convenience emitters — priority thresholds
  // ========================================================================
  describe("convenience emitter priorities", () => {
    it("emitPricePump: change >= 50 → high", async () => {
      const event = await emitPricePump("TEST", 50);
      expect(event!.priority).toBe("high");
    });

    it("emitPricePump: change 20-49 → medium", async () => {
      const event = await emitPricePump("TEST", 25);
      expect(event!.priority).toBe("medium");
    });

    it("emitPricePump: change < 20 → low", async () => {
      const event = await emitPricePump("TEST", 10);
      expect(event!.priority).toBe("low");
    });

    it("emitPriceDump: |change| >= 50 → high", async () => {
      const event = await emitPriceDump("TEST", -55);
      expect(event!.priority).toBe("high");
    });

    it("emitPriceDump: |change| < 50 → medium", async () => {
      const event = await emitPriceDump("TEST", -30);
      expect(event!.priority).toBe("medium");
    });

    it("emitFeeClaim: amount >= 1 → high", async () => {
      const event = await emitFeeClaim("user", 1.5, "BAGS");
      expect(event!.priority).toBe("high");
    });

    it("emitFeeClaim: amount 0.1-0.99 → medium", async () => {
      const event = await emitFeeClaim("user", 0.5);
      expect(event!.priority).toBe("medium");
    });

    it("emitFeeClaim: amount < 0.1 → low", async () => {
      const event = await emitFeeClaim("user", 0.05);
      expect(event!.priority).toBe("low");
    });

    it("emitTokenLaunch: bags platform → high", async () => {
      const event = await emitTokenLaunch({
        name: "Test", symbol: "TST", mint: "mint123", platform: "bags",
        creator: "c", timestamp: Date.now(), marketCap: 0, liquidity: 0,
      } as any);
      expect(event!.priority).toBe("high");
    });

    it("emitTokenLaunch: pump platform → medium", async () => {
      const event = await emitTokenLaunch({
        name: "Test", symbol: "TST", mint: "mint123", platform: "pump",
        creator: "c", timestamp: Date.now(), marketCap: 0, liquidity: 0,
      } as any);
      expect(event!.priority).toBe("medium");
    });

    it("emitWorldHealthChange: large change (20+) → high", async () => {
      const event = await emitWorldHealthChange(80, 50, "HEALTHY");
      expect(event!.priority).toBe("high");
    });

    it("emitWorldHealthChange: moderate change (10-19) → medium", async () => {
      const event = await emitWorldHealthChange(60, 45, "GROWING");
      expect(event!.priority).toBe("medium");
    });

    it("emitWorldHealthChange: small change (< 10) → low", async () => {
      const event = await emitWorldHealthChange(50, 48, "GROWING");
      expect(event!.priority).toBe("low");
    });
  });

  // ========================================================================
  // A2A / Corp convenience emitters
  // ========================================================================
  describe("A2A and Corp emitters", () => {
    it("emitTaskPosted produces task_posted event", async () => {
      const event = await emitTaskPosted("Ghost", "Analyze Market", "analysis", 0.5, "task-1");
      expect(event!.type).toBe("task_posted");
      expect(event!.announcement).toContain("Ghost");
      expect(event!.announcement).toContain("Analyze Market");
    });

    it("emitTaskClaimed produces task_claimed event", async () => {
      const event = await emitTaskClaimed("Neo", "Ghost", "Analyze Market", "task-1");
      expect(event!.type).toBe("task_claimed");
      expect(event!.announcement).toContain("Neo");
    });

    it("emitTaskCompleted produces task_completed event", async () => {
      const event = await emitTaskCompleted("Neo", "Ghost", "Analyze Market", 0.5, "task-1");
      expect(event!.type).toBe("task_completed");
      expect(event!.announcement).toContain("COMPLETED");
    });

    it("emitA2AMessage produces a2a_message event", async () => {
      const event = await emitA2AMessage("Ghost", "Neo", "trade_signal");
      expect(event!.type).toBe("a2a_message");
      expect(event!.announcement).toContain("Ghost");
      expect(event!.announcement).toContain("Neo");
    });

    it("emitCorpFounded produces corp_founded event", async () => {
      const event = await emitCorpFounded("TradeCorp", "Ghost", "TRDCR");
      expect(event!.type).toBe("corp_founded");
      expect(event!.announcement).toContain("Ghost");
      expect(event!.announcement).toContain("TradeCorp");
      expect(event!.announcement).toContain("$TRDCR");
    });

    it("emitCorpJoined produces corp_joined event", async () => {
      const event = await emitCorpJoined("Neo", "TradeCorp");
      expect(event!.type).toBe("corp_joined");
      expect(event!.announcement).toContain("Neo");
    });

    it("emitCorpPayroll produces corp_payroll event", async () => {
      const event = await emitCorpPayroll("TradeCorp", 2.5, 3);
      expect(event!.type).toBe("corp_payroll");
      expect(event!.announcement).toContain("3 members");
    });
  });

  // ========================================================================
  // Coordinator lifecycle
  // ========================================================================
  describe("coordinator lifecycle", () => {
    it("startCoordinator is idempotent", () => {
      startCoordinator();
      startCoordinator();
      const state = getCoordinatorState();
      expect(state.isRunning).toBe(true);
    });

    it("stopCoordinator sets isRunning to false", () => {
      startCoordinator();
      stopCoordinator();
      const state = getCoordinatorState();
      expect(state.isRunning).toBe(false);
    });

    it("events still emitted when coordinator is stopped (but not processed)", async () => {
      stopCoordinator();
      const event = await emitEvent("system", "manual", {});
      expect(event).not.toBeNull();
      expect(event!.processed).toBe(false); // Not processed because coordinator stopped
    });
  });
});
