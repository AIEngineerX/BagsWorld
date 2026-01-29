import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BagsApiService,
  getBagsApiService,
  cleanupCache,
  TokenInfo,
  CreatorFees,
  TopCreator,
  RecentLaunch,
} from "./BagsApiService.js";

// Mock fetch globally
const mockFetch = vi.fn();
(global as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

describe("BagsApiService", () => {
  let service: BagsApiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BagsApiService({ baseUrl: "https://test-api.bags.fm" });
    service.clearCache();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe("constructor", () => {
    it("uses provided config", () => {
      const customService = new BagsApiService({
        baseUrl: "https://custom.api.com",
        apiKey: "test-key",
      });
      expect(customService).toBeDefined();
    });

    it("falls back to environment variables", () => {
      const originalEnv = process.env.BAGS_API_URL;
      process.env.BAGS_API_URL = "https://env-api.bags.fm";

      const envService = new BagsApiService();
      expect(envService).toBeDefined();

      process.env.BAGS_API_URL = originalEnv;
    });

    it("uses default URL when no config or env", () => {
      const originalEnv = process.env.BAGS_API_URL;
      delete process.env.BAGS_API_URL;

      const defaultService = new BagsApiService();
      expect(defaultService).toBeDefined();

      process.env.BAGS_API_URL = originalEnv;
    });
  });

  describe("getToken", () => {
    const mockToken: TokenInfo = {
      mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      name: "Test Token",
      symbol: "TEST",
      description: "A test token",
      marketCap: 1000000,
      volume24h: 50000,
      lifetimeFees: 100,
      holders: 500,
    };

    it("fetches token successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { token: mockToken } }),
      });

      const result = await service.getToken(mockToken.mint);

      expect(result).toEqual(mockToken);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/token-launch/creator/v3?mint=${mockToken.mint}`),
        expect.any(Object)
      );
    });

    it("returns null for non-existent token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { token: null } }),
      });

      const result = await service.getToken("nonexistent");
      expect(result).toBeNull();
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Not Found",
      });

      const result = await service.getToken("invalid");
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await service.getToken("test");
      expect(result).toBeNull();
    });

    it("uses cache for repeated requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { token: mockToken } }),
      });

      // First request
      await service.getToken(mockToken.mint);
      // Second request should use cache
      await service.getToken(mockToken.mint);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCreatorFees", () => {
    const mockFees: CreatorFees = {
      mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      totalFees: 100.5,
      claimedFees: 50.25,
      unclaimedFees: 50.25,
      creatorAddress: "Creator123...",
    };

    it("fetches fees successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: mockFees }),
      });

      const result = await service.getCreatorFees(mockFees.mint);

      expect(result).toEqual(mockFees);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/token-launch/lifetime-fees?mint=${mockFees.mint}`),
        expect.any(Object)
      );
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Internal Server Error",
      });

      const result = await service.getCreatorFees("test");
      expect(result).toBeNull();
    });

    it("handles zero fees", async () => {
      const zeroFees: CreatorFees = {
        mint: "test",
        totalFees: 0,
        claimedFees: 0,
        unclaimedFees: 0,
        creatorAddress: "Creator",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: zeroFees }),
      });

      const result = await service.getCreatorFees("test");
      expect(result?.totalFees).toBe(0);
    });
  });

  describe("getTopCreators", () => {
    const mockCreators: TopCreator[] = [
      { address: "addr1", name: "Creator 1", totalFees: 1000, rank: 1 },
      { address: "addr2", name: "Creator 2", totalFees: 500, rank: 2 },
      { address: "addr3", totalFees: 250, rank: 3 },
    ];

    it("fetches top creators with default limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { creators: mockCreators } }),
      });

      const result = await service.getTopCreators();

      expect(result).toEqual(mockCreators);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/creators/top?limit=10"),
        expect.any(Object)
      );
    });

    it("fetches with custom limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { creators: mockCreators.slice(0, 2) } }),
      });

      const result = await service.getTopCreators(2);

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/creators/top?limit=2"),
        expect.any(Object)
      );
    });

    it("returns empty array on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Error",
        text: async () => "Error",
      });

      const result = await service.getTopCreators();
      expect(result).toEqual([]);
    });

    it("returns empty array when no creators", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { creators: null } }),
      });

      const result = await service.getTopCreators();
      expect(result).toEqual([]);
    });
  });

  describe("getRecentLaunches", () => {
    // Uses DexScreener API format
    const mockDexScreenerPairs = [
      {
        chainId: "solana",
        dexId: "bags",
        pairCreatedAt: Date.now() - 3600000,
        baseToken: { address: "mint1", name: "Token 1", symbol: "TK1" },
        fdv: 100000,
        liquidity: { usd: 50000 },
      },
      {
        chainId: "solana",
        dexId: "bags",
        pairCreatedAt: Date.now() - 7200000,
        baseToken: { address: "mint2", name: "Token 2", symbol: "TK2" },
        fdv: 50000,
        liquidity: { usd: 25000 },
      },
    ];

    it("fetches recent launches from DexScreener", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: mockDexScreenerPairs }),
      });

      const result = await service.getRecentLaunches(5);

      // Verify it calls DexScreener
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.dexscreener.com")
      );
      // Returns formatted launches
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("returns empty array on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await service.getRecentLaunches();
      expect(result).toEqual([]);
    });

    it("handles pairs with missing fdv", async () => {
      const pairsNoFdv = [{ ...mockDexScreenerPairs[0], fdv: undefined }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: pairsNoFdv }),
      });

      const result = await service.getRecentLaunches(1);
      // Should still return result even without FDV
      expect(result).toBeDefined();
    });
  });

  describe("getWorldHealth", () => {
    const mockHealth = {
      health: 75,
      weather: "sunny",
      volume24h: 1000000,
      fees24h: 500,
      activeTokens: 50,
      topCreators: [],
    };

    it("fetches world health from BagsWorld API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth,
      });

      const result = await service.getWorldHealth();

      expect(result).toEqual({
        health: 75,
        weather: "sunny",
        totalVolume24h: 1000000,
        totalFees24h: 500,
        activeTokens: 50,
        topCreators: [],
      });
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await service.getWorldHealth();
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await service.getWorldHealth();
      expect(result).toBeNull();
    });

    it("provides defaults for missing fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.getWorldHealth();

      expect(result).toEqual({
        health: 50,
        weather: "cloudy",
        totalVolume24h: 0,
        totalFees24h: 0,
        activeTokens: 0,
        topCreators: [],
      });
    });
  });

  describe("searchTokens", () => {
    const mockTokens: TokenInfo[] = [
      { mint: "mint1", name: "BAGS Token", symbol: "BAGS" },
      { mint: "mint2", name: "BagsWorld", symbol: "BWD" },
    ];

    it("searches tokens by query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { tokens: mockTokens } }),
      });

      const result = await service.searchTokens("bags");

      expect(result).toEqual(mockTokens);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/tokens/search?q=bags"),
        expect.any(Object)
      );
    });

    it("URL-encodes special characters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { tokens: [] } }),
      });

      await service.searchTokens("$BAGS");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/tokens/search?q=%24BAGS"),
        expect.any(Object)
      );
    });

    it("returns empty array on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Error"));

      const result = await service.searchTokens("test");
      expect(result).toEqual([]);
    });

    it("returns empty array for no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { tokens: null } }),
      });

      const result = await service.searchTokens("nonexistent");
      expect(result).toEqual([]);
    });
  });

  describe("clearCache", () => {
    it("clears the cache", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, response: { token: { mint: "test", name: "Test", symbol: "T" } } }),
      });

      // First request
      await service.getToken("test");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Should use cache
      await service.getToken("test");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache();

      // Should make new request
      await service.getToken("test");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Authorization header", () => {
    it("includes auth header when API key is set", async () => {
      const authService = new BagsApiService({
        baseUrl: "https://api.test.com",
        apiKey: "test-api-key",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { token: null } }),
      });

      await authService.getToken("test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "test-api-key",
          }),
        })
      );
    });

    it("omits auth header when no API key", async () => {
      const noAuthService = new BagsApiService({
        baseUrl: "https://api.test.com",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { token: null } }),
      });

      await noAuthService.getToken("test");

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers["x-api-key"]).toBeUndefined();
    });
  });
});

describe("getBagsApiService singleton", () => {
  it("returns same instance on repeated calls", () => {
    const instance1 = getBagsApiService();
    const instance2 = getBagsApiService();
    expect(instance1).toBe(instance2);
  });
});

describe("BagsApiService edge cases", () => {
  let service: BagsApiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BagsApiService({ baseUrl: "https://test-api.bags.fm" });
    service.clearCache();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe("concurrent requests", () => {
    it("handles multiple simultaneous requests to same endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, response: { token: { mint: "test", name: "Test", symbol: "T" } } }),
      });

      // Fire 5 concurrent requests
      const promises = Array.from({ length: 5 }, () => service.getToken("test"));
      const results = await Promise.all(promises);

      // All should succeed with same data
      expect(results.every((r) => r !== null)).toBe(true);
      expect(results.every((r) => r?.mint === "test")).toBe(true);
      // Note: concurrent requests may all execute before cache is populated
      // This tests that the service handles concurrent load without errors
    });

    it("uses cache for sequential requests to same endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, response: { token: { mint: "cached", name: "Cached", symbol: "C" } } }),
      });

      // First call - fetches from API
      const result1 = await service.getToken("cached");
      expect(result1?.mint).toBe("cached");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await service.getToken("cached");
      expect(result2?.mint).toBe("cached");
      // Cache is working if still only 1 call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("handles multiple simultaneous requests to different endpoints", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("token-launch/creator")) {
          return { ok: true, json: async () => ({ success: true, response: { token: { mint: "t", name: "T", symbol: "T" } } }) };
        }
        if (url.includes("creators/top")) {
          return { ok: true, json: async () => ({ success: true, response: { creators: [] } }) };
        }
        if (url.includes("token-launch/recent")) {
          return { ok: true, json: async () => ({ success: true, response: { launches: [] } }) };
        }
        return { ok: true, json: async () => ({ success: true, response: {} }) };
      });

      // Fire concurrent requests to different endpoints
      const [token, creators, launches] = await Promise.all([
        service.getToken("mint1"),
        service.getTopCreators(5),
        service.getRecentLaunches(5),
      ]);

      expect(token).not.toBeNull();
      expect(creators).toEqual([]);
      expect(launches).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("malformed responses", () => {
    it("handles response with unexpected structure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { unexpectedField: "value" } }),
      });

      const result = await service.getToken("test");
      // Should handle gracefully - token field is undefined
      expect(result).toBeNull();
    });

    it("handles array instead of object response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: [] }),
      });

      const result = await service.getToken("test");
      expect(result).toBeNull();
    });

    it("handles string instead of JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      });

      const result = await service.getToken("test");
      expect(result).toBeNull();
    });
  });

  describe("HTTP status code handling", () => {
    // Test 4xx errors (no retry)
    const clientErrorCodes = [400, 401, 403, 404, 429];
    for (const status of clientErrorCodes) {
      it(`handles ${status} status code`, async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: `Error ${status}`,
          text: async () => `Error ${status}`,
        });

        const result = await service.getToken("test");
        expect(result).toBeNull();
      });
    }

    // Test 5xx errors (with retry - need to mock all retry attempts)
    const serverErrorCodes = [500, 502, 503, 504];
    for (const status of serverErrorCodes) {
      it(`handles ${status} status code after retries`, async () => {
        // Mock all retry attempts to return the same error
        mockFetch.mockResolvedValue({
          ok: false,
          status,
          statusText: `Error ${status}`,
          text: async () => `Error ${status}`,
        });

        const result = await service.getToken("test");
        expect(result).toBeNull();
      });
    }
  });

  describe("boundary limit values", () => {
    it("handles limit of 0", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { creators: [] } }),
      });

      const result = await service.getTopCreators(0);
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=0"),
        expect.any(Object)
      );
    });

    it("handles very large limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { creators: [] } }),
      });

      const result = await service.getTopCreators(10000);
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10000"),
        expect.any(Object)
      );
    });

    it("handles negative limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { creators: [] } }),
      });

      const result = await service.getTopCreators(-5);
      expect(result).toEqual([]);
    });
  });

  describe("special characters in queries", () => {
    it("handles whitespace in search query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { tokens: [] } }),
      });

      await service.searchTokens("  bags  token  ");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("q=%20%20bags%20%20token%20%20"),
        expect.any(Object)
      );
    });

    it("handles Unicode in search query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { tokens: [] } }),
      });

      await service.searchTokens("🚀token");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("handles empty search query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { tokens: [] } }),
      });

      const result = await service.searchTokens("");
      expect(result).toEqual([]);
    });
  });

  describe("response data validation", () => {
    it("handles token with missing optional fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          response: {
            token: {
              mint: "test",
              name: "Minimal",
              symbol: "MIN",
              // No marketCap, volume24h, lifetimeFees, holders
            },
          },
        }),
      });

      const result = await service.getToken("test");
      expect(result?.mint).toBe("test");
      expect(result?.marketCap).toBeUndefined();
    });

    it("handles creator with very large fee values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          response: {
            creators: [
              {
                address: "addr1",
                name: "Whale",
                totalFees: 999999999.999999,
                rank: 1,
              },
            ],
          },
        }),
      });

      const result = await service.getTopCreators(1);
      expect(result[0].totalFees).toBe(999999999.999999);
    });

    it("handles world health with extreme values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          health: 150, // Over 100
          weather: "unknown_weather",
          volume24h: -100, // Negative
          fees24h: 0,
          activeTokens: 0,
          topCreators: [],
        }),
      });

      const result = await service.getWorldHealth();
      expect(result?.health).toBe(150);
      expect(result?.weather).toBe("unknown_weather");
      expect(result?.totalVolume24h).toBe(-100);
    });
  });

  describe("timeout handling", () => {
    it("handles slow responses gracefully", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ success: true, response: { token: { mint: "t", name: "T", symbol: "T" } } }),
              });
            }, 100);
          })
      );

      const result = await service.getToken("test");
      expect(result).not.toBeNull();
    });
  });

  describe("cleanupCache", () => {
    it("removes stale entries", async () => {
      // First, populate cache with a fresh request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: { token: { mint: "test1", name: "Test", symbol: "T" } } }),
      });
      await service.getToken("test1");

      // Cleanup should not remove fresh entries (TTL is 30s)
      const cleanedFresh = cleanupCache();
      expect(cleanedFresh).toBe(0);
    });

    it("returns number of cleaned entries", () => {
      // Just verify the function returns a number
      const result = cleanupCache();
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
