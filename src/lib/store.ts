import { create } from "zustand";
import type { WorldState, GameCharacter, GameBuilding, GameStore } from "./types";

export const useGameStore = create<GameStore>((set) => ({
  worldState: null,
  isLoading: true,
  error: null,
  selectedCharacter: null,
  selectedBuilding: null,

  setWorldState: (state: WorldState) =>
    set({ worldState: state, isLoading: false, error: null }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  setError: (error: string | null) => set({ error, isLoading: false }),

  selectCharacter: (character: GameCharacter | null) =>
    set({ selectedCharacter: character, selectedBuilding: null }),

  selectBuilding: (building: GameBuilding | null) =>
    set({ selectedBuilding: building, selectedCharacter: null }),
}));
