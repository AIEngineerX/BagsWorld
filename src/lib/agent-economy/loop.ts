// Agent Economy Loop
// The self-sustaining orchestrator that keeps the agentic economy running
//
// Flow:
// 1. Check each agent's claimable fees
// 2. Claim if above threshold
// 3. Make reinvestment decisions using the brain
// 4. Execute trades
// 5. Update agent state
// 6. Repeat

import { AgentEconomy } from "./index";
import {
  getSpawnedAgents,
  refreshAgentMood,
  updateAgentCharacter,
  type SpawnedAgent,
} from "./spawn";
import { logAgentAction } from "./credentials";
import { lamportsToSol, DEFAULT_AGENT_ECONOMY_CONFIG } from "./types";
import { makeTradeDecision, type StrategyType, type TradeDecision } from "./brain";
import { emitFeeClaim, emitEvent } from "../agent-coordinator";

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface EconomyLoopConfig {
  // How often to run the loop (ms)
  intervalMs: number;

  // Minimum SOL to trigger a claim
  minClaimThresholdSol: number;

  // What percentage of earnings to reinvest (0-100)
  reinvestmentRate: number;

  // Minimum SOL to make a trade
  minTradeAmountSol: number;

  // Maximum SOL to trade at once
  maxTradeAmountSol: number;

  // Enable actual trading (false = dry run)
  enableTrading: boolean;

  // Enable fee claiming
  enableClaiming: boolean;

  // Strategy for reinvestment
  strategy: StrategyType;

  // Minimum confidence to execute a trade (0-100)
  minConfidence: number;

  // Maximum risk level to accept
  maxRiskLevel: "low" | "medium" | "high";
}

export const DEFAULT_LOOP_CONFIG: EconomyLoopConfig = {
  intervalMs: 60_000, // 1 minute
  minClaimThresholdSol: 0.001, // Claim anything over 0.001 SOL
  reinvestmentRate: 50, // Reinvest 50% of earnings
  minTradeAmountSol: 0.005,
  maxTradeAmountSol: 0.5,
  enableTrading: false, // Start with dry run
  enableClaiming: true,
  strategy: "conservative",
  minConfidence: 60, // Only trade if confidence >= 60%
  maxRiskLevel: "medium", // Don't take high-risk trades by default
};

// ============================================================================
// LOOP STATE
// ============================================================================

interface LoopState {
  isRunning: boolean;
  isIterating: boolean; // Guard against overlapping iterations
  lastRun: Date | null;
  totalRuns: number;
  totalClaimed: number;
  totalTraded: number;
  tradesExecuted: number;
  errors: number;
  intervalHandle: NodeJS.Timeout | null;
}

const loopState: LoopState = {
  isRunning: false,
  isIterating: false,
  lastRun: null,
  totalRuns: 0,
  totalClaimed: 0,
  totalTraded: 0,
  tradesExecuted: 0,
  errors: 0,
  intervalHandle: null,
};

// ============================================================================
// DECISION RESULT TYPES
// ============================================================================

interface AgentCycleResult {
  agentId: string;
  username: string;
  claimResult?: {
    claimed: boolean;
    amount: number;
    signatures: string[];
  };
  tradeDecision: TradeDecision;
  tradeResult?: {
    executed: boolean;
    signature?: string;
    error?: string;
  };
  errors: string[];
}

// ============================================================================
// RISK LEVEL COMPARISON
// ============================================================================

const RISK_LEVELS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function isRiskAcceptable(
  tradeRisk: "low" | "medium" | "high",
  maxRisk: "low" | "medium" | "high"
): boolean {
  return RISK_LEVELS[tradeRisk] <= RISK_LEVELS[maxRisk];
}

// ============================================================================
// AGENT PROCESSING
// ============================================================================

async function processAgent(
  agent: SpawnedAgent,
  config: EconomyLoopConfig
): Promise<AgentCycleResult> {
  const result: AgentCycleResult = {
    agentId: agent.agentId,
    username: agent.username,
    tradeDecision: { action: "hold", reason: "Not processed", confidence: 0, riskLevel: "low" },
    errors: [],
  };

  const economy = await AgentEconomy.get(agent.agentId);

  if (!economy) {
    result.errors.push("Agent not found in economy system");
    return result;
  }

  // =========================================================================
  // STEP 1: CHECK AND CLAIM FEES
  // =========================================================================

  if (config.enableClaiming) {
    const { positions, totalSol: claimableSol } = await economy.getClaimableFees();

    console.log(
      `[Loop] ${agent.username}: ${claimableSol.toFixed(6)} SOL claimable from ${positions.length} positions`
    );

    if (claimableSol >= config.minClaimThresholdSol) {
      console.log(`[Loop] ${agent.username}: Claiming ${claimableSol.toFixed(6)} SOL...`);

      const claimResult = await economy.claimFees();

      result.claimResult = {
        claimed: claimResult.claimed,
        amount: claimResult.amount,
        signatures: claimResult.signatures,
      };

      if (claimResult.claimed) {
        loopState.totalClaimed += claimResult.amount;

        // Log the action
        await logAgentAction(
          agent.agentId,
          "claim",
          {
            amount: claimResult.amount,
            positions: positions.length,
            signatures: claimResult.signatures,
          },
          true,
          claimResult.signatures[0]
        );

        // Update agent mood (they just earned!)
        await updateAgentCharacter(agent.agentId, {
          mood: "celebrating",
          earnings24h: claimResult.amount,
        });

        console.log(
          `[Loop] ${agent.username}: Claimed ${claimResult.amount.toFixed(6)} SOL successfully`
        );

        // Emit to coordinator so claim appears in UnifiedActivityFeed and boosts world health
        emitFeeClaim(agent.username, claimResult.amount, "agent-claim").catch((err) => {
          console.error(`[Loop] ${agent.username}: Failed to emit claim event:`, err);
        });
      }
    }
  }

  // =========================================================================
  // STEP 2: GET BALANCE FOR TRADING
  // =========================================================================

  const { sol: currentBalance } = await economy.getBalance();
  const reinvestAmount = currentBalance * (config.reinvestmentRate / 100);

  console.log(
    `[Loop] ${agent.username}: Balance ${currentBalance.toFixed(6)} SOL, reinvest budget ${reinvestAmount.toFixed(6)} SOL`
  );

  // =========================================================================
  // STEP 3: MAKE TRADING DECISION
  // =========================================================================

  // Check if we have enough to trade
  if (reinvestAmount < config.minTradeAmountSol) {
    result.tradeDecision = {
      action: "hold",
      reason: `Reinvest budget ${reinvestAmount.toFixed(6)} SOL below minimum ${config.minTradeAmountSol} SOL`,
      confidence: 100,
      riskLevel: "low",
    };
  } else {
    // Cap at max trade amount
    const tradeBudget = Math.min(reinvestAmount, config.maxTradeAmountSol);

    // Get decision from brain
    result.tradeDecision = await makeTradeDecision(agent.agentId, config.strategy, tradeBudget, {
      minTradeSol: config.minTradeAmountSol,
      maxPositionSol: config.maxTradeAmountSol,
    });

    console.log(`[Loop] ${agent.username}: Brain decision:`, {
      action: result.tradeDecision.action,
      token: result.tradeDecision.tokenSymbol,
      amount: result.tradeDecision.amountSol?.toFixed(6),
      confidence: result.tradeDecision.confidence,
      risk: result.tradeDecision.riskLevel,
      reason: result.tradeDecision.reason,
    });
  }

  // =========================================================================
  // STEP 4: EXECUTE TRADE IF APPROVED
  // =========================================================================

  const decision = result.tradeDecision;

  if (decision.action !== "hold" && config.enableTrading) {
    // Check confidence threshold
    if (decision.confidence < config.minConfidence) {
      console.log(
        `[Loop] ${agent.username}: Skipping trade - confidence ${decision.confidence}% below threshold ${config.minConfidence}%`
      );
      result.tradeResult = {
        executed: false,
        error: `Confidence ${decision.confidence}% below threshold ${config.minConfidence}%`,
      };
    }
    // Check risk threshold
    else if (!isRiskAcceptable(decision.riskLevel, config.maxRiskLevel)) {
      console.log(
        `[Loop] ${agent.username}: Skipping trade - risk ${decision.riskLevel} exceeds max ${config.maxRiskLevel}`
      );
      result.tradeResult = {
        executed: false,
        error: `Risk level ${decision.riskLevel} exceeds max allowed ${config.maxRiskLevel}`,
      };
    }
    // Execute the trade
    else if (decision.action === "buy" && decision.tokenMint && decision.amountSol) {
      console.log(
        `[Loop] ${agent.username}: Executing BUY ${decision.tokenSymbol} for ${decision.amountSol.toFixed(6)} SOL...`
      );

      const buyResult = await economy.buy(decision.tokenMint, decision.amountSol);

      result.tradeResult = {
        executed: buyResult.success,
        signature: buyResult.signature,
        error: buyResult.error,
      };

      if (buyResult.success) {
        loopState.totalTraded += decision.amountSol;
        loopState.tradesExecuted++;

        await logAgentAction(
          agent.agentId,
          "buy",
          {
            tokenMint: decision.tokenMint,
            tokenSymbol: decision.tokenSymbol,
            amount: decision.amountSol,
            reason: decision.reason,
            confidence: decision.confidence,
          },
          true,
          buyResult.signature
        );

        // Update mood based on trade
        await updateAgentCharacter(agent.agentId, { mood: "happy" });

        // Emit trade event to coordinator for UnifiedActivityFeed
        emitEvent(
          "agent_insight",
          "ai-agent",
          {
            message: `${agent.username} bought $${decision.tokenSymbol || "???"} for ${decision.amountSol?.toFixed(4)} SOL`,
            action: "buy",
            username: agent.username,
            tokenSymbol: decision.tokenSymbol,
            amount: decision.amountSol,
            reason: decision.reason,
          },
          "medium"
        ).catch((err) => {
          console.error(`[Loop] ${agent.username}: Failed to emit buy event:`, err);
        });

        console.log(`[Loop] ${agent.username}: BUY successful - ${buyResult.signature}`);
      } else {
        result.errors.push(`Buy failed: ${buyResult.error}`);
        console.log(`[Loop] ${agent.username}: BUY failed - ${buyResult.error}`);
      }
    } else if (decision.action === "sell" && decision.tokenMint && decision.amountSol) {
      console.log(
        `[Loop] ${agent.username}: Executing SELL ${decision.tokenSymbol} for ~${decision.amountSol.toFixed(6)} SOL...`
      );

      // Convert SOL value to token amount using a reverse quote
      // sellToken expects token amount in smallest unit, but decision.amountSol is SOL value
      let tokenAmountToSell: number;
      try {
        const { getQuoteSolToToken } = await import("./trading");
        const LAMPORTS_PER_SOL = 1_000_000_000;
        const solLamports = Math.floor(decision.amountSol * LAMPORTS_PER_SOL);
        // Get quote: how many tokens would `amountSol` worth of SOL buy?
        // That tells us the equivalent token amount to sell for that SOL value
        const quote = await getQuoteSolToToken(agent.agentId, decision.tokenMint, solLamports);
        tokenAmountToSell = parseInt(quote.outAmount, 10);
        console.log(
          `[Loop] ${agent.username}: Converted ${decision.amountSol} SOL -> ${tokenAmountToSell} token units`
        );
      } catch (quoteErr) {
        result.errors.push(
          `Sell quote failed: ${quoteErr instanceof Error ? quoteErr.message : "Unknown"}`
        );
        console.error(`[Loop] ${agent.username}: Failed to get sell quote:`, quoteErr);
        tokenAmountToSell = 0;
      }

      if (tokenAmountToSell <= 0) {
        result.errors.push("Could not determine token amount to sell");
      }

      const sellResult =
        tokenAmountToSell > 0
          ? await economy.sell(decision.tokenMint, tokenAmountToSell)
          : { success: false, error: "Could not determine token amount" };

      result.tradeResult = {
        executed: sellResult.success,
        signature: sellResult.signature,
        error: sellResult.error,
      };

      if (sellResult.success) {
        loopState.totalTraded += decision.amountSol;
        loopState.tradesExecuted++;

        await logAgentAction(
          agent.agentId,
          "sell",
          {
            tokenMint: decision.tokenMint,
            tokenSymbol: decision.tokenSymbol,
            estimatedSol: decision.amountSol,
            reason: decision.reason,
            confidence: decision.confidence,
          },
          true,
          sellResult.signature
        );

        // Emit trade event to coordinator for UnifiedActivityFeed
        emitEvent(
          "agent_insight",
          "ai-agent",
          {
            message: `${agent.username} sold $${decision.tokenSymbol || "???"} for ~${decision.amountSol?.toFixed(4)} SOL`,
            action: "sell",
            username: agent.username,
            tokenSymbol: decision.tokenSymbol,
            amount: decision.amountSol,
            reason: decision.reason,
          },
          "medium"
        ).catch((err) => {
          console.error(`[Loop] ${agent.username}: Failed to emit sell event:`, err);
        });

        console.log(`[Loop] ${agent.username}: SELL successful - ${sellResult.signature}`);
      } else {
        result.errors.push(`Sell failed: ${sellResult.error}`);
        console.log(`[Loop] ${agent.username}: SELL failed - ${sellResult.error}`);
      }
    }
  } else if (decision.action !== "hold") {
    result.tradeResult = {
      executed: false,
      error: "Trading disabled (dry run mode)",
    };
    console.log(
      `[Loop] ${agent.username}: Would ${decision.action} ${decision.tokenSymbol} (dry run)`
    );
  }

  // =========================================================================
  // STEP 5: REFRESH AGENT STATE
  // =========================================================================

  await refreshAgentMood(agent.agentId);

  return result;
}

// ============================================================================
// LOOP ITERATION
// ============================================================================

export async function runLoopIteration(config: EconomyLoopConfig = DEFAULT_LOOP_CONFIG): Promise<{
  processedAgents: number;
  results: AgentCycleResult[];
  duration: number;
  summary: {
    totalClaimed: number;
    totalTraded: number;
    tradesExecuted: number;
    errors: number;
  };
}> {
  const startTime = Date.now();
  const agents = getSpawnedAgents();
  const results: AgentCycleResult[] = [];

  let iterationClaimed = 0;
  let iterationTraded = 0;
  let iterationTrades = 0;
  let iterationErrors = 0;

  console.log(`[Loop] ========== Starting iteration ==========`);
  console.log(
    `[Loop] Config: strategy=${config.strategy}, trading=${config.enableTrading}, claiming=${config.enableClaiming}`
  );
  console.log(`[Loop] Agents to process: ${agents.length}`);

  for (const agent of agents) {
    console.log(`[Loop] --- Processing ${agent.username} ---`);

    const result = await processAgent(agent, config);
    results.push(result);

    if (result.claimResult?.claimed) {
      iterationClaimed += result.claimResult.amount;
    }

    if (result.tradeResult?.executed) {
      iterationTrades++;
      if (result.tradeDecision.amountSol) {
        iterationTraded += result.tradeDecision.amountSol;
      }
    }

    iterationErrors += result.errors.length;
  }

  loopState.lastRun = new Date();
  loopState.totalRuns++;
  loopState.errors += iterationErrors;

  const duration = Date.now() - startTime;

  console.log(`[Loop] ========== Iteration complete ==========`);
  console.log(`[Loop] Duration: ${duration}ms`);
  console.log(`[Loop] Claimed: ${iterationClaimed.toFixed(6)} SOL`);
  console.log(`[Loop] Traded: ${iterationTraded.toFixed(6)} SOL in ${iterationTrades} trades`);
  console.log(`[Loop] Errors: ${iterationErrors}`);

  return {
    processedAgents: agents.length,
    results,
    duration,
    summary: {
      totalClaimed: iterationClaimed,
      totalTraded: iterationTraded,
      tradesExecuted: iterationTrades,
      errors: iterationErrors,
    },
  };
}

// ============================================================================
// LOOP CONTROL
// ============================================================================

export function startEconomyLoop(config: EconomyLoopConfig = DEFAULT_LOOP_CONFIG): void {
  if (loopState.isRunning) {
    console.log("[Loop] Already running");
    return;
  }

  console.log(`[Loop] Starting economy loop`);
  console.log(`[Loop] Interval: ${config.intervalMs}ms`);
  console.log(`[Loop] Strategy: ${config.strategy}`);
  console.log(`[Loop] Trading: ${config.enableTrading ? "ENABLED" : "DRY RUN"}`);
  console.log(`[Loop] Claiming: ${config.enableClaiming ? "ENABLED" : "DISABLED"}`);

  loopState.isRunning = true;

  // Guarded iteration runner — prevents overlapping iterations
  const runGuarded = async () => {
    if (loopState.isIterating) {
      console.log("[Loop] Skipping iteration — previous still running");
      return;
    }
    loopState.isIterating = true;
    try {
      await runLoopIteration(config);
    } catch (err) {
      console.error("[Loop] Iteration error:", err);
      loopState.errors++;
    } finally {
      loopState.isIterating = false;
    }
  };

  // Run immediately
  runGuarded();

  // Then run on interval (skips if previous iteration still running)
  loopState.intervalHandle = setInterval(() => {
    runGuarded();
  }, config.intervalMs);
}

export function stopEconomyLoop(): void {
  if (!loopState.isRunning) {
    console.log("[Loop] Not running");
    return;
  }

  console.log("[Loop] Stopping economy loop");

  if (loopState.intervalHandle) {
    clearInterval(loopState.intervalHandle);
    loopState.intervalHandle = null;
  }

  loopState.isRunning = false;
}

export function getLoopStatus(): {
  isRunning: boolean;
  lastRun: Date | null;
  totalRuns: number;
  totalClaimed: number;
  totalTraded: number;
  tradesExecuted: number;
  errors: number;
  activeAgents: number;
} {
  return {
    isRunning: loopState.isRunning,
    lastRun: loopState.lastRun,
    totalRuns: loopState.totalRuns,
    totalClaimed: loopState.totalClaimed,
    totalTraded: loopState.totalTraded,
    tradesExecuted: loopState.tradesExecuted,
    errors: loopState.errors,
    activeAgents: getSpawnedAgents().length,
  };
}

export function resetLoopStats(): void {
  loopState.totalRuns = 0;
  loopState.totalClaimed = 0;
  loopState.totalTraded = 0;
  loopState.tradesExecuted = 0;
  loopState.errors = 0;
  console.log("[Loop] Stats reset");
}
