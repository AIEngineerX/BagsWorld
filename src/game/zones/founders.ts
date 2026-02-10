import * as Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { SCALE, DEPTH, Y } from "../textures/constants";

const GAME_WIDTH = 1280;

// ============================================================================
// FOUNDER'S CORNER ZONE
// Cozy workshop environment with educational popups and Pokemon
// ============================================================================

interface Pokemon {
  sprite: Phaser.GameObjects.Sprite;
  type: "charmander" | "squirtle" | "bulbasaur";
  targetX: number;
  speed: number;
  direction: "left" | "right";
  idleTimer: number;
  isIdle: boolean;
  baseY: number;
}

export function setupFoundersZone(scene: WorldScene): void {
  // Restore normal sky (persistent layer)
  scene.restoreNormalSky();

  scene.ground.setVisible(true);
  scene.ground.setTexture("founders_ground");

  // Check if elements were destroyed (can happen during transitions)
  const elementsValid =
    scene.foundersElements.length > 0 &&
    scene.foundersElements.every((el) => (el as any).active !== false);

  if (!elementsValid && scene.foundersZoneCreated) {
    scene.foundersElements = [];
    scene.foundersZoneCreated = false;
  }

  if (!scene.foundersZoneCreated) {
    createFoundersDecorations(scene);
    scene.storeZoneElementPositions(scene.foundersElements);
    scene.foundersZoneCreated = true;
  } else {
    scene.foundersElements.forEach((el) => (el as any).setVisible(true));
  }
}

/**
 * Create Founder's Corner decorations - cozy workshop environment
 * Includes 3 clickable buildings with educational popups
 */
function createFoundersDecorations(scene: WorldScene): void {
  const s = SCALE;
  const grassTop = Y.GRASS_TOP;
  const pathLevel = Y.PATH_LEVEL;
  const groundY = Math.round(550 * s);

  // === BACKGROUND TREES (depth 2) ===
  const treePositions = [
    { x: 80, yOffset: 0 },
    { x: 200, yOffset: 5 },
    { x: 520, yOffset: -3 },
    { x: 680, yOffset: 8 },
    { x: 780, yOffset: 2 },
  ];

  treePositions.forEach((pos) => {
    const tree = scene.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "tree");
    tree.setOrigin(0.5, 1);
    tree.setDepth(2);
    tree.setScale(0.9 + Math.random() * 0.3);
    scene.foundersElements.push(tree);

    // Subtle sway animation for trees
    scene.tweens.add({
      targets: tree,
      angle: { from: -2, to: 2 },
      duration: 2000 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === HEDGES (depth 2) ===
  const hedgePositions = [
    { x: 140, yOffset: 25 },
    { x: 340, yOffset: 22 },
    { x: 460, yOffset: 27 },
    { x: 600, yOffset: 24 },
  ];

  hedgePositions.forEach((pos) => {
    const hedge = scene.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "bush");
    hedge.setOrigin(0.5, 1);
    hedge.setDepth(2);
    hedge.setScale(0.8 + Math.random() * 0.2);
    scene.foundersElements.push(hedge);
  });

  // === FLOWERS (depth 2) ===
  const flowerPositions = [130, 260, 380, 540, 650];
  flowerPositions.forEach((fx) => {
    const flower = scene.add.sprite(Math.round(fx * s), grassTop + Math.round(32 * s), "flower");
    flower.setOrigin(0.5, 1);
    flower.setDepth(2);
    flower.setScale(0.8 + Math.random() * 0.3);
    scene.foundersElements.push(flower);

    // Gentle sway animation
    scene.tweens.add({
      targets: flower,
      angle: { from: -3, to: 3 },
      duration: 1500 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === BUILDINGS (depth 5+) - Clickable with info popups ===
  const buildings = [
    { texture: "founders_0", x: 300, label: "DEXSCREENER\nWORKSHOP", type: "overview" },
  ];

  buildings.forEach((b, i) => {
    const bx = Math.round(b.x * s);
    const sprite = scene.add.sprite(bx, pathLevel, b.texture);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(5 - i / 10);

    // Make building interactive
    sprite.setInteractive({ useHandCursor: true });
    sprite.on("pointerdown", () => showFoundersPopup(scene, b.type));
    sprite.on("pointerover", () => {
      sprite.setTint(0xdddddd);
      scene.tweens.add({
        targets: sprite,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 100,
        ease: "Power2",
      });
    });
    sprite.on("pointerout", () => {
      sprite.clearTint();
      scene.tweens.add({
        targets: sprite,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: "Power2",
      });
    });

    scene.foundersElements.push(sprite);

    // Building label with background
    const labelBg = scene.add.rectangle(
      bx,
      pathLevel + Math.round(18 * s),
      Math.round(70 * s),
      Math.round(24 * s),
      0x000000,
      0.7
    );
    labelBg.setDepth(6);
    labelBg.setStrokeStyle(1, 0x4ade80);
    scene.foundersElements.push(labelBg);

    const label = scene.add.text(bx, pathLevel + Math.round(18 * s), b.label, {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * s)}px`,
      color: "#4ade80",
      align: "center",
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(7);
    scene.foundersElements.push(label);
  });

  // === SOL INCINERATOR FACTORY (depth 5) - Opens React modal ===
  const incineratorX = Math.round(600 * s);
  const incineratorSprite = scene.add.sprite(incineratorX, pathLevel, "founders_3");
  incineratorSprite.setOrigin(0.5, 1);
  incineratorSprite.setDepth(4.6);

  incineratorSprite.setInteractive({ useHandCursor: true });
  incineratorSprite.on("pointerdown", () => {
    window.dispatchEvent(new CustomEvent("bagsworld-incinerator-click"));
  });
  incineratorSprite.on("pointerover", () => {
    incineratorSprite.setTint(0xdddddd);
    scene.tweens.add({
      targets: incineratorSprite,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
      ease: "Power2",
    });
  });
  incineratorSprite.on("pointerout", () => {
    incineratorSprite.clearTint();
    scene.tweens.add({
      targets: incineratorSprite,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: "Power2",
    });
  });
  scene.foundersElements.push(incineratorSprite);

  // White smoke drifting up from incinerator chimney
  const smokeY = pathLevel - Math.round(158 * s);
  const incSmokeEmitter = scene.add.particles(incineratorX, smokeY, "green_smoke", {
    speedY: { min: -30, max: -60 },
    speedX: { min: -5, max: 12 },
    scale: { start: 0.3, end: 1.4 },
    alpha: { start: 0.5, end: 0 },
    lifespan: { min: 3000, max: 5000 },
    frequency: 400,
    quantity: 1,
    x: { min: -Math.round(3 * s), max: Math.round(3 * s) },
    rotate: { min: 0, max: 360 },
  });
  incSmokeEmitter.setDepth(15);
  scene.foundersElements.push(incSmokeEmitter);

  // Incinerator label
  const incLabelBg = scene.add.rectangle(
    incineratorX,
    pathLevel + Math.round(18 * s),
    Math.round(78 * s),
    Math.round(24 * s),
    0x000000,
    0.7
  );
  incLabelBg.setDepth(6);
  incLabelBg.setStrokeStyle(1, 0x22c55e);
  scene.foundersElements.push(incLabelBg);

  const incLabel = scene.add.text(
    incineratorX,
    pathLevel + Math.round(18 * s),
    "SOL\nINCINERATOR",
    {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * s)}px`,
      color: "#4ade80",
      align: "center",
    }
  );
  incLabel.setOrigin(0.5, 0.5);
  incLabel.setDepth(7);
  scene.foundersElements.push(incLabel);

  // === INCINERATOR GARBAGE TRUCK (parked to the right of factory) ===
  const truckX = Math.round(760 * s);
  const truckSprite = scene.add.sprite(truckX, pathLevel + Math.round(3 * s), "incinerator_truck");
  truckSprite.setOrigin(0.5, 1);
  truckSprite.setDepth(4.5);
  scene.foundersElements.push(truckSprite);

  // === LANTERNS (depth 3) ===
  const lanternPositions = [170, 350, 550, 730];
  lanternPositions.forEach((lx) => {
    const lantern = scene.add.sprite(Math.round(lx * s), pathLevel, "founders_lantern");
    lantern.setOrigin(0.5, 1);
    lantern.setDepth(3);
    scene.foundersElements.push(lantern);

    // Warm glow effect under lantern
    const glow = scene.add.ellipse(
      Math.round(lx * s),
      pathLevel + Math.round(5 * s),
      Math.round(50 * s),
      Math.round(15 * s),
      0xfbbf24,
      0.2
    );
    glow.setDepth(1);
    scene.foundersElements.push(glow);

    // Pulsing glow animation
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.15, to: 0.25 },
      duration: 1500 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === BENCHES (depth 3) ===
  const benchPositions = [280, 500];
  benchPositions.forEach((bx) => {
    const bench = scene.add.sprite(Math.round(bx * s), pathLevel - Math.round(5 * s), "bench");
    bench.setOrigin(0.5, 1);
    bench.setDepth(3);
    scene.foundersElements.push(bench);
  });

  // === WORKBENCHES (depth 3) ===
  const workbenchPositions = [150, 580];
  workbenchPositions.forEach((wx) => {
    const workbench = scene.add.sprite(
      Math.round(wx * s),
      grassTop + Math.round(30 * s),
      "founders_workbench"
    );
    workbench.setOrigin(0.5, 1);
    workbench.setDepth(3);
    scene.foundersElements.push(workbench);
  });

  // === EASELS (depth 3) ===
  const easelPositions = [300, 480];
  easelPositions.forEach((ex) => {
    const easel = scene.add.sprite(
      Math.round(ex * s),
      grassTop + Math.round(25 * s),
      "founders_easel"
    );
    easel.setOrigin(0.5, 1);
    easel.setDepth(3);
    scene.foundersElements.push(easel);
  });

  // === CRATES (depth 4) ===
  const cratePositions = [100, 400];
  cratePositions.forEach((cx) => {
    const crate = scene.add.sprite(
      Math.round(cx * s),
      pathLevel + Math.round(5 * s),
      "founders_crate"
    );
    crate.setOrigin(0.5, 1);
    crate.setDepth(4);
    scene.foundersElements.push(crate);
  });

  // === CHALKBOARD WELCOME SIGN (centered, depth 2) ===
  const chalkboard = scene.add.sprite(
    GAME_WIDTH / 2,
    grassTop - Math.round(10 * s),
    "founders_chalkboard"
  );
  chalkboard.setOrigin(0.5, 1);
  chalkboard.setDepth(2);
  scene.foundersElements.push(chalkboard);

  // === POKEMON (depth 8, above buildings) - Interactive and roaming ===
  // Clear any existing pokemon from previous zone visits
  scene.pokemon = [];

  const pokemonConfigs: Array<{
    texture: string;
    type: "charmander" | "squirtle" | "bulbasaur";
    x: number;
    yOffset: number;
    scale: number;
    speed: number;
  }> = [
    {
      texture: "pokemon_charmander",
      type: "charmander",
      x: 150,
      yOffset: 8,
      scale: 1.4,
      speed: 0.25,
    },
    {
      texture: "pokemon_squirtle",
      type: "squirtle",
      x: 400,
      yOffset: 8,
      scale: 1.35,
      speed: 0.2,
    },
    {
      texture: "pokemon_bulbasaur",
      type: "bulbasaur",
      x: 500,
      yOffset: 8,
      scale: 1.3,
      speed: 0.15,
    },
  ];

  pokemonConfigs.forEach((config, index) => {
    const baseY = pathLevel + Math.round(config.yOffset * s);
    const sprite = scene.add.sprite(Math.round(config.x * s), baseY, config.texture);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(config.scale);
    sprite.setDepth(8);
    scene.foundersElements.push(sprite);

    // Make Pokemon interactive
    sprite.setInteractive({ useHandCursor: true });
    sprite.on("pointerdown", () => scene.petPokemon(config.type));
    sprite.on("pointerover", () => sprite.setTint(0xffffcc));
    sprite.on("pointerout", () => sprite.clearTint());

    // Store in pokemon array for movement updates
    const pokemonObj: Pokemon = {
      sprite,
      type: config.type,
      targetX: Math.round(config.x * s),
      speed: config.speed,
      direction: Math.random() > 0.5 ? "left" : "right",
      idleTimer: 0,
      isIdle: true,
      baseY,
    };
    scene.pokemon.push(pokemonObj);

    // Subtle idle breathing animation
    scene.tweens.add({
      targets: sprite,
      scaleY: config.scale * 1.03,
      duration: 800 + index * 150,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Random hop/movement trigger
    scene.time.addEvent({
      delay: 2000 + index * 800,
      callback: () => {
        if (sprite.active && pokemonObj.isIdle && scene.currentZone === "founders") {
          // Decide to move or hop
          if (Math.random() > 0.4) {
            // Start roaming
            pokemonObj.isIdle = false;
            pokemonObj.targetX = Math.round(100 * s) + Math.random() * Math.round(450 * s);
            pokemonObj.direction = pokemonObj.targetX > sprite.x ? "right" : "left";
          } else {
            // Just hop in place
            scene.tweens.add({
              targets: sprite,
              y: sprite.y - Math.round(12 * s),
              duration: 200,
              yoyo: true,
              ease: "Quad.easeOut",
            });
          }
        }
      },
      loop: true,
    });
  });
}

/**
 * Show Founder's Corner popup with pixel-art themed educational content
 * Enhanced with CRT scanlines, animated elements, and retro terminal styling
 */
export function showFoundersPopup(scene: WorldScene, tab: string, animate: boolean = true): void {
  // Don't open if popup already exists
  if (scene.foundersPopup) return;

  scene.foundersActiveTab = tab;
  const s = SCALE;
  const centerX = GAME_WIDTH / 2;
  const centerY = Math.round(300 * s);

  // Create container for popup
  const popup = scene.add.container(0, 0);
  scene.foundersPopup = popup;
  popup.setDepth(DEPTH.UI_LOW);

  // Dark overlay
  const overlay = scene.add.rectangle(
    GAME_WIDTH / 2,
    GAME_WIDTH / 2,
    GAME_WIDTH * 2,
    GAME_WIDTH * 2,
    0x0a0a0f,
    0.88
  );
  overlay.setInteractive();
  overlay.on("pointerdown", () => hideFoundersPopup(scene));
  popup.add(overlay);

  // Get content for active tab
  const content = getFoundersPopupContent(tab);
  const theme = { accent: 0x22c55e, titleColor: "#22c55e", icon: "\u2699" }; // DexScreener green

  // Panel dimensions - taller to fit tabs + content
  const panelW = Math.round(400 * s);
  const panelH = Math.round(490 * s);
  const borderW = Math.round(4 * s);

  // === DROP SHADOW ===
  const shadowOffset = Math.round(6 * s);
  popup.add(
    scene.add.rectangle(
      centerX + shadowOffset,
      centerY + shadowOffset,
      panelW + borderW * 2,
      panelH + borderW * 2,
      0x000000,
      0.4
    )
  );
  popup.add(
    scene.add.rectangle(
      centerX + Math.round(3 * s),
      centerY + Math.round(3 * s),
      panelW + borderW * 2,
      panelH + borderW * 2,
      0x000000,
      0.3
    )
  );

  // === DOUBLE-LINE BORDER ===
  popup.add(
    scene.add.rectangle(centerX, centerY, panelW + borderW * 2, panelH + borderW * 2, theme.accent)
  );
  popup.add(scene.add.rectangle(centerX, centerY, panelW + borderW, panelH + borderW, 0x0a0a0f));
  popup.add(scene.add.rectangle(centerX, centerY, panelW, panelH, theme.accent));
  popup.add(
    scene.add.rectangle(
      centerX,
      centerY,
      panelW - Math.round(4 * s),
      panelH - Math.round(4 * s),
      0x0f172a
    )
  );

  // Inner bevel highlight
  popup.add(
    scene.add.rectangle(
      centerX - panelW / 2 + Math.round(4 * s),
      centerY,
      Math.round(2 * s),
      panelH - Math.round(8 * s),
      theme.accent,
      0.15
    )
  );
  popup.add(
    scene.add.rectangle(
      centerX,
      centerY - panelH / 2 + Math.round(4 * s),
      panelW - Math.round(8 * s),
      Math.round(2 * s),
      theme.accent,
      0.2
    )
  );

  // === CRT SCANLINES ===
  const scanlineSpacing = Math.round(3 * s);
  for (let y = centerY - panelH / 2; y < centerY + panelH / 2; y += scanlineSpacing) {
    popup.add(scene.add.rectangle(centerX, y, panelW - Math.round(8 * s), 1, 0x000000, 0.08));
  }

  // === L-SHAPED CORNERS ===
  const cornerLen = Math.round(16 * s);
  const cornerThick = Math.round(4 * s);
  const cornerInset = Math.round(8 * s);
  const createCorner = (cx: number, cy: number, flipX: boolean, flipY: boolean) => {
    const xDir = flipX ? -1 : 1;
    const yDir = flipY ? -1 : 1;
    popup.add(
      scene.add.rectangle(cx + (xDir * cornerLen) / 2, cy, cornerLen, cornerThick, theme.accent)
    );
    popup.add(
      scene.add.rectangle(cx, cy + (yDir * cornerLen) / 2, cornerThick, cornerLen, theme.accent)
    );
    popup.add(scene.add.rectangle(cx, cy, cornerThick, cornerThick, 0xffffff, 0.8));
  };
  createCorner(
    centerX - panelW / 2 + cornerInset,
    centerY - panelH / 2 + cornerInset,
    false,
    false
  );
  createCorner(centerX + panelW / 2 - cornerInset, centerY - panelH / 2 + cornerInset, true, false);
  createCorner(centerX - panelW / 2 + cornerInset, centerY + panelH / 2 - cornerInset, false, true);
  createCorner(centerX + panelW / 2 - cornerInset, centerY + panelH / 2 - cornerInset, true, true);

  // === HEADER ===
  const iconY = centerY - panelH / 2 + Math.round(40 * s);
  const iconContainer = scene.add.container(centerX, iconY);
  popup.add(iconContainer);

  iconContainer.add(
    scene.add.rectangle(0, 0, Math.round(44 * s), Math.round(44 * s), theme.accent)
  );
  iconContainer.add(scene.add.rectangle(0, 0, Math.round(40 * s), Math.round(40 * s), 0x0a0a0f));
  iconContainer.add(scene.add.rectangle(0, 0, Math.round(36 * s), Math.round(36 * s), 0x1a1a2e));
  const iconGlow = scene.add.rectangle(
    0,
    0,
    Math.round(32 * s),
    Math.round(32 * s),
    theme.accent,
    0.1
  );
  iconContainer.add(iconGlow);
  const iconText = scene.add.text(0, 0, theme.icon, {
    fontFamily: "monospace",
    fontSize: `${Math.round(18 * s)}px`,
  });
  iconText.setOrigin(0.5);
  iconContainer.add(iconText);

  scene.tweens.add({
    targets: iconContainer,
    scaleX: { from: 1, to: 1.08 },
    scaleY: { from: 1, to: 1.08 },
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  scene.tweens.add({
    targets: iconGlow,
    alpha: { from: 0.1, to: 0.3 },
    duration: 1000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Title
  const titleY = centerY - panelH / 2 + Math.round(72 * s);
  const titleGlow = scene.add.text(centerX, titleY, "DEXSCREENER WORKSHOP", {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${Math.round(9 * s)}px`,
    color: theme.titleColor,
    fontStyle: "bold",
  });
  titleGlow.setOrigin(0.5);
  titleGlow.setAlpha(0.3);
  titleGlow.setBlendMode(Phaser.BlendModes.ADD);
  popup.add(titleGlow);
  const titleText = scene.add.text(centerX, titleY, "DEXSCREENER WORKSHOP", {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${Math.round(9 * s)}px`,
    color: theme.titleColor,
    fontStyle: "bold",
  });
  titleText.setOrigin(0.5);
  popup.add(titleText);
  scene.tweens.add({
    targets: titleGlow,
    alpha: { from: 0.2, to: 0.5 },
    scaleX: { from: 1, to: 1.02 },
    scaleY: { from: 1, to: 1.02 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // === TAB BAR ===
  const tabY = centerY - panelH / 2 + Math.round(96 * s);
  const tabDefs = [
    { id: "overview", label: "OVERVIEW", accent: 0x22c55e },
    { id: "images", label: "IMAGES", accent: 0xfbbf24 },
    { id: "socials", label: "SOCIALS", accent: 0x38bdf8 },
  ];
  const tabTotalW = panelW - Math.round(40 * s);
  const tabGap = Math.round(4 * s);
  const singleTabW = Math.round((tabTotalW - tabGap * 2) / 3);
  const tabStartX = centerX - tabTotalW / 2 + singleTabW / 2;

  tabDefs.forEach((td, i) => {
    const tx = tabStartX + i * (singleTabW + tabGap);
    const isActive = td.id === tab;

    // Tab background
    const tabBg = scene.add.rectangle(
      tx,
      tabY,
      singleTabW,
      Math.round(24 * s),
      isActive ? td.accent : 0x1e293b,
      isActive ? 1 : 0.8
    );
    tabBg.setStrokeStyle(Math.round(2 * s), isActive ? td.accent : 0x334155);
    popup.add(tabBg);

    // Tab label
    const tabLabel = scene.add.text(tx, tabY, td.label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(6 * s)}px`,
      color: isActive ? "#0f172a" : "#94a3b8",
      fontStyle: isActive ? "bold" : "normal",
    });
    tabLabel.setOrigin(0.5);
    popup.add(tabLabel);

    // Make inactive tabs clickable
    if (!isActive) {
      tabBg.setInteractive({ useHandCursor: true });
      tabBg.on("pointerover", () => {
        tabBg.setFillStyle(0x334155);
        tabLabel.setColor("#e2e8f0");
      });
      tabBg.on("pointerout", () => {
        tabBg.setFillStyle(0x1e293b);
        tabLabel.setColor("#94a3b8");
      });
      tabBg.on("pointerdown", () => switchFoundersTab(scene, td.id));
    }
  });

  // Tab underline (active indicator)
  const activeIdx = tabDefs.findIndex((t) => t.id === tab);
  const activeTabX = tabStartX + activeIdx * (singleTabW + tabGap);
  popup.add(
    scene.add.rectangle(
      activeTabX,
      tabY + Math.round(13 * s),
      singleTabW - Math.round(8 * s),
      Math.round(2 * s),
      tabDefs[activeIdx].accent
    )
  );

  // === CONTENT SECTION ===
  const hasTip = content.tip && content.tip.length > 0;
  const sectionHeight = hasTip ? Math.round(235 * s) : Math.round(260 * s);
  const sectionY = centerY + Math.round(38 * s);

  // Section background
  popup.add(
    scene.add.rectangle(
      centerX,
      sectionY,
      panelW - Math.round(20 * s),
      sectionHeight,
      tabDefs[activeIdx].accent,
      0.2
    )
  );
  popup.add(
    scene.add.rectangle(
      centerX,
      sectionY,
      panelW - Math.round(24 * s),
      sectionHeight - Math.round(4 * s),
      0x0a0e17,
      0.95
    )
  );
  popup.add(
    scene.add.rectangle(
      centerX,
      sectionY - sectionHeight / 2 + Math.round(4 * s),
      panelW - Math.round(28 * s),
      Math.round(8 * s),
      0x000000,
      0.3
    )
  );

  // Content text with clickable links
  const contentLines = content.body.split("\n").filter((ln) => ln.trim() !== "");
  const lineHeight = Math.round(10 * s);
  const startY = sectionY - sectionHeight / 2 + Math.round(14 * s);

  contentLines.forEach((line, i) => {
    // Check if this is a clickable link line (starts with "> ")
    const isLink = line.trimStart().startsWith("> ");
    const linkUrl = isLink ? getFoundersLinkUrl(line) : null;

    // Determine line color
    let lineColor = "#cbd5e1";
    if (isLink) {
      lineColor = "#38bdf8"; // Bright cyan for links
    } else if (line.startsWith(" +") || line.startsWith(" [x]") || line.match(/^\d\./)) {
      lineColor = "#4ade80";
    } else if (line.startsWith(" [ ]")) {
      lineColor = "#fbbf24";
    } else if (
      line.includes("CHECKLIST") ||
      line.includes("WHAT YOU GET") ||
      line.includes("IMPORTANT") ||
      line.includes("REQUIRED") ||
      line.includes("OPTIONAL") ||
      line.includes("BAGS.FM TIP") ||
      line.includes("TOKEN LOGO") ||
      line.includes("TOKEN BANNER") ||
      line.includes("FREE TOOLS") ||
      line.includes("WHAT IS") ||
      line.includes("ENHANCED TOKEN")
    ) {
      lineColor = "#60a5fa";
    } else if (line.includes("COST:") || line.includes("TIME:") || line.includes("VERIFY:")) {
      lineColor = theme.titleColor;
    }

    const displayText = isLink ? line.replace(/>\s*/, "  \u2192 ") : line;
    const lineText = scene.add.text(
      centerX - panelW / 2 + Math.round(24 * s),
      startY + i * lineHeight,
      displayText,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${Math.round(6 * s)}px`,
        color: lineColor,
      }
    );
    lineText.setOrigin(0, 0);
    popup.add(lineText);

    // Make link lines clickable
    if (isLink && linkUrl) {
      lineText.setInteractive({ useHandCursor: true });
      lineText.on("pointerover", () => {
        lineText.setColor("#7dd3fc");
        lineText.setAlpha(0.9);
      });
      lineText.on("pointerout", () => {
        lineText.setColor("#38bdf8");
        lineText.setAlpha(1);
      });
      lineText.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        window.open(linkUrl, "_blank", "noopener,noreferrer");
      });
    }
  });

  // === TIP SECTION ===
  if (hasTip) {
    const tipY = centerY + panelH / 2 - Math.round(50 * s);
    popup.add(
      scene.add.rectangle(
        centerX,
        tipY,
        panelW - Math.round(20 * s),
        Math.round(30 * s),
        tabDefs[activeIdx].accent,
        0.3
      )
    );
    popup.add(
      scene.add.rectangle(
        centerX,
        tipY,
        panelW - Math.round(24 * s),
        Math.round(26 * s),
        0x0a0e17,
        0.9
      )
    );
    const tipLabel = scene.add.text(centerX - panelW / 2 + Math.round(28 * s), tipY, "TIP:", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(7 * s)}px`,
      color: "#fbbf24",
      fontStyle: "bold",
    });
    tipLabel.setOrigin(0, 0.5);
    popup.add(tipLabel);
    const tipText = scene.add.text(centerX - panelW / 2 + Math.round(70 * s), tipY, content.tip, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(6 * s)}px`,
      color: "#94a3b8",
    });
    tipText.setOrigin(0, 0.5);
    popup.add(tipText);
  }

  // === CLOSE BUTTON ===
  const closeBtnX = centerX + panelW / 2 - Math.round(20 * s);
  const closeBtnY = centerY - panelH / 2 + Math.round(20 * s);
  popup.add(
    scene.add.rectangle(closeBtnX, closeBtnY, Math.round(30 * s), Math.round(30 * s), 0xef4444, 0.2)
  );
  const closeBtnOuter = scene.add.rectangle(
    closeBtnX,
    closeBtnY,
    Math.round(26 * s),
    Math.round(26 * s),
    0xef4444
  );
  popup.add(closeBtnOuter);
  popup.add(
    scene.add.rectangle(closeBtnX, closeBtnY, Math.round(22 * s), Math.round(22 * s), 0x7f1d1d)
  );
  const closeBtnInner = scene.add.rectangle(
    closeBtnX,
    closeBtnY,
    Math.round(18 * s),
    Math.round(18 * s),
    0x1a1a2e
  );
  closeBtnInner.setInteractive({ useHandCursor: true });
  closeBtnInner.on("pointerdown", () => hideFoundersPopup(scene));
  const closeBtn = scene.add.text(closeBtnX, closeBtnY, "X", {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${Math.round(9 * s)}px`,
    color: "#ef4444",
    fontStyle: "bold",
  });
  closeBtn.setOrigin(0.5);
  closeBtnInner.on("pointerover", () => {
    closeBtnInner.setFillStyle(0x2a2a3e);
    closeBtnOuter.setFillStyle(0xff6b6b);
    closeBtn.setColor("#ffffff");
  });
  closeBtnInner.on("pointerout", () => {
    closeBtnInner.setFillStyle(0x1a1a2e);
    closeBtnOuter.setFillStyle(0xef4444);
    closeBtn.setColor("#ef4444");
  });
  popup.add(closeBtnInner);
  popup.add(closeBtn);

  // === FOOTER ===
  const footerY = centerY + panelH / 2 - Math.round(16 * s);
  popup.add(
    scene.add
      .text(centerX - Math.round(110 * s), footerY, "[", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${Math.round(6 * s)}px`,
        color: "#475569",
      })
      .setOrigin(0.5)
  );
  popup.add(
    scene.add
      .text(centerX + Math.round(110 * s), footerY, "]", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${Math.round(6 * s)}px`,
        color: "#475569",
      })
      .setOrigin(0.5)
  );
  const footerText = scene.add.text(centerX, footerY, "Click anywhere to close", {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${Math.round(6 * s)}px`,
    color: "#64748b",
  });
  footerText.setOrigin(0.5);
  popup.add(footerText);
  scene.tweens.add({
    targets: footerText,
    alpha: { from: 1, to: 0.4 },
    duration: 1200,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // === ENTRANCE ANIMATION ===
  if (animate) {
    popup.setAlpha(0);
    popup.setScale(0.9);
    scene.tweens.add({
      targets: popup,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  }
}

function switchFoundersTab(scene: WorldScene, tab: string): void {
  if (scene.foundersPopup) {
    scene.foundersPopup.destroy();
    scene.foundersPopup = null;
  }
  showFoundersPopup(scene, tab, false);
}

function getFoundersLinkUrl(line: string): string | null {
  const linkMap: Record<string, string> = {
    "marketplace.dexscreener.com": "https://marketplace.dexscreener.com/product/token-info",
    "dexscreener.com/solana": "https://dexscreener.com/solana",
    "canva.com": "https://www.canva.com",
    "remove.bg": "https://www.remove.bg",
    "tinypng.com": "https://tinypng.com",
    "carrd.co": "https://carrd.co",
    "bags.fm": "https://bags.fm",
  };
  for (const [key, url] of Object.entries(linkMap)) {
    if (line.includes(key)) return url;
  }
  return null;
}

function getFoundersPopupTheme(_type: string): {
  accent: number;
  titleColor: string;
  icon: string;
} {
  // Unified DexScreener green theme for the workshop
  return { accent: 0x22c55e, titleColor: "#22c55e", icon: "\u2699" };
}

export function hideFoundersPopup(scene: WorldScene): void {
  if (!scene.foundersPopup) return;

  scene.tweens.add({
    targets: scene.foundersPopup,
    alpha: 0,
    duration: 150,
    ease: "Power2",
    onComplete: () => {
      if (scene.foundersPopup) {
        scene.foundersPopup.destroy();
        scene.foundersPopup = null;
      }
    },
  });
}

export function getFoundersPopupContent(tab: string): { title: string; body: string; tip: string } {
  switch (tab) {
    case "overview":
      return {
        title: "DEXSCREENER WORKSHOP",
        body: `WHAT IS DEXSCREENER?
Free chart site for DEX traders.
Every Solana token auto-lists!
> dexscreener.com/solana

ENHANCED TOKEN INFO: $299
 + Custom logo & banner displayed
 + Social links shown to traders
 + Description & roadmap
 + Locked wallets (fixes mcap)

COST:  $299 (crypto or card)
TIME:  Usually <15 min, max 12h
VERIFY: Sign with creator wallet

ORDER HERE:
> marketplace.dexscreener.com

CHECKLIST BEFORE ORDERING:
 [x] Token launched on DEX
 [x] Logo ready (see IMAGES tab)
 [x] Banner ready (see IMAGES tab)
 [x] Website live (see SOCIALS tab)
 [x] Twitter with posts
 [ ] TG/Discord (optional)`,
        tip: "",
      };

    case "images":
      return {
        title: "DEXSCREENER WORKSHOP",
        body: `TOKEN LOGO:
 Ratio:   1:1 (square)
 Size:    512x512px recommended
 Format:  PNG, JPG, WebP, GIF
 Style:   Simple, readable at 32px
 GOOD: Bold icon, 2-3 colors max
 BAD:  Detailed art, tiny text

TOKEN BANNER/HEADER:
 Ratio:   3:1 (wide rectangle)
 Size:    1500x500px (min 600x200)
 Format:  PNG, JPG, WebP, GIF
 GOOD: Token name, clean design
 BAD:  Walls of text, busy BGs

FREE TOOLS (click to open):
> canva.com       - templates
> remove.bg       - transparent bg
> tinypng.com     - compress files

IMPORTANT: Prof. Oak in this zone
can generate logos + banners!`,
        tip: "Twitter header = DexScreener banner!",
      };

    case "socials":
      return {
        title: "DEXSCREENER WORKSHOP",
        body: `REQUIRED BY DEXSCREENER:

1. WEBSITE (must be live)
   NO "coming soon" pages
   Include: about, tokenomics, links
   Free 1-pager:
> carrd.co

2. TWITTER/X (must have posts)
   Pin a tweet about your token
   Post chart + CA on launch day

OPTIONAL BUT RECOMMENDED:

3. TELEGRAM GROUP
   Create BEFORE launch
   Pin: CA, chart link, rules

4. DISCORD
   Only if long-term project

BAGS.FM TIP:
Your creator page = website!
> bags.fm`,
        tip: "Set up TG BEFORE launch, not after!",
      };

    default:
      return {
        title: "DEXSCREENER WORKSHOP",
        body: "Click a tab above to get started!",
        tip: "Each tab = one step in the process.",
      };
  }
}
