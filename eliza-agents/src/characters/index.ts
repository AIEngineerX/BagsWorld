import type { Character } from '../types/elizaos.js';

// Core characters (original 8)
export { tolyCharacter } from './toly.js';
export { finnCharacter } from './finn.js';
export { ashCharacter } from './ash.js';
export { ghostCharacter } from './ghost.js';
export { neoCharacter } from './neo.js';
export { cjCharacter } from './cj.js';
export { shawCharacter } from './shaw.js';
export { bagsBotCharacter } from './bags-bot.js';

// Academy characters (new 8)
export { alaaCharacter } from './alaa.js';
export { bnnCharacter } from './bnn.js';
export { carloCharacter } from './carlo.js';
export { ramoCharacter } from './ramo.js';
export { samCharacter } from './sam.js';
export { sincaraCharacter } from './sincara.js';
export { stuuCharacter } from './stuu.js';
export { professorOakCharacter } from './professor-oak.js';

import { tolyCharacter } from './toly.js';
import { finnCharacter } from './finn.js';
import { ashCharacter } from './ash.js';
import { ghostCharacter } from './ghost.js';
import { neoCharacter } from './neo.js';
import { cjCharacter } from './cj.js';
import { shawCharacter } from './shaw.js';
import { bagsBotCharacter } from './bags-bot.js';

// Academy imports
import { alaaCharacter } from './alaa.js';
import { bnnCharacter } from './bnn.js';
import { carloCharacter } from './carlo.js';
import { ramoCharacter } from './ramo.js';
import { samCharacter } from './sam.js';
import { sincaraCharacter } from './sincara.js';
import { stuuCharacter } from './stuu.js';
import { professorOakCharacter } from './professor-oak.js';

export type CharacterId =
  // Core characters
  | 'toly'
  | 'finn'
  | 'ash'
  | 'ghost'
  | 'neo'
  | 'cj'
  | 'shaw'
  | 'bags-bot'
  | 'bagsbot'
  | 'dev'
  // Academy characters
  | 'alaa'
  | 'bnn'
  | 'carlo'
  | 'ramo'
  | 'sam'
  | 'sincara'
  | 'stuu'
  | 'professor-oak'
  | 'professoroak'
  | 'oak';

export const characters: Record<string, Character> = {
  // Core characters
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
  // Academy characters
  'alaa': alaaCharacter,
  'bnn': bnnCharacter,
  'carlo': carloCharacter,
  'ramo': ramoCharacter,
  'sam': samCharacter,
  'sincara': sincaraCharacter,
  'stuu': stuuCharacter,
  'professor-oak': professorOakCharacter,
  'professoroak': professorOakCharacter,
  'oak': professorOakCharacter,
};

export function getCharacter(id: string): Character | undefined {
  const normalizedId = id.toLowerCase().replace(/[\s_]/g, '-');
  return characters[normalizedId];
}

export function getCharacterIds(): CharacterId[] {
  return [
    // Core
    'toly', 'finn', 'ash', 'ghost', 'neo', 'cj', 'shaw', 'bags-bot',
    // Academy
    'alaa', 'bnn', 'carlo', 'ramo', 'sam', 'sincara', 'stuu', 'professor-oak',
  ];
}

export function getCharacterDisplayName(id: string): string {
  const char = getCharacter(id);
  return char?.name || id;
}

export function isValidCharacterId(id: string): boolean {
  return getCharacter(id) !== undefined;
}

export const allCharacters: Character[] = [
  // Core
  bagsBotCharacter,
  tolyCharacter,
  finnCharacter,
  ashCharacter,
  ghostCharacter,
  neoCharacter,
  cjCharacter,
  shawCharacter,
  // Academy
  alaaCharacter,
  bnnCharacter,
  carloCharacter,
  ramoCharacter,
  samCharacter,
  sincaraCharacter,
  stuuCharacter,
  professorOakCharacter,
];

export default allCharacters;
