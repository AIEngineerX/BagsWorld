// BagsWorld Character Registry
// All autonomous agents powered by ElizaOS

export { neoCharacter } from './neo';
export { cjCharacter } from './cj';
export { finnCharacter } from './finn';
export { bagsBotCharacter } from './bags-bot';
export { tolyCharacter } from './toly';
export { ashCharacter } from './ash';
export { shawCharacter } from './shaw';

import { neoCharacter } from './neo';
import { cjCharacter } from './cj';
import { finnCharacter } from './finn';
import { bagsBotCharacter } from './bags-bot';
import { tolyCharacter } from './toly';
import { ashCharacter } from './ash';
import { shawCharacter } from './shaw';
import { Character } from '@elizaos/core';

// Character registry by ID
export const characters: Record<string, Character> = {
  'neo': neoCharacter,
  'cj': cjCharacter,
  'finn': finnCharacter,
  'bags-bot': bagsBotCharacter,
  'toly': tolyCharacter,
  'ash': ashCharacter,
  'shaw': shawCharacter,
};

// Get character by ID
export function getCharacter(id: string): Character | undefined {
  return characters[id.toLowerCase()];
}

// Get all character IDs
export function getCharacterIds(): string[] {
  return Object.keys(characters);
}

// Default export all characters as array for multi-agent mode
export default [
  bagsBotCharacter,
  neoCharacter,
  cjCharacter,
  finnCharacter,
  tolyCharacter,
  ashCharacter,
  shawCharacter,
];
