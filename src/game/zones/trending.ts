import type { WorldScene } from "../scenes/WorldScene";
import { SCALE } from "../textures/constants";

const GAME_WIDTH = 1280;

export function setupTrendingZone(scene: WorldScene): void {
  scene.restoreNormalSky();

  // Hide the grass ground completely - city has its own pavement
  scene.ground.setVisible(false);

  if (!scene.trendingZoneCreated) {
    // These are lightweight procedural sprites, no need to stagger across frames
    createTrendingSkyline(scene);
    createTrendingDecorations(scene);
    createTrendingBillboards(scene);
    createTrendingTicker(scene);
    scene.storeZoneElementPositions(scene.trendingElements);
    scene.storeZoneElementPositions(scene.skylineSprites);
    scene.storeZoneElementPositions(scene.billboardTexts);
    if (scene.tickerText) scene.originalPositions.set(scene.tickerText, scene.tickerText.x);
    scene.trendingZoneCreated = true;
  } else {
    scene.trendingElements.forEach((el) => (el as any).setVisible(true));
    scene.skylineSprites.forEach((s) => s.setVisible(true));
    scene.billboardTexts.forEach((t) => t.setVisible(true));
    if (scene.tickerText) scene.tickerText.setVisible(true);
  }

  if (scene.tickerTimer) {
    scene.tickerTimer.destroy();
  }
  scene.tickerTimer = scene.time.addEvent({
    delay: 50,
    callback: () => updateTicker(scene),
    loop: true,
  });
}

function createTrendingSkyline(scene: WorldScene): void {
  // Back layer - distant buildings (darker, smaller, scaled)
  const backLayer = [
    { x: Math.round(100 * SCALE), y: Math.round(180 * SCALE), scale: 0.7 * SCALE, alpha: 0.4 },
    { x: Math.round(300 * SCALE), y: Math.round(180 * SCALE), scale: 0.65 * SCALE, alpha: 0.4 },
    { x: Math.round(500 * SCALE), y: Math.round(180 * SCALE), scale: 0.75 * SCALE, alpha: 0.4 },
    { x: Math.round(700 * SCALE), y: Math.round(180 * SCALE), scale: 0.7 * SCALE, alpha: 0.4 },
  ];

  backLayer.forEach((pos) => {
    const skyline = scene.add.sprite(pos.x, pos.y, "skyline_bg");
    skyline.setOrigin(0.5, 0);
    skyline.setScale(pos.scale);
    skyline.setDepth(-2);
    skyline.setAlpha(pos.alpha);
    skyline.setTint(0x111827);
    scene.skylineSprites.push(skyline);
    scene.trendingElements.push(skyline);
  });

  // Front layer - closer buildings (larger, more visible, scaled)
  const frontLayer = [
    { x: Math.round(60 * SCALE), y: Math.round(220 * SCALE), scale: 0.9 * SCALE, alpha: 0.7 },
    { x: Math.round(200 * SCALE), y: Math.round(230 * SCALE), scale: 0.85 * SCALE, alpha: 0.65 },
    { x: Math.round(400 * SCALE), y: Math.round(210 * SCALE), scale: 1.0 * SCALE, alpha: 0.75 },
    { x: Math.round(600 * SCALE), y: Math.round(225 * SCALE), scale: 0.88 * SCALE, alpha: 0.68 },
    { x: Math.round(740 * SCALE), y: Math.round(220 * SCALE), scale: 0.92 * SCALE, alpha: 0.7 },
  ];

  frontLayer.forEach((pos) => {
    const skyline = scene.add.sprite(pos.x, pos.y, "skyline_bg");
    skyline.setOrigin(0.5, 0);
    skyline.setScale(pos.scale);
    skyline.setDepth(-1);
    skyline.setAlpha(pos.alpha);
    scene.skylineSprites.push(skyline);
    scene.trendingElements.push(skyline);
  });
}

function createTrendingDecorations(scene: WorldScene): void {
  // Street lamps at ground level for urban feel (scaled)
  const lampPositions = [
    { x: Math.round(100 * SCALE), y: Math.round(540 * SCALE) },
    { x: Math.round(300 * SCALE), y: Math.round(540 * SCALE) },
    { x: Math.round(500 * SCALE), y: Math.round(540 * SCALE) },
    { x: Math.round(700 * SCALE), y: Math.round(540 * SCALE) },
  ];
  lampPositions.forEach((pos) => {
    const lamp = scene.add.sprite(pos.x, pos.y, "street_lamp");
    lamp.setOrigin(0.5, 1);
    lamp.setDepth(3);
    scene.trendingElements.push(lamp);
  });

  // Add city street elements
  createCityStreetElements(scene);
}

function createCityStreetElements(scene: WorldScene): void {
  // Sidewalk/pavement area (covers the grass area, scaled)
  const pavement = scene.add.rectangle(
    GAME_WIDTH / 2,
    Math.round(520 * SCALE),
    GAME_WIDTH,
    Math.round(160 * SCALE),
    0x374151
  );
  pavement.setDepth(0);
  scene.trendingElements.push(pavement);

  // Road at the bottom (scaled)
  const road = scene.add.rectangle(
    GAME_WIDTH / 2,
    Math.round(575 * SCALE),
    GAME_WIDTH,
    Math.round(50 * SCALE),
    0x1f2937
  );
  road.setDepth(1);
  scene.trendingElements.push(road);

  // Road lane markings (dashed yellow center line, scaled)
  for (let x = Math.round(30 * SCALE); x < Math.round(780 * SCALE); x += Math.round(50 * SCALE)) {
    const roadLine = scene.add.rectangle(
      x,
      Math.round(575 * SCALE),
      Math.round(25 * SCALE),
      Math.round(3 * SCALE),
      0xfbbf24
    );
    roadLine.setDepth(2);
    scene.trendingElements.push(roadLine);
  }

  // Sidewalk curb line (scaled)
  const curb = scene.add.rectangle(
    GAME_WIDTH / 2,
    Math.round(548 * SCALE),
    GAME_WIDTH,
    Math.round(4 * SCALE),
    0x6b7280
  );
  curb.setDepth(2);
  scene.trendingElements.push(curb);

  // Crosswalks at intersections (scaled)
  createCrosswalk(scene, Math.round(200 * SCALE), Math.round(575 * SCALE));
  createCrosswalk(scene, Math.round(600 * SCALE), Math.round(575 * SCALE));

  // Traffic lights near crosswalks (scaled)
  const trafficLight1 = scene.add.sprite(
    Math.round(170 * SCALE),
    Math.round(520 * SCALE),
    "traffic_light"
  );
  trafficLight1.setOrigin(0.5, 1);
  trafficLight1.setDepth(4);
  scene.trendingElements.push(trafficLight1);

  const trafficLight2 = scene.add.sprite(
    Math.round(630 * SCALE),
    Math.round(520 * SCALE),
    "traffic_light"
  );
  trafficLight2.setOrigin(0.5, 1);
  trafficLight2.setDepth(4);
  trafficLight2.setFlipX(true);
  scene.trendingElements.push(trafficLight2);

  // Fire hydrant (scaled)
  const hydrant = scene.add.sprite(
    Math.round(350 * SCALE),
    Math.round(545 * SCALE),
    "fire_hydrant"
  );
  hydrant.setOrigin(0.5, 1);
  hydrant.setDepth(3);
  scene.trendingElements.push(hydrant);

  // Trash can (scaled)
  const trashCan = scene.add.sprite(Math.round(450 * SCALE), Math.round(545 * SCALE), "trash_can");
  trashCan.setOrigin(0.5, 1);
  trashCan.setDepth(3);
  scene.trendingElements.push(trashCan);

  // === ARCADE BUILDING (upgraded retro 80s/90s landmark) ===
  const arcadeX = Math.round(520 * SCALE);
  const arcadeY = Math.round(540 * SCALE);

  const arcadeBuilding = scene.add.sprite(arcadeX, arcadeY, "arcade_building");
  arcadeBuilding.setOrigin(0.5, 1);
  arcadeBuilding.setDepth(5);
  arcadeBuilding.setInteractive({ useHandCursor: true });
  scene.trendingElements.push(arcadeBuilding);

  // --- Marquee chase lights (cycling neon bulbs around the sign) ---
  // Create 8 small circles that cycle colors in a chase pattern
  const chaseLights: Phaser.GameObjects.Arc[] = [];
  const chaseColors = [
    0x4ade80, 0xa855f7, 0xfbbf24, 0x4ade80, 0xa855f7, 0xfbbf24, 0x4ade80, 0xa855f7,
  ];
  const marqueeCenterY = arcadeY - Math.round(185 * SCALE); // top of marquee area
  const marqueeSpread = Math.round(36 * SCALE);

  for (let i = 0; i < 8; i++) {
    const lx = arcadeX - marqueeSpread + i * Math.round(10 * SCALE);
    const light = scene.add.circle(
      lx,
      marqueeCenterY,
      Math.round(2.5 * SCALE),
      chaseColors[i],
      0.7
    );
    light.setDepth(6);
    scene.trendingElements.push(light);
    chaseLights.push(light);
  }

  // Chase light animation: shift colors every 200ms
  let chaseIndex = 0;
  scene.time.addEvent({
    delay: 200,
    callback: () => {
      if (scene.currentZone !== "trending") return;
      chaseIndex = (chaseIndex + 1) % chaseColors.length;
      chaseLights.forEach((light, i) => {
        const colorIdx = (i + chaseIndex) % chaseColors.length;
        light.setFillStyle(chaseColors[colorIdx], 0.8);
      });
    },
    loop: true,
  });

  // --- Neon glow behind building (green/purple pulsing) ---
  const arcadeGlow = scene.add.circle(
    arcadeX,
    arcadeY - Math.round(80 * SCALE),
    Math.round(55 * SCALE),
    0x22c55e,
    0.06
  );
  arcadeGlow.setDepth(4);
  scene.trendingElements.push(arcadeGlow);

  scene.tweens.add({
    targets: arcadeGlow,
    alpha: { from: 0.04, to: 0.14 },
    scale: { from: 1.0, to: 1.15 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
  });

  // Secondary purple glow
  const arcadeGlow2 = scene.add.circle(
    arcadeX + Math.round(5 * SCALE),
    arcadeY - Math.round(60 * SCALE),
    Math.round(40 * SCALE),
    0xa855f7,
    0.05
  );
  arcadeGlow2.setDepth(4);
  scene.trendingElements.push(arcadeGlow2);

  scene.tweens.add({
    targets: arcadeGlow2,
    alpha: { from: 0.03, to: 0.1 },
    scale: { from: 1.05, to: 1.2 },
    duration: 1800,
    yoyo: true,
    repeat: -1,
  });

  // --- Light spill on sidewalk from entrance ---
  const lightSpill = scene.add.ellipse(
    arcadeX,
    arcadeY + Math.round(2 * SCALE),
    Math.round(40 * SCALE),
    Math.round(8 * SCALE),
    0xfbbf24,
    0.1
  );
  lightSpill.setDepth(2);
  scene.trendingElements.push(lightSpill);

  scene.tweens.add({
    targets: lightSpill,
    alpha: { from: 0.06, to: 0.12 },
    scaleX: { from: 0.95, to: 1.05 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
  });

  // --- Neon sidewalk reflection ---
  const neonReflect = scene.add.ellipse(
    arcadeX,
    arcadeY + Math.round(4 * SCALE),
    Math.round(50 * SCALE),
    Math.round(6 * SCALE),
    0x4ade80,
    0.06
  );
  neonReflect.setDepth(2);
  scene.trendingElements.push(neonReflect);

  scene.tweens.add({
    targets: neonReflect,
    alpha: { from: 0.03, to: 0.08 },
    duration: 1600,
    yoyo: true,
    repeat: -1,
  });

  // --- Flickering neon sign effect (simulates one letter flickering) ---
  const flickerDot = scene.add.rectangle(
    arcadeX + Math.round(12 * SCALE),
    arcadeY - Math.round(175 * SCALE),
    Math.round(6 * SCALE),
    Math.round(8 * SCALE),
    0x4ade80,
    0.4
  );
  flickerDot.setDepth(7);
  scene.trendingElements.push(flickerDot);

  // Irregular flicker pattern
  scene.time.addEvent({
    delay: 150,
    callback: () => {
      if (scene.currentZone !== "trending") return;
      const r = Math.random();
      flickerDot.setAlpha(r < 0.15 ? 0.05 : r < 0.3 ? 0.2 : 0.4);
    },
    loop: true,
  });

  // --- Interior CRT glow shift (visible through windows) ---
  const interiorGlow = scene.add.rectangle(
    arcadeX,
    arcadeY - Math.round(120 * SCALE),
    Math.round(60 * SCALE),
    Math.round(25 * SCALE),
    0x22c55e,
    0.04
  );
  interiorGlow.setDepth(4);
  scene.trendingElements.push(interiorGlow);

  // Slow color-shift simulation via alpha pulse
  scene.tweens.add({
    targets: interiorGlow,
    alpha: { from: 0.02, to: 0.08 },
    duration: 3000,
    yoyo: true,
    repeat: -1,
  });

  // --- Label ---
  const arcadeLabel = scene.add.text(arcadeX, arcadeY + Math.round(8 * SCALE), "ARCADE", {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${Math.round(7 * SCALE)}px`,
    color: "#4ade80",
    stroke: "#0a0a0f",
    strokeThickness: Math.round(2 * SCALE),
    align: "center",
  });
  arcadeLabel.setOrigin(0.5, 0);
  arcadeLabel.setDepth(11);
  scene.trendingElements.push(arcadeLabel);

  scene.tweens.add({
    targets: arcadeLabel,
    alpha: { from: 0.6, to: 1.0 },
    duration: 800,
    yoyo: true,
    repeat: -1,
  });

  arcadeBuilding.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    window.dispatchEvent(new CustomEvent("bagsworld-arcade-click"));
  });

  // Add moving traffic
  createMovingTraffic(scene);
}

function createCrosswalk(scene: WorldScene, x: number, y: number): void {
  // Create crosswalk stripes (scaled spacing and dimensions)
  for (let i = Math.round(-25 * SCALE); i <= Math.round(25 * SCALE); i += Math.round(10 * SCALE)) {
    const stripe = scene.add.rectangle(
      x + i,
      y,
      Math.round(6 * SCALE),
      Math.round(30 * SCALE),
      0xffffff,
      0.9
    );
    stripe.setDepth(2);
    scene.trendingElements.push(stripe);
  }
}

function createMovingTraffic(scene: WorldScene): void {
  // Clear any existing traffic timers to prevent leaks
  clearTrafficTimers(scene);

  // Taxi driving right (scaled)
  const movingTaxi = scene.add.sprite(Math.round(-60 * SCALE), Math.round(585 * SCALE), "taxi");
  movingTaxi.setDepth(3);
  movingTaxi.setFlipX(true);
  scene.trendingElements.push(movingTaxi);

  // Use looping timer events instead of recursive delayedCall chains
  const taxiTimer = scene.time.addEvent({
    delay: 10000, // Total cycle: 6000ms drive + 4000ms wait
    callback: () => {
      if (scene.currentZone !== "trending" || !movingTaxi.active) return;
      movingTaxi.setX(Math.round(-60 * SCALE));
      scene.tweens.add({
        targets: movingTaxi,
        x: GAME_WIDTH + Math.round(60 * SCALE),
        duration: 6000,
        ease: "Linear",
      });
    },
    loop: true,
    startAt: 9000, // Start almost immediately (first drive after 1000ms)
  });
  scene.trafficTimers.push(taxiTimer);

  // Initial taxi animation
  scene.time.delayedCall(1000, () => {
    if (scene.currentZone !== "trending" || !movingTaxi.active) return;
    scene.tweens.add({
      targets: movingTaxi,
      x: GAME_WIDTH + Math.round(60 * SCALE),
      duration: 6000,
      ease: "Linear",
    });
  });

  // Blue car driving left (scaled)
  const movingCar = scene.add.sprite(
    GAME_WIDTH + Math.round(60 * SCALE),
    Math.round(565 * SCALE),
    "car_blue"
  );
  movingCar.setDepth(3);
  scene.trendingElements.push(movingCar);

  // Use looping timer events instead of recursive delayedCall chains
  const carTimer = scene.time.addEvent({
    delay: 12000, // Total cycle: 7000ms drive + 5000ms wait
    callback: () => {
      if (scene.currentZone !== "trending" || !movingCar.active) return;
      movingCar.setX(GAME_WIDTH + Math.round(60 * SCALE));
      scene.tweens.add({
        targets: movingCar,
        x: Math.round(-60 * SCALE),
        duration: 7000,
        ease: "Linear",
      });
    },
    loop: true,
    startAt: 9000, // Start almost immediately (first drive after 3000ms)
  });
  scene.trafficTimers.push(carTimer);

  // Initial car animation
  scene.time.delayedCall(3000, () => {
    if (scene.currentZone !== "trending" || !movingCar.active) return;
    scene.tweens.add({
      targets: movingCar,
      x: Math.round(-60 * SCALE),
      duration: 7000,
      ease: "Linear",
    });
  });
}

export function clearTrafficTimers(scene: WorldScene): void {
  scene.trafficTimers.forEach((timer) => {
    if (timer && timer.destroy) {
      timer.destroy();
    }
  });
  scene.trafficTimers = [];
}

function createTrendingBillboards(scene: WorldScene): void {
  // Use actual game width so billboards stay on-screen on mobile (960px)
  const effectiveWidth = scene.isMobile ? (scene.sys.game.config.width as number) : GAME_WIDTH;

  // Main central billboard - custom styled container (scaled)
  const billboardX = Math.round(effectiveWidth / 2);
  const billboardY = Math.round(150 * SCALE);
  const billboardWidth = Math.round(160 * SCALE);
  const billboardHeight = Math.round(90 * SCALE);

  // Billboard frame (dark background with border)
  const billboardFrame = scene.add.rectangle(
    billboardX,
    billboardY,
    billboardWidth + Math.round(6 * SCALE),
    billboardHeight + Math.round(6 * SCALE),
    0x1a1a1a
  );
  billboardFrame.setStrokeStyle(Math.round(2 * SCALE), 0xfbbf24);
  billboardFrame.setDepth(5);
  scene.trendingElements.push(billboardFrame);

  // Inner billboard background
  const billboardBg = scene.add.rectangle(
    billboardX,
    billboardY,
    billboardWidth,
    billboardHeight,
    0x0d0d0d
  );
  billboardBg.setDepth(5);
  scene.trendingElements.push(billboardBg);

  // HOT TOKENS header bar
  const headerBar = scene.add.rectangle(
    billboardX,
    billboardY - Math.round(30 * SCALE),
    billboardWidth,
    Math.round(22 * SCALE),
    0xfbbf24
  );
  headerBar.setDepth(6);
  scene.trendingElements.push(headerBar);

  // Billboard title text (scaled font)
  const billboardTitle = scene.add.text(
    billboardX,
    billboardY - Math.round(30 * SCALE),
    "HOT TOKENS",
    {
      fontFamily: "monospace",
      fontSize: `${Math.round(12 * SCALE)}px`,
      color: "#0d0d0d",
      fontStyle: "bold",
    }
  );
  billboardTitle.setOrigin(0.5, 0.5);
  billboardTitle.setDepth(7);
  scene.billboardTexts.push(billboardTitle);

  // Stats display (centered in billboard, scaled font)
  const statsText = scene.add.text(billboardX, billboardY, "LOADING...", {
    fontFamily: "monospace",
    fontSize: `${Math.round(11 * SCALE)}px`,
    color: "#4ade80",
  });
  statsText.setOrigin(0.5, 0.5);
  statsText.setDepth(6);
  scene.billboardTexts.push(statsText);

  // Volume display (below stats, scaled font)
  const volumeText = scene.add.text(
    billboardX,
    billboardY + Math.round(25 * SCALE),
    "24H VOL: ...",
    {
      fontFamily: "monospace",
      fontSize: `${Math.round(10 * SCALE)}px`,
      color: "#60a5fa",
    }
  );
  volumeText.setOrigin(0.5, 0.5);
  volumeText.setDepth(6);
  scene.billboardTexts.push(volumeText);

  // Side billboards - styled containers (scaled)
  const sideBillboardWidth = Math.round(100 * SCALE);
  const sideBillboardHeight = Math.round(60 * SCALE);
  const leftX = Math.round(effectiveWidth * 0.16);
  const rightX = Math.round(effectiveWidth * 0.84);
  const sideY = Math.round(320 * SCALE);
  const sideHeaderY = Math.round(300 * SCALE);
  const sideTextY = Math.round(328 * SCALE);

  // Left billboard - TOP GAINER
  const leftFrame = scene.add.rectangle(
    leftX,
    sideY,
    sideBillboardWidth + Math.round(4 * SCALE),
    sideBillboardHeight + Math.round(4 * SCALE),
    0x1a1a1a
  );
  leftFrame.setStrokeStyle(Math.round(2 * SCALE), 0x4ade80);
  leftFrame.setDepth(5);
  scene.trendingElements.push(leftFrame);

  const leftBg = scene.add.rectangle(
    leftX,
    sideY,
    sideBillboardWidth,
    sideBillboardHeight,
    0x0d0d0d
  );
  leftBg.setDepth(5);
  scene.trendingElements.push(leftBg);

  const leftHeader = scene.add.rectangle(
    leftX,
    sideHeaderY,
    sideBillboardWidth,
    Math.round(16 * SCALE),
    0x4ade80
  );
  leftHeader.setDepth(6);
  scene.trendingElements.push(leftHeader);

  const leftTitle = scene.add.text(leftX, sideHeaderY, "TOP GAINER", {
    fontFamily: "monospace",
    fontSize: `${Math.round(8 * SCALE)}px`,
    color: "#0d0d0d",
    fontStyle: "bold",
  });
  leftTitle.setOrigin(0.5, 0.5);
  leftTitle.setDepth(7);
  scene.billboardTexts.push(leftTitle);

  const leftText = scene.add.text(leftX, sideTextY, "---", {
    fontFamily: "monospace",
    fontSize: `${Math.round(9 * SCALE)}px`,
    color: "#4ade80",
    align: "center",
    wordWrap: { width: sideBillboardWidth - Math.round(10 * SCALE) },
  });
  leftText.setOrigin(0.5, 0.5);
  leftText.setDepth(6);
  scene.billboardTexts.push(leftText);

  // Right billboard - VOLUME KING
  const rightFrame = scene.add.rectangle(
    rightX,
    sideY,
    sideBillboardWidth + Math.round(4 * SCALE),
    sideBillboardHeight + Math.round(4 * SCALE),
    0x1a1a1a
  );
  rightFrame.setStrokeStyle(Math.round(2 * SCALE), 0xec4899);
  rightFrame.setDepth(5);
  scene.trendingElements.push(rightFrame);

  const rightBg = scene.add.rectangle(
    rightX,
    sideY,
    sideBillboardWidth,
    sideBillboardHeight,
    0x0d0d0d
  );
  rightBg.setDepth(5);
  scene.trendingElements.push(rightBg);

  const rightHeader = scene.add.rectangle(
    rightX,
    sideHeaderY,
    sideBillboardWidth,
    Math.round(16 * SCALE),
    0xec4899
  );
  rightHeader.setDepth(6);
  scene.trendingElements.push(rightHeader);

  const rightTitle = scene.add.text(rightX, sideHeaderY, "VOLUME KING", {
    fontFamily: "monospace",
    fontSize: `${Math.round(8 * SCALE)}px`,
    color: "#0d0d0d",
    fontStyle: "bold",
  });
  rightTitle.setOrigin(0.5, 0.5);
  rightTitle.setDepth(7);
  scene.billboardTexts.push(rightTitle);

  const rightText = scene.add.text(rightX, sideTextY, "---", {
    fontFamily: "monospace",
    fontSize: `${Math.round(9 * SCALE)}px`,
    color: "#ec4899",
    align: "center",
    wordWrap: { width: sideBillboardWidth - Math.round(10 * SCALE) },
  });
  rightText.setOrigin(0.5, 0.5);
  rightText.setDepth(6);
  scene.billboardTexts.push(rightText);

  // Update billboard data periodically (store reference for cleanup)
  if (scene.billboardTimer) {
    scene.billboardTimer.destroy();
  }
  scene.billboardTimer = scene.time.addEvent({
    delay: 5000,
    callback: () => updateBillboardData(scene),
    loop: true,
  });

  // Initial update
  updateBillboardData(scene);
}

function createTrendingTicker(scene: WorldScene): void {
  // Ticker display bar at very bottom of screen (scaled)
  const tickerY = Math.round(592 * SCALE);

  // Dark background bar for ticker
  const tickerBg = scene.add.rectangle(
    GAME_WIDTH / 2,
    tickerY,
    GAME_WIDTH,
    Math.round(16 * SCALE),
    0x0a0a0f
  );
  tickerBg.setDepth(10);
  scene.trendingElements.push(tickerBg);

  // Subtle top border
  const tickerBorder = scene.add.rectangle(
    GAME_WIDTH / 2,
    tickerY - Math.round(8 * SCALE),
    GAME_WIDTH,
    Math.round(1 * SCALE),
    0x374151
  );
  tickerBorder.setDepth(10);
  scene.trendingElements.push(tickerBorder);

  // Create mask for ticker text (scaled)
  const maskShape = scene.make.graphics({});
  maskShape.fillStyle(0xffffff);
  maskShape.fillRect(0, tickerY - Math.round(8 * SCALE), GAME_WIDTH, Math.round(16 * SCALE));
  const mask = maskShape.createGeometryMask();

  // Ticker text (scaled font)
  scene.tickerText = scene.add.text(GAME_WIDTH, tickerY, getTickerContent(scene), {
    fontFamily: "monospace",
    fontSize: `${Math.round(10 * SCALE)}px`,
    color: "#4ade80",
  });
  scene.tickerText.setOrigin(0, 0.5);
  scene.tickerText.setDepth(11);
  scene.tickerText.setMask(mask);
}

function getTickerContent(scene: WorldScene): string {
  // Return cached content if worldState hasn't changed
  if (
    scene.cachedTickerContent !== null &&
    scene.tickerWorldStateVersion === scene.worldStateVersion
  ) {
    return scene.cachedTickerContent;
  }

  // Generate ticker content from world state
  const content: string[] = [">>> BAGSWORLD CITY <<<"];

  if (scene.worldState) {
    const buildings = scene.worldState.buildings || [];
    // Sort by volume to show most active (exclude landmarks which have no real market data)
    const sorted = [...buildings]
      .filter((b) => !b.isPermanent)
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    sorted.slice(0, 5).forEach((b) => {
      const change = b.change24h
        ? b.change24h > 0
          ? `+${b.change24h.toFixed(1)}%`
          : `${b.change24h.toFixed(1)}%`
        : "";
      content.push(`${b.symbol}: $${formatNumber(b.marketCap || 0)} ${change}`);
    });
  }

  content.push(">>> BAGS.FM <<<");

  scene.cachedTickerContent = content.join("   |   ");
  scene.tickerWorldStateVersion = scene.worldStateVersion;
  return scene.cachedTickerContent;
}

function updateTicker(scene: WorldScene): void {
  if (!scene.tickerText || scene.currentZone !== "trending") return;

  scene.tickerOffset -= Math.round(2 * SCALE);
  scene.tickerText.setX(GAME_WIDTH + scene.tickerOffset);

  // Reset when fully scrolled (scaled offset)
  if (scene.tickerOffset < -scene.tickerText.width - Math.round(100 * SCALE)) {
    scene.tickerOffset = 0;
    scene.tickerText.setText(getTickerContent(scene));
  }
}

function updateBillboardData(scene: WorldScene): void {
  if (scene.currentZone !== "trending" || !scene.worldState) return;

  const buildings = scene.worldState.buildings || [];

  // Billboard text indices:
  // [0] = HOT TOKENS title (static)
  // [1] = stats text (main billboard)
  // [2] = volume text (main billboard)
  // [3] = TOP GAINER title (static)
  // [4] = left content
  // [5] = VOLUME KING title (static)
  // [6] = right content

  // Update main billboard stats
  if (scene.billboardTexts.length >= 3) {
    scene.billboardTexts[1].setText(`${buildings.length} ACTIVE TOKENS`);

    const totalVolume = buildings.reduce((sum, b) => sum + (b.volume24h || 0), 0);
    scene.billboardTexts[2].setText(`24H VOL: $${formatNumber(totalVolume)}`);
  }

  // Update side billboards content (skip title texts at indices 3 and 5)
  if (scene.billboardTexts.length >= 7) {
    // Top gainer by price change
    const byGain = [...buildings].sort((a, b) => (b.change24h || 0) - (a.change24h || 0));
    if (byGain.length > 0 && byGain[0].change24h) {
      const sym = byGain[0].symbol.length > 6 ? byGain[0].symbol.substring(0, 6) : byGain[0].symbol;
      scene.billboardTexts[4].setText(`$${sym}\n+${byGain[0].change24h.toFixed(1)}%`);
    } else {
      scene.billboardTexts[4].setText("---");
    }

    // Volume king - highest 24h volume
    const byVolume = [...buildings].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    if (byVolume.length > 0 && byVolume[0].volume24h) {
      const volSym =
        byVolume[0].symbol.length > 6 ? byVolume[0].symbol.substring(0, 6) : byVolume[0].symbol;
      scene.billboardTexts[6].setText(`$${volSym}\n$${formatNumber(byVolume[0].volume24h || 0)}`);
    } else {
      scene.billboardTexts[6].setText("---");
    }
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toFixed(0);
}
