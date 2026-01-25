import type { Character } from '../types/elizaos.js';

export { tolyCharacter } from './toly.js';
export { finnCharacter } from './finn.js';
export { ashCharacter } from './ash.js';
export { ghostCharacter } from './ghost.js';
export { neoCharacter } from './neo.js';
export { cjCharacter } from './cj.js';
export { shawCharacter } from './shaw.js';
export { bagsBotCharacter } from './bags-bot.js';

import { tolyCharacter } from './toly.js';
import { finnCharacter } from './finn.js';
import { ashCharacter } from './ash.js';
import { ghostCharacter } from './ghost.js';
import { neoCharacter } from './neo.js';
import { cjCharacter } from './cj.js';
import { shawCharacter } from './shaw.js';
import { bagsBotCharacter } from './bags-bot.js';

export type CharacterId =
  | 'toly'
  | 'finn'
  | 'ash'
  | 'ghost'
  | 'neo'
  | 'cj'
  | 'shaw'
  | 'bags-bot'
  | 'bagsbot'
  | 'dev';

export const characters: Record<string, Character> = {
  'toly': tolyCharacter,
  'finn': finnCharacter,
  'ash': ashCharacter,
  'ghost': ghostCharacter,
  'neo': neoCharacter,
  'cj': cjCharacter,
  'shaw': shawCharacter,
  'bags-bot': bagsBotCharacter,
  'bagsbot': bagsBotCharacter,
  'dev': ghostCharacter,
};

export function getCharacter(id: string): Character | undefined {
  const normalizedId = id.toLowerCase().replace(/[\s_]/g, '-');
  return characters[normalizedId];
}

export function getCharacterIds(): CharacterId[] {
  return ['toly', 'finn', 'ash', 'ghost', 'neo', 'cj', 'shaw', 'bags-bot'];
}

export function getCharacterDisplayName(id: string): string {
  const char = getCharacter(id);
  return char?.name || id;
}

export function isValidCharacterId(id: string): boolean {
  return getCharacter(id) !== undefined;
}

export const allCharacters: Character[] = [
  bagsBotCharacter,
  tolyCharacter,
  finnCharacter,
  ashCharacter,
  ghostCharacter,
  neoCharacter,
  cjCharacter,
  shawCharacter,
];

export default allCharacters;
