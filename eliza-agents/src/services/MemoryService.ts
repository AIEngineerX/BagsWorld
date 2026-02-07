// MemoryService - Agent memory persistence with pgvector semantic search
//
// Stores conversation fragments, facts, reflections, and knowledge in the
// agent_memories table. Supports both recency-based and vector-similarity
// retrieval. Embeds text via EmbeddingService when available.
//
// Memory types:
//   message    - User/assistant conversation turns
//   fact       - Extracted facts about users or the world
//   reflection - Agent self-reflection / summary
//   knowledge  - Injected domain knowledge

import { NeonQueryFunction } from '@neondatabase/serverless';
import { EmbeddingService, getEmbeddingService } from './EmbeddingService.js';

export type MemoryType = 'message' | 'fact' | 'reflection' | 'knowledge';

export interface AgentMemory {
  id: string;
  agentId: string;
  roomId: string | null;
  userId: string | null;
  content: string;
  embedding: number[] | null;
  memoryType: MemoryType;
  importance: number;
  emotionalValence: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateMemoryInput {
  agentId: string;
  content: string;
  memoryType: MemoryType;
  roomId?: string;
  userId?: string;
  importance?: number;
  emotionalValence?: number;
  metadata?: Record<string, unknown>;
}

export interface MemorySearchResult {
  memory: AgentMemory;
  similarity: number;
}

/** Row shape returned from Neon SQL queries */
interface MemoryRow {
  id: string;
  agent_id: string;
  room_id: string | null;
  user_id: string | null;
  content: string;
  embedding: string | null;
  memory_type: string;
  importance: number;
  emotional_valence: number;
  metadata: Record<string, unknown>;
  created_at: string;
  similarity?: number;
}

function rowToMemory(row: MemoryRow): AgentMemory {
  return {
    id: row.id,
    agentId: row.agent_id,
    roomId: row.room_id,
    userId: row.user_id,
    content: row.content,
    embedding: null, // Don't return raw vectors over the wire
    memoryType: row.memory_type as MemoryType,
    importance: row.importance,
    emotionalValence: row.emotional_valence,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
  };
}

export class MemoryService {
  private sql: NeonQueryFunction<false, false>;
  private embeddingService: EmbeddingService;

  constructor(sql: NeonQueryFunction<false, false>, embeddingService?: EmbeddingService) {
    this.sql = sql;
    this.embeddingService = embeddingService || getEmbeddingService();
  }

  /**
   * Store a new memory, optionally embedding the content for vector search.
   */
  async createMemory(input: CreateMemoryInput): Promise<AgentMemory> {
    const embedding = await this.embeddingService.embed(input.content);
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;
    const metadata = input.metadata ?? {};

    const rows = await this.sql`
      INSERT INTO agent_memories (agent_id, room_id, user_id, content, embedding, memory_type, importance, emotional_valence, metadata)
      VALUES (
        ${input.agentId},
        ${input.roomId ?? null},
        ${input.userId ?? null},
        ${input.content},
        ${embeddingStr}::vector,
        ${input.memoryType},
        ${input.importance ?? 0.5},
        ${input.emotionalValence ?? 0.0},
        ${JSON.stringify(metadata)}::jsonb
      )
      RETURNING id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at
    ` as MemoryRow[];

    return rowToMemory(rows[0]);
  }

  /**
   * Retrieve memories by agent, optionally filtered by type, room, or user.
   * Ordered by creation time descending (most recent first).
   */
  async getMemories(
    agentId: string,
    options: {
      memoryType?: MemoryType;
      roomId?: string;
      userId?: string;
      limit?: number;
    } = {}
  ): Promise<AgentMemory[]> {
    const limit = options.limit ?? 20;

    // Build query based on provided filters
    let rows: MemoryRow[];

    if (options.memoryType && options.roomId) {
      rows = await this.sql`
        SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at
        FROM agent_memories
        WHERE agent_id = ${agentId} AND memory_type = ${options.memoryType} AND room_id = ${options.roomId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as MemoryRow[];
    } else if (options.memoryType && options.userId) {
      rows = await this.sql`
        SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at
        FROM agent_memories
        WHERE agent_id = ${agentId} AND memory_type = ${options.memoryType} AND user_id = ${options.userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as MemoryRow[];
    } else if (options.memoryType) {
      rows = await this.sql`
        SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at
        FROM agent_memories
        WHERE agent_id = ${agentId} AND memory_type = ${options.memoryType}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as MemoryRow[];
    } else if (options.roomId) {
      rows = await this.sql`
        SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at
        FROM agent_memories
        WHERE agent_id = ${agentId} AND room_id = ${options.roomId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as MemoryRow[];
    } else if (options.userId) {
      rows = await this.sql`
        SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at
        FROM agent_memories
        WHERE agent_id = ${agentId} AND user_id = ${options.userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as MemoryRow[];
    } else {
      rows = await this.sql`
        SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at
        FROM agent_memories
        WHERE agent_id = ${agentId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as MemoryRow[];
    }

    return rows.map(rowToMemory);
  }

  /**
   * Semantic similarity search using pgvector cosine distance.
   * Returns memories ranked by similarity to the query text.
   * Falls back to recency-based retrieval when embeddings are not available.
   */
  async searchSimilar(
    agentId: string,
    queryText: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      memoryType?: MemoryType;
    } = {}
  ): Promise<MemorySearchResult[]> {
    const limit = options.limit ?? 10;
    const minSimilarity = options.minSimilarity ?? 0.3;

    const queryEmbedding = await this.embeddingService.embed(queryText);

    // If we can't generate embeddings, fall back to recent memories
    if (!queryEmbedding) {
      const fallback = await this.getMemories(agentId, {
        memoryType: options.memoryType,
        limit,
      });
      return fallback.map(m => ({ memory: m, similarity: 0 }));
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    let rows: MemoryRow[];

    if (options.memoryType) {
      rows = await this.sql`
        SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at,
          1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM agent_memories
        WHERE agent_id = ${agentId}
          AND memory_type = ${options.memoryType}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${minSimilarity}
        ORDER BY similarity DESC
        LIMIT ${limit}
      ` as MemoryRow[];
    } else {
      rows = await this.sql`
        SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at,
          1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM agent_memories
        WHERE agent_id = ${agentId}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${minSimilarity}
        ORDER BY similarity DESC
        LIMIT ${limit}
      ` as MemoryRow[];
    }

    return rows.map(row => ({
      memory: rowToMemory(row),
      similarity: row.similarity ?? 0,
    }));
  }

  /**
   * Get the most important memories for an agent (highest importance score).
   */
  async getImportantMemories(
    agentId: string,
    limit: number = 10
  ): Promise<AgentMemory[]> {
    const rows = await this.sql`
      SELECT id, agent_id, room_id, user_id, content, memory_type, importance, emotional_valence, metadata, created_at
      FROM agent_memories
      WHERE agent_id = ${agentId} AND importance >= 0.7
      ORDER BY importance DESC, created_at DESC
      LIMIT ${limit}
    ` as MemoryRow[];

    return rows.map(rowToMemory);
  }

  /**
   * Count memories for an agent, optionally filtered by type.
   */
  async countMemories(agentId: string, memoryType?: MemoryType): Promise<number> {
    let rows: Array<{ count: string }>;

    if (memoryType) {
      rows = await this.sql`
        SELECT COUNT(*) as count FROM agent_memories
        WHERE agent_id = ${agentId} AND memory_type = ${memoryType}
      ` as Array<{ count: string }>;
    } else {
      rows = await this.sql`
        SELECT COUNT(*) as count FROM agent_memories
        WHERE agent_id = ${agentId}
      ` as Array<{ count: string }>;
    }

    return parseInt(rows[0]?.count || '0', 10);
  }

  /**
   * Delete a specific memory by ID.
   */
  async deleteMemory(memoryId: string): Promise<void> {
    await this.sql`DELETE FROM agent_memories WHERE id = ${memoryId}`;
  }

  /**
   * Prune old low-importance memories to keep storage bounded.
   * Keeps the most recent `keepCount` memories plus any with importance >= 0.7.
   */
  async pruneMemories(agentId: string, keepCount: number = 500): Promise<number> {
    const result = await this.sql`
      DELETE FROM agent_memories
      WHERE id IN (
        SELECT id FROM agent_memories
        WHERE agent_id = ${agentId}
          AND importance < 0.7
        ORDER BY created_at ASC
        OFFSET 0
        LIMIT GREATEST(
          0,
          (SELECT COUNT(*) FROM agent_memories WHERE agent_id = ${agentId}) - ${keepCount}
        )
      )
    ` as Array<Record<string, unknown>>;

    // Neon returns affected rows count
    return (result as unknown as { count?: number }).count ?? 0;
  }

  /**
   * Build a text summary of relevant memories for injection into a system prompt.
   * Combines recent conversation context with semantically relevant memories.
   */
  async summarizeForPrompt(
    agentId: string,
    currentMessage: string,
    options: {
      userId?: string;
      maxTokenBudget?: number;
    } = {}
  ): Promise<string> {
    const maxBudget = options.maxTokenBudget ?? 800;
    // Rough estimate: 1 token ~= 4 chars
    const maxChars = maxBudget * 4;

    const parts: string[] = [];
    let charCount = 0;

    // 1. Semantic search for relevant memories
    const similar = await this.searchSimilar(agentId, currentMessage, {
      limit: 5,
      minSimilarity: 0.4,
    });

    if (similar.length > 0) {
      const relevantLines: string[] = [];
      for (const { memory, similarity } of similar) {
        const line = `[${memory.memoryType}] ${memory.content}`;
        if (charCount + line.length > maxChars) break;
        relevantLines.push(line);
        charCount += line.length;
      }
      if (relevantLines.length > 0) {
        parts.push('RELEVANT MEMORIES:\n' + relevantLines.join('\n'));
      }
    }

    // 2. Facts about this specific user
    if (options.userId && charCount < maxChars) {
      const userFacts = await this.getMemories(agentId, {
        memoryType: 'fact',
        userId: options.userId,
        limit: 5,
      });

      if (userFacts.length > 0) {
        const factLines: string[] = [];
        for (const fact of userFacts) {
          const line = `- ${fact.content}`;
          if (charCount + line.length > maxChars) break;
          factLines.push(line);
          charCount += line.length;
        }
        if (factLines.length > 0) {
          parts.push('WHAT YOU KNOW ABOUT THIS USER:\n' + factLines.join('\n'));
        }
      }
    }

    // 3. Important memories (high-value reflections, key facts)
    if (charCount < maxChars) {
      const important = await this.getImportantMemories(agentId, 3);
      const filtered = important.filter(m =>
        !similar.some(s => s.memory.id === m.id)
      );

      if (filtered.length > 0) {
        const importantLines: string[] = [];
        for (const mem of filtered) {
          const line = `- ${mem.content}`;
          if (charCount + line.length > maxChars) break;
          importantLines.push(line);
          charCount += line.length;
        }
        if (importantLines.length > 0) {
          parts.push('KEY MEMORIES:\n' + importantLines.join('\n'));
        }
      }
    }

    return parts.join('\n\n');
  }
}

// Singleton
let instance: MemoryService | null = null;

export function getMemoryService(sql?: NeonQueryFunction<false, false>): MemoryService | null {
  if (!instance && sql) {
    instance = new MemoryService(sql);
  }
  return instance;
}

export function setMemoryService(service: MemoryService): void {
  instance = service;
}

export function resetMemoryService(): void {
  instance = null;
}

export default MemoryService;
