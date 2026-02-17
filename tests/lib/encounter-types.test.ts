import {
  getStatMultiplier,
  getTypeEffectiveness,
  getStabMultiplier,
  PLAYER_LEVEL_STATS,
  PLAYER_MOVES,
  ZONE_DIFFICULTY,
  STRUGGLE_MOVE,
  MAX_PLAYER_LEVEL,
} from "@/lib/encounter-types";

// ==========================================================================
// getStatMultiplier
// ==========================================================================
describe("getStatMultiplier", () => {
  it("returns 1.0 at stage 0 (neutral)", () => {
    expect(getStatMultiplier(0)).toBe(1);
  });

  it("returns 2.0 at max stage +6", () => {
    // Formula: (2 + stage) / 2
    expect(getStatMultiplier(6)).toBe((2 + 6) / 2);
  });

  it("returns 0.25 at min stage -6", () => {
    // Formula: 2 / (2 - stage) = 2 / (2 - (-6)) = 0.25
    expect(getStatMultiplier(-6)).toBe(2 / 8);
  });

  it("increases monotonically from -6 to +6", () => {
    let prev = getStatMultiplier(-6);
    for (let stage = -5; stage <= 6; stage++) {
      const current = getStatMultiplier(stage);
      expect(current).toBeGreaterThan(prev);
      prev = current;
    }
  });

  it("clamps values beyond +6 to +6", () => {
    expect(getStatMultiplier(7)).toBe(getStatMultiplier(6));
    expect(getStatMultiplier(100)).toBe(getStatMultiplier(6));
  });

  it("clamps values beyond -6 to -6", () => {
    expect(getStatMultiplier(-7)).toBe(getStatMultiplier(-6));
    expect(getStatMultiplier(-100)).toBe(getStatMultiplier(-6));
  });

  it("positive stages are >1", () => {
    for (let stage = 1; stage <= 6; stage++) {
      expect(getStatMultiplier(stage)).toBeGreaterThan(1);
    }
  });

  it("negative stages are <1", () => {
    for (let stage = -6; stage <= -1; stage++) {
      expect(getStatMultiplier(stage)).toBeLessThan(1);
    }
  });

  it("+1 and -1 are symmetric around 1.0 (both ×1.5 and ×0.667)", () => {
    expect(getStatMultiplier(1)).toBeCloseTo(1.5);
    expect(getStatMultiplier(-1)).toBeCloseTo(2 / 3);
  });
});

// ==========================================================================
// getTypeEffectiveness
// ==========================================================================
describe("getTypeEffectiveness", () => {
  describe("super effective (2x)", () => {
    it.each([
      ["fire", "grass"],
      ["fire", "bug"],
      ["water", "fire"],
      ["grass", "water"],
      ["grass", "aquatic"],
      ["bug", "grass"],
      ["flying", "bug"],
      ["flying", "grass"],
      ["aquatic", "fire"],
    ])("%s vs %s = 2", (move, defender) => {
      expect(getTypeEffectiveness(move as any, defender)).toBe(2);
    });
  });

  describe("not very effective (0.5x)", () => {
    it.each([
      ["fire", "water"],
      ["fire", "fire"],
      ["fire", "aquatic"],
      ["water", "grass"],
      ["water", "water"],
      ["water", "aquatic"],
      ["grass", "fire"],
      ["grass", "grass"],
      ["grass", "bug"],
      ["bug", "fire"],
      ["bug", "flying"],
      ["aquatic", "grass"],
      ["aquatic", "aquatic"],
    ])("%s vs %s = 0.5", (move, defender) => {
      expect(getTypeEffectiveness(move as any, defender)).toBe(0.5);
    });
  });

  describe("neutral (1x)", () => {
    it("normal vs anything is always neutral", () => {
      const types = ["fire", "water", "grass", "bug", "flying", "aquatic", "beast", "normal"];
      for (const t of types) {
        expect(getTypeEffectiveness("normal", t)).toBe(1);
      }
    });

    it("fire vs beast is neutral (not in chart)", () => {
      expect(getTypeEffectiveness("fire", "beast")).toBe(1);
    });

    it("flying vs beast is neutral (removed explicit 1.0 entry)", () => {
      expect(getTypeEffectiveness("flying", "beast")).toBe(1);
    });
  });

  describe("buff/debuff bypass", () => {
    it("buff type always returns 1 regardless of defender", () => {
      expect(getTypeEffectiveness("buff", "fire")).toBe(1);
      expect(getTypeEffectiveness("buff", "water")).toBe(1);
      expect(getTypeEffectiveness("buff", "grass")).toBe(1);
    });

    it("debuff type always returns 1 regardless of defender", () => {
      expect(getTypeEffectiveness("debuff", "fire")).toBe(1);
      expect(getTypeEffectiveness("debuff", "aquatic")).toBe(1);
    });
  });

  it("unknown defender type returns neutral", () => {
    expect(getTypeEffectiveness("fire", "dragon")).toBe(1);
    expect(getTypeEffectiveness("water", "nonexistent")).toBe(1);
  });
});

// ==========================================================================
// getStabMultiplier
// ==========================================================================
describe("getStabMultiplier", () => {
  it("returns 1.5 when move type matches attacker type", () => {
    expect(getStabMultiplier("fire", "fire")).toBe(1.5);
    expect(getStabMultiplier("water", "water")).toBe(1.5);
    expect(getStabMultiplier("aquatic", "aquatic")).toBe(1.5);
  });

  it("returns 1.0 when move type does not match", () => {
    expect(getStabMultiplier("fire", "water")).toBe(1);
    expect(getStabMultiplier("normal", "fire")).toBe(1);
  });

  it("buff type always returns 1 even if attacker is buff", () => {
    expect(getStabMultiplier("buff", "buff")).toBe(1);
  });

  it("debuff type always returns 1 even if attacker is debuff", () => {
    expect(getStabMultiplier("debuff", "debuff")).toBe(1);
  });

  it("normal move on normal attacker gets STAB", () => {
    expect(getStabMultiplier("normal", "normal")).toBe(1.5);
  });
});

// ==========================================================================
// Constants validation
// ==========================================================================
describe("PLAYER_LEVEL_STATS", () => {
  it("has entries for levels 1 through MAX_PLAYER_LEVEL", () => {
    for (let level = 1; level <= MAX_PLAYER_LEVEL; level++) {
      expect(PLAYER_LEVEL_STATS[level]).toBeDefined();
    }
  });

  it("level 1 requires 0 XP", () => {
    expect(PLAYER_LEVEL_STATS[1].xpNeeded).toBe(0);
  });

  it("XP thresholds increase monotonically", () => {
    for (let level = 2; level <= MAX_PLAYER_LEVEL; level++) {
      expect(PLAYER_LEVEL_STATS[level].xpNeeded).toBeGreaterThan(
        PLAYER_LEVEL_STATS[level - 1].xpNeeded
      );
    }
  });

  it("HP increases monotonically", () => {
    for (let level = 2; level <= MAX_PLAYER_LEVEL; level++) {
      expect(PLAYER_LEVEL_STATS[level].hp).toBeGreaterThan(PLAYER_LEVEL_STATS[level - 1].hp);
    }
  });

  it("all stats are positive integers", () => {
    for (let level = 1; level <= MAX_PLAYER_LEVEL; level++) {
      const stats = PLAYER_LEVEL_STATS[level];
      expect(stats.hp).toBeGreaterThan(0);
      expect(stats.attack).toBeGreaterThan(0);
      expect(stats.defense).toBeGreaterThan(0);
      expect(stats.speed).toBeGreaterThan(0);
      expect(Number.isInteger(stats.hp)).toBe(true);
    }
  });
});

describe("ZONE_DIFFICULTY", () => {
  it("main_city is the easiest zone", () => {
    expect(ZONE_DIFFICULTY.main_city.minLevel).toBeLessThanOrEqual(
      ZONE_DIFFICULTY.founders.minLevel
    );
    expect(ZONE_DIFFICULTY.main_city.minLevel).toBeLessThanOrEqual(
      ZONE_DIFFICULTY.moltbook.minLevel
    );
  });

  it("all zones have minLevel <= maxLevel", () => {
    for (const zone of Object.values(ZONE_DIFFICULTY)) {
      expect(zone.minLevel).toBeLessThanOrEqual(zone.maxLevel);
    }
  });

  it("all levels are positive", () => {
    for (const zone of Object.values(ZONE_DIFFICULTY)) {
      expect(zone.minLevel).toBeGreaterThan(0);
      expect(zone.maxLevel).toBeGreaterThan(0);
    }
  });
});

describe("PLAYER_MOVES", () => {
  it("has exactly 4 moves", () => {
    expect(PLAYER_MOVES).toHaveLength(4);
  });

  it("all moves have pp equal to maxPp", () => {
    for (const move of PLAYER_MOVES) {
      expect(move.pp).toBe(move.maxPp);
    }
  });

  it("all moves have accuracy between 1 and 100", () => {
    for (const move of PLAYER_MOVES) {
      expect(move.accuracy).toBeGreaterThanOrEqual(1);
      expect(move.accuracy).toBeLessThanOrEqual(100);
    }
  });

  it("includes at least one status move (power=0)", () => {
    expect(PLAYER_MOVES.some((m) => m.power === 0)).toBe(true);
  });

  it("includes at least one damaging move (power>0)", () => {
    expect(PLAYER_MOVES.some((m) => m.power > 0)).toBe(true);
  });
});

describe("STRUGGLE_MOVE", () => {
  it("has high PP so it never runs out", () => {
    expect(STRUGGLE_MOVE.pp).toBeGreaterThanOrEqual(100);
  });

  it("is normal type", () => {
    expect(STRUGGLE_MOVE.type).toBe("normal");
  });

  it("has 100% accuracy", () => {
    expect(STRUGGLE_MOVE.accuracy).toBe(100);
  });

  it("deals damage (power > 0)", () => {
    expect(STRUGGLE_MOVE.power).toBeGreaterThan(0);
  });
});
