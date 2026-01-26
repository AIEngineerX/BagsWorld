// Autonomous routes - task status, alerts, triggers
// GET /api/autonomous/status, GET /api/autonomous/alerts
// POST /api/autonomous/alerts/:alertId/acknowledge, POST /api/autonomous/trigger/:taskName

import { Router, Request, Response } from 'express';
import { getAutonomousService } from '../services/AutonomousService.js';

const router = Router();

// GET /api/autonomous/status - Get task status
router.get('/status', (req: Request, res: Response) => {
  const autonomous = getAutonomousService();

  if (!autonomous) {
    res.status(503).json({
      success: false,
      error: 'Autonomous service not initialized',
      hint: 'Set ENABLE_AUTONOMOUS=true to enable',
    });
    return;
  }

  const tasks = autonomous.getTaskStatus();

  res.json({
    success: true,
    status: 'running',
    tasks,
    taskCount: tasks.length,
  });
});

// GET /api/autonomous/alerts - Get recent alerts
router.get('/alerts', (req: Request, res: Response) => {
  const autonomous = getAutonomousService();

  if (!autonomous) {
    res.status(503).json({
      success: false,
      error: 'Autonomous service not initialized',
    });
    return;
  }

  const type = req.query.type as string | undefined;
  const severity = req.query.severity as string | undefined;
  const unacknowledged = req.query.unacknowledged === 'true';
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const alerts = autonomous.getAlerts({
    type: type as any,
    severity: severity as any,
    unacknowledgedOnly: unacknowledged,
    limit,
  });

  res.json({
    success: true,
    alerts,
    count: alerts.length,
  });
});

// POST /api/autonomous/alerts/:alertId/acknowledge - Acknowledge alert
router.post('/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
  const autonomous = getAutonomousService();

  if (!autonomous) {
    res.status(503).json({
      success: false,
      error: 'Autonomous service not initialized',
    });
    return;
  }

  const alertId = req.params.alertId as string;
  autonomous.acknowledgeAlert(alertId);

  res.json({
    success: true,
    message: `Alert ${alertId} acknowledged`,
  });
});

// POST /api/autonomous/trigger/:taskName - Manually trigger task
router.post('/trigger/:taskName', async (req: Request, res: Response) => {
  const autonomous = getAutonomousService();

  if (!autonomous) {
    res.status(503).json({
      success: false,
      error: 'Autonomous service not initialized',
    });
    return;
  }

  const taskName = req.params.taskName as string;
  const success = await autonomous.triggerTask(taskName);

  if (success) {
    res.json({
      success: true,
      message: `Task ${taskName} triggered successfully`,
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Task not found: ${taskName}`,
      availableTasks: autonomous.getTaskStatus().map(t => t.name),
    });
  }
});

export default router;
