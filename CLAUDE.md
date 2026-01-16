# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BagsWorld is a self-evolving pixel art game that visualizes real Bags.fm on-chain activity on Solana. The world health, weather, buildings, and characters all react to live trading data from the Bags.fm API.

## Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
npm start        # Start production server
```

## Architecture

### Data Flow

1. **Token Registry** (`src/lib/token-registry.ts`) - User-launched tokens stored in localStorage
2. **useWorldState Hook** (`src/hooks/useWorldState.ts`) - POSTs registered tokens to API every 30s
3. **World State API** (`src/app/api/world-state/route.ts`) - Enriches tokens with Bags SDK data (fees, creators)
4. **World Calculator** (`src/lib/world-calculator.ts`) - Transforms API data into game entities (characters, buildings, events)
5. **Game Store** (Zustand) - Global state for UI and game scene
6. **Phaser WorldScene** - Renders the pixel art world

### Key Layers

**API Routes** (`src/app/api/`):
- `world-state/` - Main endpoint: accepts registered tokens, returns enriched WorldState with buildings, population, events
- `bags-bot/` - AI chatbot with animal interactions and Bags.fm queries
- `launch-token/` - Token creation flow (create-info → configure-fees → create-launch-tx)

**Game Engine** (`src/game/scenes/`):
- `BootScene.ts` - Asset preloading
- `WorldScene.ts` - Main game logic: characters, buildings, weather, animals, day/night cycle
- `UIScene.ts` - HUD overlay (currently minimal)

**React Components** (`src/components/`):
- `GameCanvas.tsx` - Phaser mount point, listens for animal control events
- `AIChat.tsx` - Draggable bot interface, emits `bagsworld-animal-control` events
- `LaunchModal.tsx` - Token creation wizard (3 steps: info → fees → confirm)
- `Providers.tsx` - TanStack Query + Solana wallet adapter setup

### State Management

- **Zustand Store** (`src/lib/store.ts`) - WorldState, selected character/building
- **TanStack Query** - API caching with 30s polling interval
- **localStorage** - Token registry persists user-launched tokens

### Type System

Core types in `src/lib/types.ts`:
- `WorldState` - health, weather, population[], buildings[], events[]
- `GameCharacter` - fee earners as pixel characters with mood, position, direction
- `GameBuilding` - tokens as buildings with level (1-5), health, glowing state
- `GameEvent` - token_launch, fee_claim, price_pump, milestone, etc.

### Custom Events

The game uses CustomEvents for cross-component communication:
- `bagsworld-token-update` - Triggers world state refresh after token launch
- `bagsworld-animal-control` - Bot controls animals (pet, scare, call, move)

## Environment Variables

Required:
- `BAGS_API_KEY` - Bags.fm API key
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint

Optional:
- `ANTHROPIC_API_KEY` - Enables Claude-powered AI chat (falls back to rule-based)
- `BAGS_API_URL` - Defaults to `https://public-api-v2.bags.fm/api/v1`

## Bags.fm API

The Bags API is **token-centric** - most endpoints require a known token mint:
- `/token-launch/creator/v3?mint=` - Get token creators
- `/token-launch/lifetime-fees?mint=` - Get fee statistics
- `/fee-share/token/claim-events?mint=` - Get claim events
- `/token-launch/create-token-info` - Create new token metadata
- `/token-launch/create-launch-transaction` - Build launch transaction

API client: `src/lib/bags-api.ts` (BagsApiClient class)

## World Mechanics

**Building Levels** (by market cap):
- Level 1: < $100K
- Level 2: $100K - $500K
- Level 3: $500K - $2M
- Level 4: $2M - $10M
- Level 5: $10M+

**Weather** (by world health):
- Sunny: 80%+ health
- Cloudy: 60-80%
- Rain: 40-60%
- Storm: 20-40%
- Apocalypse: < 20%

**Day/Night**: Synced to EST timezone via `timeInfo` from API

## Deployment

Configured for Netlify (`netlify.toml`). Set environment variables in Netlify dashboard.
