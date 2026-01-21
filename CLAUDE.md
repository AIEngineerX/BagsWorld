# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BagsWorld is a self-evolving pixel art game that visualizes real Bags.fm on-chain activity on Solana. The world health, weather, buildings, and characters all react to live fee data from tokens launched through the platform.

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
3. **World State API** (`src/app/api/world-state/route.ts`) - Enriches tokens with Bags SDK data (fees, creators, claims)
4. **World Calculator** (`src/lib/world-calculator.ts`) - Transforms API data into game entities and calculates health
5. **Game Store** (Zustand) - Global state for UI and game scene
6. **Phaser WorldScene** - Renders the pixel art world

### Key Layers

**API Routes** (`src/app/api/`):
- `world-state/` - Main endpoint: accepts registered tokens, returns enriched WorldState with buildings, population, events, healthMetrics
- `character-chat/` - AI chatbot for character interactions (Toly, Ash, Finn, Dev, Neo)
- `launch-token/` - Token creation flow (create-info → configure-fees → create-launch-tx)
- `ecosystem-stats/` - Creator rewards pool statistics

**Game Engine** (`src/game/scenes/`):
- `BootScene.ts` - Asset preloading
- `WorldScene.ts` - Main game logic: characters, buildings, weather, animals, day/night cycle
- `UIScene.ts` - HUD overlay

**React Components** (`src/components/`):
- `GameCanvas.tsx` - Phaser mount point
- `WorldHealthBar.tsx` - Displays health percentage and status
- `LaunchModal.tsx` - Token creation wizard (3 steps: info → fees → confirm)
- `AIChat.tsx`, `TolyChat.tsx`, `AshChat.tsx`, `FinnbagsChat.tsx`, `DevChat.tsx`, `NeoChat.tsx` - Character chat interfaces
- `TradeModal.tsx` - Token trading interface
- `EcosystemStats.tsx` - Creator rewards pool status

### State Management

- **Zustand Store** (`src/lib/store.ts`) - WorldState, selected character/building
- **TanStack Query** - API caching with 30s polling interval
- **localStorage** - Token registry persists user-launched tokens
- **Neon DB** - Global token storage (auto-configured on Netlify)

### Type System

Core types in `src/lib/types.ts`:
- `WorldState` - health, weather, population[], buildings[], events[], healthMetrics
- `GameCharacter` - fee earners as pixel characters with mood, position, direction
- `GameBuilding` - tokens as buildings with level (1-5), health, glowing state
- `GameEvent` - token_launch, fee_claim, price_pump, milestone, etc.

## Environment Variables

Required:
- `BAGS_API_KEY` - Bags.fm API key (server-side only)
- `SOLANA_RPC_URL` - Full Helius RPC URL for transaction sending (server-side only)

Optional:
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Client-side RPC (defaults to Ankr public)
- `ANTHROPIC_API_KEY` - Enables Claude-powered AI chat (falls back to rule-based)
- `BAGS_API_URL` - Defaults to `https://public-api-v2.bags.fm/api/v1`

## Bags.fm API

The Bags API is **token-centric** - most endpoints require a known token mint:
- `/token-launch/creator/v3?mint=` - Get token creators
- `/token-launch/lifetime-fees?mint=` - Get fee statistics
- `/fee-share/token/claim-events?mint=` - Get claim events (supports time-based filtering)
- `/token-launch/create-token-info` - Create new token metadata
- `/token-launch/create-launch-transaction` - Build launch transaction

API client: `src/lib/bags-api.ts` (BagsApiClient class)

## World Health System

Health is calculated from **real Bags.fm data** in `calculateWorldHealth()`:

**Inputs** (from Bags SDK):
- `claimVolume24h` - Total SOL claimed in last 24 hours (60% weight)
- `totalLifetimeFees` - Total lifetime fees across all tokens (30% weight)
- `activeTokenCount` - Number of tokens with fee activity (10% weight)
- `buildingCount` - Number of buildings (for baseline calculation)

**Baseline Health**: 25% + 3% per building (max 40%) when no fee activity

**Health Thresholds**:
| 24h Claims | Score |
|------------|-------|
| 50+ SOL | 90-100% |
| 20-50 SOL | 70-90% |
| 5-20 SOL | 50-70% |
| 1-5 SOL | 25-50% |
| <1 SOL | 0-25% |

**Status Labels** (in `WorldHealthBar.tsx`):
- 80%+: THRIVING
- 60%+: HEALTHY
- 45%+: GROWING
- 25%+: QUIET (baseline)
- 10%+: DORMANT
- <10%: DYING

## Building Levels

**By market cap** (from DexScreener):
- Level 1: < $100K
- Level 2: $100K - $500K
- Level 3: $500K - $2M
- Level 4: $2M - $10M
- Level 5: $10M+

## Weather System

Weather is derived from world health:
- Sunny: 80%+ health
- Cloudy: 60-80%
- Rain: 40-60%
- Storm: 20-40%
- Apocalypse: < 20%

**Day/Night**: Synced to EST timezone via `timeInfo` from API

## AI Characters

- **Toly** (`toly.character.ts`) - Solana co-founder, blockchain expert
- **Ash** (`ash.character.ts`) - Pokemon-themed ecosystem guide
- **Finn/Finnbags** (`finnbags.character.ts`) - Bags.fm CEO
- **The Dev/Ghost** (`ghost.character.ts`) - Trading agent, market analysis
- **Neo** (`neo.character.ts`) - Scout agent, watches for launches

## Deployment

Configured for Netlify (`netlify.toml`). Set environment variables in Netlify dashboard.
Neon database auto-configures via `NETLIFY=true` environment variable.
