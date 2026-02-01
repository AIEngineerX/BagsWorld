/**
 * Social Agent Plugin Template
 *
 * Provides:
 * - Scheduled posting
 * - Mention monitoring and response
 * - Engagement tracking
 * - Content generation helpers
 *
 * Customize:
 * - Add your content strategies
 * - Implement your engagement rules
 * - Add platform-specific features
 */

import {
  Plugin,
  Action,
  Provider,
  Evaluator,
  Service,
  IAgentRuntime,
  Memory,
  State,
} from "@elizaos/core";

// ============ PROVIDERS ============

/**
 * Provides engagement context for responses
 */
const engagementProvider: Provider = {
  name: "engagementContext",

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const metadata = message.metadata || {};

    // Build context based on platform and interaction type
    let context = "";

    if (metadata.source === "twitter") {
      if (metadata.type === "mention") {
        context =
          "This is a Twitter mention. Respond publicly and concisely (under 280 chars). Be engaging.";
      } else if (metadata.type === "dm") {
        context = "This is a Twitter DM. You can be more detailed but keep it friendly.";
      } else if (metadata.type === "reply") {
        context =
          "This is a reply to your tweet. Engage thoughtfully to continue the conversation.";
      }
    }

    return {
      text: context,
      data: {
        platform: metadata.source,
        interactionType: metadata.type,
      },
    };
  },
};

/**
 * Provides trending topics for content ideas
 */
const trendingProvider: Provider = {
  name: "trendingTopics",

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = message.content.text.toLowerCase();

    // Only inject if relevant
    if (!text.includes("post") && !text.includes("content") && !text.includes("tweet")) {
      return { text: "", data: {} };
    }

    try {
      const trends = await fetchTrendingTopics();

      return {
        text: `Trending topics: ${trends.slice(0, 5).join(", ")}`,
        data: { trends },
      };
    } catch (error) {
      return { text: "", data: {} };
    }
  },
};

// ============ ACTIONS ============

/**
 * Generate content ideas
 */
const contentIdeasAction: Action = {
  name: "GENERATE_IDEAS",
  description: "Generate content ideas for social media",
  similes: ["content ideas", "what should I post", "tweet ideas", "content suggestions"],

  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const text = message.content.text.toLowerCase();
    return text.includes("idea") || text.includes("content") || text.includes("what should i post");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: any) => void
  ) => {
    const topic = extractTopic(message.content.text);

    const ideas = await generateContentIdeas(runtime, topic);

    callback({
      text: `Here are some content ideas${topic ? ` about ${topic}` : ""}:\n\n${ideas.map((idea, i) => `${i + 1}. ${idea}`).join("\n\n")}`,
    });

    return "ideas_generated";
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Give me some content ideas about DeFi" } },
      {
        user: "{{agentName}}",
        content: { text: "Here are some ideas...", action: "GENERATE_IDEAS" },
      },
    ],
  ],
};

/**
 * Draft a tweet/post
 */
const draftPostAction: Action = {
  name: "DRAFT_POST",
  description: "Draft a tweet or social media post",
  similes: ["draft", "write", "compose", "create post", "write tweet"],

  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const text = message.content.text.toLowerCase();
    return text.includes("draft") || text.includes("write") || text.includes("compose");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: any) => void
  ) => {
    const topic = extractTopic(message.content.text);
    const style = extractStyle(message.content.text);

    const draft = await generateDraft(runtime, topic, style);

    callback({
      text: `Here's a draft:\n\n---\n${draft}\n---\n\nCharacter count: ${draft.length}/280\n\nWant me to adjust anything?`,
    });

    return "draft_created";
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Draft a tweet about our new feature launch" } },
      { user: "{{agentName}}", content: { text: "Here's a draft...", action: "DRAFT_POST" } },
    ],
  ],
};

/**
 * Schedule a post
 */
const schedulePostAction: Action = {
  name: "SCHEDULE_POST",
  description: "Schedule a post for later",
  similes: ["schedule", "post later", "queue"],

  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    return message.content.text.toLowerCase().includes("schedule");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: any) => void
  ) => {
    const { content, time } = parseScheduleRequest(message.content.text);

    if (!content) {
      callback({ text: "Please include the content you want to schedule." });
      return "no_content";
    }

    if (!time) {
      callback({ text: 'Please specify when to post (e.g., "in 2 hours" or "tomorrow at 9am")' });
      return "no_time";
    }

    // Store scheduled post
    await runtime.createMemory({
      content: {
        text: content,
        metadata: {
          type: "scheduled_post",
          scheduledFor: time.toISOString(),
          status: "pending",
        },
      },
      roomId: message.roomId,
    });

    callback({
      text: `Scheduled for ${time.toLocaleString()}:\n\n"${content}"\n\nI'll post this automatically at the scheduled time.`,
    });

    return "scheduled";
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: 'Schedule "gm everyone!" for tomorrow 9am' } },
      { user: "{{agentName}}", content: { text: "Scheduled!", action: "SCHEDULE_POST" } },
    ],
  ],
};

/**
 * Respond to a mention
 */
const respondMentionAction: Action = {
  name: "RESPOND_MENTION",
  description: "Craft a response to a social media mention",
  similes: ["respond", "reply to", "answer"],

  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const metadata = message.metadata || {};
    return metadata.type === "mention" || message.content.text.toLowerCase().includes("respond to");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: any) => void
  ) => {
    const mentionContent = message.content.text;

    // Generate appropriate response
    const response = await runtime.completion({
      messages: [
        {
          role: "user",
          content: `Generate a friendly, engaging response to this mention:\n\n"${mentionContent}"\n\nKeep it under 200 characters. Be authentic and add value.`,
        },
      ],
    });

    callback({
      text: response,
      action: "RESPOND_MENTION",
    });

    return "responded";
  },
};

// ============ EVALUATORS ============

/**
 * Track engagement metrics
 */
const engagementEvaluator: Evaluator = {
  name: "ENGAGEMENT_TRACKER",
  description: "Track engagement patterns for optimization",
  alwaysRun: true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: string) => void,
    responses: Memory[]
  ) => {
    const metadata = message.metadata || {};

    if (metadata.source === "twitter") {
      await runtime.createMemory({
        content: {
          text: `Engagement: ${metadata.type}`,
          metadata: {
            type: "engagement_log",
            platform: "twitter",
            interactionType: metadata.type,
            timestamp: Date.now(),
          },
        },
        roomId: message.roomId,
      });
    }

    callback("Engagement logged");
    return "logged";
  },
};

// ============ SERVICES ============

/**
 * Scheduled posting service
 */
class ScheduledPostService extends Service {
  static serviceType = "SCHEDULED_POSTS";
  private interval?: NodeJS.Timer;

  async start(): Promise<void> {
    this.status = "running";

    // Check for scheduled posts every minute
    this.interval = setInterval(() => this.checkScheduledPosts(), 60000);

    console.log("Scheduled post service started");
  }

  private async checkScheduledPosts(): Promise<void> {
    const now = new Date();

    // Find pending scheduled posts
    const scheduled = await this.runtime.getMemories({
      roomId: "scheduled_posts",
      count: 100,
    });

    for (const post of scheduled) {
      const metadata = post.content.metadata as any;

      if (metadata?.type !== "scheduled_post" || metadata?.status !== "pending") {
        continue;
      }

      const scheduledTime = new Date(metadata.scheduledFor);

      if (scheduledTime <= now) {
        await this.executePost(post);
      }
    }
  }

  private async executePost(post: Memory): Promise<void> {
    try {
      const twitterService = this.runtime.getService("twitter");

      if (twitterService) {
        await twitterService.post(post.content.text);
        console.log("Scheduled post published:", post.content.text);
      }

      // Mark as posted
      // (In a real implementation, update the memory status)
    } catch (error) {
      console.error("Failed to execute scheduled post:", error);
    }
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.status = "stopped";
    console.log("Scheduled post service stopped");
  }
}

// ============ HELPER FUNCTIONS ============

function extractTopic(text: string): string | null {
  const aboutMatch = text.match(/about\s+(.+?)(?:\.|$)/i);
  return aboutMatch ? aboutMatch[1].trim() : null;
}

function extractStyle(text: string): string {
  if (text.includes("funny")) return "humorous";
  if (text.includes("serious")) return "professional";
  if (text.includes("casual")) return "casual";
  return "engaging";
}

async function fetchTrendingTopics(): Promise<string[]> {
  // Implement trending topics fetch
  // Use Twitter API or other source
  return ["AI", "crypto", "Solana", "DeFi", "NFTs"];
}

async function generateContentIdeas(runtime: IAgentRuntime, topic?: string): Promise<string[]> {
  const prompt = topic
    ? `Generate 5 engaging social media content ideas about ${topic}. Be specific and actionable.`
    : "Generate 5 engaging social media content ideas for a crypto/tech audience. Be specific and actionable.";

  const response = await runtime.completion({
    messages: [{ role: "user", content: prompt }],
  });

  // Parse response into array
  return response
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 5);
}

async function generateDraft(
  runtime: IAgentRuntime,
  topic?: string,
  style = "engaging"
): Promise<string> {
  const prompt = `Write a ${style} tweet${topic ? ` about ${topic}` : ""}.
Keep it under 280 characters.
Make it engaging and authentic.
End with a question or call to action if appropriate.
Just return the tweet text, nothing else.`;

  const response = await runtime.completion({
    messages: [{ role: "user", content: prompt }],
  });

  return response.trim();
}

function parseScheduleRequest(text: string): { content: string | null; time: Date | null } {
  // Basic parsing - enhance as needed
  const contentMatch = text.match(/"([^"]+)"/);
  const content = contentMatch ? contentMatch[1] : null;

  let time: Date | null = null;

  if (text.includes("tomorrow")) {
    time = new Date();
    time.setDate(time.getDate() + 1);

    const hourMatch = text.match(/(\d{1,2})\s*(am|pm)/i);
    if (hourMatch) {
      let hour = parseInt(hourMatch[1]);
      if (hourMatch[2].toLowerCase() === "pm" && hour !== 12) hour += 12;
      if (hourMatch[2].toLowerCase() === "am" && hour === 12) hour = 0;
      time.setHours(hour, 0, 0, 0);
    }
  } else if (text.includes("in")) {
    const hoursMatch = text.match(/in\s+(\d+)\s*hours?/i);
    if (hoursMatch) {
      time = new Date();
      time.setHours(time.getHours() + parseInt(hoursMatch[1]));
    }
  }

  return { content, time };
}

// ============ PLUGIN EXPORT ============

export const socialPlugin: Plugin = {
  name: "@template/social-plugin",
  description: "Social media engagement and automation capabilities",

  providers: [engagementProvider, trendingProvider],
  actions: [contentIdeasAction, draftPostAction, schedulePostAction, respondMentionAction],
  evaluators: [engagementEvaluator],
  services: [ScheduledPostService],

  init: async (config, runtime) => {
    console.log("Social plugin initialized");
  },

  start: async (runtime) => {
    console.log("Social plugin started");
  },

  stop: async (runtime) => {
    console.log("Social plugin stopped");
  },
};

export default socialPlugin;
