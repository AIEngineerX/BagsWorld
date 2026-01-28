# BagsWorld ElizaOS Agents

**16 autonomous AI agents powered by [ElizaOS](https://github.com/elizaOS/eliza)**

## Overview

This microservice provides the AI brains for all BagsWorld characters. Each agent has:

- **Persistent Memory** - Agents remember conversations across sessions
- **Distinct Personality** - Unique voice, style, and expertise
- **Real-time Data** - Integrated with Bags.fm API for live token data
- **Autonomous Actions** - React to launches, price movements, and events

## All 16 Agents

| Agent | Role | Specialty |
|-------|------|-----------|
| **Finn** | Bags.fm CEO | Platform vision, creator economy |
| **Toly** | Solana Co-founder | Blockchain expertise, Solana architecture |
| **Shaw** | ElizaOS Creator | Agent development, character files |
| **Ghost** | Community Funder | On-chain verification, community funding |
| **Neo** | Scout Agent | Launch detection, blockchain scanning |
| **CJ** | Hood Legend | Market commentary, survivor wisdom |
| **Ash** | Ecosystem Guide | Platform mechanics (Pokemon style) |
| **Professor Oak** | Launch Wizard | Token launch guidance |
| **Ramo** | CTO | Smart contracts, SDK |
| **Sincara** | Frontend Engineer | UI/UX, React |
| **Stuu** | Operations | Support, troubleshooting |
| **Sam** | Growth | Marketing, community growth |
| **Alaa** | Skunk Works | R&D, experimental features |
| **Carlo** | Ambassador | Community relations |
| **BNN** | News Network | Platform announcements |
| **Bags Bot** | World Guide | General help, world status |

## Quick Start

### 1. Install Dependencies

```bash
cd eliza-agents
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Required:
```env
ANTHROPIC_API_KEY=your_key    # or OPENAI_API_KEY
DATABASE_URL=postgresql://... # Neon connection string
```

### 3. Start the Server

```bash
# Development (with hot reload)
npm run start:dev

# Production
npm run start
```

Server runs on `http://localhost:3001`

## API Endpoints

### Health & Status

```bash
GET /health              # Server health check
GET /api/agents          # List all 16 agents
GET /api/agents/:id      # Get specific agent info
```

### Chat

```bash
POST /api/agents/:id/chat
{
  "message": "Hey, what's happening in the world?",
  "sessionId": "optional-uuid"
}
```

### Multi-Agent Dialogue

```bash
POST /api/dialogue
{
  "topic": "New token just launched",
  "agents": ["neo", "cj", "finn"]
}
```

### Session Management

```bash
GET  /api/sessions/:id/history  # Get conversation history
DELETE /api/sessions/:id        # Clear session
```

### Token Data

```bash
GET /api/tokens/:mint           # Token info
GET /api/tokens/:mint/fees      # Creator fee stats
GET /api/tokens/search/:query   # Search tokens
GET /api/creators/top           # Top creators
GET /api/launches/recent        # Recent launches
```

### World State

```bash
GET /api/world-health           # Current world health
GET /api/world-state            # Full world context
```

### Autonomous Features

```bash
GET  /api/autonomous/status      # Task status
GET  /api/autonomous/alerts      # Recent alerts
POST /api/autonomous/trigger/:task  # Manual trigger
```

### Launch Wizard (Professor Oak)

```bash
POST /api/launch-wizard/start              # Start guided launch
GET  /api/launch-wizard/session/:id        # Session status
POST /api/launch-wizard/session/:id/input  # Process step
POST /api/launch-wizard/session/:id/ask    # Ask Oak a question
```

### Creator Tools

```bash
GET /api/creator-tools/analyze/:mint        # Full token analysis
GET /api/creator-tools/fee-advice/:mint     # Fee optimization (Ghost)
GET /api/creator-tools/marketing-advice/:mint # Marketing tips (Sam)
GET /api/creator-tools/community-advice/:mint # Community help (Carlo)
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Express Server (:3001)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Routes    │  │  Services   │  │  Characters │     │
│  │             │  │             │  │             │     │
│  │ • chat      │  │ • Agent     │  │ • 16 full   │     │
│  │ • tokens    │  │   Coord.    │  │   character │     │
│  │ • world     │  │ • Autonomous│  │   files     │     │
│  │ • wizard    │  │ • LaunchWiz │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                          │                              │
│                          ▼                              │
│              ┌──────────────────────┐                  │
│              │   Anthropic/OpenAI   │                  │
│              │        API           │                  │
│              └──────────────────────┘                  │
│                          │                              │
│                          ▼                              │
│              ┌──────────────────────┐                  │
│              │   Neon PostgreSQL    │                  │
│              │  (conversation mem)  │                  │
│              └──────────────────────┘                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌──────────────────────┐
              │  BagsWorld Main App  │
              │   (localhost:3000)   │
              └──────────────────────┘
```

## Project Structure

```
eliza-agents/
├── src/
│   ├── characters/
│   │   ├── definitions/     # All 16 character files
│   │   │   ├── finn.character.ts
│   │   │   ├── toly.character.ts
│   │   │   └── ...
│   │   └── index.ts         # Character registry
│   │
│   ├── services/
│   │   ├── AgentCoordinator.ts   # Agent state management
│   │   ├── AutonomousService.ts  # Scheduled tasks
│   │   ├── BagsApiService.ts     # Bags.fm API client
│   │   └── LaunchWizard.ts       # Token launch flow
│   │
│   ├── routes/
│   │   ├── chat.ts          # Chat endpoints
│   │   ├── tokens.ts        # Token data
│   │   ├── world.ts         # World state
│   │   ├── autonomous.ts    # Autonomous features
│   │   ├── coordination.ts  # Multi-agent
│   │   ├── launch-wizard.ts # Professor Oak
│   │   └── creator-tools.ts # Creator analysis
│   │
│   ├── types/
│   │   └── elizaos.ts       # TypeScript definitions
│   │
│   └── server.ts            # Express entry point
│
├── package.json
└── tsconfig.json
```

## Character File Structure

Each character in `src/characters/definitions/` follows this format:

```typescript
import { Character } from "../../types/elizaos.js";

export const characterName: Character = {
  name: "Display Name",
  bio: [
    "First line of backstory.",
    "Second line about expertise.",
  ],
  lore: [
    "Interesting fact 1.",
    "Interesting fact 2.",
  ],
  style: {
    all: ["How they speak in general."],
    chat: ["Specific chat behaviors."],
  },
  messageExamples: [
    [
      { user: "user", content: { text: "Example question?" } },
      { user: "Character", content: { text: "Example response." } },
    ],
  ],
  topics: ["topic1", "topic2"],
  adjectives: ["friendly", "helpful"],
};
```

## Development

### Adding a New Agent

1. Create character file in `src/characters/definitions/`
2. Register in `src/characters/index.ts`
3. Restart server

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

## Deployment

### With Main App (Recommended)

Deploy alongside BagsWorld main app. Set in main app:
```env
AGENTS_API_URL=https://your-agents-server.com
```

### Standalone (Railway, Render, etc.)

1. Deploy this folder as a Node.js service
2. Set environment variables
3. Expose port 3001

### Docker

```bash
docker build -t bagsworld-agents .
docker run -d --env-file .env -p 3001:3001 bagsworld-agents
```

## Connecting to Main App

The main BagsWorld app connects via:

```env
AGENTS_API_URL=http://localhost:3001
```

When set, character chat in the game routes through this server for full AI responses.

## Troubleshooting

**No AI responses?**
- Check `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set
- Server logs will show `[LLM] Using Anthropic Claude` on startup

**Memory not persisting?**
- Set `DATABASE_URL` to your Neon connection string
- Check server logs for `[Database] Connected to Neon`

**Connection refused from main app?**
- Ensure server is running on port 3001
- Check CORS settings allow your main app origin

## Resources

- [ElizaOS Documentation](https://elizaos.github.io/eliza/)
- [ElizaOS GitHub](https://github.com/elizaOS/eliza)
- [Bags.fm](https://bags.fm)
- [BagsWorld Main Repo](../)
