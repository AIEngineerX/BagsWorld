# Building Generation Patterns

Real examples from BagsWorld's BootScene.ts for creating buildings.

## Building Level System

Buildings scale by market cap:

| Level | Market Cap | Height | Width | Examples |
|-------|------------|--------|-------|----------|
| 1 | < $100K | 40 * s | 30 * s | corner_store, taco_stand, coffee_shop, arcade |
| 2 | $100K-$500K | 55 * s | 34 * s | tech_startup, law_office, coworking, design_studio |
| 3 | $500K-$2M | 75 * s | 38 * s | corporate_hq, bank, media_tower, pharma_lab |
| 4 | $2M-$10M | 100 * s | 42 * s | modern_tower, art_deco, glass_spire, tech_campus |
| 5 | $10M+ | 130 * s | 48 * s | bags_hq, diamond_tower, gold_citadel, neon_megacorp |

## Standard Building Structure

```typescript
private generateBuilding(): void {
  const s = SCALE;
  const g = this.make.graphics({ x: 0, y: 0 });

  const bHeight = Math.round(75 * s);
  const bWidth = Math.round(38 * s);
  const canvasHeight = Math.round(190 * s);
  const canvasWidth = Math.round(55 * s);

  // 1. DROP SHADOW
  g.fillStyle(PALETTE.void, 0.5);
  g.fillRect(
    Math.round(6 * s),
    canvasHeight - bHeight + Math.round(6 * s),
    bWidth - Math.round(2 * s),
    bHeight
  );

  // 2. BUILDING BASE
  g.fillStyle(style.base);
  g.fillRect(
    Math.round(4 * s),
    canvasHeight - bHeight,
    bWidth - Math.round(4 * s),
    bHeight
  );

  // 3. LEFT EDGE HIGHLIGHT
  g.fillStyle(lighten(style.base, 0.2));
  g.fillRect(
    Math.round(4 * s),
    canvasHeight - bHeight,
    Math.round(6 * s),
    bHeight
  );

  // 4. RIGHT EDGE SHADOW
  g.fillStyle(darken(style.base, 0.25));
  g.fillRect(
    bWidth - Math.round(6 * s),
    canvasHeight - bHeight,
    Math.round(6 * s),
    bHeight
  );

  // 5. DITHERING TEXTURE
  g.fillStyle(darken(style.base, 0.08));
  for (let py = 0; py < bHeight; py += Math.round(4 * s)) {
    for (let px = Math.round(10 * s); px < bWidth - Math.round(10 * s); px += Math.round(8 * s)) {
      if ((py / Math.round(4 * s) + px / Math.round(8 * s)) % 2 === 0) {
        g.fillRect(
          Math.round(4 * s) + px,
          canvasHeight - bHeight + py,
          Math.round(2 * s),
          Math.round(2 * s)
        );
      }
    }
  }

  // 6. ROOF (level-specific)
  this.drawRoof(g, style, bWidth, bHeight, canvasHeight, s);

  // 7. WINDOWS
  this.drawWindows(g, style, bWidth, bHeight, canvasHeight, s);

  // 8. DOOR
  this.drawDoor(g, style, bWidth, canvasHeight, s);

  g.generateTexture("my_building", canvasWidth, canvasHeight);
  g.destroy();
}
```

## Level 1 Roof (Awning Style)

```typescript
private drawLevel1Roof(g, style, bWidth, bHeight, canvasHeight, s): void {
  // Awning roof
  g.fillStyle(style.roof);
  g.fillRect(
    0,
    canvasHeight - bHeight - Math.round(6 * s),
    bWidth + Math.round(4 * s),
    Math.round(8 * s)
  );

  // Awning highlight
  g.fillStyle(lighten(style.roof, 0.15));
  g.fillRect(
    0,
    canvasHeight - bHeight - Math.round(6 * s),
    bWidth + Math.round(4 * s),
    Math.round(2 * s)
  );

  // Awning stripes
  const awningColor = style.awningColor || PALETTE.brightRed;
  g.fillStyle(awningColor);
  for (let ax = Math.round(2 * s); ax < bWidth; ax += Math.round(6 * s)) {
    g.fillRect(
      ax,
      canvasHeight - bHeight - Math.round(4 * s),
      Math.round(3 * s),
      Math.round(4 * s)
    );
  }
}
```

## Level 5 Roof (Skyscraper Spire)

```typescript
private drawLevel5Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s): void {
  const roofY = canvasHeight - bHeight;

  // Crown molding
  g.fillStyle(style.accent);
  g.fillRect(0, roofY - Math.round(4 * s), bWidth + Math.round(4 * s), Math.round(6 * s));

  // Spire base
  g.fillStyle(style.roof);
  g.fillRect(
    Math.round(bWidth / 2 - 8 * s),
    roofY - Math.round(20 * s),
    Math.round(16 * s),
    Math.round(20 * s)
  );

  // Spire point
  g.fillStyle(style.accent);
  g.fillTriangle(
    bWidth / 2, roofY - Math.round(40 * s),           // Top point
    Math.round(bWidth / 2 - 6 * s), roofY - Math.round(20 * s),  // Left base
    Math.round(bWidth / 2 + 6 * s), roofY - Math.round(20 * s)   // Right base
  );

  // Antenna
  g.fillStyle(style.accent);
  g.fillRect(
    Math.round(bWidth / 2 - 1 * s),
    roofY - Math.round(50 * s),
    Math.round(2 * s),
    Math.round(12 * s)
  );

  // Beacon light
  g.fillStyle(PALETTE.brightRed, 0.8);
  g.fillCircle(bWidth / 2, roofY - Math.round(52 * s), Math.round(3 * s));
}
```

## Window Grid Pattern

```typescript
private drawWindows(g, style, level, bWidth, bHeight, canvasHeight, s): void {
  const windowRows = level + 1;  // More rows for taller buildings
  const windowCols = 2;
  const windowW = Math.round(6 * s);
  const windowH = Math.round(8 * s);
  const startY = canvasHeight - bHeight + Math.round(12 * s);
  const rowSpacing = Math.round((bHeight - 30 * s) / windowRows);

  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      const wx = Math.round(10 * s) + col * Math.round(14 * s);
      const wy = startY + row * rowSpacing;

      // Window glow
      g.fillStyle(style.accent, 0.3);
      g.fillRect(wx - 1, wy - 1, windowW + 2, windowH + 2);

      // Window fill
      g.fillStyle(style.accent);
      g.fillRect(wx, wy, windowW, windowH);

      // Highlight corner
      g.fillStyle(lighten(style.accent, 0.4));
      g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));
    }
  }
}
```

## Door Pattern

```typescript
private drawDoor(g, style, level, bWidth, canvasHeight, s): void {
  const doorW = Math.round(8 * s);
  const doorH = Math.round(12 * s);
  const doorX = Math.round(bWidth / 2 - doorW / 2 + 2 * s);
  const doorY = canvasHeight - doorH - Math.round(2 * s);

  // Door frame
  g.fillStyle(darken(style.base, 0.3));
  g.fillRect(doorX - 1, doorY - 1, doorW + 2, doorH + 2);

  // Door fill
  g.fillStyle(PALETTE.darkBrown);
  g.fillRect(doorX, doorY, doorW, doorH);

  // Door handle
  g.fillStyle(PALETTE.gold);
  g.fillRect(doorX + doorW - Math.round(3 * s), doorY + doorH / 2, Math.round(2 * s), Math.round(2 * s));
}
```

## Style Definitions

```typescript
// Level 1 styles
const level1Styles = [
  { name: "corner_store", base: PALETTE.violet, roof: PALETTE.gold, accent: PALETTE.gold, awningColor: PALETTE.brightRed },
  { name: "taco_stand", base: PALETTE.cream, roof: PALETTE.orange, accent: PALETTE.orange, awningColor: PALETTE.brightRed },
  { name: "coffee_shop", base: PALETTE.brown, roof: PALETTE.cream, accent: PALETTE.amber, awningColor: PALETTE.darkBrown },
  { name: "arcade", base: PALETTE.night, roof: PALETTE.lavender, accent: PALETTE.cyan, awningColor: PALETTE.solanaPurple },
];

// Level 5 styles
const level5Styles = [
  { name: "bags_hq", base: PALETTE.night, roof: PALETTE.bagsGreen, accent: PALETTE.bagsGreen },
  { name: "diamond_tower", base: PALETTE.navy, roof: PALETTE.cyan, accent: PALETTE.lightBlue },
  { name: "gold_citadel", base: PALETTE.night, roof: PALETTE.gold, accent: PALETTE.amber },
  { name: "neon_megacorp", base: PALETTE.deepPurple, roof: PALETTE.solanaPurple, accent: PALETTE.lavender },
];
```

## Mansion Pattern (Complex Building)

```typescript
private generateMansion(s: number, canvasWidth: number, canvasHeight: number): void {
  const g = this.make.graphics({ x: 0, y: 0 });

  // Main building
  const mainW = Math.round(80 * s);
  const mainH = Math.round(70 * s);
  const mainX = (canvasWidth - mainW) / 2;
  const mainY = canvasHeight - mainH;

  // Foundation
  g.fillStyle(PALETTE.gray);
  g.fillRect(mainX - 5, mainY + mainH - 8, mainW + 10, 10);

  // Main walls
  g.fillStyle(PALETTE.cream);
  g.fillRect(mainX, mainY, mainW, mainH);

  // Left wing
  const wingW = 25 * s;
  const wingH = 50 * s;
  g.fillRect(mainX - wingW, mainY + mainH - wingH, wingW, wingH);

  // Right wing
  g.fillRect(mainX + mainW, mainY + mainH - wingH, wingW, wingH);

  // Columns
  g.fillStyle(PALETTE.white);
  const columnW = 6 * s;
  g.fillRect(mainX + 15 * s, mainY + 20 * s, columnW, mainH - 20 * s);
  g.fillRect(mainX + mainW - 15 * s - columnW, mainY + 20 * s, columnW, mainH - 20 * s);

  // Triangular roof/pediment
  g.fillStyle(PALETTE.gray);
  g.fillTriangle(
    mainX - 5, mainY,
    mainX + mainW / 2, mainY - 25 * s,
    mainX + mainW + 5, mainY
  );

  // Windows - grid
  g.fillStyle(PALETTE.lightBlue, 0.8);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      g.fillRect(
        mainX + 10 * s + col * 18 * s,
        mainY + 25 * s + row * 20 * s,
        12 * s, 14 * s
      );
    }
  }

  // Grand entrance door
  g.fillStyle(PALETTE.darkBrown);
  g.fillRect(mainX + mainW / 2 - 10 * s, mainY + mainH - 25 * s, 20 * s, 25 * s);

  g.generateTexture("mansion", canvasWidth, canvasHeight);
  g.destroy();
}
```

## Texture Naming Convention

```
building_{level}_{styleIndex}    // building_3_0, building_5_2
mansion_{index}                  // mansion_0, mansion_4
{zone}_{index}                   // academy_0, founders_1
{special_name}                   // pokecenter, terminal, casino
```
