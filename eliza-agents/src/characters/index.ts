// Character adapter for ElizaOS compatibility
// Imports CharacterDefinition from main app and converts to ElizaOS Character type

import type { Character } from '../types/elizaos.js';

// Import all characters from the main app (single source of truth)
import {
  bagsBotCharacter as bagsBotDef,
  tolyCharacter as tolyDef,
  neoCharacter as neoDef,
  finnCharacter as finnDef,
  ghostCharacter as ghostDef,
  ashCharacter as ashDef,
  cjCharacter as cjDef,
  shawCharacter as shawDef,
  ramoCharacter as ramoDef,
  sincaraCharacter as sincaraDef,
  stuuCharacter as stuuDef,
  samCharacter as samDef,
  alaaCharacter as alaaDef,
  carloCharacter as carloDef,
  bnnCharacter as bnnDef,
  professorOakCharacter as professorOakDef,
  type CharacterDefinition,
} from '../../../src/characters/index.js';

// Convert CharacterDefinition to ElizaOS Character format
function toElizaCharacter(def: CharacterDefinition): Character {
  // Build the system prompt from the character definition
  const systemPrompt = `You are ${def.name}.

PERSONALITY:
${def.bio.join('\n')}

BACKSTORY:
${def.lore.slice(0, 3).join('\n')}

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
