import * as Phaser from "phaser";
import { CHARACTER_STATS, type ArcadeCharacter } from "../types";
import { darken, lighten } from "../../textures/constants";

export function generatePortraitSprites(scene: Phaser.Scene): void {
  const chars: ArcadeCharacter[] = ["ghost", "neo", "cj"];
  for (const id of chars) {
    const stats = CHARACTER_STATS[id];
    generatePortrait(scene, id, stats.color, stats.secondaryColor, stats.skinColor);
  }
}

function generatePortrait(
  scene: Phaser.Scene,
  id: ArcadeCharacter,
  color: number,
  secondaryColor: number,
  skinColor: number
): void {
  const S = 32;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Background
  g.fillStyle(darken(color, 0.4));
  g.fillRect(0, 0, S, S);

  // Border
  g.fillStyle(lighten(color, 0.15));
  g.fillRect(0, 0, S, 1);
  g.fillRect(0, 0, 1, S);
  g.fillStyle(darken(color, 0.3));
  g.fillRect(0, S - 1, S, 1);
  g.fillRect(S - 1, 0, 1, S);

  // Face (16x18 centered)
  const fx = 8;
  const fy = 4;
  g.fillStyle(skinColor);
  g.fillRect(fx, fy, 16, 18);

  // Neck + shoulders
  g.fillStyle(color);
  g.fillRect(4, fy + 18, 24, 10);
  g.fillStyle(lighten(color, 0.15));
  g.fillRect(4, fy + 18, 24, 1);

  if (id === "ghost") {
    // Dark hair
    g.fillStyle(0x1a1a2e);
    g.fillRect(fx, fy, 16, 5);
    g.fillRect(fx - 1, fy + 2, 1, 3);
    g.fillRect(fx + 16, fy + 2, 1, 3);
    // Blue glasses
    g.fillStyle(0x3b82f6);
    g.fillRect(fx + 2, fy + 8, 4, 3);
    g.fillRect(fx + 10, fy + 8, 4, 3);
    // Frames bridge
    g.fillStyle(0x374151);
    g.fillRect(fx + 6, fy + 9, 4, 1);
    // Lens glint
    g.fillStyle(0x93c5fd);
    g.fillRect(fx + 3, fy + 8, 1, 1);
    g.fillRect(fx + 11, fy + 8, 1, 1);
    // Mouth
    g.fillStyle(darken(skinColor, 0.2));
    g.fillRect(fx + 5, fy + 14, 6, 1);
    // Purple logo on shoulder
    g.fillStyle(secondaryColor);
    g.fillRect(6, fy + 20, 6, 4);
    g.fillRect(7, fy + 19, 4, 1);
  } else if (id === "neo") {
    // Slicked back dark hair
    g.fillStyle(0x0a0a0f);
    g.fillRect(fx, fy, 16, 4);
    g.fillRect(fx - 1, fy + 2, 1, 4);
    g.fillRect(fx + 16, fy + 2, 1, 4);
    // Sunglasses
    g.fillStyle(0x0a0a0f);
    g.fillRect(fx + 2, fy + 8, 5, 3);
    g.fillRect(fx + 9, fy + 8, 5, 3);
    // Green lens reflection
    g.fillStyle(0x22c55e);
    g.fillRect(fx + 3, fy + 9, 2, 1);
    g.fillRect(fx + 10, fy + 9, 2, 1);
    // Mouth
    g.fillStyle(darken(skinColor, 0.15));
    g.fillRect(fx + 5, fy + 14, 6, 1);
    // Green lines on coat
    g.fillStyle(secondaryColor);
    g.fillRect(8, fy + 20, 1, 6);
    g.fillRect(14, fy + 21, 1, 5);
    g.fillRect(20, fy + 20, 1, 6);
  } else if (id === "cj") {
    // Bald head shine
    g.fillStyle(lighten(skinColor, 0.2));
    g.fillRect(fx + 4, fy, 8, 2);
    g.fillRect(fx + 3, fy + 2, 2, 1);
    // Eyes
    g.fillStyle(0x0a0a0f);
    g.fillRect(fx + 4, fy + 8, 2, 2);
    g.fillRect(fx + 10, fy + 8, 2, 2);
    // Eye whites
    g.fillStyle(0xffffff);
    g.fillRect(fx + 3, fy + 8, 1, 2);
    g.fillRect(fx + 12, fy + 8, 1, 2);
    // Eyebrows
    g.fillStyle(darken(skinColor, 0.3));
    g.fillRect(fx + 3, fy + 7, 4, 1);
    g.fillRect(fx + 9, fy + 7, 4, 1);
    // Mouth (grin)
    g.fillStyle(darken(skinColor, 0.2));
    g.fillRect(fx + 4, fy + 14, 8, 1);
    g.fillRect(fx + 5, fy + 15, 6, 1);
    // Gold chain
    g.fillStyle(secondaryColor);
    g.fillRect(8, fy + 19, 16, 1);
    g.fillRect(14, fy + 20, 4, 3);
  }

  g.generateTexture(`${id}_portrait`, S, S);
  g.destroy();
}
