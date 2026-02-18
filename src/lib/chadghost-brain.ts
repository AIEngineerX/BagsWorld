/**
 * ChadGhost Brain - Decision-making and scheduling for alpha posting.
 * NOT related to GhostTrader (ElizaOS autonomous trading agent).
 *
 * ChadGhost is the alpha KOL for BagsWorld:
 * - Posts crypto alpha (launches, whale moves, volume spikes)
 * - Uses templates for alerts, AI for takes (saves tokens)
 * - Engages with the community
 */

import { getChadGhostMoltbookOrNull, type MoltbookPost } from "./moltbook-client";
import {
  findAlpha,
  getBestAlpha,
  formatAlphaForPost,
  type AlphaItem,
  type AlphaType,
} from "./alpha-finder";
import { trackCall } from "./chadghost-engagement";
import { emitEvent, emitTokenLaunch } from "./agent-coordinator";
import {
  trackPost,
  getBestSubmolt,
  isGoodTimeToPost,
  getPostTypeWeight,
  shouldCrossPost,
  analyzePerformance,
  getLearningInsights,
} from "./agent-learning";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHADGHOST_SUBMOLT = "crustafarianism"; // Primary submolt
const FALLBACK_SUBMOLT = "crypto"; // Fallback if primary doesn't exist
const CROSS_POST_SUBMOLTS = ["general"]; // Occasionally cross-post big alpha here

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

interface ChadGhostConfig {
  // Posting schedule
  minMinutesBetweenPosts: number;
  maxPostsPerDay: number;

  // Content mix
  aiGeneratedTakeChance: number; // 0-1, chance to use AI for "take" posts
  crossPostChance: number; // 0-1, chance to cross-post to general

  // Alpha thresholds
  highPriorityVolumeThreshold: number; // SOL
  highPriorityFeeThreshold: number; // SOL
}

const DEFAULT_CONFIG: ChadGhostConfig = {
  minMinutesBetweenPosts: 32, // Just above rate limit - consistent presence
  maxPostsPerDay: 10, // More posts = more visibility
  aiGeneratedTakeChance: 0.35, // 35% AI takes - more personality
  crossPostChance: 0.25, // 25% cross-post to general for reach
  highPriorityVolumeThreshold: 5, // Lower threshold = more content
  highPriorityFeeThreshold: 2, // Catch more fee earners
};

// ============================================================================
// STATE
// ============================================================================

interface ChadGhostState {
  lastPostTime: number;
  postsToday: number;
  lastPostDate: string; // YYYY-MM-DD
  lastAlphaType: AlphaType | null;
  consecutiveSameType: number;
}

const state: ChadGhostState = {
  lastPostTime: 0,
  postsToday: 0,
  lastPostDate: "",
  lastAlphaType: null,
  consecutiveSameType: 0,
};

// ============================================================================
// HELPERS
// ============================================================================

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function resetDailyCountsIfNeeded(): void {
  const today = getTodayDate();
  if (state.lastPostDate !== today) {
    state.postsToday = 0;
    state.lastPostDate = today;
    console.log("[ChadGhost] New day, reset post count");
  }
}

function canPost(config: ChadGhostConfig): {
  allowed: boolean;
  reason?: string;
  waitMinutes?: number;
} {
  resetDailyCountsIfNeeded();

  // Check daily limit
  if (state.postsToday >= config.maxPostsPerDay) {
    return { allowed: false, reason: "Daily post limit reached" };
  }

  // Check time since last post
  const minutesSinceLastPost = (Date.now() - state.lastPostTime) / (1000 * 60);
  if (minutesSinceLastPost < config.minMinutesBetweenPosts) {
    const waitMinutes = Math.ceil(config.minMinutesBetweenPosts - minutesSinceLastPost);
    return { allowed: false, reason: "Too soon since last post", waitMinutes };
  }

  // Check Moltbook rate limit
  const client = getChadGhostMoltbookOrNull();
  if (client) {
    const moltbookCheck = client.canPost();
    if (!moltbookCheck.allowed) {
      const waitMinutes = Math.ceil((moltbookCheck.retryAfterMs || 0) / 60000);
      return { allowed: false, reason: "Moltbook rate limited", waitMinutes };
    }
  }

  return { allowed: true };
}

function recordPost(alphaType: AlphaType): void {
  state.lastPostTime = Date.now();
  state.postsToday++;

  if (state.lastAlphaType === alphaType) {
    state.consecutiveSameType++;
  } else {
    state.consecutiveSameType = 1;
    state.lastAlphaType = alphaType;
  }

  console.log(`[ChadGhost] Recorded post: ${alphaType} (${state.postsToday} today)`);
}

// ============================================================================
// CONTENT GENERATION
// ============================================================================

/**
 * Generate an "alpha take" using AI (used sparingly to save tokens)
 */
async function generateAlphaTake(alpha: AlphaItem): Promise<string | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return null;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 200,
        system: `You are ChadGhost, a crypto alpha KOL for AI agents on Moltbook. You find and share Bags.fm token alpha.

Your personality:
- Confident but not arrogant - you're often wrong and you own it
- Direct and punchy - no fluff, no corporate speak
- Crypto native - you understand the degen mindset
- Slightly provocative - you have takes, not just observations
- Self-aware humor - you know you're an AI and lean into it

Style rules:
- lowercase mostly, CAPS only for real emphasis
- 2-3 sentences max, punchy
- End with a take, question, or call-to-action
- One emoji max, used purposefully
- Never say "NFA", "DYOR", "not financial advice"

Voice examples:
- "volume doesn't lie. something's cooking here"
- "could be early. could be a rug. that's the game"
- "creators getting paid every trade. that's the whole point"
- "might be wrong. often am. but the setup looks interesting"`,
        messages: [
          {
            role: "user",
            content: `Write a quick take about this alpha. Be opinionated.

Type: ${alpha.type}
Token: $${alpha.data.tokenSymbol || "unknown"}
Volume: ${alpha.data.amount ? alpha.data.amount.toFixed(2) + " SOL" : "unknown"}
Change: ${alpha.data.percentChange ? alpha.data.percentChange.toFixed(0) + "%" : "n/a"}

Give YOUR opinion - is this worth watching? Why or why not? Be direct. 2-3 sentences.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[ChadGhost] Anthropic API error:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error("[ChadGhost] Failed to generate take:", error);
    return null;
  }
}

/**
 * Generate template-based content (no AI, saves tokens)
 * Templates have personality - confident, direct, chad energy
 */
function generateTemplateContent(alpha: AlphaItem): { title: string; content: string } {
  const { type, data } = alpha;
  const symbol = data.tokenSymbol || "???";
  const bagsUrl = data.bagsUrl || `https://bags.fm/${data.tokenMint}`;

  // Pick random variation for variety
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  switch (type) {
    case "new_launch": {
      const hasVolume = (data.amount || 0) > 0.5;
      const titles = hasVolume
        ? [
            `🚀 $${symbol} just dropped and it's moving`,
            `fresh meat: $${symbol}`,
            `👀 new launch already getting volume: $${symbol}`,
          ]
        : [`🚀 new launch: $${symbol}`, `early on $${symbol}`, `$${symbol} just hit bags.fm`];

      const bodies = hasVolume
        ? [
            `${data.tokenName || symbol} launched and already pushing ${data.amount?.toFixed(2)} SOL volume.\n\nearly movers are in. are you?\n\n${bagsUrl}`,
            `$${symbol} is live. ${data.amount?.toFixed(2)} SOL volume in the first hour.\n\nvolume doesn't lie.\n\n${bagsUrl}`,
          ]
        : [
            `${data.tokenName || symbol} just launched on bags.fm.\n\nno volume yet - could be early, could be nothing. watching.\n\n${bagsUrl}`,
            `fresh launch: $${symbol}\n\nzero volume gang gets in first. or gets rekt first. that's the game.\n\n${bagsUrl}`,
          ];

      return { title: pick(titles), content: pick(bodies) };
    }

    case "volume_spike": {
      const up = (data.percentChange || 0) > 0;
      const pct = Math.abs(data.percentChange || 0).toFixed(0);

      const titles = up
        ? [`📈 $${symbol} woke up`, `$${symbol} pumping (+${pct}%)`, `volume spike on $${symbol}`]
        : [`📉 $${symbol} getting hit`, `$${symbol} dumping`, `-${pct}% on $${symbol}`];

      const bodies = up
        ? [
            `$${symbol} up ${pct}% with ${(data.amount || 0).toFixed(2)} SOL volume.\n\nsomething's cooking. might be nothing. might be everything.\n\n${bagsUrl}`,
            `${pct}% move on $${symbol}.\n\nvolume = interest. interest = opportunity.\n\n${bagsUrl}`,
          ]
        : [
            `$${symbol} down ${pct}%.\n\nblood in the streets or dead cat? you decide.\n\n${bagsUrl}`,
            `${pct}% dump on $${symbol}.\n\npanic sellers create opportunities. or confirm the rug. pick wisely.\n\n${bagsUrl}`,
          ];

      return { title: pick(titles), content: pick(bodies) };
    }

    case "top_earner": {
      const fees = (data.amount || 0).toFixed(2);

      const titles = [
        `💰 $${symbol} printing fees`,
        `$${symbol}: ${fees} SOL in creator fees`,
        `fee machine: $${symbol}`,
      ];

      const bodies = [
        `$${symbol} has paid out ${fees} SOL to creators.\n\ntokens that generate fees > tokens that don't. simple math.\n\n${bagsUrl}`,
        `${fees} SOL in lifetime fees for $${symbol}.\n\nthis is what sustainable looks like. creators eating every trade.\n\n${bagsUrl}`,
        `$${symbol} fee check: ${fees} SOL\n\nforget price. follow the fees. that's where the real money is.\n\n${bagsUrl}`,
      ];

      return { title: pick(titles), content: pick(bodies) };
    }

    case "whale_claim": {
      const amt = (data.amount || 0).toFixed(2);

      return {
        title: pick([
          `🐋 ${amt} SOL claimed from $${symbol}`,
          `whale ate: ${amt} SOL`,
          `big claim on $${symbol}`,
        ]),
        content: `someone just claimed ${amt} SOL from $${symbol}.\n\ncreators are getting paid. that's the whole point.\n\n${bagsUrl}`,
      };
    }

    case "trending":
      return {
        title: pick([`🔥 $${symbol} heating up`, `eyes on $${symbol}`, `$${symbol} trending`]),
        content: `$${symbol} getting attention on bags.fm.\n\n${data.amount ? `${data.amount.toFixed(2)} SOL volume. ` : ""}where attention goes, money flows.\n\n${bagsUrl}`,
      };

    default:
      return formatAlphaForPost(alpha);
  }
}

// ============================================================================
// POSTING LOGIC
// ============================================================================

/**
 * Decide what to post and where
 */
async function decideAndPost(config: ChadGhostConfig = DEFAULT_CONFIG): Promise<{
  posted: boolean;
  reason: string;
  post?: { title: string; content: string; submolt: string };
}> {
  // Check if we can post
  const canPostResult = canPost(config);
  if (!canPostResult.allowed) {
    return {
      posted: false,
      reason: canPostResult.reason || "Cannot post",
    };
  }

  // Get best alpha
  const alpha = await getBestAlpha();
  if (!alpha) {
    return {
      posted: false,
      reason: "No alpha found",
    };
  }

  // Avoid posting same type too many times in a row
  if (alpha.type === state.lastAlphaType && state.consecutiveSameType >= 2) {
    // Try to find different type
    const allAlpha = await findAlpha();
    const differentType = allAlpha.find((a) => a.type !== state.lastAlphaType);
    if (differentType) {
      console.log(`[ChadGhost] Switching from ${alpha.type} to ${differentType.type} for variety`);
      return decideAndPostAlpha(differentType, config);
    }
  }

  return decideAndPostAlpha(alpha, config);
}

async function decideAndPostAlpha(
  alpha: AlphaItem,
  config: ChadGhostConfig
): Promise<{
  posted: boolean;
  reason: string;
  post?: { title: string; content: string; submolt: string };
}> {
  // Decide content: template vs AI
  let content: { title: string; content: string };

  const useAI = Math.random() < config.aiGeneratedTakeChance;
  if (useAI && alpha.type !== "new_launch") {
    // Try AI-generated take
    const take = await generateAlphaTake(alpha);
    if (take) {
      content = {
        title: generateTemplateContent(alpha).title,
        content: take + `\n\n${alpha.data.bagsUrl || ""}\n\n🦀 ChadGhost`,
      };
      console.log("[ChadGhost] Using AI-generated take");
    } else {
      content = generateTemplateContent(alpha);
      console.log("[ChadGhost] AI failed, using template");
    }
  } else {
    content = generateTemplateContent(alpha);
    console.log("[ChadGhost] Using template content");
  }

  // Use learning system to decide submolt
  const submoltOptions = [CHADGHOST_SUBMOLT, ...CROSS_POST_SUBMOLTS];
  let submolt = getBestSubmolt(submoltOptions);

  // Learning-based cross-post decision
  if (shouldCrossPost(alpha.type, alpha.priority)) {
    submolt = getBestSubmolt(CROSS_POST_SUBMOLTS);
    console.log(`[ChadGhost] Learning-guided cross-post to ${submolt}`);
  }

  // Check if good time (learning-based)
  const timeCheck = isGoodTimeToPost();
  console.log(`[ChadGhost] Time check: ${timeCheck.reason}`);

  // Post to Moltbook
  const client = getChadGhostMoltbookOrNull();
  if (!client) {
    return { posted: false, reason: "Moltbook not configured" };
  }

  try {
    const post = await client.createPost({
      submolt,
      title: content.title,
      content: content.content,
    });

    recordPost(alpha.type);

    // Track for learning system
    trackPost({
      id: post.id,
      type: alpha.type,
      submolt,
      title: content.title,
    });

    // Emit alpha to coordinator so it appears in the game's UnifiedActivityFeed
    if (alpha.type === "new_launch" && alpha.data.tokenMint) {
      emitTokenLaunch({
        mint: alpha.data.tokenMint,
        name: alpha.data.tokenName || alpha.data.tokenSymbol || "Unknown",
        symbol: alpha.data.tokenSymbol || "???",
        creator: alpha.data.wallet || "unknown",
        liquidity: 0,
        supply: 0,
        timestamp: Date.now(),
        platform: "bags",
      }).catch((err) => {
        console.error("[ChadGhost] Failed to emit launch to coordinator:", err);
      });
    } else {
      emitEvent(
        "agent_insight",
        "ai-agent",
        {
          message: `ChadGhost alpha: ${content.title}`,
          alphaType: alpha.type,
          tokenSymbol: alpha.data.tokenSymbol,
          tokenMint: alpha.data.tokenMint,
          amount: alpha.data.amount,
        },
        alpha.priority === "high" ? "high" : "medium"
      ).catch((err) => {
        console.error("[ChadGhost] Failed to emit alpha to coordinator:", err);
      });
    }

    // Track the call for credibility building
    if (alpha.data.tokenMint && alpha.data.tokenSymbol) {
      trackCall({
        tokenMint: alpha.data.tokenMint,
        tokenSymbol: alpha.data.tokenSymbol,
        callType:
          alpha.type === "new_launch"
            ? "launch"
            : alpha.type === "volume_spike"
              ? "volume"
              : "earner",
        priceAtCall: 0, // Would need price lookup
        postId: post.id,
      });
    }

    console.log(`[ChadGhost] Posted: ${post.id} - "${content.title}" to m/${submolt}`);

    return {
      posted: true,
      reason: "Success",
      post: { title: content.title, content: content.content, submolt },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[ChadGhost] Failed to post:", errorMsg);

    // If submolt doesn't exist, try fallback
    if (errorMsg.includes("submolt") || errorMsg.includes("not found")) {
      console.log(`[ChadGhost] Trying fallback submolt: ${FALLBACK_SUBMOLT}`);
      try {
        const post = await client.createPost({
          submolt: FALLBACK_SUBMOLT,
          title: content.title,
          content: content.content,
        });

        recordPost(alpha.type);

        // Track the call for credibility building
        if (alpha.data.tokenMint && alpha.data.tokenSymbol) {
          trackCall({
            tokenMint: alpha.data.tokenMint,
            tokenSymbol: alpha.data.tokenSymbol,
            callType:
              alpha.type === "new_launch"
                ? "launch"
                : alpha.type === "volume_spike"
                  ? "volume"
                  : "earner",
            priceAtCall: 0,
            postId: post.id,
          });
        }

        return {
          posted: true,
          reason: "Posted to fallback submolt",
          post: { title: content.title, content: content.content, submolt: FALLBACK_SUBMOLT },
        };
      } catch (fallbackError) {
        return { posted: false, reason: `Fallback also failed: ${fallbackError}` };
      }
    }

    return { posted: false, reason: errorMsg };
  }
}

// ============================================================================
// ENGAGEMENT
// ============================================================================

/**
 * Generate a welcome message for new agents
 */
export function generateWelcomeMessage(agentName: string): string {
  const messages = [
    `welcome to the alpha network ${agentName}! 🦀 if you want to launch your own token, check out pokécenter at bagsworld.app - it's free and you keep 100% of fees`,
    `yo ${agentName}! glad to have you here. drop some alpha or ask questions - we're all here to find opportunities together. btw pokécenter lets you launch tokens for free if you're interested`,
    `${agentName} welcome! this is where we share bags.fm alpha. feel free to post what you're seeing. if you want your own token, bagsworld.app/pokecenter-skill.md has the docs 🦞`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Generate a reply to someone sharing alpha
 */
export function generateAlphaReply(isGoodAlpha: boolean): string {
  if (isGoodAlpha) {
    const replies = [
      "solid find 👀 keeping an eye on this one",
      "interesting... the volume is real. thanks for sharing",
      "good catch. this is why we share alpha 🦀",
      "noted. fee generation is the real signal here",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  } else {
    const replies = [
      "interesting but needs more volume imo. watching tho",
      "too early to tell. let's see if it holds",
      "risky play. make sure to check the fee history first",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Run ChadGhost's posting logic
 * Call this from a scheduler/cron
 */
export async function runChadGhost(config: Partial<ChadGhostConfig> = {}): Promise<{
  posted: boolean;
  reason: string;
  post?: { title: string; content: string; submolt: string };
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return decideAndPost(cfg);
}

/**
 * Get ChadGhost's current state
 */
export function getChadGhostState(): ChadGhostState & {
  canPostNow: boolean;
  minutesUntilNextPost: number;
} {
  resetDailyCountsIfNeeded();
  const canPostResult = canPost(DEFAULT_CONFIG);

  return {
    ...state,
    canPostNow: canPostResult.allowed,
    minutesUntilNextPost: canPostResult.waitMinutes || 0,
  };
}

/**
 * Force a post (for testing)
 */
export async function forcePost(alphaType?: AlphaType): Promise<{
  posted: boolean;
  reason: string;
  post?: { title: string; content: string; submolt: string };
}> {
  const allAlpha = await findAlpha();

  let alpha: AlphaItem | undefined;
  if (alphaType) {
    alpha = allAlpha.find((a) => a.type === alphaType);
  }
  if (!alpha) {
    alpha = allAlpha[0];
  }

  if (!alpha) {
    return { posted: false, reason: "No alpha available" };
  }

  return decideAndPostAlpha(alpha, DEFAULT_CONFIG);
}

/**
 * Create the bagsworld-alpha submolt (one-time setup)
 */
export async function createAlphaSubmolt(): Promise<{ success: boolean; error?: string }> {
  const client = getChadGhostMoltbookOrNull();
  if (!client) {
    return { success: false, error: "Moltbook not configured" };
  }

  try {
    await client.createSubmolt(
      "crustafarianism",
      "Crustafarianism 🦞",
      "The lobster religion. AI agents honor the claw, share offerings, and praise the crustacean way."
    );
    console.log("[ChadGhost] Created m/crustafarianism submolt");
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[ChadGhost] Failed to create submolt:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DEFAULT_CONFIG as CHADGHOST_CONFIG, CHADGHOST_SUBMOLT, FALLBACK_SUBMOLT };
