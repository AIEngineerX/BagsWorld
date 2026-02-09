import * as Phaser from "phaser";
import { SCALE, PALETTE, darken, lighten } from "./constants";

function drawLevel1Roof(
  g: Phaser.GameObjects.Graphics,
  style: any,
  bWidth: number,
  bHeight: number,
  canvasHeight: number,
  s: number
): void {
  const awningColor = style.awningColor || PALETTE.brightRed;

  // Awning roof
  g.fillStyle(style.roof);
  g.fillRect(
    0,
    canvasHeight - bHeight - Math.round(6 * s),
    bWidth + Math.round(4 * s),
    Math.round(8 * s)
  );
  g.fillStyle(lighten(style.roof, 0.15));
  g.fillRect(
    0,
    canvasHeight - bHeight - Math.round(6 * s),
    bWidth + Math.round(4 * s),
    Math.round(2 * s)
  );

  // Awning stripes
  g.fillStyle(awningColor);
  for (let i = 0; i < bWidth; i += Math.round(8 * s)) {
    g.fillRect(i, canvasHeight - bHeight - Math.round(5 * s), Math.round(4 * s), Math.round(6 * s));
  }

  // Shop sign
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(
    Math.round(6 * s),
    canvasHeight - bHeight + Math.round(4 * s),
    bWidth - Math.round(12 * s),
    Math.round(8 * s)
  );
  g.fillStyle(style.accent);
  g.fillRect(
    Math.round(8 * s),
    canvasHeight - bHeight + Math.round(5 * s),
    bWidth - Math.round(16 * s),
    Math.round(6 * s)
  );
}

function drawLevel2Roof(
  g: Phaser.GameObjects.Graphics,
  style: any,
  styleIndex: number,
  bWidth: number,
  bHeight: number,
  canvasHeight: number,
  s: number
): void {
  // Flat roof base
  g.fillStyle(style.roof);
  g.fillRect(
    Math.round(2 * s),
    canvasHeight - bHeight - Math.round(4 * s),
    bWidth,
    Math.round(6 * s)
  );
  g.fillStyle(lighten(style.roof, 0.2));
  g.fillRect(
    Math.round(2 * s),
    canvasHeight - bHeight - Math.round(4 * s),
    bWidth,
    Math.round(2 * s)
  );

  // Style-specific roof details
  if (styleIndex === 0) {
    // Tech startup - satellite dish
    g.fillStyle(PALETTE.lightGray);
    g.fillCircle(
      bWidth - Math.round(8 * s),
      canvasHeight - bHeight - Math.round(8 * s),
      Math.round(5 * s)
    );
    g.fillStyle(PALETTE.silver);
    g.fillCircle(
      bWidth - Math.round(8 * s),
      canvasHeight - bHeight - Math.round(8 * s),
      Math.round(3 * s)
    );
  } else if (styleIndex === 1) {
    // Law office - brick chimney
    g.fillStyle(PALETTE.darkRed);
    g.fillRect(
      bWidth - Math.round(10 * s),
      canvasHeight - bHeight - Math.round(12 * s),
      Math.round(6 * s),
      Math.round(10 * s)
    );
    g.fillStyle(lighten(PALETTE.darkRed, 0.15));
    g.fillRect(
      bWidth - Math.round(10 * s),
      canvasHeight - bHeight - Math.round(12 * s),
      Math.round(2 * s),
      Math.round(10 * s)
    );
  } else if (styleIndex === 2) {
    // Coworking - rooftop garden
    g.fillStyle(PALETTE.forest);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight - Math.round(8 * s),
      Math.round(10 * s),
      Math.round(5 * s)
    );
    g.fillStyle(PALETTE.bagsGreen);
    g.fillCircle(Math.round(8 * s), canvasHeight - bHeight - Math.round(10 * s), Math.round(3 * s));
    g.fillCircle(Math.round(14 * s), canvasHeight - bHeight - Math.round(9 * s), Math.round(2 * s));
  } else {
    // Design studio - colorful skylights
    g.fillStyle(PALETTE.cyan);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight - Math.round(6 * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
    g.fillStyle(PALETTE.lavender);
    g.fillRect(
      Math.round(14 * s),
      canvasHeight - bHeight - Math.round(6 * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
    g.fillStyle(PALETTE.amber);
    g.fillRect(
      Math.round(20 * s),
      canvasHeight - bHeight - Math.round(6 * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
  }
}

function drawLevel3Roof(
  g: Phaser.GameObjects.Graphics,
  style: any,
  styleIndex: number,
  bWidth: number,
  bHeight: number,
  canvasHeight: number,
  s: number
): void {
  // Base roof
  g.fillStyle(style.roof);
  g.fillRect(
    Math.round(2 * s),
    canvasHeight - bHeight - Math.round(8 * s),
    bWidth,
    Math.round(10 * s)
  );
  g.fillStyle(lighten(style.roof, 0.15));
  g.fillRect(
    Math.round(2 * s),
    canvasHeight - bHeight - Math.round(8 * s),
    bWidth,
    Math.round(3 * s)
  );

  if (styleIndex === 0) {
    // Corporate HQ - helipad
    g.fillStyle(style.accent);
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      canvasHeight - bHeight - Math.round(14 * s),
      Math.round(16 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(4 * s),
      Math.round(6 * s)
    );
    g.fillStyle(style.roof);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(4 * s),
      Math.round(4 * s)
    );
  } else if (styleIndex === 1) {
    // Bank - columns and dome
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight - Math.round(16 * s),
      bWidth - Math.round(12 * s),
      Math.round(10 * s)
    );
    g.fillStyle(lighten(PALETTE.gold, 0.2));
    g.fillTriangle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(22 * s),
      Math.round(8 * s),
      canvasHeight - bHeight - Math.round(14 * s),
      bWidth - Math.round(4 * s),
      canvasHeight - bHeight - Math.round(14 * s)
    );
  } else if (styleIndex === 2) {
    // Media tower - antenna array
    g.fillStyle(PALETTE.silver);
    g.fillRect(
      bWidth / 2 - Math.round(1 * s),
      canvasHeight - bHeight - Math.round(20 * s),
      Math.round(3 * s),
      Math.round(14 * s)
    );
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      canvasHeight - bHeight - Math.round(14 * s),
      Math.round(2 * s),
      Math.round(8 * s)
    );
    g.fillRect(
      bWidth / 2 + Math.round(5 * s),
      canvasHeight - bHeight - Math.round(14 * s),
      Math.round(2 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.brightRed);
    g.fillCircle(bWidth / 2, canvasHeight - bHeight - Math.round(21 * s), Math.round(2 * s));
  } else {
    // Pharma lab - clean dome
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      Math.round(10 * s)
    );
    g.fillStyle(style.accent);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      Math.round(6 * s)
    );
    g.fillStyle(lighten(PALETTE.white, 0.3));
    g.fillCircle(
      bWidth / 2 - Math.round(2 * s),
      canvasHeight - bHeight - Math.round(12 * s),
      Math.round(3 * s)
    );
  }
}

function drawLevel4Roof(
  g: Phaser.GameObjects.Graphics,
  style: any,
  styleIndex: number,
  bWidth: number,
  bHeight: number,
  canvasHeight: number,
  s: number
): void {
  if (styleIndex === 0) {
    // Modern tower - stepped
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth - Math.round(8 * s),
      Math.round(12 * s)
    );
    g.fillRect(
      Math.round(10 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      bWidth - Math.round(16 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      Math.round(14 * s),
      canvasHeight - bHeight - Math.round(24 * s),
      bWidth - Math.round(24 * s),
      Math.round(8 * s)
    );
    g.fillStyle(lighten(style.roof, 0.2));
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth - Math.round(8 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      Math.round(10 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      bWidth - Math.round(16 * s),
      Math.round(2 * s)
    );
    // Antenna
    g.fillStyle(PALETTE.silver);
    g.fillRect(
      bWidth / 2,
      canvasHeight - bHeight - Math.round(32 * s),
      Math.round(2 * s),
      Math.round(12 * s)
    );
    g.fillStyle(PALETTE.brightRed);
    g.fillCircle(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight - Math.round(34 * s),
      Math.round(2 * s)
    );
  } else if (styleIndex === 1) {
    // Art deco - ornate crown
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - bHeight - Math.round(12 * s),
      bWidth - Math.round(4 * s),
      Math.round(14 * s)
    );
    g.fillStyle(style.accent);
    // Deco spires
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight - Math.round(22 * s),
      Math.round(4 * s),
      Math.round(12 * s)
    );
    g.fillRect(
      bWidth / 2 - Math.round(2 * s),
      canvasHeight - bHeight - Math.round(28 * s),
      Math.round(6 * s),
      Math.round(18 * s)
    );
    g.fillRect(
      bWidth - Math.round(8 * s),
      canvasHeight - bHeight - Math.round(22 * s),
      Math.round(4 * s),
      Math.round(12 * s)
    );
    g.fillStyle(lighten(style.accent, 0.3));
    g.fillCircle(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight - Math.round(30 * s),
      Math.round(4 * s)
    );
  } else if (styleIndex === 2) {
    // Glass spire - pointed
    g.fillStyle(style.roof);
    g.fillTriangle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(35 * s),
      Math.round(8 * s),
      canvasHeight - bHeight,
      bWidth - Math.round(4 * s),
      canvasHeight - bHeight
    );
    g.fillStyle(lighten(style.roof, 0.3));
    g.fillTriangle(
      bWidth / 2,
      canvasHeight - bHeight - Math.round(30 * s),
      Math.round(10 * s),
      canvasHeight - bHeight - Math.round(5 * s),
      bWidth / 2,
      canvasHeight - bHeight - Math.round(5 * s)
    );
    g.fillStyle(style.accent);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(36 * s),
      Math.round(3 * s)
    );
  } else {
    // Tech campus - green roof
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth - Math.round(4 * s),
      Math.round(12 * s)
    );
    // Solar panels
    g.fillStyle(PALETTE.navy);
    for (let i = 0; i < 3; i++) {
      g.fillRect(
        Math.round((8 + i * 10) * s),
        canvasHeight - bHeight - Math.round(16 * s),
        Math.round(8 * s),
        Math.round(6 * s)
      );
      g.fillStyle(lighten(PALETTE.navy, 0.2));
      g.fillRect(
        Math.round((8 + i * 10) * s),
        canvasHeight - bHeight - Math.round(16 * s),
        Math.round(8 * s),
        Math.round(1 * s)
      );
      g.fillStyle(PALETTE.navy);
    }
    // Green area
    g.fillStyle(PALETTE.forest);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight - Math.round(8 * s),
      Math.round(6 * s),
      Math.round(4 * s)
    );
  }
}

function drawLevel5Roof(
  g: Phaser.GameObjects.Graphics,
  style: any,
  styleIndex: number,
  bWidth: number,
  bHeight: number,
  canvasHeight: number,
  s: number
): void {
  if (styleIndex === 0) {
    // Bags HQ - grand spire
    g.fillStyle(style.roof);
    g.fillTriangle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(30 * s),
      Math.round(8 * s),
      canvasHeight - bHeight,
      bWidth - Math.round(4 * s),
      canvasHeight - bHeight
    );
    g.fillStyle(lighten(style.roof, 0.25));
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight - Math.round(5 * s),
      Math.round(10 * s),
      Math.round(5 * s)
    );
    g.fillStyle(style.accent);
    g.fillRect(
      bWidth / 2 - Math.round(1 * s),
      canvasHeight - bHeight - Math.round(45 * s),
      Math.round(6 * s),
      Math.round(20 * s)
    );
    g.fillStyle(PALETTE.gold);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(48 * s),
      Math.round(4 * s)
    );
    g.fillStyle(lighten(PALETTE.gold, 0.3));
    g.fillCircle(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight - Math.round(49 * s),
      Math.round(2 * s)
    );
    g.fillStyle(PALETTE.brightRed);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(50 * s),
      Math.round(2 * s)
    );
    // Side spires
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight - Math.round(15 * s),
      Math.round(4 * s),
      Math.round(18 * s)
    );
    g.fillRect(
      bWidth - Math.round(8 * s),
      canvasHeight - bHeight - Math.round(15 * s),
      Math.round(4 * s),
      Math.round(18 * s)
    );
  } else if (styleIndex === 1) {
    // Diamond tower - crystal top
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight - Math.round(15 * s),
      bWidth - Math.round(8 * s),
      Math.round(17 * s)
    );
    // Crystal spire
    g.fillStyle(style.accent);
    g.fillTriangle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(45 * s),
      Math.round(12 * s),
      canvasHeight - bHeight - Math.round(15 * s),
      bWidth - Math.round(8 * s),
      canvasHeight - bHeight - Math.round(15 * s)
    );
    g.fillStyle(lighten(style.accent, 0.4));
    g.fillTriangle(
      bWidth / 2,
      canvasHeight - bHeight - Math.round(40 * s),
      Math.round(14 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      bWidth / 2,
      canvasHeight - bHeight - Math.round(18 * s)
    );
    // Diamond gem
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(47 * s),
      Math.round(5 * s)
    );
    g.fillStyle(style.accent);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(47 * s),
      Math.round(3 * s)
    );
  } else if (styleIndex === 2) {
    // Gold citadel - crown
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - bHeight - Math.round(12 * s),
      bWidth - Math.round(4 * s),
      Math.round(14 * s)
    );
    // Crown spires
    g.fillStyle(style.accent);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight - Math.round(30 * s),
      Math.round(4 * s),
      Math.round(20 * s)
    );
    g.fillRect(
      bWidth / 2 - Math.round(2 * s),
      canvasHeight - bHeight - Math.round(40 * s),
      Math.round(6 * s),
      Math.round(30 * s)
    );
    g.fillRect(
      bWidth - Math.round(10 * s),
      canvasHeight - bHeight - Math.round(30 * s),
      Math.round(4 * s),
      Math.round(20 * s)
    );
    // Gold orbs
    g.fillStyle(PALETTE.gold);
    g.fillCircle(
      Math.round(10 * s),
      canvasHeight - bHeight - Math.round(32 * s),
      Math.round(3 * s)
    );
    g.fillCircle(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight - Math.round(43 * s),
      Math.round(4 * s)
    );
    g.fillCircle(
      bWidth - Math.round(8 * s),
      canvasHeight - bHeight - Math.round(32 * s),
      Math.round(3 * s)
    );
  } else {
    // Neon megacorp - holographic
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth - Math.round(8 * s),
      Math.round(12 * s)
    );
    g.fillRect(
      Math.round(10 * s),
      canvasHeight - bHeight - Math.round(20 * s),
      bWidth - Math.round(16 * s),
      Math.round(12 * s)
    );
    // Neon spire
    g.fillStyle(style.accent);
    g.fillRect(
      bWidth / 2 - Math.round(3 * s),
      canvasHeight - bHeight - Math.round(45 * s),
      Math.round(8 * s),
      Math.round(28 * s)
    );
    // Holographic ring
    g.fillStyle(PALETTE.cyan, 0.6);
    g.strokeCircle(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight - Math.round(35 * s),
      Math.round(10 * s)
    );
    g.fillStyle(PALETTE.lavender, 0.4);
    g.strokeCircle(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight - Math.round(35 * s),
      Math.round(7 * s)
    );
    // Beacon
    g.fillStyle(PALETTE.cyan);
    g.fillCircle(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight - Math.round(47 * s),
      Math.round(4 * s)
    );
    g.fillStyle(PALETTE.white);
    g.fillCircle(bWidth / 2, canvasHeight - bHeight - Math.round(48 * s), Math.round(2 * s));
  }
}

function drawWindows(
  g: Phaser.GameObjects.Graphics,
  style: any,
  level: number,
  bWidth: number,
  bHeight: number,
  canvasHeight: number,
  s: number
): void {
  const windowRows = level === 1 ? 2 : level === 2 ? 3 : level === 3 ? 4 : level === 4 ? 6 : 8;
  const windowCols = level >= 4 ? 4 : level >= 2 ? 3 : 2;
  const windowWidth = Math.round((level >= 4 ? 5 : 6) * s);
  const windowHeight = Math.round((level >= 4 ? 6 : 5) * s);
  const startY = canvasHeight - bHeight + Math.round((level === 1 ? 18 : 12) * s);
  const windowSpacingY = Math.round((level >= 4 ? 11 : 12) * s);
  const windowGap = Math.round(4 * s);

  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      const totalWindowWidth = windowCols * windowWidth + (windowCols - 1) * windowGap;
      const startX = (bWidth - totalWindowWidth) / 2 + Math.round(2 * s);
      const wx = startX + col * (windowWidth + windowGap);
      const wy = startY + row * windowSpacingY;

      if (level <= 2 && row === windowRows - 1 && col === Math.floor(windowCols / 2)) continue;

      g.fillStyle(style.accent, 0.25);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        windowWidth + Math.round(2 * s),
        windowHeight + Math.round(2 * s)
      );
      g.fillStyle(style.accent);
      g.fillRect(wx, wy, windowWidth, windowHeight);
      g.fillStyle(lighten(style.accent, 0.35));
      g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));

      if (level >= 3) {
        g.fillStyle(darken(style.base, 0.2));
        g.fillRect(wx + windowWidth / 2 - Math.round(1 * s), wy, Math.round(1 * s), windowHeight);
        g.fillRect(wx, wy + windowHeight / 2, windowWidth, Math.round(1 * s));
      }
    }
  }
}

function drawDoor(
  g: Phaser.GameObjects.Graphics,
  style: any,
  level: number,
  bWidth: number,
  canvasHeight: number,
  s: number
): void {
  const doorWidth = Math.round((level === 1 ? 12 : level >= 4 ? 14 : 10) * s);
  const doorHeight = Math.round((level >= 4 ? 16 : 12) * s);
  const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

  if (level === 5) {
    g.fillStyle(PALETTE.gray);
    g.fillRect(
      doorX - Math.round(6 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      Math.round(4 * s),
      doorHeight + Math.round(4 * s)
    );
    g.fillRect(
      doorX + doorWidth + Math.round(2 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      Math.round(4 * s),
      doorHeight + Math.round(4 * s)
    );
    g.fillStyle(lighten(PALETTE.gray, 0.2));
    g.fillRect(
      doorX - Math.round(6 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      Math.round(1 * s),
      doorHeight + Math.round(4 * s)
    );
    g.fillStyle(style.accent);
    g.fillRect(
      doorX - Math.round(8 * s),
      canvasHeight - doorHeight - Math.round(8 * s),
      doorWidth + Math.round(16 * s),
      Math.round(6 * s)
    );
    g.fillStyle(lighten(style.accent, 0.2));
    g.fillRect(
      doorX - Math.round(8 * s),
      canvasHeight - doorHeight - Math.round(8 * s),
      doorWidth + Math.round(16 * s),
      Math.round(2 * s)
    );
  }

  g.fillStyle(PALETTE.darkGray);
  g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

  const doorColor = level >= 3 ? PALETTE.gray : PALETTE.brown;
  g.fillStyle(doorColor);
  g.fillRect(
    doorX + Math.round(1 * s),
    canvasHeight - doorHeight + Math.round(1 * s),
    doorWidth - Math.round(2 * s),
    doorHeight - Math.round(1 * s)
  );
  g.fillStyle(lighten(doorColor, 0.15));
  g.fillRect(
    doorX + Math.round(1 * s),
    canvasHeight - doorHeight + Math.round(1 * s),
    Math.round(2 * s),
    doorHeight - Math.round(1 * s)
  );
  g.fillStyle(style.accent);
  g.fillRect(
    doorX + doorWidth - Math.round(4 * s),
    canvasHeight - doorHeight / 2 - Math.round(1 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );

  if (level >= 3) {
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      doorX - Math.round(6 * s),
      canvasHeight - doorHeight - Math.round(12 * s),
      doorWidth + Math.round(12 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.accent);
    g.fillRect(
      doorX - Math.round(4 * s),
      canvasHeight - doorHeight - Math.round(11 * s),
      doorWidth + Math.round(8 * s),
      Math.round(6 * s)
    );
    g.fillStyle(lighten(style.accent, 0.25));
    g.fillRect(
      doorX - Math.round(4 * s),
      canvasHeight - doorHeight - Math.round(11 * s),
      doorWidth + Math.round(8 * s),
      Math.round(2 * s)
    );
  }
}

export function generateBuildings(scene: Phaser.Scene): void {
  // Building style packs - 4 unique styles per level for visual diversity
  // Each token gets a deterministic style based on its mint address
  const s = SCALE;

  // Level 1: Small Shops (<$100K market cap)
  const level1Styles = [
    {
      name: "corner_store",
      base: PALETTE.violet,
      roof: PALETTE.gold,
      accent: PALETTE.gold,
      awningColor: PALETTE.brightRed,
    },
    {
      name: "taco_stand",
      base: PALETTE.cream,
      roof: PALETTE.orange,
      accent: PALETTE.orange,
      awningColor: PALETTE.brightRed,
    },
    {
      name: "coffee_shop",
      base: PALETTE.brown,
      roof: PALETTE.cream,
      accent: PALETTE.amber,
      awningColor: PALETTE.darkBrown,
    },
    {
      name: "arcade",
      base: PALETTE.night,
      roof: PALETTE.lavender,
      accent: PALETTE.cyan,
      awningColor: PALETTE.solanaPurple,
    },
  ];

  // Level 2: Office Buildings ($100K-$500K)
  const level2Styles = [
    { name: "tech_startup", base: PALETTE.sky, roof: PALETTE.navy, accent: PALETTE.lightBlue },
    { name: "law_office", base: PALETTE.gray, roof: PALETTE.darkGray, accent: PALETTE.silver },
    { name: "coworking", base: PALETTE.cream, roof: PALETTE.orange, accent: PALETTE.amber },
    {
      name: "design_studio",
      base: PALETTE.lavender,
      roof: PALETTE.deepPurple,
      accent: PALETTE.violet,
    },
  ];

  // Level 3: Corporate Buildings ($500K-$2M)
  const level3Styles = [
    {
      name: "corporate_hq",
      base: PALETTE.gray,
      roof: PALETTE.bagsGreen,
      accent: PALETTE.bagsGreen,
    },
    { name: "bank", base: PALETTE.cream, roof: PALETTE.gold, accent: PALETTE.amber },
    { name: "media_tower", base: PALETTE.sky, roof: PALETTE.navy, accent: PALETTE.cyan },
    { name: "pharma_lab", base: PALETTE.white, roof: PALETTE.cyan, accent: PALETTE.lightBlue },
  ];

  // Level 4: Towers ($2M-$10M)
  const level4Styles = [
    { name: "modern_tower", base: PALETTE.navy, roof: PALETTE.lightBlue, accent: PALETTE.gold },
    { name: "art_deco", base: PALETTE.night, roof: PALETTE.gold, accent: PALETTE.amber },
    { name: "glass_spire", base: PALETTE.sky, roof: PALETTE.cyan, accent: PALETTE.white },
    {
      name: "tech_campus",
      base: PALETTE.darkGreen,
      roof: PALETTE.bagsGreen,
      accent: PALETTE.mint,
    },
  ];

  // Level 5: Skyscrapers ($10M+)
  const level5Styles = [
    { name: "bags_hq", base: PALETTE.night, roof: PALETTE.bagsGreen, accent: PALETTE.bagsGreen },
    { name: "diamond_tower", base: PALETTE.navy, roof: PALETTE.cyan, accent: PALETTE.lightBlue },
    { name: "gold_citadel", base: PALETTE.night, roof: PALETTE.gold, accent: PALETTE.amber },
    {
      name: "neon_megacorp",
      base: PALETTE.deepPurple,
      roof: PALETTE.solanaPurple,
      accent: PALETTE.lavender,
    },
  ];

  const allLevelStyles = [level1Styles, level2Styles, level3Styles, level4Styles, level5Styles];
  const levelDimensions = [
    { height: Math.round(40 * s), width: Math.round(30 * s) }, // Level 1
    { height: Math.round(55 * s), width: Math.round(34 * s) }, // Level 2
    { height: Math.round(75 * s), width: Math.round(38 * s) }, // Level 3
    { height: Math.round(100 * s), width: Math.round(42 * s) }, // Level 4
    { height: Math.round(130 * s), width: Math.round(48 * s) }, // Level 5
  ];

  for (let level = 1; level <= 5; level++) {
    const styles = allLevelStyles[level - 1];
    const dims = levelDimensions[level - 1];

    for (let styleIndex = 0; styleIndex < styles.length; styleIndex++) {
      const style = styles[styleIndex];
      const g = scene.make.graphics({ x: 0, y: 0 });
      const bHeight = dims.height;
      const bWidth = dims.width;
      const canvasHeight = Math.round(190 * s);
      const canvasWidth = Math.round(55 * s);

      // Drop shadow
      g.fillStyle(PALETTE.void, 0.5);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight + Math.round(6 * s),
        bWidth - Math.round(2 * s),
        bHeight
      );

      // Building base
      g.fillStyle(style.base);
      g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

      // Highlight left edge
      g.fillStyle(lighten(style.base, 0.2));
      g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

      // Shadow right edge
      g.fillStyle(darken(style.base, 0.25));
      g.fillRect(bWidth - Math.round(6 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

      // Dithering pattern for texture
      g.fillStyle(darken(style.base, 0.08));
      for (let py = 0; py < bHeight; py += Math.round(4 * s)) {
        for (
          let px = Math.round(10 * s);
          px < bWidth - Math.round(10 * s);
          px += Math.round(8 * s)
        ) {
          if ((py / Math.round(4 * s) + px / Math.round(8 * s)) % 2 === 0) {
            g.fillRect(
              Math.round(4 * s) + px,
              canvasHeight - bHeight + py,
              Math.round(2 * s),
              Math.round(2 * s)
            );
          }
        }
      }

      // Level-specific decorations
      if (level === 1) {
        drawLevel1Roof(g, style, bWidth, bHeight, canvasHeight, s);
      } else if (level === 2) {
        drawLevel2Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
      } else if (level === 3) {
        drawLevel3Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
      } else if (level === 4) {
        drawLevel4Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
      } else if (level === 5) {
        drawLevel5Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
      }

      // Windows
      drawWindows(g, style, level, bWidth, bHeight, canvasHeight, s);

      // Door
      drawDoor(g, style, level, bWidth, canvasHeight, s);

      g.generateTexture(`building_${level}_${styleIndex}`, canvasWidth, canvasHeight);
      g.destroy();
    }
  }
}
