# Zone Creation Checklist

Complete step-by-step guide for creating new zones in BagsWorld.

## Phase 1: Type Registration

### File: `src/lib/types.ts`

```typescript
// 1. Add to ZoneType union
export type ZoneType = "main_city" | "trending" | "ballers" | "founders" | "my_zone";

// 2. Add to ZONES record
export const ZONES: Record<ZoneType, ZoneInfo> = {
  // ... existing zones
  my_zone: {
    id: "my_zone",
    name: "My Zone Name",
    description: "Description for tooltip",
    icon: "[M]",
  },
};
```

## Phase 2: Texture Generation

### File: `src/game/scenes/BootScene.ts`

```typescript
// 1. Add generator method
private generateMyZoneAssets(): void {
  this.generateMyZoneGround();
  this.generateMyZoneBuildings();
  this.generateMyZoneProps();
}

// 2. Call from generatePlaceholderAssets()
private generatePlaceholderAssets(): void {
  // ... existing generators
  this.generateMyZoneAssets();
}

// 3. Implement building generators (minimum 3)
private generateMyZoneBuilding0(s: number): void {
  const g = this.make.graphics({ x: 0, y: 0 });
  const canvasW = Math.round(60 * s);
  const canvasH = Math.round(120 * s);

  // Building implementation...

  g.generateTexture("myzone_0", canvasW, canvasH);
  g.destroy();
}

// 4. Implement prop generators (minimum 5)
private generateMyZoneProps(): void {
  // Lamp, bench, sign, tree, decoration...
}
```

## Phase 3: Zone Setup

### File: `src/game/scenes/WorldScene.ts`

```typescript
// 1. Add class-level cache variables
private myZoneElements: Phaser.GameObjects.GameObject[] = [];
private myZoneCreated = false;

// 2. Add case to setupZone()
private setupZone(zone: ZoneType): void {
  switch (zone) {
    // ... existing cases
    case "my_zone":
      this.setupMyZone();
      break;
  }
}

// 3. Implement setup method
private setupMyZone(): void {
  const s = SCALE;
  const grassTop = Math.round(455 * s);
  const pathLevel = Math.round(555 * s);

  // Hide other zones
  this.decorations.forEach(d => d.setVisible(false));
  this.animals.forEach(a => a.sprite.setVisible(false));
  this.trendingElements.forEach(el => (el as any).setVisible(false));
  // ... hide all other zone elements

  // Create once, cache for reuse
  if (!this.myZoneCreated) {
    this.createMyZoneContent();
    this.myZoneCreated = true;
  } else {
    this.myZoneElements.forEach(el => (el as any).setVisible(true));
  }
}

// 4. Implement content creation
private createMyZoneContent(): void {
  const s = SCALE;
  const grassTop = Math.round(455 * s);
  const pathLevel = Math.round(555 * s);

  // Ground (choose one)
  // Option A: Keep grass
  this.ground.setVisible(true);
  this.ground.setTexture("grass");

  // Option B: Custom ground
  this.ground.setVisible(false);
  const ground = this.add.graphics();
  ground.fillStyle(0x374151);
  ground.fillRect(0, Math.round(450 * s), GAME_WIDTH, Math.round(250 * s));
  ground.setDepth(0);
  this.myZoneElements.push(ground);

  // Buildings (minimum 3)
  const buildingPositions = [
    { x: Math.round(150 * s), texture: "myzone_0" },
    { x: Math.round(400 * s), texture: "myzone_1" },
    { x: Math.round(650 * s), texture: "myzone_2" },
  ];

  buildingPositions.forEach(pos => {
    const building = this.add.sprite(pos.x, pathLevel, pos.texture);
    building.setOrigin(0.5, 1);
    building.setDepth(5);
    this.myZoneElements.push(building);
  });

  // Props (minimum 5)
  const lampPositions = [
    Math.round(100 * s),
    Math.round(300 * s),
    Math.round(500 * s),
    Math.round(700 * s),
  ];

  lampPositions.forEach(x => {
    const lamp = this.add.sprite(x, pathLevel, "lamp");
    lamp.setOrigin(0.5, 1);
    lamp.setDepth(3);
    this.myZoneElements.push(lamp);
  });

  // Additional decorations...
}

// 5. Add hide call to other zone setups
private setupMainCityZone(): void {
  // ... existing code
  this.myZoneElements.forEach(el => (el as any).setVisible(false));
}
```

## Phase 4: Validation Checklist

### Content Requirements
- [ ] **3+ Buildings** with walls, windows, doors, roofs
- [ ] **5+ Props** (lamps, benches, signs, trees, decorations)
- [ ] **Textured ground** (not solid flat color)
- [ ] **No empty spaces** between elements

### Technical Requirements
- [ ] Zone type added to `types.ts`
- [ ] Textures generated in `BootScene.ts`
- [ ] Cache variables declared at class level
- [ ] Zone case added to `setupZone()`
- [ ] Setup method implemented
- [ ] Other zones hide this zone's elements
- [ ] Uses `Math.round()` for all pixel positions

### Visual Quality
- [ ] Buildings use 3D depth effect (light left, dark right)
- [ ] Windows have glow effect
- [ ] Uses PALETTE colors
- [ ] Works in day AND night sky
- [ ] Matches Park/BagsCity quality level

### Layer/Depth Check
- [ ] Ground at depth 0
- [ ] Path elements at depth 1
- [ ] Props at depth 2-4
- [ ] Buildings at depth 5-9
- [ ] Characters at depth 10
- [ ] Flying elements at depth 15+

## Quick Reference

### Y Positions
```typescript
const grassTop = 455 * SCALE;
const pathLevel = 555 * SCALE;
const groundY = 540 * SCALE;
const pathY = 570 * SCALE;
```

### Common Patterns
```typescript
// Sprite placement
const sprite = this.add.sprite(x, pathLevel, "texture");
sprite.setOrigin(0.5, 1);  // Bottom-center origin
sprite.setDepth(5);
this.myZoneElements.push(sprite);

// Graphics placement
const g = this.add.graphics();
g.fillStyle(color);
g.fillRect(x, y, w, h);
g.setDepth(0);
this.myZoneElements.push(g);

// Text placement
const text = this.add.text(x, y, "TEXT", {
  fontFamily: "monospace",
  fontSize: `${Math.round(16 * SCALE)}px`,
  color: "#ffffff"
});
text.setOrigin(0.5);
text.setDepth(10);
this.myZoneElements.push(text);
```

### Hide All Other Zones Pattern
```typescript
// In your setup method, hide everything else
this.decorations.forEach(d => d.setVisible(false));
this.animals.forEach(a => a.sprite.setVisible(false));
if (this.fountainWater) this.fountainWater.setVisible(false);
this.trendingElements.forEach(el => (el as any).setVisible(false));
this.skylineSprites.forEach(s => s.setVisible(false));
this.billboardTexts.forEach(t => t.setVisible(false));
if (this.tickerText) this.tickerText.setVisible(false);
this.ballersElements.forEach(el => (el as any).setVisible(false));
this.foundersElements.forEach(el => (el as any).setVisible(false));
// Add any new zones here
```

## Common Mistakes to Avoid

1. **Floating zone titles** - Don't add text banners with zone names. The nav bar shows this.

2. **Empty placeholder poles** - Every element must be detailed, not just rectangles.

3. **Forgetting to hide in other zones** - Add hide call to ALL other zone setups.

4. **Not using SCALE** - All dimensions must be multiplied by `s` or `SCALE`.

5. **Wrong depth order** - Buildings behind props, characters in front.

6. **Solid color ground** - Ground must have texture/detail.

7. **Missing cache flag** - Always use `myZoneCreated` pattern for performance.
