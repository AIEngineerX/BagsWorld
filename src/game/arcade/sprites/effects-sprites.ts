import * as Phaser from "phaser";
import { PALETTE, darken, lighten } from "../../textures/constants";

export function generateEffectSprites(scene: Phaser.Scene): void {
  generateBulletSprites(scene);
  generateExplosionSprites(scene);
  generateLargeExplosionSprites(scene);
  generatePickupSprites(scene);
  generateGrenadeSprite(scene);
  generateParticleTextures(scene);
  generateCrateChunkSprites(scene);
  generateRagdollSprites(scene);
  generateBossRagdollSprites(scene);
  generateScanlineTexture(scene);
  generateShockwaveSprites(scene);
  generateSmokePuffs(scene);
  generateVignetteTexture(scene);
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

// --- Large Explosions (32x32) — for grenades ---

function generateLargeExplosionSprites(scene: Phaser.Scene): void {
  const S = 32;

  // explosion_large_1 — Bright white/yellow flash
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.white);
    g.fillRect(10, 10, 12, 12);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(8, 8, 16, 16);
    g.fillStyle(PALETTE.white);
    g.fillRect(12, 12, 8, 8);
    g.generateTexture("explosion_large_1", S, S);
    g.destroy();
  }

  // explosion_large_2 — Expanding fireball
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.orange);
    g.fillRect(4, 4, 24, 24);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(6, 6, 20, 20);
    g.fillStyle(PALETTE.white);
    g.fillRect(10, 10, 12, 12);
    // Spark rays
    g.fillStyle(PALETTE.yellow);
    g.fillRect(0, 14, 4, 4);
    g.fillRect(28, 13, 4, 4);
    g.fillRect(13, 0, 4, 4);
    g.fillRect(14, 28, 4, 4);
    g.generateTexture("explosion_large_2", S, S);
    g.destroy();
  }

  // explosion_large_3 — Peak with debris
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.red);
    g.fillRect(2, 2, 28, 28);
    g.fillStyle(PALETTE.orange);
    g.fillRect(4, 4, 24, 24);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(8, 8, 16, 16);
    g.fillStyle(PALETTE.white);
    g.fillRect(12, 12, 8, 8);
    // Debris flying outward
    g.fillStyle(PALETTE.orange);
    g.fillRect(0, 8, 3, 3);
    g.fillRect(29, 10, 3, 3);
    g.fillRect(10, 0, 3, 3);
    g.fillRect(8, 29, 3, 3);
    g.fillRect(1, 1, 3, 3);
    g.fillRect(28, 1, 3, 3);
    g.fillRect(1, 28, 3, 3);
    g.fillRect(28, 28, 3, 3);
    g.generateTexture("explosion_large_3", S, S);
    g.destroy();
  }

  // explosion_large_4 — Red-orange with outward smoke
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.red);
    g.fillRect(3, 3, 26, 26);
    g.fillStyle(PALETTE.orange);
    g.fillRect(6, 6, 20, 20);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(10, 10, 12, 12);
    // Smoke wisps at edges
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 6, 3, 4);
    g.fillRect(29, 8, 3, 4);
    g.fillRect(7, 0, 4, 3);
    g.fillRect(5, 29, 4, 3);
    g.generateTexture("explosion_large_4", S, S);
    g.destroy();
  }

  // explosion_large_5 — Mostly smoke
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(4, 4, 24, 24);
    g.fillStyle(PALETTE.silver);
    g.fillRect(6, 5, 20, 22);
    g.fillStyle(PALETTE.midGray);
    g.fillRect(8, 8, 16, 16);
    // Fading embers
    g.fillStyle(PALETTE.orange);
    g.fillRect(10, 14, 3, 3);
    g.fillRect(18, 12, 2, 2);
    g.fillRect(14, 20, 2, 2);
    g.generateTexture("explosion_large_5", S, S);
    g.destroy();
  }

  // explosion_large_6 — Dissipating thin smoke
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.midGray, 0.6);
    g.fillRect(6, 6, 20, 20);
    g.fillStyle(PALETTE.lightGray, 0.4);
    g.fillRect(8, 8, 16, 16);
    g.fillStyle(PALETTE.silver, 0.3);
    g.fillRect(10, 10, 12, 12);
    g.generateTexture("explosion_large_6", S, S);
    g.destroy();
  }
}

// --- Pickups (16x16) ---

function generatePickupSprites(scene: Phaser.Scene): void {
  const S = 16;

  function drawPickupBox(g: Phaser.GameObjects.Graphics, color: number) {
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
    // Sparkle corners
    g.fillStyle(PALETTE.white);
    g.fillRect(2, 2, 1, 1);
    g.fillRect(13, 2, 1, 1);
  }

  // pickup_spread — Red box with shotgun silhouette
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPickupBox(g, PALETTE.brightRed);
    g.fillStyle(PALETTE.white);
    // Angled barrel fanning into 3 spread lines
    g.fillRect(4, 8, 5, 1); // barrel base
    g.fillRect(9, 6, 2, 1); // top spread line
    g.fillRect(9, 8, 2, 1); // middle spread line
    g.fillRect(9, 10, 2, 1); // bottom spread line
    g.fillRect(11, 5, 1, 1); // top spread tip
    g.fillRect(11, 8, 1, 1); // middle spread tip
    g.fillRect(11, 11, 1, 1); // bottom spread tip
    g.fillRect(4, 9, 2, 1); // stock
    g.generateTexture("pickup_spread", S, S);
    g.destroy();
  }

  // pickup_heavy — Blue box with machine gun silhouette
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPickupBox(g, PALETTE.sky);
    g.fillStyle(PALETTE.white);
    // Long barrel
    g.fillRect(3, 6, 9, 1); // barrel
    g.fillRect(3, 7, 7, 1); // body
    g.fillRect(12, 5, 1, 2); // muzzle tip
    // Ammo box underneath
    g.fillRect(5, 8, 3, 3); // ammo box
    g.fillRect(6, 8, 1, 1); // ammo highlight
    // Stock
    g.fillRect(3, 7, 1, 2); // rear grip
    g.generateTexture("pickup_heavy", S, S);
    g.destroy();
  }

  // pickup_health — Green box with medical cross (3px wide arms, white outline)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPickupBox(g, PALETTE.green);
    // White outline of cross
    g.fillStyle(PALETTE.white);
    g.fillRect(5, 4, 5, 1); // top outline
    g.fillRect(5, 12, 5, 1); // bottom outline
    g.fillRect(4, 5, 1, 7); // left side outline (vertical)
    g.fillRect(10, 5, 1, 7); // right side outline (vertical)
    g.fillRect(4, 6, 7, 1); // left arm top outline
    g.fillRect(4, 10, 7, 1); // left arm bottom outline
    g.fillRect(3, 6, 1, 5); // far left outline
    g.fillRect(11, 6, 1, 5); // far right outline
    // Inner cross fill
    g.fillStyle(PALETTE.white);
    g.fillRect(6, 5, 3, 7); // vertical arm
    g.fillRect(5, 7, 5, 3); // horizontal arm (overlaps center)
    g.generateTexture("pickup_health", S, S);
    g.destroy();
  }

  // pickup_grenade — Orange box with grenade silhouette
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawPickupBox(g, PALETTE.orange);
    g.fillStyle(PALETTE.white);
    // Oval body
    g.fillRect(5, 7, 5, 4); // main body
    g.fillRect(6, 6, 3, 6); // taller center body
    // Pin on top
    g.fillRect(7, 4, 1, 2); // lever stem
    g.fillRect(6, 4, 3, 1); // lever top
    g.fillRect(9, 4, 1, 2); // pin ring right
    g.fillRect(8, 3, 2, 1); // pin ring top
    g.generateTexture("pickup_grenade", S, S);
    g.destroy();
  }
}

// Simple pixel letter renderer (5px tall, variable width)
function drawPixelLetter(g: Phaser.GameObjects.Graphics, x: number, y: number, letter: string) {
  // Each letter defined as array of [dx, dy] pixel positions
  const letters: Record<string, [number, number][]> = {
    S: [
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [1, 2],
      [2, 2],
      [3, 3],
      [0, 4],
      [1, 4],
      [2, 4],
    ],
    H: [
      [0, 0],
      [3, 0],
      [0, 1],
      [3, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
      [0, 3],
      [3, 3],
      [0, 4],
      [3, 4],
    ],
    "+": [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    G: [
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [0, 2],
      [2, 2],
      [3, 2],
      [0, 3],
      [3, 3],
      [1, 4],
      [2, 4],
      [3, 4],
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

  // particle_ember (3x3 orange-red)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.orange, 0.7);
    g.fillRect(0, 0, 3, 3);
    g.fillStyle(PALETTE.yellow);
    g.fillRect(1, 1, 1, 1);
    g.generateTexture("particle_ember", 3, 3);
    g.destroy();
  }

  // particle_dust_mote (2x2 subtle dust)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.silver, 0.3);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture("particle_dust_mote", 2, 2);
    g.destroy();
  }
}

// --- Crate debris chunks (6x6 each, 4 variants) ---

function generateCrateChunkSprites(scene: Phaser.Scene): void {
  const S = 6;

  // crate_chunk_1 — Solid plank
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.brown);
    g.fillRect(0, 0, S, S);
    g.fillStyle(lighten(PALETTE.brown, 0.25));
    g.fillRect(0, 0, S, 1);
    g.fillRect(0, 0, 1, S);
    g.fillStyle(darken(PALETTE.brown, 0.2));
    g.fillRect(0, 5, S, 1);
    g.fillRect(5, 0, 1, S);
    g.fillStyle(PALETTE.orange);
    g.fillRect(1, 1, 1, 1);
    g.generateTexture("crate_chunk_1", S, S);
    g.destroy();
  }

  // crate_chunk_2 — Darker shard
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(darken(PALETTE.brown, 0.15));
    g.fillRect(0, 0, S, S);
    g.fillStyle(PALETTE.brown);
    g.fillRect(1, 1, 4, 4);
    g.fillStyle(lighten(PALETTE.brown, 0.2));
    g.fillRect(1, 1, 1, 1);
    g.generateTexture("crate_chunk_2", S, S);
    g.destroy();
  }

  // crate_chunk_3 — Light splinter
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.orange);
    g.fillRect(0, 0, S, S);
    g.fillStyle(PALETTE.brown);
    g.fillRect(0, 2, S, 2);
    g.fillStyle(lighten(PALETTE.orange, 0.3));
    g.fillRect(2, 0, 1, 1);
    g.fillStyle(darken(PALETTE.brown, 0.25));
    g.fillRect(5, 4, 1, 2);
    g.generateTexture("crate_chunk_3", S, S);
    g.destroy();
  }

  // crate_chunk_4 — Small nub
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.brown);
    g.fillRect(1, 0, 4, S);
    g.fillRect(0, 1, S, 4);
    g.fillStyle(lighten(PALETTE.brown, 0.15));
    g.fillRect(1, 1, 2, 2);
    g.fillStyle(darken(PALETTE.brown, 0.3));
    g.fillRect(3, 3, 2, 2);
    g.generateTexture("crate_chunk_4", S, S);
    g.destroy();
  }
}

// --- Ragdoll body part sprites ---

function generateRagdollSprites(scene: Phaser.Scene): void {
  // ---- Soldier ragdoll parts (Corrupted Agent — deep purple body, red visor) ----

  // soldier_torso (8x12)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.deepPurple);
    g.fillRect(0, 0, 8, 12);
    g.fillStyle(lighten(PALETTE.deepPurple, 0.15));
    g.fillRect(0, 0, 1, 12);
    g.fillStyle(darken(PALETTE.deepPurple, 0.2));
    g.fillRect(7, 0, 1, 12);
    // Purple accent stripe
    g.fillStyle(PALETTE.purple);
    g.fillRect(3, 1, 2, 9);
    // Glitch line
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(0, 4, 8, 1);
    // Belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, 10, 8, 1);
    g.generateTexture("soldier_torso", 8, 12);
    g.destroy();
  }

  // soldier_head (8x8)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Hood
    g.fillStyle(PALETTE.deepPurple);
    g.fillRect(1, 0, 6, 4);
    g.fillStyle(darken(PALETTE.deepPurple, 0.2));
    g.fillRect(1, 3, 6, 1);
    // Face/visor area
    g.fillStyle(PALETTE.void);
    g.fillRect(1, 4, 6, 4);
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(2, 6, 4, 1);
    g.fillStyle(lighten(PALETTE.brightRed, 0.3));
    g.fillRect(2, 6, 1, 1);
    g.generateTexture("soldier_head", 8, 8);
    g.destroy();
  }

  // soldier_arm (4x10)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.deepPurple);
    g.fillRect(0, 0, 4, 8);
    g.fillStyle(lighten(PALETTE.deepPurple, 0.1));
    g.fillRect(0, 0, 1, 8);
    // Glove/hand
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 8, 4, 2);
    g.generateTexture("soldier_arm", 4, 10);
    g.destroy();
  }

  // soldier_leg (4x12)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.deepPurple);
    g.fillRect(0, 0, 4, 8);
    g.fillStyle(darken(PALETTE.deepPurple, 0.1));
    g.fillRect(0, 4, 4, 1);
    // Boot
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, 8, 4, 4);
    g.fillStyle(darken(PALETTE.darkGray, 0.2));
    g.fillRect(0, 11, 4, 1);
    g.generateTexture("soldier_leg", 4, 12);
    g.destroy();
  }

  // ---- Heavy ragdoll parts (Rogue Bot — gray armor, red visor) ----

  // heavy_torso (12x14)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.gray);
    g.fillRect(0, 0, 12, 14);
    g.fillStyle(lighten(PALETTE.gray, 0.12));
    g.fillRect(0, 0, 1, 14);
    g.fillStyle(darken(PALETTE.gray, 0.25));
    g.fillRect(11, 0, 1, 14);
    // Chest plate
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(2, 2, 8, 6);
    g.fillStyle(darken(PALETTE.darkGray, 0.15));
    g.fillRect(5, 2, 1, 6);
    g.fillRect(2, 4, 8, 1);
    // Reactor core
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(5, 5, 2, 2);
    // Belt
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, 12, 12, 1);
    g.generateTexture("heavy_torso", 12, 14);
    g.destroy();
  }

  // heavy_head (10x8)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.gray);
    g.fillRect(1, 0, 8, 7);
    g.fillStyle(lighten(PALETTE.gray, 0.15));
    g.fillRect(1, 0, 1, 7);
    // Antenna
    g.fillStyle(PALETTE.midGray);
    g.fillRect(7, 0, 2, 1);
    // Green LED
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(8, 1, 1, 1);
    // Visor
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(3, 4, 5, 2);
    g.fillStyle(lighten(PALETTE.brightRed, 0.3));
    g.fillRect(3, 4, 1, 1);
    g.generateTexture("heavy_head", 10, 8);
    g.destroy();
  }

  // heavy_arm (6x10)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.gray);
    g.fillRect(0, 0, 6, 8);
    g.fillStyle(lighten(PALETTE.gray, 0.1));
    g.fillRect(0, 0, 1, 8);
    // Robot hand
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 8, 6, 2);
    g.generateTexture("heavy_arm", 6, 10);
    g.destroy();
  }

  // heavy_leg (6x14)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.gray);
    g.fillRect(0, 0, 6, 9);
    // Hydraulic piston
    g.fillStyle(PALETTE.silver);
    g.fillRect(0, 5, 2, 1);
    // Boot
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, 9, 6, 5);
    g.fillStyle(darken(PALETTE.darkGray, 0.2));
    g.fillRect(0, 13, 6, 1);
    g.generateTexture("heavy_leg", 6, 14);
    g.destroy();
  }
}

// --- Boss ragdoll parts (Mega Mech — deep purple hull, purple armor, red cockpit) ---

function generateBossRagdollSprites(scene: Phaser.Scene): void {
  const hull = PALETTE.deepPurple;
  const armorPlate = PALETTE.purple;
  const cockpit = PALETTE.brightRed;
  const tread = PALETTE.darkGray;
  const cannon = PALETTE.lightGray;

  // boss_hull (24x16) — main hull body
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(hull);
    g.fillRect(0, 0, 24, 16);
    g.fillStyle(lighten(hull, 0.12));
    g.fillRect(0, 0, 1, 16);
    g.fillStyle(darken(hull, 0.2));
    g.fillRect(23, 0, 1, 16);
    // Armor plating
    g.fillStyle(armorPlate);
    g.fillRect(2, 2, 20, 10);
    g.fillStyle(darken(armorPlate, 0.15));
    g.fillRect(2, 7, 20, 1);
    g.fillRect(12, 2, 1, 10);
    // Reactor
    g.fillStyle(cockpit);
    g.fillRect(10, 4, 4, 4);
    g.fillStyle(lighten(cockpit, 0.3));
    g.fillRect(11, 5, 2, 2);
    // Green accent
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(0, 14, 24, 1);
    g.generateTexture("boss_hull", 24, 16);
    g.destroy();
  }

  // boss_turret (16x10) — turret housing + cockpit
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(hull);
    g.fillRect(0, 0, 16, 10);
    g.fillStyle(lighten(hull, 0.15));
    g.fillRect(0, 0, 16, 1);
    // Cockpit
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(3, 2, 6, 5);
    g.fillStyle(cockpit);
    g.fillRect(4, 3, 4, 3);
    g.fillStyle(lighten(cockpit, 0.3));
    g.fillRect(5, 4, 1, 1);
    // Kill marks
    g.fillStyle(PALETTE.white);
    g.fillRect(11, 2, 1, 2);
    g.fillRect(13, 2, 1, 2);
    g.generateTexture("boss_turret", 16, 10);
    g.destroy();
  }

  // boss_cannon (12x4) — main gun barrel
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(cannon);
    g.fillRect(0, 0, 12, 4);
    g.fillStyle(lighten(cannon, 0.2));
    g.fillRect(0, 0, 12, 1);
    g.fillStyle(darken(cannon, 0.3));
    g.fillRect(0, 3, 12, 1);
    g.generateTexture("boss_cannon", 12, 4);
    g.destroy();
  }

  // boss_tread (20x8) — track section
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(tread);
    g.fillRect(0, 0, 20, 8);
    g.fillStyle(lighten(tread, 0.15));
    g.fillRect(0, 0, 20, 1);
    // Track links
    for (let i = 0; i < 5; i++) {
      g.fillStyle(i % 2 === 0 ? darken(tread, 0.3) : darken(tread, 0.15));
      g.fillRect(2 + i * 4, 2, 2, 5);
    }
    // Wheels
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 3, 4, 4);
    g.fillRect(14, 3, 4, 4);
    g.generateTexture("boss_tread", 20, 8);
    g.destroy();
  }

  // boss_armor_plate (10x8) — detached armor fragment
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(armorPlate);
    g.fillRect(0, 0, 10, 8);
    g.fillStyle(darken(armorPlate, 0.15));
    g.fillRect(0, 4, 10, 1);
    g.fillRect(5, 0, 1, 8);
    // Rivets
    g.fillStyle(lighten(armorPlate, 0.3));
    g.fillRect(1, 1, 1, 1);
    g.fillRect(8, 1, 1, 1);
    g.fillRect(1, 6, 1, 1);
    g.fillRect(8, 6, 1, 1);
    g.generateTexture("boss_armor_plate", 10, 8);
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

// --- Explosion shockwave ring (16x16) ---

function generateShockwaveSprites(scene: Phaser.Scene): void {
  const S = 16;
  const g = scene.make.graphics({ x: 0, y: 0 });
  // Draw a hollow ring ~12px diameter centered in 16x16
  // Using individual white pixels to trace a circle perimeter
  g.fillStyle(PALETTE.white);
  // Top arc
  g.fillRect(5, 1, 6, 1);
  // Upper sides
  g.fillRect(3, 2, 2, 1);
  g.fillRect(11, 2, 2, 1);
  // Upper-mid sides
  g.fillRect(2, 3, 1, 2);
  g.fillRect(13, 3, 1, 2);
  // Mid sides
  g.fillRect(1, 5, 1, 6);
  g.fillRect(14, 5, 1, 6);
  // Lower-mid sides
  g.fillRect(2, 11, 1, 2);
  g.fillRect(13, 11, 1, 2);
  // Lower sides
  g.fillRect(3, 13, 2, 1);
  g.fillRect(11, 13, 2, 1);
  // Bottom arc
  g.fillRect(5, 14, 6, 1);
  g.generateTexture("explosion_ring", S, S);
  g.destroy();
}

// --- Smoke puff animation frames ---

function generateSmokePuffs(scene: Phaser.Scene): void {
  // smoke_puff_1 (8x8): Small gray cloud
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.midGray);
    g.fillRect(1, 2, 5, 4); // base blob
    g.fillRect(2, 1, 3, 6); // taller center
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(2, 3, 3, 2); // lighter center
    g.generateTexture("smoke_puff_1", 8, 8);
    g.destroy();
  }

  // smoke_puff_2 (10x10): Medium expanding cloud
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.midGray);
    g.fillRect(1, 2, 7, 6); // main blob
    g.fillRect(2, 1, 6, 8); // taller center
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(3, 3, 4, 4); // lighter inner
    // Wispy edges
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 4, 1, 2); // left wisp
    g.fillRect(9, 3, 1, 3); // right wisp
    g.fillRect(4, 0, 2, 1); // top wisp
    g.fillRect(3, 9, 3, 1); // bottom wisp
    g.generateTexture("smoke_puff_2", 10, 10);
    g.destroy();
  }

  // smoke_puff_3 (12x12): Large dissipating cloud
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Semi-transparent edges
    g.fillStyle(PALETTE.midGray, 0.5);
    g.fillRect(0, 3, 12, 6); // wide faded base
    g.fillRect(2, 1, 8, 10); // tall faded core
    // Core cloud
    g.fillStyle(PALETTE.midGray);
    g.fillRect(2, 3, 8, 6); // main body
    g.fillRect(3, 2, 6, 8); // taller center
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(4, 4, 4, 4); // light center
    // 0.5 alpha edges
    g.fillStyle(PALETTE.lightGray, 0.5);
    g.fillRect(1, 4, 1, 4); // left fade
    g.fillRect(10, 4, 1, 4); // right fade
    g.fillRect(4, 1, 4, 1); // top fade
    g.fillRect(4, 10, 4, 1); // bottom fade
    g.generateTexture("smoke_puff_3", 12, 12);
    g.destroy();
  }
}

// --- Vignette overlay (480x270) ---

function generateVignetteTexture(scene: Phaser.Scene): void {
  const W = 480;
  const H = 270;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Outermost 20px border: alpha 0.3
  g.fillStyle(0x000000, 0.3);
  g.fillRect(0, 0, W, 20); // top
  g.fillRect(0, H - 20, W, 20); // bottom
  g.fillRect(0, 20, 20, H - 40); // left
  g.fillRect(W - 20, 20, 20, H - 40); // right

  // Next 15px: alpha 0.2
  g.fillStyle(0x000000, 0.2);
  g.fillRect(20, 20, W - 40, 15); // top
  g.fillRect(20, H - 35, W - 40, 15); // bottom
  g.fillRect(20, 35, 15, H - 70); // left
  g.fillRect(W - 35, 35, 15, H - 70); // right

  // Next 15px: alpha 0.1
  g.fillStyle(0x000000, 0.1);
  g.fillRect(35, 35, W - 70, 15); // top
  g.fillRect(35, H - 50, W - 70, 15); // bottom
  g.fillRect(35, 50, 15, H - 100); // left
  g.fillRect(W - 50, 50, 15, H - 100); // right

  // Next 10px: alpha 0.05
  g.fillStyle(0x000000, 0.05);
  g.fillRect(50, 50, W - 100, 10); // top
  g.fillRect(50, H - 60, W - 100, 10); // bottom
  g.fillRect(50, 60, 10, H - 120); // left
  g.fillRect(W - 60, 60, 10, H - 120); // right

  // Center is transparent (don't draw anything)

  g.generateTexture("vignette", W, H);
  g.destroy();
}
