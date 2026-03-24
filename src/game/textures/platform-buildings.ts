import * as Phaser from "phaser";
import { SCALE, darken, lighten } from "./constants";

export function generatePlatformBuildings(scene: Phaser.Scene): void {
  const s = SCALE;
  generateRocketBuilding(scene, s);
  generateVolcanoBuilding(scene, s);
  generatePalaceBuilding(scene, s);
  generateCrystalBuilding(scene, s);
  generateCityShowcase1(scene, s);
  generateCityShowcase2(scene, s);
  generateCityShowcase3(scene, s);
  generateParkShowcase1(scene, s);
  generateParkShowcase2(scene, s);
  generateParkShowcase3(scene, s);
  generateBeachShowcase1(scene, s);
  generateBeachShowcase2(scene, s);
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

// ============================================================================
// BAGSCITY SHOWCASE BUILDINGS — neon-on-dark urban aesthetic
// ============================================================================

// NEON TOKEN SHOP — Street-level neon storefront with glowing display window
function generateCityShowcase1(scene: Phaser.Scene, s: number): void {
  const w = Math.round(90 * s);
  const h = Math.round(100 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const brick = 0x1f2937;
  const brickLight = lighten(brick, 0.12);
  const brickDark = darken(brick, 0.25);
  const neonGreen = 0x4ade80;
  const neonPurple = 0xa855f7;
  const windowBg = 0x0a0a0f;
  const gold = 0xfbbf24;

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === MAIN BUILDING BODY ===
  // Drop shadow
  g.fillStyle(0x000000, 0.4);
  g.fillRect(
    Math.round(4 * s),
    Math.round(8 * s),
    w - Math.round(4 * s),
    groundY - Math.round(4 * s)
  );

  // Dark brick wall
  g.fillStyle(brick);
  g.fillRect(0, Math.round(4 * s), w, groundY - Math.round(4 * s));

  // Light left edge (3D depth)
  g.fillStyle(brickLight);
  g.fillRect(0, Math.round(4 * s), Math.round(4 * s), groundY - Math.round(4 * s));

  // Dark right edge
  g.fillStyle(brickDark);
  g.fillRect(
    w - Math.round(4 * s),
    Math.round(4 * s),
    Math.round(4 * s),
    groundY - Math.round(4 * s)
  );

  // Brick texture (dithered rows)
  g.fillStyle(brickLight, 0.15);
  for (let py = Math.round(12 * s); py < groundY; py += Math.round(8 * s)) {
    const offset = ((py / Math.round(8 * s)) % 2) * Math.round(6 * s);
    for (let px = offset; px < w - Math.round(4 * s); px += Math.round(12 * s)) {
      g.fillRect(px, py, Math.round(10 * s), Math.round(6 * s));
    }
  }
  // Mortar lines
  g.fillStyle(brickDark, 0.3);
  for (let py = Math.round(12 * s); py < groundY; py += Math.round(8 * s)) {
    g.fillRect(Math.round(4 * s), py, w - Math.round(8 * s), Math.round(1 * s));
  }

  // === NEON SIGN FRAME ON TOP ===
  const signY = Math.round(4 * s);
  const signH = Math.round(18 * s);
  // Sign backing
  g.fillStyle(0x0a0a0f);
  g.fillRect(Math.round(8 * s), signY, w - Math.round(16 * s), signH);
  // Neon green border
  g.fillStyle(neonGreen, 0.8);
  g.fillRect(Math.round(8 * s), signY, w - Math.round(16 * s), Math.round(2 * s));
  g.fillRect(
    Math.round(8 * s),
    signY + signH - Math.round(2 * s),
    w - Math.round(16 * s),
    Math.round(2 * s)
  );
  g.fillRect(Math.round(8 * s), signY, Math.round(2 * s), signH);
  g.fillRect(w - Math.round(10 * s), signY, Math.round(2 * s), signH);
  // Sign glow
  g.fillStyle(neonGreen, 0.15);
  g.fillRect(Math.round(4 * s), 0, w - Math.round(8 * s), signH + Math.round(8 * s));
  // Inner sign neon text area
  g.fillStyle(neonGreen, 0.5);
  g.fillRect(
    Math.round(14 * s),
    signY + Math.round(5 * s),
    w - Math.round(28 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    Math.round(18 * s),
    signY + Math.round(10 * s),
    w - Math.round(36 * s),
    Math.round(3 * s)
  );

  // === LARGE DISPLAY WINDOW ===
  const winY = Math.round(30 * s);
  const winH = Math.round(40 * s);
  const winX = Math.round(10 * s);
  const winW = w - Math.round(20 * s);

  // Window backing
  g.fillStyle(windowBg);
  g.fillRect(winX, winY, winW, winH);

  // Window content — purple glow from display
  g.fillStyle(neonPurple, 0.15);
  g.fillRect(
    winX + Math.round(2 * s),
    winY + Math.round(2 * s),
    winW - Math.round(4 * s),
    winH - Math.round(4 * s)
  );

  // Display shelves (horizontal lines inside window)
  g.fillStyle(0x374151, 0.6);
  g.fillRect(
    winX + Math.round(4 * s),
    winY + Math.round(14 * s),
    winW - Math.round(8 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    winX + Math.round(4 * s),
    winY + Math.round(27 * s),
    winW - Math.round(8 * s),
    Math.round(1 * s)
  );

  // Token silhouettes on shelves (small colored squares)
  g.fillStyle(neonGreen, 0.6);
  g.fillRect(
    winX + Math.round(8 * s),
    winY + Math.round(6 * s),
    Math.round(8 * s),
    Math.round(7 * s)
  );
  g.fillStyle(neonPurple, 0.6);
  g.fillRect(
    winX + Math.round(20 * s),
    winY + Math.round(6 * s),
    Math.round(8 * s),
    Math.round(7 * s)
  );
  g.fillStyle(gold, 0.6);
  g.fillRect(
    winX + Math.round(32 * s),
    winY + Math.round(6 * s),
    Math.round(8 * s),
    Math.round(7 * s)
  );
  g.fillStyle(0x60a5fa, 0.6);
  g.fillRect(
    winX + Math.round(14 * s),
    winY + Math.round(16 * s),
    Math.round(8 * s),
    Math.round(10 * s)
  );
  g.fillStyle(neonGreen, 0.5);
  g.fillRect(
    winX + Math.round(26 * s),
    winY + Math.round(16 * s),
    Math.round(8 * s),
    Math.round(10 * s)
  );
  g.fillStyle(gold, 0.5);
  g.fillRect(
    winX + Math.round(8 * s),
    winY + Math.round(29 * s),
    Math.round(10 * s),
    Math.round(8 * s)
  );
  g.fillStyle(neonPurple, 0.5);
  g.fillRect(
    winX + Math.round(22 * s),
    winY + Math.round(29 * s),
    Math.round(10 * s),
    Math.round(8 * s)
  );

  // Window frame — purple neon border
  g.fillStyle(neonPurple, 0.7);
  g.fillRect(winX, winY, winW, Math.round(2 * s));
  g.fillRect(winX, winY + winH - Math.round(2 * s), winW, Math.round(2 * s));
  g.fillRect(winX, winY, Math.round(2 * s), winH);
  g.fillRect(winX + winW - Math.round(2 * s), winY, Math.round(2 * s), winH);

  // Window glow on sidewalk
  g.fillStyle(neonPurple, 0.1);
  g.fillRect(
    winX - Math.round(4 * s),
    groundY - Math.round(4 * s),
    winW + Math.round(8 * s),
    Math.round(8 * s)
  );

  // Highlight corner (top-left window)
  g.fillStyle(0xffffff, 0.3);
  g.fillRect(
    winX + Math.round(2 * s),
    winY + Math.round(2 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );

  // === DOOR ===
  const doorW = Math.round(14 * s);
  const doorH = Math.round(22 * s);
  const doorX = cx - doorW / 2;
  const doorY = groundY - doorH;

  g.fillStyle(0x0a0a0f);
  g.fillRect(doorX, doorY, doorW, doorH);
  // Door frame (gold)
  g.fillStyle(gold, 0.7);
  g.fillRect(doorX - Math.round(1 * s), doorY, Math.round(1.5 * s), doorH);
  g.fillRect(doorX + doorW - Math.round(0.5 * s), doorY, Math.round(1.5 * s), doorH);
  g.fillRect(doorX, doorY - Math.round(1 * s), doorW, Math.round(2 * s));
  // Door handle
  g.fillStyle(gold);
  g.fillRect(
    doorX + doorW - Math.round(4 * s),
    doorY + Math.round(10 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );

  // === AWNING ===
  g.fillStyle(neonGreen, 0.3);
  g.fillRect(
    Math.round(6 * s),
    winY - Math.round(4 * s),
    w - Math.round(12 * s),
    Math.round(4 * s)
  );
  g.fillStyle(neonGreen, 0.5);
  g.fillRect(
    Math.round(6 * s),
    winY - Math.round(4 * s),
    w - Math.round(12 * s),
    Math.round(1 * s)
  );

  g.generateTexture("city_showcase_1", w, h);
  g.destroy();
}

// HOLOGRAPHIC KIOSK — Sleek standing kiosk with holographic screen, cyan/blue glow
function generateCityShowcase2(scene: Phaser.Scene, s: number): void {
  const w = Math.round(60 * s);
  const h = Math.round(110 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const metalDark = 0x1f2937;
  const metalMid = 0x374151;
  const metalLight = 0x4b5563;
  const cyan = 0x60a5fa;
  const cyanBright = 0x93c5fd;
  const neonBlue = 0x3b82f6;
  const neonGreen = 0x4ade80;
  const screenBg = 0x0a0a0f;

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === BASE / PEDESTAL ===
  // Wide base shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRect(
    Math.round(6 * s),
    groundY - Math.round(6 * s),
    w - Math.round(8 * s),
    Math.round(10 * s)
  );

  // Base plate
  g.fillStyle(metalDark);
  g.fillRect(
    Math.round(8 * s),
    groundY - Math.round(8 * s),
    w - Math.round(16 * s),
    Math.round(8 * s)
  );
  g.fillStyle(metalMid);
  g.fillRect(
    Math.round(8 * s),
    groundY - Math.round(8 * s),
    w - Math.round(16 * s),
    Math.round(2 * s)
  );
  // Base neon strip
  g.fillStyle(cyan, 0.5);
  g.fillRect(
    Math.round(10 * s),
    groundY - Math.round(3 * s),
    w - Math.round(20 * s),
    Math.round(1.5 * s)
  );

  // === PILLAR ===
  const pillarW = Math.round(14 * s);
  const pillarX = cx - pillarW / 2;
  const pillarTop = Math.round(40 * s);
  const pillarBottom = groundY - Math.round(8 * s);

  // Pillar shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRect(
    pillarX + Math.round(3 * s),
    pillarTop + Math.round(3 * s),
    pillarW,
    pillarBottom - pillarTop
  );

  // Pillar body
  g.fillStyle(metalDark);
  g.fillRect(pillarX, pillarTop, pillarW, pillarBottom - pillarTop);
  // Light left edge
  g.fillStyle(metalLight);
  g.fillRect(pillarX, pillarTop, Math.round(2 * s), pillarBottom - pillarTop);
  // Dark right edge
  g.fillStyle(darken(metalDark, 0.3));
  g.fillRect(
    pillarX + pillarW - Math.round(2 * s),
    pillarTop,
    Math.round(2 * s),
    pillarBottom - pillarTop
  );

  // Pillar detail — vertical neon strip
  g.fillStyle(cyan, 0.4);
  g.fillRect(
    cx - Math.round(1 * s),
    pillarTop + Math.round(4 * s),
    Math.round(2 * s),
    pillarBottom - pillarTop - Math.round(8 * s)
  );

  // Pillar horizontal accent bands
  g.fillStyle(metalMid);
  g.fillRect(pillarX, pillarTop + Math.round(12 * s), pillarW, Math.round(2 * s));
  g.fillRect(pillarX, pillarBottom - Math.round(12 * s), pillarW, Math.round(2 * s));

  // === SCREEN HOUSING ===
  const screenW = Math.round(36 * s);
  const screenH = Math.round(28 * s);
  const screenX = cx - screenW / 2;
  const screenY = pillarTop - Math.round(4 * s);

  // Housing frame
  g.fillStyle(metalDark);
  g.fillRect(
    screenX - Math.round(3 * s),
    screenY - Math.round(3 * s),
    screenW + Math.round(6 * s),
    screenH + Math.round(6 * s)
  );
  g.fillStyle(metalMid);
  g.fillRect(
    screenX - Math.round(3 * s),
    screenY - Math.round(3 * s),
    screenW + Math.round(6 * s),
    Math.round(2 * s)
  );

  // Screen
  g.fillStyle(screenBg);
  g.fillRect(screenX, screenY, screenW, screenH);

  // Screen content — digital readout
  g.fillStyle(cyan, 0.2);
  g.fillRect(
    screenX + Math.round(2 * s),
    screenY + Math.round(2 * s),
    screenW - Math.round(4 * s),
    screenH - Math.round(4 * s)
  );

  // Data lines
  g.fillStyle(neonGreen, 0.6);
  g.fillRect(
    screenX + Math.round(4 * s),
    screenY + Math.round(4 * s),
    Math.round(18 * s),
    Math.round(2 * s)
  );
  g.fillStyle(cyan, 0.5);
  g.fillRect(
    screenX + Math.round(4 * s),
    screenY + Math.round(9 * s),
    Math.round(24 * s),
    Math.round(2 * s)
  );
  g.fillStyle(neonGreen, 0.4);
  g.fillRect(
    screenX + Math.round(4 * s),
    screenY + Math.round(14 * s),
    Math.round(14 * s),
    Math.round(2 * s)
  );
  g.fillStyle(0xfbbf24, 0.5);
  g.fillRect(
    screenX + Math.round(20 * s),
    screenY + Math.round(14 * s),
    Math.round(10 * s),
    Math.round(2 * s)
  );
  g.fillStyle(cyan, 0.4);
  g.fillRect(
    screenX + Math.round(4 * s),
    screenY + Math.round(19 * s),
    Math.round(20 * s),
    Math.round(2 * s)
  );

  // Scan line effect
  g.fillStyle(0xffffff, 0.04);
  for (let sy = screenY; sy < screenY + screenH; sy += Math.round(3 * s)) {
    g.fillRect(screenX, sy, screenW, Math.round(1 * s));
  }

  // Screen highlight corner
  g.fillStyle(0xffffff, 0.2);
  g.fillRect(
    screenX + Math.round(1 * s),
    screenY + Math.round(1 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );

  // Screen border glow
  g.fillStyle(cyan, 0.6);
  g.fillRect(screenX, screenY, screenW, Math.round(1.5 * s));
  g.fillRect(screenX, screenY + screenH - Math.round(1.5 * s), screenW, Math.round(1.5 * s));
  g.fillRect(screenX, screenY, Math.round(1.5 * s), screenH);
  g.fillRect(screenX + screenW - Math.round(1.5 * s), screenY, Math.round(1.5 * s), screenH);

  // === HOLOGRAPHIC PROJECTION ABOVE SCREEN ===
  const holoY = screenY - Math.round(22 * s);
  const holoH = Math.round(18 * s);
  const holoW = Math.round(26 * s);
  const holoX = cx - holoW / 2;

  // Outer glow
  g.fillStyle(neonBlue, 0.08);
  g.fillRect(
    holoX - Math.round(6 * s),
    holoY - Math.round(4 * s),
    holoW + Math.round(12 * s),
    holoH + Math.round(8 * s)
  );
  // Mid glow
  g.fillStyle(cyan, 0.12);
  g.fillRect(
    holoX - Math.round(3 * s),
    holoY - Math.round(2 * s),
    holoW + Math.round(6 * s),
    holoH + Math.round(4 * s)
  );
  // Holo content
  g.fillStyle(cyanBright, 0.2);
  g.fillRect(holoX, holoY, holoW, holoH);

  // Holographic "token" shape — diamond
  g.fillStyle(cyanBright, 0.5);
  g.fillTriangle(
    cx,
    holoY + Math.round(2 * s),
    cx - Math.round(8 * s),
    holoY + holoH / 2,
    cx,
    holoY + holoH - Math.round(2 * s)
  );
  g.fillStyle(neonBlue, 0.4);
  g.fillTriangle(
    cx,
    holoY + Math.round(2 * s),
    cx + Math.round(8 * s),
    holoY + holoH / 2,
    cx,
    holoY + holoH - Math.round(2 * s)
  );
  // Diamond center bright line
  g.fillStyle(0xffffff, 0.4);
  g.fillRect(
    cx - Math.round(0.5 * s),
    holoY + Math.round(4 * s),
    Math.round(1 * s),
    holoH - Math.round(6 * s)
  );

  // Projection beam lines from screen to holo
  g.fillStyle(cyan, 0.15);
  g.fillTriangle(
    screenX + Math.round(4 * s),
    screenY - Math.round(1 * s),
    screenX + screenW - Math.round(4 * s),
    screenY - Math.round(1 * s),
    cx,
    holoY + holoH
  );

  // Screen glow on ground
  g.fillStyle(cyan, 0.08);
  g.fillRect(
    cx - Math.round(16 * s),
    groundY - Math.round(2 * s),
    Math.round(32 * s),
    Math.round(6 * s)
  );

  g.generateTexture("city_showcase_2", w, h);
  g.destroy();
}

// LED TOWER — Tall narrow tower covered in LED panels, antenna, scrolling data
function generateCityShowcase3(scene: Phaser.Scene, s: number): void {
  const w = Math.round(50 * s);
  const h = Math.round(130 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const panelDark = 0x1f2937;
  const panelMid = 0x374151;
  const panelLight = 0x4b5563;
  const neonPink = 0xec4899;
  const neonGreen = 0x4ade80;
  const neonBlue = 0x60a5fa;
  const gold = 0xfbbf24;
  const screenBg = 0x0a0a0f;

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === TOWER BASE ===
  const baseW = Math.round(34 * s);
  const baseX = cx - baseW / 2;

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillRect(baseX + Math.round(3 * s), groundY - Math.round(8 * s), baseW, Math.round(12 * s));

  // Wider base
  g.fillStyle(panelDark);
  g.fillRect(
    baseX - Math.round(4 * s),
    groundY - Math.round(10 * s),
    baseW + Math.round(8 * s),
    Math.round(10 * s)
  );
  g.fillStyle(panelMid);
  g.fillRect(
    baseX - Math.round(4 * s),
    groundY - Math.round(10 * s),
    baseW + Math.round(8 * s),
    Math.round(2 * s)
  );
  // Base neon accent
  g.fillStyle(neonPink, 0.5);
  g.fillRect(
    baseX - Math.round(2 * s),
    groundY - Math.round(4 * s),
    baseW + Math.round(4 * s),
    Math.round(1.5 * s)
  );

  // === TOWER BODY ===
  const towerTop = Math.round(18 * s);
  const towerBottom = groundY - Math.round(10 * s);
  const towerH = towerBottom - towerTop;

  // Tower shadow
  g.fillStyle(0x000000, 0.35);
  g.fillRect(baseX + Math.round(3 * s), towerTop + Math.round(3 * s), baseW, towerH);

  // Main tower body
  g.fillStyle(panelDark);
  g.fillRect(baseX, towerTop, baseW, towerH);
  // Light left edge
  g.fillStyle(panelLight);
  g.fillRect(baseX, towerTop, Math.round(3 * s), towerH);
  // Dark right edge
  g.fillStyle(darken(panelDark, 0.3));
  g.fillRect(baseX + baseW - Math.round(3 * s), towerTop, Math.round(3 * s), towerH);

  // === LED PANELS (4 rows of screen panels) ===
  const panelInset = Math.round(4 * s);
  const panelW = baseW - panelInset * 2;
  const panelH = Math.round(18 * s);
  const panelGap = Math.round(6 * s);

  for (let i = 0; i < 4; i++) {
    const py = towerTop + Math.round(6 * s) + i * (panelH + panelGap);
    const px = baseX + panelInset;

    // Panel background
    g.fillStyle(screenBg);
    g.fillRect(px, py, panelW, panelH);

    // LED pixel grid effect
    g.fillStyle(0x111827, 0.5);
    for (let gx = px; gx < px + panelW; gx += Math.round(3 * s)) {
      g.fillRect(gx, py, Math.round(1 * s), panelH);
    }

    // Data content — alternating colored lines per panel
    const colors = [neonGreen, neonPink, neonBlue, gold];
    const color = colors[i];
    const altColor = colors[(i + 2) % 4];

    // Horizontal data lines
    g.fillStyle(color, 0.6);
    g.fillRect(
      px + Math.round(2 * s),
      py + Math.round(3 * s),
      Math.round(14 * s),
      Math.round(2 * s)
    );
    g.fillStyle(altColor, 0.4);
    g.fillRect(
      px + Math.round(2 * s),
      py + Math.round(8 * s),
      Math.round(20 * s),
      Math.round(2 * s)
    );
    g.fillStyle(color, 0.5);
    g.fillRect(
      px + Math.round(2 * s),
      py + Math.round(13 * s),
      Math.round(10 * s),
      Math.round(2 * s)
    );

    // Panel border glow
    g.fillStyle(color, 0.4);
    g.fillRect(px, py, panelW, Math.round(1 * s));
    g.fillRect(px, py + panelH - Math.round(1 * s), panelW, Math.round(1 * s));
  }

  // === SIDE NEON STRIPS (vertical accents on tower edges) ===
  g.fillStyle(neonPink, 0.3);
  g.fillRect(
    baseX + Math.round(1 * s),
    towerTop + Math.round(4 * s),
    Math.round(1.5 * s),
    towerH - Math.round(8 * s)
  );
  g.fillStyle(neonGreen, 0.3);
  g.fillRect(
    baseX + baseW - Math.round(2.5 * s),
    towerTop + Math.round(4 * s),
    Math.round(1.5 * s),
    towerH - Math.round(8 * s)
  );

  // === HORIZONTAL ACCENT BANDS ===
  g.fillStyle(panelMid);
  g.fillRect(baseX - Math.round(2 * s), towerTop, baseW + Math.round(4 * s), Math.round(3 * s));
  g.fillRect(
    baseX - Math.round(1 * s),
    towerBottom - Math.round(3 * s),
    baseW + Math.round(2 * s),
    Math.round(3 * s)
  );
  // Bright top edge
  g.fillStyle(panelLight);
  g.fillRect(baseX - Math.round(2 * s), towerTop, baseW + Math.round(4 * s), Math.round(1 * s));

  // === ANTENNA ON TOP ===
  const antennaX = cx;
  const antennaBaseY = towerTop;
  const antennaH = Math.round(14 * s);

  // Antenna pole
  g.fillStyle(panelMid);
  g.fillRect(antennaX - Math.round(1.5 * s), antennaBaseY - antennaH, Math.round(3 * s), antennaH);
  g.fillStyle(panelLight);
  g.fillRect(antennaX - Math.round(1.5 * s), antennaBaseY - antennaH, Math.round(1 * s), antennaH);

  // Antenna crossbar
  g.fillStyle(panelMid);
  g.fillRect(
    antennaX - Math.round(5 * s),
    antennaBaseY - antennaH + Math.round(4 * s),
    Math.round(10 * s),
    Math.round(2 * s)
  );

  // Blinking light at top
  g.fillStyle(neonPink);
  g.fillCircle(antennaX, antennaBaseY - antennaH, Math.round(2 * s));
  // Light glow
  g.fillStyle(neonPink, 0.3);
  g.fillCircle(antennaX, antennaBaseY - antennaH, Math.round(4 * s));

  // === TOWER GLOW ON GROUND ===
  g.fillStyle(neonPink, 0.06);
  g.fillRect(
    baseX - Math.round(6 * s),
    groundY - Math.round(2 * s),
    baseW + Math.round(12 * s),
    Math.round(6 * s)
  );
  g.fillStyle(neonGreen, 0.04);
  g.fillRect(
    baseX - Math.round(4 * s),
    groundY - Math.round(1 * s),
    baseW + Math.round(8 * s),
    Math.round(5 * s)
  );

  g.generateTexture("city_showcase_3", w, h);
  g.destroy();
}

// ============================================================================
// PARK SHOWCASE BUILDINGS — nature-themed, green/brown/warm palette
// ============================================================================

// GREENHOUSE — Glass panels with green plants visible inside, wooden frame
function generateParkShowcase1(scene: Phaser.Scene, s: number): void {
  const w = Math.round(90 * s);
  const h = Math.round(95 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const wood = 0x78350f;
  const woodLight = lighten(wood, 0.2);
  const woodDark = darken(wood, 0.3);
  const glass = 0x86efac;
  const plantGreen = 0x22c55e;
  const plantDark = 0x166534;
  const soil = 0x451a03;

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === DROP SHADOW ===
  g.fillStyle(0x000000, 0.3);
  g.fillRect(
    Math.round(4 * s),
    Math.round(12 * s),
    w - Math.round(4 * s),
    groundY - Math.round(8 * s)
  );

  // === WOODEN BASE ===
  const baseH = Math.round(20 * s);
  const baseY = groundY - baseH;
  g.fillStyle(wood);
  g.fillRect(0, baseY, w, baseH);
  g.fillStyle(woodLight);
  g.fillRect(0, baseY, Math.round(3 * s), baseH);
  g.fillStyle(woodDark);
  g.fillRect(w - Math.round(3 * s), baseY, Math.round(3 * s), baseH);

  // Wood plank lines
  g.fillStyle(woodDark, 0.4);
  for (let py = baseY + Math.round(5 * s); py < groundY; py += Math.round(6 * s)) {
    g.fillRect(Math.round(3 * s), py, w - Math.round(6 * s), Math.round(1 * s));
  }

  // === GLASS GREENHOUSE BODY ===
  const glassY = Math.round(12 * s);
  const glassH = baseY - glassY;
  // Glass fill (semi-transparent green tint)
  g.fillStyle(glass, 0.2);
  g.fillRect(Math.round(4 * s), glassY, w - Math.round(8 * s), glassH);

  // Glass panels — vertical wooden struts dividing the glass
  const panelCount = 5;
  const panelW = Math.round((w - 8 * s) / panelCount);
  for (let i = 0; i <= panelCount; i++) {
    const px = Math.round(4 * s) + i * panelW;
    g.fillStyle(wood);
    g.fillRect(px - Math.round(1 * s), glassY, Math.round(2 * s), glassH);
  }
  // Horizontal strut mid-point
  g.fillStyle(wood);
  g.fillRect(
    Math.round(4 * s),
    glassY + Math.round(glassH / 2),
    w - Math.round(8 * s),
    Math.round(2 * s)
  );

  // Glass sheen (highlight in each panel)
  for (let i = 0; i < panelCount; i++) {
    const px = Math.round(4 * s) + i * panelW + Math.round(2 * s);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(px, glassY + Math.round(3 * s), Math.round(3 * s), Math.round(8 * s));
  }

  // === PLANTS INSIDE ===
  // Soil bed at bottom of glass section
  g.fillStyle(soil, 0.6);
  g.fillRect(
    Math.round(8 * s),
    baseY - Math.round(6 * s),
    w - Math.round(16 * s),
    Math.round(6 * s)
  );

  // Plant clusters (varied green blobs inside glass)
  const plantPositions = [0.15, 0.3, 0.5, 0.7, 0.85];
  for (const pct of plantPositions) {
    const px = Math.round(w * pct);
    const plantH = Math.round((8 + Math.floor(pct * 7)) * s);
    g.fillStyle(plantDark);
    g.fillRect(
      px - Math.round(4 * s),
      baseY - Math.round(6 * s) - plantH,
      Math.round(8 * s),
      plantH
    );
    g.fillStyle(plantGreen, 0.8);
    g.fillRect(
      px - Math.round(3 * s),
      baseY - Math.round(6 * s) - plantH + Math.round(2 * s),
      Math.round(6 * s),
      plantH - Math.round(4 * s)
    );
  }

  // === PEAKED GLASS ROOF ===
  const roofPeakY = Math.round(2 * s);
  // Left slope
  for (let row = 0; row < glassY - roofPeakY; row++) {
    const frac = row / (glassY - roofPeakY);
    const leftX = Math.round(cx - (cx - 4 * s) * frac);
    const rightX = Math.round(cx + (cx - 4 * s) * frac);
    g.fillStyle(glass, 0.12);
    g.fillRect(leftX, roofPeakY + row, rightX - leftX, 1);
  }
  // Roof frame lines
  g.fillStyle(wood, 0.8);
  for (let row = 0; row < glassY - roofPeakY; row++) {
    const frac = row / (glassY - roofPeakY);
    const leftX = Math.round(cx - (cx - 4 * s) * frac);
    const rightX = Math.round(cx + (cx - 4 * s) * frac);
    if (row === 0 || row === glassY - roofPeakY - 1) {
      g.fillRect(leftX, roofPeakY + row, rightX - leftX, Math.round(1 * s));
    }
  }
  // Ridge beam
  g.fillStyle(woodDark);
  g.fillRect(cx - Math.round(1 * s), roofPeakY, Math.round(2 * s), glassY - roofPeakY);

  // === DOOR ===
  const doorW = Math.round(12 * s);
  const doorH = Math.round(16 * s);
  const doorX = cx - doorW / 2;
  const doorY = groundY - doorH;
  g.fillStyle(plantDark);
  g.fillRect(doorX, doorY, doorW, doorH);
  g.fillStyle(woodLight, 0.7);
  g.fillRect(doorX - Math.round(1 * s), doorY, Math.round(1 * s), doorH);
  g.fillRect(doorX + doorW, doorY, Math.round(1 * s), doorH);
  g.fillRect(doorX, doorY - Math.round(1 * s), doorW, Math.round(1 * s));

  // === GROUND GLOW (nature warmth) ===
  g.fillStyle(plantGreen, 0.06);
  g.fillRect(0, groundY - Math.round(2 * s), w, Math.round(6 * s));

  g.generateTexture("park_showcase_1", w, h);
  g.destroy();
}

// GARDEN PAVILION — Open-air wooden structure with flower roof and hanging vines
function generateParkShowcase2(scene: Phaser.Scene, s: number): void {
  const w = Math.round(85 * s);
  const h = Math.round(95 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const wood = 0x78350f;
  const woodLight = lighten(wood, 0.25);
  const woodDark = darken(wood, 0.3);
  const flower1 = 0xec4899; // Pink
  const flower2 = 0xfbbf24; // Gold
  const flower3 = 0xa855f7; // Purple
  const leaf = 0x22c55e;
  const leafDark = 0x14532d;
  const stone = 0x6b7280;

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === DROP SHADOW ===
  g.fillStyle(0x000000, 0.3);
  g.fillRect(
    Math.round(6 * s),
    Math.round(10 * s),
    w - Math.round(6 * s),
    groundY - Math.round(6 * s)
  );

  // === STONE BASE/PLATFORM ===
  const baseH = Math.round(8 * s);
  const baseY = groundY - baseH;
  g.fillStyle(stone);
  g.fillRect(Math.round(4 * s), baseY, w - Math.round(8 * s), baseH);
  g.fillStyle(lighten(stone, 0.15));
  g.fillRect(Math.round(4 * s), baseY, w - Math.round(8 * s), Math.round(2 * s));
  // Stone texture
  g.fillStyle(darken(stone, 0.2), 0.3);
  for (let px = Math.round(8 * s); px < w - Math.round(8 * s); px += Math.round(10 * s)) {
    g.fillRect(px, baseY + Math.round(3 * s), Math.round(1 * s), Math.round(4 * s));
  }

  // === FOUR WOODEN PILLARS ===
  const pillarW = Math.round(5 * s);
  const pillarTop = Math.round(22 * s);
  const pillarPositions = [
    Math.round(10 * s),
    Math.round(30 * s),
    w - Math.round(35 * s),
    w - Math.round(15 * s),
  ];
  for (const px of pillarPositions) {
    g.fillStyle(wood);
    g.fillRect(px, pillarTop, pillarW, baseY - pillarTop);
    g.fillStyle(woodLight);
    g.fillRect(px, pillarTop, Math.round(2 * s), baseY - pillarTop);
    g.fillStyle(woodDark);
    g.fillRect(px + pillarW - Math.round(1 * s), pillarTop, Math.round(1 * s), baseY - pillarTop);
  }

  // === ROOF BEAM ===
  const roofBeamY = pillarTop;
  g.fillStyle(wood);
  g.fillRect(Math.round(6 * s), roofBeamY, w - Math.round(12 * s), Math.round(4 * s));
  g.fillStyle(woodLight);
  g.fillRect(Math.round(6 * s), roofBeamY, w - Math.round(12 * s), Math.round(1 * s));

  // === PEAKED FLOWER ROOF ===
  const roofPeakY = Math.round(4 * s);
  const roofBaseY = roofBeamY + Math.round(2 * s);
  // Leaf/thatch base
  for (let row = 0; row < roofBaseY - roofPeakY; row++) {
    const frac = row / (roofBaseY - roofPeakY);
    const halfW = Math.round((w / 2 + 4 * s) * frac);
    g.fillStyle(leafDark);
    g.fillRect(cx - halfW, roofPeakY + row, halfW * 2, 1);
  }
  // Lighter leaf layer
  for (
    let row = Math.round(2 * s);
    row < roofBaseY - roofPeakY - Math.round(2 * s);
    row += Math.round(3 * s)
  ) {
    const frac = row / (roofBaseY - roofPeakY);
    const halfW = Math.round((w / 2 + 2 * s) * frac);
    g.fillStyle(leaf, 0.6);
    g.fillRect(
      cx - halfW + Math.round(2 * s),
      roofPeakY + row,
      halfW * 2 - Math.round(4 * s),
      Math.round(2 * s)
    );
  }

  // Scattered flowers on roof
  const flowerColors = [flower1, flower2, flower3, flower1, flower2];
  const flowerXs = [0.2, 0.35, 0.5, 0.65, 0.8];
  for (let i = 0; i < flowerXs.length; i++) {
    const fx = Math.round(w * flowerXs[i]);
    const fy = roofPeakY + Math.round((roofBaseY - roofPeakY) * flowerXs[i] * 0.6);
    g.fillStyle(flowerColors[i]);
    g.fillRect(fx - Math.round(2 * s), fy, Math.round(4 * s), Math.round(3 * s));
    g.fillStyle(lighten(flowerColors[i], 0.3));
    g.fillRect(fx - Math.round(1 * s), fy, Math.round(2 * s), Math.round(1 * s));
  }

  // === HANGING VINES from roof ===
  const vinePositions = [
    Math.round(16 * s),
    Math.round(38 * s),
    w - Math.round(40 * s),
    w - Math.round(18 * s),
  ];
  for (const vx of vinePositions) {
    const vineLen = Math.round((12 + Math.floor(Math.random() * 8)) * s);
    g.fillStyle(leaf, 0.7);
    g.fillRect(vx, roofBaseY, Math.round(2 * s), vineLen);
    // Leaf at end
    g.fillStyle(leaf);
    g.fillRect(vx - Math.round(1 * s), roofBaseY + vineLen, Math.round(4 * s), Math.round(3 * s));
  }

  // === BENCH INSIDE ===
  const benchY = baseY - Math.round(8 * s);
  g.fillStyle(woodLight);
  g.fillRect(cx - Math.round(12 * s), benchY, Math.round(24 * s), Math.round(3 * s));
  g.fillStyle(wood);
  g.fillRect(
    cx - Math.round(10 * s),
    benchY + Math.round(3 * s),
    Math.round(3 * s),
    Math.round(5 * s)
  );
  g.fillRect(
    cx + Math.round(7 * s),
    benchY + Math.round(3 * s),
    Math.round(3 * s),
    Math.round(5 * s)
  );

  // === GROUND GLOW ===
  g.fillStyle(leaf, 0.05);
  g.fillRect(0, groundY - Math.round(2 * s), w, Math.round(6 * s));

  g.generateTexture("park_showcase_2", w, h);
  g.destroy();
}

// TREEHOUSE — Built into a large oak tree with rope ladder and lanterns
function generateParkShowcase3(scene: Phaser.Scene, s: number): void {
  const w = Math.round(90 * s);
  const h = Math.round(110 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const trunk = 0x78350f;
  const trunkLight = lighten(trunk, 0.15);
  const trunkDark = darken(trunk, 0.3);
  const wood = 0x92400e;
  const woodLight = lighten(wood, 0.2);
  const leafDark = 0x14532d;
  const leafMid = 0x166534;
  const leafBright = 0x22c55e;
  const lantern = 0xfbbf24;
  const rope = 0xb45309;

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === TREE TRUNK ===
  const trunkW = Math.round(20 * s);
  const trunkX = cx - trunkW / 2;
  g.fillStyle(trunk);
  g.fillRect(trunkX, Math.round(30 * s), trunkW, groundY - Math.round(30 * s));
  // Bark texture (lighter left, darker right)
  g.fillStyle(trunkLight);
  g.fillRect(trunkX, Math.round(30 * s), Math.round(5 * s), groundY - Math.round(30 * s));
  g.fillStyle(trunkDark);
  g.fillRect(
    trunkX + trunkW - Math.round(4 * s),
    Math.round(30 * s),
    Math.round(4 * s),
    groundY - Math.round(30 * s)
  );
  // Bark lines
  g.fillStyle(trunkDark, 0.4);
  for (let py = Math.round(35 * s); py < groundY; py += Math.round(8 * s)) {
    g.fillRect(trunkX + Math.round(5 * s), py, trunkW - Math.round(9 * s), Math.round(1 * s));
  }

  // === ROOTS at base ===
  g.fillStyle(trunk);
  g.fillRect(
    trunkX - Math.round(8 * s),
    groundY - Math.round(8 * s),
    Math.round(10 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    trunkX + trunkW - Math.round(2 * s),
    groundY - Math.round(6 * s),
    Math.round(8 * s),
    Math.round(6 * s)
  );

  // === TREE HOUSE CABIN ===
  const cabinW = Math.round(50 * s);
  const cabinH = Math.round(28 * s);
  const cabinX = cx - cabinW / 2;
  const cabinY = Math.round(32 * s);

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRect(cabinX + Math.round(3 * s), cabinY + Math.round(3 * s), cabinW, cabinH);

  // Cabin body
  g.fillStyle(wood);
  g.fillRect(cabinX, cabinY, cabinW, cabinH);
  g.fillStyle(woodLight);
  g.fillRect(cabinX, cabinY, Math.round(3 * s), cabinH);
  g.fillStyle(darken(wood, 0.25));
  g.fillRect(cabinX + cabinW - Math.round(3 * s), cabinY, Math.round(3 * s), cabinH);

  // Wood plank lines
  g.fillStyle(darken(wood, 0.2), 0.3);
  for (let py = cabinY + Math.round(5 * s); py < cabinY + cabinH; py += Math.round(5 * s)) {
    g.fillRect(cabinX + Math.round(3 * s), py, cabinW - Math.round(6 * s), Math.round(1 * s));
  }

  // Windows (2 small square windows with warm glow)
  const winSize = Math.round(8 * s);
  const winY = cabinY + Math.round(8 * s);
  // Left window
  g.fillStyle(lantern, 0.4);
  g.fillRect(cabinX + Math.round(8 * s), winY, winSize, winSize);
  g.fillStyle(lantern, 0.8);
  g.fillRect(
    cabinX + Math.round(9 * s),
    winY + Math.round(1 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );
  // Right window
  g.fillStyle(lantern, 0.4);
  g.fillRect(cabinX + cabinW - Math.round(16 * s), winY, winSize, winSize);
  g.fillStyle(lantern, 0.8);
  g.fillRect(
    cabinX + cabinW - Math.round(15 * s),
    winY + Math.round(1 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  // Door in center
  const doorW = Math.round(10 * s);
  const doorH = Math.round(14 * s);
  const doorX = cx - doorW / 2;
  const doorY = cabinY + cabinH - doorH;
  g.fillStyle(darken(wood, 0.3));
  g.fillRect(doorX, doorY, doorW, doorH);
  g.fillStyle(lantern, 0.3);
  g.fillRect(
    doorX + Math.round(1 * s),
    doorY + Math.round(1 * s),
    doorW - Math.round(2 * s),
    doorH - Math.round(2 * s)
  );

  // === PEAKED ROOF ===
  const roofPeakY = Math.round(14 * s);
  const roofBaseY = cabinY + Math.round(2 * s);
  const roofOverhang = Math.round(8 * s);
  for (let row = 0; row <= roofBaseY - roofPeakY; row++) {
    const frac = row / (roofBaseY - roofPeakY);
    const halfW = Math.round((cabinW / 2 + roofOverhang) * frac);
    g.fillStyle(row < Math.round(2 * s) ? darken(trunk, 0.1) : trunk);
    g.fillRect(cx - halfW, roofPeakY + row, halfW * 2, 1);
  }
  // Roof highlight left edge
  for (let row = 0; row <= roofBaseY - roofPeakY; row++) {
    const frac = row / (roofBaseY - roofPeakY);
    const halfW = Math.round((cabinW / 2 + roofOverhang) * frac);
    g.fillStyle(trunkLight, 0.3);
    g.fillRect(cx - halfW, roofPeakY + row, Math.round(2 * s), 1);
  }

  // === LEAFY CANOPY around and above cabin ===
  const canopyBlobs = [
    { x: 0.15, y: 0.08, r: 14 },
    { x: 0.35, y: 0.03, r: 16 },
    { x: 0.55, y: 0.01, r: 18 },
    { x: 0.75, y: 0.04, r: 15 },
    { x: 0.9, y: 0.09, r: 13 },
    { x: 0.25, y: 0.14, r: 12 },
    { x: 0.65, y: 0.12, r: 13 },
  ];
  for (const blob of canopyBlobs) {
    const bx = Math.round(w * blob.x);
    const by = Math.round(h * blob.y);
    const br = Math.round(blob.r * s);
    g.fillStyle(leafDark);
    g.fillCircle(bx, by, br);
    g.fillStyle(leafMid, 0.7);
    g.fillCircle(bx - Math.round(2 * s), by - Math.round(2 * s), br - Math.round(2 * s));
    g.fillStyle(leafBright, 0.3);
    g.fillCircle(bx - Math.round(3 * s), by - Math.round(3 * s), Math.round(br * 0.4));
  }

  // === ROPE LADDER ===
  const ladderX = cx + Math.round(14 * s);
  const ladderTop = cabinY + cabinH;
  g.fillStyle(rope);
  g.fillRect(ladderX, ladderTop, Math.round(1 * s), groundY - ladderTop);
  g.fillRect(ladderX + Math.round(6 * s), ladderTop, Math.round(1 * s), groundY - ladderTop);
  // Rungs
  for (
    let ry = ladderTop + Math.round(5 * s);
    ry < groundY - Math.round(3 * s);
    ry += Math.round(7 * s)
  ) {
    g.fillStyle(wood);
    g.fillRect(ladderX, ry, Math.round(7 * s), Math.round(2 * s));
  }

  // === HANGING LANTERNS ===
  const lanternPositions = [cabinX + Math.round(4 * s), cabinX + cabinW - Math.round(6 * s)];
  for (const lx of lanternPositions) {
    const ly = cabinY + cabinH + Math.round(2 * s);
    // String
    g.fillStyle(rope);
    g.fillRect(
      lx + Math.round(1 * s),
      cabinY + cabinH - Math.round(1 * s),
      Math.round(1 * s),
      Math.round(4 * s)
    );
    // Lantern body
    g.fillStyle(lantern);
    g.fillRect(lx, ly, Math.round(4 * s), Math.round(5 * s));
    // Glow
    g.fillStyle(lantern, 0.2);
    g.fillCircle(lx + Math.round(2 * s), ly + Math.round(2 * s), Math.round(6 * s));
  }

  // === GROUND GLOW ===
  g.fillStyle(lantern, 0.04);
  g.fillRect(0, groundY - Math.round(2 * s), w, Math.round(6 * s));

  g.generateTexture("park_showcase_3", w, h);
  g.destroy();
}

// ============================================================================
// MOLTBOOK BEACH SHOWCASE BUILDINGS — volcanic/tiki tropical theme
// ============================================================================

// VOLCANO HUT — Small volcano with a tiki hut built into its side, lava glow
function generateBeachShowcase1(scene: Phaser.Scene, s: number): void {
  const w = Math.round(90 * s);
  const h = Math.round(100 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const rock = 0x451a03;
  const rockLight = lighten(rock, 0.2);
  const rockDark = darken(rock, 0.3);
  const lava = 0xf97316;
  const lavaHot = 0xfbbf24;
  const lavaDark = 0xdc2626;
  const tiki = 0x92400e;
  const tikiLight = lighten(tiki, 0.2);
  const thatch = 0xb45309;
  const sand = 0xfef3c7;

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === SANDY BASE ===
  g.fillStyle(sand, 0.3);
  g.fillRect(0, groundY - Math.round(4 * s), w, Math.round(8 * s));

  // === VOLCANO MOUNTAIN ===
  const peakY = Math.round(8 * s);
  const baseW = w - Math.round(8 * s);
  // Build the mountain as rows getting narrower toward peak
  for (let row = 0; row <= groundY - peakY; row++) {
    const frac = 1 - row / (groundY - peakY);
    const halfW = Math.round((baseW / 2) * (1 - frac * 0.7));
    const rowColor = row < Math.round(30 * s) ? rockDark : rock;
    g.fillStyle(rowColor);
    g.fillRect(cx - halfW, peakY + row, halfW * 2, 1);
  }
  // Light left face
  for (let row = 0; row <= groundY - peakY; row++) {
    const frac = 1 - row / (groundY - peakY);
    const halfW = Math.round((baseW / 2) * (1 - frac * 0.7));
    g.fillStyle(rockLight, 0.25);
    g.fillRect(cx - halfW, peakY + row, Math.round(halfW * 0.4), 1);
  }

  // Rock texture (dithered dark patches)
  g.fillStyle(rockDark, 0.3);
  for (
    let py = peakY + Math.round(10 * s);
    py < groundY - Math.round(5 * s);
    py += Math.round(7 * s)
  ) {
    for (let px = cx - Math.round(20 * s); px < cx + Math.round(20 * s); px += Math.round(9 * s)) {
      g.fillRect(px, py, Math.round(3 * s), Math.round(2 * s));
    }
  }

  // === CRATER at top ===
  const craterW = Math.round(20 * s);
  const craterY = peakY + Math.round(2 * s);
  // Crater rim
  g.fillStyle(rockDark);
  g.fillRect(cx - craterW / 2, craterY, craterW, Math.round(6 * s));
  // Lava inside
  g.fillStyle(lavaDark);
  g.fillRect(
    cx - craterW / 2 + Math.round(3 * s),
    craterY + Math.round(1 * s),
    craterW - Math.round(6 * s),
    Math.round(4 * s)
  );
  g.fillStyle(lava, 0.8);
  g.fillRect(
    cx - craterW / 2 + Math.round(5 * s),
    craterY + Math.round(2 * s),
    craterW - Math.round(10 * s),
    Math.round(2 * s)
  );
  g.fillStyle(lavaHot, 0.6);
  g.fillRect(
    cx - Math.round(3 * s),
    craterY + Math.round(2 * s),
    Math.round(6 * s),
    Math.round(1 * s)
  );

  // Lava glow above crater
  g.fillStyle(lava, 0.15);
  g.fillCircle(cx, craterY, Math.round(14 * s));
  g.fillStyle(lavaHot, 0.08);
  g.fillCircle(cx, craterY - Math.round(4 * s), Math.round(10 * s));

  // === LAVA DRIPS down sides ===
  const dripPositions = [
    { x: cx - Math.round(8 * s), len: 18 },
    { x: cx + Math.round(6 * s), len: 14 },
    { x: cx - Math.round(2 * s), len: 22 },
  ];
  for (const drip of dripPositions) {
    g.fillStyle(lavaDark, 0.7);
    g.fillRect(drip.x, craterY + Math.round(4 * s), Math.round(2 * s), Math.round(drip.len * s));
    g.fillStyle(lava, 0.5);
    g.fillRect(
      drip.x,
      craterY + Math.round(4 * s),
      Math.round(1 * s),
      Math.round(drip.len * s * 0.7)
    );
  }

  // === TIKI HUT built into mountainside ===
  const hutX = Math.round(8 * s);
  const hutY = groundY - Math.round(32 * s);
  const hutW = Math.round(28 * s);
  const hutH = Math.round(28 * s);

  // Hut body
  g.fillStyle(tiki);
  g.fillRect(hutX, hutY, hutW, hutH);
  g.fillStyle(tikiLight);
  g.fillRect(hutX, hutY, Math.round(2 * s), hutH);

  // Thatched roof (triangle)
  const tRoofPeakY = hutY - Math.round(10 * s);
  for (let row = 0; row <= hutY - tRoofPeakY; row++) {
    const frac = row / (hutY - tRoofPeakY);
    const halfW = Math.round((hutW / 2 + 6 * s) * frac);
    g.fillStyle(thatch);
    g.fillRect(hutX + hutW / 2 - halfW, tRoofPeakY + row, halfW * 2, 1);
  }
  // Thatch texture
  g.fillStyle(lighten(thatch, 0.15), 0.5);
  for (let row = Math.round(2 * s); row < hutY - tRoofPeakY; row += Math.round(3 * s)) {
    const frac = row / (hutY - tRoofPeakY);
    const halfW = Math.round((hutW / 2 + 4 * s) * frac);
    g.fillRect(
      hutX + hutW / 2 - halfW + Math.round(2 * s),
      tRoofPeakY + row,
      halfW * 2 - Math.round(4 * s),
      Math.round(1 * s)
    );
  }

  // Hut door opening
  g.fillStyle(0x0a0a0f, 0.8);
  g.fillRect(
    hutX + Math.round(8 * s),
    hutY + Math.round(10 * s),
    Math.round(12 * s),
    Math.round(18 * s)
  );
  // Warm interior glow
  g.fillStyle(lava, 0.2);
  g.fillRect(
    hutX + Math.round(9 * s),
    hutY + Math.round(11 * s),
    Math.round(10 * s),
    Math.round(16 * s)
  );

  // === TIKI TORCHES ===
  const torchPositions = [hutX - Math.round(4 * s), hutX + hutW + Math.round(2 * s)];
  for (const tx of torchPositions) {
    // Pole
    g.fillStyle(tiki);
    g.fillRect(tx, hutY + Math.round(4 * s), Math.round(2 * s), groundY - hutY - Math.round(4 * s));
    // Flame
    g.fillStyle(lava);
    g.fillRect(
      tx - Math.round(1 * s),
      hutY + Math.round(1 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );
    g.fillStyle(lavaHot, 0.8);
    g.fillRect(tx, hutY, Math.round(2 * s), Math.round(3 * s));
    // Flame glow
    g.fillStyle(lava, 0.12);
    g.fillCircle(tx + Math.round(1 * s), hutY + Math.round(2 * s), Math.round(6 * s));
  }

  // === SMOKE WISPS above crater ===
  g.fillStyle(0x9ca3af, 0.15);
  g.fillCircle(cx - Math.round(3 * s), peakY - Math.round(6 * s), Math.round(4 * s));
  g.fillCircle(cx + Math.round(2 * s), peakY - Math.round(10 * s), Math.round(3 * s));
  g.fillCircle(cx - Math.round(1 * s), peakY - Math.round(14 * s), Math.round(2 * s));

  // === GROUND GLOW (lava warmth) ===
  g.fillStyle(lava, 0.06);
  g.fillRect(0, groundY - Math.round(2 * s), w, Math.round(6 * s));

  g.generateTexture("beach_showcase_1", w, h);
  g.destroy();
}

// TIKI TOWER — Tall bamboo/tiki tower with carved face, glowing eyes, palm fronds
function generateBeachShowcase2(scene: Phaser.Scene, s: number): void {
  const w = Math.round(70 * s);
  const h = Math.round(105 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const bamboo = 0x92400e;
  const bambooLight = lighten(bamboo, 0.25);
  const bambooDark = darken(bamboo, 0.3);
  const palm = 0x166534;
  const palmBright = 0x22c55e;
  const eyeGlow = 0x4ade80;
  const flame = 0xf97316;
  const flameHot = 0xfbbf24;
  const sand = 0xfef3c7;

  const cx = w / 2;
  const groundY = h - Math.round(4 * s);

  // === SANDY BASE ===
  g.fillStyle(sand, 0.3);
  g.fillRect(0, groundY - Math.round(4 * s), w, Math.round(8 * s));

  // === MAIN TIKI TOWER ===
  const towerW = Math.round(30 * s);
  const towerX = cx - towerW / 2;
  const towerTopY = Math.round(18 * s);

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRect(
    towerX + Math.round(3 * s),
    towerTopY + Math.round(3 * s),
    towerW,
    groundY - towerTopY
  );

  // Tower body
  g.fillStyle(bamboo);
  g.fillRect(towerX, towerTopY, towerW, groundY - towerTopY);
  // Light left edge
  g.fillStyle(bambooLight);
  g.fillRect(towerX, towerTopY, Math.round(4 * s), groundY - towerTopY);
  // Dark right edge
  g.fillStyle(bambooDark);
  g.fillRect(
    towerX + towerW - Math.round(3 * s),
    towerTopY,
    Math.round(3 * s),
    groundY - towerTopY
  );

  // Horizontal bamboo segment lines
  g.fillStyle(bambooDark, 0.5);
  for (let py = towerTopY + Math.round(8 * s); py < groundY; py += Math.round(10 * s)) {
    g.fillRect(towerX + Math.round(2 * s), py, towerW - Math.round(4 * s), Math.round(2 * s));
  }

  // === CARVED TIKI FACE ===
  const faceY = towerTopY + Math.round(10 * s);
  const faceH = Math.round(30 * s);

  // Face background (darker recess)
  g.fillStyle(bambooDark, 0.4);
  g.fillRect(towerX + Math.round(4 * s), faceY, towerW - Math.round(8 * s), faceH);

  // Eyes — large glowing rectangles
  const eyeW = Math.round(6 * s);
  const eyeH = Math.round(5 * s);
  const eyeY = faceY + Math.round(6 * s);
  // Left eye
  g.fillStyle(eyeGlow, 0.4);
  g.fillRect(
    towerX + Math.round(7 * s) - Math.round(1 * s),
    eyeY - Math.round(1 * s),
    eyeW + Math.round(2 * s),
    eyeH + Math.round(2 * s)
  );
  g.fillStyle(eyeGlow);
  g.fillRect(towerX + Math.round(7 * s), eyeY, eyeW, eyeH);
  // Right eye
  g.fillStyle(eyeGlow, 0.4);
  g.fillRect(
    towerX + towerW - Math.round(13 * s) - Math.round(1 * s),
    eyeY - Math.round(1 * s),
    eyeW + Math.round(2 * s),
    eyeH + Math.round(2 * s)
  );
  g.fillStyle(eyeGlow);
  g.fillRect(towerX + towerW - Math.round(13 * s), eyeY, eyeW, eyeH);

  // Angry eyebrow ridges (angled dark lines above eyes)
  g.fillStyle(bambooDark);
  g.fillRect(
    towerX + Math.round(6 * s),
    eyeY - Math.round(3 * s),
    Math.round(8 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    towerX + towerW - Math.round(14 * s),
    eyeY - Math.round(3 * s),
    Math.round(8 * s),
    Math.round(2 * s)
  );

  // Nose — small triangle/rectangle
  g.fillStyle(bambooDark);
  g.fillRect(
    cx - Math.round(2 * s),
    faceY + Math.round(14 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillStyle(bambooLight, 0.4);
  g.fillRect(
    cx - Math.round(1 * s),
    faceY + Math.round(14 * s),
    Math.round(1 * s),
    Math.round(3 * s)
  );

  // Mouth — wide grimace with teeth
  const mouthY = faceY + Math.round(20 * s);
  g.fillStyle(0x0a0a0f);
  g.fillRect(towerX + Math.round(7 * s), mouthY, towerW - Math.round(14 * s), Math.round(6 * s));
  // Teeth (alternating)
  g.fillStyle(sand);
  for (
    let tx = towerX + Math.round(8 * s);
    tx < towerX + towerW - Math.round(8 * s);
    tx += Math.round(4 * s)
  ) {
    g.fillRect(tx, mouthY, Math.round(2 * s), Math.round(3 * s));
    g.fillRect(tx, mouthY + Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
  }

  // Eye glow effect
  g.fillStyle(eyeGlow, 0.1);
  g.fillCircle(towerX + Math.round(10 * s), eyeY + Math.round(2 * s), Math.round(10 * s));
  g.fillCircle(towerX + towerW - Math.round(10 * s), eyeY + Math.round(2 * s), Math.round(10 * s));

  // === CROWN/TOP with flame bowl ===
  // Platform on top
  g.fillStyle(bamboo);
  g.fillRect(
    towerX - Math.round(4 * s),
    towerTopY - Math.round(3 * s),
    towerW + Math.round(8 * s),
    Math.round(5 * s)
  );
  g.fillStyle(bambooLight);
  g.fillRect(
    towerX - Math.round(4 * s),
    towerTopY - Math.round(3 * s),
    towerW + Math.round(8 * s),
    Math.round(1 * s)
  );

  // Fire bowl
  g.fillStyle(bambooDark);
  g.fillRect(
    cx - Math.round(6 * s),
    towerTopY - Math.round(6 * s),
    Math.round(12 * s),
    Math.round(4 * s)
  );
  // Flames
  g.fillStyle(flame);
  g.fillRect(
    cx - Math.round(5 * s),
    towerTopY - Math.round(12 * s),
    Math.round(10 * s),
    Math.round(7 * s)
  );
  g.fillStyle(flameHot, 0.8);
  g.fillRect(
    cx - Math.round(3 * s),
    towerTopY - Math.round(14 * s),
    Math.round(6 * s),
    Math.round(6 * s)
  );
  g.fillStyle(0xffffff, 0.4);
  g.fillRect(
    cx - Math.round(1 * s),
    towerTopY - Math.round(12 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );
  // Flame glow
  g.fillStyle(flame, 0.15);
  g.fillCircle(cx, towerTopY - Math.round(10 * s), Math.round(12 * s));

  // === PALM FRONDS from sides ===
  // Left frond
  g.fillStyle(palm);
  g.fillRect(
    towerX - Math.round(16 * s),
    towerTopY + Math.round(6 * s),
    Math.round(18 * s),
    Math.round(3 * s)
  );
  g.fillStyle(palmBright, 0.5);
  g.fillRect(
    towerX - Math.round(14 * s),
    towerTopY + Math.round(6 * s),
    Math.round(14 * s),
    Math.round(1 * s)
  );
  // Drooping leaf segments
  for (let i = 0; i < 4; i++) {
    const fx = towerX - Math.round((14 - i * 3) * s);
    const fy = towerTopY + Math.round((8 + i * 3) * s);
    g.fillStyle(palm, 0.7);
    g.fillRect(fx, fy, Math.round(4 * s), Math.round(5 * s));
  }
  // Right frond
  g.fillStyle(palm);
  g.fillRect(
    towerX + towerW - Math.round(2 * s),
    towerTopY + Math.round(10 * s),
    Math.round(16 * s),
    Math.round(3 * s)
  );
  g.fillStyle(palmBright, 0.5);
  g.fillRect(
    towerX + towerW,
    towerTopY + Math.round(10 * s),
    Math.round(12 * s),
    Math.round(1 * s)
  );
  for (let i = 0; i < 4; i++) {
    const fx = towerX + towerW + Math.round((2 + i * 3) * s);
    const fy = towerTopY + Math.round((12 + i * 3) * s);
    g.fillStyle(palm, 0.7);
    g.fillRect(fx, fy, Math.round(4 * s), Math.round(5 * s));
  }

  // === DOOR at base ===
  const doorW = Math.round(10 * s);
  const doorH = Math.round(16 * s);
  const doorX = cx - doorW / 2;
  const doorY = groundY - doorH;
  g.fillStyle(0x0a0a0f, 0.8);
  g.fillRect(doorX, doorY, doorW, doorH);
  // Arch top
  g.fillStyle(bamboo);
  g.fillRect(
    doorX - Math.round(1 * s),
    doorY - Math.round(2 * s),
    doorW + Math.round(2 * s),
    Math.round(3 * s)
  );

  // === GROUND GLOW (green mystic) ===
  g.fillStyle(eyeGlow, 0.05);
  g.fillRect(0, groundY - Math.round(2 * s), w, Math.round(6 * s));

  g.generateTexture("beach_showcase_2", w, h);
  g.destroy();
}
