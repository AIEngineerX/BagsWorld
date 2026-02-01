// Arena Engine - Server-side combat game loop
// Runs at 100ms ticks, resolves auto-battle combat between MoltBook agents

import {
  type Fighter,
  type MatchState,
  ARENA_CONFIG,
  karmaToStats,
  calculateDamage,
  usernameToSpriteVariant,
} from "./arena-types";
import {
  getFighterById,
  getMatch,
  updateMatchState,
  completeMatch,
  updateFighterStats,
} from "./arena-db";

// Match state update callback type
type MatchUpdateCallback = (state: MatchState) => void;

// Active match tracking
interface ActiveMatch {
  state: MatchState;
  damageDealt1: number; // Total damage dealt by fighter 1
  damageDealt2: number; // Total damage dealt by fighter 2
}

export class ArenaEngine {
  private matches: Map<number, ActiveMatch> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private onUpdate: MatchUpdateCallback | null = null;
  private isRunning = false;

  // Start the game loop
  start(onUpdate: MatchUpdateCallback): void {
    if (this.isRunning) {
      console.warn("[ArenaEngine] Already running");
      return;
    }

    this.onUpdate = onUpdate;
    this.isRunning = true;

    // Run game loop at configured tick rate
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

  // Add a match to the active matches pool
  async addMatch(matchId: number): Promise<boolean> {
    // Don't add if already tracking
    if (this.matches.has(matchId)) {
      console.warn(`[ArenaEngine] Match ${matchId} already active`);
      return false;
    }

    // Load match and fighters from database
    const match = await getMatch(matchId);
    if (!match || match.status !== "active") {
      console.error(`[ArenaEngine] Match ${matchId} not found or not active`);
      return false;
    }

    const dbFighter1 = await getFighterById(match.fighter1_id);
    const dbFighter2 = await getFighterById(match.fighter2_id);

    if (!dbFighter1 || !dbFighter2) {
      console.error(`[ArenaEngine] Could not load fighters for match ${matchId}`);
      return false;
    }

    // Calculate stats from karma
    const stats1 = karmaToStats(dbFighter1.moltbook_karma);
    const stats2 = karmaToStats(dbFighter2.moltbook_karma);

    // Create fighter state objects
    const fighter1: Fighter = {
      id: dbFighter1.id,
      username: dbFighter1.moltbook_username,
      karma: dbFighter1.moltbook_karma,
      stats: stats1,
      x: ARENA_CONFIG.spawnXLeft,
      y: ARENA_CONFIG.groundY,
      state: "idle",
      direction: "right",
      lastAttackTick: -ARENA_CONFIG.attackCooldownTicks,
      lastHurtTick: -10,
      spriteVariant: usernameToSpriteVariant(dbFighter1.moltbook_username),
    };

    const fighter2: Fighter = {
      id: dbFighter2.id,
      username: dbFighter2.moltbook_username,
      karma: dbFighter2.moltbook_karma,
      stats: stats2,
      x: ARENA_CONFIG.spawnXRight,
      y: ARENA_CONFIG.groundY,
      state: "idle",
      direction: "left",
      lastAttackTick: -ARENA_CONFIG.attackCooldownTicks,
      lastHurtTick: -10,
      spriteVariant: usernameToSpriteVariant(dbFighter2.moltbook_username),
    };

    // Create match state
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
      `[ArenaEngine] Match ${matchId} added: ${fighter1.username} vs ${fighter2.username}`
    );

    // Broadcast initial state
    if (this.onUpdate) {
      this.onUpdate(state);
    }

    return true;
  }

  // Add match directly with fighter data (no database lookup needed)
  // Useful for serverless where we already have the data
  addMatchDirect(
    matchId: number,
    fighter1Data: { id: number; username: string; karma: number },
    fighter2Data: { id: number; username: string; karma: number }
  ): boolean {
    if (this.matches.has(matchId)) {
      console.warn(`[ArenaEngine] Match ${matchId} already active`);
      return false;
    }

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
      `[ArenaEngine] Match ${matchId} added directly: ${fighter1.username} vs ${fighter2.username}`
    );

    if (this.onUpdate) {
      this.onUpdate(state);
    }

    return true;
  }

  // Remove a match (cleanup)
  removeMatch(matchId: number): void {
    this.matches.delete(matchId);
  }

  // Get current state of a specific match
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

      // Reset attacking state after animation completes (5 ticks = 0.5s)
      if (f1.state === "attacking" && state.tick - f1.lastAttackTick > 5) {
        f1.state = "idle";
      }
      if (f2.state === "attacking" && state.tick - f2.lastAttackTick > 5) {
        f2.state = "idle";
      }

      // Update each fighter (auto-battle AI)
      this.updateFighter(f1, f2, state, activeMatch, 1);
      this.updateFighter(f2, f1, state, activeMatch, 2);

      // Persist state to database periodically (every 10 ticks = 1 second)
      if (state.tick % 10 === 0) {
        this.persistMatchState(matchId, state);
      }

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
      this.performAttack(fighter, opponent, state, activeMatch, fighterNum);
      return;
    }

    // Not in range - move toward opponent
    if (distance > ARENA_CONFIG.attackRange) {
      fighter.state = "walking";
      const moveDir = opponent.x > fighter.x ? 1 : -1;
      fighter.direction = moveDir > 0 ? "right" : "left";
      fighter.x += moveDir * ARENA_CONFIG.moveSpeed;

      // Clamp to arena bounds
      fighter.x = Math.max(20, Math.min(ARENA_CONFIG.arenaWidth - 20, fighter.x));

      // Add move event (sparse - every 5 ticks)
      if (state.tick % 5 === 0) {
        state.events.push({
          tick: state.tick,
          type: "move",
          attacker: fighter.username,
          x: fighter.x,
          y: fighter.y,
        });
      }
    } else {
      // In range but waiting for cooldown
      fighter.state = "idle";
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

    // Calculate damage
    const damage = calculateDamage(attacker.stats.attack, defender.stats.defense);

    // Apply damage
    defender.stats.hp = Math.max(0, defender.stats.hp - damage);
    defender.state = "hurt";
    defender.lastHurtTick = state.tick;

    // Track damage dealt
    if (attackerNum === 1) {
      activeMatch.damageDealt1 += damage;
    } else {
      activeMatch.damageDealt2 += damage;
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

    // Check for knockout
    if (defender.stats.hp <= 0) {
      defender.state = "knockout";
      state.events.push({
        tick: state.tick,
        type: "ko",
        attacker: attacker.username,
        defender: defender.username,
        message: `${attacker.username} knocks out ${defender.username}!`,
      });
    }
  }

  // Resolve match when someone is knocked out
  private async resolveMatchEnd(matchId: number, activeMatch: ActiveMatch): Promise<void> {
    const { state, damageDealt1, damageDealt2 } = activeMatch;

    state.status = "completed";
    state.endedAt = Date.now();

    const f1 = state.fighter1;
    const f2 = state.fighter2;

    // Determine winner
    const winner = f1.stats.hp > 0 ? f1 : f2;
    const loser = f1.stats.hp > 0 ? f2 : f1;
    state.winner = winner.username;

    // Add match end event
    state.events.push({
      tick: state.tick,
      type: "match_end",
      attacker: winner.username,
      defender: loser.username,
      message: `${winner.username} wins!`,
    });

    console.log(
      `[ArenaEngine] Match ${matchId} ended: ${winner.username} defeats ${loser.username}`
    );

    // Update database
    await completeMatch(matchId, winner.id, state.tick, state.events);

    // Update fighter stats
    const winner1 = f1.stats.hp > 0;
    await updateFighterStats(f1.id, winner1, damageDealt1, f1.stats.maxHp - f1.stats.hp);
    await updateFighterStats(f2.id, !winner1, damageDealt2, f2.stats.maxHp - f2.stats.hp);

    // Broadcast final state
    if (this.onUpdate) {
      this.onUpdate(state);
    }

    // Remove match after delay (allow clients to see final state)
    setTimeout(() => {
      this.matches.delete(matchId);
    }, 10000);
  }

  // Persist current match state to database (periodic backup)
  private async persistMatchState(matchId: number, state: MatchState): Promise<void> {
    await updateMatchState(
      matchId,
      state.fighter1.stats.hp,
      state.fighter1.x,
      state.fighter1.y,
      state.fighter2.stats.hp,
      state.fighter2.x,
      state.fighter2.y,
      state.tick
    );
  }

  // Check if engine is running
  isActive(): boolean {
    return this.isRunning;
  }

  // Get number of active matches
  getActiveMatchCount(): number {
    return this.matches.size;
  }

  // Run N ticks manually (for serverless/testing)
  // Returns match states after running
  runTicks(numTicks: number): MatchState[] {
    const results: MatchState[] = [];

    for (let i = 0; i < numTicks; i++) {
      this.tick();
    }

    // Collect current states of all matches
    this.matches.forEach((activeMatch) => {
      results.push({ ...activeMatch.state });
    });

    return results;
  }

  // Set update callback (for serverless mode where start() isn't called)
  setUpdateCallback(callback: MatchUpdateCallback): void {
    this.onUpdate = callback;
  }
}

// Singleton instance for the arena engine
let arenaEngineInstance: ArenaEngine | null = null;

export function getArenaEngine(): ArenaEngine {
  if (!arenaEngineInstance) {
    arenaEngineInstance = new ArenaEngine();
  }
  return arenaEngineInstance;
}

// Start the arena engine with a callback
export function startArenaEngine(onUpdate: MatchUpdateCallback): ArenaEngine {
  const engine = getArenaEngine();
  if (!engine.isActive()) {
    engine.start(onUpdate);
  }
  return engine;
}

// Stop the arena engine
export function stopArenaEngine(): void {
  if (arenaEngineInstance) {
    arenaEngineInstance.stop();
  }
}
