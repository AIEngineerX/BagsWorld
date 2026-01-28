// Launch Wizard routes - Professor Oak guided token launches
// POST /api/launch-wizard/start - Start a new launch session
// GET /api/launch-wizard/session/:sessionId - Get session status
// POST /api/launch-wizard/session/:sessionId/input - Process step input
// POST /api/launch-wizard/session/:sessionId/ask - Ask Professor Oak a question
// POST /api/launch-wizard/session/:sessionId/build-transaction - Build launch transaction
// POST /api/launch-wizard/session/:sessionId/complete - Mark launch as complete

import { Router, Request, Response } from "express";
import { LaunchWizard } from "../services/LaunchWizard.js";

const router = Router();

// POST /api/launch-wizard/start - Start guided launch
router.post("/start", (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({
      success: false,
      error: "userId is required",
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
router.get("/session/:sessionId", (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const session = LaunchWizard.getSession(sessionId);

  if (!session) {
    res.status(404).json({
      success: false,
      error: "Session not found",
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
      tokenCreation: session.tokenCreation,
      feeShareConfig: session.feeShareConfig,
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
router.post("/session/:sessionId/input", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { input } = req.body;

  if (!input || typeof input !== "string") {
    res.status(400).json({
      success: false,
      error: "input is required and must be a string",
    });
    return;
  }

  try {
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
  } catch (err) {
    console.error(`[launch-wizard] Error in /session/${sessionId}/input:`, err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to process input",
    });
  }
});

// POST /api/launch-wizard/session/:sessionId/ask - Ask Professor Oak
router.post("/session/:sessionId/ask", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { question } = req.body;

  if (!question || typeof question !== "string") {
    res.status(400).json({
      success: false,
      error: "question is required",
    });
    return;
  }

  const session = LaunchWizard.getSession(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: "Session not found",
    });
    return;
  }

  try {
    const advice = await LaunchWizard.getPersonalizedAdvice(session, question);

    res.json({
      success: true,
      response: advice,
      agent: "professor-oak",
    });
  } catch (err) {
    console.error(`[launch-wizard] Error in /session/${sessionId}/ask:`, err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to get advice",
    });
  }
});

// POST /api/launch-wizard/session/:sessionId/build-transaction - Build launch transaction
router.post("/session/:sessionId/build-transaction", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { walletAddress } = req.body;

  if (!walletAddress || typeof walletAddress !== "string") {
    res.status(400).json({
      success: false,
      error: "walletAddress is required",
    });
    return;
  }

  // Validate wallet address format (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    res.status(400).json({
      success: false,
      error: "Invalid wallet address format",
    });
    return;
  }

  console.log(`[launch-wizard] Building transaction for session ${sessionId}, wallet ${walletAddress}`);

  try {
    const result = await LaunchWizard.buildTransaction({
      sessionId,
      walletAddress,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        oakMessage: result.oakMessage,
        // Return partial results if available
        tokenMint: result.tokenMint,
        tokenMetadata: result.tokenMetadata,
        feeShareConfigId: result.feeShareConfigId,
        feeShareTransactions: result.feeShareTransactions,
      });
      return;
    }

    res.json({
      success: true,
      tokenMint: result.tokenMint,
      tokenMetadata: result.tokenMetadata,
      feeShareConfigId: result.feeShareConfigId,
      feeShareTransactions: result.feeShareTransactions,
      launchTransaction: result.launchTransaction,
      lastValidBlockHeight: result.lastValidBlockHeight,
      oakMessage: result.oakMessage,
    });
  } catch (err) {
    console.error(`[launch-wizard] Error in /session/${sessionId}/build-transaction:`, err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to build transaction",
      oakMessage:
        "Oh no! Something unexpected happened while building your transaction. Let's try again!",
    });
  }
});

// POST /api/launch-wizard/session/:sessionId/complete - Complete launch
router.post("/session/:sessionId/complete", (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { mint, txSignature } = req.body;

  if (!mint) {
    res.status(400).json({
      success: false,
      error: "mint address is required",
    });
    return;
  }

  const session = LaunchWizard.getSession(sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: "Session not found",
    });
    return;
  }

  LaunchWizard.completeSession(sessionId, mint);

  const tokenName = session.data.name || "Your token";
  const tokenSymbol = session.data.symbol || "";

  res.json({
    success: true,
    message: `WONDERFUL! ${tokenName} ($${tokenSymbol}) is now LIVE on Bags.fm! Share it with the world!`,
    mint,
    txSignature,
    tokenUrl: `https://bags.fm/token/${mint}`,
    oakMessage: `WONDERFUL! *tears up* Your token ${tokenName} ($${tokenSymbol}) is evolving... into a real project! It's now live on Bags.fm! Share it with the world and watch your community grow. I'm so proud of you!`,
  });
});

// GET /api/launch-wizard/sessions - Get all active sessions (admin endpoint)
router.get("/sessions", (req: Request, res: Response) => {
  const sessions = LaunchWizard.getActiveSessions();

  res.json({
    success: true,
    count: sessions.length,
    sessions: sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      currentStep: s.currentStep,
      tokenName: s.data.name,
      tokenSymbol: s.data.symbol,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  });
});

export default router;
