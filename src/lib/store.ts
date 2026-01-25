import { create } from "zustand";
import type { WorldState, GameCharacter, GameBuilding, GameStore, ZoneType } from "./types";

export const useGameStore = create<GameStore>((set) => ({
  worldState: null,
  isLoading: true,
  error: null,
  selectedCharacter: null,
  selectedBuilding: null,
  currentZone: "main_city",
  isSniperTowerOpen: false,

  setWorldState: (state: WorldState) => set({ worldState: state, isLoading: false, error: null }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  setError: (error: string | null) => set({ error, isLoading: false }),

  selectCharacter: (character: GameCharacter | null) =>
    set({ selectedCharacter: character, selectedBuilding: null }),

  selectBuilding: (building: GameBuilding | null) =>
    set({ selectedBuilding: building, selectedCharacter: null }),

  setZone: (zone: ZoneType) => set({ currentZone: zone }),

  openSniperTower: () => set({ isSniperTowerOpen: true }),

  closeSniperTower: () => set({ isSniperTowerOpen: false }),
}));
