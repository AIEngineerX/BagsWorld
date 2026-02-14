import type { WorldScene } from "../scenes/WorldScene";
import { SCALE, DEPTH, Y } from "../textures/constants";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 960;

// ============================================================================
// ASCENSION ZONE — Celestial spire where AI agents prove their worth
// ============================================================================

// ============================================================================
// ENTRY POINTS
// ============================================================================

export function setupAscensionZone(scene: WorldScene): void {
  createAscensionSky(scene);

  // Hide the ground tile, path, and transition — buildings float on cloud platforms
  scene.ground.setVisible(false);
  if (scene.groundPath) scene.groundPath.setVisible(false);
  if (scene.groundTransition) scene.groundTransition.setVisible(false);

  // Reset if elements were destroyed during zone transitions
  const elementsValid =
    scene.ascensionElements.length > 0 &&
    scene.ascensionElements.every((el) => (el as any).active !== false);

  if (!elementsValid && scene.ascensionZoneCreated) {
    scene.ascensionElements = [];
    scene.ascensionZoneCreated = false;
  }

  if (!scene.ascensionZoneCreated) {
    createAscensionDecorations(scene);
    scene.ascensionZoneCreated = true;
  } else {
    scene.ascensionElements.forEach((el) => (el as any).setVisible(true));
  }
}

export function disconnectAscension(_scene: WorldScene): void {
  // Placeholder for future ElizaOS agent cleanup
}

// ============================================================================
// SKY — Celestial golden-hour realm above the clouds
// ============================================================================

function createAscensionSky(scene: WorldScene): void {
  scene.restoreNormalSky();

  if (scene.skyGradient) {
    scene.skyGradient.setVisible(false);
  }
  scene.stars.forEach((star) => star.setVisible(false));
  scene.distantSkylineGfx.forEach((g) => g.setVisible(false));
  scene.skyClouds.forEach((c) => c.setVisible(false));
  if (scene.treeline) scene.treeline.setVisible(false);

  const s = SCALE;
  const fullH = GAME_HEIGHT; // Full canvas height (unscaled, matches Phaser config)

  // Create celestial gradient sky at depth -2
  if (!scene.ascensionCelestialSky) {
    scene.ascensionCelestialSky = scene.add.graphics();
    scene.ascensionCelestialSky.setDepth(-2);
  }
  scene.ascensionCelestialSky.clear();

  // Color stops: deep celestial purple top -> warm golden middle -> soft cream haze bottom
  const bandCount = 32;
  const bandH = Math.ceil(fullH / bandCount);

  const colorStops = [
    { pos: 0.0, color: 0x1a0033 }, // deep celestial purple
    { pos: 0.12, color: 0x1a0033 },
    { pos: 0.22, color: 0x2a0a4a }, // dark indigo
    { pos: 0.35, color: 0x4a1a6a }, // violet transition
    { pos: 0.45, color: 0x8a4020 }, // warm brown-amber
    { pos: 0.55, color: 0xcc8833 }, // golden glow
    { pos: 0.65, color: 0xddaa44 }, // warm gold
    { pos: 0.78, color: 0xeec866 }, // light gold
    { pos: 0.88, color: 0xf5e0a0 }, // pale gold-cream
    { pos: 1.0, color: 0xfff8e8 }, // soft white/cream haze
  ];

  const lerpColor = (c1: number, c2: number, t: number): number => {
    const r1 = (c1 >> 16) & 0xff,
      g1 = (c1 >> 8) & 0xff,
      b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff,
      g2 = (c2 >> 8) & 0xff,
      b2 = c2 & 0xff;
    const ri = Math.round(r1 + (r2 - r1) * t);
    const gi = Math.round(g1 + (g2 - g1) * t);
    const bi = Math.round(b1 + (b2 - b1) * t);
    return (ri << 16) | (gi << 8) | bi;
  };

  const getColor = (pos: number): number => {
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (pos >= colorStops[i].pos && pos <= colorStops[i + 1].pos) {
        const t = (pos - colorStops[i].pos) / (colorStops[i + 1].pos - colorStops[i].pos);
        return lerpColor(colorStops[i].color, colorStops[i + 1].color, t);
      }
    }
    return colorStops[colorStops.length - 1].color;
  };

  for (let i = 0; i < bandCount; i++) {
    const pos = i / bandCount;
    const color = getColor(pos);
    scene.ascensionCelestialSky.fillStyle(color, 1);
    scene.ascensionCelestialSky.fillRect(0, i * bandH, GAME_WIDTH, bandH + 1);

    // Pixel-art dithering between bands
    if (i > 2 && i < bandCount - 2) {
      const nextColor = getColor((i + 1) / bandCount);
      const ditherColor = lerpColor(color, nextColor, 0.5);
      scene.ascensionCelestialSky.fillStyle(ditherColor, 0.3);
      for (let dx = 0; dx < GAME_WIDTH; dx += 6) {
        if ((dx + i) % 3 === 0) {
          scene.ascensionCelestialSky.fillRect(dx, i * bandH + bandH - 2, 2, 2);
        }
      }
    }
  }

  scene.ascensionCelestialSky.setVisible(true);

  // If sky elements already exist, just show them
  if (scene.ascensionSkyElements.length > 0) {
    scene.ascensionSkyElements.forEach((el) => (el as any).setVisible(true));
    return;
  }

  const r = (n: number) => Math.round(n * s);

  // === 1. God rays — golden diagonal beams from upper portion ===
  const godRayConfigs = [
    {
      startX: 200,
      angle: 12,
      steps: 18,
      stepW: 10,
      stepH: 28,
      color: 0xffd700,
      alphaRange: [0.2, 0.5],
      dur: 6000,
    },
    {
      startX: 450,
      angle: 8,
      steps: 16,
      stepW: 8,
      stepH: 24,
      color: 0xf5c842,
      alphaRange: [0.2, 0.55],
      dur: 7000,
    },
    {
      startX: 680,
      angle: 14,
      steps: 20,
      stepW: 9,
      stepH: 26,
      color: 0xfff5d6,
      alphaRange: [0.2, 0.5],
      dur: 5500,
    },
    {
      startX: 900,
      angle: 10,
      steps: 14,
      stepW: 7,
      stepH: 22,
      color: 0xffd700,
      alphaRange: [0.2, 0.45],
      dur: 8000,
    },
    {
      startX: 1050,
      angle: 11,
      steps: 15,
      stepW: 8,
      stepH: 25,
      color: 0xf5c842,
      alphaRange: [0.2, 0.5],
      dur: 6500,
    },
  ];

  godRayConfigs.forEach((cfg, idx) => {
    const rayGfx = scene.add.graphics();
    rayGfx.setDepth(-1);
    rayGfx.fillStyle(cfg.color, 0.04);
    for (let step = 0; step < cfg.steps; step++) {
      rayGfx.fillRect(cfg.startX + step * cfg.angle, step * cfg.stepH, cfg.stepW, cfg.stepH + 2);
    }
    rayGfx.setAlpha(cfg.alphaRange[0]);
    scene.ascensionSkyElements.push(rayGfx);

    scene.tweens.add({
      targets: rayGfx,
      alpha: { from: cfg.alphaRange[0], to: cfg.alphaRange[1] },
      duration: cfg.dur,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: idx * 1200,
    });
  });

  // === 2. Background cloud layer — distant wispy ellipses ===
  const bgClouds = [
    { x: 100, y: 180, w: 220, h: 18 },
    { x: 350, y: 220, w: 180, h: 14 },
    { x: 600, y: 160, w: 250, h: 20 },
    { x: 850, y: 240, w: 200, h: 16 },
    { x: 200, y: 280, w: 160, h: 12 },
    { x: 1000, y: 200, w: 190, h: 15 },
    { x: 500, y: 300, w: 170, h: 13 },
  ];

  bgClouds.forEach((cloud) => {
    const c = scene.add.ellipse(
      cloud.x + cloud.w / 2,
      cloud.y,
      cloud.w,
      cloud.h,
      0xffffff,
      0.06 + Math.random() * 0.04
    );
    c.setDepth(-1);
    scene.ascensionSkyElements.push(c);

    scene.tweens.add({
      targets: c,
      x: c.x + 30 + Math.random() * 20,
      duration: 20000 + Math.random() * 10000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 5000,
    });
  });

  // === 3. Midground cloud banks — moderate opacity with pale gold highlights ===
  const midClouds = [
    { x: 80, y: 350, w: 260, h: 22 },
    { x: 380, y: 380, w: 220, h: 18 },
    { x: 650, y: 340, w: 240, h: 20 },
    { x: 950, y: 370, w: 200, h: 16 },
    { x: 200, y: 400, w: 180, h: 14 },
    { x: 750, y: 410, w: 210, h: 17 },
  ];

  midClouds.forEach((cloud) => {
    // Main cloud body
    const body = scene.add.ellipse(
      cloud.x + cloud.w / 2,
      cloud.y,
      cloud.w,
      cloud.h,
      0xffffff,
      0.12 + Math.random() * 0.06
    );
    body.setDepth(-1);
    scene.ascensionSkyElements.push(body);

    // Pale gold highlight on top
    const highlight = scene.add.ellipse(
      cloud.x + cloud.w / 2 - cloud.w * 0.1,
      cloud.y - cloud.h * 0.2,
      cloud.w * 0.7,
      cloud.h * 0.5,
      0xfde68a,
      0.08
    );
    highlight.setDepth(-1);
    scene.ascensionSkyElements.push(highlight);

    const drift = 15 + Math.random() * 15;
    const dur = 12000 + Math.random() * 6000;

    scene.tweens.add({
      targets: [body, highlight],
      x: `+=${drift}`,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 4000,
    });
  });
}

// ============================================================================
// DECORATIONS — Floating cloud platforms, buildings, ambient elements
// ============================================================================

function createAscensionDecorations(scene: WorldScene): void {
  const s = SCALE;
  const r = (n: number) => Math.round(n * s);
  const pathLevel = Y.PATH_LEVEL;
  const centerX = GAME_WIDTH / 2;

  // --- Solid cloud base: wide opaque band that creates the "floor" boundary ---
  const cloudBaseGfx = scene.add.graphics();
  cloudBaseGfx.setDepth(DEPTH.GROUND);
  // Main solid white band from y~520 down to bottom of canvas
  cloudBaseGfx.fillStyle(0xfff8e8, 0.85);
  cloudBaseGfx.fillRect(0, r(520), GAME_WIDTH, r(440));
  // Softer transition band above
  cloudBaseGfx.fillStyle(0xfff8e8, 0.5);
  cloudBaseGfx.fillRect(0, r(490), GAME_WIDTH, r(35));
  cloudBaseGfx.fillStyle(0xfff8e8, 0.25);
  cloudBaseGfx.fillRect(0, r(470), GAME_WIDTH, r(25));
  scene.ascensionElements.push(cloudBaseGfx);

  // --- Individual cloud puffs on top of the base for fluffy texture ---
  const cloudFloorData = [
    // Upper cloud bank (the visible fluffy edge)
    { x: -40, y: 460, w: 320, h: 50, color: 0xffffff, alpha: 0.7 },
    { x: 200, y: 475, w: 300, h: 45, color: 0xfde68a, alpha: 0.5 },
    { x: 430, y: 455, w: 280, h: 48, color: 0xffffff, alpha: 0.65 },
    { x: 650, y: 470, w: 310, h: 46, color: 0xffffff, alpha: 0.7 },
    { x: 880, y: 458, w: 270, h: 50, color: 0xfde68a, alpha: 0.55 },
    { x: 1080, y: 465, w: 220, h: 44, color: 0xffffff, alpha: 0.65 },
    // Mid puffs (filling gaps, slightly below)
    { x: 80, y: 500, w: 240, h: 36, color: 0xffffff, alpha: 0.6 },
    { x: 340, y: 510, w: 260, h: 34, color: 0xfde68a, alpha: 0.45 },
    { x: 560, y: 505, w: 220, h: 38, color: 0xffffff, alpha: 0.55 },
    { x: 770, y: 515, w: 250, h: 32, color: 0xffc0cb, alpha: 0.4 },
    { x: 980, y: 498, w: 200, h: 36, color: 0xffffff, alpha: 0.6 },
    // Small highlight puffs (golden tint)
    { x: 150, y: 480, w: 120, h: 24, color: 0xffd700, alpha: 0.2 },
    { x: 500, y: 485, w: 140, h: 22, color: 0xffd700, alpha: 0.18 },
    { x: 820, y: 478, w: 130, h: 26, color: 0xffd700, alpha: 0.22 },
    { x: 1100, y: 490, w: 100, h: 20, color: 0xffd700, alpha: 0.2 },
  ];

  cloudFloorData.forEach((cf) => {
    const cloud = scene.add.ellipse(
      r(cf.x + cf.w / 2),
      r(cf.y),
      r(cf.w),
      r(cf.h),
      cf.color,
      cf.alpha
    );
    cloud.setDepth(DEPTH.PROPS_LOW);
    scene.ascensionElements.push(cloud);

    if (Math.random() > 0.4) {
      scene.tweens.add({
        targets: cloud,
        x: cloud.x + r(10 + Math.random() * 15),
        duration: 8000 + Math.random() * 7000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Math.random() * 3000,
      });
    }
  });

  const buildingDefs = [
    {
      key: "observatory",
      texture: "ascension_observatory",
      x: 160,
      y: 535,
      scale: 1.15,
      cloudW: 160,
      glowColor: 0xb8e6f0,
      glowAlpha: 0.12,
      glowW: 160,
      glowH: 140,
    },
    {
      key: "temple",
      texture: "ascension_temple",
      x: 440,
      y: 530,
      scale: 1.3,
      cloudW: 200,
      glowColor: 0xffd700,
      glowAlpha: 0.15,
      glowW: 240,
      glowH: 180,
    },
    {
      key: "vault",
      texture: "ascension_vault",
      x: 720,
      y: 535,
      scale: 1.15,
      cloudW: 170,
      glowColor: 0xffd700,
      glowAlpha: 0.12,
      glowW: 180,
      glowH: 130,
    },
    {
      key: "shrine",
      texture: "ascension_token_shrine",
      x: 1000,
      y: 540,
      scale: 1.1,
      cloudW: 140,
      glowColor: 0xa855f7,
      glowAlpha: 0.1,
      glowW: 140,
      glowH: 110,
    },
  ];

  buildingDefs.forEach((def, idx) => {
    const bx = r(def.x);
    const by = r(def.y);
    const bobDelay = 500 + idx * 600 + Math.random() * 800;
    const bobDuration = 3200 + Math.random() * 800;

    // --- Cloud platform (2-3 overlapping ellipses) ---
    const cloudParts: Phaser.GameObjects.Ellipse[] = [];

    // Main cloud body
    const mainCloud = scene.add.ellipse(bx, by + r(10), r(def.cloudW), r(30), 0xffffff, 0.55);
    mainCloud.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(mainCloud);
    cloudParts.push(mainCloud);

    // Secondary cloud offset
    const secCloud = scene.add.ellipse(
      bx + r(def.cloudW * 0.15),
      by + r(14),
      r(def.cloudW * 0.7),
      r(22),
      0xfde68a,
      0.35
    );
    secCloud.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(secCloud);
    cloudParts.push(secCloud);

    // Third cloud puff (slightly below)
    const thirdCloud = scene.add.ellipse(
      bx - r(def.cloudW * 0.12),
      by + r(16),
      r(def.cloudW * 0.6),
      r(18),
      0xffffff,
      0.4
    );
    thirdCloud.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(thirdCloud);
    cloudParts.push(thirdCloud);

    // Golden glow underneath
    const underGlow = scene.add.ellipse(bx, by + r(20), r(def.cloudW + 40), r(24), 0xffd700, 0.07);
    underGlow.setDepth(DEPTH.PROPS_LOW);
    scene.ascensionElements.push(underGlow);

    // --- Luminous glow aura behind building ---
    if (def.glowColor) {
      const glow = scene.add.ellipse(
        bx,
        by - r(40),
        r(def.glowW),
        r(def.glowH),
        def.glowColor,
        def.glowAlpha
      );
      glow.setDepth(DEPTH.PROPS_HIGH);
      scene.ascensionElements.push(glow);

      scene.tweens.add({
        targets: glow,
        alpha: def.glowAlpha * 0.5,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 3000 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // --- Building sprite ---
    const building = scene.add.sprite(bx, by, def.texture);
    building.setOrigin(0.5, 1);
    building.setDepth(DEPTH.BUILDINGS);
    if (def.scale !== 1) building.setScale(def.scale);
    scene.ascensionElements.push(building);

    // --- Bob animation: everything bobs together ---
    const bobTargets = [...cloudParts, underGlow, building];
    scene.tweens.add({
      targets: bobTargets,
      y: `-=${r(4)}`,
      duration: bobDuration,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: bobDelay,
    });
  });

  const templeX = r(440);
  const templeTopY = r(420);

  // Wide outer glow beam
  const beamGlow = scene.add.rectangle(templeX, templeTopY - r(160), r(20), r(320), 0xffd700, 0.08);
  beamGlow.setDepth(DEPTH.PROPS_HIGH);
  scene.ascensionElements.push(beamGlow);

  // Core beam (brighter, narrower)
  const beam = scene.add.rectangle(templeX, templeTopY - r(160), r(6), r(320), 0xffd700, 0.5);
  beam.setDepth(DEPTH.UI_LOW);
  scene.ascensionElements.push(beam);

  // Inner bright core
  const beamCore = scene.add.rectangle(templeX, templeTopY - r(160), r(2), r(320), 0xfffef5, 0.6);
  beamCore.setDepth(DEPTH.UI_LOW);
  scene.ascensionElements.push(beamCore);

  scene.tweens.add({
    targets: [beam, beamGlow, beamCore],
    alpha: `-=0.15`,
    duration: 2500,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  const stonePositions = [
    { x: 280, y: 530 },
    { x: 340, y: 525 },
    { x: 400, y: 535 },
    { x: 460, y: 528 },
    { x: 560, y: 532 },
    { x: 720, y: 538 },
    { x: 780, y: 526 },
    { x: 200, y: 540 },
    { x: 850, y: 534 },
    { x: 100, y: 542 },
  ];

  stonePositions.forEach((pos) => {
    const stoneW = r(20 + Math.random() * 15);
    const stoneH = r(8 + Math.random() * 4);
    const stone = scene.add.ellipse(
      r(pos.x),
      r(pos.y),
      stoneW,
      stoneH,
      0xffffff,
      0.4 + Math.random() * 0.2
    );
    stone.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(stone);

    scene.tweens.add({
      targets: stone,
      y: stone.y - r(2 + Math.random() * 2),
      duration: 2500 + Math.random() * 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 2000,
    });
  });

  const lanternPositions = [
    { x: 250, y: 500 },
    { x: 380, y: 490 },
    { x: 500, y: 505 },
    { x: 700, y: 495 },
    { x: 820, y: 510 },
    { x: 130, y: 508 },
  ];

  lanternPositions.forEach((pos) => {
    const lanternBody = scene.add.rectangle(r(pos.x), r(pos.y), r(4), r(6), 0xffd700, 0.8);
    lanternBody.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(lanternBody);

    const lanternGlow = scene.add.ellipse(r(pos.x), r(pos.y), r(12), r(8), 0xffd700, 0.1);
    lanternGlow.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(lanternGlow);

    scene.tweens.add({
      targets: [lanternBody, lanternGlow],
      alpha: { from: 0.5, to: 0.9 },
      duration: 2000 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 2000,
    });
  });

  const waterfallX = r(40);
  const waterfallStartY = r(440);

  for (let i = 0; i < 8; i++) {
    const droplet = scene.add.rectangle(
      waterfallX + r(Math.random() * 10 - 5),
      waterfallStartY + r(i * 10),
      r(3),
      r(5),
      0xffd700,
      0.6
    );
    droplet.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(droplet);

    const startY = droplet.y;
    const animateDroplet = () => {
      if (!(droplet as any).active) return;
      droplet.setPosition(waterfallX + r(Math.random() * 10 - 5), startY);
      droplet.setAlpha(0.6);
      scene.tweens.add({
        targets: droplet,
        y: startY + r(80),
        alpha: 0,
        duration: 1500 + Math.random() * 1000,
        ease: "Sine.easeIn",
        onComplete: animateDroplet,
      });
    };
    scene.time.delayedCall(i * 200 + Math.random() * 500, animateDroplet);
  }

  for (let i = 0; i < 30; i++) {
    const moteColors = [0xffd700, 0xf5c842, 0xfde68a, 0xfffef5];
    const moteColor = moteColors[Math.floor(Math.random() * moteColors.length)];
    const moteSize = r(1.5 + Math.random() * 2);
    const px = r(30 + Math.random() * 1220);
    const py = r(460 + Math.random() * 100);
    const mote = scene.add.rectangle(px, py, moteSize, moteSize, moteColor, 0.8);
    mote.setDepth(DEPTH.FLYING);
    scene.ascensionElements.push(mote);

    const animateMote = () => {
      if (!(mote as any).active) return;
      mote.setPosition(r(30 + Math.random() * 1220), r(460 + Math.random() * 100));
      mote.setAlpha(0.6 + Math.random() * 0.3);
      scene.tweens.add({
        targets: mote,
        y: mote.y - r(200 + Math.random() * 150),
        x: mote.x + r(Math.random() * 40 - 20), // Slight horizontal drift
        alpha: 0,
        duration: 3500 + Math.random() * 3000,
        ease: "Sine.easeIn",
        onComplete: animateMote,
      });
    };
    scene.time.delayedCall(Math.random() * 5000, animateMote);
  }

  for (let i = 0; i < 15; i++) {
    const sparkleSize = r(1 + Math.random());
    const sparkle = scene.add.rectangle(
      r(50 + Math.random() * 700),
      r(420 + Math.random() * 140),
      sparkleSize,
      sparkleSize,
      0xffffff,
      0
    );
    sparkle.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(sparkle);

    scene.tweens.add({
      targets: sparkle,
      alpha: { from: 0, to: 0.7 },
      duration: 2000 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 3000,
    });
  }

  const fgWispData = [
    { x: 100, y: 480, w: 80, h: 5 },
    { x: 350, y: 510, w: 100, h: 4 },
    { x: 600, y: 490, w: 70, h: 6 },
    { x: 850, y: 520, w: 90, h: 4 },
  ];

  fgWispData.forEach((wd) => {
    const fgWisp = scene.add.ellipse(
      r(wd.x),
      r(wd.y),
      r(wd.w),
      r(wd.h),
      0xffffff,
      0.12 + Math.random() * 0.08
    );
    fgWisp.setDepth(DEPTH.FLYING);
    scene.ascensionElements.push(fgWisp);

    scene.tweens.add({
      targets: fgWisp,
      x: fgWisp.x + r(40 + Math.random() * 30),
      duration: 15000 + Math.random() * 10000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 5000,
    });
  });
}
