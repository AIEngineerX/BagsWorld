/**
 * ZONES Constant Integrity Tests
 *
 * Tests the ZONES record and ZoneType with:
 * - All 7 zones present
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
];

describe("ZONES constant", () => {
  describe("completeness", () => {
    it("contains exactly 7 zones", () => {
      expect(Object.keys(ZONES)).toHaveLength(7);
    });

    ALL_ZONE_IDS.forEach((zoneId) => {
      it(`contains zone "${zoneId}"`, () => {
        expect(ZONES[zoneId]).toBeDefined();
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
  });
});
