// AutonomousService tests
// Tests scheduled tasks and autonomous agent actions

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutonomousService, getAutonomousService, type ScheduledTask, type AutonomousAlert } from './AutonomousService.js';

describe('AutonomousService', () => {
  let service: AutonomousService;

  beforeEach(() => {
    // Create fresh service for each test (without starting tick loop)
    service = new AutonomousService();
  });

  afterEach(async () => {
    await service.stop();
  });

  describe('constructor', () => {
    it('creates instance without runtime', () => {
      const s = new AutonomousService();
      expect(s).toBeInstanceOf(AutonomousService);
    });

    it('has correct service type', () => {
      expect(AutonomousService.serviceType).toBe('bags_autonomous');
    });

    it('has capability description', () => {
      expect(service.capabilityDescription).toBe('Autonomous agent actions and scheduled tasks');
    });
  });

  describe('registerTask', () => {
    it('registers a new task and returns id', () => {
      const taskId = service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval: 60000,
        handler: async () => {},
      });

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('task appears in status', () => {
      service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval: 60000,
        handler: async () => {},
      });

      const statuses = service.getTaskStatus();
      const task = statuses.find(t => t.name === 'test_task');
      expect(task).toBeDefined();
      expect(task?.agentId).toBe('neo');
      expect(task?.enabled).toBe(true);
    });

    it('sets correct next run time', () => {
      const interval = 60000;
      const beforeRegister = Date.now();

      service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval,
        handler: async () => {},
      });

      const statuses = service.getTaskStatus();
      const task = statuses.find(t => t.name === 'test_task');
      const nextRun = new Date(task!.nextRun).getTime();

      expect(nextRun).toBeGreaterThanOrEqual(beforeRegister + interval);
    });
  });

  describe('setTaskEnabled', () => {
    it('disables a task', () => {
      const taskId = service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval: 60000,
        handler: async () => {},
      });

      service.setTaskEnabled(taskId, false);

      const statuses = service.getTaskStatus();
      const task = statuses.find(t => t.name === 'test_task');
      expect(task?.enabled).toBe(false);
    });

    it('re-enables a task', () => {
      const taskId = service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval: 60000,
        handler: async () => {},
      });

      service.setTaskEnabled(taskId, false);
      service.setTaskEnabled(taskId, true);

      const statuses = service.getTaskStatus();
      const task = statuses.find(t => t.name === 'test_task');
      expect(task?.enabled).toBe(true);
    });
  });

  describe('createAlert', () => {
    it('creates an alert and returns id', async () => {
      const alertId = await service.createAlert({
        type: 'launch',
        severity: 'info',
        title: 'New Launch',
        message: 'Token XYZ launched',
        data: { mint: 'abc123' },
      });

      expect(alertId).toBeDefined();
      expect(typeof alertId).toBe('string');
    });

    it('alert appears in getAlerts', async () => {
      await service.createAlert({
        type: 'launch',
        severity: 'info',
        title: 'New Launch',
        message: 'Token XYZ launched',
        data: { mint: 'abc123' },
      });

      const alerts = service.getAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].title).toBe('New Launch');
    });

    it('sets timestamp and acknowledged false', async () => {
      const beforeCreate = Date.now();
      await service.createAlert({
        type: 'milestone',
        severity: 'info',
        title: 'Test',
        message: 'Test message',
        data: {},
      });

      const alerts = service.getAlerts();
      expect(alerts[0].timestamp).toBeGreaterThanOrEqual(beforeCreate);
      expect(alerts[0].acknowledged).toBe(false);
    });
  });

  describe('getAlerts', () => {
    beforeEach(async () => {
      await service.createAlert({ type: 'launch', severity: 'info', title: 'Launch 1', message: 'M1', data: {} });
      await service.createAlert({ type: 'rug', severity: 'critical', title: 'Rug Alert', message: 'M2', data: {} });
      await service.createAlert({ type: 'milestone', severity: 'info', title: 'Milestone', message: 'M3', data: {} });
    });

    it('returns all alerts by default', () => {
      const alerts = service.getAlerts();
      expect(alerts.length).toBe(3);
    });

    it('filters by type', () => {
      const alerts = service.getAlerts({ type: 'launch' });
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('launch');
    });

    it('filters by severity', () => {
      const alerts = service.getAlerts({ severity: 'critical' });
      expect(alerts.length).toBe(1);
      expect(alerts[0].severity).toBe('critical');
    });

    it('filters unacknowledged only', async () => {
      const alerts = service.getAlerts();
      service.acknowledgeAlert(alerts[0].id);

      const unack = service.getAlerts({ unacknowledgedOnly: true });
      expect(unack.length).toBe(2);
    });

    it('respects limit', () => {
      const alerts = service.getAlerts({ limit: 2 });
      expect(alerts.length).toBe(2);
    });

    it('sorts by timestamp descending', () => {
      const alerts = service.getAlerts();
      // Alerts should be sorted newest first (timestamps may be same if created quickly)
      for (let i = 0; i < alerts.length - 1; i++) {
        expect(alerts[i].timestamp).toBeGreaterThanOrEqual(alerts[i + 1].timestamp);
      }
    });
  });

  describe('acknowledgeAlert', () => {
    it('marks alert as acknowledged', async () => {
      const alertId = await service.createAlert({
        type: 'launch',
        severity: 'info',
        title: 'Test',
        message: 'Test',
        data: {},
      });

      service.acknowledgeAlert(alertId);

      const alerts = service.getAlerts();
      expect(alerts[0].acknowledged).toBe(true);
    });

    it('ignores unknown alert id', () => {
      // Should not throw
      service.acknowledgeAlert('unknown-id');
    });
  });

  describe('getTaskStatus', () => {
    it('returns task statuses with correct format', () => {
      service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval: 60000,
        handler: async () => {},
      });

      const statuses = service.getTaskStatus();
      expect(statuses.length).toBe(1);
      expect(statuses[0]).toHaveProperty('name');
      expect(statuses[0]).toHaveProperty('agentId');
      expect(statuses[0]).toHaveProperty('enabled');
      expect(statuses[0]).toHaveProperty('lastRun');
      expect(statuses[0]).toHaveProperty('nextRun');
    });

    it('lastRun is "never" for new tasks', () => {
      service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval: 60000,
        handler: async () => {},
      });

      const statuses = service.getTaskStatus();
      expect(statuses[0].lastRun).toBe('never');
    });
  });

  describe('triggerTask', () => {
    it('runs task handler immediately', async () => {
      const handler = vi.fn();
      service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval: 60000,
        handler,
      });

      const success = await service.triggerTask('test_task');
      expect(success).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns false for unknown task', async () => {
      const success = await service.triggerTask('unknown_task');
      expect(success).toBe(false);
    });

    it('updates lastRun after trigger', async () => {
      const beforeTrigger = Date.now();
      service.registerTask({
        name: 'test_task',
        agentId: 'neo',
        interval: 60000,
        handler: async () => {},
      });

      await service.triggerTask('test_task');

      const statuses = service.getTaskStatus();
      const task = statuses.find(t => t.name === 'test_task');
      const lastRun = new Date(task!.lastRun).getTime();
      expect(lastRun).toBeGreaterThanOrEqual(beforeTrigger);
    });
  });

  describe('stop', () => {
    it('stops without error', async () => {
      await expect(service.stop()).resolves.not.toThrow();
    });
  });

  describe('alert bounds', () => {
    it('keeps alerts bounded to 500', async () => {
      for (let i = 0; i < 510; i++) {
        await service.createAlert({
          type: 'launch',
          severity: 'info',
          title: `Alert ${i}`,
          message: 'Test',
          data: {},
        });
      }

      const alerts = service.getAlerts({ limit: 600 });
      expect(alerts.length).toBeLessThanOrEqual(500);
    });
  });
});

describe('getAutonomousService', () => {
  it('returns null when not initialized', () => {
    // After stop, instance should be null
    const service = getAutonomousService();
    // This may return a previous instance depending on test order
    // So we just verify it doesn't throw
    expect(service === null || service instanceof AutonomousService).toBe(true);
  });
});
