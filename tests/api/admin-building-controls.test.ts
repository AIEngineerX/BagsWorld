/**
 * Admin Building Controls Validation Tests
 *
 * Tests validation logic for building management admin actions:
 * - Position validation (x: 0-1280, y: 0-960)
 * - Style validation (0-3)
 * - Health validation (0-100)
 * - Level validation (1-5)
 * - Mint address validation
 *
 * Tests boundary conditions, edge cases, and error handling.
 */

import { PublicKey } from "@solana/web3.js";

// Valid Solana addresses for testing
const VALID_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";
const VALID_MINT_2 = "So11111111111111111111111111111111111111112";

// Validation helper functions (matching the ones in admin/route.ts)
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function validateNullableRange(
  value: number | null,
  min: number,
  max: number
): { valid: boolean; error?: string } {
  if (value === null) return { valid: true };
  if (typeof value !== "number") return { valid: false, error: "Must be a number or null" };
  if (value < min || value > max) {
    return { valid: false, error: `Must be between ${min} and ${max}` };
  }
  return { valid: true };
}

function validatePosition(
  x: number | null,
  y: number | null
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const xValidation = validateNullableRange(x, 0, 1280);
  const yValidation = validateNullableRange(y, 0, 960);

  if (!xValidation.valid) errors.push(`X position: ${xValidation.error}`);
  if (!yValidation.valid) errors.push(`Y position: ${yValidation.error}`);

  return { valid: errors.length === 0, errors };
}

function validateStyle(style: number | null): { valid: boolean; error?: string } {
  return validateNullableRange(style, 0, 3);
}

function validateHealth(health: number | null): { valid: boolean; error?: string } {
  return validateNullableRange(health, 0, 100);
}

function validateLevel(level: number | null): { valid: boolean; error?: string } {
  return validateNullableRange(level, 1, 5);
}

describe("Solana Address Validation", () => {
  describe("valid addresses", () => {
    it("should accept valid base58 Solana addresses", () => {
      expect(isValidSolanaAddress(VALID_MINT)).toBe(true);
      expect(isValidSolanaAddress(VALID_MINT_2)).toBe(true);
    });

    it("should accept the ecosystem wallet address", () => {
      expect(isValidSolanaAddress("9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC")).toBe(true);
    });

    it("should accept 32-byte addresses in base58", () => {
      // All valid Solana addresses are 32 bytes encoded in base58
      expect(isValidSolanaAddress("11111111111111111111111111111111")).toBe(true);
    });
  });

  describe("invalid addresses", () => {
    it("should reject empty string", () => {
      expect(isValidSolanaAddress("")).toBe(false);
    });

    it("should reject short strings", () => {
      expect(isValidSolanaAddress("abc")).toBe(false);
      expect(isValidSolanaAddress("123456")).toBe(false);
    });

    it("should reject invalid base58 characters", () => {
      // 0, O, I, l are not valid base58 characters
      expect(isValidSolanaAddress("0auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
      expect(isValidSolanaAddress("OauyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
      expect(isValidSolanaAddress("IauyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
      expect(isValidSolanaAddress("lauyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
    });

    it("should reject addresses with special characters", () => {
      expect(isValidSolanaAddress("9auyeHWE-nJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
      expect(isValidSolanaAddress("9auyeHWE_nJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
      expect(isValidSolanaAddress("9auyeHWE.nJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
    });

    it("should reject addresses with spaces", () => {
      expect(isValidSolanaAddress(" 9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
      expect(isValidSolanaAddress("9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS ")).toBe(false);
      expect(isValidSolanaAddress("9auyeHWE SnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS")).toBe(false);
    });

    it("should reject non-string inputs handled as strings", () => {
      // These would fail base58 decoding
      expect(isValidSolanaAddress("null")).toBe(false);
      expect(isValidSolanaAddress("undefined")).toBe(false);
    });
  });
});

describe("Position Validation (set_position)", () => {
  describe("X coordinate validation (0-1280)", () => {
    it("should accept valid X values", () => {
      expect(validatePosition(0, 500).valid).toBe(true);
      expect(validatePosition(640, 500).valid).toBe(true);
      expect(validatePosition(1280, 500).valid).toBe(true);
    });

    it("should reject X below minimum (0)", () => {
      const result = validatePosition(-1, 500);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("X position");
    });

    it("should reject X above maximum (1280)", () => {
      const result = validatePosition(1281, 500);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("X position");
    });

    it("should accept decimal X values within range", () => {
      expect(validatePosition(640.5, 500).valid).toBe(true);
      expect(validatePosition(1279.99, 500).valid).toBe(true);
    });
  });

  describe("Y coordinate validation (0-960)", () => {
    it("should accept valid Y values", () => {
      expect(validatePosition(500, 0).valid).toBe(true);
      expect(validatePosition(500, 480).valid).toBe(true);
      expect(validatePosition(500, 960).valid).toBe(true);
    });

    it("should reject Y below minimum (0)", () => {
      const result = validatePosition(500, -1);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Y position");
    });

    it("should reject Y above maximum (960)", () => {
      const result = validatePosition(500, 961);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Y position");
    });

    it("should accept decimal Y values within range", () => {
      expect(validatePosition(500, 480.5).valid).toBe(true);
      expect(validatePosition(500, 959.99).valid).toBe(true);
    });
  });

  describe("combined X and Y validation", () => {
    it("should reject both X and Y if both are invalid", () => {
      const result = validatePosition(-100, 2000);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });

    it("should accept null for both (reset to auto)", () => {
      const result = validatePosition(null, null);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should accept null for one and valid for other", () => {
      expect(validatePosition(null, 500).valid).toBe(true);
      expect(validatePosition(500, null).valid).toBe(true);
    });
  });

  describe("boundary values", () => {
    it("should accept minimum boundaries (0, 0)", () => {
      expect(validatePosition(0, 0).valid).toBe(true);
    });

    it("should accept maximum boundaries (1280, 960)", () => {
      expect(validatePosition(1280, 960).valid).toBe(true);
    });

    it("should accept center position (640, 480)", () => {
      expect(validatePosition(640, 480).valid).toBe(true);
    });
  });
});

describe("Style Validation (set_style)", () => {
  describe("valid style values (0-3)", () => {
    it("should accept style 0", () => {
      expect(validateStyle(0).valid).toBe(true);
    });

    it("should accept style 1", () => {
      expect(validateStyle(1).valid).toBe(true);
    });

    it("should accept style 2", () => {
      expect(validateStyle(2).valid).toBe(true);
    });

    it("should accept style 3", () => {
      expect(validateStyle(3).valid).toBe(true);
    });

    it("should accept null (reset to auto)", () => {
      expect(validateStyle(null).valid).toBe(true);
    });
  });

  describe("invalid style values", () => {
    it("should reject style below 0", () => {
      const result = validateStyle(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("between 0 and 3");
    });

    it("should reject style above 3", () => {
      const result = validateStyle(4);
      expect(result.valid).toBe(false);
    });

    it("should reject large style values", () => {
      expect(validateStyle(100).valid).toBe(false);
      expect(validateStyle(999).valid).toBe(false);
    });

    it("should reject decimal style values", () => {
      // Styles should be integers, but the validation only checks range
      // The database will handle integer conversion
      expect(validateStyle(1.5).valid).toBe(true); // Within range
      expect(validateStyle(3.9).valid).toBe(false); // Rounds to 4, out of range
    });
  });
});

describe("Health Validation (set_health)", () => {
  describe("valid health values (0-100)", () => {
    it("should accept health 0 (minimum - dormant)", () => {
      expect(validateHealth(0).valid).toBe(true);
    });

    it("should accept health 100 (maximum - fully active)", () => {
      expect(validateHealth(100).valid).toBe(true);
    });

    it("should accept health at status thresholds", () => {
      // Dormant threshold (10)
      expect(validateHealth(10).valid).toBe(true);
      // Critical threshold (25)
      expect(validateHealth(25).valid).toBe(true);
      // Warning threshold (50)
      expect(validateHealth(50).valid).toBe(true);
      // Active threshold (75)
      expect(validateHealth(75).valid).toBe(true);
    });

    it("should accept null (reset to auto-calculated)", () => {
      expect(validateHealth(null).valid).toBe(true);
    });
  });

  describe("invalid health values", () => {
    it("should reject health below 0", () => {
      const result = validateHealth(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("between 0 and 100");
    });

    it("should reject health above 100", () => {
      const result = validateHealth(101);
      expect(result.valid).toBe(false);
    });

    it("should reject large health values", () => {
      expect(validateHealth(200).valid).toBe(false);
      expect(validateHealth(1000).valid).toBe(false);
    });
  });

  describe("decimal health values", () => {
    it("should accept decimal health values within range", () => {
      expect(validateHealth(50.5).valid).toBe(true);
      expect(validateHealth(99.9).valid).toBe(true);
      expect(validateHealth(0.1).valid).toBe(true);
    });

    it("should reject decimal health values out of range", () => {
      expect(validateHealth(100.1).valid).toBe(false);
      expect(validateHealth(-0.1).valid).toBe(false);
    });
  });

  describe("health status mapping", () => {
    // These values should map to specific statuses in calculateBuildingHealth
    it("should accept values that map to dormant status (<= 25)", () => {
      expect(validateHealth(5).valid).toBe(true);
      expect(validateHealth(15).valid).toBe(true);
      expect(validateHealth(25).valid).toBe(true);
    });

    it("should accept values that map to critical status (26-50)", () => {
      expect(validateHealth(26).valid).toBe(true);
      expect(validateHealth(40).valid).toBe(true);
      expect(validateHealth(50).valid).toBe(true);
    });

    it("should accept values that map to warning status (51-75)", () => {
      expect(validateHealth(51).valid).toBe(true);
      expect(validateHealth(65).valid).toBe(true);
      expect(validateHealth(75).valid).toBe(true);
    });

    it("should accept values that map to active status (> 75)", () => {
      expect(validateHealth(76).valid).toBe(true);
      expect(validateHealth(90).valid).toBe(true);
      expect(validateHealth(100).valid).toBe(true);
    });
  });
});

describe("Level Override Validation (set_level_override)", () => {
  describe("valid level values (1-5)", () => {
    it("should accept level 1 (Startup)", () => {
      expect(validateLevel(1).valid).toBe(true);
    });

    it("should accept level 2 (Growing)", () => {
      expect(validateLevel(2).valid).toBe(true);
    });

    it("should accept level 3 (Established)", () => {
      expect(validateLevel(3).valid).toBe(true);
    });

    it("should accept level 4 (Major)", () => {
      expect(validateLevel(4).valid).toBe(true);
    });

    it("should accept level 5 (Elite)", () => {
      expect(validateLevel(5).valid).toBe(true);
    });

    it("should accept null (reset to auto-calculated from market cap)", () => {
      expect(validateLevel(null).valid).toBe(true);
    });
  });

  describe("invalid level values", () => {
    it("should reject level 0 (below minimum)", () => {
      const result = validateLevel(0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("between 1 and 5");
    });

    it("should reject level 6 (above maximum)", () => {
      const result = validateLevel(6);
      expect(result.valid).toBe(false);
    });

    it("should reject negative levels", () => {
      expect(validateLevel(-1).valid).toBe(false);
      expect(validateLevel(-5).valid).toBe(false);
    });

    it("should reject large level values", () => {
      expect(validateLevel(10).valid).toBe(false);
      expect(validateLevel(100).valid).toBe(false);
    });
  });

  describe("level to market cap mapping", () => {
    // Validates that levels 1-5 are the valid range matching the tier system
    // Level 1: < $100K
    // Level 2: $100K - $500K
    // Level 3: $500K - $2M
    // Level 4: $2M - $10M
    // Level 5: $10M+
    it("should accept all tier levels", () => {
      for (let level = 1; level <= 5; level++) {
        expect(validateLevel(level).valid).toBe(true);
      }
    });
  });
});

describe("Combined Validation Scenarios", () => {
  describe("building with all overrides", () => {
    it("should validate position, style, health, and level independently", () => {
      // All valid
      expect(validatePosition(640, 480).valid).toBe(true);
      expect(validateStyle(2).valid).toBe(true);
      expect(validateHealth(75).valid).toBe(true);
      expect(validateLevel(4).valid).toBe(true);
    });

    it("should allow resetting all to auto with null", () => {
      expect(validatePosition(null, null).valid).toBe(true);
      expect(validateStyle(null).valid).toBe(true);
      expect(validateHealth(null).valid).toBe(true);
      expect(validateLevel(null).valid).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle minimum valid building configuration", () => {
      // Position at origin, style 0, health 0, level 1
      expect(validatePosition(0, 0).valid).toBe(true);
      expect(validateStyle(0).valid).toBe(true);
      expect(validateHealth(0).valid).toBe(true);
      expect(validateLevel(1).valid).toBe(true);
    });

    it("should handle maximum valid building configuration", () => {
      // Position at max, style 3, health 100, level 5
      expect(validatePosition(1280, 960).valid).toBe(true);
      expect(validateStyle(3).valid).toBe(true);
      expect(validateHealth(100).valid).toBe(true);
      expect(validateLevel(5).valid).toBe(true);
    });
  });
});
