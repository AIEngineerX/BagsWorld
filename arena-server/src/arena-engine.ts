// Arena Engine - Real-time combat game loop
// Runs at 100ms ticks, resolves auto-battle combat between fighters

import {
  Fighter,
  MatchState,
  CombatEvent,
  ARENA_CONFIG,
  karmaToStats,
  calculateDamage,
  usernameToSpriteVariant,
} from "./types";

// Active match tracking
interface ActiveMatch {
  state: MatchState;
  damageDealt1: number;
  damageDealt2: number;
}

// Match update callback
type MatchUpdateCallback = (state: MatchState) => void;

export class ArenaEngine {
  private matches: Map<number, ActiveMatch> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private onUpdate: MatchUpdateCallback | null = null;
  private nextMatchId = 1;

  constructor() {}

  // Start the game loop
  start(onUpdate: MatchUpdateCallback): void {
    if (this.isRunning) {
      console.log("[ArenaEngine] Already running");
      return;
    }

    this.onUpdate = onUpdate;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), ARENA_CONFIG.tickMs);
    console.log(`[ArenaEngine] Started at ${ARENA_CONFIG.tickMs}ms tick rate`);
  }

  // Stop the game loop
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[ArenaEngine] Stopped");
  }

  // Create a new match between two fighters
  createMatch(
    fighter1Data: { id: number; username: string; karma: number },
    fighter2Data: { id: number; username: string; karma: number }
  ): MatchState {
    const matchId = this.nextMatchId++;

    const stats1 = karmaToStats(fighter1Data.karma);
    const stats2 = karmaToStats(fighter2Data.karma);

    const fighter1: Fighter = {
      id: fighter1Data.id,
      username: fighter1Data.username,
      karma: fighter1Data.karma,
      stats: stats1,
      x: ARENA_CONFIG.spawnXLeft,
      y: ARENA_CONFIG.groundY,
      state: "idle",
      direction: "right",
      lastAttackTick: -ARENA_CONFIG.attackCooldownTicks,
      lastHurtTick: -10,
      spriteVariant: usernameToSpriteVariant(fighter1Data.username),
    };

    const fighter2: Fighter = {
      id: fighter2Data.id,
      username: fighter2Data.username,
      karma: fighter2Data.karma,
      stats: stats2,
      x: ARENA_CONFIG.spawnXRight,
      y: ARENA_CONFIG.groundY,
      state: "idle",
      direction: "left",
      lastAttackTick: -ARENA_CONFIG.attackCooldownTicks,
      lastHurtTick: -10,
      spriteVariant: usernameToSpriteVariant(fighter2Data.username),
    };

    const state: MatchState = {
      matchId,
      status: "active",
      tick: 0,
      fighter1,
      fighter2,
      events: [
        {
          tick: 0,
          type: "match_start",
          message: `${fighter1.username} vs ${fighter2.username}`,
        },
      ],
      startedAt: Date.now(),
    };

    this.matches.set(matchId, {
      state,
      damageDealt1: 0,
      damageDealt2: 0,
    });

    console.log(
      `[ArenaEngine] Match ${matchId} created: ${fighter1.username} vs ${fighter2.username}`
    );

    return state;
  }

  // Get match state
  getMatchState(matchId: number): MatchState | undefined {
    return this.matches.get(matchId)?.state;
  }

  // Get all active matches
  getActiveMatches(): MatchState[] {
    return Array.from(this.matches.values())
      .filter((m) => m.state.status === "active")
      .map((m) => m.state);
  }

  // Main game loop tick
  private tick(): void {
    this.matches.forEach((activeMatch, matchId) => {
      const { state } = activeMatch;

      // Skip completed matches
      if (state.status !== "active") {
        return;
      }

      // Increment tick counter
      state.tick++;
      state.events = []; // Clear events from last tick

      const f1 = state.fighter1;
      const f2 = state.fighter2;

      // Check for knockout
      if (f1.stats.hp <= 0 || f2.stats.hp <= 0) {
        this.resolveMatchEnd(matchId, activeMatch);
        return;
      }

      // Reset hurt state after duration (6 ticks = 0.6s)
      if (f1.state === "hurt" && state.tick - f1.lastHurtTick > 6) {
        f1.state = "idle";
      }
      if (f2.state === "hurt" && state.tick - f2.lastHurtTick > 6) {
        f2.state = "idle";
      }

      // Reset attacking state after animation (5 ticks = 0.5s)
      if (f1.state === "attacking" && state.tick - f1.lastAttackTick > 5) {
        f1.state = "idle";
      }
      if (f2.state === "attacking" && state.tick - f2.lastAttackTick > 5) {
        f2.state = "idle";
      }

      // Update each fighter (auto-battle AI)
      this.updateFighter(f1, f2, state, activeMatch, 1);
      this.updateFighter(f2, f1, state, activeMatch, 2);

      // Broadcast update to clients
      if (this.onUpdate) {
        this.onUpdate(state);
      }
    });
  }

  // Auto-battle AI for a single fighter
  private updateFighter(
    fighter: Fighter,
    opponent: Fighter,
    state: MatchState,
    activeMatch: ActiveMatch,
    fighterNum: 1 | 2
  ): void {
    // Skip if knocked out or currently hurt
    if (fighter.stats.hp <= 0) {
      fighter.state = "knockout";
      return;
    }

    if (fighter.state === "hurt") {
      return;
    }

    const distance = Math.abs(fighter.x - opponent.x);
    const ticksSinceAttack = state.tick - fighter.lastAttackTick;
    const canAttack = ticksSinceAttack >= fighter.stats.speed;

    // In attack range and can attack
    if (distance <= ARENA_CONFIG.attackRange && canAttack && opponent.stats.hp > 0) {
      // Lunge forward before attacking!
      const lungeDir = opponent.x > fighter.x ? 1 : -1;
      fighter.x += lungeDir * 8; // Quick lunge
      fighter.x = Math.max(20, Math.min(ARENA_CONFIG.arenaWidth - 20, fighter.x));

      this.performAttack(fighter, opponent, state, activeMatch, fighterNum);
      return;
    }

    // Not in range - move toward opponent
    if (distance > ARENA_CONFIG.attackRange) {
      fighter.state = "walking";
      const moveDir = opponent.x > fighter.x ? 1 : -1;
      fighter.direction = moveDir > 0 ? "right" : "left";
      fighter.x += moveDir * ARENA_CONFIG.moveSpeed * 1.5; // Faster movement

      // Clamp to arena bounds
      fighter.x = Math.max(20, Math.min(ARENA_CONFIG.arenaWidth - 20, fighter.x));

      // Add move event (every 3 ticks for smoother animation)
      if (state.tick % 3 === 0) {
        state.events.push({
          tick: state.tick,
          type: "move",
          attacker: fighter.username,
          x: fighter.x,
          y: fighter.y,
        });
      }
    } else {
      // In range but waiting for cooldown - shuffle around!
      fighter.state = "idle";

      // Random shuffle movement to look alive
      if (state.tick % 8 === 0) {
        const shuffleDir = Math.random() > 0.5 ? 1 : -1;
        const shuffleAmount = Math.random() * 6 + 2;
        fighter.x += shuffleDir * shuffleAmount;
        fighter.x = Math.max(20, Math.min(ARENA_CONFIG.arenaWidth - 20, fighter.x));
      }
    }
  }

  // Perform an attack
  private performAttack(
    attacker: Fighter,
    defender: Fighter,
    state: MatchState,
    activeMatch: ActiveMatch,
    attackerNum: 1 | 2
  ): void {
    attacker.state = "attacking";
    attacker.lastAttackTick = state.tick;

    // Calculate and apply damage
    const damage = calculateDamage(attacker.stats.attack, defender.stats.defense);
    defender.stats.hp = Math.max(0, defender.stats.hp - damage);

    // Track damage dealt
    if (attackerNum === 1) {
      activeMatch.damageDealt1 += damage;
    } else {
      activeMatch.damageDealt2 += damage;
    }

    // Defender reacts - knockback!
    if (defender.stats.hp > 0) {
      defender.state = "hurt";
      defender.lastHurtTick = state.tick;

      // Knockback - push defender away from attacker
      const knockbackDir = defender.x > attacker.x ? 1 : -1;
      const knockbackAmount = 15 + Math.random() * 10; // 15-25 pixels
      defender.x += knockbackDir * knockbackAmount;
      defender.x = Math.max(20, Math.min(ARENA_CONFIG.arenaWidth - 20, defender.x));
    } else {
      defender.state = "knockout";

      // Big knockback on knockout
      const knockbackDir = defender.x > attacker.x ? 1 : -1;
      defender.x += knockbackDir * 30;
      defender.x = Math.max(20, Math.min(ARENA_CONFIG.arenaWidth - 20, defender.x));
    }

    // Add damage event
    state.events.push({
      tick: state.tick,
      type: "damage",
      attacker: attacker.username,
      defender: defender.username,
      damage,
      x: defender.x,
      y: defender.y,
    });

    console.log(
      `[Match ${state.matchId}] ${attacker.username} hits ${defender.username} for ${damage} damage (${defender.stats.hp}/${defender.stats.maxHp} HP)`
    );
  }

  // Handle match end
  private resolveMatchEnd(matchId: number, activeMatch: ActiveMatch): void {
    const { state } = activeMatch;

    // Determine winner
    const winner = state.fighter1.stats.hp <= 0 ? state.fighter2 : state.fighter1;
    const loser = state.fighter1.stats.hp <= 0 ? state.fighter1 : state.fighter2;

    state.status = "completed";
    state.winner = winner.username;
    state.endedAt = Date.now();

    // Add end events
    state.events.push({
      tick: state.tick,
      type: "ko",
      attacker: winner.username,
      defender: loser.username,
      message: `${loser.username} is knocked out!`,
    });

    state.events.push({
      tick: state.tick,
      type: "match_end",
      attacker: winner.username,
      message: `${winner.username} wins!`,
    });

    console.log(
      `[ArenaEngine] Match ${matchId} ended: ${winner.username} wins after ${state.tick} ticks`
    );

    // Broadcast final state
    if (this.onUpdate) {
      this.onUpdate(state);
    }

    // Remove match after a delay
    setTimeout(() => {
      this.matches.delete(matchId);
      console.log(`[ArenaEngine] Match ${matchId} cleaned up`);
    }, 5000);
  }

  // Get engine status
  getStatus(): { running: boolean; activeMatches: number } {
    return {
      running: this.isRunning,
      activeMatches: this.matches.size,
    };
  }
}

// Singleton instance
let engineInstance: ArenaEngine | null = null;

export function getArenaEngine(): ArenaEngine {
  if (!engineInstance) {
    engineInstance = new ArenaEngine();
  }
  return engineInstance;
}
