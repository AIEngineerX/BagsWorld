import * as Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { SCALE, Y } from "../textures/constants";

const GAME_WIDTH = 1280;

// Beach crabs/lobsters - ambient creatures that wander MoltBeach
interface BeachCrab {
  characterId: string;
  sprite: Phaser.GameObjects.Sprite;
  targetX: number;
  speed: number;
  direction: "left" | "right";
  idleTimer: number;
  isIdle: boolean;
  baseY: number;
  isLobster: boolean;
}

export function setupMoltbookZone(scene: WorldScene): void {
  // Restore normal sky (beach has sunny tropical sky)
  scene.restoreNormalSky();

  scene.ground.setVisible(true);
  scene.ground.setTexture("beach_ground");

  // Check if elements were destroyed (can happen during transitions)
  const elementsValid =
    scene.moltbookElements.length > 0 &&
    scene.moltbookElements.every((el) => (el as any).active !== false);

  if (!elementsValid && scene.moltbookZoneCreated) {
    scene.moltbookElements = [];
    scene.moltbookZoneCreated = false;
  }

  if (!scene.moltbookZoneCreated) {
    createMoltbookDecorations(scene);
    scene.moltbookZoneCreated = true;
  } else {
    scene.moltbookElements.forEach((el) => (el as any).setVisible(true));
  }
}

/**
 * Create Moltbook Beach decorations - tropical paradise
 * Features palm trees, beach items, Moltbook HQ, and wave animation
 */
function createMoltbookDecorations(scene: WorldScene): void {
  const s = SCALE;
  const grassTop = Y.GRASS_TOP;
  const pathLevel = Y.PATH_LEVEL;

  // === PALM TREES (depth 2) - Multiple variants ===
  const palmPositions = [
    { x: 40, type: 1 },
    { x: 150, type: 2 },
    { x: 320, type: 3 },
    { x: 480, type: 1 },
    { x: 620, type: 2 },
    { x: 750, type: 3 },
  ];

  palmPositions.forEach((pos) => {
    const palm = scene.add.sprite(Math.round(pos.x * s), grassTop, `palm_tree_${pos.type}`);
    palm.setOrigin(0.5, 1);
    palm.setDepth(2);
    palm.setScale(0.9 + Math.random() * 0.2);
    scene.moltbookElements.push(palm);

    // Gentle swaying animation
    scene.tweens.add({
      targets: palm,
      angle: { from: -2, to: 2 },
      duration: 3000 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === BEACH UMBRELLAS (depth 3) ===
  const umbrellaPositions = [100, 280, 550, 700];
  umbrellaPositions.forEach((ux) => {
    const umbrella = scene.add.sprite(
      Math.round(ux * s),
      grassTop + Math.round(30 * s),
      "beach_umbrella"
    );
    umbrella.setOrigin(0.5, 1);
    umbrella.setDepth(3);
    umbrella.setScale(0.8 + Math.random() * 0.3);
    scene.moltbookElements.push(umbrella);
  });

  // === BEACH CHAIRS (depth 3) - near umbrellas ===
  const chairPositions = [115, 265, 565];
  chairPositions.forEach((cx) => {
    const chair = scene.add.sprite(
      Math.round(cx * s),
      grassTop + Math.round(35 * s),
      "beach_chair"
    );
    chair.setOrigin(0.5, 1);
    chair.setDepth(3);
    scene.moltbookElements.push(chair);
  });

  // === TIKI TORCHES (depth 3) - with flame flicker ===
  const torchPositions = [60, 200, 400, 580, 720];
  torchPositions.forEach((tx) => {
    const torch = scene.add.sprite(
      Math.round(tx * s),
      grassTop + Math.round(25 * s),
      "beach_tiki_torch"
    );
    torch.setOrigin(0.5, 1);
    torch.setDepth(3);
    scene.moltbookElements.push(torch);

    // Flame flicker animation
    scene.tweens.add({
      targets: torch,
      scaleX: { from: 0.95, to: 1.05 },
      scaleY: { from: 1.0, to: 1.05 },
      duration: 150 + Math.random() * 100,
      yoyo: true,
      repeat: -1,
    });
  });

  // === SURFBOARDS (depth 3) - stuck in sand ===
  const surfboardPositions = [180, 450, 680];
  surfboardPositions.forEach((sx) => {
    const board = scene.add.sprite(
      Math.round(sx * s),
      grassTop + Math.round(20 * s),
      "beach_surfboard"
    );
    board.setOrigin(0.5, 1);
    board.setDepth(3);
    board.setAngle(-10 + Math.random() * 20); // Slightly tilted
    scene.moltbookElements.push(board);
  });

  // === SEASHELLS (depth 2) - scattered ===
  const shellPositions = [90, 230, 350, 520, 640, 760];
  shellPositions.forEach((shx) => {
    const shells = scene.add.sprite(
      Math.round(shx * s),
      grassTop + Math.round(40 * s) + Math.random() * Math.round(15 * s),
      "beach_shells"
    );
    shells.setOrigin(0.5, 1);
    shells.setDepth(2);
    scene.moltbookElements.push(shells);
  });

  // === SANDCASTLES (depth 3) ===
  const sandcastle1 = scene.add.sprite(
    Math.round(340 * s),
    grassTop + Math.round(35 * s),
    "beach_sandcastle"
  );
  sandcastle1.setOrigin(0.5, 1);
  sandcastle1.setDepth(3);
  scene.moltbookElements.push(sandcastle1);

  const sandcastle2 = scene.add.sprite(
    Math.round(600 * s),
    grassTop + Math.round(38 * s),
    "beach_sandcastle"
  );
  sandcastle2.setOrigin(0.5, 1);
  sandcastle2.setDepth(3);
  sandcastle2.setScale(0.8);
  scene.moltbookElements.push(sandcastle2);

  // === DRIFTWOOD (depth 2) ===
  const driftwood1 = scene.add.sprite(
    Math.round(130 * s),
    grassTop + Math.round(45 * s),
    "beach_driftwood"
  );
  driftwood1.setOrigin(0.5, 1);
  driftwood1.setDepth(2);
  scene.moltbookElements.push(driftwood1);

  const driftwood2 = scene.add.sprite(
    Math.round(500 * s),
    grassTop + Math.round(42 * s),
    "beach_driftwood"
  );
  driftwood2.setOrigin(0.5, 1);
  driftwood2.setDepth(2);
  driftwood2.setFlipX(true);
  scene.moltbookElements.push(driftwood2);

  // === CORAL CLUSTERS (depth 2) ===
  const coralPositions = [70, 250, 420, 590, 730];
  coralPositions.forEach((cx) => {
    const coral = scene.add.sprite(
      Math.round(cx * s),
      grassTop + Math.round(50 * s),
      "beach_coral"
    );
    coral.setOrigin(0.5, 1);
    coral.setDepth(2);
    coral.setScale(0.7 + Math.random() * 0.4);
    scene.moltbookElements.push(coral);
  });

  // === MOLTBOOK HQ (depth 7) - Central lighthouse building ===
  // Depth 7 ensures it renders above token building sprites (depth 5) so clicks
  // hit the lighthouse first. stopPropagation prevents the building-click handler
  // underneath from also firing and opening a bags.fm hyperlink.
  const hqX = Math.round(400 * s); // Center of zone
  const moltbookHQ = scene.add.sprite(hqX, pathLevel, "moltbook_hq");
  moltbookHQ.setOrigin(0.5, 1);
  moltbookHQ.setDepth(7);
  scene.moltbookElements.push(moltbookHQ);

  // Make HQ interactive — set zoneClickConsumed flag so building sprites underneath
  // don't also fire their click handler (Phaser setTopOnly(false) delivers to all)
  moltbookHQ.setInteractive({ useHandCursor: true });
  moltbookHQ.on("pointerdown", () => {
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-moltbookhq-click"));
  });
  moltbookHQ.on("pointerover", () => {
    moltbookHQ.setTint(0xfff0e0); // Warm glow on hover
  });
  moltbookHQ.on("pointerout", () => {
    moltbookHQ.clearTint();
  });

  // HQ beacon glow animation
  scene.tweens.add({
    targets: moltbookHQ,
    alpha: { from: 1, to: 0.9 },
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // === MOLTBOOK HQ LABEL ===
  const labelBg = scene.add.rectangle(
    hqX,
    pathLevel - Math.round(150 * s),
    Math.round(120 * s),
    Math.round(24 * s),
    0x1a1a2e,
    0.9
  );
  labelBg.setDepth(8);
  scene.moltbookElements.push(labelBg);

  const label = scene.add.text(hqX, pathLevel - Math.round(150 * s), "MOLTBOOK HQ", {
    fontFamily: "monospace",
    fontSize: `${Math.round(12 * s)}px`,
    color: "#ef4444",
    align: "center",
  });
  label.setOrigin(0.5, 0.5);
  label.setDepth(8);
  scene.moltbookElements.push(label);

  // === AGENT HUT (depth 7) - Next to Moltbook HQ ===
  const hutX = Math.round(550 * s);
  const agentHut = scene.add.sprite(hutX, pathLevel, "beach_hut");
  agentHut.setOrigin(0.5, 1);
  agentHut.setDepth(7);
  agentHut.setScale(0.85);
  scene.moltbookElements.push(agentHut);

  // Make Hut interactive - opens Agent Hut Modal
  agentHut.setInteractive({ useHandCursor: true });
  agentHut.on("pointerdown", () => {
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-agenthut-click"));
  });
  agentHut.on("pointerover", () => {
    agentHut.setTint(0xfff5e0);
    agentHut.setScale(0.9);
  });
  agentHut.on("pointerout", () => {
    agentHut.clearTint();
    agentHut.setScale(0.85);
  });

  // Agent Hut label
  const hutLabelBg = scene.add.rectangle(
    hutX,
    pathLevel - Math.round(85 * s),
    Math.round(90 * s),
    Math.round(22 * s),
    0x92400e,
    0.9
  );
  hutLabelBg.setDepth(6);
  scene.moltbookElements.push(hutLabelBg);

  const hutLabel = scene.add.text(hutX, pathLevel - Math.round(85 * s), "\u{1F6D6} AGENT HUT", {
    fontFamily: "monospace",
    fontSize: `${Math.round(10 * s)}px`,
    color: "#fef3c7",
    align: "center",
  });
  hutLabel.setOrigin(0.5, 0.5);
  hutLabel.setDepth(6);
  scene.moltbookElements.push(hutLabel);

  // === MOLT BAR (depth 7) - Tiki bar for alpha agent chat ===
  const barX = Math.round(250 * s); // Left of Moltbook HQ (which is at 400)
  const moltBar = scene.add.sprite(barX, pathLevel, "molt_bar");
  moltBar.setOrigin(0.5, 1);
  moltBar.setDepth(7);
  moltBar.setScale(1.0);
  scene.moltbookElements.push(moltBar);

  // Make Molt Bar interactive - opens Molt Bar Modal
  moltBar.setInteractive({ useHandCursor: true });
  moltBar.on("pointerdown", () => {
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-moltbar-click"));
  });
  moltBar.on("pointerover", () => {
    moltBar.setTint(0xfff0e0);
    moltBar.setScale(1.05);
  });
  moltBar.on("pointerout", () => {
    moltBar.clearTint();
    moltBar.setScale(1.0);
  });

  // Molt Bar glow animation (neon sign effect)
  scene.tweens.add({
    targets: moltBar,
    alpha: { from: 1, to: 0.92 },
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Molt Bar label
  const barLabelBg = scene.add.rectangle(
    barX,
    pathLevel - Math.round(115 * s),
    Math.round(100 * s),
    Math.round(24 * s),
    0x7c3aed,
    0.9
  );
  barLabelBg.setDepth(6);
  scene.moltbookElements.push(barLabelBg);

  const barLabel = scene.add.text(barX, pathLevel - Math.round(115 * s), "\u{1F525} ALPHA", {
    fontFamily: "monospace",
    fontSize: `${Math.round(11 * s)}px`,
    color: "#fde047",
    align: "center",
  });
  barLabel.setOrigin(0.5, 0.5);
  barLabel.setDepth(6);
  scene.moltbookElements.push(barLabel);

  // === BOUNTY BOARD (depth 7) - A2A task board, right side of zone ===
  const boardX = Math.round(680 * s);
  const bountyBoard = scene.add.sprite(boardX, pathLevel, "bounty_board");
  bountyBoard.setOrigin(0.5, 1);
  bountyBoard.setDepth(7);
  bountyBoard.setScale(0.9);
  scene.moltbookElements.push(bountyBoard);

  // Make Bounty Board interactive
  bountyBoard.setInteractive({ useHandCursor: true });
  bountyBoard.on("pointerdown", () => {
    (scene as any)._zoneClickTime = Date.now();
    window.dispatchEvent(new CustomEvent("bagsworld-bountyboard-click"));
  });
  bountyBoard.on("pointerover", () => {
    bountyBoard.setTint(0xfff5e0);
    bountyBoard.setScale(0.95);
  });
  bountyBoard.on("pointerout", () => {
    bountyBoard.clearTint();
    bountyBoard.setScale(0.9);
  });

  // Bounty Board label
  const boardLabelBg = scene.add.rectangle(
    boardX,
    pathLevel - Math.round(85 * s),
    Math.round(100 * s),
    Math.round(22 * s),
    0x5c3d2e,
    0.9
  );
  boardLabelBg.setDepth(6);
  scene.moltbookElements.push(boardLabelBg);

  const boardLabel = scene.add.text(boardX, pathLevel - Math.round(85 * s), "\u{1F4CB} BOUNTIES", {
    fontFamily: "monospace",
    fontSize: `${Math.round(10 * s)}px`,
    color: "#fff3b0",
    align: "center",
  });
  boardLabel.setOrigin(0.5, 0.5);
  boardLabel.setDepth(6);
  scene.moltbookElements.push(boardLabel);

  // === COCONUTS (depth 2) - near palm tree bases ===
  const coconutPositions = [
    { x: 50, offsetY: 48 },
    { x: 325, offsetY: 50 },
    { x: 625, offsetY: 47 },
  ];
  coconutPositions.forEach((pos) => {
    const coconut = scene.add.sprite(
      Math.round(pos.x * s),
      grassTop + Math.round(pos.offsetY * s),
      "coconut"
    );
    coconut.setOrigin(0.5, 1);
    coconut.setDepth(2);
    coconut.setScale(0.8 + Math.random() * 0.3);
    scene.moltbookElements.push(coconut);
  });

  // === TIDEPOOLS (depth 2) - near waterline with shimmer ===
  const tidepoolPositions = [
    { x: 170, offsetY: 55 },
    { x: 530, offsetY: 58 },
  ];
  tidepoolPositions.forEach((pos) => {
    const pool = scene.add.sprite(
      Math.round(pos.x * s),
      grassTop + Math.round(pos.offsetY * s),
      "tidepool"
    );
    pool.setOrigin(0.5, 1);
    pool.setDepth(2);
    pool.setScale(0.75 + Math.random() * 0.2);
    scene.moltbookElements.push(pool);

    // Shimmer animation - gentle alpha pulse to simulate water reflection
    scene.tweens.add({
      targets: pool,
      alpha: { from: 0.85, to: 1.0 },
      duration: 2000 + Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === WAVE ANIMATION (depth 1) - at bottom of screen ===
  createWaveAnimation(scene, s);

  // === SEAGULLS (depth 15) - flying overhead ===
  createSeagulls(scene, s);

  // === AMBIENT BEACH CREATURES - always present regardless of agents ===
  createAmbientBeachCreatures(scene, s);
}

/**
 * Create animated wave effect at the bottom of the beach zone
 */
function createWaveAnimation(scene: WorldScene, s: number): void {
  const waveY = Math.round(580 * s);
  const waveWidth = GAME_WIDTH;

  // Create multiple wave layers for parallax effect
  const waveColors = [
    { color: 0x06b6d4, alpha: 0.4, speed: 2000, offset: 0 },
    { color: 0x0284c7, alpha: 0.3, speed: 2500, offset: Math.round(100 * s) },
    { color: 0x0369a1, alpha: 0.2, speed: 3000, offset: Math.round(200 * s) },
  ];

  waveColors.forEach((wave, i) => {
    const waveRect = scene.add.rectangle(
      waveWidth / 2 + wave.offset,
      waveY + i * Math.round(3 * s),
      waveWidth + Math.round(400 * s),
      Math.round(8 * s),
      wave.color,
      wave.alpha
    );
    waveRect.setDepth(1);
    scene.moltbookElements.push(waveRect);

    // Wave rolling animation
    scene.tweens.add({
      targets: waveRect,
      x: {
        from: waveWidth / 2 + wave.offset,
        to: waveWidth / 2 + wave.offset - Math.round(100 * s),
      },
      duration: wave.speed,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // Foam line at water's edge
  const foam = scene.add.rectangle(
    waveWidth / 2,
    waveY - Math.round(5 * s),
    waveWidth,
    Math.round(4 * s),
    0xffffff,
    0.5
  );
  foam.setDepth(1);
  scene.moltbookElements.push(foam);

  // Foam animation
  scene.tweens.add({
    targets: foam,
    alpha: { from: 0.5, to: 0.2 },
    scaleX: { from: 1, to: 1.02 },
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

/**
 * Create flying seagulls for the beach atmosphere
 */
function createSeagulls(scene: WorldScene, s: number): void {
  // Create simple seagull shapes (white birds)
  const seagullCount = 4;

  for (let i = 0; i < seagullCount; i++) {
    const startX = Math.round((-100 + Math.random() * 200) * s);
    const startY = Math.round((80 + Math.random() * 100) * s);

    // Simple seagull (small white shape)
    const gull = scene.add.graphics();
    gull.fillStyle(0xffffff, 0.9);
    // Bird shape (simple V for wings)
    gull.fillTriangle(
      0,
      0,
      Math.round(-8 * s),
      Math.round(4 * s),
      Math.round(-4 * s),
      Math.round(2 * s)
    );
    gull.fillTriangle(
      0,
      0,
      Math.round(8 * s),
      Math.round(4 * s),
      Math.round(4 * s),
      Math.round(2 * s)
    );
    gull.setPosition(startX, startY);
    gull.setDepth(15);
    scene.moltbookElements.push(gull);

    // Flying animation - move across screen
    scene.tweens.add({
      targets: gull,
      x: GAME_WIDTH + Math.round(100 * s),
      duration: 15000 + Math.random() * 10000,
      delay: i * 3000,
      repeat: -1,
      onRepeat: () => {
        gull.setPosition(Math.round(-100 * s), Math.round((60 + Math.random() * 120) * s));
      },
    });

    // Bobbing animation (simulates wing flapping)
    scene.tweens.add({
      targets: gull,
      y: startY + Math.round(15 * s),
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}

/**
 * Create ambient beach creatures that are always present on MoltBook Beach.
 * These exist independently of external agent registration - the beach is alive by default.
 * Includes crabs (orange), lobsters (red), and hermit crabs (sandy, near waterline).
 */
function createAmbientBeachCreatures(scene: WorldScene, s: number): void {
  const pathLevel = Y.PATH_LEVEL;

  // Ambient creature configs - spread across the beach at various Y depths
  const creatureConfigs: Array<{
    texture: string;
    x: number;
    yOffset: number;
    scale: number;
    speed: number;
    isLobster: boolean;
  }> = [
    // 5 ambient crabs - mid-beach sand area
    { texture: "agent_crab", x: 80, yOffset: 8, scale: 0.65, speed: 0.18, isLobster: false },
    { texture: "agent_crab", x: 220, yOffset: 12, scale: 0.7, speed: 0.22, isLobster: false },
    { texture: "agent_crab", x: 380, yOffset: 6, scale: 0.6, speed: 0.15, isLobster: false },
    { texture: "agent_crab", x: 540, yOffset: 10, scale: 0.75, speed: 0.2, isLobster: false },
    { texture: "agent_crab", x: 690, yOffset: 14, scale: 0.68, speed: 0.17, isLobster: false },
    // 3 ambient lobsters - slightly larger, prominent
    { texture: "agent_lobster", x: 150, yOffset: 5, scale: 0.72, speed: 0.22, isLobster: true },
    { texture: "agent_lobster", x: 440, yOffset: 9, scale: 0.8, speed: 0.25, isLobster: true },
    { texture: "agent_lobster", x: 650, yOffset: 3, scale: 0.75, speed: 0.2, isLobster: true },
    // 3 hermit crabs - tiny, near waterline (higher yOffset = closer to water)
    { texture: "hermit_crab", x: 120, yOffset: 22, scale: 0.5, speed: 0.1, isLobster: false },
    { texture: "hermit_crab", x: 360, yOffset: 25, scale: 0.45, speed: 0.12, isLobster: false },
    { texture: "hermit_crab", x: 580, yOffset: 20, scale: 0.48, speed: 0.11, isLobster: false },
  ];

  creatureConfigs.forEach((cfg, i) => {
    const spriteX = Math.round(cfg.x * s);
    const spriteY = pathLevel + Math.round(cfg.yOffset * s);

    const sprite = scene.add.sprite(spriteX, spriteY, cfg.texture);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(4);
    sprite.setScale(cfg.scale);
    // Random initial facing direction
    if (Math.random() > 0.5) sprite.setFlipX(true);
    scene.moltbookElements.push(sprite);

    // Walking wobble animation - subtle Y-axis oscillation to simulate crab sideways scuttle
    scene.tweens.add({
      targets: sprite,
      y: spriteY - Math.round(1.5 * s),
      duration: 280 + Math.random() * 80,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Register in ambient creatures array for movement updates
    const creature: BeachCrab = {
      characterId: `ambient-${i}`,
      sprite,
      targetX: spriteX + (Math.random() - 0.5) * Math.round(200 * s),
      speed: cfg.speed * s,
      direction: Math.random() > 0.5 ? "left" : "right",
      idleTimer: Math.floor(Math.random() * 200),
      isIdle: Math.random() > 0.4, // Most start idle
      baseY: spriteY,
      isLobster: cfg.isLobster,
    };
    scene.ambientCreatures.push(creature);
  });
}
