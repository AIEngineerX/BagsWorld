// Launch Wizard routes - Professor Oak guided token launches
// POST /api/launch-wizard/start, GET /api/launch-wizard/session/:sessionId
// POST /api/launch-wizard/session/:sessionId/input, POST /api/launch-wizard/session/:sessionId/ask
// POST /api/launch-wizard/session/:sessionId/complete

import { Router, Request, Response } from 'express';
import { LaunchWizard } from '../services/LaunchWizard.js';

const router = Router();

// POST /api/launch-wizard/start - Start guided launch
router.post('/start', (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({
      success: false,
      error: 'userId is required',
    });
    return;
  }

  const session = LaunchWizard.startSession(userId);
  const guidance = LaunchWizard.getStepGuidance(session.currentStep);

  res.json({
    success: true,
    session: {
      id: session.id,
      currentStep: session.currentStep,
      data: session.data,
    },
    guidance: {
      title: guidance.title,
      message: guidance.oakAdvice,
      prompt: guidance.prompt,
      tips: guidance.tips,
    },
  });
});

// GET /api/launch-wizard/session/:sessionId - Get session status
router.get('/session/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const session = LaunchWizard.getSession(sessionId);

  if (!session) {
    res.status(404).json({
      success: false,
      error: 'Session not found',
    });
    return;
  }

  const guidance = LaunchWizard.getStepGuidance(session.currentStep);

  res.json({
    success: true,
    session: {
      id: session.id,
      currentStep: session.currentStep,
      data: session.data,
      messages: session.messages,
    },
    guidance: {
      title: guidance.title,
      message: guidance.oakAdvice,
      prompt: guidance.prompt,
      tips: guidance.tips,
      examples: guidance.examples,
    },
  });
});

// POST /api/launch-wizard/session/:sessionId/input - Process step input
router.post('/session/:sessionId/input', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { input } = req.body;

  if (!input || typeof input !== 'string') {
    res.status(400).json({
      success: false,
      error: 'input is required and must be a string',
    });
    return;
  }

  const result = await LaunchWizard.processInput(sessionId, input);

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: result.error,
      response: result.response,
    });
    return;
  }

  const guidance = LaunchWizard.getStepGuidance(result.session.currentStep);

  res.json({
    success: true,
    response: result.response,
    session: {
      id: result.session.id,
      currentStep: result.session.currentStep,
      data: result.session.data,
    },
    guidance: {
      title: guidance.title,
      prompt: guidance.prompt,
      tips: guidance.tips,
      examples: guidance.examples,
    },
    launchReady: result.launchReady,
    launchData: result.launchData,
  });
});

// POST /api/launch-wizard/session/:sessionId/ask - Ask Professor Oak
router.post('/session/:sessionId/ask', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { question } = req.body;

  if (!question || typeof question !== 'string') {
    res.status(400).json({
      success: false,
      error: 'question is required',
    });
    return;
  }

  const session = LaunchWizard.getSession(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: 'Session not found',
    });
    return;
  }

  const advice = await LaunchWizard.getPersonalizedAdvice(session, question);

  res.json({
    success: true,
    response: advice,
    agent: 'professor-oak',
  });
});

// POST /api/launch-wizard/session/:sessionId/complete - Complete launch
router.post('/session/:sessionId/complete', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { mint } = req.body;

  if (!mint) {
    res.status(400).json({
      success: false,
      error: 'mint address is required',
    });
    return;
  }

  LaunchWizard.completeSession(sessionId, mint);

  res.json({
    success: true,
    message: 'Launch completed! Your token is now live.',
    mint,
  });
});

export default router;
