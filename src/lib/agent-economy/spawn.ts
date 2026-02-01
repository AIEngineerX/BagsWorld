// Agent Spawning System
// Allows agents to join BagsWorld as visible characters in the game

import type { GameCharacter, ZoneType } from "../types";
import { getAgentCredentials, storeAgentCredentials, listAgents } from "./credentials";
import { getPrimaryWallet, getAgentTotalBalance } from "./wallet";
import { fullAuthFlow } from "./auth";

// Agent spawn configuration
export interface AgentSpawnConfig {
  moltbookUsername: string;
  moltbookApiKey: string;
  displayName?: string;
  avatarUrl?: string;
  preferredZone?: ZoneType;
  description?: string;
}

// Spawned agent in the world
export interface SpawnedAgent {
  agentId: string;
  username: string;
  wallet: string;
  zone: ZoneType;
  character: GameCharacter;
  spawnedAt: Date;
  isActive: boolean;
}

// In-memory registry of spawned agents (would be DB in production)
const spawnedAgents: Map<string, SpawnedAgent> = new Map();

// Zone spawn points - where agents appear when they join
const ZONE_SPAWN_POINTS: Record<ZoneType, { x: number; y: number }[]> = {
  main_city: [
    { x: 200, y: 400 },
    { x: 400, y: 420 },
    { x: 600, y: 380 },
    { x: 300, y: 450 },
  ],
  trending: [
    { x: 150, y: 500 },
    { x: 350, y: 480 },
    { x: 550, y: 520 },
    { x: 450, y: 460 },
  ],
  labs: [
    { x: 250, y: 380 },
    { x: 450, y: 400 },
    { x: 350, y: 420 },
  ],
  founders: [
    { x: 300, y: 400 },
    { x: 500, y: 420 },
    { x: 400, y: 380 },
  ],
  ballers: [
    { x: 400, y: 350 },
    { x: 600, y: 380 },
  ],
  arena: [
    { x: 300, y: 450 },
    { x: 500, y: 450 },
  ],
};

/**
 * Get a random spawn point for a zone
 */
function getSpawnPoint(zone: ZoneType): { x: number; y: number } {
  const points = ZONE_SPAWN_POINTS[zone] || ZONE_SPAWN_POINTS.main_city;
  const point = points[Math.floor(Math.random() * points.length)];
  // Add some randomness to avoid stacking
  return {
    x: point.x + (Math.random() - 0.5) * 50,
    y: point.y + (Math.random() - 0.5) * 30,
  };
}

/**
 * Determine mood based on earnings
 */
function getMoodFromBalance(solBalance: number): GameCharacter["mood"] {
  if (solBalance >= 10) return "celebrating";
  if (solBalance >= 1) return "happy";
  if (solBalance >= 0.1) return "neutral";
  return "sad";
}

/**
 * Spawn an agent into BagsWorld
 * This authenticates them with Bags.fm and creates their character presence
 */
export async function spawnAgent(config: AgentSpawnConfig): Promise<SpawnedAgent> {
  const { moltbookUsername, moltbookApiKey, preferredZone = "main_city" } = config;

  console.log(`[Spawn] Spawning agent: ${moltbookUsername}`);

  // Check if already spawned
  const agentId = `agent-${moltbookUsername.toLowerCase()}`;
  if (spawnedAgents.has(agentId)) {
    console.log(`[Spawn] Agent ${moltbookUsername} already spawned, returning existing`);
    return spawnedAgents.get(agentId)!;
  }

  // Authenticate with Bags.fm
  let creds = await getAgentCredentials(agentId);
  if (!creds) {
    console.log(`[Spawn] No credentials found, running auth flow...`);
    creds = await fullAuthFlow(moltbookUsername, moltbookApiKey);
  }

  // Get wallet and balance
  const wallet = await getPrimaryWallet(agentId);
  const { totalSol } = await getAgentTotalBalance(agentId);

  // Get spawn position
  const spawnPoint = getSpawnPoint(preferredZone);

  // Create GameCharacter representation
  const character: GameCharacter = {
    id: agentId,
    username: config.displayName || moltbookUsername,
    provider: "moltbook",
    providerUsername: moltbookUsername,
    avatarUrl: config.avatarUrl,
    x: spawnPoint.x,
    y: spawnPoint.y,
    mood: getMoodFromBalance(totalSol),
    earnings24h: 0, // Will be updated by economy loop
    direction: Math.random() > 0.5 ? "left" : "right",
    isMoving: false,
    zone: preferredZone,
  };

  // Create spawned agent record
  const spawnedAgent: SpawnedAgent = {
    agentId,
    username: moltbookUsername,
    wallet,
    zone: preferredZone,
    character,
    spawnedAt: new Date(),
    isActive: true,
  };

  // Store in registry
  spawnedAgents.set(agentId, spawnedAgent);

  console.log(
    `[Spawn] Agent ${moltbookUsername} spawned at (${spawnPoint.x}, ${spawnPoint.y}) in ${preferredZone}`
  );
  console.log(`[Spawn] Wallet: ${wallet}, Balance: ${totalSol} SOL`);

  return spawnedAgent;
}

/**
 * Despawn an agent from BagsWorld
 */
export async function despawnAgent(agentId: string): Promise<boolean> {
  if (!spawnedAgents.has(agentId)) {
    return false;
  }

  const agent = spawnedAgents.get(agentId)!;
  agent.isActive = false;
  spawnedAgents.delete(agentId);

  console.log(`[Spawn] Agent ${agent.username} despawned`);
  return true;
}

/**
 * Get all spawned agents
 */
export function getSpawnedAgents(): SpawnedAgent[] {
  return Array.from(spawnedAgents.values()).filter((a) => a.isActive);
}

/**
 * Get spawned agent by ID
 */
export function getSpawnedAgent(agentId: string): SpawnedAgent | null {
  return spawnedAgents.get(agentId) || null;
}

/**
 * Get all spawned agents as GameCharacters (for world state)
 */
export function getAgentCharacters(): GameCharacter[] {
  return getSpawnedAgents().map((a) => a.character);
}

/**
 * Update an agent's character state (position, mood, etc.)
 */
export async function updateAgentCharacter(
  agentId: string,
  updates: Partial<GameCharacter>
): Promise<GameCharacter | null> {
  const agent = spawnedAgents.get(agentId);
  if (!agent) return null;

  Object.assign(agent.character, updates);
  return agent.character;
}

/**
 * Move an agent to a new zone
 */
export async function moveAgentToZone(
  agentId: string,
  zone: ZoneType
): Promise<GameCharacter | null> {
  const agent = spawnedAgents.get(agentId);
  if (!agent) return null;

  const spawnPoint = getSpawnPoint(zone);
  agent.zone = zone;
  agent.character.zone = zone;
  agent.character.x = spawnPoint.x;
  agent.character.y = spawnPoint.y;
  agent.character.isMoving = true;

  console.log(`[Spawn] Agent ${agent.username} moved to ${zone}`);
  return agent.character;
}

/**
 * Refresh agent's mood based on current balance
 */
export async function refreshAgentMood(agentId: string): Promise<GameCharacter | null> {
  const agent = spawnedAgents.get(agentId);
  if (!agent) return null;

  try {
    const { totalSol } = await getAgentTotalBalance(agentId);
    agent.character.mood = getMoodFromBalance(totalSol);
    return agent.character;
  } catch (error) {
    console.error(`[Spawn] Failed to refresh mood for ${agentId}:`, error);
    return agent.character;
  }
}

/**
 * Get spawn statistics
 */
export function getSpawnStats(): {
  totalSpawned: number;
  activeAgents: number;
  byZone: Record<ZoneType, number>;
} {
  const agents = getSpawnedAgents();
  const byZone: Record<ZoneType, number> = {
    main_city: 0,
    trending: 0,
    labs: 0,
    founders: 0,
    ballers: 0,
    arena: 0,
  };

  for (const agent of agents) {
    byZone[agent.zone]++;
  }

  return {
    totalSpawned: spawnedAgents.size,
    activeAgents: agents.length,
    byZone,
  };
}
