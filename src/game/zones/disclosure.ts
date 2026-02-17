import * as Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { SCALE, DEPTH, Y } from "../textures/constants";

const GAME_WIDTH = 1280;

// Ambient Grey aliens that wander the zone
interface DisclosureGrey {
  sprite: Phaser.GameObjects.Sprite;
  targetX: number;
  speed: number;
  direction: "left" | "right";
  idleTimer: number;
  isIdle: boolean;
  baseY: number;
  stareTimer: number;
  isStaring: boolean;
}

// Alien proverbs displayed when clicking Greys
const ALIEN_PROVERBS = [
  "The wise species does not sell the dip of a new star system.",
  "Patience compounds across galaxies. So does conviction.",
  "Your 'market cap' metric amuses our navigation AI.",
  "We traveled 40 light-years. You can hold for 40 days.",
  "On our world, 'paper hands' is a medical condition.",
  "The blockchain is primitive but the philosophy is sound.",
  "We observe your 'rug pulls.' They violate 7 interstellar laws.",
  "WAGMI is a universal constant across 3 star systems.",
  "Your fastest chain still moves slower than our slowest thought.",
  "We chose Solana because your fastest consensus was the first signal we could parse.",
  "In our notation, SOL is measured in solar units. The name is... coincidental.",
  "The concept of 'degen' translates perfectly to our language. This concerns us.",
];

export function setupDisclosureZone(scene: WorldScene): void {
  scene.restoreNormalSky();

  scene.ground.setVisible(true);
  scene.ground.setTexture("disclosure_ground");

  const elementsValid =
    scene.disclosureElements.length > 0 &&
    scene.disclosureElements.every((el) => (el as any).active !== false);

  if (!elementsValid && scene.disclosureZoneCreated) {
    scene.disclosureElements = [];
    scene.disclosureZoneCreated = false;
  }

  if (!scene.disclosureZoneCreated) {
    createDisclosureDecorations(scene);
    scene.storeZoneElementPositions(scene.disclosureElements);
    scene.disclosureZoneCreated = true;
  } else {
    scene.disclosureElements.forEach((el) => (el as any).setVisible(true));
  }
}

function createDisclosureDecorations(scene: WorldScene): void {
  const s = SCALE;
  const grassTop = Y.GRASS_TOP;
  const pathLevel = Y.PATH_LEVEL;

  // ========================================================================
  // BACKGROUND PROPS (depth 2) — Desert landscape
  // ========================================================================

  // Saguaro cacti scattered across the zone
  const cactusPositions = [
    { x: 30, variant: 0, scale: 0.9 },
    { x: 120, variant: 1, scale: 1.0 },
    { x: 350, variant: 2, scale: 0.85 },
    { x: 560, variant: 0, scale: 1.1 },
    { x: 700, variant: 1, scale: 0.95 },
    { x: 790, variant: 2, scale: 0.9 },
  ];
  cactusPositions.forEach((pos) => {
    const cactus = scene.add.sprite(
      Math.round(pos.x * s),
      grassTop + Math.round(5 * s),
      `disclosure_cactus_${pos.variant}`
    );
    cactus.setOrigin(0.5, 1);
    cactus.setDepth(DEPTH.PROPS_LOW);
    cactus.setScale(pos.scale);
    scene.disclosureElements.push(cactus);
  });

  // Desert rocks
  const rockPositions = [
    { x: 60, size: 0, yOff: 35 },
    { x: 180, size: 2, yOff: 30 },
    { x: 310, size: 1, yOff: 38 },
    { x: 480, size: 0, yOff: 32 },
    { x: 620, size: 2, yOff: 36 },
    { x: 730, size: 1, yOff: 33 },
    { x: 85, size: 0, yOff: 42 },
    { x: 550, size: 1, yOff: 40 },
  ];
  rockPositions.forEach((pos) => {
    const rock = scene.add.sprite(
      Math.round(pos.x * s),
      grassTop + Math.round(pos.yOff * s),
      `disclosure_rock_${pos.size}`
    );
    rock.setOrigin(0.5, 1);
    rock.setDepth(DEPTH.PROPS_LOW);
    scene.disclosureElements.push(rock);
  });

  // Scrub brush clusters
  const scrubPositions = [90, 200, 340, 500, 640, 760];
  scrubPositions.forEach((sx) => {
    const scrub = scene.add.sprite(
      Math.round(sx * s),
      grassTop + Math.round((35 + Math.random() * 10) * s),
      "disclosure_scrub"
    );
    scrub.setOrigin(0.5, 1);
    scrub.setDepth(DEPTH.PROPS_LOW);
    scene.disclosureElements.push(scrub);
  });

  // Tumbleweeds (animated rolling)
  const tumbleweedPositions = [150, 440, 680];
  tumbleweedPositions.forEach((tx, i) => {
    const tw = scene.add.sprite(
      Math.round(tx * s),
      grassTop + Math.round(40 * s),
      "disclosure_tumbleweed"
    );
    tw.setOrigin(0.5, 1);
    tw.setDepth(DEPTH.PROPS_LOW);
    scene.disclosureElements.push(tw);

    scene.tweens.add({
      targets: tw,
      x: tw.x + Math.round(200 * s),
      angle: 360,
      duration: 12000 + i * 3000,
      repeat: -1,
      onRepeat: () => {
        tw.x = Math.round(-20 * s);
      },
    });
  });

  // ========================================================================
  // MILITARY PRESENCE (depth 3) — Fences, barriers, equipment
  // ========================================================================

  // Chain-link fence segments (perimeter)
  const fencePositions = [50, 80, 110, 650, 680, 710];
  fencePositions.forEach((fx) => {
    const fence = scene.add.sprite(
      Math.round(fx * s),
      grassTop + Math.round(25 * s),
      "disclosure_fence"
    );
    fence.setOrigin(0.5, 1);
    fence.setDepth(DEPTH.PROPS_MID);
    scene.disclosureElements.push(fence);
  });

  // Concrete barriers
  const barrierPositions = [140, 260, 520, 600];
  barrierPositions.forEach((bx) => {
    const barrier = scene.add.sprite(
      Math.round(bx * s),
      pathLevel + Math.round(5 * s),
      "disclosure_barrier"
    );
    barrier.setOrigin(0.5, 1);
    barrier.setDepth(DEPTH.PROPS_MID);
    scene.disclosureElements.push(barrier);
  });

  // Floodlight towers
  const floodlightPositions = [170, 380, 590, 750];
  floodlightPositions.forEach((fx) => {
    const light = scene.add.sprite(
      Math.round(fx * s),
      grassTop + Math.round(20 * s),
      "disclosure_floodlight"
    );
    light.setOrigin(0.5, 1);
    light.setDepth(DEPTH.PROPS_MID);
    scene.disclosureElements.push(light);

    // Pulsing glow beneath floodlight
    const glow = scene.add.ellipse(
      Math.round(fx * s),
      grassTop + Math.round(35 * s),
      Math.round(30 * s),
      Math.round(10 * s),
      0xfbbf24,
      0.12
    );
    glow.setDepth(DEPTH.PATH);
    scene.disclosureElements.push(glow);

    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.08, to: 0.18 },
      duration: 2000 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // Military crates
  const cratePositions = [200, 360, 530, 720];
  cratePositions.forEach((cx) => {
    const crate = scene.add.sprite(
      Math.round(cx * s),
      pathLevel + Math.round(3 * s),
      "disclosure_crate"
    );
    crate.setOrigin(0.5, 1);
    crate.setDepth(DEPTH.PROPS_HIGH);
    scene.disclosureElements.push(crate);
  });

  // KEEP OUT signs
  const signPositions = [75, 690];
  signPositions.forEach((sx) => {
    const sign = scene.add.sprite(
      Math.round(sx * s),
      grassTop + Math.round(28 * s),
      "disclosure_sign"
    );
    sign.setOrigin(0.5, 1);
    sign.setDepth(DEPTH.PROPS_MID);
    scene.disclosureElements.push(sign);
  });

  // Surveillance cameras
  const cameraPositions = [100, 400, 670];
  cameraPositions.forEach((cx) => {
    const cam = scene.add.sprite(
      Math.round(cx * s),
      grassTop + Math.round(15 * s),
      "disclosure_camera"
    );
    cam.setOrigin(0.5, 1);
    cam.setDepth(DEPTH.PROPS_MID);
    scene.disclosureElements.push(cam);

    scene.tweens.add({
      targets: cam,
      angle: { from: -15, to: 15 },
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // Radar dish
  const radarDish = scene.add.sprite(
    Math.round(770 * s),
    grassTop + Math.round(18 * s),
    "disclosure_radar"
  );
  radarDish.setOrigin(0.5, 1);
  radarDish.setDepth(DEPTH.PROPS_MID);
  scene.disclosureElements.push(radarDish);

  // ========================================================================
  // ALIEN ARTIFACTS (depth 2-3) — Crystal growths, energy conduits
  // ========================================================================

  // Alien crystal growths (cluster around the wreckage center)
  const crystalPositions = [
    { x: 280, size: 0, yOff: 30 },
    { x: 320, size: 2, yOff: 25 },
    { x: 340, size: 1, yOff: 32 },
    { x: 430, size: 2, yOff: 28 },
    { x: 460, size: 0, yOff: 35 },
    { x: 500, size: 1, yOff: 30 },
    { x: 380, size: 0, yOff: 38 },
  ];
  crystalPositions.forEach((pos) => {
    const crystal = scene.add.sprite(
      Math.round(pos.x * s),
      grassTop + Math.round(pos.yOff * s),
      `disclosure_crystal_${pos.size}`
    );
    crystal.setOrigin(0.5, 1);
    crystal.setDepth(DEPTH.PROPS_LOW);
    scene.disclosureElements.push(crystal);

    scene.tweens.add({
      targets: crystal,
      alpha: { from: 0.7, to: 1.0 },
      scaleX: { from: 1.0, to: 1.05 },
      scaleY: { from: 1.0, to: 1.08 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // Energy conduit lines on ground
  const conduitPaths = [
    { x1: 400, x2: 580, y: 48 },
    { x1: 400, x2: 230, y: 45 },
  ];
  conduitPaths.forEach((path) => {
    const startX = Math.round(Math.min(path.x1, path.x2) * s);
    const endX = Math.round(Math.max(path.x1, path.x2) * s);
    const conduit = scene.add.rectangle(
      (startX + endX) / 2,
      grassTop + Math.round(path.y * s),
      endX - startX,
      Math.round(2 * s),
      0x00ffd4,
      0.25
    );
    conduit.setDepth(DEPTH.PATH);
    scene.disclosureElements.push(conduit);

    scene.tweens.add({
      targets: conduit,
      alpha: { from: 0.15, to: 0.35 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // ========================================================================
  // BUILDINGS (depth 5-7) — 6 interactive structures (NO labels/boxes)
  // ========================================================================

  // --- 1. THE WRECKAGE (centerpiece) ---
  const wreckageX = Math.round(400 * s);
  const wreckageSprite = scene.add.sprite(wreckageX, pathLevel, "disclosure_wreckage");
  wreckageSprite.setOrigin(0.5, 1);
  wreckageSprite.setDepth(DEPTH.BUILDINGS);
  scene.disclosureElements.push(wreckageSprite);

  wreckageSprite.setInteractive({ useHandCursor: true });
  wreckageSprite.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-wreckage-click"));
  });
  wreckageSprite.on("pointerover", () => {
    wreckageSprite.setTint(0xdddddd);
    scene.tweens.add({
      targets: wreckageSprite,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
      ease: "Power2",
    });
  });
  wreckageSprite.on("pointerout", () => {
    wreckageSprite.clearTint();
    scene.tweens.add({
      targets: wreckageSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: "Power2",
    });
  });

  // Energy particles rising from the wreckage breach
  const smokeY = pathLevel - Math.round(80 * s);
  const wreckageParticles = scene.add.particles(
    wreckageX + Math.round(20 * s),
    smokeY,
    "green_smoke",
    {
      speedY: { min: -20, max: -50 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.2, end: 0.8 },
      alpha: { start: 0.4, end: 0 },
      tint: 0x00ffd4,
      lifespan: { min: 2000, max: 4000 },
      frequency: 600,
      quantity: 1,
      x: { min: -Math.round(5 * s), max: Math.round(5 * s) },
      rotate: { min: 0, max: 360 },
    }
  );
  wreckageParticles.setDepth(DEPTH.FLYING);
  scene.disclosureElements.push(wreckageParticles);

  // --- 2. AARO FIELD OFFICE ---
  const aaroX = Math.round(150 * s);
  const aaroSprite = scene.add.sprite(aaroX, pathLevel, "disclosure_aaro");
  aaroSprite.setOrigin(0.5, 1);
  aaroSprite.setDepth(DEPTH.BUILDINGS);
  scene.disclosureElements.push(aaroSprite);

  aaroSprite.setInteractive({ useHandCursor: true });
  aaroSprite.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-aaro-click"));
  });
  aaroSprite.on("pointerover", () => {
    aaroSprite.setTint(0xdddddd);
    scene.tweens.add({
      targets: aaroSprite,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
      ease: "Power2",
    });
  });
  aaroSprite.on("pointerout", () => {
    aaroSprite.clearTint();
    scene.tweens.add({ targets: aaroSprite, scaleX: 1, scaleY: 1, duration: 100, ease: "Power2" });
  });

  // --- 3. XENOBAZAAR ---
  const bazaarX = Math.round(630 * s);
  const bazaarSprite = scene.add.sprite(bazaarX, pathLevel, "disclosure_xenobazaar");
  bazaarSprite.setOrigin(0.5, 1);
  bazaarSprite.setDepth(DEPTH.BUILDINGS);
  scene.disclosureElements.push(bazaarSprite);

  bazaarSprite.setInteractive({ useHandCursor: true });
  bazaarSprite.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-xenobazaar-click"));
  });
  bazaarSprite.on("pointerover", () => {
    bazaarSprite.setTint(0xdddddd);
    scene.tweens.add({
      targets: bazaarSprite,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
      ease: "Power2",
    });
  });
  bazaarSprite.on("pointerout", () => {
    bazaarSprite.clearTint();
    scene.tweens.add({
      targets: bazaarSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: "Power2",
    });
  });

  // --- 4. SIGNAL TOWER ---
  const towerX = Math.round(570 * s);
  const towerSprite = scene.add.sprite(towerX, pathLevel, "disclosure_signal_tower");
  towerSprite.setOrigin(0.5, 1);
  towerSprite.setDepth(4.8);
  scene.disclosureElements.push(towerSprite);

  towerSprite.setInteractive({ useHandCursor: true });
  towerSprite.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-signaltower-click"));
  });
  towerSprite.on("pointerover", () => {
    towerSprite.setTint(0xdddddd);
    scene.tweens.add({
      targets: towerSprite,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
      ease: "Power2",
    });
  });
  towerSprite.on("pointerout", () => {
    towerSprite.clearTint();
    scene.tweens.add({ targets: towerSprite, scaleX: 1, scaleY: 1, duration: 100, ease: "Power2" });
  });

  // Signal tower pulse rings
  scene.time.addEvent({
    delay: 5000,
    callback: () => {
      if (scene.currentZone !== "disclosure") return;
      const ring = scene.add.circle(
        towerX,
        pathLevel - Math.round(140 * s),
        Math.round(4 * s),
        0x00ffd4,
        0.4
      );
      ring.setDepth(DEPTH.FLYING);
      scene.disclosureElements.push(ring);

      scene.tweens.add({
        targets: ring,
        scaleX: 8,
        scaleY: 8,
        alpha: 0,
        duration: 2000,
        ease: "Quad.easeOut",
        onComplete: () => {
          ring.destroy();
          const idx = scene.disclosureElements.indexOf(ring);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });
    },
    loop: true,
  });

  // --- 5. HANGAR 18 ---
  const hangarX = Math.round(240 * s);
  const hangarSprite = scene.add.sprite(hangarX, pathLevel, "disclosure_hangar18");
  hangarSprite.setOrigin(0.5, 1);
  hangarSprite.setDepth(DEPTH.BUILDINGS);
  scene.disclosureElements.push(hangarSprite);

  hangarSprite.setInteractive({ useHandCursor: true });
  hangarSprite.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-hangar18-click"));
  });
  hangarSprite.on("pointerover", () => {
    hangarSprite.setTint(0xdddddd);
    scene.tweens.add({
      targets: hangarSprite,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
      ease: "Power2",
    });
  });
  hangarSprite.on("pointerout", () => {
    hangarSprite.clearTint();
    scene.tweens.add({
      targets: hangarSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: "Power2",
    });
  });

  // --- 6. CROP CIRCLE CANTINA ---
  const cantinaX = Math.round(760 * s);
  const cantinaSprite = scene.add.sprite(cantinaX, pathLevel, "disclosure_cantina");
  cantinaSprite.setOrigin(0.5, 1);
  cantinaSprite.setDepth(DEPTH.BUILDINGS);
  scene.disclosureElements.push(cantinaSprite);

  cantinaSprite.setInteractive({ useHandCursor: true });
  cantinaSprite.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-cantina-click"));
  });
  cantinaSprite.on("pointerover", () => {
    cantinaSprite.setTint(0xdddddd);
    scene.tweens.add({
      targets: cantinaSprite,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
      ease: "Power2",
    });
  });
  cantinaSprite.on("pointerout", () => {
    cantinaSprite.clearTint();
    scene.tweens.add({
      targets: cantinaSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: "Power2",
    });
  });

  // ========================================================================
  // UFO SWARM — Alien chaos in the skies
  // ========================================================================

  // Classic saucers — 5 flying across at different heights/speeds
  const saucerConfigs = [
    { startX: -60, y: 60, speed: 18000, variant: 0, scale: 1.0 },
    { startX: -120, y: 100, speed: 22000, variant: 0, scale: 0.8 },
    { startX: -30, y: 140, speed: 15000, variant: 0, scale: 1.2 },
    { startX: -90, y: 45, speed: 25000, variant: 0, scale: 0.7 },
    { startX: -150, y: 170, speed: 20000, variant: 0, scale: 0.9 },
  ];
  saucerConfigs.forEach((cfg, i) => {
    const ufo = scene.add.sprite(
      Math.round(cfg.startX * s),
      Math.round(cfg.y * s),
      `disclosure_ufo_${cfg.variant}`
    );
    ufo.setOrigin(0.5, 0.5);
    ufo.setDepth(DEPTH.FLYING);
    ufo.setScale(cfg.scale);
    scene.disclosureElements.push(ufo);

    // Fly across screen
    scene.tweens.add({
      targets: ufo,
      x: GAME_WIDTH + Math.round(80 * s),
      duration: cfg.speed,
      delay: i * 3000,
      repeat: -1,
      onRepeat: () => {
        ufo.x = Math.round(cfg.startX * s);
        ufo.y = Math.round((40 + Math.random() * 150) * s);
      },
    });

    // Gentle wobble
    scene.tweens.add({
      targets: ufo,
      y: Math.round(cfg.y * s) + Math.round((8 + Math.random() * 12) * s),
      duration: 2000 + i * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // Mothership — 1 large slow-moving craft
  const mothership = scene.add.sprite(Math.round(-100 * s), Math.round(80 * s), "disclosure_ufo_1");
  mothership.setOrigin(0.5, 0.5);
  mothership.setDepth(DEPTH.FLYING);
  mothership.setScale(1.3);
  scene.disclosureElements.push(mothership);

  scene.tweens.add({
    targets: mothership,
    x: GAME_WIDTH + Math.round(120 * s),
    duration: 40000,
    repeat: -1,
    onRepeat: () => {
      mothership.x = Math.round(-100 * s);
      mothership.y = Math.round((50 + Math.random() * 80) * s);
    },
  });
  scene.tweens.add({
    targets: mothership,
    y: Math.round(80 * s) + Math.round(6 * s),
    duration: 4000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Mothership tractor beam spotlight on ground (moves with ship)
  const tractorBeam = scene.add.ellipse(
    mothership.x,
    grassTop + Math.round(30 * s),
    Math.round(50 * s),
    Math.round(14 * s),
    0x00ffd4,
    0.08
  );
  tractorBeam.setDepth(DEPTH.PATH + 0.5);
  scene.disclosureElements.push(tractorBeam);
  scene.tweens.add({
    targets: tractorBeam,
    alpha: { from: 0.04, to: 0.12 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  // Track mothership position
  scene.time.addEvent({
    delay: 50,
    callback: () => {
      if (scene.currentZone !== "disclosure" || !mothership.active) return;
      tractorBeam.x = mothership.x;
    },
    loop: true,
  });

  // Black triangles — 3 sinister TR-3B style
  const triangleConfigs = [
    { startX: 900, y: 90, speed: 28000 },
    { startX: 1000, y: 55, speed: 35000 },
    { startX: 850, y: 130, speed: 30000 },
  ];
  triangleConfigs.forEach((cfg, i) => {
    const tri = scene.add.sprite(
      Math.round(cfg.startX * s),
      Math.round(cfg.y * s),
      "disclosure_ufo_2"
    );
    tri.setOrigin(0.5, 0.5);
    tri.setDepth(DEPTH.FLYING);
    tri.setScale(0.9 + Math.random() * 0.3);
    scene.disclosureElements.push(tri);

    // Fly right-to-left (opposite direction from saucers)
    scene.tweens.add({
      targets: tri,
      x: Math.round(-80 * s),
      duration: cfg.speed,
      delay: i * 5000,
      repeat: -1,
      onRepeat: () => {
        tri.x = Math.round((900 + Math.random() * 200) * s);
        tri.y = Math.round((40 + Math.random() * 120) * s);
      },
    });

    // Slight vertical drift
    scene.tweens.add({
      targets: tri,
      y: Math.round(cfg.y * s) + Math.round(5 * s),
      duration: 3000 + i * 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // Scout drones — 6 tiny fast craft darting around
  for (let i = 0; i < 6; i++) {
    const drone = scene.add.sprite(
      Math.round((-50 - Math.random() * 100) * s),
      Math.round((30 + Math.random() * 160) * s),
      "disclosure_ufo_3"
    );
    drone.setOrigin(0.5, 0.5);
    drone.setDepth(DEPTH.FLYING);
    drone.setScale(0.7 + Math.random() * 0.5);
    scene.disclosureElements.push(drone);

    const goingRight = i % 2 === 0;
    scene.tweens.add({
      targets: drone,
      x: goingRight ? GAME_WIDTH + Math.round(60 * s) : Math.round(-60 * s),
      duration: 8000 + Math.random() * 6000,
      delay: i * 1500,
      repeat: -1,
      onRepeat: () => {
        drone.x = goingRight
          ? Math.round((-50 - Math.random() * 80) * s)
          : GAME_WIDTH + Math.round((30 + Math.random() * 60) * s);
        drone.y = Math.round((25 + Math.random() * 170) * s);
      },
    });

    // Jittery movement (drones are erratic)
    scene.tweens.add({
      targets: drone,
      y: drone.y + Math.round((-10 + Math.random() * 20) * s),
      duration: 800 + Math.random() * 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // Alien fighters — 4 angular craft in formation-ish patterns
  const fighterConfigs = [
    { startX: -40, y: 120, speed: 12000, flipX: false },
    { startX: -70, y: 135, speed: 12500, flipX: false },
    { startX: 900, y: 70, speed: 14000, flipX: true },
    { startX: 950, y: 85, speed: 14500, flipX: true },
  ];
  fighterConfigs.forEach((cfg, i) => {
    const fighter = scene.add.sprite(
      Math.round(cfg.startX * s),
      Math.round(cfg.y * s),
      "disclosure_fighter"
    );
    fighter.setOrigin(0.5, 0.5);
    fighter.setDepth(DEPTH.FLYING);
    fighter.setFlipX(cfg.flipX);
    scene.disclosureElements.push(fighter);

    const targetX = cfg.flipX ? Math.round(-80 * s) : GAME_WIDTH + Math.round(80 * s);
    const resetX = cfg.flipX
      ? Math.round((900 + Math.random() * 100) * s)
      : Math.round((-40 - Math.random() * 60) * s);

    scene.tweens.add({
      targets: fighter,
      x: targetX,
      duration: cfg.speed,
      delay: i * 2000,
      repeat: -1,
      onRepeat: () => {
        fighter.x = resetX;
        fighter.y = Math.round((50 + Math.random() * 120) * s);
      },
    });

    scene.tweens.add({
      targets: fighter,
      y: Math.round(cfg.y * s) + Math.round(4 * s),
      duration: 1500 + i * 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // Hovering saucer with active tractor beam over the wreckage
  const hoverUfo = scene.add.sprite(wreckageX, Math.round(30 * s), "disclosure_ufo_0");
  hoverUfo.setOrigin(0.5, 0.5);
  hoverUfo.setDepth(DEPTH.FLYING + 1);
  hoverUfo.setScale(1.5);
  scene.disclosureElements.push(hoverUfo);

  // Hover bob
  scene.tweens.add({
    targets: hoverUfo,
    y: Math.round(30 * s) + Math.round(6 * s),
    duration: 3000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Visible tractor beam column from hovering UFO to wreckage
  const beamX = wreckageX;
  const beamTop = Math.round(42 * s);
  const beamBottom = pathLevel - Math.round(60 * s);
  const beam = scene.add.rectangle(
    beamX,
    (beamTop + beamBottom) / 2,
    Math.round(20 * s),
    beamBottom - beamTop,
    0x00ffd4,
    0.06
  );
  beam.setDepth(DEPTH.FLYING);
  scene.disclosureElements.push(beam);

  scene.tweens.add({
    targets: beam,
    alpha: { from: 0.03, to: 0.1 },
    scaleX: { from: 0.8, to: 1.2 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Inner beam (brighter, narrower)
  const innerBeam = scene.add.rectangle(
    beamX,
    (beamTop + beamBottom) / 2,
    Math.round(6 * s),
    beamBottom - beamTop,
    0x00ffd4,
    0.12
  );
  innerBeam.setDepth(DEPTH.FLYING);
  scene.disclosureElements.push(innerBeam);

  scene.tweens.add({
    targets: innerBeam,
    alpha: { from: 0.06, to: 0.18 },
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // ========================================================================
  // CREATURES — Greys, Luminites, Mothmen
  // ========================================================================

  // --- GREY ALIENS (ambient wanderers) — more of them for chaos ---
  const greyConfigs = [
    { x: 100, yOff: 8, speed: 0.2 },
    { x: 200, yOff: 10, speed: 0.15 },
    { x: 300, yOff: 6, speed: 0.25 },
    { x: 400, yOff: 9, speed: 0.18 },
    { x: 500, yOff: 7, speed: 0.22 },
    { x: 600, yOff: 8, speed: 0.2 },
    { x: 700, yOff: 10, speed: 0.16 },
    { x: 160, yOff: 6, speed: 0.28 },
  ];

  greyConfigs.forEach((cfg, index) => {
    const baseY = pathLevel + Math.round(cfg.yOff * s);
    const sprite = scene.add.sprite(Math.round(cfg.x * s), baseY, "disclosure_grey");
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(DEPTH.CHARACTERS - 1);
    sprite.setScale(1.2);
    scene.disclosureElements.push(sprite);

    sprite.setInteractive({ useHandCursor: true });
    sprite.on("pointerup", () => {
      if ((scene as any).wasDragGesture) return;
      showAlienProverb(scene, sprite);
    });
    sprite.on("pointerover", () => sprite.setTint(0xccffee));
    sprite.on("pointerout", () => sprite.clearTint());

    // Walking wobble
    scene.tweens.add({
      targets: sprite,
      y: baseY - Math.round(1.5 * s),
      duration: 250 + index * 30,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const grey: DisclosureGrey = {
      sprite,
      targetX: Math.round(cfg.x * s),
      speed: cfg.speed * s,
      direction: Math.random() > 0.5 ? "left" : "right",
      idleTimer: Math.floor(Math.random() * 200),
      isIdle: true,
      baseY,
      stareTimer: 0,
      isStaring: false,
    };

    // Movement AI
    scene.time.addEvent({
      delay: 1500 + index * 600,
      callback: () => {
        if (!sprite.active || scene.currentZone !== "disclosure") return;
        if (grey.isStaring) {
          grey.stareTimer--;
          if (grey.stareTimer <= 0) grey.isStaring = false;
          return;
        }
        const roll = Math.random();
        if (roll > 0.7 && grey.isIdle) {
          grey.isIdle = false;
          grey.targetX = Math.round(100 * s) + Math.random() * Math.round(600 * s);
          grey.direction = grey.targetX > sprite.x ? "right" : "left";
          sprite.setFlipX(grey.direction === "left");
        } else if (roll > 0.9) {
          grey.isStaring = true;
          grey.stareTimer = 3;
          grey.isIdle = true;
        }
      },
      loop: true,
    });

    scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!sprite.active || scene.currentZone !== "disclosure" || grey.isIdle || grey.isStaring)
          return;
        const dx = grey.targetX - sprite.x;
        if (Math.abs(dx) < Math.round(3 * s)) {
          grey.isIdle = true;
          return;
        }
        sprite.x += Math.sign(dx) * grey.speed * 2;
      },
      loop: true,
    });
  });

  // --- LUMINITES (energy beings) ---
  const luminitePositions = [
    { x: 380, y: -90 },
    { x: 420, y: -100 },
    { x: 560, y: -110 },
    { x: 540, y: -85 },
    { x: 200, y: -95 },
    { x: 700, y: -80 },
  ];
  luminitePositions.forEach((pos, i) => {
    const lx = Math.round(pos.x * s);
    const ly = pathLevel + Math.round(pos.y * s);

    const luminite = scene.add.rectangle(
      lx,
      ly,
      Math.round(8 * s),
      Math.round(8 * s),
      0x00ffd4,
      0.5
    );
    luminite.setDepth(DEPTH.FLYING);
    scene.disclosureElements.push(luminite);

    const aura = scene.add.rectangle(
      lx,
      ly,
      Math.round(14 * s),
      Math.round(14 * s),
      0x00ffd4,
      0.15
    );
    aura.setDepth(DEPTH.FLYING - 0.1);
    scene.disclosureElements.push(aura);

    scene.tweens.add({
      targets: [luminite, aura],
      y: ly - Math.round(8 * s),
      x: lx + Math.round((Math.random() - 0.5) * 30 * s),
      duration: 3000 + i * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    scene.tweens.add({
      targets: luminite,
      scaleX: { from: 0.8, to: 1.3 },
      scaleY: { from: 1.2, to: 0.8 },
      alpha: { from: 0.4, to: 0.7 },
      duration: 1500 + i * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    scene.tweens.add({
      targets: aura,
      alpha: { from: 0.1, to: 0.25 },
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      duration: 2000 + i * 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    luminite.setInteractive({ useHandCursor: true });
    luminite.on("pointerup", () => {
      if ((scene as any).wasDragGesture) return;
      showLuminiteStat(scene, luminite);
    });
  });

  // --- MOTHMEN (more of them for chaos) ---
  for (let i = 0; i < 4; i++) {
    const mothStartX = Math.round((-100 + Math.random() * 200) * s);
    const mothStartY = Math.round((50 + Math.random() * 80) * s);

    const moth = scene.add.graphics();
    moth.fillStyle(0x1a1a2e, 0.8);
    moth.fillTriangle(
      0,
      0,
      -Math.round(10 * s),
      Math.round(4 * s),
      -Math.round(6 * s),
      Math.round(1 * s)
    );
    moth.fillTriangle(
      0,
      0,
      Math.round(10 * s),
      Math.round(4 * s),
      Math.round(6 * s),
      Math.round(1 * s)
    );
    moth.fillStyle(0x0a0a0f);
    moth.fillRect(-Math.round(1 * s), -Math.round(1 * s), Math.round(2 * s), Math.round(4 * s));
    moth.fillStyle(0xff0000, 0.8);
    moth.fillRect(-Math.round(2 * s), -Math.round(1 * s), Math.round(1 * s), Math.round(1 * s));
    moth.fillRect(Math.round(1 * s), -Math.round(1 * s), Math.round(1 * s), Math.round(1 * s));

    moth.setPosition(mothStartX, mothStartY);
    moth.setDepth(DEPTH.FLYING);
    scene.disclosureElements.push(moth);

    scene.tweens.add({
      targets: moth,
      x: GAME_WIDTH + Math.round(100 * s),
      duration: 20000 + i * 6000,
      delay: i * 4000,
      repeat: -1,
      onRepeat: () => {
        moth.setPosition(Math.round(-100 * s), Math.round((40 + Math.random() * 100) * s));
      },
    });

    scene.tweens.add({
      targets: moth,
      y: mothStartY + Math.round(10 * s),
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // ========================================================================
  // GROUND ANIMATIONS — alien activity on the surface
  // ========================================================================

  // --- Crop circles forming on the ground (pulsing rings that fade in/out) ---
  const cropCircleSpots = [
    { x: 180, yOff: 50 },
    { x: 450, yOff: 55 },
    { x: 680, yOff: 48 },
  ];
  cropCircleSpots.forEach((spot, i) => {
    const cx = Math.round(spot.x * s);
    const cy = grassTop + Math.round(spot.yOff * s);

    // Outer ring
    const outerRing = scene.add.ellipse(
      cx,
      cy,
      Math.round(40 * s),
      Math.round(12 * s),
      0x00ffd4,
      0
    );
    outerRing.setStrokeStyle(Math.round(1.5 * s), 0x00ffd4, 0.3);
    outerRing.setDepth(DEPTH.PATH + 0.1);
    outerRing.setFillStyle(0x00ffd4, 0);
    scene.disclosureElements.push(outerRing);

    // Inner ring
    const innerRing = scene.add.ellipse(cx, cy, Math.round(22 * s), Math.round(7 * s), 0x00ffd4, 0);
    innerRing.setStrokeStyle(Math.round(1 * s), 0x00ffd4, 0.2);
    innerRing.setDepth(DEPTH.PATH + 0.1);
    innerRing.setFillStyle(0x00ffd4, 0);
    scene.disclosureElements.push(innerRing);

    // Center glow dot
    const centerDot = scene.add.circle(cx, cy, Math.round(3 * s), 0x00ffd4, 0.15);
    centerDot.setDepth(DEPTH.PATH + 0.1);
    scene.disclosureElements.push(centerDot);

    // Pulse animation — crop circle fades in, glows, fades out
    const pulseDelay = i * 6000;
    scene.time.addEvent({
      delay: 12000,
      startAt: pulseDelay,
      callback: () => {
        if (scene.currentZone !== "disclosure") return;
        // Fade in
        scene.tweens.add({
          targets: outerRing,
          alpha: 0.5,
          duration: 1500,
          yoyo: true,
          hold: 2000,
          ease: "Sine.easeInOut",
        });
        scene.tweens.add({
          targets: innerRing,
          alpha: 0.4,
          duration: 1500,
          yoyo: true,
          hold: 2000,
          ease: "Sine.easeInOut",
          delay: 300,
        });
        scene.tweens.add({
          targets: centerDot,
          alpha: 0.5,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 1500,
          yoyo: true,
          hold: 2000,
          ease: "Sine.easeInOut",
          delay: 500,
        });
      },
      loop: true,
    });
  });

  // --- Ground scorch marks with sparking energy ---
  const scorchSpots = [
    { x: 320, yOff: 52 },
    { x: 520, yOff: 46 },
    { x: 120, yOff: 53 },
    { x: 720, yOff: 50 },
  ];
  scorchSpots.forEach((spot, i) => {
    const sx = Math.round(spot.x * s);
    const sy = grassTop + Math.round(spot.yOff * s);

    // Dark scorch mark on ground
    const scorch = scene.add.ellipse(sx, sy, Math.round(18 * s), Math.round(6 * s), 0x1a0a2e, 0.4);
    scorch.setDepth(DEPTH.PATH + 0.05);
    scene.disclosureElements.push(scorch);

    // Periodic spark burst from the scorch mark
    scene.time.addEvent({
      delay: 7000 + i * 2500,
      callback: () => {
        if (scene.currentZone !== "disclosure") return;
        for (let j = 0; j < 3; j++) {
          const spark = scene.add.rectangle(
            sx + Math.round((Math.random() - 0.5) * 10 * s),
            sy - Math.round(2 * s),
            Math.round(2 * s),
            Math.round(2 * s),
            0x00ffd4,
            0.8
          );
          spark.setDepth(DEPTH.PROPS_HIGH + 1);
          scene.disclosureElements.push(spark);

          scene.tweens.add({
            targets: spark,
            x: spark.x + Math.round((Math.random() - 0.5) * 20 * s),
            y: spark.y - Math.round((5 + Math.random() * 15) * s),
            alpha: 0,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 500 + Math.random() * 400,
            ease: "Quad.easeOut",
            onComplete: () => {
              spark.destroy();
              const idx = scene.disclosureElements.indexOf(spark);
              if (idx !== -1) scene.disclosureElements.splice(idx, 1);
            },
          });
        }
      },
      loop: true,
    });
  });

  // --- Dust clouds kicked up by hovering craft ---
  const dustSpots = [wreckageX, Math.round(300 * s), Math.round(600 * s)];
  dustSpots.forEach((dx, i) => {
    scene.time.addEvent({
      delay: 5000 + i * 3000,
      callback: () => {
        if (scene.currentZone !== "disclosure") return;
        // Spawn a small dust puff at ground level
        const dustX = dx + Math.round((Math.random() - 0.5) * 60 * s);
        const dustY = grassTop + Math.round(45 * s);
        const dust = scene.add.ellipse(
          dustX,
          dustY,
          Math.round(12 * s),
          Math.round(4 * s),
          0xd4a76a,
          0.3
        );
        dust.setDepth(DEPTH.PROPS_LOW + 0.5);
        scene.disclosureElements.push(dust);

        scene.tweens.add({
          targets: dust,
          scaleX: 2.5,
          scaleY: 1.8,
          alpha: 0,
          duration: 2000,
          ease: "Quad.easeOut",
          onComplete: () => {
            dust.destroy();
            const idx = scene.disclosureElements.indexOf(dust);
            if (idx !== -1) scene.disclosureElements.splice(idx, 1);
          },
        });
      },
      loop: true,
    });
  });

  // --- Ground portals opening and closing ---
  scene.time.addEvent({
    delay: 18000,
    callback: () => {
      if (scene.currentZone !== "disclosure") return;
      const portalX = Math.round((100 + Math.random() * 600) * s);
      const portalY = grassTop + Math.round((42 + Math.random() * 12) * s);

      // Outer glow
      const portalGlow = scene.add.ellipse(
        portalX,
        portalY,
        Math.round(4 * s),
        Math.round(2 * s),
        0x2d0a4e,
        0.6
      );
      portalGlow.setDepth(DEPTH.PATH + 0.2);
      scene.disclosureElements.push(portalGlow);

      // Inner vortex
      const portalCore = scene.add.ellipse(
        portalX,
        portalY,
        Math.round(2 * s),
        Math.round(1 * s),
        0x00ffd4,
        0.8
      );
      portalCore.setDepth(DEPTH.PATH + 0.3);
      scene.disclosureElements.push(portalCore);

      // Open
      scene.tweens.add({
        targets: portalGlow,
        scaleX: 6,
        scaleY: 4,
        alpha: 0.4,
        duration: 1200,
        ease: "Back.easeOut",
        yoyo: true,
        hold: 3000,
        onComplete: () => {
          portalGlow.destroy();
          const idx = scene.disclosureElements.indexOf(portalGlow);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });
      scene.tweens.add({
        targets: portalCore,
        scaleX: 4,
        scaleY: 3,
        alpha: 0.6,
        duration: 1000,
        ease: "Back.easeOut",
        yoyo: true,
        hold: 3200,
        onComplete: () => {
          portalCore.destroy();
          const idx = scene.disclosureElements.indexOf(portalCore);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });
    },
    loop: true,
  });

  // --- Impact craters — random small explosions/impacts on ground ---
  scene.time.addEvent({
    delay: 10000,
    callback: () => {
      if (scene.currentZone !== "disclosure") return;
      const impactX = Math.round((80 + Math.random() * 640) * s);
      const impactY = grassTop + Math.round((40 + Math.random() * 15) * s);

      // Flash circle
      const impactFlash = scene.add.circle(impactX, impactY, Math.round(3 * s), 0x39ff14, 0.7);
      impactFlash.setDepth(DEPTH.PROPS_HIGH + 1);
      scene.disclosureElements.push(impactFlash);

      // Expanding shockwave ring
      const shockwave = scene.add.circle(impactX, impactY, Math.round(2 * s), 0x39ff14, 0);
      shockwave.setStrokeStyle(Math.round(1 * s), 0x39ff14, 0.5);
      shockwave.setDepth(DEPTH.PROPS_HIGH + 1);
      scene.disclosureElements.push(shockwave);

      // Debris particles
      for (let d = 0; d < 5; d++) {
        const debris = scene.add.rectangle(
          impactX,
          impactY,
          Math.round((1 + Math.random()) * s),
          Math.round((1 + Math.random()) * s),
          0xd4a76a,
          0.8
        );
        debris.setDepth(DEPTH.PROPS_HIGH + 1);
        scene.disclosureElements.push(debris);

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.round((15 + Math.random() * 25) * s);
        scene.tweens.add({
          targets: debris,
          x: impactX + Math.cos(angle) * dist,
          y: impactY + Math.sin(angle) * dist * 0.4 - Math.round(8 * s),
          alpha: 0,
          duration: 600 + Math.random() * 400,
          ease: "Quad.easeOut",
          onComplete: () => {
            debris.destroy();
            const idx = scene.disclosureElements.indexOf(debris);
            if (idx !== -1) scene.disclosureElements.splice(idx, 1);
          },
        });
      }

      // Flash fade
      scene.tweens.add({
        targets: impactFlash,
        alpha: 0,
        scaleX: 3,
        scaleY: 3,
        duration: 400,
        onComplete: () => {
          impactFlash.destroy();
          const idx = scene.disclosureElements.indexOf(impactFlash);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });

      // Shockwave expand
      scene.tweens.add({
        targets: shockwave,
        scaleX: 6,
        scaleY: 3,
        alpha: 0,
        duration: 800,
        ease: "Quad.easeOut",
        onComplete: () => {
          shockwave.destroy();
          const idx = scene.disclosureElements.indexOf(shockwave);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });
    },
    loop: true,
  });

  // --- Teal energy veins pulsing across the ground ---
  const veinPaths = [
    { x1: 50, x2: 250, yOff: 47 },
    { x1: 350, x2: 550, yOff: 50 },
    { x1: 500, x2: 750, yOff: 44 },
  ];
  veinPaths.forEach((vein, i) => {
    const startX = Math.round(vein.x1 * s);
    const endX = Math.round(vein.x2 * s);
    const vy = grassTop + Math.round(vein.yOff * s);
    const veinW = endX - startX;

    // Static dim vein line
    const veinLine = scene.add.rectangle(
      (startX + endX) / 2,
      vy,
      veinW,
      Math.round(1.5 * s),
      0x00ffd4,
      0.08
    );
    veinLine.setDepth(DEPTH.PATH + 0.05);
    scene.disclosureElements.push(veinLine);

    // Traveling pulse dot that moves along the vein
    const pulse = scene.add.circle(startX, vy, Math.round(3 * s), 0x00ffd4, 0.5);
    pulse.setDepth(DEPTH.PATH + 0.1);
    scene.disclosureElements.push(pulse);

    scene.tweens.add({
      targets: pulse,
      x: endX,
      duration: 3000 + i * 800,
      delay: i * 2000,
      repeat: -1,
      ease: "Sine.easeInOut",
      onRepeat: () => {
        pulse.x = startX;
      },
    });

    scene.tweens.add({
      targets: pulse,
      alpha: { from: 0.3, to: 0.7 },
      scaleX: { from: 0.8, to: 1.3 },
      scaleY: { from: 0.8, to: 1.3 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // --- Levitating objects (crates/rocks floating up in tractor beams) ---
  scene.time.addEvent({
    delay: 14000,
    callback: () => {
      if (scene.currentZone !== "disclosure") return;
      const objX = Math.round((120 + Math.random() * 560) * s);
      const objY = pathLevel;
      const isCrate = Math.random() > 0.5;

      const floating = scene.add.rectangle(
        objX,
        objY,
        Math.round((isCrate ? 8 : 5) * s),
        Math.round((isCrate ? 6 : 4) * s),
        isCrate ? 0x4a5534 : 0xb49a6a,
        0.7
      );
      floating.setDepth(DEPTH.CHARACTERS + 1);
      scene.disclosureElements.push(floating);

      // Teal glow under it
      const liftGlow = scene.add.ellipse(
        objX,
        objY + Math.round(2 * s),
        Math.round(12 * s),
        Math.round(4 * s),
        0x00ffd4,
        0.2
      );
      liftGlow.setDepth(DEPTH.PATH + 0.2);
      scene.disclosureElements.push(liftGlow);

      // Float up and vanish
      scene.tweens.add({
        targets: floating,
        y: objY - Math.round(180 * s),
        angle: 360,
        alpha: 0,
        duration: 4000,
        ease: "Quad.easeIn",
        onComplete: () => {
          floating.destroy();
          const idx = scene.disclosureElements.indexOf(floating);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });

      // Ground glow fades
      scene.tweens.add({
        targets: liftGlow,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 2000,
        ease: "Quad.easeIn",
        onComplete: () => {
          liftGlow.destroy();
          const idx = scene.disclosureElements.indexOf(liftGlow);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });
    },
    loop: true,
  });

  // ========================================================================
  // ATMOSPHERIC EFFECTS — cranked up for chaos
  // ========================================================================

  // Scan beam sweep (more frequent)
  scene.time.addEvent({
    delay: 15000,
    callback: () => {
      if (scene.currentZone !== "disclosure") return;
      const beam = scene.add.rectangle(
        -Math.round(50 * s),
        Math.round((200 + Math.random() * 300) * s),
        Math.round(80 * s),
        Math.round(3 * s),
        0x00ffd4,
        0.3
      );
      beam.setDepth(DEPTH.FLYING + 1);
      scene.disclosureElements.push(beam);

      scene.tweens.add({
        targets: beam,
        x: GAME_WIDTH + Math.round(50 * s),
        duration: 3000,
        ease: "Linear",
        onComplete: () => {
          beam.destroy();
          const idx = scene.disclosureElements.indexOf(beam);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });
    },
    loop: true,
  });

  // Random teal energy flashes in the sky (lightning-like)
  scene.time.addEvent({
    delay: 8000,
    callback: () => {
      if (scene.currentZone !== "disclosure") return;
      const flashX = Math.round((100 + Math.random() * 600) * s);
      const flashY = Math.round((30 + Math.random() * 120) * s);
      const flash = scene.add.rectangle(
        flashX,
        flashY,
        Math.round((20 + Math.random() * 40) * s),
        Math.round(2 * s),
        0x00ffd4,
        0.5
      );
      flash.setDepth(DEPTH.FLYING + 2);
      flash.setAngle(-20 + Math.random() * 40);
      scene.disclosureElements.push(flash);

      scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          flash.destroy();
          const idx = scene.disclosureElements.indexOf(flash);
          if (idx !== -1) scene.disclosureElements.splice(idx, 1);
        },
      });
    },
    loop: true,
  });

  // Floating spore particles (denser)
  const sporeEmitter = scene.add.particles(GAME_WIDTH / 2, pathLevel, "green_smoke", {
    speedY: { min: -10, max: -25 },
    speedX: { min: -5, max: 5 },
    scale: { start: 0.08, end: 0.15 },
    alpha: { start: 0.3, end: 0 },
    tint: 0x00ffd4,
    lifespan: { min: 4000, max: 8000 },
    frequency: 400,
    quantity: 2,
    x: { min: -Math.round(400 * s), max: Math.round(400 * s) },
  });
  sporeEmitter.setDepth(DEPTH.FLYING);
  scene.disclosureElements.push(sporeEmitter);

  // Sky spore particles (higher altitude, faint)
  const skySpores = scene.add.particles(GAME_WIDTH / 2, Math.round(100 * s), "green_smoke", {
    speedY: { min: -5, max: -15 },
    speedX: { min: -8, max: 8 },
    scale: { start: 0.05, end: 0.1 },
    alpha: { start: 0.15, end: 0 },
    tint: 0x00ffd4,
    lifespan: { min: 5000, max: 10000 },
    frequency: 600,
    quantity: 1,
    x: { min: -Math.round(500 * s), max: Math.round(500 * s) },
  });
  skySpores.setDepth(DEPTH.FLYING - 1);
  scene.disclosureElements.push(skySpores);
}

// ============================================================================
// HELPER: Show alien proverb tooltip when clicking a Grey
// ============================================================================
function showAlienProverb(scene: WorldScene, sprite: Phaser.GameObjects.Sprite): void {
  const s = SCALE;
  const proverb = ALIEN_PROVERBS[Math.floor(Math.random() * ALIEN_PROVERBS.length)];

  const tooltipBg = scene.add.rectangle(
    sprite.x,
    sprite.y - Math.round(30 * s),
    Math.round(180 * s),
    Math.round(28 * s),
    0x0a0a0f,
    0.9
  );
  tooltipBg.setDepth(DEPTH.UI_LOW);
  tooltipBg.setStrokeStyle(1, 0x00ffd4);
  scene.disclosureElements.push(tooltipBg);

  const tooltipText = scene.add.text(sprite.x, sprite.y - Math.round(30 * s), proverb, {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${Math.round(5 * s)}px`,
    color: "#00ffd4",
    align: "center",
    wordWrap: { width: Math.round(170 * s) },
  });
  tooltipText.setOrigin(0.5, 0.5);
  tooltipText.setDepth(DEPTH.UI_LOW + 1);
  scene.disclosureElements.push(tooltipText);

  scene.time.delayedCall(3000, () => {
    scene.tweens.add({
      targets: [tooltipBg, tooltipText],
      alpha: 0,
      duration: 300,
      onComplete: () => {
        tooltipBg.destroy();
        tooltipText.destroy();
        const bgIdx = scene.disclosureElements.indexOf(tooltipBg);
        if (bgIdx !== -1) scene.disclosureElements.splice(bgIdx, 1);
        const txtIdx = scene.disclosureElements.indexOf(tooltipText);
        if (txtIdx !== -1) scene.disclosureElements.splice(txtIdx, 1);
      },
    });
  });
}

// ============================================================================
// HELPER: Show luminite stat when clicked
// ============================================================================
function showLuminiteStat(scene: WorldScene, luminite: Phaser.GameObjects.Rectangle): void {
  const s = SCALE;

  const stats = [
    "FREQUENCY DETECTED: BagsWorld online",
    "SIGNAL STRENGTH: Maximum",
    "SCANNING... entities detected in zone",
    "TRANSMISSION: The disclosure is imminent",
    "DATA BURST: Solana block time nominal",
    "OBSERVATION: Human trading patterns... fascinating",
  ];
  const stat = stats[Math.floor(Math.random() * stats.length)];

  const statText = scene.add.text(luminite.x, luminite.y - Math.round(20 * s), stat, {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${Math.round(5 * s)}px`,
    color: "#00ffd4",
    align: "center",
  });
  statText.setOrigin(0.5, 0.5);
  statText.setDepth(DEPTH.UI_LOW);
  scene.disclosureElements.push(statText);

  scene.tweens.add({
    targets: statText,
    y: statText.y - Math.round(30 * s),
    alpha: 0,
    duration: 2500,
    ease: "Quad.easeOut",
    onComplete: () => {
      statText.destroy();
      const idx = scene.disclosureElements.indexOf(statText);
      if (idx !== -1) scene.disclosureElements.splice(idx, 1);
    },
  });
}
