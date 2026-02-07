import { ZONES, ZoneInfo } from "@/lib/types";

describe("ZONES constant", () => {
  describe("completeness", () => {
    it("contains all expected zones and nothing else", () => {
      const expected = ["labs", "moltbook", "main_city", "trending", "ballers", "founders", "arena", "dungeon"];
      expect(Object.keys(ZONES).sort()).toEqual([...expected].sort());
    });
  });

  describe("structure validation", () => {
    Object.entries(ZONES).forEach(([key, zone]) => {
      describe(`zone "${key}"`, () => {
        it("has id matching its key", () => {
          expect(zone.id).toBe(key);
        });

        it("has non-empty name, description, and icon", () => {
          expect(zone.name.length).toBeGreaterThan(0);
          expect(zone.description.length).toBeGreaterThan(0);
          expect(zone.icon).toMatch(/^\[.\]$/);
        });
      });
    });
  });

  describe("uniqueness", () => {
    it.each(["name", "description", "icon"] as const)("all zone %s values are unique", (field) => {
      const values = Object.values(ZONES).map((z) => z[field]);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe("specific zone data", () => {
    const expectedNames: Record<string, string> = {
      labs: "HQ",
      main_city: "Park",
      trending: "BagsCity",
      ballers: "Ballers Valley",
      founders: "Founder's Corner",
      arena: "MoltBook Arena",
      moltbook: "Moltbook Beach",
      dungeon: "BagsDungeon",
    };

    Object.entries(expectedNames).forEach(([id, name]) => {
      it(`${id} zone has name '${name}'`, () => {
        expect(ZONES[id as keyof typeof ZONES].name).toBe(name);
      });
    });
  });
});
