// RelationshipService - Agent relationship tracking and evolution
//
// Each agent builds relationships with users and other agents over time.
// Trust, familiarity, sentiment, and respect evolve based on interaction
// patterns. This data is injected into system prompts so agents can
// personalize responses to returning users.

import { NeonQueryFunction } from '@neondatabase/serverless';

export type TargetType = 'user' | 'agent';

export interface AgentRelationship {
  id: string;
  agentId: string;
  targetId: string;
  targetType: TargetType;
  trust: number;        // 0.0 - 1.0 (how much the agent trusts this person)
  familiarity: number;  // 0.0 - 1.0 (how well the agent knows this person)
  sentiment: number;    // -1.0 to 1.0 (negative = adversarial, positive = friendly)
  respect: number;      // 0.0 - 1.0 (how much the agent respects this person)
  interactionCount: number;
  lastTopics: string[];
  lastInteraction: Date | null;
  notes: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RelationshipUpdate {
  trustDelta?: number;
  familiarityDelta?: number;
  sentimentDelta?: number;
  respectDelta?: number;
  topics?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

/** Row shape from Neon SQL queries */
interface RelationshipRow {
  id: string;
  agent_id: string;
  target_id: string;
  target_type: string;
  trust: number;
  familiarity: number;
  sentiment: number;
  respect: number;
  interaction_count: number;
  last_topics: string[];
  last_interaction: string | null;
  notes: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function rowToRelationship(row: RelationshipRow): AgentRelationship {
  return {
    id: row.id,
    agentId: row.agent_id,
    targetId: row.target_id,
    targetType: row.target_type as TargetType,
    trust: row.trust,
    familiarity: row.familiarity,
    sentiment: row.sentiment,
    respect: row.respect,
    interactionCount: row.interaction_count,
    lastTopics: row.last_topics || [],
    lastInteraction: row.last_interaction ? new Date(row.last_interaction) : null,
    notes: row.notes || '',
    metadata: row.metadata || {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class RelationshipService {
  private sql: NeonQueryFunction<false, false>;

  constructor(sql: NeonQueryFunction<false, false>) {
    this.sql = sql;
  }

  /**
   * Get the relationship between an agent and a specific target.
   * Returns null if no relationship exists yet.
   */
  async getRelationship(agentId: string, targetId: string): Promise<AgentRelationship | null> {
    const rows = await this.sql`
      SELECT id, agent_id, target_id, target_type, trust, familiarity, sentiment, respect,
        interaction_count, last_topics, last_interaction, notes, metadata, created_at, updated_at
      FROM agent_relationships
      WHERE agent_id = ${agentId} AND target_id = ${targetId}
      LIMIT 1
    ` as RelationshipRow[];

    return rows.length > 0 ? rowToRelationship(rows[0]) : null;
  }

  /**
   * Create or update a relationship. Uses ON CONFLICT for atomic upsert.
   */
  async upsertRelationship(
    agentId: string,
    targetId: string,
    targetType: TargetType,
    update?: RelationshipUpdate
  ): Promise<AgentRelationship> {
    const trust = clamp(0.5 + (update?.trustDelta ?? 0), 0, 1);
    const familiarity = clamp(0.0 + (update?.familiarityDelta ?? 0), 0, 1);
    const sentiment = clamp(0.0 + (update?.sentimentDelta ?? 0), -1, 1);
    const respect = clamp(0.5 + (update?.respectDelta ?? 0), 0, 1);
    const topics = update?.topics ?? [];
    const notes = update?.notes ?? '';
    const metadata = update?.metadata ?? {};

    const rows = await this.sql`
      INSERT INTO agent_relationships (agent_id, target_id, target_type, trust, familiarity, sentiment, respect, interaction_count, last_topics, last_interaction, notes, metadata)
      VALUES (${agentId}, ${targetId}, ${targetType}, ${trust}, ${familiarity}, ${sentiment}, ${respect}, 1, ${topics}::text[], NOW(), ${notes}, ${JSON.stringify(metadata)}::jsonb)
      ON CONFLICT (agent_id, target_id) DO UPDATE SET
        trust = LEAST(1, GREATEST(0, agent_relationships.trust + ${update?.trustDelta ?? 0})),
        familiarity = LEAST(1, GREATEST(0, agent_relationships.familiarity + ${update?.familiarityDelta ?? 0})),
        sentiment = LEAST(1, GREATEST(-1, agent_relationships.sentiment + ${update?.sentimentDelta ?? 0})),
        respect = LEAST(1, GREATEST(0, agent_relationships.respect + ${update?.respectDelta ?? 0})),
        interaction_count = agent_relationships.interaction_count + 1,
        last_topics = CASE
          WHEN cardinality(${topics}::text[]) > 0 THEN ${topics}::text[]
          ELSE agent_relationships.last_topics
        END,
        last_interaction = NOW(),
        notes = CASE
          WHEN ${notes} != '' THEN ${notes}
          ELSE agent_relationships.notes
        END,
        metadata = agent_relationships.metadata || ${JSON.stringify(metadata)}::jsonb,
        updated_at = NOW()
      RETURNING id, agent_id, target_id, target_type, trust, familiarity, sentiment, respect,
        interaction_count, last_topics, last_interaction, notes, metadata, created_at, updated_at
    ` as RelationshipRow[];

    return rowToRelationship(rows[0]);
  }

  /**
   * Update relationship after a conversation interaction.
   * Automatically adjusts familiarity (+0.05 per interaction, diminishing),
   * and optionally trust/sentiment based on the interaction quality.
   */
  async updateAfterInteraction(
    agentId: string,
    targetId: string,
    targetType: TargetType,
    interaction: {
      topics?: string[];
      sentiment?: number;   // -1 to 1: how positive/negative the interaction was
      wasHelpful?: boolean;  // Agent provided useful info
      wasRude?: boolean;     // User was rude or adversarial
    } = {}
  ): Promise<AgentRelationship> {
    // Familiarity grows with each interaction but diminishes over time
    const familiarityGain = 0.05;

    // Trust adjustments
    let trustDelta = 0;
    if (interaction.wasHelpful) trustDelta += 0.02;
    if (interaction.wasRude) trustDelta -= 0.05;

    // Sentiment blends toward interaction sentiment
    let sentimentDelta = 0;
    if (interaction.sentiment !== undefined) {
      sentimentDelta = interaction.sentiment * 0.1; // Gradual shift
    }

    // Respect: grows when user engages substantively
    let respectDelta = 0;
    if (interaction.topics && interaction.topics.length > 0) {
      respectDelta = 0.01;
    }

    return this.upsertRelationship(agentId, targetId, targetType, {
      trustDelta,
      familiarityDelta: familiarityGain,
      sentimentDelta,
      respectDelta,
      topics: interaction.topics,
    });
  }

  /**
   * Get all relationships for an agent, optionally filtered by target type.
   * Ordered by most recent interaction.
   */
  async getAgentRelationships(
    agentId: string,
    options: {
      targetType?: TargetType;
      limit?: number;
      minFamiliarity?: number;
    } = {}
  ): Promise<AgentRelationship[]> {
    const limit = options.limit ?? 50;

    let rows: RelationshipRow[];

    if (options.targetType && options.minFamiliarity !== undefined) {
      rows = await this.sql`
        SELECT id, agent_id, target_id, target_type, trust, familiarity, sentiment, respect,
          interaction_count, last_topics, last_interaction, notes, metadata, created_at, updated_at
        FROM agent_relationships
        WHERE agent_id = ${agentId} AND target_type = ${options.targetType} AND familiarity >= ${options.minFamiliarity}
        ORDER BY last_interaction DESC NULLS LAST
        LIMIT ${limit}
      ` as RelationshipRow[];
    } else if (options.targetType) {
      rows = await this.sql`
        SELECT id, agent_id, target_id, target_type, trust, familiarity, sentiment, respect,
          interaction_count, last_topics, last_interaction, notes, metadata, created_at, updated_at
        FROM agent_relationships
        WHERE agent_id = ${agentId} AND target_type = ${options.targetType}
        ORDER BY last_interaction DESC NULLS LAST
        LIMIT ${limit}
      ` as RelationshipRow[];
    } else if (options.minFamiliarity !== undefined) {
      rows = await this.sql`
        SELECT id, agent_id, target_id, target_type, trust, familiarity, sentiment, respect,
          interaction_count, last_topics, last_interaction, notes, metadata, created_at, updated_at
        FROM agent_relationships
        WHERE agent_id = ${agentId} AND familiarity >= ${options.minFamiliarity}
        ORDER BY last_interaction DESC NULLS LAST
        LIMIT ${limit}
      ` as RelationshipRow[];
    } else {
      rows = await this.sql`
        SELECT id, agent_id, target_id, target_type, trust, familiarity, sentiment, respect,
          interaction_count, last_topics, last_interaction, notes, metadata, created_at, updated_at
        FROM agent_relationships
        WHERE agent_id = ${agentId}
        ORDER BY last_interaction DESC NULLS LAST
        LIMIT ${limit}
      ` as RelationshipRow[];
    }

    return rows.map(rowToRelationship);
  }

  /**
   * Decay familiarity for relationships with no recent interaction.
   * Called periodically to ensure inactive relationships fade over time,
   * making room for newer, more active connections.
   *
   * @param staleThresholdMs - Time without interaction before decay starts (default: 7 days)
   * @param decayAmount - How much familiarity to subtract per cycle (default: 0.05)
   * @returns Number of relationships that were decayed
   */
  async decayInactiveRelationships(
    staleThresholdMs: number = 7 * 24 * 60 * 60 * 1000,
    decayAmount: number = 0.05
  ): Promise<number> {
    const cutoff = new Date(Date.now() - staleThresholdMs).toISOString();

    const result = await this.sql`
      UPDATE agent_relationships
      SET familiarity = GREATEST(0, familiarity - ${decayAmount}),
          updated_at = NOW()
      WHERE last_interaction < ${cutoff}
        AND familiarity > 0
    `;

    // Neon tagged template returns an array-like with a count property
    return (result as unknown as { count: number }).count ?? 0;
  }

  /**
   * Delete a relationship.
   */
  async deleteRelationship(agentId: string, targetId: string): Promise<void> {
    await this.sql`
      DELETE FROM agent_relationships
      WHERE agent_id = ${agentId} AND target_id = ${targetId}
    `;
  }

  /**
   * Build a text summary of the agent's relationship with a specific user
   * for injection into the system prompt.
   */
  async summarizeForPrompt(agentId: string, targetId: string): Promise<string> {
    const rel = await this.getRelationship(agentId, targetId);
    if (!rel) return '';

    const parts: string[] = [];

    // Interaction count gives a sense of history
    if (rel.interactionCount === 1) {
      parts.push('This is a new user you just met.');
    } else if (rel.interactionCount < 5) {
      parts.push(`You've chatted with this user ${rel.interactionCount} times before.`);
    } else if (rel.interactionCount < 20) {
      parts.push(`This user is becoming a regular - ${rel.interactionCount} conversations so far.`);
    } else {
      parts.push(`This is a long-time friend - you've had ${rel.interactionCount} conversations.`);
    }

    // Familiarity level
    if (rel.familiarity >= 0.7) {
      parts.push('You know them well.');
    } else if (rel.familiarity >= 0.3) {
      parts.push('You\'re getting to know them.');
    }

    // Trust level
    if (rel.trust >= 0.8) {
      parts.push('You trust them highly.');
    } else if (rel.trust < 0.3) {
      parts.push('You\'re cautious around them.');
    }

    // Sentiment
    if (rel.sentiment >= 0.5) {
      parts.push('Your interactions have been very positive.');
    } else if (rel.sentiment <= -0.3) {
      parts.push('Past interactions have been somewhat tense.');
    }

    // Last topics discussed
    if (rel.lastTopics.length > 0) {
      parts.push(`Last time you talked about: ${rel.lastTopics.join(', ')}.`);
    }

    // Notes
    if (rel.notes) {
      parts.push(`Notes: ${rel.notes}`);
    }

    return parts.join(' ');
  }
}

// Singleton
let instance: RelationshipService | null = null;

export function getRelationshipService(sql?: NeonQueryFunction<false, false>): RelationshipService | null {
  if (!instance && sql) {
    instance = new RelationshipService(sql);
  }
  return instance;
}

export function setRelationshipService(service: RelationshipService): void {
  instance = service;
}

export function resetRelationshipService(): void {
  instance = null;
}

export default RelationshipService;
