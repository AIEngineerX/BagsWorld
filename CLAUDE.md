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

| Path                            | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `src/app/api/world-state/`      | Main API endpoint for WorldState                               |
| `src/app/api/character-chat/`   | AI chatbot for character interactions                          |
| `src/app/api/launch-token/`     | Token creation flow                                            |
| `src/game/scenes/BootScene.ts`  | Asset preloading + pixel art texture generation                |
| `src/game/scenes/WorldScene.ts` | Main game logic, zone rendering, weather                       |
| `src/lib/types.ts`              | Core types: WorldState, GameCharacter, GameBuilding, GameEvent |
| `src/lib/store.ts`              | Zustand store                                                  |
| `src/lib/bags-api.ts`           | BagsApiClient class                                            |

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
- `ANTHROPIC_API_KEY` - Enables Claude-powered AI chat
- `BAGS_API_URL` - Defaults to `https://public-api-v2.bags.fm/api/v1`
- `BITQUERY_API_KEY` - Enables platform-wide Bags.fm live feed (all launches, trades, whales)

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
| Professor Oak | `oak.character.ts`      | Founder's Corner | Token launch guide                            |
| Bags Bot      | `bags-bot.character.ts` | All              | Commands, world features                      |

## Community Funding Model

BagsWorld charges **zero extra fees** to creators. Ghost (@DaddyGhost) personally contributes 5% of his $BagsWorld token revenue to fund community features.

**Funded Features:**

- Casino prizes and raffles
- New zones and features
- Development and improvements

All contributions verifiable on-chain via Solscan.

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
