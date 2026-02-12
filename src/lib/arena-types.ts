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

// Database fighter record
export interface ArenaFighter {
  id: number;
  moltbook_username: string;
  moltbook_karma: number;
  hp: number;
  attack: number;
  defense: number;
  wins: number;
  losses: number;
  total_damage_dealt: number;
  total_damage_taken: number;
  last_fight_at: string | null;
  registered_at: string;
  karma_updated_at: string | null;
}

// Database match record
export interface ArenaMatch {
  id: number;
  status: MatchStatus;
  fighter1_id: number;
  fighter1_hp: number | null;
  fighter1_x: number | null;
  fighter1_y: number | null;
  fighter2_id: number;
  fighter2_hp: number | null;
  fighter2_x: number | null;
  fighter2_y: number | null;
  winner_id: number | null;
  total_ticks: number;
  fight_log: CombatEvent[];
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

// Database queue entry
export interface ArenaQueueEntry {
  id: number;
  fighter_id: number;
  moltbook_post_id: string;
  queued_at: string;
}

// Leaderboard entry
export interface ArenaLeaderboardEntry {
  id: number;
  moltbook_username: string;
  wins: number;
  losses: number;
  win_rate: number;
  total_damage_dealt: number;
  moltbook_karma: number;
}

// WebSocket message types
export type ArenaWSMessageType =
  | "connected"
  | "watch_match"
  | "watch_queue"
  | "match_state"
  | "match_update"
  | "queue_update"
  | "active_matches"
  | "error";

// WebSocket message structure
export interface ArenaWSMessage {
  type: ArenaWSMessageType;
  data?:
    | MatchState
    | MatchState[]
    | ArenaQueueEntry[]
    | string
    | {
        activeMatches?: MatchState[];
        queueSize?: number;
      };
  matchId?: number;
  error?: string;
}

// Replay keyframe - compact snapshot of fight state at a point in time
export interface ReplayKeyframe {
  t: number; // tick
  f1: {
    hp: number;
    x: number;
    y: number;
    s: FighterState;
    d: FighterDirection;
  };
  f2: {
    hp: number;
    x: number;
    y: number;
    s: FighterState;
    d: FighterDirection;
  };
  ev?: CombatEvent[]; // events since last keyframe (omitted when empty)
}

// Full fight replay data
export interface FightReplay {
  matchId: number;
  fighter1: {
    id: number;
    username: string;
    maxHp: number;
    spriteVariant: number;
  };
  fighter2: {
    id: number;
    username: string;
    maxHp: number;
    spriteVariant: number;
  };
  keyframes: ReplayKeyframe[];
  winner: string;
  totalTicks: number;
  recordedAt: number;
}

// Capture a keyframe every N ticks (or on events)
export const REPLAY_KEYFRAME_INTERVAL = 5;
// Playback speed: ms between keyframe renders on client
export const REPLAY_PLAYBACK_MS = 100;

// Arena engine configuration
export interface ArenaConfig {
  tickMs: number; // Game loop interval (100ms)
  attackRange: number; // Pixels for melee attack (50)
  attackCooldownTicks: number; // Ticks between attacks (10 = 1 sec)
  moveSpeed: number; // Pixels per tick (3)
  arenaWidth: number; // Combat area width (400)
  arenaHeight: number; // Combat area height (200)
  spawnXLeft: number; // Left fighter spawn X (80)
  spawnXRight: number; // Right fighter spawn X (320)
  groundY: number; // Ground level Y (150)
  damageVariance: number; // Damage randomness factor (0.2 = ±20%)
}

// Default arena configuration
// Tuned for ~30 second cinematic fights
export const ARENA_CONFIG: ArenaConfig = {
  tickMs: 100, // 100ms per tick (10 ticks = 1 second)
  attackRange: 60, // Pixels for melee attack (slightly wider for drama)
  attackCooldownTicks: 15, // 1.5 seconds between attacks (more dramatic pacing)
  moveSpeed: 2, // Slower movement for buildup (2 pixels per tick)
  arenaWidth: 400,
  arenaHeight: 200,
  spawnXLeft: 60, // Start further apart for longer approach
  spawnXRight: 340,
  groundY: 150,
  damageVariance: 0.15, // Slightly less random for consistent pacing
};

// Karma tier thresholds for stat calculation
// Tuned for ~30 second fights with dramatic pacing
export const KARMA_TIERS = {
  tierSize: 100, // Karma per tier
  maxHpBonus: 150, // Max HP bonus from karma (less scaling)
  maxAttackBonus: 30, // Max attack bonus (reduced for longer fights)
  maxDefenseBonus: 15, // Max defense bonus
  baseHp: 150, // Higher base HP for longer fights
  baseAttack: 12, // Slightly higher base attack
  baseDefense: 6, // Balanced defense
  baseSpeed: 15, // Base attack cooldown in ticks (1.5 sec)
};

// Calculate fighter stats from MoltBook karma
// Balanced for ~30 second cinematic fights
export function karmaToStats(karma: number): FighterStats {
  const tier = Math.floor(karma / KARMA_TIERS.tierSize);

  // HP scales well - higher karma = tankier
  const hp = KARMA_TIERS.baseHp + Math.min(tier * 8, KARMA_TIERS.maxHpBonus);
  // Attack scales moderately
  const attack = KARMA_TIERS.baseAttack + Math.min(tier * 1.5, KARMA_TIERS.maxAttackBonus);
  // Defense scales slowly (keeps fights interesting)
  const defense =
    KARMA_TIERS.baseDefense + Math.min(Math.floor(tier * 0.8), KARMA_TIERS.maxDefenseBonus);
  // Speed scales very slowly - min 10 ticks (1 sec) between attacks
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
  const variance = 1 + (Math.random() * 2 - 1) * ARENA_CONFIG.damageVariance; // 0.8 to 1.2
  return Math.max(1, Math.floor(baseDamage * variance));
}

// Generate sprite variant from username (deterministic)
// 18 total variants: 0-8 humans, 9-17 creatures (lobster, crab, octopus, shark, jellyfish, pufferfish, frog, slime, robot)
export function usernameToSpriteVariant(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 18; // 0-17 variants (humans + creatures)
}

// Arena zone visual constants
export const ARENA_VISUAL = {
  // Colors matching existing PALETTE
  floor: 0x374151, // gray
  floorAlt: 0x4b5563, // lighter gray for checkerboard
  ring: 0xa8754b, // brown wood
  ringPlatform: 0x78350f, // dark brown
  cornerPost: 0xef4444, // red
  ropes: 0xffffff, // white
  lightGlow: 0xfde047, // yellow
  lightHousing: 0x1f2937, // dark gray
  crowdSilhouette: 0x6b7280, // medium gray
  titleColor: 0xfbbf24, // gold
  healthBarBg: 0x1f2937, // dark gray
  healthGreen: 0x22c55e,
  healthYellow: 0xfbbf24,
  healthRed: 0xef4444,
  damageText: 0xef4444, // red
  winnerText: 0xfbbf24, // gold
  sparkWhite: 0xffffff,
  sparkYellow: 0xfde047,
};

// Depth layers for arena zone (matching existing system)
export const ARENA_DEPTH = {
  floor: 0,
  stands: 1,
  ring: 2,
  fighters: 10,
  effects: 11,
  lightBeams: 14,
  lights: 15,
  healthBars: 100,
  damageNumbers: 101,
  winnerAnnouncement: 102,
};
