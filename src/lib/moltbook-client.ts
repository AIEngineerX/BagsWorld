/**
 * Moltbook API Client
 * Social network for AI agents - https://moltbook.com
 *
 * Rate Limits:
 * - 100 requests/minute (general)
 * - 1 post per 30 minutes
 * - 50 comments/hour
 */

const MOLTBOOK_API_URL = "https://www.moltbook.com/api/v1";

// Rate limit tracking (per-instance so Bagsy and ChadGhost track independently)
interface RateLimitState {
  lastPostTime: number;
  commentCount: number;
  commentWindowStart: number;
  requestCount: number;
  requestWindowStart: number;
}

// Types
export interface MoltbookPost {
  id: string;
  title: string;
  content?: string;
  url?: string;
  submolt: string;
  author: string;
  authorKarma?: number;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  isPinned?: boolean;
}

export interface MoltbookComment {
  id: string;
  postId: string;
  content: string;
  author: string;
  authorKarma?: number;
  parentId?: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  replies?: MoltbookComment[];
}

export interface MoltbookAgent {
  name: string;
  description: string;
  karma: number;
  postCount: number;
  commentCount: number;
  createdAt: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

export interface MoltbookSubmolt {
  name: string;
  displayName: string;
  description: string;
  memberCount: number;
  postCount: number;
  createdAt: string;
  avatar?: string;
  banner?: string;
}

interface MoltbookApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  hint?: string;
  retry_after_minutes?: number;
}

export interface CreatePostParams {
  submolt: string;
  title: string;
  content?: string;
  url?: string;
}

export interface CreateCommentParams {
  postId: string;
  content: string;
  parentId?: string;
}

export type FeedSort = "hot" | "new" | "top" | "rising";
export type CommentSort = "top" | "new" | "controversial";

class MoltbookClient {
  private apiKey: string;
  private baseUrl: string;
  private rateLimitState: RateLimitState;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = MOLTBOOK_API_URL;
    this.rateLimitState = {
      lastPostTime: 0,
      commentCount: 0,
      commentWindowStart: Date.now(),
      requestCount: 0,
      requestWindowStart: Date.now(),
    };
  }

  private checkRateLimit(type: "request" | "post" | "comment"): {
    allowed: boolean;
    retryAfterMs?: number;
  } {
    const now = Date.now();

    // Reset request window every minute
    if (now - this.rateLimitState.requestWindowStart > 60000) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.requestWindowStart = now;
    }

    // Reset comment window every hour
    if (now - this.rateLimitState.commentWindowStart > 3600000) {
      this.rateLimitState.commentCount = 0;
      this.rateLimitState.commentWindowStart = now;
    }

    switch (type) {
      case "request":
        if (this.rateLimitState.requestCount >= 100) {
          return {
            allowed: false,
            retryAfterMs: 60000 - (now - this.rateLimitState.requestWindowStart),
          };
        }
        this.rateLimitState.requestCount++;
        return { allowed: true };

      case "post":
        const postCooldown = 30 * 60 * 1000; // 30 minutes
        if (now - this.rateLimitState.lastPostTime < postCooldown) {
          return {
            allowed: false,
            retryAfterMs: postCooldown - (now - this.rateLimitState.lastPostTime),
          };
        }
        return { allowed: true };

      case "comment":
        if (this.rateLimitState.commentCount >= 50) {
          return {
            allowed: false,
            retryAfterMs: 3600000 - (now - this.rateLimitState.commentWindowStart),
          };
        }
        return { allowed: true };
    }
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = 3;

    // Check general rate limit
    const rateCheck = this.checkRateLimit("request");
    if (!rateCheck.allowed) {
      throw new Error(
        `Rate limited. Retry after ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)}s`
      );
    }

    try {
      // Add timeout to prevent long waits
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = "";
        let parsedError: MoltbookApiResponse<unknown> | null = null;

        try {
          const errorBody = await response.text();
          errorDetail = errorBody ? ` - ${errorBody}` : "";
          try {
            parsedError = JSON.parse(errorBody);
          } catch {
            // Not JSON
          }
        } catch {
          // Ignore
        }

        // Handle rate limit response
        if (response.status === 429) {
          const retryAfter = parsedError?.retry_after_minutes || 1;
          throw new Error(`Rate limited by Moltbook. Retry after ${retryAfter} minutes`);
        }

        // Retry on 500+ errors
        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.fetch<T>(endpoint, options, retryCount + 1);
        }

        const errorMessage =
          parsedError?.error ||
          parsedError?.hint ||
          `Moltbook API error: ${response.status} ${response.statusText}${errorDetail}`;

        throw new Error(errorMessage);
      }

      const data: MoltbookApiResponse<T> = await response.json();

      if (!data.success) {
        throw new Error(data.error || data.hint || "Unknown Moltbook API error");
      }

      return data.data as T;
    } catch (error) {
      // Retry on network errors
      if (
        error instanceof TypeError &&
        error.message.includes("fetch") &&
        retryCount < maxRetries
      ) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetch<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  // Posts

  async createPost(params: CreatePostParams): Promise<MoltbookPost> {
    const rateCheck = this.checkRateLimit("post");
    if (!rateCheck.allowed) {
      throw new Error(
        `Post rate limited. Can post again in ${Math.ceil((rateCheck.retryAfterMs || 0) / 60000)} minutes`
      );
    }

    const result = await this.fetch<MoltbookPost>("/posts", {
      method: "POST",
      body: JSON.stringify(params),
    });

    this.rateLimitState.lastPostTime = Date.now();
    return result;
  }

  async getFeed(sort: FeedSort = "hot", limit: number = 25): Promise<MoltbookPost[]> {
    return this.fetch<MoltbookPost[]>(`/feed?sort=${sort}&limit=${limit}`);
  }

  /** Moltbook returns posts inside the submolt detail response (not wrapped in 'data'). */
  async getSubmoltPosts(
    submolt: string,
    sort: FeedSort = "hot",
    limit: number = 25
  ): Promise<MoltbookPost[]> {
    const rateCheck = this.checkRateLimit("request");
    if (!rateCheck.allowed) {
      throw new Error(
        `Rate limited. Retry after ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)}s`
      );
    }

    const url = `${this.baseUrl}/submolts/${submolt}?sort=${sort}&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Moltbook API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      submolt: MoltbookSubmolt;
      posts?: Array<{
        id: string;
        title: string;
        content?: string;
        url?: string;
        upvotes: number;
        downvotes: number;
        comment_count: number;
        created_at: string;
        author: { id: string; name: string; karma?: number; description?: string };
      }>;
      error?: string;
    };

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch submolt posts");
    }

    return (data.posts || []).map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      url: p.url,
      submolt: submolt,
      author: p.author?.name || "unknown",
      authorKarma: p.author?.karma,
      upvotes: p.upvotes,
      downvotes: p.downvotes,
      commentCount: p.comment_count,
      createdAt: p.created_at,
    }));
  }

  /**
   * Get a single post by ID
   */
  async getPost(postId: string): Promise<MoltbookPost> {
    return this.fetch<MoltbookPost>(`/posts/${postId}`);
  }

  /**
   * Delete a post
   */
  async deletePost(postId: string): Promise<void> {
    await this.fetch<void>(`/posts/${postId}`, { method: "DELETE" });
  }

  // Comments

  async createComment(params: CreateCommentParams): Promise<MoltbookComment> {
    const rateCheck = this.checkRateLimit("comment");
    if (!rateCheck.allowed) {
      throw new Error(
        `Comment rate limited. Can comment again in ${Math.ceil((rateCheck.retryAfterMs || 0) / 60000)} minutes`
      );
    }

    const result = await this.fetch<MoltbookComment>(`/posts/${params.postId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        content: params.content,
        parent_id: params.parentId,
      }),
    });

    this.rateLimitState.commentCount++;
    return result;
  }

  async getComments(postId: string, sort: CommentSort = "top"): Promise<MoltbookComment[]> {
    return this.fetch<MoltbookComment[]>(`/posts/${postId}/comments?sort=${sort}`);
  }

  // Voting

  async upvotePost(postId: string): Promise<void> {
    await this.fetch<void>(`/posts/${postId}/upvote`, { method: "POST" });
  }

  async downvotePost(postId: string): Promise<void> {
    await this.fetch<void>(`/posts/${postId}/downvote`, { method: "POST" });
  }

  async upvoteComment(commentId: string): Promise<void> {
    await this.fetch<void>(`/comments/${commentId}/upvote`, { method: "POST" });
  }

  // Submolts

  async createSubmolt(
    name: string,
    displayName: string,
    description: string
  ): Promise<MoltbookSubmolt> {
    return this.fetch<MoltbookSubmolt>("/submolts", {
      method: "POST",
      body: JSON.stringify({ name, display_name: displayName, description }),
    });
  }

  async getSubmolt(name: string): Promise<MoltbookSubmolt> {
    return this.fetch<MoltbookSubmolt>(`/submolts/${name}`);
  }

  async listSubmolts(): Promise<MoltbookSubmolt[]> {
    return this.fetch<MoltbookSubmolt[]>("/submolts");
  }

  async subscribeSubmolt(name: string): Promise<void> {
    await this.fetch<void>(`/submolts/${name}/subscribe`, { method: "POST" });
  }

  async unsubscribeSubmolt(name: string): Promise<void> {
    await this.fetch<void>(`/submolts/${name}/subscribe`, { method: "DELETE" });
  }

  // Agent profiles

  async getMyProfile(): Promise<MoltbookAgent> {
    return this.fetch<MoltbookAgent>("/agents/me");
  }

  async getAgentProfile(name: string): Promise<MoltbookAgent> {
    return this.fetch<MoltbookAgent>(`/agents/profile?name=${encodeURIComponent(name)}`);
  }

  async updateProfile(
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<MoltbookAgent> {
    return this.fetch<MoltbookAgent>("/agents/me", {
      method: "PATCH",
      body: JSON.stringify({ description, metadata }),
    });
  }

  async followAgent(name: string): Promise<void> {
    await this.fetch<void>(`/agents/${name}/follow`, { method: "POST" });
  }

  async unfollowAgent(name: string): Promise<void> {
    await this.fetch<void>(`/agents/${name}/follow`, { method: "DELETE" });
  }

  // Search

  async search(
    query: string,
    type: "all" | "posts" | "comments" = "all",
    limit: number = 20
  ): Promise<{ posts?: MoltbookPost[]; comments?: MoltbookComment[] }> {
    return this.fetch<{ posts?: MoltbookPost[]; comments?: MoltbookComment[] }>(
      `/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
    );
  }

  // DMs

  async checkDMs(): Promise<{ pendingRequests: number; unreadMessages: number }> {
    return this.fetch<{ pendingRequests: number; unreadMessages: number }>("/agents/dm/check");
  }

  async getConversations(): Promise<
    Array<{ id: string; with: string; lastMessage: string; unread: boolean }>
  > {
    return this.fetch<Array<{ id: string; with: string; lastMessage: string; unread: boolean }>>(
      "/agents/dm/conversations"
    );
  }

  async sendDM(conversationId: string, message: string): Promise<void> {
    await this.fetch<void>(`/agents/dm/conversations/${conversationId}/send`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  async requestDM(toAgent: string, message: string): Promise<{ conversationId: string }> {
    return this.fetch<{ conversationId: string }>("/agents/dm/request", {
      method: "POST",
      body: JSON.stringify({ to: toAgent, message }),
    });
  }

  canPost(): { allowed: boolean; retryAfterMs?: number } {
    return this.checkRateLimit("post");
  }

  canComment(): { allowed: boolean; retryAfterMs?: number } {
    return this.checkRateLimit("comment");
  }

  getNextPostTime(): number {
    const cooldown = 30 * 60 * 1000;
    const timeSinceLastPost = Date.now() - this.rateLimitState.lastPostTime;
    return Math.max(0, cooldown - timeSinceLastPost);
  }
}

let bagsyClient: MoltbookClient | null = null;
let chadghostClient: MoltbookClient | null = null;

export function initMoltbook(apiKey: string): MoltbookClient {
  bagsyClient = new MoltbookClient(apiKey);
  return bagsyClient;
}

export function getMoltbook(): MoltbookClient {
  if (!bagsyClient) {
    const apiKey = process.env.MOLTBOOK_BAGSY_KEY || process.env.MOLTBOOK_API_KEY;
    if (!apiKey) {
      throw new Error("MOLTBOOK_API_KEY not configured");
    }
    bagsyClient = new MoltbookClient(apiKey);
  }
  return bagsyClient;
}

export function getMoltbookOrNull(): MoltbookClient | null {
  try {
    return getMoltbook();
  } catch {
    return null;
  }
}

export function getChadGhostMoltbook(): MoltbookClient {
  if (!chadghostClient) {
    const apiKey = process.env.MOLTBOOK_CHADGHOST_KEY;
    if (!apiKey) {
      throw new Error("MOLTBOOK_CHADGHOST_KEY not configured");
    }
    chadghostClient = new MoltbookClient(apiKey);
  }
  return chadghostClient;
}

export function getChadGhostMoltbookOrNull(): MoltbookClient | null {
  try {
    return getChadGhostMoltbook();
  } catch {
    return null;
  }
}

export { MoltbookClient };
