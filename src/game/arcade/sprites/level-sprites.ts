import * as Phaser from "phaser";
import { PALETTE, darken, lighten } from "../../textures/constants";

export function generateLevelSprites(scene: Phaser.Scene): void {
  generatePlatforms(scene);
  generateGroundTextures(scene);
  generateProps(scene);
  generateBackgrounds(scene);
}

// --- Platforms (16x16) ---

function generatePlatforms(scene: Phaser.Scene): void {
  const T = 16;

  // platform_wood — Dark Brick
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const brick = 0x2a1a3e;
    g.fillStyle(brick);
    g.fillRect(0, 0, T, T);
    g.fillStyle(darken(brick, 0.25));
    g.fillRect(0, 4, T, 1);
    g.fillRect(0, 8, T, 1);
    g.fillRect(0, 12, T, 1);
    g.fillRect(4, 0, 1, 4);
    g.fillRect(12, 0, 1, 4);
    g.fillRect(8, 4, 1, 4);
    g.fillRect(0, 8, 1, 4);
    g.fillRect(4, 8, 1, 4);
    g.fillRect(12, 8, 1, 4);
    g.fillRect(8, 12, 1, 4);
    g.fillStyle(lighten(brick, 0.08));
    g.fillRect(2, 1, 2, 2);
    g.fillRect(9, 5, 2, 2);
    g.fillRect(5, 9, 3, 2);
    g.fillRect(13, 13, 2, 2);
    g.generateTexture("platform_wood", T, T);
    g.destroy();
  }

  // platform_metal — BagsCity Pavement
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const pavement = PALETTE.gray;
    g.fillStyle(pavement);
    g.fillRect(0, 0, T, T);
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(0, 0, T, 2);
    g.fillStyle(darken(pavement, 0.2));
    g.fillRect(3, 7, 5, 1);
    g.fillRect(10, 7, 3, 1);
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(3, 9, 4, 3);
    g.fillStyle(PALETTE.void);
    g.fillRect(4, 10, 2, 1);
    g.fillStyle(darken(pavement, 0.1));
    g.fillRect(1, 3, 1, 1);
    g.fillRect(8, 5, 1, 1);
    g.fillRect(14, 4, 1, 1);
    g.fillRect(11, 11, 1, 1);
    g.fillStyle(PALETTE.gold);
    g.fillRect(6, 13, 4, 1);
    g.generateTexture("platform_metal", T, T);
    g.destroy();
  }
}

// --- Section-specific ground textures (16x16 tiles) ---

function generateGroundTextures(scene: Phaser.Scene): void {
  const T = 16;

  // ground_concrete — Light gray with cracks and lane markings (S0, S2)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const base = PALETTE.gray;
    g.fillStyle(base);
    g.fillRect(0, 0, T, T);
    // Top surface highlight
    g.fillStyle(lighten(base, 0.12));
    g.fillRect(0, 0, T, 2);
    // Crack patterns
    g.fillStyle(darken(base, 0.2));
    g.fillRect(3, 3, 4, 1);
    g.fillRect(6, 4, 1, 3);
    g.fillRect(10, 7, 3, 1);
    g.fillRect(12, 8, 1, 2);
    // Pebble dots
    g.fillStyle(darken(base, 0.08));
    g.fillRect(1, 6, 1, 1);
    g.fillRect(8, 10, 1, 1);
    g.fillRect(14, 5, 1, 1);
    g.fillRect(5, 12, 1, 1);
    g.fillRect(11, 13, 1, 1);
    // Yellow lane marking
    g.fillStyle(PALETTE.gold);
    g.fillRect(6, 14, 4, 1);
    // Drain grate
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(2, 9, 3, 3);
    g.fillStyle(PALETTE.void);
    g.fillRect(3, 10, 1, 1);
    g.generateTexture("ground_concrete", T, T);
    g.destroy();
  }

  // ground_dirt — Brown earth with pebble dots (S1)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const dirt = 0x5c3d2e;
    g.fillStyle(dirt);
    g.fillRect(0, 0, T, T);
    // Top edge (grass hint)
    g.fillStyle(darken(PALETTE.forest, 0.3));
    g.fillRect(0, 0, T, 1);
    g.fillRect(2, 1, 3, 1);
    g.fillRect(8, 1, 2, 1);
    g.fillRect(13, 1, 2, 1);
    // Pebbles (lighter and darker dots)
    g.fillStyle(lighten(dirt, 0.15));
    g.fillRect(3, 4, 2, 1);
    g.fillRect(10, 6, 1, 1);
    g.fillRect(6, 9, 2, 1);
    g.fillRect(13, 11, 1, 1);
    g.fillRect(1, 13, 1, 1);
    g.fillStyle(darken(dirt, 0.15));
    g.fillRect(7, 3, 1, 1);
    g.fillRect(2, 7, 1, 1);
    g.fillRect(12, 8, 1, 1);
    g.fillRect(5, 11, 1, 1);
    g.fillRect(14, 14, 1, 1);
    // Root or worm line
    g.fillStyle(darken(dirt, 0.2));
    g.fillRect(4, 5, 1, 3);
    g.fillRect(5, 7, 2, 1);
    g.generateTexture("ground_dirt", T, T);
    g.destroy();
  }

  // ground_metal_grate — Industrial cross-hatch grating (S3, S5)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const metal = PALETTE.midGray;
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, 0, T, T);
    // Grate grid pattern
    g.fillStyle(metal);
    // Horizontal bars
    g.fillRect(0, 0, T, 2);
    g.fillRect(0, 7, T, 2);
    g.fillRect(0, 14, T, 2);
    // Vertical bars
    g.fillRect(0, 0, 2, T);
    g.fillRect(7, 0, 2, T);
    g.fillRect(14, 0, 2, T);
    // Top highlight on bars
    g.fillStyle(lighten(metal, 0.15));
    g.fillRect(0, 0, T, 1);
    g.fillRect(0, 7, T, 1);
    g.fillRect(0, 14, T, 1);
    // Dark gaps (holes in grate)
    g.fillStyle(PALETTE.void);
    g.fillRect(3, 3, 3, 3);
    g.fillRect(10, 3, 3, 3);
    g.fillRect(3, 10, 3, 3);
    g.fillRect(10, 10, 3, 3);
    // Rivet bolts
    g.fillStyle(lighten(metal, 0.2));
    g.fillRect(0, 0, 1, 1);
    g.fillRect(7, 0, 1, 1);
    g.fillRect(14, 0, 1, 1);
    g.fillRect(0, 7, 1, 1);
    g.fillRect(7, 7, 1, 1);
    g.fillRect(14, 7, 1, 1);
    g.generateTexture("ground_metal_grate", T, T);
    g.destroy();
  }

  // ground_rubble — Cracked ground with debris chunks (S4)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const stone = PALETTE.gray;
    g.fillStyle(stone);
    g.fillRect(0, 0, T, T);
    // Major crack
    g.fillStyle(darken(stone, 0.35));
    g.fillRect(2, 0, 1, 4);
    g.fillRect(3, 3, 1, 3);
    g.fillRect(4, 5, 1, 4);
    g.fillRect(5, 8, 1, 3);
    g.fillRect(6, 10, 1, 3);
    // Secondary crack
    g.fillRect(10, 2, 1, 3);
    g.fillRect(11, 4, 1, 4);
    g.fillRect(12, 7, 1, 3);
    // Debris chunks (raised lighter areas)
    g.fillStyle(lighten(stone, 0.12));
    g.fillRect(7, 1, 2, 2);
    g.fillRect(13, 5, 2, 2);
    g.fillRect(1, 10, 3, 2);
    g.fillRect(9, 12, 2, 2);
    // Dark chip holes
    g.fillStyle(darken(stone, 0.25));
    g.fillRect(8, 6, 1, 1);
    g.fillRect(14, 9, 1, 1);
    g.fillRect(3, 14, 1, 1);
    // Rebar exposure (orange-rust)
    g.fillStyle(0x8b4513);
    g.fillRect(5, 13, 3, 1);
    g.generateTexture("ground_rubble", T, T);
    g.destroy();
  }
}

// --- Props (12 types + crate) ---

function generateProps(scene: Phaser.Scene): void {
  // crate — Tech Supply Crate (16x16)
  {
    const T = 16;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, 0, T, T);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 0, T, 1);
    g.fillRect(0, 0, 1, T);
    g.fillRect(T - 1, 0, 1, T);
    g.fillRect(0, T - 1, T, 1);
    g.fillStyle(PALETTE.gray);
    g.fillRect(7, 1, 2, 14);
    g.fillRect(1, 7, 14, 2);
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(2, 2, 1, 1);
    g.fillRect(13, 2, 1, 1);
    g.fillRect(2, 13, 1, 1);
    g.fillRect(13, 13, 1, 1);
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(7, 7, 2, 2);
    g.generateTexture("crate", T, T);
    g.destroy();
  }

  // lamp_post (16x32) — Gray pole with yellow lamp and glow aura
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Pole
    g.fillStyle(PALETTE.midGray);
    g.fillRect(7, 8, 2, 24);
    // Pole highlight
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(7, 8, 1, 24);
    // Base plate
    g.fillStyle(PALETTE.gray);
    g.fillRect(5, 30, 6, 2);
    // Lamp housing
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(4, 4, 8, 4);
    // Lamp glow aura
    g.fillStyle(PALETTE.gold, 0.2);
    g.fillRect(2, 2, 12, 8);
    // Lamp bulb
    g.fillStyle(PALETTE.yellow);
    g.fillRect(5, 5, 6, 2);
    // Bright center
    g.fillStyle(PALETTE.white, 0.7);
    g.fillRect(7, 5, 2, 2);
    // Top cap
    g.fillStyle(PALETTE.gray);
    g.fillRect(5, 3, 6, 1);
    g.generateTexture("lamp_post", 16, 32);
    g.destroy();
  }

  // barrel (16x16) — Brown drum with ring bands
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const brown = 0x6b4226;
    // Body
    g.fillStyle(brown);
    g.fillRect(3, 2, 10, 12);
    // 3D left highlight
    g.fillStyle(lighten(brown, 0.2));
    g.fillRect(3, 2, 2, 12);
    // 3D right shadow
    g.fillStyle(darken(brown, 0.25));
    g.fillRect(11, 2, 2, 12);
    // Metal rim top
    g.fillStyle(PALETTE.midGray);
    g.fillRect(3, 1, 10, 2);
    g.fillStyle(lighten(PALETTE.midGray, 0.2));
    g.fillRect(3, 1, 10, 1);
    // Metal rim bottom
    g.fillStyle(PALETTE.midGray);
    g.fillRect(3, 13, 10, 2);
    // Ring bands
    g.fillStyle(PALETTE.gray);
    g.fillRect(3, 5, 10, 1);
    g.fillRect(3, 10, 10, 1);
    // Top circle
    g.fillStyle(darken(brown, 0.1));
    g.fillRect(5, 2, 6, 1);
    g.generateTexture("barrel", 16, 16);
    g.destroy();
  }

  // sandbag_stack (16x16) — 3 stacked sandbags, pyramid style
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const sand = 0xc2a06e;
    // Bottom row (2 bags)
    g.fillStyle(sand);
    g.fillRect(1, 9, 6, 6);
    g.fillRect(9, 9, 6, 6);
    // Top bag
    g.fillRect(4, 3, 8, 6);
    // Bag seam lines
    g.fillStyle(darken(sand, 0.2));
    g.fillRect(4, 5, 1, 1);
    g.fillRect(11, 5, 1, 1);
    g.fillRect(1, 11, 1, 1);
    g.fillRect(6, 11, 1, 1);
    g.fillRect(9, 11, 1, 1);
    g.fillRect(14, 11, 1, 1);
    // Tie strings
    g.fillRect(8, 3, 1, 2);
    g.fillRect(4, 9, 1, 2);
    g.fillRect(12, 9, 1, 2);
    // Highlights
    g.fillStyle(lighten(sand, 0.15));
    g.fillRect(5, 3, 3, 1);
    g.fillRect(2, 9, 2, 1);
    g.fillRect(10, 9, 2, 1);
    // Shadow
    g.fillStyle(darken(sand, 0.15));
    g.fillRect(4, 8, 8, 1);
    g.fillRect(1, 14, 6, 1);
    g.fillRect(9, 14, 6, 1);
    g.generateTexture("sandbag_stack", 16, 16);
    g.destroy();
  }

  // broken_fence (16x32) — Chain-link with bent post, torn mesh
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const post = PALETTE.midGray;
    // Left post (bent)
    g.fillStyle(post);
    g.fillRect(2, 4, 2, 28);
    // Right post (broken off)
    g.fillRect(12, 16, 2, 16);
    // Post caps
    g.fillStyle(lighten(post, 0.2));
    g.fillRect(2, 3, 2, 1);
    g.fillRect(12, 15, 2, 1);
    // Chain-link mesh (torn)
    g.fillStyle(PALETTE.gray);
    // Diagonal mesh pattern
    for (let i = 0; i < 5; i++) {
      g.fillRect(4 + i * 2, 6 + i * 2, 1, 3);
      g.fillRect(5 + i * 2, 8 + i * 2, 1, 3);
    }
    // Torn edges
    g.fillStyle(darken(post, 0.15));
    g.fillRect(4, 14, 1, 1);
    g.fillRect(6, 16, 1, 1);
    g.fillRect(8, 15, 1, 1);
    g.fillRect(10, 18, 1, 1);
    // Hanging wire piece
    g.fillStyle(PALETTE.gray);
    g.fillRect(5, 18, 1, 3);
    g.fillRect(9, 20, 1, 4);
    // Base
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(1, 30, 4, 2);
    g.fillRect(11, 30, 4, 2);
    g.generateTexture("broken_fence", 16, 32);
    g.destroy();
  }

  // road_sign (16x32) — Metal post with dented sign
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Post
    g.fillStyle(PALETTE.midGray);
    g.fillRect(7, 10, 2, 22);
    g.fillStyle(lighten(PALETTE.midGray, 0.15));
    g.fillRect(7, 10, 1, 22);
    // Sign (diamond shape via rectangles)
    g.fillStyle(PALETTE.gold);
    g.fillRect(4, 2, 8, 8);
    // Sign border
    g.fillStyle(darken(PALETTE.gold, 0.3));
    g.fillRect(4, 2, 8, 1);
    g.fillRect(4, 9, 8, 1);
    g.fillRect(4, 2, 1, 8);
    g.fillRect(11, 2, 1, 8);
    // Dent mark
    g.fillStyle(darken(PALETTE.gold, 0.2));
    g.fillRect(6, 4, 3, 2);
    // Warning symbol (exclamation)
    g.fillStyle(PALETTE.void);
    g.fillRect(7, 3, 2, 4);
    g.fillRect(7, 8, 2, 1);
    // Base plate
    g.fillStyle(PALETTE.gray);
    g.fillRect(5, 30, 6, 2);
    g.generateTexture("road_sign", 16, 32);
    g.destroy();
  }

  // wrecked_car (32x16) — Burned-out car silhouette
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const car = PALETTE.darkGray;
    // Body
    g.fillStyle(car);
    g.fillRect(2, 6, 28, 8);
    // Roof
    g.fillRect(8, 2, 16, 5);
    // 3D highlight
    g.fillStyle(lighten(car, 0.1));
    g.fillRect(2, 6, 28, 1);
    g.fillRect(8, 2, 16, 1);
    // Windows (broken — dark with jagged edge)
    g.fillStyle(PALETTE.void);
    g.fillRect(10, 3, 5, 3);
    g.fillRect(17, 3, 5, 3);
    // Broken glass shards
    g.fillStyle(PALETTE.lightGray, 0.3);
    g.fillRect(10, 5, 1, 1);
    g.fillRect(14, 3, 1, 1);
    g.fillRect(19, 5, 1, 1);
    // Flat tires
    g.fillStyle(PALETTE.void);
    g.fillRect(5, 13, 4, 3);
    g.fillRect(23, 13, 4, 3);
    // Tire rims
    g.fillStyle(PALETTE.midGray);
    g.fillRect(6, 14, 2, 1);
    g.fillRect(24, 14, 2, 1);
    // Burn marks
    g.fillStyle(darken(car, 0.3));
    g.fillRect(4, 8, 3, 3);
    g.fillRect(20, 7, 4, 2);
    // Rust spots
    g.fillStyle(0x8b4513);
    g.fillRect(12, 8, 1, 1);
    g.fillRect(26, 9, 1, 1);
    g.fillRect(7, 10, 1, 1);
    g.generateTexture("wrecked_car", 32, 16);
    g.destroy();
  }

  // rubble_pile (16x16) — Irregular mound of brick and concrete
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const stone = PALETTE.gray;
    const brick = 0x6b3a3a;
    // Main mound shape
    g.fillStyle(stone);
    g.fillRect(2, 8, 12, 8);
    g.fillRect(4, 6, 8, 2);
    g.fillRect(6, 5, 4, 1);
    // Brick chunks
    g.fillStyle(brick);
    g.fillRect(3, 9, 3, 2);
    g.fillRect(8, 7, 2, 2);
    g.fillRect(10, 11, 3, 2);
    // Concrete chunks
    g.fillStyle(lighten(stone, 0.15));
    g.fillRect(5, 11, 2, 2);
    g.fillRect(7, 9, 2, 1);
    g.fillRect(12, 8, 2, 2);
    // Dark gaps
    g.fillStyle(darken(stone, 0.3));
    g.fillRect(4, 10, 1, 1);
    g.fillRect(9, 12, 1, 1);
    g.fillRect(7, 8, 1, 1);
    // Dust highlights
    g.fillStyle(PALETTE.silver, 0.3);
    g.fillRect(6, 5, 2, 1);
    g.fillRect(3, 8, 1, 1);
    g.generateTexture("rubble_pile", 16, 16);
    g.destroy();
  }

  // oil_drum (16x16) — Dark drum with hazard stripe
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const drum = PALETTE.darkGray;
    // Body
    g.fillStyle(drum);
    g.fillRect(3, 2, 10, 12);
    // 3D highlight
    g.fillStyle(lighten(drum, 0.15));
    g.fillRect(3, 2, 2, 12);
    // 3D shadow
    g.fillStyle(darken(drum, 0.2));
    g.fillRect(11, 2, 2, 12);
    // Top rim
    g.fillStyle(PALETTE.midGray);
    g.fillRect(3, 1, 10, 2);
    // Bottom rim
    g.fillRect(3, 13, 10, 2);
    // Hazard stripe (yellow/black diagonal)
    g.fillStyle(PALETTE.yellow);
    g.fillRect(4, 6, 8, 3);
    g.fillStyle(PALETTE.void);
    g.fillRect(5, 6, 2, 3);
    g.fillRect(9, 6, 2, 3);
    // Top circle detail
    g.fillStyle(darken(drum, 0.1));
    g.fillRect(5, 2, 6, 1);
    // Cap
    g.fillStyle(PALETTE.gray);
    g.fillRect(6, 1, 2, 1);
    g.generateTexture("oil_drum", 16, 16);
    g.destroy();
  }

  // traffic_cone (8x16) — Orange cone with reflective stripe
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const orange = PALETTE.orange;
    // Cone body (tapered)
    g.fillStyle(orange);
    g.fillRect(3, 2, 2, 4);
    g.fillRect(2, 6, 4, 4);
    g.fillRect(1, 10, 6, 4);
    // Reflective white stripe
    g.fillStyle(PALETTE.white);
    g.fillRect(2, 7, 4, 1);
    g.fillRect(1, 11, 6, 1);
    // Tip
    g.fillStyle(lighten(orange, 0.2));
    g.fillRect(3, 1, 2, 1);
    // Shadow side
    g.fillStyle(darken(orange, 0.2));
    g.fillRect(5, 6, 1, 4);
    g.fillRect(6, 10, 1, 4);
    // Base
    g.fillStyle(PALETTE.gray);
    g.fillRect(0, 14, 8, 2);
    g.generateTexture("traffic_cone", 8, 16);
    g.destroy();
  }

  // barbed_wire (16x8) — Horizontal wire run with barb points
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const wire = PALETTE.midGray;
    // Main wire strands
    g.fillStyle(wire);
    g.fillRect(0, 3, 16, 1);
    g.fillRect(0, 5, 16, 1);
    // Barb points every 4px
    g.fillStyle(lighten(wire, 0.2));
    g.fillRect(2, 1, 1, 2);
    g.fillRect(2, 6, 1, 2);
    g.fillRect(6, 2, 1, 2);
    g.fillRect(6, 5, 1, 2);
    g.fillRect(10, 1, 1, 2);
    g.fillRect(10, 6, 1, 2);
    g.fillRect(14, 2, 1, 2);
    g.fillRect(14, 5, 1, 2);
    // Wire twists
    g.fillStyle(darken(wire, 0.15));
    g.fillRect(4, 4, 1, 1);
    g.fillRect(8, 4, 1, 1);
    g.fillRect(12, 4, 1, 1);
    // Support post (left)
    g.fillStyle(PALETTE.gray);
    g.fillRect(0, 0, 1, 8);
    g.generateTexture("barbed_wire", 16, 8);
    g.destroy();
  }

  // computer_terminal (16x16) — Monitor with green screen glow + keyboard
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Monitor casing
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(2, 1, 12, 9);
    // Screen
    g.fillStyle(PALETTE.void);
    g.fillRect(3, 2, 10, 6);
    // Green screen glow
    g.fillStyle(PALETTE.bagsGreen, 0.15);
    g.fillRect(1, 0, 14, 11);
    // Screen content (text lines)
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(4, 3, 6, 1);
    g.fillRect(4, 5, 4, 1);
    g.fillRect(4, 7, 7, 1);
    // Cursor blink
    g.fillStyle(PALETTE.white);
    g.fillRect(11, 7, 1, 1);
    // Monitor stand
    g.fillStyle(PALETTE.midGray);
    g.fillRect(6, 10, 4, 2);
    // Keyboard
    g.fillStyle(PALETTE.gray);
    g.fillRect(2, 12, 12, 3);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(3, 13, 10, 1);
    // Key highlights
    g.fillStyle(lighten(PALETTE.gray, 0.1));
    g.fillRect(3, 12, 1, 1);
    g.fillRect(5, 12, 1, 1);
    g.fillRect(7, 12, 1, 1);
    g.fillRect(9, 12, 1, 1);
    g.fillRect(11, 12, 1, 1);
    // Power LED
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(13, 9, 1, 1);
    g.generateTexture("computer_terminal", 16, 16);
    g.destroy();
  }

  // dumpster (24x16) — Large green dumpster with lid and handles
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const dumpGreen = PALETTE.forest;
    // Body
    g.fillStyle(dumpGreen);
    g.fillRect(1, 4, 22, 10);
    // 3D highlight
    g.fillStyle(lighten(dumpGreen, 0.15));
    g.fillRect(1, 4, 1, 10);
    // 3D shadow
    g.fillStyle(darken(dumpGreen, 0.25));
    g.fillRect(22, 4, 1, 10);
    // Lid
    g.fillStyle(lighten(dumpGreen, 0.08));
    g.fillRect(1, 2, 22, 3);
    // Lid edge
    g.fillStyle(darken(dumpGreen, 0.15));
    g.fillRect(1, 4, 22, 1);
    // Handles
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 7, 1, 3);
    g.fillRect(23, 7, 1, 3);
    // Bottom rim
    g.fillStyle(darken(dumpGreen, 0.2));
    g.fillRect(1, 13, 22, 1);
    // Wheels
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(3, 14, 3, 2);
    g.fillRect(18, 14, 3, 2);
    // Stain/grunge
    g.fillStyle(darken(dumpGreen, 0.15));
    g.fillRect(8, 6, 3, 4);
    g.fillRect(15, 8, 2, 3);
    // Label area
    g.fillStyle(PALETTE.gray);
    g.fillRect(6, 5, 5, 1);
    g.generateTexture("dumpster", 24, 16);
    g.destroy();
  }
}

// --- Backgrounds (parallax layers) ---

function generateBackgrounds(scene: Phaser.Scene): void {
  // bg_city (480x270) — BagsWorld City Skyline with rooftop details
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const sky = 0x0f172a;
    const building1 = 0x1e293b;
    const building2 = 0x1a2332;
    const windowColors = [PALETTE.sky, PALETTE.bagsGreen, PALETTE.gold, PALETTE.cyan];

    g.fillStyle(sky);
    g.fillRect(0, 0, 480, 270);

    const buildings = [
      { x: 10, w: 30, h: 80 },
      { x: 45, w: 20, h: 60 },
      { x: 70, w: 35, h: 100 },
      { x: 110, w: 25, h: 70 },
      { x: 140, w: 40, h: 120 },
      { x: 185, w: 22, h: 55 },
      { x: 212, w: 38, h: 95 },
      { x: 255, w: 28, h: 75 },
      { x: 288, w: 42, h: 110 },
      { x: 335, w: 20, h: 50 },
      { x: 360, w: 32, h: 85 },
      { x: 397, w: 26, h: 65 },
      { x: 428, w: 35, h: 90 },
      { x: 465, w: 15, h: 45 },
    ];

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bColor = i % 2 === 0 ? building1 : building2;
      g.fillStyle(bColor);
      g.fillRect(b.x, 270 - b.h, b.w, b.h);
      g.fillStyle(lighten(bColor, 0.08));
      g.fillRect(b.x, 270 - b.h, 1, b.h);

      // Rooftop details: water towers, AC units, antenna spires
      if (b.h > 70) {
        // Water tower (small rectangle + legs)
        g.fillStyle(darken(bColor, 0.1));
        g.fillRect(b.x + 3, 270 - b.h - 6, 5, 4);
        g.fillRect(b.x + 4, 270 - b.h - 2, 1, 2);
        g.fillRect(b.x + 7, 270 - b.h - 2, 1, 2);
      }
      if (b.h > 80) {
        // Antenna spire
        g.fillStyle(PALETTE.midGray);
        g.fillRect(b.x + b.w - 4, 270 - b.h - 8, 1, 8);
        // Blinking light
        g.fillStyle(PALETTE.brightRed, 0.6);
        g.fillRect(b.x + b.w - 4, 270 - b.h - 8, 1, 1);
      }
      if (i % 3 === 0 && b.w > 25) {
        // AC unit boxes on roof
        g.fillStyle(darken(bColor, 0.15));
        g.fillRect(b.x + b.w - 8, 270 - b.h - 3, 4, 3);
        g.fillRect(b.x + b.w - 14, 270 - b.h - 2, 3, 2);
      }
      if (i % 4 === 1) {
        // Neon sign glow on building face
        const neonColor = windowColors[i % windowColors.length];
        g.fillStyle(neonColor, 0.2);
        g.fillRect(b.x + 2, 270 - b.h + 12, b.w - 4, 3);
        g.fillStyle(neonColor, 0.6);
        g.fillRect(b.x + 3, 270 - b.h + 13, b.w - 6, 1);
      }

      // Window grid
      for (let wy = 270 - b.h + 6; wy < 260; wy += 10) {
        for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 7) {
          if ((wx + wy) % 3 !== 0) {
            const color = windowColors[(wx * 7 + wy * 3 + i) % windowColors.length];
            g.fillStyle(color, 0.25);
            g.fillRect(wx - 1, wy - 1, 4, 5);
            g.fillStyle(color);
            g.fillRect(wx, wy, 2, 3);
            g.fillStyle(PALETTE.white, 0.5);
            g.fillRect(wx, wy, 1, 1);
          }
        }
      }
    }

    // Crane silhouette in background
    g.fillStyle(darken(building1, 0.3));
    g.fillRect(180, 80, 2, 60);
    g.fillRect(170, 78, 22, 2);
    g.fillRect(190, 80, 1, 10);

    g.generateTexture("bg_city", 480, 270);
    g.destroy();
  }

  // bg_mountains (480x135) — Distant Ruin Silhouettes with 3rd layer + smoke
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const H = 135;

    g.fillStyle(0x0a0f1a);
    g.fillRect(0, 0, 480, H);

    // Deepest layer (new): very faint distant ruins
    g.fillStyle(darken(PALETTE.night, 0.3));
    g.fillRect(5, H - 20, 15, 20);
    g.fillRect(25, H - 30, 12, 30);
    g.fillRect(42, H - 18, 18, 18);
    g.fillRect(75, H - 35, 10, 35);
    g.fillRect(105, H - 22, 15, 22);
    g.fillRect(135, H - 28, 12, 28);
    g.fillRect(170, H - 15, 20, 15);
    g.fillRect(210, H - 32, 14, 32);
    g.fillRect(240, H - 20, 16, 20);
    g.fillRect(270, H - 28, 10, 28);
    g.fillRect(300, H - 18, 18, 18);
    g.fillRect(330, H - 25, 12, 25);
    g.fillRect(365, H - 15, 15, 15);
    g.fillRect(395, H - 30, 14, 30);
    g.fillRect(425, H - 22, 12, 22);
    g.fillRect(450, H - 18, 16, 18);

    // Far layer
    g.fillStyle(PALETTE.night);
    g.fillRect(0, H - 30, 25, 30);
    g.fillRect(30, H - 45, 20, 45);
    g.fillRect(55, H - 25, 30, 25);
    g.fillRect(90, H - 55, 15, 55);
    g.fillRect(110, H - 35, 25, 35);
    g.fillRect(140, H - 60, 20, 60);
    g.fillRect(165, H - 40, 30, 40);
    g.fillRect(200, H - 20, 25, 20);
    g.fillRect(230, H - 50, 18, 50);
    g.fillRect(255, H - 30, 22, 30);
    g.fillRect(282, H - 55, 15, 55);
    g.fillRect(302, H - 25, 28, 25);
    g.fillRect(335, H - 45, 20, 45);
    g.fillRect(360, H - 35, 25, 35);
    g.fillRect(390, H - 50, 18, 50);
    g.fillRect(415, H - 30, 22, 30);
    g.fillRect(442, H - 40, 20, 40);
    g.fillRect(467, H - 25, 13, 25);
    // Antenna spires on far layer
    g.fillRect(95, H - 62, 2, 7);
    g.fillRect(148, H - 66, 2, 6);
    g.fillRect(287, H - 60, 2, 5);
    g.fillRect(396, H - 55, 2, 5);

    // Jagged ruin tops on far layer
    g.fillRect(33, H - 48, 2, 3);
    g.fillRect(143, H - 63, 3, 3);
    g.fillRect(233, H - 53, 2, 3);
    g.fillRect(338, H - 48, 2, 3);

    // Near layer
    g.fillStyle(PALETTE.shadow);
    g.fillRect(10, H - 50, 22, 50);
    g.fillRect(40, H - 65, 18, 65);
    g.fillRect(65, H - 40, 28, 40);
    g.fillRect(100, H - 70, 20, 70);
    g.fillRect(125, H - 45, 30, 45);
    g.fillRect(160, H - 55, 22, 55);
    g.fillRect(190, H - 35, 25, 35);
    g.fillRect(220, H - 60, 16, 60);
    g.fillRect(245, H - 45, 24, 45);
    g.fillRect(275, H - 65, 18, 65);
    g.fillRect(300, H - 40, 26, 40);
    g.fillRect(332, H - 55, 20, 55);
    g.fillRect(358, H - 30, 24, 30);
    g.fillRect(388, H - 50, 16, 50);
    g.fillRect(410, H - 65, 22, 65);
    g.fillRect(438, H - 35, 20, 35);
    g.fillRect(462, H - 45, 18, 45);
    // Antenna spires on near layer
    g.fillRect(108, H - 75, 2, 5);
    g.fillRect(226, H - 65, 2, 5);
    g.fillRect(418, H - 70, 2, 5);

    // Smoke haze bands
    g.fillStyle(PALETTE.midGray, 0.06);
    g.fillRect(0, H - 40, 480, 5);
    g.fillStyle(PALETTE.midGray, 0.04);
    g.fillRect(0, H - 60, 480, 4);

    // Signal lights on near layer
    g.fillStyle(PALETTE.brightRed, 0.4);
    g.fillRect(108, H - 75, 1, 1);
    g.fillRect(418, H - 70, 1, 1);
    g.fillStyle(PALETTE.bagsGreen, 0.3);
    g.fillRect(226, H - 65, 1, 1);

    // Window lights on near layer
    g.fillStyle(PALETTE.bagsGreen, 0.15);
    g.fillRect(15, H - 40, 1, 1);
    g.fillRect(18, H - 30, 1, 1);
    g.fillRect(46, H - 55, 1, 1);
    g.fillRect(48, H - 45, 1, 1);
    g.fillRect(105, H - 60, 1, 1);
    g.fillRect(110, H - 50, 1, 1);
    g.fillRect(165, H - 45, 1, 1);
    g.fillRect(222, H - 50, 1, 1);
    g.fillRect(280, H - 55, 1, 1);
    g.fillRect(338, H - 45, 1, 1);
    g.fillRect(414, H - 55, 1, 1);
    g.fillRect(420, H - 45, 1, 1);

    g.generateTexture("bg_mountains", 480, H);
    g.destroy();
  }

  // bg_sky (480x270) — BagsWorld Night Sky
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.void);
    g.fillRect(0, 0, 480, 135);
    g.fillStyle(0x0f172a);
    g.fillRect(0, 135, 480, 135);
    g.fillStyle(PALETTE.white);
    const stars = [
      [23, 12],
      [67, 45],
      [112, 8],
      [156, 34],
      [198, 22],
      [234, 55],
      [270, 15],
      [310, 40],
      [345, 9],
      [389, 52],
      [420, 28],
      [450, 18],
      [38, 70],
      [88, 88],
      [145, 65],
      [200, 92],
      [255, 78],
      [320, 85],
      [378, 62],
      [440, 72],
      [15, 110],
      [60, 125],
      [130, 105],
      [185, 118],
      [250, 108],
      [330, 120],
      [410, 95],
    ];
    stars.forEach(([sx, sy]) => g.fillRect(sx, sy, 1, 1));
    g.fillStyle(0xe2e8f0);
    g.fillRect(100, 30, 2, 2);
    g.fillRect(290, 20, 2, 2);
    g.fillRect(400, 50, 2, 2);
    g.fillStyle(PALETTE.bagsGreen, 0.4);
    g.fillRect(170, 42, 2, 2);
    g.fillStyle(PALETTE.purple, 0.4);
    g.fillRect(350, 35, 2, 2);
    g.generateTexture("bg_sky", 480, 270);
    g.destroy();
  }

  // bg_midground (480x135) — Close Silhouettes with fire escapes, awnings, dishes
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const MH = 135;
    const sil = PALETTE.void;
    g.fillStyle(0x0c1222);
    g.fillRect(0, 0, 480, MH);
    g.fillStyle(sil);
    // Buildings
    g.fillRect(20, MH - 60, 25, 60);
    g.fillRect(30, MH - 75, 10, 75);
    g.fillRect(80, MH - 50, 20, 50);
    g.fillRect(95, MH - 40, 15, 40);
    g.fillRect(150, MH - 70, 30, 70);
    g.fillRect(160, MH - 85, 10, 85);
    g.fillRect(175, MH - 55, 15, 55);
    g.fillRect(230, MH - 45, 25, 45);
    g.fillRect(250, MH - 65, 12, 65);
    g.fillRect(300, MH - 80, 20, 80);
    g.fillRect(315, MH - 60, 18, 60);
    g.fillRect(328, MH - 50, 12, 50);
    g.fillRect(380, MH - 55, 22, 55);
    g.fillRect(395, MH - 70, 15, 70);
    g.fillRect(440, MH - 45, 20, 45);
    g.fillRect(455, MH - 60, 15, 60);
    // Jagged ruin tops
    g.fillRect(22, MH - 62, 3, 5);
    g.fillRect(152, MH - 72, 4, 5);
    g.fillRect(302, MH - 83, 5, 6);
    g.fillRect(397, MH - 73, 3, 6);

    // Fire escape ladders (new)
    g.fillStyle(darken(PALETTE.midGray, 0.3));
    g.fillRect(43, MH - 70, 1, 40);
    g.fillRect(44, MH - 65, 3, 1);
    g.fillRect(44, MH - 55, 3, 1);
    g.fillRect(44, MH - 45, 3, 1);
    g.fillRect(44, MH - 35, 3, 1);

    g.fillRect(318, MH - 55, 1, 30);
    g.fillRect(319, MH - 50, 3, 1);
    g.fillRect(319, MH - 40, 3, 1);
    g.fillRect(319, MH - 30, 3, 1);

    // Awnings (new)
    g.fillStyle(darken(PALETTE.brightRed, 0.5));
    g.fillRect(85, MH - 30, 8, 2);
    g.fillStyle(darken(PALETTE.sky, 0.5));
    g.fillRect(235, MH - 25, 10, 2);
    g.fillStyle(darken(PALETTE.gold, 0.5));
    g.fillRect(445, MH - 28, 8, 2);

    // Satellite dishes (new)
    g.fillStyle(darken(PALETTE.midGray, 0.2));
    g.fillRect(155, MH - 74, 3, 2);
    g.fillRect(156, MH - 76, 1, 2);
    g.fillRect(305, MH - 84, 3, 2);
    g.fillRect(306, MH - 86, 1, 2);

    // Parked car silhouettes at ground (new)
    g.fillStyle(darken(sil, 0.1));
    g.fillRect(55, MH - 6, 12, 5);
    g.fillRect(58, MH - 9, 6, 3);
    g.fillRect(130, MH - 6, 10, 5);
    g.fillRect(133, MH - 8, 4, 2);
    g.fillRect(350, MH - 6, 14, 5);
    g.fillRect(354, MH - 9, 6, 3);

    // More windows (denser)
    g.fillStyle(PALETTE.bagsGreen, 0.3);
    g.fillRect(25, MH - 45, 2, 2);
    g.fillRect(165, MH - 70, 2, 2);
    g.fillRect(27, MH - 35, 2, 2);
    g.fillRect(162, MH - 60, 2, 2);
    g.fillStyle(PALETTE.sky, 0.3);
    g.fillRect(85, MH - 35, 2, 2);
    g.fillRect(305, MH - 65, 2, 2);
    g.fillRect(88, MH - 25, 2, 2);
    g.fillRect(308, MH - 55, 2, 2);
    g.fillStyle(PALETTE.gold, 0.3);
    g.fillRect(235, MH - 30, 2, 2);
    g.fillRect(385, MH - 40, 2, 2);
    g.fillRect(238, MH - 38, 2, 2);
    g.fillRect(388, MH - 48, 2, 2);
    g.fillStyle(PALETTE.cyan, 0.3);
    g.fillRect(445, MH - 30, 2, 2);
    g.fillRect(155, MH - 55, 2, 2);
    g.fillRect(448, MH - 38, 2, 2);
    g.fillRect(158, MH - 48, 2, 2);
    g.fillStyle(PALETTE.orange, 0.2);
    g.fillRect(397, MH - 60, 2, 2);
    g.fillRect(253, MH - 50, 2, 2);

    // Ground line
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, MH - 1, 480, 1);
    g.generateTexture("bg_midground", 480, MH);
    g.destroy();
  }
}
