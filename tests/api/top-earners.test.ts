// Tests for src/app/api/agent-economy/top-earners/route.ts
// Tests the top fee earners endpoint using individual wallet lookups + lifetime fees

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
  getTokensByCreator: jest.fn().mockResolvedValue([]),
}));

// Mock moltbook client (feed discovery returns empty by default — hardcoded agents still work)
jest.mock("@/lib/moltbook-client", () => ({
  getMoltbookOrNull: jest.fn().mockReturnValue(null),
}));

import { GET } from "@/app/api/agent-economy/top-earners/route";
import { initBagsApi } from "@/lib/bags-api";
import { isNeonConfigured, getTokensByCreator } from "@/lib/neon";
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

// Helper: mock getWalletByUsername to resolve specific usernames to wallets
function mockWalletLookup(
  mock: jest.Mock,
  mapping: Record<string, { wallet: string; displayName?: string; avatarUrl?: string }>
) {
  mock.mockImplementation((_provider: string, username: string) => {
    const entry = mapping[username];
    if (entry) {
      return Promise.resolve({
        wallet: entry.wallet,
        platformData: {
          id: username,
          username,
          displayName: entry.displayName || username,
          avatarUrl: entry.avatarUrl,
        },
      });
    }
    return Promise.reject(new Error(`User ${username} not found`));
  });
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
    getWalletByUsername: jest.Mock;
    getClaimablePositions: jest.Mock;
    getTokenLifetimeFees: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jsonResponses.length = 0;

    mockApi = {
      getWalletByUsername: jest.fn().mockRejectedValue(new Error("Not found")),
      getClaimablePositions: jest.fn().mockResolvedValue([]),
      getTokenLifetimeFees: jest.fn().mockResolvedValue(0),
    };

    (initBagsApi as jest.Mock).mockReturnValue(mockApi);
    (isNeonConfigured as jest.Mock).mockReturnValue(false);
    (getTokensByCreator as jest.Mock).mockResolvedValue([]);

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

  it("returns empty earners when no agents resolve to wallets", async () => {
    // Default mock rejects all lookups
    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();

    expect(body.success).toBe(true);
    expect(body.topEarners).toEqual([]);
  });

  it("returns earners sorted by total lifetime fees", async () => {
    mockWalletLookup(mockApi.getWalletByUsername, {
      Bagsy: {
        wallet: "BagsyWallet111111111111111111111111111111",
        displayName: "Bagsy",
        avatarUrl: "https://example.com/bagsy.png",
      },
      ChadGhost: {
        wallet: "ChadGhostWallet1111111111111111111111111",
        displayName: "ChadGhost",
        avatarUrl: "https://example.com/chad.png",
      },
    });

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

    mockApi.getTokenLifetimeFees.mockImplementation((mint: string) => {
      if (mint === "TokenA111") return Promise.resolve(2_000_000_000);
      if (mint === "TokenB111") return Promise.resolve(3_000_000_000);
      if (mint === "TokenC111") return Promise.resolve(2_000_000_000);
      return Promise.resolve(0);
    });

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(2);

    // ChadGhost should be first (5 SOL > 2 SOL)
    expect(earners[0].username).toBe("ChadGhost");
    expect(earners[0].totalLifetimeFeeSol).toBeCloseTo(5.0);
    expect(earners[0].tokenCount).toBe(2);
    expect(earners[0].profilePic).toBe("https://example.com/chad.png");

    // Bagsy second
    expect(earners[1].username).toBe("Bagsy");
    expect(earners[1].totalLifetimeFeeSol).toBeCloseTo(2.0);
    expect(earners[1].tokenCount).toBe(1);
  });

  it("correctly converts lamports to SOL (divide by 1,000,000,000)", async () => {
    mockWalletLookup(mockApi.getWalletByUsername, {
      Bagsy: { wallet: "TestWallet111111111111111111111111111111111", displayName: "Bagsy" },
    });

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("ExampleMint111", 19660432383, "TEST", "Test Token"),
    ]);

    // 19660432383 lamports = ~19.66 SOL (from the Bags API docs screenshot)
    mockApi.getTokenLifetimeFees.mockResolvedValue(19660432383);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    expect(earners[0].totalLifetimeFeeSol).toBeCloseTo(19.660432383);

    const tokens = earners[0].tokens as Array<Record<string, unknown>>;
    expect(tokens[0].lifetimeFeeSol).toBeCloseTo(19.660432383);
  });

  it("skips agents with zero lifetime fees", async () => {
    mockWalletLookup(mockApi.getWalletByUsername, {
      Bagsy: { wallet: "Wallet1111111111111111111111111111111111111" },
      ChadGhost: { wallet: "Wallet2222222222222222222222222222222222222" },
    });

    mockApi.getClaimablePositions.mockImplementation((wallet: string) => {
      if (wallet.startsWith("Wallet1")) {
        return Promise.resolve([mockPosition("TokenA111", 1_000_000_000, "TOKA", "Token A")]);
      }
      return Promise.resolve([mockPosition("TokenB111", 0, "TOKB", "Token B")]);
    });

    mockApi.getTokenLifetimeFees.mockImplementation((mint: string) => {
      if (mint === "TokenA111") return Promise.resolve(1_000_000_000);
      return Promise.resolve(0);
    });

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    expect(earners[0].username).toBe("Bagsy");
  });

  it("skips agents whose token discovery fails", async () => {
    mockWalletLookup(mockApi.getWalletByUsername, {
      Bagsy: { wallet: "Wallet1111111111111111111111111111111111111" },
      ChadGhost: { wallet: "Wallet2222222222222222222222222222222222222" },
    });

    mockApi.getClaimablePositions.mockImplementation((wallet: string) => {
      if (wallet.startsWith("Wallet1")) {
        return Promise.resolve([mockPosition("TokenA111", 5_000_000_000, "TOKA", "Token A")]);
      }
      return Promise.reject(new Error("Rate limited"));
    });

    mockApi.getTokenLifetimeFees.mockResolvedValue(5_000_000_000);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    expect(earners[0].username).toBe("Bagsy");
  });

  it("returns at most 10 earners", async () => {
    mockWalletLookup(mockApi.getWalletByUsername, {
      Bagsy: { wallet: "Wallet0111111111111111111111111111111111" },
      ChadGhost: { wallet: "Wallet1111111111111111111111111111111111" },
    });

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("Token111", 1_000_000_000, "TOK", "Token"),
    ]);

    mockApi.getTokenLifetimeFees.mockResolvedValue(1_000_000_000);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners.length).toBeLessThanOrEqual(10);
  });

  it("sorts tokens within each earner by lifetime fees descending", async () => {
    mockWalletLookup(mockApi.getWalletByUsername, {
      Bagsy: { wallet: "Wallet1111111111111111111111111111111111111" },
    });

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("SmallToken", 500_000_000, "SMALL", "Small Token"),
      mockPosition("BigToken11", 5_000_000_000, "BIG", "Big Token"),
      mockPosition("MedToken11", 2_000_000_000, "MED", "Med Token"),
    ]);

    mockApi.getTokenLifetimeFees.mockImplementation((mint: string) => {
      if (mint === "SmallToken") return Promise.resolve(500_000_000);
      if (mint === "BigToken11") return Promise.resolve(5_000_000_000);
      if (mint === "MedToken11") return Promise.resolve(2_000_000_000);
      return Promise.resolve(0);
    });

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

    mockWalletLookup(mockApi.getWalletByUsername, {
      Bagsy: { wallet: "BagsyWallet11111111111111111111111111111111" },
      ChadGhost: { wallet: "ChadWallet111111111111111111111111111111111" },
      ExternalBot: { wallet: "ExtWallet1111111111111111111111111111111111" },
    });

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("Token111", 1_000_000_000, "TOK", "Token"),
    ]);

    mockApi.getTokenLifetimeFees.mockResolvedValue(1_000_000_000);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(3);

    // Verify getWalletByUsername was called for all 3 agents
    const calledUsernames = mockApi.getWalletByUsername.mock.calls.map(
      (c: [string, string]) => c[1]
    );
    expect(calledUsernames).toContain("ExternalBot");

    delete process.env.DATABASE_URL;
  });

  it("skips agents whose wallet lookup fails without crashing", async () => {
    // Bagsy resolves, ChadGhost fails — should still return Bagsy
    mockApi.getWalletByUsername.mockImplementation((_provider: string, username: string) => {
      if (username === "Bagsy") {
        return Promise.resolve({
          wallet: "BagsyWallet111111111111111111111111111111",
          platformData: { id: "Bagsy", username: "Bagsy", displayName: "Bagsy" },
        });
      }
      return Promise.reject(new Error("Network error"));
    });

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("Token111", 1_000_000_000, "TOK", "Token"),
    ]);
    mockApi.getTokenLifetimeFees.mockResolvedValue(1_000_000_000);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    expect(earners[0].username).toBe("Bagsy");
  });

  it("includes lastUpdated timestamp", async () => {
    // Default mock rejects all lookups → empty earners, but still returns timestamp
    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();

    expect(body.lastUpdated).toBeDefined();
    expect(new Date(body.lastUpdated as string).getTime()).not.toBeNaN();
  });

  it("calls getWalletByUsername with provider 'moltbook'", async () => {
    mockWalletLookup(mockApi.getWalletByUsername, {
      Bagsy: { wallet: "Wallet111111111111111111111111111111111111" },
    });

    mockApi.getClaimablePositions.mockResolvedValue([]);

    await GET(makeRequest({ nocache: "" }));

    for (const call of mockApi.getWalletByUsername.mock.calls) {
      expect(call[0]).toBe("moltbook");
    }
  });
});
