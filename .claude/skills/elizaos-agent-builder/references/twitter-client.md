# Twitter Client Reference

Twitter/X integration patterns for elizaOS agents.

## Setup

### Environment Variables

```bash
# Required
TWITTER_USERNAME=your_bot_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email@example.com

# Optional
TWITTER_2FA_SECRET=your_2fa_secret    # If 2FA enabled
TWITTER_POLL_INTERVAL=120000          # Poll interval (ms)
TWITTER_DRY_RUN=false                 # Test mode
```

### Character Configuration

```typescript
export const character: Character = {
  name: "TwitterBot",
  clients: ["twitter"],

  // Twitter-specific style
  style: {
    all: ["Be authentic", "Engage genuinely"],
    post: [
      "Keep under 280 characters",
      "Use 1-3 hashtags maximum",
      "Use emojis sparingly",
      "Hook readers in first line",
      "Use line breaks for readability",
    ],
  },

  postExamples: [
    "Just shipped a major update.\n\nWhat's new:\n- Feature A\n- Feature B\n- Feature C\n\nThread below for details",
    "Hot take: Most crypto projects fail because they focus on token price instead of product.\n\nBuild something people want first.",
  ],
};
```

---

## Post Patterns

### Basic Post

```typescript
const postAction: Action = {
  name: "POST_TWEET",
  description: "Post a tweet",

  handler: async (runtime, message, state, options, callback) => {
    const content = message.content.text;

    // Validate length
    if (content.length > 280) {
      callback("Tweet too long. Please shorten to 280 characters.");
      return "too_long";
    }

    const twitterService = runtime.getService("twitter");
    const result = await twitterService.post(content);

    callback(`Tweet posted! ${result.url}`);
    return result.id;
  },
};
```

### Thread Posting

```typescript
const threadAction: Action = {
  name: "POST_THREAD",
  description: "Post a Twitter thread",

  handler: async (runtime, message, state, options, callback) => {
    const content = message.content.text;
    const tweets = splitIntoThread(content);

    const twitterService = runtime.getService("twitter");
    const results = [];
    let replyToId: string | null = null;

    for (const tweet of tweets) {
      const result = await twitterService.post(tweet, {
        replyTo: replyToId,
      });
      results.push(result);
      replyToId = result.id;
    }

    callback(`Thread posted (${tweets.length} tweets)! ${results[0].url}`);
    return results;
  },
};

function splitIntoThread(content: string, maxLength = 270): string[] {
  const paragraphs = content.split("\n\n");
  const tweets: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length <= maxLength) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) tweets.push(current);
      current = para;
    }
  }

  if (current) tweets.push(current);

  // Add thread markers
  return tweets.map((tweet, i) =>
    tweets.length > 1 ? `${i + 1}/${tweets.length} ${tweet}` : tweet
  );
}
```

### Quote Tweet

```typescript
const quoteAction: Action = {
  name: "QUOTE_TWEET",
  description: "Quote tweet with comment",

  handler: async (runtime, message, state, options, callback) => {
    const { tweetUrl, comment } = parseQuoteRequest(message.content.text);

    const twitterService = runtime.getService("twitter");
    const result = await twitterService.quote(tweetUrl, comment);

    callback(`Quote tweet posted! ${result.url}`);
    return result.id;
  },
};
```

---

## Reply Patterns

### Reply to Mentions

```typescript
const replyAction: Action = {
  name: "REPLY_TWEET",
  description: "Reply to a tweet",

  handler: async (runtime, message, state, options, callback) => {
    const { tweetId, reply } = parseReplyRequest(message.content.text);

    if (reply.length > 280) {
      callback("Reply too long");
      return "too_long";
    }

    const twitterService = runtime.getService("twitter");
    const result = await twitterService.reply(tweetId, reply);

    callback(`Replied! ${result.url}`);
    return result.id;
  },
};
```

### Mention Handler

```typescript
// In plugin
const twitterPlugin: Plugin = {
  name: "twitter-handler",

  // Handle incoming mentions
  beforeMessage: async (message, runtime) => {
    if (message.metadata?.source === "twitter" && message.metadata?.type === "mention") {
      // Add context about the mention
      return {
        ...message,
        content: {
          ...message.content,
          metadata: {
            ...message.content.metadata,
            isTwitterMention: true,
            tweetId: message.metadata.tweetId,
            authorUsername: message.metadata.author,
          },
        },
      };
    }
    return message;
  },
};
```

---

## Search & Monitor

### Search Tweets

```typescript
const searchProvider: Provider = {
  name: "twitterSearch",

  get: async (runtime, message, state) => {
    const query = extractSearchQuery(message.content.text);
    if (!query) return { text: "", data: {} };

    const twitterService = runtime.getService("twitter");
    const results = await twitterService.search(query, { count: 10 });

    const formatted = results
      .map((tweet) => `@${tweet.author}: ${tweet.text.slice(0, 100)}...`)
      .join("\n");

    return {
      text: `Recent tweets about "${query}":\n${formatted}`,
      data: { tweets: results },
    };
  },
};
```

### Monitor Keywords

```typescript
class TwitterMonitorService extends Service {
  static serviceType = "TWITTER_MONITOR";
  private interval?: NodeJS.Timer;
  private lastSeen: Record<string, string> = {};

  constructor(
    runtime: IAgentRuntime,
    private keywords: string[]
  ) {
    super(runtime);
  }

  async start(): Promise<void> {
    this.status = "running";

    this.interval = setInterval(() => this.checkKeywords(), 60000);
  }

  private async checkKeywords(): Promise<void> {
    const twitterService = this.runtime.getService("twitter");

    for (const keyword of this.keywords) {
      const results = await twitterService.search(keyword, { count: 5 });

      for (const tweet of results) {
        if (this.lastSeen[keyword] === tweet.id) break;

        // New tweet found
        await this.handleNewTweet(keyword, tweet);
      }

      if (results.length > 0) {
        this.lastSeen[keyword] = results[0].id;
      }
    }
  }

  private async handleNewTweet(keyword: string, tweet: any): Promise<void> {
    console.log(`New tweet about ${keyword}:`, tweet.text);
    // Trigger response logic
  }

  async stop(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    this.status = "stopped";
  }
}
```

---

## Engagement Patterns

### Like Action

```typescript
const likeAction: Action = {
  name: "LIKE_TWEET",
  description: "Like a tweet",

  validate: async (runtime, message, state) => {
    // Only allow liking if explicitly requested
    return message.content.text.toLowerCase().includes("like");
  },

  handler: async (runtime, message, state, options, callback) => {
    const tweetId = extractTweetId(message.content.text);

    const twitterService = runtime.getService("twitter");
    await twitterService.like(tweetId);

    callback("Tweet liked!");
    return tweetId;
  },
};
```

### Retweet Action

```typescript
const retweetAction: Action = {
  name: "RETWEET",
  description: "Retweet a tweet",

  handler: async (runtime, message, state, options, callback) => {
    const tweetId = extractTweetId(message.content.text);

    const twitterService = runtime.getService("twitter");
    await twitterService.retweet(tweetId);

    callback("Retweeted!");
    return tweetId;
  },
};
```

---

## Rate Limiting

### Rate Limit Handler

```typescript
class TwitterRateLimiter {
  private limits: Map<string, { remaining: number; reset: number }> = new Map();

  async checkLimit(endpoint: string): Promise<boolean> {
    const limit = this.limits.get(endpoint);
    if (!limit) return true;

    if (limit.remaining <= 0) {
      if (Date.now() < limit.reset) {
        return false;
      }
      // Reset period passed
      this.limits.delete(endpoint);
    }

    return true;
  }

  updateLimit(endpoint: string, remaining: number, reset: number): void {
    this.limits.set(endpoint, { remaining, reset });
  }

  async waitForReset(endpoint: string): Promise<void> {
    const limit = this.limits.get(endpoint);
    if (!limit) return;

    const waitTime = limit.reset - Date.now();
    if (waitTime > 0) {
      console.log(`Rate limited. Waiting ${waitTime}ms for ${endpoint}`);
      await sleep(waitTime);
    }
  }
}

// Usage
const rateLimiter = new TwitterRateLimiter();

async function postTweet(content: string): Promise<any> {
  if (!(await rateLimiter.checkLimit("tweets"))) {
    await rateLimiter.waitForReset("tweets");
  }

  const response = await twitterClient.post(content);

  rateLimiter.updateLimit(
    "tweets",
    parseInt(response.headers["x-rate-limit-remaining"]),
    parseInt(response.headers["x-rate-limit-reset"]) * 1000
  );

  return response.data;
}
```

---

## Content Guidelines

### Auto-Generated Post Rules

```typescript
interface PostValidation {
  valid: boolean;
  issues: string[];
}

function validatePost(content: string): PostValidation {
  const issues: string[] = [];

  // Length check
  if (content.length > 280) {
    issues.push(`Too long (${content.length}/280 chars)`);
  }

  // Hashtag count
  const hashtags = content.match(/#\w+/g) || [];
  if (hashtags.length > 5) {
    issues.push(`Too many hashtags (${hashtags.length}/5)`);
  }

  // URL check
  const urls = content.match(/https?:\/\/\S+/g) || [];
  if (urls.length > 2) {
    issues.push("Too many URLs");
  }

  // Mention spam check
  const mentions = content.match(/@\w+/g) || [];
  if (mentions.length > 5) {
    issues.push("Too many mentions");
  }

  // Duplicate content check (would need history)
  // ...

  return {
    valid: issues.length === 0,
    issues,
  };
}
```

### Content Moderation

```typescript
const BANNED_WORDS = ["spam", "scam", "guaranteed"];
const RISKY_PATTERNS = [
  /\$\d+/, // Dollar amounts
  /\d+x/, // Multipliers
  /guaranteed/i, // Guarantees
];

function moderateContent(content: string): { safe: boolean; reason?: string } {
  // Check banned words
  for (const word of BANNED_WORDS) {
    if (content.toLowerCase().includes(word)) {
      return { safe: false, reason: `Contains banned word: ${word}` };
    }
  }

  // Check risky patterns
  for (const pattern of RISKY_PATTERNS) {
    if (pattern.test(content)) {
      return { safe: false, reason: `Contains risky pattern: ${pattern}` };
    }
  }

  return { safe: true };
}
```

---

## Error Handling

### Twitter-Specific Errors

```typescript
function handleTwitterError(error: any): string {
  const code = error.code || error.response?.data?.errors?.[0]?.code;

  switch (code) {
    case 187:
      return "Duplicate tweet. Already posted this content.";
    case 186:
      return "Tweet is too long.";
    case 179:
      return "Cannot view this tweet (protected account).";
    case 144:
      return "Tweet not found.";
    case 88:
      return "Rate limit exceeded. Please wait.";
    case 89:
      return "Invalid or expired token. Please re-authenticate.";
    case 326:
      return "Account temporarily locked. Manual review required.";
    case 32:
      return "Authentication failed.";
    default:
      return `Twitter error: ${error.message}`;
  }
}
```

---

## Best Practices

1. **Respect rate limits** — Twitter has strict limits, implement backoff
2. **Avoid spam patterns** — Don't post identical content, vary replies
3. **Engage authentically** — Quality over quantity
4. **Handle auth carefully** — Store credentials securely, handle 2FA
5. **Monitor for suspensions** — Watch for account issues
6. **Test in dry-run mode** — Use `TWITTER_DRY_RUN=true` for testing
7. **Log all actions** — Keep audit trail of posts/replies
8. **Implement cooldowns** — Don't post too frequently

### Posting Frequency Guidelines

```typescript
const COOLDOWNS = {
  post: 15 * 60 * 1000, // 15 min between posts
  reply: 2 * 60 * 1000, // 2 min between replies
  like: 30 * 1000, // 30s between likes
  retweet: 5 * 60 * 1000, // 5 min between retweets
};

class TwitterCooldown {
  private lastAction: Map<string, number> = new Map();

  canAct(action: string): boolean {
    const last = this.lastAction.get(action) || 0;
    const cooldown = COOLDOWNS[action] || 0;
    return Date.now() - last >= cooldown;
  }

  recordAction(action: string): void {
    this.lastAction.set(action, Date.now());
  }

  timeUntilReady(action: string): number {
    const last = this.lastAction.get(action) || 0;
    const cooldown = COOLDOWNS[action] || 0;
    return Math.max(0, cooldown - (Date.now() - last));
  }
}
```
