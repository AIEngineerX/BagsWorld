// Character adapter for ElizaOS compatibility
// Imports CharacterDefinition from local definitions and converts to ElizaOS Character type

import type { Character } from '../types/elizaos.js';

// Import character definitions from local copies (for standalone deployment)
import {
  bagsBotCharacter as bagsBotDef,
  type CharacterDefinition,
} from './definitions/bags-bot.character.js';
import { tolyCharacter as tolyDef } from './definitions/toly.character.js';
import { neoCharacter as neoDef } from './definitions/neo.character.js';
import { finnCharacter as finnDef } from './definitions/finn.character.js';
import { ghostCharacter as ghostDef } from './definitions/ghost.character.js';
import { ashCharacter as ashDef } from './definitions/ash.character.js';
import { cjCharacter as cjDef } from './definitions/cj.character.js';
import { shawCharacter as shawDef } from './definitions/shaw.character.js';
import { ramoCharacter as ramoDef } from './definitions/ramo.character.js';
import { sincaraCharacter as sincaraDef } from './definitions/sincara.character.js';
import { stuuCharacter as stuuDef } from './definitions/stuu.character.js';
import { samCharacter as samDef } from './definitions/sam.character.js';
import { alaaCharacter as alaaDef } from './definitions/alaa.character.js';
import { carloCharacter as carloDef } from './definitions/carlo.character.js';
import { bnnCharacter as bnnDef } from './definitions/bnn.character.js';
import { professorOakCharacter as professorOakDef } from './definitions/professor-oak.character.js';

// Convert CharacterDefinition to ElizaOS Character format
function toElizaCharacter(def: CharacterDefinition): Character {
  // Generate username from name (lowercase, hyphens for spaces)
  const username = def.name.toLowerCase().replace(/\s+/g, '-');

  // Build the system prompt from the character definition
  const systemPrompt = `You are ${def.name}.

PERSONALITY:
${def.bio.join('\n')}

BACKSTORY AND RELATIONSHIPS:
${def.lore.join('\n')}

YOUR STYLE:
- Tone: ${def.style.tone}
- You are: ${def.style.adjectives.join(', ')}
- You use words like: ${def.style.vocabulary.slice(0, 15).join(', ')}

QUIRKS:
${def.quirks.map((q) => `- ${q}`).join('\n')}

EXAMPLE RESPONSES:
${def.messageExamples
  .slice(0, 4)
  .map((convo) => convo.map((m) => `${m.user}: ${m.content}`).join('\n'))
  .join('\n\n')}

TOPICS YOU KNOW ABOUT:
${def.topics.join(', ')}

RULES:
- Keep responses SHORT (1-2 sentences max)
- Stay in character always
- Be helpful but never give financial advice directly
- Use light emoji, don't overdo it
- Reference BagsWorld features when relevant (animals, weather, buildings)`;

  // Convert messageExamples format: { user, content } -> { name, content: { text } }
  const messageExamples = def.messageExamples.map((convo) =>
    convo.map((msg) => ({
      name: msg.user === 'anon' ? '{{name1}}' : msg.user,
      content: { text: msg.content },
    }))
  );

  return {
    name: def.name,
    username,
    system: systemPrompt,
    bio: def.bio,
    lore: def.lore,
    topics: def.topics,
    adjectives: def.style.adjectives,
    messageExamples,
    postExamples: def.postExamples,
    style: {
      all: [
        `Tone: ${def.style.tone}`,
        ...def.style.adjectives.map((adj) => `Be ${adj}`),
      ],
      chat: [
        `Use vocabulary like: ${def.style.vocabulary.slice(0, 8).join(', ')}`,
        ...def.quirks.slice(0, 3),
      ],
      post: def.postExamples.slice(0, 3),
    },
    settings: {
      model: 'claude-sonnet-4-20250514',
    },
  };
}

// Convert all characters to ElizaOS format
export const tolyCharacter: Character = toElizaCharacter(tolyDef);
export const finnCharacter: Character = toElizaCharacter(finnDef);
export const ashCharacter: Character = toElizaCharacter(ashDef);
export const ghostCharacter: Character = toElizaCharacter(ghostDef);
export const neoCharacter: Character = toElizaCharacter(neoDef);
export const cjCharacter: Character = toElizaCharacter(cjDef);
export const shawCharacter: Character = toElizaCharacter(shawDef);
export const bagsBotCharacter: Character = toElizaCharacter(bagsBotDef);

// Academy characters
export const alaaCharacter: Character = toElizaCharacter(alaaDef);
export const bnnCharacter: Character = toElizaCharacter(bnnDef);
export const carloCharacter: Character = toElizaCharacter(carloDef);
export const ramoCharacter: Character = toElizaCharacter(ramoDef);
export const samCharacter: Character = toElizaCharacter(samDef);
export const sincaraCharacter: Character = toElizaCharacter(sincaraDef);
export const stuuCharacter: Character = toElizaCharacter(stuuDef);
export const professorOakCharacter: Character = toElizaCharacter(professorOakDef);

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
