# BagsWorld Pixel Artist Skill

Expert pixel art and retro game content creation for BagsWorld - a Phaser-based pixel art game visualizing Bags.fm on-chain activity.

## Triggers

Invoke this skill when:
- "create a building for..."
- "design a new zone..."
- "add props to..."
- "pixel art for..."
- "generate texture for..."
- "new character sprite..."
- Creating any visual content for BagsWorld

## Core Architecture

### Two-Step Texture Creation Process

**Step 1: Generate Texture (BootScene.ts)**
```typescript
const g = this.make.graphics({ x: 0, y: 0 });
g.fillStyle(0xColorHex);
g.fillRect(x, y, width, height);
g.generateTexture("texture_name", canvasWidth, canvasHeight);
g.destroy();
```

**Step 2: Place Sprite (WorldScene.ts)**
```typescript
const sprite = this.add.sprite(x, y, "texture_name");
sprite.setOrigin(0.5, 1);
sprite.setDepth(depthLayer);
this.zoneElements.push(sprite);
```

### Scale Factor
Always use `const s = SCALE;` (1.6x) and multiply all pixel values by `s`.

## Phaser Graphics API

### Drawing Methods
| Method | Usage |
|--------|-------|
| `fillStyle(color, alpha?)` | Set fill color (hex) and optional alpha |
| `fillRect(x, y, w, h)` | Draw rectangle |
| `fillTriangle(x1,y1, x2,y2, x3,y3)` | Draw triangle (roofs, peaks) |
| `fillCircle(cx, cy, radius)` | Draw circle (foliage, domes) |
| `fillEllipse(cx, cy, w, h)` | Draw ellipse (bodies, leaves) |
| `lineStyle(width, color, alpha)` | Set stroke style |
| `strokeRect(x, y, w, h)` | Stroke rectangle outline |

### Color Helpers
```typescript
// Darken a color by percentage (0-1)
function darken(color: number, amount: number): number

// Lighten a color by percentage (0-1)
function lighten(color: number, amount: number): number
```

## Pixel Art Techniques

### 3D Depth Effect (REQUIRED for buildings)
```typescript
// Main body
g.fillStyle(baseColor);
g.fillRect(x, y, width, height);

// Light left edge (20% lighter)
g.fillStyle(lighten(baseColor, 0.2));
g.fillRect(x, y, 6 * s, height);

// Dark right edge (25% darker)
g.fillStyle(darken(baseColor, 0.25));
g.fillRect(x + width - 6 * s, y, 6 * s, height);
```

### Dithering Pattern (texture detail)
```typescript
g.fillStyle(darken(baseColor, 0.08));
for (let py = 0; py < height; py += 4 * s) {
  for (let px = 10 * s; px < width - 10 * s; px += 8 * s) {
    if ((py / (4 * s) + px / (8 * s)) % 2 === 0) {
      g.fillRect(x + px, y + py, 2 * s, 2 * s);
    }
  }
}
```

### Glowing Windows
```typescript
// Glow aura (semi-transparent)
g.fillStyle(windowColor, 0.3);
g.fillRect(wx - 2, wy - 2, width + 4, height + 4);

// Window fill
g.fillStyle(windowColor);
g.fillRect(wx, wy, width, height);

// Highlight corner (top-left)
g.fillStyle(lighten(windowColor, 0.4));
g.fillRect(wx, wy, 2, 3);
```

### Drop Shadow
```typescript
g.fillStyle(PALETTE.void, 0.5);
g.fillRect(x + 6 * s, y + 6 * s, width - 2 * s, height);
```

## Layer/Depth System

| Depth | Layer | Contents |
|-------|-------|----------|
| -2 | Sky gradient | Day/night - DO NOT MODIFY |
| -1 | Stars | Night only |
| 0 | Ground/grass | Zone-specific texture |
| 1 | Path | Walking surface |
| 2 | Trees, bushes, flowers | Low props |
| 3 | Lamps, benches | Street furniture |
| 4 | Ground animals | Dogs, cats, squirrels |
| 5-9 | Buildings | Main structures |
| 10 | Characters | Player/NPCs |
| 15 | Flying elements | Birds, butterflies |
| 20 | Particles | Fireflies, sparkles |

## Y-Position Reference

```typescript
const s = SCALE;
const grassTop = 455 * s;     // Top of grass area
const pathLevel = 555 * s;    // Character walk height
const groundY = 540 * s;      // Ground tileSprite Y
const pathY = 570 * s;        // Path tileSprite Y
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
  // Hide other zones
  this.decorations.forEach(d => d.setVisible(false));

  // Option A: Keep grass
  this.ground.setVisible(true);

  // Option B: Custom ground
  this.ground.setVisible(false);
  const ground = this.add.graphics();
  ground.fillStyle(0x374151);
  ground.fillRect(0, 450 * s, GAME_WIDTH, 250 * s);
  ground.setDepth(0);
  this.myZoneElements.push(ground);

  // Add buildings, props, etc.
}
```

## Minimum Content Requirements

Every zone MUST contain:
- **3+ Buildings** with full pixel art detail (walls, windows, doors, roofs)
- **5+ Props** (trees, lamps, signs, benches, decorations)
- **Textured ground** (not solid flat colors)
- **No empty spaces** between buildings

## Quality Checklist

Before completing any content:
- [ ] Uses 3D depth effect (light left, dark right edges)?
- [ ] Has dithering or texture detail?
- [ ] Windows have glow effect?
- [ ] Matches PALETTE colors?
- [ ] Scale factor applied to all dimensions?
- [ ] Proper depth assignment?
- [ ] Works in day AND night sky states?

## Files to Modify

| Content Type | File |
|--------------|------|
| Textures | `src/game/scenes/BootScene.ts` |
| Zone logic | `src/game/scenes/WorldScene.ts` |
| Zone types | `src/lib/types.ts` |

## References

See the `references/` folder for:
- `color-palette.md` - Full PALETTE constant
- `building-patterns.md` - Building generator examples
- `prop-library.md` - Prop texture examples
- `zone-checklist.md` - Complete zone creation steps
