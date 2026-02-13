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

  // IDLE 2 (breathing — arms slightly lowered, glitch line shifted)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 0, 0);
    // Arms at y+1 (relaxed breathing out)
    g.fillStyle(body);
    g.fillRect(2, 11, 4, 6);
    g.fillRect(18, 11, 4, 6);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 17, 4, 2);
    g.fillRect(18, 17, 4, 2);
    // Second glitch artifact shifted
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(8, 14, 8, 1);
    g.generateTexture("soldier_idle_2", W, H);
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

  // --- Death sequence (4 frames) ---

  // DIE 1 — Recoiling back, arms thrown out
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Hood shifted right
    g.fillStyle(body);
    g.fillRect(10, 1, 8, 4);
    g.fillStyle(darken(body, 0.2));
    g.fillRect(10, 4, 8, 1);
    // Visor
    g.fillStyle(PALETTE.void);
    g.fillRect(11, 5, 6, 4);
    g.fillStyle(visor);
    g.fillRect(12, 7, 4, 1);
    // Body tilted back
    g.fillStyle(body);
    g.fillRect(8, 10, 12, 8);
    g.fillStyle(PALETTE.purple);
    g.fillRect(13, 11, 2, 6);
    // Arms thrown wide
    g.fillStyle(body);
    g.fillRect(1, 11, 5, 4);
    g.fillRect(20, 9, 4, 4);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 12, 2, 3);
    g.fillRect(22, 9, 2, 3);
    // Legs
    g.fillStyle(body);
    g.fillRect(9, 18, 4, 7);
    g.fillRect(15, 19, 4, 6);
    g.fillStyle(boots);
    g.fillRect(9, 25, 5, 2);
    g.fillRect(15, 25, 5, 2);
    g.generateTexture("soldier_die_1", W, H);
    g.destroy();
  }

  // DIE 2 — Ragdolling backward, airborne
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Body nearly horizontal, shifted right and up
    g.fillStyle(body);
    g.fillRect(12, 6, 8, 3); // Hood/head
    g.fillStyle(visor);
    g.fillRect(18, 7, 3, 1);
    g.fillStyle(body);
    g.fillRect(6, 9, 14, 6); // Torso wide
    g.fillStyle(PALETTE.purple);
    g.fillRect(12, 10, 2, 4);
    // Arms dangling
    g.fillStyle(body);
    g.fillRect(2, 12, 4, 3);
    g.fillRect(20, 8, 3, 3);
    // Legs splayed
    g.fillStyle(body);
    g.fillRect(7, 15, 3, 6);
    g.fillRect(14, 16, 3, 5);
    g.fillStyle(boots);
    g.fillRect(6, 20, 4, 2);
    g.fillRect(14, 20, 4, 2);
    g.generateTexture("soldier_die_2", W, H);
    g.destroy();
  }

  // DIE 3 — Crumpling, lower position
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Compact crumpled body
    g.fillStyle(body);
    g.fillRect(6, 18, 12, 5); // Collapsed torso
    g.fillRect(8, 16, 8, 3); // Head area
    g.fillStyle(visor);
    g.fillRect(14, 17, 3, 1);
    g.fillStyle(PALETTE.purple);
    g.fillRect(11, 19, 2, 3);
    // Limbs folded
    g.fillStyle(body);
    g.fillRect(3, 20, 4, 3);
    g.fillRect(17, 19, 4, 3);
    g.fillStyle(boots);
    g.fillRect(5, 23, 4, 2);
    g.fillRect(15, 23, 5, 2);
    g.generateTexture("soldier_die_3", W, H);
    g.destroy();
  }

  // DIE 4 — Flat on ground
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Horizontal body at bottom
    g.fillStyle(body);
    g.fillRect(2, 25, 20, 4); // Body flat
    g.fillStyle(PALETTE.void);
    g.fillRect(18, 25, 4, 2); // Head end
    g.fillStyle(visor);
    g.fillRect(19, 26, 2, 1);
    g.fillStyle(boots);
    g.fillRect(2, 27, 4, 2); // Boots end
    g.fillStyle(PALETTE.purple);
    g.fillRect(10, 26, 2, 2); // Accent
    g.generateTexture("soldier_die_4", W, H);
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

  // IDLE 2 (mechanical breathing — arms shift 1px, reactor flickers)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 0, 0);
    // Arms at y+1
    g.fillStyle(armor);
    g.fillRect(2, 8, 5, 8);
    g.fillRect(25, 8, 5, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 16, 5, 3);
    g.fillRect(25, 16, 5, 3);
    // Reactor flicker (dimmer)
    g.fillStyle(darken(visor, 0.3));
    g.fillRect(15, 11, 2, 2);
    g.generateTexture("heavy_idle_2", W, H);
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

  // --- Death sequence (4 frames) ---

  // DIE 1 — Hit jolt, sparks from joints
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Helmet jolted right
    g.fillStyle(armor);
    g.fillRect(13, 1, 10, 5);
    g.fillStyle(visor);
    g.fillRect(15, 3, 6, 2);
    // Body shifted right
    g.fillStyle(armor);
    g.fillRect(9, 7, 18, 11);
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(14, 9, 8, 5);
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(17, 11, 2, 2);
    // Arms thrown out
    g.fillStyle(armor);
    g.fillRect(1, 9, 5, 6);
    g.fillRect(27, 7, 5, 5);
    // Sparks at joints
    g.fillStyle(PALETTE.yellow);
    g.fillRect(6, 8, 2, 2);
    g.fillRect(26, 10, 2, 2);
    // Legs
    g.fillStyle(armor);
    g.fillRect(11, 18, 5, 7);
    g.fillRect(20, 19, 5, 6);
    g.fillStyle(boots);
    g.fillRect(10, 25, 6, 3);
    g.fillRect(19, 25, 6, 3);
    g.generateTexture("heavy_die_1", W, H);
    g.destroy();
  }

  // DIE 2 — Parts separating, antenna flying off
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Helmet detached, flying up-right
    g.fillStyle(armor);
    g.fillRect(18, 0, 8, 4);
    g.fillStyle(visor);
    g.fillRect(19, 1, 5, 2);
    // Antenna piece separate
    g.fillStyle(PALETTE.midGray);
    g.fillRect(28, 0, 2, 1);
    // Body cracking
    g.fillStyle(armor);
    g.fillRect(8, 8, 16, 10);
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(12, 10, 8, 4);
    // Reactor exposed/sparking
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(14, 11, 3, 3);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(13, 10, 1, 1);
    g.fillRect(17, 12, 1, 1);
    // Arms dangling
    g.fillStyle(armor);
    g.fillRect(3, 12, 4, 5);
    g.fillRect(25, 10, 4, 5);
    // Legs buckling
    g.fillStyle(armor);
    g.fillRect(10, 18, 5, 6);
    g.fillRect(19, 19, 5, 5);
    g.fillStyle(boots);
    g.fillRect(9, 24, 6, 3);
    g.fillRect(18, 24, 6, 3);
    g.generateTexture("heavy_die_2", W, H);
    g.destroy();
  }

  // DIE 3 — Collapsing, lower
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Compact wreckage
    g.fillStyle(armor);
    g.fillRect(6, 16, 18, 8); // Main body mass
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(10, 18, 8, 4);
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(13, 19, 2, 2); // Reactor dimming
    // Helmet piece nearby
    g.fillStyle(armor);
    g.fillRect(20, 14, 6, 3);
    g.fillStyle(visor);
    g.fillRect(21, 15, 3, 1);
    // Scattered arm parts
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 20, 3, 3);
    g.fillRect(26, 18, 3, 3);
    // Boots visible
    g.fillStyle(boots);
    g.fillRect(7, 24, 5, 3);
    g.fillRect(19, 24, 5, 3);
    g.generateTexture("heavy_die_3", W, H);
    g.destroy();
  }

  // DIE 4 — Wreckage pile
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Flat scrap pile at bottom
    g.fillStyle(armor);
    g.fillRect(4, 24, 24, 5);
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(8, 25, 10, 3);
    g.fillStyle(darken(armor, 0.3));
    g.fillRect(6, 23, 6, 2);
    g.fillRect(18, 23, 5, 2);
    // Visor shard
    g.fillStyle(visor);
    g.fillRect(20, 24, 2, 1);
    // Dim reactor
    g.fillStyle(darken(PALETTE.brightRed, 0.5));
    g.fillRect(13, 25, 2, 2);
    g.generateTexture("heavy_die_4", W, H);
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

  // IDLE 2 (barrel tracking wobble — shifted 1px up)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun barrel shifted up 1px
    g.fillStyle(metal);
    g.fillRect(10, 5, 4, 4);
    g.fillStyle(darkMetal);
    g.fillRect(14, 6, 6, 2);
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(14, 6, 6, 1);
    // LED flicker (dim)
    g.fillStyle(darken(PALETTE.bagsGreen, 0.4));
    g.fillRect(3, 15, 1, 1);
    g.generateTexture("turret_idle_2", W, H);
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

  // --- Death sequence (4 frames) ---

  // DIE 1 — Barrel knocked askew
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun barrel knocked upward and loose
    g.fillStyle(metal);
    g.fillRect(10, 4, 4, 4);
    g.fillStyle(darkMetal);
    g.fillRect(14, 4, 5, 2);
    // Sparks
    g.fillStyle(PALETTE.yellow);
    g.fillRect(8, 7, 2, 2);
    g.fillStyle(PALETTE.orange);
    g.fillRect(16, 3, 2, 2);
    g.generateTexture("turret_die_1", W, H);
    g.destroy();
  }

  // DIE 2 — Barrel flying off, base cracking
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Cracked base
    g.fillStyle(brick);
    g.fillRect(1, 14, 22, 10);
    g.fillStyle(darken(brick, 0.35));
    g.fillRect(1, 17, 22, 1);
    g.fillRect(1, 21, 22, 1);
    g.fillRect(10, 14, 2, 10); // Crack down center
    // Damaged pedestal
    g.fillStyle(darkMetal);
    g.fillRect(8, 10, 8, 4);
    // Barrel flying up
    g.fillStyle(darkMetal);
    g.fillRect(12, 2, 6, 2);
    // Gun housing cracked
    g.fillStyle(metal);
    g.fillRect(10, 8, 4, 3);
    // Fire/sparks
    g.fillStyle(PALETTE.orange);
    g.fillRect(9, 7, 3, 2);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(14, 5, 2, 2);
    g.generateTexture("turret_die_2", W, H);
    g.destroy();
  }

  // DIE 3 — Exploding apart
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Scattered brick pieces
    g.fillStyle(brick);
    g.fillRect(2, 16, 8, 6);
    g.fillRect(14, 17, 8, 5);
    g.fillStyle(darken(brick, 0.3));
    g.fillRect(5, 19, 5, 1);
    // Metal fragments
    g.fillStyle(metal);
    g.fillRect(4, 10, 3, 3);
    g.fillRect(16, 8, 3, 3);
    g.fillStyle(darkMetal);
    g.fillRect(18, 3, 4, 2);
    g.fillRect(1, 5, 3, 2);
    // Sparks/fire
    g.fillStyle(PALETTE.orange);
    g.fillRect(10, 12, 4, 4);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(11, 13, 2, 2);
    g.generateTexture("turret_die_3", W, H);
    g.destroy();
  }

  // DIE 4 — Rubble pile
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Low rubble pile at bottom
    g.fillStyle(brick);
    g.fillRect(3, 19, 18, 5);
    g.fillStyle(darken(brick, 0.3));
    g.fillRect(5, 18, 4, 2);
    g.fillRect(14, 18, 5, 2);
    // Metal scrap on top
    g.fillStyle(metal);
    g.fillRect(7, 18, 3, 2);
    g.fillRect(15, 19, 2, 2);
    g.fillStyle(darkMetal);
    g.fillRect(10, 17, 4, 2);
    // Smoke wisp
    g.fillStyle(PALETTE.midGray, 0.5);
    g.fillRect(11, 15, 2, 2);
    g.generateTexture("turret_die_4", W, H);
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

  // IDLE 2 (turret housing vibrates, cockpit glow pulses)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    // Main cannon shifted 1px
    g.fillStyle(cannon);
    g.fillRect(48, 15, 16, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 15, 16, 1);
    g.fillStyle(darken(cannon, 0.3));
    g.fillRect(48, 18, 16, 1);
    // Brighter cockpit pulse
    g.fillStyle(lighten(cockpit, 0.5));
    g.fillRect(23, 16, 3, 3);
    g.generateTexture("boss_idle_2", W, H);
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
