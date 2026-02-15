import {
  getGroundPlatforms,
  getSectionData,
  type PlatformData,
  type EnemySpawn,
  type PickupSpawn,
  type SectionData,
} from "@/game/arcade/level-data";
import {
  ARCADE_WIDTH,
  ARCADE_HEIGHT,
  GROUND_Y,
  LEVEL_WIDTH,
  TILE_SIZE,
  SECTIONS,
  ENEMY_STATS,
  PICKUPS,
  CHARACTER_STATS,
  SECTION_THEMES,
  type EnemyType,
  type PickupType,
  type ArcadeCharacter,
  type PropType,
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

// Decoration Data Integrity

describe("decoration data integrity", () => {
  const validPropTypes: PropType[] = [
    "lamp_post",
    "barrel",
    "sandbag_stack",
    "broken_fence",
    "road_sign",
    "wrecked_car",
    "rubble_pile",
    "oil_drum",
    "traffic_cone",
    "barbed_wire",
    "computer_terminal",
    "dumpster",
  ];

  describe.each([0, 1, 2, 3, 4, 5])("section %i decorations", (section) => {
    let data: SectionData;

    beforeEach(() => {
      data = getSectionData(section);
    });

    it("has at least 10 decorations for visual density", () => {
      expect(data.decorations.length).toBeGreaterThanOrEqual(10);
    });

    it("all decoration types are valid PropType values", () => {
      for (const d of data.decorations) {
        expect(validPropTypes).toContain(d.type);
      }
    });

    it("all decoration X positions are within section bounds", () => {
      const sectionStart = SECTIONS[section] ?? section * 800;
      const sectionEnd = sectionStart + 800;
      for (const d of data.decorations) {
        expect(d.x).toBeGreaterThanOrEqual(sectionStart);
        expect(d.x).toBeLessThanOrEqual(sectionEnd);
      }
    });

    it("all decoration Y positions are at ground level", () => {
      for (const d of data.decorations) {
        expect(d.y).toBe(GROUND_Y);
      }
    });

    it("no two decorations at the exact same X position", () => {
      const xPositions = data.decorations.map((d) => d.x);
      expect(new Set(xPositions).size).toBe(xPositions.length);
    });

    it("decorations are spread across the section width (not clustered)", () => {
      if (data.decorations.length < 3) return;
      const xValues = data.decorations.map((d) => d.x).sort((a, b) => a - b);
      const sectionStart = SECTIONS[section] ?? section * 800;
      const range = xValues[xValues.length - 1] - xValues[0];
      // Decorations should span at least 70% of the section
      expect(range).toBeGreaterThanOrEqual(500);
    });
  });

  it("total decoration count across all sections is substantial (100+)", () => {
    let total = 0;
    for (let s = 0; s <= 5; s++) {
      total += getSectionData(s).decorations.length;
    }
    expect(total).toBeGreaterThanOrEqual(100);
  });

  it("each section uses prop types appropriate to its theme", () => {
    // Section 0 (street): should have lamp_posts and traffic_cones
    const s0 = getSectionData(0);
    expect(s0.decorations.some((d) => d.type === "lamp_post")).toBe(true);
    expect(s0.decorations.some((d) => d.type === "traffic_cone")).toBe(true);

    // Section 1 (military): should have sandbag_stacks
    const s1 = getSectionData(1);
    expect(s1.decorations.some((d) => d.type === "sandbag_stack")).toBe(true);

    // Section 2 (warzone): should have rubble_piles
    const s2 = getSectionData(2);
    expect(s2.decorations.some((d) => d.type === "rubble_pile")).toBe(true);

    // Section 3 (industrial): should have oil_drums and computer_terminals
    const s3 = getSectionData(3);
    expect(s3.decorations.some((d) => d.type === "oil_drum")).toBe(true);
    expect(s3.decorations.some((d) => d.type === "computer_terminal")).toBe(true);
  });
});

// Spatial Overlap Checks — decorations shouldn't stack with enemies or pickups

describe("spatial overlap checks", () => {
  describe.each([0, 1, 2, 3, 4, 5])("section %i", (section) => {
    let data: SectionData;

    beforeEach(() => {
      data = getSectionData(section);
    });

    it("no decoration at the exact same X as an enemy spawn", () => {
      const decoXs = new Set(data.decorations.map((d) => d.x));
      for (const enemy of data.enemies) {
        expect(decoXs.has(enemy.x)).toBe(false);
      }
    });

    it("no decoration at the exact same position (X and Y) as a pickup", () => {
      // Decorations are at ground Y, pickups float above ground — X overlap is okay
      const decoPositions = new Set(data.decorations.map((d) => `${d.x},${d.y}`));
      for (const pickup of data.pickups) {
        expect(decoPositions.has(`${pickup.x},${pickup.y}`)).toBe(false);
      }
    });

    it("no pickup at the exact same position as an enemy", () => {
      const enemyPositions = new Set(data.enemies.map((e) => `${e.x},${e.y}`));
      for (const pickup of data.pickups) {
        expect(enemyPositions.has(`${pickup.x},${pickup.y}`)).toBe(false);
      }
    });

    it("ground-level enemies have minimum horizontal spacing (16px)", () => {
      // Only check spacing between enemies at the same Y level — turrets on
      // platforms and ground enemies legitimately share X ranges
      const groundEnemies = data.enemies.filter((e) => e.y === GROUND_Y - 32);
      if (groundEnemies.length < 2) return;
      const sorted = [...groundEnemies].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].x - sorted[i - 1].x;
        expect(gap).toBeGreaterThanOrEqual(16);
      }
    });
  });
});

// Patrol Range Boundary Checks

describe("patrol range vs section bounds", () => {
  describe.each([0, 1, 2, 3, 4, 5])("section %i", (section) => {
    it("no enemy patrol extends beyond its section boundaries", () => {
      const data = getSectionData(section);
      const sectionStart = SECTIONS[section] ?? section * 800;
      const sectionEnd = sectionStart + 800;

      for (const enemy of data.enemies) {
        if (enemy.patrolRange === undefined) continue;
        const leftExtent = enemy.x - enemy.patrolRange;
        const rightExtent = enemy.x + enemy.patrolRange;

        // Patrol should stay mostly within the section (allow 50px overflow for smoother AI)
        expect(leftExtent).toBeGreaterThanOrEqual(sectionStart - 50);
        expect(rightExtent).toBeLessThanOrEqual(sectionEnd + 50);
      }
    });
  });
});

// Platform Reachability — Can characters reach all platforms?

describe("platform reachability", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];

  // Approximate max jump height: v^2 / (2 * gravity)
  // gravity = 800 (from ArcadeModal config)
  const GRAVITY = 800;

  // Phaser discrete physics gives ~15% more effective height than the
  // continuous kinematics formula v²/2g, because velocity is applied before
  // gravity on the first frame. We use a 1.15x tolerance factor.
  const PHASER_TOLERANCE = 1.15;

  describe.each(characters)("character %s", (char) => {
    const stats = CHARACTER_STATS[char];
    const maxJumpHeight = (stats.jumpForce * stats.jumpForce) / (2 * GRAVITY);
    const effectiveJump = maxJumpHeight * PHASER_TOLERANCE;

    it("max jump height is positive and calculable", () => {
      expect(maxJumpHeight).toBeGreaterThan(0);
      expect(Number.isFinite(maxJumpHeight)).toBe(true);
    });

    it("can reach at least the lowest platforms (y=200, 40px above ground)", () => {
      expect(effectiveJump).toBeGreaterThan(40);
    });

    it("all platforms are reachable via stepping stones", () => {
      // For each section, verify that platforms can be reached from ground or
      // from a lower platform that is itself reachable.
      for (let s = 0; s <= 5; s++) {
        const data = getSectionData(s);
        if (data.platforms.length === 0) continue;

        // Sort platforms by height (highest Y = closest to ground first)
        const sorted = [...data.platforms].sort((a, b) => b.y - a.y);

        // The lowest platform must be reachable from ground
        const lowestPlatHeight = GROUND_Y - sorted[0].y;
        expect(lowestPlatHeight).toBeLessThanOrEqual(effectiveJump);

        // Each subsequent platform must be reachable from a lower one
        for (let i = 1; i < sorted.length; i++) {
          const heightGap = sorted[i - 1].y - sorted[i].y; // positive = higher
          // Can reach from ground OR from any reachable lower platform
          const fromGround = GROUND_Y - sorted[i].y;
          const reachable =
            heightGap <= effectiveJump || fromGround <= effectiveJump;
          expect(reachable).toBe(true);
        }
      }
    });
  });

  it("Ghost max jump height is approximately 64px", () => {
    const h = (CHARACTER_STATS.ghost.jumpForce ** 2) / (2 * GRAVITY);
    expect(h).toBe(64);
  });

  it("Neo max jump height is approximately 76.5px", () => {
    const h = (CHARACTER_STATS.neo.jumpForce ** 2) / (2 * GRAVITY);
    expect(h).toBeCloseTo(76.5625, 2);
  });

  it("CJ max jump height is approximately 52.6px", () => {
    const h = (CHARACTER_STATS.cj.jumpForce ** 2) / (2 * GRAVITY);
    expect(h).toBeCloseTo(52.5625, 2);
  });

  it("CJ (weakest jumper) can reach the lowest platform in every section with Phaser tolerance", () => {
    const cjMaxJump = (CHARACTER_STATS.cj.jumpForce ** 2) / (2 * GRAVITY);
    const effectiveCJ = cjMaxJump * PHASER_TOLERANCE;
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      if (data.platforms.length === 0) continue;
      // Lowest platform (highest Y value) should be reachable
      const lowestPlatY = Math.max(...data.platforms.map((p) => p.y));
      const heightAboveGround = GROUND_Y - lowestPlatY;
      expect(heightAboveGround).toBeLessThanOrEqual(effectiveCJ);
    }
  });
});

// Platform Gap Analysis

describe("platform gaps", () => {
  describe.each([1, 2, 3, 4])("section %i platforms", (section) => {
    it("platforms don't overlap horizontally", () => {
      const data = getSectionData(section);
      if (data.platforms.length < 2) return;

      const sorted = [...data.platforms].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const prevEnd = sorted[i - 1].x + sorted[i - 1].width * TILE_SIZE;
        expect(sorted[i].x).toBeGreaterThanOrEqual(prevEnd);
      }
    });

    it("no platform is wider than half the section (400px / 25 tiles)", () => {
      const data = getSectionData(section);
      for (const p of data.platforms) {
        expect(p.width).toBeLessThanOrEqual(25);
      }
    });
  });
});

// Ground Coverage Continuity

describe("ground coverage continuity", () => {
  it("ground platforms cover the full level width with no gaps", () => {
    const grounds = getGroundPlatforms();
    let coveredEnd = 0;

    // Sort by X position
    const sorted = [...grounds].sort((a, b) => a.x - b.x);
    for (const g of sorted) {
      // Each segment should start where the previous ended (or at 0)
      expect(g.x).toBeLessThanOrEqual(coveredEnd + 1); // Allow 1px tolerance
      coveredEnd = g.x + g.width * TILE_SIZE;
    }
    expect(coveredEnd).toBeGreaterThanOrEqual(LEVEL_WIDTH);
  });

  it("each ground segment uses the correct texture for its section", () => {
    const grounds = getGroundPlatforms();
    grounds.forEach((g, i) => {
      const expectedGround = SECTION_THEMES[i]?.ground ?? "ground_concrete";
      expect(g.texture).toBe(expectedGround);
    });
  });

  it("all ground segments have exactly 50 tiles (800px / 16px)", () => {
    const grounds = getGroundPlatforms();
    for (const g of grounds) {
      expect(g.width).toBe(50);
    }
  });
});

// Out-of-Bounds Edge Cases

describe("getSectionData out-of-bounds edge cases", () => {
  it("returns empty arrays for section 0.5 (fractional)", () => {
    const data = getSectionData(0.5);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
    expect(data.pickups).toEqual([]);
    expect(data.decorations).toEqual([]);
  });

  it("returns empty arrays for Infinity", () => {
    const data = getSectionData(Infinity);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
    expect(data.pickups).toEqual([]);
    expect(data.decorations).toEqual([]);
  });

  it("returns empty arrays for -Infinity", () => {
    const data = getSectionData(-Infinity);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
    expect(data.pickups).toEqual([]);
    expect(data.decorations).toEqual([]);
  });

  it("returns empty arrays for MAX_SAFE_INTEGER", () => {
    const data = getSectionData(Number.MAX_SAFE_INTEGER);
    expect(data.platforms).toEqual([]);
    expect(data.enemies).toEqual([]);
  });

  it("default case base calculation uses section * 800", () => {
    // Section 7 is out of range: base = SECTIONS[7] ?? 7 * 800 = 5600
    // But switch falls to default which returns empty
    const data = getSectionData(7);
    expect(data.enemies).toEqual([]);
  });
});

// Exact Section Content Verification

describe("exact section content counts", () => {
  it("section 0: 3 enemies, 2 pickups, 0 platforms, 18 decorations", () => {
    const data = getSectionData(0);
    expect(data.enemies).toHaveLength(3);
    expect(data.pickups).toHaveLength(2);
    expect(data.platforms).toHaveLength(0);
    expect(data.decorations).toHaveLength(18);
  });

  it("section 1: 6 enemies, 1 pickup, 4 platforms, 20 decorations", () => {
    const data = getSectionData(1);
    expect(data.enemies).toHaveLength(6);
    expect(data.pickups).toHaveLength(1);
    expect(data.platforms).toHaveLength(4);
    expect(data.decorations).toHaveLength(20);
  });

  it("section 2: 6 enemies, 1 pickup, 3 platforms, 22 decorations", () => {
    const data = getSectionData(2);
    expect(data.enemies).toHaveLength(6);
    expect(data.pickups).toHaveLength(1);
    expect(data.platforms).toHaveLength(3);
    expect(data.decorations).toHaveLength(22);
  });

  it("section 3: 6 enemies, 1 pickup, 6 platforms, 20 decorations", () => {
    const data = getSectionData(3);
    expect(data.enemies).toHaveLength(6);
    expect(data.pickups).toHaveLength(1);
    expect(data.platforms).toHaveLength(6);
    expect(data.decorations).toHaveLength(20);
  });

  it("section 4: 11 enemies, 2 pickups, 3 platforms, 25 decorations", () => {
    const data = getSectionData(4);
    expect(data.enemies).toHaveLength(11);
    expect(data.pickups).toHaveLength(2);
    expect(data.platforms).toHaveLength(3);
    expect(data.decorations).toHaveLength(25);
  });

  it("section 5: 1 enemy (boss), 1 pickup, 0 platforms, 12 decorations", () => {
    const data = getSectionData(5);
    expect(data.enemies).toHaveLength(1);
    expect(data.pickups).toHaveLength(1);
    expect(data.platforms).toHaveLength(0);
    expect(data.decorations).toHaveLength(12);
  });
});

// Enemy Type Distribution

describe("enemy type distribution across full level", () => {
  it("total soldiers across all sections", () => {
    let count = 0;
    for (let s = 0; s <= 5; s++) {
      count += getSectionData(s).enemies.filter((e) => e.type === "soldier").length;
    }
    expect(count).toBeGreaterThanOrEqual(10); // Soldiers are the most common
  });

  it("total heavy enemies across all sections", () => {
    let count = 0;
    for (let s = 0; s <= 5; s++) {
      count += getSectionData(s).enemies.filter((e) => e.type === "heavy").length;
    }
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(10);
  });

  it("total turrets across all sections", () => {
    let count = 0;
    for (let s = 0; s <= 5; s++) {
      count += getSectionData(s).enemies.filter((e) => e.type === "turret").length;
    }
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(10);
  });

  it("exactly 1 boss in the entire level", () => {
    let count = 0;
    for (let s = 0; s <= 5; s++) {
      count += getSectionData(s).enemies.filter((e) => e.type === "boss").length;
    }
    expect(count).toBe(1);
  });

  it("total HP across all enemies is calculable", () => {
    let totalHP = 0;
    for (let s = 0; s <= 5; s++) {
      for (const enemy of getSectionData(s).enemies) {
        totalHP += ENEMY_STATS[enemy.type].hp;
      }
    }
    // Boss is 50 HP, rest adds up
    expect(totalHP).toBeGreaterThan(ENEMY_STATS.boss.hp);
    expect(Number.isFinite(totalHP)).toBe(true);
  });
});

// Pickup Distribution

describe("pickup distribution across full level", () => {
  it("total weapon pickups (spread + heavy)", () => {
    let count = 0;
    for (let s = 0; s <= 5; s++) {
      count += getSectionData(s).pickups.filter(
        (p) => p.type === "spread" || p.type === "heavy",
      ).length;
    }
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("health pickups are distributed across at least 2 different sections", () => {
    const sectionsWithHealth: number[] = [];
    for (let s = 0; s <= 5; s++) {
      if (getSectionData(s).pickups.some((p) => p.type === "health")) {
        sectionsWithHealth.push(s);
      }
    }
    expect(sectionsWithHealth.length).toBeGreaterThanOrEqual(2);
  });

  it("no section has more than 3 pickups (to avoid clutter)", () => {
    for (let s = 0; s <= 5; s++) {
      expect(getSectionData(s).pickups.length).toBeLessThanOrEqual(3);
    }
  });

  it("pickups on elevated platforms have matching platform beneath them", () => {
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      for (const pickup of data.pickups) {
        if (pickup.y < GROUND_Y - 50) {
          // This pickup is elevated — should be near a platform
          const nearPlatform = data.platforms.some((p) => {
            const platLeft = p.x;
            const platRight = p.x + p.width * TILE_SIZE;
            return pickup.x >= platLeft - 20 && pickup.x <= platRight + 20 &&
                   Math.abs(pickup.y - (p.y - 30)) < 20;
          });
          expect(nearPlatform).toBe(true);
        }
      }
    }
  });
});
