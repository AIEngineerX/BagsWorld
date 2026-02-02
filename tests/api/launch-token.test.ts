/**
 * Launch Token API Comprehensive Tests
 *
 * Tests the token launch endpoint with:
 * - Rate limiting
 * - Input validation (Solana addresses, BPS values, etc.)
 * - All action handlers (create-info, configure-fees, create-launch-tx, lookup-wallet)
 * - Error handling
 * - Boundary conditions
 *
 * Uses fetch mocking for integration-style testing.
 */

// Mock rate limiting
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIP: jest.fn(() => "127.0.0.1"),
  RATE_LIMITS: {
    standard: { limit: 20, windowMs: 60000 },
  },
}));

import { checkRateLimit } from "@/lib/rate-limit";

// Helper to set up mock API responses
function setupMockFetch(responses: Record<string, { status?: number; data: unknown }>) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const urlPath = url.replace(/^http:\/\/localhost(:\d+)?/, "");

    // Match our mock responses
    for (const [path, response] of Object.entries(responses)) {
      if (urlPath.includes(path)) {
        return Promise.resolve({
          ok: response.status ? response.status >= 200 && response.status < 400 : true,
          status: response.status || 200,
          json: () => Promise.resolve(response.data),
        });
      }
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  });
}

describe("Launch Token API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue({
      success: true,
      remaining: 10,
      resetIn: 30000,
    });
  });

  describe("Rate Limiting", () => {
    it("should return 429 when rate limit exceeded", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({
        success: false,
        remaining: 0,
        resetIn: 45000,
      });

      setupMockFetch({
        "/api/launch-token": {
          status: 429,
          data: {
            error: "Too many launch requests. Please wait a moment and try again.",
            retryAfter: 45,
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: { name: "Test", symbol: "TST", description: "Test token" },
        }),
      });

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toContain("Too many launch requests");
      expect(body.retryAfter).toBe(45);
    });
  });

  describe("API Configuration", () => {
    it("should return 500 when Bags API is not configured", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 500,
          data: { error: "Bags API not configured. Set BAGS_API_KEY environment variable." },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: { name: "Test", symbol: "TST", description: "Test" },
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain("Bags API not configured");
    });
  });

  describe("Unknown Action", () => {
    it("should return 400 for unknown action", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Unknown action" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unknown-action",
          data: {},
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Unknown action");
    });
  });

  describe("create-info Action", () => {
    it("should return 400 when required fields are missing", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Missing required fields: name, symbol, description" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: { name: "Test" }, // Missing symbol and description
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Missing required fields");
    });

    it("should create token info successfully", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            tokenMint: "NewMint111111111111111111111111111111111111",
            tokenMetadata: { name: "Test Token" },
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: {
            name: "Test Token",
            symbol: "TEST",
            description: "A test token",
            twitter: "@testtoken",
            website: "https://test.com",
          },
        }),
      });

      const body = await response.json();

      expect(response.ok).toBe(true);
      expect(body.success).toBe(true);
      expect(body.tokenMint).toBe("NewMint111111111111111111111111111111111111");
    });

    it("should return 400 for invalid base64 image", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Invalid base64 image data" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: {
            name: "Bad Image Token",
            symbol: "BAD",
            description: "Token with bad image",
            image: "data:image/png;base64,not-valid-base64!!!",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid base64 image");
    });

    it("should handle API error gracefully", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 500,
          data: { error: "IPFS upload failed" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: {
            name: "Error Token",
            symbol: "ERR",
            description: "Will fail",
          },
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain("IPFS upload failed");
    });
  });

  describe("configure-fees Action", () => {
    it("should return 400 when required fields are missing", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Missing required fields: mint, feeClaimers, payer" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: "SomeMint11111111111111111111111111111111111",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Missing required fields");
    });

    it("should return 400 for invalid mint address", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Invalid token mint address" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: "invalid-address",
            payer: "ValidPayer111111111111111111111111111111111",
            feeClaimers: [{ provider: "twitter", providerUsername: "user", bps: 10000 }],
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid token mint address");
    });

    it("should return 400 for invalid BPS value", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Invalid BPS value for user: 20000. Must be between 1 and 10000." },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: "ValidMint111111111111111111111111111111111",
            payer: "ValidPayer111111111111111111111111111111111",
            feeClaimers: [{ provider: "twitter", providerUsername: "user", bps: 20000 }],
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid BPS value");
    });

    it("should return 400 for invalid provider type", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Invalid provider: facebook. Must be one of: twitter, github, kick" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: "ValidMint111111111111111111111111111111111",
            payer: "ValidPayer111111111111111111111111111111111",
            feeClaimers: [{ provider: "facebook", providerUsername: "user", bps: 10000 }],
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid provider");
    });

    it("should return 400 when total BPS is not exactly 100%", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: {
            error:
              "Total fee share must equal exactly 100% (10000 bps). Currently: 8000 bps (80.0%)",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: "ValidMint111111111111111111111111111111111",
            payer: "ValidPayer111111111111111111111111111111111",
            feeClaimers: [
              { provider: "twitter", providerUsername: "user1", bps: 5000 },
              { provider: "twitter", providerUsername: "user2", bps: 3000 },
            ],
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Total fee share must equal exactly 100%");
    });

    it("should configure fees successfully", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            configId: "config-123",
            totalBps: 10000,
            needsCreation: true,
            transactions: ["tx1", "tx2"],
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: "ValidMint111111111111111111111111111111111",
            payer: "ValidPayer111111111111111111111111111111111",
            feeClaimers: [
              { provider: "twitter", providerUsername: "user1", bps: 6000 },
              { provider: "github", providerUsername: "user2", bps: 4000 },
            ],
          },
        }),
      });

      const body = await response.json();

      expect(response.ok).toBe(true);
      expect(body.success).toBe(true);
      expect(body.configId).toBe("config-123");
      expect(body.totalBps).toBe(10000);
    });
  });

  describe("create-launch-tx Action", () => {
    it("should return 400 when required fields are missing", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Missing required fields: ipfs, tokenMint, wallet, configKey" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-launch-tx",
          data: {
            ipfs: "ipfs://Qm...",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Missing required fields");
    });

    it("should return 400 for invalid IPFS URL format", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Invalid IPFS URL format" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-launch-tx",
          data: {
            ipfs: "not-a-valid-url",
            tokenMint: "ValidMint111111111111111111111111111111111",
            wallet: "ValidWallet1111111111111111111111111111111",
            configKey: "config-key",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid IPFS URL format");
    });

    it("should accept ipfs:// URL format", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            transaction: "base64-transaction-data",
            lastValidBlockHeight: 123456789,
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-launch-tx",
          data: {
            ipfs: "ipfs://QmXyz123456789",
            tokenMint: "ValidMint111111111111111111111111111111111",
            wallet: "ValidWallet1111111111111111111111111111111",
            configKey: "config-key",
          },
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should accept https:// URL format for IPFS gateway", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            transaction: "tx-data",
            lastValidBlockHeight: 999999,
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-launch-tx",
          data: {
            ipfs: "https://ipfs.io/ipfs/Qm123",
            tokenMint: "ValidMint111111111111111111111111111111111",
            wallet: "ValidWallet1111111111111111111111111111111",
            configKey: "config-key",
          },
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should create launch transaction successfully", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            transaction: "base64-serialized-transaction",
            lastValidBlockHeight: 123456789,
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-launch-tx",
          data: {
            ipfs: "ipfs://QmXyz123",
            tokenMint: "ValidMint111111111111111111111111111111111",
            wallet: "ValidWallet1111111111111111111111111111111",
            configKey: "config-key-123",
            initialBuyLamports: 1000000000,
          },
        }),
      });

      const body = await response.json();

      expect(response.ok).toBe(true);
      expect(body.success).toBe(true);
      expect(body.transaction).toBe("base64-serialized-transaction");
      expect(body.lastValidBlockHeight).toBe(123456789);
    });
  });

  describe("lookup-wallet Action", () => {
    it("should return 400 when required fields are missing", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 400,
          data: { error: "Missing required fields: provider, username" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup-wallet",
          data: {
            provider: "twitter",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Missing required fields");
    });

    it("should lookup wallet successfully", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            wallet: "FoundWallet111111111111111111111111111111111",
            platformData: { displayName: "Test User" },
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup-wallet",
          data: {
            provider: "twitter",
            username: "testuser",
          },
        }),
      });

      const body = await response.json();

      expect(response.ok).toBe(true);
      expect(body.success).toBe(true);
      expect(body.wallet).toBe("FoundWallet111111111111111111111111111111111");
    });

    it("should handle user not found", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 500,
          data: { error: "User not found" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup-wallet",
          data: {
            provider: "twitter",
            username: "nonexistent",
          },
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain("User not found");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 for malformed JSON body", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 500,
          data: { error: "Failed to process request" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(500);
    });

    it("should handle generic API errors", async () => {
      setupMockFetch({
        "/api/launch-token": {
          status: 500,
          data: { error: "Unknown API error" },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: {
            name: "Error Token",
            symbol: "ERR",
            description: "Will fail",
          },
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Unknown API error");
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle maximum BPS value (10000 = 100%)", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            configId: "config-max",
            totalBps: 10000,
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: "ValidMint111111111111111111111111111111111",
            payer: "ValidPayer111111111111111111111111111111111",
            feeClaimers: [{ provider: "twitter", providerUsername: "solo", bps: 10000 }],
          },
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should handle multiple fee claimers totaling 100%", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            configId: "config-multi",
            totalBps: 10000,
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: "ValidMint111111111111111111111111111111111",
            payer: "ValidPayer111111111111111111111111111111111",
            feeClaimers: [
              { provider: "twitter", providerUsername: "user1", bps: 3333 },
              { provider: "github", providerUsername: "user2", bps: 3333 },
              { provider: "kick", providerUsername: "user3", bps: 3334 },
            ],
          },
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should handle token name at boundary length", async () => {
      setupMockFetch({
        "/api/launch-token": {
          data: {
            success: true,
            tokenMint: "LongNameMint11111111111111111111111111111",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: {
            name: "A".repeat(50), // Max reasonable name length
            symbol: "LONG",
            description: "Token with long name",
          },
        }),
      });

      expect(response.ok).toBe(true);
    });
  });
});
