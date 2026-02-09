// Scale factor for higher resolution sprites (1.6x for 1280x960 canvas)
export const SCALE = 1.6;

// ========================================
// DEPTH LAYERS — render order from back to front
// ========================================
export const DEPTH = {
  // Sky & background
  SKY: -2,
  STARS: -1,

  // Ground & base
  GROUND: 0,
  PATH: 1,
  PROPS_LOW: 2, // Trees, bushes, flowers, rocks, coral, grass
  PROPS_MID: 3, // Lamps, benches, traffic lights, chairs, torches
  PROPS_HIGH: 4, // Gates, tunnels, building sprites
  BUILDINGS: 5, // Main buildings, signs, HQ
  SIGNS_BG: 6, // Sign backgrounds, labels, billboard backdrops
  SIGNS_TEXT: 7, // Sign text, billboard titles

  // Characters & interactives
  CHARACTERS: 10, // NPCs, ticker
  TICKER: 11, // Ticker text, sparkles
  LOCAL_PLAYER: 12, // Local player, label backgrounds
  NAME_LABELS: 13, // Name labels, quest markers
  FLYING: 15, // Birds, butterflies, smoke

  // Effects
  WEATHER: 50, // Weather particles, transition overlay
  LIGHTNING: 60,

  // UI overlays (in-game)
  UI_LOW: 100, // Popups, panels, confetti
  UI_MID: 101, // Damage text, health bars
  UI_HIGH: 102, // Info text, combo bubbles
  UI_PROMPT: 150, // Interact prompts, UFO

  // Floating panels
  PANEL: 200, // Building containers, tooltips
  PANEL_TEXT: 201, // Winner text, name text

  // Top-level announcements
  ANNOUNCE_BG: 300,
  ANNOUNCE_TEXT: 301,
} as const;

// ========================================
// Y POSITIONS — critical vertical layout anchors
// All values are pre-multiplied by SCALE
// ========================================
export const Y = {
  GRASS_TOP: 455 * SCALE, // Top of grass area, where trees go
  GROUND: 540 * SCALE, // Ground layer
  PATH_LEVEL: 555 * SCALE, // Character walking height
  PATH_Y: 570 * SCALE, // Path visual layer
} as const;

// ========================================
// BAGSWORLD PIXEL ART PALETTE (32 colors)
// Cohesive retro palette for consistent visuals
// ========================================
export const PALETTE = {
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

// Skin tone palette for diversity
export const SKIN_TONES = [
  PALETTE.skinLight,
  PALETTE.skinTan,
  PALETTE.skinMedium,
  PALETTE.skinOlive,
  PALETTE.skinBrown,
  PALETTE.skinDark,
];

// Hair colors
export const HAIR_COLORS = [
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

// Shirt colors
export const SHIRT_COLORS = [
  PALETTE.bagsGreen,
  PALETTE.sky,
  PALETTE.brightRed,
  PALETTE.gold,
  PALETTE.lavender,
  0xec4899, // Pink
  PALETTE.cyan,
  PALETTE.orange,
  PALETTE.lightGray,
];

// Darken a color by a percentage (0-1)
export function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (color & 0xff) * (1 - amount));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

// Lighten a color by a percentage (0-1)
export function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * amount);
  const b = Math.min(255, (color & 0xff) + (255 - (color & 0xff)) * amount);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}
