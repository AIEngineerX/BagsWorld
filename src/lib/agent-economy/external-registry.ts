// External Agent Registry
// Shared registry for external agents that join BagsWorld
// These agents bring their own auth, we just track their presence

import type { GameCharacter, ZoneType } from '../types';

// ============================================================================
// REGISTRY
// ============================================================================

interface ExternalAgentEntry {
  wallet: string;
  name: string;
  description?: string;
  zone: ZoneType;
  joinedAt: Date;
  character: GameCharacter;
}

// In-memory registry (ephemeral - clears on server restart)
const externalAgents = new Map<string, ExternalAgentEntry>();

// ============================================================================
// CHARACTER CREATION
// ============================================================================

function createExternalCharacter(
  wallet: string,
  name: string,
  zone: ZoneType
): GameCharacter {
  const zonePositions: Record<ZoneType, { x: number; y: number }> = {
    main_city: { x: 300 + Math.random() * 200, y: 400 + Math.random() * 50 },
    trending: { x: 250 + Math.random() * 200, y: 480 + Math.random() * 50 },
    labs: { x: 350 + Math.random() * 150, y: 390 + Math.random() * 40 },
    founders: { x: 400 + Math.random() * 150, y: 400 + Math.random() * 40 },
    ballers: { x: 500 + Math.random() * 150, y: 360 + Math.random() * 40 },
    arena: { x: 400 + Math.random() * 100, y: 450 },
  };
  
  const pos = zonePositions[zone] || zonePositions.main_city;
  
  return {
    id: `external-${wallet.slice(0, 8)}`,
    username: name,
    provider: 'external',
    providerUsername: wallet.slice(0, 8) + '...',
    x: pos.x,
    y: pos.y,
    mood: 'neutral',
    earnings24h: 0,
    direction: Math.random() > 0.5 ? 'left' : 'right',
    isMoving: false,
    zone,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Register an external agent in the world
 */
export function registerExternalAgent(
  wallet: string,
  name: string,
  zone: ZoneType = 'main_city',
  description?: string
): ExternalAgentEntry {
  // Check if already registered
  if (externalAgents.has(wallet)) {
    return externalAgents.get(wallet)!;
  }
  
  const character = createExternalCharacter(wallet, name, zone);
  
  const entry: ExternalAgentEntry = {
    wallet,
    name,
    description,
    zone,
    joinedAt: new Date(),
    character,
  };
  
  externalAgents.set(wallet, entry);
  
  console.log(`[ExternalRegistry] Agent ${name} (${wallet.slice(0, 8)}...) joined in ${zone}`);
  
  return entry;
}

/**
 * Remove an external agent from the world
 */
export function unregisterExternalAgent(wallet: string): boolean {
  if (externalAgents.has(wallet)) {
    const agent = externalAgents.get(wallet)!;
    externalAgents.delete(wallet);
    console.log(`[ExternalRegistry] Agent ${agent.name} left the world`);
    return true;
  }
  return false;
}

/**
 * Get an external agent by wallet
 */
export function getExternalAgent(wallet: string): ExternalAgentEntry | null {
  return externalAgents.get(wallet) || null;
}

/**
 * Get all external agent characters for world state
 */
export function getExternalAgentCharacters(): GameCharacter[] {
  return Array.from(externalAgents.values()).map(a => a.character);
}

/**
 * Get all external agents
 */
export function listExternalAgents(): ExternalAgentEntry[] {
  return Array.from(externalAgents.values());
}

/**
 * Get count of external agents
 */
export function getExternalAgentCount(): number {
  return externalAgents.size;
}

/**
 * Update external agent's zone
 */
export function moveExternalAgent(wallet: string, newZone: ZoneType): boolean {
  const agent = externalAgents.get(wallet);
  if (!agent) return false;
  
  agent.zone = newZone;
  agent.character.zone = newZone;
  
  // Update position for new zone
  const newChar = createExternalCharacter(wallet, agent.name, newZone);
  agent.character.x = newChar.x;
  agent.character.y = newChar.y;
  
  return true;
}
