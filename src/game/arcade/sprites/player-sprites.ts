import * as Phaser from "phaser";
import { CHARACTER_STATS, type ArcadeCharacter } from "../types";
import { darken, lighten } from "../../textures/constants";

export function generatePlayerSprites(scene: Phaser.Scene): void {
  const chars: ArcadeCharacter[] = ["ghost", "neo", "cj"];
  for (const id of chars) {
    const stats = CHARACTER_STATS[id];
    generateCharacterFrames(scene, id, stats.color, stats.secondaryColor, stats.skinColor);
  }
}

// --- Shared drawing helpers ---

function drawHead(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  skinColor: number,
  id: ArcadeCharacter
) {
  // Head base 8x8
  g.fillStyle(skinColor);
  g.fillRect(x, y, 8, 8);

  // Hair / head detail
  if (id === "ghost") {
    // Dark hair on top
    g.fillStyle(0x1a1a2e);
    g.fillRect(x, y, 8, 3);
    // Small glasses (2px wide rectangle)
    g.fillStyle(0x3b82f6);
    g.fillRect(x + 1, y + 4, 2, 1);
    g.fillRect(x + 5, y + 4, 2, 1);
    // Glasses bridge
    g.fillStyle(0x374151);
    g.fillRect(x + 3, y + 4, 2, 1);
  } else if (id === "neo") {
    // Slicked back dark hair
    g.fillStyle(0x0a0a0f);
    g.fillRect(x, y, 8, 2);
    g.fillRect(x, y + 2, 1, 2);
    g.fillRect(x + 7, y + 2, 1, 2);
    // Sunglasses
    g.fillStyle(0x0a0a0f);
    g.fillRect(x + 1, y + 4, 3, 1);
    g.fillRect(x + 5, y + 4, 2, 1);
  } else if (id === "cj") {
    // Bald - no hair pixels, just a highlight on top of head
    g.fillStyle(lighten(skinColor, 0.15));
    g.fillRect(x + 2, y, 4, 1);
  }

  // Eyes (skip if sunglasses/glasses already drawn)
  if (id === "cj") {
    g.fillStyle(0x0a0a0f);
    g.fillRect(x + 2, y + 4, 1, 1);
    g.fillRect(x + 5, y + 4, 1, 1);
  }
}

function drawTorso(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  secondaryColor: number,
  id: ArcadeCharacter
) {
  // Body 12x10 centered
  g.fillStyle(color);
  g.fillRect(x, y, 12, 10);

  // Highlight left edge
  g.fillStyle(lighten(color, 0.2));
  g.fillRect(x, y, 1, 10);

  // Shadow right edge
  g.fillStyle(darken(color, 0.25));
  g.fillRect(x + 11, y, 1, 10);

  // Character-specific detail
  if (id === "ghost") {
    // Purple ghost logo on hoodie
    g.fillStyle(secondaryColor);
    g.fillRect(x + 4, y + 2, 4, 4);
    g.fillRect(x + 5, y + 1, 2, 1);
  } else if (id === "neo") {
    // Green matrix-style lines on coat
    g.fillStyle(secondaryColor);
    g.fillRect(x + 3, y + 1, 1, 8);
    g.fillRect(x + 6, y + 2, 1, 7);
    g.fillRect(x + 9, y + 1, 1, 8);
  } else if (id === "cj") {
    // Gold chain
    g.fillStyle(secondaryColor);
    g.fillRect(x + 3, y + 1, 6, 1);
    g.fillRect(x + 3, y + 2, 1, 1);
    g.fillRect(x + 8, y + 2, 1, 1);
    g.fillRect(x + 5, y + 2, 2, 2); // Chain pendant
  }
}

function drawLegs(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  pantsColor: number,
  shoeColor: number,
  leftOffset: number,
  rightOffset: number
) {
  // Left leg
  g.fillStyle(pantsColor);
  g.fillRect(x + leftOffset, y, 4, 8);
  g.fillStyle(darken(pantsColor, 0.15));
  g.fillRect(x + leftOffset + 3, y, 1, 8);
  // Left shoe
  g.fillStyle(shoeColor);
  g.fillRect(x + leftOffset, y + 8, 5, 2);

  // Right leg
  g.fillStyle(pantsColor);
  g.fillRect(x + 6 + rightOffset, y, 4, 8);
  g.fillStyle(darken(pantsColor, 0.15));
  g.fillRect(x + 6 + rightOffset + 3, y, 1, 8);
  // Right shoe
  g.fillStyle(shoeColor);
  g.fillRect(x + 6 + rightOffset, y + 8, 5, 2);
}

function drawArm(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  skinColor: number
) {
  // Sleeve
  g.fillStyle(color);
  g.fillRect(x, y, 4, 5);
  // Hand
  g.fillStyle(skinColor);
  g.fillRect(x, y + 5, 4, 3);
}

function getPantsColor(id: ArcadeCharacter): number {
  if (id === "ghost") return 0x1f2937; // Dark gray jeans
  if (id === "neo") return 0x111111; // Black pants
  return 0x374151; // Gray pants for CJ
}

function getShoeColor(id: ArcadeCharacter): number {
  if (id === "ghost") return 0x4b5563;
  if (id === "neo") return 0x0a0a0f;
  return 0x451a03;
}

// --- Frame generators ---

function generateCharacterFrames(
  scene: Phaser.Scene,
  id: ArcadeCharacter,
  color: number,
  secondaryColor: number,
  skinColor: number
): void {
  const pantsColor = getPantsColor(id);
  const shoeColor = getShoeColor(id);
  const W = 24;
  const H = 32;

  // ---- IDLE 1 ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 1, 9, color, skinColor);
    drawArm(g, 18, 9, color, skinColor);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_1`, W, H);
    g.destroy();
  }

  // ---- IDLE 2 (slight arm shift) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 1, 10, color, skinColor); // Arms shifted down 1px
    drawArm(g, 18, 10, color, skinColor);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_2`, W, H);
    g.destroy();
  }

  // ---- RUN 1 (left leg forward) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 2, 8, color, skinColor); // Left arm back
    drawArm(g, 17, 10, color, skinColor); // Right arm forward
    drawLegs(g, 6, 18, pantsColor, shoeColor, -1, 1);
    g.generateTexture(`${id}_run_1`, W, H);
    g.destroy();
  }

  // ---- RUN 2 (right leg forward) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 2, 10, color, skinColor); // Left arm forward
    drawArm(g, 17, 8, color, skinColor); // Right arm back
    drawLegs(g, 6, 18, pantsColor, shoeColor, 1, -1);
    g.generateTexture(`${id}_run_2`, W, H);
    g.destroy();
  }

  // ---- JUMP ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    // Arms up
    drawArm(g, 1, 6, color, skinColor);
    drawArm(g, 18, 6, color, skinColor);
    // Legs tucked
    g.fillStyle(pantsColor);
    g.fillRect(7, 18, 4, 6);
    g.fillRect(13, 18, 4, 6);
    g.fillStyle(shoeColor);
    g.fillRect(7, 24, 5, 2);
    g.fillRect(13, 24, 5, 2);
    g.generateTexture(`${id}_jump`, W, H);
    g.destroy();
  }

  // ---- FALL ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    // Arms spread wide
    drawArm(g, 0, 8, color, skinColor);
    drawArm(g, 20, 8, color, skinColor);
    // Legs spread
    drawLegs(g, 6, 18, pantsColor, shoeColor, -2, 2);
    g.generateTexture(`${id}_fall`, W, H);
    g.destroy();
  }

  // ---- SHOOT 1 (gun arm extended) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    // Left arm normal
    drawArm(g, 1, 9, color, skinColor);
    // Right arm extended with gun
    g.fillStyle(color);
    g.fillRect(18, 10, 4, 3);
    g.fillStyle(skinColor);
    g.fillRect(22, 10, 2, 3);
    // Gun
    g.fillStyle(0x374151);
    g.fillRect(22, 11, 2, 1);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_1`, W, H);
    g.destroy();
  }

  // ---- SHOOT 2 (slight recoil) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 1, 9, color, skinColor);
    // Right arm extended, shifted back slightly for recoil
    g.fillStyle(color);
    g.fillRect(17, 9, 4, 3);
    g.fillStyle(skinColor);
    g.fillRect(21, 9, 2, 3);
    g.fillStyle(0x374151);
    g.fillRect(21, 10, 2, 1);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_2`, W, H);
    g.destroy();
  }

  // ---- CROUCH ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Everything shifted down so character appears shorter
    drawHead(g, 8, 8, skinColor, id);
    drawTorso(g, 6, 16, color, secondaryColor, id);
    drawArm(g, 1, 17, color, skinColor);
    drawArm(g, 18, 17, color, skinColor);
    // Short bent legs
    g.fillStyle(pantsColor);
    g.fillRect(7, 26, 4, 4);
    g.fillRect(13, 26, 4, 4);
    g.fillStyle(shoeColor);
    g.fillRect(6, 30, 5, 2);
    g.fillRect(13, 30, 5, 2);
    g.generateTexture(`${id}_crouch`, W, H);
    g.destroy();
  }

  // ---- CROUCH SHOOT ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 8, skinColor, id);
    drawTorso(g, 6, 16, color, secondaryColor, id);
    drawArm(g, 1, 17, color, skinColor);
    // Gun arm extended
    g.fillStyle(color);
    g.fillRect(18, 18, 4, 3);
    g.fillStyle(skinColor);
    g.fillRect(22, 18, 2, 3);
    g.fillStyle(0x374151);
    g.fillRect(22, 19, 2, 1);
    // Short bent legs
    g.fillStyle(pantsColor);
    g.fillRect(7, 26, 4, 4);
    g.fillRect(13, 26, 4, 4);
    g.fillStyle(shoeColor);
    g.fillRect(6, 30, 5, 2);
    g.fillRect(13, 30, 5, 2);
    g.generateTexture(`${id}_crouch_shoot`, W, H);
    g.destroy();
  }

  // ---- HURT (recoil + red tint) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Slight lean back
    drawHead(g, 7, 1, skinColor, id);
    // Red-tinted torso
    const hurtColor = 0xcc3333;
    g.fillStyle(hurtColor);
    g.fillRect(5, 9, 12, 10);
    g.fillStyle(lighten(hurtColor, 0.2));
    g.fillRect(5, 9, 1, 10);
    // Arms flailing
    drawArm(g, 0, 7, color, skinColor);
    drawArm(g, 19, 11, color, skinColor);
    drawLegs(g, 5, 19, pantsColor, shoeColor, -1, 1);
    g.generateTexture(`${id}_hurt`, W, H);
    g.destroy();
  }

  // ---- DIE 1 (falling back) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 7, 2, skinColor, id);
    drawTorso(g, 5, 10, color, secondaryColor, id);
    drawArm(g, 0, 8, color, skinColor);
    drawArm(g, 17, 12, color, skinColor);
    drawLegs(g, 5, 20, pantsColor, shoeColor, -1, 0);
    g.generateTexture(`${id}_die_1`, W, H);
    g.destroy();
  }

  // ---- DIE 2 (on ground) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Rotated/flat on ground - draw horizontally
    g.fillStyle(skinColor);
    g.fillRect(2, 22, 8, 6); // Head sideways
    g.fillStyle(color);
    g.fillRect(10, 20, 10, 8); // Torso flat
    g.fillStyle(pantsColor);
    g.fillRect(20, 22, 4, 6); // Legs
    g.fillStyle(shoeColor);
    g.fillRect(20, 28, 4, 2);
    // Character detail on head
    if (id === "ghost") {
      g.fillStyle(0x3b82f6);
      g.fillRect(3, 24, 2, 1);
    } else if (id === "neo") {
      g.fillStyle(0x0a0a0f);
      g.fillRect(3, 24, 3, 1);
    }
    g.generateTexture(`${id}_die_2`, W, H);
    g.destroy();
  }

  // ---- DIE 3 (fading - semi-transparent look via lighter colors) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const fadeColor = lighten(color, 0.5);
    const fadeSkin = lighten(skinColor, 0.4);
    const fadePants = lighten(pantsColor, 0.5);
    g.fillStyle(fadeSkin);
    g.fillRect(2, 22, 8, 6);
    g.fillStyle(fadeColor);
    g.fillRect(10, 20, 10, 8);
    g.fillStyle(fadePants);
    g.fillRect(20, 22, 4, 6);
    g.generateTexture(`${id}_die_3`, W, H);
    g.destroy();
  }

  // ---- IDLE 3 (chest rise — breathing cycle) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 7, color, secondaryColor, id); // Torso up 1px
    drawArm(g, 1, 8, color, skinColor);
    drawArm(g, 18, 8, color, skinColor);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_3`, W, H);
    g.destroy();
  }

  // ---- IDLE 4 (chest lower — breathing return) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 1, skinColor, id); // Head down 1px
    drawTorso(g, 6, 9, color, secondaryColor, id); // Torso down 1px
    drawArm(g, 1, 10, color, skinColor);
    drawArm(g, 18, 10, color, skinColor);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_4`, W, H);
    g.destroy();
  }

  // ---- RUN 3 (mid-stride contact, wide legs) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 1, 9, color, skinColor);
    drawArm(g, 18, 9, color, skinColor);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 2, -2);
    g.generateTexture(`${id}_run_3`, W, H);
    g.destroy();
  }

  // ---- RUN 4 (passing phase, legs together) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 1, skinColor, id); // Head bob
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 2, 10, color, skinColor);
    drawArm(g, 17, 10, color, skinColor);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_run_4`, W, H);
    g.destroy();
  }

  // ---- JUMP 2 (apex — arms level, legs tucked tight) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 0, 7, color, skinColor);
    drawArm(g, 20, 7, color, skinColor);
    // Tight tucked legs
    g.fillStyle(pantsColor);
    g.fillRect(8, 18, 4, 5);
    g.fillRect(14, 18, 4, 5);
    g.fillStyle(shoeColor);
    g.fillRect(8, 23, 4, 2);
    g.fillRect(14, 23, 4, 2);
    g.generateTexture(`${id}_jump_2`, W, H);
    g.destroy();
  }

  // ---- FALL 2 (fast descent — arms up, body stretched) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 1, 5, color, skinColor);
    drawArm(g, 18, 5, color, skinColor);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_fall_2`, W, H);
    g.destroy();
  }

  // ---- SHOOT 3 (full recoil — gun arm pulled back) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 7, 0, skinColor, id); // Head shifted 1px back
    drawTorso(g, 6, 8, color, secondaryColor, id);
    drawArm(g, 1, 9, color, skinColor);
    // Gun arm pulled back for recoil
    g.fillStyle(color);
    g.fillRect(16, 8, 4, 3);
    g.fillStyle(skinColor);
    g.fillRect(20, 8, 2, 3);
    g.fillStyle(0x374151);
    g.fillRect(20, 9, 2, 1);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_3`, W, H);
    g.destroy();
  }

  // ---- DIE 4 (stagger spin — partially rotated) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(skinColor);
    g.fillRect(4, 18, 7, 6);
    g.fillStyle(color);
    g.fillRect(10, 16, 8, 8);
    g.fillStyle(lighten(color, 0.1));
    g.fillRect(10, 16, 8, 1);
    g.fillStyle(pantsColor);
    g.fillRect(18, 18, 4, 8);
    g.fillStyle(shoeColor);
    g.fillRect(18, 26, 4, 2);
    if (id === "ghost") {
      g.fillStyle(0x3b82f6);
      g.fillRect(5, 20, 2, 1);
    } else if (id === "neo") {
      g.fillStyle(0x0a0a0f);
      g.fillRect(5, 20, 3, 1);
    }
    g.generateTexture(`${id}_die_4`, W, H);
    g.destroy();
  }

  // ---- DIE 5 (settled, very faded) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const fadeColor2 = lighten(color, 0.65);
    const fadeSkin2 = lighten(skinColor, 0.6);
    const fadePants2 = lighten(pantsColor, 0.65);
    g.fillStyle(fadeSkin2);
    g.fillRect(2, 24, 8, 5);
    g.fillStyle(fadeColor2);
    g.fillRect(10, 22, 10, 6);
    g.fillStyle(fadePants2);
    g.fillRect(20, 24, 4, 4);
    g.generateTexture(`${id}_die_5`, W, H);
    g.destroy();
  }
}
