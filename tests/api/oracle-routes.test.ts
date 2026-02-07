/**
 * Oracle API Route Tests
 *
 * Tests the new Oracle API endpoints:
 * - POST /api/oracle/predict - Enter prediction with OP
 * - POST /api/oracle/claim-daily - Claim daily OP bonus
 * - GET  /api/oracle/profile - Get user profile + stats
 * - GET  /api/oracle/markets - Browse active markets
 * - POST /api/oracle/auto-resolve - Cron-triggered resolution
 *
 * Uses Next.js route handler pattern: import the handler and call with mock Request.
 */

// ─── Mock NextResponse to avoid body consumption issues in jsdom ──

jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextRequest: actual.NextRequest ?? class NextRequest extends Request {},
    NextResponse: {
      json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
        return {
          status: init?.status || 200,
          headers: new Headers(init?.headers),
          ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
          _body: data,
          json: async () => data,
          text: async () => JSON.stringify(data),
        };
      },
    },
  };
});

// ─── Mock all external dependencies ──────────────────────────────

const mockIsNeonConfigured = jest.fn();
const mockInitializeOracleTables = jest.fn();
const mockGetActiveOracleMarkets = jest.fn();
const mockEnterOraclePrediction = jest.fn();
const mockGetOraclePredictionCounts = jest.fn();
const mockGetUserOraclePrediction = jest.fn();
const mockGetMarketsToResolve = jest.fn();
const mockSettleOracleRound = jest.fn();
const mockSettleOracleRoundWithOutcome = jest.fn();
const mockGetOracleRoundPredictions = jest.fn();
const mockUpdatePredictionOPPayout = jest.fn();

jest.mock("@/lib/neon", () => ({
  isNeonConfigured: () => mockIsNeonConfigured(),
  initializeOracleTables: () => mockInitializeOracleTables(),
  getActiveOracleMarkets: (...args: unknown[]) => mockGetActiveOracleMarkets(...args),
  enterOraclePrediction: (...args: unknown[]) => mockEnterOraclePrediction(...args),
  getOraclePredictionCounts: (...args: unknown[]) => mockGetOraclePredictionCounts(...args),
  getUserOraclePrediction: (...args: unknown[]) => mockGetUserOraclePrediction(...args),
  getMarketsToResolve: () => mockGetMarketsToResolve(),
  settleOracleRound: (...args: unknown[]) => mockSettleOracleRound(...args),
  settleOracleRoundWithOutcome: (...args: unknown[]) => mockSettleOracleRoundWithOutcome(...args),
  getOracleRoundPredictions: (...args: unknown[]) => mockGetOracleRoundPredictions(...args),
  updatePredictionOPPayout: (...args: unknown[]) => mockUpdatePredictionOPPayout(...args),
}));

const mockGetOrCreateUser = jest.fn();
const mockDeductOP = jest.fn();
const mockAddOP = jest.fn();
const mockClaimFirstPredictionBonus = jest.fn();
const mockClaimDailyBonus = jest.fn();
const mockGetOPLedger = jest.fn();
const mockGetReputationTierBonus = jest.fn();
const mockUpdateStreak = jest.fn();
const mockUpdateReputation = jest.fn();

jest.mock("@/lib/op-economy", () => ({
  getOrCreateUser: (...args: unknown[]) => mockGetOrCreateUser(...args),
  deductOP: (...args: unknown[]) => mockDeductOP(...args),
  addOP: (...args: unknown[]) => mockAddOP(...args),
  claimFirstPredictionBonus: (...args: unknown[]) => mockClaimFirstPredictionBonus(...args),
  claimDailyBonus: (...args: unknown[]) => mockClaimDailyBonus(...args),
  getOPLedger: (...args: unknown[]) => mockGetOPLedger(...args),
  getReputationTierBonus: (...args: unknown[]) => mockGetReputationTierBonus(...args),
  updateStreak: (...args: unknown[]) => mockUpdateStreak(...args),
  updateReputation: (...args: unknown[]) => mockUpdateReputation(...args),
}));

const mockResolveMarket = jest.fn();
const mockCalculateOPPayouts = jest.fn();

jest.mock("@/lib/oracle-resolver", () => ({
  resolveMarket: (...args: unknown[]) => mockResolveMarket(...args),
  calculateOPPayouts: (...args: unknown[]) => mockCalculateOPPayouts(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────

function makeRound(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: "active",
    startTime: new Date("2025-01-01T00:00:00Z"),
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    tokenOptions: [{ mint: "mint_a", symbol: "AAA", name: "Token A", startPrice: 1.0 }],
    entryCount: 5,
    prizePoolLamports: BigInt(0),
    entryCostOp: 100,
    marketType: "price_prediction",
    marketConfig: {
      outcome_type: "multiple_choice",
      question: "Which token gains?",
      outcomes: [{ id: "mint_a", label: "AAA" }],
    },
    autoResolve: true,
    createdBy: "auto_generator",
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    wallet: "testWallet",
    opBalance: 1000,
    totalOpEarned: 1000,
    totalOpSpent: 0,
    firstPredictionBonus: false,
    lastDailyClaim: undefined,
    currentStreak: 0,
    bestStreak: 0,
    reputationScore: 1000,
    reputationTier: "seer",
    totalMarketsEntered: 0,
    totalMarketsWon: 0,
    achievements: {},
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

async function getJsonBody(response: any) {
  return response.json();
}

// ─── /api/oracle/predict ─────────────────────────────────────────

describe("POST /api/oracle/predict", () => {
  // Import inside describe to ensure mocks are set up first
  let POST: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/oracle/predict/route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNeonConfigured.mockReturnValue(true);
    mockInitializeOracleTables.mockResolvedValue(undefined);
  });

  it("returns 503 when Neon not configured", async () => {
    mockIsNeonConfigured.mockReturnValue(false);

    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 1, tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("returns 400 when wallet is missing", async () => {
    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ roundId: 1, tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await getJsonBody(res);
    expect(body.error).toBe("Missing wallet");
  });

  it("returns 400 when roundId is missing", async () => {
    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await getJsonBody(res);
    expect(body.error).toBe("Missing roundId");
  });

  it("returns 400 when both tokenMint and outcomeId are missing", async () => {
    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 1 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await getJsonBody(res);
    expect(body.error).toBe("Missing tokenMint or outcomeId");
  });

  it("returns 500 when user creation fails", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);

    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 1, tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 when market not found", async () => {
    mockGetOrCreateUser.mockResolvedValue(makeUser());
    mockGetActiveOracleMarkets.mockResolvedValue([]); // No active markets

    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 999, tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await getJsonBody(res);
    expect(body.error).toBe("Market not found or not active");
  });

  it("returns 400 when OP balance is insufficient", async () => {
    mockGetOrCreateUser.mockResolvedValue(makeUser({ opBalance: 50 }));
    mockGetActiveOracleMarkets.mockResolvedValue([makeRound({ entryCostOp: 100 })]);

    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 1, tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await getJsonBody(res);
    expect(body.error).toContain("Insufficient OP");
    expect(body.opRequired).toBe(100);
    expect(body.opBalance).toBe(50);
  });

  it("returns 400 when deductOP fails", async () => {
    mockGetOrCreateUser.mockResolvedValue(makeUser({ opBalance: 1000 }));
    mockGetActiveOracleMarkets.mockResolvedValue([makeRound()]);
    mockDeductOP.mockResolvedValue({ success: false, error: "Insufficient OP balance" });

    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 1, tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("refunds OP when prediction entry fails", async () => {
    mockGetOrCreateUser.mockResolvedValue(makeUser({ opBalance: 1000 }));
    mockGetActiveOracleMarkets.mockResolvedValue([makeRound()]);
    mockDeductOP.mockResolvedValue({ success: true, newBalance: 900 });
    mockEnterOraclePrediction.mockResolvedValue({ success: false, error: "Already entered" });

    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 1, tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    // Verify refund was called
    expect(mockAddOP).toHaveBeenCalledWith("w1", 100, "prediction_entry", 1);
  });

  it("succeeds with full flow: deduct OP, enter prediction, award participation", async () => {
    mockGetOrCreateUser.mockResolvedValue(makeUser({ opBalance: 1000 }));
    mockGetActiveOracleMarkets.mockResolvedValue([makeRound()]);
    mockDeductOP.mockResolvedValue({ success: true, newBalance: 900 });
    mockEnterOraclePrediction.mockResolvedValue({ success: true });
    mockClaimFirstPredictionBonus.mockResolvedValue({ success: false }); // Already claimed
    mockAddOP.mockResolvedValue({ success: true, newBalance: 910 });

    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 1, tokenMint: "mint_a" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await getJsonBody(res);
    expect(body.success).toBe(true);
    expect(body.opDeducted).toBe(100);
    expect(body.opParticipation).toBe(10);
    expect(body.newOpBalance).toBe(910); // 900 + 10 participation
    expect(body.marketType).toBe("price_prediction");

    // Verify participation reward was given
    expect(mockAddOP).toHaveBeenCalledWith("w1", 10, "participation", 1);
  });

  it("accepts outcomeId instead of tokenMint for binary markets", async () => {
    mockGetOrCreateUser.mockResolvedValue(makeUser({ opBalance: 1000 }));
    mockGetActiveOracleMarkets.mockResolvedValue([makeRound({ marketType: "world_health" })]);
    mockDeductOP.mockResolvedValue({ success: true, newBalance: 900 });
    mockEnterOraclePrediction.mockResolvedValue({ success: true });
    mockClaimFirstPredictionBonus.mockResolvedValue({ success: false });
    mockAddOP.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/api/oracle/predict", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1", roundId: 1, outcomeId: "yes" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await getJsonBody(res);
    expect(body.outcomeId).toBe("yes");
  });
});

// ─── /api/oracle/claim-daily ─────────────────────────────────────

describe("POST /api/oracle/claim-daily", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/oracle/claim-daily/route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNeonConfigured.mockReturnValue(true);
    mockInitializeOracleTables.mockResolvedValue(undefined);
  });

  it("returns 503 when Neon not configured", async () => {
    mockIsNeonConfigured.mockReturnValue(false);

    const req = new Request("http://localhost/api/oracle/claim-daily", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("returns 400 when wallet is missing", async () => {
    const req = new Request("http://localhost/api/oracle/claim-daily", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await getJsonBody(res);
    expect(body.error).toBe("Missing wallet");
  });

  it("returns 400 when bonus already claimed", async () => {
    mockClaimDailyBonus.mockResolvedValue({
      success: false,
      error: "Daily bonus already claimed",
      nextClaimAt: "2025-01-02T00:00:00Z",
    });

    const req = new Request("http://localhost/api/oracle/claim-daily", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await getJsonBody(res);
    expect(body.error).toBe("Daily bonus already claimed");
    expect(body.nextClaimAt).toBe("2025-01-02T00:00:00Z");
  });

  it("returns success with amount and new balance", async () => {
    mockClaimDailyBonus.mockResolvedValue({
      success: true,
      amount: 55,
      newBalance: 1055,
    });

    const req = new Request("http://localhost/api/oracle/claim-daily", {
      method: "POST",
      body: JSON.stringify({ wallet: "w1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await getJsonBody(res);
    expect(body.success).toBe(true);
    expect(body.amount).toBe(55);
    expect(body.newBalance).toBe(1055);
    expect(body.message).toContain("55 OP");
  });
});

// ─── /api/oracle/profile ─────────────────────────────────────────

describe("GET /api/oracle/profile", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/oracle/profile/route");
    GET = mod.GET as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNeonConfigured.mockReturnValue(true);
    mockInitializeOracleTables.mockResolvedValue(undefined);
  });

  it("returns 503 when Neon not configured", async () => {
    mockIsNeonConfigured.mockReturnValue(false);

    const req = new Request("http://localhost/api/oracle/profile?wallet=w1");
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it("returns 400 when wallet is missing", async () => {
    const req = new Request("http://localhost/api/oracle/profile");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await getJsonBody(res);
    expect(body.error).toBe("Missing wallet");
  });

  it("returns 500 when user creation fails", async () => {
    mockGetOrCreateUser.mockResolvedValue(null);

    const req = new Request("http://localhost/api/oracle/profile?wallet=bad");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("returns full profile with computed fields", async () => {
    const user = makeUser({
      totalMarketsEntered: 20,
      totalMarketsWon: 8,
      reputationTier: "oracle",
      lastDailyClaim: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    mockGetOrCreateUser.mockResolvedValue(user);
    mockGetOPLedger.mockResolvedValue([]);
    mockGetReputationTierBonus.mockReturnValue(0.2);

    const req = new Request("http://localhost/api/oracle/profile?wallet=w1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await getJsonBody(res);

    expect(body.success).toBe(true);
    expect(body.profile.winRate).toBe(40); // 8/20 = 40%
    expect(body.profile.tierBonus).toBe("+20%");
    expect(body.profile.canClaimDaily).toBe(true); // 25h since last claim
  });

  it("canClaimDaily is false when claimed recently", async () => {
    const user = makeUser({
      lastDailyClaim: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6h ago
    });
    mockGetOrCreateUser.mockResolvedValue(user);
    mockGetOPLedger.mockResolvedValue([]);
    mockGetReputationTierBonus.mockReturnValue(0);

    const req = new Request("http://localhost/api/oracle/profile?wallet=w1");
    const res = await GET(req);
    const body = await getJsonBody(res);

    expect(body.profile.canClaimDaily).toBe(false);
    expect(body.profile.nextDailyClaimAt).toBeDefined();
  });

  it("winRate is 0 when no markets entered", async () => {
    mockGetOrCreateUser.mockResolvedValue(makeUser());
    mockGetOPLedger.mockResolvedValue([]);
    mockGetReputationTierBonus.mockReturnValue(0);

    const req = new Request("http://localhost/api/oracle/profile?wallet=w1");
    const res = await GET(req);
    const body = await getJsonBody(res);

    expect(body.profile.winRate).toBe(0);
  });
});

// ─── /api/oracle/markets ─────────────────────────────────────────

describe("GET /api/oracle/markets", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/oracle/markets/route");
    GET = mod.GET as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNeonConfigured.mockReturnValue(true);
    mockInitializeOracleTables.mockResolvedValue(undefined);
  });

  it("returns 503 when Neon not configured", async () => {
    mockIsNeonConfigured.mockReturnValue(false);

    const req = new Request("http://localhost/api/oracle/markets");
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it("returns empty markets list", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([]);

    const req = new Request("http://localhost/api/oracle/markets");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await getJsonBody(res);

    expect(body.success).toBe(true);
    expect(body.markets).toEqual([]);
    expect(body.totalActive).toBe(0);
  });

  it("returns markets with prediction counts and computed fields", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([makeRound()]);
    mockGetOraclePredictionCounts.mockResolvedValue({ mint_a: 3 });
    mockGetUserOraclePrediction.mockResolvedValue(null);

    const req = new Request("http://localhost/api/oracle/markets");
    const res = await GET(req);
    const body = await getJsonBody(res);

    expect(body.success).toBe(true);
    expect(body.totalActive).toBe(1);
    expect(body.markets[0].id).toBe(1);
    expect(body.markets[0].marketType).toBe("price_prediction");
    expect(body.markets[0].entryCostOp).toBe(100);
    expect(body.markets[0].predictionCounts).toEqual({ mint_a: 3 });
    expect(body.markets[0].remainingMs).toBeGreaterThan(0);
  });

  it("includes user prediction when wallet is provided", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([makeRound()]);
    mockGetOraclePredictionCounts.mockResolvedValue({});
    mockGetUserOraclePrediction.mockResolvedValue({
      tokenMint: "mint_a",
      outcomeId: null,
      opWagered: 100,
      createdAt: new Date("2025-01-01T12:00:00Z"),
    });

    const req = new Request("http://localhost/api/oracle/markets?wallet=w1");
    const res = await GET(req);
    const body = await getJsonBody(res);

    expect(body.markets[0].userPrediction).not.toBeNull();
    expect(body.markets[0].userPrediction.tokenMint).toBe("mint_a");
    expect(body.markets[0].userPrediction.opWagered).toBe(100);
  });

  it("does not include user prediction when no wallet param", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([makeRound()]);
    mockGetOraclePredictionCounts.mockResolvedValue({});

    const req = new Request("http://localhost/api/oracle/markets");
    const res = await GET(req);
    const body = await getJsonBody(res);

    expect(body.markets[0].userPrediction).toBeNull();
    expect(mockGetUserOraclePrediction).not.toHaveBeenCalled();
  });

  it("passes market type filter", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([]);

    const req = new Request("http://localhost/api/oracle/markets?type=world_health");
    const res = await GET(req);

    expect(mockGetActiveOracleMarkets).toHaveBeenCalledWith("world_health");
  });
});

// ─── /api/oracle/auto-resolve ────────────────────────────────────

describe("POST /api/oracle/auto-resolve", () => {
  let POST: (req: Request) => Promise<Response>;
  const ORIGINAL_ENV = process.env;

  beforeAll(async () => {
    const mod = await import("@/app/api/oracle/auto-resolve/route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, AGENT_SECRET: "test-secret" };
    mockIsNeonConfigured.mockReturnValue(true);
    mockInitializeOracleTables.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns 403 without auth header", async () => {
    const req = new Request("http://localhost/api/oracle/auto-resolve", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 with wrong secret", async () => {
    const req = new Request("http://localhost/api/oracle/auto-resolve", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 503 when Neon not configured", async () => {
    mockIsNeonConfigured.mockReturnValue(false);

    const req = new Request("http://localhost/api/oracle/auto-resolve", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("returns resolved: 0 when no markets to resolve", async () => {
    mockGetMarketsToResolve.mockResolvedValue([]);

    const req = new Request("http://localhost/api/oracle/auto-resolve", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await getJsonBody(res);
    expect(body.resolved).toBe(0);
  });

  it("resolves markets and distributes OP payouts", async () => {
    const round = makeRound({
      id: 42,
      marketType: "world_health",
      endTime: new Date(Date.now() - 1000), // Expired
    });
    mockGetMarketsToResolve.mockResolvedValue([round]);
    mockResolveMarket.mockResolvedValue({
      success: true,
      winningOutcomeId: "yes",
      resolutionData: { currentHealth: 75, threshold: 50 },
    });
    mockSettleOracleRoundWithOutcome.mockResolvedValue(undefined);
    mockGetOracleRoundPredictions.mockResolvedValue([
      { id: 1, wallet: "w1", opWagered: 100, createdAt: new Date() },
      { id: 2, wallet: "w2", opWagered: 100, createdAt: new Date() },
    ]);
    mockCalculateOPPayouts.mockReturnValue([
      { predictionId: 1, wallet: "w1", isWinner: true, opWagered: 100, opPayout: 200, rank: 1 },
      { predictionId: 2, wallet: "w2", isWinner: false, opWagered: 100, opPayout: 0 },
    ]);
    mockUpdatePredictionOPPayout.mockResolvedValue(undefined);
    mockAddOP.mockResolvedValue({ success: true });
    mockUpdateStreak.mockResolvedValue(undefined);
    mockUpdateReputation.mockResolvedValue(undefined);

    const req = new Request("http://localhost/api/oracle/auto-resolve", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await getJsonBody(res);

    expect(body.resolved).toBe(1);
    expect(body.results[0].success).toBe(true);
    expect(body.results[0].winningOutcome).toBe("yes");

    // Verify winner got OP credited
    expect(mockAddOP).toHaveBeenCalledWith("w1", 200, "prediction_win", 42);
    // Loser should NOT get addOP call (0 payout)
    expect(mockAddOP).not.toHaveBeenCalledWith(
      "w2",
      expect.anything(),
      expect.anything(),
      expect.anything()
    );

    // Both should have streak/reputation updated
    expect(mockUpdateStreak).toHaveBeenCalledTimes(2);
    expect(mockUpdateReputation).toHaveBeenCalledTimes(2);
  });

  it("reports error when resolution fails for a market", async () => {
    mockGetMarketsToResolve.mockResolvedValue([makeRound({ id: 10 })]);
    mockResolveMarket.mockResolvedValue({
      success: false,
      resolutionData: {},
      error: "API down",
    });

    const req = new Request("http://localhost/api/oracle/auto-resolve", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await POST(req);
    const body = await getJsonBody(res);

    expect(body.resolved).toBe(0);
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toBe("API down");
  });

  it("continues resolving other markets when one throws", async () => {
    mockGetMarketsToResolve.mockResolvedValue([makeRound({ id: 1 }), makeRound({ id: 2 })]);
    // First market throws
    mockResolveMarket.mockRejectedValueOnce(new Error("Crash")).mockResolvedValueOnce({
      success: true,
      winningOutcomeId: "yes",
      resolutionData: {},
    });
    mockSettleOracleRoundWithOutcome.mockResolvedValue(undefined);
    mockGetOracleRoundPredictions.mockResolvedValue([]);

    const req = new Request("http://localhost/api/oracle/auto-resolve", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await POST(req);
    const body = await getJsonBody(res);

    expect(body.total).toBe(2);
    expect(body.resolved).toBe(1); // Only second succeeded
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toBe("Crash");
    expect(body.results[1].success).toBe(true);
  });

  it("uses ORACLE_AUTO_RESOLVE_SECRET if available", async () => {
    process.env.ORACLE_AUTO_RESOLVE_SECRET = "oracle-specific-secret";
    mockGetMarketsToResolve.mockResolvedValue([]);

    const req = new Request("http://localhost/api/oracle/auto-resolve", {
      method: "POST",
      headers: { authorization: "Bearer oracle-specific-secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    delete process.env.ORACLE_AUTO_RESOLVE_SECRET;
  });
});
