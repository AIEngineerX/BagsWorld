import * as Phaser from "phaser";
import { PALETTE, darken, lighten } from "../../textures/constants";

export function generateEnemySprites(scene: Phaser.Scene): void {
  generateSoldierSprites(scene);
  generateHeavySprites(scene);
  generateTurretSprites(scene);
  generateBossSprites(scene);
}

// --- Soldier → "Corrupted Agent" (24x32): Purple-tinted clothing with glitch artifacts ---

function generateSoldierSprites(scene: Phaser.Scene): void {
  const W = 24;
  const H = 32;
  const body = PALETTE.deepPurple; // Purple hood/body
  const visor = PALETTE.brightRed; // Red visor replacing face
  const boots = PALETTE.darkGray;
  const weapon = PALETTE.midGray;

  function drawSoldierBase(
    g: Phaser.GameObjects.Graphics,
    legOffsetL: number,
    legOffsetR: number,
  ) {
    // Hood 8x4
    g.fillStyle(body);
    g.fillRect(8, 0, 8, 4);
    g.fillStyle(darken(body, 0.2));
    g.fillRect(8, 3, 8, 1); // Hood brim
    // Visor (replaces face)
    g.fillStyle(PALETTE.void);
    g.fillRect(9, 4, 6, 5);
    g.fillStyle(visor);
    g.fillRect(10, 6, 4, 1); // Red visor line
    g.fillStyle(lighten(visor, 0.3));
    g.fillRect(10, 6, 1, 1); // Visor highlight
    // Body
    g.fillStyle(body);
    g.fillRect(6, 9, 12, 9);
    g.fillStyle(lighten(body, 0.15));
    g.fillRect(6, 9, 1, 9);
    g.fillStyle(darken(body, 0.2));
    g.fillRect(17, 9, 1, 9);
    // Purple accent stripe
    g.fillStyle(PALETTE.purple);
    g.fillRect(11, 10, 2, 7);
    // Glitch lines (bagsGreen artifacts)
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(7, 12, 10, 1);
    // Belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(6, 16, 12, 1);
    // Legs
    g.fillStyle(body);
    g.fillRect(7 + legOffsetL, 18, 4, 8);
    g.fillRect(13 + legOffsetR, 18, 4, 8);
    // Boots
    g.fillStyle(boots);
    g.fillRect(7 + legOffsetL, 26, 5, 2);
    g.fillRect(13 + legOffsetR, 26, 5, 2);
  }

  // IDLE
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 0, 0);
    // Arms
    g.fillStyle(body);
    g.fillRect(2, 10, 4, 6);
    g.fillRect(18, 10, 4, 6);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 16, 4, 2);
    g.fillRect(18, 16, 4, 2);
    g.generateTexture("soldier_idle", W, H);
    g.destroy();
  }

  // WALK 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, -1, 1);
    g.fillStyle(body);
    g.fillRect(2, 10, 4, 6);
    g.fillRect(18, 11, 4, 6);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 16, 4, 2);
    g.fillRect(18, 17, 4, 2);
    g.generateTexture("soldier_walk_1", W, H);
    g.destroy();
  }

  // WALK 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 1, -1);
    g.fillStyle(body);
    g.fillRect(2, 11, 4, 6);
    g.fillRect(18, 10, 4, 6);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 17, 4, 2);
    g.fillRect(18, 16, 4, 2);
    g.generateTexture("soldier_walk_2", W, H);
    g.destroy();
  }

  // SHOOT
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 0, 0);
    // Left arm normal
    g.fillStyle(body);
    g.fillRect(2, 10, 4, 6);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 16, 4, 2);
    // Right arm extended with weapon
    g.fillStyle(body);
    g.fillRect(18, 10, 3, 3);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(21, 10, 2, 3);
    g.fillStyle(weapon);
    g.fillRect(21, 11, 3, 1);
    g.generateTexture("soldier_shoot", W, H);
    g.destroy();
  }

}

// --- Heavy → "Rogue Bot" (32x32): Bulky robot, no exposed skin ---

function generateHeavySprites(scene: Phaser.Scene): void {
  const W = 32;
  const H = 32;
  const armor = PALETTE.gray;
  const visor = PALETTE.brightRed;
  const boots = PALETTE.darkGray;

  function drawHeavyBase(
    g: Phaser.GameObjects.Graphics,
    legOffsetL: number,
    legOffsetR: number,
  ) {
    // Helmet 10x6
    g.fillStyle(armor);
    g.fillRect(11, 0, 10, 6);
    g.fillStyle(lighten(armor, 0.15));
    g.fillRect(11, 0, 1, 6);
    // Antenna nub
    g.fillStyle(PALETTE.midGray);
    g.fillRect(19, 0, 2, 1);
    // Green status LED
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(20, 1, 1, 1);
    // Visor with corner highlight
    g.fillStyle(visor);
    g.fillRect(13, 3, 6, 2);
    g.fillStyle(lighten(visor, 0.3));
    g.fillRect(13, 3, 1, 1);
    // Body (wider)
    g.fillStyle(armor);
    g.fillRect(7, 6, 18, 12);
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(7, 6, 1, 12);
    g.fillStyle(darken(armor, 0.25));
    g.fillRect(24, 6, 1, 12);
    // Chest plate detail with grid lines
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(12, 8, 8, 6);
    g.fillStyle(darken(PALETTE.darkGray, 0.15));
    g.fillRect(15, 8, 1, 6); // Vertical grid
    g.fillRect(12, 10, 8, 1); // Horizontal grid
    // Red reactor core
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(15, 11, 2, 2);
    // Belt (mechanical joint)
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(7, 17, 18, 1);
    // Legs (thick)
    g.fillStyle(armor);
    g.fillRect(9 + legOffsetL, 18, 5, 8);
    g.fillRect(18 + legOffsetR, 18, 5, 8);
    // Boots
    g.fillStyle(boots);
    g.fillRect(8 + legOffsetL, 26, 6, 3);
    g.fillRect(17 + legOffsetR, 26, 6, 3);
  }

  // IDLE
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 0, 0);
    // Arms (thick, robot hands)
    g.fillStyle(armor);
    g.fillRect(2, 7, 5, 8);
    g.fillRect(25, 7, 5, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 15, 5, 3);
    g.fillRect(25, 15, 5, 3);
    g.generateTexture("heavy_idle", W, H);
    g.destroy();
  }

  // WALK 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, -1, 1);
    g.fillStyle(armor);
    g.fillRect(2, 7, 5, 8);
    g.fillRect(25, 8, 5, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 15, 5, 3);
    g.fillRect(25, 16, 5, 3);
    g.generateTexture("heavy_walk_1", W, H);
    g.destroy();
  }

  // WALK 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 1, -1);
    g.fillStyle(armor);
    g.fillRect(2, 8, 5, 8);
    g.fillRect(25, 7, 5, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 16, 5, 3);
    g.fillRect(25, 15, 5, 3);
    g.generateTexture("heavy_walk_2", W, H);
    g.destroy();
  }

  // SHOOT (rocket launcher extended)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 0, 0);
    // Left arm supporting
    g.fillStyle(armor);
    g.fillRect(2, 7, 5, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 15, 5, 3);
    // Right arm with rocket launcher (robot hand)
    g.fillStyle(armor);
    g.fillRect(25, 7, 4, 4);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(29, 7, 2, 4);
    // Rocket launcher tube
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(27, 6, 5, 3);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(27, 6, 5, 1);
    g.generateTexture("heavy_shoot", W, H);
    g.destroy();
  }

}

// --- Turret → "Glitch Turret" (24x24): Brick base instead of sandbags ---

function generateTurretSprites(scene: Phaser.Scene): void {
  const W = 24;
  const H = 24;
  const metal = PALETTE.midGray;
  const darkMetal = PALETTE.gray;
  const brick = 0x2a1a3e; // Dark brick matching arcade buildings

  function drawTurretBase(g: Phaser.GameObjects.Graphics) {
    // Brick wall base
    g.fillStyle(brick);
    g.fillRect(1, 14, 22, 10);
    // 3D edges: lighten left, darken right
    g.fillStyle(lighten(brick, 0.15));
    g.fillRect(1, 14, 1, 10);
    g.fillStyle(darken(brick, 0.2));
    g.fillRect(22, 14, 1, 10);
    // Brick mortar lines (now look like brick seams)
    g.fillStyle(darken(brick, 0.25));
    g.fillRect(1, 17, 22, 1);
    g.fillRect(1, 21, 22, 1);
    g.fillRect(6, 14, 1, 10);
    g.fillRect(12, 14, 1, 10);
    g.fillRect(18, 14, 1, 10);
    // Green LED power indicator
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(3, 15, 1, 1);
    // Metal pedestal
    g.fillStyle(darkMetal);
    g.fillRect(8, 8, 8, 6);
    g.fillStyle(lighten(metal, 0.15));
    g.fillRect(8, 8, 1, 6);
  }

  // IDLE
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun barrel pointing right
    g.fillStyle(metal);
    g.fillRect(10, 6, 4, 4);
    g.fillStyle(darkMetal);
    g.fillRect(14, 7, 6, 2);
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(14, 7, 6, 1);
    g.generateTexture("turret_idle", W, H);
    g.destroy();
  }

  // SHOOT (muzzle flash)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    g.fillStyle(metal);
    g.fillRect(10, 6, 4, 4);
    g.fillStyle(darkMetal);
    g.fillRect(14, 7, 6, 2);
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(14, 7, 6, 1);
    // Muzzle flash
    g.fillStyle(PALETTE.yellow);
    g.fillRect(20, 5, 3, 4);
    g.fillStyle(PALETTE.white);
    g.fillRect(21, 6, 1, 2);
    g.generateTexture("turret_shoot", W, H);
    g.destroy();
  }

}

// --- Boss → "Mega Mech" (64x64): Same tank design, BagsWorld palette ---

function generateBossSprites(scene: Phaser.Scene): void {
  const W = 64;
  const H = 64;
  const hull = PALETTE.deepPurple;
  const armorPlate = PALETTE.purple;
  const cockpit = PALETTE.brightRed;
  const tread = PALETTE.darkGray;
  const cannon = PALETTE.lightGray;

  function drawBossBase(
    g: Phaser.GameObjects.Graphics,
    treadOffset: number,
  ) {
    // Tank treads
    g.fillStyle(tread);
    g.fillRect(4, 48, 56, 14);
    g.fillStyle(darken(tread, 0.3));
    // Tread segments
    for (let i = 0; i < 7; i++) {
      g.fillRect(6 + i * 8 + treadOffset, 50, 2, 10);
    }
    g.fillStyle(lighten(tread, 0.15));
    g.fillRect(4, 48, 56, 1);

    // Wheels in treads
    g.fillStyle(PALETTE.midGray);
    g.fillRect(8, 52, 6, 6);
    g.fillRect(22, 52, 6, 6);
    g.fillRect(36, 52, 6, 6);
    g.fillRect(50, 52, 6, 6);

    // Hull body
    g.fillStyle(hull);
    g.fillRect(8, 24, 48, 24);
    g.fillStyle(lighten(hull, 0.12));
    g.fillRect(8, 24, 1, 24);
    g.fillStyle(darken(hull, 0.2));
    g.fillRect(55, 24, 1, 24);
    // Green accent stripe on hull
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(8, 46, 48, 1);

    // Armor plating detail
    g.fillStyle(armorPlate);
    g.fillRect(12, 28, 40, 16);
    g.fillStyle(darken(armorPlate, 0.15));
    g.fillRect(12, 36, 40, 1);
    g.fillRect(32, 28, 1, 16);

    // Turret housing on top
    g.fillStyle(hull);
    g.fillRect(16, 12, 32, 14);
    g.fillStyle(lighten(hull, 0.15));
    g.fillRect(16, 12, 32, 1);
    g.fillStyle(lighten(hull, 0.1));
    g.fillRect(16, 12, 1, 14);

    // Green LED accents on turret
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(18, 14, 1, 1);
    g.fillRect(46, 14, 1, 1);

    // Cockpit (glowing red) with green border
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(21, 14, 10, 8); // Green border
    g.fillStyle(cockpit);
    g.fillRect(22, 15, 8, 6);
    g.fillStyle(lighten(cockpit, 0.3));
    g.fillRect(23, 16, 2, 2);
    // Cockpit glow aura
    g.fillStyle(0xff6666, 0.5);
    g.fillRect(21, 14, 10, 8);
    g.fillStyle(cockpit);
    g.fillRect(22, 15, 8, 6);
    g.fillStyle(lighten(cockpit, 0.3));
    g.fillRect(23, 16, 2, 2);
  }

  // IDLE
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    // Main cannon
    g.fillStyle(cannon);
    g.fillRect(48, 16, 16, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 16, 16, 1);
    g.fillStyle(darken(cannon, 0.3));
    g.fillRect(48, 19, 16, 1);
    g.generateTexture("boss_idle", W, H);
    g.destroy();
  }

  // WALK 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    g.fillStyle(cannon);
    g.fillRect(48, 16, 16, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 16, 16, 1);
    g.generateTexture("boss_walk_1", W, H);
    g.destroy();
  }

  // WALK 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 3);
    g.fillStyle(cannon);
    g.fillRect(48, 16, 16, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 16, 16, 1);
    g.generateTexture("boss_walk_2", W, H);
    g.destroy();
  }

  // SHOOT 1 (cannon fires)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    // Cannon with muzzle flash
    g.fillStyle(cannon);
    g.fillRect(48, 16, 14, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 16, 14, 1);
    // Big muzzle flash
    g.fillStyle(PALETTE.white);
    g.fillRect(62, 13, 2, 10);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(60, 14, 4, 8);
    g.fillStyle(PALETTE.orange);
    g.fillRect(58, 15, 6, 6);
    g.generateTexture("boss_shoot_1", W, H);
    g.destroy();
  }

  // SHOOT 2 (missile pods)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    g.fillStyle(cannon);
    g.fillRect(48, 16, 16, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 16, 16, 1);
    // Missile pods on top opening
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(34, 8, 12, 5);
    // Missiles emerging
    g.fillStyle(PALETTE.silver);
    g.fillRect(36, 6, 2, 4);
    g.fillRect(40, 5, 2, 5);
    g.fillRect(44, 6, 2, 4);
    // Missile flames
    g.fillStyle(PALETTE.orange);
    g.fillRect(36, 4, 2, 2);
    g.fillRect(40, 3, 2, 2);
    g.fillRect(44, 4, 2, 2);
    g.generateTexture("boss_shoot_2", W, H);
    g.destroy();
  }

}
