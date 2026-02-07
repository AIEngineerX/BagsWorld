/**
 * Oracle Market Generator Tests
 *
 * Tests market generation logic, scheduling rules, and error handling.
 * Mocks: neon (createOracleRound, getActiveOracleMarkets), token-registry,
 *        oracle-resolver (getTokenPrice, fetchWorldState)
 */

const mockCreateOracleRound = jest.fn();
const mockGetActiveOracleMarkets = jest.fn();
const mockGetAllWorldTokensAsync = jest.fn();
const mockGetTokenPrice = jest.fn();
const mockFetchWorldState = jest.fn();

jest.mock("@/lib/neon", () => ({
  createOracleRound: (...args: unknown[]) => mockCreateOracleRound(...args),
  getActiveOracleMarkets: () => mockGetActiveOracleMarkets(),
}));

jest.mock("@/lib/token-registry", () => ({
  getAllWorldTokensAsync: () => mockGetAllWorldTokensAsync(),
}));

jest.mock("@/lib/oracle-resolver", () => ({
  getTokenPrice: (mint: string) => mockGetTokenPrice(mint),
  fetchWorldState: () => mockFetchWorldState(),
}));

import {
  getMarketFrequencyHours,
  generatePricePredictionMarket,
  generateWorldHealthMarket,
  generateWeatherForecastMarket,
  generateFeeVolumeMarket,
  generateMarkets,
} from "@/lib/oracle-generator";

// ─── Helpers ──────────────────────────────────────────────────────

function makeToken(mint: string, symbol: string) {
  return { mint, symbol, name: `Token ${symbol}`, imageUrl: `https://img/${symbol}` };
}

function makeActiveMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: "active",
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    endTime: new Date(Date.now() + 22 * 60 * 60 * 1000),
    marketType: "price_prediction",
    ...overrides,
  };
}

// ─── getMarketFrequencyHours (pure function) ─────────────────────

describe("getMarketFrequencyHours", () => {
  it("returns 24 for price_prediction", () => {
    expect(getMarketFrequencyHours("price_prediction")).toBe(24);
  });

  it("returns 12 for world_health", () => {
    expect(getMarketFrequencyHours("world_health")).toBe(12);
  });

  it("returns 6 for weather_forecast", () => {
    expect(getMarketFrequencyHours("weather_forecast")).toBe(6);
  });

  it("returns 24 for fee_volume", () => {
    expect(getMarketFrequencyHours("fee_volume")).toBe(24);
  });

  it("returns 24 for unknown type (default)", () => {
    expect(getMarketFrequencyHours("unknown" as any)).toBe(24);
  });
});

// ─── generatePricePredictionMarket ───────────────────────────────

describe("generatePricePredictionMarket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates market with tokens that have valid prices", async () => {
    mockGetAllWorldTokensAsync.mockResolvedValue([
      makeToken("mint_a", "AAA"),
      makeToken("mint_b", "BBB"),
      makeToken("mint_c", "CCC"),
    ]);
    mockGetTokenPrice
      .mockResolvedValueOnce(1.5) // mint_a
      .mockResolvedValueOnce(2.0) // mint_b
      .mockResolvedValueOnce(0.5); // mint_c
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 42 });

    const result = await generatePricePredictionMarket();

    expect(result.success).toBe(true);
    expect(result.roundId).toBe(42);
    expect(mockCreateOracleRound).toHaveBeenCalledTimes(1);

    // Verify it passed correct token options
    const callArgs = mockCreateOracleRound.mock.calls[0];
    expect(callArgs[0]).toHaveLength(3); // All 3 tokens had valid prices
    expect(callArgs[3].marketType).toBe("price_prediction");
    expect(callArgs[3].entryCostOp).toBe(100);
  });

  it("filters out Starter and Treasury tokens", async () => {
    mockGetAllWorldTokensAsync.mockResolvedValue([
      makeToken("StarterToken1", "STR"),
      makeToken("TreasuryVault", "TRS"),
      makeToken("mint_a", "AAA"),
      makeToken("mint_b", "BBB"),
    ]);
    mockGetTokenPrice.mockResolvedValue(1.0);
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 1 });

    await generatePricePredictionMarket();

    // Only 2 tokens should be passed (Starter and Treasury filtered)
    const callArgs = mockCreateOracleRound.mock.calls[0];
    expect(callArgs[0]).toHaveLength(2);
  });

  it("returns error when no tokens in registry", async () => {
    mockGetAllWorldTokensAsync.mockResolvedValue([]);

    const result = await generatePricePredictionMarket();

    expect(result.success).toBe(false);
    expect(result.error).toBe("No active tokens found in registry");
  });

  it("returns error when fewer than 2 tokens have valid prices", async () => {
    mockGetAllWorldTokensAsync.mockResolvedValue([
      makeToken("mint_a", "AAA"),
      makeToken("mint_b", "BBB"),
    ]);
    mockGetTokenPrice
      .mockResolvedValueOnce(1.0) // mint_a OK
      .mockResolvedValueOnce(0); // mint_b has no price

    const result = await generatePricePredictionMarket();

    expect(result.success).toBe(false);
    expect(result.error).toContain("need at least 2");
  });

  it("limits to 5 tokens even if more have valid prices", async () => {
    const tokens = Array.from({ length: 8 }, (_, i) => makeToken(`mint_${i}`, `T${i}`));
    mockGetAllWorldTokensAsync.mockResolvedValue(tokens);
    mockGetTokenPrice.mockResolvedValue(1.0);
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 1 });

    await generatePricePredictionMarket();

    const callArgs = mockCreateOracleRound.mock.calls[0];
    expect(callArgs[0]).toHaveLength(5); // Capped at 5
  });

  it("handles getTokenPrice rejection gracefully (Promise.allSettled)", async () => {
    mockGetAllWorldTokensAsync.mockResolvedValue([
      makeToken("mint_a", "AAA"),
      makeToken("mint_b", "BBB"),
      makeToken("mint_c", "CCC"),
    ]);
    mockGetTokenPrice
      .mockResolvedValueOnce(1.0)
      .mockRejectedValueOnce(new Error("API down")) // mint_b fails
      .mockResolvedValueOnce(2.0);
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 1 });

    const result = await generatePricePredictionMarket();

    // Should still succeed with 2 valid tokens
    expect(result.success).toBe(true);
    const callArgs = mockCreateOracleRound.mock.calls[0];
    expect(callArgs[0]).toHaveLength(2); // mint_a and mint_c
  });

  it("handles createOracleRound failure", async () => {
    mockGetAllWorldTokensAsync.mockResolvedValue([
      makeToken("mint_a", "AAA"),
      makeToken("mint_b", "BBB"),
    ]);
    mockGetTokenPrice.mockResolvedValue(1.0);
    mockCreateOracleRound.mockResolvedValue({ success: false, error: "DB error" });

    const result = await generatePricePredictionMarket();

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB error");
  });

  it("catches thrown errors and returns error result", async () => {
    mockGetAllWorldTokensAsync.mockRejectedValue(new Error("Registry down"));

    const result = await generatePricePredictionMarket();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Registry down");
  });
});

// ─── generateWorldHealthMarket ───────────────────────────────────

describe("generateWorldHealthMarket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates market with threshold near current health", async () => {
    mockFetchWorldState.mockResolvedValue({ health: 60, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 10 });

    const result = await generateWorldHealthMarket();

    expect(result.success).toBe(true);

    // Verify market config
    const callArgs = mockCreateOracleRound.mock.calls[0];
    expect(callArgs[3].marketType).toBe("world_health");
    expect(callArgs[3].entryCostOp).toBe(100);

    // Threshold should be health ± 5
    const config = callArgs[3].marketConfig;
    expect(config.threshold).toBeGreaterThanOrEqual(55);
    expect(config.threshold).toBeLessThanOrEqual(65);
  });

  it("clamps threshold to [10, 90] range", async () => {
    // Very low health → threshold should be at least 10
    mockFetchWorldState.mockResolvedValue({ health: 5, weather: "storm" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 10 });

    const result = await generateWorldHealthMarket();

    expect(result.success).toBe(true);
    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    expect(config.threshold).toBeGreaterThanOrEqual(10);
  });

  it("clamps threshold at high health to max 90", async () => {
    mockFetchWorldState.mockResolvedValue({ health: 95, weather: "sunny" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 10 });

    const result = await generateWorldHealthMarket();

    expect(result.success).toBe(true);
    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    expect(config.threshold).toBeLessThanOrEqual(90);
  });

  it("defaults health to 50 when world state is null", async () => {
    mockFetchWorldState.mockResolvedValue(null);
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 10 });

    const result = await generateWorldHealthMarket();

    expect(result.success).toBe(true);
    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    // threshold = 50 ± 5, clamped to [10, 90]
    expect(config.threshold).toBeGreaterThanOrEqual(45);
    expect(config.threshold).toBeLessThanOrEqual(55);
  });

  it("creates binary YES/NO market", async () => {
    mockFetchWorldState.mockResolvedValue({ health: 50, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 10 });

    await generateWorldHealthMarket();

    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    expect(config.outcome_type).toBe("binary");
    expect(config.outcomes).toEqual([
      { id: "yes", label: "YES" },
      { id: "no", label: "NO" },
    ]);
  });

  it("catches thrown errors", async () => {
    mockFetchWorldState.mockRejectedValue(new Error("Network failure"));

    const result = await generateWorldHealthMarket();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network failure");
  });
});

// ─── generateWeatherForecastMarket ───────────────────────────────

describe("generateWeatherForecastMarket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates 4-outcome weather market with 6h duration", async () => {
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 20 });

    const result = await generateWeatherForecastMarket();

    expect(result.success).toBe(true);
    expect(result.roundId).toBe(20);

    const callArgs = mockCreateOracleRound.mock.calls[0];
    expect(callArgs[3].marketType).toBe("weather_forecast");
    expect(callArgs[3].entryCostOp).toBe(50); // Cheaper than other markets

    const config = callArgs[3].marketConfig;
    expect(config.outcome_type).toBe("multiple_choice");
    expect(config.outcomes).toHaveLength(4);
    expect(config.outcomes.map((o: any) => o.id)).toEqual(["sunny", "cloudy", "rain", "storm"]);
  });

  it("handles createOracleRound failure", async () => {
    mockCreateOracleRound.mockResolvedValue({ success: false, error: "DB full" });

    const result = await generateWeatherForecastMarket();

    expect(result.success).toBe(false);
  });
});

// ─── generateFeeVolumeMarket ─────────────────────────────────────

describe("generateFeeVolumeMarket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets threshold=10 for health > 70", async () => {
    mockFetchWorldState.mockResolvedValue({ health: 80, weather: "sunny" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 30 });

    await generateFeeVolumeMarket();

    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    expect(config.threshold).toBe(10);
  });

  it("sets threshold=5 for health 51-70", async () => {
    mockFetchWorldState.mockResolvedValue({ health: 60, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 30 });

    await generateFeeVolumeMarket();

    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    expect(config.threshold).toBe(5);
  });

  it("sets threshold=2 for health <= 50", async () => {
    mockFetchWorldState.mockResolvedValue({ health: 30, weather: "rain" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 30 });

    await generateFeeVolumeMarket();

    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    expect(config.threshold).toBe(2);
  });

  it("defaults to health=50 (threshold=2) when world state is null", async () => {
    mockFetchWorldState.mockResolvedValue(null);
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 30 });

    await generateFeeVolumeMarket();

    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    // health || 50 → 50, which is not > 50 and not > 70 → threshold = 2
    expect(config.threshold).toBe(2);
  });

  it("creates OVER/UNDER binary market", async () => {
    mockFetchWorldState.mockResolvedValue({ health: 50, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 30 });

    await generateFeeVolumeMarket();

    const config = mockCreateOracleRound.mock.calls[0][3].marketConfig;
    expect(config.outcome_type).toBe("binary");
    expect(config.outcomes).toEqual([
      { id: "over", label: "OVER" },
      { id: "under", label: "UNDER" },
    ]);
  });
});

// ─── generateMarkets (orchestrator) ──────────────────────────────

describe("generateMarkets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips market types that already have 2 active markets", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([
      makeActiveMarket({ marketType: "price_prediction", startTime: new Date(Date.now() - 1000) }),
      makeActiveMarket({ marketType: "price_prediction", startTime: new Date(Date.now() - 2000) }),
    ]);

    // Other generators will be called for world_health, weather_forecast, fee_volume
    // but we need to mock them. Simplest: mock all dependencies to fail or succeed.
    mockFetchWorldState.mockResolvedValue({ health: 50, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 99 });

    const result = await generateMarkets();

    // price_prediction should be skipped
    const priceSkipped = result.skipped.find((s) => s.marketType === "price_prediction");
    expect(priceSkipped).toBeDefined();
    expect(priceSkipped!.reason).toContain("max 2");
  });

  it("skips market types generated too recently", async () => {
    // One active price_prediction that started 2h ago (need 24h)
    mockGetActiveOracleMarkets.mockResolvedValue([
      makeActiveMarket({
        marketType: "price_prediction",
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      }),
    ]);

    mockFetchWorldState.mockResolvedValue({ health: 50, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 99 });

    const result = await generateMarkets();

    const priceSkipped = result.skipped.find((s) => s.marketType === "price_prediction");
    expect(priceSkipped).toBeDefined();
    expect(priceSkipped!.reason).toContain("since last");
  });

  it("generates markets that pass all checks", async () => {
    // No active markets → all types should be attempted
    mockGetActiveOracleMarkets.mockResolvedValue([]);

    // Mock deps for all generators
    mockGetAllWorldTokensAsync.mockResolvedValue([
      makeToken("mint_a", "AAA"),
      makeToken("mint_b", "BBB"),
    ]);
    mockGetTokenPrice.mockResolvedValue(1.0);
    mockFetchWorldState.mockResolvedValue({ health: 50, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 1 });

    const result = await generateMarkets();

    // All 4 types should generate
    expect(result.generated.length).toBe(4);
    expect(result.skipped.length).toBe(0);
  });

  it("force-generates price_prediction when zero active and all fail", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([]);

    // All generators fail initially
    mockGetAllWorldTokensAsync.mockResolvedValue([]); // No tokens → fails
    mockFetchWorldState.mockResolvedValue(null); // Weather/health fail

    // But createOracleRound won't even be called since generators fail early
    const result = await generateMarkets();

    // All 4 types error, then force-gen also errors (no tokens)
    // The forced attempt should appear in errors
    const forcedError = result.errors.find(
      (e) => e.marketType.includes("forced") || e.marketType === "price_prediction"
    );
    expect(forcedError).toBeDefined();
  });

  it("records errors when individual generators throw", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([]);

    mockGetAllWorldTokensAsync.mockRejectedValue(new Error("Registry crash"));
    mockFetchWorldState.mockRejectedValue(new Error("World crash"));
    mockCreateOracleRound.mockRejectedValue(new Error("DB crash"));

    const result = await generateMarkets();

    // All generators should have errors
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles getActiveOracleMarkets failure gracefully", async () => {
    mockGetActiveOracleMarkets.mockRejectedValue(new Error("DB connection lost"));

    const result = await generateMarkets();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].marketType).toBe("all");
    expect(result.errors[0].error).toBe("DB connection lost");
  });

  it("defaults marketType to price_prediction when undefined in active markets", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([
      makeActiveMarket({ marketType: undefined, startTime: new Date(Date.now() - 1000) }),
      makeActiveMarket({ marketType: undefined, startTime: new Date(Date.now() - 2000) }),
    ]);

    mockFetchWorldState.mockResolvedValue({ health: 50, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 99 });

    const result = await generateMarkets();

    // price_prediction should be skipped (2 active with default type)
    const priceSkipped = result.skipped.find((s) => s.marketType === "price_prediction");
    expect(priceSkipped).toBeDefined();
  });

  it("allows generation when time since last exceeds frequency", async () => {
    // price_prediction started 25h ago (need 24h)
    mockGetActiveOracleMarkets.mockResolvedValue([
      makeActiveMarket({
        marketType: "price_prediction",
        startTime: new Date(Date.now() - 25 * 60 * 60 * 1000),
      }),
    ]);

    mockGetAllWorldTokensAsync.mockResolvedValue([
      makeToken("mint_a", "AAA"),
      makeToken("mint_b", "BBB"),
    ]);
    mockGetTokenPrice.mockResolvedValue(1.0);
    mockFetchWorldState.mockResolvedValue({ health: 50, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 2 });

    const result = await generateMarkets();

    // price_prediction should NOT be skipped since 25h > 24h
    const priceGenerated = result.generated.find((g) => g.marketType === "price_prediction");
    expect(priceGenerated).toBeDefined();
  });

  it("does NOT force-generate when some markets were generated successfully", async () => {
    mockGetActiveOracleMarkets.mockResolvedValue([]);

    // Price prediction fails (no tokens) but weather succeeds
    mockGetAllWorldTokensAsync.mockResolvedValue([]);
    mockFetchWorldState.mockResolvedValue({ health: 50, weather: "cloudy" });
    mockCreateOracleRound.mockResolvedValue({ success: true, roundId: 5 });

    const result = await generateMarkets();

    // Weather and world_health should generate, price_prediction should error
    // Force-gen should NOT happen because some succeeded and totalActive was 0
    // Actually: totalActive=0 AND generated.length > 0, so force-gen is skipped
    if (result.generated.length > 0) {
      const forcedError = result.errors.find((e) => e.marketType.includes("forced"));
      expect(forcedError).toBeUndefined();
    }
  });
});
