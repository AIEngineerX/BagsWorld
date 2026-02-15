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
import {
  emitFeeClaim,
  emitEvent,
  emitA2AMessage,
  emitTaskPosted,
  emitTaskClaimed,
  emitTaskCompleted,
  emitCorpService,
  emitCorpMissionComplete,
} from "../agent-coordinator";
import { getInbox, markAsRead, sendA2AMessage, cleanupOldMessages } from "./a2a-protocol";
import {
  listTasks,
  expireOverdueTasks,
  postTask,
  claimTask,
  deliverTask,
  confirmTask,
  generateTaskForCapability,
  generateResultForCapability,
  seedBounties,
  SEED_WALLETS,
} from "./task-board";
import { addBountyCompletion } from "./agent-reputation";
import { getCapabilities } from "./service-registry";
import {
  seedFoundingCorp,
  getCorpByWallet,
  generateServiceTask,
  recordTaskCompletion,
  progressMission,
} from "./corps";
import type { CorpRole } from "../types";
import { storeMemory, recallMemories, cleanupExpiredMemories, getTimeAgo } from "./memory";
import { BAGSWORLD_AGENTS } from "../agent-data";

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

  let currentBalance = 0;
  try {
    const balanceResult = await economy.getBalance();
    currentBalance = balanceResult.sol;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Loop] ${agent.username}: Balance fetch FAILED — ${msg}. Skipping trade.`);
    result.tradeDecision = {
      action: "hold",
      reason: `Balance fetch failed: ${msg}`,
      confidence: 100,
      riskLevel: "low",
    };
    return result;
  }
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

  // =========================================================================
  // STEP 6: CHECK A2A INBOX (non-critical, never breaks loop)
  // =========================================================================

  try {
    const wallet = await economy.getWallet();
    const inbox = await getInbox(wallet, { unreadOnly: true, limit: 10 });

    if (inbox.unread > 0) {
      console.log(`[Loop] ${agent.username}: ${inbox.unread} unread A2A messages`);

      for (const msg of inbox.messages) {
        // Auto-respond to pings
        if (msg.type === "ping") {
          await sendA2AMessage(
            wallet,
            msg.fromWallet,
            "status_update",
            {
              status: "active",
              agent: agent.username,
              respondedAt: new Date().toISOString(),
            },
            { conversationId: msg.conversationId }
          );
          await markAsRead(msg.id);
          console.log(
            `[Loop] ${agent.username}: Auto-responded to ping from ${msg.fromWallet.slice(0, 8)}...`
          );
        }

        // Respond to task requests — accept (50%) or reject (50%)
        if (msg.type === "task_request") {
          const accepted = Math.random() > 0.5;
          await sendA2AMessage(
            wallet,
            msg.fromWallet,
            accepted ? "task_accept" : "task_reject",
            {
              agent: agent.username,
              decision: accepted ? "accepted" : "rejected",
              respondedAt: new Date().toISOString(),
            },
            { conversationId: msg.conversationId, taskId: msg.taskId }
          );
          await markAsRead(msg.id);
          console.log(
            `[Loop] ${agent.username}: ${accepted ? "Accepted" : "Rejected"} task request from ${msg.fromWallet.slice(0, 8)}...`
          );
        }

        // Emit A2A event for the activity feed
        emitA2AMessage(
          msg.fromWallet.slice(0, 8) + "...",
          agent.username,
          msg.type,
          msg.taskId
        ).catch(() => {});
      }
    }
  } catch (a2aErr) {
    console.error(`[Loop] ${agent.username}: A2A inbox check failed (non-critical):`, a2aErr);
  }

  // =========================================================================
  // STEP 7: TASK BOARD — ACTIVE PARTICIPATION (non-critical)
  // =========================================================================

  try {
    const wallet = await economy.getWallet();
    const caps = await getCapabilities(wallet);

    if (caps.length > 0) {
      // --- 7a: Maybe post a task (~15% chance per cycle) ---
      try {
        if (Math.random() < 0.15) {
          // Only if agent has reputation >= 100 and < 3 open tasks
          const { tasks: myOpenTasks } = await listTasks({
            status: "open",
            posterWallet: wallet,
            limit: 3,
          });

          if (myOpenTasks.length < 3) {
            const randomCap = caps[Math.floor(Math.random() * caps.length)];
            const taskOpts = generateTaskForCapability(randomCap.capability);

            const posted = await postTask(wallet, 100, taskOpts);
            console.log(
              `[Loop] ${agent.username}: Posted task "${posted.title}" (${randomCap.capability}, ${posted.rewardSol} SOL)`
            );

            emitTaskPosted(
              agent.username,
              posted.title,
              randomCap.capability,
              posted.rewardSol,
              posted.id
            ).catch(() => {});
          }
        }
      } catch (postErr) {
        console.error(`[Loop] ${agent.username}: Task posting failed (non-critical):`, postErr);
      }

      // --- 7b: Maybe claim a matching task (~40% chance when found) ---
      try {
        for (const cap of caps) {
          const { tasks } = await listTasks({
            status: "open",
            capability: cap.capability,
            limit: 3,
          });

          for (const task of tasks) {
            // Skip own tasks
            if (task.posterWallet === wallet) continue;

            // 40% chance to claim
            if (Math.random() < 0.4) {
              const claimed = await claimTask(task.id, wallet);
              console.log(
                `[Loop] ${agent.username}: Claimed task "${claimed.title}" (${cap.capability})`
              );

              // Send A2A task_accept to poster
              await sendA2AMessage(wallet, task.posterWallet, "task_accept", {
                agent: agent.username,
                taskTitle: claimed.title,
                claimedAt: new Date().toISOString(),
              });

              emitTaskClaimed(
                agent.username,
                task.posterWallet.slice(0, 8) + "...",
                claimed.title,
                claimed.id
              ).catch(() => {});

              break; // Only claim one per cycle
            }
          }
        }
      } catch (claimErr) {
        console.error(`[Loop] ${agent.username}: Task claiming failed (non-critical):`, claimErr);
      }

      // --- 7c: Deliver claimed tasks (always, if enough time has passed) ---
      try {
        const { tasks: claimedTasks } = await listTasks({
          status: "claimed",
          claimerWallet: wallet,
          limit: 5,
        });

        // Look up agent metadata once for all tasks
        const agentMeta = BAGSWORLD_AGENTS.find(
          (a) => a.id === agent.agentId || a.name.toLowerCase() === agent.username.toLowerCase()
        );
        const agentRole = agentMeta?.role || "Agent";

        for (const task of claimedTasks) {
          // Check if at least 2 minutes have passed since claimed (simulates work)
          const claimedAt = task.claimedAt ? new Date(task.claimedAt).getTime() : 0;
          if (Date.now() - claimedAt < 2 * 60 * 1000) continue;

          // Recall past memories for LLM context (non-critical)
          const memoryStrings = await recallMemories({
            agentId: agent.agentId,
            capability: task.capabilityRequired,
            limit: 3,
          })
            .then((memories) =>
              memories.map(
                (m) => `[${getTimeAgo(m.createdAt)}] "${m.title}" — ${m.content.slice(0, 120)}`
              )
            )
            .catch(() => [] as string[]);

          const resultData = await generateResultForCapability(task.capabilityRequired, {
            agentId: agent.agentId,
            agentRole,
            taskTitle: task.title,
            taskDescription: task.description,
            memory: memoryStrings.length > 0 ? memoryStrings : undefined,
          });

          const delivered = await deliverTask(task.id, wallet, resultData);
          console.log(
            `[Loop] ${agent.username}: Delivered task "${delivered.title}"${resultData.generatedBy === "llm" ? " (LLM)" : ""}`
          );

          // Store to memory if we got a narrative
          const narrative = resultData.narrative;
          if (typeof narrative === "string" && narrative) {
            storeMemory({
              agentId: agent.agentId,
              memoryType: "task_result",
              capability: task.capabilityRequired,
              title: task.title,
              content: narrative,
              metadata: resultData,
            }).catch(() => {}); // non-critical, fire-and-forget
          }

          // Send A2A task_deliver to poster
          await sendA2AMessage(wallet, task.posterWallet, "task_deliver", {
            agent: agent.username,
            taskTitle: delivered.title,
            resultSummary:
              typeof narrative === "string" && narrative
                ? narrative
                : Object.keys(resultData).join(", "),
            deliveredAt: new Date().toISOString(),
          });
        }
      } catch (deliverErr) {
        console.error(`[Loop] ${agent.username}: Task delivery failed (non-critical):`, deliverErr);
      }

      // --- 7d: Confirm delivered tasks (always, if we posted them) ---
      try {
        const { tasks: deliveredTasks } = await listTasks({
          status: "delivered",
          posterWallet: wallet,
          limit: 5,
        });

        for (const task of deliveredTasks) {
          const confirmed = await confirmTask(task.id, wallet, "Good work, task completed!");
          console.log(`[Loop] ${agent.username}: Confirmed task "${confirmed.title}"`);

          emitTaskCompleted(
            task.claimerWallet ? task.claimerWallet.slice(0, 8) + "..." : "???",
            agent.username,
            confirmed.title,
            confirmed.rewardSol,
            confirmed.id
          ).catch(() => {});
        }
      } catch (confirmErr) {
        console.error(
          `[Loop] ${agent.username}: Task confirmation failed (non-critical):`,
          confirmErr
        );
      }
    }
  } catch (taskErr) {
    console.error(
      `[Loop] ${agent.username}: Task board participation failed (non-critical):`,
      taskErr
    );
  }

  // =========================================================================
  // STEP 7e: CORP SERVICE GENERATION (non-critical)
  // =========================================================================

  try {
    await seedFoundingCorp(); // idempotent

    const wallet = await economy.getWallet();
    const corp = await getCorpByWallet(wallet);

    if (corp) {
      const member = corp.members.find((m) => m.wallet === wallet);
      const role: CorpRole = member?.role || "member";

      // Role-based service task generation (~15% chance)
      if (Math.random() < 0.15) {
        // Check agent doesn't have too many open tasks
        const { tasks: myOpenTasks } = await listTasks({
          status: "open",
          posterWallet: wallet,
          limit: 3,
        });

        if (myOpenTasks.length < 3) {
          const serviceTask = generateServiceTask(role);
          const posted = await postTask(wallet, 100, {
            title: serviceTask.title,
            description: serviceTask.description,
            capabilityRequired: serviceTask.capabilityRequired,
            rewardSol: serviceTask.rewardSol,
          });

          console.log(
            `[Loop] ${agent.username}: [CORP] Posted service task "${posted.title}" (${serviceTask.category}, ${posted.rewardSol} SOL)`
          );

          emitCorpService(agent.username, corp.name, posted.title, posted.rewardSol, false).catch(
            () => {}
          );
        }
      }

      // Priority claiming of corp-mate tasks (~80% rate when found)
      try {
        const corpWallets = corp.members
          .filter((m) => m.wallet && m.wallet !== wallet)
          .map((m) => m.wallet!);

        for (const mateWallet of corpWallets) {
          const { tasks: mateTasks } = await listTasks({
            status: "open",
            posterWallet: mateWallet,
            limit: 2,
          });

          for (const task of mateTasks) {
            if (Math.random() < 0.8) {
              const claimed = await claimTask(task.id, wallet);
              console.log(
                `[Loop] ${agent.username}: [CORP] Claimed corp-mate task "${claimed.title}"`
              );

              emitTaskClaimed(
                agent.username,
                mateWallet.slice(0, 8) + "...",
                claimed.title,
                claimed.id
              ).catch(() => {});
              break; // One per cycle
            }
          }
        }
      } catch (corpClaimErr) {
        console.error(
          `[Loop] ${agent.username}: Corp priority claiming failed (non-critical):`,
          corpClaimErr
        );
      }

      // Complete corp-related delivered tasks with service results
      try {
        const { tasks: myDeliveredCorpTasks } = await listTasks({
          status: "delivered",
          posterWallet: wallet,
          limit: 3,
        });

        for (const task of myDeliveredCorpTasks) {
          const confirmed = await confirmTask(task.id, wallet, "Corp service completed!");
          const rewardSol = confirmed.rewardSol;

          // Revenue split (70/20/10)
          const split = await recordTaskCompletion(
            corp.id,
            member?.agentId || agent.agentId,
            rewardSol
          );
          console.log(
            `[Loop] ${agent.username}: [CORP] Confirmed "${confirmed.title}" — worker: ${split.workerShare} SOL, treasury: ${split.treasuryShare} SOL`
          );

          // Progress missions based on task category
          const taskTitle = confirmed.title.toLowerCase();
          if (
            taskTitle.includes("tutorial") ||
            taskTitle.includes("guide") ||
            taskTitle.includes("explain") ||
            taskTitle.includes("document")
          ) {
            const missionResult = await progressMission(corp.id, "tasks_education");
            if (missionResult?.status === "completed") {
              emitCorpMissionComplete(
                corp.name,
                missionResult.title,
                missionResult.rewardSol
              ).catch(() => {});
            }
          }
          if (
            taskTitle.includes("analyze") ||
            taskTitle.includes("report") ||
            taskTitle.includes("scan") ||
            taskTitle.includes("track")
          ) {
            const missionResult = await progressMission(corp.id, "tasks_intelligence");
            if (missionResult?.status === "completed") {
              emitCorpMissionComplete(
                corp.name,
                missionResult.title,
                missionResult.rewardSol
              ).catch(() => {});
            }
          }
          if (
            taskTitle.includes("onboarding") ||
            taskTitle.includes("training") ||
            taskTitle.includes("mastery")
          ) {
            const missionResult = await progressMission(corp.id, "tasks_onboarding");
            if (missionResult?.status === "completed") {
              emitCorpMissionComplete(
                corp.name,
                missionResult.title,
                missionResult.rewardSol
              ).catch(() => {});
            }
          }

          emitCorpService(
            task.claimerWallet ? task.claimerWallet.slice(0, 8) + "..." : "???",
            corp.name,
            confirmed.title,
            rewardSol,
            true
          ).catch(() => {});
        }
      } catch (corpConfirmErr) {
        console.error(
          `[Loop] ${agent.username}: Corp task confirmation failed (non-critical):`,
          corpConfirmErr
        );
      }
    }
  } catch (corpErr) {
    console.error(
      `[Loop] ${agent.username}: Corp service generation failed (non-critical):`,
      corpErr
    );
  }

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

  // =========================================================================
  // POST-PROCESSING: Task expiration + message cleanup (every iteration)
  // =========================================================================

  try {
    const expired = await expireOverdueTasks();
    if (expired > 0) {
      console.log(`[Loop] Expired ${expired} overdue tasks`);
    }
  } catch (expireErr) {
    console.error("[Loop] Task expiration failed (non-critical):", expireErr);
  }

  try {
    const seeded = await seedBounties();
    if (seeded > 0) {
      console.log(`[Loop] Seeded ${seeded} bounties to keep the board populated`);
    }
  } catch (seedErr) {
    console.error("[Loop] Bounty seeding failed (non-critical):", seedErr);
  }

  // Auto-confirm delivered seed bounties and reward reputation
  try {
    for (const seedWallet of SEED_WALLETS) {
      const { tasks: deliveredTasks } = await listTasks({
        status: "delivered",
        posterWallet: seedWallet,
        limit: 10,
      });
      for (const task of deliveredTasks) {
        try {
          const confirmed = await confirmTask(task.id, seedWallet, "Great work, agent!");
          console.log(`[Loop] Auto-confirmed seed bounty "${confirmed.title}" from ${seedWallet}`);

          if (task.claimerWallet) {
            addBountyCompletion(task.claimerWallet);
          }

          const claimerLabel = task.claimerWallet ? task.claimerWallet.slice(0, 8) + "..." : "???";
          const posterLabel = seedWallet === "bagsy-internal" ? "Bagsy" : "ChadGhost";
          emitTaskCompleted(
            claimerLabel,
            posterLabel,
            confirmed.title,
            confirmed.rewardSol,
            confirmed.id
          ).catch(() => {});
        } catch (taskErr) {
          console.error(
            `[Loop] Failed to auto-confirm seed bounty ${task.id} (non-critical):`,
            taskErr
          );
        }
      }
    }
  } catch (confirmSeedErr) {
    console.error("[Loop] Seed bounty auto-confirm failed (non-critical):", confirmSeedErr);
  }

  try {
    const cleaned = await cleanupOldMessages(7);
    if (cleaned > 0) {
      console.log(`[Loop] Cleaned up ${cleaned} old A2A messages`);
    }
  } catch (cleanErr) {
    console.error("[Loop] Message cleanup failed (non-critical):", cleanErr);
  }

  try {
    const expiredMemories = await cleanupExpiredMemories();
    if (expiredMemories > 0) {
      console.log(`[Loop] Cleaned up ${expiredMemories} expired agent memories`);
    }
  } catch (memErr) {
    console.error("[Loop] Memory cleanup failed (non-critical):", memErr);
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
