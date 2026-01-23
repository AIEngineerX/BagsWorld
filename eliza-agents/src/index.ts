// BagsWorld Agents - Powered by ElizaOS
// Main entry point for autonomous agent runtime

// Core exports
export * from './characters';
export * from './plugins/bags-fm';
export * from './coordination';
export * from './db';
export * from './telegram';
export * from './utils';

// Default character (Bags Bot is the main guide)
import { bagsBotCharacter } from './characters';
export const character = bagsBotCharacter;
