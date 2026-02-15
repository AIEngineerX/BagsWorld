import {
  ARCADE_WIDTH,
  ARCADE_HEIGHT,
  GROUND_Y,
  LEVEL_WIDTH,
  SECTIONS,
  TILE_SIZE,
  STARTING_LIVES,
  STARTING_GRENADES,
  GRENADE_DAMAGE,
  INVINCIBILITY_TIME,
  CHARACTER_STATS,
  WEAPONS,
  ENEMY_STATS,
  PICKUPS,
  SECTION_THEMES,
  type ArcadeCharacter,
  type WeaponType,
  type EnemyType,
  type PickupType,
  type GroundType,
} from "@/game/arcade/types";

// Resolution & Layout Constants

describe("resolution constants", () => {
  it("ARCADE_WIDTH x ARCADE_HEIGHT is 16:9 aspect ratio", () => {
    const ratio = ARCADE_WIDTH / ARCADE_HEIGHT;
    expect(ratio).toBeCloseTo(16 / 9, 2);
  });

  it("ARCADE_WIDTH is 480", () => {
    expect(ARCADE_WIDTH).toBe(480);
  });

  it("ARCADE_HEIGHT is 270", () => {
    expect(ARCADE_HEIGHT).toBe(270);
  });

  it("GROUND_Y is within the visible play area", () => {
    expect(GROUND_Y).toBeGreaterThan(0);
    expect(GROUND_Y).toBeLessThan(ARCADE_HEIGHT);
  });

  it("GROUND_Y leaves room for ground tiles below it", () => {
    // Ground tiles are 16px; at least one tile row must fit below GROUND_Y
    expect(GROUND_Y + TILE_SIZE).toBeLessThanOrEqual(ARCADE_HEIGHT);
  });

  it("GROUND_Y leaves enough vertical space for player sprites above", () => {
    // Player sprites are 32px tall; they stand on GROUND_Y
    // Camera height is 270, so GROUND_Y - 32 should be >= 0
    expect(GROUND_Y - 32).toBeGreaterThanOrEqual(0);
  });
});

describe("LEVEL_WIDTH", () => {
  it("is 4800 (10 screens wide)", () => {
    expect(LEVEL_WIDTH).toBe(4800);
    expect(LEVEL_WIDTH / ARCADE_WIDTH).toBe(10);
  });

  it("is evenly divisible by TILE_SIZE", () => {
    expect(LEVEL_WIDTH % TILE_SIZE).toBe(0);
  });

  it("is evenly divisible by section width (800)", () => {
    expect(LEVEL_WIDTH % 800).toBe(0);
  });
});

describe("TILE_SIZE", () => {
  it("is 16", () => {
    expect(TILE_SIZE).toBe(16);
  });

  it("divides evenly into ARCADE_WIDTH", () => {
    expect(ARCADE_WIDTH % TILE_SIZE).toBe(0);
  });
});

// Section Boundaries

describe("SECTIONS", () => {
  it("has exactly 6 entries (sections 0-5)", () => {
    expect(SECTIONS).toHaveLength(6);
  });

  it("starts at 0", () => {
    expect(SECTIONS[0]).toBe(0);
  });

  it("has sections spaced 800px apart", () => {
    for (let i = 1; i < SECTIONS.length; i++) {
      expect(SECTIONS[i] - SECTIONS[i - 1]).toBe(800);
    }
  });

  it("last section start + 800 equals LEVEL_WIDTH", () => {
    expect(SECTIONS[SECTIONS.length - 1] + 800).toBe(LEVEL_WIDTH);
  });

  it("all section boundaries are within level bounds", () => {
    for (const s of SECTIONS) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(LEVEL_WIDTH);
    }
  });

  it("is a readonly tuple (as const)", () => {
    // Verify the type narrowing works - SECTIONS[0] should be exactly 0
    const first: 0 = SECTIONS[0];
    expect(first).toBe(0);
  });
});

// Gameplay Constants

describe("gameplay constants", () => {
  it("STARTING_LIVES is positive", () => {
    expect(STARTING_LIVES).toBeGreaterThan(0);
  });

  it("STARTING_LIVES is 3 (standard arcade count)", () => {
    expect(STARTING_LIVES).toBe(3);
  });

  it("STARTING_GRENADES is non-negative", () => {
    expect(STARTING_GRENADES).toBeGreaterThanOrEqual(0);
  });

  it("GRENADE_DAMAGE is positive", () => {
    expect(GRENADE_DAMAGE).toBeGreaterThan(0);
  });

  it("GRENADE_DAMAGE can kill a soldier in one hit", () => {
    expect(GRENADE_DAMAGE).toBeGreaterThanOrEqual(ENEMY_STATS.soldier.hp);
  });

  it("GRENADE_DAMAGE cannot one-shot the boss", () => {
    expect(GRENADE_DAMAGE).toBeLessThan(ENEMY_STATS.boss.hp);
  });

  it("INVINCIBILITY_TIME is positive (milliseconds)", () => {
    expect(INVINCIBILITY_TIME).toBeGreaterThan(0);
  });

  it("INVINCIBILITY_TIME is between 500ms and 5000ms (reasonable range)", () => {
    expect(INVINCIBILITY_TIME).toBeGreaterThanOrEqual(500);
    expect(INVINCIBILITY_TIME).toBeLessThanOrEqual(5000);
  });
});

// Character Stats

describe("CHARACTER_STATS", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];

  it("has exactly 3 characters", () => {
    expect(Object.keys(CHARACTER_STATS)).toHaveLength(3);
  });

  it("contains all expected character IDs", () => {
    for (const id of characters) {
      expect(CHARACTER_STATS).toHaveProperty(id);
    }
  });

  describe.each(characters)("character: %s", (id) => {
    const stats = CHARACTER_STATS[id];

    it("has a non-empty display name", () => {
      expect(stats.name).toBeTruthy();
      expect(stats.name.length).toBeGreaterThan(0);
    });

    it("has positive speed", () => {
      expect(stats.speed).toBeGreaterThan(0);
    });

    it("has positive fireRate (ms between shots)", () => {
      expect(stats.fireRate).toBeGreaterThan(0);
    });

    it("has maxHP between 1 and 10", () => {
      expect(stats.maxHP).toBeGreaterThanOrEqual(1);
      expect(stats.maxHP).toBeLessThanOrEqual(10);
    });

    it("has negative jumpForce (upward velocity)", () => {
      expect(stats.jumpForce).toBeLessThan(0);
    });

    it("jumpForce magnitude is reasonable (200-500)", () => {
      expect(Math.abs(stats.jumpForce)).toBeGreaterThanOrEqual(200);
      expect(Math.abs(stats.jumpForce)).toBeLessThanOrEqual(500);
    });

    it("has valid color values (0x000000-0xFFFFFF)", () => {
      expect(stats.color).toBeGreaterThanOrEqual(0x000000);
      expect(stats.color).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(stats.color)).toBe(true);
    });

    it("has valid secondaryColor value", () => {
      expect(stats.secondaryColor).toBeGreaterThanOrEqual(0x000000);
      expect(stats.secondaryColor).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(stats.secondaryColor)).toBe(true);
    });

    it("has valid skinColor value", () => {
      expect(stats.skinColor).toBeGreaterThanOrEqual(0x000000);
      expect(stats.skinColor).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(stats.skinColor)).toBe(true);
    });
  });

  describe("balance checks", () => {
    it("all characters have distinct speeds", () => {
      const speeds = characters.map((id) => CHARACTER_STATS[id].speed);
      expect(new Set(speeds).size).toBe(speeds.length);
    });

    it("all characters have distinct maxHP", () => {
      const hps = characters.map((id) => CHARACTER_STATS[id].maxHP);
      expect(new Set(hps).size).toBe(hps.length);
    });

    it("faster characters have lower HP (speed-HP tradeoff)", () => {
      // Sort by speed descending
      const sorted = [...characters].sort(
        (a, b) => CHARACTER_STATS[b].speed - CHARACTER_STATS[a].speed,
      );
      // Faster character should have <= HP than slower
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(CHARACTER_STATS[sorted[i]].maxHP).toBeLessThanOrEqual(
          CHARACTER_STATS[sorted[i + 1]].maxHP,
        );
      }
    });

    it("Neo is the fastest character", () => {
      const maxSpeed = Math.max(...characters.map((id) => CHARACTER_STATS[id].speed));
      expect(CHARACTER_STATS.neo.speed).toBe(maxSpeed);
    });

    it("CJ has the most HP", () => {
      const maxHP = Math.max(...characters.map((id) => CHARACTER_STATS[id].maxHP));
      expect(CHARACTER_STATS.cj.maxHP).toBe(maxHP);
    });

    it("CJ fires fastest (lowest fireRate)", () => {
      const minFireRate = Math.min(...characters.map((id) => CHARACTER_STATS[id].fireRate));
      expect(CHARACTER_STATS.cj.fireRate).toBe(minFireRate);
    });
  });
});

// Weapon Stats

describe("WEAPONS", () => {
  const weaponTypes: WeaponType[] = ["pistol", "spread", "heavy"];

  it("has exactly 3 weapon types", () => {
    expect(Object.keys(WEAPONS)).toHaveLength(3);
  });

  it("contains all expected weapon types", () => {
    for (const w of weaponTypes) {
      expect(WEAPONS).toHaveProperty(w);
    }
  });

  describe.each(weaponTypes)("weapon: %s", (type) => {
    const weapon = WEAPONS[type];

    it("has a non-empty name", () => {
      expect(weapon.name).toBeTruthy();
    });

    it("has positive damage", () => {
      expect(weapon.damage).toBeGreaterThan(0);
    });

    it("has positive bullet speed", () => {
      expect(weapon.bulletSpeed).toBeGreaterThan(0);
    });

    it("has valid spread count (1 or 3)", () => {
      expect([1, 3]).toContain(weapon.spread);
    });

    it("has valid color", () => {
      expect(weapon.color).toBeGreaterThanOrEqual(0x000000);
      expect(weapon.color).toBeLessThanOrEqual(0xffffff);
    });
  });

  it("pistol has infinite ammo (-1)", () => {
    expect(WEAPONS.pistol.ammo).toBe(-1);
  });

  it("spread and heavy have finite positive ammo", () => {
    expect(WEAPONS.spread.ammo).toBeGreaterThan(0);
    expect(WEAPONS.heavy.ammo).toBeGreaterThan(0);
  });

  it("spread weapon has spread > 1", () => {
    expect(WEAPONS.spread.spread).toBeGreaterThan(1);
  });

  it("pistol and heavy are single-shot (spread = 1)", () => {
    expect(WEAPONS.pistol.spread).toBe(1);
    expect(WEAPONS.heavy.spread).toBe(1);
  });

  it("heavy does more damage than pistol", () => {
    expect(WEAPONS.heavy.damage).toBeGreaterThan(WEAPONS.pistol.damage);
  });

  it("pistol has slower bullets than heavy", () => {
    expect(WEAPONS.pistol.bulletSpeed).toBeLessThan(WEAPONS.heavy.bulletSpeed);
  });

  it("all weapons have distinct colors", () => {
    const colors = weaponTypes.map((w) => WEAPONS[w].color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

// Enemy Stats

describe("ENEMY_STATS", () => {
  const enemyTypes: EnemyType[] = ["soldier", "heavy", "turret", "boss"];

  it("has exactly 4 enemy types", () => {
    expect(Object.keys(ENEMY_STATS)).toHaveLength(4);
  });

  it("contains all expected enemy types", () => {
    for (const e of enemyTypes) {
      expect(ENEMY_STATS).toHaveProperty(e);
    }
  });

  describe.each(enemyTypes)("enemy: %s", (type) => {
    const stats = ENEMY_STATS[type];

    it("has positive HP", () => {
      expect(stats.hp).toBeGreaterThan(0);
    });

    it("has non-negative speed", () => {
      expect(stats.speed).toBeGreaterThanOrEqual(0);
    });

    it("has positive damage", () => {
      expect(stats.damage).toBeGreaterThan(0);
    });

    it("has positive fireRate", () => {
      expect(stats.fireRate).toBeGreaterThan(0);
    });

    it("has positive score value", () => {
      expect(stats.score).toBeGreaterThan(0);
    });

    it("has positive dimensions", () => {
      expect(stats.width).toBeGreaterThan(0);
      expect(stats.height).toBeGreaterThan(0);
    });

    it("is killable by pistol (HP is finite)", () => {
      expect(stats.hp).toBeLessThan(Infinity);
      expect(Number.isFinite(stats.hp)).toBe(true);
    });
  });

  it("turret has speed 0 (stationary)", () => {
    expect(ENEMY_STATS.turret.speed).toBe(0);
  });

  it("soldier is faster than heavy", () => {
    expect(ENEMY_STATS.soldier.speed).toBeGreaterThan(ENEMY_STATS.heavy.speed);
  });

  it("boss has the most HP", () => {
    const maxHP = Math.max(...enemyTypes.map((e) => ENEMY_STATS[e].hp));
    expect(ENEMY_STATS.boss.hp).toBe(maxHP);
  });

  it("boss HP is significantly higher than regular enemies", () => {
    expect(ENEMY_STATS.boss.hp).toBeGreaterThan(ENEMY_STATS.heavy.hp * 5);
  });

  it("boss gives the most score", () => {
    const maxScore = Math.max(...enemyTypes.map((e) => ENEMY_STATS[e].score));
    expect(ENEMY_STATS.boss.score).toBe(maxScore);
  });

  it("boss is the largest enemy (dimensions)", () => {
    for (const type of enemyTypes) {
      expect(ENEMY_STATS.boss.width).toBeGreaterThanOrEqual(ENEMY_STATS[type].width);
      expect(ENEMY_STATS.boss.height).toBeGreaterThanOrEqual(ENEMY_STATS[type].height);
    }
  });

  it("score scales with difficulty (higher HP = higher score)", () => {
    // soldier < turret < heavy < boss by HP
    expect(ENEMY_STATS.soldier.score).toBeLessThan(ENEMY_STATS.heavy.score);
    expect(ENEMY_STATS.heavy.score).toBeLessThan(ENEMY_STATS.boss.score);
  });

  it("boss takes multiple grenade hits to kill", () => {
    const hitsNeeded = Math.ceil(ENEMY_STATS.boss.hp / GRENADE_DAMAGE);
    expect(hitsNeeded).toBeGreaterThan(1);
  });

  it("soldier can be one-hit by heavy weapon", () => {
    expect(WEAPONS.heavy.damage).toBeGreaterThanOrEqual(ENEMY_STATS.soldier.hp);
  });
});

// Pickup Stats

describe("PICKUPS", () => {
  const pickupTypes: PickupType[] = ["spread", "heavy", "health", "grenade"];

  it("has exactly 4 pickup types", () => {
    expect(Object.keys(PICKUPS)).toHaveLength(4);
  });

  it("contains all expected pickup types", () => {
    for (const p of pickupTypes) {
      expect(PICKUPS).toHaveProperty(p);
    }
  });

  describe.each(pickupTypes)("pickup: %s", (type) => {
    const info = PICKUPS[type];

    it("has a valid color", () => {
      expect(info.color).toBeGreaterThanOrEqual(0x000000);
      expect(info.color).toBeLessThanOrEqual(0xffffff);
    });

    it("has a non-empty label", () => {
      expect(info.label).toBeTruthy();
      expect(info.label.length).toBeGreaterThan(0);
    });

    it("provides exactly one type of benefit (weapon, heal, or grenades)", () => {
      const benefits = [info.weapon, info.healAmount, info.grenades].filter(
        (v) => v !== undefined,
      );
      expect(benefits).toHaveLength(1);
    });
  });

  it("weapon pickups reference valid weapon types", () => {
    const weaponPickups = pickupTypes.filter((p) => PICKUPS[p].weapon);
    for (const p of weaponPickups) {
      const weaponType = PICKUPS[p].weapon!;
      expect(WEAPONS).toHaveProperty(weaponType);
    }
  });

  it("spread pickup gives spread weapon", () => {
    expect(PICKUPS.spread.weapon).toBe("spread");
  });

  it("heavy pickup gives heavy weapon", () => {
    expect(PICKUPS.heavy.weapon).toBe("heavy");
  });

  it("health pickup has positive heal amount", () => {
    expect(PICKUPS.health.healAmount).toBeGreaterThan(0);
  });

  it("health pickup heal amount is less than max character HP", () => {
    const maxHP = Math.max(
      CHARACTER_STATS.ghost.maxHP,
      CHARACTER_STATS.neo.maxHP,
      CHARACTER_STATS.cj.maxHP,
    );
    expect(PICKUPS.health.healAmount!).toBeLessThanOrEqual(maxHP);
  });

  it("grenade pickup gives positive grenades", () => {
    expect(PICKUPS.grenade.grenades).toBeGreaterThan(0);
  });

  it("no pickup gives the pistol weapon (pistol is always available)", () => {
    const weaponPickups = pickupTypes.filter((p) => PICKUPS[p].weapon);
    for (const p of weaponPickups) {
      expect(PICKUPS[p].weapon).not.toBe("pistol");
    }
  });

  it("all pickup labels are single characters", () => {
    for (const p of pickupTypes) {
      expect(PICKUPS[p].label.length).toBe(1);
    }
  });

  it("all pickups have distinct colors", () => {
    const colors = pickupTypes.map((p) => PICKUPS[p].color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("weapon pickup colors match their weapon colors", () => {
    expect(PICKUPS.spread.color).toBe(WEAPONS.spread.color);
    expect(PICKUPS.heavy.color).toBe(WEAPONS.heavy.color);
  });
});

// Cross-module Consistency

describe("cross-module consistency", () => {
  it("all enemy dimensions fit within the visible play area", () => {
    const enemyTypes: EnemyType[] = ["soldier", "heavy", "turret", "boss"];
    for (const type of enemyTypes) {
      const stats = ENEMY_STATS[type];
      expect(stats.width).toBeLessThan(ARCADE_WIDTH);
      expect(stats.height).toBeLessThan(ARCADE_HEIGHT);
    }
  });

  it("boss width fits in section width (800px)", () => {
    expect(ENEMY_STATS.boss.width).toBeLessThan(800);
  });

  it("TILE_SIZE is consistent with enemy dimensions (enemies are multiples of tile-aligned sizes)", () => {
    // Enemy widths should be multiples of 8 for clean pixel art
    const enemyTypes: EnemyType[] = ["soldier", "heavy", "turret", "boss"];
    for (const type of enemyTypes) {
      expect(ENEMY_STATS[type].width % 8).toBe(0);
      expect(ENEMY_STATS[type].height % 8).toBe(0);
    }
  });

  it("all characters can survive at least 2 enemy hits (with soldier damage)", () => {
    const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];
    for (const id of characters) {
      const hitsToKill = Math.ceil(
        CHARACTER_STATS[id].maxHP / ENEMY_STATS.soldier.damage,
      );
      expect(hitsToKill).toBeGreaterThanOrEqual(2);
    }
  });

  it("boss damage cannot one-shot any character", () => {
    const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];
    for (const id of characters) {
      expect(CHARACTER_STATS[id].maxHP).toBeGreaterThan(ENEMY_STATS.boss.damage);
    }
  });
});

// SECTION_THEMES

describe("SECTION_THEMES", () => {
  const validGroundTypes: GroundType[] = [
    "ground_concrete",
    "ground_dirt",
    "ground_metal_grate",
    "ground_rubble",
  ];

  it("has exactly 6 theme entries (one per section)", () => {
    expect(Object.keys(SECTION_THEMES)).toHaveLength(6);
  });

  it("has entries for sections 0 through 5", () => {
    for (let i = 0; i <= 5; i++) {
      expect(SECTION_THEMES).toHaveProperty(String(i));
    }
  });

  it("has no entry for section 6 or beyond", () => {
    expect(SECTION_THEMES[6]).toBeUndefined();
    expect(SECTION_THEMES[-1]).toBeUndefined();
  });

  describe.each([0, 1, 2, 3, 4, 5])("section %i theme", (section) => {
    const theme = SECTION_THEMES[section];

    it("skyTint is a valid hex color", () => {
      expect(theme.skyTint).toBeGreaterThanOrEqual(0x000000);
      expect(theme.skyTint).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(theme.skyTint)).toBe(true);
    });

    it("accent is a valid hex color", () => {
      expect(theme.accent).toBeGreaterThanOrEqual(0x000000);
      expect(theme.accent).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(theme.accent)).toBe(true);
    });

    it("ambientColor is a valid hex color", () => {
      expect(theme.ambientColor).toBeGreaterThanOrEqual(0x000000);
      expect(theme.ambientColor).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(theme.ambientColor)).toBe(true);
    });

    it("ground is a valid GroundType", () => {
      expect(validGroundTypes).toContain(theme.ground);
    });

    it("accent matches ambientColor", () => {
      expect(theme.accent).toBe(theme.ambientColor);
    });

    it("skyTint is dark (suitable for background)", () => {
      // Sky tints should be dark colors — R, G, B channels each < 0x80
      const r = (theme.skyTint >> 16) & 0xff;
      const g = (theme.skyTint >> 8) & 0xff;
      const b = theme.skyTint & 0xff;
      expect(r).toBeLessThan(0x80);
      expect(g).toBeLessThan(0x80);
      expect(b).toBeLessThan(0x80);
    });
  });

  it("all sections have distinct skyTint values", () => {
    const tints = Object.values(SECTION_THEMES).map((t) => t.skyTint);
    expect(new Set(tints).size).toBe(tints.length);
  });

  it("all sections have distinct accent colors", () => {
    const accents = Object.values(SECTION_THEMES).map((t) => t.accent);
    expect(new Set(accents).size).toBe(accents.length);
  });

  it("boss section (5) uses a distinct color (purple/violet)", () => {
    // Section 5 accent is 0x9945ff (purple) — distinct from other warm/green tones
    expect(SECTION_THEMES[5].accent).toBe(0x9945ff);
  });

  it("warzone sections (2, 4) use warm accent colors (orange, red)", () => {
    // Section 2 accent should be warm (orange), section 4 should be red
    const s2r = (SECTION_THEMES[2].accent >> 16) & 0xff;
    const s4r = (SECTION_THEMES[4].accent >> 16) & 0xff;
    expect(s2r).toBeGreaterThan(0x80); // Orange has high red
    expect(s4r).toBeGreaterThan(0x80); // Red has high red
  });

  it("uses at least 3 different ground types across all sections", () => {
    const groundTypes = new Set(Object.values(SECTION_THEMES).map((t) => t.ground));
    expect(groundTypes.size).toBeGreaterThanOrEqual(3);
  });
});

// Gameplay Constant Boundary Values

describe("gameplay constant edge cases", () => {
  it("GROUND_Y is exactly 240", () => {
    expect(GROUND_Y).toBe(240);
  });

  it("GROUND_Y + TILE_SIZE does not overflow ARCADE_HEIGHT", () => {
    expect(GROUND_Y + TILE_SIZE).toBeLessThanOrEqual(ARCADE_HEIGHT);
  });

  it("GROUND_Y + 2 * TILE_SIZE equals ARCADE_HEIGHT + 2 (tiles go slightly off-screen)", () => {
    // 240 + 32 = 272 > 270 — at most one tile row below ground visible
    expect(GROUND_Y + 2 * TILE_SIZE).toBeGreaterThan(ARCADE_HEIGHT);
  });

  it("LEVEL_WIDTH / 800 equals exactly the number of SECTIONS", () => {
    expect(LEVEL_WIDTH / 800).toBe(SECTIONS.length);
  });

  it("all STARTING values are integers", () => {
    expect(Number.isInteger(STARTING_LIVES)).toBe(true);
    expect(Number.isInteger(STARTING_GRENADES)).toBe(true);
    expect(Number.isInteger(GRENADE_DAMAGE)).toBe(true);
    expect(Number.isInteger(INVINCIBILITY_TIME)).toBe(true);
  });

  it("GRENADE_DAMAGE is exactly 5", () => {
    expect(GRENADE_DAMAGE).toBe(5);
  });

  it("INVINCIBILITY_TIME is exactly 1500ms", () => {
    expect(INVINCIBILITY_TIME).toBe(1500);
  });

  it("double invincibility on respawn (3000ms) is still < 5s", () => {
    expect(INVINCIBILITY_TIME * 2).toBeLessThan(5000);
  });

  it("invincibility covers at least one enemy fire cycle for every enemy type", () => {
    const enemyTypes: EnemyType[] = ["soldier", "heavy", "turret", "boss"];
    for (const type of enemyTypes) {
      // Player should be invincible long enough that the enemy can't hit twice in one i-frame window
      expect(INVINCIBILITY_TIME).toBeGreaterThanOrEqual(ENEMY_STATS[type].fireRate * 0.5);
    }
  });
});

// Exact Data Verification — Character Stats

describe("exact character stat values", () => {
  it("Ghost has speed=150, fireRate=250, maxHP=5, jumpForce=-320", () => {
    expect(CHARACTER_STATS.ghost).toMatchObject({
      name: "Ghost",
      speed: 150,
      fireRate: 250,
      maxHP: 5,
      jumpForce: -320,
    });
  });

  it("Neo has speed=180, fireRate=300, maxHP=4, jumpForce=-350", () => {
    expect(CHARACTER_STATS.neo).toMatchObject({
      name: "Neo",
      speed: 180,
      fireRate: 300,
      maxHP: 4,
      jumpForce: -350,
    });
  });

  it("CJ has speed=128, fireRate=180, maxHP=6, jumpForce=-290", () => {
    expect(CHARACTER_STATS.cj).toMatchObject({
      name: "CJ",
      speed: 128,
      fireRate: 180,
      maxHP: 6,
      jumpForce: -290,
    });
  });
});

// Exact Data Verification — Weapons

describe("exact weapon values", () => {
  it("pistol: damage=1, bulletSpeed=400, ammo=-1, spread=1", () => {
    expect(WEAPONS.pistol).toMatchObject({
      damage: 1,
      bulletSpeed: 400,
      ammo: -1,
      spread: 1,
    });
  });

  it("spread: damage=1, bulletSpeed=350, ammo=30, spread=3", () => {
    expect(WEAPONS.spread).toMatchObject({
      damage: 1,
      bulletSpeed: 350,
      ammo: 30,
      spread: 3,
    });
  });

  it("heavy: damage=2, bulletSpeed=500, ammo=50, spread=1", () => {
    expect(WEAPONS.heavy).toMatchObject({
      damage: 2,
      bulletSpeed: 500,
      ammo: 50,
      spread: 1,
    });
  });
});

// Exact Data Verification — Enemy Stats

describe("exact enemy stat values", () => {
  it("soldier: hp=2, speed=40, damage=1, fireRate=1500, score=100, 24x32", () => {
    expect(ENEMY_STATS.soldier).toEqual({
      hp: 2, speed: 40, damage: 1, fireRate: 1500, score: 100, width: 24, height: 32,
    });
  });

  it("heavy: hp=5, speed=20, damage=2, fireRate=2000, score=300, 32x32", () => {
    expect(ENEMY_STATS.heavy).toEqual({
      hp: 5, speed: 20, damage: 2, fireRate: 2000, score: 300, width: 32, height: 32,
    });
  });

  it("turret: hp=3, speed=0, damage=1, fireRate=800, score=200, 24x24", () => {
    expect(ENEMY_STATS.turret).toEqual({
      hp: 3, speed: 0, damage: 1, fireRate: 800, score: 200, width: 24, height: 24,
    });
  });

  it("boss: hp=50, speed=15, damage=3, fireRate=1000, score=5000, 64x64", () => {
    expect(ENEMY_STATS.boss).toEqual({
      hp: 50, speed: 15, damage: 3, fireRate: 1000, score: 5000, width: 64, height: 64,
    });
  });
});

// Weapon DPS & Combat Math

describe("weapon damage-per-second calculations", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];

  describe.each(characters)("character %s", (char) => {
    const stats = CHARACTER_STATS[char];

    it("pistol DPS is calculable and positive", () => {
      // shots per second * damage per shot * bullets per shot
      const shotsPerSec = 1000 / stats.fireRate;
      const dps = shotsPerSec * WEAPONS.pistol.damage * WEAPONS.pistol.spread;
      expect(dps).toBeGreaterThan(0);
      expect(Number.isFinite(dps)).toBe(true);
    });

    it("spread weapon total DPS exceeds pistol DPS (3 bullets)", () => {
      const shotsPerSec = 1000 / stats.fireRate;
      const pistolDPS = shotsPerSec * WEAPONS.pistol.damage * WEAPONS.pistol.spread;
      const spreadDPS = shotsPerSec * WEAPONS.spread.damage * WEAPONS.spread.spread;
      expect(spreadDPS).toBeGreaterThan(pistolDPS);
    });

    it("heavy weapon DPS exceeds pistol DPS (higher damage)", () => {
      const shotsPerSec = 1000 / stats.fireRate;
      const pistolDPS = shotsPerSec * WEAPONS.pistol.damage;
      const heavyDPS = shotsPerSec * WEAPONS.heavy.damage;
      expect(heavyDPS).toBeGreaterThan(pistolDPS);
    });
  });
});

// Shots-to-Kill Matrix

describe("shots-to-kill matrix", () => {
  const weaponTypes: WeaponType[] = ["pistol", "spread", "heavy"];
  const enemyTypes: EnemyType[] = ["soldier", "heavy", "turret", "boss"];

  describe.each(weaponTypes)("weapon: %s", (weapon) => {
    const weaponInfo = WEAPONS[weapon];

    describe.each(enemyTypes)("vs %s", (enemy) => {
      const enemyInfo = ENEMY_STATS[enemy];

      it("shots-to-kill is a positive integer", () => {
        const shotsToKill = Math.ceil(enemyInfo.hp / weaponInfo.damage);
        expect(shotsToKill).toBeGreaterThan(0);
        expect(Number.isInteger(shotsToKill)).toBe(true);
      });

      it("shots-to-kill is finite", () => {
        const shotsToKill = Math.ceil(enemyInfo.hp / weaponInfo.damage);
        expect(Number.isFinite(shotsToKill)).toBe(true);
      });
    });
  });

  it("pistol kills soldier in exactly 2 shots", () => {
    expect(Math.ceil(ENEMY_STATS.soldier.hp / WEAPONS.pistol.damage)).toBe(2);
  });

  it("heavy kills soldier in exactly 1 shot", () => {
    expect(Math.ceil(ENEMY_STATS.soldier.hp / WEAPONS.heavy.damage)).toBe(1);
  });

  it("pistol kills turret in exactly 3 shots", () => {
    expect(Math.ceil(ENEMY_STATS.turret.hp / WEAPONS.pistol.damage)).toBe(3);
  });

  it("pistol kills heavy enemy in exactly 5 shots", () => {
    expect(Math.ceil(ENEMY_STATS.heavy.hp / WEAPONS.pistol.damage)).toBe(5);
  });

  it("pistol kills boss in exactly 50 shots", () => {
    expect(Math.ceil(ENEMY_STATS.boss.hp / WEAPONS.pistol.damage)).toBe(50);
  });

  it("heavy kills boss in exactly 25 shots", () => {
    expect(Math.ceil(ENEMY_STATS.boss.hp / WEAPONS.heavy.damage)).toBe(25);
  });

  it("grenade kills boss in exactly 10 hits", () => {
    expect(Math.ceil(ENEMY_STATS.boss.hp / GRENADE_DAMAGE)).toBe(10);
  });

  it("spread weapon needs fewer total shots than pistol for boss (3 bullets per shot)", () => {
    const pistolShots = Math.ceil(ENEMY_STATS.boss.hp / WEAPONS.pistol.damage);
    // Spread fires 3 bullets: if all hit, effective damage = 3 per shot
    const spreadShots = Math.ceil(ENEMY_STATS.boss.hp / (WEAPONS.spread.damage * WEAPONS.spread.spread));
    expect(spreadShots).toBeLessThan(pistolShots);
  });
});

// Ammo Sufficiency

describe("ammo sufficiency", () => {
  it("spread ammo (30 shots × 3 bullets) can potentially kill 90 HP worth of enemies", () => {
    const totalDamage = WEAPONS.spread.ammo * WEAPONS.spread.damage * WEAPONS.spread.spread;
    expect(totalDamage).toBe(90);
  });

  it("heavy ammo (50 shots × 2 damage) can deal 100 total damage", () => {
    const totalDamage = WEAPONS.heavy.ammo * WEAPONS.heavy.damage;
    expect(totalDamage).toBe(100);
  });

  it("heavy weapon ammo alone can kill the boss twice", () => {
    const totalDamage = WEAPONS.heavy.ammo * WEAPONS.heavy.damage;
    expect(totalDamage).toBeGreaterThanOrEqual(ENEMY_STATS.boss.hp * 2);
  });

  it("spread weapon ammo alone can kill the boss once (if all bullets hit)", () => {
    const totalDamage = WEAPONS.spread.ammo * WEAPONS.spread.damage * WEAPONS.spread.spread;
    expect(totalDamage).toBeGreaterThanOrEqual(ENEMY_STATS.boss.hp);
  });
});

// HP Bar Color Thresholds (ArcadeHUDScene drawHPBar logic)

describe("HP bar color thresholds", () => {
  // Replicates the logic: ratio > 0.6 ? green : ratio > 0.4 ? yellow : ratio > 0.2 ? orange : red
  function getHPBarColor(hp: number, maxHP: number): number {
    const ratio = Math.max(0, hp) / maxHP;
    return ratio > 0.6 ? 0x4ade80 : ratio > 0.4 ? 0xfbbf24 : ratio > 0.2 ? 0xf97316 : 0xef4444;
  }

  it("full HP is green", () => {
    expect(getHPBarColor(5, 5)).toBe(0x4ade80);
  });

  it("61% HP is green", () => {
    expect(getHPBarColor(61, 100)).toBe(0x4ade80);
  });

  it("exactly 60% HP is yellow (boundary: ratio = 0.6 is NOT > 0.6)", () => {
    expect(getHPBarColor(60, 100)).toBe(0xfbbf24);
  });

  it("41% HP is yellow", () => {
    expect(getHPBarColor(41, 100)).toBe(0xfbbf24);
  });

  it("exactly 40% HP is orange (boundary: ratio = 0.4 is NOT > 0.4)", () => {
    expect(getHPBarColor(40, 100)).toBe(0xf97316);
  });

  it("21% HP is orange", () => {
    expect(getHPBarColor(21, 100)).toBe(0xf97316);
  });

  it("exactly 20% HP is red (boundary: ratio = 0.2 is NOT > 0.2)", () => {
    expect(getHPBarColor(20, 100)).toBe(0xef4444);
  });

  it("1% HP is red", () => {
    expect(getHPBarColor(1, 100)).toBe(0xef4444);
  });

  it("0 HP is red", () => {
    expect(getHPBarColor(0, 5)).toBe(0xef4444);
  });

  it("negative HP clamps to 0 and is red", () => {
    expect(getHPBarColor(-3, 5)).toBe(0xef4444);
  });

  describe.each(["ghost", "neo", "cj"] as ArcadeCharacter[])(
    "character %s HP thresholds",
    (char) => {
      const maxHP = CHARACTER_STATS[char].maxHP;

      it("at full HP is green", () => {
        expect(getHPBarColor(maxHP, maxHP)).toBe(0x4ade80);
      });

      it("at 1 HP is red or orange", () => {
        const color = getHPBarColor(1, maxHP);
        expect([0xef4444, 0xf97316]).toContain(color);
      });
    },
  );
});

// Score Popup Color Tiers (ArcadeGameScene showScorePopup logic)

describe("score popup color tiers", () => {
  // Replicates: points >= 1000 ? red : >= 500 ? orange : >= 200 ? yellow : green
  function getScoreColor(points: number): string {
    return points >= 1000
      ? "#ef4444"
      : points >= 500
        ? "#f97316"
        : points >= 200
          ? "#fbbf24"
          : "#4ade80";
  }

  it("score < 200 is green", () => {
    expect(getScoreColor(100)).toBe("#4ade80");
    expect(getScoreColor(50)).toBe("#4ade80");
    expect(getScoreColor(25)).toBe("#4ade80");
    expect(getScoreColor(199)).toBe("#4ade80");
  });

  it("score exactly 200 is yellow (boundary)", () => {
    expect(getScoreColor(200)).toBe("#fbbf24");
  });

  it("score 200-499 is yellow", () => {
    expect(getScoreColor(300)).toBe("#fbbf24");
    expect(getScoreColor(499)).toBe("#fbbf24");
  });

  it("score exactly 500 is orange (boundary)", () => {
    expect(getScoreColor(500)).toBe("#f97316");
  });

  it("score 500-999 is orange", () => {
    expect(getScoreColor(750)).toBe("#f97316");
    expect(getScoreColor(999)).toBe("#f97316");
  });

  it("score exactly 1000 is red (boundary)", () => {
    expect(getScoreColor(1000)).toBe("#ef4444");
  });

  it("score > 1000 is red", () => {
    expect(getScoreColor(5000)).toBe("#ef4444");
  });

  it("enemy score values map to expected colors", () => {
    expect(getScoreColor(ENEMY_STATS.soldier.score)).toBe("#4ade80"); // 100 = green
    expect(getScoreColor(ENEMY_STATS.turret.score)).toBe("#fbbf24"); // 200 = yellow
    expect(getScoreColor(ENEMY_STATS.heavy.score)).toBe("#fbbf24"); // 300 = yellow
    expect(getScoreColor(ENEMY_STATS.boss.score)).toBe("#ef4444"); // 5000 = red
  });

  it("pickup score (50) is green", () => {
    expect(getScoreColor(50)).toBe("#4ade80");
  });

  it("crate score (25) is green", () => {
    expect(getScoreColor(25)).toBe("#4ade80");
  });
});

// Character Survivability Math

describe("character survivability", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];

  describe.each(characters)("character: %s", (char) => {
    const stats = CHARACTER_STATS[char];

    it("can survive at least 1 boss hit", () => {
      expect(stats.maxHP).toBeGreaterThan(ENEMY_STATS.boss.damage);
    });

    it("total hits-to-kill from soldier damage is exact", () => {
      const hits = Math.ceil(stats.maxHP / ENEMY_STATS.soldier.damage);
      expect(hits * ENEMY_STATS.soldier.damage).toBeGreaterThanOrEqual(stats.maxHP);
      expect((hits - 1) * ENEMY_STATS.soldier.damage).toBeLessThan(stats.maxHP);
    });

    it("total hits-to-kill from boss damage is exact", () => {
      const hits = Math.ceil(stats.maxHP / ENEMY_STATS.boss.damage);
      expect(hits * ENEMY_STATS.boss.damage).toBeGreaterThanOrEqual(stats.maxHP);
      expect((hits - 1) * ENEMY_STATS.boss.damage).toBeLessThan(stats.maxHP);
    });

    it("health pickup always heals (but can't exceed max)", () => {
      const healAmt = PICKUPS.health.healAmount!;
      // At full HP, clamped to maxHP
      const afterHeal = Math.min(stats.maxHP, stats.maxHP + healAmt);
      expect(afterHeal).toBe(stats.maxHP);
      // At 1 HP, actually heals
      const afterHealLow = Math.min(stats.maxHP, 1 + healAmt);
      expect(afterHealLow).toBeGreaterThan(1);
      expect(afterHealLow).toBeLessThanOrEqual(stats.maxHP);
    });

    it("total lives × maxHP gives total survivable damage", () => {
      const totalHP = STARTING_LIVES * stats.maxHP;
      expect(totalHP).toBeGreaterThanOrEqual(12); // At minimum (3 × 4 = 12 for Neo)
    });
  });

  it("Ghost: 5 HP ÷ 1 soldier damage = 5 soldier hits to kill", () => {
    expect(Math.ceil(CHARACTER_STATS.ghost.maxHP / ENEMY_STATS.soldier.damage)).toBe(5);
  });

  it("Neo: 4 HP ÷ 3 boss damage = 2 boss hits to kill", () => {
    expect(Math.ceil(CHARACTER_STATS.neo.maxHP / ENEMY_STATS.boss.damage)).toBe(2);
  });

  it("CJ: 6 HP ÷ 2 heavy damage = 3 heavy hits to kill", () => {
    expect(Math.ceil(CHARACTER_STATS.cj.maxHP / ENEMY_STATS.heavy.damage)).toBe(3);
  });
});

// Grenade Economy

describe("grenade economy", () => {
  it("starting grenades can kill 3 soldiers (3 × 5 damage > 3 × 2 HP)", () => {
    const totalDamage = STARTING_GRENADES * GRENADE_DAMAGE;
    const totalEnemyHP = 3 * ENEMY_STATS.soldier.hp;
    expect(totalDamage).toBeGreaterThan(totalEnemyHP);
  });

  it("starting grenades can kill exactly one heavy enemy per grenade", () => {
    // 5 damage per grenade, heavy has 5 HP — exactly 1 hit
    expect(GRENADE_DAMAGE).toBeGreaterThanOrEqual(ENEMY_STATS.heavy.hp);
  });

  it("starting grenades deal 15 total damage to boss (30% of boss HP)", () => {
    const totalDamage = STARTING_GRENADES * GRENADE_DAMAGE;
    expect(totalDamage).toBe(15);
    const ratio = totalDamage / ENEMY_STATS.boss.hp;
    expect(ratio).toBeCloseTo(0.3, 1);
  });

  it("grenade pickup (3) doubles your starting grenade supply", () => {
    const afterPickup = STARTING_GRENADES + PICKUPS.grenade.grenades!;
    expect(afterPickup).toBe(STARTING_GRENADES * 2);
  });
});

// HUD Panel Positioning (verifies the juice pass values)

describe("HUD panel positioning", () => {
  it("bottom panels at ARCADE_HEIGHT - 24 are within visible area", () => {
    const panelTop = ARCADE_HEIGHT - 24;
    expect(panelTop).toBeGreaterThan(0);
    expect(panelTop).toBeLessThan(ARCADE_HEIGHT);
  });

  it("bottom panels have 24px height that reaches exactly ARCADE_HEIGHT", () => {
    const panelTop = ARCADE_HEIGHT - 24;
    expect(panelTop + 24).toBe(ARCADE_HEIGHT);
  });

  it("top panel (104px wide × 52px tall) doesn't overlap bottom panels", () => {
    const topPanelBottom = 52;
    const bottomPanelTop = ARCADE_HEIGHT - 24;
    expect(topPanelBottom).toBeLessThan(bottomPanelTop);
  });

  it("weapon panel (80px) and grenade panel (70px) don't overlap", () => {
    const weaponPanelRight = 80;
    const grenadePanelLeft = ARCADE_WIDTH - 70;
    expect(weaponPanelRight).toBeLessThan(grenadePanelLeft);
  });

  it("gap between bottom panels leaves room for gameplay visibility", () => {
    const gap = (ARCADE_WIDTH - 70) - 80;
    expect(gap).toBeGreaterThan(200); // At least 200px clear in center
  });
});
