// Coordination routes - agent coordination, messaging, shared context
// GET /api/coordination/context/:agentId, GET /api/coordination/statuses
// GET /api/coordination/messages/:agentId, POST /api/coordination/broadcast
// GET /api/coordination/shared-context

import { Router, Request, Response } from 'express';
import { getAgentCoordinator } from '../services/AgentCoordinator.js';

const router = Router();

// GET /api/coordination/context/:agentId - Get agent coordination context
router.get('/context/:agentId', (req: Request, res: Response) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const agentId = req.params.agentId as string;
  const context = coordinator.buildCoordinationContext(agentId);

  res.json({
    success: true,
    agentId,
    context,
    hasContext: context.length > 0,
  });
});

// GET /api/coordination/statuses - Get all agent statuses
router.get('/statuses', (req: Request, res: Response) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const statuses = coordinator.getAllStatuses();

  res.json({
    success: true,
    agents: statuses,
    count: statuses.length,
    online: statuses.filter(s => s.status === 'online').length,
  });
});

// GET /api/coordination/messages/:agentId - Get agent messages
router.get('/messages/:agentId', (req: Request, res: Response) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const agentId = req.params.agentId as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const messages = coordinator.getMessages(agentId, { limit });

  res.json({
    success: true,
    agentId,
    messages,
    count: messages.length,
  });
});

// POST /api/coordination/broadcast - Broadcast message to all agents
router.post('/broadcast', async (req: Request, res: Response) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const { from, type, content, data } = req.body;

  if (!from || !content) {
    res.status(400).json({
      success: false,
      error: 'from and content are required',
    });
    return;
  }

  const messageId = await coordinator.broadcast(from, type || 'update', content, data);

  res.json({
    success: true,
    messageId,
    message: `Broadcast sent from ${from}`,
  });
});

// GET /api/coordination/shared-context - Get all shared context
router.get('/shared-context', (req: Request, res: Response) => {
  const coordinator = getAgentCoordinator();

  if (!coordinator) {
    res.status(503).json({
      success: false,
      error: 'Agent coordinator not initialized',
    });
    return;
  }

  const context = coordinator.getAllSharedContext();

  res.json({
    success: true,
    context,
    keys: Object.keys(context),
  });
});

export default router;
