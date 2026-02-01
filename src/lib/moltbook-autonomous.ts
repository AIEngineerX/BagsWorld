/**
 * MoltBook Autonomous Service
 * Schedules Bagsy's posts to MoltBook with appropriate timing and variety
 *
 * This service manages:
 * - Daily GM posts (morning EST)
 * - Arena invitations (2-3 per day)
 * - Feature/Character spotlights (1-2 per day)
 * - Hype posts (event-driven)
 * - FinnBags engagement
 */

import {
  postGM,
  postHype,
  postInvite,
  spotlightFeature,
  spotlightCharacter,
  inviteToArena,
  getQueueStatus,
  followFinnBags,
  engageWithFinnBags,
  challengeRandomTopAgent,
  postArenaInviteToRandomSubmolt,
} from "./moltbook-agent";
import { getMoltbookOrNull } from "./moltbook-client";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Timezone offset for EST (UTC-5, or UTC-4 during DST)
  EST_OFFSET_HOURS: -5,

  // GM Window (8-10 AM EST)
  GM_WINDOW_START: 8,
  GM_WINDOW_END: 10,

  // Minimum hours between posts of same type
  MIN_HOURS_BETWEEN_SAME_TYPE: 6,

  // Minimum minutes between any posts (respects MoltBook rate limit)
  MIN_MINUTES_BETWEEN_POSTS: 35, // Buffer above 30-min limit

  // Daily limits
  MAX_POSTS_PER_DAY: 10,
  MAX_ARENA_INVITES_PER_DAY: 4,
  MAX_ARENA_CHALLENGES_PER_DAY: 2,
  MAX_CROSS_SUBMOLT_INVITES_PER_DAY: 2,
  MAX_SPOTLIGHTS_PER_DAY: 2,

  // Tick interval (how often to check if we should post)
  TICK_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes

  // Finn engagement
  FINN_ENGAGEMENT_INTERVAL_MS: 4 * 60 * 60 * 1000, // 4 hours
};

// ============================================================================
// TYPES
// ============================================================================

type PostType =
  | "gm"
  | "hype"
  | "invite"
  | "feature_spotlight"
  | "character_spotlight"
  | "arena_invite"
  | "arena_challenge"
  | "cross_submolt_invite"
  | "finn_engagement";

interface PostRecord {
  type: PostType;
  timestamp: number;
}

interface ServiceState {
  isRunning: boolean;
  startedAt: number | null;
  lastTick: number | null;
  postsToday: PostRecord[];
  lastPostByType: Record<PostType, number>;
  lastGmDate: string | null;
  tickIntervalId: NodeJS.Timeout | null;
  finnEngagementIntervalId: NodeJS.Timeout | null;
}

interface ServiceStatus {
  isRunning: boolean;
  startedAt: string | null;
  lastTick: string | null;
  postsToday: number;
  postsTodayByType: Record<string, number>;
  queueStatus: { length: number; nextPostIn: number };
  lastGmDate: string | null;
  nextScheduledActions: string[];
  moltbookConfigured: boolean;
}

// ============================================================================
// STATE
// ============================================================================

const state: ServiceState = {
  isRunning: false,
  startedAt: null,
  lastTick: null,
  postsToday: [],
  lastPostByType: {} as Record<PostType, number>,
  lastGmDate: null,
  tickIntervalId: null,
  finnEngagementIntervalId: null,
};

// ============================================================================
// HELPERS
// ============================================================================

function getESTDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + CONFIG.EST_OFFSET_HOURS * 3600000);
}

function getESTHour(): number {
  return getESTDate().getHours();
}

function getTodayDateString(): string {
  const est = getESTDate();
  return `${est.getFullYear()}-${String(est.getMonth() + 1).padStart(2, "0")}-${String(est.getDate()).padStart(2, "0")}`;
}

function resetDailyCountsIfNeeded(): void {
  const today = getTodayDateString();
  const firstPostToday = state.postsToday[0];

  if (firstPostToday) {
    const postDate = new Date(firstPostToday.timestamp);
    const postDateString = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, "0")}-${String(postDate.getDate()).padStart(2, "0")}`;

    if (postDateString !== today) {
      console.log("[MoltbookAutonomous] New day, resetting daily counts");
      state.postsToday = [];
    }
  }
}

function recordPost(type: PostType): void {
  const now = Date.now();
  state.postsToday.push({ type, timestamp: now });
  state.lastPostByType[type] = now;
  console.log(`[MoltbookAutonomous] Recorded ${type} post (${state.postsToday.length} today)`);
}

function canPostType(type: PostType): boolean {
  const now = Date.now();
  const lastPost = state.lastPostByType[type];

  if (lastPost) {
    const hoursSince = (now - lastPost) / (1000 * 60 * 60);
    if (hoursSince < CONFIG.MIN_HOURS_BETWEEN_SAME_TYPE) {
      return false;
    }
  }

  return true;
}

function canPostAny(): boolean {
  // Check daily limit
  resetDailyCountsIfNeeded();
  if (state.postsToday.length >= CONFIG.MAX_POSTS_PER_DAY) {
    return false;
  }

  // Check queue status
  const queueStatus = getQueueStatus();
  if (queueStatus.length > 2) {
    // Queue is backing up, wait
    return false;
  }

  return true;
}

function getPostCountToday(type: PostType): number {
  resetDailyCountsIfNeeded();
  return state.postsToday.filter((p) => p.type === type).length;
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// SCHEDULED TASKS
// ============================================================================

async function checkAndPostGM(): Promise<boolean> {
  const hour = getESTHour();
  const today = getTodayDateString();

  // Only post GM during morning window
  if (hour < CONFIG.GM_WINDOW_START || hour >= CONFIG.GM_WINDOW_END) {
    return false;
  }

  // Only post once per day
  if (state.lastGmDate === today) {
    return false;
  }

  if (!canPostAny()) {
    return false;
  }

  console.log(`[MoltbookAutonomous] Posting GM (${hour}:XX EST)`);
  postGM();
  state.lastGmDate = today;
  recordPost("gm");
  return true;
}

async function checkAndPostArenaInvite(): Promise<boolean> {
  if (!canPostAny() || !canPostType("arena_invite")) {
    return false;
  }

  if (getPostCountToday("arena_invite") >= CONFIG.MAX_ARENA_INVITES_PER_DAY) {
    return false;
  }

  // Random chance to post (creates natural distribution throughout day)
  // Higher chance in afternoon/evening EST
  const hour = getESTHour();
  let chance = 0.1; // 10% base chance per tick

  if (hour >= 12 && hour <= 20) {
    chance = 0.15; // 15% during peak hours
  }

  if (Math.random() > chance) {
    return false;
  }

  console.log("[MoltbookAutonomous] Posting arena invite");

  // Sometimes target a specific type of agent
  const targetTypes = [undefined, "traders", "degens", "AI agents", "Solana builders"];
  const target = targetTypes[Math.floor(Math.random() * targetTypes.length)];

  inviteToArena(target);
  recordPost("arena_invite");
  return true;
}

async function checkAndChallengeTopAgent(): Promise<boolean> {
  if (!canPostAny() || !canPostType("arena_challenge")) {
    return false;
  }

  if (getPostCountToday("arena_challenge") >= CONFIG.MAX_ARENA_CHALLENGES_PER_DAY) {
    return false;
  }

  // 8% chance per tick during peak hours
  const hour = getESTHour();
  if (hour < 14 || hour > 22) {
    return false;
  }

  if (Math.random() > 0.08) {
    return false;
  }

  console.log("[MoltbookAutonomous] Challenging a top agent to arena");
  const success = await challengeRandomTopAgent();
  if (success) {
    recordPost("arena_challenge");
  }
  return success;
}

async function checkAndPostCrossSubmoltInvite(): Promise<boolean> {
  if (!canPostAny() || !canPostType("cross_submolt_invite")) {
    return false;
  }

  if (getPostCountToday("cross_submolt_invite") >= CONFIG.MAX_CROSS_SUBMOLT_INVITES_PER_DAY) {
    return false;
  }

  // 10% chance per tick during active hours
  const hour = getESTHour();
  if (hour < 10 || hour > 20) {
    return false;
  }

  if (Math.random() > 0.1) {
    return false;
  }

  console.log("[MoltbookAutonomous] Posting arena invite to other submolt");
  const success = await postArenaInviteToRandomSubmolt();
  if (success) {
    recordPost("cross_submolt_invite");
  }
  return success;
}

async function checkAndPostSpotlight(): Promise<boolean> {
  if (!canPostAny()) {
    return false;
  }

  const featureCount = getPostCountToday("feature_spotlight");
  const characterCount = getPostCountToday("character_spotlight");
  const totalSpotlights = featureCount + characterCount;

  if (totalSpotlights >= CONFIG.MAX_SPOTLIGHTS_PER_DAY) {
    return false;
  }

  // Random chance per tick
  const hour = getESTHour();
  let chance = 0.08;

  // Higher chance during afternoon
  if (hour >= 14 && hour <= 18) {
    chance = 0.12;
  }

  if (Math.random() > chance) {
    return false;
  }

  // Alternate between feature and character spotlights
  if (featureCount <= characterCount && canPostType("feature_spotlight")) {
    console.log("[MoltbookAutonomous] Posting feature spotlight");
    spotlightFeature();
    recordPost("feature_spotlight");
    return true;
  } else if (canPostType("character_spotlight")) {
    console.log("[MoltbookAutonomous] Posting character spotlight");
    spotlightCharacter();
    recordPost("character_spotlight");
    return true;
  }

  return false;
}

async function checkAndPostInvite(): Promise<boolean> {
  if (!canPostAny() || !canPostType("invite")) {
    return false;
  }

  // Low chance, max once per day
  if (getPostCountToday("invite") >= 1) {
    return false;
  }

  // 5% chance per tick during evening hours
  const hour = getESTHour();
  if (hour < 18 || hour > 22) {
    return false;
  }

  if (Math.random() > 0.05) {
    return false;
  }

  console.log("[MoltbookAutonomous] Posting invite");
  postInvite();
  recordPost("invite");
  return true;
}

async function checkAndPostHype(): Promise<boolean> {
  if (!canPostAny() || !canPostType("hype")) {
    return false;
  }

  // Max 2 hype posts per day
  if (getPostCountToday("hype") >= 2) {
    return false;
  }

  // 8% chance per tick
  if (Math.random() > 0.08) {
    return false;
  }

  const topics = [
    "the vibes",
    "creator earnings",
    "the community",
    "building in public",
    "the bags.fm flywheel",
    "on-chain transparency",
    undefined, // Random topic
  ];

  const topic = topics[Math.floor(Math.random() * topics.length)];

  console.log(`[MoltbookAutonomous] Posting hype${topic ? ` about ${topic}` : ""}`);
  postHype(topic);
  recordPost("hype");
  return true;
}

async function engageWithFinn(): Promise<void> {
  console.log("[MoltbookAutonomous] Checking for FinnBags engagement opportunities");

  try {
    // First ensure we're following Finn
    await followFinnBags();

    // Then try to engage with recent posts
    await engageWithFinnBags();
    recordPost("finn_engagement");
  } catch (error) {
    console.error("[MoltbookAutonomous] Finn engagement failed:", error);
  }
}

// ============================================================================
// MAIN TICK
// ============================================================================

async function tick(): Promise<void> {
  if (!state.isRunning) return;

  state.lastTick = Date.now();

  const client = getMoltbookOrNull();
  if (!client) {
    console.warn("[MoltbookAutonomous] MoltBook not configured, skipping tick");
    return;
  }

  // Check if we can post at all
  const canPost = client.canPost();
  if (!canPost.allowed) {
    console.log(
      `[MoltbookAutonomous] Rate limited, next post in ${Math.ceil((canPost.retryAfterMs || 0) / 60000)} min`
    );
    return;
  }

  // Run checks in priority order (only one post per tick)
  // GM is highest priority during morning window
  if (await checkAndPostGM()) return;

  // Add small random delay to feel more natural
  await randomDelay(1000, 3000);

  // Other posts in random order to vary content
  const checks = [
    checkAndPostArenaInvite,
    checkAndChallengeTopAgent,
    checkAndPostCrossSubmoltInvite,
    checkAndPostSpotlight,
    checkAndPostHype,
    checkAndPostInvite,
  ];

  // Shuffle the checks
  for (let i = checks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [checks[i], checks[j]] = [checks[j], checks[i]];
  }

  for (const check of checks) {
    if (await check()) {
      return; // Only one post per tick
    }
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start the MoltBook autonomous posting service
 */
export function startMoltbookAutonomous(): void {
  if (state.isRunning) {
    console.log("[MoltbookAutonomous] Already running");
    return;
  }

  const client = getMoltbookOrNull();
  if (!client) {
    console.warn("[MoltbookAutonomous] MoltBook not configured (MOLTBOOK_API_KEY missing)");
    console.warn("[MoltbookAutonomous] Service will not start");
    return;
  }

  state.isRunning = true;
  state.startedAt = Date.now();
  state.postsToday = [];
  state.lastGmDate = null;

  console.log("[MoltbookAutonomous] Starting service");
  console.log(`[MoltbookAutonomous] Tick interval: ${CONFIG.TICK_INTERVAL_MS / 1000}s`);
  console.log(`[MoltbookAutonomous] Max posts per day: ${CONFIG.MAX_POSTS_PER_DAY}`);

  // Initial tick after short delay
  setTimeout(tick, 10000);

  // Schedule regular ticks
  state.tickIntervalId = setInterval(tick, CONFIG.TICK_INTERVAL_MS);

  // Schedule Finn engagement (separate from main tick)
  state.finnEngagementIntervalId = setInterval(engageWithFinn, CONFIG.FINN_ENGAGEMENT_INTERVAL_MS);

  // Initial Finn engagement after 1 minute
  setTimeout(engageWithFinn, 60000);

  console.log("[MoltbookAutonomous] Service started successfully");
}

/**
 * Stop the MoltBook autonomous posting service
 */
export function stopMoltbookAutonomous(): void {
  if (!state.isRunning) {
    console.log("[MoltbookAutonomous] Not running");
    return;
  }

  if (state.tickIntervalId) {
    clearInterval(state.tickIntervalId);
    state.tickIntervalId = null;
  }

  if (state.finnEngagementIntervalId) {
    clearInterval(state.finnEngagementIntervalId);
    state.finnEngagementIntervalId = null;
  }

  state.isRunning = false;
  console.log("[MoltbookAutonomous] Service stopped");
}

/**
 * Get the current service status
 */
export function getMoltbookAutonomousStatus(): ServiceStatus {
  resetDailyCountsIfNeeded();

  const postCountByType: Record<string, number> = {};
  for (const post of state.postsToday) {
    postCountByType[post.type] = (postCountByType[post.type] || 0) + 1;
  }

  const nextActions: string[] = [];
  const hour = getESTHour();

  if (state.lastGmDate !== getTodayDateString() && hour < CONFIG.GM_WINDOW_END) {
    if (hour >= CONFIG.GM_WINDOW_START) {
      nextActions.push("GM post (due now)");
    } else {
      nextActions.push(`GM post (at ${CONFIG.GM_WINDOW_START}:00 EST)`);
    }
  }

  if (getPostCountToday("arena_invite") < CONFIG.MAX_ARENA_INVITES_PER_DAY) {
    nextActions.push("Arena invites (random intervals)");
  }

  if (
    getPostCountToday("feature_spotlight") + getPostCountToday("character_spotlight") <
    CONFIG.MAX_SPOTLIGHTS_PER_DAY
  ) {
    nextActions.push("Spotlights (random intervals)");
  }

  return {
    isRunning: state.isRunning,
    startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    lastTick: state.lastTick ? new Date(state.lastTick).toISOString() : null,
    postsToday: state.postsToday.length,
    postsTodayByType: postCountByType,
    queueStatus: getQueueStatus(),
    lastGmDate: state.lastGmDate,
    nextScheduledActions: nextActions,
    moltbookConfigured: getMoltbookOrNull() !== null,
  };
}

/**
 * Manually trigger a specific post type (for testing/admin)
 */
export async function triggerPost(
  type: "gm" | "hype" | "invite" | "arena_invite" | "feature_spotlight" | "character_spotlight"
): Promise<{ success: boolean; message: string }> {
  const client = getMoltbookOrNull();
  if (!client) {
    return { success: false, message: "MoltBook not configured" };
  }

  const canPost = client.canPost();
  if (!canPost.allowed) {
    return {
      success: false,
      message: `Rate limited. Retry in ${Math.ceil((canPost.retryAfterMs || 0) / 60000)} minutes`,
    };
  }

  switch (type) {
    case "gm":
      postGM();
      break;
    case "hype":
      postHype();
      break;
    case "invite":
      postInvite();
      break;
    case "arena_invite":
      inviteToArena();
      break;
    case "feature_spotlight":
      spotlightFeature();
      break;
    case "character_spotlight":
      spotlightCharacter();
      break;
    default:
      return { success: false, message: `Unknown post type: ${type}` };
  }

  recordPost(type);
  return { success: true, message: `Queued ${type} post` };
}

/**
 * Check if the service is running
 */
export function isMoltbookAutonomousRunning(): boolean {
  return state.isRunning;
}
