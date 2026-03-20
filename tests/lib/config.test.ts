import {
  ECOSYSTEM_CONFIG,
  BAGS_API_BASE_URL,
  isAdmin,
  isAdminConfigured,
  getBuildingTier,
  getEcosystemFeeShare,
} from "@/lib/config";

// ---------------------------------------------------------------------------
// ECOSYSTEM_CONFIG shape
// ---------------------------------------------------------------------------
describe("ECOSYSTEM_CONFIG", () => {
  it("has all top-level keys", () => {
    expect(ECOSYSTEM_CONFIG).toHaveProperty("ecosystem");
    expect(ECOSYSTEM_CONFIG).toHaveProperty("casino");
    expect(ECOSYSTEM_CONFIG).toHaveProperty("oracle");
    expect(ECOSYSTEM_CONFIG).toHaveProperty("admin");
    expect(ECOSYSTEM_CONFIG).toHaveProperty("buildings");
    expect(ECOSYSTEM_CONFIG).toHaveProperty("citizens");
    expect(ECOSYSTEM_CONFIG).toHaveProperty("world");
  });

  it("casino gate requires 1,000,000 tokens", () => {
    expect(ECOSYSTEM_CONFIG.casino.gateToken.minBalance).toBe(1_000_000);
  });

  it("oracle gate requires 2,000,000 tokens", () => {
    expect(ECOSYSTEM_CONFIG.oracle.gateToken.minBalance).toBe(2_000_000);
  });

  it("has exactly 5 building tiers", () => {
    expect(ECOSYSTEM_CONFIG.buildings.tiers).toHaveLength(5);
  });

  it("building tiers are ordered by ascending minMarketCap", () => {
    const caps = ECOSYSTEM_CONFIG.buildings.tiers.map((t) => t.minMarketCap);
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i]).toBeGreaterThan(caps[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// getBuildingTier
// ---------------------------------------------------------------------------
describe("getBuildingTier", () => {
  it("returns level 1 Startup for marketCap 0", () => {
    const tier = getBuildingTier(0);
    expect(tier.level).toBe(1);
    expect(tier.name).toBe("Startup");
    expect(tier.minMarketCap).toBe(0);
  });

  it("returns level 1 for marketCap just below level 2 boundary (99,999)", () => {
    const tier = getBuildingTier(99_999);
    expect(tier.level).toBe(1);
    expect(tier.name).toBe("Startup");
  });

  it("returns level 2 Growing at exact boundary (100,000)", () => {
    const tier = getBuildingTier(100_000);
    expect(tier.level).toBe(2);
    expect(tier.name).toBe("Growing");
    expect(tier.minMarketCap).toBe(100_000);
  });

  it("returns level 2 for marketCap just below level 3 boundary (499,999)", () => {
    const tier = getBuildingTier(499_999);
    expect(tier.level).toBe(2);
    expect(tier.name).toBe("Growing");
  });

  it("returns level 3 Established at exact boundary (500,000)", () => {
    const tier = getBuildingTier(500_000);
    expect(tier.level).toBe(3);
    expect(tier.name).toBe("Established");
    expect(tier.minMarketCap).toBe(500_000);
  });

  it("returns level 3 for marketCap 1,999,999", () => {
    const tier = getBuildingTier(1_999_999);
    expect(tier.level).toBe(3);
    expect(tier.name).toBe("Established");
  });

  it("returns level 4 Major at exact boundary (2,000,000)", () => {
    const tier = getBuildingTier(2_000_000);
    expect(tier.level).toBe(4);
    expect(tier.name).toBe("Major");
    expect(tier.minMarketCap).toBe(2_000_000);
  });

  it("returns level 4 for marketCap 9,999,999", () => {
    const tier = getBuildingTier(9_999_999);
    expect(tier.level).toBe(4);
    expect(tier.name).toBe("Major");
  });

  it("returns level 5 Elite at exact boundary (10,000,000)", () => {
    const tier = getBuildingTier(10_000_000);
    expect(tier.level).toBe(5);
    expect(tier.name).toBe("Elite");
    expect(tier.minMarketCap).toBe(10_000_000);
  });

  it("returns level 5 for very large marketCap (100,000,000)", () => {
    const tier = getBuildingTier(100_000_000);
    expect(tier.level).toBe(5);
    expect(tier.name).toBe("Elite");
  });

  it("returns level 1 fallback for negative marketCap (-1)", () => {
    const tier = getBuildingTier(-1);
    expect(tier.level).toBe(1);
    expect(tier.name).toBe("Startup");
  });
});

// ---------------------------------------------------------------------------
// isAdmin
// ---------------------------------------------------------------------------
describe("isAdmin", () => {
  it("returns false for null", () => {
    expect(isAdmin(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAdmin(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAdmin("")).toBe(false);
  });

  it("returns true for the dev-mode default admin wallet", () => {
    // In dev/test mode (no NETLIFY env), the fallback wallet is configured
    expect(isAdmin("9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC")).toBe(true);
  });

  it("returns false for a random non-admin wallet", () => {
    expect(isAdmin("randomWalletNotAdmin")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAdminConfigured
// ---------------------------------------------------------------------------
describe("isAdminConfigured", () => {
  it("returns true in dev mode (default wallet is configured)", () => {
    expect(isAdminConfigured()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getEcosystemFeeShare
// ---------------------------------------------------------------------------
describe("getEcosystemFeeShare", () => {
  it("returns correct provider", () => {
    const feeShare = getEcosystemFeeShare();
    expect(feeShare.provider).toBe("twitter");
  });

  it("returns correct providerUsername", () => {
    const feeShare = getEcosystemFeeShare();
    expect(feeShare.providerUsername).toBe("BagsWorldApp");
  });

  it("returns 0 bps (zero ecosystem fee)", () => {
    const feeShare = getEcosystemFeeShare();
    expect(feeShare.bps).toBe(0);
  });

  it("returns displayName matching providerUsername", () => {
    const feeShare = getEcosystemFeeShare();
    expect(feeShare.displayName).toBe("BagsWorldApp");
  });

  it("returns an object with exactly the expected keys", () => {
    const feeShare = getEcosystemFeeShare();
    expect(Object.keys(feeShare).sort()).toEqual(["bps", "displayName", "provider", "providerUsername"]);
  });
});

// ---------------------------------------------------------------------------
// getBuildingTier — edge cases
// ---------------------------------------------------------------------------
describe("getBuildingTier — edge cases", () => {
  it("returns level 1 fallback for NaN marketCap", () => {
    const tier = getBuildingTier(NaN);
    expect(tier.level).toBe(1);
    expect(tier.name).toBe("Startup");
  });

  it("returns level 5 for Infinity marketCap", () => {
    const tier = getBuildingTier(Infinity);
    expect(tier.level).toBe(5);
    expect(tier.name).toBe("Elite");
  });

  it("returns level 1 fallback for -Infinity marketCap", () => {
    const tier = getBuildingTier(-Infinity);
    expect(tier.level).toBe(1);
    expect(tier.name).toBe("Startup");
  });

  it("returns level 2 (NOT level 3) at 499,999 — one below level 3 boundary", () => {
    const tier = getBuildingTier(499_999);
    expect(tier.level).toBe(2);
    expect(tier.name).toBe("Growing");
  });
});

// ---------------------------------------------------------------------------
// isAdmin — edge cases
// ---------------------------------------------------------------------------
describe("isAdmin — edge cases", () => {
  it("returns false for lowercase version of known admin wallet", () => {
    expect(isAdmin("9luwe53r7v5ohs8dmconp38w9foksugbjvweppu8ifuc")).toBe(false);
  });

  it("returns false for admin wallet with surrounding whitespace", () => {
    expect(isAdmin(" 9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BAGS_API_BASE_URL
// ---------------------------------------------------------------------------
describe("BAGS_API_BASE_URL", () => {
  it("defaults to the public Bags.fm v1 API URL", () => {
    expect(BAGS_API_BASE_URL).toBe("https://public-api-v2.bags.fm/api/v1");
  });

  it("is a valid URL string", () => {
    expect(() => new URL(BAGS_API_BASE_URL)).not.toThrow();
  });

  it("ends with /v1 (no trailing slash)", () => {
    expect(BAGS_API_BASE_URL).toMatch(/\/v1$/);
  });
});

// ---------------------------------------------------------------------------
// ECOSYSTEM_CONFIG — deeper validation
// ---------------------------------------------------------------------------
describe("ECOSYSTEM_CONFIG — deeper validation", () => {
  it("oracle.prizePool has defaultSol, minSol, and maxSol fields", () => {
    const { prizePool } = ECOSYSTEM_CONFIG.oracle;
    expect(prizePool).toHaveProperty("defaultSol");
    expect(prizePool).toHaveProperty("minSol");
    expect(prizePool).toHaveProperty("maxSol");
    expect(prizePool.defaultSol).toBe(0.1);
    expect(prizePool.minSol).toBe(0.1);
    expect(prizePool.maxSol).toBe(1.0);
  });

  it("minSol <= defaultSol <= maxSol ordering", () => {
    const { prizePool } = ECOSYSTEM_CONFIG.oracle;
    expect(prizePool.minSol).toBeLessThanOrEqual(prizePool.defaultSol);
    expect(prizePool.defaultSol).toBeLessThanOrEqual(prizePool.maxSol);
  });

  it("each building tier has level (number), name (string), and minMarketCap (number)", () => {
    for (const tier of ECOSYSTEM_CONFIG.buildings.tiers) {
      expect(typeof tier.level).toBe("number");
      expect(typeof tier.name).toBe("string");
      expect(typeof tier.minMarketCap).toBe("number");
    }
  });

  it("ecosystem.wallet is a valid Solana address format (44 chars, base58)", () => {
    const wallet = ECOSYSTEM_CONFIG.ecosystem.wallet;
    expect(wallet).toHaveLength(44);
    expect(wallet).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
  });

  it("decay.gracePeriod.durationMs is a positive number", () => {
    const durationMs = ECOSYSTEM_CONFIG.buildings.decay.gracePeriod.durationMs;
    expect(typeof durationMs).toBe("number");
    expect(durationMs).toBeGreaterThan(0);
    expect(durationMs).toBe(86_400_000);
  });
});
