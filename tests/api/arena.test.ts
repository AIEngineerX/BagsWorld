/**
 * Arena API Tests
 *
 * Tests the actual route handler code with:
 * - Real GET and POST handlers imported directly
 * - External dependencies mocked at module level
 * - Actual business logic executed and verified
 */

// Mock external dependencies BEFORE importing route
jest.mock("@/lib/neon", () => ({
  isNeonConfigured: jest.fn(() => true),
  getGlobalTokens: jest.fn(),
}));

jest.mock("@/lib/bags-api-server", () => ({
  getServerBagsApiOrNull: jest.fn(() => null),
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

// Mock external fetch for Anthropic API (but we won't call it in most tests)
const originalFetch = global.fetch;

import { GET, POST } from "@/app/api/arena/route";
import { isNeonConfigured, getGlobalTokens } from "@/lib/neon";
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
  };
}

describe("Arena API - Actual Route Handler Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isNeonConfigured as jest.Mock).mockReturnValue(true);
    (getGlobalTokens as jest.Mock).mockResolvedValue([
      {
        mint: "Token1Mint",
        name: "Test Token",
        symbol: "TEST",
        lifetime_fees: 0.5,
        created_at: new Date().toISOString(),
      },
    ]);
    (getServerBagsApiOrNull as jest.Mock).mockReturnValue(null);

    // Mock fetch for external calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("GET /api/arena - Status", () => {
    it("should return arena status", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena?action=status");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("online");
      expect(data.aiEnabled).toBeDefined();
      expect(data.bagsApiEnabled).toBeDefined();
    });

    it("should return list of agents", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena?action=agents");
      const response = await GET(request);
      const data = await response.json();

      expect(data.agents).toBeDefined();
      expect(data.agents.length).toBe(5); // neo, ghost, finn, ash, toly
      expect(data.agents[0]).toHaveProperty("id");
      expect(data.agents[0]).toHaveProperty("name");
      expect(data.agents[0]).toHaveProperty("personality");
    });

    it("should return trades list", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena?action=trades");
      const response = await GET(request);
      const data = await response.json();

      expect(data.trades).toBeDefined();
      expect(Array.isArray(data.trades)).toBe(true);
    });

    it("should include recent launches in status", async () => {
      (getGlobalTokens as jest.Mock).mockResolvedValue([
        { mint: "Launch1", symbol: "L1", name: "Launch One", created_at: new Date().toISOString() },
        { mint: "Launch2", symbol: "L2", name: "Launch Two", created_at: new Date().toISOString() },
      ]);

      const request = createMockRequest("http://localhost:3000/api/arena?action=status");
      const response = await GET(request);
      const data = await response.json();

      expect(data.recentLaunches).toBeDefined();
      expect(data.recentLaunches.length).toBeLessThanOrEqual(5);
    });
  });

  describe("POST /api/arena - Analyze", () => {
    it("should return analysis with fallback when no API key", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "analyze",
          agentId: "neo",
          tokenSymbol: "TEST",
          tokenMint: "TestMint123",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agentId).toBe("neo");
      expect(data.message).toBeDefined();
      expect(data.sentiment).toBeDefined();
      expect(data.confidence).toBeDefined();
    });

    it("should use default agent (neo) when not specified", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "analyze",
          tokenSymbol: "TEST",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.agentId).toBe("neo");
    });

    it("should include live data in analysis response", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "analyze",
          agentId: "finn",
          tokenSymbol: "TEST",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.liveData).toBeDefined();
      expect(data.liveData.recentLaunches).toBeDefined();
    });
  });

  describe("POST /api/arena - Discuss", () => {
    it("should return multi-agent discussion", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "discuss",
          tokenSymbol: "COOL",
          tokenName: "Cool Token",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toBeDefined();
      expect(data.messages.length).toBe(3); // 3 random agents selected
    });

    it("should include conversation context from previous messages", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "discuss",
          tokenSymbol: "TEST",
          previousMessages: [
            { agent: "Neo", message: "Analyzing the data..." },
          ],
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      // Messages should be built with context
      expect(data.messages).toBeDefined();
    });
  });

  describe("POST /api/arena - Predict", () => {
    it("should create paper trade prediction", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "predict",
          agentId: "neo",
          tokenMint: "TestMint",
          tokenSymbol: "TEST",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.prediction).toBeDefined();
      expect(data.prediction.id).toBeDefined();
      expect(data.prediction.direction).toMatch(/long|short/);
      expect(data.prediction.status).toBe("active");
      expect(data.prediction.entryPrice).toBeDefined();
      expect(data.prediction.targetPrice).toBeDefined();
      expect(data.prediction.stopLoss).toBeDefined();
    });

    it("should include analysis with prediction", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "predict",
          agentId: "finn",
          tokenSymbol: "TEST",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.analysis).toBeDefined();
      expect(data.analysis.sentiment).toBeDefined();
      expect(data.analysis.confidence).toBeDefined();
    });
  });

  describe("POST /api/arena - Event", () => {
    it("should handle token_launch event type", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "event",
          eventType: "token_launch",
          tokenSymbol: "NEW",
          tokenName: "New Token",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.eventType).toBe("token_launch");
      expect(data.messages).toBeDefined();
      expect(data.messages.length).toBe(3); // neo, finn, ash
    });

    it("should handle token_pump event type", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "event",
          eventType: "token_pump",
          tokenSymbol: "PUMP",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.eventType).toBe("token_pump");
    });
  });

  describe("POST /api/arena - Leaderboard", () => {
    it("should return leaderboard stats", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: { action: "leaderboard" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.leaderboard).toBeDefined();
      expect(data.totalTrades).toBeDefined();
      expect(data.activeTrades).toBeDefined();
    });
  });

  describe("POST /api/arena - Live Data", () => {
    it("should fetch live data without AI", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: { action: "live-data" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.recentLaunches).toBeDefined();
    });
  });

  describe("POST /api/arena - Unknown Action", () => {
    it("should return 400 for unknown action", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: { action: "invalid-action" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Unknown action");
    });
  });

  describe("Agent Validation", () => {
    it("should handle unknown agent gracefully in analyze", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "analyze",
          agentId: "unknown-agent",
          tokenSymbol: "TEST",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      // Should return gracefully even with unknown agent
      expect(response.status).toBe(200);
      expect(data.message).toContain("Agent not found");
    });

    const validAgents = ["neo", "ghost", "finn", "ash", "toly"];
    validAgents.forEach((agentId) => {
      it(`should accept valid agent: ${agentId}`, async () => {
        const request = createMockRequest("http://localhost:3000/api/arena", {
          method: "POST",
          body: {
            action: "analyze",
            agentId,
            tokenSymbol: "TEST",
          },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.agentId).toBe(agentId);
      });
    });
  });

  describe("Sentiment Values", () => {
    it("should return valid sentiment from fallback", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "analyze",
          agentId: "finn", // bullish personality
          tokenSymbol: "TEST",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(["bullish", "bearish", "neutral"]).toContain(data.sentiment);
    });

    it("should return confidence between 0 and 100", async () => {
      const request = createMockRequest("http://localhost:3000/api/arena", {
        method: "POST",
        body: {
          action: "analyze",
          tokenSymbol: "TEST",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.confidence).toBeGreaterThanOrEqual(0);
      expect(data.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe("Database Integration", () => {
    it("should include recent launches in status when DB is configured", async () => {
      // Note: The route has a 5-second cache, so getGlobalTokens may not be called
      // on every request. We test the behavior (recentLaunches is defined) not implementation.
      const mockTokens = [
        { mint: "Cached1", symbol: "C1", name: "Cached One", created_at: new Date().toISOString() },
      ];
      (getGlobalTokens as jest.Mock).mockResolvedValue(mockTokens);

      const request = createMockRequest("http://localhost:3000/api/arena?action=status");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentLaunches).toBeDefined();
      expect(Array.isArray(data.recentLaunches)).toBe(true);
    });

    it("should work when DB is not configured", async () => {
      (isNeonConfigured as jest.Mock).mockReturnValue(false);

      const request = createMockRequest("http://localhost:3000/api/arena?action=status");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("online");
    });
  });
});
