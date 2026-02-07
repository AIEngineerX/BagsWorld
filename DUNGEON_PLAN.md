# BagsWorld Dungeon — Implementation Plan

## Overview

Embed a full 2D MMORPG dungeon inside BagsWorld by forking [Kaetram](https://github.com/Kaetram/Kaetram-Open), an open-source HTML5 game engine (MPL-2.0 license). Players click a **Dungeon** building in BagsCity, which opens a fullscreen iframe running a customized Kaetram client connected to a lightweight game server. When they exit, BagsWorld resumes exactly where they left off.

**Game-within-a-game.** BagsWorld is the overworld. The Dungeon is a complete action RPG with real-time combat, mobs, bosses, items, inventory, and skills — powered by Kaetram's battle-tested engine.

---

## Architecture

```
BagsWorld (Next.js / Netlify)
├── Phaser WorldScene (PAUSED when dungeon open)
├── React UI Layer
│   └── DungeonModal.tsx
│       └── <iframe src="/games/dungeon/index.html">
│           └── Kaetram Client (8 layered canvases)
│               └── WebSocket -> wss://dungeon.bagsworld.com
│
└── public/games/dungeon/    <-- Built Kaetram client (static files)
        ├── index.html
        ├── _astro/          <-- Bundled JS/CSS (Astro build output)
        ├── img/tilesets/    <-- Dungeon tilesets
        ├── img/sprites/     <-- Character/mob sprites (reused from Kaetram)
        └── data/maps/map.json

Kaetram Server (Railway, ~$5/mo)
├── uWebSockets.js on port 9001
├── SKIP_DATABASE=true (no MongoDB needed)
├── Custom world.json (small dungeon map, ~50-200KB vs 4.3MB default)
├── Trimmed mobs.json, items.json
└── ~20-50MB RAM, handles 10-50 concurrent players
```

### Why Iframe (Not Direct DOM Embedding)

| Problem | Iframe Solves It |
|---|---|
| Kaetram uses 8 hardcoded canvas IDs (`#background`, `#foreground`, etc.) | Iframe has its own DOM -- no ID conflicts |
| Kaetram's CSS toggles `body` class between `intro` and `game` | Isolated body element in iframe |
| Kaetram captures all keyboard events on `document` | Iframe focus isolation -- only active game gets input |
| Kaetram + Phaser = 2 WebGL contexts (Safari kills the older one) | Iframe gets its own WebGL context budget |
| Kaetram's UI is ~950 lines of hardcoded HTML with `document.querySelector()` | Fully contained in iframe |
| Same-origin iframe (`/public/games/dungeon/`) | Full `postMessage` + shared `localStorage`, zero CORS |

---

## Kaetram Technical Profile

### What It Is

- **2D tile-based MMORPG** (top-down, Legend of Zelda / BrowserQuest style)
- Originally Mozilla's BrowserQuest (2012), fully rewritten in TypeScript
- 380+ mobs, 3000+ items, 20+ skills, guild system, PvP, pets, mounts
- Live at kaetram.com, available on Steam + iOS + Android
- ~664 GitHub stars, actively maintained

### Tech Stack

| Component | Technology |
|---|---|
| Language | TypeScript (entire codebase) |
| Package Manager | Yarn 4 (Berry) with Corepack |
| Client Build | Astro (SSG) + Vite |
| Client Rendering | HTML5 Canvas 2D (8 layered canvases) + optional WebGL |
| Client Networking | Native WebSocket (NOT socket.io) |
| Server Runtime | Node.js 18+ or 20+ |
| Server WebSocket | uWebSockets.js (C++ native, high-performance) |
| Server Database | MongoDB (optional -- `SKIP_DATABASE=true` runs without it) |
| Map Editor | Tiled Map Editor (industry-standard, free) |
| Monorepo Packages | client, server, common, hub, tools, admin, e2e |

### Client Architecture

- **Entry:** `window.onload -> new Game(new App())`
- **App class:** Manages login UI (DOM forms), calls `Socket.connect()` on login
- **Game class:** Creates Player, Map, Camera, Renderer, Socket, InputController, MenuController, AudioController, EntitiesController, BubbleController, Connection (45+ packet handlers)
- **Renderer:** 8 HTML canvases (background, foreground, entities, entities-fore, entities-mask, overlay, cursor, text-canvas)
- **Game loop:** `requestAnimationFrame` at 50 FPS target: `updater.update()` + `renderer.render()`
- **Assets:** ~23MB total (sprites ~4.5MB, tilesets ~1.2MB, audio ~16MB, UI ~1MB)

### Server Architecture

- **World tick:** `setInterval` at 300ms (3.3 ticks/second) for packet flushing + region updates
- **Combat tick:** Per-character `setInterval` at ~250ms when in combat
- **Map:** Single `world.json` (4.3MB for full world) loaded at startup
- **Regions:** 48x48 tile chunks for spatial partitioning and efficient broadcasting
- **Entity grid:** Full map-sized 2D array for collision detection and AoE
- **Mob AI:** Event-driven (no behavior trees) -- roam, aggro on proximity, leash to spawn
- **Boss plugins:** SkeletonKing (spawns minions), ForestDragon (AoE attacks), etc.
- **With `SKIP_DATABASE=true`:** Any login accepted, fresh player each session, no MongoDB needed

### Network Protocol

- Raw WebSocket, JSON array format: `[packetId, data]`
- 39 packet types (Connected, Handshake, Login, Welcome, Map, Combat, Movement, etc.)
- Connection flow: `Connect -> Handshake (version check) -> Login (guest) -> Welcome (player data) -> Map (compressed regions) -> Ready -> Game loop`

---

## Phase 1: Fork & Run Kaetram Standalone (Days 1-3)

### Goal

Get the full Kaetram game running locally on your machine. Play it. Understand the combat, movement, inventory, and map systems firsthand.

### Steps

1. **Clone the repository** (master branch for MPL-2.0 license)
   ```bash
   git clone https://github.com/Kaetram/Kaetram-Open.git C:\Users\footb\BagsWorld\dungeon
   ```

2. **Enable Corepack** (for Yarn 4)
   ```bash
   corepack enable
   ```

3. **Create `.env` file** at repo root (`C:\Users\footb\BagsWorld\dungeon\.env`)
   ```env
   ACCEPT_LICENSE=true
   SKIP_DATABASE=true
   HUB_ENABLED=false
   API_ENABLED=false
   DISCORD_ENABLED=false
   MAX_PLAYERS=50
   TUTORIAL_ENABLED=true
   HOST=localhost
   PORT=9001
   SSL=false
   DEBUGGING=true
   ```

4. **Install dependencies**
   ```bash
   cd C:\Users\footb\BagsWorld\dungeon
   yarn install
   ```

5. **Run in development mode**
   ```bash
   yarn dev
   ```
   This starts:
   - Client dev server on `http://localhost:9000`
   - Game server on `ws://localhost:9001`

6. **Test the game**
   - Open `http://localhost:9000` in browser
   - Accept license agreement
   - Log in as Guest (any name)
   - Walk around (click to move, or WASD)
   - Fight mobs (click on them)
   - Pick up items (click loot on ground)
   - Open inventory (press B or click backpack)
   - Equip weapons/armor
   - Explore the full map

### Potential Issues

| Issue | Solution |
|---|---|
| `uws` native compilation fails on Windows | Server has fallback to pure-JS `websocket` package. If uws fails, check if fallback activates automatically. Otherwise, install Visual Studio Build Tools for native compilation. |
| Yarn 4 not found | Run `corepack enable` first. If version mismatch, run `corepack prepare yarn@4.0.0-rc.40 --activate` |
| Node version mismatch (`engines: ^18 \|\| ^20`) | Should work on Node 24 despite the engines field. If not, use `nvm` to switch to Node 20. |
| Port conflict (9000 or 9001 in use) | BagsWorld uses 3000 for dev, so no conflict expected. If needed, change PORT in .env. |

### Success Criteria

- [ ] Kaetram client loads at localhost:9000
- [ ] Can log in as Guest
- [ ] Can walk around the map
- [ ] Can attack and kill a mob
- [ ] Can pick up dropped items
- [ ] Can open inventory and equip items
- [ ] Combat works (damage numbers, health bars)
- [ ] Can die and respawn

---

## Phase 2: Create Custom BagsWorld Dungeon Map (Days 4-8)

### Goal

Replace Kaetram's massive 1152x1008 tile world with a small, focused dungeon map themed for BagsWorld.

### Map Specs

| Property | Value |
|---|---|
| Dimensions | 192 x 192 tiles (divisible by 48 for Kaetram's region system) |
| Tile size | 16px (Kaetram standard) |
| Pixel dimensions | 3072 x 3072 px |
| Regions | 16 (4x4 grid, vs Kaetram's 504) |
| Theme | Dark underground / crystal cave / BagsWorld aesthetic |
| Estimated server world.json | ~50-200 KB (vs 4.3 MB) |
| Estimated client map.json | ~5 KB (vs 21 KB) |

### Map Layout

```
+----------------------------------------------+
|              ENTRANCE (spawn)                 |
|    Safe zone, tutorial NPC, torch lighting    |
+----------+-----------+-----------------------+
| CORRIDOR | ROOM 1    | ROOM 2                |
| (mobs    | (mobs +   | (tougher mobs +       |
|  L1-3)   |  chest)   |  mini-boss)           |
+----------+-----------+-----------+-----------+
|          GREAT HALL               | VAULT     |
|    (L5-10 mobs, resources,       | (loot     |
|     multiple paths)               |  room)    |
+-----------------------------------+-----------+
|              BOSS CHAMBER                     |
|     (Final boss arena, pillars for cover)     |
+----------------------------------------------+
```

### Tools Required

1. **Tiled Map Editor** (free, https://www.mapeditor.org/) -- industry-standard tilemap editor
2. **Kaetram's tilesets** (already in `packages/client/public/img/tilesets/`) -- 6 PNG tilesheets with dungeon/cave tiles
3. **Kaetram's map parser** (`packages/tools/`) -- converts Tiled JSON to server/client format

### Map Creation Workflow

1. Install Tiled Map Editor
2. Open it, create a new map (192x192 tiles, 16px tile size, orthogonal)
3. Import Kaetram's tilesets (`tilesheet-1.png` through `tilesheet-6.png`)
4. Create layers:
   - **Ground** (tilelayer): Floor tiles -- stone, dirt, cave floor
   - **Walls** (tilelayer): Collision tiles -- cave walls, pillars, barriers
   - **Foreground** (tilelayer): High tiles -- ceiling edges, overhangs (drawn above entities for depth)
   - **Entities** (tilelayer): Mob spawn points -- place tiles that reference `mobs.json` keys
   - **Doors** (objectgroup): Teleporters between dungeon sections
   - **Areas** (objectgroup): PvP zones, music zones, light zones, chest spawns
5. Export as Tiled JSON
6. Run Kaetram's parser: `yarn map path/to/dungeon.json`
7. Output: `world.json` (server) + `map.json` (client)
8. Replace default map files and restart server

### Mob Selection (Trimmed from 148 to ~15)

| Mob | Level | Role | Boss Plugin? |
|---|---|---|---|
| Rat | 1 | Tutorial mob | No |
| Bat | 2 | Early enemy | No |
| Skeleton | 4 | Corridor patrol | No |
| Spider | 6 | Room 1 swarm | No |
| Zombie | 8 | Room 2 | No |
| Goblin | 10 | Great Hall | No |
| Ogre | 12 | Great Hall elite | No |
| Dark Skeleton | 15 | Great Hall | No |
| Skeleton King | 20 | **Mini-boss** | Yes -- spawns up to 6 skeleton minions on hit (25% chance) |
| Hellhound | 25 | Boss Chamber guard | No |
| Forest Dragon | 30 | **Final Boss** | Yes -- AoE `attackAll()` fires projectiles at all attackers |

All of these exist in Kaetram's `mobs.json` with sprites, stats, and drop tables already defined.

### Success Criteria

- [ ] Custom dungeon map opens in Tiled
- [ ] Map processes through Kaetram's parser without errors
- [ ] Server loads the custom `world.json`
- [ ] Client renders the custom dungeon
- [ ] Mobs spawn at placed locations
- [ ] Player can navigate the full dungeon
- [ ] Boss fights work (SkeletonKing summons minions, ForestDragon does AoE)

---

## Phase 3: Modify Kaetram Client for Embedding (Days 9-11)

### Goal

Make the Kaetram client embeddable: auto-login (skip login screen), configurable server URL, postMessage bridge for BagsWorld communication.

### 3a. Auto-Login (Bypass Login Screen)

**File:** `packages/client/src/app.ts`

Modify the `ready()` method to detect iframe embedding and auto-login:

```typescript
public ready(): void {
    // ... existing code that enables the Play button ...

    // Auto-login when embedded in BagsWorld iframe
    if (window.parent !== window) {
        // Listen for player data from parent
        window.addEventListener('message', (event: MessageEvent) => {
            if (event.data?.type === 'PLAYER_INIT') {
                this.loginInput.value = event.data.payload?.playerName || 'Explorer';
            }
        });

        // Set as guest and trigger login after brief delay
        this.guest.checked = true;
        setTimeout(() => this.login(), 500);
    }
}
```

### 3b. Hide Login UI in Embedded Mode

**File:** `packages/client/src/app.ts` or `packages/client/src/main.ts`

Add embedded detection on load:

```typescript
// In main.ts, before creating the game
if (window.parent !== window) {
    document.body.classList.add('embedded');
}
```

**File:** `packages/client/scss/` -- Add CSS override:

```css
body.embedded #intro,
body.embedded #parchment,
body.embedded #credits-page {
    display: none !important;
}
body.embedded {
    background: #000;
}
```

### 3c. Configure Server URL

**File:** `.env` (build-time configuration)

For local dev:
```env
CLIENT_REMOTE_HOST=localhost
CLIENT_REMOTE_PORT=9001
SSL=false
```

For production:
```env
CLIENT_REMOTE_HOST=dungeon-server.up.railway.app
CLIENT_REMOTE_PORT=443
SSL=true
```

These get baked into the client bundle at build time via Astro's `define: { globalConfig: env }`.

### 3d. PostMessage Bridge

**New file:** `packages/client/src/bridge.ts`

```typescript
import type Game from './game';

/**
 * Bridges communication between the Kaetram dungeon client
 * and the BagsWorld parent window via postMessage.
 */
export default class Bridge {
    private active = false;

    public constructor(private game: Game) {
        // Only activate when running inside an iframe
        if (window.parent === window) return;

        this.active = true;
        window.addEventListener('message', this.handleMessage.bind(this));
        this.notifyParent('DUNGEON_READY', {});
    }

    private handleMessage(event: MessageEvent): void {
        if (!this.active) return;

        switch (event.data?.type) {
            case 'PLAYER_INIT':
                // Parent sent player identity
                break;
            case 'PAUSE':
                // Parent wants to pause the game
                break;
            case 'RESUME':
                // Parent wants to resume the game
                break;
        }
    }

    public notifyParent(type: string, payload: Record<string, unknown>): void {
        if (!this.active) return;
        window.parent.postMessage({ type, payload }, '*');
    }

    // Called from Connection handlers
    public onMobKill(mobName: string, level: number): void {
        this.notifyParent('MOB_KILL', { mob: mobName, level });
    }

    public onBossKill(bossName: string): void {
        this.notifyParent('BOSS_KILL', { boss: bossName });
    }

    public onPlayerDeath(): void {
        this.notifyParent('PLAYER_DEATH', {});
    }

    public onItemPickup(itemName: string, count: number): void {
        this.notifyParent('ITEM_PICKUP', { item: itemName, count });
    }

    public onLevelUp(level: number): void {
        this.notifyParent('LEVEL_UP', { level });
    }

    public onDungeonExit(): void {
        this.notifyParent('DUNGEON_EXIT', {});
    }
}
```

Wire into `Game` constructor: `this.bridge = new Bridge(this);`
Wire into `Connection` packet handlers to call `bridge.onMobKill()`, `bridge.onBossKill()`, etc.

### Success Criteria

- [ ] Client auto-logs in when loaded in an iframe (no login screen)
- [ ] Login screen still works when loaded standalone (for development)
- [ ] Player name from BagsWorld is used as character name
- [ ] Bridge sends `DUNGEON_READY` to parent on load
- [ ] Bridge sends `MOB_KILL`, `BOSS_KILL`, `PLAYER_DEATH` events to parent
- [ ] Server URL is configurable via .env at build time

---

## Phase 4: Build & Serve Client from BagsWorld (Day 12)

### Goal

Build the modified Kaetram client as static files and serve from BagsWorld's `/public/games/dungeon/` directory.

### Build Process

```bash
# In the Kaetram fork directory
cd C:\Users\footb\BagsWorld\dungeon

# Set production .env for client build
# CLIENT_REMOTE_HOST and SSL must point to the production server

# Build the client
cd packages/client
yarn build
# Output: packages/client/dist/
```

### Copy to BagsWorld

```bash
# Create target directory
mkdir -p C:\Users\footb\BagsWorld\public\games\dungeon

# Copy built client
cp -r C:\Users\footb\BagsWorld\dungeon\packages\client\dist\* C:\Users\footb\BagsWorld\public\games\dungeon\
```

### Automation Script

Add to BagsWorld's `package.json`:

```json
{
  "scripts": {
    "build:dungeon-client": "cd dungeon/packages/client && yarn build",
    "copy:dungeon-client": "cp -r dungeon/packages/client/dist/* public/games/dungeon/",
    "dungeon:build": "npm run build:dungeon-client && npm run copy:dungeon-client"
  }
}
```

### Asset Size Optimization

| Asset Category | Size | Action |
|---|---|---|
| Audio (music + SFX) | ~16 MB | Strip for v1 -- BagsWorld has its own music. Add back later. |
| Sprites | ~4.5 MB | Keep -- required for mobs, player, items |
| Tilesets | ~1.2 MB | Keep -- required for map rendering |
| Interface graphics | ~0.5 MB | Keep -- required for UI |
| Bundled JS/CSS | ~0.5 MB | Keep -- the game code |
| **Total without audio** | **~6.7 MB** | Acceptable for a game-within-a-game |
| **Total with audio** | **~23 MB** | Consider lazy-loading audio |

### .gitignore Update

Add to BagsWorld's `.gitignore`:

```
# Dungeon client build output (built from dungeon/ source)
public/games/dungeon/
```

The built files should not be committed -- they're generated from the `dungeon/` fork source.

### Verification

Open `http://localhost:3000/games/dungeon/index.html` directly in the browser. It should load the Kaetram client (will fail to connect to server if server isn't running, but the UI should render).

### Success Criteria

- [ ] `yarn build` succeeds in the client package
- [ ] Static files appear in `public/games/dungeon/`
- [ ] Navigating to `/games/dungeon/index.html` in BagsWorld loads the Kaetram client
- [ ] Total asset size is under 10MB (without audio)

---

## Phase 5: BagsWorld Integration -- Dungeon Building + Modal (Days 13-15)

### Goal

Add a clickable Dungeon building in BagsCity zone. Clicking it opens a fullscreen modal with the Kaetram iframe. Phaser pauses/resumes correctly.

### 5a. Dungeon Building Texture (BootScene.ts)

Add a new method `generateDungeonEntrance()` to create a pixel art dungeon entrance:

- Dark stone archway (80x120px)
- Glowing purple portal inside the arch
- Skull decorations on the pillars
- Torches on either side with warm glow
- "DUNGEON" text label above

### 5b. Place Dungeon in BagsCity (WorldScene.ts)

Add the Dungeon entrance sprite to the trending zone (BagsCity), positioned alongside the Casino, Terminal, and Oracle Tower.

- Sprite placement with `setOrigin(0.5, 1)` and `setDepth(5)`
- Pulsing purple glow ellipse underneath (tween, yoyo)
- Interactive: `setInteractive({ useHandCursor: true })`
- Click handler: `document.dispatchEvent(new CustomEvent('bagsworld-dungeon-click'))`
- Hover: scale 1.02x with 100ms ease
- Cache in `trendingElements[]` for zone show/hide

### 5c. DungeonModal Component

**New file:** `src/components/DungeonModal.tsx`

A fullscreen modal containing the Kaetram iframe.

**Behavior:**
1. **On open:**
   - Set z-index above everything (9999)
   - Pause Phaser's WorldScene (`scene.pause()`)
   - Mute BagsWorld audio (`sound.pauseAll()`)
   - Drop Phaser FPS to 1 (save CPU)
   - Load iframe: `<iframe src="/games/dungeon/index.html" />`
   - Send `PLAYER_INIT` with player name + wallet when iframe signals `DUNGEON_READY`

2. **While open:**
   - Listen for `postMessage` events from iframe
   - `MOB_KILL` -> Award BagsWorld XP, update activity feed
   - `BOSS_KILL` -> Trigger celebration effect, award achievement
   - `PLAYER_DEATH` -> Show in activity feed
   - `LEVEL_UP` -> Show notification toast

3. **On close:**
   - Resume Phaser WorldScene (`scene.resume()`)
   - Restore BagsWorld audio (`sound.resumeAll()`)
   - Restore FPS to 60 (desktop) or 30 (mobile)
   - Show dungeon session summary (mobs killed, bosses defeated, items found)

4. **Mobile handling:**
   - On mobile, **destroy** Phaser entirely before opening iframe (iOS WebGL context limits)
   - Recreate Phaser when dungeon closes (~1-2 second reload, acceptable)

### 5d. Wire Into Page

**File:** `src/app/page.tsx`

- Add state: `const [dungeonOpen, setDungeonOpen] = useState(false);`
- Add listener for `bagsworld-dungeon-click` CustomEvent
- Render `<DungeonModal isOpen={dungeonOpen} onClose={() => setDungeonOpen(false)} />`

### Success Criteria

- [ ] Dungeon building appears in BagsCity with glowing portal effect
- [ ] Clicking the building opens a fullscreen modal
- [ ] Phaser pauses (no CPU usage) while dungeon is open
- [ ] BagsWorld audio stops while dungeon is open
- [ ] Kaetram loads and is playable inside the modal
- [ ] Closing the modal resumes BagsWorld exactly where player left off
- [ ] Events from the dungeon appear in BagsWorld's activity feed
- [ ] Works on mobile (Phaser destroyed and recreated)

---

## Phase 6: Deploy Kaetram Server (Day 16)

### Goal

Deploy the Kaetram game server to Railway so the dungeon works in production.

### Railway Setup

1. Create a new Railway project
2. Connect to the Kaetram fork repo (or push server package separately)
3. Configure environment variables:
   ```env
   ACCEPT_LICENSE=true
   SKIP_DATABASE=true
   HOST=0.0.0.0
   PORT=9001
   HUB_ENABLED=false
   API_ENABLED=false
   DISCORD_ENABLED=false
   MAX_PLAYERS=50
   TUTORIAL_ENABLED=false
   DEBUGGING=false
   ```
4. Deploy `packages/server/` with Node.js 20 buildpack
5. Railway assigns a public URL (e.g., `dungeon-server.up.railway.app`)

### Server Configuration for Production

- **WebSocket URL:** `wss://dungeon-server.up.railway.app`
- **Update the client .env** before building: `CLIENT_REMOTE_HOST=dungeon-server.up.railway.app`, `SSL=true`
- **Rebuild and redeploy** the client to BagsWorld's `public/games/dungeon/`

### Resource Estimates

| Metric | Value |
|---|---|
| RAM | ~20-50 MB (small map, few mobs) |
| CPU | Minimal (300ms tick loop, simple AI) |
| Connections | 10-50 concurrent WebSocket |
| Cost | ~$5/month on Railway Hobby plan |
| Uptime | Railway has auto-restart on crash |

### uWebSockets.js on Railway

Railway uses Linux, where `uws` compiles cleanly. No Windows native compilation issues.

### Success Criteria

- [ ] Server deploys and stays running on Railway
- [ ] WebSocket connection works from browser (`wss://`)
- [ ] Client (served from Netlify) connects to server (on Railway)
- [ ] Gameplay works end-to-end in production
- [ ] Server handles multiple simultaneous players

---

## Phase 7: Event Bridge -- BagsWorld Integration (Days 17-19)

### Goal

Wire dungeon events into BagsWorld's existing systems: XP, activity feed, achievements, and celebration effects.

### Events From Dungeon to BagsWorld

| Dungeon Event | BagsWorld Response |
|---|---|
| `MOB_KILL` (mob, level) | +10-50 XP (based on mob level), activity feed entry |
| `BOSS_KILL` (boss) | +500 XP, achievement unlock, coin rain celebration, activity feed |
| `PLAYER_DEATH` | Activity feed: "[Player] fell in the Dungeon" |
| `LEVEL_UP` (level) | Notification toast: "Dungeon Level [N]!" |
| `ITEM_PICKUP` (item, count) | Future: inventory tracking |
| `DUNGEON_EXIT` | Session summary modal, resume WorldScene |
| `DUNGEON_READY` | Send `PLAYER_INIT` with player identity |

### Events From BagsWorld to Dungeon

| BagsWorld Event | Dungeon Response |
|---|---|
| `PLAYER_INIT` (name, wallet) | Set player name, skip login |
| `PAUSE` | Freeze game loop |
| `RESUME` | Resume game loop |

### Integration Points in BagsWorld

1. **Activity Feed** (`UnifiedActivityFeed.tsx`): Add dungeon event types
2. **Celebration Effects** (`WorldScene.ts`): Trigger coin rain / star burst on boss kills
3. **Autonomous Dialogue** (`autonomous-dialogue.ts`): Characters react to dungeon events ("I heard you defeated the Skeleton King!")
4. **Future: XP System**: Dungeon events feed into player XP/leveling (see overall Game Design Plan)
5. **Future: Achievement System**: "First Blood" (kill first mob), "Dragon Slayer" (kill final boss), "Dungeon Crawler" (complete full dungeon)

### Session Summary

When the player exits the dungeon, show a summary modal:

```
+----------------------------------+
|       DUNGEON SUMMARY            |
|                                  |
|  Mobs Killed: 47                 |
|  Bosses Defeated: 2              |
|  Items Found: 12                 |
|  Deaths: 3                       |
|  Time: 18:42                     |
|                                  |
|  [RETURN TO BAGSWORLD]           |
+----------------------------------+
```

### Success Criteria

- [ ] Killing mobs in the dungeon shows events in BagsWorld's activity feed
- [ ] Defeating a boss triggers celebration effects in BagsWorld
- [ ] NPCs in BagsWorld reference dungeon events in autonomous dialogue
- [ ] Dungeon session summary shows on exit
- [ ] Events are properly typed and handled (no unhandled message types)

---

## Timeline Summary

| Phase | Work | Duration | Running Total |
|---|---|---|---|
| **Phase 1** | Fork & run Kaetram standalone | 2-3 days | Day 3 |
| **Phase 2** | Create custom dungeon map in Tiled | 3-5 days | Day 8 |
| **Phase 3** | Modify client (auto-login, bridge, embed config) | 2-3 days | Day 11 |
| **Phase 4** | Build client, serve from BagsWorld `/public/` | 1 day | Day 12 |
| **Phase 5** | BagsWorld integration (building, modal, pause/resume) | 2-3 days | Day 15 |
| **Phase 6** | Deploy server on Railway | 1 day | Day 16 |
| **Phase 7** | Event bridge (XP, feed, celebrations) | 2-3 days | Day 19 |
| **Total** | | **~3 weeks** | |

---

## License Compliance (MPL-2.0)

### Required

- Include Kaetram's `LICENSE` file in the fork
- Modified Kaetram source files must remain under MPL-2.0
- Visible credit to Kaetram (e.g., "Powered by Kaetram" in dungeon UI footer)
- Attribution to original artists (BrowserQuest assets are CC-BY-SA 3.0)

### Not Required

- Open-sourcing BagsWorld's own code
- Sharing custom map/mob data created for BagsWorld
- Asking permission (MPL-2.0 grants rights automatically)

### Credits

The dungeon UI should include:
- "Powered by [Kaetram](https://kaetram.com)" -- visible in game
- "Original game engine by Veradictus / OmniaDev" -- in credits/about
- "Based on BrowserQuest by Mozilla / Little Workshop" -- in credits/about
- Art assets: CC-BY-SA 3.0 attribution

---

## Risks & Mitigations

| Risk | Severity | Probability | Mitigation |
|---|---|---|---|
| `uws` native build fails on dev machine (Windows) | Medium | Medium | Use WSL2, or the `websocket` package fallback. Railway (Linux) won't have this issue. |
| Node version incompatibility (v24 vs engines ^18/^20) | Low | Low | Usually works fine. Use nvm to switch to 20 if issues arise. |
| Kaetram asset size too large | Medium | Low | Strip audio (~16MB) for v1. Sprites + tilesets (~6MB) are reasonable. |
| iOS Safari kills WebGL context (2 canvases) | High | High on iOS | Destroy Phaser on mobile before opening iframe. Recreate on close. |
| Tiled map creation is time-consuming | Medium | Medium | Start with a simple rectangular dungeon. Iterate on layout after core integration works. |
| Server costs increase with traffic | Low | Low | Railway scales. $5/mo baseline. Kaetram's Hub system supports multi-server if needed. |
| Kaetram updates break our fork | Low | Low | Pin to a specific commit. Merge upstream selectively. |
| jQuery in Kaetram conflicts with React | N/A | N/A | Iframe isolates DOM completely. Not an issue. |

---

## Future Enhancements (Post-v1)

- **Token-gated dungeons**: Require holding BagsWorld tokens to enter certain dungeon tiers
- **On-chain rewards**: Boss kills distribute SOL from community fund
- **Custom BagsWorld sprites**: Replace Kaetram's default sprites with BagsWorld character art
- **Multiplayer dungeons**: Party up with other BagsWorld players
- **Dungeon leaderboards**: Fastest boss kill, most mobs killed, fewest deaths
- **Procedural dungeons**: Generate new dungeon layouts periodically
- **BagsWorld NPC bosses**: Fight CJ, Ghost, or Shaw as dungeon bosses
- **Persistent progression**: Save dungeon character between sessions (requires MongoDB)
- **Custom items**: BagsWorld-themed weapons and armor
- **Seasonal events**: Halloween dungeon, holiday themes (Kaetram already has event support)
