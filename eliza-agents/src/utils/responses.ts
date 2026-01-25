type CharacterResponses = Record<string, string>;

export function getCharacterResponse(
  characterName: string,
  responses: CharacterResponses,
  defaultResponse: string
): string {
  const name = characterName.toLowerCase();
  return responses[name] || defaultResponse;
}

export const CHARACTER_INTROS: Record<string, string> = {
  toly: 'gm ser,',
  finn: '',
  ash: '',
  ghost: '',
  neo: '*scanning*',
  cj: 'aight check it,',
  shaw: '',
  'bags-bot': '',
  bagsbot: '',
};

export const CHARACTER_OUTROS: Record<string, string> = {
  toly: 'all settled on solana.',
  finn: "that's the bags.fm way.",
  ash: 'gotta catch em all!',
  ghost: 'check solscan to verify.',
  neo: 'the code never lies.',
  cj: 'stack or get stacked on homie.',
  shaw: '',
  'bags-bot': 'lfg!',
  bagsbot: 'lfg!',
};
