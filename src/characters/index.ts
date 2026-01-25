// Character registry - all BagsWorld AI characters
// Each character uses Opus 4.5 for intelligent, personality-driven responses

import {
  bagsBotCharacter,
  generateCharacterPrompt,
  type CharacterDefinition,
} from "./bags-bot.character";
import { neoCharacter } from "./neo.character";
import { finnCharacter } from "./finn.character";
import { ghostCharacter } from "./ghost.character";
import { ashCharacter } from "./ash.character";
import { cjCharacter } from "./cj.character";
import { shawCharacter } from "./shaw.character";

// Export all characters
export { bagsBotCharacter } from "./bags-bot.character";
export { neoCharacter } from "./neo.character";
export { finnCharacter } from "./finn.character";
export { ghostCharacter } from "./ghost.character";
export { ashCharacter } from "./ash.character";
export { cjCharacter } from "./cj.character";
export { shawCharacter } from "./shaw.character";

// Export types and utilities
export { generateCharacterPrompt, type CharacterDefinition } from "./bags-bot.character";

// Character registry by ID
export const characters: Record<string, CharacterDefinition> = {
  "bags-bot": bagsBotCharacter,
  neo: neoCharacter,
  finn: finnCharacter,
  ghost: ghostCharacter,
  ash: ashCharacter,
  cj: cjCharacter,
  shaw: shawCharacter,
};

// Get character by ID with fallback
export function getCharacter(id: string): CharacterDefinition {
  return characters[id.toLowerCase()] || bagsBotCharacter;
}

// Get all character IDs
export function getCharacterIds(): string[] {
  return Object.keys(characters);
}

// Character metadata for UI
export const characterMeta: Record<
  string,
  {
    displayName: string;
    role: string;
    color: string;
    icon: string;
  }
> = {
  "bags-bot": {
    displayName: "Bags Bot",
    role: "World Guide",
    color: "#f59e0b", // amber
    icon: "🤖",
  },
  neo: {
    displayName: "Neo",
    role: "The Scout",
    color: "#22c55e", // green (matrix)
    icon: "👁️",
  },
  finn: {
    displayName: "Finn",
    role: "Founder",
    color: "#3b82f6", // blue
    icon: "🎩",
  },
  ghost: {
    displayName: "Ghost",
    role: "The Dev",
    color: "#8b5cf6", // purple
    icon: "👻",
  },
  ash: {
    displayName: "Ash",
    role: "Guide",
    color: "#ef4444", // red (pokemon)
    icon: "⚡",
  },
  cj: {
    displayName: "CJ",
    role: "Hood Rat",
    color: "#f97316", // orange (grove street)
    icon: "🔫",
  },
  shaw: {
    displayName: "Shaw",
    role: "ElizaOS Creator",
    color: "#FF5800", // ElizaOS orange
    icon: "🔶",
  },
};
