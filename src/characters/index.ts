// Character registry - all BagsWorld AI characters
// All agents run on ElizaOS framework with Claude Sonnet 4 for intelligent, personality-driven responses
// Characters are organized by the zone they primarily appear in

import {
  bagsBotCharacter,
  generateCharacterPrompt,
  type CharacterDefinition,
} from "./bags-bot.character.ts";

// ============================================================================
// TECH LABS ZONE (labs) - R&D headquarters of Bags.fm team
// ============================================================================
import { ramoCharacter } from "./ramo.character.ts";
import { sincaraCharacter } from "./sincara.character.ts";
import { stuuCharacter } from "./stuu.character.ts";
import { samCharacter } from "./sam.character.ts";
import { alaaCharacter } from "./alaa.character.ts";
import { carloCharacter } from "./carlo.character.ts";
import { bnnCharacter } from "./bnn.character.ts";

// ============================================================================
// PARK ZONE (main_city) - The heart of BagsWorld
// ============================================================================
import { tolyCharacter } from "./toly.character.ts";
import { ashCharacter } from "./ash.character.ts";
import { ghostCharacter } from "./ghost.character.ts";
import { shawCharacter } from "./shaw.character.ts";
import { finnCharacter } from "./finn.character.ts"; // Finn visits Park but works at Labs

// ============================================================================
// BAGSCITY ZONE (trending) - Downtown trading district
// ============================================================================
import { neoCharacter } from "./neo.character.ts";
import { cjCharacter } from "./cj.character.ts";

// ============================================================================
// FOUNDER'S CORNER ZONE (founders) - Token launch education
// ============================================================================
import { professorOakCharacter } from "./professor-oak.character.ts";

// ============================================================================
// MASCOTS - Official Bags.fm mascots
// ============================================================================
import { bagsyCharacter } from "./bagsy.character.ts";

// ============================================================================
// EXPORTS - Organized by zone
// ============================================================================

// Global
export { bagsBotCharacter } from "./bags-bot.character.ts";

// Tech Labs Zone (labs) - Bags.fm Team
export { finnCharacter } from "./finn.character.ts"; // CEO leads the team
export { ramoCharacter } from "./ramo.character.ts";
export { sincaraCharacter } from "./sincara.character.ts";
export { stuuCharacter } from "./stuu.character.ts";
export { samCharacter } from "./sam.character.ts";
export { alaaCharacter } from "./alaa.character.ts";
export { carloCharacter } from "./carlo.character.ts";
export { bnnCharacter } from "./bnn.character.ts";

// Park Zone (main_city)
export { tolyCharacter } from "./toly.character.ts";
export { ashCharacter } from "./ash.character.ts";
export { ghostCharacter } from "./ghost.character.ts";
export { shawCharacter } from "./shaw.character.ts";

// BagsCity Zone (trending)
export { neoCharacter } from "./neo.character.ts";
export { cjCharacter } from "./cj.character.ts";

// Founder's Corner Zone (founders)
export { professorOakCharacter } from "./professor-oak.character.ts";

// Mascots
export { bagsyCharacter } from "./bagsy.character.ts";

// Export types and utilities
export { generateCharacterPrompt, type CharacterDefinition } from "./bags-bot.character.ts";

// ============================================================================
// CHARACTER REGISTRY - Organized by zone
// ============================================================================

// Tech Labs Zone characters (labs) - Bags.fm Team
export const labsCharacters: Record<string, CharacterDefinition> = {
  finn: finnCharacter, // CEO leads the team
  ramo: ramoCharacter,
  sincara: sincaraCharacter,
  stuu: stuuCharacter,
  sam: samCharacter,
  alaa: alaaCharacter,
  carlo: carloCharacter,
  bnn: bnnCharacter,
};

// Park Zone characters (main_city)
export const parkCharacters: Record<string, CharacterDefinition> = {
  toly: tolyCharacter,
  ash: ashCharacter,
  ghost: ghostCharacter,
  shaw: shawCharacter,
  bagsy: bagsyCharacter, // Official mascot
};

// BagsCity Zone characters (trending)
export const bagsCityCharacters: Record<string, CharacterDefinition> = {
  neo: neoCharacter,
  cj: cjCharacter,
};

// Founder's Corner Zone characters (founders)
export const foundersCharacters: Record<string, CharacterDefinition> = {
  "professor-oak": professorOakCharacter,
};

// Global characters (appear everywhere)
export const globalCharacters: Record<string, CharacterDefinition> = {
  "bags-bot": bagsBotCharacter,
};

// Combined registry (all characters)
export const characters: Record<string, CharacterDefinition> = {
  ...globalCharacters,
  ...labsCharacters,
  ...parkCharacters,
  ...bagsCityCharacters,
  ...foundersCharacters,
};

// Get character by ID with fallback
export function getCharacter(id: string): CharacterDefinition {
  return characters[id.toLowerCase()] || bagsBotCharacter;
}

// Get all character IDs
export function getCharacterIds(): string[] {
  return Object.keys(characters);
}

// Get characters for a specific zone
export function getCharactersByZone(
  zone: "labs" | "main_city" | "trending" | "founders" | "ballers"
): CharacterDefinition[] {
  switch (zone) {
    case "labs":
      return Object.values(labsCharacters);
    case "main_city":
      return Object.values(parkCharacters);
    case "trending":
      return Object.values(bagsCityCharacters);
    case "founders":
      return Object.values(foundersCharacters);
    case "ballers":
      return []; // No special characters in Ballers Valley (just mansions)
    default:
      return [];
  }
}

// Get character IDs for a specific zone
export function getCharacterIdsByZone(
  zone: "labs" | "main_city" | "trending" | "founders" | "ballers"
): string[] {
  switch (zone) {
    case "labs":
      return Object.keys(labsCharacters);
    case "main_city":
      return Object.keys(parkCharacters);
    case "trending":
      return Object.keys(bagsCityCharacters);
    case "founders":
      return Object.keys(foundersCharacters);
    case "ballers":
      return [];
    default:
      return [];
  }
}

// ============================================================================
// CHARACTER METADATA - For UI display, organized by zone
// ============================================================================

export type ZoneType = "labs" | "main_city" | "trending" | "founders" | "ballers";

export interface CharacterMeta {
  displayName: string;
  role: string;
  color: string;
  icon: string;
  zone: ZoneType;
}

export const characterMeta: Record<string, CharacterMeta> = {
  // Global
  "bags-bot": {
    displayName: "Bags Bot",
    role: "World Guide",
    color: "#f59e0b",
    icon: "🤖",
    zone: "main_city",
  },

  // ========== TECH LABS ZONE (labs) - Bags.fm Team ==========
  ramo: {
    displayName: "Ramo",
    role: "Co-Founder & CTO",
    color: "#3b82f6",
    icon: "⚙️",
    zone: "labs",
  },
  sincara: {
    displayName: "Sincara",
    role: "Frontend Engineer",
    color: "#ec4899",
    icon: "🎨",
    zone: "labs",
  },
  stuu: {
    displayName: "Stuu",
    role: "Operations",
    color: "#22c55e",
    icon: "📋",
    zone: "labs",
  },
  sam: {
    displayName: "Sam",
    role: "Growth",
    color: "#fbbf24",
    icon: "📢",
    zone: "labs",
  },
  alaa: {
    displayName: "Alaa",
    role: "Skunk Works",
    color: "#6366f1",
    icon: "🔬",
    zone: "labs",
  },
  carlo: {
    displayName: "Carlo",
    role: "Ambassador",
    color: "#f97316",
    icon: "🎒",
    zone: "labs",
  },
  bnn: {
    displayName: "BNN",
    role: "News Network",
    color: "#06b6d4",
    icon: "📺",
    zone: "labs",
  },

  // ========== PARK ZONE (main_city) ==========
  toly: {
    displayName: "Toly",
    role: "Solana Co-Founder",
    color: "#14f195",
    icon: "☀️",
    zone: "main_city",
  },
  ash: {
    displayName: "Ash",
    role: "Ecosystem Guide",
    color: "#ef4444",
    icon: "⚡",
    zone: "main_city",
  },
  finn: {
    displayName: "Finn",
    role: "Founder & CEO",
    color: "#10b981",
    icon: "🎩",
    zone: "labs", // CEO at Tech Labs HQ
  },
  ghost: {
    displayName: "Ghost",
    role: "The Dev",
    color: "#8b5cf6",
    icon: "👻",
    zone: "main_city",
  },
  shaw: {
    displayName: "Shaw",
    role: "ElizaOS Creator",
    color: "#FF5800",
    icon: "🔶",
    zone: "main_city",
  },

  // ========== BAGSCITY ZONE (trending) ==========
  neo: {
    displayName: "Neo",
    role: "The Scout",
    color: "#22c55e",
    icon: "👁️",
    zone: "trending",
  },
  cj: {
    displayName: "CJ",
    role: "Hood Legend",
    color: "#f97316",
    icon: "🔫",
    zone: "trending",
  },

  // ========== FOUNDER'S CORNER ZONE (founders) ==========
  "professor-oak": {
    displayName: "Professor Oak",
    role: "Launch Wizard",
    color: "#a16207",
    icon: "🧪",
    zone: "founders",
  },

  // ========== MASCOTS ==========
  bagsy: {
    displayName: "Bagsy",
    role: "Hype Bot",
    color: "#00ff00",
    icon: "💰",
    zone: "main_city",
  },
};

// Get metadata for characters in a specific zone
export function getCharacterMetaByZone(zone: ZoneType): Record<string, CharacterMeta> {
  return Object.fromEntries(Object.entries(characterMeta).filter(([, meta]) => meta.zone === zone));
}
