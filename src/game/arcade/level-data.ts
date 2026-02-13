import {
  type EnemyType,
  type PickupType,
  TILE_SIZE,
  GROUND_Y,
  SECTIONS,
  LEVEL_WIDTH,
} from "./types";

export interface PlatformData {
  x: number;
  y: number;
  width: number; // in tiles
  texture: string;
}

export interface EnemySpawn {
  x: number;
  y: number;
  type: EnemyType;
  facing?: "left" | "right";
  patrolRange?: number;
}

export interface PickupSpawn {
  x: number;
  y: number;
  type: PickupType;
}

export interface SectionData {
  platforms: PlatformData[];
  enemies: EnemySpawn[];
  pickups: PickupSpawn[];
}

/** Ground platforms that span the full level width */
export function getGroundPlatforms(): PlatformData[] {
  const tilesWide = Math.ceil(LEVEL_WIDTH / TILE_SIZE);
  return [
    {
      x: 0,
      y: GROUND_Y,
      width: tilesWide,
      texture: "platform_metal",
    },
  ];
}

/** Returns layout data for a given section (0-5) with progressive difficulty */
export function getSectionData(section: number): SectionData {
  const base = SECTIONS[section] ?? section * 800;

  switch (section) {
    // Section 0: Tutorial — flat ground, few soldiers, first pickups
    case 0:
      return {
        platforms: [],
        enemies: [
          { x: base + 250, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 60 },
          { x: base + 450, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 80 },
          { x: base + 680, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 70 },
        ],
        pickups: [
          { x: base + 400, y: GROUND_Y - 40, type: "spread" },
          { x: base + 600, y: GROUND_Y - 40, type: "health" },
        ],
      };

    // Section 1: Platforms — elevated platforms, turrets, more soldiers
    case 1:
      return {
        platforms: [
          { x: base + 100, y: 180, width: 5, texture: "platform_wood" },
          { x: base + 300, y: 160, width: 4, texture: "platform_wood" },
          { x: base + 520, y: 180, width: 6, texture: "platform_metal" },
          { x: base + 700, y: 160, width: 3, texture: "platform_wood" },
        ],
        enemies: [
          { x: base + 130, y: 180 - 24, type: "turret", facing: "left" },
          { x: base + 560, y: 180 - 24, type: "turret", facing: "left" },
          { x: base + 200, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 100 },
          { x: base + 400, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 80 },
          { x: base + 550, y: GROUND_Y - 32, type: "soldier", facing: "right", patrolRange: 90 },
          { x: base + 720, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 60 },
        ],
        pickups: [{ x: base + 400, y: GROUND_Y - 40, type: "heavy" }],
      };

    // Section 2: Heavy combat — mixed platforms, heavies, destructible crates
    case 2:
      return {
        platforms: [
          { x: base + 150, y: 190, width: 4, texture: "platform_metal" },
          { x: base + 400, y: 170, width: 5, texture: "platform_metal" },
          { x: base + 650, y: 185, width: 4, texture: "platform_wood" },
        ],
        enemies: [
          { x: base + 180, y: GROUND_Y - 32, type: "heavy", facing: "left", patrolRange: 80 },
          { x: base + 550, y: GROUND_Y - 32, type: "heavy", facing: "left", patrolRange: 100 },
          { x: base + 250, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 60 },
          { x: base + 420, y: 170 - 32, type: "soldier", facing: "right", patrolRange: 40 },
          { x: base + 650, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 80 },
          { x: base + 750, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 50 },
        ],
        pickups: [{ x: base + 450, y: 170 - 30, type: "health" }],
      };

    // Section 3: Vertical — multi-level platforms, soldiers and turrets at height
    case 3:
      return {
        platforms: [
          { x: base + 80, y: 200, width: 5, texture: "platform_wood" },
          { x: base + 250, y: 160, width: 4, texture: "platform_metal" },
          { x: base + 420, y: 120, width: 5, texture: "platform_metal" },
          { x: base + 600, y: 140, width: 4, texture: "platform_wood" },
          { x: base + 350, y: 200, width: 3, texture: "platform_wood" },
          { x: base + 700, y: 190, width: 4, texture: "platform_metal" },
        ],
        enemies: [
          { x: base + 280, y: 160 - 24, type: "turret", facing: "left" },
          { x: base + 450, y: 120 - 32, type: "soldier", facing: "left", patrolRange: 40 },
          { x: base + 620, y: 140 - 32, type: "soldier", facing: "right", patrolRange: 50 },
          { x: base + 150, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 80 },
          { x: base + 500, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 100 },
          { x: base + 730, y: 190 - 24, type: "turret", facing: "left" },
        ],
        pickups: [{ x: base + 460, y: 120 - 30, type: "grenade" }],
      };

    // Section 4: Boss approach — intense mix of all enemy types
    case 4:
      return {
        platforms: [
          { x: base + 120, y: 185, width: 4, texture: "platform_metal" },
          { x: base + 350, y: 170, width: 5, texture: "platform_metal" },
          { x: base + 600, y: 190, width: 4, texture: "platform_metal" },
        ],
        enemies: [
          { x: base + 100, y: GROUND_Y - 32, type: "heavy", facing: "left", patrolRange: 80 },
          { x: base + 350, y: GROUND_Y - 32, type: "heavy", facing: "left", patrolRange: 100 },
          { x: base + 650, y: GROUND_Y - 32, type: "heavy", facing: "left", patrolRange: 60 },
          { x: base + 150, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 70 },
          { x: base + 280, y: GROUND_Y - 32, type: "soldier", facing: "right", patrolRange: 60 },
          { x: base + 450, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 90 },
          { x: base + 550, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 50 },
          { x: base + 700, y: GROUND_Y - 32, type: "soldier", facing: "right", patrolRange: 80 },
          { x: base + 750, y: GROUND_Y - 32, type: "soldier", facing: "left", patrolRange: 60 },
          { x: base + 160, y: 185 - 24, type: "turret", facing: "left" },
          { x: base + 620, y: 190 - 24, type: "turret", facing: "left" },
        ],
        pickups: [
          { x: base + 300, y: GROUND_Y - 40, type: "spread" },
          { x: base + 500, y: GROUND_Y - 40, type: "health" },
        ],
      };

    // Section 5: Boss arena — flat ground, boss spawn, health pickup
    case 5:
      return {
        platforms: [],
        enemies: [{ x: base + 600, y: GROUND_Y - 64, type: "boss", facing: "left" }],
        pickups: [{ x: base + 200, y: GROUND_Y - 40, type: "health" }],
      };

    default:
      return { platforms: [], enemies: [], pickups: [] };
  }
}
