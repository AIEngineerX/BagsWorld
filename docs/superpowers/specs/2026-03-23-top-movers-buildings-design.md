# Top 15 Movers — Live Bags.fm Buildings with Dynamic AI Agents

**Date:** 2026-03-23
**Status:** Implemented — updated 2026-03-24 with zone-specific showcase textures

## Summary

BagsWorld will automatically showcase the top 15 trending tokens from Bags.fm as themed buildings across 5 zones. Each building gets a dynamic AI agent personality based on the token's name and performance. Top 3 movers earn prestigious Ascension Spire placement.

## Data Pipeline

### Discovery Flow (As-Built)
1. **Single API call** to `https://api2.bags.fm/api/v1/token-launch/top-tokens/lifetime-fees` — returns 170+ tokens with rich stats (6h/24h volume, price change, trader count)
2. **Composite trending score** per token: `volume6h × momentum × breadth` where momentum = `1 + max(priceChange6h, -50) / 100` and breadth = `log(traders24h + 1)`
3. **Sort and rank:** Top 15 by trending score. Exclude any tokens already in the user's registered token list.
4. **Cache:** 5-minute TTL on discovery results. Theme cache persists across cycles with sticky thresholds.

**Total cost:** 1 API call per 5 minutes (no enrichment needed — the top-tokens endpoint returns all stats).

### Integration with Existing Code
The existing `discoverPlatformTokens()` function in `world-state/route.ts` (line ~198) currently uses `searchTokens("BAGS")` via DexScreener. **This function will be refactored** to use the new two-step flow above, replacing the DexScreener-only search approach. The new flow is more reliable (native Bags feed) and returns richer data (graduation status).

### Architectural Change: Platform Tokens → Buildings
Currently, `buildWorldState()` in `world-calculator.ts` explicitly filters OUT platform tokens at line ~863:
```typescript
const buildableTokens = tokens.filter((t) => !t.isPlatform);
```
Platform tokens currently contribute only to world health metrics, not to buildings.

**Change required:** After the existing `buildableTokens` filter, add a separate pipeline for platform tokens:
1. Keep the existing filter — user-registered tokens become buildings as before
2. Add new code: take the top 15 platform tokens, run them through a new `transformPlatformToken()` function
3. Append the resulting platform `GameBuilding` objects to the buildings array
4. Platform buildings do NOT participate in: decay system, health baseline calculation, or position caching

### Data Shape
Each platform token gets `isPlatform: true` on both `TokenInfo` and `GameBuilding`. No database storage — platform buildings are ephemeral, recalculated every 60s. The API response is the sole source of truth.

### Fewer Than 15 Tokens
If fewer than 15 tokens qualify, fill zones in priority order: Ascension Spire first (up to 3), then BagsCity (up to 3), then Park, HQ, Moltbook Beach. Zones at the end of the list simply get fewer or zero platform buildings. Empty slots render nothing — no placeholder.

## Building Placement

### Zone Distribution (As-Built)

| Rank  | Zone             | Zone ID     | Count | Showcase Textures                           |
|-------|------------------|-------------|-------|---------------------------------------------|
| #1-4  | Ascension Spire  | `ascension` | 4     | Temple, Observatory, Vault, Shrine          |
| #5-7  | BagsCity         | `trending`  | 3     | Neon Shop, Comm Tower, Signal Tower         |
| #8-10 | Park             | `main_city` | 3     | Greenhouse, Garden Pavilion, Treehouse      |
| #11-13| HQ               | `labs`      | 3     | Generic platform_${theme} (volcano→crystal) |
| #14-15| Moltbook Beach   | `moltbook`  | 2     | Volcano Hut, Tiki Tower                     |

### Excluded Zones (and why)
- **Ballers Valley** (`ballers`) — reserved for top $BagsWorld holder mansions only
- **Founder's Corner** (`founders`) — dedicated to Professor Oak and launch education; adding market buildings would confuse the zone's purpose
- **MoltBook Arena** (`arena`) — dormant combat zone, no building placement

### Position Slots Per Zone
Each target zone defines 3 X-positions for platform buildings, chosen to avoid overlap with existing landmarks:

| Zone | Slot 1 (X) | Slot 2 (X) | Slot 3 (X) | Y (base) | Notes |
|------|-----------|-----------|-----------|----------|-------|
| `ascension` | 200 | 420 | 640 | `grassTop` | Spaced across the elevated platform |
| `trending` | 180 | 500 | 820 | `grassTop` | Between Casino and existing neon buildings |
| `main_city` | 250 | 550 | 850 | `grassTop` | Right side of Park, away from PokeCenter/Treasury |
| `labs` | 200 | 480 | 760 | `grassTop` | Between HQ building and server racks |
| `moltbook` | 220 | 500 | 780 | `grassTop` | Along the beach, between palm trees |

All positions use `SCALE` multiplier and `setOrigin(0.5, 1)` per Zone Creation Guide. Depth = 5 (buildings layer).

## Building Visuals — Performance-Themed

### Theme Assignment

| Condition              | Building Theme | Texture Key          | Description                        |
|------------------------|---------------|----------------------|------------------------------------|
| change24h > +20%       | Rocket        | `platform_rocket`    | Rocket-shaped, fire particles      |
| change24h < -20%       | Volcano       | `platform_volcano`   | Crater/volcano, smoke particles    |
| volume24h > $50K       | Golden Palace | `platform_palace`    | Gold temple, shimmering            |
| Default (none of above)| Crystal Tower | `platform_crystal`   | Clean crystal spire, neutral glow  |

Priority order: Rocket > Volcano > Palace > Crystal (first matching condition wins).

### Sticky Threshold
Theme state is stored in a module-level `Map<string, string>` in `world-state/route.ts` (same pattern as existing `sdkEnrichCache`). Once a building receives a theme, it keeps it until the metric swings past the threshold by 10% (e.g., a rocket at +25% stays a rocket until it drops below +10%). On serverless cold starts, the cache resets — this is acceptable since the theme will be recalculated correctly, just without hysteresis for the first cycle.

### Texture Generation (BootScene.ts)
- `generatePlatformBuildings()` in `src/game/textures/platform-buildings.ts`
- **12 textures** generated at boot:
  - 4 generic themes: `platform_rocket`, `platform_volcano`, `platform_palace`, `platform_crystal`
  - 3 BagsCity showcases: `city_showcase_1` (neon shop), `city_showcase_2` (comm tower), `city_showcase_3` (signal tower)
  - 3 Park showcases: `park_showcase_1` (greenhouse), `park_showcase_2` (garden pavilion), `park_showcase_3` (treehouse)
  - 2 Beach showcases: `beach_showcase_1` (volcano hut), `beach_showcase_2` (tiki tower)
- Ascension zone textures are generated separately in `ascension-assets.ts`
- Pixel art style per Zone Creation Guide (hard edges, dithering, 3D depth, window glow)
- Each texture ~70-90px wide, ~95-110px tall
- Day/night compatible colors

### Visual Distinction from User Buildings
- Platform buildings have a cyan/purple tinted color palette (vs green for user buildings)
- Small "BAGS.FM" text badge rendered below the building name tooltip
- Slightly smaller scale (0.85x) than equivalent-level user buildings

## AI Agent Chat

### Trigger
- User clicks a platform building → `BuildingModal` opens with stats/chart
- New "CHAT" tab added to `BuildingModal` for buildings where `isPlatform === true`

### Data Flow: Click → Modal → Chat
1. `WorldScene.ts` emits `bagsworld-building-click` event with building data
2. `page.tsx` receives event, populates `BuildingClickData` — **add `isPlatform` and `platformTheme` fields**
3. `BuildingModal` receives props including `isPlatform` — **add to `BuildingModalProps`**
4. When `isPlatform`, render a "CHAT" tab alongside the existing chart/trade tabs

### New API Route: `/api/platform-chat`
A separate route is cleaner than overloading `/api/character-chat` (which proxies to ElizaOS):
- **Input:** `{ tokenName, symbol, marketCap, volume24h, change24h, zone, message, history }`
- **Implementation:** Direct Anthropic API call using `ANTHROPIC_API_KEY` (already a project dependency)
- **Output:** Streaming text response (same SSE format as character-chat)
- **No ElizaOS dependency** — pure Claude API

### Dynamic Prompt Template
```
You are the AI guardian of ${tokenName} ($${symbol}).
Your personality is inspired by "${tokenName}" — fully embody what that name evokes.
You are a trending token on Bags.fm, currently visiting BagsWorld.

Live stats:
- Market Cap: ${mcap}
- 24h Volume: ${volume24h}
- 24h Change: ${change24h}%
- Zone: ${zoneName}

Your mood reflects your performance:
${change24h > 20 ? "You're euphoric — to the moon!" : change24h < -20 ? "You're stressed but holding strong." : "You're chill and confident."}

Keep responses short (2-3 sentences), fun, in character.
Talk about your token, the Bags.fm ecosystem, and BagsWorld.
If asked about other tokens, redirect to your own story.
```

## Files to Modify

### New Files
| File | Purpose |
|------|---------|
| `src/game/textures/platform-buildings.ts` | 12 themed texture generators (4 generic + 3 city + 3 park + 2 beach) |
| `src/app/api/platform-chat/route.ts` | Direct Anthropic API chat for platform token agents |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/types.ts` | Add `isPlatform?: boolean` and `platformTheme?: string` to `GameBuilding`. Add `isPlatform` to `BuildingClickData` if it exists there. |
| `src/app/api/world-state/route.ts` | Refactor `discoverPlatformTokens()` to use `getLaunchFeed()` + DexScreener enrichment. Add theme assignment with sticky cache. Append platform buildings to world state. |
| `src/lib/world-calculator.ts` | Add `transformPlatformToken()` function. Keep existing `isPlatform` filter for user buildings. Add separate pipeline to create platform `GameBuilding` objects with zone/theme assignment. |
| `src/game/textures/index.ts` | Export new `generatePlatformBuildings` |
| `src/game/scenes/BootScene.ts` | Call `generatePlatformBuildings()` during boot |
| `src/game/scenes/WorldScene.ts` | Render platform buildings per zone with theme-based texture selection. Include `isPlatform` in building click event data. |
| `src/components/BuildingModal.tsx` | Accept `isPlatform` prop. Add "CHAT" tab that calls `/api/platform-chat`. |
| `src/app/page.tsx` | Pass `isPlatform` through `BuildingClickData` to `BuildingModal` |

## Refresh Behavior
- Top 15 recalculated every 60s with world-state poll (no new timer)
- Buildings that drop out of top 15 disappear on next Phaser zone render
- New entries appear in their assigned zone slot
- Theme changes are sticky (10% swing required, best-effort on serverless cold starts)
- No database persistence — fully ephemeral

## What This Does NOT Change
- User-registered buildings — unaffected, keep their zones and behavior
- Permanent buildings (Treasury, PokeCenter) — unaffected
- BagsWorld HQ floating building — unaffected
- Mansions in Ballers Valley — unaffected
- Existing AI characters (17 NPCs) — unaffected
- Building decay system — platform buildings don't decay (they rotate out instead)
- Health calculation — platform buildings don't count toward world health baseline

## Success Criteria
- Visiting bagsworld.app shows a populated world with real trending Bags.fm tokens
- Each target zone has up to 3 themed platform buildings based on live market data
- Top 3 tokens are in Ascension Spire
- Clicking any platform building shows stats + a "CHAT" tab with a unique AI personality
- Buildings update every 60s without page reload
- Fewer than 15 qualifying tokens gracefully fills priority zones first
- No performance regression (same number of Phaser sprites, just different textures)
