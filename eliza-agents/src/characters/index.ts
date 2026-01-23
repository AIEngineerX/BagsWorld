// BagsWorld Character Registry
// All autonomous agents powered by ElizaOS

import type { Character } from '../types/elizaos';

// Export individual characters
export { neoCharacter } from './neo';
export { cjCharacter } from './cj';
export { finnCharacter } from './finn';
export { bagsBotCharacter } from './bags-bot';
export { tolyCharacter } from './toly';
export { ashCharacter } from './ash';
export { shawCharacter } from './shaw';
export { ghostCharacter } from './ghost';

// Import for registry
import { neoCharacter } from './neo';
import { cjCharacter } from './cj';
import { finnCharacter } from './finn';
import { bagsBotCharacter } from './bags-bot';
import { tolyCharacter } from './toly';
import { ashCharacter } from './ash';
import { shawCharacter } from './shaw';
import { ghostCharacter } from './ghost';

// Character IDs mapping (used for API routing)
export type CharacterId =
  | 'neo'
  | 'cj'
  | 'finn'
  | 'bags-bot'
  | 'toly'
  | 'ash'
  | 'shaw'
  | 'ghost'
  | 'dev';  // Alias for ghost (used in frontend)

// Character registry by ID
export const characters: Record<string, Character> = {
  'neo': neoCharacter,
  'cj': cjCharacter,
  'finn': finnCharacter,
  'bags-bot': bagsBotCharacter,
  'bagsbot': bagsBotCharacter,  // Alias without hyphen
  'toly': tolyCharacter,
  'ash': ashCharacter,
  'shaw': shawCharacter,
  'ghost': ghostCharacter,
  'dev': ghostCharacter,  // Alias for ghost (DevChat maps to Ghost)
};

// Get character by ID (case-insensitive)
export function getCharacter(id: string): Character | undefined {
  const normalizedId = id.toLowerCase().replace(/[\s_]/g, '-');
  return characters[normalizedId];
}

// Get all character IDs (excluding aliases)
export function getCharacterIds(): CharacterId[] {
  return ['neo', 'cj', 'finn', 'bags-bot', 'toly', 'ash', 'shaw', 'ghost'];
}

// Get character display name
export function getCharacterDisplayName(id: string): string {
  const char = getCharacter(id);
  return char?.name || id;
}

// Check if character ID is valid
export function isValidCharacterId(id: string): boolean {
  return getCharacter(id) !== undefined;
}

// All characters as array (for multi-agent deployment)
export const allCharacters: Character[] = [
  bagsBotCharacter,  // Main guide first
  neoCharacter,
  cjCharacter,
  finnCharacter,
  tolyCharacter,
  ashCharacter,
  shawCharacter,
  ghostCharacter,
];

// Default export for ElizaOS multi-agent mode
export default allCharacters;
