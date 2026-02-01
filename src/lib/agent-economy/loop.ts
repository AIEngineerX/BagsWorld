// Agent Economy Loop
// The self-sustaining orchestrator that keeps the agentic economy running
//
// Flow:
// 1. Check each agent's claimable fees
// 2. Claim if above threshold
// 3. Make reinvestment decisions
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
import { logAgentAction, getAgentActions } from "./credentials";
import { getClaimablePositions } from "./fees";
import { lamportsToSol } from "./types";

// Loop configuration
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
  strategy: "random" | "diversify" | "follow_whales" | "conservative";
}

export const DEFAULT_LOOP_CONFIG: EconomyLoopConfig = {
  intervalMs: 60_000, // 1 minute
  minClaimThresholdSol: 0.001, // Claim anything over 0.001 SOL
  reinvestmentRate: 50, // Reinvest 50% of earnings
  minTradeAmountSol: 0.001,
  maxTradeAmountSol: 0.1,
  enableTrading: false, // Start with dry run
  enableClaiming: true,
  strategy: "conservative",
};

// Loop state
interface LoopState {
  isRunning: boolean;
  lastRun: Date | null;
  totalRuns: number;
  totalClaimed: number;
  totalTraded: number;
  errors: number;
  intervalHandle: NodeJS.Timeout | null;
}

const loopState: LoopState = {
  isRunning: false,
  lastRun: null,
  totalRuns: 0,
  totalClaimed: 0,
  totalTraded: 0,
  errors: 0,
  intervalHandle: null,
};

// Agent decision result
interface AgentDecision {
  agentId: string;
  action: "claim" | "buy" | "sell" | "hold" | "skip";
  amount?: number;
  tokenMint?: string;
  reason: string;
  executed: boolean;
  signature?: string;
  error?: string;
}

/**
 * Process a single agent's economic cycle
 */
async function processAgent(
  agent: SpawnedAgent,
  config: EconomyLoopConfig
): Promise<AgentDecision[]> {
  const decisions: AgentDecision[] = [];
  const economy = await AgentEconomy.get(agent.agentId);

  if (!economy) {
    decisions.push({
      agentId: agent.agentId,
      action: "skip",
      reason: "Agent not found in economy system",
      executed: false,
    });
    return decisions;
  }

  try {
    // Step 1: Check claimable fees
    const { positions, totalSol: claimableSol } = await economy.getClaimableFees();

    console.log(`[Loop] Agent ${agent.username}: ${claimableSol.toFixed(4)} SOL claimable`);

    // Step 2: Claim if above threshold
    if (claimableSol >= config.minClaimThresholdSol && config.enableClaiming) {
      console.log(`[Loop] Agent ${agent.username}: Claiming ${claimableSol.toFixed(4)} SOL...`);

      try {
        const claimResult = await economy.claimFees();

        decisions.push({
          agentId: agent.agentId,
          action: "claim",
          amount: claimResult.amount,
          reason: `Claimed ${claimResult.amount.toFixed(4)} SOL from ${positions.length} positions`,
          executed: claimResult.claimed,
          signature: claimResult.signatures[0],
        });

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
        }
      } catch (error) {
        decisions.push({
          agentId: agent.agentId,
          action: "claim",
          amount: claimableSol,
          reason: "Claim failed",
          executed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Step 3: Get current balance for reinvestment decisions
    const { sol: currentBalance } = await economy.getBalance();
    const reinvestAmount = currentBalance * (config.reinvestmentRate / 100);

    console.log(
      `[Loop] Agent ${agent.username}: Balance ${currentBalance.toFixed(4)} SOL, reinvest amount ${reinvestAmount.toFixed(4)} SOL`
    );

    // Step 4: Make reinvestment decision
    if (
      reinvestAmount >= config.minTradeAmountSol &&
      reinvestAmount <= config.maxTradeAmountSol &&
      config.enableTrading
    ) {
      const decision = await makeReinvestmentDecision(economy, reinvestAmount, config);

      if (decision.action === "buy" && decision.tokenMint) {
        try {
          console.log(
            `[Loop] Agent ${agent.username}: Buying ${decision.tokenMint} with ${reinvestAmount.toFixed(4)} SOL...`
          );

          const buyResult = await economy.buy(decision.tokenMint, reinvestAmount);

          decisions.push({
            agentId: agent.agentId,
            action: "buy",
            amount: reinvestAmount,
            tokenMint: decision.tokenMint,
            reason: decision.reason,
            executed: buyResult.success,
            signature: buyResult.signature,
            error: buyResult.error,
          });

          if (buyResult.success) {
            loopState.totalTraded += reinvestAmount;

            await logAgentAction(
              agent.agentId,
              "buy",
              {
                tokenMint: decision.tokenMint,
                amount: reinvestAmount,
              },
              true,
              buyResult.signature
            );
          }
        } catch (error) {
          decisions.push({
            agentId: agent.agentId,
            action: "buy",
            amount: reinvestAmount,
            tokenMint: decision.tokenMint,
            reason: decision.reason,
            executed: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
        decisions.push({
          agentId: agent.agentId,
          action: "hold",
          reason: decision.reason,
          executed: true,
        });
      }
    } else {
      decisions.push({
        agentId: agent.agentId,
        action: "hold",
        reason: `Balance ${currentBalance.toFixed(4)} SOL - below trade threshold or trading disabled`,
        executed: true,
      });
    }

    // Step 5: Refresh agent mood based on final balance
    await refreshAgentMood(agent.agentId);
  } catch (error) {
    console.error(`[Loop] Error processing agent ${agent.username}:`, error);
    loopState.errors++;

    decisions.push({
      agentId: agent.agentId,
      action: "skip",
      reason: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      executed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return decisions;
}

/**
 * Make a reinvestment decision based on strategy
 */
async function makeReinvestmentDecision(
  economy: AgentEconomy,
  amount: number,
  config: EconomyLoopConfig
): Promise<{ action: "buy" | "sell" | "hold"; tokenMint?: string; reason: string }> {
  switch (config.strategy) {
    case "conservative":
      // Conservative: Only buy into established tokens, hold most of the time
      // For now, just hold - we'd need market data to make smart decisions
      return {
        action: "hold",
        reason: "Conservative strategy: Holding SOL",
      };

    case "diversify":
      // Diversify: Spread across multiple tokens
      // Would need to check existing positions and find new tokens
      return {
        action: "hold",
        reason: "Diversify strategy: Analyzing positions...",
      };

    case "follow_whales":
      // Follow whales: Buy what big earners are buying
      // Would need whale tracking data
      return {
        action: "hold",
        reason: "Whale strategy: Monitoring whale activity...",
      };

    case "random":
      // Random: Pick a random token (for testing)
      // In production, you'd get a list of tradeable tokens
      return {
        action: "hold",
        reason: "Random strategy: No tokens available",
      };

    default:
      return {
        action: "hold",
        reason: "Unknown strategy",
      };
  }
}

/**
 * Run one iteration of the economy loop
 */
export async function runLoopIteration(config: EconomyLoopConfig = DEFAULT_LOOP_CONFIG): Promise<{
  processedAgents: number;
  decisions: AgentDecision[];
  duration: number;
}> {
  const startTime = Date.now();
  const agents = getSpawnedAgents();
  const allDecisions: AgentDecision[] = [];

  console.log(`[Loop] Starting iteration - ${agents.length} agents to process`);

  for (const agent of agents) {
    const decisions = await processAgent(agent, config);
    allDecisions.push(...decisions);
  }

  loopState.lastRun = new Date();
  loopState.totalRuns++;

  const duration = Date.now() - startTime;
  console.log(
    `[Loop] Iteration complete - ${agents.length} agents, ${allDecisions.length} decisions, ${duration}ms`
  );

  return {
    processedAgents: agents.length,
    decisions: allDecisions,
    duration,
  };
}

/**
 * Start the economy loop
 */
export function startEconomyLoop(config: EconomyLoopConfig = DEFAULT_LOOP_CONFIG): void {
  if (loopState.isRunning) {
    console.log("[Loop] Already running");
    return;
  }

  console.log(`[Loop] Starting economy loop (interval: ${config.intervalMs}ms)`);
  loopState.isRunning = true;

  // Run immediately
  runLoopIteration(config).catch(console.error);

  // Then run on interval
  loopState.intervalHandle = setInterval(() => {
    runLoopIteration(config).catch(console.error);
  }, config.intervalMs);
}

/**
 * Stop the economy loop
 */
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

/**
 * Get loop status
 */
export function getLoopStatus(): {
  isRunning: boolean;
  lastRun: Date | null;
  totalRuns: number;
  totalClaimed: number;
  totalTraded: number;
  errors: number;
  activeAgents: number;
} {
  return {
    ...loopState,
    activeAgents: getSpawnedAgents().length,
  };
}

/**
 * Reset loop statistics
 */
export function resetLoopStats(): void {
  loopState.totalRuns = 0;
  loopState.totalClaimed = 0;
  loopState.totalTraded = 0;
  loopState.errors = 0;
}
