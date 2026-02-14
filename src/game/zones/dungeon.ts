import type { WorldScene } from "../scenes/WorldScene";
import { SCALE } from "../textures/constants";

const GAME_WIDTH = 1280;

export function setupDungeonZone(scene: WorldScene): void {
  createDungeonSky(scene);

  scene.ground.setVisible(true);
  scene.ground.setTexture("dungeon_ground");

  // Check if elements were destroyed during transitions
  const elementsValid =
    scene.dungeonElements.length > 0 &&
    scene.dungeonElements.every((el) => (el as any).active !== false);

  if (!elementsValid && scene.dungeonZoneCreated) {
    scene.dungeonElements = [];
    scene.dungeonZoneCreated = false;
  }

  if (!scene.dungeonZoneCreated) {
    createDungeonDecorations(scene);
    scene.dungeonZoneCreated = true;
  } else {
    scene.dungeonElements.forEach((el) => (el as any).setVisible(true));
  }
}

function createDungeonSky(scene: WorldScene): void {
  scene.restoreNormalSky();

  // Hide the normal sky — we're underground
  if (scene.skyGradient) {
    scene.skyGradient.setVisible(false);
  }

  const s = SCALE;
  const skyH = Math.round(430 * s);

  // === Cave ceiling gradient — deep dark stone ===
  if (!scene.dungeonCaveSky) {
    scene.dungeonCaveSky = scene.add.graphics();
    scene.dungeonCaveSky.setDepth(-2);
  }
  scene.dungeonCaveSky.clear();
  // Very dark cave ceiling — near-black at top, dark slate at bottom
  scene.dungeonCaveSky.fillGradientStyle(0x060608, 0x080810, 0x12121e, 0x141422, 1);
  scene.dungeonCaveSky.fillRect(0, 0, GAME_WIDTH, skyH);
  scene.dungeonCaveSky.setVisible(true);

  // Show sky elements if already created
  if (scene.dungeonSkyElements.length > 0) {
    scene.dungeonSkyElements.forEach((el) => (el as any).setVisible(true));
    return;
  }

  const r = (n: number) => Math.round(n * s);

  // === Stalactites — single Graphics for all static formations ===
  const stalactiteGfx = scene.add.graphics();
  stalactiteGfx.setDepth(-1);

  const stalactites = [
    { x: 60, h: 45, w: 12 },
    { x: 130, h: 65, w: 16 },
    { x: 210, h: 35, w: 10 },
    { x: 290, h: 55, w: 14 },
    { x: 380, h: 40, w: 11 },
    { x: 430, h: 70, w: 18 },
    { x: 510, h: 50, w: 13 },
    { x: 580, h: 38, w: 10 },
    { x: 650, h: 60, w: 15 },
    { x: 720, h: 45, w: 12 },
    { x: 770, h: 55, w: 14 },
  ];

  stalactites.forEach((st) => {
    const sx = r(st.x),
      sw = r(st.w),
      sh = r(st.h);
    const midW = Math.round(sw * 0.6),
      tipW = Math.round(sw * 0.25);
    stalactiteGfx.fillStyle(0x1e1e28);
    stalactiteGfx.fillRect(sx - sw / 2, 0, sw, Math.round(sh * 0.6));
    stalactiteGfx.fillStyle(0x1a1a24);
    stalactiteGfx.fillRect(sx - midW / 2, Math.round(sh * 0.5), midW, Math.round(sh * 0.3));
    stalactiteGfx.fillStyle(0x16161f);
    stalactiteGfx.fillRect(sx - tipW / 2, Math.round(sh * 0.75), tipW, Math.round(sh * 0.25));
    stalactiteGfx.fillStyle(0x2a2a36, 0.5);
    stalactiteGfx.fillRect(sx - sw / 2, 0, r(2), Math.round(sh * 0.6));
  });
  scene.dungeonSkyElements.push(stalactiteGfx);

  // === Cave wall strips — single Graphics for both sides ===
  const wallGfx = scene.add.graphics();
  wallGfx.setDepth(-1);
  wallGfx.fillStyle(0x151520, 0.8);
  wallGfx.fillRect(0, 0, r(25), skyH);
  wallGfx.fillStyle(0x1a1a28, 0.6);
  wallGfx.fillRect(r(25), 0, r(15), skyH);
  wallGfx.fillStyle(0x111118, 0.8);
  wallGfx.fillRect(GAME_WIDTH - r(25), 0, r(25), skyH);
  wallGfx.fillStyle(0x161622, 0.6);
  wallGfx.fillRect(GAME_WIDTH - r(40), 0, r(15), skyH);
  scene.dungeonSkyElements.push(wallGfx);

  // === Glowing crystals — static shapes in single Graphics + animated glow circles ===
  const crystalGfx = scene.add.graphics();
  crystalGfx.setDepth(-1);

  const crystals = [
    { x: 95, y: 60, color: 0x8b5cf6, sz: 6 },
    { x: 340, y: 40, color: 0x06b6d4, sz: 8 },
    { x: 480, y: 55, color: 0x8b5cf6, sz: 5 },
    { x: 620, y: 35, color: 0x22d3ee, sz: 7 },
    { x: 750, y: 50, color: 0xa855f7, sz: 6 },
    { x: 170, y: 80, color: 0x06b6d4, sz: 4 },
    { x: 555, y: 75, color: 0xa855f7, sz: 5 },
  ];

  crystals.forEach((cr, i) => {
    const cx = r(cr.x),
      cy = r(cr.y),
      cs = r(cr.sz);
    crystalGfx.fillStyle(cr.color, 0.8);
    crystalGfx.fillRect(cx - cs / 2, cy - cs, cs, cs * 2);
    crystalGfx.fillStyle(cr.color, 0.5);
    crystalGfx.fillRect(cx - cs, cy - cs / 2, cs * 2, cs);

    const glow = scene.add.circle(cx, cy, r(15), cr.color, 0.04);
    glow.setDepth(-1);
    scene.dungeonSkyElements.push(glow);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.02, to: 0.07 },
      duration: 2500 + i * 400,
      yoyo: true,
      repeat: -1,
    });
  });
  scene.dungeonSkyElements.push(crystalGfx);

  // === Distant wall torch lights — warm glow spots ===
  [
    { x: 40, y: 200 },
    { x: 200, y: 180 },
    { x: 400, y: 160 },
    { x: 600, y: 175 },
    { x: 760, y: 190 },
  ].forEach((wl, i) => {
    const light = scene.add.circle(r(wl.x), r(wl.y), r(30), 0xff8c00, 0.03);
    light.setDepth(-1);
    scene.dungeonSkyElements.push(light);
    scene.tweens.add({
      targets: light,
      alpha: { from: 0.02, to: 0.05 },
      duration: 1800 + i * 300,
      yoyo: true,
      repeat: -1,
    });
  });

  // === Water drip particles ===
  for (let i = 0; i < 5; i++) {
    const startY = r(30 + Math.random() * 60);
    const drip = scene.add.circle(r(100 + Math.random() * 600), startY, r(1.5), 0x4488cc, 0.4);
    drip.setDepth(-1);
    scene.dungeonSkyElements.push(drip);
    scene.tweens.add({
      targets: drip,
      y: startY + r(80),
      alpha: 0,
      duration: 2000 + Math.random() * 2000,
      repeat: -1,
      delay: i * 800,
      onRepeat: () => {
        drip.setPosition(r(100 + Math.random() * 600), startY);
        drip.setAlpha(0.4);
      },
    });
  }
}

function createDungeonDecorations(scene: WorldScene): void {
  const s = SCALE;
  const r = (n: number) => Math.round(n * s);
  const grassTop = r(455);
  const pathLevel = r(555);
  const centerX = GAME_WIDTH / 2;

  // === CAVE WALL FORMATIONS — single Graphics for all stalagmites ===
  const stalagGfx = scene.add.graphics();
  stalagGfx.setDepth(2);
  const baseY = grassTop + r(30);

  [
    { x: 30, h: 50, w: 18 },
    { x: 75, h: 35, w: 12 },
    { x: 120, h: 42, w: 14 },
    { x: 690, h: 48, w: 16 },
    { x: 740, h: 30, w: 11 },
    { x: 785, h: 55, w: 19 },
  ].forEach((st) => {
    const sx = r(st.x),
      sw = r(st.w),
      sh = r(st.h);
    const midW = Math.round(sw * 0.6),
      tipW = Math.round(sw * 0.3);
    stalagGfx.fillStyle(0x222230);
    stalagGfx.fillRect(sx - sw / 2, baseY - Math.round(sh * 0.6), sw, Math.round(sh * 0.6));
    stalagGfx.fillStyle(0x1e1e2a);
    stalagGfx.fillRect(sx - midW / 2, baseY - sh, midW, Math.round(sh * 0.5));
    stalagGfx.fillStyle(0x1a1a26);
    stalagGfx.fillRect(sx - tipW / 2, baseY - sh - r(8), tipW, r(12));
    stalagGfx.fillStyle(0x2e2e3c, 0.5);
    stalagGfx.fillRect(sx - sw / 2, baseY - Math.round(sh * 0.6), r(2), Math.round(sh * 0.5));
  });
  scene.dungeonElements.push(stalagGfx);

  // === STONE PILLARS (depth 3) ===
  [
    { x: 195, cracked: false },
    { x: 280, cracked: true },
    { x: 520, cracked: true },
    { x: 610, cracked: false },
  ].forEach((pos) => {
    const pillar = scene.add.sprite(r(pos.x), pathLevel - r(5), "dungeon_pillar");
    pillar.setOrigin(0.5, 1).setDepth(3);
    if (pos.cracked) pillar.setAlpha(0.7);
    scene.dungeonElements.push(pillar);
  });

  // === WALL TORCHES (depth 4) — flicker only, no bounce ===
  [
    { x: 200, y: 480 },
    { x: 285, y: 485 },
    { x: 370, y: 475 },
    { x: 440, y: 478 },
    { x: 520, y: 485 },
    { x: 605, y: 480 },
  ].forEach((pos, i) => {
    const torch = scene.add.sprite(r(pos.x), r(pos.y), "dungeon_torch");
    torch.setOrigin(0.5, 1).setDepth(4);
    scene.dungeonElements.push(torch);

    scene.tweens.add({
      targets: torch,
      alpha: { from: 0.75, to: 1.0 },
      duration: 300 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      delay: i * 100,
    });

    const glow = scene.add.circle(r(pos.x), r(pos.y + 20), r(28), 0xff8c00, 0.05);
    glow.setDepth(1);
    scene.dungeonElements.push(glow);

    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.03, to: 0.07 },
      duration: 400 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      delay: i * 120,
    });
  });

  // === GLOWING FLOOR CRYSTALS — single Graphics + animated glow circles ===
  const crystalGfx = scene.add.graphics();
  crystalGfx.setDepth(2);

  [
    { x: 155, y: 545, color: 0x8b5cf6, sz: 5 },
    { x: 330, y: 552, color: 0x06b6d4, sz: 4 },
    { x: 475, y: 548, color: 0xa855f7, sz: 6 },
    { x: 640, y: 550, color: 0x22d3ee, sz: 4 },
    { x: 250, y: 555, color: 0x7c3aed, sz: 3 },
    { x: 560, y: 553, color: 0x0891b2, sz: 5 },
  ].forEach((cr, i) => {
    const cx = r(cr.x),
      cy = r(cr.y),
      cs = r(cr.sz);
    crystalGfx.fillStyle(cr.color, 0.8);
    crystalGfx.fillRect(cx - Math.round(cs * 0.3), cy - cs * 2, Math.round(cs * 0.6), cs * 2);
    crystalGfx.fillStyle(cr.color, 0.5);
    crystalGfx.fillRect(
      cx - Math.round(cs * 0.15),
      cy - cs * 2.5,
      Math.round(cs * 0.3),
      Math.round(cs * 0.7)
    );

    const glow = scene.add.circle(cx, cy - cs, r(12), cr.color, 0.04);
    glow.setDepth(1);
    scene.dungeonElements.push(glow);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.02, to: 0.06 },
      duration: 2000 + i * 300,
      yoyo: true,
      repeat: -1,
    });
  });
  scene.dungeonElements.push(crystalGfx);

  // === SKULL PROPS (depth 2) ===
  [
    { x: 230, y: 555 },
    { x: 390, y: 558 },
    { x: 500, y: 550 },
    { x: 170, y: 548 },
    { x: 650, y: 553 },
  ].forEach((pos) => {
    const skull = scene.add.sprite(r(pos.x), r(pos.y), "dungeon_skull");
    skull.setOrigin(0.5, 1).setDepth(2).setAlpha(0.6);
    scene.dungeonElements.push(skull);
  });

  // === HANGING BANNERS (depth 3) ===
  [
    { x: 260, y: 455 },
    { x: 545, y: 458 },
  ].forEach((pos, i) => {
    const banner = scene.add.sprite(r(pos.x), r(pos.y), "dungeon_banner");
    banner.setOrigin(0.5, 0).setDepth(3);
    scene.dungeonElements.push(banner);
    scene.tweens.add({
      targets: banner,
      angle: { from: -1.5, to: 1.5 },
      duration: 3000 + i * 500,
      yoyo: true,
      repeat: -1,
    });
  });

  // === DUNGEON ENTRANCE (depth 5) — center portal ===
  const entrance = scene.add.sprite(centerX, pathLevel - r(5), "dungeon_entrance");
  entrance.setOrigin(0.5, 1).setDepth(5);
  scene.dungeonElements.push(entrance);

  const entranceGlow = scene.add.sprite(centerX, pathLevel - r(25), "dungeon_glow");
  entranceGlow.setOrigin(0.5, 1).setDepth(6).setAlpha(0.5);
  scene.dungeonElements.push(entranceGlow);
  scene.tweens.add({
    targets: entranceGlow,
    alpha: { from: 0.3, to: 0.7 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
  });

  const gate = scene.add.sprite(centerX, pathLevel - r(145), "dungeon_gate");
  gate.setOrigin(0.5, 0).setDepth(6).setAlpha(0.6);
  scene.dungeonElements.push(gate);

  // "ENTER DUNGEON" text
  const enterText = scene.add.text(centerX, pathLevel + r(15), "[ ENTER DUNGEON ]", {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${r(10)}px`,
    color: "#a855f7",
    stroke: "#1a1a2e",
    strokeThickness: r(3),
    align: "center",
  });
  enterText.setOrigin(0.5, 0).setDepth(11);
  scene.dungeonElements.push(enterText);
  scene.tweens.add({
    targets: enterText,
    alpha: { from: 0.6, to: 1.0 },
    duration: 1200,
    yoyo: true,
    repeat: -1,
  });

  // Interactive — single handler for both entrance and text
  const openDungeon = () => {
    if ((scene as any).wasDragGesture) return;
    window.dispatchEvent(new CustomEvent("bagsworld-open-dungeon"));
  };
  entrance.setInteractive({ useHandCursor: true }).on("pointerup", openDungeon);
  enterText.setInteractive({ useHandCursor: true }).on("pointerup", openDungeon);

  // === DUST MOTES (depth 8) ===
  for (let i = 0; i < 15; i++) {
    const isEmber = i % 5 === 0;
    const alpha = isEmber ? 0.4 : 0.15;
    const px = r(100 + Math.random() * 600);
    const py = r(420 + Math.random() * 130);
    const mote = scene.add.circle(
      px,
      py,
      r(0.8 + Math.random() * 0.8),
      isEmber ? 0xff6600 : 0x888899,
      alpha
    );
    mote.setDepth(8);
    scene.dungeonElements.push(mote);
    scene.tweens.add({
      targets: mote,
      y: py - r(20 + Math.random() * 40),
      x: px + r(-15 + Math.random() * 30),
      alpha: 0,
      duration: 5000 + Math.random() * 5000,
      repeat: -1,
      delay: i * 500,
      onRepeat: () => {
        mote.setPosition(r(100 + Math.random() * 600), r(420 + Math.random() * 130));
        mote.setAlpha(alpha);
      },
    });
  }

  // === GROUND FOG (depth 1) ===
  for (let i = 0; i < 8; i++) {
    const fogX = r(60 + i * 95);
    const fog = scene.add.rectangle(
      fogX,
      pathLevel + r(3),
      r(60 + Math.random() * 50),
      r(6),
      0x2a2a3a,
      0.12
    );
    fog.setDepth(1);
    scene.dungeonElements.push(fog);
    scene.tweens.add({
      targets: fog,
      x: fogX + r(25),
      alpha: { from: 0.06, to: 0.15 },
      duration: 5000 + Math.random() * 3000,
      yoyo: true,
      repeat: -1,
      delay: i * 400,
    });
  }

  // === MOSS + ROCKS — single Graphics for static ground details ===
  const groundGfx = scene.add.graphics();
  groundGfx.setDepth(1);
  // Moss patches
  for (const m of [
    { x: 160, y: 555, w: 20, h: 4 },
    { x: 350, y: 558, w: 15, h: 3 },
    { x: 550, y: 556, w: 18, h: 4 },
    { x: 700, y: 554, w: 12, h: 3 },
  ]) {
    groundGfx.fillStyle(0x1a3a1a, 0.4);
    groundGfx.fillRect(r(m.x) - r(m.w) / 2, r(m.y) - r(m.h), r(m.w), r(m.h));
  }
  scene.dungeonElements.push(groundGfx);

  // Rocks with highlight — single Graphics at depth 2
  const rockGfx = scene.add.graphics();
  rockGfx.setDepth(2);
  for (const p of [
    { x: 140, y: 555, w: 14, h: 7 },
    { x: 310, y: 558, w: 10, h: 5 },
    { x: 460, y: 554, w: 12, h: 6 },
    { x: 590, y: 557, w: 11, h: 6 },
    { x: 680, y: 553, w: 13, h: 7 },
  ]) {
    rockGfx.fillStyle(0x28283a);
    rockGfx.fillRect(r(p.x) - r(p.w) / 2, r(p.y) - r(p.h), r(p.w), r(p.h));
    rockGfx.fillStyle(0x38384a, 0.4);
    rockGfx.fillRect(r(p.x) - r(p.w) / 2, r(p.y) - r(p.h), r(2), Math.round(r(p.h) * 0.5));
  }
  scene.dungeonElements.push(rockGfx);

  // === COBWEBS — single Graphics for both corners ===
  const webGfx = scene.add.graphics();
  webGfx.setDepth(3).setAlpha(0.15);
  webGfx.lineStyle(r(1), 0x888888);
  for (const wb of [
    { x: 50, y: 430 },
    { x: 760, y: 435 },
  ]) {
    const wx = r(wb.x),
      wy = r(wb.y),
      ws = r(35);
    for (let a = 0; a < 5; a++) {
      const angle = (a / 5) * Math.PI * 0.5;
      webGfx.lineBetween(wx, wy, wx + Math.cos(angle) * ws, wy + Math.sin(angle) * ws);
    }
  }
  scene.dungeonElements.push(webGfx);
}
