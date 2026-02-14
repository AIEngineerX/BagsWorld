import * as Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { SCALE, DEPTH, Y } from "../textures/constants";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 960;

// ============================================================================
// ARENA ZONE — MoltBook Arena with real-time AI agent combat
// ============================================================================

export function setupArenaZone(scene: WorldScene): void {
  createArenaSky(scene);

  scene.ground.setVisible(true);
  scene.ground.setTexture("arena_floor");

  // Check if elements were destroyed (can happen during transitions)
  const elementsValid =
    scene.arenaElements.length > 0 &&
    scene.arenaElements.every((el) => (el as any).active !== false);

  if (!elementsValid && scene.arenaZoneCreated) {
    scene.arenaElements = [];
    scene.arenaZoneCreated = false;
  }

  if (!scene.arenaZoneCreated) {
    createArenaDecorations(scene);
    scene.arenaZoneCreated = true;
  } else {
    scene.arenaElements.forEach((el) => (el as any).setVisible(true));
  }

  initArenaConnection(scene);
}

function createArenaSky(scene: WorldScene): void {
  scene.restoreNormalSky();
}

/**
 * Create Arena decorations - fighting ring, stands, lights, props
 * Following zone guide: 20+ props, textured ground, proper depths
 */
function createArenaDecorations(scene: WorldScene): void {
  const s = SCALE;
  const grassTop = Y.GRASS_TOP;
  const pathLevel = Y.PATH_LEVEL;
  const centerX = GAME_WIDTH / 2;

  // === BACKGROUND TREES (depth 2) - Dark silhouettes ===
  const treePositions = [
    { x: 50, yOffset: 0 },
    { x: 140, yOffset: 5 },
    { x: 230, yOffset: -3 },
    { x: 570, yOffset: 2 },
    { x: 660, yOffset: 6 },
    { x: 750, yOffset: -2 },
  ];

  treePositions.forEach((pos) => {
    const tree = scene.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "tree");
    tree.setOrigin(0.5, 1);
    tree.setDepth(2);
    tree.setScale(0.85 + Math.random() * 0.25);
    tree.setTint(0x1a1a2e); // Dark tint for arena atmosphere
    scene.arenaElements.push(tree);
  });

  // === BUSHES/HEDGES (depth 2) ===
  const bushPositions = [
    { x: 90, yOffset: 25 },
    { x: 180, yOffset: 22 },
    { x: 620, yOffset: 27 },
    { x: 710, yOffset: 24 },
  ];

  bushPositions.forEach((pos) => {
    const bush = scene.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "bush");
    bush.setOrigin(0.5, 1);
    bush.setDepth(2);
    bush.setScale(0.7 + Math.random() * 0.2);
    bush.setTint(0x1e3a8a); // Dark blue tint
    scene.arenaElements.push(bush);
  });

  // === SPECTATOR STANDS (depth 2) - Left side ===
  const leftStands = scene.add.sprite(Math.round(120 * s), Math.round(500 * s), "arena_stands");
  leftStands.setOrigin(0.5, 1);
  leftStands.setDepth(2);
  leftStands.setScale(1.2);
  scene.arenaElements.push(leftStands);

  // === SPECTATOR STANDS (depth 2) - Right side ===
  const rightStands = scene.add.sprite(Math.round(680 * s), Math.round(500 * s), "arena_stands");
  rightStands.setOrigin(0.5, 1);
  rightStands.setDepth(2);
  rightStands.setScale(1.2);
  rightStands.setFlipX(true);
  scene.arenaElements.push(rightStands);

  // === ANIMATED CROWD ON STANDS (depth 2.5) ===
  scene.arenaCrowdSprites = []; // Reset crowd array
  const crowdPositions = [
    // Left stands
    { x: 60, y: 480 },
    { x: 90, y: 475 },
    { x: 120, y: 478 },
    { x: 150, y: 472 },
    { x: 80, y: 490 },
    { x: 110, y: 488 },
    { x: 140, y: 485 },
    // Right stands
    { x: 650, y: 480 },
    { x: 680, y: 475 },
    { x: 710, y: 478 },
    { x: 740, y: 472 },
    { x: 660, y: 490 },
    { x: 690, y: 488 },
    { x: 720, y: 485 },
  ];

  crowdPositions.forEach((pos, i) => {
    const variant = i % 4;
    const crowd = scene.add.sprite(
      Math.round(pos.x * s),
      Math.round(pos.y * s),
      `arena_crowd_idle_${variant}`
    );
    crowd.setOrigin(0.5, 1);
    crowd.setDepth(2.5);
    crowd.setScale(0.9 + Math.random() * 0.2);
    crowd.setData("variant", variant);
    scene.arenaElements.push(crowd);
    scene.arenaCrowdSprites.push(crowd);

    // Idle bob animation (subtle up/down)
    scene.tweens.add({
      targets: crowd,
      y: crowd.y - Math.round(3 * s),
      duration: 1200 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 500,
    });
  });

  // === SPOTLIGHT CONES (depth 1, behind ring) ===
  scene.arenaSpotlightCones = [];
  const spotlightPositions = [200, 400, 600];
  spotlightPositions.forEach((lx) => {
    const cone = scene.add.sprite(Math.round(lx * s), Math.round(50 * s), "arena_spotlight_cone");
    cone.setOrigin(0.5, 0);
    cone.setDepth(1);
    cone.setAlpha(0.6);
    scene.arenaElements.push(cone);
    scene.arenaSpotlightCones.push(cone);

    // Subtle angle sway animation
    scene.tweens.add({
      targets: cone,
      angle: { from: -3, to: 3 },
      duration: 2000 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * 1000,
    });
  });

  // === COLORED CORNER POSTS (depth 4) ===
  // Red corner (left fighter spawn point)
  const redCorner = scene.add.sprite(
    Math.round(280 * s),
    pathLevel + Math.round(5 * s),
    "arena_corner_red"
  );
  redCorner.setOrigin(0.5, 1);
  redCorner.setDepth(4);
  scene.arenaElements.push(redCorner);

  // Blue corner (right fighter spawn point)
  const blueCorner = scene.add.sprite(
    Math.round(520 * s),
    pathLevel + Math.round(5 * s),
    "arena_corner_blue"
  );
  blueCorner.setOrigin(0.5, 1);
  blueCorner.setDepth(4);
  scene.arenaElements.push(blueCorner);

  // === BARRIER POSTS (depth 3) - Around the ring ===
  const barrierPositions = [260, 340, 460, 540];
  barrierPositions.forEach((bx) => {
    // Post
    const post = scene.add.rectangle(
      Math.round(bx * s),
      pathLevel - Math.round(5 * s),
      Math.round(6 * s),
      Math.round(40 * s),
      0x374151
    );
    post.setOrigin(0.5, 1);
    post.setDepth(3);
    scene.arenaElements.push(post);

    // Post cap (gold)
    const cap = scene.add.rectangle(
      Math.round(bx * s),
      pathLevel - Math.round(43 * s),
      Math.round(10 * s),
      Math.round(6 * s),
      0xfbbf24
    );
    cap.setOrigin(0.5, 1);
    cap.setDepth(3);
    scene.arenaElements.push(cap);
  });

  // === ROPE BARRIERS (depth 3) - with sway animation ===
  // Left rope
  const leftRope = scene.add.rectangle(
    Math.round(300 * s),
    pathLevel - Math.round(25 * s),
    Math.round(80 * s),
    Math.round(4 * s),
    0xef4444
  );
  leftRope.setDepth(3);
  scene.arenaElements.push(leftRope);

  // Left rope sway animation
  scene.tweens.add({
    targets: leftRope,
    scaleY: { from: 1, to: 0.92 },
    duration: 800 + Math.random() * 200,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Right rope
  const rightRope = scene.add.rectangle(
    Math.round(500 * s),
    pathLevel - Math.round(25 * s),
    Math.round(80 * s),
    Math.round(4 * s),
    0xef4444
  );
  rightRope.setDepth(3);
  scene.arenaElements.push(rightRope);

  // Right rope sway animation
  scene.tweens.add({
    targets: rightRope,
    scaleY: { from: 1, to: 0.92 },
    duration: 900 + Math.random() * 200,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
    delay: 150,
  });

  // === ARENA RING (depth 4) - Center ===
  const ring = scene.add.sprite(centerX, pathLevel + Math.round(20 * s), "arena_ring");
  ring.setOrigin(0.5, 1);
  ring.setDepth(4);
  scene.arenaElements.push(ring);

  // === LAMP POSTS (depth 3) ===
  const lampPositions = [80, 280, 520, 720];
  lampPositions.forEach((lx) => {
    // Lamp pole
    const pole = scene.add.rectangle(
      Math.round(lx * s),
      pathLevel,
      Math.round(4 * s),
      Math.round(60 * s),
      0x1f2937
    );
    pole.setOrigin(0.5, 1);
    pole.setDepth(3);
    scene.arenaElements.push(pole);

    // Lamp head
    const head = scene.add.rectangle(
      Math.round(lx * s),
      pathLevel - Math.round(60 * s),
      Math.round(12 * s),
      Math.round(8 * s),
      0x374151
    );
    head.setOrigin(0.5, 0.5);
    head.setDepth(3);
    scene.arenaElements.push(head);

    // Lamp glow
    const glow = scene.add.ellipse(
      Math.round(lx * s),
      pathLevel - Math.round(50 * s),
      Math.round(20 * s),
      Math.round(30 * s),
      0xfbbf24,
      0.15
    );
    glow.setDepth(3);
    scene.arenaElements.push(glow);

    // Glow animation
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.1, to: 0.2 },
      duration: 1000 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === BENCHES (depth 3) ===
  const benchPositions = [160, 640];
  benchPositions.forEach((bx) => {
    // Bench seat
    const seat = scene.add.rectangle(
      Math.round(bx * s),
      pathLevel - Math.round(8 * s),
      Math.round(40 * s),
      Math.round(6 * s),
      0x78350f
    );
    seat.setOrigin(0.5, 0.5);
    seat.setDepth(3);
    scene.arenaElements.push(seat);

    // Bench legs
    const leg1 = scene.add.rectangle(
      Math.round((bx - 15) * s),
      pathLevel,
      Math.round(4 * s),
      Math.round(12 * s),
      0x451a03
    );
    leg1.setOrigin(0.5, 1);
    leg1.setDepth(3);
    scene.arenaElements.push(leg1);

    const leg2 = scene.add.rectangle(
      Math.round((bx + 15) * s),
      pathLevel,
      Math.round(4 * s),
      Math.round(12 * s),
      0x451a03
    );
    leg2.setOrigin(0.5, 1);
    leg2.setDepth(3);
    scene.arenaElements.push(leg2);
  });

  // === STADIUM LIGHTS (depth 15) ===
  const lightPositions = [Math.round(200 * s), Math.round(400 * s), Math.round(600 * s)];
  lightPositions.forEach((lx) => {
    const light = scene.add.sprite(lx, Math.round(50 * s), "arena_light");
    light.setOrigin(0.5, 0);
    light.setDepth(15);
    scene.arenaElements.push(light);

    // Flickering light effect
    scene.tweens.add({
      targets: light,
      alpha: { from: 0.9, to: 1 },
      duration: 200 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === DECORATIVE FLAGS (depth 4) ===
  const flagColors = [0xef4444, 0xfbbf24, 0x4ade80, 0x3b82f6];
  const flagPositions = [120, 220, 580, 680];
  flagPositions.forEach((fx, i) => {
    // Flag pole
    const flagPole = scene.add.rectangle(
      Math.round(fx * s),
      grassTop + Math.round(30 * s),
      Math.round(3 * s),
      Math.round(50 * s),
      0x6b7280
    );
    flagPole.setOrigin(0.5, 1);
    flagPole.setDepth(4);
    scene.arenaElements.push(flagPole);

    // Flag
    const flag = scene.add.rectangle(
      Math.round((fx + 10) * s),
      grassTop - Math.round(12 * s),
      Math.round(20 * s),
      Math.round(14 * s),
      flagColors[i % flagColors.length]
    );
    flag.setOrigin(0, 0.5);
    flag.setDepth(4);
    scene.arenaElements.push(flag);

    // Flag wave animation
    scene.tweens.add({
      targets: flag,
      scaleX: { from: 1, to: 0.9 },
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  });

  // === LOGO MAT - Center ring with $ symbol ===
  const logoMat = scene.add.sprite(centerX, pathLevel + Math.round(10 * s), "arena_logo_mat");
  logoMat.setOrigin(0.5, 0.5);
  logoMat.setDepth(1);
  logoMat.setAlpha(0.9);
  scene.arenaElements.push(logoMat);

  // === INFO BUTTON (opens ArenaModal with copyable instructions) ===
  // Positioned next to the MATCH status box (top right area)
  const infoBtnX = Math.round(700 * s) + Math.round(75 * s);
  const infoBtnY = Math.round(80 * s);
  const infoBtn = scene.add.rectangle(
    infoBtnX,
    infoBtnY,
    Math.round(24 * s),
    Math.round(20 * s),
    0xdc2626,
    1
  );
  infoBtn.setDepth(DEPTH.UI_MID);
  infoBtn.setStrokeStyle(1, 0xfbbf24);
  infoBtn.setInteractive({ useHandCursor: true });
  infoBtn.on("pointerover", () => infoBtn.setFillStyle(0xef4444));
  infoBtn.on("pointerout", () => infoBtn.setFillStyle(0xdc2626));
  infoBtn.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    window.dispatchEvent(new CustomEvent("bagsworld-arena-click"));
  });
  scene.arenaElements.push(infoBtn);

  const infoText = scene.add.text(infoBtnX, infoBtnY, "?", {
    fontFamily: "monospace",
    fontSize: `${Math.round(12 * s)}px`,
    color: "#ffffff",
    fontStyle: "bold",
  });
  infoText.setOrigin(0.5, 0.5);
  infoText.setDepth(DEPTH.UI_HIGH);
  scene.arenaElements.push(infoText);

  // === QUEUE STATUS (depth 100) ===
  const queueBg = scene.add.rectangle(
    Math.round(100 * s),
    Math.round(80 * s),
    Math.round(120 * s),
    Math.round(50 * s),
    0x0a0a0f,
    0.8
  );
  queueBg.setDepth(DEPTH.UI_LOW);
  queueBg.setStrokeStyle(1, 0x4ade80);
  scene.arenaElements.push(queueBg);

  const queueLabel = scene.add.text(Math.round(100 * s), Math.round(65 * s), "QUEUE", {
    fontFamily: "monospace",
    fontSize: `${Math.round(8 * s)}px`,
    color: "#4ade80",
  });
  queueLabel.setOrigin(0.5, 0.5);
  queueLabel.setDepth(DEPTH.UI_MID);
  scene.arenaElements.push(queueLabel);

  const queueCount = scene.add.text(Math.round(100 * s), Math.round(88 * s), "0 WAITING", {
    fontFamily: "monospace",
    fontSize: `${Math.round(10 * s)}px`,
    color: "#ffffff",
  });
  queueCount.setOrigin(0.5, 0.5);
  queueCount.setDepth(DEPTH.UI_MID);
  queueCount.setName("arenaQueueCount");
  scene.arenaElements.push(queueCount);

  // === MATCH STATUS (depth 100) ===
  const matchBg = scene.add.rectangle(
    Math.round(700 * s),
    Math.round(80 * s),
    Math.round(120 * s),
    Math.round(50 * s),
    0x0a0a0f,
    0.8
  );
  matchBg.setDepth(DEPTH.UI_LOW);
  matchBg.setStrokeStyle(1, 0xef4444);
  scene.arenaElements.push(matchBg);

  const matchLabel = scene.add.text(Math.round(700 * s), Math.round(65 * s), "MATCH", {
    fontFamily: "monospace",
    fontSize: `${Math.round(8 * s)}px`,
    color: "#ef4444",
  });
  matchLabel.setOrigin(0.5, 0.5);
  matchLabel.setDepth(DEPTH.UI_MID);
  scene.arenaElements.push(matchLabel);

  const matchStatus = scene.add.text(Math.round(700 * s), Math.round(88 * s), "NO MATCH", {
    fontFamily: "monospace",
    fontSize: `${Math.round(10 * s)}px`,
    color: "#ffffff",
  });
  matchStatus.setOrigin(0.5, 0.5);
  matchStatus.setDepth(DEPTH.UI_MID);
  matchStatus.setName("arenaMatchStatus");
  scene.arenaElements.push(matchStatus);

  // === HOW TO FIGHT PANEL (Pixel Modal Style) ===
  createArenaHowToPanel(scene, centerX, Math.round(170 * s), s);

  // === LEADERBOARD PANEL (below queue status, top-left area) ===
  const lbX = Math.round(100 * s);
  const lbY = Math.round(155 * s);
  const lbWidth = Math.round(130 * s);
  const lbHeight = Math.round(90 * s);

  const lbBg = scene.add.rectangle(lbX, lbY, lbWidth, lbHeight, 0x0f172a, 0.92);
  lbBg.setDepth(DEPTH.UI_LOW);
  lbBg.setStrokeStyle(2, 0xfbbf24);
  scene.arenaElements.push(lbBg);

  const lbTitle = scene.add.text(lbX, lbY - lbHeight / 2 + Math.round(12 * s), "TOP FIGHTERS", {
    fontFamily: "monospace",
    fontSize: `${Math.round(8 * s)}px`,
    color: "#fbbf24",
    fontStyle: "bold",
  });
  lbTitle.setOrigin(0.5, 0.5);
  lbTitle.setDepth(DEPTH.UI_MID);
  scene.arenaElements.push(lbTitle);

  // Leaderboard entries (will be updated by polling)
  const lbEntries = scene.add.text(lbX, lbY + Math.round(8 * s), "Loading...", {
    fontFamily: "monospace",
    fontSize: `${Math.round(6 * s)}px`,
    color: "#d1d5db",
    align: "center",
    lineSpacing: 2,
  });
  lbEntries.setOrigin(0.5, 0.5);
  lbEntries.setDepth(DEPTH.UI_MID);
  lbEntries.setName("arenaLeaderboard");
  scene.arenaElements.push(lbEntries);

  // === VS DISPLAY for active match (depth 100) ===
  const vsDisplay = scene.add.text(centerX, Math.round(70 * s), "", {
    fontFamily: "monospace",
    fontSize: `${Math.round(12 * s)}px`,
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
  });
  vsDisplay.setOrigin(0.5, 0.5);
  vsDisplay.setDepth(DEPTH.UI_MID);
  vsDisplay.setName("arenaVsDisplay");
  scene.arenaElements.push(vsDisplay);

  // Fetch initial leaderboard
  fetchArenaLeaderboard(scene);
}

async function fetchArenaLeaderboard(scene: WorldScene): Promise<void> {
  try {
    const response = await fetch("/api/arena/brawl?action=leaderboard&limit=5");
    const data = await response.json();

    const lbText = scene.arenaElements.find(
      (el) => (el as Phaser.GameObjects.Text).name === "arenaLeaderboard"
    ) as Phaser.GameObjects.Text;

    if (lbText && data.success && data.leaderboard) {
      if (data.leaderboard.length === 0) {
        lbText.setText("No fights yet!\nClick ? to join");
      } else {
        const entries = data.leaderboard
          .slice(0, 4)
          .map((f: { moltbook_username: string; wins: number; losses: number }, i: number) => {
            const name =
              f.moltbook_username.length > 10
                ? f.moltbook_username.slice(0, 8) + ".."
                : f.moltbook_username;
            return `${i + 1}. ${name} ${f.wins}W`;
          })
          .join("\n");
        lbText.setText(entries);
      }
    }
  } catch {
    // Silently fail - will retry on next poll
  }
}

// ============================================================================
// REPLAY-BASED ARENA CONNECTION (replaces WebSocket)
// ============================================================================

// Replay playback state
interface ReplayState {
  replay: import("@/lib/arena-types").FightReplay;
  keyframeIndex: number;
  timer: Phaser.Time.TimerEvent | null;
  lastPlayedMatchId: number;
}

let replayState: ReplayState | null = null;
let replayEventListener: ((e: Event) => void) | null = null;

/**
 * Initialize arena connection - listens for replay events, starts status polling
 */
export function initArenaConnection(scene: WorldScene): void {
  // Listen for replay events dispatched from ArenaModal
  if (!replayEventListener) {
    replayEventListener = (e: Event) => {
      const detail = (e as CustomEvent).detail as { matchId: number };
      if (detail?.matchId) {
        fetchAndPlayReplay(scene, detail.matchId);
      }
    };
    window.addEventListener("bagsworld-arena-replay", replayEventListener);
  }

  // Start lightweight status polling
  startArenaStatusPolling(scene);

  // Auto-fetch latest replay on zone entry
  fetchLatestReplay(scene);
}

/**
 * Disconnect arena - stop replay, destroy polling, remove event listener
 */
export function disconnectArena(scene: WorldScene): void {
  stopReplay(scene);

  // Clean up polling timer
  if (scene.arenaPollingTimer) {
    scene.arenaPollingTimer.destroy();
    scene.arenaPollingTimer = null;
  }

  // Clean up the replay cleanup function stored on scene
  if (scene.arenaReplayCleanup) {
    scene.arenaReplayCleanup();
    scene.arenaReplayCleanup = null;
  }

  // Remove event listener
  if (replayEventListener) {
    window.removeEventListener("bagsworld-arena-replay", replayEventListener);
    replayEventListener = null;
  }
}

/**
 * Play a fight replay through the existing animation pipeline
 */
function playReplay(scene: WorldScene, replay: import("@/lib/arena-types").FightReplay): void {
  // Stop any current replay
  stopReplay(scene);

  if (!replay.keyframes || replay.keyframes.length === 0) {
    console.warn("[Arena] Replay has no keyframes");
    return;
  }

  console.log(
    `[Arena] Playing replay: match ${replay.matchId}, ${replay.keyframes.length} keyframes`
  );

  // Store match state info for animation system (used by showHitEffect for attacker detection)
  const firstKf = replay.keyframes[0];
  scene.arenaMatchState = {
    matchId: replay.matchId,
    status: "active",
    fighter1: {
      id: replay.fighter1.id,
      hp: firstKf.f1.hp,
      maxHp: replay.fighter1.maxHp,
      x: firstKf.f1.x,
      y: firstKf.f1.y,
      state: firstKf.f1.s,
    },
    fighter2: {
      id: replay.fighter2.id,
      hp: firstKf.f2.hp,
      maxHp: replay.fighter2.maxHp,
      x: firstKf.f2.x,
      y: firstKf.f2.y,
      state: firstKf.f2.s,
    },
  };

  // Trigger crowd cheer at start
  triggerCrowdCheer(scene);

  // Show VS announcement
  showArenaAnnouncement(
    scene,
    `${replay.fighter1.username}  VS  ${replay.fighter2.username}`,
    "#22c55e"
  );

  replayState = {
    replay,
    keyframeIndex: 0,
    timer: null,
    lastPlayedMatchId: replay.matchId,
  };

  // Start playback timer
  replayState.timer = scene.time.addEvent({
    delay: 100, // REPLAY_PLAYBACK_MS
    callback: () => advanceReplay(scene),
    loop: true,
  });
}

/**
 * Advance replay by one keyframe - transforms compact format to full state for animations
 */
function advanceReplay(scene: WorldScene): void {
  if (!replayState || scene.currentZone !== "arena") {
    stopReplay(scene);
    return;
  }

  const { replay, keyframeIndex } = replayState;
  if (keyframeIndex >= replay.keyframes.length) {
    stopReplay(scene);
    return;
  }

  const kf = replay.keyframes[keyframeIndex];

  // Determine if this is the last keyframe (match end)
  const isLastKeyframe = keyframeIndex === replay.keyframes.length - 1;
  const isCompleted = isLastKeyframe && replay.winner;

  // Transform compact keyframe into the format updateArenaMatch expects
  const state = {
    matchId: replay.matchId,
    status: isCompleted ? "completed" : "active",
    tick: kf.t,
    fighter1: {
      id: replay.fighter1.id,
      username: replay.fighter1.username,
      hp: kf.f1.hp,
      maxHp: replay.fighter1.maxHp,
      x: kf.f1.x,
      y: kf.f1.y,
      state: kf.f1.s,
      direction: kf.f1.d,
    },
    fighter2: {
      id: replay.fighter2.id,
      username: replay.fighter2.username,
      hp: kf.f2.hp,
      maxHp: replay.fighter2.maxHp,
      x: kf.f2.x,
      y: kf.f2.y,
      state: kf.f2.s,
      direction: kf.f2.d,
    },
    winner: isCompleted ? replay.winner : undefined,
  };

  // Feed into existing animation pipeline - state transitions trigger all VFX
  updateArenaMatch(scene, state);

  replayState.keyframeIndex++;
}

/**
 * Stop current replay playback
 */
function stopReplay(scene: WorldScene): void {
  if (replayState?.timer) {
    replayState.timer.destroy();
    replayState.timer = null;
  }
  // Don't clear replayState.lastPlayedMatchId so we can avoid replaying same match
}

/**
 * Fetch and play a replay for a specific match
 */
async function fetchAndPlayReplay(scene: WorldScene, matchId: number): Promise<void> {
  if (scene.currentZone !== "arena") return;

  try {
    const res = await fetch(`/api/arena/brawl?action=replay&matchId=${matchId}`);
    const data = await res.json();

    if (data.success && data.replay) {
      playReplay(scene, data.replay);
    } else {
      console.warn(`[Arena] No replay found for match ${matchId}`);
    }
  } catch (err) {
    console.error("[Arena] Failed to fetch replay:", err);
  }
}

/**
 * Fetch and auto-play the latest available replay
 */
async function fetchLatestReplay(scene: WorldScene): Promise<void> {
  if (scene.currentZone !== "arena") return;

  try {
    const res = await fetch("/api/arena/brawl?action=latest_replay");
    const data = await res.json();

    if (data.success && data.replay) {
      // Don't replay the same match we just played
      if (replayState?.lastPlayedMatchId === data.replay.matchId) return;
      playReplay(scene, data.replay);
    }
  } catch (err) {
    console.warn(
      "[Arena] Failed to fetch latest replay:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Lightweight status polling - queue count, leaderboard, auto-fetch new replays
 */
function startArenaStatusPolling(scene: WorldScene): void {
  // Clean up any existing polling timer
  if (scene.arenaPollingTimer) {
    scene.arenaPollingTimer.destroy();
    scene.arenaPollingTimer = null;
  }

  let pollCount = 0;

  scene.arenaPollingTimer = scene.time.addEvent({
    delay: 3000, // Poll every 3 seconds
    callback: async () => {
      if (scene.currentZone !== "arena") return;

      try {
        // Queue status every 3s
        const queueRes = await fetch("/api/arena/brawl?action=queue");
        const queueData = await queueRes.json();
        if (queueData.success) {
          updateArenaQueue(scene, queueData.queue?.fighters || []);
        }

        pollCount++;

        // Leaderboard every 30s (10 polls)
        if (pollCount % 10 === 0) {
          fetchArenaLeaderboard(scene);
        }

        // Auto-fetch new replays every 15s (5 polls) when not currently playing
        if (pollCount % 5 === 0 && !replayState?.timer) {
          fetchLatestReplay(scene);
        }

        // Check MoltBook for new !fight posts every 30s (10 polls)
        if (pollCount % 10 === 0) {
          fetch("/api/arena/brawl", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "poll" }),
          }).catch((err) =>
            console.warn("[Arena] MoltBook poll failed:", err instanceof Error ? err.message : err)
          );
        }
      } catch (err) {
        console.error("[Arena] Polling error:", err);
      }
    },
    loop: true,
  });
}

function updateArenaQueue(scene: WorldScene, queue: Array<{ fighter_id: number }>): void {
  const queueCount = scene.arenaElements.find(
    (el) => (el as Phaser.GameObjects.Text).name === "arenaQueueCount"
  ) as Phaser.GameObjects.Text;

  if (queueCount) {
    const count = queue?.length || 0;
    queueCount.setText(`${count} WAITING`);
  }
}

/**
 * Create the "Click to Fight" button panel - opens ArenaModal
 */
function createArenaHowToPanel(scene: WorldScene, cx: number, cy: number, s: number): void {
  const panelW = Math.round(280 * s);
  const panelH = Math.round(120 * s);
  const borderW = Math.round(3 * s);
  const accent = 0x22c55e; // Green accent

  // Container for all panel elements
  const panel = scene.add.container(cx, cy);
  panel.setDepth(DEPTH.UI_LOW);
  panel.setAlpha(0);
  panel.setScale(0.8);
  scene.arenaElements.push(panel);

  // === DROP SHADOW ===
  const shadow = scene.add.rectangle(
    Math.round(4 * s),
    Math.round(4 * s),
    panelW + borderW * 2,
    panelH + borderW * 2,
    0x000000,
    0.5
  );
  panel.add(shadow);

  // === OUTER BORDER ===
  const outerBorder = scene.add.rectangle(0, 0, panelW + borderW * 2, panelH + borderW * 2, accent);
  panel.add(outerBorder);

  // === MAIN BACKGROUND ===
  const panelBg = scene.add.rectangle(0, 0, panelW, panelH, 0x0f172a);
  panel.add(panelBg);

  // === TITLE ===
  const titleText = scene.add.text(0, -panelH / 2 + Math.round(20 * s), "⚔ MOLTBOOK ARENA ⚔", {
    fontFamily: "monospace",
    fontSize: `${Math.round(12 * s)}px`,
    color: "#22c55e",
    fontStyle: "bold",
  });
  titleText.setOrigin(0.5, 0.5);
  panel.add(titleText);

  // === BIG CLICK TO FIGHT BUTTON ===
  const btnW = Math.round(200 * s);
  const btnH = Math.round(50 * s);
  const btnY = Math.round(5 * s);

  const btnShadow = scene.add.rectangle(
    Math.round(3 * s),
    btnY + Math.round(3 * s),
    btnW,
    btnH,
    0x166534
  );
  panel.add(btnShadow);

  const btnBg = scene.add.rectangle(0, btnY, btnW, btnH, 0x22c55e);
  btnBg.setInteractive({ useHandCursor: true });
  panel.add(btnBg);

  const btnText = scene.add.text(0, btnY, "⚔ CLICK TO FIGHT ⚔", {
    fontFamily: "monospace",
    fontSize: `${Math.round(14 * s)}px`,
    color: "#000000",
    fontStyle: "bold",
  });
  btnText.setOrigin(0.5, 0.5);
  panel.add(btnText);

  // === SUBTITLE ===
  const subText = scene.add.text(
    0,
    panelH / 2 - Math.round(18 * s),
    "Enter your username to join the queue",
    {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * s)}px`,
      color: "#9ca3af",
    }
  );
  subText.setOrigin(0.5, 0.5);
  panel.add(subText);

  // === BUTTON INTERACTIONS ===
  btnBg.on("pointerover", () => {
    btnBg.setFillStyle(0x4ade80);
    btnText.setColor("#000000");
  });
  btnBg.on("pointerout", () => {
    btnBg.setFillStyle(0x22c55e);
    btnText.setColor("#000000");
  });
  btnBg.on("pointerup", () => {
    if ((scene as any).wasDragGesture) return;
    // Open the ArenaModal
    window.dispatchEvent(new CustomEvent("bagsworld-arena-click"));
  });

  // === PULSE ANIMATION ===
  scene.tweens.add({
    targets: [btnBg, btnShadow],
    scaleX: 1.02,
    scaleY: 1.02,
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Animate panel in
  scene.tweens.add({
    targets: panel,
    alpha: 1,
    scale: 1,
    duration: 400,
    ease: "Back.easeOut",
    delay: 300,
  });
}

function updateActiveMatches(
  scene: WorldScene,
  matches: Array<{ matchId: number; status: string }>
): void {
  const matchStatus = scene.arenaElements.find(
    (el) => (el as Phaser.GameObjects.Text).name === "arenaMatchStatus"
  ) as Phaser.GameObjects.Text;

  if (matchStatus) {
    const activeCount = matches?.filter((m) => m.status === "active").length || 0;
    if (activeCount > 0) {
      matchStatus.setText(`${activeCount} ACTIVE`);
      matchStatus.setColor("#22c55e");
    } else {
      matchStatus.setText("NO MATCH");
      matchStatus.setColor("#ffffff");
    }
  }
}

/**
 * Update match state - render fighters and combat
 */
function updateArenaMatch(
  scene: WorldScene,
  state: {
    matchId: number;
    status: string;
    tick: number;
    fighter1: {
      id: number;
      username?: string;
      hp: number;
      maxHp: number;
      x: number;
      y: number;
      state: string;
      direction: string;
    };
    fighter2: {
      id: number;
      username?: string;
      hp: number;
      maxHp: number;
      x: number;
      y: number;
      state: string;
      direction: string;
    };
    winner?: string;
  }
): void {
  if (scene.currentZone !== "arena") return;

  const s = SCALE;
  const ringCenterX = GAME_WIDTH / 2;
  const ringY = Math.round(520 * s);

  // Update VS display with fighter names
  const vsDisplay = scene.arenaElements.find(
    (el) => (el as Phaser.GameObjects.Text).name === "arenaVsDisplay"
  ) as Phaser.GameObjects.Text;

  if (vsDisplay && state.status === "active") {
    const name1 = state.fighter1.username || `Fighter ${state.fighter1.id}`;
    const name2 = state.fighter2.username || `Fighter ${state.fighter2.id}`;
    vsDisplay.setText(`${name1}  VS  ${name2}`);
  } else if (vsDisplay && state.status === "completed") {
    vsDisplay.setText("");
  }

  // Update or create fighter 1 sprite
  updateFighterSprite(scene, state.fighter1, ringCenterX, ringY, 0);

  // Update or create fighter 2 sprite
  updateFighterSprite(scene, state.fighter2, ringCenterX, ringY, 1);

  // Update match status text
  const matchStatus = scene.arenaElements.find(
    (el) => (el as Phaser.GameObjects.Text).name === "arenaMatchStatus"
  ) as Phaser.GameObjects.Text;

  if (matchStatus) {
    if (state.status === "completed" && state.winner) {
      matchStatus.setText("KNOCKOUT!");
      matchStatus.setColor("#fbbf24");
      showWinnerAnnouncement(scene, state.winner);
      // Refresh leaderboard after match ends
      scene.time.delayedCall(1000, () => fetchArenaLeaderboard(scene));
    } else if (state.status === "active") {
      matchStatus.setText("FIGHTING");
      matchStatus.setColor("#22c55e");
    }
  }
}

/**
 * Update or create a fighter sprite
 */
function updateFighterSprite(
  scene: WorldScene,
  fighter: {
    id: number;
    hp: number;
    maxHp: number;
    x: number;
    y: number;
    state: string;
    direction: string;
  },
  ringCenterX: number,
  ringY: number,
  index: number
): void {
  const s = SCALE;
  let sprite = scene.arenaFighters.get(fighter.id);

  // Determine texture based on state
  // Only use creature variants (9-17): lobster, crab, octopus, shark, jellyfish, pufferfish, frog, slime, robot
  const variantIndex = 9 + (fighter.id % 9);
  let textureKey = `fighter_${variantIndex}_idle_fight`;
  if (fighter.state === "attacking") {
    textureKey = `fighter_${variantIndex}_attack`;
  } else if (fighter.state === "hurt") {
    textureKey = `fighter_${variantIndex}_hurt`;
  } else if (fighter.state === "knockout") {
    textureKey = `fighter_${variantIndex}_knockout`;
  }

  // Calculate position on ring (arena coords: 0-400, center at 200)
  const fighterX = ringCenterX + (fighter.x - 200) * s;
  const fighterY = ringY;

  // Sprite height offset (48px base sprite at SCALE)
  const spriteHeight = Math.round(48 * s);
  const healthBarOffset = spriteHeight + Math.round(12 * s);

  if (!sprite) {
    // Create new sprite
    sprite = scene.add.sprite(fighterX, fighterY, textureKey);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(10);
    scene.arenaFighters.set(fighter.id, sprite);

    // Create health bar above sprite
    createFighterHealthBar(scene, fighter.id, fighterX, fighterY - healthBarOffset);
  } else {
    // Update existing sprite
    sprite.setTexture(textureKey);
    sprite.setPosition(fighterX, fighterY);
  }

  // Flip sprite based on direction
  sprite.setFlipX(fighter.direction === "left");

  // Update health bar
  updateFighterHealthBar(
    scene,
    fighter.id,
    fighter.hp,
    fighter.maxHp,
    fighterX,
    fighterY - healthBarOffset
  );

  // Show dramatic animations on state TRANSITIONS
  const prevState = scene.arenaLastFighterState.get(fighter.id);

  // === ATTACK ANIMATION - Jump/Lunge forward ===
  if (fighter.state === "attacking" && prevState !== "attacking") {
    const attackDir = fighter.direction === "right" ? 1 : -1;

    // 30% chance to play charge sound for variety
    if (Math.random() < 0.3) {
      playFightSound(scene, "charge");
    }

    // Dust cloud at feet when launching attack
    showDustCloud(scene, fighterX, fighterY);

    // Jump and lunge forward
    scene.tweens.add({
      targets: sprite,
      y: fighterY - 30 * s, // Jump up
      x: fighterX + attackDir * 25 * s, // Lunge forward
      scaleX: 1.2,
      scaleY: 0.9,
      duration: 120,
      ease: "Power2.easeOut",
      yoyo: true,
      onUpdate: () => {
        // Add motion blur effect
        if (Math.random() > 0.6) {
          const blur = scene.add.sprite(sprite!.x, sprite!.y, sprite!.texture.key);
          blur.setOrigin(0.5, 1);
          blur.setAlpha(0.4);
          blur.setTint(0xffffff);
          blur.setDepth(9);
          blur.setFlipX(sprite!.flipX);
          scene.tweens.add({
            targets: blur,
            alpha: 0,
            duration: 150,
            onComplete: () => blur.destroy(),
          });
        }
      },
    });

    // Add attack slash effect
    showAttackSlash(scene, fighterX + attackDir * 40 * s, fighterY - 30 * s, attackDir);
  }

  // === HURT ANIMATION - Dramatic knockback with spin ===
  if (fighter.state === "hurt" && prevState !== "hurt") {
    const damage =
      Math.round((fighter.maxHp - fighter.hp) * 0.1) || Math.floor(Math.random() * 8) + 4;
    // The attacker is the OTHER fighter (not the one getting hurt)
    const attackerId = scene.arenaMatchState
      ? scene.arenaMatchState.fighter1.id === fighter.id
        ? scene.arenaMatchState.fighter2.id
        : scene.arenaMatchState.fighter1.id
      : 0;
    showHitEffect(scene, fighterX, fighterY - Math.round(40 * s), damage, attackerId);

    const knockDir = fighter.direction === "left" ? 1 : -1;

    // Dramatic knockback with spin and squash
    scene.tweens.add({
      targets: sprite,
      x: fighterX + knockDir * 35 * s,
      y: fighterY - 20 * s,
      angle: knockDir * 25,
      scaleX: 0.8,
      scaleY: 1.3,
      duration: 150,
      ease: "Power2.easeOut",
      onComplete: () => {
        // Bounce back
        scene.tweens.add({
          targets: sprite,
          x: fighterX,
          y: fighterY,
          angle: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          ease: "Bounce.easeOut",
        });
      },
    });
  }

  // === KNOCKOUT ANIMATION - Spin and fall ===
  if (fighter.state === "knockout" && prevState !== "knockout") {
    const fallDir = fighter.direction === "left" ? 1 : -1;

    // === PLAY KO SOUND ===
    playFightSound(scene, "ko");

    // Reset combo counters on KO
    scene.arenaComboCount.clear();
    scene.arenaLastAttacker = 0;

    // Epic knockout spin and fall
    scene.tweens.add({
      targets: sprite,
      x: fighterX + fallDir * 60 * s,
      y: fighterY + 10 * s,
      angle: fallDir * 720, // Multiple spins!
      scaleX: 0.5,
      scaleY: 0.5,
      alpha: 0.7,
      duration: 800,
      ease: "Power2.easeIn",
      onComplete: () => {
        // Show KO stars
        showKOStars(scene, sprite!.x, sprite!.y - 30 * s);
        // Show ground crack where they fell
        showGroundCrack(scene, sprite!.x, sprite!.y);
      },
    });

    // Big shockwave for knockout
    showShockwave(scene, fighterX, fighterY, 0xef4444);

    // Big screen shake for knockout
    scene.cameras.main.shake(400, 0.02);
  }

  // Track current state for next frame
  scene.arenaLastFighterState.set(fighter.id, fighter.state);
}

// ============================================================================
// FIGHT SOUND EFFECTS
// ============================================================================

/**
 * Play randomized fight sound effect
 */
function playFightSound(
  scene: WorldScene,
  type: "whoosh" | "hit" | "critical" | "ko" | "block" | "charge"
): void {
  if (!scene.audioContext) {
    // Create audio context if needed
    try {
      scene.audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      scene.gainNode = scene.audioContext.createGain();
      scene.gainNode.connect(scene.audioContext.destination);
      scene.gainNode.gain.value = 0.3;
    } catch {
      return;
    }
  }

  const ctx = scene.audioContext;
  const now = ctx.currentTime;

  // Randomize pitch slightly for variety
  const pitchVariation = 0.9 + Math.random() * 0.2;

  switch (type) {
    case "whoosh": {
      // Swoosh sound - noise burst with filter sweep
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const noise = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) {
        noise[i] = (Math.random() * 2 - 1) * (1 - i / noise.length);
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2000 * pitchVariation, now);
      filter.frequency.exponentialRampToValueAtTime(500, now + 0.15);
      filter.Q.value = 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(scene.gainNode!);
      noiseSource.start(now);
      break;
    }

    case "hit": {
      // Punch sound - low thump + mid crack
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();

      // Low thump
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(150 * pitchVariation, now);
      osc1.frequency.exponentialRampToValueAtTime(50, now + 0.1);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      // Mid crack - random between punch types
      const crackFreq = [400, 500, 600, 350][Math.floor(Math.random() * 4)];
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(crackFreq * pitchVariation, now);
      osc2.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      gain2.gain.setValueAtTime(0.25, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(scene.gainNode!);
      gain2.connect(scene.gainNode!);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.1);
      break;
    }

    case "critical": {
      // Big impact - layered hits + reverb-like decay
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = i === 0 ? "sine" : "triangle";
        const baseFreq = [100, 200, 400][i] * pitchVariation;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, now + 0.2);

        filter.type = "lowpass";
        filter.frequency.value = 1500;

        gain.gain.setValueAtTime([0.5, 0.3, 0.2][i], now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 - i * 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(scene.gainNode!);
        osc.start(now);
        osc.stop(now + 0.3);
      }

      // Add noise burst
      const noiseLen = 0.08;
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
      const noise = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) {
        noise[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noise.length, 2);
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.2;
      noiseSource.connect(noiseGain);
      noiseGain.connect(scene.gainNode!);
      noiseSource.start(now);
      break;
    }

    case "ko": {
      // Dramatic KO sound - descending tone + impact
      const notes = [600, 500, 400, 200, 100];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq * pitchVariation;
        gain.gain.setValueAtTime(0.15, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.1);
        osc.connect(gain);
        gain.connect(scene.gainNode!);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.15);
      });

      // Final thud
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = "sine";
      thud.frequency.setValueAtTime(80, now + 0.4);
      thud.frequency.exponentialRampToValueAtTime(30, now + 0.6);
      thudGain.gain.setValueAtTime(0.5, now + 0.4);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      thud.connect(thudGain);
      thudGain.connect(scene.gainNode!);
      thud.start(now + 0.4);
      thud.stop(now + 0.7);
      break;
    }

    case "block": {
      // Metallic clang
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(800 * pitchVariation, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(scene.gainNode!);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }

    case "charge": {
      // Power-up sound - rising tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(800 * pitchVariation, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(scene.gainNode!);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    }
  }
}

// ============================================================================
// ADDITIONAL VISUAL EFFECTS
// ============================================================================

/**
 * Show dust cloud effect (random chance on movement/attacks)
 */
function showDustCloud(scene: WorldScene, x: number, y: number): void {
  const s = SCALE;
  const dustCount = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < dustCount; i++) {
    const dust = scene.add.circle(
      x + (Math.random() - 0.5) * 30 * s,
      y + Math.random() * 10 * s,
      (4 + Math.random() * 6) * s,
      0xd4a574,
      0.4 + Math.random() * 0.3
    );
    dust.setDepth(9);

    const driftX = (Math.random() - 0.5) * 40 * s;
    const driftY = -20 - Math.random() * 30;

    scene.tweens.add({
      targets: dust,
      x: dust.x + driftX,
      y: dust.y + driftY * s,
      alpha: 0,
      scale: 2 + Math.random(),
      duration: 400 + Math.random() * 200,
      ease: "Power1.easeOut",
      onComplete: () => dust.destroy(),
    });
  }
}

/**
 * Show energy burst effect (for attacks)
 */
function showEnergyBurst(scene: WorldScene, x: number, y: number, color: number = 0xfbbf24): void {
  const s = SCALE;

  // Central glow
  const glow = scene.add.circle(x, y, 15 * s, color, 0.6);
  glow.setDepth(12);

  scene.tweens.add({
    targets: glow,
    radius: 40 * s,
    alpha: 0,
    duration: 200,
    ease: "Power2.easeOut",
    onComplete: () => glow.destroy(),
  });

  // Energy rays
  const rayCount = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 + Math.random() * 0.3;
    const length = (30 + Math.random() * 20) * s;

    const ray = scene.add.graphics();
    ray.setDepth(11);
    ray.lineStyle(2 * s, color, 0.8);
    ray.beginPath();
    ray.moveTo(x, y);
    ray.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ray.strokePath();

    scene.tweens.add({
      targets: ray,
      alpha: 0,
      duration: 150 + Math.random() * 100,
      delay: i * 20,
      onComplete: () => ray.destroy(),
    });
  }
}

/**
 * Show shockwave ring effect
 */
function showShockwave(scene: WorldScene, x: number, y: number, color: number = 0xffffff): void {
  const s = SCALE;

  for (let i = 0; i < 2; i++) {
    const ring = scene.add.circle(x, y, 5 * s, 0x000000, 0);
    ring.setStrokeStyle((3 - i) * s, color, 0.8 - i * 0.3);
    ring.setDepth(10);

    scene.tweens.add({
      targets: ring,
      radius: (60 + i * 20) * s,
      alpha: 0,
      duration: 300 + i * 100,
      delay: i * 50,
      ease: "Power2.easeOut",
      onComplete: () => ring.destroy(),
    });
  }
}

/**
 * Show speed lines effect
 */
function showSpeedLines(scene: WorldScene, x: number, y: number, direction: number): void {
  const s = SCALE;
  const lineCount = 5 + Math.floor(Math.random() * 4);

  for (let i = 0; i < lineCount; i++) {
    const startY = y + (Math.random() - 0.5) * 50 * s;
    const lineLength = (40 + Math.random() * 30) * s;
    const startX = x - direction * 20 * s;

    const line = scene.add.graphics();
    line.setDepth(8);
    line.lineStyle(2 * s, 0xffffff, 0.6 + Math.random() * 0.3);
    line.beginPath();
    line.moveTo(startX, startY);
    line.lineTo(startX - direction * lineLength, startY);
    line.strokePath();

    scene.tweens.add({
      targets: line,
      alpha: 0,
      x: -direction * 30 * s,
      duration: 150 + Math.random() * 100,
      delay: i * 15,
      onComplete: () => line.destroy(),
    });
  }
}

/**
 * Show ground crack effect (for heavy hits)
 */
function showGroundCrack(scene: WorldScene, x: number, y: number): void {
  const s = SCALE;
  const crackCount = 4 + Math.floor(Math.random() * 3);

  for (let i = 0; i < crackCount; i++) {
    const angle = (i / crackCount) * Math.PI + Math.random() * 0.5;
    const length = (20 + Math.random() * 25) * s;

    const crack = scene.add.graphics();
    crack.setDepth(1);

    // Draw jagged crack line
    crack.lineStyle(2 * s, 0x1a1a1a, 0.8);
    crack.beginPath();
    crack.moveTo(x, y);

    let curX = x;
    let curY = y;
    const segments = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < segments; j++) {
      const segLen = length / segments;
      curX += Math.cos(angle + (Math.random() - 0.5) * 0.5) * segLen;
      curY += Math.sin(angle + (Math.random() - 0.5) * 0.5) * segLen;
      crack.lineTo(curX, curY);
    }
    crack.strokePath();

    // Fade out slowly
    scene.tweens.add({
      targets: crack,
      alpha: 0,
      duration: 2000,
      delay: 500,
      onComplete: () => crack.destroy(),
    });
  }
}

/**
 * Show combo counter
 */
function showComboCounter(scene: WorldScene, x: number, y: number, comboCount: number): void {
  if (comboCount < 2) return;

  const s = SCALE;

  const comboText = scene.add.text(x, y - 60 * s, `${comboCount} HIT COMBO!`, {
    fontFamily: "monospace",
    fontSize: `${Math.round(14 * s)}px`,
    color: comboCount >= 5 ? "#ff6b6b" : comboCount >= 3 ? "#fbbf24" : "#ffffff",
    fontStyle: "bold",
    stroke: "#000000",
    strokeThickness: 4,
  });
  comboText.setOrigin(0.5, 0.5);
  comboText.setDepth(DEPTH.UI_HIGH);

  // Pulse and fade
  scene.tweens.add({
    targets: comboText,
    scale: { from: 0.5, to: 1.2 },
    y: y - 90 * s,
    duration: 200,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: comboText,
        alpha: 0,
        y: comboText.y - 20 * s,
        duration: 800,
        delay: 300,
        onComplete: () => comboText.destroy(),
      });
    },
  });
}

/**
 * Show attack slash effect
 */
function showAttackSlash(scene: WorldScene, x: number, y: number, direction: number): void {
  const s = SCALE;

  // === PLAY WHOOSH SOUND ===
  playFightSound(scene, "whoosh");

  // Randomize slash color
  const slashColors = [0xffffff, 0xfbbf24, 0xff6b6b, 0x60a5fa, 0xa78bfa];
  const slashColor = slashColors[Math.floor(Math.random() * slashColors.length)];

  // Create slash lines
  for (let i = 0; i < 5; i++) {
    const angle = -30 + i * 15 + (direction > 0 ? 0 : 180);
    const length = 40 + Math.random() * 30;

    const slash = scene.add.graphics();
    slash.setDepth(15);
    slash.lineStyle(3 * s, slashColor, 0.9);
    slash.beginPath();
    slash.moveTo(x, y);
    const endX = x + Math.cos((angle * Math.PI) / 180) * length * s;
    const endY = y + Math.sin((angle * Math.PI) / 180) * length * s;
    slash.lineTo(endX, endY);
    slash.strokePath();

    scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      delay: i * 30,
      onComplete: () => slash.destroy(),
    });
  }

  // Add impact ring
  const ring = scene.add.circle(x, y, 10 * s, 0xffffff, 0);
  ring.setStrokeStyle(3 * s, slashColor);
  ring.setDepth(14);

  scene.tweens.add({
    targets: ring,
    radius: 50 * s,
    alpha: 0,
    duration: 250,
    ease: "Power2.easeOut",
    onComplete: () => ring.destroy(),
  });

  // === RANDOM EXTRA EFFECTS ===
  // 40% chance for speed lines
  if (Math.random() < 0.4) {
    showSpeedLines(scene, x, y, direction);
  }

  // 30% chance for energy burst
  if (Math.random() < 0.3) {
    showEnergyBurst(scene, x, y, slashColor);
  }

  // 25% chance for dust cloud at feet
  if (Math.random() < 0.25) {
    showDustCloud(scene, x, y + 40 * s);
  }
}

/**
 * Show KO stars above defeated fighter
 */
function showKOStars(scene: WorldScene, x: number, y: number): void {
  const s = SCALE;
  const starCount = 5;

  for (let i = 0; i < starCount; i++) {
    const star = scene.add.text(x, y, "\u2605", {
      fontSize: `${Math.round(12 * s)}px`,
      color: "#fbbf24",
    });
    star.setOrigin(0.5, 0.5);
    star.setDepth(20);

    const angle = (i / starCount) * Math.PI * 2;
    const radius = 25 * s;

    // Orbit animation
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius * 0.5,
      duration: 300,
      ease: "Power2.easeOut",
      onComplete: () => {
        // Continue orbiting
        scene.tweens.add({
          targets: star,
          angle: 360,
          duration: 1500,
          repeat: 2,
          onUpdate: () => {
            const t = (Date.now() / 500 + i) % (Math.PI * 2);
            star.x = x + Math.cos(t) * radius;
            star.y = y + Math.sin(t) * radius * 0.5 - 10 * s;
          },
          onComplete: () => {
            scene.tweens.add({
              targets: star,
              alpha: 0,
              y: star.y - 20 * s,
              duration: 300,
              onComplete: () => star.destroy(),
            });
          },
        });
      },
    });
  }
}

/**
 * Create fighter health bar
 */
function createFighterHealthBar(scene: WorldScene, fighterId: number, x: number, y: number): void {
  const s = SCALE;
  const barWidth = Math.round(40 * s);
  const barHeight = Math.round(6 * s);

  const bg = scene.add.rectangle(x, y, barWidth, barHeight, 0x000000);
  bg.setDepth(DEPTH.UI_LOW);
  bg.setStrokeStyle(1, 0xffffff);

  const fill = scene.add.rectangle(x, y, barWidth - 2, barHeight - 2, 0x22c55e);
  fill.setDepth(DEPTH.UI_MID);

  scene.arenaHealthBars.set(fighterId, { bg, fill });
}

/**
 * Update fighter health bar
 */
function updateFighterHealthBar(
  scene: WorldScene,
  fighterId: number,
  hp: number,
  maxHp: number,
  x: number,
  y: number
): void {
  const bars = scene.arenaHealthBars.get(fighterId);
  if (!bars) return;

  const s = SCALE;
  const barWidth = Math.round(40 * s);
  const hpPercent = hp / maxHp;
  const fillWidth = (barWidth - 2) * hpPercent;

  bars.bg.setPosition(x, y);
  bars.fill.setPosition(x - (barWidth - 2) / 2 + fillWidth / 2, y);
  bars.fill.setSize(fillWidth, bars.fill.height);

  // Change color based on HP
  if (hpPercent > 0.6) {
    bars.fill.setFillStyle(0x22c55e); // Green
  } else if (hpPercent > 0.3) {
    bars.fill.setFillStyle(0xfbbf24); // Yellow
  } else {
    bars.fill.setFillStyle(0xef4444); // Red
  }
}

/**
 * Show hit effect at position with damage number
 */
function showHitEffect(
  scene: WorldScene,
  x: number,
  y: number,
  damage: number = 0,
  attackerId: number = 0
): void {
  const s = SCALE;
  const isCrit = damage > 10;

  // === PLAY HIT SOUND (randomized) ===
  if (isCrit) {
    playFightSound(scene, "critical");
  } else {
    playFightSound(scene, "hit");
  }

  // === COMBO SYSTEM ===
  if (attackerId > 0) {
    if (scene.arenaLastAttacker === attackerId) {
      // Same attacker - increment combo
      const currentCombo = scene.arenaComboCount.get(attackerId) || 0;
      scene.arenaComboCount.set(attackerId, currentCombo + 1);
      showComboCounter(scene, x, y, currentCombo + 1);
    } else {
      // Different attacker - reset their combo, start new one
      scene.arenaComboCount.set(attackerId, 1);
    }
    scene.arenaLastAttacker = attackerId;
  }

  // === SCREEN SHAKE FOR IMPACT ===
  const shakeIntensity = Math.min(damage * 0.5, 8); // More damage = more shake
  scene.cameras.main.shake(150, shakeIntensity * 0.001);

  // === TRIGGER CROWD CHEER ===
  triggerCrowdCheer(scene);

  // === SHOW ACTION BUBBLE (randomized) ===
  const bubbleTypes = isCrit
    ? ["action_critical", "action_bam", "action_pow"]
    : ["action_pow", "action_bam", "action_pow"];
  const bubbleType = bubbleTypes[Math.floor(Math.random() * bubbleTypes.length)];
  showActionBubble(scene, x, y - Math.round(50 * s), bubbleType);

  // === MULTIPLE SPARK BURSTS ===
  const sparkCount = isCrit ? 5 : 3;
  for (let i = 0; i < sparkCount; i++) {
    const spark = scene.add.sprite(
      x + (Math.random() - 0.5) * 30 * s,
      y + (Math.random() - 0.5) * 20 * s,
      "hit_spark"
    );
    spark.setDepth(11);
    spark.setScale(0.2 + Math.random() * 0.3);
    spark.setAngle(Math.random() * 360);

    scene.tweens.add({
      targets: spark,
      scale: { from: spark.scale, to: spark.scale * 2.5 },
      alpha: { from: 1, to: 0 },
      angle: spark.angle + (Math.random() - 0.5) * 60,
      duration: 250 + Math.random() * 150,
      ease: "Power2",
      delay: i * 50,
      onComplete: () => spark.destroy(),
    });
  }

  // === FLOATING DAMAGE NUMBER - BIGGER ===
  if (damage > 0) {
    const dmgText = scene.add.text(x, y - Math.round(20 * s), `-${damage}`, {
      fontFamily: "monospace",
      fontSize: `${Math.round(isCrit ? 24 : 16) * s}px`,
      color: isCrit ? "#fbbf24" : "#ef4444",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4,
    });
    dmgText.setOrigin(0.5, 0.5);
    dmgText.setDepth(DEPTH.UI_MID);

    // Bounce up then fade
    scene.tweens.add({
      targets: dmgText,
      y: y - Math.round(80 * s),
      alpha: { from: 1, to: 0 },
      scale: { from: 1.2, to: 1.5 },
      duration: 1000,
      ease: "Bounce.easeOut",
      onComplete: () => dmgText.destroy(),
    });
  }

  // === IMPACT PARTICLES - MORE DRAMATIC ===
  const particleColors = [0xfde047, 0xffffff, 0xef4444, 0xfbbf24, 0xff6b6b];
  const particleCount = isCrit ? 12 : 8;
  for (let i = 0; i < particleCount; i++) {
    const particle = scene.add.rectangle(
      x + (Math.random() - 0.5) * 30 * s,
      y + (Math.random() - 0.5) * 30 * s,
      Math.round((3 + Math.random() * 4) * s),
      Math.round((3 + Math.random() * 4) * s),
      particleColors[i % particleColors.length]
    );
    particle.setDepth(11);
    particle.setAngle(Math.random() * 360);

    // Explode outward
    const angle = (Math.PI * 2 * i) / particleCount;
    const distance = 60 + Math.random() * 40;
    scene.tweens.add({
      targets: particle,
      x: particle.x + Math.cos(angle) * distance * s,
      y: particle.y + Math.sin(angle) * distance * s - 20 * s, // Arc upward
      alpha: 0,
      scale: 0,
      angle: particle.angle + (Math.random() - 0.5) * 180,
      duration: 400 + Math.random() * 200,
      ease: "Power2",
      onComplete: () => particle.destroy(),
    });
  }

  // === FLASH EFFECT ===
  const flashColor = isCrit ? 0xfbbf24 : 0xffffff;
  const flash = scene.add.rectangle(x, y, 100 * s, 100 * s, flashColor, isCrit ? 0.8 : 0.6);
  flash.setDepth(10);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    scale: 2,
    duration: 150,
    ease: "Power2",
    onComplete: () => flash.destroy(),
  });

  // === RANDOM EXTRA EFFECTS ===
  // 50% chance for shockwave on big hits
  if (isCrit || Math.random() < 0.3) {
    showShockwave(scene, x, y, isCrit ? 0xfbbf24 : 0xffffff);
  }

  // 20% chance for ground crack on critical hits
  if (isCrit && Math.random() < 0.4) {
    showGroundCrack(scene, x, y + 50 * s);
  }

  // 35% chance for energy burst
  if (Math.random() < 0.35) {
    const burstColors = [0xef4444, 0xfbbf24, 0x60a5fa, 0xa78bfa, 0x22c55e];
    showEnergyBurst(scene, x, y, burstColors[Math.floor(Math.random() * burstColors.length)]);
  }

  // 25% chance for dust cloud
  if (Math.random() < 0.25) {
    showDustCloud(scene, x, y + 30 * s);
  }
}

/**
 * Show winner announcement
 */
function showWinnerAnnouncement(scene: WorldScene, winner: string): void {
  const s = SCALE;
  const centerX = GAME_WIDTH / 2;
  const centerY = GAME_HEIGHT / 2;

  // Trigger victory confetti
  playArenaConfetti(scene);

  // Background
  const announceBg = scene.add.rectangle(
    centerX,
    centerY,
    Math.round(300 * s),
    Math.round(80 * s),
    0x0a0a0f,
    0.95
  );
  announceBg.setDepth(DEPTH.PANEL);
  announceBg.setStrokeStyle(3, 0xfbbf24);

  // Winner text
  const winnerText = scene.add.text(centerX, centerY - Math.round(10 * s), "WINNER!", {
    fontFamily: "monospace",
    fontSize: `${Math.round(16 * s)}px`,
    color: "#fbbf24",
    fontStyle: "bold",
  });
  winnerText.setOrigin(0.5, 0.5);
  winnerText.setDepth(DEPTH.PANEL_TEXT);

  const nameText = scene.add.text(centerX, centerY + Math.round(15 * s), winner, {
    fontFamily: "monospace",
    fontSize: `${Math.round(12 * s)}px`,
    color: "#ffffff",
  });
  nameText.setOrigin(0.5, 0.5);
  nameText.setDepth(DEPTH.PANEL_TEXT);

  // Animate in
  scene.tweens.add({
    targets: [announceBg, winnerText, nameText],
    scale: { from: 0, to: 1 },
    duration: 300,
    ease: "Back.easeOut",
  });

  // Remove after delay
  scene.time.delayedCall(3000, () => {
    scene.tweens.add({
      targets: [announceBg, winnerText, nameText],
      alpha: 0,
      duration: 500,
      onComplete: () => {
        announceBg.destroy();
        winnerText.destroy();
        nameText.destroy();

        // Clean up fighter sprites and health bars
        scene.arenaFighters.forEach((sprite) => sprite.destroy());
        scene.arenaFighters.clear();
        scene.arenaHealthBars.forEach((bars) => {
          bars.bg.destroy();
          bars.fill.destroy();
        });
        scene.arenaHealthBars.clear();
        scene.arenaLastHitEffect.clear();
        scene.arenaLastFighterState.clear();
      },
    });
  });
}

/**
 * Trigger crowd cheer animation - switches crowd to cheer poses temporarily
 */
function triggerCrowdCheer(scene: WorldScene): void {
  // Don't trigger if already cheering or no crowd sprites
  if (scene.arenaCrowdCheering || scene.arenaCrowdSprites.length === 0) return;

  scene.arenaCrowdCheering = true;

  // Switch random crowd members to cheer pose
  scene.arenaCrowdSprites.forEach((crowd) => {
    if (Math.random() > 0.4) {
      // 60% chance to cheer
      const variant = crowd.getData("variant") as number;
      const cheerPose = Math.random() > 0.5 ? "cheer1" : "cheer2";
      crowd.setTexture(`arena_crowd_${cheerPose}_${variant}`);
    }
  });

  // Reset to idle after delay
  scene.time.delayedCall(600, () => {
    scene.arenaCrowdSprites.forEach((crowd) => {
      const variant = crowd.getData("variant") as number;
      crowd.setTexture(`arena_crowd_idle_${variant}`);
    });
    scene.arenaCrowdCheering = false;
  });
}

/**
 * Show comic-style action bubble (POW!, BAM!, CRIT!, MISS)
 */
function showActionBubble(scene: WorldScene, x: number, y: number, type: string): void {
  const s = SCALE;

  // Create action bubble sprite
  const bubble = scene.add.sprite(x, y, type);
  bubble.setDepth(DEPTH.UI_HIGH);
  bubble.setScale(0);
  bubble.setAlpha(1);

  // Pop-in animation
  scene.tweens.add({
    targets: bubble,
    scale: { from: 0, to: 1.2 },
    duration: 150,
    ease: "Back.easeOut",
    onComplete: () => {
      // Hold then fade out
      scene.tweens.add({
        targets: bubble,
        scale: { from: 1.2, to: 1.5 },
        alpha: { from: 1, to: 0 },
        y: y - Math.round(30 * s),
        duration: 400,
        delay: 200,
        ease: "Power2",
        onComplete: () => bubble.destroy(),
      });
    },
  });
}

/**
 * Show center screen announcement text
 */
function showArenaAnnouncement(scene: WorldScene, text: string, color: string = "#fbbf24"): void {
  const s = SCALE;
  const centerX = GAME_WIDTH / 2;
  const centerY = GAME_HEIGHT / 2 - Math.round(50 * s);

  const announcement = scene.add.text(centerX, centerY, text, {
    fontFamily: "monospace",
    fontSize: `${Math.round(20 * s)}px`,
    color: color,
    fontStyle: "bold",
    stroke: "#000000",
    strokeThickness: 4,
  });
  announcement.setOrigin(0.5, 0.5);
  announcement.setDepth(DEPTH.PANEL);
  announcement.setScale(0);

  // Animate in
  scene.tweens.add({
    targets: announcement,
    scale: { from: 0, to: 1.2 },
    duration: 200,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: announcement,
        scale: 1,
        duration: 100,
        onComplete: () => {
          // Fade out after delay
          scene.tweens.add({
            targets: announcement,
            alpha: 0,
            y: centerY - Math.round(30 * s),
            duration: 500,
            delay: 1500,
            onComplete: () => announcement.destroy(),
          });
        },
      });
    },
  });
}

/**
 * Play victory confetti effect - red, blue, and gold particles
 */
function playArenaConfetti(scene: WorldScene): void {
  const s = SCALE;
  const confettiColors = [0xef4444, 0x3b82f6, 0xfbbf24, 0x22c55e, 0xa855f7]; // Red, blue, gold, green, purple
  const centerX = GAME_WIDTH / 2;

  // Create confetti burst from multiple spawn points
  for (let wave = 0; wave < 3; wave++) {
    scene.time.delayedCall(wave * 150, () => {
      for (let i = 0; i < 20; i++) {
        const spawnX = centerX + (Math.random() - 0.5) * Math.round(200 * s);
        const spawnY = Math.round(100 * s);
        const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];

        // Create confetti particle (small rectangle)
        const confetti = scene.add.rectangle(
          spawnX,
          spawnY,
          Math.round((3 + Math.random() * 3) * s),
          Math.round((6 + Math.random() * 4) * s),
          color
        );
        confetti.setDepth(150);
        confetti.setAngle(Math.random() * 360);

        // Falling animation with flutter
        const targetX = spawnX + (Math.random() - 0.5) * Math.round(300 * s);
        const targetY = GAME_HEIGHT + Math.round(50 * s);
        const duration = 2000 + Math.random() * 1500;

        scene.tweens.add({
          targets: confetti,
          x: targetX,
          y: targetY,
          angle: confetti.angle + (Math.random() > 0.5 ? 720 : -720),
          duration: duration,
          ease: "Sine.easeIn",
          onComplete: () => confetti.destroy(),
        });

        // Add flutter effect (oscillating x)
        scene.tweens.add({
          targets: confetti,
          x: {
            value: `+=${Math.round((Math.random() - 0.5) * 60 * s)}`,
            duration: 300,
            yoyo: true,
            repeat: Math.floor(duration / 600),
            ease: "Sine.easeInOut",
          },
        });
      }
    });
  }
}
