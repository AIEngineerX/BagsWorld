import { NextResponse } from "next/server";
import {
  getCreatorRewardsState,
  initCreatorRewardsAgent,
  startCreatorRewardsAgent,
  getTimeUntilDistribution,
} from "@/lib/creator-rewards-agent";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { isAgentWalletConfigured } from "@/lib/agent-wallet";
import { isServerBagsApiConfigured } from "@/lib/bags-api-server";
import { getRewardsState, isNeonConfigured, saveRewardsState } from "@/lib/neon";

// Track if we've attempted to auto-start
let autoStartAttempted = false;

// Default cycle start time (set once on first request if no DB record)
let defaultCycleStart: number | null = null;

/**
 * Public endpoint for creator rewards statistics
 * No authentication required - this is transparency data
 * Auto-initializes the rewards agent if configured
 */
export async function GET() {
  try {
    // Get initial state from agent
    let rewardsState = getCreatorRewardsState();

    // Always try to load persisted state from database for accurate timer
    let persistedState = null;
    if (isNeonConfigured()) {
      persistedState = await getRewardsState();

      // If no persisted state exists, create one with current time
      if (!persistedState) {
        if (!defaultCycleStart) {
          defaultCycleStart = Date.now();
        }
        // Initialize the database with a starting record
        await saveRewardsState({
          cycle_start_time: defaultCycleStart,
          total_distributed: 0,
          distribution_count: 0,
          last_distribution: 0,
          recent_distributions: [],
        });
        persistedState = await getRewardsState();
      }
    }

    // Use persisted values if available (they survive server restarts)
    const cycleStartTime = persistedState?.cycle_start_time || rewardsState.cycleStartTime;
    const totalDistributed = persistedState?.total_distributed || rewardsState.totalDistributed;
    const distributionCount = persistedState?.distribution_count || rewardsState.distributionCount;
    const lastDistribution = persistedState?.last_distribution || rewardsState.lastDistribution;
    const recentDistributions = persistedState?.recent_distributions || rewardsState.recentDistributions;

    // Auto-start the rewards agent if not already running and properly configured
    if (!rewardsState.isRunning && !autoStartAttempted) {
      autoStartAttempted = true;

      // Only attempt auto-start if wallet and API are configured
      if (isAgentWalletConfigured() && isServerBagsApiConfigured()) {
        console.log("[Ecosystem Stats] Auto-initializing creator rewards agent...");
        const initialized = await initCreatorRewardsAgent();
        if (initialized) {
          const started = await startCreatorRewardsAgent();
          if (started) {
            console.log("[Ecosystem Stats] Creator rewards agent auto-started successfully");
            // Re-fetch state after starting
            rewardsState = getCreatorRewardsState();
          }
        }
      }
    }

    // Calculate trigger info using persisted cycle start time
    const backupTimerMs = ECOSYSTEM_CONFIG.ecosystem.rewards.backupTimerDays * 24 * 60 * 60 * 1000;
    const timeRemaining = backupTimerMs - (Date.now() - cycleStartTime);
    const solNeeded = rewardsState.config.thresholdSol - rewardsState.pendingPoolSol;

    const triggerInfo = {
      byThreshold: solNeeded > 0 ? solNeeded : null,
      byTimer: Math.max(0, timeRemaining),
      estimatedTrigger:
        rewardsState.pendingPoolSol >= rewardsState.config.thresholdSol
          ? "threshold" as const
          : timeRemaining <= 0 && rewardsState.pendingPoolSol >= rewardsState.config.minimumDistributionSol
          ? "timer" as const
          : "unknown" as const,
    };

    return NextResponse.json({
      // Pool status
      pendingPoolSol: rewardsState.pendingPoolSol,
      thresholdSol: rewardsState.config.thresholdSol,
      minimumDistributionSol: rewardsState.config.minimumDistributionSol,

      // Timer status - use persisted value
      cycleStartTime,
      backupTimerDays: ECOSYSTEM_CONFIG.ecosystem.rewards.backupTimerDays,

      // Distribution stats - use persisted values
      totalDistributed,
      distributionCount,
      lastDistribution,

      // Top creators from agent
      topCreators: rewardsState.topCreators.slice(0, 3).map((c) => ({
        wallet: c.wallet,
        tokenSymbol: c.tokenSymbol,
        feesGenerated: c.feesGenerated,
        rank: c.rank,
      })),

      // Recent distributions - use persisted value
      recentDistributions: (recentDistributions || []).slice(0, 5).map((d: any) => ({
        timestamp: d.timestamp,
        totalDistributed: d.totalDistributed,
        recipients: (d.recipients || []).map((r: any) => ({
          wallet: r.wallet,
          tokenSymbol: r.tokenSymbol,
          amount: r.amount,
          rank: r.rank,
        })),
      })),

      // Config for display
      distribution: rewardsState.config.distribution,

      // Trigger info - calculated with persisted cycle time
      triggerInfo,
    });
  } catch (error) {
    console.error("Ecosystem stats error:", error);

    // Return default values if agent not initialized
    return NextResponse.json({
      pendingPoolSol: 0,
      thresholdSol: ECOSYSTEM_CONFIG.ecosystem.rewards.thresholdSol,
      minimumDistributionSol: ECOSYSTEM_CONFIG.ecosystem.rewards.minimumDistributionSol,
      cycleStartTime: defaultCycleStart || Date.now(),
      backupTimerDays: ECOSYSTEM_CONFIG.ecosystem.rewards.backupTimerDays,
      totalDistributed: 0,
      distributionCount: 0,
      lastDistribution: 0,
      topCreators: [],
      recentDistributions: [],
      distribution: ECOSYSTEM_CONFIG.ecosystem.rewards.distribution,
      triggerInfo: {
        byThreshold: ECOSYSTEM_CONFIG.ecosystem.rewards.thresholdSol,
        byTimer: ECOSYSTEM_CONFIG.ecosystem.rewards.backupTimerDays * 24 * 60 * 60 * 1000,
        estimatedTrigger: "unknown" as const,
      },
    });
  }
}
