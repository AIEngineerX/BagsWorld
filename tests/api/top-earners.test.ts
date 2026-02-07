// Tests for src/app/api/agent-economy/top-earners/route.ts
// Tests the top fee claimers endpoint using bulk wallet lookup + claimable-positions

// Track all NextResponse.json() calls for assertions
const jsonResponses: Array<{ body: unknown; status: number }> = [];

// Mock next/server before any imports
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => {
      const status = init?.status || 200;
      jsonResponses.push({ body, status });
      return { body, status, json: () => body };
    },
  },
}));

// Mock @neondatabase/serverless
jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(),
}));

// Mock bags-api
jest.mock("@/lib/bags-api", () => ({
  initBagsApi: jest.fn(),
}));

// Mock neon helper
jest.mock("@/lib/neon", () => ({
  isNeonConfigured: jest.fn(),
}));

import { GET } from "@/app/api/agent-economy/top-earners/route";
import { initBagsApi } from "@/lib/bags-api";
import { isNeonConfigured } from "@/lib/neon";
import { neon } from "@neondatabase/serverless";

// Helper to create a mock Request
function makeRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/agent-economy/top-earners");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new Request(url.toString());
}

// Helper to create mock claimable positions
function mockPosition(baseMint: string, lamports: number, symbol = "???", name = "Unknown") {
  return {
    baseMint,
    quoteMint: "So11111111111111111111111111111111111111112",
    virtualPool: "VPool111111111111111111111111111111111111",
    isMigrated: false,
    totalClaimableLamportsUserShare: lamports,
    claimableDisplayAmount: lamports / 1_000_000_000,
    userBps: 10000,
    tokenName: name,
    tokenSymbol: symbol,
  };
}

// Helper: get last response body
function lastResponse(): { body: Record<string, unknown>; status: number } {
  return jsonResponses[jsonResponses.length - 1] as {
    body: Record<string, unknown>;
    status: number;
  };
}

describe("GET /api/agent-economy/top-earners", () => {
  let mockApi: {
    bulkWalletLookup: jest.Mock;
    getClaimablePositions: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jsonResponses.length = 0;

    mockApi = {
      bulkWalletLookup: jest.fn(),
      getClaimablePositions: jest.fn(),
    };

    (initBagsApi as jest.Mock).mockReturnValue(mockApi);
    (isNeonConfigured as jest.Mock).mockReturnValue(false);

    process.env.BAGS_API_KEY = "test-api-key";
  });

  afterEach(() => {
    delete process.env.BAGS_API_KEY;
  });

  it("returns 503 when BAGS_API_KEY is not configured", async () => {
    delete process.env.BAGS_API_KEY;

    await GET(makeRequest({ nocache: "" }));
    const { body, status } = lastResponse();

    expect(status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toContain("BAGS_API_KEY");
  });

  it("returns empty earners when bulk wallet lookup returns no results", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue([]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();

    expect(body.success).toBe(true);
    expect(body.topEarners).toEqual([]);
  });

  it("returns earners sorted by total claimable SOL", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "BagsyWallet111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
        platformData: { displayName: "Bagsy", avatarUrl: "https://example.com/bagsy.png" },
      },
      {
        wallet: "ChadGhostWallet1111111111111111111111111",
        provider: "moltbook",
        username: "ChadGhost",
        platformData: { displayName: "ChadGhost", avatarUrl: "https://example.com/chad.png" },
      },
    ]);

    mockApi.getClaimablePositions.mockImplementation((wallet: string) => {
      if (wallet.startsWith("Bagsy")) {
        return Promise.resolve([mockPosition("TokenA111", 2_000_000_000, "TOKA", "Token A")]);
      }
      if (wallet.startsWith("ChadGhost")) {
        return Promise.resolve([
          mockPosition("TokenB111", 3_000_000_000, "TOKB", "Token B"),
          mockPosition("TokenC111", 2_000_000_000, "TOKC", "Token C"),
        ]);
      }
      return Promise.resolve([]);
    });

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(2);

    // ChadGhost should be first (5 SOL > 2 SOL)
    expect(earners[0].username).toBe("ChadGhost");
    expect(earners[0].totalClaimableSol).toBeCloseTo(5.0);
    expect(earners[0].tokenCount).toBe(2);
    expect(earners[0].profilePic).toBe("https://example.com/chad.png");

    // Bagsy second
    expect(earners[1].username).toBe("Bagsy");
    expect(earners[1].totalClaimableSol).toBeCloseTo(2.0);
    expect(earners[1].tokenCount).toBe(1);
  });

  it("correctly converts lamports to SOL (divide by 1,000,000,000)", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "TestWallet111111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
        platformData: { displayName: "Bagsy" },
      },
    ]);

    // 19660432383 lamports = ~19.66 SOL (from the Bags API docs screenshot)
    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("ExampleMint111", 19660432383, "TEST", "Test Token"),
    ]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    expect(earners[0].totalClaimableSol).toBeCloseTo(19.660432383);

    const tokens = earners[0].tokens as Array<Record<string, unknown>>;
    expect(tokens[0].claimableSol).toBeCloseTo(19.660432383);
  });

  it("skips agents with zero claimable fees", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "Wallet1111111111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
      },
      {
        wallet: "Wallet2222222222222222222222222222222222222",
        provider: "moltbook",
        username: "ChadGhost",
      },
    ]);

    mockApi.getClaimablePositions.mockImplementation((wallet: string) => {
      if (wallet.startsWith("Wallet1")) {
        return Promise.resolve([mockPosition("TokenA111", 1_000_000_000, "TOKA", "Token A")]);
      }
      // ChadGhost has zero claimable
      return Promise.resolve([mockPosition("TokenB111", 0, "TOKB", "Token B")]);
    });

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    expect(earners[0].username).toBe("Bagsy");
  });

  it("skips agents whose claimable-positions call fails", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "Wallet1111111111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
      },
      {
        wallet: "Wallet2222222222222222222222222222222222222",
        provider: "moltbook",
        username: "ChadGhost",
      },
    ]);

    mockApi.getClaimablePositions.mockImplementation((wallet: string) => {
      if (wallet.startsWith("Wallet1")) {
        return Promise.resolve([mockPosition("TokenA111", 5_000_000_000, "TOKA", "Token A")]);
      }
      return Promise.reject(new Error("Rate limited"));
    });

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    expect(earners[0].username).toBe("Bagsy");
  });

  it("returns at most 3 earners", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue(
      ["Bagsy", "ChadGhost", "Agent3", "Agent4"].map((username, i) => ({
        wallet: `Wallet${i}111111111111111111111111111111111`,
        provider: "moltbook",
        username,
      }))
    );

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("Token111", 1_000_000_000, "TOK", "Token"),
    ]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners.length).toBeLessThanOrEqual(3);
  });

  it("sorts tokens within each earner by claimable amount descending", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "Wallet1111111111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
      },
    ]);

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("SmallToken", 500_000_000, "SMALL", "Small Token"),
      mockPosition("BigToken11", 5_000_000_000, "BIG", "Big Token"),
      mockPosition("MedToken11", 2_000_000_000, "MED", "Med Token"),
    ]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;
    const tokens = earners[0].tokens as Array<Record<string, unknown>>;

    expect(tokens).toHaveLength(3);
    expect(tokens[0].symbol).toBe("BIG");
    expect(tokens[1].symbol).toBe("MED");
    expect(tokens[2].symbol).toBe("SMALL");
  });

  it("includes external agents from DB when Neon is configured", async () => {
    (isNeonConfigured as jest.Mock).mockReturnValue(true);
    process.env.DATABASE_URL = "postgres://test:test@localhost/test";

    const mockSql = jest
      .fn()
      .mockResolvedValue([{ name: "ExternalBot", moltbook_username: "ExternalBot" }]);
    (neon as unknown as jest.Mock).mockReturnValue(mockSql);

    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "BagsyWallet11111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
      },
      {
        wallet: "ChadWallet111111111111111111111111111111111",
        provider: "moltbook",
        username: "ChadGhost",
      },
      {
        wallet: "ExtWallet1111111111111111111111111111111111",
        provider: "moltbook",
        username: "ExternalBot",
      },
    ]);

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("Token111", 1_000_000_000, "TOK", "Token"),
    ]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(3);

    // Verify bulk lookup was called with all 3 usernames
    const bulkItems = mockApi.bulkWalletLookup.mock.calls[0][0];
    expect(bulkItems).toHaveLength(3);
    expect(bulkItems.map((i: { username: string }) => i.username)).toContain("ExternalBot");

    delete process.env.DATABASE_URL;
  });

  it("handles bulk wallet lookup failure gracefully", async () => {
    mockApi.bulkWalletLookup.mockRejectedValue(new Error("Network error"));

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();

    expect(body.success).toBe(false);
    expect(body.error).toContain("Failed to resolve agent wallets");
  });

  it("includes lastUpdated timestamp", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue([]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();

    expect(body.lastUpdated).toBeDefined();
    expect(new Date(body.lastUpdated as string).getTime()).not.toBeNaN();
  });

  it("uses correct provider 'moltbook' for bulk lookup items", async () => {
    mockApi.bulkWalletLookup.mockResolvedValue([]);

    await GET(makeRequest({ nocache: "" }));

    const bulkItems = mockApi.bulkWalletLookup.mock.calls[0][0];
    for (const item of bulkItems) {
      expect(item.provider).toBe("moltbook");
    }
  });
});
