export const ARCADE_WIDTH = 480;
export const ARCADE_HEIGHT = 270;

export const GROUND_Y = 240; // Ground level in arcade space
export const LEVEL_WIDTH = 4800; // 10 screens wide

export const SECTIONS = [0, 800, 1600, 2400, 3200, 4000] as const;

export type ArcadeCharacter = "ghost" | "neo" | "cj";

export interface CharacterStats {
  name: string;
  speed: number;
  fireRate: number; // ms between shots
  maxHP: number;
  jumpForce: number;
  color: number; // Primary color for sprite
  secondaryColor: number;
  skinColor: number;
}

export const CHARACTER_STATS: Record<ArcadeCharacter, CharacterStats> = {
  ghost: {
    name: "Ghost",
    speed: 150,
    fireRate: 250,
    maxHP: 5,
    jumpForce: -320,
    color: 0x2d1b4e, // Dark hoodie
    secondaryColor: 0x9945ff, // Purple ghost logo
    skinColor: 0xffdbac,
  },
  neo: {
    name: "Neo",
    speed: 180,
    fireRate: 300,
    maxHP: 4,
    jumpForce: -350,
    color: 0x111111, // Black trench coat
    secondaryColor: 0x22c55e, // Green tint
    skinColor: 0xf1c27d,
  },
  cj: {
    name: "CJ",
    speed: 128,
    fireRate: 180,
    maxHP: 6,
    jumpForce: -290,
    color: 0xffffff, // White tank top
    secondaryColor: 0xfbbf24, // Gold chain
    skinColor: 0x8d5524,
  },
};

export type WeaponType = "pistol" | "spread" | "heavy";

export interface WeaponInfo {
  name: string;
  damage: number;
  bulletSpeed: number;
  ammo: number; // -1 = infinite
  spread: number; // Number of bullets per shot
  color: number;
}

export const WEAPONS: Record<WeaponType, WeaponInfo> = {
  pistol: {
    name: "Pistol",
    damage: 1,
    bulletSpeed: 400,
    ammo: -1,
    spread: 1,
    color: 0xfde047,
  },
  spread: {
    name: "Spread",
    damage: 1,
    bulletSpeed: 350,
    ammo: 30,
    spread: 3,
    color: 0xef4444,
  },
  heavy: {
    name: "Heavy MG",
    damage: 2,
    bulletSpeed: 500,
    ammo: 50,
    spread: 1,
    color: 0x3b82f6,
  },
};

export type EnemyType = "soldier" | "heavy" | "turret" | "boss";

export interface EnemyStats {
  hp: number;
  speed: number;
  damage: number;
  fireRate: number;
  score: number;
  width: number;
  height: number;
}

export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  soldier: { hp: 2, speed: 40, damage: 1, fireRate: 1500, score: 100, width: 24, height: 32 },
  heavy: { hp: 5, speed: 20, damage: 2, fireRate: 2000, score: 300, width: 32, height: 32 },
  turret: { hp: 3, speed: 0, damage: 1, fireRate: 800, score: 200, width: 24, height: 24 },
  boss: { hp: 50, speed: 15, damage: 3, fireRate: 1000, score: 5000, width: 64, height: 64 },
};

export type PickupType = "spread" | "heavy" | "health" | "grenade";

export interface PickupInfo {
  weapon?: WeaponType;
  healAmount?: number;
  grenades?: number;
  color: number;
  label: string;
}

export const PICKUPS: Record<PickupType, PickupInfo> = {
  spread: { weapon: "spread", color: 0xef4444, label: "S" },
  heavy: { weapon: "heavy", color: 0x3b82f6, label: "H" },
  health: { healAmount: 2, color: 0x22c55e, label: "+" },
  grenade: { grenades: 3, color: 0xf97316, label: "G" },
};

export const STARTING_LIVES = 3;
export const STARTING_GRENADES = 3;
export const GRENADE_DAMAGE = 5;
export const INVINCIBILITY_TIME = 1500; // ms after being hit

export const TILE_SIZE = 16;

/** HUD event data emitted from ArcadeGameScene */
export interface HUDData {
  hp: number;
  maxHP: number;
  score: number;
  lives: number;
  weapon: WeaponType;
  ammo: number;
  grenades: number;
  bossHP: number;
  bossMaxHP: number;
  character: ArcadeCharacter;
}
