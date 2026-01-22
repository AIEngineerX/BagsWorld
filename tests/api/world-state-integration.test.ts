/**
 * World State API Integration Tests
 *
 * Tests the /api/world-state endpoint logic with:
 * - Real code path execution via world-calculator
 * - Integration with world-calculator functions
 * - Edge cases and boundary conditions
 *
 * Note: Direct API route testing is limited due to Next.js server component
 * imports not working well in Jest. These tests focus on the underlying
 * calculation logic that the API uses.
 */

import type { WorldState, FeeEarner, TokenInfo } from "@/lib/types";
import {
  buildWorldState,
  calculateWorldHealth,
  calculateWeather,
  transformFeeEarnerToCharacter,
  transformTokenToBuilding,
  generateGameEvent,
  type BagsHealthMetrics,
} from "@/lib/world-calculator";

describe("World State API Integration (Logic)", () => {
  describe("World State Structure", () => {
    it("should build valid world state structure", () => {
      const earners: FeeEarner[] = [];
      const tokens: TokenInfo[] = [];

      const state = buildWorldState(earners, tokens);

      expect(state).toHaveProperty("health");
      expect(state).toHaveProperty("weather");
      expect(state).toHaveProperty("population");
      expect(state).toHaveProperty("buildings");
      expect(state).toHaveProperty("events");
      expect(state).toHaveProperty("lastUpdated");
    });

    it("should return health within 0-100 range", () => {
      const state = buildWorldState([], []);

      expect(state.health).toBeGreaterThanOrEqual(0);
      expect(state.health).toBeLessThanOrEqual(100);
    });

    it("should return valid weather type", () => {
      const state = buildWorldState([], []);

      expect(["sunny", "cloudy", "rain", "storm", "apocalypse"]).toContain(
        state.weather
      );
    });

    it("should return arrays for population and buildings", () => {
      const state = buildWorldState([], []);

      expect(Array.isArray(state.population)).toBe(true);
      expect(Array.isArray(state.buildings)).toBe(true);
      expect(Array.isArray(state.events)).toBe(true);
    });
  });

  describe("Token Processing", () => {
    const baseToken: TokenInfo = {
      mint: "TestToken111111111111111111111111111111111",
      name: "Test Token",
      symbol: "TEST",
      creator: "TestCreator111111111111111111111111111111",
      marketCap: 500000,
      volume24h: 10000,
      change24h: 15,
    };

    it("should process tokens into buildings", () => {
      const tokens = [baseToken];
      const state = buildWorldState([], tokens);

      expect(state.buildings.length).toBeGreaterThan(0);
      const testBuilding = state.buildings.find((b) => b.symbol === "TEST");
      expect(testBuilding).toBeDefined();
    });

    it("should calculate building level from market cap", () => {
      const building = transformTokenToBuilding(baseToken, 0);
      // $500K = level 3
      expect(building.level).toBe(3);
    });

    it("should respect level override from admin", () => {
      const tokenWithOverride = { ...baseToken, levelOverride: 5 };
      const building = transformTokenToBuilding(tokenWithOverride, 0);
      expect(building.level).toBe(5);
    });

    it("should set glowing for high price change", () => {
      const pumpingToken = { ...baseToken, change24h: 100 };
      const building = transformTokenToBuilding(pumpingToken, 0);
      expect(building.glowing).toBe(true);
    });
  });

  describe("Fee Earner Processing", () => {
    const baseEarner: FeeEarner = {
      wallet: "earner-wallet-123",
      username: "testuser",
      provider: "twitter",
      providerUsername: "testuser_twitter",
      earnings24h: 500,
      change24h: 10,
      totalEarnings: 1000,
    };

    it("should process earners into characters", () => {
      const earners = [baseEarner];
      const state = buildWorldState(earners, []);

      expect(state.population.length).toBeGreaterThan(0);
    });

    it("should transform earner to character with correct properties", () => {
      const character = transformFeeEarnerToCharacter(baseEarner);

      expect(character.id).toBe(baseEarner.wallet);
      expect(character.username).toBe(baseEarner.providerUsername);
      expect(character.provider).toBe(baseEarner.provider);
    });

    it("should assign character mood based on earnings", () => {
      const happyEarner = { ...baseEarner, earnings24h: 2000 };
      const happyCharacter = transformFeeEarnerToCharacter(happyEarner);
      expect(happyCharacter.mood).toBe("happy");

      const sadEarner = { ...baseEarner, change24h: -30 };
      const sadCharacter = transformFeeEarnerToCharacter(sadEarner);
      expect(sadCharacter.mood).toBe("sad");
    });
  });

  describe("Health Metrics", () => {
    it("should calculate health from bags metrics", () => {
      const metrics: BagsHealthMetrics = {
        claimVolume24h: 50,
        totalLifetimeFees: 1000,
        activeTokenCount: 10,
      };

      const state = buildWorldState([], [], undefined, metrics);
      // High metrics should give high health
      expect(state.health).toBeGreaterThan(50);
    });

    it("should derive weather from health", () => {
      // High health = sunny
      expect(calculateWeather(90)).toBe("sunny");
      // Low health = apocalypse
      expect(calculateWeather(10)).toBe("apocalypse");
    });

    it("should return baseline health with no activity", () => {
      const health = calculateWorldHealth(0, 0, 0, 0);
      expect(health).toBe(25); // Baseline
    });

    it("should add building bonus to baseline", () => {
      const health = calculateWorldHealth(0, 0, 0, 5);
      expect(health).toBe(40); // 25 + 15 (max bonus)
    });
  });

  describe("Event Generation", () => {
    it("should generate token launch event", () => {
      const event = generateGameEvent("token_launch", {
        username: "launcher",
        tokenName: "NewToken",
      });

      expect(event.type).toBe("token_launch");
      expect(event.message).toContain("launched");
      expect(event.id).toBeDefined();
    });

    it("should generate fee claim event", () => {
      const event = generateGameEvent("fee_claim", {
        username: "claimer",
        amount: 5.5,
      });

      expect(event.type).toBe("fee_claim");
      expect(event.message).toContain("claimed");
      expect(event.message).toContain("5.50 SOL");
    });

    it("should generate price pump event", () => {
      const event = generateGameEvent("price_pump", {
        tokenName: "MoonToken",
        change: 200,
      });

      expect(event.type).toBe("price_pump");
      expect(event.message).toContain("pumped");
    });
  });

  describe("Special Buildings", () => {
    it("should place BagsWorld HQ in sky", () => {
      const hqToken: TokenInfo = {
        mint: "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
        name: "BagsWorld HQ",
        symbol: "BAGSWORLD",
        creator: "BagsWorld",
        marketCap: 1000000,
      };

      const building = transformTokenToBuilding(hqToken, 0);
      expect(building.isFloating).toBe(true);
      expect(building.y).toBe(500); // Sky position
      expect(building.level).toBe(5); // Always max
      expect(building.zone).toBeUndefined(); // Visible from both zones
    });

    it("should place Casino in trending zone", () => {
      const casinoToken: TokenInfo = {
        mint: "StarterCasino1111111111111111111111111111111",
        name: "BagsWorld Casino",
        symbol: "CASINO",
        creator: "BagsWorld",
        marketCap: 50000000,
      };

      const building = transformTokenToBuilding(casinoToken, 0);
      expect(building.zone).toBe("trending");
    });

    it("should place regular buildings in main_city zone", () => {
      const regularToken: TokenInfo = {
        mint: "RegularToken111111111111111111111111111111",
        name: "Regular Token",
        symbol: "REG",
        creator: "creator",
        marketCap: 100000,
      };

      const building = transformTokenToBuilding(regularToken, 0);
      expect(building.zone).toBe("main_city");
    });
  });

  describe("Special Characters", () => {
    it("should place Toly in main_city zone", () => {
      const tolyEarner: FeeEarner = {
        wallet: "toly-solana-permanent",
        username: "toly",
        provider: "solana",
        providerUsername: "aeyakovenko",
        earnings24h: 0,
        change24h: 0,
        totalEarnings: 65000,
        isToly: true,
      };

      const character = transformFeeEarnerToCharacter(tolyEarner);
      expect(character.zone).toBe("main_city");
      expect(character.isToly).toBe(true);
    });

    it("should place Neo in trending zone", () => {
      const neoEarner: FeeEarner = {
        wallet: "scout-agent-permanent",
        username: "Neo",
        provider: "twitter",
        providerUsername: "TheOne",
        earnings24h: 0,
        change24h: 0,
        totalEarnings: 1999,
      };

      const character = transformFeeEarnerToCharacter({
        ...neoEarner,
        isScout: true,
      } as any);
      expect(character.zone).toBe("trending");
    });

    it("should place CJ in trending zone", () => {
      const cjEarner: FeeEarner = {
        wallet: "cj-grove-street-permanent",
        username: "CJ",
        provider: "twitter",
        providerUsername: "cj_grove",
        earnings24h: 0,
        change24h: 0,
        totalEarnings: 1992,
      };

      const character = transformFeeEarnerToCharacter({
        ...cjEarner,
        isCJ: true,
      } as any);
      expect(character.zone).toBe("trending");
    });
  });

  describe("Population and Building Limits", () => {
    it("should limit population to MAX_CHARACTERS (15)", () => {
      const manyEarners: FeeEarner[] = Array.from({ length: 20 }, (_, i) => ({
        wallet: `earner-${i}`,
        username: `user${i}`,
        provider: "twitter" as const,
        providerUsername: `user${i}`,
        earnings24h: 100,
        change24h: 0,
        totalEarnings: 100,
      }));

      const state = buildWorldState(manyEarners, []);
      expect(state.population.length).toBeLessThanOrEqual(15);
    });

    it("should limit buildings to MAX_BUILDINGS (20)", () => {
      const manyTokens: TokenInfo[] = Array.from({ length: 25 }, (_, i) => ({
        mint: `token-${i.toString().padStart(38, "0")}`,
        name: `Token ${i}`,
        symbol: `T${i}`,
        creator: "creator",
        marketCap: 100000 + i * 10000,
        volume24h: 1000,
        change24h: 0,
      }));

      const state = buildWorldState([], manyTokens);
      expect(state.buildings.length).toBeLessThanOrEqual(20);
    });

    it("should limit events to 20 entries", () => {
      const previousEvents = Array.from({ length: 25 }, (_, i) =>
        generateGameEvent("fee_claim", { username: `user${i}`, amount: i })
      );

      const previousState: WorldState = {
        health: 50,
        weather: "cloudy",
        population: [],
        buildings: [],
        events: previousEvents,
        lastUpdated: Date.now() - 1000,
      };

      const newState = buildWorldState([], [], previousState);
      expect(newState.events.length).toBeLessThanOrEqual(20);
    });
  });

  describe("Position Stability", () => {
    it("should maintain building positions across state updates", () => {
      const tokens: TokenInfo[] = [
        {
          mint: "stable-position-token",
          name: "Stable",
          symbol: "STABLE",
          creator: "creator",
          marketCap: 500000,
        },
      ];

      const state1 = buildWorldState([], tokens);
      const building1 = state1.buildings.find((b) => b.symbol === "STABLE");

      const state2 = buildWorldState([], tokens, state1);
      const building2 = state2.buildings.find((b) => b.symbol === "STABLE");

      expect(building1?.x).toBe(building2?.x);
      expect(building1?.y).toBe(building2?.y);
    });

    it("should preserve character positions from previous state", () => {
      const earners: FeeEarner[] = [
        {
          wallet: "stable-character",
          username: "stable",
          provider: "twitter",
          providerUsername: "stable",
          earnings24h: 100,
          change24h: 0,
          totalEarnings: 100,
        },
      ];

      const previousState: WorldState = {
        health: 50,
        weather: "cloudy",
        population: [
          {
            id: "stable-character",
            username: "stable",
            provider: "twitter",
            x: 999,
            y: 888,
            mood: "neutral",
            earnings24h: 100,
            direction: "right",
            isMoving: false,
            zone: "main_city",
          },
        ],
        buildings: [],
        events: [],
        lastUpdated: Date.now() - 1000,
      };

      const newState = buildWorldState(earners, [], previousState);
      const character = newState.population.find(
        (c) => c.id === "stable-character"
      );

      expect(character?.x).toBe(999);
      expect(character?.y).toBe(888);
    });
  });

  describe("Data Consistency", () => {
    it("should return consistent lastUpdated timestamp", () => {
      const before = Date.now();
      const state = buildWorldState([], []);
      const after = Date.now();

      expect(state.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdated).toBeLessThanOrEqual(after);
    });

    it("should generate unique event IDs", () => {
      const event1 = generateGameEvent("token_launch", {
        username: "a",
        tokenName: "A",
      });
      const event2 = generateGameEvent("token_launch", {
        username: "b",
        tokenName: "B",
      });

      expect(event1.id).not.toBe(event2.id);
    });
  });
});
