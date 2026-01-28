/**
 * elizaOS Type Definitions for BagsWorld
 *
 * This file provides type definitions compatible with @elizaos/core
 * while maintaining backwards compatibility with the existing BagsWorld codebase.
 *
 * We define our own interfaces that match the @elizaos/core signatures but are
 * more flexible for our standalone operation mode. The AgentRuntime class
 * is re-exported from @elizaos/core for future use with the full runtime.
 */

// Re-export the official AgentRuntime class for future use
export { AgentRuntime } from '@elizaos/core';

// =============================================================================
// Character Definition
// =============================================================================

export interface Character {
  name: string;
  username?: string;
  system?: string;
  bio?: string | string[];
  lore?: string[];
  topics?: string[];
  adjectives?: string[];
  knowledge?: string[];
  messageExamples?: Array<Array<{ name: string; content: { text: string } }>>;
  postExamples?: string[];
  style?: {
    all?: string[];
    chat?: string[];
    post?: string[];
  };
  settings?: {
    model?: string;
    voice?: { model?: string };
    [key: string]: unknown;
  };
  plugins?: string[];
}

// =============================================================================
// Memory & State
// =============================================================================

export interface Memory {
  id?: string;
  userId?: string;
  agentId?: string;
  roomId?: string;
  content: {
    text: string;
    action?: string;
    [key: string]: unknown;
  };
  embedding?: number[];
  createdAt?: number;
  [key: string]: unknown;
}

export interface State {
  userId?: string;
  agentId?: string;
  roomId?: string;
  bio?: string;
  lore?: string;
  messageDirections?: string;
  postDirections?: string;
  actors?: string;
  recentMessages?: string;
  recentMessagesData?: Memory[];
  goals?: string;
  goalsData?: unknown[];
  actions?: string;
  actionNames?: string;
  providers?: string;
  [key: string]: unknown;
}

// =============================================================================
// Runtime Interface
// =============================================================================

export interface IAgentRuntime {
  agentId?: string;
  character?: Character;
  getSetting(key: string): string | boolean | number | null | undefined;
  getService<T>(serviceType: string): T | undefined;
  registerService(service: Service): void;
  [key: string]: unknown;
}

// =============================================================================
// Actions
// =============================================================================

export interface ActionExample {
  name: string;
  content: { text: string };
}

export interface ActionResult {
  success?: boolean;
  text: string;
  data?: unknown;
  error?: string;
  [key: string]: unknown;
}

export type HandlerCallback = (
  response: { text: string; action?: string; [key: string]: unknown },
  files?: unknown[]
) => Promise<Memory[] | void>;

export interface Action {
  name: string;
  description: string;
  similes?: string[];
  examples?: ActionExample[][];
  validate?: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => Promise<ActionResult | void>;
}

// =============================================================================
// Providers
// =============================================================================

export interface ProviderResult {
  text: string;
  values?: Record<string, unknown>;
  data?: unknown;
  [key: string]: unknown;
}

export interface Provider {
  name: string;
  description?: string;
  position?: number;
  get: (runtime: IAgentRuntime, message: Memory, state: State) => Promise<ProviderResult>;
}

// =============================================================================
// Services
// =============================================================================

export abstract class Service {
  static serviceType: string;
  readonly capabilityDescription?: string;
  protected runtime?: IAgentRuntime;

  constructor(runtime?: IAgentRuntime) {
    this.runtime = runtime;
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    throw new Error('Service.start must be implemented by subclass');
  }

  async stop(): Promise<void> {
    // Override in subclass if cleanup needed
  }
}

// =============================================================================
// Evaluators
// =============================================================================

export interface EvaluatorResult {
  triggered?: boolean;
  score: number;
  reason?: string;
  data?: Record<string, unknown>;
}

export interface Evaluator {
  name: string;
  description: string;
  alwaysRun?: boolean;
  evaluate: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ) => Promise<EvaluatorResult>;
  relatedActions?: string[];
}

// =============================================================================
// Plugins
// =============================================================================

export interface Plugin {
  name: string;
  description?: string;
  init?: (config: Record<string, string>, runtime: IAgentRuntime) => Promise<void>;
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
  services?: (typeof Service)[];
}

// =============================================================================
// BagsWorld-Specific Extensions
// =============================================================================

export type ZoneType = 'main_city' | 'trending' | 'labs' | 'founders' | 'ballers';

export interface AgentPosition {
  x: number;
  y: number;
  zone: ZoneType;
}

export interface AgentWorldState {
  id: string;
  position: AgentPosition;
  isMoving: boolean;
  nearbyAgents: string[];
  currentActivity?: {
    description: string;
    emoji: string;
    until: number;
  };
  lastConversation?: number;
  lastActivity?: number;
}

export interface GameCommand {
  type: 'character-behavior' | 'character-speak' | 'zone-transition';
  characterId: string;
  action?: string;
  target?: {
    type: 'position' | 'character' | 'building';
    x?: number;
    y?: number;
    id?: string;
  };
  message?: string;
  emotion?: string;
}

export interface WorldStateUpdate {
  type: 'world-state-update';
  timestamp: number;
  zone: ZoneType;
  characters: Record<string, {
    x: number;
    y: number;
    isMoving: boolean;
  }>;
  weather?: string;
  health?: number;
}

export interface AgentDecision {
  type: 'wander' | 'approach' | 'activity' | 'speak' | 'idle';
  zone?: ZoneType;
  targetAgentId?: string;
  message?: string;
  emotion?: string;
  description?: string;
  emoji?: string;
  duration?: number;
  isSignificant?: boolean;
}
