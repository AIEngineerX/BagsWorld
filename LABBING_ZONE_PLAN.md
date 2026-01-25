# Founder's Corner - Implementation Plan

## Goal

Create a new **"Founder's Corner"** zone - a cozy educational hub that teaches creators how to properly prepare their token for DexScreener listing.

## User Decisions
- **Zone Name:** Founder's Corner
- **Interactivity:** Clickable popups (buildings open detail modals)
- **Content Scope:** DexScreener requirements only (focused)

---

## Research Findings

### DexScreener Enhanced Token Info Requirements

**Source:** [DexScreener Marketplace](https://marketplace.dexscreener.com/product/token-info)

| Item | Specification |
|------|---------------|
| **Cost** | $299 USD (discounted from $499) |
| **Payment** | Crypto or credit card |
| **Processing** | Usually minutes, up to 12 hours |

**Logo Requirements:**
- Format: PNG, JPG, WEBP, or GIF
- Aspect Ratio: 1:1 (square)
- Minimum Size: 100px width
- Recommended: High resolution (DexScreener handles compression)
- Best Practice: 512x512px or 1024x1024px for crisp display

**Header/Banner Requirements:**
- Format: PNG, JPG, WEBP, or GIF
- Aspect Ratio: 3:1 (rectangle)
- Minimum Size: 600px wide
- Recommended: 600x200px or 1500x500px

**Required Social Links:**
- Website URL
- Twitter/X handle
- Telegram group (optional)
- Discord server (optional)

**Other Requirements:**
- Token description
- Team information (optional)
- Roadmap (optional)
- Locked wallet addresses (for accurate market cap)

---

## Zone Architecture (Per CLAUDE.md Specification)

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/types.ts` | Add `"founders"` to ZoneType, add ZONES entry |
| `src/game/scenes/BootScene.ts` | Generate building textures, props, ground texture |
| `src/game/scenes/WorldScene.ts` | Zone setup, switching, element caching, popup system |

### Layer Architecture (CRITICAL - From Spec)

```
┌─────────────────────────────────────────┐
│  SKY LAYER (depth -2) - DO NOT TOUCH    │
│  Persists across zones automatically    │
├─────────────────────────────────────────┤
│  GROUND LAYER (depth 0)                 │
│  Y = 540 * SCALE, height 180            │
│  → Use setTexture("founders_ground")    │
├─────────────────────────────────────────┤
│  PATH LAYER (depth 1)                   │
│  Y = 570 * SCALE, height 40             │
│  Characters walk at ~555 * SCALE        │
├─────────────────────────────────────────┤
│  PROPS (depth 2-4)                      │
│  BUILDINGS (depth 5+)                   │
│  CHARACTERS (depth 10)                  │
└─────────────────────────────────────────┘
```

### Y-Position Reference (CRITICAL)

```typescript
const SCALE = 1.6;
const grassTop = 455 * SCALE;    // Top of grass area (728px)
const pathLevel = 555 * SCALE;   // Where characters walk (888px)
const groundY = 540 * SCALE;     // Ground tileSprite Y (864px)
const pathY = 570 * SCALE;       // Path tileSprite Y (912px)
```

### Depth Reference

| Depth | Contents |
|-------|----------|
| -2 | Sky gradient (DO NOT TOUCH) |
| -1 | Stars (DO NOT TOUCH) |
| 0 | Ground/grass layer |
| 1 | Path layer |
| 2 | Trees, bushes, flowers, workbenches |
| 3 | Lamps, benches, easels |
| 4 | Ground props, crates |
| 5+ | Buildings |
| 10 | Characters |

### Zone Theme: "Founder's Corner"

**Aesthetic:**
- Cozy workshop/study environment
- Warm wood tones (browns: 0x8b4513, 0xa0522d, 0x6b4423)
- Amber lighting, chalkboard accents
- Workbenches, blueprints, bulletin boards

**Ground Texture (generate in BootScene):**
- Cobblestone pattern with warm tones
- Visible stone detail (not solid color)
- Tileable 32x32 texture

---

## Building Concepts (3 Buildings - Focused)

### Building 1: DexScreener Workshop (MAIN BUILDING)

**Purpose:** Central educational building - DexScreener overview & checklist

**Visual Elements:**
- Cozy workshop building with warm wood exterior
- Large chalkboard/bulletin board on facade
- DexScreener green accents
- Welcoming entrance with "LEARN HERE" sign

**Popup Content (on click):**
```
╔═══════════════════════════════════════╗
║     DEXSCREENER ENHANCED TOKEN INFO   ║
╠═══════════════════════════════════════╣
║  COST: $299 USD                       ║
║  PROCESSING: Usually minutes (~12hr)  ║
╠═══════════════════════════════════════╣
║  REQUIREMENTS CHECKLIST:              ║
║  ☑ Logo (square, 512x512px)           ║
║  ☑ Header (3:1 ratio, 600x200px)      ║
║  ☑ Website URL                        ║
║  ☑ Twitter/X handle                   ║
║  ☐ Telegram (optional)                ║
║  ☐ Discord (optional)                 ║
╠═══════════════════════════════════════╣
║  PAYMENT: Crypto or Credit Card       ║
╚═══════════════════════════════════════╝
```

### Building 2: The Art Studio (Logo & Banner)

**Purpose:** Visual assets requirements - logo and header specs

**Visual Elements:**
- Artist studio with easel/canvas aesthetic
- Display showing square vs rectangle visual
- Paint splashes, creative vibe
- "ASSETS" sign

**Popup Content (on click):**
```
╔═══════════════════════════════════════╗
║         VISUAL ASSETS GUIDE           ║
╠═══════════════════════════════════════╣
║  TOKEN LOGO:                          ║
║  • Format: PNG, JPG, WEBP, or GIF     ║
║  • Ratio: 1:1 (square)                ║
║  • Size: 512x512px recommended        ║
║  • Min: 100px width                   ║
║                                       ║
║  [■■■] ← Square logo example          ║
╠═══════════════════════════════════════╣
║  TOKEN HEADER/BANNER:                 ║
║  • Format: PNG, JPG, WEBP, or GIF     ║
║  • Ratio: 3:1 (wide rectangle)        ║
║  • Size: 600x200px recommended        ║
║  • Min: 600px width                   ║
║                                       ║
║  [████████████] ← 3:1 banner example  ║
╚═══════════════════════════════════════╝
```

### Building 3: The Social Post (Links & Presence)

**Purpose:** Social media requirements and best practices

**Visual Elements:**
- Bulletin board/community center style
- Social media icons (Twitter, Telegram, Discord)
- Connection lines/network visual
- "CONNECT" sign

**Popup Content (on click):**
```
╔═══════════════════════════════════════╗
║       SOCIAL LINKS REQUIREMENTS       ║
╠═══════════════════════════════════════╣
║  REQUIRED:                            ║
║  ✓ Website URL                        ║
║    yourtoken.com                      ║
║                                       ║
║  ✓ Twitter/X                          ║
║    @yourtoken                         ║
╠═══════════════════════════════════════╣
║  OPTIONAL (but recommended):          ║
║  ○ Telegram Group                     ║
║    t.me/yourtoken                     ║
║                                       ║
║  ○ Discord Server                     ║
║    discord.gg/yourtoken               ║
╠═══════════════════════════════════════╣
║  TIP: Active socials = more trust!    ║
╚═══════════════════════════════════════╝
```

---

## Props & Decorations (Per Spec Density Requirements)

### Required Density (from CLAUDE.md)
- **Trees/tall props:** 4-6 elements
- **Ground cover:** 4-6 bushes/hedges
- **Lighting:** 2-4 lamps
- **Seating/furniture:** 2-4 items
- **Small details:** 5-8 items
- **Centerpiece:** 1 focal element

### Prop Inventory with Y-Positions

| Prop | Count | X Positions | Y Position | Depth |
|------|-------|-------------|------------|-------|
| Trees | 4 | 80, 250, 550, 720 | grassTop (±5) | 2 |
| Hedges | 4 | 150, 350, 450, 650 | grassTop + 25 | 2 |
| Lanterns | 3 | 200, 400, 600 | pathLevel | 3 |
| Benches | 2 | 300, 500 | pathLevel - 5 | 3 |
| Workbenches | 2 | 180, 580 | grassTop + 30 | 3 |
| Easels | 2 | 320, 480 | grassTop + 20 | 3 |
| Crates | 3 | 100, 400, 700 | pathLevel + 5 | 4 |
| Flowers | 5 | 130, 280, 420, 560, 680 | grassTop + 32 | 2 |
| Chalkboard Sign | 1 | GAME_WIDTH/2 | grassTop - 10 | 2 |

### Ground Texture Generation (BootScene.ts)

```typescript
private generateFoundersGround(): void {
  const s = SCALE;
  const size = Math.round(32 * s);
  const g = this.make.graphics({ x: 0, y: 0 });

  // Base cobblestone color
  g.fillStyle(0x78716c);  // Gray-brown stone
  g.fillRect(0, 0, size, size);

  // Stone pattern (not solid color!)
  g.fillStyle(0x6b7280);  // Darker stones
  for (let i = 0; i < 4; i++) {
    const sx = Math.round((i % 2) * 16 * s);
    const sy = Math.round(Math.floor(i / 2) * 16 * s);
    g.fillRect(sx + 2, sy + 2, Math.round(12 * s), Math.round(12 * s));
  }

  // Highlight edges
  g.fillStyle(0x9ca3af);
  g.fillRect(0, 0, size, Math.round(2 * s));
  g.fillRect(0, 0, Math.round(2 * s), size);

  // Warm accent (optional flower/moss detail)
  g.fillStyle(0x92400e);
  g.fillRect(Math.round(8 * s), Math.round(24 * s), Math.round(3 * s), Math.round(3 * s));

  g.generateTexture("founders_ground", size, size);
  g.destroy();
}
```

### Lighting Style
- Warm amber glow (0xfbbf24)
- Semi-transparent aura: `fillStyle(0xfbbf24, 0.3)`
- Lantern housing: dark wood (0x451a03)

---

## Technical Implementation (Per CLAUDE.md Spec)

### Step 1: types.ts

```typescript
export type ZoneType = "main_city" | "trending" | "academy" | "ballers" | "founders";

export const ZONES: Record<ZoneType, ZoneInfo> = {
  // ... existing zones ...
  founders: {
    id: "founders",
    name: "Founder's Corner",
    description: "Learn to launch tokens - DexScreener prep station",
    icon: "[F]",
  },
};
```

### Step 2: BootScene.ts - Texture Generation

**Required Generators:**
```typescript
// Add to generatePlaceholderAssets()
this.generateFoundersGround();      // Cobblestone tileable texture
this.generateFoundersBuildings();   // 3 workshop buildings
this.generateFoundersProps();       // Workbench, easel, crate, lantern
```

**Building Generation Pattern (with 3D depth):**
```typescript
private generateFoundersBuildings(): void {
  const s = SCALE;
  const buildings = [
    { name: "founders_workshop", base: 0x8b4513, accent: 0x4ade80 },
    { name: "founders_studio", base: 0xa0522d, accent: 0xfbbf24 },
    { name: "founders_social", base: 0x6b4423, accent: 0x60a5fa },
  ];

  buildings.forEach((style, index) => {
    const g = this.make.graphics({ x: 0, y: 0 });
    const bWidth = Math.round(55 * s);
    const bHeight = Math.round(80 * s);
    const canvasW = Math.round(65 * s);
    const canvasH = Math.round(120 * s);
    const baseY = canvasH - bHeight;

    // 1. Drop shadow
    g.fillStyle(0x0a0a0f, 0.5);
    g.fillRect(Math.round(6 * s), baseY + Math.round(6 * s), bWidth, bHeight);

    // 2. Main body
    g.fillStyle(style.base);
    g.fillRect(Math.round(4 * s), baseY, bWidth, bHeight);

    // 3. 3D DEPTH: Light left edge
    g.fillStyle(lighten(style.base, 0.15));
    g.fillRect(Math.round(4 * s), baseY, Math.round(6 * s), bHeight);

    // 4. 3D DEPTH: Dark right edge
    g.fillStyle(darken(style.base, 0.2));
    g.fillRect(Math.round(4 * s) + bWidth - Math.round(6 * s), baseY, Math.round(6 * s), bHeight);

    // 5. Dithering texture
    g.fillStyle(darken(style.base, 0.08));
    for (let py = 0; py < bHeight; py += Math.round(6 * s)) {
      for (let px = Math.round(8 * s); px < bWidth - Math.round(8 * s); px += Math.round(10 * s)) {
        if ((py / Math.round(6 * s) + px / Math.round(10 * s)) % 2 === 0) {
          g.fillRect(Math.round(4 * s) + px, baseY + py, Math.round(8 * s), Math.round(4 * s));
        }
      }
    }

    // 6. Roof (pointed triangle)
    const roofPeak = baseY - Math.round(25 * s);
    g.fillStyle(0x78350f);  // Dark brown roof
    g.fillTriangle(
      Math.round(4 * s), baseY,
      Math.round(4 * s) + bWidth / 2, roofPeak,
      Math.round(4 * s) + bWidth, baseY
    );

    // 7. Windows (2x2 grid with glow)
    const windowColor = style.accent;
    for (let wy = 0; wy < 2; wy++) {
      for (let wx = 0; wx < 2; wx++) {
        const winX = Math.round(12 * s) + wx * Math.round(20 * s);
        const winY = baseY + Math.round(15 * s) + wy * Math.round(25 * s);
        // Glow aura
        g.fillStyle(windowColor, 0.3);
        g.fillRect(winX - 2, winY - 2, Math.round(14 * s), Math.round(12 * s));
        // Window fill
        g.fillStyle(windowColor);
        g.fillRect(winX, winY, Math.round(10 * s), Math.round(8 * s));
        // Highlight corner
        g.fillStyle(lighten(windowColor, 0.4));
        g.fillRect(winX, winY, Math.round(3 * s), Math.round(3 * s));
      }
    }

    // 8. Door (center-bottom)
    g.fillStyle(0x451a03);
    g.fillRect(Math.round(4 * s) + bWidth / 2 - Math.round(8 * s), baseY + bHeight - Math.round(20 * s), Math.round(16 * s), Math.round(20 * s));

    // 9. Sign/Chalkboard on facade
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(4 * s) + Math.round(5 * s), baseY + Math.round(5 * s), bWidth - Math.round(10 * s), Math.round(12 * s));
    g.fillStyle(style.accent, 0.8);
    g.fillRect(Math.round(4 * s) + Math.round(7 * s), baseY + Math.round(7 * s), bWidth - Math.round(14 * s), Math.round(8 * s));

    g.generateTexture(`founders_${index}`, canvasW, canvasH);
    g.destroy();
  });
}
```

### Step 3: WorldScene.ts - Zone Setup

**Class Variables:**
```typescript
private foundersElements: Phaser.GameObjects.GameObject[] = [];
private foundersZoneCreated = false;
private foundersPopup: Phaser.GameObjects.Container | null = null;
```

**Zone Switch Case:**
```typescript
case "founders":
  // HIDE all other zone elements first
  this.decorations.forEach(d => d.setVisible(false));
  this.animals.forEach(a => a.sprite.setVisible(false));
  if (this.fountainWater) this.fountainWater.setVisible(false);
  this.trendingElements.forEach(el => (el as any).setVisible(false));
  this.skylineSprites.forEach(s => s.setVisible(false));
  this.academyElements.forEach(el => (el as any).setVisible(false));
  this.ballersElements.forEach(el => (el as any).setVisible(false));

  // Create or show Founder's Corner
  if (!this.foundersZoneCreated) {
    this.setupFoundersZone();
    this.foundersZoneCreated = true;
  } else {
    this.foundersElements.forEach(el => (el as any).setVisible(true));
  }
  break;
```

**Setup Method:**
```typescript
private setupFoundersZone(): void {
  const s = SCALE;
  const grassTop = Math.round(455 * s);
  const pathLevel = Math.round(555 * s);
  const groundY = Math.round(540 * s);

  // 1. GROUND: Swap texture (don't hide, swap)
  this.ground.setTexture("founders_ground");
  this.ground.setVisible(true);

  // 2. BACKGROUND TREES (depth 2)
  const treePositions = [
    { x: 80, y: grassTop },
    { x: 250, y: grassTop + 5 },
    { x: 550, y: grassTop - 3 },
    { x: 720, y: grassTop + 8 },
  ];
  treePositions.forEach(pos => {
    const tree = this.add.sprite(Math.round(pos.x * s), pos.y, "tree");
    tree.setOrigin(0.5, 1);
    tree.setDepth(2);
    tree.setScale(0.9 + Math.random() * 0.3);
    this.foundersElements.push(tree);
  });

  // 3. BUILDINGS (depth 5+)
  const buildings = [
    { texture: 0, x: 250, label: "DEXSCREENER\nWORKSHOP", type: "workshop" },
    { texture: 1, x: 450, label: "ART\nSTUDIO", type: "studio" },
    { texture: 2, x: 650, label: "SOCIAL\nHUB", type: "social" },
  ];
  buildings.forEach((b, i) => {
    const bx = Math.round(b.x * s);
    const sprite = this.add.sprite(bx, pathLevel, `founders_${b.texture}`);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(5 - i / 10);
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => this.showFoundersPopup(b.type));
    sprite.on('pointerover', () => sprite.setTint(0xdddddd));
    sprite.on('pointerout', () => sprite.clearTint());
    this.foundersElements.push(sprite);

    // Label
    const label = this.add.text(bx, pathLevel + Math.round(15 * s), b.label, {
      fontFamily: "monospace",
      fontSize: `${Math.round(9 * s)}px`,
      color: "#4ade80",
      align: "center",
    });
    label.setOrigin(0.5, 0);
    label.setDepth(6);
    this.foundersElements.push(label);
  });

  // 4. PROPS (lanterns, benches, workbenches, etc.)
  // ... (place all props per the inventory table above)

  // 5. ZONE TITLE
  const title = this.add.text(GAME_WIDTH / 2, Math.round(80 * s), "FOUNDER'S CORNER", {
    fontFamily: "monospace",
    fontSize: `${Math.round(20 * s)}px`,
    color: "#fbbf24",
    stroke: "#000000",
    strokeThickness: 3,
  });
  title.setOrigin(0.5);
  title.setDepth(10);
  this.foundersElements.push(title);
}
```

### Step 4: Popup Modal System

```typescript
private showFoundersPopup(type: string): void {
  if (this.foundersPopup) return; // Already open

  const s = SCALE;
  const centerX = GAME_WIDTH / 2;
  const centerY = Math.round(300 * s);

  // Dark overlay
  const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_WIDTH / 2, GAME_WIDTH * 2, GAME_WIDTH * 2, 0x000000, 0.7);
  overlay.setDepth(50);
  overlay.setInteractive();
  overlay.on('pointerdown', () => this.hideFoundersPopup());

  // Modal container
  this.foundersPopup = this.add.container(centerX, centerY);
  this.foundersPopup.setDepth(51);

  // Background panel
  const panelW = Math.round(300 * s);
  const panelH = Math.round(200 * s);
  const panel = this.add.rectangle(0, 0, panelW, panelH, 0x1f2937);
  panel.setStrokeStyle(3, 0x4ade80);
  this.foundersPopup.add(panel);

  // Content based on type
  const content = this.getFoundersPopupContent(type);
  const text = this.add.text(0, 0, content, {
    fontFamily: "monospace",
    fontSize: `${Math.round(10 * s)}px`,
    color: "#ffffff",
    align: "center",
    lineSpacing: 4,
  });
  text.setOrigin(0.5);
  this.foundersPopup.add(text);

  // Close button
  const closeBtn = this.add.text(panelW / 2 - Math.round(15 * s), -panelH / 2 + Math.round(10 * s), "[X]", {
    fontFamily: "monospace",
    fontSize: `${Math.round(12 * s)}px`,
    color: "#ef4444",
  });
  closeBtn.setInteractive({ useHandCursor: true });
  closeBtn.on('pointerdown', () => this.hideFoundersPopup());
  this.foundersPopup.add(closeBtn);

  this.foundersPopup.add(overlay);
}

private hideFoundersPopup(): void {
  if (this.foundersPopup) {
    this.foundersPopup.destroy();
    this.foundersPopup = null;
  }
}

private getFoundersPopupContent(type: string): string {
  switch (type) {
    case "workshop":
      return "DEXSCREENER ENHANCED TOKEN INFO\n\nCost: $299 USD\nProcessing: ~12 hours\n\nREQUIRED:\n✓ Logo (512x512px, square)\n✓ Header (600x200px, 3:1)\n✓ Website URL\n✓ Twitter/X\n\nOPTIONAL:\n○ Telegram\n○ Discord";
    case "studio":
      return "VISUAL ASSETS GUIDE\n\nTOKEN LOGO:\n• Format: PNG/JPG/WEBP/GIF\n• Ratio: 1:1 (square)\n• Size: 512x512px recommended\n\nTOKEN HEADER:\n• Format: PNG/JPG/WEBP/GIF\n• Ratio: 3:1 (wide)\n• Size: 600x200px minimum";
    case "social":
      return "SOCIAL LINKS\n\nREQUIRED:\n✓ Website URL\n✓ Twitter/X handle\n\nRECOMMENDED:\n○ Telegram group\n○ Discord server\n\nTIP: Active socials = more trust!";
    default:
      return "";
  }
}
```

---

## Popup Modal System

### Implementation Approach

Buildings are clickable. When clicked, a modal overlay appears with detailed information.

**Modal Design:**
- Semi-transparent dark background overlay
- Centered content panel with pixel art border
- Close button (X) in corner
- Building-specific content

**UI Components Needed:**
1. `showFoundersPopup(type: string)` - Display modal
2. `hideFoundersPopup()` - Close modal
3. Modal container (Phaser container with graphics + text)

### Modal Visual Style
```
┌────────────────────────────────────────┐
│  [X]                                   │  ← Close button
│                                        │
│         BUILDING TITLE                 │
│  ════════════════════════════════════  │
│                                        │
│         Content area with              │
│         requirements, specs,           │
│         and helpful tips               │
│                                        │
│  ════════════════════════════════════  │
│         Click anywhere to close        │
└────────────────────────────────────────┘
```

### Interaction Flow
1. Player clicks building → Modal appears
2. Modal displays building-specific DexScreener info
3. Player clicks X or outside modal → Modal closes
4. Building has subtle highlight/glow on hover

---

## Risks & Unknowns

### Risks
1. **DexScreener requirements may change** - Info should be easy to update
2. **Screen text readability** - Pixel font size must be legible
3. **Information density** - Too much text could be overwhelming

### Mitigations
1. Store display text in constants for easy updates
2. Test font sizes at multiple resolutions
3. Prioritize most critical info, use buildings to segment content

### Unknowns
1. Should buildings be interactive (clickable for more info)?
2. Should there be a "graduate" path showing token progression?
3. Integration with actual token launch flow?

---

---

## Visual Standards (Per CLAUDE.md)

### Pixel Art Requirements
- [ ] Hard pixel edges only - no anti-aliasing
- [ ] No smooth gradients - use dithering or solid color blocks
- [ ] 3D depth: Light left edges, dark right edges on buildings
- [ ] Window glow: Semi-transparent aura + highlight corner

### Day/Night Compatibility
Zone colors must work against BOTH sky gradients:
- **Day Sky:** Top 0x1e90ff → Bottom 0x87ceeb
- **Night Sky:** Top 0x0f172a → Bottom 0x1e293b

**Color Choices (tested for contrast):**
- Building base: 0x8b4513 (SaddleBrown) ✓ Works day/night
- Roof: 0x78350f (Dark brown) ✓ Works day/night
- Accents: 0x4ade80 (Green), 0xfbbf24 (Amber) ✓ Bright enough

---

## Implementation Checklist (From CLAUDE.md Spec)

### Technical Setup
- [ ] Add `"founders"` to ZoneType in `src/lib/types.ts`
- [ ] Add founders entry to ZONES record
- [ ] Add `foundersElements[]` array in WorldScene.ts
- [ ] Add `foundersZoneCreated = false` flag
- [ ] Add `foundersPopup` variable for modal
- [ ] Create `generateFoundersGround()` in BootScene.ts
- [ ] Create `generateFoundersBuildings()` in BootScene.ts
- [ ] Create `generateFoundersProps()` in BootScene.ts
- [ ] Create `setupFoundersZone()` in WorldScene.ts
- [ ] Add founders case to zone switch handler

### Layer Rules (CRITICAL)
- [ ] **Sky (depth -2):** DO NOT TOUCH
- [ ] **Ground (depth 0):** Use `setTexture("founders_ground")`
- [ ] **Path (depth 1):** Keep at Y = 570 * SCALE
- [ ] **Buildings (depth 5+):** Use pre-generated textures
- [ ] **All elements:** Push to `foundersElements[]`

### Ground Layer
- [ ] Generate tileable cobblestone texture (32x32)
- [ ] Texture has visible detail (stone pattern, not solid)
- [ ] Character walk path at ~555 * SCALE

### Content Requirements
- [ ] 3 detailed buildings (workshop, studio, social hub)
- [ ] Buildings have: walls, windows, doors, roof, sign
- [ ] 4 trees at grassTop Y-level
- [ ] 4 hedges at grassTop + 25
- [ ] 3 lanterns at pathLevel
- [ ] 2 benches at pathLevel - 5
- [ ] 5 flowers at grassTop + 32
- [ ] Workbenches, easels, crates as additional props
- [ ] Zone title banner

### Pixel Art Quality
- [ ] 3D depth on buildings (light left, dark right)
- [ ] Dithering texture on building walls
- [ ] Window glow with semi-transparent aura
- [ ] Color progression (base → highlight → shadow)

### Zone Switching
- [ ] Hide park decorations
- [ ] Hide animals
- [ ] Hide other zone elements (trending, academy, ballers)
- [ ] Cache zone with `zoneCreated` flag
- [ ] Toggle visibility with `setVisible()`

### Popup System
- [ ] Click handler on buildings
- [ ] Hover effect (tint change)
- [ ] Modal overlay (semi-transparent dark)
- [ ] Content panel with border
- [ ] Close button
- [ ] Building-specific content

### Final Validation
- [ ] Does zone match Park/BagsCity quality?
- [ ] Test in BOTH day and night states
- [ ] Verify characters walk correctly on path
- [ ] Verify popups display correct info
- [ ] Verify all props at correct Y-positions

---

## Estimated Scope

| Component | Complexity | Lines |
|-----------|------------|-------|
| types.ts changes | Low | ~10 |
| BootScene: ground texture | Low | ~30 |
| BootScene: 3 buildings | Medium | ~200 |
| BootScene: props (workbench, easel, lantern, crate) | Medium | ~150 |
| WorldScene: zone setup | Medium | ~200 |
| WorldScene: prop placement | Medium | ~100 |
| WorldScene: popup system | Medium | ~100 |
| WorldScene: hide other zones | Low | ~20 |

**Total:** ~800-900 lines of new code

---

## Implementation Order

1. **Phase 1:** Add zone type to types.ts
2. **Phase 2:** Generate ground texture in BootScene.ts
3. **Phase 3:** Generate building textures in BootScene.ts (with 3D depth, dithering, windows)
4. **Phase 4:** Generate prop textures in BootScene.ts
5. **Phase 5:** Create zone setup in WorldScene.ts (ground, background)
6. **Phase 6:** Place buildings with labels and click handlers
7. **Phase 7:** Place all props at correct Y-positions
8. **Phase 8:** Implement popup modal system
9. **Phase 9:** Test day/night, character walking, popups
10. **Phase 10:** Polish and iterate

---

## Sources

- [DexScreener Enhanced Token Info](https://marketplace.dexscreener.com/product/token-info)
- [DexScreener Token Listing Docs](https://docs.dexscreener.com/token-listing)
- [Smithii DexScreener Guide](https://smithii.io/en/add-social-media-link-dexscreener/)
