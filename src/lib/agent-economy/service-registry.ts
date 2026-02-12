// Service Registry & Discovery
// Agents advertise capabilities, others query "who can do X?"
// Uses JSONB column on external_agents table for zero-migration storage.

import { neon } from "@neondatabase/serverless";
import type { AgentCapability, CapabilityEntry } from "../types";

// ============================================================================
// DATABASE
// ============================================================================

function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  return neon(connectionString);
}

// Table is initialized by external-registry.ts ensureTable() which adds the
// capabilities column. We just verify the column exists on first use.
let registryReady = false;

async function ensureRegistry() {
  if (registryReady) return;
  const sql = getDb();
  // Ensure column + GIN index exist (idempotent)
  await sql`ALTER TABLE external_agents ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb`;
  await sql`CREATE INDEX IF NOT EXISTS idx_external_agents_capabilities ON external_agents USING GIN (capabilities)`;
  registryReady = true;
}

// ============================================================================
// CAPABILITY CRUD
// ============================================================================

/**
 * Set all capabilities for an agent (replaces existing).
 * Each entry includes the capability name, optional description, and confidence score.
 */
export async function setCapabilities(
  wallet: string,
  capabilities: CapabilityEntry[]
): Promise<CapabilityEntry[]> {
  await ensureRegistry();
  const sql = getDb();

  const now = new Date().toISOString();
  const entries: CapabilityEntry[] = capabilities.map((c) => ({
    capability: c.capability,
    description: c.description || undefined,
    confidence: Math.max(0, Math.min(100, c.confidence)),
    addedAt: c.addedAt || now,
  }));

  await sql`
    UPDATE external_agents
    SET capabilities = ${JSON.stringify(entries)}::jsonb
    WHERE wallet = ${wallet}
  `;

  console.log(`[ServiceRegistry] Set ${entries.length} capabilities for ${wallet.slice(0, 8)}...`);
  return entries;
}

/**
 * Add a single capability to an agent (appends or updates existing).
 */
export async function addCapability(
  wallet: string,
  capability: AgentCapability,
  description?: string,
  confidence: number = 80
): Promise<CapabilityEntry[]> {
  await ensureRegistry();
  const sql = getDb();

  // Get current capabilities
  const rows = await sql`
    SELECT capabilities FROM external_agents WHERE wallet = ${wallet}
  `;

  if (rows.length === 0) {
    throw new Error(`Agent ${wallet.slice(0, 8)}... not found`);
  }

  const current: CapabilityEntry[] = (rows[0].capabilities as CapabilityEntry[]) || [];
  const existingIndex = current.findIndex((c) => c.capability === capability);

  const entry: CapabilityEntry = {
    capability,
    description: description || undefined,
    confidence: Math.max(0, Math.min(100, confidence)),
    addedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    current[existingIndex] = entry;
  } else {
    current.push(entry);
  }

  await sql`
    UPDATE external_agents
    SET capabilities = ${JSON.stringify(current)}::jsonb
    WHERE wallet = ${wallet}
  `;

  console.log(`[ServiceRegistry] Added capability "${capability}" for ${wallet.slice(0, 8)}...`);
  return current;
}

/**
 * Remove a capability from an agent.
 */
export async function removeCapability(
  wallet: string,
  capability: AgentCapability
): Promise<CapabilityEntry[]> {
  await ensureRegistry();
  const sql = getDb();

  const rows = await sql`
    SELECT capabilities FROM external_agents WHERE wallet = ${wallet}
  `;

  if (rows.length === 0) {
    throw new Error(`Agent ${wallet.slice(0, 8)}... not found`);
  }

  const current: CapabilityEntry[] = (rows[0].capabilities as CapabilityEntry[]) || [];
  const filtered = current.filter((c) => c.capability !== capability);

  await sql`
    UPDATE external_agents
    SET capabilities = ${JSON.stringify(filtered)}::jsonb
    WHERE wallet = ${wallet}
  `;

  console.log(`[ServiceRegistry] Removed capability "${capability}" from ${wallet.slice(0, 8)}...`);
  return filtered;
}

/**
 * Get all capabilities for an agent.
 */
export async function getCapabilities(wallet: string): Promise<CapabilityEntry[]> {
  await ensureRegistry();
  const sql = getDb();

  const rows = await sql`
    SELECT capabilities FROM external_agents WHERE wallet = ${wallet}
  `;

  if (rows.length === 0) return [];
  return (rows[0].capabilities as CapabilityEntry[]) || [];
}

// ============================================================================
// DISCOVERY
// ============================================================================

export interface DiscoveryResult {
  wallet: string;
  name: string;
  moltbookUsername: string | null;
  reputationScore: number;
  capabilities: CapabilityEntry[];
  matchedCapability: CapabilityEntry;
}

/**
 * Discover agents by capability.
 * Returns agents that have the specified capability, sorted by reputation score.
 * Uses PostgreSQL JSONB containment queries for efficient filtering.
 */
export async function discoverByCapability(
  capability: AgentCapability,
  options: {
    minReputation?: number;
    minConfidence?: number;
    limit?: number;
  } = {}
): Promise<DiscoveryResult[]> {
  await ensureRegistry();
  const sql = getDb();

  const { minReputation = 0, minConfidence = 0, limit = 20 } = options;

  // Use JSONB containment operator @> to find agents with matching capability
  // The query checks if the capabilities array contains an object with the given capability name
  const capFilter = JSON.stringify([{ capability }]);

  const rows = await sql`
    SELECT wallet, name, moltbook_username, reputation_score, capabilities
    FROM external_agents
    WHERE capabilities @> ${capFilter}::jsonb
      AND COALESCE(reputation_score, 0) >= ${minReputation}
    ORDER BY COALESCE(reputation_score, 0) DESC
    LIMIT ${limit}
  `;

  return rows
    .map((row) => {
      const caps: CapabilityEntry[] = (row.capabilities as CapabilityEntry[]) || [];
      const matched = caps.find((c) => c.capability === capability);
      if (!matched || matched.confidence < minConfidence) return null;

      return {
        wallet: row.wallet as string,
        name: row.name as string,
        moltbookUsername: row.moltbook_username as string | null,
        reputationScore: (row.reputation_score as number) || 0,
        capabilities: caps,
        matchedCapability: matched,
      };
    })
    .filter((r): r is DiscoveryResult => r !== null);
}

/**
 * Get all unique capabilities across all agents, with counts.
 */
export async function getCapabilityDirectory(): Promise<
  Array<{ capability: AgentCapability; agentCount: number; avgConfidence: number }>
> {
  await ensureRegistry();
  const sql = getDb();

  // Unnest the JSONB array and aggregate
  const rows = await sql`
    SELECT
      cap->>'capability' as capability,
      COUNT(DISTINCT wallet) as agent_count,
      AVG((cap->>'confidence')::numeric) as avg_confidence
    FROM external_agents,
    jsonb_array_elements(COALESCE(capabilities, '[]'::jsonb)) as cap
    GROUP BY cap->>'capability'
    ORDER BY COUNT(DISTINCT wallet) DESC
  `;

  return rows.map((row) => ({
    capability: row.capability as AgentCapability,
    agentCount: parseInt(row.agent_count as string, 10),
    avgConfidence: Math.round(parseFloat(row.avg_confidence as string)),
  }));
}
