// Wild Encounter Types
// Turn-based Pokemon-style battles with roaming creatures

export type BattleAction = "attack" | "defend" | "flee";
export type CreatureAction = "attack" | "defend" | "special";
export type BattlePhase = "intro" | "player_turn" | "creature_turn" | "animating" | "result";
export type BattleResult = "win" | "lose" | "flee";
export type CreatureZone = "main_city" | "founders" | "moltbook";

export interface CreatureStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
}

export interface Creature {
  id: string;
  name: string;
  type: string;
  zone: CreatureZone;
  level: number;
  stats: CreatureStats;
  spriteKey: string; // Fallback Phaser texture key
  spriteUrl?: string; // Fal.ai generated URL
}

export interface PlayerBattleStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  level: number;
}

export interface BattleLogEntry {
  message: string;
  type: "info" | "player_attack" | "creature_attack" | "player_defend" | "creature_defend" | "flee" | "result";
  damage?: number;
  timestamp: number;
}

export interface EncounterState {
  phase: BattlePhase;
  creature: Creature;
  player: PlayerBattleStats;
  creatureHp: number;
  playerHp: number;
  turnNumber: number;
  playerDefending: boolean;
  creatureDefending: boolean;
  battleLog: BattleLogEntry[];
  result: BattleResult | null;
  xpGained: number;
}

export interface PlayerProgress {
  xp: number;
  level: number;
  wins: number;
  losses: number;
  flees: number;
}

// Player stats per level
export const PLAYER_LEVEL_STATS: Record<number, { hp: number; attack: number; defense: number; xpNeeded: number }> = {
  1: { hp: 100, attack: 12, defense: 5, xpNeeded: 0 },
  2: { hp: 130, attack: 15, defense: 7, xpNeeded: 100 },
  3: { hp: 165, attack: 19, defense: 9, xpNeeded: 300 },
  4: { hp: 200, attack: 23, defense: 12, xpNeeded: 600 },
  5: { hp: 250, attack: 28, defense: 15, xpNeeded: 1000 },
};

export const MAX_PLAYER_LEVEL = 5;

// Zone difficulty ranges
export const ZONE_DIFFICULTY: Record<CreatureZone, { minLevel: number; maxLevel: number }> = {
  main_city: { minLevel: 1, maxLevel: 2 },
  founders: { minLevel: 2, maxLevel: 3 },
  moltbook: { minLevel: 2, maxLevel: 3 },
};
