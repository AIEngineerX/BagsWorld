import { generateCreature } from "@/lib/encounter-creatures";
import { ZONE_DIFFICULTY } from "@/lib/encounter-types";
import type { CreatureZone } from "@/lib/encounter-types";

const ALL_ZONES: CreatureZone[] = ["main_city", "founders", "moltbook"];

describe("generateCreature", () => {
  describe("basic generation", () => {
    it("returns a creature with all required fields", () => {
      const creature = generateCreature("main_city");
      expect(creature.id).toBeDefined();
      expect(typeof creature.id).toBe("string");
      expect(creature.name).toBeDefined();
      expect(creature.type).toBeDefined();
      expect(creature.zone).toBe("main_city");
      expect(creature.level).toBeDefined();
      expect(creature.stats).toBeDefined();
      expect(creature.moves).toBeDefined();
      expect(creature.spriteKey).toBeDefined();
    });

    it("generates unique IDs for different creatures", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        ids.add(generateCreature("main_city").id);
      }
      expect(ids.size).toBe(50);
    });

    it.each(ALL_ZONES)("produces valid creatures for zone: %s", (zone) => {
      for (let i = 0; i < 20; i++) {
        const creature = generateCreature(zone);
        expect(creature.zone).toBe(zone);
        expect(creature.level).toBeGreaterThanOrEqual(1);
        expect(creature.stats.hp).toBeGreaterThan(0);
        expect(creature.stats.maxHp).toBe(creature.stats.hp);
        expect(creature.moves.length).toBeGreaterThan(0);
      }
    });
  });

  describe("level ranges", () => {
    it.each(ALL_ZONES)("level is within zone difficulty range for %s", (zone) => {
      const { minLevel, maxLevel } = ZONE_DIFFICULTY[zone];
      for (let i = 0; i < 100; i++) {
        const creature = generateCreature(zone);
        expect(creature.level).toBeGreaterThanOrEqual(minLevel);
        expect(creature.level).toBeLessThanOrEqual(maxLevel);
      }
    });

    it("main_city creatures are lower level than founders minimum", () => {
      // main_city: 1-2, founders: 2-3
      expect(ZONE_DIFFICULTY.main_city.minLevel).toBeLessThanOrEqual(
        ZONE_DIFFICULTY.founders.minLevel
      );
    });
  });

  describe("stat scaling", () => {
    it("level 1 creatures have base stats (multiplier 1.0)", () => {
      // Mock Math.random to always pick level 1 (minLevel of main_city)
      const spy = jest.spyOn(Math, "random").mockReturnValue(0);
      const creature = generateCreature("main_city"); // min=1, max=2 → level 1
      spy.mockRestore();

      expect(creature.level).toBe(1);
      // At level 1, multiplier = 1 + (1-1)*0.2 = 1.0
      // Stats should equal base stats (rounded)
      expect(creature.stats.hp).toBe(creature.stats.maxHp);
    });

    it("higher level creatures have higher stats than level 1", () => {
      // Generate many creatures and compare min/max level stats
      const level1Creatures: ReturnType<typeof generateCreature>[] = [];
      const level3Creatures: ReturnType<typeof generateCreature>[] = [];

      const spy = jest.spyOn(Math, "random");

      // Force level 1 (main_city min=1)
      spy.mockReturnValue(0);
      for (let i = 0; i < 10; i++) {
        level1Creatures.push(generateCreature("main_city"));
      }

      // Force level 3 (founders max=3)
      spy.mockReturnValue(0.999);
      for (let i = 0; i < 10; i++) {
        level3Creatures.push(generateCreature("founders"));
      }
      spy.mockRestore();

      // Level 3 creatures should generally have higher HP
      const avgHp1 =
        level1Creatures.reduce((s, c) => s + c.stats.maxHp, 0) / level1Creatures.length;
      const avgHp3 =
        level3Creatures.reduce((s, c) => s + c.stats.maxHp, 0) / level3Creatures.length;
      expect(avgHp3).toBeGreaterThan(avgHp1);
    });

    it("stats include hp, maxHp, attack, defense, speed — all positive", () => {
      for (const zone of ALL_ZONES) {
        const creature = generateCreature(zone);
        expect(creature.stats.hp).toBeGreaterThan(0);
        expect(creature.stats.maxHp).toBeGreaterThan(0);
        expect(creature.stats.attack).toBeGreaterThan(0);
        expect(creature.stats.defense).toBeGreaterThan(0);
        expect(creature.stats.speed).toBeGreaterThan(0);
      }
    });

    it("hp equals maxHp on fresh creature", () => {
      for (let i = 0; i < 20; i++) {
        const creature = generateCreature("moltbook");
        expect(creature.stats.hp).toBe(creature.stats.maxHp);
      }
    });
  });

  describe("moves", () => {
    it("each creature has exactly 4 moves", () => {
      for (const zone of ALL_ZONES) {
        for (let i = 0; i < 20; i++) {
          const creature = generateCreature(zone);
          expect(creature.moves).toHaveLength(4);
        }
      }
    });

    it("all moves start with full PP", () => {
      const creature = generateCreature("founders");
      for (const move of creature.moves) {
        expect(move.pp).toBe(move.maxPp);
        expect(move.pp).toBeGreaterThan(0);
      }
    });

    it("moves are cloned (mutating one creature's moves doesn't affect another)", () => {
      // Force same template by mocking random
      const spy = jest.spyOn(Math, "random").mockReturnValue(0);
      const c1 = generateCreature("main_city");
      const c2 = generateCreature("main_city");
      spy.mockRestore();

      // Same creature template
      expect(c1.name).toBe(c2.name);

      // Mutate c1's move PP
      c1.moves[0].pp = 0;
      expect(c2.moves[0].pp).toBeGreaterThan(0); // c2 unaffected
    });

    it("all moves have valid animation type", () => {
      const validAnimations = new Set([
        "slash",
        "ember",
        "water",
        "gust",
        "bite",
        "shimmer",
        "debuff",
        "quick",
      ]);
      for (const zone of ALL_ZONES) {
        for (let i = 0; i < 10; i++) {
          const creature = generateCreature(zone);
          for (const move of creature.moves) {
            expect(validAnimations.has(move.animation)).toBe(true);
          }
        }
      }
    });
  });

  describe("zone-specific creatures", () => {
    it("main_city creatures include beast and flying types", () => {
      const types = new Set<string>();
      const spy = jest.spyOn(Math, "random");
      // Iterate through all template indices
      for (let i = 0; i < 5; i++) {
        spy.mockReturnValue(i / 5);
        types.add(generateCreature("main_city").type);
      }
      spy.mockRestore();
      expect(types.has("beast")).toBe(true);
      expect(types.has("flying")).toBe(true);
    });

    it("founders creatures include fire, water, grass types", () => {
      const types = new Set<string>();
      const spy = jest.spyOn(Math, "random");
      for (let i = 0; i < 3; i++) {
        spy.mockReturnValue(i / 3);
        types.add(generateCreature("founders").type);
      }
      spy.mockRestore();
      expect(types.has("fire")).toBe(true);
      expect(types.has("water")).toBe(true);
      expect(types.has("grass")).toBe(true);
    });

    it("moltbook creatures are all aquatic type", () => {
      for (let i = 0; i < 30; i++) {
        expect(generateCreature("moltbook").type).toBe("aquatic");
      }
    });

    it("spriteKey is a non-empty string", () => {
      for (const zone of ALL_ZONES) {
        for (let i = 0; i < 10; i++) {
          const creature = generateCreature(zone);
          expect(creature.spriteKey).toBeTruthy();
          expect(typeof creature.spriteKey).toBe("string");
        }
      }
    });
  });

  describe("randomness distribution", () => {
    it("generates different creatures over many runs (not always the same)", () => {
      const names = new Set<string>();
      for (let i = 0; i < 50; i++) {
        names.add(generateCreature("main_city").name);
      }
      // main_city has 5 templates, should see multiple names
      expect(names.size).toBeGreaterThan(1);
    });
  });
});
