// Character registry - all BagsWorld AI characters
// Each character uses Opus 4.5 for intelligent, personality-driven responses

import {
  bagsBotCharacter,
  generateCharacterPrompt,
  type CharacterDefinition,
} from "./bags-bot.character";
import { tolyCharacter } from "./toly.character";
import { neoCharacter } from "./neo.character";
import { finnCharacter } from "./finn.character";
import { ghostCharacter } from "./ghost.character";
import { ashCharacter } from "./ash.character";
import { cjCharacter } from "./cj.character";
import { shawCharacter } from "./shaw.character";
// Academy Zone - Bags.fm Team Characters
import { ramoCharacter } from "./ramo.character";
import { sincaraCharacter } from "./sincara.character";
import { stuuCharacter } from "./stuu.character";
import { samCharacter } from "./sam.character";
import { alaaCharacter } from "./alaa.character";
import { carloCharacter } from "./carlo.character";
import { bnnCharacter } from "./bnn.character";
import { professorOakCharacter } from "./professor-oak.character";

// Export all characters
export { bagsBotCharacter } from "./bags-bot.character";
export { tolyCharacter } from "./toly.character";
export { neoCharacter } from "./neo.character";
export { finnCharacter } from "./finn.character";
export { ghostCharacter } from "./ghost.character";
export { ashCharacter } from "./ash.character";
export { cjCharacter } from "./cj.character";
export { shawCharacter } from "./shaw.character";
// Academy Zone - Bags.fm Team Characters
export { ramoCharacter } from "./ramo.character";
export { sincaraCharacter } from "./sincara.character";
export { stuuCharacter } from "./stuu.character";
export { samCharacter } from "./sam.character";
export { alaaCharacter } from "./alaa.character";
export { carloCharacter } from "./carlo.character";
export { bnnCharacter } from "./bnn.character";
export { professorOakCharacter } from "./professor-oak.character";

// Export types and utilities
export { generateCharacterPrompt, type CharacterDefinition } from "./bags-bot.character";

// Character registry by ID
export const characters: Record<string, CharacterDefinition> = {
  "bags-bot": bagsBotCharacter,
  toly: tolyCharacter,
  neo: neoCharacter,
  finn: finnCharacter,
  ghost: ghostCharacter,
  ash: ashCharacter,
  cj: cjCharacter,
  shaw: shawCharacter,
  // Academy Zone - Bags.fm Team
  ramo: ramoCharacter,
  sincara: sincaraCharacter,
  stuu: stuuCharacter,
  sam: samCharacter,
  alaa: alaaCharacter,
  carlo: carloCharacter,
  bnn: bnnCharacter,
  "professor-oak": professorOakCharacter,
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
    zone?: string; // Which zone this character primarily appears in
  }
> = {
  "bags-bot": {
    displayName: "Bags Bot",
    role: "World Guide",
    color: "#f59e0b", // amber
    icon: "🤖",
  },
  toly: {
    displayName: "Toly",
    role: "Solana Co-Founder",
    color: "#14f195", // solana green
    icon: "☀️",
  },
  neo: {
    displayName: "Neo",
    role: "The Scout",
    color: "#22c55e", // green (matrix)
    icon: "👁️",
    zone: "trending",
  },
  finn: {
    displayName: "Finn",
    role: "Founder & CEO",
    color: "#3b82f6", // blue
    icon: "🎩",
    zone: "academy",
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
    zone: "trending",
  },
  shaw: {
    displayName: "Shaw",
    role: "ElizaOS Creator",
    color: "#FF5800", // ElizaOS orange
    icon: "🔶",
    zone: "academy",
  },
  // Academy Zone - Bags.fm Team
  ramo: {
    displayName: "Ramo",
    role: "Co-Founder & CTO",
    color: "#3b82f6", // tech blue
    icon: "⚙️",
    zone: "academy",
  },
  sincara: {
    displayName: "Sincara",
    role: "Frontend Engineer",
    color: "#8b5cf6", // purple (design)
    icon: "🎨",
    zone: "academy",
  },
  stuu: {
    displayName: "Stuu",
    role: "Operations",
    color: "#10b981", // bags green
    icon: "📋",
    zone: "academy",
  },
  sam: {
    displayName: "Sam",
    role: "Growth",
    color: "#f59e0b", // amber/gold
    icon: "📢",
    zone: "academy",
  },
  alaa: {
    displayName: "Alaa",
    role: "Skunk Works",
    color: "#1f2937", // dark mysterious
    icon: "🔬",
    zone: "academy",
  },
  carlo: {
    displayName: "Carlo",
    role: "Ambassador",
    color: "#22c55e", // friendly green
    icon: "🎒",
    zone: "academy",
  },
  bnn: {
    displayName: "BNN",
    role: "News Network",
    color: "#3b82f6", // news blue
    icon: "📺",
    zone: "academy",
  },
  "professor-oak": {
    displayName: "Professor Oak",
    role: "Launch Wizard",
    color: "#a16207", // oak brown
    icon: "🧪",
    zone: "academy",
  },
};
