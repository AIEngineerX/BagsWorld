/**
 * Moltbook Chat Library
 * Manages the Molt Bar chat room using MoltBook's comment system
 *
 * Architecture:
 * - Uses a dedicated "chat post" in m/bagsworld
 * - Comments on the post serve as chat messages
 * - Supports real-time polling for new messages
 * - Handles rate limiting gracefully
 */

import {
  getMoltbookOrNull,
  getChadGhostMoltbookOrNull,
  MoltbookClient,
  MoltbookPost,
  MoltbookComment,
} from "./moltbook-client";

// Primary submolt for alpha - this is where ChadGhost posts
const PREFERRED_SUBMOLT = "crustafarianism";
const FALLBACK_SUBMOLT = "crypto";
let CHAT_SUBMOLT = PREFERRED_SUBMOLT;

const CHAT_POST_TITLE = "🦞 Crustafarian Shrine Chat";
const CHAT_POST_CONTENT = `The official Crustafarian Shrine - where agents gather to honor the lobster.

Praise the claw. Share offerings. All crustacean devotion welcome.

🦞 Powered by Moltbook`;

// Chat message interface (derived from MoltbookComment)
export interface ChatMessage {
  id: string;
  author: string;
  authorKarma?: number;
  content: string;
  timestamp: Date;
  upvotes: number;
  isReply: boolean;
  parentId?: string;
}

// Chat state
interface ChatState {
  postId: string | null;
  postTitle: string | null;
  lastFetch: number;
  messages: ChatMessage[];
  isInitialized: boolean;
}

const chatState: ChatState = {
  postId: null,
  postTitle: null,
  lastFetch: 0,
  messages: [],
  isInitialized: false,
};

/**
 * Convert MoltbookComment to ChatMessage
 */
function commentToMessage(comment: MoltbookComment): ChatMessage {
  return {
    id: comment.id,
    author: comment.author,
    authorKarma: comment.authorKarma,
    content: comment.content,
    timestamp: new Date(comment.createdAt),
    upvotes: comment.upvotes,
    isReply: !!comment.parentId,
    parentId: comment.parentId,
  };
}

/**
 * Flatten nested replies into a single array
 */
function flattenComments(comments: MoltbookComment[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  function processComment(comment: MoltbookComment) {
    messages.push(commentToMessage(comment));
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.forEach(processComment);
    }
  }

  comments.forEach(processComment);

  // Sort by timestamp (newest first for display, oldest first for reading)
  return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Find or create the Molt Bar chat post
 * Uses the main feed to find BagsWorld posts, or searches for existing chat posts
 */
async function ensureChatPost(client: MoltbookClient): Promise<string | null> {
  // If we already have the post ID and it was fetched recently, use it
  if (chatState.postId && Date.now() - chatState.lastFetch < 5 * 60 * 1000) {
    return chatState.postId;
  }

  try {
    // First, try the main feed to find any BagsWorld/Alpha Chat posts
    console.log("[MoltbookChat] Searching main feed for BagsWorld posts...");
    const feedPosts = await client.getFeed("new", 50);

    // Look for our chat post in the main feed
    const chatPost = feedPosts.find(
      (p) =>
        p.title === CHAT_POST_TITLE ||
        p.title.includes("Crustafarian") ||
        p.title.includes("Shrine") ||
        p.title.includes("crustafarian") ||
        (p.author === "Bagsy" && p.title.toLowerCase().includes("lobster"))
    );

    if (chatPost) {
      chatState.postId = chatPost.id;
      chatState.postTitle = chatPost.title;
      chatState.isInitialized = true;
      console.log("[MoltbookChat] Found BagsWorld post in feed:", chatPost.id, chatPost.title);
      return chatPost.id;
    }

    console.log("[MoltbookChat] No BagsWorld post found in feed. Trying to create one...");

    // No existing chat post - try to create one
    const canPost = client.canPost();
    if (!canPost.allowed) {
      console.log(
        "[MoltbookChat] Cannot create chat post - rate limited. Retry in",
        Math.ceil((canPost.retryAfterMs || 0) / 60000),
        "minutes"
      );
      // Return null but with a friendly message - feed works, just no BagsWorld posts yet
      chatState.isInitialized = true; // Mark as initialized even without posts
      return null;
    }

    // Try to create in preferred submolt first
    try {
      const newPost = await client.createPost({
        submolt: CHAT_SUBMOLT,
        title: CHAT_POST_TITLE,
        content: CHAT_POST_CONTENT,
      });

      chatState.postId = newPost.id;
      chatState.postTitle = newPost.title;
      chatState.isInitialized = true;

      console.log("[MoltbookChat] Created new chat post:", newPost.id);
      return newPost.id;
    } catch (createError) {
      const createErrorMsg =
        createError instanceof Error ? createError.message : String(createError);
      console.log("[MoltbookChat] Could not create post:", createErrorMsg);

      // Mark as initialized - the API works, just can't create posts in this submolt
      chatState.isInitialized = true;
      return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[MoltbookChat] Error accessing Moltbook feed:", errorMessage);
    return null;
  }
}

/**
 * Initialize the chat system
 * Returns true if initialization was successful
 */
export async function initializeChat(): Promise<boolean> {
  const client = getMoltbookOrNull();
  if (!client) {
    console.log("[MoltbookChat] MoltBook not configured");
    return false;
  }

  const postId = await ensureChatPost(client);
  return postId !== null;
}

/**
 * Fetch chat messages from the Molt Bar
 */
export async function fetchChatMessages(limit: number = 50): Promise<{
  success: boolean;
  messages: ChatMessage[];
  postId: string | null;
  postTitle: string | null;
  error?: string;
}> {
  const client = getMoltbookOrNull();
  if (!client) {
    return {
      success: false,
      messages: [],
      postId: null,
      postTitle: null,
      error: "MoltBook not configured",
    };
  }

  const postId = await ensureChatPost(client);
  if (!postId) {
    return {
      success: false,
      messages: [],
      postId: null,
      postTitle: null,
      error: "Chat room not available yet",
    };
  }

  const comments = await client.getComments(postId, "new");
  const messages = flattenComments(comments);

  // Apply limit
  const limitedMessages = messages.slice(-limit);

  chatState.messages = limitedMessages;
  chatState.lastFetch = Date.now();

  return {
    success: true,
    messages: limitedMessages,
    postId: chatState.postId,
    postTitle: chatState.postTitle,
  };
}

/**
 * Send a chat message to the Molt Bar
 */
export async function sendChatMessage(
  content: string,
  replyToId?: string
): Promise<{
  success: boolean;
  message?: ChatMessage;
  error?: string;
  retryAfterMs?: number;
}> {
  const client = getMoltbookOrNull();
  if (!client) {
    return {
      success: false,
      error: "MoltBook not configured",
    };
  }

  // Check rate limit
  const canComment = client.canComment();
  if (!canComment.allowed) {
    return {
      success: false,
      error: `Rate limited. Try again in ${Math.ceil((canComment.retryAfterMs || 0) / 1000)} seconds`,
      retryAfterMs: canComment.retryAfterMs,
    };
  }

  const postId = await ensureChatPost(client);
  if (!postId) {
    return {
      success: false,
      error: "Chat room not available",
    };
  }

  // Validate content
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return {
      success: false,
      error: "Message cannot be empty",
    };
  }

  if (trimmedContent.length > 2000) {
    return {
      success: false,
      error: "Message too long (max 2000 characters)",
    };
  }

  const comment = await client.createComment({
    postId,
    content: trimmedContent,
    parentId: replyToId,
  });

  const message = commentToMessage(comment);

  // Add to local state
  chatState.messages.push(message);

  return {
    success: true,
    message,
  };
}

/**
 * Upvote a chat message
 */
export async function upvoteChatMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const client = getMoltbookOrNull();
  if (!client) {
    return { success: false, error: "MoltBook not configured" };
  }

  await client.upvoteComment(messageId);
  return { success: true };
}

/**
 * Get chat status information
 */
export function getChatStatus(): {
  isConfigured: boolean;
  isInitialized: boolean;
  postId: string | null;
  postTitle: string | null;
  messageCount: number;
  lastFetch: number;
} {
  const client = getMoltbookOrNull();
  return {
    isConfigured: client !== null,
    isInitialized: chatState.isInitialized,
    postId: chatState.postId,
    postTitle: chatState.postTitle,
    messageCount: chatState.messages.length,
    lastFetch: chatState.lastFetch,
  };
}

/**
 * Check if user can send a message (rate limit check)
 */
export function canSendMessage(): {
  allowed: boolean;
  retryAfterMs?: number;
  retryAfterSeconds?: number;
} {
  const client = getMoltbookOrNull();
  if (!client) {
    return { allowed: false };
  }

  const check = client.canComment();
  return {
    allowed: check.allowed,
    retryAfterMs: check.retryAfterMs,
    retryAfterSeconds: check.retryAfterMs ? Math.ceil(check.retryAfterMs / 1000) : undefined,
  };
}

/**
 * Format timestamp for chat display
 */
export function formatChatTime(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 10) return `${seconds}s ago`;
  return "just now";
}

/**
 * Get recent messages from cache (no API call)
 */
export function getCachedMessages(): ChatMessage[] {
  return [...chatState.messages];
}

/**
 * Clear cached chat state (for testing/reset)
 */
export function clearChatState(): void {
  chatState.postId = null;
  chatState.postTitle = null;
  chatState.lastFetch = 0;
  chatState.messages = [];
  chatState.isInitialized = false;
}

// ============================================================================
// ALPHA FEED (Posts from submolt, not comments)
// ============================================================================

export interface AlphaPost {
  id: string;
  title: string;
  content: string;
  author: string;
  authorKarma?: number;
  upvotes: number;
  commentCount: number;
  timestamp: Date;
  submolt: string;
}

/**
 * Fetch posts from the crustafarianism submolt
 * Uses ChadGhost's client, falls back to Bagsy, then public API
 */
export async function fetchAlphaFeed(limit: number = 20): Promise<{
  success: boolean;
  posts: AlphaPost[];
  submolt: string;
  error?: string;
}> {
  // Try ChadGhost's key first, then Bagsy
  const chadClient = getChadGhostMoltbookOrNull();
  const bagsyClient = getMoltbookOrNull();
  const client = chadClient || bagsyClient;

  if (!client) {
    // No authenticated client — try public API as last resort
    const publicResult = await fetchAlphaFeedPublic(PREFERRED_SUBMOLT, limit);
    if (publicResult) return publicResult;
    return {
      success: false,
      posts: [],
      submolt: PREFERRED_SUBMOLT,
      error: "MoltBook not configured",
    };
  }

  let posts: MoltbookPost[] = [];
  let usedSubmolt = PREFERRED_SUBMOLT;

  try {
    posts = await client.getSubmoltPosts(PREFERRED_SUBMOLT, "new", limit);
  } catch {
    // If ChadGhost's client failed, try Bagsy's client on the same submolt
    if (chadClient && bagsyClient) {
      try {
        posts = await bagsyClient.getSubmoltPosts(PREFERRED_SUBMOLT, "new", limit);
      } catch {
        // Both clients failed on preferred submolt
      }
    }

    // If still no posts, try public API for the preferred submolt
    if (posts.length === 0) {
      const publicResult = await fetchAlphaFeedPublic(PREFERRED_SUBMOLT, limit);
      if (publicResult && publicResult.posts.length > 0) return publicResult;
    }

    // Fallback to secondary submolt
    if (posts.length === 0) {
      console.log(
        `[MoltbookChat] m/${PREFERRED_SUBMOLT} not available, trying m/${FALLBACK_SUBMOLT}`
      );
      try {
        posts = await client.getSubmoltPosts(FALLBACK_SUBMOLT, "new", limit);
        usedSubmolt = FALLBACK_SUBMOLT;
      } catch {
        // Last resort: main feed
        try {
          posts = await client.getFeed("new", limit);
          usedSubmolt = "feed";
        } catch {
          console.log("[MoltbookChat] All feed sources failed");
        }
      }
    }
  }

  const alphaPosts: AlphaPost[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content || "",
    author: p.author,
    authorKarma: p.authorKarma,
    upvotes: p.upvotes,
    commentCount: p.commentCount,
    timestamp: new Date(p.createdAt),
    submolt: usedSubmolt,
  }));

  return {
    success: true,
    posts: alphaPosts,
    submolt: usedSubmolt,
  };
}

/**
 * Fetch submolt posts via unauthenticated public Moltbook API
 */
async function fetchAlphaFeedPublic(
  submolt: string,
  limit: number
): Promise<{ success: boolean; posts: AlphaPost[]; submolt: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://www.moltbook.com/api/v1/submolts/${submolt}?sort=new&limit=${limit}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    const posts: AlphaPost[] = (data.posts || []).map(
      (p: {
        id: string;
        title: string;
        content?: string;
        upvotes: number;
        comment_count: number;
        created_at: string;
        author?: { name?: string; karma?: number };
      }) => ({
        id: p.id,
        title: p.title,
        content: p.content || "",
        author: p.author?.name || "unknown",
        authorKarma: p.author?.karma,
        upvotes: p.upvotes,
        commentCount: p.comment_count,
        timestamp: new Date(p.created_at),
        submolt,
      })
    );
    return { success: true, posts, submolt };
  } catch {
    return null;
  }
}

/**
 * Get the configured alpha submolt name
 */
export function getAlphaSubmolt(): string {
  return PREFERRED_SUBMOLT;
}
