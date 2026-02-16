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

// --- Shared drawing helpers (32x40 canvas) ---

function drawHead(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  skinColor: number,
  id: ArcadeCharacter,
  glintFrame?: number
) {
  // 10x10 head with 1px outline
  drawOutlinedRect(g, x, y, 10, 10, skinColor, darken(skinColor, 0.4));

  // Hair / head detail per character
  if (id === "ghost") {
    // Hoodie hood: wider 3px ridge above head
    g.fillStyle(darken(0x2d1b4e, 0.3));
    g.fillRect(x - 1, y - 3, 12, 3);
    g.fillStyle(0x2d1b4e);
    g.fillRect(x, y - 1, 10, 1);
    // Hood brim highlight
    g.fillStyle(lighten(0x2d1b4e, 0.15));
    g.fillRect(x + 1, y - 3, 8, 1);
    // Hood shadow on face sides
    g.fillStyle(darken(0x2d1b4e, 0.4));
    g.fillRect(x, y + 2, 1, 3);
    g.fillRect(x + 9, y + 2, 1, 3);
    // Dark hair under hood
    g.fillStyle(0x1a1a2e);
    g.fillRect(x, y, 10, 3);

    // Glasses with 2px wide lenses and frame sides
    g.fillStyle(0x374151); // Frame
    g.fillRect(x + 1, y + 4, 8, 2);
    // Left lens
    g.fillStyle(0x3b82f6);
    g.fillRect(x + 1, y + 4, 3, 2);
    // Right lens
    g.fillStyle(0x3b82f6);
    g.fillRect(x + 6, y + 4, 3, 2);
    // Bridge
    g.fillStyle(0x374151);
    g.fillRect(x + 4, y + 4, 2, 1);
    // Frame side arms
    g.fillStyle(0x374151);
    g.fillRect(x, y + 4, 1, 2);
    g.fillRect(x + 9, y + 4, 1, 2);

    // Animated glint on lenses
    const gf = glintFrame ?? 0;
    if (gf === 0) {
      g.fillStyle(lighten(0x3b82f6, 0.7));
      g.fillRect(x + 1, y + 4, 1, 1);
      g.fillStyle(lighten(0x3b82f6, 0.4));
      g.fillRect(x + 6, y + 5, 1, 1);
    } else if (gf === 1) {
      g.fillStyle(lighten(0x3b82f6, 0.7));
      g.fillRect(x + 2, y + 4, 1, 1);
      g.fillStyle(lighten(0x3b82f6, 0.4));
      g.fillRect(x + 7, y + 4, 1, 1);
    } else if (gf === 2) {
      g.fillStyle(lighten(0x3b82f6, 0.7));
      g.fillRect(x + 3, y + 5, 1, 1);
      g.fillStyle(lighten(0x3b82f6, 0.4));
      g.fillRect(x + 8, y + 4, 1, 1);
    } else {
      g.fillStyle(lighten(0x3b82f6, 0.7));
      g.fillRect(x + 1, y + 5, 1, 1);
      g.fillStyle(lighten(0x3b82f6, 0.4));
      g.fillRect(x + 7, y + 5, 1, 1);
    }
  } else if (id === "neo") {
    // Slicked back dark hair
    g.fillStyle(0x0a0a0f);
    g.fillRect(x, y, 10, 3);
    g.fillRect(x, y + 3, 1, 2);
    g.fillRect(x + 9, y + 3, 1, 2);
    // Hair shine
    g.fillStyle(lighten(0x0a0a0f, 0.15));
    g.fillRect(x + 3, y, 4, 1);

    // 2-row sunglasses with reflection
    g.fillStyle(0x0a0a0f);
    g.fillRect(x + 1, y + 4, 4, 2);
    g.fillRect(x + 6, y + 4, 3, 2);
    // Top row reflection
    g.fillStyle(lighten(0x0a0a0f, 0.25));
    g.fillRect(x + 1, y + 4, 2, 1);
    g.fillRect(x + 6, y + 4, 1, 1);
    // Bottom row slight reflection
    g.fillStyle(lighten(0x0a0a0f, 0.12));
    g.fillRect(x + 3, y + 5, 1, 1);
    g.fillRect(x + 7, y + 5, 1, 1);
    // Glasses bridge
    g.fillStyle(0x0a0a0f);
    g.fillRect(x + 5, y + 4, 1, 1);

    // Green earpiece glow
    g.fillStyle(0x22c55e);
    g.fillRect(x + 9, y + 3, 1, 2);
    // Earpiece glow aura
    g.fillStyle(lighten(0x22c55e, 0.4));
    g.fillRect(x + 9, y + 5, 1, 1);
  } else if (id === "cj") {
    // Bald head with highlight
    g.fillStyle(lighten(skinColor, 0.2));
    g.fillRect(x + 2, y, 6, 1);
    g.fillStyle(lighten(skinColor, 0.12));
    g.fillRect(x + 3, y + 1, 4, 1);

    // Visible eyebrow ridge
    g.fillStyle(darken(skinColor, 0.18));
    g.fillRect(x + 1, y + 3, 3, 1);
    g.fillRect(x + 6, y + 3, 3, 1);

    // Eyes with 2px width and visible pupils
    g.fillStyle(0xffffff);
    g.fillRect(x + 2, y + 4, 2, 2);
    g.fillRect(x + 6, y + 4, 2, 2);
    // Pupils
    g.fillStyle(0x0a0a0f);
    g.fillRect(x + 3, y + 4, 1, 2);
    g.fillRect(x + 7, y + 4, 1, 2);
  }

  // Chin shadow (all characters)
  g.fillStyle(darken(skinColor, 0.15));
  g.fillRect(x + 2, y + 8, 6, 1);
  // Jaw line
  g.fillStyle(darken(skinColor, 0.08));
  g.fillRect(x + 1, y + 9, 8, 1);
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
  // Body 16x12 with 1px outline
  const outlineColor = darken(color, 0.5);
  g.fillStyle(outlineColor);
  g.fillRect(x - 1, y - 1, 18, 14);

  // 5-zone shading: edge highlight (1px) → light (2px) → dither/base (6px) → shadow (4px) → edge shadow (1px)
  // Left edge highlight
  g.fillStyle(lighten(color, 0.4));
  g.fillRect(x, y, 1, 12);
  // Left light zone
  g.fillStyle(lighten(color, 0.25));
  g.fillRect(x + 1, y, 2, 12);
  // Dither transition (alternating light/base)
  g.fillStyle(lighten(color, 0.12));
  g.fillRect(x + 3, y, 1, 12);
  // Middle base zone
  g.fillStyle(color);
  g.fillRect(x + 4, y, 6, 12);
  // Dither transition right
  g.fillStyle(darken(color, 0.08));
  g.fillRect(x + 10, y, 1, 12);
  // Right shadow zone
  g.fillStyle(darken(color, 0.25));
  g.fillRect(x + 11, y, 3, 12);
  // Right edge shadow
  g.fillStyle(darken(color, 0.38));
  g.fillRect(x + 14, y, 2, 12);

  // Ambient occlusion: neck crease
  g.fillStyle(darken(color, 0.35));
  g.fillRect(x + 2, y, 12, 1);
  // Under-arm shadows
  g.fillStyle(darken(color, 0.2));
  g.fillRect(x, y + 1, 2, 2);
  g.fillRect(x + 14, y + 1, 2, 2);

  // Collar detail: V-neck showing skin at top center
  if (skinColor) {
    g.fillStyle(skinColor);
    g.fillRect(x + 6, y, 4, 1);
    g.fillStyle(darken(skinColor, 0.1));
    g.fillRect(x + 5, y + 1, 1, 1);
    g.fillRect(x + 10, y + 1, 1, 1);
  }

  // Belt area ambient occlusion
  g.fillStyle(darken(color, 0.18));
  g.fillRect(x + 1, y + 10, 14, 1);

  // Belt line at y+11: 1px dark gray strip with buckle
  g.fillStyle(0x1f2937);
  g.fillRect(x, y + 11, 16, 1);
  // Belt buckle at center
  g.fillStyle(0x9ca3af);
  g.fillRect(x + 6, y + 11, 3, 1);
  // Buckle highlight
  g.fillStyle(lighten(0x9ca3af, 0.3));
  g.fillRect(x + 7, y + 11, 1, 1);

  // Character-specific detail
  if (id === "ghost") {
    // Ghost logo 6x5 on hoodie
    g.fillStyle(secondaryColor);
    g.fillRect(x + 5, y + 2, 6, 5);
    g.fillRect(x + 6, y + 1, 4, 1);
    // Logo eye sockets
    g.fillStyle(darken(secondaryColor, 0.4));
    g.fillRect(x + 6, y + 3, 2, 1);
    g.fillRect(x + 9, y + 3, 1, 1);
    // Logo highlight
    g.fillStyle(lighten(secondaryColor, 0.3));
    g.fillRect(x + 7, y + 2, 2, 1);

    // Zipper line: 1px vertical center
    g.fillStyle(darken(color, 0.3));
    g.fillRect(x + 8, y, 1, 11);
    // Zipper teeth detail
    g.fillStyle(0x9ca3af);
    g.fillRect(x + 8, y + 1, 1, 1);
    g.fillRect(x + 8, y + 3, 1, 1);
    g.fillRect(x + 8, y + 5, 1, 1);
    g.fillRect(x + 8, y + 7, 1, 1);

    // Gear pouches at hip level with flap detail
    g.fillStyle(0x374151);
    g.fillRect(x + 1, y + 8, 3, 3);
    g.fillRect(x + 12, y + 8, 3, 3);
    // Pouch flaps
    g.fillStyle(0x4b5563);
    g.fillRect(x + 1, y + 8, 3, 1);
    g.fillRect(x + 12, y + 8, 3, 1);
    // Pouch button
    g.fillStyle(0x6b7280);
    g.fillRect(x + 2, y + 9, 1, 1);
    g.fillRect(x + 13, y + 9, 1, 1);
  } else if (id === "neo") {
    // Coat lapels: wider angled lines from collar
    g.fillStyle(darken(color, 0.15));
    g.fillRect(x + 3, y, 2, 4);
    g.fillRect(x + 11, y, 2, 4);
    // Lapel edge highlight
    g.fillStyle(lighten(color, 0.1));
    g.fillRect(x + 3, y, 1, 4);
    g.fillRect(x + 12, y, 1, 4);

    // Inner shirt showing at collar (secondary green)
    g.fillStyle(secondaryColor);
    g.fillRect(x + 5, y, 6, 1);
    g.fillRect(x + 6, y + 1, 4, 1);

    // Coat seam lines
    g.fillStyle(darken(color, 0.12));
    g.fillRect(x + 4, y + 4, 1, 7);
    g.fillRect(x + 11, y + 4, 1, 7);

    // Matrix code lines with varied lengths
    g.fillStyle(secondaryColor);
    g.fillRect(x + 3, y + 4, 1, 7);
    g.fillRect(x + 7, y + 3, 1, 8);
    g.fillRect(x + 10, y + 5, 1, 5);
    g.fillRect(x + 12, y + 4, 1, 6);
    // Shorter accent lines
    g.fillStyle(lighten(secondaryColor, 0.3));
    g.fillRect(x + 5, y + 6, 1, 3);
    g.fillRect(x + 9, y + 4, 1, 4);

    // Gear pouches at hip level
    g.fillStyle(0x374151);
    g.fillRect(x + 1, y + 8, 3, 3);
    g.fillRect(x + 12, y + 8, 3, 3);
    // Pouch flaps
    g.fillStyle(0x4b5563);
    g.fillRect(x + 1, y + 8, 3, 1);
    g.fillRect(x + 12, y + 8, 3, 1);

    // Coat hem flare: extends 1px past torso on each side
    g.fillStyle(darken(color, 0.2));
    g.fillRect(x - 1, y + 11, 18, 1);
  } else if (id === "cj") {
    // Tank top straps: wider shoulders
    g.fillStyle(darken(color, 0.15));
    g.fillRect(x, y, 4, 3);
    g.fillRect(x + 12, y, 4, 3);
    // Strap edge
    g.fillStyle(darken(color, 0.25));
    g.fillRect(x + 3, y, 1, 3);
    g.fillRect(x + 12, y, 1, 3);

    // Gold chain with V-pendant
    g.fillStyle(secondaryColor);
    g.fillRect(x + 4, y + 1, 8, 1);
    g.fillRect(x + 4, y + 2, 1, 1);
    g.fillRect(x + 11, y + 2, 1, 1);
    g.fillRect(x + 5, y + 3, 1, 1);
    g.fillRect(x + 10, y + 3, 1, 1);
    // V-pendant
    g.fillRect(x + 6, y + 3, 4, 2);
    g.fillRect(x + 7, y + 5, 2, 1);
    // Chain shimmer
    g.fillStyle(lighten(secondaryColor, 0.5));
    g.fillRect(x + 6, y + 3, 1, 1);
    g.fillRect(x + 8, y + 4, 1, 1);

    // Visible pec contour
    g.fillStyle(lighten(color, 0.08));
    g.fillRect(x + 4, y + 4, 2, 3);
    g.fillRect(x + 10, y + 4, 2, 3);
    // Deltoid contour
    g.fillStyle(darken(color, 0.08));
    g.fillRect(x + 5, y + 5, 1, 4);
    g.fillRect(x + 10, y + 5, 1, 4);
    // Center muscle definition line
    g.fillStyle(darken(color, 0.1));
    g.fillRect(x + 8, y + 4, 1, 5);
  }
}

function drawLegs(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  pantsColor: number,
  shoeColor: number,
  leftOffset: number,
  rightOffset: number,
  kneeBend?: boolean
) {
  const pantsOutline = darken(pantsColor, 0.4);
  const shoeOutline = darken(shoeColor, 0.4);

  // Left leg 5x10 with outline
  g.fillStyle(pantsOutline);
  g.fillRect(x + leftOffset - 1, y - 1, 7, 12);
  g.fillStyle(pantsColor);
  g.fillRect(x + leftOffset, y, 5, 10);
  // Left leg shadow
  g.fillStyle(darken(pantsColor, 0.15));
  g.fillRect(x + leftOffset + 4, y, 1, 10);
  // Left leg inner shadow
  g.fillStyle(darken(pantsColor, 0.08));
  g.fillRect(x + leftOffset, y, 1, 10);
  // Pants crease at knee
  g.fillStyle(darken(pantsColor, 0.2));
  g.fillRect(x + leftOffset + 1, y + 4, 3, 1);
  // Knee bend highlight for run frames
  if (kneeBend) {
    g.fillStyle(lighten(pantsColor, 0.1));
    g.fillRect(x + leftOffset + 1, y + 3, 3, 1);
  }

  // Left boot with detail
  g.fillStyle(shoeOutline);
  g.fillRect(x + leftOffset - 1, y + 8, 8, 5);
  g.fillStyle(shoeColor);
  g.fillRect(x + leftOffset, y + 9, 6, 3);
  // Toe cap
  g.fillStyle(lighten(shoeColor, 0.12));
  g.fillRect(x + leftOffset + 4, y + 9, 2, 2);
  // Lace pattern
  g.fillStyle(lighten(shoeColor, 0.3));
  g.fillRect(x + leftOffset + 2, y + 9, 1, 1);
  g.fillRect(x + leftOffset + 3, y + 10, 1, 1);
  // Sole texture
  g.fillStyle(darken(shoeColor, 0.35));
  g.fillRect(x + leftOffset, y + 11, 6, 1);
  // Sole tread
  g.fillStyle(darken(shoeColor, 0.2));
  g.fillRect(x + leftOffset + 1, y + 11, 1, 1);
  g.fillRect(x + leftOffset + 3, y + 11, 1, 1);
  g.fillRect(x + leftOffset + 5, y + 11, 1, 1);

  // Right leg 5x10 with outline
  g.fillStyle(pantsOutline);
  g.fillRect(x + 8 + rightOffset - 1, y - 1, 7, 12);
  g.fillStyle(pantsColor);
  g.fillRect(x + 8 + rightOffset, y, 5, 10);
  // Right leg shadow
  g.fillStyle(darken(pantsColor, 0.15));
  g.fillRect(x + 8 + rightOffset + 4, y, 1, 10);
  // Right leg inner shadow
  g.fillStyle(darken(pantsColor, 0.08));
  g.fillRect(x + 8 + rightOffset, y, 1, 10);
  // Pants crease at knee
  g.fillStyle(darken(pantsColor, 0.2));
  g.fillRect(x + 8 + rightOffset + 1, y + 4, 3, 1);
  // Knee bend highlight for run frames
  if (kneeBend) {
    g.fillStyle(lighten(pantsColor, 0.1));
    g.fillRect(x + 8 + rightOffset + 1, y + 3, 3, 1);
  }

  // Right boot with detail
  g.fillStyle(shoeOutline);
  g.fillRect(x + 8 + rightOffset - 1, y + 8, 8, 5);
  g.fillStyle(shoeColor);
  g.fillRect(x + 8 + rightOffset, y + 9, 6, 3);
  // Toe cap
  g.fillStyle(lighten(shoeColor, 0.12));
  g.fillRect(x + 8 + rightOffset + 4, y + 9, 2, 2);
  // Lace pattern
  g.fillStyle(lighten(shoeColor, 0.3));
  g.fillRect(x + 8 + rightOffset + 2, y + 9, 1, 1);
  g.fillRect(x + 8 + rightOffset + 3, y + 10, 1, 1);
  // Sole texture
  g.fillStyle(darken(shoeColor, 0.35));
  g.fillRect(x + 8 + rightOffset, y + 11, 6, 1);
  // Sole tread
  g.fillStyle(darken(shoeColor, 0.2));
  g.fillRect(x + 8 + rightOffset + 1, y + 11, 1, 1);
  g.fillRect(x + 8 + rightOffset + 3, y + 11, 1, 1);
  g.fillRect(x + 8 + rightOffset + 5, y + 11, 1, 1);
}

function drawArm(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  skinColor: number,
  id?: ArcadeCharacter,
  elbowBend?: boolean
) {
  // 5x10 arm with outline
  const outlineColor = darken(color, 0.4);
  g.fillStyle(outlineColor);
  g.fillRect(x - 1, y - 1, 7, 12);

  // Sleeve
  g.fillStyle(color);
  g.fillRect(x, y, 5, 6);
  // Sleeve shadow
  g.fillStyle(darken(color, 0.15));
  g.fillRect(x + 4, y, 1, 6);
  // Sleeve highlight
  g.fillStyle(lighten(color, 0.15));
  g.fillRect(x, y, 1, 6);

  // Elbow joint at bend
  if (elbowBend) {
    g.fillStyle(darken(color, 0.25));
    g.fillRect(x + 1, y + 5, 3, 1);
    g.fillStyle(lighten(color, 0.1));
    g.fillRect(x + 1, y + 4, 3, 1);
  }

  // Hand/forearm
  g.fillStyle(skinColor);
  g.fillRect(x, y + 6, 5, 4);
  // Hand shadow
  g.fillStyle(darken(skinColor, 0.12));
  g.fillRect(x + 4, y + 6, 1, 4);

  // Character-specific arm details
  if (id === "neo") {
    // Black gloves with finger detail
    g.fillStyle(darken(0x111111, 0.2));
    g.fillRect(x, y + 6, 5, 4);
    // Glove knuckle line
    g.fillStyle(lighten(0x111111, 0.1));
    g.fillRect(x + 1, y + 8, 3, 1);
    // Finger segments
    g.fillStyle(darken(0x111111, 0.3));
    g.fillRect(x + 1, y + 9, 1, 1);
    g.fillRect(x + 3, y + 9, 1, 1);
  } else if (id === "cj") {
    // 2px muscle highlight stripe
    g.fillStyle(lighten(skinColor, 0.18));
    g.fillRect(x + 1, y + 6, 2, 4);
    // Forearm definition
    g.fillStyle(darken(skinColor, 0.08));
    g.fillRect(x + 3, y + 7, 1, 2);
  }
}

// Draw left arm specifically (for CJ gold watch)
function drawLeftArm(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  skinColor: number,
  id: ArcadeCharacter,
  elbowBend?: boolean
) {
  drawArm(g, x, y, color, skinColor, id, elbowBend);

  // CJ gold watch on left wrist with detail
  if (id === "cj") {
    g.fillStyle(0xfbbf24); // Gold band
    g.fillRect(x + 1, y + 5, 3, 1);
    // Watch face
    g.fillStyle(0x0a0a0f);
    g.fillRect(x + 1, y + 4, 3, 1);
    // Watch highlight
    g.fillStyle(lighten(0xfbbf24, 0.4));
    g.fillRect(x + 2, y + 5, 1, 1);
  }
}

function drawGun(g: Phaser.GameObjects.Graphics, handX: number, handY: number) {
  const gunDark = 0x2a2a2a;
  const gunMid = 0x4b5563;
  const gunLight = 0x6b7280;

  // Gun body/grip (at hand level)
  g.fillStyle(gunDark);
  g.fillRect(handX, handY, 2, 4);
  // Grip texture
  g.fillStyle(lighten(gunDark, 0.1));
  g.fillRect(handX, handY + 1, 1, 1);
  g.fillRect(handX + 1, handY + 3, 1, 1);

  // Trigger guard detail
  g.fillStyle(darken(gunDark, 0.3));
  g.fillRect(handX, handY + 2, 2, 1);
  g.fillStyle(gunDark);
  g.fillRect(handX + 1, handY + 2, 1, 1);

  // Visible magazine
  g.fillStyle(darken(gunMid, 0.2));
  g.fillRect(handX, handY + 4, 2, 1);

  // Barrel: 8px extending right, 2px tall
  g.fillStyle(gunMid);
  g.fillRect(handX + 2, handY, 6, 2);
  // Barrel highlight on top
  g.fillStyle(gunLight);
  g.fillRect(handX + 2, handY - 1, 6, 1);
  // Barrel shadow bottom
  g.fillStyle(darken(gunMid, 0.25));
  g.fillRect(handX + 2, handY + 1, 6, 1);

  // Muzzle brake (last 2px)
  g.fillStyle(0x9ca3af);
  g.fillRect(handX + 8, handY, 2, 2);
  // Muzzle brake slots
  g.fillStyle(darken(0x9ca3af, 0.3));
  g.fillRect(handX + 8, handY + 1, 1, 1);
  g.fillRect(handX + 9, handY, 1, 1);
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

function drawKnife(g: Phaser.GameObjects.Graphics, handX: number, handY: number) {
  const bladeSilver = 0x9ca3af;
  const bladeEdge = 0xd1d5db;
  const handleDark = 0x374151;

  // Wrapped handle (at hand)
  g.fillStyle(handleDark);
  g.fillRect(handX, handY, 2, 3);
  // Handle wrap detail
  g.fillStyle(lighten(handleDark, 0.15));
  g.fillRect(handX, handY, 1, 1);
  g.fillRect(handX + 1, handY + 1, 1, 1);
  g.fillRect(handX, handY + 2, 1, 1);

  // Guard
  g.fillStyle(0x6b7280);
  g.fillRect(handX - 1, handY, 1, 2);
  g.fillRect(handX + 2, handY, 1, 2);

  // Blade: 8px extending right, 2px tall
  g.fillStyle(bladeSilver);
  g.fillRect(handX + 2, handY, 6, 2);
  // Edge highlight on top
  g.fillStyle(bladeEdge);
  g.fillRect(handX + 2, handY - 1, 6, 1);
  // Blood groove detail (darker line running through blade center)
  g.fillStyle(darken(bladeSilver, 0.2));
  g.fillRect(handX + 3, handY + 1, 4, 1);
  // Blade shadow
  g.fillStyle(darken(bladeSilver, 0.15));
  g.fillRect(handX + 2, handY + 1, 1, 1);

  // Tip tapering + highlight
  g.fillStyle(0xe5e7eb);
  g.fillRect(handX + 8, handY, 2, 1);
  g.fillStyle(bladeEdge);
  g.fillRect(handX + 9, handY, 1, 1);
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
  const W = 32;
  const H = 40;

  // ---- IDLE 1 (neutral standing) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id, 0);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 11, color, skinColor, id);
    drawArm(g, 25, 11, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_1`, W, H);
    g.destroy();
  }

  // ---- IDLE 2 (slight arm shift down -- breathing out) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id, 0);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 12, color, skinColor, id);
    drawArm(g, 25, 12, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_2`, W, H);
    g.destroy();
  }

  // ---- IDLE 3 (chest rise -- breathing in) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id, 1);
    drawTorso(g, 8, 9, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 10, color, skinColor, id);
    drawArm(g, 25, 10, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_3`, W, H);
    g.destroy();
  }

  // ---- IDLE 4 (chest lower -- breathing return) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 1, skinColor, id, 1);
    drawTorso(g, 8, 11, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 12, color, skinColor, id);
    drawArm(g, 25, 12, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_4`, W, H);
    g.destroy();
  }

  // ---- IDLE 5 (character quirk start) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id, 2);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    if (id === "ghost") {
      // Adjusting glasses: right arm raised toward face
      drawLeftArm(g, 2, 11, color, skinColor, id);
      drawArm(g, 22, 7, color, skinColor, id, true);
    } else if (id === "neo") {
      // Cracking knuckles: arms come together
      drawLeftArm(g, 6, 11, color, skinColor, id);
      drawArm(g, 21, 11, color, skinColor, id);
    } else {
      // CJ flex: arms up slightly
      drawLeftArm(g, 1, 8, color, skinColor, id);
      drawArm(g, 26, 8, color, skinColor, id);
    }
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_5`, W, H);
    g.destroy();
  }

  // ---- IDLE 6 (character quirk peak) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    if (id === "ghost") {
      // Glasses pushed up: glasses shifted 1px higher, arm near face
      drawHead(g, 11, 0, skinColor, id, 2);
      // Redraw glasses 1px higher as quirk detail
      g.fillStyle(0x374151);
      g.fillRect(12, 3, 8, 2);
      g.fillStyle(0x3b82f6);
      g.fillRect(12, 3, 3, 2);
      g.fillRect(17, 3, 3, 2);
      g.fillStyle(lighten(0x3b82f6, 0.7));
      g.fillRect(12, 3, 1, 1);
      g.fillStyle(0x374151);
      g.fillRect(15, 3, 2, 1);
      g.fillRect(11, 3, 1, 2);
      g.fillRect(20, 3, 1, 2);
      drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
      drawLeftArm(g, 2, 11, color, skinColor, id);
      drawArm(g, 21, 5, color, skinColor, id, true);
    } else if (id === "neo") {
      // Head tilted, fists together center
      drawHead(g, 10, 0, skinColor, id, 3);
      drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
      drawLeftArm(g, 8, 12, color, skinColor, id);
      drawArm(g, 19, 12, color, skinColor, id);
    } else {
      // CJ full flex: arms up showing biceps
      drawHead(g, 11, 0, skinColor, id);
      drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
      drawLeftArm(g, 0, 5, color, skinColor, id);
      drawArm(g, 27, 5, color, skinColor, id);
      // Bicep highlight
      g.fillStyle(lighten(skinColor, 0.25));
      g.fillRect(1, 8, 3, 1);
      g.fillRect(28, 8, 3, 1);
      // Vein detail
      g.fillStyle(darken(skinColor, 0.1));
      g.fillRect(2, 9, 1, 2);
      g.fillRect(29, 9, 1, 2);
    }
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_6`, W, H);
    g.destroy();
  }

  // ---- IDLE 7 (quirk return -- mirrors idle_5 approach) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id, 3);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    if (id === "ghost") {
      // Arm lowering from glasses
      drawLeftArm(g, 2, 11, color, skinColor, id);
      drawArm(g, 23, 8, color, skinColor, id, true);
    } else if (id === "neo") {
      // Arms separating from knuckle crack
      drawLeftArm(g, 5, 11, color, skinColor, id);
      drawArm(g, 22, 11, color, skinColor, id);
    } else {
      // CJ arms lowering from flex
      drawLeftArm(g, 1, 9, color, skinColor, id);
      drawArm(g, 26, 9, color, skinColor, id);
    }
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_idle_7`, W, H);
    g.destroy();
  }

  // ---- IDLE 8 (settling back -- transition to idle_1) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id, 0);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 11, color, skinColor, id);
    drawArm(g, 25, 11, color, skinColor, id);
    // Slight weight shift - legs offset 1px
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    // Settling detail: slight shoulder drop via 1px torso shadow shift
    g.fillStyle(darken(color, 0.1));
    g.fillRect(9, 10, 14, 1);
    g.generateTexture(`${id}_idle_8`, W, H);
    g.destroy();
  }

  // ---- RUN 1 (contact -- left foot forward) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 12, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 3, 10, color, skinColor, id, true);
    drawArm(g, 24, 12, color, skinColor, id, true);
    drawLegs(g, 8, 22, pantsColor, shoeColor, -2, 2, true);
    g.generateTexture(`${id}_run_1`, W, H);
    g.destroy();
  }

  // ---- RUN 2 (recoil -- weight absorbing impact) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 12, 1, skinColor, id);
    drawTorso(g, 8, 11, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 3, 11, color, skinColor, id, true);
    drawArm(g, 24, 13, color, skinColor, id, true);
    drawLegs(g, 8, 23, pantsColor, shoeColor, -1, 1, true);
    g.generateTexture(`${id}_run_2`, W, H);
    g.destroy();
  }

  // ---- RUN 3 (passing -- legs together, upright) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 12, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 11, color, skinColor, id);
    drawArm(g, 25, 11, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_run_3`, W, H);
    g.destroy();
  }

  // ---- RUN 4 (high -- right foot forward, body rising) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 12, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 3, 12, color, skinColor, id, true);
    drawArm(g, 24, 10, color, skinColor, id, true);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 2, -2, true);
    g.generateTexture(`${id}_run_4`, W, H);
    g.destroy();
  }

  // ---- RUN 5 (drive -- pushing off, wide stride) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 13, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 3, 13, color, skinColor, id, true);
    drawArm(g, 24, 9, color, skinColor, id, true);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 3, -3, true);
    g.generateTexture(`${id}_run_5`, W, H);
    g.destroy();
  }

  // ---- RUN 6 (recovery -- returning to upright) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 12, 1, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 12, color, skinColor, id);
    drawArm(g, 25, 10, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 1, -1, true);
    g.generateTexture(`${id}_run_6`, W, H);
    g.destroy();
  }

  // ---- SHOOT 1 (aim -- gun arm extending) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 11, color, skinColor, id);
    // Right arm extended with gun
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(24, 11, 7, 6);
    g.fillStyle(color);
    g.fillRect(25, 12, 5, 4);
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(25, 12, 1, 4);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(29, 12, 3, 4);
    if (id === "neo") {
      g.fillStyle(lighten(0x111111, 0.1));
      g.fillRect(30, 14, 2, 1);
    }
    drawGun(g, 29, 13);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_1`, W, H);
    g.destroy();
  }

  // ---- SHOOT 2 (fire -- muzzle flash, body braced) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 11, color, skinColor, id);
    // Right arm extended
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(24, 11, 7, 6);
    g.fillStyle(color);
    g.fillRect(25, 12, 5, 4);
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(25, 12, 1, 4);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(29, 12, 3, 4);
    drawGun(g, 29, 13);
    // Muzzle flash
    g.fillStyle(0xfde047);
    g.fillRect(31, 11, 1, 1);
    g.fillRect(31, 15, 1, 1);
    g.fillStyle(0xffffff);
    g.fillRect(31, 12, 1, 3);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_2`, W, H);
    g.destroy();
  }

  // ---- SHOOT 3 (recoil -- gun arm pulled back) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 10, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 11, color, skinColor, id);
    // Gun arm pulled back for recoil
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(22, 9, 7, 6);
    g.fillStyle(color);
    g.fillRect(23, 10, 5, 4);
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(23, 10, 1, 4);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(27, 10, 3, 4);
    drawGun(g, 27, 11);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_3`, W, H);
    g.destroy();
  }

  // ---- SHOOT 4 (settle/recovery -- returning to neutral) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 11, color, skinColor, id);
    // Gun arm settling
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(23, 10, 7, 6);
    g.fillStyle(color);
    g.fillRect(24, 11, 5, 4);
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(24, 11, 1, 4);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(28, 11, 3, 4);
    drawGun(g, 28, 12);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_shoot_4`, W, H);
    g.destroy();
  }

  // ---- MELEE 1 (anticipation -- winding up, body coiling) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 10, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    // Left arm pulled back holding knife
    drawLeftArm(g, 0, 9, color, skinColor, id, true);
    drawKnife(g, 0, 15);
    // Right arm bracing
    drawArm(g, 25, 11, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, -1, 1);
    g.generateTexture(`${id}_melee_1`, W, H);
    g.destroy();
  }

  // ---- MELEE 2 (wind-up -- arm cocked back, body rotating) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 10, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    // Left arm far back
    drawLeftArm(g, -1, 7, color, skinColor, id, true);
    drawKnife(g, -1, 13);
    // Right arm forward for balance
    drawArm(g, 26, 12, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, -2, 1);
    g.generateTexture(`${id}_melee_2`, W, H);
    g.destroy();
  }

  // ---- MELEE 3 (slash -- arm extended forward, knife at full reach) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 13, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    // Left arm back
    drawLeftArm(g, 2, 12, color, skinColor, id);
    // Right arm extended with knife
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(24, 11, 7, 6);
    g.fillStyle(color);
    g.fillRect(25, 12, 5, 4);
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(25, 12, 1, 4);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(29, 12, 3, 4);
    drawKnife(g, 29, 13);
    // Motion lines
    g.fillStyle(0xffffff);
    g.fillRect(22, 12, 4, 1);
    g.fillStyle(lighten(0xffffff, 0.3));
    g.fillRect(21, 14, 5, 1);
    g.fillStyle(0xffffff);
    g.fillRect(23, 16, 3, 1);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 2, -1);
    g.generateTexture(`${id}_melee_3`, W, H);
    g.destroy();
  }

  // ---- MELEE 4 (follow-through -- arm sweeping down, body recovering) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 11, color, skinColor, id);
    // Right arm sweeping down
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(24, 15, 7, 6);
    g.fillStyle(color);
    g.fillRect(25, 16, 5, 4);
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(25, 16, 1, 4);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(29, 16, 3, 4);
    drawKnife(g, 29, 18);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_melee_4`, W, H);
    g.destroy();
  }

  // ---- JUMP (initial launch -- arms up, legs tucking) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    // Arms up
    drawLeftArm(g, 1, 7, color, skinColor, id);
    drawArm(g, 26, 7, color, skinColor, id);
    // Legs tucked
    g.fillStyle(darken(pantsColor, 0.4));
    g.fillRect(8, 22, 7, 8);
    g.fillRect(17, 22, 7, 8);
    g.fillStyle(pantsColor);
    g.fillRect(9, 22, 5, 8);
    g.fillRect(18, 22, 5, 8);
    g.fillStyle(darken(pantsColor, 0.15));
    g.fillRect(13, 22, 1, 8);
    g.fillRect(22, 22, 1, 8);
    // Shoes
    g.fillStyle(shoeColor);
    g.fillRect(9, 28, 6, 3);
    g.fillRect(18, 28, 6, 3);
    g.fillStyle(darken(shoeColor, 0.3));
    g.fillRect(9, 30, 6, 1);
    g.fillRect(18, 30, 6, 1);
    g.generateTexture(`${id}_jump`, W, H);
    g.destroy();
  }

  // ---- JUMP 2 (apex -- arms level, legs tucked tight) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 0, 8, color, skinColor, id);
    drawArm(g, 27, 8, color, skinColor, id);
    // Tight tucked legs
    g.fillStyle(darken(pantsColor, 0.4));
    g.fillRect(9, 22, 7, 7);
    g.fillRect(18, 22, 7, 7);
    g.fillStyle(pantsColor);
    g.fillRect(10, 22, 5, 7);
    g.fillRect(19, 22, 5, 7);
    g.fillStyle(darken(pantsColor, 0.15));
    g.fillRect(14, 22, 1, 7);
    g.fillRect(23, 22, 1, 7);
    // Shoes
    g.fillStyle(shoeColor);
    g.fillRect(10, 27, 6, 2);
    g.fillRect(19, 27, 6, 2);
    g.fillStyle(darken(shoeColor, 0.3));
    g.fillRect(10, 28, 6, 1);
    g.fillRect(19, 28, 6, 1);
    g.generateTexture(`${id}_jump_2`, W, H);
    g.destroy();
  }

  // ---- FALL (initial descent -- arms spread wide, legs spread) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    // Arms spread wide
    drawLeftArm(g, 0, 9, color, skinColor, id);
    drawArm(g, 27, 9, color, skinColor, id);
    // Legs spread
    drawLegs(g, 8, 22, pantsColor, shoeColor, -3, 3);
    g.generateTexture(`${id}_fall`, W, H);
    g.destroy();
  }

  // ---- FALL 2 (fast descent -- arms up, body stretched) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 0, skinColor, id);
    drawTorso(g, 8, 10, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 6, color, skinColor, id);
    drawArm(g, 25, 6, color, skinColor, id);
    drawLegs(g, 8, 22, pantsColor, shoeColor, 0, 0);
    g.generateTexture(`${id}_fall_2`, W, H);
    g.destroy();
  }

  // ---- CROUCH ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Everything shifted down so character appears shorter
    drawHead(g, 11, 10, skinColor, id);
    drawTorso(g, 8, 20, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 21, color, skinColor, id);
    drawArm(g, 25, 21, color, skinColor, id);
    // Short bent legs
    g.fillStyle(darken(pantsColor, 0.4));
    g.fillRect(8, 32, 7, 6);
    g.fillRect(17, 32, 7, 6);
    g.fillStyle(pantsColor);
    g.fillRect(9, 32, 5, 5);
    g.fillRect(18, 32, 5, 5);
    g.fillStyle(darken(pantsColor, 0.15));
    g.fillRect(13, 32, 1, 5);
    g.fillRect(22, 32, 1, 5);
    // Knee crease
    g.fillStyle(darken(pantsColor, 0.2));
    g.fillRect(10, 34, 3, 1);
    g.fillRect(19, 34, 3, 1);
    // Shoes
    g.fillStyle(shoeColor);
    g.fillRect(7, 36, 7, 3);
    g.fillRect(17, 36, 7, 3);
    g.fillStyle(darken(shoeColor, 0.35));
    g.fillRect(7, 38, 7, 1);
    g.fillRect(17, 38, 7, 1);
    g.generateTexture(`${id}_crouch`, W, H);
    g.destroy();
  }

  // ---- CROUCH SHOOT ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 11, 10, skinColor, id);
    drawTorso(g, 8, 20, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 2, 21, color, skinColor, id);
    // Gun arm extended
    const armOutline = darken(color, 0.4);
    g.fillStyle(armOutline);
    g.fillRect(24, 21, 7, 6);
    g.fillStyle(color);
    g.fillRect(25, 22, 5, 4);
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(25, 22, 1, 4);
    g.fillStyle(id === "neo" ? darken(0x111111, 0.2) : skinColor);
    g.fillRect(29, 22, 3, 4);
    drawGun(g, 29, 23);
    // Short bent legs
    g.fillStyle(darken(pantsColor, 0.4));
    g.fillRect(8, 32, 7, 6);
    g.fillRect(17, 32, 7, 6);
    g.fillStyle(pantsColor);
    g.fillRect(9, 32, 5, 5);
    g.fillRect(18, 32, 5, 5);
    g.fillStyle(darken(pantsColor, 0.15));
    g.fillRect(13, 32, 1, 5);
    g.fillRect(22, 32, 1, 5);
    g.fillStyle(darken(pantsColor, 0.2));
    g.fillRect(10, 34, 3, 1);
    g.fillRect(19, 34, 3, 1);
    // Shoes
    g.fillStyle(shoeColor);
    g.fillRect(7, 36, 7, 3);
    g.fillRect(17, 36, 7, 3);
    g.fillStyle(darken(shoeColor, 0.35));
    g.fillRect(7, 38, 7, 1);
    g.fillRect(17, 38, 7, 1);
    g.generateTexture(`${id}_crouch_shoot`, W, H);
    g.destroy();
  }

  // ---- HURT (recoil + red tint) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Slight lean back
    drawHead(g, 9, 1, skinColor, id);
    // Red-tinted torso with outline
    const hurtColor = 0xcc3333;
    const hurtOutline = darken(hurtColor, 0.5);
    g.fillStyle(hurtOutline);
    g.fillRect(6, 10, 20, 14);
    g.fillStyle(hurtColor);
    g.fillRect(7, 11, 18, 12);
    // Hurt shading
    g.fillStyle(lighten(hurtColor, 0.25));
    g.fillRect(7, 11, 3, 12);
    g.fillStyle(darken(hurtColor, 0.15));
    g.fillRect(22, 11, 3, 12);
    // Arms flailing
    drawLeftArm(g, 0, 8, color, skinColor, id);
    drawArm(g, 27, 13, color, skinColor, id);
    drawLegs(g, 7, 23, pantsColor, shoeColor, -2, 2);
    g.generateTexture(`${id}_hurt`, W, H);
    g.destroy();
  }

  // ---- DIE 1 (falling back -- leaning, staggering) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    drawHead(g, 9, 2, skinColor, id);
    drawTorso(g, 7, 12, color, secondaryColor, id, skinColor);
    drawLeftArm(g, 1, 10, color, skinColor, id);
    drawArm(g, 24, 14, color, skinColor, id);
    drawLegs(g, 7, 24, pantsColor, shoeColor, -2, 1);
    g.generateTexture(`${id}_die_1`, W, H);
    g.destroy();
  }

  // ---- DIE 2 (on ground -- rotated/flat, drawn horizontally) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Head sideways
    g.fillStyle(darken(skinColor, 0.4));
    g.fillRect(1, 27, 12, 9);
    g.fillStyle(skinColor);
    g.fillRect(2, 28, 10, 7);
    // Head detail
    g.fillStyle(darken(skinColor, 0.15));
    g.fillRect(4, 34, 6, 1);
    if (id === "ghost") {
      g.fillStyle(0x3b82f6);
      g.fillRect(3, 30, 3, 2);
      g.fillRect(7, 30, 3, 2);
      g.fillStyle(0x374151);
      g.fillRect(6, 30, 1, 1);
    } else if (id === "neo") {
      g.fillStyle(0x0a0a0f);
      g.fillRect(3, 30, 4, 2);
      g.fillRect(8, 30, 3, 2);
    } else {
      g.fillStyle(0x0a0a0f);
      g.fillRect(4, 30, 2, 2);
      g.fillRect(8, 30, 2, 2);
    }
    // Torso flat
    g.fillStyle(darken(color, 0.5));
    g.fillRect(11, 25, 14, 11);
    g.fillStyle(color);
    g.fillRect(12, 26, 12, 9);
    g.fillStyle(lighten(color, 0.2));
    g.fillRect(12, 26, 12, 2);
    // Legs flat
    g.fillStyle(pantsColor);
    g.fillRect(24, 27, 6, 8);
    g.fillStyle(darken(pantsColor, 0.15));
    g.fillRect(29, 27, 1, 8);
    // Shoes
    g.fillStyle(shoeColor);
    g.fillRect(24, 35, 6, 3);
    g.fillStyle(darken(shoeColor, 0.3));
    g.fillRect(24, 37, 6, 1);
    g.generateTexture(`${id}_die_2`, W, H);
    g.destroy();
  }

  // ---- DIE 3 (fading -- semi-transparent look via lighter colors) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const fadeColor = lighten(color, 0.5);
    const fadeSkin = lighten(skinColor, 0.4);
    const fadePants = lighten(pantsColor, 0.5);
    const fadeShoe = lighten(shoeColor, 0.5);
    // Head
    g.fillStyle(fadeSkin);
    g.fillRect(2, 28, 10, 7);
    // Torso
    g.fillStyle(fadeColor);
    g.fillRect(12, 26, 12, 9);
    // Legs
    g.fillStyle(fadePants);
    g.fillRect(24, 27, 6, 8);
    // Shoes
    g.fillStyle(fadeShoe);
    g.fillRect(24, 35, 6, 3);
    g.generateTexture(`${id}_die_3`, W, H);
    g.destroy();
  }

  // ---- DIE 4 (stagger spin -- partially rotated) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Head rotated
    g.fillStyle(darken(skinColor, 0.4));
    g.fillRect(4, 23, 10, 8);
    g.fillStyle(skinColor);
    g.fillRect(5, 24, 8, 6);
    // Face detail
    if (id === "ghost") {
      g.fillStyle(0x3b82f6);
      g.fillRect(6, 26, 3, 2);
    } else if (id === "neo") {
      g.fillStyle(0x0a0a0f);
      g.fillRect(6, 26, 4, 2);
    } else {
      g.fillStyle(0x0a0a0f);
      g.fillRect(7, 26, 2, 2);
    }
    // Torso at angle
    g.fillStyle(darken(color, 0.5));
    g.fillRect(12, 20, 12, 12);
    g.fillStyle(color);
    g.fillRect(13, 21, 10, 10);
    g.fillStyle(lighten(color, 0.1));
    g.fillRect(13, 21, 10, 1);
    // Legs trailing
    g.fillStyle(pantsColor);
    g.fillRect(23, 23, 6, 10);
    g.fillStyle(darken(pantsColor, 0.15));
    g.fillRect(28, 23, 1, 10);
    // Shoes
    g.fillStyle(shoeColor);
    g.fillRect(23, 33, 6, 3);
    g.fillStyle(darken(shoeColor, 0.3));
    g.fillRect(23, 35, 6, 1);
    g.generateTexture(`${id}_die_4`, W, H);
    g.destroy();
  }

  // ---- DIE 5 (settled, very faded -- final rest) ----
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const fadeColor2 = lighten(color, 0.65);
    const fadeSkin2 = lighten(skinColor, 0.6);
    const fadePants2 = lighten(pantsColor, 0.65);
    const fadeShoe2 = lighten(shoeColor, 0.65);
    // Head
    g.fillStyle(fadeSkin2);
    g.fillRect(2, 30, 10, 6);
    // Torso
    g.fillStyle(fadeColor2);
    g.fillRect(12, 28, 12, 8);
    // Legs
    g.fillStyle(fadePants2);
    g.fillRect(24, 30, 6, 6);
    // Shoes
    g.fillStyle(fadeShoe2);
    g.fillRect(24, 36, 6, 2);
    g.generateTexture(`${id}_die_5`, W, H);
    g.destroy();
  }
}
