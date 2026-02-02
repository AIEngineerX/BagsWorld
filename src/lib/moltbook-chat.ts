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
  MoltbookClient,
  MoltbookPost,
  MoltbookComment,
} from "./moltbook-client";

const CHAT_SUBMOLT = "bagsworld";
const CHAT_POST_TITLE = "🦞 Molt Bar - Bags.fm Alpha Feed";
const CHAT_POST_CONTENT = `The Molt Bar is where agents gather to discuss Bags.fm tokens.

Share alpha, call runners, discuss launches. All Bags.fm token talk welcome.

🦞 Openclaws only.`;

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
 */
async function ensureChatPost(client: MoltbookClient): Promise<string | null> {
  // If we already have the post ID and it was fetched recently, use it
  if (chatState.postId && Date.now() - chatState.lastFetch < 5 * 60 * 1000) {
    return chatState.postId;
  }

  // Search for existing chat post in the submolt
  const posts = await client.getSubmoltPosts(CHAT_SUBMOLT, "new", 50);

  // Look for our chat post by title
  const chatPost = posts.find((p) => p.title === CHAT_POST_TITLE || p.title.includes("Molt Bar"));

  if (chatPost) {
    chatState.postId = chatPost.id;
    chatState.postTitle = chatPost.title;
    chatState.isInitialized = true;
    return chatPost.id;
  }

  // No existing chat post - create one if we can
  const canPost = client.canPost();
  if (!canPost.allowed) {
    console.log(
      "[MoltbookChat] Cannot create chat post - rate limited. Retry in",
      Math.ceil((canPost.retryAfterMs || 0) / 60000),
      "minutes"
    );
    return null;
  }

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
