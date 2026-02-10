/**
 * Casino Wheel API Tests
 *
 * Tests the actual route handler code with:
 * - Real GET and POST handlers imported directly
 * - Database operations mocked at the neon module level
 * - Actual business logic executed and verified
 */

// Mock neon database module BEFORE importing the route
jest.mock("@/lib/neon", () => ({
  isNeonConfigured: jest.fn(() => true),
  getCasinoPot: jest.fn(),
  getLastWheelSpin: jest.fn(),
  recordWheelSpin: jest.fn(),
}));

// Mock token-balance module to bypass token gate checks
jest.mock("@/lib/token-balance", () => ({
  getTokenBalance: jest.fn(() => Promise.resolve(10_000_000)), // Above MIN_TOKEN_BALANCE
  BAGSWORLD_TOKEN_MINT: "MockBagsWorldMint",
  MIN_TOKEN_BALANCE: 1_000_000,
  BAGSWORLD_TOKEN_SYMBOL: "BAGS",
  BAGSWORLD_BUY_URL: "https://example.com/buy",
}));

// Mock Solana web3.js to avoid connection issues
jest.mock("@solana/web3.js", () => ({
  Connection: jest.fn().mockImplementation(() => ({})),
  PublicKey: jest.fn().mockImplementation((key: string) => ({
    toString: () => key,
    toBase58: () => key,
  })),
}));

// Mock next/server to avoid NextRequest issues
jest.mock("next/server", () => {
  const originalModule = jest.requireActual("next/server");
  return {
    ...originalModule,
    NextResponse: {
      json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        headers: new Map(Object.entries(init?.headers || {})),
      }),
    },
  };
});

import { GET, POST } from "@/app/api/casino/wheel/route";
import {
  isNeonConfigured,
  getCasinoPot,
  getLastWheelSpin,
  recordWheelSpin,
} from "@/lib/neon";

// Create mock NextRequest-like object
function createMockRequest(
  url: string,
  options: { method?: string; body?: object } = {}
): any {
  const parsedUrl = new URL(url);
  return {
    nextUrl: {
      searchParams: parsedUrl.searchParams,
    },
    json: async () => options.body || {},
  };
}

describe("Casino Wheel API - Actual Route Handler Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isNeonConfigured as jest.Mock).mockReturnValue(true);
    (getCasinoPot as jest.Mock).mockResolvedValue(0.5);
    (getLastWheelSpin as jest.Mock).mockResolvedValue(null);
    (recordWheelSpin as jest.Mock).mockResolvedValue(true);
  });

  describe("GET /api/casino/wheel", () => {
    it("should return pot balance from database", async () => {
      (getCasinoPot as jest.Mock).mockResolvedValue(1.25);

      const request = createMockRequest("http://localhost:3000/api/casino/wheel");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.potBalance).toBe(1.25);
      expect(getCasinoPot).toHaveBeenCalled();
    });

    it("should indicate canSpin=true when no recent spin", async () => {
      (getLastWheelSpin as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        "http://localhost:3000/api/casino/wheel?wallet=TestWallet123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.canSpin).toBe(true);
      expect(data.cooldownEnds).toBeUndefined();
    });

    it("should indicate canSpin=false when in cooldown", async () => {
      const recentSpinTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      (getLastWheelSpin as jest.Mock).mockResolvedValue(recentSpinTime);

      const request = createMockRequest(
        "http://localhost:3000/api/casino/wheel?wallet=TestWallet123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.canSpin).toBe(false);
      expect(data.cooldownEnds).toBeDefined();
      expect(data.cooldownEnds).toBeGreaterThan(Date.now());
    });

    it("should allow spin after cooldown expires", async () => {
      const oldSpinTime = Date.now() - 15 * 60 * 1000; // 15 minutes ago (cooldown is 10 min)
      (getLastWheelSpin as jest.Mock).mockResolvedValue(oldSpinTime);

      const request = createMockRequest(
        "http://localhost:3000/api/casino/wheel?wallet=TestWallet123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.canSpin).toBe(true);
    });

    it("should use fallback when database is not configured", async () => {
      (isNeonConfigured as jest.Mock).mockReturnValue(false);

      const request = createMockRequest("http://localhost:3000/api/casino/wheel");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.potBalance).toBeDefined();
      // Should not call database functions
      expect(getCasinoPot).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      (getCasinoPot as jest.Mock).mockRejectedValue(new Error("DB connection failed"));

      const request = createMockRequest("http://localhost:3000/api/casino/wheel");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to get wheel status");
    });
  });

  describe("POST /api/casino/wheel - Spin", () => {
    it("should reject spin without wallet address", async () => {
      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: {},
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Wallet address required");
    });

    it("should reject spin during cooldown period", async () => {
      (recordWheelSpin as jest.Mock).mockResolvedValue(false);

      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "CooldownWallet123" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("wait");
    });

    it("should reject spin when pot is too low", async () => {
      (getCasinoPot as jest.Mock).mockResolvedValue(0.05); // Below 0.1 minimum

      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "ValidWallet123" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Pot is too low");
    });

    it("should successfully spin and return result", async () => {
      (getCasinoPot as jest.Mock).mockResolvedValue(0.5);
      (getLastWheelSpin as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "LuckyWallet123" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result).toBeDefined();
      expect(data.prize).toBeDefined();
      expect(typeof data.prize).toBe("number");
      expect(data.newPotBalance).toBeDefined();
    });

    it("should record spin in database", async () => {
      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "RecordWallet123" },
      });
      await POST(request);

      expect(recordWheelSpin).toHaveBeenCalledWith(
        "RecordWallet123",
        expect.any(Number),
        expect.any(String),
        expect.any(Number)
      );
    });

    it("should cap prize at pot balance", async () => {
      (getCasinoPot as jest.Mock).mockResolvedValue(0.15); // Pot is only 0.15 SOL

      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "TestWallet" },
      });
      const response = await POST(request);
      const data = await response.json();

      // Prize should never exceed pot
      expect(data.prize).toBeLessThanOrEqual(0.15);
    });

    it("should handle database error during spin recording", async () => {
      (recordWheelSpin as jest.Mock).mockRejectedValue(new Error("Write failed"));

      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "ErrorWallet" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to spin wheel");
    });

    it("should use fallback when database is not configured", async () => {
      (isNeonConfigured as jest.Mock).mockReturnValue(false);

      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "FallbackWallet" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should not call database functions for recording
      expect(recordWheelSpin).not.toHaveBeenCalled();
    });
  });

  describe("Wheel Spin Randomness - Actual spinWheel() execution", () => {
    it("should return valid prize labels from actual wheel segments", async () => {
      const validLabels = ["MISS", "0.01 SOL", "0.05 SOL", "0.1 SOL", "JACKPOT"];

      // Run multiple spins to test actual randomness
      for (let i = 0; i < 10; i++) {
        jest.clearAllMocks();
        (isNeonConfigured as jest.Mock).mockReturnValue(true);
        (getCasinoPot as jest.Mock).mockResolvedValue(1.0);
        (getLastWheelSpin as jest.Mock).mockResolvedValue(null);
        (recordWheelSpin as jest.Mock).mockResolvedValue(true);

        const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
          method: "POST",
          body: { wallet: `RandomTestWallet${i}` },
        });
        const response = await POST(request);
        const data = await response.json();

        expect(validLabels).toContain(data.result);
      }
    });

    it("should return valid prize amounts from actual wheel segments", async () => {
      const validPrizes = [0, 0.01, 0.05, 0.1, 0.5];

      for (let i = 0; i < 10; i++) {
        jest.clearAllMocks();
        (isNeonConfigured as jest.Mock).mockReturnValue(true);
        (getCasinoPot as jest.Mock).mockResolvedValue(1.0);
        (getLastWheelSpin as jest.Mock).mockResolvedValue(null);
        (recordWheelSpin as jest.Mock).mockResolvedValue(true);

        const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
          method: "POST",
          body: { wallet: `PrizeTestWallet${i}` },
        });
        const response = await POST(request);
        const data = await response.json();

        expect(validPrizes).toContain(data.prize);
      }
    });
  });

  describe("Cooldown Boundary Conditions", () => {
    it("should enforce cooldown via atomic recordWheelSpin", async () => {
      // DB rejects (cooldown active)
      (recordWheelSpin as jest.Mock).mockResolvedValue(false);

      let request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "BoundaryWallet" },
      });
      let response = await POST(request);
      expect(response.status).toBe(429);

      // DB allows (cooldown expired)
      jest.clearAllMocks();
      (isNeonConfigured as jest.Mock).mockReturnValue(true);
      (getCasinoPot as jest.Mock).mockResolvedValue(0.5);
      (recordWheelSpin as jest.Mock).mockResolvedValue(true);

      request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "BoundaryWallet" },
      });
      response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("Pot Balance Edge Cases", () => {
    it("should allow spin at exactly 0.1 SOL pot (minimum)", async () => {
      (getCasinoPot as jest.Mock).mockResolvedValue(0.1);

      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "MinPotWallet" },
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("should reject spin at 0.09 SOL pot (below minimum)", async () => {
      (getCasinoPot as jest.Mock).mockResolvedValue(0.09);

      const request = createMockRequest("http://localhost:3000/api/casino/wheel", {
        method: "POST",
        body: { wallet: "LowPotWallet" },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
