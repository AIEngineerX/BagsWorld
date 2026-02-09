import * as Phaser from "phaser";
import { SCALE } from "./constants";

/** Scale helper — shorthand for Math.round(n * SCALE) used in dungeon generators */
function r(n: number): number {
  return Math.round(n * SCALE);
}

function generateDungeonGround(scene: Phaser.Scene): void {
  const size = r(32);
  const g = scene.make.graphics({ x: 0, y: 0 });

  g.fillStyle(0x1a1a1f);
  g.fillRect(0, 0, size, size);

  // Stone block pattern
  const block = r(8);
  for (let bx = 0; bx < size; bx += block) {
    for (let by = 0; by < size; by += block) {
      g.fillStyle(0x1e1e24 + Math.floor(Math.random() * 0x080808));
      g.fillRect(bx + 1, by + 1, block - 2, block - 2);
    }
  }

  // Cracks
  g.fillStyle(0x0d0d12);
  for (let i = 0; i < r(4); i++) {
    g.fillRect(
      Math.floor(Math.random() * (size - 4)),
      Math.floor(Math.random() * (size - 6)),
      r(1),
      r(3)
    );
  }

  // Moss specks
  g.fillStyle(0x2d3a2d);
  g.fillRect(r(5), r(10), r(2), r(2));
  g.fillRect(r(22), r(6), r(2), r(1));

  g.generateTexture("dungeon_ground", size, size);
  g.destroy();
}

function generateDungeonEntrance(scene: Phaser.Scene): void {
  const w = r(200),
    h = r(180);
  const g = scene.make.graphics({ x: 0, y: 0 });
  const cx = w / 2;

  // Outer stone body
  g.fillStyle(0x2a2a30);
  g.fillRect(r(10), r(30), w - r(20), h - r(30));
  // Left wall (lighter) / Right wall (darker)
  g.fillStyle(0x333338);
  g.fillRect(0, r(20), r(40), h - r(20));
  g.fillStyle(0x252529);
  g.fillRect(w - r(40), r(20), r(40), h - r(20));

  // Arch top + keystone
  g.fillStyle(0x3a3a42);
  g.fillRect(r(20), 0, w - r(40), r(35));
  g.fillStyle(0x444450);
  g.fillRect(cx - r(15), 0, r(30), r(25));

  // Dark entrance void with depth layers
  g.fillStyle(0x050508);
  g.fillRect(r(45), r(35), w - r(90), h - r(45));
  g.fillStyle(0x0a0a10, 0.8);
  g.fillRect(r(50), r(40), w - r(100), h - r(55));
  g.fillStyle(0x030306, 0.9);
  g.fillRect(r(60), r(55), w - r(120), h - r(75));

  // Wall block lines
  g.fillStyle(0x3e3e46);
  for (let by = r(30); by < h; by += r(18)) {
    g.fillRect(r(2), by, r(36), r(1));
    g.fillRect(w - r(38), by, r(36), r(1));
  }

  // Skull decorations on arch (left + right)
  for (const sx of [r(30), w - r(40)]) {
    g.fillStyle(0xc8c8b0);
    g.fillRect(sx, r(10), r(10), r(10));
    g.fillStyle(0x0a0a10);
    g.fillRect(sx + r(1), r(12), r(3), r(3));
    g.fillRect(sx + r(6), r(12), r(3), r(3));
  }

  // Edge highlights
  g.fillStyle(0x4a4a55, 0.4);
  g.fillRect(0, r(20), r(3), h - r(20));
  g.fillStyle(0x111115, 0.5);
  g.fillRect(w - r(3), r(20), r(3), h - r(20));

  g.generateTexture("dungeon_entrance", w, h);
  g.destroy();

  // Entrance glow overlay
  const gw = r(120),
    gh = r(140);
  const glow = scene.make.graphics({ x: 0, y: 0 });
  glow.fillStyle(0x6b21a8, 0.15);
  glow.fillRect(0, 0, gw, gh);
  glow.fillStyle(0x7c3aed, 0.1);
  glow.fillRect(r(10), r(10), gw - r(20), gh - r(20));
  glow.fillStyle(0x8b5cf6, 0.08);
  glow.fillRect(r(20), r(20), gw - r(40), gh - r(40));
  glow.generateTexture("dungeon_glow", gw, gh);
  glow.destroy();
}

function generateDungeonTorch(scene: Phaser.Scene): void {
  const w = r(12),
    h = r(24);
  const g = scene.make.graphics({ x: 0, y: 0 });
  const cx = w / 2;

  // Handle + bracket
  g.fillStyle(0x3a3a3a);
  g.fillRect(cx - r(2), r(10), r(4), r(14));
  g.fillStyle(0x4a4a4a);
  g.fillRect(cx - r(4), r(10), r(8), r(3));
  // Bowl
  g.fillStyle(0x5a4a3a);
  g.fillRect(cx - r(4), r(7), r(8), r(4));
  // Flame: outer -> inner -> tip
  g.fillStyle(0xff8c00);
  g.fillRect(cx - r(3), r(2), r(6), r(6));
  g.fillStyle(0xffd700);
  g.fillRect(cx - r(2), r(3), r(4), r(4));
  g.fillStyle(0xfffacd);
  g.fillRect(cx - r(1), r(1), r(2), r(3));
  // Glow aura
  g.fillStyle(0xff6600, 0.25);
  g.fillRect(cx - r(5), 0, r(10), r(10));

  g.generateTexture("dungeon_torch", w, h);
  g.destroy();
}

function generateDungeonSkull(scene: Phaser.Scene): void {
  const size = r(10);
  const g = scene.make.graphics({ x: 0, y: 0 });

  g.fillStyle(0xc8c8b0);
  g.fillRect(r(1), 0, r(8), r(7));
  g.fillStyle(0xb8b8a0);
  g.fillRect(r(2), r(7), r(6), r(3));
  // Eyes
  g.fillStyle(0x1a1a1f);
  g.fillRect(r(2), r(2), r(3), r(3));
  g.fillRect(r(6), r(2), r(3), r(3));
  // Nose
  g.fillStyle(0x2a2a2f);
  g.fillRect(r(4), r(4), r(2), r(2));
  // Teeth
  g.fillStyle(0xd8d8c0);
  for (const tx of [3, 5, 7]) g.fillRect(r(tx), r(7), r(1), r(1));

  g.generateTexture("dungeon_skull", size, size);
  g.destroy();
}

function generateDungeonPillar(scene: Phaser.Scene): void {
  const w = r(20),
    h = r(60);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Capital (top)
  g.fillStyle(0x3e3e46);
  g.fillRect(0, 0, w, r(6));
  g.fillStyle(0x4a4a52);
  g.fillRect(r(1), r(1), w - r(2), r(3));
  // Shaft
  g.fillStyle(0x333340);
  g.fillRect(r(3), r(6), w - r(6), h - r(12));
  // Light/shadow edges
  g.fillStyle(0x42424e, 0.6);
  g.fillRect(r(3), r(6), r(2), h - r(12));
  g.fillStyle(0x222230, 0.6);
  g.fillRect(w - r(5), r(6), r(2), h - r(12));
  // Bands
  g.fillStyle(0x3a3a44);
  g.fillRect(r(3), r(20), w - r(6), r(2));
  g.fillRect(r(3), r(40), w - r(6), r(2));
  // Base
  g.fillStyle(0x3e3e46);
  g.fillRect(0, h - r(6), w, r(6));
  g.fillStyle(0x4a4a52);
  g.fillRect(r(1), h - r(5), w - r(2), r(3));

  g.generateTexture("dungeon_pillar", w, h);
  g.destroy();
}

function generateDungeonBanner(scene: Phaser.Scene): void {
  const w = r(16),
    h = r(32);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Rod
  g.fillStyle(0x4a4a4a);
  g.fillRect(0, 0, w, r(3));
  // Fabric + tapered bottom
  g.fillStyle(0x3b1261);
  g.fillRect(r(2), r(3), w - r(4), h - r(8));
  g.fillRect(r(3), h - r(8), w - r(6), r(3));
  g.fillRect(r(4), h - r(5), w - r(8), r(2));
  g.fillRect(r(6), h - r(3), w - r(12), r(2));
  // Sword emblem
  g.fillStyle(0xc9a832);
  g.fillRect(cx - r(1), r(8), r(2), r(12));
  g.fillRect(cx - r(4), r(12), r(8), r(2));
  // Highlight
  g.fillStyle(0x4c1a78, 0.5);
  g.fillRect(r(2), r(3), r(1), h - r(8));

  g.generateTexture("dungeon_banner", w, h);
  g.destroy();
}

function generateDungeonGate(scene: Phaser.Scene): void {
  const w = r(160),
    h = r(10);
  const g = scene.make.graphics({ x: 0, y: 0 });
  const spacing = r(12);

  // Horizontal bars
  g.fillStyle(0x3a3a3a);
  for (const y of [0, r(4), r(8)]) g.fillRect(0, y, w, r(2));
  // Vertical bars + highlights + rivets
  for (let x = 0; x < w; x += spacing) {
    g.fillStyle(0x444444);
    g.fillRect(x, 0, r(2), h);
    g.fillStyle(0x555555, 0.4);
    g.fillRect(x, 0, r(1), h);
    g.fillStyle(0x5a5a5a);
    g.fillRect(x, 0, r(3), r(3));
    g.fillRect(x, r(4), r(3), r(3));
  }

  g.generateTexture("dungeon_gate", w, h);
  g.destroy();
}

function generateDungeonTunnel(scene: Phaser.Scene): void {
  const w = r(40),
    h = r(50);
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Stone arch frame + rounded top
  g.fillStyle(0x2a2a32);
  g.fillRect(0, r(8), w, h - r(8));
  g.fillRect(r(3), r(4), w - r(6), r(6));
  g.fillRect(r(6), r(1), w - r(12), r(5));
  g.fillRect(r(10), 0, w - r(20), r(3));
  // Dark void + interior top
  g.fillStyle(0x08080e);
  g.fillRect(r(5), r(12), w - r(10), h - r(12));
  g.fillRect(r(8), r(7), w - r(16), r(7));
  g.fillRect(r(12), r(4), w - r(24), r(5));
  // Purple glow
  g.fillStyle(0x7c3aed, 0.25);
  g.fillRect(r(8), r(15), w - r(16), h - r(20));
  g.fillStyle(0x8b5cf6, 0.15);
  g.fillRect(r(10), r(20), w - r(20), h - r(28));
  // Block lines (both sides)
  g.fillStyle(0x353540);
  for (const y of [r(20), r(32)]) {
    g.fillRect(0, y, r(5), r(1));
    g.fillRect(w - r(5), y, r(5), r(1));
  }
  // Edge highlight/shadow
  g.fillStyle(0x3a3a46, 0.5);
  g.fillRect(0, r(8), r(2), h - r(8));
  g.fillStyle(0x16161e, 0.5);
  g.fillRect(w - r(2), r(8), r(2), h - r(8));
  // Keystone
  g.fillStyle(0x3e3e4a);
  g.fillRect(cx - r(4), 0, r(8), r(5));

  g.generateTexture("dungeon_tunnel", w, h);
  g.destroy();
}

export function generateDungeonAssets(scene: Phaser.Scene): void {
  generateDungeonGround(scene);
  generateDungeonEntrance(scene);
  generateDungeonTorch(scene);
  generateDungeonSkull(scene);
  generateDungeonPillar(scene);
  generateDungeonBanner(scene);
  generateDungeonGate(scene);
  generateDungeonTunnel(scene);
}
