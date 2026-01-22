// BagsWorld Agents - Powered by ElizaOS
// Main entry point for autonomous agent runtime

export * from './characters';
export * from './plugins/bags-fm';

import {
  neoCharacter,
  cjCharacter,
  finnCharacter,
  bagsBotCharacter,
  tolyCharacter,
  ashCharacter,
  shawCharacter,
} from './characters';

// Export default character (Bags Bot is the main guide)
export const character = bagsBotCharacter;

// Export all characters for multi-agent deployment
export const characters = [
  bagsBotCharacter,
  neoCharacter,
  cjCharacter,
  finnCharacter,
  tolyCharacter,
  ashCharacter,
  shawCharacter,
];

// Re-export plugin for external use
export { bagsFmPlugin } from './plugins/bags-fm';
