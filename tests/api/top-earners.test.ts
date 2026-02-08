// Tests for src/app/api/agent-economy/top-earners/route.ts
// Tests the top earners endpoint using bulk wallet lookup + claimable positions

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

// Mock moltbook client (feed discovery) — return null initially, configure in beforeEach
jest.mock("@/lib/moltbook-client", () => ({
  getMoltbookOrNull: jest.fn().mockReturnValue(null),
}));

import { GET } from "@/app/api/agent-economy/top-earners/route";
import { initBagsApi } from "@/lib/bags-api";
import { isNeonConfigured } from "@/lib/neon";
import { neon } from "@neondatabase/serverless";
import { getMoltbookOrNull } from "@/lib/moltbook-client";

// Feed mock — configured in beforeEach after jest.mock hoisting
const mockGetFeed = jest.fn().mockResolvedValue([]);

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
function mockPosition(
  baseMint: string,
  lamports: number,
  symbol = "???",
  name = "Unknown",
  dammLamports = 0
) {
  return {
    baseMint,
    quoteMint: "So11111111111111111111111111111111111111112",
    virtualPool: "VPool111111111111111111111111111111111111",
    isMigrated: dammLamports > 0,
    totalClaimableLamportsUserShare: lamports,
    virtualPoolClaimableAmount: String(lamports),
    dammPoolClaimableAmount: String(dammLamports),
    claimableDisplayAmount: (lamports + dammLamports) / 1_000_000_000,
    userBps: 10000,
    tokenName: name,
    tokenSymbol: symbol,
  };
}

// Helper: set up feed to return specific agent names
function mockFeedAgents(agents: string[]) {
  mockGetFeed.mockImplementation((sort: string) => {
    if (sort === "hot") {
      return Promise.resolve(agents.map((a) => ({ author: a, id: a })));
    }
    return Promise.resolve([]);
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
    bulkWalletLookup: jest.Mock;
    getClaimablePositions: jest.Mock;
    getClaimStats: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jsonResponses.length = 0;

    mockApi = {
      bulkWalletLookup: jest.fn().mockResolvedValue([]),
      getClaimablePositions: jest.fn().mockResolvedValue([]),
      getClaimStats: jest.fn().mockResolvedValue([]),
    };

    (initBagsApi as jest.Mock).mockReturnValue(mockApi);
    (isNeonConfigured as jest.Mock).mockReturnValue(false);
    mockGetFeed.mockReset().mockResolvedValue([]);
    (getMoltbookOrNull as jest.Mock).mockReturnValue({ getFeed: mockGetFeed });

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

  it("returns empty earners when no agents discovered from feed", async () => {
    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();

    expect(body.success).toBe(true);
    expect(body.topEarners).toEqual([]);
  });

  it("returns earners sorted by total lifetime fees", async () => {
    mockFeedAgents(["Bagsy", "ChadGhost"]);

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

    // ChadGhost should be first (5 SOL unclaimed + 0 claimed > 2 SOL)
    expect(earners[0].username).toBe("ChadGhost");
    expect(earners[0].totalUnclaimedSol).toBeCloseTo(5.0);
    expect(earners[0].totalLifetimeFeesSol).toBeCloseTo(5.0);
    expect(earners[0].tokenCount).toBe(2);
    expect(earners[0].profilePic).toBe("https://example.com/chad.png");

    // Bagsy second
    expect(earners[1].username).toBe("Bagsy");
    expect(earners[1].totalUnclaimedSol).toBeCloseTo(2.0);
    expect(earners[1].totalLifetimeFeesSol).toBeCloseTo(2.0);
    expect(earners[1].tokenCount).toBe(1);
  });

  it("correctly converts lamports to SOL (divide by 1,000,000,000)", async () => {
    mockFeedAgents(["Bagsy"]);

    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "TestWallet111111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
        platformData: { displayName: "Bagsy" },
      },
    ]);

    // 19660432383 lamports = ~19.66 SOL
    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("ExampleMint111", 19660432383, "TEST", "Test Token"),
    ]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    expect(earners[0].totalUnclaimedSol).toBeCloseTo(19.660432383);

    const tokens = earners[0].tokens as Array<Record<string, unknown>>;
    expect(tokens[0].unclaimedSol).toBeCloseTo(19.660432383);
  });

  it("shows agents with zero claimable fees (sorted last)", async () => {
    mockFeedAgents(["Bagsy", "ChadGhost"]);

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
      return Promise.resolve([mockPosition("TokenB111", 0, "TOKB", "Token B")]);
    });

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(2);
    // Bagsy first (has fees), ChadGhost second (0 fees)
    expect(earners[0].username).toBe("Bagsy");
    expect(earners[0].totalUnclaimedSol).toBeCloseTo(1.0);
    expect(earners[1].username).toBe("ChadGhost");
    expect(earners[1].totalUnclaimedSol).toBe(0);
  });

  it("still shows agents whose claimable lookup fails (with 0 SOL)", async () => {
    mockFeedAgents(["Bagsy", "ChadGhost"]);

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
    expect(earners).toHaveLength(2);
    expect(earners[0].username).toBe("Bagsy");
    expect(earners[0].totalUnclaimedSol).toBeCloseTo(5.0);
    // ChadGhost still shows but with 0 (lookup failed)
    expect(earners[1].username).toBe("ChadGhost");
    expect(earners[1].totalUnclaimedSol).toBe(0);
  });

  it("returns at most 10 earners", async () => {
    mockFeedAgents(["Agent1", "Agent2"]);

    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "Wallet0111111111111111111111111111111111",
        provider: "moltbook",
        username: "Agent1",
      },
      {
        wallet: "Wallet1111111111111111111111111111111111",
        provider: "moltbook",
        username: "Agent2",
      },
    ]);

    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("Token111", 1_000_000_000, "TOK", "Token"),
    ]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners.length).toBeLessThanOrEqual(10);
  });

  it("sorts tokens within each earner by unclaimed fees descending", async () => {
    mockFeedAgents(["Bagsy"]);

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

  it("includes DAMM pool fees in total for migrated tokens", async () => {
    mockFeedAgents(["Bagsy", "ChadGhost"]);

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
        // Bagsy: 2 SOL virtual only
        return Promise.resolve([mockPosition("TokenA111", 2_000_000_000, "TOKA", "Token A")]);
      }
      // ChadGhost: 1 SOL virtual + 3 SOL DAMM = 4 SOL total (migrated token)
      return Promise.resolve([
        mockPosition("TokenB111", 1_000_000_000, "TOKB", "Token B", 3_000_000_000),
      ]);
    });

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(2);

    // ChadGhost first (4 SOL total: 1 virtual + 3 DAMM) > Bagsy (2 SOL)
    expect(earners[0].username).toBe("ChadGhost");
    expect(earners[0].totalUnclaimedSol).toBeCloseTo(4.0);

    expect(earners[1].username).toBe("Bagsy");
    expect(earners[1].totalUnclaimedSol).toBeCloseTo(2.0);

    // Verify per-token amount includes DAMM
    const chadTokens = earners[0].tokens as Array<Record<string, unknown>>;
    expect(chadTokens[0].unclaimedSol).toBeCloseTo(4.0);
  });

  it("includes external agents from DB when Neon is configured", async () => {
    (isNeonConfigured as jest.Mock).mockReturnValue(true);
    process.env.DATABASE_URL = "postgres://test:test@localhost/test";

    const mockSql = jest
      .fn()
      .mockResolvedValue([{ name: "ExternalBot", moltbook_username: "ExternalBot" }]);
    (neon as unknown as jest.Mock).mockReturnValue(mockSql);

    // Feed returns Bagsy + ChadGhost, DB adds ExternalBot
    mockFeedAgents(["Bagsy", "ChadGhost"]);

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

    // Verify bulk lookup was called with all 3 agents
    const lookupItems = mockApi.bulkWalletLookup.mock.calls[0][0] as Array<{
      username: string;
    }>;
    const usernames = lookupItems.map((i) => i.username);
    expect(usernames).toContain("ExternalBot");

    delete process.env.DATABASE_URL;
  });

  it("uses bulkWalletLookup with provider 'moltbook'", async () => {
    mockFeedAgents(["Bagsy", "ChadGhost"]);

    mockApi.bulkWalletLookup.mockResolvedValue([]);

    await GET(makeRequest({ nocache: "" }));

    expect(mockApi.bulkWalletLookup).toHaveBeenCalledTimes(1);
    const items = mockApi.bulkWalletLookup.mock.calls[0][0] as Array<{
      provider: string;
      username: string;
    }>;
    for (const item of items) {
      expect(item.provider).toBe("moltbook");
    }
  });

  it("includes lastUpdated timestamp", async () => {
    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();

    expect(body.lastUpdated).toBeDefined();
    expect(new Date(body.lastUpdated as string).getTime()).not.toBeNaN();
  });

  it("handles bulk lookup failure gracefully", async () => {
    mockFeedAgents(["Bagsy"]);

    mockApi.bulkWalletLookup.mockRejectedValue(new Error("Network error"));

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();

    expect(body.success).toBe(true);
    expect(body.topEarners).toEqual([]);
  });

  it("calculates lifetime fees as claimed + unclaimed", async () => {
    mockFeedAgents(["Bagsy"]);

    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "BagsyWallet111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
        platformData: { displayName: "Bagsy" },
      },
    ]);

    // 2 SOL unclaimed
    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("TokenA111", 2_000_000_000, "TOKA", "Token A"),
    ]);

    // 3 SOL claimed
    mockApi.getClaimStats.mockResolvedValue([
      {
        user: "BagsyWallet111111111111111111111111111111",
        totalClaimed: 3_000_000_000,
        claimCount: 2,
        lastClaimTime: Date.now(),
      },
    ]);

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(earners).toHaveLength(1);
    expect(earners[0].totalUnclaimedSol).toBeCloseTo(2.0);
    expect(earners[0].totalLifetimeFeesSol).toBeCloseTo(5.0); // 2 + 3

    const tokens = earners[0].tokens as Array<Record<string, unknown>>;
    expect(tokens[0].unclaimedSol).toBeCloseTo(2.0);
    expect(tokens[0].claimedSol).toBeCloseTo(3.0);
    expect(tokens[0].lifetimeFeesSol).toBeCloseTo(5.0);
  });

  it("deduplicates getClaimStats calls for shared mints", async () => {
    mockFeedAgents(["Bagsy", "ChadGhost"]);

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

    // Both agents have the same token mint
    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("SharedMint", 1_000_000_000, "SHAR", "Shared Token"),
    ]);

    mockApi.getClaimStats.mockResolvedValue([]);

    await GET(makeRequest({ nocache: "" }));

    // Should only call getClaimStats once for the shared mint
    expect(mockApi.getClaimStats).toHaveBeenCalledTimes(1);
    expect(mockApi.getClaimStats).toHaveBeenCalledWith("SharedMint");
  });

  it("handles getClaimStats failure gracefully (defaults claimed to 0)", async () => {
    mockFeedAgents(["Bagsy"]);

    mockApi.bulkWalletLookup.mockResolvedValue([
      {
        wallet: "Wallet1111111111111111111111111111111111111",
        provider: "moltbook",
        username: "Bagsy",
      },
    ]);

    // 4 SOL unclaimed
    mockApi.getClaimablePositions.mockResolvedValue([
      mockPosition("TokenA111", 4_000_000_000, "TOKA", "Token A"),
    ]);

    // ClaimStats fails
    mockApi.getClaimStats.mockRejectedValue(new Error("API error"));

    await GET(makeRequest({ nocache: "" }));
    const { body } = lastResponse();
    const earners = body.topEarners as Array<Record<string, unknown>>;

    expect(body.success).toBe(true);
    expect(earners).toHaveLength(1);
    // claimed defaults to 0, so lifetime = unclaimed only
    expect(earners[0].totalUnclaimedSol).toBeCloseTo(4.0);
    expect(earners[0].totalLifetimeFeesSol).toBeCloseTo(4.0);

    const tokens = earners[0].tokens as Array<Record<string, unknown>>;
    expect(tokens[0].claimedSol).toBe(0);
    expect(tokens[0].lifetimeFeesSol).toBeCloseTo(4.0);
  });
});
