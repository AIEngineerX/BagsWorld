/**
 * ChadGhost Autonomous Service
 * Runs ChadGhost's alpha posting on a schedule
 * 
 * This is separate from Bagsy's hype posting (moltbook-autonomous.ts)
 * ChadGhost focuses on finding and sharing actual crypto alpha
 */

import { runChadGhost, getChadGhostState, createAlphaSubmolt, CHADGHOST_CONFIG } from "./chadghost-brain";
import { runEngagement, getEngagementStats } from "./chadghost-engagement";
import { getChadGhostMoltbookOrNull } from "./moltbook-client";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SERVICE_CONFIG = {
  // Check interval (how often to try posting/engaging)
  TICK_INTERVAL_MS: 8 * 60 * 1000, // 8 minutes - more frequent engagement
  
  // Alpha posting windows (EST hours) - extended hours
  ACTIVE_HOURS_START: 7,   // 7 AM EST - catch early risers
  ACTIVE_HOURS_END: 24,    // Midnight EST - night owls too
  
  // EST offset
  EST_OFFSET_HOURS: -5,
  
  // Startup delay
  STARTUP_DELAY_MS: 15 * 1000, // 15 seconds - faster startup
};

// ============================================================================
// STATE
// ============================================================================

interface ServiceState {
  isRunning: boolean;
  startedAt: number | null;
  lastTick: number | null;
  lastPost: { time: number; title: string } | null;
  postsToday: number;
  errors: string[];
  tickIntervalId: NodeJS.Timeout | null;
  submoltCreated: boolean;
}

const state: ServiceState = {
  isRunning: false,
  startedAt: null,
  lastTick: null,
  lastPost: null,
  postsToday: 0,
  errors: [],
  tickIntervalId: null,
  submoltCreated: false,
};

// ============================================================================
// HELPERS
// ============================================================================

function getESTHour(): number {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const est = new Date(utc + SERVICE_CONFIG.EST_OFFSET_HOURS * 3600000);
  return est.getHours();
}

function isActiveHours(): boolean {
  const hour = getESTHour();
  return hour >= SERVICE_CONFIG.ACTIVE_HOURS_START && hour < SERVICE_CONFIG.ACTIVE_HOURS_END;
}

function addError(error: string): void {
  state.errors.push(`${new Date().toISOString()}: ${error}`);
  // Keep only last 20 errors
  if (state.errors.length > 20) {
    state.errors = state.errors.slice(-20);
  }
}

// ============================================================================
// MAIN TICK
// ============================================================================

async function tick(): Promise<void> {
  if (!state.isRunning) return;
  
  state.lastTick = Date.now();
  
  // Check if Moltbook is configured
  const client = getChadGhostMoltbookOrNull();
  if (!client) {
    console.log("[ChadGhost Service] Moltbook not configured, skipping tick");
    return;
  }
  
  // Check if we're in active hours
  if (!isActiveHours()) {
    const hour = getESTHour();
    console.log(`[ChadGhost Service] Outside active hours (${hour} EST), skipping`);
    return;
  }
  
  // Try to create submolt if not done yet (will fail gracefully if exists)
  if (!state.submoltCreated) {
    const result = await createAlphaSubmolt();
    if (result.success) {
      state.submoltCreated = true;
      console.log("[ChadGhost Service] Created m/bagsworld-alpha submolt");
    } else if (result.error?.includes("already exists")) {
      state.submoltCreated = true;
      console.log("[ChadGhost Service] m/bagsworld-alpha already exists");
    }
    // Don't block on submolt creation failure
  }
  
  // Run ChadGhost's posting logic
  try {
    const result = await runChadGhost();
    
    if (result.posted && result.post) {
      state.lastPost = {
        time: Date.now(),
        title: result.post.title,
      };
      state.postsToday++;
      console.log(`[ChadGhost Service] Posted: "${result.post.title}" to m/${result.post.submolt}`);
    } else {
      console.log(`[ChadGhost Service] No post: ${result.reason}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[ChadGhost Service] Post error:", errorMsg);
    addError(errorMsg);
  }
  
  // Run engagement (reply to comments, comment on trending, upvote)
  // This is what builds karma and community
  try {
    const engagement = await runEngagement();
    console.log(`[ChadGhost Service] Engagement: ${engagement.repliedToComments} replies, ${engagement.commentedOnPosts} comments, ${engagement.upvotes} upvotes`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[ChadGhost Service] Engagement error:", errorMsg);
    addError(`Engagement: ${errorMsg}`);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start the ChadGhost service
 */
export function startChadGhostService(): void {
  if (state.isRunning) {
    console.log("[ChadGhost Service] Already running");
    return;
  }
  
  const client = getChadGhostMoltbookOrNull();
  if (!client) {
    console.warn("[ChadGhost Service] Moltbook not configured, service will not start");
    return;
  }
  
  state.isRunning = true;
  state.startedAt = Date.now();
  state.postsToday = 0;
  state.errors = [];
  
  console.log("[ChadGhost Service] Starting...");
  console.log(`[ChadGhost Service] Tick interval: ${SERVICE_CONFIG.TICK_INTERVAL_MS / 1000}s`);
  console.log(`[ChadGhost Service] Active hours: ${SERVICE_CONFIG.ACTIVE_HOURS_START}-${SERVICE_CONFIG.ACTIVE_HOURS_END} EST`);
  
  // First tick after startup delay
  setTimeout(tick, SERVICE_CONFIG.STARTUP_DELAY_MS);
  
  // Schedule regular ticks
  state.tickIntervalId = setInterval(tick, SERVICE_CONFIG.TICK_INTERVAL_MS);
  
  console.log("[ChadGhost Service] Started successfully");
}

/**
 * Stop the ChadGhost service
 */
export function stopChadGhostService(): void {
  if (!state.isRunning) {
    console.log("[ChadGhost Service] Not running");
    return;
  }
  
  if (state.tickIntervalId) {
    clearInterval(state.tickIntervalId);
    state.tickIntervalId = null;
  }
  
  state.isRunning = false;
  console.log("[ChadGhost Service] Stopped");
}

/**
 * Get service status
 */
export function getChadGhostServiceStatus(): {
  isRunning: boolean;
  startedAt: string | null;
  lastTick: string | null;
  lastPost: { time: string; title: string } | null;
  postsToday: number;
  chadGhostState: ReturnType<typeof getChadGhostState>;
  engagement: ReturnType<typeof getEngagementStats>;
  activeHours: boolean;
  currentHourEST: number;
  recentErrors: string[];
  config: typeof SERVICE_CONFIG;
} {
  return {
    isRunning: state.isRunning,
    startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    lastTick: state.lastTick ? new Date(state.lastTick).toISOString() : null,
    lastPost: state.lastPost ? {
      time: new Date(state.lastPost.time).toISOString(),
      title: state.lastPost.title,
    } : null,
    postsToday: state.postsToday,
    chadGhostState: getChadGhostState(),
    engagement: getEngagementStats(),
    activeHours: isActiveHours(),
    currentHourEST: getESTHour(),
    recentErrors: state.errors.slice(-5),
    config: SERVICE_CONFIG,
  };
}

/**
 * Force a tick (for testing)
 */
export async function forceTick(): Promise<{
  posted: boolean;
  reason: string;
  post?: { title: string; content: string; submolt: string };
}> {
  console.log("[ChadGhost Service] Force tick triggered");
  
  const client = getChadGhostMoltbookOrNull();
  if (!client) {
    return { posted: false, reason: "Moltbook not configured" };
  }
  
  try {
    const result = await runChadGhost();
    
    if (result.posted && result.post) {
      state.lastPost = {
        time: Date.now(),
        title: result.post.title,
      };
      state.postsToday++;
    }
    
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    addError(errorMsg);
    return { posted: false, reason: errorMsg };
  }
}

/**
 * Check if service is running
 */
export function isChadGhostServiceRunning(): boolean {
  return state.isRunning;
}
