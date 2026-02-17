// Wild Encounter Battle Engine
// Pokemon Crystal-style damage formula, type effectiveness, STAB, status, and speed-based turns

import type {
  Creature,
  PlayerBattleStats,
  EncounterState,
  BattleLogEntry,
  Move,
  MoveType,
} from "./encounter-types";
import {
  getStatMultiplier,
  getTypeEffectiveness,
  getStabMultiplier,
  STRUGGLE_MOVE,
} from "./encounter-types";

function logEntry(
  message: string,
  type: BattleLogEntry["type"],
  damage?: number,
  moveAnimation?: Move["animation"]
): BattleLogEntry {
  return { message, type, damage, moveAnimation, timestamp: Date.now() };
}

// Pokemon Crystal damage formula:
// damage = ((2 * level / 5 + 2) * power * (atk / def)) / 50 + 2
// * STAB * type effectiveness * random(0.85 - 1.0), minimum 2
function calculateMoveDamage(
  level: number,
  power: number,
  attackerAtk: number,
  defenderDef: number,
  attackerAtkStage: number,
  defenderDefStage: number,
  moveType: MoveType,
  attackerType: string,
  defenderType: string,
  isBurned: boolean
): { damage: number; effectiveness: number; stab: boolean } {
  if (power <= 0) return { damage: 0, effectiveness: 1, stab: false };

  let effectiveAtk = attackerAtk * getStatMultiplier(attackerAtkStage);
  if (isBurned) effectiveAtk *= 0.5; // Burn halves physical attack
  const effectiveDef = Math.max(1, defenderDef * getStatMultiplier(defenderDefStage));

  const baseDamage = (((2 * level) / 5 + 2) * power * (effectiveAtk / effectiveDef)) / 50 + 2;
  const randomFactor = 0.85 + Math.random() * 0.15;

  const stab = getStabMultiplier(moveType, attackerType);
  const effectiveness = getTypeEffectiveness(moveType, defenderType);

  const finalDamage = Math.max(2, Math.floor(baseDamage * randomFactor * stab * effectiveness));

  return { damage: finalDamage, effectiveness, stab: stab > 1 };
}

// Speed-based turn order (Crystal: faster Pokemon goes first, ties broken randomly)
function doesCreatureGoFirst(
  state: EncounterState,
  playerMove: Move | null // null = defend/flee
): boolean {
  // Priority moves always go first regardless of speed
  if (playerMove?.effect === "priority") return false; // Player always first

  const playerSpeed = state.player.speed * getStatMultiplier(state.playerStages.speed);
  const creatureSpeed = state.creature.stats.speed * getStatMultiplier(state.creatureStages.speed);

  if (playerSpeed > creatureSpeed) return false;
  if (creatureSpeed > playerSpeed) return true;
  return Math.random() < 0.5; // Speed tie: 50/50
}

export function createEncounter(
  creature: Creature,
  playerStats: PlayerBattleStats
): EncounterState {
  return {
    phase: "intro",
    creature,
    player: { ...playerStats },
    creatureHp: creature.stats.maxHp,
    playerHp: playerStats.maxHp,
    turnNumber: 1,
    playerStages: { defense: 0, speed: 0 },
    creatureStages: { defense: 0, speed: 0 },
    playerDefending: false,
    creatureDefending: false,
    playerStatus: null,
    creatureStatus: null,
    battleLog: [logEntry(`Wild ${creature.name} appeared!`, "info")],
    result: null,
    xpGained: 0,
  };
}

// Apply burn damage at end of turn for the burned party
function applyBurnDamage(next: EncounterState): void {
  if (next.creatureStatus === "burn") {
    const burnDmg = Math.max(1, Math.floor(next.creature.stats.maxHp / 16));
    next.creatureHp = Math.max(0, next.creatureHp - burnDmg);
    next.battleLog.push(
      logEntry(`${next.creature.name} is hurt by its burn!`, "status_damage", burnDmg)
    );
    if (next.creatureHp <= 0) {
      const xp = calculateXpGained(next.creature);
      next.xpGained = xp;
      next.result = "win";
      next.phase = "result";
    }
  }
  if (next.playerStatus === "burn" && !next.result) {
    const burnDmg = Math.max(1, Math.floor(next.player.maxHp / 16));
    next.playerHp = Math.max(0, next.playerHp - burnDmg);
    next.battleLog.push(logEntry("You are hurt by your burn!", "status_damage", burnDmg));
    if (next.playerHp <= 0) {
      next.result = "lose";
      next.phase = "result";
      next.battleLog.push(logEntry("You were defeated...", "result"));
    }
  }
}

// Apply secondary effects from a damaging move (burn, def_down, spd_down on the target)
function applySecondaryEffect(next: EncounterState, move: Move, targetIsPlayer: boolean): void {
  if (!move.effect || !move.effectChance) return;
  if (Math.random() * 100 >= move.effectChance) return;

  if (move.effect === "burn") {
    if (targetIsPlayer) {
      if (!next.playerStatus) {
        next.playerStatus = "burn";
        next.battleLog.push(logEntry("You were burned!", "info"));
      }
    } else {
      if (!next.creatureStatus) {
        next.creatureStatus = "burn";
        next.battleLog.push(logEntry(`${next.creature.name} was burned!`, "info"));
      }
    }
  } else if (move.effect === "spd_down") {
    if (targetIsPlayer) {
      if (next.playerStages.speed > -6) {
        next.playerStages.speed = Math.max(-6, next.playerStages.speed - 1);
        next.battleLog.push(logEntry("Your Speed fell!", "stat_change"));
      }
    } else {
      if (next.creatureStages.speed > -6) {
        next.creatureStages.speed = Math.max(-6, next.creatureStages.speed - 1);
        next.battleLog.push(logEntry(`${next.creature.name}'s Speed fell!`, "stat_change"));
      }
    }
  } else if (move.effect === "def_down") {
    if (targetIsPlayer) {
      if (next.playerStages.defense > -6) {
        next.playerStages.defense = Math.max(-6, next.playerStages.defense - 1);
        next.battleLog.push(logEntry("Your Defense fell!", "stat_change"));
      }
    } else {
      if (next.creatureStages.defense > -6) {
        next.creatureStages.defense = Math.max(-6, next.creatureStages.defense - 1);
        next.battleLog.push(logEntry(`${next.creature.name}'s Defense fell!`, "stat_change"));
      }
    }
  }
}

export function executePlayerMove(state: EncounterState, move: Move): EncounterState {
  const isStruggle = move.name === "Struggle";
  const next: EncounterState = {
    ...state,
    battleLog: [...state.battleLog],
    playerStages: { ...state.playerStages },
    creatureStages: { ...state.creatureStages },
    lastMoveUsed: move,
    creatureGoesFirst: doesCreatureGoFirst(state, move),
  };

  // Deduct PP (not for Struggle)
  if (!isStruggle) {
    const moveIdx = next.player.moves.findIndex((m) => m.name === move.name);
    if (moveIdx >= 0) {
      next.player = { ...next.player, moves: [...next.player.moves] };
      next.player.moves[moveIdx] = { ...next.player.moves[moveIdx], pp: Math.max(0, move.pp - 1) };
    }
  }

  // Status moves (buff/debuff)
  if (move.power === 0) {
    if (move.effect === "def_up") {
      if (next.playerStages.defense < 6) {
        next.playerStages.defense = Math.min(6, next.playerStages.defense + 1);
        next.battleLog.push(
          logEntry(`You used ${move.name}!`, "player_attack", undefined, move.animation)
        );
        next.battleLog.push(logEntry("Your Defense rose!", "stat_change"));
      } else {
        next.battleLog.push(
          logEntry(`You used ${move.name}!`, "player_attack", undefined, move.animation)
        );
        next.battleLog.push(logEntry("Your Defense won't go higher!", "stat_change"));
      }
    }
    next.phase = "creature_turn";
    return next;
  }

  // Accuracy check
  if (move.accuracy < 100 && Math.random() * 100 > move.accuracy) {
    next.battleLog.push(
      logEntry(`You used ${move.name}!`, "player_attack", undefined, move.animation)
    );
    next.battleLog.push(logEntry("But it missed!", "info"));
    next.phase = "creature_turn";
    return next;
  }

  // Calculate damage with type effectiveness and STAB
  // Player type is "normal" (generic trainer)
  const { damage, effectiveness, stab } = calculateMoveDamage(
    next.player.level,
    move.power,
    next.player.attack,
    next.creature.stats.defense,
    0, // Player has no persistent attack stages
    next.creatureDefending ? next.creatureStages.defense + 1 : next.creatureStages.defense,
    move.type,
    "normal", // Player type for STAB (only Ember matches fire, but player is "normal")
    next.creature.type,
    next.playerStatus === "burn"
  );

  // Reset creature defending after absorbing one hit
  next.creatureDefending = false;

  next.creatureHp = Math.max(0, next.creatureHp - damage);
  next.battleLog.push(logEntry(`You used ${move.name}!`, "player_attack", damage, move.animation));

  // Effectiveness messages
  if (effectiveness > 1) {
    next.battleLog.push(logEntry("It's super effective!", "effectiveness"));
  } else if (effectiveness < 1) {
    next.battleLog.push(logEntry("It's not very effective...", "effectiveness"));
  }
  if (stab) {
    // STAB is silent in Crystal, but we keep it implicit in damage
  }

  // Secondary effects on damaging moves (burn, def_down, spd_down)
  applySecondaryEffect(next, move, false);

  // Struggle recoil: 1/4 of damage dealt
  if (isStruggle) {
    const recoil = Math.max(1, Math.floor(damage / 4));
    next.playerHp = Math.max(0, next.playerHp - recoil);
    next.battleLog.push(logEntry("You're hit with recoil!", "info", recoil));
  }

  if (next.creatureHp <= 0) {
    const xp = calculateXpGained(next.creature);
    next.xpGained = xp;
    next.result = "win";
    next.phase = "result";
    return next;
  }

  if (next.playerHp <= 0) {
    next.result = "lose";
    next.phase = "result";
    next.battleLog.push(logEntry("You were defeated...", "result"));
    return next;
  }

  next.phase = "creature_turn";
  return next;
}

export function executePlayerDefend(state: EncounterState): EncounterState {
  const next: EncounterState = {
    ...state,
    battleLog: [...state.battleLog],
    playerStages: { ...state.playerStages },
    creatureStages: { ...state.creatureStages },
    creatureGoesFirst: doesCreatureGoFirst(state, null),
  };

  // Set defending flag — lasts for exactly one incoming hit, then resets
  next.playerDefending = true;
  next.battleLog.push(logEntry("You brace yourself!", "player_defend", undefined, "shimmer"));
  next.battleLog.push(logEntry("Defense rose temporarily!", "stat_change"));
  next.phase = "creature_turn";
  return next;
}

export function executePlayerFlee(state: EncounterState): EncounterState {
  const next: EncounterState = {
    ...state,
    battleLog: [...state.battleLog],
    playerStages: { ...state.playerStages },
    creatureStages: { ...state.creatureStages },
  };

  // Crystal flee formula: (playerSpeed * 128 / enemySpeed) + 30 * (attempts - 1)
  // If player speed >= enemy speed, always flee
  const playerSpeed = next.player.speed * getStatMultiplier(next.playerStages.speed);
  const enemySpeed = Math.max(
    1,
    next.creature.stats.speed * getStatMultiplier(next.creatureStages.speed)
  );
  const attempts = next.turnNumber; // Each turn counts as an attempt

  if (playerSpeed >= enemySpeed) {
    // Guaranteed escape when faster
    next.result = "flee";
    next.phase = "result";
    next.battleLog.push(logEntry("Got away safely!", "flee"));
    return next;
  }

  const threshold = Math.floor((playerSpeed * 128) / enemySpeed) + 30 * (attempts - 1);
  const roll = Math.floor(Math.random() * 256);

  if (threshold >= 256 || roll < threshold) {
    next.result = "flee";
    next.phase = "result";
    next.battleLog.push(logEntry("Got away safely!", "flee"));
    return next;
  }

  next.battleLog.push(logEntry("Can't escape!", "flee"));
  next.phase = "creature_turn";
  return next;
}

export function executeCreatureTurn(state: EncounterState): EncounterState {
  const next: EncounterState = {
    ...state,
    battleLog: [...state.battleLog],
    playerStages: { ...state.playerStages },
    creatureStages: { ...state.creatureStages },
  };

  // Pick move — wild Pokemon in Crystal use purely random selection
  const move = pickCreatureMove(next.creature);
  if (!move) {
    // No moves left — creature uses Struggle
    return executeCreatureStruggle(next);
  }

  // Deduct PP
  const moveIdx = next.creature.moves.findIndex((m) => m.name === move.name);
  if (moveIdx >= 0) {
    next.creature = { ...next.creature, moves: [...next.creature.moves] };
    next.creature.moves[moveIdx] = {
      ...next.creature.moves[moveIdx],
      pp: Math.max(0, move.pp - 1),
    };
  }

  next.lastMoveUsed = move;

  // Status moves
  if (move.power === 0) {
    next.battleLog.push(
      logEntry(
        `${next.creature.name} used ${move.name}!`,
        "creature_attack",
        undefined,
        move.animation
      )
    );
    if (move.effect === "def_up") {
      if (next.creatureStages.defense < 6) {
        next.creatureStages.defense = Math.min(6, next.creatureStages.defense + 1);
        next.battleLog.push(logEntry(`${next.creature.name}'s Defense rose!`, "stat_change"));
      } else {
        next.battleLog.push(
          logEntry(`${next.creature.name}'s Defense won't go higher!`, "stat_change")
        );
      }
    } else if (move.effect === "spd_down") {
      if (next.playerStages.speed > -6) {
        next.playerStages.speed = Math.max(-6, next.playerStages.speed - 1);
        next.battleLog.push(logEntry("Your Speed fell!", "stat_change"));
      }
    } else if (move.effect === "def_down") {
      if (next.playerStages.defense > -6) {
        next.playerStages.defense = Math.max(-6, next.playerStages.defense - 1);
        next.battleLog.push(logEntry("Your Defense fell!", "stat_change"));
      }
    } else if (move.effect === "leech") {
      const leechDmg = Math.max(1, Math.floor(next.player.maxHp / 8));
      next.playerHp = Math.max(0, next.playerHp - leechDmg);
      next.battleLog.push(
        logEntry(`${next.creature.name} drained your HP!`, "status_damage", leechDmg)
      );
      const heal = Math.min(leechDmg, next.creature.stats.maxHp - next.creatureHp);
      if (heal > 0) next.creatureHp += heal;
      if (next.playerHp <= 0) {
        next.result = "lose";
        next.phase = "result";
        next.battleLog.push(logEntry("You were defeated...", "result"));
        return next;
      }
    }
    // End-of-turn burn damage
    applyBurnDamage(next);
    if (next.result) return next;
    next.phase = "player_turn";
    next.turnNumber++;
    return next;
  }

  // Accuracy check
  if (move.accuracy < 100 && Math.random() * 100 > move.accuracy) {
    next.battleLog.push(
      logEntry(
        `${next.creature.name} used ${move.name}!`,
        "creature_attack",
        undefined,
        move.animation
      )
    );
    next.battleLog.push(logEntry("But it missed!", "info"));
    applyBurnDamage(next);
    if (next.result) return next;
    next.phase = "player_turn";
    next.turnNumber++;
    return next;
  }

  // Damage with type effectiveness and STAB
  const defenseStage = next.playerDefending
    ? next.playerStages.defense + 2 // Defending gives +2 stage bonus for one hit
    : next.playerStages.defense;

  const { damage, effectiveness } = calculateMoveDamage(
    next.creature.level,
    move.power,
    next.creature.stats.attack,
    next.player.defense,
    0,
    defenseStage,
    move.type,
    next.creature.type,
    "normal", // Player defensive type
    next.creatureStatus === "burn"
  );

  // Reset defending flag after absorbing one hit
  next.playerDefending = false;

  next.playerHp = Math.max(0, next.playerHp - damage);
  next.battleLog.push(
    logEntry(`${next.creature.name} used ${move.name}!`, "creature_attack", damage, move.animation)
  );

  if (effectiveness > 1) {
    next.battleLog.push(logEntry("It's super effective!", "effectiveness"));
  } else if (effectiveness < 1) {
    next.battleLog.push(logEntry("It's not very effective...", "effectiveness"));
  }

  // Secondary effects on the target (player)
  applySecondaryEffect(next, move, true);

  if (next.playerHp <= 0) {
    next.result = "lose";
    next.phase = "result";
    next.battleLog.push(logEntry("You were defeated...", "result"));
    return next;
  }

  // End-of-turn burn damage
  applyBurnDamage(next);
  if (next.result) return next;

  next.phase = "player_turn";
  next.turnNumber++;
  return next;
}

function executeCreatureStruggle(next: EncounterState): EncounterState {
  const move = STRUGGLE_MOVE;
  next.lastMoveUsed = move;

  const { damage } = calculateMoveDamage(
    next.creature.level,
    move.power,
    next.creature.stats.attack,
    next.player.defense,
    0,
    next.playerDefending ? next.playerStages.defense + 2 : next.playerStages.defense,
    "normal",
    next.creature.type,
    "normal",
    next.creatureStatus === "burn"
  );

  next.playerDefending = false;
  next.playerHp = Math.max(0, next.playerHp - damage);
  next.battleLog.push(
    logEntry(`${next.creature.name} used Struggle!`, "creature_attack", damage, move.animation)
  );

  // Struggle recoil: 1/4 of damage dealt
  const recoil = Math.max(1, Math.floor(damage / 4));
  next.creatureHp = Math.max(0, next.creatureHp - recoil);
  next.battleLog.push(logEntry(`${next.creature.name} is hit with recoil!`, "info", recoil));

  if (next.playerHp <= 0) {
    next.result = "lose";
    next.phase = "result";
    next.battleLog.push(logEntry("You were defeated...", "result"));
    return next;
  }
  if (next.creatureHp <= 0) {
    const xp = calculateXpGained(next.creature);
    next.xpGained = xp;
    next.result = "win";
    next.phase = "result";
    return next;
  }

  applyBurnDamage(next);
  if (next.result) return next;

  next.phase = "player_turn";
  next.turnNumber++;
  return next;
}

// Wild Pokemon in Crystal select moves purely randomly (no AI scoring)
function pickCreatureMove(creature: Creature): Move | null {
  const available = creature.moves.filter((m) => m.pp > 0);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export function calculateXpGained(creature: Creature): number {
  return 20 + creature.level * 5;
}
