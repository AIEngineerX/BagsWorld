import * as Phaser from "phaser";
import { PALETTE, darken, lighten } from "../../textures/constants";

export function generateEffectSprites(scene: Phaser.Scene): void {
  generateBulletSprites(scene);
  generateExplosionSprites(scene);
  generatePickupSprites(scene);
  generateGrenadeSprite(scene);
  generateParticleTextures(scene);
  generateScanlineTexture(scene);
}

// --- Bullets ---

function generateBulletSprites(scene: Phaser.Scene): void {
  // bullet_yellow (6x3) — Default pistol round
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.yellow);
    g.fillRect(0, 0, 6, 3);
    g.fillStyle(PALETTE.white);
    g.fillRect(4, 1, 2, 1);
    g.generateTexture("bullet_yellow", 6, 3);
    g.destroy();
  }

  // bullet_red (6x3) — Spread shot
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(0, 0, 6, 3);
    g.fillStyle(0xff9999);
    g.fillRect(4, 1, 2, 1);
    g.generateTexture("bullet_red", 6, 3);
    g.destroy();
  }

  // bullet_blue (8x3) — Heavy MG round
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.sky);
    g.fillRect(0, 0, 8, 3);
    g.fillStyle(0x93c5fd);
    g.fillRect(6, 1, 2, 1);
    g.fillStyle(darken(PALETTE.sky, 0.3));
    g.fillRect(0, 0, 2, 1);
    g.fillRect(0, 2, 2, 1);
    g.generateTexture("bullet_blue", 8, 3);
    g.destroy();
  }

  // bullet_enemy (6x3) — Orange enemy bullet
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.orange);
    g.fillRect(0, 0, 6, 3);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(4, 1, 2, 1);
    g.generateTexture("bullet_enemy", 6, 3);
    g.destroy();
  }

  // rocket (10x4) — Enemy rocket
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Body
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(0, 0, 8, 4);
    // Nose cone
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(8, 1, 2, 2);
    // Fins
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 0, 2, 1);
    g.fillRect(0, 3, 2, 1);
    // Exhaust
    g.fillStyle(PALETTE.orange);
    g.fillRect(0, 1, 1, 2);
    g.generateTexture("rocket", 10, 4);
    g.destroy();
  }
}

// --- Explosions (16x16 each) ---

function generateExplosionSprites(scene: Phaser.Scene): void {
  const S = 16;

  // explosion_1 — Small initial burst
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.white);
    g.fillRect(6, 6, 4, 4);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(5, 5, 6, 6);
    g.fillStyle(PALETTE.white);
    g.fillRect(7, 7, 2, 2);
    g.generateTexture("explosion_1", S, S);
    g.destroy();
  }

  // explosion_2 — Growing
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.orange);
    g.fillRect(3, 3, 10, 10);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(4, 4, 8, 8);
    g.fillStyle(PALETTE.white);
    g.fillRect(6, 6, 4, 4);
    // Sparks
    g.fillStyle(PALETTE.yellow);
    g.fillRect(1, 7, 2, 2);
    g.fillRect(13, 6, 2, 2);
    g.fillRect(7, 1, 2, 2);
    g.fillRect(6, 13, 2, 2);
    g.generateTexture("explosion_2", S, S);
    g.destroy();
  }

  // explosion_3 — Peak
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.red);
    g.fillRect(1, 1, 14, 14);
    g.fillStyle(PALETTE.orange);
    g.fillRect(2, 2, 12, 12);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(4, 4, 8, 8);
    g.fillStyle(PALETTE.white);
    g.fillRect(6, 6, 4, 4);
    // Outer sparks
    g.fillStyle(PALETTE.orange);
    g.fillRect(0, 5, 1, 3);
    g.fillRect(15, 6, 1, 3);
    g.fillRect(6, 0, 3, 1);
    g.fillRect(5, 15, 3, 1);
    g.fillRect(1, 1, 2, 2);
    g.fillRect(13, 1, 2, 2);
    g.fillRect(1, 13, 2, 2);
    g.fillRect(13, 13, 2, 2);
    g.generateTexture("explosion_3", S, S);
    g.destroy();
  }

  // explosion_4 — Fading smoke
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(2, 2, 12, 12);
    g.fillStyle(PALETTE.silver);
    g.fillRect(4, 3, 8, 10);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(3, 5, 10, 6);
    // Fading embers
    g.fillStyle(PALETTE.orange);
    g.fillRect(5, 8, 2, 2);
    g.fillRect(10, 6, 1, 1);
    g.generateTexture("explosion_4", S, S);
    g.destroy();
  }
}

// --- Pickups (16x16) ---

function generatePickupSprites(scene: Phaser.Scene): void {
  const S = 16;

  function drawPickupBox(
    g: Phaser.GameObjects.Graphics,
    color: number,
    label: string,
  ) {
    // Outer box
    g.fillStyle(darken(color, 0.3));
    g.fillRect(0, 0, S, S);
    // Inner box
    g.fillStyle(color);
    g.fillRect(1, 1, 14, 14);
    // Highlight top-left
    g.fillStyle(lighten(color, 0.25));
    g.fillRect(1, 1, 14, 1);
    g.fillRect(1, 1, 1, 14);
    // Shadow bottom-right
    g.fillStyle(darken(color, 0.2));
    g.fillRect(1, 14, 14, 1);
    g.fillRect(14, 1, 1, 14);
    // Draw letter (crude 5x5 pixel font centered)
    g.fillStyle(PALETTE.white);
    drawPixelLetter(g, 6, 5, label);
    // Sparkle corners
    g.fillStyle(PALETTE.white);
    g.fillRect(2, 2, 1, 1);
    g.fillRect(13, 2, 1, 1);
  }

  // pickup_spread — Red "S"
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPickupBox(g, PALETTE.brightRed, "S");
    g.generateTexture("pickup_spread", S, S);
    g.destroy();
  }

  // pickup_heavy — Blue "H"
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPickupBox(g, PALETTE.sky, "H");
    g.generateTexture("pickup_heavy", S, S);
    g.destroy();
  }

  // pickup_health — Green "+"
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPickupBox(g, PALETTE.green, "+");
    g.generateTexture("pickup_health", S, S);
    g.destroy();
  }

  // pickup_grenade — Orange "G"
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPickupBox(g, PALETTE.orange, "G");
    g.generateTexture("pickup_grenade", S, S);
    g.destroy();
  }
}

// Simple pixel letter renderer (5px tall, variable width)
function drawPixelLetter(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  letter: string,
) {
  // Each letter defined as array of [dx, dy] pixel positions
  const letters: Record<string, [number, number][]> = {
    S: [
      [1, 0], [2, 0], [3, 0],
      [0, 1],
      [1, 2], [2, 2],
      [3, 3],
      [0, 4], [1, 4], [2, 4],
    ],
    H: [
      [0, 0], [3, 0],
      [0, 1], [3, 1],
      [0, 2], [1, 2], [2, 2], [3, 2],
      [0, 3], [3, 3],
      [0, 4], [3, 4],
    ],
    "+": [
      [1, 0],
      [0, 1], [1, 1], [2, 1],
      [1, 2],
    ],
    G: [
      [1, 0], [2, 0], [3, 0],
      [0, 1],
      [0, 2], [2, 2], [3, 2],
      [0, 3], [3, 3],
      [1, 4], [2, 4], [3, 4],
    ],
  };

  const pts = letters[letter];
  if (pts) {
    for (const [dx, dy] of pts) {
      g.fillRect(x + dx, y + dy, 1, 1);
    }
  }
}

// --- Grenade (8x8) ---

function generateGrenadeSprite(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const green = PALETTE.forest;

  // Body (rounded via pixel blocks)
  g.fillStyle(green);
  g.fillRect(2, 1, 4, 6);
  g.fillRect(1, 2, 6, 4);

  // Highlight
  g.fillStyle(lighten(green, 0.2));
  g.fillRect(2, 2, 2, 2);

  // Shadow
  g.fillStyle(darken(green, 0.25));
  g.fillRect(4, 4, 2, 2);

  // Pin/lever on top
  g.fillStyle(PALETTE.lightGray);
  g.fillRect(3, 0, 2, 1);
  g.fillStyle(PALETTE.silver);
  g.fillRect(5, 0, 1, 2);

  g.generateTexture("grenade", 8, 8);
  g.destroy();
}

// --- Particle textures (tiny sprites for burst effects) ---

function generateParticleTextures(scene: Phaser.Scene): void {
  // particle_spark (2x2 white)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.white);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture("particle_spark", 2, 2);
    g.destroy();
  }

  // particle_dust (3x3 gray — urban concrete dust)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.gray);
    g.fillRect(0, 0, 3, 3);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(1, 1, 1, 1);
    g.generateTexture("particle_dust", 3, 3);
    g.destroy();
  }

  // particle_shell (3x2 brass)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xd4a017);
    g.fillRect(0, 0, 3, 2);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(2, 0, 1, 1);
    g.generateTexture("particle_shell", 3, 2);
    g.destroy();
  }

  // particle_muzzle (6x6 yellow-white)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.yellow);
    g.fillRect(1, 0, 4, 6);
    g.fillRect(0, 1, 6, 4);
    g.fillStyle(PALETTE.white);
    g.fillRect(2, 2, 2, 2);
    g.generateTexture("particle_muzzle", 6, 6);
    g.destroy();
  }

  // particle_fire (4x4 orange-red)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.orange);
    g.fillRect(0, 0, 4, 4);
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(1, 0, 2, 2);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(1, 2, 2, 1);
    g.generateTexture("particle_fire", 4, 4);
    g.destroy();
  }

  // particle_debris (3x3 gray — concrete/brick debris)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, 0, 3, 3);
    g.fillStyle(PALETTE.gray);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture("particle_debris", 3, 3);
    g.destroy();
  }
}

// --- CRT scanline overlay ---

function generateScanlineTexture(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x000000, 0.15);
  for (let y = 0; y < 270; y += 2) {
    g.fillRect(0, y, 480, 1);
  }
  g.generateTexture("scanlines", 480, 270);
  g.destroy();
}
