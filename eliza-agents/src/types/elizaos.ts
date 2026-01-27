// Local type definitions (compatible with @elizaos/core)
// These allow standalone operation without the full ElizaOS runtime

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

export interface Memory {
  id?: string;
  userId?: string;
  agentId?: string;
  roomId?: string;
  content: {
    text: string;
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

export interface IAgentRuntime {
  agentId?: string;
  character?: Character;
  getSetting(key: string): string | undefined;
  getService<T>(serviceType: string): T | undefined;
  registerService(service: Service): void;
  [key: string]: unknown;
}

export interface ActionExample {
  name: string;
  content: { text: string };
}

export interface ActionResult {
  text: string;
  [key: string]: unknown;
}

export type HandlerCallback = (
  response: { text: string; [key: string]: unknown },
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

export interface ProviderResult {
  text: string;
  [key: string]: unknown;
}

export interface Provider {
  name: string;
  description?: string;
  get: (runtime: IAgentRuntime, message: Memory, state: State) => Promise<ProviderResult>;
}

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

export interface EvaluatorResult {
  score: number; // 0-1 relevance score
  reason?: string; // Optional explanation for debugging
  data?: Record<string, unknown>; // Optional extracted data
}

export interface Evaluator {
  name: string;
  description: string;
  /**
   * Evaluate message relevance for a particular capability.
   * Returns a score from 0-1 where higher = more relevant.
   * Used to prioritize which action to execute when multiple validate.
   */
  evaluate: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ) => Promise<EvaluatorResult>;
  /**
   * Optional: actions this evaluator is associated with.
   * Helps the runtime route messages to the right actions.
   */
  relatedActions?: string[];
}

export interface Plugin {
  name: string;
  description?: string;
  init?: (config: Record<string, string>, runtime: IAgentRuntime) => Promise<void>;
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
  services?: (typeof Service)[];
}
