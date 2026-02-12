// Arena Matchmaking System
// Manages the queue and pairs fighters for matches

import {
  getQueuedFighters,
  removeFromQueue,
  createMatch,
  getFighterById,
  cleanupStaleQueue,
  getQueueSize,
  storeMatchReplay,
  type ArenaQueueEntry,
} from "./arena-db";
import { getArenaEngine } from "./arena-engine";
import type { FightReplay } from "./arena-types";

// Configuration
const MIN_QUEUE_SIZE = 2;
const MAX_WAIT_SECONDS = 300; // 5 minutes max wait before removal
const KARMA_TIER_SIZE = 200; // Group fighters into karma tiers for better matching

// Matchmaking state
let isProcessing = false;

// Store the last match result for immediate retrieval
let lastMatchResult: {
  matchId: number;
  winner: string;
  fighter1: string;
  fighter2: string;
  totalTicks: number;
} | null = null;

// Store the last replay for immediate retrieval
let lastReplay: FightReplay | null = null;

/**
 * Get the last match result (for immediate retrieval after matchmaking)
 */
export function getLastMatchResult() {
  const result = lastMatchResult;
  lastMatchResult = null; // Clear after retrieval
  return result;
}

/**
 * Get the last fight replay (for immediate retrieval after matchmaking)
 */
export function getLastReplay(): FightReplay | null {
  return lastReplay;
}

/**
 * Attempt to create a match from the current queue
 * Returns the match ID if successful, null if not enough fighters
 */
export async function attemptMatchmaking(): Promise<number | null> {
  // Prevent concurrent matchmaking attempts
  if (isProcessing) {
    return null;
  }

  isProcessing = true;

  try {
    // Clean up stale queue entries first
    await cleanupStaleQueue(MAX_WAIT_SECONDS);

    // Get all queued fighters
    const queue = await getQueuedFighters();

    if (queue.length < MIN_QUEUE_SIZE) {
      console.log(`[Matchmaking] Queue has ${queue.length} fighters, need ${MIN_QUEUE_SIZE}`);
      return null;
    }

    // Find the best match
    const match = await findBestMatch(queue);
    if (!match) {
      console.log("[Matchmaking] No suitable match found");
      return null;
    }

    const { fighter1Entry, fighter2Entry } = match;

    // Load fighter data
    const fighter1 = await getFighterById(fighter1Entry.fighter_id);
    const fighter2 = await getFighterById(fighter2Entry.fighter_id);

    if (!fighter1 || !fighter2) {
      console.error("[Matchmaking] Could not load fighters from queue");
      // Clean up invalid queue entries
      await removeFromQueue(fighter1Entry.fighter_id);
      await removeFromQueue(fighter2Entry.fighter_id);
      return null;
    }

    // Create the match in database
    const matchId = await createMatch(fighter1.id, fighter2.id);
    if (!matchId) {
      console.error("[Matchmaking] Failed to create match in database");
      return null;
    }

    // Remove from queue
    await removeFromQueue(fighter1.id);
    await removeFromQueue(fighter2.id);

    console.log(
      `[Matchmaking] Created match ${matchId}: ${fighter1.moltbook_username} (karma: ${fighter1.moltbook_karma}) vs ${fighter2.moltbook_username} (karma: ${fighter2.moltbook_karma})`
    );

    // Add match to arena engine using addMatchDirect (avoids database lookup issues)
    const engine = getArenaEngine();
    const added = engine.addMatchDirect(
      matchId,
      { id: fighter1.id, username: fighter1.moltbook_username, karma: fighter1.moltbook_karma },
      { id: fighter2.id, username: fighter2.moltbook_username, karma: fighter2.moltbook_karma }
    );

    if (added) {
      // Run the fight to completion with replay capture
      const replay = engine.runMatchWithReplay(matchId);
      if (replay) {
        lastReplay = replay;
        lastMatchResult = {
          matchId,
          winner: replay.winner,
          fighter1: fighter1.moltbook_username,
          fighter2: fighter2.moltbook_username,
          totalTicks: replay.totalTicks,
        };
        // Store replay in DB (fire and forget)
        storeMatchReplay(matchId, replay).catch((err) =>
          console.error(`[Matchmaking] Failed to store replay for match ${matchId}:`, err)
        );
        console.log(
          `[Matchmaking] Match ${matchId} completed: ${replay.winner} wins (${replay.keyframes.length} keyframes, ${replay.totalTicks} ticks)`
        );
      }
    } else {
      console.error(`[Matchmaking] Failed to add match ${matchId} to arena engine`);
    }

    return matchId;
  } finally {
    isProcessing = false;
  }
}

/**
 * Find the best match from the queue
 * Prioritizes:
 * 1. Similar karma tiers (for fair fights)
 * 2. Longest waiting fighters (FIFO fairness)
 */
async function findBestMatch(
  queue: ArenaQueueEntry[]
): Promise<{ fighter1Entry: ArenaQueueEntry; fighter2Entry: ArenaQueueEntry } | null> {
  if (queue.length < 2) {
    return null;
  }

  // Load karma data for all queued fighters
  const fightersWithKarma: Array<{
    entry: ArenaQueueEntry;
    karma: number;
    waitTime: number;
  }> = [];

  for (const entry of queue) {
    const fighter = await getFighterById(entry.fighter_id);
    if (fighter) {
      const waitTime = Date.now() - new Date(entry.queued_at).getTime();
      fightersWithKarma.push({
        entry,
        karma: fighter.moltbook_karma,
        waitTime,
      });
    }
  }

  if (fightersWithKarma.length < 2) {
    return null;
  }

  // Sort by wait time (longest waiting first)
  fightersWithKarma.sort((a, b) => b.waitTime - a.waitTime);

  // Take the longest-waiting fighter as fighter1
  const fighter1 = fightersWithKarma[0];
  const fighter1Tier = Math.floor(fighter1.karma / KARMA_TIER_SIZE);

  // Find the best opponent
  let bestOpponent: (typeof fightersWithKarma)[0] | null = null;
  let bestScore = -Infinity;

  for (let i = 1; i < fightersWithKarma.length; i++) {
    const candidate = fightersWithKarma[i];
    const candidateTier = Math.floor(candidate.karma / KARMA_TIER_SIZE);

    // Score based on:
    // - Karma tier similarity (higher is better, max 100)
    // - Wait time (longer wait gets bonus, max 50)
    const tierDiff = Math.abs(fighter1Tier - candidateTier);
    const tierScore = Math.max(0, 100 - tierDiff * 20); // -20 per tier difference

    const waitScore = Math.min(50, candidate.waitTime / 60000); // +1 per minute waited, max 50

    const totalScore = tierScore + waitScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestOpponent = candidate;
    }
  }

  if (!bestOpponent) {
    // Fallback: just take the second in queue
    bestOpponent = fightersWithKarma[1];
  }

  return {
    fighter1Entry: fighter1.entry,
    fighter2Entry: bestOpponent.entry,
  };
}

/**
 * Process all possible matches in the queue
 * Used when multiple fighters queue at once
 */
export async function processAllMatches(): Promise<number[]> {
  const createdMatches: number[] = [];

  let matchId = await attemptMatchmaking();
  while (matchId !== null) {
    createdMatches.push(matchId);
    matchId = await attemptMatchmaking();
  }

  return createdMatches;
}

/**
 * Get the current queue status
 */
export async function getQueueStatus(): Promise<{
  size: number;
  oldestWaitSeconds: number | null;
  fighters: Array<{
    fighterId: number;
    username: string;
    karma: number;
    waitSeconds: number;
  }>;
}> {
  const queue = await getQueuedFighters();

  if (queue.length === 0) {
    return {
      size: 0,
      oldestWaitSeconds: null,
      fighters: [],
    };
  }

  const now = Date.now();
  const fighters: Array<{
    fighterId: number;
    username: string;
    karma: number;
    waitSeconds: number;
  }> = [];

  let oldestWaitMs = 0;

  for (const entry of queue) {
    const fighter = await getFighterById(entry.fighter_id);
    if (fighter) {
      const waitMs = now - new Date(entry.queued_at).getTime();
      if (waitMs > oldestWaitMs) {
        oldestWaitMs = waitMs;
      }
      fighters.push({
        fighterId: fighter.id,
        username: fighter.moltbook_username,
        karma: fighter.moltbook_karma,
        waitSeconds: Math.floor(waitMs / 1000),
      });
    }
  }

  // Sort by wait time (longest first)
  fighters.sort((a, b) => b.waitSeconds - a.waitSeconds);

  return {
    size: fighters.length,
    oldestWaitSeconds: oldestWaitMs > 0 ? Math.floor(oldestWaitMs / 1000) : null,
    fighters,
  };
}

/**
 * Estimate wait time for a new fighter joining the queue
 */
export async function estimateWaitTime(karma: number): Promise<{
  estimatedSeconds: number;
  queuePosition: number;
}> {
  const queue = await getQueuedFighters();

  if (queue.length === 0) {
    // No one in queue, will wait for next fighter
    return {
      estimatedSeconds: 60, // Estimate 1 minute for another fighter to join
      queuePosition: 1,
    };
  }

  // With 1 person in queue, match should happen immediately
  // With more people, estimate based on position
  const queuePosition = queue.length + 1;

  // Estimate ~30 seconds per match ahead in queue
  const estimatedSeconds = Math.max(0, Math.floor((queuePosition - 2) / 2) * 30);

  return {
    estimatedSeconds,
    queuePosition,
  };
}

/**
 * Check if a specific fighter is in the queue
 */
export async function isFighterInQueue(fighterId: number): Promise<boolean> {
  const queue = await getQueuedFighters();
  return queue.some((entry) => entry.fighter_id === fighterId);
}
