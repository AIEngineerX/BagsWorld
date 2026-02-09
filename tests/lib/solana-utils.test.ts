/**
 * Solana Utility Tests
 *
 * Comprehensive tests for all 6 exported functions covering:
 * - Conversion between lamports and SOL
 * - Formatting with all branch paths and boundary values
 * - Roundtrip accuracy
 * - Invalid input handling
 * - Suffix toggle
 * - Compact formatting
 * - String parsing with suffixes
 */

import {
  LAMPORTS_PER_SOL,
  lamportsToSol,
  solToLamports,
  formatSol,
  formatLamports,
  formatSolCompact,
  parseSolString,
} from "@/lib/solana-utils";

describe("LAMPORTS_PER_SOL", () => {
  it("equals 1 billion", () => {
    expect(LAMPORTS_PER_SOL).toBe(1_000_000_000);
  });
});

describe("lamportsToSol", () => {
  it("converts 1 billion lamports to 1 SOL", () => {
    expect(lamportsToSol(1_000_000_000)).toBe(1);
  });

  it("converts 0 lamports to 0 SOL", () => {
    expect(lamportsToSol(0)).toBe(0);
  });

  it("converts 500 million lamports to 0.5 SOL", () => {
    expect(lamportsToSol(500_000_000)).toBe(0.5);
  });

  it("converts 1 lamport to a very small SOL amount", () => {
    expect(lamportsToSol(1)).toBe(1e-9);
  });

  it("converts large lamport values correctly", () => {
    expect(lamportsToSol(5_000_000_000_000)).toBe(5000);
  });

  it("handles fractional lamports (non-integer input)", () => {
    expect(lamportsToSol(1.5)).toBeCloseTo(1.5e-9, 18);
  });
});

describe("solToLamports", () => {
  it("converts 1 SOL to 1 billion lamports", () => {
    expect(solToLamports(1)).toBe(1_000_000_000);
  });

  it("converts 0 SOL to 0 lamports", () => {
    expect(solToLamports(0)).toBe(0);
  });

  it("converts 0.5 SOL to 500 million lamports", () => {
    expect(solToLamports(0.5)).toBe(500_000_000);
  });

  it("rounds to nearest lamport for fractional results", () => {
    // 0.0000000015 SOL = 1.5 lamports, rounds to 2
    expect(solToLamports(0.0000000015)).toBe(2);
  });

  it("rounds down when fraction is below 0.5", () => {
    // 0.0000000014 SOL = 1.4 lamports, rounds to 1
    expect(solToLamports(0.0000000014)).toBe(1);
  });

  it("converts large SOL values", () => {
    expect(solToLamports(5000)).toBe(5_000_000_000_000);
  });
});

describe("lamportsToSol / solToLamports roundtrip", () => {
  const roundtripValues = [0, 1, 100, 1_000, 1_000_000, 1_000_000_000, 5_500_000_000];

  it.each(roundtripValues)("roundtrips correctly for %d lamports", (lamports) => {
    expect(solToLamports(lamportsToSol(lamports))).toBe(lamports);
  });

  it("roundtrips 0.1 SOL through both conversions", () => {
    const sol = 0.1;
    const lamports = solToLamports(sol);
    expect(lamports).toBe(100_000_000);
    expect(lamportsToSol(lamports)).toBeCloseTo(sol, 10);
  });

  it("roundtrips 0.001 SOL through both conversions", () => {
    const sol = 0.001;
    const lamports = solToLamports(sol);
    expect(lamports).toBe(1_000_000);
    expect(lamportsToSol(lamports)).toBeCloseTo(sol, 10);
  });

  it("roundtrips 999.999999999 SOL through both conversions", () => {
    const sol = 999.999999999;
    const lamports = solToLamports(sol);
    expect(lamports).toBe(999_999_999_999);
    expect(lamportsToSol(lamports)).toBeCloseTo(sol, 9);
  });
});

describe("formatSol", () => {
  describe("invalid inputs", () => {
    it("returns '0 SOL' for NaN", () => {
      expect(formatSol(NaN)).toBe("0 SOL");
    });

    it("returns '0 SOL' for null", () => {
      expect(formatSol(null as unknown as number)).toBe("0 SOL");
    });

    it("returns '0 SOL' for undefined", () => {
      expect(formatSol(undefined as unknown as number)).toBe("0 SOL");
    });

    it("returns '0' for NaN with includeSuffix=false", () => {
      expect(formatSol(NaN, false)).toBe("0");
    });

    it("returns '0' for null with includeSuffix=false", () => {
      expect(formatSol(null as unknown as number, false)).toBe("0");
    });
  });

  describe(">= 1M branch", () => {
    it("formats exactly 1,000,000 as '1.0M SOL'", () => {
      expect(formatSol(1_000_000)).toBe("1.0M SOL");
    });

    it("formats 1,500,000 as '1.5M SOL'", () => {
      expect(formatSol(1_500_000)).toBe("1.5M SOL");
    });

    it("formats 2,300,000 as '2.3M SOL'", () => {
      expect(formatSol(2_300_000)).toBe("2.3M SOL");
    });

    it("formats 999,999,999 as a large M value", () => {
      expect(formatSol(999_999_999)).toBe("1000.0M SOL");
    });

    it("formats 10,000,000 as '10.0M SOL'", () => {
      expect(formatSol(10_000_000)).toBe("10.0M SOL");
    });
  });

  describe(">= 1K branch", () => {
    it("formats exactly 1,000 as '1.0K SOL'", () => {
      expect(formatSol(1_000)).toBe("1.0K SOL");
    });

    it("formats 1,500 as '1.5K SOL'", () => {
      expect(formatSol(1_500)).toBe("1.5K SOL");
    });

    it("formats 999,999 as '1000.0K SOL' (just below 1M)", () => {
      expect(formatSol(999_999)).toBe("1000.0K SOL");
    });

    it("formats 50,000 as '50.0K SOL'", () => {
      expect(formatSol(50_000)).toBe("50.0K SOL");
    });

    it("formats 1,234 as '1.2K SOL'", () => {
      expect(formatSol(1_234)).toBe("1.2K SOL");
    });
  });

  describe(">= 1 branch", () => {
    it("formats exactly 1 as '1.00 SOL'", () => {
      expect(formatSol(1)).toBe("1.00 SOL");
    });

    it("formats 5.5 as '5.50 SOL'", () => {
      expect(formatSol(5.5)).toBe("5.50 SOL");
    });

    it("formats 999.99 as '999.99 SOL'", () => {
      expect(formatSol(999.99)).toBe("999.99 SOL");
    });

    it("formats 999.999 as '1000.00 SOL' (just below 1K, rounds up)", () => {
      // 999.999.toFixed(2) = "1000.00" because of rounding
      expect(formatSol(999.999)).toBe("1000.00 SOL");
    });

    it("formats 1.005 as '1.00 SOL' (IEEE 754: 1.005 stored as 1.00499...)", () => {
      // In JavaScript, 1.005 is represented as 1.004999...97 in IEEE 754,
      // so toFixed(2) rounds down to "1.00"
      expect(formatSol(1.005)).toBe("1.00 SOL");
    });

    it("formats 42 as '42.00 SOL'", () => {
      expect(formatSol(42)).toBe("42.00 SOL");
    });
  });

  describe(">= 0.01 branch", () => {
    it("formats exactly 0.01 as '0.010 SOL'", () => {
      expect(formatSol(0.01)).toBe("0.010 SOL");
    });

    it("formats 0.05 as '0.050 SOL'", () => {
      expect(formatSol(0.05)).toBe("0.050 SOL");
    });

    it("formats 0.999 as '0.999 SOL'", () => {
      expect(formatSol(0.999)).toBe("0.999 SOL");
    });

    it("formats 0.1 as '0.100 SOL'", () => {
      expect(formatSol(0.1)).toBe("0.100 SOL");
    });

    it("formats 0.123 as '0.123 SOL'", () => {
      expect(formatSol(0.123)).toBe("0.123 SOL");
    });
  });

  describe(">= 0.0001 branch", () => {
    it("formats exactly 0.0001 as '0.0001 SOL'", () => {
      expect(formatSol(0.0001)).toBe("0.0001 SOL");
    });

    it("formats 0.001 as '0.0010 SOL'", () => {
      expect(formatSol(0.001)).toBe("0.0010 SOL");
    });

    it("formats 0.005 as '0.0050 SOL'", () => {
      expect(formatSol(0.005)).toBe("0.0050 SOL");
    });

    it("formats 0.0099 as '0.0099 SOL'", () => {
      expect(formatSol(0.0099)).toBe("0.0099 SOL");
    });

    it("formats 0.009999 as '0.0100 SOL' (rounds into next branch display)", () => {
      expect(formatSol(0.009999)).toBe("0.0100 SOL");
    });
  });

  describe("> 0 branch (very small values)", () => {
    it("formats 0.00001 as '0.000010 SOL'", () => {
      expect(formatSol(0.00001)).toBe("0.000010 SOL");
    });

    it("formats 0.00009999 as '0.000100 SOL'", () => {
      expect(formatSol(0.00009999)).toBe("0.000100 SOL");
    });

    it("formats 0.000001 as '0.000001 SOL'", () => {
      expect(formatSol(0.000001)).toBe("0.000001 SOL");
    });

    it("formats a very tiny value with 6 decimals", () => {
      // 0.0000005 rounds to 0.000000 at 6 decimal places due to IEEE 754
      expect(formatSol(0.0000005)).toBe("0.000000 SOL");
    });

    it("formats 0.0000015 to show non-zero at 6 decimals", () => {
      expect(formatSol(0.0000015)).toBe("0.000002 SOL");
    });
  });

  describe("zero", () => {
    it("formats 0 as '0 SOL'", () => {
      expect(formatSol(0)).toBe("0 SOL");
    });

    it("formats -0 as '0 SOL'", () => {
      // -0 is not > 0, so it falls through to the final branch
      expect(formatSol(-0)).toBe("0 SOL");
    });
  });

  describe("negative values", () => {
    it("formats negative value as '0 SOL' (falls through all branches)", () => {
      // Negative values fail all >= and > 0 checks, so they hit the final return
      expect(formatSol(-5)).toBe("0 SOL");
    });
  });

  describe("includeSuffix parameter", () => {
    it("omits suffix when includeSuffix=false for >= 1M", () => {
      expect(formatSol(1_500_000, false)).toBe("1.5M");
    });

    it("omits suffix when includeSuffix=false for >= 1K", () => {
      expect(formatSol(1_500, false)).toBe("1.5K");
    });

    it("omits suffix when includeSuffix=false for >= 1", () => {
      expect(formatSol(5.5, false)).toBe("5.50");
    });

    it("omits suffix when includeSuffix=false for >= 0.01", () => {
      expect(formatSol(0.05, false)).toBe("0.050");
    });

    it("omits suffix when includeSuffix=false for >= 0.0001", () => {
      expect(formatSol(0.001, false)).toBe("0.0010");
    });

    it("omits suffix when includeSuffix=false for > 0 tiny", () => {
      expect(formatSol(0.00001, false)).toBe("0.000010");
    });

    it("omits suffix when includeSuffix=false for 0", () => {
      expect(formatSol(0, false)).toBe("0");
    });

    it("includes suffix by default (includeSuffix=true)", () => {
      expect(formatSol(5)).toBe("5.00 SOL");
    });
  });
});

describe("formatLamports", () => {
  it("formats 1 billion lamports as '1.00 SOL'", () => {
    expect(formatLamports(1_000_000_000)).toBe("1.00 SOL");
  });

  it("formats 0 lamports as '0 SOL'", () => {
    expect(formatLamports(0)).toBe("0 SOL");
  });

  it("formats 500 million lamports as '0.500 SOL'", () => {
    expect(formatLamports(500_000_000)).toBe("0.500 SOL");
  });

  it("formats 1,500 billion lamports (1500 SOL) as '1.5K SOL'", () => {
    expect(formatLamports(1_500_000_000_000)).toBe("1.5K SOL");
  });

  it("formats 100,000 lamports (0.0001 SOL) as '0.0001 SOL'", () => {
    expect(formatLamports(100_000)).toBe("0.0001 SOL");
  });

  it("formats 10 lamports as a very small SOL amount with 6 decimals", () => {
    expect(formatLamports(10)).toBe("0.000000 SOL");
  });

  it("respects includeSuffix=false", () => {
    expect(formatLamports(1_000_000_000, false)).toBe("1.00");
  });

  it("formats 5 billion lamports (5 SOL) without suffix", () => {
    expect(formatLamports(5_000_000_000, false)).toBe("5.00");
  });
});

describe("formatSolCompact", () => {
  describe(">= 1M branch", () => {
    it("formats exactly 1,000,000 as '1.0M'", () => {
      expect(formatSolCompact(1_000_000)).toBe("1.0M");
    });

    it("formats 2,500,000 as '2.5M'", () => {
      expect(formatSolCompact(2_500_000)).toBe("2.5M");
    });
  });

  describe(">= 1K branch", () => {
    it("formats exactly 1,000 as '1.0K'", () => {
      expect(formatSolCompact(1_000)).toBe("1.0K");
    });

    it("formats 999,999 as '1000.0K'", () => {
      expect(formatSolCompact(999_999)).toBe("1000.0K");
    });

    it("formats 5,500 as '5.5K'", () => {
      expect(formatSolCompact(5_500)).toBe("5.5K");
    });
  });

  describe(">= 10 branch", () => {
    it("formats exactly 10 as '10.0'", () => {
      expect(formatSolCompact(10)).toBe("10.0");
    });

    it("formats 999.9 as '999.9'", () => {
      expect(formatSolCompact(999.9)).toBe("999.9");
    });

    it("formats 50 as '50.0'", () => {
      expect(formatSolCompact(50)).toBe("50.0");
    });

    it("formats 99.95 as '100.0' (rounding)", () => {
      expect(formatSolCompact(99.95)).toBe("100.0");
    });
  });

  describe(">= 1 branch", () => {
    it("formats exactly 1 as '1.00'", () => {
      expect(formatSolCompact(1)).toBe("1.00");
    });

    it("formats 9.99 as '9.99'", () => {
      expect(formatSolCompact(9.99)).toBe("9.99");
    });

    it("formats 5.555 as '5.55' (IEEE 754: 5.555 stored as 5.55499...)", () => {
      // In JavaScript, 5.555 is represented as 5.554999...97 in IEEE 754,
      // so toFixed(2) rounds down to "5.55"
      expect(formatSolCompact(5.555)).toBe("5.55");
    });
  });

  describe(">= 0.1 branch", () => {
    it("formats exactly 0.1 as '0.10'", () => {
      expect(formatSolCompact(0.1)).toBe("0.10");
    });

    it("formats 0.99 as '0.99'", () => {
      expect(formatSolCompact(0.99)).toBe("0.99");
    });

    it("formats 0.5 as '0.50'", () => {
      expect(formatSolCompact(0.5)).toBe("0.50");
    });

    it("formats 0.123 as '0.12'", () => {
      expect(formatSolCompact(0.123)).toBe("0.12");
    });
  });

  describe(">= 0.01 branch", () => {
    it("formats exactly 0.01 as '0.010'", () => {
      expect(formatSolCompact(0.01)).toBe("0.010");
    });

    it("formats 0.099 as '0.099'", () => {
      expect(formatSolCompact(0.099)).toBe("0.099");
    });

    it("formats 0.05 as '0.050'", () => {
      expect(formatSolCompact(0.05)).toBe("0.050");
    });
  });

  describe("> 0 branch (very small)", () => {
    it("formats 0.001 as '0.0010'", () => {
      expect(formatSolCompact(0.001)).toBe("0.0010");
    });

    it("formats 0.0001 as '0.0001'", () => {
      expect(formatSolCompact(0.0001)).toBe("0.0001");
    });

    it("formats 0.00001 as '0.0000' (rounds to 4 decimals)", () => {
      expect(formatSolCompact(0.00001)).toBe("0.0000");
    });

    it("formats 0.009 as '0.0090'", () => {
      expect(formatSolCompact(0.009)).toBe("0.0090");
    });
  });

  describe("zero", () => {
    it("formats 0 as '0'", () => {
      expect(formatSolCompact(0)).toBe("0");
    });
  });
});

describe("parseSolString", () => {
  describe("M suffix", () => {
    it("parses '2.3M' as 2,300,000", () => {
      expect(parseSolString("2.3M")).toBe(2_300_000);
    });

    it("parses '2.3M SOL' as 2,300,000", () => {
      expect(parseSolString("2.3M SOL")).toBe(2_300_000);
    });

    it("parses '1.0M SOL' as 1,000,000", () => {
      expect(parseSolString("1.0M SOL")).toBe(1_000_000);
    });

    it("parses '10M' as 10,000,000", () => {
      expect(parseSolString("10M")).toBe(10_000_000);
    });
  });

  describe("K suffix", () => {
    it("parses '1.5K SOL' as 1,500", () => {
      expect(parseSolString("1.5K SOL")).toBe(1_500);
    });

    it("parses '1.5K' as 1,500", () => {
      expect(parseSolString("1.5K")).toBe(1_500);
    });

    it("parses '50K SOL' as 50,000", () => {
      expect(parseSolString("50K SOL")).toBe(50_000);
    });

    it("parses '1.0K SOL' as 1,000", () => {
      expect(parseSolString("1.0K SOL")).toBe(1_000);
    });
  });

  describe("plain numbers", () => {
    it("parses '0.05' as 0.05", () => {
      expect(parseSolString("0.05")).toBe(0.05);
    });

    it("parses '5.00 SOL' as 5", () => {
      expect(parseSolString("5.00 SOL")).toBe(5);
    });

    it("parses '0' as 0", () => {
      expect(parseSolString("0")).toBe(0);
    });

    it("parses '42.50' as 42.5", () => {
      expect(parseSolString("42.50")).toBe(42.5);
    });

    it("parses '0.0001 SOL' as 0.0001", () => {
      expect(parseSolString("0.0001 SOL")).toBe(0.0001);
    });
  });

  describe("case insensitivity", () => {
    it("parses lowercase 'sol' suffix", () => {
      expect(parseSolString("5.00 sol")).toBe(5);
    });

    it("parses lowercase 'k' suffix", () => {
      expect(parseSolString("1.5k sol")).toBe(1_500);
    });

    it("parses lowercase 'm' suffix", () => {
      expect(parseSolString("2.3m SOL")).toBe(2_300_000);
    });

    it("parses mixed case 'Sol'", () => {
      expect(parseSolString("10 Sol")).toBe(10);
    });
  });

  describe("invalid / edge-case inputs", () => {
    it("returns 0 for 'garbage'", () => {
      expect(parseSolString("garbage")).toBe(0);
    });

    it("returns 0 for empty string", () => {
      expect(parseSolString("")).toBe(0);
    });

    it("returns 0 for 'sol' alone (no numeric part)", () => {
      expect(parseSolString("sol")).toBe(0);
    });

    it("returns 0 for 'SOL' alone", () => {
      expect(parseSolString("SOL")).toBe(0);
    });

    it("parses leading number from mixed string like '123abc'", () => {
      // parseFloat("123ABC") returns 123
      expect(parseSolString("123abc")).toBe(123);
    });

    it("handles extra whitespace", () => {
      expect(parseSolString("  5.00  SOL  ")).toBe(5);
    });
  });

  describe("roundtrip with formatSol", () => {
    it("roundtrips 1500 through formatSol and parseSolString", () => {
      const formatted = formatSol(1500);
      expect(formatted).toBe("1.5K SOL");
      expect(parseSolString(formatted)).toBe(1500);
    });

    it("roundtrips 2,300,000 through formatSol and parseSolString", () => {
      const formatted = formatSol(2_300_000);
      expect(formatted).toBe("2.3M SOL");
      expect(parseSolString(formatted)).toBe(2_300_000);
    });

    it("roundtrips 5 through formatSol and parseSolString", () => {
      const formatted = formatSol(5);
      expect(formatted).toBe("5.00 SOL");
      expect(parseSolString(formatted)).toBe(5);
    });

    it("roundtrips 0.05 through formatSol and parseSolString", () => {
      const formatted = formatSol(0.05);
      expect(formatted).toBe("0.050 SOL");
      expect(parseSolString(formatted)).toBe(0.05);
    });
  });
});
