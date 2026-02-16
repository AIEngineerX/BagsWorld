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

    // Slow rolling animation
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

    // Slow pan rotation
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

    // Pulsing glow animation (3-second cycle)
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

  // Energy conduit lines on ground (glowing teal connecting wreckage to other buildings)
  const conduitPaths = [
    { x1: 400, x2: 580, y: 48 }, // Wreckage to Signal Tower
    { x1: 400, x2: 230, y: 45 }, // Wreckage to Hangar 18
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

    // Pulse along the conduit
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
  // BUILDINGS (depth 5-7) — 6 interactive structures
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

  // Wreckage label
  createBuildingLabel(scene, wreckageX, pathLevel, "THE WRECKAGE", 0x00ffd4, Math.round(90 * s));

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

  createBuildingLabel(scene, aaroX, pathLevel, "AARO FIELD\nOFFICE", 0xef4444, Math.round(80 * s));

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

  createBuildingLabel(scene, bazaarX, pathLevel, "XENOBAZAAR", 0x00ffd4, Math.round(82 * s));

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

  createBuildingLabel(scene, towerX, pathLevel, "SIGNAL\nTOWER", 0x00ffd4, Math.round(70 * s));

  // Signal tower pulse rings (expanding circles)
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

  createBuildingLabel(scene, hangarX, pathLevel, "HANGAR 18", 0x9ca3af, Math.round(78 * s));

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

  createBuildingLabel(
    scene,
    cantinaX,
    pathLevel,
    "CROP CIRCLE\nCANTINA",
    0x39ff14,
    Math.round(85 * s)
  );

  // ========================================================================
  // CREATURES — Greys, Luminites, Mothmen
  // ========================================================================

  // --- GREY ALIENS (ambient wanderers) ---
  const greyConfigs = [
    { x: 280, yOff: 8, speed: 0.2 },
    { x: 350, yOff: 10, speed: 0.15 },
    { x: 420, yOff: 6, speed: 0.25 },
    { x: 500, yOff: 9, speed: 0.18 },
    { x: 600, yOff: 7, speed: 0.22 },
  ];

  const disclosureGreys: DisclosureGrey[] = [];

  greyConfigs.forEach((cfg, index) => {
    const baseY = pathLevel + Math.round(cfg.yOff * s);
    const sprite = scene.add.sprite(Math.round(cfg.x * s), baseY, "disclosure_grey");
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(DEPTH.CHARACTERS - 1);
    sprite.setScale(1.2);
    scene.disclosureElements.push(sprite);

    // Make clickable for alien proverbs
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
    disclosureGreys.push(grey);

    // Movement AI: quick bursts with pauses, occasional stare
    scene.time.addEvent({
      delay: 1500 + index * 600,
      callback: () => {
        if (!sprite.active || scene.currentZone !== "disclosure") return;

        if (grey.isStaring) {
          grey.stareTimer--;
          if (grey.stareTimer <= 0) {
            grey.isStaring = false;
          }
          return;
        }

        const roll = Math.random();
        if (roll > 0.7 && grey.isIdle) {
          // Start moving (quick burst)
          grey.isIdle = false;
          grey.targetX = Math.round(100 * s) + Math.random() * Math.round(600 * s);
          grey.direction = grey.targetX > sprite.x ? "right" : "left";
          sprite.setFlipX(grey.direction === "left");
        } else if (roll > 0.9) {
          // Stare at camera for 2 seconds
          grey.isStaring = true;
          grey.stareTimer = 3;
          grey.isIdle = true;
        }
      },
      loop: true,
    });

    // Actual movement update
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
        const moveX = Math.sign(dx) * grey.speed * 2;
        sprite.x += moveX;
      },
      loop: true,
    });
  });

  // --- LUMINITES (energy beings near Signal Tower / Wreckage) ---
  const luminitePositions = [
    { x: 380, y: -90 },
    { x: 420, y: -100 },
    { x: 560, y: -110 },
    { x: 540, y: -85 },
  ];
  luminitePositions.forEach((pos, i) => {
    const lx = Math.round(pos.x * s);
    const ly = pathLevel + Math.round(pos.y * s);

    // Create as a glowing rectangle (amorphous blob)
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

    // Glow aura
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

    // Floating bob animation
    scene.tweens.add({
      targets: [luminite, aura],
      y: ly - Math.round(8 * s),
      x: lx + Math.round((Math.random() - 0.5) * 30 * s),
      duration: 3000 + i * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Shape-shift pulse (size oscillation)
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

    // Make luminites clickable - show random world stat
    luminite.setInteractive({ useHandCursor: true });
    luminite.on("pointerup", () => {
      if ((scene as any).wasDragGesture) return;
      showLuminiteStat(scene, luminite);
    });
  });

  // --- MOTHMEN (rare flying silhouettes, depth 15) ---
  for (let i = 0; i < 2; i++) {
    const mothStartX = Math.round((-100 + Math.random() * 200) * s);
    const mothStartY = Math.round((50 + Math.random() * 80) * s);

    const moth = scene.add.graphics();
    // Dark winged silhouette
    moth.fillStyle(0x1a1a2e, 0.8);
    // Left wing
    moth.fillTriangle(
      0,
      0,
      -Math.round(10 * s),
      Math.round(4 * s),
      -Math.round(6 * s),
      Math.round(1 * s)
    );
    // Right wing
    moth.fillTriangle(
      0,
      0,
      Math.round(10 * s),
      Math.round(4 * s),
      Math.round(6 * s),
      Math.round(1 * s)
    );
    // Body
    moth.fillStyle(0x0a0a0f);
    moth.fillRect(-Math.round(1 * s), -Math.round(1 * s), Math.round(2 * s), Math.round(4 * s));
    // Red glowing eyes
    moth.fillStyle(0xff0000, 0.8);
    moth.fillRect(-Math.round(2 * s), -Math.round(1 * s), Math.round(1 * s), Math.round(1 * s));
    moth.fillRect(Math.round(1 * s), -Math.round(1 * s), Math.round(1 * s), Math.round(1 * s));

    moth.setPosition(mothStartX, mothStartY);
    moth.setDepth(DEPTH.FLYING);
    scene.disclosureElements.push(moth);

    // Slow fly across screen
    scene.tweens.add({
      targets: moth,
      x: GAME_WIDTH + Math.round(100 * s),
      duration: 25000 + i * 8000,
      delay: i * 10000,
      repeat: -1,
      onRepeat: () => {
        moth.setPosition(Math.round(-100 * s), Math.round((40 + Math.random() * 100) * s));
      },
    });

    // Gentle vertical bob (wing flap)
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
  // ATMOSPHERIC EFFECTS
  // ========================================================================

  // Scan beam sweep (horizontal teal line sweeps left-to-right every 30s)
  scene.time.addEvent({
    delay: 30000,
    callback: () => {
      if (scene.currentZone !== "disclosure") return;
      const beam = scene.add.rectangle(
        -Math.round(50 * s),
        Math.round(350 * s),
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

  // Floating spore particles (tiny 1px dots drifting upward from ground)
  const sporeEmitter = scene.add.particles(GAME_WIDTH / 2, pathLevel, "green_smoke", {
    speedY: { min: -10, max: -25 },
    speedX: { min: -5, max: 5 },
    scale: { start: 0.08, end: 0.15 },
    alpha: { start: 0.3, end: 0 },
    tint: 0x00ffd4,
    lifespan: { min: 4000, max: 8000 },
    frequency: 800,
    quantity: 1,
    x: { min: -Math.round(400 * s), max: Math.round(400 * s) },
  });
  sporeEmitter.setDepth(DEPTH.FLYING);
  scene.disclosureElements.push(sporeEmitter);
}

// ============================================================================
// HELPER: Create building label with background
// ============================================================================
function createBuildingLabel(
  scene: WorldScene,
  x: number,
  pathLevel: number,
  text: string,
  color: number,
  bgWidth: number
): void {
  const s = SCALE;
  const colorHex = "#" + color.toString(16).padStart(6, "0");
  const labelY = pathLevel + Math.round(18 * s);

  const labelBg = scene.add.rectangle(x, labelY, bgWidth, Math.round(24 * s), 0x000000, 0.7);
  labelBg.setDepth(DEPTH.SIGNS_BG);
  labelBg.setStrokeStyle(1, color);
  scene.disclosureElements.push(labelBg);

  const label = scene.add.text(x, labelY, text, {
    fontFamily: "monospace",
    fontSize: `${Math.round(8 * s)}px`,
    color: colorHex,
    align: "center",
  });
  label.setOrigin(0.5, 0.5);
  label.setDepth(DEPTH.SIGNS_TEXT);
  scene.disclosureElements.push(label);
}

// ============================================================================
// HELPER: Show alien proverb tooltip when clicking a Grey
// ============================================================================
function showAlienProverb(scene: WorldScene, sprite: Phaser.GameObjects.Sprite): void {
  const s = SCALE;
  const proverb = ALIEN_PROVERBS[Math.floor(Math.random() * ALIEN_PROVERBS.length)];

  // Tooltip background
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

  // Auto-dismiss after 3 seconds
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

  // Generate a random world stat message
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

  // Float up and fade
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
