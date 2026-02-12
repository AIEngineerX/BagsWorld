import * as Phaser from "phaser";
import { SCALE, PALETTE } from "./constants";

export function generateLabsAssets(scene: Phaser.Scene): void {
  generateLabsGround(scene);
  generateLabsBuildings(scene);
  generateLabsProps(scene);
}

function generateLabsGround(scene: Phaser.Scene): void {
  const s = SCALE;
  const size = Math.round(32 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Base: dark floor with green Bags.FM tint
  g.fillStyle(0x0a1a0f);
  g.fillRect(0, 0, size, size);

  // Grid pattern (tech floor panels) - Bags.FM green theme
  const panelSize = Math.round(15 * s);
  const gap = Math.round(1 * s);

  // 2x2 panel grid
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const px = gap + col * (panelSize + gap);
      const py = gap + row * (panelSize + gap);

      // Panel base (dark green)
      g.fillStyle(0x0d2818);
      g.fillRect(px, py, panelSize, panelSize);

      // Panel highlight (top-left edge glow) - Bags green
      g.fillStyle(0x4ade80, 0.25);
      g.fillRect(px, py, panelSize, Math.round(1 * s));
      g.fillRect(px, py, Math.round(1 * s), panelSize);

      // Panel shadow (bottom-right)
      g.fillStyle(0x0a0a0f, 0.5);
      g.fillRect(px, py + panelSize - Math.round(1 * s), panelSize, Math.round(1 * s));
      g.fillRect(px + panelSize - Math.round(1 * s), py, Math.round(1 * s), panelSize);
    }
  }

  // Circuit trace accent - Bags.FM green
  g.fillStyle(0x4ade80, 0.3);
  g.fillRect(Math.round(5 * s), Math.round(16 * s), Math.round(8 * s), Math.round(1 * s));
  g.fillRect(Math.round(12 * s), Math.round(16 * s), Math.round(1 * s), Math.round(5 * s));

  // Glowing node - Bags green
  g.fillStyle(0x4ade80, 0.5);
  g.fillRect(Math.round(24 * s), Math.round(8 * s), Math.round(2 * s), Math.round(2 * s));

  g.generateTexture("labs_ground", size, size);
  g.destroy();
}

function generateLabsBuildings(scene: Phaser.Scene): void {
  const s = SCALE;

  // Single large Bags.FM HQ building
  generateBagsFMHQ(scene, s);
}

function generateBagsFMHQ(scene: Phaser.Scene, s: number): void {
  // Pixel art Bags.FM HQ - modern tech building with proper 16-bit style
  const g = scene.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(180 * s);
  const canvasH = Math.round(280 * s);
  const bWidth = Math.round(150 * s);
  const bHeight = Math.round(200 * s);
  const baseX = Math.round(15 * s);
  const baseY = canvasH - bHeight;
  const centerX = baseX + bWidth / 2;

  // Bags.FM brand colors (solid, no transparency)
  const bagsGreen = 0x4ade80;
  const bagsGreenDark = 0x22c55e;
  const bagsGreenLight = 0x86efac;
  const wallBase = 0x1a1a2e;
  const wallLight = 0x2d2d4a;
  const wallDark = 0x0f0f1a;

  // Ground shadow (solid, no alpha)
  g.fillStyle(PALETTE.void);
  g.fillRect(
    baseX + Math.round(6 * s),
    canvasH - Math.round(4 * s),
    bWidth - Math.round(4 * s),
    Math.round(4 * s)
  );

  // Main building body
  g.fillStyle(wallBase);
  g.fillRect(baseX, baseY, bWidth, bHeight);

  // Brick texture (checkerboard dithering)
  g.fillStyle(wallDark);
  for (let row = 0; row < bHeight; row += Math.round(12 * s)) {
    const offset = (row / Math.round(12 * s)) % 2 === 0 ? 0 : Math.round(10 * s);
    for (let col = offset; col < bWidth; col += Math.round(20 * s)) {
      g.fillRect(baseX + col, baseY + row, Math.round(18 * s), Math.round(10 * s));
    }
  }

  // 3D depth: Light left edge
  g.fillStyle(wallLight);
  g.fillRect(baseX, baseY, Math.round(8 * s), bHeight);

  // 3D depth: Dark right edge
  g.fillStyle(wallDark);
  g.fillRect(baseX + bWidth - Math.round(8 * s), baseY, Math.round(8 * s), bHeight);

  // BAGS logo panel (solid green panel with pixel text)
  const logoY = baseY + Math.round(25 * s);
  const logoH = Math.round(50 * s);
  const logoW = bWidth - Math.round(30 * s);
  const logoX = baseX + Math.round(15 * s);

  // Logo panel background
  g.fillStyle(bagsGreenDark);
  g.fillRect(logoX, logoY, logoW, logoH);

  // Logo panel border
  g.fillStyle(bagsGreen);
  g.fillRect(logoX, logoY, logoW, Math.round(3 * s));
  g.fillRect(logoX, logoY + logoH - Math.round(3 * s), logoW, Math.round(3 * s));
  g.fillRect(logoX, logoY, Math.round(3 * s), logoH);
  g.fillRect(logoX + logoW - Math.round(3 * s), logoY, Math.round(3 * s), logoH);

  // Pixel BAGS text (simplified blocky letters)
  const textY = logoY + Math.round(12 * s);
  const letterW = Math.round(18 * s);
  const letterH = Math.round(26 * s);
  const letterGap = Math.round(6 * s);
  const textStartX = centerX - Math.round(48 * s);

  g.fillStyle(bagsGreenLight);

  // B - pixel letter
  g.fillRect(textStartX, textY, Math.round(4 * s), letterH);
  g.fillRect(textStartX, textY, letterW - Math.round(4 * s), Math.round(4 * s));
  g.fillRect(
    textStartX,
    textY + letterH / 2 - Math.round(2 * s),
    letterW - Math.round(6 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    textStartX,
    textY + letterH - Math.round(4 * s),
    letterW - Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    textStartX + letterW - Math.round(6 * s),
    textY + Math.round(4 * s),
    Math.round(4 * s),
    letterH / 2 - Math.round(6 * s)
  );
  g.fillRect(
    textStartX + letterW - Math.round(6 * s),
    textY + letterH / 2 + Math.round(2 * s),
    Math.round(4 * s),
    letterH / 2 - Math.round(6 * s)
  );

  // A - pixel letter
  const aX = textStartX + letterW + letterGap;
  g.fillRect(aX + letterW / 2 - Math.round(2 * s), textY, Math.round(4 * s), Math.round(4 * s));
  g.fillRect(aX, textY + Math.round(4 * s), Math.round(4 * s), letterH - Math.round(4 * s));
  g.fillRect(
    aX + letterW - Math.round(4 * s),
    textY + Math.round(4 * s),
    Math.round(4 * s),
    letterH - Math.round(4 * s)
  );
  g.fillRect(
    aX + Math.round(4 * s),
    textY + letterH / 2,
    letterW - Math.round(8 * s),
    Math.round(4 * s)
  );

  // G - pixel letter
  const gX = aX + letterW + letterGap;
  g.fillRect(gX + Math.round(4 * s), textY, letterW - Math.round(4 * s), Math.round(4 * s));
  g.fillRect(gX, textY, Math.round(4 * s), letterH);
  g.fillRect(
    gX + Math.round(4 * s),
    textY + letterH - Math.round(4 * s),
    letterW - Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    gX + letterW - Math.round(4 * s),
    textY + letterH / 2,
    Math.round(4 * s),
    letterH / 2 - Math.round(4 * s)
  );
  g.fillRect(
    gX + letterW / 2,
    textY + letterH / 2,
    letterW / 2 - Math.round(4 * s),
    Math.round(4 * s)
  );

  // S - pixel letter
  const sX = gX + letterW + letterGap;
  g.fillRect(sX + Math.round(4 * s), textY, letterW - Math.round(4 * s), Math.round(4 * s));
  g.fillRect(sX, textY, Math.round(4 * s), letterH / 2);
  g.fillRect(
    sX + Math.round(4 * s),
    textY + letterH / 2 - Math.round(2 * s),
    letterW - Math.round(8 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    sX + letterW - Math.round(4 * s),
    textY + letterH / 2,
    Math.round(4 * s),
    letterH / 2 - Math.round(4 * s)
  );
  g.fillRect(
    sX,
    textY + letterH - Math.round(4 * s),
    letterW - Math.round(4 * s),
    Math.round(4 * s)
  );

  // Windows (3 rows x 4 columns - solid green, no alpha)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const wx = baseX + Math.round(18 * s) + col * Math.round(32 * s);
      const wy = baseY + Math.round(90 * s) + row * Math.round(32 * s);
      const winW = Math.round(24 * s);
      const winH = Math.round(24 * s);

      // Window frame (dark)
      g.fillStyle(wallDark);
      g.fillRect(
        wx - Math.round(2 * s),
        wy - Math.round(2 * s),
        winW + Math.round(4 * s),
        winH + Math.round(4 * s)
      );

      // Window glass (solid green)
      g.fillStyle(bagsGreen);
      g.fillRect(wx, wy, winW, winH);

      // Window highlight (corner)
      g.fillStyle(bagsGreenLight);
      g.fillRect(
        wx + Math.round(2 * s),
        wy + Math.round(2 * s),
        Math.round(6 * s),
        Math.round(6 * s)
      );

      // Window cross divider
      g.fillStyle(wallBase);
      g.fillRect(wx + winW / 2 - Math.round(1 * s), wy, Math.round(2 * s), winH);
      g.fillRect(wx, wy + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
    }
  }

  // Stepped pyramid roof
  const roofY = baseY - Math.round(8 * s);
  g.fillStyle(bagsGreenDark);
  g.fillRect(baseX - Math.round(6 * s), roofY, bWidth + Math.round(12 * s), Math.round(12 * s));
  g.fillRect(
    baseX + Math.round(10 * s),
    roofY - Math.round(10 * s),
    bWidth - Math.round(20 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    baseX + Math.round(30 * s),
    roofY - Math.round(18 * s),
    bWidth - Math.round(60 * s),
    Math.round(8 * s)
  );

  // Roof highlights
  g.fillStyle(bagsGreen);
  g.fillRect(baseX - Math.round(6 * s), roofY, bWidth + Math.round(12 * s), Math.round(3 * s));
  g.fillRect(
    baseX + Math.round(10 * s),
    roofY - Math.round(10 * s),
    bWidth - Math.round(20 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    baseX + Math.round(30 * s),
    roofY - Math.round(18 * s),
    bWidth - Math.round(60 * s),
    Math.round(3 * s)
  );

  // Antenna/spire (rectangular, no circles)
  const antennaX = centerX - Math.round(4 * s);
  const antennaY = roofY - Math.round(50 * s);
  g.fillStyle(PALETTE.lightGray);
  g.fillRect(antennaX, antennaY, Math.round(8 * s), Math.round(32 * s));

  // Antenna beacon (stacked rectangles instead of circle)
  g.fillStyle(bagsGreenDark);
  g.fillRect(
    antennaX - Math.round(4 * s),
    antennaY - Math.round(8 * s),
    Math.round(16 * s),
    Math.round(8 * s)
  );
  g.fillStyle(bagsGreen);
  g.fillRect(
    antennaX - Math.round(2 * s),
    antennaY - Math.round(6 * s),
    Math.round(12 * s),
    Math.round(6 * s)
  );
  g.fillStyle(bagsGreenLight);
  g.fillRect(antennaX, antennaY - Math.round(4 * s), Math.round(8 * s), Math.round(4 * s));

  // Grand entrance door (stepped arch instead of circle)
  const doorW = Math.round(36 * s);
  const doorH = Math.round(46 * s);
  const doorX = centerX - doorW / 2;
  const doorY = canvasH - doorH;

  // Door frame (solid green)
  g.fillStyle(bagsGreen);
  g.fillRect(
    doorX - Math.round(4 * s),
    doorY - Math.round(10 * s),
    doorW + Math.round(8 * s),
    doorH + Math.round(10 * s)
  );

  // Stepped arch top
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(14 * s),
    doorW + Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    doorX + Math.round(4 * s),
    doorY - Math.round(18 * s),
    doorW - Math.round(8 * s),
    Math.round(4 * s)
  );

  // Door panel (dark)
  g.fillStyle(wallDark);
  g.fillRect(doorX, doorY, doorW, doorH);

  // Door divider
  g.fillStyle(bagsGreen);
  g.fillRect(centerX - Math.round(2 * s), doorY, Math.round(4 * s), doorH);

  // Door handles
  g.fillStyle(bagsGreenLight);
  g.fillRect(
    doorX + Math.round(6 * s),
    doorY + Math.round(18 * s),
    Math.round(4 * s),
    Math.round(10 * s)
  );
  g.fillRect(
    doorX + doorW - Math.round(10 * s),
    doorY + Math.round(18 * s),
    Math.round(4 * s),
    Math.round(10 * s)
  );

  // Base trim (green)
  g.fillStyle(bagsGreen);
  g.fillRect(baseX, canvasH - Math.round(6 * s), bWidth, Math.round(6 * s));
  g.fillStyle(bagsGreenLight);
  g.fillRect(baseX, canvasH - Math.round(6 * s), bWidth, Math.round(2 * s));

  g.generateTexture("labs_hq", canvasW, canvasH);
  g.destroy();
}

function generateLabsProps(scene: Phaser.Scene): void {
  const s = SCALE;

  // Prop 0: Holographic Display Stand
  generateLabsHoloDisplay(scene, s);

  // Prop 1: Tech Tree (digital/circuit tree)
  generateLabsTechTree(scene, s);

  // Prop 2: Server Rack (small)
  generateLabsServerRack(scene, s);

  // Prop 3: Data Terminal
  generateLabsDataTerminal(scene, s);

  // Prop 4: Energy Core
  generateLabsEnergyCore(scene, s);

  // Prop 5: Drone Dock
  generateLabsDroneDock(scene, s);
}

function generateLabsHoloDisplay(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(30 * s);
  const h = Math.round(50 * s);

  // Base stand
  g.fillStyle(0x374151);
  g.fillRect(Math.round(10 * s), h - Math.round(8 * s), Math.round(10 * s), Math.round(8 * s));

  // Pole
  g.fillStyle(0x4b5563);
  g.fillRect(Math.round(13 * s), Math.round(15 * s), Math.round(4 * s), h - Math.round(23 * s));

  // Holographic display (floating rectangle) - Bags.FM green
  g.fillStyle(0x4ade80, 0.4);
  g.fillRect(Math.round(3 * s), Math.round(5 * s), Math.round(24 * s), Math.round(18 * s));
  g.fillStyle(0x86efac, 0.7);
  g.fillRect(Math.round(5 * s), Math.round(7 * s), Math.round(20 * s), Math.round(14 * s));

  // Display content (data visualization)
  g.fillStyle(0xffffff, 0.6);
  g.fillRect(Math.round(7 * s), Math.round(9 * s), Math.round(4 * s), Math.round(8 * s));
  g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(4 * s), Math.round(6 * s));
  g.fillRect(Math.round(19 * s), Math.round(10 * s), Math.round(4 * s), Math.round(7 * s));

  // Glow effect at base - Bags.FM green
  g.fillStyle(0x4ade80, 0.3);
  g.fillCircle(Math.round(15 * s), Math.round(15 * s), Math.round(6 * s));

  g.generateTexture("labs_prop_0", w, h);
  g.destroy();
}

function generateLabsTechTree(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(40 * s);
  const h = Math.round(70 * s);
  const centerX = w / 2;

  // Trunk (metallic/circuit pattern)
  g.fillStyle(0x4b5563);
  g.fillRect(
    centerX - Math.round(3 * s),
    Math.round(30 * s),
    Math.round(6 * s),
    Math.round(40 * s)
  );

  // Circuit lines on trunk - Bags.FM green
  g.fillStyle(0x4ade80);
  g.fillRect(
    centerX - Math.round(1 * s),
    Math.round(35 * s),
    Math.round(2 * s),
    Math.round(30 * s)
  );

  // Digital foliage (geometric shapes with glow)
  const nodePositions = [
    { x: centerX, y: Math.round(12 * s), size: Math.round(14 * s) },
    { x: centerX - Math.round(12 * s), y: Math.round(22 * s), size: Math.round(10 * s) },
    { x: centerX + Math.round(12 * s), y: Math.round(20 * s), size: Math.round(11 * s) },
    { x: centerX - Math.round(8 * s), y: Math.round(35 * s), size: Math.round(8 * s) },
    { x: centerX + Math.round(10 * s), y: Math.round(32 * s), size: Math.round(9 * s) },
  ];

  nodePositions.forEach((node, i) => {
    // Glow - Bags.FM green
    g.fillStyle(0x86efac, 0.3);
    g.fillCircle(node.x, node.y, node.size + Math.round(3 * s));
    // Node - Bags.FM green shades
    g.fillStyle(i === 0 ? 0x4ade80 : 0x22c55e);
    g.fillCircle(node.x, node.y, node.size);
    // Inner highlight
    g.fillStyle(0xbbf7d0, 0.6);
    g.fillCircle(node.x - Math.round(2 * s), node.y - Math.round(2 * s), node.size * 0.4);
  });

  // Connection lines between nodes - Bags.FM green
  g.fillStyle(0x4ade80, 0.5);
  g.fillRect(
    centerX - Math.round(1 * s),
    Math.round(12 * s),
    Math.round(2 * s),
    Math.round(18 * s)
  );
  g.fillRect(
    centerX - Math.round(12 * s),
    Math.round(22 * s),
    Math.round(12 * s),
    Math.round(2 * s)
  );
  g.fillRect(centerX, Math.round(20 * s), Math.round(12 * s), Math.round(2 * s));

  // Base planter (tech pot)
  g.fillStyle(0x374151);
  g.fillRect(
    centerX - Math.round(8 * s),
    h - Math.round(8 * s),
    Math.round(16 * s),
    Math.round(8 * s)
  );
  g.fillStyle(0x4ade80, 0.4);
  g.fillRect(
    centerX - Math.round(6 * s),
    h - Math.round(6 * s),
    Math.round(12 * s),
    Math.round(2 * s)
  );

  g.generateTexture("labs_prop_1", w, h);
  g.destroy();
}

function generateLabsServerRack(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(25 * s);
  const h = Math.round(45 * s);

  // Rack frame
  g.fillStyle(0x374151);
  g.fillRect(Math.round(2 * s), Math.round(5 * s), Math.round(21 * s), Math.round(38 * s));

  // Rack front panel
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(4 * s), Math.round(7 * s), Math.round(17 * s), Math.round(34 * s));

  // Server slots with LEDs - Bags.FM green theme
  for (let i = 0; i < 5; i++) {
    const slotY = Math.round(9 * s) + i * Math.round(6 * s);
    // Slot
    g.fillStyle(0x111827);
    g.fillRect(Math.round(5 * s), slotY, Math.round(15 * s), Math.round(5 * s));
    // LED - All Bags.FM green
    const ledColor = i % 2 === 0 ? 0x4ade80 : 0x22c55e;
    g.fillStyle(ledColor, 0.6);
    g.fillRect(Math.round(6 * s), slotY + Math.round(1 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillStyle(ledColor);
    g.fillRect(Math.round(7 * s), slotY + Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));
  }

  // Ventilation at top
  g.fillStyle(0x111827);
  for (let i = 0; i < 4; i++) {
    g.fillRect(
      Math.round(6 * s) + i * Math.round(4 * s),
      Math.round(38 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );
  }

  g.generateTexture("labs_prop_2", w, h);
  g.destroy();
}

function generateLabsDataTerminal(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(28 * s);
  const h = Math.round(40 * s);

  // Terminal base
  g.fillStyle(0x374151);
  g.fillRect(Math.round(4 * s), h - Math.round(10 * s), Math.round(20 * s), Math.round(10 * s));

  // Stand
  g.fillStyle(0x4b5563);
  g.fillRect(Math.round(11 * s), Math.round(18 * s), Math.round(6 * s), Math.round(14 * s));

  // Screen frame
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(2 * s), Math.round(3 * s), Math.round(24 * s), Math.round(18 * s));

  // Screen
  g.fillStyle(0x0f172a);
  g.fillRect(Math.round(4 * s), Math.round(5 * s), Math.round(20 * s), Math.round(14 * s));

  // Screen content (terminal text)
  g.fillStyle(0x22c55e);
  g.fillRect(Math.round(6 * s), Math.round(7 * s), Math.round(12 * s), Math.round(2 * s));
  g.fillRect(Math.round(6 * s), Math.round(11 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillRect(Math.round(6 * s), Math.round(15 * s), Math.round(14 * s), Math.round(2 * s));

  // Blinking cursor
  g.fillStyle(0x22c55e, 0.8);
  g.fillRect(Math.round(20 * s), Math.round(15 * s), Math.round(2 * s), Math.round(2 * s));

  // Power indicator - Bags.FM green
  g.fillStyle(0x4ade80);
  g.fillRect(Math.round(22 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));

  g.generateTexture("labs_prop_3", w, h);
  g.destroy();
}

function generateLabsEnergyCore(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(35 * s);
  const h = Math.round(55 * s);
  const centerX = w / 2;

  // Base platform
  g.fillStyle(0x374151);
  g.fillRect(Math.round(5 * s), h - Math.round(8 * s), Math.round(25 * s), Math.round(8 * s));

  // Energy containment ring
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(8 * s), Math.round(25 * s), Math.round(19 * s), Math.round(22 * s));

  // Outer glow
  g.fillStyle(0x8b5cf6, 0.3);
  g.fillCircle(centerX, Math.round(28 * s), Math.round(14 * s));

  // Energy core (pulsing orb)
  g.fillStyle(0x8b5cf6, 0.6);
  g.fillCircle(centerX, Math.round(28 * s), Math.round(10 * s));
  g.fillStyle(0xa855f7);
  g.fillCircle(centerX, Math.round(28 * s), Math.round(7 * s));
  g.fillStyle(0xc4b5fd);
  g.fillCircle(centerX, Math.round(28 * s), Math.round(4 * s));
  g.fillStyle(0xffffff);
  g.fillCircle(centerX - Math.round(2 * s), Math.round(26 * s), Math.round(2 * s));

  // Energy beams shooting up
  g.fillStyle(0x8b5cf6, 0.5);
  g.fillRect(centerX - Math.round(1 * s), Math.round(5 * s), Math.round(2 * s), Math.round(18 * s));
  g.fillStyle(0xa855f7, 0.3);
  g.fillRect(centerX - Math.round(3 * s), Math.round(8 * s), Math.round(6 * s), Math.round(12 * s));

  // Side conduits
  g.fillStyle(0x4b5563);
  g.fillRect(Math.round(3 * s), Math.round(20 * s), Math.round(5 * s), Math.round(25 * s));
  g.fillRect(Math.round(27 * s), Math.round(20 * s), Math.round(5 * s), Math.round(25 * s));

  // Conduit lights
  g.fillStyle(0x8b5cf6);
  g.fillRect(Math.round(4 * s), Math.round(25 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(4 * s), Math.round(35 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(28 * s), Math.round(25 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(28 * s), Math.round(35 * s), Math.round(3 * s), Math.round(3 * s));

  g.generateTexture("labs_prop_4", w, h);
  g.destroy();
}

function generateLabsDroneDock(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(32 * s);
  const h = Math.round(35 * s);
  const centerX = w / 2;

  // Landing pad base
  g.fillStyle(0x374151);
  g.fillRect(Math.round(4 * s), h - Math.round(6 * s), Math.round(24 * s), Math.round(6 * s));

  // Pad marking (H pattern) - Bags.FM green
  g.fillStyle(0x4ade80);
  g.fillRect(Math.round(8 * s), h - Math.round(5 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(22 * s), h - Math.round(5 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(8 * s), h - Math.round(4 * s), Math.round(16 * s), Math.round(2 * s));

  // Drone body
  g.fillStyle(0x4b5563);
  g.fillRect(Math.round(10 * s), Math.round(12 * s), Math.round(12 * s), Math.round(8 * s));

  // Drone rotors (4 corners)
  g.fillStyle(0x6b7280);
  g.fillCircle(Math.round(8 * s), Math.round(10 * s), Math.round(4 * s));
  g.fillCircle(Math.round(24 * s), Math.round(10 * s), Math.round(4 * s));
  g.fillCircle(Math.round(8 * s), Math.round(22 * s), Math.round(4 * s));
  g.fillCircle(Math.round(24 * s), Math.round(22 * s), Math.round(4 * s));

  // Rotor blur effect
  g.fillStyle(0x9ca3af, 0.3);
  g.fillCircle(Math.round(8 * s), Math.round(10 * s), Math.round(6 * s));
  g.fillCircle(Math.round(24 * s), Math.round(10 * s), Math.round(6 * s));

  // Drone camera/sensor
  g.fillStyle(0x22c55e);
  g.fillRect(centerX - Math.round(2 * s), Math.round(18 * s), Math.round(4 * s), Math.round(3 * s));

  // Status light
  g.fillStyle(0x06b6d4);
  g.fillRect(centerX - Math.round(1 * s), Math.round(13 * s), Math.round(2 * s), Math.round(2 * s));

  g.generateTexture("labs_prop_5", w, h);
  g.destroy();
}

