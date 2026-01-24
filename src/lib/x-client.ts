// X (Twitter) API Client for posting reports
// Uses OAuth 2.0 with PKCE for user context

interface XPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

interface XTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

class XClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.X_CLIENT_ID || "";
    this.clientSecret = process.env.X_CLIENT_SECRET || "";
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // Get OAuth 2.0 access token using client credentials
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get X access token: ${error}`);
    }

    const data: XTokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 min early

    return this.accessToken;
  }

  // Post a tweet
  async post(text: string): Promise<XPostResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "X API not configured. Set X_CLIENT_ID and X_CLIENT_SECRET.",
      };
    }

    // X has a 280 character limit
    if (text.length > 280) {
      text = text.slice(0, 277) + "...";
    }

    try {
      const token = await this.getAccessToken();

      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.title || "Failed to post tweet");
      }

      const data = await response.json();
      return {
        success: true,
        tweetId: data.data?.id,
      };
    } catch (error: any) {
      console.error("X post error:", error);
      return {
        success: false,
        error: error.message || "Failed to post to X",
      };
    }
  }

  // Post a thread (multiple tweets)
  async postThread(tweets: string[]): Promise<XPostResult[]> {
    const results: XPostResult[] = [];
    let replyToId: string | undefined;

    for (const text of tweets) {
      const result = await this.postWithReply(text, replyToId);
      results.push(result);

      if (result.success && result.tweetId) {
        replyToId = result.tweetId;
      } else {
        // Stop thread if a tweet fails
        break;
      }

      // Small delay between tweets
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }

  // Post a tweet as reply to another
  private async postWithReply(text: string, replyToId?: string): Promise<XPostResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "X API not configured",
      };
    }

    if (text.length > 280) {
      text = text.slice(0, 277) + "...";
    }

    try {
      const token = await this.getAccessToken();

      const body: any = { text };
      if (replyToId) {
        body.reply = { in_reply_to_tweet_id: replyToId };
      }

      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.title || "Failed to post tweet");
      }

      const data = await response.json();
      return {
        success: true,
        tweetId: data.data?.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to post",
      };
    }
  }
}

// Singleton instance
let xClient: XClient | null = null;

export function getXClient(): XClient {
  if (!xClient) {
    xClient = new XClient();
  }
  return xClient;
}

export { XClient };
export type { XPostResult };
