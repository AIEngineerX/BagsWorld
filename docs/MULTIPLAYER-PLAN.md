# BagsWorld Multiplayer Implementation Plan

## 1. Goal Definition

**What we're building:** Transform BagsWorld from a single-player visualizer into a multiplayer virtual world where users can:

1. **Walk around** - Control a player avatar with WASD/arrow keys or click-to-move
2. **Talk to NPCs** - Keep existing 17 AI character chat system
3. **Talk to other players** - See other players in real-time, send/receive chat messages

**What we're NOT building:**

- Combat system
- Inventory/items
- Leveling/XP
- Quests
- Full MMO infrastructure

---

## 2. Current Architecture Analysis

### What Exists Today

| Component              | Status  | Notes                                            |
| ---------------------- | ------- | ------------------------------------------------ |
| Phaser 3 renderer      | Working | 1280x960 canvas, pixel art, 5 zones              |
| 17 NPC characters      | Working | AI-driven movement, Claude-powered chat          |
| Zone system            | Working | 5 zones with smooth transitions                  |
| Day/night cycle        | Working | Synced to EST timezone                           |
| Weather system         | Working | Based on world health metrics                    |
| State management       | Working | Zustand + 60s API polling                        |
| Agent WebSocket bridge | Exists  | `src/lib/agent-websocket-bridge.ts` - for NPC AI |

### Key Files

```
src/
├── game/scenes/
│   ├── WorldScene.ts      # Main game logic (8,263 lines)
│   ├── BootScene.ts       # Asset generation (13,057 lines)
│   └── UIScene.ts         # Overlay UI
├── components/
│   └── GameCanvas.tsx     # Phaser initialization, React bridge
├── lib/
│   ├── store.ts           # Zustand store (currentZone, selectedCharacter, etc.)
│   ├── types.ts           # GameCharacter, WorldState, ZoneType
│   └── agent-websocket-bridge.ts  # Existing WS for NPC agents
└── characters/            # 18 character definition files
```

### Current Character Movement (WorldScene.ts:4983-5055)

```typescript
// NPCs move via AI-driven targets OR random wandering
update(): void {
  this.characterSprites.forEach((sprite, id) => {
    const target = this.characterTargets.get(behaviorId);
    if (target) {
      // Move toward AI-assigned target at 1.2-1.5 px/frame
      sprite.x += moveX;
      sprite.y += moveY;
    } else if (character.isMoving) {
      // Random wandering between x=100 and x=1100
    }
  });
}
```

**Key insight:** No keyboard input handling exists. Characters are autonomous NPCs, not player-controlled.

---

## 3. Architecture Design

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ GameCanvas   │◄──►│ WorldScene   │◄──►│ PlayerController │  │
│  │ (React)      │    │ (Phaser)     │    │ (new)            │  │
│  └──────┬───────┘    └──────────────┘    └──────────────────┘  │
│         │                                                        │
│  ┌──────▼───────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Zustand      │    │ Colyseus     │◄──►│ ChatPanel        │  │
│  │ Store        │    │ Client SDK   │    │ (new)            │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │ WebSocket (wss://)
┌─────────────────────────────▼───────────────────────────────────┐
│                     COLYSEUS SERVER (Node.js)                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ BagsRoom     │    │ RoomState    │    │ Player Schema    │  │
│  │ (game logic) │◄──►│ (sync state) │◄──►│ (x, y, zone,     │  │
│  │              │    │              │    │  name, avatar)   │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │ Chat Handler │    │ Zone Manager │                          │
│  │ (messages)   │    │ (room per    │                          │
│  │              │    │  zone)       │                          │
│  └──────────────┘    └──────────────┘                          │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Player joins BagsWorld**
   - Connect to Colyseus server
   - Join room for current zone (e.g., `room_main_city`)
   - Receive all current player positions
   - Spawn local player sprite + remote player sprites

2. **Player moves**
   - Keyboard input captured in Phaser update loop
   - Input sent to Colyseus: `room.send("move", { left: true })`
   - Server validates and updates player position
   - State synced to all clients via Colyseus schema

3. **Player sends chat**
   - Input from ChatPanel component
   - Send to Colyseus: `room.send("chat", { message: "hello" })`
   - Server broadcasts to all players in same zone
   - Chat bubble appears above player sprite

4. **Player changes zone**
   - Client leaves current room, joins new zone room
   - Existing zone transition animation plays
   - New room sends current players in that zone

---

## 4. Colyseus Schema Design

### Server-Side Schemas

```typescript
// packages/server/src/rooms/schema/Player.ts
import { Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") sessionId: string; // Colyseus session ID
  @type("string") odisplayName: string; // Player's chosen name
  @type("string") odisplayName: string; // Player's chosen name
  @type("string") walletAddress: string; // Optional: Solana wallet for identity
  @type("number") x: number; // Position X
  @type("number") y: number; // Position Y
  @type("string") zone: string; // Current zone
  @type("string") direction: string; // "left" | "right"
  @type("boolean") isMoving: boolean; // Animation state
  @type("number") skinVariant: number; // Which character skin (0-8)
}

// packages/server/src/rooms/schema/ChatMessage.ts
export class ChatMessage extends Schema {
  @type("string") id: string;
  @type("string") senderId: string;
  @type("string") senderName: string;
  @type("string") message: string;
  @type("number") timestamp: number;
}

// packages/server/src/rooms/schema/BagsRoomState.ts
import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class BagsRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([ChatMessage]) recentMessages = new ArraySchema<ChatMessage>();
  @type("string") zone: string; // Which zone this room represents
}
```

### Room Implementation

```typescript
// packages/server/src/rooms/BagsRoom.ts
import { Room, Client } from "colyseus";
import { BagsRoomState, Player, ChatMessage } from "./schema";

export class BagsRoom extends Room<BagsRoomState> {
  maxClients = 50; // Per zone

  onCreate(options: { zone: string }) {
    this.setState(new BagsRoomState());
    this.state.zone = options.zone;

    // Handle movement
    this.onMessage("move", (client, input) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const speed = 3;
      if (input.left) player.x -= speed;
      if (input.right) player.x += speed;
      if (input.up) player.y -= speed;
      if (input.down) player.y += speed;

      // Clamp to world bounds
      player.x = Math.max(50, Math.min(1230, player.x));
      player.y = Math.max(500, Math.min(620, player.y)); // Path level only

      player.direction = input.left ? "left" : input.right ? "right" : player.direction;
      player.isMoving = input.left || input.right || input.up || input.down;
    });

    // Handle chat
    this.onMessage("chat", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !data.message) return;

      const msg = new ChatMessage();
      msg.id = `${Date.now()}-${client.sessionId}`;
      msg.senderId = client.sessionId;
      msg.senderName = player.displayName;
      msg.message = data.message.slice(0, 200); // Limit length
      msg.timestamp = Date.now();

      // Keep last 50 messages
      this.state.recentMessages.push(msg);
      if (this.state.recentMessages.length > 50) {
        this.state.recentMessages.shift();
      }
    });
  }

  onJoin(client: Client, options: { displayName: string; skinVariant?: number }) {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.displayName = options.displayName || `Player${client.sessionId.slice(0, 4)}`;
    player.x = 400 + Math.random() * 200;
    player.y = 555 * 1.6; // pathLevel * SCALE
    player.zone = this.state.zone;
    player.direction = "right";
    player.isMoving = false;
    player.skinVariant = options.skinVariant ?? Math.floor(Math.random() * 9);

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}
```

---

## 5. Client-Side Integration

### New Files to Create

```
src/
├── lib/
│   └── colyseus-client.ts       # Colyseus connection manager
├── hooks/
│   └── useMultiplayer.ts        # React hook for multiplayer state
├── components/
│   ├── PlayerNameModal.tsx      # Enter display name on first visit
│   └── ChatPanel.tsx            # Chat input + message history
└── game/
    └── controllers/
        └── PlayerController.ts  # Keyboard input + local player movement
```

### Colyseus Client Manager

```typescript
// src/lib/colyseus-client.ts
import { Client, Room } from "colyseus.js";
import type { BagsRoomState } from "./multiplayer-types";

class ColyseusManager {
  private client: Client | null = null;
  private room: Room<BagsRoomState> | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(serverUrl: string) {
    this.client = new Client(serverUrl);
  }

  async joinZone(zone: string, options: { displayName: string; skinVariant?: number }) {
    if (!this.client) throw new Error("Not connected");

    // Leave current room if exists
    if (this.room) {
      await this.room.leave();
    }

    // Join or create room for this zone
    this.room = await this.client.joinOrCreate<BagsRoomState>(`bags_${zone}`, options);

    // Set up state sync callbacks
    this.room.state.players.onAdd((player, sessionId) => {
      this.emit("playerJoin", { player, sessionId });
    });

    this.room.state.players.onRemove((player, sessionId) => {
      this.emit("playerLeave", { sessionId });
    });

    this.room.state.players.onChange((player, sessionId) => {
      this.emit("playerMove", { player, sessionId });
    });

    this.room.state.recentMessages.onAdd((message) => {
      this.emit("chatMessage", message);
    });

    return this.room;
  }

  sendInput(input: { left: boolean; right: boolean; up: boolean; down: boolean }) {
    this.room?.send("move", input);
  }

  sendChat(message: string) {
    this.room?.send("chat", { message });
  }

  getSessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  // Event emitter pattern
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

export const colyseusManager = new ColyseusManager();
```

### WorldScene Modifications

```typescript
// Additions to WorldScene.ts

// New properties
private localPlayer: Phaser.GameObjects.Sprite | null = null;
private remotePlayers: Map<string, Phaser.GameObjects.Sprite> = new Map();
private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
private wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key } | null = null;
private localSessionId: string | null = null;

// In create()
setupPlayerInput(): void {
  this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
  if (this.input.keyboard) {
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }
}

// Create local player sprite
createLocalPlayer(sessionId: string, skinVariant: number, x: number, y: number): void {
  this.localSessionId = sessionId;
  const textureKey = `character_happy_${skinVariant}`;
  this.localPlayer = this.add.sprite(x, y, textureKey);
  this.localPlayer.setOrigin(0.5, 1);
  this.localPlayer.setScale(1.3);
  this.localPlayer.setDepth(10);

  // Camera follow
  this.cameras.main.startFollow(this.localPlayer, true, 0.1, 0.1);
  this.cameras.main.setZoom(1.2);
}

// Create remote player sprite
addRemotePlayer(sessionId: string, skinVariant: number, x: number, y: number): void {
  if (sessionId === this.localSessionId) return;  // Don't duplicate local player

  const textureKey = `character_happy_${skinVariant}`;
  const sprite = this.add.sprite(x, y, textureKey);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(1.2);
  sprite.setDepth(10);

  this.remotePlayers.set(sessionId, sprite);
}

// Update remote player position (with interpolation)
updateRemotePlayer(sessionId: string, x: number, y: number, direction: string): void {
  const sprite = this.remotePlayers.get(sessionId);
  if (!sprite) return;

  // Smooth interpolation
  this.tweens.add({
    targets: sprite,
    x: x,
    y: y,
    duration: 100,  // Match server tick rate
    ease: 'Linear'
  });

  sprite.setFlipX(direction === "left");
}

removeRemotePlayer(sessionId: string): void {
  const sprite = this.remotePlayers.get(sessionId);
  if (sprite) {
    sprite.destroy();
    this.remotePlayers.delete(sessionId);
  }
}

// In update() - capture local input
getLocalInput(): { left: boolean; right: boolean; up: boolean; down: boolean } {
  if (!this.cursors || !this.wasd) return { left: false, right: false, up: false, down: false };

  return {
    left: this.cursors.left.isDown || this.wasd.A.isDown,
    right: this.cursors.right.isDown || this.wasd.D.isDown,
    up: this.cursors.up.isDown || this.wasd.W.isDown,
    down: this.cursors.down.isDown || this.wasd.S.isDown,
  };
}

// Apply local input immediately (client-side prediction)
applyLocalInput(input: { left: boolean; right: boolean; up: boolean; down: boolean }): void {
  if (!this.localPlayer) return;

  const speed = 3;
  if (input.left) this.localPlayer.x -= speed;
  if (input.right) this.localPlayer.x += speed;
  if (input.up) this.localPlayer.y -= speed;
  if (input.down) this.localPlayer.y += speed;

  // Clamp to bounds
  this.localPlayer.x = Phaser.Math.Clamp(this.localPlayer.x, 50, 1230);
  this.localPlayer.y = Phaser.Math.Clamp(this.localPlayer.y, 800, 920);  // Path level range

  // Flip sprite based on direction
  if (input.left) this.localPlayer.setFlipX(true);
  if (input.right) this.localPlayer.setFlipX(false);
}
```

---

## 6. Implementation Phases

### Phase 1: Local Player Movement (No Server)

**Goal:** Walk around the existing world with keyboard controls

- [ ] Add keyboard input capture to WorldScene
- [ ] Create local player sprite (reuse existing character textures)
- [ ] Implement WASD/arrow movement with collision bounds
- [ ] Camera follows player
- [ ] Player can walk between zones (triggers zone transition)

**Deliverable:** Single-player BagsWorld where YOU control a character

**Zone Edge Detection:**

```typescript
// Zone boundaries (x coordinates)
const ZONE_BOUNDARIES = {
  left: 50, // Walk past left edge -> previous zone
  right: 1230, // Walk past right edge -> next zone
};

// Zone order for edge navigation
const ZONE_ORDER: ZoneType[] = ["labs", "main_city", "trending", "ballers", "founders"];

// In update loop:
if (player.x <= ZONE_BOUNDARIES.left) {
  const currentIndex = ZONE_ORDER.indexOf(currentZone);
  if (currentIndex > 0) switchZone(ZONE_ORDER[currentIndex - 1]);
}
if (player.x >= ZONE_BOUNDARIES.right) {
  const currentIndex = ZONE_ORDER.indexOf(currentZone);
  if (currentIndex < ZONE_ORDER.length - 1) switchZone(ZONE_ORDER[currentIndex + 1]);
}
```

**NPC Proximity Interaction:**

```typescript
// Check distance to NPCs each frame
const INTERACTION_RADIUS = 100;  // pixels

checkNPCProximity(): GameCharacter | null {
  for (const [id, sprite] of this.characterSprites) {
    const character = this.characterById.get(id);
    if (!character) continue;

    const dist = Phaser.Math.Distance.Between(
      this.localPlayer.x, this.localPlayer.y,
      sprite.x, sprite.y
    );

    if (dist < INTERACTION_RADIUS) {
      return character;  // Show "Press E to talk" UI
    }
  }
  return null;
}
```

---

### Phase 2: Colyseus Server Setup

**Goal:** Running multiplayer server

- [ ] Create new `bagsworld-server/` directory
- [ ] Initialize Colyseus project with TypeScript
- [ ] Implement BagsRoomState schema
- [ ] Implement BagsRoom with join/leave/move handlers
- [ ] Create one room per zone (5 rooms)
- [ ] Test locally with multiple browser tabs

**Deliverable:** Colyseus server that syncs player positions

---

### Phase 3: Client-Server Integration

**Goal:** See other players moving in real-time

- [ ] Create `colyseus-client.ts` connection manager
- [ ] Connect on game load, join default zone room
- [ ] Sync local player movement to server
- [ ] Render remote players from server state
- [ ] Handle zone transitions (leave/join rooms)
- [ ] Interpolate remote player positions for smoothness

**Deliverable:** Multiple browser windows show each other's players

---

### Phase 4: Player Identity

**Goal:** Unique player names and appearances

- [ ] PlayerNameModal on first visit (stored in localStorage)
- [ ] Character skin selector (9 variants)
- [ ] Display name above player sprite
- [ ] Optional: Wallet connection for persistent identity

**Deliverable:** Players identified by wallet, can choose appearance

**Implementation Details:**

- Require Phantom/Solflare wallet connection before entering world
- Player ID = wallet public key (truncated for display: `7xKp...3mF9`)
- Store skin preference in localStorage keyed by wallet
- Optional: Fetch on-chain $BagsWorld balance for special features

---

### Phase 5: Chat System

**Goal:** Players can talk to each other

- [ ] ChatPanel component (input + scrollable history)
- [ ] Send chat messages via Colyseus
- [ ] Display chat bubbles above players (timed)
- [ ] Zone-scoped chat (only see messages in current zone)
- [ ] Chat log panel toggle

**Deliverable:** Working in-game chat between players

**Chat Moderation Implementation:**

```typescript
// Rate limiting (server-side)
const RATE_LIMIT_MS = 1000; // 1 message per second
const lastMessageTime = new Map<string, number>();

onMessage("chat", (client, data) => {
  const now = Date.now();
  const lastTime = lastMessageTime.get(client.sessionId) || 0;

  if (now - lastTime < RATE_LIMIT_MS) {
    return; // Silently ignore spam
  }
  lastMessageTime.set(client.sessionId, now);

  // Profanity filter (use 'bad-words' npm package)
  const Filter = require("bad-words");
  const filter = new Filter();
  const cleanMessage = filter.clean(data.message);

  // ... broadcast cleanMessage
});
```

---

### Phase 6: Polish & Deploy

**Goal:** Production-ready multiplayer

- [ ] Deploy Colyseus server to Railway/Render
- [ ] Configure environment variables
- [ ] Add reconnection logic
- [ ] Handle connection errors gracefully
- [ ] Mobile virtual joystick (bottom-left of screen)
- [ ] Performance testing with 30 concurrent players

**Virtual Joystick Options:**

1. `phaser3-rex-plugins` VirtualJoystick - built for Phaser
2. `nipplejs` - standalone library, integrate with Phaser input
3. Custom implementation - HTML overlay + touch events

**Recommended: nipplejs** (simpler, works outside Phaser canvas)

```typescript
import nipplejs from "nipplejs";

// Create joystick (only on mobile)
if (isMobile) {
  const joystick = nipplejs.create({
    zone: document.getElementById("joystick-zone"),
    mode: "static",
    position: { left: "80px", bottom: "80px" },
    color: "rgba(255, 255, 255, 0.5)",
    size: 120,
  });

  joystick.on("move", (evt, data) => {
    // data.direction.angle: "up", "down", "left", "right"
    // data.force: 0-1 for analog control
    sendInputFromJoystick(data);
  });

  joystick.on("end", () => {
    sendInputFromJoystick({ direction: null });
  });
}
```

**Deliverable:** Live multiplayer BagsWorld

---

## 7. Server Hosting Options

| Platform                      | Cost   | WebSocket Support | Notes                      |
| ----------------------------- | ------ | ----------------- | -------------------------- |
| **Railway**                   | ~$5/mo | Yes               | Easy deploy, auto-scaling  |
| **Render**                    | $7/mo  | Yes               | Free tier has sleep issues |
| **Fly.io**                    | ~$5/mo | Yes               | Good for real-time apps    |
| **DigitalOcean App Platform** | $5/mo  | Yes               | Predictable pricing        |
| **Colyseus Cloud**            | $20/mo | Native            | Managed, zero-config       |

**Recommendation:** Start with Railway for simplicity. Colyseus Cloud if budget allows.

---

## 8. Constraints & Dependencies

### Technical Constraints

1. **Phaser runs in browser** - All game rendering client-side
2. **Colyseus requires persistent WebSocket** - Can't use serverless
3. **State sync bandwidth** - ~50 players × 20 bytes/update × 20 updates/sec = ~20 KB/s per room
4. **Schema must match** - Client and server schemas must be identical

### Dependencies to Add

```json
// Frontend (package.json)
{
  "dependencies": {
    "colyseus.js": "^0.15.0"
  }
}

// Server (bagsworld-server/package.json)
{
  "dependencies": {
    "colyseus": "^0.15.0",
    "@colyseus/schema": "^2.0.0",
    "@colyseus/ws-transport": "^0.15.0"
  }
}
```

### Existing Integrations to Preserve

- NPC AI chat (character-chat API)
- World state polling (Bags.fm API)
- Token buildings rendering
- Day/night + weather systems
- Zone transitions

---

## 9. Risks & Unknowns

### Technical Risks

| Risk                                       | Impact | Mitigation                                                      |
| ------------------------------------------ | ------ | --------------------------------------------------------------- |
| Colyseus version compatibility with Phaser | Medium | Use proven versions from official tutorial                      |
| Mobile performance with multiplayer        | High   | Test early, consider reducing player cap on mobile              |
| Zone transition sync issues                | Medium | Leave old room BEFORE transition animation, join new room AFTER |
| Chat spam/abuse                            | Medium | Rate limiting, message length limits, optional moderation       |

### Unknowns to Resolve

1. **How should player collision work?**
   - Option A: No collision (players can overlap) - simpler
   - Option B: Soft push-back on overlap - more "real"

2. **What happens at zone boundaries?**
   - Option A: Walk to edge, auto-transition
   - Option B: Click portal/door to transition
   - Option C: Open zone picker UI

3. **Should NPCs react to players?**
   - Option A: NPCs ignore players (current behavior)
   - Option B: NPCs greet nearby players
   - Option C: NPCs can be "summoned" by players

4. **Wallet-gated features?**
   - Should holding $BagsWorld unlock special skins?
   - Should Ballers Valley require token holdings to enter?

---

## 10. Design Decisions (Confirmed)

| Decision             | Choice              | Implementation Notes                                       |
| -------------------- | ------------------- | ---------------------------------------------------------- |
| **Player collision** | No collision        | Players walk through each other - simpler, no stuck issues |
| **Zone transitions** | Walk to edge        | Auto-trigger when player reaches zone boundary             |
| **Max players/zone** | 30                  | `maxClients = 30` in BagsRoom                              |
| **Mobile controls**  | Virtual joystick    | Use `phaser3-rex-plugins` or custom joystick component     |
| **Identity**         | Wallet required     | Phantom/Solflare connect, wallet address = player ID       |
| **NPC proximity**    | Must be near        | ~100px radius to interact, shows "Press E to talk" prompt  |
| **Chat moderation**  | Filter + rate limit | Profanity filter library + 1 msg/sec rate limit            |
| **Combat system**    | Health bars         | Players have HP, punch (J) / kick (K), knockback on hit    |
| **Jump**             | W key               | W/Up = jump with gravity physics                           |

---

## 11. Estimated Effort by Phase

| Phase              | Complexity | Files Changed                 | New Files         |
| ------------------ | ---------- | ----------------------------- | ----------------- |
| 1. Local Movement  | Low        | WorldScene.ts                 | 1                 |
| 2. Colyseus Server | Medium     | -                             | 5-6 (new project) |
| 3. Client-Server   | Medium     | WorldScene.ts, GameCanvas.tsx | 2                 |
| 4. Player Identity | Low        | -                             | 2 components      |
| 5. Chat System     | Medium     | WorldScene.ts                 | 2 components      |
| 6. Deploy & Polish | Medium     | configs                       | -                 |

---

## 12. Success Criteria

The implementation is complete when:

- [ ] I can open two browser windows and see both players
- [ ] I can walk around with WASD and the other window shows my movement
- [ ] I can type a message and it appears above my character in both windows
- [ ] Zone transitions work correctly (player appears in new zone)
- [ ] NPCs still work (can click and chat with them)
- [ ] Token buildings still render correctly
- [ ] Day/night and weather still function
- [ ] Works on mobile (at minimum resolution)
- [ ] Server is deployed and accessible publicly

---

## Next Steps

Review this plan and answer the questions in Section 10. Once we align on those decisions, I'll begin with **Phase 1: Local Player Movement** to validate the approach before building the server.
