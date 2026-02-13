import * as Phaser from "phaser";
import { SCALE, PALETTE, darken, lighten } from "./constants";
import { generateArcadeBuilding } from "./arcade-building";

function generatePokeCenter(scene: Phaser.Scene): void {
  // PokeCenter - Pokemon Center style building (red roof, white base)
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasHeight = Math.round(140 * s);
  const canvasWidth = Math.round(55 * s);
  const bHeight = Math.round(85 * s);
  const bWidth = Math.round(50 * s);

  // Shadow
  g.fillStyle(PALETTE.void, 0.5);
  g.fillRect(
    Math.round(6 * s),
    canvasHeight - bHeight + Math.round(6 * s),
    bWidth - Math.round(2 * s),
    bHeight
  );

  // Building base (white/cream)
  g.fillStyle(PALETTE.cream);
  g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

  // Highlight left side
  g.fillStyle(lighten(PALETTE.cream, 0.15));
  g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

  // Shadow right side
  g.fillStyle(darken(PALETTE.cream, 0.1));
  g.fillRect(bWidth - Math.round(6 * s), canvasHeight - bHeight, Math.round(4 * s), bHeight);

  // Red roof - iconic PokeCenter style with shading
  g.fillStyle(PALETTE.red);
  g.fillRect(
    0,
    canvasHeight - bHeight - Math.round(8 * s),
    bWidth + Math.round(4 * s),
    Math.round(12 * s)
  );
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(
    Math.round(2 * s),
    canvasHeight - bHeight - Math.round(6 * s),
    bWidth,
    Math.round(8 * s)
  );
  // Roof highlight
  g.fillStyle(lighten(PALETTE.brightRed, 0.2));
  g.fillRect(
    Math.round(2 * s),
    canvasHeight - bHeight - Math.round(6 * s),
    bWidth,
    Math.round(2 * s)
  );

  // Roof peak/overhang with shading
  g.fillStyle(PALETTE.darkRed);
  g.fillRect(
    bWidth / 2 - Math.round(8 * s),
    canvasHeight - bHeight - Math.round(16 * s),
    Math.round(20 * s),
    Math.round(10 * s)
  );
  g.fillStyle(PALETTE.red);
  g.fillRect(
    bWidth / 2 - Math.round(6 * s),
    canvasHeight - bHeight - Math.round(14 * s),
    Math.round(16 * s),
    Math.round(6 * s)
  );
  // Peak highlight
  g.fillStyle(lighten(PALETTE.red, 0.15));
  g.fillRect(
    bWidth / 2 - Math.round(6 * s),
    canvasHeight - bHeight - Math.round(14 * s),
    Math.round(16 * s),
    Math.round(2 * s)
  );

  // Pokeball logo on roof peak
  g.fillStyle(PALETTE.white);
  g.fillCircle(
    bWidth / 2 + Math.round(2 * s),
    canvasHeight - bHeight - Math.round(10 * s),
    Math.round(6 * s)
  );
  g.fillStyle(PALETTE.red);
  g.fillRect(
    bWidth / 2 - Math.round(4 * s),
    canvasHeight - bHeight - Math.round(16 * s),
    Math.round(12 * s),
    Math.round(6 * s)
  );
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(
    bWidth / 2 - Math.round(4 * s),
    canvasHeight - bHeight - Math.round(11 * s),
    Math.round(12 * s),
    Math.round(2 * s)
  );
  g.fillStyle(PALETTE.white);
  g.fillCircle(
    bWidth / 2 + Math.round(2 * s),
    canvasHeight - bHeight - Math.round(10 * s),
    Math.round(3 * s)
  );
  g.fillStyle(PALETTE.darkGray);
  g.fillCircle(
    bWidth / 2 + Math.round(2 * s),
    canvasHeight - bHeight - Math.round(10 * s),
    Math.round(1.5 * s)
  );

  // Windows (2 rows, 3 columns)
  const windowColor = PALETTE.lightBlue;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = Math.round(10 * s) + col * Math.round(12 * s);
      const wy = canvasHeight - bHeight + Math.round(15 * s) + row * Math.round(18 * s);

      // Window glow
      g.fillStyle(windowColor, 0.25);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        Math.round(9 * s),
        Math.round(11 * s)
      );

      // Window
      g.fillStyle(windowColor);
      g.fillRect(wx, wy, Math.round(8 * s), Math.round(10 * s));

      // Window highlight
      g.fillStyle(lighten(windowColor, 0.3));
      g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));

      // Window frame
      g.fillStyle(PALETTE.cream);
      g.fillRect(wx + Math.round(3 * s), wy, Math.round(2 * s), Math.round(10 * s));
      g.fillRect(wx, wy + Math.round(4 * s), Math.round(8 * s), Math.round(2 * s));
    }
  }

  // Red cross/plus sign (healing center)
  g.fillStyle(PALETTE.red);
  g.fillRect(
    bWidth / 2 - Math.round(1 * s),
    canvasHeight - bHeight + Math.round(8 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    bWidth / 2 + Math.round(1 * s),
    canvasHeight - bHeight + Math.round(6 * s),
    Math.round(2 * s),
    Math.round(6 * s)
  );

  // Door - automatic sliding doors
  const doorWidth = Math.round(16 * s);
  const doorHeight = Math.round(20 * s);
  const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

  // Door frame with shading
  g.fillStyle(PALETTE.red);
  g.fillRect(
    doorX - Math.round(2 * s),
    canvasHeight - doorHeight - Math.round(4 * s),
    doorWidth + Math.round(4 * s),
    doorHeight + Math.round(4 * s)
  );
  g.fillStyle(lighten(PALETTE.red, 0.15));
  g.fillRect(
    doorX - Math.round(2 * s),
    canvasHeight - doorHeight - Math.round(4 * s),
    Math.round(2 * s),
    doorHeight + Math.round(4 * s)
  );

  // Glass doors
  g.fillStyle(PALETTE.lightBlue);
  g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);
  // Glass reflection
  g.fillStyle(lighten(PALETTE.lightBlue, 0.3));
  g.fillRect(
    doorX + Math.round(2 * s),
    canvasHeight - doorHeight + Math.round(2 * s),
    Math.round(4 * s),
    Math.round(6 * s)
  );

  // Door divider
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(
    doorX + doorWidth / 2 - Math.round(1 * s),
    canvasHeight - doorHeight,
    Math.round(2 * s),
    doorHeight
  );

  // Welcome mat
  g.fillStyle(PALETTE.red);
  g.fillRect(
    doorX - Math.round(4 * s),
    canvasHeight - Math.round(2 * s),
    doorWidth + Math.round(8 * s),
    Math.round(2 * s)
  );

  // "P" sign above door
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(
    doorX + Math.round(2 * s),
    canvasHeight - doorHeight - Math.round(10 * s),
    doorWidth - Math.round(4 * s),
    Math.round(8 * s)
  );
  g.fillStyle(PALETTE.white);
  g.fillRect(
    doorX + Math.round(5 * s),
    canvasHeight - doorHeight - Math.round(9 * s),
    Math.round(2 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    doorX + Math.round(5 * s),
    canvasHeight - doorHeight - Math.round(9 * s),
    Math.round(5 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    doorX + Math.round(8 * s),
    canvasHeight - doorHeight - Math.round(9 * s),
    Math.round(2 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    doorX + Math.round(5 * s),
    canvasHeight - doorHeight - Math.round(6 * s),
    Math.round(5 * s),
    Math.round(2 * s)
  );

  // Side decorations - pokeball symbols
  g.fillStyle(PALETTE.red);
  g.fillCircle(Math.round(10 * s), canvasHeight - Math.round(25 * s), Math.round(4 * s));
  g.fillCircle(bWidth - Math.round(6 * s), canvasHeight - Math.round(25 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(
    Math.round(6 * s),
    canvasHeight - Math.round(26 * s),
    Math.round(8 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    bWidth - Math.round(10 * s),
    canvasHeight - Math.round(26 * s),
    Math.round(8 * s),
    Math.round(2 * s)
  );

  g.generateTexture("pokecenter", canvasWidth, canvasHeight);
  g.destroy();
}

function generateTradingGym(scene: Phaser.Scene): void {
  // Trading Dojo - Japanese dojo style building (traditional wooden structure)
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasHeight = Math.round(160 * s);
  const canvasWidth = Math.round(80 * s);
  const bHeight = Math.round(90 * s);
  const bWidth = Math.round(70 * s);
  const baseX = Math.round(5 * s);

  // Shadow
  g.fillStyle(PALETTE.void, 0.5);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasHeight - bHeight + Math.round(6 * s),
    bWidth - Math.round(4 * s),
    bHeight
  );

  // Wooden platform/foundation (raised floor - engawa style)
  const platformHeight = Math.round(8 * s);
  g.fillStyle(0x8b4513); // Saddle brown
  g.fillRect(
    baseX - Math.round(4 * s),
    canvasHeight - platformHeight,
    bWidth + Math.round(8 * s),
    platformHeight
  );
  g.fillStyle(0xa0522d); // Sienna (lighter)
  g.fillRect(
    baseX - Math.round(4 * s),
    canvasHeight - platformHeight,
    bWidth + Math.round(8 * s),
    Math.round(2 * s)
  );

  // Building base (wooden walls - warm brown)
  const woodColor = 0x8b5a2b;
  g.fillStyle(woodColor);
  g.fillRect(baseX, canvasHeight - bHeight, bWidth, bHeight - platformHeight);

  // Wood grain texture - vertical planks
  g.fillStyle(darken(woodColor, 0.15));
  for (let i = 0; i < 6; i++) {
    const plankX = baseX + Math.round(2 * s) + i * Math.round(11 * s);
    g.fillRect(plankX, canvasHeight - bHeight, Math.round(1 * s), bHeight - platformHeight);
  }

  // Left side highlight
  g.fillStyle(lighten(woodColor, 0.2));
  g.fillRect(baseX, canvasHeight - bHeight, Math.round(4 * s), bHeight - platformHeight);

  // Right side shadow
  g.fillStyle(darken(woodColor, 0.25));
  g.fillRect(
    baseX + bWidth - Math.round(6 * s),
    canvasHeight - bHeight,
    Math.round(6 * s),
    bHeight - platformHeight
  );

  // Traditional curved roof (dark blue/black tiles)
  const roofColor = 0x1a1a2e;
  const roofOverhang = Math.round(10 * s);
  const roofHeight = Math.round(20 * s);

  // Main roof body
  g.fillStyle(roofColor);
  g.fillRect(
    baseX - roofOverhang,
    canvasHeight - bHeight - roofHeight + Math.round(4 * s),
    bWidth + roofOverhang * 2,
    roofHeight
  );

  // Curved roof edges (simplified pixel art curves)
  g.fillStyle(roofColor);
  // Left curve up
  g.fillRect(
    baseX - roofOverhang - Math.round(2 * s),
    canvasHeight - bHeight - roofHeight + Math.round(8 * s),
    Math.round(4 * s),
    Math.round(8 * s)
  );
  // Right curve up
  g.fillRect(
    baseX + bWidth + roofOverhang - Math.round(2 * s),
    canvasHeight - bHeight - roofHeight + Math.round(8 * s),
    Math.round(4 * s),
    Math.round(8 * s)
  );

  // Roof ridge (top peak)
  g.fillStyle(0x2d2d44);
  g.fillRect(
    baseX - roofOverhang + Math.round(4 * s),
    canvasHeight - bHeight - roofHeight,
    bWidth + roofOverhang * 2 - Math.round(8 * s),
    Math.round(6 * s)
  );

  // Red accent trim under roof
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(
    baseX - roofOverhang + Math.round(2 * s),
    canvasHeight - bHeight + Math.round(2 * s),
    bWidth + roofOverhang * 2 - Math.round(4 * s),
    Math.round(3 * s)
  );

  // Shoji screens (paper doors/windows) - two on each side
  const shojiColor = 0xfff8dc; // Cream white
  const shojiFrameColor = 0x4a3728;
  const screenWidth = Math.round(12 * s);
  const screenHeight = Math.round(28 * s);
  const screenY = canvasHeight - bHeight + Math.round(20 * s);

  // Left shoji screen
  g.fillStyle(shojiFrameColor);
  g.fillRect(
    baseX + Math.round(6 * s),
    screenY,
    screenWidth + Math.round(2 * s),
    screenHeight + Math.round(2 * s)
  );
  g.fillStyle(shojiColor);
  g.fillRect(baseX + Math.round(7 * s), screenY + Math.round(1 * s), screenWidth, screenHeight);
  // Grid pattern
  g.fillStyle(shojiFrameColor);
  g.fillRect(
    baseX + Math.round(7 * s) + screenWidth / 2,
    screenY + Math.round(1 * s),
    Math.round(1 * s),
    screenHeight
  );
  g.fillRect(baseX + Math.round(7 * s), screenY + screenHeight / 2, screenWidth, Math.round(1 * s));

  // Right shoji screen
  g.fillStyle(shojiFrameColor);
  g.fillRect(
    baseX + bWidth - Math.round(20 * s),
    screenY,
    screenWidth + Math.round(2 * s),
    screenHeight + Math.round(2 * s)
  );
  g.fillStyle(shojiColor);
  g.fillRect(
    baseX + bWidth - Math.round(19 * s),
    screenY + Math.round(1 * s),
    screenWidth,
    screenHeight
  );
  // Grid pattern
  g.fillStyle(shojiFrameColor);
  g.fillRect(
    baseX + bWidth - Math.round(19 * s) + screenWidth / 2,
    screenY + Math.round(1 * s),
    Math.round(1 * s),
    screenHeight
  );
  g.fillRect(
    baseX + bWidth - Math.round(19 * s),
    screenY + screenHeight / 2,
    screenWidth,
    Math.round(1 * s)
  );

  // Center entrance - sliding doors
  const doorWidth = Math.round(20 * s);
  const doorHeight = Math.round(32 * s);
  const doorX = baseX + (bWidth - doorWidth) / 2;
  const doorY = canvasHeight - platformHeight - doorHeight;

  // Door frame
  g.fillStyle(shojiFrameColor);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(2 * s),
    doorWidth + Math.round(4 * s),
    doorHeight + Math.round(2 * s)
  );

  // Door panels (slightly open - showing darkness inside)
  g.fillStyle(0x1a1a1a);
  g.fillRect(doorX, doorY, doorWidth, doorHeight);

  // Left door panel (shoji)
  g.fillStyle(shojiColor);
  g.fillRect(doorX, doorY, doorWidth / 2 - Math.round(2 * s), doorHeight);
  g.fillStyle(shojiFrameColor);
  g.fillRect(doorX + doorWidth / 4, doorY, Math.round(1 * s), doorHeight);
  g.fillRect(doorX, doorY + doorHeight / 3, doorWidth / 2 - Math.round(2 * s), Math.round(1 * s));
  g.fillRect(
    doorX,
    doorY + (doorHeight * 2) / 3,
    doorWidth / 2 - Math.round(2 * s),
    Math.round(1 * s)
  );

  // Right door panel (shoji)
  g.fillStyle(shojiColor);
  g.fillRect(
    doorX + doorWidth / 2 + Math.round(2 * s),
    doorY,
    doorWidth / 2 - Math.round(2 * s),
    doorHeight
  );
  g.fillStyle(shojiFrameColor);
  g.fillRect(doorX + (doorWidth * 3) / 4, doorY, Math.round(1 * s), doorHeight);
  g.fillRect(
    doorX + doorWidth / 2 + Math.round(2 * s),
    doorY + doorHeight / 3,
    doorWidth / 2 - Math.round(2 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    doorX + doorWidth / 2 + Math.round(2 * s),
    doorY + (doorHeight * 2) / 3,
    doorWidth / 2 - Math.round(2 * s),
    Math.round(1 * s)
  );

  // Noren (fabric curtain above door) - orange/amber dojo colors
  g.fillStyle(PALETTE.orange);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(10 * s),
    doorWidth + Math.round(8 * s),
    Math.round(10 * s)
  );
  // Noren slits
  g.fillStyle(darken(PALETTE.orange, 0.3));
  g.fillRect(doorX, doorY - Math.round(8 * s), Math.round(1 * s), Math.round(6 * s));
  g.fillRect(
    doorX + doorWidth / 3,
    doorY - Math.round(8 * s),
    Math.round(1 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    doorX + (doorWidth * 2) / 3,
    doorY - Math.round(8 * s),
    Math.round(1 * s),
    Math.round(6 * s)
  );
  g.fillRect(doorX + doorWidth, doorY - Math.round(8 * s), Math.round(1 * s), Math.round(6 * s));

  // Dojo symbol on noren (circle - representing unity/perfection)
  g.fillStyle(PALETTE.gold);
  g.fillCircle(doorX + doorWidth / 2, doorY - Math.round(5 * s), Math.round(3 * s));
  g.fillStyle(PALETTE.orange);
  g.fillCircle(doorX + doorWidth / 2, doorY - Math.round(5 * s), Math.round(1.5 * s));

  // Stone lanterns on either side
  const lanternY = canvasHeight - platformHeight - Math.round(16 * s);
  // Left lantern
  g.fillStyle(0x696969); // Gray stone
  g.fillRect(baseX - Math.round(2 * s), lanternY, Math.round(6 * s), Math.round(16 * s));
  g.fillStyle(0x808080);
  g.fillRect(
    baseX - Math.round(3 * s),
    lanternY + Math.round(4 * s),
    Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillStyle(PALETTE.gold, 0.7);
  g.fillRect(
    baseX - Math.round(1 * s),
    lanternY + Math.round(6 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  // Right lantern
  g.fillStyle(0x696969);
  g.fillRect(baseX + bWidth - Math.round(4 * s), lanternY, Math.round(6 * s), Math.round(16 * s));
  g.fillStyle(0x808080);
  g.fillRect(
    baseX + bWidth - Math.round(5 * s),
    lanternY + Math.round(4 * s),
    Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillStyle(PALETTE.gold, 0.7);
  g.fillRect(
    baseX + bWidth - Math.round(3 * s),
    lanternY + Math.round(6 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  g.generateTexture("tradinggym", canvasWidth, canvasHeight);
  g.destroy();
}

function generateCasino(scene: Phaser.Scene): void {
  // Casino - Vegas-themed building (purple/gold, neon style)
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasHeight = Math.round(160 * s);
  const canvasWidth = Math.round(70 * s);
  const bHeight = Math.round(100 * s);
  const bWidth = Math.round(60 * s);

  // Shadow
  g.fillStyle(PALETTE.void, 0.5);
  g.fillRect(
    Math.round(8 * s),
    canvasHeight - bHeight + Math.round(8 * s),
    bWidth - Math.round(2 * s),
    bHeight
  );

  // Building base (dark purple - casino style)
  g.fillStyle(PALETTE.deepPurple);
  g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

  // Highlight left side
  g.fillStyle(lighten(PALETTE.deepPurple, 0.2));
  g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(8 * s), bHeight);

  // Shadow right side
  g.fillStyle(darken(PALETTE.deepPurple, 0.2));
  g.fillRect(bWidth - Math.round(8 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

  // Gold trim at base with highlight
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    Math.round(4 * s),
    canvasHeight - Math.round(8 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillStyle(lighten(PALETTE.gold, 0.25));
  g.fillRect(
    Math.round(4 * s),
    canvasHeight - Math.round(8 * s),
    bWidth - Math.round(4 * s),
    Math.round(1 * s)
  );

  // Roof with neon lights effect (purple and gold)
  g.fillStyle(PALETTE.purple);
  g.fillRect(
    0,
    canvasHeight - bHeight - Math.round(12 * s),
    bWidth + Math.round(8 * s),
    Math.round(16 * s)
  );
  g.fillStyle(PALETTE.violet);
  g.fillRect(
    Math.round(2 * s),
    canvasHeight - bHeight - Math.round(10 * s),
    bWidth + Math.round(4 * s),
    Math.round(12 * s)
  );
  // Roof highlight
  g.fillStyle(lighten(PALETTE.violet, 0.2));
  g.fillRect(
    Math.round(2 * s),
    canvasHeight - bHeight - Math.round(10 * s),
    bWidth + Math.round(4 * s),
    Math.round(3 * s)
  );

  // Vegas-style marquee top with shading
  g.fillStyle(darken(PALETTE.deepPurple, 0.3));
  g.fillRect(
    bWidth / 2 - Math.round(16 * s),
    canvasHeight - bHeight - Math.round(28 * s),
    Math.round(40 * s),
    Math.round(18 * s)
  );
  g.fillStyle(PALETTE.deepPurple);
  g.fillRect(
    bWidth / 2 - Math.round(14 * s),
    canvasHeight - bHeight - Math.round(26 * s),
    Math.round(36 * s),
    Math.round(14 * s)
  );
  // Marquee highlight
  g.fillStyle(lighten(PALETTE.deepPurple, 0.15));
  g.fillRect(
    bWidth / 2 - Math.round(14 * s),
    canvasHeight - bHeight - Math.round(26 * s),
    Math.round(36 * s),
    Math.round(3 * s)
  );

  // Gold star on marquee
  g.fillStyle(PALETTE.gold);
  g.fillCircle(
    bWidth / 2 + Math.round(4 * s),
    canvasHeight - bHeight - Math.round(18 * s),
    Math.round(6 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillCircle(
    bWidth / 2 + Math.round(4 * s),
    canvasHeight - bHeight - Math.round(18 * s),
    Math.round(4 * s)
  );
  // Star glint
  g.fillStyle(PALETTE.white);
  g.fillCircle(
    bWidth / 2 + Math.round(2 * s),
    canvasHeight - bHeight - Math.round(20 * s),
    Math.round(1.5 * s)
  );

  // Neon border lights on marquee (alternating gold dots)
  g.fillStyle(PALETTE.gold);
  for (let i = 0; i < 10; i++) {
    const lightX = bWidth / 2 - Math.round(14 * s) + i * Math.round(4 * s);
    g.fillCircle(lightX, canvasHeight - bHeight - Math.round(26 * s), Math.round(1.5 * s));
    g.fillCircle(lightX, canvasHeight - bHeight - Math.round(12 * s), Math.round(1.5 * s));
  }

  // Windows - casino style (large, glowing)
  const windowColor = PALETTE.gold;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = Math.round(10 * s) + col * Math.round(16 * s);
      const wy = canvasHeight - bHeight + Math.round(18 * s) + row * Math.round(22 * s);

      // Window glow (neon effect)
      g.fillStyle(PALETTE.lavender, 0.35);
      g.fillRect(
        wx - Math.round(2 * s),
        wy - Math.round(2 * s),
        Math.round(13 * s),
        Math.round(15 * s)
      );

      // Window
      g.fillStyle(windowColor);
      g.fillRect(wx, wy, Math.round(10 * s), Math.round(12 * s));

      // Window highlight
      g.fillStyle(lighten(windowColor, 0.35));
      g.fillRect(wx, wy, Math.round(3 * s), Math.round(3 * s));

      // Window frame (purple)
      g.fillStyle(PALETTE.purple);
      g.fillRect(wx + Math.round(4 * s), wy, Math.round(2 * s), Math.round(12 * s));
      g.fillRect(wx, wy + Math.round(5 * s), Math.round(10 * s), Math.round(2 * s));
    }
  }

  // Dice symbols on front (gambling theme) with shading
  g.fillStyle(PALETTE.white);
  g.fillRect(
    Math.round(12 * s),
    canvasHeight - bHeight + Math.round(8 * s),
    Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillStyle(darken(PALETTE.white, 0.1));
  g.fillRect(
    Math.round(18 * s),
    canvasHeight - bHeight + Math.round(8 * s),
    Math.round(2 * s),
    Math.round(8 * s)
  );
  g.fillStyle(darken(PALETTE.deepPurple, 0.3));
  g.fillCircle(Math.round(14 * s), canvasHeight - bHeight + Math.round(10 * s), Math.round(1 * s));
  g.fillCircle(Math.round(18 * s), canvasHeight - bHeight + Math.round(14 * s), Math.round(1 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(
    bWidth - Math.round(16 * s),
    canvasHeight - bHeight + Math.round(8 * s),
    Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillStyle(darken(PALETTE.deepPurple, 0.3));
  g.fillCircle(
    bWidth - Math.round(12 * s),
    canvasHeight - bHeight + Math.round(12 * s),
    Math.round(1 * s)
  );

  // Door - grand casino entrance
  const doorWidth = Math.round(20 * s);
  const doorHeight = Math.round(26 * s);
  const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

  // Door frame (gold) with highlight
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX - Math.round(3 * s),
    canvasHeight - doorHeight - Math.round(4 * s),
    doorWidth + Math.round(6 * s),
    doorHeight + Math.round(4 * s)
  );
  g.fillStyle(lighten(PALETTE.gold, 0.2));
  g.fillRect(
    doorX - Math.round(3 * s),
    canvasHeight - doorHeight - Math.round(4 * s),
    Math.round(2 * s),
    doorHeight + Math.round(4 * s)
  );

  // Door (dark purple)
  g.fillStyle(darken(PALETTE.deepPurple, 0.3));
  g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

  // Door window (glowing gold)
  g.fillStyle(PALETTE.gold, 0.6);
  g.fillRect(
    doorX + Math.round(4 * s),
    canvasHeight - doorHeight + Math.round(4 * s),
    doorWidth - Math.round(8 * s),
    Math.round(10 * s)
  );
  // Window reflection
  g.fillStyle(lighten(PALETTE.gold, 0.4), 0.4);
  g.fillRect(
    doorX + Math.round(5 * s),
    canvasHeight - doorHeight + Math.round(5 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  // Door divider
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX + doorWidth / 2 - Math.round(1 * s),
    canvasHeight - doorHeight,
    Math.round(2 * s),
    doorHeight
  );

  // Red carpet entrance with shading
  g.fillStyle(PALETTE.red);
  g.fillRect(
    doorX - Math.round(6 * s),
    canvasHeight - Math.round(3 * s),
    doorWidth + Math.round(12 * s),
    Math.round(3 * s)
  );
  // Carpet highlight
  g.fillStyle(lighten(PALETTE.red, 0.15));
  g.fillRect(
    doorX - Math.round(4 * s),
    canvasHeight - Math.round(3 * s),
    doorWidth + Math.round(8 * s),
    Math.round(1 * s)
  );
  // Gold carpet trim
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX - Math.round(6 * s),
    canvasHeight - Math.round(3 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    doorX + doorWidth + Math.round(4 * s),
    canvasHeight - Math.round(3 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );

  // Side neon tubes (decorative) with glow
  g.fillStyle(PALETTE.lavender);
  g.fillRect(
    Math.round(6 * s),
    canvasHeight - Math.round(50 * s),
    Math.round(3 * s),
    Math.round(25 * s)
  );
  g.fillRect(
    bWidth - Math.round(5 * s),
    canvasHeight - Math.round(50 * s),
    Math.round(3 * s),
    Math.round(25 * s)
  );
  // Neon glow
  g.fillStyle(PALETTE.lavender, 0.25);
  g.fillRect(
    Math.round(4 * s),
    canvasHeight - Math.round(52 * s),
    Math.round(7 * s),
    Math.round(29 * s)
  );
  g.fillRect(
    bWidth - Math.round(7 * s),
    canvasHeight - Math.round(52 * s),
    Math.round(7 * s),
    Math.round(29 * s)
  );
  // Neon tube highlights
  g.fillStyle(lighten(PALETTE.lavender, 0.3));
  g.fillRect(
    Math.round(6 * s),
    canvasHeight - Math.round(50 * s),
    Math.round(1 * s),
    Math.round(25 * s)
  );
  g.fillRect(
    bWidth - Math.round(5 * s),
    canvasHeight - Math.round(50 * s),
    Math.round(1 * s),
    Math.round(25 * s)
  );

  g.generateTexture("casino", canvasWidth, canvasHeight);
  g.destroy();
}

function generateOracleTower(scene: Phaser.Scene): void {
  // Oracle Tower - Pixel art mystical tower (matches Casino/Terminal style)
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasHeight = Math.round(180 * s);
  const canvasWidth = Math.round(70 * s);
  const bHeight = Math.round(130 * s);
  const bWidth = Math.round(55 * s);
  const baseX = Math.round(8 * s);

  // Ground shadow (flat, no alpha)
  g.fillStyle(PALETTE.void);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasHeight - Math.round(4 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );

  // Main tower body (3 tapered sections)
  const section1H = Math.round(45 * s); // Bottom
  const section2H = Math.round(45 * s); // Middle
  const section3H = Math.round(40 * s); // Top

  // Bottom section (widest)
  const sec1W = bWidth;
  const sec1X = baseX;
  const sec1Y = canvasHeight - section1H;
  g.fillStyle(PALETTE.deepPurple);
  g.fillRect(sec1X, sec1Y, sec1W, section1H);

  // Middle section
  const sec2W = Math.round(45 * s);
  const sec2X = baseX + (bWidth - sec2W) / 2;
  const sec2Y = sec1Y - section2H;
  g.fillStyle(PALETTE.deepPurple);
  g.fillRect(sec2X, sec2Y, sec2W, section2H);

  // Top section (narrowest)
  const sec3W = Math.round(36 * s);
  const sec3X = baseX + (bWidth - sec3W) / 2;
  const sec3Y = sec2Y - section3H;
  g.fillStyle(PALETTE.deepPurple);
  g.fillRect(sec3X, sec3Y, sec3W, section3H);

  // Stone brick pattern (dithering - checkerboard darker pixels)
  const brickColor = darken(PALETTE.deepPurple, 0.2);
  g.fillStyle(brickColor);

  // Bottom section bricks
  for (let row = 0; row < section1H; row += Math.round(8 * s)) {
    const offset = (row / Math.round(8 * s)) % 2 === 0 ? 0 : Math.round(6 * s);
    for (let col = offset; col < sec1W; col += Math.round(12 * s)) {
      g.fillRect(sec1X + col, sec1Y + row, Math.round(10 * s), Math.round(6 * s));
    }
  }
  // Middle section bricks
  for (let row = 0; row < section2H; row += Math.round(8 * s)) {
    const offset = (row / Math.round(8 * s)) % 2 === 0 ? 0 : Math.round(6 * s);
    for (let col = offset; col < sec2W; col += Math.round(12 * s)) {
      g.fillRect(sec2X + col, sec2Y + row, Math.round(10 * s), Math.round(6 * s));
    }
  }
  // Top section bricks
  for (let row = 0; row < section3H; row += Math.round(8 * s)) {
    const offset = (row / Math.round(8 * s)) % 2 === 0 ? 0 : Math.round(6 * s);
    for (let col = offset; col < sec3W; col += Math.round(12 * s)) {
      g.fillRect(sec3X + col, sec3Y + row, Math.round(10 * s), Math.round(6 * s));
    }
  }

  // Left edge highlight (light source top-left)
  g.fillStyle(lighten(PALETTE.deepPurple, 0.25));
  g.fillRect(sec1X, sec1Y, Math.round(6 * s), section1H);
  g.fillRect(sec2X, sec2Y, Math.round(6 * s), section2H);
  g.fillRect(sec3X, sec3Y, Math.round(6 * s), section3H);

  // Right edge shadow
  g.fillStyle(darken(PALETTE.deepPurple, 0.35));
  g.fillRect(sec1X + sec1W - Math.round(6 * s), sec1Y, Math.round(6 * s), section1H);
  g.fillRect(sec2X + sec2W - Math.round(6 * s), sec2Y, Math.round(6 * s), section2H);
  g.fillRect(sec3X + sec3W - Math.round(6 * s), sec3Y, Math.round(6 * s), section3H);

  // Gold trim bands between sections
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    sec2X - Math.round(2 * s),
    sec1Y - Math.round(4 * s),
    sec2W + Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    sec3X - Math.round(2 * s),
    sec2Y - Math.round(4 * s),
    sec3W + Math.round(4 * s),
    Math.round(4 * s)
  );
  // Gold band highlights
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    sec2X - Math.round(2 * s),
    sec1Y - Math.round(4 * s),
    sec2W + Math.round(4 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    sec3X - Math.round(2 * s),
    sec2Y - Math.round(4 * s),
    sec3W + Math.round(4 * s),
    Math.round(1 * s)
  );

  // Windows - uniform pixel rectangles
  const winW = Math.round(10 * s);
  const winH = Math.round(14 * s);

  // Bottom section windows (2)
  const win1aX = sec1X + Math.round(8 * s);
  const win1bX = sec1X + sec1W - Math.round(18 * s);
  const win1Y = sec1Y + Math.round(16 * s);

  // Middle section windows (2)
  const win2aX = sec2X + Math.round(6 * s);
  const win2bX = sec2X + sec2W - Math.round(16 * s);
  const win2Y = sec2Y + Math.round(16 * s);

  // Top section window (1 centered)
  const win3X = sec3X + (sec3W - winW) / 2;
  const win3Y = sec3Y + Math.round(14 * s);

  const windowPositions = [
    { x: win1aX, y: win1Y },
    { x: win1bX, y: win1Y },
    { x: win2aX, y: win2Y },
    { x: win2bX, y: win2Y },
    { x: win3X, y: win3Y },
  ];

  windowPositions.forEach((win) => {
    // Window frame (dark)
    g.fillStyle(darken(PALETTE.deepPurple, 0.4));
    g.fillRect(
      win.x - Math.round(1 * s),
      win.y - Math.round(1 * s),
      winW + Math.round(2 * s),
      winH + Math.round(2 * s)
    );

    // Window interior (purple glow)
    g.fillStyle(PALETTE.purple);
    g.fillRect(win.x, win.y, winW, winH);

    // Window glow (lavender inner)
    g.fillStyle(PALETTE.lavender);
    g.fillRect(
      win.x + Math.round(2 * s),
      win.y + Math.round(2 * s),
      winW - Math.round(4 * s),
      winH - Math.round(4 * s)
    );

    // Highlight corner (top-left, hard pixel)
    g.fillStyle(PALETTE.white);
    g.fillRect(
      win.x + Math.round(2 * s),
      win.y + Math.round(2 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );

    // Window divider (cross)
    g.fillStyle(PALETTE.purple);
    g.fillRect(win.x + winW / 2 - Math.round(1 * s), win.y, Math.round(2 * s), winH);
    g.fillRect(win.x, win.y + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
  });

  // Pointed roof (stepped pyramid for pixel art)
  const roofBaseY = sec3Y;
  const roofW1 = sec3W + Math.round(8 * s);
  const roofX1 = sec3X - Math.round(4 * s);

  // Roof layer 1 (eaves)
  g.fillStyle(PALETTE.purple);
  g.fillRect(roofX1, roofBaseY - Math.round(6 * s), roofW1, Math.round(6 * s));
  g.fillStyle(PALETTE.violet);
  g.fillRect(roofX1, roofBaseY - Math.round(6 * s), roofW1, Math.round(2 * s));

  // Roof layer 2
  const roofW2 = roofW1 - Math.round(10 * s);
  const roofX2 = roofX1 + Math.round(5 * s);
  g.fillStyle(PALETTE.purple);
  g.fillRect(roofX2, roofBaseY - Math.round(14 * s), roofW2, Math.round(8 * s));
  g.fillStyle(PALETTE.violet);
  g.fillRect(roofX2, roofBaseY - Math.round(14 * s), roofW2, Math.round(2 * s));

  // Roof layer 3 (spire base)
  const roofW3 = roofW2 - Math.round(10 * s);
  const roofX3 = roofX2 + Math.round(5 * s);
  g.fillStyle(PALETTE.purple);
  g.fillRect(roofX3, roofBaseY - Math.round(22 * s), roofW3, Math.round(8 * s));
  g.fillStyle(PALETTE.violet);
  g.fillRect(roofX3, roofBaseY - Math.round(22 * s), roofW3, Math.round(2 * s));

  // Spire (narrow tower top)
  const spireW = Math.round(8 * s);
  const spireX = baseX + bWidth / 2 - spireW / 2;
  const spireH = Math.round(16 * s);
  g.fillStyle(PALETTE.purple);
  g.fillRect(spireX, roofBaseY - Math.round(22 * s) - spireH, spireW, spireH);
  g.fillStyle(PALETTE.violet);
  g.fillRect(spireX, roofBaseY - Math.round(22 * s) - spireH, Math.round(3 * s), spireH);

  // Crystal orb at top (pixel diamond shape, not circle)
  const orbY = roofBaseY - Math.round(22 * s) - spireH - Math.round(6 * s);
  const orbX = baseX + bWidth / 2;
  const orbSize = Math.round(4 * s);

  // Gold pedestal
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    orbX - Math.round(5 * s),
    orbY + Math.round(4 * s),
    Math.round(10 * s),
    Math.round(4 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    orbX - Math.round(5 * s),
    orbY + Math.round(4 * s),
    Math.round(10 * s),
    Math.round(1 * s)
  );

  // Crystal orb (blocky diamond - stacked rectangles)
  g.fillStyle(0x06b6d4); // Cyan crystal
  g.fillRect(orbX - orbSize, orbY, orbSize * 2, Math.round(2 * s));
  g.fillRect(
    orbX - orbSize - Math.round(2 * s),
    orbY - Math.round(2 * s),
    orbSize * 2 + Math.round(4 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    orbX - orbSize - Math.round(2 * s),
    orbY + Math.round(2 * s),
    orbSize * 2 + Math.round(4 * s),
    Math.round(2 * s)
  );
  g.fillRect(orbX - orbSize, orbY - Math.round(4 * s), orbSize * 2, Math.round(2 * s));
  g.fillRect(orbX - orbSize, orbY + Math.round(4 * s), orbSize * 2, Math.round(2 * s));

  // Orb highlight (top-left pixel)
  g.fillStyle(0x22d3ee); // Light cyan
  g.fillRect(orbX - orbSize, orbY - Math.round(2 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(
    orbX - orbSize + Math.round(1 * s),
    orbY - Math.round(1 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  // Star decorations (4-pixel crosses, not circles)
  const starPositions = [
    { x: orbX - Math.round(18 * s), y: orbY + Math.round(4 * s) },
    { x: orbX + Math.round(18 * s), y: orbY + Math.round(4 * s) },
  ];
  starPositions.forEach((star) => {
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      star.x - Math.round(1 * s),
      star.y - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      star.x - Math.round(3 * s),
      star.y - Math.round(1 * s),
      Math.round(6 * s),
      Math.round(2 * s)
    );
    g.fillStyle(PALETTE.yellow);
    g.fillRect(
      star.x - Math.round(1 * s),
      star.y - Math.round(1 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );
  });

  // Door at base
  const doorW = Math.round(14 * s);
  const doorH = Math.round(22 * s);
  const doorX = sec1X + (sec1W - doorW) / 2;
  const doorY = canvasHeight - doorH;

  // Door frame (gold)
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(4 * s),
    doorW + Math.round(4 * s),
    doorH + Math.round(4 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(4 * s),
    doorW + Math.round(4 * s),
    Math.round(2 * s)
  );

  // Door (dark purple)
  g.fillStyle(PALETTE.purple);
  g.fillRect(doorX, doorY, doorW, doorH);

  // Door panels
  g.fillStyle(PALETTE.deepPurple);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(2 * s),
    Math.round(4 * s),
    doorH - Math.round(4 * s)
  );
  g.fillRect(
    doorX + Math.round(8 * s),
    doorY + Math.round(2 * s),
    Math.round(4 * s),
    doorH - Math.round(4 * s)
  );

  // Door handle (gold pixel)
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    doorX + doorW - Math.round(4 * s),
    doorY + doorH / 2,
    Math.round(2 * s),
    Math.round(2 * s)
  );

  // Base trim (gold)
  g.fillStyle(PALETTE.gold);
  g.fillRect(sec1X, canvasHeight - Math.round(4 * s), sec1W, Math.round(4 * s));
  g.fillStyle(PALETTE.yellow);
  g.fillRect(sec1X, canvasHeight - Math.round(4 * s), sec1W, Math.round(1 * s));

  g.generateTexture("oracle_tower", canvasWidth, canvasHeight);
  g.destroy();
}

function generateBagsWorldHQ(scene: Phaser.Scene): void {
  // BagsWorld HQ - Pixel art castle/headquarters (matches other zone buildings)
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const canvasWidth = Math.round(90 * s);
  const canvasHeight = Math.round(140 * s);
  const bWidth = Math.round(75 * s);
  const bHeight = Math.round(100 * s);
  const baseX = Math.round(8 * s);

  // Ground shadow (flat, no alpha)
  g.fillStyle(PALETTE.void);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasHeight - Math.round(4 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );

  // Main castle body
  const castleX = baseX;
  const castleY = canvasHeight - bHeight;
  const castleW = bWidth;
  const castleH = bHeight;

  // Castle base (dark blue - Bags brand)
  const bagsBlue = 0x1a1a2e;
  const bagsBlueLight = 0x2d2d4a;
  const bagsBlueDark = 0x0f0f1a;

  g.fillStyle(bagsBlue);
  g.fillRect(castleX, castleY, castleW, castleH);

  // Brick pattern (darker rectangles)
  g.fillStyle(bagsBlueDark);
  for (let row = 0; row < castleH; row += Math.round(10 * s)) {
    const offset = (row / Math.round(10 * s)) % 2 === 0 ? 0 : Math.round(8 * s);
    for (let col = offset; col < castleW; col += Math.round(16 * s)) {
      g.fillRect(castleX + col, castleY + row, Math.round(14 * s), Math.round(8 * s));
    }
  }

  // Left edge highlight
  g.fillStyle(bagsBlueLight);
  g.fillRect(castleX, castleY, Math.round(6 * s), castleH);

  // Right edge shadow
  g.fillStyle(bagsBlueDark);
  g.fillRect(castleX + castleW - Math.round(6 * s), castleY, Math.round(6 * s), castleH);

  // Left turret
  const turretW = Math.round(18 * s);
  const turretH = Math.round(70 * s);
  const leftTurretX = castleX - Math.round(4 * s);
  const leftTurretY = canvasHeight - turretH - Math.round(20 * s);

  g.fillStyle(bagsBlue);
  g.fillRect(leftTurretX, leftTurretY, turretW, turretH + Math.round(20 * s));
  g.fillStyle(bagsBlueLight);
  g.fillRect(leftTurretX, leftTurretY, Math.round(4 * s), turretH + Math.round(20 * s));
  g.fillStyle(bagsBlueDark);
  g.fillRect(
    leftTurretX + turretW - Math.round(4 * s),
    leftTurretY,
    Math.round(4 * s),
    turretH + Math.round(20 * s)
  );

  // Left turret spire (stepped pyramid)
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    leftTurretX - Math.round(2 * s),
    leftTurretY - Math.round(6 * s),
    turretW + Math.round(4 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    leftTurretX + Math.round(2 * s),
    leftTurretY - Math.round(12 * s),
    turretW - Math.round(4 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    leftTurretX + Math.round(5 * s),
    leftTurretY - Math.round(18 * s),
    turretW - Math.round(10 * s),
    Math.round(6 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    leftTurretX - Math.round(2 * s),
    leftTurretY - Math.round(6 * s),
    turretW + Math.round(4 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    leftTurretX + Math.round(2 * s),
    leftTurretY - Math.round(12 * s),
    turretW - Math.round(4 * s),
    Math.round(2 * s)
  );

  // Right turret
  const rightTurretX = castleX + castleW - turretW + Math.round(4 * s);

  g.fillStyle(bagsBlue);
  g.fillRect(rightTurretX, leftTurretY, turretW, turretH + Math.round(20 * s));
  g.fillStyle(bagsBlueLight);
  g.fillRect(rightTurretX, leftTurretY, Math.round(4 * s), turretH + Math.round(20 * s));
  g.fillStyle(bagsBlueDark);
  g.fillRect(
    rightTurretX + turretW - Math.round(4 * s),
    leftTurretY,
    Math.round(4 * s),
    turretH + Math.round(20 * s)
  );

  // Right turret spire (stepped pyramid)
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    rightTurretX - Math.round(2 * s),
    leftTurretY - Math.round(6 * s),
    turretW + Math.round(4 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    rightTurretX + Math.round(2 * s),
    leftTurretY - Math.round(12 * s),
    turretW - Math.round(4 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    rightTurretX + Math.round(5 * s),
    leftTurretY - Math.round(18 * s),
    turretW - Math.round(10 * s),
    Math.round(6 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    rightTurretX - Math.round(2 * s),
    leftTurretY - Math.round(6 * s),
    turretW + Math.round(4 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    rightTurretX + Math.round(2 * s),
    leftTurretY - Math.round(12 * s),
    turretW - Math.round(4 * s),
    Math.round(2 * s)
  );

  // Central tower (taller, behind main body)
  const centerTowerW = Math.round(30 * s);
  const centerTowerH = Math.round(50 * s);
  const centerTowerX = castleX + (castleW - centerTowerW) / 2;
  const centerTowerY = castleY - centerTowerH + Math.round(15 * s);

  g.fillStyle(bagsBlue);
  g.fillRect(centerTowerX, centerTowerY, centerTowerW, centerTowerH);
  g.fillStyle(bagsBlueLight);
  g.fillRect(centerTowerX, centerTowerY, Math.round(5 * s), centerTowerH);
  g.fillStyle(bagsBlueDark);
  g.fillRect(
    centerTowerX + centerTowerW - Math.round(5 * s),
    centerTowerY,
    Math.round(5 * s),
    centerTowerH
  );

  // Central tower spire (stepped)
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    centerTowerX - Math.round(3 * s),
    centerTowerY - Math.round(8 * s),
    centerTowerW + Math.round(6 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    centerTowerX + Math.round(4 * s),
    centerTowerY - Math.round(16 * s),
    centerTowerW - Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    centerTowerX + Math.round(10 * s),
    centerTowerY - Math.round(24 * s),
    centerTowerW - Math.round(20 * s),
    Math.round(8 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    centerTowerX - Math.round(3 * s),
    centerTowerY - Math.round(8 * s),
    centerTowerW + Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    centerTowerX + Math.round(4 * s),
    centerTowerY - Math.round(16 * s),
    centerTowerW - Math.round(8 * s),
    Math.round(2 * s)
  );

  // Flag pole on center
  const flagX = centerTowerX + centerTowerW / 2;
  const flagY = centerTowerY - Math.round(24 * s);
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    flagX - Math.round(1 * s),
    flagY - Math.round(16 * s),
    Math.round(2 * s),
    Math.round(16 * s)
  );
  // Flag (Bags green)
  g.fillStyle(PALETTE.green);
  g.fillRect(
    flagX + Math.round(1 * s),
    flagY - Math.round(16 * s),
    Math.round(10 * s),
    Math.round(8 * s)
  );
  g.fillStyle(lighten(PALETTE.green, 0.2));
  g.fillRect(
    flagX + Math.round(1 * s),
    flagY - Math.round(16 * s),
    Math.round(10 * s),
    Math.round(2 * s)
  );

  // Windows - Bags green glow (uniform rectangles)
  const winW = Math.round(8 * s);
  const winH = Math.round(12 * s);

  // Main castle windows (2 rows of 3)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const winX = castleX + Math.round(12 * s) + col * Math.round(22 * s);
      const winY = castleY + Math.round(20 * s) + row * Math.round(30 * s);

      // Window frame
      g.fillStyle(bagsBlueDark);
      g.fillRect(
        winX - Math.round(1 * s),
        winY - Math.round(1 * s),
        winW + Math.round(2 * s),
        winH + Math.round(2 * s)
      );

      // Window (green glow)
      g.fillStyle(PALETTE.green);
      g.fillRect(winX, winY, winW, winH);

      // Window highlight
      g.fillStyle(lighten(PALETTE.green, 0.3));
      g.fillRect(
        winX + Math.round(1 * s),
        winY + Math.round(1 * s),
        Math.round(3 * s),
        Math.round(3 * s)
      );

      // Window cross
      g.fillStyle(bagsBlue);
      g.fillRect(winX + winW / 2 - Math.round(1 * s), winY, Math.round(2 * s), winH);
      g.fillRect(winX, winY + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
    }
  }

  // Turret windows (one each)
  const turretWinY = leftTurretY + Math.round(20 * s);
  // Left turret window
  g.fillStyle(bagsBlueDark);
  g.fillRect(
    leftTurretX + Math.round(4 * s),
    turretWinY,
    winW + Math.round(2 * s),
    winH + Math.round(2 * s)
  );
  g.fillStyle(PALETTE.green);
  g.fillRect(leftTurretX + Math.round(5 * s), turretWinY + Math.round(1 * s), winW, winH);
  g.fillStyle(lighten(PALETTE.green, 0.3));
  g.fillRect(
    leftTurretX + Math.round(6 * s),
    turretWinY + Math.round(2 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );

  // Right turret window
  g.fillStyle(bagsBlueDark);
  g.fillRect(
    rightTurretX + Math.round(4 * s),
    turretWinY,
    winW + Math.round(2 * s),
    winH + Math.round(2 * s)
  );
  g.fillStyle(PALETTE.green);
  g.fillRect(rightTurretX + Math.round(5 * s), turretWinY + Math.round(1 * s), winW, winH);
  g.fillStyle(lighten(PALETTE.green, 0.3));
  g.fillRect(
    rightTurretX + Math.round(6 * s),
    turretWinY + Math.round(2 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );

  // Central tower window (larger)
  const centerWinX = centerTowerX + (centerTowerW - Math.round(12 * s)) / 2;
  const centerWinY = centerTowerY + Math.round(15 * s);
  g.fillStyle(bagsBlueDark);
  g.fillRect(
    centerWinX - Math.round(1 * s),
    centerWinY - Math.round(1 * s),
    Math.round(14 * s),
    Math.round(18 * s)
  );
  g.fillStyle(PALETTE.green);
  g.fillRect(centerWinX, centerWinY, Math.round(12 * s), Math.round(16 * s));
  g.fillStyle(lighten(PALETTE.green, 0.3));
  g.fillRect(
    centerWinX + Math.round(1 * s),
    centerWinY + Math.round(1 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  // Grand entrance door
  const doorW = Math.round(16 * s);
  const doorH = Math.round(26 * s);
  const doorX = castleX + (castleW - doorW) / 2;
  const doorY = canvasHeight - doorH;

  // Door frame (gold)
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX - Math.round(3 * s),
    doorY - Math.round(6 * s),
    doorW + Math.round(6 * s),
    doorH + Math.round(6 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    doorX - Math.round(3 * s),
    doorY - Math.round(6 * s),
    doorW + Math.round(6 * s),
    Math.round(2 * s)
  );

  // Door (dark)
  g.fillStyle(bagsBlueDark);
  g.fillRect(doorX, doorY, doorW, doorH);

  // Door panels
  g.fillStyle(bagsBlue);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(2 * s),
    Math.round(5 * s),
    doorH - Math.round(4 * s)
  );
  g.fillRect(
    doorX + Math.round(9 * s),
    doorY + Math.round(2 * s),
    Math.round(5 * s),
    doorH - Math.round(4 * s)
  );

  // Door handle
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    doorX + doorW - Math.round(4 * s),
    doorY + doorH / 2,
    Math.round(2 * s),
    Math.round(2 * s)
  );

  // Base trim (gold)
  g.fillStyle(PALETTE.gold);
  g.fillRect(castleX, canvasHeight - Math.round(4 * s), castleW, Math.round(4 * s));
  g.fillStyle(PALETTE.yellow);
  g.fillRect(castleX, canvasHeight - Math.round(4 * s), castleW, Math.round(1 * s));

  // "BAGS" banner above door (pixel text area)
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX - Math.round(6 * s),
    doorY - Math.round(16 * s),
    doorW + Math.round(12 * s),
    Math.round(8 * s)
  );
  g.fillStyle(bagsBlue);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(14 * s),
    doorW + Math.round(8 * s),
    Math.round(4 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    doorX - Math.round(6 * s),
    doorY - Math.round(16 * s),
    doorW + Math.round(12 * s),
    Math.round(1 * s)
  );

  g.generateTexture("bagshq", canvasWidth, canvasHeight);
  g.destroy();
}

function generateTreasury(scene: Phaser.Scene): void {
  // Treasury - DC Monument / Lincoln Memorial style marble building
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasHeight = Math.round(180 * s);
  const canvasWidth = Math.round(100 * s);
  const bWidth = Math.round(90 * s);
  const baseX = Math.round(5 * s);

  // 1. Ground shadow
  g.fillStyle(PALETTE.void, 0.5);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasHeight - Math.round(4 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );

  // 2. Stepped base tiers (4 tiers, widest at bottom)
  const tierH = Math.round(5 * s);
  const tierIndent = Math.round(4 * s);
  for (let i = 0; i < 4; i++) {
    const tX = baseX - (3 - i) * tierIndent;
    const tW = bWidth + (3 - i) * tierIndent * 2;
    const tY = canvasHeight - (i + 1) * tierH;
    g.fillStyle(PALETTE.silver);
    g.fillRect(tX, tY, tW, tierH);
    // Highlight top edge
    g.fillStyle(lighten(PALETTE.silver, 0.3));
    g.fillRect(tX, tY, tW, Math.round(1 * s));
    // Shadow bottom edge
    g.fillStyle(darken(PALETTE.silver, 0.15));
    g.fillRect(tX, tY + tierH - Math.round(1 * s), tW, Math.round(1 * s));
  }

  const stepsTop = canvasHeight - 4 * tierH;
  const wallH = Math.round(70 * s);
  const wallTop = stepsTop - wallH;

  // 3. Main wall body (white marble)
  g.fillStyle(PALETTE.white);
  g.fillRect(baseX, wallTop, bWidth, wallH);
  // Cream highlight left side
  g.fillStyle(lighten(PALETTE.cream, 0.3));
  g.fillRect(baseX, wallTop, Math.round(6 * s), wallH);
  // Gray shadow right side
  g.fillStyle(darken(PALETTE.white, 0.1));
  g.fillRect(baseX + bWidth - Math.round(6 * s), wallTop, Math.round(6 * s), wallH);

  // 4. Stone brick dithering (offset row pattern)
  g.fillStyle(darken(PALETTE.white, 0.08));
  for (let row = 0; row < wallH; row += Math.round(8 * s)) {
    const offset = (row / Math.round(8 * s)) % 2 === 0 ? 0 : Math.round(6 * s);
    for (let col = offset; col < bWidth; col += Math.round(12 * s)) {
      g.fillRect(baseX + col, wallTop + row, Math.round(10 * s), Math.round(6 * s));
    }
  }

  // 5. Columns (6 across the face with 3D shading)
  const colCount = 6;
  const colW = Math.round(6 * s);
  const colH = wallH - Math.round(10 * s);
  const colTop = wallTop + Math.round(6 * s);
  const colSpacing = (bWidth - colW) / (colCount - 1);

  for (let i = 0; i < colCount; i++) {
    const cX = baseX + Math.round(i * colSpacing);
    // Column body
    g.fillStyle(PALETTE.cream);
    g.fillRect(cX, colTop, colW, colH);
    // Left highlight
    g.fillStyle(lighten(PALETTE.cream, 0.2));
    g.fillRect(cX, colTop, Math.round(2 * s), colH);
    // Right shadow
    g.fillStyle(darken(PALETTE.cream, 0.15));
    g.fillRect(cX + colW - Math.round(2 * s), colTop, Math.round(2 * s), colH);

    // 6. Gold column capitals
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      cX - Math.round(1 * s),
      colTop - Math.round(4 * s),
      colW + Math.round(2 * s),
      Math.round(4 * s)
    );
    g.fillStyle(PALETTE.yellow);
    g.fillRect(
      cX - Math.round(1 * s),
      colTop - Math.round(4 * s),
      colW + Math.round(2 * s),
      Math.round(1 * s)
    );
  }

  // 7. Entablature band (silver bar above columns)
  const entY = wallTop - Math.round(6 * s);
  const entH = Math.round(6 * s);
  g.fillStyle(PALETTE.silver);
  g.fillRect(baseX - Math.round(2 * s), entY, bWidth + Math.round(4 * s), entH);
  g.fillStyle(lighten(PALETTE.silver, 0.3));
  g.fillRect(baseX - Math.round(2 * s), entY, bWidth + Math.round(4 * s), Math.round(1 * s));

  // 8. Green Bags banner on entablature
  const bannerW = Math.round(30 * s);
  const bannerX = baseX + (bWidth - bannerW) / 2;
  g.fillStyle(PALETTE.bagsGreen);
  g.fillRect(bannerX, entY + Math.round(1 * s), bannerW, Math.round(4 * s));
  g.fillStyle(PALETTE.mint);
  g.fillRect(bannerX, entY + Math.round(1 * s), bannerW, Math.round(1 * s));

  // 9. Stepped pediment (4 layers, each narrower, with gold trim)
  const pedBaseW = bWidth + Math.round(4 * s);
  const pedBaseX = baseX - Math.round(2 * s);
  const pedLayerH = Math.round(6 * s);
  const pedIndent = Math.round(8 * s);
  for (let i = 0; i < 4; i++) {
    const lX = pedBaseX + i * pedIndent;
    const lW = pedBaseW - i * pedIndent * 2;
    const lY = entY - (i + 1) * pedLayerH;
    if (lW <= 0) break;
    g.fillStyle(PALETTE.white);
    g.fillRect(lX, lY, lW, pedLayerH);
    // Highlight top
    g.fillStyle(lighten(PALETTE.white, 0.1));
    g.fillRect(lX, lY, lW, Math.round(1 * s));
    // Gold trim bottom edge
    g.fillStyle(PALETTE.gold);
    g.fillRect(lX, lY + pedLayerH - Math.round(1 * s), lW, Math.round(1 * s));
  }

  // 10. Central door with gold frame and amber glow interior
  const doorW = Math.round(16 * s);
  const doorH = Math.round(24 * s);
  const doorX = baseX + (bWidth - doorW) / 2;
  const doorY = stepsTop - doorH;
  // Gold frame
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(3 * s),
    doorW + Math.round(4 * s),
    doorH + Math.round(3 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(3 * s),
    doorW + Math.round(4 * s),
    Math.round(2 * s)
  );
  // Interior amber glow
  g.fillStyle(PALETTE.amber);
  g.fillRect(doorX, doorY, doorW, doorH);
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX + Math.round(3 * s),
    doorY + Math.round(3 * s),
    doorW - Math.round(6 * s),
    doorH - Math.round(6 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    doorX + Math.round(5 * s),
    doorY + Math.round(5 * s),
    doorW - Math.round(10 * s),
    doorH - Math.round(10 * s)
  );

  // 11. Pixel art "$" symbol above door
  const px = Math.round(2 * s);
  const dX = baseX + Math.round(bWidth / 2) - Math.round(3 * px);
  const dY = doorY - Math.round(16 * s);
  g.fillStyle(PALETTE.gold);
  // Top curve of S
  g.fillRect(dX + px, dY, 4 * px, px);
  g.fillRect(dX, dY + px, px, px);
  // Middle bar
  g.fillRect(dX + px, dY + 2 * px, 4 * px, px);
  // Bottom curve of S
  g.fillRect(dX + 5 * px, dY + 3 * px, px, px);
  g.fillRect(dX + px, dY + 4 * px, 4 * px, px);
  // Vertical line through center
  g.fillStyle(PALETTE.yellow);
  g.fillRect(dX + 2 * px + Math.round(1 * s), dY - px, px, 7 * px);

  // 12. Gold base trim
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    baseX - Math.round(1 * s),
    stepsTop - Math.round(2 * s),
    bWidth + Math.round(2 * s),
    Math.round(2 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    baseX - Math.round(1 * s),
    stepsTop - Math.round(2 * s),
    bWidth + Math.round(2 * s),
    Math.round(1 * s)
  );

  g.generateTexture("treasury", canvasWidth, canvasHeight);
  g.destroy();
}

export function generateSpecialBuildings(scene: Phaser.Scene): void {
  generatePokeCenter(scene);
  generateTradingGym(scene);
  generateCasino(scene);
  generateOracleTower(scene);
  generateBagsWorldHQ(scene);
  generateTreasury(scene);
  generateArcadeBuilding(scene);
}
