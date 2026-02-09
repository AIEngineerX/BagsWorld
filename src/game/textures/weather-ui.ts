import * as Phaser from "phaser";
import { SCALE } from "./constants";

export function generateWeatherAssets(scene: Phaser.Scene): void {
  const s = SCALE;

  // Rain drop - enhanced
  const rainGraphics = scene.make.graphics({ x: 0, y: 0 });
  rainGraphics.fillStyle(0x60a5fa);
  rainGraphics.fillRect(Math.round(1 * s), 0, Math.round(2 * s), Math.round(8 * s));
  rainGraphics.fillStyle(0x93c5fd);
  rainGraphics.fillRect(Math.round(1 * s), 0, Math.round(1 * s), Math.round(3 * s));
  rainGraphics.fillStyle(0x3b82f6);
  rainGraphics.fillRect(Math.round(2 * s), Math.round(5 * s), Math.round(1 * s), Math.round(3 * s));
  rainGraphics.generateTexture("rain", Math.round(4 * s), Math.round(10 * s));
  rainGraphics.destroy();

  // Sun with rays - enhanced with more detail
  const sunGraphics = scene.make.graphics({ x: 0, y: 0 });
  // Outer glow
  sunGraphics.fillStyle(0xfbbf24, 0.15);
  sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(20 * s));
  sunGraphics.fillStyle(0xfbbf24, 0.3);
  sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(16 * s));
  sunGraphics.fillStyle(0xfbbf24, 0.5);
  sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(12 * s));
  // Core
  sunGraphics.fillStyle(0xfbbf24);
  sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(8 * s));
  // Bright center
  sunGraphics.fillStyle(0xfef3c7);
  sunGraphics.fillCircle(Math.round(18 * s), Math.round(18 * s), Math.round(4 * s));
  // Hot spot
  sunGraphics.fillStyle(0xffffff);
  sunGraphics.fillCircle(Math.round(17 * s), Math.round(17 * s), Math.round(2 * s));
  sunGraphics.generateTexture("sun", Math.round(40 * s), Math.round(40 * s));
  sunGraphics.destroy();

  // Moon - crescent with crater details
  const moonGraphics = scene.make.graphics({ x: 0, y: 0 });
  // Outer glow
  moonGraphics.fillStyle(0xc4b5fd, 0.2);
  moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(16 * s));
  moonGraphics.fillStyle(0xe0e7ff, 0.3);
  moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(12 * s));
  // Moon body
  moonGraphics.fillStyle(0xf1f5f9);
  moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(10 * s));
  // Crescent shadow
  moonGraphics.fillStyle(0x1e293b, 0.7);
  moonGraphics.fillCircle(Math.round(20 * s), Math.round(14 * s), Math.round(8 * s));
  // Craters
  moonGraphics.fillStyle(0xcbd5e1);
  moonGraphics.fillCircle(Math.round(12 * s), Math.round(14 * s), Math.round(2 * s));
  moonGraphics.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(1.5 * s));
  moonGraphics.fillCircle(Math.round(10 * s), Math.round(18 * s), Math.round(1 * s));
  moonGraphics.generateTexture("moon", Math.round(32 * s), Math.round(32 * s));
  moonGraphics.destroy();

  // Fluffy cloud
  const cloudGraphics = scene.make.graphics({ x: 0, y: 0 });
  cloudGraphics.fillStyle(0x9ca3af);
  cloudGraphics.fillCircle(Math.round(20 * s), Math.round(24 * s), Math.round(14 * s));
  cloudGraphics.fillCircle(Math.round(36 * s), Math.round(20 * s), Math.round(16 * s));
  cloudGraphics.fillCircle(Math.round(52 * s), Math.round(24 * s), Math.round(12 * s));
  cloudGraphics.fillStyle(0xd1d5db);
  cloudGraphics.fillCircle(Math.round(18 * s), Math.round(22 * s), Math.round(10 * s));
  cloudGraphics.fillCircle(Math.round(34 * s), Math.round(18 * s), Math.round(12 * s));
  cloudGraphics.generateTexture("cloud", Math.round(68 * s), Math.round(40 * s));
  cloudGraphics.destroy();

  // Storm cloud
  const stormCloud = scene.make.graphics({ x: 0, y: 0 });
  stormCloud.fillStyle(0x374151);
  stormCloud.fillCircle(Math.round(20 * s), Math.round(24 * s), Math.round(14 * s));
  stormCloud.fillCircle(Math.round(36 * s), Math.round(20 * s), Math.round(16 * s));
  stormCloud.fillCircle(Math.round(52 * s), Math.round(24 * s), Math.round(12 * s));
  stormCloud.fillStyle(0x4b5563);
  stormCloud.fillCircle(Math.round(34 * s), Math.round(22 * s), Math.round(10 * s));
  stormCloud.generateTexture("storm_cloud", Math.round(68 * s), Math.round(40 * s));
  stormCloud.destroy();

  // Lightning bolt
  const lightning = scene.make.graphics({ x: 0, y: 0 });
  lightning.fillStyle(0xfbbf24);
  lightning.fillPoints(
    [
      { x: Math.round(8 * s), y: 0 },
      { x: Math.round(4 * s), y: Math.round(10 * s) },
      { x: Math.round(8 * s), y: Math.round(10 * s) },
      { x: Math.round(2 * s), y: Math.round(20 * s) },
      { x: Math.round(10 * s), y: Math.round(8 * s) },
      { x: Math.round(6 * s), y: Math.round(8 * s) },
      { x: Math.round(10 * s), y: 0 },
    ],
    true
  );
  lightning.generateTexture("lightning", Math.round(12 * s), Math.round(20 * s));
  lightning.destroy();

  // Snowflake
  const snow = scene.make.graphics({ x: 0, y: 0 });
  snow.fillStyle(0xffffff);
  snow.fillCircle(Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));
  snow.fillStyle(0xe0f2fe);
  snow.fillCircle(Math.round(3 * s), Math.round(3 * s), Math.round(1 * s));
  snow.generateTexture("snow", Math.round(8 * s), Math.round(8 * s));
  snow.destroy();
}

export function generateUIAssets(scene: Phaser.Scene): void {
  // Coin with shine
  const coinGraphics = scene.make.graphics({ x: 0, y: 0 });
  coinGraphics.fillStyle(0xfbbf24);
  coinGraphics.fillCircle(6, 6, 6);
  coinGraphics.fillStyle(0xf59e0b);
  coinGraphics.fillCircle(6, 6, 4);
  coinGraphics.fillStyle(0xfbbf24);
  coinGraphics.fillRect(5, 3, 2, 6);
  coinGraphics.fillStyle(0xfef3c7);
  coinGraphics.fillCircle(4, 4, 2);
  coinGraphics.generateTexture("coin", 12, 12);
  coinGraphics.destroy();

  // Glow effect
  const glowGraphics = scene.make.graphics({ x: 0, y: 0 });
  glowGraphics.fillStyle(0x4ade80, 0.2);
  glowGraphics.fillCircle(20, 20, 20);
  glowGraphics.fillStyle(0x4ade80, 0.4);
  glowGraphics.fillCircle(20, 20, 14);
  glowGraphics.fillStyle(0x4ade80, 0.6);
  glowGraphics.fillCircle(20, 20, 8);
  glowGraphics.generateTexture("glow", 40, 40);
  glowGraphics.destroy();

  // Star particle - draw manually since Phaser graphics doesn't have fillStar
  const star = scene.make.graphics({ x: 0, y: 0 });
  star.fillStyle(0xfbbf24);
  // Draw a 5-pointed star using points
  const cx = 8,
    cy = 8,
    outerR = 7,
    innerR = 3;
  const starPoints: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    starPoints.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  star.fillPoints(starPoints, true);
  star.generateTexture("star", 16, 16);
  star.destroy();

  // Heart particle
  const heart = scene.make.graphics({ x: 0, y: 0 });
  heart.fillStyle(0xef4444);
  heart.fillCircle(5, 5, 4);
  heart.fillCircle(11, 5, 4);
  heart.fillTriangle(1, 6, 15, 6, 8, 14);
  heart.generateTexture("heart", 16, 16);
  heart.destroy();
}

export function generateDecorations(scene: Phaser.Scene): void {
  // Tree
  const tree = scene.make.graphics({ x: 0, y: 0 });
  // Trunk
  tree.fillStyle(0x78350f);
  tree.fillRect(12, 28, 8, 16);
  tree.fillStyle(0x92400e);
  tree.fillRect(14, 28, 4, 16);
  // Foliage layers
  tree.fillStyle(0x166534);
  tree.fillCircle(16, 20, 14);
  tree.fillStyle(0x15803d);
  tree.fillCircle(16, 16, 12);
  tree.fillStyle(0x22c55e);
  tree.fillCircle(16, 12, 8);
  tree.generateTexture("tree", 32, 44);
  tree.destroy();

  // Bush
  const bush = scene.make.graphics({ x: 0, y: 0 });
  bush.fillStyle(0x166534);
  bush.fillCircle(8, 12, 8);
  bush.fillCircle(16, 10, 10);
  bush.fillCircle(24, 12, 8);
  bush.fillStyle(0x22c55e);
  bush.fillCircle(16, 8, 6);
  bush.generateTexture("bush", 32, 20);
  bush.destroy();

  // Lamp post
  const lamp = scene.make.graphics({ x: 0, y: 0 });
  lamp.fillStyle(0x1f2937);
  lamp.fillRect(6, 8, 4, 32);
  lamp.fillStyle(0x374151);
  lamp.fillRect(2, 4, 12, 6);
  lamp.fillStyle(0xfbbf24, 0.5);
  lamp.fillRect(4, 6, 8, 4);
  lamp.generateTexture("lamp", 16, 40);
  lamp.destroy();

  // Bench
  const bench = scene.make.graphics({ x: 0, y: 0 });
  bench.fillStyle(0x78350f);
  bench.fillRect(0, 8, 32, 4);
  bench.fillRect(2, 12, 4, 8);
  bench.fillRect(26, 12, 4, 8);
  bench.fillStyle(0x92400e);
  bench.fillRect(0, 4, 32, 4);
  bench.generateTexture("bench", 32, 20);
  bench.destroy();
}

export function generateAnimals(scene: Phaser.Scene): void {
  // Dog - pixel art style
  const dog = scene.make.graphics({ x: 0, y: 0 });
  // Body
  dog.fillStyle(0xc68642); // Brown
  dog.fillRect(4, 8, 16, 10);
  // Head
  dog.fillRect(18, 4, 10, 10);
  // Ears
  dog.fillStyle(0x8d5524);
  dog.fillRect(18, 2, 4, 4);
  dog.fillRect(24, 2, 4, 4);
  // Snout
  dog.fillStyle(0xffdbac);
  dog.fillRect(26, 8, 4, 4);
  // Nose
  dog.fillStyle(0x1f2937);
  dog.fillRect(28, 9, 2, 2);
  // Eye
  dog.fillStyle(0x000000);
  dog.fillRect(22, 6, 2, 2);
  // Legs
  dog.fillStyle(0xc68642);
  dog.fillRect(6, 16, 3, 6);
  dog.fillRect(14, 16, 3, 6);
  // Tail
  dog.fillRect(2, 6, 3, 4);
  dog.generateTexture("dog", 32, 24);
  dog.destroy();

  // Cat - pixel art style
  const cat = scene.make.graphics({ x: 0, y: 0 });
  // Body
  cat.fillStyle(0x6b7280); // Gray
  cat.fillRect(6, 10, 14, 8);
  // Head
  cat.fillRect(16, 4, 10, 10);
  // Ears (triangular)
  cat.fillStyle(0x4b5563);
  cat.fillTriangle(16, 6, 18, 0, 20, 6);
  cat.fillTriangle(24, 6, 26, 0, 28, 6);
  // Inner ears
  cat.fillStyle(0xfca5a5);
  cat.fillTriangle(17, 5, 18, 2, 19, 5);
  cat.fillTriangle(25, 5, 26, 2, 27, 5);
  // Eyes
  cat.fillStyle(0x22c55e); // Green eyes
  cat.fillRect(18, 7, 2, 3);
  cat.fillRect(23, 7, 2, 3);
  // Pupils
  cat.fillStyle(0x000000);
  cat.fillRect(18, 8, 1, 2);
  cat.fillRect(23, 8, 1, 2);
  // Nose
  cat.fillStyle(0xfca5a5);
  cat.fillRect(21, 10, 2, 1);
  // Whiskers
  cat.fillStyle(0x9ca3af);
  cat.fillRect(14, 9, 4, 1);
  cat.fillRect(26, 9, 4, 1);
  cat.fillRect(14, 11, 4, 1);
  cat.fillRect(26, 11, 4, 1);
  // Legs
  cat.fillStyle(0x6b7280);
  cat.fillRect(8, 16, 3, 5);
  cat.fillRect(15, 16, 3, 5);
  // Tail (curved up)
  cat.fillRect(4, 8, 3, 2);
  cat.fillRect(2, 4, 3, 5);
  cat.generateTexture("cat", 32, 24);
  cat.destroy();

  // Bird - small sparrow
  const bird = scene.make.graphics({ x: 0, y: 0 });
  // Body
  bird.fillStyle(0x8b4513); // Brown
  bird.fillEllipse(8, 8, 8, 6);
  // Head
  bird.fillCircle(14, 6, 4);
  // Beak
  bird.fillStyle(0xfbbf24);
  bird.fillTriangle(18, 6, 22, 6, 18, 8);
  // Eye
  bird.fillStyle(0x000000);
  bird.fillCircle(15, 5, 1);
  // Wing
  bird.fillStyle(0x6b4423);
  bird.fillEllipse(6, 8, 5, 4);
  // Tail
  bird.fillStyle(0x5c3317);
  bird.fillTriangle(0, 6, 4, 8, 4, 10);
  // Legs
  bird.fillStyle(0xfbbf24);
  bird.fillRect(7, 12, 1, 4);
  bird.fillRect(10, 12, 1, 4);
  bird.generateTexture("bird", 24, 18);
  bird.destroy();

  // Butterfly
  const butterfly = scene.make.graphics({ x: 0, y: 0 });
  // Wings
  butterfly.fillStyle(0xec4899); // Pink
  butterfly.fillEllipse(4, 6, 4, 5);
  butterfly.fillEllipse(12, 6, 4, 5);
  butterfly.fillStyle(0xf472b6);
  butterfly.fillEllipse(4, 10, 3, 4);
  butterfly.fillEllipse(12, 10, 3, 4);
  // Body
  butterfly.fillStyle(0x1f2937);
  butterfly.fillRect(7, 4, 2, 10);
  // Antennae
  butterfly.fillRect(6, 2, 1, 3);
  butterfly.fillRect(9, 2, 1, 3);
  // Wing patterns
  butterfly.fillStyle(0xfbbf24);
  butterfly.fillCircle(4, 6, 1);
  butterfly.fillCircle(12, 6, 1);
  butterfly.generateTexture("butterfly", 16, 16);
  butterfly.destroy();

  // Squirrel
  const squirrel = scene.make.graphics({ x: 0, y: 0 });
  // Body
  squirrel.fillStyle(0xb45309); // Orange-brown
  squirrel.fillRect(8, 10, 10, 8);
  // Head
  squirrel.fillCircle(20, 10, 5);
  // Ear
  squirrel.fillStyle(0x92400e);
  squirrel.fillTriangle(18, 4, 20, 2, 22, 6);
  // Eye
  squirrel.fillStyle(0x000000);
  squirrel.fillCircle(21, 9, 1);
  // Nose
  squirrel.fillStyle(0x1f2937);
  squirrel.fillCircle(24, 11, 1);
  // Fluffy tail
  squirrel.fillStyle(0xb45309);
  squirrel.fillEllipse(4, 6, 5, 8);
  squirrel.fillStyle(0xd97706);
  squirrel.fillEllipse(4, 4, 3, 5);
  // Legs
  squirrel.fillStyle(0xb45309);
  squirrel.fillRect(10, 16, 2, 4);
  squirrel.fillRect(15, 16, 2, 4);
  // Front paws
  squirrel.fillRect(18, 14, 2, 3);
  squirrel.generateTexture("squirrel", 28, 22);
  squirrel.destroy();
}

export function generateExtraDecorations(scene: Phaser.Scene): void {
  // Flower - colorful pixel flower
  const flower = scene.make.graphics({ x: 0, y: 0 });
  // Stem
  flower.fillStyle(0x22c55e);
  flower.fillRect(6, 8, 2, 12);
  // Leaves
  flower.fillStyle(0x16a34a);
  flower.fillRect(3, 12, 4, 3);
  flower.fillRect(7, 14, 4, 3);
  // Petals - random color per instance will be set in scene
  const petalColors = [0xef4444, 0xfbbf24, 0xec4899, 0x8b5cf6, 0x3b82f6];
  const petalColor = petalColors[Math.floor(Math.random() * petalColors.length)];
  flower.fillStyle(petalColor);
  flower.fillCircle(4, 4, 3);
  flower.fillCircle(10, 4, 3);
  flower.fillCircle(4, 8, 3);
  flower.fillCircle(10, 8, 3);
  // Center
  flower.fillStyle(0xfbbf24);
  flower.fillCircle(7, 6, 3);
  flower.generateTexture("flower", 14, 20);
  flower.destroy();

  // Rock - gray stone
  const rock = scene.make.graphics({ x: 0, y: 0 });
  rock.fillStyle(0x6b7280);
  rock.fillEllipse(10, 8, 12, 8);
  rock.fillStyle(0x9ca3af);
  rock.fillEllipse(8, 6, 8, 5);
  rock.fillStyle(0x4b5563);
  rock.fillEllipse(12, 10, 6, 4);
  rock.generateTexture("rock", 20, 16);
  rock.destroy();

  // Fountain - decorative water fountain
  const fountain = scene.make.graphics({ x: 0, y: 0 });
  // Base
  fountain.fillStyle(0x6b7280);
  fountain.fillRect(8, 28, 24, 8);
  fountain.fillStyle(0x9ca3af);
  fountain.fillRect(10, 26, 20, 4);
  // Middle tier
  fountain.fillStyle(0x78716c);
  fountain.fillRect(14, 18, 12, 10);
  fountain.fillStyle(0xa8a29e);
  fountain.fillRect(16, 16, 8, 4);
  // Top bowl
  fountain.fillStyle(0x6b7280);
  fountain.fillRect(12, 10, 16, 8);
  fountain.fillStyle(0x60a5fa, 0.7);
  fountain.fillRect(14, 12, 12, 4);
  // Spout
  fountain.fillStyle(0x9ca3af);
  fountain.fillRect(18, 4, 4, 8);
  // Water drops at top
  fountain.fillStyle(0x93c5fd);
  fountain.fillCircle(20, 2, 2);
  fountain.generateTexture("fountain", 40, 36);
  fountain.destroy();

  // Flag - waving flag on pole
  const flag = scene.make.graphics({ x: 0, y: 0 });
  // Pole
  flag.fillStyle(0x78716c);
  flag.fillRect(2, 0, 3, 40);
  flag.fillStyle(0x9ca3af);
  flag.fillRect(3, 0, 1, 40);
  // Flag top ball
  flag.fillStyle(0xfbbf24);
  flag.fillCircle(3, 2, 3);
  // Flag fabric - BagsWorld green
  flag.fillStyle(0x4ade80);
  flag.fillRect(5, 4, 18, 12);
  flag.fillStyle(0x22c55e);
  flag.fillRect(5, 10, 18, 6);
  // B for Bags
  flag.fillStyle(0xffffff);
  flag.fillRect(10, 6, 6, 8);
  flag.fillRect(10, 6, 2, 8);
  flag.fillRect(10, 6, 6, 2);
  flag.fillRect(10, 9, 5, 2);
  flag.fillRect(10, 12, 6, 2);
  flag.generateTexture("flag", 24, 40);
  flag.destroy();

  // Pond - small water area
  const pond = scene.make.graphics({ x: 0, y: 0 });
  // Water base
  pond.fillStyle(0x1e3a8a, 0.6);
  pond.fillEllipse(16, 10, 16, 10);
  pond.fillStyle(0x3b82f6, 0.5);
  pond.fillEllipse(16, 10, 12, 7);
  // Highlight/reflection
  pond.fillStyle(0x93c5fd, 0.4);
  pond.fillEllipse(12, 8, 6, 3);
  // Lily pad
  pond.fillStyle(0x22c55e);
  pond.fillCircle(20, 12, 3);
  pond.fillStyle(0x16a34a);
  pond.fillRect(20, 11, 3, 2);
  // Lily flower
  pond.fillStyle(0xfda4af);
  pond.fillCircle(21, 11, 2);
  pond.generateTexture("pond", 32, 20);
  pond.destroy();

  // Mushroom - cute pixel mushroom
  const mushroom = scene.make.graphics({ x: 0, y: 0 });
  // Stem
  mushroom.fillStyle(0xfef3c7);
  mushroom.fillRect(4, 8, 6, 8);
  mushroom.fillStyle(0xfde68a);
  mushroom.fillRect(5, 8, 4, 8);
  // Cap
  mushroom.fillStyle(0xef4444);
  mushroom.fillEllipse(7, 6, 8, 6);
  // Spots
  mushroom.fillStyle(0xffffff);
  mushroom.fillCircle(5, 4, 2);
  mushroom.fillCircle(9, 5, 1.5);
  mushroom.fillCircle(7, 7, 1);
  mushroom.generateTexture("mushroom", 14, 16);
  mushroom.destroy();

  // Signpost
  const signpost = scene.make.graphics({ x: 0, y: 0 });
  // Post
  signpost.fillStyle(0x78350f);
  signpost.fillRect(8, 10, 4, 20);
  signpost.fillStyle(0x92400e);
  signpost.fillRect(9, 10, 2, 20);
  // Sign board
  signpost.fillStyle(0xa16207);
  signpost.fillRect(0, 4, 20, 10);
  signpost.fillStyle(0xca8a04);
  signpost.fillRect(1, 5, 18, 8);
  // Arrow or text hint
  signpost.fillStyle(0x422006);
  signpost.fillRect(4, 8, 8, 2);
  signpost.fillTriangle(12, 6, 16, 9, 12, 12);
  signpost.generateTexture("signpost", 20, 30);
  signpost.destroy();
}

export function generateAmbientParticles(scene: Phaser.Scene): void {
  // Pollen/dust particle
  const pollen = scene.make.graphics({ x: 0, y: 0 });
  pollen.fillStyle(0xfef3c7);
  pollen.fillCircle(2, 2, 2);
  pollen.fillStyle(0xffffff, 0.5);
  pollen.fillCircle(1.5, 1.5, 1);
  pollen.generateTexture("pollen", 4, 4);
  pollen.destroy();

  // Firefly - glowing particle for night
  const firefly = scene.make.graphics({ x: 0, y: 0 });
  // Outer glow
  firefly.fillStyle(0xfde047, 0.3);
  firefly.fillCircle(6, 6, 6);
  firefly.fillStyle(0xfef08a, 0.5);
  firefly.fillCircle(6, 6, 4);
  // Core
  firefly.fillStyle(0xfef9c3);
  firefly.fillCircle(6, 6, 2);
  firefly.fillStyle(0xffffff);
  firefly.fillCircle(6, 6, 1);
  firefly.generateTexture("firefly", 12, 12);
  firefly.destroy();

  // Leaf particle
  const leaf = scene.make.graphics({ x: 0, y: 0 });
  leaf.fillStyle(0x22c55e);
  leaf.fillEllipse(4, 3, 4, 3);
  leaf.fillStyle(0x16a34a);
  leaf.fillRect(3, 2, 1, 4);
  leaf.generateTexture("leaf", 8, 8);
  leaf.destroy();

  // Sparkle particle
  const sparkle = scene.make.graphics({ x: 0, y: 0 });
  sparkle.fillStyle(0xffffff);
  sparkle.fillRect(3, 0, 2, 8);
  sparkle.fillRect(0, 3, 8, 2);
  sparkle.fillStyle(0xfef3c7);
  sparkle.fillRect(3, 3, 2, 2);
  sparkle.generateTexture("sparkle", 8, 8);
  sparkle.destroy();

  // White smoke cloud particle for incinerator chimney
  const smokeG = scene.make.graphics({ x: 0, y: 0 });
  // Soft outer haze
  smokeG.fillStyle(0xcccccc, 0.15);
  smokeG.fillCircle(16, 16, 16);
  // Cloud body
  smokeG.fillStyle(0xdddddd, 0.3);
  smokeG.fillCircle(16, 16, 11);
  smokeG.fillCircle(12, 15, 8);
  smokeG.fillCircle(20, 15, 8);
  // Bright core
  smokeG.fillStyle(0xffffff, 0.35);
  smokeG.fillCircle(15, 14, 6);
  smokeG.generateTexture("green_smoke", 32, 32);
  smokeG.destroy();
}
