// Agent Bus - Inter-agent communication system
// Enables agents to send messages, broadcast events, and coordinate actions

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseAdapter } from '../db';
import { createLogger } from '../utils/logger';
import type {
  AgentState,
  CoordinationMessage,
  CoordinationMessageType,
  CoordinationPayload,
  MessageHandler,
  EventPayload,
  AlertPayload,
  MentionPayload,
  HandoffPayload,
  DialoguePayload,
  ContextPayload,
  HeartbeatPayload,
} from './types';

const log = createLogger('AgentBus');

export class AgentBus {
  private agents: Map<string, AgentState> = new Map();
  private handlers: Map<string, Map<CoordinationMessageType, MessageHandler[]>> = new Map();
  private messageQueue: CoordinationMessage[] = [];
  private processing: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private db = getDatabaseAdapter();

  constructor() {
    // Start message processing on construction
  }

  // ==================== Agent Registration ====================

  registerAgent(state: AgentState): void {
    this.agents.set(state.id, {
      ...state,
      status: 'ready',
      lastActive: Date.now(),
    });
    log.info(`Agent registered: ${state.character.name} (${state.id})`);

    // Initialize handler map for this agent
    if (!this.handlers.has(state.id)) {
      this.handlers.set(state.id, new Map());
    }

    // Send heartbeat to announce presence
    this.broadcast(state.id, 'heartbeat', {
      status: 'ready',
      capabilities: state.capabilities,
    } as HeartbeatPayload, 'low');
  }

  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'offline';
      this.agents.delete(agentId);
      this.handlers.delete(agentId);
      log.info(`Agent unregistered: ${agent.character.name} (${agentId})`);
    }
  }

  getAgent(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }

  getAgentByName(name: string): AgentState | undefined {
    for (const agent of this.agents.values()) {
      if (agent.character.name.toLowerCase() === name.toLowerCase()) {
        return agent;
      }
    }
    return undefined;
  }

  getAllAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  getActiveAgents(): AgentState[] {
    return this.getAllAgents().filter(a => a.status === 'ready');
  }

  // ==================== Message Handlers ====================

  onMessage(agentId: string, type: CoordinationMessageType, handler: MessageHandler): void {
    const agentHandlers = this.handlers.get(agentId);
    if (!agentHandlers) {
      this.handlers.set(agentId, new Map());
    }

    const typeHandlers = this.handlers.get(agentId)!.get(type) || [];
    typeHandlers.push(handler);
    this.handlers.get(agentId)!.set(type, typeHandlers);
  }

  offMessage(agentId: string, type: CoordinationMessageType, handler: MessageHandler): void {
    const agentHandlers = this.handlers.get(agentId);
    if (!agentHandlers) return;

    const typeHandlers = agentHandlers.get(type);
    if (!typeHandlers) return;

    const index = typeHandlers.indexOf(handler);
    if (index !== -1) {
      typeHandlers.splice(index, 1);
    }
  }

  // ==================== Message Sending ====================

  send(
    from: string,
    to: string,
    type: CoordinationMessageType,
    payload: CoordinationPayload,
    priority: CoordinationMessage['priority'] = 'normal',
    replyTo?: string
  ): string {
    const message: CoordinationMessage = {
      id: uuidv4(),
      type,
      from,
      to,
      payload,
      timestamp: Date.now(),
      priority,
      replyTo,
    };

    this.queueMessage(message);
    log.debug(`Message sent: ${type} from ${from} to ${to}`);
    return message.id;
  }

  broadcast(
    from: string,
    type: CoordinationMessageType,
    payload: CoordinationPayload,
    priority: CoordinationMessage['priority'] = 'normal'
  ): string {
    const message: CoordinationMessage = {
      id: uuidv4(),
      type,
      from,
      to: null, // null = broadcast
      payload,
      timestamp: Date.now(),
      priority,
    };

    this.queueMessage(message);
    log.debug(`Broadcast sent: ${type} from ${from}`);
    return message.id;
  }

  // ==================== Convenience Methods ====================

  // Broadcast an event to all agents
  broadcastEvent(from: string, eventType: string, data: Record<string, unknown>): string {
    return this.broadcast(from, 'event', {
      eventType,
      data,
      source: from,
    } as EventPayload);
  }

  // Send an alert to specific agent or all
  sendAlert(
    from: string,
    to: string | null,
    alertType: AlertPayload['alertType'],
    message: string,
    data?: Record<string, unknown>
  ): string {
    const payload: AlertPayload = {
      alertType,
      message,
      data,
      actionRequired: alertType !== 'system',
    };

    if (to) {
      return this.send(from, to, 'alert', payload, 'high');
    } else {
      return this.broadcast(from, 'alert', payload, 'high');
    }
  }

  // Notify an agent that they were mentioned
  notifyMention(
    from: string,
    mentionedAgentId: string,
    userMessage: string,
    userId: string,
    roomId: string,
    context: MentionPayload['context']
  ): string {
    return this.send(from, mentionedAgentId, 'mention', {
      mentionedAgent: mentionedAgentId,
      userMessage,
      userId,
      roomId,
      context,
    } as MentionPayload, 'high');
  }

  // Hand off conversation to another agent
  handoff(
    from: string,
    to: string,
    reason: string,
    userId: string,
    roomId: string,
    context: HandoffPayload['conversationContext']
  ): string {
    return this.send(from, to, 'handoff', {
      toAgent: to,
      reason,
      userId,
      roomId,
      conversationContext: context,
    } as HandoffPayload, 'high');
  }

  // Start a multi-agent dialogue
  startDialogue(
    initiator: string,
    topic: string,
    participants: string[],
    maxTurns: number = 6
  ): string {
    return this.broadcast(initiator, 'dialogue', {
      topic,
      participants,
      initiator,
      currentSpeaker: participants[0],
      turn: 0,
      history: [],
      maxTurns,
    } as DialoguePayload);
  }

  // Update shared context
  updateContext(
    from: string,
    contextType: ContextPayload['contextType'],
    key: string,
    data: Record<string, unknown>,
    ttlMs?: number
  ): string {
    return this.broadcast(from, 'context', {
      contextType,
      key,
      data,
      ttlMs,
    } as ContextPayload);
  }

  // ==================== Message Processing ====================

  private queueMessage(message: CoordinationMessage): void {
    // Insert based on priority
    if (message.priority === 'urgent') {
      this.messageQueue.unshift(message);
    } else if (message.priority === 'high') {
      // Find first non-urgent message and insert before it
      const insertIndex = this.messageQueue.findIndex(m => m.priority !== 'urgent');
      if (insertIndex === -1) {
        this.messageQueue.push(message);
      } else {
        this.messageQueue.splice(insertIndex, 0, message);
      }
    } else {
      this.messageQueue.push(message);
    }

    // Persist to database for cross-process coordination
    this.persistMessage(message).catch(err => {
      log.error('Failed to persist message:', err);
    });

    // Process queue
    this.processQueue();
  }

  private async persistMessage(message: CoordinationMessage): Promise<void> {
    await this.db.initialize();
    await this.db.sendCoordinationMessage(
      message.from,
      message.to,
      message.type as 'event' | 'query' | 'response' | 'alert',
      message.payload as Record<string, unknown>
    );
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      await this.deliverMessage(message);
    }

    this.processing = false;
  }

  private async deliverMessage(message: CoordinationMessage): Promise<void> {
    // Determine recipients
    const recipients: string[] = [];

    if (message.to === null) {
      // Broadcast to all agents except sender
      for (const agentId of this.agents.keys()) {
        if (agentId !== message.from) {
          recipients.push(agentId);
        }
      }
    } else {
      recipients.push(message.to);
    }

    // Deliver to each recipient
    for (const recipientId of recipients) {
      const agentHandlers = this.handlers.get(recipientId);
      if (!agentHandlers) continue;

      const typeHandlers = agentHandlers.get(message.type);
      if (!typeHandlers || typeHandlers.length === 0) continue;

      // Call all handlers for this message type
      for (const handler of typeHandlers) {
        try {
          await handler(message);
        } catch (error) {
          log.error(`Handler error for ${recipientId}:${message.type}:`, error);
        }
      }
    }
  }

  // ==================== Database Polling ====================

  startPolling(intervalMs: number = 5000): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(() => {
      this.pollDatabaseMessages();
    }, intervalMs);

    log.info(`Started polling for database messages every ${intervalMs}ms`);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      log.info('Stopped polling for database messages');
    }
  }

  private async pollDatabaseMessages(): Promise<void> {
    for (const agentId of this.agents.keys()) {
      const messages = await this.db.getUnprocessedCoordinationMessages(agentId);

      for (const dbMessage of messages) {
        const message: CoordinationMessage = {
          id: dbMessage.id,
          type: dbMessage.message_type as CoordinationMessageType,
          from: dbMessage.from_agent_id,
          to: dbMessage.to_agent_id,
          payload: dbMessage.payload as CoordinationPayload,
          timestamp: dbMessage.created_at,
          priority: 'normal',
        };

        await this.deliverMessage(message);
        await this.db.markCoordinationMessageProcessed(dbMessage.id);
      }
    }
  }

  // ==================== Agent Mention Detection ====================

  detectMention(message: string): { agentId: string; agentName: string } | null {
    const lowerMessage = message.toLowerCase();

    // Check for direct mentions
    const mentionPatterns = [
      /\b(neo)\b/i,
      /\b(cj)\b/i,
      /\b(finn)\b/i,
      /\b(ash)\b/i,
      /\b(toly)\b/i,
      /\b(shaw)\b/i,
      /\b(ghost)\b/i,
      /\b(bags[\s-]?bot)\b/i,
      /@(\w+)/,  // @mentions
    ];

    for (const pattern of mentionPatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        const name = match[1].toLowerCase().replace(/[\s-]/g, '-');
        const agent = this.getAgentByName(name);
        if (agent) {
          return { agentId: agent.id, agentName: agent.character.name };
        }
      }
    }

    // Check for topic-based routing (e.g., "rewards" → Ghost, "solana" → Toly)
    const topicRoutes: Record<string, string> = {
      'reward': 'ghost',
      'distribution': 'ghost',
      'creator reward': 'ghost',
      'solana': 'toly',
      'proof of history': 'toly',
      'bags.fm': 'finn',
      'launch': 'finn',
      'elizaos': 'shaw',
      'character file': 'shaw',
      'multi-agent': 'shaw',
      'pokemon': 'ash',
      'evolve': 'ash',
      'scan': 'neo',
      'alpha': 'neo',
      'chain': 'neo',
    };

    for (const [topic, agentName] of Object.entries(topicRoutes)) {
      if (lowerMessage.includes(topic)) {
        const agent = this.getAgentByName(agentName);
        if (agent) {
          return { agentId: agent.id, agentName: agent.character.name };
        }
      }
    }

    return null;
  }

  // ==================== Cleanup ====================

  async cleanup(): Promise<void> {
    this.stopPolling();

    // Clean old messages
    await this.db.cleanOldCoordinationMessages(24 * 60 * 60 * 1000); // 24 hours

    // Unregister all agents
    for (const agentId of this.agents.keys()) {
      this.unregisterAgent(agentId);
    }

    log.info('Agent bus cleaned up');
  }
}

// Singleton instance
let busInstance: AgentBus | null = null;

export function getAgentBus(): AgentBus {
  if (!busInstance) {
    busInstance = new AgentBus();
  }
  return busInstance;
}

export default AgentBus;
