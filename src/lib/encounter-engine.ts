// Wild Encounter Battle Engine
// Pure logic — no Phaser or React dependencies

import type {
  Creature,
  PlayerBattleStats,
  EncounterState,
  BattleAction,
  BattleLogEntry,
  BattleResult,
  CreatureAction,
} from "./encounter-types";
import { calculateDamage } from "./arena-types";

function logEntry(
  message: string,
  type: BattleLogEntry["type"],
  damage?: number
): BattleLogEntry {
  return { message, type, damage, timestamp: Date.now() };
}

export function createEncounter(creature: Creature, playerStats: PlayerBattleStats): EncounterState {
  return {
    phase: "intro",
    creature,
    player: { ...playerStats },
    creatureHp: creature.stats.maxHp,
    playerHp: playerStats.maxHp,
    turnNumber: 1,
    playerDefending: false,
    creatureDefending: false,
    battleLog: [
      logEntry(`A wild ${creature.name} appeared!`, "info"),
      logEntry(`${creature.name} is level ${creature.level}`, "info"),
    ],
    result: null,
    xpGained: 0,
  };
}

export function executePlayerTurn(state: EncounterState, action: BattleAction): EncounterState {
  const next = {
    ...state,
    battleLog: [...state.battleLog],
    playerDefending: false, // Reset from previous turn
  };

  switch (action) {
    case "attack": {
      const defMultiplier = next.creatureDefending ? 2 : 1;
      const damage = calculateDamage(next.player.attack, next.creature.stats.defense * defMultiplier);
      next.creatureHp = Math.max(0, next.creatureHp - damage);
      next.creatureDefending = false; // Used up
      next.battleLog.push(logEntry(`You attack ${next.creature.name} for ${damage} damage!`, "player_attack", damage));

      if (next.creatureHp <= 0) {
        const xp = calculateXpGained(next.creature);
        next.xpGained = xp;
        next.result = "win";
        next.phase = "result";
        next.battleLog.push(logEntry(`${next.creature.name} was defeated!`, "result"));
        next.battleLog.push(logEntry(`You gained ${xp} XP!`, "result"));
        return next;
      }

      next.phase = "creature_turn";
      return next;
    }

    case "defend": {
      next.playerDefending = true;
      next.battleLog.push(logEntry("You brace for the next attack!", "player_defend"));
      next.phase = "creature_turn";
      return next;
    }

    case "flee": {
      const fleeSuccess = Math.random() < 0.7;
      if (fleeSuccess) {
        next.result = "flee";
        next.phase = "result";
        next.battleLog.push(logEntry("You fled successfully!", "flee"));
        return next;
      }

      next.battleLog.push(logEntry("You failed to flee!", "flee"));
      // Creature gets a free attack on failed flee
      const damage = calculateDamage(next.creature.stats.attack, next.player.defense);
      next.playerHp = Math.max(0, next.playerHp - damage);
      next.battleLog.push(
        logEntry(`${next.creature.name} attacks while you stumble! ${damage} damage!`, "creature_attack", damage)
      );

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
  }
}

export function executeCreatureTurn(state: EncounterState): EncounterState {
  const next = {
    ...state,
    battleLog: [...state.battleLog],
    creatureDefending: false, // Reset from previous turn
  };

  const creatureAction = pickCreatureAction();

  switch (creatureAction) {
    case "attack": {
      const defMultiplier = next.playerDefending ? 2 : 1;
      const damage = calculateDamage(next.creature.stats.attack, next.player.defense * defMultiplier);
      next.playerHp = Math.max(0, next.playerHp - damage);
      next.playerDefending = false; // Used up
      next.battleLog.push(
        logEntry(`${next.creature.name} attacks for ${damage} damage!`, "creature_attack", damage)
      );

      if (next.playerHp <= 0) {
        next.result = "lose";
        next.phase = "result";
        next.battleLog.push(logEntry("You were defeated...", "result"));
        return next;
      }
      break;
    }

    case "defend": {
      next.creatureDefending = true;
      next.battleLog.push(logEntry(`${next.creature.name} braces itself!`, "creature_defend"));
      break;
    }

    case "special": {
      // Special: 2x attack power, telegraphed
      const defMultiplier = next.playerDefending ? 2 : 1;
      const damage = calculateDamage(next.creature.stats.attack * 2, next.player.defense * defMultiplier);
      next.playerHp = Math.max(0, next.playerHp - damage);
      next.playerDefending = false;
      next.battleLog.push(
        logEntry(`${next.creature.name} uses a special attack! ${damage} damage!`, "creature_attack", damage)
      );

      if (next.playerHp <= 0) {
        next.result = "lose";
        next.phase = "result";
        next.battleLog.push(logEntry("You were defeated...", "result"));
        return next;
      }
      break;
    }
  }

  next.phase = "player_turn";
  next.turnNumber++;
  return next;
}

function pickCreatureAction(): CreatureAction {
  const roll = Math.random();
  if (roll < 0.7) return "attack";
  if (roll < 0.9) return "defend";
  return "special";
}

export function calculateXpGained(creature: Creature): number {
  return 20 + creature.level * 5;
}
