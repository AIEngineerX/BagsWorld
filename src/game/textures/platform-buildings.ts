import * as Phaser from "phaser";
import { SCALE, darken, lighten } from "./constants";

export function generatePlatformBuildings(scene: Phaser.Scene): void {
  const s = SCALE;
  generateRocketBuilding(scene, s);
  generateVolcanoBuilding(scene, s);
  generatePalaceBuilding(scene, s);
  generateCrystalBuilding(scene, s);
}

// ROCKET — Red/orange body, silver nose cone, porthole windows, exhaust flame
function generateRocketBuilding(scene: Phaser.Scene, s: number): void {
  const w = Math.round(70 * s);
  const h = Math.round(110 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const body = 0xdc2626; // Bright red
  const bodyLight = lighten(body, 0.25);
  const bodyDark = darken(body, 0.3);
  const nose = 0x9ca3af; // Silver
  const noseLight = lighten(nose, 0.3);
  const noseDark = darken(nose, 0.25);
  const stripe = 0xf97316; // Orange accent stripe
  const windowGlow = 0x60a5fa; // Blue porthole glow
  const flame = 0xfbbf24; // Gold
  const flameOrange = 0xf97316;
  const flameRed = 0xef4444;
  const fin = 0x374151; // Dark gray fins

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === EXHAUST FLAME ===
  // Outer flame glow
  g.fillStyle(flameRed, 0.3);
  g.fillTriangle(
    cx - Math.round(18 * s),
    groundY,
    cx + Math.round(18 * s),
    groundY,
    cx,
    groundY + Math.round(3 * s)
  );
  // Orange core
  g.fillStyle(flameOrange, 0.8);
  g.fillTriangle(
    cx - Math.round(12 * s),
    groundY - Math.round(2 * s),
    cx + Math.round(12 * s),
    groundY - Math.round(2 * s),
    cx,
    groundY + Math.round(2 * s)
  );
  // Bright inner flame
  g.fillStyle(flame);
  g.fillTriangle(
    cx - Math.round(8 * s),
    groundY - Math.round(4 * s),
    cx + Math.round(8 * s),
    groundY - Math.round(4 * s),
    cx,
    groundY + Math.round(1 * s)
  );
  // White-hot center
  g.fillStyle(0xfef3c7);
  g.fillTriangle(
    cx - Math.round(4 * s),
    groundY - Math.round(6 * s),
    cx + Math.round(4 * s),
    groundY - Math.round(6 * s),
    cx,
    groundY - Math.round(1 * s)
  );

  // === ENGINE NOZZLE ===
  g.fillStyle(noseDark);
  g.fillRect(
    cx - Math.round(10 * s),
    groundY - Math.round(10 * s),
    Math.round(20 * s),
    Math.round(6 * s)
  );
  g.fillStyle(nose);
  g.fillRect(
    cx - Math.round(8 * s),
    groundY - Math.round(12 * s),
    Math.round(16 * s),
    Math.round(4 * s)
  );

  // === FINS (left and right) ===
  // Left fin
  g.fillStyle(fin);
  g.fillTriangle(
    cx - Math.round(14 * s),
    groundY - Math.round(10 * s),
    cx - Math.round(24 * s),
    groundY - Math.round(6 * s),
    cx - Math.round(14 * s),
    groundY - Math.round(30 * s)
  );
  g.fillStyle(lighten(fin, 0.15));
  g.fillTriangle(
    cx - Math.round(14 * s),
    groundY - Math.round(10 * s),
    cx - Math.round(20 * s),
    groundY - Math.round(8 * s),
    cx - Math.round(14 * s),
    groundY - Math.round(28 * s)
  );
  // Right fin
  g.fillStyle(fin);
  g.fillTriangle(
    cx + Math.round(14 * s),
    groundY - Math.round(10 * s),
    cx + Math.round(24 * s),
    groundY - Math.round(6 * s),
    cx + Math.round(14 * s),
    groundY - Math.round(30 * s)
  );
  g.fillStyle(darken(fin, 0.15));
  g.fillTriangle(
    cx + Math.round(14 * s),
    groundY - Math.round(10 * s),
    cx + Math.round(22 * s),
    groundY - Math.round(7 * s),
    cx + Math.round(14 * s),
    groundY - Math.round(28 * s)
  );

  // === ROCKET BODY ===
  const bodyW = Math.round(28 * s);
  const bodyH = Math.round(60 * s);
  const bodyX = cx - bodyW / 2;
  const bodyY = groundY - Math.round(12 * s) - bodyH;

  // Drop shadow
  g.fillStyle(0x000000, 0.4);
  g.fillRect(bodyX + Math.round(3 * s), bodyY + Math.round(4 * s), bodyW, bodyH);

  // Main body
  g.fillStyle(body);
  g.fillRect(bodyX, bodyY, bodyW, bodyH);
  // Light edge (left)
  g.fillStyle(bodyLight);
  g.fillRect(bodyX, bodyY, Math.round(4 * s), bodyH);
  // Dark edge (right)
  g.fillStyle(bodyDark);
  g.fillRect(bodyX + bodyW - Math.round(4 * s), bodyY, Math.round(4 * s), bodyH);

  // === ORANGE ACCENT STRIPES ===
  g.fillStyle(stripe);
  g.fillRect(bodyX, bodyY + Math.round(8 * s), bodyW, Math.round(3 * s));
  g.fillRect(bodyX, bodyY + bodyH - Math.round(10 * s), bodyW, Math.round(3 * s));

  // === PORTHOLE WINDOWS ===
  for (let i = 0; i < 3; i++) {
    const wy = bodyY + Math.round(18 * s) + i * Math.round(14 * s);
    // Outer glow
    g.fillStyle(windowGlow, 0.25);
    g.fillCircle(cx, wy, Math.round(6 * s));
    // Inner glow
    g.fillStyle(windowGlow, 0.5);
    g.fillCircle(cx, wy, Math.round(4.5 * s));
    // Window
    g.fillStyle(windowGlow);
    g.fillCircle(cx, wy, Math.round(3.5 * s));
    // Silver frame
    g.fillStyle(nose);
    g.fillRect(
      cx - Math.round(4 * s),
      wy - Math.round(0.5 * s),
      Math.round(8 * s),
      Math.round(1 * s)
    );
    g.fillRect(
      cx - Math.round(0.5 * s),
      wy - Math.round(4 * s),
      Math.round(1 * s),
      Math.round(8 * s)
    );
    // Highlight corner
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(
      cx - Math.round(2 * s),
      wy - Math.round(2 * s),
      Math.round(1.5 * s),
      Math.round(1.5 * s)
    );
  }

  // === NOSE CONE ===
  const noseBaseY = bodyY;
  // Cone body (triangle)
  g.fillStyle(nose);
  g.fillTriangle(
    cx - bodyW / 2,
    noseBaseY,
    cx + bodyW / 2,
    noseBaseY,
    cx,
    noseBaseY - Math.round(28 * s)
  );
  // Light left edge
  g.fillStyle(noseLight, 0.6);
  g.fillTriangle(
    cx - bodyW / 2,
    noseBaseY,
    cx - Math.round(4 * s),
    noseBaseY,
    cx - Math.round(2 * s),
    noseBaseY - Math.round(24 * s)
  );
  // Dark right edge
  g.fillStyle(noseDark, 0.5);
  g.fillTriangle(
    cx + bodyW / 2,
    noseBaseY,
    cx + Math.round(4 * s),
    noseBaseY,
    cx + Math.round(2 * s),
    noseBaseY - Math.round(24 * s)
  );
  // Tip highlight
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(cx, noseBaseY - Math.round(24 * s), Math.round(2 * s));

  // === RED TIP BAND ===
  g.fillStyle(body);
  g.fillRect(
    cx - Math.round(8 * s),
    noseBaseY - Math.round(6 * s),
    Math.round(16 * s),
    Math.round(4 * s)
  );

  g.generateTexture("platform_rocket", w, h);
  g.destroy();
}

// VOLCANO — Dark rocky base, lava crater glow, orange lava drips
function generateVolcanoBuilding(scene: Phaser.Scene, s: number): void {
  const w = Math.round(70 * s);
  const h = Math.round(100 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const rock = 0x451a03; // Dark brown
  const rockMid = 0x78350f; // Brown
  const rockLight = 0x92400e; // Lighter brown
  const rockDark = darken(rock, 0.3);
  const lava = 0xf97316; // Orange lava
  const lavaHot = 0xfbbf24; // Hot gold
  const lavaGlow = 0xef4444; // Red glow
  const lavaWhite = 0xfef3c7; // White-hot

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === BASE ROCK LAYER ===
  // Wide rocky base
  g.fillStyle(rockDark);
  g.fillTriangle(
    Math.round(2 * s),
    groundY,
    w - Math.round(2 * s),
    groundY,
    cx,
    Math.round(20 * s)
  );
  // Main rock body
  g.fillStyle(rock);
  g.fillTriangle(
    Math.round(6 * s),
    groundY,
    w - Math.round(6 * s),
    groundY,
    cx,
    Math.round(22 * s)
  );
  // Light left face
  g.fillStyle(rockMid);
  g.fillTriangle(
    Math.round(6 * s),
    groundY,
    cx - Math.round(4 * s),
    groundY,
    cx - Math.round(2 * s),
    Math.round(24 * s)
  );
  // Highlight strip (left edge)
  g.fillStyle(rockLight, 0.5);
  g.fillTriangle(
    Math.round(8 * s),
    groundY,
    Math.round(14 * s),
    groundY,
    cx - Math.round(4 * s),
    Math.round(30 * s)
  );

  // === ROCK TEXTURE (dithering) ===
  g.fillStyle(rockLight, 0.2);
  for (let py = Math.round(30 * s); py < groundY; py += Math.round(6 * s)) {
    for (let px = Math.round(10 * s); px < w - Math.round(10 * s); px += Math.round(8 * s)) {
      if ((py + px) % Math.round(12 * s) < Math.round(4 * s)) {
        g.fillRect(px, py, Math.round(2 * s), Math.round(2 * s));
      }
    }
  }

  // === DARK CREVICES ===
  g.fillStyle(rockDark, 0.6);
  // Left crevice
  g.fillRect(cx - Math.round(12 * s), Math.round(40 * s), Math.round(2 * s), Math.round(20 * s));
  // Right crevice
  g.fillRect(cx + Math.round(8 * s), Math.round(45 * s), Math.round(2 * s), Math.round(18 * s));

  // === CRATER RIM ===
  const craterY = Math.round(22 * s);
  const craterW = Math.round(24 * s);
  // Dark rim back
  g.fillStyle(rockDark);
  g.fillRect(
    cx - craterW / 2 - Math.round(2 * s),
    craterY - Math.round(4 * s),
    craterW + Math.round(4 * s),
    Math.round(8 * s)
  );
  // Lighter rim front
  g.fillStyle(rockMid);
  g.fillRect(cx - craterW / 2, craterY - Math.round(2 * s), craterW, Math.round(6 * s));
  // Rim highlight
  g.fillStyle(rockLight);
  g.fillRect(cx - craterW / 2, craterY - Math.round(2 * s), craterW, Math.round(2 * s));

  // === LAVA GLOW IN CRATER ===
  // Deep glow
  g.fillStyle(lavaGlow, 0.4);
  g.fillRect(
    cx - Math.round(10 * s),
    craterY - Math.round(1 * s),
    Math.round(20 * s),
    Math.round(6 * s)
  );
  // Orange lava surface
  g.fillStyle(lava, 0.8);
  g.fillRect(cx - Math.round(8 * s), craterY, Math.round(16 * s), Math.round(4 * s));
  // Hot center
  g.fillStyle(lavaHot);
  g.fillRect(
    cx - Math.round(5 * s),
    craterY + Math.round(1 * s),
    Math.round(10 * s),
    Math.round(2 * s)
  );
  // White-hot core
  g.fillStyle(lavaWhite);
  g.fillRect(
    cx - Math.round(2 * s),
    craterY + Math.round(1 * s),
    Math.round(4 * s),
    Math.round(2 * s)
  );

  // === LAVA DRIPS DOWN SIDES ===
  // Left drip
  g.fillStyle(lava, 0.7);
  g.fillRect(
    cx - Math.round(8 * s),
    craterY + Math.round(4 * s),
    Math.round(3 * s),
    Math.round(14 * s)
  );
  g.fillStyle(lavaHot, 0.6);
  g.fillRect(
    cx - Math.round(7 * s),
    craterY + Math.round(4 * s),
    Math.round(1.5 * s),
    Math.round(12 * s)
  );
  // Left drip glow
  g.fillStyle(lavaGlow, 0.2);
  g.fillRect(
    cx - Math.round(10 * s),
    craterY + Math.round(6 * s),
    Math.round(6 * s),
    Math.round(10 * s)
  );

  // Center drip (longest)
  g.fillStyle(lava, 0.8);
  g.fillRect(
    cx - Math.round(1.5 * s),
    craterY + Math.round(4 * s),
    Math.round(3 * s),
    Math.round(22 * s)
  );
  g.fillStyle(lavaHot, 0.7);
  g.fillRect(
    cx - Math.round(0.5 * s),
    craterY + Math.round(4 * s),
    Math.round(1.5 * s),
    Math.round(20 * s)
  );
  // Center drip glow
  g.fillStyle(lavaGlow, 0.15);
  g.fillRect(
    cx - Math.round(4 * s),
    craterY + Math.round(8 * s),
    Math.round(8 * s),
    Math.round(16 * s)
  );

  // Right drip
  g.fillStyle(lava, 0.7);
  g.fillRect(
    cx + Math.round(6 * s),
    craterY + Math.round(4 * s),
    Math.round(3 * s),
    Math.round(10 * s)
  );
  g.fillStyle(lavaHot, 0.5);
  g.fillRect(
    cx + Math.round(7 * s),
    craterY + Math.round(4 * s),
    Math.round(1.5 * s),
    Math.round(8 * s)
  );

  // === SMOKE WISPS above crater ===
  g.fillStyle(0x6b7280, 0.3);
  g.fillCircle(cx - Math.round(4 * s), craterY - Math.round(8 * s), Math.round(3 * s));
  g.fillCircle(cx + Math.round(3 * s), craterY - Math.round(12 * s), Math.round(2.5 * s));
  g.fillCircle(cx - Math.round(1 * s), craterY - Math.round(16 * s), Math.round(2 * s));

  g.generateTexture("platform_volcano", w, h);
  g.destroy();
}

// PALACE — Golden temple with columns, ornate peaked roof, glowing doorway
function generatePalaceBuilding(scene: Phaser.Scene, s: number): void {
  const w = Math.round(80 * s);
  const h = Math.round(110 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const gold = 0xfbbf24; // Gold
  const goldLight = lighten(gold, 0.3);
  const goldDark = darken(gold, 0.25);
  const amber = 0xf59e0b; // Amber
  const amberDark = darken(amber, 0.3);
  const marble = 0xfef3c7; // Cream marble
  const marbleDark = darken(marble, 0.15);
  const doorGlow = 0x4ade80; // Green glow doorway
  const doorGlowDim = 0x22c55e;
  const roofDark = darken(gold, 0.4);

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === STEPPED BASE ===
  // Bottom step
  g.fillStyle(amberDark);
  g.fillRect(
    Math.round(4 * s),
    groundY - Math.round(4 * s),
    w - Math.round(8 * s),
    Math.round(4 * s)
  );
  // Middle step
  g.fillStyle(amber);
  g.fillRect(
    Math.round(8 * s),
    groundY - Math.round(8 * s),
    w - Math.round(16 * s),
    Math.round(4 * s)
  );
  // Top step
  g.fillStyle(gold);
  g.fillRect(
    Math.round(12 * s),
    groundY - Math.round(12 * s),
    w - Math.round(24 * s),
    Math.round(4 * s)
  );
  // Step highlights
  g.fillStyle(goldLight, 0.5);
  g.fillRect(
    Math.round(4 * s),
    groundY - Math.round(4 * s),
    w - Math.round(8 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    Math.round(8 * s),
    groundY - Math.round(8 * s),
    w - Math.round(16 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    Math.round(12 * s),
    groundY - Math.round(12 * s),
    w - Math.round(24 * s),
    Math.round(1 * s)
  );

  // === MAIN BODY ===
  const bodyW = Math.round(52 * s);
  const bodyH = Math.round(50 * s);
  const bodyX = cx - bodyW / 2;
  const bodyY = groundY - Math.round(12 * s) - bodyH;

  // Drop shadow
  g.fillStyle(0x000000, 0.35);
  g.fillRect(bodyX + Math.round(4 * s), bodyY + Math.round(4 * s), bodyW, bodyH);

  // Main wall
  g.fillStyle(marble);
  g.fillRect(bodyX, bodyY, bodyW, bodyH);
  // Light left edge
  g.fillStyle(0xffffff, 0.3);
  g.fillRect(bodyX, bodyY, Math.round(3 * s), bodyH);
  // Dark right edge
  g.fillStyle(marbleDark);
  g.fillRect(bodyX + bodyW - Math.round(3 * s), bodyY, Math.round(3 * s), bodyH);

  // Wall dithering
  g.fillStyle(marbleDark, 0.1);
  for (let py = 0; py < bodyH; py += Math.round(4 * s)) {
    for (let px = 0; px < bodyW; px += Math.round(6 * s)) {
      if ((py / Math.round(4 * s) + px / Math.round(6 * s)) % 2 === 0) {
        g.fillRect(bodyX + px, bodyY + py, Math.round(2 * s), Math.round(2 * s));
      }
    }
  }

  // === GOLD TRIM LINE at top of body ===
  g.fillStyle(gold);
  g.fillRect(bodyX - Math.round(2 * s), bodyY, bodyW + Math.round(4 * s), Math.round(3 * s));
  g.fillStyle(goldLight);
  g.fillRect(bodyX - Math.round(2 * s), bodyY, bodyW + Math.round(4 * s), Math.round(1 * s));

  // === COLUMNS (4 evenly spaced) ===
  const colW = Math.round(4 * s);
  const colH = bodyH;
  for (let i = 0; i < 4; i++) {
    const colX = bodyX + Math.round(6 * s) + i * Math.round(14 * s);
    // Column shadow
    g.fillStyle(marbleDark, 0.4);
    g.fillRect(colX + Math.round(1 * s), bodyY + Math.round(2 * s), colW, colH);
    // Column body
    g.fillStyle(marble);
    g.fillRect(colX, bodyY, colW, colH);
    // Column highlight (left edge)
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(colX, bodyY, Math.round(1 * s), colH);
    // Column shadow (right edge)
    g.fillStyle(marbleDark, 0.5);
    g.fillRect(colX + colW - Math.round(1 * s), bodyY, Math.round(1 * s), colH);
    // Capital (top ornament)
    g.fillStyle(gold);
    g.fillRect(
      colX - Math.round(1 * s),
      bodyY - Math.round(2 * s),
      colW + Math.round(2 * s),
      Math.round(3 * s)
    );
    // Base ornament
    g.fillStyle(gold);
    g.fillRect(
      colX - Math.round(1 * s),
      bodyY + colH - Math.round(2 * s),
      colW + Math.round(2 * s),
      Math.round(3 * s)
    );
  }

  // === GLOWING DOORWAY (center) ===
  const doorW = Math.round(12 * s);
  const doorH = Math.round(20 * s);
  const doorX = cx - doorW / 2;
  const doorY = groundY - Math.round(12 * s) - doorH;

  // Outer glow
  g.fillStyle(doorGlow, 0.2);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(4 * s),
    doorW + Math.round(8 * s),
    doorH + Math.round(4 * s)
  );
  // Inner glow
  g.fillStyle(doorGlow, 0.4);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(2 * s),
    doorW + Math.round(4 * s),
    doorH + Math.round(2 * s)
  );
  // Doorway
  g.fillStyle(doorGlowDim);
  g.fillRect(doorX, doorY, doorW, doorH);
  // Bright center
  g.fillStyle(doorGlow);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(2 * s),
    doorW - Math.round(4 * s),
    doorH - Math.round(4 * s)
  );
  // White-hot center line
  g.fillStyle(0xffffff, 0.5);
  g.fillRect(
    cx - Math.round(1 * s),
    doorY + Math.round(4 * s),
    Math.round(2 * s),
    doorH - Math.round(8 * s)
  );
  // Gold door frame
  g.fillStyle(gold);
  g.fillRect(doorX - Math.round(1 * s), doorY, Math.round(1.5 * s), doorH);
  g.fillRect(doorX + doorW - Math.round(0.5 * s), doorY, Math.round(1.5 * s), doorH);
  g.fillRect(
    doorX - Math.round(1 * s),
    doorY - Math.round(1.5 * s),
    doorW + Math.round(2 * s),
    Math.round(2 * s)
  );

  // === ORNATE PEAKED ROOF ===
  const roofBaseY = bodyY;
  const roofPeakY = roofBaseY - Math.round(30 * s);
  const roofOverhang = Math.round(6 * s);

  // Roof shadow
  g.fillStyle(0x000000, 0.3);
  g.fillTriangle(
    bodyX - roofOverhang + Math.round(3 * s),
    roofBaseY + Math.round(3 * s),
    bodyX + bodyW + roofOverhang + Math.round(3 * s),
    roofBaseY + Math.round(3 * s),
    cx + Math.round(3 * s),
    roofPeakY + Math.round(3 * s)
  );
  // Main roof
  g.fillStyle(goldDark);
  g.fillTriangle(
    bodyX - roofOverhang,
    roofBaseY,
    bodyX + bodyW + roofOverhang,
    roofBaseY,
    cx,
    roofPeakY
  );
  // Roof left highlight
  g.fillStyle(gold);
  g.fillTriangle(bodyX - roofOverhang, roofBaseY, cx, roofBaseY, cx, roofPeakY);
  // Bright edge
  g.fillStyle(goldLight, 0.5);
  g.fillTriangle(
    bodyX - roofOverhang,
    roofBaseY,
    bodyX - roofOverhang + Math.round(6 * s),
    roofBaseY,
    cx,
    roofPeakY
  );
  // Ridge line
  g.fillStyle(goldLight);
  g.fillRect(cx - Math.round(1 * s), roofPeakY, Math.round(2 * s), roofBaseY - roofPeakY);

  // === ROOF FINIAL (golden ornament at peak) ===
  g.fillStyle(gold);
  g.fillCircle(cx, roofPeakY - Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(goldLight);
  g.fillCircle(cx - Math.round(1 * s), roofPeakY - Math.round(4 * s), Math.round(1.5 * s));
  // Spire
  g.fillStyle(gold);
  g.fillRect(
    cx - Math.round(1 * s),
    roofPeakY - Math.round(10 * s),
    Math.round(2 * s),
    Math.round(7 * s)
  );
  g.fillStyle(goldLight);
  g.fillRect(
    cx - Math.round(1 * s),
    roofPeakY - Math.round(10 * s),
    Math.round(1 * s),
    Math.round(7 * s)
  );

  // === EAVE TRIM ===
  g.fillStyle(gold);
  g.fillRect(
    bodyX - roofOverhang,
    roofBaseY - Math.round(2 * s),
    bodyW + roofOverhang * 2,
    Math.round(3 * s)
  );
  g.fillStyle(goldLight);
  g.fillRect(
    bodyX - roofOverhang,
    roofBaseY - Math.round(2 * s),
    bodyW + roofOverhang * 2,
    Math.round(1 * s)
  );

  g.generateTexture("platform_palace", w, h);
  g.destroy();
}

// CRYSTAL — Cyan/purple faceted crystal spire, inner glow, geometric edges
function generateCrystalBuilding(scene: Phaser.Scene, s: number): void {
  const w = Math.round(60 * s);
  const h = Math.round(100 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const crystalMain = 0x06b6d4; // Cyan
  const crystalLight = lighten(crystalMain, 0.35);
  const crystalDark = darken(crystalMain, 0.35);
  const crystalDeep = darken(crystalMain, 0.55);
  const purple = 0x8b5cf6; // Purple accent
  const purpleLight = lighten(purple, 0.3);
  const purpleDark = darken(purple, 0.3);
  const glowInner = 0xa5f3fc; // Light cyan glow
  const glowWhite = 0xe0f2fe; // Near-white glow
  const base = 0x374151; // Gray stone base

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === STONE BASE ===
  g.fillStyle(darken(base, 0.2));
  g.fillRect(
    cx - Math.round(16 * s),
    groundY - Math.round(6 * s),
    Math.round(32 * s),
    Math.round(6 * s)
  );
  g.fillStyle(base);
  g.fillRect(
    cx - Math.round(14 * s),
    groundY - Math.round(10 * s),
    Math.round(28 * s),
    Math.round(6 * s)
  );
  // Base highlight
  g.fillStyle(lighten(base, 0.15));
  g.fillRect(
    cx - Math.round(14 * s),
    groundY - Math.round(10 * s),
    Math.round(28 * s),
    Math.round(1.5 * s)
  );

  // === AMBIENT GLOW around base ===
  g.fillStyle(crystalMain, 0.15);
  g.fillCircle(cx, groundY - Math.round(14 * s), Math.round(20 * s));
  g.fillStyle(crystalMain, 0.08);
  g.fillCircle(cx, groundY - Math.round(20 * s), Math.round(26 * s));

  // === MAIN CRYSTAL BODY (central spire) ===
  const spireBaseY = groundY - Math.round(10 * s);
  const spirePeakY = Math.round(8 * s);
  const spireW = Math.round(18 * s);

  // Right face (dark)
  g.fillStyle(crystalDark);
  g.fillTriangle(cx, spirePeakY, cx + spireW / 2, spireBaseY, cx, spireBaseY);
  // Left face (light)
  g.fillStyle(crystalMain);
  g.fillTriangle(cx, spirePeakY, cx - spireW / 2, spireBaseY, cx, spireBaseY);
  // Bright left edge
  g.fillStyle(crystalLight, 0.7);
  g.fillTriangle(
    cx - spireW / 2,
    spireBaseY,
    cx - spireW / 2 + Math.round(3 * s),
    spireBaseY,
    cx,
    spirePeakY
  );

  // === FACETED EDGES (geometric crystal look) ===
  // Horizontal facet lines
  for (let i = 1; i <= 4; i++) {
    const fy = spirePeakY + ((spireBaseY - spirePeakY) * i) / 5;
    const fw = (spireW * i) / 5;
    g.fillStyle(crystalLight, 0.3);
    g.fillRect(cx - fw / 2, fy - Math.round(0.5 * s), fw, Math.round(1 * s));
  }

  // === INNER GLOW (runs up center) ===
  g.fillStyle(glowInner, 0.3);
  g.fillRect(
    cx - Math.round(2 * s),
    spirePeakY + Math.round(10 * s),
    Math.round(4 * s),
    spireBaseY - spirePeakY - Math.round(14 * s)
  );
  g.fillStyle(glowWhite, 0.2);
  g.fillRect(
    cx - Math.round(1 * s),
    spirePeakY + Math.round(16 * s),
    Math.round(2 * s),
    spireBaseY - spirePeakY - Math.round(24 * s)
  );

  // === LEFT SECONDARY CRYSTAL (purple) ===
  const leftBaseY = groundY - Math.round(10 * s);
  const leftPeakY = Math.round(30 * s);
  const leftCx = cx - Math.round(12 * s);

  g.fillStyle(purpleDark);
  g.fillTriangle(leftCx, leftPeakY, leftCx + Math.round(5 * s), leftBaseY, leftCx, leftBaseY);
  g.fillStyle(purple);
  g.fillTriangle(leftCx, leftPeakY, leftCx - Math.round(5 * s), leftBaseY, leftCx, leftBaseY);
  g.fillStyle(purpleLight, 0.5);
  g.fillTriangle(
    leftCx - Math.round(5 * s),
    leftBaseY,
    leftCx - Math.round(3 * s),
    leftBaseY,
    leftCx,
    leftPeakY
  );
  // Inner glow
  g.fillStyle(purpleLight, 0.2);
  g.fillRect(
    leftCx - Math.round(1 * s),
    leftPeakY + Math.round(8 * s),
    Math.round(2 * s),
    leftBaseY - leftPeakY - Math.round(12 * s)
  );

  // === RIGHT SECONDARY CRYSTAL (purple, shorter) ===
  const rightBaseY = groundY - Math.round(10 * s);
  const rightPeakY = Math.round(38 * s);
  const rightCx = cx + Math.round(11 * s);

  g.fillStyle(purpleDark);
  g.fillTriangle(rightCx, rightPeakY, rightCx + Math.round(4 * s), rightBaseY, rightCx, rightBaseY);
  g.fillStyle(purple);
  g.fillTriangle(rightCx, rightPeakY, rightCx - Math.round(4 * s), rightBaseY, rightCx, rightBaseY);
  g.fillStyle(purpleLight, 0.4);
  g.fillTriangle(
    rightCx - Math.round(4 * s),
    rightBaseY,
    rightCx - Math.round(2 * s),
    rightBaseY,
    rightCx,
    rightPeakY
  );

  // === SMALL CRYSTAL SHARDS at base ===
  // Left shard
  g.fillStyle(crystalMain, 0.7);
  g.fillTriangle(
    cx - Math.round(18 * s),
    spireBaseY,
    cx - Math.round(16 * s),
    spireBaseY,
    cx - Math.round(17 * s),
    spireBaseY - Math.round(8 * s)
  );
  // Right shard
  g.fillStyle(purple, 0.7);
  g.fillTriangle(
    cx + Math.round(16 * s),
    spireBaseY,
    cx + Math.round(18 * s),
    spireBaseY,
    cx + Math.round(17 * s),
    spireBaseY - Math.round(6 * s)
  );

  // === TIP HIGHLIGHT (bright point at top) ===
  g.fillStyle(glowWhite, 0.8);
  g.fillCircle(cx, spirePeakY + Math.round(2 * s), Math.round(2.5 * s));
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(cx, spirePeakY + Math.round(1 * s), Math.round(1.5 * s));

  // === SPARKLE HIGHLIGHTS on faces ===
  g.fillStyle(0xffffff, 0.6);
  g.fillRect(
    cx - Math.round(4 * s),
    spirePeakY + Math.round(20 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    cx + Math.round(1 * s),
    spirePeakY + Math.round(40 * s),
    Math.round(1.5 * s),
    Math.round(1.5 * s)
  );
  g.fillRect(
    leftCx - Math.round(2 * s),
    leftPeakY + Math.round(16 * s),
    Math.round(1.5 * s),
    Math.round(1.5 * s)
  );

  g.generateTexture("platform_crystal", w, h);
  g.destroy();
}
