/**
 * Trade API Tests
 *
 * Tests the actual route handler code with:
 * - Real GET and POST handlers imported directly
 * - External dependencies mocked at module level
 * - Actual business logic executed and verified
 */

// Mock external dependencies BEFORE importing route
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIP: jest.fn(() => "127.0.0.1"),
  RATE_LIMITS: {
    standard: { limit: 30, windowMs: 60000 },
    ai: { limit: 10, windowMs: 60000 },
  },
}));

jest.mock("@/lib/bags-api-server", () => ({
  getServerBagsApiOrNull: jest.fn(),
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

import { GET, POST } from "@/app/api/trade/route";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { getServerBagsApiOrNull } from "@/lib/bags-api-server";

// Create mock request
function createMockRequest(
  url: string,
  options: { method?: string; body?: object; headers?: Record<string, string> } = {}
): any {
  const parsedUrl = new URL(url);
  return {
    url,
    nextUrl: parsedUrl,
    json: async () => options.body || {},
    headers: new Map(Object.entries(options.headers || {})),
  };
}

// Mock BagsApiClient methods
const mockBagsApi = {
  getTradeQuote: jest.fn(),
  createSwapTransaction: jest.fn(),
};

describe("Trade API - Actual Route Handler Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue({
      success: true,
      remaining: 25,
      resetIn: 30000,
    });
    (getServerBagsApiOrNull as jest.Mock).mockReturnValue(mockBagsApi);
    mockBagsApi.getTradeQuote.mockReset();
    mockBagsApi.createSwapTransaction.mockReset();
  });

  describe("GET /api/trade - SOL Mint", () => {
    it("should return SOL mint address", async () => {
      const SOL_MINT = "So11111111111111111111111111111111111111112";

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.solMint).toBe(SOL_MINT);
    });
  });

  describe("POST /api/trade - Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({
        success: false,
        remaining: 0,
        resetIn: 30000,
      });

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: { inputMint: "SOL", outputMint: "TEST", amount: 1000000000 },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many");
      expect(data.retryAfter).toBeDefined();
    });

    it("should allow requests within rate limit", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        inAmount: "1000000000",
        outAmount: "5000000000",
      });

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: {
            inputMint: "So11111111111111111111111111111111111111112",
            outputMint: "TokenMint1234567890123456789012345",
            amount: 1000000000,
          },
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("POST /api/trade - Quote Action", () => {
    it("should return quote for valid input", async () => {
      const mockQuote = {
        inAmount: "1000000000",
        outAmount: "5000000000",
        minOutAmount: "4750000000",
        priceImpactPct: "0.5",
        routePlan: [{ venue: "Raydium" }],
      };
      mockBagsApi.getTradeQuote.mockResolvedValue(mockQuote);

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: {
            inputMint: "So11111111111111111111111111111111111111112",
            outputMint: "TokenMint123456789012345678901234",
            amount: 1000000000,
            slippageBps: 50,
          },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.quote).toEqual(mockQuote);
      expect(mockBagsApi.getTradeQuote).toHaveBeenCalledWith(
        "So11111111111111111111111111111111111111112",
        "TokenMint123456789012345678901234",
        1000000000,
        50
      );
    });

    it("should return 400 for missing inputMint", async () => {
      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: { outputMint: "TEST", amount: 1000 },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required");
    });

    it("should return 400 for missing outputMint", async () => {
      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: { inputMint: "SOL", amount: 1000 },
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should return 400 for missing amount", async () => {
      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: { inputMint: "SOL", outputMint: "TEST" },
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should use default slippage (50 bps) when not provided", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({ inAmount: "1000" });

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: { inputMint: "SOL", outputMint: "TEST", amount: 1000 },
        },
      });

      await POST(request);

      // Verify default slippage of 50 bps was used
      expect(mockBagsApi.getTradeQuote).toHaveBeenCalledWith(
        "SOL",
        "TEST",
        1000,
        50 // Default slippage
      );
    });

    it("should handle quote errors gracefully", async () => {
      mockBagsApi.getTradeQuote.mockRejectedValue(new Error("No route found"));

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: { inputMint: "SOL", outputMint: "INVALID", amount: 1000 },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("No route found");
    });
  });

  describe("POST /api/trade - Swap Action", () => {
    it("should create swap transaction for valid input", async () => {
      const mockSwapResult = {
        swapTransaction: "base64EncodedTransaction",
        computeUnitLimit: 200000,
        lastValidBlockHeight: 123456789,
        prioritizationFeeLamports: 5000,
      };
      mockBagsApi.createSwapTransaction.mockResolvedValue(mockSwapResult);

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "swap",
          data: {
            quoteResponse: {
              inAmount: "1000000000",
              outAmount: "5000000000",
              minOutAmount: "4750000000",
            },
            userPublicKey: "UserWallet12345678901234567890123456",
          },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transaction).toBe("base64EncodedTransaction");
      expect(data.computeUnitLimit).toBe(200000);
      expect(data.lastValidBlockHeight).toBe(123456789);
      expect(data.prioritizationFeeLamports).toBe(5000);
    });

    it("should return 400 for missing quoteResponse", async () => {
      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "swap",
          data: { userPublicKey: "UserWallet123" },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required");
    });

    it("should return 400 for missing userPublicKey", async () => {
      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "swap",
          data: { quoteResponse: { inAmount: "1000" } },
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should handle swap errors gracefully", async () => {
      mockBagsApi.createSwapTransaction.mockRejectedValue(
        new Error("Transaction simulation failed")
      );

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "swap",
          data: {
            quoteResponse: { inAmount: "1000" },
            userPublicKey: "Wallet123",
          },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Transaction simulation failed");
    });
  });

  describe("POST /api/trade - Unknown Action", () => {
    it("should return 400 for unknown action", async () => {
      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "invalid",
          data: {},
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Unknown action");
    });
  });

  describe("API Configuration", () => {
    it("should return 500 when Bags API is not configured", async () => {
      (getServerBagsApiOrNull as jest.Mock).mockReturnValue(null);

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: { inputMint: "SOL", outputMint: "TEST", amount: 1000 },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("BAGS_API_KEY");
    });
  });

  describe("Quote Parameters Passed Correctly", () => {
    it("should pass custom slippage to API", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({});

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "quote",
          data: {
            inputMint: "TokenA",
            outputMint: "TokenB",
            amount: 5000000,
            slippageBps: 100, // 1% slippage
          },
        },
      });

      await POST(request);

      expect(mockBagsApi.getTradeQuote).toHaveBeenCalledWith(
        "TokenA",
        "TokenB",
        5000000,
        100
      );
    });

    it("should pass quoteResponse and userPublicKey to createSwapTransaction", async () => {
      mockBagsApi.createSwapTransaction.mockResolvedValue({
        swapTransaction: "tx",
        computeUnitLimit: 100000,
        lastValidBlockHeight: 999,
        prioritizationFeeLamports: 1000,
      });

      const quoteResponse = {
        inAmount: "2000000000",
        outAmount: "8000000000",
        minOutAmount: "7600000000",
      };

      const request = createMockRequest("http://localhost:3000/api/trade", {
        method: "POST",
        body: {
          action: "swap",
          data: {
            quoteResponse,
            userPublicKey: "MyWallet12345",
          },
        },
      });

      await POST(request);

      expect(mockBagsApi.createSwapTransaction).toHaveBeenCalledWith(
        quoteResponse,
        "MyWallet12345"
      );
    });
  });
});
