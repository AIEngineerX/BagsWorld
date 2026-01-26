// AgentCoordinator tests
// Tests agent-to-agent communication and coordination

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentCoordinator, getAgentCoordinator, type AgentMessage } from './AgentCoordinator.js';

describe('AgentCoordinator', () => {
  let coordinator: AgentCoordinator;

  beforeEach(async () => {
    // Create fresh coordinator for each test
    coordinator = new AgentCoordinator();
    // Register some test agents
    coordinator.registerAgent('neo', ['scan', 'detect']);
    coordinator.registerAgent('finn', ['advise', 'lead']);
    coordinator.registerAgent('ghost', ['rewards', 'trade']);
  });

  describe('constructor', () => {
    it('creates instance without runtime', () => {
      const c = new AgentCoordinator();
      expect(c).toBeInstanceOf(AgentCoordinator);
    });

    it('has correct service type', () => {
      expect(AgentCoordinator.serviceType).toBe('bags_coordinator');
    });

    it('has capability description', () => {
      expect(coordinator.capabilityDescription).toBe('Agent-to-agent coordination and messaging');
    });
  });

  describe('registerAgent', () => {
    it('registers agent with capabilities', () => {
      coordinator.registerAgent('toly', ['explain', 'technical']);
      const statuses = coordinator.getAllStatuses();
      const toly = statuses.find(s => s.agentId === 'toly');
      expect(toly).toBeDefined();
      expect(toly?.capabilities).toEqual(['explain', 'technical']);
      expect(toly?.status).toBe('online');
    });

    it('updates existing agent capabilities', () => {
      coordinator.registerAgent('neo', ['new-cap']);
      const statuses = coordinator.getAllStatuses();
      const neo = statuses.find(s => s.agentId === 'neo');
      expect(neo?.capabilities).toEqual(['new-cap']);
    });
  });

  describe('updateStatus', () => {
    it('updates agent status', () => {
      coordinator.updateStatus('neo', { status: 'busy', currentTask: 'scanning' });
      const statuses = coordinator.getAllStatuses();
      const neo = statuses.find(s => s.agentId === 'neo');
      expect(neo?.status).toBe('busy');
      expect(neo?.currentTask).toBe('scanning');
    });

    it('ignores unknown agent', () => {
      const statusesBefore = coordinator.getAllStatuses().length;
      coordinator.updateStatus('unknown', { status: 'offline' });
      const statusesAfter = coordinator.getAllStatuses().length;
      expect(statusesAfter).toBe(statusesBefore);
    });
  });

  describe('send', () => {
    it('sends message and returns id', async () => {
      const messageId = await coordinator.send({
        from: 'neo',
        to: 'finn',
        type: 'alert',
        content: 'New launch detected',
        priority: 'high',
      });
      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
    });

    it('adds message to queue', async () => {
      await coordinator.send({
        from: 'neo',
        to: 'finn',
        type: 'alert',
        content: 'Test message',
        priority: 'normal',
      });

      const messages = coordinator.getMessages('finn');
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Test message');
    });
  });

  describe('broadcast', () => {
    it('broadcasts to all agents', async () => {
      const messageId = await coordinator.broadcast('neo', 'alert', 'Attention everyone');
      expect(messageId).toBeDefined();

      // All agents should receive broadcast
      const neoMessages = coordinator.getMessages('neo');
      const finnMessages = coordinator.getMessages('finn');
      const ghostMessages = coordinator.getMessages('ghost');

      expect(neoMessages.length).toBe(1);
      expect(finnMessages.length).toBe(1);
      expect(ghostMessages.length).toBe(1);
    });
  });

  describe('alert', () => {
    it('creates urgent alert with expiration', async () => {
      const messageId = await coordinator.alert('neo', 'URGENT: Rug detected!', { mint: 'abc123' });
      expect(messageId).toBeDefined();

      const messages = coordinator.getMessages('finn');
      expect(messages[0].priority).toBe('urgent');
      expect(messages[0].expiresAt).toBeDefined();
      expect(messages[0].expiresAt! > Date.now()).toBe(true);
    });
  });

  describe('handoff', () => {
    it('creates high priority handoff message', async () => {
      const messageId = await coordinator.handoff('bags-bot', 'toly', 'User has Solana question', { topic: 'staking' });
      expect(messageId).toBeDefined();
    });
  });

  describe('query', () => {
    it('creates query message', async () => {
      const messageId = await coordinator.query('finn', 'ghost', 'What are current fees?');
      expect(messageId).toBeDefined();

      const messages = coordinator.getMessages('ghost');
      expect(messages[0].type).toBe('query');
    });
  });

  describe('subscribe', () => {
    it('calls handler on new messages', async () => {
      const handler = vi.fn();
      coordinator.subscribe('finn', handler);

      await coordinator.send({
        from: 'neo',
        to: 'finn',
        type: 'alert',
        content: 'Test',
        priority: 'normal',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function', async () => {
      const handler = vi.fn();
      const unsubscribe = coordinator.subscribe('finn', handler);

      unsubscribe();

      await coordinator.send({
        from: 'neo',
        to: 'finn',
        type: 'alert',
        content: 'Test',
        priority: 'normal',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    beforeEach(async () => {
      await coordinator.send({ from: 'neo', to: 'finn', type: 'alert', content: 'Alert 1', priority: 'high' });
      await coordinator.send({ from: 'ghost', to: 'finn', type: 'query', content: 'Query 1', priority: 'normal' });
      await coordinator.send({ from: 'neo', to: '*', type: 'update', content: 'Broadcast', priority: 'low' });
    });

    it('filters by recipient', () => {
      const finnMessages = coordinator.getMessages('finn');
      expect(finnMessages.length).toBe(3); // 2 direct + 1 broadcast
    });

    it('filters by type', () => {
      const alerts = coordinator.getMessages('finn', { types: ['alert'] });
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('alert');
    });

    it('respects limit', () => {
      const limited = coordinator.getMessages('finn', { limit: 1 });
      expect(limited.length).toBe(1);
    });

    it('sorts by priority then time', () => {
      const messages = coordinator.getMessages('finn');
      // High priority should come first
      expect(messages[0].priority).toBe('high');
    });
  });

  describe('sharedContext', () => {
    it('sets and gets shared context', () => {
      coordinator.setSharedContext('worldHealth', 75);
      const value = coordinator.getSharedContext<number>('worldHealth');
      expect(value).toBe(75);
    });

    it('returns undefined for unknown key', () => {
      const value = coordinator.getSharedContext('unknown');
      expect(value).toBeUndefined();
    });

    it('returns all shared context', () => {
      coordinator.setSharedContext('worldHealth', 75);
      coordinator.setSharedContext('weather', 'sunny');

      const all = coordinator.getAllSharedContext();
      expect(all).toEqual({ worldHealth: 75, weather: 'sunny' });
    });
  });

  describe('findAgentForTask', () => {
    it('finds agent with capability', () => {
      const agent = coordinator.findAgentForTask('scan');
      expect(agent).toBe('neo');
    });

    it('returns undefined for unknown capability', () => {
      const agent = coordinator.findAgentForTask('fly');
      expect(agent).toBeUndefined();
    });

    it('skips offline agents', () => {
      coordinator.updateStatus('neo', { status: 'offline' });
      const agent = coordinator.findAgentForTask('scan');
      expect(agent).toBeUndefined();
    });
  });

  describe('getAllStatuses', () => {
    it('returns all agent statuses', () => {
      const statuses = coordinator.getAllStatuses();
      expect(statuses.length).toBe(3); // neo, finn, ghost
    });
  });

  describe('buildCoordinationContext', () => {
    it('returns empty string when no context', () => {
      const context = coordinator.buildCoordinationContext('neo');
      expect(context).toBe('');
    });

    it('includes pending messages', async () => {
      await coordinator.send({
        from: 'finn',
        to: 'neo',
        type: 'alert',
        content: 'Check this out',
        priority: 'normal',
      });

      const context = coordinator.buildCoordinationContext('neo');
      expect(context).toContain('AGENT COORDINATION');
      expect(context).toContain('Check this out');
    });

    it('includes shared context', () => {
      coordinator.setSharedContext('worldHealth', 80);

      const context = coordinator.buildCoordinationContext('neo');
      expect(context).toContain('World health: 80');
    });
  });

  describe('stop', () => {
    it('cleans up handlers', async () => {
      const handler = vi.fn();
      coordinator.subscribe('finn', handler);

      await coordinator.stop();

      // After stop, handler shouldn't be called
      await coordinator.send({
        from: 'neo',
        to: 'finn',
        type: 'alert',
        content: 'Test',
        priority: 'normal',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
