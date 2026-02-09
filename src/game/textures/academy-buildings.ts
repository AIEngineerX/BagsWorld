import * as Phaser from "phaser";
import { SCALE, PALETTE, darken, lighten } from "./constants";

function generateAcademyGate(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasWidth = Math.round(120 * s);
  const canvasHeight = Math.round(100 * s);

  const gateHeight = Math.round(70 * s);
  const pillarWidth = Math.round(15 * s);

  // Ground shadow (flat, solid)
  g.fillStyle(PALETTE.void);
  g.fillRect(
    Math.round(12 * s),
    canvasHeight - Math.round(4 * s),
    canvasWidth - Math.round(24 * s),
    Math.round(4 * s)
  );

  // Left pillar
  g.fillStyle(PALETTE.gray);
  g.fillRect(Math.round(10 * s), canvasHeight - gateHeight, pillarWidth, gateHeight);
  // Left pillar highlight
  g.fillStyle(lighten(PALETTE.gray, 0.2));
  g.fillRect(Math.round(10 * s), canvasHeight - gateHeight, Math.round(4 * s), gateHeight);
  // Left pillar shadow
  g.fillStyle(darken(PALETTE.gray, 0.2));
  g.fillRect(
    Math.round(10 * s) + pillarWidth - Math.round(3 * s),
    canvasHeight - gateHeight,
    Math.round(3 * s),
    gateHeight
  );

  // Left pillar cap
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    Math.round(8 * s),
    canvasHeight - gateHeight - Math.round(8 * s),
    pillarWidth + Math.round(4 * s),
    Math.round(10 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    Math.round(8 * s),
    canvasHeight - gateHeight - Math.round(8 * s),
    pillarWidth + Math.round(4 * s),
    Math.round(2 * s)
  );

  // Left finial (stacked rectangles instead of circle)
  const leftFinialX = Math.round(10 * s) + pillarWidth / 2;
  const leftFinialY = canvasHeight - gateHeight - Math.round(14 * s);
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    leftFinialX - Math.round(5 * s),
    leftFinialY - Math.round(2 * s),
    Math.round(10 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    leftFinialX - Math.round(4 * s),
    leftFinialY - Math.round(5 * s),
    Math.round(8 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    leftFinialX - Math.round(3 * s),
    leftFinialY - Math.round(7 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    leftFinialX - Math.round(3 * s),
    leftFinialY - Math.round(7 * s),
    Math.round(6 * s),
    Math.round(1 * s)
  );

  // Right pillar
  g.fillStyle(PALETTE.gray);
  g.fillRect(canvasWidth - Math.round(25 * s), canvasHeight - gateHeight, pillarWidth, gateHeight);
  // Right pillar highlight
  g.fillStyle(lighten(PALETTE.gray, 0.2));
  g.fillRect(
    canvasWidth - Math.round(25 * s),
    canvasHeight - gateHeight,
    Math.round(4 * s),
    gateHeight
  );
  // Right pillar shadow
  g.fillStyle(darken(PALETTE.gray, 0.2));
  g.fillRect(
    canvasWidth - Math.round(25 * s) + pillarWidth - Math.round(3 * s),
    canvasHeight - gateHeight,
    Math.round(3 * s),
    gateHeight
  );

  // Right pillar cap
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    canvasWidth - Math.round(27 * s),
    canvasHeight - gateHeight - Math.round(8 * s),
    pillarWidth + Math.round(4 * s),
    Math.round(10 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    canvasWidth - Math.round(27 * s),
    canvasHeight - gateHeight - Math.round(8 * s),
    pillarWidth + Math.round(4 * s),
    Math.round(2 * s)
  );

  // Right finial (stacked rectangles instead of circle)
  const rightFinialX = canvasWidth - Math.round(25 * s) + pillarWidth / 2;
  const rightFinialY = canvasHeight - gateHeight - Math.round(14 * s);
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    rightFinialX - Math.round(5 * s),
    rightFinialY - Math.round(2 * s),
    Math.round(10 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    rightFinialX - Math.round(4 * s),
    rightFinialY - Math.round(5 * s),
    Math.round(8 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    rightFinialX - Math.round(3 * s),
    rightFinialY - Math.round(7 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    rightFinialX - Math.round(3 * s),
    rightFinialY - Math.round(7 * s),
    Math.round(6 * s),
    Math.round(1 * s)
  );

  // Arch connecting pillars
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    Math.round(25 * s),
    canvasHeight - gateHeight - Math.round(4 * s),
    canvasWidth - Math.round(50 * s),
    Math.round(8 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    Math.round(25 * s),
    canvasHeight - gateHeight - Math.round(4 * s),
    canvasWidth - Math.round(50 * s),
    Math.round(2 * s)
  );

  // "BAGS ACADEMY" banner on arch
  g.fillStyle(PALETTE.navy);
  g.fillRect(
    Math.round(30 * s),
    canvasHeight - gateHeight - Math.round(22 * s),
    canvasWidth - Math.round(60 * s),
    Math.round(18 * s)
  );
  g.fillStyle(PALETTE.bagsGreen);
  g.fillRect(
    Math.round(32 * s),
    canvasHeight - gateHeight - Math.round(20 * s),
    canvasWidth - Math.round(64 * s),
    Math.round(14 * s)
  );
  g.fillStyle(lighten(PALETTE.bagsGreen, 0.2));
  g.fillRect(
    Math.round(32 * s),
    canvasHeight - gateHeight - Math.round(20 * s),
    canvasWidth - Math.round(64 * s),
    Math.round(2 * s)
  );

  // Decorative crest/shield at top (rectangular approximation)
  const crestX = canvasWidth / 2;
  const crestY = canvasHeight - gateHeight - Math.round(32 * s);
  const crestW = Math.round(22 * s);
  const crestH = Math.round(28 * s);

  // Crest outer (gold) - stepped rectangle shield shape
  g.fillStyle(PALETTE.gold);
  g.fillRect(crestX - crestW / 2, crestY - Math.round(6 * s), crestW, Math.round(6 * s)); // Top
  g.fillRect(
    crestX - crestW / 2 + Math.round(2 * s),
    crestY - Math.round(10 * s),
    crestW - Math.round(4 * s),
    Math.round(4 * s)
  ); // Top narrower
  g.fillRect(crestX - crestW / 2, crestY, crestW, crestH - Math.round(8 * s)); // Body
  g.fillRect(
    crestX - crestW / 2 + Math.round(2 * s),
    crestY + crestH - Math.round(8 * s),
    crestW - Math.round(4 * s),
    Math.round(4 * s)
  ); // Bottom narrower
  g.fillRect(
    crestX - crestW / 2 + Math.round(4 * s),
    crestY + crestH - Math.round(4 * s),
    crestW - Math.round(8 * s),
    Math.round(4 * s)
  ); // Bottom point

  // Crest inner (green)
  g.fillStyle(PALETTE.bagsGreen);
  g.fillRect(
    crestX - crestW / 2 + Math.round(3 * s),
    crestY - Math.round(4 * s),
    crestW - Math.round(6 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    crestX - crestW / 2 + Math.round(3 * s),
    crestY,
    crestW - Math.round(6 * s),
    crestH - Math.round(12 * s)
  );
  g.fillRect(
    crestX - crestW / 2 + Math.round(5 * s),
    crestY + crestH - Math.round(12 * s),
    crestW - Math.round(10 * s),
    Math.round(6 * s)
  );

  // "B" on crest (pixel letter)
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    crestX - Math.round(3 * s),
    crestY + Math.round(2 * s),
    Math.round(2 * s),
    Math.round(10 * s)
  ); // Vertical bar
  g.fillRect(
    crestX - Math.round(3 * s),
    crestY + Math.round(2 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  ); // Top bar
  g.fillRect(
    crestX - Math.round(3 * s),
    crestY + Math.round(6 * s),
    Math.round(5 * s),
    Math.round(2 * s)
  ); // Middle bar
  g.fillRect(
    crestX - Math.round(3 * s),
    crestY + Math.round(10 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  ); // Bottom bar
  g.fillRect(
    crestX + Math.round(1 * s),
    crestY + Math.round(2 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  ); // Top right curve
  g.fillRect(
    crestX + Math.round(2 * s),
    crestY + Math.round(6 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  ); // Bottom right curve

  // Iron gates (decorative bars)
  g.fillStyle(PALETTE.darkGray);
  for (let i = 0; i < 5; i++) {
    const barX = Math.round(32 * s) + i * Math.round(14 * s);
    g.fillRect(
      barX,
      canvasHeight - gateHeight + Math.round(10 * s),
      Math.round(3 * s),
      gateHeight - Math.round(12 * s)
    );
    // Bar highlight
    g.fillStyle(lighten(PALETTE.darkGray, 0.15));
    g.fillRect(
      barX,
      canvasHeight - gateHeight + Math.round(10 * s),
      Math.round(1 * s),
      gateHeight - Math.round(12 * s)
    );
    g.fillStyle(PALETTE.darkGray);
  }

  // Horizontal bar
  g.fillRect(
    Math.round(28 * s),
    canvasHeight - Math.round(30 * s),
    canvasWidth - Math.round(56 * s),
    Math.round(3 * s)
  );
  g.fillStyle(lighten(PALETTE.darkGray, 0.15));
  g.fillRect(
    Math.round(28 * s),
    canvasHeight - Math.round(30 * s),
    canvasWidth - Math.round(56 * s),
    Math.round(1 * s)
  );

  // Decorative spikes on top of gate bars
  g.fillStyle(PALETTE.darkGray);
  for (let i = 0; i < 5; i++) {
    const spikeX = Math.round(32 * s) + i * Math.round(14 * s);
    g.fillRect(
      spikeX - Math.round(1 * s),
      canvasHeight - gateHeight + Math.round(6 * s),
      Math.round(5 * s),
      Math.round(4 * s)
    );
    g.fillRect(
      spikeX,
      canvasHeight - gateHeight + Math.round(3 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );
  }

  g.generateTexture("academy_gate", canvasWidth, canvasHeight);
  g.destroy();
}

export function generateAcademyBuildings(scene: Phaser.Scene): void {
  const s = SCALE;

  // Academy building styles - Hogwarts-inspired gothic/academic architecture
  const academyBuildings = [
    {
      name: "clock_tower", // Main Hall - Finn (Dean)
      base: PALETTE.gray,
      roof: PALETTE.navy,
      accent: PALETTE.gold,
      trim: PALETTE.lightGray,
      hasTower: true,
      hasClock: true,
    },
    {
      name: "library", // Engineering Lab - Ramo (CTO)
      base: PALETTE.midGray,
      roof: PALETTE.blue,
      accent: PALETTE.cyan,
      trim: PALETTE.silver,
      hasArches: true,
      hasBooks: true,
    },
    {
      name: "art_studio", // Design Studio - Sincara
      base: PALETTE.lightGray,
      roof: 0xec4899, // Pink
      accent: PALETTE.lavender,
      trim: PALETTE.white,
      hasLargeDoor: true,
      hasPalette: true,
    },
    {
      name: "observatory", // R&D Lab - Alaa (Skunk Works)
      base: PALETTE.darkGray,
      roof: PALETTE.violet,
      accent: PALETTE.purple,
      trim: PALETTE.silver,
      hasDome: true,
      hasTelescope: true,
    },
    {
      name: "greenhouse", // Student Services - Stuu
      base: PALETTE.forest,
      roof: PALETTE.bagsGreen,
      accent: PALETTE.mint,
      trim: PALETTE.cream,
      hasGlass: true,
      hasPlants: true,
    },
    {
      name: "amphitheater", // Marketing Hall - Sam
      base: PALETTE.amber,
      roof: PALETTE.gold,
      accent: PALETTE.yellow,
      trim: PALETTE.white,
      hasStage: true,
      hasLights: true,
    },
    {
      name: "welcome_hall", // Welcome Center - Carlo
      base: PALETTE.cream,
      roof: PALETTE.bagsGreen,
      accent: PALETTE.forest,
      trim: PALETTE.gold,
      hasColumns: true,
      hasBanner: true,
    },
    {
      name: "broadcast_tower", // Media Center - BNN
      base: PALETTE.sky,
      roof: PALETTE.navy,
      accent: PALETTE.cyan,
      trim: PALETTE.lightBlue,
      hasAntenna: true,
      hasScreen: true,
    },
  ];

  // Standard dimensions for academy buildings
  const bWidth = Math.round(50 * s);
  const bHeight = Math.round(90 * s);
  const canvasWidth = Math.round(60 * s);
  const canvasHeight = Math.round(150 * s);

  academyBuildings.forEach((style, index) => {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const baseY = canvasHeight - bHeight;
    const centerX = canvasWidth / 2;

    // Ground shadow (flat, solid - no alpha)
    g.fillStyle(PALETTE.void);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - Math.round(4 * s),
      bWidth - Math.round(8 * s),
      Math.round(4 * s)
    );

    // Main building body
    g.fillStyle(style.base);
    g.fillRect(Math.round(4 * s), baseY, bWidth - Math.round(4 * s), bHeight);

    // Highlight left edge (3D depth)
    g.fillStyle(lighten(style.base, 0.2));
    g.fillRect(Math.round(4 * s), baseY, Math.round(6 * s), bHeight);

    // Shadow right edge (3D depth)
    g.fillStyle(darken(style.base, 0.25));
    g.fillRect(bWidth - Math.round(6 * s), baseY, Math.round(6 * s), bHeight);

    // Brick/stone texture (checkerboard pattern - solid colors)
    g.fillStyle(darken(style.base, 0.12));
    for (let py = 0; py < bHeight; py += Math.round(8 * s)) {
      const offset = (py / Math.round(8 * s)) % 2 === 0 ? 0 : Math.round(6 * s);
      for (
        let px = Math.round(8 * s) + offset;
        px < bWidth - Math.round(8 * s);
        px += Math.round(12 * s)
      ) {
        g.fillRect(Math.round(4 * s) + px, baseY + py, Math.round(10 * s), Math.round(6 * s));
      }
    }

    // Roof based on building type - all use stepped rectangles
    const roofY = baseY - Math.round(20 * s);

    if (style.hasDome) {
      // Observatory dome (stacked rectangles to form dome shape)
      const domeBaseY = baseY;
      const domeWidth = Math.round(44 * s);
      const domeX = centerX - domeWidth / 2;

      // Dome layer 1 (widest)
      g.fillStyle(style.roof);
      g.fillRect(domeX, domeBaseY - Math.round(10 * s), domeWidth, Math.round(10 * s));
      // Dome layer 2
      g.fillRect(
        domeX + Math.round(4 * s),
        domeBaseY - Math.round(18 * s),
        domeWidth - Math.round(8 * s),
        Math.round(8 * s)
      );
      // Dome layer 3
      g.fillRect(
        domeX + Math.round(10 * s),
        domeBaseY - Math.round(24 * s),
        domeWidth - Math.round(20 * s),
        Math.round(6 * s)
      );
      // Dome layer 4 (top)
      g.fillRect(
        domeX + Math.round(16 * s),
        domeBaseY - Math.round(28 * s),
        domeWidth - Math.round(32 * s),
        Math.round(4 * s)
      );

      // Dome highlight (left side of each layer)
      g.fillStyle(lighten(style.roof, 0.25));
      g.fillRect(domeX, domeBaseY - Math.round(10 * s), Math.round(4 * s), Math.round(10 * s));
      g.fillRect(
        domeX + Math.round(4 * s),
        domeBaseY - Math.round(18 * s),
        Math.round(4 * s),
        Math.round(8 * s)
      );
      g.fillRect(
        domeX + Math.round(10 * s),
        domeBaseY - Math.round(24 * s),
        Math.round(4 * s),
        Math.round(6 * s)
      );

      // Dome slit (telescope opening)
      g.fillStyle(darken(style.roof, 0.35));
      g.fillRect(
        centerX - Math.round(2 * s),
        domeBaseY - Math.round(26 * s),
        Math.round(4 * s),
        Math.round(18 * s)
      );
    } else if (style.hasTower) {
      // Clock tower peaked roof (stepped pyramid)
      const roofW1 = bWidth + Math.round(4 * s);
      const roofX1 = Math.round(2 * s);

      // Roof layer 1 (eaves)
      g.fillStyle(style.roof);
      g.fillRect(roofX1, baseY - Math.round(8 * s), roofW1, Math.round(8 * s));
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(roofX1, baseY - Math.round(8 * s), roofW1, Math.round(2 * s));

      // Roof layer 2
      const roofW2 = roofW1 - Math.round(12 * s);
      const roofX2 = roofX1 + Math.round(6 * s);
      g.fillStyle(style.roof);
      g.fillRect(roofX2, baseY - Math.round(18 * s), roofW2, Math.round(10 * s));
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(roofX2, baseY - Math.round(18 * s), roofW2, Math.round(2 * s));

      // Roof layer 3
      const roofW3 = roofW2 - Math.round(12 * s);
      const roofX3 = roofX2 + Math.round(6 * s);
      g.fillStyle(style.roof);
      g.fillRect(roofX3, baseY - Math.round(28 * s), roofW3, Math.round(10 * s));
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(roofX3, baseY - Math.round(28 * s), roofW3, Math.round(2 * s));

      // Roof layer 4 (peak)
      const roofW4 = roofW3 - Math.round(12 * s);
      const roofX4 = roofX3 + Math.round(6 * s);
      g.fillStyle(style.roof);
      g.fillRect(roofX4, baseY - Math.round(38 * s), roofW4, Math.round(10 * s));
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(roofX4, baseY - Math.round(38 * s), roofW4, Math.round(2 * s));

      // Spire (vertical bar with cap)
      g.fillStyle(style.accent);
      g.fillRect(
        centerX - Math.round(2 * s),
        baseY - Math.round(55 * s),
        Math.round(4 * s),
        Math.round(20 * s)
      );
      // Spire top (small stacked rectangles)
      g.fillRect(
        centerX - Math.round(4 * s),
        baseY - Math.round(58 * s),
        Math.round(8 * s),
        Math.round(4 * s)
      );
      g.fillRect(
        centerX - Math.round(3 * s),
        baseY - Math.round(61 * s),
        Math.round(6 * s),
        Math.round(3 * s)
      );
      g.fillStyle(PALETTE.yellow);
      g.fillRect(
        centerX - Math.round(2 * s),
        baseY - Math.round(63 * s),
        Math.round(4 * s),
        Math.round(2 * s)
      );
    } else if (style.hasGlass) {
      // Greenhouse glass roof (stepped with frame lines)
      const roofW1 = bWidth + Math.round(4 * s);
      const roofX1 = Math.round(2 * s);

      // Roof layer 1 (eaves) - light blue for glass
      g.fillStyle(PALETTE.lightBlue);
      g.fillRect(roofX1, baseY - Math.round(8 * s), roofW1, Math.round(8 * s));

      // Roof layer 2
      const roofW2 = roofW1 - Math.round(14 * s);
      const roofX2 = roofX1 + Math.round(7 * s);
      g.fillRect(roofX2, baseY - Math.round(16 * s), roofW2, Math.round(8 * s));

      // Roof layer 3 (peak)
      const roofW3 = roofW2 - Math.round(14 * s);
      const roofX3 = roofX2 + Math.round(7 * s);
      g.fillRect(roofX3, baseY - Math.round(22 * s), roofW3, Math.round(6 * s));

      // Glass frame lines (white trim)
      g.fillStyle(style.trim);
      // Vertical center strut
      g.fillRect(
        centerX - Math.round(1 * s),
        baseY - Math.round(22 * s),
        Math.round(2 * s),
        Math.round(22 * s)
      );
      // Horizontal struts
      g.fillRect(
        roofX1 + Math.round(4 * s),
        baseY - Math.round(6 * s),
        roofW1 - Math.round(8 * s),
        Math.round(2 * s)
      );
      g.fillRect(
        roofX2 + Math.round(4 * s),
        baseY - Math.round(14 * s),
        roofW2 - Math.round(8 * s),
        Math.round(2 * s)
      );
    } else if (style.hasAntenna) {
      // Broadcast tower flat roof with antenna
      g.fillStyle(style.roof);
      g.fillRect(0, baseY - Math.round(8 * s), bWidth + Math.round(8 * s), Math.round(12 * s));
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(0, baseY - Math.round(8 * s), bWidth + Math.round(8 * s), Math.round(3 * s));

      // Main antenna pole
      g.fillStyle(PALETTE.lightGray);
      g.fillRect(
        centerX - Math.round(2 * s),
        roofY - Math.round(35 * s),
        Math.round(4 * s),
        Math.round(45 * s)
      );
      g.fillStyle(PALETTE.silver);
      g.fillRect(
        centerX - Math.round(2 * s),
        roofY - Math.round(35 * s),
        Math.round(1 * s),
        Math.round(45 * s)
      );

      // Satellite dish (stacked rectangles)
      const dishX = centerX + Math.round(8 * s);
      const dishY = roofY - Math.round(10 * s);
      g.fillStyle(PALETTE.silver);
      g.fillRect(dishX, dishY - Math.round(4 * s), Math.round(12 * s), Math.round(3 * s));
      g.fillRect(
        dishX + Math.round(2 * s),
        dishY - Math.round(8 * s),
        Math.round(8 * s),
        Math.round(4 * s)
      );
      g.fillRect(
        dishX + Math.round(4 * s),
        dishY - Math.round(10 * s),
        Math.round(4 * s),
        Math.round(2 * s)
      );
      g.fillStyle(PALETTE.lightGray);
      g.fillRect(dishX + Math.round(4 * s), dishY, Math.round(4 * s), Math.round(4 * s));

      // Blinking light (small rectangle)
      g.fillStyle(PALETTE.brightRed);
      g.fillRect(
        centerX - Math.round(2 * s),
        roofY - Math.round(40 * s),
        Math.round(4 * s),
        Math.round(4 * s)
      );
      g.fillStyle(lighten(PALETTE.brightRed, 0.3));
      g.fillRect(
        centerX - Math.round(1 * s),
        roofY - Math.round(39 * s),
        Math.round(2 * s),
        Math.round(2 * s)
      );
    } else {
      // Standard peaked roof (stepped pyramid)
      const roofW1 = bWidth + Math.round(4 * s);
      const roofX1 = Math.round(2 * s);

      // Roof layer 1 (eaves)
      g.fillStyle(style.roof);
      g.fillRect(roofX1, baseY - Math.round(8 * s), roofW1, Math.round(8 * s));
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(roofX1, baseY - Math.round(8 * s), roofW1, Math.round(2 * s));

      // Roof layer 2
      const roofW2 = roofW1 - Math.round(14 * s);
      const roofX2 = roofX1 + Math.round(7 * s);
      g.fillStyle(style.roof);
      g.fillRect(roofX2, baseY - Math.round(16 * s), roofW2, Math.round(8 * s));
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(roofX2, baseY - Math.round(16 * s), roofW2, Math.round(2 * s));

      // Roof layer 3 (peak)
      const roofW3 = roofW2 - Math.round(14 * s);
      const roofX3 = roofX2 + Math.round(7 * s);
      g.fillStyle(style.roof);
      g.fillRect(roofX3, baseY - Math.round(22 * s), roofW3, Math.round(6 * s));
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(roofX3, baseY - Math.round(22 * s), roofW3, Math.round(2 * s));
    }

    // Windows - 2 rows x 2 columns (uniform rectangles with cross dividers)
    const windowColor = style.hasGlass ? PALETTE.mint : PALETTE.lightBlue;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const wx = Math.round(10 * s) + col * Math.round(18 * s);
        const wy = baseY + Math.round(15 * s) + row * Math.round(25 * s);
        const winW = Math.round(12 * s);
        const winH = Math.round(16 * s);

        // Window frame (dark)
        g.fillStyle(darken(style.base, 0.35));
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          winW + Math.round(2 * s),
          winH + Math.round(2 * s)
        );

        // Window glass
        g.fillStyle(windowColor);
        g.fillRect(wx, wy, winW, winH);

        // Window inner glow
        g.fillStyle(lighten(windowColor, 0.2));
        g.fillRect(
          wx + Math.round(2 * s),
          wy + Math.round(2 * s),
          winW - Math.round(4 * s),
          winH - Math.round(4 * s)
        );

        // Window highlight (top-left corner)
        g.fillStyle(PALETTE.white);
        g.fillRect(
          wx + Math.round(1 * s),
          wy + Math.round(1 * s),
          Math.round(3 * s),
          Math.round(3 * s)
        );

        // Window cross dividers
        g.fillStyle(style.trim);
        g.fillRect(wx + winW / 2 - Math.round(1 * s), wy, Math.round(2 * s), winH);
        g.fillRect(wx, wy + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
      }
    }

    // Clock face for clock tower (rectangular pixel clock)
    if (style.hasClock) {
      const clockY = baseY + Math.round(8 * s);
      const clockSize = Math.round(16 * s);
      const clockX = centerX - clockSize / 2;

      // Clock frame
      g.fillStyle(PALETTE.cream);
      g.fillRect(
        clockX - Math.round(2 * s),
        clockY - Math.round(2 * s),
        clockSize + Math.round(4 * s),
        clockSize + Math.round(4 * s)
      );
      // Clock face
      g.fillStyle(style.accent);
      g.fillRect(clockX, clockY, clockSize, clockSize);
      // Clock inner
      g.fillStyle(PALETTE.darkGray);
      g.fillRect(
        clockX + Math.round(2 * s),
        clockY + Math.round(2 * s),
        clockSize - Math.round(4 * s),
        clockSize - Math.round(4 * s)
      );
      // Clock hands (rectangles)
      g.fillStyle(PALETTE.gold);
      // Hour hand (vertical)
      g.fillRect(
        centerX - Math.round(1 * s),
        clockY + Math.round(3 * s),
        Math.round(2 * s),
        Math.round(6 * s)
      );
      // Minute hand (horizontal)
      g.fillRect(
        centerX,
        clockY + clockSize / 2 - Math.round(1 * s),
        Math.round(5 * s),
        Math.round(2 * s)
      );
    }

    // Books/scrolls for library
    if (style.hasBooks) {
      const bookY = baseY + Math.round(65 * s);
      const bookColors = [PALETTE.brightRed, PALETTE.forest, PALETTE.navy, PALETTE.amber];
      bookColors.forEach((color, i) => {
        g.fillStyle(color);
        g.fillRect(
          Math.round(8 * s) + i * Math.round(8 * s),
          bookY,
          Math.round(6 * s),
          Math.round(12 * s)
        );
        // Book spine highlight
        g.fillStyle(lighten(color, 0.2));
        g.fillRect(
          Math.round(8 * s) + i * Math.round(8 * s),
          bookY,
          Math.round(1 * s),
          Math.round(12 * s)
        );
      });
    }

    // Art palette for studio (rectangular palette shape)
    if (style.hasPalette) {
      const paletteX = bWidth - Math.round(18 * s);
      const paletteY = baseY + Math.round(14 * s);
      // Palette base (rounded rectangle approximation)
      g.fillStyle(PALETTE.brown);
      g.fillRect(paletteX, paletteY, Math.round(14 * s), Math.round(12 * s));
      g.fillRect(
        paletteX + Math.round(2 * s),
        paletteY - Math.round(2 * s),
        Math.round(10 * s),
        Math.round(2 * s)
      );
      g.fillRect(
        paletteX + Math.round(2 * s),
        paletteY + Math.round(12 * s),
        Math.round(10 * s),
        Math.round(2 * s)
      );
      // Paint dabs (small rectangles)
      const paletteColors = [PALETTE.brightRed, PALETTE.yellow, PALETTE.blue, PALETTE.bagsGreen];
      paletteColors.forEach((color, i) => {
        g.fillStyle(color);
        g.fillRect(
          paletteX + Math.round(2 * s) + (i % 2) * Math.round(6 * s),
          paletteY + Math.round(2 * s) + Math.floor(i / 2) * Math.round(5 * s),
          Math.round(4 * s),
          Math.round(3 * s)
        );
      });
    }

    // Telescope for observatory (rectangular)
    if (style.hasTelescope) {
      const telescopeX = centerX + Math.round(6 * s);
      const telescopeY = baseY - Math.round(30 * s);
      // Telescope tube
      g.fillStyle(PALETTE.darkGray);
      g.fillRect(telescopeX, telescopeY, Math.round(4 * s), Math.round(20 * s));
      g.fillStyle(lighten(PALETTE.darkGray, 0.15));
      g.fillRect(telescopeX, telescopeY, Math.round(1 * s), Math.round(20 * s));
      // Telescope lens (wider end)
      g.fillStyle(PALETTE.lightGray);
      g.fillRect(
        telescopeX - Math.round(2 * s),
        telescopeY - Math.round(4 * s),
        Math.round(8 * s),
        Math.round(5 * s)
      );
      g.fillStyle(PALETTE.cyan);
      g.fillRect(
        telescopeX - Math.round(1 * s),
        telescopeY - Math.round(3 * s),
        Math.round(6 * s),
        Math.round(3 * s)
      );
    }

    // Plants for greenhouse (rectangular plant shapes)
    if (style.hasPlants) {
      const plantColors = [PALETTE.bagsGreen, PALETTE.forest, PALETTE.mint];
      for (let i = 0; i < 3; i++) {
        // Plant foliage (stacked rectangles)
        g.fillStyle(plantColors[i]);
        g.fillRect(
          Math.round(9 * s) + i * Math.round(12 * s),
          baseY + Math.round(66 * s),
          Math.round(10 * s),
          Math.round(6 * s)
        );
        g.fillRect(
          Math.round(10 * s) + i * Math.round(12 * s),
          baseY + Math.round(62 * s),
          Math.round(8 * s),
          Math.round(4 * s)
        );
        g.fillRect(
          Math.round(11 * s) + i * Math.round(12 * s),
          baseY + Math.round(59 * s),
          Math.round(6 * s),
          Math.round(3 * s)
        );
      }
      // Flower pots
      g.fillStyle(PALETTE.brown);
      for (let i = 0; i < 3; i++) {
        g.fillRect(
          Math.round(8 * s) + i * Math.round(12 * s),
          baseY + Math.round(72 * s),
          Math.round(10 * s),
          Math.round(8 * s)
        );
        g.fillStyle(darken(PALETTE.brown, 0.15));
        g.fillRect(
          Math.round(8 * s) + i * Math.round(12 * s) + Math.round(8 * s),
          baseY + Math.round(72 * s),
          Math.round(2 * s),
          Math.round(8 * s)
        );
        g.fillStyle(PALETTE.brown);
      }
    }

    // Stage lights for amphitheater (rectangular lights)
    if (style.hasLights) {
      const lightPositions = [Math.round(10 * s), centerX, bWidth - Math.round(6 * s)];
      lightPositions.forEach((lx) => {
        // Light fixture
        g.fillStyle(PALETTE.darkGray);
        g.fillRect(
          lx - Math.round(4 * s),
          baseY - Math.round(10 * s),
          Math.round(8 * s),
          Math.round(6 * s)
        );
        // Light glow
        g.fillStyle(PALETTE.gold);
        g.fillRect(
          lx - Math.round(3 * s),
          baseY - Math.round(8 * s),
          Math.round(6 * s),
          Math.round(4 * s)
        );
        g.fillStyle(PALETTE.yellow);
        g.fillRect(
          lx - Math.round(2 * s),
          baseY - Math.round(7 * s),
          Math.round(4 * s),
          Math.round(2 * s)
        );
      });
    }

    // Columns for welcome hall
    if (style.hasColumns) {
      const columnWidth = Math.round(5 * s);
      const columnHeight = Math.round(45 * s);
      const columnY = canvasHeight - columnHeight;

      // Left column
      g.fillStyle(style.trim);
      g.fillRect(Math.round(10 * s), columnY, columnWidth, columnHeight);
      g.fillStyle(lighten(style.trim, 0.15));
      g.fillRect(Math.round(10 * s), columnY, Math.round(2 * s), columnHeight);
      g.fillStyle(darken(style.trim, 0.15));
      g.fillRect(
        Math.round(10 * s) + columnWidth - Math.round(1 * s),
        columnY,
        Math.round(1 * s),
        columnHeight
      );

      // Right column
      g.fillStyle(style.trim);
      g.fillRect(bWidth - Math.round(11 * s), columnY, columnWidth, columnHeight);
      g.fillStyle(lighten(style.trim, 0.15));
      g.fillRect(bWidth - Math.round(11 * s), columnY, Math.round(2 * s), columnHeight);

      // Column caps (decorative tops)
      g.fillStyle(style.trim);
      g.fillRect(
        Math.round(8 * s),
        columnY - Math.round(4 * s),
        columnWidth + Math.round(4 * s),
        Math.round(4 * s)
      );
      g.fillRect(
        bWidth - Math.round(13 * s),
        columnY - Math.round(4 * s),
        columnWidth + Math.round(4 * s),
        Math.round(4 * s)
      );
      g.fillStyle(lighten(style.trim, 0.2));
      g.fillRect(
        Math.round(8 * s),
        columnY - Math.round(4 * s),
        columnWidth + Math.round(4 * s),
        Math.round(1 * s)
      );
      g.fillRect(
        bWidth - Math.round(13 * s),
        columnY - Math.round(4 * s),
        columnWidth + Math.round(4 * s),
        Math.round(1 * s)
      );
    }

    // Screen for broadcast tower (solid colors)
    if (style.hasScreen) {
      // Screen frame
      g.fillStyle(PALETTE.darkGray);
      g.fillRect(
        Math.round(8 * s),
        baseY + Math.round(10 * s),
        bWidth - Math.round(12 * s),
        Math.round(24 * s)
      );
      // Screen glass
      g.fillStyle(PALETTE.cyan);
      g.fillRect(
        Math.round(10 * s),
        baseY + Math.round(12 * s),
        bWidth - Math.round(16 * s),
        Math.round(20 * s)
      );
      // Screen highlight
      g.fillStyle(lighten(PALETTE.cyan, 0.3));
      g.fillRect(
        Math.round(10 * s),
        baseY + Math.round(12 * s),
        Math.round(6 * s),
        Math.round(4 * s)
      );
    }

    // Door
    const doorWidth = Math.round(14 * s);
    const doorHeight = Math.round(20 * s);
    const doorX = centerX - doorWidth / 2;
    const doorY = canvasHeight - doorHeight;

    // Door frame
    g.fillStyle(style.accent);
    g.fillRect(
      doorX - Math.round(2 * s),
      doorY - Math.round(4 * s),
      doorWidth + Math.round(4 * s),
      doorHeight + Math.round(4 * s)
    );
    g.fillStyle(lighten(style.accent, 0.2));
    g.fillRect(
      doorX - Math.round(2 * s),
      doorY - Math.round(4 * s),
      doorWidth + Math.round(4 * s),
      Math.round(2 * s)
    );

    // Door body (rectangular - no arch)
    g.fillStyle(PALETTE.darkBrown);
    g.fillRect(doorX, doorY, doorWidth, doorHeight);

    // Door panels
    g.fillStyle(darken(PALETTE.darkBrown, 0.15));
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(2 * s),
      Math.round(4 * s),
      doorHeight - Math.round(4 * s)
    );
    g.fillRect(
      doorX + Math.round(8 * s),
      doorY + Math.round(2 * s),
      Math.round(4 * s),
      doorHeight - Math.round(4 * s)
    );

    // Door highlight (left edge)
    g.fillStyle(lighten(PALETTE.darkBrown, 0.12));
    g.fillRect(doorX, doorY, Math.round(2 * s), doorHeight);

    // Door knocker (small rectangle)
    g.fillStyle(style.accent);
    g.fillRect(
      doorX + doorWidth / 2 - Math.round(1 * s),
      doorY + doorHeight / 2,
      Math.round(2 * s),
      Math.round(3 * s)
    );

    // Building name plaque
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      Math.round(8 * s),
      baseY + Math.round(3 * s),
      bWidth - Math.round(12 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.accent);
    g.fillRect(
      Math.round(10 * s),
      baseY + Math.round(4 * s),
      bWidth - Math.round(16 * s),
      Math.round(6 * s)
    );
    g.fillStyle(lighten(style.accent, 0.25));
    g.fillRect(
      Math.round(10 * s),
      baseY + Math.round(4 * s),
      bWidth - Math.round(16 * s),
      Math.round(1 * s)
    );

    g.generateTexture(`academy_${index}`, canvasWidth, canvasHeight);
    g.destroy();
  });

  // Generate Academy entrance gate
  generateAcademyGate(scene);
}
