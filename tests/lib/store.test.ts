/**
 * Zustand Game Store Tests
 *
 * Tests all store state transitions with:
 * - Default initial state verification
 * - Each action's effect on state
 * - Mutual exclusion (character vs building selection)
 * - Error/loading state clearing
 * - Zone transitions for all zone types
 * - Sequential state transitions
 */

import { useGameStore } from "@/lib/store";
import type { WorldState, GameCharacter, GameBuilding, ZoneType } from "@/lib/types";
import { act } from "@testing-library/react";

// Helper to create a minimal WorldState
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

// Helper to create a minimal GameCharacter
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

// Helper to create a minimal GameBuilding
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
  // Reset store before each test
  beforeEach(() => {
    const { setState } = useGameStore;
    setState({
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
    it("sets worldState", () => {
      const ws = createWorldState({ health: 75 });
      useGameStore.getState().setWorldState(ws);
      expect(useGameStore.getState().worldState).toBe(ws);
      expect(useGameStore.getState().worldState!.health).toBe(75);
    });

    it("clears isLoading to false", () => {
      expect(useGameStore.getState().isLoading).toBe(true);
      useGameStore.getState().setWorldState(createWorldState());
      expect(useGameStore.getState().isLoading).toBe(false);
    });

    it("clears error to null", () => {
      useGameStore.getState().setError("some error");
      expect(useGameStore.getState().error).toBe("some error");
      useGameStore.getState().setWorldState(createWorldState());
      expect(useGameStore.getState().error).toBeNull();
    });

    it("replaces previous worldState", () => {
      const ws1 = createWorldState({ health: 50 });
      const ws2 = createWorldState({ health: 90 });
      useGameStore.getState().setWorldState(ws1);
      expect(useGameStore.getState().worldState!.health).toBe(50);
      useGameStore.getState().setWorldState(ws2);
      expect(useGameStore.getState().worldState!.health).toBe(90);
    });
  });

  describe("setLoading", () => {
    it("sets isLoading to true", () => {
      useGameStore.getState().setWorldState(createWorldState()); // sets false
      expect(useGameStore.getState().isLoading).toBe(false);
      useGameStore.getState().setLoading(true);
      expect(useGameStore.getState().isLoading).toBe(true);
    });

    it("sets isLoading to false", () => {
      useGameStore.getState().setLoading(false);
      expect(useGameStore.getState().isLoading).toBe(false);
    });
  });

  describe("setError", () => {
    it("sets error string", () => {
      useGameStore.getState().setError("Network error");
      expect(useGameStore.getState().error).toBe("Network error");
    });

    it("clears isLoading to false", () => {
      useGameStore.getState().setLoading(true);
      useGameStore.getState().setError("error");
      expect(useGameStore.getState().isLoading).toBe(false);
    });

    it("clears error to null", () => {
      useGameStore.getState().setError("some error");
      useGameStore.getState().setError(null);
      expect(useGameStore.getState().error).toBeNull();
    });

    it("sets empty string as error", () => {
      useGameStore.getState().setError("");
      expect(useGameStore.getState().error).toBe("");
    });
  });

  describe("selectCharacter", () => {
    it("sets selectedCharacter", () => {
      const char = createCharacter({ id: "finn" });
      useGameStore.getState().selectCharacter(char);
      expect(useGameStore.getState().selectedCharacter).toBe(char);
      expect(useGameStore.getState().selectedCharacter!.id).toBe("finn");
    });

    it("clears selectedBuilding (mutual exclusion)", () => {
      const building = createBuilding();
      useGameStore.getState().selectBuilding(building);
      expect(useGameStore.getState().selectedBuilding).not.toBeNull();

      useGameStore.getState().selectCharacter(createCharacter());
      expect(useGameStore.getState().selectedBuilding).toBeNull();
    });

    it("deselects character when called with null", () => {
      useGameStore.getState().selectCharacter(createCharacter());
      expect(useGameStore.getState().selectedCharacter).not.toBeNull();
      useGameStore.getState().selectCharacter(null);
      expect(useGameStore.getState().selectedCharacter).toBeNull();
    });

    it("replaces previous character", () => {
      const char1 = createCharacter({ id: "ash" });
      const char2 = createCharacter({ id: "toly" });
      useGameStore.getState().selectCharacter(char1);
      expect(useGameStore.getState().selectedCharacter!.id).toBe("ash");
      useGameStore.getState().selectCharacter(char2);
      expect(useGameStore.getState().selectedCharacter!.id).toBe("toly");
    });
  });

  describe("selectBuilding", () => {
    it("sets selectedBuilding", () => {
      const building = createBuilding({ symbol: "BAGS" });
      useGameStore.getState().selectBuilding(building);
      expect(useGameStore.getState().selectedBuilding).toBe(building);
      expect(useGameStore.getState().selectedBuilding!.symbol).toBe("BAGS");
    });

    it("clears selectedCharacter (mutual exclusion)", () => {
      const char = createCharacter();
      useGameStore.getState().selectCharacter(char);
      expect(useGameStore.getState().selectedCharacter).not.toBeNull();

      useGameStore.getState().selectBuilding(createBuilding());
      expect(useGameStore.getState().selectedCharacter).toBeNull();
    });

    it("deselects building when called with null", () => {
      useGameStore.getState().selectBuilding(createBuilding());
      expect(useGameStore.getState().selectedBuilding).not.toBeNull();
      useGameStore.getState().selectBuilding(null);
      expect(useGameStore.getState().selectedBuilding).toBeNull();
    });
  });

  describe("setZone", () => {
    const allZones: ZoneType[] = [
      "labs",
      "moltbook",
      "main_city",
      "trending",
      "ballers",
      "founders",
      "arena",
    ];

    allZones.forEach((zone) => {
      it(`sets currentZone to "${zone}"`, () => {
        useGameStore.getState().setZone(zone);
        expect(useGameStore.getState().currentZone).toBe(zone);
      });
    });

    it("replaces previous zone", () => {
      useGameStore.getState().setZone("labs");
      expect(useGameStore.getState().currentZone).toBe("labs");
      useGameStore.getState().setZone("arena");
      expect(useGameStore.getState().currentZone).toBe("arena");
    });
  });

  describe("mutual exclusion between character and building", () => {
    it("selecting character then building clears character", () => {
      useGameStore.getState().selectCharacter(createCharacter());
      useGameStore.getState().selectBuilding(createBuilding());
      expect(useGameStore.getState().selectedCharacter).toBeNull();
      expect(useGameStore.getState().selectedBuilding).not.toBeNull();
    });

    it("selecting building then character clears building", () => {
      useGameStore.getState().selectBuilding(createBuilding());
      useGameStore.getState().selectCharacter(createCharacter());
      expect(useGameStore.getState().selectedBuilding).toBeNull();
      expect(useGameStore.getState().selectedCharacter).not.toBeNull();
    });

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

  describe("sequential state transitions", () => {
    it("loading → worldState → error → worldState flow", () => {
      const store = useGameStore.getState();

      // Initial: loading
      expect(store.isLoading).toBe(true);

      // Load world state
      useGameStore.getState().setWorldState(createWorldState({ health: 60 }));
      expect(useGameStore.getState().isLoading).toBe(false);
      expect(useGameStore.getState().error).toBeNull();
      expect(useGameStore.getState().worldState!.health).toBe(60);

      // Error occurs
      useGameStore.getState().setError("API timeout");
      expect(useGameStore.getState().isLoading).toBe(false);
      expect(useGameStore.getState().error).toBe("API timeout");
      // worldState should still be present (error doesn't clear it)
      expect(useGameStore.getState().worldState).not.toBeNull();

      // Recovery: new world state
      useGameStore.getState().setWorldState(createWorldState({ health: 80 }));
      expect(useGameStore.getState().error).toBeNull();
      expect(useGameStore.getState().worldState!.health).toBe(80);
    });
  });
});
