/**
 * Tests for src/lib/scout-agent.ts
 *
 * Covers: lifecycle, WebSocket connection, data parsing, filters,
 * rate limiting, callbacks, config management, blocklist, and edge cases.
 *
 * Uses jest.isolateModules to get fresh module state per describe block
 * since scout-agent uses module-level mutable state.
 */

// Mock ws before any imports
let mockWsInstance: any;
jest.mock("ws", () => {
  return jest.fn().mockImplementation(() => {
    mockWsInstance = {
      onopen: null as (() => void) | null,
      onmessage: null as ((event: { data: string }) => void) | null,
      onerror: null as ((error: { message: string }) => void) | null,
      onclose: null as (() => void) | null,
      send: jest.fn(),
      close: jest.fn(),
    };
    return mockWsInstance;
  });
});

// Mock agent-coordinator
const mockEmitTokenLaunch = jest.fn().mockResolvedValue(null);
jest.mock("@/lib/agent-coordinator", () => ({
  emitTokenLaunch: (...args: any[]) => mockEmitTokenLaunch(...args),
}));

import type { ScoutConfig, TokenLaunch, ScoutState, ScoutAlertCallback } from "@/lib/scout-agent";

// Helper to get a fresh module import
function getScoutModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@/lib/scout-agent") as typeof import("@/lib/scout-agent");
}

// Helper to build a valid TokenLaunch for filter tests
function makeLaunch(overrides: Partial<TokenLaunch> = {}): TokenLaunch {
  return {
    mint: "TestMint123",
    name: "TestToken",
    symbol: "TST",
    creator: "CreatorWallet123",
    liquidity: 10, // 10 SOL = $2000 at $200/SOL
    supply: 1000000,
    timestamp: Date.now(),
    platform: "bags",
    ...overrides,
  };
}

// Helper to simulate a WebSocket message
function simulateWsMessage(data: Record<string, unknown>) {
  if (mockWsInstance?.onmessage) {
    mockWsInstance.onmessage({ data: JSON.stringify(data) });
  }
}

describe("Scout Agent", () => {
  let scout: ReturnType<typeof getScoutModule>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset module state by re-requiring (jest module cache is cleared by clearAllMocks)
    jest.resetModules();
    scout = getScoutModule();
  });

  afterEach(() => {
    try {
      scout.stopScoutAgent();
    } catch {
      // ignore if already stopped
    }
    jest.useRealTimers();
  });

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  describe("initScoutAgent", () => {
    it("should return true with no config", () => {
      expect(scout.initScoutAgent()).toBe(true);
    });

    it("should apply default config when no overrides given", () => {
      scout.initScoutAgent();
      const state = scout.getScoutState();
      expect(state.config.enabled).toBe(true);
      expect(state.config.reconnectDelayMs).toBe(5000);
      expect(state.config.filters.minLiquidityUsd).toBe(500);
      expect(state.config.filters.bagsOnly).toBe(true);
      expect(state.config.filters.blockedCreators).toEqual([]);
      expect(state.config.alertCooldownMs).toBe(1000);
      expect(state.config.maxAlertsPerMinute).toBe(30);
    });

    it("should merge partial config over defaults", () => {
      scout.initScoutAgent({
        reconnectDelayMs: 10000,
        filters: { minLiquidityUsd: 1000 },
      });

      const state = scout.getScoutState();
      expect(state.config.reconnectDelayMs).toBe(10000);
      expect(state.config.filters.minLiquidityUsd).toBe(1000);
      // Other defaults preserved
      expect(state.config.filters.bagsOnly).toBe(true);
      expect(state.config.alertCooldownMs).toBe(1000);
    });

    it("should deep merge filters without losing defaults", () => {
      scout.initScoutAgent({
        filters: { blockedCreators: ["BadCreator"] },
      });

      const state = scout.getScoutState();
      expect(state.config.filters.blockedCreators).toEqual(["BadCreator"]);
      expect(state.config.filters.maxSupply).toBeNull();
      expect(state.config.filters.nameContains).toBeNull();
    });
  });

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  describe("startScoutAgent", () => {
    it("should return true and set isRunning", () => {
      const result = scout.startScoutAgent();
      expect(result).toBe(true);
      expect(scout.getScoutState().isRunning).toBe(true);
    });

    it("should create a WebSocket connection", () => {
      scout.startScoutAgent();
      const WebSocket = require("ws");
      expect(WebSocket).toHaveBeenCalledWith("wss://pumpportal.fun/api/data");
    });

    it("should be idempotent when already running", () => {
      scout.startScoutAgent();
      const WebSocket = require("ws");
      const callCount = WebSocket.mock.calls.length;

      const result = scout.startScoutAgent();
      expect(result).toBe(true);
      // Should not create another WebSocket
      expect(WebSocket.mock.calls.length).toBe(callCount);
    });
  });

  describe("stopScoutAgent", () => {
    it("should set isRunning to false and isConnected to false", () => {
      scout.startScoutAgent();
      scout.stopScoutAgent();

      const state = scout.getScoutState();
      expect(state.isRunning).toBe(false);
      expect(state.isConnected).toBe(false);
    });

    it("should close the WebSocket", () => {
      scout.startScoutAgent();
      scout.stopScoutAgent();
      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it("should clear reconnect timeout", () => {
      scout.startScoutAgent();

      // Trigger onclose to start reconnect timer
      mockWsInstance.onclose?.();

      // Stop should clear the timer
      scout.stopScoutAgent();

      // Advance past reconnect delay - no reconnection should happen
      const WebSocket = require("ws");
      const callsBefore = WebSocket.mock.calls.length;
      jest.advanceTimersByTime(10000);
      expect(WebSocket.mock.calls.length).toBe(callsBefore);
    });

    it("should be safe to call when not running", () => {
      expect(() => scout.stopScoutAgent()).not.toThrow();
    });
  });

  // =========================================================================
  // WEBSOCKET CONNECTION
  // =========================================================================

  describe("WebSocket connection", () => {
    it("should subscribe to new tokens on open", () => {
      scout.startScoutAgent();
      mockWsInstance.onopen?.();

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ method: "subscribeNewToken" })
      );
      expect(scout.getScoutState().isConnected).toBe(true);
    });

    it("should reconnect on close if still running", () => {
      scout.startScoutAgent();
      const WebSocket = require("ws");
      const initialCalls = WebSocket.mock.calls.length;

      // Simulate close
      mockWsInstance.onclose?.();
      expect(scout.getScoutState().isConnected).toBe(false);

      // Advance timer past reconnect delay (5000ms default)
      jest.advanceTimersByTime(5000);

      expect(WebSocket.mock.calls.length).toBe(initialCalls + 1);
    });

    it("should not reconnect on close if stopped", () => {
      scout.startScoutAgent();
      scout.stopScoutAgent();
      const WebSocket = require("ws");
      const callsAfterStop = WebSocket.mock.calls.length;

      // Simulate close after stop
      mockWsInstance.onclose?.();
      jest.advanceTimersByTime(10000);

      expect(WebSocket.mock.calls.length).toBe(callsAfterStop);
    });

    it("should record errors from onerror", () => {
      scout.startScoutAgent();
      mockWsInstance.onerror?.({ message: "Connection refused" });

      const state = scout.getScoutState();
      expect(state.errors.length).toBe(1);
      expect(state.errors[0]).toContain("Connection refused");
    });

    it("should cap errors at 10", () => {
      scout.startScoutAgent();
      for (let i = 0; i < 15; i++) {
        mockWsInstance.onerror?.({ message: `Error ${i}` });
      }

      const state = scout.getScoutState();
      expect(state.errors.length).toBe(10);
      // Should keep the most recent errors
      expect(state.errors[state.errors.length - 1]).toContain("Error 14");
    });

    it("should handle WebSocket constructor throwing", () => {
      const WebSocket = require("ws");
      WebSocket.mockImplementationOnce(() => {
        throw new Error("Network unavailable");
      });

      scout.startScoutAgent();

      const state = scout.getScoutState();
      expect(state.errors.length).toBe(1);
      expect(state.errors[0]).toContain("Network unavailable");
    });

    it("should retry after constructor failure when still running", () => {
      const WebSocket = require("ws");
      WebSocket.mockImplementationOnce(() => {
        throw new Error("fail");
      });

      scout.startScoutAgent();
      const callsAfterFail = WebSocket.mock.calls.length;

      // Advance past reconnect delay
      // Restore the normal mock for the retry
      WebSocket.mockImplementation(() => {
        mockWsInstance = {
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
          send: jest.fn(),
          close: jest.fn(),
        };
        return mockWsInstance;
      });

      jest.advanceTimersByTime(5000);
      expect(WebSocket.mock.calls.length).toBe(callsAfterFail + 1);
    });

    it("should use custom reconnect delay from config", () => {
      scout.initScoutAgent({ reconnectDelayMs: 2000 });
      scout.startScoutAgent();
      const WebSocket = require("ws");
      const initialCalls = WebSocket.mock.calls.length;

      mockWsInstance.onclose?.();

      // Not yet at 2000ms
      jest.advanceTimersByTime(1999);
      expect(WebSocket.mock.calls.length).toBe(initialCalls);

      // Now at 2000ms
      jest.advanceTimersByTime(1);
      expect(WebSocket.mock.calls.length).toBe(initialCalls + 1);
    });
  });

  // =========================================================================
  // DATA PARSING (via WebSocket onmessage)
  // =========================================================================

  describe("parsePumpFunData (via onmessage)", () => {
    beforeEach(() => {
      // Disable bagsOnly filter so pump tokens pass
      scout.initScoutAgent({
        filters: { bagsOnly: false, minLiquidityUsd: 0 },
        alertCooldownMs: 0,
      });
      scout.startScoutAgent();
      mockWsInstance.onopen?.();
    });

    it("should parse valid pump.fun data and increment launchesScanned", () => {
      simulateWsMessage({
        mint: "PumpMint123",
        name: "PumpCoin",
        symbol: "PUMP",
        traderPublicKey: "Trader123",
        vSolInBondingCurve: 5,
        initialBuy: 500000,
        uri: "https://pump.fun/token",
        signature: "sig123",
      });

      const state = scout.getScoutState();
      expect(state.launchesScanned).toBe(1);
      expect(state.recentLaunches.length).toBe(1);
      expect(state.recentLaunches[0].mint).toBe("PumpMint123");
      expect(state.recentLaunches[0].platform).toBe("pump");
      expect(state.recentLaunches[0].creator).toBe("Trader123");
      expect(state.recentLaunches[0].liquidity).toBe(5);
      expect(state.recentLaunches[0].uri).toBe("https://pump.fun/token");
    });

    it("should reject data without mint", () => {
      simulateWsMessage({ name: "NoMint", symbol: "NM" });
      expect(scout.getScoutState().launchesScanned).toBe(0);
    });

    it("should reject data without name", () => {
      simulateWsMessage({ mint: "HasMint" });
      expect(scout.getScoutState().launchesScanned).toBe(0);
    });

    it("should handle symbol 'undefined' string as '???'", () => {
      simulateWsMessage({
        mint: "M1",
        name: "Token",
        symbol: "undefined",
      });

      const launches = scout.getRecentLaunches(1);
      expect(launches[0].symbol).toBe("???");
    });

    it("should handle missing symbol as '???'", () => {
      simulateWsMessage({ mint: "M1", name: "Token" });

      const launches = scout.getRecentLaunches(1);
      expect(launches[0].symbol).toBe("???");
    });

    it("should fallback creator to data.creator when traderPublicKey missing", () => {
      simulateWsMessage({
        mint: "M1",
        name: "Token",
        creator: "FallbackCreator",
      });

      expect(scout.getRecentLaunches(1)[0].creator).toBe("FallbackCreator");
    });

    it("should use 'unknown' creator when both fields missing", () => {
      simulateWsMessage({ mint: "M1", name: "Token" });
      expect(scout.getRecentLaunches(1)[0].creator).toBe("unknown");
    });

    it("should fallback liquidity to data.liquidity", () => {
      simulateWsMessage({ mint: "M1", name: "Token", liquidity: 7.5 });
      expect(scout.getRecentLaunches(1)[0].liquidity).toBe(7.5);
    });

    it("should fallback supply to data.supply", () => {
      simulateWsMessage({ mint: "M1", name: "Token", supply: 999 });
      expect(scout.getRecentLaunches(1)[0].supply).toBe(999);
    });

    it("should ignore non-JSON messages", () => {
      // Send a raw non-JSON string
      if (mockWsInstance?.onmessage) {
        mockWsInstance.onmessage({ data: "not json" });
      }
      expect(scout.getScoutState().launchesScanned).toBe(0);
    });

    it("should cap recentLaunches at 50", () => {
      for (let i = 0; i < 55; i++) {
        simulateWsMessage({ mint: `Mint${i}`, name: `Token${i}` });
      }
      expect(scout.getRecentLaunches(100).length).toBe(50);
      // Most recent should be first
      expect(scout.getRecentLaunches(1)[0].mint).toBe("Mint54");
    });
  });

  // =========================================================================
  // FILTERS (tested via handleTokenData path)
  // =========================================================================

  describe("filters", () => {
    beforeEach(() => {
      scout.startScoutAgent();
      mockWsInstance.onopen?.();
    });

    describe("bagsOnly filter", () => {
      it("should reject pump tokens when bagsOnly is true (default)", () => {
        simulateWsMessage({ mint: "M1", name: "Token" });
        // pump platform should be rejected by default bagsOnly=true
        const state = scout.getScoutState();
        expect(state.launchesScanned).toBe(1); // Scanned but not added
        expect(state.recentLaunches.length).toBe(0); // Filtered out
      });

      it("should accept pump tokens when bagsOnly is false", () => {
        scout.initScoutAgent({
          filters: { bagsOnly: false, minLiquidityUsd: 0 },
          alertCooldownMs: 0,
        });

        simulateWsMessage({ mint: "M1", name: "Token" });
        expect(scout.getRecentLaunches().length).toBe(1);
      });
    });

    describe("minLiquidityUsd filter", () => {
      it("should reject tokens below minimum liquidity", () => {
        scout.initScoutAgent({
          filters: { bagsOnly: false, minLiquidityUsd: 1000 },
          alertCooldownMs: 0,
        });

        // liquidity = 2 SOL * $200 = $400 < $1000 threshold
        simulateWsMessage({
          mint: "M1",
          name: "Token",
          vSolInBondingCurve: 2,
        });
        expect(scout.getRecentLaunches().length).toBe(0);
      });

      it("should accept tokens at exactly minimum liquidity", () => {
        scout.initScoutAgent({
          filters: { bagsOnly: false, minLiquidityUsd: 1000 },
          alertCooldownMs: 0,
        });

        // liquidity = 5 SOL * $200 = $1000 = threshold
        simulateWsMessage({
          mint: "M1",
          name: "Token",
          vSolInBondingCurve: 5,
        });
        expect(scout.getRecentLaunches().length).toBe(1);
      });

      it("should skip liquidity check when minLiquidityUsd is 0", () => {
        scout.initScoutAgent({
          filters: { bagsOnly: false, minLiquidityUsd: 0 },
          alertCooldownMs: 0,
        });

        simulateWsMessage({ mint: "M1", name: "Token" }); // 0 liquidity
        expect(scout.getRecentLaunches().length).toBe(1);
      });
    });

    describe("maxSupply filter", () => {
      it("should reject tokens exceeding maxSupply", () => {
        scout.initScoutAgent({
          filters: { bagsOnly: false, minLiquidityUsd: 0, maxSupply: 1000 },
          alertCooldownMs: 0,
        });

        simulateWsMessage({
          mint: "M1",
          name: "Token",
          initialBuy: 5000,
        });
        expect(scout.getRecentLaunches().length).toBe(0);
      });

      it("should accept tokens at exactly maxSupply", () => {
        scout.initScoutAgent({
          filters: { bagsOnly: false, minLiquidityUsd: 0, maxSupply: 1000 },
          alertCooldownMs: 0,
        });

        simulateWsMessage({
          mint: "M1",
          name: "Token",
          initialBuy: 1000,
        });
        expect(scout.getRecentLaunches().length).toBe(1);
      });

      it("should not filter when maxSupply is null", () => {
        scout.initScoutAgent({
          filters: { bagsOnly: false, minLiquidityUsd: 0, maxSupply: null },
          alertCooldownMs: 0,
        });

        simulateWsMessage({
          mint: "M1",
          name: "Token",
          initialBuy: 999999999,
        });
        expect(scout.getRecentLaunches().length).toBe(1);
      });
    });

    describe("nameContains filter", () => {
      it("should match on token name (case-insensitive)", () => {
        scout.initScoutAgent({
          filters: {
            bagsOnly: false,
            minLiquidityUsd: 0,
            nameContains: "cool",
          },
          alertCooldownMs: 0,
        });

        simulateWsMessage({ mint: "M1", name: "CoolCat" });
        expect(scout.getRecentLaunches().length).toBe(1);
      });

      it("should match on symbol (case-insensitive)", () => {
        scout.initScoutAgent({
          filters: {
            bagsOnly: false,
            minLiquidityUsd: 0,
            nameContains: "pepe",
          },
          alertCooldownMs: 0,
        });

        simulateWsMessage({
          mint: "M1",
          name: "Unrelated",
          symbol: "PEPE",
        });
        expect(scout.getRecentLaunches().length).toBe(1);
      });

      it("should reject when neither name nor symbol matches", () => {
        scout.initScoutAgent({
          filters: {
            bagsOnly: false,
            minLiquidityUsd: 0,
            nameContains: "doge",
          },
          alertCooldownMs: 0,
        });

        simulateWsMessage({
          mint: "M1",
          name: "CoolCat",
          symbol: "CAT",
        });
        expect(scout.getRecentLaunches().length).toBe(0);
      });
    });

    describe("blockedCreators filter", () => {
      it("should reject tokens from blocked creators", () => {
        scout.initScoutAgent({
          filters: {
            bagsOnly: false,
            minLiquidityUsd: 0,
            blockedCreators: ["BadGuy"],
          },
          alertCooldownMs: 0,
        });

        simulateWsMessage({
          mint: "M1",
          name: "Token",
          traderPublicKey: "BadGuy",
        });
        expect(scout.getRecentLaunches().length).toBe(0);
      });

      it("should accept tokens from non-blocked creators", () => {
        scout.initScoutAgent({
          filters: {
            bagsOnly: false,
            minLiquidityUsd: 0,
            blockedCreators: ["BadGuy"],
          },
          alertCooldownMs: 0,
        });

        simulateWsMessage({
          mint: "M1",
          name: "Token",
          traderPublicKey: "GoodGuy",
        });
        expect(scout.getRecentLaunches().length).toBe(1);
      });
    });
  });

  // =========================================================================
  // RATE LIMITING
  // =========================================================================

  describe("rate limiting", () => {
    beforeEach(() => {
      scout.initScoutAgent({
        filters: { bagsOnly: false, minLiquidityUsd: 0 },
        maxAlertsPerMinute: 3,
        alertCooldownMs: 0, // disable cooldown for rate limit tests
      });
      scout.startScoutAgent();
      mockWsInstance.onopen?.();
    });

    it("should emit alerts up to maxAlertsPerMinute", () => {
      for (let i = 0; i < 5; i++) {
        simulateWsMessage({ mint: `M${i}`, name: `Token${i}` });
      }

      expect(scout.getScoutState().alertsSent).toBe(3);
      expect(mockEmitTokenLaunch).toHaveBeenCalledTimes(3);
    });

    it("should still add to recentLaunches even when rate limited", () => {
      for (let i = 0; i < 5; i++) {
        simulateWsMessage({ mint: `M${i}`, name: `Token${i}` });
      }

      // All 5 should be in recent launches (they pass filters)
      expect(scout.getRecentLaunches(10).length).toBe(5);
      // But only 3 alerts sent
      expect(scout.getScoutState().alertsSent).toBe(3);
    });

    it("should reset rate limit after 60 seconds", () => {
      // Use up the limit
      for (let i = 0; i < 3; i++) {
        simulateWsMessage({ mint: `M${i}`, name: `Token${i}` });
      }
      expect(scout.getScoutState().alertsSent).toBe(3);

      // Advance past 60 seconds
      jest.advanceTimersByTime(61000);

      // Should be able to send again
      simulateWsMessage({ mint: "MNew", name: "NewToken" });
      expect(scout.getScoutState().alertsSent).toBe(4);
    });
  });

  describe("alert cooldown", () => {
    beforeEach(() => {
      scout.initScoutAgent({
        filters: { bagsOnly: false, minLiquidityUsd: 0 },
        maxAlertsPerMinute: 100,
        alertCooldownMs: 500,
      });
      scout.startScoutAgent();
      mockWsInstance.onopen?.();
    });

    it("should enforce cooldown between alerts", () => {
      simulateWsMessage({ mint: "M1", name: "Token1" });
      expect(scout.getScoutState().alertsSent).toBe(1);

      // Immediate second message - should be rate limited by cooldown
      simulateWsMessage({ mint: "M2", name: "Token2" });
      expect(scout.getScoutState().alertsSent).toBe(1);

      // After cooldown
      jest.advanceTimersByTime(500);
      simulateWsMessage({ mint: "M3", name: "Token3" });
      expect(scout.getScoutState().alertsSent).toBe(2);
    });
  });

  // =========================================================================
  // CALLBACKS
  // =========================================================================

  describe("onTokenLaunch callbacks", () => {
    beforeEach(() => {
      scout.initScoutAgent({
        filters: { bagsOnly: false, minLiquidityUsd: 0 },
        alertCooldownMs: 0,
      });
      scout.startScoutAgent();
      mockWsInstance.onopen?.();
    });

    it("should call registered callbacks on alert", () => {
      const callback = jest.fn();
      scout.onTokenLaunch(callback);

      simulateWsMessage({ mint: "M1", name: "Token1" });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ mint: "M1", name: "Token1" })
      );
    });

    it("should call multiple callbacks", () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      scout.onTokenLaunch(cb1);
      scout.onTokenLaunch(cb2);

      simulateWsMessage({ mint: "M1", name: "Token1" });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it("should support unsubscribe", () => {
      const callback = jest.fn();
      const unsub = scout.onTokenLaunch(callback);

      simulateWsMessage({ mint: "M1", name: "Token1" });
      expect(callback).toHaveBeenCalledTimes(1);

      unsub();

      simulateWsMessage({ mint: "M2", name: "Token2" });
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it("should handle callback that throws without affecting others", () => {
      const badCallback = jest.fn().mockImplementation(() => {
        throw new Error("Callback exploded");
      });
      const goodCallback = jest.fn();

      scout.onTokenLaunch(badCallback);
      scout.onTokenLaunch(goodCallback);

      simulateWsMessage({ mint: "M1", name: "Token1" });

      expect(badCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });

    it("should emit to agent coordinator", () => {
      simulateWsMessage({ mint: "M1", name: "Token1" });

      expect(mockEmitTokenLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ mint: "M1", platform: "pump" })
      );
    });

    it("should handle emitTokenLaunch rejection gracefully", () => {
      mockEmitTokenLaunch.mockRejectedValueOnce(new Error("Coordinator down"));

      expect(() => {
        simulateWsMessage({ mint: "M1", name: "Token1" });
      }).not.toThrow();
    });
  });

  // =========================================================================
  // CONFIG MANAGEMENT
  // =========================================================================

  describe("updateScoutConfig", () => {
    it("should update config and return new config", () => {
      const newConfig = scout.updateScoutConfig({
        reconnectDelayMs: 3000,
      });

      expect(newConfig.reconnectDelayMs).toBe(3000);
      expect(scout.getScoutState().config.reconnectDelayMs).toBe(3000);
    });

    it("should deep merge filter updates", () => {
      scout.initScoutAgent({
        filters: { blockedCreators: ["A"], minLiquidityUsd: 500 },
      });

      scout.updateScoutConfig({
        filters: { minLiquidityUsd: 1000 },
      });

      const config = scout.getScoutState().config;
      expect(config.filters.minLiquidityUsd).toBe(1000);
      // Should preserve existing blockedCreators
      expect(config.filters.blockedCreators).toEqual(["A"]);
    });
  });

  describe("blockCreator / unblockCreator", () => {
    it("should add creator to blocklist", () => {
      scout.blockCreator("BadCreator");
      expect(scout.getScoutState().config.filters.blockedCreators).toContain("BadCreator");
    });

    it("should not duplicate blocked creator", () => {
      scout.blockCreator("BadCreator");
      scout.blockCreator("BadCreator");
      expect(
        scout.getScoutState().config.filters.blockedCreators.filter((c) => c === "BadCreator")
          .length
      ).toBe(1);
    });

    it("should remove creator from blocklist", () => {
      scout.blockCreator("BadCreator");
      scout.unblockCreator("BadCreator");
      expect(scout.getScoutState().config.filters.blockedCreators).not.toContain("BadCreator");
    });

    it("should be safe to unblock a creator not in the list", () => {
      expect(() => scout.unblockCreator("NeverBlocked")).not.toThrow();
    });
  });

  // =========================================================================
  // STATE ACCESS
  // =========================================================================

  describe("getScoutState", () => {
    it("should return initial state", () => {
      const state = scout.getScoutState();
      expect(state.isRunning).toBe(false);
      expect(state.isConnected).toBe(false);
      expect(state.lastLaunchSeen).toBe(0);
      expect(state.launchesScanned).toBe(0);
      expect(state.alertsSent).toBe(0);
      expect(state.recentLaunches).toEqual([]);
      expect(state.errors).toEqual([]);
      expect(state.config).toBeDefined();
    });

    it("should return a shallow copy (primitives independent, arrays shared)", () => {
      const state = scout.getScoutState();
      // Primitives are copied by value — mutations don't leak
      state.isRunning = true;
      const freshState = scout.getScoutState();
      expect(freshState.isRunning).toBe(false);

      // Arrays are shared references (shallow spread)
      state.recentLaunches.push(makeLaunch());
      const freshState2 = scout.getScoutState();
      expect(freshState2.recentLaunches.length).toBe(1);
    });
  });

  describe("getRecentLaunches", () => {
    beforeEach(() => {
      scout.initScoutAgent({
        filters: { bagsOnly: false, minLiquidityUsd: 0 },
        alertCooldownMs: 0,
      });
      scout.startScoutAgent();
      mockWsInstance.onopen?.();
    });

    it("should return empty array when no launches", () => {
      expect(scout.getRecentLaunches()).toEqual([]);
    });

    it("should default to 10 results", () => {
      for (let i = 0; i < 15; i++) {
        simulateWsMessage({ mint: `M${i}`, name: `T${i}` });
      }
      expect(scout.getRecentLaunches().length).toBe(10);
    });

    it("should respect count parameter", () => {
      for (let i = 0; i < 10; i++) {
        simulateWsMessage({ mint: `M${i}`, name: `T${i}` });
      }
      expect(scout.getRecentLaunches(3).length).toBe(3);
    });

    it("should return all if count exceeds available", () => {
      simulateWsMessage({ mint: "M1", name: "T1" });
      simulateWsMessage({ mint: "M2", name: "T2" });
      expect(scout.getRecentLaunches(100).length).toBe(2);
    });

    it("should return most recent first", () => {
      simulateWsMessage({ mint: "First", name: "First" });
      simulateWsMessage({ mint: "Second", name: "Second" });

      const launches = scout.getRecentLaunches(2);
      expect(launches[0].mint).toBe("Second");
      expect(launches[1].mint).toBe("First");
    });
  });

  // =========================================================================
  // INTEGRATION: end-to-end message flow
  // =========================================================================

  describe("end-to-end message flow", () => {
    it("should process message from WebSocket open through to callback", () => {
      const callback = jest.fn();

      scout.initScoutAgent({
        filters: { bagsOnly: false, minLiquidityUsd: 0 },
        alertCooldownMs: 0,
      });
      scout.onTokenLaunch(callback);
      scout.startScoutAgent();

      // Simulate full WebSocket lifecycle
      mockWsInstance.onopen?.();

      // Send a valid token message
      simulateWsMessage({
        mint: "EndToEndMint",
        name: "E2E Token",
        symbol: "E2E",
        traderPublicKey: "E2ECreator",
        vSolInBondingCurve: 10,
        initialBuy: 1000000,
      });

      // Verify full pipeline
      const state = scout.getScoutState();
      expect(state.isRunning).toBe(true);
      expect(state.isConnected).toBe(true);
      expect(state.launchesScanned).toBe(1);
      expect(state.alertsSent).toBe(1);
      expect(state.recentLaunches[0]).toEqual(
        expect.objectContaining({
          mint: "EndToEndMint",
          name: "E2E Token",
          symbol: "E2E",
          creator: "E2ECreator",
          platform: "pump",
        })
      );
      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockEmitTokenLaunch).toHaveBeenCalledTimes(1);
    });
  });
});
