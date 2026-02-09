import * as Phaser from "phaser";
import { SCALE, PALETTE, darken, lighten } from "./constants";

export function generateFoundersAssets(scene: Phaser.Scene): void {
  generateFoundersGround(scene);
  generateFoundersBuildings(scene);
  generateFoundersProps(scene);
  generateFoundersPokemon(scene);
}

function generateFoundersGround(scene: Phaser.Scene): void {
  const s = SCALE;
  const size = Math.round(32 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Base cobblestone color (warm gray-brown)
  g.fillStyle(0x78716c);
  g.fillRect(0, 0, size, size);

  // Stone pattern - 2x2 grid of individual stones with gaps
  const stoneSize = Math.round(14 * s);
  const gap = Math.round(2 * s);
  const stones = [
    { x: gap, y: gap, color: 0x6b7280 },
    { x: stoneSize + gap * 2, y: gap, color: 0x57534e },
    { x: gap, y: stoneSize + gap * 2, color: 0x57534e },
    { x: stoneSize + gap * 2, y: stoneSize + gap * 2, color: 0x6b7280 },
  ];

  stones.forEach((stone) => {
    // Stone base
    g.fillStyle(stone.color);
    g.fillRect(stone.x, stone.y, stoneSize, stoneSize);

    // Stone highlight (top-left edges)
    g.fillStyle(lighten(stone.color, 0.15));
    g.fillRect(stone.x, stone.y, stoneSize, Math.round(2 * s));
    g.fillRect(stone.x, stone.y, Math.round(2 * s), stoneSize);

    // Stone shadow (bottom-right edges)
    g.fillStyle(darken(stone.color, 0.2));
    g.fillRect(stone.x, stone.y + stoneSize - Math.round(2 * s), stoneSize, Math.round(2 * s));
    g.fillRect(stone.x + stoneSize - Math.round(2 * s), stone.y, Math.round(2 * s), stoneSize);
  });

  // Occasional moss/grass detail in gaps
  g.fillStyle(0x4d7c0f);
  g.fillRect(Math.round(15 * s), Math.round(1 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(1 * s), Math.round(15 * s), Math.round(1 * s), Math.round(2 * s));

  // Warm accent - tiny flower peeking through
  g.fillStyle(0xfbbf24);
  g.fillRect(Math.round(26 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));

  g.generateTexture("founders_ground", size, size);
  g.destroy();
}

function generateFoundersBuildings(scene: Phaser.Scene): void {
  const s = SCALE;

  // Building 0: DexScreener Workshop (main educational building)
  generateFoundersWorkshop(scene, s);

  // Building 1: Art Studio (logo/banner assets)
  generateFoundersStudio(scene, s);

  // Building 2: Social Hub (social links building)
  generateFoundersSocialHub(scene, s);

  // Building 3: Sol Incinerator Factory (burn tokens & close accounts)
  generateFoundersIncinerator(scene, s);

  // Incinerator garbage truck (parked outside factory)
  generateIncineratorTruck(scene, s);
}

/**
 * Founders Workshop - Token launch education building
 * REWRITTEN: Proper 16-bit pixel art - no circles, no triangles, no alpha
 */
function generateFoundersWorkshop(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(80 * s);
  const canvasH = Math.round(140 * s);
  const bWidth = Math.round(65 * s);
  const bHeight = Math.round(90 * s);
  const baseX = Math.round(7 * s);
  const baseY = canvasH - bHeight;

  // Colors
  const woodBase = 0x8b4513; // SaddleBrown
  const woodLight = lighten(woodBase, 0.2);
  const woodDark = darken(woodBase, 0.25);
  const roofColor = 0x5c3317; // Dark brown roof
  const roofLight = lighten(roofColor, 0.2);
  const accent = PALETTE.bagsGreen; // DexScreener green

  // Ground shadow (flat, solid - no alpha)
  g.fillStyle(PALETTE.void);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasH - Math.round(4 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );

  // Main body
  g.fillStyle(woodBase);
  g.fillRect(baseX, baseY, bWidth, bHeight);

  // 3D depth: Light left edge
  g.fillStyle(woodLight);
  g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);

  // 3D depth: Dark right edge
  g.fillStyle(woodDark);
  g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

  // Wood plank texture (brick pattern)
  g.fillStyle(darken(woodBase, 0.1));
  for (let py = 0; py < bHeight; py += Math.round(8 * s)) {
    const offset = (py / Math.round(8 * s)) % 2 === 0 ? 0 : Math.round(6 * s);
    for (
      let px = Math.round(6 * s) + offset;
      px < bWidth - Math.round(6 * s);
      px += Math.round(12 * s)
    ) {
      g.fillRect(baseX + px, baseY + py, Math.round(10 * s), Math.round(6 * s));
    }
  }

  // Horizontal wood plank lines
  g.fillStyle(woodDark);
  for (let py = Math.round(15 * s); py < bHeight; py += Math.round(18 * s)) {
    g.fillRect(
      baseX + Math.round(5 * s),
      baseY + py,
      bWidth - Math.round(10 * s),
      Math.round(1 * s)
    );
  }

  // Pointed roof (stepped pyramid - no triangles)
  const roofCenterX = baseX + bWidth / 2;
  const roofW1 = bWidth + Math.round(10 * s);
  const roofX1 = baseX - Math.round(5 * s);

  // Roof layer 1 (eaves)
  g.fillStyle(roofColor);
  g.fillRect(roofX1, baseY - Math.round(10 * s), roofW1, Math.round(10 * s));
  g.fillStyle(roofLight);
  g.fillRect(roofX1, baseY - Math.round(10 * s), roofW1, Math.round(2 * s));

  // Roof layer 2
  const roofW2 = roofW1 - Math.round(16 * s);
  const roofX2 = roofX1 + Math.round(8 * s);
  g.fillStyle(roofColor);
  g.fillRect(roofX2, baseY - Math.round(20 * s), roofW2, Math.round(10 * s));
  g.fillStyle(roofLight);
  g.fillRect(roofX2, baseY - Math.round(20 * s), roofW2, Math.round(2 * s));

  // Roof layer 3
  const roofW3 = roofW2 - Math.round(16 * s);
  const roofX3 = roofX2 + Math.round(8 * s);
  g.fillStyle(roofColor);
  g.fillRect(roofX3, baseY - Math.round(30 * s), roofW3, Math.round(10 * s));
  g.fillStyle(roofLight);
  g.fillRect(roofX3, baseY - Math.round(30 * s), roofW3, Math.round(2 * s));

  // Roof ridge cap
  g.fillStyle(0x78350f);
  g.fillRect(
    roofCenterX - Math.round(4 * s),
    baseY - Math.round(35 * s),
    Math.round(8 * s),
    Math.round(6 * s)
  );
  g.fillStyle(lighten(0x78350f, 0.15));
  g.fillRect(
    roofCenterX - Math.round(4 * s),
    baseY - Math.round(35 * s),
    Math.round(8 * s),
    Math.round(2 * s)
  );

  // Chimney
  const chimneyX = baseX + bWidth - Math.round(18 * s);
  const chimneyY = baseY - Math.round(25 * s);
  g.fillStyle(PALETTE.gray);
  g.fillRect(chimneyX, chimneyY, Math.round(10 * s), Math.round(25 * s));
  g.fillStyle(lighten(PALETTE.gray, 0.15));
  g.fillRect(chimneyX, chimneyY, Math.round(3 * s), Math.round(25 * s));
  g.fillStyle(darken(PALETTE.gray, 0.2));
  g.fillRect(chimneyX + Math.round(7 * s), chimneyY, Math.round(3 * s), Math.round(25 * s));
  // Chimney cap
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(
    chimneyX - Math.round(2 * s),
    chimneyY - Math.round(4 * s),
    Math.round(14 * s),
    Math.round(5 * s)
  );
  g.fillStyle(PALETTE.midGray);
  g.fillRect(
    chimneyX - Math.round(2 * s),
    chimneyY - Math.round(4 * s),
    Math.round(14 * s),
    Math.round(1 * s)
  );

  // Large chalkboard sign on facade (DexScreener info)
  const signX = baseX + Math.round(10 * s);
  const signY = baseY + Math.round(8 * s);
  const signW = bWidth - Math.round(20 * s);
  const signH = Math.round(28 * s);
  // Sign frame
  g.fillStyle(0x451a03);
  g.fillRect(
    signX - Math.round(3 * s),
    signY - Math.round(3 * s),
    signW + Math.round(6 * s),
    signH + Math.round(6 * s)
  );
  // Chalkboard background
  g.fillStyle(0x1f2937);
  g.fillRect(signX, signY, signW, signH);
  // Chalk text representation (green lines for DexScreener theme - solid colors)
  g.fillStyle(accent);
  g.fillRect(
    signX + Math.round(5 * s),
    signY + Math.round(5 * s),
    signW - Math.round(10 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    signX + Math.round(5 * s),
    signY + Math.round(12 * s),
    signW - Math.round(15 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    signX + Math.round(5 * s),
    signY + Math.round(18 * s),
    signW - Math.round(12 * s),
    Math.round(2 * s)
  );
  // Checkmarks (small rectangles)
  g.fillRect(
    signX + Math.round(3 * s),
    signY + Math.round(12 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    signX + Math.round(3 * s),
    signY + Math.round(18 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  // Windows (2x2 grid - solid colors, no alpha)
  const windowColor = 0xfbbf24; // Amber glow
  for (let wy = 0; wy < 2; wy++) {
    for (let wx = 0; wx < 2; wx++) {
      const winX = baseX + Math.round(12 * s) + wx * Math.round(22 * s);
      const winY = baseY + Math.round(45 * s) + wy * Math.round(22 * s);
      const winW = Math.round(12 * s);
      const winH = Math.round(16 * s);

      // Window frame (dark wood)
      g.fillStyle(0x451a03);
      g.fillRect(
        winX - Math.round(2 * s),
        winY - Math.round(2 * s),
        winW + Math.round(4 * s),
        winH + Math.round(4 * s)
      );

      // Window glass (solid amber)
      g.fillStyle(windowColor);
      g.fillRect(winX, winY, winW, winH);

      // Window inner glow (lighter amber)
      g.fillStyle(lighten(windowColor, 0.15));
      g.fillRect(
        winX + Math.round(2 * s),
        winY + Math.round(2 * s),
        winW - Math.round(4 * s),
        winH - Math.round(4 * s)
      );

      // Window highlight corner (top-left)
      g.fillStyle(PALETTE.white);
      g.fillRect(
        winX + Math.round(1 * s),
        winY + Math.round(1 * s),
        Math.round(3 * s),
        Math.round(3 * s)
      );

      // Window cross frame
      g.fillStyle(woodDark);
      g.fillRect(winX + winW / 2 - Math.round(1 * s), winY, Math.round(2 * s), winH);
      g.fillRect(winX, winY + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
    }
  }

  // Door (center-bottom, welcoming double door - rectangular, no arch)
  const doorW = Math.round(18 * s);
  const doorH = Math.round(28 * s);
  const doorX = baseX + bWidth / 2 - doorW / 2;
  const doorY = canvasH - doorH;

  // Door frame
  g.fillStyle(0x451a03);
  g.fillRect(
    doorX - Math.round(3 * s),
    doorY - Math.round(5 * s),
    doorW + Math.round(6 * s),
    doorH + Math.round(5 * s)
  );
  g.fillStyle(lighten(0x451a03, 0.15));
  g.fillRect(
    doorX - Math.round(3 * s),
    doorY - Math.round(5 * s),
    doorW + Math.round(6 * s),
    Math.round(2 * s)
  );

  // Double doors
  g.fillStyle(0x5c3317);
  g.fillRect(doorX, doorY, doorW / 2 - Math.round(1 * s), doorH);
  g.fillRect(doorX + doorW / 2 + Math.round(1 * s), doorY, doorW / 2 - Math.round(1 * s), doorH);
  // Door highlight (left edge of each door)
  g.fillStyle(lighten(0x5c3317, 0.12));
  g.fillRect(doorX, doorY, Math.round(2 * s), doorH);
  g.fillRect(doorX + doorW / 2 + Math.round(1 * s), doorY, Math.round(2 * s), doorH);

  // Door panels
  g.fillStyle(darken(0x5c3317, 0.18));
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(3 * s),
    Math.round(5 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(16 * s),
    Math.round(5 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    doorX + doorW / 2 + Math.round(2 * s),
    doorY + Math.round(3 * s),
    Math.round(5 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    doorX + doorW / 2 + Math.round(2 * s),
    doorY + Math.round(16 * s),
    Math.round(5 * s),
    Math.round(10 * s)
  );

  // Door handles
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX + doorW / 2 - Math.round(4 * s),
    doorY + Math.round(14 * s),
    Math.round(2 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    doorX + doorW / 2 + Math.round(2 * s),
    doorY + Math.round(14 * s),
    Math.round(2 * s),
    Math.round(4 * s)
  );

  // Welcome mat
  g.fillStyle(0x78350f);
  g.fillRect(
    doorX - Math.round(4 * s),
    canvasH - Math.round(4 * s),
    doorW + Math.round(8 * s),
    Math.round(4 * s)
  );
  g.fillStyle(lighten(0x78350f, 0.1));
  g.fillRect(
    doorX - Math.round(4 * s),
    canvasH - Math.round(4 * s),
    doorW + Math.round(8 * s),
    Math.round(1 * s)
  );

  // Hanging sign "LEARN" above door
  const hangSignY = doorY - Math.round(15 * s);
  g.fillStyle(0x451a03);
  g.fillRect(doorX + Math.round(2 * s), hangSignY, doorW - Math.round(4 * s), Math.round(10 * s));
  g.fillStyle(accent);
  g.fillRect(
    doorX + Math.round(4 * s),
    hangSignY + Math.round(2 * s),
    doorW - Math.round(8 * s),
    Math.round(6 * s)
  );
  g.fillStyle(lighten(accent, 0.2));
  g.fillRect(
    doorX + Math.round(4 * s),
    hangSignY + Math.round(2 * s),
    doorW - Math.round(8 * s),
    Math.round(1 * s)
  );
  // Hanging chains
  g.fillStyle(PALETTE.midGray);
  g.fillRect(
    doorX + Math.round(4 * s),
    hangSignY - Math.round(5 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  );
  g.fillRect(
    doorX + doorW - Math.round(6 * s),
    hangSignY - Math.round(5 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  );

  g.generateTexture("founders_0", canvasW, canvasH);
  g.destroy();
}

/**
 * Founders Studio - Art/asset creation building
 * REWRITTEN: Proper 16-bit pixel art - no circles, no triangles, no alpha
 */
function generateFoundersStudio(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(75 * s);
  const canvasH = Math.round(130 * s);
  const bWidth = Math.round(60 * s);
  const bHeight = Math.round(80 * s);
  const baseX = Math.round(7 * s);
  const baseY = canvasH - bHeight;

  // Colors - Art studio theme (warmer brown with gold accents)
  const woodBase = 0xa0522d; // Sienna
  const woodLight = lighten(woodBase, 0.2);
  const woodDark = darken(woodBase, 0.25);
  const roofColor = 0x6b4423;
  const roofLight = lighten(roofColor, 0.2);
  const accent = PALETTE.gold;

  // Ground shadow (flat, solid - no alpha)
  g.fillStyle(PALETTE.void);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasH - Math.round(4 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );

  // Main body
  g.fillStyle(woodBase);
  g.fillRect(baseX, baseY, bWidth, bHeight);

  // 3D depth: Light left edge
  g.fillStyle(woodLight);
  g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);
  // 3D depth: Dark right edge
  g.fillStyle(woodDark);
  g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

  // Wood plank texture (brick pattern)
  g.fillStyle(darken(woodBase, 0.1));
  for (let py = 0; py < bHeight; py += Math.round(8 * s)) {
    const offset = (py / Math.round(8 * s)) % 2 === 0 ? 0 : Math.round(6 * s);
    for (
      let px = Math.round(6 * s) + offset;
      px < bWidth - Math.round(6 * s);
      px += Math.round(12 * s)
    ) {
      g.fillRect(baseX + px, baseY + py, Math.round(10 * s), Math.round(6 * s));
    }
  }

  // Gambrel roof (barn-style - stepped rectangles instead of triangles)
  const roofCenterX = baseX + bWidth / 2;
  const roofLeftX = baseX - Math.round(4 * s);
  const roofRightX = baseX + bWidth + Math.round(4 * s);
  const roofW = roofRightX - roofLeftX;

  // Lower roof section (flat bar)
  g.fillStyle(roofColor);
  g.fillRect(roofLeftX, baseY - Math.round(12 * s), roofW, Math.round(12 * s));
  g.fillStyle(roofLight);
  g.fillRect(roofLeftX, baseY - Math.round(12 * s), roofW, Math.round(2 * s));

  // Upper roof (stepped pyramid)
  // Layer 1
  const roof2W = roofW - Math.round(16 * s);
  const roof2X = roofLeftX + Math.round(8 * s);
  g.fillStyle(roofColor);
  g.fillRect(roof2X, baseY - Math.round(22 * s), roof2W, Math.round(10 * s));
  g.fillStyle(roofLight);
  g.fillRect(roof2X, baseY - Math.round(22 * s), roof2W, Math.round(2 * s));

  // Layer 2
  const roof3W = roof2W - Math.round(14 * s);
  const roof3X = roof2X + Math.round(7 * s);
  g.fillStyle(roofColor);
  g.fillRect(roof3X, baseY - Math.round(30 * s), roof3W, Math.round(8 * s));
  g.fillStyle(roofLight);
  g.fillRect(roof3X, baseY - Math.round(30 * s), roof3W, Math.round(2 * s));

  // Roof edge trim
  g.fillStyle(0x78350f);
  g.fillRect(roofLeftX, baseY - Math.round(14 * s), roofW, Math.round(3 * s));
  g.fillStyle(lighten(0x78350f, 0.15));
  g.fillRect(roofLeftX, baseY - Math.round(14 * s), roofW, Math.round(1 * s));

  // Large skylight window in roof (for natural light in studio - solid colors)
  const skylightX = roofCenterX - Math.round(12 * s);
  const skylightY = baseY - Math.round(28 * s);
  g.fillStyle(0x451a03);
  g.fillRect(
    skylightX - Math.round(2 * s),
    skylightY - Math.round(2 * s),
    Math.round(28 * s),
    Math.round(16 * s)
  );
  g.fillStyle(PALETTE.sky);
  g.fillRect(skylightX, skylightY, Math.round(24 * s), Math.round(12 * s));
  g.fillStyle(lighten(PALETTE.sky, 0.25));
  g.fillRect(
    skylightX + Math.round(2 * s),
    skylightY + Math.round(2 * s),
    Math.round(8 * s),
    Math.round(4 * s)
  );
  // Skylight highlight
  g.fillStyle(PALETTE.white);
  g.fillRect(
    skylightX + Math.round(2 * s),
    skylightY + Math.round(2 * s),
    Math.round(3 * s),
    Math.round(2 * s)
  );

  // Easel display on facade (showing canvas shapes)
  const easelX = baseX + Math.round(8 * s);
  const easelY = baseY + Math.round(10 * s);
  // Easel frame
  g.fillStyle(0x451a03);
  g.fillRect(easelX, easelY, Math.round(20 * s), Math.round(25 * s));
  // Canvas on easel - showing square (logo)
  g.fillStyle(0xfef3c7);
  g.fillRect(
    easelX + Math.round(3 * s),
    easelY + Math.round(3 * s),
    Math.round(14 * s),
    Math.round(14 * s)
  );
  // Square indicator (1:1)
  g.fillStyle(accent);
  g.fillRect(
    easelX + Math.round(5 * s),
    easelY + Math.round(5 * s),
    Math.round(10 * s),
    Math.round(10 * s)
  );
  // "1:1" text representation
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(
    easelX + Math.round(8 * s),
    easelY + Math.round(8 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  // Second display showing 3:1 banner
  const bannerX = baseX + Math.round(32 * s);
  g.fillStyle(0x451a03);
  g.fillRect(bannerX, easelY, Math.round(22 * s), Math.round(12 * s));
  g.fillStyle(0xfef3c7);
  g.fillRect(
    bannerX + Math.round(2 * s),
    easelY + Math.round(2 * s),
    Math.round(18 * s),
    Math.round(8 * s)
  );
  g.fillStyle(PALETTE.sky);
  g.fillRect(
    bannerX + Math.round(3 * s),
    easelY + Math.round(3 * s),
    Math.round(16 * s),
    Math.round(6 * s)
  );

  // Windows (solid colors, no alpha)
  const windowColor = 0xfbbf24;
  for (let wx = 0; wx < 2; wx++) {
    const winX = baseX + Math.round(10 * s) + wx * Math.round(25 * s);
    const winY = baseY + Math.round(45 * s);
    const winW = Math.round(15 * s);
    const winH = Math.round(18 * s);

    // Window frame (dark wood)
    g.fillStyle(0x451a03);
    g.fillRect(
      winX - Math.round(2 * s),
      winY - Math.round(2 * s),
      winW + Math.round(4 * s),
      winH + Math.round(4 * s)
    );

    // Window glass (solid amber)
    g.fillStyle(windowColor);
    g.fillRect(winX, winY, winW, winH);

    // Window inner glow (lighter amber)
    g.fillStyle(lighten(windowColor, 0.15));
    g.fillRect(
      winX + Math.round(2 * s),
      winY + Math.round(2 * s),
      winW - Math.round(4 * s),
      winH - Math.round(4 * s)
    );

    // Window highlight corner (top-left)
    g.fillStyle(PALETTE.white);
    g.fillRect(
      winX + Math.round(1 * s),
      winY + Math.round(1 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    // Cross frame
    g.fillStyle(woodDark);
    g.fillRect(winX + winW / 2 - Math.round(1 * s), winY, Math.round(2 * s), winH);
    g.fillRect(winX, winY + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
  }

  // Door
  const doorW = Math.round(14 * s);
  const doorH = Math.round(24 * s);
  const doorX = baseX + bWidth / 2 - doorW / 2;
  const doorY = canvasH - doorH;

  // Door frame
  g.fillStyle(0x451a03);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(3 * s),
    doorW + Math.round(4 * s),
    doorH + Math.round(3 * s)
  );
  g.fillStyle(lighten(0x451a03, 0.15));
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(3 * s),
    doorW + Math.round(4 * s),
    Math.round(2 * s)
  );

  // Door body
  g.fillStyle(0x5c3317);
  g.fillRect(doorX, doorY, doorW, doorH);
  // Door highlight
  g.fillStyle(lighten(0x5c3317, 0.12));
  g.fillRect(doorX, doorY, Math.round(2 * s), doorH);

  // Door panels
  g.fillStyle(darken(0x5c3317, 0.18));
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(3 * s),
    doorW - Math.round(4 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(14 * s),
    doorW - Math.round(4 * s),
    Math.round(8 * s)
  );

  // Door handle
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX + doorW - Math.round(4 * s),
    doorY + Math.round(12 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );

  // "ASSETS" sign above door
  const signY = doorY - Math.round(12 * s);
  g.fillStyle(0x451a03);
  g.fillRect(doorX - Math.round(4 * s), signY, doorW + Math.round(8 * s), Math.round(9 * s));
  g.fillStyle(accent);
  g.fillRect(
    doorX - Math.round(2 * s),
    signY + Math.round(2 * s),
    doorW + Math.round(4 * s),
    Math.round(5 * s)
  );
  g.fillStyle(lighten(accent, 0.2));
  g.fillRect(
    doorX - Math.round(2 * s),
    signY + Math.round(2 * s),
    doorW + Math.round(4 * s),
    Math.round(1 * s)
  );

  // Paint splashes on building exterior (small rectangles instead of circles)
  // Red splash
  g.fillStyle(0xef4444);
  g.fillRect(
    baseX + Math.round(6 * s),
    baseY + Math.round(68 * s),
    Math.round(5 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    baseX + Math.round(7 * s),
    baseY + Math.round(66 * s),
    Math.round(3 * s),
    Math.round(2 * s)
  );
  // Blue splash
  g.fillStyle(0x3b82f6);
  g.fillRect(
    baseX + bWidth - Math.round(12 * s),
    baseY + Math.round(63 * s),
    Math.round(6 * s),
    Math.round(5 * s)
  );
  g.fillRect(
    baseX + bWidth - Math.round(11 * s),
    baseY + Math.round(60 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );
  // Green splash
  g.fillStyle(0x22c55e);
  g.fillRect(
    baseX + Math.round(13 * s),
    baseY + Math.round(73 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );

  g.generateTexture("founders_1", canvasW, canvasH);
  g.destroy();
}

/**
 * Founders Social Hub - Community/social links building
 * REWRITTEN: Proper 16-bit pixel art - no circles, no triangles, no alpha
 */
function generateFoundersSocialHub(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(70 * s);
  const canvasH = Math.round(125 * s);
  const bWidth = Math.round(55 * s);
  const bHeight = Math.round(75 * s);
  const baseX = Math.round(7 * s);
  const baseY = canvasH - bHeight;

  // Colors - Community/social theme (rustic brown with blue accents)
  const woodBase = 0x6b4423;
  const woodLight = lighten(woodBase, 0.2);
  const woodDark = darken(woodBase, 0.25);
  const roofColor = 0x5c3317;
  const roofLight = lighten(roofColor, 0.15);
  const accent = PALETTE.lightBlue;

  // Ground shadow (flat, solid - no alpha)
  g.fillStyle(PALETTE.void);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasH - Math.round(4 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );

  // Main body
  g.fillStyle(woodBase);
  g.fillRect(baseX, baseY, bWidth, bHeight);

  // 3D depth: Light left edge
  g.fillStyle(woodLight);
  g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);
  // 3D depth: Dark right edge
  g.fillStyle(woodDark);
  g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

  // Wood plank texture (brick pattern)
  g.fillStyle(darken(woodBase, 0.1));
  for (let py = 0; py < bHeight; py += Math.round(8 * s)) {
    const offset = (py / Math.round(8 * s)) % 2 === 0 ? 0 : Math.round(6 * s);
    for (
      let px = Math.round(6 * s) + offset;
      px < bWidth - Math.round(6 * s);
      px += Math.round(12 * s)
    ) {
      g.fillRect(baseX + px, baseY + py, Math.round(10 * s), Math.round(6 * s));
    }
  }

  // Flat roof with parapet
  const roofY = baseY - Math.round(8 * s);
  g.fillStyle(roofColor);
  g.fillRect(baseX - Math.round(3 * s), roofY, bWidth + Math.round(6 * s), Math.round(10 * s));
  g.fillStyle(roofLight);
  g.fillRect(baseX - Math.round(3 * s), roofY, bWidth + Math.round(6 * s), Math.round(2 * s));

  // Parapet crenellations
  g.fillStyle(roofColor);
  for (let i = 0; i < 5; i++) {
    g.fillRect(
      baseX - Math.round(2 * s) + i * Math.round(12 * s),
      roofY - Math.round(6 * s),
      Math.round(8 * s),
      Math.round(6 * s)
    );
    g.fillStyle(roofLight);
    g.fillRect(
      baseX - Math.round(2 * s) + i * Math.round(12 * s),
      roofY - Math.round(6 * s),
      Math.round(8 * s),
      Math.round(1 * s)
    );
    g.fillStyle(roofColor);
  }

  // Large bulletin board on facade
  const boardX = baseX + Math.round(6 * s);
  const boardY = baseY + Math.round(8 * s);
  const boardW = bWidth - Math.round(12 * s);
  const boardH = Math.round(30 * s);

  // Cork board frame
  g.fillStyle(0x451a03);
  g.fillRect(
    boardX - Math.round(3 * s),
    boardY - Math.round(3 * s),
    boardW + Math.round(6 * s),
    boardH + Math.round(6 * s)
  );
  g.fillStyle(lighten(0x451a03, 0.15));
  g.fillRect(
    boardX - Math.round(3 * s),
    boardY - Math.round(3 * s),
    boardW + Math.round(6 * s),
    Math.round(2 * s)
  );

  // Cork surface
  g.fillStyle(0xd2b48c);
  g.fillRect(boardX, boardY, boardW, boardH);

  // Cork texture (checkerboard pattern)
  g.fillStyle(darken(0xd2b48c, 0.12));
  for (let py = 0; py < boardH; py += Math.round(6 * s)) {
    const offset = (py / Math.round(6 * s)) % 2 === 0 ? 0 : Math.round(4 * s);
    for (let px = offset; px < boardW; px += Math.round(8 * s)) {
      g.fillRect(boardX + px, boardY + py, Math.round(4 * s), Math.round(4 * s));
    }
  }

  // Pinned notes on bulletin board
  // Twitter/X note (blue)
  g.fillStyle(0x1da1f2);
  g.fillRect(
    boardX + Math.round(4 * s),
    boardY + Math.round(4 * s),
    Math.round(12 * s),
    Math.round(10 * s)
  );
  g.fillStyle(PALETTE.white);
  g.fillRect(
    boardX + Math.round(6 * s),
    boardY + Math.round(7 * s),
    Math.round(8 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    boardX + Math.round(6 * s),
    boardY + Math.round(10 * s),
    Math.round(6 * s),
    Math.round(1 * s)
  );

  // Website note (green)
  g.fillStyle(PALETTE.bagsGreen);
  g.fillRect(
    boardX + Math.round(20 * s),
    boardY + Math.round(6 * s),
    Math.round(12 * s),
    Math.round(10 * s)
  );
  g.fillStyle(PALETTE.white);
  g.fillRect(
    boardX + Math.round(22 * s),
    boardY + Math.round(9 * s),
    Math.round(8 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    boardX + Math.round(22 * s),
    boardY + Math.round(12 * s),
    Math.round(5 * s),
    Math.round(1 * s)
  );

  // Telegram note (blue)
  g.fillStyle(0x0088cc);
  g.fillRect(
    boardX + Math.round(8 * s),
    boardY + Math.round(18 * s),
    Math.round(10 * s),
    Math.round(8 * s)
  );

  // Discord note (purple)
  g.fillStyle(0x5865f2);
  g.fillRect(
    boardX + Math.round(22 * s),
    boardY + Math.round(18 * s),
    Math.round(10 * s),
    Math.round(8 * s)
  );

  // Push pins (small rectangles instead of circles)
  // Red pin
  g.fillStyle(0xef4444);
  g.fillRect(
    boardX + Math.round(9 * s),
    boardY + Math.round(3 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillStyle(lighten(0xef4444, 0.3));
  g.fillRect(
    boardX + Math.round(9 * s),
    boardY + Math.round(3 * s),
    Math.round(1 * s),
    Math.round(1 * s)
  );

  // Yellow pin
  g.fillStyle(0xfbbf24);
  g.fillRect(
    boardX + Math.round(25 * s),
    boardY + Math.round(5 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillStyle(lighten(0xfbbf24, 0.3));
  g.fillRect(
    boardX + Math.round(25 * s),
    boardY + Math.round(5 * s),
    Math.round(1 * s),
    Math.round(1 * s)
  );

  // Green pin
  g.fillStyle(0x22c55e);
  g.fillRect(
    boardX + Math.round(12 * s),
    boardY + Math.round(17 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillStyle(lighten(0x22c55e, 0.3));
  g.fillRect(
    boardX + Math.round(12 * s),
    boardY + Math.round(17 * s),
    Math.round(1 * s),
    Math.round(1 * s)
  );

  // Purple pin
  g.fillStyle(0xa855f7);
  g.fillRect(
    boardX + Math.round(26 * s),
    boardY + Math.round(17 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillStyle(lighten(0xa855f7, 0.3));
  g.fillRect(
    boardX + Math.round(26 * s),
    boardY + Math.round(17 * s),
    Math.round(1 * s),
    Math.round(1 * s)
  );

  // Windows (solid colors, no alpha)
  const windowColor = 0xfbbf24;
  for (let wx = 0; wx < 2; wx++) {
    const winX = baseX + Math.round(8 * s) + wx * Math.round(22 * s);
    const winY = baseY + Math.round(45 * s);
    const winW = Math.round(12 * s);
    const winH = Math.round(16 * s);

    // Window frame
    g.fillStyle(0x451a03);
    g.fillRect(
      winX - Math.round(2 * s),
      winY - Math.round(2 * s),
      winW + Math.round(4 * s),
      winH + Math.round(4 * s)
    );

    // Window glass (solid amber)
    g.fillStyle(windowColor);
    g.fillRect(winX, winY, winW, winH);

    // Window inner glow (lighter amber)
    g.fillStyle(lighten(windowColor, 0.15));
    g.fillRect(
      winX + Math.round(2 * s),
      winY + Math.round(2 * s),
      winW - Math.round(4 * s),
      winH - Math.round(4 * s)
    );

    // Window highlight (top-left corner)
    g.fillStyle(PALETTE.white);
    g.fillRect(
      winX + Math.round(1 * s),
      winY + Math.round(1 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );

    // Window cross divider
    g.fillStyle(woodDark);
    g.fillRect(winX + winW / 2 - Math.round(1 * s), winY, Math.round(2 * s), winH);
  }

  // Door
  const doorW = Math.round(14 * s);
  const doorH = Math.round(22 * s);
  const doorX = baseX + bWidth / 2 - doorW / 2;
  const doorY = canvasH - doorH;

  // Door frame
  g.fillStyle(0x451a03);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(3 * s),
    doorW + Math.round(4 * s),
    doorH + Math.round(3 * s)
  );
  g.fillStyle(lighten(0x451a03, 0.15));
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(3 * s),
    doorW + Math.round(4 * s),
    Math.round(2 * s)
  );

  // Door body
  g.fillStyle(0x5c3317);
  g.fillRect(doorX, doorY, doorW, doorH);
  // Door highlight
  g.fillStyle(lighten(0x5c3317, 0.12));
  g.fillRect(doorX, doorY, Math.round(2 * s), doorH);

  // Door panels
  g.fillStyle(darken(0x5c3317, 0.18));
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(3 * s),
    doorW - Math.round(4 * s),
    Math.round(7 * s)
  );
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(13 * s),
    doorW - Math.round(4 * s),
    Math.round(7 * s)
  );

  // Door handle
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    doorX + doorW - Math.round(4 * s),
    doorY + Math.round(10 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );

  // "CONNECT" sign
  const signY = doorY - Math.round(10 * s);
  g.fillStyle(0x451a03);
  g.fillRect(doorX - Math.round(6 * s), signY, doorW + Math.round(12 * s), Math.round(8 * s));
  g.fillStyle(accent);
  g.fillRect(
    doorX - Math.round(4 * s),
    signY + Math.round(2 * s),
    doorW + Math.round(8 * s),
    Math.round(4 * s)
  );
  g.fillStyle(lighten(accent, 0.2));
  g.fillRect(
    doorX - Math.round(4 * s),
    signY + Math.round(2 * s),
    doorW + Math.round(8 * s),
    Math.round(1 * s)
  );

  // Network connection lines decorating the building (solid colors)
  g.fillStyle(darken(accent, 0.2));
  // Vertical line on left
  g.fillRect(
    baseX + Math.round(3 * s),
    baseY + Math.round(40 * s),
    Math.round(1 * s),
    Math.round(30 * s)
  );
  // Horizontal line to window
  g.fillRect(
    baseX + Math.round(3 * s),
    baseY + Math.round(50 * s),
    Math.round(5 * s),
    Math.round(1 * s)
  );
  // Vertical line on right
  g.fillRect(
    baseX + bWidth - Math.round(4 * s),
    baseY + Math.round(42 * s),
    Math.round(1 * s),
    Math.round(28 * s)
  );

  // Connection nodes (small rectangles instead of circles)
  g.fillStyle(accent);
  // Left node
  g.fillRect(
    baseX + Math.round(2 * s),
    baseY + Math.round(49 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillStyle(lighten(accent, 0.3));
  g.fillRect(
    baseX + Math.round(2 * s),
    baseY + Math.round(49 * s),
    Math.round(1 * s),
    Math.round(1 * s)
  );
  // Right node
  g.fillStyle(accent);
  g.fillRect(
    baseX + bWidth - Math.round(5 * s),
    baseY + Math.round(54 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillStyle(lighten(accent, 0.3));
  g.fillRect(
    baseX + bWidth - Math.round(5 * s),
    baseY + Math.round(54 * s),
    Math.round(1 * s),
    Math.round(1 * s)
  );

  g.generateTexture("founders_2", canvasW, canvasH);
  g.destroy();
}

/**
 * Founders Incinerator Factory - Industrial generator/power plant building
 * Burns tokens & closes empty accounts. Dark metal with fire/furnace glow.
 * Upgraded: wider building, taller stack, toxic barrels, gauge panel, warning lights
 */
function generateFoundersIncinerator(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(130 * s);
  const canvasH = Math.round(185 * s);
  const bWidth = Math.round(90 * s);
  const bHeight = Math.round(110 * s);
  const baseX = Math.round(18 * s);
  const baseY = canvasH - bHeight;

  // Green monochrome palette (Game Boy style)
  const inkBlack = 0x0a1a0a;
  const darkGreen = 0x1a4a1a;
  const medGreen = 0x2d6b2d;
  const brightGreen = 0x4ade80;
  const limeGreen = 0xa3e635;
  const neonGreen = 0x22c55e;
  const fireOrange = 0xff6b00;
  const fireYellow = 0xfbbf24;

  // Ground shadow
  g.fillStyle(inkBlack);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasH - Math.round(4 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );

  // Main body
  g.fillStyle(darkGreen);
  g.fillRect(baseX, baseY, bWidth, bHeight);

  // 3D depth: Light left edge
  g.fillStyle(medGreen);
  g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);

  // 3D depth: Dark right edge
  g.fillStyle(inkBlack);
  g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

  // Panel grid texture
  g.fillStyle(0x1e5e1e);
  for (let py = 0; py < bHeight; py += Math.round(10 * s)) {
    const offset = (py / Math.round(10 * s)) % 2 === 0 ? 0 : Math.round(7 * s);
    for (
      let px = Math.round(6 * s) + offset;
      px < bWidth - Math.round(6 * s);
      px += Math.round(14 * s)
    ) {
      g.fillRect(baseX + px, baseY + py, Math.round(12 * s), Math.round(8 * s));
    }
  }

  // Horizontal seam lines with rivets
  g.fillStyle(inkBlack);
  for (let py = Math.round(20 * s); py < bHeight; py += Math.round(22 * s)) {
    g.fillRect(
      baseX + Math.round(5 * s),
      baseY + py,
      bWidth - Math.round(10 * s),
      Math.round(1 * s)
    );
    // Rivet dots
    g.fillStyle(neonGreen);
    for (let rx = Math.round(10 * s); rx < bWidth - Math.round(10 * s); rx += Math.round(12 * s)) {
      g.fillRect(baseX + rx, baseY + py - Math.round(1 * s), Math.round(3 * s), Math.round(3 * s));
    }
    g.fillStyle(inkBlack);
  }

  // === INDUSTRIAL ROOF (stepped green machinery) ===
  const roofW1 = bWidth + Math.round(10 * s);
  const roofX1 = baseX - Math.round(5 * s);

  // Roof layer 1 (eaves)
  g.fillStyle(medGreen);
  g.fillRect(roofX1, baseY - Math.round(8 * s), roofW1, Math.round(8 * s));
  g.fillStyle(neonGreen);
  g.fillRect(roofX1, baseY - Math.round(8 * s), roofW1, Math.round(2 * s));

  // Roof layer 2
  const roofW2 = roofW1 - Math.round(14 * s);
  const roofX2 = roofX1 + Math.round(7 * s);
  g.fillStyle(darkGreen);
  g.fillRect(roofX2, baseY - Math.round(15 * s), roofW2, Math.round(7 * s));
  g.fillStyle(medGreen);
  g.fillRect(roofX2, baseY - Math.round(15 * s), roofW2, Math.round(2 * s));

  // Roof machinery blocks
  g.fillStyle(medGreen);
  g.fillRect(
    roofX2 + Math.round(4 * s),
    baseY - Math.round(22 * s),
    Math.round(16 * s),
    Math.round(7 * s)
  );
  g.fillStyle(darkGreen);
  g.fillRect(
    roofX2 + roofW2 - Math.round(20 * s),
    baseY - Math.round(20 * s),
    Math.round(14 * s),
    Math.round(5 * s)
  );

  // Roof ventilation unit (right side)
  g.fillStyle(medGreen);
  g.fillRect(
    roofX2 + roofW2 - Math.round(10 * s),
    baseY - Math.round(26 * s),
    Math.round(10 * s),
    Math.round(6 * s)
  );
  g.fillStyle(neonGreen);
  // Vent slats
  for (let vy = 0; vy < 3; vy++) {
    g.fillRect(
      roofX2 + roofW2 - Math.round(9 * s),
      baseY - Math.round(25 * s) + vy * Math.round(2 * s),
      Math.round(8 * s),
      Math.round(1 * s)
    );
  }

  // === DUAL SMOKESTACKS ===
  // Main large stack (left-center)
  const stackW = Math.round(20 * s);
  const stackH = Math.round(60 * s);
  const stackX = baseX + Math.round(20 * s);
  const stackY = baseY - Math.round(15 * s) - stackH;

  g.fillStyle(medGreen);
  g.fillRect(stackX, stackY, stackW, stackH);
  g.fillStyle(neonGreen);
  g.fillRect(stackX, stackY, Math.round(4 * s), stackH);
  g.fillStyle(inkBlack);
  g.fillRect(stackX + stackW - Math.round(4 * s), stackY, Math.round(4 * s), stackH);
  // Band details
  g.fillStyle(darkGreen);
  g.fillRect(stackX, stackY + Math.round(15 * s), stackW, Math.round(3 * s));
  g.fillRect(stackX, stackY + Math.round(35 * s), stackW, Math.round(3 * s));

  // Main stack flared cap
  const capW = stackW + Math.round(10 * s);
  g.fillStyle(darkGreen);
  g.fillRect(stackX - Math.round(5 * s), stackY - Math.round(6 * s), capW, Math.round(7 * s));
  g.fillStyle(brightGreen);
  g.fillRect(stackX - Math.round(5 * s), stackY - Math.round(6 * s), capW, Math.round(2 * s));

  // Secondary smaller stack (right-center)
  const stack2W = Math.round(12 * s);
  const stack2H = Math.round(42 * s);
  const stack2X = baseX + Math.round(58 * s);
  const stack2Y = baseY - Math.round(15 * s) - stack2H;

  g.fillStyle(medGreen);
  g.fillRect(stack2X, stack2Y, stack2W, stack2H);
  g.fillStyle(neonGreen);
  g.fillRect(stack2X, stack2Y, Math.round(3 * s), stack2H);
  g.fillStyle(inkBlack);
  g.fillRect(stack2X + stack2W - Math.round(3 * s), stack2Y, Math.round(3 * s), stack2H);
  // Band
  g.fillStyle(darkGreen);
  g.fillRect(stack2X, stack2Y + Math.round(12 * s), stack2W, Math.round(2 * s));
  // Cap
  const cap2W = stack2W + Math.round(6 * s);
  g.fillStyle(darkGreen);
  g.fillRect(stack2X - Math.round(3 * s), stack2Y - Math.round(4 * s), cap2W, Math.round(5 * s));
  g.fillStyle(brightGreen);
  g.fillRect(stack2X - Math.round(3 * s), stack2Y - Math.round(4 * s), cap2W, Math.round(2 * s));

  // === SMOKE PUFFS from main stack ===
  g.fillStyle(neonGreen);
  g.fillRect(
    stackX + Math.round(2 * s),
    stackY - Math.round(14 * s),
    Math.round(16 * s),
    Math.round(8 * s)
  );
  g.fillStyle(brightGreen);
  g.fillRect(
    stackX - Math.round(2 * s),
    stackY - Math.round(23 * s),
    Math.round(12 * s),
    Math.round(7 * s)
  );
  g.fillRect(
    stackX + Math.round(10 * s),
    stackY - Math.round(21 * s),
    Math.round(10 * s),
    Math.round(5 * s)
  );
  g.fillStyle(limeGreen);
  g.fillRect(
    stackX - Math.round(4 * s),
    stackY - Math.round(31 * s),
    Math.round(8 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    stackX + Math.round(8 * s),
    stackY - Math.round(29 * s),
    Math.round(10 * s),
    Math.round(5 * s)
  );
  g.fillStyle(0xd9f99d);
  g.fillRect(
    stackX + Math.round(1 * s),
    stackY - Math.round(37 * s),
    Math.round(6 * s),
    Math.round(4 * s)
  );

  // Smoke from secondary stack (smaller puffs)
  g.fillStyle(neonGreen);
  g.fillRect(
    stack2X + Math.round(1 * s),
    stack2Y - Math.round(10 * s),
    Math.round(10 * s),
    Math.round(5 * s)
  );
  g.fillStyle(brightGreen);
  g.fillRect(
    stack2X - Math.round(1 * s),
    stack2Y - Math.round(16 * s),
    Math.round(8 * s),
    Math.round(4 * s)
  );

  // === LARGE ARCHED DOORWAY with furnace glow ===
  const doorW = Math.round(32 * s);
  const doorH = Math.round(36 * s);
  const doorX = baseX + bWidth / 2 - doorW / 2;
  const doorY = canvasH - doorH;

  // Door frame
  g.fillStyle(inkBlack);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(5 * s),
    doorW + Math.round(8 * s),
    doorH + Math.round(5 * s)
  );
  // Arch top (stepped pixels)
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(8 * s),
    doorW + Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY - Math.round(10 * s),
    doorW - Math.round(4 * s),
    Math.round(3 * s)
  );

  // Door interior (furnace glow - orange/yellow core)
  g.fillStyle(0x0d2b0d);
  g.fillRect(doorX, doorY, doorW, doorH);
  g.fillStyle(darkGreen);
  g.fillRect(
    doorX + Math.round(3 * s),
    doorY + Math.round(4 * s),
    doorW - Math.round(6 * s),
    doorH - Math.round(4 * s)
  );
  // Inner furnace glow (orange/yellow)
  g.fillStyle(fireOrange);
  g.fillRect(
    doorX + Math.round(6 * s),
    doorY + Math.round(10 * s),
    doorW - Math.round(12 * s),
    doorH - Math.round(14 * s)
  );
  g.fillStyle(fireYellow);
  g.fillRect(
    doorX + Math.round(10 * s),
    doorY + Math.round(14 * s),
    doorW - Math.round(20 * s),
    doorH - Math.round(22 * s)
  );

  // Horizontal grate bars across doorway
  g.fillStyle(inkBlack);
  for (let gy = Math.round(6 * s); gy < doorH; gy += Math.round(7 * s)) {
    g.fillRect(doorX, doorY + gy, doorW, Math.round(2 * s));
  }
  // Vertical center bar
  g.fillRect(doorX + doorW / 2 - Math.round(1 * s), doorY, Math.round(2 * s), doorH);

  // === PIPES on left side (double pipe) ===
  const pipeX = baseX - Math.round(5 * s);
  // Main pipe
  g.fillStyle(medGreen);
  g.fillRect(pipeX, baseY + Math.round(15 * s), Math.round(6 * s), Math.round(60 * s));
  g.fillStyle(brightGreen);
  g.fillRect(pipeX, baseY + Math.round(15 * s), Math.round(2 * s), Math.round(60 * s));
  // Second pipe (thinner)
  g.fillStyle(medGreen);
  g.fillRect(
    pipeX - Math.round(5 * s),
    baseY + Math.round(30 * s),
    Math.round(4 * s),
    Math.round(40 * s)
  );
  g.fillStyle(neonGreen);
  g.fillRect(
    pipeX - Math.round(5 * s),
    baseY + Math.round(30 * s),
    Math.round(1 * s),
    Math.round(40 * s)
  );
  // Pipe joints
  g.fillStyle(neonGreen);
  g.fillRect(
    pipeX - Math.round(1 * s),
    baseY + Math.round(25 * s),
    Math.round(8 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    pipeX - Math.round(1 * s),
    baseY + Math.round(50 * s),
    Math.round(8 * s),
    Math.round(4 * s)
  );
  // Pipe connecting to roof
  g.fillStyle(medGreen);
  g.fillRect(
    pipeX + Math.round(1 * s),
    baseY - Math.round(8 * s),
    Math.round(4 * s),
    Math.round(23 * s)
  );

  // === LADDER on right side ===
  const ladderX = baseX + bWidth - Math.round(2 * s);
  const ladderTop = baseY + Math.round(10 * s);
  const ladderBot = canvasH - Math.round(6 * s);
  g.fillStyle(neonGreen);
  g.fillRect(ladderX, ladderTop, Math.round(2 * s), ladderBot - ladderTop);
  g.fillRect(ladderX + Math.round(8 * s), ladderTop, Math.round(2 * s), ladderBot - ladderTop);
  g.fillStyle(brightGreen);
  for (let ry = ladderTop; ry < ladderBot; ry += Math.round(8 * s)) {
    g.fillRect(ladderX, ry, Math.round(10 * s), Math.round(2 * s));
  }

  // === INDUSTRIAL WINDOWS (3 windows, green glow) ===
  for (let wx = 0; wx < 3; wx++) {
    const winX = baseX + Math.round(10 * s) + wx * Math.round(28 * s);
    const winY = baseY + Math.round(12 * s);
    const winW = Math.round(14 * s);
    const winH = Math.round(10 * s);

    g.fillStyle(inkBlack);
    g.fillRect(
      winX - Math.round(2 * s),
      winY - Math.round(2 * s),
      winW + Math.round(4 * s),
      winH + Math.round(4 * s)
    );
    g.fillStyle(neonGreen);
    g.fillRect(winX, winY, winW, winH);
    g.fillStyle(brightGreen);
    g.fillRect(
      winX + Math.round(2 * s),
      winY + Math.round(2 * s),
      winW - Math.round(4 * s),
      winH - Math.round(4 * s)
    );
    g.fillStyle(limeGreen);
    g.fillRect(
      winX + Math.round(1 * s),
      winY + Math.round(1 * s),
      Math.round(3 * s),
      Math.round(2 * s)
    );
    g.fillStyle(inkBlack);
    g.fillRect(winX + winW / 2 - Math.round(1 * s), winY, Math.round(2 * s), winH);
    g.fillRect(winX, winY + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
  }

  // === GAUGE CONTROL PANEL (between windows and door) ===
  const panelX = baseX + Math.round(8 * s);
  const panelY = baseY + Math.round(30 * s);
  const panelW = Math.round(26 * s);
  const panelH = Math.round(18 * s);
  // Panel background
  g.fillStyle(inkBlack);
  g.fillRect(
    panelX - Math.round(2 * s),
    panelY - Math.round(2 * s),
    panelW + Math.round(4 * s),
    panelH + Math.round(4 * s)
  );
  g.fillStyle(0x0d2b0d);
  g.fillRect(panelX, panelY, panelW, panelH);
  // Gauge circles (square pixel style)
  g.fillStyle(neonGreen);
  g.fillRect(
    panelX + Math.round(3 * s),
    panelY + Math.round(3 * s),
    Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillStyle(brightGreen);
  g.fillRect(
    panelX + Math.round(4 * s),
    panelY + Math.round(4 * s),
    Math.round(6 * s),
    Math.round(6 * s)
  );
  g.fillStyle(inkBlack);
  g.fillRect(
    panelX + Math.round(5 * s),
    panelY + Math.round(5 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  // Gauge needle
  g.fillStyle(fireOrange);
  g.fillRect(
    panelX + Math.round(7 * s),
    panelY + Math.round(4 * s),
    Math.round(1 * s),
    Math.round(4 * s)
  );
  // Second gauge
  g.fillStyle(neonGreen);
  g.fillRect(
    panelX + Math.round(14 * s),
    panelY + Math.round(3 * s),
    Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillStyle(brightGreen);
  g.fillRect(
    panelX + Math.round(15 * s),
    panelY + Math.round(4 * s),
    Math.round(6 * s),
    Math.round(6 * s)
  );
  g.fillStyle(inkBlack);
  g.fillRect(
    panelX + Math.round(16 * s),
    panelY + Math.round(5 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillStyle(neonGreen);
  g.fillRect(
    panelX + Math.round(17 * s),
    panelY + Math.round(5 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );
  // Status LEDs under gauges
  g.fillStyle(neonGreen);
  g.fillRect(
    panelX + Math.round(5 * s),
    panelY + Math.round(13 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillStyle(fireOrange);
  g.fillRect(
    panelX + Math.round(11 * s),
    panelY + Math.round(13 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillStyle(neonGreen);
  g.fillRect(
    panelX + Math.round(17 * s),
    panelY + Math.round(13 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );

  // === WARNING LIGHTS (on facade, flanking door) ===
  // Left warning light
  g.fillStyle(fireOrange);
  g.fillRect(
    doorX - Math.round(14 * s),
    doorY - Math.round(4 * s),
    Math.round(6 * s),
    Math.round(6 * s)
  );
  g.fillStyle(fireYellow);
  g.fillRect(
    doorX - Math.round(13 * s),
    doorY - Math.round(3 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  // Right warning light
  g.fillStyle(fireOrange);
  g.fillRect(
    doorX + doorW + Math.round(8 * s),
    doorY - Math.round(4 * s),
    Math.round(6 * s),
    Math.round(6 * s)
  );
  g.fillStyle(fireYellow);
  g.fillRect(
    doorX + doorW + Math.round(9 * s),
    doorY - Math.round(3 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  // === HAZARD SIGN (green themed) ===
  const signX = baseX + bWidth / 2 - Math.round(18 * s);
  const signY = doorY - Math.round(22 * s);
  const signW = Math.round(36 * s);
  const signH = Math.round(10 * s);
  g.fillStyle(neonGreen);
  g.fillRect(signX, signY, signW, signH);
  g.fillStyle(inkBlack);
  for (let sx = 0; sx < signW; sx += Math.round(8 * s)) {
    g.fillRect(signX + sx, signY, Math.round(4 * s), signH);
  }
  g.fillStyle(brightGreen);
  g.fillRect(signX, signY, signW, Math.round(1 * s));
  g.fillRect(signX, signY + signH - Math.round(1 * s), signW, Math.round(1 * s));

  // === TOXIC WASTE BARRELS at base ===
  const barrelColors = [medGreen, darkGreen];
  const barrelPositions = [
    baseX - Math.round(10 * s),
    baseX + bWidth + Math.round(2 * s),
    baseX + bWidth + Math.round(14 * s),
  ];
  barrelPositions.forEach((bx, i) => {
    const bw = Math.round(10 * s);
    const bh = Math.round(14 * s);
    const by = canvasH - bh;
    // Barrel body
    g.fillStyle(barrelColors[i % 2]);
    g.fillRect(bx, by, bw, bh);
    // Barrel highlight
    g.fillStyle(neonGreen);
    g.fillRect(bx, by, Math.round(2 * s), bh);
    // Barrel bands
    g.fillStyle(inkBlack);
    g.fillRect(bx, by + Math.round(3 * s), bw, Math.round(1 * s));
    g.fillRect(bx, by + bh - Math.round(4 * s), bw, Math.round(1 * s));
    // Hazard symbol (small rectangle)
    g.fillStyle(fireOrange);
    g.fillRect(
      bx + Math.round(3 * s),
      by + Math.round(5 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );
    g.fillStyle(fireYellow);
    g.fillRect(
      bx + Math.round(4 * s),
      by + Math.round(6 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );
  });

  // === DEBRIS / RUBBLE at base ===
  g.fillStyle(medGreen);
  g.fillRect(
    baseX - Math.round(6 * s),
    canvasH - Math.round(6 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    baseX + Math.round(2 * s),
    canvasH - Math.round(3 * s),
    Math.round(3 * s),
    Math.round(2 * s)
  );
  g.fillStyle(darkGreen);
  g.fillRect(
    baseX + bWidth - Math.round(4 * s),
    canvasH - Math.round(3 * s),
    Math.round(4 * s),
    Math.round(2 * s)
  );

  g.generateTexture("founders_3", canvasW, canvasH);
  g.destroy();
}

/**
 * Incinerator garbage truck - green monochrome pixel art
 * Parked outside the Sol Incinerator factory
 */
function generateIncineratorTruck(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(100 * s);
  const canvasH = Math.round(52 * s);

  // Green monochrome palette (matching incinerator factory)
  const inkBlack = 0x0a1a0a;
  const darkGreen = 0x1a4a1a;
  const medGreen = 0x2d6b2d;
  const brightGreen = 0x4ade80;
  const neonGreen = 0x22c55e;

  // === WHEELS ===
  const wheelR = Math.round(7 * s);
  const wheelY = canvasH - wheelR;
  // Rear wheel
  const rearWheelX = Math.round(22 * s);
  g.fillStyle(inkBlack);
  g.fillRect(rearWheelX - wheelR, wheelY - wheelR, wheelR * 2, wheelR * 2);
  g.fillStyle(darkGreen);
  g.fillRect(
    rearWheelX - wheelR + Math.round(2 * s),
    wheelY - wheelR + Math.round(2 * s),
    wheelR * 2 - Math.round(4 * s),
    wheelR * 2 - Math.round(4 * s)
  );
  g.fillStyle(medGreen);
  g.fillRect(
    rearWheelX - Math.round(2 * s),
    wheelY - Math.round(2 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  // Front wheel
  const frontWheelX = Math.round(78 * s);
  g.fillStyle(inkBlack);
  g.fillRect(frontWheelX - wheelR, wheelY - wheelR, wheelR * 2, wheelR * 2);
  g.fillStyle(darkGreen);
  g.fillRect(
    frontWheelX - wheelR + Math.round(2 * s),
    wheelY - wheelR + Math.round(2 * s),
    wheelR * 2 - Math.round(4 * s),
    wheelR * 2 - Math.round(4 * s)
  );
  g.fillStyle(medGreen);
  g.fillRect(
    frontWheelX - Math.round(2 * s),
    wheelY - Math.round(2 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  // === CHASSIS (undercarriage) ===
  const chassisY = canvasH - Math.round(16 * s);
  g.fillStyle(darkGreen);
  g.fillRect(Math.round(8 * s), chassisY, Math.round(82 * s), Math.round(4 * s));

  // === CARGO BOX (left side - large box) ===
  const cargoX = Math.round(4 * s);
  const cargoW = Math.round(56 * s);
  const cargoH = Math.round(28 * s);
  const cargoY = chassisY - cargoH;

  // Cargo body
  g.fillStyle(medGreen);
  g.fillRect(cargoX, cargoY, cargoW, cargoH);
  // Left edge highlight
  g.fillStyle(brightGreen);
  g.fillRect(cargoX, cargoY, Math.round(3 * s), cargoH);
  // Right edge shadow
  g.fillStyle(darkGreen);
  g.fillRect(cargoX + cargoW - Math.round(3 * s), cargoY, Math.round(3 * s), cargoH);
  // Top edge highlight
  g.fillStyle(neonGreen);
  g.fillRect(cargoX, cargoY, cargoW, Math.round(2 * s));
  // Bottom edge
  g.fillStyle(inkBlack);
  g.fillRect(cargoX, cargoY + cargoH - Math.round(1 * s), cargoW, Math.round(1 * s));

  // Cargo panel seams
  g.fillStyle(darkGreen);
  g.fillRect(
    cargoX + Math.round(18 * s),
    cargoY + Math.round(3 * s),
    Math.round(1 * s),
    cargoH - Math.round(6 * s)
  );
  g.fillRect(
    cargoX + Math.round(38 * s),
    cargoY + Math.round(3 * s),
    Math.round(1 * s),
    cargoH - Math.round(6 * s)
  );

  // "RUGS SCAMS TRASH" text as pixel blocks on cargo side
  // Row 1: "RUGS" - simple 3-wide pixel letters, spaced across top area
  const textY1 = cargoY + Math.round(7 * s);
  const textY2 = cargoY + Math.round(14 * s);
  const textY3 = cargoY + Math.round(21 * s);
  const px = Math.round(1 * s); // pixel unit

  g.fillStyle(neonGreen);
  // "RUGS" centered on cargo
  const rugsX = cargoX + Math.round(8 * s);
  // R
  g.fillRect(rugsX, textY1, px * 2, px * 4);
  g.fillRect(rugsX + px * 2, textY1, px, px);
  g.fillRect(rugsX + px * 2, textY1 + px * 2, px, px);
  g.fillRect(rugsX + px * 2, textY1 + px * 3, px, px);
  // U
  g.fillRect(rugsX + px * 4, textY1, px, px * 4);
  g.fillRect(rugsX + px * 6, textY1, px, px * 4);
  g.fillRect(rugsX + px * 5, textY1 + px * 3, px, px);
  // G
  g.fillRect(rugsX + px * 8, textY1, px, px * 4);
  g.fillRect(rugsX + px * 9, textY1, px * 2, px);
  g.fillRect(rugsX + px * 9, textY1 + px * 3, px * 2, px);
  g.fillRect(rugsX + px * 10, textY1 + px * 2, px, px * 2);
  // S
  g.fillRect(rugsX + px * 12, textY1, px * 3, px);
  g.fillRect(rugsX + px * 12, textY1 + px, px, px);
  g.fillRect(rugsX + px * 12, textY1 + px * 2, px * 3, px);
  g.fillRect(rugsX + px * 14, textY1 + px * 3, px, px);
  g.fillRect(rugsX + px * 12, textY1 + px * 4, px * 3, px);

  // "SCAMS" centered
  const scamsX = cargoX + Math.round(6 * s);
  // S
  g.fillRect(scamsX, textY2, px * 3, px);
  g.fillRect(scamsX, textY2 + px, px, px);
  g.fillRect(scamsX, textY2 + px * 2, px * 3, px);
  g.fillRect(scamsX + px * 2, textY2 + px * 3, px, px);
  g.fillRect(scamsX, textY2 + px * 4, px * 3, px);
  // C
  g.fillRect(scamsX + px * 4, textY2, px * 3, px);
  g.fillRect(scamsX + px * 4, textY2 + px, px, px * 3);
  g.fillRect(scamsX + px * 4, textY2 + px * 4, px * 3, px);
  // A
  g.fillRect(scamsX + px * 8, textY2 + px, px, px * 4);
  g.fillRect(scamsX + px * 9, textY2, px, px);
  g.fillRect(scamsX + px * 10, textY2 + px, px, px * 4);
  g.fillRect(scamsX + px * 8, textY2 + px * 2, px * 3, px);
  // M
  g.fillRect(scamsX + px * 12, textY2, px, px * 5);
  g.fillRect(scamsX + px * 13, textY2 + px, px, px);
  g.fillRect(scamsX + px * 14, textY2, px, px * 5);
  // S
  g.fillRect(scamsX + px * 16, textY2, px * 3, px);
  g.fillRect(scamsX + px * 16, textY2 + px, px, px);
  g.fillRect(scamsX + px * 16, textY2 + px * 2, px * 3, px);
  g.fillRect(scamsX + px * 18, textY2 + px * 3, px, px);
  g.fillRect(scamsX + px * 16, textY2 + px * 4, px * 3, px);

  // "TRASH" centered
  const trashX = cargoX + Math.round(6 * s);
  // T
  g.fillRect(trashX, textY3, px * 3, px);
  g.fillRect(trashX + px, textY3 + px, px, px * 4);
  // R
  g.fillRect(trashX + px * 4, textY3, px, px * 5);
  g.fillRect(trashX + px * 5, textY3, px, px);
  g.fillRect(trashX + px * 5, textY3 + px * 2, px, px);
  g.fillRect(trashX + px * 5, textY3 + px * 3, px, px * 2);
  // A
  g.fillRect(trashX + px * 7, textY3 + px, px, px * 4);
  g.fillRect(trashX + px * 8, textY3, px, px);
  g.fillRect(trashX + px * 9, textY3 + px, px, px * 4);
  g.fillRect(trashX + px * 7, textY3 + px * 2, px * 3, px);
  // S
  g.fillRect(trashX + px * 11, textY3, px * 3, px);
  g.fillRect(trashX + px * 11, textY3 + px, px, px);
  g.fillRect(trashX + px * 11, textY3 + px * 2, px * 3, px);
  g.fillRect(trashX + px * 13, textY3 + px * 3, px, px);
  g.fillRect(trashX + px * 11, textY3 + px * 4, px * 3, px);
  // H
  g.fillRect(trashX + px * 15, textY3, px, px * 5);
  g.fillRect(trashX + px * 17, textY3, px, px * 5);
  g.fillRect(trashX + px * 15, textY3 + px * 2, px * 3, px);

  // === CAB (right side) ===
  const cabX = cargoX + cargoW;
  const cabW = Math.round(30 * s);
  const cabH = Math.round(22 * s);
  const cabY = chassisY - cabH;

  // Cab body
  g.fillStyle(medGreen);
  g.fillRect(cabX, cabY, cabW, cabH);
  // Left edge (continuation from cargo)
  g.fillStyle(darkGreen);
  g.fillRect(cabX, cabY, Math.round(2 * s), cabH);
  // Right edge
  g.fillStyle(darkGreen);
  g.fillRect(cabX + cabW - Math.round(3 * s), cabY, Math.round(3 * s), cabH);
  // Top edge highlight
  g.fillStyle(neonGreen);
  g.fillRect(cabX, cabY, cabW, Math.round(2 * s));

  // Windshield
  const windX = cabX + Math.round(16 * s);
  const windY = cabY + Math.round(4 * s);
  const windW = Math.round(10 * s);
  const windH = Math.round(10 * s);
  g.fillStyle(inkBlack);
  g.fillRect(
    windX - Math.round(1 * s),
    windY - Math.round(1 * s),
    windW + Math.round(2 * s),
    windH + Math.round(2 * s)
  );
  g.fillStyle(neonGreen);
  g.fillRect(windX, windY, windW, windH);
  g.fillStyle(brightGreen);
  g.fillRect(windX + Math.round(1 * s), windY + Math.round(1 * s), Math.round(3 * s), px * 2);

  // Side window on cab
  const sideWinX = cabX + Math.round(4 * s);
  const sideWinY = cabY + Math.round(5 * s);
  g.fillStyle(inkBlack);
  g.fillRect(sideWinX - px, sideWinY - px, Math.round(8 * s) + px * 2, Math.round(8 * s) + px * 2);
  g.fillStyle(neonGreen);
  g.fillRect(sideWinX, sideWinY, Math.round(8 * s), Math.round(8 * s));
  g.fillStyle(brightGreen);
  g.fillRect(sideWinX + px, sideWinY + px, Math.round(2 * s), px);

  // Front bumper
  g.fillStyle(darkGreen);
  g.fillRect(cabX + cabW - Math.round(4 * s), chassisY, Math.round(6 * s), Math.round(4 * s));
  g.fillStyle(neonGreen);
  g.fillRect(
    cabX + cabW - Math.round(2 * s),
    chassisY + Math.round(1 * s),
    Math.round(3 * s),
    Math.round(2 * s)
  );

  // Ground shadow
  g.fillStyle(inkBlack);
  g.fillRect(Math.round(6 * s), canvasH - Math.round(2 * s), Math.round(86 * s), Math.round(2 * s));

  g.generateTexture("incinerator_truck", canvasW, canvasH);
  g.destroy();
}

function generateFoundersProps(scene: Phaser.Scene): void {
  const s = SCALE;

  // Workbench
  generateFoundersWorkbench(scene, s);

  // Easel
  generateFoundersEasel(scene, s);

  // Lantern (warm amber)
  generateFoundersLantern(scene, s);

  // Wooden crate
  generateFoundersCrate(scene, s);

  // Chalkboard sign
  generateFoundersChalkboardSign(scene, s);
}

function generateFoundersWorkbench(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const width = Math.round(40 * s);
  const height = Math.round(30 * s);

  // Legs
  g.fillStyle(0x5c3317);
  g.fillRect(Math.round(3 * s), Math.round(18 * s), Math.round(5 * s), Math.round(12 * s));
  g.fillRect(width - Math.round(8 * s), Math.round(18 * s), Math.round(5 * s), Math.round(12 * s));

  // Table top
  g.fillStyle(0x8b4513);
  g.fillRect(0, Math.round(12 * s), width, Math.round(8 * s));
  // Top highlight
  g.fillStyle(lighten(0x8b4513, 0.15));
  g.fillRect(0, Math.round(12 * s), width, Math.round(2 * s));
  // Wood grain lines
  g.fillStyle(darken(0x8b4513, 0.1));
  g.fillRect(Math.round(5 * s), Math.round(14 * s), Math.round(30 * s), Math.round(1 * s));
  g.fillRect(Math.round(8 * s), Math.round(17 * s), Math.round(25 * s), Math.round(1 * s));

  // Tools on workbench
  // Hammer
  g.fillStyle(0x78716c);
  g.fillRect(Math.round(8 * s), Math.round(8 * s), Math.round(3 * s), Math.round(6 * s));
  g.fillStyle(0x5c3317);
  g.fillRect(Math.round(8 * s), Math.round(6 * s), Math.round(8 * s), Math.round(3 * s));

  // Blueprint roll
  g.fillStyle(0x60a5fa);
  g.fillRect(Math.round(20 * s), Math.round(8 * s), Math.round(12 * s), Math.round(5 * s));
  g.fillStyle(lighten(0x60a5fa, 0.2));
  g.fillRect(Math.round(20 * s), Math.round(8 * s), Math.round(12 * s), Math.round(1 * s));

  // Small box/container
  g.fillStyle(0x78350f);
  g.fillRect(Math.round(5 * s), Math.round(0 * s), Math.round(8 * s), Math.round(8 * s));
  g.fillStyle(lighten(0x78350f, 0.1));
  g.fillRect(Math.round(5 * s), Math.round(0 * s), Math.round(8 * s), Math.round(2 * s));

  g.generateTexture("founders_workbench", width, height);
  g.destroy();
}

function generateFoundersEasel(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const width = Math.round(28 * s);
  const height = Math.round(45 * s);

  // Easel legs (A-frame)
  g.fillStyle(0x5c3317);
  // Left leg
  g.fillRect(Math.round(4 * s), Math.round(10 * s), Math.round(3 * s), Math.round(35 * s));
  // Right leg
  g.fillRect(width - Math.round(7 * s), Math.round(10 * s), Math.round(3 * s), Math.round(35 * s));
  // Back leg (partially visible)
  g.fillStyle(darken(0x5c3317, 0.2));
  g.fillRect(Math.round(12 * s), Math.round(15 * s), Math.round(3 * s), Math.round(30 * s));

  // Cross bar
  g.fillStyle(0x5c3317);
  g.fillRect(Math.round(4 * s), Math.round(30 * s), width - Math.round(8 * s), Math.round(3 * s));

  // Canvas holder ledge
  g.fillStyle(0x78350f);
  g.fillRect(Math.round(2 * s), Math.round(25 * s), width - Math.round(4 * s), Math.round(4 * s));

  // Canvas on easel
  g.fillStyle(0xfef3c7);
  g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(18 * s), Math.round(22 * s));
  // Canvas frame
  g.fillStyle(0x78350f);
  g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(18 * s), Math.round(2 * s));
  g.fillRect(Math.round(5 * s), Math.round(23 * s), Math.round(18 * s), Math.round(2 * s));
  g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(2 * s), Math.round(22 * s));
  g.fillRect(Math.round(21 * s), Math.round(3 * s), Math.round(2 * s), Math.round(22 * s));

  // Simple artwork on canvas (abstract shapes)
  g.fillStyle(PALETTE.bagsGreen);
  g.fillRect(Math.round(9 * s), Math.round(7 * s), Math.round(10 * s), Math.round(8 * s));
  g.fillStyle(PALETTE.gold);
  g.fillCircle(Math.round(14 * s), Math.round(16 * s), Math.round(4 * s));

  g.generateTexture("founders_easel", width, height);
  g.destroy();
}

function generateFoundersLantern(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const width = Math.round(16 * s);
  const height = Math.round(50 * s);

  // Pole
  g.fillStyle(0x451a03);
  g.fillRect(Math.round(6 * s), Math.round(15 * s), Math.round(4 * s), Math.round(35 * s));
  // Pole highlight
  g.fillStyle(lighten(0x451a03, 0.1));
  g.fillRect(Math.round(6 * s), Math.round(15 * s), Math.round(1 * s), Math.round(35 * s));

  // Lantern housing
  g.fillStyle(0x78350f);
  g.fillRect(Math.round(2 * s), Math.round(5 * s), Math.round(12 * s), Math.round(12 * s));
  // Housing top
  g.fillStyle(0x5c3317);
  g.fillRect(Math.round(1 * s), Math.round(3 * s), Math.round(14 * s), Math.round(3 * s));
  // Housing cap (pointed)
  g.fillTriangle(
    Math.round(1 * s),
    Math.round(3 * s),
    Math.round(8 * s),
    Math.round(-2 * s),
    Math.round(15 * s),
    Math.round(3 * s)
  );

  // Glass panels (warm amber glow)
  g.fillStyle(0xfbbf24, 0.8);
  g.fillRect(Math.round(4 * s), Math.round(7 * s), Math.round(8 * s), Math.round(8 * s));
  // Bright center
  g.fillStyle(0xfde047);
  g.fillRect(Math.round(6 * s), Math.round(9 * s), Math.round(4 * s), Math.round(4 * s));

  // Glow effect (semi-transparent)
  g.fillStyle(0xfbbf24, 0.3);
  g.fillCircle(Math.round(8 * s), Math.round(11 * s), Math.round(10 * s));

  // Hanging hook at top
  g.fillStyle(0x78716c);
  g.fillRect(Math.round(7 * s), Math.round(-3 * s), Math.round(2 * s), Math.round(3 * s));

  // Base decoration
  g.fillStyle(0x5c3317);
  g.fillRect(Math.round(4 * s), Math.round(48 * s), Math.round(8 * s), Math.round(2 * s));

  g.generateTexture("founders_lantern", width, height);
  g.destroy();
}

function generateFoundersCrate(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const width = Math.round(20 * s);
  const height = Math.round(18 * s);

  // Main crate body
  g.fillStyle(0x8b4513);
  g.fillRect(0, Math.round(2 * s), width, height - Math.round(2 * s));

  // 3D depth
  g.fillStyle(lighten(0x8b4513, 0.15));
  g.fillRect(0, Math.round(2 * s), Math.round(3 * s), height - Math.round(2 * s));
  g.fillStyle(darken(0x8b4513, 0.2));
  g.fillRect(
    width - Math.round(3 * s),
    Math.round(2 * s),
    Math.round(3 * s),
    height - Math.round(2 * s)
  );

  // Top surface
  g.fillStyle(lighten(0x8b4513, 0.1));
  g.fillRect(0, 0, width, Math.round(4 * s));

  // Wood plank lines
  g.fillStyle(darken(0x8b4513, 0.15));
  g.fillRect(0, Math.round(6 * s), width, Math.round(1 * s));
  g.fillRect(0, Math.round(11 * s), width, Math.round(1 * s));

  // Metal corner brackets
  g.fillStyle(0x6b7280);
  // Top left
  g.fillRect(0, Math.round(2 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(0, Math.round(2 * s), Math.round(2 * s), Math.round(5 * s));
  // Top right
  g.fillRect(width - Math.round(4 * s), Math.round(2 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(width - Math.round(2 * s), Math.round(2 * s), Math.round(2 * s), Math.round(5 * s));
  // Bottom left
  g.fillRect(0, height - Math.round(4 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(0, height - Math.round(7 * s), Math.round(2 * s), Math.round(5 * s));
  // Bottom right
  g.fillRect(
    width - Math.round(4 * s),
    height - Math.round(4 * s),
    Math.round(4 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    width - Math.round(2 * s),
    height - Math.round(7 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  );

  g.generateTexture("founders_crate", width, height);
  g.destroy();
}

function generateFoundersChalkboardSign(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const width = Math.round(50 * s);
  const height = Math.round(40 * s);

  // Sign posts (A-frame)
  g.fillStyle(0x5c3317);
  g.fillRect(Math.round(5 * s), Math.round(5 * s), Math.round(4 * s), Math.round(35 * s));
  g.fillRect(width - Math.round(9 * s), Math.round(5 * s), Math.round(4 * s), Math.round(35 * s));

  // Cross bar at top
  g.fillStyle(0x78350f);
  g.fillRect(Math.round(3 * s), Math.round(3 * s), width - Math.round(6 * s), Math.round(4 * s));

  // Chalkboard panel
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(8 * s), Math.round(8 * s), width - Math.round(16 * s), Math.round(24 * s));

  // Chalkboard frame
  g.fillStyle(0x451a03);
  g.fillRect(Math.round(8 * s), Math.round(8 * s), width - Math.round(16 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(30 * s), width - Math.round(16 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(8 * s), Math.round(2 * s), Math.round(24 * s));
  g.fillRect(width - Math.round(10 * s), Math.round(8 * s), Math.round(2 * s), Math.round(24 * s));

  // Chalk text "WELCOME FOUNDERS"
  g.fillStyle(0xffffff, 0.9);
  // "WELCOME" (simplified as rectangle lines)
  g.fillRect(Math.round(12 * s), Math.round(12 * s), Math.round(26 * s), Math.round(3 * s));
  // "FOUNDERS"
  g.fillRect(Math.round(14 * s), Math.round(18 * s), Math.round(22 * s), Math.round(3 * s));
  // Decorative underline
  g.fillStyle(PALETTE.bagsGreen, 0.8);
  g.fillRect(Math.round(12 * s), Math.round(24 * s), Math.round(26 * s), Math.round(2 * s));

  // Chalk dust effect
  g.fillStyle(0xffffff, 0.3);
  g.fillRect(Math.round(15 * s), Math.round(28 * s), Math.round(3 * s), Math.round(1 * s));
  g.fillRect(Math.round(25 * s), Math.round(27 * s), Math.round(2 * s), Math.round(1 * s));

  g.generateTexture("founders_chalkboard", width, height);
  g.destroy();
}

function generateFoundersPokemon(scene: Phaser.Scene): void {
  const s = SCALE;

  // === CHARMANDER ===
  const charmander = scene.make.graphics({ x: 0, y: 0 });
  const cWidth = Math.round(28 * s);
  const cHeight = Math.round(28 * s);

  // Body (orange)
  charmander.fillStyle(0xf97316);
  charmander.fillRect(
    Math.round(8 * s),
    Math.round(10 * s),
    Math.round(12 * s),
    Math.round(10 * s)
  );

  // Head (orange, larger)
  charmander.fillStyle(0xfb923c);
  charmander.fillCircle(Math.round(14 * s), Math.round(8 * s), Math.round(6 * s));

  // Belly (cream/yellow)
  charmander.fillStyle(0xfef3c7);
  charmander.fillRect(Math.round(10 * s), Math.round(12 * s), Math.round(8 * s), Math.round(6 * s));

  // Eyes (big, cute)
  charmander.fillStyle(0x1e3a5f);
  charmander.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
  charmander.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
  // Eye highlights
  charmander.fillStyle(0xffffff);
  charmander.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  charmander.fillRect(Math.round(16 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Mouth (smile)
  charmander.fillStyle(0x000000);
  charmander.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(4 * s), Math.round(1 * s));

  // Arms
  charmander.fillStyle(0xf97316);
  charmander.fillRect(Math.round(5 * s), Math.round(12 * s), Math.round(4 * s), Math.round(3 * s));
  charmander.fillRect(Math.round(19 * s), Math.round(12 * s), Math.round(4 * s), Math.round(3 * s));

  // Legs
  charmander.fillRect(Math.round(9 * s), Math.round(18 * s), Math.round(4 * s), Math.round(4 * s));
  charmander.fillRect(Math.round(15 * s), Math.round(18 * s), Math.round(4 * s), Math.round(4 * s));

  // Tail with flame
  charmander.fillStyle(0xf97316);
  charmander.fillRect(Math.round(18 * s), Math.round(14 * s), Math.round(6 * s), Math.round(3 * s));
  charmander.fillRect(Math.round(22 * s), Math.round(12 * s), Math.round(3 * s), Math.round(4 * s));
  // Flame (yellow-orange-red)
  charmander.fillStyle(0xfbbf24);
  charmander.fillRect(Math.round(23 * s), Math.round(8 * s), Math.round(4 * s), Math.round(5 * s));
  charmander.fillStyle(0xf97316);
  charmander.fillRect(Math.round(24 * s), Math.round(6 * s), Math.round(2 * s), Math.round(4 * s));
  charmander.fillStyle(0xef4444);
  charmander.fillRect(Math.round(24 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));

  charmander.generateTexture("pokemon_charmander", cWidth, cHeight);
  charmander.destroy();

  // === SQUIRTLE ===
  const squirtle = scene.make.graphics({ x: 0, y: 0 });
  const sWidth = Math.round(28 * s);
  const sHeight = Math.round(28 * s);

  // Shell (brown back)
  squirtle.fillStyle(0x92400e);
  squirtle.fillRect(Math.round(7 * s), Math.round(10 * s), Math.round(14 * s), Math.round(12 * s));
  // Shell pattern (darker center)
  squirtle.fillStyle(0x78350f);
  squirtle.fillRect(Math.round(9 * s), Math.round(12 * s), Math.round(10 * s), Math.round(8 * s));
  // Shell highlight
  squirtle.fillStyle(0xa16207);
  squirtle.fillRect(Math.round(8 * s), Math.round(11 * s), Math.round(3 * s), Math.round(2 * s));

  // Body (light blue, front)
  squirtle.fillStyle(0x7dd3fc);
  squirtle.fillRect(Math.round(9 * s), Math.round(14 * s), Math.round(10 * s), Math.round(6 * s));

  // Head (blue)
  squirtle.fillStyle(0x38bdf8);
  squirtle.fillCircle(Math.round(14 * s), Math.round(8 * s), Math.round(6 * s));

  // Eyes (big, cute)
  squirtle.fillStyle(0x7c2d12);
  squirtle.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
  squirtle.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
  // Eye highlights
  squirtle.fillStyle(0xffffff);
  squirtle.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  squirtle.fillRect(Math.round(16 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Mouth (smile)
  squirtle.fillStyle(0x000000);
  squirtle.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(4 * s), Math.round(1 * s));

  // Arms (blue)
  squirtle.fillStyle(0x38bdf8);
  squirtle.fillRect(Math.round(4 * s), Math.round(14 * s), Math.round(4 * s), Math.round(3 * s));
  squirtle.fillRect(Math.round(20 * s), Math.round(14 * s), Math.round(4 * s), Math.round(3 * s));

  // Legs
  squirtle.fillRect(Math.round(9 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
  squirtle.fillRect(Math.round(15 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));

  // Tail (curled, blue)
  squirtle.fillStyle(0x38bdf8);
  squirtle.fillRect(Math.round(19 * s), Math.round(18 * s), Math.round(5 * s), Math.round(3 * s));
  squirtle.fillRect(Math.round(22 * s), Math.round(15 * s), Math.round(3 * s), Math.round(4 * s));
  squirtle.fillStyle(0x7dd3fc);
  squirtle.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(2 * s), Math.round(3 * s));

  squirtle.generateTexture("pokemon_squirtle", sWidth, sHeight);
  squirtle.destroy();

  // === BULBASAUR ===
  const bulbasaur = scene.make.graphics({ x: 0, y: 0 });
  const bWidth = Math.round(32 * s);
  const bHeight = Math.round(28 * s);

  // Body (teal/green-blue)
  bulbasaur.fillStyle(0x5eead4);
  bulbasaur.fillRect(Math.round(6 * s), Math.round(12 * s), Math.round(18 * s), Math.round(10 * s));

  // Spots on body
  bulbasaur.fillStyle(0x2dd4bf);
  bulbasaur.fillRect(Math.round(8 * s), Math.round(14 * s), Math.round(3 * s), Math.round(3 * s));
  bulbasaur.fillRect(Math.round(18 * s), Math.round(15 * s), Math.round(4 * s), Math.round(3 * s));
  bulbasaur.fillRect(Math.round(12 * s), Math.round(18 * s), Math.round(3 * s), Math.round(2 * s));

  // Bulb on back (green)
  bulbasaur.fillStyle(0x22c55e);
  bulbasaur.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(12 * s), Math.round(10 * s));
  // Bulb highlight
  bulbasaur.fillStyle(0x4ade80);
  bulbasaur.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
  // Bulb darker parts
  bulbasaur.fillStyle(0x16a34a);
  bulbasaur.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(6 * s));
  // Leaves/petals
  bulbasaur.fillStyle(0x15803d);
  bulbasaur.fillTriangle(
    Math.round(12 * s),
    Math.round(4 * s),
    Math.round(16 * s),
    Math.round(-2 * s),
    Math.round(20 * s),
    Math.round(4 * s)
  );
  bulbasaur.fillTriangle(
    Math.round(8 * s),
    Math.round(6 * s),
    Math.round(6 * s),
    Math.round(0 * s),
    Math.round(14 * s),
    Math.round(6 * s)
  );

  // Head (teal, front-facing)
  bulbasaur.fillStyle(0x5eead4);
  bulbasaur.fillRect(Math.round(2 * s), Math.round(14 * s), Math.round(10 * s), Math.round(8 * s));

  // Eyes (red, distinctive)
  bulbasaur.fillStyle(0xdc2626);
  bulbasaur.fillRect(Math.round(3 * s), Math.round(15 * s), Math.round(3 * s), Math.round(3 * s));
  bulbasaur.fillRect(Math.round(8 * s), Math.round(15 * s), Math.round(3 * s), Math.round(3 * s));
  // Eye highlights
  bulbasaur.fillStyle(0xffffff);
  bulbasaur.fillRect(Math.round(4 * s), Math.round(15 * s), Math.round(1 * s), Math.round(1 * s));
  bulbasaur.fillRect(Math.round(9 * s), Math.round(15 * s), Math.round(1 * s), Math.round(1 * s));
  // Pupils
  bulbasaur.fillStyle(0x000000);
  bulbasaur.fillRect(Math.round(4 * s), Math.round(17 * s), Math.round(1 * s), Math.round(1 * s));
  bulbasaur.fillRect(Math.round(9 * s), Math.round(17 * s), Math.round(1 * s), Math.round(1 * s));

  // Mouth (wide)
  bulbasaur.fillStyle(0x2dd4bf);
  bulbasaur.fillRect(Math.round(4 * s), Math.round(20 * s), Math.round(6 * s), Math.round(2 * s));

  // Ears
  bulbasaur.fillStyle(0x5eead4);
  bulbasaur.fillTriangle(
    Math.round(2 * s),
    Math.round(14 * s),
    Math.round(0 * s),
    Math.round(10 * s),
    Math.round(5 * s),
    Math.round(14 * s)
  );
  bulbasaur.fillTriangle(
    Math.round(9 * s),
    Math.round(14 * s),
    Math.round(12 * s),
    Math.round(10 * s),
    Math.round(12 * s),
    Math.round(14 * s)
  );

  // Legs (stubby)
  bulbasaur.fillStyle(0x5eead4);
  bulbasaur.fillRect(Math.round(7 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
  bulbasaur.fillRect(Math.round(17 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
  // Back legs (partially visible)
  bulbasaur.fillRect(Math.round(12 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));
  bulbasaur.fillRect(Math.round(21 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));

  bulbasaur.generateTexture("pokemon_bulbasaur", bWidth, bHeight);
  bulbasaur.destroy();
}
