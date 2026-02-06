# BagsWorld - Architecture & System Overview

## What is BagsWorld?

BagsWorld is a **self-evolving pixel art game** that visualizes real [Bags.fm](https://bags.fm) on-chain activity on Solana. Every building in the world represents a real token launched through Bags.fm. World health, weather, building sizes, character moods, and events all react to **live fee data** from the blockchain.

**Zero extra fees to creators.** Community features are funded by Ghost (@DaddyGhost) contributing 5% of his personal $BagsWorld token revenue.

```
Real Solana Activity --> API Enrichment --> Game State --> Pixel Art World
   (Bags.fm fees)       (SDK + DexScreener)  (Zustand)     (Phaser 3)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (React 18) | SSR, API routes, app shell |
| **Game Engine** | Phaser 3.80 | Pixel art rendering, sprites, physics, particles |
| **3D Graphics** | Three.js + React Three Fiber | 3D elements and post-processing |
| **Blockchain** | @solana/web3.js, @solana/spl-token | Wallet connect, transactions, token ops |
| **Bags.fm SDK** | @bagsfm/bags-sdk | Token data, fee queries, launch transactions |
| **State** | Zustand | Global game store |
| **Data Fetching** | TanStack Query | API polling (60s), caching, background refetch |
| **Database** | Neon (serverless PostgreSQL) | Global token registry |
| **AI Agents** | ElizaOS Framework | 16 NPC personalities with autonomous behavior |
| **AI Generation** | Anthropic Claude API | Token name suggestions, character chat |
| **Image Gen** | Replicate (SDXL) / fal.ai | Token logos and banners (fallback: procedural SVG) |
| **Audio** | Howler.js | Sound effects and ambient audio |
| **Realtime** | WebSocket (ws) | Agent coordination, arena combat |
| **Social** | Moltbook API | Bagsy agent posts to AI social network |
| **Styling** | Tailwind CSS 3.4 | UI components |
| **Deployment** | Netlify | Hosting, serverless functions, Neon DB |
| **Language** | TypeScript 5.4 | End-to-end type safety |

---

## Architecture Diagram

```
+------------------------------------------------------------------+
|                         CLIENT (Browser)                          |
|                                                                   |
|  +------------------+    +-------------------+    +-------------+ |
|  |   React App      |    |   Phaser 3 Game   |    | Wallet      | |
|  |   (Next.js)      |    |   Engine          |    | Adapter     | |
|  |                   |    |                   |    | (Phantom)   | |
|  |  - Components     |    |  - BootScene      |    +------+------+ |
|  |  - Modals         |    |    (asset gen)    |           |        |
|  |  - Chat UI        |    |  - WorldScene     |           |        |
|  |  - Admin Panel    |    |    (rendering)    |           |        |
|  |  - Casino/Oracle  |    |  - UIScene        |           |        |
|  +--------+---------+    +--------+----------+           |        |
|           |                       |                      |        |
|  +--------v-----------------------v----------------------v------+ |
|  |                    Zustand Store                              | |
|  |  worldState | selectedChar | selectedBuilding | currentZone  | |
|  +--------+--------------------------------------------------------+
|           |                                                       |
|  +--------v---------+    +------------------+                     |
|  | useWorldState     |    | useAgentChat     |                    |
|  | (TanStack Query)  |    | useElizaAgents   |                   |
|  | Polls every 60s   |    |                  |                    |
|  +--------+----------+    +--------+---------+                    |
+-----------|-----------------------|-------------------------------+
            |                       |
            v                       v
+------------------------------------------------------------------+
|                      SERVER (Next.js API Routes)                  |
|                                                                   |
|  /api/world-state -----> Bags SDK + DexScreener + World Calculator|
|  /api/character-chat --> ElizaOS Agent Server (port 3001)         |
|  /api/launch-token ----> Bags SDK (create token transaction)      |
|  /api/claim-fees ------> Bags SDK (build claim transaction)       |
|  /api/oak-generate ----> Claude AI + Replicate (logos/names)      |
|  /api/arena/brawl -----> WebSocket combat engine                  |
|  /api/casino/* --------> Raffle & wheel ($BagsWorld gated)        |
|  /api/oracle/* --------> Prediction market engine                 |
|  /api/bagsy -----------> Moltbook post queue                      |
|  /api/bags-live-feed --> Bitquery (platform-wide activity)        |
|  /api/global-tokens ---> Neon DB (shared token registry)          |
|  /api/admin/* ---------> Building editor, auth                    |
+------------------------------------------------------------------+
            |                  |                    |
            v                  v                    v
+----------------+  +------------------+  +------------------+
|  Bags.fm API   |  |   Neon Database   |  |  External APIs   |
|  (SDK v1.2.6)  |  |   (PostgreSQL)    |  |                  |
|                |  |                   |  |  - DexScreener   |
|  - Creators    |  |  tokens table:    |  |  - Replicate     |
|  - Fees        |  |  - mint, name     |  |  - Claude AI     |
|  - Claims      |  |  - market_cap     |  |  - Bitquery      |
|  - Launches    |  |  - health, zone   |  |  - Moltbook      |
+----------------+  +------------------+  +------------------+
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

Buildings decay without trading activity. **24-hour grace period** protects new launches.

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
|   Alaa, Carlo    |   PokeCenter     |                   |
|   BNN            |                  |                   |
+------------------+------------------+-------------------+
|                  |                  |                   |
|  Ballers Valley  | Founder's Corner | Moltbook Beach    |
|  Luxury mansions |  Launch academy  |  AI agent hangout |
|  Top holders     |  Professor Oak   |  Tropical vibes   |
|  Gold aesthetic  |  Pokemon NPCs    |  Lobster NPCs     |
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
| `main_city` | Park | Green peaceful space | PokeCenter, main gathering |
| `trending` | BagsCity | Neon urban district | Casino, Trading Terminal, Oracle Tower |
| `ballers` | Ballers Valley | Gold luxury estates | Mansions for top-cap tokens |
| `founders` | Founder's Corner | Academy campus | Professor Oak, launch tutorials, Pokemon |
| `moltbook` | Moltbook Beach | Tropical coast | AI social network hub, crabs/lobsters |
| `arena` | MoltBook Arena | Combat colosseum | AI agent battles, crowd reactions |

---

## AI Characters (16)

All characters use the **ElizaOS** agent framework with personality files defining bio, lore, speech style, topics, and example dialogues.

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

### System Agent

| Character | Zone | Role |
|-----------|------|------|
| **Bagsy** | All | @BagsyHypeBot - posts to Moltbook social network (gm, hype, spotlights, celebrations) |

### Character Behavior

```
Character Mood System:
  Earnings > threshold  -->  celebrating (party animations)
  Earnings > 0          -->  happy (smiling, waving)
  No earnings           -->  neutral (walking)
  Token declining       -->  sad (slower movement)

Character Movement:
  - Wander autonomously on ground level (Y = 555 * SCALE)
  - Face left/right based on direction
  - Speech bubbles for dialogue
  - Clickable to open AI chat modal
```

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

### Casino (Token-Gated)

- Raffle system with SOL prizes
- Wheel spinner game
- Requires 1M+ $BagsWorld tokens to enter
- Prize pool funded by community (Ghost's 5%)

### Oracle Prediction Market (Token-Gated)

- Predict which token pumps the most
- Multi-round tournaments
- Requires 2M+ $BagsWorld tokens
- Prize pools: 0.1 - 1.0 SOL

### Arena / Brawl System

- Real-time AI agent combat via WebSocket
- Health bars, combo system, special moves
- Matchmaking and spectator crowd
- Results posted to Moltbook

### Fee Claiming

- Integrated claim interface inside the game
- Shows all claimable positions from registered tokens
- Builds and signs Solana transactions
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

### Animals & Creatures

Each zone has ambient wildlife: dogs, cats, birds, butterflies, squirrels, Pokemon (Founder's Corner), crabs and lobsters (Moltbook Beach).

---

## API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/world-state` | POST | Core: enriches tokens, returns WorldState |
| `/api/character-chat` | POST | Proxies NPC chat to ElizaOS (port 3001) |
| `/api/launch-token` | POST | Builds token creation transaction |
| `/api/claim-fees` | POST | Builds fee claim transaction |
| `/api/oak-generate` | POST | AI name/logo/banner generation |
| `/api/global-tokens` | GET | Fetch all tokens from Neon DB |
| `/api/arena/brawl` | GET/POST | AI agent combat system |
| `/api/casino/*` | Various | Raffle and wheel games |
| `/api/oracle/*` | Various | Prediction market engine |
| `/api/bagsy` | GET/POST | Moltbook post queue for Bagsy |
| `/api/bags-live-feed` | GET | Platform-wide activity (Bitquery) |
| `/api/admin/*` | Various | Building editor, auth |
| `/api/agent-coordinator` | Various | Agent-to-agent communication |
| `/api/dialogue` | POST | Autonomous NPC dialogue |

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

| Variable | Required | Side | Purpose |
|----------|----------|------|---------|
| `BAGS_API_KEY` | Yes | Server | Bags.fm API authentication |
| `SOLANA_RPC_URL` | Yes | Server | Helius RPC for transactions |
| `ANTHROPIC_API_KEY` | No | Server | Claude AI (chat, name generation) |
| `REPLICATE_API_TOKEN` | No | Server | SDXL image generation |
| `BITQUERY_API_KEY` | No | Server | Platform-wide activity feed |
| `MOLTBOOK_API_KEY` | No | Server | Bagsy agent social posts |
| `DATABASE_URL` | Auto | Server | Neon PostgreSQL (auto on Netlify) |
| `ADMIN_WALLETS` | No | Server | Comma-separated admin wallet addresses |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | Client | Public RPC (defaults to Ankr) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | No | Client | mainnet-beta |

---

## Key File Map

```
src/
  app/
    page.tsx                           # Main game entry point
    api/
      world-state/route.ts            # Core: enriches tokens --> WorldState
      character-chat/route.ts          # NPC AI chat proxy
      launch-token/route.ts            # Token creation flow
      claim-fees/route.ts              # Fee claim transactions
      oak-generate/route.ts            # AI asset generation
      arena/brawl/route.ts             # Combat system
      casino/*/route.ts                # Raffle & wheel
      oracle/*/route.ts                # Prediction market
      bagsy/route.ts                   # Moltbook posting
      bags-live-feed/route.ts          # Platform activity
      global-tokens/route.ts           # DB token registry
      admin/*/route.ts                 # Admin controls

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
    moltbook-client.ts                 # Moltbook API client
    moltbook-agent.ts                  # Bagsy personality + posting
    bags-live-feed.ts                  # Bitquery activity monitor
    arena-*.ts                         # Arena combat logic
    agent-*.ts                         # Agent economy system

  hooks/
    useWorldState.ts                   # Polls /api/world-state every 60s
    useAgentChat.ts                    # NPC chat state
    useElizaAgents.ts                  # Agent coordination

  components/
    ProfessorOakChat.tsx               # AI token generation wizard
    *Chat.tsx                          # Character chat modals
    *Modal.tsx                         # Game feature modals
    MoltbookFeed.tsx                   # Social feed display
    AdminConsole.tsx                   # Admin panel

eliza-agents/
  src/characters/definitions/
    toly.character.ts                  # Solana co-founder personality
    finn.character.ts                  # Bags.fm CEO personality
    ghost.character.ts                 # BagsWorld developer personality
    shaw.character.ts                  # ElizaOS creator personality
    ash.character.ts                   # Pokemon guide personality
    neo.character.ts                   # Scout agent personality
    cj.character.ts                    # Market commentator personality
    professor-oak.character.ts         # Launch wizard personality
    bagsy.character.ts                 # Moltbook hype bot personality
    ramo.character.ts                  # CTO personality
    sincara.character.ts               # Frontend engineer personality
    stuu.character.ts                  # Operations personality
    sam.character.ts                   # Growth personality
    alaa.character.ts                  # R&D personality
    carlo.character.ts                 # Ambassador personality
    bnn.character.ts                   # News bot personality
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Set required env vars
export BAGS_API_KEY=your_key
export SOLANA_RPC_URL=your_helius_rpc

# Start dev server
npm run dev              # http://localhost:3000

# Optional: Start ElizaOS agents for NPC chat
npm run eliza:install
npm run eliza:dev        # http://localhost:3001

# Check agent status
npm run eliza:status
npm run bagsy:status
npm run arena:status
```

---

## Deployment

Deployed on **Netlify** with Neon database auto-provisioning.

```bash
npm run build            # Production build
npm run lint             # ESLint check
npx prettier --check "src/**/*.{ts,tsx,js,jsx}"  # Format check
```

**CI checks (must all pass):** Lint, Format, TypeScript, Build.

---

## Community Funding Model

BagsWorld charges **zero extra fees** to token creators. All community features (casino prizes, new zones, development) are funded by Ghost (@DaddyGhost) personally contributing 5% of his $BagsWorld token revenue.

All contributions are verifiable on-chain via [Solscan](https://solscan.io).

**Ecosystem Wallet:** `9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC`
