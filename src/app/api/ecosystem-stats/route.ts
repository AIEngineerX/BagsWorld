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

// Track if we've attempted to auto-start
let autoStartAttempted = false;

/**
 * Public endpoint for creator rewards statistics
 * No authentication required - this is transparency data
 * Auto-initializes the rewards agent if configured
 */
export async function GET() {
  try {
    // Get initial state
    let rewardsState = getCreatorRewardsState();

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

    return NextResponse.json({
      // Pool status
      pendingPoolSol: rewardsState.pendingPoolSol,
      thresholdSol: rewardsState.config.thresholdSol,
      minimumDistributionSol: rewardsState.config.minimumDistributionSol,

      // Timer status
      cycleStartTime: rewardsState.cycleStartTime,
      backupTimerDays: ECOSYSTEM_CONFIG.ecosystem.rewards.backupTimerDays,

      // Distribution stats
      totalDistributed: rewardsState.totalDistributed,
      distributionCount: rewardsState.distributionCount,
      lastDistribution: rewardsState.lastDistribution,

      // Top creators
      topCreators: rewardsState.topCreators.slice(0, 3).map((c) => ({
        wallet: c.wallet,
        tokenSymbol: c.tokenSymbol,
        feesGenerated: c.feesGenerated,
        rank: c.rank,
      })),

      // Recent distributions
      recentDistributions: rewardsState.recentDistributions.slice(0, 5).map((d) => ({
        timestamp: d.timestamp,
        totalDistributed: d.totalDistributed,
        recipients: d.recipients.map((r) => ({
          wallet: r.wallet,
          tokenSymbol: r.tokenSymbol,
          amount: r.amount,
          rank: r.rank,
        })),
      })),

      // Config for display
      distribution: rewardsState.config.distribution,

      // Trigger info - which will happen first
      triggerInfo: getTimeUntilDistribution(),
    });
  } catch (error) {
    console.error("Ecosystem stats error:", error);

    // Return default values if agent not initialized
    return NextResponse.json({
      pendingPoolSol: 0,
      thresholdSol: ECOSYSTEM_CONFIG.ecosystem.rewards.thresholdSol,
      minimumDistributionSol: ECOSYSTEM_CONFIG.ecosystem.rewards.minimumDistributionSol,
      cycleStartTime: Date.now(),
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
