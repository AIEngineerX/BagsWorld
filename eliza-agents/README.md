# BagsWorld Autonomous Agents

Powered by [ElizaOS](https://github.com/elizaOS/eliza) - the most popular TypeScript AI agent framework.

## Overview

This package enables BagsWorld characters (Neo, CJ, Finn, Bags Bot) to become fully autonomous agents with:

- **Persistent Memory** - Agents remember conversations and learn over time
- **Autonomous Actions** - Agents can scan tokens, post to Twitter, respond to events
- **Real-time Data** - Integrated with Bags.fm API for live token/creator data
- **Multi-Platform** - Deploy to Discord, Twitter, Telegram, or all at once

## Quick Start

### 1. Install Dependencies

```bash
cd eliza-agents
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required:
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - For AI responses
- `BAGSWORLD_API_URL` - Your BagsWorld backend URL

Optional (for autonomous posting):
- `TWITTER_*` - For Twitter/X posting
- `DISCORD_*` - For Discord bot
- `TELEGRAM_*` - For Telegram bot

### 3. Start the Agents

```bash
# Start all agents
bun run start

# Or start in development mode
bun run dev

# Start specific character
elizaos start --character src/characters/neo.ts
```

## Architecture

```
BagsWorld Frontend (React/Phaser)
         │
         ▼
   /api/eliza-agent (Next.js)
         │
         ▼
┌────────────────────────────────┐
│     ElizaOS Agent Runtime      │
│  ┌──────┐ ┌────┐ ┌──────┐     │
│  │ Neo  │ │ CJ │ │ Finn │ ... │
│  └──────┘ └────┘ └──────┘     │
│              │                 │
│     ┌────────┴────────┐       │
│     │  Bags.fm Plugin │       │
│     └────────┬────────┘       │
└──────────────│────────────────┘
               │
               ▼
    ┌──────────────────┐
    │   Bags.fm API    │
    │ (Token/Creator)  │
    └──────────────────┘
```

## Characters

### Neo - The Scout
Matrix-themed blockchain scanner. Monitors the chain, spots rugs before they happen.
- **Personality**: Cryptic, all-seeing, philosophical
- **Skills**: Token scanning, pattern detection, on-chain analysis

### CJ - The Hood Rat
Grove Street energy. Been through every cycle, keeps it real.
- **Personality**: Unfazed, supportive, street-wise
- **Skills**: Market commentary, survivor wisdom

### Finn - The Founder
Bags.fm CEO. Builder energy, believes in creator economy.
- **Personality**: Visionary, energetic, encouraging
- **Skills**: Platform knowledge, builder advice

### Bags Bot - The Guide
Friendly degen who's seen it all but still believes.
- **Personality**: Casual, supportive, CT-native
- **Skills**: General help, world status, community vibes

## Plugin: bags-fm

The custom Bags.fm plugin provides:

### Services
- `BagsFmService` - API connection, event polling, data fetching

### Actions
- `SCAN_TOKENS` - Scan for trending/new tokens
- `CHECK_CREATOR` - Look up creator statistics
- `REPORT_WORLD` - Generate world status report
- `ANALYZE_TOKEN` - Deep dive on specific token

### Providers
- `bagsworld-state` - Current world health, weather, volume
- `bags-events` - Recent launches, pumps, distributions
- `token-intel` - Detailed token data when mentioned
- `creator-leaderboard` - Top creators by earnings

## Autonomous Features

Once configured with Twitter/Discord credentials, agents can:

1. **React to Events**
   - New token launches → Neo announces
   - Price pumps/dumps → CJ comments
   - Creator milestones → Finn celebrates

2. **Scheduled Posts**
   - World status updates
   - Top token highlights
   - Creator spotlights

3. **Interactive Conversations**
   - Respond to mentions
   - Answer questions with real data
   - Engage in character

## Development

### Add New Actions

```typescript
// src/plugins/bags-fm/actions.ts
export const myNewAction: Action = {
  name: 'MY_ACTION',
  description: 'What this action does',

  validate: async (runtime, message) => {
    // Return true if this action should trigger
    return message.content?.text?.includes('trigger word');
  },

  handler: async (runtime, message, state, options, callback) => {
    const service = runtime.getService<BagsFmService>('bags-fm');
    // Do something...

    await callback({
      text: 'Response to user',
      action: 'MY_ACTION',
    });

    return { success: true };
  },
};
```

### Add New Providers

```typescript
// src/plugins/bags-fm/providers.ts
export const myProvider: Provider = {
  name: 'my-provider',
  description: 'What context this provides',

  get: async (runtime, message, state) => {
    // Fetch data...
    return {
      text: 'Context injected into prompts',
      values: { key: 'value' },
      data: { raw: 'data' },
    };
  },
};
```

## API Endpoints

When running the agent server:

```bash
# Chat with an agent
POST /api/chat
{
  "character": "neo",
  "message": "scan the chain",
  "userId": "user123"
}

# Get agent status
GET /api/status

# Trigger autonomous event
POST /api/event
{
  "type": "token_launch",
  "data": { "symbol": "TEST", "marketCap": 50000 }
}
```

## Deployment

### Docker

```bash
# Build
docker build -t bagsworld-agents .

# Run
docker run -d --env-file .env -p 3001:3001 bagsworld-agents
```

### PM2

```bash
pm2 start "bun run start" --name bagsworld-agents
```

## Troubleshooting

**Agents not responding?**
- Check `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set
- Verify `BAGSWORLD_API_URL` points to your backend

**Twitter posting not working?**
- Ensure all `TWITTER_*` variables are set
- Check Twitter API credentials have write access

**Memory not persisting?**
- Default uses SQLite in `./data/`
- For production, set `DATABASE_URL` to PostgreSQL

## Resources

- [ElizaOS Documentation](https://elizaos.github.io/eliza/)
- [ElizaOS GitHub](https://github.com/elizaOS/eliza)
- [Bags.fm](https://bags.fm)
