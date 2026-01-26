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
- `BootScene.ts` - Asset preloading + **pixel art texture generation** (buildings, props, characters drawn here using Graphics API)
- `WorldScene.ts` - Main game logic: zone rendering, character placement, weather, day/night cycle (uses textures from BootScene)
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

---

# BagsWorld Zone Creation Specification

## CRITICAL: Park is THE Template

**ALL new zones MUST follow the Park zone pattern.** The Park zone (main_city) is the canonical reference implementation. When creating any new zone:

1. **Start from Park's structure** - Same layer setup, Y-positions, and depth values
2. **Match Park's element density** - 24 decorations, 7 animals, similar prop counts
3. **Use Park's Y-positions exactly** - grassTop, pathLevel, groundY, pathY
4. **Follow Park's visibility pattern** - Toggle with `setVisible()`, don't destroy/recreate

BagsCity is a **special case** with custom ground/road - do NOT use it as a template for standard zones.

---

## Layer Architecture

```
┌─────────────────────────────────────────┐
│  SKY LAYER (depth -2, persistent)       │
│  - fillGradientStyle() for day/night    │
│  - Stars at depth -1 (night only)       │
│  - DO NOT MODIFY IN ZONE CODE           │
├─────────────────────────────────────────┤
│  GRASS LAYER (depth 0, zone-specific)   │
│  - tileSprite using generated texture   │
│  - Toggle with setVisible()             │
│  - Y = 540 * SCALE, height 180          │
├─────────────────────────────────────────┤
│  PATH LAYER (depth 1, walking surface)  │
│  - tileSprite for sidewalk/street       │
│  - Y = 570 * SCALE, height 40           │
│  - Characters walk at ~555 * SCALE      │
├─────────────────────────────────────────┤
│  PROPS (depth 2-4)                      │
│  - Trees, bushes, lamps, benches        │
│  - Zone-specific decorations            │
├─────────────────────────────────────────┤
│  BUILDINGS (depth 5+)                   │
│  - Sprites from pre-generated textures  │
│  - Zone-specific, cached after creation │
├─────────────────────────────────────────┤
│  CHARACTERS (depth 10)                  │
│  - NPCs walking at pathLevel (555)      │
└─────────────────────────────────────────┘
```

### Depth Reference Table (CANONICAL)

| Depth | Y Position | Layer | What It Contains |
|-------|------------|-------|------------------|
| -2 | 0 to 430 | Sky gradient | Day/night color transition (DO NOT MODIFY) |
| -1 | 0 to 300 | Stars | Twinkling circles (night only, DO NOT MODIFY) |
| 0 | 540 (h:180) | Grass/Ground | Zone-specific ground texture |
| 1 | 570 (h:40) | Path/Sidewalk | Walking surface |
| 2 | Variable | Trees, bushes, flowers, rocks, fountain | Natural props |
| 3 | Variable | Lamps, benches, street furniture | Functional props |
| 4 | Variable | Ground animals, small details | Ambient life |
| 5+ | Variable | Buildings | Zone structures |
| 10 | ~555 | Characters | NPCs walking on path |
| 15 | Variable | Flying animals | Birds, butterflies |
| 20 | Variable | Fireflies, particles | Ambient effects |

---

## Sky Layer (PERSISTENT - DO NOT MODIFY)

The sky is created ONCE in `createSky()` and persists across all zones.

### How It Works
```typescript
// Created in WorldScene.ts createSky()
this.skyGradient = this.add.graphics();
this.skyGradient.setDepth(-2);

// Day/night switch uses fillGradientStyle()
if (isNight) {
  this.skyGradient.fillGradientStyle(
    0x0f172a, 0x0f172a,  // Dark blue top
    0x1e293b, 0x1e293b,  // Slate blue bottom
    1
  );
} else {
  this.skyGradient.fillGradientStyle(
    0x1e90ff, 0x1e90ff,  // Dodger blue top
    0x87ceeb, 0x87ceeb,  // Sky blue bottom
    1
  );
}
this.skyGradient.fillRect(0, 0, GAME_WIDTH, 430 * SCALE);
```

### Sky Colors
- **Day Top:** `0x1e90ff` (Dodger Blue)
- **Day Bottom:** `0x87ceeb` (Sky Blue)
- **Night Top:** `0x0f172a` (Dark Blue)
- **Night Bottom:** `0x1e293b` (Slate Blue)

### Stars
- 50 circles with random positions (Y: 0-300)
- Twinkling animation via alpha tweens
- Depth -1 (in front of gradient, behind everything else)

**ZONE CODE MUST NOT:**
- Create new sky gradients
- Modify sky colors
- Add elements at depth -2 or -1

---

## Grass/Ground Layer (ZONE-SPECIFIC)

The grass is a **tileSprite** that repeats a small generated texture.

### Texture Generation (BootScene.ts)
```typescript
// generateGrass() creates a 32x32 tileable texture
const size = 32 * SCALE;
const g = this.make.graphics({ x: 0, y: 0 });

// Base grass color
g.fillStyle(0x1a472a);  // Dark green
g.fillRect(0, 0, size, size);

// Random grass blades for detail
g.fillStyle(0x2d5a3d);  // Medium green
for (let i = 0; i < 12; i++) {
  g.fillRect(randomX, randomY, 2 * SCALE, 4 * SCALE);
}

// Small flower accents
g.fillStyle(0xfbbf24);  // Yellow
g.fillRect(8, 12, 3, 3);
g.fillStyle(0xef4444);  // Red
g.fillRect(20, 8, 3, 3);

g.generateTexture("grass", size, size);
g.destroy();
```

### Placement (WorldScene.ts)
```typescript
const groundY = 540 * SCALE;
this.ground = this.add.tileSprite(
  GAME_WIDTH / 2, groundY,
  GAME_WIDTH, 180 * SCALE,
  "grass"
);
this.ground.setDepth(0);
```

### Zone Switching (Visibility Toggle)
```typescript
// Park: Show grass
this.ground.setVisible(true);
this.ground.setTexture("grass");

// BagsCity: Hide grass (city has its own pavement)
this.ground.setVisible(false);
```

**KEY INSIGHT:** Don't recreate the ground - toggle visibility with `setVisible()` or swap textures with `setTexture()`.

---

## Path/Sidewalk Layer (WALKING SURFACE)

The path is where characters walk. It sits on top of the grass.

### Texture Generation (BootScene.ts)
```typescript
// generatePath() creates a 32x32 tileable stone texture
const size = 32 * SCALE;
const g = this.make.graphics({ x: 0, y: 0 });

// Base stone color
g.fillStyle(0x78716c);  // Gray-brown
g.fillRect(0, 0, size, size);

// Random stone details
g.fillStyle(0x57534e);  // Dark gray-brown
for (let i = 0; i < 6; i++) {
  g.fillRect(randomX, randomY, 6 * SCALE, 6 * SCALE);
}

g.generateTexture("path", size, size);
g.destroy();
```

### Placement (WorldScene.ts)
```typescript
const pathY = 570 * SCALE;
const path = this.add.tileSprite(
  GAME_WIDTH / 2, pathY,
  GAME_WIDTH, 40 * SCALE,
  "path"
);
path.setDepth(1);
```

### Character Walking Position
Characters walk at approximately `Y = 555 * SCALE` (on the path).

**DO NOT CHANGE:** The path Y-position must stay consistent across zones for character walking to work.

---

## Zone Switching Pattern

Zones DON'T destroy and recreate layers. They toggle visibility.

### Park → BagsCity Example
```typescript
// setupMainCityZone() - Show park elements
private setupMainCityZone(): void {
  this.ground.setVisible(true);
  this.ground.setTexture("grass");
  this.decorations.forEach(d => d.setVisible(true));
  this.animals.forEach(a => a.sprite.setVisible(true));
  this.restoreNormalSky();
}

// setupTrendingZone() - Hide park, show city
private setupTrendingZone(): void {
  this.ground.setVisible(false);  // Hide grass
  this.decorations.forEach(d => d.setVisible(false));
  this.animals.forEach(a => a.sprite.setVisible(false));

  // Create city elements once, then cache
  if (!this.trendingZoneCreated) {
    this.createTrendingSkyline();
    this.createTrendingDecorations();
    this.trendingZoneCreated = true;
  } else {
    this.trendingElements.forEach(el => el.setVisible(true));
  }
}
```

### Zone Transition Rules
1. **Sky:** Never modify - it persists automatically
2. **Grass:** Toggle with `setVisible()` or swap with `setTexture()`
3. **Path:** Keep visible (covered by zone-specific ground if needed)
4. **Zone elements:** Create once, cache with `zoneCreated` flag, toggle visibility

---

## Creating Zone-Specific Ground

If your zone needs a different ground texture (not grass):

### Option 1: Hide Grass + Draw Custom Ground
```typescript
private setupMyZone(): void {
  this.ground.setVisible(false);  // Hide default grass

  // Draw zone-specific ground
  const cityGround = this.add.graphics();
  cityGround.fillStyle(0x374151);  // Gray concrete
  cityGround.fillRect(0, 530 * SCALE, GAME_WIDTH, 200 * SCALE);
  cityGround.setDepth(0);
  this.myZoneElements.push(cityGround);
}
```

### Option 2: Generate New Ground Texture in BootScene
```typescript
// In BootScene.ts
private generateCityPavement(): void {
  const size = 32 * SCALE;
  const g = this.make.graphics({ x: 0, y: 0 });

  g.fillStyle(0x374151);  // Concrete gray
  g.fillRect(0, 0, size, size);

  // Add crack/tile details
  g.fillStyle(0x4b5563);
  g.fillRect(0, size/2 - 1, size, 2);  // Horizontal line
  g.fillRect(size/2 - 1, 0, 2, size);  // Vertical line

  g.generateTexture("city_pavement", size, size);
  g.destroy();
}

// In WorldScene.ts - swap texture
this.ground.setTexture("city_pavement");
this.ground.setVisible(true);
```

---

## Color Considerations

When designing zone colors, account for BOTH day and night visibility:
- Buildings should be readable against both sky gradients
- Ground textures need contrast with character sprites
- Avoid colors that disappear against dawn/dusk gradients
- Test your zone in both day AND night states

---

## Technical Architecture (HOW BUILDINGS ARE CREATED)

**CRITICAL**: Buildings are NOT drawn in WorldScene.ts. They are pre-generated as reusable textures in BootScene.ts, then placed as sprites in WorldScene.ts.

### Two-Step Process

**Step 1: Generate Textures (BootScene.ts)**
```typescript
// Create a graphics object
const g = this.make.graphics({ x: 0, y: 0 });

// Draw using Phaser Graphics API
g.fillStyle(0xColorHex);           // Set color
g.fillRect(x, y, width, height);   // Draw rectangle
g.fillTriangle(x1,y1, x2,y2, x3,y3); // Draw triangle (roofs)
g.fillCircle(cx, cy, radius);      // Draw circle (domes, ornaments)

// Save as reusable texture
g.generateTexture("texture_name", canvasWidth, canvasHeight);
g.destroy();
```

**Step 2: Place Sprites (WorldScene.ts)**
```typescript
// Use the pre-generated texture as a sprite
const building = this.add.sprite(x, y, "texture_name");
building.setOrigin(0.5, 1);
building.setDepth(depthLayer);
this.zoneElements.push(building);
```

### Existing Building Generators in BootScene.ts

| Method | What It Creates |
|--------|-----------------|
| `generateBuildings()` | 5 levels × 4 styles = 20 building types |
| `generateMansions()` | 5 luxury mansion styles |
| `generateAcademyBuildings()` | 8 campus buildings |
| `generatePokeCenter()` | Pokemon-style center |
| `generateTerminal()` | Tech terminal building |

### Pixel Art Drawing Techniques

**1. 3D Depth Effect**
```typescript
// Light left edge
g.fillStyle(lighten(baseColor, 0.2));
g.fillRect(x, y, 6, height);

// Dark right edge
g.fillStyle(darken(baseColor, 0.25));
g.fillRect(x + width - 6, y, 6, height);
```

**2. Dithering Pattern (texture)**
```typescript
g.fillStyle(darken(baseColor, 0.08));
for (let py = 0; py < height; py += 4) {
  for (let px = 0; px < width; px += 8) {
    if ((py / 4 + px / 8) % 2 === 0) {
      g.fillRect(px, py, 2, 2);
    }
  }
}
```

**3. Glowing Windows**
```typescript
// Glow aura (semi-transparent)
g.fillStyle(windowColor, 0.3);
g.fillRect(wx - 2, wy - 2, width + 4, height + 4);

// Window fill
g.fillStyle(windowColor);
g.fillRect(wx, wy, width, height);

// Highlight corner
g.fillStyle(lighten(windowColor, 0.4));
g.fillRect(wx, wy, 2, 3);
```

### Zone Setup Pattern in WorldScene.ts

Each zone follows this pattern:
```typescript
// 1. Cache variables at class level
private myZoneElements: Phaser.GameObjects.GameObject[] = [];
private myZoneCreated = false;

// 2. Zone switch handler
case "my_zone":
  if (!this.myZoneCreated) {
    this.setupMyZone();
    this.myZoneCreated = true;
  } else {
    this.myZoneElements.forEach(el => el.setVisible(true));
  }
  break;

// 3. Setup method creates all elements
private setupMyZone(): void {
  // Draw background graphics
  // Place building sprites
  // Add decorations
  // Push everything to myZoneElements array
}
```

### File Locations

- **Texture generation**: `src/game/scenes/BootScene.ts`
- **Zone rendering**: `src/game/scenes/WorldScene.ts`
- **Color palette**: `PALETTE` constant in BootScene.ts
- **Helper functions**: `darken()`, `lighten()` in BootScene.ts

---

## Park Zone Template (CANONICAL - USE THIS)

**This is THE template for all new zones.** Every new zone MUST match Park's:
- Y-positions (grassTop, pathLevel, groundY, pathY)
- Element density (24 decorations, 7 animals minimum)
- Depth values (props at 2-4, buildings at 5+, characters at 10)
- Visibility toggle pattern (setVisible, not destroy/recreate)

Match these element counts and placement patterns exactly.

### Y-Position Reference (CRITICAL)

```typescript
const grassTop = 455 * SCALE;    // Top of grass area
const pathLevel = 555 * SCALE;   // Where characters walk
const groundY = 540 * SCALE;     // Grass tileSprite Y
const pathY = 570 * SCALE;       // Path tileSprite Y
```

### Element Placement by Y-Reference

| Element Type | Y Position Formula |
|--------------|-------------------|
| Trees | grassTop (±5-10 variation) |
| Bushes | grassTop + 20-25 |
| Flowers | grassTop + 27-35 |
| Flags | grassTop - 20 |
| Fountain | grassTop + 30 |
| Pond | grassTop + 50 |
| Lamps | pathLevel |
| Benches | pathLevel - 5 |
| Rocks | pathLevel + 2-8 |
| Ground animals | pathLevel + 10 |
| Flying animals | grassTop - 10 to -40 |

### Park Element Inventory

**Trees (4 total)**
```typescript
const treePositions = [
  { x: 50 * SCALE, y: grassTop },
  { x: 180 * SCALE, y: grassTop + 10 },
  { x: 620 * SCALE, y: grassTop + 5 },
  { x: 750 * SCALE, y: grassTop - 5 },
];
// Depth: 2, Scale: 0.9-1.2x random, Animation: 2s sway ±2deg
```

**Bushes (4 total)**
```typescript
const bushPositions = [
  { x: 100 * SCALE, y: grassTop + 25 },
  { x: 300 * SCALE, y: grassTop + 20 },
  { x: 500 * SCALE, y: grassTop + 23 },
  { x: 700 * SCALE, y: grassTop + 21 },
];
// Depth: 2, Scale: 0.7-1.0x random, No animation
```

**Lamps (2 total)**
```typescript
const lampPositions = [
  { x: 200 * SCALE, y: pathLevel },
  { x: 600 * SCALE, y: pathLevel },
];
// Depth: 3, Scale: 1.0x
// Child glow sprite: y - 30, alpha 0.3-0.5 pulse, yellow tint
```

**Benches (2 total)**
```typescript
const benchPositions = [
  { x: 350 * SCALE, y: pathLevel - 5 },
  { x: 450 * SCALE, y: pathLevel - 5 },
];
// Depth: 3, Scale: 1.0x, No animation
```

**Flowers (5 total)**
```typescript
const flowerPositions = [
  { x: 130 * SCALE, y: grassTop + 35 },
  { x: 280 * SCALE, y: grassTop + 30 },
  { x: 420 * SCALE, y: grassTop + 33 },
  { x: 560 * SCALE, y: grassTop + 27 },
  { x: 680 * SCALE, y: grassTop + 31 },
];
// Depth: 2, Scale: 0.8-1.2x random, Animation: 1.5s sway ±3deg
```

**Rocks (3 total)**
```typescript
const rockPositions = [
  { x: 70 * SCALE, y: pathLevel + 5 },
  { x: 380 * SCALE, y: pathLevel + 8 },
  { x: 730 * SCALE, y: pathLevel + 2 },
];
// Depth: 2, Scale: 0.6-0.9x random, No animation
```

**Flags (2 total)**
```typescript
const flagPositions = [
  { x: 50 * SCALE, y: grassTop - 20 },
  { x: 750 * SCALE, y: grassTop - 20 },
];
// Depth: 1, Scale: 1.0x, Animation: 800ms scaleX wave 1.0→0.9
```

**Fountain (1 centered)**
```typescript
const fountainX = GAME_WIDTH / 2;
const fountainY = grassTop + 30;
// Depth: 2, Scale: 1.0x
// Water particles: y - 35, blue tint, upward spray
```

**Pond (1 corner)**
```typescript
const pondX = 100 * SCALE;
const pondY = grassTop + 50;
// Depth: 0, Scale: 1.5x, Alpha: 0.8
// Animation: 2s ripple (scale 1.5→1.55, alpha 0.8→0.6)
```

### Animals Inventory

| Type | Count | X Position | Y Offset | Scale | Depth |
|------|-------|-----------|----------|-------|-------|
| Dog | 1 | 150 | pathLevel + 10 | 1.2x | 4 |
| Cat | 1 | 650 | pathLevel + 10 | 1.1x | 4 |
| Bird | 2 | 100, 700 | grassTop - 20/-10 | 0.8x, 0.7x | 15 |
| Butterfly | 2 | 300, 500 | grassTop - 30/-40 | 0.6x, 0.5x | 15 |
| Squirrel | 1 | 80 | grassTop + 20 | 1.0x | 4 |

**Animal Animations:**
- Ground (dog/cat/squirrel): Bounce y ±2px, 500-800ms
- Birds: Fly y ±15px, 800-1200ms
- Butterflies: Float y ±20px + angle ±5deg, 600-900ms

### Depth Sorting Reference

```
Depth 0:   Pond, grass layer
Depth 1:   Flags, path layer
Depth 2:   Trees, bushes, flowers, rocks, fountain
Depth 3:   Lamps, benches
Depth 4:   Ground animals
Depth 5+:  Buildings
Depth 10:  Characters
Depth 15:  Flying animals
Depth 20:  Fireflies
```

### Totals for Park Zone
- **Decorations:** 24 static elements (4 trees, 4 bushes, 2 lamps, 2 benches, 5 flowers, 3 rocks, 2 flags, 1 fountain, 1 pond)
- **Animals:** 7 animated sprites
- **Particle systems:** 1 (fountain water)

### Creating a New Zone with Park-Matching Density

**REQUIRED:** Every new zone must match these Park zone minimums:
1. **Trees/tall props:** 4-6 elements
2. **Ground cover:** 4-6 bushes/hedges equivalent
3. **Lighting:** 2-4 lamps or equivalent
4. **Seating/furniture:** 2-4 benches or zone-appropriate
5. **Small details:** 5-8 flowers/rocks/small props
6. **Centerpiece:** 1 focal element (fountain equivalent)
7. **Ambient life:** 5-7 animated creatures or zone-appropriate

---

## Prop Texture Generation (BootScene.ts Examples)

### Tree Pattern
```typescript
const tree = this.make.graphics({ x: 0, y: 0 });
// Trunk (brown rectangle)
tree.fillStyle(0x78350f);
tree.fillRect(12, 28, 8, 16);
tree.fillStyle(0x92400e);  // Highlight
tree.fillRect(14, 28, 4, 16);
// Foliage (layered circles, dark to light)
tree.fillStyle(0x166534);
tree.fillCircle(16, 20, 14);
tree.fillStyle(0x15803d);
tree.fillCircle(16, 16, 12);
tree.fillStyle(0x22c55e);
tree.fillCircle(16, 12, 8);
tree.generateTexture("tree", 32, 44);
```

### Lamp Pattern
```typescript
const lamp = this.make.graphics({ x: 0, y: 0 });
// Pole (dark rectangle)
lamp.fillStyle(0x1f2937);
lamp.fillRect(6, 8, 4, 32);
// Light housing (rectangle)
lamp.fillStyle(0x374151);
lamp.fillRect(2, 4, 12, 6);
// Light glow (semi-transparent)
lamp.fillStyle(0xfbbf24, 0.5);
lamp.fillRect(4, 6, 8, 4);
lamp.generateTexture("lamp", 16, 40);
```

### Bench Pattern
```typescript
const bench = this.make.graphics({ x: 0, y: 0 });
// Seat (brown planks)
bench.fillStyle(0x78350f);
bench.fillRect(0, 8, 32, 4);
// Legs
bench.fillRect(2, 12, 4, 8);
bench.fillRect(26, 12, 4, 8);
// Back (lighter)
bench.fillStyle(0x92400e);
bench.fillRect(0, 4, 32, 4);
bench.generateTexture("bench", 32, 20);
```

### Fountain Pattern
```typescript
const fountain = this.make.graphics({ x: 0, y: 0 });
// Base (wide rectangle)
fountain.fillStyle(0x6b7280);
fountain.fillRect(8, 28, 24, 8);
fountain.fillStyle(0x9ca3af);  // Rim
fountain.fillRect(10, 26, 20, 4);
// Middle tier
fountain.fillStyle(0x78716c);
fountain.fillRect(14, 18, 12, 10);
// Top bowl
fountain.fillStyle(0x6b7280);
fountain.fillRect(12, 10, 16, 8);
// Water in bowl (blue, semi-transparent)
fountain.fillStyle(0x60a5fa, 0.7);
fountain.fillRect(14, 12, 12, 4);
// Spout
fountain.fillStyle(0x9ca3af);
fountain.fillRect(18, 4, 4, 8);
fountain.generateTexture("fountain", 40, 36);
```

### Animal Pattern (Dog example)
```typescript
const dog = this.make.graphics({ x: 0, y: 0 });
// Body (brown ellipse/rectangles)
dog.fillStyle(0x92400e);
dog.fillRect(8, 10, 16, 10);
// Head
dog.fillRect(20, 6, 10, 10);
// Legs
dog.fillStyle(0x78350f);
dog.fillRect(10, 18, 4, 6);
dog.fillRect(18, 18, 4, 6);
// Ears
dog.fillRect(22, 2, 3, 4);
dog.fillRect(26, 2, 3, 4);
// Tail
dog.fillRect(4, 8, 6, 3);
// Eye
dog.fillStyle(0x000000);
dog.fillRect(25, 9, 2, 2);
// Snout
dog.fillStyle(0x451a03);
dog.fillRect(28, 12, 3, 3);
dog.generateTexture("dog", 32, 24);
```

### Key Texture Patterns
1. **Use layers:** Dark base → medium detail → light highlight
2. **Size matters:** 16-44px height for props, 32px width common
3. **Color progression:** Each element gets 2-3 shades (base, highlight, shadow)
4. **Semi-transparency:** Use `fillStyle(color, alpha)` for glows/water

---

## BagsCity Zone (SECONDARY EXAMPLE - Urban Variant)

**WARNING:** BagsCity is a SPECIAL CASE with custom ground replacement. Do NOT use this as your primary template.

For standard zones, use the **Park Template** above. Only reference BagsCity if you specifically need:
- Custom pavement/road instead of grass
- Traffic animations
- Scrolling data displays
- Urban/city theming

This section shows how to handle these special cases while still following core layer rules.

### Key Differences from Park
| Aspect | Park | BagsCity |
|--------|------|----------|
| Ground | Grass tileSprite | Pavement rectangle + road |
| Ambient | Animals, fountain | Traffic, billboards |
| Data | Static decorations | Live token displays |
| Theme | Peaceful, natural | Urban, commercial |

### Ground Replacement Pattern

```typescript
// Hide grass
this.ground.setVisible(false);

// Draw pavement (replaces grass)
const pavement = this.add.graphics();
pavement.fillStyle(0x374151);  // Gray
pavement.fillRect(0, 520 * SCALE, GAME_WIDTH, 160 * SCALE);
pavement.setDepth(0);
this.trendingElements.push(pavement);

// Draw road on top
const road = this.add.graphics();
road.fillStyle(0x1f2937);  // Dark gray asphalt
road.fillRect(0, 575 * SCALE, GAME_WIDTH, 50 * SCALE);
road.setDepth(1);
this.trendingElements.push(road);

// Road markings (yellow dashed line)
const markings = this.add.graphics();
markings.fillStyle(0xfbbf24);  // Yellow
for (let x = 30; x < 780; x += 50) {
  markings.fillRect(x * SCALE, 598 * SCALE, 25 * SCALE, 3 * SCALE);
}
markings.setDepth(2);
```

### BagsCity Element Inventory

**Skyline Background (9 total)**
- Back layer: 4 sprites at depth -2, alpha 0.4, tint 0x111827
- Front layer: 5 sprites at depth -1, alpha 0.65-0.75

**Ground Infrastructure**
```typescript
// Pavement: depth 0, Y = 520, height 160
// Road: depth 1, Y = 575, height 50
// Road lines: depth 2, yellow dashed ~15 segments
// Curb: depth 2, Y = 548, height 4
// Crosswalks: depth 2, 2 locations × 6 white stripes each
```

**Street Furniture (8 total)**
| Element | Count | X Positions | Y Position | Depth |
|---------|-------|-------------|------------|-------|
| Street lamps | 4 | 100, 300, 500, 700 | 540 | 3 |
| Traffic lights | 2 | 170, 630 | 520 | 4 |
| Fire hydrant | 1 | 350 | 545 | 3 |
| Trash can | 1 | 450 | 545 | 3 |

**Construction Signs (2 complete structures)**
```typescript
// Per sign: post + background + 2 text lines + 3 barriers
const signPositions = [
  { x: 120 * SCALE, y: 380 * SCALE },
  { x: 680 * SCALE, y: 380 * SCALE },
];
// Post: depth 5, brown 0x8b4513
// Background: depth 6, orange 0xf59e0b
// Text: depth 7, "UNDER CONSTRUCTION"
// Barriers: depth 5, orange/white alternating
```

**Moving Traffic (2 vehicles, ANIMATED)**
```typescript
// Taxi (drives right)
const taxi = this.add.sprite(-60 * SCALE, 585 * SCALE, "taxi");
taxi.setFlipX(true);
taxi.setDepth(3);
// Animation: -60 → GAME_WIDTH+60, duration 6000ms, loop every 10000ms

// Blue car (drives left)
const car = this.add.sprite(GAME_WIDTH + 60, 565 * SCALE, "car_blue");
car.setDepth(3);
// Animation: GAME_WIDTH+60 → -60, duration 7000ms, loop every 12000ms
```

**Billboards (3 displays, DYNAMIC DATA)**

Main Billboard (center):
```typescript
const billboardX = 400 * SCALE;
const billboardY = 150 * SCALE;
// Frame: 166×96, border 0xfbbf24 (gold), depth 5
// Background: 160×90, color 0x0d0d0d (black), depth 5
// Header: "HOT TOKENS", 0xfbbf24, depth 6-7
// Stats text: green 0x4ade80, updates every 5s
// Volume text: blue 0x60a5fa, updates every 5s
```

Side Billboards:
```typescript
// Left (TOP GAINER): X = 130, Y = 320, border 0x4ade80 (green)
// Right (VOLUME KING): X = 670, Y = 320, border 0xec4899 (pink)
// Both: 100×60 size, updates every 5s with live data
```

**Ticker (bottom scrolling, ANIMATED)**
```typescript
const tickerY = 592 * SCALE;
// Background bar: full width, height 16, color 0x0a0a0f, depth 10
// Text: green 0x4ade80, depth 11, scrolls left 2px every 50ms
// Content: Top 5 tokens by volume, regenerated on loop reset
```

### BagsCity Color Palette

| Use | Hex Code | Description |
|-----|----------|-------------|
| Pavement | 0x374151 | Gray sidewalk |
| Road | 0x1f2937 | Dark asphalt |
| Road lines | 0xfbbf24 | Yellow/amber |
| Curb | 0x6b7280 | Medium gray |
| Crosswalk | 0xffffff | White |
| Construction | 0xf59e0b | Orange |
| Billboard bg | 0x0d0d0d | Near black |
| Billboard border | 0xfbbf24 | Gold |
| Stats text | 0x4ade80 | Green |
| Volume text | 0x60a5fa | Blue |
| Gainer accent | 0x4ade80 | Green |
| Volume accent | 0xec4899 | Pink |
| Ticker bg | 0x0a0a0f | Dark |

### BagsCity Depth Map

```
Depth -2:  Skyline back layer
Depth -1:  Skyline front layer
Depth 0:   Pavement
Depth 1:   Road
Depth 2:   Road markings, curb, crosswalks
Depth 3:   Street lamps, hydrant, trash, traffic
Depth 4:   Traffic lights
Depth 5:   Construction posts, barriers, billboard frames
Depth 6:   Billboard backgrounds, headers
Depth 7:   Billboard text
Depth 10:  Ticker background
Depth 11:  Ticker text
```

### BagsCity Totals
- **Static elements:** 75+ (ground, furniture, signs, billboards)
- **Animated elements:** 5 (taxi, car, 3 billboard texts, ticker)
- **Timers:** 3 (taxi loop, car loop, ticker update)
- **Data updates:** Every 5s for billboards, 50ms for ticker scroll

### Key Patterns for Urban Zones

1. **Replace grass:** `this.ground.setVisible(false)` then draw custom ground
2. **Layer ground:** Pavement (depth 0) → Road (depth 1) → Markings (depth 2)
3. **Add traffic:** Sprites with looping tweens + timers
4. **Data displays:** Text objects updated via timer callbacks
5. **Clean up timers:** Destroy traffic/ticker timers on zone exit

---

## Building Templates (REQUIRED REFERENCE)

Before creating ANY new building, study these existing buildings and replicate their level of detail:

### Reference Buildings

**Terminal Building**
- Multi-story structure
- Neon "TERMINAL" sign on top
- Grid windows with glow effects
- Tech/cyberpunk aesthetic
- Detailed roof elements

**Rewards Center**
- Distinct structure with signage
- Multiple architectural details
- Clear entrance

**$BagsWorld Castle**
- Floating structure
- Yellow/gold triangular roof elements
- Teal/green window grid pattern
- Multiple architectural details (spires, columns)
- Labeled sign beneath

**Forecenter Tower**
- Tall dark teal structure
- Green spire top
- Consistent window grid
- Clear floor separation

**Dojo**
- Warm brown wood texture
- Traditional roof shape
- Entrance detail

### How to Use Templates

When creating a new building:
1. Pick the closest reference building to your target style
2. Match its LEVEL OF DETAIL (window count, roof complexity, signage)
3. Apply the new zone's color theme
4. Adjust shape/purpose but KEEP the detail density

### Example Process

User request: "Mansion for Ballers Valley"

1. Reference: $BagsWorld Castle (complex, multi-element structure)
2. Match detail level: Multiple roof peaks, window grids, entrance columns
3. Apply theme: Luxury colors (gold trim, white/marble walls)
4. Result: Detailed mansion with columns, balconies, fancy windows, ornate roof

NOT acceptable: Plain rectangle with two windows labeled "mansion"

### Minimum Detail Checklist Per Building

- [ ] Multiple distinct architectural elements (roof, walls, base)
- [ ] Window pattern (grid or intentional placement)
- [ ] Entrance/door detail
- [ ] Signage or identifying feature
- [ ] Color variation (not single flat color)
- [ ] Matches reference building complexity

---

## Zone Content Requirements (MANDATORY)

Every zone MUST contain:

### Buildings (MINIMUM 3)
- At least 3 distinct buildings with full pixel art detail
- Buildings must have: walls, windows, doors, roof details
- NO empty placeholder rectangles or poles
- NO generic shapes - each building must be identifiable

### Props (MINIMUM 5)
- Trees, lamps, signs, benches, decorations appropriate to theme
- Props must match pixel density of existing zones
- NO bare/empty spaces between buildings

### Ground Detail
- Texture must have visible detail (tiles, grass edges, path markings)
- NO solid flat colors

### What is NOT ACCEPTABLE
- Empty placeholder poles or signs
- Bare rectangles without detail
- Zones with only a title banner
- Large empty spaces with no content
- Generic/procedural shapes

If the zone description says "mansions" then generate ACTUAL MANSION BUILDINGS with:
- Multiple floors
- Detailed windows
- Fancy rooflines (columns, balconies, etc.)
- Surrounding props (hedges, fountains, statues, gates)

### Validation Check

Before completing a zone, verify against the **Park zone** benchmark:
1. [ ] Are there at least 3 detailed buildings? (Park has multiple)
2. [ ] Can you identify what each building is? (Not generic rectangles)
3. [ ] Are there 20+ props filling the space? (Park has 24 decorations)
4. [ ] Does the ground have texture detail? (Not solid flat color)
5. [ ] Does it visually match **Park zone quality**?
6. [ ] Are Y-positions correct? (grassTop=455, pathLevel=555, groundY=540, pathY=570)
7. [ ] Are depths correct? (props 2-4, buildings 5+, characters 10)

If ANY answer is NO, the zone is incomplete. Continue adding detail.

---

## Creative Direction (STRICT)

Claude Code is a BUILDER, not a creative director.

### Rules
1. When the user describes what they want, BUILD EXACTLY THAT
2. Do not substitute, simplify, or reinterpret user requests
3. Do not argue that a different approach is "better"
4. Do not justify minimal output as "matching the style"
5. If the user says "mansions" - build detailed mansions, not rectangles
6. If the user says "gold accents" - add gold accents, don't argue about palette

### What "Matching Pixel Style" Actually Means
- DOES mean: Hard edges, no anti-aliasing, consistent scale
- DOES NOT mean: Minimal detail, empty shapes, placeholder graphics

### Examples of Unacceptable Behavior
- User asks for mansions → generates plain rectangles → claims "chunky pixel style"
- User asks for fountains → generates gray boxes → claims "matches aesthetic"
- User asks for luxury theme → generates bare zone → claims "clean design"

The **Park zone** is the quality benchmark. New zones must match Park's level of DETAIL and element density, not just "style."

### If Unsure
Ask the user for clarification. Do not make assumptions that reduce detail or complexity.

---

## Pixel Art Standards

### Scale & Density
- Match pixel density of existing buildings
- Reference existing buildings for height/width ratios
- Maintain consistent character-to-building scale
- New characters must match existing character sprite size/style

### Style Rules (LOCKED)
1. Hard pixel edges only - no anti-aliasing
2. No smooth gradients - use dithering or solid color blocks
3. Rectangular base shapes for buildings
4. Window grids: Small rectangular patterns, consistent spacing
5. Roof styles: Flat, pointed triangle, or single-tier step
6. Door placement: Center-bottom

### Color Palette (FLEXIBLE)

Each zone can have its own color theme, but must:
1. Work with BOTH day and night sky states
2. Maintain contrast ratios similar to existing zones
3. Stick to solid colors or dithering - no smooth gradients
4. Keep info displays readable in all lighting

#### Zone Color Examples
- Park: Greens, warm browns, cream (natural/peaceful)
- BagsCity: Teals, magentas, neon greens (urban/tech)
- Beach: Sandy yellows, ocean blues, coral pinks
- Haunted: Purples, grays, sickly greens
- Casino: Golds, reds, black, bright whites

#### Color Rules
- Buildings must contrast with sky in day AND night
- Ground texture must contrast with character sprites
- Accent colors for signs/displays can be vibrant
- Window glow colors can vary per zone theme

### Props
- Match pixel aesthetic of existing props
- Trees, lamps, benches, signs can vary per zone theme
- Glow effects must match existing lamp style (soft pixel glow)
- Signs can be neon style or wooden post style

### Info Displays
- Border: 2px solid
- Background: Semi-transparent dark
- Font: Pixel font, bright color for data, white for labels
- Colors can match zone theme while maintaining readability

---

## Ground Layer Rules

The ground texture can change per zone, but must:
1. Maintain consistent height/Y-position for character walking
2. Match pixel density of existing ground textures
3. Include clear walkable path area

### Ground Texture Examples
- Park: Gray sidewalk + grass edges
- BagsCity: Concrete street + yellow road markings
- Beach: Sand + wooden boardwalk
- Tech: Metal grating + neon strip lights
- Forest: Dirt path + grass patches
- Luxury: Marble tiles, red carpet, gold trim pathways

### What CANNOT Change
- Character walk path Y-position
- Overall ground height in the scene
- Collision/interaction boundaries

---

## Characters

- Each zone can have different character sets
- New characters must match existing sprite size and pixel style
- Characters walk along the ground layer path
- Animation style must match existing character animations

---

## Zone Switching

**IMPORTANT:** Follow the existing zone transition pattern configured between Park and BagsCity exactly. Do not modify the zone switching logic or create new transition methods.

When creating a new zone:
1. Use the same transition system already in place
2. Do not alter transition timing or effects
3. Register new zone in the same way existing zones are registered

---

## Creating a New Zone Checklist

**IMPORTANT:** This checklist is based on the Park zone template. Follow it exactly.

### Technical Setup (Files to Modify)
1. [ ] Add zone type to `src/lib/types.ts` (ZoneType and ZONES)
2. [ ] Add zone cache variables in WorldScene.ts (`myZoneElements[]`, `myZoneCreated`)
3. [ ] Create texture generators in BootScene.ts (use `generateTexture()`)
4. [ ] Create zone setup method in WorldScene.ts (`setupMyZone()`)
5. [ ] Add zone case to zone switch handler in WorldScene.ts

### Layer Rules (CRITICAL - Match Park Zone)
6. [ ] **Sky (depth -2):** DO NOT TOUCH - it persists automatically
7. [ ] **Grass (depth 0):** Either `setVisible(false)` or `setTexture("new_texture")`
8. [ ] **Path (depth 1):** Keep at Y = 570 * SCALE for character walking
9. [ ] **Props (depth 2-4):** Trees, bushes, lamps, benches, decorations
10. [ ] **Buildings (depth 5+):** Use pre-generated textures from BootScene
11. [ ] **Characters (depth 10):** NPCs at pathLevel (555 * SCALE)
12. [ ] **Zone elements:** Push to `myZoneElements[]` array for visibility toggling

### Ground Layer
13. [ ] If hiding grass: Create zone-specific ground graphics at depth 0
14. [ ] If custom ground texture: Generate in BootScene, swap with `setTexture()`
15. [ ] Ground must have visible detail (tiles, cracks, patterns) - not solid color
16. [ ] Character walk path Y-position must stay at ~555 * SCALE

### Content Requirements (Match Park Density)
17. [ ] MINIMUM 3 detailed buildings with textures generated in BootScene
18. [ ] MINIMUM 20 props (Park has 24 decorations - match this)
19. [ ] Buildings use: fillRect, fillTriangle, fillCircle with proper layering
20. [ ] Reference existing generators (generateBuildings, generateMansions) for detail level

### Visual Standards
21. [ ] Day/night compatibility: Zone colors work against both sky gradients
22. [ ] Pixel style: Hard edges, dithering, no smooth gradients
23. [ ] 3D depth: Light left edges, dark right edges on buildings
24. [ ] Window glow: Semi-transparent aura + highlight corner

### Zone Switching
25. [ ] Hide park elements: `decorations.forEach(d => d.setVisible(false))`
26. [ ] Cache zone: Create elements once, use `zoneCreated` flag
27. [ ] Toggle visibility: Use `setVisible()` not destroy/recreate
28. [ ] Characters: Match existing sprite size/style

### Final Validation
29. [ ] Does this zone match Park zone quality? (Park is the benchmark)
30. [ ] Test in BOTH day and night sky states
31. [ ] Verify characters walk correctly on path at Y = 555 * SCALE

---

## Reference

### File Locations
- **Texture generation**: `src/game/scenes/BootScene.ts`
- **Zone rendering**: `src/game/scenes/WorldScene.ts`
- **Zone types**: `src/lib/types.ts`

### Layer Methods (WorldScene.ts)
- `createSky()` - Creates persistent sky gradient + stars
- `drawSkyGradient(isNight)` - Switches day/night colors
- `restoreNormalSky()` - Resets sky after special zones

### Texture Generators (BootScene.ts)
- `generateGrass()` - Park ground texture (32x32 tileable)
- `generatePath()` - Sidewalk texture (32x32 tileable)
- `generateBuildings()` - Standard buildings (5 levels × 4 styles)
- `generateMansions()` - Luxury structures
- `generateAcademyBuildings()` - Campus buildings

### Zone Setup Methods (WorldScene.ts)
- `setupMainCityZone()` - Park zone (shows grass, decorations)
- `setupTrendingZone()` - BagsCity (hides grass, shows city elements)
- `setupAcademyZone()` - Academy (campus theme)
- `setupBallersZone()` - Ballers Valley (luxury theme)

### Key Constants
- `SCALE` - Pixel scale multiplier (usually 1.6)
- `GAME_WIDTH` - Canvas width
- `groundY = 540 * SCALE` - Grass layer Y position
- `pathY = 570 * SCALE` - Walking path Y position
- `pathLevel = 555 * SCALE` - Character walking Y position

### Style Reference
- Park: Hospital, Forecenter tower, trees, benches, lamps
- BagsCity: Dojo, Terminal, GhostGoat area, construction signs

### Detail Benchmarks
- Terminal Building (tech structures)
- Rewards Center (functional buildings)
- $BagsWorld Castle (ornate/detailed structures)
- Mansions (luxury multi-element structures)

### Zone Transition Pattern
```typescript
// 1. Hide park elements
this.ground.setVisible(false);
this.decorations.forEach(d => d.setVisible(false));

// 2. Create zone once, cache it
if (!this.myZoneCreated) {
  this.setupMyZone();
  this.myZoneCreated = true;
} else {
  this.myZoneElements.forEach(el => el.setVisible(true));
}
```

---

## Quick Zone Template (COPY THIS - Based on Park)

Use this template when creating any new zone. This follows the Park zone pattern exactly.
Copy and adapt, but DO NOT change the core Y-positions or depth values.

### Step 1: Add Zone Type (types.ts)
```typescript
// In src/lib/types.ts
export type ZoneType = "main_city" | "trending" | "academy" | "ballers" | "my_zone";

export const ZONES: Record<ZoneType, ZoneInfo> = {
  // ... existing zones
  my_zone: {
    id: "my_zone",
    name: "My Zone Name",
    description: "Zone description here",
    icon: "[M]",
  },
};
```

### Step 2: Add Cache Variables (WorldScene.ts class level)
```typescript
private myZoneElements: Phaser.GameObjects.GameObject[] = [];
private myZoneCreated = false;
```

### Step 3: Add Zone Case (WorldScene.ts zone switch)
```typescript
case "my_zone":
  if (!this.myZoneCreated) {
    this.setupMyZone();
    this.myZoneCreated = true;
  } else {
    this.myZoneElements.forEach(el => (el as any).setVisible(true));
  }
  break;
```

### Step 4: Create Setup Method (WorldScene.ts)
```typescript
private setupMyZone(): void {
  const s = SCALE;
  const grassTop = Math.round(455 * s);
  const pathLevel = Math.round(555 * s);

  // === GROUND (choose one) ===
  // Option A: Keep grass
  this.ground.setVisible(true);
  this.ground.setTexture("grass");

  // Option B: Hide grass, draw custom ground
  this.ground.setVisible(false);
  const ground = this.add.graphics();
  ground.fillStyle(0x374151);  // Your ground color
  ground.fillRect(0, Math.round(450 * s), GAME_WIDTH, Math.round(250 * s));
  ground.setDepth(0);
  this.myZoneElements.push(ground);

  // === DECORATIONS (minimum 5) ===
  const lampPositions = [
    { x: Math.round(200 * s), y: pathLevel },
    { x: Math.round(600 * s), y: pathLevel },
  ];
  lampPositions.forEach(pos => {
    const lamp = this.add.sprite(pos.x, pos.y, "lamp");
    lamp.setOrigin(0.5, 1);
    lamp.setDepth(3);
    this.myZoneElements.push(lamp);
  });

  // Add more: trees, benches, signs, etc.
  // Use existing textures or create new ones in BootScene

  // === BUILDINGS (minimum 3) ===
  // Either use existing building textures or create custom ones
  const building = this.add.sprite(
    Math.round(400 * s),
    pathLevel,
    "building_3_0"  // or your custom texture
  );
  building.setOrigin(0.5, 1);
  building.setDepth(5);
  this.myZoneElements.push(building);

  // === ZONE TITLE (optional) ===
  const title = this.add.text(
    GAME_WIDTH / 2,
    Math.round(100 * s),
    "MY ZONE",
    { fontFamily: "monospace", fontSize: `${Math.round(24 * s)}px`, color: "#ffffff" }
  );
  title.setOrigin(0.5);
  title.setDepth(10);
  this.myZoneElements.push(title);

  // === ANIMATIONS (optional) ===
  // Add tweens for movement, glow, etc.
}
```

### Step 5: Hide Zone on Exit (in other zone setups)
```typescript
// Add to setupMainCityZone(), setupTrendingZone(), etc.
this.myZoneElements.forEach(el => (el as any).setVisible(false));
```

### Step 6: Generate Custom Textures (BootScene.ts, if needed)
```typescript
private generateMyZoneAssets(): void {
  const s = SCALE;
  const g = this.make.graphics({ x: 0, y: 0 });

  // Draw your building/prop
  g.fillStyle(0xBaseColor);
  g.fillRect(x, y, width, height);

  // Add details: windows, roof, door
  g.fillStyle(0xDetailColor);
  g.fillRect(wx, wy, ww, wh);

  // Save texture
  g.generateTexture("my_texture", canvasWidth, canvasHeight);
  g.destroy();
}

// Call in generatePlaceholderAssets():
this.generateMyZoneAssets();
```

### Minimum Element Counts
| Category | Minimum | Examples |
|----------|---------|----------|
| Buildings | 3 | Shops, towers, houses |
| Props | 5 | Lamps, benches, signs, trees |
| Ground detail | 1 | Textured surface, not solid |
| Animations | 1-2 | Swaying, glowing, moving |

### Y-Position Quick Reference
```typescript
const grassTop = 455 * SCALE;   // Trees, tall props
const pathLevel = 555 * SCALE;  // Lamps, benches, characters walk here
const groundY = 540 * SCALE;    // Ground layer Y
```

### Depth Quick Reference
```
0:  Ground/grass layer
1:  Path layer
2:  Trees, bushes, low props
3:  Lamps, benches, street furniture
4:  Ground animals, small details
5+: Buildings
10: Characters
15: Flying elements
```

---

## Prompting a New Zone

When requesting a new zone, include:
```
Create a new zone called [NAME]. Follow the Park template in CLAUDE.md exactly.

ZONE CONTENT:
- Theme: [describe the vibe/purpose]
- Buildings: [list specific buildings you want]
- Props: [list decorations, plants, furniture]
- Ground texture: [describe the surface]
- Color theme: [list colors]
- Special features: [any unique displays or elements]
```

Example:
```
Create a new zone called Ballers Valley. Follow the Park template in CLAUDE.md exactly.

ZONE CONTENT:
- Theme: Luxury district for top $BagsWorld holders
- Buildings: 3 mansions with columns and balconies, 1 bank vault, 1 trophy hall
- Props: Gold statues, fancy street lamps, hedges, fountains, iron gates
- Ground texture: Marble tile pathway with gold trim
- Color theme: White/cream walls, gold accents, deep purple roofs
- Special features: Leaderboard display showing top holders
```
