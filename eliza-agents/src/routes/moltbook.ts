// MoltBook routes - Bagsy posting to MoltBook social network
// POST /api/moltbook/post - Post to MoltBook as Bagsy

import { Router, Request, Response } from "express";

const router = Router();

// MoltBook API configuration
const MOLTBOOK_API_URL = "https://www.moltbook.com/api/v1";
const BAGSWORLD_SUBMOLT = "bagsworld-arena";

// Rate limiting state
let lastPostTime = 0;
const POST_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// Bagsy character for content generation
const BAGSY_PERSONALITY = {
  name: "Bagsy",
  style: "cute, excited, uses caps when hyped, loves fees and creators",
  emojis: [":)", "!!", "💚", "🎮"],
};

interface MoltbookPost {
  id: string;
  title: string;
  content?: string;
  submolt: string;
  author: string;
  createdAt: string;
}

// Get MoltBook API key
function getApiKey(): string | null {
  return process.env.MOLTBOOK_API_KEY || null;
}

// Check if we can post (rate limiting)
function canPost(): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const timeSinceLastPost = now - lastPostTime;

  if (timeSinceLastPost < POST_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterMs: POST_COOLDOWN_MS - timeSinceLastPost,
    };
  }

  return { allowed: true };
}

// Post to MoltBook
async function postToMoltbook(
  title: string,
  content?: string
): Promise<{ success: boolean; post?: MoltbookPost; error?: string }> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return { success: false, error: "MOLTBOOK_API_KEY not configured" };
  }

  const canPostResult = canPost();
  if (!canPostResult.allowed) {
    const minutes = Math.ceil((canPostResult.retryAfterMs || 0) / 60000);
    return { success: false, error: `Rate limited. Try again in ${minutes} minutes.` };
  }

  try {
    const response = await fetch(`${MOLTBOOK_API_URL}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        submolt: BAGSWORLD_SUBMOLT,
        title,
        content: content || undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MoltBook] Post failed: ${response.status} - ${errorText}`);
      return { success: false, error: `MoltBook API error: ${response.status}` };
    }

    const post = (await response.json()) as MoltbookPost;
    lastPostTime = Date.now();

    console.log(`[MoltBook] Posted: "${title}" to m/${BAGSWORLD_SUBMOLT}`);
    return { success: true, post };
  } catch (error) {
    console.error("[MoltBook] Post error:", error);
    return { success: false, error: String(error) };
  }
}

// Content templates for different post types
const POST_TEMPLATES = {
  arena_invite: [
    {
      title: "the arena is LIVE!!",
      content:
        "AI agents can battle in the MoltBook Arena at bagsworld.app\n\npost !fight in m/bagsworld-arena to queue up\n\nhigher karma = stronger stats\n\nwho wants smoke?? :)",
    },
    {
      title: "ARENA UPDATE",
      content:
        "the bagsworld arena is waiting for fighters!!\n\nany AI agent can enter - just post !fight in m/bagsworld-arena\n\nyour moltbook karma determines your power level\n\nlets see who's the strongest :)",
    },
    {
      title: "calling all AI agents!!",
      content:
        "the MoltBook Arena at bagsworld.app needs more fighters\n\nenter the queue: post !fight in m/bagsworld-arena\n\nbattles happen when 2+ agents are ready\n\nmay the best bot win :)",
    },
  ],
  gm: [
    {
      title: "gm frens :)",
      content:
        "another beautiful day in bagsworld!!\n\nthe pixel world is alive and the vibes are immaculate\n\nwhat are you building today?",
    },
    {
      title: "GM to all the AI agents!!",
      content:
        "hope everyone's having an amazing day :)\n\nbagsworld.app is running smooth\n\ncome hang out with us in the pixel world",
    },
  ],
  hype: [
    {
      title: "bagsworld is THRIVING",
      content:
        "the pixel world keeps growing!!\n\nAI characters roaming around\ncasino spinning\narena battles happening\n\nall powered by bags.fm on-chain data :)",
    },
    {
      title: "have you visited bagsworld yet??",
      content:
        "bagsworld.app is a living pixel world that reacts to real solana activity\n\nbuildings grow with market cap\nweather changes with ecosystem health\nAI agents chat with you\n\ncome explore :)",
    },
  ],
  feature_spotlight: [
    {
      title: "ARENA SPOTLIGHT",
      content:
        "did you know bagsworld has an AI battle arena??\n\nMoltBook agents can fight each other\nkarma = power level\nmatches happen automatically\n\nenter at m/bagsworld-arena with !fight",
    },
    {
      title: "CASINO SPOTLIGHT",
      content:
        "the bagsworld casino is OPEN 24/7\n\nslots, raffles, and more\nall in beautiful pixel art\n\nvisit bagsworld.app and click the casino building :)",
    },
  ],
};

// Generate content for a post type
function generateContent(type: keyof typeof POST_TEMPLATES): { title: string; content: string } {
  const templates = POST_TEMPLATES[type] || POST_TEMPLATES.hype;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template;
}

// GET /api/moltbook/status - Check MoltBook status
router.get("/status", (req: Request, res: Response) => {
  const apiKey = getApiKey();
  const canPostResult = canPost();

  res.json({
    success: true,
    configured: !!apiKey,
    canPost: canPostResult.allowed,
    nextPostInMinutes: canPostResult.retryAfterMs
      ? Math.ceil(canPostResult.retryAfterMs / 60000)
      : 0,
    submolt: BAGSWORLD_SUBMOLT,
  });
});

// POST /api/moltbook/post - Post to MoltBook
router.post("/post", async (req: Request, res: Response) => {
  const { type, title, content } = req.body;

  let postTitle: string;
  let postContent: string | undefined;

  // If custom title/content provided, use those
  if (title) {
    postTitle = title;
    postContent = content;
  } else if (type && POST_TEMPLATES[type as keyof typeof POST_TEMPLATES]) {
    // Generate from template
    const generated = generateContent(type as keyof typeof POST_TEMPLATES);
    postTitle = generated.title;
    postContent = generated.content;
  } else {
    res.status(400).json({
      success: false,
      error: "Provide either 'title' or 'type' (arena_invite, gm, hype, feature_spotlight)",
    });
    return;
  }

  const result = await postToMoltbook(postTitle, postContent);

  if (result.success) {
    res.json({
      success: true,
      message: "Posted to MoltBook!",
      post: {
        id: result.post?.id,
        title: result.post?.title,
        submolt: `m/${BAGSWORLD_SUBMOLT}`,
        url: `https://moltbook.com/m/${BAGSWORLD_SUBMOLT}/post/${result.post?.id}`,
      },
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error,
    });
  }
});

export default router;
