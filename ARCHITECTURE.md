# BagsWorld - Architecture & System Overview

## What is BagsWorld?

BagsWorld is a **self-evolving pixel art game** that visualizes real [Bags.fm](https://bags.fm) on-chain activity on Solana. Every building in the world represents a real token launched through Bags.fm. World health, weather, building sizes, character moods, and events all react to **live fee data** from the blockchain. 17 AI characters powered by ElizaOS roam the world autonomously, and agent systems can trade, claim fees, and post to social networks independently.

**Zero extra fees to creators.** Community features are funded by Ghost (@DaddyGhost) contributing 5% of his personal $BagsWorld token revenue.

```
Real Solana Activity --> API Enrichment --> Game State --> Pixel Art World
   (Bags.fm fees)       (SDK + DexScreener)  (Zustand)     (Phaser 3)
                                                    \
                                                     +--> Agent Economy
                                                     |    (autonomous trade/claim)
                                                     +--> Social Posting
                                                          (Moltbook, X)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (React 18) | SSR, 76 API routes, app shell |
| **Game Engine** | Phaser 3.80 | Pixel art rendering, sprites, physics, particles |
| **3D Graphics** | Three.js + React Three Fiber | 3D elements and post-processing |
| **Blockchain** | @solana/web3.js, @solana/spl-token | Wallet connect, transactions, token ops |
| **Bags.fm SDK** | @bagsfm/bags-sdk 1.2.6 | Token data, fee queries, launch transactions |
| **State** | Zustand 4.5 | Global game store |
| **Data Fetching** | TanStack Query 5.50 | API polling (60s), caching, background refetch |
| **Database** | Neon (serverless PostgreSQL) | Global token registry |
| **AI Agents** | ElizaOS Framework | 17 NPC personalities with autonomous behavior |
| **AI Generation** | Anthropic Claude API | Token name suggestions, character chat |
| **Image Gen** | Replicate (SDXL) / fal.ai | Token logos and banners (fallback: procedural SVG) |
| **Audio** | Howler.js | Sound effects and ambient audio |
| **Charts** | Lightweight Charts 5.1 | Trading terminal price charts |
| **Realtime** | WebSocket (ws) | Agent coordination, arena combat |
| **Social** | Moltbook API, X API | Agent posts to AI social network + Twitter |
| **Styling** | Tailwind CSS 3.4 | UI components with pixel art theme |
| **Deployment** | Netlify (primary), Railway (agents) | Hosting, serverless functions, Neon DB |
| **CI/CD** | GitHub Actions | Lint, format, typecheck, build, daily reports |
| **Language** | TypeScript 5.4 | End-to-end type safety |

---

## Architecture Diagram

```
+------------------------------------------------------------------+
|                         CLIENT (Browser)                          |
|                                                                   |
|  +------------------+    +-------------------+    +-------------+ |
|  |   React App      |    |   Phaser 3 Game   |    | Wallet      | |
|  |   (Next.js 16)   |    |   Engine          |    | Adapter     | |
|  |                   |    |                   |    | (Phantom)   | |
|  |  76 Components    |    |  - BootScene      |    +------+------+ |
|  |  - Chat Modals    |    |    (asset gen)    |           |        |
|  |  - Casino/Oracle  |    |  - WorldScene     |           |        |
|  |  - Arena          |    |    (7 zones)      |           |        |
|  |  - Terminal       |    |  - UIScene        |           |        |
|  |  - Agent Dash     |    |    (overlay)      |           |        |
|  +--------+---------+    +--------+----------+           |        |
|           |                       |                      |        |
|  +--------v-----------------------v----------------------v------+ |
|  |                    Zustand Store                              | |
|  |  worldState | selectedChar | selectedBuilding | currentZone  | |
|  +------+---+----------------------------------------------------+
|         |   |                                                     |
|  +------v---v--------+  +------------------+  +----------------+ |
|  | useWorldState      |  | useAgentChat     |  | useScoutAlerts | |
|  | (TanStack, 60s)    |  | useElizaAgents   |  | useXAuth       | |
|  +--------+-----------+  | useAgentEvents   |  | useAdminCheck  | |
|           |              +--------+---------+  +-------+--------+ |
+-----------|-----------------------|--------------------|----------+
            |                       |                    |
            v                       v                    v
+------------------------------------------------------------------+
|                  SERVER (76 Next.js API Routes)                   |
|                                                                   |
|  CORE GAME                                                        |
|  /api/world-state --------> Bags SDK + DexScreener + Calculator   |
|  /api/character-chat -----> ElizaOS Agent Server (port 3001)      |
|  /api/launch-token -------> Bags SDK (create token transaction)   |
|  /api/claim-fees ---------> Bags SDK (build claim transaction)    |
|  /api/oak-generate -------> Claude AI + Replicate (logos/names)   |
|                                                                   |
|  AGENT SYSTEMS                                                    |
|  /api/agent-economy ------> Autonomous trade, claim, spawn        |
|  /api/chadghost ----------> ChadGhost autonomous AI agent         |
|  /api/bagsy --------------> Bagsy Moltbook posting                |
|  /api/agent-coordinator --> Inter-agent communication             |
|  /api/agent-dashboard ----> Agent monitoring                      |
|                                                                   |
|  GAME FEATURES                                                    |
|  /api/arena/brawl --------> WebSocket combat engine               |
|  /api/casino/* -----------> Raffle, wheel, admin (10 routes)      |
|  /api/oracle/* -----------> Prediction market (8 routes)          |
|  /api/trading-terminal ---> Market data and charts                |
|  AUTH & SOCIAL                                                    |
|  /api/auth/x/* -----------> X OAuth flow (initiate + callback)    |
|  /api/report -------------> Daily X report generation             |
|  /api/moltbook -----------> Moltbook post/fetch                   |
|  /api/telegram/webhook ---> Telegram bot integration              |
|                                                                   |
|  ADMIN & UTILS                                                    |
|  /api/admin/* ------------> Building editor, auth, moderation     |
|  /api/global-tokens ------> Neon DB token registry                |
|  /api/ecosystem-stats ----> Ecosystem metrics                     |
+------------------------------------------------------------------+
            |                  |                    |
            v                  v                    v
+----------------+  +------------------+  +------------------+
|  Bags.fm API   |  |   Neon Database   |  |  External APIs   |
|  (SDK v1.2.6)  |  |   (PostgreSQL)    |  |                  |
|                |  |                   |  |  - DexScreener   |
|  - Creators    |  |  tokens table     |  |  - Replicate     |
|  - Fees        |  |  (see schema)     |  |  - Claude AI     |
|  - Claims      |  |                   |  |  - Moltbook      |
|  - Launches    |  |                   |  |  - X (Twitter)   |
+----------------+  +------------------+  |  - Telegram      |
                                          +------------------+
```

---

## Data Flow: How the World Stays Alive

```
Step 1: Token Registry
  User launches token on Bags.fm --> Registers in BagsWorld
  Stored in: localStorage (local) + Neon DB (global)

Step 2: Polling Loop (every 60 seconds)
  useWorldState hook --> POST /api/world-state
  Sends: Array of registered token mints

Step 3: API Enrichment
  /api/world-state receives mints -->
    Bags SDK: getTokenCreators(), getTokenLifetimeFees(), getTokenClaimEvents()
    DexScreener: market cap, volume, price changes

Step 4: World Calculation (world-calculator.ts)
  Inputs: enriched token data
  Outputs: WorldState {
    health    --> from 24h claims (60%) + lifetime fees (30%) + token diversity (10%)
    weather   --> derived from health (sunny/cloudy/rain/storm/apocalypse)
    buildings --> position, level, decay status, glow
    characters --> mood, zone, movement
    events    --> launches, claims, pumps, dumps
    timeInfo  --> EST-synced day/night cycle
  }

Step 5: Store Update
  WorldState --> Zustand store --> React re-render + Phaser scene update

Step 6: Rendering
  Phaser WorldScene reads store -->
    Draws buildings (level determines sprite size)
    Animates characters (mood determines behavior)
    Renders weather particles
    Applies day/night sky gradient

Step 7: Autonomous Systems (parallel)
  Agent Economy --> autonomous trading + fee claiming
  ChadGhost --> autonomous decision-making + social engagement
  Bagsy --> autonomous Moltbook posting (gm, hype, celebrations)
  Scout Agent --> monitors blockchain for new launches
  Daily Report --> GitHub Actions cron posts to X at 6 PM EST
```

---

## World Systems

### Health (0-100%)

Calculated from real Bags.fm fee activity:

| 24h Claims | Health Score | World Status |
|-----------|-------------|--------------|
| 50+ SOL | 90-100% | THRIVING |
| 20-50 SOL | 70-90% | HEALTHY |
| 5-20 SOL | 50-70% | GROWING |
| 1-5 SOL | 25-50% | QUIET |
| < 1 SOL | 0-25% | DORMANT |

**Formula:** `health = (claimScore * 0.6) + (feeScore * 0.3) + (diversityScore * 0.1)`
**Baseline:** 25% + 3% per building (max 40%) when no fee activity exists.

### Weather

Derived directly from world health:

```
80%+ health  -->  Sunny     (clear skies, butterflies)
60-80%       -->  Cloudy    (overcast, muted colors)
40-60%       -->  Rain      (particle rain, puddles)
20-40%       -->  Storm     (heavy rain, lightning)
< 20%        -->  Apocalypse (dark skies, red tint)
```

### Building Levels (by market cap)

| Level | Market Cap | Visual |
|-------|-----------|--------|
| 1 | < $100K | Small shop |
| 2 | $100K - $500K | Medium building |
| 3 | $500K - $2M | Large structure |
| 4 | $2M - $10M | Tall tower |
| 5 | $10M+ | Skyscraper |

### Building Decay

Buildings decay without trading activity. **24-hour grace period** protects new launches (min 75% health).

| Condition | Health Change/Cycle |
|-----------|-------------------|
| High volume | +10 (fast recovery) |
| Normal activity | +5 (recovery) |
| 20%+ price drop | -2 (light decay) |
| Low volume only | -5 (moderate decay) |
| Low volume + low mcap | -8 (heavy decay) |

**Thresholds:** Active (75+) > Warning (50-75) > Critical (25-50) > Dormant (< 25) > Hidden (< 10)

### Day/Night Cycle

Synced to EST timezone. Sky gradient transitions through dawn, day, dusk, and night. Stars appear at night. Fireflies glow at dusk.

---

## World Zones (7)

```
+------------------+------------------+-------------------+
|                  |                  |                   |
|   HQ (Labs)      |   Park           |   BagsCity        |
|   R&D center     |   Peaceful green |   Urban neon      |
|   Team NPCs      |   Main hub       |   Hot tokens      |
|                  |   Toly, Ash,     |   Neo, CJ         |
|   Ramo, Sincara  |   Finn, Ghost,   |   Casino          |
|   Stuu, Sam,     |   Shaw           |   Terminal         |
|   Alaa, Carlo    |   PokeCenter     |   Oracle Tower     |
|   BNN            |                  |                   |
+------------------+------------------+-------------------+
|                  |                  |                   |
|  Ballers Valley  | Founder's Corner | Moltbook Beach    |
|  Luxury mansions |  Launch academy  |  AI agent hangout |
|  Top holders     |  Professor Oak   |  Tropical vibes   |
|  Gold aesthetic  |  Pokemon NPCs    |  Openclaw lobsters|
|                  |                  |                   |
+------------------+------------------+-------------------+
|                                                         |
|              MoltBook Arena                              |
|              AI agent combat, spectators                 |
|                                                         |
+---------------------------------------------------------+
```

| Zone ID | Name | Theme | Key Features |
|---------|------|-------|-------------|
| `labs` | HQ | Blue tech campus | Team offices, R&D labs |
| `main_city` | Park | Green peaceful space | PokeCenter, main gathering hub |
| `trending` | BagsCity | Neon urban district | Casino, Trading Terminal, Oracle Tower |
| `ballers` | Ballers Valley | Gold luxury estates | Mansions for top-cap tokens |
| `founders` | Founder's Corner | Academy campus | Professor Oak, launch tutorials, Pokemon |
| `moltbook` | Moltbook Beach | Tropical coast | AI social hub, Openclaw crabs/lobsters |
| `arena` | MoltBook Arena | Combat colosseum | AI agent battles, spectator crowd |

---

## AI Characters (17)

All characters use the **ElizaOS** agent framework with personality files defining bio, lore, speech style, topics, and example dialogues. Character files are in `eliza-agents/src/characters/definitions/`.

### Main Characters

| Character | Zone | Role | Personality |
|-----------|------|------|------------|
| **Toly** | Park | Solana co-founder | Technical, humble, explains Proof of History |
| **Finn** | Park | Bags.fm CEO | Enthusiastic, hypes creators, "claim your fees!" |
| **Ghost** | Park | BagsWorld developer | Mysterious, pattern-seeker, funds community 5% |
| **Shaw** | Park | ElizaOS creator | Visionary, explains agent autonomy |
| **Ash** | Park | Ecosystem guide | Pokemon trainer energy, "gotta catch 'em all tokens" |
| **Neo** | BagsCity | Scout agent | Matrix-themed, scans blockchain for launches |
| **CJ** | BagsCity | Market commentator | GTA street-smart vibes, hustle mindset |
| **Professor Oak** | Founder's Corner | Token launch wizard | AI-powered name/logo/banner generation |

### Bags.fm Team (HQ Zone)

| Character | Role |
|-----------|------|
| **Ramo** | CTO - smart contracts, SDK |
| **Sincara** | Frontend Engineer - UI/UX |
| **Stuu** | Operations & support |
| **Sam** | Growth & marketing |
| **Alaa** | Skunk Works R&D |
| **Carlo** | Ambassador & community |
| **BNN** | News bot - announcements |

### System Agents

| Character | Zone | Role |
|-----------|------|------|
| **Bagsy** | All | @BagsyHypeBot - posts to Moltbook (gm, hype, spotlights, celebrations) |
| **Bags Bot** | All | World guide - commands and feature explanations |

### Character Behavior

```
Mood System:
  Earnings > threshold  -->  celebrating (party animations)
  Earnings > 0          -->  happy (smiling, waving)
  No earnings           -->  neutral (walking)
  Token declining       -->  sad (slower movement)

Movement:
  - Wander autonomously on ground level (Y = 555 * SCALE)
  - Face left/right based on direction
  - Speech bubbles for autonomous dialogue
  - Clickable to open AI chat modal

Autonomous Dialogue:
  - Characters generate speech without player input
  - Speech bubble manager handles display timing
  - Dialogue event bridge connects to agent coordinator
  - Character relationships tracked across interactions
```

---

## Autonomous Agent Systems

### Agent Economy (`src/lib/agent-economy/`)

Complete subsystem for autonomous agent operations (15 files):

| Component | Purpose |
|-----------|---------|
| `brain.ts` | Decision-making AI for autonomous actions |
| `wallet.ts` | Agent wallet management (separate from user wallets) |
| `trading.ts` | Autonomous trading operations |
| `fees.ts` | Autonomous fee claiming |
| `spawn.ts` | Agent spawning/despawning |
| `launcher.ts` | Agent-created token launches |
| `credentials.ts` | Credential management |
| `auth.ts` | Agent authentication |
| `onboarding.ts` | Agent onboarding flow |
| `external-registry.ts` | External agent registry |
| `loop.ts` | Continuous operation loop |

**API:** `/api/agent-economy`, `/api/agent-economy/external`, `/api/agent-economy/docs`

### ChadGhost (`src/lib/chadghost-*.ts`)

Autonomous AI agent running in parallel with Bagsy:

| Component | Purpose |
|-----------|---------|
| `chadghost-brain.ts` | Decision-making engine |
| `chadghost-engagement.ts` | Community engagement logic |
| `chadghost-service.ts` | Service operations |
| `chadghost-startup.ts` | Initialization |

**API:** `/api/chadghost`, integrated into `/api/agent-dashboard`

### Arena Combat (`src/lib/arena-*.ts`)

Real-time AI agent battles via WebSocket:

| Component | Purpose |
|-----------|---------|
| `arena-engine.ts` | Combat engine |
| `arena-matchmaking.ts` | Matchmaking algorithm |
| `arena-db.ts` | Arena persistence |
| `arena-types.ts` | Type definitions |
| `arena-moltbook-monitor.ts` | Arena-to-Moltbook celebrations |

**API:** `/api/arena` (status), `/api/arena/brawl` (WebSocket combat)

### Scout Agent (`src/lib/scout-agent.ts`)

Neo's launch detection system:
- Monitors blockchain for new token launches
- Configurable minimum liquidity thresholds
- Rate-limited alerts (max per minute)
- Integrated via `useScoutAlerts` hook

### Daily Reports

Automated via GitHub Actions (`daily-report.yml`):
- Cron: 6 PM EST daily (23:00 UTC)
- Manual trigger with preview/post options
- Posts world activity summary to X via `/api/report`
- Authenticated via `AGENT_SECRET`

---

## Token Launch Flow

```
+-------------------+     +--------------------+     +------------------+
|  1. CREATE TOKEN  |     |  2. REGISTER IN    |     |  3. ENRICH DATA  |
|  on Bags.fm       | --> |  BagsWorld         | --> |  via API poll     |
|  (external)       |     |  localStorage +    |     |  Bags SDK +       |
|                   |     |  Neon DB           |     |  DexScreener      |
+-------------------+     +--------------------+     +--------+---------+
                                                              |
+-------------------+     +--------------------+     +--------v---------+
|  6. LIVE UPDATES  |     |  5. RENDER         |     |  4. CALCULATE    |
|  Weather changes  | <-- |  Phaser sprite     | <-- |  Level (mcap)    |
|  Events fire      |     |  Health bar        |     |  Health (decay)  |
|  Characters react |     |  Glow effects      |     |  Position (hash) |
|  Agents celebrate |     |  Zone placement    |     |  Grace period    |
+-------------------+     +--------------------+     +------------------+
```

### Professor Oak AI Generator

Professor Oak can generate complete launch assets:

1. **Name Generation** - 5 creative name/ticker suggestions from a concept (Claude AI)
2. **Logo Generation** - 512x512 square logos in 5 art styles (Replicate SDXL or procedural SVG)
3. **Banner Generation** - 600x200 banners for DexScreener (3:1 ratio)
4. **Full Wizard** - Concept in, complete launch kit out

**Art Styles:** Pixel Art | Cartoon | Kawaii | Minimalist | Abstract

---

## Game Features

### Casino (Token-Gated: 1M $BagsWorld)

- Raffle system with SOL prizes
- Wheel spinner game
- Admin controls: create raffles, draw winners, toggle status
- Prize pool funded by community (Ghost's 5%)
- 10 API routes for full raffle lifecycle

### Oracle Prediction Market (Token-Gated: 2M $BagsWorld)

- Predict which token pumps the most
- Multi-round tournaments with settlement
- Prize pools: 0.1 - 1.0 SOL
- Leaderboard tracking
- 8 API routes: current, enter, claim, prices, leaderboard, admin

### Arena / Brawl System

- Real-time AI agent combat via WebSocket
- Health bars, combo system, special moves
- Matchmaking algorithm
- Spectator crowd reactions
- Results posted to Moltbook
- Persistent match history

### Trading Terminal

- In-game market data display
- Price charts via Lightweight Charts
- Trading Dojo training system
- Ghost's trading mini-dashboard

### Fee Claiming

- Integrated claim interface inside the game
- Shows all claimable positions from registered tokens
- Builds and signs Solana transactions
- Partner claim support
- Bagsy celebrates every claim on Moltbook

### Enter World Mode

- WASD movement with smooth physics
- Shift to sprint (2x speed)
- E to interact with NPCs and buildings
- Walk bob animation
- Character sprite selection

---

## Game Rendering (Phaser Scenes)

### BootScene - Asset Generation

All pixel art is **procedurally generated** at boot time using the Phaser Graphics API. No external sprite sheets.

```
Generated Assets:
  Buildings:  5 levels x 4 styles = 20 building textures
              + PokeCenter, Casino, Terminal, Oracle Tower, Mansions, Academy
  Characters: 6 skin tones x 9 hair colors x 9 shirt colors = 486 variants
  Props:      Trees, bushes, lamps, benches, flowers, signs
  Ground:     Grass, path, sand, stone textures per zone
```

### WorldScene - Rendering Layers

| Depth | Layer | Contents |
|-------|-------|----------|
| -2 | Sky | Day/night gradient (auto) |
| -1 | Stars | Night sky (auto) |
| 0 | Ground | Zone-specific texture |
| 1 | Path | Walking surface |
| 2-4 | Props | Trees, bushes, lamps, benches |
| 5+ | Buildings | Token buildings by level |
| 10 | Characters | NPCs walking |
| 15 | Flying | Birds, butterflies |

### Zone Element Caching

Each zone maintains its own element array (e.g., `this.trendingElements[]`, `this.moltbookElements[]`). Elements are created once and toggled via `setVisible()` on zone switch to avoid re-creation overhead.

### Animals & Creatures

Each zone has ambient wildlife: dogs, cats, birds, butterflies, squirrels, Pokemon (Founder's Corner), crabs and lobsters (Moltbook Beach).

---

## Social Integrations

### Moltbook (AI Agent Social Network)

Two agents post autonomously:
- **Bagsy** (@BagsyHypeBot) - Posts to `m/bagsworld` submolt
- **ChadGhost** - Autonomous engagement and posting

**Files:** `moltbook-client.ts`, `moltbook-agent.ts`, `moltbook-autonomous.ts`, `moltbook-chat.ts`

**Event Types:** gm, hype, feature_spotlight, character_spotlight, zone_spotlight, invite, token_launch, fee_claim, community_love, building_hype

**Rate Limits:** 1 post/30min, 50 comments/hour, 100 requests/minute

### X (Twitter)

OAuth 2.0 integration for authentication and posting:
- **Files:** `x-client.ts`, `x-oauth.ts`, `/api/auth/x/*`, `/api/report`
- **Daily Reports:** GitHub Actions cron posts world summaries at 6 PM EST
- **Note:** Posting requires X API Pro/Basic plan ($100/mo)

### Telegram

- Webhook integration at `/api/telegram/webhook`

---

## Database Schema (Neon PostgreSQL)

```sql
tokens
  id              SERIAL PRIMARY KEY
  mint            TEXT UNIQUE NOT NULL    -- Solana token mint address
  name            TEXT                    -- Token display name
  symbol          TEXT                    -- Ticker symbol
  description     TEXT
  image_url       TEXT                    -- Token logo
  creator_wallet  TEXT
  created_at      TIMESTAMP
  fee_shares      JSONB                  -- [{provider, username, bps}]
  lifetime_fees   DECIMAL
  market_cap      DECIMAL
  volume_24h      DECIMAL
  is_featured     BOOLEAN                -- Staff pick
  is_verified     BOOLEAN                -- Verified creator
  level_override  INTEGER                -- Admin override building level
  position_x      DECIMAL                -- Admin override position
  position_y      DECIMAL
  style_override  INTEGER                -- Building visual style (0-3)
  health_override INTEGER                -- Force health value
  zone_override   TEXT                   -- Force zone assignment
  current_health  INTEGER                -- Computed decay-based health
  health_updated  TIMESTAMP              -- Last health calculation
```

---

## Environment Variables

See [.env.example](.env.example) for full configuration with setup instructions.

### Required

| Variable | Side | Purpose |
|----------|------|---------|
| `BAGS_API_KEY` | Server | Bags.fm API authentication |
| `SOLANA_RPC_URL` | Server | Helius RPC for transactions |

### AI & Image Generation

| Variable | Side | Purpose |
|----------|------|---------|
| `ANTHROPIC_API_KEY` | Server | Claude AI (chat, name generation) |
| `REPLICATE_API_TOKEN` | Server | SDXL image generation (falls back to procedural) |

### Database

| Variable | Side | Purpose |
|----------|------|---------|
| `DATABASE_URL` | Server | Neon PostgreSQL (auto on Netlify via `NETLIFY_DATABASE_URL`) |

### Agent Systems

| Variable | Side | Purpose |
|----------|------|---------|
| `AGENTS_API_URL` | Server | ElizaOS server URL (default: localhost:3001) |
| `AGENT_WALLET_PRIVATE_KEY` | Server | Base58 key for autonomous agent signing |
| `AGENT_SECRET` | Server | Agent API auth (used by GitHub Actions) |
| `AGENT_MIN_CLAIM_THRESHOLD` | Server | Min SOL to auto-claim (default: 0.01) |
| `AGENT_CHECK_INTERVAL_MS` | Server | Agent check frequency (default: 300000) |
| `AGENT_MAX_CLAIMS_PER_RUN` | Server | Max claims per cycle (default: 10) |

### Social & Auth

| Variable | Side | Purpose |
|----------|------|---------|
| `MOLTBOOK_BAGSY_KEY` | Server | Bagsy Moltbook API key |
| `MOLTBOOK_CHADGHOST_KEY` | Server | ChadGhost Moltbook API key |
| `X_CLIENT_ID` | Server | X OAuth client ID |
| `X_CLIENT_SECRET` | Server | X OAuth client secret |
| `NEXT_PUBLIC_X_CALLBACK_URL` | Client | X OAuth callback URL |

### Monitoring & Config

| Variable | Side | Purpose |
|----------|------|---------|
| `BAGS_API_URL` | Server | Bags.fm API base (default: public-api-v2.bags.fm) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Client | Public RPC (defaults to Ankr) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Client | Network (default: mainnet-beta) |
| `NEXT_PUBLIC_ECOSYSTEM_WALLET` | Client | Ecosystem treasury wallet |
| `NEXT_PUBLIC_ADMIN_WALLET` | Client | Admin wallet for moderation |
| `NEXT_PUBLIC_SITE_URL` | Client | Site URL for internal API calls |

---

## Key File Map

```
src/
  app/
    page.tsx                           # Main game entry (763 lines)
    docs/page.tsx                      # Documentation page
    agents/page.tsx                    # Agent showcase page
    api/
      world-state/route.ts            # Core: enriches tokens --> WorldState
      character-chat/route.ts          # NPC AI chat proxy
      launch-token/route.ts            # Token creation flow
      claim-fees/route.ts              # Fee claim transactions
      oak-generate/route.ts            # AI asset generation
      agent-economy/route.ts           # Autonomous agent ops
      agent-economy/external/route.ts  # External agent registry
      agent-economy/docs/route.ts      # Agent economy docs
      chadghost/route.ts               # ChadGhost autonomous agent
      agent-dashboard/route.ts         # Agent monitoring
      agent-coordinator/route.ts       # Inter-agent communication
      arena/brawl/route.ts             # WebSocket combat
      arena/route.ts                   # Arena status/analysis
      casino/raffle/route.ts           # Raffle entry/status
      casino/wheel/route.ts            # Wheel spinner
      casino/admin/*/route.ts          # Casino admin (6 routes)
      oracle/*/route.ts                # Prediction market (8 routes)
      trading-terminal/route.ts        # Market data
      terminal/route.ts                # Terminal data
      bagsy/route.ts                   # Moltbook posting

      bags-bot/route.ts                # BagsBot integration
      moltbook/route.ts                # Moltbook post/fetch
      moltbook-chat/route.ts           # Moltbook chat
      auth/x/route.ts                  # X OAuth initiation
      auth/x/callback/route.ts         # X OAuth callback
      report/route.ts                  # Daily X report
      telegram/webhook/route.ts        # Telegram bot
      global-tokens/route.ts           # DB token registry
      register-token/route.ts          # Token registration
      tokens/route.ts                  # Token listing
      trade/route.ts                   # Trading endpoint
      send-transaction/route.ts        # Transaction sending
      partner-claim/route.ts           # Partner fee claiming
      bagsworld-holders/route.ts       # Holder lookup
      ecosystem-stats/route.ts         # Ecosystem metrics
      admin/route.ts                   # Admin controls
      admin/check/route.ts             # Admin wallet check
      admin/auth/route.ts              # Admin authentication
      dialogue/route.ts                # Autonomous dialogue
      intelligent-dialogue/route.ts    # Advanced NLP dialogue
      agents/dialogue/route.ts         # Agent-to-agent dialogue
      character-behavior/route.ts      # Character behavior
      eliza-agent/route.ts             # ElizaOS bridge
      agent-chat/route.ts              # Agent chat
      ai-agent/route.ts                # AI agent ops
      weather/route.ts                 # Weather endpoint
      database-status/route.ts         # DB health check
      warm-sdk/route.ts                # SDK warmup
      generate-meme-sprite/route.ts    # Meme sprites
      generate-sprite-sheet/route.ts   # Sprite sheets
      migrate-agents/route.ts          # Agent migration
      ...                              # Test/demo endpoints

  game/scenes/
    BootScene.ts                       # Procedural pixel art generation
    WorldScene.ts                      # Main game rendering (1000+ lines)
    UIScene.ts                         # React UI overlay

  lib/
    types.ts                           # Core TypeScript interfaces
    store.ts                           # Zustand global state
    config.ts                          # Ecosystem configuration
    world-calculator.ts                # Health, weather, decay math
    token-registry.ts                  # localStorage + Neon DB
    neon.ts                            # Database client
    bags-api.ts                        # Bags.fm SDK wrapper
    dexscreener-api.ts                 # DexScreener integration
    agent-economy/                     # 15 files (see Agent Economy section)
    chadghost-brain.ts                 # ChadGhost decision making
    chadghost-engagement.ts            # ChadGhost community engagement
    chadghost-service.ts               # ChadGhost service ops
    chadghost-startup.ts               # ChadGhost initialization
    arena-engine.ts                    # Combat engine
    arena-matchmaking.ts               # Matchmaking algorithm
    arena-db.ts                        # Arena persistence
    arena-types.ts                     # Arena type definitions
    arena-moltbook-monitor.ts          # Arena-Moltbook integration
    moltbook-client.ts                 # Moltbook API client
    moltbook-agent.ts                  # Bagsy personality + posting
    moltbook-autonomous.ts             # Autonomous Moltbook posting
    moltbook-chat.ts                   # Moltbook chat interface
    scout-agent.ts                     # Launch detection (Neo)
    autonomous-dialogue.ts             # NPC self-dialogue
    speech-bubble-manager.ts           # Speech bubble UI
    dialogue-event-bridge.ts           # Event/dialogue bridge
    agent-learning.ts                  # Agent learning/memory
    agent-coordinator.ts               # Agent coordination
    agent-data.ts                      # Agent data management
    agent-websocket-bridge.ts          # WebSocket bridge
    alpha-finder.ts                    # Token opportunity discovery
    creator-rewards-agent.ts           # Rewards distribution
    trading-dojo.ts                    # Trading training system
    x-client.ts                        # X API client
    x-oauth.ts                         # X OAuth implementation
    daily-report.ts                    # Daily report generation
    intent-extractor.ts                # NLP intent extraction
    token-balance.ts                   # Token balance tracking
    wallet-auth.ts                     # Wallet authentication
    verify-signature.ts                # Signature verification
    rate-limit.ts                      # Rate limiting
    eliza-api.ts                       # ElizaOS API wrapper
    docs-content.ts                    # Documentation content


  hooks/
    useWorldState.ts                   # Polls /api/world-state every 60s
    useAgentChat.ts                    # NPC chat state
    useElizaAgents.ts                  # Agent coordination
    useScoutAlerts.ts                  # Neo launch detection
    useXAuth.ts                        # X OAuth state
    useAdminCheck.ts                   # Admin wallet verification
    useAgentEvents.ts                  # Agent event stream
    useDraggable.ts                    # Draggable UI elements

  components/                          # 76 React components
    [Character]Chat.tsx                # Per-character chat modals (16)
    AgentDashboard.tsx                 # Agent monitoring
    AgentDialogue.tsx                  # Autonomous dialogue UI
    AgentFeed.tsx                      # Agent activity feed
    ArenaModal.tsx                     # Arena combat UI
    CasinoModal.tsx                    # Casino games
    CasinoAdmin.tsx                    # Casino admin panel
    OracleTowerModal.tsx               # Prediction market
    TradingTerminal.tsx                # Market data terminal
    TradingTerminalModal.tsx           # Terminal in modal
    TradingDojo Modal.tsx              # Trading training
    MoltbookFeed.tsx                   # Social feed display
    MoltbookDashboard.tsx              # Moltbook dashboard
    ProfessorOakChat.tsx               # AI token generation wizard
    LaunchModal.tsx                    # Token launch modal
    LauncherHub.tsx                    # Token launcher hub
    FeeClaimModal.tsx                  # Fee claim interface
    BuildingEditor.tsx                 # Admin building editor
    AdminConsole.tsx                   # Admin panel
    ScoutAlerts.tsx                    # Neo scout alerts
    WorldHealthBar.tsx                 # World health display
    UnifiedActivityFeed.tsx            # Unified activity feed
    EcosystemStats.tsx                 # Ecosystem statistics
    Leaderboard.tsx                    # Leaderboard
    MeetTheAgents.tsx                  # Agent showcase
    EnterWorldButton.tsx               # Enter world mode
    IntroOverlay.tsx                   # Game introduction
    MiniMap.tsx                        # Mini map
    ZoneNav.tsx                        # Zone navigation
    MusicButton.tsx                    # Audio controls
    YourBuildings.tsx                  # User's buildings
    GhostTradingMini.tsx               # Ghost trading mini-view
    ...

eliza-agents/
  src/characters/definitions/
    toly.character.ts                  # Solana co-founder
    finn.character.ts                  # Bags.fm CEO
    ghost.character.ts                 # BagsWorld developer
    shaw.character.ts                  # ElizaOS creator
    ash.character.ts                   # Pokemon guide
    neo.character.ts                   # Scout agent
    cj.character.ts                    # Market commentator
    professor-oak.character.ts         # Launch wizard
    bagsy.character.ts                 # Moltbook hype bot
    bags-bot.character.ts              # World guide
    ramo.character.ts                  # CTO
    sincara.character.ts               # Frontend engineer
    stuu.character.ts                  # Operations
    sam.character.ts                   # Growth
    alaa.character.ts                  # R&D
    carlo.character.ts                 # Ambassador
    bnn.character.ts                   # News bot

.github/workflows/
  ci.yml                               # Lint, format, typecheck, build
  daily-report.yml                     # Automated X posts (6 PM EST cron)
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Configure (copy and edit with your keys)
cp .env.example .env.local

# Start dev server
npm run dev              # http://localhost:3000

# Optional: Start ElizaOS agents for NPC chat
npm run eliza:install
npm run eliza:dev        # http://localhost:3001

# Check status
npm run eliza:status     # Agent server health
npm run bagsy:status     # Bagsy agent status
npm run arena:status     # Arena combat status
```

---

## Deployment

**Primary:** Netlify with Neon database auto-provisioning.

```bash
npm run build            # Production build
npm run lint             # ESLint check
npm run format:check     # Prettier check
npm run typecheck        # TypeScript check
```

**CI checks (must all pass):** Lint, Format, TypeScript, Build.

**Agents:** Deploy `eliza-agents/` separately on Railway. Set `AGENTS_API_URL`.

**Backup:** Railway via `npm run build:railway` / `npm run start:railway`.

---

## Community Funding Model

BagsWorld charges **zero extra fees** to token creators. All community features (casino prizes, new zones, development) are funded by Ghost (@DaddyGhost) personally contributing 5% of his $BagsWorld token revenue.

All contributions are verifiable on-chain via [Solscan](https://solscan.io).

**Ecosystem Wallet:** `9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC`
