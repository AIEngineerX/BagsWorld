import type { WorldScene } from "../scenes/WorldScene";
import { SCALE, DEPTH, Y } from "../textures/constants";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 960;

// ============================================================================
// ASCENSION ZONE — Celestial spire where AI agents prove their worth
// ============================================================================

// --- Tier Y positions (pre-multiplied by SCALE) ---
const TIER_Y: Record<string, number> = {
  diamond: Math.round(460 * SCALE),
  gold: Math.round(500 * SCALE),
  silver: Math.round(535 * SCALE),
  bronze: Math.round(565 * SCALE),
  none: Y.PATH_LEVEL,
};

// Tier thresholds for ascension trials
const TIER_THRESHOLDS: Record<string, number> = {
  none: 0,
  bronze: 100,
  silver: 300,
  gold: 600,
  diamond: 900,
};

const TIER_ORDER = ["none", "bronze", "silver", "gold", "diamond"];

const TIER_COLORS: Record<string, number> = {
  diamond: 0x7df9ff,
  gold: 0xffd700,
  silver: 0xc0c0c0,
  bronze: 0xcd7f32,
  none: 0x6b7280,
};

const TIER_COLOR_STRINGS: Record<string, string> = {
  diamond: "#7df9ff",
  gold: "#ffd700",
  silver: "#c0c0c0",
  bronze: "#cd7f32",
  none: "#6b7280",
};

// --- Agent tracking ---
interface AscensionAgent {
  wallet: string;
  name: string;
  reputationScore: number;
  reputationTier: string;
  sprite: Phaser.GameObjects.Sprite;
  nameLabel: Phaser.GameObjects.Text;
  tierBadge: Phaser.GameObjects.Text;
  halo?: Phaser.GameObjects.Sprite | null;
  platformY: number;
  lastScore: number;
  blessedUntil: number;
}

// Module-level state
let ascensionAgents: Map<string, AscensionAgent> = new Map();
let blessCooldowns: Map<string, number> = new Map();
let lastSummonTime = 0;
let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let trialTimer: ReturnType<typeof setTimeout> | null = null;
let phaserPollingTimer: Phaser.Time.TimerEvent | null = null;
let phaserTrialTimer: Phaser.Time.TimerEvent | null = null;
let phaserCommentaryTimer: Phaser.Time.TimerEvent | null = null;
let leaderboardTexts: Phaser.GameObjects.Text[] = [];
let speechEventHandler: ((e: Event) => void) | null = null;

// ============================================================================
// ENTRY POINTS
// ============================================================================

export function setupAscensionZone(scene: WorldScene): void {
  createAscensionSky(scene);

  // Hide the ground tile, path, and transition — buildings float on cloud platforms
  scene.ground.setVisible(false);
  if (scene.groundPath) scene.groundPath.setVisible(false);
  if (scene.groundTransition) scene.groundTransition.setVisible(false);

  // Check if elements were destroyed during transitions
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

  startAscensionPolling(scene);
  initAscensionSpeechListeners(scene);
}

export function disconnectAscension(scene: WorldScene): void {
  // Stop polling timers
  if (phaserPollingTimer) {
    phaserPollingTimer.destroy();
    phaserPollingTimer = null;
  }
  if (phaserTrialTimer) {
    phaserTrialTimer.destroy();
    phaserTrialTimer = null;
  }
  if (phaserCommentaryTimer) {
    phaserCommentaryTimer.destroy();
    phaserCommentaryTimer = null;
  }
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
  if (trialTimer) {
    clearTimeout(trialTimer);
    trialTimer = null;
  }

  // Remove speech event listener
  if (speechEventHandler) {
    window.removeEventListener("bagsworld-character-speak", speechEventHandler);
    speechEventHandler = null;
  }
}

// ============================================================================
// SKY — Celestial golden-hour realm above the clouds
// ============================================================================

function createAscensionSky(scene: WorldScene): void {
  scene.restoreNormalSky();

  // Hide the normal sky — we are in a celestial realm above the clouds
  if (scene.skyGradient) {
    scene.skyGradient.setVisible(false);
  }
  // Hide normal stars — ascension has its own atmospheric particles
  if (scene.stars) {
    scene.stars.forEach((star) => star.setVisible(false));
  }

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
    { pos: 0.0, color: 0x1a0033 },  // deep celestial purple
    { pos: 0.12, color: 0x1a0033 },
    { pos: 0.22, color: 0x2a0a4a }, // dark indigo
    { pos: 0.35, color: 0x4a1a6a }, // violet transition
    { pos: 0.45, color: 0x8a4020 }, // warm brown-amber
    { pos: 0.55, color: 0xcc8833 }, // golden glow
    { pos: 0.65, color: 0xddaa44 }, // warm gold
    { pos: 0.78, color: 0xeec866 }, // light gold
    { pos: 0.88, color: 0xf5e0a0 }, // pale gold-cream
    { pos: 1.0, color: 0xfff8e8 },  // soft white/cream haze
  ];

  const lerpColor = (c1: number, c2: number, t: number): number => {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
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
    { startX: 200, angle: 12, steps: 18, stepW: 10, stepH: 28, color: 0xffd700, alphaRange: [0.2, 0.5], dur: 6000 },
    { startX: 450, angle: 8, steps: 16, stepW: 8, stepH: 24, color: 0xf5c842, alphaRange: [0.2, 0.55], dur: 7000 },
    { startX: 680, angle: 14, steps: 20, stepW: 9, stepH: 26, color: 0xfff5d6, alphaRange: [0.2, 0.5], dur: 5500 },
    { startX: 900, angle: 10, steps: 14, stepW: 7, stepH: 22, color: 0xffd700, alphaRange: [0.2, 0.45], dur: 8000 },
    { startX: 1050, angle: 11, steps: 15, stepW: 8, stepH: 25, color: 0xf5c842, alphaRange: [0.2, 0.5], dur: 6500 },
  ];

  godRayConfigs.forEach((cfg, idx) => {
    const rayGfx = scene.add.graphics();
    rayGfx.setDepth(-1);
    rayGfx.fillStyle(cfg.color, 0.04);
    for (let step = 0; step < cfg.steps; step++) {
      rayGfx.fillRect(
        cfg.startX + step * cfg.angle,
        step * cfg.stepH,
        cfg.stepW,
        cfg.stepH + 2
      );
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

  // ==========================================================================
  // CLOUD FLOOR — solid base + dense band of overlapping cloud puffs
  // ==========================================================================

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

    // Some clouds drift slowly
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

  // ==========================================================================
  // BUILDING DEFINITIONS — each with cloud platform position
  // ==========================================================================
  const buildingDefs = [
    {
      key: "temple",
      texture: "ascension_temple",
      x: 420,
      y: 530,
      labelText: "TEMPLE OF\nASCENSION",
      labelOffsetY: -110,
      fontSize: 8,
      scale: 1.3,
      interactive: true,
      cloudW: 200,
      glowColor: 0xffd700,
      glowAlpha: 0.15,
      glowW: 240,
      glowH: 180,
    },
    {
      key: "observatory",
      texture: "ascension_observatory",
      x: 120,
      y: 535,
      labelText: "CELESTIAL\nOBSERVATORY",
      labelOffsetY: -90,
      fontSize: 6,
      scale: 1.15,
      interactive: false,
      cloudW: 160,
      glowColor: 0xb8e6f0,
      glowAlpha: 0.12,
      glowW: 160,
      glowH: 140,
    },
    {
      key: "vault",
      texture: "ascension_vault",
      x: 900,
      y: 535,
      labelText: "ETHEREAL\nVAULT",
      labelOffsetY: -85,
      fontSize: 6,
      scale: 1.15,
      interactive: false,
      cloudW: 170,
      glowColor: 0xffd700,
      glowAlpha: 0.12,
      glowW: 180,
      glowH: 130,
    },
    {
      key: "shrine",
      texture: "ascension_token_shrine",
      x: 1100,
      y: 540,
      labelText: "TOKEN\nSHRINE",
      labelOffsetY: -75,
      fontSize: 6,
      scale: 1.1,
      interactive: false,
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
    const mainCloud = scene.add.ellipse(
      bx,
      by + r(10),
      r(def.cloudW),
      r(30),
      0xffffff,
      0.55
    );
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
    const underGlow = scene.add.ellipse(
      bx,
      by + r(20),
      r(def.cloudW + 40),
      r(24),
      0xffd700,
      0.07
    );
    underGlow.setDepth(DEPTH.PROPS_LOW);
    scene.ascensionElements.push(underGlow);

    // --- Luminous glow aura behind building ---
    if ((def as any).glowColor) {
      const glow = scene.add.ellipse(
        bx,
        by - r(40),
        r((def as any).glowW),
        r((def as any).glowH),
        (def as any).glowColor,
        (def as any).glowAlpha
      );
      glow.setDepth(DEPTH.PROPS_HIGH);
      scene.ascensionElements.push(glow);

      // Pulsing glow animation
      scene.tweens.add({
        targets: glow,
        alpha: (def as any).glowAlpha * 0.5,
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

    // --- Label ---
    const label = scene.add.text(
      bx,
      by + r(def.labelOffsetY),
      def.labelText,
      {
        fontFamily: "monospace",
        fontSize: `${r(def.fontSize)}px`,
        color: "#FFD700",
        align: "center",
        fontStyle: def.key === "temple" ? "bold" : undefined,
      }
    );
    label.setOrigin(0.5, 0.5);
    label.setDepth(DEPTH.SIGNS_TEXT);
    scene.ascensionElements.push(label);

    // --- Interactive (temple only) ---
    if (def.interactive) {
      building.setInteractive({ useHandCursor: true });
      building.on("pointerdown", () => {
        window.dispatchEvent(new CustomEvent("bagsworld-ascension-click"));
      });
      building.on("pointerover", () => building.setTint(0xffe8a0));
      building.on("pointerout", () => building.clearTint());
    }

    // --- Bob animation: everything bobs together ---
    const bobTargets = [
      ...cloudParts,
      underGlow,
      building,
      label,
    ];
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

  // ==========================================================================
  // TEMPLE SPECIAL EFFECTS — light beam + halo ring
  // ==========================================================================

  // Golden light beam shooting upward from temple
  const templeX = r(420); // Match temple position
  const templeTopY = r(420); // Approximate top of scaled temple

  // Wide outer glow beam
  const beamGlow = scene.add.rectangle(
    templeX,
    templeTopY - r(160),
    r(20),
    r(320),
    0xffd700,
    0.08
  );
  beamGlow.setDepth(DEPTH.PROPS_HIGH);
  scene.ascensionElements.push(beamGlow);

  // Core beam (brighter, narrower)
  const beam = scene.add.rectangle(
    templeX,
    templeTopY - r(160),
    r(6),
    r(320),
    0xffd700,
    0.5
  );
  beam.setDepth(DEPTH.UI_LOW);
  scene.ascensionElements.push(beam);

  // Inner bright core
  const beamCore = scene.add.rectangle(
    templeX,
    templeTopY - r(160),
    r(2),
    r(320),
    0xfffef5,
    0.6
  );
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

  // Pulsing halo ring around temple peak
  const haloGfx = scene.add.graphics();
  haloGfx.setDepth(DEPTH.UI_LOW);
  haloGfx.lineStyle(r(2), 0xffd700, 0.6);
  haloGfx.strokeCircle(templeX, templeTopY - r(10), r(40));
  // Outer faint halo
  haloGfx.lineStyle(r(1), 0xffd700, 0.2);
  haloGfx.strokeCircle(templeX, templeTopY - r(10), r(55));
  scene.ascensionElements.push(haloGfx);

  scene.tweens.add({
    targets: haloGfx,
    alpha: { from: 0.4, to: 0.8 },
    scaleX: { from: 1, to: 1.05 },
    scaleY: { from: 1, to: 1.05 },
    duration: 2500,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // ==========================================================================
  // FLOATING STEPPING STONES (10, between building platforms)
  // ==========================================================================
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

  // ==========================================================================
  // FLOATING LANTERNS (6, warm golden glows between buildings)
  // ==========================================================================
  const lanternPositions = [
    { x: 250, y: 500 },
    { x: 380, y: 490 },
    { x: 500, y: 505 },
    { x: 700, y: 495 },
    { x: 820, y: 510 },
    { x: 130, y: 508 },
  ];

  lanternPositions.forEach((pos) => {
    // Lantern body (small golden rectangle)
    const lanternBody = scene.add.rectangle(
      r(pos.x),
      r(pos.y),
      r(4),
      r(6),
      0xffd700,
      0.8
    );
    lanternBody.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(lanternBody);

    // Warm glow around lantern
    const lanternGlow = scene.add.ellipse(
      r(pos.x),
      r(pos.y),
      r(12),
      r(8),
      0xffd700,
      0.1
    );
    lanternGlow.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(lanternGlow);

    // Alpha pulse
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

  // ==========================================================================
  // LIGHT WATERFALL — golden cascade on left edge
  // ==========================================================================
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
      droplet.setPosition(
        waterfallX + r(Math.random() * 10 - 5),
        startY
      );
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

  // ==========================================================================
  // TIER PLATFORMS (depth DEPTH.PROPS_HIGH = 4) — vertical arrangement
  // ==========================================================================
  const platformTiers = ["none", "bronze", "silver", "gold", "diamond"];
  platformTiers.forEach((tier) => {
    const platform = scene.add.sprite(
      centerX,
      TIER_Y[tier] + r(10),
      `ascension_platform_${tier}`
    );
    platform.setOrigin(0.5, 0.5);
    platform.setDepth(DEPTH.PROPS_HIGH);
    scene.ascensionElements.push(platform);

    // Subtle bob animation
    scene.tweens.add({
      targets: platform,
      y: platform.y - r(3),
      duration: 3000 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 1000,
    });
  });

  // === TIER LABELS on platforms ===
  const tierLabelData = [
    { tier: "diamond", label: "DIAMOND" },
    { tier: "gold", label: "GOLD" },
    { tier: "silver", label: "SILVER" },
    { tier: "bronze", label: "BRONZE" },
  ];
  tierLabelData.forEach((td) => {
    const label = scene.add.text(
      centerX + r(60),
      TIER_Y[td.tier] + r(5),
      td.label,
      {
        fontFamily: "monospace",
        fontSize: `${r(6)}px`,
        color: TIER_COLOR_STRINGS[td.tier],
      }
    );
    label.setOrigin(0, 0.5);
    label.setDepth(DEPTH.SIGNS_TEXT);
    label.setAlpha(0.6);
    scene.ascensionElements.push(label);
  });

  // === TIER FLAGS (depth DEPTH.PROPS_MID = 3) ===
  const flagData = [
    { x: 310, tier: "bronze" },
    { x: 350, tier: "silver" },
    { x: 450, tier: "gold" },
    { x: 490, tier: "diamond" },
  ];
  flagData.forEach((fd) => {
    const flagPole = scene.add.rectangle(
      r(fd.x),
      TIER_Y[fd.tier] + r(10),
      r(3),
      r(40),
      0x6b7280
    );
    flagPole.setOrigin(0.5, 1);
    flagPole.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(flagPole);

    const flag = scene.add.rectangle(
      r(fd.x + 10),
      TIER_Y[fd.tier] - r(25),
      r(18),
      r(12),
      TIER_COLORS[fd.tier]
    );
    flag.setOrigin(0, 0.5);
    flag.setDepth(DEPTH.PROPS_MID);
    scene.ascensionElements.push(flag);

    // Flag wave
    scene.tweens.add({
      targets: flag,
      scaleX: { from: 1, to: 0.9 },
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // ==========================================================================
  // SPIRE STRUCTURE (central column + peak)
  // ==========================================================================

  // Vertical spire body (thin golden column connecting platforms)
  const spireBody = scene.add.rectangle(
    centerX,
    Math.round(480 * s),
    r(6),
    r(140),
    0xdaa520,
    0.5
  );
  spireBody.setDepth(DEPTH.PROPS_MID);
  scene.ascensionElements.push(spireBody);

  // Spire peak at top — interactive
  const spirePeak = scene.add.sprite(
    centerX,
    TIER_Y.diamond - r(30),
    "ascension_spire_peak"
  );
  spirePeak.setOrigin(0.5, 1);
  spirePeak.setDepth(DEPTH.BUILDINGS);
  scene.ascensionElements.push(spirePeak);

  // Spire glow oscillation
  scene.tweens.add({
    targets: spirePeak,
    alpha: { from: 0.5, to: 0.9 },
    duration: 2500,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Spire peak interactive — click to trigger Summon Trial
  spirePeak.setInteractive({ useHandCursor: true });
  spirePeak.on("pointerdown", () => {
    triggerSummonTrial(scene);
  });

  // ==========================================================================
  // RISING GOLDEN MOTES (30 total, spread across full width)
  // ==========================================================================
  for (let i = 0; i < 30; i++) {
    const moteColors = [0xffd700, 0xf5c842, 0xfde68a, 0xfffef5];
    const moteColor = moteColors[Math.floor(Math.random() * moteColors.length)];
    const moteSize = r(1.5 + Math.random() * 2);
    const px = r(30 + Math.random() * 1220); // Full width coverage
    const py = r(460 + Math.random() * 100);
    const mote = scene.add.rectangle(
      px,
      py,
      moteSize,
      moteSize,
      moteColor,
      0.8
    );
    mote.setDepth(DEPTH.FLYING);
    scene.ascensionElements.push(mote);

    const animateMote = () => {
      if (!(mote as any).active) return;
      mote.setPosition(
        r(30 + Math.random() * 1220),
        r(460 + Math.random() * 100)
      );
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

  // ==========================================================================
  // WHITE SPARKLE DOTS (15 total) — twinkling in place
  // ==========================================================================
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

  // ==========================================================================
  // FOREGROUND CLOUD WISPS (4, depth DEPTH.FLYING = 15)
  // ==========================================================================
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

  // ==========================================================================
  // LEADERBOARD PANEL (top-left, dark background with gold accents)
  // ==========================================================================
  createLeaderboardPanel(scene);
}

// ============================================================================
// LEADERBOARD PANEL (in-zone overlay)
// ============================================================================

function createLeaderboardPanel(scene: WorldScene): void {
  const s = SCALE;
  const r = (n: number) => Math.round(n * s);
  const panelX = r(20);
  const panelY = r(440);

  // Dark background panel for readability against bright cloud floor
  const bg = scene.add.rectangle(
    panelX + r(55),
    panelY + r(35),
    r(120),
    r(80),
    0x0a0a1e,
    0.85
  );
  bg.setDepth(DEPTH.UI_LOW);
  bg.setStrokeStyle(1, 0xd4a843); // Gold border
  scene.ascensionElements.push(bg);

  const title = scene.add.text(panelX + r(10), panelY + r(5), "TOP AGENTS", {
    fontFamily: "monospace",
    fontSize: `${r(7)}px`,
    color: "#fbbf24",
    fontStyle: "bold",
  });
  title.setDepth(DEPTH.UI_MID);
  scene.ascensionElements.push(title);

  // Reset leaderboard texts array
  leaderboardTexts = [];

  // Placeholder lines for top 5
  for (let i = 0; i < 5; i++) {
    const line = scene.add.text(
      panelX + r(10),
      panelY + r(18 + i * 12),
      `${i + 1}. ---`,
      {
        fontFamily: "monospace",
        fontSize: `${r(6)}px`,
        color: "#9ca3af",
      }
    );
    line.setDepth(DEPTH.UI_MID);
    scene.ascensionElements.push(line);
    leaderboardTexts.push(line);
  }
}

function updateLeaderboardPanel(agents: Array<{ name: string; reputationTier: string; reputationScore: number }>): void {
  const sorted = [...agents].sort((a, b) => b.reputationScore - a.reputationScore);
  const top5 = sorted.slice(0, 5);

  for (let i = 0; i < leaderboardTexts.length; i++) {
    if (!leaderboardTexts[i] || !(leaderboardTexts[i] as any).active) continue;
    if (i < top5.length) {
      const agent = top5[i];
      const tierIcon = agent.reputationTier === "diamond" ? "+" : agent.reputationTier === "gold" ? "*" : "-";
      leaderboardTexts[i].setText(`${i + 1}. ${tierIcon}${agent.name.slice(0, 10)}`);
      leaderboardTexts[i].setColor(TIER_COLOR_STRINGS[agent.reputationTier] || "#9ca3af");
    } else {
      leaderboardTexts[i].setText(`${i + 1}. ---`);
      leaderboardTexts[i].setColor("#9ca3af");
    }
  }
}

// ============================================================================
// POLLING & DATA
// ============================================================================

function startAscensionPolling(scene: WorldScene): void {
  // Poll leaderboard every 30s
  phaserPollingTimer = scene.time.addEvent({
    delay: 30000,
    loop: true,
    callback: () => fetchAndUpdate(scene),
  });

  // Random ascension trial every 15s
  phaserTrialTimer = scene.time.addEvent({
    delay: 15000,
    loop: true,
    callback: () => playRandomTrial(scene),
  });

  // Immediate first fetch
  fetchAndUpdate(scene);
}

async function fetchAndUpdate(scene: WorldScene): Promise<void> {
  try {
    const res = await fetch("/api/agent-economy/external?action=leaderboard&metric=reputation&limit=30");
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !data.leaderboard) return;
    updateAgentPositions(scene, data.leaderboard);
  } catch {
    // Silently fail — agents just don't update
  }
}

// ============================================================================
// AGENT SPRITES
// ============================================================================

function updateAgentPositions(
  scene: WorldScene,
  agents: Array<{
    rank: number;
    name: string;
    wallet: string;
    reputationScore: number;
    reputationTier: string;
    moltbookKarma?: number;
    tokensLaunched?: number;
    totalFeesEarnedSol?: number;
  }>
): void {
  const currentWallets = new Set<string>();

  agents.forEach((agentData, index) => {
    const wallet = agentData.wallet;
    currentWallets.add(wallet);
    const tier = agentData.reputationTier || "none";

    const existing = ascensionAgents.get(wallet);
    if (existing) {
      const oldTier = existing.reputationTier;
      existing.reputationScore = agentData.reputationScore;
      existing.reputationTier = tier;

      if (oldTier !== tier) {
        updateAgentSprite(scene, existing, tier, oldTier);
        playTierPromotion(scene, existing, oldTier, tier);

        // Fire-and-forget MoltBook post
        postAscensionMilestone(existing.name, oldTier, tier, agentData.reputationScore);
      }

      // Update score display
      if (existing.tierBadge && (existing.tierBadge as any).active) {
        existing.tierBadge.setText(`${tier.toUpperCase()} ${agentData.reputationScore}`);
        existing.tierBadge.setColor(TIER_COLOR_STRINGS[tier] || "#6b7280");
      }
    } else {
      createAgentSprite(scene, agentData, tier, index);
    }
  });

  // Remove agents no longer in data
  ascensionAgents.forEach((agent, wallet) => {
    if (!currentWallets.has(wallet)) {
      destroyAgentSprite(agent);
      ascensionAgents.delete(wallet);
    }
  });

  // Update leaderboard
  updateLeaderboardPanel(agents);
}

function createAgentSprite(
  scene: WorldScene,
  agentData: { name: string; wallet: string; reputationScore: number; reputationTier: string },
  tier: string,
  index: number
): void {
  const s = SCALE;
  const centerX = GAME_WIDTH / 2;
  const tierY = TIER_Y[tier] || Y.PATH_LEVEL;

  // Spread agents horizontally on their tier platform
  const sameAgentTier = [...ascensionAgents.values()].filter((a) => a.reputationTier === tier);
  const offset = (sameAgentTier.length - 1) * Math.round(30 * s);
  const xPos = centerX - offset / 2 + sameAgentTier.length * Math.round(30 * s);
  // Clamp to visible area
  const clampedX = Math.max(Math.round(250 * s), Math.min(Math.round(550 * s), xPos));

  const charVariant = index % 5;
  const sprite = scene.add.sprite(clampedX, tierY, `char_diverse_${charVariant}`);
  sprite.setOrigin(0.5, 1);
  sprite.setDepth(DEPTH.CHARACTERS);
  scene.ascensionElements.push(sprite);

  // Name label
  const nameLabel = scene.add.text(clampedX, tierY - Math.round(25 * s), agentData.name.slice(0, 12), {
    fontFamily: "monospace",
    fontSize: `${Math.round(6 * s)}px`,
    color: "#ffffff",
    stroke: "#000000",
    strokeThickness: 2,
  });
  nameLabel.setOrigin(0.5, 0.5);
  nameLabel.setDepth(DEPTH.NAME_LABELS);
  scene.ascensionElements.push(nameLabel);

  // Tier badge
  const tierBadge = scene.add.text(
    clampedX,
    tierY - Math.round(18 * s),
    `${tier.toUpperCase()} ${agentData.reputationScore}`,
    {
      fontFamily: "monospace",
      fontSize: `${Math.round(5 * s)}px`,
      color: TIER_COLOR_STRINGS[tier] || "#6b7280",
    }
  );
  tierBadge.setOrigin(0.5, 0.5);
  tierBadge.setDepth(DEPTH.NAME_LABELS);
  scene.ascensionElements.push(tierBadge);

  // Halo for diamond tier
  let halo: Phaser.GameObjects.Sprite | null = null;
  if (tier === "diamond") {
    halo = scene.add.sprite(clampedX, tierY - Math.round(30 * s), "ascension_halo");
    halo.setOrigin(0.5, 0.5);
    halo.setDepth(DEPTH.NAME_LABELS);
    scene.ascensionElements.push(halo);

    scene.tweens.add({
      targets: halo,
      alpha: { from: 0.6, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // Make interactive — click to bless or show tooltip
  sprite.setInteractive({ useHandCursor: true });
  sprite.on("pointerdown", () => {
    blessAgent(scene, agentData.wallet);
  });
  sprite.on("pointerover", () => {
    showAgentTooltip(scene, agentData.wallet);
  });

  const agent: AscensionAgent = {
    wallet: agentData.wallet,
    name: agentData.name,
    reputationScore: agentData.reputationScore,
    reputationTier: tier,
    sprite,
    nameLabel,
    tierBadge,
    halo,
    platformY: tierY,
    lastScore: agentData.reputationScore,
    blessedUntil: 0,
  };

  ascensionAgents.set(agentData.wallet, agent);
}

function updateAgentSprite(scene: WorldScene, agent: AscensionAgent, newTier: string, _oldTier: string): void {
  const newY = TIER_Y[newTier] || Y.PATH_LEVEL;
  const s = SCALE;

  // Animate agent to new tier position
  scene.tweens.add({
    targets: agent.sprite,
    y: newY,
    duration: 800,
    ease: "Back.easeOut",
  });

  scene.tweens.add({
    targets: agent.nameLabel,
    y: newY - Math.round(25 * s),
    duration: 800,
    ease: "Back.easeOut",
  });

  scene.tweens.add({
    targets: agent.tierBadge,
    y: newY - Math.round(18 * s),
    duration: 800,
    ease: "Back.easeOut",
  });

  agent.platformY = newY;
  agent.reputationTier = newTier;

  // Add halo for diamond
  if (newTier === "diamond" && !agent.halo) {
    const halo = scene.add.sprite(agent.sprite.x, newY - Math.round(30 * s), "ascension_halo");
    halo.setOrigin(0.5, 0.5);
    halo.setDepth(DEPTH.NAME_LABELS);
    scene.ascensionElements.push(halo);
    agent.halo = halo;

    scene.tweens.add({
      targets: halo,
      alpha: { from: 0.6, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // Move halo if exists
  if (agent.halo && (agent.halo as any).active) {
    scene.tweens.add({
      targets: agent.halo,
      y: newY - Math.round(30 * s),
      duration: 800,
      ease: "Back.easeOut",
    });
  }
}

function destroyAgentSprite(agent: AscensionAgent): void {
  if (agent.sprite && (agent.sprite as any).active) agent.sprite.destroy();
  if (agent.nameLabel && (agent.nameLabel as any).active) agent.nameLabel.destroy();
  if (agent.tierBadge && (agent.tierBadge as any).active) agent.tierBadge.destroy();
  if (agent.halo && (agent.halo as any).active) agent.halo.destroy();
}

// ============================================================================
// BLESS MECHANIC
// ============================================================================

function blessAgent(scene: WorldScene, wallet: string): void {
  const agent = ascensionAgents.get(wallet);
  if (!agent) return;

  const now = Date.now();
  const cooldownEnd = blessCooldowns.get(wallet) || 0;

  if (now < cooldownEnd) {
    showFloatingText(scene, "COOLDOWN", agent.sprite.x, agent.sprite.y - Math.round(30 * SCALE), "#ef4444");
    return;
  }

  // Scale bounce
  scene.tweens.add({
    targets: agent.sprite,
    scaleX: 1.3,
    scaleY: 1.3,
    duration: 150,
    yoyo: true,
    ease: "Quad.easeOut",
  });

  // Golden sparkle burst
  const s = SCALE;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const particle = scene.add.rectangle(
      agent.sprite.x,
      agent.sprite.y - Math.round(10 * s),
      Math.round(3 * s),
      Math.round(3 * s),
      0xffd700
    );
    particle.setDepth(DEPTH.FLYING);
    scene.ascensionElements.push(particle);

    scene.tweens.add({
      targets: particle,
      x: particle.x + Math.cos(angle) * Math.round(30 * s),
      y: particle.y + Math.sin(angle) * Math.round(30 * s),
      alpha: 0,
      duration: 500,
      ease: "Quad.easeOut",
      onComplete: () => {
        if ((particle as any).active) particle.destroy();
      },
    });
  }

  // "+BLESSED" floating text
  showFloatingText(scene, "+BLESSED", agent.sprite.x, agent.sprite.y - Math.round(30 * s), "#ffd700");

  // Set cooldown (10s)
  blessCooldowns.set(wallet, now + 10000);
  agent.blessedUntil = now + 10000;
}

// ============================================================================
// SUMMON TRIAL
// ============================================================================

function triggerSummonTrial(scene: WorldScene): void {
  const now = Date.now();
  const s = SCALE;

  if (now - lastSummonTime < 30000) {
    showFloatingText(
      scene,
      "COOLDOWN",
      GAME_WIDTH / 2,
      TIER_Y.diamond - Math.round(50 * s),
      "#ef4444"
    );
    return;
  }
  lastSummonTime = now;

  // "SUMMON TRIAL!" announcement
  const announcement = scene.add.text(GAME_WIDTH / 2, Math.round(300 * s), "SUMMON TRIAL!", {
    fontFamily: "monospace",
    fontSize: `${Math.round(16 * s)}px`,
    color: "#ffd700",
    fontStyle: "bold",
    stroke: "#000000",
    strokeThickness: 4,
  });
  announcement.setOrigin(0.5, 0.5);
  announcement.setDepth(DEPTH.ANNOUNCE_TEXT);
  scene.ascensionElements.push(announcement);

  scene.tweens.add({
    targets: announcement,
    alpha: 0,
    scaleX: 1.5,
    scaleY: 1.5,
    duration: 2000,
    ease: "Quad.easeOut",
    onComplete: () => {
      if ((announcement as any).active) announcement.destroy();
    },
  });

  // Expanding wave circles from peak
  for (let w = 0; w < 3; w++) {
    const wave = scene.add.circle(
      GAME_WIDTH / 2,
      TIER_Y.diamond,
      Math.round(10 * s),
      0xffd700,
      0.3
    );
    wave.setDepth(DEPTH.UI_LOW);
    wave.setStrokeStyle(2, 0xffd700);
    scene.ascensionElements.push(wave);

    scene.tweens.add({
      targets: wave,
      scaleX: 8,
      scaleY: 8,
      alpha: 0,
      duration: 1500,
      ease: "Quad.easeOut",
      delay: w * 300,
      onComplete: () => {
        if ((wave as any).active) wave.destroy();
      },
    });
  }

  // Trigger all agents
  ascensionAgents.forEach((agent) => {
    playAscensionAttempt(scene, agent);
  });
}

// ============================================================================
// ASCENSION TRIALS
// ============================================================================

function playRandomTrial(scene: WorldScene): void {
  const agents = [...ascensionAgents.values()];
  if (agents.length === 0) return;
  const randomAgent = agents[Math.floor(Math.random() * agents.length)];
  playAscensionAttempt(scene, randomAgent);
}

function playAscensionAttempt(scene: WorldScene, agent: AscensionAgent): void {
  if (!agent.sprite || !(agent.sprite as any).active) return;

  const currentTierIdx = TIER_ORDER.indexOf(agent.reputationTier);
  if (currentTierIdx >= TIER_ORDER.length - 1) return; // Already diamond

  const nextTier = TIER_ORDER[currentTierIdx + 1];
  const nextThreshold = TIER_THRESHOLDS[nextTier];
  const s = SCALE;

  if (agent.reputationScore >= nextThreshold) {
    // Ascend! Move to next tier
    const oldTier = agent.reputationTier;
    agent.reputationTier = nextTier;
    updateAgentSprite(scene, agent, nextTier, oldTier);
    playTierPromotion(scene, agent, oldTier, nextTier);
  } else {
    // Bounce back — jump up then fall
    const jumpY = agent.sprite.y - Math.round(30 * s);
    scene.tweens.add({
      targets: agent.sprite,
      y: jumpY,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => {
        scene.tweens.add({
          targets: agent.sprite,
          y: agent.platformY,
          duration: 400,
          ease: "Bounce.easeOut",
        });
      },
    });

    // Bounce labels too
    scene.tweens.add({
      targets: [agent.nameLabel, agent.tierBadge],
      y: `-=${Math.round(30 * s)}`,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => {
        scene.tweens.add({
          targets: agent.nameLabel,
          y: agent.platformY - Math.round(25 * s),
          duration: 400,
          ease: "Bounce.easeOut",
        });
        scene.tweens.add({
          targets: agent.tierBadge,
          y: agent.platformY - Math.round(18 * s),
          duration: 400,
          ease: "Bounce.easeOut",
        });
      },
    });
  }
}

// ============================================================================
// VFX
// ============================================================================

function playTierPromotion(scene: WorldScene, agent: AscensionAgent, fromTier: string, toTier: string): void {
  const s = SCALE;
  const fromY = TIER_Y[fromTier] || Y.PATH_LEVEL;
  const toY = TIER_Y[toTier] || Y.PATH_LEVEL;
  const tierColor = TIER_COLORS[toTier] || 0xffffff;

  // Ascension beam (light column)
  showAscensionBeam(scene, agent.sprite.x, fromY, toY);

  // Star burst at landing
  showStarBurst(scene, agent.sprite.x, toY, tierColor);

  // "ASCENDED!" text
  showFloatingText(
    scene,
    "ASCENDED!",
    agent.sprite.x,
    toY - Math.round(40 * s),
    TIER_COLOR_STRINGS[toTier] || "#ffffff"
  );

  // Inspiration cascade — lower-tier agents glow
  playInspirationCascade(scene, toTier);

  // Diamond promotion: screen flash
  if (toTier === "diamond") {
    const flash = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0xffffff,
      0.3
    );
    flash.setDepth(DEPTH.WEATHER);
    scene.ascensionElements.push(flash);

    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => {
        if ((flash as any).active) flash.destroy();
      },
    });
  }

  // Confetti burst (more for higher tiers)
  const confettiCount = toTier === "diamond" ? 30 : toTier === "gold" ? 18 : toTier === "silver" ? 12 : 6;
  const confettiColors = [0xffd700, 0xef4444, 0x4ade80, 0x3b82f6, 0xa855f7, 0xf97316];
  for (let i = 0; i < confettiCount; i++) {
    const confetti = scene.add.rectangle(
      agent.sprite.x + (Math.random() - 0.5) * Math.round(20 * s),
      toY,
      Math.round(3 * s),
      Math.round(3 * s),
      confettiColors[i % confettiColors.length]
    );
    confetti.setDepth(DEPTH.FLYING);
    scene.ascensionElements.push(confetti);

    scene.tweens.add({
      targets: confetti,
      x: confetti.x + (Math.random() - 0.5) * Math.round(100 * s),
      y: confetti.y + Math.round((50 + Math.random() * 80) * s),
      alpha: 0,
      angle: Math.random() * 360,
      duration: 1500 + Math.random() * 500,
      ease: "Quad.easeOut",
      onComplete: () => {
        if ((confetti as any).active) confetti.destroy();
      },
    });
  }
}

function showAscensionBeam(scene: WorldScene, x: number, fromY: number, toY: number): void {
  const s = SCALE;
  const beamHeight = Math.abs(fromY - toY);
  const beam = scene.add.rectangle(
    x,
    Math.min(fromY, toY) + beamHeight / 2,
    Math.round(4 * s),
    beamHeight,
    0xffffff,
    0.7
  );
  beam.setDepth(DEPTH.UI_LOW);
  scene.ascensionElements.push(beam);

  scene.tweens.add({
    targets: beam,
    alpha: 0,
    scaleX: 3,
    duration: 1000,
    ease: "Quad.easeOut",
    onComplete: () => {
      if ((beam as any).active) beam.destroy();
    },
  });
}

function showStarBurst(scene: WorldScene, x: number, y: number, color: number): void {
  const s = SCALE;
  const count = 10;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const star = scene.add.rectangle(
      x,
      y,
      Math.round(4 * s),
      Math.round(4 * s),
      color
    );
    star.setDepth(DEPTH.FLYING);
    scene.ascensionElements.push(star);

    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * Math.round(40 * s),
      y: y + Math.sin(angle) * Math.round(40 * s),
      alpha: 0,
      duration: 500,
      ease: "Quad.easeOut",
      onComplete: () => {
        if ((star as any).active) star.destroy();
      },
    });
  }
}

function showFloatingText(
  scene: WorldScene,
  text: string,
  x: number,
  y: number,
  color: string
): void {
  const s = SCALE;
  const floatText = scene.add.text(x, y, text, {
    fontFamily: "monospace",
    fontSize: `${Math.round(8 * s)}px`,
    color,
    fontStyle: "bold",
    stroke: "#000000",
    strokeThickness: 2,
  });
  floatText.setOrigin(0.5, 0.5);
  floatText.setDepth(DEPTH.ANNOUNCE_TEXT);
  scene.ascensionElements.push(floatText);

  scene.tweens.add({
    targets: floatText,
    y: y - Math.round(40 * s),
    alpha: 0,
    duration: 1500,
    ease: "Quad.easeOut",
    onComplete: () => {
      if ((floatText as any).active) floatText.destroy();
    },
  });
}

function playInspirationCascade(scene: WorldScene, promotedTier: string): void {
  const promotedIdx = TIER_ORDER.indexOf(promotedTier);
  const tierColor = TIER_COLORS[promotedTier] || 0xffffff;

  ascensionAgents.forEach((agent) => {
    const agentTierIdx = TIER_ORDER.indexOf(agent.reputationTier);
    if (agentTierIdx < promotedIdx && agent.sprite && (agent.sprite as any).active) {
      agent.sprite.setTint(tierColor);
      scene.time.delayedCall(500, () => {
        if (agent.sprite && (agent.sprite as any).active) {
          agent.sprite.clearTint();
        }
      });
    }
  });
}

// ============================================================================
// TOOLTIP
// ============================================================================

function showAgentTooltip(scene: WorldScene, wallet: string): void {
  const agent = ascensionAgents.get(wallet);
  if (!agent) return;

  const s = SCALE;
  const tooltipX = agent.sprite.x + Math.round(30 * s);
  const tooltipY = agent.sprite.y - Math.round(40 * s);

  // Background
  const bg = scene.add.rectangle(
    tooltipX,
    tooltipY,
    Math.round(100 * s),
    Math.round(50 * s),
    0x0a0a1e,
    0.9
  );
  bg.setDepth(DEPTH.PANEL);
  bg.setStrokeStyle(1, TIER_COLORS[agent.reputationTier] || 0x6b7280);
  scene.ascensionElements.push(bg);

  const tooltipText = scene.add.text(
    tooltipX - Math.round(45 * s),
    tooltipY - Math.round(20 * s),
    [
      `${agent.name}`,
      `Tier: ${agent.reputationTier.toUpperCase()}`,
      `Score: ${agent.reputationScore}`,
      `Click to Bless`,
    ].join("\n"),
    {
      fontFamily: "monospace",
      fontSize: `${Math.round(5.5 * s)}px`,
      color: "#ffffff",
      lineSpacing: 2,
    }
  );
  tooltipText.setDepth(DEPTH.PANEL_TEXT);
  scene.ascensionElements.push(tooltipText);

  // Auto-destroy after 3s
  scene.time.delayedCall(3000, () => {
    if ((bg as any).active) bg.destroy();
    if ((tooltipText as any).active) tooltipText.destroy();
  });
}

// ============================================================================
// MOLTBOOK INTEGRATION
// ============================================================================

function postAscensionMilestone(
  agentName: string,
  fromTier: string,
  toTier: string,
  score: number
): void {
  try {
    fetch("/api/moltbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ascension_milestone",
        data: {
          agentName,
          fromTier,
          toTier,
          score,
        },
        priority: "high",
      }),
    }).catch(() => {});
  } catch {
    // Fire-and-forget
  }

  // Dispatch ascension event for autonomous dialogue engine
  window.dispatchEvent(
    new CustomEvent("bagsworld-ascension-event", {
      detail: { type: "tier_up", agentName, fromTier, toTier, score },
    })
  );
}

// ============================================================================
// AGENT SPEECH IN ZONE
// ============================================================================

function initAscensionSpeechListeners(scene: WorldScene): void {
  // Listen for agent speech events from ElizaOS / SpeechBubbleManager
  if (!speechEventHandler) {
    speechEventHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { characterId, message } = detail;
      if (!characterId || !message) return;

      // Find matching agent on the spire
      const agent = findAgentByCharacterId(characterId);
      if (agent) {
        showAgentSpeechBubble(scene, agent, message);
      }
    };
    window.addEventListener("bagsworld-character-speak", speechEventHandler);
  }

  // Periodic agent commentary every 45s — pick a random agent on the spire
  // and fetch an ascension-themed comment from the character chat API
  if (!phaserCommentaryTimer) {
    phaserCommentaryTimer = scene.time.addEvent({
      delay: 45000,
      loop: true,
      callback: () => fetchRandomAgentCommentary(scene),
    });
  }
}

function findAgentByCharacterId(characterId: string): AscensionAgent | null {
  const normalized = characterId.toLowerCase().replace(/[\s_]/g, "-");
  for (const agent of ascensionAgents.values()) {
    const agentNorm = agent.name.toLowerCase().replace(/[\s_]/g, "-");
    if (agentNorm === normalized || agentNorm.includes(normalized) || normalized.includes(agentNorm)) {
      return agent;
    }
  }
  return null;
}

function showAgentSpeechBubble(
  scene: WorldScene,
  agent: AscensionAgent,
  message: string
): void {
  if (!agent.sprite || !(agent.sprite as any).active) return;

  const s = SCALE;
  const bubbleX = agent.sprite.x;
  const bubbleY = agent.sprite.y - Math.round(45 * s);
  const maxWidth = Math.round(120 * s);

  // Speech bubble background
  const bg = scene.add.rectangle(
    bubbleX,
    bubbleY,
    maxWidth,
    Math.round(24 * s),
    0x0a0a1e,
    0.9
  );
  bg.setDepth(DEPTH.PANEL);
  bg.setStrokeStyle(1, TIER_COLORS[agent.reputationTier] || 0x6b7280);
  scene.ascensionElements.push(bg);

  // Speech text (truncate to ~60 chars)
  const displayMsg = message.length > 60 ? message.slice(0, 57) + "..." : message;
  const text = scene.add.text(
    bubbleX - maxWidth / 2 + Math.round(5 * s),
    bubbleY - Math.round(8 * s),
    displayMsg,
    {
      fontFamily: "monospace",
      fontSize: `${Math.round(5 * s)}px`,
      color: "#ffffff",
      wordWrap: { width: maxWidth - Math.round(10 * s) },
    }
  );
  text.setDepth(DEPTH.PANEL_TEXT);
  scene.ascensionElements.push(text);

  // Speech bubble tail (small triangle)
  const tail = scene.add.triangle(
    bubbleX,
    bubbleY + Math.round(12 * s),
    0, 0,
    Math.round(6 * s), 0,
    Math.round(3 * s), Math.round(6 * s),
    0x0a0a1e,
    0.9
  );
  tail.setDepth(DEPTH.PANEL);
  scene.ascensionElements.push(tail);

  // Auto-fade and destroy after 5s
  scene.tweens.add({
    targets: [bg, text, tail],
    alpha: 0,
    duration: 500,
    delay: 4500,
    onComplete: () => {
      if ((bg as any).active) bg.destroy();
      if ((text as any).active) text.destroy();
      if ((tail as any).active) tail.destroy();
    },
  });
}

async function fetchRandomAgentCommentary(scene: WorldScene): Promise<void> {
  const agents = [...ascensionAgents.values()];
  if (agents.length === 0) return;

  const agent = agents[Math.floor(Math.random() * agents.length)];
  if (!agent.sprite || !(agent.sprite as any).active) return;

  const tierIdx = TIER_ORDER.indexOf(agent.reputationTier);
  const nextTier = tierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[tierIdx + 1] : null;
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : TIER_THRESHOLDS.diamond;
  const pointsNeeded = Math.max(0, nextThreshold - agent.reputationScore);

  const prompt = nextTier
    ? `You're on the Ascension Spire at ${agent.reputationTier} tier with ${agent.reputationScore} points. You need ${pointsNeeded} more to reach ${nextTier}. Say something brief about your ascension journey.`
    : `You're at DIAMOND tier on the Ascension Spire — the highest level! Say something brief about being at the top.`;

  try {
    const res = await fetch("/api/character-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: agent.name.toLowerCase().replace(/\s/g, "-"),
        message: prompt,
        context: "ascension_spire",
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const reply = data.response || data.message;
    if (reply && typeof reply === "string") {
      showAgentSpeechBubble(scene, agent, reply);
    }
  } catch {
    // Silently fail
  }
}
