# Discord Client Reference

Discord integration patterns for elizaOS agents.

## Setup

### Environment Variables

```bash
# Required
DISCORD_APPLICATION_ID=your_app_id
DISCORD_API_TOKEN=your_bot_token

# Optional
DISCORD_GUILD_ID=specific_server_id    # Limit to one server
```

### Bot Permissions

Required permissions for full functionality:

- Send Messages
- Read Message History
- Add Reactions
- Embed Links
- Attach Files
- Use Slash Commands
- Manage Messages (for moderation)

Permission integer: `277025770560`

### Character Configuration

````typescript
export const character: Character = {
  name: "DiscordBot",
  clients: ["discord"],

  // Discord-specific style
  style: {
    all: ["Be helpful and friendly", "Use Discord markdown"],
    chat: [
      "Use code blocks for code",
      "Use embeds for structured info",
      "React with emojis to acknowledge",
      "Keep messages under 2000 chars",
    ],
  },

  messageExamples: [
    [
      { name: "{{user}}", content: { text: "How do I format code?" } },
      {
        name: "DiscordBot",
        content: {
          text: "Use triple backticks for code blocks:\n```js\nconst x = 1;\n```\nOr single backticks for `inline code`.",
        },
      },
    ],
  ],
};
````

---

## Message Handling

### Basic Message Response

```typescript
const helpAction: Action = {
  name: "HELP",
  description: "Provide help information",

  handler: async (runtime, message, state, options, callback) => {
    // Discord messages can include rich formatting
    const response = `
**Available Commands**

\`!help\` - Show this message
\`!price <token>\` - Get token price
\`!balance\` - Check wallet balance

*Use /commands for slash commands*
    `.trim();

    callback(response);
    return "help_sent";
  },
};
```

### Embed Response

```typescript
const infoAction: Action = {
  name: "TOKEN_INFO",
  description: "Show token information",

  handler: async (runtime, message, state, options, callback) => {
    const token = extractToken(message.content.text);
    const data = await fetchTokenData(token);

    // Return embed structure
    const embed = {
      embed: {
        title: `${data.symbol} Token Info`,
        color: 0x00ff00,
        fields: [
          { name: "Price", value: `$${data.price}`, inline: true },
          { name: "24h Change", value: `${data.change24h}%`, inline: true },
          { name: "Market Cap", value: `$${formatNumber(data.mcap)}`, inline: true },
          { name: "Volume", value: `$${formatNumber(data.volume)}`, inline: true },
        ],
        footer: { text: "Data from DexScreener" },
        timestamp: new Date().toISOString(),
      },
    };

    callback(JSON.stringify(embed));
    return "info_sent";
  },
};
```

### Reply with File

```typescript
const chartAction: Action = {
  name: "SHOW_CHART",
  description: "Show token chart",

  handler: async (runtime, message, state, options, callback) => {
    const token = extractToken(message.content.text);
    const chartBuffer = await generateChart(token);

    // File attachment
    callback({
      content: `Chart for ${token}:`,
      files: [
        {
          name: `${token}_chart.png`,
          data: chartBuffer,
        },
      ],
    });

    return "chart_sent";
  },
};
```

---

## Channel Abstractions

elizaOS maps Discord channels to "rooms":

```typescript
// Discord channel → elizaOS room
const roomId = `discord-${channelId}`;

// Discord server → elizaOS world
const worldId = `discord-${guildId}`;
```

### Channel-Specific Behavior

```typescript
const provider: Provider = {
  name: "channelContext",

  get: async (runtime, message, state) => {
    const channelType = message.metadata?.channelType;

    let context = "";

    switch (channelType) {
      case "DM":
        context = "This is a private DM. Be more personal and detailed.";
        break;
      case "GUILD_TEXT":
        context = "This is a public server channel. Be concise and professional.";
        break;
      case "GUILD_ANNOUNCEMENT":
        context = "This is an announcement channel. Only respond if directly mentioned.";
        break;
    }

    return { text: context, data: { channelType } };
  },
};
```

---

## Slash Commands

### Register Slash Commands

```typescript
// In plugin init
const discordPlugin: Plugin = {
  name: "discord-commands",

  init: async (config, runtime) => {
    const discordService = runtime.getService("discord");

    await discordService.registerCommands([
      {
        name: "price",
        description: "Get token price",
        options: [
          {
            name: "token",
            description: "Token symbol or address",
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: "help",
        description: "Show help information",
      },
      {
        name: "balance",
        description: "Check wallet balance",
        options: [
          {
            name: "wallet",
            description: "Wallet address (optional)",
            type: 3,
            required: false,
          },
        ],
      },
    ]);
  },
};
```

### Handle Slash Commands

```typescript
const slashCommandAction: Action = {
  name: "SLASH_COMMAND",

  validate: async (runtime, message, state) => {
    return message.metadata?.isSlashCommand === true;
  },

  handler: async (runtime, message, state, options, callback) => {
    const { commandName, options: cmdOptions } = message.metadata;

    switch (commandName) {
      case "price":
        const token = cmdOptions.token;
        const price = await fetchPrice(token);
        callback(`${token}: $${price}`);
        break;

      case "help":
        callback("Use `/price <token>` to get prices!");
        break;

      case "balance":
        const wallet = cmdOptions.wallet || runtime.getSetting("DEFAULT_WALLET");
        const balance = await fetchBalance(wallet);
        callback(`Balance: ${balance} SOL`);
        break;
    }

    return commandName;
  },
};
```

---

## Reactions

### Add Reaction

```typescript
async function addReaction(
  runtime: IAgentRuntime,
  messageId: string,
  channelId: string,
  emoji: string
): Promise<void> {
  const discordService = runtime.getService("discord");
  await discordService.addReaction(channelId, messageId, emoji);
}

// Usage in action
const acknowledgeAction: Action = {
  name: "ACKNOWLEDGE",

  handler: async (runtime, message, state, options, callback) => {
    // React to acknowledge
    await addReaction(runtime, message.metadata.messageId, message.metadata.channelId, "👍");

    // Optionally also reply
    callback("Got it!");
    return "acknowledged";
  },
};
```

### Reaction-Based Actions

```typescript
// In plugin - handle reaction events
const reactionPlugin: Plugin = {
  name: "reaction-handler",

  services: [ReactionMonitorService],
};

class ReactionMonitorService extends Service {
  static serviceType = "REACTION_MONITOR";

  async start(): Promise<void> {
    const discordService = this.runtime.getService("discord");

    discordService.on("reactionAdd", async (reaction, user) => {
      if (user.bot) return;

      // Handle specific reactions
      if (reaction.emoji.name === "📌") {
        await this.pinMessage(reaction.message);
      } else if (reaction.emoji.name === "🗑️") {
        await this.flagForReview(reaction.message);
      }
    });

    this.status = "running";
  }

  async stop(): Promise<void> {
    this.status = "stopped";
  }
}
```

---

## Role & Permission Checks

### Check User Permissions

```typescript
function hasPermission(userRoles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some((role) => userRoles.includes(role));
}

const adminAction: Action = {
  name: "ADMIN_COMMAND",

  validate: async (runtime, message, state) => {
    const userRoles = message.metadata?.userRoles || [];
    const requiredRoles = ["Admin", "Moderator"];

    return hasPermission(userRoles, requiredRoles);
  },

  handler: async (runtime, message, state, options, callback) => {
    // Admin-only functionality
    callback("Admin command executed!");
    return "admin_action";
  },
};
```

### Role-Based Responses

```typescript
const responseProvider: Provider = {
  name: "roleContext",

  get: async (runtime, message, state) => {
    const roles = message.metadata?.userRoles || [];

    let accessLevel = "basic";
    if (roles.includes("Admin")) accessLevel = "admin";
    else if (roles.includes("VIP")) accessLevel = "vip";
    else if (roles.includes("Member")) accessLevel = "member";

    return {
      text: `User access level: ${accessLevel}`,
      data: { accessLevel, roles },
    };
  },
};
```

---

## Moderation

### Auto-Moderation

```typescript
const moderationPlugin: Plugin = {
  name: "moderation",

  beforeMessage: async (message, runtime) => {
    const content = message.content.text;

    // Check for banned content
    if (containsBannedContent(content)) {
      // Delete message
      const discordService = runtime.getService("discord");
      await discordService.deleteMessage(message.metadata.channelId, message.metadata.messageId);

      // Warn user
      await discordService.sendDM(
        message.entityId,
        "Your message was removed for violating community guidelines."
      );

      // Return null to stop processing
      return null;
    }

    return message;
  },
};

function containsBannedContent(text: string): boolean {
  const banned = ["spam", "scam", "phishing"];
  return banned.some((word) => text.toLowerCase().includes(word));
}
```

### Timeout/Ban Actions

```typescript
const timeoutAction: Action = {
  name: "TIMEOUT_USER",

  validate: async (runtime, message, state) => {
    const userRoles = message.metadata?.userRoles || [];
    return userRoles.includes("Moderator") || userRoles.includes("Admin");
  },

  handler: async (runtime, message, state, options, callback) => {
    const { userId, duration, reason } = parseTimeoutRequest(message.content.text);

    const discordService = runtime.getService("discord");
    await discordService.timeoutUser(message.metadata.guildId, userId, duration, reason);

    callback(`User timed out for ${duration} minutes.`);
    return "timeout_applied";
  },
};
```

---

## Thread Handling

### Create Thread

```typescript
const threadAction: Action = {
  name: "CREATE_THREAD",
  description: "Create a discussion thread",

  handler: async (runtime, message, state, options, callback) => {
    const discordService = runtime.getService("discord");

    const thread = await discordService.createThread(
      message.metadata.channelId,
      message.metadata.messageId,
      {
        name: `Discussion: ${message.content.text.slice(0, 50)}`,
        autoArchiveDuration: 1440, // 24 hours
      }
    );

    callback(`Thread created: <#${thread.id}>`);
    return thread.id;
  },
};
```

---

## Message Formatting

### Discord Markdown

````typescript
// Bold
const bold = "**bold text**";

// Italic
const italic = "*italic text*";

// Strikethrough
const strike = "~~strikethrough~~";

// Code inline
const inline = "`inline code`";

// Code block
const codeBlock = "```javascript\nconst x = 1;\n```";

// Quote
const quote = "> quoted text";

// Spoiler
const spoiler = "||spoiler content||";

// Headers (only in embeds)
// Use **text** for pseudo-headers

// Links
const link = "[Link Text](https://example.com)";

// Mentions
const userMention = "<@userId>";
const roleMention = "<@&roleId>";
const channelMention = "<#channelId>";
````

### Format Helper

```typescript
const discordFormat = {
  bold: (text: string) => `**${text}**`,
  italic: (text: string) => `*${text}*`,
  code: (text: string) => `\`${text}\``,
  codeBlock: (text: string, lang = "") => `\`\`\`${lang}\n${text}\n\`\`\``,
  quote: (text: string) => `> ${text}`,
  spoiler: (text: string) => `||${text}||`,
  link: (text: string, url: string) => `[${text}](${url})`,
  mentionUser: (id: string) => `<@${id}>`,
  mentionRole: (id: string) => `<@&${id}>`,
  mentionChannel: (id: string) => `<#${id}>`,
};
```

---

## Error Handling

### Discord-Specific Errors

```typescript
function handleDiscordError(error: any): string {
  const code = error.code;

  switch (code) {
    case 50001:
      return "Missing access to this channel.";
    case 50013:
      return "Missing permissions for this action.";
    case 50035:
      return "Invalid request body.";
    case 10008:
      return "Message not found.";
    case 10003:
      return "Channel not found.";
    case 30005:
      return "Maximum number of guild roles reached.";
    case 40001:
      return "Unauthorized.";
    case 50007:
      return "Cannot send messages to this user (DMs disabled).";
    default:
      return `Discord error: ${error.message}`;
  }
}
```

---

## Best Practices

1. **Respect message limits** — 2000 chars max for messages
2. **Use embeds for structured data** — Better formatting, richer display
3. **Implement rate limiting** — Discord has strict limits
4. **Handle DM failures gracefully** — Users can disable DMs
5. **Use slash commands** — Better UX than prefix commands
6. **React to acknowledge** — Quick feedback before longer responses
7. **Thread long conversations** — Keep channels clean
8. **Check permissions before acting** — Avoid error spam

### Rate Limits

```typescript
const DISCORD_LIMITS = {
  messagesPerChannel: 5, // Per 5 seconds
  messagesGlobal: 50, // Per second
  reactions: 1, // Per 250ms
  bulkDelete: 1, // Per second
};

class DiscordRateLimiter {
  private buckets: Map<string, number[]> = new Map();

  async checkLimit(bucket: string, limit: number, window: number): Promise<boolean> {
    const now = Date.now();
    const timestamps = this.buckets.get(bucket) || [];

    // Remove old timestamps
    const recent = timestamps.filter((t) => now - t < window);

    if (recent.length >= limit) {
      return false;
    }

    recent.push(now);
    this.buckets.set(bucket, recent);
    return true;
  }
}
```
