/**
 * Oracle Resolver & OP Payout Tests
 *
 * Tests calculateOPPayouts (pure function) exhaustively:
 * - Boundary conditions, edge cases, rounding
 * - Winner/loser separation, refund logic
 * - Weighted distribution correctness
 *
 * Tests resolver dispatch and individual resolvers with mocked fetch.
 */

import {
  calculateOPPayouts,
  resolveMarket,
  getTokenPrice,
  OP_PARTICIPATION_REWARD,
} from "@/lib/oracle-resolver";
import type { OracleRoundDB, OraclePredictionDB } from "@/lib/neon";

// ─── Test Helpers ──────────────────────────────────────────────────

function makePrediction(
  overrides: Partial<OraclePredictionDB> & { id: number; wallet: string }
): OraclePredictionDB {
  return {
    roundId: 1,
    tokenMint: "",
    isWinner: false,
    predictionRank: undefined,
    prizeLamports: BigInt(0),
    claimed: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    opWagered: 100,
    opPayout: 0,
    ...overrides,
  };
}

function makeRound(overrides: Partial<OracleRoundDB> = {}): OracleRoundDB {
  return {
    id: 1,
    status: "active",
    startTime: new Date("2025-01-01T00:00:00Z"),
    endTime: new Date("2025-01-02T00:00:00Z"),
    tokenOptions: [],
    entryCount: 0,
    prizePoolLamports: BigInt(0),
    prizeDistributed: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ─── calculateOPPayouts ────────────────────────────────────────────

describe("calculateOPPayouts", () => {
  describe("empty / no predictions", () => {
    it("returns empty array for zero predictions", () => {
      expect(calculateOPPayouts([], "mint_a", false)).toEqual([]);
    });
  });

  describe("no winners → full refund", () => {
    it("refunds everyone when no one picked the winning outcome", () => {
      const predictions = [
        makePrediction({ id: 1, wallet: "w1", tokenMint: "mint_a", opWagered: 200 }),
        makePrediction({ id: 2, wallet: "w2", tokenMint: "mint_b", opWagered: 300 }),
      ];

      const payouts = calculateOPPayouts(predictions, "mint_c", false);

      expect(payouts).toHaveLength(2);
      payouts.forEach((p) => {
        expect(p.isWinner).toBe(false);
        expect(p.opPayout).toBe(p.opWagered); // full refund
      });
    });

    it("refunds zero-wager participants when no winners", () => {
      const predictions = [
        makePrediction({ id: 1, wallet: "w1", tokenMint: "mint_a", opWagered: 0 }),
      ];

      const payouts = calculateOPPayouts(predictions, "mint_b", false);
      expect(payouts[0].opPayout).toBe(0); // 0 wagered → 0 refund
      expect(payouts[0].isWinner).toBe(false);
    });
  });

  describe("single winner takes all", () => {
    it("gives entire pool to the sole winner", () => {
      const predictions = [
        makePrediction({ id: 1, wallet: "w1", tokenMint: "mint_a", opWagered: 100 }),
        makePrediction({ id: 2, wallet: "w2", tokenMint: "mint_b", opWagered: 200 }),
        makePrediction({ id: 3, wallet: "w3", tokenMint: "mint_b", opWagered: 300 }),
      ];

      const payouts = calculateOPPayouts(predictions, "mint_a", false);
      const totalPool = 100 + 200 + 300;

      const winner = payouts.find((p) => p.isWinner);
      expect(winner).toBeDefined();
      expect(winner!.wallet).toBe("w1");
      expect(winner!.opPayout).toBe(totalPool);
      expect(winner!.rank).toBe(1);

      const losers = payouts.filter((p) => !p.isWinner);
      expect(losers).toHaveLength(2);
      losers.forEach((l) => expect(l.opPayout).toBe(0));
    });
  });

  describe("multiple winners → weighted by entry order", () => {
    it("earlier entrant gets more than later entrant", () => {
      const predictions = [
        makePrediction({
          id: 1,
          wallet: "w1",
          tokenMint: "mint_a",
          opWagered: 100,
          createdAt: new Date("2025-01-01T00:00:00Z"),
        }),
        makePrediction({
          id: 2,
          wallet: "w2",
          tokenMint: "mint_a",
          opWagered: 100,
          createdAt: new Date("2025-01-01T01:00:00Z"),
        }),
        makePrediction({
          id: 3,
          wallet: "w3",
          tokenMint: "mint_b",
          opWagered: 100,
        }),
      ];

      const payouts = calculateOPPayouts(predictions, "mint_a", false);

      const w1 = payouts.find((p) => p.wallet === "w1")!;
      const w2 = payouts.find((p) => p.wallet === "w2")!;

      expect(w1.isWinner).toBe(true);
      expect(w2.isWinner).toBe(true);
      expect(w1.rank).toBe(1);
      expect(w2.rank).toBe(2);
      expect(w1.opPayout).toBeGreaterThan(w2.opPayout);
    });

    it("total payout equals total pool (no rounding loss)", () => {
      const predictions = [];
      for (let i = 0; i < 20; i++) {
        predictions.push(
          makePrediction({
            id: i,
            wallet: `w${i}`,
            tokenMint: i < 12 ? "winner" : "loser",
            opWagered: 77 + i, // odd numbers to stress rounding
            createdAt: new Date(Date.now() + i * 60000),
          })
        );
      }

      const totalPool = predictions.reduce((s, p) => s + (p.opWagered ?? 0), 0);
      const payouts = calculateOPPayouts(predictions, "winner", false);
      const totalPaid = payouts.reduce((s, p) => s + p.opPayout, 0);

      expect(totalPaid).toBe(totalPool);
    });

    it("handles 100 winners without precision loss", () => {
      const predictions = [];
      for (let i = 0; i < 100; i++) {
        predictions.push(
          makePrediction({
            id: i,
            wallet: `w${i}`,
            tokenMint: "winner",
            opWagered: 100,
            createdAt: new Date(Date.now() + i * 1000),
          })
        );
      }

      const payouts = calculateOPPayouts(predictions, "winner", false);
      const totalPaid = payouts.reduce((s, p) => s + p.opPayout, 0);

      expect(totalPaid).toBe(100 * 100);
      expect(payouts.every((p) => p.isWinner)).toBe(true);
      expect(payouts[0].opPayout).toBeGreaterThanOrEqual(payouts[99].opPayout);
    });
  });

  describe("outcome-based markets (binary/multiple choice)", () => {
    it("uses outcomeId instead of tokenMint when isOutcomeBased is true", () => {
      const predictions = [
        makePrediction({ id: 1, wallet: "w1", outcomeId: "yes", opWagered: 100 }),
        makePrediction({ id: 2, wallet: "w2", outcomeId: "no", opWagered: 100 }),
      ];

      const payouts = calculateOPPayouts(predictions, "yes", true);
      expect(payouts.find((p) => p.wallet === "w1")!.isWinner).toBe(true);
      expect(payouts.find((p) => p.wallet === "w2")!.isWinner).toBe(false);
    });

    it("does NOT match tokenMint when isOutcomeBased is true", () => {
      const predictions = [
        makePrediction({ id: 1, wallet: "w1", tokenMint: "yes", outcomeId: "no", opWagered: 100 }),
      ];

      const payouts = calculateOPPayouts(predictions, "yes", true);
      // outcomeId is "no", so not a winner even though tokenMint is "yes"
      expect(payouts[0].isWinner).toBe(false);
    });
  });

  describe("edge cases with wagered amounts", () => {
    it("handles zero total pool (all wagered 0)", () => {
      const predictions = [
        makePrediction({ id: 1, wallet: "w1", tokenMint: "a", opWagered: 0 }),
        makePrediction({ id: 2, wallet: "w2", tokenMint: "a", opWagered: 0 }),
      ];

      const payouts = calculateOPPayouts(predictions, "a", false);
      expect(payouts.every((p) => p.opPayout === 0)).toBe(true);
      expect(payouts.every((p) => p.isWinner)).toBe(true);
    });

    it("handles undefined opWagered (treats as 0)", () => {
      const predictions = [
        makePrediction({
          id: 1,
          wallet: "w1",
          tokenMint: "a",
          opWagered: undefined as unknown as number,
        }),
        makePrediction({ id: 2, wallet: "w2", tokenMint: "b", opWagered: 100 }),
      ];

      const payouts = calculateOPPayouts(predictions, "a", false);
      const totalPool = 0 + 100; // undefined treated as 0
      const winnerPayout = payouts.find((p) => p.wallet === "w1")!.opPayout;
      expect(winnerPayout).toBe(totalPool);
    });

    it("handles very large wager amounts", () => {
      const predictions = [
        makePrediction({ id: 1, wallet: "w1", tokenMint: "a", opWagered: 999999999 }),
        makePrediction({ id: 2, wallet: "w2", tokenMint: "a", opWagered: 999999999 }),
        makePrediction({ id: 3, wallet: "w3", tokenMint: "b", opWagered: 1 }),
      ];

      const payouts = calculateOPPayouts(predictions, "a", false);
      const totalPaid = payouts.reduce((s, p) => s + p.opPayout, 0);
      expect(totalPaid).toBe(999999999 + 999999999 + 1);
    });
  });

  describe("rank ordering", () => {
    it("assigns ranks 1-N based on createdAt order", () => {
      const predictions = [
        makePrediction({
          id: 3,
          wallet: "w3",
          tokenMint: "a",
          createdAt: new Date("2025-01-01T03:00:00Z"),
        }),
        makePrediction({
          id: 1,
          wallet: "w1",
          tokenMint: "a",
          createdAt: new Date("2025-01-01T01:00:00Z"),
        }),
        makePrediction({
          id: 2,
          wallet: "w2",
          tokenMint: "a",
          createdAt: new Date("2025-01-01T02:00:00Z"),
        }),
      ];

      const payouts = calculateOPPayouts(predictions, "a", false);
      const ranked = payouts.filter((p) => p.isWinner).sort((a, b) => a.rank! - b.rank!);

      expect(ranked[0].wallet).toBe("w1"); // earliest
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].wallet).toBe("w2");
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].wallet).toBe("w3"); // latest
      expect(ranked[2].rank).toBe(3);
    });

    it("losers have no rank assigned", () => {
      const predictions = [
        makePrediction({ id: 1, wallet: "w1", tokenMint: "a", opWagered: 100 }),
        makePrediction({ id: 2, wallet: "w2", tokenMint: "b", opWagered: 100 }),
      ];

      const payouts = calculateOPPayouts(predictions, "a", false);
      const loser = payouts.find((p) => !p.isWinner)!;
      expect(loser.rank).toBeUndefined();
    });
  });

  describe("participation reward constant", () => {
    it("OP_PARTICIPATION_REWARD is 10", () => {
      expect(OP_PARTICIPATION_REWARD).toBe(10);
    });
  });
});

// ─── resolveMarket Dispatch ────────────────────────────────────────

describe("resolveMarket", () => {
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("dispatcher routing", () => {
    it("returns error for unknown market type", async () => {
      const round = makeRound({ marketType: "unknown_type" });
      const result = await resolveMarket(round);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown market type");
    });

    it("defaults to price_prediction when marketType is undefined", async () => {
      const round = makeRound({
        marketType: undefined,
        tokenOptions: [],
      });

      const result = await resolveMarket(round);
      // Will fail because no token options, but proves it routed to price_prediction
      expect(result.success).toBe(false);
      expect(result.error).toContain("No token options");
    });
  });

  describe("resolvePricePrediction", () => {
    it("returns error when round has no token options", async () => {
      const round = makeRound({ marketType: "price_prediction", tokenOptions: [] });
      const result = await resolveMarket(round);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No token options in round");
    });

    it("resolves to the token with highest % gain", async () => {
      // Token A: $1 → $1.50 = +50%
      // Token B: $2 → $2.20 = +10%
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            pairs: [{ priceUsd: "1.50", volume: { h24: 100 } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            pairs: [{ priceUsd: "2.20", volume: { h24: 100 } }],
          }),
        });

      const round = makeRound({
        marketType: "price_prediction",
        tokenOptions: [
          { mint: "mint_a", symbol: "A", name: "Token A", startPrice: 1.0 },
          { mint: "mint_b", symbol: "B", name: "Token B", startPrice: 2.0 },
        ],
      });

      const result = await resolveMarket(round);

      expect(result.success).toBe(true);
      expect(result.winningTokenMint).toBe("mint_a");
      expect(result.winningPriceChange).toBe(50);
      expect(result.resolutionData.endPrices).toEqual({ mint_a: 1.5, mint_b: 2.2 });
    });

    it("handles DexScreener returning 0 for a token (treats as 0% change)", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pairs: [{ priceUsd: "2.00", volume: { h24: 50 } }] }),
        })
        .mockResolvedValueOnce({
          ok: false, // API failure for mint_b
        });

      const round = makeRound({
        marketType: "price_prediction",
        tokenOptions: [
          { mint: "mint_a", symbol: "A", name: "Token A", startPrice: 1.0 },
          { mint: "mint_b", symbol: "B", name: "Token B", startPrice: 5.0 },
        ],
      });

      const result = await resolveMarket(round);

      expect(result.success).toBe(true);
      expect(result.winningTokenMint).toBe("mint_a"); // +100%
    });

    it("handles all tokens losing value - picks least negative", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pairs: [{ priceUsd: "0.50", volume: { h24: 10 } }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pairs: [{ priceUsd: "0.80", volume: { h24: 10 } }] }),
        });

      const round = makeRound({
        marketType: "price_prediction",
        tokenOptions: [
          { mint: "mint_a", symbol: "A", name: "Token A", startPrice: 1.0 }, // -50%
          { mint: "mint_b", symbol: "B", name: "Token B", startPrice: 1.0 }, // -20%
        ],
      });

      const result = await resolveMarket(round);

      expect(result.success).toBe(true);
      expect(result.winningTokenMint).toBe("mint_b"); // -20% beats -50%
    });
  });

  describe("resolveWorldHealth", () => {
    it("resolves YES when health is above threshold", async () => {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ health: 75, weather: "sunny" }),
      });

      const round = makeRound({
        marketType: "world_health",
        marketConfig: { threshold: 50 },
      });

      const result = await resolveMarket(round);

      expect(result.success).toBe(true);
      expect(result.winningOutcomeId).toBe("yes");
      expect(result.resolutionData.currentHealth).toBe(75);
      expect(result.resolutionData.threshold).toBe(50);
    });

    it("resolves NO when health is below threshold", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ health: 30, weather: "storm" }),
      });

      const round = makeRound({
        marketType: "world_health",
        marketConfig: { threshold: 50 },
      });

      const result = await resolveMarket(round);

      expect(result.success).toBe(true);
      expect(result.winningOutcomeId).toBe("no");
    });

    it("resolves YES when health equals threshold exactly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ health: 50, weather: "cloudy" }),
      });

      const round = makeRound({
        marketType: "world_health",
        marketConfig: { threshold: 50 },
      });

      const result = await resolveMarket(round);
      expect(result.winningOutcomeId).toBe("yes"); // >= threshold
    });

    it("defaults threshold to 50 when not specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ health: 49, weather: "rain" }),
      });

      const round = makeRound({
        marketType: "world_health",
        marketConfig: {},
      });

      const result = await resolveMarket(round);
      expect(result.winningOutcomeId).toBe("no"); // 49 < 50
    });

    it("fails gracefully when world state API is down", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const round = makeRound({ marketType: "world_health", marketConfig: { threshold: 50 } });
      const result = await resolveMarket(round);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to fetch world state");
    });
  });

  describe("resolveWeatherForecast", () => {
    it("resolves to current weather when it matches an outcome", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ health: 50, weather: "rain" }),
      });

      const round = makeRound({
        marketType: "weather_forecast",
        marketConfig: {
          outcomes: [
            { id: "sunny", label: "Sunny" },
            { id: "rain", label: "Rain" },
            { id: "storm", label: "Storm" },
          ],
        },
      });

      const result = await resolveMarket(round);

      expect(result.success).toBe(true);
      expect(result.winningOutcomeId).toBe("rain");
    });

    it("falls back apocalypse → storm", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ health: 10, weather: "apocalypse" }),
      });

      const round = makeRound({
        marketType: "weather_forecast",
        marketConfig: {
          outcomes: [
            { id: "sunny", label: "Sunny" },
            { id: "storm", label: "Storm" },
          ],
        },
      });

      const result = await resolveMarket(round);
      expect(result.success).toBe(true);
      expect(result.winningOutcomeId).toBe("storm");
      expect(result.resolutionData.usedFallback).toBe(true);
    });

    it("fails when weather matches no outcome and no fallback exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ health: 50, weather: "foggy" }),
      });

      const round = makeRound({
        marketType: "weather_forecast",
        marketConfig: {
          outcomes: [
            { id: "sunny", label: "Sunny" },
            { id: "rain", label: "Rain" },
          ],
        },
      });

      const result = await resolveMarket(round);
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not match any configured outcome");
    });
  });

  describe("resolveFeeVolume", () => {
    it("resolves OVER when claim volume exceeds threshold", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          health: 80,
          weather: "sunny",
          events: [
            { type: "fee_claim", amount: 10, timestamp: new Date().toISOString() },
            { type: "fee_claim", amount: 5, timestamp: new Date().toISOString() },
          ],
        }),
      });

      const round = makeRound({
        marketType: "fee_volume",
        marketConfig: { threshold: 10 },
      });

      const result = await resolveMarket(round);
      expect(result.success).toBe(true);
      expect(result.winningOutcomeId).toBe("over");
      expect(result.resolutionData.claimVolume24h).toBe(15);
    });

    it("resolves UNDER when claim volume is below threshold", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          health: 50,
          weather: "cloudy",
          events: [{ type: "fee_claim", amount: 2, timestamp: new Date().toISOString() }],
        }),
      });

      const round = makeRound({
        marketType: "fee_volume",
        marketConfig: { threshold: 10 },
      });

      const result = await resolveMarket(round);
      expect(result.winningOutcomeId).toBe("under");
    });

    it("uses healthMetrics.claimVolume24h from world-state API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          health: 75,
          weather: "sunny",
          events: [],
          healthMetrics: { claimVolume24h: 20 },
        }),
      });

      const round = makeRound({
        marketType: "fee_volume",
        marketConfig: { threshold: 5 },
      });

      const result = await resolveMarket(round);
      expect(result.success).toBe(true);
      // healthMetrics.claimVolume24h = 20 → over 5 threshold
      expect(result.winningOutcomeId).toBe("over");
      expect(result.resolutionData.dataSource).toBe("healthMetrics");
    });

    it("reports under when no real claim data is available", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ health: 75, weather: "sunny", events: [] }),
      });

      const round = makeRound({
        marketType: "fee_volume",
        marketConfig: { threshold: 5 },
      });

      const result = await resolveMarket(round);
      expect(result.success).toBe(true);
      // No healthMetrics, no events → claimVolume24h = 0 → under
      expect(result.winningOutcomeId).toBe("under");
      expect(result.resolutionData.dataSource).toBe("no_data");
    });

    it("ignores old events (>24h) in volume calculation", async () => {
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const recentTimestamp = new Date().toISOString();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          health: 50,
          weather: "cloudy",
          events: [
            { type: "fee_claim", amount: 100, timestamp: oldTimestamp },
            { type: "fee_claim", amount: 3, timestamp: recentTimestamp },
          ],
        }),
      });

      const round = makeRound({
        marketType: "fee_volume",
        marketConfig: { threshold: 5 },
      });

      const result = await resolveMarket(round);
      // Only the recent 3 SOL counts, old 100 SOL is excluded
      expect(result.winningOutcomeId).toBe("under");
      expect(result.resolutionData.claimVolume24h).toBe(3);
    });

    it("ignores non-fee_claim events", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          health: 50,
          weather: "cloudy",
          events: [
            { type: "token_launch", amount: 500, timestamp: new Date().toISOString() },
            { type: "fee_claim", amount: 2, timestamp: new Date().toISOString() },
          ],
        }),
      });

      const round = makeRound({
        marketType: "fee_volume",
        marketConfig: { threshold: 5 },
      });

      const result = await resolveMarket(round);
      expect(result.resolutionData.claimVolume24h).toBe(2);
    });
  });
});

// ─── getTokenPrice ─────────────────────────────────────────────────

describe("getTokenPrice", () => {
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns price from most liquid pair by volume", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pairs: [
          { priceUsd: "1.50", volume: { h24: 100 } },
          { priceUsd: "2.00", volume: { h24: 500 } }, // highest volume
          { priceUsd: "1.75", volume: { h24: 200 } },
        ],
      }),
    });

    const price = await getTokenPrice("test_mint");
    expect(price).toBe(2.0);
  });

  it("returns 0 for API failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const price = await getTokenPrice("bad_mint");
    expect(price).toBe(0);
  });

  it("returns 0 for empty pairs array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pairs: [] }),
    });
    const price = await getTokenPrice("no_pairs");
    expect(price).toBe(0);
  });

  it("returns 0 for null pairs", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pairs: null }),
    });
    const price = await getTokenPrice("null_pairs");
    expect(price).toBe(0);
  });

  it("returns 0 when priceUsd is invalid string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pairs: [{ priceUsd: "not-a-number", volume: { h24: 100 } }],
      }),
    });
    const price = await getTokenPrice("bad_price");
    expect(price).toBe(0);
  });

  it("returns 0 on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));
    const price = await getTokenPrice("network_error");
    expect(price).toBe(0);
  });
});
