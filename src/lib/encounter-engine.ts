// Wild Encounter Battle Engine
// Pokemon Crystal-style damage formula, moves, stat stages, and AI

import type {
  Creature,
  PlayerBattleStats,
  EncounterState,
  BattleLogEntry,
  Move,
  StatStages,
} from "./encounter-types";
import { getStatMultiplier } from "./encounter-types";

function logEntry(
  message: string,
  type: BattleLogEntry["type"],
  damage?: number,
  moveAnimation?: Move["animation"]
): BattleLogEntry {
  return { message, type, damage, moveAnimation, timestamp: Date.now() };
}

// Pokemon-style damage formula:
// damage = ((2 * level / 5 + 2) * power * (atk / def)) / 50 + 2
// * random(0.85 - 1.0), minimum 1
function calculateMoveDamage(
  level: number,
  power: number,
  attackerAtk: number,
  defenderDef: number,
  attackerAtkStage: number,
  defenderDefStage: number
): number {
  if (power <= 0) return 0;

  const effectiveAtk = attackerAtk * getStatMultiplier(attackerAtkStage);
  const effectiveDef = Math.max(1, defenderDef * getStatMultiplier(defenderDefStage));

  const baseDamage = ((2 * level / 5 + 2) * power * (effectiveAtk / effectiveDef)) / 50 + 2;
  const randomFactor = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(baseDamage * randomFactor));
}

export function createEncounter(creature: Creature, playerStats: PlayerBattleStats): EncounterState {
  return {
    phase: "intro",
    creature,
    player: { ...playerStats },
    creatureHp: creature.stats.maxHp,
    playerHp: playerStats.maxHp,
    turnNumber: 1,
    playerStages: { defense: 0, speed: 0 },
    creatureStages: { defense: 0, speed: 0 },
    battleLog: [
      logEntry(`Wild ${creature.name} appeared!`, "info"),
    ],
    result: null,
    xpGained: 0,
  };
}

export function executePlayerMove(state: EncounterState, move: Move): EncounterState {
  const next: EncounterState = {
    ...state,
    battleLog: [...state.battleLog],
    playerStages: { ...state.playerStages },
    creatureStages: { ...state.creatureStages },
    lastMoveUsed: move,
  };

  // Deduct PP
  const moveIdx = next.player.moves.findIndex((m) => m.name === move.name);
  if (moveIdx >= 0) {
    next.player = { ...next.player, moves: [...next.player.moves] };
    next.player.moves[moveIdx] = { ...next.player.moves[moveIdx], pp: Math.max(0, move.pp - 1) };
  }

  // Status moves (buff/debuff)
  if (move.power === 0) {
    if (move.effect === "def_up") {
      if (next.playerStages.defense < 6) {
        next.playerStages.defense = Math.min(6, next.playerStages.defense + 1);
        next.battleLog.push(logEntry(`You used ${move.name}!`, "player_attack", undefined, move.animation));
        next.battleLog.push(logEntry("Your Defense rose!", "stat_change"));
      } else {
        next.battleLog.push(logEntry(`You used ${move.name}!`, "player_attack", undefined, move.animation));
        next.battleLog.push(logEntry("Your Defense won't go higher!", "stat_change"));
      }
    }
    next.phase = "creature_turn";
    return next;
  }

  // Accuracy check
  if (move.accuracy < 100 && Math.random() * 100 > move.accuracy) {
    next.battleLog.push(logEntry(`You used ${move.name}!`, "player_attack", undefined, move.animation));
    next.battleLog.push(logEntry("But it missed!", "info"));
    next.phase = "creature_turn";
    return next;
  }

  // Calculate damage
  const damage = calculateMoveDamage(
    next.player.level,
    move.power,
    next.player.attack,
    next.creature.stats.defense,
    0, // Player has no attack stages (only def/spd)
    next.creatureStages.defense
  );

  next.creatureHp = Math.max(0, next.creatureHp - damage);
  next.battleLog.push(logEntry(`You used ${move.name}!`, "player_attack", damage, move.animation));

  // Secondary effect (e.g., burn chance)
  if (move.effect === "burn" && move.effectChance && Math.random() * 100 < move.effectChance) {
    next.battleLog.push(logEntry(`${next.creature.name} was burned!`, "info"));
  }

  if (next.creatureHp <= 0) {
    const xp = calculateXpGained(next.creature);
    next.xpGained = xp;
    next.result = "win";
    next.phase = "result";
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
  };

  // Temporary defense boost (handled in creature turn damage calc)
  next.playerStages.defense = Math.min(6, next.playerStages.defense + 1);
  next.battleLog.push(logEntry("You brace yourself!", "player_defend", undefined, "shimmer"));
  next.battleLog.push(logEntry("Defense rose!", "stat_change"));
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

  const fleeSuccess = Math.random() < 0.7;
  if (fleeSuccess) {
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

  // Pick move via AI
  const move = pickCreatureMove(next.creature);
  if (!move) {
    next.battleLog.push(logEntry(`${next.creature.name} has no moves left!`, "info"));
    next.phase = "player_turn";
    next.turnNumber++;
    return next;
  }

  // Deduct PP
  const moveIdx = next.creature.moves.findIndex((m) => m.name === move.name);
  if (moveIdx >= 0) {
    next.creature = { ...next.creature, moves: [...next.creature.moves] };
    next.creature.moves[moveIdx] = { ...next.creature.moves[moveIdx], pp: Math.max(0, move.pp - 1) };
  }

  next.lastMoveUsed = move;

  // Status moves
  if (move.power === 0) {
    next.battleLog.push(logEntry(`${next.creature.name} used ${move.name}!`, "creature_attack", undefined, move.animation));
    if (move.effect === "def_up") {
      if (next.creatureStages.defense < 6) {
        next.creatureStages.defense = Math.min(6, next.creatureStages.defense + 1);
        next.battleLog.push(logEntry(`${next.creature.name}'s Defense rose!`, "stat_change"));
      } else {
        next.battleLog.push(logEntry(`${next.creature.name}'s Defense won't go higher!`, "stat_change"));
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
    }
    next.phase = "player_turn";
    next.turnNumber++;
    return next;
  }

  // Accuracy check
  if (move.accuracy < 100 && Math.random() * 100 > move.accuracy) {
    next.battleLog.push(logEntry(`${next.creature.name} used ${move.name}!`, "creature_attack", undefined, move.animation));
    next.battleLog.push(logEntry("But it missed!", "info"));
    next.phase = "player_turn";
    next.turnNumber++;
    return next;
  }

  // Damage
  const damage = calculateMoveDamage(
    next.creature.level,
    move.power,
    next.creature.stats.attack,
    next.player.defense,
    0,
    next.playerStages.defense
  );

  next.playerHp = Math.max(0, next.playerHp - damage);
  next.battleLog.push(logEntry(`${next.creature.name} used ${move.name}!`, "creature_attack", damage, move.animation));

  if (next.playerHp <= 0) {
    next.result = "lose";
    next.phase = "result";
    next.battleLog.push(logEntry("You were defeated...", "result"));
    return next;
  }

  next.phase = "player_turn";
  next.turnNumber++;
  return next;
}

function pickCreatureMove(creature: Creature): Move | null {
  const available = creature.moves.filter((m) => m.pp > 0);
  if (available.length === 0) return null;

  // AI: 60% offensive, 20% buff/debuff, 20% random
  const offensive = available.filter((m) => m.power > 0);
  const status = available.filter((m) => m.power === 0);

  const roll = Math.random();
  if (roll < 0.6 && offensive.length > 0) {
    return offensive[Math.floor(Math.random() * offensive.length)];
  } else if (roll < 0.8 && status.length > 0) {
    return status[Math.floor(Math.random() * status.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

export function calculateXpGained(creature: Creature): number {
  return 20 + creature.level * 5;
}
