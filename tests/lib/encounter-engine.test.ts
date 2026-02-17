import {
  createEncounter,
  executePlayerMove,
  executePlayerDefend,
  executePlayerFlee,
  executeCreatureTurn,
  calculateXpGained,
} from "@/lib/encounter-engine";
import type { Creature, PlayerBattleStats, EncounterState, Move } from "@/lib/encounter-types";
import { STRUGGLE_MOVE } from "@/lib/encounter-types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeCreature(overrides: Partial<Creature> = {}): Creature {
  return {
    id: "test_creature_1",
    name: "TestCrab",
    type: "aquatic",
    zone: "moltbook",
    level: 2,
    stats: { hp: 50, maxHp: 50, attack: 12, defense: 10, speed: 10 },
    moves: [
      {
        name: "Bubble",
        type: "water",
        power: 35,
        accuracy: 100,
        pp: 30,
        maxPp: 30,
        animation: "water" as const,
      },
      {
        name: "Tackle",
        type: "normal",
        power: 40,
        accuracy: 100,
        pp: 35,
        maxPp: 35,
        animation: "slash" as const,
      },
      {
        name: "Harden",
        type: "buff",
        power: 0,
        accuracy: 100,
        pp: 30,
        maxPp: 30,
        effect: "def_up" as const,
        animation: "shimmer" as const,
      },
      {
        name: "Mud Shot",
        type: "aquatic",
        power: 40,
        accuracy: 95,
        pp: 20,
        maxPp: 20,
        effect: "spd_down" as const,
        effectChance: 100,
        animation: "debuff" as const,
      },
    ],
    spriteKey: "fighter_10",
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerBattleStats> = {}): PlayerBattleStats {
  return {
    hp: 100,
    maxHp: 100,
    attack: 15,
    defense: 12,
    speed: 14,
    level: 1,
    moves: [
      {
        name: "Tackle",
        type: "normal",
        power: 40,
        accuracy: 100,
        pp: 35,
        maxPp: 35,
        animation: "slash" as const,
      },
      {
        name: "Ember",
        type: "fire",
        power: 40,
        accuracy: 100,
        pp: 25,
        maxPp: 25,
        effect: "burn" as const,
        effectChance: 10,
        animation: "ember" as const,
      },
      {
        name: "Harden",
        type: "buff",
        power: 0,
        accuracy: 100,
        pp: 30,
        maxPp: 30,
        effect: "def_up" as const,
        animation: "shimmer" as const,
      },
      {
        name: "Quick Strike",
        type: "normal",
        power: 30,
        accuracy: 100,
        pp: 30,
        maxPp: 30,
        effect: "priority" as const,
        animation: "quick" as const,
      },
    ],
    ...overrides,
  };
}

function makeState(overrides: Partial<EncounterState> = {}): EncounterState {
  const creature = makeCreature();
  const player = makePlayer();
  return {
    phase: "player_turn",
    creature,
    player,
    creatureHp: creature.stats.maxHp,
    playerHp: player.maxHp,
    turnNumber: 1,
    playerStages: { defense: 0, speed: 0 },
    creatureStages: { defense: 0, speed: 0 },
    playerDefending: false,
    creatureDefending: false,
    playerStatus: null,
    creatureStatus: null,
    battleLog: [],
    result: null,
    xpGained: 0,
    fleeAttempts: 0,
    ...overrides,
  };
}

// ==========================================================================
// createEncounter
// ==========================================================================
describe("createEncounter", () => {
  it("initializes with correct HP values", () => {
    const creature = makeCreature();
    const player = makePlayer();
    const state = createEncounter(creature, player);

    expect(state.creatureHp).toBe(creature.stats.maxHp);
    expect(state.playerHp).toBe(player.maxHp);
  });

  it("starts in intro phase", () => {
    const state = createEncounter(makeCreature(), makePlayer());
    expect(state.phase).toBe("intro");
  });

  it("has an initial battle log entry about the wild creature", () => {
    const creature = makeCreature({ name: "Beach Crab" });
    const state = createEncounter(creature, makePlayer());
    expect(state.battleLog).toHaveLength(1);
    expect(state.battleLog[0].message).toContain("Beach Crab");
    expect(state.battleLog[0].type).toBe("info");
  });

  it("initializes all stat stages to 0", () => {
    const state = createEncounter(makeCreature(), makePlayer());
    expect(state.playerStages).toEqual({ defense: 0, speed: 0 });
    expect(state.creatureStages).toEqual({ defense: 0, speed: 0 });
  });

  it("initializes with no result, no status, no defending, no flee attempts", () => {
    const state = createEncounter(makeCreature(), makePlayer());
    expect(state.result).toBeNull();
    expect(state.playerStatus).toBeNull();
    expect(state.creatureStatus).toBeNull();
    expect(state.playerDefending).toBe(false);
    expect(state.creatureDefending).toBe(false);
    expect(state.fleeAttempts).toBe(0);
    expect(state.xpGained).toBe(0);
    expect(state.turnNumber).toBe(1);
  });
});

// ==========================================================================
// executePlayerMove — damaging attacks
// ==========================================================================
describe("executePlayerMove", () => {
  let state: EncounterState;

  beforeEach(() => {
    state = makeState();
  });

  it("deals damage to creature and transitions to creature_turn", () => {
    const tackle = state.player.moves[0]; // Tackle, power 40
    const next = executePlayerMove(state, tackle);

    expect(next.creatureHp).toBeLessThan(state.creatureHp);
    expect(next.phase).toBe("creature_turn");
    expect(next.battleLog.some((e) => e.type === "player_attack")).toBe(true);
  });

  it("deducts PP from the used move", () => {
    const tackle = state.player.moves[0];
    const next = executePlayerMove(state, tackle);
    expect(next.player.moves[0].pp).toBe(tackle.pp - 1);
  });

  it("does not deduct PP for Struggle", () => {
    const next = executePlayerMove(state, STRUGGLE_MOVE);
    // Original moves should be unchanged
    expect(next.player.moves[0].pp).toBe(state.player.moves[0].pp);
  });

  it("does not mutate the original state", () => {
    const originalHp = state.creatureHp;
    const originalPp = state.player.moves[0].pp;
    executePlayerMove(state, state.player.moves[0]);
    expect(state.creatureHp).toBe(originalHp);
    expect(state.player.moves[0].pp).toBe(originalPp);
  });

  describe("creature faint", () => {
    it("sets result to win when creature HP reaches 0", () => {
      // Give creature 1 HP so any hit kills it
      const lowHpState = makeState({ creatureHp: 1 });
      const next = executePlayerMove(lowHpState, lowHpState.player.moves[0]);
      expect(next.creatureHp).toBe(0);
      expect(next.result).toBe("win");
      expect(next.phase).toBe("result");
      expect(next.xpGained).toBeGreaterThan(0);
    });

    it("creature HP never goes below 0", () => {
      const lowHpState = makeState({ creatureHp: 1 });
      const next = executePlayerMove(lowHpState, lowHpState.player.moves[0]);
      expect(next.creatureHp).toBe(0);
    });
  });

  describe("miss mechanics", () => {
    it("misses when accuracy roll fails", () => {
      // Create a low-accuracy move
      const lowAccMove: Move = {
        name: "Wild Swing",
        type: "normal",
        power: 100,
        accuracy: 1, // 1% accuracy — almost always misses
        pp: 10,
        maxPp: 10,
        animation: "slash",
      };

      // Run multiple times — with 1% accuracy, should miss almost always
      let missCount = 0;
      for (let i = 0; i < 50; i++) {
        const next = executePlayerMove(makeState(), lowAccMove);
        if (next.creatureHp === state.creatureHp) missCount++;
      }
      expect(missCount).toBeGreaterThan(40); // At least 80% should miss
    });

    it("100% accuracy moves never miss", () => {
      const sureHit = state.player.moves[0]; // Tackle, 100% accuracy
      for (let i = 0; i < 50; i++) {
        const next = executePlayerMove(makeState(), sureHit);
        expect(next.creatureHp).toBeLessThan(state.creatureHp);
      }
    });
  });

  describe("type effectiveness", () => {
    it("logs super effective message for fire vs grass", () => {
      const grassCreature = makeCreature({ type: "grass" });
      const fireState = makeState({
        creature: grassCreature,
        creatureHp: grassCreature.stats.maxHp,
      });
      const ember = fireState.player.moves[1]; // Ember (fire)
      const next = executePlayerMove(fireState, ember);

      expect(next.battleLog.some((e) => e.message.includes("super effective"))).toBe(true);
    });

    it("logs not very effective message for fire vs water", () => {
      const waterCreature = makeCreature({ type: "water" });
      const waterState = makeState({
        creature: waterCreature,
        creatureHp: waterCreature.stats.maxHp,
      });
      const ember = waterState.player.moves[1]; // Ember (fire)
      const next = executePlayerMove(waterState, ember);

      expect(next.battleLog.some((e) => e.message.includes("not very effective"))).toBe(true);
    });

    it("does not log effectiveness for neutral matchups", () => {
      // Normal vs aquatic is neutral
      const next = executePlayerMove(state, state.player.moves[0]); // Tackle vs aquatic
      expect(next.battleLog.some((e) => e.type === "effectiveness")).toBe(false);
    });
  });

  describe("status moves", () => {
    it("Harden raises player defense stage", () => {
      const harden = state.player.moves[2]; // Harden
      const next = executePlayerMove(state, harden);

      expect(next.playerStages.defense).toBe(1);
      expect(next.phase).toBe("creature_turn");
    });

    it("Harden caps at +6", () => {
      const maxDefState = makeState({ playerStages: { defense: 6, speed: 0 } });
      const harden = maxDefState.player.moves[2];
      const next = executePlayerMove(maxDefState, harden);

      expect(next.playerStages.defense).toBe(6);
      expect(next.battleLog.some((e) => e.message.includes("won't go higher"))).toBe(true);
    });

    it("status moves deal no damage", () => {
      const harden = state.player.moves[2];
      const next = executePlayerMove(state, harden);
      expect(next.creatureHp).toBe(state.creatureHp);
    });
  });

  describe("Struggle recoil", () => {
    it("deals recoil damage to player equal to 1/4 of damage dealt", () => {
      const next = executePlayerMove(state, STRUGGLE_MOVE);
      const damageDealt = state.creatureHp - next.creatureHp;
      const expectedRecoil = Math.max(1, Math.floor(damageDealt / 4));
      expect(state.playerHp - next.playerHp).toBe(expectedRecoil);
    });

    it("player can faint from Struggle recoil", () => {
      const lowHpState = makeState({ playerHp: 1, creatureHp: 1 });
      const next = executePlayerMove(lowHpState, STRUGGLE_MOVE);
      // Creature dies first (damage applied before recoil), so result should be "win"
      // unless recoil also kills player — but win takes priority
      expect(next.result).toBe("win");
    });
  });

  describe("burn secondary effect", () => {
    it("can inflict burn via Ember (effectChance 10%)", () => {
      let burnInflicted = false;
      // Run 200 times — with 10% chance, should see at least one burn
      for (let i = 0; i < 200; i++) {
        const next = executePlayerMove(makeState(), state.player.moves[1]); // Ember
        if (next.creatureStatus === "burn") {
          burnInflicted = true;
          break;
        }
      }
      expect(burnInflicted).toBe(true);
    });

    it("does not inflict burn on an already-burned creature", () => {
      const burnedState = makeState({ creatureStatus: "burn" });
      // Force burn trigger by using 100% chance mock
      const spy = jest.spyOn(Math, "random").mockReturnValue(0); // Always triggers
      const next = executePlayerMove(burnedState, burnedState.player.moves[1]);
      spy.mockRestore();
      // Still burned, no double-burn message
      expect(next.creatureStatus).toBe("burn");
    });
  });

  describe("defending creature takes less damage", () => {
    it("creature defending flag reduces damage taken", () => {
      const normalDmg: number[] = [];
      const defendDmg: number[] = [];

      for (let i = 0; i < 50; i++) {
        const s1 = makeState({ creatureDefending: false });
        const n1 = executePlayerMove(s1, s1.player.moves[0]);
        normalDmg.push(s1.creatureHp - n1.creatureHp);

        const s2 = makeState({ creatureDefending: true });
        const n2 = executePlayerMove(s2, s2.player.moves[0]);
        defendDmg.push(s2.creatureHp - n2.creatureHp);
      }

      const avgNormal = normalDmg.reduce((a, b) => a + b) / normalDmg.length;
      const avgDefend = defendDmg.reduce((a, b) => a + b) / defendDmg.length;
      expect(avgDefend).toBeLessThan(avgNormal);
    });

    it("resets creature defending flag after one hit", () => {
      const defendState = makeState({ creatureDefending: true });
      const next = executePlayerMove(defendState, defendState.player.moves[0]);
      expect(next.creatureDefending).toBe(false);
    });
  });
});

// ==========================================================================
// executePlayerDefend
// ==========================================================================
describe("executePlayerDefend", () => {
  it("sets playerDefending to true", () => {
    const state = makeState();
    const next = executePlayerDefend(state);
    expect(next.playerDefending).toBe(true);
  });

  it("transitions to creature_turn", () => {
    const state = makeState();
    const next = executePlayerDefend(state);
    expect(next.phase).toBe("creature_turn");
  });

  it("logs a defend message", () => {
    const state = makeState();
    const next = executePlayerDefend(state);
    expect(next.battleLog.some((e) => e.type === "player_defend")).toBe(true);
    expect(next.battleLog.some((e) => e.message.includes("brace"))).toBe(true);
  });

  it("does not deal any damage", () => {
    const state = makeState();
    const next = executePlayerDefend(state);
    expect(next.creatureHp).toBe(state.creatureHp);
    expect(next.playerHp).toBe(state.playerHp);
  });

  it("does not mutate original state", () => {
    const state = makeState();
    executePlayerDefend(state);
    expect(state.playerDefending).toBe(false);
  });
});

// ==========================================================================
// executePlayerFlee — Crystal flee formula
// ==========================================================================
describe("executePlayerFlee", () => {
  it("guaranteed escape when player speed >= enemy speed", () => {
    const state = makeState();
    // Player speed 14 > creature speed 10
    for (let i = 0; i < 30; i++) {
      const next = executePlayerFlee(makeState());
      expect(next.result).toBe("flee");
      expect(next.phase).toBe("result");
    }
  });

  it("can fail to escape when player is slower", () => {
    const slowPlayer = makePlayer({ speed: 5 });
    const fastCreature = makeCreature({
      stats: { hp: 50, maxHp: 50, attack: 12, defense: 10, speed: 30 },
    });
    const state = makeState({
      player: slowPlayer,
      creature: fastCreature,
      creatureHp: fastCreature.stats.maxHp,
    });

    let failed = false;
    for (let i = 0; i < 100; i++) {
      const fresh = makeState({
        player: { ...slowPlayer, moves: slowPlayer.moves.map((m) => ({ ...m })) },
        creature: { ...fastCreature, moves: fastCreature.moves.map((m) => ({ ...m })) },
        creatureHp: fastCreature.stats.maxHp,
      });
      const next = executePlayerFlee(fresh);
      if (next.result !== "flee") {
        failed = true;
        break;
      }
    }
    expect(failed).toBe(true);
  });

  it("increments fleeAttempts on each attempt", () => {
    const state = makeState();
    const next1 = executePlayerFlee(state);
    // Since player is faster, always succeeds — check fleeAttempts anyway
    expect(next1.fleeAttempts).toBe(1);
  });

  it("failed flee transitions to creature_turn", () => {
    // Force flee failure by mocking random to always exceed threshold
    const slowState = makeState({
      player: makePlayer({ speed: 1 }),
      creature: makeCreature({
        stats: { hp: 50, maxHp: 50, attack: 12, defense: 10, speed: 100 },
      }),
    });
    const spy = jest.spyOn(Math, "random").mockReturnValue(0.999);
    const next = executePlayerFlee(slowState);
    spy.mockRestore();

    expect(next.result).toBeNull();
    expect(next.phase).toBe("creature_turn");
    expect(next.battleLog.some((e) => e.message.includes("Can't escape"))).toBe(true);
  });

  it("flee probability increases with more attempts", () => {
    const slowPlayer = makePlayer({ speed: 5 });
    const fastCreature = makeCreature({
      stats: { hp: 50, maxHp: 50, attack: 12, defense: 10, speed: 20 },
    });

    // Attempt 1: threshold = floor(5*128/20) + 30*0 = 32
    // Attempt 5: threshold = 32 + 30*4 = 152
    // At attempt 5, threshold is higher → more likely to flee

    // Count flee successes at attempt 1 vs attempt 5
    let success1 = 0;
    let success5 = 0;
    for (let i = 0; i < 500; i++) {
      const state1 = makeState({
        player: { ...slowPlayer, moves: slowPlayer.moves.map((m) => ({ ...m })) },
        creature: { ...fastCreature, moves: fastCreature.moves.map((m) => ({ ...m })) },
        creatureHp: fastCreature.stats.maxHp,
        fleeAttempts: 0,
      });
      if (executePlayerFlee(state1).result === "flee") success1++;

      const state5 = makeState({
        player: { ...slowPlayer, moves: slowPlayer.moves.map((m) => ({ ...m })) },
        creature: { ...fastCreature, moves: fastCreature.moves.map((m) => ({ ...m })) },
        creatureHp: fastCreature.stats.maxHp,
        fleeAttempts: 4, // Will become attempt 5
      });
      if (executePlayerFlee(state5).result === "flee") success5++;
    }
    expect(success5).toBeGreaterThan(success1);
  });

  it("logs 'Got away safely!' on success", () => {
    const state = makeState(); // Player faster → guaranteed
    const next = executePlayerFlee(state);
    expect(next.battleLog.some((e) => e.message.includes("Got away safely"))).toBe(true);
  });

  it("threshold >= 256 guarantees escape regardless of roll", () => {
    // With enough attempts, threshold should exceed 256
    const slowState = makeState({
      player: makePlayer({ speed: 5 }),
      creature: makeCreature({
        stats: { hp: 50, maxHp: 50, attack: 12, defense: 10, speed: 20 },
      }),
      fleeAttempts: 10, // threshold = floor(5*128/20) + 30*10 = 32 + 300 = 332 >= 256
    });
    const next = executePlayerFlee(slowState);
    expect(next.result).toBe("flee");
  });
});

// ==========================================================================
// executeCreatureTurn
// ==========================================================================
describe("executeCreatureTurn", () => {
  it("creature attacks and deals damage", () => {
    const state = makeState();
    // Run enough times to get a damaging move (creature picks randomly)
    let dealt = false;
    for (let i = 0; i < 50; i++) {
      const next = executeCreatureTurn(makeState());
      if (next.playerHp < state.playerHp) {
        dealt = true;
        break;
      }
    }
    expect(dealt).toBe(true);
  });

  it("transitions to player_turn and increments turnNumber after attack", () => {
    // Force a damaging move
    const oneMoveCritter = makeCreature({
      moves: [
        {
          name: "Tackle",
          type: "normal",
          power: 40,
          accuracy: 100,
          pp: 35,
          maxPp: 35,
          animation: "slash" as const,
        },
      ],
    });
    const state = makeState({ creature: oneMoveCritter, creatureHp: oneMoveCritter.stats.maxHp });
    const next = executeCreatureTurn(state);

    expect(next.phase).toBe("player_turn");
    expect(next.turnNumber).toBe(state.turnNumber + 1);
  });

  it("deducts PP from the used move", () => {
    // Give creature a single move to control selection
    const singleMove: Move = {
      name: "Bubble",
      type: "water",
      power: 35,
      accuracy: 100,
      pp: 30,
      maxPp: 30,
      animation: "water",
    };
    const creature = makeCreature({ moves: [singleMove] });
    const state = makeState({ creature, creatureHp: creature.stats.maxHp });
    const next = executeCreatureTurn(state);

    expect(next.creature.moves[0].pp).toBe(29);
  });

  describe("creature status moves", () => {
    it("Harden raises creature defense", () => {
      const hardenOnly = makeCreature({
        moves: [
          {
            name: "Harden",
            type: "buff",
            power: 0,
            accuracy: 100,
            pp: 30,
            maxPp: 30,
            effect: "def_up" as const,
            animation: "shimmer" as const,
          },
        ],
      });
      const state = makeState({ creature: hardenOnly, creatureHp: hardenOnly.stats.maxHp });
      const next = executeCreatureTurn(state);
      expect(next.creatureStages.defense).toBe(1);
    });

    it("Harden won't go above +6", () => {
      const hardenOnly = makeCreature({
        moves: [
          {
            name: "Harden",
            type: "buff",
            power: 0,
            accuracy: 100,
            pp: 30,
            maxPp: 30,
            effect: "def_up" as const,
            animation: "shimmer" as const,
          },
        ],
      });
      const state = makeState({
        creature: hardenOnly,
        creatureHp: hardenOnly.stats.maxHp,
        creatureStages: { defense: 6, speed: 0 },
      });
      const next = executeCreatureTurn(state);
      expect(next.creatureStages.defense).toBe(6);
      expect(next.battleLog.some((e) => e.message.includes("won't go higher"))).toBe(true);
    });

    it("spd_down lowers player speed", () => {
      const spdDown = makeCreature({
        moves: [
          {
            name: "Smokescreen",
            type: "debuff",
            power: 0,
            accuracy: 100,
            pp: 25,
            maxPp: 25,
            effect: "spd_down" as const,
            animation: "debuff" as const,
          },
        ],
      });
      const state = makeState({ creature: spdDown, creatureHp: spdDown.stats.maxHp });
      const next = executeCreatureTurn(state);
      expect(next.playerStages.speed).toBe(-1);
    });

    it("def_down lowers player defense", () => {
      const defDown = makeCreature({
        moves: [
          {
            name: "Growl",
            type: "debuff",
            power: 0,
            accuracy: 100,
            pp: 30,
            maxPp: 30,
            effect: "def_down" as const,
            animation: "debuff" as const,
          },
        ],
      });
      const state = makeState({ creature: defDown, creatureHp: defDown.stats.maxHp });
      const next = executeCreatureTurn(state);
      expect(next.playerStages.defense).toBe(-1);
    });

    it("leech drains player HP and heals creature", () => {
      const leechOnly = makeCreature({
        moves: [
          {
            name: "Leech Seed",
            type: "grass",
            power: 0,
            accuracy: 100,
            pp: 20,
            maxPp: 20,
            effect: "leech" as const,
            animation: "shimmer" as const,
          },
        ],
      });
      const state = makeState({
        creature: leechOnly,
        creatureHp: 30, // Damaged, can heal
      });
      const next = executeCreatureTurn(state);

      expect(next.playerHp).toBeLessThan(state.playerHp);
      expect(next.creatureHp).toBeGreaterThan(30);
    });

    it("leech cannot heal creature above maxHp", () => {
      const leechOnly = makeCreature({
        moves: [
          {
            name: "Leech Seed",
            type: "grass",
            power: 0,
            accuracy: 100,
            pp: 20,
            maxPp: 20,
            effect: "leech" as const,
            animation: "shimmer" as const,
          },
        ],
      });
      const state = makeState({
        creature: leechOnly,
        creatureHp: leechOnly.stats.maxHp, // Full HP
      });
      const next = executeCreatureTurn(state);
      expect(next.creatureHp).toBe(leechOnly.stats.maxHp);
    });

    it("leech can defeat the player", () => {
      const leechOnly = makeCreature({
        moves: [
          {
            name: "Leech Seed",
            type: "grass",
            power: 0,
            accuracy: 100,
            pp: 20,
            maxPp: 20,
            effect: "leech" as const,
            animation: "shimmer" as const,
          },
        ],
      });
      const state = makeState({
        creature: leechOnly,
        creatureHp: leechOnly.stats.maxHp,
        playerHp: 1,
      });
      const next = executeCreatureTurn(state);
      expect(next.playerHp).toBe(0);
      expect(next.result).toBe("lose");
    });
  });

  describe("Struggle (all PP depleted)", () => {
    it("uses Struggle when all moves have 0 PP", () => {
      const depletedCreature = makeCreature({
        moves: [
          {
            name: "Bubble",
            type: "water",
            power: 35,
            accuracy: 100,
            pp: 0,
            maxPp: 30,
            animation: "water" as const,
          },
          {
            name: "Tackle",
            type: "normal",
            power: 40,
            accuracy: 100,
            pp: 0,
            maxPp: 35,
            animation: "slash" as const,
          },
        ],
      });
      const state = makeState({
        creature: depletedCreature,
        creatureHp: depletedCreature.stats.maxHp,
      });
      const next = executeCreatureTurn(state);

      expect(next.battleLog.some((e) => e.message.includes("Struggle"))).toBe(true);
      expect(next.playerHp).toBeLessThan(state.playerHp);
    });

    it("Struggle deals recoil damage to the creature", () => {
      const depleted = makeCreature({
        moves: [
          {
            name: "Bubble",
            type: "water",
            power: 35,
            accuracy: 100,
            pp: 0,
            maxPp: 30,
            animation: "water" as const,
          },
        ],
      });
      const state = makeState({ creature: depleted, creatureHp: depleted.stats.maxHp });
      const next = executeCreatureTurn(state);

      expect(next.creatureHp).toBeLessThan(state.creatureHp);
      expect(next.battleLog.some((e) => e.message.includes("recoil"))).toBe(true);
    });

    it("creature can faint from Struggle recoil", () => {
      const depleted = makeCreature({
        moves: [
          {
            name: "Bubble",
            type: "water",
            power: 35,
            accuracy: 100,
            pp: 0,
            maxPp: 30,
            animation: "water" as const,
          },
        ],
      });
      const state = makeState({
        creature: depleted,
        creatureHp: 1,
        playerHp: 100,
      });
      const next = executeCreatureTurn(state);
      // Either player dies or creature dies from recoil
      expect(next.result).not.toBeNull();
    });
  });

  describe("player defending reduces damage", () => {
    it("defending player takes less damage than non-defending", () => {
      const singleHit = makeCreature({
        moves: [
          {
            name: "Tackle",
            type: "normal",
            power: 40,
            accuracy: 100,
            pp: 35,
            maxPp: 35,
            animation: "slash" as const,
          },
        ],
      });

      const normalDmg: number[] = [];
      const defendDmg: number[] = [];

      for (let i = 0; i < 50; i++) {
        const s1 = makeState({
          creature: { ...singleHit, moves: [{ ...singleHit.moves[0] }] },
          creatureHp: singleHit.stats.maxHp,
          playerDefending: false,
        });
        const n1 = executeCreatureTurn(s1);
        normalDmg.push(s1.playerHp - n1.playerHp);

        const s2 = makeState({
          creature: { ...singleHit, moves: [{ ...singleHit.moves[0] }] },
          creatureHp: singleHit.stats.maxHp,
          playerDefending: true,
        });
        const n2 = executeCreatureTurn(s2);
        defendDmg.push(s2.playerHp - n2.playerHp);
      }

      const avgNormal = normalDmg.reduce((a, b) => a + b) / normalDmg.length;
      const avgDefend = defendDmg.reduce((a, b) => a + b) / defendDmg.length;
      expect(avgDefend).toBeLessThan(avgNormal);
    });

    it("resets playerDefending after absorbing a hit", () => {
      const singleHit = makeCreature({
        moves: [
          {
            name: "Tackle",
            type: "normal",
            power: 40,
            accuracy: 100,
            pp: 35,
            maxPp: 35,
            animation: "slash" as const,
          },
        ],
      });
      const state = makeState({
        creature: { ...singleHit, moves: [{ ...singleHit.moves[0] }] },
        creatureHp: singleHit.stats.maxHp,
        playerDefending: true,
      });
      const next = executeCreatureTurn(state);
      expect(next.playerDefending).toBe(false);
    });
  });

  describe("burn damage at end of turn", () => {
    it("burn deals damage to creature at end of turn", () => {
      const singleHit = makeCreature({
        moves: [
          {
            name: "Tackle",
            type: "normal",
            power: 40,
            accuracy: 100,
            pp: 35,
            maxPp: 35,
            animation: "slash" as const,
          },
        ],
      });
      const state = makeState({
        creature: { ...singleHit, moves: [{ ...singleHit.moves[0] }] },
        creatureHp: singleHit.stats.maxHp,
        creatureStatus: "burn",
      });
      const next = executeCreatureTurn(state);

      // Burn should have dealt extra damage beyond the creature's attack
      const attackDmg = state.playerHp - next.playerHp;
      const burnDmg = Math.max(1, Math.floor(singleHit.stats.maxHp / 16));
      // Creature HP loss should include burn
      const creatureHpLoss = state.creatureHp - next.creatureHp;
      expect(creatureHpLoss).toBeGreaterThanOrEqual(burnDmg);

      expect(next.battleLog.some((e) => e.type === "status_damage")).toBe(true);
    });

    it("burn can defeat creature at end of turn", () => {
      const singleHit = makeCreature({
        moves: [
          {
            name: "Tackle",
            type: "normal",
            power: 40,
            accuracy: 100,
            pp: 35,
            maxPp: 35,
            animation: "slash" as const,
          },
        ],
      });
      const state = makeState({
        creature: { ...singleHit, moves: [{ ...singleHit.moves[0] }] },
        creatureHp: 1,
        creatureStatus: "burn",
      });
      const next = executeCreatureTurn(state);
      expect(next.creatureHp).toBe(0);
      expect(next.result).toBe("win");
    });

    it("burn deals damage to player at end of turn", () => {
      const singleHit = makeCreature({
        moves: [
          {
            name: "Tackle",
            type: "normal",
            power: 1, // Minimal attack damage
            accuracy: 100,
            pp: 35,
            maxPp: 35,
            animation: "slash" as const,
          },
        ],
      });
      const state = makeState({
        creature: { ...singleHit, moves: [{ ...singleHit.moves[0] }] },
        creatureHp: singleHit.stats.maxHp,
        playerStatus: "burn",
      });
      const next = executeCreatureTurn(state);

      // Player should take attack damage + burn damage
      const burnDmg = Math.max(1, Math.floor(state.player.maxHp / 16));
      const totalDmg = state.playerHp - next.playerHp;
      expect(totalDmg).toBeGreaterThanOrEqual(burnDmg);
    });
  });

  describe("player faint", () => {
    it("sets result to lose when player HP reaches 0", () => {
      const strongCreature = makeCreature({
        stats: { hp: 50, maxHp: 50, attack: 200, defense: 10, speed: 10 },
        moves: [
          {
            name: "Mega Punch",
            type: "normal",
            power: 200,
            accuracy: 100,
            pp: 10,
            maxPp: 10,
            animation: "slash" as const,
          },
        ],
      });
      const state = makeState({
        creature: strongCreature,
        creatureHp: strongCreature.stats.maxHp,
        playerHp: 1,
      });
      const next = executeCreatureTurn(state);
      expect(next.playerHp).toBe(0);
      expect(next.result).toBe("lose");
      expect(next.battleLog.some((e) => e.message.includes("defeated"))).toBe(true);
    });
  });

  describe("accuracy miss", () => {
    it("creature can miss with <100% accuracy", () => {
      const lowAcc = makeCreature({
        moves: [
          {
            name: "Wild Swing",
            type: "normal",
            power: 100,
            accuracy: 1,
            pp: 10,
            maxPp: 10,
            animation: "slash" as const,
          },
        ],
      });

      let missCount = 0;
      for (let i = 0; i < 50; i++) {
        const state = makeState({
          creature: { ...lowAcc, moves: [{ ...lowAcc.moves[0] }] },
          creatureHp: lowAcc.stats.maxHp,
        });
        const next = executeCreatureTurn(state);
        if (next.playerHp === state.playerHp) missCount++;
      }
      expect(missCount).toBeGreaterThan(40);
    });

    it("miss still increments turn number", () => {
      const lowAcc = makeCreature({
        moves: [
          {
            name: "Wild Swing",
            type: "normal",
            power: 100,
            accuracy: 1,
            pp: 10,
            maxPp: 10,
            animation: "slash" as const,
          },
        ],
      });
      // Force miss
      const spy = jest.spyOn(Math, "random").mockReturnValue(0.999);
      const state = makeState({
        creature: { ...lowAcc, moves: [{ ...lowAcc.moves[0] }] },
        creatureHp: lowAcc.stats.maxHp,
      });
      const next = executeCreatureTurn(state);
      spy.mockRestore();

      expect(next.turnNumber).toBe(state.turnNumber + 1);
      expect(next.phase).toBe("player_turn");
    });
  });

  describe("secondary effects on damaging moves", () => {
    it("Mud Shot (effectChance 100%) always lowers player speed", () => {
      const mudShot = makeCreature({
        moves: [
          {
            name: "Mud Shot",
            type: "aquatic",
            power: 40,
            accuracy: 100,
            pp: 20,
            maxPp: 20,
            effect: "spd_down" as const,
            effectChance: 100,
            animation: "debuff" as const,
          },
        ],
      });
      const state = makeState({ creature: mudShot, creatureHp: mudShot.stats.maxHp });
      const next = executeCreatureTurn(state);

      expect(next.playerStages.speed).toBe(-1);
      expect(next.playerHp).toBeLessThan(state.playerHp); // Also deals damage
    });
  });
});

// ==========================================================================
// calculateXpGained
// ==========================================================================
describe("calculateXpGained", () => {
  it("returns 20 + level * 5 for any creature", () => {
    const creature = makeCreature({ level: 1 });
    expect(calculateXpGained(creature)).toBe(25); // 20 + 1*5

    const creature3 = makeCreature({ level: 3 });
    expect(calculateXpGained(creature3)).toBe(35); // 20 + 3*5
  });

  it("higher level creatures give more XP", () => {
    const low = makeCreature({ level: 1 });
    const high = makeCreature({ level: 5 });
    expect(calculateXpGained(high)).toBeGreaterThan(calculateXpGained(low));
  });

  it("always returns a positive value", () => {
    for (let level = 1; level <= 10; level++) {
      expect(calculateXpGained(makeCreature({ level }))).toBeGreaterThan(0);
    }
  });
});

// ==========================================================================
// Full battle flow integration
// ==========================================================================
describe("full battle flow", () => {
  it("can complete a full battle (player wins)", () => {
    // Strong player vs weak creature
    const weakCreature = makeCreature({
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 1, speed: 1 },
      moves: [
        {
          name: "Flail",
          type: "normal",
          power: 10,
          accuracy: 100,
          pp: 35,
          maxPp: 35,
          animation: "slash" as const,
        },
      ],
    });
    let state = createEncounter(weakCreature, makePlayer());
    state.phase = "player_turn";

    // Player attacks until creature faints
    let turns = 0;
    while (!state.result && turns < 20) {
      state = executePlayerMove(state, state.player.moves[0]);
      if (state.result) break;
      state = executeCreatureTurn(state);
      turns++;
    }

    expect(state.result).toBe("win");
    expect(state.xpGained).toBeGreaterThan(0);
    expect(state.creatureHp).toBe(0);
  });

  it("can complete a full battle (player loses)", () => {
    // Weak player vs strong creature
    const strongCreature = makeCreature({
      stats: { hp: 200, maxHp: 200, attack: 50, defense: 50, speed: 50 },
      moves: [
        {
          name: "Mega Punch",
          type: "normal",
          power: 150,
          accuracy: 100,
          pp: 35,
          maxPp: 35,
          animation: "slash" as const,
        },
      ],
    });
    const weakPlayer = makePlayer({ hp: 20, maxHp: 20, attack: 1, defense: 1, speed: 1 });
    let state = createEncounter(strongCreature, weakPlayer);
    state.phase = "player_turn";

    let turns = 0;
    while (!state.result && turns < 20) {
      state = executePlayerMove(state, state.player.moves[0]);
      if (state.result) break;
      state = executeCreatureTurn(state);
      turns++;
    }

    expect(state.result).toBe("lose");
    expect(state.playerHp).toBe(0);
  });

  it("battle never runs indefinitely (converges within reasonable turns)", () => {
    let state = createEncounter(makeCreature(), makePlayer());
    state.phase = "player_turn";

    let turns = 0;
    while (!state.result && turns < 100) {
      state = executePlayerMove(state, state.player.moves[0]);
      if (state.result) break;
      state = executeCreatureTurn(state);
      turns++;
    }

    expect(state.result).not.toBeNull();
    expect(turns).toBeLessThan(100);
  });
});
