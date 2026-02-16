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

// --- Soldier → "Corrupted Agent" (32x40): Purple-tinted clothing with glitch artifacts ---

function generateSoldierSprites(scene: Phaser.Scene): void {
  const W = 32;
  const H = 40;
  const body = PALETTE.deepPurple;
  const visor = PALETTE.brightRed;
  const boots = PALETTE.darkGray;
  const weapon = PALETTE.midGray;
  const outlineColor = darken(body, 0.5);

  function drawSoldierBase(g: Phaser.GameObjects.Graphics, legOffsetL: number, legOffsetR: number) {
    // --- 1px outline silhouette (drawn first, behind everything) ---
    // Hood outline
    g.fillStyle(outlineColor);
    g.fillRect(9, 0, 14, 7);
    // Body outline
    g.fillStyle(outlineColor);
    g.fillRect(6, 11, 20, 14);
    // Leg outlines
    g.fillRect(7 + legOffsetL, 23, 8, 13);
    g.fillRect(17 + legOffsetR, 23, 8, 13);

    // Hood 12x5
    g.fillStyle(body);
    g.fillRect(10, 0, 12, 5);
    // Hood top highlight
    g.fillStyle(lighten(body, 0.1));
    g.fillRect(10, 0, 12, 1);
    // Hood brim
    g.fillStyle(darken(body, 0.2));
    g.fillRect(10, 4, 12, 1);
    // Hood side shading - left light
    g.fillStyle(lighten(body, 0.15));
    g.fillRect(10, 1, 1, 3);
    // Hood side shading - right dark
    g.fillStyle(darken(body, 0.15));
    g.fillRect(21, 1, 1, 3);
    // Hood wrinkle detail
    g.fillStyle(darken(body, 0.1));
    g.fillRect(14, 2, 4, 1);

    // Visor area (replaces face)
    g.fillStyle(PALETTE.void);
    g.fillRect(11, 5, 10, 7);
    // Visor scanline effect - multiple red lines with gaps
    g.fillStyle(visor);
    g.fillRect(12, 7, 8, 1); // Main visor line
    g.fillRect(12, 9, 8, 1); // Second scanline
    // Visor highlight top-left
    g.fillStyle(lighten(visor, 0.3));
    g.fillRect(12, 7, 2, 1);
    // Visor dim bottom-right
    g.fillStyle(darken(visor, 0.2));
    g.fillRect(18, 9, 2, 1);
    // Scanline static pixels
    g.fillStyle(darken(visor, 0.4));
    g.fillRect(14, 8, 1, 1);
    g.fillRect(17, 8, 1, 1);

    // Body - 5-zone torso shading
    g.fillStyle(body);
    g.fillRect(7, 12, 18, 12);
    // Zone 1: left highlight edge
    g.fillStyle(lighten(body, 0.18));
    g.fillRect(7, 12, 2, 12);
    // Zone 2: left-center
    g.fillStyle(lighten(body, 0.08));
    g.fillRect(9, 12, 4, 12);
    // Zone 3: center (base color, already drawn)
    // Zone 4: right-center
    g.fillStyle(darken(body, 0.1));
    g.fillRect(19, 12, 4, 12);
    // Zone 5: right shadow edge
    g.fillStyle(darken(body, 0.22));
    g.fillRect(23, 12, 2, 12);

    // Shoulder armor - left
    g.fillStyle(lighten(body, 0.28));
    g.fillRect(7, 12, 3, 3);
    g.fillStyle(lighten(body, 0.35));
    g.fillRect(7, 12, 1, 1); // Armor highlight corner
    // Shoulder armor - right
    g.fillStyle(lighten(body, 0.2));
    g.fillRect(22, 12, 3, 3);
    g.fillStyle(darken(body, 0.1));
    g.fillRect(24, 14, 1, 1); // Armor shadow corner

    // Hood wrinkle lines on torso
    g.fillStyle(darken(body, 0.12));
    g.fillRect(9, 15, 14, 1);
    g.fillStyle(lighten(body, 0.06));
    g.fillRect(9, 18, 14, 1);
    g.fillStyle(darken(body, 0.08));
    g.fillRect(9, 20, 14, 1);

    // Purple accent stripe down center
    g.fillStyle(PALETTE.purple);
    g.fillRect(14, 13, 3, 9);
    g.fillStyle(lighten(PALETTE.purple, 0.15));
    g.fillRect(14, 13, 1, 9); // Stripe highlight edge

    // Glitch lines (bagsGreen artifacts)
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(9, 16, 14, 1);
    // Extra glitch fragments
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(20, 14, 3, 1);

    // Belt with buckle detail
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(7, 22, 18, 2);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(14, 22, 3, 2); // Belt buckle
    g.fillStyle(lighten(PALETTE.midGray, 0.2));
    g.fillRect(14, 22, 1, 1); // Buckle highlight

    // Hip weapon holster (pistol silhouette on belt)
    g.fillStyle(darken(PALETTE.darkGray, 0.2));
    g.fillRect(21, 22, 4, 3);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(22, 22, 2, 1); // Holster clasp
    // Pistol grip visible
    g.fillStyle(darken(PALETTE.midGray, 0.15));
    g.fillRect(22, 24, 1, 2);

    // Legs with shading
    g.fillStyle(body);
    g.fillRect(8 + legOffsetL, 24, 6, 10);
    g.fillRect(18 + legOffsetR, 24, 6, 10);
    // Left leg highlight
    g.fillStyle(lighten(body, 0.1));
    g.fillRect(8 + legOffsetL, 24, 1, 10);
    // Right leg shadow
    g.fillStyle(darken(body, 0.15));
    g.fillRect(23 + legOffsetR, 24, 1, 10);
    // Knee detail
    g.fillStyle(darken(body, 0.1));
    g.fillRect(9 + legOffsetL, 29, 4, 1);
    g.fillRect(19 + legOffsetR, 29, 4, 1);

    // Boots with detail
    g.fillStyle(boots);
    g.fillRect(8 + legOffsetL, 34, 7, 3);
    g.fillRect(18 + legOffsetR, 34, 7, 3);
    // Boot highlights
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(8 + legOffsetL, 34, 7, 1);
    g.fillRect(18 + legOffsetR, 34, 7, 1);
    // Boot soles
    g.fillStyle(darken(boots, 0.25));
    g.fillRect(8 + legOffsetL, 36, 7, 1);
    g.fillRect(18 + legOffsetR, 36, 7, 1);
    // Boot lace/strap detail
    g.fillStyle(PALETTE.midGray);
    g.fillRect(10 + legOffsetL, 35, 3, 1);
    g.fillRect(20 + legOffsetR, 35, 3, 1);
  }

  // IDLE 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 0, 0);
    // Arms
    g.fillStyle(body);
    g.fillRect(2, 13, 5, 8);
    g.fillRect(25, 13, 5, 8);
    // Arm shading
    g.fillStyle(lighten(body, 0.12));
    g.fillRect(2, 13, 1, 8);
    g.fillStyle(darken(body, 0.15));
    g.fillRect(29, 13, 1, 8);
    // Gloves
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 21, 5, 2);
    g.fillRect(25, 21, 5, 2);
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(2, 21, 5, 1);
    g.fillRect(25, 21, 5, 1);
    g.generateTexture("soldier_idle", W, H);
    g.destroy();
  }

  // IDLE 2 (breathing — arms slightly lowered, glitch line shifted)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 0, 0);
    // Arms at y+1 (relaxed breathing out)
    g.fillStyle(body);
    g.fillRect(2, 14, 5, 8);
    g.fillRect(25, 14, 5, 8);
    g.fillStyle(lighten(body, 0.12));
    g.fillRect(2, 14, 1, 8);
    g.fillStyle(darken(body, 0.15));
    g.fillRect(29, 14, 1, 8);
    // Gloves lowered
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 22, 5, 2);
    g.fillRect(25, 22, 5, 2);
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(2, 22, 5, 1);
    g.fillRect(25, 22, 5, 1);
    // Second glitch artifact shifted
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(11, 19, 8, 1);
    g.fillRect(8, 13, 4, 1);
    g.generateTexture("soldier_idle_2", W, H);
    g.destroy();
  }

  // IDLE 3 (head scan — visor flicker, head rotated slightly)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 0, 0);
    // Arms normal position
    g.fillStyle(body);
    g.fillRect(2, 13, 5, 8);
    g.fillRect(25, 13, 5, 8);
    g.fillStyle(lighten(body, 0.12));
    g.fillRect(2, 13, 1, 8);
    g.fillStyle(darken(body, 0.15));
    g.fillRect(29, 13, 1, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 21, 5, 2);
    g.fillRect(25, 21, 5, 2);
    // Visor scan effect — shifted visor lines for scanning look
    g.fillStyle(PALETTE.void);
    g.fillRect(12, 5, 10, 7);
    g.fillStyle(visor);
    g.fillRect(13, 8, 8, 1); // Visor shifted down 1
    g.fillStyle(darken(visor, 0.3));
    g.fillRect(13, 6, 8, 1); // Dim upper line
    g.fillStyle(lighten(visor, 0.4));
    g.fillRect(13, 10, 8, 1); // Bright lower scan
    // Glitch static on face
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(15, 7, 2, 1);
    g.fillRect(18, 9, 1, 1);
    g.generateTexture("soldier_idle_3", W, H);
    g.destroy();
  }

  // WALK 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, -2, 2);
    // Left arm forward
    g.fillStyle(body);
    g.fillRect(2, 13, 5, 8);
    g.fillRect(25, 14, 5, 8);
    g.fillStyle(lighten(body, 0.12));
    g.fillRect(2, 13, 1, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 21, 5, 2);
    g.fillRect(25, 22, 5, 2);
    g.generateTexture("soldier_walk_1", W, H);
    g.destroy();
  }

  // WALK 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, -1, 1);
    g.fillStyle(body);
    g.fillRect(2, 14, 5, 8);
    g.fillRect(25, 13, 5, 8);
    g.fillStyle(lighten(body, 0.12));
    g.fillRect(2, 14, 1, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 22, 5, 2);
    g.fillRect(25, 21, 5, 2);
    g.generateTexture("soldier_walk_2", W, H);
    g.destroy();
  }

  // WALK 3
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 2, -2);
    g.fillStyle(body);
    g.fillRect(2, 14, 5, 8);
    g.fillRect(25, 13, 5, 8);
    g.fillStyle(darken(body, 0.15));
    g.fillRect(29, 13, 1, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 22, 5, 2);
    g.fillRect(25, 21, 5, 2);
    g.generateTexture("soldier_walk_3", W, H);
    g.destroy();
  }

  // WALK 4
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 1, -1);
    g.fillStyle(body);
    g.fillRect(2, 13, 5, 8);
    g.fillRect(25, 14, 5, 8);
    g.fillStyle(lighten(body, 0.12));
    g.fillRect(2, 13, 1, 8);
    g.fillStyle(darken(body, 0.15));
    g.fillRect(29, 14, 1, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 21, 5, 2);
    g.fillRect(25, 22, 5, 2);
    g.generateTexture("soldier_walk_4", W, H);
    g.destroy();
  }

  // SHOOT
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawSoldierBase(g, 0, 0);
    // Left arm normal
    g.fillStyle(body);
    g.fillRect(2, 13, 5, 8);
    g.fillStyle(lighten(body, 0.12));
    g.fillRect(2, 13, 1, 8);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 21, 5, 2);
    // Right arm extended with weapon
    g.fillStyle(body);
    g.fillRect(25, 13, 4, 4);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(29, 13, 3, 4);
    g.fillStyle(weapon);
    g.fillRect(29, 14, 3, 2);
    // Muzzle flash dot
    g.fillStyle(PALETTE.yellow);
    g.fillRect(31, 13, 1, 1);
    g.generateTexture("soldier_shoot", W, H);
    g.destroy();
  }

  // --- Death sequence (4 frames) ---

  // DIE 1 — Recoiling back, arms thrown out
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Hood shifted right
    g.fillStyle(body);
    g.fillRect(14, 1, 10, 5);
    g.fillStyle(darken(body, 0.2));
    g.fillRect(14, 5, 10, 1);
    // Hood highlight
    g.fillStyle(lighten(body, 0.1));
    g.fillRect(14, 1, 10, 1);
    // Visor
    g.fillStyle(PALETTE.void);
    g.fillRect(15, 6, 8, 5);
    g.fillStyle(visor);
    g.fillRect(16, 8, 6, 1);
    g.fillStyle(lighten(visor, 0.3));
    g.fillRect(16, 8, 2, 1);
    // Body tilted back with shading
    g.fillStyle(body);
    g.fillRect(10, 12, 16, 11);
    g.fillStyle(lighten(body, 0.15));
    g.fillRect(10, 12, 2, 11);
    g.fillStyle(darken(body, 0.18));
    g.fillRect(24, 12, 2, 11);
    // Purple accent
    g.fillStyle(PALETTE.purple);
    g.fillRect(17, 14, 3, 8);
    // Glitch fragment
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(12, 17, 10, 1);
    // Belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(10, 21, 16, 2);
    // Arms thrown wide
    g.fillStyle(body);
    g.fillRect(1, 14, 7, 5);
    g.fillRect(26, 11, 6, 5);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 16, 3, 3);
    g.fillRect(30, 11, 2, 4);
    // Legs
    g.fillStyle(body);
    g.fillRect(12, 23, 5, 10);
    g.fillRect(20, 24, 5, 9);
    // Knee detail
    g.fillStyle(darken(body, 0.1));
    g.fillRect(13, 28, 3, 1);
    g.fillRect(21, 29, 3, 1);
    // Boots
    g.fillStyle(boots);
    g.fillRect(11, 33, 7, 3);
    g.fillRect(19, 33, 7, 3);
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(11, 33, 7, 1);
    g.fillRect(19, 33, 7, 1);
    g.generateTexture("soldier_die_1", W, H);
    g.destroy();
  }

  // DIE 2 — Ragdolling backward, airborne
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Body nearly horizontal, shifted right and up
    g.fillStyle(body);
    g.fillRect(16, 7, 10, 4); // Hood/head
    g.fillStyle(lighten(body, 0.1));
    g.fillRect(16, 7, 10, 1);
    g.fillStyle(visor);
    g.fillRect(24, 9, 4, 1);
    g.fillStyle(lighten(visor, 0.3));
    g.fillRect(24, 9, 1, 1);
    // Torso wide
    g.fillStyle(body);
    g.fillRect(8, 11, 18, 8);
    g.fillStyle(lighten(body, 0.12));
    g.fillRect(8, 11, 2, 8);
    g.fillStyle(darken(body, 0.15));
    g.fillRect(24, 11, 2, 8);
    // Purple accent
    g.fillStyle(PALETTE.purple);
    g.fillRect(16, 13, 3, 5);
    // Glitch artifact
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(10, 15, 14, 1);
    // Belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(8, 18, 18, 1);
    // Arms dangling
    g.fillStyle(body);
    g.fillRect(2, 15, 5, 4);
    g.fillRect(27, 10, 4, 4);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(1, 17, 3, 2);
    g.fillRect(29, 10, 2, 2);
    // Legs splayed
    g.fillStyle(body);
    g.fillRect(9, 19, 5, 9);
    g.fillRect(19, 20, 5, 7);
    // Boots
    g.fillStyle(boots);
    g.fillRect(8, 27, 6, 3);
    g.fillRect(18, 26, 6, 3);
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(8, 27, 6, 1);
    g.fillRect(18, 26, 6, 1);
    g.generateTexture("soldier_die_2", W, H);
    g.destroy();
  }

  // DIE 3 — Crumpling, lower position
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Compact crumpled body
    g.fillStyle(body);
    g.fillRect(8, 23, 16, 7); // Collapsed torso
    g.fillStyle(lighten(body, 0.1));
    g.fillRect(8, 23, 2, 7);
    g.fillStyle(darken(body, 0.15));
    g.fillRect(22, 23, 2, 7);
    // Head area
    g.fillStyle(body);
    g.fillRect(10, 20, 12, 4);
    g.fillStyle(visor);
    g.fillRect(19, 21, 4, 1);
    g.fillStyle(lighten(visor, 0.2));
    g.fillRect(19, 21, 1, 1);
    // Purple accent
    g.fillStyle(PALETTE.purple);
    g.fillRect(15, 24, 3, 4);
    // Glitch decay
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(10, 26, 6, 1);
    // Limbs folded
    g.fillStyle(body);
    g.fillRect(3, 26, 5, 4);
    g.fillRect(24, 25, 5, 4);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(3, 29, 3, 2);
    g.fillRect(27, 28, 3, 2);
    // Boots visible
    g.fillStyle(boots);
    g.fillRect(6, 30, 6, 3);
    g.fillRect(20, 30, 7, 3);
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(6, 30, 6, 1);
    g.fillRect(20, 30, 7, 1);
    g.generateTexture("soldier_die_3", W, H);
    g.destroy();
  }

  // DIE 4 — Flat on ground
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Horizontal body at bottom
    g.fillStyle(body);
    g.fillRect(2, 31, 28, 5);
    g.fillStyle(lighten(body, 0.1));
    g.fillRect(2, 31, 28, 1);
    g.fillStyle(darken(body, 0.15));
    g.fillRect(2, 35, 28, 1);
    // Head end
    g.fillStyle(PALETTE.void);
    g.fillRect(25, 31, 5, 3);
    g.fillStyle(visor);
    g.fillRect(26, 33, 3, 1);
    g.fillStyle(lighten(visor, 0.2));
    g.fillRect(26, 33, 1, 1);
    // Boots end
    g.fillStyle(boots);
    g.fillRect(2, 34, 6, 3);
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(2, 34, 6, 1);
    // Purple accent
    g.fillStyle(PALETTE.purple);
    g.fillRect(13, 32, 3, 3);
    // Glitch decay
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(8, 33, 4, 1);
    // Belt buckle visible
    g.fillStyle(PALETTE.midGray);
    g.fillRect(18, 33, 2, 1);
    g.generateTexture("soldier_die_4", W, H);
    g.destroy();
  }
}

// --- Heavy → "Rogue Bot" (40x40): Bulky robot, no exposed skin ---

function generateHeavySprites(scene: Phaser.Scene): void {
  const W = 40;
  const H = 40;
  const armor = PALETTE.gray;
  const visor = PALETTE.brightRed;
  const boots = PALETTE.darkGray;
  const outlineColor = darken(armor, 0.5);

  function drawHeavyBase(g: Phaser.GameObjects.Graphics, legOffsetL: number, legOffsetR: number) {
    // --- 1px outline silhouette ---
    g.fillStyle(outlineColor);
    g.fillRect(12, 0, 16, 9); // Helmet outline
    g.fillRect(7, 8, 26, 16); // Body outline
    g.fillRect(10 + legOffsetL, 22, 9, 13); // Left leg outline
    g.fillRect(21 + legOffsetR, 22, 9, 13); // Right leg outline

    // Helmet 14x8
    g.fillStyle(armor);
    g.fillRect(13, 0, 14, 8);
    // Helmet left highlight
    g.fillStyle(lighten(armor, 0.18));
    g.fillRect(13, 0, 2, 8);
    // Helmet right shadow
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(25, 0, 2, 8);
    // Helmet top ridge
    g.fillStyle(lighten(armor, 0.25));
    g.fillRect(13, 0, 14, 1);
    // Antenna nub
    g.fillStyle(PALETTE.midGray);
    g.fillRect(24, 0, 3, 1);
    g.fillStyle(lighten(PALETTE.midGray, 0.2));
    g.fillRect(24, 0, 1, 1);

    // Exhaust vents on back of helmet (dark slits)
    g.fillStyle(darken(armor, 0.4));
    g.fillRect(13, 1, 3, 1);
    g.fillRect(13, 3, 3, 1);
    g.fillRect(13, 5, 3, 1);

    // Green status LED
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(26, 1, 1, 1);
    // Secondary amber LED
    g.fillStyle(PALETTE.yellow);
    g.fillRect(26, 3, 1, 1);

    // Visor with corner highlight
    g.fillStyle(visor);
    g.fillRect(16, 4, 8, 3);
    g.fillStyle(lighten(visor, 0.35));
    g.fillRect(16, 4, 2, 1); // Highlight corner
    g.fillStyle(darken(visor, 0.2));
    g.fillRect(22, 6, 2, 1); // Shadow corner
    // Visor scanline
    g.fillStyle(darken(visor, 0.15));
    g.fillRect(16, 5, 8, 1);

    // Body (wider) with layered shading
    g.fillStyle(armor);
    g.fillRect(8, 8, 24, 15);
    // Left edge highlight
    g.fillStyle(lighten(armor, 0.15));
    g.fillRect(8, 8, 2, 15);
    // Right edge shadow
    g.fillStyle(darken(armor, 0.25));
    g.fillRect(30, 8, 2, 15);
    // Upper body lighter
    g.fillStyle(lighten(armor, 0.06));
    g.fillRect(10, 8, 20, 4);

    // Damage weathering: scattered 1px darker scratch marks on armor
    g.fillStyle(darken(armor, 0.35));
    g.fillRect(11, 10, 1, 1);
    g.fillRect(19, 9, 1, 1);
    g.fillRect(28, 12, 1, 1);
    g.fillRect(12, 18, 1, 1);
    g.fillRect(26, 17, 1, 1);
    g.fillRect(15, 14, 1, 1);
    g.fillRect(24, 11, 1, 1);

    // Chest plate detail with grid lines
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(14, 10, 12, 8);
    // Grid lines
    g.fillStyle(darken(PALETTE.darkGray, 0.18));
    g.fillRect(19, 10, 1, 8); // Vertical grid center
    g.fillRect(16, 10, 1, 8); // Vertical grid left
    g.fillRect(23, 10, 1, 8); // Vertical grid right
    g.fillRect(14, 13, 12, 1); // Horizontal grid mid
    g.fillRect(14, 16, 12, 1); // Horizontal grid lower

    // Rivet dots at armor plate corners
    g.fillStyle(lighten(PALETTE.darkGray, 0.3));
    g.fillRect(14, 10, 1, 1);
    g.fillRect(25, 10, 1, 1);
    g.fillRect(14, 17, 1, 1);
    g.fillRect(25, 17, 1, 1);
    // Additional rivets at grid intersections
    g.fillRect(19, 10, 1, 1);
    g.fillRect(19, 17, 1, 1);
    g.fillRect(14, 13, 1, 1);
    g.fillRect(25, 13, 1, 1);

    // Reactor core glow (red center with aura)
    g.fillStyle(PALETTE.brightRed, 0.4);
    g.fillRect(18, 13, 4, 4); // Glow aura
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(19, 14, 2, 2); // Core
    g.fillStyle(lighten(PALETTE.brightRed, 0.3));
    g.fillRect(19, 14, 1, 1); // Core highlight

    // 3-LED status array on chest
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(27, 11, 1, 1);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(27, 13, 1, 1);
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(27, 15, 1, 1);

    // Secondary LED array on left
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(11, 12, 1, 1);
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(11, 14, 1, 1);

    // Belt (mechanical joint)
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(8, 22, 24, 2);
    g.fillStyle(lighten(PALETTE.darkGray, 0.15));
    g.fillRect(8, 22, 24, 1);
    // Belt rivets
    g.fillStyle(PALETTE.midGray);
    g.fillRect(12, 22, 1, 1);
    g.fillRect(18, 22, 1, 1);
    g.fillRect(24, 22, 1, 1);

    // Legs (thick, armored)
    g.fillStyle(armor);
    g.fillRect(11 + legOffsetL, 24, 7, 10);
    g.fillRect(22 + legOffsetR, 24, 7, 10);
    // Leg shading
    g.fillStyle(lighten(armor, 0.1));
    g.fillRect(11 + legOffsetL, 24, 1, 10);
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(17 + legOffsetL, 24, 1, 10);
    g.fillStyle(lighten(armor, 0.1));
    g.fillRect(22 + legOffsetR, 24, 1, 10);
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(28 + legOffsetR, 24, 1, 10);

    // Hydraulic piston detail at knee area
    g.fillStyle(PALETTE.silver);
    g.fillRect(11 + legOffsetL, 28, 3, 1);
    g.fillRect(22 + legOffsetR, 28, 3, 1);
    // Second piston
    g.fillStyle(darken(PALETTE.silver, 0.2));
    g.fillRect(15 + legOffsetL, 29, 2, 1);
    g.fillRect(26 + legOffsetR, 29, 2, 1);

    // Leg armor plate detail
    g.fillStyle(darken(armor, 0.1));
    g.fillRect(12 + legOffsetL, 26, 5, 1);
    g.fillRect(23 + legOffsetR, 26, 5, 1);

    // Boots (massive)
    g.fillStyle(boots);
    g.fillRect(10 + legOffsetL, 34, 8, 4);
    g.fillRect(21 + legOffsetR, 34, 8, 4);
    // Boot highlights
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(10 + legOffsetL, 34, 8, 1);
    g.fillRect(21 + legOffsetR, 34, 8, 1);
    // Boot soles
    g.fillStyle(darken(boots, 0.3));
    g.fillRect(10 + legOffsetL, 37, 8, 1);
    g.fillRect(21 + legOffsetR, 37, 8, 1);
    // Boot treads
    g.fillStyle(darken(boots, 0.15));
    g.fillRect(12 + legOffsetL, 36, 1, 1);
    g.fillRect(15 + legOffsetL, 36, 1, 1);
    g.fillRect(23 + legOffsetR, 36, 1, 1);
    g.fillRect(26 + legOffsetR, 36, 1, 1);
  }

  // IDLE 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 0, 0);
    // Arms (thick, robot hands)
    g.fillStyle(armor);
    g.fillRect(2, 9, 6, 10);
    g.fillRect(32, 9, 6, 10);
    // Arm shading
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(2, 9, 1, 10);
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(37, 9, 1, 10);
    // Robot hands
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 19, 6, 3);
    g.fillRect(32, 19, 6, 3);
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(2, 19, 6, 1);
    g.fillRect(32, 19, 6, 1);
    // Shoulder bolts
    g.fillStyle(PALETTE.silver);
    g.fillRect(5, 9, 2, 2);
    g.fillRect(33, 9, 2, 2);
    g.generateTexture("heavy_idle", W, H);
    g.destroy();
  }

  // IDLE 2 (mechanical breathing — arms shift 1px, reactor flickers)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 0, 0);
    // Arms at y+1
    g.fillStyle(armor);
    g.fillRect(2, 10, 6, 10);
    g.fillRect(32, 10, 6, 10);
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(2, 10, 1, 10);
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(37, 10, 1, 10);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 20, 6, 3);
    g.fillRect(32, 20, 6, 3);
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(2, 20, 6, 1);
    g.fillRect(32, 20, 6, 1);
    // Shoulder bolts
    g.fillStyle(PALETTE.silver);
    g.fillRect(5, 10, 2, 2);
    g.fillRect(33, 10, 2, 2);
    // Reactor flicker (dimmer)
    g.fillStyle(darken(visor, 0.3));
    g.fillRect(19, 14, 2, 2);
    g.generateTexture("heavy_idle_2", W, H);
    g.destroy();
  }

  // IDLE 3 (reactor pulse — bright core, vent steam)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 0, 0);
    // Arms normal
    g.fillStyle(armor);
    g.fillRect(2, 9, 6, 10);
    g.fillRect(32, 9, 6, 10);
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(2, 9, 1, 10);
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(37, 9, 1, 10);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 19, 6, 3);
    g.fillRect(32, 19, 6, 3);
    // Shoulder bolts
    g.fillStyle(PALETTE.silver);
    g.fillRect(5, 9, 2, 2);
    g.fillRect(33, 9, 2, 2);
    // Reactor bright pulse
    g.fillStyle(PALETTE.brightRed, 0.6);
    g.fillRect(17, 12, 6, 6);
    g.fillStyle(lighten(PALETTE.brightRed, 0.4));
    g.fillRect(19, 14, 2, 2);
    g.fillStyle(PALETTE.white, 0.5);
    g.fillRect(19, 14, 1, 1);
    // Vent steam from helmet
    g.fillStyle(PALETTE.lightGray, 0.4);
    g.fillRect(12, 0, 2, 1);
    g.fillRect(11, -1, 1, 1);
    g.generateTexture("heavy_idle_3", W, H);
    g.destroy();
  }

  // WALK 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, -2, 2);
    g.fillStyle(armor);
    g.fillRect(2, 9, 6, 10);
    g.fillRect(32, 10, 6, 10);
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(2, 9, 1, 10);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 19, 6, 3);
    g.fillRect(32, 20, 6, 3);
    g.fillStyle(PALETTE.silver);
    g.fillRect(5, 9, 2, 2);
    g.fillRect(33, 10, 2, 2);
    g.generateTexture("heavy_walk_1", W, H);
    g.destroy();
  }

  // WALK 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, -1, 1);
    g.fillStyle(armor);
    g.fillRect(2, 10, 6, 10);
    g.fillRect(32, 9, 6, 10);
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(37, 9, 1, 10);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 20, 6, 3);
    g.fillRect(32, 19, 6, 3);
    g.fillStyle(PALETTE.silver);
    g.fillRect(5, 10, 2, 2);
    g.fillRect(33, 9, 2, 2);
    g.generateTexture("heavy_walk_2", W, H);
    g.destroy();
  }

  // WALK 3
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 2, -2);
    g.fillStyle(armor);
    g.fillRect(2, 10, 6, 10);
    g.fillRect(32, 9, 6, 10);
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(2, 10, 1, 10);
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(37, 9, 1, 10);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 20, 6, 3);
    g.fillRect(32, 19, 6, 3);
    g.fillStyle(PALETTE.silver);
    g.fillRect(5, 10, 2, 2);
    g.fillRect(33, 9, 2, 2);
    g.generateTexture("heavy_walk_3", W, H);
    g.destroy();
  }

  // WALK 4
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 1, -1);
    g.fillStyle(armor);
    g.fillRect(2, 9, 6, 10);
    g.fillRect(32, 10, 6, 10);
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(2, 9, 1, 10);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 19, 6, 3);
    g.fillRect(32, 20, 6, 3);
    g.fillStyle(PALETTE.silver);
    g.fillRect(5, 9, 2, 2);
    g.fillRect(33, 10, 2, 2);
    g.generateTexture("heavy_walk_4", W, H);
    g.destroy();
  }

  // SHOOT (rocket launcher extended with ammo belt)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHeavyBase(g, 0, 0);
    // Left arm supporting
    g.fillStyle(armor);
    g.fillRect(2, 9, 6, 10);
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(2, 9, 1, 10);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 19, 6, 3);
    // Shoulder bolt
    g.fillStyle(PALETTE.silver);
    g.fillRect(5, 9, 2, 2);
    // Right arm with rocket launcher
    g.fillStyle(armor);
    g.fillRect(32, 9, 5, 5);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(37, 9, 3, 5);
    // Rocket launcher tube
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(34, 7, 6, 4);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(34, 7, 6, 1);
    g.fillStyle(darken(PALETTE.darkGray, 0.2));
    g.fillRect(34, 10, 6, 1);
    // Launcher detail - heat vents
    g.fillStyle(darken(PALETTE.darkGray, 0.3));
    g.fillRect(36, 8, 1, 2);
    g.fillRect(38, 8, 1, 2);
    // Ammo belt from launcher to chest
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(32, 14, 2, 1);
    g.fillRect(31, 15, 2, 1);
    g.fillRect(30, 16, 2, 1);
    g.fillRect(29, 17, 2, 1);
    // Ammo belt bullet details
    g.fillStyle(PALETTE.silver);
    g.fillRect(32, 14, 1, 1);
    g.fillRect(30, 16, 1, 1);
    g.generateTexture("heavy_shoot", W, H);
    g.destroy();
  }

  // --- Death sequence (4 frames) ---

  // DIE 1 — Hit jolt, sparks from joints
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Helmet jolted right
    g.fillStyle(armor);
    g.fillRect(16, 1, 14, 7);
    g.fillStyle(lighten(armor, 0.15));
    g.fillRect(16, 1, 14, 1);
    g.fillStyle(visor);
    g.fillRect(19, 4, 8, 3);
    g.fillStyle(lighten(visor, 0.3));
    g.fillRect(19, 4, 2, 1);
    // Body shifted right
    g.fillStyle(armor);
    g.fillRect(11, 9, 22, 14);
    g.fillStyle(lighten(armor, 0.12));
    g.fillRect(11, 9, 2, 14);
    g.fillStyle(darken(armor, 0.2));
    g.fillRect(31, 9, 2, 14);
    // Chest plate
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(17, 12, 12, 7);
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(22, 15, 2, 2);
    // Arms thrown out
    g.fillStyle(armor);
    g.fillRect(1, 11, 7, 8);
    g.fillRect(34, 9, 6, 6);
    // Sparks at joints
    g.fillStyle(PALETTE.yellow);
    g.fillRect(8, 10, 3, 3);
    g.fillRect(33, 12, 3, 3);
    g.fillStyle(PALETTE.white);
    g.fillRect(9, 11, 1, 1);
    g.fillRect(34, 13, 1, 1);
    // Legs
    g.fillStyle(armor);
    g.fillRect(14, 23, 7, 9);
    g.fillRect(25, 24, 7, 8);
    g.fillStyle(boots);
    g.fillRect(13, 32, 8, 4);
    g.fillRect(24, 32, 8, 4);
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(13, 32, 8, 1);
    g.fillRect(24, 32, 8, 1);
    g.generateTexture("heavy_die_1", W, H);
    g.destroy();
  }

  // DIE 2 — Parts separating, antenna flying off
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Helmet detached, flying up-right
    g.fillStyle(armor);
    g.fillRect(23, 0, 10, 5);
    g.fillStyle(lighten(armor, 0.15));
    g.fillRect(23, 0, 10, 1);
    g.fillStyle(visor);
    g.fillRect(24, 1, 7, 3);
    // Antenna piece separate
    g.fillStyle(PALETTE.midGray);
    g.fillRect(35, 0, 3, 1);
    // Body cracking
    g.fillStyle(armor);
    g.fillRect(10, 10, 20, 13);
    g.fillStyle(lighten(armor, 0.1));
    g.fillRect(10, 10, 2, 13);
    g.fillStyle(darken(armor, 0.2));
    g.fillRect(28, 10, 2, 13);
    // Chest plate
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(15, 13, 10, 6);
    // Reactor exposed/sparking
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(18, 14, 4, 4);
    g.fillStyle(lighten(PALETTE.brightRed, 0.3));
    g.fillRect(19, 15, 2, 2);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(16, 13, 2, 1);
    g.fillRect(22, 16, 2, 1);
    g.fillStyle(PALETTE.white);
    g.fillRect(17, 13, 1, 1);
    // Arms dangling
    g.fillStyle(armor);
    g.fillRect(3, 15, 5, 7);
    g.fillRect(31, 12, 5, 7);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(3, 21, 5, 2);
    g.fillRect(31, 18, 5, 2);
    // Legs buckling
    g.fillStyle(armor);
    g.fillRect(12, 23, 7, 8);
    g.fillRect(24, 24, 7, 7);
    g.fillStyle(boots);
    g.fillRect(11, 31, 8, 4);
    g.fillRect(23, 31, 8, 4);
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(11, 31, 8, 1);
    g.fillRect(23, 31, 8, 1);
    g.generateTexture("heavy_die_2", W, H);
    g.destroy();
  }

  // DIE 3 — Collapsing, lower
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Compact wreckage
    g.fillStyle(armor);
    g.fillRect(7, 20, 24, 10);
    g.fillStyle(lighten(armor, 0.1));
    g.fillRect(7, 20, 2, 10);
    g.fillStyle(darken(armor, 0.2));
    g.fillRect(29, 20, 2, 10);
    // Chest plate debris
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(13, 23, 10, 5);
    // Reactor dimming
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(17, 24, 3, 3);
    g.fillStyle(darken(PALETTE.brightRed, 0.3));
    g.fillRect(18, 25, 1, 1);
    // Helmet piece nearby
    g.fillStyle(armor);
    g.fillRect(26, 17, 8, 4);
    g.fillStyle(lighten(armor, 0.1));
    g.fillRect(26, 17, 8, 1);
    g.fillStyle(visor);
    g.fillRect(27, 19, 4, 1);
    // Scattered arm parts
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 25, 4, 4);
    g.fillRect(33, 23, 4, 4);
    // Boots visible
    g.fillStyle(boots);
    g.fillRect(8, 30, 7, 4);
    g.fillRect(24, 30, 7, 4);
    g.fillStyle(lighten(boots, 0.15));
    g.fillRect(8, 30, 7, 1);
    g.fillRect(24, 30, 7, 1);
    // Sparks
    g.fillStyle(PALETTE.yellow);
    g.fillRect(15, 22, 2, 1);
    g.fillStyle(PALETTE.orange);
    g.fillRect(23, 21, 1, 1);
    g.generateTexture("heavy_die_3", W, H);
    g.destroy();
  }

  // DIE 4 — Wreckage pile
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Flat scrap pile at bottom
    g.fillStyle(armor);
    g.fillRect(5, 30, 30, 7);
    g.fillStyle(lighten(armor, 0.08));
    g.fillRect(5, 30, 30, 1);
    g.fillStyle(darken(armor, 0.15));
    g.fillRect(5, 36, 30, 1);
    // Chest plate debris
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(10, 32, 14, 4);
    // Scraped edges
    g.fillStyle(darken(armor, 0.3));
    g.fillRect(7, 29, 8, 2);
    g.fillRect(23, 29, 7, 2);
    // Visor shard
    g.fillStyle(visor);
    g.fillRect(26, 31, 3, 1);
    g.fillStyle(darken(visor, 0.3));
    g.fillRect(28, 31, 1, 1);
    // Dim reactor
    g.fillStyle(darken(PALETTE.brightRed, 0.5));
    g.fillRect(17, 32, 3, 3);
    // Scattered bolts
    g.fillStyle(PALETTE.silver);
    g.fillRect(12, 31, 1, 1);
    g.fillRect(22, 33, 1, 1);
    g.fillRect(8, 34, 1, 1);
    // Smoke wisp
    g.fillStyle(PALETTE.midGray, 0.4);
    g.fillRect(18, 29, 2, 2);
    g.generateTexture("heavy_die_4", W, H);
    g.destroy();
  }
}

// --- Turret → "Glitch Turret" (30x30): Brick base with larger gun housing ---

function generateTurretSprites(scene: Phaser.Scene): void {
  const W = 30;
  const H = 30;
  const metal = PALETTE.midGray;
  const darkMetal = PALETTE.gray;
  const brick = 0x2a1a3e;
  const outlineColor = darken(metal, 0.5);

  function drawTurretBase(g: Phaser.GameObjects.Graphics) {
    // --- 1px outline around gun housing and base ---
    g.fillStyle(outlineColor);
    g.fillRect(0, 16, 30, 14); // Base outline
    g.fillRect(8, 8, 14, 9); // Pedestal outline

    // Brick wall base
    g.fillStyle(brick);
    g.fillRect(1, 17, 28, 13);
    // 3D edges: lighten left, darken right
    g.fillStyle(lighten(brick, 0.18));
    g.fillRect(1, 17, 2, 13);
    g.fillStyle(darken(brick, 0.22));
    g.fillRect(27, 17, 2, 13);
    // Top edge highlight
    g.fillStyle(lighten(brick, 0.1));
    g.fillRect(1, 17, 28, 1);

    // Enhanced brick mortar with depth (alternating lighter/darker bricks)
    g.fillStyle(darken(brick, 0.25));
    // Horizontal mortar lines
    g.fillRect(1, 21, 28, 1);
    g.fillRect(1, 25, 28, 1);
    // Vertical mortar lines
    g.fillRect(7, 17, 1, 13);
    g.fillRect(14, 17, 1, 13);
    g.fillRect(21, 17, 1, 13);

    // Lighter bricks for depth variation
    g.fillStyle(lighten(brick, 0.12));
    g.fillRect(3, 18, 3, 3);
    g.fillRect(16, 22, 4, 3);
    g.fillRect(8, 26, 5, 2);
    g.fillRect(22, 18, 4, 2);

    // Darker bricks for depth variation
    g.fillStyle(darken(brick, 0.12));
    g.fillRect(9, 18, 4, 3);
    g.fillRect(3, 22, 3, 3);
    g.fillRect(24, 26, 3, 2);
    g.fillRect(15, 26, 3, 2);

    // Brick damage/weathering detail
    g.fillStyle(darken(brick, 0.35));
    g.fillRect(5, 19, 1, 1);
    g.fillRect(18, 24, 1, 1);
    g.fillRect(11, 27, 1, 1);

    // Green LED power indicator
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(4, 19, 1, 1);
    // Secondary amber LED
    g.fillStyle(PALETTE.yellow);
    g.fillRect(4, 23, 1, 1);

    // Metal pedestal with detail
    g.fillStyle(darkMetal);
    g.fillRect(9, 9, 12, 8);
    // Pedestal highlight
    g.fillStyle(lighten(metal, 0.18));
    g.fillRect(9, 9, 2, 8);
    // Pedestal shadow
    g.fillStyle(darken(darkMetal, 0.15));
    g.fillRect(19, 9, 2, 8);
    // Pedestal top edge
    g.fillStyle(lighten(metal, 0.1));
    g.fillRect(9, 9, 12, 1);
    // Rivet on pedestal
    g.fillStyle(lighten(darkMetal, 0.25));
    g.fillRect(10, 11, 1, 1);
    g.fillRect(19, 11, 1, 1);
    g.fillRect(10, 15, 1, 1);
    g.fillRect(19, 15, 1, 1);
  }

  // IDLE 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun housing
    g.fillStyle(metal);
    g.fillRect(12, 6, 6, 6);
    g.fillStyle(lighten(metal, 0.15));
    g.fillRect(12, 6, 6, 1);
    g.fillStyle(darken(metal, 0.1));
    g.fillRect(12, 11, 6, 1);
    // Barrel
    g.fillStyle(darkMetal);
    g.fillRect(18, 8, 8, 3);
    g.fillStyle(lighten(metal, 0.22));
    g.fillRect(18, 8, 8, 1);
    g.fillStyle(darken(darkMetal, 0.15));
    g.fillRect(18, 10, 8, 1);
    // Barrel rifling (ring lines)
    g.fillStyle(darken(darkMetal, 0.25));
    g.fillRect(20, 8, 1, 3);
    g.fillRect(23, 8, 1, 3);
    g.fillRect(25, 8, 1, 3);
    // Ammo belt: small rectangles from housing to base
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(12, 12, 3, 1);
    g.fillRect(11, 13, 3, 1);
    g.fillRect(10, 14, 3, 1);
    g.fillRect(9, 15, 3, 1);
    // Ammo belt bullet details
    g.fillStyle(PALETTE.silver);
    g.fillRect(12, 12, 1, 1);
    g.fillRect(10, 14, 1, 1);
    // Housing rivets
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(12, 7, 1, 1);
    g.fillRect(17, 7, 1, 1);
    g.generateTexture("turret_idle", W, H);
    g.destroy();
  }

  // IDLE 2 (barrel tracking wobble — shifted 1px up)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun housing shifted up 1px
    g.fillStyle(metal);
    g.fillRect(12, 5, 6, 6);
    g.fillStyle(lighten(metal, 0.15));
    g.fillRect(12, 5, 6, 1);
    g.fillStyle(darken(metal, 0.1));
    g.fillRect(12, 10, 6, 1);
    // Barrel shifted up 1px
    g.fillStyle(darkMetal);
    g.fillRect(18, 7, 8, 3);
    g.fillStyle(lighten(metal, 0.22));
    g.fillRect(18, 7, 8, 1);
    g.fillStyle(darken(darkMetal, 0.15));
    g.fillRect(18, 9, 8, 1);
    // Barrel rifling
    g.fillStyle(darken(darkMetal, 0.25));
    g.fillRect(20, 7, 1, 3);
    g.fillRect(23, 7, 1, 3);
    g.fillRect(25, 7, 1, 3);
    // Ammo belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(12, 11, 3, 1);
    g.fillRect(11, 12, 3, 1);
    g.fillRect(10, 13, 3, 1);
    g.fillRect(9, 14, 3, 1);
    g.fillStyle(PALETTE.silver);
    g.fillRect(12, 11, 1, 1);
    g.fillRect(10, 13, 1, 1);
    // LED flicker (dim)
    g.fillStyle(darken(PALETTE.bagsGreen, 0.4));
    g.fillRect(4, 19, 1, 1);
    // Housing rivets
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(12, 6, 1, 1);
    g.fillRect(17, 6, 1, 1);
    g.generateTexture("turret_idle_2", W, H);
    g.destroy();
  }

  // IDLE 3 (barrel tracking sweep — shifted 1px down)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun housing shifted down 1px
    g.fillStyle(metal);
    g.fillRect(12, 7, 6, 6);
    g.fillStyle(lighten(metal, 0.15));
    g.fillRect(12, 7, 6, 1);
    g.fillStyle(darken(metal, 0.1));
    g.fillRect(12, 12, 6, 1);
    // Barrel shifted down 1px
    g.fillStyle(darkMetal);
    g.fillRect(18, 9, 8, 3);
    g.fillStyle(lighten(metal, 0.22));
    g.fillRect(18, 9, 8, 1);
    g.fillStyle(darken(darkMetal, 0.15));
    g.fillRect(18, 11, 8, 1);
    // Barrel rifling
    g.fillStyle(darken(darkMetal, 0.25));
    g.fillRect(20, 9, 1, 3);
    g.fillRect(23, 9, 1, 3);
    g.fillRect(25, 9, 1, 3);
    // Ammo belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(12, 13, 3, 1);
    g.fillRect(11, 14, 3, 1);
    g.fillRect(10, 15, 3, 1);
    g.fillRect(9, 16, 3, 1);
    g.fillStyle(PALETTE.silver);
    g.fillRect(12, 13, 1, 1);
    g.fillRect(10, 15, 1, 1);
    // Targeting laser hint (faint red dot)
    g.fillStyle(PALETTE.brightRed, 0.5);
    g.fillRect(26, 10, 1, 1);
    // LED bright pulse
    g.fillStyle(lighten(PALETTE.bagsGreen, 0.3));
    g.fillRect(4, 19, 1, 1);
    // Housing rivets
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(12, 8, 1, 1);
    g.fillRect(17, 8, 1, 1);
    g.generateTexture("turret_idle_3", W, H);
    g.destroy();
  }

  // SHOOT (muzzle flash + targeting laser)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawTurretBase(g);
    // Gun housing
    g.fillStyle(metal);
    g.fillRect(12, 6, 6, 6);
    g.fillStyle(lighten(metal, 0.15));
    g.fillRect(12, 6, 6, 1);
    g.fillStyle(darken(metal, 0.1));
    g.fillRect(12, 11, 6, 1);
    // Barrel
    g.fillStyle(darkMetal);
    g.fillRect(18, 8, 8, 3);
    g.fillStyle(lighten(metal, 0.22));
    g.fillRect(18, 8, 8, 1);
    g.fillStyle(darken(darkMetal, 0.15));
    g.fillRect(18, 10, 8, 1);
    // Barrel rifling
    g.fillStyle(darken(darkMetal, 0.25));
    g.fillRect(20, 8, 1, 3);
    g.fillRect(23, 8, 1, 3);
    g.fillRect(25, 8, 1, 3);
    // Ammo belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(12, 12, 3, 1);
    g.fillRect(11, 13, 3, 1);
    g.fillRect(10, 14, 3, 1);
    g.fillRect(9, 15, 3, 1);
    g.fillStyle(PALETTE.silver);
    g.fillRect(12, 12, 1, 1);
    g.fillRect(10, 14, 1, 1);
    // Targeting laser (red line from barrel tip)
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(26, 9, 4, 1);
    // Muzzle flash
    g.fillStyle(PALETTE.yellow);
    g.fillRect(26, 6, 4, 5);
    g.fillStyle(PALETTE.white);
    g.fillRect(27, 7, 2, 3);
    // Housing rivets
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(12, 7, 1, 1);
    g.fillRect(17, 7, 1, 1);
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
    g.fillRect(12, 4, 6, 5);
    g.fillStyle(lighten(metal, 0.15));
    g.fillRect(12, 4, 6, 1);
    g.fillStyle(darkMetal);
    g.fillRect(18, 4, 7, 3);
    // Housing rivets popping
    g.fillStyle(PALETTE.silver);
    g.fillRect(11, 8, 1, 1);
    g.fillRect(19, 3, 1, 1);
    // Sparks
    g.fillStyle(PALETTE.yellow);
    g.fillRect(10, 8, 2, 3);
    g.fillStyle(PALETTE.orange);
    g.fillRect(20, 3, 3, 2);
    g.fillStyle(PALETTE.white);
    g.fillRect(11, 9, 1, 1);
    g.fillRect(21, 3, 1, 1);
    // LED flickering
    g.fillStyle(darken(PALETTE.bagsGreen, 0.5));
    g.fillRect(4, 19, 1, 1);
    g.generateTexture("turret_die_1", W, H);
    g.destroy();
  }

  // DIE 2 — Barrel flying off, base cracking
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Cracked base
    g.fillStyle(brick);
    g.fillRect(1, 17, 28, 13);
    g.fillStyle(lighten(brick, 0.15));
    g.fillRect(1, 17, 2, 13);
    g.fillStyle(darken(brick, 0.2));
    g.fillRect(27, 17, 2, 13);
    // Mortar lines
    g.fillStyle(darken(brick, 0.35));
    g.fillRect(1, 21, 28, 1);
    g.fillRect(1, 25, 28, 1);
    // Crack down center
    g.fillRect(13, 17, 2, 13);
    // Crack branches
    g.fillRect(11, 20, 2, 1);
    g.fillRect(16, 24, 2, 1);
    // Damaged pedestal
    g.fillStyle(darkMetal);
    g.fillRect(9, 12, 12, 5);
    g.fillStyle(darken(darkMetal, 0.2));
    g.fillRect(14, 12, 2, 5);
    // Barrel flying up
    g.fillStyle(darkMetal);
    g.fillRect(15, 2, 8, 3);
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(15, 2, 8, 1);
    // Gun housing cracked
    g.fillStyle(metal);
    g.fillRect(12, 9, 6, 4);
    g.fillStyle(darken(metal, 0.3));
    g.fillRect(14, 10, 1, 2);
    // Fire/sparks
    g.fillStyle(PALETTE.orange);
    g.fillRect(11, 8, 4, 3);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(18, 5, 3, 3);
    g.fillStyle(PALETTE.white);
    g.fillRect(12, 9, 1, 1);
    g.fillRect(19, 6, 1, 1);
    g.generateTexture("turret_die_2", W, H);
    g.destroy();
  }

  // DIE 3 — Exploding apart
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Scattered brick pieces
    g.fillStyle(brick);
    g.fillRect(2, 20, 10, 8);
    g.fillRect(17, 21, 10, 7);
    g.fillStyle(lighten(brick, 0.1));
    g.fillRect(3, 21, 3, 3);
    g.fillRect(19, 22, 3, 2);
    g.fillStyle(darken(brick, 0.3));
    g.fillRect(6, 24, 5, 1);
    g.fillRect(20, 25, 5, 1);
    // Brick debris flying
    g.fillStyle(brick);
    g.fillRect(1, 14, 3, 2);
    g.fillRect(26, 12, 3, 2);
    // Metal fragments
    g.fillStyle(metal);
    g.fillRect(5, 12, 4, 4);
    g.fillRect(20, 9, 4, 4);
    g.fillStyle(darkMetal);
    g.fillRect(23, 3, 5, 3);
    g.fillRect(1, 6, 4, 3);
    // Sparks/fire
    g.fillStyle(PALETTE.orange);
    g.fillRect(12, 15, 6, 5);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(13, 16, 4, 3);
    g.fillStyle(PALETTE.white);
    g.fillRect(14, 17, 2, 1);
    // Flying bolt
    g.fillStyle(PALETTE.silver);
    g.fillRect(8, 5, 1, 1);
    g.fillRect(22, 7, 1, 1);
    g.generateTexture("turret_die_3", W, H);
    g.destroy();
  }

  // DIE 4 — Rubble pile
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Low rubble pile at bottom
    g.fillStyle(brick);
    g.fillRect(3, 23, 24, 7);
    g.fillStyle(lighten(brick, 0.1));
    g.fillRect(3, 23, 24, 1);
    g.fillStyle(darken(brick, 0.15));
    g.fillRect(3, 29, 24, 1);
    // Rubble top debris
    g.fillStyle(darken(brick, 0.3));
    g.fillRect(6, 22, 5, 2);
    g.fillRect(17, 22, 6, 2);
    g.fillStyle(lighten(brick, 0.12));
    g.fillRect(10, 25, 4, 2);
    g.fillRect(20, 26, 3, 2);
    // Metal scrap on top
    g.fillStyle(metal);
    g.fillRect(8, 22, 4, 3);
    g.fillRect(19, 24, 3, 2);
    g.fillStyle(darkMetal);
    g.fillRect(12, 21, 5, 3);
    // Smoke wisps
    g.fillStyle(PALETTE.midGray, 0.4);
    g.fillRect(14, 19, 3, 2);
    g.fillStyle(PALETTE.lightGray, 0.3);
    g.fillRect(15, 17, 2, 2);
    // Faint ember
    g.fillStyle(PALETTE.orange, 0.5);
    g.fillRect(11, 24, 1, 1);
    g.generateTexture("turret_die_4", W, H);
    g.destroy();
  }
}

// --- Boss → "Mega Mech" (80x80): Same tank design, BagsWorld palette ---

function generateBossSprites(scene: Phaser.Scene): void {
  const W = 80;
  const H = 80;
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
    g.fillRect(5, 60, 70, 18);
    // Tread top edge highlight
    g.fillStyle(lighten(tread, 0.18));
    g.fillRect(5, 60, 70, 1);
    // Tread bottom edge shadow
    g.fillStyle(darken(tread, 0.2));
    g.fillRect(5, 77, 70, 1);

    // Individual track links: alternate between two shades
    for (let i = 0; i < 9; i++) {
      const shade = i % 2 === 0 ? darken(tread, 0.3) : darken(tread, 0.15);
      g.fillStyle(shade);
      g.fillRect(8 + i * 8 + treadOffset, 62, 3, 14);
    }

    // Track link bolts
    g.fillStyle(lighten(tread, 0.1));
    for (let i = 0; i < 9; i++) {
      g.fillRect(9 + i * 8 + treadOffset, 64, 1, 1);
      g.fillRect(9 + i * 8 + treadOffset, 72, 1, 1);
    }

    // Wheels in treads (5 road wheels)
    g.fillStyle(PALETTE.midGray);
    g.fillRect(10, 65, 8, 8);
    g.fillRect(22, 65, 8, 8);
    g.fillRect(36, 65, 8, 8);
    g.fillRect(50, 65, 8, 8);
    g.fillRect(62, 65, 8, 8);
    // Wheel hub highlights
    g.fillStyle(lighten(PALETTE.midGray, 0.2));
    g.fillRect(13, 68, 2, 2);
    g.fillRect(25, 68, 2, 2);
    g.fillRect(39, 68, 2, 2);
    g.fillRect(53, 68, 2, 2);
    g.fillRect(65, 68, 2, 2);
    // Wheel shadow
    g.fillStyle(darken(PALETTE.midGray, 0.2));
    g.fillRect(10, 72, 8, 1);
    g.fillRect(22, 72, 8, 1);
    g.fillRect(36, 72, 8, 1);
    g.fillRect(50, 72, 8, 1);
    g.fillRect(62, 72, 8, 1);

    // Drive sprocket (front)
    g.fillStyle(PALETTE.midGray);
    g.fillRect(67, 62, 6, 6);
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(69, 63, 2, 2);
    // Idler wheel (rear)
    g.fillStyle(PALETTE.midGray);
    g.fillRect(7, 62, 6, 6);
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(9, 63, 2, 2);

    // Hull body
    g.fillStyle(hull);
    g.fillRect(10, 30, 60, 30);
    // Left highlight edge
    g.fillStyle(lighten(hull, 0.14));
    g.fillRect(10, 30, 2, 30);
    // Right shadow edge
    g.fillStyle(darken(hull, 0.22));
    g.fillRect(68, 30, 2, 30);
    // Hull top highlight
    g.fillStyle(lighten(hull, 0.08));
    g.fillRect(10, 30, 60, 2);
    // Hull bottom shadow
    g.fillStyle(darken(hull, 0.1));
    g.fillRect(10, 58, 60, 2);

    // Green accent stripe on hull
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(10, 58, 60, 1);

    // Rivets along hull top and bottom edges
    g.fillStyle(lighten(hull, 0.28));
    for (let i = 0; i < 8; i++) {
      g.fillRect(14 + i * 8, 30, 1, 1);
      g.fillRect(14 + i * 8, 59, 1, 1);
    }

    // Armor plating detail
    g.fillStyle(armorPlate);
    g.fillRect(15, 35, 50, 20);
    // Armor plate shading
    g.fillStyle(lighten(armorPlate, 0.08));
    g.fillRect(15, 35, 50, 2);
    g.fillStyle(darken(armorPlate, 0.08));
    g.fillRect(15, 53, 50, 2);
    // Plate division lines
    g.fillStyle(darken(armorPlate, 0.18));
    g.fillRect(15, 45, 50, 1);
    g.fillRect(40, 35, 1, 20);

    // Reactive armor plates: gap lines between armor sections
    g.fillStyle(darken(hull, 0.32));
    g.fillRect(15, 35, 50, 1); // Top gap
    g.fillRect(15, 54, 50, 1); // Bottom gap
    g.fillRect(15, 35, 1, 20); // Left gap
    g.fillRect(64, 35, 1, 20); // Right gap
    g.fillRect(27, 35, 1, 20); // Inner vertical gap left
    g.fillRect(52, 35, 1, 20); // Inner vertical gap right

    // Armor section detail - left panel
    g.fillStyle(lighten(armorPlate, 0.05));
    g.fillRect(17, 37, 9, 7);
    g.fillStyle(darken(armorPlate, 0.1));
    g.fillRect(17, 47, 9, 6);

    // Armor section detail - right panel
    g.fillStyle(lighten(armorPlate, 0.05));
    g.fillRect(54, 37, 9, 7);
    g.fillStyle(darken(armorPlate, 0.1));
    g.fillRect(54, 47, 9, 6);

    // Headlights at front of hull
    g.fillStyle(PALETTE.yellow, 0.35);
    g.fillRect(66, 36, 5, 5); // Glow aura top
    g.fillStyle(PALETTE.yellow, 0.35);
    g.fillRect(66, 49, 5, 5); // Glow aura bottom
    g.fillStyle(PALETTE.yellow);
    g.fillRect(67, 37, 3, 3); // Top headlight
    g.fillRect(67, 50, 3, 3); // Bottom headlight
    // Headlight highlight
    g.fillStyle(PALETTE.white);
    g.fillRect(67, 37, 1, 1);
    g.fillRect(67, 50, 1, 1);

    // Exhaust pipes on back of hull
    g.fillStyle(PALETTE.midGray);
    g.fillRect(10, 37, 4, 3); // Top exhaust pipe
    g.fillRect(10, 47, 4, 3); // Bottom exhaust pipe
    g.fillStyle(darken(PALETTE.midGray, 0.35));
    g.fillRect(11, 38, 2, 1); // Pipe interior darkness
    g.fillRect(11, 48, 2, 1);
    // Pipe rim highlight
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(10, 37, 4, 1);
    g.fillRect(10, 47, 4, 1);
    // Smoke pixels above pipes
    g.fillStyle(PALETTE.midGray, 0.45);
    g.fillRect(9, 36, 1, 1);
    g.fillRect(8, 35, 1, 1);
    g.fillRect(9, 46, 1, 1);
    g.fillRect(8, 45, 1, 1);

    if (phase2) {
      // Phase 2: additional smoke from exhaust
      g.fillStyle(PALETTE.lightGray, 0.35);
      g.fillRect(7, 34, 2, 1);
      g.fillRect(6, 33, 1, 1);
      g.fillRect(7, 44, 2, 1);
      g.fillRect(6, 43, 1, 1);
      g.fillStyle(PALETTE.midGray, 0.25);
      g.fillRect(5, 32, 1, 1);
      g.fillRect(5, 42, 1, 1);
    }

    // Turret housing on top
    g.fillStyle(hull);
    g.fillRect(20, 14, 40, 18);
    // Turret top highlight
    g.fillStyle(lighten(hull, 0.16));
    g.fillRect(20, 14, 40, 2);
    // Turret left highlight
    g.fillStyle(lighten(hull, 0.12));
    g.fillRect(20, 14, 2, 18);
    // Turret right shadow
    g.fillStyle(darken(hull, 0.15));
    g.fillRect(58, 14, 2, 18);
    // Turret bottom edge
    g.fillStyle(darken(hull, 0.08));
    g.fillRect(20, 30, 40, 2);

    // Hull kill marks on turret housing (5 tally marks)
    g.fillStyle(PALETTE.white);
    g.fillRect(42, 17, 1, 4);
    g.fillRect(44, 17, 1, 4);
    g.fillRect(46, 17, 1, 4);
    g.fillRect(48, 17, 1, 4);
    // 5th tally mark diagonal across
    g.fillRect(42, 17, 7, 1);

    // Green LED accents on turret
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(22, 17, 2, 1);
    g.fillRect(56, 17, 2, 1);
    // Amber LED
    g.fillStyle(PALETTE.yellow);
    g.fillRect(22, 19, 2, 1);
    g.fillRect(56, 19, 2, 1);

    // Turret armor detail panels
    g.fillStyle(darken(hull, 0.12));
    g.fillRect(24, 22, 14, 8);
    g.fillStyle(darken(hull, 0.18));
    g.fillRect(24, 22, 14, 1);
    g.fillRect(24, 29, 14, 1);
    g.fillRect(24, 22, 1, 8);
    g.fillRect(37, 22, 1, 8);
    // Turret panel rivets
    g.fillStyle(lighten(hull, 0.2));
    g.fillRect(25, 23, 1, 1);
    g.fillRect(36, 23, 1, 1);
    g.fillRect(25, 28, 1, 1);
    g.fillRect(36, 28, 1, 1);

    if (phase2) {
      // Phase 2: cracks across armor plates (diagonal dark lines)
      g.fillStyle(darken(armorPlate, 0.5));
      g.fillRect(18, 38, 1, 1);
      g.fillRect(19, 39, 1, 1);
      g.fillRect(20, 40, 1, 1);
      g.fillRect(21, 41, 1, 1);
      g.fillRect(44, 41, 1, 1);
      g.fillRect(45, 42, 1, 1);
      g.fillRect(46, 43, 1, 1);
      g.fillRect(47, 44, 1, 1);
      g.fillRect(55, 37, 1, 1);
      g.fillRect(56, 38, 1, 1);
      g.fillRect(57, 39, 1, 1);
      // Second crack set
      g.fillRect(35, 48, 1, 1);
      g.fillRect(36, 49, 1, 1);
      g.fillRect(37, 50, 1, 1);

      // Phase 2: sparks at hull-turret junction
      g.fillStyle(PALETTE.yellow);
      g.fillRect(22, 31, 3, 3);
      g.fillRect(55, 31, 3, 3);
      g.fillStyle(PALETTE.white);
      g.fillRect(23, 32, 1, 1);
      g.fillRect(56, 32, 1, 1);

      // Phase 2: exposed wiring
      g.fillStyle(PALETTE.brightRed);
      g.fillRect(30, 32, 1, 2);
      g.fillRect(31, 33, 2, 1);
      g.fillRect(33, 32, 1, 2);
      g.fillStyle(PALETTE.bagsGreen);
      g.fillRect(46, 32, 2, 1);
      g.fillRect(47, 33, 1, 2);

      // Phase 2: missing armor plate (one section replaced with darker hull)
      g.fillStyle(darken(hull, 0.18));
      g.fillRect(29, 36, 10, 9);
      // Show internal structure lines
      g.fillStyle(darken(hull, 0.38));
      g.fillRect(30, 39, 8, 1);
      g.fillRect(30, 42, 8, 1);
      g.fillRect(34, 36, 1, 9);
      // Exposed wiring in gap
      g.fillStyle(PALETTE.brightRed);
      g.fillRect(31, 37, 2, 1);
      g.fillStyle(PALETTE.bagsGreen);
      g.fillRect(36, 40, 2, 1);
    }

    // Cockpit (glowing red) with green border
    const cockpitColor = phase2 ? PALETTE.orange : cockpit;
    const cockpitGlow = phase2 ? 0xffddaa : 0xff6666;
    const cockpitGlowSize = phase2 ? 14 : 12;
    const cockpitGlowOffset = phase2 ? -1 : 0;

    // Green border
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(26, 17, 13, 10);
    // Glow aura
    g.fillStyle(cockpitGlow, 0.45);
    g.fillRect(
      26 + cockpitGlowOffset,
      17 + cockpitGlowOffset,
      cockpitGlowSize,
      10 - cockpitGlowOffset * 2
    );
    // Cockpit glass
    g.fillStyle(cockpitColor);
    g.fillRect(27, 18, 11, 8);
    // Glass highlight
    g.fillStyle(lighten(cockpitColor, 0.3));
    g.fillRect(28, 19, 3, 3);
    // Glass reflection line
    g.fillStyle(lighten(cockpitColor, 0.15));
    g.fillRect(33, 20, 4, 1);

    // Pilot silhouette visible through cockpit
    g.fillStyle(darken(cockpitColor, 0.35));
    g.fillRect(31, 21, 4, 4);
    g.fillRect(32, 19, 2, 2); // Pilot head

    if (phase2) {
      // Phase 2: cracked cockpit glass
      g.fillStyle(darken(cockpitColor, 0.4));
      g.fillRect(29, 20, 1, 1);
      g.fillRect(30, 21, 1, 1);
      g.fillRect(35, 19, 1, 1);
      g.fillRect(36, 20, 1, 1);
      g.fillRect(36, 21, 1, 1);
      // Phase 2: brighter reactor center (orange-white)
      g.fillStyle(PALETTE.white, 0.55);
      g.fillRect(32, 22, 2, 2);
    }
  }

  function drawCannon(g: Phaser.GameObjects.Graphics, yOff: number = 0, heatVent: boolean = false) {
    // Main cannon barrel
    g.fillStyle(cannon);
    g.fillRect(60, 20 + yOff, 20, 5);
    // Barrel top highlight
    g.fillStyle(lighten(cannon, 0.22));
    g.fillRect(60, 20 + yOff, 20, 1);
    // Barrel bottom shadow
    g.fillStyle(darken(cannon, 0.3));
    g.fillRect(60, 24 + yOff, 20, 1);
    // Barrel mid shading
    g.fillStyle(darken(cannon, 0.1));
    g.fillRect(60, 23 + yOff, 20, 1);
    // Barrel rifling rings
    g.fillStyle(darken(cannon, 0.2));
    g.fillRect(64, 20 + yOff, 1, 5);
    g.fillRect(70, 20 + yOff, 1, 5);
    g.fillRect(76, 20 + yOff, 1, 5);
    // Barrel tip bore
    g.fillStyle(darken(cannon, 0.4));
    g.fillRect(79, 21 + yOff, 1, 3);

    // Cannon mounting bracket
    g.fillStyle(PALETTE.midGray);
    g.fillRect(58, 19 + yOff, 3, 7);
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(58, 19 + yOff, 3, 1);

    if (heatVent) {
      // Heat venting detail
      g.fillStyle(PALETTE.orange, 0.3);
      g.fillRect(66, 19 + yOff, 3, 1);
      g.fillRect(72, 19 + yOff, 3, 1);
      g.fillStyle(PALETTE.yellow, 0.2);
      g.fillRect(67, 18 + yOff, 1, 1);
      g.fillRect(73, 18 + yOff, 1, 1);
    }
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
    g.fillRect(28, 19, 4, 4);
    g.fillStyle(PALETTE.white, 0.3);
    g.fillRect(29, 20, 2, 2);
    g.generateTexture("boss_idle_2", W, H);
    g.destroy();
  }

  // WALK 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    drawCannon(g);
    g.generateTexture("boss_walk_1", W, H);
    g.destroy();
  }

  // WALK 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 4);
    drawCannon(g);
    g.generateTexture("boss_walk_2", W, H);
    g.destroy();
  }

  // SHOOT 1 (cannon fires)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    // Cannon with recoil (slightly shorter visible barrel)
    g.fillStyle(cannon);
    g.fillRect(60, 20, 18, 5);
    g.fillStyle(lighten(cannon, 0.22));
    g.fillRect(60, 20, 18, 1);
    g.fillStyle(darken(cannon, 0.3));
    g.fillRect(60, 24, 18, 1);
    // Barrel rifling
    g.fillStyle(darken(cannon, 0.2));
    g.fillRect(64, 20, 1, 5);
    g.fillRect(70, 20, 1, 5);
    // Mounting bracket
    g.fillStyle(PALETTE.midGray);
    g.fillRect(58, 19, 3, 7);
    // Big muzzle flash
    g.fillStyle(PALETTE.white);
    g.fillRect(77, 16, 3, 12);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(75, 17, 5, 10);
    g.fillStyle(PALETTE.orange);
    g.fillRect(73, 18, 7, 8);
    // Heat vent effect
    g.fillStyle(PALETTE.orange, 0.3);
    g.fillRect(66, 19, 3, 1);
    g.fillRect(72, 19, 3, 1);
    g.generateTexture("boss_shoot_1", W, H);
    g.destroy();
  }

  // SHOOT 2 (missile pods)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0);
    drawCannon(g);
    // Missile pods on top opening
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(42, 9, 16, 7);
    g.fillStyle(lighten(PALETTE.darkGray, 0.1));
    g.fillRect(42, 9, 16, 1);
    g.fillStyle(darken(PALETTE.darkGray, 0.15));
    g.fillRect(42, 15, 16, 1);
    // Missile pod dividers
    g.fillStyle(darken(PALETTE.darkGray, 0.25));
    g.fillRect(47, 9, 1, 7);
    g.fillRect(53, 9, 1, 7);
    // Missiles emerging
    g.fillStyle(PALETTE.silver);
    g.fillRect(44, 6, 3, 5);
    g.fillRect(49, 5, 3, 6);
    g.fillRect(55, 6, 3, 5);
    // Missile warhead tips
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(44, 6, 3, 1);
    g.fillRect(49, 5, 3, 1);
    g.fillRect(55, 6, 3, 1);
    // Missile flames
    g.fillStyle(PALETTE.orange);
    g.fillRect(44, 3, 3, 3);
    g.fillRect(49, 2, 3, 3);
    g.fillRect(55, 3, 3, 3);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(45, 4, 1, 1);
    g.fillRect(50, 3, 1, 1);
    g.fillRect(56, 4, 1, 1);
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
    drawCannon(g, 0, true);
    g.generateTexture("boss_p2_idle", W, H);
    g.destroy();
  }

  // PHASE 2 IDLE 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
    drawCannon(g, -1, true);
    // Brighter cockpit pulse (Phase 2 orange-white)
    g.fillStyle(lighten(PALETTE.orange, 0.5));
    g.fillRect(28, 19, 4, 4);
    g.fillStyle(PALETTE.white, 0.4);
    g.fillRect(29, 20, 2, 2);
    g.generateTexture("boss_p2_idle_2", W, H);
    g.destroy();
  }

  // PHASE 2 WALK 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
    drawCannon(g, 0, true);
    g.generateTexture("boss_p2_walk_1", W, H);
    g.destroy();
  }

  // PHASE 2 WALK 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 4, true);
    drawCannon(g, 0, true);
    g.generateTexture("boss_p2_walk_2", W, H);
    g.destroy();
  }

  // PHASE 2 SHOOT 1
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
    // Cannon with muzzle flash and heat venting
    g.fillStyle(cannon);
    g.fillRect(60, 20, 18, 5);
    g.fillStyle(lighten(cannon, 0.22));
    g.fillRect(60, 20, 18, 1);
    g.fillStyle(darken(cannon, 0.3));
    g.fillRect(60, 24, 18, 1);
    // Barrel rifling
    g.fillStyle(darken(cannon, 0.2));
    g.fillRect(64, 20, 1, 5);
    g.fillRect(70, 20, 1, 5);
    // Mounting bracket
    g.fillStyle(PALETTE.midGray);
    g.fillRect(58, 19, 3, 7);
    // Big muzzle flash
    g.fillStyle(PALETTE.white);
    g.fillRect(77, 16, 3, 12);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(75, 17, 5, 10);
    g.fillStyle(PALETTE.orange);
    g.fillRect(73, 18, 7, 8);
    // Phase 2 heat venting
    g.fillStyle(PALETTE.orange, 0.4);
    g.fillRect(66, 19, 3, 1);
    g.fillRect(72, 19, 3, 1);
    g.fillStyle(PALETTE.yellow, 0.3);
    g.fillRect(67, 18, 1, 1);
    g.fillRect(73, 18, 1, 1);
    g.generateTexture("boss_p2_shoot_1", W, H);
    g.destroy();
  }

  // PHASE 2 SHOOT 2
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawBossBase(g, 0, true);
    drawCannon(g, 0, true);
    // Missile pods on top opening
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(42, 9, 16, 7);
    g.fillStyle(lighten(PALETTE.darkGray, 0.1));
    g.fillRect(42, 9, 16, 1);
    g.fillStyle(darken(PALETTE.darkGray, 0.15));
    g.fillRect(42, 15, 16, 1);
    // Missile pod dividers
    g.fillStyle(darken(PALETTE.darkGray, 0.25));
    g.fillRect(47, 9, 1, 7);
    g.fillRect(53, 9, 1, 7);
    // Missiles emerging
    g.fillStyle(PALETTE.silver);
    g.fillRect(44, 6, 3, 5);
    g.fillRect(49, 5, 3, 6);
    g.fillRect(55, 6, 3, 5);
    // Missile warhead tips
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(44, 6, 3, 1);
    g.fillRect(49, 5, 3, 1);
    g.fillRect(55, 6, 3, 1);
    // Missile flames
    g.fillStyle(PALETTE.orange);
    g.fillRect(44, 3, 3, 3);
    g.fillRect(49, 2, 3, 3);
    g.fillRect(55, 3, 3, 3);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(45, 4, 1, 1);
    g.fillRect(50, 3, 1, 1);
    g.fillRect(56, 4, 1, 1);
    g.generateTexture("boss_p2_shoot_2", W, H);
    g.destroy();
  }
}
