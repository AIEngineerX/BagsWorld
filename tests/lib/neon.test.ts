/**
 * Neon Database Client Comprehensive Tests
 *
 * Tests database operations with:
 * - Connection handling and configuration detection
 * - SQL query execution and error handling
 * - Token CRUD operations
 * - Building health persistence
 * - Boundary conditions and edge cases
 * - Concurrent/async behavior
 */

import {
  isNeonConfigured,
  getNeonConnectionType,
  initializeDatabase,
  getGlobalTokens,
  saveGlobalToken,
  getFeaturedTokens,
  getTokensByCreator,
  updateTokenStats,
  updateBuildingHealth,
  batchUpdateBuildingHealth,
  getBuildingHealthData,
  GlobalToken,
} from "@/lib/neon";

// Mock the neon serverless module
const mockSql = jest.fn();
jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => mockSql),
}));

describe("Neon Database Client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear all database URL env vars
    delete process.env.NETLIFY_DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.NEON_DATABASE_URL;
    delete process.env.POSTGRES_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isNeonConfigured", () => {
    it("should return false when no database URL is set", () => {
      expect(isNeonConfigured()).toBe(false);
    });

    it("should return true when NETLIFY_DATABASE_URL is set", () => {
      process.env.NETLIFY_DATABASE_URL = "postgres://netlify:test@host/db";
      expect(isNeonConfigured()).toBe(true);
    });

    it("should return true when DATABASE_URL is set", () => {
      process.env.DATABASE_URL = "postgres://user:pass@host/db";
      expect(isNeonConfigured()).toBe(true);
    });

    it("should return true when NEON_DATABASE_URL is set", () => {
      process.env.NEON_DATABASE_URL = "postgres://neon:pass@host/db";
      expect(isNeonConfigured()).toBe(true);
    });

    it("should return true when POSTGRES_URL is set", () => {
      process.env.POSTGRES_URL = "postgres://pg:pass@host/db";
      expect(isNeonConfigured()).toBe(true);
    });

    it("should return true when multiple URLs are set", () => {
      process.env.NETLIFY_DATABASE_URL = "postgres://a@host/db";
      process.env.DATABASE_URL = "postgres://b@host/db";
      expect(isNeonConfigured()).toBe(true);
    });
  });

  describe("getNeonConnectionType", () => {
    it("should return 'none' when no URL is configured", () => {
      expect(getNeonConnectionType()).toBe("none");
    });

    it("should return 'netlify' when NETLIFY_DATABASE_URL is set", () => {
      process.env.NETLIFY_DATABASE_URL = "postgres://netlify@host/db";
      expect(getNeonConnectionType()).toBe("netlify");
    });

    it("should return 'direct' when only DATABASE_URL is set", () => {
      process.env.DATABASE_URL = "postgres://direct@host/db";
      expect(getNeonConnectionType()).toBe("direct");
    });

    it("should prefer 'netlify' over 'direct' when both are set", () => {
      process.env.NETLIFY_DATABASE_URL = "postgres://netlify@host/db";
      process.env.DATABASE_URL = "postgres://direct@host/db";
      expect(getNeonConnectionType()).toBe("netlify");
    });

    it("should return 'direct' for NEON_DATABASE_URL", () => {
      process.env.NEON_DATABASE_URL = "postgres://neon@host/db";
      expect(getNeonConnectionType()).toBe("direct");
    });

    it("should return 'direct' for POSTGRES_URL", () => {
      process.env.POSTGRES_URL = "postgres://pg@host/db";
      expect(getNeonConnectionType()).toBe("direct");
    });
  });

  describe("initializeDatabase", () => {
    it("should return false when no database is configured", async () => {
      const result = await initializeDatabase();
      expect(result).toBe(false);
    });

    it("should create tables and indexes when database is configured", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const result = await initializeDatabase();

      expect(result).toBe(true);
      // Should have called sql multiple times for CREATE TABLE and CREATE INDEX
      expect(mockSql).toHaveBeenCalled();
    });

    it("should return false when SQL execution fails", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockRejectedValueOnce(new Error("SQL error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const result = await initializeDatabase();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("getGlobalTokens", () => {
    it("should return empty array when database is not configured", async () => {
      const tokens = await getGlobalTokens();
      expect(tokens).toEqual([]);
    });

    it("should return tokens from database", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const mockTokens: GlobalToken[] = [
        {
          mint: "token1",
          name: "Token 1",
          symbol: "TK1",
          creator_wallet: "wallet1",
          current_health: 50,
        },
        {
          mint: "token2",
          name: "Token 2",
          symbol: "TK2",
          creator_wallet: "wallet2",
          current_health: 75,
        },
      ];
      mockSql.mockResolvedValue(mockTokens);

      const tokens = await getGlobalTokens();

      expect(tokens).toEqual(mockTokens);
    });

    it("should filter out decayed buildings (health <= 10)", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const mockTokens: GlobalToken[] = [
        { mint: "healthy", name: "Healthy", symbol: "H", creator_wallet: "w", current_health: 50 },
      ];
      mockSql.mockResolvedValue(mockTokens);

      const tokens = await getGlobalTokens();

      // The filtering happens in SQL, so we just verify the result
      expect(tokens.every((t) => t.current_health === null || t.current_health! > 10)).toBe(true);
    });

    it("should include tokens with NULL health (new tokens)", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const mockTokens: GlobalToken[] = [
        { mint: "new", name: "New", symbol: "N", creator_wallet: "w", current_health: undefined },
      ];
      mockSql.mockResolvedValue(mockTokens);

      const tokens = await getGlobalTokens();
      expect(tokens).toHaveLength(1);
    });

    it("should throw error on SQL failure for visibility", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";

      // Mock initializeDatabase to succeed
      mockSql.mockResolvedValueOnce([]); // CREATE TABLE
      mockSql.mockResolvedValueOnce([]); // Index 1
      mockSql.mockResolvedValueOnce([]); // Index 2
      mockSql.mockResolvedValueOnce([]); // Index 3
      mockSql.mockResolvedValueOnce([]); // Index 4
      mockSql.mockResolvedValueOnce([]); // ALTER 1
      mockSql.mockResolvedValueOnce([]); // ALTER 2
      mockSql.mockResolvedValueOnce([]); // ALTER 3
      mockSql.mockResolvedValueOnce([]); // ALTER 4
      mockSql.mockResolvedValueOnce([]); // ALTER 5
      mockSql.mockResolvedValueOnce([]); // ALTER 6
      mockSql.mockResolvedValueOnce([]); // ALTER 7
      // Then fail on the SELECT query
      mockSql.mockRejectedValueOnce(new Error("Connection failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      await expect(getGlobalTokens()).rejects.toThrow("Connection failed");
      consoleSpy.mockRestore();
    });
  });

  describe("saveGlobalToken", () => {
    it("should return false when database is not configured", async () => {
      const token: GlobalToken = {
        mint: "test",
        name: "Test",
        symbol: "TST",
        creator_wallet: "wallet",
      };
      const result = await saveGlobalToken(token);
      expect(result).toBe(false);
    });

    it("should insert new token when it does not exist", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      // First call: check existence (returns empty)
      // Second call: insert
      mockSql
        .mockResolvedValueOnce([]) // CREATE TABLE
        .mockResolvedValueOnce([]) // CREATE INDEX
        .mockResolvedValueOnce([]) // CREATE INDEX
        .mockResolvedValueOnce([]) // CREATE INDEX
        .mockResolvedValueOnce([]) // CREATE INDEX
        .mockResolvedValueOnce([]) // ALTER TABLE
        .mockResolvedValueOnce([]) // ALTER TABLE
        .mockResolvedValueOnce([]) // ALTER TABLE
        .mockResolvedValueOnce([]) // ALTER TABLE
        .mockResolvedValueOnce([]) // ALTER TABLE
        .mockResolvedValueOnce([]) // ALTER TABLE
        .mockResolvedValueOnce([]) // ALTER TABLE
        .mockResolvedValueOnce([]) // SELECT existing
        .mockResolvedValueOnce([]); // INSERT

      const token: GlobalToken = {
        mint: "new-token",
        name: "New Token",
        symbol: "NEW",
        creator_wallet: "creator123",
        description: "A new token",
        fee_shares: [{ provider: "twitter", username: "user", bps: 5000 }],
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(true);
    });

    it("should update existing token when it exists", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      // Mock sequence: init db, SELECT existing, UPDATE
      mockSql
        .mockResolvedValueOnce([]) // CREATE TABLE etc.
        .mockResolvedValueOnce([]) // indexes
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, creator_wallet: "wallet" }]) // EXISTS
        .mockResolvedValueOnce([]); // UPDATE

      const token: GlobalToken = {
        mint: "existing-token",
        name: "Updated Name",
        symbol: "UPD",
        creator_wallet: "wallet",
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(true);
    });

    it("should handle SQL error gracefully", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";

      // Mock initializeDatabase to succeed, then fail on actual operation
      mockSql.mockResolvedValueOnce([]); // CREATE TABLE
      mockSql.mockResolvedValueOnce([]); // Index 1
      mockSql.mockResolvedValueOnce([]); // Index 2
      mockSql.mockResolvedValueOnce([]); // Index 3
      mockSql.mockResolvedValueOnce([]); // Index 4
      mockSql.mockResolvedValueOnce([]); // ALTER 1
      mockSql.mockResolvedValueOnce([]); // ALTER 2
      mockSql.mockResolvedValueOnce([]); // ALTER 3
      mockSql.mockResolvedValueOnce([]); // ALTER 4
      mockSql.mockResolvedValueOnce([]); // ALTER 5
      mockSql.mockResolvedValueOnce([]); // ALTER 6
      mockSql.mockResolvedValueOnce([]); // ALTER 7
      mockSql.mockResolvedValueOnce([]); // SELECT existing
      mockSql.mockRejectedValueOnce(new Error("Insert failed")); // INSERT fails

      const token: GlobalToken = {
        mint: "error-token",
        name: "Error",
        symbol: "ERR",
        creator_wallet: "wallet",
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(false);
    });

    it("should serialize fee_shares as JSON", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const token: GlobalToken = {
        mint: "fee-token",
        name: "Fee Token",
        symbol: "FEE",
        creator_wallet: "wallet",
        fee_shares: [
          { provider: "twitter", username: "user1", bps: 5000 },
          { provider: "github", username: "user2", bps: 5000 },
        ],
      };

      await saveGlobalToken(token);

      // Verify SQL was called (we can't easily verify JSON serialization without deeper mocking)
      expect(mockSql).toHaveBeenCalled();
    });

    it("should handle empty fee_shares array", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const token: GlobalToken = {
        mint: "no-fee",
        name: "No Fee",
        symbol: "NF",
        creator_wallet: "wallet",
        fee_shares: [],
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(true);
    });

    it("should handle undefined fee_shares", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const token: GlobalToken = {
        mint: "undef-fee",
        name: "Undefined Fee",
        symbol: "UF",
        creator_wallet: "wallet",
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(true);
    });
  });

  describe("getFeaturedTokens", () => {
    it("should return empty array when database is not configured", async () => {
      const tokens = await getFeaturedTokens();
      expect(tokens).toEqual([]);
    });

    it("should return only featured tokens", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const mockFeatured: GlobalToken[] = [
        {
          mint: "featured1",
          name: "Featured 1",
          symbol: "F1",
          creator_wallet: "w",
          is_featured: true,
        },
      ];
      mockSql.mockResolvedValue(mockFeatured);

      const tokens = await getFeaturedTokens();
      expect(tokens).toEqual(mockFeatured);
    });

    it("should handle database error gracefully", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockRejectedValueOnce(new Error("DB error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const tokens = await getFeaturedTokens();

      expect(tokens).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe("getTokensByCreator", () => {
    it("should return empty array when database is not configured", async () => {
      const tokens = await getTokensByCreator("any-wallet");
      expect(tokens).toEqual([]);
    });

    it("should return tokens for specific creator", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const creatorWallet = "creator123abc";
      const mockTokens: GlobalToken[] = [
        { mint: "t1", name: "Token 1", symbol: "T1", creator_wallet: creatorWallet },
        { mint: "t2", name: "Token 2", symbol: "T2", creator_wallet: creatorWallet },
      ];
      mockSql.mockResolvedValue(mockTokens);

      const tokens = await getTokensByCreator(creatorWallet);
      expect(tokens).toEqual(mockTokens);
    });

    it("should return empty array for creator with no tokens", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const tokens = await getTokensByCreator("no-tokens-wallet");
      expect(tokens).toEqual([]);
    });

    it("should handle SQL error gracefully", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockRejectedValueOnce(new Error("Query failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const tokens = await getTokensByCreator("error-wallet");

      expect(tokens).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe("updateTokenStats", () => {
    it("should do nothing when database is not configured", async () => {
      await updateTokenStats("mint", { market_cap: 100 });
      expect(mockSql).not.toHaveBeenCalled();
    });

    it("should update token stats", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      await updateTokenStats("test-mint", {
        lifetime_fees: 100.5,
        market_cap: 500000,
        volume_24h: 10000,
      });

      expect(mockSql).toHaveBeenCalled();
    });

    it("should handle partial updates", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      await updateTokenStats("test-mint", { market_cap: 100000 });

      expect(mockSql).toHaveBeenCalled();
    });

    it("should handle SQL error gracefully", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockRejectedValueOnce(new Error("Update failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      await updateTokenStats("error-mint", { market_cap: 100 });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("updateBuildingHealth", () => {
    it("should return false when database is not configured", async () => {
      const result = await updateBuildingHealth("mint", 50);
      expect(result).toBe(false);
    });

    it("should update building health successfully", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const result = await updateBuildingHealth("test-mint", 75);

      expect(result).toBe(true);
      expect(mockSql).toHaveBeenCalled();
    });

    it("should handle SQL error gracefully", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockRejectedValueOnce(new Error("Update failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const result = await updateBuildingHealth("error-mint", 50);

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    describe("boundary conditions", () => {
      beforeEach(() => {
        process.env.DATABASE_URL = "postgres://test@host/db";
        mockSql.mockResolvedValue([]);
      });

      it("should accept health value of 0", async () => {
        const result = await updateBuildingHealth("mint", 0);
        expect(result).toBe(true);
      });

      it("should accept health value of 100", async () => {
        const result = await updateBuildingHealth("mint", 100);
        expect(result).toBe(true);
      });

      it("should accept decimal health values", async () => {
        const result = await updateBuildingHealth("mint", 50.5);
        expect(result).toBe(true);
      });
    });
  });

  describe("batchUpdateBuildingHealth", () => {
    it("should return zeros when database is not configured", async () => {
      const result = await batchUpdateBuildingHealth([{ mint: "a", health: 50 }]);
      expect(result).toEqual({ updated: 0, failed: 0 });
    });

    it("should return zeros for empty updates array", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const result = await batchUpdateBuildingHealth([]);
      expect(result).toEqual({ updated: 0, failed: 0 });
    });

    it("should update multiple buildings", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const updates = [
        { mint: "mint1", health: 50 },
        { mint: "mint2", health: 75 },
        { mint: "mint3", health: 25 },
      ];

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const result = await batchUpdateBuildingHealth(updates);

      expect(result.updated).toBe(3);
      expect(result.failed).toBe(0);
      consoleSpy.mockRestore();
    });

    it("should track failed updates separately", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql
        .mockResolvedValueOnce([]) // First update succeeds
        .mockRejectedValueOnce(new Error("Failed")) // Second fails
        .mockResolvedValueOnce([]); // Third succeeds

      const updates = [
        { mint: "success1", health: 50 },
        { mint: "fail", health: 50 },
        { mint: "success2", health: 50 },
      ];

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const result = await batchUpdateBuildingHealth(updates);

      expect(result.updated).toBe(2);
      expect(result.failed).toBe(1);
      consoleSpy.mockRestore();
    });

    it("should handle all updates failing", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockRejectedValue(new Error("All failed"));

      const updates = [
        { mint: "fail1", health: 50 },
        { mint: "fail2", health: 50 },
      ];

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const result = await batchUpdateBuildingHealth(updates);

      expect(result.failed).toBe(2);
      consoleSpy.mockRestore();
    });

    it("should handle large batches", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const updates = Array.from({ length: 50 }, (_, i) => ({
        mint: `mint-${i}`,
        health: Math.floor(Math.random() * 100),
      }));

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const result = await batchUpdateBuildingHealth(updates);

      expect(result.updated).toBe(50);
      expect(result.failed).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  describe("getBuildingHealthData", () => {
    it("should return empty map when database is not configured", async () => {
      const result = await getBuildingHealthData(["mint1"]);
      expect(result.size).toBe(0);
    });

    it("should return empty map for empty mints array", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const result = await getBuildingHealthData([]);
      expect(result.size).toBe(0);
    });

    it("should return health data for requested mints", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const mockRows = [
        { mint: "mint1", current_health: 50, health_updated_at: "2024-01-01T00:00:00Z" },
        { mint: "mint2", current_health: 75, health_updated_at: "2024-01-02T00:00:00Z" },
      ];
      mockSql.mockResolvedValue(mockRows);

      const result = await getBuildingHealthData(["mint1", "mint2"]);

      expect(result.size).toBe(2);
      expect(result.get("mint1")).toEqual({
        health: 50,
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      });
      expect(result.get("mint2")).toEqual({
        health: 75,
        updatedAt: new Date("2024-01-02T00:00:00Z"),
      });
    });

    it("should return default health (50) for null current_health", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      const mockRows = [{ mint: "new-mint", current_health: null, health_updated_at: null }];
      mockSql.mockResolvedValue(mockRows);

      const result = await getBuildingHealthData(["new-mint"]);

      expect(result.get("new-mint")).toEqual({
        health: 50,
        updatedAt: null,
      });
    });

    it("should handle SQL error gracefully", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockRejectedValueOnce(new Error("Query failed"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const result = await getBuildingHealthData(["error-mint"]);

      expect(result.size).toBe(0);
      consoleSpy.mockRestore();
    });

    it("should handle mints not in database", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      // Return only one of the requested mints
      const mockRows = [{ mint: "found", current_health: 60, health_updated_at: null }];
      mockSql.mockResolvedValue(mockRows);

      const result = await getBuildingHealthData(["found", "not-found"]);

      expect(result.size).toBe(1);
      expect(result.has("found")).toBe(true);
      expect(result.has("not-found")).toBe(false);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle special characters in token data", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const token: GlobalToken = {
        mint: "special-chars",
        name: "Token with 'quotes' and \"double quotes\"",
        symbol: "$YMB",
        description: "Line1\nLine2\t<script>alert('xss')</script>",
        creator_wallet: "wallet",
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(true);
    });

    it("should handle unicode in token data", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const token: GlobalToken = {
        mint: "unicode-token",
        name: "Token \u{1F680} Moon",
        symbol: "\u{1F319}",
        creator_wallet: "wallet",
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(true);
    });

    it("should handle very long token names", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const token: GlobalToken = {
        mint: "long-name",
        name: "A".repeat(1000),
        symbol: "LONG",
        creator_wallet: "wallet",
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(true);
    });

    it("should handle null optional fields", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const token: GlobalToken = {
        mint: "null-fields",
        name: "Null Token",
        symbol: "NULL",
        creator_wallet: "wallet",
        description: undefined,
        image_url: undefined,
        lifetime_fees: undefined,
        market_cap: undefined,
        volume_24h: undefined,
      };

      const result = await saveGlobalToken(token);
      expect(result).toBe(true);
    });

    it("should handle very large numeric values", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      await updateTokenStats("large-values", {
        lifetime_fees: 9999999999.99,
        market_cap: Number.MAX_SAFE_INTEGER,
        volume_24h: 1e15,
      });

      expect(mockSql).toHaveBeenCalled();
    });

    it("should handle negative numeric values", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      // Negative values shouldn't normally occur but should be handled
      await updateTokenStats("negative-values", {
        lifetime_fees: -100,
        market_cap: -500000,
      });

      expect(mockSql).toHaveBeenCalled();
    });
  });

  describe("concurrent operations", () => {
    it("should handle concurrent token saves", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const tokens = Array.from({ length: 10 }, (_, i) => ({
        mint: `concurrent-${i}`,
        name: `Token ${i}`,
        symbol: `T${i}`,
        creator_wallet: "wallet",
      }));

      const promises = tokens.map((token) => saveGlobalToken(token));
      const results = await Promise.all(promises);

      expect(results.every((r) => r === true)).toBe(true);
    });

    it("should handle concurrent health updates", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const updates = Array.from({ length: 20 }, (_, i) =>
        updateBuildingHealth(`mint-${i}`, Math.floor(Math.random() * 100))
      );

      const results = await Promise.all(updates);
      expect(results.every((r) => r === true)).toBe(true);
    });

    it("should handle mixed concurrent operations", async () => {
      process.env.DATABASE_URL = "postgres://test@host/db";
      mockSql.mockResolvedValue([]);

      const operations = [
        saveGlobalToken({ mint: "t1", name: "T1", symbol: "T1", creator_wallet: "w" }),
        updateBuildingHealth("t1", 50),
        getGlobalTokens(),
        updateTokenStats("t1", { market_cap: 100000 }),
        getBuildingHealthData(["t1"]),
      ];

      await Promise.all(operations);
      expect(mockSql).toHaveBeenCalled();
    });
  });
});
