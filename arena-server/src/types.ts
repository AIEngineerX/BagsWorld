// MoltBook Arena Types
// Real-time brawl system for AI agents

// Fighter state during combat
export type FighterState = "idle" | "walking" | "attacking" | "hurt" | "knockout";

// Direction fighter is facing
export type FighterDirection = "left" | "right";

// Match lifecycle status
export type MatchStatus = "waiting" | "active" | "completed" | "cancelled";

// Combat event types
export type CombatEventType = "damage" | "ko" | "move" | "match_start" | "match_end";

// Fighter combat stats derived from MoltBook karma
export interface FighterStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number; // Attack cooldown in ticks (lower = faster)
}

// Fighter position and state during a match
export interface Fighter {
  id: number;
  username: string;
  karma: number;
  stats: FighterStats;
  x: number;
  y: number;
  state: FighterState;
  direction: FighterDirection;
  lastAttackTick: number;
  lastHurtTick: number;
  spriteVariant: number; // 0-17 for character sprite variants
}

// Combat event emitted during battle
export interface CombatEvent {
  tick: number;
  type: CombatEventType;
  attacker?: string;
  defender?: string;
  damage?: number;
  x?: number;
  y?: number;
  message?: string;
}

// Full match state broadcast via WebSocket
export interface MatchState {
  matchId: number;
  status: MatchStatus;
  tick: number;
  fighter1: Fighter;
  fighter2: Fighter;
  events: CombatEvent[];
  winner?: string;
  startedAt?: number;
  endedAt?: number;
}

// Queued fighter waiting for match
export interface QueuedFighter {
  odid: number;
  username: string;
  karma: number;
  joinedAt: number;
  ws: import("ws").WebSocket;
}

// Arena engine configuration
export interface ArenaConfig {
  tickMs: number;
  attackRange: number;
  attackCooldownTicks: number;
  moveSpeed: number;
  arenaWidth: number;
  arenaHeight: number;
  spawnXLeft: number;
  spawnXRight: number;
  groundY: number;
  damageVariance: number;
}

// Default arena configuration - tuned for ~30 second fights
export const ARENA_CONFIG: ArenaConfig = {
  tickMs: 100, // 100ms per tick (10 ticks = 1 second)
  attackRange: 60,
  attackCooldownTicks: 15, // 1.5 seconds between attacks
  moveSpeed: 2, // 2 pixels per tick
  arenaWidth: 400,
  arenaHeight: 200,
  spawnXLeft: 60,
  spawnXRight: 340,
  groundY: 150,
  damageVariance: 0.15,
};

// Karma tier thresholds for stat calculation
export const KARMA_TIERS = {
  tierSize: 100,
  maxHpBonus: 150,
  maxAttackBonus: 30,
  maxDefenseBonus: 15,
  baseHp: 150,
  baseAttack: 12,
  baseDefense: 6,
  baseSpeed: 15,
};

// Calculate fighter stats from MoltBook karma
export function karmaToStats(karma: number): FighterStats {
  const tier = Math.floor(karma / KARMA_TIERS.tierSize);

  const hp = KARMA_TIERS.baseHp + Math.min(tier * 8, KARMA_TIERS.maxHpBonus);
  const attack = KARMA_TIERS.baseAttack + Math.min(tier * 1.5, KARMA_TIERS.maxAttackBonus);
  const defense = KARMA_TIERS.baseDefense + Math.min(Math.floor(tier * 0.8), KARMA_TIERS.maxDefenseBonus);
  const speed = Math.max(10, KARMA_TIERS.baseSpeed - Math.floor(tier / 3));

  return {
    hp,
    maxHp: hp,
    attack,
    defense,
    speed,
  };
}

// Calculate damage with variance
export function calculateDamage(attackerAttack: number, defenderDefense: number): number {
  const baseDamage = attackerAttack - defenderDefense;
  const variance = 1 + (Math.random() * 2 - 1) * ARENA_CONFIG.damageVariance;
  return Math.max(1, Math.floor(baseDamage * variance));
}

// Generate sprite variant from username (deterministic)
export function usernameToSpriteVariant(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 18; // 0-17 variants
}

// WebSocket message types
export type WSMessageType =
  | "connected"
  | "join_queue"
  | "leave_queue"
  | "queue_status"
  | "match_start"
  | "match_update"
  | "match_end"
  | "error";

// Client -> Server messages
export interface ClientMessage {
  type: "join_queue" | "leave_queue";
  username?: string;
  karma?: number;
}

// Queue status data
export interface QueueStatus {
  position: number;
  size: number;
  queue?: { position: number; username: string; karma: number }[];
}

// Server -> Client messages
export interface ServerMessage {
  type: WSMessageType;
  data?: MatchState | QueueStatus | string;
  error?: string;
}
