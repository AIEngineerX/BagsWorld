import * as Phaser from "phaser";
import { SCALE, darken, lighten } from "./constants";

export function generateMansions(scene: Phaser.Scene): void {
  const s = SCALE;
  // Larger canvas for more detail
  const canvasWidth = Math.round(120 * s);
  const canvasHeight = Math.round(200 * s);

  // Each mansion has unique architecture with luxury details
  generateMansion0_GrandPalace(scene, s, canvasWidth, canvasHeight);
  generateMansion1_VictorianTower(scene, s, canvasWidth, canvasHeight);
  generateMansion2_FrenchChateau(scene, s, canvasWidth, canvasHeight);
  generateMansion3_ArtDecoEstate(scene, s, canvasWidth, canvasHeight);
  generateMansion4_ColonialManor(scene, s, canvasWidth, canvasHeight);
}

// MANSION 0: Grand Palace - Opulent royal palace with golden dome (TOP HOLDER)
function generateMansion0_GrandPalace(
  scene: Phaser.Scene,
  s: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const style = {
    base: 0x1e3a5f, // Deep royal blue
    baseLight: 0x2d4a6f,
    baseDark: 0x0f2744,
    roof: 0xffd700, // Pure gold
    roofLight: 0xffec8b,
    trim: 0xffd700,
    window: 0x7fff00, // Bright chartreuse glow
    windowGlow: 0x00ff41,
    column: 0xfaf0e6, // Linen white
    columnLight: 0xffffff,
  };
  const centerX = canvasWidth / 2;
  const groundY = canvasHeight - Math.round(8 * s); // Leave room for foundation

  // === FOUNDATION/BASE with steps ===
  g.fillStyle(0x4a4a4a);
  g.fillRect(Math.round(8 * s), groundY, canvasWidth - Math.round(16 * s), Math.round(8 * s));
  g.fillStyle(0x5a5a5a);
  g.fillRect(
    Math.round(12 * s),
    groundY - Math.round(4 * s),
    canvasWidth - Math.round(24 * s),
    Math.round(4 * s)
  );
  g.fillStyle(0x6a6a6a);
  g.fillRect(
    Math.round(16 * s),
    groundY - Math.round(8 * s),
    canvasWidth - Math.round(32 * s),
    Math.round(4 * s)
  );

  // === MAIN CENTRAL BODY ===
  const mainW = Math.round(50 * s);
  const mainH = Math.round(90 * s);
  const mainX = centerX - mainW / 2;
  const mainY = groundY - Math.round(8 * s) - mainH;

  // Drop shadow
  g.fillStyle(0x000000, 0.5);
  g.fillRect(mainX + Math.round(5 * s), mainY + Math.round(8 * s), mainW, mainH);

  // Main body with gradient effect (multiple layers)
  g.fillStyle(style.base);
  g.fillRect(mainX, mainY, mainW, mainH);
  // Light edge (left)
  g.fillStyle(style.baseLight);
  g.fillRect(mainX, mainY, Math.round(5 * s), mainH);
  // Dark edge (right)
  g.fillStyle(style.baseDark);
  g.fillRect(mainX + mainW - Math.round(5 * s), mainY, Math.round(5 * s), mainH);

  // Dithering texture on walls
  g.fillStyle(style.baseLight, 0.15);
  for (let py = 0; py < mainH; py += Math.round(4 * s)) {
    for (let px = 0; px < mainW; px += Math.round(8 * s)) {
      if ((py / Math.round(4 * s) + px / Math.round(8 * s)) % 2 === 0) {
        g.fillRect(mainX + px, mainY + py, Math.round(2 * s), Math.round(2 * s));
      }
    }
  }

  // === LEFT WING ===
  const wingW = Math.round(28 * s);
  const wingH = Math.round(65 * s);
  const leftWingX = mainX - wingW + Math.round(4 * s);
  const wingY = groundY - Math.round(8 * s) - wingH;

  g.fillStyle(0x000000, 0.4);
  g.fillRect(leftWingX + Math.round(4 * s), wingY + Math.round(6 * s), wingW, wingH);
  g.fillStyle(style.base);
  g.fillRect(leftWingX, wingY, wingW, wingH);
  g.fillStyle(style.baseLight);
  g.fillRect(leftWingX, wingY, Math.round(4 * s), wingH);

  // Wing roof with balustrade
  g.fillStyle(style.roof);
  g.fillRect(
    leftWingX - Math.round(3 * s),
    wingY - Math.round(8 * s),
    wingW + Math.round(6 * s),
    Math.round(8 * s)
  );
  g.fillStyle(style.roofLight);
  g.fillRect(
    leftWingX - Math.round(3 * s),
    wingY - Math.round(8 * s),
    wingW + Math.round(6 * s),
    Math.round(2 * s)
  );
  // Balustrade posts
  for (let p = 0; p < 5; p++) {
    const px = leftWingX + Math.round(3 * s) + p * Math.round(6 * s);
    g.fillStyle(style.column);
    g.fillRect(px, wingY - Math.round(14 * s), Math.round(3 * s), Math.round(6 * s));
  }
  g.fillStyle(style.column);
  g.fillRect(leftWingX, wingY - Math.round(16 * s), wingW, Math.round(2 * s));

  // Wing windows with GLOW effect
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const wx = leftWingX + Math.round(5 * s) + col * Math.round(12 * s);
      const wy = wingY + Math.round(12 * s) + row * Math.round(26 * s);
      // Outer glow
      g.fillStyle(style.windowGlow, 0.25);
      g.fillRect(
        wx - Math.round(3 * s),
        wy - Math.round(3 * s),
        Math.round(14 * s),
        Math.round(22 * s)
      );
      // Inner glow
      g.fillStyle(style.windowGlow, 0.4);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        Math.round(10 * s),
        Math.round(18 * s)
      );
      // Window pane
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(8 * s), Math.round(16 * s));
      // Mullions (cross pattern)
      g.fillStyle(style.column);
      g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(16 * s));
      g.fillRect(wx, wy + Math.round(7.5 * s), Math.round(8 * s), Math.round(1 * s));
      // Arched top
      g.fillStyle(style.window);
      g.fillCircle(wx + Math.round(4 * s), wy, Math.round(4 * s));
    }
  }

  // === RIGHT WING (mirror) ===
  const rightWingX = mainX + mainW - Math.round(4 * s);
  g.fillStyle(0x000000, 0.4);
  g.fillRect(rightWingX + Math.round(4 * s), wingY + Math.round(6 * s), wingW, wingH);
  g.fillStyle(style.base);
  g.fillRect(rightWingX, wingY, wingW, wingH);
  g.fillStyle(style.baseDark);
  g.fillRect(rightWingX + wingW - Math.round(4 * s), wingY, Math.round(4 * s), wingH);

  // Right wing roof with balustrade
  g.fillStyle(style.roof);
  g.fillRect(
    rightWingX - Math.round(3 * s),
    wingY - Math.round(8 * s),
    wingW + Math.round(6 * s),
    Math.round(8 * s)
  );
  g.fillStyle(style.roofLight);
  g.fillRect(
    rightWingX - Math.round(3 * s),
    wingY - Math.round(8 * s),
    wingW + Math.round(6 * s),
    Math.round(2 * s)
  );
  for (let p = 0; p < 5; p++) {
    const px = rightWingX + Math.round(3 * s) + p * Math.round(6 * s);
    g.fillStyle(style.column);
    g.fillRect(px, wingY - Math.round(14 * s), Math.round(3 * s), Math.round(6 * s));
  }
  g.fillStyle(style.column);
  g.fillRect(rightWingX, wingY - Math.round(16 * s), wingW, Math.round(2 * s));

  // Right wing windows
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const wx = rightWingX + Math.round(5 * s) + col * Math.round(12 * s);
      const wy = wingY + Math.round(12 * s) + row * Math.round(26 * s);
      g.fillStyle(style.windowGlow, 0.25);
      g.fillRect(
        wx - Math.round(3 * s),
        wy - Math.round(3 * s),
        Math.round(14 * s),
        Math.round(22 * s)
      );
      g.fillStyle(style.windowGlow, 0.4);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        Math.round(10 * s),
        Math.round(18 * s)
      );
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(8 * s), Math.round(16 * s));
      g.fillStyle(style.column);
      g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(16 * s));
      g.fillRect(wx, wy + Math.round(7.5 * s), Math.round(8 * s), Math.round(1 * s));
      g.fillStyle(style.window);
      g.fillCircle(wx + Math.round(4 * s), wy, Math.round(4 * s));
    }
  }

  // === GRAND GOLDEN DOME ===
  const domeR = Math.round(26 * s);
  const domeY = mainY - Math.round(12 * s);

  // Dome drum (base)
  g.fillStyle(style.column);
  g.fillRect(
    centerX - Math.round(24 * s),
    domeY - Math.round(4 * s),
    Math.round(48 * s),
    Math.round(12 * s)
  );
  // Drum columns
  for (let dc = 0; dc < 8; dc++) {
    const dcx = centerX - Math.round(22 * s) + dc * Math.round(6 * s);
    g.fillStyle(style.columnLight);
    g.fillRect(dcx, domeY - Math.round(2 * s), Math.round(2 * s), Math.round(10 * s));
  }

  // Main dome
  g.fillStyle(style.roof);
  g.fillCircle(centerX, domeY, domeR);
  // Dome highlight (shiny reflection)
  g.fillStyle(style.roofLight, 0.7);
  g.fillCircle(centerX - Math.round(8 * s), domeY - Math.round(8 * s), Math.round(12 * s));
  g.fillStyle(0xffffff, 0.4);
  g.fillCircle(centerX - Math.round(10 * s), domeY - Math.round(10 * s), Math.round(6 * s));
  // Dome ribs (decorative lines)
  g.fillStyle(darken(style.roof, 0.15));
  for (let r = 0; r < 6; r++) {
    const angle = (r / 6) * Math.PI;
    const rx = Math.cos(angle) * domeR * 0.9;
    g.fillRect(
      centerX + rx - Math.round(1 * s),
      domeY - domeR + Math.round(5 * s),
      Math.round(2 * s),
      domeR * 2 - Math.round(10 * s)
    );
  }

  // FINIAL (ornate gold spire on top)
  g.fillStyle(style.trim);
  g.fillRect(
    centerX - Math.round(2 * s),
    domeY - domeR - Math.round(18 * s),
    Math.round(4 * s),
    Math.round(18 * s)
  );
  g.fillStyle(style.roofLight);
  g.fillCircle(centerX, domeY - domeR - Math.round(22 * s), Math.round(5 * s));
  g.fillStyle(style.trim);
  g.fillCircle(centerX, domeY - domeR - Math.round(22 * s), Math.round(3 * s));
  // Cross on top
  g.fillRect(
    centerX - Math.round(4 * s),
    domeY - domeR - Math.round(30 * s),
    Math.round(8 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    centerX - Math.round(1.5 * s),
    domeY - domeR - Math.round(36 * s),
    Math.round(3 * s),
    Math.round(12 * s)
  );

  // === ORNATE CORNICE ===
  g.fillStyle(style.trim);
  g.fillRect(
    mainX - Math.round(4 * s),
    mainY - Math.round(6 * s),
    mainW + Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillStyle(style.roofLight);
  g.fillRect(
    mainX - Math.round(4 * s),
    mainY - Math.round(6 * s),
    mainW + Math.round(8 * s),
    Math.round(2 * s)
  );
  // Dentil molding
  for (let d = 0; d < 12; d++) {
    g.fillStyle(style.column);
    g.fillRect(
      mainX + Math.round(2 * s) + d * Math.round(4 * s),
      mainY + Math.round(2 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );
  }

  // === MAIN BODY WINDOWS with chandelier glow ===
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = mainX + Math.round(7 * s) + col * Math.round(14 * s);
      const wy = mainY + Math.round(14 * s) + row * Math.round(26 * s);
      // Outer glow
      g.fillStyle(style.windowGlow, 0.3);
      g.fillRect(
        wx - Math.round(4 * s),
        wy - Math.round(4 * s),
        Math.round(18 * s),
        Math.round(26 * s)
      );
      // Inner glow
      g.fillStyle(style.windowGlow, 0.5);
      g.fillRect(
        wx - Math.round(2 * s),
        wy - Math.round(2 * s),
        Math.round(14 * s),
        Math.round(22 * s)
      );
      // Window frame (gold)
      g.fillStyle(style.trim);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        Math.round(12 * s),
        Math.round(20 * s)
      );
      // Window pane
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(10 * s), Math.round(18 * s));
      // Arched top
      g.fillCircle(wx + Math.round(5 * s), wy, Math.round(5 * s));
      // Mullions
      g.fillStyle(style.column);
      g.fillRect(wx + Math.round(4.5 * s), wy, Math.round(1 * s), Math.round(18 * s));
      g.fillRect(wx, wy + Math.round(8.5 * s), Math.round(10 * s), Math.round(1 * s));
      // Chandelier sparkle in center window (middle row)
      if (row === 1 && col === 1) {
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(wx + Math.round(5 * s), wy + Math.round(6 * s), Math.round(2 * s));
        g.fillStyle(style.windowGlow, 0.7);
        g.fillCircle(wx + Math.round(5 * s), wy + Math.round(6 * s), Math.round(4 * s));
      }
      // Decorative pediment above each window
      g.fillStyle(style.trim);
      g.fillTriangle(
        wx - Math.round(2 * s),
        wy - Math.round(2 * s),
        wx + Math.round(12 * s),
        wy - Math.round(2 * s),
        wx + Math.round(5 * s),
        wy - Math.round(8 * s)
      );
    }
  }

  // === GRAND ENTRANCE with columns ===
  const doorW = Math.round(18 * s);
  const doorH = Math.round(30 * s);
  const doorX = centerX - doorW / 2;
  const doorY = groundY - Math.round(8 * s) - doorH;

  // Entrance portico roof
  g.fillStyle(style.roof);
  g.fillRect(
    doorX - Math.round(12 * s),
    doorY - Math.round(10 * s),
    doorW + Math.round(24 * s),
    Math.round(8 * s)
  );
  g.fillStyle(style.roofLight);
  g.fillRect(
    doorX - Math.round(12 * s),
    doorY - Math.round(10 * s),
    doorW + Math.round(24 * s),
    Math.round(2 * s)
  );
  // Triangular pediment
  g.fillStyle(style.trim);
  g.fillTriangle(
    doorX - Math.round(14 * s),
    doorY - Math.round(10 * s),
    doorX + doorW + Math.round(14 * s),
    doorY - Math.round(10 * s),
    centerX,
    doorY - Math.round(26 * s)
  );
  g.fillStyle(style.roofLight);
  g.fillTriangle(
    doorX - Math.round(10 * s),
    doorY - Math.round(10 * s),
    doorX + doorW + Math.round(10 * s),
    doorY - Math.round(10 * s),
    centerX,
    doorY - Math.round(20 * s)
  );

  // Grand columns (4 fluted columns)
  for (let c = 0; c < 4; c++) {
    const cx = doorX - Math.round(8 * s) + c * Math.round(12 * s);
    g.fillStyle(style.column);
    g.fillRect(cx, doorY - Math.round(2 * s), Math.round(5 * s), doorH + Math.round(2 * s));
    // Column fluting (grooves)
    g.fillStyle(style.columnLight);
    g.fillRect(cx + Math.round(1 * s), doorY, Math.round(1 * s), doorH);
    g.fillStyle(0xcccccc);
    g.fillRect(cx + Math.round(3 * s), doorY, Math.round(1 * s), doorH);
    // Capital
    g.fillStyle(style.trim);
    g.fillRect(
      cx - Math.round(1 * s),
      doorY - Math.round(6 * s),
      Math.round(7 * s),
      Math.round(4 * s)
    );
    // Base
    g.fillRect(
      cx - Math.round(1 * s),
      doorY + doorH - Math.round(3 * s),
      Math.round(7 * s),
      Math.round(3 * s)
    );
  }

  // Door arch
  g.fillStyle(style.trim);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(4 * s),
    doorW + Math.round(8 * s),
    doorH + Math.round(4 * s)
  );
  g.fillCircle(centerX, doorY - Math.round(4 * s), doorW / 2 + Math.round(4 * s));
  // Door opening
  g.fillStyle(0x0a0a0a);
  g.fillRect(doorX, doorY, doorW, doorH);
  g.fillCircle(centerX, doorY, doorW / 2);
  // Ornate door panels
  g.fillStyle(0x3d2817);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(4 * s),
    doorW / 2 - Math.round(3 * s),
    doorH - Math.round(4 * s)
  );
  g.fillRect(
    doorX + doorW / 2 + Math.round(1 * s),
    doorY + Math.round(4 * s),
    doorW / 2 - Math.round(3 * s),
    doorH - Math.round(4 * s)
  );
  // Door knockers (gold circles)
  g.fillStyle(style.trim);
  g.fillCircle(doorX + Math.round(6 * s), doorY + Math.round(16 * s), Math.round(2 * s));
  g.fillCircle(doorX + doorW - Math.round(6 * s), doorY + Math.round(16 * s), Math.round(2 * s));
  // Fanlight window above door
  g.fillStyle(style.window, 0.7);
  g.fillCircle(centerX, doorY - Math.round(2 * s), doorW / 2 - Math.round(2 * s));
  // Fanlight muntins
  for (let m = 0; m < 5; m++) {
    const angle = (m / 5) * Math.PI;
    const mx = Math.cos(angle) * (doorW / 2 - Math.round(4 * s));
    const my = Math.sin(angle) * (doorW / 2 - Math.round(4 * s));
    g.fillStyle(style.column);
    g.fillRect(
      centerX - Math.round(0.5 * s),
      doorY - Math.round(2 * s),
      Math.round(1 * s),
      -(doorW / 2 - Math.round(4 * s))
    );
  }

  g.generateTexture("mansion_0", canvasWidth, canvasHeight);
  g.destroy();
}

// MANSION 1: Obsidian Tower - Dark Gothic Victorian with dramatic spires (#2 HOLDER)
function generateMansion1_VictorianTower(
  scene: Phaser.Scene,
  s: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const style = {
    base: 0x1a1a2e, // Dark obsidian
    baseLight: 0x2a2a4e,
    baseDark: 0x0a0a1e,
    roof: 0x2d2d2d, // Dark slate
    roofLight: 0x4a4a4a,
    trim: 0xffd700, // Gold accents
    trimLight: 0xffec8b,
    window: 0xffb347, // Warm amber glow
    windowGlow: 0xff8c00,
    stainedGlass: 0xff4500, // Orange-red accent
  };
  const centerX = canvasWidth / 2;
  const groundY = canvasHeight - Math.round(6 * s);

  // === FOUNDATION ===
  g.fillStyle(0x2a2a2a);
  g.fillRect(Math.round(10 * s), groundY, canvasWidth - Math.round(20 * s), Math.round(6 * s));

  // === MAIN BODY (asymmetric Gothic) ===
  const mainW = Math.round(60 * s);
  const mainH = Math.round(80 * s);
  const mainX = Math.round(35 * s);
  const mainY = groundY - mainH;

  // Shadow
  g.fillStyle(0x000000, 0.5);
  g.fillRect(mainX + Math.round(5 * s), mainY + Math.round(8 * s), mainW, mainH);

  // Main body with texture
  g.fillStyle(style.base);
  g.fillRect(mainX, mainY, mainW, mainH);
  g.fillStyle(style.baseLight);
  g.fillRect(mainX, mainY, Math.round(5 * s), mainH);
  g.fillStyle(style.baseDark);
  g.fillRect(mainX + mainW - Math.round(5 * s), mainY, Math.round(5 * s), mainH);

  // Stone block pattern
  g.fillStyle(style.baseLight, 0.1);
  for (let row = 0; row < mainH / Math.round(8 * s); row++) {
    const offset = row % 2 === 0 ? 0 : Math.round(6 * s);
    for (let col = 0; col < mainW / Math.round(12 * s) + 1; col++) {
      g.fillRect(
        mainX + offset + col * Math.round(12 * s),
        mainY + row * Math.round(8 * s),
        Math.round(11 * s),
        Math.round(7 * s)
      );
    }
  }

  // === STEEP GOTHIC ROOF ===
  const roofPeakY = mainY - Math.round(45 * s);
  g.fillStyle(style.roof);
  g.fillTriangle(
    mainX - Math.round(6 * s),
    mainY,
    mainX + mainW + Math.round(6 * s),
    mainY,
    mainX + mainW / 2,
    roofPeakY
  );
  // Roof highlight
  g.fillStyle(style.roofLight);
  g.fillTriangle(
    mainX + Math.round(15 * s),
    mainY - Math.round(3 * s),
    mainX + mainW / 2,
    mainY - Math.round(3 * s),
    mainX + mainW / 2,
    roofPeakY + Math.round(8 * s)
  );
  // Roof tiles pattern
  for (let rt = 0; rt < 8; rt++) {
    const tileY = mainY - Math.round(8 * s) - rt * Math.round(5 * s);
    g.fillStyle(rt % 2 === 0 ? style.roof : style.roofLight, 0.3);
    const tileW = mainW - rt * Math.round(6 * s);
    g.fillRect(mainX + rt * Math.round(3 * s), tileY, tileW, Math.round(5 * s));
  }

  // === DRAMATIC CORNER TOWER ===
  const towerW = Math.round(28 * s);
  const towerH = Math.round(120 * s);
  const towerX = mainX - Math.round(10 * s);
  const towerY = groundY - towerH;

  g.fillStyle(0x000000, 0.45);
  g.fillRect(towerX + Math.round(4 * s), towerY + Math.round(6 * s), towerW, towerH);
  g.fillStyle(style.base);
  g.fillRect(towerX, towerY, towerW, towerH);
  g.fillStyle(style.baseLight);
  g.fillRect(towerX, towerY, Math.round(4 * s), towerH);

  // Stone pattern on tower
  g.fillStyle(style.baseLight, 0.08);
  for (let row = 0; row < towerH / Math.round(6 * s); row++) {
    const offset = row % 2 === 0 ? 0 : Math.round(4 * s);
    for (let col = 0; col < 4; col++) {
      g.fillRect(
        towerX + offset + col * Math.round(7 * s),
        towerY + row * Math.round(6 * s),
        Math.round(6 * s),
        Math.round(5 * s)
      );
    }
  }

  // WITCH'S HAT SPIRE (dramatic conical roof)
  const spireH = Math.round(50 * s);
  g.fillStyle(style.roof);
  g.fillTriangle(
    towerX - Math.round(5 * s),
    towerY,
    towerX + towerW + Math.round(5 * s),
    towerY,
    towerX + towerW / 2,
    towerY - spireH
  );
  g.fillStyle(style.roofLight);
  g.fillTriangle(
    towerX + Math.round(5 * s),
    towerY - Math.round(3 * s),
    towerX + towerW / 2,
    towerY - Math.round(3 * s),
    towerX + towerW / 2,
    towerY - spireH + Math.round(8 * s)
  );

  // GOLD FINIAL with ornate detail
  const finialX = towerX + towerW / 2;
  g.fillStyle(style.trim);
  g.fillRect(
    finialX - Math.round(2 * s),
    towerY - spireH - Math.round(15 * s),
    Math.round(4 * s),
    Math.round(15 * s)
  );
  g.fillStyle(style.trimLight);
  g.fillCircle(finialX, towerY - spireH - Math.round(18 * s), Math.round(4 * s));
  g.fillStyle(style.trim);
  g.fillCircle(finialX, towerY - spireH - Math.round(18 * s), Math.round(2 * s));
  // Lightning rod
  g.fillRect(
    finialX - Math.round(0.5 * s),
    towerY - spireH - Math.round(28 * s),
    Math.round(1 * s),
    Math.round(10 * s)
  );

  // === TOWER WINDOWS (Gothic arched with stained glass) ===
  for (let i = 0; i < 5; i++) {
    const wy = towerY + Math.round(12 * s) + i * Math.round(22 * s);
    const ww = Math.round(12 * s);
    const wh = Math.round(16 * s);
    const wx = towerX + towerW / 2 - ww / 2;

    // Window glow
    g.fillStyle(style.windowGlow, 0.4);
    g.fillRect(
      wx - Math.round(3 * s),
      wy - Math.round(3 * s),
      ww + Math.round(6 * s),
      wh + Math.round(6 * s)
    );
    // Stone frame
    g.fillStyle(style.baseLight);
    g.fillRect(
      wx - Math.round(1 * s),
      wy - Math.round(1 * s),
      ww + Math.round(2 * s),
      wh + Math.round(2 * s)
    );
    // Pointed arch top
    g.fillTriangle(
      wx - Math.round(1 * s),
      wy,
      wx + ww + Math.round(1 * s),
      wy,
      wx + ww / 2,
      wy - Math.round(8 * s)
    );
    // Window glass
    g.fillStyle(style.window);
    g.fillRect(wx, wy, ww, wh);
    g.fillTriangle(wx, wy, wx + ww, wy, wx + ww / 2, wy - Math.round(7 * s));
    // Gothic tracery (Y-shape)
    g.fillStyle(style.baseDark);
    g.fillRect(wx + ww / 2 - Math.round(0.5 * s), wy, Math.round(1 * s), wh);
    g.fillRect(wx, wy + Math.round(6 * s), ww, Math.round(1 * s));
    // Stained glass accent (every other window)
    if (i % 2 === 0) {
      g.fillStyle(style.stainedGlass, 0.6);
      g.fillCircle(wx + ww / 2, wy - Math.round(3 * s), Math.round(3 * s));
    }
  }

  // === MAIN BUILDING WINDOWS ===
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const wx = mainX + Math.round(25 * s) + col * Math.round(18 * s);
      const wy = mainY + Math.round(15 * s) + row * Math.round(32 * s);
      // Glow
      g.fillStyle(style.windowGlow, 0.35);
      g.fillRect(
        wx - Math.round(4 * s),
        wy - Math.round(4 * s),
        Math.round(20 * s),
        Math.round(28 * s)
      );
      // Frame
      g.fillStyle(style.trim);
      g.fillRect(
        wx - Math.round(2 * s),
        wy - Math.round(2 * s),
        Math.round(16 * s),
        Math.round(24 * s)
      );
      // Glass
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(12 * s), Math.round(20 * s));
      // Gothic arch
      g.fillTriangle(
        wx,
        wy,
        wx + Math.round(12 * s),
        wy,
        wx + Math.round(6 * s),
        wy - Math.round(8 * s)
      );
      // Mullions
      g.fillStyle(style.baseDark);
      g.fillRect(wx + Math.round(5.5 * s), wy, Math.round(1 * s), Math.round(20 * s));
      g.fillRect(wx, wy + Math.round(9.5 * s), Math.round(12 * s), Math.round(1 * s));
      // Decorative header
      g.fillStyle(style.trim);
      g.fillRect(
        wx - Math.round(3 * s),
        wy - Math.round(10 * s),
        Math.round(18 * s),
        Math.round(4 * s)
      );
    }
  }

  // === GABLE ROSE WINDOW ===
  const roseX = mainX + mainW / 2;
  const roseY = roofPeakY + Math.round(18 * s);
  g.fillStyle(style.trim);
  g.fillCircle(roseX, roseY, Math.round(12 * s));
  g.fillStyle(style.windowGlow, 0.5);
  g.fillCircle(roseX, roseY, Math.round(10 * s));
  g.fillStyle(style.window);
  g.fillCircle(roseX, roseY, Math.round(8 * s));
  g.fillStyle(style.stainedGlass, 0.7);
  g.fillCircle(roseX, roseY, Math.round(4 * s));
  // Tracery spokes
  g.fillStyle(style.baseDark);
  for (let sp = 0; sp < 8; sp++) {
    const angle = (sp / 8) * Math.PI * 2;
    const dx = Math.cos(angle) * Math.round(8 * s);
    const dy = Math.sin(angle) * Math.round(8 * s);
    g.fillRect(roseX - Math.round(0.5 * s), roseY - Math.round(0.5 * s), dx, Math.round(1 * s));
  }

  // === GARGOYLES (decorative projections) ===
  // Left gargoyle
  g.fillStyle(style.baseLight);
  g.fillRect(
    mainX - Math.round(4 * s),
    mainY + Math.round(10 * s),
    Math.round(6 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    mainX - Math.round(8 * s),
    mainY + Math.round(12 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  // Right gargoyle
  g.fillRect(
    mainX + mainW - Math.round(2 * s),
    mainY + Math.round(10 * s),
    Math.round(6 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    mainX + mainW + Math.round(2 * s),
    mainY + Math.round(12 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  // === FRONT PORCH WITH COLUMNS ===
  const porchX = mainX + Math.round(38 * s);
  const porchW = Math.round(28 * s);
  const porchY = groundY - Math.round(35 * s);

  // Porch roof
  g.fillStyle(style.roof);
  g.fillRect(
    porchX - Math.round(4 * s),
    porchY - Math.round(4 * s),
    porchW + Math.round(8 * s),
    Math.round(6 * s)
  );
  g.fillStyle(style.trim);
  g.fillTriangle(
    porchX - Math.round(6 * s),
    porchY - Math.round(4 * s),
    porchX + porchW + Math.round(6 * s),
    porchY - Math.round(4 * s),
    porchX + porchW / 2,
    porchY - Math.round(16 * s)
  );

  // Gothic columns
  for (let c = 0; c < 2; c++) {
    const cx = porchX + Math.round(2 * s) + c * Math.round(22 * s);
    g.fillStyle(style.baseLight);
    g.fillRect(cx, porchY, Math.round(4 * s), Math.round(35 * s));
    // Carved details
    g.fillStyle(style.baseDark);
    g.fillRect(
      cx + Math.round(1 * s),
      porchY + Math.round(5 * s),
      Math.round(2 * s),
      Math.round(25 * s)
    );
  }

  // === ORNATE DOOR ===
  const doorW = Math.round(14 * s);
  const doorH = Math.round(28 * s);
  const doorX = porchX + porchW / 2 - doorW / 2;
  const doorY = groundY - doorH;

  // Door frame
  g.fillStyle(style.trim);
  g.fillRect(
    doorX - Math.round(3 * s),
    doorY - Math.round(10 * s),
    doorW + Math.round(6 * s),
    doorH + Math.round(10 * s)
  );
  // Pointed arch
  g.fillTriangle(
    doorX - Math.round(3 * s),
    doorY,
    doorX + doorW + Math.round(3 * s),
    doorY,
    doorX + doorW / 2,
    doorY - Math.round(12 * s)
  );
  // Door
  g.fillStyle(0x1a0a0a);
  g.fillRect(doorX, doorY, doorW, doorH);
  g.fillTriangle(doorX, doorY, doorX + doorW, doorY, doorX + doorW / 2, doorY - Math.round(10 * s));
  // Door panels
  g.fillStyle(0x2a1a1a);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(4 * s),
    doorW / 2 - Math.round(3 * s),
    Math.round(20 * s)
  );
  g.fillRect(
    doorX + doorW / 2 + Math.round(1 * s),
    doorY + Math.round(4 * s),
    doorW / 2 - Math.round(3 * s),
    Math.round(20 * s)
  );
  // Gold knocker
  g.fillStyle(style.trim);
  g.fillCircle(doorX + doorW / 2, doorY + Math.round(14 * s), Math.round(3 * s));
  g.fillCircle(doorX + doorW / 2, doorY + Math.round(14 * s), Math.round(1.5 * s));

  // === SECONDARY SPIRE on main roof ===
  const spire2X = mainX + mainW / 2;
  const spire2Y = roofPeakY;
  g.fillStyle(style.roof);
  g.fillRect(spire2X - Math.round(4 * s), spire2Y, Math.round(8 * s), Math.round(-12 * s));
  g.fillTriangle(
    spire2X - Math.round(6 * s),
    spire2Y - Math.round(12 * s),
    spire2X + Math.round(6 * s),
    spire2Y - Math.round(12 * s),
    spire2X,
    spire2Y - Math.round(25 * s)
  );
  g.fillStyle(style.trim);
  g.fillCircle(spire2X, spire2Y - Math.round(28 * s), Math.round(3 * s));

  g.generateTexture("mansion_1", canvasWidth, canvasHeight);
  g.destroy();
}

// MANSION 2: Amethyst Chateau - Elegant French Baroque with crystal accents (#3 HOLDER)
function generateMansion2_FrenchChateau(
  scene: Phaser.Scene,
  s: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const style = {
    base: 0x4a1a6b, // Rich purple
    baseLight: 0x6a2a8b,
    baseDark: 0x2a0a4b,
    roof: 0x9370db, // Medium purple (lavender)
    roofLight: 0xb19cd9,
    roofDark: 0x7b68ee,
    trim: 0xdda0dd, // Plum/pink trim
    trimLight: 0xeeccff,
    window: 0xe6e6fa, // Lavender glow
    windowGlow: 0xda70d6, // Orchid glow
    crystal: 0xff69b4, // Hot pink crystals
    crystalLight: 0xffb6c1,
    column: 0xc0c0c0, // Silver
  };
  const centerX = canvasWidth / 2;
  const groundY = canvasHeight - Math.round(6 * s);

  // === FOUNDATION ===
  g.fillStyle(0x4a4a5a);
  g.fillRect(Math.round(8 * s), groundY, canvasWidth - Math.round(16 * s), Math.round(6 * s));

  // === MAIN BODY ===
  const mainW = Math.round(70 * s);
  const mainH = Math.round(70 * s);
  const mainX = centerX - mainW / 2;
  const mainY = groundY - mainH;

  g.fillStyle(0x000000, 0.45);
  g.fillRect(mainX + Math.round(5 * s), mainY + Math.round(6 * s), mainW, mainH);
  g.fillStyle(style.base);
  g.fillRect(mainX, mainY, mainW, mainH);
  g.fillStyle(style.baseLight);
  g.fillRect(mainX, mainY, Math.round(5 * s), mainH);
  g.fillStyle(style.baseDark);
  g.fillRect(mainX + mainW - Math.round(5 * s), mainY, Math.round(5 * s), mainH);

  // Decorative horizontal bands
  g.fillStyle(style.trim, 0.4);
  g.fillRect(mainX, mainY + Math.round(22 * s), mainW, Math.round(3 * s));
  g.fillRect(mainX, mainY + mainH - Math.round(8 * s), mainW, Math.round(3 * s));

  // === STEEP MANSARD ROOF ===
  const roofH = Math.round(50 * s);
  // Lower steep section (curved appearance via stacking)
  g.fillStyle(style.roof);
  g.fillRect(mainX - Math.round(6 * s), mainY - roofH, mainW + Math.round(12 * s), roofH);
  // Curved roof effect
  for (let r = 0; r < 5; r++) {
    const ry = mainY - roofH + r * Math.round(10 * s);
    const rw = mainW + Math.round(12 * s) - r * Math.round(2 * s);
    const rx = mainX - Math.round(6 * s) + r * Math.round(1 * s);
    g.fillStyle(r % 2 === 0 ? style.roof : style.roofLight, 0.5);
    g.fillRect(rx, ry, rw, Math.round(10 * s));
  }
  // Flat top section
  g.fillStyle(style.roofDark);
  g.fillRect(
    mainX + Math.round(5 * s),
    mainY - roofH - Math.round(12 * s),
    mainW - Math.round(10 * s),
    Math.round(14 * s)
  );
  // Roof edge highlight
  g.fillStyle(style.trimLight);
  g.fillRect(
    mainX - Math.round(6 * s),
    mainY - roofH,
    mainW + Math.round(12 * s),
    Math.round(3 * s)
  );

  // === ORNATE DORMERS (3 with golden frames) ===
  for (let d = 0; d < 3; d++) {
    const dx = mainX + Math.round(10 * s) + d * Math.round(22 * s);
    const dy = mainY - roofH + Math.round(10 * s);
    const dw = Math.round(18 * s);
    const dh = Math.round(35 * s);

    // Dormer body
    g.fillStyle(style.base);
    g.fillRect(dx, dy, dw, dh);
    // Dormer roof (curved top)
    g.fillStyle(style.roof);
    g.fillCircle(dx + dw / 2, dy, dw / 2);
    g.fillTriangle(
      dx - Math.round(3 * s),
      dy,
      dx + dw + Math.round(3 * s),
      dy,
      dx + dw / 2,
      dy - Math.round(22 * s)
    );
    // Dormer finial
    g.fillStyle(style.trim);
    g.fillCircle(dx + dw / 2, dy - Math.round(24 * s), Math.round(3 * s));
    g.fillRect(
      dx + dw / 2 - Math.round(1 * s),
      dy - Math.round(28 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );

    // Dormer window with glow
    const dwx = dx + Math.round(3 * s);
    const dwy = dy + Math.round(5 * s);
    g.fillStyle(style.windowGlow, 0.4);
    g.fillRect(
      dwx - Math.round(2 * s),
      dwy - Math.round(2 * s),
      Math.round(16 * s),
      Math.round(28 * s)
    );
    g.fillStyle(style.trim);
    g.fillRect(
      dwx - Math.round(1 * s),
      dwy - Math.round(1 * s),
      Math.round(14 * s),
      Math.round(26 * s)
    );
    g.fillStyle(style.window);
    g.fillRect(dwx, dwy, Math.round(12 * s), Math.round(24 * s));
    // Arched top
    g.fillCircle(dwx + Math.round(6 * s), dwy, Math.round(6 * s));
    // Mullions
    g.fillStyle(style.column);
    g.fillRect(dwx + Math.round(5.5 * s), dwy, Math.round(1 * s), Math.round(24 * s));
    g.fillRect(dwx, dwy + Math.round(11.5 * s), Math.round(12 * s), Math.round(1 * s));
  }

  // === CORNER TURRETS (elegant round towers) ===
  const turretR = Math.round(12 * s);
  const turretH = Math.round(60 * s);

  // Left turret
  const ltX = mainX - Math.round(4 * s);
  const ltY = mainY + Math.round(10 * s);
  g.fillStyle(style.base);
  g.fillCircle(ltX, ltY, turretR);
  g.fillRect(ltX - turretR, ltY, turretR * 2, turretH);
  g.fillStyle(style.baseLight);
  g.fillRect(ltX - turretR, ltY, Math.round(4 * s), turretH);
  // Turret roof (conical)
  g.fillStyle(style.roof);
  g.fillTriangle(
    ltX - turretR - Math.round(3 * s),
    ltY,
    ltX + turretR + Math.round(3 * s),
    ltY,
    ltX,
    ltY - Math.round(30 * s)
  );
  g.fillStyle(style.roofLight);
  g.fillTriangle(
    ltX - Math.round(6 * s),
    ltY - Math.round(2 * s),
    ltX,
    ltY - Math.round(2 * s),
    ltX,
    ltY - Math.round(28 * s)
  );
  // Turret finial with crystal
  g.fillStyle(style.trim);
  g.fillRect(
    ltX - Math.round(1.5 * s),
    ltY - Math.round(40 * s),
    Math.round(3 * s),
    Math.round(12 * s)
  );
  g.fillStyle(style.crystal);
  g.fillCircle(ltX, ltY - Math.round(44 * s), Math.round(4 * s));
  g.fillStyle(style.crystalLight, 0.7);
  g.fillCircle(ltX - Math.round(1 * s), ltY - Math.round(45 * s), Math.round(2 * s));
  // Turret windows
  for (let tw = 0; tw < 2; tw++) {
    const twy = ltY + Math.round(10 * s) + tw * Math.round(22 * s);
    g.fillStyle(style.windowGlow, 0.3);
    g.fillCircle(ltX, twy + Math.round(5 * s), Math.round(7 * s));
    g.fillStyle(style.window);
    g.fillRect(ltX - Math.round(5 * s), twy, Math.round(10 * s), Math.round(14 * s));
  }

  // Right turret (mirror)
  const rtX = mainX + mainW + Math.round(4 * s);
  g.fillStyle(style.base);
  g.fillCircle(rtX, ltY, turretR);
  g.fillRect(rtX - turretR, ltY, turretR * 2, turretH);
  g.fillStyle(style.baseDark);
  g.fillRect(rtX + turretR - Math.round(4 * s), ltY, Math.round(4 * s), turretH);
  g.fillStyle(style.roof);
  g.fillTriangle(
    rtX - turretR - Math.round(3 * s),
    ltY,
    rtX + turretR + Math.round(3 * s),
    ltY,
    rtX,
    ltY - Math.round(30 * s)
  );
  g.fillStyle(style.trim);
  g.fillRect(
    rtX - Math.round(1.5 * s),
    ltY - Math.round(40 * s),
    Math.round(3 * s),
    Math.round(12 * s)
  );
  g.fillStyle(style.crystal);
  g.fillCircle(rtX, ltY - Math.round(44 * s), Math.round(4 * s));
  g.fillStyle(style.crystalLight, 0.7);
  g.fillCircle(rtX - Math.round(1 * s), ltY - Math.round(45 * s), Math.round(2 * s));
  for (let tw = 0; tw < 2; tw++) {
    const twy = ltY + Math.round(10 * s) + tw * Math.round(22 * s);
    g.fillStyle(style.windowGlow, 0.3);
    g.fillCircle(rtX, twy + Math.round(5 * s), Math.round(7 * s));
    g.fillStyle(style.window);
    g.fillRect(rtX - Math.round(5 * s), twy, Math.round(10 * s), Math.round(14 * s));
  }

  // === MAIN FLOOR WINDOWS (tall French windows with balconies) ===
  for (let w = 0; w < 5; w++) {
    const wx = mainX + Math.round(8 * s) + w * Math.round(13 * s);
    const wy = mainY + Math.round(8 * s);
    const ww = Math.round(10 * s);
    const wh = Math.round(45 * s);

    // Window glow
    g.fillStyle(style.windowGlow, 0.35);
    g.fillRect(
      wx - Math.round(3 * s),
      wy - Math.round(3 * s),
      ww + Math.round(6 * s),
      wh + Math.round(6 * s)
    );
    // Frame
    g.fillStyle(style.trim);
    g.fillRect(
      wx - Math.round(1 * s),
      wy - Math.round(1 * s),
      ww + Math.round(2 * s),
      wh + Math.round(2 * s)
    );
    // Glass
    g.fillStyle(style.window);
    g.fillRect(wx, wy, ww, wh);
    // Arched top
    g.fillCircle(wx + ww / 2, wy, ww / 2);
    // Mullions (French style)
    g.fillStyle(style.column);
    g.fillRect(wx + ww / 2 - Math.round(0.5 * s), wy, Math.round(1 * s), wh);
    for (let m = 0; m < 4; m++) {
      g.fillRect(wx, wy + Math.round(10 * s) + m * Math.round(10 * s), ww, Math.round(1 * s));
    }
    // Decorative header
    g.fillStyle(style.trimLight);
    g.fillRect(
      wx - Math.round(2 * s),
      wy - Math.round(6 * s),
      ww + Math.round(4 * s),
      Math.round(4 * s)
    );

    // Balcony (on center 3 windows)
    if (w >= 1 && w <= 3) {
      g.fillStyle(style.column);
      g.fillRect(
        wx - Math.round(3 * s),
        wy + wh - Math.round(2 * s),
        ww + Math.round(6 * s),
        Math.round(4 * s)
      );
      // Balcony rails
      g.fillStyle(style.trim);
      g.fillRect(
        wx - Math.round(4 * s),
        wy + wh - Math.round(8 * s),
        Math.round(2 * s),
        Math.round(8 * s)
      );
      g.fillRect(
        wx + ww + Math.round(2 * s),
        wy + wh - Math.round(8 * s),
        Math.round(2 * s),
        Math.round(8 * s)
      );
      g.fillRect(
        wx - Math.round(4 * s),
        wy + wh - Math.round(8 * s),
        ww + Math.round(8 * s),
        Math.round(2 * s)
      );
      // Rail balusters
      for (let b = 0; b < 4; b++) {
        g.fillRect(
          wx + Math.round(1 * s) + b * Math.round(3 * s),
          wy + wh - Math.round(6 * s),
          Math.round(1 * s),
          Math.round(4 * s)
        );
      }
    }
  }

  // === GRAND ENTRANCE (French baroque style) ===
  const doorW = Math.round(20 * s);
  const doorH = Math.round(32 * s);
  const doorX = centerX - doorW / 2;
  const doorY = groundY - doorH;

  // Entrance portico
  g.fillStyle(style.roof);
  g.fillRect(
    doorX - Math.round(10 * s),
    doorY - Math.round(8 * s),
    doorW + Math.round(20 * s),
    Math.round(6 * s)
  );
  // Curved pediment
  g.fillStyle(style.trim);
  g.fillCircle(centerX, doorY - Math.round(8 * s), Math.round(18 * s));
  g.fillStyle(style.base);
  g.fillCircle(centerX, doorY - Math.round(4 * s), Math.round(14 * s));
  // Decorative crest in pediment
  g.fillStyle(style.crystal);
  g.fillCircle(centerX, doorY - Math.round(16 * s), Math.round(6 * s));
  g.fillStyle(style.crystalLight);
  g.fillCircle(centerX - Math.round(2 * s), doorY - Math.round(18 * s), Math.round(3 * s));

  // Door frame
  g.fillStyle(style.trim);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(4 * s),
    doorW + Math.round(8 * s),
    doorH + Math.round(4 * s)
  );
  // Door
  g.fillStyle(0x2a1a3a);
  g.fillRect(doorX, doorY, doorW, doorH);
  // Door panels
  g.fillStyle(0x3a2a4a);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(4 * s),
    doorW / 2 - Math.round(3 * s),
    doorH - Math.round(4 * s)
  );
  g.fillRect(
    doorX + doorW / 2 + Math.round(1 * s),
    doorY + Math.round(4 * s),
    doorW / 2 - Math.round(3 * s),
    doorH - Math.round(4 * s)
  );
  // Crystal door handles
  g.fillStyle(style.crystal);
  g.fillCircle(doorX + Math.round(7 * s), doorY + Math.round(18 * s), Math.round(2 * s));
  g.fillCircle(doorX + doorW - Math.round(7 * s), doorY + Math.round(18 * s), Math.round(2 * s));
  // Transom window
  g.fillStyle(style.windowGlow, 0.5);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY - Math.round(2 * s),
    doorW - Math.round(4 * s),
    Math.round(6 * s)
  );

  // Flanking columns
  for (let c = 0; c < 2; c++) {
    const cx = doorX - Math.round(8 * s) + c * (doorW + Math.round(12 * s));
    g.fillStyle(style.column);
    g.fillRect(cx, doorY - Math.round(4 * s), Math.round(4 * s), doorH + Math.round(4 * s));
    // Column highlight
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(cx + Math.round(1 * s), doorY, Math.round(1 * s), doorH);
  }

  // === ROOFTOP BALUSTRADE ===
  const balY = mainY - roofH - Math.round(12 * s);
  g.fillStyle(style.column);
  g.fillRect(mainX + Math.round(5 * s), balY, mainW - Math.round(10 * s), Math.round(3 * s));
  for (let b = 0; b < 10; b++) {
    g.fillRect(
      mainX + Math.round(8 * s) + b * Math.round(6 * s),
      balY - Math.round(6 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );
  }
  g.fillRect(
    mainX + Math.round(5 * s),
    balY - Math.round(8 * s),
    mainW - Math.round(10 * s),
    Math.round(2 * s)
  );

  // === DECORATIVE URNS on corners ===
  g.fillStyle(style.trim);
  g.fillRect(
    mainX + Math.round(6 * s),
    balY - Math.round(14 * s),
    Math.round(6 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    mainX + mainW - Math.round(12 * s),
    balY - Math.round(14 * s),
    Math.round(6 * s),
    Math.round(6 * s)
  );
  g.fillStyle(style.crystal);
  g.fillCircle(mainX + Math.round(9 * s), balY - Math.round(18 * s), Math.round(4 * s));
  g.fillCircle(mainX + mainW - Math.round(9 * s), balY - Math.round(18 * s), Math.round(4 * s));

  g.generateTexture("mansion_2", canvasWidth, canvasHeight);
  g.destroy();
}

// MANSION 3: Platinum Estate - Art Deco skyscraper-style with dramatic sunburst crown
function generateMansion3_ArtDecoEstate(
  scene: Phaser.Scene,
  s: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  // Art Deco palette: Platinum silver with gold accents
  const style = {
    base: 0x2a2a35, // Dark charcoal
    baseLight: 0x3a3a45,
    baseDark: 0x1a1a25,
    silver: 0xc0c0c0, // Platinum silver
    silverLight: 0xe8e8e8,
    gold: 0xd4af37, // Art Deco gold
    goldBright: 0xffd700,
    window: 0x00d4ff, // Electric blue
    windowGlow: 0x00ffff,
  };
  const centerX = canvasWidth / 2;
  const groundY = canvasHeight - Math.round(8 * s);

  // === FOUNDATION with geometric steps ===
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(5 * s), groundY, canvasWidth - Math.round(10 * s), Math.round(8 * s));
  g.fillStyle(style.silver);
  g.fillRect(
    Math.round(8 * s),
    groundY - Math.round(3 * s),
    canvasWidth - Math.round(16 * s),
    Math.round(4 * s)
  );
  g.fillStyle(style.gold);
  g.fillRect(
    Math.round(10 * s),
    groundY - Math.round(4 * s),
    canvasWidth - Math.round(20 * s),
    Math.round(1 * s)
  );

  // === STEPPED ZIGGURAT TOWER (Center) ===
  const towerW = Math.round(45 * s);
  const towerH = Math.round(110 * s);
  const towerX = centerX - towerW / 2;
  const towerY = groundY - towerH;

  // Shadow
  g.fillStyle(0x000000, 0.5);
  g.fillRect(towerX + Math.round(5 * s), towerY + Math.round(8 * s), towerW, towerH);

  // Main tower body
  g.fillStyle(style.base);
  g.fillRect(towerX, towerY, towerW, towerH);
  // Light edge
  g.fillStyle(style.baseLight);
  g.fillRect(towerX, towerY, Math.round(4 * s), towerH);
  // Dark edge
  g.fillStyle(style.baseDark);
  g.fillRect(towerX + towerW - Math.round(4 * s), towerY, Math.round(4 * s), towerH);

  // Vertical fluting pattern on tower
  g.fillStyle(style.baseLight, 0.3);
  for (let i = 0; i < 8; i++) {
    const fx = towerX + Math.round(5 * s) + i * Math.round(5 * s);
    g.fillRect(fx, towerY + Math.round(10 * s), Math.round(2 * s), towerH - Math.round(20 * s));
  }

  // === SUNBURST CROWN (iconic Art Deco) ===
  const crownY = towerY - Math.round(35 * s);
  // Stepped back element
  g.fillStyle(style.silver);
  g.fillRect(
    centerX - Math.round(28 * s),
    towerY - Math.round(8 * s),
    Math.round(56 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    centerX - Math.round(22 * s),
    towerY - Math.round(18 * s),
    Math.round(44 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    centerX - Math.round(16 * s),
    towerY - Math.round(28 * s),
    Math.round(32 * s),
    Math.round(12 * s)
  );

  // SUNBURST RAYS
  g.fillStyle(style.goldBright);
  // Central tall ray
  g.fillRect(
    centerX - Math.round(3 * s),
    crownY - Math.round(25 * s),
    Math.round(6 * s),
    Math.round(30 * s)
  );
  // Side rays (getting shorter)
  for (let ray = 1; ray <= 4; ray++) {
    const rayH = Math.round((25 - ray * 4) * s);
    const rayOffset = ray * Math.round(6 * s);
    g.fillRect(
      centerX - Math.round(2 * s) - rayOffset,
      crownY - rayH,
      Math.round(3 * s),
      rayH + Math.round(5 * s)
    );
    g.fillRect(
      centerX - Math.round(1 * s) + rayOffset,
      crownY - rayH,
      Math.round(3 * s),
      rayH + Math.round(5 * s)
    );
  }

  // Sunburst center medallion
  g.fillStyle(style.gold);
  g.fillCircle(centerX, crownY + Math.round(2 * s), Math.round(10 * s));
  g.fillStyle(style.goldBright);
  g.fillCircle(centerX, crownY + Math.round(2 * s), Math.round(7 * s));
  g.fillStyle(style.windowGlow, 0.7);
  g.fillCircle(centerX, crownY + Math.round(2 * s), Math.round(4 * s));

  // === LEFT WING (stepped) ===
  const wingW = Math.round(30 * s);
  const wingH = Math.round(75 * s);
  const leftX = towerX - wingW + Math.round(6 * s);
  const leftY = groundY - wingH;

  g.fillStyle(0x000000, 0.4);
  g.fillRect(leftX + Math.round(4 * s), leftY + Math.round(6 * s), wingW, wingH);
  g.fillStyle(style.base);
  g.fillRect(leftX, leftY, wingW, wingH);
  g.fillStyle(style.baseLight);
  g.fillRect(leftX, leftY, Math.round(4 * s), wingH);

  // Left wing stepped top
  g.fillStyle(style.silver);
  g.fillRect(
    leftX - Math.round(2 * s),
    leftY - Math.round(5 * s),
    wingW + Math.round(4 * s),
    Math.round(6 * s)
  );
  g.fillStyle(style.gold);
  g.fillRect(leftX, leftY - Math.round(6 * s), wingW, Math.round(2 * s));

  // === RIGHT WING (stepped) ===
  const rightX = towerX + towerW - Math.round(6 * s);
  const rightH = Math.round(60 * s);
  const rightY = groundY - rightH;

  g.fillStyle(0x000000, 0.4);
  g.fillRect(rightX + Math.round(4 * s), rightY + Math.round(6 * s), wingW, rightH);
  g.fillStyle(style.base);
  g.fillRect(rightX, rightY, wingW, rightH);
  g.fillStyle(style.baseDark);
  g.fillRect(rightX + wingW - Math.round(4 * s), rightY, Math.round(4 * s), rightH);

  // Right wing stepped top
  g.fillStyle(style.silver);
  g.fillRect(
    rightX - Math.round(2 * s),
    rightY - Math.round(5 * s),
    wingW + Math.round(4 * s),
    Math.round(6 * s)
  );
  g.fillStyle(style.gold);
  g.fillRect(rightX, rightY - Math.round(6 * s), wingW, Math.round(2 * s));

  // === CHEVRON BANDS (Art Deco motif) ===
  g.fillStyle(style.gold, 0.8);
  for (let band = 0; band < 3; band++) {
    const bandY = towerY + Math.round(20 * s) + band * Math.round(30 * s);
    // Left chevron
    g.fillTriangle(
      towerX,
      bandY + Math.round(6 * s),
      towerX + Math.round(20 * s),
      bandY,
      towerX + Math.round(20 * s),
      bandY + Math.round(6 * s)
    );
    // Right chevron
    g.fillTriangle(
      towerX + towerW,
      bandY + Math.round(6 * s),
      towerX + towerW - Math.round(20 * s),
      bandY,
      towerX + towerW - Math.round(20 * s),
      bandY + Math.round(6 * s)
    );
  }

  // === GEOMETRIC WINDOWS with glow ===
  // Tower windows (3 vertical columns)
  for (let col = 0; col < 3; col++) {
    const wx = towerX + Math.round(8 * s) + col * Math.round(14 * s);
    for (let row = 0; row < 5; row++) {
      const wy = towerY + Math.round(40 * s) + row * Math.round(14 * s);
      // Outer glow
      g.fillStyle(style.windowGlow, 0.25);
      g.fillRect(
        wx - Math.round(2 * s),
        wy - Math.round(2 * s),
        Math.round(12 * s),
        Math.round(12 * s)
      );
      // Window
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(8 * s), Math.round(8 * s));
      // Geometric divider (cross)
      g.fillStyle(style.silver);
      g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(8 * s));
      g.fillRect(wx, wy + Math.round(3.5 * s), Math.round(8 * s), Math.round(1 * s));
      // Corner highlight
      g.fillStyle(style.windowGlow, 0.6);
      g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));
    }
  }

  // Left wing windows (2 columns)
  for (let col = 0; col < 2; col++) {
    const wx = leftX + Math.round(6 * s) + col * Math.round(12 * s);
    for (let row = 0; row < 4; row++) {
      const wy = leftY + Math.round(10 * s) + row * Math.round(16 * s);
      g.fillStyle(style.windowGlow, 0.2);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        Math.round(10 * s),
        Math.round(14 * s)
      );
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(8 * s), Math.round(12 * s));
      g.fillStyle(style.silver);
      g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(12 * s));
    }
  }

  // Right wing windows (2 columns)
  for (let col = 0; col < 2; col++) {
    const wx = rightX + Math.round(6 * s) + col * Math.round(12 * s);
    for (let row = 0; row < 3; row++) {
      const wy = rightY + Math.round(10 * s) + row * Math.round(16 * s);
      g.fillStyle(style.windowGlow, 0.2);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        Math.round(10 * s),
        Math.round(14 * s)
      );
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(8 * s), Math.round(12 * s));
      g.fillStyle(style.silver);
      g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(12 * s));
    }
  }

  // === GRAND GEOMETRIC ENTRANCE ===
  const doorW = Math.round(18 * s);
  const doorH = Math.round(30 * s);
  const doorX = centerX - doorW / 2;
  const doorY = groundY - doorH;

  // Door frame with stepped Art Deco surround
  g.fillStyle(style.silver);
  g.fillRect(
    doorX - Math.round(8 * s),
    doorY - Math.round(12 * s),
    doorW + Math.round(16 * s),
    doorH + Math.round(12 * s)
  );
  g.fillStyle(style.gold);
  g.fillRect(
    doorX - Math.round(6 * s),
    doorY - Math.round(10 * s),
    doorW + Math.round(12 * s),
    doorH + Math.round(10 * s)
  );
  g.fillStyle(style.baseDark);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(8 * s),
    doorW + Math.round(8 * s),
    doorH + Math.round(8 * s)
  );

  // Door
  g.fillStyle(0x0a0a0a);
  g.fillRect(doorX, doorY, doorW, doorH);
  // Door glass panels
  g.fillStyle(style.window, 0.7);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(2 * s),
    Math.round(6 * s),
    Math.round(20 * s)
  );
  g.fillRect(
    doorX + Math.round(10 * s),
    doorY + Math.round(2 * s),
    Math.round(6 * s),
    Math.round(20 * s)
  );
  // Transom with sunburst pattern
  g.fillStyle(style.goldBright);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(8 * s),
    doorW + Math.round(8 * s),
    Math.round(8 * s)
  );
  g.fillStyle(style.window);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(6 * s),
    doorW + Math.round(4 * s),
    Math.round(5 * s)
  );
  // Mini sunburst in transom
  g.fillStyle(style.gold);
  for (let r = 0; r < 5; r++) {
    const rx = centerX - Math.round(8 * s) + r * Math.round(4 * s);
    g.fillRect(rx, doorY - Math.round(6 * s), Math.round(1 * s), Math.round(5 * s));
  }

  // Door handle
  g.fillStyle(style.goldBright);
  g.fillRect(
    doorX + doorW - Math.round(4 * s),
    doorY + Math.round(14 * s),
    Math.round(2 * s),
    Math.round(4 * s)
  );

  // === DECORATIVE EAGLES (Art Deco motif) ===
  // Stylized eagle shapes on wings
  g.fillStyle(style.gold);
  // Left eagle
  g.fillTriangle(
    leftX + Math.round(15 * s),
    leftY + Math.round(5 * s),
    leftX + Math.round(8 * s),
    leftY - Math.round(2 * s),
    leftX + Math.round(22 * s),
    leftY - Math.round(2 * s)
  );
  // Right eagle
  g.fillTriangle(
    rightX + Math.round(15 * s),
    rightY + Math.round(5 * s),
    rightX + Math.round(8 * s),
    rightY - Math.round(2 * s),
    rightX + Math.round(22 * s),
    rightY - Math.round(2 * s)
  );

  g.generateTexture("mansion_3", canvasWidth, canvasHeight);
  g.destroy();
}

// MANSION 4: Emerald Manor - Georgian Colonial masterpiece with grand portico and gardens
function generateMansion4_ColonialManor(
  scene: Phaser.Scene,
  s: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  // Emerald/garden theme with cream accents
  const style = {
    base: 0xf5f5dc, // Cream/beige walls
    baseLight: 0xfdfdf5,
    baseDark: 0xe8e8d0,
    roof: 0x1a3d1a, // Deep forest green
    roofLight: 0x2d5a2d,
    trim: 0x228b22, // Emerald green
    trimLight: 0x32cd32,
    window: 0x98fb98, // Pale green glow
    windowGlow: 0x00ff7f,
    column: 0xffffff, // Pure white columns
    columnShade: 0xe8e8e8,
    shutter: 0x0d4a0d, // Dark green shutters
    brick: 0x8b4513, // Brick chimneys
  };
  const centerX = canvasWidth / 2;
  const groundY = canvasHeight - Math.round(8 * s);

  // === GARDEN FOUNDATION/TERRACE ===
  g.fillStyle(0x4a4a4a);
  g.fillRect(Math.round(3 * s), groundY, canvasWidth - Math.round(6 * s), Math.round(8 * s));
  // Stone terrace
  g.fillStyle(0x9ca3af);
  g.fillRect(
    Math.round(5 * s),
    groundY - Math.round(4 * s),
    canvasWidth - Math.round(10 * s),
    Math.round(5 * s)
  );
  // Garden grass strip
  g.fillStyle(0x228b22);
  g.fillRect(Math.round(3 * s), groundY - Math.round(2 * s), Math.round(12 * s), Math.round(3 * s));
  g.fillRect(
    canvasWidth - Math.round(15 * s),
    groundY - Math.round(2 * s),
    Math.round(12 * s),
    Math.round(3 * s)
  );

  // === TOPIARIES (garden elements) ===
  // Left topiary ball
  g.fillStyle(0x0d4a0d);
  g.fillCircle(Math.round(12 * s), groundY - Math.round(12 * s), Math.round(8 * s));
  g.fillStyle(0x115511);
  g.fillCircle(Math.round(12 * s), groundY - Math.round(14 * s), Math.round(5 * s));
  g.fillStyle(0x5c4033); // Pot
  g.fillRect(Math.round(8 * s), groundY - Math.round(4 * s), Math.round(8 * s), Math.round(5 * s));
  // Right topiary ball
  g.fillStyle(0x0d4a0d);
  g.fillCircle(canvasWidth - Math.round(12 * s), groundY - Math.round(12 * s), Math.round(8 * s));
  g.fillStyle(0x115511);
  g.fillCircle(canvasWidth - Math.round(12 * s), groundY - Math.round(14 * s), Math.round(5 * s));
  g.fillStyle(0x5c4033);
  g.fillRect(
    canvasWidth - Math.round(16 * s),
    groundY - Math.round(4 * s),
    Math.round(8 * s),
    Math.round(5 * s)
  );

  // === MAIN HOUSE BODY (wide Georgian) ===
  const mainW = Math.round(80 * s);
  const mainH = Math.round(70 * s);
  const mainX = centerX - mainW / 2;
  const mainY = groundY - mainH;

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillRect(mainX + Math.round(5 * s), mainY + Math.round(8 * s), mainW, mainH);

  // Main body cream walls
  g.fillStyle(style.base);
  g.fillRect(mainX, mainY, mainW, mainH);
  // Light edge
  g.fillStyle(style.baseLight);
  g.fillRect(mainX, mainY, Math.round(5 * s), mainH);
  // Dark edge
  g.fillStyle(style.baseDark);
  g.fillRect(mainX + mainW - Math.round(5 * s), mainY, Math.round(5 * s), mainH);

  // Horizontal trim bands (Georgian style)
  g.fillStyle(style.trim);
  g.fillRect(mainX, mainY + Math.round(25 * s), mainW, Math.round(3 * s)); // Floor line
  g.fillRect(mainX, mainY + Math.round(50 * s), mainW, Math.round(2 * s)); // Second floor line

  // Quoin corners (stone block pattern)
  g.fillStyle(0xd3d3d3);
  for (let q = 0; q < 6; q++) {
    const qy = mainY + Math.round(5 * s) + q * Math.round(11 * s);
    g.fillRect(mainX, qy, Math.round(6 * s), Math.round(8 * s));
    g.fillRect(mainX + mainW - Math.round(6 * s), qy, Math.round(6 * s), Math.round(8 * s));
  }

  // === GRAND HIPPED ROOF ===
  const roofH = Math.round(28 * s);
  g.fillStyle(style.roof);
  g.fillRect(mainX - Math.round(8 * s), mainY - roofH, mainW + Math.round(16 * s), roofH);
  // Sloped edges
  g.fillStyle(darken(style.roof, 0.2));
  g.fillTriangle(
    mainX - Math.round(8 * s),
    mainY,
    mainX - Math.round(8 * s),
    mainY - roofH,
    mainX + Math.round(15 * s),
    mainY - roofH
  );
  g.fillTriangle(
    mainX + mainW + Math.round(8 * s),
    mainY,
    mainX + mainW + Math.round(8 * s),
    mainY - roofH,
    mainX + mainW - Math.round(15 * s),
    mainY - roofH
  );
  // Roof highlight
  g.fillStyle(style.roofLight);
  g.fillRect(
    mainX - Math.round(8 * s),
    mainY - roofH,
    mainW + Math.round(16 * s),
    Math.round(4 * s)
  );
  // Roof trim
  g.fillStyle(style.column);
  g.fillRect(
    mainX - Math.round(10 * s),
    mainY - Math.round(2 * s),
    mainW + Math.round(20 * s),
    Math.round(4 * s)
  );

  // === THREE DORMERS ===
  const dormerW = Math.round(14 * s);
  const dormerH = Math.round(16 * s);
  for (let d = 0; d < 3; d++) {
    const dormerX = mainX + Math.round(15 * s) + d * Math.round(28 * s);
    const dormerY = mainY - roofH - dormerH + Math.round(10 * s);
    // Dormer body
    g.fillStyle(style.base);
    g.fillRect(dormerX, dormerY + Math.round(6 * s), dormerW, dormerH - Math.round(4 * s));
    // Dormer roof (pediment)
    g.fillStyle(style.roof);
    g.fillTriangle(
      dormerX - Math.round(2 * s),
      dormerY + Math.round(6 * s),
      dormerX + dormerW + Math.round(2 * s),
      dormerY + Math.round(6 * s),
      dormerX + dormerW / 2,
      dormerY - Math.round(6 * s)
    );
    // Dormer window with glow
    g.fillStyle(style.windowGlow, 0.3);
    g.fillRect(
      dormerX + Math.round(2 * s),
      dormerY + Math.round(8 * s),
      Math.round(10 * s),
      Math.round(10 * s)
    );
    g.fillStyle(style.window);
    g.fillRect(
      dormerX + Math.round(3 * s),
      dormerY + Math.round(9 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    // Window mullion
    g.fillStyle(style.column);
    g.fillRect(
      dormerX + Math.round(6.5 * s),
      dormerY + Math.round(9 * s),
      Math.round(1 * s),
      Math.round(8 * s)
    );
  }

  // === GRAND CHIMNEYS (symmetrical, detailed) ===
  for (let ch = 0; ch < 2; ch++) {
    const chimX = ch === 0 ? mainX + Math.round(8 * s) : mainX + mainW - Math.round(14 * s);
    const chimY = mainY - roofH - Math.round(22 * s);
    // Chimney body
    g.fillStyle(style.brick);
    g.fillRect(chimX, chimY, Math.round(6 * s), Math.round(28 * s));
    // Chimney cap
    g.fillStyle(darken(style.brick, 0.15));
    g.fillRect(chimX - Math.round(1 * s), chimY, Math.round(8 * s), Math.round(3 * s));
    // Chimney band
    g.fillStyle(lighten(style.brick, 0.15));
    g.fillRect(chimX, chimY + Math.round(8 * s), Math.round(6 * s), Math.round(2 * s));
  }

  // === GRAND CENTRAL PORTICO with pediment ===
  const porticoW = Math.round(40 * s);
  const porticoH = Math.round(50 * s);
  const porticoX = centerX - porticoW / 2;
  const porticoY = groundY - porticoH;

  // Portico roof/pediment
  g.fillStyle(style.roof);
  g.fillRect(
    porticoX - Math.round(4 * s),
    porticoY - Math.round(6 * s),
    porticoW + Math.round(8 * s),
    Math.round(8 * s)
  );
  // Triangular pediment
  g.fillTriangle(
    porticoX - Math.round(6 * s),
    porticoY - Math.round(6 * s),
    porticoX + porticoW + Math.round(6 * s),
    porticoY - Math.round(6 * s),
    centerX,
    porticoY - Math.round(22 * s)
  );
  // Pediment highlight
  g.fillStyle(style.roofLight);
  g.fillRect(
    porticoX - Math.round(4 * s),
    porticoY - Math.round(6 * s),
    porticoW + Math.round(8 * s),
    Math.round(2 * s)
  );
  // Pediment trim (tympanum)
  g.fillStyle(style.base);
  g.fillTriangle(
    porticoX - Math.round(2 * s),
    porticoY - Math.round(4 * s),
    porticoX + porticoW + Math.round(2 * s),
    porticoY - Math.round(4 * s),
    centerX,
    porticoY - Math.round(18 * s)
  );
  // Decorative medallion in pediment
  g.fillStyle(style.trim);
  g.fillCircle(centerX, porticoY - Math.round(12 * s), Math.round(5 * s));
  g.fillStyle(style.trimLight);
  g.fillCircle(centerX, porticoY - Math.round(12 * s), Math.round(3 * s));

  // === FOUR GRAND CORINTHIAN COLUMNS ===
  const colCount = 4;
  const colSpacing = (porticoW - Math.round(12 * s)) / (colCount - 1);
  for (let c = 0; c < colCount; c++) {
    const cx = porticoX + Math.round(6 * s) + c * colSpacing;
    const colH = porticoH - Math.round(8 * s);

    // Column base (plinth)
    g.fillStyle(style.columnShade);
    g.fillRect(
      cx - Math.round(2 * s),
      groundY - Math.round(6 * s),
      Math.round(8 * s),
      Math.round(6 * s)
    );

    // Column shaft with fluting
    g.fillStyle(style.column);
    g.fillRect(cx, porticoY, Math.round(4 * s), colH);
    // Column highlight (light side)
    g.fillStyle(0xffffff);
    g.fillRect(cx, porticoY, Math.round(1 * s), colH);
    // Column shadow (dark side)
    g.fillStyle(style.columnShade);
    g.fillRect(cx + Math.round(3 * s), porticoY, Math.round(1 * s), colH);

    // Fluting detail
    g.fillStyle(style.columnShade, 0.3);
    g.fillRect(
      cx + Math.round(1.5 * s),
      porticoY + Math.round(4 * s),
      Math.round(1 * s),
      colH - Math.round(10 * s)
    );

    // Capital (Corinthian style)
    g.fillStyle(style.column);
    g.fillRect(
      cx - Math.round(2 * s),
      porticoY - Math.round(4 * s),
      Math.round(8 * s),
      Math.round(5 * s)
    );
    g.fillStyle(style.trim);
    g.fillRect(
      cx - Math.round(3 * s),
      porticoY - Math.round(5 * s),
      Math.round(10 * s),
      Math.round(2 * s)
    );
    // Acanthus leaf detail
    g.fillStyle(style.trimLight);
    g.fillRect(
      cx - Math.round(1 * s),
      porticoY - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      cx + Math.round(3 * s),
      porticoY - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );
  }

  // === WINDOWS (Georgian 6-over-6 sash style) ===
  // Second floor windows (5 total)
  for (let w = 0; w < 5; w++) {
    const wx = mainX + Math.round(10 * s) + w * Math.round(14 * s);
    const wy = mainY + Math.round(6 * s);
    // Skip center windows (behind pediment)
    if (w === 2) continue;
    // Window glow
    g.fillStyle(style.windowGlow, 0.25);
    g.fillRect(
      wx - Math.round(2 * s),
      wy - Math.round(2 * s),
      Math.round(12 * s),
      Math.round(18 * s)
    );
    // Window frame
    g.fillStyle(style.column);
    g.fillRect(
      wx - Math.round(1 * s),
      wy - Math.round(1 * s),
      Math.round(10 * s),
      Math.round(16 * s)
    );
    // Window glass
    g.fillStyle(style.window);
    g.fillRect(wx, wy, Math.round(8 * s), Math.round(14 * s));
    // Mullions (6-over-6 pattern)
    g.fillStyle(style.column);
    g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(14 * s)); // Vertical
    g.fillRect(wx, wy + Math.round(6.5 * s), Math.round(8 * s), Math.round(1 * s)); // Horizontal
    // Sash dividers
    for (let div = 0; div < 2; div++) {
      g.fillRect(
        wx,
        wy + Math.round(2 * s) + div * Math.round(4 * s),
        Math.round(8 * s),
        Math.round(0.5 * s)
      );
      g.fillRect(
        wx,
        wy + Math.round(9 * s) + div * Math.round(3 * s),
        Math.round(8 * s),
        Math.round(0.5 * s)
      );
    }
    // Shutters
    g.fillStyle(style.shutter);
    g.fillRect(wx - Math.round(4 * s), wy, Math.round(3 * s), Math.round(14 * s));
    g.fillRect(wx + Math.round(9 * s), wy, Math.round(3 * s), Math.round(14 * s));
    // Shutter slats
    g.fillStyle(lighten(style.shutter, 0.15));
    for (let slat = 0; slat < 5; slat++) {
      g.fillRect(
        wx - Math.round(4 * s),
        wy + Math.round(2 * s) + slat * Math.round(3 * s),
        Math.round(3 * s),
        Math.round(1 * s)
      );
      g.fillRect(
        wx + Math.round(9 * s),
        wy + Math.round(2 * s) + slat * Math.round(3 * s),
        Math.round(3 * s),
        Math.round(1 * s)
      );
    }
  }

  // First floor windows (4 total, flanking door)
  for (let w = 0; w < 4; w++) {
    // Skip middle two (door area)
    if (w === 1 || w === 2) continue;
    const wx = mainX + Math.round(10 * s) + w * Math.round(18 * s);
    const wy = mainY + Math.round(32 * s);
    // Window glow
    g.fillStyle(style.windowGlow, 0.25);
    g.fillRect(
      wx - Math.round(2 * s),
      wy - Math.round(2 * s),
      Math.round(14 * s),
      Math.round(20 * s)
    );
    // Window frame
    g.fillStyle(style.column);
    g.fillRect(
      wx - Math.round(1 * s),
      wy - Math.round(1 * s),
      Math.round(12 * s),
      Math.round(18 * s)
    );
    // Window glass
    g.fillStyle(style.window);
    g.fillRect(wx, wy, Math.round(10 * s), Math.round(16 * s));
    // Mullions
    g.fillStyle(style.column);
    g.fillRect(wx + Math.round(4.5 * s), wy, Math.round(1 * s), Math.round(16 * s));
    g.fillRect(wx, wy + Math.round(7.5 * s), Math.round(10 * s), Math.round(1 * s));
    // Shutters
    g.fillStyle(style.shutter);
    g.fillRect(wx - Math.round(5 * s), wy, Math.round(4 * s), Math.round(16 * s));
    g.fillRect(wx + Math.round(11 * s), wy, Math.round(4 * s), Math.round(16 * s));
  }

  // === GRAND ENTRANCE DOOR (Georgian style with fanlight) ===
  const doorW = Math.round(16 * s);
  const doorH = Math.round(32 * s);
  const doorX = centerX - doorW / 2;
  const doorY = groundY - doorH;

  // Door frame surround
  g.fillStyle(style.column);
  g.fillRect(
    doorX - Math.round(5 * s),
    doorY - Math.round(14 * s),
    doorW + Math.round(10 * s),
    doorH + Math.round(14 * s)
  );
  // Frame trim
  g.fillStyle(style.trim);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(12 * s),
    doorW + Math.round(8 * s),
    doorH + Math.round(12 * s)
  );

  // Fanlight (semi-circular transom)
  g.fillStyle(style.windowGlow, 0.4);
  g.fillCircle(centerX, doorY - Math.round(2 * s), Math.round(10 * s));
  g.fillStyle(style.window);
  g.fillCircle(centerX, doorY - Math.round(2 * s), Math.round(8 * s));
  // Fanlight spokes
  g.fillStyle(style.column);
  for (let spoke = 0; spoke < 7; spoke++) {
    const angle = Math.PI / 8 + spoke * (Math.PI / 7);
    const x1 = centerX;
    const y1 = doorY - Math.round(2 * s);
    const x2 = centerX + Math.cos(angle) * Math.round(8 * s);
    const y2 = doorY - Math.round(2 * s) - Math.sin(angle) * Math.round(8 * s);
    // Draw spoke as thin rectangle
    g.fillRect(x1, y1 - Math.round(8 * s), Math.round(1 * s), Math.round(8 * s));
  }
  // Cover bottom half of fanlight circle
  g.fillStyle(style.trim);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(2 * s),
    doorW + Math.round(8 * s),
    Math.round(4 * s)
  );

  // Door panels
  g.fillStyle(0x1a1a1a);
  g.fillRect(doorX, doorY, doorW, doorH);
  g.fillStyle(style.shutter);
  g.fillRect(
    doorX + Math.round(1 * s),
    doorY + Math.round(2 * s),
    doorW - Math.round(2 * s),
    doorH - Math.round(4 * s)
  );
  // Door panel details
  g.fillStyle(lighten(style.shutter, 0.1));
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(4 * s),
    Math.round(5 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    doorX + Math.round(9 * s),
    doorY + Math.round(4 * s),
    Math.round(5 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(18 * s),
    Math.round(5 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    doorX + Math.round(9 * s),
    doorY + Math.round(18 * s),
    Math.round(5 * s),
    Math.round(10 * s)
  );
  // Door knocker
  g.fillStyle(0xd4af37);
  g.fillCircle(centerX, doorY + Math.round(14 * s), Math.round(2 * s));

  // Sidelights
  g.fillStyle(style.windowGlow, 0.3);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY + Math.round(4 * s),
    Math.round(3 * s),
    Math.round(24 * s)
  );
  g.fillRect(
    doorX + doorW + Math.round(1 * s),
    doorY + Math.round(4 * s),
    Math.round(3 * s),
    Math.round(24 * s)
  );
  g.fillStyle(style.window);
  g.fillRect(
    doorX - Math.round(3.5 * s),
    doorY + Math.round(5 * s),
    Math.round(2 * s),
    Math.round(22 * s)
  );
  g.fillRect(
    doorX + doorW + Math.round(1.5 * s),
    doorY + Math.round(5 * s),
    Math.round(2 * s),
    Math.round(22 * s)
  );

  g.generateTexture("mansion_4", canvasWidth, canvasHeight);
  g.destroy();
}

/**
 * Generate Ballers Valley luxury props - High-end decorations for the VIP zone
 * Includes: manicured lawn, marble path, gold fountain, gold lamps, topiaries, gates, urns
 */
export function generateBallersProps(scene: Phaser.Scene): void {
  const s = SCALE;

  // === LUXURY MANICURED LAWN (tileable) ===
  const lawnSize = Math.round(32 * s);
  const lawn = scene.make.graphics({ x: 0, y: 0 });
  // Deep rich green base
  lawn.fillStyle(0x0d4a0d);
  lawn.fillRect(0, 0, lawnSize, lawnSize);
  // Stripe pattern (golf course look)
  lawn.fillStyle(0x115511, 0.4);
  lawn.fillRect(0, 0, lawnSize / 2, lawnSize);
  // Subtle grass texture
  lawn.fillStyle(0x166616);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(Math.random() * (lawnSize - 4));
    const y = Math.floor(Math.random() * (lawnSize - 6));
    lawn.fillRect(x, y, Math.round(2 * s), Math.round(4 * s));
  }
  // Highlight blades
  lawn.fillStyle(0x1a7a1a);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(Math.random() * (lawnSize - 3));
    const y = Math.floor(Math.random() * (lawnSize - 5));
    lawn.fillRect(x, y, Math.round(1 * s), Math.round(3 * s));
  }
  lawn.generateTexture("luxury_lawn", lawnSize, lawnSize);
  lawn.destroy();

  // === MARBLE PATH TILE (tileable) ===
  const marbleSize = Math.round(32 * s);
  const marble = scene.make.graphics({ x: 0, y: 0 });
  // Cream marble base
  marble.fillStyle(0xf5f0e6);
  marble.fillRect(0, 0, marbleSize, marbleSize);
  // Tile grid lines
  marble.fillStyle(0xe8e0d0);
  marble.fillRect(0, 0, marbleSize, Math.round(2 * s));
  marble.fillRect(0, 0, Math.round(2 * s), marbleSize);
  // Subtle marble veining
  marble.fillStyle(0xebe5da, 0.6);
  marble.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(12 * s), Math.round(2 * s));
  marble.fillRect(Math.round(4 * s), Math.round(16 * s), Math.round(8 * s), Math.round(2 * s));
  // Gold inlay accent
  marble.fillStyle(0xd4a017);
  marble.fillRect(
    marbleSize - Math.round(4 * s),
    marbleSize - Math.round(4 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  marble.generateTexture("marble_path", marbleSize, marbleSize);
  marble.destroy();

  // === GOLD FOUNTAIN (ornate) ===
  const fountainW = Math.round(50 * s);
  const fountainH = Math.round(55 * s);
  const gf = scene.make.graphics({ x: 0, y: 0 });
  // Outer marble basin
  gf.fillStyle(0xe8e4dc);
  gf.fillRect(Math.round(3 * s), Math.round(40 * s), Math.round(44 * s), Math.round(12 * s));
  // Basin shadow
  gf.fillStyle(0xd4cfc4);
  gf.fillRect(Math.round(5 * s), Math.round(48 * s), Math.round(40 * s), Math.round(4 * s));
  // Gold basin rim
  gf.fillStyle(0xd4a017);
  gf.fillRect(Math.round(2 * s), Math.round(38 * s), Math.round(46 * s), Math.round(4 * s));
  gf.fillStyle(0xffd700);
  gf.fillRect(Math.round(4 * s), Math.round(38 * s), Math.round(42 * s), Math.round(2 * s));
  // Water pool
  gf.fillStyle(0x4fc3f7);
  gf.fillRect(Math.round(8 * s), Math.round(42 * s), Math.round(34 * s), Math.round(8 * s));
  // Water shimmer
  gf.fillStyle(0x81d4fa, 0.6);
  gf.fillRect(Math.round(12 * s), Math.round(44 * s), Math.round(10 * s), Math.round(3 * s));
  // Middle tier (gold)
  gf.fillStyle(0xb8860b);
  gf.fillRect(Math.round(16 * s), Math.round(28 * s), Math.round(18 * s), Math.round(12 * s));
  gf.fillStyle(0xd4a017);
  gf.fillRect(Math.round(18 * s), Math.round(28 * s), Math.round(14 * s), Math.round(10 * s));
  // Middle tier highlight
  gf.fillStyle(0xffd700);
  gf.fillRect(Math.round(18 * s), Math.round(28 * s), Math.round(4 * s), Math.round(8 * s));
  // Gold band
  gf.fillStyle(0xffd700);
  gf.fillRect(Math.round(14 * s), Math.round(26 * s), Math.round(22 * s), Math.round(3 * s));
  // Top pillar
  gf.fillStyle(0xd4a017);
  gf.fillRect(Math.round(21 * s), Math.round(12 * s), Math.round(8 * s), Math.round(16 * s));
  gf.fillStyle(0xffd700);
  gf.fillRect(Math.round(22 * s), Math.round(12 * s), Math.round(3 * s), Math.round(14 * s));
  // Crown/finial
  gf.fillStyle(0xffd700);
  gf.fillRect(Math.round(19 * s), Math.round(8 * s), Math.round(12 * s), Math.round(5 * s));
  // Spire
  gf.fillStyle(0xffd700);
  gf.fillTriangle(
    Math.round(25 * s),
    Math.round(2 * s),
    Math.round(21 * s),
    Math.round(9 * s),
    Math.round(29 * s),
    Math.round(9 * s)
  );
  // Spire highlight
  gf.fillStyle(0xffec8b);
  gf.fillRect(Math.round(24 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));
  gf.generateTexture("gold_fountain", fountainW, fountainH);
  gf.destroy();

  // === GOLD LAMP POST ===
  const lampW = Math.round(24 * s);
  const lampH = Math.round(70 * s);
  const gl = scene.make.graphics({ x: 0, y: 0 });
  // Base
  gl.fillStyle(0xb8860b);
  gl.fillRect(Math.round(6 * s), Math.round(60 * s), Math.round(12 * s), Math.round(10 * s));
  gl.fillStyle(0xd4a017);
  gl.fillRect(Math.round(7 * s), Math.round(62 * s), Math.round(10 * s), Math.round(6 * s));
  // Pole
  gl.fillStyle(0xb8860b);
  gl.fillRect(Math.round(10 * s), Math.round(20 * s), Math.round(4 * s), Math.round(42 * s));
  gl.fillStyle(0xd4a017);
  gl.fillRect(Math.round(11 * s), Math.round(20 * s), Math.round(2 * s), Math.round(40 * s));
  // Decorative rings on pole
  gl.fillStyle(0xffd700);
  gl.fillRect(Math.round(9 * s), Math.round(35 * s), Math.round(6 * s), Math.round(3 * s));
  gl.fillRect(Math.round(9 * s), Math.round(50 * s), Math.round(6 * s), Math.round(3 * s));
  // Lamp housing
  gl.fillStyle(0xb8860b);
  gl.fillRect(Math.round(5 * s), Math.round(10 * s), Math.round(14 * s), Math.round(12 * s));
  gl.fillStyle(0xd4a017);
  gl.fillRect(Math.round(6 * s), Math.round(11 * s), Math.round(12 * s), Math.round(10 * s));
  // Glass/light
  gl.fillStyle(0xfffacd);
  gl.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(8 * s), Math.round(6 * s));
  // Glow effect
  gl.fillStyle(0xfff8dc, 0.3);
  gl.fillRect(Math.round(4 * s), Math.round(8 * s), Math.round(16 * s), Math.round(16 * s));
  gl.fillStyle(0xfff8dc, 0.15);
  gl.fillRect(Math.round(2 * s), Math.round(6 * s), Math.round(20 * s), Math.round(20 * s));
  // Top finial
  gl.fillStyle(0xffd700);
  gl.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(7 * s));
  gl.fillCircle(Math.round(12 * s), Math.round(3 * s), Math.round(3 * s));
  gl.generateTexture("gold_lamp", lampW, lampH);
  gl.destroy();

  // === TOPIARY (cone-shaped hedge in gold pot) ===
  const topiaryW = Math.round(32 * s);
  const topiaryH = Math.round(60 * s);
  const tp = scene.make.graphics({ x: 0, y: 0 });
  // Gold pot
  tp.fillStyle(0xb8860b);
  tp.fillRect(Math.round(8 * s), Math.round(48 * s), Math.round(16 * s), Math.round(12 * s));
  tp.fillStyle(0xd4a017);
  tp.fillRect(Math.round(9 * s), Math.round(50 * s), Math.round(14 * s), Math.round(8 * s));
  // Pot rim
  tp.fillStyle(0xffd700);
  tp.fillRect(Math.round(6 * s), Math.round(46 * s), Math.round(20 * s), Math.round(4 * s));
  // Pot highlight
  tp.fillStyle(0xffec8b);
  tp.fillRect(Math.round(10 * s), Math.round(50 * s), Math.round(4 * s), Math.round(6 * s));
  // Cone-shaped hedge (layered for depth)
  // Bottom layer (widest)
  tp.fillStyle(0x145214);
  tp.fillRect(Math.round(6 * s), Math.round(38 * s), Math.round(20 * s), Math.round(10 * s));
  // Second layer
  tp.fillStyle(0x166534);
  tp.fillRect(Math.round(8 * s), Math.round(28 * s), Math.round(16 * s), Math.round(12 * s));
  // Third layer
  tp.fillStyle(0x1a7a1a);
  tp.fillRect(Math.round(10 * s), Math.round(18 * s), Math.round(12 * s), Math.round(12 * s));
  // Fourth layer
  tp.fillStyle(0x22c55e);
  tp.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(8 * s), Math.round(10 * s));
  // Top
  tp.fillStyle(0x4ade80);
  tp.fillRect(Math.round(14 * s), Math.round(4 * s), Math.round(4 * s), Math.round(8 * s));
  // Left edge highlight
  tp.fillStyle(0x22c55e, 0.5);
  tp.fillRect(Math.round(6 * s), Math.round(28 * s), Math.round(3 * s), Math.round(18 * s));
  // Right edge shadow
  tp.fillStyle(0x0d3d0d, 0.4);
  tp.fillRect(Math.round(23 * s), Math.round(28 * s), Math.round(3 * s), Math.round(18 * s));
  tp.generateTexture("topiary", topiaryW, topiaryH);
  tp.destroy();

  // === IRON GATE ===
  const gateW = Math.round(50 * s);
  const gateH = Math.round(70 * s);
  const gate = scene.make.graphics({ x: 0, y: 0 });
  // Stone pillar
  gate.fillStyle(0x4a4a4a);
  gate.fillRect(Math.round(2 * s), Math.round(15 * s), Math.round(14 * s), Math.round(55 * s));
  gate.fillStyle(0x5a5a5a);
  gate.fillRect(Math.round(4 * s), Math.round(17 * s), Math.round(10 * s), Math.round(51 * s));
  // Pillar highlight
  gate.fillStyle(0x6a6a6a);
  gate.fillRect(Math.round(4 * s), Math.round(17 * s), Math.round(3 * s), Math.round(48 * s));
  // Gold ball on top
  gate.fillStyle(0xd4a017);
  gate.fillCircle(Math.round(9 * s), Math.round(12 * s), Math.round(6 * s));
  gate.fillStyle(0xffd700);
  gate.fillCircle(Math.round(8 * s), Math.round(10 * s), Math.round(3 * s));
  // Iron bars
  gate.fillStyle(0x1a1a1a);
  gate.fillRect(Math.round(18 * s), Math.round(20 * s), Math.round(3 * s), Math.round(45 * s));
  gate.fillRect(Math.round(28 * s), Math.round(20 * s), Math.round(3 * s), Math.round(45 * s));
  gate.fillRect(Math.round(38 * s), Math.round(20 * s), Math.round(3 * s), Math.round(45 * s));
  // Horizontal bars
  gate.fillStyle(0x2a2a2a);
  gate.fillRect(Math.round(16 * s), Math.round(25 * s), Math.round(28 * s), Math.round(3 * s));
  gate.fillRect(Math.round(16 * s), Math.round(55 * s), Math.round(28 * s), Math.round(3 * s));
  // Gold accent on gate
  gate.fillStyle(0xd4a017);
  gate.fillRect(Math.round(24 * s), Math.round(35 * s), Math.round(10 * s), Math.round(8 * s));
  gate.fillStyle(0xffd700);
  gate.fillRect(Math.round(26 * s), Math.round(37 * s), Math.round(6 * s), Math.round(4 * s));
  // Spear points on top
  gate.fillStyle(0x1a1a1a);
  gate.fillTriangle(
    Math.round(19.5 * s),
    Math.round(15 * s),
    Math.round(17 * s),
    Math.round(22 * s),
    Math.round(22 * s),
    Math.round(22 * s)
  );
  gate.fillTriangle(
    Math.round(29.5 * s),
    Math.round(15 * s),
    Math.round(27 * s),
    Math.round(22 * s),
    Math.round(32 * s),
    Math.round(22 * s)
  );
  gate.fillTriangle(
    Math.round(39.5 * s),
    Math.round(15 * s),
    Math.round(37 * s),
    Math.round(22 * s),
    Math.round(42 * s),
    Math.round(22 * s)
  );
  gate.generateTexture("iron_gate", gateW, gateH);
  gate.destroy();

  // === GOLD URN/STATUE ===
  const urnW = Math.round(24 * s);
  const urnH = Math.round(50 * s);
  const urn = scene.make.graphics({ x: 0, y: 0 });
  // Marble pedestal
  urn.fillStyle(0xe8e4dc);
  urn.fillRect(Math.round(4 * s), Math.round(38 * s), Math.round(16 * s), Math.round(12 * s));
  urn.fillStyle(0xd4cfc4);
  urn.fillRect(Math.round(6 * s), Math.round(44 * s), Math.round(12 * s), Math.round(6 * s));
  // Pedestal gold band
  urn.fillStyle(0xffd700);
  urn.fillRect(Math.round(3 * s), Math.round(36 * s), Math.round(18 * s), Math.round(3 * s));
  // Urn base
  urn.fillStyle(0xb8860b);
  urn.fillRect(Math.round(8 * s), Math.round(28 * s), Math.round(8 * s), Math.round(10 * s));
  // Urn body (wider)
  urn.fillStyle(0xd4a017);
  urn.fillRect(Math.round(5 * s), Math.round(16 * s), Math.round(14 * s), Math.round(14 * s));
  urn.fillStyle(0xffd700);
  urn.fillRect(Math.round(6 * s), Math.round(18 * s), Math.round(6 * s), Math.round(10 * s));
  // Urn neck
  urn.fillStyle(0xb8860b);
  urn.fillRect(Math.round(8 * s), Math.round(10 * s), Math.round(8 * s), Math.round(8 * s));
  // Urn rim
  urn.fillStyle(0xffd700);
  urn.fillRect(Math.round(6 * s), Math.round(8 * s), Math.round(12 * s), Math.round(4 * s));
  // Handles
  urn.fillStyle(0xd4a017);
  urn.fillRect(Math.round(2 * s), Math.round(18 * s), Math.round(4 * s), Math.round(8 * s));
  urn.fillRect(Math.round(18 * s), Math.round(18 * s), Math.round(4 * s), Math.round(8 * s));
  urn.generateTexture("gold_urn", urnW, urnH);
  urn.destroy();

  // === RED CARPET ===
  const carpetW = Math.round(60 * s);
  const carpetH = Math.round(40 * s);
  const carpet = scene.make.graphics({ x: 0, y: 0 });
  // Gold border
  carpet.fillStyle(0xd4a017);
  carpet.fillRect(0, 0, carpetW, carpetH);
  // Dark red carpet
  carpet.fillStyle(0x8b0000);
  carpet.fillRect(
    Math.round(3 * s),
    Math.round(3 * s),
    carpetW - Math.round(6 * s),
    carpetH - Math.round(6 * s)
  );
  // Lighter red highlight stripe
  carpet.fillStyle(0xb22222, 0.5);
  carpet.fillRect(
    Math.round(10 * s),
    Math.round(8 * s),
    carpetW - Math.round(20 * s),
    Math.round(4 * s)
  );
  carpet.fillRect(
    Math.round(10 * s),
    carpetH - Math.round(12 * s),
    carpetW - Math.round(20 * s),
    Math.round(4 * s)
  );
  // Gold inner trim
  carpet.fillStyle(0xffd700);
  carpet.fillRect(
    Math.round(6 * s),
    Math.round(6 * s),
    carpetW - Math.round(12 * s),
    Math.round(2 * s)
  );
  carpet.fillRect(
    Math.round(6 * s),
    carpetH - Math.round(8 * s),
    carpetW - Math.round(12 * s),
    Math.round(2 * s)
  );
  // Carpet pattern (diamond shapes)
  carpet.fillStyle(0x9b1c1c, 0.4);
  for (let i = 0; i < 3; i++) {
    const dx = Math.round((15 + i * 15) * s);
    carpet.fillRect(dx, Math.round(15 * s), Math.round(6 * s), Math.round(10 * s));
  }
  carpet.generateTexture("red_carpet", carpetW, carpetH);
  carpet.destroy();

  // === LUXURY SUPERCAR (Lamborghini-style) ===
  const carW = Math.round(60 * s);
  const carH = Math.round(28 * s);
  const supercar = scene.make.graphics({ x: 0, y: 0 });

  // Shadow underneath
  supercar.fillStyle(0x000000, 0.4);
  supercar.fillRect(Math.round(6 * s), Math.round(22 * s), Math.round(48 * s), Math.round(6 * s));

  // Low sleek body (gold/yellow Lambo style)
  supercar.fillStyle(0xd4a017); // Dark gold base
  supercar.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(52 * s), Math.round(10 * s));

  // Body highlight (top)
  supercar.fillStyle(0xffd700); // Bright gold
  supercar.fillRect(Math.round(6 * s), Math.round(12 * s), Math.round(48 * s), Math.round(3 * s));

  // Sloped hood (front wedge shape)
  supercar.fillStyle(0xd4a017);
  supercar.fillRect(Math.round(44 * s), Math.round(14 * s), Math.round(14 * s), Math.round(6 * s));
  supercar.fillStyle(0xffd700);
  supercar.fillRect(Math.round(46 * s), Math.round(14 * s), Math.round(10 * s), Math.round(2 * s));

  // Low cabin/roof (very sleek)
  supercar.fillStyle(0xb8860b); // Darker gold
  supercar.fillRect(Math.round(16 * s), Math.round(6 * s), Math.round(22 * s), Math.round(7 * s));

  // Angular windshield
  supercar.fillStyle(0x1e3a5f, 0.9); // Dark tinted glass
  supercar.fillRect(Math.round(32 * s), Math.round(7 * s), Math.round(8 * s), Math.round(5 * s));
  // Side window
  supercar.fillStyle(0x1e3a5f, 0.9);
  supercar.fillRect(Math.round(20 * s), Math.round(7 * s), Math.round(10 * s), Math.round(5 * s));

  // Rear spoiler
  supercar.fillStyle(0x1a1a1a);
  supercar.fillRect(Math.round(2 * s), Math.round(8 * s), Math.round(4 * s), Math.round(2 * s));
  supercar.fillRect(Math.round(4 * s), Math.round(6 * s), Math.round(8 * s), Math.round(3 * s));

  // Air intakes (side scoops)
  supercar.fillStyle(0x1a1a1a);
  supercar.fillRect(Math.round(12 * s), Math.round(16 * s), Math.round(6 * s), Math.round(4 * s));
  supercar.fillRect(Math.round(40 * s), Math.round(16 * s), Math.round(6 * s), Math.round(4 * s));

  // Wheels (larger, sportier)
  supercar.fillStyle(0x1a1a1a);
  supercar.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(6 * s));
  supercar.fillCircle(Math.round(46 * s), Math.round(20 * s), Math.round(6 * s));

  // Gold rims (luxury detail)
  supercar.fillStyle(0xffd700);
  supercar.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(3 * s));
  supercar.fillCircle(Math.round(46 * s), Math.round(20 * s), Math.round(3 * s));

  // Rim centers
  supercar.fillStyle(0xd4a017);
  supercar.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(1.5 * s));
  supercar.fillCircle(Math.round(46 * s), Math.round(20 * s), Math.round(1.5 * s));

  // Headlights (angular, aggressive)
  supercar.fillStyle(0xfef3c7);
  supercar.fillRect(Math.round(54 * s), Math.round(15 * s), Math.round(3 * s), Math.round(3 * s));
  // Headlight glow
  supercar.fillStyle(0xffffff, 0.4);
  supercar.fillRect(Math.round(53 * s), Math.round(14 * s), Math.round(5 * s), Math.round(5 * s));

  // Taillights (LED strip style)
  supercar.fillStyle(0xef4444);
  supercar.fillRect(Math.round(2 * s), Math.round(14 * s), Math.round(2 * s), Math.round(6 * s));
  supercar.fillStyle(0xfca5a5, 0.5);
  supercar.fillRect(Math.round(2 * s), Math.round(15 * s), Math.round(3 * s), Math.round(4 * s));

  // Body line detail (adds depth)
  supercar.fillStyle(0xb8860b, 0.6);
  supercar.fillRect(Math.round(8 * s), Math.round(18 * s), Math.round(36 * s), Math.round(1 * s));

  // Chrome exhaust tips
  supercar.fillStyle(0x9ca3af);
  supercar.fillRect(Math.round(4 * s), Math.round(19 * s), Math.round(3 * s), Math.round(2 * s));
  supercar.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(1 * s));

  supercar.generateTexture("supercar", carW, carH);
  supercar.destroy();
}
