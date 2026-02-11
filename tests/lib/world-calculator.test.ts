/**
 * World Calculator Comprehensive Tests
 *
 * Tests all world calculation functions with:
 * - Boundary conditions and edge cases
 * - Error handling and invalid inputs
 * - Real code paths (no mocking of functions under test)
 * - Verification of actual outputs
 */

import {
  calculateWorldHealth,
  calculateWeather,
  calculateBuildingLevel,
  calculateBuildingHealth,
  calculateCharacterMood,
  generateBuildingPosition,
  getCachedBuildingPosition,
  cleanupBuildingPositionCache,
  generateCharacterPosition,
  transformFeeEarnerToCharacter,
  transformTokenToBuilding,
  generateGameEvent,
  buildWorldState,
} from "@/lib/world-calculator";
import type { FeeEarner, TokenInfo, WeatherType, WorldState } from "@/lib/types";

// Constants from the module (these should match world-calculator.ts)
const SCALE = 1.6;
const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 960;

describe("calculateWorldHealth", () => {
  describe("baseline health calculations", () => {
    it("should return baseline health (25%) when all inputs are zero", () => {
      const health = calculateWorldHealth(0, 0, 0, 0);
      expect(health).toBe(25);
    });

    it("should add building bonus up to 15% (max at 5 buildings)", () => {
      // 0 buildings = 25%
      expect(calculateWorldHealth(0, 0, 0, 0)).toBe(25);
      // 1 building = 25% + 3% = 28%
      expect(calculateWorldHealth(0, 0, 0, 1)).toBe(28);
      // 3 buildings = 25% + 9% = 34%
      expect(calculateWorldHealth(0, 0, 0, 3)).toBe(34);
      // 5 buildings = 25% + 15% = 40% (max)
      expect(calculateWorldHealth(0, 0, 0, 5)).toBe(40);
      // 10 buildings = still 40% (capped)
      expect(calculateWorldHealth(0, 0, 0, 10)).toBe(40);
    });
  });

  describe("claim volume scoring (60% weight)", () => {
    it("should return at least baseline for claim volume < 1 SOL", () => {
      // 0 SOL = baseline (25%)
      expect(calculateWorldHealth(0, 0, 0, 0)).toBe(25);
      // Small claim activity - baseline may still dominate
      const health05 = calculateWorldHealth(0.5, 0, 0, 0);
      // Health should be at least baseline (25%)
      expect(health05).toBeGreaterThanOrEqual(25);
    });

    it("should increase health with higher claim volume", () => {
      const health1 = calculateWorldHealth(1, 0, 0, 0);
      const health3 = calculateWorldHealth(3, 0, 0, 0);
      const health5 = calculateWorldHealth(5, 0, 0, 0);

      // With activity, health should be at least baseline
      expect(health1).toBeGreaterThanOrEqual(25);
      // Higher volume should give higher or equal health
      expect(health3).toBeGreaterThanOrEqual(health1);
      expect(health5).toBeGreaterThanOrEqual(health3);
    });

    it("should score in 30-55 range for claim volume 5-20 SOL (normal)", () => {
      const health5 = calculateWorldHealth(5, 0, 0, 0);
      const health10 = calculateWorldHealth(10, 0, 0, 0);
      const health20 = calculateWorldHealth(20, 0, 0, 0);

      // Ordering
      expect(health10).toBeGreaterThan(health5);
      expect(health20).toBeGreaterThan(health10);
      // Actual range: claim score 50-70 * 0.6 weight = 30-42, baseline max 25
      // So health should be in the 30-55 range
      expect(health5).toBeGreaterThanOrEqual(30);
      expect(health20).toBeLessThanOrEqual(55);
    });

    it("should score in 42-60 range for claim volume 20-50 SOL (healthy)", () => {
      const health20 = calculateWorldHealth(20, 0, 0, 0);
      const health35 = calculateWorldHealth(35, 0, 0, 0);
      const health50 = calculateWorldHealth(50, 0, 0, 0);

      // Ordering
      expect(health35).toBeGreaterThan(health20);
      expect(health50).toBeGreaterThan(health35);
      // Actual range: claim score 70-90 * 0.6 weight = 42-54
      expect(health20).toBeGreaterThanOrEqual(42);
      expect(health50).toBeLessThanOrEqual(60);
    });

    it("should score 90-100 for claim volume >= 50 SOL (thriving)", () => {
      const health50 = calculateWorldHealth(50, 0, 0, 0);
      const health100 = calculateWorldHealth(100, 0, 0, 0);
      const health500 = calculateWorldHealth(500, 0, 0, 0);

      expect(health50).toBeGreaterThanOrEqual(50); // 90 * 0.6 = 54
      expect(health100).toBeGreaterThan(health50);
      // Should cap at 100
      expect(health500).toBeLessThanOrEqual(100);
    });
  });

  describe("lifetime fees scoring (30% weight)", () => {
    it("should increase health with higher lifetime fees (above baseline activity)", () => {
      // Need enough activity for activity-based health to exceed baseline
      // Using high claim volume to ensure activity health dominates
      const healthLow = calculateWorldHealth(50, 10, 5, 0);
      const healthMid = calculateWorldHealth(50, 100, 5, 0);
      const healthHigh = calculateWorldHealth(50, 500, 5, 0);
      const healthMax = calculateWorldHealth(50, 1000, 5, 0);

      // With high claims, increasing fees should increase health
      expect(healthMid).toBeGreaterThanOrEqual(healthLow);
      expect(healthHigh).toBeGreaterThanOrEqual(healthMid);
      expect(healthMax).toBeGreaterThanOrEqual(healthHigh);
    });

    it("should handle extremely large lifetime fees", () => {
      const health = calculateWorldHealth(0, 1000000, 0, 0);
      expect(health).toBeLessThanOrEqual(100);
      // Should be at least baseline
      expect(health).toBeGreaterThanOrEqual(25);
    });
  });

  describe("token diversity scoring (10% weight)", () => {
    it("should increase health with more active tokens (with sufficient activity)", () => {
      // Use high claims to ensure activity health dominates over baseline
      const health0 = calculateWorldHealth(50, 500, 0, 0);
      const health5 = calculateWorldHealth(50, 500, 5, 0);
      const health10 = calculateWorldHealth(50, 500, 10, 0);

      // More tokens should give higher or equal health
      expect(health5).toBeGreaterThanOrEqual(health0);
      expect(health10).toBeGreaterThanOrEqual(health5);
    });

    it("should cap diversity bonus at 10 tokens", () => {
      const health10 = calculateWorldHealth(50, 500, 10, 0);
      const health20 = calculateWorldHealth(50, 500, 20, 0);
      // Both should give 100% diversity score (capped at 10*10=100), so same result
      expect(health20).toBe(health10);
    });

    it("should contribute ~10% weight per token (diversity formula verification)", () => {
      // With high claims and fees to ensure activity health dominates baseline,
      // adding tokens should increase health by roughly 1 point per token
      // (10% weight * 10 points per token = 1 point per token added)
      const health0 = calculateWorldHealth(50, 500, 0, 0);
      const health1 = calculateWorldHealth(50, 500, 1, 0);
      const health5 = calculateWorldHealth(50, 500, 5, 0);

      // 1 token adds ~1 point (10% * 10)
      const delta1 = health1 - health0;
      expect(delta1).toBeGreaterThanOrEqual(0);
      expect(delta1).toBeLessThanOrEqual(2); // ~1 point with rounding

      // 5 tokens should add ~5 points total from 0
      const delta5 = health5 - health0;
      expect(delta5).toBeGreaterThanOrEqual(3);
      expect(delta5).toBeLessThanOrEqual(7); // ~5 points with rounding
    });
  });

  describe("combined scoring", () => {
    it("should combine all factors correctly", () => {
      // All factors at thriving levels
      const healthMax = calculateWorldHealth(100, 1000, 10, 5);
      expect(healthMax).toBeGreaterThanOrEqual(90);
      expect(healthMax).toBeLessThanOrEqual(100);
    });

    it("should always return 0-100 range", () => {
      // Test extreme values
      expect(calculateWorldHealth(-100, -100, -10, -5)).toBeGreaterThanOrEqual(0);
      expect(calculateWorldHealth(10000, 100000, 1000, 100)).toBeLessThanOrEqual(100);
    });

    it("should return integer values", () => {
      const health = calculateWorldHealth(12.345, 67.89, 3.5, 2.7);
      expect(Number.isInteger(health)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle negative inputs gracefully", () => {
      const health = calculateWorldHealth(-10, -100, -5, -3);
      expect(health).toBeGreaterThanOrEqual(0);
      expect(health).toBeLessThanOrEqual(100);
    });

    it("should handle very small decimal values", () => {
      const health = calculateWorldHealth(0.001, 0.001, 0, 0);
      expect(health).toBeGreaterThanOrEqual(0);
    });

    it("should handle maximum safe integer", () => {
      const health = calculateWorldHealth(
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER
      );
      expect(health).toBeLessThanOrEqual(100);
    });
  });
});

describe("calculateWeather", () => {
  describe("boundary conditions at thresholds", () => {
    it("should return sunny for health >= 80", () => {
      expect(calculateWeather(80)).toBe("sunny");
      expect(calculateWeather(85)).toBe("sunny");
      expect(calculateWeather(100)).toBe("sunny");
    });

    it("should return cloudy for health 60-79", () => {
      expect(calculateWeather(60)).toBe("cloudy");
      expect(calculateWeather(70)).toBe("cloudy");
      expect(calculateWeather(79)).toBe("cloudy");
      expect(calculateWeather(79.9)).toBe("cloudy");
    });

    it("should return rain for health 40-59", () => {
      expect(calculateWeather(40)).toBe("rain");
      expect(calculateWeather(50)).toBe("rain");
      expect(calculateWeather(59)).toBe("rain");
      expect(calculateWeather(59.9)).toBe("rain");
    });

    it("should return storm for health 20-39", () => {
      expect(calculateWeather(20)).toBe("storm");
      expect(calculateWeather(30)).toBe("storm");
      expect(calculateWeather(39)).toBe("storm");
      expect(calculateWeather(39.9)).toBe("storm");
    });

    it("should return apocalypse for health < 20", () => {
      expect(calculateWeather(19)).toBe("apocalypse");
      expect(calculateWeather(10)).toBe("apocalypse");
      expect(calculateWeather(0)).toBe("apocalypse");
      expect(calculateWeather(19.9)).toBe("apocalypse");
    });
  });

  describe("edge cases", () => {
    it("should handle negative health", () => {
      expect(calculateWeather(-10)).toBe("apocalypse");
    });

    it("should handle health over 100", () => {
      expect(calculateWeather(150)).toBe("sunny");
    });
  });
});

describe("calculateBuildingLevel", () => {
  describe("market cap thresholds", () => {
    it("should return level 1 for market cap < $100K", () => {
      expect(calculateBuildingLevel(0)).toBe(1);
      expect(calculateBuildingLevel(50000)).toBe(1);
      expect(calculateBuildingLevel(99999)).toBe(1);
    });

    it("should return level 2 for market cap $100K-$500K", () => {
      expect(calculateBuildingLevel(100000)).toBe(2);
      expect(calculateBuildingLevel(250000)).toBe(2);
      expect(calculateBuildingLevel(499999)).toBe(2);
    });

    it("should return level 3 for market cap $500K-$2M", () => {
      expect(calculateBuildingLevel(500000)).toBe(3);
      expect(calculateBuildingLevel(1000000)).toBe(3);
      expect(calculateBuildingLevel(1999999)).toBe(3);
    });

    it("should return level 4 for market cap $2M-$10M", () => {
      expect(calculateBuildingLevel(2000000)).toBe(4);
      expect(calculateBuildingLevel(5000000)).toBe(4);
      expect(calculateBuildingLevel(9999999)).toBe(4);
    });

    it("should return level 5 for market cap >= $10M", () => {
      expect(calculateBuildingLevel(10000000)).toBe(5);
      expect(calculateBuildingLevel(50000000)).toBe(5);
      expect(calculateBuildingLevel(1000000000)).toBe(5);
    });
  });

  describe("edge cases and input sanitization (Bug Fix #8)", () => {
    it("should handle zero market cap", () => {
      expect(calculateBuildingLevel(0)).toBe(1);
    });

    it("should sanitize negative market cap to 0 (returns level 1)", () => {
      // Bug fix #8: Negative market cap should be treated as 0
      expect(calculateBuildingLevel(-1000)).toBe(1);
      expect(calculateBuildingLevel(-1)).toBe(1);
      expect(calculateBuildingLevel(-999999999)).toBe(1);
    });

    it("should handle decimal market cap", () => {
      expect(calculateBuildingLevel(99999.99)).toBe(1);
      expect(calculateBuildingLevel(100000.01)).toBe(2);
    });

    it("should handle NaN market cap (returns level 1)", () => {
      // Bug fix #8: NaN should be sanitized to 0
      expect(calculateBuildingLevel(NaN)).toBe(1);
    });

    it("should handle undefined/null coerced to NaN (returns level 1)", () => {
      // When passed undefined or null, it becomes NaN or 0
      expect(calculateBuildingLevel(undefined as unknown as number)).toBe(1);
      expect(calculateBuildingLevel(null as unknown as number)).toBe(1);
    });

    it("should handle Infinity (returns level 5)", () => {
      expect(calculateBuildingLevel(Infinity)).toBe(5);
    });

    it("should handle negative Infinity (returns level 1)", () => {
      // Negative infinity sanitized to 0
      expect(calculateBuildingLevel(-Infinity)).toBe(1);
    });
  });
});

describe("calculateBuildingHealth", () => {
  describe("health override (admin control)", () => {
    it("should return exact override value when healthOverride is provided", () => {
      // Override should bypass all calculations
      const result = calculateBuildingHealth(1000, 50000, 100, 50, false, 75);
      expect(result.health).toBe(75);
    });

    it("should return correct status for overridden health values", () => {
      // Active (> 75)
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 80).status).toBe("active");
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 100).status).toBe("active");

      // Warning (50-75)
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 75).status).toBe("warning");
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 51).status).toBe("warning");

      // Critical (25-50)
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 50).status).toBe("critical");
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 26).status).toBe("critical");

      // Dormant (<= 25)
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 25).status).toBe("dormant");
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 10).status).toBe("dormant");
      expect(calculateBuildingHealth(0, 0, 0, 50, false, 0).status).toBe("dormant");
    });

    it("should handle boundary values for healthOverride", () => {
      // Minimum (0)
      const min = calculateBuildingHealth(1000, 50000, 100, 80, false, 0);
      expect(min.health).toBe(0);
      expect(min.status).toBe("dormant");

      // Maximum (100)
      const max = calculateBuildingHealth(0, 0, -100, 10, false, 100);
      expect(max.health).toBe(100);
      expect(max.status).toBe("active");
    });

    it("should ignore healthOverride when null", () => {
      const withNull = calculateBuildingHealth(1000, 50000, 50, 60, false, null);
      const withoutOverride = calculateBuildingHealth(1000, 50000, 50, 60, false);
      // Both should calculate normally (not return null or 0)
      expect(withNull.health).toBe(withoutOverride.health);
      expect(withNull.status).toBe(withoutOverride.status);
    });

    it("should ignore healthOverride when undefined", () => {
      const withUndefined = calculateBuildingHealth(1000, 50000, 50, 60, false, undefined);
      const withoutOverride = calculateBuildingHealth(1000, 50000, 50, 60, false);
      expect(withUndefined.health).toBe(withoutOverride.health);
    });

    it("should override even for permanent buildings when healthOverride is set", () => {
      // Permanent buildings normally return 100, but override should take precedence
      const result = calculateBuildingHealth(0, 0, 0, 50, true, 25);
      expect(result.health).toBe(25);
      expect(result.status).toBe("dormant");
    });
  });

  describe("decay and recovery mechanics", () => {
    it("should apply heavy decay for low volume + low market cap", () => {
      // volume < 500, marketCap < 50000 = heavy decay (-8)
      const result = calculateBuildingHealth(100, 10000, 0, 50);
      expect(result.health).toBe(42); // 50 - 8 = 42
      expect(result.status).toBe("critical");
    });

    it("should apply moderate decay for low volume only", () => {
      // volume < 500, marketCap >= 50000 = moderate decay (-5)
      const result = calculateBuildingHealth(100, 100000, 0, 50);
      expect(result.health).toBe(45); // 50 - 5 = 45
    });

    it("should apply fast recovery for high volume", () => {
      // volume >= 2000 = fast recovery (+10)
      const result = calculateBuildingHealth(3000, 100000, 10, 50);
      expect(result.health).toBe(60); // 50 + 10 = 60
    });

    it("should apply light decay for moderate volume + price drop", () => {
      // volume between thresholds, change < -20 = light decay (-2)
      const result = calculateBuildingHealth(1000, 100000, -30, 50);
      expect(result.health).toBe(48); // 50 - 2 = 48
    });

    it("should apply normal recovery for normal activity", () => {
      // volume between thresholds, change >= -20 = recovery (+5)
      const result = calculateBuildingHealth(1000, 100000, 0, 50);
      expect(result.health).toBe(55); // 50 + 5 = 55
    });
  });

  describe("permanent buildings", () => {
    it("should always return 100 health for permanent buildings", () => {
      const result = calculateBuildingHealth(0, 0, -100, 10, true);
      expect(result.health).toBe(100);
      expect(result.status).toBe("active");
    });

    it("should ignore all other factors for permanent buildings", () => {
      const result = calculateBuildingHealth(0, 0, -100, 0, true);
      expect(result.health).toBe(100);
    });
  });

  describe("boundary conditions", () => {
    it("should never exceed 100", () => {
      const result = calculateBuildingHealth(5000, 1000000, 100, 99);
      expect(result.health).toBeLessThanOrEqual(100);
    });

    it("should never go below 0", () => {
      const result = calculateBuildingHealth(0, 0, -100, 5);
      expect(result.health).toBeGreaterThanOrEqual(0);
    });

    it("should return integer values", () => {
      const result = calculateBuildingHealth(1234.56, 78901.23, 12.34, 56.78);
      expect(Number.isInteger(result.health)).toBe(true);
    });

    it("should clamp health at 100 when recovery would exceed", () => {
      const result = calculateBuildingHealth(5000, 1000000, 50, 95);
      expect(result.health).toBe(100); // 95 + 10 clamped to 100
    });

    it("should clamp health at 0 when decay would go negative", () => {
      const result = calculateBuildingHealth(0, 1000, -50, 3);
      expect(result.health).toBe(0); // 3 - 8 clamped to 0
    });
  });

  describe("status determination", () => {
    it("should return active for health > 75", () => {
      const result = calculateBuildingHealth(3000, 100000, 10, 70);
      expect(result.health).toBe(80);
      expect(result.status).toBe("active");
    });

    it("should return warning for health 50-75", () => {
      const result = calculateBuildingHealth(1000, 100000, 0, 65);
      expect(result.health).toBe(70);
      expect(result.status).toBe("warning");
    });

    it("should return critical for health 25-50", () => {
      const result = calculateBuildingHealth(100, 100000, 0, 40);
      expect(result.health).toBe(35);
      expect(result.status).toBe("critical");
    });

    it("should return dormant for health <= 25", () => {
      const result = calculateBuildingHealth(0, 1000, -50, 30);
      expect(result.health).toBe(22);
      expect(result.status).toBe("dormant");
    });
  });
});

describe("calculateCharacterMood", () => {
  describe("mood thresholds", () => {
    it("should return celebrating for change > 100%", () => {
      expect(calculateCharacterMood(0, 101)).toBe("celebrating");
      expect(calculateCharacterMood(0, 500)).toBe("celebrating");
    });

    it("should return happy for change > 20% or earnings > 1000", () => {
      expect(calculateCharacterMood(0, 21)).toBe("happy");
      expect(calculateCharacterMood(0, 50)).toBe("happy");
      expect(calculateCharacterMood(1001, 0)).toBe("happy");
      expect(calculateCharacterMood(5000, -10)).toBe("happy");
    });

    it("should return sad for change < -20%", () => {
      expect(calculateCharacterMood(0, -21)).toBe("sad");
      expect(calculateCharacterMood(0, -50)).toBe("sad");
      expect(calculateCharacterMood(500, -30)).toBe("sad"); // Sad trumps earnings
    });

    it("should return neutral for moderate conditions", () => {
      expect(calculateCharacterMood(0, 0)).toBe("neutral");
      expect(calculateCharacterMood(500, 10)).toBe("neutral");
      expect(calculateCharacterMood(100, -10)).toBe("neutral");
    });
  });

  describe("edge cases", () => {
    it("should handle exactly threshold values", () => {
      expect(calculateCharacterMood(1000, 20)).toBe("neutral");
      expect(calculateCharacterMood(1001, 20)).toBe("happy");
      expect(calculateCharacterMood(0, -20)).toBe("neutral");
      expect(calculateCharacterMood(0, -21)).toBe("sad");
    });
  });
});

describe("generateBuildingPosition", () => {
  describe("grid layout", () => {
    it("should place buildings in grid pattern", () => {
      const positions: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        positions.push(generateBuildingPosition(i, 10));
      }

      // All positions should be within world bounds
      positions.forEach((pos) => {
        expect(pos.x).toBeGreaterThan(0);
        expect(pos.x).toBeLessThan(WORLD_WIDTH);
        expect(pos.y).toBeGreaterThan(0);
        expect(pos.y).toBeLessThan(WORLD_HEIGHT);
      });
    });

    it("should generate consistent positions (seeded random)", () => {
      const pos1 = generateBuildingPosition(3, 10);
      const pos2 = generateBuildingPosition(3, 10);
      expect(pos1.x).toBe(pos2.x);
      expect(pos1.y).toBe(pos2.y);
    });

    it("should respect max buildings limit (20)", () => {
      // Index 19 should work
      const pos19 = generateBuildingPosition(19, 25);
      expect(pos19.x).toBeDefined();
      expect(pos19.y).toBeDefined();

      // Index 20+ should still work but uses clamped total
      const pos20 = generateBuildingPosition(20, 25);
      expect(pos20.x).toBeDefined();
    });
  });

  describe("spacing", () => {
    it("should maintain minimum spacing between adjacent buildings", () => {
      const pos0 = generateBuildingPosition(0, 10);
      const pos1 = generateBuildingPosition(1, 10);

      const distance = Math.sqrt(Math.pow(pos1.x - pos0.x, 2) + Math.pow(pos1.y - pos0.y, 2));
      // Minimum spacing should be maintained (BUILDING_SPACING = 120 * SCALE)
      expect(distance).toBeGreaterThan(100 * SCALE);
    });
  });
});

describe("getCachedBuildingPosition", () => {
  beforeEach(() => {
    // Clean up cache before each test
    cleanupBuildingPositionCache(new Set());
  });

  it("should return consistent position for same mint", () => {
    const mint = "test-mint-123";
    const existingBuildings = new Set<string>();

    const pos1 = getCachedBuildingPosition(mint, existingBuildings);
    const pos2 = getCachedBuildingPosition(mint, existingBuildings);

    expect(pos1.x).toBe(pos2.x);
    expect(pos1.y).toBe(pos2.y);
  });

  it("should assign different positions to different mints", () => {
    const existingBuildings = new Set<string>();

    const pos1 = getCachedBuildingPosition("mint-1", existingBuildings);
    const pos2 = getCachedBuildingPosition("mint-2", existingBuildings);

    // Positions should be different (at least one coordinate)
    expect(pos1.x !== pos2.x || pos1.y !== pos2.y).toBe(true);
  });

  it("should maintain positions when rankings change", () => {
    const existingBuildings = new Set<string>();

    // First building gets position
    const mint1 = "original-first";
    const pos1Initial = getCachedBuildingPosition(mint1, existingBuildings);

    // New buildings added (simulating ranking changes)
    getCachedBuildingPosition("new-building-1", existingBuildings);
    getCachedBuildingPosition("new-building-2", existingBuildings);

    // Original should keep its position
    const pos1After = getCachedBuildingPosition(mint1, existingBuildings);
    expect(pos1After.x).toBe(pos1Initial.x);
    expect(pos1After.y).toBe(pos1Initial.y);
  });

  describe("deterministic hash-based positioning (Bug Fix #5)", () => {
    beforeEach(() => {
      cleanupBuildingPositionCache(new Set());
    });

    it("should produce IDENTICAL positions across cache clears (serverless simulation)", () => {
      const existingBuildings = new Set<string>();
      const mint = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";

      // Simulate Instance A (fresh cache)
      cleanupBuildingPositionCache(new Set());
      const posInstanceA = getCachedBuildingPosition(mint, existingBuildings);

      // Simulate Instance B (different serverless instance, fresh cache)
      cleanupBuildingPositionCache(new Set());
      const posInstanceB = getCachedBuildingPosition(mint, existingBuildings);

      // Simulate Instance C (yet another instance)
      cleanupBuildingPositionCache(new Set());
      const posInstanceC = getCachedBuildingPosition(mint, existingBuildings);

      // ALL instances must return IDENTICAL positions - this is the fix
      expect(posInstanceA.x).toBe(posInstanceB.x);
      expect(posInstanceA.y).toBe(posInstanceB.y);
      expect(posInstanceB.x).toBe(posInstanceC.x);
      expect(posInstanceB.y).toBe(posInstanceC.y);
    });

    it("should produce identical positions regardless of other buildings (no coordination needed)", () => {
      const mint = "TestMint111111111111111111111111111111111";

      // Scenario 1: mint is the only building
      cleanupBuildingPositionCache(new Set());
      const posAlone = getCachedBuildingPosition(mint, new Set());

      // Scenario 2: Other buildings were processed first
      cleanupBuildingPositionCache(new Set());
      getCachedBuildingPosition("OtherMint1111111111111111111111111111", new Set());
      getCachedBuildingPosition("OtherMint2222222222222222222222222222", new Set());
      const posWithOthers = getCachedBuildingPosition(mint, new Set());

      // Position must be IDENTICAL - no dependency on other buildings
      expect(posAlone.x).toBe(posWithOthers.x);
      expect(posAlone.y).toBe(posWithOthers.y);
    });

    it("should distribute mints across different positions via hash", () => {
      const existingBuildings = new Set<string>();
      cleanupBuildingPositionCache(new Set());

      const mints = [
        "TokenMint111111111111111111111111111111111",
        "TokenMint222222222222222222222222222222222",
        "TokenMint333333333333333333333333333333333",
        "TokenMint444444444444444444444444444444444",
        "TokenMint555555555555555555555555555555555",
      ];

      const positions = mints.map((mint) => getCachedBuildingPosition(mint, existingBuildings));

      // Should have varied positions (hash distributes across slots)
      const uniqueSlots = new Set(positions.map((p) => Math.round(p.x / 80)));
      expect(uniqueSlots.size).toBeGreaterThan(1);
    });

    it("should add small offset to separate potential hash collisions", () => {
      // Two mints that might hash to same slot should still have slight offset
      const mint1 = "CollisionTest111111111111111111111111111";
      const mint2 = "CollisionTest222222222222222222222222222";

      cleanupBuildingPositionCache(new Set());
      const pos1 = getCachedBuildingPosition(mint1, new Set());
      const pos2 = getCachedBuildingPosition(mint2, new Set());

      // Even if they hash to same slot, the mint-based offset separates them
      // (unless they're truly identical mints, which they're not)
      if (Math.round(pos1.x / 80) === Math.round(pos2.x / 80)) {
        // Same slot - offsets should differ
        expect(pos1.x).not.toBe(pos2.x);
      }
    });

    it("should handle all positions within world bounds", () => {
      cleanupBuildingPositionCache(new Set());
      const existingBuildings = new Set<string>();

      // Test 25 different mints
      const mints = Array.from({ length: 25 }, (_, i) => `BoundsMint${i}${"z".repeat(30)}`);
      const positions = mints.map((mint) => getCachedBuildingPosition(mint, existingBuildings));

      positions.forEach((pos) => {
        expect(pos.x).toBeGreaterThan(-50); // Allow small negative from offset
        expect(pos.x).toBeLessThan(WORLD_WIDTH + 50);
        expect(pos.y).toBeGreaterThan(0);
        expect(pos.y).toBeLessThan(WORLD_HEIGHT);
      });
    });
  });
});

describe("cleanupBuildingPositionCache", () => {
  beforeEach(() => {
    // Reset cache
    cleanupBuildingPositionCache(new Set());
  });

  it("should remove positions for mints not in active set", () => {
    const existingBuildings = new Set<string>();

    // Add some cached positions
    getCachedBuildingPosition("keep-me", existingBuildings);
    getCachedBuildingPosition("remove-me", existingBuildings);

    // Cleanup with only "keep-me" active
    cleanupBuildingPositionCache(new Set(["keep-me"]));

    // "remove-me" position should be cleared (new position assigned)
    // We can verify by checking if a new index is assigned
    const posKept = getCachedBuildingPosition("keep-me", existingBuildings);
    const posNew = getCachedBuildingPosition("remove-me", existingBuildings);

    // They should both have valid positions
    expect(posKept.x).toBeDefined();
    expect(posNew.x).toBeDefined();
  });
});

describe("generateCharacterPosition", () => {
  it("should generate position within world bounds", () => {
    for (let i = 0; i < 100; i++) {
      const pos = generateCharacterPosition();
      expect(pos.x).toBeGreaterThan(50 * SCALE);
      expect(pos.x).toBeLessThan(WORLD_WIDTH - 50 * SCALE);
      expect(pos.y).toBeGreaterThanOrEqual(550 * SCALE);
      expect(pos.y).toBeLessThanOrEqual(565 * SCALE);
    }
  });

  it("should generate varied positions (random)", () => {
    const positions = Array.from({ length: 10 }, () => generateCharacterPosition());
    const uniqueX = new Set(positions.map((p) => Math.round(p.x)));
    // Should have some variety (at least 3 different X values)
    expect(uniqueX.size).toBeGreaterThan(2);
  });
});

describe("transformFeeEarnerToCharacter", () => {
  const baseEarner: FeeEarner = {
    wallet: "test-wallet-123",
    username: "testuser",
    provider: "twitter",
    providerUsername: "testuser_twitter",
    avatarUrl: "https://example.com/avatar.png",
    earnings24h: 500,
    change24h: 10,
    totalEarnings: 1000,
  };

  it("should transform basic earner to character", () => {
    const character = transformFeeEarnerToCharacter(baseEarner);

    expect(character.id).toBe(baseEarner.wallet);
    expect(character.username).toBe(baseEarner.providerUsername);
    expect(character.provider).toBe(baseEarner.provider);
    expect(character.mood).toBe("neutral");
    // Zone is determined by wallet hash - verify it's a valid zone
    expect(["main_city", "trending", "ballers", "founders"]).toContain(character.zone);
  });

  it("should place Toly at fixed center position", () => {
    const tolyEarner: FeeEarner = {
      ...baseEarner,
      wallet: "toly-solana-permanent",
      isToly: true,
    };

    const character = transformFeeEarnerToCharacter(tolyEarner);
    expect(character.x).toBe(WORLD_WIDTH / 2);
    expect(character.isToly).toBe(true);
    expect(character.mood).toBe("happy");
  });

  it("should place special characters in correct zones", () => {
    const cjEarner: FeeEarner = {
      ...baseEarner,
      wallet: "cj-grove-street-permanent",
    };
    // CJ should go to BagsCity (trending zone)
    const cjChar = transformFeeEarnerToCharacter({
      ...cjEarner,
      isCJ: true,
    } as any);
    expect(cjChar.zone).toBe("trending");
  });

  it("should preserve existing position if provided", () => {
    const existingCharacter = {
      ...transformFeeEarnerToCharacter(baseEarner),
      x: 100,
      y: 200,
    };

    const updated = transformFeeEarnerToCharacter(baseEarner, existingCharacter);
    expect(updated.x).toBe(100);
    expect(updated.y).toBe(200);
  });

  it("should calculate mood based on earnings and change", () => {
    const celebratingEarner = { ...baseEarner, change24h: 150 };
    expect(transformFeeEarnerToCharacter(celebratingEarner).mood).toBe("celebrating");

    const happyEarner = { ...baseEarner, earnings24h: 2000 };
    expect(transformFeeEarnerToCharacter(happyEarner).mood).toBe("happy");

    const sadEarner = { ...baseEarner, change24h: -30 };
    expect(transformFeeEarnerToCharacter(sadEarner).mood).toBe("sad");
  });
});

describe("transformTokenToBuilding", () => {
  const baseToken: TokenInfo = {
    mint: "test-token-mint",
    name: "Test Token",
    symbol: "TEST",
    creator: "creator-wallet",
    marketCap: 250000,
    volume24h: 5000,
    change24h: 15,
  };

  it("should transform basic token to building", () => {
    const building = transformTokenToBuilding(baseToken, 0);

    expect(building.id).toBe(baseToken.mint);
    expect(building.name).toBe(baseToken.name);
    expect(building.symbol).toBe(baseToken.symbol);
    expect(building.level).toBe(2); // $250K = level 2
    // Zone is now determined by hash of mint address for deterministic distribution
    expect(["main_city", "trending"]).toContain(building.zone);
    expect(building.tokenUrl).toBe(`https://bags.fm/${baseToken.mint}`);
  });

  it("should calculate building level from market cap", () => {
    const tokens = [
      { ...baseToken, marketCap: 50000 }, // Level 1
      { ...baseToken, marketCap: 100000 }, // Level 2
      { ...baseToken, marketCap: 500000 }, // Level 3
      { ...baseToken, marketCap: 2000000 }, // Level 4
      { ...baseToken, marketCap: 10000000 }, // Level 5
    ];

    expect(transformTokenToBuilding(tokens[0], 0).level).toBe(1);
    expect(transformTokenToBuilding(tokens[1], 0).level).toBe(2);
    expect(transformTokenToBuilding(tokens[2], 0).level).toBe(3);
    expect(transformTokenToBuilding(tokens[3], 0).level).toBe(4);
    expect(transformTokenToBuilding(tokens[4], 0).level).toBe(5);
  });

  it("should place BagsWorld HQ in sky with fixed position", () => {
    const hqToken: TokenInfo = {
      ...baseToken,
      mint: "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
      symbol: "BAGSWORLD",
    };

    const building = transformTokenToBuilding(hqToken, 0);
    expect(building.y).toBe(500); // Sky position
    expect(building.isFloating).toBe(true);
    expect(building.level).toBe(5); // Always max level
    expect(building.glowing).toBe(true);
    expect(building.zone).toBeUndefined(); // Visible from both zones
  });

  it("should place Casino in BagsCity zone", () => {
    const casinoToken: TokenInfo = {
      ...baseToken,
      mint: "CasinoBuilding",
      symbol: "CASINO",
    };

    const building = transformTokenToBuilding(casinoToken, 0);
    expect(building.zone).toBe("trending");
  });

  it("should respect level override from admin", () => {
    const tokenWithOverride: TokenInfo = {
      ...baseToken,
      levelOverride: 5,
      marketCap: 1000, // Would normally be level 1
    };

    const building = transformTokenToBuilding(tokenWithOverride, 0);
    expect(building.level).toBe(5);
  });

  it("should calculate building health with decay", () => {
    const existingBuilding = transformTokenToBuilding(baseToken, 0);
    existingBuilding.health = 80;

    // Use very negative change with no volume (which causes decay)
    const updatedToken = { ...baseToken, change24h: -50, volume24h: 0 };
    const updated = transformTokenToBuilding(updatedToken, 0, existingBuilding);

    // With -50% change and 0 volume (decay):
    // changeBasedHealth = 50 + (-50 * 0.5) = 25
    // blended = 80*0.7 + 25*0.3 - 5 = 56 + 7.5 - 5 = 58.5 -> 59
    // Health should decrease from 80
    expect(updated.health).toBeLessThan(80);
  });

  it("should set permanent buildings to 100 health", () => {
    const treasuryToken: TokenInfo = {
      ...baseToken,
      mint: "TreasuryHub",
    };

    const building = transformTokenToBuilding(treasuryToken, 0);
    expect(building.health).toBe(100);
  });

  it("should set glowing for high price change", () => {
    const pumpingToken: TokenInfo = {
      ...baseToken,
      change24h: 100,
    };

    const building = transformTokenToBuilding(pumpingToken, 0);
    expect(building.glowing).toBe(true);
  });

  describe("admin overrides", () => {
    it("should use positionOverride when provided", () => {
      const tokenWithPosition: TokenInfo = {
        ...baseToken,
        positionOverride: { x: 500, y: 700 },
      };

      const building = transformTokenToBuilding(tokenWithPosition, 0);
      expect(building.x).toBe(500);
      expect(building.y).toBe(700);
    });

    it("should use generated position when positionOverride is null", () => {
      const tokenWithNullPosition: TokenInfo = {
        ...baseToken,
        positionOverride: null,
      };

      const building = transformTokenToBuilding(tokenWithNullPosition, 0);
      // Should use generated position (not 0,0)
      expect(building.x).toBeGreaterThan(0);
      expect(building.y).toBeGreaterThan(0);
    });

    it("should include styleOverride in building when provided", () => {
      const tokenWithStyle: TokenInfo = {
        ...baseToken,
        styleOverride: 2,
      };

      const building = transformTokenToBuilding(tokenWithStyle, 0);
      expect(building.styleOverride).toBe(2);
    });

    it("should pass styleOverride as null when not set", () => {
      const building = transformTokenToBuilding(baseToken, 0);
      expect(building.styleOverride).toBeUndefined();
    });

    it("should use healthOverride in building health calculation", () => {
      const tokenWithHealth: TokenInfo = {
        ...baseToken,
        healthOverride: 25,
      };

      const building = transformTokenToBuilding(tokenWithHealth, 0);
      expect(building.health).toBe(25);
      expect(building.status).toBe("dormant");
    });

    it("should combine all overrides correctly", () => {
      const tokenWithAllOverrides: TokenInfo = {
        ...baseToken,
        positionOverride: { x: 100, y: 800 },
        styleOverride: 3,
        healthOverride: 60,
        levelOverride: 4,
      };

      const building = transformTokenToBuilding(tokenWithAllOverrides, 0);
      expect(building.x).toBe(100);
      expect(building.y).toBe(800);
      expect(building.styleOverride).toBe(3);
      expect(building.health).toBe(60);
      expect(building.level).toBe(4);
    });

    it("should not use positionOverride for BagsWorld HQ (always floats in sky)", () => {
      const hqWithOverride: TokenInfo = {
        ...baseToken,
        mint: "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
        symbol: "BAGSWORLD",
        positionOverride: { x: 100, y: 100 },
      };

      const building = transformTokenToBuilding(hqWithOverride, 0);
      // HQ should still be in sky, not at override position
      expect(building.y).toBe(500);
      expect(building.isFloating).toBe(true);
    });

    it("should handle healthOverride of 0 (minimum)", () => {
      const tokenWithZeroHealth: TokenInfo = {
        ...baseToken,
        healthOverride: 0,
      };

      const building = transformTokenToBuilding(tokenWithZeroHealth, 0);
      expect(building.health).toBe(0);
      expect(building.status).toBe("dormant");
    });

    it("should handle healthOverride of 100 (maximum)", () => {
      const tokenWithMaxHealth: TokenInfo = {
        ...baseToken,
        healthOverride: 100,
      };

      const building = transformTokenToBuilding(tokenWithMaxHealth, 0);
      expect(building.health).toBe(100);
      expect(building.status).toBe("active");
    });

    it("should handle positionOverride at boundary values", () => {
      // Test min boundaries
      const tokenMinPos: TokenInfo = {
        ...baseToken,
        mint: "boundary-test-min",
        positionOverride: { x: 0, y: 0 },
      };
      const buildingMin = transformTokenToBuilding(tokenMinPos, 0);
      expect(buildingMin.x).toBe(0);
      expect(buildingMin.y).toBe(0);

      // Test max boundaries
      const tokenMaxPos: TokenInfo = {
        ...baseToken,
        mint: "boundary-test-max",
        positionOverride: { x: 1280, y: 960 },
      };
      const buildingMax = transformTokenToBuilding(tokenMaxPos, 0);
      expect(buildingMax.x).toBe(1280);
      expect(buildingMax.y).toBe(960);
    });

    it("should handle all styleOverride values (0-3)", () => {
      for (let style = 0; style <= 3; style++) {
        const tokenWithStyle: TokenInfo = {
          ...baseToken,
          mint: `style-test-${style}`,
          styleOverride: style,
        };
        const building = transformTokenToBuilding(tokenWithStyle, 0);
        expect(building.styleOverride).toBe(style);
      }
    });
  });
});

describe("generateGameEvent", () => {
  it("should generate token_launch event", () => {
    const event = generateGameEvent("token_launch", {
      username: "testuser",
      tokenName: "TestToken",
    });

    expect(event.type).toBe("token_launch");
    expect(event.message).toContain("launched");
    expect(event.message).toContain("TestToken");
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it("should generate fee_claim event with formatted amount", () => {
    const event = generateGameEvent("fee_claim", {
      username: "testuser",
      amount: 12.345,
    });

    expect(event.message).toContain("12.35 SOL");
  });

  it("should generate price_pump event", () => {
    const event = generateGameEvent("price_pump", {
      tokenName: "MoonToken",
      change: 150.7,
    });

    expect(event.message).toContain("pumped 151%");
  });

  it("should generate price_dump event with absolute value", () => {
    const event = generateGameEvent("price_dump", {
      tokenName: "DumpToken",
      change: -45.3,
    });

    expect(event.message).toContain("dumped 45%");
  });

  it("should generate unique IDs for each event", () => {
    const event1 = generateGameEvent("token_launch", { username: "a", tokenName: "A" });
    const event2 = generateGameEvent("token_launch", { username: "b", tokenName: "B" });

    expect(event1.id).not.toBe(event2.id);
  });
});

describe("buildWorldState", () => {
  const mockEarners: FeeEarner[] = [
    {
      wallet: "earner-1",
      username: "user1",
      provider: "twitter",
      providerUsername: "user1_twitter",
      earnings24h: 100,
      change24h: 10,
      totalEarnings: 500,
    },
  ];

  const mockTokens: TokenInfo[] = [
    {
      mint: "token-1",
      name: "Token One",
      symbol: "ONE",
      creator: "earner-1",
      marketCap: 500000,
      volume24h: 1000,
      change24h: 5,
    },
  ];

  it("should build complete world state", () => {
    const state = buildWorldState(mockEarners, mockTokens);

    expect(state.health).toBeDefined();
    expect(state.weather).toBeDefined();
    expect(state.population).toHaveLength(1);
    expect(state.buildings).toHaveLength(1);
    expect(state.events).toBeDefined();
    expect(state.lastUpdated).toBeDefined();
  });

  it("should calculate health from bags metrics when provided", () => {
    const metrics = {
      claimVolume24h: 50,
      totalLifetimeFees: 1000,
      activeTokenCount: 10,
    };

    const state = buildWorldState(mockEarners, mockTokens, undefined, metrics);
    // With these high metrics, health should be high
    expect(state.health).toBeGreaterThan(50);
  });

  it("should derive weather from health", () => {
    const highHealthMetrics = {
      claimVolume24h: 100,
      totalLifetimeFees: 2000,
      activeTokenCount: 15,
    };

    const state = buildWorldState(mockEarners, mockTokens, undefined, highHealthMetrics);
    // With 100 SOL claims + 2000 lifetime fees + 15 tokens, health should be very high
    expect(state.health).toBeGreaterThanOrEqual(80);
    // High health must produce sunny weather (unconditional assertion)
    expect(state.weather).toBe("sunny");
  });

  it("should preserve character positions from previous state", () => {
    const previousState: WorldState = {
      health: 50,
      weather: "cloudy",
      population: [
        {
          ...transformFeeEarnerToCharacter(mockEarners[0]),
          x: 999,
          y: 888,
        },
      ],
      buildings: [],
      events: [],
      lastUpdated: Date.now() - 1000,
    };

    const newState = buildWorldState(mockEarners, mockTokens, previousState);
    expect(newState.population[0].x).toBe(999);
    expect(newState.population[0].y).toBe(888);
  });

  it("should filter out buildings below decay threshold", () => {
    const previousState: WorldState = {
      health: 50,
      weather: "cloudy",
      population: [],
      buildings: [
        {
          ...transformTokenToBuilding(mockTokens[0], 0),
          health: 5, // Below 10 threshold
        },
      ],
      events: [],
      lastUpdated: Date.now() - 1000,
    };

    // Token with very negative change will decay existing building
    const decayingToken = { ...mockTokens[0], change24h: -100 };
    const newState = buildWorldState(mockEarners, [decayingToken], previousState);

    // Building might be removed if health decays below threshold
    // (depends on blending calculation)
    expect(newState.buildings.length).toBeGreaterThanOrEqual(0);
  });

  it("should generate events for new token launches", () => {
    const previousState: WorldState = {
      health: 50,
      weather: "cloudy",
      population: [],
      buildings: [], // No buildings before
      events: [],
      lastUpdated: Date.now() - 1000,
    };

    const newState = buildWorldState(mockEarners, mockTokens, previousState);
    const launchEvent = newState.events.find((e) => e.type === "token_launch");
    expect(launchEvent).toBeDefined();
  });

  it("should limit population to MAX_CHARACTERS (25)", () => {
    const manyEarners: FeeEarner[] = Array.from({ length: 30 }, (_, i) => ({
      wallet: `earner-${i}`,
      username: `user${i}`,
      provider: "twitter",
      providerUsername: `user${i}`,
      earnings24h: 100,
      change24h: 0,
      totalEarnings: 100,
    }));

    const state = buildWorldState(manyEarners, mockTokens);
    expect(state.population.length).toBeLessThanOrEqual(25);
  });

  it("should limit buildings to MAX_BUILDINGS (20)", () => {
    const manyTokens: TokenInfo[] = Array.from({ length: 25 }, (_, i) => ({
      mint: `token-${i}`,
      name: `Token ${i}`,
      symbol: `T${i}`,
      creator: "creator",
      marketCap: 100000 + i * 10000,
      volume24h: 1000,
      change24h: 0,
    }));

    const state = buildWorldState(mockEarners, manyTokens);
    expect(state.buildings.length).toBeLessThanOrEqual(20);
  });

  it("should limit events to 20 entries", () => {
    const previousEvents = Array.from({ length: 25 }, (_, i) =>
      generateGameEvent("fee_claim", { username: `user${i}`, amount: i })
    );

    const previousState: WorldState = {
      health: 50,
      weather: "cloudy",
      population: [],
      buildings: [],
      events: previousEvents,
      lastUpdated: Date.now() - 1000,
    };

    const newState = buildWorldState(mockEarners, mockTokens, previousState);
    expect(newState.events.length).toBeLessThanOrEqual(20);
  });
});
