# BagsWorld Color Palette

32-color cohesive retro palette for consistent visuals.

## PALETTE Constant

```typescript
const PALETTE = {
  // Backgrounds & Darks
  void: 0x0a0a0f, // Darkest - UI backgrounds
  night: 0x1a1a2e, // Dark blue-black
  shadow: 0x16213e, // Shadow blue

  // Grays (buildings, concrete)
  darkGray: 0x1f2937,
  gray: 0x374151,
  midGray: 0x4b5563,
  lightGray: 0x6b7280,
  silver: 0x9ca3af,

  // Greens (nature, Bags brand, success)
  darkGreen: 0x14532d,
  forest: 0x166534,
  green: 0x22c55e,
  bagsGreen: 0x4ade80, // Primary brand color
  mint: 0x86efac,

  // Blues (water, tech, corporate)
  navy: 0x1e3a8a,
  blue: 0x2563eb,
  sky: 0x3b82f6,
  lightBlue: 0x60a5fa,
  cyan: 0x06b6d4,

  // Purples (casino, premium, Solana)
  deepPurple: 0x2d1b4e,
  purple: 0x7c3aed,
  violet: 0x8b5cf6,
  lavender: 0xa855f7,
  solanaPurple: 0x9945ff,

  // Warm colors (alerts, highlights)
  darkRed: 0x991b1b,
  red: 0xdc2626,
  brightRed: 0xef4444,
  orange: 0xf97316,
  amber: 0xf59e0b,
  gold: 0xfbbf24,
  yellow: 0xfde047,

  // Skin tones
  skinLight: 0xffdbac,
  skinTan: 0xf1c27d,
  skinMedium: 0xe0ac69,
  skinOlive: 0xc68642,
  skinBrown: 0x8d5524,
  skinDark: 0x5c3317,

  // Utility
  white: 0xffffff,
  cream: 0xfef3c7,
  brown: 0x78350f,
  darkBrown: 0x451a03,
};
```

## Skin Tones Array

```typescript
const SKIN_TONES = [
  PALETTE.skinLight, // 0xffdbac
  PALETTE.skinTan, // 0xf1c27d
  PALETTE.skinMedium, // 0xe0ac69
  PALETTE.skinOlive, // 0xc68642
  PALETTE.skinBrown, // 0x8d5524
  PALETTE.skinDark, // 0x5c3317
];
```

## Hair Colors Array

```typescript
const HAIR_COLORS = [
  0x090806, // Black
  0x2c1810, // Dark brown
  0x6a4e42, // Brown
  0xb55239, // Auburn
  0xd6c4c2, // Blonde
  0xe5e5e5, // White/Gray
  0xff6b6b, // Pink (dyed)
  0x4ecdc4, // Teal (dyed)
  PALETTE.lavender, // Purple (dyed)
];
```

## Shirt Colors Array

```typescript
const SHIRT_COLORS = [
  PALETTE.bagsGreen, // 0x4ade80
  PALETTE.sky, // 0x3b82f6
  PALETTE.brightRed, // 0xef4444
  PALETTE.gold, // 0xfbbf24
  PALETTE.lavender, // 0xa855f7
  0xec4899, // Pink
  PALETTE.cyan, // 0x06b6d4
  PALETTE.orange, // 0xf97316
  PALETTE.lightGray, // 0x6b7280
];
```

## Zone Color Themes

| Zone                | Primary        | Secondary    | Accent          |
| ------------------- | -------------- | ------------ | --------------- |
| Park (main_city)    | forest, green  | brown, cream | gold, brightRed |
| BagsCity (trending) | darkGray, gray | navy, cyan   | bagsGreen, gold |
| Ballers Valley      | cream, white   | gold, amber  | deepPurple      |
| Founders Corner     | brown, cream   | forest       | amber, gold     |

## Color Helper Functions

```typescript
// Darken a color by percentage (0-1)
function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (color & 0xff) * (1 - amount));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

// Lighten a color by percentage (0-1)
function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * amount);
  const b = Math.min(255, (color & 0xff) + (255 - (color & 0xff)) * amount);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}
```

## Usage Examples

```typescript
// 3D depth effect
g.fillStyle(PALETTE.gray); // Base
g.fillStyle(lighten(PALETTE.gray, 0.2)); // Left highlight
g.fillStyle(darken(PALETTE.gray, 0.25)); // Right shadow

// Window glow
g.fillStyle(PALETTE.gold, 0.3); // Glow aura
g.fillStyle(PALETTE.gold); // Window fill
g.fillStyle(lighten(PALETTE.gold, 0.4)); // Highlight

// Drop shadow
g.fillStyle(PALETTE.void, 0.5); // Semi-transparent black
```
