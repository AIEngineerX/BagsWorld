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

// --- Utility helper ---

function drawOutlinedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number,
  outlineColor: number = darken(fillColor, 0.5)
) {
  g.fillStyle(outlineColor);
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(fillColor);
  g.fillRect(x, y, w, h);
}

// --- Shared drawing helpers ---

function drawHead(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  skinColor: number,
  id: ArcadeCharacter
) {
  // 1px outline around head
  drawOutlinedRect(g, x, y, 8, 8, skinColor, darken(skinColor, 0.4));

  // Hair / head detail
  if (id === "ghost") {
    // Hoodie hood outline: 2px ridge above head
    g.fillStyle(darken(0x2d1b4e, 0.3));
    g.fillRect(x - 1, y - 2, 10, 2);
    g.fillStyle(0x2d1b4e);
    g.fillRect(x, y - 1, 8, 1);
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
  id: ArcadeCharacter,
  skinColor?: number
) {
  // Body 12x10 with 1px outline
  const outlineColor = darken(color, 0.5);
  g.fillStyle(outlineColor);
  g.fillRect(x - 1, y - 1, 14, 12);

  // 3-zone shading: left 25% (3px), middle 50% (6px), right 25% (3px)
  // Left highlight zone
  g.fillStyle(lighten(color, 0.2));
  g.fillRect(x, y, 3, 10);
  // Middle base zone
  g.fillStyle(color);
  g.fillRect(x + 3, y, 6, 10);
  // Right shadow zone
  g.fillStyle(darken(color, 0.25));
  g.fillRect(x + 9, y, 3, 10);

  // Collar detail: V-neck showing 2px of skin color at top center
  if (skinColor) {
    g.fillStyle(skinColor);
    g.fillRect(x + 5, y, 2, 1);
    g.fillStyle(darken(skinColor, 0.1));
    g.fillRect(x + 4, y + 1, 1, 1);
    g.fillRect(x + 7, y + 1, 1, 1);
  }

  // Belt line at y+9: 1px dark gray strip with buckle
  g.fillStyle(0x1f2937);
  g.fillRect(x, y + 9, 12, 1);
  // Belt buckle at center
  g.fillStyle(0x9ca3af);
  g.fillRect(x + 5, y + 9, 2, 1);

  // Character-specific detail
  if (id === "ghost") {
    // Purple ghost logo on hoodie
    g.fillStyle(secondaryColor);
    g.fillRect(x + 4, y + 2, 4, 4);
    g.fillRect(x + 5, y + 1, 2, 1);
    // Zipper line: 1px vertical center line
    g.fillStyle(darken(color, 0.3));
    g.fillRect(x + 6, y, 1, 9);
    // Gear pouches at hip level (2x2 dark gray at y+7)
    g.fillStyle(0x374151);
    g.fillRect(x + 1, y + 7, 2, 2);
    g.fillRect(x + 9, y + 7, 2, 2);
  } else if (id === "neo") {
    // Coat lapels: 1px angled lines from collar
    g.fillStyle(darken(color, 0.15));
    g.fillRect(x + 3, y, 1, 3);
    g.fillRect(x + 8, y, 1, 3);
    // Inner shirt showing at collar (secondary green)
    g.fillStyle(secondaryColor);
    g.fillRect(x + 4, y, 4, 1);
    // Green matrix-style lines on coat
    g.fillStyle(secondaryColor);
    g.fillRect(x + 3, y + 3, 1, 6);
    g.fillRect(x + 6, y + 2, 1, 7);
    g.fillRect(x + 9, y + 3, 1, 6);
    // Gear pouches at hip level (2x2 dark gray at y+7)
    g.fillStyle(0x374151);
    g.fillRect(x + 1, y + 7, 2, 2);
    g.fillRect(x + 9, y + 7, 2, 2);
  } else if (id === "cj") {
    // Tank top straps: shoulder lines
    g.fillStyle(darken(color, 0.15));
    g.fillRect(x + 1, y, 2, 2);
    g.fillRect(x + 9, y, 2, 2);
    // Gold chain
    g.fillStyle(secondaryColor);
    g.fillRect(x + 3, y + 1, 6, 1);
    g.fillRect(x + 3, y + 2, 1, 1);
    g.fillRect(x + 8, y + 2, 1, 1);
    g.fillRect(x + 5, y + 2, 2, 2); // Chain pendant
    // Muscle definition on torso
    g.fillStyle(lighten(color, 0.1));
    g.fillRect(x + 4, y + 4, 1, 4);
    g.fillRect(x + 7, y + 4, 1, 4);
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
  const pantsOutline = darken(pantsColor, 0.4);
  const shoeOutline = darken(shoeColor, 0.4);

  // Left leg with outline
  g.fillStyle(pantsOutline);
  g.fillRect(x + leftOffset - 1, y - 1, 6, 10);
  g.fillStyle(pantsColor);
  g.fillRect(x + leftOffset, y, 4, 8);
  g.fillStyle(darken(pantsColor, 0.15));
  g.fillRect(x + leftOffset + 3, y, 1, 8);
  // Left shoe with outline
  g.fillStyle(shoeOutline);
  g.fillRect(x + leftOffset - 1, y + 7, 7, 4);
  g.fillStyle(shoeColor);
  g.fillRect(x + leftOffset, y + 8, 5, 2);
  // Boot sole line (1px darker at bottom)
  g.fillStyle(darken(shoeColor, 0.3));
  g.fillRect(x + leftOffset, y + 9, 5, 1);
  // Lace dot
  g.fillStyle(lighten(shoeColor, 0.3));
  g.fillRect(x + leftOffset + 2, y + 8, 1, 1);

  // Right leg with outline
  g.fillStyle(pantsOutline);
  g.fillRect(x + 6 + rightOffset - 1, y - 1, 6, 10);
  g.fillStyle(pantsColor);
  g.fillRect(x + 6 + rightOffset, y, 4, 8);
  g.fillStyle(darken(pantsColor, 0.15));
  g.fillRect(x + 6 + rightOffset + 3, y, 1, 8);
  // Right shoe with outline
  g.fillStyle(shoeOutline);
  g.fillRect(x + 6 + rightOffset - 1, y + 7, 7, 4);
  g.fillStyle(shoeColor);
  g.fillRect(x + 6 + rightOffset, y + 8, 5, 2);
  // Boot sole line
  g.fillStyle(darken(shoeColor, 0.3));
  g.fillRect(x + 6 + rightOffset, y + 9, 5, 1);
  // Lace dot
  g.fillStyle(lighten(shoeColor, 0.3));
  g.fillRect(x + 6 + rightOffset + 2, y + 8, 1, 1);
}

function drawArm(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  skinColor: number,
  id?: ArcadeCharacter
) {
  // 1px outline around arm+hand unit
  const outlineColor = darken(color, 0.4);
  g.fillStyle(outlineColor);
  g.fillRect(x - 1, y - 1, 6, 10);

  // Sleeve
  g.fillStyle(color);
  g.fillRect(x, y, 4, 5);
  // Hand
  g.fillStyle(skinColor);
  g.fillRect(x, y + 5, 4, 3);

  // Character-specific arm details
  if (id === "neo") {
    // Glove detail: darker than coat color
    g.fillStyle(darken(0x111111, 0.2));
    g.fillRect(x, y + 5, 4, 3);
  } else if (id === "cj") {
    // Muscle highlight: 1px lighter stripe on arm
    g.fillStyle(lighten(skinColor, 0.15));
    g.fillRect(x + 1, y + 5, 1, 3);
  }
}

// Draw left arm specifically (for CJ gold watch)
function drawLeftArm(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  skinColor: number,
  id: ArcadeCharacter
) {
  drawArm(g, x, y, color, skinColor, id);

  // CJ gold watch on left wrist
  if (id === "cj") {
    g.fillStyle(0xfbbf24); // Gold
    g.fillRect(x + 1, y + 4, 2, 1);
  }
}

function drawGun(g: Phaser.GameObjects.Graphics, handX: number, handY: number) {
  // Recognizable pistol shape: 4px barrel extending from hand
  const gunDark = 0x2a2a2a;
  const gunMid = 0x4b5563;
  const gunLight = 0x6b7280;

  // Gun body/grip (at hand level)
  g.fillStyle(gunDark);
  g.fillRect(handX, handY, 2, 3);
  // Barrel: 4px extending right, 1px wide
  g.fillStyle(gunMid);
  g.fillRect(handX + 2, handY, 4, 1);
  // Barrel highlight on top
  g.fillStyle(gunLight);
  g.fillRect(handX + 2, handY - 1, 4, 1);
  // Muzzle tip 1px brighter
  g.fillStyle(0x9ca3af);
  g.fillRect(handX + 5, handY, 1, 1);
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
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 9, color, skinColor, id);
    drawArm(g, 18, 9, color, skinColor, id);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_1`, W, H);
    g.destroy();
  }

  // ---- IDLE 2 (slight arm shift) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 10, color, skinColor, id); // Arms shifted down 1px
    drawArm(g, 18, 10, color, skinColor, id);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_2`, W, H);
    g.destroy();
  }

  // ---- RUN 1 (left leg forward) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 8, color, skinColor, id); // Left arm back
    drawArm(g, 17, 10, color, skinColor, id); // Right arm forward
    drawLegs(g, 6, 18, pantsColor, shoeColor, -1, 1);
    g.generateTexture(`${id}_run_1`, W, H);
    g.destroy();
  }

  // ---- RUN 2 (right leg forward) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 10, color, skinColor, id); // Left arm forward
    drawArm(g, 17, 8, color, skinColor, id); // Right arm back
    drawLegs(g, 6, 18, pantsColor, shoeColor, 1, -1);
    g.generateTexture(`${id}_run_2`, W, H);
    g.destroy();
  }

  // ---- JUMP ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    // Arms up
    drawLeftArm(g, 1, 6, color, skinColor, id);
    drawArm(g, 18, 6, color, skinColor, id);
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
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    // Arms spread wide
    drawLeftArm(g, 0, 8, color, skinColor, id);
    drawArm(g, 20, 8, color, skinColor, id);
    // Legs spread
    drawLegs(g, 6, 18, pantsColor, shoeColor, -2, 2);
    g.generateTexture(`${id}_fall`, W, H);
    g.destroy();
  }

  // ---- SHOOT 1 (gun arm extended) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    // Left arm normal
    drawLeftArm(g, 1, 9, color, skinColor, id);
    // Right arm extended with gun
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(17, 9, 6, 5);
    g.fillStyle(color);
    g.fillRect(18, 10, 4, 3);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(22, 10, 2, 3);
    // Gun
    drawGun(g, 22, 11);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_1`, W, H);
    g.destroy();
  }

  // ---- SHOOT 2 (slight recoil) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 9, color, skinColor, id);
    // Right arm extended, shifted back slightly for recoil
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(16, 8, 6, 5);
    g.fillStyle(color);
    g.fillRect(17, 9, 4, 3);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(21, 9, 2, 3);
    // Gun
    drawGun(g, 21, 10);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_2`, W, H);
    g.destroy();
  }

  // ---- CROUCH ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Everything shifted down so character appears shorter
    drawHead(g, 8, 8, skinColor, id);
    drawTorso(g, 6, 16, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 17, color, skinColor, id);
    drawArm(g, 18, 17, color, skinColor, id);
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
    drawTorso(g, 6, 16, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 17, color, skinColor, id);
    // Gun arm extended
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(17, 17, 6, 5);
    g.fillStyle(color);
    g.fillRect(18, 18, 4, 3);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(22, 18, 2, 3);
    // Gun
    drawGun(g, 22, 19);
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
    // Red-tinted torso with outline
    const hurtColor = 0xcc3333;
    const hurtOutline = darken(hurtColor, 0.5);
    g.fillStyle(hurtOutline);
    g.fillRect(4, 8, 14, 12);
    g.fillStyle(hurtColor);
    g.fillRect(5, 9, 12, 10);
    g.fillStyle(lighten(hurtColor, 0.2));
    g.fillRect(5, 9, 3, 10);
    // Arms flailing
    drawLeftArm(g, 0, 7, color, skinColor, id);
    drawArm(g, 19, 11, color, skinColor, id);
    drawLegs(g, 5, 19, pantsColor, shoeColor, -1, 1);
    g.generateTexture(`${id}_hurt`, W, H);
    g.destroy();
  }

  // ---- DIE 1 (falling back) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 7, 2, skinColor, id);
    drawTorso(g, 5, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 0, 8, color, skinColor, id);
    drawArm(g, 17, 12, color, skinColor, id);
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

  // ---- IDLE 3 (chest rise -- breathing cycle) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 7, color, secondaryColor, id, skinColor); // Torso up 1px
    drawLeftArm(g, 1, 8, color, skinColor, id);
    drawArm(g, 18, 8, color, skinColor, id);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_3`, W, H);
    g.destroy();
  }

  // ---- IDLE 4 (chest lower -- breathing return) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 1, skinColor, id); // Head down 1px
    drawTorso(g, 6, 9, color, secondaryColor, id, skinColor); // Torso down 1px
    drawLeftArm(g, 1, 10, color, skinColor, id);
    drawArm(g, 18, 10, color, skinColor, id);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_4`, W, H);
    g.destroy();
  }

  // ---- RUN 3 (mid-stride contact, wide legs) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 9, color, skinColor, id);
    drawArm(g, 18, 9, color, skinColor, id);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 2, -2);
    g.generateTexture(`${id}_run_3`, W, H);
    g.destroy();
  }

  // ---- RUN 4 (passing phase, legs together) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 1, skinColor, id); // Head bob
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 10, color, skinColor, id);
    drawArm(g, 17, 10, color, skinColor, id);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_run_4`, W, H);
    g.destroy();
  }

  // ---- JUMP 2 (apex -- arms level, legs tucked tight) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 0, 7, color, skinColor, id);
    drawArm(g, 20, 7, color, skinColor, id);
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

  // ---- FALL 2 (fast descent -- arms up, body stretched) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 8, 0, skinColor, id);
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 5, color, skinColor, id);
    drawArm(g, 18, 5, color, skinColor, id);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_fall_2`, W, H);
    g.destroy();
  }

  // ---- SHOOT 3 (full recoil -- gun arm pulled back) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 7, 0, skinColor, id); // Head shifted 1px back
    drawTorso(g, 6, 8, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 9, color, skinColor, id);
    // Gun arm pulled back for recoil
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(15, 7, 6, 5);
    g.fillStyle(color);
    g.fillRect(16, 8, 4, 3);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(20, 8, 2, 3);
    // Gun
    drawGun(g, 20, 9);
    drawLegs(g, 6, 18, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_3`, W, H);
    g.destroy();
  }

  // ---- DIE 4 (stagger spin -- partially rotated) ----
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
