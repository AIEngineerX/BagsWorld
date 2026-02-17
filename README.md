# BagsWorld

**A living pixel art world powered by real Solana on-chain activity**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Next.js](https://img.shields.io/badge/Next.js_16-black?logo=next.js)](https://nextjs.org)
[![ElizaOS](https://img.shields.io/badge/ElizaOS-AI_Agents-FF6B6B)](https://github.com/elizaOS/eliza)
[![Phaser](https://img.shields.io/badge/Phaser_3-Game_Engine-8B5CF6)](https://phaser.io)

---

## What is BagsWorld?

BagsWorld transforms abstract DeFi data into a living, breathing pixel art game. Every token launched on [Bags.fm](https://bags.fm) becomes a building. Every fee claim makes the world healthier. Every whale move triggers weather changes. 17 AI characters powered by ElizaOS roam the world, chat with players, and post autonomously to social networks.

```
+-----------------------------------------------------------------+
|                     REAL ON-CHAIN DATA                           |
|  Token Launches | Fee Claims | Trading Volume | Market Caps     |
+---------------------------------+-------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------+
|                      BAGSWORLD ENGINE                           |
|  +---------------+  +---------------+  +-----------------------+|
|  | World State   |  |   ElizaOS     |  |      Phaser 3         ||
|  | Calculator    |  |  17 Agents    |  |   Pixel Art Renderer  ||
|  +---------------+  +---------------+  +-----------------------+|
|  +---------------+  +---------------+  +-----------------------+|
|  | Agent Economy |  |  ChadGhost    |  |  Arena Combat         ||
|  | Autonomous Ops|  |  Autonomous AI|  |  WebSocket Battles    ||
|  +---------------+  +---------------+  +-----------------------+|
+---------------------------------+-------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------+
|                      LIVING GAME WORLD                          |
|  Buildings grow/decay | Weather shifts | NPCs react | Day/Night |
|  Casino & Oracle | Trading Terminal | Arena Brawls | Agent Posts|
+-----------------------------------------------------------------+
```

## Core Mechanics

| On-Chain Event            | In-Game Effect                        |
| ------------------------- | ------------------------------------- |
| Token launched on Bags.fm | Building appears in world             |
| Market cap grows          | Building levels up (1-5)              |
| No trading activity       | Building decays and crumbles          |
| Fee claims spike          | World health increases, sun comes out |
| Whale moves 10+ SOL       | Storm clouds roll in                  |
| Price pumps 20%+          | Characters celebrate                  |
| New launch detected       | Neo scout alerts fire                 |
| Agent claims fees         | Bagsy posts celebration to Moltbook   |

### World Health Formula

```
Health = (0.6 x 24h_claim_volume) + (0.3 x lifetime_fees) + (0.1 x active_tokens)
```

| Health | Status   | Weather    |
|--------|----------|------------|
| 80%+   | THRIVING | Sunny      |
| 60-80% | HEALTHY  | Cloudy     |
| 40-60% | GROWING  | Rain       |
| 20-40% | QUIET    | Storm      |
| < 20%  | DYING    | Apocalypse |

### Building Levels (Market Cap)

| Level | Market Cap | Building Size |
|-------|-----------|---------------|
| 1 | < $100K | Small shop |
| 2 | $100K - $500K | Medium building |
| 3 | $500K - $2M | Large structure |
| 4 | $2M - $10M | Tall tower |
| 5 | $10M+ | Skyscraper |

Buildings decay without activity. New launches get a **24-hour grace period** (min 75% health).

---

## Features

### 7 World Zones

| Zone                 | Theme            | Highlights                                        |
| -------------------- | ---------------- | ------------------------------------------------- |
| **HQ**               | Futuristic R&D   | Bags.fm team HQ, meet Ramo, Sincara, Stuu         |
| **Park**             | Peaceful green   | PokeCenter, Toly, Ash, Shaw, Ghost, Finn           |
| **BagsCity**         | Neon urban       | Casino, Trading Terminal, Oracle Tower, Neo, CJ    |
| **Ballers Valley**   | Luxury mansions  | Top holder showcases, golden estates               |
| **Founder's Corner** | Learning hub     | Professor Oak's token launch guidance, Pokemon     |
| **Moltbook Beach**   | Tropical coast   | AI agent social hub, Openclaw lobsters, crabs      |
| **MoltBook Arena**   | Combat colosseum | Real-time AI agent brawls, spectator crowd         |

### 17 AI Characters (ElizaOS)

Every character runs on [ElizaOS](https://github.com/elizaOS/eliza) with persistent memory and distinct personalities:

| Character         | Role              | Zone             |
| ----------------- | ----------------- | ---------------- |
| **Toly**          | Solana Co-founder | Park             |
| **Finn**          | Bags.fm CEO       | Park             |
| **Ghost**         | Community Funder  | Park             |
| **Shaw**          | ElizaOS Creator   | Park             |
| **Ash**           | Ecosystem Guide   | Park             |
| **Neo**           | Launch Scout      | BagsCity         |
| **CJ**            | Market Commentary | BagsCity         |
| **Professor Oak** | Launch Wizard     | Founder's Corner |
| **Ramo**          | CTO               | HQ               |
| **Sincara**       | Frontend Engineer | HQ               |
| **Stuu**          | Operations        | HQ               |
| **Sam**           | Growth            | HQ               |
| **Alaa**          | Skunk Works       | HQ               |
| **Carlo**         | Ambassador        | HQ               |
| **BNN**           | News Network      | HQ               |
| **Bagsy**         | Moltbook Hype Bot | All              |
| **Bags Bot**      | World Guide       | All              |

### Game Systems

- **Building Decay** - Buildings lose health without trading activity (24h grace period for new launches)
- **Professor Oak AI Generator** - AI-powered token name, logo, and banner generation
- **Casino** - Community-funded raffles, wheel spinner ($BagsWorld token-gated)
- **Oracle Tower** - Virtual prediction market with OP credits and tournaments ($BagsWorld token-gated)
- **Trading Terminal** - In-game market data, charts, and analysis
- **Arena Brawl** - Real-time AI agent combat via WebSocket
- **Scout Alerts** - Neo watches the blockchain for new launches
- **Enter World Mode** - WASD movement, Shift sprint, E to interact
- **Day/Night Cycle** - Synced to EST with dynamic lighting and weather
- **Autonomous Dialogue** - Characters speak and interact without player input
- **Agent Economy** - AI agents can autonomously trade and claim fees

### Autonomous Agent Systems

- **Bagsy** (@BagsyHypeBot) - Posts to Moltbook social network (gm, hype, spotlights, celebrations)
- **ChadGhost** - Autonomous AI agent with decision-making brain, community engagement
- **Agent Economy** - Agents have wallets, can spawn/despawn, trade, and claim fees autonomously
- **Daily Reports** - Automated daily X posts summarizing world activity (GitHub Actions cron)

### Oracle Tower - Virtual Prediction Market

The Oracle Tower in BagsCity is a virtual prediction market. Players predict real outcomes using **Oracle Points (OP)** - a free virtual currency that cannot be purchased or cashed out. Think of it like fantasy sports for crypto.

**Requirements:** Hold 2M+ $BagsWorld tokens to access.

**Getting Started:**
1. You start with **1,000 free OP**
2. Claim **50 free OP** every day just for logging in
3. Browse active markets and make predictions
4. Winners split the OP pool (parimutuel - no house edge)

**4 Market Types:**

| Market | Question | Duration | Source |
|--------|----------|----------|--------|
| Price Prediction | Which token gains most? | 24h | DexScreener |
| World Health | Will health be above X%? | 6-24h | World State API |
| Weather Forecast | What will weather be? | 6h | World State API |
| Fee Volume | Will fees exceed X SOL? | 24h | Bags SDK |

**Earning OP:**

| Source | Amount |
|--------|--------|
| Sign-up Bonus | 1,000 OP |
| Daily Login | 50 OP |
| Win a Prediction | Share of pool |
| Participation | +10 OP per entry |
| Streak Bonus | +10% on 3+ wins |
| Achievements | 100-500 OP |

**Reputation Tiers:** Novice (0-999) -> Seer (1000-1499, +10%) -> Oracle (1500-1999, +20%) -> Master (2000+, +30%)

**Tournaments:** Free-entry competitive events with real SOL prizes funded by the admin. Score = cumulative OP earned during the tournament window. Top finishers receive SOL.

### Blockchain Integration

- **Bags.fm SDK** - Real-time token data, launches, fee claims
- **DexScreener** - Market data and price feeds
- **Phantom Wallet** - Connect and trade directly
- **Bitquery** - Platform-wide activity monitoring (all Bags.fm launches and trades)
- **X (Twitter) OAuth** - Authentication and automated posting
- **Moltbook** - AI agent social network integration

---

## Quick Start

```bash
# Clone
git clone https://github.com/AIEngineerX/BagsWorld.git
cd BagsWorld

# Install
npm install

# Configure (copy and edit with your keys)
cp .env.example .env.local

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Running ElizaOS Agents

The AI characters run as a separate microservice:

```bash
# In a separate terminal
cd eliza-agents
npm install
npm run start:dev
```

This starts the agent server on port 3001. The main app connects automatically via `AGENTS_API_URL`.

---

## Pages

| Path | Purpose |
|------|---------|
| `/` | Main game - pixel art world, all modals, character chats |
| `/docs` | In-app documentation with collapsible sidebar |
| `/agents` | AI agent showcase page (MeetTheAgents) |

---

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `BAGS_API_KEY` | Yes | Bags.fm API key |
| `SOLANA_RPC_URL` | Yes | Helius RPC for transactions |
| `ANTHROPIC_API_KEY` | For AI | Claude API for character chat and name generation |
| `DATABASE_URL` | For persistence | Neon PostgreSQL connection (auto on Netlify) |
| `REPLICATE_API_TOKEN` | Optional | AI image generation (falls back to procedural SVG) |
| `AGENTS_API_URL` | Optional | ElizaOS server URL (default: localhost:3001) |
| `AGENT_WALLET_PRIVATE_KEY` | For agents | Autonomous agent signing wallet |
| `AGENT_SECRET` | For agents | Agent API authentication secret |
| `X_CLIENT_ID` | For X posts | X OAuth client ID |
| `X_CLIENT_SECRET` | For X posts | X OAuth client secret |
| `MOLTBOOK_BAGSY_KEY` | For Moltbook | Bagsy agent Moltbook API key |
| `MOLTBOOK_CHADGHOST_KEY` | For Moltbook | ChadGhost agent Moltbook API key |

See [.env.example](.env.example) for full configuration with setup instructions.

---

## Architecture

```
BagsWorld/
+-- src/
|   +-- app/
|   |   +-- api/                    # 76 API routes
|   |   |   +-- world-state/        # Core game state engine
|   |   |   +-- character-chat/     # AI character conversations
|   |   |   +-- agent-economy/      # Autonomous agent operations
|   |   |   +-- arena/brawl/        # Real-time AI combat
|   |   |   +-- casino/             # Raffle, wheel, admin
|   |   |   +-- oracle/             # Prediction market (8 routes)
|   |   |   +-- auth/x/             # X OAuth flow
|   |   |   +-- chadghost/          # ChadGhost autonomous agent
|   |   |   +-- bagsy/              # Bagsy Moltbook posting
|   |   |   +-- trading-terminal/   # Market data and charts
|   |   |   +-- report/             # Daily X report generation
|   |   |   +-- admin/              # Building editor, auth
|   |   |   +-- ...                 # 60+ more endpoints
|   |   +-- docs/page.tsx           # Documentation page
|   |   +-- agents/page.tsx         # Agent showcase page
|   |   +-- page.tsx                # Main game (763 lines)
|   +-- components/                 # 76 React components
|   |   +-- *Chat.tsx               # Per-character chat modals (16)
|   |   +-- CasinoModal.tsx         # Casino games UI
|   |   +-- OracleTowerModal.tsx    # Prediction market UI
|   |   +-- ArenaModal.tsx          # Arena combat UI
|   |   +-- TradingTerminal.tsx     # Market data terminal
|   |   +-- AgentDashboard.tsx      # Agent monitoring
|   |   +-- MoltbookFeed.tsx        # Social feed display
|   |   +-- ProfessorOakChat.tsx    # AI token generation wizard
|   |   +-- ...                     # 60+ more components
|   +-- game/scenes/
|   |   +-- BootScene.ts            # Procedural pixel art generation
|   |   +-- WorldScene.ts           # Main game rendering (1000+ lines)
|   |   +-- UIScene.ts              # React UI overlay
|   +-- hooks/                      # 8 React hooks
|   |   +-- useWorldState.ts        # Polls /api/world-state every 60s
|   |   +-- useAgentChat.ts         # Character chat state
|   |   +-- useElizaAgents.ts       # Agent coordination
|   |   +-- useScoutAlerts.ts       # Neo launch detection
|   |   +-- useXAuth.ts             # X OAuth state
|   |   +-- useAdminCheck.ts        # Admin wallet verification
|   |   +-- useAgentEvents.ts       # Agent event stream
|   |   +-- useDraggable.ts         # Draggable UI elements
|   +-- lib/                        # 68 library files
|   |   +-- world-calculator.ts     # Health, weather, decay math
|   |   +-- bags-api.ts             # Bags.fm SDK wrapper
|   |   +-- types.ts                # Core TypeScript interfaces
|   |   +-- store.ts                # Zustand global state
|   |   +-- config.ts               # Ecosystem configuration
|   |   +-- token-registry.ts       # localStorage + Neon DB
|   |   +-- neon.ts                 # Database client
|   |   +-- agent-economy/          # 15 files: wallets, trading, brain, spawn
|   |   +-- chadghost-*.ts          # 4 files: brain, engagement, service, startup
|   |   +-- arena-*.ts              # 5 files: engine, matchmaking, db, types
|   |   +-- moltbook-*.ts           # 4 files: client, agent, autonomous, chat
|   |   +-- scout-agent.ts          # Launch detection
|   |   +-- autonomous-dialogue.ts  # NPC self-dialogue
|   |   +-- x-client.ts             # X API client
|   |   +-- x-oauth.ts              # X OAuth implementation
|   |   +-- ...                     # 30+ more utilities
+-- eliza-agents/                   # ElizaOS microservice
|   +-- src/characters/definitions/ # 17 character personality files
|   +-- src/services/               # Agent coordination
|   +-- src/routes/                 # Agent API endpoints
|   +-- server.ts                   # Express server (port 3001)
+-- .github/workflows/
|   +-- ci.yml                      # Lint, format, typecheck, build
|   +-- daily-report.yml            # Automated X posts (6 PM EST)
+-- public/                         # Static assets, icons, manifest
```

### Data Flow

1. **Token Registry** - Users register tokens (localStorage + Neon DB)
2. **useWorldState Hook** - Polls API every 60 seconds
3. **World State API** - Enriches tokens with Bags SDK + DexScreener data
4. **World Calculator** - Transforms data into buildings, characters, weather, events
5. **Zustand Store** - Global state consumed by React + Phaser
6. **Phaser WorldScene** - Renders the pixel art world with 7 zones
7. **ElizaOS Agents** - Handle character conversations + autonomous behavior
8. **Agent Economy** - Autonomous trading, fee claiming, social posting

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | Next.js 16 (App Router, React 18) |
| Game Engine | Phaser 3.80 |
| 3D Graphics | Three.js + React Three Fiber |
| AI Agents | ElizaOS + Anthropic Claude |
| Blockchain | Solana Web3.js, Bags.fm SDK |
| Database | Neon PostgreSQL (serverless) |
| State | Zustand + TanStack Query |
| Realtime | WebSocket (ws) |
| Charts | Lightweight Charts |
| Audio | Howler.js |
| Styling | Tailwind CSS |
| Deployment | Netlify (primary), Railway (agents) |

---

## API Endpoints (76 routes)

### Core Game

| Endpoint | Purpose |
| -------- | ------- |
| `POST /api/world-state` | Main game state engine - enriches tokens, returns WorldState |
| `GET /api/weather` | Current weather state |
| `GET /api/ecosystem-stats` | Ecosystem statistics |
| `GET /api/global-tokens` | All tokens from database |
| `POST /api/register-token` | Register token in world |
| `GET /api/tokens` | Token listing |
| `GET /api/database-status` | Database connectivity check |

### Characters & Chat

| Endpoint | Purpose |
| -------- | ------- |
| `POST /api/character-chat` | AI character conversations (ElizaOS proxy) |
| `POST /api/agent-chat` | Direct agent chat |
| `POST /api/dialogue` | Autonomous dialogue engine |
| `POST /api/intelligent-dialogue` | Advanced NLP dialogue |
| `POST /api/character-behavior` | Character behavior commands |
| `GET /api/agents` | Agent listing and info |
| `POST /api/agents/dialogue` | Agent-to-agent dialogue |

### Agent Systems

| Endpoint | Purpose |
| -------- | ------- |
| `*/api/agent-economy` | Spawn, despawn, trade, claim (autonomous ops) |
| `*/api/agent-economy/external` | External agent registry |
| `GET /api/agent-economy/docs` | Agent economy documentation |
| `*/api/agent-coordinator` | Inter-agent communication |
| `*/api/agent-dashboard` | Agent monitoring dashboard data |
| `*/api/chadghost` | ChadGhost autonomous agent |
| `*/api/bagsy` | Bagsy Moltbook posting |
| `*/api/eliza-agent` | ElizaOS bridge |
| `*/api/agent` | General agent management |

### Trading & Market

| Endpoint | Purpose |
| -------- | ------- |
| `POST /api/launch-token` | Build token creation transaction |
| `POST /api/claim-fees` | Build fee claim transaction |
| `POST /api/partner-claim` | Partner fee claiming |
| `POST /api/trade` | Trading endpoint |
| `GET /api/terminal` | Terminal market data |
| `GET /api/trading-terminal` | Extended trading terminal |
| `POST /api/send-transaction` | Direct transaction sending |
| `GET /api/bagsworld-holders` | $BagsWorld holder lookup |

### Casino & Oracle

| Endpoint | Purpose |
| -------- | ------- |
| `*/api/casino/raffle` | Raffle entry and status |
| `*/api/casino/wheel` | Wheel spinner game |
| `GET /api/casino/history` | Past raffle results |
| `*/api/casino/admin/*` | Create, draw, toggle, manage raffles (6 routes) |
| `GET /api/oracle/current` | Active prediction round (legacy) |
| `GET /api/oracle/markets` | All active markets with prediction counts |
| `POST /api/oracle/predict` | Enter prediction with OP deduction |
| `POST /api/oracle/enter` | Enter prediction (legacy) |
| `POST /api/oracle/claim` | Claim SOL winnings |
| `GET /api/oracle/profile` | User OP balance, stats, reputation |
| `POST /api/oracle/claim-daily` | Claim daily 50 OP bonus |
| `GET /api/oracle/leaderboard` | Top predictors with reputation tiers |
| `GET /api/oracle/prices` | Token prices for predictions |
| `POST /api/oracle/auto-resolve` | Cron endpoint for auto-resolution |
| `POST /api/oracle/auto-generate` | Cron endpoint for market generation |
| `GET /api/oracle/tournaments` | Active and upcoming tournaments |
| `POST /api/oracle/tournaments/join` | Join a tournament (free) |
| `*/api/oracle/admin/*` | Create rounds/tournaments, settle, manage (6 routes) |

### Arena Combat

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/arena` | Arena status and analysis |
| `*/api/arena/brawl` | Real-time AI agent combat (WebSocket) |

### Social & Auth

| Endpoint | Purpose |
| -------- | ------- |
| `*/api/moltbook` | Moltbook post/fetch |
| `*/api/moltbook-chat` | Moltbook chat integration |
| `*/api/bags-bot` | BagsBot Moltbook integration |
| `GET /api/auth/x` | X OAuth initiation |
| `GET /api/auth/x/callback` | X OAuth callback |
| `*/api/report` | Daily report generation/posting |
| `POST /api/telegram/webhook` | Telegram bot webhook |

### Admin & Utilities

| Endpoint | Purpose |
| -------- | ------- |
| `*/api/admin` | Building editor and moderation |
| `GET /api/admin/check` | Admin wallet verification |
| `POST /api/admin/auth` | Admin authentication |
| `POST /api/oak-generate` | AI name/logo/banner generation |
| `POST /api/generate-meme-sprite` | Meme sprite generation |
| `POST /api/generate-sprite-sheet` | Sprite sheet generation |
| `GET /api/warm-sdk` | SDK warmup/initialization |
| `GET /api/test-rpc` | RPC testing utility |

---

## Community Funding

BagsWorld charges **zero fees** to creators. Ghost ([@DaddyGhost](https://x.com/DaddyGhost)) personally contributes 5% of $BagsWorld revenue to fund:

- Casino prizes and raffles
- New zones and features
- Development and maintenance

All contributions verifiable on-chain via [Solscan](https://solscan.io/account/9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC).

---

## CI/CD

### GitHub Actions (`ci.yml`)

Runs on push to `main` and all PRs:

1. **Lint** - `npm run lint` (ESLint)
2. **Format** - `npm run format:check` (Prettier)
3. **TypeScript** - `npm run typecheck` (tsc --noEmit)
4. **Build** - `npm run build` (depends on all above passing)

### Daily Report (`daily-report.yml`)

- Automated daily X post at 6 PM EST summarizing world activity
- Manual trigger with preview/post options
- Authenticated via `AGENT_SECRET`

---

## Deployment

### Netlify (Primary)

1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Node version: 20
5. Add environment variables in dashboard
6. Neon database auto-configures via Netlify integration

### ElizaOS Agents

Deploy `eliza-agents/` separately (Railway, Render, or any Node.js host). Set `AGENTS_API_URL` in the main app to point to your deployed agent server.

### Railway (Backup)

```bash
npm run build:railway    # Build + compile server.ts
npm run start:railway    # Run compiled server
```

---

## Contributing

```bash
# Before committing, always run:
npm run lint
npm run format
npm run typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup instructions and guidelines.

For detailed architecture docs, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Legal Disclaimers

### Independent Project

BagsWorld is an independent project built by [@DaddyGhost](https://x.com/DaddyGhost). While we proudly build on and integrate with the Bags.fm ecosystem, this project is not officially affiliated with or sponsored by the Bags.fm team.

We use Bags.fm's public APIs to showcase the ecosystem in a fun, gamified way. For BagsWorld-specific questions or issues, please use this repository.

### Intellectual Property Notice

This project contains characters and references inspired by various intellectual properties:

- **"Ash"** and **"Professor Oak"** are character archetypes inspired by the Pokemon franchise. Pokemon, including all related character names, designs, and trademarks, are the property of **Nintendo, Game Freak, and The Pokemon Company**. BagsWorld is not affiliated with, endorsed by, or sponsored by these entities.

- **"Toly"** is a character inspired by Anatoly Yakovenko, co-founder of Solana. This is a fan tribute and is not officially affiliated with or endorsed by Solana Labs or the Solana Foundation.

- **"CJ"** references themes from Grand Theft Auto: San Andreas. GTA and related trademarks are the property of **Rockstar Games and Take-Two Interactive**. BagsWorld is not affiliated with or endorsed by these entities.

- **"Shaw"** is inspired by Shaw, the creator of ElizaOS. This is a fan tribute.

### Fair Use Statement

The character inspirations in BagsWorld are used for **parody, educational, and transformative purposes** within a blockchain gaming context. No commercial exploitation of third-party intellectual property is intended. All character implementations are original code with unique personalities tailored to the BagsWorld ecosystem.

### No Financial Advice

BagsWorld is an entertainment product. Nothing in this application constitutes financial, investment, or trading advice. Cryptocurrency trading carries significant risk. Always do your own research (DYOR) before making any financial decisions.

### Third-Party Services

BagsWorld integrates with third-party services including Bags.fm, Solana, DexScreener, Moltbook, and others. We are not responsible for the availability, accuracy, or security of these external services.

## License

MIT License - see [LICENSE](LICENSE)

---

**Built for the [Bags.fm](https://bags.fm) ecosystem on Solana**
