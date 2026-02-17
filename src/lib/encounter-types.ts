// Wild Encounter Types
// Turn-based Pokemon Crystal-style battles with roaming creatures

export type BattleAction = "fight" | "defend" | "flee";
export type BattlePhase = "intro" | "player_turn" | "creature_turn" | "animating" | "result";
export type BattleResult = "win" | "lose" | "flee";
export type CreatureZone = "main_city" | "founders" | "moltbook";
export type MoveType = "normal" | "fire" | "water" | "grass" | "bug" | "flying" | "aquatic" | "buff" | "debuff";
export type StatusEffect = "burn" | null;

export interface Move {
  name: string;
  type: MoveType;
  power: number; // 0 for status moves
  accuracy: number; // 0-100
  pp: number;
  maxPp: number;
  effect?: "burn" | "def_up" | "def_down" | "spd_down" | "priority" | "leech";
  effectChance?: number; // 0-100, for secondary effects like burn
  animation: "slash" | "ember" | "water" | "gust" | "bite" | "shimmer" | "debuff" | "quick";
}

export interface StatStages {
  defense: number; // -6 to +6
  speed: number; // -6 to +6
}

export interface CreatureStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface Creature {
  id: string;
  name: string;
  type: string;
  zone: CreatureZone;
  level: number;
  stats: CreatureStats;
  moves: Move[];
  spriteKey: string; // Fallback Phaser texture key
  spriteUrl?: string; // Fal.ai generated URL
}

export interface PlayerBattleStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  moves: Move[];
}

export interface BattleLogEntry {
  message: string;
  type: "info" | "player_attack" | "creature_attack" | "player_defend" | "creature_defend" | "flee" | "result" | "stat_change" | "status_damage" | "effectiveness";
  damage?: number;
  moveAnimation?: Move["animation"];
  timestamp: number;
}

export interface EncounterState {
  phase: BattlePhase;
  creature: Creature;
  player: PlayerBattleStats;
  creatureHp: number;
  playerHp: number;
  turnNumber: number;
  playerStages: StatStages;
  creatureStages: StatStages;
  playerDefending: boolean; // True for exactly one enemy hit, then resets
  creatureDefending: boolean;
  playerStatus: StatusEffect;
  creatureStatus: StatusEffect;
  battleLog: BattleLogEntry[];
  result: BattleResult | null;
  xpGained: number;
  lastMoveUsed?: Move; // For animation purposes
  creatureGoesFirst?: boolean; // Speed-based turn order for the overlay
}

export interface PlayerProgress {
  xp: number;
  level: number;
  wins: number;
  losses: number;
  flees: number;
}

// Player stats per level
export const PLAYER_LEVEL_STATS: Record<number, { hp: number; attack: number; defense: number; speed: number; xpNeeded: number }> = {
  1: { hp: 100, attack: 15, defense: 12, speed: 14, xpNeeded: 0 },
  2: { hp: 130, attack: 18, defense: 15, speed: 16, xpNeeded: 100 },
  3: { hp: 165, attack: 22, defense: 18, speed: 19, xpNeeded: 300 },
  4: { hp: 200, attack: 26, defense: 22, speed: 22, xpNeeded: 600 },
  5: { hp: 250, attack: 30, defense: 26, speed: 26, xpNeeded: 1000 },
};

export const MAX_PLAYER_LEVEL = 5;

// Zone difficulty ranges
export const ZONE_DIFFICULTY: Record<CreatureZone, { minLevel: number; maxLevel: number }> = {
  main_city: { minLevel: 1, maxLevel: 2 },
  founders: { minLevel: 2, maxLevel: 3 },
  moltbook: { minLevel: 2, maxLevel: 3 },
};

// Struggle — used when all moves are at 0 PP
export const STRUGGLE_MOVE: Move = {
  name: "Struggle", type: "normal", power: 50, accuracy: 100, pp: 999, maxPp: 999, animation: "slash",
};

// Player starter moves
export const PLAYER_MOVES: Move[] = [
  { name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
  { name: "Ember", type: "fire", power: 40, accuracy: 100, pp: 25, maxPp: 25, effect: "burn", effectChance: 10, animation: "ember" },
  { name: "Harden", type: "buff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_up", animation: "shimmer" },
  { name: "Quick Strike", type: "normal", power: 30, accuracy: 100, pp: 30, maxPp: 30, effect: "priority", animation: "quick" },
];

// Stat stage multiplier (Pokemon standard)
export function getStatMultiplier(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  if (clamped >= 0) return (2 + clamped) / 2;
  return 2 / (2 - clamped);
}

// ========== TYPE EFFECTIVENESS ==========
// Simplified chart covering our move types vs creature types
// Only offensive types matter: normal, fire, water, grass, bug, flying, aquatic
// Defensive types: fire, water, grass, beast, bug, flying, aquatic, normal

type OffensiveType = "normal" | "fire" | "water" | "grass" | "bug" | "flying" | "aquatic";
type DefensiveType = string; // creature.type

const TYPE_CHART: Partial<Record<OffensiveType, Partial<Record<DefensiveType, number>>>> = {
  fire:    { grass: 2, water: 0.5, fire: 0.5, bug: 2, aquatic: 0.5 },
  water:   { fire: 2, grass: 0.5, water: 0.5, aquatic: 0.5 },
  grass:   { water: 2, fire: 0.5, grass: 0.5, bug: 0.5, aquatic: 2 },
  bug:     { grass: 2, fire: 0.5, flying: 0.5 },
  flying:  { bug: 2, grass: 2, beast: 1 },
  aquatic: { fire: 2, grass: 0.5, aquatic: 0.5 },
  // normal: no super-effective or not-very-effective matchups
};

/** Returns the type effectiveness multiplier (0.5, 1, or 2). buff/debuff types always return 1. */
export function getTypeEffectiveness(moveType: MoveType, defenderType: string): number {
  if (moveType === "buff" || moveType === "debuff") return 1;
  const matchups = TYPE_CHART[moveType as OffensiveType];
  if (!matchups) return 1;
  return matchups[defenderType] ?? 1;
}

/** Returns the STAB multiplier (1.5 if move type matches attacker type, else 1). */
export function getStabMultiplier(moveType: MoveType, attackerType: string): number {
  if (moveType === "buff" || moveType === "debuff") return 1;
  return moveType === attackerType ? 1.5 : 1;
}
