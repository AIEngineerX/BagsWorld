import {
  type EnemyType,
  type PickupType,
  type PropType,
  type DecorationSpawn,
  TILE_SIZE,
  GROUND_Y,
  SECTIONS,
  LEVEL_WIDTH,
  SECTION_THEMES,
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
  decorations: DecorationSpawn[];
}

/** Ground platforms per section, using section-specific ground textures */
export function getGroundPlatforms(): PlatformData[] {
  const tilesPerSection = Math.ceil(800 / TILE_SIZE);
  return SECTIONS.map((sectionX, i) => ({
    x: sectionX,
    y: GROUND_Y,
    width: tilesPerSection,
    texture: SECTION_THEMES[i]?.ground ?? "ground_concrete",
  }));
}

/** Returns layout data for a given section (0-5) with progressive difficulty */
export function getSectionData(section: number): SectionData {
  const base = SECTIONS[section] ?? section * 800;

  switch (section) {
    // Section 0: Tutorial — Street scene: lamp posts, traffic cones, road signs, dumpster
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
        decorations: [
          { x: base + 40, y: GROUND_Y, type: "lamp_post" },
          { x: base + 120, y: GROUND_Y, type: "traffic_cone" },
          { x: base + 150, y: GROUND_Y, type: "traffic_cone" },
          { x: base + 200, y: GROUND_Y, type: "road_sign" },
          { x: base + 280, y: GROUND_Y, type: "dumpster" },
          { x: base + 340, y: GROUND_Y, type: "lamp_post" },
          { x: base + 380, y: GROUND_Y, type: "barrel" },
          { x: base + 420, y: GROUND_Y, type: "traffic_cone" },
          { x: base + 480, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 530, y: GROUND_Y, type: "road_sign" },
          { x: base + 560, y: GROUND_Y, type: "barrel" },
          { x: base + 620, y: GROUND_Y, type: "lamp_post" },
          { x: base + 650, y: GROUND_Y, type: "traffic_cone" },
          { x: base + 700, y: GROUND_Y, type: "dumpster" },
          { x: base + 740, y: GROUND_Y, type: "traffic_cone" },
          { x: base + 760, y: GROUND_Y, type: "lamp_post" },
          { x: base + 100, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 500, y: GROUND_Y, type: "barrel" },
        ],
      };

    // Section 1: Military outpost — sandbags near turrets, barrels, barbed wire
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
        decorations: [
          { x: base + 30, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 50, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 90, y: GROUND_Y, type: "barrel" },
          { x: base + 160, y: GROUND_Y, type: "barbed_wire" },
          { x: base + 220, y: GROUND_Y, type: "oil_drum" },
          { x: base + 260, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 280, y: GROUND_Y, type: "barrel" },
          { x: base + 350, y: GROUND_Y, type: "barbed_wire" },
          { x: base + 420, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 460, y: GROUND_Y, type: "barrel" },
          { x: base + 500, y: GROUND_Y, type: "barbed_wire" },
          { x: base + 580, y: GROUND_Y, type: "oil_drum" },
          { x: base + 620, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 650, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 680, y: GROUND_Y, type: "barrel" },
          { x: base + 740, y: GROUND_Y, type: "barbed_wire" },
          { x: base + 760, y: GROUND_Y, type: "oil_drum" },
          { x: base + 140, y: GROUND_Y, type: "barrel" },
          { x: base + 380, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 700, y: GROUND_Y, type: "sandbag_stack" },
        ],
      };

    // Section 2: Urban warzone — rubble, broken fences, oil drums, wrecked cars
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
        decorations: [
          { x: base + 30, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 60, y: GROUND_Y, type: "broken_fence" },
          { x: base + 100, y: GROUND_Y, type: "oil_drum" },
          { x: base + 130, y: GROUND_Y, type: "wrecked_car" },
          { x: base + 200, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 240, y: GROUND_Y, type: "broken_fence" },
          { x: base + 300, y: GROUND_Y, type: "oil_drum" },
          { x: base + 330, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 370, y: GROUND_Y, type: "barrel" },
          { x: base + 430, y: GROUND_Y, type: "broken_fence" },
          { x: base + 470, y: GROUND_Y, type: "wrecked_car" },
          { x: base + 510, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 560, y: GROUND_Y, type: "oil_drum" },
          { x: base + 600, y: GROUND_Y, type: "broken_fence" },
          { x: base + 630, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 680, y: GROUND_Y, type: "oil_drum" },
          { x: base + 710, y: GROUND_Y, type: "wrecked_car" },
          { x: base + 740, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 770, y: GROUND_Y, type: "broken_fence" },
          { x: base + 160, y: GROUND_Y, type: "barrel" },
          { x: base + 490, y: GROUND_Y, type: "barrel" },
          { x: base + 80, y: GROUND_Y, type: "rubble_pile" },
        ],
      };

    // Section 3: Industrial zone — oil drums clustered, barbed wire, lamp posts, terminals
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
        decorations: [
          { x: base + 30, y: GROUND_Y, type: "oil_drum" },
          { x: base + 50, y: GROUND_Y, type: "oil_drum" },
          { x: base + 70, y: GROUND_Y, type: "oil_drum" },
          { x: base + 120, y: GROUND_Y, type: "lamp_post" },
          { x: base + 180, y: GROUND_Y, type: "barbed_wire" },
          { x: base + 220, y: GROUND_Y, type: "computer_terminal" },
          { x: base + 300, y: GROUND_Y, type: "lamp_post" },
          { x: base + 340, y: GROUND_Y, type: "oil_drum" },
          { x: base + 380, y: GROUND_Y, type: "barbed_wire" },
          { x: base + 440, y: GROUND_Y, type: "computer_terminal" },
          { x: base + 480, y: GROUND_Y, type: "oil_drum" },
          { x: base + 520, y: GROUND_Y, type: "lamp_post" },
          { x: base + 560, y: GROUND_Y, type: "barbed_wire" },
          { x: base + 610, y: GROUND_Y, type: "oil_drum" },
          { x: base + 640, y: GROUND_Y, type: "computer_terminal" },
          { x: base + 680, y: GROUND_Y, type: "lamp_post" },
          { x: base + 750, y: GROUND_Y, type: "oil_drum" },
          { x: base + 770, y: GROUND_Y, type: "oil_drum" },
          { x: base + 260, y: GROUND_Y, type: "barrel" },
          { x: base + 580, y: GROUND_Y, type: "barrel" },
        ],
      };

    // Section 4: Dense battlefield — sandbag formations, rubble, wrecked cars
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
        decorations: [
          { x: base + 30, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 50, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 70, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 110, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 140, y: GROUND_Y, type: "wrecked_car" },
          { x: base + 190, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 230, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 250, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 310, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 340, y: GROUND_Y, type: "broken_fence" },
          { x: base + 380, y: GROUND_Y, type: "wrecked_car" },
          { x: base + 420, y: GROUND_Y, type: "oil_drum" },
          { x: base + 460, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 500, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 520, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 570, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 610, y: GROUND_Y, type: "wrecked_car" },
          { x: base + 660, y: GROUND_Y, type: "broken_fence" },
          { x: base + 690, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 720, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 740, y: GROUND_Y, type: "sandbag_stack" },
          { x: base + 760, y: GROUND_Y, type: "oil_drum" },
          { x: base + 780, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 200, y: GROUND_Y, type: "barrel" },
          { x: base + 540, y: GROUND_Y, type: "barrel" },
        ],
      };

    // Section 5: Boss arena — sparse boundary: rubble at edges, broken fences, lamp posts
    case 5:
      return {
        platforms: [],
        enemies: [{ x: base + 600, y: GROUND_Y - 64, type: "boss", facing: "left" }],
        pickups: [{ x: base + 200, y: GROUND_Y - 40, type: "health" }],
        decorations: [
          { x: base + 20, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 50, y: GROUND_Y, type: "broken_fence" },
          { x: base + 100, y: GROUND_Y, type: "lamp_post" },
          { x: base + 150, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 300, y: GROUND_Y, type: "lamp_post" },
          { x: base + 500, y: GROUND_Y, type: "lamp_post" },
          { x: base + 700, y: GROUND_Y, type: "broken_fence" },
          { x: base + 730, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 760, y: GROUND_Y, type: "lamp_post" },
          { x: base + 780, y: GROUND_Y, type: "rubble_pile" },
          { x: base + 400, y: GROUND_Y, type: "oil_drum" },
          { x: base + 250, y: GROUND_Y, type: "rubble_pile" },
        ],
      };

    default:
      return { platforms: [], enemies: [], pickups: [], decorations: [] };
  }
}
