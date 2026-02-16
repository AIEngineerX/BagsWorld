// Mock BEFORE importing route (jest hoists these to the top)
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIP: jest.fn(() => "127.0.0.1"),
  RATE_LIMITS: { strict: { limit: 10, windowMs: 60000 } },
}));

jest.mock("@/lib/sol-incinerator", () => ({
  getSolIncinerator: jest.fn(),
}));

jest.mock("@/lib/env-utils", () => ({
  isValidSolanaAddress: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
      headers: init?.headers || {},
    }),
  },
}));

import { POST } from "@/app/api/sol-incinerator/route";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { getSolIncinerator } from "@/lib/sol-incinerator";
import { isValidSolanaAddress } from "@/lib/env-utils";

const VALID_PK = "4CsWE4mhp5LQDATR25sauR6umW21NQFLEsj27rSP1Muf";

// --- Helpers ---

function createMockRequest(body: object): any {
  return {
    json: async () => body,
    headers: new Map([["x-forwarded-for", "127.0.0.1"]]),
  };
}

function createMockClient() {
  return {
    burn: jest.fn().mockResolvedValue({ result: "burn-ok" }),
    close: jest.fn().mockResolvedValue({ result: "close-ok" }),
    batchCloseAll: jest.fn().mockResolvedValue({ result: "batch-close-all-ok" }),
    burnPreview: jest.fn().mockResolvedValue({ result: "burn-preview-ok" }),
    closePreview: jest.fn().mockResolvedValue({ result: "close-preview-ok" }),
    batchCloseAllPreview: jest.fn().mockResolvedValue({ result: "batch-close-all-preview-ok" }),
    status: jest.fn().mockResolvedValue({ status: "operational" }),
  };
}

// --- Test Suite ---

describe("POST /api/sol-incinerator", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = createMockClient();

    // Defaults: rate limit passes, address is valid, client is available
    (checkRateLimit as jest.Mock).mockResolvedValue({ success: true });
    (getSolIncinerator as jest.Mock).mockReturnValue(mockClient);
    (isValidSolanaAddress as jest.Mock).mockReturnValue(true);
  });

  // =========================================================================
  // 1. Rate limiting
  // =========================================================================
  describe("rate limiting", () => {
    it("returns 429 with Retry-After header when rate limited", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({
        success: false,
        resetIn: 45000,
      });

      const req = createMockRequest({ action: "status" });
      const res = await POST(req);

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain("Too many requests");
      expect(res.headers["Retry-After"]).toBeDefined();
    });

    it("proceeds normally when rate limit passes", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({ success: true });

      const req = createMockRequest({ action: "status" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("operational");
    });

    it("Retry-After header value is computed from resetIn (ceiling of seconds)", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({
        success: false,
        resetIn: 7500, // 7.5 seconds -> ceil -> "8"
      });

      const req = createMockRequest({ action: "status" });
      const res = await POST(req);

      expect(res.headers["Retry-After"]).toBe("8");
    });
  });

  // =========================================================================
  // 2. Input validation
  // =========================================================================
  describe("input validation", () => {
    it("returns 400 when userPublicKey is missing", async () => {
      const req = createMockRequest({ action: "burn", data: {} });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("userPublicKey is required");
    });

    it("returns 400 for invalid Solana address", async () => {
      (isValidSolanaAddress as jest.Mock).mockReturnValue(false);

      const req = createMockRequest({
        action: "burn",
        data: { userPublicKey: "not-a-valid-address", assetId: "someAsset" },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid userPublicKey address");
    });

    it("returns 400 for burn without assetId", async () => {
      const req = createMockRequest({
        action: "burn",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("burn");
      expect(body.error).toContain("assetId is required");
    });

    it("returns 400 for close without assetId", async () => {
      const req = createMockRequest({
        action: "close",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("close");
      expect(body.error).toContain("assetId is required");
    });

    it("returns 400 for burn-preview without assetId", async () => {
      const req = createMockRequest({
        action: "burn-preview",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("assetId is required");
    });

    it("returns 400 for close-preview without assetId", async () => {
      const req = createMockRequest({
        action: "close-preview",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("assetId is required");
    });

    it("batch-close-all does NOT require assetId (should succeed)", async () => {
      const req = createMockRequest({
        action: "batch-close-all",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.result).toBe("batch-close-all-ok");
    });

    it("returns 400 with 'Unknown action' for unrecognized action", async () => {
      const req = createMockRequest({
        action: "self-destruct",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Unknown action");
    });
  });

  // =========================================================================
  // 3. Happy path for each action
  // =========================================================================
  describe("happy path actions", () => {
    it("status: calls client.status() and returns result", async () => {
      mockClient.status.mockResolvedValue({ status: "all-good" });

      const req = createMockRequest({ action: "status" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.status).toHaveBeenCalledTimes(1);
      const body = await res.json();
      expect(body.status).toBe("all-good");
    });

    it("burn: calls client.burn() with correct params and returns result", async () => {
      mockClient.burn.mockResolvedValue({ txHash: "abc123" });

      const req = createMockRequest({
        action: "burn",
        data: { userPublicKey: VALID_PK, assetId: "asset123" },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.burn).toHaveBeenCalledWith({
        userPublicKey: VALID_PK,
        assetId: "asset123",
        feePayer: undefined,
        autoCloseTokenAccounts: undefined,
        priorityFeeMicroLamports: undefined,
        burnAmount: undefined,
      });
      const body = await res.json();
      expect(body.txHash).toBe("abc123");
    });

    it("close: calls client.close() with correct params and returns result", async () => {
      mockClient.close.mockResolvedValue({ closed: true });

      const req = createMockRequest({
        action: "close",
        data: { userPublicKey: VALID_PK, assetId: "asset456" },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.close).toHaveBeenCalledWith({
        userPublicKey: VALID_PK,
        assetId: "asset456",
        feePayer: undefined,
        priorityFeeMicroLamports: undefined,
      });
      const body = await res.json();
      expect(body.closed).toBe(true);
    });

    it("batch-close-all: calls client.batchCloseAll() with pk and returns result", async () => {
      mockClient.batchCloseAll.mockResolvedValue({ accountsClosed: 5 });

      const req = createMockRequest({
        action: "batch-close-all",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.batchCloseAll).toHaveBeenCalledWith({
        userPublicKey: VALID_PK,
        feePayer: undefined,
        priorityFeeMicroLamports: undefined,
      });
      const body = await res.json();
      expect(body.accountsClosed).toBe(5);
    });

    it("burn-preview: calls client.burnPreview() with correct params and returns result", async () => {
      mockClient.burnPreview.mockResolvedValue({ lamportsReclaimed: 1000 });

      const req = createMockRequest({
        action: "burn-preview",
        data: { userPublicKey: VALID_PK, assetId: "asset789" },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.burnPreview).toHaveBeenCalledWith({
        userPublicKey: VALID_PK,
        assetId: "asset789",
        autoCloseTokenAccounts: undefined,
        burnAmount: undefined,
      });
      const body = await res.json();
      expect(body.lamportsReclaimed).toBe(1000);
    });

    it("close-preview: calls client.closePreview() and returns result", async () => {
      mockClient.closePreview.mockResolvedValue({ solanaReclaimed: 0.002 });

      const req = createMockRequest({
        action: "close-preview",
        data: { userPublicKey: VALID_PK, assetId: "assetABC" },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.closePreview).toHaveBeenCalledWith({
        userPublicKey: VALID_PK,
        assetId: "assetABC",
      });
      const body = await res.json();
      expect(body.solanaReclaimed).toBe(0.002);
    });

    it("batch-close-all-preview: calls client.batchCloseAllPreview() and returns result", async () => {
      mockClient.batchCloseAllPreview.mockResolvedValue({ accountsToClose: 12 });

      const req = createMockRequest({
        action: "batch-close-all-preview",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.batchCloseAllPreview).toHaveBeenCalledWith({
        userPublicKey: VALID_PK,
      });
      const body = await res.json();
      expect(body.accountsToClose).toBe(12);
    });
  });

  // =========================================================================
  // 4. Parameter passthrough
  // =========================================================================
  describe("parameter passthrough", () => {
    it("burn passes optional feePayer, autoCloseTokenAccounts, priorityFeeMicroLamports, burnAmount", async () => {
      const req = createMockRequest({
        action: "burn",
        data: {
          userPublicKey: VALID_PK,
          assetId: "assetXYZ",
          feePayer: "payerWallet123",
          autoCloseTokenAccounts: true,
          priorityFeeMicroLamports: 5000,
          burnAmount: 100,
        },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.burn).toHaveBeenCalledWith({
        userPublicKey: VALID_PK,
        assetId: "assetXYZ",
        feePayer: "payerWallet123",
        autoCloseTokenAccounts: true,
        priorityFeeMicroLamports: 5000,
        burnAmount: 100,
      });
    });

    it("close passes optional feePayer and priorityFeeMicroLamports", async () => {
      const req = createMockRequest({
        action: "close",
        data: {
          userPublicKey: VALID_PK,
          assetId: "assetClose",
          feePayer: "feePayerAddr",
          priorityFeeMicroLamports: 2500,
        },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockClient.close).toHaveBeenCalledWith({
        userPublicKey: VALID_PK,
        assetId: "assetClose",
        feePayer: "feePayerAddr",
        priorityFeeMicroLamports: 2500,
      });
    });
  });

  // =========================================================================
  // 5. Error handling
  // =========================================================================
  describe("error handling", () => {
    it("returns 503 when getSolIncinerator throws 'SOL_INCINERATOR_API_KEY not configured'", async () => {
      (getSolIncinerator as jest.Mock).mockImplementation(() => {
        throw new Error("SOL_INCINERATOR_API_KEY not configured");
      });

      const req = createMockRequest({ action: "status" });
      const res = await POST(req);

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toContain("not configured");
      expect(body.error).toContain("API key missing");
    });

    it("returns 429 with Retry-After: 30 when client throws 'max usage reached'", async () => {
      mockClient.burn.mockRejectedValue(new Error("max usage reached"));

      const req = createMockRequest({
        action: "burn",
        data: { userPublicKey: VALID_PK, assetId: "assetErr" },
      });
      const res = await POST(req);

      expect(res.status).toBe(429);
      expect(res.headers["Retry-After"]).toBe("30");
      const body = await res.json();
      expect(body.error).toContain("at capacity");
    });

    it("returns 429 when client throws error containing '-32429'", async () => {
      mockClient.close.mockRejectedValue(new Error("RPC error code -32429: rate limited"));

      const req = createMockRequest({
        action: "close",
        data: { userPublicKey: VALID_PK, assetId: "assetRpc" },
      });
      const res = await POST(req);

      expect(res.status).toBe(429);
      expect(res.headers["Retry-After"]).toBe("30");
    });

    it("returns 429 when client throws error containing 'at capacity'", async () => {
      mockClient.batchCloseAll.mockRejectedValue(new Error("server at capacity, try later"));

      const req = createMockRequest({
        action: "batch-close-all",
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(429);
      expect(res.headers["Retry-After"]).toBe("30");
    });

    it("returns 500 with error message for generic errors, and calls console.error", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockClient.burn.mockRejectedValue(new Error("Something unexpected happened"));

      const req = createMockRequest({
        action: "burn",
        data: { userPublicKey: VALID_PK, assetId: "assetGeneric" },
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Something unexpected happened");
      expect(consoleSpy).toHaveBeenCalledWith(
        "[Sol Incinerator API]",
        "Something unexpected happened"
      );

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // 6. Edge cases
  // =========================================================================
  describe("edge cases", () => {
    it("status action does not require userPublicKey or data", async () => {
      const req = createMockRequest({ action: "status" });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("operational");
      // isValidSolanaAddress should NOT have been called
      expect(isValidSolanaAddress).not.toHaveBeenCalled();
    });

    it("returns 500 when request.json() throws (malformed body)", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const req = {
        json: async () => {
          throw new Error("Unexpected token < in JSON");
        },
        headers: new Map([["x-forwarded-for", "127.0.0.1"]]),
      };

      const res = await POST(req as any);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("Unexpected token");

      consoleSpy.mockRestore();
    });

    it("returns 400 'Unknown action' when action is undefined/null", async () => {
      const req = createMockRequest({
        action: undefined,
        data: { userPublicKey: VALID_PK },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Unknown action");
    });

    it("returns 500 with 'Internal server error' when non-Error is thrown by client", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockClient.burn.mockRejectedValue("string error, not an Error instance");

      const req = createMockRequest({
        action: "burn",
        data: { userPublicKey: VALID_PK, assetId: "assetNonError" },
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // 7. isValidSolanaAddress integration
  // =========================================================================
  describe("isValidSolanaAddress integration", () => {
    it("is called with the exact value from data.userPublicKey", async () => {
      const specificKey = "SpecificKeyPassedByUser12345678901234567890ab";

      const req = createMockRequest({
        action: "burn",
        data: { userPublicKey: specificKey, assetId: "someAsset" },
      });
      await POST(req);

      expect(isValidSolanaAddress).toHaveBeenCalledWith(specificKey);
    });

    it("is NOT called for status action", async () => {
      const req = createMockRequest({ action: "status" });
      await POST(req);

      expect(isValidSolanaAddress).not.toHaveBeenCalled();
    });
  });
});
