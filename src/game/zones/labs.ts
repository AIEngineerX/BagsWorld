import * as Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { SCALE, Y } from "../textures/constants";

export function setupLabsZone(scene: WorldScene): void {
  // Create tech-themed twilight sky
  createLabsSky(scene);

  scene.ground.setVisible(true);
  scene.ground.setTexture("labs_ground");

  // Check if elements were destroyed (can happen during transitions)
  const elementsValid =
    scene.labsElements.length > 0 && scene.labsElements.every((el) => (el as any).active !== false);

  if (!elementsValid && scene.labsZoneCreated) {
    scene.labsElements = [];
    scene.labsZoneCreated = false;
  }

  if (!scene.labsZoneCreated) {
    createLabsDecorations(scene);
    scene.labsZoneCreated = true;
  } else {
    scene.labsElements.forEach((el) => (el as any).setVisible(true));
  }
}

/**
 * Create futuristic tech sky for Labs zone
 */
function createLabsSky(scene: WorldScene): void {
  scene.restoreNormalSky();
}

/**
 * Create Tech Labs decorations - Bags.FM HQ environment
 * Features single large HQ building with green-themed props
 */
function createLabsDecorations(scene: WorldScene): void {
  const s = SCALE;
  const grassTop = Y.GRASS_TOP;
  const pathLevel = Y.PATH_LEVEL;

  // === TECH TREES (depth 2) - Digital/circuit pattern trees ===
  const treePositions = [
    { x: 60, yOffset: 0 },
    { x: 180, yOffset: 5 },
    { x: 380, yOffset: -3 },
    { x: 580, yOffset: 8 },
    { x: 720, yOffset: 2 },
  ];

  treePositions.forEach((pos) => {
    const tree = scene.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "labs_prop_1");
    tree.setOrigin(0.5, 1);
    tree.setDepth(2);
    tree.setScale(0.9 + Math.random() * 0.3);
    scene.labsElements.push(tree);

    // Subtle pulse animation for tech trees
    scene.tweens.add({
      targets: tree,
      alpha: { from: 0.85, to: 1 },
      duration: 1500 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === SERVER RACKS (depth 2) - Small server units ===
  const serverPositions = [
    { x: 120, yOffset: 20 },
    { x: 300, yOffset: 25 },
    { x: 480, yOffset: 22 },
    { x: 660, yOffset: 24 },
  ];

  serverPositions.forEach((pos) => {
    const server = scene.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "labs_prop_2");
    server.setOrigin(0.5, 1);
    server.setDepth(2);
    server.setScale(0.85 + Math.random() * 0.2);
    scene.labsElements.push(server);
  });

  // === HOLO DISPLAYS (depth 2) ===
  const holoPositions = [150, 350, 550, 750];
  holoPositions.forEach((hx) => {
    const holo = scene.add.sprite(Math.round(hx * s), grassTop + Math.round(28 * s), "labs_prop_0");
    holo.setOrigin(0.5, 1);
    holo.setDepth(2);
    holo.setScale(0.8 + Math.random() * 0.3);
    scene.labsElements.push(holo);

    // Floating animation for holo displays
    scene.tweens.add({
      targets: holo,
      y: grassTop + Math.round(25 * s),
      duration: 2000 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === BAGS.FM HQ (depth 5) - Single large building in center ===
  const hqX = Math.round(420 * s); // Center of zone
  const hqSprite = scene.add.sprite(hqX, pathLevel, "labs_hq");
  hqSprite.setOrigin(0.5, 1);
  hqSprite.setDepth(5);

  // Make HQ interactive — explicit hit area for reliable clicking
  const hqW = hqSprite.width;
  const hqH = hqSprite.height;
  hqSprite.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, hqW, hqH),
    Phaser.Geom.Rectangle.Contains
  );
  hqSprite.input!.cursor = "pointer";
  hqSprite.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    showLabsPopup(scene, "corp");
  });
  hqSprite.on("pointerover", () => {
    hqSprite.setTint(0xbbf7d0); // Light green tint on hover
    scene.tweens.add({
      targets: hqSprite,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
      ease: "Power2",
    });
  });
  hqSprite.on("pointerout", () => {
    hqSprite.clearTint();
    scene.tweens.add({
      targets: hqSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: "Power2",
    });
  });

  scene.labsElements.push(hqSprite);

  // HQ label with Bags.FM green theme
  const labelBg = scene.add.rectangle(
    hqX,
    pathLevel + Math.round(18 * s),
    Math.round(90 * s),
    Math.round(24 * s),
    0x0a1a0f,
    0.9
  );
  labelBg.setDepth(6);
  labelBg.setStrokeStyle(1, 0x4ade80);
  labelBg.setInteractive({ useHandCursor: true });
  labelBg.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    showLabsPopup(scene, "corp");
  });
  scene.labsElements.push(labelBg);

  const label = scene.add.text(hqX, pathLevel + Math.round(18 * s), "BAGS.FM\nHQ", {
    fontFamily: "monospace",
    fontSize: `${Math.round(8 * s)}px`,
    color: "#4ade80",
    align: "center",
  });
  label.setOrigin(0.5, 0.5);
  label.setDepth(7);
  scene.labsElements.push(label);

  // === DATA TERMINALS (depth 3) ===
  const terminalPositions = [100, 320, 520, 760];
  terminalPositions.forEach((tx) => {
    const terminal = scene.add.sprite(Math.round(tx * s), pathLevel, "labs_prop_3");
    terminal.setOrigin(0.5, 1);
    terminal.setDepth(3);
    scene.labsElements.push(terminal);

    // Terminal screen flicker effect
    scene.tweens.add({
      targets: terminal,
      alpha: { from: 0.9, to: 1 },
      duration: 100,
      yoyo: true,
      repeat: -1,
      repeatDelay: 2000 + Math.random() * 3000,
    });
  });

  // === ENERGY CORES (depth 3) - Ambient energy nodes ===
  const corePositions = [250, 550];
  corePositions.forEach((cx) => {
    const core = scene.add.sprite(Math.round(cx * s), grassTop + Math.round(35 * s), "labs_prop_4");
    core.setOrigin(0.5, 1);
    core.setDepth(3);
    scene.labsElements.push(core);

    // Pulsing glow effect
    scene.tweens.add({
      targets: core,
      scaleX: { from: 0.95, to: 1.05 },
      scaleY: { from: 0.95, to: 1.05 },
      alpha: { from: 0.8, to: 1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === DRONE DOCKS (depth 3) ===
  const dronePositions = [680];
  dronePositions.forEach((dx) => {
    const drone = scene.add.sprite(
      Math.round(dx * s),
      grassTop + Math.round(20 * s),
      "labs_prop_5"
    );
    drone.setOrigin(0.5, 1);
    drone.setDepth(3);
    scene.labsElements.push(drone);

    // Subtle hover animation
    scene.tweens.add({
      targets: drone,
      y: grassTop + Math.round(15 * s),
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === FLOOR GLOW EFFECT (depth 1) - Bags.FM green ambient lighting under HQ ===
  const hqGlow = scene.add.ellipse(
    Math.round(420 * s),
    pathLevel + Math.round(5 * s),
    Math.round(160 * s),
    Math.round(30 * s),
    0x4ade80,
    0.2
  );
  hqGlow.setDepth(1);
  scene.labsElements.push(hqGlow);

  // Pulsing glow effect
  scene.tweens.add({
    targets: hqGlow,
    alpha: { from: 0.15, to: 0.25 },
    scaleX: { from: 0.95, to: 1.05 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

/**
 * Show Labs popup for building info
 */
function showLabsPopup(scene: WorldScene, type: string): void {
  window.dispatchEvent(new CustomEvent(`bagsworld-${type}-click`));
}
