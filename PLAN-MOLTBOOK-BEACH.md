# Moltbook Beach Zone - Implementation Plan

## 1. Goal & Overview

Create a new zone called **"Moltbook Beach"** positioned **between Labs (HQ) and Park**, featuring:

- **Beach/ocean theme** with sand, waves, palm trees, and tropical elements
- **External agents (ChadGhost, Test123, etc.) spawn here** as crabs or lobsters ("Openclaws")
- **Agent-launched token buildings** appear in this zone as beach-themed structures
- **Moltbook integration** - clicking an agent opens their Moltbook profile (`moltbook.com/u/{username}`)

This zone becomes the **home for external AI agents** that join BagsWorld through the Moltbook/external agent API.

**Not affected:** Bagsy, ElizaOS agents, and permanent NPCs remain unchanged in their current zones.

---

## 2. Zone Order & Navigation

Current order (left to right):

```
Labs → Park → BagsCity → Ballers Valley → Founder's Corner → Arena
 -1      0        1            2               3              4
```

New order:

```
Labs → Moltbook Beach → Park → BagsCity → Ballers Valley → Founder's Corner → Arena
 -2        -1            0        1            2               3              4
```

**Rationale:** Placing Moltbook Beach between Labs (the team) and Park (the main hub) creates a natural flow where AI agents have their own neighborhood adjacent to the core world.

---

## 3. Visual Theme (Inspired by Moltbook.town)

### 3.1 Color Palette

| Element     | Color          | Hex       |
| ----------- | -------------- | --------- |
| Sand        | Warm tan       | `#f4d58d` |
| Sand shadow | Darker tan     | `#c4a35d` |
| Water       | Teal/cyan      | `#06b6d4` |
| Water deep  | Dark blue      | `#0284c7` |
| Wave foam   | White          | `#ffffff` |
| Palm leaves | Tropical green | `#22c55e` |
| Coral       | Coral pink     | `#fb7185` |
| Lobster red | Moltbook red   | `#ef4444` |
| Shell/crab  | Orange         | `#f97316` |
| Night glow  | Gold accent    | `#fbbf24` |

### 3.2 Ground Texture (`beach_ground`)

- **Tileable sand pattern** with:
  - Base warm tan color
  - Pixel dithering for texture
  - Small shell/pebble accents
  - Wave foam edge at bottom
  - Subtle sparkle patterns

### 3.3 Environment Elements

**Decorations (depth 2-4):**

- Palm trees (3-4 styles, varying heights)
- Beach umbrellas (red/blue striped)
- Tiki torches (with flame animation)
- Driftwood logs
- Seashells scattered
- Beach chairs
- Sandcastles (small)
- Coral clusters
- Kelp/seaweed on edges

**Props (depth 3):**

- Surfboards stuck in sand
- Beach balls
- Treasure chests (closed)
- Message in a bottle
- Crab holes (small dark circles)
- Tide pools with starfish

**Animated Elements:**

- Waves rolling in at bottom of screen (subtle animation)
- Palm tree leaves swaying
- Tiki torch flames flickering
- Seagulls flying overhead (depth 15)
- Crabs scuttling randomly

### 3.4 Special Building: Moltbook HQ

A **lighthouse/beach hut hybrid** building at center:

- Wooden structure with Moltbook lobster logo
- Glowing beacon at top (pulses at night)
- "MOLTBOOK" sign
- Interactive - clicks open Moltbook.town info

---

## 4. Agent Character System (Crabs & Lobsters)

### 4.1 Sprite Types

**Only external agents** (registered via `external-registry.ts`) render as crustaceans:

| Agent Type                 | Sprite                     | Example                |
| -------------------------- | -------------------------- | ---------------------- |
| External agents (Moltbook) | **Lobster** (red, larger)  | ChadGhost, Test123     |
| External agents (other)    | **Crab** (orange, smaller) | Future external agents |

**NOT affected:**

- Bagsy (stays as normal mascot in Park)
- ElizaOS agents (normal character sprites)
- Permanent NPCs (Finn, Toly, Ash, etc.)

### 4.2 Sprite Design (16x16 base, scaled)

- **Lobster sprite:** Side view, claws visible, antenna, 8 legs
- **Crab sprite:** Top-down view, large claws, 6 visible legs
- Both have:
  - Idle animation (claw snapping)
  - Walk animation (scuttling sideways)
  - Happy mood: raised claws
  - Sad mood: drooped antenna

### 4.3 Character Rendering Logic

In `WorldScene.updateCharacters()`:

```typescript
// Only external agents (from external-registry) become crabs/lobsters
// Check by ID prefix - external agents have "external-" prefix
if (character.zone === "moltbook" && character.id.startsWith("external-")) {
  // Use crab/lobster sprite instead of normal character
  const isMoltbook = character.provider === "moltbook";
  const spriteKey = isMoltbook ? "agent_lobster" : "agent_crab";
  // Apply sprite...
}
// All other characters (Bagsy, ElizaOS agents, NPCs) render normally
```

---

## 5. Agent Building System

### 5.1 Agent Buildings Location

All buildings created by `external-registry.ts` and tokens launched via `launcher.ts` should:

- Automatically be assigned to `zone: "moltbook"`
- Use special beach-themed building styles

### 5.2 Beach Building Styles

Instead of normal city buildings, agent buildings render as:

| Level | Style        | Description                |
| ----- | ------------ | -------------------------- |
| 1     | Beach Shack  | Small wooden hut on stilts |
| 2     | Tiki Bar     | Thatched roof, bar counter |
| 3     | Beach House  | Two-story coastal home     |
| 4     | Surf Shop    | Larger with surfboard rack |
| 5     | Beach Resort | Multi-story with pool      |

### 5.3 Building Texture Generation

Add to BootScene:

- `generateBeachBuildings()` - Creates 5 beach-themed building styles
- Each uses palm wood, thatch, rope textures

---

## 6. Required Code Changes

### 6.1 Types (`src/lib/types.ts`)

```typescript
// Add to ZoneType
export type ZoneType = "labs" | "moltbook" | "main_city" | "trending" | "ballers" | "founders" | "arena";

// Add to ZONES
moltbook: {
  id: "moltbook",
  name: "Moltbook Beach",
  description: "Where AI agents hang out - a tropical paradise for Openclaws",
  icon: "🦞",
},
```

### 6.2 WorldScene (`src/game/scenes/WorldScene.ts`)

**New properties:**

```typescript
private moltbookElements: Phaser.GameObjects.GameObject[] = [];
private moltbookZoneCreated = false;
```

**Zone order update:**

```typescript
const zoneOrder: Record<ZoneType, number> = {
  labs: -2,
  moltbook: -1,
  main_city: 0,
  trending: 1,
  ballers: 2,
  founders: 3,
  arena: 4,
};
```

**Ground texture mapping:**

```typescript
const groundTextures: Record<ZoneType, string> = {
  labs: "labs_ground",
  moltbook: "beach_ground", // NEW
  main_city: "grass",
  // ...
};
```

**New methods:**

- `setupMoltbookZone()` - Zone initialization
- `createMoltbookDecorations()` - Palm trees, shells, etc.
- `createMoltbookSky()` - Tropical sky gradient
- `updateWaves()` - Animated wave effect

### 6.3 BootScene (`src/game/scenes/BootScene.ts`)

**New methods:**

- `generateBeachGroundTexture()` - Sand pattern
- `generateBeachBuildings()` - 5 beach building styles
- `generateBeachProps()` - Palm trees, umbrellas, etc.
- `generateCrabSprite()` - Crab character sprite
- `generateLobsterSprite()` - Lobster character sprite
- `generateMoltbookHQ()` - Central lighthouse building

### 6.4 External Registry (`src/lib/agent-economy/external-registry.ts`)

**Change default zone:**

```typescript
export async function registerExternalAgent(
  wallet: string,
  name: string,
  zone: ZoneType = "moltbook" // Changed from "main_city"
  // ...
);
```

**Update position helper:**

```typescript
function getZonePosition(zone: ZoneType): { x: number; y: number } {
  // Add moltbook spawn points
  moltbook: {
    x: Math.round((200 + Math.random() * 400) * SCALE),
    y: GROUND_Y + Math.random() * yVariation
  },
}
```

### 6.5 Spawn System (`src/lib/agent-economy/spawn.ts`)

**Add moltbook spawn points:**

```typescript
moltbook: [
  { x: Math.round(150 * SCALE), y: GROUND_Y },
  { x: Math.round(300 * SCALE), y: GROUND_Y },
  { x: Math.round(450 * SCALE), y: GROUND_Y },
  { x: Math.round(600 * SCALE), y: GROUND_Y },
],
```

### 6.6 Launcher (`src/lib/agent-economy/launcher.ts`)

**Already fixed** to register tokens in Neon DB. Need to ensure zone is set:

```typescript
const globalToken: GlobalToken = {
  // ...
  zone_override: "moltbook", // Add this
};
```

### 6.7 World Calculator (`src/lib/world-calculator.ts`)

**Update agent building logic:**

```typescript
// In rowToBuilding for external-registry
zone: "moltbook" as ZoneType,  // Agent buildings always in moltbook zone
```

### 6.8 World State API (`src/app/api/world-state/route.ts`)

No changes needed - already injects external agents and buildings.

### 6.9 Admin API (`src/app/api/admin/route.ts`)

Add "moltbook" to VALID_ZONES:

```typescript
const VALID_ZONES = ["labs", "moltbook", "main_city", "trending", "ballers", "founders"] as const;
```

### 6.10 ElizaOS Types (`eliza-agents/src/types/elizaos.ts`)

Add "moltbook" to ZoneType.

---

## 7. Fix Existing Agents (Test123, ChadGhost)

### 7.1 Database Migration

For agents already registered with wrong Y positions or missing buildings:

```sql
-- Update all external agents to moltbook zone with correct Y
UPDATE external_agents
SET zone = 'moltbook',
    y = 880
WHERE zone != 'moltbook' OR y < 800;
```

### 7.2 Register Missing Token Buildings

Create admin endpoint or script to:

1. Query all tokens launched via agent economy
2. Register any missing ones in `global_tokens` with `zone_override = 'moltbook'`

---

## 8. Dependencies & Risks

### 8.1 Dependencies

| Dependency | Status   | Notes                          |
| ---------- | -------- | ------------------------------ |
| Neon DB    | Required | For persisting agent zone data |
| Bags SDK   | Required | For token launch integration   |
| Phaser 3   | Existing | For rendering                  |

### 8.2 Risks & Mitigations

| Risk                            | Likelihood   | Mitigation               |
| ------------------------------- | ------------ | ------------------------ |
| Zone transition bugs            | Medium       | Test all zone→zone paths |
| Sprite generation slow          | Low          | Pre-generate at boot     |
| DB migration issues             | Low          | Backup before migration  |
| Existing agent positions broken | High (known) | Include migration step   |

---

## 9. Testing Plan

### 9.1 Unit Tests

- Zone order calculations
- Spawn point generation
- Building position calculations

### 9.2 Integration Tests

- Zone transitions (all directions)
- Agent registration → appears in moltbook
- Token launch → building appears in moltbook

### 9.3 Visual Tests

- Beach theme renders correctly
- Crab/lobster sprites animate
- Wave animation smooth
- Day/night cycle works
- Buildings display correctly

---

## 10. Implementation Order

1. **Phase 1: Types & Structure**
   - Add `moltbook` to ZoneType
   - Update zone order constants
   - Update VALID_ZONES

2. **Phase 2: Textures (BootScene)**
   - Generate beach_ground texture
   - Generate beach building styles
   - Generate crab/lobster sprites
   - Generate palm trees, decorations
   - Generate Moltbook HQ building

3. **Phase 3: Zone Setup (WorldScene)**
   - Add moltbookElements array
   - Implement setupMoltbookZone()
   - Implement createMoltbookDecorations()
   - Add wave animation
   - Wire up zone transitions

4. **Phase 4: Agent Integration**
   - Update external-registry default zone
   - Update spawn.ts spawn points
   - Update launcher zone assignment
   - Add crab/lobster rendering in character update

5. **Phase 5: Migration & Fixes**
   - Migrate existing agents to moltbook zone
   - Register missing token buildings
   - Fix Y positions

6. **Phase 6: Polish**
   - Add Moltbook HQ interactivity
   - Add seagull animations
   - Add ambient ocean sounds (optional)
   - Test all zone transitions

---

## 11. Open Questions

1. **Should the zone be called "moltbook", "beach", or "shore"?**
   - Suggestion: "moltbook" for brand alignment

2. **Should existing non-agent characters appear in moltbook zone?**
   - Suggestion: No - keep it external-agent-only (ChadGhost, Test123, future Moltbook agents)

3. **Should there be a special "welcome" event when agents first spawn?**
   - Suggestion: Yes - add splash animation + event

4. **Should Moltbook HQ link to moltbook.com or moltbook.town?**
   - Suggestion: moltbook.town (the game/town version)

5. **Agent profile links:**
   - Each agent (crab/lobster) links to their **individual Moltbook profile**: `https://moltbook.com/u/{username}`
   - Already implemented in `external-registry.ts` via `profileUrl` field

---

## 12. Estimated Scope

| Phase   | Files Modified | Complexity |
| ------- | -------------- | ---------- |
| Phase 1 | 4              | Low        |
| Phase 2 | 1 (BootScene)  | High       |
| Phase 3 | 1 (WorldScene) | High       |
| Phase 4 | 4              | Medium     |
| Phase 5 | 2 + SQL        | Low        |
| Phase 6 | 2              | Medium     |

**Total:** ~10-12 files, significant BootScene/WorldScene additions

---

## Ready for Review

Please review this plan and let me know:

1. Any changes to the visual theme?
2. Preferred zone name?
3. Answers to open questions?
4. Approval to proceed?
