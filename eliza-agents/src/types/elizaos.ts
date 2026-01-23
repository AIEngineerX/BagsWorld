/**
 * Local type definitions compatible with ElizaOS
 * Replaces @elizaos/core dependency with standalone types
 */

export type UUID = string;

export interface Character {
  id?: UUID;
  name: string;
  username?: string;
  system?: string;
  modelEndpointOverride?: string;
  templates?: {
    messageHandlerTemplate?: string;
    shouldRespondTemplate?: string;
    continueMessageHandlerTemplate?: string;
    evaluationTemplate?: string;
    memoryTemplate?: string;
    goalTemplate?: string;
    factTemplate?: string;
    [key: string]: string | undefined;
  };
  bio: string | string[];
  lore?: string[];
  messageExamples?: MessageExample[][];
  postExamples?: string[];
  topics?: string[];
  adjectives?: string[];
  knowledge?: string[];
  clients?: string[];
  plugins?: string[];
  settings?: {
    secrets?: Record<string, string>;
    voice?: {
      model?: string;
      url?: string;
    };
    model?: string;
    embeddingModel?: string;
    [key: string]: unknown;
  };
  clientConfig?: {
    discord?: {
      shouldIgnoreBotMessages?: boolean;
      shouldIgnoreDirectMessages?: boolean;
    };
    telegram?: {
      shouldIgnoreBotMessages?: boolean;
      shouldIgnoreDirectMessages?: boolean;
    };
    [key: string]: unknown;
  };
  style?: {
    all?: string[];
    chat?: string[];
    post?: string[];
  };
}

export interface MessageExample {
  user: string;
  content: {
    text: string;
    action?: string;
    source?: string;
    url?: string;
    inReplyTo?: UUID;
    attachments?: Attachment[];
  };
}

export interface Attachment {
  id: string;
  url: string;
  title?: string;
  source?: string;
  description?: string;
  text?: string;
  contentType?: string;
}

export interface Memory {
  id?: UUID;
  userId: UUID;
  agentId: UUID;
  roomId: UUID;
  content: {
    text: string;
    action?: string;
    source?: string;
    url?: string;
    inReplyTo?: UUID;
    attachments?: Attachment[];
    [key: string]: unknown;
  };
  embedding?: number[];
  createdAt?: number;
  unique?: boolean;
}

export interface State {
  userId?: UUID;
  agentId?: UUID;
  roomId?: UUID;
  bio?: string;
  lore?: string;
  messageDirections?: string;
  postDirections?: string;
  actors?: string;
  recentMessages?: string;
  recentMessagesData?: Memory[];
  goals?: string;
  goalsData?: Goal[];
  actions?: string;
  actionNames?: string;
  providers?: string;
  responseData?: unknown;
  [key: string]: unknown;
}

export interface Goal {
  id?: UUID;
  roomId: UUID;
  userId: UUID;
  name: string;
  status: 'DONE' | 'FAILED' | 'IN_PROGRESS' | 'PENDING';
  objectives: Objective[];
}

export interface Objective {
  id?: UUID;
  description: string;
  completed: boolean;
}

export interface IAgentRuntime {
  agentId: UUID;
  character: Character;
  getSetting(key: string): string | undefined;
  getConversationLength(): number;
  processActions(
    message: Memory,
    responses: Memory[],
    state?: State,
    callback?: HandlerCallback
  ): Promise<void>;
  evaluate(
    message: Memory,
    state?: State,
    didRespond?: boolean
  ): Promise<string[]>;
  composeState(
    message: Memory,
    additionalKeys?: Record<string, unknown>
  ): Promise<State>;
}

export type HandlerCallback = (
  response: { text: string; action?: string },
  files?: unknown[]
) => Promise<Memory[]>;

export interface Action {
  name: string;
  similes?: string[];
  description: string;
  examples?: MessageExample[][];
  validate: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => Promise<unknown>;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface Provider {
  name: string;
  description?: string;
  get: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<string>;
}

export interface Service {
  name: string;
  description?: string;
  initialize?: (runtime: IAgentRuntime) => Promise<void>;
  cleanup?: () => Promise<void>;
}

export interface Plugin {
  name: string;
  description?: string;
  actions?: Action[];
  providers?: Provider[];
  services?: Service[];
  evaluators?: Evaluator[];
}

export interface Evaluator {
  name: string;
  similes?: string[];
  description: string;
  examples?: MessageExample[][];
  validate: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
  handler: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<unknown>;
}

// Utility functions
export function stringToUuid(str: string): UUID {
  // Simple hash-based UUID generation for compatibility
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex.slice(0, 12).padEnd(12, '0')}`;
}

// Logger utility
export const logger = {
  info: (...args: unknown[]) => console.log('[INFO]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args),
};
