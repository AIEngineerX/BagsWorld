/**
 * ZONES Constant Integrity Tests
 *
 * Tests the ZONES record and ZoneType with:
 * - All 8 zones present (including dungeon)
 * - Each zone has required fields (id, name, description, icon)
 * - Zone IDs are self-consistent (id matches key)
 * - No empty strings in any field
 * - Icon format consistency
 * - Description uniqueness
 */

import { ZONES, ZoneType, ZoneInfo } from "@/lib/types";

const ALL_ZONE_IDS: ZoneType[] = [
  "labs",
  "moltbook",
  "main_city",
  "trending",
  "ballers",
  "founders",
  "arena",
  "dungeon",
];

describe("ZONES constant", () => {
  describe("completeness", () => {
    it("contains exactly 8 zones", () => {
      expect(Object.keys(ZONES)).toHaveLength(8);
    });

    it("ZONES keys match ALL_ZONE_IDS exactly", () => {
      const keys = Object.keys(ZONES).sort();
      const expected = [...ALL_ZONE_IDS].sort();
      expect(keys).toEqual(expected);
    });

    ALL_ZONE_IDS.forEach((zoneId) => {
      it(`contains zone "${zoneId}"`, () => {
        expect(ZONES[zoneId]).toBeDefined();
      });
    });

    it("has no unexpected extra zones", () => {
      const zoneKeys = Object.keys(ZONES);
      zoneKeys.forEach((key) => {
        expect(ALL_ZONE_IDS).toContain(key);
      });
    });
  });

  describe("structure validation", () => {
    ALL_ZONE_IDS.forEach((zoneId) => {
      describe(`zone "${zoneId}"`, () => {
        let zone: ZoneInfo;

        beforeAll(() => {
          zone = ZONES[zoneId];
        });

        it("has an id field matching its key", () => {
          expect(zone.id).toBe(zoneId);
        });

        it("has a non-empty name", () => {
          expect(zone.name).toBeDefined();
          expect(typeof zone.name).toBe("string");
          expect(zone.name.length).toBeGreaterThan(0);
        });

        it("has a non-empty description", () => {
          expect(zone.description).toBeDefined();
          expect(typeof zone.description).toBe("string");
          expect(zone.description.length).toBeGreaterThan(0);
        });

        it("has a non-empty icon", () => {
          expect(zone.icon).toBeDefined();
          expect(typeof zone.icon).toBe("string");
          expect(zone.icon.length).toBeGreaterThan(0);
        });

        it("icon is in bracket format [X]", () => {
          expect(zone.icon).toMatch(/^\[.\]$/);
        });
      });
    });
  });

  describe("consistency", () => {
    it("all zone names are unique", () => {
      const names = Object.values(ZONES).map((z) => z.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });

    it("all zone descriptions are unique", () => {
      const descs = Object.values(ZONES).map((z) => z.description);
      const unique = new Set(descs);
      expect(unique.size).toBe(descs.length);
    });

    it("all zone icons are unique", () => {
      const icons = Object.values(ZONES).map((z) => z.icon);
      const unique = new Set(icons);
      expect(unique.size).toBe(icons.length);
    });

    it("all zone IDs are lowercase with underscores only", () => {
      Object.keys(ZONES).forEach((key) => {
        expect(key).toMatch(/^[a-z_]+$/);
      });
    });
  });

  describe("specific zone data", () => {
    it("labs zone has name 'HQ'", () => {
      expect(ZONES.labs.name).toBe("HQ");
    });

    it("main_city zone has name 'Park'", () => {
      expect(ZONES.main_city.name).toBe("Park");
    });

    it("trending zone has name 'BagsCity'", () => {
      expect(ZONES.trending.name).toBe("BagsCity");
    });

    it("ballers zone has name 'Ballers Valley'", () => {
      expect(ZONES.ballers.name).toBe("Ballers Valley");
    });

    it("founders zone has name \"Founder's Corner\"", () => {
      expect(ZONES.founders.name).toBe("Founder's Corner");
    });

    it("arena zone has name 'MoltBook Arena'", () => {
      expect(ZONES.arena.name).toBe("MoltBook Arena");
    });

    it("moltbook zone has name 'Moltbook Beach'", () => {
      expect(ZONES.moltbook.name).toBe("Moltbook Beach");
    });

    it("dungeon zone has name 'BagsDungeon'", () => {
      expect(ZONES.dungeon.name).toBe("BagsDungeon");
    });

    it("dungeon zone has icon '[D]'", () => {
      expect(ZONES.dungeon.icon).toBe("[D]");
    });

    it("dungeon zone description mentions dungeon/MMORPG", () => {
      expect(ZONES.dungeon.description.length).toBeGreaterThan(0);
      expect(
        ZONES.dungeon.description.toLowerCase().includes("dungeon") ||
          ZONES.dungeon.description.toLowerCase().includes("mmorpg")
      ).toBe(true);
    });
  });

  describe("field length constraints", () => {
    it("all zone names are under 30 characters", () => {
      Object.values(ZONES).forEach((zone) => {
        expect(zone.name.length).toBeLessThan(30);
      });
    });

    it("all zone descriptions are under 200 characters", () => {
      Object.values(ZONES).forEach((zone) => {
        expect(zone.description.length).toBeLessThan(200);
      });
    });

    it("all zone icons are exactly 3 characters ([X] format)", () => {
      Object.values(ZONES).forEach((zone) => {
        expect(zone.icon.length).toBe(3);
      });
    });
  });
});
