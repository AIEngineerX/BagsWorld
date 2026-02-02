/**
 * Sniper Quick Snipe API Tests
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

import { GET, POST } from "@/app/api/sniper/quick-snipe/route";
import { checkRateLimit } from "@/lib/rate-limit";
import { getServerBagsApiOrNull } from "@/lib/bags-api-server";

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

// Mock BagsApiClient methods
const mockBagsApi = {
  getTradeQuote: jest.fn(),
  createSwapTransaction: jest.fn(),
};

describe("Sniper Quick Snipe API - Actual Route Handler Tests", () => {
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

  describe("GET /api/sniper/quick-snipe - Status", () => {
    it("should return sniper availability and limits when API configured", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(true);
      expect(data.solMint).toBe("So11111111111111111111111111111111111111112");
      expect(data.limits).toBeDefined();
      expect(data.limits.maxSnipeAmountSol).toBe(100);
      expect(data.limits.minSlippageBps).toBe(10);
      expect(data.limits.maxSlippageBps).toBe(5000);
    });

    it("should show unavailable when API not configured", async () => {
      (getServerBagsApiOrNull as jest.Mock).mockReturnValue(null);

      const response = await GET();
      const data = await response.json();

      expect(data.available).toBe(false);
    });
  });

  describe("POST /api/sniper/quick-snipe - Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({
        success: false,
        remaining: 0,
        resetIn: 30000,
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many");
      expect(data.retryAfter).toBeDefined();
    });
  });

  describe("POST /api/sniper/quick-snipe - Input Validation", () => {
    it("should reject invalid token mint (too short)", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "short",
          amountSol: 1,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid token mint");
    });

    it("should reject missing token mint", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          amountSol: 1,
          slippageBps: 100,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should reject zero amount", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 0,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Amount must be greater than 0");
    });

    it("should reject negative amount", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: -5,
          slippageBps: 100,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should reject amount exceeding maximum (100 SOL)", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 150,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Maximum snipe amount");
    });

    it("should accept exactly 100 SOL (boundary)", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000",
        minOutAmount: "950000000000",
        priceImpactPct: "0.5",
        routePlan: [{ venue: "Raydium" }],
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 100,
          slippageBps: 100,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should reject slippage below minimum (10 bps)", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 5,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Slippage must be between");
    });

    it("should reject slippage above maximum (5000 bps)", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 6000,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should accept minimum slippage (10 bps)", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000",
        minOutAmount: "999000000000",
        priceImpactPct: "0.1",
        routePlan: [{ venue: "Raydium" }],
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 10,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should accept maximum slippage (5000 bps)", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000",
        minOutAmount: "500000000000",
        priceImpactPct: "5.0",
        routePlan: [{ venue: "Raydium" }],
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 5000,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should reject missing slippage", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/sniper/quick-snipe - Quote Action", () => {
    it("should return quote with calculated amounts", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000000",
        minOutAmount: "950000000000000",
        priceImpactPct: "0.5",
        routePlan: [{ venue: "Raydium" }, { venue: "Orca" }],
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.quote).toBeDefined();
      expect(data.quote.inputAmount).toBe(1);
      expect(data.quote.outputAmount).toBeDefined();
      expect(data.quote.priceImpact).toBe(0.5);
      expect(data.rawQuote).toBeDefined();
    });

    it("should include route information", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000",
        minOutAmount: "950000000000",
        priceImpactPct: "0.3",
        routePlan: [{ venue: "Raydium" }, { venue: "Meteora" }],
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.quote.route).toBe("Raydium -> Meteora");
    });

    it("should pass correct lamport amount to API", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000",
        minOutAmount: "950000000000",
        priceImpactPct: "0.5",
        routePlan: [{ venue: "Raydium" }],
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "MyTokenMint123456789012345678901234",
          amountSol: 2.5,
          slippageBps: 150,
        },
      });

      await POST(request);

      // 2.5 SOL = 2,500,000,000 lamports
      expect(mockBagsApi.getTradeQuote).toHaveBeenCalledWith(
        "So11111111111111111111111111111111111111112",
        "MyTokenMint123456789012345678901234",
        2500000000,
        150
      );
    });
  });

  describe("POST /api/sniper/quick-snipe - Swap Action", () => {
    it("should create swap transaction", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000",
        minOutAmount: "950000000000",
        priceImpactPct: "0.5",
        routePlan: [{ venue: "Raydium" }],
      });
      mockBagsApi.createSwapTransaction.mockResolvedValue({
        swapTransaction: "base64EncodedSwapTransaction",
        computeUnitLimit: 200000,
        lastValidBlockHeight: 123456789,
        prioritizationFeeLamports: 5000,
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "swap",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 100,
          userPublicKey: "UserWallet12345678901234567890123456",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transaction).toBe("base64EncodedSwapTransaction");
      expect(data.computeUnitLimit).toBe(200000);
      expect(data.lastValidBlockHeight).toBe(123456789);
    });

    it("should reject swap without user public key", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "swap",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid user public key");
    });

    it("should reject swap with short public key", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "swap",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 100,
          userPublicKey: "short",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should include quote in swap response", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "5000000000000",
        minOutAmount: "4500000000000",
        priceImpactPct: "1.2",
        routePlan: [{ venue: "Raydium" }],
      });
      mockBagsApi.createSwapTransaction.mockResolvedValue({
        swapTransaction: "tx",
        computeUnitLimit: 100000,
        lastValidBlockHeight: 999,
        prioritizationFeeLamports: 1000,
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "swap",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 5,
          slippageBps: 200,
          userPublicKey: "UserWallet12345678901234567890123456",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.quote).toBeDefined();
      expect(data.quote.inputAmount).toBe(5);
      expect(data.quote.priceImpact).toBe(1.2);
    });
  });

  describe("POST /api/sniper/quick-snipe - Invalid Action", () => {
    it("should reject invalid action", async () => {
      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "invalid-action",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid action");
    });
  });

  describe("API Configuration", () => {
    it("should return 500 when Bags API is not configured for POST", async () => {
      (getServerBagsApiOrNull as jest.Mock).mockReturnValue(null);

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 1,
          slippageBps: 100,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("BAGS_API_KEY");
    });
  });

  describe("Lamport Conversion", () => {
    it("should correctly convert SOL to lamports", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000",
        minOutAmount: "950000000000",
        priceImpactPct: "0.5",
        routePlan: [{ venue: "Raydium" }],
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 0.5,
          slippageBps: 100,
        },
      });

      await POST(request);

      // 0.5 SOL = 500,000,000 lamports
      expect(mockBagsApi.getTradeQuote).toHaveBeenCalledWith(
        "So11111111111111111111111111111111111111112",
        "TokenMint12345678901234567890123456",
        500000000,
        100
      );
    });

    it("should handle fractional SOL amounts", async () => {
      mockBagsApi.getTradeQuote.mockResolvedValue({
        outAmount: "1000000000000",
        minOutAmount: "950000000000",
        priceImpactPct: "0.5",
        routePlan: [{ venue: "Raydium" }],
      });

      const request = createMockRequest("http://localhost:3000/api/sniper/quick-snipe", {
        method: "POST",
        body: {
          action: "quote",
          tokenMint: "TokenMint12345678901234567890123456",
          amountSol: 0.001,
          slippageBps: 100,
        },
      });

      await POST(request);

      // 0.001 SOL = 1,000,000 lamports
      expect(mockBagsApi.getTradeQuote).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        1000000,
        100
      );
    });
  });
});
