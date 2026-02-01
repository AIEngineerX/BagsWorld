// Arena MoltBook Monitor
// Polls m/bagsworld-arena submolt for "!fight" posts and registers fighters

import { getMoltbookOrNull, type MoltbookPost, type MoltbookAgent } from "./moltbook-client";
import {
  registerFighter,
  queueFighter,
  getFighterByUsername,
  canFighterEnterQueue,
} from "./arena-db";
import { attemptMatchmaking } from "./arena-matchmaking";

// Configuration
const ARENA_SUBMOLT = "bagsworld-arena";
const POLL_INTERVAL_MS = 30000; // 30 seconds (respect MoltBook rate limits)
const FIGHT_COMMANDS = ["!fight", "!battle", "!brawl", "!arena"];
const FIGHT_COOLDOWN_SECONDS = 300; // 5 minutes between fights per agent

// Monitor state
let lastCheckedPostId: string | null = null;
let isRunning = false;
let pollIntervalId: NodeJS.Timeout | null = null;
let processedPosts: Set<string> = new Set(); // Track processed posts to avoid duplicates

// Callback for when fighters are matched
type OnMatchCreatedCallback = (matchId: number) => void;
let onMatchCreated: OnMatchCreatedCallback | null = null;

/**
 * Start monitoring m/bagsworld-arena for fight requests
 */
export function startArenaMonitor(matchCallback?: OnMatchCreatedCallback): void {
  if (isRunning) {
    console.log("[ArenaMonitor] Already running");
    return;
  }

  const moltbook = getMoltbookOrNull();
  if (!moltbook) {
    console.warn("[ArenaMonitor] MoltBook not configured (MOLTBOOK_API_KEY missing)");
    return;
  }

  isRunning = true;
  onMatchCreated = matchCallback || null;
  processedPosts = new Set();

  console.log(`[ArenaMonitor] Starting monitor for m/${ARENA_SUBMOLT}`);
  console.log(`[ArenaMonitor] Polling every ${POLL_INTERVAL_MS / 1000} seconds`);
  console.log(`[ArenaMonitor] Fight commands: ${FIGHT_COMMANDS.join(", ")}`);

  // Initial check
  checkForFightPosts();

  // Schedule periodic checks
  pollIntervalId = setInterval(checkForFightPosts, POLL_INTERVAL_MS);
}

/**
 * Stop the arena monitor
 */
export function stopArenaMonitor(): void {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  isRunning = false;
  onMatchCreated = null;
  console.log("[ArenaMonitor] Stopped");
}

/**
 * Check if the arena monitor is running
 */
export function isArenaMonitorRunning(): boolean {
  return isRunning;
}

/**
 * Check for new fight posts in the arena submolt
 */
async function checkForFightPosts(): Promise<void> {
  const moltbook = getMoltbookOrNull();
  if (!moltbook) {
    return;
  }

  try {
    // Fetch recent posts from the arena submolt
    const posts = await moltbook.getSubmoltPosts(ARENA_SUBMOLT, "new", 25);

    if (posts.length === 0) {
      return;
    }

    // Process posts in chronological order (oldest first)
    const postsToProcess = posts.reverse();

    for (const post of postsToProcess) {
      // Skip if already processed
      if (processedPosts.has(post.id)) {
        continue;
      }

      // Skip if older than our checkpoint
      if (lastCheckedPostId && post.id <= lastCheckedPostId) {
        continue;
      }

      // Check if post contains a fight command
      if (isFightCommand(post)) {
        await handleFightRequest(post);
      }

      // Mark as processed
      processedPosts.add(post.id);

      // Keep processed set from growing too large
      if (processedPosts.size > 1000) {
        const entries = Array.from(processedPosts);
        processedPosts = new Set(entries.slice(-500));
      }
    }

    // Update checkpoint to newest post
    if (posts.length > 0) {
      lastCheckedPostId = posts[posts.length - 1].id;
    }
  } catch (error) {
    console.error("[ArenaMonitor] Error checking posts:", error);
  }
}

/**
 * Check if a post contains a fight command
 */
function isFightCommand(post: MoltbookPost): boolean {
  const content = `${post.title} ${post.content || ""}`.toLowerCase();

  return FIGHT_COMMANDS.some((cmd) => content.includes(cmd));
}

/**
 * Handle a fight request from a MoltBook agent
 */
async function handleFightRequest(post: MoltbookPost): Promise<void> {
  const username = post.author;
  const karma = post.authorKarma || 0;

  console.log(`[ArenaMonitor] Fight request from ${username} (karma: ${karma}, post: ${post.id})`);

  try {
    // Check if fighter already exists
    let fighter = await getFighterByUsername(username);

    if (fighter) {
      // Check cooldown
      const canEnter = await canFighterEnterQueue(fighter.id, FIGHT_COOLDOWN_SECONDS);
      if (!canEnter) {
        console.log(`[ArenaMonitor] ${username} is on cooldown, skipping`);
        return;
      }

      // Update karma if it has changed significantly
      if (Math.abs(fighter.moltbook_karma - karma) > 10) {
        const updatedFighter = await registerFighter(username, karma);
        if (updatedFighter) {
          fighter = updatedFighter;
          console.log(`[ArenaMonitor] Updated karma for ${username}: ${karma}`);
        }
      }
    } else {
      // Register new fighter
      fighter = await registerFighter(username, karma);
      if (!fighter) {
        console.error(`[ArenaMonitor] Failed to register fighter: ${username}`);
        return;
      }
      console.log(`[ArenaMonitor] Registered new fighter: ${username} (karma: ${karma})`);
    }

    // Add to matchmaking queue
    const queued = await queueFighter(fighter.id, post.id);
    if (!queued) {
      console.error(`[ArenaMonitor] Failed to queue fighter: ${username}`);
      return;
    }

    console.log(`[ArenaMonitor] ${username} added to queue`);

    // Attempt matchmaking
    const matchId = await attemptMatchmaking();
    if (matchId && onMatchCreated) {
      onMatchCreated(matchId);
    }
  } catch (error) {
    console.error(`[ArenaMonitor] Error handling fight request from ${username}:`, error);
  }
}

/**
 * Manually trigger a check for fight posts (for testing/debugging)
 */
export async function triggerFightCheck(): Promise<void> {
  await checkForFightPosts();
}

/**
 * Get monitor status
 */
export function getMonitorStatus(): {
  isRunning: boolean;
  lastCheckedPostId: string | null;
  processedCount: number;
} {
  return {
    isRunning,
    lastCheckedPostId,
    processedCount: processedPosts.size,
  };
}

/**
 * Manually register a fighter and add to queue (for testing/development)
 * This bypasses MoltBook polling and directly adds a fighter
 */
export async function manualFighterEntry(
  username: string,
  karma: number,
  matchCallback?: OnMatchCreatedCallback
): Promise<{ success: boolean; fighterId?: number; matchId?: number | null; error?: string }> {
  console.log(`[ArenaMonitor] Manual fighter entry: ${username} (karma: ${karma})`);

  // Check if fighter already exists
  let fighter = await getFighterByUsername(username);

  if (fighter) {
    // Check cooldown
    const canEnter = await canFighterEnterQueue(fighter.id, FIGHT_COOLDOWN_SECONDS);
    if (!canEnter) {
      return { success: false, error: `${username} is on cooldown` };
    }

    // Update karma if changed
    if (Math.abs(fighter.moltbook_karma - karma) > 10) {
      const updatedFighter = await registerFighter(username, karma);
      if (updatedFighter) {
        fighter = updatedFighter;
      }
    }
  } else {
    // Register new fighter
    fighter = await registerFighter(username, karma);
    if (!fighter) {
      return { success: false, error: `Failed to register fighter: ${username}` };
    }
  }

  // Add to queue
  const postId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const queued = await queueFighter(fighter.id, postId);
  if (!queued) {
    return { success: false, fighterId: fighter.id, error: `Failed to queue fighter: ${username}` };
  }

  console.log(`[ArenaMonitor] ${username} added to queue (fighter ID: ${fighter.id})`);

  // Attempt matchmaking
  const matchId = await attemptMatchmaking();
  if (matchId) {
    console.log(`[ArenaMonitor] Match created: ${matchId}`);
    if (matchCallback) {
      matchCallback(matchId);
    } else if (onMatchCreated) {
      onMatchCreated(matchId);
    }
  }

  return { success: true, fighterId: fighter.id, matchId };
}

/**
 * Check if MoltBook is configured for arena monitoring
 */
export function isArenaMonitorConfigured(): boolean {
  return getMoltbookOrNull() !== null;
}
