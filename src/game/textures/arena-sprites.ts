import * as Phaser from "phaser";
import {
  SCALE,
  PALETTE,
  SKIN_TONES,
  HAIR_COLORS,
  SHIRT_COLORS,
  darken,
  lighten,
} from "./constants";

export function generateArenaSprites(scene: Phaser.Scene): void {
  // Generate combat poses for all 9 human character variants
  for (let i = 0; i < 9; i++) {
    const skinTone = SKIN_TONES[i % SKIN_TONES.length];
    const hairColor = HAIR_COLORS[i % HAIR_COLORS.length];
    const shirtColor = SHIRT_COLORS[i % SHIRT_COLORS.length];

    createFighterSprite(
      scene,
      `fighter_${i}_idle_fight`,
      skinTone,
      hairColor,
      shirtColor,
      "idle_fight"
    );
    createFighterSprite(scene, `fighter_${i}_attack`, skinTone, hairColor, shirtColor, "attack");
    createFighterSprite(scene, `fighter_${i}_hurt`, skinTone, hairColor, shirtColor, "hurt");
    createFighterSprite(
      scene,
      `fighter_${i}_knockout`,
      skinTone,
      hairColor,
      shirtColor,
      "knockout"
    );
  }

  // Generate FUN CREATURE fighters (9-17)
  // These are the sea creatures and monsters inspired by OpenClaw lobster theme!
  generateCreatureFighters(scene);

  // Generate arena zone textures
  generateArenaFloor(scene);
  generateArenaRing(scene);
  generateArenaStands(scene);
  generateArenaLights(scene);

  // Generate combat effect textures
  generateHitSpark(scene);
  generateDamageParticle(scene);

  // Generate enhanced arena effects (crowd, spotlights, action bubbles)
  generateArenaCrowd(scene);
  generateSpotlightCone(scene);
  generateLogoMat(scene);
  generateCornerPosts(scene);
  generateActionBubbles(scene);
}

// ========================================
// FUN CREATURE FIGHTERS
// Lobsters, crabs, and friends!
// ========================================

function generateCreatureFighters(scene: Phaser.Scene): void {
  // Creature types with their colors
  const creatures = [
    { name: "lobster", primary: 0xdc2626, secondary: 0xfca5a5, accent: 0x991b1b }, // Red lobster
    { name: "crab", primary: 0xf97316, secondary: 0xfed7aa, accent: 0xc2410c }, // Orange crab
    { name: "octopus", primary: 0x8b5cf6, secondary: 0xddd6fe, accent: 0x6d28d9 }, // Purple octopus
    { name: "shark", primary: 0x64748b, secondary: 0xcbd5e1, accent: 0x334155 }, // Gray shark
    { name: "jellyfish", primary: 0xec4899, secondary: 0xfbcfe8, accent: 0xbe185d }, // Pink jellyfish
    { name: "pufferfish", primary: 0xfbbf24, secondary: 0xfef3c7, accent: 0xd97706 }, // Yellow pufferfish
    { name: "frog", primary: 0x22c55e, secondary: 0xbbf7d0, accent: 0x15803d }, // Green frog
    { name: "slime", primary: 0x06b6d4, secondary: 0xa5f3fc, accent: 0x0891b2 }, // Cyan slime
    { name: "robot", primary: 0x71717a, secondary: 0xe4e4e7, accent: 0x3f3f46 }, // Metal robot
  ];

  creatures.forEach((creature, index) => {
    const fighterId = 9 + index; // Creatures start at fighter_9
    createCreatureSprite(scene, `fighter_${fighterId}_idle_fight`, creature, "idle_fight");
    createCreatureSprite(scene, `fighter_${fighterId}_attack`, creature, "attack");
    createCreatureSprite(scene, `fighter_${fighterId}_hurt`, creature, "hurt");
    createCreatureSprite(scene, `fighter_${fighterId}_knockout`, creature, "knockout");
  });
}

function createCreatureSprite(
  scene: Phaser.Scene,
  key: string,
  creature: { name: string; primary: number; secondary: number; accent: number },
  pose: "idle_fight" | "attack" | "hurt" | "knockout"
): void {
  const s = SCALE;
  const size = Math.round(48 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Ground shadow
  g.fillStyle(PALETTE.void, 0.4);
  if (pose === "knockout") {
    g.fillEllipse(Math.round(24 * s), Math.round(44 * s), Math.round(20 * s), Math.round(4 * s));
  } else {
    g.fillEllipse(Math.round(24 * s), Math.round(46 * s), Math.round(14 * s), Math.round(5 * s));
  }

  // Draw based on creature type
  switch (creature.name) {
    case "lobster":
      drawLobsterFighter(g, s, creature, pose);
      break;
    case "crab":
      drawCrabFighter(g, s, creature, pose);
      break;
    case "octopus":
      drawOctopusFighter(g, s, creature, pose);
      break;
    case "shark":
      drawSharkFighter(g, s, creature, pose);
      break;
    case "jellyfish":
      drawJellyfishFighter(g, s, creature, pose);
      break;
    case "pufferfish":
      drawPufferfishFighter(g, s, creature, pose);
      break;
    case "frog":
      drawFrogFighter(g, s, creature, pose);
      break;
    case "slime":
      drawSlimeFighter(g, s, creature, pose);
      break;
    case "robot":
      drawRobotFighter(g, s, creature, pose);
      break;
  }

  g.generateTexture(key, size, size);
  g.destroy();
}

// === LOBSTER FIGHTER ===
function drawLobsterFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  if (pose === "knockout") {
    // Lying on back, claws spread
    g.fillStyle(c.primary);
    g.fillRect(Math.round(8 * s), Math.round(28 * s), Math.round(32 * s), Math.round(14 * s));
    g.fillStyle(c.secondary);
    g.fillRect(Math.round(8 * s), Math.round(28 * s), Math.round(32 * s), Math.round(5 * s));
    // Claws spread out
    g.fillStyle(c.primary);
    g.fillRect(Math.round(2 * s), Math.round(24 * s), Math.round(10 * s), Math.round(8 * s));
    g.fillRect(Math.round(36 * s), Math.round(24 * s), Math.round(10 * s), Math.round(8 * s));
    // X eyes
    g.fillStyle(PALETTE.void);
    g.fillRect(Math.round(18 * s), Math.round(32 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(27 * s), Math.round(32 * s), Math.round(3 * s), Math.round(3 * s));
    // Stars
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(14 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(30 * s), Math.round(18 * s), Math.round(3 * s), Math.round(3 * s));
    return;
  }

  // Body segments
  g.fillStyle(c.primary);
  g.fillRect(Math.round(16 * s), Math.round(18 * s), Math.round(16 * s), Math.round(24 * s));
  // Tail segments
  g.fillRect(Math.round(18 * s), Math.round(38 * s), Math.round(12 * s), Math.round(8 * s));
  g.fillStyle(c.accent);
  for (let i = 0; i < 4; i++) {
    g.fillRect(
      Math.round(18 * s),
      Math.round((40 + i * 2) * s),
      Math.round(12 * s),
      Math.round(1 * s)
    );
  }
  // Body highlight
  g.fillStyle(c.secondary);
  g.fillRect(Math.round(16 * s), Math.round(18 * s), Math.round(5 * s), Math.round(10 * s));

  // Head
  g.fillStyle(c.primary);
  g.fillRect(Math.round(14 * s), Math.round(6 * s), Math.round(20 * s), Math.round(14 * s));
  g.fillStyle(c.secondary);
  g.fillRect(Math.round(14 * s), Math.round(6 * s), Math.round(6 * s), Math.round(6 * s));

  // Antennae
  g.fillStyle(c.accent);
  g.fillRect(Math.round(16 * s), Math.round(0 * s), Math.round(2 * s), Math.round(8 * s));
  g.fillRect(Math.round(30 * s), Math.round(0 * s), Math.round(2 * s), Math.round(8 * s));
  g.fillRect(Math.round(14 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(31 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));

  // CLAWS - The signature feature!
  if (pose === "attack") {
    // One claw extended forward (PINCH!)
    g.fillStyle(c.primary);
    g.fillRect(Math.round(4 * s), Math.round(14 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillRect(Math.round(34 * s), Math.round(8 * s), Math.round(14 * s), Math.round(12 * s));
    // Claw tips (open for attack)
    g.fillStyle(c.accent);
    g.fillRect(Math.round(42 * s), Math.round(6 * s), Math.round(6 * s), Math.round(5 * s));
    g.fillRect(Math.round(42 * s), Math.round(16 * s), Math.round(6 * s), Math.round(5 * s));
    // Impact lines
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(44 * s), Math.round(12 * s), Math.round(4 * s), Math.round(2 * s));
  } else if (pose === "hurt") {
    // Claws up defensively
    g.fillStyle(c.primary);
    g.fillRect(Math.round(4 * s), Math.round(8 * s), Math.round(12 * s), Math.round(10 * s));
    g.fillRect(Math.round(32 * s), Math.round(8 * s), Math.round(12 * s), Math.round(10 * s));
    // Pain stars
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(10 * s), Math.round(2 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(34 * s), Math.round(0 * s), Math.round(3 * s), Math.round(3 * s));
  } else {
    // Idle - claws raised ready
    g.fillStyle(c.primary);
    g.fillRect(Math.round(2 * s), Math.round(12 * s), Math.round(14 * s), Math.round(12 * s));
    g.fillRect(Math.round(32 * s), Math.round(12 * s), Math.round(14 * s), Math.round(12 * s));
    // Claw details
    g.fillStyle(c.secondary);
    g.fillRect(Math.round(2 * s), Math.round(12 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(32 * s), Math.round(12 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillStyle(c.accent);
    g.fillRect(Math.round(2 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));
    g.fillRect(Math.round(43 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));
  }

  // Eyes (on stalks!)
  g.fillStyle(c.primary);
  g.fillRect(Math.round(17 * s), Math.round(4 * s), Math.round(4 * s), Math.round(6 * s));
  g.fillRect(Math.round(27 * s), Math.round(4 * s), Math.round(4 * s), Math.round(6 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(18 * s), Math.round(2 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(26 * s), Math.round(2 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(19 * s), Math.round(3 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(27 * s), Math.round(3 * s), Math.round(2 * s), Math.round(2 * s));

  // Legs
  g.fillStyle(c.accent);
  for (let i = 0; i < 3; i++) {
    g.fillRect(
      Math.round(12 * s),
      Math.round((28 + i * 5) * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      Math.round(32 * s),
      Math.round((28 + i * 5) * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
  }
}

// === CRAB FIGHTER ===
function drawCrabFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  if (pose === "knockout") {
    // Flipped on back
    g.fillStyle(c.secondary);
    g.fillRect(Math.round(10 * s), Math.round(28 * s), Math.round(28 * s), Math.round(16 * s));
    g.fillStyle(c.primary);
    g.fillRect(Math.round(6 * s), Math.round(22 * s), Math.round(8 * s), Math.round(8 * s));
    g.fillRect(Math.round(34 * s), Math.round(22 * s), Math.round(8 * s), Math.round(8 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(16 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(28 * s), Math.round(18 * s), Math.round(3 * s), Math.round(3 * s));
    return;
  }

  // Wide body (crabs are THICC)
  g.fillStyle(c.primary);
  g.fillRect(Math.round(8 * s), Math.round(20 * s), Math.round(32 * s), Math.round(18 * s));
  g.fillStyle(c.secondary);
  g.fillRect(Math.round(8 * s), Math.round(20 * s), Math.round(10 * s), Math.round(8 * s));
  g.fillStyle(c.accent);
  g.fillRect(Math.round(8 * s), Math.round(34 * s), Math.round(32 * s), Math.round(4 * s));

  // Shell pattern
  g.fillStyle(c.accent);
  g.fillRect(Math.round(20 * s), Math.round(24 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(28 * s), Math.round(12 * s), Math.round(2 * s));

  // BIG CLAWS
  if (pose === "attack") {
    // MEGA PINCH - one claw forward
    g.fillStyle(c.primary);
    g.fillRect(Math.round(0 * s), Math.round(16 * s), Math.round(12 * s), Math.round(14 * s));
    g.fillRect(Math.round(36 * s), Math.round(10 * s), Math.round(12 * s), Math.round(16 * s));
    // Open claw
    g.fillStyle(c.accent);
    g.fillRect(Math.round(40 * s), Math.round(6 * s), Math.round(8 * s), Math.round(6 * s));
    g.fillRect(Math.round(40 * s), Math.round(22 * s), Math.round(8 * s), Math.round(6 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(44 * s), Math.round(14 * s), Math.round(4 * s), Math.round(2 * s));
  } else if (pose === "hurt") {
    g.fillStyle(c.primary);
    g.fillRect(Math.round(0 * s), Math.round(10 * s), Math.round(10 * s), Math.round(12 * s));
    g.fillRect(Math.round(38 * s), Math.round(10 * s), Math.round(10 * s), Math.round(12 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(20 * s), Math.round(10 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(32 * s), Math.round(8 * s), Math.round(3 * s), Math.round(3 * s));
  } else {
    // Ready stance
    g.fillStyle(c.primary);
    g.fillRect(Math.round(0 * s), Math.round(14 * s), Math.round(12 * s), Math.round(14 * s));
    g.fillRect(Math.round(36 * s), Math.round(14 * s), Math.round(12 * s), Math.round(14 * s));
    g.fillStyle(c.secondary);
    g.fillRect(Math.round(0 * s), Math.round(14 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(44 * s), Math.round(14 * s), Math.round(4 * s), Math.round(4 * s));
  }

  // Eyes on top
  g.fillStyle(c.primary);
  g.fillRect(Math.round(16 * s), Math.round(14 * s), Math.round(4 * s), Math.round(8 * s));
  g.fillRect(Math.round(28 * s), Math.round(14 * s), Math.round(4 * s), Math.round(8 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(16 * s), Math.round(12 * s), Math.round(5 * s), Math.round(5 * s));
  g.fillRect(Math.round(27 * s), Math.round(12 * s), Math.round(5 * s), Math.round(5 * s));
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(18 * s), Math.round(13 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(29 * s), Math.round(13 * s), Math.round(2 * s), Math.round(2 * s));

  // Legs (6 total)
  g.fillStyle(c.accent);
  for (let i = 0; i < 3; i++) {
    g.fillRect(
      Math.round(6 * s),
      Math.round((36 + i * 3) * s),
      Math.round(6 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      Math.round(36 * s),
      Math.round((36 + i * 3) * s),
      Math.round(6 * s),
      Math.round(2 * s)
    );
  }
}

// === OCTOPUS FIGHTER ===
function drawOctopusFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  if (pose === "knockout") {
    // Deflated blob
    g.fillStyle(c.primary);
    g.fillEllipse(Math.round(24 * s), Math.round(34 * s), Math.round(18 * s), Math.round(10 * s));
    g.fillStyle(c.secondary);
    g.fillEllipse(Math.round(20 * s), Math.round(32 * s), Math.round(8 * s), Math.round(5 * s));
    // Tentacles limp
    g.fillStyle(c.accent);
    for (let i = 0; i < 4; i++) {
      g.fillRect(
        Math.round((8 + i * 10) * s),
        Math.round(38 * s),
        Math.round(4 * s),
        Math.round(8 * s)
      );
    }
    // X eyes
    g.fillStyle(PALETTE.void);
    g.fillRect(Math.round(18 * s), Math.round(32 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(27 * s), Math.round(32 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(12 * s), Math.round(24 * s), Math.round(4 * s), Math.round(4 * s));
    return;
  }

  // Round head/body
  g.fillStyle(c.primary);
  g.fillEllipse(Math.round(24 * s), Math.round(20 * s), Math.round(16 * s), Math.round(14 * s));
  g.fillStyle(c.secondary);
  g.fillEllipse(Math.round(20 * s), Math.round(16 * s), Math.round(8 * s), Math.round(8 * s));

  // 8 tentacles!
  const tentaclePositions = [
    { x: 8, y: 28 },
    { x: 14, y: 30 },
    { x: 20, y: 32 },
    { x: 26, y: 32 },
    { x: 32, y: 30 },
    { x: 38, y: 28 },
    { x: 12, y: 26 },
    { x: 34, y: 26 },
  ];

  if (pose === "attack") {
    // Tentacles reaching forward
    g.fillStyle(c.primary);
    tentaclePositions.forEach((pos, i) => {
      const wave = i % 2 === 0 ? 2 : -2;
      g.fillRect(
        Math.round(pos.x * s),
        Math.round(pos.y * s),
        Math.round(5 * s),
        Math.round(16 * s + wave * s)
      );
    });
    // Two attack tentacles
    g.fillStyle(c.accent);
    g.fillRect(Math.round(36 * s), Math.round(14 * s), Math.round(12 * s), Math.round(6 * s));
    g.fillRect(Math.round(38 * s), Math.round(8 * s), Math.round(10 * s), Math.round(6 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(44 * s), Math.round(10 * s), Math.round(4 * s), Math.round(2 * s));
  } else if (pose === "hurt") {
    // Tentacles curled in
    g.fillStyle(c.primary);
    tentaclePositions.forEach((pos) => {
      g.fillRect(
        Math.round(pos.x * s),
        Math.round((pos.y + 4) * s),
        Math.round(5 * s),
        Math.round(10 * s)
      );
    });
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(8 * s), Math.round(8 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(36 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
  } else {
    // Idle wavy tentacles
    g.fillStyle(c.primary);
    tentaclePositions.forEach((pos, i) => {
      const wave = i % 2 === 0 ? 14 : 16;
      g.fillRect(
        Math.round(pos.x * s),
        Math.round(pos.y * s),
        Math.round(5 * s),
        Math.round(wave * s)
      );
    });
    g.fillStyle(c.accent);
    tentaclePositions.forEach((pos, i) => {
      const wave = i % 2 === 0 ? 12 : 14;
      g.fillRect(
        Math.round((pos.x + 1) * s),
        Math.round((pos.y + wave) * s),
        Math.round(3 * s),
        Math.round(4 * s)
      );
    });
  }

  // Big cute eyes
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(16 * s), Math.round(14 * s), Math.round(7 * s), Math.round(8 * s));
  g.fillRect(Math.round(26 * s), Math.round(14 * s), Math.round(7 * s), Math.round(8 * s));
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(19 * s), Math.round(16 * s), Math.round(4 * s), Math.round(5 * s));
  g.fillRect(Math.round(29 * s), Math.round(16 * s), Math.round(4 * s), Math.round(5 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(19 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(29 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));
}

// === SHARK FIGHTER ===
function drawSharkFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  if (pose === "knockout") {
    // Belly up (classic shark defeat)
    g.fillStyle(c.secondary);
    g.fillRect(Math.round(6 * s), Math.round(28 * s), Math.round(36 * s), Math.round(14 * s));
    g.fillStyle(c.primary);
    g.fillRect(Math.round(20 * s), Math.round(24 * s), Math.round(8 * s), Math.round(8 * s)); // Fin
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(14 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(30 * s), Math.round(18 * s), Math.round(3 * s), Math.round(3 * s));
    return;
  }

  // Streamlined body
  g.fillStyle(c.primary);
  g.fillRect(Math.round(8 * s), Math.round(18 * s), Math.round(32 * s), Math.round(20 * s));
  // Snout
  g.fillRect(Math.round(4 * s), Math.round(22 * s), Math.round(8 * s), Math.round(12 * s));
  // Tail
  g.fillRect(Math.round(38 * s), Math.round(20 * s), Math.round(8 * s), Math.round(16 * s));
  g.fillRect(Math.round(42 * s), Math.round(16 * s), Math.round(6 * s), Math.round(8 * s));
  g.fillRect(Math.round(42 * s), Math.round(32 * s), Math.round(6 * s), Math.round(8 * s));

  // White belly
  g.fillStyle(c.secondary);
  g.fillRect(Math.round(8 * s), Math.round(30 * s), Math.round(30 * s), Math.round(8 * s));
  g.fillRect(Math.round(4 * s), Math.round(28 * s), Math.round(8 * s), Math.round(6 * s));

  // DORSAL FIN (iconic!)
  g.fillStyle(c.primary);
  if (pose === "attack") {
    g.fillRect(Math.round(20 * s), Math.round(6 * s), Math.round(10 * s), Math.round(14 * s));
    g.fillStyle(c.accent);
    g.fillRect(Math.round(22 * s), Math.round(8 * s), Math.round(6 * s), Math.round(4 * s));
  } else {
    g.fillRect(Math.round(20 * s), Math.round(8 * s), Math.round(10 * s), Math.round(12 * s));
  }

  // Side fins
  g.fillStyle(c.primary);
  g.fillRect(Math.round(14 * s), Math.round(36 * s), Math.round(10 * s), Math.round(8 * s));
  g.fillRect(Math.round(28 * s), Math.round(36 * s), Math.round(10 * s), Math.round(8 * s));

  // TEETH (scary!)
  if (pose === "attack") {
    g.fillStyle(PALETTE.white);
    for (let i = 0; i < 5; i++) {
      g.fillRect(
        Math.round((2 + i * 2) * s),
        Math.round(26 * s),
        Math.round(2 * s),
        Math.round(4 * s)
      );
    }
    // Bite effect
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(0 * s), Math.round(28 * s), Math.round(3 * s), Math.round(2 * s));
  }

  // Eyes (small, beady, MENACING)
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(2 * s), Math.round(2 * s));

  if (pose === "hurt") {
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(6 * s), Math.round(12 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(16 * s), Math.round(8 * s), Math.round(3 * s), Math.round(3 * s));
  }
}

// === JELLYFISH FIGHTER ===
function drawJellyfishFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  // Translucent dome body
  g.fillStyle(c.primary, 0.8);
  g.fillEllipse(Math.round(24 * s), Math.round(18 * s), Math.round(16 * s), Math.round(12 * s));
  g.fillStyle(c.secondary, 0.6);
  g.fillEllipse(Math.round(22 * s), Math.round(16 * s), Math.round(10 * s), Math.round(8 * s));

  if (pose === "knockout") {
    // Deflated
    g.fillStyle(c.primary, 0.5);
    g.fillEllipse(Math.round(24 * s), Math.round(32 * s), Math.round(14 * s), Math.round(6 * s));
    // Limp tentacles
    g.fillStyle(c.accent, 0.6);
    for (let i = 0; i < 6; i++) {
      g.fillRect(
        Math.round((12 + i * 5) * s),
        Math.round(36 * s),
        Math.round(2 * s),
        Math.round(8 * s)
      );
    }
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(18 * s), Math.round(26 * s), Math.round(4 * s), Math.round(4 * s));
    return;
  }

  // Flowing tentacles
  g.fillStyle(c.primary, 0.7);
  const numTentacles = 8;
  for (let i = 0; i < numTentacles; i++) {
    const x = 10 + i * 4;
    let length = pose === "attack" ? 22 : pose === "hurt" ? 14 : 18;
    if (i % 2 === 0) length += 4;
    g.fillRect(Math.round(x * s), Math.round(26 * s), Math.round(3 * s), Math.round(length * s));
  }

  // Stinging tentacles (thinner)
  g.fillStyle(c.accent, 0.8);
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 6;
    const length = pose === "attack" ? 26 : 20;
    g.fillRect(Math.round(x * s), Math.round(28 * s), Math.round(1 * s), Math.round(length * s));
  }

  if (pose === "attack") {
    // Electric zap effect
    g.fillStyle(PALETTE.yellow, 0.9);
    g.fillRect(Math.round(22 * s), Math.round(42 * s), Math.round(4 * s), Math.round(6 * s));
    g.fillRect(Math.round(20 * s), Math.round(44 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(26 * s), Math.round(44 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillStyle(PALETTE.white);
    g.fillRect(Math.round(23 * s), Math.round(43 * s), Math.round(2 * s), Math.round(4 * s));
  }

  if (pose === "hurt") {
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(10 * s), Math.round(8 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(34 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
  }

  // Simple dot eyes
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(20 * s), Math.round(16 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(27 * s), Math.round(16 * s), Math.round(3 * s), Math.round(3 * s));
}

// === PUFFERFISH FIGHTER ===
function drawPufferfishFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  // Size changes based on state!
  const puffed = pose === "attack" || pose === "hurt";
  const radius = puffed ? 18 : 14;

  if (pose === "knockout") {
    // Deflated sad fish
    g.fillStyle(c.primary);
    g.fillEllipse(Math.round(24 * s), Math.round(34 * s), Math.round(12 * s), Math.round(8 * s));
    g.fillStyle(c.secondary);
    g.fillEllipse(Math.round(24 * s), Math.round(36 * s), Math.round(8 * s), Math.round(4 * s));
    g.fillStyle(PALETTE.void);
    g.fillRect(Math.round(20 * s), Math.round(32 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(26 * s), Math.round(32 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(16 * s), Math.round(26 * s), Math.round(4 * s), Math.round(4 * s));
    return;
  }

  // Round body
  g.fillStyle(c.primary);
  g.fillEllipse(
    Math.round(24 * s),
    Math.round(24 * s),
    Math.round(radius * s),
    Math.round(radius * s)
  );
  // Belly
  g.fillStyle(c.secondary);
  g.fillEllipse(
    Math.round(24 * s),
    Math.round(28 * s),
    Math.round((radius - 4) * s),
    Math.round((radius - 6) * s)
  );

  // SPIKES when puffed!
  if (puffed) {
    g.fillStyle(c.accent);
    // Top spikes
    for (let i = 0; i < 5; i++) {
      g.fillRect(
        Math.round((12 + i * 6) * s),
        Math.round(4 * s),
        Math.round(3 * s),
        Math.round(6 * s)
      );
    }
    // Side spikes
    for (let i = 0; i < 4; i++) {
      g.fillRect(
        Math.round(4 * s),
        Math.round((12 + i * 6) * s),
        Math.round(6 * s),
        Math.round(3 * s)
      );
      g.fillRect(
        Math.round(38 * s),
        Math.round((12 + i * 6) * s),
        Math.round(6 * s),
        Math.round(3 * s)
      );
    }
    // Bottom spikes
    for (let i = 0; i < 5; i++) {
      g.fillRect(
        Math.round((12 + i * 6) * s),
        Math.round(38 * s),
        Math.round(3 * s),
        Math.round(6 * s)
      );
    }
  }

  // Tail fin
  g.fillStyle(c.accent);
  g.fillRect(Math.round(38 * s), Math.round(22 * s), Math.round(8 * s), Math.round(8 * s));

  // Dorsal fin
  g.fillStyle(c.accent);
  g.fillRect(Math.round(22 * s), Math.round(8 * s), Math.round(8 * s), Math.round(6 * s));

  // Big surprised eyes
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(16 * s), Math.round(18 * s), Math.round(7 * s), Math.round(7 * s));
  g.fillRect(Math.round(26 * s), Math.round(18 * s), Math.round(7 * s), Math.round(7 * s));
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(19 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(29 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(19 * s), Math.round(20 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(29 * s), Math.round(20 * s), Math.round(2 * s), Math.round(2 * s));

  // Little mouth (O shape when puffed)
  g.fillStyle(PALETTE.void);
  if (puffed) {
    g.fillEllipse(Math.round(24 * s), Math.round(30 * s), Math.round(3 * s), Math.round(3 * s));
  } else {
    g.fillRect(Math.round(22 * s), Math.round(28 * s), Math.round(4 * s), Math.round(2 * s));
  }

  if (pose === "hurt") {
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(8 * s), Math.round(6 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(36 * s), Math.round(4 * s), Math.round(3 * s), Math.round(3 * s));
  }
}

// === FROG FIGHTER ===
function drawFrogFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  if (pose === "knockout") {
    // Flat frog
    g.fillStyle(c.primary);
    g.fillEllipse(Math.round(24 * s), Math.round(36 * s), Math.round(18 * s), Math.round(8 * s));
    g.fillStyle(c.secondary);
    g.fillEllipse(Math.round(24 * s), Math.round(38 * s), Math.round(14 * s), Math.round(4 * s));
    // Legs spread
    g.fillStyle(c.primary);
    g.fillRect(Math.round(4 * s), Math.round(32 * s), Math.round(10 * s), Math.round(6 * s));
    g.fillRect(Math.round(34 * s), Math.round(32 * s), Math.round(10 * s), Math.round(6 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(18 * s), Math.round(28 * s), Math.round(4 * s), Math.round(4 * s));
    return;
  }

  // Body (squatting pose)
  g.fillStyle(c.primary);
  g.fillEllipse(Math.round(24 * s), Math.round(28 * s), Math.round(14 * s), Math.round(12 * s));
  // Belly
  g.fillStyle(c.secondary);
  g.fillEllipse(Math.round(24 * s), Math.round(32 * s), Math.round(10 * s), Math.round(8 * s));

  // Head (wide)
  g.fillStyle(c.primary);
  g.fillEllipse(Math.round(24 * s), Math.round(16 * s), Math.round(16 * s), Math.round(10 * s));
  g.fillStyle(c.secondary);
  g.fillEllipse(Math.round(24 * s), Math.round(20 * s), Math.round(10 * s), Math.round(6 * s));

  // BIG BULGING EYES
  g.fillStyle(c.primary);
  g.fillEllipse(Math.round(14 * s), Math.round(10 * s), Math.round(8 * s), Math.round(8 * s));
  g.fillEllipse(Math.round(34 * s), Math.round(10 * s), Math.round(8 * s), Math.round(8 * s));
  g.fillStyle(PALETTE.white);
  g.fillEllipse(Math.round(14 * s), Math.round(10 * s), Math.round(6 * s), Math.round(6 * s));
  g.fillEllipse(Math.round(34 * s), Math.round(10 * s), Math.round(6 * s), Math.round(6 * s));
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(13 * s), Math.round(9 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(33 * s), Math.round(9 * s), Math.round(4 * s), Math.round(4 * s));

  // Legs
  if (pose === "attack") {
    // JUMP KICK!
    g.fillStyle(c.primary);
    g.fillRect(Math.round(2 * s), Math.round(24 * s), Math.round(12 * s), Math.round(8 * s));
    g.fillRect(Math.round(32 * s), Math.round(18 * s), Math.round(14 * s), Math.round(8 * s));
    // Foot impact
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(42 * s), Math.round(20 * s), Math.round(4 * s), Math.round(2 * s));
  } else {
    // Squatting legs
    g.fillStyle(c.primary);
    g.fillRect(Math.round(6 * s), Math.round(32 * s), Math.round(10 * s), Math.round(10 * s));
    g.fillRect(Math.round(32 * s), Math.round(32 * s), Math.round(10 * s), Math.round(10 * s));
    // Webbed feet
    g.fillStyle(c.accent);
    g.fillRect(Math.round(4 * s), Math.round(40 * s), Math.round(12 * s), Math.round(6 * s));
    g.fillRect(Math.round(32 * s), Math.round(40 * s), Math.round(12 * s), Math.round(6 * s));
  }

  // Wide mouth
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(18 * s), Math.round(20 * s), Math.round(12 * s), Math.round(3 * s));

  if (pose === "hurt") {
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(4 * s), Math.round(4 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(40 * s), Math.round(2 * s), Math.round(3 * s), Math.round(3 * s));
  }
}

// === SLIME FIGHTER ===
function drawSlimeFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  if (pose === "knockout") {
    // Flat puddle
    g.fillStyle(c.primary, 0.7);
    g.fillEllipse(Math.round(24 * s), Math.round(40 * s), Math.round(20 * s), Math.round(6 * s));
    g.fillStyle(c.secondary, 0.5);
    g.fillEllipse(Math.round(20 * s), Math.round(40 * s), Math.round(10 * s), Math.round(3 * s));
    // Sad eyes in puddle
    g.fillStyle(PALETTE.void);
    g.fillRect(Math.round(18 * s), Math.round(38 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(27 * s), Math.round(38 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(12 * s), Math.round(34 * s), Math.round(4 * s), Math.round(4 * s));
    return;
  }

  // Blobby body (jiggly!)
  const squish = pose === "attack" ? 4 : pose === "hurt" ? -2 : 0;
  g.fillStyle(c.primary, 0.85);
  g.fillEllipse(
    Math.round(24 * s),
    Math.round((28 + squish) * s),
    Math.round((16 - squish) * s),
    Math.round((16 + squish) * s)
  );

  // Inner glow
  g.fillStyle(c.secondary, 0.6);
  g.fillEllipse(
    Math.round(22 * s),
    Math.round((24 + squish) * s),
    Math.round(10 * s),
    Math.round(10 * s)
  );

  // Shine spots
  g.fillStyle(PALETTE.white, 0.7);
  g.fillEllipse(Math.round(18 * s), Math.round(18 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillEllipse(Math.round(14 * s), Math.round(24 * s), Math.round(2 * s), Math.round(2 * s));

  if (pose === "attack") {
    // Slime projectile!
    g.fillStyle(c.primary, 0.7);
    g.fillEllipse(Math.round(42 * s), Math.round(20 * s), Math.round(6 * s), Math.round(6 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(44 * s), Math.round(18 * s), Math.round(4 * s), Math.round(2 * s));
  }

  // Cute face
  g.fillStyle(PALETTE.void);
  // Eyes (^ ^)
  g.fillRect(Math.round(18 * s), Math.round(24 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(22 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(21 * s), Math.round(22 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(28 * s), Math.round(24 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(28 * s), Math.round(22 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(31 * s), Math.round(22 * s), Math.round(1 * s), Math.round(2 * s));
  // Smile
  g.fillRect(Math.round(22 * s), Math.round(30 * s), Math.round(6 * s), Math.round(2 * s));

  if (pose === "hurt") {
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(36 * s), Math.round(10 * s), Math.round(3 * s), Math.round(3 * s));
  }
}

// === ROBOT FIGHTER ===
function drawRobotFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  c: { primary: number; secondary: number; accent: number },
  pose: string
): void {
  if (pose === "knockout") {
    // Broken robot parts
    g.fillStyle(c.primary);
    g.fillRect(Math.round(10 * s), Math.round(30 * s), Math.round(16 * s), Math.round(12 * s));
    g.fillRect(Math.round(28 * s), Math.round(32 * s), Math.round(10 * s), Math.round(8 * s));
    g.fillStyle(c.secondary);
    g.fillRect(Math.round(12 * s), Math.round(32 * s), Math.round(8 * s), Math.round(4 * s));
    // Sparks
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(18 * s), Math.round(26 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(26 * s), Math.round(28 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(14 * s), Math.round(24 * s), Math.round(4 * s), Math.round(4 * s));
    return;
  }

  // Boxy body
  g.fillStyle(c.primary);
  g.fillRect(Math.round(14 * s), Math.round(20 * s), Math.round(20 * s), Math.round(22 * s));
  // Chest plate
  g.fillStyle(c.secondary);
  g.fillRect(Math.round(16 * s), Math.round(24 * s), Math.round(16 * s), Math.round(10 * s));
  // Chest lights
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(18 * s), Math.round(26 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillStyle(PALETTE.bagsGreen);
  g.fillRect(Math.round(24 * s), Math.round(26 * s), Math.round(4 * s), Math.round(3 * s));

  // Head (square with antenna)
  g.fillStyle(c.primary);
  g.fillRect(Math.round(16 * s), Math.round(6 * s), Math.round(16 * s), Math.round(14 * s));
  // Visor
  g.fillStyle(c.accent);
  g.fillRect(Math.round(18 * s), Math.round(10 * s), Math.round(12 * s), Math.round(6 * s));
  // Eyes (glowing)
  g.fillStyle(PALETTE.cyan);
  g.fillRect(Math.round(20 * s), Math.round(12 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(26 * s), Math.round(12 * s), Math.round(3 * s), Math.round(3 * s));
  // Antenna
  g.fillStyle(c.accent);
  g.fillRect(Math.round(23 * s), Math.round(0 * s), Math.round(2 * s), Math.round(8 * s));
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(22 * s), Math.round(-2 * s), Math.round(4 * s), Math.round(4 * s));

  // Arms
  if (pose === "attack") {
    // Rocket punch!
    g.fillStyle(c.primary);
    g.fillRect(Math.round(4 * s), Math.round(22 * s), Math.round(12 * s), Math.round(8 * s));
    g.fillRect(Math.round(32 * s), Math.round(16 * s), Math.round(16 * s), Math.round(10 * s));
    // Fist
    g.fillStyle(c.accent);
    g.fillRect(Math.round(42 * s), Math.round(14 * s), Math.round(6 * s), Math.round(12 * s));
    // Rocket trail
    g.fillStyle(PALETTE.orange);
    g.fillRect(Math.round(32 * s), Math.round(18 * s), Math.round(4 * s), Math.round(6 * s));
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(28 * s), Math.round(19 * s), Math.round(4 * s), Math.round(4 * s));
  } else {
    g.fillStyle(c.primary);
    g.fillRect(Math.round(6 * s), Math.round(22 * s), Math.round(10 * s), Math.round(12 * s));
    g.fillRect(Math.round(32 * s), Math.round(22 * s), Math.round(10 * s), Math.round(12 * s));
    g.fillStyle(c.accent);
    g.fillRect(Math.round(4 * s), Math.round(32 * s), Math.round(8 * s), Math.round(6 * s));
    g.fillRect(Math.round(36 * s), Math.round(32 * s), Math.round(8 * s), Math.round(6 * s));
  }

  // Legs
  g.fillStyle(c.primary);
  g.fillRect(Math.round(16 * s), Math.round(40 * s), Math.round(6 * s), Math.round(8 * s));
  g.fillRect(Math.round(26 * s), Math.round(40 * s), Math.round(6 * s), Math.round(8 * s));
  // Feet
  g.fillStyle(c.accent);
  g.fillRect(Math.round(14 * s), Math.round(44 * s), Math.round(8 * s), Math.round(4 * s));
  g.fillRect(Math.round(26 * s), Math.round(44 * s), Math.round(8 * s), Math.round(4 * s));

  if (pose === "hurt") {
    // Sparks
    g.fillStyle(PALETTE.yellow);
    g.fillRect(Math.round(8 * s), Math.round(10 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(36 * s), Math.round(8 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(20 * s), Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));
  }
}

function createFighterSprite(
  scene: Phaser.Scene,
  key: string,
  skinTone: number,
  hairColor: number,
  shirtColor: number,
  pose: "idle_fight" | "attack" | "hurt" | "knockout"
): void {
  const s = SCALE;
  // Larger sprite for more detail (48x48 base)
  const size = Math.round(48 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Ground shadow - ellipse with gradient feel
  g.fillStyle(PALETTE.void, 0.4);
  if (pose === "knockout") {
    // Wider shadow for fallen fighter
    g.fillEllipse(Math.round(24 * s), Math.round(44 * s), Math.round(20 * s), Math.round(4 * s));
  } else {
    g.fillEllipse(Math.round(24 * s), Math.round(46 * s), Math.round(14 * s), Math.round(5 * s));
  }
  // Inner softer shadow
  g.fillStyle(PALETTE.void, 0.2);
  if (pose === "knockout") {
    g.fillEllipse(Math.round(24 * s), Math.round(44 * s), Math.round(16 * s), Math.round(3 * s));
  } else {
    g.fillEllipse(Math.round(24 * s), Math.round(46 * s), Math.round(10 * s), Math.round(3 * s));
  }

  const pantsColor = PALETTE.navy;

  if (pose === "knockout") {
    drawKnockoutFighter(g, s, skinTone, hairColor, shirtColor, pantsColor);
  } else if (pose === "attack") {
    drawAttackFighter(g, s, skinTone, hairColor, shirtColor, pantsColor);
  } else if (pose === "hurt") {
    drawHurtFighter(g, s, skinTone, hairColor, shirtColor, pantsColor);
  } else {
    drawIdleFightFighter(g, s, skinTone, hairColor, shirtColor, pantsColor);
  }

  g.generateTexture(key, size, size);
  g.destroy();
}

function drawIdleFightFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  skinTone: number,
  hairColor: number,
  shirtColor: number,
  pantsColor: number
): void {
  // Fighting stance: legs apart, fists raised, ready to brawl
  // 48x48 canvas with better proportions

  // === LEGS - Wide fighting stance ===
  g.fillStyle(pantsColor);
  // Left leg
  g.fillRect(Math.round(10 * s), Math.round(32 * s), Math.round(7 * s), Math.round(12 * s));
  // Right leg
  g.fillRect(Math.round(31 * s), Math.round(32 * s), Math.round(7 * s), Math.round(12 * s));
  // Leg highlights (left edge)
  g.fillStyle(lighten(pantsColor, 0.2));
  g.fillRect(Math.round(10 * s), Math.round(32 * s), Math.round(2 * s), Math.round(12 * s));
  g.fillRect(Math.round(31 * s), Math.round(32 * s), Math.round(2 * s), Math.round(12 * s));
  // Leg shadows (right edge)
  g.fillStyle(darken(pantsColor, 0.25));
  g.fillRect(Math.round(15 * s), Math.round(32 * s), Math.round(2 * s), Math.round(12 * s));
  g.fillRect(Math.round(36 * s), Math.round(32 * s), Math.round(2 * s), Math.round(12 * s));
  // Knee highlights
  g.fillStyle(lighten(pantsColor, 0.1));
  g.fillRect(Math.round(12 * s), Math.round(36 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(33 * s), Math.round(36 * s), Math.round(3 * s), Math.round(2 * s));

  // === SHOES - Boxing boots ===
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(Math.round(8 * s), Math.round(42 * s), Math.round(9 * s), Math.round(5 * s));
  g.fillRect(Math.round(30 * s), Math.round(42 * s), Math.round(9 * s), Math.round(5 * s));
  // Shoe highlights
  g.fillStyle(lighten(PALETTE.darkGray, 0.25));
  g.fillRect(Math.round(8 * s), Math.round(42 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(30 * s), Math.round(42 * s), Math.round(4 * s), Math.round(2 * s));
  // Shoe soles
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(8 * s), Math.round(46 * s), Math.round(9 * s), Math.round(1 * s));
  g.fillRect(Math.round(30 * s), Math.round(46 * s), Math.round(9 * s), Math.round(1 * s));

  // === TORSO - Athletic build ===
  g.fillStyle(shirtColor);
  g.fillRect(Math.round(12 * s), Math.round(18 * s), Math.round(24 * s), Math.round(16 * s));
  // Chest highlight
  g.fillStyle(lighten(shirtColor, 0.25));
  g.fillRect(Math.round(12 * s), Math.round(18 * s), Math.round(6 * s), Math.round(10 * s));
  // Side shadow
  g.fillStyle(darken(shirtColor, 0.2));
  g.fillRect(Math.round(32 * s), Math.round(18 * s), Math.round(4 * s), Math.round(16 * s));
  // Collar/neckline
  g.fillStyle(darken(shirtColor, 0.15));
  g.fillRect(Math.round(20 * s), Math.round(18 * s), Math.round(8 * s), Math.round(2 * s));
  // Muscle definition lines
  g.fillStyle(darken(shirtColor, 0.1));
  g.fillRect(Math.round(24 * s), Math.round(22 * s), Math.round(1 * s), Math.round(8 * s));

  // === ARMS - Boxing guard position ===
  // Left arm (closer, blocking face)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(14 * s), Math.round(9 * s), Math.round(10 * s));
  g.fillStyle(lighten(skinTone, 0.18));
  g.fillRect(Math.round(4 * s), Math.round(14 * s), Math.round(3 * s), Math.round(10 * s));
  g.fillStyle(darken(skinTone, 0.15));
  g.fillRect(Math.round(11 * s), Math.round(14 * s), Math.round(2 * s), Math.round(10 * s));

  // Right arm (back, guard position)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(35 * s), Math.round(15 * s), Math.round(9 * s), Math.round(10 * s));
  g.fillStyle(lighten(skinTone, 0.18));
  g.fillRect(Math.round(35 * s), Math.round(15 * s), Math.round(3 * s), Math.round(10 * s));
  g.fillStyle(darken(skinTone, 0.15));
  g.fillRect(Math.round(42 * s), Math.round(15 * s), Math.round(2 * s), Math.round(10 * s));

  // === FISTS - Wrapped boxing gloves ===
  // Left fist (larger, closer)
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(2 * s), Math.round(10 * s), Math.round(9 * s), Math.round(7 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(2 * s), Math.round(10 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(darken(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(9 * s), Math.round(14 * s), Math.round(2 * s), Math.round(3 * s));
  // Glove stripe
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(2 * s), Math.round(16 * s), Math.round(9 * s), Math.round(1 * s));

  // Right fist
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(37 * s), Math.round(11 * s), Math.round(9 * s), Math.round(7 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(37 * s), Math.round(11 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(darken(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(44 * s), Math.round(15 * s), Math.round(2 * s), Math.round(3 * s));
  // Glove stripe
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(37 * s), Math.round(17 * s), Math.round(9 * s), Math.round(1 * s));

  // === HEAD - Determined expression ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(14 * s), Math.round(2 * s), Math.round(20 * s), Math.round(17 * s));
  // Face highlight (left side)
  g.fillStyle(lighten(skinTone, 0.15));
  g.fillRect(Math.round(14 * s), Math.round(2 * s), Math.round(7 * s), Math.round(8 * s));
  // Face shadow (right side)
  g.fillStyle(darken(skinTone, 0.12));
  g.fillRect(Math.round(30 * s), Math.round(5 * s), Math.round(4 * s), Math.round(12 * s));
  // Jaw definition
  g.fillStyle(darken(skinTone, 0.08));
  g.fillRect(Math.round(16 * s), Math.round(15 * s), Math.round(16 * s), Math.round(4 * s));

  // === HAIR - Spiky fighter style ===
  g.fillStyle(hairColor);
  g.fillRect(Math.round(13 * s), Math.round(0 * s), Math.round(22 * s), Math.round(7 * s));
  // Side hair
  g.fillRect(Math.round(12 * s), Math.round(3 * s), Math.round(3 * s), Math.round(6 * s));
  g.fillRect(Math.round(33 * s), Math.round(3 * s), Math.round(3 * s), Math.round(6 * s));
  // Spikes
  g.fillRect(Math.round(16 * s), Math.round(-1 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(22 * s), Math.round(-2 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(29 * s), Math.round(-1 * s), Math.round(3 * s), Math.round(3 * s));
  // Hair highlights
  g.fillStyle(lighten(hairColor, 0.35));
  g.fillRect(Math.round(15 * s), Math.round(1 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillRect(Math.round(23 * s), Math.round(-1 * s), Math.round(2 * s), Math.round(2 * s));
  // Hair shadow
  g.fillStyle(darken(hairColor, 0.25));
  g.fillRect(Math.round(28 * s), Math.round(3 * s), Math.round(6 * s), Math.round(4 * s));

  // === EYES - Intense fighting gaze ===
  // Eye whites
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(17 * s), Math.round(8 * s), Math.round(6 * s), Math.round(4 * s));
  g.fillRect(Math.round(26 * s), Math.round(8 * s), Math.round(6 * s), Math.round(4 * s));
  // Pupils (looking forward)
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(20 * s), Math.round(9 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(29 * s), Math.round(9 * s), Math.round(3 * s), Math.round(3 * s));
  // Eye shine
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(20 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(29 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
  // Eyebrows (furrowed)
  g.fillStyle(darken(hairColor, 0.3));
  g.fillRect(Math.round(17 * s), Math.round(6 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillRect(Math.round(26 * s), Math.round(6 * s), Math.round(6 * s), Math.round(2 * s));

  // === MOUTH - Determined grin ===
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(21 * s), Math.round(14 * s), Math.round(6 * s), Math.round(2 * s));
  // Teeth showing (fighting spirit)
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(22 * s), Math.round(14 * s), Math.round(4 * s), Math.round(1 * s));

  // === HEADBAND - Fighter accessory ===
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(13 * s), Math.round(5 * s), Math.round(22 * s), Math.round(2 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(13 * s), Math.round(5 * s), Math.round(8 * s), Math.round(1 * s));
}

function drawAttackFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  skinTone: number,
  hairColor: number,
  shirtColor: number,
  pantsColor: number
): void {
  // DYNAMIC ATTACK POSE - Powerful punch with energy effects
  // 48x48 canvas, body lunging forward

  // === MOTION LINES (behind character) ===
  g.fillStyle(PALETTE.white, 0.6);
  g.fillRect(Math.round(0 * s), Math.round(18 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillRect(Math.round(2 * s), Math.round(24 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillRect(Math.round(0 * s), Math.round(30 * s), Math.round(7 * s), Math.round(2 * s));
  g.fillStyle(PALETTE.white, 0.4);
  g.fillRect(Math.round(1 * s), Math.round(21 * s), Math.round(5 * s), Math.round(1 * s));
  g.fillRect(Math.round(3 * s), Math.round(27 * s), Math.round(4 * s), Math.round(1 * s));

  // === LEGS - Dynamic lunge ===
  g.fillStyle(pantsColor);
  // Back leg (left) - pushed off
  g.fillRect(Math.round(6 * s), Math.round(33 * s), Math.round(7 * s), Math.round(11 * s));
  // Front leg (right) - extended forward
  g.fillRect(Math.round(28 * s), Math.round(34 * s), Math.round(7 * s), Math.round(10 * s));
  g.fillRect(Math.round(34 * s), Math.round(36 * s), Math.round(5 * s), Math.round(8 * s));
  // Leg highlights
  g.fillStyle(lighten(pantsColor, 0.2));
  g.fillRect(Math.round(6 * s), Math.round(33 * s), Math.round(2 * s), Math.round(11 * s));
  g.fillRect(Math.round(28 * s), Math.round(34 * s), Math.round(2 * s), Math.round(10 * s));
  // Leg shadows
  g.fillStyle(darken(pantsColor, 0.25));
  g.fillRect(Math.round(11 * s), Math.round(33 * s), Math.round(2 * s), Math.round(11 * s));
  g.fillRect(Math.round(37 * s), Math.round(36 * s), Math.round(2 * s), Math.round(8 * s));

  // === SHOES ===
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(Math.round(4 * s), Math.round(42 * s), Math.round(9 * s), Math.round(5 * s));
  g.fillRect(Math.round(32 * s), Math.round(42 * s), Math.round(10 * s), Math.round(5 * s));
  g.fillStyle(lighten(PALETTE.darkGray, 0.2));
  g.fillRect(Math.round(4 * s), Math.round(42 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(32 * s), Math.round(42 * s), Math.round(4 * s), Math.round(2 * s));

  // === TORSO - Rotated forward in punch ===
  g.fillStyle(shirtColor);
  g.fillRect(Math.round(10 * s), Math.round(20 * s), Math.round(22 * s), Math.round(15 * s));
  // Chest highlight
  g.fillStyle(lighten(shirtColor, 0.25));
  g.fillRect(Math.round(10 * s), Math.round(20 * s), Math.round(6 * s), Math.round(8 * s));
  // Side shadow (heavy)
  g.fillStyle(darken(shirtColor, 0.3));
  g.fillRect(Math.round(28 * s), Math.round(20 * s), Math.round(4 * s), Math.round(15 * s));
  // Motion blur on torso edge
  g.fillStyle(shirtColor, 0.5);
  g.fillRect(Math.round(8 * s), Math.round(22 * s), Math.round(2 * s), Math.round(10 * s));

  // === LEFT ARM - Pulled back for balance ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(22 * s), Math.round(7 * s), Math.round(8 * s));
  g.fillStyle(lighten(skinTone, 0.18));
  g.fillRect(Math.round(4 * s), Math.round(22 * s), Math.round(2 * s), Math.round(8 * s));
  // Left fist (pulled back)
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(2 * s), Math.round(28 * s), Math.round(7 * s), Math.round(6 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(2 * s), Math.round(28 * s), Math.round(2 * s), Math.round(2 * s));

  // === RIGHT ARM - EXTENDED PUNCH ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(30 * s), Math.round(14 * s), Math.round(12 * s), Math.round(6 * s));
  g.fillStyle(lighten(skinTone, 0.18));
  g.fillRect(Math.round(30 * s), Math.round(14 * s), Math.round(3 * s), Math.round(6 * s));
  g.fillStyle(darken(skinTone, 0.15));
  g.fillRect(Math.round(40 * s), Math.round(18 * s), Math.round(2 * s), Math.round(2 * s));

  // === PUNCHING FIST - With impact effect ===
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(40 * s), Math.round(12 * s), Math.round(8 * s), Math.round(8 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.35));
  g.fillRect(Math.round(40 * s), Math.round(12 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(darken(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(46 * s), Math.round(17 * s), Math.round(2 * s), Math.round(3 * s));
  // Glove stripe
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(40 * s), Math.round(19 * s), Math.round(8 * s), Math.round(1 * s));

  // === IMPACT BURST EFFECT ===
  // Yellow/white energy burst at fist
  g.fillStyle(PALETTE.yellow, 0.9);
  g.fillRect(Math.round(46 * s), Math.round(10 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(46 * s), Math.round(18 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.white, 0.8);
  g.fillRect(Math.round(46 * s), Math.round(14 * s), Math.round(2 * s), Math.round(4 * s));
  // Speed lines from fist
  g.fillStyle(PALETTE.white, 0.7);
  g.fillRect(Math.round(34 * s), Math.round(15 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(36 * s), Math.round(17 * s), Math.round(4 * s), Math.round(1 * s));
  // Starburst
  g.fillStyle(PALETTE.yellow);
  g.fillRect(Math.round(44 * s), Math.round(8 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(44 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(45 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(45 * s), Math.round(22 * s), Math.round(1 * s), Math.round(1 * s));

  // === HEAD - Leaning into punch, intense ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(12 * s), Math.round(4 * s), Math.round(18 * s), Math.round(16 * s));
  g.fillStyle(lighten(skinTone, 0.15));
  g.fillRect(Math.round(12 * s), Math.round(4 * s), Math.round(6 * s), Math.round(7 * s));
  g.fillStyle(darken(skinTone, 0.12));
  g.fillRect(Math.round(27 * s), Math.round(6 * s), Math.round(3 * s), Math.round(12 * s));

  // === HAIR - Wind-blown back ===
  g.fillStyle(hairColor);
  g.fillRect(Math.round(10 * s), Math.round(2 * s), Math.round(20 * s), Math.round(6 * s));
  g.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(4 * s), Math.round(5 * s));
  // Hair flying back from motion
  g.fillRect(Math.round(6 * s), Math.round(3 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(4 * s), Math.round(5 * s), Math.round(3 * s), Math.round(2 * s));
  // Hair highlights
  g.fillStyle(lighten(hairColor, 0.35));
  g.fillRect(Math.round(12 * s), Math.round(2 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillStyle(darken(hairColor, 0.25));
  g.fillRect(Math.round(24 * s), Math.round(4 * s), Math.round(5 * s), Math.round(4 * s));

  // === EYES - Wide with fighting spirit ===
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(15 * s), Math.round(9 * s), Math.round(6 * s), Math.round(5 * s));
  g.fillRect(Math.round(23 * s), Math.round(9 * s), Math.round(6 * s), Math.round(5 * s));
  // Pupils (looking at target)
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(18 * s), Math.round(10 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(26 * s), Math.round(10 * s), Math.round(3 * s), Math.round(3 * s));
  // Eye shine (intense)
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(18 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(26 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));
  // Angry eyebrows (diagonal)
  g.fillStyle(darken(hairColor, 0.3));
  g.fillRect(Math.round(15 * s), Math.round(8 * s), Math.round(5 * s), Math.round(2 * s));
  g.fillRect(Math.round(16 * s), Math.round(7 * s), Math.round(3 * s), Math.round(1 * s));
  g.fillRect(Math.round(24 * s), Math.round(8 * s), Math.round(5 * s), Math.round(2 * s));
  g.fillRect(Math.round(26 * s), Math.round(7 * s), Math.round(3 * s), Math.round(1 * s));

  // === MOUTH - Battle cry ===
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(18 * s), Math.round(15 * s), Math.round(8 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.darkRed);
  g.fillRect(Math.round(19 * s), Math.round(17 * s), Math.round(6 * s), Math.round(1 * s));
  // Teeth showing
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(19 * s), Math.round(15 * s), Math.round(6 * s), Math.round(2 * s));

  // === HEADBAND - Flying in wind ===
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(20 * s), Math.round(2 * s));
  // Headband tail flying back
  g.fillRect(Math.round(6 * s), Math.round(7 * s), Math.round(5 * s), Math.round(2 * s));
  g.fillRect(Math.round(3 * s), Math.round(8 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(6 * s), Math.round(1 * s));
}

function drawHurtFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  skinTone: number,
  hairColor: number,
  shirtColor: number,
  pantsColor: number
): void {
  // DRAMATIC HURT POSE - Recoiling from hit with impact effects
  // 48x48 canvas, body leaning back

  // === IMPACT PARTICLES (at point of hit) ===
  g.fillStyle(PALETTE.white, 0.8);
  g.fillRect(Math.round(6 * s), Math.round(14 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(4 * s), Math.round(18 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(20 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillStyle(PALETTE.yellow, 0.7);
  g.fillRect(Math.round(5 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(9 * s), Math.round(17 * s), Math.round(2 * s), Math.round(2 * s));

  // === LEGS - Stumbling back ===
  g.fillStyle(pantsColor);
  // Left leg (weight on it)
  g.fillRect(Math.round(18 * s), Math.round(33 * s), Math.round(7 * s), Math.round(11 * s));
  // Right leg (lifting from recoil)
  g.fillRect(Math.round(28 * s), Math.round(35 * s), Math.round(7 * s), Math.round(9 * s));
  // Leg highlights
  g.fillStyle(lighten(pantsColor, 0.2));
  g.fillRect(Math.round(18 * s), Math.round(33 * s), Math.round(2 * s), Math.round(11 * s));
  g.fillRect(Math.round(28 * s), Math.round(35 * s), Math.round(2 * s), Math.round(9 * s));
  // Leg shadows
  g.fillStyle(darken(pantsColor, 0.25));
  g.fillRect(Math.round(23 * s), Math.round(33 * s), Math.round(2 * s), Math.round(11 * s));
  g.fillRect(Math.round(33 * s), Math.round(35 * s), Math.round(2 * s), Math.round(9 * s));

  // === SHOES ===
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(Math.round(16 * s), Math.round(42 * s), Math.round(9 * s), Math.round(5 * s));
  g.fillRect(Math.round(27 * s), Math.round(42 * s), Math.round(9 * s), Math.round(5 * s));
  g.fillStyle(lighten(PALETTE.darkGray, 0.2));
  g.fillRect(Math.round(16 * s), Math.round(42 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(27 * s), Math.round(42 * s), Math.round(4 * s), Math.round(2 * s));

  // === TORSO - Leaning back from hit ===
  g.fillStyle(shirtColor);
  g.fillRect(Math.round(16 * s), Math.round(20 * s), Math.round(22 * s), Math.round(15 * s));
  // Chest highlight
  g.fillStyle(lighten(shirtColor, 0.2));
  g.fillRect(Math.round(16 * s), Math.round(20 * s), Math.round(5 * s), Math.round(8 * s));
  // Heavy shadow from lean
  g.fillStyle(darken(shirtColor, 0.3));
  g.fillRect(Math.round(34 * s), Math.round(20 * s), Math.round(4 * s), Math.round(15 * s));
  // Impact point on chest
  g.fillStyle(darken(shirtColor, 0.15));
  g.fillRect(Math.round(18 * s), Math.round(24 * s), Math.round(8 * s), Math.round(6 * s));

  // === ARMS - Defensive/flailing ===
  // Left arm (thrown up)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(10 * s), Math.round(12 * s), Math.round(8 * s), Math.round(10 * s));
  g.fillStyle(lighten(skinTone, 0.18));
  g.fillRect(Math.round(10 * s), Math.round(12 * s), Math.round(2 * s), Math.round(10 * s));
  // Left glove (up protecting)
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(8 * s), Math.round(8 * s), Math.round(8 * s), Math.round(6 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(8 * s), Math.round(8 * s), Math.round(3 * s), Math.round(2 * s));

  // Right arm (thrown back)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(36 * s), Math.round(18 * s), Math.round(8 * s), Math.round(8 * s));
  g.fillStyle(lighten(skinTone, 0.18));
  g.fillRect(Math.round(36 * s), Math.round(18 * s), Math.round(2 * s), Math.round(8 * s));
  // Right glove (dropped)
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(40 * s), Math.round(24 * s), Math.round(7 * s), Math.round(6 * s));
  g.fillStyle(darken(PALETTE.brightRed, 0.2));
  g.fillRect(Math.round(45 * s), Math.round(26 * s), Math.round(2 * s), Math.round(4 * s));

  // === HEAD - Snapped back from impact ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(18 * s), Math.round(2 * s), Math.round(20 * s), Math.round(18 * s));
  // Face highlight
  g.fillStyle(lighten(skinTone, 0.15));
  g.fillRect(Math.round(18 * s), Math.round(2 * s), Math.round(7 * s), Math.round(8 * s));
  // Face shadow (heavier due to angle)
  g.fillStyle(darken(skinTone, 0.15));
  g.fillRect(Math.round(34 * s), Math.round(5 * s), Math.round(4 * s), Math.round(13 * s));
  // Bruise mark
  g.fillStyle(darken(skinTone, 0.25));
  g.fillRect(Math.round(20 * s), Math.round(10 * s), Math.round(4 * s), Math.round(3 * s));

  // === HAIR - Whipping back ===
  g.fillStyle(hairColor);
  g.fillRect(Math.round(17 * s), Math.round(0 * s), Math.round(22 * s), Math.round(6 * s));
  g.fillRect(Math.round(16 * s), Math.round(3 * s), Math.round(3 * s), Math.round(5 * s));
  // Hair flying up from impact
  g.fillRect(Math.round(36 * s), Math.round(-1 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(39 * s), Math.round(1 * s), Math.round(3 * s), Math.round(3 * s));
  // Hair highlights
  g.fillStyle(lighten(hairColor, 0.35));
  g.fillRect(Math.round(19 * s), Math.round(0 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillStyle(darken(hairColor, 0.25));
  g.fillRect(Math.round(32 * s), Math.round(2 * s), Math.round(6 * s), Math.round(4 * s));

  // === EYES - Squinting in pain (X pattern) ===
  g.fillStyle(PALETTE.void);
  // Left eye X
  g.fillRect(Math.round(22 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(26 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(24 * s), Math.round(9 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(22 * s), Math.round(11 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(26 * s), Math.round(11 * s), Math.round(2 * s), Math.round(1 * s));
  // Right eye X
  g.fillRect(Math.round(30 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(34 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(32 * s), Math.round(9 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(30 * s), Math.round(11 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(34 * s), Math.round(11 * s), Math.round(2 * s), Math.round(1 * s));

  // === MOUTH - Pain expression ===
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(26 * s), Math.round(14 * s), Math.round(6 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.darkRed);
  g.fillRect(Math.round(27 * s), Math.round(16 * s), Math.round(4 * s), Math.round(1 * s));

  // === SWEAT DROPS ===
  g.fillStyle(PALETTE.lightBlue, 0.8);
  g.fillRect(Math.round(16 * s), Math.round(8 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(38 * s), Math.round(6 * s), Math.round(2 * s), Math.round(3 * s));

  // === PAIN STARS - Circling head ===
  g.fillStyle(PALETTE.yellow);
  g.fillRect(Math.round(14 * s), Math.round(0 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(40 * s), Math.round(-2 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(28 * s), Math.round(-3 * s), Math.round(3 * s), Math.round(3 * s));
  // Star highlights
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(14 * s), Math.round(0 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(40 * s), Math.round(-2 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(28 * s), Math.round(-3 * s), Math.round(1 * s), Math.round(1 * s));

  // === HEADBAND - Knocked askew ===
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(18 * s), Math.round(2 * s));
  // Headband tail flying wild
  g.fillRect(Math.round(35 * s), Math.round(3 * s), Math.round(5 * s), Math.round(3 * s));
  g.fillRect(Math.round(39 * s), Math.round(1 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(42 * s), Math.round(-1 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(6 * s), Math.round(1 * s));
}

function drawKnockoutFighter(
  g: Phaser.GameObjects.Graphics,
  s: number,
  skinTone: number,
  hairColor: number,
  shirtColor: number,
  pantsColor: number
): void {
  // KNOCKOUT POSE - Completely defeated, lying on ground
  // 48x48 canvas, body horizontal

  // === DUST CLOUD (from fall) ===
  g.fillStyle(PALETTE.lightGray, 0.3);
  g.fillEllipse(Math.round(24 * s), Math.round(42 * s), Math.round(18 * s), Math.round(6 * s));
  g.fillStyle(PALETTE.silver, 0.2);
  g.fillRect(Math.round(8 * s), Math.round(38 * s), Math.round(6 * s), Math.round(4 * s));
  g.fillRect(Math.round(36 * s), Math.round(37 * s), Math.round(5 * s), Math.round(4 * s));

  // === LEGS - Sprawled out ===
  g.fillStyle(pantsColor);
  // Both legs lying flat
  g.fillRect(Math.round(32 * s), Math.round(30 * s), Math.round(14 * s), Math.round(7 * s));
  // Leg highlights (top)
  g.fillStyle(lighten(pantsColor, 0.2));
  g.fillRect(Math.round(32 * s), Math.round(30 * s), Math.round(14 * s), Math.round(2 * s));
  // Leg shadows (bottom)
  g.fillStyle(darken(pantsColor, 0.25));
  g.fillRect(Math.round(32 * s), Math.round(35 * s), Math.round(14 * s), Math.round(2 * s));

  // === SHOES - At end of legs ===
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(Math.round(44 * s), Math.round(28 * s), Math.round(4 * s), Math.round(9 * s));
  g.fillStyle(lighten(PALETTE.darkGray, 0.2));
  g.fillRect(Math.round(44 * s), Math.round(28 * s), Math.round(2 * s), Math.round(9 * s));

  // === TORSO - Lying flat ===
  g.fillStyle(shirtColor);
  g.fillRect(Math.round(12 * s), Math.round(27 * s), Math.round(22 * s), Math.round(12 * s));
  // Top highlight
  g.fillStyle(lighten(shirtColor, 0.25));
  g.fillRect(Math.round(12 * s), Math.round(27 * s), Math.round(22 * s), Math.round(4 * s));
  // Bottom shadow
  g.fillStyle(darken(shirtColor, 0.2));
  g.fillRect(Math.round(12 * s), Math.round(35 * s), Math.round(22 * s), Math.round(4 * s));
  // Side visible
  g.fillStyle(darken(shirtColor, 0.15));
  g.fillRect(Math.round(30 * s), Math.round(27 * s), Math.round(4 * s), Math.round(12 * s));

  // === ARMS - Sprawled dramatically ===
  // Left arm (thrown up near head)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(6 * s), Math.round(18 * s), Math.round(8 * s), Math.round(10 * s));
  g.fillStyle(lighten(skinTone, 0.18));
  g.fillRect(Math.round(6 * s), Math.round(18 * s), Math.round(8 * s), Math.round(3 * s));
  // Left glove (dropped)
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(4 * s), Math.round(14 * s), Math.round(8 * s), Math.round(6 * s));
  g.fillStyle(darken(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(4 * s), Math.round(18 * s), Math.round(8 * s), Math.round(2 * s));

  // Right arm (out to side)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(28 * s), Math.round(38 * s), Math.round(10 * s), Math.round(6 * s));
  g.fillStyle(lighten(skinTone, 0.18));
  g.fillRect(Math.round(28 * s), Math.round(38 * s), Math.round(10 * s), Math.round(2 * s));
  // Right glove
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(36 * s), Math.round(37 * s), Math.round(7 * s), Math.round(7 * s));
  g.fillStyle(darken(PALETTE.brightRed, 0.2));
  g.fillRect(Math.round(41 * s), Math.round(41 * s), Math.round(2 * s), Math.round(3 * s));

  // === HEAD - Turned to side, on ground ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(2 * s), Math.round(24 * s), Math.round(14 * s), Math.round(14 * s));
  // Top of head (light)
  g.fillStyle(lighten(skinTone, 0.15));
  g.fillRect(Math.round(2 * s), Math.round(24 * s), Math.round(14 * s), Math.round(5 * s));
  // Chin area (shadow)
  g.fillStyle(darken(skinTone, 0.12));
  g.fillRect(Math.round(2 * s), Math.round(34 * s), Math.round(14 * s), Math.round(4 * s));
  // Cheek squished against ground
  g.fillStyle(darken(skinTone, 0.08));
  g.fillRect(Math.round(2 * s), Math.round(30 * s), Math.round(5 * s), Math.round(6 * s));
  // Bruise on face
  g.fillStyle(darken(skinTone, 0.3));
  g.fillRect(Math.round(10 * s), Math.round(28 * s), Math.round(3 * s), Math.round(3 * s));

  // === HAIR - Messed up on ground ===
  g.fillStyle(hairColor);
  g.fillRect(Math.round(0 * s), Math.round(22 * s), Math.round(14 * s), Math.round(6 * s));
  // Hair splayed out
  g.fillRect(Math.round(-1 * s), Math.round(24 * s), Math.round(4 * s), Math.round(8 * s));
  g.fillRect(Math.round(12 * s), Math.round(24 * s), Math.round(4 * s), Math.round(4 * s));
  // Hair highlights
  g.fillStyle(lighten(hairColor, 0.35));
  g.fillRect(Math.round(2 * s), Math.round(22 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillStyle(darken(hairColor, 0.25));
  g.fillRect(Math.round(10 * s), Math.round(24 * s), Math.round(4 * s), Math.round(4 * s));

  // === EYES - Classic X X knockout ===
  g.fillStyle(PALETTE.void);
  // Left X (larger for emphasis)
  g.fillRect(Math.round(4 * s), Math.round(28 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(7 * s), Math.round(28 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(5 * s), Math.round(29 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(4 * s), Math.round(31 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(7 * s), Math.round(31 * s), Math.round(2 * s), Math.round(1 * s));
  // Right X
  g.fillRect(Math.round(10 * s), Math.round(28 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(13 * s), Math.round(28 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(11 * s), Math.round(29 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(10 * s), Math.round(31 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(13 * s), Math.round(31 * s), Math.round(2 * s), Math.round(1 * s));

  // === MOUTH - Dazed, tongue out ===
  g.fillStyle(PALETTE.void);
  g.fillRect(Math.round(6 * s), Math.round(34 * s), Math.round(6 * s), Math.round(3 * s));
  // Tongue
  g.fillStyle(PALETTE.darkRed);
  g.fillRect(Math.round(7 * s), Math.round(36 * s), Math.round(4 * s), Math.round(2 * s));

  // === CIRCLING STARS - Classic KO effect ===
  // Star 1 (large)
  g.fillStyle(PALETTE.yellow);
  g.fillRect(Math.round(0 * s), Math.round(16 * s), Math.round(5 * s), Math.round(5 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(1 * s), Math.round(17 * s), Math.round(2 * s), Math.round(2 * s));
  // Star 2 (medium)
  g.fillStyle(PALETTE.yellow);
  g.fillRect(Math.round(10 * s), Math.round(12 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(11 * s), Math.round(13 * s), Math.round(1 * s), Math.round(1 * s));
  // Star 3 (small)
  g.fillStyle(PALETTE.yellow);
  g.fillRect(Math.round(18 * s), Math.round(16 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(18 * s), Math.round(16 * s), Math.round(1 * s), Math.round(1 * s));
  // Star 4 (medium)
  g.fillStyle(PALETTE.yellow);
  g.fillRect(Math.round(6 * s), Math.round(10 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(1 * s), Math.round(1 * s));
  // Star 5 (small, sparkle)
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(14 * s), Math.round(8 * s), Math.round(2 * s), Math.round(2 * s));

  // === HEADBAND - Fallen off ===
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(Math.round(0 * s), Math.round(20 * s), Math.round(8 * s), Math.round(2 * s));
  // Headband lying separate
  g.fillRect(Math.round(18 * s), Math.round(42 * s), Math.round(10 * s), Math.round(3 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(18 * s), Math.round(42 * s), Math.round(4 * s), Math.round(1 * s));

  // === "KO" TEXT EFFECT (optional dramatic) ===
  // Small "ZZZ" to show knocked out
  g.fillStyle(PALETTE.white, 0.7);
  g.fillRect(Math.round(20 * s), Math.round(20 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillRect(Math.round(22 * s), Math.round(21 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(20 * s), Math.round(22 * s), Math.round(4 * s), Math.round(1 * s));
}

function generateArenaFloor(scene: Phaser.Scene): void {
  const s = SCALE;
  const size = Math.round(32 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Dark base floor
  g.fillStyle(PALETTE.gray);
  g.fillRect(0, 0, size, size);

  // Checkerboard pattern
  const tileSize = Math.round(8 * s);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if ((x + y) % 2 === 0) {
        g.fillStyle(PALETTE.darkGray);
      } else {
        g.fillStyle(darken(PALETTE.gray, 0.1));
      }
      g.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  // Subtle wear marks
  g.fillStyle(darken(PALETTE.darkGray, 0.2));
  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(20 * s), Math.round(24 * s), Math.round(3 * s), Math.round(1 * s));
  g.fillRect(Math.round(14 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));

  g.generateTexture("arena_floor", size, size);
  g.destroy();
}

function generateArenaRing(scene: Phaser.Scene): void {
  const s = SCALE;
  const canvasW = Math.round(200 * s);
  const canvasH = Math.round(120 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Ring platform base
  const platformY = Math.round(80 * s);
  const platformH = Math.round(40 * s);

  // Platform shadow
  g.fillStyle(PALETTE.void);
  g.fillRect(
    Math.round(10 * s),
    platformY + platformH - Math.round(5 * s),
    canvasW - Math.round(20 * s),
    Math.round(10 * s)
  );

  // Platform side (3D depth)
  g.fillStyle(darken(0xa8754b, 0.3));
  g.fillRect(Math.round(5 * s), platformY, canvasW - Math.round(10 * s), platformH);

  // Platform top
  g.fillStyle(0xa8754b); // Brown wood
  g.fillRect(
    Math.round(5 * s),
    platformY - Math.round(5 * s),
    canvasW - Math.round(10 * s),
    Math.round(10 * s)
  );

  // Platform highlight
  g.fillStyle(lighten(0xa8754b, 0.2));
  g.fillRect(
    Math.round(5 * s),
    platformY - Math.round(5 * s),
    canvasW - Math.round(10 * s),
    Math.round(3 * s)
  );

  // Ring mat
  const matX = Math.round(15 * s);
  const matY = Math.round(70 * s);
  const matW = canvasW - Math.round(30 * s);
  const matH = Math.round(15 * s);

  g.fillStyle(PALETTE.gray);
  g.fillRect(matX, matY, matW, matH);
  g.fillStyle(lighten(PALETTE.gray, 0.1));
  g.fillRect(matX, matY, matW, Math.round(3 * s));

  // Corner posts
  const postColor = PALETTE.brightRed;
  const postW = Math.round(8 * s);
  const postH = Math.round(60 * s);

  // Left post
  g.fillStyle(postColor);
  g.fillRect(Math.round(10 * s), Math.round(20 * s), postW, postH);
  g.fillStyle(lighten(postColor, 0.3));
  g.fillRect(Math.round(10 * s), Math.round(20 * s), Math.round(3 * s), postH);
  g.fillStyle(darken(postColor, 0.2));
  g.fillRect(
    Math.round(10 * s) + postW - Math.round(2 * s),
    Math.round(20 * s),
    Math.round(2 * s),
    postH
  );

  // Right post
  g.fillStyle(postColor);
  g.fillRect(canvasW - Math.round(18 * s), Math.round(20 * s), postW, postH);
  g.fillStyle(lighten(postColor, 0.3));
  g.fillRect(canvasW - Math.round(18 * s), Math.round(20 * s), Math.round(3 * s), postH);
  g.fillStyle(darken(postColor, 0.2));
  g.fillRect(canvasW - Math.round(12 * s), Math.round(20 * s), Math.round(2 * s), postH);

  // Post caps
  g.fillStyle(PALETTE.gold);
  g.fillRect(Math.round(8 * s), Math.round(16 * s), Math.round(12 * s), Math.round(6 * s));
  g.fillRect(
    canvasW - Math.round(20 * s),
    Math.round(16 * s),
    Math.round(12 * s),
    Math.round(6 * s)
  );
  g.fillStyle(PALETTE.yellow);
  g.fillRect(Math.round(8 * s), Math.round(16 * s), Math.round(12 * s), Math.round(2 * s));
  g.fillRect(
    canvasW - Math.round(20 * s),
    Math.round(16 * s),
    Math.round(12 * s),
    Math.round(2 * s)
  );

  // Ropes (3 levels)
  const ropeY = [Math.round(30 * s), Math.round(45 * s), Math.round(60 * s)];
  ropeY.forEach((y) => {
    g.fillStyle(PALETTE.white);
    g.fillRect(Math.round(18 * s), y, canvasW - Math.round(36 * s), Math.round(3 * s));
    g.fillStyle(lighten(PALETTE.white, 0.2));
    g.fillRect(Math.round(18 * s), y, canvasW - Math.round(36 * s), Math.round(1 * s));
  });

  g.generateTexture("arena_ring", canvasW, canvasH);
  g.destroy();
}

function generateArenaStands(scene: Phaser.Scene): void {
  const s = SCALE;
  const canvasW = Math.round(100 * s);
  const canvasH = Math.round(80 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Tiered seating
  const rowColors = [
    PALETTE.deepPurple,
    darken(PALETTE.deepPurple, 0.1),
    darken(PALETTE.deepPurple, 0.2),
  ];
  const rowH = Math.round(20 * s);

  for (let i = 0; i < 3; i++) {
    const y = i * rowH;
    const xOffset = i * Math.round(5 * s);

    // Row base
    g.fillStyle(rowColors[i]);
    g.fillRect(xOffset, y, canvasW - xOffset * 2, rowH + Math.round(5 * s));

    // Row front edge highlight
    g.fillStyle(lighten(rowColors[i], 0.2));
    g.fillRect(xOffset, y + rowH, canvasW - xOffset * 2, Math.round(3 * s));

    // Silhouette spectators
    const spectatorSpacing = Math.round(12 * s);
    for (
      let x = xOffset + Math.round(8 * s);
      x < canvasW - xOffset - Math.round(8 * s);
      x += spectatorSpacing
    ) {
      // Random variation
      const headY = y + Math.round(5 * s) + (x % 3) * Math.round(2 * s);
      const headSize = Math.round(6 * s) + (x % 2) * Math.round(2 * s);

      // Head
      g.fillStyle(PALETTE.void);
      g.fillRect(x, headY, headSize, headSize);

      // Body hint
      g.fillRect(
        x - Math.round(1 * s),
        headY + headSize,
        headSize + Math.round(2 * s),
        Math.round(8 * s)
      );
    }
  }

  // Railing
  g.fillStyle(PALETTE.silver);
  g.fillRect(0, canvasH - Math.round(5 * s), canvasW, Math.round(5 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(0, canvasH - Math.round(5 * s), canvasW, Math.round(2 * s));

  g.generateTexture("arena_stands", canvasW, canvasH);
  g.destroy();
}

function generateArenaLights(scene: Phaser.Scene): void {
  const s = SCALE;
  const size = Math.round(48 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Light fixture
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(Math.round(18 * s), 0, Math.round(12 * s), Math.round(10 * s));
  g.fillStyle(PALETTE.gray);
  g.fillRect(Math.round(18 * s), 0, Math.round(12 * s), Math.round(3 * s));

  // Light housing
  g.fillStyle(PALETTE.midGray);
  g.fillRect(Math.round(12 * s), Math.round(8 * s), Math.round(24 * s), Math.round(8 * s));
  g.fillStyle(PALETTE.silver);
  g.fillRect(Math.round(12 * s), Math.round(8 * s), Math.round(24 * s), Math.round(2 * s));

  // Light bulb area
  g.fillStyle(PALETTE.yellow);
  g.fillRect(Math.round(14 * s), Math.round(14 * s), Math.round(20 * s), Math.round(6 * s));
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(16 * s), Math.round(15 * s), Math.round(16 * s), Math.round(3 * s));

  // Light beam (downward glow)
  g.fillStyle(PALETTE.yellow, 0.15);
  g.fillRect(Math.round(10 * s), Math.round(20 * s), Math.round(28 * s), Math.round(28 * s));
  g.fillStyle(PALETTE.yellow, 0.1);
  g.fillRect(Math.round(6 * s), Math.round(30 * s), Math.round(36 * s), Math.round(18 * s));

  g.generateTexture("arena_light", size, size);
  g.destroy();
}

function generateHitSpark(scene: Phaser.Scene): void {
  const s = SCALE;
  // Larger impact effect (32x32 base)
  const size = Math.round(32 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const cx = Math.round(16 * s);
  const cy = Math.round(16 * s);

  // === OUTER GLOW (soft red/orange) ===
  g.fillStyle(PALETTE.orange, 0.3);
  g.fillEllipse(cx, cy, Math.round(14 * s), Math.round(14 * s));
  g.fillStyle(PALETTE.brightRed, 0.2);
  g.fillEllipse(cx, cy, Math.round(16 * s), Math.round(16 * s));

  // === STARBURST RAYS ===
  g.fillStyle(PALETTE.orange);
  // Cardinal directions
  g.fillRect(
    cx - Math.round(14 * s),
    cy - Math.round(2 * s),
    Math.round(10 * s),
    Math.round(4 * s)
  );
  g.fillRect(cx + Math.round(4 * s), cy - Math.round(2 * s), Math.round(10 * s), Math.round(4 * s));
  g.fillRect(
    cx - Math.round(2 * s),
    cy - Math.round(14 * s),
    Math.round(4 * s),
    Math.round(10 * s)
  );
  g.fillRect(cx - Math.round(2 * s), cy + Math.round(4 * s), Math.round(4 * s), Math.round(10 * s));
  // Diagonal rays (smaller)
  g.fillRect(
    cx - Math.round(10 * s),
    cy - Math.round(10 * s),
    Math.round(6 * s),
    Math.round(3 * s)
  );
  g.fillRect(cx + Math.round(4 * s), cy - Math.round(10 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(cx - Math.round(10 * s), cy + Math.round(7 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(cx + Math.round(4 * s), cy + Math.round(7 * s), Math.round(6 * s), Math.round(3 * s));

  // === YELLOW INNER BURST ===
  g.fillStyle(PALETTE.yellow);
  g.fillRect(
    cx - Math.round(6 * s),
    cy - Math.round(6 * s),
    Math.round(12 * s),
    Math.round(12 * s)
  );
  // Yellow ray highlights
  g.fillRect(cx - Math.round(12 * s), cy - Math.round(1 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillRect(cx + Math.round(4 * s), cy - Math.round(1 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillRect(cx - Math.round(1 * s), cy - Math.round(12 * s), Math.round(2 * s), Math.round(8 * s));
  g.fillRect(cx - Math.round(1 * s), cy + Math.round(4 * s), Math.round(2 * s), Math.round(8 * s));

  // === WHITE HOT CENTER ===
  g.fillStyle(PALETTE.white);
  g.fillRect(cx - Math.round(4 * s), cy - Math.round(4 * s), Math.round(8 * s), Math.round(8 * s));
  // Extra bright core
  g.fillRect(cx - Math.round(2 * s), cy - Math.round(2 * s), Math.round(4 * s), Math.round(4 * s));

  // === FLYING SPARK PARTICLES ===
  g.fillStyle(PALETTE.yellow);
  // Corner sparks
  g.fillRect(Math.round(2 * s), Math.round(2 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(27 * s), Math.round(3 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(3 * s), Math.round(27 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(26 * s), Math.round(26 * s), Math.round(3 * s), Math.round(3 * s));
  // Mid sparks
  g.fillRect(Math.round(0 * s), Math.round(14 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(30 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(15 * s), Math.round(0 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(30 * s), Math.round(2 * s), Math.round(2 * s));
  // White spark highlights
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(2 * s), Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(27 * s), Math.round(3 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(3 * s), Math.round(27 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(26 * s), Math.round(26 * s), Math.round(1 * s), Math.round(1 * s));

  g.generateTexture("hit_spark", size, size);
  g.destroy();
}

function generateDamageParticle(scene: Phaser.Scene): void {
  const s = SCALE;
  const size = Math.round(8 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Simple red particle for damage numbers
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(0, 0, size, size);

  // Lighter center
  g.fillStyle(PALETTE.red);
  g.fillRect(Math.round(1 * s), Math.round(1 * s), Math.round(6 * s), Math.round(6 * s));

  // Highlight
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillRect(Math.round(1 * s), Math.round(1 * s), Math.round(3 * s), Math.round(3 * s));

  g.generateTexture("damage_particle", size, size);
  g.destroy();
}

// ========================================
// ENHANCED ARENA EFFECTS
// Crowd, spotlights, action bubbles
// ========================================

/**
 * Generate animated crowd sprites for arena stands
 */
function generateArenaCrowd(scene: Phaser.Scene): void {
  const s = SCALE;
  const width = Math.round(16 * s);
  const height = Math.round(20 * s);

  // Crowd colors for variety
  const crowdColors = [0x4b5563, 0x374151, 0x1f2937, 0x3f3f46];

  // Generate idle crowd member (silhouette with small head bump)
  for (let i = 0; i < 4; i++) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const color = crowdColors[i];

    // Body (sitting silhouette)
    g.fillStyle(color);
    g.fillRect(Math.round(3 * s), Math.round(10 * s), Math.round(10 * s), Math.round(10 * s));

    // Head
    g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(6 * s), Math.round(6 * s));

    // Shoulders
    g.fillRect(Math.round(1 * s), Math.round(12 * s), Math.round(14 * s), Math.round(4 * s));

    // Slight highlight for depth
    g.fillStyle(lighten(color, 0.1));
    g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture(`arena_crowd_idle_${i}`, width, height);
    g.destroy();
  }

  // Generate cheer pose 1 (arms up)
  for (let i = 0; i < 4; i++) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const color = crowdColors[i];

    // Body
    g.fillStyle(color);
    g.fillRect(Math.round(3 * s), Math.round(10 * s), Math.round(10 * s), Math.round(10 * s));

    // Head
    g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(6 * s), Math.round(6 * s));

    // Arms raised up (left)
    g.fillRect(Math.round(1 * s), Math.round(2 * s), Math.round(3 * s), Math.round(10 * s));

    // Arms raised up (right)
    g.fillRect(Math.round(12 * s), Math.round(2 * s), Math.round(3 * s), Math.round(10 * s));

    // Highlight
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture(`arena_crowd_cheer1_${i}`, width, height);
    g.destroy();
  }

  // Generate cheer pose 2 (arms angled)
  for (let i = 0; i < 4; i++) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const color = crowdColors[i];

    // Body
    g.fillStyle(color);
    g.fillRect(Math.round(3 * s), Math.round(10 * s), Math.round(10 * s), Math.round(10 * s));

    // Head
    g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(6 * s), Math.round(6 * s));

    // Arms angled out (left - diagonal)
    g.fillRect(Math.round(0 * s), Math.round(6 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(0 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));

    // Arms angled out (right - diagonal)
    g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(14 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));

    // Highlight
    g.fillStyle(lighten(color, 0.15));
    g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture(`arena_crowd_cheer2_${i}`, width, height);
    g.destroy();
  }
}

/**
 * Generate spotlight cone effect
 */
function generateSpotlightCone(scene: Phaser.Scene): void {
  const s = SCALE;
  const width = Math.round(60 * s);
  const height = Math.round(200 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Create gradient cone effect using multiple layers
  const cx = width / 2;

  // Outer glow (very faint)
  g.fillStyle(0xfbbf24, 0.02);
  g.beginPath();
  g.moveTo(cx, 0);
  g.lineTo(0, height);
  g.lineTo(width, height);
  g.closePath();
  g.fillPath();

  // Mid glow
  g.fillStyle(0xfbbf24, 0.05);
  g.beginPath();
  g.moveTo(cx, 0);
  g.lineTo(Math.round(10 * s), height);
  g.lineTo(width - Math.round(10 * s), height);
  g.closePath();
  g.fillPath();

  // Inner glow
  g.fillStyle(0xfde047, 0.08);
  g.beginPath();
  g.moveTo(cx, 0);
  g.lineTo(Math.round(20 * s), height);
  g.lineTo(width - Math.round(20 * s), height);
  g.closePath();
  g.fillPath();

  // Core (brightest center)
  g.fillStyle(0xfef9c3, 0.1);
  g.beginPath();
  g.moveTo(cx, 0);
  g.lineTo(Math.round(25 * s), height);
  g.lineTo(width - Math.round(25 * s), height);
  g.closePath();
  g.fillPath();

  g.generateTexture("arena_spotlight_cone", width, height);
  g.destroy();
}

/**
 * Generate logo mat for ring center
 */
function generateLogoMat(scene: Phaser.Scene): void {
  const s = SCALE;
  const width = Math.round(120 * s);
  const height = Math.round(40 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Mat base (dark gray)
  g.fillStyle(0x374151);
  g.fillRect(0, 0, width, height);

  // Border
  g.fillStyle(0x4b5563);
  g.fillRect(0, 0, width, Math.round(2 * s));
  g.fillRect(0, height - Math.round(2 * s), width, Math.round(2 * s));
  g.fillRect(0, 0, Math.round(2 * s), height);
  g.fillRect(width - Math.round(2 * s), 0, Math.round(2 * s), height);

  // $ symbol in Bags green (centered)
  const dollarX = width / 2 - Math.round(8 * s);
  const dollarY = height / 2 - Math.round(12 * s);
  g.fillStyle(0x22c55e);

  // Top bar of S
  g.fillRect(dollarX + Math.round(2 * s), dollarY, Math.round(12 * s), Math.round(3 * s));
  // Left side top
  g.fillRect(dollarX, dollarY + Math.round(3 * s), Math.round(4 * s), Math.round(5 * s));
  // Middle bar of S
  g.fillRect(
    dollarX + Math.round(2 * s),
    dollarY + Math.round(8 * s),
    Math.round(12 * s),
    Math.round(3 * s)
  );
  // Right side bottom
  g.fillRect(
    dollarX + Math.round(12 * s),
    dollarY + Math.round(11 * s),
    Math.round(4 * s),
    Math.round(5 * s)
  );
  // Bottom bar of S
  g.fillRect(
    dollarX + Math.round(2 * s),
    dollarY + Math.round(16 * s),
    Math.round(12 * s),
    Math.round(3 * s)
  );
  // Vertical line through (the $ stem)
  g.fillStyle(0x4ade80);
  g.fillRect(
    dollarX + Math.round(7 * s),
    dollarY - Math.round(2 * s),
    Math.round(2 * s),
    Math.round(24 * s)
  );

  // Subtle highlight
  g.fillStyle(0x4b5563, 0.5);
  g.fillRect(Math.round(4 * s), Math.round(4 * s), Math.round(30 * s), Math.round(2 * s));

  g.generateTexture("arena_logo_mat", width, height);
  g.destroy();
}

/**
 * Generate colored corner posts for fighter spawn points
 */
function generateCornerPosts(scene: Phaser.Scene): void {
  const s = SCALE;
  const width = Math.round(12 * s);
  const height = Math.round(60 * s);

  // Red corner post
  const gRed = scene.make.graphics({ x: 0, y: 0 });
  // Post structure
  gRed.fillStyle(0x374151);
  gRed.fillRect(Math.round(3 * s), 0, Math.round(6 * s), height);
  // Red padding
  gRed.fillStyle(0xef4444);
  gRed.fillRect(0, Math.round(10 * s), Math.round(12 * s), Math.round(40 * s));
  // Highlight
  gRed.fillStyle(0xf87171);
  gRed.fillRect(0, Math.round(10 * s), Math.round(3 * s), Math.round(40 * s));
  // Shadow
  gRed.fillStyle(0xb91c1c);
  gRed.fillRect(Math.round(9 * s), Math.round(10 * s), Math.round(3 * s), Math.round(40 * s));
  // Gold cap
  gRed.fillStyle(0xfbbf24);
  gRed.fillRect(Math.round(1 * s), Math.round(6 * s), Math.round(10 * s), Math.round(6 * s));

  gRed.generateTexture("arena_corner_red", width, height);
  gRed.destroy();

  // Blue corner post
  const gBlue = scene.make.graphics({ x: 0, y: 0 });
  // Post structure
  gBlue.fillStyle(0x374151);
  gBlue.fillRect(Math.round(3 * s), 0, Math.round(6 * s), height);
  // Blue padding
  gBlue.fillStyle(0x3b82f6);
  gBlue.fillRect(0, Math.round(10 * s), Math.round(12 * s), Math.round(40 * s));
  // Highlight
  gBlue.fillStyle(0x60a5fa);
  gBlue.fillRect(0, Math.round(10 * s), Math.round(3 * s), Math.round(40 * s));
  // Shadow
  gBlue.fillStyle(0x1d4ed8);
  gBlue.fillRect(Math.round(9 * s), Math.round(10 * s), Math.round(3 * s), Math.round(40 * s));
  // Gold cap
  gBlue.fillStyle(0xfbbf24);
  gBlue.fillRect(Math.round(1 * s), Math.round(6 * s), Math.round(10 * s), Math.round(6 * s));

  gBlue.generateTexture("arena_corner_blue", width, height);
  gBlue.destroy();
}

/**
 * Generate comic-style action bubbles for fight effects
 */
function generateActionBubbles(scene: Phaser.Scene): void {
  const s = SCALE;
  const width = Math.round(48 * s);
  const height = Math.round(32 * s);

  // POW! bubble (yellow/orange burst)
  createActionBubble(scene, "action_pow", "POW!", 0xfbbf24, 0xf97316, width, height);

  // BAM! bubble (red burst)
  createActionBubble(scene, "action_bam", "BAM!", 0xef4444, 0xdc2626, width, height);

  // CRITICAL! bubble (purple/gold)
  createActionBubble(scene, "action_critical", "CRIT!", 0xa855f7, 0xfbbf24, width, height);

  // DODGE! bubble (blue/cyan)
  createActionBubble(scene, "action_dodge", "MISS", 0x3b82f6, 0x06b6d4, width, height);
}

/**
 * Helper to create comic-style action bubble
 */
function createActionBubble(
  scene: Phaser.Scene,
  key: string,
  text: string,
  bgColor: number,
  accentColor: number,
  width: number,
  height: number
): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const cx = width / 2;
  const cy = height / 2;

  // Starburst background
  g.fillStyle(accentColor);
  // Horizontal spike
  g.fillRect(0, cy - Math.round(8 * s), width, Math.round(16 * s));
  // Vertical spike
  g.fillRect(cx - Math.round(8 * s), 0, Math.round(16 * s), height);
  // Diagonal spikes
  g.fillRect(Math.round(4 * s), Math.round(4 * s), Math.round(12 * s), Math.round(8 * s));
  g.fillRect(width - Math.round(16 * s), Math.round(4 * s), Math.round(12 * s), Math.round(8 * s));
  g.fillRect(Math.round(4 * s), height - Math.round(12 * s), Math.round(12 * s), Math.round(8 * s));
  g.fillRect(
    width - Math.round(16 * s),
    height - Math.round(12 * s),
    Math.round(12 * s),
    Math.round(8 * s)
  );

  // Main bubble (inner)
  g.fillStyle(bgColor);
  g.fillRect(
    Math.round(6 * s),
    cy - Math.round(6 * s),
    width - Math.round(12 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    cx - Math.round(10 * s),
    Math.round(6 * s),
    Math.round(20 * s),
    height - Math.round(12 * s)
  );

  // White center for text
  g.fillStyle(0xffffff);
  g.fillRect(
    Math.round(10 * s),
    cy - Math.round(4 * s),
    width - Math.round(20 * s),
    Math.round(8 * s)
  );

  // Border outline
  g.fillStyle(0x000000);
  g.fillRect(
    Math.round(8 * s),
    cy - Math.round(7 * s),
    width - Math.round(16 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    Math.round(8 * s),
    cy + Math.round(5 * s),
    width - Math.round(16 * s),
    Math.round(2 * s)
  );

  g.generateTexture(key, width, height);
  g.destroy();
}
