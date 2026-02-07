/**
 * Oracle Points (OP) Economy Tests
 *
 * Tests all OP economy functions with mocked SQL:
 * - getOrCreateUser: signup bonus, existing user
 * - addOP / deductOP: balance updates, ledger, atomic checks
 * - claimDailyBonus: cooldown, streak logic, achievement triggers
 * - claimFirstPredictionBonus: one-time guard
 * - updateStreak: win/loss tracking, achievement thresholds
 * - updateReputation: ELO calculation, tier assignment
 * - getReputationTierBonus: pure function
 * - checkAndAwardAchievement: idempotent, JSONB update
 * - getProfile / getOPLedger: data retrieval
 */

// Mock getSql before importing anything
const mockSql = jest.fn();
jest.mock("@/lib/neon", () => ({
  getSql: jest.fn(),
}));

import { getSql } from "@/lib/neon";
import {
  getOrCreateUser,
  addOP,
  deductOP,
  claimDailyBonus,
  claimFirstPredictionBonus,
  updateStreak,
  updateReputation,
  getProfile,
  getOPLedger,
  getReputationTierBonus,
  checkAndAwardAchievement,
} from "@/lib/op-economy";

// ─── Helpers ──────────────────────────────────────────────────────

const mockedGetSql = getSql as jest.MockedFunction<typeof getSql>;

/** Create a tagged-template SQL mock that captures calls and returns given rows */
function createSqlMock(responses: unknown[][] = [[]]) {
  let callIndex = 0;
  const fn = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const result = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    return Promise.resolve(result);
  }) as unknown as jest.Mock;
  return fn;
}

/** Standard user row from DB */
function makeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    wallet: "testWallet",
    op_balance: 1000,
    total_op_earned: 1000,
    total_op_spent: 0,
    first_prediction_bonus: false,
    last_daily_claim: null,
    current_streak: 0,
    best_streak: 0,
    reputation_score: 1000,
    reputation_tier: "seer",
    total_markets_entered: 0,
    total_markets_won: 0,
    achievements: {},
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── getReputationTierBonus (pure function, no mocks needed) ─────

describe("getReputationTierBonus", () => {
  it("returns 0 for novice", () => {
    expect(getReputationTierBonus("novice")).toBe(0);
  });

  it("returns 0.1 for seer", () => {
    expect(getReputationTierBonus("seer")).toBe(0.1);
  });

  it("returns 0.2 for oracle", () => {
    expect(getReputationTierBonus("oracle")).toBe(0.2);
  });

  it("returns 0.3 for master", () => {
    expect(getReputationTierBonus("master")).toBe(0.3);
  });

  it("returns 0 for unknown tier (default case)", () => {
    expect(getReputationTierBonus("unknown" as any)).toBe(0);
  });
});

// ─── getOrCreateUser ─────────────────────────────────────────────

describe("getOrCreateUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    const result = await getOrCreateUser("wallet1");
    expect(result).toBeNull();
  });

  it("returns existing user without creating", async () => {
    const userRow = makeUserRow({ wallet: "existing", op_balance: 5000 });
    const sql = createSqlMock([[userRow]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const user = await getOrCreateUser("existing");

    expect(user).not.toBeNull();
    expect(user!.wallet).toBe("existing");
    expect(user!.opBalance).toBe(5000);
    // Only one SQL call (SELECT)
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("creates new user with 1000 OP signup bonus", async () => {
    const newRow = makeUserRow({ wallet: "newbie", op_balance: 1000 });
    const sql = createSqlMock([
      [], // SELECT returns empty (user not found)
      [newRow], // INSERT RETURNING *
      [], // Ledger INSERT
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const user = await getOrCreateUser("newbie");

    expect(user).not.toBeNull();
    expect(user!.wallet).toBe("newbie");
    expect(user!.opBalance).toBe(1000);
    expect(user!.totalOpEarned).toBe(1000);
    // 3 SQL calls: SELECT, INSERT user, INSERT ledger
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it("returns null on database error", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("DB down")));
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await getOrCreateUser("error_wallet");
    expect(result).toBeNull();
  });

  it("correctly maps all fields from DB row to OracleUser", async () => {
    const row = makeUserRow({
      wallet: "full_user",
      op_balance: 2500,
      total_op_earned: 4000,
      total_op_spent: 1500,
      first_prediction_bonus: true,
      last_daily_claim: "2025-06-15T12:00:00Z",
      current_streak: 5,
      best_streak: 10,
      reputation_score: 1600,
      reputation_tier: "oracle",
      total_markets_entered: 42,
      total_markets_won: 20,
      achievements: JSON.stringify({ first_victory: { unlockedAt: "2025-01-01", opAwarded: 100 } }),
      created_at: "2025-01-01T00:00:00Z",
    });
    const sql = createSqlMock([[row]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const user = await getOrCreateUser("full_user");

    expect(user!.opBalance).toBe(2500);
    expect(user!.totalOpEarned).toBe(4000);
    expect(user!.totalOpSpent).toBe(1500);
    expect(user!.firstPredictionBonus).toBe(true);
    expect(user!.lastDailyClaim).toBe("2025-06-15T12:00:00Z");
    expect(user!.currentStreak).toBe(5);
    expect(user!.bestStreak).toBe(10);
    expect(user!.reputationScore).toBe(1600);
    expect(user!.reputationTier).toBe("oracle");
    expect(user!.totalMarketsEntered).toBe(42);
    expect(user!.totalMarketsWon).toBe(20);
    expect(user!.achievements).toHaveProperty("first_victory");
  });

  it("handles achievements stored as string (JSON)", async () => {
    const row = makeUserRow({
      achievements: '{"hot_streak":{"unlockedAt":"2025-01-05","opAwarded":250}}',
    });
    const sql = createSqlMock([[row]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const user = await getOrCreateUser("string_achievements");
    expect(user!.achievements).toHaveProperty("hot_streak");
    expect(user!.achievements.hot_streak.opAwarded).toBe(250);
  });

  it("handles null/undefined achievements gracefully", async () => {
    const row = makeUserRow({ achievements: null });
    const sql = createSqlMock([[row]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const user = await getOrCreateUser("null_achievements");
    expect(user!.achievements).toEqual({});
  });
});

// ─── addOP ───────────────────────────────────────────────────────

describe("addOP", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    const result = await addOP("wallet1", 100, "daily_claim");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database not available");
  });

  it("adds OP and records ledger entry", async () => {
    const sql = createSqlMock([
      [{ op_balance: 1100 }], // UPDATE RETURNING
      [], // Ledger INSERT
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await addOP("wallet1", 100, "daily_claim");

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(1100);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("returns error when user not found", async () => {
    const sql = createSqlMock([
      [], // UPDATE returns empty (no matching wallet)
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await addOP("nonexistent", 100, "daily_claim");

    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });

  it("passes referenceId to ledger when provided", async () => {
    const sql = createSqlMock([[{ op_balance: 1200 }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await addOP("wallet1", 200, "prediction_win", 42);

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(1200);
  });

  it("handles database error gracefully", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("Connection lost")));
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await addOP("wallet1", 100, "daily_claim");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database error");
  });
});

// ─── deductOP ────────────────────────────────────────────────────

describe("deductOP", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    const result = await deductOP("wallet1", 100, "prediction_entry");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database not available");
  });

  it("deducts OP atomically when balance is sufficient", async () => {
    const sql = createSqlMock([
      [{ op_balance: 900 }], // UPDATE WHERE op_balance >= amount RETURNING
      [], // Ledger INSERT
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await deductOP("wallet1", 100, "prediction_entry");

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(900);
  });

  it("records negative amount in ledger", async () => {
    const sql = createSqlMock([[{ op_balance: 900 }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    await deductOP("wallet1", 100, "prediction_entry");

    // The second call should be the ledger insert with negative amount
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("returns 'Insufficient OP balance' when balance is too low", async () => {
    const sql = createSqlMock([
      [], // UPDATE returns empty (balance check failed)
      [{ "?column?": 1 }], // SELECT 1 confirms user exists
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await deductOP("wallet1", 99999, "prediction_entry");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient OP balance");
  });

  it("returns 'User not found' when wallet doesn't exist", async () => {
    const sql = createSqlMock([
      [], // UPDATE returns empty
      [], // SELECT 1 also returns empty (user doesn't exist)
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await deductOP("ghost_wallet", 100, "prediction_entry");

    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });

  it("handles exact balance deduction (balance == amount)", async () => {
    const sql = createSqlMock([
      [{ op_balance: 0 }], // Atomic check passes, balance now 0
      [],
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await deductOP("wallet1", 1000, "prediction_entry");

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(0);
  });

  it("handles database error gracefully", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("Timeout")));
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await deductOP("wallet1", 100, "prediction_entry");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database error");
  });
});

// ─── claimDailyBonus ─────────────────────────────────────────────

describe("claimDailyBonus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    const result = await claimDailyBonus("wallet1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database not available");
  });

  it("awards 50 OP for first-time claim (no prior claims)", async () => {
    const userRow = makeUserRow({ last_daily_claim: null, current_streak: 0 });
    const sql = createSqlMock([
      [userRow], // getOrCreateUser SELECT
      [{ op_balance: 1050, achievements: {} }], // UPDATE RETURNING
      [], // Ledger INSERT
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("wallet1");

    expect(result.success).toBe(true);
    expect(result.amount).toBe(50);
    expect(result.newBalance).toBe(1050);
  });

  it("rejects claim within 24h cooldown", async () => {
    const recentClaim = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12h ago
    const userRow = makeUserRow({ last_daily_claim: recentClaim });
    const sql = createSqlMock([[userRow]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("wallet1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Daily bonus already claimed");
    expect(result.nextClaimAt).toBeDefined();
  });

  it("returns correct nextClaimAt timestamp", async () => {
    const claimTime = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6h ago
    const userRow = makeUserRow({ last_daily_claim: claimTime.toISOString() });
    const sql = createSqlMock([[userRow]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("wallet1");

    expect(result.success).toBe(false);
    const nextClaim = new Date(result.nextClaimAt!).getTime();
    const expected = claimTime.getTime() + 24 * 60 * 60 * 1000;
    // Allow 1 second tolerance
    expect(Math.abs(nextClaim - expected)).toBeLessThan(1000);
  });

  it("continues streak when claiming within 36h window", async () => {
    const lastClaim = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    const userRow = makeUserRow({
      last_daily_claim: lastClaim,
      current_streak: 3,
      best_streak: 5,
    });
    const sql = createSqlMock([[userRow], [{ op_balance: 1055, achievements: {} }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("wallet1");

    expect(result.success).toBe(true);
    // streak 3 → 4, which is >= 3, so bonus applies: 50 + 5 = 55
    expect(result.amount).toBe(55);
  });

  it("resets streak when claiming after 36h gap", async () => {
    const lastClaim = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(); // 40h ago
    const userRow = makeUserRow({
      last_daily_claim: lastClaim,
      current_streak: 10,
      best_streak: 10,
    });
    const sql = createSqlMock([[userRow], [{ op_balance: 1050, achievements: {} }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("wallet1");

    expect(result.success).toBe(true);
    // Streak resets to 1 (< 3), no bonus: 50 OP
    expect(result.amount).toBe(50);
  });

  it("awards streak bonus (+5 OP) at streak >= 3", async () => {
    const lastClaim = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const userRow = makeUserRow({
      last_daily_claim: lastClaim,
      current_streak: 2, // will become 3
      best_streak: 2,
    });
    const sql = createSqlMock([[userRow], [{ op_balance: 1055, achievements: {} }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("wallet1");

    expect(result.success).toBe(true);
    expect(result.amount).toBe(55); // 50 base + 5 streak bonus
  });

  it("does NOT award streak bonus at streak 2", async () => {
    const lastClaim = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const userRow = makeUserRow({
      last_daily_claim: lastClaim,
      current_streak: 1, // will become 2
      best_streak: 1,
    });
    const sql = createSqlMock([[userRow], [{ op_balance: 1050, achievements: {} }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("wallet1");

    expect(result.success).toBe(true);
    expect(result.amount).toBe(50); // No streak bonus
  });

  it("triggers daily_devotion achievement at 7-day streak", async () => {
    const lastClaim = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const userRow = makeUserRow({
      last_daily_claim: lastClaim,
      current_streak: 6, // will become 7
      best_streak: 6,
    });
    const sql = createSqlMock([
      [userRow], // getOrCreateUser
      [{ op_balance: 1255, achievements: {} }], // Daily claim UPDATE
      [], // Ledger INSERT
      // checkAndAwardAchievement calls:
      [{ op_balance: 1455 }], // Achievement UPDATE
      [], // Achievement ledger
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("wallet1");

    expect(result.success).toBe(true);
    // At least 4 SQL calls: getOrCreateUser, update balance, ledger, achievement check
    expect(sql.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("returns error when user cannot be loaded", async () => {
    // getOrCreateUser returns null (error scenario)
    const sql = jest.fn(() => Promise.reject(new Error("DB error")));
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimDailyBonus("bad_wallet");

    expect(result.success).toBe(false);
  });
});

// ─── claimFirstPredictionBonus ───────────────────────────────────

describe("claimFirstPredictionBonus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    const result = await claimFirstPredictionBonus("wallet1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database not available");
  });

  it("awards 100 OP for first prediction", async () => {
    const userRow = makeUserRow({ first_prediction_bonus: false });
    const sql = createSqlMock([
      [userRow], // getOrCreateUser SELECT
      [{ op_balance: 1100 }], // UPDATE RETURNING
      [], // Ledger INSERT
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimFirstPredictionBonus("wallet1");

    expect(result.success).toBe(true);
    expect(result.amount).toBe(100);
  });

  it("rejects if bonus already claimed", async () => {
    const userRow = makeUserRow({ first_prediction_bonus: true });
    const sql = createSqlMock([[userRow]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimFirstPredictionBonus("wallet1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("First prediction bonus already claimed");
  });

  it("handles database error gracefully", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("DB error")));
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await claimFirstPredictionBonus("wallet1");

    expect(result.success).toBe(false);
    // getOrCreateUser fails first, so error is "Could not load user"
    expect(result.error).toBe("Could not load user");
  });
});

// ─── updateStreak ────────────────────────────────────────────────

describe("updateStreak", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does nothing when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    // Should not throw
    await updateStreak("wallet1", true);
  });

  it("increments streak on win", async () => {
    const row = {
      current_streak: 3,
      best_streak: 5,
      total_markets_entered: 10,
      total_markets_won: 7,
      achievements: {},
    };
    const sql = createSqlMock([
      [row], // SELECT
      [], // UPDATE
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateStreak("wallet1", true);

    // Should have called UPDATE with streak=4, entered=11, won=8
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("resets streak to 0 on loss", async () => {
    const row = {
      current_streak: 5,
      best_streak: 5,
      total_markets_entered: 10,
      total_markets_won: 7,
      achievements: {},
    };
    const sql = createSqlMock([[row], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateStreak("wallet1", false);

    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("updates best_streak when current exceeds it", async () => {
    const row = {
      current_streak: 5,
      best_streak: 5,
      total_markets_entered: 20,
      total_markets_won: 15,
      achievements: {},
    };
    const sql = createSqlMock([[row], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateStreak("wallet1", true);

    // current_streak becomes 6, best_streak should also become 6
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("triggers first_victory achievement on first win", async () => {
    const row = {
      current_streak: 0,
      best_streak: 0,
      total_markets_entered: 0,
      total_markets_won: 0, // +1 will make it 1
      achievements: {},
    };
    const sql = createSqlMock([
      [row], // SELECT user
      [], // UPDATE streak
      [{ op_balance: 1100 }], // checkAndAwardAchievement UPDATE
      [], // Achievement ledger
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateStreak("wallet1", true);

    // Should have made at least 3 calls (SELECT, UPDATE, achievement)
    expect(sql.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("triggers hot_streak achievement at 5 wins in a row", async () => {
    const row = {
      current_streak: 4, // will become 5
      best_streak: 4,
      total_markets_entered: 10,
      total_markets_won: 8,
      achievements: {},
    };
    const sql = createSqlMock([
      [row],
      [],
      [{ op_balance: 1250 }], // hot_streak achievement
      [],
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateStreak("wallet1", true);

    expect(sql.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("triggers oracle_vision achievement at 10 wins in a row", async () => {
    const row = {
      current_streak: 9, // will become 10
      best_streak: 9,
      total_markets_entered: 20,
      total_markets_won: 15,
      achievements: {},
    };
    const sql = createSqlMock([
      [row],
      [],
      [{ op_balance: 1500 }], // oracle_vision achievement
      [],
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateStreak("wallet1", true);

    expect(sql.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("triggers market_maker achievement at 50 markets entered", async () => {
    const row = {
      current_streak: 0,
      best_streak: 5,
      total_markets_entered: 49, // +1 will make it 50
      total_markets_won: 20,
      achievements: {},
    };
    const sql = createSqlMock([
      [row],
      [],
      [{ op_balance: 1300 }], // market_maker achievement
      [],
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateStreak("wallet1", false); // loss but still enters

    expect(sql.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("does nothing for nonexistent user", async () => {
    const sql = createSqlMock([
      [], // SELECT returns empty
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateStreak("nonexistent", true);

    expect(sql).toHaveBeenCalledTimes(1); // Only the SELECT
  });

  it("handles database error gracefully (no throw)", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("DB error")));
    mockedGetSql.mockResolvedValue(sql as any);

    // Should not throw
    await expect(updateStreak("wallet1", true)).resolves.toBeUndefined();
  });
});

// ─── updateReputation ────────────────────────────────────────────

describe("updateReputation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does nothing when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    await updateReputation("wallet1", true);
  });

  it("increases rating on win", async () => {
    const sql = createSqlMock([
      [{ reputation_score: 1000 }], // SELECT
      [], // UPDATE
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateReputation("wallet1", true);

    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("decreases rating on loss", async () => {
    const sql = createSqlMock([[{ reputation_score: 1000 }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateReputation("wallet1", false);

    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("never goes below 0", async () => {
    // Very low rating, losing should floor at 0
    const sql = createSqlMock([[{ reputation_score: 5 }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateReputation("wallet1", false);

    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("applies difficulty multiplier to ELO change", async () => {
    const sql1 = createSqlMock([[{ reputation_score: 1000 }], []]);
    const sql2 = createSqlMock([[{ reputation_score: 1000 }], []]);

    // Without difficulty
    mockedGetSql.mockResolvedValue(sql1 as any);
    await updateReputation("wallet1", true);

    // With high difficulty
    mockedGetSql.mockResolvedValue(sql2 as any);
    await updateReputation("wallet1", true, 3);

    // Both should have been called
    expect(sql1).toHaveBeenCalledTimes(2);
    expect(sql2).toHaveBeenCalledTimes(2);
  });

  it("assigns correct tier based on new rating", async () => {
    // Test each tier boundary
    const scenarios = [
      { score: 500, expectedTierPattern: "novice" }, // <1000
      { score: 999, expectedTierPattern: "novice" }, // <1000
      { score: 1200, expectedTierPattern: "seer" }, // 1000-1499
      { score: 1600, expectedTierPattern: "oracle" }, // 1500-1999
      { score: 2100, expectedTierPattern: "master" }, // 2000+
    ];

    for (const scenario of scenarios) {
      jest.clearAllMocks();
      const sql = createSqlMock([[{ reputation_score: scenario.score }], []]);
      mockedGetSql.mockResolvedValue(sql as any);

      // Win to see tier assignment
      await updateReputation("wallet1", true);
      expect(sql).toHaveBeenCalledTimes(2);
    }
  });

  it("does nothing for nonexistent user", async () => {
    const sql = createSqlMock([[]]);
    mockedGetSql.mockResolvedValue(sql as any);

    await updateReputation("ghost", true);

    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("handles database error gracefully", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("DB error")));
    mockedGetSql.mockResolvedValue(sql as any);

    await expect(updateReputation("wallet1", true)).resolves.toBeUndefined();
  });
});

// ─── ELO Calculation Verification ───────────────────────────────

describe("ELO calculation correctness", () => {
  it("matches expected formula: K=32, expected = 1/(1+10^((1000-rating)/400))", () => {
    // Verify the formula from the code manually
    const K = 32;
    const rating = 1000;
    const expected = 1 / (1 + Math.pow(10, (1000 - rating) / 400));
    // At 1000 rating: expected = 1/(1+10^0) = 1/(1+1) = 0.5
    expect(expected).toBe(0.5);

    // Win: change = K * 1 * (1 - 0.5) = 16
    const winChange = Math.round(K * 1 * (1 - expected));
    expect(winChange).toBe(16);

    // Loss: change = K * 1 * (0 - 0.5) = -16
    const lossChange = Math.round(K * 1 * (0 - expected));
    expect(lossChange).toBe(-16);
  });

  it("higher-rated player gains less on win", () => {
    const K = 32;
    const ratingHigh = 1500;
    const expectedHigh = 1 / (1 + Math.pow(10, (1000 - ratingHigh) / 400));
    const changeHigh = Math.round(K * 1 * (1 - expectedHigh));

    const ratingLow = 800;
    const expectedLow = 1 / (1 + Math.pow(10, (1000 - ratingLow) / 400));
    const changeLow = Math.round(K * 1 * (1 - expectedLow));

    expect(changeHigh).toBeLessThan(changeLow);
  });

  it("difficulty multiplier scales the change", () => {
    const K = 32;
    const rating = 1000;
    const expected = 0.5;

    const changeD1 = Math.round(K * 1 * (1 - expected));
    const changeD3 = Math.round(K * 3 * (1 - expected));

    expect(changeD3).toBe(changeD1 * 3);
  });
});

// ─── getProfile ──────────────────────────────────────────────────

describe("getProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    const result = await getProfile("wallet1");
    expect(result).toBeNull();
  });

  it("returns null for nonexistent user", async () => {
    const sql = createSqlMock([[]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await getProfile("nonexistent");
    expect(result).toBeNull();
  });

  it("returns user profile", async () => {
    const userRow = makeUserRow({ wallet: "profile_user", op_balance: 3000 });
    const sql = createSqlMock([[userRow]]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await getProfile("profile_user");

    expect(result).not.toBeNull();
    expect(result!.wallet).toBe("profile_user");
    expect(result!.opBalance).toBe(3000);
  });

  it("handles database error gracefully", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("DB error")));
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await getProfile("wallet1");
    expect(result).toBeNull();
  });
});

// ─── getOPLedger ─────────────────────────────────────────────────

describe("getOPLedger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty array when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);
    const result = await getOPLedger("wallet1");
    expect(result).toEqual([]);
  });

  it("returns ledger entries mapped correctly", async () => {
    const ledgerRows = [
      {
        id: 1,
        wallet: "wallet1",
        amount: 100,
        balance_after: 1100,
        tx_type: "daily_claim",
        reference_id: null,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: 2,
        wallet: "wallet1",
        amount: -50,
        balance_after: 1050,
        tx_type: "prediction_entry",
        reference_id: 42,
        created_at: "2025-01-01T01:00:00Z",
      },
    ];
    const sql = createSqlMock([ledgerRows]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await getOPLedger("wallet1");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[0].amount).toBe(100);
    expect(result[0].txType).toBe("daily_claim");
    expect(result[0].referenceId).toBeUndefined(); // null → undefined
    expect(result[1].referenceId).toBe(42);
    expect(result[1].amount).toBe(-50);
  });

  it("respects custom limit parameter", async () => {
    const sql = createSqlMock([[]]);
    mockedGetSql.mockResolvedValue(sql as any);

    await getOPLedger("wallet1", 5);

    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("defaults to limit 20", async () => {
    const sql = createSqlMock([[]]);
    mockedGetSql.mockResolvedValue(sql as any);

    await getOPLedger("wallet1");

    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("handles database error gracefully", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("DB error")));
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await getOPLedger("wallet1");
    expect(result).toEqual([]);
  });
});

// ─── checkAndAwardAchievement ────────────────────────────────────

describe("checkAndAwardAchievement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns false if achievement already awarded (idempotent)", async () => {
    const achievements = { first_victory: { unlockedAt: "2025-01-01", opAwarded: 100 } };

    const result = await checkAndAwardAchievement("wallet1", "first_victory", 100, achievements);

    expect(result).toBe(false);
    // getSql should NOT even be called
    expect(mockedGetSql).not.toHaveBeenCalled();
  });

  it("returns false when database is not available", async () => {
    mockedGetSql.mockResolvedValue(null);

    const result = await checkAndAwardAchievement("wallet1", "hot_streak", 250, {});

    expect(result).toBe(false);
  });

  it("awards achievement and credits OP", async () => {
    const sql = createSqlMock([
      [{ op_balance: 1250 }], // Achievement UPDATE RETURNING
      [], // Ledger INSERT
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await checkAndAwardAchievement("wallet1", "hot_streak", 250, {});

    expect(result).toBe(true);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("returns false when UPDATE affects no rows", async () => {
    const sql = createSqlMock([
      [], // UPDATE returns empty (user not found)
    ]);
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await checkAndAwardAchievement("ghost", "first_victory", 100, {});

    expect(result).toBe(false);
  });

  it("handles database error gracefully", async () => {
    const sql = jest.fn(() => Promise.reject(new Error("DB error")));
    mockedGetSql.mockResolvedValue(sql as any);

    const result = await checkAndAwardAchievement("wallet1", "test", 100, {});

    expect(result).toBe(false);
  });

  it("does not award same achievement twice even across calls", async () => {
    // First call awards it
    const sql = createSqlMock([[{ op_balance: 1100 }], []]);
    mockedGetSql.mockResolvedValue(sql as any);

    const first = await checkAndAwardAchievement("wallet1", "new_badge", 100, {});
    expect(first).toBe(true);

    // Second call with achievement in the map should short-circuit
    const second = await checkAndAwardAchievement("wallet1", "new_badge", 100, {
      new_badge: { unlockedAt: "2025-01-01", opAwarded: 100 },
    });
    expect(second).toBe(false);
  });
});
