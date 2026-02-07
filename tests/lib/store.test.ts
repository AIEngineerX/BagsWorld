import { useGameStore } from "@/lib/store";
import type { WorldState, GameCharacter, GameBuilding, ZoneType } from "@/lib/types";

function createWorldState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    health: 50,
    weather: "sunny",
    population: [],
    buildings: [],
    events: [],
    timeInfo: { hour: 12, isDay: true, period: "afternoon" },
    ...overrides,
  } as WorldState;
}

function createCharacter(overrides: Partial<GameCharacter> = {}): GameCharacter {
  return {
    id: "test-char",
    username: "TestCharacter",
    provider: "twitter",
    providerUsername: "testchar",
    x: 100,
    y: 555,
    mood: "happy",
    earnings24h: 0,
    direction: "right",
    isMoving: false,
    ...overrides,
  } as GameCharacter;
}

function createBuilding(overrides: Partial<GameBuilding> = {}): GameBuilding {
  return {
    id: "test-building",
    symbol: "TEST",
    name: "Test Building",
    mint: "test-mint",
    x: 200,
    y: 500,
    level: 1,
    health: 100,
    ...overrides,
  } as GameBuilding;
}

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.setState({
      worldState: null,
      isLoading: true,
      error: null,
      selectedCharacter: null,
      selectedBuilding: null,
      currentZone: "main_city",
    });
  });

  describe("initial state", () => {
    it("has null worldState", () => {
      expect(useGameStore.getState().worldState).toBeNull();
    });

    it("has isLoading = true", () => {
      expect(useGameStore.getState().isLoading).toBe(true);
    });

    it("has null error", () => {
      expect(useGameStore.getState().error).toBeNull();
    });

    it("has null selectedCharacter", () => {
      expect(useGameStore.getState().selectedCharacter).toBeNull();
    });

    it("has null selectedBuilding", () => {
      expect(useGameStore.getState().selectedBuilding).toBeNull();
    });

    it("has main_city as default zone", () => {
      expect(useGameStore.getState().currentZone).toBe("main_city");
    });
  });

  describe("setWorldState", () => {
    it("sets worldState and clears loading/error", () => {
      useGameStore.getState().setError("some error");
      const ws = createWorldState({ health: 75 });
      useGameStore.getState().setWorldState(ws);

      expect(useGameStore.getState().worldState).toBe(ws);
      expect(useGameStore.getState().worldState!.health).toBe(75);
      expect(useGameStore.getState().isLoading).toBe(false);
      expect(useGameStore.getState().error).toBeNull();
    });

    it("replaces previous worldState", () => {
      useGameStore.getState().setWorldState(createWorldState({ health: 50 }));
      useGameStore.getState().setWorldState(createWorldState({ health: 90 }));
      expect(useGameStore.getState().worldState!.health).toBe(90);
    });
  });

  describe("setLoading", () => {
    it("sets isLoading", () => {
      useGameStore.getState().setLoading(false);
      expect(useGameStore.getState().isLoading).toBe(false);
      useGameStore.getState().setLoading(true);
      expect(useGameStore.getState().isLoading).toBe(true);
    });
  });

  describe("setError", () => {
    it("sets error and clears loading", () => {
      useGameStore.getState().setLoading(true);
      useGameStore.getState().setError("Network error");
      expect(useGameStore.getState().error).toBe("Network error");
      expect(useGameStore.getState().isLoading).toBe(false);
    });

    it("clears error with null", () => {
      useGameStore.getState().setError("some error");
      useGameStore.getState().setError(null);
      expect(useGameStore.getState().error).toBeNull();
    });
  });

  describe("selectCharacter", () => {
    it("sets selectedCharacter and clears selectedBuilding", () => {
      useGameStore.getState().selectBuilding(createBuilding());
      const char = createCharacter({ id: "finn" });
      useGameStore.getState().selectCharacter(char);

      expect(useGameStore.getState().selectedCharacter).toBe(char);
      expect(useGameStore.getState().selectedBuilding).toBeNull();
    });

    it("deselects with null", () => {
      useGameStore.getState().selectCharacter(createCharacter());
      useGameStore.getState().selectCharacter(null);
      expect(useGameStore.getState().selectedCharacter).toBeNull();
    });
  });

  describe("selectBuilding", () => {
    it("sets selectedBuilding and clears selectedCharacter", () => {
      useGameStore.getState().selectCharacter(createCharacter());
      const building = createBuilding({ symbol: "BAGS" });
      useGameStore.getState().selectBuilding(building);

      expect(useGameStore.getState().selectedBuilding).toBe(building);
      expect(useGameStore.getState().selectedCharacter).toBeNull();
    });

    it("deselects with null", () => {
      useGameStore.getState().selectBuilding(createBuilding());
      useGameStore.getState().selectBuilding(null);
      expect(useGameStore.getState().selectedBuilding).toBeNull();
    });
  });

  describe("setZone", () => {
    const allZones: ZoneType[] = [
      "labs", "moltbook", "main_city", "trending",
      "ballers", "founders", "arena", "dungeon",
    ];

    allZones.forEach((zone) => {
      it(`sets currentZone to "${zone}"`, () => {
        useGameStore.getState().setZone(zone);
        expect(useGameStore.getState().currentZone).toBe(zone);
      });
    });
  });

  describe("mutual exclusion", () => {
    it("rapid toggling maintains exclusion", () => {
      const char = createCharacter();
      const building = createBuilding();

      useGameStore.getState().selectCharacter(char);
      useGameStore.getState().selectBuilding(building);
      useGameStore.getState().selectCharacter(char);
      useGameStore.getState().selectBuilding(building);
      useGameStore.getState().selectCharacter(char);

      expect(useGameStore.getState().selectedCharacter).toBe(char);
      expect(useGameStore.getState().selectedBuilding).toBeNull();
    });
  });

  describe("sequential transitions", () => {
    it("loading → data → error → recovery", () => {
      expect(useGameStore.getState().isLoading).toBe(true);

      useGameStore.getState().setWorldState(createWorldState({ health: 60 }));
      expect(useGameStore.getState().isLoading).toBe(false);
      expect(useGameStore.getState().worldState!.health).toBe(60);

      useGameStore.getState().setError("API timeout");
      expect(useGameStore.getState().error).toBe("API timeout");
      expect(useGameStore.getState().worldState).not.toBeNull();

      useGameStore.getState().setWorldState(createWorldState({ health: 80 }));
      expect(useGameStore.getState().error).toBeNull();
      expect(useGameStore.getState().worldState!.health).toBe(80);
    });
  });
});
