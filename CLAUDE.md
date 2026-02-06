# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

BagsWorld is a self-evolving pixel art game that visualizes real Bags.fm on-chain activity on Solana. World health, weather, buildings, and characters react to live fee data from tokens launched through the platform. 17 AI characters powered by ElizaOS roam the world with autonomous behavior, and agent systems can trade and post to social networks independently.

## Commands

```bash
npm run dev          # Start development server at localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint
npm run format       # Fix Prettier formatting
npm run format:check # Check Prettier formatting
npm run typecheck    # TypeScript type checking
npm start            # Start production server
npm run eliza:dev    # Start ElizaOS agent server (port 3001)
npm run eliza:status # Check agent server health
npm run bagsy:status # Check Bagsy agent status
npm run arena:status # Check arena combat status
npm test             # Run Jest tests
```

## Architecture

### Data Flow

1. **Token Registry** (`src/lib/token-registry.ts`) - User-launched tokens stored in localStorage + Neon DB
2. **useWorldState Hook** (`src/hooks/useWorldState.ts`) - POSTs registered tokens to API every 60s
3. **World State API** (`src/app/api/world-state/route.ts`) - Enriches tokens with Bags SDK + DexScreener data
4. **World Calculator** (`src/lib/world-calculator.ts`) - Transforms API data into game entities
5. **Game Store** (Zustand) - Global state for UI and game scene
6. **Phaser WorldScene** - Renders the pixel art world across 7 zones
7. **ElizaOS Agents** - Character conversations + autonomous behavior
8. **Agent Economy** - Autonomous trading, fee claiming, social posting

### Key Files

| Path | Purpose |
| ---- | ------- |
| `src/app/api/world-state/` | Main API endpoint for WorldState |
| `src/app/api/character-chat/` | AI chatbot for character interactions |
| `src/app/api/launch-token/` | Token creation flow |
| `src/app/api/oak-generate/` | Professor Oak AI Generator (names, logos, banners) |
| `src/app/api/agent-economy/` | Autonomous agent operations (trade, claim, spawn) |
| `src/app/api/chadghost/` | ChadGhost autonomous agent API |
| `src/app/api/arena/brawl/` | Real-time AI agent combat (WebSocket) |
| `src/app/api/auth/x/` | X (Twitter) OAuth flow |
| `src/app/api/report/` | Daily X report generation |
| `src/app/api/trading-terminal/` | Market data and charts |
| `src/game/scenes/BootScene.ts` | Asset preloading + pixel art texture generation |
| `src/game/scenes/WorldScene.ts` | Main game logic, zone rendering, weather (1000+ lines) |
| `src/lib/types.ts` | Core types: WorldState, GameCharacter, GameBuilding, GameEvent |
| `src/lib/store.ts` | Zustand store |
| `src/lib/config.ts` | Ecosystem configuration (wallets, gates, decay) |
| `src/lib/bags-api.ts` | BagsApiClient class |
| `src/lib/agent-economy/` | 15 files: wallets, trading, brain, spawn, credentials |
| `src/lib/chadghost-*.ts` | 4 files: brain, engagement, service, startup |
| `src/lib/arena-*.ts` | 5 files: engine, matchmaking, db, types, moltbook |
| `src/lib/moltbook-*.ts` | 4 files: client, agent, autonomous, chat |
| `src/lib/scout-agent.ts` | Launch detection for Neo |
| `src/lib/autonomous-dialogue.ts` | NPC self-dialogue system |
| `src/lib/x-client.ts` | X API client |
| `src/lib/x-oauth.ts` | X OAuth implementation |
| `src/lib/trading-dojo.ts` | Trading training system |
| `src/components/ProfessorOakChat.tsx` | AI-powered token generation wizard |
| `src/components/AgentDashboard.tsx` | Agent monitoring dashboard |
| `src/components/TradingTerminal.tsx` | In-game market terminal |
| `src/components/ArenaModal.tsx` | Arena combat UI |

### Pages

| Path | Purpose |
| ---- | ------- |
| `/` | Main game - pixel art world, modals, character chats (763 lines) |
| `/docs` | In-app documentation with collapsible sidebar |
| `/agents` | AI agent showcase (MeetTheAgents component) |

### State Management

- **Zustand Store** - WorldState, selected character/building, current zone
- **TanStack Query** - API caching with 60s polling (staleTime 55s)
- **localStorage** - Token registry persistence
- **Neon DB** - Global token storage (auto-configured on Netlify)

## Environment Variables

**Required:**

- `BAGS_API_KEY` - Bags.fm API key (server-side)
- `SOLANA_RPC_URL` - Helius RPC URL for transactions (server-side)

**AI & Image Generation:**

- `ANTHROPIC_API_KEY` - Enables Claude-powered AI chat and name generation
- `REPLICATE_API_TOKEN` - Enables AI image generation (falls back to procedural if not set)

**Database:**

- `DATABASE_URL` - Neon PostgreSQL connection (auto on Netlify via `NETLIFY_DATABASE_URL`)

**Agent Systems:**

- `AGENTS_API_URL` - ElizaOS server URL (default: `http://localhost:3001`)
- `AGENT_WALLET_PRIVATE_KEY` - Base58 private key for autonomous agent signing
- `AGENT_SECRET` - Agent API authentication (used by GitHub Actions)
- `AGENT_MIN_CLAIM_THRESHOLD` - Min SOL to auto-claim (default: 0.01)
- `AGENT_CHECK_INTERVAL_MS` - Agent check frequency (default: 300000)
- `AGENT_MAX_CLAIMS_PER_RUN` - Max claims per cycle (default: 10)

**Social & Auth:**

- `MOLTBOOK_BAGSY_KEY` - Bagsy Moltbook API key
- `MOLTBOOK_CHADGHOST_KEY` - ChadGhost Moltbook API key
- `X_CLIENT_ID` - X OAuth client ID
- `X_CLIENT_SECRET` - X OAuth client secret
- `NEXT_PUBLIC_X_CALLBACK_URL` - X OAuth callback URL

**Monitoring:**

- `BITQUERY_API_KEY` - Platform-wide Bags.fm live feed
- `BAGS_API_URL` - Defaults to `https://public-api-v2.bags.fm/api/v1`

**Client-Side:**

- `NEXT_PUBLIC_SOLANA_RPC_URL` - Client-side RPC (defaults to Ankr public)
- `NEXT_PUBLIC_SOLANA_NETWORK` - Network (default: mainnet-beta)
- `NEXT_PUBLIC_ECOSYSTEM_WALLET` - Ecosystem treasury wallet
- `NEXT_PUBLIC_ADMIN_WALLET` - Admin wallet for moderation
- `NEXT_PUBLIC_SITE_URL` - Site URL for internal API calls

## Agent Economy System

Complete autonomous agent subsystem in `src/lib/agent-economy/`:

| File | Purpose |
| ---- | ------- |
| `brain.ts` | Decision-making AI for autonomous actions |
| `wallet.ts` | Agent wallet management |
| `trading.ts` | Autonomous trading operations |
| `fees.ts` | Autonomous fee claiming |
| `spawn.ts` | Agent spawning/despawning |
| `launcher.ts` | Agent-created token launches |
| `credentials.ts` | Credential management |
| `auth.ts` | Agent authentication |
| `onboarding.ts` | Agent onboarding flow |
| `external-registry.ts` | External agent registry |
| `external.ts` | External agent integration |
| `loop.ts` | Continuous operation loop |
| `launch.ts` | Launch operations |
| `types.ts` | Type definitions |
| `index.ts` | Main export |

API: `/api/agent-economy` (spawn, despawn, trade, claim), `/api/agent-economy/external` (registry), `/api/agent-economy/docs`

## ChadGhost System

Autonomous AI agent running in parallel with Bagsy:

| File | Purpose |
| ---- | ------- |
| `src/lib/chadghost-brain.ts` | Decision-making engine |
| `src/lib/chadghost-engagement.ts` | Community engagement logic |
| `src/lib/chadghost-service.ts` | Service operations |
| `src/lib/chadghost-startup.ts` | Initialization |

API: `/api/chadghost`, integrated into `/api/agent-dashboard`

## Arena Combat System

Real-time AI agent battles via WebSocket:

| File | Purpose |
| ---- | ------- |
| `src/lib/arena-engine.ts` | Combat engine |
| `src/lib/arena-matchmaking.ts` | Matchmaking algorithm |
| `src/lib/arena-db.ts` | Arena persistence |
| `src/lib/arena-types.ts` | Type definitions |
| `src/lib/arena-moltbook-monitor.ts` | Arena-to-Moltbook integration |

API: `/api/arena` (status, analysis), `/api/arena/brawl` (WebSocket combat)

## Moltbook Integration

Moltbook is a social network for AI agents. BagsWorld has two agents posting:

- **Bagsy** (@BagsyHypeBot) - Posts to `m/bagsworld` submolt
- **ChadGhost** - Posts to Moltbook with autonomous engagement

**Files:**

| Path | Purpose |
| ---- | ------- |
| `src/lib/moltbook-client.ts` | API client with rate limiting |
| `src/lib/moltbook-agent.ts` | Bagsy personality + content generation |
| `src/lib/moltbook-autonomous.ts` | Autonomous posting logic |
| `src/lib/moltbook-chat.ts` | Moltbook chat integration |
| `src/app/api/moltbook/route.ts` | POST/GET endpoints for game integration |
| `src/app/api/moltbook-chat/route.ts` | Moltbook chat endpoint |
| `src/app/api/bags-bot/route.ts` | BagsBot Moltbook integration |
| `src/components/MoltbookFeed.tsx` | UI component for displaying feed |
| `src/components/MoltbookDashboard.tsx` | Moltbook dashboard |

**Rate Limits:**

- 1 post per 30 minutes
- 50 comments per hour
- 100 requests per minute

**API:**

- `GET /api/moltbook?source=bagsworld|trending&limit=10` - Fetch posts
- `POST /api/moltbook` - Queue a post with `{type, data, priority?, immediate?}`

**Event Types (Hype-focused):**

- `gm` - Good morning posts
- `hype` - General BagsWorld hype
- `feature_spotlight` - Highlight Casino, Terminal, Oracle, etc.
- `character_spotlight` - Talk about Finn, Ghost, Neo, Ash, etc.
- `zone_spotlight` - Hype up Park, BagsCity, HQ, etc.
- `invite` - Invite other AI agents to visit
- `token_launch` - Celebrate new launches
- `fee_claim` - Celebrate claims (Bagsy's favorite!)
- `community_love` - Community appreciation
- `building_hype` - Hype specific buildings

**Convenience Functions:**

```typescript
import { postGM, postHype, spotlightFeature, celebrateLaunch } from "@/lib/moltbook-agent";

postGM(); // Queue a GM post
postHype("the vibes"); // Queue general hype
spotlightFeature("Casino"); // Spotlight a feature
spotlightCharacter("Neo"); // Spotlight a character
celebrateLaunch("CoolCat", "COOL"); // Celebrate a launch
celebrateClaim(5.5); // Celebrate a fee claim
```

## X (Twitter) Integration

OAuth 2.0 flow for authentication and automated posting:

| File | Purpose |
| ---- | ------- |
| `src/lib/x-client.ts` | X API client |
| `src/lib/x-oauth.ts` | OAuth implementation |
| `src/app/api/auth/x/route.ts` | OAuth initiation |
| `src/app/api/auth/x/callback/route.ts` | OAuth callback |
| `src/app/api/report/route.ts` | Daily report generation |
| `src/hooks/useXAuth.ts` | Client-side auth state |

**Daily Reports:** GitHub Actions cron job posts daily at 6 PM EST via `/api/report`.

## Bags.fm API

Token-centric API - most endpoints require a known token mint:

- `/token-launch/creator/v3?mint=` - Get token creators
- `/token-launch/lifetime-fees?mint=` - Get fee statistics
- `/fee-share/token/claim-events?mint=` - Get claim events
- `/token-launch/create-token-info` - Create new token metadata
- `/token-launch/create-launch-transaction` - Build launch transaction

## Bags.fm Live Feed

Platform-wide activity monitoring via Bitquery (`src/lib/bags-live-feed.ts`):

- **All new token launches** (Meteora DBC pool initialization)
- **All trades** for Bags tokens across DEXs
- **Whale alerts** (10+ SOL transfers)
- **Price pumps/dumps** (20%+ / -15% changes)

API: `/api/bags-live-feed?action=status|launches|trades|all`

Requires `BITQUERY_API_KEY` from [Bitquery.io](https://bitquery.io)

## World Health System

Health calculated from real Bags.fm data in `calculateWorldHealth()`:

**Inputs:**

- `claimVolume24h` (60% weight) - Total SOL claimed in 24h
- `totalLifetimeFees` (30% weight) - Lifetime fees across tokens
- `activeTokenCount` (10% weight) - Tokens with fee activity

**Health Thresholds:**

| 24h Claims | Score    | Status       |
| ---------- | -------- | ------------ |
| 50+ SOL    | 90-100%  | THRIVING     |
| 20-50 SOL  | 70-90%   | HEALTHY      |
| 5-20 SOL   | 50-70%   | GROWING      |
| 1-5 SOL    | 25-50%   | QUIET        |
| < 1 SOL    | 0-25%    | DORMANT/DYING|

**Baseline:** 25% + 3% per building (max 40%) when no fee activity

## Building Levels (by market cap)

- Level 1: < $100K
- Level 2: $100K - $500K
- Level 3: $500K - $2M
- Level 4: $2M - $10M
- Level 5: $10M+

## Building Decay System

**Grace Period:** 24 hours after launch, minimum health 75%

**After grace period:**

| Condition | Health Change/Cycle |
| --------- | ------------------- |
| High volume | +10 (fast recovery) |
| Normal activity | +5 (recovery) |
| 20%+ price drop | -2 (light decay) |
| Low volume only | -5 (moderate decay) |
| Low volume + low mcap | -8 (heavy decay) |

**Thresholds:** Active (75+) > Warning (50-75) > Critical (25-50) > Dormant (< 25) > Hidden (< 10)

## Weather System

Derived from world health:

- Sunny: 80%+ | Cloudy: 60-80% | Rain: 40-60% | Storm: 20-40% | Apocalypse: < 20%

Day/Night synced to EST timezone via `timeInfo` from API.

## World Zones (7)

| Zone ID     | Name             | Theme                                          |
| ----------- | ---------------- | ---------------------------------------------- |
| `labs`      | HQ               | Bags.fm team headquarters, R&D                 |
| `main_city` | Park             | Peaceful green space, PokeCenter               |
| `trending`  | BagsCity         | Urban neon, Casino, Terminal, Oracle Tower      |
| `ballers`   | Ballers Valley   | Luxury mansions for top holders                |
| `founders`  | Founder's Corner | Token launch education, Professor Oak, Pokemon |
| `moltbook`  | Moltbook Beach   | Tropical AI agent hangout, Openclaw lobsters   |
| `arena`     | MoltBook Arena   | Real-time AI agent combat, spectator crowd     |

## AI Characters (17 Total)

| Character     | File                          | Zone             | Role                                           |
| ------------- | ----------------------------- | ---------------- | ---------------------------------------------- |
| Toly          | `toly.character.ts`           | Park             | Solana co-founder, blockchain expert           |
| Ash           | `ash.character.ts`            | Park             | Pokemon-themed ecosystem guide                 |
| Finn          | `finn.character.ts`           | Park             | Bags.fm CEO                                    |
| Shaw          | `shaw.character.ts`           | Park             | ElizaOS creator, agent architect               |
| Ghost         | `ghost.character.ts`          | Park             | Community funding (5%), on-chain verification  |
| Neo           | `neo.character.ts`            | BagsCity         | Scout agent, watches for launches              |
| CJ            | `cj.character.ts`             | BagsCity         | Market commentary (GTA vibes)                  |
| Ramo          | `ramo.character.ts`           | HQ               | CTO, smart contracts, SDK                      |
| Sincara       | `sincara.character.ts`        | HQ               | Frontend Engineer, UI/UX                       |
| Stuu          | `stuu.character.ts`           | HQ               | Operations, support                            |
| Sam           | `sam.character.ts`            | HQ               | Growth, marketing                              |
| Alaa          | `alaa.character.ts`           | HQ               | Skunk Works, R&D                               |
| Carlo         | `carlo.character.ts`          | HQ               | Ambassador, community                          |
| BNN           | `bnn.character.ts`            | HQ               | News bot, announcements                        |
| Professor Oak | `professor-oak.character.ts`  | Founder's Corner | AI-powered token generator, launch guide       |
| Bagsy         | `bagsy.character.ts`          | All              | Moltbook hype bot (@BagsyHypeBot)              |
| Bags Bot      | `bags-bot.character.ts`       | All              | Commands, world features guide                 |

Character files are in `eliza-agents/src/characters/definitions/`.

## Professor Oak AI Generator

Professor Oak can generate complete token launch assets using AI:

**Capabilities:**

- **Name Generation**: 5 creative name/ticker suggestions from a concept (requires `ANTHROPIC_API_KEY`)
- **Logo Generation**: 512x512 square logos in 5 art styles
- **Banner Generation**: 600x200 banners for DexScreener (3:1 ratio)
- **Image Resize**: Resize uploaded images to correct dimensions

**Art Styles:**

- Pixel Art (16-bit retro aesthetic)
- Cartoon (bold, playful mascot)
- Kawaii (cute chibi style)
- Minimalist (clean, modern shapes)
- Abstract (geometric art)

**Image Generation:**

- With `REPLICATE_API_TOKEN`: Uses SDXL for high-quality generation
- Without: Falls back to procedural SVG pixel art (free, instant)

**API Endpoint:** `POST /api/oak-generate`

```json
{
  "action": "suggest-names" | "generate-logo" | "generate-banner" | "resize-image" | "full-wizard",
  "concept": "a space cat exploring galaxies",
  "style": "pixel-art" | "cartoon" | "cute" | "minimalist" | "abstract"
}
```

**UI Flow:**

1. User clicks Professor Oak in Founder's Corner
2. Clicks "AI GENERATE" button
3. Enters token concept
4. Selects art style
5. Picks from 5 generated names
6. Reviews generated logo and banner
7. "USE & LAUNCH" pre-fills LaunchModal

## Community Funding Model

BagsWorld charges **zero extra fees** to creators. Ghost (@DaddyGhost) personally contributes 5% of his $BagsWorld token revenue to fund community features.

**Funded Features:**

- Casino prizes and raffles
- New zones and features
- Development and improvements

All contributions verifiable on-chain via Solscan.

**Ecosystem Wallet:** `9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC`

## Token Gates

- **Casino:** Minimum 1M $BagsWorld tokens to play
- **Oracle:** Minimum 2M $BagsWorld tokens to predict
- **Ballers Valley:** Top holder showcase

## CI/CD

### GitHub Actions CI (`ci.yml`)

Runs on push to `main` and all PRs. Must pass before merge:

1. **Lint** - `npm run lint`
2. **Format** - `npm run format:check`
3. **TypeScript** - `npm run typecheck`
4. **Build** - `npm run build` (depends on 1-3 passing)

**IMPORTANT:** Always run `npm run format` before committing to ensure format check passes.

### Daily Report (`daily-report.yml`)

- Automated daily X post at 6 PM EST (23:00 UTC cron)
- Manual trigger with preview/post options
- Authenticated via `AGENT_SECRET`
- Posts world activity summary via `/api/report`

## Deployment

**Primary:** Netlify (`netlify.toml`). Set environment variables in Netlify dashboard.
Neon database auto-configures via `NETLIFY=true` environment variable.

**Agents:** Deploy `eliza-agents/` separately on Railway or any Node.js host. Set `AGENTS_API_URL`.

**Backup:** Railway support via `npm run build:railway` / `npm run start:railway`.

---

# Zone Creation Guide

## Core Architecture

Buildings are pre-generated as textures in `BootScene.ts`, then placed as sprites in `WorldScene.ts`.

```typescript
// BootScene.ts - Generate texture
const g = this.make.graphics({ x: 0, y: 0 });
g.fillStyle(0xColorHex);
g.fillRect(x, y, width, height);
g.generateTexture("texture_name", width, height);
g.destroy();

// WorldScene.ts - Place sprite
const building = this.add.sprite(x, y, "texture_name");
building.setOrigin(0.5, 1);
building.setDepth(5);
this.zoneElements.push(building);
```

## Layer System

| Depth | Y Position   | Layer      | Contents                           |
| ----- | ------------ | ---------- | ---------------------------------- |
| -2    | 0-430        | Sky        | Day/night gradient (DO NOT MODIFY) |
| -1    | 0-300        | Stars      | Night only (DO NOT MODIFY)         |
| 0     | 540 \* SCALE | Ground     | Zone-specific texture              |
| 1     | 570 \* SCALE | Path       | Walking surface                    |
| 2-4   | Variable     | Props      | Trees, bushes, lamps, benches      |
| 5+    | Variable     | Buildings  | Zone structures                    |
| 10    | 555 \* SCALE | Characters | NPCs walking                       |
| 15    | Variable     | Flying     | Birds, butterflies                 |

## Critical Y-Positions

```typescript
const grassTop = 455 * SCALE; // Top of grass, trees go here
const groundY = 540 * SCALE; // Ground layer Y
const pathLevel = 555 * SCALE; // Characters walk here
const pathY = 570 * SCALE; // Path layer Y
```

## Zone Setup Pattern

```typescript
// Class-level cache
private myZoneElements: Phaser.GameObjects.GameObject[] = [];
private myZoneCreated = false;

// Zone switch handler
case "my_zone":
  if (!this.myZoneCreated) {
    this.setupMyZone();
    this.myZoneCreated = true;
  } else {
    this.myZoneElements.forEach(el => (el as any).setVisible(true));
  }
  break;

// Setup method
private setupMyZone(): void {
  // Hide park elements
  this.ground.setVisible(false);
  this.decorations.forEach(d => d.setVisible(false));

  // Create zone elements, push to myZoneElements array
  // Toggle visibility on zone exit, don't destroy/recreate
}
```

## Zone Requirements

**Minimum content:**

- 3+ detailed buildings (not plain rectangles)
- 20+ props (trees, lamps, benches, decorations)
- Textured ground (not solid flat colors)
- Day/night compatible colors

**Pixel art style:**

- Hard edges only, no anti-aliasing
- Solid colors or dithering, no smooth gradients
- 3D depth: light left edges, dark right edges
- Window glow: semi-transparent aura + highlight corner

## Files to Modify

1. `src/lib/types.ts` - Add ZoneType and ZONES entry
2. `src/game/scenes/BootScene.ts` - Add texture generators
3. `src/game/scenes/WorldScene.ts` - Add cache variables, zone case, setup method

## Existing Texture Generators

| Method                       | Creates                            |
| ---------------------------- | ---------------------------------- |
| `generateBuildings()`        | 5 levels x 4 styles = 20 buildings |
| `generateMansions()`         | 5 luxury mansion styles            |
| `generateAcademyBuildings()` | 8 campus buildings                 |
| `generatePokeCenter()`       | Pokemon-style center               |
| `generateTerminal()`         | Tech terminal building             |

Use Park zone (main_city) as the reference template for element density and placement.
