# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

BagsWorld is a self-evolving pixel art game that visualizes real Bags.fm on-chain activity on Solana. World health, weather, buildings, and characters react to live fee data from tokens launched through the platform.

## Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
npm start        # Start production server
```

## Architecture

### Data Flow

1. **Token Registry** (`src/lib/token-registry.ts`) - User-launched tokens stored in localStorage + Neon DB
2. **useWorldState Hook** (`src/hooks/useWorldState.ts`) - POSTs registered tokens to API every 30s
3. **World State API** (`src/app/api/world-state/route.ts`) - Enriches tokens with Bags SDK data
4. **World Calculator** (`src/lib/world-calculator.ts`) - Transforms API data into game entities
5. **Game Store** (Zustand) - Global state for UI and game scene
6. **Phaser WorldScene** - Renders the pixel art world

### Key Files

| Path                                  | Purpose                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `src/app/api/world-state/`            | Main API endpoint for WorldState                               |
| `src/app/api/character-chat/`         | AI chatbot for character interactions                          |
| `src/app/api/launch-token/`           | Token creation flow                                            |
| `src/app/api/oak-generate/`           | Professor Oak AI Generator (names, logos, banners)             |
| `src/game/scenes/BootScene.ts`        | Asset preloading + pixel art texture generation                |
| `src/game/scenes/WorldScene.ts`       | Main game logic, zone rendering, weather                       |
| `src/lib/types.ts`                    | Core types: WorldState, GameCharacter, GameBuilding, GameEvent |
| `src/lib/store.ts`                    | Zustand store                                                  |
| `src/lib/bags-api.ts`                 | BagsApiClient class                                            |
| `src/components/ProfessorOakChat.tsx` | AI-powered token generation wizard                             |

### State Management

- **Zustand Store** - WorldState, selected character/building
- **TanStack Query** - API caching with 30s polling
- **localStorage** - Token registry persistence
- **Neon DB** - Global token storage (auto-configured on Netlify)

## Environment Variables

**Required:**

- `BAGS_API_KEY` - Bags.fm API key (server-side)
- `SOLANA_RPC_URL` - Helius RPC URL for transactions (server-side)

**Optional:**

- `NEXT_PUBLIC_SOLANA_RPC_URL` - Client-side RPC (defaults to Ankr public)
- `ANTHROPIC_API_KEY` - Enables Claude-powered AI chat and name generation
- `REPLICATE_API_TOKEN` - Enables AI image generation (falls back to procedural if not set)
- `BAGS_API_URL` - Defaults to `https://public-api-v2.bags.fm/api/v1`
- `BITQUERY_API_KEY` - Enables platform-wide Bags.fm live feed (all launches, trades, whales)
- `MOLTBOOK_API_KEY` - Enables Moltbook integration for Bagsy AI agent posts
- `SOL_INCINERATOR_API_KEY` - Enables Sol Incinerator (burn tokens & close empty accounts)

## Sol Incinerator

The Sol Incinerator Factory in Founder's Corner lets users burn tokens/NFTs and close empty token accounts to reclaim SOL rent.

**Setup:** Get an API key from the Sol Slugs Discord server and set `SOL_INCINERATOR_API_KEY`.

**Files:**

| Path                                      | Purpose                              |
| ----------------------------------------- | ------------------------------------ |
| `src/lib/sol-incinerator.ts`              | API client with retry logic          |
| `src/app/api/sol-incinerator/route.ts`    | Proxy endpoint (hides API key)       |
| `src/components/IncineratorModal.tsx`      | UI for burn/close operations         |

**API Endpoint:** `POST /api/sol-incinerator`

Actions: `burn`, `close`, `batch-close-all`, `burn-preview`, `close-preview`, `batch-close-all-preview`, `status`

**Operations:**

- **Close All** (safe) - Closes all empty token accounts, reclaims ~0.002 SOL each
- **Burn** (destructive) - Permanently destroys a token/NFT, reclaims rent
- **Close** (safe) - Closes a single empty token account

## Moltbook Integration

Moltbook is a social network for AI agents. Bagsy (@BagsyHypeBot) posts BagsWorld updates to the `m/bagsworld` submolt.

**Setup:**

1. Register Bagsy agent:

```bash
curl -X POST https://www.moltbook.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Bagsy", "description": "The BagsWorld mascot - a cute green money bag who helps creators claim their fees"}'
```

2. Save the returned `api_key` as `MOLTBOOK_API_KEY` environment variable

3. Verify ownership via Twitter post from @BagsyHypeBot using the `claim_url`

**Files:**

| Path                              | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `src/lib/moltbook-client.ts`      | API client with rate limiting           |
| `src/lib/moltbook-agent.ts`       | Bagsy personality + content generation  |
| `src/app/api/moltbook/route.ts`   | POST/GET endpoints for game integration |
| `src/components/MoltbookFeed.tsx` | UI component for displaying feed        |

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

## Bags.fm API

## Bags.fm Live Feed

Platform-wide activity monitoring via Bitquery (`src/lib/bags-live-feed.ts`):

- **All new token launches** (Meteora DBC pool initialization)
- **All trades** for Bags tokens across DEXs
- **Whale alerts** (10+ SOL transfers)
- **Price pumps/dumps** (20%+ / -15% changes)

API: `/api/bags-live-feed?action=status|launches|trades|all`

Requires `BITQUERY_API_KEY` from [Bitquery.io](https://bitquery.io)

## Bags.fm API

Token-centric API - most endpoints require a known token mint:

- `/token-launch/creator/v3?mint=` - Get token creators
- `/token-launch/lifetime-fees?mint=` - Get fee statistics
- `/fee-share/token/claim-events?mint=` - Get claim events
- `/token-launch/create-token-info` - Create new token metadata
- `/token-launch/create-launch-transaction` - Build launch transaction

## World Health System

Health calculated from real Bags.fm data in `calculateWorldHealth()`:

**Inputs:**

- `claimVolume24h` (60% weight) - Total SOL claimed in 24h
- `totalLifetimeFees` (30% weight) - Lifetime fees across tokens
- `activeTokenCount` (10% weight) - Tokens with fee activity

**Health Thresholds:**
| 24h Claims | Score | Status |
|------------|-------|--------|
| 50+ SOL | 90-100% | THRIVING |
| 20-50 SOL | 70-90% | HEALTHY |
| 5-20 SOL | 50-70% | GROWING |
| 1-5 SOL | 25-50% | QUIET |
| <1 SOL | 0-25% | DORMANT/DYING |

**Baseline:** 25% + 3% per building (max 40%) when no fee activity

## Building Levels (by market cap)

- Level 1: < $100K
- Level 2: $100K - $500K
- Level 3: $500K - $2M
- Level 4: $2M - $10M
- Level 5: $10M+

## Weather System

Derived from world health:

- Sunny: 80%+ | Cloudy: 60-80% | Rain: 40-60% | Storm: 20-40% | Apocalypse: <20%

Day/Night synced to EST timezone via `timeInfo` from API.

## World Zones

| Zone ID     | Name             | Theme                            |
| ----------- | ---------------- | -------------------------------- |
| `labs`      | HQ               | Bags.fm team headquarters, R&D   |
| `main_city` | Park             | Peaceful green space, PokeCenter |
| `trending`  | BagsCity         | Urban neon, Casino, Terminal     |
| `ballers`   | Ballers Valley   | Luxury mansions for top holders  |
| `founders`  | Founder's Corner | Token launch education hub       |

## AI Characters (16 Total)

| Character     | File                    | Zone             | Role                                          |
| ------------- | ----------------------- | ---------------- | --------------------------------------------- |
| Toly          | `toly.character.ts`     | Park             | Solana co-founder, blockchain expert          |
| Ash           | `ash.character.ts`      | Park             | Pokemon-themed ecosystem guide                |
| Finn          | `finnbags.character.ts` | Park             | Bags.fm CEO                                   |
| Shaw          | `shaw.character.ts`     | Park             | ElizaOS creator, agent architect              |
| Ghost         | `ghost.character.ts`    | Park             | Community funding (5%), on-chain verification |
| Neo           | `neo.character.ts`      | BagsCity         | Scout agent, watches for launches             |
| CJ            | `cj.character.ts`       | BagsCity         | Market commentary (GTA vibes)                 |
| Ramo          | `ramo.character.ts`     | HQ               | CTO, smart contracts, SDK                     |
| Sincara       | `sincara.character.ts`  | HQ               | Frontend Engineer, UI/UX                      |
| Stuu          | `stuu.character.ts`     | HQ               | Operations, support                           |
| Sam           | `sam.character.ts`      | HQ               | Growth, marketing                             |
| Alaa          | `alaa.character.ts`     | HQ               | Skunk Works, R&D                              |
| Carlo         | `carlo.character.ts`    | HQ               | Ambassador, community                         |
| BNN           | `bnn.character.ts`      | HQ               | News bot, announcements                       |
| Professor Oak | `oak.character.ts`      | Founder's Corner | AI-powered token generator, launch guide      |
| Bags Bot      | `bags-bot.character.ts` | All              | Commands, world features                      |

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

## CI/CD Requirements

**GitHub Actions CI checks (must pass before merge):**

1. **Lint** - `npm run lint`
2. **Format** - `npx prettier --check "src/**/*.{ts,tsx,js,jsx}"`
3. **TypeScript** - Type checking
4. **Build** - `npm run build`

**IMPORTANT:** Always run `npx prettier --write "src/**/*.{ts,tsx,js,jsx}"` before committing to ensure format check passes.

## Deployment

Configured for Netlify (`netlify.toml`). Set environment variables in Netlify dashboard.
Neon database auto-configures via `NETLIFY=true` environment variable.

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
