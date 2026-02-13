import * as Phaser from "phaser";
import { SCALE } from "./constants";

// Seeded-ish RNG helper so tile textures look rich but are reproducible per tile
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateGrass(scene: Phaser.Scene): void {
  const size = Math.round(80 * SCALE);
  const g = scene.make.graphics({ x: 0, y: 0 });
  const rand = rng(42);
  const r = (n: number) => Math.round(n * SCALE);

  // --- Base fill: dark green ---
  g.fillStyle(0x1a472a);
  g.fillRect(0, 0, size, size);

  // --- Shadow patches (darker green, organic shapes) ---
  g.fillStyle(0x14402a);
  for (let i = 0; i < 8; i++) {
    const px = Math.floor(rand() * (size - r(12)));
    const py = Math.floor(rand() * (size - r(10)));
    const pw = r(6 + rand() * 8);
    const ph = r(4 + rand() * 6);
    g.fillRect(px, py, pw, ph);
    // Soften edge with a second offset rect
    g.fillRect(px + r(2), py + r(1), pw - r(2), ph - r(1));
  }

  // --- Medium grass blades ---
  g.fillStyle(0x2d5a3d);
  const bladeCount = Math.round(40 * SCALE);
  for (let i = 0; i < bladeCount; i++) {
    const bx = Math.floor(rand() * (size - r(3)));
    const by = Math.floor(rand() * (size - r(5)));
    const bw = rand() > 0.5 ? r(2) : r(1);
    const bh = r(3 + rand() * 3);
    g.fillRect(bx, by, bw, bh);
  }

  // --- Light highlight blades ---
  g.fillStyle(0x3a7a50);
  for (let i = 0; i < Math.round(18 * SCALE); i++) {
    const bx = Math.floor(rand() * (size - r(2)));
    const by = Math.floor(rand() * (size - r(4)));
    g.fillRect(bx, by, r(1), r(2 + rand() * 2));
  }

  // --- Dirt / pebble patches ---
  const dirtColors = [0x5c4a3a, 0x6b5a48, 0x4a3f32];
  for (let i = 0; i < 4; i++) {
    const dx = Math.floor(rand() * (size - r(8)));
    const dy = Math.floor(rand() * (size - r(6)));
    g.fillStyle(dirtColors[Math.floor(rand() * dirtColors.length)]);
    g.fillRect(dx, dy, r(3 + rand() * 4), r(2 + rand() * 3));
    // Small pebble next to dirt
    g.fillStyle(0x7a6e60);
    g.fillRect(dx + r(1), dy + r(3), r(2), r(1));
  }

  // --- Wildflower clusters ---
  const flowerColors = [
    0xfbbf24, // yellow
    0xffffff, // white
    0xc084fc, // purple
    0xef4444, // red
    0xff8fab, // pink
  ];
  for (let i = 0; i < 6; i++) {
    const fx = Math.floor(rand() * (size - r(6)));
    const fy = Math.floor(rand() * (size - r(6)));
    const color = flowerColors[Math.floor(rand() * flowerColors.length)];
    // Stem
    g.fillStyle(0x2d5a3d);
    g.fillRect(fx + r(1), fy + r(2), r(1), r(3));
    // Petals (2x2 pixel center + 1px cross)
    g.fillStyle(color);
    g.fillRect(fx, fy + r(1), r(3), r(2));
    g.fillRect(fx + r(1), fy, r(1), r(1));
    // Petal highlight
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(fx + r(1), fy + r(1), r(1), r(1));
  }

  g.generateTexture("grass", size, size);
  g.destroy();

  // --- Dark grass variant ---
  const dg = scene.make.graphics({ x: 0, y: 0 });
  const dRand = rng(99);

  dg.fillStyle(0x14532d);
  dg.fillRect(0, 0, size, size);

  // Shadow patches
  dg.fillStyle(0x0e3d22);
  for (let i = 0; i < 6; i++) {
    const px = Math.floor(dRand() * (size - r(10)));
    const py = Math.floor(dRand() * (size - r(8)));
    dg.fillRect(px, py, r(5 + dRand() * 6), r(4 + dRand() * 5));
  }

  // Medium-dark blades
  dg.fillStyle(0x1a472a);
  for (let i = 0; i < Math.round(30 * SCALE); i++) {
    const bx = Math.floor(dRand() * (size - r(3)));
    const by = Math.floor(dRand() * (size - r(5)));
    dg.fillRect(bx, by, r(1 + dRand()), r(3 + dRand() * 3));
  }

  // Subtle lighter highlights
  dg.fillStyle(0x2d5a3d, 0.6);
  for (let i = 0; i < Math.round(10 * SCALE); i++) {
    const bx = Math.floor(dRand() * (size - r(2)));
    const by = Math.floor(dRand() * (size - r(3)));
    dg.fillRect(bx, by, r(1), r(2 + dRand() * 2));
  }

  dg.generateTexture("grass_dark", size, size);
  dg.destroy();
}

function generatePath(scene: Phaser.Scene): void {
  const size = Math.round(80 * SCALE);
  const g = scene.make.graphics({ x: 0, y: 0 });
  const rand = rng(77);
  const r = (n: number) => Math.round(n * SCALE);

  // --- Base stone fill ---
  g.fillStyle(0x78716c);
  g.fillRect(0, 0, size, size);

  // --- Rounded stone shapes (irregular flagstones) ---
  const stoneConfigs = [
    { x: 2, y: 2, w: 18, h: 14, color: 0x8a847e },
    { x: 24, y: 4, w: 22, h: 12, color: 0x706a64 },
    { x: 50, y: 2, w: 16, h: 16, color: 0x8a847e },
    { x: 4, y: 20, w: 20, h: 16, color: 0x706a64 },
    { x: 28, y: 22, w: 18, h: 14, color: 0x82796e },
    { x: 52, y: 20, w: 22, h: 18, color: 0x706a64 },
    { x: 8, y: 40, w: 24, h: 14, color: 0x8a847e },
    { x: 36, y: 42, w: 16, h: 16, color: 0x82796e },
    { x: 56, y: 40, w: 20, h: 14, color: 0x8a847e },
    { x: 2, y: 58, w: 18, h: 16, color: 0x706a64 },
    { x: 24, y: 60, w: 22, h: 14, color: 0x82796e },
    { x: 50, y: 58, w: 20, h: 16, color: 0x706a64 },
  ];

  stoneConfigs.forEach((s) => {
    g.fillStyle(s.color);
    // Main body
    g.fillRect(r(s.x + 1), r(s.y), r(s.w - 2), r(s.h));
    // Rounded top/bottom
    g.fillRect(r(s.x), r(s.y + 1), r(s.w), r(s.h - 2));
    // Light edge (top-left)
    g.fillStyle(0x9a948e, 0.4);
    g.fillRect(r(s.x + 1), r(s.y + 1), r(s.w - 2), r(1));
    g.fillRect(r(s.x + 1), r(s.y + 1), r(1), r(s.h - 2));
    // Dark edge (bottom-right)
    g.fillStyle(0x57534e, 0.5);
    g.fillRect(r(s.x + 1), r(s.y + s.h - 2), r(s.w - 2), r(1));
    g.fillRect(r(s.x + s.w - 2), r(s.y + 1), r(1), r(s.h - 2));
  });

  // --- Crack lines between stones ---
  g.fillStyle(0x44403c);
  // Horizontal cracks
  for (let i = 0; i < 5; i++) {
    const cy = Math.floor(rand() * (size - r(2)));
    const cx = Math.floor(rand() * (size - r(20)));
    const cw = r(8 + rand() * 16);
    g.fillRect(cx, cy, cw, r(1));
  }
  // Vertical cracks
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor(rand() * (size - r(2)));
    const cy = Math.floor(rand() * (size - r(14)));
    const ch = r(6 + rand() * 10);
    g.fillRect(cx, cy, r(1), ch);
  }

  // --- Moss pixels in cracks ---
  g.fillStyle(0x2d5a3d);
  for (let i = 0; i < Math.round(8 * SCALE); i++) {
    const mx = Math.floor(rand() * (size - r(3)));
    const my = Math.floor(rand() * (size - r(2)));
    g.fillRect(mx, my, r(1 + rand()), r(1 + rand()));
  }

  // --- Subtle dirt speckles ---
  g.fillStyle(0x6b5a48, 0.3);
  for (let i = 0; i < 6; i++) {
    const dx = Math.floor(rand() * (size - r(2)));
    const dy = Math.floor(rand() * (size - r(2)));
    g.fillRect(dx, dy, r(1), r(1));
  }

  g.generateTexture("path", size, size);
  g.destroy();
}

export function generateCoreAssets(scene: Phaser.Scene): void {
  generateGrass(scene);
  generatePath(scene);
}
