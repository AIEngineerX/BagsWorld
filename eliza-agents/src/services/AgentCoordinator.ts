// AgentCoordinator - Agent-to-agent communication and coordination
// Enables Neo to alert others, agents to delegate tasks, etc.

import { Service, type IAgentRuntime } from '../types/elizaos.js';
import { EventEmitter } from 'events';

export interface AgentMessage {
  id: string;
  from: string;       // Sending agent ID
  to: string | '*';   // Receiving agent ID or '*' for broadcast
  type: 'alert' | 'query' | 'response' | 'handoff' | 'update';
  content: string;
  data?: Record<string, unknown>;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expiresAt?: number;
}

export interface AgentStatus {
  agentId: string;
  status: 'online' | 'busy' | 'offline';
  lastSeen: number;
  currentTask?: string;
  capabilities: string[];
}

type MessageHandler = (message: AgentMessage) => void | Promise<void>;

// Singleton instance
let coordinatorInstance: AgentCoordinator | null = null;

export class AgentCoordinator extends Service {
  static readonly serviceType = 'bags_coordinator';
  readonly capabilityDescription = 'Agent-to-agent coordination and messaging';

  private emitter = new EventEmitter();
  private messageQueue: AgentMessage[] = [];
  private agentStatuses = new Map<string, AgentStatus>();
  private handlers = new Map<string, MessageHandler[]>();
  private sharedContext = new Map<string, unknown>();

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<AgentCoordinator> {
    console.log('[AgentCoordinator] Starting coordination service...');
    const service = new AgentCoordinator(runtime);

    // Register all 16 agents with their capabilities
    // Core agents
    service.registerAgent('neo', ['scan', 'detect', 'analyze', 'alert']);
    service.registerAgent('ghost', ['rewards', 'verify', 'distribute', 'trade']);
    service.registerAgent('finn', ['advise', 'inspire', 'lead', 'vision']);
    service.registerAgent('toly', ['explain', 'technical', 'solana', 'blockchain']);
    service.registerAgent('ash', ['guide', 'onboard', 'teach', 'explore']);
    service.registerAgent('cj', ['react', 'survive', 'wisdom', 'entertainment']);
    service.registerAgent('shaw', ['architect', 'build', 'coordinate', 'elizaos']);
    service.registerAgent('bags-bot', ['chat', 'help', 'translate', 'welcome']);

    // Academy agents
    service.registerAgent('alaa', ['innovate', 'build', 'prototype']);
    service.registerAgent('bnn', ['news', 'report', 'broadcast']);
    service.registerAgent('carlo', ['community', 'welcome', 'engage']);
    service.registerAgent('ramo', ['security', 'audit', 'technical']);
    service.registerAgent('sam', ['growth', 'marketing', 'content']);
    service.registerAgent('sincara', ['frontend', 'ux', 'design']);
    service.registerAgent('stuu', ['support', 'troubleshoot', 'operations']);
    service.registerAgent('professor-oak', ['launch', 'guide', 'dexscreener']);

    // Store as singleton
    coordinatorInstance = service;

    console.log('[AgentCoordinator] Coordination service ready with 16 agents');
    return service;
  }

  async stop(): Promise<void> {
    this.emitter.removeAllListeners();
    this.handlers.clear();
    coordinatorInstance = null;
  }

  /**
   * Register an agent's capabilities
   */
  registerAgent(agentId: string, capabilities: string[]): void {
    this.agentStatuses.set(agentId, {
      agentId,
      status: 'online',
      lastSeen: Date.now(),
      capabilities,
    });
  }

  /**
   * Update agent status
   */
  updateStatus(agentId: string, status: Partial<AgentStatus>): void {
    const current = this.agentStatuses.get(agentId);
    if (current) {
      this.agentStatuses.set(agentId, {
        ...current,
        ...status,
        lastSeen: Date.now(),
      });
    }
  }

  /**
   * Send a message to another agent
   */
  async send(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<string> {
    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    // Add to queue
    this.messageQueue.push(fullMessage);

    // Keep queue bounded
    if (this.messageQueue.length > 1000) {
      this.messageQueue = this.messageQueue.slice(-1000);
    }

    // Emit for real-time handlers
    this.emitter.emit('message', fullMessage);

    // Emit to specific agent handlers
    if (message.to !== '*') {
      this.emitter.emit(`message:${message.to}`, fullMessage);
    }

    // Notify handlers
    const targetHandlers = message.to === '*'
      ? Array.from(this.handlers.values()).flat()
      : this.handlers.get(message.to) || [];

    for (const handler of targetHandlers) {
      try {
        await handler(fullMessage);
      } catch (error) {
        console.error(`[AgentCoordinator] Handler error:`, error);
      }
    }

    console.log(`[AgentCoordinator] ${message.from} → ${message.to}: ${message.type} - "${message.content.slice(0, 50)}..."`);
    return fullMessage.id;
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast(from: string, type: AgentMessage['type'], content: string, data?: Record<string, unknown>): Promise<string> {
    return this.send({
      from,
      to: '*',
      type,
      content,
      data,
      priority: 'normal',
    });
  }

  /**
   * Alert agents about an urgent event
   */
  async alert(from: string, content: string, data?: Record<string, unknown>): Promise<string> {
    return this.send({
      from,
      to: '*',
      type: 'alert',
      content,
      data,
      priority: 'urgent',
      expiresAt: Date.now() + 300000, // 5 minutes
    });
  }

  /**
   * Request handoff to a more suitable agent
   */
  async handoff(from: string, to: string, content: string, context: Record<string, unknown>): Promise<string> {
    return this.send({
      from,
      to,
      type: 'handoff',
      content,
      data: context,
      priority: 'high',
    });
  }

  /**
   * Query another agent for information
   */
  async query(from: string, to: string, question: string): Promise<string> {
    return this.send({
      from,
      to,
      type: 'query',
      content: question,
      priority: 'normal',
    });
  }

  /**
   * Subscribe to messages for an agent
   */
  subscribe(agentId: string, handler: MessageHandler): () => void {
    const handlers = this.handlers.get(agentId) || [];
    handlers.push(handler);
    this.handlers.set(agentId, handlers);

    // Return unsubscribe function
    return () => {
      const current = this.handlers.get(agentId) || [];
      this.handlers.set(agentId, current.filter(h => h !== handler));
    };
  }

  /**
   * Get pending messages for an agent
   */
  getMessages(agentId: string, options?: {
    since?: number;
    types?: AgentMessage['type'][];
    limit?: number;
  }): AgentMessage[] {
    const { since = 0, types, limit = 50 } = options || {};
    const now = Date.now();

    return this.messageQueue
      .filter(m => {
        // Filter by recipient
        if (m.to !== '*' && m.to !== agentId) return false;
        // Filter by time
        if (m.timestamp < since) return false;
        // Filter by type
        if (types && !types.includes(m.type)) return false;
        // Filter expired
        if (m.expiresAt && m.expiresAt < now) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by priority then time
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return b.timestamp - a.timestamp;
      })
      .slice(0, limit);
  }

  /**
   * Set shared context that all agents can access
   */
  setSharedContext(key: string, value: unknown): void {
    this.sharedContext.set(key, value);
    console.log(`[AgentCoordinator] Shared context updated: ${key}`);
  }

  /**
   * Get shared context
   */
  getSharedContext<T = unknown>(key: string): T | undefined {
    return this.sharedContext.get(key) as T | undefined;
  }

  /**
   * Get all shared context
   */
  getAllSharedContext(): Record<string, unknown> {
    return Object.fromEntries(this.sharedContext);
  }

  /**
   * Find the best agent for a task based on capabilities
   */
  findAgentForTask(capability: string): string | undefined {
    for (const [agentId, status] of this.agentStatuses) {
      if (status.status === 'online' && status.capabilities.includes(capability)) {
        return agentId;
      }
    }
    return undefined;
  }

  /**
   * Get status of all agents
   */
  getAllStatuses(): AgentStatus[] {
    return Array.from(this.agentStatuses.values());
  }

  /**
   * Build coordination context for an agent's prompt
   */
  buildCoordinationContext(agentId: string): string {
    const messages = this.getMessages(agentId, { limit: 5 });
    const statuses = this.getAllStatuses();

    if (messages.length === 0 && this.sharedContext.size === 0) {
      return '';
    }

    const lines: string[] = ['AGENT COORDINATION:'];

    // Active agents
    const online = statuses.filter(s => s.status === 'online');
    if (online.length > 0) {
      lines.push(`Online agents: ${online.map(s => s.agentId).join(', ')}`);
    }

    // Pending messages
    if (messages.length > 0) {
      lines.push('');
      lines.push('Recent messages for you:');
      for (const msg of messages.slice(0, 3)) {
        lines.push(`- [${msg.type.toUpperCase()}] from ${msg.from}: "${msg.content}"`);
      }
    }

    // Shared context
    const worldHealth = this.sharedContext.get('worldHealth');
    const recentLaunches = this.sharedContext.get('recentLaunches');
    const alertActive = this.sharedContext.get('alertActive');

    if (worldHealth) {
      lines.push(`World health: ${worldHealth}`);
    }
    if (alertActive) {
      lines.push(`⚠️ ALERT ACTIVE: ${alertActive}`);
    }

    return lines.join('\n');
  }
}

/**
 * Get the global coordinator instance
 */
export function getAgentCoordinator(): AgentCoordinator | null {
  return coordinatorInstance;
}

export default AgentCoordinator;
