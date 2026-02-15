import * as Phaser from "phaser";
import { PALETTE, darken, lighten } from "../../textures/constants";

export function generateEnemySprites(scene: Phaser.Scene): void {
  generateSoldierSprites(scene);
  generateHeavySprites(scene);
  generateTurretSprites(scene);
  generateBossSprites(scene);
}

// Helper: draw a filled rect with a 1px outline around it
function drawOutlinedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number,
  outlineColor?: number
) {
  g.fillStyle(outlineColor ?? darken(fillColor, 0.5));
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(fillColor);
  g.fillRect(x, y, w, h);
}

// --- Soldier → "Corrupted Agent" (24x32): Purple-tinted clothing with glitch artifacts ---

function generateSoldierSprites(scene: Phaser.Scene): void {
  const W = 24;
  const H = 32;
  const body = PALETTE.deepPurple; // Purple hood/body
  const visor = PALETTE.brightRed; // Red visor replacing face
  const boots = PALETTE.darkGray;
  const weapon = PALETTE.midGray;
  const outlineColor = darken(body, 0.5);

  function drawSoldierBase(g: Phaser.GameObjects.Graphics, legOffsetL: number, legOffsetR: number) {
    // --- 1px outline silhouette (drawn first, behind everything) ---
    // Hood outline
    g.fillStyle(outlineColor);
    g.fillRect(7, 0, 10, 5);
    // Body outline
    g.fillRect(5, 9, 14, 10);
    // Leg outlines
    g.fillRect(6 + legOffsetL, 17, 6, 10);
    g.fillRect(12 + legOffsetR, 17, 6, 10);

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

    // Shoulder pad details (raised lighter areas at top of body)
    g.fillStyle(lighten(body, 0.25));
    g.fillRect(6, 9, 2, 2); // Left shoulder pad
    g.fillRect(16, 9, 2, 2); // Right shoulder pad

    // Hood wrinkle lines (subtle horizontal lines on body)
    g.fillStyle(darken(body, 0.1));
    g.fillRect(7, 11, 10, 1);
    g.fillStyle(lighten(body, 0.05));
    g.fillRect(7, 14, 10, 1);

    // Purple accent stripe
    g.fillStyle(PALETTE.purple);
    g.fillRect(11, 10, 2, 7);
    // Glitch lines (bagsGreen artifacts)
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(7, 12, 10, 1);
    // Belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(6, 16, 12, 1);

    // Hip weapon (small pistol silhouette on belt)
    g.fillStyle(darken(PALETTE.darkGray, 0.2));
    g.fillRect(15, 16, 3, 2);

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

  // IDLE 2 (breathing — arms slightly lowered, glitch line shifted differently)
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
    // Second glitch artifact shifted to different position than base
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(9, 15, 6, 1); // Shifted lower and narrower than idle_1's glitch
    g.fillRect(6, 10, 3, 1); // Small extra glitch fragment at top
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
  const outlineColor = darken(armor, 0.5);

  function drawHeavyBase(g: Phaser.GameObjects.Graphics, legOffsetL: number, legOffsetR: number) {
    // --- 1px outline silhouette ---
    g.fillStyle(outlineColor);
    g.fillRect(10, 0, 12, 7); // Helmet outline
    g.fillRect(6, 6, 20, 13); // Body outline
    g.fillRect(8 + legOffsetL, 17, 7, 10); // Left leg outline
    g.fillRect(17 + legOffsetR, 17, 7, 10); // Right leg outline

    // Helmet 10x6
    g.fillStyle(armor);
    g.fillRect(11, 0, 10, 6);
    g.fillStyle(lighten(armor, 0.15));
    g.fillRect(11, 0, 1, 6);
    // Antenna nub
    g.fillStyle(PALETTE.midGray);
    g.fillRect(19, 0, 2, 1);

    // Exhaust vents on back of helmet (2px dark slits)
    g.fillStyle(darken(armor, 0.4));
    g.fillRect(11, 1, 2, 1);
    g.fillRect(11, 3, 2, 1);

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

    // Damage weathering: scattered 1px darker scratch marks on armor
    g.fillStyle(darken(armor, 0.35));
    g.fillRect(9, 8, 1, 1);
    g.fillRect(15, 7, 1, 1);
    g.fillRect(22, 10, 1, 1);
    g.fillRect(10, 14, 1, 1);
    g.fillRect(20, 13, 1, 1);

    // Chest plate detail with grid lines
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(12, 8, 8, 6);
    g.fillStyle(darken(PALETTE.darkGray, 0.15));
    g.fillRect(15, 8, 1, 6); // Vertical grid
    g.fillRect(12, 10, 8, 1); // Horizontal grid

    // Rivet dots at armor plate corners (1px lighter dots)
    g.fillStyle(lighten(PALETTE.darkGray, 0.3));
    g.fillRect(12, 8, 1, 1); // Top-left
    g.fillRect(19, 8, 1, 1); // Top-right
    g.fillRect(12, 13, 1, 1); // Bottom-left
    g.fillRect(19, 13, 1, 1); // Bottom-right

    // Red reactor core
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(15, 11, 2, 2);

    // 3-LED status array on chest (green, yellow, red)
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(21, 9, 1, 1);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(21, 10, 1, 1);
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(21, 11, 1, 1);

    // Belt (mechanical joint)
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(7, 17, 18, 1);
    // Legs (thick)
    g.fillStyle(armor);
    g.fillRect(9 + legOffsetL, 18, 5, 8);
    g.fillRect(18 + legOffsetR, 18, 5, 8);

    // Hydraulic piston detail at leg joints (2x1px silver rectangles at knee area)
    g.fillStyle(PALETTE.silver);
    g.fillRect(9 + legOffsetL, 22, 2, 1);
    g.fillRect(18 + legOffsetR, 22, 2, 1);

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
  const outlineColor = darken(metal, 0.5);

  function drawTurretBase(g: Phaser.GameObjects.Graphics) {
    // --- 1px outline around gun housing and base ---
    g.fillStyle(outlineColor);
    g.fillRect(0, 13, 24, 11); // Base outline
    g.fillRect(7, 7, 10, 7); // Pedestal outline

    // Brick wall base
    g.fillStyle(brick);
    g.fillRect(1, 14, 22, 10);
    // 3D edges: lighten left, darken right
    g.fillStyle(lighten(brick, 0.15));
    g.fillRect(1, 14, 1, 10);
    g.fillStyle(darken(brick, 0.2));
    g.fillRect(22, 14, 1, 10);

    // Enhanced brick mortar with depth (alternating lighter/darker bricks)
    g.fillStyle(darken(brick, 0.25));
    g.fillRect(1, 17, 22, 1); // Mortar lines
    g.fillRect(1, 21, 22, 1);
    g.fillRect(6, 14, 1, 10);
    g.fillRect(12, 14, 1, 10);
    g.fillRect(18, 14, 1, 10);
    // Lighter bricks for depth variation
    g.fillStyle(lighten(brick, 0.1));
    g.fillRect(2, 15, 3, 2); // Light brick
    g.fillRect(13, 18, 4, 2); // Light brick
    g.fillRect(7, 22, 4, 1); // Light brick
    // Darker bricks for depth variation
    g.fillStyle(darken(brick, 0.1));
    g.fillRect(8, 15, 3, 2); // Dark brick
    g.fillRect(2, 18, 3, 2); // Dark brick
    g.fillRect(19, 22, 2, 1); // Dark brick

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
    // Gun housing
    g.fillStyle(metal);
    g.fillRect(10, 6, 4, 4);
    // Barrel
    g.fillStyle(darkMetal);
    g.fillRect(14, 7, 6, 2);
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(14, 7, 6, 1);
    // Barrel rifling (2 ring lines)
    g.fillStyle(darken(darkMetal, 0.2));
    g.fillRect(16, 7, 1, 2);
    g.fillRect(19, 7, 1, 2);
    // Ammo belt: small rectangles from housing to base
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(10, 10, 2, 1);
    g.fillRect(9, 11, 2, 1);
    g.fillRect(8, 12, 2, 1);
    g.fillRect(7, 13, 2, 1);
    g.generateTexture("turret_idle", W, H);
    g.destroy();
  }

  // IDLE 2 (barrel tracking wobble — shifted 1px up)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun housing shifted up 1px
    g.fillStyle(metal);
    g.fillRect(10, 5, 4, 4);
    // Barrel shifted up 1px
    g.fillStyle(darkMetal);
    g.fillRect(14, 6, 6, 2);
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(14, 6, 6, 1);
    // Barrel rifling
    g.fillStyle(darken(darkMetal, 0.2));
    g.fillRect(16, 6, 1, 2);
    g.fillRect(19, 6, 1, 2);
    // Ammo belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(10, 9, 2, 1);
    g.fillRect(9, 10, 2, 1);
    g.fillRect(8, 11, 2, 1);
    g.fillRect(7, 12, 2, 1);
    // LED flicker (dim)
    g.fillStyle(darken(PALETTE.bagsGreen, 0.4));
    g.fillRect(3, 15, 1, 1);
    g.generateTexture("turret_idle_2", W, H);
    g.destroy();
  }

  // SHOOT (muzzle flash + targeting laser)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun housing
    g.fillStyle(metal);
    g.fillRect(10, 6, 4, 4);
    // Barrel
    g.fillStyle(darkMetal);
    g.fillRect(14, 7, 6, 2);
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(14, 7, 6, 1);
    // Barrel rifling
    g.fillStyle(darken(darkMetal, 0.2));
    g.fillRect(16, 7, 1, 2);
    g.fillRect(19, 7, 1, 2);
    // Ammo belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(10, 10, 2, 1);
    g.fillRect(9, 11, 2, 1);
    g.fillRect(8, 12, 2, 1);
    g.fillRect(7, 13, 2, 1);
    // Targeting laser (1px red line from barrel tip, 4px long)
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(20, 8, 4, 1);
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
    phase2: boolean = false
  ) {
    // Tank treads
    g.fillStyle(tread);
    g.fillRect(4, 48, 56, 14);
    g.fillStyle(darken(tread, 0.3));
    // Individual track links: alternate between two shades
    for (let i = 0; i < 7; i++) {
      const shade = i % 2 === 0 ? darken(tread, 0.3) : darken(tread, 0.15);
      g.fillStyle(shade);
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

    // Rivets along hull top and bottom edges (1px lighter dots every 8px)
    g.fillStyle(lighten(hull, 0.25));
    for (let i = 0; i < 6; i++) {
      g.fillRect(12 + i * 8, 24, 1, 1); // Top edge
      g.fillRect(12 + i * 8, 47, 1, 1); // Bottom edge
    }

    // Armor plating detail
    g.fillStyle(armorPlate);
    g.fillRect(12, 28, 40, 16);
    g.fillStyle(darken(armorPlate, 0.15));
    g.fillRect(12, 36, 40, 1);
    g.fillRect(32, 28, 1, 16);

    // Reactive armor plates: 1px gap lines between armor sections
    g.fillStyle(darken(hull, 0.3));
    g.fillRect(12, 28, 40, 1); // Top gap
    g.fillRect(12, 43, 40, 1); // Bottom gap
    g.fillRect(12, 28, 1, 16); // Left gap
    g.fillRect(51, 28, 1, 16); // Right gap
    g.fillRect(22, 28, 1, 16); // Inner vertical gap

    // Headlights at front of hull (2px yellow squares with 1px glow aura)
    g.fillStyle(PALETTE.yellow, 0.4);
    g.fillRect(53, 29, 4, 4); // Glow aura top
    g.fillStyle(PALETTE.yellow, 0.4);
    g.fillRect(53, 39, 4, 4); // Glow aura bottom
    g.fillStyle(PALETTE.yellow);
    g.fillRect(54, 30, 2, 2); // Top headlight
    g.fillRect(54, 40, 2, 2); // Bottom headlight

    // Exhaust pipes on back of hull (3x2 shapes with 1px smoke)
    g.fillStyle(PALETTE.midGray);
    g.fillRect(8, 30, 3, 2); // Top exhaust pipe
    g.fillRect(8, 38, 3, 2); // Bottom exhaust pipe
    g.fillStyle(darken(PALETTE.midGray, 0.3));
    g.fillRect(9, 30, 1, 2); // Pipe interior darkness
    g.fillRect(9, 38, 1, 2);
    // Smoke pixels above pipes
    g.fillStyle(PALETTE.midGray, 0.5);
    g.fillRect(7, 29, 1, 1);
    g.fillRect(7, 37, 1, 1);

    if (phase2) {
      // Phase 2: additional smoke from exhaust
      g.fillStyle(PALETTE.lightGray, 0.4);
      g.fillRect(6, 28, 1, 1);
      g.fillRect(6, 36, 1, 1);
      g.fillRect(5, 27, 1, 1);
      g.fillRect(5, 35, 1, 1);
    }

    // Turret housing on top
    g.fillStyle(hull);
    g.fillRect(16, 12, 32, 14);
    g.fillStyle(lighten(hull, 0.15));
    g.fillRect(16, 12, 32, 1);
    g.fillStyle(lighten(hull, 0.1));
    g.fillRect(16, 12, 1, 14);

    // Hull kill marks on turret housing (3 small tally marks, 1px white lines)
    g.fillStyle(PALETTE.white);
    g.fillRect(34, 14, 1, 3);
    g.fillRect(36, 14, 1, 3);
    g.fillRect(38, 14, 1, 3);

    // Green LED accents on turret
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(18, 14, 1, 1);
    g.fillRect(46, 14, 1, 1);

    if (phase2) {
      // Phase 2: cracks across armor plates (diagonal dark lines)
      g.fillStyle(darken(armorPlate, 0.5));
      g.fillRect(14, 30, 1, 1);
      g.fillRect(15, 31, 1, 1);
      g.fillRect(16, 32, 1, 1);
      g.fillRect(35, 33, 1, 1);
      g.fillRect(36, 34, 1, 1);
      g.fillRect(37, 35, 1, 1);
      g.fillRect(44, 29, 1, 1);
      g.fillRect(45, 30, 1, 1);

      // Phase 2: sparks at hull-turret junction
      g.fillStyle(PALETTE.yellow);
      g.fillRect(18, 25, 2, 2);
      g.fillStyle(PALETTE.white);
      g.fillRect(42, 25, 2, 2);

      // Phase 2: missing armor plate (one section replaced with darker hull)
      g.fillStyle(darken(hull, 0.15));
      g.fillRect(24, 29, 8, 7);
      // Show internal structure lines
      g.fillStyle(darken(hull, 0.35));
      g.fillRect(25, 31, 6, 1);
      g.fillRect(28, 29, 1, 7);
    }

    // Cockpit (glowing red) with green border
    const cockpitColor = phase2 ? PALETTE.orange : cockpit;
    const cockpitGlow = phase2 ? 0xffddaa : 0xff6666;
    const cockpitGlowSize = phase2 ? 12 : 10;
    const cockpitGlowOffset = phase2 ? -1 : 0;

    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(21, 14, 10, 8); // Green border
    g.fillStyle(cockpitGlow, 0.5);
    g.fillRect(
      21 + cockpitGlowOffset,
      14 + cockpitGlowOffset,
      cockpitGlowSize,
      8 - cockpitGlowOffset * 2
    ); // Glow aura
    g.fillStyle(cockpitColor);
    g.fillRect(22, 15, 8, 6);
    g.fillStyle(lighten(cockpitColor, 0.3));
    g.fillRect(23, 16, 2, 2);

    if (phase2) {
      // Phase 2: brighter reactor center (orange-white)
      g.fillStyle(PALETTE.white, 0.6);
      g.fillRect(25, 17, 2, 2);
    }
  }

  function drawCannon(g: Phaser.GameObjects.Graphics, yOff: number = 0) {
    g.fillStyle(cannon);
    g.fillRect(48, 16 + yOff, 16, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 16 + yOff, 16, 1);
    g.fillStyle(darken(cannon, 0.3));
    g.fillRect(48, 19 + yOff, 16, 1);
  }

  // IDLE
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    drawCannon(g);
    g.generateTexture("boss_idle", W, H);
    g.destroy();
  }

  // IDLE 2 (turret housing vibrates, cockpit glow pulses)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    drawCannon(g, -1);
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

  // ============================================================
  // Boss Phase 2 damaged textures (6 new textures)
  // ============================================================

  // PHASE 2 IDLE
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
    drawCannon(g);
    g.generateTexture("boss_p2_idle", W, H);
    g.destroy();
  }

  // PHASE 2 IDLE 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
    drawCannon(g, -1);
    // Brighter cockpit pulse (Phase 2 orange-white)
    g.fillStyle(lighten(PALETTE.orange, 0.5));
    g.fillRect(23, 16, 3, 3);
    g.generateTexture("boss_p2_idle_2", W, H);
    g.destroy();
  }

  // PHASE 2 WALK 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
    g.fillStyle(cannon);
    g.fillRect(48, 16, 16, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 16, 16, 1);
    g.generateTexture("boss_p2_walk_1", W, H);
    g.destroy();
  }

  // PHASE 2 WALK 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 3, true);
    g.fillStyle(cannon);
    g.fillRect(48, 16, 16, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(48, 16, 16, 1);
    g.generateTexture("boss_p2_walk_2", W, H);
    g.destroy();
  }

  // PHASE 2 SHOOT 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
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
    g.generateTexture("boss_p2_shoot_1", W, H);
    g.destroy();
  }

  // PHASE 2 SHOOT 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
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
    g.generateTexture("boss_p2_shoot_2", W, H);
    g.destroy();
  }
}
