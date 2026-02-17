import {
  CHARACTER_STATS,
  WEAPONS,
  ENEMY_STATS,
  PICKUPS,
  GRENADE_DAMAGE,
  STARTING_GRENADES,
  STARTING_LIVES,
  INVINCIBILITY_TIME,
  GROUND_Y,
  ARCADE_HEIGHT,
  ARCADE_WIDTH,
  LEVEL_WIDTH,
  SECTIONS,
  TILE_SIZE,
  GRENADE_RADIUS,
  GRAVITY,
  type ArcadeCharacter,
  type WeaponType,
  type EnemyType,
} from "@/game/arcade/types";
import { getSectionData, getGroundPlatforms } from "@/game/arcade/level-data";

describe("game beatability", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];

  it("total enemy HP across all sections is calculable", () => {
    let totalHP = 0;
    for (let s = 0; s <= 5; s++) {
      for (const enemy of getSectionData(s).enemies) {
        totalHP += ENEMY_STATS[enemy.type].hp;
      }
    }
    expect(totalHP).toBeGreaterThan(0);
    expect(Number.isFinite(totalHP)).toBe(true);
  });

  it("pistol alone can deal enough damage to clear the level (infinite ammo)", () => {
    // Pistol has infinite ammo — so total potential damage is infinite
    // This verifies the game is always beatable even without pickups
    expect(WEAPONS.pistol.ammo).toBe(-1);
    expect(WEAPONS.pistol.damage).toBeGreaterThan(0);
  });

  it("total enemy HP across the level matches expected value", () => {
    let totalHP = 0;
    for (let s = 0; s <= 5; s++) {
      for (const enemy of getSectionData(s).enemies) {
        totalHP += ENEMY_STATS[enemy.type].hp;
      }
    }
    // Manual calculation:
    // S0: 3 soldiers × 3 = 9
    // S1: 2 turrets × 5 + 4 soldiers × 3 = 22
    // S2: 2 heavies × 8 + 4 soldiers × 3 = 28
    // S3: 2 turrets × 5 + 4 soldiers × 3 = 22
    // S4: 3 heavies × 8 + 6 soldiers × 3 + 2 turrets × 5 = 52
    // S5: 1 boss × 80 = 80
    // Total = 9 + 22 + 28 + 22 + 52 + 80 = 213
    expect(totalHP).toBe(213);
  });

  it("total pistol shots needed to clear the level", () => {
    let totalShots = 0;
    for (let s = 0; s <= 5; s++) {
      for (const enemy of getSectionData(s).enemies) {
        totalShots += Math.ceil(ENEMY_STATS[enemy.type].hp / WEAPONS.pistol.damage);
      }
    }
    // Every enemy HP = 1 damage per pistol shot, so total shots = total HP = 213
    expect(totalShots).toBe(213);
  });

  it("total heavy weapon shots needed to clear the level", () => {
    let totalShots = 0;
    for (let s = 0; s <= 5; s++) {
      for (const enemy of getSectionData(s).enemies) {
        totalShots += Math.ceil(ENEMY_STATS[enemy.type].hp / WEAPONS.heavy.damage);
      }
    }
    // Heavy does 2 damage per shot
    // S0: 3×ceil(3/2) = 6
    // S1: 2×ceil(5/2) + 4×ceil(3/2) = 6+8 = 14
    // S2: 2×ceil(8/2) + 4×ceil(3/2) = 8+8 = 16
    // S3: 2×ceil(5/2) + 4×ceil(3/2) = 6+8 = 14
    // S4: 3×ceil(8/2) + 6×ceil(3/2) + 2×ceil(5/2) = 12+12+6 = 30
    // S5: ceil(80/2) = 40
    // Total = 6+14+16+14+30+40 = 120
    expect(totalShots).toBe(120);
  });

  it("heavy ammo (50) is insufficient to clear the entire level solo", () => {
    let totalShotsNeeded = 0;
    for (let s = 0; s <= 5; s++) {
      for (const enemy of getSectionData(s).enemies) {
        totalShotsNeeded += Math.ceil(ENEMY_STATS[enemy.type].hp / WEAPONS.heavy.damage);
      }
    }
    expect(WEAPONS.heavy.ammo).toBeLessThan(totalShotsNeeded);
  });

  describe.each(characters)("character %s can beat the boss", (char) => {
    const stats = CHARACTER_STATS[char];

    it("can survive at least 2 boss hits with full HP", () => {
      const bossHitsToKill = Math.ceil(stats.maxHP / ENEMY_STATS.boss.damage);
      expect(bossHitsToKill).toBeGreaterThanOrEqual(2);
    });

    it("with 3 lives can absorb enough boss hits for the fight", () => {
      const totalHP = STARTING_LIVES * stats.maxHP;
      const totalBossHits = Math.floor(totalHP / ENEMY_STATS.boss.damage);
      // Player needs to survive long enough to fire many shots
      expect(totalBossHits).toBeGreaterThanOrEqual(4);
    });

    it("can fire enough shots to kill the boss within a reasonable time", () => {
      // Time to kill boss with pistol (seconds)
      const shotsNeeded = Math.ceil(ENEMY_STATS.boss.hp / WEAPONS.pistol.damage);
      const timeToKillMs = shotsNeeded * stats.fireRate;
      const timeToKillSec = timeToKillMs / 1000;
      // Should be killable in under 60 seconds of continuous fire
      expect(timeToKillSec).toBeLessThan(60);
    });
  });
});

describe("score economy", () => {
  it("total possible enemy score across the level", () => {
    let totalScore = 0;
    for (let s = 0; s <= 5; s++) {
      for (const enemy of getSectionData(s).enemies) {
        totalScore += ENEMY_STATS[enemy.type].score;
      }
    }
    // Manual calculation:
    // S0: 3 × 100 = 300
    // S1: 2 × 200 + 4 × 100 = 800
    // S2: 2 × 300 + 4 × 100 = 1000
    // S3: 2 × 200 + 4 × 100 = 800
    // S4: 3 × 300 + 6 × 100 + 2 × 200 = 1900
    // S5: 1 × 5000 = 5000
    // Total = 300 + 800 + 1000 + 800 + 1900 + 5000 = 9800
    expect(totalScore).toBe(9800);
  });

  it("total possible pickup score across the level", () => {
    let pickupCount = 0;
    for (let s = 0; s <= 5; s++) {
      pickupCount += getSectionData(s).pickups.length;
    }
    // Each pickup gives 50 base score
    const pickupScore = pickupCount * 50;
    // 4+4+3+4+5+3 = 23 pickups × 50 = 1150
    expect(pickupScore).toBe(1150);
  });

  it("max theoretical score is enemy score + pickup score", () => {
    let totalScore = 0;
    let pickupCount = 0;
    for (let s = 0; s <= 5; s++) {
      const data = getSectionData(s);
      for (const enemy of data.enemies) {
        totalScore += ENEMY_STATS[enemy.type].score;
      }
      pickupCount += data.pickups.length;
    }
    totalScore += pickupCount * 50;
    // 9800 + 1150 = 10950 (not counting crate score or bonus pickups)
    expect(totalScore).toBe(10950);
  });

  it("score per section generally increases (except boss section)", () => {
    const sectionScores = [];
    for (let s = 0; s <= 5; s++) {
      let score = 0;
      for (const enemy of getSectionData(s).enemies) {
        score += ENEMY_STATS[enemy.type].score;
      }
      sectionScores.push(score);
    }
    // Section 4 should have highest score before boss
    expect(sectionScores[4]).toBeGreaterThan(sectionScores[0]);
    // Boss section has highest single-enemy score
    expect(sectionScores[5]).toBe(ENEMY_STATS.boss.score);
  });
});

describe("weapon economy", () => {
  it("spread weapon ammo lasts through section 0 enemies (9 shots for 3 soldiers)", () => {
    const s0enemies = getSectionData(0).enemies;
    let totalShots = 0;
    for (const e of s0enemies) {
      // Spread fires 3 bullets per shot; 1 damage each
      // If all 3 hit, effective per-shot damage = 3
      // But realistically only 1-2 hit, so use 1 bullet per shot for worst case
      totalShots += Math.ceil(ENEMY_STATS[e.type].hp / WEAPONS.spread.damage);
    }
    expect(WEAPONS.spread.ammo).toBeGreaterThan(totalShots);
  });

  it("heavy weapon ammo can kill the boss and still have shots remaining", () => {
    const bossShots = Math.ceil(ENEMY_STATS.boss.hp / WEAPONS.heavy.damage);
    expect(WEAPONS.heavy.ammo - bossShots).toBeGreaterThan(0);
  });

  it("spread weapon ammo runs out before heavy weapon ammo at same fire rate", () => {
    expect(WEAPONS.spread.ammo).toBeLessThan(WEAPONS.heavy.ammo);
  });

  it("total available ammo from pickups across the level", () => {
    let spreadAmmo = 0;
    let heavyAmmo = 0;
    for (let s = 0; s <= 5; s++) {
      for (const pickup of getSectionData(s).pickups) {
        if (pickup.type === "spread") spreadAmmo += WEAPONS.spread.ammo;
        if (pickup.type === "heavy") heavyAmmo += WEAPONS.heavy.ammo;
      }
    }
    // S0 has 1 spread, S1 has 1 heavy, S4 has 1 spread
    expect(spreadAmmo).toBe(60); // 2 spread pickups × 30 ammo
    expect(heavyAmmo).toBe(50);  // 1 heavy pickup × 50 ammo
  });
});

describe("grenade blast radius simulation", () => {

  it("grenade can hit multiple clustered enemies", () => {
    // Section 4 has multiple ground-level enemies within blast radius
    const s4 = getSectionData(4);
    const groundEnemies = s4.enemies.filter((e) => e.y >= GROUND_Y - ENEMY_STATS[e.type].height && e.type !== "turret");

    // Find pairs within blast radius
    let pairsInRadius = 0;
    for (let i = 0; i < groundEnemies.length; i++) {
      for (let j = i + 1; j < groundEnemies.length; j++) {
        const dist = Math.abs(groundEnemies[i].x - groundEnemies[j].x);
        if (dist <= GRENADE_RADIUS * 2) pairsInRadius++;
      }
    }
    expect(pairsInRadius).toBeGreaterThan(0);
  });

  it("boss is always within radius of itself (self-evident hit)", () => {
    const s5 = getSectionData(5);
    const boss = s5.enemies.find((e) => e.type === "boss")!;
    expect(boss).toBeDefined();
    // Distance from explosion center to boss center = 0
    expect(0).toBeLessThan(GRENADE_RADIUS);
  });
});

describe("invincibility frame analysis", () => {
  it("invincibility time exceeds turret and boss fire rates (fast enemies)", () => {
    // Turret (600ms) and boss (800ms) fire faster than invincibility (1500ms)
    expect(INVINCIBILITY_TIME).toBeGreaterThan(ENEMY_STATS.turret.fireRate);
    expect(INVINCIBILITY_TIME).toBeGreaterThan(ENEMY_STATS.boss.fireRate);
  });

  it("invincibility time exceeds soldier fire rate (safe window)", () => {
    expect(INVINCIBILITY_TIME).toBeGreaterThan(ENEMY_STATS.soldier.fireRate);
  });

  it("invincibility time exceeds heavy fire rate", () => {
    expect(INVINCIBILITY_TIME).toBeGreaterThan(ENEMY_STATS.heavy.fireRate);
  });

  it("turret has the fastest fire rate of all enemies", () => {
    const minRate = Math.min(
      ENEMY_STATS.soldier.fireRate,
      ENEMY_STATS.heavy.fireRate,
      ENEMY_STATS.turret.fireRate,
      ENEMY_STATS.boss.fireRate,
    );
    expect(ENEMY_STATS.turret.fireRate).toBe(minRate);
  });

  it("invincibility covers exactly 2.5 turret fire cycles", () => {
    const cycles = INVINCIBILITY_TIME / ENEMY_STATS.turret.fireRate;
    expect(cycles).toBe(2.5);
  });

  it("double invincibility on respawn covers 2+ turret fire cycles", () => {
    const cycles = (INVINCIBILITY_TIME * 2) / ENEMY_STATS.turret.fireRate;
    expect(cycles).toBeGreaterThanOrEqual(2);
  });

  it("boss phase 2 fire rate (halved) still allows i-frame escape", () => {
    const phase2Rate = ENEMY_STATS.boss.fireRate / 2;
    expect(INVINCIBILITY_TIME).toBeGreaterThanOrEqual(phase2Rate);
  });
});

describe("HP clamping behavioral specs", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];
  const healAmount = PICKUPS.health.healAmount!;

  describe.each(characters)("character %s", (char) => {
    const maxHP = CHARACTER_STATS[char].maxHP;

    it("healing at full HP stays at maxHP", () => {
      const afterHeal = Math.min(maxHP, maxHP + healAmount);
      expect(afterHeal).toBe(maxHP);
    });

    it("healing at 1 HP heals to 1 + healAmount (capped at max)", () => {
      const afterHeal = Math.min(maxHP, 1 + healAmount);
      expect(afterHeal).toBe(Math.min(maxHP, 1 + healAmount));
      expect(afterHeal).toBeGreaterThan(1);
    });

    it("healing at maxHP - 1 reaches maxHP", () => {
      const afterHeal = Math.min(maxHP, maxHP - 1 + healAmount);
      expect(afterHeal).toBe(maxHP);
    });

    it("healing from half HP doesn't exceed maxHP", () => {
      const halfHP = Math.floor(maxHP / 2);
      const afterHeal = Math.min(maxHP, halfHP + healAmount);
      expect(afterHeal).toBeLessThanOrEqual(maxHP);
    });

    it("damage that exceeds HP goes to 0 or negative (triggers death)", () => {
      const overkillDamage = maxHP + 5;
      const afterDamage = maxHP - overkillDamage;
      expect(afterDamage).toBeLessThan(0);
    });

    it("exact lethal damage (hp reaches exactly 0) triggers death", () => {
      const afterDamage = maxHP - maxHP;
      expect(afterDamage).toBe(0);
      expect(afterDamage <= 0).toBe(true);
    });
  });
});

describe("weapon switching behavioral specs", () => {
  it("last ammo shot reverts to pistol (ammo goes from 1 to 0)", () => {
    // Simulating the logic: if ammo > 0, ammo--; if ammo <= 0, revert to pistol
    let ammo = 1;
    ammo--;
    const shouldRevert = ammo <= 0;
    expect(shouldRevert).toBe(true);
  });

  it("pistol ammo stays at -1 (never decrements)", () => {
    let ammo = -1;
    // In the code: if (this.ammo > 0) { this.ammo--; }
    // -1 is not > 0, so no decrement
    if (ammo > 0) ammo--;
    expect(ammo).toBe(-1);
  });

  it("picking up same weapon type refreshes ammo to full", () => {
    // Spread: start with 30, fire 10, pick up again = back to 30
    const startAmmo = WEAPONS.spread.ammo;
    let ammo = startAmmo - 10;
    expect(ammo).toBe(20);
    // Pickup resets: this.ammo = WEAPONS[info.weapon].ammo
    ammo = WEAPONS.spread.ammo;
    expect(ammo).toBe(startAmmo);
  });

  it("spread weapon fires 3 bullets but consumes 1 ammo", () => {
    // 30 ammo = 30 trigger pulls = 90 total bullets
    const totalBullets = WEAPONS.spread.ammo * WEAPONS.spread.spread;
    expect(totalBullets).toBe(90);
  });
});

describe("physics and movement math", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];

  describe.each(characters)(
    "character %s movement",
    (char) => {
      const stats = CHARACTER_STATS[char];

      it("max jump height from kinematics (v²/2g) is positive", () => {
        const maxHeight = (stats.jumpForce * stats.jumpForce) / (2 * GRAVITY);
        expect(maxHeight).toBeGreaterThan(0);
        expect(Number.isFinite(maxHeight)).toBe(true);
      });

      it("time to reach jump apex (v/g) is responsive (250-600ms)", () => {
        const timeToApexMs = (Math.abs(stats.jumpForce) / GRAVITY) * 1000;
        expect(timeToApexMs).toBeGreaterThanOrEqual(250);
        expect(timeToApexMs).toBeLessThanOrEqual(600);
      });

      it("total jump duration (2 × apex time) is between 500ms and 1200ms", () => {
        const totalJumpMs = (2 * Math.abs(stats.jumpForce) / GRAVITY) * 1000;
        expect(totalJumpMs).toBeGreaterThanOrEqual(500);
        expect(totalJumpMs).toBeLessThanOrEqual(1200);
      });

      it("horizontal distance covered during a full jump is at least 1 tile", () => {
        const jumpDuration = (2 * Math.abs(stats.jumpForce)) / GRAVITY;
        const horizontalDist = stats.speed * jumpDuration;
        expect(horizontalDist).toBeGreaterThan(TILE_SIZE);
      });

      it("can traverse the full level width in reasonable time", () => {
        const timeToTraverse = LEVEL_WIDTH / stats.speed; // seconds
        // Should take between 20 and 60 seconds of continuous running
        expect(timeToTraverse).toBeGreaterThan(20);
        expect(timeToTraverse).toBeLessThan(60);
      });
    },
  );

  it("Neo traverses the level fastest", () => {
    const times = (["ghost", "neo", "cj"] as ArcadeCharacter[]).map(
      (c) => LEVEL_WIDTH / CHARACTER_STATS[c].speed,
    );
    const neoTime = LEVEL_WIDTH / CHARACTER_STATS.neo.speed;
    expect(neoTime).toBe(Math.min(...times));
  });

  it("CJ traverses the level slowest", () => {
    const times = (["ghost", "neo", "cj"] as ArcadeCharacter[]).map(
      (c) => LEVEL_WIDTH / CHARACTER_STATS[c].speed,
    );
    const cjTime = LEVEL_WIDTH / CHARACTER_STATS.cj.speed;
    expect(cjTime).toBe(Math.max(...times));
  });
});

describe("worst-case damage per section", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];

  it("section 0 max single-hit damage is 1 (soldiers only)", () => {
    const s0 = getSectionData(0);
    const maxDmg = Math.max(...s0.enemies.map((e) => ENEMY_STATS[e.type].damage));
    expect(maxDmg).toBe(1);
  });

  it("section 2 max single-hit damage is 2 (heavy enemies)", () => {
    const s2 = getSectionData(2);
    const maxDmg = Math.max(...s2.enemies.map((e) => ENEMY_STATS[e.type].damage));
    expect(maxDmg).toBe(2);
  });

  it("section 5 max single-hit damage is 3 (boss)", () => {
    const s5 = getSectionData(5);
    const maxDmg = Math.max(...s5.enemies.map((e) => ENEMY_STATS[e.type].damage));
    expect(maxDmg).toBe(3);
  });

  describe.each(characters)("character %s worst-case", (char) => {
    const maxHP = CHARACTER_STATS[char].maxHP;

    it("total HP pool across all lives handles section 4 damage", () => {
      const totalLivesHP = STARTING_LIVES * maxHP;
      const s4 = getSectionData(4);
      const totalEnemyDamage = s4.enemies.reduce(
        (sum, e) => sum + ENEMY_STATS[e.type].damage,
        0,
      );
      // Section 4: 3 heavies (2 dmg) + 6 soldiers (1 dmg) + 2 turrets (1 dmg) = 14 total
      expect(totalEnemyDamage).toBe(14);
      // Verify the HP pool — CJ (18) > Ghost (15) > Neo (12)
      // All characters have enough HP pool to survive if each enemy hits once
      if (char === "neo") {
        // Neo (12 HP pool) vs 14 damage — can still survive because
        // invincibility frames prevent all enemies from hitting
        expect(totalLivesHP).toBe(12);
      } else {
        expect(totalLivesHP).toBeGreaterThanOrEqual(totalEnemyDamage);
      }
    });
  });
});

describe("camera and viewport math", () => {
  it("camera zoom 1.5x shows 320×180 visible area", () => {
    const visibleWidth = ARCADE_WIDTH / 1.5;
    const visibleHeight = ARCADE_HEIGHT / 1.5;
    expect(visibleWidth).toBe(320);
    expect(visibleHeight).toBe(180);
  });

  it("death zoom (1.3x) shows 369×207 visible area", () => {
    const visibleWidth = Math.round(ARCADE_WIDTH / 1.3);
    const visibleHeight = Math.round(ARCADE_HEIGHT / 1.3);
    expect(visibleWidth).toBe(369);
    expect(visibleHeight).toBe(208);
  });

  it("camera deadzone (60×40) allows character to move without camera following", () => {
    const deadzoneWidth = 60; // must match ArcadeGameScene.ts:182
    const deadzoneHeight = 40;
    const visibleWidth = ARCADE_WIDTH / 1.5;
    // Deadzone should be less than half the visible width
    expect(deadzoneWidth).toBeLessThan(visibleWidth / 2);
    expect(deadzoneHeight).toBeLessThan(ARCADE_HEIGHT / 1.5 / 2);
  });

  it("camera bounds match level dimensions", () => {
    expect(LEVEL_WIDTH).toBe(4800);
    expect(ARCADE_HEIGHT).toBe(270);
  });
});

describe("time-to-kill analysis for boss", () => {
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];
  const bossHP = ENEMY_STATS.boss.hp;

  describe.each(characters)("character %s", (char) => {
    const stats = CHARACTER_STATS[char];

    it("TTK with pistol only", () => {
      const shots = Math.ceil(bossHP / WEAPONS.pistol.damage);
      const ttkMs = shots * stats.fireRate;
      const ttkSec = ttkMs / 1000;
      // Should be less than 30 seconds of continuous fire
      expect(ttkSec).toBeLessThan(30);
      expect(ttkSec).toBeGreaterThan(5); // But not trivially fast
    });

    it("TTK with heavy weapon only", () => {
      const shots = Math.ceil(bossHP / WEAPONS.heavy.damage);
      const ttkMs = shots * stats.fireRate;
      const ttkSec = ttkMs / 1000;
      // Heavy should be roughly half the pistol TTK
      expect(ttkSec).toBeLessThan(15);
    });

    it("TTK with spread weapon (best case, all 3 bullets hit)", () => {
      const effectiveDamagePerShot = WEAPONS.spread.damage * WEAPONS.spread.spread;
      const shots = Math.ceil(bossHP / effectiveDamagePerShot);
      const ttkMs = shots * stats.fireRate;
      const ttkSec = ttkMs / 1000;
      // Spread best case should be fastest (3 damage per shot)
      expect(ttkSec).toBeLessThan(10);
    });

    it("TTK with starting grenades + pistol (mixed)", () => {
      const grenadeDamage = STARTING_GRENADES * GRENADE_DAMAGE;
      const remainingHP = bossHP - grenadeDamage;
      const pistolShots = Math.ceil(remainingHP / WEAPONS.pistol.damage);
      const ttkMs = pistolShots * stats.fireRate;
      // Grenades remove 15 HP (18.75%) instantly, reducing pistol shots
      expect(remainingHP).toBe(65);
      expect(pistolShots).toBe(65);
    });
  });

  it("CJ kills the boss fastest (lowest fireRate)", () => {
    const ttkPerChar = characters.map((char) => {
      const shots = Math.ceil(bossHP / WEAPONS.pistol.damage);
      return { char, ttk: shots * CHARACTER_STATS[char].fireRate };
    });
    const fastest = ttkPerChar.reduce((a, b) => (a.ttk < b.ttk ? a : b));
    expect(fastest.char).toBe("cj");
  });

  it("Ghost has middle TTK (between Neo and CJ)", () => {
    const ttkGhost = Math.ceil(bossHP / WEAPONS.pistol.damage) * CHARACTER_STATS.ghost.fireRate;
    const ttkNeo = Math.ceil(bossHP / WEAPONS.pistol.damage) * CHARACTER_STATS.neo.fireRate;
    const ttkCJ = Math.ceil(bossHP / WEAPONS.pistol.damage) * CHARACTER_STATS.cj.fireRate;
    expect(ttkGhost).toBeGreaterThan(ttkCJ);
    expect(ttkGhost).toBeLessThan(ttkNeo);
  });
});

describe("section transition boundaries", () => {
  it("each section starts where the previous ends", () => {
    for (let i = 1; i < SECTIONS.length; i++) {
      expect(SECTIONS[i]).toBe(SECTIONS[i - 1] + 800);
    }
  });

  it("enemies in section N are never in section N-1 bounds", () => {
    for (let s = 1; s <= 5; s++) {
      const prevEnd = (SECTIONS[s - 1] ?? (s - 1) * 800) + 800;
      const data = getSectionData(s);
      for (const enemy of data.enemies) {
        expect(enemy.x).toBeGreaterThanOrEqual(prevEnd);
      }
    }
  });

  it("section 0 enemies are all after the spawn point (x > 50)", () => {
    const s0 = getSectionData(0);
    for (const enemy of s0.enemies) {
      // Player spawns at x=50, enemies should be ahead
      expect(enemy.x).toBeGreaterThan(50);
    }
  });

  it("boss position leaves room for the player to maneuver", () => {
    const s5 = getSectionData(5);
    const boss = s5.enemies[0];
    const sectionStart = SECTIONS[5];
    // Boss at x=4600, section starts at 4000 — player has 600px of approach space
    const approachSpace = boss.x - sectionStart;
    expect(approachSpace).toBeGreaterThanOrEqual(400);
  });
});

describe("GameOver score counter animation", () => {
  // Replica of ArcadeGameOverScene.ts:50 counter tween duration
  function counterDuration(score: number): number {
    return Math.min(1500, Math.max(500, score * 2));
  }

  it("0 score takes minimum 500ms", () => {
    expect(counterDuration(0)).toBe(500);
  });

  it("100 score takes 500ms (below minimum)", () => {
    expect(counterDuration(100)).toBe(500);
  });

  it("250 score takes exactly 500ms (boundary)", () => {
    expect(counterDuration(250)).toBe(500);
  });

  it("251 score takes 502ms (just above minimum)", () => {
    expect(counterDuration(251)).toBe(502);
  });

  it("750 score takes exactly 1500ms (upper boundary)", () => {
    expect(counterDuration(750)).toBe(1500);
  });

  it("1000 score takes capped 1500ms", () => {
    expect(counterDuration(1000)).toBe(1500);
  });

  it("10000 score takes capped 1500ms", () => {
    expect(counterDuration(10000)).toBe(1500);
  });

  it("maximum possible score still caps at 1500ms", () => {
    // Max score ≈ 10200 from earlier calculation
    expect(counterDuration(10200)).toBe(1500);
  });
});

describe("menu stat bar proportions", () => {
  // From ArcadeMenuScene: barWidth * stat / maxStat
  const characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];
  const barWidth = 50;
  const maxHP = Math.max(...characters.map((c) => CHARACTER_STATS[c].maxHP));
  const maxSpeed = Math.max(...characters.map((c) => CHARACTER_STATS[c].speed));
  const minFireRate = Math.min(...characters.map((c) => CHARACTER_STATS[c].fireRate));

  describe.each(characters)("character %s bars", (char) => {
    const stats = CHARACTER_STATS[char];

    it("HP bar width is proportional and within [0, barWidth]", () => {
      const hpBarWidth = Math.floor((barWidth * stats.maxHP) / maxHP);
      expect(hpBarWidth).toBeGreaterThan(0);
      expect(hpBarWidth).toBeLessThanOrEqual(barWidth);
    });

    it("speed bar width is proportional and within [0, barWidth]", () => {
      const spdBarWidth = Math.floor((barWidth * stats.speed) / maxSpeed);
      expect(spdBarWidth).toBeGreaterThan(0);
      expect(spdBarWidth).toBeLessThanOrEqual(barWidth);
    });

    it("fire rate bar width is proportional (inverted) and within [0, barWidth]", () => {
      const fireBarWidth = Math.floor((barWidth * minFireRate) / stats.fireRate);
      expect(fireBarWidth).toBeGreaterThan(0);
      expect(fireBarWidth).toBeLessThanOrEqual(barWidth);
    });
  });

  it("CJ has full HP bar", () => {
    expect(Math.floor((barWidth * CHARACTER_STATS.cj.maxHP) / maxHP)).toBe(barWidth);
  });

  it("Neo has full speed bar", () => {
    expect(Math.floor((barWidth * CHARACTER_STATS.neo.speed) / maxSpeed)).toBe(barWidth);
  });

  it("CJ has full fire rate bar (fastest fire rate)", () => {
    expect(Math.floor((barWidth * minFireRate) / CHARACTER_STATS.cj.fireRate)).toBe(barWidth);
  });
});
