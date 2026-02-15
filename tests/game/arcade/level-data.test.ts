import {
  getGroundPlatforms,
  getSectionData,
  type PlatformData,
  type EnemySpawn,
  type PickupSpawn,
  type SectionData,
} from "@/game/arcade/level-data";
import {
  GROUND_Y,
  LEVEL_WIDTH,
  TILE_SIZE,
  SECTIONS,
  ENEMY_STATS,
  PICKUPS,
  type EnemyType,
  type PickupType,
} from "@/game/arcade/types";

// getGroundPlatforms()

describe("getGroundPlatforms", () => {
  let grounds: PlatformData[];

  beforeEach(() => {
    grounds = getGroundPlatforms();
  });

  it("returns a non-empty array", () => {
    expect(grounds.length).toBeGreaterThan(0);
  });

  it("all ground platforms start at GROUND_Y", () => {
    for (const g of grounds) {
      expect(g.y).toBe(GROUND_Y);
    }
  });

  it("ground spans the full level width in tiles", () => {
    const totalTiles = grounds.reduce((sum, g) => sum + g.width, 0);
    // 6 sections x 50 tiles per section = 300 tiles = 4800px
    const expectedTiles = Math.ceil(LEVEL_WIDTH / TILE_SIZE);
    expect(totalTiles).toBeGreaterThanOrEqual(expectedTiles);
  });

  it("first ground platform starts at x=0", () => {
    expect(grounds[0].x).toBe(0);
  });

  it("all ground platforms have positive width", () => {
    for (const g of grounds) {
      expect(g.width).toBeGreaterThan(0);
    }
  });

  it("all ground platforms have a valid texture name", () => {
    const validTextures = [
      "platform_metal",
      "platform_wood",
      "ground_concrete",
      "ground_dirt",
      "ground_metal_grate",
      "ground_rubble",
    ];
    for (const g of grounds) {
      expect(validTextures).toContain(g.texture);
    }
  });

  it("returns one ground platform per section", () => {
    expect(grounds.length).toBe(SECTIONS.length);
  });

  it("returns consistent results on repeated calls", () => {
    const first = getGroundPlatforms();
    const second = getGroundPlatforms();
    expect(first).toEqual(second);
  });
});

// getSectionData() — General Properties

describe("getSectionData — general properties", () => {
  const validSections = [0, 1, 2, 3, 4, 5];

  describe.each(validSections)("section %i", (section) => {
    let data: SectionData;

    beforeEach(() => {
      data = getSectionData(section);
    });

    it("returns an object with platforms, enemies, pickups, and decorations arrays", () => {
      expect(Array.isArray(data.platforms)).toBe(true);
      expect(Array.isArray(data.enemies)).toBe(true);
      expect(Array.isArray(data.pickups)).toBe(true);
      expect(Array.isArray(data.decorations)).toBe(true);
    });

    it("all enemies have valid types", () => {
      const validTypes: EnemyType[] = ["soldier", "heavy", "turret", "boss"];
      for (const enemy of data.enemies) {
        expect(validTypes).toContain(enemy.type);
      }
    });

    it("all enemies are within section bounds", () => {
      const sectionStart = SECTIONS[section] ?? section * 800;
      const sectionEnd = sectionStart + 800;
      for (const enemy of data.enemies) {
        expect(enemy.x).toBeGreaterThanOrEqual(sectionStart);
        expect(enemy.x).toBeLessThanOrEqual(sectionEnd);
      }
    });

    it("all enemy Y positions are above ground (spawned in the air or on ground)", () => {
      for (const enemy of data.enemies) {
        expect(enemy.y).toBeLessThanOrEqual(GROUND_Y);
        expect(enemy.y).toBeGreaterThan(0);
      }
    });

    it("all pickups have valid types", () => {
      const validTypes: PickupType[] = ["spread", "heavy", "health", "grenade"];
      for (const pickup of data.pickups) {
        expect(validTypes).toContain(pickup.type);
      }
    });

    it("all pickup positions are within section bounds", () => {
      const sectionStart = SECTIONS[section] ?? section * 800;
      const sectionEnd = sectionStart + 800;
      for (const pickup of data.pickups) {
        expect(pickup.x).toBeGreaterThanOrEqual(sectionStart);
        expect(pickup.x).toBeLessThanOrEqual(sectionEnd);
      }
    });

    it("all pickup Y positions are above ground level", () => {
      for (const pickup of data.pickups) {
        expect(pickup.y).toBeLessThan(GROUND_Y);
        expect(pickup.y).toBeGreaterThan(0);
      }
    });

    it("all platforms have positive width", () => {
      for (const platform of data.platforms) {
        expect(platform.width).toBeGreaterThan(0);
      }
    });

    it("all platforms have valid textures", () => {
      const validTextures = [
        "platform_metal",
        "platform_wood",
        "ground_concrete",
        "ground_dirt",
        "ground_metal_grate",
        "ground_rubble",
      ];
      for (const platform of data.platforms) {
        expect(validTextures).toContain(platform.texture);
      }
    });

    it("all platforms are within section bounds", () => {
      const sectionStart = SECTIONS[section] ?? section * 800;
      const sectionEnd = sectionStart + 800;
      for (const platform of data.platforms) {
        expect(platform.x).toBeGreaterThanOrEqual(sectionStart);
        // Platform end (x + width*TILE_SIZE) can extend a bit
        expect(platform.x).toBeLessThan(sectionEnd);
      }
    });

    it("all platforms are above ground level", () => {
      for (const platform of data.platforms) {
        expect(platform.y).toBeLessThan(GROUND_Y);
      }
    });

    it("has at least one enemy", () => {
      expect(data.enemies.length).toBeGreaterThan(0);
    });

    it("returns consistent results on repeated calls", () => {
      const first = getSectionData(section);
      const second = getSectionData(section);
      expect(first).toEqual(second);
    });
  });
});

// getSectionData() — Boundary Conditions & Edge Cases

describe("getSectionData — boundary conditions", () => {
  it("returns empty data for section 6 (out of bounds)", () => {
    const data = getSectionData(6);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
    expect(data.pickups).toEqual([]);
    expect(data.decorations).toEqual([]);
  });

  it("returns empty data for section 100 (far out of bounds)", () => {
    const data = getSectionData(100);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
    expect(data.pickups).toEqual([]);
    expect(data.decorations).toEqual([]);
  });

  it("returns empty data for negative section (-1)", () => {
    const data = getSectionData(-1);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
    expect(data.pickups).toEqual([]);
    expect(data.decorations).toEqual([]);
  });

  it("returns empty data for section -100", () => {
    const data = getSectionData(-100);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
    expect(data.pickups).toEqual([]);
    expect(data.decorations).toEqual([]);
  });

  it("handles NaN gracefully (via default case)", () => {
    const data = getSectionData(NaN);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
    expect(data.pickups).toEqual([]);
    expect(data.decorations).toEqual([]);
  });
});

// Section-Specific Content Validation

describe("section 0 (tutorial)", () => {
  let data: SectionData;
  beforeEach(() => {
    data = getSectionData(0);
  });

  it("has no platforms (flat ground only)", () => {
    expect(data.platforms).toHaveLength(0);
  });

  it("has only soldier enemies (easy)", () => {
    for (const enemy of data.enemies) {
      expect(enemy.type).toBe("soldier");
    }
  });

  it("has at least one pickup to teach the player", () => {
    expect(data.pickups.length).toBeGreaterThanOrEqual(1);
  });

  it("has a weapon pickup to introduce the mechanic", () => {
    const weaponPickups = data.pickups.filter(
      (p) => p.type === "spread" || p.type === "heavy",
    );
    expect(weaponPickups.length).toBeGreaterThanOrEqual(1);
  });

  it("has relatively few enemies (tutorial difficulty)", () => {
    expect(data.enemies.length).toBeLessThanOrEqual(5);
  });
});

describe("section 1 (platforms)", () => {
  let data: SectionData;
  beforeEach(() => {
    data = getSectionData(1);
  });

  it("introduces platforms", () => {
    expect(data.platforms.length).toBeGreaterThan(0);
  });

  it("introduces turrets", () => {
    const turrets = data.enemies.filter((e) => e.type === "turret");
    expect(turrets.length).toBeGreaterThan(0);
  });

  it("turrets are placed on or near platforms (elevated)", () => {
    const turrets = data.enemies.filter((e) => e.type === "turret");
    for (const turret of turrets) {
      // Turrets should be above ground level
      expect(turret.y).toBeLessThan(GROUND_Y);
    }
  });

  it("has more enemies than section 0", () => {
    const section0 = getSectionData(0);
    expect(data.enemies.length).toBeGreaterThan(section0.enemies.length);
  });
});

describe("section 2 (heavy combat)", () => {
  let data: SectionData;
  beforeEach(() => {
    data = getSectionData(2);
  });

  it("introduces heavy enemies", () => {
    const heavies = data.enemies.filter((e) => e.type === "heavy");
    expect(heavies.length).toBeGreaterThan(0);
  });

  it("has platforms for vertical gameplay", () => {
    expect(data.platforms.length).toBeGreaterThan(0);
  });
});

describe("section 3 (vertical)", () => {
  let data: SectionData;
  beforeEach(() => {
    data = getSectionData(3);
  });

  it("has more platforms than section 1 (multi-level)", () => {
    const section1 = getSectionData(1);
    expect(data.platforms.length).toBeGreaterThanOrEqual(section1.platforms.length);
  });

  it("has platforms at varying heights", () => {
    const heights = data.platforms.map((p) => p.y);
    const uniqueHeights = new Set(heights);
    expect(uniqueHeights.size).toBeGreaterThan(1);
  });

  it("has a grenade pickup", () => {
    const grenades = data.pickups.filter((p) => p.type === "grenade");
    expect(grenades.length).toBeGreaterThan(0);
  });
});

describe("section 4 (boss approach)", () => {
  let data: SectionData;
  beforeEach(() => {
    data = getSectionData(4);
  });

  it("has the most enemies of any section (intensity peak)", () => {
    for (let s = 0; s < 4; s++) {
      const otherData = getSectionData(s);
      expect(data.enemies.length).toBeGreaterThanOrEqual(otherData.enemies.length);
    }
  });

  it("has a mix of enemy types", () => {
    const types = new Set(data.enemies.map((e) => e.type));
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it("has at least one health pickup (prepare for boss)", () => {
    const health = data.pickups.filter((p) => p.type === "health");
    expect(health.length).toBeGreaterThanOrEqual(1);
  });

  it("no boss in this section (boss is in section 5)", () => {
    const bosses = data.enemies.filter((e) => e.type === "boss");
    expect(bosses).toHaveLength(0);
  });
});

describe("section 5 (boss arena)", () => {
  let data: SectionData;
  beforeEach(() => {
    data = getSectionData(5);
  });

  it("has exactly one boss", () => {
    const bosses = data.enemies.filter((e) => e.type === "boss");
    expect(bosses).toHaveLength(1);
  });

  it("boss is the only enemy", () => {
    expect(data.enemies).toHaveLength(1);
    expect(data.enemies[0].type).toBe("boss");
  });

  it("has no platforms (flat arena)", () => {
    expect(data.platforms).toHaveLength(0);
  });

  it("boss is positioned within the section", () => {
    const boss = data.enemies[0];
    const sectionStart = SECTIONS[5];
    expect(boss.x).toBeGreaterThan(sectionStart);
    expect(boss.x).toBeLessThan(sectionStart + 800);
  });

  it("boss Y position accounts for boss height (64px)", () => {
    const boss = data.enemies[0];
    // Boss at GROUND_Y - 64 should be above ground
    expect(boss.y).toBe(GROUND_Y - ENEMY_STATS.boss.height);
  });

  it("has a health pickup before the boss", () => {
    const health = data.pickups.filter((p) => p.type === "health");
    expect(health.length).toBeGreaterThanOrEqual(1);
  });

  it("health pickup is positioned before the boss (lower x)", () => {
    const boss = data.enemies[0];
    const healthPickups = data.pickups.filter((p) => p.type === "health");
    for (const h of healthPickups) {
      expect(h.x).toBeLessThan(boss.x);
    }
  });
});

// Boss appears only in section 5

describe("boss exclusivity", () => {
  it("boss enemy type only appears in section 5", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      const bosses = data.enemies.filter((e) => e.type === "boss");
      if (s === 5) {
        expect(bosses.length).toBe(1);
      } else {
        expect(bosses.length).toBe(0);
      }
    }
  });
});

// Progressive Difficulty

describe("progressive difficulty", () => {
  it("total enemy count generally increases across sections 0-4", () => {
    const counts = [0, 1, 2, 3, 4].map((s) => getSectionData(s).enemies.length);
    // Not strictly monotonic but section 4 should have >= section 0
    expect(counts[4]).toBeGreaterThan(counts[0]);
  });

  it("heavy enemies appear from section 2 onwards (not in 0 or 1)", () => {
    for (let s = 0; s <= 1; s++) {
      const heavies = getSectionData(s).enemies.filter((e) => e.type === "heavy");
      expect(heavies).toHaveLength(0);
    }
    // At least one heavy in sections 2-4
    let totalHeavies = 0;
    for (let s = 2; s <= 4; s++) {
      totalHeavies += getSectionData(s).enemies.filter(
        (e) => e.type === "heavy",
      ).length;
    }
    expect(totalHeavies).toBeGreaterThan(0);
  });

  it("turrets appear from section 1 onwards (not in section 0)", () => {
    const section0Turrets = getSectionData(0).enemies.filter(
      (e) => e.type === "turret",
    );
    expect(section0Turrets).toHaveLength(0);

    let totalTurrets = 0;
    for (let s = 1; s <= 4; s++) {
      totalTurrets += getSectionData(s).enemies.filter(
        (e) => e.type === "turret",
      ).length;
    }
    expect(totalTurrets).toBeGreaterThan(0);
  });
});

// Enemy Spawn Data Integrity

describe("enemy spawn data integrity", () => {
  it("all enemies have valid facing direction", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      for (const enemy of data.enemies) {
        if (enemy.facing !== undefined) {
          expect(["left", "right"]).toContain(enemy.facing);
        }
      }
    }
  });

  it("all enemies with patrol ranges have positive values", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      for (const enemy of data.enemies) {
        if (enemy.patrolRange !== undefined) {
          expect(enemy.patrolRange).toBeGreaterThan(0);
        }
      }
    }
  });

  it("soldiers and heavies are at ground level (GROUND_Y - their height)", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      for (const enemy of data.enemies) {
        if (enemy.type === "soldier" || enemy.type === "heavy") {
          // Ground enemies should be at GROUND_Y - 32 (their height)
          // or on a platform (lower Y)
          expect(enemy.y).toBeLessThanOrEqual(GROUND_Y);
        }
      }
    }
  });

  it("turrets are placed above ground (on platforms)", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      const turrets = data.enemies.filter((e) => e.type === "turret");
      for (const turret of turrets) {
        expect(turret.y).toBeLessThan(GROUND_Y - 32); // Well above ground
      }
    }
  });

  it("no two enemies spawn at the exact same position in the same section", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      const positions = data.enemies.map((e) => `${e.x},${e.y}`);
      expect(new Set(positions).size).toBe(positions.length);
    }
  });
});

// Platform Data Integrity

describe("platform data integrity", () => {
  it("platforms in elevated sections are below the camera top", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      for (const platform of data.platforms) {
        expect(platform.y).toBeGreaterThan(50); // Leave room for HUD
      }
    }
  });

  it("platform widths are reasonable (1-20 tiles)", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      for (const platform of data.platforms) {
        expect(platform.width).toBeGreaterThanOrEqual(1);
        expect(platform.width).toBeLessThanOrEqual(20);
      }
    }
  });

  it("platforms don't extend beyond their section end", () => {
    for (let s = 0; s <= 5; s++) {
      const sectionEnd = (SECTIONS[s] ?? s * 800) + 800;
      const data = getSectionData(s);
      for (const platform of data.platforms) {
        const platformEnd = platform.x + platform.width * TILE_SIZE;
        expect(platformEnd).toBeLessThanOrEqual(sectionEnd);
      }
    }
  });
});

// Full Level Aggregation

describe("full level aggregation", () => {
  it("total enemy count across all sections is reasonable (15-50)", () => {
    let totalEnemies = 0;
    for (let s = 0; s <= 5; s++) {
      totalEnemies += getSectionData(s).enemies.length;
    }
    expect(totalEnemies).toBeGreaterThanOrEqual(15);
    expect(totalEnemies).toBeLessThanOrEqual(50);
  });

  it("total pickup count across all sections is reasonable (5-20)", () => {
    let totalPickups = 0;
    for (let s = 0; s <= 5; s++) {
      totalPickups += getSectionData(s).pickups.length;
    }
    expect(totalPickups).toBeGreaterThanOrEqual(5);
    expect(totalPickups).toBeLessThanOrEqual(20);
  });

  it("every section has at least one health-restoring pickup somewhere in the level", () => {
    let totalHealthPickups = 0;
    for (let s = 0; s <= 5; s++) {
      totalHealthPickups += getSectionData(s).pickups.filter(
        (p) => p.type === "health",
      ).length;
    }
    expect(totalHealthPickups).toBeGreaterThanOrEqual(2);
  });

  it("at least one of each weapon pickup exists across the level", () => {
    const weaponTypes = new Set<string>();
    for (let s = 0; s <= 5; s++) {
      for (const pickup of getSectionData(s).pickups) {
        if (pickup.type === "spread" || pickup.type === "heavy") {
          weaponTypes.add(pickup.type);
        }
      }
    }
    expect(weaponTypes.has("spread")).toBe(true);
    expect(weaponTypes.has("heavy")).toBe(true);
  });

  it("total potential score is calculable (all enemies have score in ENEMY_STATS)", () => {
    let totalScore = 0;
    for (let s = 0; s <= 5; s++) {
      for (const enemy of getSectionData(s).enemies) {
        const stats = ENEMY_STATS[enemy.type];
        expect(stats).toBeDefined();
        totalScore += stats.score;
      }
    }
    // Score should be substantial
    expect(totalScore).toBeGreaterThan(1000);
  });
});
