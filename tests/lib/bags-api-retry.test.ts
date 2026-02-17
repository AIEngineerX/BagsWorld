/**
 * Tests for retry logic in BagsApiClient.createLaunchTransaction and createFeeShareConfig.
 *
 * These test the actual retry paths with mocked fetch, not the API route handler.
 */

import { BagsApiClient } from "@/lib/bags-api";

// Save original fetch
const originalFetch = global.fetch;

describe("BagsApiClient retry logic", () => {
  let client: BagsApiClient;

  beforeEach(() => {
    client = new BagsApiClient("test-api-key");
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  const launchData = {
    ipfs: "ipfs://QmTest",
    tokenMint: "TestMint111111111111111111111111111111111111",
    wallet: "TestWallet11111111111111111111111111111111111",
    initialBuyLamports: 0,
    configKey: "config-key-123",
  };

  describe("createLaunchTransaction", () => {
    it("should retry on 500 and succeed on second attempt", async () => {
      let callCount = 0;
      global.fetch = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            text: () => Promise.resolve("Internal Server Error"),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                success: true,
                response: "A".repeat(200), // long enough to pass length check
              })
            ),
        } as Response);
      });

      const result = await client.createLaunchTransaction(launchData);
      expect(result.transaction).toBe("A".repeat(200));
      expect(callCount).toBe(2);
    });

    it("should throw after exhausting retries on persistent 500", async () => {
      // 3 retries with exponential backoff: 1s + 2s + 4s = 7s minimum
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve("Server down"),
        } as Response)
      );

      await expect(client.createLaunchTransaction(launchData)).rejects.toThrow(
        "API error 500: Server down"
      );
      // 1 initial + 3 retries = 4 total calls
      expect(global.fetch).toHaveBeenCalledTimes(4);
    }, 15000);

    it("should not retry on 4xx errors", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: () => Promise.resolve("Invalid input"),
        } as Response)
      );

      await expect(client.createLaunchTransaction(launchData)).rejects.toThrow(
        "API error 400: Invalid input"
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on network TypeError", async () => {
      let callCount = 0;
      global.fetch = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new TypeError("fetch failed"));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                success: true,
                response: "B".repeat(200),
              })
            ),
        } as Response);
      });

      const result = await client.createLaunchTransaction(launchData);
      expect(result.transaction).toBe("B".repeat(200));
      expect(callCount).toBe(2);
    });

    it("should parse primary API format (response as string) first", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                success: true,
                response: "C".repeat(200),
              })
            ),
        } as Response)
      );

      const result = await client.createLaunchTransaction(launchData);
      expect(result.transaction).toBe("C".repeat(200));
    });
  });

  describe("createFeeShareConfig", () => {
    const feeClaimers = [
      { provider: "solana", providerUsername: "SomeWallet1111111111111111111111111111111111", bps: 10000 },
    ];

    it("should retry on 500 and succeed on second attempt", async () => {
      let callCount = 0;
      global.fetch = jest.fn((url: string) => {
        // Wallet lookup (bulkWalletLookup) won't be called for solana provider
        if (typeof url === "string" && url.includes("/fee-share/config")) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: false,
              status: 502,
              statusText: "Bad Gateway",
              text: () => Promise.resolve("Bad Gateway"),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  response: {
                    meteoraConfigKey: "config-abc-123",
                    totalBps: 10000,
                  },
                })
              ),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, response: [] }),
        } as Response);
      });

      const result = await client.createFeeShareConfig(
        "TestMint11111111111111111111111111111111111",
        feeClaimers,
        "PayerWallet1111111111111111111111111111111"
      );
      expect(result.configId).toBe("config-abc-123");
      expect(callCount).toBe(2);
    });

    it("should not retry on 400", async () => {
      let callCount = 0;
      global.fetch = jest.fn((url: string) => {
        if (typeof url === "string" && url.includes("/fee-share/config")) {
          callCount++;
          return Promise.resolve({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            text: () => Promise.resolve("Invalid claimers"),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, response: [] }),
        } as Response);
      });

      await expect(
        client.createFeeShareConfig(
          "TestMint11111111111111111111111111111111111",
          feeClaimers,
          "PayerWallet1111111111111111111111111111111"
        )
      ).rejects.toThrow("Fee config API error 400");
      expect(callCount).toBe(1);
    });
  });
});

describe("configId type safety", () => {
  let client: BagsApiClient;

  beforeEach(() => {
    client = new BagsApiClient("test-api-key");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should reject non-string id fields", async () => {
    global.fetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("/fee-share/config")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                response: {
                  id: 12345, // numeric DB id — should NOT match
                  config: { nested: "object" }, // object — should NOT match
                  totalBps: 10000,
                },
              })
            ),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, response: [] }),
      } as Response);
    });

    const feeClaimers = [
      { provider: "solana", providerUsername: "Wallet111111111111111111111111111111111111111", bps: 10000 },
    ];

    await expect(
      client.createFeeShareConfig(
        "TestMint11111111111111111111111111111111111",
        feeClaimers,
        "PayerWallet1111111111111111111111111111111"
      )
    ).rejects.toThrow("No configKey in fee share response");
  });

  it("should accept string id field as fallback", async () => {
    global.fetch = jest.fn((url: string) => {
      if (typeof url === "string" && url.includes("/fee-share/config")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                response: {
                  id: "valid-config-string-id",
                  totalBps: 10000,
                },
              })
            ),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, response: [] }),
      } as Response);
    });

    const feeClaimers = [
      { provider: "solana", providerUsername: "Wallet111111111111111111111111111111111111111", bps: 10000 },
    ];

    const result = await client.createFeeShareConfig(
      "TestMint11111111111111111111111111111111111",
      feeClaimers,
      "PayerWallet1111111111111111111111111111111"
    );
    expect(result.configId).toBe("valid-config-string-id");
  });
});
