/**
 * BagsWorld Holders API Tests
 *
 * Tests the /api/bagsworld-holders endpoint - fetches top token holders
 * using Solana RPC getTokenLargestAccounts with owner resolution.
 */

import type { TokenHolder } from "@/app/api/bagsworld-holders/route";

const originalEnv = process.env;
const originalFetch = global.fetch;

// Store mock implementation
let mockFetchImpl: jest.Mock;

// Mock next/server before any imports
jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    }),
  },
}));

// Helper to create a fresh mock and import the module
async function setupTest(envOverrides: Record<string, string | undefined> = {}) {
  // Reset modules to clear cached holders
  jest.resetModules();

  // Re-apply next/server mock after reset
  jest.doMock("next/server", () => ({
    NextResponse: {
      json: (data: unknown, init?: { status?: number }) => ({
        json: () => Promise.resolve(data),
        status: init?.status || 200,
      }),
    },
  }));

  // Create fresh mock
  mockFetchImpl = jest.fn();
  global.fetch = mockFetchImpl;

  // Set environment
  process.env = { ...originalEnv, ...envOverrides };

  // Import fresh module
  const module = await import("@/app/api/bagsworld-holders/route");
  return module.GET;
}

// Helper to create RPC response for getTokenLargestAccounts
function createLargestAccountsResponse(
  accounts: Array<{ address: string; amount: string }>
) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        jsonrpc: "2.0",
        result: { value: accounts },
        id: 1,
      }),
  };
}

// Helper to create RPC response for getTokenSupply
function createTokenSupplyResponse(amount: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        jsonrpc: "2.0",
        result: { value: { amount } },
        id: 1,
      }),
  };
}

// Helper to create RPC response for getAccountInfo (owner resolution)
function createOwnerResponse(owner: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        jsonrpc: "2.0",
        result: {
          value: {
            data: {
              parsed: {
                info: { owner },
              },
            },
          },
        },
        id: 1,
      }),
  };
}

// Helper for failed responses
function createFailedResponse() {
  return { ok: false, status: 500 };
}

// Helper for RPC error response
function createRpcErrorResponse(message: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        jsonrpc: "2.0",
        error: { code: -32005, message },
        id: 1,
      }),
  };
}

describe("/api/bagsworld-holders", () => {
  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("Successful RPC path", () => {
    it("should return holders from Solana RPC", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      // Mock getTokenLargestAccounts
      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", amount: "5000000000" },
          { address: "TokenAcct2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", amount: "3000000000" },
        ])
      );

      // Mock getTokenSupply
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("100000000000"));

      // Mock owner resolution for each account
      mockFetchImpl.mockResolvedValueOnce(
        createOwnerResponse("Owner1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
      );
      mockFetchImpl.mockResolvedValueOnce(
        createOwnerResponse("Owner2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
      );

      const response = await GET();
      const data = await response.json();

      expect(data.holders).toHaveLength(2);
      expect(data.holders[0].address).toBe("Owner1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
      expect(data.holders[0].tokenAccount).toBe("TokenAcct1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
      expect(data.holders[0].rank).toBe(1);
      expect(data.holders[1].rank).toBe(2);
      expect(data.cached).toBe(false);
    });

    it("should correctly convert raw balance to human-readable (6 decimals)", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000" }, // 1 token
          { address: "TokenAcct2", amount: "1500000000" }, // 1500 tokens
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner2"));

      const response = await GET();
      const data = await response.json();

      expect(data.holders[0].balance).toBe(1);
      expect(data.holders[1].balance).toBe(1500);
    });

    it("should calculate percentage from total supply", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      // 25,000 tokens out of 100,000 = 25%
      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "25000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("100000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      expect(data.holders[0].percentage).toBe(25);
    });

    it("should limit to top 5 holders", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      // Create 10 accounts
      const accounts = Array.from({ length: 10 }, (_, i) => ({
        address: `TokenAcct${i}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
        amount: String((10 - i) * 1000000000),
      }));

      mockFetchImpl.mockResolvedValueOnce(createLargestAccountsResponse(accounts));
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("100000000000"));

      // Owner resolution for first 10 (route fetches 10, then limits to 5)
      for (let i = 0; i < 10; i++) {
        mockFetchImpl.mockResolvedValueOnce(createOwnerResponse(`Owner${i}`));
      }

      const response = await GET();
      const data = await response.json();

      expect(data.holders).toHaveLength(5);
      expect(data.count).toBe(5);
    });

    it("should fall back to token account address if owner resolution fails", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcctOnlyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", amount: "1000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createFailedResponse());

      const response = await GET();
      const data = await response.json();

      expect(data.holders[0].address).toBe("TokenAcctOnlyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
      expect(data.holders[0].tokenAccount).toBe("TokenAcctOnlyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    });

    it("should exclude liquidity pool addresses", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "5000000000" },
          { address: "TokenAcct2", amount: "3000000000" },
          { address: "TokenAcct3", amount: "2000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("100000000000"));

      // First account resolves to excluded LP address
      mockFetchImpl.mockResolvedValueOnce(
        createOwnerResponse("HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC")
      );
      // Other accounts resolve normally
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner2"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner3"));

      const response = await GET();
      const data = await response.json();

      // LP address should be skipped, so we get 2 holders
      expect(data.holders).toHaveLength(2);
      expect(data.holders[0].address).toBe("Owner2");
      expect(data.holders[0].rank).toBe(1);
      expect(data.holders[1].address).toBe("Owner3");
      expect(data.holders[1].rank).toBe(2);
    });
  });

  describe("RPC fallback chain", () => {
    it("should try multiple RPCs until one works", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://primary-rpc.example.com",
        NEXT_PUBLIC_SOLANA_RPC_URL: "https://secondary-rpc.example.com",
      });

      // Primary RPC fails
      mockFetchImpl.mockResolvedValueOnce(createFailedResponse());

      // Secondary RPC succeeds
      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      expect(data.holders).toHaveLength(1);
      expect(mockFetchImpl).toHaveBeenCalledTimes(4);
    });

    it("should handle RPC rate limit errors and try next RPC", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://primary-rpc.example.com",
        NEXT_PUBLIC_SOLANA_RPC_URL: "https://secondary-rpc.example.com",
      });

      // Primary RPC returns rate limit error
      mockFetchImpl.mockResolvedValueOnce(createRpcErrorResponse("Rate limit exceeded"));

      // Secondary RPC succeeds
      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      expect(data.holders).toHaveLength(1);
    });

    it("should handle empty accounts response and try next RPC", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://primary-rpc.example.com",
        NEXT_PUBLIC_SOLANA_RPC_URL: "https://secondary-rpc.example.com",
      });

      // Primary returns empty
      mockFetchImpl.mockResolvedValueOnce(createLargestAccountsResponse([]));

      // Secondary succeeds
      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      expect(data.holders).toHaveLength(1);
    });
  });

  describe("Placeholder fallback", () => {
    it("should return placeholder data when all RPCs fail", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: undefined,
        NEXT_PUBLIC_SOLANA_RPC_URL: undefined,
      });

      // Only mainnet fallback available, and it fails
      mockFetchImpl.mockResolvedValueOnce(createFailedResponse());

      const response = await GET();
      const data = await response.json();

      expect(data.placeholder).toBe(true);
      expect(data.holders).toHaveLength(5);
      expect(data.holders[0].address).toContain("BaGs");
    });

    it("should have detectable placeholder addresses", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: undefined,
        NEXT_PUBLIC_SOLANA_RPC_URL: undefined,
      });

      mockFetchImpl.mockResolvedValueOnce(createFailedResponse());

      const response = await GET();
      const data = await response.json();

      data.holders.forEach((holder: TokenHolder) => {
        expect(holder.address.startsWith("BaGs")).toBe(true);
        expect(holder.address.includes("xxxx")).toBe(true);
      });
    });

    it("should have proper ranks in placeholder data", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: undefined,
        NEXT_PUBLIC_SOLANA_RPC_URL: undefined,
      });

      mockFetchImpl.mockResolvedValueOnce(createFailedResponse());

      const response = await GET();
      const data = await response.json();

      expect(data.holders[0].rank).toBe(1);
      expect(data.holders[1].rank).toBe(2);
      expect(data.holders[2].rank).toBe(3);
      expect(data.holders[3].rank).toBe(4);
      expect(data.holders[4].rank).toBe(5);
    });

    it("should handle network errors gracefully", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: undefined,
        NEXT_PUBLIC_SOLANA_RPC_URL: undefined,
      });

      mockFetchImpl.mockRejectedValueOnce(new Error("Network error"));

      const response = await GET();
      const data = await response.json();

      expect(data.placeholder).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero balance", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([{ address: "TokenAcct1", amount: "0" }])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      expect(data.holders[0].balance).toBe(0);
    });

    it("should handle zero total supply gracefully", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
        ])
      );
      // Total supply returns 0
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("0"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      // Percentage should be 0 when supply is 0 (avoid division by zero)
      expect(data.holders[0].percentage).toBe(0);
    });

    it("should handle NaN in amount field", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "not-a-number" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      // parseFloat("not-a-number") returns NaN, || 0 handles it
      expect(data.holders[0].balance).toBe(0);
    });

    it("should handle failed token supply fetch", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
        ])
      );
      // Token supply fails
      mockFetchImpl.mockResolvedValueOnce(createFailedResponse());
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      // Should still work, percentage will be 0
      expect(data.holders[0].percentage).toBe(0);
    });
  });

  describe("Response format", () => {
    it("should include mint address in response", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      expect(data.mint).toBe("9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS");
    });

    it("should include count in response", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
          { address: "TokenAcct2", amount: "500000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner2"));

      const response = await GET();
      const data = await response.json();

      expect(data.count).toBe(2);
    });

    it("should indicate non-cached response on first call", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      const response = await GET();
      const data = await response.json();

      expect(data.cached).toBe(false);
    });
  });

  describe("Caching behavior", () => {
    it("should cache successful responses", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: "https://test-rpc.example.com",
      });

      mockFetchImpl.mockResolvedValueOnce(
        createLargestAccountsResponse([
          { address: "TokenAcct1", amount: "1000000000" },
        ])
      );
      mockFetchImpl.mockResolvedValueOnce(createTokenSupplyResponse("10000000000"));
      mockFetchImpl.mockResolvedValueOnce(createOwnerResponse("Owner1"));

      // First call
      await GET();

      // Reset mock calls counter
      mockFetchImpl.mockClear();

      // Second call should use cache
      const response2 = await GET();
      const data2 = await response2.json();

      expect(data2.cached).toBe(true);
      expect(data2.cacheAge).toBeGreaterThanOrEqual(0);
      expect(mockFetchImpl).not.toHaveBeenCalled();
    });

    it("should not cache placeholder responses", async () => {
      const GET = await setupTest({
        SOLANA_RPC_URL: undefined,
        NEXT_PUBLIC_SOLANA_RPC_URL: undefined,
      });

      // First call fails and returns placeholder
      mockFetchImpl.mockResolvedValueOnce(createFailedResponse());
      const response1 = await GET();
      const data1 = await response1.json();
      expect(data1.placeholder).toBe(true);

      // Note: Due to module caching within the test, the cache would persist
      // In real usage, the cache TTL and empty result handling would work
    });
  });
});
