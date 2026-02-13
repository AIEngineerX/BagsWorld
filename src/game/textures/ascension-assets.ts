import * as Phaser from "phaser";
import { SCALE } from "./constants";

/** Scale helper — shorthand for Math.round(n * SCALE) */
function r(n: number): number {
  return Math.round(n * SCALE);
}

// ============================================================================
// 1. CLOUD GROUND TILE (32x32)
// ============================================================================

function generateAscensionCloudGround(scene: Phaser.Scene): void {
  const size = r(32);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Base fill — bright cloud white
  g.fillStyle(0xf0ede6);
  g.fillRect(0, 0, size, size);

  // Cloud puff shapes — lighter soft white patches
  g.fillStyle(0xfffef5);
  g.fillRect(r(2), r(3), r(10), r(7));
  g.fillRect(r(16), r(10), r(12), r(9));
  g.fillRect(r(5), r(20), r(14), r(7));
  g.fillRect(r(22), r(1), r(8), r(6));
  g.fillRect(r(0), r(14), r(6), r(5));

  // Even lighter highlights on puffs
  g.fillStyle(0xffffff);
  g.fillRect(r(4), r(4), r(6), r(3));
  g.fillRect(r(18), r(12), r(8), r(4));
  g.fillRect(r(7), r(22), r(10), r(3));

  // Shadow areas — subtle depth
  g.fillStyle(0xd4c9a8);
  g.fillRect(r(12), r(8), r(4), r(3));
  g.fillRect(r(0), r(26), r(8), r(3));
  g.fillRect(r(26), r(18), r(6), r(3));
  g.fillRect(r(14), r(28), r(10), r(2));

  // Golden path inlay pattern — dithered dots (simulating 0.3 alpha via sparse placement)
  g.fillStyle(0xfde68a);
  g.fillRect(r(6), r(6), r(1), r(1));
  g.fillRect(r(14), r(6), r(1), r(1));
  g.fillRect(r(22), r(6), r(1), r(1));
  g.fillRect(r(10), r(14), r(1), r(1));
  g.fillRect(r(18), r(14), r(1), r(1));
  g.fillRect(r(26), r(14), r(1), r(1));
  g.fillRect(r(6), r(22), r(1), r(1));
  g.fillRect(r(14), r(22), r(1), r(1));
  g.fillRect(r(22), r(22), r(1), r(1));
  g.fillRect(r(2), r(30), r(1), r(1));
  g.fillRect(r(10), r(30), r(1), r(1));
  g.fillRect(r(18), r(30), r(1), r(1));
  g.fillRect(r(30), r(30), r(1), r(1));
  g.fillRect(r(30), r(2), r(1), r(1));

  g.generateTexture("ascension_cloud_ground", size, size);
  g.destroy();
}

// ============================================================================
// 2. GRAND TEMPLE (250x200)
// ============================================================================

function generateAscensionTemple(scene: Phaser.Scene): void {
  const w = r(250),
    h = r(200);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Steps at bottom (3 steps, marble colored) ---
  g.fillStyle(0xe8ded0);
  g.fillRect(r(20), h - r(12), w - r(40), r(12));
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(25), h - r(12), w - r(50), r(3));
  g.fillStyle(0xe8ded0);
  g.fillRect(r(30), h - r(24), w - r(60), r(12));
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(35), h - r(24), w - r(70), r(3));
  g.fillStyle(0xe8ded0);
  g.fillRect(r(40), h - r(34), w - r(80), r(10));
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(45), h - r(34), w - r(90), r(3));

  // --- Main walls ---
  // Front face — white marble
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(40), r(50), w - r(80), h - r(84));

  // Shadow side (right wall)
  g.fillStyle(0xe8ded0);
  g.fillRect(w - r(50), r(50), r(10), h - r(84));

  // Left wall highlight
  g.fillStyle(0xfffef5);
  g.fillRect(r(40), r(50), r(8), h - r(84));

  // --- Triangular pediment (stepped rectangles) ---
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(35), r(42), w - r(70), r(12));
  g.fillRect(r(50), r(32), w - r(100), r(14));
  g.fillRect(r(65), r(24), w - r(130), r(12));
  g.fillRect(r(85), r(16), w - r(170), r(12));
  g.fillRect(r(100), r(10), w - r(200), r(10));
  g.fillRect(r(112), r(5), w - r(224), r(8));

  // Pediment shadow edge
  g.fillStyle(0xe8ded0);
  g.fillRect(w - r(70), r(42), r(5), r(8));
  g.fillRect(w - r(100), r(32), r(5), r(10));
  g.fillRect(w - r(130), r(24), r(5), r(8));

  // Pediment golden accent at peak
  g.fillStyle(0xd4a843);
  g.fillRect(cx - r(8), r(6), r(16), r(5));
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(5), r(7), r(10), r(3));

  // --- Golden peaked roof line ---
  g.fillStyle(0xd4a843);
  g.fillRect(r(32), r(40), w - r(64), r(4));
  // Roof highlight
  g.fillStyle(0xffd700);
  g.fillRect(r(32), r(40), w - r(64), r(2));

  // --- 4 tall columns (2 each side) ---
  const columnPositions = [r(50), r(70), w - r(80), w - r(60)];
  columnPositions.forEach((colX) => {
    // Column shaft
    g.fillStyle(0xf5f0eb);
    g.fillRect(colX, r(52), r(10), h - r(86));
    // Left highlight
    g.fillStyle(0xfffef5);
    g.fillRect(colX, r(52), r(2), h - r(86));
    // Right shadow
    g.fillStyle(0xe8ded0);
    g.fillRect(colX + r(8), r(52), r(2), h - r(86));
    // Capital (top)
    g.fillStyle(0xd4a843);
    g.fillRect(colX - r(2), r(48), r(14), r(5));
    // Base
    g.fillStyle(0xe8ded0);
    g.fillRect(colX - r(2), h - r(38), r(14), r(5));
  });

  // --- Large glowing doorway ---
  // Frame
  g.fillStyle(0xfde68a);
  g.fillRect(cx - r(22), r(100), r(44), h - r(134));
  // Inner golden glow
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(18), r(104), r(36), h - r(142));
  // Bright center
  g.fillStyle(0xfffef5, 0.5);
  g.fillRect(cx - r(12), r(110), r(24), h - r(154));
  // Arch at top of door
  g.fillStyle(0xd4a843);
  g.fillRect(cx - r(24), r(96), r(48), r(6));

  // --- Window-like openings on upper walls ---
  const windowXs = [r(52), r(82), w - r(92), w - r(62)];
  windowXs.forEach((wx) => {
    // Window recess
    g.fillStyle(0xd4c9a8);
    g.fillRect(wx, r(62), r(14), r(24));
    // Golden glow fill
    g.fillStyle(0xffd700, 0.3);
    g.fillRect(wx + r(2), r(64), r(10), r(20));
    // Highlight corner
    g.fillStyle(0xfffef5, 0.4);
    g.fillRect(wx + r(2), r(64), r(4), r(4));
  });

  // --- Block line details on walls ---
  g.fillStyle(0xe8ded0);
  for (let by = r(60); by < h - r(40); by += r(20)) {
    g.fillRect(r(42), by, r(28), r(1));
    g.fillRect(w - r(70), by, r(28), r(1));
  }

  g.generateTexture("ascension_temple", w, h);
  g.destroy();
}

// ============================================================================
// 3. OBSERVATORY (100x180)
// ============================================================================

function generateAscensionObservatory(scene: Phaser.Scene): void {
  const w = r(100),
    h = r(180);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Stone base section ---
  g.fillStyle(0xe8ded0);
  g.fillRect(r(15), r(100), w - r(30), h - r(100));

  // Left highlight
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(15), r(100), r(5), h - r(100));

  // Right shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(20), r(100), r(5), h - r(100));

  // --- Marble upper tower ---
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(20), r(40), w - r(40), r(65));

  // Left highlight
  g.fillStyle(0xfffef5);
  g.fillRect(r(20), r(40), r(4), r(65));

  // Right shadow
  g.fillStyle(0xe8ded0);
  g.fillRect(w - r(24), r(40), r(4), r(65));

  // --- Open dome at top (half-circle via stepped rectangles) ---
  g.fillStyle(0xd4a843);
  // Dome body
  g.fillRect(r(22), r(28), w - r(44), r(16));
  g.fillRect(r(28), r(20), w - r(56), r(12));
  g.fillRect(r(34), r(14), w - r(68), r(10));
  g.fillRect(r(38), r(8), w - r(76), r(8));
  g.fillRect(r(42), r(4), w - r(84), r(6));
  g.fillRect(cx - r(4), r(1), r(8), r(5));

  // Dome highlight
  g.fillStyle(0xffd700);
  g.fillRect(r(22), r(28), w - r(44), r(3));
  g.fillRect(r(28), r(20), w - r(56), r(3));
  g.fillRect(r(34), r(14), w - r(68), r(2));

  // Interior shadow inside dome
  g.fillStyle(0xe8ded0);
  g.fillRect(r(28), r(30), w - r(56), r(8));

  // --- Crystal/glass pane elements ---
  g.fillStyle(0xb8e6f0);
  g.fillRect(r(30), r(32), r(12), r(6));
  g.fillRect(w - r(42), r(32), r(12), r(6));
  g.fillRect(cx - r(6), r(24), r(12), r(6));

  // --- Star chart patterns (gold dots on walls) ---
  g.fillStyle(0xffd700);
  g.fillRect(r(28), r(50), r(2), r(2));
  g.fillRect(r(36), r(56), r(2), r(2));
  g.fillRect(r(44), r(48), r(2), r(2));
  g.fillRect(r(52), r(60), r(2), r(2));
  g.fillRect(r(60), r(52), r(2), r(2));
  g.fillRect(r(68), r(46), r(2), r(2));
  g.fillRect(r(32), r(66), r(2), r(2));
  g.fillRect(r(56), r(70), r(2), r(2));
  // Connect some stars with tiny line segments
  g.fillStyle(0xd4a843, 0.4);
  g.fillRect(r(30), r(51), r(6), r(1));
  g.fillRect(r(44), r(49), r(1), r(7));
  g.fillRect(r(53), r(56), r(7), r(1));

  // --- Narrow windows with golden frames ---
  const windowYs = [r(110), r(140)];
  windowYs.forEach((wy) => {
    // Left window
    g.fillStyle(0xd4a843);
    g.fillRect(r(24), wy, r(10), r(18));
    g.fillStyle(0xb8e6f0);
    g.fillRect(r(26), wy + r(2), r(6), r(14));

    // Right window
    g.fillStyle(0xd4a843);
    g.fillRect(w - r(34), wy, r(10), r(18));
    g.fillStyle(0xb8e6f0);
    g.fillRect(w - r(32), wy + r(2), r(6), r(14));
  });

  // --- Base course ---
  g.fillStyle(0xd4c9a8);
  g.fillRect(r(12), h - r(8), w - r(24), r(8));
  g.fillStyle(0xe8ded0);
  g.fillRect(r(12), h - r(8), w - r(24), r(2));

  // Block lines on stone base
  g.fillStyle(0xd4c9a8);
  g.fillRect(r(17), r(120), w - r(34), r(1));
  g.fillRect(r(17), r(140), w - r(34), r(1));
  g.fillRect(r(17), r(160), w - r(34), r(1));

  g.generateTexture("ascension_observatory", w, h);
  g.destroy();
}

// ============================================================================
// 4. VAULT / TREASURY (130x120)
// ============================================================================

function generateAscensionVault(scene: Phaser.Scene): void {
  const w = r(130),
    h = r(120);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Heavy stone body ---
  g.fillStyle(0xe8ded0);
  g.fillRect(r(5), r(20), w - r(10), h - r(20));

  // Left highlight
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(5), r(20), r(6), h - r(20));

  // Right shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(11), r(20), r(6), h - r(20));

  // --- Crown/arch detail at top ---
  g.fillStyle(0xd4a843);
  g.fillRect(r(3), r(14), w - r(6), r(8));
  // Arch stepped top
  g.fillRect(r(10), r(8), w - r(20), r(8));
  g.fillRect(r(20), r(3), w - r(40), r(7));
  g.fillRect(r(35), 0, w - r(70), r(5));
  // Gold highlight
  g.fillStyle(0xffd700);
  g.fillRect(r(3), r(14), w - r(6), r(3));
  g.fillRect(r(10), r(8), w - r(20), r(2));

  // --- Large golden double doors ---
  const doorW = r(40);
  const doorH = h - r(40);
  const doorX = cx - doorW / 2;
  const doorY = r(30);

  g.fillStyle(0xd4a843);
  g.fillRect(doorX, doorY, doorW, doorH);

  // Bright center line (door split)
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(1), doorY, r(2), doorH);

  // Reinforced horizontal bands across doors
  g.fillStyle(0xffd700);
  g.fillRect(doorX + r(2), doorY + r(10), doorW - r(4), r(3));
  g.fillRect(doorX + r(2), doorY + r(25), doorW - r(4), r(3));
  g.fillRect(doorX + r(2), doorY + r(40), doorW - r(4), r(3));
  g.fillRect(doorX + r(2), doorY + r(55), doorW - r(4), r(3));

  // Door shadow edge
  g.fillStyle(0xb8860b);
  g.fillRect(doorX + doorW - r(3), doorY, r(3), doorH);

  // Door highlight edge
  g.fillStyle(0xffe44d);
  g.fillRect(doorX, doorY, r(3), doorH);

  // --- Gemstone insets on walls ---
  g.fillStyle(0xb8e6f0);
  // Left wall gems
  g.fillRect(r(14), r(40), r(6), r(6));
  g.fillRect(r(14), r(70), r(6), r(6));
  // Right wall gems
  g.fillRect(w - r(20), r(40), r(6), r(6));
  g.fillRect(w - r(20), r(70), r(6), r(6));
  // Gem highlights
  g.fillStyle(0xfffef5);
  g.fillRect(r(14), r(40), r(2), r(2));
  g.fillRect(r(14), r(70), r(2), r(2));
  g.fillRect(w - r(20), r(40), r(2), r(2));
  g.fillRect(w - r(20), r(70), r(2), r(2));

  // --- Block line details ---
  g.fillStyle(0xd4c9a8);
  g.fillRect(r(7), r(45), r(24), r(1));
  g.fillRect(r(7), r(65), r(24), r(1));
  g.fillRect(r(7), r(85), r(24), r(1));
  g.fillRect(w - r(31), r(45), r(24), r(1));
  g.fillRect(w - r(31), r(65), r(24), r(1));
  g.fillRect(w - r(31), r(85), r(24), r(1));

  // --- Bottom foundation ---
  g.fillStyle(0xd4c9a8);
  g.fillRect(r(3), h - r(6), w - r(6), r(6));
  g.fillStyle(0xe8ded0);
  g.fillRect(r(3), h - r(6), w - r(6), r(2));

  g.generateTexture("ascension_vault", w, h);
  g.destroy();
}

// ============================================================================
// 5. TOKEN SHRINE (80x90) — Open-air altar
// ============================================================================

function generateAscensionTokenShrine(scene: Phaser.Scene): void {
  const w = r(80),
    h = r(90);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- 4 thin columns ---
  const colW = r(5);
  const colPositions = [r(8), r(25), w - r(30), w - r(13)];
  colPositions.forEach((colX) => {
    // Column shaft
    g.fillStyle(0xf5f0eb);
    g.fillRect(colX, r(12), colW, h - r(22));
    // Left highlight
    g.fillStyle(0xfffef5);
    g.fillRect(colX, r(12), r(1), h - r(22));
    // Right shadow
    g.fillStyle(0xe8ded0);
    g.fillRect(colX + colW - r(1), r(12), r(1), h - r(22));
    // Capital (top)
    g.fillStyle(0xe8ded0);
    g.fillRect(colX - r(1), r(10), colW + r(2), r(4));
    // Base
    g.fillStyle(0xe8ded0);
    g.fillRect(colX - r(1), h - r(12), colW + r(2), r(4));
  });

  // --- Flat roof/lintel connecting columns ---
  g.fillStyle(0xe8ded0);
  g.fillRect(r(5), r(4), w - r(10), r(8));
  // Roof top highlight
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(5), r(4), w - r(10), r(3));
  // Roof right shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(8), r(4), r(3), r(8));
  // Small golden trim along roof edge
  g.fillStyle(0xd4a843);
  g.fillRect(r(5), r(10), w - r(10), r(2));

  // --- Central altar/pedestal ---
  g.fillStyle(0xd4a843);
  g.fillRect(cx - r(12), h - r(30), r(24), r(22));
  // Pedestal highlight
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(12), h - r(30), r(3), r(22));
  // Pedestal shadow
  g.fillStyle(0xb8860b);
  g.fillRect(cx + r(9), h - r(30), r(3), r(22));
  // Pedestal top surface
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(14), h - r(33), r(28), r(5));

  // Glowing top
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(8), h - r(40), r(16), r(8));
  g.fillStyle(0xfffef5, 0.5);
  g.fillRect(cx - r(5), h - r(38), r(10), r(4));

  // Rune dots on pedestal in cyan
  g.fillStyle(0xb8e6f0);
  g.fillRect(cx - r(8), h - r(22), r(2), r(2));
  g.fillRect(cx - r(3), h - r(20), r(2), r(2));
  g.fillRect(cx + r(2), h - r(22), r(2), r(2));
  g.fillRect(cx + r(7), h - r(20), r(2), r(2));
  g.fillRect(cx - r(6), h - r(16), r(2), r(2));
  g.fillRect(cx + r(5), h - r(16), r(2), r(2));

  // --- Floor base ---
  g.fillStyle(0xe8ded0);
  g.fillRect(r(5), h - r(8), w - r(10), r(8));

  g.generateTexture("ascension_token_shrine", w, h);
  g.destroy();
}

// ============================================================================
// 6. BRAZIER (24x50) — Golden fire bowl on pedestal
// ============================================================================

function generateAscensionBrazier(scene: Phaser.Scene): void {
  const w = r(24),
    h = r(50);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Stone pedestal (tapered) ---
  // Wide base
  g.fillStyle(0xe8ded0);
  g.fillRect(r(3), h - r(8), w - r(6), r(8));
  // Middle section (slightly narrower)
  g.fillStyle(0xe8ded0);
  g.fillRect(r(4), h - r(24), w - r(8), r(16));
  // Upper taper
  g.fillStyle(0xe8ded0);
  g.fillRect(r(5), h - r(32), w - r(10), r(8));

  // Pedestal left highlight
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(3), h - r(8), r(2), r(8));
  g.fillRect(r(4), h - r(24), r(2), r(16));

  // Pedestal right shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(5), h - r(8), r(2), r(8));
  g.fillRect(w - r(6), h - r(24), r(2), r(16));

  // --- Golden bowl ---
  g.fillStyle(0xd4a843);
  g.fillRect(r(3), h - r(38), w - r(6), r(8));
  // Bowl inner shadow
  g.fillStyle(0xb8860b);
  g.fillRect(r(5), h - r(36), w - r(10), r(4));
  // Bowl highlight
  g.fillStyle(0xffd700);
  g.fillRect(r(3), h - r(38), w - r(6), r(2));

  // --- Fire pixels above bowl ---
  // Orange outer flames
  g.fillStyle(0xff8c00);
  g.fillRect(cx - r(4), h - r(46), r(8), r(8));
  g.fillRect(cx - r(3), h - r(48), r(6), r(4));
  // Gold inner flames
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(3), h - r(44), r(6), r(6));
  g.fillRect(cx - r(2), h - r(48), r(4), r(4));
  // Bright tip
  g.fillStyle(0xfffef5);
  g.fillRect(cx - r(1), h - r(50), r(2), r(4));
  // Side flame licks
  g.fillStyle(0xff8c00);
  g.fillRect(cx - r(5), h - r(42), r(2), r(3));
  g.fillRect(cx + r(3), h - r(43), r(2), r(4));

  // --- Warm glow circle below bowl (very faint dithered) ---
  g.fillStyle(0xffd700, 0.1);
  g.fillRect(r(0), h - r(42), w, r(10));
  g.fillStyle(0xff8c00, 0.06);
  g.fillRect(r(2), h - r(40), w - r(4), r(6));

  g.generateTexture("ascension_brazier", w, h);
  g.destroy();
}

// ============================================================================
// 7. FLOATING CRYSTAL SHARD (16x24)
// ============================================================================

function generateAscensionCrystalFloat(scene: Phaser.Scene): void {
  const w = r(16),
    h = r(24);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Angular diamond/shard shape — pointed top and bottom
  // Wide middle
  g.fillStyle(0xb8e6f0);
  g.fillRect(cx - r(5), r(8), r(10), r(8));
  // Upper taper
  g.fillRect(cx - r(4), r(5), r(8), r(5));
  g.fillRect(cx - r(3), r(3), r(6), r(4));
  g.fillRect(cx - r(2), r(1), r(4), r(3));
  g.fillRect(cx - r(1), 0, r(2), r(2));
  // Lower taper
  g.fillRect(cx - r(4), r(14), r(8), r(3));
  g.fillRect(cx - r(3), r(16), r(6), r(3));
  g.fillRect(cx - r(2), r(18), r(4), r(3));
  g.fillRect(cx - r(1), r(20), r(2), r(3));
  g.fillRect(cx, r(22), r(1), r(2));

  // Bright edge highlight (left face)
  g.fillStyle(0xfffef5);
  g.fillRect(cx - r(4), r(6), r(2), r(8));
  g.fillRect(cx - r(3), r(4), r(2), r(4));
  g.fillRect(cx - r(2), r(2), r(1), r(3));

  // Shadow edge (right face)
  g.fillStyle(0x88aac0);
  g.fillRect(cx + r(2), r(6), r(3), r(8));
  g.fillRect(cx + r(1), r(14), r(3), r(4));
  g.fillRect(cx + r(1), r(3), r(2), r(4));

  // Sparkle
  g.fillStyle(0xffffff);
  g.fillRect(cx - r(2), r(7), r(2), r(2));

  g.generateTexture("ascension_crystal_float", w, h);
  g.destroy();
}

// ============================================================================
// 8. BANNER (20x60) — Banner on golden pole
// ============================================================================

function generateAscensionBanner(scene: Phaser.Scene): void {
  const w = r(20),
    h = r(60);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Thin golden pole full height ---
  g.fillStyle(0xd4a843);
  g.fillRect(cx - r(1), 0, r(2), h);
  // Pole highlight
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(1), 0, r(1), h);

  // Pole finial (small ball at top)
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(2), 0, r(4), r(3));
  g.fillStyle(0xfffef5);
  g.fillRect(cx - r(1), 0, r(2), r(1));

  // --- Fabric rectangle hanging from top ---
  const fabricTop = r(4);
  const fabricBottom = r(48);
  const fabricW = r(14);
  const fabricX = cx + r(1);

  // Fabric body — creamy
  g.fillStyle(0xfde68a);
  g.fillRect(fabricX, fabricTop, fabricW, fabricBottom - fabricTop);

  // Gold border on fabric
  g.fillStyle(0xd4a843);
  g.fillRect(fabricX, fabricTop, fabricW, r(2)); // Top border
  g.fillRect(fabricX, fabricTop, r(2), fabricBottom - fabricTop); // Left border
  g.fillRect(fabricX + fabricW - r(2), fabricTop, r(2), fabricBottom - fabricTop); // Right border
  g.fillRect(fabricX, fabricBottom - r(2), fabricW, r(2)); // Bottom border

  // --- Small pennant tip at bottom ---
  g.fillStyle(0xfde68a);
  g.fillRect(fabricX + r(2), fabricBottom, fabricW - r(4), r(4));
  g.fillRect(fabricX + r(4), fabricBottom + r(4), fabricW - r(8), r(3));
  g.fillRect(fabricX + r(6), fabricBottom + r(7), fabricW - r(12), r(2));

  // Pennant tip gold edge
  g.fillStyle(0xd4a843);
  g.fillRect(fabricX + r(2), fabricBottom, r(1), r(4));
  g.fillRect(fabricX + fabricW - r(5), fabricBottom, r(1), r(4));

  // Simple emblem on fabric (small golden star/cross)
  g.fillStyle(0xd4a843);
  g.fillRect(fabricX + r(6), r(20), r(2), r(8)); // Vertical
  g.fillRect(fabricX + r(4), r(23), r(6), r(2)); // Horizontal

  g.generateTexture("ascension_banner", w, h);
  g.destroy();
}

// ============================================================================
// 9. GUARDIAN STATUE (30x40) — Small winged statue
// ============================================================================

function generateAscensionGuardian(scene: Phaser.Scene): void {
  const w = r(30),
    h = r(40);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Stone base ---
  g.fillStyle(0xe8ded0);
  g.fillRect(r(4), h - r(6), w - r(8), r(6));
  g.fillStyle(0xd4c9a8);
  g.fillRect(r(6), h - r(8), w - r(12), r(3));
  // Base highlight
  g.fillStyle(0xf5f0eb);
  g.fillRect(r(4), h - r(6), w - r(8), r(2));

  // --- Figure body (humanoid silhouette) ---
  // Torso
  g.fillStyle(0xf5f0eb);
  g.fillRect(cx - r(4), r(14), r(8), r(16));
  // Head
  g.fillRect(cx - r(3), r(6), r(6), r(8));
  // Head highlight
  g.fillStyle(0xfffef5);
  g.fillRect(cx - r(2), r(7), r(3), r(4));
  // Shoulders
  g.fillStyle(0xf5f0eb);
  g.fillRect(cx - r(6), r(14), r(12), r(4));
  // Lower robe
  g.fillRect(cx - r(5), r(28), r(10), r(6));
  // Robe shadow
  g.fillStyle(0xe8ded0);
  g.fillRect(cx + r(2), r(16), r(3), r(14));

  // --- Wings extending from sides ---
  // Left wing
  g.fillStyle(0xf5f0eb);
  g.fillRect(cx - r(10), r(10), r(5), r(12));
  g.fillRect(cx - r(12), r(8), r(4), r(8));
  g.fillRect(cx - r(14), r(6), r(3), r(6));
  // Left wing highlight
  g.fillStyle(0xfffef5);
  g.fillRect(cx - r(10), r(10), r(2), r(8));

  // Right wing
  g.fillStyle(0xf5f0eb);
  g.fillRect(cx + r(5), r(10), r(5), r(12));
  g.fillRect(cx + r(8), r(8), r(4), r(8));
  g.fillRect(cx + r(11), r(6), r(3), r(6));
  // Right wing shadow
  g.fillStyle(0xe8ded0);
  g.fillRect(cx + r(8), r(12), r(2), r(6));

  g.generateTexture("ascension_guardian", w, h);
  g.destroy();
}

// ============================================================================
// 10. ETHEREAL TREE (50x70) — White tree with golden leaves
// ============================================================================

function generateAscensionEtherealTree(scene: Phaser.Scene): void {
  const w = r(50),
    h = r(70);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- White bark trunk ---
  g.fillStyle(0xf5f0eb);
  g.fillRect(cx - r(4), r(30), r(8), r(40));
  // Trunk shadow right
  g.fillStyle(0xe8ded0);
  g.fillRect(cx + r(2), r(30), r(3), r(38));
  // Trunk highlight left
  g.fillStyle(0xfffef5);
  g.fillRect(cx - r(4), r(30), r(2), r(38));

  // Branch stubs
  g.fillStyle(0xf5f0eb);
  g.fillRect(cx - r(8), r(34), r(6), r(3));
  g.fillRect(cx + r(4), r(38), r(7), r(3));
  g.fillRect(cx - r(10), r(42), r(8), r(2));

  // Roots at base
  g.fillStyle(0xe8ded0);
  g.fillRect(cx - r(7), h - r(5), r(3), r(5));
  g.fillRect(cx + r(4), h - r(4), r(4), r(4));

  // --- Canopy: golden/amber --- (organic shape, not symmetric)
  // Main canopy blob
  g.fillStyle(0xd4a843);
  g.fillRect(cx - r(16), r(10), r(30), r(22));
  g.fillRect(cx - r(20), r(14), r(36), r(16));
  g.fillRect(cx - r(14), r(6), r(24), r(8));
  g.fillRect(cx - r(10), r(2), r(18), r(6));

  // Right side extension (asymmetric)
  g.fillRect(cx + r(12), r(18), r(10), r(8));

  // Left side upper bump
  g.fillRect(cx - r(18), r(8), r(8), r(8));

  // --- Canopy highlights ---
  g.fillStyle(0xfde68a);
  g.fillRect(cx - r(14), r(8), r(12), r(8));
  g.fillRect(cx - r(18), r(16), r(10), r(6));
  g.fillRect(cx + r(4), r(12), r(8), r(6));
  g.fillRect(cx - r(8), r(4), r(10), r(4));

  // --- Bright gold leaf pixels scattered ---
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(12), r(12), r(2), r(2));
  g.fillRect(cx + r(2), r(8), r(2), r(2));
  g.fillRect(cx + r(10), r(16), r(2), r(2));
  g.fillRect(cx - r(6), r(20), r(2), r(2));
  g.fillRect(cx + r(6), r(22), r(2), r(2));
  g.fillRect(cx - r(16), r(18), r(2), r(2));
  g.fillRect(cx, r(4), r(2), r(2));
  g.fillRect(cx + r(16), r(20), r(2), r(2));

  // Canopy bottom shadow
  g.fillStyle(0xb8860b, 0.3);
  g.fillRect(cx - r(18), r(28), r(34), r(3));

  g.generateTexture("ascension_ethereal_tree", w, h);
  g.destroy();
}

// ============================================================================
// 11. TIER PLATFORMS (80x20 each)
// ============================================================================

function generateAscensionPlatformNone(scene: Phaser.Scene): void {
  const w = r(80),
    h = r(20);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Cloud white base
  g.fillStyle(0xf0ede6);
  g.fillRect(0, r(2), w, h - r(2));

  // Top surface lighter
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, w, r(4));

  // Left edge highlight
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, r(2), h);

  // Right edge shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(2), 0, r(2), h);

  // Bottom shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(0, h - r(2), w, r(2));

  // Block line details (gray accents for unranked)
  g.fillStyle(0xd4c9a8);
  g.fillRect(r(20), r(2), r(1), h - r(4));
  g.fillRect(r(40), r(2), r(1), h - r(4));
  g.fillRect(r(60), r(2), r(1), h - r(4));

  g.generateTexture("ascension_platform_none", w, h);
  g.destroy();
}

function generateAscensionPlatformBronze(scene: Phaser.Scene): void {
  const w = r(80),
    h = r(20);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Cloud white base
  g.fillStyle(0xf0ede6);
  g.fillRect(0, r(2), w, h - r(2));

  // Top surface
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, w, r(4));

  // Left edge highlight
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, r(2), h);

  // Right edge shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(2), 0, r(2), h);

  // Bottom shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(0, h - r(2), w, r(2));

  // Bronze accent band
  g.fillStyle(0xcd7f32);
  g.fillRect(r(4), r(8), w - r(8), r(3));

  // Bronze rivet details
  g.fillStyle(0xdaa06d);
  g.fillRect(r(10), r(4), r(3), r(3));
  g.fillRect(w - r(13), r(4), r(3), r(3));

  // Bronze edge trim
  g.fillStyle(0xcd7f32);
  g.fillRect(0, 0, w, r(1));
  g.fillRect(0, h - r(1), w, r(1));

  g.generateTexture("ascension_platform_bronze", w, h);
  g.destroy();
}

function generateAscensionPlatformSilver(scene: Phaser.Scene): void {
  const w = r(80),
    h = r(20);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Cloud white base
  g.fillStyle(0xf0ede6);
  g.fillRect(0, r(2), w, h - r(2));

  // Top surface
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, w, r(4));

  // Left edge highlight
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, r(2), h);

  // Right edge shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(2), 0, r(2), h);

  // Bottom shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(0, h - r(2), w, r(2));

  // Silver accent band
  g.fillStyle(0xc0c0c0);
  g.fillRect(r(4), r(8), w - r(8), r(3));

  // Shine spots
  g.fillStyle(0xe8e8ec);
  g.fillRect(r(15), r(3), r(4), r(2));
  g.fillRect(r(50), r(3), r(6), r(2));

  // Silver rivet details
  g.fillStyle(0xd8d8dc);
  g.fillRect(r(10), r(4), r(3), r(3));
  g.fillRect(w - r(13), r(4), r(3), r(3));

  // Silver edge trim
  g.fillStyle(0xc0c0c0);
  g.fillRect(0, 0, w, r(1));
  g.fillRect(0, h - r(1), w, r(1));

  g.generateTexture("ascension_platform_silver", w, h);
  g.destroy();
}

function generateAscensionPlatformGold(scene: Phaser.Scene): void {
  const w = r(80),
    h = r(20);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Cloud white base
  g.fillStyle(0xf0ede6);
  g.fillRect(0, r(2), w, h - r(2));

  // Top surface
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, w, r(4));

  // Left edge highlight
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, r(2), h);

  // Right edge shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(2), 0, r(2), h);

  // Bottom shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(0, h - r(2), w, r(2));

  // Gold accent band
  g.fillStyle(0xffd700);
  g.fillRect(r(4), r(8), w - r(8), r(3));

  // Shine spots
  g.fillStyle(0xffefa0);
  g.fillRect(r(12), r(3), r(5), r(2));
  g.fillRect(r(45), r(3), r(8), r(2));

  // Gold gem insets
  g.fillStyle(0xd4a843);
  g.fillRect(r(10), r(12), r(4), r(4));
  g.fillRect(w - r(14), r(12), r(4), r(4));
  g.fillStyle(0xffd700);
  g.fillRect(r(11), r(13), r(2), r(2));
  g.fillRect(w - r(13), r(13), r(2), r(2));

  // Gold edge trim
  g.fillStyle(0xffd700);
  g.fillRect(0, 0, w, r(1));
  g.fillRect(0, h - r(1), w, r(1));

  g.generateTexture("ascension_platform_gold", w, h);
  g.destroy();
}

function generateAscensionPlatformDiamond(scene: Phaser.Scene): void {
  const w = r(80),
    h = r(20);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Cloud white base
  g.fillStyle(0xf0ede6);
  g.fillRect(0, r(2), w, h - r(2));

  // Top surface
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, w, r(4));

  // Left edge highlight
  g.fillStyle(0xfffef5);
  g.fillRect(0, 0, r(2), h);

  // Right edge shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(w - r(2), 0, r(2), h);

  // Bottom shadow
  g.fillStyle(0xd4c9a8);
  g.fillRect(0, h - r(2), w, r(2));

  // Diamond accent band
  g.fillStyle(0xb8e6f0);
  g.fillRect(r(4), r(8), w - r(8), r(3));

  // Sparkle pixels scattered
  g.fillStyle(0xffffff);
  g.fillRect(r(8), r(3), r(2), r(2));
  g.fillRect(r(22), r(6), r(2), r(2));
  g.fillRect(r(38), r(2), r(2), r(2));
  g.fillRect(r(55), r(5), r(2), r(2));
  g.fillRect(r(68), r(3), r(2), r(2));

  // Diamond gem insets (cyan)
  g.fillStyle(0x00e5ff);
  g.fillRect(r(10), r(12), r(4), r(4));
  g.fillRect(w - r(14), r(12), r(4), r(4));
  g.fillStyle(0x7df9ff);
  g.fillRect(r(11), r(13), r(2), r(2));
  g.fillRect(w - r(13), r(13), r(2), r(2));

  // Diamond edge trim
  g.fillStyle(0x7df9ff);
  g.fillRect(0, 0, w, r(1));
  g.fillRect(0, h - r(1), w, r(1));

  g.generateTexture("ascension_platform_diamond", w, h);
  g.destroy();
}

// ============================================================================
// 12. HALO (20x10) — Golden ring
// ============================================================================

function generateAscensionHalo(scene: Phaser.Scene): void {
  const w = r(20),
    h = r(10);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Outer ring — golden oval shape
  g.fillStyle(0xffd700);
  g.fillRect(r(2), r(1), w - r(4), r(2)); // Top bar
  g.fillRect(r(2), h - r(3), w - r(4), r(2)); // Bottom bar
  g.fillRect(0, r(3), r(3), h - r(6)); // Left bar
  g.fillRect(w - r(3), r(3), r(3), h - r(6)); // Right bar

  // Corner pixels for rounder shape
  g.fillRect(r(1), r(2), r(2), r(2));
  g.fillRect(w - r(3), r(2), r(2), r(2));
  g.fillRect(r(1), h - r(4), r(2), r(2));
  g.fillRect(w - r(3), h - r(4), r(2), r(2));

  // Highlight on top-left
  g.fillStyle(0xffe44d);
  g.fillRect(r(3), r(1), r(6), r(2));
  g.fillRect(0, r(3), r(2), r(2));

  // Glow aura
  g.fillStyle(0xffd700, 0.2);
  g.fillRect(w / 2 - r(8), 0, r(16), h);

  g.generateTexture("ascension_halo", w, h);
  g.destroy();
}

// ============================================================================
// 13. SPIRE PEAK (60x100) — Golden obelisk/pinnacle
// ============================================================================

function generateAscensionSpirePeak(scene: Phaser.Scene): void {
  const w = r(60),
    h = r(100);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // --- Golden obelisk body (tapers upward) ---
  // Wide base
  g.fillStyle(0xd4a843);
  g.fillRect(cx - r(18), r(60), r(36), r(40));
  // Upper body
  g.fillRect(cx - r(14), r(45), r(28), r(18));
  // Mid taper
  g.fillRect(cx - r(10), r(32), r(20), r(16));
  // Upper taper
  g.fillRect(cx - r(7), r(22), r(14), r(12));
  // Near tip
  g.fillRect(cx - r(5), r(14), r(10), r(10));
  // Tip
  g.fillRect(cx - r(3), r(8), r(6), r(8));
  g.fillRect(cx - r(2), r(4), r(4), r(6));
  g.fillRect(cx - r(1), r(1), r(2), r(5));

  // --- Left face highlight ---
  g.fillStyle(0xffd700, 0.5);
  g.fillRect(cx - r(18), r(60), r(4), r(40));
  g.fillRect(cx - r(14), r(45), r(3), r(18));
  g.fillRect(cx - r(10), r(32), r(3), r(16));
  g.fillRect(cx - r(7), r(22), r(2), r(12));
  g.fillRect(cx - r(5), r(14), r(2), r(10));

  // --- Right face shadow ---
  g.fillStyle(0xb8860b, 0.5);
  g.fillRect(cx + r(14), r(60), r(4), r(40));
  g.fillRect(cx + r(11), r(45), r(3), r(18));
  g.fillRect(cx + r(7), r(32), r(3), r(16));
  g.fillRect(cx + r(5), r(22), r(2), r(12));
  g.fillRect(cx + r(3), r(14), r(2), r(10));

  // --- Block line details ---
  g.fillStyle(0xb8860b, 0.3);
  g.fillRect(cx - r(16), r(70), r(32), r(1));
  g.fillRect(cx - r(16), r(82), r(32), r(1));
  g.fillRect(cx - r(16), r(94), r(32), r(1));
  g.fillRect(cx - r(12), r(52), r(24), r(1));
  g.fillRect(cx - r(8), r(38), r(16), r(1));

  // --- Bright golden tip ---
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(2), r(2), r(4), r(6));
  g.fillStyle(0xfffef5);
  g.fillRect(cx - r(1), r(1), r(2), r(3));
  g.fillStyle(0xffffff);
  g.fillRect(cx, r(1), r(1), r(1));

  // --- Pale cyan inset gem (center of obelisk) ---
  g.fillStyle(0xb8e6f0);
  g.fillRect(cx - r(5), r(62), r(10), r(14));
  // Gem inner glow
  g.fillStyle(0xfffef5, 0.4);
  g.fillRect(cx - r(3), r(64), r(6), r(10));
  // Gem highlight corner
  g.fillStyle(0xffffff, 0.3);
  g.fillRect(cx - r(4), r(63), r(3), r(3));
  // Gem border
  g.fillStyle(0xd4a843);
  g.fillRect(cx - r(6), r(61), r(12), r(1));
  g.fillRect(cx - r(6), r(76), r(12), r(1));
  g.fillRect(cx - r(6), r(61), r(1), r(16));
  g.fillRect(cx + r(5), r(61), r(1), r(16));

  // --- Ethereal glow aura around tip ---
  g.fillStyle(0xffd700, 0.15);
  g.fillRect(cx - r(8), 0, r(16), r(20));
  g.fillStyle(0xffe44d, 0.1);
  g.fillRect(cx - r(12), 0, r(24), r(15));
  g.fillStyle(0xffffff, 0.05);
  g.fillRect(cx - r(15), 0, r(30), r(10));

  g.generateTexture("ascension_spire_peak", w, h);
  g.destroy();
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function generateAscensionAssets(scene: Phaser.Scene): void {
  generateAscensionCloudGround(scene);
  generateAscensionTemple(scene);
  generateAscensionObservatory(scene);
  generateAscensionVault(scene);
  generateAscensionTokenShrine(scene);
  generateAscensionBrazier(scene);
  generateAscensionCrystalFloat(scene);
  generateAscensionBanner(scene);
  generateAscensionGuardian(scene);
  generateAscensionEtherealTree(scene);
  generateAscensionPlatformNone(scene);
  generateAscensionPlatformBronze(scene);
  generateAscensionPlatformSilver(scene);
  generateAscensionPlatformGold(scene);
  generateAscensionPlatformDiamond(scene);
  generateAscensionHalo(scene);
  generateAscensionSpirePeak(scene);
}
