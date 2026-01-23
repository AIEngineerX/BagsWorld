// Neon PostgreSQL Adapter for ElizaOS
// Provides persistent memory storage using Neon serverless database

import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import type {
  SqlFunction,
  MemoryRow,
  MemoryContent,
  GoalRow,
  RelationshipRow,
  RoomRow,
  ParticipantRow,
  AccountRow,
  CacheRow,
  CoordinationMessageRow,
  SharedContextRow,
} from './types';

const log = createLogger('NeonAdapter');

export class NeonDatabaseAdapter {
  private sql: SqlFunction | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Defer connection until first use
  }

  private async connect(): Promise<SqlFunction> {
    if (this.sql) return this.sql;

    const databaseUrl = process.env.DATABASE_URL ||
                        process.env.NEON_DATABASE_URL ||
                        process.env.POSTGRES_URL ||
                        process.env.NETLIFY_DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('No database URL configured. Set DATABASE_URL environment variable.');
    }

    log.info('Connecting to Neon database...');
    this.sql = neon(databaseUrl) as unknown as SqlFunction;
    return this.sql;
  }

  // Helper: ensures initialized and returns sql function
  private async getSql(): Promise<SqlFunction> {
    await this.initialize();
    return this.connect();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    const sql = await this.connect();

    log.info('Initializing ElizaOS database tables...');

    // Create memories table (core conversation storage)
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL,
        user_id UUID NOT NULL,
        room_id UUID NOT NULL,
        content JSONB NOT NULL,
        embedding VECTOR(1536),
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        unique_key TEXT,
        UNIQUE(agent_id, unique_key)
      )
    `;

    // Create goals table
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL,
        room_id UUID NOT NULL,
        user_id UUID NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        objectives JSONB NOT NULL DEFAULT '[]',
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `;

    // Create relationships table
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL,
        user_id UUID NOT NULL,
        room_id UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'NEUTRAL',
        trust DECIMAL NOT NULL DEFAULT 0,
        respect DECIMAL NOT NULL DEFAULT 0.5,
        familiarity DECIMAL NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        UNIQUE(agent_id, user_id)
      )
    `;

    // Create rooms table
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `;

    // Create participants table
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES eliza_rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        joined_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        last_active_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        UNIQUE(room_id, user_id)
      )
    `;

    // Create accounts table
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        email TEXT,
        avatar_url TEXT,
        details JSONB NOT NULL DEFAULT '{}',
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `;

    // Create cache table
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_cache (
        key TEXT NOT NULL,
        agent_id UUID NOT NULL,
        value JSONB NOT NULL,
        expires_at BIGINT,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        PRIMARY KEY(key, agent_id)
      )
    `;

    // Create coordination messages table (for multi-agent communication)
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_coordination (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_agent_id UUID NOT NULL,
        to_agent_id UUID,
        message_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        processed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        processed_at BIGINT
      )
    `;

    // Create shared context table (for multi-agent awareness)
    await sql`
      CREATE TABLE IF NOT EXISTS eliza_shared_context (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        context_type TEXT NOT NULL,
        context_key TEXT NOT NULL,
        data JSONB NOT NULL,
        updated_by UUID NOT NULL,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        expires_at BIGINT,
        UNIQUE(context_type, context_key)
      )
    `;

    // Create indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_memories_agent ON eliza_memories(agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_memories_room ON eliza_memories(room_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_memories_created ON eliza_memories(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_goals_agent ON eliza_goals(agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_goals_status ON eliza_goals(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_relationships_agent ON eliza_relationships(agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_coordination_to ON eliza_coordination(to_agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_coordination_processed ON eliza_coordination(processed)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_shared_context_type ON eliza_shared_context(context_type)`;

    this.initialized = true;
    log.info('Database tables initialized successfully');
  }

  // ==================== Memory Operations ====================

  async createMemory(
    agentId: string,
    userId: string,
    roomId: string,
    content: MemoryContent,
    embedding?: number[],
    uniqueKey?: string
  ): Promise<string> {
    await this.initialize();
    const sql = await this.connect();

    const id = uuidv4();
    const createdAt = Date.now();

    if (uniqueKey) {
      // Upsert for unique memories
      await sql`
        INSERT INTO eliza_memories (id, agent_id, user_id, room_id, content, embedding, created_at, unique_key)
        VALUES (${id}, ${agentId}, ${userId}, ${roomId}, ${JSON.stringify(content)}, ${embedding || null}, ${createdAt}, ${uniqueKey})
        ON CONFLICT (agent_id, unique_key) DO UPDATE SET
          content = ${JSON.stringify(content)},
          embedding = ${embedding || null},
          created_at = ${createdAt}
      `;
    } else {
      await sql`
        INSERT INTO eliza_memories (id, agent_id, user_id, room_id, content, embedding, created_at)
        VALUES (${id}, ${agentId}, ${userId}, ${roomId}, ${JSON.stringify(content)}, ${embedding || null}, ${createdAt})
      `;
    }

    log.debug(`Created memory ${id} for agent ${agentId}`);
    return id;
  }

  async getMemories(
    agentId: string,
    roomId: string,
    limit: number = 50,
    beforeTimestamp?: number
  ): Promise<MemoryRow[]> {
    await this.initialize();
    const sql = await this.connect();

    let rows: unknown[];
    if (beforeTimestamp) {
      rows = await sql`
        SELECT * FROM eliza_memories
        WHERE agent_id = ${agentId} AND room_id = ${roomId} AND created_at < ${beforeTimestamp}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM eliza_memories
        WHERE agent_id = ${agentId} AND room_id = ${roomId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return (rows as MemoryRow[]).map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
    }));
  }

  async getMemoriesByUser(agentId: string, userId: string, limit: number = 50): Promise<MemoryRow[]> {
    await this.initialize();
    const sql = await this.connect();

    const rows = await sql`
      SELECT * FROM eliza_memories
      WHERE agent_id = ${agentId} AND user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return (rows as MemoryRow[]).map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
    }));
  }

  async searchMemoriesByEmbedding(
    agentId: string,
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<MemoryRow[]> {
    await this.initialize();
    const sql = await this.connect();

    // Use cosine similarity search if pgvector is available
    const rows = await sql`
      SELECT *, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
      FROM eliza_memories
      WHERE agent_id = ${agentId}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) > ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return (rows as (MemoryRow & { similarity: number })[]).map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
    }));
  }

  async deleteMemory(id: string): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    await sql`DELETE FROM eliza_memories WHERE id = ${id}`;
    log.debug(`Deleted memory ${id}`);
  }

  async deleteMemoriesByRoom(agentId: string, roomId: string): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    await sql`DELETE FROM eliza_memories WHERE agent_id = ${agentId} AND room_id = ${roomId}`;
    log.debug(`Deleted memories for room ${roomId}`);
  }

  async countMemories(agentId: string, roomId?: string): Promise<number> {
    await this.initialize();
    const sql = await this.connect();

    let result: unknown[];
    if (roomId) {
      result = await sql`
        SELECT COUNT(*) as count FROM eliza_memories
        WHERE agent_id = ${agentId} AND room_id = ${roomId}
      `;
    } else {
      result = await sql`
        SELECT COUNT(*) as count FROM eliza_memories
        WHERE agent_id = ${agentId}
      `;
    }

    return parseInt((result as [{ count: string }])[0].count, 10);
  }

  // ==================== Goal Operations ====================

  async createGoal(
    agentId: string,
    roomId: string,
    userId: string,
    name: string,
    objectives: Array<{ description: string }>
  ): Promise<string> {
    await this.initialize();
    const sql = await this.connect();

    const id = uuidv4();
    const now = Date.now();
    const objectivesWithIds = objectives.map(obj => ({
      id: uuidv4(),
      description: obj.description,
      completed: false,
    }));

    await sql`
      INSERT INTO eliza_goals (id, agent_id, room_id, user_id, name, objectives, created_at, updated_at)
      VALUES (${id}, ${agentId}, ${roomId}, ${userId}, ${name}, ${JSON.stringify(objectivesWithIds)}, ${now}, ${now})
    `;

    return id;
  }

  async getGoals(agentId: string, status?: string): Promise<GoalRow[]> {
    await this.initialize();
    const sql = await this.connect();

    let rows: unknown[];
    if (status) {
      rows = await sql`
        SELECT * FROM eliza_goals
        WHERE agent_id = ${agentId} AND status = ${status}
        ORDER BY created_at DESC
      `;
    } else {
      rows = await sql`
        SELECT * FROM eliza_goals
        WHERE agent_id = ${agentId}
        ORDER BY created_at DESC
      `;
    }

    return (rows as GoalRow[]).map(row => ({
      ...row,
      objectives: typeof row.objectives === 'string' ? JSON.parse(row.objectives) : row.objectives,
    }));
  }

  async updateGoal(id: string, updates: { status?: string; objectives?: unknown[] }): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const now = Date.now();

    if (updates.status && updates.objectives) {
      await sql`
        UPDATE eliza_goals SET
          status = ${updates.status},
          objectives = ${JSON.stringify(updates.objectives)},
          updated_at = ${now}
        WHERE id = ${id}
      `;
    } else if (updates.status) {
      await sql`
        UPDATE eliza_goals SET status = ${updates.status}, updated_at = ${now}
        WHERE id = ${id}
      `;
    } else if (updates.objectives) {
      await sql`
        UPDATE eliza_goals SET objectives = ${JSON.stringify(updates.objectives)}, updated_at = ${now}
        WHERE id = ${id}
      `;
    }
  }

  // ==================== Relationship Operations ====================

  async getRelationship(agentId: string, userId: string): Promise<RelationshipRow | null> {
    await this.initialize();
    const sql = await this.connect();

    const rows = await sql`
      SELECT * FROM eliza_relationships
      WHERE agent_id = ${agentId} AND user_id = ${userId}
      LIMIT 1
    `;

    return (rows as RelationshipRow[])[0] || null;
  }

  async upsertRelationship(
    agentId: string,
    userId: string,
    roomId: string,
    updates: {
      status?: string;
      trust?: number;
      respect?: number;
      familiarity?: number;
    }
  ): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const id = uuidv4();
    const now = Date.now();

    await sql`
      INSERT INTO eliza_relationships (id, agent_id, user_id, room_id, status, trust, respect, familiarity, created_at, updated_at)
      VALUES (
        ${id}, ${agentId}, ${userId}, ${roomId},
        ${updates.status || 'NEUTRAL'},
        ${updates.trust ?? 0},
        ${updates.respect ?? 0.5},
        ${updates.familiarity ?? 0},
        ${now}, ${now}
      )
      ON CONFLICT (agent_id, user_id) DO UPDATE SET
        status = COALESCE(${updates.status}, eliza_relationships.status),
        trust = COALESCE(${updates.trust}, eliza_relationships.trust),
        respect = COALESCE(${updates.respect}, eliza_relationships.respect),
        familiarity = COALESCE(${updates.familiarity}, eliza_relationships.familiarity),
        updated_at = ${now}
    `;
  }

  async getRelationships(agentId: string): Promise<RelationshipRow[]> {
    await this.initialize();
    const sql = await this.connect();

    const rows = await sql`
      SELECT * FROM eliza_relationships
      WHERE agent_id = ${agentId}
      ORDER BY updated_at DESC
    `;

    return rows as RelationshipRow[];
  }

  // ==================== Room Operations ====================

  async createRoom(): Promise<string> {
    await this.initialize();
    const sql = await this.connect();

    const id = uuidv4();
    const now = Date.now();

    await sql`
      INSERT INTO eliza_rooms (id, created_at)
      VALUES (${id}, ${now})
    `;

    return id;
  }

  async getRoom(id: string): Promise<RoomRow | null> {
    await this.initialize();
    const sql = await this.connect();

    const rows = await sql`
      SELECT * FROM eliza_rooms WHERE id = ${id}
    `;

    return (rows as RoomRow[])[0] || null;
  }

  async addParticipant(roomId: string, userId: string): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const id = uuidv4();
    const now = Date.now();

    await sql`
      INSERT INTO eliza_participants (id, room_id, user_id, joined_at, last_active_at)
      VALUES (${id}, ${roomId}, ${userId}, ${now}, ${now})
      ON CONFLICT (room_id, user_id) DO UPDATE SET last_active_at = ${now}
    `;
  }

  async getParticipants(roomId: string): Promise<ParticipantRow[]> {
    await this.initialize();
    const sql = await this.connect();

    const rows = await sql`
      SELECT * FROM eliza_participants WHERE room_id = ${roomId}
    `;

    return rows as ParticipantRow[];
  }

  // ==================== Account Operations ====================

  async getAccount(id: string): Promise<AccountRow | null> {
    await this.initialize();
    const sql = await this.connect();

    const rows = await sql`
      SELECT * FROM eliza_accounts WHERE id = ${id}
    `;

    return (rows as AccountRow[])[0] || null;
  }

  async getAccountByUsername(username: string): Promise<AccountRow | null> {
    await this.initialize();
    const sql = await this.connect();

    const rows = await sql`
      SELECT * FROM eliza_accounts WHERE username = ${username}
    `;

    return (rows as AccountRow[])[0] || null;
  }

  async createAccount(
    name: string,
    username: string,
    email?: string,
    avatarUrl?: string,
    details?: Record<string, unknown>
  ): Promise<string> {
    await this.initialize();
    const sql = await this.connect();

    const id = uuidv4();
    const now = Date.now();

    await sql`
      INSERT INTO eliza_accounts (id, name, username, email, avatar_url, details, created_at)
      VALUES (${id}, ${name}, ${username}, ${email || null}, ${avatarUrl || null}, ${JSON.stringify(details || {})}, ${now})
      ON CONFLICT (username) DO NOTHING
    `;

    return id;
  }

  // ==================== Cache Operations ====================

  async getCache(agentId: string, key: string): Promise<unknown | null> {
    await this.initialize();
    const sql = await this.connect();

    const now = Date.now();
    const rows = await sql`
      SELECT value FROM eliza_cache
      WHERE agent_id = ${agentId} AND key = ${key}
        AND (expires_at IS NULL OR expires_at > ${now})
    `;

    if ((rows as CacheRow[]).length === 0) return null;

    const row = (rows as CacheRow[])[0];
    return typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  }

  async setCache(agentId: string, key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const now = Date.now();
    const expiresAt = ttlMs ? now + ttlMs : null;

    await sql`
      INSERT INTO eliza_cache (key, agent_id, value, expires_at, created_at)
      VALUES (${key}, ${agentId}, ${JSON.stringify(value)}, ${expiresAt}, ${now})
      ON CONFLICT (key, agent_id) DO UPDATE SET
        value = ${JSON.stringify(value)},
        expires_at = ${expiresAt},
        created_at = ${now}
    `;
  }

  async deleteCache(agentId: string, key: string): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    await sql`
      DELETE FROM eliza_cache WHERE agent_id = ${agentId} AND key = ${key}
    `;
  }

  async clearExpiredCache(): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const now = Date.now();
    await sql`
      DELETE FROM eliza_cache WHERE expires_at IS NOT NULL AND expires_at < ${now}
    `;
  }

  // ==================== Coordination Operations (Multi-Agent) ====================

  async sendCoordinationMessage(
    fromAgentId: string,
    toAgentId: string | null,
    messageType: 'event' | 'query' | 'response' | 'alert',
    payload: Record<string, unknown>
  ): Promise<string> {
    await this.initialize();
    const sql = await this.connect();

    const id = uuidv4();
    const now = Date.now();

    await sql`
      INSERT INTO eliza_coordination (id, from_agent_id, to_agent_id, message_type, payload, created_at)
      VALUES (${id}, ${fromAgentId}, ${toAgentId}, ${messageType}, ${JSON.stringify(payload)}, ${now})
    `;

    log.debug(`Sent coordination message ${id} from ${fromAgentId} to ${toAgentId || 'all'}`);
    return id;
  }

  async getUnprocessedCoordinationMessages(agentId: string): Promise<CoordinationMessageRow[]> {
    await this.initialize();
    const sql = await this.connect();

    const rows = await sql`
      SELECT * FROM eliza_coordination
      WHERE (to_agent_id = ${agentId} OR to_agent_id IS NULL)
        AND from_agent_id != ${agentId}
        AND processed = FALSE
      ORDER BY created_at ASC
    `;

    return (rows as CoordinationMessageRow[]).map(row => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    }));
  }

  async markCoordinationMessageProcessed(id: string): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const now = Date.now();
    await sql`
      UPDATE eliza_coordination SET processed = TRUE, processed_at = ${now}
      WHERE id = ${id}
    `;
  }

  async cleanOldCoordinationMessages(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const cutoff = Date.now() - olderThanMs;
    await sql`
      DELETE FROM eliza_coordination WHERE created_at < ${cutoff}
    `;
  }

  // ==================== Shared Context Operations (Multi-Agent) ====================

  async setSharedContext(
    contextType: string,
    contextKey: string,
    data: Record<string, unknown>,
    updatedBy: string,
    expiresInMs?: number
  ): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const id = uuidv4();
    const now = Date.now();
    const expiresAt = expiresInMs ? now + expiresInMs : null;

    await sql`
      INSERT INTO eliza_shared_context (id, context_type, context_key, data, updated_by, created_at, updated_at, expires_at)
      VALUES (${id}, ${contextType}, ${contextKey}, ${JSON.stringify(data)}, ${updatedBy}, ${now}, ${now}, ${expiresAt})
      ON CONFLICT (context_type, context_key) DO UPDATE SET
        data = ${JSON.stringify(data)},
        updated_by = ${updatedBy},
        updated_at = ${now},
        expires_at = ${expiresAt}
    `;
  }

  async getSharedContext(contextType: string, contextKey?: string): Promise<SharedContextRow[]> {
    await this.initialize();
    const sql = await this.connect();

    const now = Date.now();
    let rows: unknown[];

    if (contextKey) {
      rows = await sql`
        SELECT * FROM eliza_shared_context
        WHERE context_type = ${contextType} AND context_key = ${contextKey}
          AND (expires_at IS NULL OR expires_at > ${now})
      `;
    } else {
      rows = await sql`
        SELECT * FROM eliza_shared_context
        WHERE context_type = ${contextType}
          AND (expires_at IS NULL OR expires_at > ${now})
        ORDER BY updated_at DESC
      `;
    }

    return (rows as SharedContextRow[]).map(row => ({
      ...row,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    }));
  }

  async deleteSharedContext(contextType: string, contextKey: string): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    await sql`
      DELETE FROM eliza_shared_context
      WHERE context_type = ${contextType} AND context_key = ${contextKey}
    `;
  }

  async cleanExpiredSharedContext(): Promise<void> {
    await this.initialize();
    const sql = await this.connect();

    const now = Date.now();
    await sql`
      DELETE FROM eliza_shared_context WHERE expires_at IS NOT NULL AND expires_at < ${now}
    `;
  }

  // ==================== Utility Operations ====================

  async close(): Promise<void> {
    // Neon serverless doesn't require explicit connection closing
    this.sql = null;
    this.initialized = false;
    log.info('Database connection closed');
  }

  async healthCheck(): Promise<boolean> {
    const sql = await this.connect();
    const result = await sql`SELECT 1 as health`;
    return (result as [{ health: number }])[0]?.health === 1;
  }
}

// Singleton instance
let instance: NeonDatabaseAdapter | null = null;

export function getDatabaseAdapter(): NeonDatabaseAdapter {
  if (!instance) {
    instance = new NeonDatabaseAdapter();
  }
  return instance;
}

export default NeonDatabaseAdapter;
