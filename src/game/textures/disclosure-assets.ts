import * as Phaser from "phaser";
import { SCALE, PALETTE, darken, lighten } from "./constants";

// Disclosure Site color palette
const ALIEN = {
  teal: 0x00ffd4,
  tealDark: 0x00b396,
  tealDim: 0x007a66,
  voidPurple: 0x2d0a4e,
  plasmaGreen: 0x39ff14,
  plasmaGreenDim: 0x1a8a0a,
  hullGunmetal: 0x3a3d42,
  hullDark: 0x2a2d32,
  hullLight: 0x4a4d52,
  sand: 0xd4a76a,
  sandDark: 0xc4713b,
  sandLight: 0xe0c090,
  scorchedEarth: 0x8b5e3c,
  militaryOlive: 0x4a5534,
  militaryOliveDark: 0x3a4528,
  militaryOliveLight: 0x5a6540,
  concrete: 0x7a7a7a,
  concreteDark: 0x5a5a5a,
  crystal: 0x00ffd4,
  crystalInner: 0x00e5be,
  rust: 0x8b4513,
  rustLight: 0xa0522d,
};

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateDisclosureAssets(scene: Phaser.Scene): void {
  generateDisclosureGround(scene);
  generateWreckage(scene);
  generateAAROFieldOffice(scene);
  generateXenobazaar(scene);
  generateSignalTower(scene);
  generateHangar18(scene);
  generateCropCircleCantina(scene);
  generateDisclosureProps(scene);
}

// ============================================================================
// GROUND TEXTURE — Cracked desert with alien crystal patches
// ============================================================================
function generateDisclosureGround(scene: Phaser.Scene): void {
  const s = SCALE;
  const size = Math.round(80 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });
  const rand = rng(2026);
  const r = (n: number) => Math.round(n * s);

  // Base: dusty terracotta hardpan
  g.fillStyle(ALIEN.sandDark);
  g.fillRect(0, 0, size, size);

  // Darker earth patches
  g.fillStyle(ALIEN.scorchedEarth);
  for (let i = 0; i < 6; i++) {
    const px = Math.floor(rand() * (size - r(12)));
    const py = Math.floor(rand() * (size - r(8)));
    g.fillRect(px, py, r(8 + rand() * 12), r(5 + rand() * 8));
  }

  // Sand highlight patches
  g.fillStyle(ALIEN.sandLight, 0.3);
  for (let i = 0; i < 4; i++) {
    const px = Math.floor(rand() * (size - r(10)));
    const py = Math.floor(rand() * (size - r(6)));
    g.fillRect(px, py, r(6 + rand() * 10), r(3 + rand() * 5));
  }

  // Crack lines (dark fissures in the earth)
  g.fillStyle(darken(ALIEN.scorchedEarth, 0.4));
  for (let i = 0; i < 5; i++) {
    const cx = Math.floor(rand() * size);
    const cy = Math.floor(rand() * size);
    const len = r(8 + rand() * 20);
    const isHoriz = rand() > 0.5;
    if (isHoriz) {
      g.fillRect(cx, cy, len, r(1));
      // Branch
      if (rand() > 0.5) {
        g.fillRect(cx + r(3), cy, r(1), r(3 + rand() * 5));
      }
    } else {
      g.fillRect(cx, cy, r(1), len);
      if (rand() > 0.5) {
        g.fillRect(cx, cy + r(3), r(3 + rand() * 5), r(1));
      }
    }
  }

  // Alien crystal growth patches (teal pixel clusters bleeding from crash site)
  g.fillStyle(ALIEN.tealDim, 0.5);
  for (let i = 0; i < 3; i++) {
    const cx = Math.floor(rand() * (size - r(8)));
    const cy = Math.floor(rand() * (size - r(6)));
    for (let j = 0; j < 4; j++) {
      g.fillRect(
        cx + Math.floor(rand() * r(8)),
        cy + Math.floor(rand() * r(6)),
        r(1 + rand() * 2),
        r(1 + rand() * 2)
      );
    }
  }

  // Bright teal crystal pixels (sparse)
  g.fillStyle(ALIEN.teal, 0.35);
  for (let i = 0; i < 4; i++) {
    g.fillRect(Math.floor(rand() * (size - r(2))), Math.floor(rand() * (size - r(2))), r(1), r(1));
  }

  // Pebble scatter
  const pebbleColors = [darken(ALIEN.sand, 0.2), darken(ALIEN.sandDark, 0.15), ALIEN.scorchedEarth];
  for (let i = 0; i < 8; i++) {
    g.fillStyle(pebbleColors[Math.floor(rand() * pebbleColors.length)], 0.6);
    g.fillRect(
      Math.floor(rand() * (size - r(3))),
      Math.floor(rand() * (size - r(2))),
      r(1 + rand() * 2),
      r(1 + rand())
    );
  }

  g.generateTexture("disclosure_ground", size, size);
  g.destroy();
}

// ============================================================================
// THE WRECKAGE — Massive crashed saucer (centerpiece, 80px wide)
// ============================================================================
function generateWreckage(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(140 * s);
  const canvasH = Math.round(200 * s);
  const centerX = canvasW / 2;

  // Ground shadow
  g.fillStyle(PALETTE.void, 0.5);
  g.fillEllipse(
    centerX + Math.round(4 * s),
    canvasH - Math.round(8 * s),
    Math.round(120 * s),
    Math.round(20 * s)
  );

  // Teal underglow from alien tech (on ground beneath the craft)
  g.fillStyle(ALIEN.teal, 0.15);
  g.fillEllipse(centerX, canvasH - Math.round(10 * s), Math.round(100 * s), Math.round(16 * s));

  // Main saucer hull — stacked tapered rectangles to form disc shape
  // The craft is tilted ~15 degrees, so left side is higher
  const hullY = canvasH - Math.round(60 * s);
  const tiltOffset = Math.round(12 * s); // left side raised

  // Bottom hull section (widest, partially buried)
  g.fillStyle(ALIEN.hullDark);
  g.fillRect(
    centerX - Math.round(55 * s),
    hullY - tiltOffset / 2,
    Math.round(110 * s),
    Math.round(18 * s)
  );

  // Main hull body
  g.fillStyle(ALIEN.hullGunmetal);
  g.fillRect(
    centerX - Math.round(50 * s),
    hullY - Math.round(18 * s) - tiltOffset / 2,
    Math.round(100 * s),
    Math.round(20 * s)
  );

  // Upper hull (tapered)
  g.fillStyle(ALIEN.hullLight);
  g.fillRect(
    centerX - Math.round(40 * s),
    hullY - Math.round(35 * s) - tiltOffset / 2,
    Math.round(80 * s),
    Math.round(18 * s)
  );

  // Dome (top of saucer)
  g.fillStyle(lighten(ALIEN.hullGunmetal, 0.15));
  g.fillRect(
    centerX - Math.round(25 * s),
    hullY - Math.round(50 * s) - tiltOffset / 2,
    Math.round(50 * s),
    Math.round(16 * s)
  );

  // Dome top cap
  g.fillStyle(lighten(ALIEN.hullGunmetal, 0.25));
  g.fillRect(
    centerX - Math.round(15 * s),
    hullY - Math.round(60 * s) - tiltOffset / 2,
    Math.round(30 * s),
    Math.round(12 * s)
  );

  // 3D depth: light left edge on hull
  g.fillStyle(lighten(ALIEN.hullGunmetal, 0.2));
  g.fillRect(
    centerX - Math.round(50 * s),
    hullY - Math.round(18 * s) - tiltOffset / 2,
    Math.round(6 * s),
    Math.round(20 * s)
  );

  // 3D depth: dark right edge on hull
  g.fillStyle(darken(ALIEN.hullGunmetal, 0.25));
  g.fillRect(
    centerX + Math.round(44 * s),
    hullY - Math.round(18 * s) - tiltOffset / 2,
    Math.round(6 * s),
    Math.round(20 * s)
  );

  // Teal glowing seam lines across the hull
  const seamY = hullY - Math.round(25 * s) - tiltOffset / 2;
  g.fillStyle(ALIEN.teal, 0.6);
  g.fillRect(centerX - Math.round(45 * s), seamY, Math.round(90 * s), Math.round(2 * s));
  g.fillRect(
    centerX - Math.round(38 * s),
    seamY - Math.round(15 * s),
    Math.round(76 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    centerX - Math.round(22 * s),
    seamY - Math.round(28 * s),
    Math.round(44 * s),
    Math.round(2 * s)
  );

  // Teal seam glow aura (semi-transparent wider line behind seam)
  g.fillStyle(ALIEN.teal, 0.2);
  g.fillRect(
    centerX - Math.round(46 * s),
    seamY - Math.round(1 * s),
    Math.round(92 * s),
    Math.round(4 * s)
  );

  // Breach in the hull (right side torn open)
  const breachX = centerX + Math.round(20 * s);
  const breachY = hullY - Math.round(35 * s) - tiltOffset / 2;
  const breachW = Math.round(30 * s);
  const breachH = Math.round(30 * s);

  // Dark interior visible through breach
  g.fillStyle(ALIEN.voidPurple);
  g.fillRect(breachX, breachY, breachW, breachH);

  // Interior circuitry layers visible through breach
  g.fillStyle(ALIEN.teal, 0.4);
  g.fillRect(
    breachX + Math.round(3 * s),
    breachY + Math.round(5 * s),
    breachW - Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    breachX + Math.round(5 * s),
    breachY + Math.round(12 * s),
    breachW - Math.round(10 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    breachX + Math.round(3 * s),
    breachY + Math.round(19 * s),
    breachW - Math.round(6 * s),
    Math.round(2 * s)
  );

  g.fillStyle(ALIEN.voidPurple, 0.8);
  g.fillRect(
    breachX + Math.round(8 * s),
    breachY + Math.round(8 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    breachX + Math.round(16 * s),
    breachY + Math.round(14 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  // Purple circuitry
  g.fillStyle(lighten(ALIEN.voidPurple, 0.4), 0.5);
  g.fillRect(
    breachX + Math.round(4 * s),
    breachY + Math.round(9 * s),
    Math.round(12 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    breachX + Math.round(10 * s),
    breachY + Math.round(9 * s),
    Math.round(1 * s),
    Math.round(8 * s)
  );

  // Jagged breach edges (torn metal)
  g.fillStyle(ALIEN.hullLight);
  g.fillRect(breachX - Math.round(2 * s), breachY, Math.round(3 * s), breachH);
  g.fillRect(breachX, breachY - Math.round(2 * s), breachW, Math.round(3 * s));
  // Jagged teeth on breach edge
  for (let i = 0; i < 5; i++) {
    g.fillRect(
      breachX - Math.round(2 * s),
      breachY + i * Math.round(6 * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
  }

  // Buried bottom section (earth over the lower hull)
  g.fillStyle(ALIEN.sandDark);
  g.fillRect(
    centerX - Math.round(60 * s),
    hullY + Math.round(10 * s),
    Math.round(120 * s),
    Math.round(20 * s)
  );
  g.fillStyle(ALIEN.scorchedEarth);
  g.fillRect(
    centerX - Math.round(55 * s),
    hullY + Math.round(5 * s),
    Math.round(30 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    centerX + Math.round(15 * s),
    hullY + Math.round(8 * s),
    Math.round(35 * s),
    Math.round(10 * s)
  );

  // Impact crater rim
  g.fillStyle(darken(ALIEN.sandDark, 0.3));
  g.fillRect(
    centerX - Math.round(65 * s),
    hullY + Math.round(15 * s),
    Math.round(130 * s),
    Math.round(3 * s)
  );

  g.generateTexture("disclosure_wreckage", canvasW, canvasH);
  g.destroy();
}

// ============================================================================
// AARO FIELD OFFICE — Military prefab building with antennas
// ============================================================================
function generateAAROFieldOffice(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(90 * s);
  const canvasH = Math.round(130 * s);
  const bWidth = Math.round(70 * s);
  const bHeight = Math.round(55 * s);
  const baseX = Math.round(10 * s);
  const baseY = canvasH - bHeight - Math.round(5 * s);

  // Shadow
  g.fillStyle(PALETTE.void, 0.5);
  g.fillRect(
    baseX + Math.round(5 * s),
    canvasH - Math.round(4 * s),
    bWidth - Math.round(2 * s),
    Math.round(5 * s)
  );

  // Main body (olive drab military prefab)
  g.fillStyle(ALIEN.militaryOlive);
  g.fillRect(baseX, baseY, bWidth, bHeight);

  // 3D depth: light left
  g.fillStyle(ALIEN.militaryOliveLight);
  g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);

  // 3D depth: dark right
  g.fillStyle(ALIEN.militaryOliveDark);
  g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

  // Flat roof (slightly wider than building)
  g.fillStyle(darken(ALIEN.militaryOlive, 0.2));
  g.fillRect(
    baseX - Math.round(3 * s),
    baseY - Math.round(5 * s),
    bWidth + Math.round(6 * s),
    Math.round(7 * s)
  );

  // Roof highlight
  g.fillStyle(lighten(ALIEN.militaryOlive, 0.1));
  g.fillRect(
    baseX - Math.round(3 * s),
    baseY - Math.round(5 * s),
    bWidth + Math.round(6 * s),
    Math.round(2 * s)
  );

  // Satellite dish on roof (left)
  const dishX = baseX + Math.round(12 * s);
  const dishY = baseY - Math.round(5 * s);
  g.fillStyle(ALIEN.concrete);
  g.fillRect(
    dishX + Math.round(3 * s),
    dishY - Math.round(16 * s),
    Math.round(2 * s),
    Math.round(16 * s)
  ); // mast
  g.fillRect(dishX, dishY - Math.round(20 * s), Math.round(10 * s), Math.round(6 * s)); // dish
  g.fillStyle(lighten(ALIEN.concrete, 0.2));
  g.fillRect(dishX, dishY - Math.round(20 * s), Math.round(10 * s), Math.round(2 * s)); // dish highlight

  // Antenna array on roof (right)
  const antX = baseX + bWidth - Math.round(20 * s);
  g.fillStyle(ALIEN.concrete);
  g.fillRect(antX, dishY - Math.round(24 * s), Math.round(2 * s), Math.round(24 * s));
  g.fillRect(
    antX + Math.round(6 * s),
    dishY - Math.round(18 * s),
    Math.round(2 * s),
    Math.round(18 * s)
  );
  g.fillRect(
    antX + Math.round(12 * s),
    dishY - Math.round(21 * s),
    Math.round(2 * s),
    Math.round(21 * s)
  );
  // Crossbar
  g.fillRect(
    antX - Math.round(1 * s),
    dishY - Math.round(18 * s),
    Math.round(16 * s),
    Math.round(2 * s)
  );

  // Blinking red security light on roof (static, will be animated in zone)
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(
    baseX + bWidth / 2 - Math.round(2 * s),
    baseY - Math.round(10 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  // Light glow
  g.fillStyle(PALETTE.brightRed, 0.3);
  g.fillRect(
    baseX + bWidth / 2 - Math.round(4 * s),
    baseY - Math.round(12 * s),
    Math.round(8 * s),
    Math.round(8 * s)
  );

  // Windows (small, square, military-style)
  const windowColor = 0xc8d6e5;
  const windowGlow = 0xe2e8f0;
  for (let i = 0; i < 3; i++) {
    const wx = baseX + Math.round(12 * s) + i * Math.round(20 * s);
    const wy = baseY + Math.round(12 * s);
    // Window glow aura
    g.fillStyle(windowGlow, 0.2);
    g.fillRect(
      wx - Math.round(1 * s),
      wy - Math.round(1 * s),
      Math.round(12 * s),
      Math.round(12 * s)
    );
    // Window
    g.fillStyle(windowColor);
    g.fillRect(wx, wy, Math.round(10 * s), Math.round(10 * s));
    // Cross frame
    g.fillStyle(ALIEN.militaryOliveDark);
    g.fillRect(wx + Math.round(4 * s), wy, Math.round(2 * s), Math.round(10 * s));
    g.fillRect(wx, wy + Math.round(4 * s), Math.round(10 * s), Math.round(2 * s));
    // Highlight corner
    g.fillStyle(PALETTE.white, 0.4);
    g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));
  }

  // Door (center)
  const doorX = baseX + bWidth / 2 - Math.round(7 * s);
  const doorY = baseY + bHeight - Math.round(22 * s);
  g.fillStyle(darken(ALIEN.militaryOlive, 0.3));
  g.fillRect(doorX, doorY, Math.round(14 * s), Math.round(22 * s));
  // Door frame
  g.fillStyle(ALIEN.militaryOliveDark);
  g.fillRect(
    doorX - Math.round(1 * s),
    doorY - Math.round(1 * s),
    Math.round(16 * s),
    Math.round(2 * s)
  );
  g.fillRect(doorX - Math.round(1 * s), doorY, Math.round(2 * s), Math.round(22 * s));
  g.fillRect(doorX + Math.round(13 * s), doorY, Math.round(2 * s), Math.round(22 * s));

  // CLASSIFIED stamp on door
  g.fillStyle(PALETTE.brightRed, 0.8);
  g.fillRect(
    doorX + Math.round(2 * s),
    doorY + Math.round(5 * s),
    Math.round(10 * s),
    Math.round(6 * s)
  );

  // US flag (tiny, on left of building)
  const flagX = baseX + Math.round(4 * s);
  const flagY = baseY + Math.round(5 * s);
  // Pole
  g.fillStyle(ALIEN.concrete);
  g.fillRect(flagX, flagY, Math.round(1 * s), Math.round(14 * s));
  // Stripes (red and white)
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(flagX + Math.round(1 * s), flagY, Math.round(8 * s), Math.round(2 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(
    flagX + Math.round(1 * s),
    flagY + Math.round(2 * s),
    Math.round(8 * s),
    Math.round(1 * s)
  );
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(
    flagX + Math.round(1 * s),
    flagY + Math.round(3 * s),
    Math.round(8 * s),
    Math.round(2 * s)
  );
  // Blue canton
  g.fillStyle(PALETTE.navy);
  g.fillRect(flagX + Math.round(1 * s), flagY, Math.round(3 * s), Math.round(3 * s));

  g.generateTexture("disclosure_aaro", canvasW, canvasH);
  g.destroy();
}

// ============================================================================
// XENOBAZAAR — Hovering alien marketplace on anti-gravity pylons
// ============================================================================
function generateXenobazaar(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(100 * s);
  const canvasH = Math.round(140 * s);
  const centerX = canvasW / 2;
  const platformW = Math.round(80 * s);
  const platformH = Math.round(12 * s);
  const platformY = canvasH - Math.round(45 * s);

  // Teal underglow on ground (from anti-gravity pylons)
  g.fillStyle(ALIEN.teal, 0.15);
  g.fillEllipse(centerX, canvasH - Math.round(8 * s), Math.round(70 * s), Math.round(12 * s));

  // Three anti-gravity pylons (tapered columns)
  const pylonPositions = [-Math.round(30 * s), 0, Math.round(30 * s)];
  pylonPositions.forEach((offset) => {
    const px = centerX + offset;
    // Pylon body (wider at base, narrow at top)
    g.fillStyle(ALIEN.hullDark);
    g.fillRect(
      px - Math.round(4 * s),
      platformY + platformH,
      Math.round(8 * s),
      Math.round(30 * s)
    );
    g.fillStyle(ALIEN.hullGunmetal);
    g.fillRect(
      px - Math.round(3 * s),
      platformY + platformH,
      Math.round(6 * s),
      Math.round(28 * s)
    );
    // Energy ring on pylon
    g.fillStyle(ALIEN.teal, 0.5);
    g.fillRect(
      px - Math.round(5 * s),
      platformY + platformH + Math.round(10 * s),
      Math.round(10 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      px - Math.round(5 * s),
      platformY + platformH + Math.round(20 * s),
      Math.round(10 * s),
      Math.round(2 * s)
    );
    // Base glow
    g.fillStyle(ALIEN.teal, 0.3);
    g.fillRect(
      px - Math.round(6 * s),
      canvasH - Math.round(15 * s),
      Math.round(12 * s),
      Math.round(4 * s)
    );
  });

  // Main hovering platform (obsidian black)
  g.fillStyle(0x0a0a12);
  g.fillRect(centerX - platformW / 2, platformY, platformW, platformH);

  // Platform edge highlight
  g.fillStyle(ALIEN.teal, 0.4);
  g.fillRect(centerX - platformW / 2, platformY, platformW, Math.round(2 * s));
  g.fillRect(
    centerX - platformW / 2,
    platformY + platformH - Math.round(2 * s),
    platformW,
    Math.round(2 * s)
  );
  g.fillRect(centerX - platformW / 2, platformY, Math.round(2 * s), platformH);
  g.fillRect(centerX + platformW / 2 - Math.round(2 * s), platformY, Math.round(2 * s), platformH);

  // Alien glyphs etched in the platform (green lines)
  g.fillStyle(ALIEN.plasmaGreen, 0.35);
  // Glyph 1 (angular shape)
  g.fillRect(
    centerX - Math.round(25 * s),
    platformY + Math.round(4 * s),
    Math.round(8 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    centerX - Math.round(25 * s),
    platformY + Math.round(4 * s),
    Math.round(1 * s),
    Math.round(5 * s)
  );
  g.fillRect(
    centerX - Math.round(20 * s),
    platformY + Math.round(6 * s),
    Math.round(1 * s),
    Math.round(3 * s)
  );
  // Glyph 2
  g.fillRect(
    centerX + Math.round(15 * s),
    platformY + Math.round(3 * s),
    Math.round(1 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    centerX + Math.round(15 * s),
    platformY + Math.round(3 * s),
    Math.round(6 * s),
    Math.round(1 * s)
  );
  g.fillRect(
    centerX + Math.round(20 * s),
    platformY + Math.round(5 * s),
    Math.round(1 * s),
    Math.round(4 * s)
  );

  // Energy canopy above (shimmering dithered purple/teal)
  const canopyY = platformY - Math.round(40 * s);
  const canopyH = Math.round(35 * s);
  for (let row = 0; row < canopyH; row += Math.round(2 * s)) {
    const isEven = (row / Math.round(2 * s)) % 2 === 0;
    g.fillStyle(isEven ? ALIEN.voidPurple : ALIEN.tealDim, isEven ? 0.3 : 0.2);
    g.fillRect(
      centerX - platformW / 2 + Math.round(5 * s),
      canopyY + row,
      platformW - Math.round(10 * s),
      Math.round(2 * s)
    );
  }

  // Canopy edge glow
  g.fillStyle(ALIEN.teal, 0.3);
  g.fillRect(
    centerX - platformW / 2 + Math.round(3 * s),
    canopyY,
    platformW - Math.round(6 * s),
    Math.round(2 * s)
  );

  // Crystalline shelves on platform (displayed goods)
  for (let i = 0; i < 4; i++) {
    const shelfX = centerX - Math.round(30 * s) + i * Math.round(18 * s);
    // Shelf
    g.fillStyle(ALIEN.crystal, 0.3);
    g.fillRect(shelfX, platformY - Math.round(8 * s), Math.round(12 * s), Math.round(8 * s));
    // Item on shelf (colorful pixel)
    const itemColors = [
      ALIEN.teal,
      ALIEN.plasmaGreen,
      lighten(ALIEN.voidPurple, 0.5),
      PALETTE.gold,
    ];
    g.fillStyle(itemColors[i]);
    g.fillRect(
      shelfX + Math.round(3 * s),
      platformY - Math.round(12 * s),
      Math.round(6 * s),
      Math.round(4 * s)
    );
  }

  g.generateTexture("disclosure_xenobazaar", canvasW, canvasH);
  g.destroy();
}

// ============================================================================
// SIGNAL TOWER — Tall spindly tower with alien crystal array
// ============================================================================
function generateSignalTower(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(50 * s);
  const canvasH = Math.round(180 * s);
  const centerX = canvasW / 2;

  // Shadow
  g.fillStyle(PALETTE.void, 0.4);
  g.fillEllipse(
    centerX + Math.round(3 * s),
    canvasH - Math.round(3 * s),
    Math.round(30 * s),
    Math.round(8 * s)
  );

  // Concrete bunker base
  const baseW = Math.round(30 * s);
  const baseH = Math.round(25 * s);
  const baseX = centerX - baseW / 2;
  const baseY = canvasH - baseH;
  g.fillStyle(ALIEN.concreteDark);
  g.fillRect(baseX, baseY, baseW, baseH);
  g.fillStyle(ALIEN.concrete);
  g.fillRect(
    baseX + Math.round(2 * s),
    baseY + Math.round(2 * s),
    baseW - Math.round(4 * s),
    baseH - Math.round(4 * s)
  );
  // Base door
  g.fillStyle(darken(ALIEN.concrete, 0.3));
  g.fillRect(
    centerX - Math.round(4 * s),
    baseY + baseH - Math.round(14 * s),
    Math.round(8 * s),
    Math.round(14 * s)
  );

  // Steel lattice mid-section
  const latticeBottom = baseY;
  const latticeTop = Math.round(50 * s);
  const latticeW = Math.round(16 * s);
  // Vertical struts
  g.fillStyle(ALIEN.concrete);
  g.fillRect(centerX - latticeW / 2, latticeTop, Math.round(3 * s), latticeBottom - latticeTop);
  g.fillRect(
    centerX + latticeW / 2 - Math.round(3 * s),
    latticeTop,
    Math.round(3 * s),
    latticeBottom - latticeTop
  );
  // Cross bracing (X pattern repeated)
  g.fillStyle(darken(ALIEN.concrete, 0.15));
  const braceSpacing = Math.round(20 * s);
  for (let y = latticeTop; y < latticeBottom - braceSpacing; y += braceSpacing) {
    // Left-to-right diagonal (approximated with small rects)
    for (let step = 0; step < 5; step++) {
      const t = step / 4;
      g.fillRect(
        centerX - latticeW / 2 + Math.round(3 * s) + Math.round((t * (latticeW - 6) * s) / SCALE),
        y + Math.round(t * braceSpacing),
        Math.round(2 * s),
        Math.round(2 * s)
      );
    }
    // Right-to-left diagonal
    for (let step = 0; step < 5; step++) {
      const t = step / 4;
      g.fillRect(
        centerX + latticeW / 2 - Math.round(5 * s) - Math.round((t * (latticeW - 6) * s) / SCALE),
        y + Math.round(t * braceSpacing),
        Math.round(2 * s),
        Math.round(2 * s)
      );
    }
  }

  // Alien crystal array at top — diamond shape
  const crystalCenterY = Math.round(30 * s);
  const crystalSize = Math.round(12 * s);

  // Crystal glow aura
  g.fillStyle(ALIEN.teal, 0.2);
  g.fillRect(centerX - crystalSize, crystalCenterY - crystalSize, crystalSize * 2, crystalSize * 2);

  // Crystal diamond (rotated square approximated)
  g.fillStyle(ALIEN.teal);
  // Center row (widest)
  g.fillRect(
    centerX - crystalSize / 2,
    crystalCenterY - Math.round(2 * s),
    crystalSize,
    Math.round(4 * s)
  );
  // Top rows (narrowing)
  g.fillRect(
    centerX - crystalSize / 2 + Math.round(2 * s),
    crystalCenterY - Math.round(5 * s),
    crystalSize - Math.round(4 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    centerX - Math.round(2 * s),
    crystalCenterY - Math.round(7 * s),
    Math.round(4 * s),
    Math.round(2 * s)
  );
  // Bottom rows (narrowing)
  g.fillRect(
    centerX - crystalSize / 2 + Math.round(2 * s),
    crystalCenterY + Math.round(2 * s),
    crystalSize - Math.round(4 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    centerX - Math.round(2 * s),
    crystalCenterY + Math.round(5 * s),
    Math.round(4 * s),
    Math.round(2 * s)
  );

  // Crystal highlight (white dot top-left)
  g.fillStyle(PALETTE.white, 0.6);
  g.fillRect(
    centerX - Math.round(3 * s),
    crystalCenterY - Math.round(3 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  // Cables connecting crystal to base (run down the sides)
  g.fillStyle(ALIEN.tealDim, 0.4);
  g.fillRect(
    centerX - latticeW / 2 - Math.round(1 * s),
    crystalCenterY + crystalSize,
    Math.round(1 * s),
    latticeBottom - crystalCenterY - crystalSize
  );
  g.fillRect(
    centerX + latticeW / 2,
    crystalCenterY + crystalSize,
    Math.round(1 * s),
    latticeBottom - crystalCenterY - crystalSize
  );

  g.generateTexture("disclosure_signal_tower", canvasW, canvasH);
  g.destroy();
}

// ============================================================================
// HANGAR 18 — Large corrugated metal hangar with sliding doors
// ============================================================================
function generateHangar18(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(100 * s);
  const canvasH = Math.round(120 * s);
  const bWidth = Math.round(80 * s);
  const bHeight = Math.round(65 * s);
  const baseX = Math.round(10 * s);
  const baseY = canvasH - bHeight;
  const centerX = canvasW / 2;

  // Shadow
  g.fillStyle(PALETTE.void, 0.5);
  g.fillRect(baseX + Math.round(5 * s), canvasH - Math.round(4 * s), bWidth, Math.round(5 * s));

  // Main hangar body (corrugated metal)
  g.fillStyle(0x6b6b72);
  g.fillRect(baseX, baseY, bWidth, bHeight);

  // Corrugated wall texture (alternating vertical stripes of 2 greys)
  for (let col = 0; col < bWidth; col += Math.round(4 * s)) {
    const isLight = (col / Math.round(4 * s)) % 2 === 0;
    g.fillStyle(isLight ? 0x7a7a82 : 0x5c5c64);
    g.fillRect(baseX + col, baseY, Math.round(2 * s), bHeight);
  }

  // 3D depth: light left
  g.fillStyle(lighten(0x6b6b72, 0.15));
  g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);

  // 3D depth: dark right
  g.fillStyle(darken(0x6b6b72, 0.2));
  g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

  // Roof (arched, approximated with 3 stacked rows)
  g.fillStyle(darken(0x6b6b72, 0.15));
  g.fillRect(
    baseX - Math.round(3 * s),
    baseY - Math.round(3 * s),
    bWidth + Math.round(6 * s),
    Math.round(5 * s)
  );
  g.fillStyle(0x6b6b72);
  g.fillRect(
    baseX + Math.round(5 * s),
    baseY - Math.round(8 * s),
    bWidth - Math.round(10 * s),
    Math.round(6 * s)
  );
  g.fillStyle(lighten(0x6b6b72, 0.1));
  g.fillRect(
    baseX + Math.round(15 * s),
    baseY - Math.round(12 * s),
    bWidth - Math.round(30 * s),
    Math.round(5 * s)
  );

  // Massive sliding doors (partially open, center)
  const doorW = Math.round(35 * s);
  const doorH = Math.round(50 * s);
  const doorX = centerX - doorW / 2;
  const doorY = canvasH - doorH;

  // Interior glow through gap
  g.fillStyle(ALIEN.tealDim, 0.4);
  g.fillRect(
    doorX + Math.round(3 * s),
    doorY + Math.round(3 * s),
    doorW - Math.round(6 * s),
    doorH - Math.round(6 * s)
  );

  // Door panels (slide left/right, leaving gap in center)
  const gapW = Math.round(10 * s);
  // Left door panel
  g.fillStyle(0x5a5a62);
  g.fillRect(doorX, doorY, doorW / 2 - gapW / 2, doorH);
  g.fillStyle(darken(0x5a5a62, 0.15));
  for (let row = 0; row < doorH; row += Math.round(6 * s)) {
    g.fillRect(doorX, doorY + row, doorW / 2 - gapW / 2, Math.round(1 * s));
  }
  // Right door panel
  g.fillStyle(0x5a5a62);
  g.fillRect(doorX + doorW / 2 + gapW / 2, doorY, doorW / 2 - gapW / 2, doorH);
  g.fillStyle(darken(0x5a5a62, 0.15));
  for (let row = 0; row < doorH; row += Math.round(6 * s)) {
    g.fillRect(doorX + doorW / 2 + gapW / 2, doorY + row, doorW / 2 - gapW / 2, Math.round(1 * s));
  }

  // Interior teal glow visible through gap
  g.fillStyle(ALIEN.teal, 0.25);
  g.fillRect(doorX + doorW / 2 - gapW / 2, doorY, gapW, doorH);

  // H-18 stencil on wall (right of door)
  g.fillStyle(PALETTE.white, 0.7);
  // H
  g.fillRect(
    baseX + bWidth - Math.round(25 * s),
    baseY + Math.round(10 * s),
    Math.round(2 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    baseX + bWidth - Math.round(18 * s),
    baseY + Math.round(10 * s),
    Math.round(2 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    baseX + bWidth - Math.round(25 * s),
    baseY + Math.round(15 * s),
    Math.round(9 * s),
    Math.round(2 * s)
  );
  // -
  g.fillRect(
    baseX + bWidth - Math.round(14 * s),
    baseY + Math.round(15 * s),
    Math.round(3 * s),
    Math.round(2 * s)
  );
  // 1
  g.fillRect(
    baseX + bWidth - Math.round(10 * s),
    baseY + Math.round(10 * s),
    Math.round(2 * s),
    Math.round(12 * s)
  );
  // 8
  g.fillRect(
    baseX + bWidth - Math.round(7 * s),
    baseY + Math.round(10 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    baseX + bWidth - Math.round(7 * s),
    baseY + Math.round(15 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    baseX + bWidth - Math.round(7 * s),
    baseY + Math.round(20 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    baseX + bWidth - Math.round(7 * s),
    baseY + Math.round(10 * s),
    Math.round(2 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    baseX + bWidth - Math.round(3 * s),
    baseY + Math.round(10 * s),
    Math.round(2 * s),
    Math.round(12 * s)
  );

  // Hazmat barrels outside (left of building)
  const barrelColors = [PALETTE.gold, PALETTE.brightRed, PALETTE.gold];
  for (let i = 0; i < 3; i++) {
    const bx = baseX - Math.round(8 * s) + i * Math.round(6 * s);
    g.fillStyle(barrelColors[i]);
    g.fillRect(bx, canvasH - Math.round(12 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillStyle(darken(barrelColors[i], 0.3));
    g.fillRect(bx, canvasH - Math.round(12 * s), Math.round(5 * s), Math.round(2 * s));
    g.fillRect(bx, canvasH - Math.round(5 * s), Math.round(5 * s), Math.round(2 * s));
  }

  // Military jeep (parked right of building)
  const jeepX = baseX + bWidth + Math.round(2 * s);
  const jeepY = canvasH - Math.round(12 * s);
  g.fillStyle(ALIEN.militaryOlive);
  g.fillRect(jeepX, jeepY, Math.round(16 * s), Math.round(8 * s));
  g.fillStyle(ALIEN.militaryOliveDark);
  g.fillRect(jeepX, jeepY, Math.round(16 * s), Math.round(2 * s)); // roof
  // Wheels
  g.fillStyle(PALETTE.void);
  g.fillRect(
    jeepX + Math.round(2 * s),
    jeepY + Math.round(8 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    jeepX + Math.round(10 * s),
    jeepY + Math.round(8 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );
  // Windshield
  g.fillStyle(0xc8d6e5, 0.5);
  g.fillRect(
    jeepX + Math.round(11 * s),
    jeepY + Math.round(2 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  g.generateTexture("disclosure_hangar18", canvasW, canvasH);
  g.destroy();
}

// ============================================================================
// CROP CIRCLE CANTINA — Geodesic dome inside a crop circle
// ============================================================================
function generateCropCircleCantina(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(80 * s);
  const canvasH = Math.round(110 * s);
  const centerX = canvasW / 2;

  // Crop circle ground pattern (concentric rings of gold/green)
  const circleY = canvasH - Math.round(8 * s);
  const ringColors = [0xb8960a, 0x3a7a50, 0xd4aa20, 0x2d5a3d];
  for (let r = 4; r >= 0; r--) {
    const ringR = Math.round((12 + r * 6) * s);
    g.fillStyle(ringColors[r % ringColors.length], 0.6);
    g.fillEllipse(centerX, circleY, ringR, Math.round(ringR * 0.35));
  }

  // Shadow
  g.fillStyle(PALETTE.void, 0.3);
  g.fillEllipse(
    centerX + Math.round(3 * s),
    canvasH - Math.round(5 * s),
    Math.round(35 * s),
    Math.round(10 * s)
  );

  // Geodesic dome — half-sphere of triangulated panels
  const domeW = Math.round(50 * s);
  const domeH = Math.round(35 * s);
  const domeX = centerX - domeW / 2;
  const domeY = canvasH - Math.round(40 * s);

  // Dome base
  g.fillStyle(0x4a4a52);
  g.fillRect(domeX, domeY, domeW, domeH);

  // Dome curve (stacked rows getting narrower)
  const domeRows = [
    { w: domeW, h: Math.round(8 * s), color: 0x5a5a64 },
    { w: domeW - Math.round(8 * s), h: Math.round(8 * s), color: 0x6a6a74 },
    { w: domeW - Math.round(18 * s), h: Math.round(7 * s), color: 0x7a7a84 },
    { w: domeW - Math.round(30 * s), h: Math.round(6 * s), color: 0x8a8a94 },
    { w: domeW - Math.round(40 * s), h: Math.round(4 * s), color: 0x9a9aa4 },
  ];
  let rowY = domeY;
  domeRows.forEach((row) => {
    g.fillStyle(row.color);
    g.fillRect(centerX - row.w / 2, rowY - row.h, row.w, row.h);
    rowY -= row.h;
  });

  // Triangulation lines on dome (cross-hatch pattern)
  g.fillStyle(0x3a3a42, 0.5);
  // Horizontal lines
  for (let i = 1; i < 5; i++) {
    const ly = domeY - i * Math.round(7 * s);
    const lw = domeW - i * Math.round(8 * s);
    g.fillRect(centerX - lw / 2, ly, lw, Math.round(1 * s));
  }
  // Diagonal lines (simplified)
  for (let i = 0; i < 6; i++) {
    const dx = domeX + i * Math.round(10 * s);
    g.fillRect(dx, domeY, Math.round(1 * s), -Math.round(20 * s));
  }

  // Door (center of dome base)
  g.fillStyle(ALIEN.teal, 0.3);
  g.fillRect(
    centerX - Math.round(6 * s),
    domeY + Math.round(10 * s),
    Math.round(12 * s),
    Math.round(24 * s)
  );
  g.fillStyle(ALIEN.teal, 0.5);
  g.fillRect(
    centerX - Math.round(6 * s),
    domeY + Math.round(10 * s),
    Math.round(12 * s),
    Math.round(2 * s)
  );

  // Neon sign above door: "OPEN"
  g.fillStyle(ALIEN.plasmaGreen, 0.8);
  g.fillRect(
    centerX - Math.round(14 * s),
    domeY + Math.round(4 * s),
    Math.round(28 * s),
    Math.round(6 * s)
  );
  // Sign glow
  g.fillStyle(ALIEN.plasmaGreen, 0.2);
  g.fillRect(
    centerX - Math.round(16 * s),
    domeY + Math.round(2 * s),
    Math.round(32 * s),
    Math.round(10 * s)
  );

  // Stools visible through door (tiny colored rectangles)
  g.fillStyle(ALIEN.teal);
  g.fillRect(
    centerX - Math.round(3 * s),
    domeY + Math.round(28 * s),
    Math.round(3 * s),
    Math.round(5 * s)
  );
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    centerX + Math.round(2 * s),
    domeY + Math.round(28 * s),
    Math.round(3 * s),
    Math.round(5 * s)
  );

  g.generateTexture("disclosure_cantina", canvasW, canvasH);
  g.destroy();
}

// ============================================================================
// PROPS — Desert elements, military presence, alien artifacts
// ============================================================================
function generateDisclosureProps(scene: Phaser.Scene): void {
  const s = SCALE;

  // === SAGUARO CACTUS (3 variants) ===
  for (let variant = 0; variant < 3; variant++) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const cW = Math.round(20 * s);
    const cH = Math.round((40 + variant * 10) * s);

    // Main trunk
    g.fillStyle(0x2d5a3d);
    g.fillRect(
      cW / 2 - Math.round(3 * s),
      Math.round(5 * s),
      Math.round(6 * s),
      cH - Math.round(5 * s)
    );
    // Light side
    g.fillStyle(0x3a7a50);
    g.fillRect(
      cW / 2 - Math.round(3 * s),
      Math.round(5 * s),
      Math.round(2 * s),
      cH - Math.round(5 * s)
    );

    // Arms (vary by variant)
    if (variant === 0 || variant === 2) {
      // Left arm
      g.fillStyle(0x2d5a3d);
      g.fillRect(
        cW / 2 - Math.round(9 * s),
        Math.round(15 * s),
        Math.round(6 * s),
        Math.round(3 * s)
      );
      g.fillRect(
        cW / 2 - Math.round(9 * s),
        Math.round(8 * s),
        Math.round(3 * s),
        Math.round(10 * s)
      );
    }
    if (variant === 1 || variant === 2) {
      // Right arm
      g.fillStyle(0x2d5a3d);
      g.fillRect(
        cW / 2 + Math.round(3 * s),
        Math.round(18 * s),
        Math.round(6 * s),
        Math.round(3 * s)
      );
      g.fillRect(
        cW / 2 + Math.round(6 * s),
        Math.round(10 * s),
        Math.round(3 * s),
        Math.round(11 * s)
      );
    }

    // Ridges (vertical lines)
    g.fillStyle(darken(0x2d5a3d, 0.15));
    g.fillRect(
      cW / 2 - Math.round(1 * s),
      Math.round(6 * s),
      Math.round(1 * s),
      cH - Math.round(8 * s)
    );
    g.fillRect(
      cW / 2 + Math.round(1 * s),
      Math.round(6 * s),
      Math.round(1 * s),
      cH - Math.round(8 * s)
    );

    g.generateTexture(`disclosure_cactus_${variant}`, cW, cH);
    g.destroy();
  }

  // === CHAIN-LINK FENCE SEGMENT ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const fW = Math.round(30 * s);
    const fH = Math.round(25 * s);

    // Posts
    g.fillStyle(ALIEN.concrete);
    g.fillRect(0, 0, Math.round(2 * s), fH);
    g.fillRect(fW - Math.round(2 * s), 0, Math.round(2 * s), fH);

    // Chain link mesh (diamond pattern)
    g.fillStyle(0x9ca3af, 0.5);
    for (let row = 0; row < fH; row += Math.round(4 * s)) {
      const offset = (row / Math.round(4 * s)) % 2 === 0 ? 0 : Math.round(2 * s);
      for (
        let col = offset + Math.round(2 * s);
        col < fW - Math.round(2 * s);
        col += Math.round(4 * s)
      ) {
        g.fillRect(col, row, Math.round(2 * s), Math.round(1 * s));
        g.fillRect(
          col + Math.round(1 * s),
          row + Math.round(1 * s),
          Math.round(1 * s),
          Math.round(2 * s)
        );
      }
    }

    // Top rail
    g.fillStyle(ALIEN.concrete);
    g.fillRect(0, 0, fW, Math.round(2 * s));

    g.generateTexture("disclosure_fence", fW, fH);
    g.destroy();
  }

  // === CONCRETE BARRIER (jersey wall) ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const bW = Math.round(18 * s);
    const bH = Math.round(14 * s);

    g.fillStyle(ALIEN.concreteDark);
    g.fillRect(0, Math.round(2 * s), bW, bH - Math.round(2 * s));
    // Tapered top
    g.fillStyle(ALIEN.concrete);
    g.fillRect(Math.round(2 * s), 0, bW - Math.round(4 * s), Math.round(4 * s));
    // Highlight
    g.fillStyle(lighten(ALIEN.concrete, 0.15));
    g.fillRect(0, Math.round(2 * s), Math.round(3 * s), bH - Math.round(2 * s));
    // Shadow
    g.fillStyle(darken(ALIEN.concreteDark, 0.2));
    g.fillRect(
      bW - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(3 * s),
      bH - Math.round(2 * s)
    );

    g.generateTexture("disclosure_barrier", bW, bH);
    g.destroy();
  }

  // === FLOODLIGHT TOWER ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const fW = Math.round(12 * s);
    const fH = Math.round(40 * s);

    // Pole
    g.fillStyle(ALIEN.concrete);
    g.fillRect(
      fW / 2 - Math.round(1 * s),
      Math.round(6 * s),
      Math.round(3 * s),
      fH - Math.round(6 * s)
    );
    // Light housing
    g.fillStyle(PALETTE.gold);
    g.fillRect(fW / 2 - Math.round(4 * s), 0, Math.round(8 * s), Math.round(6 * s));
    // Light cone
    g.fillStyle(PALETTE.gold, 0.15);
    g.fillRect(
      fW / 2 - Math.round(6 * s),
      Math.round(6 * s),
      Math.round(12 * s),
      Math.round(20 * s)
    );

    g.generateTexture("disclosure_floodlight", fW, fH);
    g.destroy();
  }

  // === MILITARY CRATE ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const cW = Math.round(14 * s);
    const cH = Math.round(10 * s);

    g.fillStyle(ALIEN.militaryOlive);
    g.fillRect(0, 0, cW, cH);
    g.fillStyle(ALIEN.militaryOliveLight);
    g.fillRect(0, 0, Math.round(2 * s), cH);
    g.fillStyle(ALIEN.militaryOliveDark);
    g.fillRect(cW - Math.round(2 * s), 0, Math.round(2 * s), cH);
    // Star stencil
    g.fillStyle(PALETTE.white, 0.4);
    g.fillRect(cW / 2 - Math.round(1 * s), Math.round(3 * s), Math.round(3 * s), Math.round(3 * s));

    g.generateTexture("disclosure_crate", cW, cH);
    g.destroy();
  }

  // === ALIEN CRYSTAL GROWTH (3 sizes) ===
  for (let size = 0; size < 3; size++) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const scale = 1 + size * 0.5;
    const cW = Math.round(10 * scale * s);
    const cH = Math.round(14 * scale * s);

    // Glow aura
    g.fillStyle(ALIEN.teal, 0.15);
    g.fillRect(0, 0, cW, cH);

    // Main crystal shard (angular)
    g.fillStyle(ALIEN.crystalInner);
    g.fillRect(
      cW / 2 - Math.round(2 * scale * s),
      Math.round(2 * scale * s),
      Math.round(4 * scale * s),
      cH - Math.round(4 * scale * s)
    );

    // Secondary shard (angled)
    g.fillStyle(ALIEN.teal);
    g.fillRect(
      cW / 2 + Math.round(1 * scale * s),
      Math.round(4 * scale * s),
      Math.round(3 * scale * s),
      cH - Math.round(8 * scale * s)
    );

    // Highlight
    g.fillStyle(PALETTE.white, 0.4);
    g.fillRect(
      cW / 2 - Math.round(1 * scale * s),
      Math.round(3 * scale * s),
      Math.round(1 * s),
      Math.round(3 * scale * s)
    );

    g.generateTexture(`disclosure_crystal_${size}`, cW, cH);
    g.destroy();
  }

  // === KEEP OUT SIGN ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const sW = Math.round(22 * s);
    const sH = Math.round(18 * s);

    // Post
    g.fillStyle(ALIEN.rust);
    g.fillRect(
      sW / 2 - Math.round(1 * s),
      sH - Math.round(8 * s),
      Math.round(2 * s),
      Math.round(8 * s)
    );
    // Sign board
    g.fillStyle(PALETTE.gold);
    g.fillRect(Math.round(2 * s), 0, sW - Math.round(4 * s), Math.round(10 * s));
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(Math.round(3 * s), Math.round(1 * s), sW - Math.round(6 * s), Math.round(8 * s));

    g.generateTexture("disclosure_sign", sW, sH);
    g.destroy();
  }

  // === RADAR DISH (desert prop) ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const dW = Math.round(16 * s);
    const dH = Math.round(24 * s);

    // Base
    g.fillStyle(ALIEN.concrete);
    g.fillRect(
      dW / 2 - Math.round(3 * s),
      dH - Math.round(6 * s),
      Math.round(6 * s),
      Math.round(6 * s)
    );
    // Mast
    g.fillRect(
      dW / 2 - Math.round(1 * s),
      Math.round(6 * s),
      Math.round(2 * s),
      dH - Math.round(12 * s)
    );
    // Dish
    g.fillStyle(lighten(ALIEN.concrete, 0.1));
    g.fillRect(0, 0, dW, Math.round(8 * s));
    g.fillStyle(ALIEN.concrete);
    g.fillRect(Math.round(2 * s), Math.round(2 * s), dW - Math.round(4 * s), Math.round(4 * s));

    g.generateTexture("disclosure_radar", dW, dH);
    g.destroy();
  }

  // === GREY ALIEN (small ambient creature sprite) ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const aW = Math.round(10 * s);
    const aH = Math.round(14 * s);

    // Head (oversized, 60% of body)
    const headW = Math.round(8 * s);
    const headH = Math.round(7 * s);
    g.fillStyle(0x9ca3af); // grey-blue skin
    g.fillRect(aW / 2 - headW / 2, 0, headW, headH);
    // Head rounded top
    g.fillRect(
      aW / 2 - headW / 2 + Math.round(1 * s),
      -Math.round(1 * s),
      headW - Math.round(2 * s),
      Math.round(2 * s)
    );

    // Big almond eyes (black)
    g.fillStyle(PALETTE.void);
    g.fillRect(aW / 2 - Math.round(3 * s), Math.round(2 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(aW / 2 + Math.round(1 * s), Math.round(2 * s), Math.round(2 * s), Math.round(3 * s));
    // Eye highlight
    g.fillStyle(PALETTE.white, 0.3);
    g.fillRect(aW / 2 - Math.round(3 * s), Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(aW / 2 + Math.round(1 * s), Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));

    // Body (thin)
    g.fillStyle(0x8a9aaa);
    g.fillRect(aW / 2 - Math.round(2 * s), headH, Math.round(4 * s), Math.round(5 * s));

    // Arms (spindly)
    g.fillStyle(0x9ca3af);
    g.fillRect(
      aW / 2 - Math.round(4 * s),
      headH + Math.round(1 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      aW / 2 + Math.round(2 * s),
      headH + Math.round(1 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );

    // Legs
    g.fillRect(
      aW / 2 - Math.round(2 * s),
      headH + Math.round(5 * s),
      Math.round(1 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      aW / 2 + Math.round(1 * s),
      headH + Math.round(5 * s),
      Math.round(1 * s),
      Math.round(2 * s)
    );

    g.generateTexture("disclosure_grey", aW, aH);
    g.destroy();
  }

  // === TUMBLEWEED ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const tW = Math.round(10 * s);
    const tH = Math.round(10 * s);

    g.fillStyle(0x8b7355, 0.7);
    g.fillEllipse(tW / 2, tH / 2, tW, tH);
    // Inner texture (twigs)
    g.fillStyle(darken(0x8b7355, 0.2), 0.5);
    g.fillRect(Math.round(2 * s), Math.round(3 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(3 * s), Math.round(5 * s), Math.round(4 * s), Math.round(1 * s));
    g.fillRect(Math.round(4 * s), Math.round(2 * s), Math.round(1 * s), Math.round(5 * s));

    g.generateTexture("disclosure_tumbleweed", tW, tH);
    g.destroy();
  }

  // === SCRUB BRUSH ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const bW = Math.round(12 * s);
    const bH = Math.round(8 * s);

    g.fillStyle(0x6b7a5a);
    g.fillRect(
      Math.round(1 * s),
      Math.round(2 * s),
      bW - Math.round(2 * s),
      bH - Math.round(2 * s)
    );
    g.fillStyle(0x5a6a4a);
    g.fillRect(Math.round(3 * s), 0, bW - Math.round(6 * s), Math.round(3 * s));
    // Twigs
    g.fillStyle(0x8b7355);
    g.fillRect(bW / 2, bH - Math.round(1 * s), Math.round(1 * s), Math.round(1 * s));

    g.generateTexture("disclosure_scrub", bW, bH);
    g.destroy();
  }

  // === SURVEILLANCE CAMERA ON POLE ===
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const cW = Math.round(8 * s);
    const cH = Math.round(22 * s);

    // Pole
    g.fillStyle(ALIEN.concrete);
    g.fillRect(
      cW / 2 - Math.round(1 * s),
      Math.round(6 * s),
      Math.round(2 * s),
      cH - Math.round(6 * s)
    );
    // Camera housing
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(Math.round(1 * s), 0, Math.round(6 * s), Math.round(5 * s));
    // Lens
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(Math.round(5 * s), Math.round(1 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture("disclosure_camera", cW, cH);
    g.destroy();
  }

  // === DESERT ROCK (3 sizes) ===
  for (let size = 0; size < 3; size++) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const scale = 1 + size * 0.4;
    const rW = Math.round(8 * scale * s);
    const rH = Math.round(6 * scale * s);

    g.fillStyle(darken(ALIEN.sand, 0.3));
    g.fillRect(
      Math.round(1 * s),
      Math.round(1 * s),
      rW - Math.round(2 * s),
      rH - Math.round(1 * s)
    );
    g.fillStyle(darken(ALIEN.sand, 0.2));
    g.fillRect(0, Math.round(2 * s), rW, rH - Math.round(3 * s));
    // Highlight
    g.fillStyle(ALIEN.sand, 0.3);
    g.fillRect(0, Math.round(1 * s), Math.round(2 * s), rH - Math.round(3 * s));

    g.generateTexture(`disclosure_rock_${size}`, rW, rH);
    g.destroy();
  }
}
