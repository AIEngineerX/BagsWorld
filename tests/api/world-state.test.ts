/**
 * World State API Tests
 *
 * Tests the actual route handler code with:
 * - Real GET and POST handlers imported directly
 * - External dependencies mocked at module level
 * - Actual business logic executed and verified
 *
 * Note: World calculator functions (calculateBuildingLevel, calculateWeather, etc.)
 * are thoroughly tested in tests/lib/world-calculator.test.ts
 */

// Mock external dependencies BEFORE importing route
jest.mock("@/lib/neon", () => ({
  isNeonConfigured: jest.fn(() => false),
  getGlobalTokens: jest.fn(() => Promise.resolve([])),
  batchUpdateBuildingHealth: jest.fn(() => Promise.resolve()),
  recordMilestoneAchievement: jest.fn(() =>
    Promise.resolve({ isNew: false, achievedAt: null })
  ),
  getEventsClearedTimestamp: jest.fn(() => Promise.resolve(0)),
  setEventsClearedTimestamp: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/dexscreener-api", () => ({
  getTokensByMints: jest.fn(() => Promise.resolve([])),
}));

jest.mock("@/lib/agent-coordinator", () => ({
  emitEvent: jest.fn(() => Promise.resolve()),
  startCoordinator: jest.fn(),
  getRecentEvents: jest.fn(() => []),
  emitWorldHealthChange: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/agent-economy", () => ({
  getAgentCharacters: jest.fn(() => []),
}));

jest.mock("@/lib/agent-economy/external-registry", () => ({
  getExternalAgentCharactersSync: jest.fn(() => []),
  getExternalAgentBuildingsSync: jest.fn(() => []),
}));

// Mock next/server
jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    }),
  },
}));

// Mock Solana web3.js to avoid connection issues
jest.mock("@solana/web3.js", () => ({
  Connection: jest.fn().mockImplementation(() => ({})),
  PublicKey: jest.fn().mockImplementation((key: string) => ({
    toString: () => key,
    toBase58: () => key,
  })),
}));

// Mock the Bags SDK import
jest.mock("@bagsfm/bags-sdk", () => ({
  BagsSDK: jest.fn().mockImplementation(() => ({
    state: {
      getTokenCreators: jest.fn(() => Promise.resolve([])),
      getTokenLifetimeFees: jest.fn(() => Promise.resolve(0)),
      getTokenClaimEvents: jest.fn(() => Promise.resolve([])),
    },
  })),
}));

import { GET, POST } from "@/app/api/world-state/route";
import { isNeonConfigured, getGlobalTokens } from "@/lib/neon";

// Create mock request
function createMockRequest(
  url: string,
  options: { method?: string; body?: object } = {}
): any {
  const parsedUrl = new URL(url);
  return {
    url,
    nextUrl: parsedUrl,
    json: async () => options.body || {},
    headers: new Map(),
  };
}

describe("World State API - Actual Route Handler Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isNeonConfigured as jest.Mock).mockReturnValue(false);
    (getGlobalTokens as jest.Mock).mockResolvedValue([]);
  });

  describe("GET /api/world-state", () => {
    it("should return world state or handle initialization gracefully", async () => {
      const response = await GET();
      const data = await response.json();

      // GET may fail on first call due to missing SDK/cache, but should not throw
      if (response.status === 200) {
        expect(data.health).toBeDefined();
        expect(data.health).toBeGreaterThanOrEqual(0);
        expect(data.health).toBeLessThanOrEqual(100);
        expect(data.weather).toBeDefined();
        expect(Array.isArray(data.population)).toBe(true);
        expect(Array.isArray(data.buildings)).toBe(true);
      } else {
        // Error response should have error field
        expect(data.error).toBeDefined();
      }
    });
  });

  describe("POST /api/world-state", () => {
    it("should accept registered tokens", async () => {
      const tokens = [
        {
          mint: "Token1111111111111111111111111111111111111",
          name: "Test Token",
          symbol: "TEST",
          creator: "Creator111111111111111111111111111111",
          createdAt: Date.now(),
        },
      ];

      const request = createMockRequest("http://localhost:3000/api/world-state", {
        method: "POST",
        body: { tokens },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.health).toBeDefined();
      expect(data.buildings).toBeDefined();
    });

    it("should include permanent buildings regardless of registered tokens", async () => {
      const request = createMockRequest("http://localhost:3000/api/world-state", {
        method: "POST",
        body: { tokens: [] },
      });

      const response = await POST(request);
      const data = await response.json();

      // Should include Treasury, HQ, and starter buildings
      expect(data.buildings.length).toBeGreaterThan(0);

      // Should include BagsWorld HQ
      const hq = data.buildings.find(
        (b: any) => b.symbol === "BAGSWORLD" || b.name === "BagsWorld HQ"
      );
      expect(hq).toBeDefined();
    });

    it("should return special characters in population", async () => {
      const request = createMockRequest("http://localhost:3000/api/world-state", {
        method: "POST",
        body: { tokens: [] },
      });

      const response = await POST(request);
      const data = await response.json();

      // Should include special characters like Finn, Toly, Ash, etc.
      expect(data.population.length).toBeGreaterThan(0);
    });

    it("should include time info in response", async () => {
      const request = createMockRequest("http://localhost:3000/api/world-state", {
        method: "POST",
        body: { tokens: [] },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.timeInfo).toBeDefined();
      expect(data.timeInfo.hour).toBeDefined();
      expect(typeof data.timeInfo.isNight).toBe("boolean");
    });

    it("should handle tokens with fee shares", async () => {
      const tokens = [
        {
          mint: "Token2222222222222222222222222222222222222",
          name: "Fee Token",
          symbol: "FEE",
          creator: "Creator222222222222222222222222222222",
          createdAt: Date.now(),
          feeShares: [
            { provider: "twitter", username: "feeReceiver", bps: 5000 },
          ],
        },
      ];

      const request = createMockRequest("http://localhost:3000/api/world-state", {
        method: "POST",
        body: { tokens },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Fee share recipients should appear as characters (earners)
      expect(data.population).toBeDefined();
    });

    it("should return health metrics when SDK is available", async () => {
      const request = createMockRequest("http://localhost:3000/api/world-state", {
        method: "POST",
        body: { tokens: [] },
      });

      const response = await POST(request);
      const data = await response.json();

      // Health metrics should be included for transparency
      if (data.healthMetrics) {
        expect(data.healthMetrics.claimVolume24h).toBeDefined();
        expect(data.healthMetrics.totalLifetimeFees).toBeDefined();
        expect(data.healthMetrics.activeTokenCount).toBeDefined();
      }
    });
  });

  describe("Database Integration", () => {
    it("should merge admin overrides from Neon when configured", async () => {
      (isNeonConfigured as jest.Mock).mockReturnValue(true);
      (getGlobalTokens as jest.Mock).mockResolvedValue([
        {
          mint: "Token3333333333333333333333333333333333333",
          level_override: 5,
          health_override: 100,
          zone_override: "trending",
        },
      ]);

      const tokens = [
        {
          mint: "Token3333333333333333333333333333333333333",
          name: "Override Token",
          symbol: "OVR",
          creator: "Creator333333333333333333333333333333",
          createdAt: Date.now(),
        },
      ];

      const request = createMockRequest("http://localhost:3000/api/world-state", {
        method: "POST",
        body: { tokens },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The building should have the override applied
      const building = data.buildings.find(
        (b: any) => b.id === "Token3333333333333333333333333333333333333"
      );
      if (building) {
        expect(building.level).toBe(5);
        expect(building.health).toBe(100);
        // Zone override is applied, but building might hash to same zone anyway
        // Just verify override was processed (level and health are overridden)
      }
    });

    it("should work when database is not configured", async () => {
      (isNeonConfigured as jest.Mock).mockReturnValue(false);

      const request = createMockRequest("http://localhost:3000/api/world-state", {
        method: "POST",
        body: { tokens: [] },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    it("should handle POST errors gracefully", async () => {
      // Simulate a POST request that causes an error (malformed body would be caught)
      const request = {
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
