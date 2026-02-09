import * as Phaser from "phaser";
import { SCALE } from "./constants";

function generateGrass(scene: Phaser.Scene): void {
  const size = Math.round(32 * SCALE);
  const grassGraphics = scene.make.graphics({ x: 0, y: 0 });

  // Base grass
  grassGraphics.fillStyle(0x1a472a);
  grassGraphics.fillRect(0, 0, size, size);

  // Grass variation - more blades for higher resolution
  grassGraphics.fillStyle(0x2d5a3d);
  const bladeCount = Math.round(12 * SCALE);
  for (let i = 0; i < bladeCount; i++) {
    const x = Math.floor(Math.random() * (size - 4));
    const y = Math.floor(Math.random() * (size - 6));
    grassGraphics.fillRect(x, y, Math.round(2 * SCALE), Math.round(4 * SCALE));
  }

  // Occasional flowers
  grassGraphics.fillStyle(0xfbbf24);
  grassGraphics.fillRect(
    Math.round(8 * SCALE),
    Math.round(12 * SCALE),
    Math.round(3 * SCALE),
    Math.round(3 * SCALE)
  );
  grassGraphics.fillStyle(0xef4444);
  grassGraphics.fillRect(
    Math.round(20 * SCALE),
    Math.round(8 * SCALE),
    Math.round(3 * SCALE),
    Math.round(3 * SCALE)
  );

  grassGraphics.generateTexture("grass", size, size);
  grassGraphics.destroy();

  // Dark grass variant
  const darkGrass = scene.make.graphics({ x: 0, y: 0 });
  darkGrass.fillStyle(0x14532d);
  darkGrass.fillRect(0, 0, size, size);
  darkGrass.fillStyle(0x1a472a);
  for (let i = 0; i < Math.round(8 * SCALE); i++) {
    const x = Math.floor(Math.random() * (size - 5));
    const y = Math.floor(Math.random() * (size - 5));
    darkGrass.fillRect(x, y, Math.round(3 * SCALE), Math.round(3 * SCALE));
  }
  darkGrass.generateTexture("grass_dark", size, size);
  darkGrass.destroy();
}

function generatePath(scene: Phaser.Scene): void {
  const size = Math.round(32 * SCALE);
  const pathGraphics = scene.make.graphics({ x: 0, y: 0 });
  pathGraphics.fillStyle(0x78716c);
  pathGraphics.fillRect(0, 0, size, size);
  pathGraphics.fillStyle(0x57534e);
  for (let i = 0; i < Math.round(6 * SCALE); i++) {
    const x = Math.floor(Math.random() * (size - 10));
    const y = Math.floor(Math.random() * (size - 10));
    pathGraphics.fillRect(x, y, Math.round(6 * SCALE), Math.round(6 * SCALE));
  }
  pathGraphics.generateTexture("path", size, size);
  pathGraphics.destroy();
}

export function generateCoreAssets(scene: Phaser.Scene): void {
  generateGrass(scene);
  generatePath(scene);
}
