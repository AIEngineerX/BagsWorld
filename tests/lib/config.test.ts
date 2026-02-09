import {
  ECOSYSTEM_CONFIG,
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
