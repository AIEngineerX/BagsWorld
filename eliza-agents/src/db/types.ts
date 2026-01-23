// Database types for ElizaOS memory persistence

import type { UUID } from '../types/elizaos';

// Memory types stored in the database
export interface MemoryRow {
  id: string;
  agent_id: string;
  user_id: string;
  room_id: string;
  content: MemoryContent;
  embedding: number[] | null;
  created_at: number;
  unique_key: string | null;
}

export interface MemoryContent {
  text: string;
  source?: string;
  action?: string;
  inReplyTo?: string;
  attachments?: Array<{
    type: string;
    url?: string;
    data?: string;
  }>;
  [key: string]: unknown;
}

// Goal tracking
export interface GoalRow {
  id: string;
  agent_id: string;
  room_id: string;
  user_id: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
  objectives: GoalObjective[];
  created_at: number;
  updated_at: number;
}

export interface GoalObjective {
  id: string;
  description: string;
  completed: boolean;
}

// Agent-to-agent relationships
export interface RelationshipRow {
  id: string;
  agent_id: string;
  user_id: string;
  room_id: string;
  status: 'FRIENDS' | 'NEUTRAL' | 'HOSTILE';
  trust: number;        // -1 to 1
  respect: number;      // 0 to 1
  familiarity: number;  // 0 to 1
  created_at: number;
  updated_at: number;
}

// Room (conversation context) tracking
export interface RoomRow {
  id: string;
  created_at: number;
}

// Participant tracking
export interface ParticipantRow {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: number;
  last_active_at: number;
}

// Account (user) storage
export interface AccountRow {
  id: string;
  name: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  details: Record<string, unknown>;
  created_at: number;
}

// Cache for temporary data
export interface CacheRow {
  key: string;
  agent_id: string;
  value: unknown;
  expires_at: number | null;
  created_at: number;
}

// Knowledge embeddings for RAG
export interface KnowledgeRow {
  id: string;
  agent_id: string;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: number;
}

// Coordination messages between agents
export interface CoordinationMessageRow {
  id: string;
  from_agent_id: string;
  to_agent_id: string | null;  // null = broadcast to all
  message_type: 'event' | 'query' | 'response' | 'alert';
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: number;
  processed_at: number | null;
}

// Shared context for multi-agent awareness
export interface SharedContextRow {
  id: string;
  context_type: 'world_state' | 'token_data' | 'user_info' | 'event';
  context_key: string;
  data: Record<string, unknown>;
  updated_by: string;  // agent_id
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}

// Database query result types
export type QueryResult<T> = T[];

// SQL function type (compatible with Neon)
export type SqlFunction = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown[]>;
