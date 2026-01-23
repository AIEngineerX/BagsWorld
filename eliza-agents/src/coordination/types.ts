// Types for multi-agent coordination system

import type { Character, Memory } from '@elizaos/core';

// Agent registration and state
export interface AgentState {
  id: string;
  character: Character;
  status: 'initializing' | 'ready' | 'busy' | 'offline';
  lastActive: number;
  currentRoom: string | null;
  capabilities: string[];
}

// Inter-agent message types
export type CoordinationMessageType =
  | 'event'      // Something happened (token launch, fee claim, etc.)
  | 'query'      // Agent asking for info
  | 'response'   // Response to a query
  | 'alert'      // Urgent notification
  | 'mention'    // User mentioned another agent
  | 'handoff'    // Transfer conversation to another agent
  | 'dialogue'   // Multi-agent conversation request
  | 'context'    // Shared context update
  | 'heartbeat'; // Health check

export interface CoordinationMessage {
  id: string;
  type: CoordinationMessageType;
  from: string;           // Agent ID
  to: string | null;      // Agent ID or null for broadcast
  payload: CoordinationPayload;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  replyTo?: string;       // ID of message being replied to
  expiresAt?: number;
}

// Payload types for different message types
export type CoordinationPayload =
  | EventPayload
  | QueryPayload
  | ResponsePayload
  | AlertPayload
  | MentionPayload
  | HandoffPayload
  | DialoguePayload
  | ContextPayload
  | HeartbeatPayload;

export interface EventPayload {
  eventType: string;
  data: Record<string, unknown>;
  source?: string;
}

export interface QueryPayload {
  question: string;
  context?: Record<string, unknown>;
  expectedResponseType?: string;
}

export interface ResponsePayload {
  answer: string;
  data?: Record<string, unknown>;
  confidence?: number;
}

export interface AlertPayload {
  alertType: 'token_launch' | 'price_pump' | 'fee_claim' | 'distribution' | 'system' | 'custom';
  message: string;
  data?: Record<string, unknown>;
  actionRequired?: boolean;
}

export interface MentionPayload {
  mentionedAgent: string;
  userMessage: string;
  userId: string;
  roomId: string;
  context: Memory[];
}

export interface HandoffPayload {
  toAgent: string;
  reason: string;
  userId: string;
  roomId: string;
  conversationContext: Memory[];
}

export interface DialoguePayload {
  topic: string;
  participants: string[];
  initiator: string;
  currentSpeaker: string;
  turn: number;
  history: DialogueTurn[];
  maxTurns?: number;
}

export interface DialogueTurn {
  speaker: string;
  message: string;
  timestamp: number;
  emotion?: string;
}

export interface ContextPayload {
  contextType: 'world_state' | 'token_data' | 'user_info' | 'event_stream';
  key: string;
  data: Record<string, unknown>;
  ttlMs?: number;
}

export interface HeartbeatPayload {
  status: AgentState['status'];
  capabilities: string[];
  memoryCount?: number;
  lastProcessed?: number;
}

// Shared world state accessible by all agents
export interface SharedWorldState {
  health: number;
  weather: string;
  buildingCount: number;
  populationCount: number;
  totalVolume24h: number;
  totalFees24h: number;
  topTokens: TokenSummary[];
  recentEvents: RecentEvent[];
  lastUpdated: number;
}

export interface TokenSummary {
  mint: string;
  symbol: string;
  name: string;
  marketCap: number;
  priceChange24h: number;
  volume24h: number;
}

export interface RecentEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  processedBy: string[];
}

// Callback types
export type MessageHandler = (message: CoordinationMessage) => Promise<void>;
export type EventHandler = (event: RecentEvent) => Promise<void>;

// Dialogue generation request
export interface DialogueRequest {
  topic: string;
  participants: string[];
  initiator: string;
  context?: string;
  maxTurns?: number;
  style?: 'casual' | 'formal' | 'debate' | 'collaborative';
}

// Dialogue generation result
export interface DialogueResult {
  turns: DialogueTurn[];
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

// Agent mention detection
export interface MentionDetection {
  mentioned: boolean;
  agentId: string | null;
  agentName: string | null;
  confidence: number;
}
