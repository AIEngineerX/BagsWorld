import * as Phaser from "phaser";

// Scale factor for higher resolution sprites (1.6x for 1280x960 canvas)
const SCALE = 1.6;

// ========================================
// BAGSWORLD PIXEL ART PALETTE (32 colors)
// Cohesive retro palette for consistent visuals
// ========================================
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

// Skin tone palette for diversity
const SKIN_TONES = [
  PALETTE.skinLight,
  PALETTE.skinTan,
  PALETTE.skinMedium,
  PALETTE.skinOlive,
  PALETTE.skinBrown,
  PALETTE.skinDark,
];

// Hair colors
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

// Shirt colors
const SHIRT_COLORS = [
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

// ========================================
// PIXEL ART HELPER FUNCTIONS
// ========================================

// Darken a color by a percentage (0-1)
function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (color & 0xff) * (1 - amount));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

// Lighten a color by a percentage (0-1)
function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * amount);
  const b = Math.min(255, (color & 0xff) + (255 - (color & 0xff)) * amount);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create stylish loading screen (solid color to prevent flash)
    const loadingBg = this.add.graphics();
    loadingBg.fillStyle(0x0a0a0f, 1);
    loadingBg.fillRect(0, 0, width, height);

    // Logo text
    const logoText = this.add.text(width / 2, height / 2 - 80, "BAGSWORLD", {
      fontFamily: "monospace",
      fontSize: "32px",
      color: "#4ade80",
    });
    logoText.setOrigin(0.5, 0.5);

    // Subtitle
    const subText = this.add.text(width / 2, height / 2 - 45, "A Living Crypto World", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#6b7280",
    });
    subText.setOrigin(0.5, 0.5);

    // Progress bar container
    const progressBox = this.add.graphics();
    progressBox.lineStyle(2, 0x4ade80, 1);
    progressBox.strokeRect(width / 2 - 150, height / 2, 300, 20);

    const progressBar = this.add.graphics();

    // Loading text
    const loadingText = this.add.text(width / 2, height / 2 + 40, "Generating world...", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#4ade80",
    });
    loadingText.setOrigin(0.5, 0.5);

    // Progress events
    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4ade80, 1);
      progressBar.fillRect(width / 2 - 148, height / 2 + 2, 296 * value, 16);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      logoText.destroy();
      subText.destroy();
      loadingBg.destroy();
    });

    this.generatePlaceholderAssets();
  }

  create(): void {
    this.scene.start("WorldScene");
    this.scene.start("UIScene");
  }

  private generatePlaceholderAssets(): void {
    // Generate enhanced grass with flowers
    this.generateGrass();

    // Generate path tiles
    this.generatePath();

    // Generate diverse buildings (levels 1-5)
    this.generateBuildings();

    // Generate special buildings
    this.generatePokeCenter();
    this.generateTradingGym();
    this.generateCasino();
    this.generateTradingTerminal();
    this.generateBagsWorldHQ();

    // Generate Ballers Valley mansions (for top BagsWorld token holders)
    this.generateMansions();

    // Generate Academy zone buildings (Hogwarts-style campus)
    this.generateAcademyBuildings();

    // Generate diverse character variants
    this.generateDiverseCharacters();

    // Generate weather particles
    this.generateWeatherAssets();

    // Generate UI elements
    this.generateUIAssets();

    // Generate trees and decorations
    this.generateDecorations();

    // Generate animals
    this.generateAnimals();

    // Generate extra decorations (flowers, rocks, fountain, etc.)
    this.generateExtraDecorations();

    // Generate ambient particles
    this.generateAmbientParticles();

    // Generate Launch Pad zone assets (NYC Times Square style)
    this.generateLaunchPadAssets();
  }

  private generateGrass(): void {
    const size = Math.round(32 * SCALE);
    const grassGraphics = this.make.graphics({ x: 0, y: 0 });

    // Base grass
    grassGraphics.fillStyle(0x1a472a);
    grassGraphics.fillRect(0, 0, size, size);

    // Grass variation - more blades for higher resolution
    grassGraphics.fillStyle(0x2d5a3d);
    const bladeCount = Math.round(12 * SCALE);
    for (let i = 0; i < bladeCount; i++) {
      const x = Math.floor(Math.random() * (size - 4));
      const y = Math.floor(Math.random() * (size - 6));
      grassGraphics.fillRect(x, y, Math.round(2 * SCALE), Math.round(4 * SCALE));
    }

    // Occasional flowers
    grassGraphics.fillStyle(0xfbbf24);
    grassGraphics.fillRect(
      Math.round(8 * SCALE),
      Math.round(12 * SCALE),
      Math.round(3 * SCALE),
      Math.round(3 * SCALE)
    );
    grassGraphics.fillStyle(0xef4444);
    grassGraphics.fillRect(
      Math.round(20 * SCALE),
      Math.round(8 * SCALE),
      Math.round(3 * SCALE),
      Math.round(3 * SCALE)
    );

    grassGraphics.generateTexture("grass", size, size);
    grassGraphics.destroy();

    // Dark grass variant
    const darkGrass = this.make.graphics({ x: 0, y: 0 });
    darkGrass.fillStyle(0x14532d);
    darkGrass.fillRect(0, 0, size, size);
    darkGrass.fillStyle(0x1a472a);
    for (let i = 0; i < Math.round(8 * SCALE); i++) {
      const x = Math.floor(Math.random() * (size - 5));
      const y = Math.floor(Math.random() * (size - 5));
      darkGrass.fillRect(x, y, Math.round(3 * SCALE), Math.round(3 * SCALE));
    }
    darkGrass.generateTexture("grass_dark", size, size);
    darkGrass.destroy();
  }

  private generatePath(): void {
    const size = Math.round(32 * SCALE);
    const pathGraphics = this.make.graphics({ x: 0, y: 0 });
    pathGraphics.fillStyle(0x78716c);
    pathGraphics.fillRect(0, 0, size, size);
    pathGraphics.fillStyle(0x57534e);
    for (let i = 0; i < Math.round(6 * SCALE); i++) {
      const x = Math.floor(Math.random() * (size - 10));
      const y = Math.floor(Math.random() * (size - 10));
      pathGraphics.fillRect(x, y, Math.round(6 * SCALE), Math.round(6 * SCALE));
    }
    pathGraphics.generateTexture("path", size, size);
    pathGraphics.destroy();
  }

  private generateBuildings(): void {
    // Building style packs - 4 unique styles per level for visual diversity
    // Each token gets a deterministic style based on its mint address
    const s = SCALE;

    // Level 1: Small Shops (<$100K market cap)
    const level1Styles = [
      {
        name: "corner_store",
        base: PALETTE.violet,
        roof: PALETTE.gold,
        accent: PALETTE.gold,
        awningColor: PALETTE.brightRed,
      },
      {
        name: "taco_stand",
        base: PALETTE.cream,
        roof: PALETTE.orange,
        accent: PALETTE.orange,
        awningColor: PALETTE.brightRed,
      },
      {
        name: "coffee_shop",
        base: PALETTE.brown,
        roof: PALETTE.cream,
        accent: PALETTE.amber,
        awningColor: PALETTE.darkBrown,
      },
      {
        name: "arcade",
        base: PALETTE.night,
        roof: PALETTE.lavender,
        accent: PALETTE.cyan,
        awningColor: PALETTE.solanaPurple,
      },
    ];

    // Level 2: Office Buildings ($100K-$500K)
    const level2Styles = [
      { name: "tech_startup", base: PALETTE.sky, roof: PALETTE.navy, accent: PALETTE.lightBlue },
      { name: "law_office", base: PALETTE.gray, roof: PALETTE.darkGray, accent: PALETTE.silver },
      { name: "coworking", base: PALETTE.cream, roof: PALETTE.orange, accent: PALETTE.amber },
      {
        name: "design_studio",
        base: PALETTE.lavender,
        roof: PALETTE.deepPurple,
        accent: PALETTE.violet,
      },
    ];

    // Level 3: Corporate Buildings ($500K-$2M)
    const level3Styles = [
      {
        name: "corporate_hq",
        base: PALETTE.gray,
        roof: PALETTE.bagsGreen,
        accent: PALETTE.bagsGreen,
      },
      { name: "bank", base: PALETTE.cream, roof: PALETTE.gold, accent: PALETTE.amber },
      { name: "media_tower", base: PALETTE.sky, roof: PALETTE.navy, accent: PALETTE.cyan },
      { name: "pharma_lab", base: PALETTE.white, roof: PALETTE.cyan, accent: PALETTE.lightBlue },
    ];

    // Level 4: Towers ($2M-$10M)
    const level4Styles = [
      { name: "modern_tower", base: PALETTE.navy, roof: PALETTE.lightBlue, accent: PALETTE.gold },
      { name: "art_deco", base: PALETTE.night, roof: PALETTE.gold, accent: PALETTE.amber },
      { name: "glass_spire", base: PALETTE.sky, roof: PALETTE.cyan, accent: PALETTE.white },
      {
        name: "tech_campus",
        base: PALETTE.darkGreen,
        roof: PALETTE.bagsGreen,
        accent: PALETTE.mint,
      },
    ];

    // Level 5: Skyscrapers ($10M+)
    const level5Styles = [
      { name: "bags_hq", base: PALETTE.night, roof: PALETTE.bagsGreen, accent: PALETTE.bagsGreen },
      { name: "diamond_tower", base: PALETTE.navy, roof: PALETTE.cyan, accent: PALETTE.lightBlue },
      { name: "gold_citadel", base: PALETTE.night, roof: PALETTE.gold, accent: PALETTE.amber },
      {
        name: "neon_megacorp",
        base: PALETTE.deepPurple,
        roof: PALETTE.solanaPurple,
        accent: PALETTE.lavender,
      },
    ];

    const allLevelStyles = [level1Styles, level2Styles, level3Styles, level4Styles, level5Styles];
    const levelDimensions = [
      { height: Math.round(40 * s), width: Math.round(30 * s) }, // Level 1
      { height: Math.round(55 * s), width: Math.round(34 * s) }, // Level 2
      { height: Math.round(75 * s), width: Math.round(38 * s) }, // Level 3
      { height: Math.round(100 * s), width: Math.round(42 * s) }, // Level 4
      { height: Math.round(130 * s), width: Math.round(48 * s) }, // Level 5
    ];

    for (let level = 1; level <= 5; level++) {
      const styles = allLevelStyles[level - 1];
      const dims = levelDimensions[level - 1];

      for (let styleIndex = 0; styleIndex < styles.length; styleIndex++) {
        const style = styles[styleIndex];
        const g = this.make.graphics({ x: 0, y: 0 });
        const bHeight = dims.height;
        const bWidth = dims.width;
        const canvasHeight = Math.round(190 * s);
        const canvasWidth = Math.round(55 * s);

        // Drop shadow
        g.fillStyle(PALETTE.void, 0.5);
        g.fillRect(
          Math.round(6 * s),
          canvasHeight - bHeight + Math.round(6 * s),
          bWidth - Math.round(2 * s),
          bHeight
        );

        // Building base
        g.fillStyle(style.base);
        g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

        // Highlight left edge
        g.fillStyle(lighten(style.base, 0.2));
        g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

        // Shadow right edge
        g.fillStyle(darken(style.base, 0.25));
        g.fillRect(bWidth - Math.round(6 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

        // Dithering pattern for texture
        g.fillStyle(darken(style.base, 0.08));
        for (let py = 0; py < bHeight; py += Math.round(4 * s)) {
          for (
            let px = Math.round(10 * s);
            px < bWidth - Math.round(10 * s);
            px += Math.round(8 * s)
          ) {
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

        // Level-specific decorations
        if (level === 1) {
          this.drawLevel1Roof(g, style, bWidth, bHeight, canvasHeight, s);
        } else if (level === 2) {
          this.drawLevel2Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
        } else if (level === 3) {
          this.drawLevel3Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
        } else if (level === 4) {
          this.drawLevel4Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
        } else if (level === 5) {
          this.drawLevel5Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
        }

        // Windows
        this.drawWindows(g, style, level, bWidth, bHeight, canvasHeight, s);

        // Door
        this.drawDoor(g, style, level, bWidth, canvasHeight, s);

        g.generateTexture(`building_${level}_${styleIndex}`, canvasWidth, canvasHeight);
        g.destroy();
      }
    }
  }

  private drawLevel1Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    const awningColor = style.awningColor || PALETTE.brightRed;

    // Awning roof
    g.fillStyle(style.roof);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(6 * s),
      bWidth + Math.round(4 * s),
      Math.round(8 * s)
    );
    g.fillStyle(lighten(style.roof, 0.15));
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(6 * s),
      bWidth + Math.round(4 * s),
      Math.round(2 * s)
    );

    // Awning stripes
    g.fillStyle(awningColor);
    for (let i = 0; i < bWidth; i += Math.round(8 * s)) {
      g.fillRect(
        i,
        canvasHeight - bHeight - Math.round(5 * s),
        Math.round(4 * s),
        Math.round(6 * s)
      );
    }

    // Shop sign
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight + Math.round(4 * s),
      bWidth - Math.round(12 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.accent);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight + Math.round(5 * s),
      bWidth - Math.round(16 * s),
      Math.round(6 * s)
    );
  }

  private drawLevel2Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    styleIndex: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    // Flat roof base
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(4 * s),
      bWidth,
      Math.round(6 * s)
    );
    g.fillStyle(lighten(style.roof, 0.2));
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(4 * s),
      bWidth,
      Math.round(2 * s)
    );

    // Style-specific roof details
    if (styleIndex === 0) {
      // Tech startup - satellite dish
      g.fillStyle(PALETTE.lightGray);
      g.fillCircle(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(8 * s),
        Math.round(5 * s)
      );
      g.fillStyle(PALETTE.silver);
      g.fillCircle(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(8 * s),
        Math.round(3 * s)
      );
    } else if (styleIndex === 1) {
      // Law office - brick chimney
      g.fillStyle(PALETTE.darkRed);
      g.fillRect(
        bWidth - Math.round(10 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        Math.round(6 * s),
        Math.round(10 * s)
      );
      g.fillStyle(lighten(PALETTE.darkRed, 0.15));
      g.fillRect(
        bWidth - Math.round(10 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        Math.round(2 * s),
        Math.round(10 * s)
      );
    } else if (styleIndex === 2) {
      // Coworking - rooftop garden
      g.fillStyle(PALETTE.forest);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(8 * s),
        Math.round(10 * s),
        Math.round(5 * s)
      );
      g.fillStyle(PALETTE.bagsGreen);
      g.fillCircle(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        Math.round(3 * s)
      );
      g.fillCircle(
        Math.round(14 * s),
        canvasHeight - bHeight - Math.round(9 * s),
        Math.round(2 * s)
      );
    } else {
      // Design studio - colorful skylights
      g.fillStyle(PALETTE.cyan);
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(6 * s),
        Math.round(4 * s),
        Math.round(3 * s)
      );
      g.fillStyle(PALETTE.lavender);
      g.fillRect(
        Math.round(14 * s),
        canvasHeight - bHeight - Math.round(6 * s),
        Math.round(4 * s),
        Math.round(3 * s)
      );
      g.fillStyle(PALETTE.amber);
      g.fillRect(
        Math.round(20 * s),
        canvasHeight - bHeight - Math.round(6 * s),
        Math.round(4 * s),
        Math.round(3 * s)
      );
    }
  }

  private drawLevel3Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    styleIndex: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    // Base roof
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(8 * s),
      bWidth,
      Math.round(10 * s)
    );
    g.fillStyle(lighten(style.roof, 0.15));
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(8 * s),
      bWidth,
      Math.round(3 * s)
    );

    if (styleIndex === 0) {
      // Corporate HQ - helipad
      g.fillStyle(style.accent);
      g.fillRect(
        bWidth / 2 - Math.round(6 * s),
        canvasHeight - bHeight - Math.round(14 * s),
        Math.round(16 * s),
        Math.round(8 * s)
      );
      g.fillStyle(PALETTE.white);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(4 * s),
        Math.round(6 * s)
      );
      g.fillStyle(style.roof);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(4 * s),
        Math.round(4 * s)
      );
    } else if (styleIndex === 1) {
      // Bank - columns and dome
      g.fillStyle(PALETTE.gold);
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(16 * s),
        bWidth - Math.round(12 * s),
        Math.round(10 * s)
      );
      g.fillStyle(lighten(PALETTE.gold, 0.2));
      g.fillTriangle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(22 * s),
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(14 * s),
        bWidth - Math.round(4 * s),
        canvasHeight - bHeight - Math.round(14 * s)
      );
    } else if (styleIndex === 2) {
      // Media tower - antenna array
      g.fillStyle(PALETTE.silver);
      g.fillRect(
        bWidth / 2 - Math.round(1 * s),
        canvasHeight - bHeight - Math.round(20 * s),
        Math.round(3 * s),
        Math.round(14 * s)
      );
      g.fillRect(
        bWidth / 2 - Math.round(6 * s),
        canvasHeight - bHeight - Math.round(14 * s),
        Math.round(2 * s),
        Math.round(8 * s)
      );
      g.fillRect(
        bWidth / 2 + Math.round(5 * s),
        canvasHeight - bHeight - Math.round(14 * s),
        Math.round(2 * s),
        Math.round(8 * s)
      );
      g.fillStyle(PALETTE.brightRed);
      g.fillCircle(bWidth / 2, canvasHeight - bHeight - Math.round(21 * s), Math.round(2 * s));
    } else {
      // Pharma lab - clean dome
      g.fillStyle(PALETTE.white);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        Math.round(10 * s)
      );
      g.fillStyle(style.accent);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        Math.round(6 * s)
      );
      g.fillStyle(lighten(PALETTE.white, 0.3));
      g.fillCircle(
        bWidth / 2 - Math.round(2 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        Math.round(3 * s)
      );
    }
  }

  private drawLevel4Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    styleIndex: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    if (styleIndex === 0) {
      // Modern tower - stepped
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        bWidth - Math.round(8 * s),
        Math.round(12 * s)
      );
      g.fillRect(
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(18 * s),
        bWidth - Math.round(16 * s),
        Math.round(10 * s)
      );
      g.fillRect(
        Math.round(14 * s),
        canvasHeight - bHeight - Math.round(24 * s),
        bWidth - Math.round(24 * s),
        Math.round(8 * s)
      );
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        bWidth - Math.round(8 * s),
        Math.round(2 * s)
      );
      g.fillRect(
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(18 * s),
        bWidth - Math.round(16 * s),
        Math.round(2 * s)
      );
      // Antenna
      g.fillStyle(PALETTE.silver);
      g.fillRect(
        bWidth / 2,
        canvasHeight - bHeight - Math.round(32 * s),
        Math.round(2 * s),
        Math.round(12 * s)
      );
      g.fillStyle(PALETTE.brightRed);
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(34 * s),
        Math.round(2 * s)
      );
    } else if (styleIndex === 1) {
      // Art deco - ornate crown
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(4 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        bWidth - Math.round(4 * s),
        Math.round(14 * s)
      );
      g.fillStyle(style.accent);
      // Deco spires
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(22 * s),
        Math.round(4 * s),
        Math.round(12 * s)
      );
      g.fillRect(
        bWidth / 2 - Math.round(2 * s),
        canvasHeight - bHeight - Math.round(28 * s),
        Math.round(6 * s),
        Math.round(18 * s)
      );
      g.fillRect(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(22 * s),
        Math.round(4 * s),
        Math.round(12 * s)
      );
      g.fillStyle(lighten(style.accent, 0.3));
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(4 * s)
      );
    } else if (styleIndex === 2) {
      // Glass spire - pointed
      g.fillStyle(style.roof);
      g.fillTriangle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(35 * s),
        Math.round(8 * s),
        canvasHeight - bHeight,
        bWidth - Math.round(4 * s),
        canvasHeight - bHeight
      );
      g.fillStyle(lighten(style.roof, 0.3));
      g.fillTriangle(
        bWidth / 2,
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(5 * s),
        bWidth / 2,
        canvasHeight - bHeight - Math.round(5 * s)
      );
      g.fillStyle(style.accent);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(36 * s),
        Math.round(3 * s)
      );
    } else {
      // Tech campus - green roof
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(4 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        bWidth - Math.round(4 * s),
        Math.round(12 * s)
      );
      // Solar panels
      g.fillStyle(PALETTE.navy);
      for (let i = 0; i < 3; i++) {
        g.fillRect(
          Math.round((8 + i * 10) * s),
          canvasHeight - bHeight - Math.round(16 * s),
          Math.round(8 * s),
          Math.round(6 * s)
        );
        g.fillStyle(lighten(PALETTE.navy, 0.2));
        g.fillRect(
          Math.round((8 + i * 10) * s),
          canvasHeight - bHeight - Math.round(16 * s),
          Math.round(8 * s),
          Math.round(1 * s)
        );
        g.fillStyle(PALETTE.navy);
      }
      // Green area
      g.fillStyle(PALETTE.forest);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(8 * s),
        Math.round(6 * s),
        Math.round(4 * s)
      );
    }
  }

  private drawLevel5Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    styleIndex: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    if (styleIndex === 0) {
      // Bags HQ - grand spire
      g.fillStyle(style.roof);
      g.fillTriangle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(8 * s),
        canvasHeight - bHeight,
        bWidth - Math.round(4 * s),
        canvasHeight - bHeight
      );
      g.fillStyle(lighten(style.roof, 0.25));
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(5 * s),
        Math.round(10 * s),
        Math.round(5 * s)
      );
      g.fillStyle(style.accent);
      g.fillRect(
        bWidth / 2 - Math.round(1 * s),
        canvasHeight - bHeight - Math.round(45 * s),
        Math.round(6 * s),
        Math.round(20 * s)
      );
      g.fillStyle(PALETTE.gold);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(48 * s),
        Math.round(4 * s)
      );
      g.fillStyle(lighten(PALETTE.gold, 0.3));
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(49 * s),
        Math.round(2 * s)
      );
      g.fillStyle(PALETTE.brightRed);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(50 * s),
        Math.round(2 * s)
      );
      // Side spires
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(15 * s),
        Math.round(4 * s),
        Math.round(18 * s)
      );
      g.fillRect(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(15 * s),
        Math.round(4 * s),
        Math.round(18 * s)
      );
    } else if (styleIndex === 1) {
      // Diamond tower - crystal top
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(15 * s),
        bWidth - Math.round(8 * s),
        Math.round(17 * s)
      );
      // Crystal spire
      g.fillStyle(style.accent);
      g.fillTriangle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(45 * s),
        Math.round(12 * s),
        canvasHeight - bHeight - Math.round(15 * s),
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(15 * s)
      );
      g.fillStyle(lighten(style.accent, 0.4));
      g.fillTriangle(
        bWidth / 2,
        canvasHeight - bHeight - Math.round(40 * s),
        Math.round(14 * s),
        canvasHeight - bHeight - Math.round(18 * s),
        bWidth / 2,
        canvasHeight - bHeight - Math.round(18 * s)
      );
      // Diamond gem
      g.fillStyle(PALETTE.white);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(47 * s),
        Math.round(5 * s)
      );
      g.fillStyle(style.accent);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(47 * s),
        Math.round(3 * s)
      );
    } else if (styleIndex === 2) {
      // Gold citadel - crown
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(4 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        bWidth - Math.round(4 * s),
        Math.round(14 * s)
      );
      // Crown spires
      g.fillStyle(style.accent);
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(4 * s),
        Math.round(20 * s)
      );
      g.fillRect(
        bWidth / 2 - Math.round(2 * s),
        canvasHeight - bHeight - Math.round(40 * s),
        Math.round(6 * s),
        Math.round(30 * s)
      );
      g.fillRect(
        bWidth - Math.round(10 * s),
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(4 * s),
        Math.round(20 * s)
      );
      // Gold orbs
      g.fillStyle(PALETTE.gold);
      g.fillCircle(
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(32 * s),
        Math.round(3 * s)
      );
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(43 * s),
        Math.round(4 * s)
      );
      g.fillCircle(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(32 * s),
        Math.round(3 * s)
      );
    } else {
      // Neon megacorp - holographic
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        bWidth - Math.round(8 * s),
        Math.round(12 * s)
      );
      g.fillRect(
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(20 * s),
        bWidth - Math.round(16 * s),
        Math.round(12 * s)
      );
      // Neon spire
      g.fillStyle(style.accent);
      g.fillRect(
        bWidth / 2 - Math.round(3 * s),
        canvasHeight - bHeight - Math.round(45 * s),
        Math.round(8 * s),
        Math.round(28 * s)
      );
      // Holographic ring
      g.fillStyle(PALETTE.cyan, 0.6);
      g.strokeCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(35 * s),
        Math.round(10 * s)
      );
      g.fillStyle(PALETTE.lavender, 0.4);
      g.strokeCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(35 * s),
        Math.round(7 * s)
      );
      // Beacon
      g.fillStyle(PALETTE.cyan);
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(47 * s),
        Math.round(4 * s)
      );
      g.fillStyle(PALETTE.white);
      g.fillCircle(bWidth / 2, canvasHeight - bHeight - Math.round(48 * s), Math.round(2 * s));
    }
  }

  private drawWindows(
    g: Phaser.GameObjects.Graphics,
    style: any,
    level: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    const windowRows = level === 1 ? 2 : level === 2 ? 3 : level === 3 ? 4 : level === 4 ? 6 : 8;
    const windowCols = level >= 4 ? 4 : level >= 2 ? 3 : 2;
    const windowWidth = Math.round((level >= 4 ? 5 : 6) * s);
    const windowHeight = Math.round((level >= 4 ? 6 : 5) * s);
    const startY = canvasHeight - bHeight + Math.round((level === 1 ? 18 : 12) * s);
    const windowSpacingY = Math.round((level >= 4 ? 11 : 12) * s);
    const windowGap = Math.round(4 * s);

    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        const totalWindowWidth = windowCols * windowWidth + (windowCols - 1) * windowGap;
        const startX = (bWidth - totalWindowWidth) / 2 + Math.round(2 * s);
        const wx = startX + col * (windowWidth + windowGap);
        const wy = startY + row * windowSpacingY;

        if (level <= 2 && row === windowRows - 1 && col === Math.floor(windowCols / 2)) continue;

        g.fillStyle(style.accent, 0.25);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          windowWidth + Math.round(2 * s),
          windowHeight + Math.round(2 * s)
        );
        g.fillStyle(style.accent);
        g.fillRect(wx, wy, windowWidth, windowHeight);
        g.fillStyle(lighten(style.accent, 0.35));
        g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));

        if (level >= 3) {
          g.fillStyle(darken(style.base, 0.2));
          g.fillRect(wx + windowWidth / 2 - Math.round(1 * s), wy, Math.round(1 * s), windowHeight);
          g.fillRect(wx, wy + windowHeight / 2, windowWidth, Math.round(1 * s));
        }
      }
    }
  }

  private drawDoor(
    g: Phaser.GameObjects.Graphics,
    style: any,
    level: number,
    bWidth: number,
    canvasHeight: number,
    s: number
  ): void {
    const doorWidth = Math.round((level === 1 ? 12 : level >= 4 ? 14 : 10) * s);
    const doorHeight = Math.round((level >= 4 ? 16 : 12) * s);
    const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

    if (level === 5) {
      g.fillStyle(PALETTE.gray);
      g.fillRect(
        doorX - Math.round(6 * s),
        canvasHeight - doorHeight - Math.round(4 * s),
        Math.round(4 * s),
        doorHeight + Math.round(4 * s)
      );
      g.fillRect(
        doorX + doorWidth + Math.round(2 * s),
        canvasHeight - doorHeight - Math.round(4 * s),
        Math.round(4 * s),
        doorHeight + Math.round(4 * s)
      );
      g.fillStyle(lighten(PALETTE.gray, 0.2));
      g.fillRect(
        doorX - Math.round(6 * s),
        canvasHeight - doorHeight - Math.round(4 * s),
        Math.round(1 * s),
        doorHeight + Math.round(4 * s)
      );
      g.fillStyle(style.accent);
      g.fillRect(
        doorX - Math.round(8 * s),
        canvasHeight - doorHeight - Math.round(8 * s),
        doorWidth + Math.round(16 * s),
        Math.round(6 * s)
      );
      g.fillStyle(lighten(style.accent, 0.2));
      g.fillRect(
        doorX - Math.round(8 * s),
        canvasHeight - doorHeight - Math.round(8 * s),
        doorWidth + Math.round(16 * s),
        Math.round(2 * s)
      );
    }

    g.fillStyle(PALETTE.darkGray);
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

    const doorColor = level >= 3 ? PALETTE.gray : PALETTE.brown;
    g.fillStyle(doorColor);
    g.fillRect(
      doorX + Math.round(1 * s),
      canvasHeight - doorHeight + Math.round(1 * s),
      doorWidth - Math.round(2 * s),
      doorHeight - Math.round(1 * s)
    );
    g.fillStyle(lighten(doorColor, 0.15));
    g.fillRect(
      doorX + Math.round(1 * s),
      canvasHeight - doorHeight + Math.round(1 * s),
      Math.round(2 * s),
      doorHeight - Math.round(1 * s)
    );
    g.fillStyle(style.accent);
    g.fillRect(
      doorX + doorWidth - Math.round(4 * s),
      canvasHeight - doorHeight / 2 - Math.round(1 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );

    if (level >= 3) {
      g.fillStyle(PALETTE.darkGray);
      g.fillRect(
        doorX - Math.round(6 * s),
        canvasHeight - doorHeight - Math.round(12 * s),
        doorWidth + Math.round(12 * s),
        Math.round(8 * s)
      );
      g.fillStyle(style.accent);
      g.fillRect(
        doorX - Math.round(4 * s),
        canvasHeight - doorHeight - Math.round(11 * s),
        doorWidth + Math.round(8 * s),
        Math.round(6 * s)
      );
      g.fillStyle(lighten(style.accent, 0.25));
      g.fillRect(
        doorX - Math.round(4 * s),
        canvasHeight - doorHeight - Math.round(11 * s),
        doorWidth + Math.round(8 * s),
        Math.round(2 * s)
      );
    }
  }

  private generatePokeCenter(): void {
    // PokeCenter - Pokemon Center style building (red roof, white base)
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = Math.round(140 * s);
    const canvasWidth = Math.round(55 * s);
    const bHeight = Math.round(85 * s);
    const bWidth = Math.round(50 * s);

    // Shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight + Math.round(6 * s),
      bWidth - Math.round(2 * s),
      bHeight
    );

    // Building base (white/cream)
    g.fillStyle(PALETTE.cream);
    g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

    // Highlight left side
    g.fillStyle(lighten(PALETTE.cream, 0.15));
    g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

    // Shadow right side
    g.fillStyle(darken(PALETTE.cream, 0.1));
    g.fillRect(bWidth - Math.round(6 * s), canvasHeight - bHeight, Math.round(4 * s), bHeight);

    // Red roof - iconic PokeCenter style with shading
    g.fillStyle(PALETTE.red);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(8 * s),
      bWidth + Math.round(4 * s),
      Math.round(12 * s)
    );
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(6 * s),
      bWidth,
      Math.round(8 * s)
    );
    // Roof highlight
    g.fillStyle(lighten(PALETTE.brightRed, 0.2));
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(6 * s),
      bWidth,
      Math.round(2 * s)
    );

    // Roof peak/overhang with shading
    g.fillStyle(PALETTE.darkRed);
    g.fillRect(
      bWidth / 2 - Math.round(8 * s),
      canvasHeight - bHeight - Math.round(16 * s),
      Math.round(20 * s),
      Math.round(10 * s)
    );
    g.fillStyle(PALETTE.red);
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      canvasHeight - bHeight - Math.round(14 * s),
      Math.round(16 * s),
      Math.round(6 * s)
    );
    // Peak highlight
    g.fillStyle(lighten(PALETTE.red, 0.15));
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      canvasHeight - bHeight - Math.round(14 * s),
      Math.round(16 * s),
      Math.round(2 * s)
    );

    // Pokeball logo on roof peak
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      Math.round(6 * s)
    );
    g.fillStyle(PALETTE.red);
    g.fillRect(
      bWidth / 2 - Math.round(4 * s),
      canvasHeight - bHeight - Math.round(16 * s),
      Math.round(12 * s),
      Math.round(6 * s)
    );
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      bWidth / 2 - Math.round(4 * s),
      canvasHeight - bHeight - Math.round(11 * s),
      Math.round(12 * s),
      Math.round(2 * s)
    );
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      Math.round(3 * s)
    );
    g.fillStyle(PALETTE.darkGray);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      Math.round(1.5 * s)
    );

    // Windows (2 rows, 3 columns)
    const windowColor = PALETTE.lightBlue;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const wx = Math.round(10 * s) + col * Math.round(12 * s);
        const wy = canvasHeight - bHeight + Math.round(15 * s) + row * Math.round(18 * s);

        // Window glow
        g.fillStyle(windowColor, 0.25);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          Math.round(9 * s),
          Math.round(11 * s)
        );

        // Window
        g.fillStyle(windowColor);
        g.fillRect(wx, wy, Math.round(8 * s), Math.round(10 * s));

        // Window highlight
        g.fillStyle(lighten(windowColor, 0.3));
        g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));

        // Window frame
        g.fillStyle(PALETTE.cream);
        g.fillRect(wx + Math.round(3 * s), wy, Math.round(2 * s), Math.round(10 * s));
        g.fillRect(wx, wy + Math.round(4 * s), Math.round(8 * s), Math.round(2 * s));
      }
    }

    // Red cross/plus sign (healing center)
    g.fillStyle(PALETTE.red);
    g.fillRect(
      bWidth / 2 - Math.round(1 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      Math.round(6 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight + Math.round(6 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );

    // Door - automatic sliding doors
    const doorWidth = Math.round(16 * s);
    const doorHeight = Math.round(20 * s);
    const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

    // Door frame with shading
    g.fillStyle(PALETTE.red);
    g.fillRect(
      doorX - Math.round(2 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      doorWidth + Math.round(4 * s),
      doorHeight + Math.round(4 * s)
    );
    g.fillStyle(lighten(PALETTE.red, 0.15));
    g.fillRect(
      doorX - Math.round(2 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      Math.round(2 * s),
      doorHeight + Math.round(4 * s)
    );

    // Glass doors
    g.fillStyle(PALETTE.lightBlue);
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);
    // Glass reflection
    g.fillStyle(lighten(PALETTE.lightBlue, 0.3));
    g.fillRect(
      doorX + Math.round(2 * s),
      canvasHeight - doorHeight + Math.round(2 * s),
      Math.round(4 * s),
      Math.round(6 * s)
    );

    // Door divider
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      doorX + doorWidth / 2 - Math.round(1 * s),
      canvasHeight - doorHeight,
      Math.round(2 * s),
      doorHeight
    );

    // Welcome mat
    g.fillStyle(PALETTE.red);
    g.fillRect(
      doorX - Math.round(4 * s),
      canvasHeight - Math.round(2 * s),
      doorWidth + Math.round(8 * s),
      Math.round(2 * s)
    );

    // "P" sign above door
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      doorX + Math.round(2 * s),
      canvasHeight - doorHeight - Math.round(10 * s),
      doorWidth - Math.round(4 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.white);
    g.fillRect(
      doorX + Math.round(5 * s),
      canvasHeight - doorHeight - Math.round(9 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      doorX + Math.round(5 * s),
      canvasHeight - doorHeight - Math.round(9 * s),
      Math.round(5 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      doorX + Math.round(8 * s),
      canvasHeight - doorHeight - Math.round(9 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );
    g.fillRect(
      doorX + Math.round(5 * s),
      canvasHeight - doorHeight - Math.round(6 * s),
      Math.round(5 * s),
      Math.round(2 * s)
    );

    // Side decorations - pokeball symbols
    g.fillStyle(PALETTE.red);
    g.fillCircle(Math.round(10 * s), canvasHeight - Math.round(25 * s), Math.round(4 * s));
    g.fillCircle(bWidth - Math.round(6 * s), canvasHeight - Math.round(25 * s), Math.round(4 * s));
    g.fillStyle(PALETTE.white);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - Math.round(26 * s),
      Math.round(8 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      bWidth - Math.round(10 * s),
      canvasHeight - Math.round(26 * s),
      Math.round(8 * s),
      Math.round(2 * s)
    );

    g.generateTexture("pokecenter", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateTradingGym(): void {
    // Trading Dojo - Japanese dojo style building (traditional wooden structure)
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = Math.round(160 * s);
    const canvasWidth = Math.round(80 * s);
    const bHeight = Math.round(90 * s);
    const bWidth = Math.round(70 * s);
    const baseX = Math.round(5 * s);

    // Shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(
      baseX + Math.round(6 * s),
      canvasHeight - bHeight + Math.round(6 * s),
      bWidth - Math.round(4 * s),
      bHeight
    );

    // Wooden platform/foundation (raised floor - engawa style)
    const platformHeight = Math.round(8 * s);
    g.fillStyle(0x8b4513); // Saddle brown
    g.fillRect(
      baseX - Math.round(4 * s),
      canvasHeight - platformHeight,
      bWidth + Math.round(8 * s),
      platformHeight
    );
    g.fillStyle(0xa0522d); // Sienna (lighter)
    g.fillRect(
      baseX - Math.round(4 * s),
      canvasHeight - platformHeight,
      bWidth + Math.round(8 * s),
      Math.round(2 * s)
    );

    // Building base (wooden walls - warm brown)
    const woodColor = 0x8b5a2b;
    g.fillStyle(woodColor);
    g.fillRect(baseX, canvasHeight - bHeight, bWidth, bHeight - platformHeight);

    // Wood grain texture - vertical planks
    g.fillStyle(darken(woodColor, 0.15));
    for (let i = 0; i < 6; i++) {
      const plankX = baseX + Math.round(2 * s) + i * Math.round(11 * s);
      g.fillRect(plankX, canvasHeight - bHeight, Math.round(1 * s), bHeight - platformHeight);
    }

    // Left side highlight
    g.fillStyle(lighten(woodColor, 0.2));
    g.fillRect(baseX, canvasHeight - bHeight, Math.round(4 * s), bHeight - platformHeight);

    // Right side shadow
    g.fillStyle(darken(woodColor, 0.25));
    g.fillRect(
      baseX + bWidth - Math.round(6 * s),
      canvasHeight - bHeight,
      Math.round(6 * s),
      bHeight - platformHeight
    );

    // Traditional curved roof (dark blue/black tiles)
    const roofColor = 0x1a1a2e;
    const roofOverhang = Math.round(10 * s);
    const roofHeight = Math.round(20 * s);

    // Main roof body
    g.fillStyle(roofColor);
    g.fillRect(
      baseX - roofOverhang,
      canvasHeight - bHeight - roofHeight + Math.round(4 * s),
      bWidth + roofOverhang * 2,
      roofHeight
    );

    // Curved roof edges (simplified pixel art curves)
    g.fillStyle(roofColor);
    // Left curve up
    g.fillRect(
      baseX - roofOverhang - Math.round(2 * s),
      canvasHeight - bHeight - roofHeight + Math.round(8 * s),
      Math.round(4 * s),
      Math.round(8 * s)
    );
    // Right curve up
    g.fillRect(
      baseX + bWidth + roofOverhang - Math.round(2 * s),
      canvasHeight - bHeight - roofHeight + Math.round(8 * s),
      Math.round(4 * s),
      Math.round(8 * s)
    );

    // Roof ridge (top peak)
    g.fillStyle(0x2d2d44);
    g.fillRect(
      baseX - roofOverhang + Math.round(4 * s),
      canvasHeight - bHeight - roofHeight,
      bWidth + roofOverhang * 2 - Math.round(8 * s),
      Math.round(6 * s)
    );

    // Red accent trim under roof
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(
      baseX - roofOverhang + Math.round(2 * s),
      canvasHeight - bHeight + Math.round(2 * s),
      bWidth + roofOverhang * 2 - Math.round(4 * s),
      Math.round(3 * s)
    );

    // Shoji screens (paper doors/windows) - two on each side
    const shojiColor = 0xfff8dc; // Cream white
    const shojiFrameColor = 0x4a3728;
    const screenWidth = Math.round(12 * s);
    const screenHeight = Math.round(28 * s);
    const screenY = canvasHeight - bHeight + Math.round(20 * s);

    // Left shoji screen
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      baseX + Math.round(6 * s),
      screenY,
      screenWidth + Math.round(2 * s),
      screenHeight + Math.round(2 * s)
    );
    g.fillStyle(shojiColor);
    g.fillRect(baseX + Math.round(7 * s), screenY + Math.round(1 * s), screenWidth, screenHeight);
    // Grid pattern
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      baseX + Math.round(7 * s) + screenWidth / 2,
      screenY + Math.round(1 * s),
      Math.round(1 * s),
      screenHeight
    );
    g.fillRect(
      baseX + Math.round(7 * s),
      screenY + screenHeight / 2,
      screenWidth,
      Math.round(1 * s)
    );

    // Right shoji screen
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      baseX + bWidth - Math.round(20 * s),
      screenY,
      screenWidth + Math.round(2 * s),
      screenHeight + Math.round(2 * s)
    );
    g.fillStyle(shojiColor);
    g.fillRect(
      baseX + bWidth - Math.round(19 * s),
      screenY + Math.round(1 * s),
      screenWidth,
      screenHeight
    );
    // Grid pattern
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      baseX + bWidth - Math.round(19 * s) + screenWidth / 2,
      screenY + Math.round(1 * s),
      Math.round(1 * s),
      screenHeight
    );
    g.fillRect(
      baseX + bWidth - Math.round(19 * s),
      screenY + screenHeight / 2,
      screenWidth,
      Math.round(1 * s)
    );

    // Center entrance - sliding doors
    const doorWidth = Math.round(20 * s);
    const doorHeight = Math.round(32 * s);
    const doorX = baseX + (bWidth - doorWidth) / 2;
    const doorY = canvasHeight - platformHeight - doorHeight;

    // Door frame
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      doorX - Math.round(2 * s),
      doorY - Math.round(2 * s),
      doorWidth + Math.round(4 * s),
      doorHeight + Math.round(2 * s)
    );

    // Door panels (slightly open - showing darkness inside)
    g.fillStyle(0x1a1a1a);
    g.fillRect(doorX, doorY, doorWidth, doorHeight);

    // Left door panel (shoji)
    g.fillStyle(shojiColor);
    g.fillRect(doorX, doorY, doorWidth / 2 - Math.round(2 * s), doorHeight);
    g.fillStyle(shojiFrameColor);
    g.fillRect(doorX + doorWidth / 4, doorY, Math.round(1 * s), doorHeight);
    g.fillRect(doorX, doorY + doorHeight / 3, doorWidth / 2 - Math.round(2 * s), Math.round(1 * s));
    g.fillRect(
      doorX,
      doorY + (doorHeight * 2) / 3,
      doorWidth / 2 - Math.round(2 * s),
      Math.round(1 * s)
    );

    // Right door panel (shoji)
    g.fillStyle(shojiColor);
    g.fillRect(
      doorX + doorWidth / 2 + Math.round(2 * s),
      doorY,
      doorWidth / 2 - Math.round(2 * s),
      doorHeight
    );
    g.fillStyle(shojiFrameColor);
    g.fillRect(doorX + (doorWidth * 3) / 4, doorY, Math.round(1 * s), doorHeight);
    g.fillRect(
      doorX + doorWidth / 2 + Math.round(2 * s),
      doorY + doorHeight / 3,
      doorWidth / 2 - Math.round(2 * s),
      Math.round(1 * s)
    );
    g.fillRect(
      doorX + doorWidth / 2 + Math.round(2 * s),
      doorY + (doorHeight * 2) / 3,
      doorWidth / 2 - Math.round(2 * s),
      Math.round(1 * s)
    );

    // Noren (fabric curtain above door) - orange/amber dojo colors
    g.fillStyle(PALETTE.orange);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY - Math.round(10 * s),
      doorWidth + Math.round(8 * s),
      Math.round(10 * s)
    );
    // Noren slits
    g.fillStyle(darken(PALETTE.orange, 0.3));
    g.fillRect(doorX, doorY - Math.round(8 * s), Math.round(1 * s), Math.round(6 * s));
    g.fillRect(
      doorX + doorWidth / 3,
      doorY - Math.round(8 * s),
      Math.round(1 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      doorX + (doorWidth * 2) / 3,
      doorY - Math.round(8 * s),
      Math.round(1 * s),
      Math.round(6 * s)
    );
    g.fillRect(doorX + doorWidth, doorY - Math.round(8 * s), Math.round(1 * s), Math.round(6 * s));

    // Dojo symbol on noren (circle - representing unity/perfection)
    g.fillStyle(PALETTE.gold);
    g.fillCircle(doorX + doorWidth / 2, doorY - Math.round(5 * s), Math.round(3 * s));
    g.fillStyle(PALETTE.orange);
    g.fillCircle(doorX + doorWidth / 2, doorY - Math.round(5 * s), Math.round(1.5 * s));

    // Stone lanterns on either side
    const lanternY = canvasHeight - platformHeight - Math.round(16 * s);
    // Left lantern
    g.fillStyle(0x696969); // Gray stone
    g.fillRect(baseX - Math.round(2 * s), lanternY, Math.round(6 * s), Math.round(16 * s));
    g.fillStyle(0x808080);
    g.fillRect(
      baseX - Math.round(3 * s),
      lanternY + Math.round(4 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.gold, 0.7);
    g.fillRect(
      baseX - Math.round(1 * s),
      lanternY + Math.round(6 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    // Right lantern
    g.fillStyle(0x696969);
    g.fillRect(baseX + bWidth - Math.round(4 * s), lanternY, Math.round(6 * s), Math.round(16 * s));
    g.fillStyle(0x808080);
    g.fillRect(
      baseX + bWidth - Math.round(5 * s),
      lanternY + Math.round(4 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.gold, 0.7);
    g.fillRect(
      baseX + bWidth - Math.round(3 * s),
      lanternY + Math.round(6 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    g.generateTexture("tradinggym", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateCasino(): void {
    // Casino - Vegas-themed building (purple/gold, neon style)
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = Math.round(160 * s);
    const canvasWidth = Math.round(70 * s);
    const bHeight = Math.round(100 * s);
    const bWidth = Math.round(60 * s);

    // Shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      bWidth - Math.round(2 * s),
      bHeight
    );

    // Building base (dark purple - casino style)
    g.fillStyle(PALETTE.deepPurple);
    g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

    // Highlight left side
    g.fillStyle(lighten(PALETTE.deepPurple, 0.2));
    g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(8 * s), bHeight);

    // Shadow right side
    g.fillStyle(darken(PALETTE.deepPurple, 0.2));
    g.fillRect(bWidth - Math.round(8 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

    // Gold trim at base with highlight
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - Math.round(8 * s),
      bWidth - Math.round(4 * s),
      Math.round(4 * s)
    );
    g.fillStyle(lighten(PALETTE.gold, 0.25));
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - Math.round(8 * s),
      bWidth - Math.round(4 * s),
      Math.round(1 * s)
    );

    // Roof with neon lights effect (purple and gold)
    g.fillStyle(PALETTE.purple);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(12 * s),
      bWidth + Math.round(8 * s),
      Math.round(16 * s)
    );
    g.fillStyle(PALETTE.violet);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth + Math.round(4 * s),
      Math.round(12 * s)
    );
    // Roof highlight
    g.fillStyle(lighten(PALETTE.violet, 0.2));
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth + Math.round(4 * s),
      Math.round(3 * s)
    );

    // Vegas-style marquee top with shading
    g.fillStyle(darken(PALETTE.deepPurple, 0.3));
    g.fillRect(
      bWidth / 2 - Math.round(16 * s),
      canvasHeight - bHeight - Math.round(28 * s),
      Math.round(40 * s),
      Math.round(18 * s)
    );
    g.fillStyle(PALETTE.deepPurple);
    g.fillRect(
      bWidth / 2 - Math.round(14 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(36 * s),
      Math.round(14 * s)
    );
    // Marquee highlight
    g.fillStyle(lighten(PALETTE.deepPurple, 0.15));
    g.fillRect(
      bWidth / 2 - Math.round(14 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(36 * s),
      Math.round(3 * s)
    );

    // Gold star on marquee
    g.fillStyle(PALETTE.gold);
    g.fillCircle(
      bWidth / 2 + Math.round(4 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      Math.round(6 * s)
    );
    g.fillStyle(PALETTE.yellow);
    g.fillCircle(
      bWidth / 2 + Math.round(4 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      Math.round(4 * s)
    );
    // Star glint
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(20 * s),
      Math.round(1.5 * s)
    );

    // Neon border lights on marquee (alternating gold dots)
    g.fillStyle(PALETTE.gold);
    for (let i = 0; i < 10; i++) {
      const lightX = bWidth / 2 - Math.round(14 * s) + i * Math.round(4 * s);
      g.fillCircle(lightX, canvasHeight - bHeight - Math.round(26 * s), Math.round(1.5 * s));
      g.fillCircle(lightX, canvasHeight - bHeight - Math.round(12 * s), Math.round(1.5 * s));
    }

    // Windows - casino style (large, glowing)
    const windowColor = PALETTE.gold;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const wx = Math.round(10 * s) + col * Math.round(16 * s);
        const wy = canvasHeight - bHeight + Math.round(18 * s) + row * Math.round(22 * s);

        // Window glow (neon effect)
        g.fillStyle(PALETTE.lavender, 0.35);
        g.fillRect(
          wx - Math.round(2 * s),
          wy - Math.round(2 * s),
          Math.round(13 * s),
          Math.round(15 * s)
        );

        // Window
        g.fillStyle(windowColor);
        g.fillRect(wx, wy, Math.round(10 * s), Math.round(12 * s));

        // Window highlight
        g.fillStyle(lighten(windowColor, 0.35));
        g.fillRect(wx, wy, Math.round(3 * s), Math.round(3 * s));

        // Window frame (purple)
        g.fillStyle(PALETTE.purple);
        g.fillRect(wx + Math.round(4 * s), wy, Math.round(2 * s), Math.round(12 * s));
        g.fillRect(wx, wy + Math.round(5 * s), Math.round(10 * s), Math.round(2 * s));
      }
    }

    // Dice symbols on front (gambling theme) with shading
    g.fillStyle(PALETTE.white);
    g.fillRect(
      Math.round(12 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(darken(PALETTE.white, 0.1));
    g.fillRect(
      Math.round(18 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      Math.round(2 * s),
      Math.round(8 * s)
    );
    g.fillStyle(darken(PALETTE.deepPurple, 0.3));
    g.fillCircle(
      Math.round(14 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1 * s)
    );
    g.fillCircle(
      Math.round(18 * s),
      canvasHeight - bHeight + Math.round(14 * s),
      Math.round(1 * s)
    );
    g.fillStyle(PALETTE.white);
    g.fillRect(
      bWidth - Math.round(16 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(darken(PALETTE.deepPurple, 0.3));
    g.fillCircle(
      bWidth - Math.round(12 * s),
      canvasHeight - bHeight + Math.round(12 * s),
      Math.round(1 * s)
    );

    // Door - grand casino entrance
    const doorWidth = Math.round(20 * s);
    const doorHeight = Math.round(26 * s);
    const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

    // Door frame (gold) with highlight
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX - Math.round(3 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      doorWidth + Math.round(6 * s),
      doorHeight + Math.round(4 * s)
    );
    g.fillStyle(lighten(PALETTE.gold, 0.2));
    g.fillRect(
      doorX - Math.round(3 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      Math.round(2 * s),
      doorHeight + Math.round(4 * s)
    );

    // Door (dark purple)
    g.fillStyle(darken(PALETTE.deepPurple, 0.3));
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

    // Door window (glowing gold)
    g.fillStyle(PALETTE.gold, 0.6);
    g.fillRect(
      doorX + Math.round(4 * s),
      canvasHeight - doorHeight + Math.round(4 * s),
      doorWidth - Math.round(8 * s),
      Math.round(10 * s)
    );
    // Window reflection
    g.fillStyle(lighten(PALETTE.gold, 0.4), 0.4);
    g.fillRect(
      doorX + Math.round(5 * s),
      canvasHeight - doorHeight + Math.round(5 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    // Door divider
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX + doorWidth / 2 - Math.round(1 * s),
      canvasHeight - doorHeight,
      Math.round(2 * s),
      doorHeight
    );

    // Red carpet entrance with shading
    g.fillStyle(PALETTE.red);
    g.fillRect(
      doorX - Math.round(6 * s),
      canvasHeight - Math.round(3 * s),
      doorWidth + Math.round(12 * s),
      Math.round(3 * s)
    );
    // Carpet highlight
    g.fillStyle(lighten(PALETTE.red, 0.15));
    g.fillRect(
      doorX - Math.round(4 * s),
      canvasHeight - Math.round(3 * s),
      doorWidth + Math.round(8 * s),
      Math.round(1 * s)
    );
    // Gold carpet trim
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX - Math.round(6 * s),
      canvasHeight - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      doorX + doorWidth + Math.round(4 * s),
      canvasHeight - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );

    // Side neon tubes (decorative) with glow
    g.fillStyle(PALETTE.lavender);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - Math.round(50 * s),
      Math.round(3 * s),
      Math.round(25 * s)
    );
    g.fillRect(
      bWidth - Math.round(5 * s),
      canvasHeight - Math.round(50 * s),
      Math.round(3 * s),
      Math.round(25 * s)
    );
    // Neon glow
    g.fillStyle(PALETTE.lavender, 0.25);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - Math.round(52 * s),
      Math.round(7 * s),
      Math.round(29 * s)
    );
    g.fillRect(
      bWidth - Math.round(7 * s),
      canvasHeight - Math.round(52 * s),
      Math.round(7 * s),
      Math.round(29 * s)
    );
    // Neon tube highlights
    g.fillStyle(lighten(PALETTE.lavender, 0.3));
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - Math.round(50 * s),
      Math.round(1 * s),
      Math.round(25 * s)
    );
    g.fillRect(
      bWidth - Math.round(5 * s),
      canvasHeight - Math.round(50 * s),
      Math.round(1 * s),
      Math.round(25 * s)
    );

    g.generateTexture("casino", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateTradingTerminal(): void {
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = Math.round(180 * s);
    const canvasWidth = Math.round(110 * s);
    const bHeight = Math.round(120 * s);
    const bWidth = Math.round(100 * s);

    // Terminal color palette (dark, professional)
    const terminalBlack = 0x08080c;
    const terminalDark = 0x0f0f16;
    const terminalGray = 0x1a1f2e;
    const terminalGreen = 0x22c55e;
    const terminalCyan = 0x06b6d4;
    const terminalRed = 0xef4444;
    const terminalGold = 0xfbbf24;
    const terminalPurple = 0xa855f7;

    // Shadow (subtle, professional)
    g.fillStyle(PALETTE.void, 0.4);
    g.fillRect(
      Math.round(10 * s),
      canvasHeight - bHeight + Math.round(6 * s),
      bWidth - Math.round(4 * s),
      bHeight
    );

    // Building base (sleek dark)
    g.fillStyle(terminalBlack);
    g.fillRect(Math.round(5 * s), canvasHeight - bHeight, bWidth - Math.round(5 * s), bHeight);

    // Gradient effect - left highlight
    g.fillStyle(terminalDark);
    g.fillRect(Math.round(5 * s), canvasHeight - bHeight, Math.round(8 * s), bHeight);

    // Right edge shadow
    g.fillStyle(0x040406);
    g.fillRect(bWidth - Math.round(8 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

    // Sleek roof with multi-layer design
    g.fillStyle(terminalGray);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth + Math.round(10 * s),
      Math.round(14 * s)
    );

    // Primary neon accent line (green)
    g.fillStyle(terminalGreen);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth + Math.round(6 * s),
      Math.round(2 * s)
    );

    // Secondary accent line (cyan)
    g.fillStyle(terminalCyan);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - bHeight - Math.round(7 * s),
      bWidth + Math.round(2 * s),
      Math.round(1 * s)
    );

    // Glow effect on roof
    g.fillStyle(terminalGreen, 0.25);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(14 * s),
      bWidth + Math.round(10 * s),
      Math.round(6 * s)
    );

    // "TERMINAL" sign panel (elegant, centered)
    const signWidth = Math.round(70 * s);
    const signX = (bWidth - signWidth) / 2 + Math.round(2 * s);
    g.fillStyle(terminalDark);
    g.fillRect(signX, canvasHeight - bHeight - Math.round(26 * s), signWidth, Math.round(16 * s));

    // Sign border accents
    g.fillStyle(terminalGray);
    g.fillRect(signX, canvasHeight - bHeight - Math.round(26 * s), signWidth, Math.round(1 * s));
    g.fillRect(signX, canvasHeight - bHeight - Math.round(11 * s), signWidth, Math.round(1 * s));

    // Gold corner accents on sign
    g.fillStyle(terminalGold);
    g.fillRect(
      signX,
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      signX + signWidth - Math.round(3 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );

    // Green text pixels for "TERMINAL" (full word)
    g.fillStyle(terminalGreen);
    const textY = canvasHeight - bHeight - Math.round(22 * s);
    const letterSpacing = Math.round(8 * s);
    let letterX = signX + Math.round(4 * s);

    // T
    g.fillRect(letterX, textY, Math.round(6 * s), Math.round(2 * s));
    g.fillRect(letterX + Math.round(2 * s), textY, Math.round(2 * s), Math.round(8 * s));
    letterX += letterSpacing;

    // E
    g.fillRect(letterX, textY, Math.round(5 * s), Math.round(2 * s));
    g.fillRect(letterX, textY + Math.round(3 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(letterX, textY + Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    letterX += letterSpacing;

    // R
    g.fillRect(letterX, textY, Math.round(5 * s), Math.round(2 * s));
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX, textY + Math.round(3 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(letterX + Math.round(3 * s), textY, Math.round(2 * s), Math.round(4 * s));
    g.fillRect(
      letterX + Math.round(3 * s),
      textY + Math.round(5 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );
    letterX += letterSpacing;

    // M
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX + Math.round(5 * s), textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(
      letterX + Math.round(2 * s),
      textY + Math.round(2 * s),
      Math.round(1 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      letterX + Math.round(4 * s),
      textY + Math.round(2 * s),
      Math.round(1 * s),
      Math.round(2 * s)
    );
    letterX += letterSpacing;

    // I
    g.fillRect(letterX, textY, Math.round(5 * s), Math.round(2 * s));
    g.fillRect(letterX + Math.round(1.5 * s), textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX, textY + Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
    letterX += Math.round(6 * s);

    // N
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX + Math.round(4 * s), textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(
      letterX + Math.round(2 * s),
      textY + Math.round(2 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );
    letterX += letterSpacing;

    // A
    g.fillRect(letterX + Math.round(2 * s), textY, Math.round(2 * s), Math.round(2 * s));
    g.fillRect(letterX, textY + Math.round(2 * s), Math.round(2 * s), Math.round(6 * s));
    g.fillRect(
      letterX + Math.round(4 * s),
      textY + Math.round(2 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      letterX + Math.round(2 * s),
      textY + Math.round(4 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );
    letterX += letterSpacing;

    // L
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX, textY + Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));

    // Main monitor screen (large, centered)
    const screenY = canvasHeight - bHeight + Math.round(14 * s);
    const screenWidth = Math.round(70 * s);
    const screenHeight = Math.round(36 * s);
    const screenX = (bWidth - screenWidth) / 2 + Math.round(2 * s);

    // Screen bezel (sleek dark frame)
    g.fillStyle(terminalGray);
    g.fillRect(
      screenX - Math.round(3 * s),
      screenY - Math.round(3 * s),
      screenWidth + Math.round(6 * s),
      screenHeight + Math.round(6 * s)
    );

    // Screen background
    g.fillStyle(terminalDark);
    g.fillRect(screenX, screenY, screenWidth, screenHeight);

    // Candlestick chart visualization (more candles for wider screen)
    const chartX = screenX + Math.round(4 * s);
    const chartY = screenY + Math.round(5 * s);
    const chartHeight = Math.round(22 * s);

    // Draw candlesticks (green up, red down pattern - more candles)
    const candles = [
      { up: true, height: 0.35 },
      { up: true, height: 0.5 },
      { up: false, height: 0.4 },
      { up: true, height: 0.6 },
      { up: true, height: 0.75 },
      { up: false, height: 0.55 },
      { up: true, height: 0.8 },
      { up: true, height: 0.7 },
      { up: false, height: 0.5 },
      { up: true, height: 0.65 },
      { up: true, height: 0.85 },
      { up: false, height: 0.6 },
    ];

    candles.forEach((candle, i) => {
      const candleX = chartX + i * Math.round(5 * s);
      const candleH = Math.round(chartHeight * candle.height);
      const candleY = chartY + chartHeight - candleH;

      // Wick
      g.fillStyle(candle.up ? terminalGreen : terminalRed, 0.7);
      g.fillRect(
        candleX + Math.round(1.5 * s),
        candleY - Math.round(2 * s),
        Math.round(1 * s),
        candleH + Math.round(4 * s)
      );

      // Body
      g.fillStyle(candle.up ? terminalGreen : terminalRed);
      g.fillRect(candleX, candleY, Math.round(4 * s), candleH);
    });

    // Price line (horizontal, cyan)
    g.fillStyle(terminalCyan, 0.6);
    g.fillRect(
      screenX + Math.round(3 * s),
      screenY + Math.round(16 * s),
      screenWidth - Math.round(6 * s),
      Math.round(1 * s)
    );

    // Volume bars at bottom of screen
    const volColors = [
      terminalGreen,
      terminalGreen,
      terminalRed,
      terminalGreen,
      terminalGreen,
      terminalRed,
      terminalGreen,
      terminalGreen,
      terminalRed,
      terminalGreen,
      terminalGreen,
      terminalRed,
    ];
    for (let i = 0; i < 12; i++) {
      const volHeight = Math.round((2 + (i % 3 === 0 ? 4 : 2)) * s);
      g.fillStyle(volColors[i], 0.5);
      g.fillRect(
        screenX + Math.round(4 * s) + i * Math.round(5 * s),
        screenY + screenHeight - volHeight - Math.round(3 * s),
        Math.round(4 * s),
        volHeight
      );
    }

    // Screen glow effect
    g.fillStyle(terminalGreen, 0.12);
    g.fillRect(
      screenX - Math.round(5 * s),
      screenY - Math.round(5 * s),
      screenWidth + Math.round(10 * s),
      screenHeight + Math.round(10 * s)
    );

    // Side panels with data displays (left and right of main screen)
    const sidePanelW = Math.round(16 * s);
    const sidePanelH = Math.round(50 * s);
    const sidePanelY = canvasHeight - bHeight + Math.round(55 * s);

    // Left panel (portfolio/holdings)
    g.fillStyle(terminalGray);
    g.fillRect(
      Math.round(10 * s),
      sidePanelY - Math.round(2 * s),
      sidePanelW + Math.round(4 * s),
      sidePanelH + Math.round(4 * s)
    );
    g.fillStyle(terminalDark);
    g.fillRect(Math.round(12 * s), sidePanelY, sidePanelW, sidePanelH);

    // Portfolio bars (green gradient)
    for (let i = 0; i < 6; i++) {
      const barWidth = Math.round((8 + Math.random() * 6) * s);
      g.fillStyle(terminalGreen, 0.6 + i * 0.06);
      g.fillRect(
        Math.round(14 * s),
        sidePanelY + Math.round(4 * s) + i * Math.round(7 * s),
        barWidth,
        Math.round(4 * s)
      );
    }

    // Right panel (order book)
    g.fillStyle(terminalGray);
    g.fillRect(
      bWidth - Math.round(24 * s),
      sidePanelY - Math.round(2 * s),
      sidePanelW + Math.round(4 * s),
      sidePanelH + Math.round(4 * s)
    );
    g.fillStyle(terminalDark);
    g.fillRect(bWidth - Math.round(22 * s), sidePanelY, sidePanelW, sidePanelH);

    // Order book (green bids, red asks)
    for (let i = 0; i < 3; i++) {
      g.fillStyle(terminalGreen, 0.8);
      g.fillRect(
        bWidth - Math.round(20 * s),
        sidePanelY + Math.round(4 * s) + i * Math.round(6 * s),
        Math.round(10 * s),
        Math.round(3 * s)
      );
    }
    for (let i = 3; i < 6; i++) {
      g.fillStyle(terminalRed, 0.8);
      g.fillRect(
        bWidth - Math.round(20 * s),
        sidePanelY + Math.round(4 * s) + i * Math.round(6 * s),
        Math.round(8 * s),
        Math.round(3 * s)
      );
    }

    // Elegant glass door (centered, wider)
    const doorWidth = Math.round(24 * s);
    const doorHeight = Math.round(28 * s);
    const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

    // Door frame (sleek dark)
    g.fillStyle(terminalGray);
    g.fillRect(
      doorX - Math.round(3 * s),
      canvasHeight - doorHeight - Math.round(3 * s),
      doorWidth + Math.round(6 * s),
      doorHeight + Math.round(3 * s)
    );

    // Door (dark glass)
    g.fillStyle(terminalDark);
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

    // Door glass panels (split design)
    g.fillStyle(terminalGreen, 0.1);
    g.fillRect(
      doorX + Math.round(2 * s),
      canvasHeight - doorHeight + Math.round(2 * s),
      Math.round(9 * s),
      doorHeight - Math.round(4 * s)
    );
    g.fillRect(
      doorX + Math.round(13 * s),
      canvasHeight - doorHeight + Math.round(2 * s),
      Math.round(9 * s),
      doorHeight - Math.round(4 * s)
    );

    // Door reflections
    g.fillStyle(terminalCyan, 0.15);
    g.fillRect(
      doorX + Math.round(3 * s),
      canvasHeight - doorHeight + Math.round(3 * s),
      Math.round(3 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      doorX + Math.round(14 * s),
      canvasHeight - doorHeight + Math.round(3 * s),
      Math.round(3 * s),
      Math.round(10 * s)
    );

    // Door handles (both sides)
    g.fillStyle(terminalGold);
    g.fillRect(
      doorX + Math.round(8 * s),
      canvasHeight - doorHeight / 2 - Math.round(2 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      doorX + Math.round(14 * s),
      canvasHeight - doorHeight / 2 - Math.round(2 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );

    // LED strip at base of building
    for (let i = 0; i < 16; i++) {
      const ledColor = i % 3 === 0 ? terminalCyan : terminalGreen;
      g.fillStyle(ledColor, 0.8);
      g.fillCircle(
        Math.round(12 * s) + i * Math.round(5 * s),
        canvasHeight - Math.round(2 * s),
        Math.round(1.5 * s)
      );
    }

    // Vertical LED accent lines on sides
    g.fillStyle(terminalGreen, 0.5);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1.5 * s),
      bHeight - Math.round(18 * s)
    );
    g.fillRect(
      bWidth - Math.round(5 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1.5 * s),
      bHeight - Math.round(18 * s)
    );

    // Cyan accent lines
    g.fillStyle(terminalCyan, 0.4);
    g.fillRect(
      Math.round(10 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1 * s),
      bHeight - Math.round(18 * s)
    );
    g.fillRect(
      bWidth - Math.round(7 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1 * s),
      bHeight - Math.round(18 * s)
    );

    // Rooftop antenna array (more elaborate)
    // Main antenna
    g.fillStyle(terminalGray);
    g.fillRect(
      bWidth - Math.round(18 * s),
      canvasHeight - bHeight - Math.round(24 * s),
      Math.round(2 * s),
      Math.round(16 * s)
    );
    g.fillStyle(terminalCyan);
    g.fillCircle(
      bWidth - Math.round(17 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(3 * s)
    );
    g.fillStyle(terminalCyan, 0.3);
    g.fillCircle(
      bWidth - Math.round(17 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(5 * s)
    );

    // Secondary antenna
    g.fillStyle(terminalGray);
    g.fillRect(
      Math.round(18 * s),
      canvasHeight - bHeight - Math.round(20 * s),
      Math.round(2 * s),
      Math.round(12 * s)
    );
    g.fillStyle(terminalGreen);
    g.fillCircle(
      Math.round(19 * s),
      canvasHeight - bHeight - Math.round(22 * s),
      Math.round(2.5 * s)
    );
    g.fillStyle(terminalGreen, 0.3);
    g.fillCircle(
      Math.round(19 * s),
      canvasHeight - bHeight - Math.round(22 * s),
      Math.round(4 * s)
    );

    // Satellite dish
    g.fillStyle(terminalGray);
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      canvasHeight - bHeight - Math.round(16 * s),
      Math.round(12 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      bWidth / 2 - Math.round(1 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );

    g.generateTexture("terminal", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateBagsWorldHQ(): void {
    const s = 1.8; // Scale for larger building
    const canvasWidth = Math.round(80 * s);
    const canvasHeight = Math.round(100 * s);
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const bWidth = canvasWidth;
    const bHeight = canvasHeight;

    // Sky fortress floating island base
    const baseY = canvasHeight - Math.round(25 * s);

    // Floating island/cloud base with gradient effect
    g.fillStyle(0x4a5568); // Dark gray rock
    g.fillTriangle(
      Math.round(10 * s),
      baseY,
      bWidth - Math.round(10 * s),
      baseY,
      bWidth / 2,
      canvasHeight - Math.round(5 * s)
    );
    // Lighter rock highlights
    g.fillStyle(0x718096);
    g.fillTriangle(
      Math.round(15 * s),
      baseY - Math.round(2 * s),
      bWidth - Math.round(15 * s),
      baseY - Math.round(2 * s),
      bWidth / 2,
      canvasHeight - Math.round(10 * s)
    );

    // Cloud wisps around base
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(Math.round(15 * s), baseY, Math.round(8 * s));
    g.fillCircle(bWidth - Math.round(15 * s), baseY, Math.round(6 * s));
    g.fillCircle(bWidth / 2, canvasHeight - Math.round(8 * s), Math.round(10 * s));

    // Main tower - epic castle style
    const towerWidth = Math.round(40 * s);
    const towerX = (bWidth - towerWidth) / 2;
    const towerHeight = Math.round(55 * s);
    const towerY = baseY - towerHeight;

    // Tower base - deep purple/blue gradient (Bags colors)
    g.fillStyle(0x1a1a2e);
    g.fillRect(towerX, towerY, towerWidth, towerHeight);

    // Tower mid section - slightly lighter
    g.fillStyle(0x16213e);
    g.fillRect(
      towerX + Math.round(3 * s),
      towerY + Math.round(5 * s),
      towerWidth - Math.round(6 * s),
      towerHeight - Math.round(10 * s)
    );

    // Golden trim borders
    g.fillStyle(PALETTE.gold);
    g.fillRect(towerX, towerY, towerWidth, Math.round(2 * s)); // Top
    g.fillRect(towerX, towerY, Math.round(2 * s), towerHeight); // Left
    g.fillRect(towerX + towerWidth - Math.round(2 * s), towerY, Math.round(2 * s), towerHeight); // Right

    // Side turrets
    const turretWidth = Math.round(12 * s);
    const turretHeight = Math.round(35 * s);

    // Left turret
    g.fillStyle(0x1a1a2e);
    g.fillRect(Math.round(5 * s), baseY - turretHeight, turretWidth, turretHeight);
    g.fillStyle(PALETTE.gold);
    g.fillRect(Math.round(5 * s), baseY - turretHeight, turretWidth, Math.round(2 * s));

    // Right turret
    g.fillStyle(0x1a1a2e);
    g.fillRect(bWidth - Math.round(17 * s), baseY - turretHeight, turretWidth, turretHeight);
    g.fillStyle(PALETTE.gold);
    g.fillRect(bWidth - Math.round(17 * s), baseY - turretHeight, turretWidth, Math.round(2 * s));

    // Turret spires (pointed tops)
    g.fillStyle(PALETTE.gold);
    // Left spire
    g.fillTriangle(
      Math.round(5 * s),
      baseY - turretHeight,
      Math.round(17 * s),
      baseY - turretHeight,
      Math.round(11 * s),
      baseY - turretHeight - Math.round(12 * s)
    );
    // Right spire
    g.fillTriangle(
      bWidth - Math.round(17 * s),
      baseY - turretHeight,
      bWidth - Math.round(5 * s),
      baseY - turretHeight,
      bWidth - Math.round(11 * s),
      baseY - turretHeight - Math.round(12 * s)
    );

    // Main tower spire - grand central spire
    g.fillStyle(PALETTE.gold);
    g.fillTriangle(
      towerX,
      towerY,
      towerX + towerWidth,
      towerY,
      bWidth / 2,
      towerY - Math.round(20 * s)
    );

    // Glowing windows - cyan/teal glow (Bags brand)
    const windowColor = 0x4ade80; // Bags green
    g.fillStyle(windowColor);

    // Main tower windows (3 rows)
    for (let row = 0; row < 3; row++) {
      const windowY = towerY + Math.round(15 * s) + row * Math.round(14 * s);
      g.fillRect(towerX + Math.round(8 * s), windowY, Math.round(8 * s), Math.round(10 * s));
      g.fillRect(towerX + Math.round(24 * s), windowY, Math.round(8 * s), Math.round(10 * s));
    }

    // Window glow effect
    g.fillStyle(windowColor, 0.3);
    for (let row = 0; row < 3; row++) {
      const windowY = towerY + Math.round(15 * s) + row * Math.round(14 * s);
      g.fillRect(
        towerX + Math.round(6 * s),
        windowY - Math.round(2 * s),
        Math.round(12 * s),
        Math.round(14 * s)
      );
      g.fillRect(
        towerX + Math.round(22 * s),
        windowY - Math.round(2 * s),
        Math.round(12 * s),
        Math.round(14 * s)
      );
    }

    // Side turret windows
    g.fillStyle(windowColor);
    g.fillRect(Math.round(8 * s), baseY - Math.round(25 * s), Math.round(6 * s), Math.round(8 * s));
    g.fillRect(
      bWidth - Math.round(14 * s),
      baseY - Math.round(25 * s),
      Math.round(6 * s),
      Math.round(8 * s)
    );

    // Grand entrance door (arched)
    g.fillStyle(0x0f0f23);
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      baseY - Math.round(16 * s),
      Math.round(12 * s),
      Math.round(16 * s)
    );
    // Door arch
    g.fillCircle(bWidth / 2, baseY - Math.round(16 * s), Math.round(6 * s));
    // Door trim
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      bWidth / 2 - Math.round(7 * s),
      baseY - Math.round(16 * s),
      Math.round(2 * s),
      Math.round(16 * s)
    );
    g.fillRect(
      bWidth / 2 + Math.round(5 * s),
      baseY - Math.round(16 * s),
      Math.round(2 * s),
      Math.round(16 * s)
    );

    // Floating particles/magic effect (small gold dots)
    g.fillStyle(PALETTE.gold, 0.8);
    const particlePositions = [
      [20, 30],
      [60, 25],
      [35, 15],
      [50, 40],
      [25, 50],
      [55, 55],
    ];
    particlePositions.forEach(([px, py]) => {
      g.fillCircle(Math.round((px * s) / 1.8), Math.round((py * s) / 1.8), Math.round(1.5 * s));
    });

    // "BAGS" text emblem at top (simplified pixel banner)
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      bWidth / 2 - Math.round(10 * s),
      towerY + Math.round(5 * s),
      Math.round(20 * s),
      Math.round(6 * s)
    );
    g.fillStyle(0x1a1a2e);
    g.fillRect(
      bWidth / 2 - Math.round(8 * s),
      towerY + Math.round(6 * s),
      Math.round(16 * s),
      Math.round(4 * s)
    );

    g.generateTexture("bagshq", canvasWidth, canvasHeight);
    g.destroy();
  }

  /**
   * Generate elegant mansion sprites for Ballers Valley
   * Classical estate style with refined proportions, graceful arches, and sophisticated details
   */
  private generateMansions(): void {
    const s = SCALE;
    const canvasWidth = Math.round(90 * s);
    const canvasHeight = Math.round(180 * s);

    // Each mansion has unique architecture, not just color variations
    this.generateMansion0_GrandPalace(s, canvasWidth, canvasHeight);
    this.generateMansion1_VictorianTower(s, canvasWidth, canvasHeight);
    this.generateMansion2_FrenchChateau(s, canvasWidth, canvasHeight);
    this.generateMansion3_ArtDecoEstate(s, canvasWidth, canvasHeight);
    this.generateMansion4_ColonialManor(s, canvasWidth, canvasHeight);
  }

  // MANSION 0: Grand Palace - Central dome with symmetrical wings (most prestigious)
  private generateMansion0_GrandPalace(s: number, canvasWidth: number, canvasHeight: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const style = { base: PALETTE.navy, roof: PALETTE.gold, trim: PALETTE.gold, window: PALETTE.bagsGreen, column: PALETTE.cream };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight;

    // Main central body
    const mainW = Math.round(40 * s);
    const mainH = Math.round(80 * s);
    const mainX = centerX - mainW / 2;
    const mainY = groundY - mainH;

    // Drop shadow
    g.fillStyle(PALETTE.void, 0.4);
    g.fillRect(mainX + Math.round(4 * s), mainY + Math.round(6 * s), mainW, mainH);

    // Central body
    g.fillStyle(style.base);
    g.fillRect(mainX, mainY, mainW, mainH);
    g.fillStyle(lighten(style.base, 0.15));
    g.fillRect(mainX, mainY, Math.round(4 * s), mainH);

    // LEFT WING - shorter, wider
    const wingW = Math.round(22 * s);
    const wingH = Math.round(55 * s);
    const leftWingX = mainX - wingW + Math.round(2 * s);
    const wingY = groundY - wingH;
    g.fillStyle(PALETTE.void, 0.3);
    g.fillRect(leftWingX + Math.round(3 * s), wingY + Math.round(4 * s), wingW, wingH);
    g.fillStyle(style.base);
    g.fillRect(leftWingX, wingY, wingW, wingH);
    g.fillStyle(lighten(style.base, 0.1));
    g.fillRect(leftWingX, wingY, Math.round(3 * s), wingH);
    // Wing roof (flat with balustrade)
    g.fillStyle(style.roof);
    g.fillRect(leftWingX - Math.round(2 * s), wingY - Math.round(6 * s), wingW + Math.round(4 * s), Math.round(6 * s));
    // Wing windows (2 columns, 2 rows)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const wx = leftWingX + Math.round(4 * s) + col * Math.round(10 * s);
        const wy = wingY + Math.round(10 * s) + row * Math.round(22 * s);
        g.fillStyle(style.window, 0.3);
        g.fillRect(wx - Math.round(1 * s), wy - Math.round(1 * s), Math.round(8 * s), Math.round(14 * s));
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(6 * s), Math.round(12 * s));
      }
    }

    // RIGHT WING - mirror of left
    const rightWingX = mainX + mainW - Math.round(2 * s);
    g.fillStyle(PALETTE.void, 0.3);
    g.fillRect(rightWingX + Math.round(3 * s), wingY + Math.round(4 * s), wingW, wingH);
    g.fillStyle(style.base);
    g.fillRect(rightWingX, wingY, wingW, wingH);
    g.fillStyle(darken(style.base, 0.15));
    g.fillRect(rightWingX + wingW - Math.round(3 * s), wingY, Math.round(3 * s), wingH);
    g.fillStyle(style.roof);
    g.fillRect(rightWingX - Math.round(2 * s), wingY - Math.round(6 * s), wingW + Math.round(4 * s), Math.round(6 * s));
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const wx = rightWingX + Math.round(4 * s) + col * Math.round(10 * s);
        const wy = wingY + Math.round(10 * s) + row * Math.round(22 * s);
        g.fillStyle(style.window, 0.3);
        g.fillRect(wx - Math.round(1 * s), wy - Math.round(1 * s), Math.round(8 * s), Math.round(14 * s));
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(6 * s), Math.round(12 * s));
      }
    }

    // GRAND DOME on central body
    const domeR = Math.round(20 * s);
    const domeY = mainY - Math.round(8 * s);
    g.fillStyle(style.roof);
    g.fillCircle(centerX, domeY, domeR);
    g.fillStyle(lighten(style.roof, 0.25));
    g.fillCircle(centerX - Math.round(5 * s), domeY - Math.round(5 * s), Math.round(8 * s));
    // Dome base/drum
    g.fillStyle(style.column);
    g.fillRect(centerX - Math.round(18 * s), domeY - Math.round(2 * s), Math.round(36 * s), Math.round(8 * s));
    // Finial on dome
    g.fillStyle(style.trim);
    g.fillRect(centerX - Math.round(1 * s), domeY - domeR - Math.round(10 * s), Math.round(2 * s), Math.round(10 * s));
    g.fillCircle(centerX, domeY - domeR - Math.round(12 * s), Math.round(3 * s));

    // Main cornice
    g.fillStyle(style.trim);
    g.fillRect(mainX - Math.round(2 * s), mainY - Math.round(4 * s), mainW + Math.round(4 * s), Math.round(6 * s));

    // Main body windows (3 columns, 3 rows)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const wx = mainX + Math.round(5 * s) + col * Math.round(12 * s);
        const wy = mainY + Math.round(10 * s) + row * Math.round(24 * s);
        g.fillStyle(style.window, 0.3);
        g.fillRect(wx - Math.round(1 * s), wy - Math.round(1 * s), Math.round(9 * s), Math.round(16 * s));
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(7 * s), Math.round(14 * s));
        g.fillCircle(wx + Math.round(3.5 * s), wy, Math.round(3.5 * s));
      }
    }

    // Grand entrance (central arched door)
    const doorW = Math.round(14 * s);
    const doorH = Math.round(24 * s);
    const doorX = centerX - doorW / 2;
    const doorY = groundY - doorH;
    g.fillStyle(style.trim);
    g.fillRect(doorX - Math.round(3 * s), doorY - Math.round(3 * s), doorW + Math.round(6 * s), doorH + Math.round(3 * s));
    g.fillCircle(centerX, doorY - Math.round(3 * s), doorW / 2 + Math.round(3 * s));
    g.fillStyle(PALETTE.void);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillCircle(centerX, doorY, doorW / 2);
    g.fillStyle(PALETTE.darkBrown);
    g.fillRect(doorX + Math.round(1 * s), doorY + Math.round(3 * s), doorW / 2 - Math.round(2 * s), doorH - Math.round(3 * s));
    g.fillRect(doorX + doorW / 2 + Math.round(1 * s), doorY + Math.round(3 * s), doorW / 2 - Math.round(2 * s), doorH - Math.round(3 * s));

    g.generateTexture("mansion_0", canvasWidth, canvasHeight);
    g.destroy();
  }

  // MANSION 1: Victorian with corner tower
  private generateMansion1_VictorianTower(s: number, canvasWidth: number, canvasHeight: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const style = { base: PALETTE.night, roof: PALETTE.amber, trim: PALETTE.gold, window: PALETTE.gold, column: PALETTE.cream };
    const groundY = canvasHeight;

    // Main body (asymmetric - tower on left)
    const mainW = Math.round(50 * s);
    const mainH = Math.round(70 * s);
    const mainX = Math.round(25 * s);
    const mainY = groundY - mainH;

    // Shadow
    g.fillStyle(PALETTE.void, 0.4);
    g.fillRect(mainX + Math.round(4 * s), mainY + Math.round(6 * s), mainW, mainH);

    // Main body
    g.fillStyle(style.base);
    g.fillRect(mainX, mainY, mainW, mainH);
    g.fillStyle(lighten(style.base, 0.12));
    g.fillRect(mainX, mainY, Math.round(4 * s), mainH);

    // Steep Victorian roof (gabled)
    const roofPeakY = mainY - Math.round(30 * s);
    g.fillStyle(style.roof);
    g.fillTriangle(mainX - Math.round(4 * s), mainY, mainX + mainW + Math.round(4 * s), mainY, mainX + mainW / 2, roofPeakY);
    g.fillStyle(lighten(style.roof, 0.2));
    g.fillTriangle(mainX + Math.round(10 * s), mainY - Math.round(2 * s), mainX + mainW / 2, mainY - Math.round(2 * s), mainX + mainW / 2, roofPeakY + Math.round(5 * s));

    // CORNER TOWER (left side, taller)
    const towerW = Math.round(20 * s);
    const towerH = Math.round(100 * s);
    const towerX = mainX - Math.round(5 * s);
    const towerY = groundY - towerH;

    g.fillStyle(PALETTE.void, 0.35);
    g.fillRect(towerX + Math.round(3 * s), towerY + Math.round(5 * s), towerW, towerH);
    g.fillStyle(style.base);
    g.fillRect(towerX, towerY, towerW, towerH);
    g.fillStyle(lighten(style.base, 0.15));
    g.fillRect(towerX, towerY, Math.round(3 * s), towerH);

    // Conical tower roof (witch's hat style)
    const towerRoofH = Math.round(35 * s);
    g.fillStyle(style.roof);
    g.fillTriangle(towerX - Math.round(3 * s), towerY, towerX + towerW + Math.round(3 * s), towerY, towerX + towerW / 2, towerY - towerRoofH);
    g.fillStyle(lighten(style.roof, 0.2));
    g.fillTriangle(towerX + Math.round(3 * s), towerY - Math.round(2 * s), towerX + towerW / 2, towerY - Math.round(2 * s), towerX + towerW / 2, towerY - towerRoofH + Math.round(5 * s));
    // Finial
    g.fillStyle(style.trim);
    g.fillRect(towerX + towerW / 2 - Math.round(1 * s), towerY - towerRoofH - Math.round(8 * s), Math.round(2 * s), Math.round(8 * s));
    g.fillCircle(towerX + towerW / 2, towerY - towerRoofH - Math.round(10 * s), Math.round(2.5 * s));

    // Tower windows (stacked, arched)
    for (let i = 0; i < 4; i++) {
      const wy = towerY + Math.round(10 * s) + i * Math.round(22 * s);
      g.fillStyle(style.window, 0.3);
      g.fillRect(towerX + Math.round(5 * s), wy, Math.round(10 * s), Math.round(14 * s));
      g.fillStyle(style.window);
      g.fillRect(towerX + Math.round(6 * s), wy + Math.round(1 * s), Math.round(8 * s), Math.round(12 * s));
      g.fillCircle(towerX + Math.round(10 * s), wy + Math.round(1 * s), Math.round(4 * s));
    }

    // Main body windows (2 columns, 2 rows, to the right of tower)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const wx = mainX + Math.round(20 * s) + col * Math.round(14 * s);
        const wy = mainY + Math.round(12 * s) + row * Math.round(28 * s);
        g.fillStyle(style.window, 0.25);
        g.fillRect(wx - Math.round(1 * s), wy - Math.round(1 * s), Math.round(10 * s), Math.round(18 * s));
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(8 * s), Math.round(16 * s));
        // Decorative top
        g.fillStyle(style.trim);
        g.fillRect(wx - Math.round(2 * s), wy - Math.round(3 * s), Math.round(12 * s), Math.round(3 * s));
      }
    }

    // Decorative gable trim
    g.fillStyle(style.trim);
    g.fillRect(mainX + mainW / 2 - Math.round(8 * s), roofPeakY + Math.round(5 * s), Math.round(16 * s), Math.round(12 * s));
    g.fillStyle(style.window);
    g.fillCircle(mainX + mainW / 2, roofPeakY + Math.round(10 * s), Math.round(4 * s));

    // Front porch (right side)
    const porchX = mainX + Math.round(30 * s);
    const porchY = groundY - Math.round(30 * s);
    g.fillStyle(style.roof);
    g.fillRect(porchX - Math.round(3 * s), porchY, Math.round(26 * s), Math.round(4 * s));
    // Porch posts
    g.fillStyle(style.column);
    g.fillRect(porchX, porchY, Math.round(3 * s), Math.round(30 * s));
    g.fillRect(porchX + Math.round(18 * s), porchY, Math.round(3 * s), Math.round(30 * s));

    // Door
    const doorX = mainX + Math.round(35 * s);
    const doorY = groundY - Math.round(22 * s);
    g.fillStyle(PALETTE.void);
    g.fillRect(doorX, doorY, Math.round(10 * s), Math.round(22 * s));
    g.fillStyle(PALETTE.darkBrown);
    g.fillRect(doorX + Math.round(1 * s), doorY + Math.round(2 * s), Math.round(8 * s), Math.round(19 * s));

    g.generateTexture("mansion_1", canvasWidth, canvasHeight);
    g.destroy();
  }

  // MANSION 2: French Chateau with steep roof and turrets
  private generateMansion2_FrenchChateau(s: number, canvasWidth: number, canvasHeight: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const style = { base: PALETTE.deepPurple, roof: PALETTE.lavender, trim: PALETTE.violet, window: PALETTE.lavender, column: PALETTE.silver };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight;

    // Main body
    const mainW = Math.round(55 * s);
    const mainH = Math.round(60 * s);
    const mainX = centerX - mainW / 2;
    const mainY = groundY - mainH;

    g.fillStyle(PALETTE.void, 0.4);
    g.fillRect(mainX + Math.round(4 * s), mainY + Math.round(5 * s), mainW, mainH);
    g.fillStyle(style.base);
    g.fillRect(mainX, mainY, mainW, mainH);
    g.fillStyle(lighten(style.base, 0.12));
    g.fillRect(mainX, mainY, Math.round(3 * s), mainH);

    // STEEP French roof (Mansard with dormers)
    const roofH = Math.round(40 * s);
    g.fillStyle(style.roof);
    // Lower steep section
    g.fillRect(mainX - Math.round(4 * s), mainY - roofH, mainW + Math.round(8 * s), roofH);
    // Upper flat section
    g.fillStyle(darken(style.roof, 0.15));
    g.fillRect(mainX, mainY - roofH - Math.round(8 * s), mainW, Math.round(10 * s));
    g.fillStyle(lighten(style.roof, 0.15));
    g.fillRect(mainX - Math.round(4 * s), mainY - roofH, mainW + Math.round(8 * s), Math.round(4 * s));

    // DORMERS (3 tall pointed dormers)
    for (let d = 0; d < 3; d++) {
      const dx = mainX + Math.round(6 * s) + d * Math.round(18 * s);
      const dy = mainY - roofH + Math.round(8 * s);

      g.fillStyle(style.base);
      g.fillRect(dx, dy, Math.round(14 * s), Math.round(28 * s));
      // Steep dormer roof
      g.fillStyle(style.roof);
      g.fillTriangle(dx - Math.round(2 * s), dy, dx + Math.round(16 * s), dy, dx + Math.round(7 * s), dy - Math.round(18 * s));
      // Dormer window
      g.fillStyle(style.window, 0.3);
      g.fillRect(dx + Math.round(3 * s), dy + Math.round(4 * s), Math.round(8 * s), Math.round(20 * s));
      g.fillStyle(style.window);
      g.fillRect(dx + Math.round(4 * s), dy + Math.round(5 * s), Math.round(6 * s), Math.round(18 * s));
      // Window divider
      g.fillStyle(darken(style.base, 0.3));
      g.fillRect(dx + Math.round(6.5 * s), dy + Math.round(5 * s), Math.round(1 * s), Math.round(18 * s));
    }

    // CORNER TURRETS (small round towers)
    const turretR = Math.round(8 * s);
    const turretH = Math.round(45 * s);
    // Left turret
    g.fillStyle(style.base);
    g.fillCircle(mainX, mainY + Math.round(15 * s), turretR);
    g.fillRect(mainX - turretR, mainY + Math.round(15 * s), turretR * 2, turretH);
    g.fillStyle(style.roof);
    g.fillTriangle(mainX - turretR - Math.round(2 * s), mainY + Math.round(15 * s), mainX + turretR + Math.round(2 * s), mainY + Math.round(15 * s), mainX, mainY - Math.round(10 * s));
    // Right turret
    g.fillStyle(style.base);
    g.fillCircle(mainX + mainW, mainY + Math.round(15 * s), turretR);
    g.fillRect(mainX + mainW - turretR, mainY + Math.round(15 * s), turretR * 2, turretH);
    g.fillStyle(style.roof);
    g.fillTriangle(mainX + mainW - turretR - Math.round(2 * s), mainY + Math.round(15 * s), mainX + mainW + turretR + Math.round(2 * s), mainY + Math.round(15 * s), mainX + mainW, mainY - Math.round(10 * s));

    // Turret windows
    g.fillStyle(style.window);
    g.fillRect(mainX - Math.round(3 * s), mainY + Math.round(25 * s), Math.round(6 * s), Math.round(10 * s));
    g.fillRect(mainX + mainW - Math.round(3 * s), mainY + Math.round(25 * s), Math.round(6 * s), Math.round(10 * s));

    // Main floor windows (4 tall French windows)
    for (let w = 0; w < 4; w++) {
      const wx = mainX + Math.round(8 * s) + w * Math.round(12 * s);
      const wy = mainY + Math.round(10 * s);
      g.fillStyle(style.window, 0.25);
      g.fillRect(wx - Math.round(1 * s), wy - Math.round(1 * s), Math.round(9 * s), Math.round(35 * s));
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(7 * s), Math.round(33 * s));
      // Balcony rail
      g.fillStyle(style.trim);
      g.fillRect(wx - Math.round(2 * s), wy + Math.round(33 * s), Math.round(11 * s), Math.round(3 * s));
    }

    // Grand entrance (double door with arch)
    const doorW = Math.round(16 * s);
    const doorH = Math.round(26 * s);
    const doorX = centerX - doorW / 2;
    const doorY = groundY - doorH;
    g.fillStyle(style.trim);
    g.fillRect(doorX - Math.round(4 * s), doorY - Math.round(8 * s), doorW + Math.round(8 * s), doorH + Math.round(8 * s));
    g.fillStyle(PALETTE.void);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillStyle(PALETTE.darkBrown);
    g.fillRect(doorX + Math.round(1 * s), doorY + Math.round(2 * s), doorW / 2 - Math.round(2 * s), doorH - Math.round(2 * s));
    g.fillRect(doorX + doorW / 2 + Math.round(1 * s), doorY + Math.round(2 * s), doorW / 2 - Math.round(2 * s), doorH - Math.round(2 * s));
    // Decorative pediment above door
    g.fillStyle(style.roof);
    g.fillTriangle(doorX - Math.round(6 * s), doorY - Math.round(8 * s), doorX + doorW + Math.round(6 * s), doorY - Math.round(8 * s), centerX, doorY - Math.round(20 * s));

    g.generateTexture("mansion_2", canvasWidth, canvasHeight);
    g.destroy();
  }

  // MANSION 3: Art Deco/Modern Estate with geometric shapes
  private generateMansion3_ArtDecoEstate(s: number, canvasWidth: number, canvasHeight: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const style = { base: PALETTE.gray, roof: PALETTE.lightGray, trim: PALETTE.silver, window: PALETTE.lightBlue, column: PALETTE.white };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight;

    // STEPPED FACADE - 3 blocks of different heights
    // Center block (tallest)
    const centerW = Math.round(30 * s);
    const centerH = Math.round(90 * s);
    const centerBlockX = centerX - centerW / 2;
    const centerY = groundY - centerH;

    g.fillStyle(PALETTE.void, 0.35);
    g.fillRect(centerBlockX + Math.round(4 * s), centerY + Math.round(5 * s), centerW, centerH);
    g.fillStyle(style.base);
    g.fillRect(centerBlockX, centerY, centerW, centerH);

    // Left block (medium)
    const sideW = Math.round(22 * s);
    const leftH = Math.round(65 * s);
    const leftX = centerBlockX - sideW + Math.round(3 * s);
    const leftY = groundY - leftH;
    g.fillStyle(PALETTE.void, 0.3);
    g.fillRect(leftX + Math.round(3 * s), leftY + Math.round(4 * s), sideW, leftH);
    g.fillStyle(lighten(style.base, 0.08));
    g.fillRect(leftX, leftY, sideW, leftH);

    // Right block (shortest)
    const rightH = Math.round(50 * s);
    const rightX = centerBlockX + centerW - Math.round(3 * s);
    const rightY = groundY - rightH;
    g.fillStyle(PALETTE.void, 0.3);
    g.fillRect(rightX + Math.round(3 * s), rightY + Math.round(4 * s), sideW, rightH);
    g.fillStyle(darken(style.base, 0.08));
    g.fillRect(rightX, rightY, sideW, rightH);

    // FLAT ROOFS with geometric trim
    g.fillStyle(style.trim);
    g.fillRect(centerBlockX - Math.round(2 * s), centerY - Math.round(4 * s), centerW + Math.round(4 * s), Math.round(6 * s));
    g.fillRect(leftX - Math.round(1 * s), leftY - Math.round(3 * s), sideW + Math.round(2 * s), Math.round(5 * s));
    g.fillRect(rightX - Math.round(1 * s), rightY - Math.round(3 * s), sideW + Math.round(2 * s), Math.round(5 * s));

    // ART DECO SPIRE on center
    const spireW = Math.round(10 * s);
    const spireH = Math.round(25 * s);
    g.fillStyle(style.trim);
    g.fillRect(centerX - spireW / 2, centerY - Math.round(4 * s) - spireH, spireW, spireH);
    // Stepped top
    g.fillRect(centerX - Math.round(7 * s), centerY - Math.round(4 * s) - spireH, Math.round(14 * s), Math.round(4 * s));
    g.fillRect(centerX - Math.round(4 * s), centerY - Math.round(4 * s) - spireH - Math.round(6 * s), Math.round(8 * s), Math.round(6 * s));
    g.fillStyle(style.window);
    g.fillRect(centerX - Math.round(2 * s), centerY - Math.round(4 * s) - spireH + Math.round(6 * s), Math.round(4 * s), Math.round(12 * s));

    // GEOMETRIC WINDOWS - vertical bands
    // Center block - 2 tall window strips
    for (let col = 0; col < 2; col++) {
      const wx = centerBlockX + Math.round(5 * s) + col * Math.round(15 * s);
      g.fillStyle(style.window, 0.3);
      g.fillRect(wx - Math.round(1 * s), centerY + Math.round(10 * s), Math.round(10 * s), Math.round(70 * s));
      g.fillStyle(style.window);
      g.fillRect(wx, centerY + Math.round(12 * s), Math.round(8 * s), Math.round(66 * s));
      // Horizontal dividers
      for (let d = 0; d < 4; d++) {
        g.fillStyle(style.trim);
        g.fillRect(wx, centerY + Math.round(12 * s) + d * Math.round(18 * s), Math.round(8 * s), Math.round(2 * s));
      }
    }

    // Left block windows (single column)
    g.fillStyle(style.window, 0.3);
    g.fillRect(leftX + Math.round(6 * s), leftY + Math.round(8 * s), Math.round(10 * s), Math.round(45 * s));
    g.fillStyle(style.window);
    g.fillRect(leftX + Math.round(7 * s), leftY + Math.round(10 * s), Math.round(8 * s), Math.round(41 * s));

    // Right block windows (single column)
    g.fillStyle(style.window, 0.3);
    g.fillRect(rightX + Math.round(6 * s), rightY + Math.round(8 * s), Math.round(10 * s), Math.round(30 * s));
    g.fillStyle(style.window);
    g.fillRect(rightX + Math.round(7 * s), rightY + Math.round(10 * s), Math.round(8 * s), Math.round(26 * s));

    // HORIZONTAL SPEED LINES (Art Deco motif)
    g.fillStyle(style.trim, 0.7);
    for (let line = 0; line < 3; line++) {
      const ly = centerY + Math.round(25 * s) + line * Math.round(25 * s);
      g.fillRect(leftX, ly, Math.round(70 * s), Math.round(2 * s));
    }

    // Modern geometric entrance
    const doorW = Math.round(12 * s);
    const doorH = Math.round(22 * s);
    const doorX = centerX - doorW / 2;
    const doorY = groundY - doorH;
    g.fillStyle(style.trim);
    g.fillRect(doorX - Math.round(4 * s), doorY - Math.round(6 * s), doorW + Math.round(8 * s), doorH + Math.round(6 * s));
    g.fillStyle(PALETTE.void);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillStyle(style.window);
    g.fillRect(doorX + Math.round(2 * s), doorY + Math.round(2 * s), doorW - Math.round(4 * s), Math.round(10 * s));

    g.generateTexture("mansion_3", canvasWidth, canvasHeight);
    g.destroy();
  }

  // MANSION 4: Colonial Manor with wide portico
  private generateMansion4_ColonialManor(s: number, canvasWidth: number, canvasHeight: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const style = { base: PALETTE.darkGreen, roof: PALETTE.forest, trim: PALETTE.bagsGreen, window: PALETTE.mint, column: PALETTE.cream };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight;

    // Wide, low main body
    const mainW = Math.round(70 * s);
    const mainH = Math.round(55 * s);
    const mainX = centerX - mainW / 2;
    const mainY = groundY - mainH;

    g.fillStyle(PALETTE.void, 0.4);
    g.fillRect(mainX + Math.round(4 * s), mainY + Math.round(5 * s), mainW, mainH);
    g.fillStyle(style.base);
    g.fillRect(mainX, mainY, mainW, mainH);
    g.fillStyle(lighten(style.base, 0.12));
    g.fillRect(mainX, mainY, Math.round(4 * s), mainH);

    // LOW HIPPED ROOF
    const roofH = Math.round(22 * s);
    g.fillStyle(style.roof);
    // Main roof shape - trapezoid
    g.fillRect(mainX - Math.round(6 * s), mainY - roofH, mainW + Math.round(12 * s), roofH);
    // Sloped edges
    g.fillStyle(darken(style.roof, 0.15));
    g.fillTriangle(mainX - Math.round(6 * s), mainY, mainX - Math.round(6 * s), mainY - roofH, mainX + Math.round(10 * s), mainY - roofH);
    g.fillTriangle(mainX + mainW + Math.round(6 * s), mainY, mainX + mainW + Math.round(6 * s), mainY - roofH, mainX + mainW - Math.round(10 * s), mainY - roofH);
    g.fillStyle(lighten(style.roof, 0.15));
    g.fillRect(mainX - Math.round(6 * s), mainY - roofH, mainW + Math.round(12 * s), Math.round(3 * s));

    // CENTRAL DORMER
    const dormerW = Math.round(18 * s);
    const dormerH = Math.round(20 * s);
    const dormerX = centerX - dormerW / 2;
    const dormerY = mainY - roofH - dormerH + Math.round(8 * s);
    g.fillStyle(style.base);
    g.fillRect(dormerX, dormerY + Math.round(8 * s), dormerW, dormerH - Math.round(6 * s));
    g.fillStyle(style.roof);
    g.fillTriangle(dormerX - Math.round(3 * s), dormerY + Math.round(8 * s), dormerX + dormerW + Math.round(3 * s), dormerY + Math.round(8 * s), centerX, dormerY - Math.round(5 * s));
    // Dormer window
    g.fillStyle(style.window);
    g.fillRect(dormerX + Math.round(4 * s), dormerY + Math.round(12 * s), Math.round(10 * s), Math.round(10 * s));

    // TWO CHIMNEYS (symmetrical)
    g.fillStyle(PALETTE.brick);
    g.fillRect(mainX + Math.round(10 * s), mainY - roofH - Math.round(15 * s), Math.round(6 * s), Math.round(20 * s));
    g.fillRect(mainX + mainW - Math.round(16 * s), mainY - roofH - Math.round(15 * s), Math.round(6 * s), Math.round(20 * s));
    g.fillStyle(darken(PALETTE.brick, 0.2));
    g.fillRect(mainX + Math.round(10 * s), mainY - roofH - Math.round(15 * s), Math.round(6 * s), Math.round(2 * s));
    g.fillRect(mainX + mainW - Math.round(16 * s), mainY - roofH - Math.round(15 * s), Math.round(6 * s), Math.round(2 * s));

    // WIDE COLUMNED PORTICO (full width)
    const porticoY = mainY + Math.round(20 * s);
    g.fillStyle(style.roof);
    g.fillRect(mainX - Math.round(3 * s), porticoY - Math.round(4 * s), mainW + Math.round(6 * s), Math.round(6 * s));

    // 6 evenly spaced columns
    const colCount = 6;
    const colSpacing = (mainW - Math.round(10 * s)) / (colCount - 1);
    for (let c = 0; c < colCount; c++) {
      const cx = mainX + Math.round(5 * s) + c * colSpacing;
      g.fillStyle(style.column);
      g.fillRect(cx, porticoY, Math.round(4 * s), mainH - Math.round(20 * s));
      g.fillStyle(PALETTE.white);
      g.fillRect(cx, porticoY, Math.round(1 * s), mainH - Math.round(20 * s));
      // Capital
      g.fillStyle(style.trim);
      g.fillRect(cx - Math.round(1 * s), porticoY - Math.round(2 * s), Math.round(6 * s), Math.round(3 * s));
    }

    // Windows above portico (5 symmetrical)
    for (let w = 0; w < 5; w++) {
      const wx = mainX + Math.round(8 * s) + w * Math.round(13 * s);
      const wy = mainY + Math.round(5 * s);
      g.fillStyle(style.window, 0.25);
      g.fillRect(wx - Math.round(1 * s), wy - Math.round(1 * s), Math.round(9 * s), Math.round(12 * s));
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(7 * s), Math.round(10 * s));
      // Shutters
      g.fillStyle(darken(style.base, 0.2));
      g.fillRect(wx - Math.round(3 * s), wy, Math.round(2 * s), Math.round(10 * s));
      g.fillRect(wx + Math.round(8 * s), wy, Math.round(2 * s), Math.round(10 * s));
    }

    // CENTRAL DOOR (under portico, wider colonial style)
    const doorW = Math.round(14 * s);
    const doorH = Math.round(28 * s);
    const doorX = centerX - doorW / 2;
    const doorY = groundY - doorH;
    g.fillStyle(style.trim);
    g.fillRect(doorX - Math.round(3 * s), doorY - Math.round(4 * s), doorW + Math.round(6 * s), doorH + Math.round(4 * s));
    g.fillStyle(PALETTE.void);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillStyle(PALETTE.darkBrown);
    g.fillRect(doorX + Math.round(1 * s), doorY + Math.round(2 * s), doorW - Math.round(2 * s), doorH - Math.round(2 * s));
    // Sidelights
    g.fillStyle(style.window);
    g.fillRect(doorX - Math.round(2 * s), doorY + Math.round(4 * s), Math.round(2 * s), Math.round(20 * s));
    g.fillRect(doorX + doorW, doorY + Math.round(4 * s), Math.round(2 * s), Math.round(20 * s));
    // Transom
    g.fillStyle(style.window);
    g.fillRect(doorX, doorY - Math.round(2 * s), doorW, Math.round(4 * s));

    g.generateTexture("mansion_4", canvasWidth, canvasHeight);
    g.destroy();
  }

  /**
   * Generate Academy buildings - Hogwarts-style educational campus
   * Each building represents a team member's domain with unique architectural style
   */
  private generateAcademyBuildings(): void {
    const s = SCALE;

    // Academy building styles - Hogwarts-inspired gothic/academic architecture
    const academyBuildings = [
      {
        name: "clock_tower", // Main Hall - Finn (Dean)
        base: PALETTE.gray,
        roof: PALETTE.navy,
        accent: PALETTE.gold,
        trim: PALETTE.lightGray,
        hasTower: true,
        hasClock: true,
      },
      {
        name: "library", // Engineering Lab - Ramo (CTO)
        base: PALETTE.midGray,
        roof: PALETTE.blue,
        accent: PALETTE.cyan,
        trim: PALETTE.silver,
        hasArches: true,
        hasBooks: true,
      },
      {
        name: "art_studio", // Design Studio - Sincara
        base: PALETTE.lightGray,
        roof: 0xec4899, // Pink
        accent: PALETTE.lavender,
        trim: PALETTE.white,
        hasLargeDoor: true,
        hasPalette: true,
      },
      {
        name: "observatory", // R&D Lab - Alaa (Skunk Works)
        base: PALETTE.darkGray,
        roof: PALETTE.violet,
        accent: PALETTE.purple,
        trim: PALETTE.silver,
        hasDome: true,
        hasTelescope: true,
      },
      {
        name: "greenhouse", // Student Services - Stuu
        base: PALETTE.forest,
        roof: PALETTE.bagsGreen,
        accent: PALETTE.mint,
        trim: PALETTE.cream,
        hasGlass: true,
        hasPlants: true,
      },
      {
        name: "amphitheater", // Marketing Hall - Sam
        base: PALETTE.amber,
        roof: PALETTE.gold,
        accent: PALETTE.yellow,
        trim: PALETTE.white,
        hasStage: true,
        hasLights: true,
      },
      {
        name: "welcome_hall", // Welcome Center - Carlo
        base: PALETTE.cream,
        roof: PALETTE.bagsGreen,
        accent: PALETTE.forest,
        trim: PALETTE.gold,
        hasColumns: true,
        hasBanner: true,
      },
      {
        name: "broadcast_tower", // Media Center - BNN
        base: PALETTE.sky,
        roof: PALETTE.navy,
        accent: PALETTE.cyan,
        trim: PALETTE.lightBlue,
        hasAntenna: true,
        hasScreen: true,
      },
    ];

    // Standard dimensions for academy buildings
    const bWidth = Math.round(50 * s);
    const bHeight = Math.round(90 * s);
    const canvasWidth = Math.round(60 * s);
    const canvasHeight = Math.round(150 * s);

    academyBuildings.forEach((style, index) => {
      const g = this.make.graphics({ x: 0, y: 0 });
      const baseY = canvasHeight - bHeight;
      const centerX = canvasWidth / 2;

      // Drop shadow
      g.fillStyle(PALETTE.void, 0.5);
      g.fillRect(
        Math.round(6 * s),
        baseY + Math.round(6 * s),
        bWidth - Math.round(4 * s),
        bHeight
      );

      // Main building body
      g.fillStyle(style.base);
      g.fillRect(Math.round(4 * s), baseY, bWidth - Math.round(4 * s), bHeight);

      // Highlight left edge
      g.fillStyle(lighten(style.base, 0.15));
      g.fillRect(Math.round(4 * s), baseY, Math.round(6 * s), bHeight);

      // Shadow right edge
      g.fillStyle(darken(style.base, 0.2));
      g.fillRect(bWidth - Math.round(6 * s), baseY, Math.round(6 * s), bHeight);

      // Dithering pattern for stone texture
      g.fillStyle(darken(style.base, 0.1));
      for (let py = 0; py < bHeight; py += Math.round(8 * s)) {
        for (let px = Math.round(8 * s); px < bWidth - Math.round(8 * s); px += Math.round(12 * s)) {
          if ((py / Math.round(8 * s) + px / Math.round(12 * s)) % 2 === 0) {
            g.fillRect(Math.round(4 * s) + px, baseY + py, Math.round(10 * s), Math.round(6 * s));
          }
        }
      }

      // Roof based on building type
      const roofY = baseY - Math.round(20 * s);

      if (style.hasDome) {
        // Observatory dome
        g.fillStyle(style.roof);
        g.fillCircle(centerX, roofY + Math.round(5 * s), Math.round(22 * s));
        g.fillStyle(lighten(style.roof, 0.2));
        g.fillCircle(centerX - Math.round(5 * s), roofY - Math.round(2 * s), Math.round(8 * s));
        // Dome slit
        g.fillStyle(darken(style.roof, 0.3));
        g.fillRect(centerX - Math.round(2 * s), roofY - Math.round(15 * s), Math.round(4 * s), Math.round(20 * s));
      } else if (style.hasTower) {
        // Clock tower peaked roof
        g.fillStyle(style.roof);
        g.beginPath();
        g.moveTo(0, baseY);
        g.lineTo(centerX, roofY - Math.round(25 * s));
        g.lineTo(canvasWidth - Math.round(4 * s), baseY);
        g.closePath();
        g.fill();
        // Roof highlight
        g.fillStyle(lighten(style.roof, 0.2));
        g.beginPath();
        g.moveTo(0, baseY);
        g.lineTo(centerX, roofY - Math.round(25 * s));
        g.lineTo(centerX, roofY - Math.round(18 * s));
        g.lineTo(Math.round(6 * s), baseY);
        g.closePath();
        g.fill();
        // Spire
        g.fillStyle(style.accent);
        g.fillRect(centerX - Math.round(2 * s), roofY - Math.round(40 * s), Math.round(4 * s), Math.round(20 * s));
        g.fillCircle(centerX, roofY - Math.round(42 * s), Math.round(4 * s));
      } else if (style.hasGlass) {
        // Greenhouse glass roof
        g.fillStyle(PALETTE.lightBlue, 0.6);
        g.beginPath();
        g.moveTo(Math.round(2 * s), baseY);
        g.lineTo(centerX, roofY);
        g.lineTo(canvasWidth - Math.round(6 * s), baseY);
        g.closePath();
        g.fill();
        // Glass frame lines
        g.fillStyle(style.trim);
        g.fillRect(centerX - Math.round(1 * s), roofY, Math.round(2 * s), baseY - roofY);
        for (let i = 1; i <= 3; i++) {
          const lineY = roofY + (baseY - roofY) * (i / 4);
          g.fillRect(Math.round(4 * s) + i * Math.round(5 * s), lineY, bWidth - Math.round(8 * s) - i * Math.round(10 * s), Math.round(2 * s));
        }
      } else if (style.hasAntenna) {
        // Broadcast tower flat roof with antenna
        g.fillStyle(style.roof);
        g.fillRect(0, baseY - Math.round(8 * s), bWidth + Math.round(8 * s), Math.round(12 * s));
        g.fillStyle(lighten(style.roof, 0.15));
        g.fillRect(0, baseY - Math.round(8 * s), bWidth + Math.round(8 * s), Math.round(3 * s));
        // Main antenna
        g.fillStyle(PALETTE.lightGray);
        g.fillRect(centerX - Math.round(2 * s), roofY - Math.round(35 * s), Math.round(4 * s), Math.round(45 * s));
        // Satellite dish
        g.fillStyle(PALETTE.silver);
        g.fillCircle(centerX + Math.round(12 * s), roofY - Math.round(10 * s), Math.round(8 * s));
        g.fillStyle(PALETTE.lightGray);
        g.fillCircle(centerX + Math.round(12 * s), roofY - Math.round(10 * s), Math.round(4 * s));
        // Blinking light
        g.fillStyle(PALETTE.brightRed);
        g.fillCircle(centerX, roofY - Math.round(38 * s), Math.round(3 * s));
      } else {
        // Standard peaked roof
        g.fillStyle(style.roof);
        g.beginPath();
        g.moveTo(0, baseY);
        g.lineTo(centerX, roofY);
        g.lineTo(canvasWidth - Math.round(4 * s), baseY);
        g.closePath();
        g.fill();
        // Roof highlight
        g.fillStyle(lighten(style.roof, 0.2));
        g.beginPath();
        g.moveTo(0, baseY);
        g.lineTo(centerX, roofY);
        g.lineTo(centerX, roofY + Math.round(6 * s));
        g.lineTo(Math.round(6 * s), baseY);
        g.closePath();
        g.fill();
      }

      // Windows - 2 rows x 2 columns (gothic arched style)
      const windowColor = style.hasGlass ? PALETTE.mint : PALETTE.lightBlue;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const wx = Math.round(10 * s) + col * Math.round(18 * s);
          const wy = baseY + Math.round(15 * s) + row * Math.round(25 * s);

          // Window glow
          g.fillStyle(windowColor, 0.25);
          g.fillRect(wx - Math.round(1 * s), wy - Math.round(1 * s), Math.round(14 * s), Math.round(18 * s));

          // Gothic arch window
          g.fillStyle(windowColor);
          g.fillRect(wx, wy + Math.round(4 * s), Math.round(12 * s), Math.round(14 * s));
          g.fillCircle(wx + Math.round(6 * s), wy + Math.round(4 * s), Math.round(6 * s));

          // Window highlight
          g.fillStyle(lighten(windowColor, 0.3));
          g.fillRect(wx + Math.round(2 * s), wy + Math.round(6 * s), Math.round(3 * s), Math.round(4 * s));

          // Window frame divider
          g.fillStyle(style.trim);
          g.fillRect(wx + Math.round(5 * s), wy + Math.round(4 * s), Math.round(2 * s), Math.round(14 * s));
        }
      }

      // Clock face for clock tower
      if (style.hasClock) {
        const clockY = baseY + Math.round(8 * s);
        g.fillStyle(PALETTE.cream);
        g.fillCircle(centerX, clockY, Math.round(10 * s));
        g.fillStyle(PALETTE.darkGray);
        g.fillCircle(centerX, clockY, Math.round(8 * s));
        g.fillStyle(style.accent);
        g.fillCircle(centerX, clockY, Math.round(6 * s));
        // Clock hands
        g.fillStyle(PALETTE.darkGray);
        g.fillRect(centerX - Math.round(1 * s), clockY - Math.round(5 * s), Math.round(2 * s), Math.round(5 * s));
        g.fillRect(centerX, clockY - Math.round(1 * s), Math.round(4 * s), Math.round(2 * s));
      }

      // Books/scrolls for library
      if (style.hasBooks) {
        const bookY = baseY + Math.round(65 * s);
        const bookColors = [PALETTE.brightRed, PALETTE.forest, PALETTE.navy, PALETTE.amber];
        bookColors.forEach((color, i) => {
          g.fillStyle(color);
          g.fillRect(Math.round(8 * s) + i * Math.round(8 * s), bookY, Math.round(6 * s), Math.round(12 * s));
        });
      }

      // Art palette for studio
      if (style.hasPalette) {
        g.fillStyle(PALETTE.brown);
        g.fillCircle(bWidth - Math.round(12 * s), baseY + Math.round(20 * s), Math.round(8 * s));
        const paletteColors = [PALETTE.brightRed, PALETTE.yellow, PALETTE.blue, PALETTE.bagsGreen];
        paletteColors.forEach((color, i) => {
          g.fillStyle(color);
          g.fillCircle(
            bWidth - Math.round(14 * s) + (i % 2) * Math.round(6 * s),
            baseY + Math.round(18 * s) + Math.floor(i / 2) * Math.round(5 * s),
            Math.round(2 * s)
          );
        });
      }

      // Telescope for observatory
      if (style.hasTelescope) {
        g.fillStyle(PALETTE.darkGray);
        g.fillRect(centerX + Math.round(8 * s), roofY - Math.round(25 * s), Math.round(4 * s), Math.round(18 * s));
        g.fillStyle(PALETTE.lightGray);
        g.fillCircle(centerX + Math.round(10 * s), roofY - Math.round(28 * s), Math.round(5 * s));
      }

      // Plants for greenhouse
      if (style.hasPlants) {
        const plantColors = [PALETTE.bagsGreen, PALETTE.forest, PALETTE.mint];
        for (let i = 0; i < 3; i++) {
          g.fillStyle(plantColors[i]);
          g.fillCircle(
            Math.round(12 * s) + i * Math.round(12 * s),
            baseY + Math.round(70 * s),
            Math.round(6 * s)
          );
        }
        // Flower pots
        g.fillStyle(PALETTE.brown);
        for (let i = 0; i < 3; i++) {
          g.fillRect(
            Math.round(8 * s) + i * Math.round(12 * s),
            baseY + Math.round(72 * s),
            Math.round(8 * s),
            Math.round(8 * s)
          );
        }
      }

      // Stage lights for amphitheater
      if (style.hasLights) {
        const lightPositions = [Math.round(8 * s), centerX, bWidth - Math.round(4 * s)];
        lightPositions.forEach((lx) => {
          g.fillStyle(PALETTE.yellow, 0.6);
          g.fillCircle(lx, baseY - Math.round(5 * s), Math.round(6 * s));
          g.fillStyle(PALETTE.gold);
          g.fillCircle(lx, baseY - Math.round(5 * s), Math.round(4 * s));
        });
      }

      // Columns for welcome hall
      if (style.hasColumns) {
        const columnWidth = Math.round(5 * s);
        const columnHeight = Math.round(45 * s);
        const columnY = canvasHeight - columnHeight;
        // Left column
        g.fillStyle(style.trim);
        g.fillRect(Math.round(10 * s), columnY, columnWidth, columnHeight);
        g.fillStyle(darken(style.trim, 0.15));
        g.fillRect(Math.round(10 * s) + columnWidth - Math.round(1 * s), columnY, Math.round(1 * s), columnHeight);
        // Right column
        g.fillStyle(style.trim);
        g.fillRect(bWidth - Math.round(11 * s), columnY, columnWidth, columnHeight);
        // Column caps
        g.fillStyle(style.trim);
        g.fillRect(Math.round(8 * s), columnY - Math.round(3 * s), columnWidth + Math.round(4 * s), Math.round(3 * s));
        g.fillRect(bWidth - Math.round(13 * s), columnY - Math.round(3 * s), columnWidth + Math.round(4 * s), Math.round(3 * s));
      }

      // Screen for broadcast tower
      if (style.hasScreen) {
        g.fillStyle(PALETTE.darkGray);
        g.fillRect(Math.round(8 * s), baseY + Math.round(12 * s), bWidth - Math.round(12 * s), Math.round(20 * s));
        g.fillStyle(PALETTE.cyan, 0.8);
        g.fillRect(Math.round(10 * s), baseY + Math.round(14 * s), bWidth - Math.round(16 * s), Math.round(16 * s));
        // Screen glow
        g.fillStyle(PALETTE.cyan, 0.3);
        g.fillRect(Math.round(6 * s), baseY + Math.round(10 * s), bWidth - Math.round(8 * s), Math.round(24 * s));
      }

      // Door
      const doorWidth = Math.round(14 * s);
      const doorHeight = Math.round(20 * s);
      const doorX = centerX - doorWidth / 2;

      // Door frame
      g.fillStyle(style.accent);
      g.fillRect(doorX - Math.round(2 * s), canvasHeight - doorHeight - Math.round(2 * s), doorWidth + Math.round(4 * s), doorHeight + Math.round(2 * s));

      // Gothic arch door
      g.fillStyle(PALETTE.darkBrown);
      g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);
      // Arch top
      g.fillCircle(doorX + doorWidth / 2, canvasHeight - doorHeight, doorWidth / 2);

      // Door highlight
      g.fillStyle(lighten(PALETTE.darkBrown, 0.1));
      g.fillRect(doorX + Math.round(2 * s), canvasHeight - doorHeight + Math.round(4 * s), Math.round(3 * s), doorHeight - Math.round(6 * s));

      // Door knocker
      g.fillStyle(style.accent);
      g.fillCircle(doorX + doorWidth / 2, canvasHeight - doorHeight / 2, Math.round(2 * s));

      // Building name plaque
      g.fillStyle(PALETTE.darkGray);
      g.fillRect(Math.round(8 * s), baseY + Math.round(3 * s), bWidth - Math.round(12 * s), Math.round(8 * s));
      g.fillStyle(style.accent);
      g.fillRect(Math.round(10 * s), baseY + Math.round(4 * s), bWidth - Math.round(16 * s), Math.round(6 * s));

      g.generateTexture(`academy_${index}`, canvasWidth, canvasHeight);
      g.destroy();
    });

    // Generate Academy entrance gate
    this.generateAcademyGate();
  }

  /**
   * Generate the grand entrance gate for the Academy
   */
  private generateAcademyGate(): void {
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasWidth = Math.round(120 * s);
    const canvasHeight = Math.round(100 * s);

    const gateHeight = Math.round(70 * s);
    const pillarWidth = Math.round(15 * s);

    // Left pillar
    g.fillStyle(PALETTE.gray);
    g.fillRect(Math.round(10 * s), canvasHeight - gateHeight, pillarWidth, gateHeight);
    g.fillStyle(lighten(PALETTE.gray, 0.15));
    g.fillRect(Math.round(10 * s), canvasHeight - gateHeight, Math.round(4 * s), gateHeight);
    // Left pillar cap
    g.fillStyle(PALETTE.gold);
    g.fillRect(Math.round(8 * s), canvasHeight - gateHeight - Math.round(8 * s), pillarWidth + Math.round(4 * s), Math.round(10 * s));
    // Left finial
    g.fillCircle(Math.round(10 * s) + pillarWidth / 2, canvasHeight - gateHeight - Math.round(14 * s), Math.round(6 * s));

    // Right pillar
    g.fillStyle(PALETTE.gray);
    g.fillRect(canvasWidth - Math.round(25 * s), canvasHeight - gateHeight, pillarWidth, gateHeight);
    g.fillStyle(lighten(PALETTE.gray, 0.15));
    g.fillRect(canvasWidth - Math.round(25 * s), canvasHeight - gateHeight, Math.round(4 * s), gateHeight);
    // Right pillar cap
    g.fillStyle(PALETTE.gold);
    g.fillRect(canvasWidth - Math.round(27 * s), canvasHeight - gateHeight - Math.round(8 * s), pillarWidth + Math.round(4 * s), Math.round(10 * s));
    // Right finial
    g.fillCircle(canvasWidth - Math.round(25 * s) + pillarWidth / 2, canvasHeight - gateHeight - Math.round(14 * s), Math.round(6 * s));

    // Arch connecting pillars
    g.fillStyle(PALETTE.gold);
    g.fillRect(Math.round(25 * s), canvasHeight - gateHeight - Math.round(4 * s), canvasWidth - Math.round(50 * s), Math.round(8 * s));

    // "BAGS ACADEMY" banner on arch
    g.fillStyle(PALETTE.navy);
    g.fillRect(Math.round(30 * s), canvasHeight - gateHeight - Math.round(22 * s), canvasWidth - Math.round(60 * s), Math.round(18 * s));
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(Math.round(32 * s), canvasHeight - gateHeight - Math.round(20 * s), canvasWidth - Math.round(64 * s), Math.round(14 * s));

    // Decorative crest/shield at top
    const crestX = canvasWidth / 2;
    const crestY = canvasHeight - gateHeight - Math.round(32 * s);
    g.fillStyle(PALETTE.gold);
    g.beginPath();
    g.moveTo(crestX, crestY - Math.round(12 * s));
    g.lineTo(crestX + Math.round(12 * s), crestY);
    g.lineTo(crestX + Math.round(10 * s), crestY + Math.round(15 * s));
    g.lineTo(crestX, crestY + Math.round(20 * s));
    g.lineTo(crestX - Math.round(10 * s), crestY + Math.round(15 * s));
    g.lineTo(crestX - Math.round(12 * s), crestY);
    g.closePath();
    g.fill();
    // Crest inner
    g.fillStyle(PALETTE.bagsGreen);
    g.beginPath();
    g.moveTo(crestX, crestY - Math.round(8 * s));
    g.lineTo(crestX + Math.round(8 * s), crestY + Math.round(2 * s));
    g.lineTo(crestX + Math.round(6 * s), crestY + Math.round(12 * s));
    g.lineTo(crestX, crestY + Math.round(16 * s));
    g.lineTo(crestX - Math.round(6 * s), crestY + Math.round(12 * s));
    g.lineTo(crestX - Math.round(8 * s), crestY + Math.round(2 * s));
    g.closePath();
    g.fill();
    // "B" on crest
    g.fillStyle(PALETTE.gold);
    g.fillRect(crestX - Math.round(3 * s), crestY, Math.round(2 * s), Math.round(10 * s));
    g.fillRect(crestX - Math.round(3 * s), crestY, Math.round(6 * s), Math.round(2 * s));
    g.fillRect(crestX - Math.round(3 * s), crestY + Math.round(4 * s), Math.round(5 * s), Math.round(2 * s));
    g.fillRect(crestX - Math.round(3 * s), crestY + Math.round(8 * s), Math.round(6 * s), Math.round(2 * s));
    g.fillRect(crestX + Math.round(1 * s), crestY, Math.round(2 * s), Math.round(5 * s));
    g.fillRect(crestX + Math.round(2 * s), crestY + Math.round(4 * s), Math.round(2 * s), Math.round(5 * s));

    // Iron gates (decorative bars)
    g.fillStyle(PALETTE.darkGray);
    for (let i = 0; i < 5; i++) {
      const barX = Math.round(32 * s) + i * Math.round(14 * s);
      g.fillRect(barX, canvasHeight - gateHeight + Math.round(10 * s), Math.round(3 * s), gateHeight - Math.round(12 * s));
    }
    // Horizontal bar
    g.fillRect(Math.round(28 * s), canvasHeight - Math.round(30 * s), canvasWidth - Math.round(56 * s), Math.round(3 * s));

    g.generateTexture("academy_gate", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateDiverseCharacters(): void {
    // Generate multiple character variants for diversity
    for (let i = 0; i < 9; i++) {
      const skinTone = SKIN_TONES[i % SKIN_TONES.length];
      const hairColor = HAIR_COLORS[i % HAIR_COLORS.length];
      const shirtColor = SHIRT_COLORS[i % SHIRT_COLORS.length];

      // Neutral state
      this.createCharacterSprite(`character_${i}`, skinTone, hairColor, shirtColor, "neutral");
      // Happy state
      this.createCharacterSprite(`character_${i}_happy`, skinTone, hairColor, shirtColor, "happy");
      // Sad state
      this.createCharacterSprite(`character_${i}_sad`, skinTone, hairColor, shirtColor, "sad");
      // Celebrating state
      this.createCharacterSprite(
        `character_${i}_celebrating`,
        skinTone,
        hairColor,
        shirtColor,
        "celebrating"
      );
    }

    // Keep default textures for backward compatibility
    this.createCharacterSprite(
      "character",
      SKIN_TONES[0],
      HAIR_COLORS[0],
      SHIRT_COLORS[0],
      "neutral"
    );
    this.createCharacterSprite(
      "character_happy",
      SKIN_TONES[0],
      HAIR_COLORS[0],
      SHIRT_COLORS[0],
      "happy"
    );
    this.createCharacterSprite(
      "character_sad",
      SKIN_TONES[0],
      HAIR_COLORS[0],
      SHIRT_COLORS[0],
      "sad"
    );
    this.createCharacterSprite(
      "character_celebrating",
      SKIN_TONES[0],
      HAIR_COLORS[0],
      SHIRT_COLORS[0],
      "celebrating"
    );

    // Generate Toly - Solana co-founder special character
    this.generateTolySprite();

    // Generate Ash Ketchum - ecosystem guide character
    this.generateAshSprite();

    // Generate Finn - Bags.fm founder
    this.generateFinnSprite();

    // Generate The Dev (DaddyGhost) - trading agent character
    this.generateDevSprite();

    // Generate Neo - The Scout Agent
    this.generateNeoSprite();

    // Generate CJ - The Hood Rat from BagsCity
    this.generateCJSprite();

    // Generate Shaw - ElizaOS creator, ai16z co-founder
    this.generateShawSprite();

    // Academy Zone - Bags.fm Team Characters
    this.generateRamoSprite();
    this.generateSincaraSprite();
    this.generateStuuSprite();
    this.generateSamSprite();
    this.generateAlaaSprite();
    this.generateCarloSprite();
    this.generateBNNSprite();
  }

  private generateTolySprite(): void {
    // Toly (Anatoly Yakovenko) - Solana co-founder
    // Casual tech look, beard, Solana purple/green colors
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf1c27d; // Light tan
    const hairColor = 0x4a3728; // Brown hair
    const beardColor = 0x5c4033; // Brown beard
    const shirtColor = 0x9945ff; // Solana purple!

    const g = this.make.graphics({ x: 0, y: 0 });

    // Solana gradient aura/glow behind Toly
    g.fillStyle(0x14f195, 0.15); // Solana green
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x9945ff, 0.1); // Solana purple
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark jeans)
    g.fillStyle(0x1e3a5f);
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

    // Shoes (casual sneakers)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    // White sole
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Body/Shirt (Solana purple hoodie)
    g.fillStyle(shirtColor);
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));

    // Hoodie details
    g.fillStyle(0x7c3aed);
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));
    g.fillRect(Math.round(21 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));

    // Solana logo on shirt (simplified S shape)
    g.fillStyle(0x14f195); // Solana green
    g.fillRect(Math.round(13 * s), Math.round(15 * s), Math.round(6 * s), Math.round(2 * s));
    g.fillRect(Math.round(13 * s), Math.round(15 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(13 * s), Math.round(17 * s), Math.round(6 * s), Math.round(2 * s));
    g.fillRect(Math.round(17 * s), Math.round(17 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(13 * s), Math.round(19 * s), Math.round(6 * s), Math.round(2 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));

    // Hair (short, casual)
    g.fillStyle(hairColor);
    g.fillRect(Math.round(9 * s), 0, Math.round(14 * s), Math.round(5 * s));
    g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(2 * s), Math.round(4 * s));

    // Beard (short, well-groomed)
    g.fillStyle(beardColor);
    g.fillRect(Math.round(10 * s), Math.round(10 * s), Math.round(12 * s), Math.round(4 * s));
    g.fillRect(Math.round(11 * s), Math.round(9 * s), Math.round(10 * s), Math.round(2 * s));
    // Chin
    g.fillRect(Math.round(12 * s), Math.round(13 * s), Math.round(8 * s), Math.round(1 * s));

    // Eyes (friendly, focused)
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
    // Pupils
    g.fillStyle(0x1e3a5f); // Blue-ish
    g.fillRect(Math.round(13 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(19 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));

    // Friendly smile under beard
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(14 * s), Math.round(11 * s), Math.round(4 * s), Math.round(1 * s));

    // Solana symbol above head (instead of question mark)
    g.fillStyle(0x14f195);
    g.fillRect(Math.round(12 * s), Math.round(-4 * s), Math.round(8 * s), Math.round(2 * s));
    g.fillStyle(0x9945ff);
    g.fillRect(Math.round(14 * s), Math.round(-6 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillStyle(0x14f195);
    g.fillRect(Math.round(13 * s), Math.round(-2 * s), Math.round(6 * s), Math.round(2 * s));

    g.generateTexture("toly", size, size);
    g.destroy();
  }

  private generateAshSprite(): void {
    // Ash Ketchum - Pokemon trainer style with iconic cap
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xffdbac; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (blue jeans)
    g.fillStyle(0x1e40af);
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

    // Shoes (red/black sneakers)
    g.fillStyle(0xdc2626);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(10 * s), Math.round(30 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(30 * s), Math.round(2 * s), Math.round(1 * s));

    // Body (blue vest over black shirt)
    g.fillStyle(0x1f2937); // Black undershirt
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));
    g.fillStyle(0x2563eb); // Blue vest
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(5 * s), Math.round(12 * s));
    g.fillRect(Math.round(19 * s), Math.round(12 * s), Math.round(5 * s), Math.round(12 * s));
    // Yellow trim on vest
    g.fillStyle(0xfbbf24);
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(1 * s), Math.round(12 * s));
    g.fillRect(Math.round(23 * s), Math.round(12 * s), Math.round(1 * s), Math.round(12 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));

    // Gloves (green fingerless)
    g.fillStyle(0x22c55e);
    g.fillRect(Math.round(5 * s), Math.round(19 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(23 * s), Math.round(19 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillStyle(skinTone);
    g.fillRect(Math.round(6 * s), Math.round(21 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(24 * s), Math.round(21 * s), Math.round(2 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));

    // Hair (black, spiky)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(9 * s), 0, Math.round(14 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(5 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(5 * s));
    // Spiky hair bits sticking out
    g.fillRect(Math.round(6 * s), Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(Math.round(12 * s), Math.round(-1 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(-1 * s), Math.round(2 * s), Math.round(2 * s));

    // Iconic Pokemon cap (red with white front and green symbol area)
    g.fillStyle(0xdc2626); // Red
    g.fillRect(Math.round(7 * s), Math.round(-2 * s), Math.round(18 * s), Math.round(5 * s));
    g.fillStyle(0xffffff); // White front panel
    g.fillRect(Math.round(11 * s), Math.round(-2 * s), Math.round(10 * s), Math.round(4 * s));
    // Green Pokemon League symbol
    g.fillStyle(0x22c55e);
    g.fillRect(Math.round(14 * s), Math.round(-1 * s), Math.round(4 * s), Math.round(2 * s));
    // Cap bill
    g.fillStyle(0xdc2626);
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(10 * s), Math.round(2 * s));

    // Face marks (Z marks on cheeks - like Ash)
    g.fillStyle(0x8b4513);
    g.fillRect(Math.round(9 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(9 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(21 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(22 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));

    // Eyes (big anime style)
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(4 * s));
    // Brown irises
    g.fillStyle(0x92400e);
    g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
    // Black pupils
    g.fillStyle(0x000000);
    g.fillRect(Math.round(13 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
    // Eye shine
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(13 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Determined smile
    g.fillStyle(0x000000);
    g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));

    // Pokeball icon floating (showing he's a trainer)
    g.fillStyle(0xdc2626);
    g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(8 * s), Math.round(2 * s));
    g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillStyle(0xdc2626);
    g.fillRect(Math.round(24 * s), 0, Math.round(8 * s), Math.round(4 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(24 * s), Math.round(4 * s), Math.round(8 * s), Math.round(4 * s));
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(8 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillStyle(0x1f2937);
    g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(1 * s));

    g.generateTexture("ash", size, size);
    g.destroy();
  }

  private generateFinnSprite(): void {
    // Finn (@finnbags) - Bags.fm CEO
    // Casual tech founder look with WIF-inspired beanie, emerald brand colors
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xffd5b4; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

    // Bags green glow behind Finn
    g.fillStyle(0x10b981, 0.15); // Emerald
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x059669, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark jeans)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

    // Shoes (white sneakers - clean founder style)
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xe5e7eb);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Body (emerald hoodie - Bags brand)
    g.fillStyle(0x10b981); // Emerald
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));

    // Hoodie details (darker sides)
    g.fillStyle(0x059669);
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));
    g.fillRect(Math.round(21 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));

    // "BAGS" text on hoodie (simplified)
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(16 * s), Math.round(2 * s), Math.round(4 * s)); // B
    g.fillRect(Math.round(11 * s), Math.round(16 * s), Math.round(4 * s), Math.round(1 * s));
    g.fillRect(Math.round(11 * s), Math.round(18 * s), Math.round(4 * s), Math.round(1 * s));
    g.fillRect(Math.round(11 * s), Math.round(20 * s), Math.round(4 * s), Math.round(1 * s));
    g.fillRect(Math.round(14 * s), Math.round(16 * s), Math.round(1 * s), Math.round(4 * s));
    g.fillRect(Math.round(16 * s), Math.round(16 * s), Math.round(3 * s), Math.round(4 * s)); // A (simplified)
    g.fillRect(Math.round(17 * s), Math.round(15 * s), Math.round(1 * s), Math.round(1 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));

    // Hair (short, neat)
    g.fillStyle(0x4a3728); // Brown
    g.fillRect(Math.round(9 * s), 0, Math.round(14 * s), Math.round(4 * s));
    g.fillRect(Math.round(8 * s), Math.round(1 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(1 * s), Math.round(2 * s), Math.round(4 * s));

    // WIF-inspired pink beanie!
    g.fillStyle(0xec4899); // Pink like WIF hat
    g.fillRect(Math.round(7 * s), Math.round(-3 * s), Math.round(18 * s), Math.round(5 * s));
    g.fillRect(Math.round(8 * s), Math.round(-4 * s), Math.round(16 * s), Math.round(2 * s));
    // Beanie fold
    g.fillStyle(0xdb2777);
    g.fillRect(Math.round(7 * s), Math.round(1 * s), Math.round(18 * s), Math.round(2 * s));

    // Eyes (friendly, entrepreneurial)
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
    // Blue pupils
    g.fillStyle(0x3b82f6);
    g.fillRect(Math.round(13 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(19 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));

    // Friendly smile
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(2 * s));
    g.fillStyle(skinTone);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

    // Money bag icon floating (showing he's about bags!)
    g.fillStyle(0xfbbf24); // Gold
    g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(26 * s), 0, Math.round(4 * s), Math.round(2 * s));
    // $ sign on bag
    g.fillStyle(0x065f46);
    g.fillRect(Math.round(27 * s), Math.round(2 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(26 * s), Math.round(3 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(29 * s), Math.round(4 * s), Math.round(1 * s), Math.round(1 * s));

    g.generateTexture("finn", size, size);
    g.destroy();
  }

  private generateDevSprite(): void {
    // DaddyGhost (@DaddyGhost) - The Dev / Trencher
    // Hacker/dev aesthetic with hoodie, glasses, ghost theme
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xe0ac69; // Medium skin
    const g = this.make.graphics({ x: 0, y: 0 });

    // Ghost/ethereal glow behind The Dev (purple/cyan hacker vibes)
    g.fillStyle(0x8b5cf6, 0.15); // Purple
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x06b6d4, 0.1); // Cyan
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (black joggers - dev uniform)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

    // Shoes (dark sneakers)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(10 * s), Math.round(30 * s), Math.round(4 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(30 * s), Math.round(4 * s), Math.round(1 * s));

    // Body (dark hoodie with hood up - mysterious dev)
    g.fillStyle(0x1f2937); // Dark gray hoodie
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));

    // Hoodie details (darker sides)
    g.fillStyle(0x111827);
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));
    g.fillRect(Math.round(21 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));

    // Hood shadow around face
    g.fillStyle(0x111827);
    g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(16 * s), Math.round(6 * s));
    g.fillRect(Math.round(7 * s), Math.round(4 * s), Math.round(2 * s), Math.round(8 * s));
    g.fillRect(Math.round(23 * s), Math.round(4 * s), Math.round(2 * s), Math.round(8 * s));

    // Ghost icon on hoodie (the brand!)
    g.fillStyle(0x8b5cf6); // Purple ghost
    g.fillRect(Math.round(13 * s), Math.round(15 * s), Math.round(6 * s), Math.round(6 * s));
    g.fillRect(Math.round(12 * s), Math.round(16 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(18 * s), Math.round(16 * s), Math.round(2 * s), Math.round(4 * s));
    // Ghost eyes
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(14 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(17 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(12 * s), Math.round(10 * s));

    // Hair (dark, messy - been coding all night)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(10 * s), Math.round(2 * s), Math.round(12 * s), Math.round(4 * s));
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(Math.round(21 * s), Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
    // Messy bits sticking out
    g.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(22 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(12 * s), Math.round(1 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(1 * s), Math.round(2 * s), Math.round(2 * s));

    // Glasses (dev essential)
    g.fillStyle(0x374151); // Frame
    g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(12 * s), Math.round(1 * s));
    g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(5 * s), Math.round(4 * s));
    g.fillRect(Math.round(17 * s), Math.round(6 * s), Math.round(5 * s), Math.round(4 * s));
    // Lens
    g.fillStyle(0x60a5fa, 0.6); // Blue tinted
    g.fillRect(Math.round(11 * s), Math.round(7 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(3 * s), Math.round(2 * s));
    // Lens shine
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(Math.round(11 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));

    // Eyes behind glasses
    g.fillStyle(0x000000);
    g.fillRect(Math.round(12 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(19 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));

    // Slight smirk (knows something you don't)
    g.fillStyle(0x000000);
    g.fillRect(Math.round(14 * s), Math.round(11 * s), Math.round(4 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));

    // Terminal/code icon floating (showing he's a dev)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(24 * s), 0, Math.round(8 * s), Math.round(8 * s));
    g.fillStyle(0x4ade80); // Green terminal text
    g.fillRect(Math.round(25 * s), Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(26 * s), Math.round(2 * s), Math.round(3 * s), Math.round(1 * s));
    g.fillRect(Math.round(25 * s), Math.round(4 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(26 * s), Math.round(4 * s), Math.round(4 * s), Math.round(1 * s));
    g.fillRect(Math.round(25 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));

    g.generateTexture("dev", size, size);
    g.destroy();
  }

  private generateNeoSprite(): void {
    // Neo - The One (Matrix-inspired Scout Agent)
    // Black coat, sunglasses, Matrix green theme
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf1c27d; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

    // Matrix green digital glow behind Neo
    g.fillStyle(0x00ff41, 0.2); // Matrix green
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x00ff41, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (black pants)
    g.fillStyle(0x0a0a0a);
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

    // Shoes (black boots)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0x0a0a0a);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Long black coat (iconic Matrix look)
    g.fillStyle(0x0a0a0a);
    g.fillRect(Math.round(6 * s), Math.round(12 * s), Math.round(20 * s), Math.round(16 * s));

    // Coat details - slightly lighter edges
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(6 * s), Math.round(12 * s), Math.round(2 * s), Math.round(16 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(2 * s), Math.round(16 * s));

    // Coat opening showing shirt
    g.fillStyle(0x111111);
    g.fillRect(Math.round(12 * s), Math.round(14 * s), Math.round(8 * s), Math.round(10 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(13 * s), Math.round(3 * s), Math.round(10 * s));
    g.fillRect(Math.round(25 * s), Math.round(13 * s), Math.round(3 * s), Math.round(10 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));

    // Hair (short, black, slicked back)
    g.fillStyle(0x0a0a0a);
    g.fillRect(Math.round(9 * s), 0, Math.round(14 * s), Math.round(5 * s));
    g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(2 * s), Math.round(3 * s));

    // Iconic sunglasses (small, round)
    g.fillStyle(0x1a1a1a); // Frame
    g.fillRect(Math.round(10 * s), Math.round(5 * s), Math.round(5 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(5 * s), Math.round(3 * s));
    g.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s)); // Bridge

    // Green lens reflection (Matrix style)
    g.fillStyle(0x00ff41, 0.6);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(1 * s));

    // Neutral expression
    g.fillStyle(0x000000);
    g.fillRect(Math.round(14 * s), Math.round(10 * s), Math.round(4 * s), Math.round(1 * s));

    // Matrix code rain effect above head (iconic)
    g.fillStyle(0x00ff41, 0.8);
    // Column 1
    g.fillRect(Math.round(8 * s), Math.round(-6 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(8 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(2 * s));
    // Column 2
    g.fillRect(Math.round(14 * s), Math.round(-4 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(14 * s), 0, Math.round(2 * s), Math.round(2 * s));
    // Column 3
    g.fillRect(Math.round(20 * s), Math.round(-6 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(20 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(2 * s));

    // Brighter "lead" characters
    g.fillStyle(0x80ff80);
    g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(14 * s), Math.round(-6 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(20 * s), Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture("neo", size, size);
    g.destroy();
  }

  private generateCJSprite(): void {
    // CJ - On-chain hood rat from BagsCity (GTA San Andreas inspired)
    // Bald head, white tank top, blue jeans - iconic Grove Street look
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0x6b4423; // Dark brown skin (CJ's actual skin tone)
    const skinHighlight = 0x7d5a3c; // Slightly lighter for depth
    const g = this.make.graphics({ x: 0, y: 0 });

    // Subtle green glow (Grove Street)
    g.fillStyle(0x00aa00, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(20 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (blue jeans - lighter blue like in GTA)
    g.fillStyle(0x4a6fa5); // Medium blue denim
    g.fillRect(Math.round(9 * s), Math.round(20 * s), Math.round(6 * s), Math.round(11 * s));
    g.fillRect(Math.round(17 * s), Math.round(20 * s), Math.round(6 * s), Math.round(11 * s));
    // Slightly darker for depth
    g.fillStyle(0x3d5a87);
    g.fillRect(Math.round(9 * s), Math.round(20 * s), Math.round(1 * s), Math.round(11 * s));
    g.fillRect(Math.round(22 * s), Math.round(20 * s), Math.round(1 * s), Math.round(11 * s));

    // Belt area (brown belt)
    g.fillStyle(0x3d2817);
    g.fillRect(Math.round(8 * s), Math.round(19 * s), Math.round(16 * s), Math.round(2 * s));
    // Belt buckle
    g.fillStyle(0x888888);
    g.fillRect(Math.round(14 * s), Math.round(19 * s), Math.round(4 * s), Math.round(2 * s));

    // Shoes (black sneakers)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(8 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));

    // White tank top (wife beater - THE iconic CJ look)
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(8 * s), Math.round(11 * s), Math.round(16 * s), Math.round(9 * s));
    // Tank top straps
    g.fillRect(Math.round(10 * s), Math.round(9 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(19 * s), Math.round(9 * s), Math.round(3 * s), Math.round(3 * s));
    // Tank top shadow/fold
    g.fillStyle(0xe8e8e8);
    g.fillRect(Math.round(8 * s), Math.round(15 * s), Math.round(16 * s), Math.round(1 * s));

    // Muscular arms (skin)
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(11 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(23 * s), Math.round(11 * s), Math.round(5 * s), Math.round(10 * s));
    // Arm highlights
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(5 * s), Math.round(12 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(2 * s), Math.round(4 * s));
    // Hands
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(20 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(24 * s), Math.round(20 * s), Math.round(4 * s), Math.round(3 * s));

    // BALD HEAD (no hair!)
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(1 * s), Math.round(14 * s), Math.round(10 * s));
    // Head shape - rounded top
    g.fillRect(Math.round(10 * s), Math.round(0 * s), Math.round(12 * s), Math.round(2 * s));
    // Head highlight (bald shine)
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(12 * s), Math.round(1 * s), Math.round(6 * s), Math.round(2 * s));

    // Ears
    g.fillStyle(skinTone);
    g.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(Math.round(22 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));

    // Eyes (whites)
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(4 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(Math.round(17 * s), Math.round(4 * s), Math.round(4 * s), Math.round(2 * s));
    // Pupils (dark brown)
    g.fillStyle(0x2d1f14);
    g.fillRect(Math.round(13 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));

    // Eyebrows (subtle)
    g.fillStyle(0x2d1f14);
    g.fillRect(Math.round(11 * s), Math.round(3 * s), Math.round(4 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(3 * s), Math.round(4 * s), Math.round(1 * s));

    // Nose
    g.fillStyle(0x5a3d1f);
    g.fillRect(Math.round(14 * s), Math.round(5 * s), Math.round(4 * s), Math.round(2 * s));

    // Mouth/slight frown
    g.fillStyle(0x4a3020);
    g.fillRect(Math.round(13 * s), Math.round(8 * s), Math.round(6 * s), Math.round(1 * s));

    // Goatee (small)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(14 * s), Math.round(9 * s), Math.round(4 * s), Math.round(1 * s));

    g.generateTexture("cj", size, size);
    g.destroy();
  }

  private generateShawSprite(): void {
    // Shaw - ElizaOS creator (@shawmakesmagic)
    // Based on reference: dark messy hair, teal sunglasses, pink tie-dye shirt, dark pants
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xdeb896; // Warm skin tone
    const skinHighlight = 0xf0c8a0;
    const g = this.make.graphics({ x: 0, y: 0 });

    // ai16z purple digital glow behind Shaw
    g.fillStyle(0x9333ea, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0xec4899, 0.1); // Pink accent
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark gray/black pants)
    g.fillStyle(0x1a1a2e);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    // Pant highlights
    g.fillStyle(0x2a2a3e);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(2 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(2 * s), Math.round(10 * s));

    // Shoes (blue/white sneakers like reference)
    g.fillStyle(0x3b82f6); // Blue base
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    // White sole
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Pink tie-dye shirt (matching reference)
    g.fillStyle(0xec4899); // Hot pink base
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Tie-dye swirl patterns
    g.fillStyle(0xf472b6); // Lighter pink
    g.fillRect(Math.round(9 * s), Math.round(13 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(16 * s), Math.round(5 * s), Math.round(3 * s));
    g.fillRect(Math.round(11 * s), Math.round(18 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xfda4af); // Even lighter pink/peach
    g.fillRect(Math.round(14 * s), Math.round(14 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(Math.round(8 * s), Math.round(17 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xfb7185); // Rose
    g.fillRect(Math.round(19 * s), Math.round(12 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(10 * s), Math.round(19 * s), Math.round(4 * s), Math.round(2 * s));

    // Arms (skin)
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    // Arm highlights
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(25 * s), Math.round(13 * s), Math.round(2 * s), Math.round(4 * s));
    // Hands
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    // Face highlight
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Dark messy hair (matching reference - fuller, messier)
    g.fillStyle(0x1a1a1a); // Very dark
    // Main hair mass
    g.fillRect(Math.round(7 * s), Math.round(-1 * s), Math.round(18 * s), Math.round(7 * s));
    // Side hair going down (messy look)
    g.fillRect(Math.round(6 * s), Math.round(1 * s), Math.round(3 * s), Math.round(7 * s));
    g.fillRect(Math.round(23 * s), Math.round(1 * s), Math.round(3 * s), Math.round(7 * s));
    // Messy bangs
    g.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(Math.round(22 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));
    // Hair texture highlights
    g.fillStyle(0x2d2d3d);
    g.fillRect(Math.round(10 * s), Math.round(0 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(17 * s), Math.round(-1 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(Math.round(7 * s), Math.round(3 * s), Math.round(2 * s), Math.round(2 * s));

    // Teal/cyan sunglasses (signature look - larger like reference)
    g.fillStyle(0x0d9488); // Teal frame
    g.fillRect(Math.round(9 * s), Math.round(5 * s), Math.round(6 * s), Math.round(4 * s));
    g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(6 * s), Math.round(4 * s));
    g.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s)); // Bridge
    // Lens (bright cyan/teal)
    g.fillStyle(0x22d3d1); // Bright teal
    g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(4 * s), Math.round(2 * s));
    // Lens reflection/shine
    g.fillStyle(0x5eead4);
    g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));

    // Small neutral mouth
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("shaw", size, size);
    g.destroy();
  }

  private createCharacterSprite(
    key: string,
    skinTone: number,
    hairColor: number,
    shirtColor: number,
    mood: "neutral" | "happy" | "sad" | "celebrating"
  ): void {
    const s = SCALE;
    const size = Math.round(32 * s);
    const g = this.make.graphics({ x: 0, y: 0 });

    // Ground shadow (more defined)
    g.fillStyle(PALETTE.void, 0.3);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(12 * s), Math.round(4 * s));

    // Legs with shading
    const pantsColor = PALETTE.navy;
    g.fillStyle(pantsColor);
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    // Leg highlight (left side catches light)
    g.fillStyle(lighten(pantsColor, 0.15));
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(2 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(2 * s), Math.round(9 * s));
    // Inner leg shadow
    g.fillStyle(darken(pantsColor, 0.2));
    g.fillRect(Math.round(14 * s), Math.round(22 * s), Math.round(1 * s), Math.round(9 * s));

    // Shoes with shading
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    // Shoe highlight
    g.fillStyle(lighten(PALETTE.darkGray, 0.2));
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(3 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(3 * s), Math.round(1 * s));

    // Body/Shirt with proper shading
    let activeShirtColor = shirtColor;
    if (mood === "celebrating") {
      activeShirtColor = PALETTE.gold;
    } else if (mood === "sad") {
      activeShirtColor = PALETTE.lightGray;
    }
    g.fillStyle(activeShirtColor);
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));
    // Shirt highlight (left side)
    g.fillStyle(lighten(activeShirtColor, 0.2));
    g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(4 * s), Math.round(12 * s));
    // Shirt shadow (right side)
    g.fillStyle(darken(activeShirtColor, 0.2));
    g.fillRect(Math.round(20 * s), Math.round(12 * s), Math.round(4 * s), Math.round(12 * s));
    // Collar detail
    g.fillStyle(darken(activeShirtColor, 0.15));
    g.fillRect(Math.round(12 * s), Math.round(12 * s), Math.round(8 * s), Math.round(2 * s));

    // Arms with shading
    g.fillStyle(skinTone);
    if (mood === "celebrating") {
      // Arms up
      g.fillRect(Math.round(5 * s), Math.round(6 * s), Math.round(4 * s), Math.round(8 * s));
      g.fillRect(Math.round(23 * s), Math.round(6 * s), Math.round(4 * s), Math.round(8 * s));
      // Arm highlights
      g.fillStyle(lighten(skinTone, 0.15));
      g.fillRect(Math.round(5 * s), Math.round(6 * s), Math.round(2 * s), Math.round(8 * s));
      g.fillRect(Math.round(23 * s), Math.round(6 * s), Math.round(2 * s), Math.round(8 * s));
    } else {
      // Arms down
      g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
      g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
      // Arm highlights
      g.fillStyle(lighten(skinTone, 0.15));
      g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(2 * s), Math.round(10 * s));
      g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(2 * s), Math.round(10 * s));
    }

    // Head with shading
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));
    // Face highlight (forehead/left cheek)
    g.fillStyle(lighten(skinTone, 0.12));
    g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(5 * s), Math.round(5 * s));
    // Face shadow (right side)
    g.fillStyle(darken(skinTone, 0.1));
    g.fillRect(Math.round(20 * s), Math.round(4 * s), Math.round(3 * s), Math.round(8 * s));

    // Hair with shading
    g.fillStyle(hairColor);
    g.fillRect(Math.round(9 * s), Math.round(1 * s), Math.round(14 * s), Math.round(5 * s));
    g.fillRect(Math.round(8 * s), Math.round(3 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(3 * s), Math.round(2 * s), Math.round(4 * s));
    // Hair highlight
    g.fillStyle(lighten(hairColor, 0.25));
    g.fillRect(Math.round(10 * s), Math.round(1 * s), Math.round(4 * s), Math.round(2 * s));
    // Hair shadow
    g.fillStyle(darken(hairColor, 0.2));
    g.fillRect(Math.round(19 * s), Math.round(2 * s), Math.round(4 * s), Math.round(3 * s));

    // Eyes with highlight
    g.fillStyle(PALETTE.white);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(6 * s), Math.round(4 * s), Math.round(3 * s));

    // Pupils
    g.fillStyle(PALETTE.void);
    if (mood === "sad") {
      g.fillRect(Math.round(12 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
      g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
    } else {
      g.fillRect(Math.round(13 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
      g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
    }
    // Eye highlights (small white dot)
    g.fillStyle(PALETTE.white);
    g.fillRect(Math.round(13 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Mouth
    if (mood === "happy" || mood === "celebrating") {
      g.fillStyle(PALETTE.void);
      g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));
      g.fillRect(Math.round(12 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
      g.fillRect(Math.round(19 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
    } else if (mood === "sad") {
      g.fillStyle(PALETTE.void);
      g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));
      g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));
      g.fillRect(Math.round(19 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));
    } else {
      g.fillStyle(PALETTE.void);
      g.fillRect(Math.round(14 * s), Math.round(10 * s), Math.round(4 * s), Math.round(1 * s));
    }

    // Blush for happy (rosy cheeks)
    if (mood === "happy" || mood === "celebrating") {
      g.fillStyle(0xffaaaa, 0.4);
      g.fillRect(Math.round(10 * s), Math.round(8 * s), Math.round(2 * s), Math.round(2 * s));
      g.fillRect(Math.round(20 * s), Math.round(8 * s), Math.round(2 * s), Math.round(2 * s));
    }

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private generateWeatherAssets(): void {
    const s = SCALE;

    // Rain drop - enhanced
    const rainGraphics = this.make.graphics({ x: 0, y: 0 });
    rainGraphics.fillStyle(0x60a5fa);
    rainGraphics.fillRect(Math.round(1 * s), 0, Math.round(2 * s), Math.round(8 * s));
    rainGraphics.fillStyle(0x93c5fd);
    rainGraphics.fillRect(Math.round(1 * s), 0, Math.round(1 * s), Math.round(3 * s));
    rainGraphics.fillStyle(0x3b82f6);
    rainGraphics.fillRect(
      Math.round(2 * s),
      Math.round(5 * s),
      Math.round(1 * s),
      Math.round(3 * s)
    );
    rainGraphics.generateTexture("rain", Math.round(4 * s), Math.round(10 * s));
    rainGraphics.destroy();

    // Sun with rays - enhanced with more detail
    const sunGraphics = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    sunGraphics.fillStyle(0xfbbf24, 0.15);
    sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(20 * s));
    sunGraphics.fillStyle(0xfbbf24, 0.3);
    sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(16 * s));
    sunGraphics.fillStyle(0xfbbf24, 0.5);
    sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(12 * s));
    // Core
    sunGraphics.fillStyle(0xfbbf24);
    sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(8 * s));
    // Bright center
    sunGraphics.fillStyle(0xfef3c7);
    sunGraphics.fillCircle(Math.round(18 * s), Math.round(18 * s), Math.round(4 * s));
    // Hot spot
    sunGraphics.fillStyle(0xffffff);
    sunGraphics.fillCircle(Math.round(17 * s), Math.round(17 * s), Math.round(2 * s));
    sunGraphics.generateTexture("sun", Math.round(40 * s), Math.round(40 * s));
    sunGraphics.destroy();

    // Moon - crescent with crater details
    const moonGraphics = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    moonGraphics.fillStyle(0xc4b5fd, 0.2);
    moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(16 * s));
    moonGraphics.fillStyle(0xe0e7ff, 0.3);
    moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(12 * s));
    // Moon body
    moonGraphics.fillStyle(0xf1f5f9);
    moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(10 * s));
    // Crescent shadow
    moonGraphics.fillStyle(0x1e293b, 0.7);
    moonGraphics.fillCircle(Math.round(20 * s), Math.round(14 * s), Math.round(8 * s));
    // Craters
    moonGraphics.fillStyle(0xcbd5e1);
    moonGraphics.fillCircle(Math.round(12 * s), Math.round(14 * s), Math.round(2 * s));
    moonGraphics.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(1.5 * s));
    moonGraphics.fillCircle(Math.round(10 * s), Math.round(18 * s), Math.round(1 * s));
    moonGraphics.generateTexture("moon", Math.round(32 * s), Math.round(32 * s));
    moonGraphics.destroy();

    // Fluffy cloud
    const cloudGraphics = this.make.graphics({ x: 0, y: 0 });
    cloudGraphics.fillStyle(0x9ca3af);
    cloudGraphics.fillCircle(Math.round(20 * s), Math.round(24 * s), Math.round(14 * s));
    cloudGraphics.fillCircle(Math.round(36 * s), Math.round(20 * s), Math.round(16 * s));
    cloudGraphics.fillCircle(Math.round(52 * s), Math.round(24 * s), Math.round(12 * s));
    cloudGraphics.fillStyle(0xd1d5db);
    cloudGraphics.fillCircle(Math.round(18 * s), Math.round(22 * s), Math.round(10 * s));
    cloudGraphics.fillCircle(Math.round(34 * s), Math.round(18 * s), Math.round(12 * s));
    cloudGraphics.generateTexture("cloud", Math.round(68 * s), Math.round(40 * s));
    cloudGraphics.destroy();

    // Storm cloud
    const stormCloud = this.make.graphics({ x: 0, y: 0 });
    stormCloud.fillStyle(0x374151);
    stormCloud.fillCircle(Math.round(20 * s), Math.round(24 * s), Math.round(14 * s));
    stormCloud.fillCircle(Math.round(36 * s), Math.round(20 * s), Math.round(16 * s));
    stormCloud.fillCircle(Math.round(52 * s), Math.round(24 * s), Math.round(12 * s));
    stormCloud.fillStyle(0x4b5563);
    stormCloud.fillCircle(Math.round(34 * s), Math.round(22 * s), Math.round(10 * s));
    stormCloud.generateTexture("storm_cloud", Math.round(68 * s), Math.round(40 * s));
    stormCloud.destroy();

    // Lightning bolt
    const lightning = this.make.graphics({ x: 0, y: 0 });
    lightning.fillStyle(0xfbbf24);
    lightning.fillPoints(
      [
        { x: Math.round(8 * s), y: 0 },
        { x: Math.round(4 * s), y: Math.round(10 * s) },
        { x: Math.round(8 * s), y: Math.round(10 * s) },
        { x: Math.round(2 * s), y: Math.round(20 * s) },
        { x: Math.round(10 * s), y: Math.round(8 * s) },
        { x: Math.round(6 * s), y: Math.round(8 * s) },
        { x: Math.round(10 * s), y: 0 },
      ],
      true
    );
    lightning.generateTexture("lightning", Math.round(12 * s), Math.round(20 * s));
    lightning.destroy();

    // Snowflake
    const snow = this.make.graphics({ x: 0, y: 0 });
    snow.fillStyle(0xffffff);
    snow.fillCircle(Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));
    snow.fillStyle(0xe0f2fe);
    snow.fillCircle(Math.round(3 * s), Math.round(3 * s), Math.round(1 * s));
    snow.generateTexture("snow", Math.round(8 * s), Math.round(8 * s));
    snow.destroy();
  }

  private generateUIAssets(): void {
    // Coin with shine
    const coinGraphics = this.make.graphics({ x: 0, y: 0 });
    coinGraphics.fillStyle(0xfbbf24);
    coinGraphics.fillCircle(6, 6, 6);
    coinGraphics.fillStyle(0xf59e0b);
    coinGraphics.fillCircle(6, 6, 4);
    coinGraphics.fillStyle(0xfbbf24);
    coinGraphics.fillRect(5, 3, 2, 6);
    coinGraphics.fillStyle(0xfef3c7);
    coinGraphics.fillCircle(4, 4, 2);
    coinGraphics.generateTexture("coin", 12, 12);
    coinGraphics.destroy();

    // Glow effect
    const glowGraphics = this.make.graphics({ x: 0, y: 0 });
    glowGraphics.fillStyle(0x4ade80, 0.2);
    glowGraphics.fillCircle(20, 20, 20);
    glowGraphics.fillStyle(0x4ade80, 0.4);
    glowGraphics.fillCircle(20, 20, 14);
    glowGraphics.fillStyle(0x4ade80, 0.6);
    glowGraphics.fillCircle(20, 20, 8);
    glowGraphics.generateTexture("glow", 40, 40);
    glowGraphics.destroy();

    // Star particle - draw manually since Phaser graphics doesn't have fillStar
    const star = this.make.graphics({ x: 0, y: 0 });
    star.fillStyle(0xfbbf24);
    // Draw a 5-pointed star using points
    const cx = 8,
      cy = 8,
      outerR = 7,
      innerR = 3;
    const starPoints: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      starPoints.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    }
    star.fillPoints(starPoints, true);
    star.generateTexture("star", 16, 16);
    star.destroy();

    // Heart particle
    const heart = this.make.graphics({ x: 0, y: 0 });
    heart.fillStyle(0xef4444);
    heart.fillCircle(5, 5, 4);
    heart.fillCircle(11, 5, 4);
    heart.fillTriangle(1, 6, 15, 6, 8, 14);
    heart.generateTexture("heart", 16, 16);
    heart.destroy();
  }

  private generateDecorations(): void {
    // Tree
    const tree = this.make.graphics({ x: 0, y: 0 });
    // Trunk
    tree.fillStyle(0x78350f);
    tree.fillRect(12, 28, 8, 16);
    tree.fillStyle(0x92400e);
    tree.fillRect(14, 28, 4, 16);
    // Foliage layers
    tree.fillStyle(0x166534);
    tree.fillCircle(16, 20, 14);
    tree.fillStyle(0x15803d);
    tree.fillCircle(16, 16, 12);
    tree.fillStyle(0x22c55e);
    tree.fillCircle(16, 12, 8);
    tree.generateTexture("tree", 32, 44);
    tree.destroy();

    // Bush
    const bush = this.make.graphics({ x: 0, y: 0 });
    bush.fillStyle(0x166534);
    bush.fillCircle(8, 12, 8);
    bush.fillCircle(16, 10, 10);
    bush.fillCircle(24, 12, 8);
    bush.fillStyle(0x22c55e);
    bush.fillCircle(16, 8, 6);
    bush.generateTexture("bush", 32, 20);
    bush.destroy();

    // Lamp post
    const lamp = this.make.graphics({ x: 0, y: 0 });
    lamp.fillStyle(0x1f2937);
    lamp.fillRect(6, 8, 4, 32);
    lamp.fillStyle(0x374151);
    lamp.fillRect(2, 4, 12, 6);
    lamp.fillStyle(0xfbbf24, 0.5);
    lamp.fillRect(4, 6, 8, 4);
    lamp.generateTexture("lamp", 16, 40);
    lamp.destroy();

    // Bench
    const bench = this.make.graphics({ x: 0, y: 0 });
    bench.fillStyle(0x78350f);
    bench.fillRect(0, 8, 32, 4);
    bench.fillRect(2, 12, 4, 8);
    bench.fillRect(26, 12, 4, 8);
    bench.fillStyle(0x92400e);
    bench.fillRect(0, 4, 32, 4);
    bench.generateTexture("bench", 32, 20);
    bench.destroy();
  }

  private generateAnimals(): void {
    // Dog - pixel art style
    const dog = this.make.graphics({ x: 0, y: 0 });
    // Body
    dog.fillStyle(0xc68642); // Brown
    dog.fillRect(4, 8, 16, 10);
    // Head
    dog.fillRect(18, 4, 10, 10);
    // Ears
    dog.fillStyle(0x8d5524);
    dog.fillRect(18, 2, 4, 4);
    dog.fillRect(24, 2, 4, 4);
    // Snout
    dog.fillStyle(0xffdbac);
    dog.fillRect(26, 8, 4, 4);
    // Nose
    dog.fillStyle(0x1f2937);
    dog.fillRect(28, 9, 2, 2);
    // Eye
    dog.fillStyle(0x000000);
    dog.fillRect(22, 6, 2, 2);
    // Legs
    dog.fillStyle(0xc68642);
    dog.fillRect(6, 16, 3, 6);
    dog.fillRect(14, 16, 3, 6);
    // Tail
    dog.fillRect(2, 6, 3, 4);
    dog.generateTexture("dog", 32, 24);
    dog.destroy();

    // Cat - pixel art style
    const cat = this.make.graphics({ x: 0, y: 0 });
    // Body
    cat.fillStyle(0x6b7280); // Gray
    cat.fillRect(6, 10, 14, 8);
    // Head
    cat.fillRect(16, 4, 10, 10);
    // Ears (triangular)
    cat.fillStyle(0x4b5563);
    cat.fillTriangle(16, 6, 18, 0, 20, 6);
    cat.fillTriangle(24, 6, 26, 0, 28, 6);
    // Inner ears
    cat.fillStyle(0xfca5a5);
    cat.fillTriangle(17, 5, 18, 2, 19, 5);
    cat.fillTriangle(25, 5, 26, 2, 27, 5);
    // Eyes
    cat.fillStyle(0x22c55e); // Green eyes
    cat.fillRect(18, 7, 2, 3);
    cat.fillRect(23, 7, 2, 3);
    // Pupils
    cat.fillStyle(0x000000);
    cat.fillRect(18, 8, 1, 2);
    cat.fillRect(23, 8, 1, 2);
    // Nose
    cat.fillStyle(0xfca5a5);
    cat.fillRect(21, 10, 2, 1);
    // Whiskers
    cat.fillStyle(0x9ca3af);
    cat.fillRect(14, 9, 4, 1);
    cat.fillRect(26, 9, 4, 1);
    cat.fillRect(14, 11, 4, 1);
    cat.fillRect(26, 11, 4, 1);
    // Legs
    cat.fillStyle(0x6b7280);
    cat.fillRect(8, 16, 3, 5);
    cat.fillRect(15, 16, 3, 5);
    // Tail (curved up)
    cat.fillRect(4, 8, 3, 2);
    cat.fillRect(2, 4, 3, 5);
    cat.generateTexture("cat", 32, 24);
    cat.destroy();

    // Bird - small sparrow
    const bird = this.make.graphics({ x: 0, y: 0 });
    // Body
    bird.fillStyle(0x8b4513); // Brown
    bird.fillEllipse(8, 8, 8, 6);
    // Head
    bird.fillCircle(14, 6, 4);
    // Beak
    bird.fillStyle(0xfbbf24);
    bird.fillTriangle(18, 6, 22, 6, 18, 8);
    // Eye
    bird.fillStyle(0x000000);
    bird.fillCircle(15, 5, 1);
    // Wing
    bird.fillStyle(0x6b4423);
    bird.fillEllipse(6, 8, 5, 4);
    // Tail
    bird.fillStyle(0x5c3317);
    bird.fillTriangle(0, 6, 4, 8, 4, 10);
    // Legs
    bird.fillStyle(0xfbbf24);
    bird.fillRect(7, 12, 1, 4);
    bird.fillRect(10, 12, 1, 4);
    bird.generateTexture("bird", 24, 18);
    bird.destroy();

    // Butterfly
    const butterfly = this.make.graphics({ x: 0, y: 0 });
    // Wings
    butterfly.fillStyle(0xec4899); // Pink
    butterfly.fillEllipse(4, 6, 4, 5);
    butterfly.fillEllipse(12, 6, 4, 5);
    butterfly.fillStyle(0xf472b6);
    butterfly.fillEllipse(4, 10, 3, 4);
    butterfly.fillEllipse(12, 10, 3, 4);
    // Body
    butterfly.fillStyle(0x1f2937);
    butterfly.fillRect(7, 4, 2, 10);
    // Antennae
    butterfly.fillRect(6, 2, 1, 3);
    butterfly.fillRect(9, 2, 1, 3);
    // Wing patterns
    butterfly.fillStyle(0xfbbf24);
    butterfly.fillCircle(4, 6, 1);
    butterfly.fillCircle(12, 6, 1);
    butterfly.generateTexture("butterfly", 16, 16);
    butterfly.destroy();

    // Squirrel
    const squirrel = this.make.graphics({ x: 0, y: 0 });
    // Body
    squirrel.fillStyle(0xb45309); // Orange-brown
    squirrel.fillRect(8, 10, 10, 8);
    // Head
    squirrel.fillCircle(20, 10, 5);
    // Ear
    squirrel.fillStyle(0x92400e);
    squirrel.fillTriangle(18, 4, 20, 2, 22, 6);
    // Eye
    squirrel.fillStyle(0x000000);
    squirrel.fillCircle(21, 9, 1);
    // Nose
    squirrel.fillStyle(0x1f2937);
    squirrel.fillCircle(24, 11, 1);
    // Fluffy tail
    squirrel.fillStyle(0xb45309);
    squirrel.fillEllipse(4, 6, 5, 8);
    squirrel.fillStyle(0xd97706);
    squirrel.fillEllipse(4, 4, 3, 5);
    // Legs
    squirrel.fillStyle(0xb45309);
    squirrel.fillRect(10, 16, 2, 4);
    squirrel.fillRect(15, 16, 2, 4);
    // Front paws
    squirrel.fillRect(18, 14, 2, 3);
    squirrel.generateTexture("squirrel", 28, 22);
    squirrel.destroy();
  }

  private generateExtraDecorations(): void {
    // Flower - colorful pixel flower
    const flower = this.make.graphics({ x: 0, y: 0 });
    // Stem
    flower.fillStyle(0x22c55e);
    flower.fillRect(6, 8, 2, 12);
    // Leaves
    flower.fillStyle(0x16a34a);
    flower.fillRect(3, 12, 4, 3);
    flower.fillRect(7, 14, 4, 3);
    // Petals - random color per instance will be set in scene
    const petalColors = [0xef4444, 0xfbbf24, 0xec4899, 0x8b5cf6, 0x3b82f6];
    const petalColor = petalColors[Math.floor(Math.random() * petalColors.length)];
    flower.fillStyle(petalColor);
    flower.fillCircle(4, 4, 3);
    flower.fillCircle(10, 4, 3);
    flower.fillCircle(4, 8, 3);
    flower.fillCircle(10, 8, 3);
    // Center
    flower.fillStyle(0xfbbf24);
    flower.fillCircle(7, 6, 3);
    flower.generateTexture("flower", 14, 20);
    flower.destroy();

    // Rock - gray stone
    const rock = this.make.graphics({ x: 0, y: 0 });
    rock.fillStyle(0x6b7280);
    rock.fillEllipse(10, 8, 12, 8);
    rock.fillStyle(0x9ca3af);
    rock.fillEllipse(8, 6, 8, 5);
    rock.fillStyle(0x4b5563);
    rock.fillEllipse(12, 10, 6, 4);
    rock.generateTexture("rock", 20, 16);
    rock.destroy();

    // Fountain - decorative water fountain
    const fountain = this.make.graphics({ x: 0, y: 0 });
    // Base
    fountain.fillStyle(0x6b7280);
    fountain.fillRect(8, 28, 24, 8);
    fountain.fillStyle(0x9ca3af);
    fountain.fillRect(10, 26, 20, 4);
    // Middle tier
    fountain.fillStyle(0x78716c);
    fountain.fillRect(14, 18, 12, 10);
    fountain.fillStyle(0xa8a29e);
    fountain.fillRect(16, 16, 8, 4);
    // Top bowl
    fountain.fillStyle(0x6b7280);
    fountain.fillRect(12, 10, 16, 8);
    fountain.fillStyle(0x60a5fa, 0.7);
    fountain.fillRect(14, 12, 12, 4);
    // Spout
    fountain.fillStyle(0x9ca3af);
    fountain.fillRect(18, 4, 4, 8);
    // Water drops at top
    fountain.fillStyle(0x93c5fd);
    fountain.fillCircle(20, 2, 2);
    fountain.generateTexture("fountain", 40, 36);
    fountain.destroy();

    // Flag - waving flag on pole
    const flag = this.make.graphics({ x: 0, y: 0 });
    // Pole
    flag.fillStyle(0x78716c);
    flag.fillRect(2, 0, 3, 40);
    flag.fillStyle(0x9ca3af);
    flag.fillRect(3, 0, 1, 40);
    // Flag top ball
    flag.fillStyle(0xfbbf24);
    flag.fillCircle(3, 2, 3);
    // Flag fabric - BagsWorld green
    flag.fillStyle(0x4ade80);
    flag.fillRect(5, 4, 18, 12);
    flag.fillStyle(0x22c55e);
    flag.fillRect(5, 10, 18, 6);
    // B for Bags
    flag.fillStyle(0xffffff);
    flag.fillRect(10, 6, 6, 8);
    flag.fillRect(10, 6, 2, 8);
    flag.fillRect(10, 6, 6, 2);
    flag.fillRect(10, 9, 5, 2);
    flag.fillRect(10, 12, 6, 2);
    flag.generateTexture("flag", 24, 40);
    flag.destroy();

    // Pond - small water area
    const pond = this.make.graphics({ x: 0, y: 0 });
    // Water base
    pond.fillStyle(0x1e3a8a, 0.6);
    pond.fillEllipse(16, 10, 16, 10);
    pond.fillStyle(0x3b82f6, 0.5);
    pond.fillEllipse(16, 10, 12, 7);
    // Highlight/reflection
    pond.fillStyle(0x93c5fd, 0.4);
    pond.fillEllipse(12, 8, 6, 3);
    // Lily pad
    pond.fillStyle(0x22c55e);
    pond.fillCircle(20, 12, 3);
    pond.fillStyle(0x16a34a);
    pond.fillRect(20, 11, 3, 2);
    // Lily flower
    pond.fillStyle(0xfda4af);
    pond.fillCircle(21, 11, 2);
    pond.generateTexture("pond", 32, 20);
    pond.destroy();

    // Mushroom - cute pixel mushroom
    const mushroom = this.make.graphics({ x: 0, y: 0 });
    // Stem
    mushroom.fillStyle(0xfef3c7);
    mushroom.fillRect(4, 8, 6, 8);
    mushroom.fillStyle(0xfde68a);
    mushroom.fillRect(5, 8, 4, 8);
    // Cap
    mushroom.fillStyle(0xef4444);
    mushroom.fillEllipse(7, 6, 8, 6);
    // Spots
    mushroom.fillStyle(0xffffff);
    mushroom.fillCircle(5, 4, 2);
    mushroom.fillCircle(9, 5, 1.5);
    mushroom.fillCircle(7, 7, 1);
    mushroom.generateTexture("mushroom", 14, 16);
    mushroom.destroy();

    // Signpost
    const signpost = this.make.graphics({ x: 0, y: 0 });
    // Post
    signpost.fillStyle(0x78350f);
    signpost.fillRect(8, 10, 4, 20);
    signpost.fillStyle(0x92400e);
    signpost.fillRect(9, 10, 2, 20);
    // Sign board
    signpost.fillStyle(0xa16207);
    signpost.fillRect(0, 4, 20, 10);
    signpost.fillStyle(0xca8a04);
    signpost.fillRect(1, 5, 18, 8);
    // Arrow or text hint
    signpost.fillStyle(0x422006);
    signpost.fillRect(4, 8, 8, 2);
    signpost.fillTriangle(12, 6, 16, 9, 12, 12);
    signpost.generateTexture("signpost", 20, 30);
    signpost.destroy();
  }

  private generateAmbientParticles(): void {
    // Pollen/dust particle
    const pollen = this.make.graphics({ x: 0, y: 0 });
    pollen.fillStyle(0xfef3c7);
    pollen.fillCircle(2, 2, 2);
    pollen.fillStyle(0xffffff, 0.5);
    pollen.fillCircle(1.5, 1.5, 1);
    pollen.generateTexture("pollen", 4, 4);
    pollen.destroy();

    // Firefly - glowing particle for night
    const firefly = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    firefly.fillStyle(0xfde047, 0.3);
    firefly.fillCircle(6, 6, 6);
    firefly.fillStyle(0xfef08a, 0.5);
    firefly.fillCircle(6, 6, 4);
    // Core
    firefly.fillStyle(0xfef9c3);
    firefly.fillCircle(6, 6, 2);
    firefly.fillStyle(0xffffff);
    firefly.fillCircle(6, 6, 1);
    firefly.generateTexture("firefly", 12, 12);
    firefly.destroy();

    // Leaf particle
    const leaf = this.make.graphics({ x: 0, y: 0 });
    leaf.fillStyle(0x22c55e);
    leaf.fillEllipse(4, 3, 4, 3);
    leaf.fillStyle(0x16a34a);
    leaf.fillRect(3, 2, 1, 4);
    leaf.generateTexture("leaf", 8, 8);
    leaf.destroy();

    // Sparkle particle
    const sparkle = this.make.graphics({ x: 0, y: 0 });
    sparkle.fillStyle(0xffffff);
    sparkle.fillRect(3, 0, 2, 8);
    sparkle.fillRect(0, 3, 8, 2);
    sparkle.fillStyle(0xfef3c7);
    sparkle.fillRect(3, 3, 2, 2);
    sparkle.generateTexture("sparkle", 8, 8);
    sparkle.destroy();
  }

  private generateLaunchPadAssets(): void {
    // Billboard/Screen - large display for live data (NYC Times Square style)
    this.generateBillboard();

    // Neon sign frame
    this.generateNeonSign();

    // Skyscraper silhouettes for background
    this.generateSkyscraperSilhouettes();

    // Digital ticker display
    this.generateTickerDisplay();

    // Concrete/asphalt ground for urban feel
    this.generateUrbanGround();

    // Street lamp (urban style)
    this.generateStreetLamp();

    // Neon tube decorations
    this.generateNeonTubes();
  }

  private generateBillboard(): void {
    // Large LED billboard screen (120x80 pixels)
    const g = this.make.graphics({ x: 0, y: 0 });

    // Frame (dark metal)
    g.fillStyle(0x1f2937);
    g.fillRect(0, 0, 120, 80);

    // Inner frame border
    g.fillStyle(0x374151);
    g.fillRect(2, 2, 116, 76);

    // Screen area (dark when off, will be overlaid with data)
    g.fillStyle(0x0a0a0f);
    g.fillRect(4, 4, 112, 72);

    // LED grid effect (subtle)
    g.fillStyle(0x111827);
    for (let x = 4; x < 116; x += 4) {
      g.fillRect(x, 4, 1, 72);
    }
    for (let y = 4; y < 76; y += 4) {
      g.fillRect(4, y, 112, 1);
    }

    // Corner brackets (structural)
    g.fillStyle(0x4b5563);
    g.fillRect(0, 0, 8, 3);
    g.fillRect(0, 0, 3, 8);
    g.fillRect(112, 0, 8, 3);
    g.fillRect(117, 0, 3, 8);
    g.fillRect(0, 77, 8, 3);
    g.fillRect(0, 72, 3, 8);
    g.fillRect(112, 77, 8, 3);
    g.fillRect(117, 72, 3, 8);

    // Support pole (at bottom center)
    g.fillStyle(0x374151);
    g.fillRect(55, 78, 10, 20);
    g.fillStyle(0x4b5563);
    g.fillRect(57, 78, 6, 20);

    g.generateTexture("billboard", 120, 100);
    g.destroy();

    // Smaller screen variant (for side displays)
    const small = this.make.graphics({ x: 0, y: 0 });
    small.fillStyle(0x1f2937);
    small.fillRect(0, 0, 60, 45);
    small.fillStyle(0x0a0a0f);
    small.fillRect(2, 2, 56, 41);
    // LED grid
    small.fillStyle(0x111827);
    for (let x = 2; x < 58; x += 3) {
      small.fillRect(x, 2, 1, 41);
    }
    small.generateTexture("billboard_small", 60, 45);
    small.destroy();
  }

  private generateNeonSign(): void {
    // "CITY" neon sign
    const g = this.make.graphics({ x: 0, y: 0 });
    const signWidth = 60;
    const signHeight = 24;

    // Backing board
    g.fillStyle(0x1a1a1a);
    g.fillRect(0, 0, signWidth, signHeight);

    // Border glow effect (gold for city)
    g.fillStyle(0xfbbf24, 0.4);
    g.fillRect(0, 0, signWidth, 2);
    g.fillRect(0, signHeight - 2, signWidth, 2);
    g.fillRect(0, 0, 2, signHeight);
    g.fillRect(signWidth - 2, 0, 2, signHeight);

    // Neon text "CITY" (stylized pixel letters) - gold color
    g.fillStyle(0xfbbf24);
    const startX = 8;
    const y = 6;
    const letterH = 12;
    const spacing = 12;

    // C
    g.fillRect(startX, y, 2, letterH);
    g.fillRect(startX, y, 7, 2);
    g.fillRect(startX, y + letterH - 2, 7, 2);
    // I
    g.fillRect(startX + spacing, y, 6, 2);
    g.fillRect(startX + spacing + 2, y, 2, letterH);
    g.fillRect(startX + spacing, y + letterH - 2, 6, 2);
    // T
    g.fillRect(startX + spacing * 2, y, 8, 2);
    g.fillRect(startX + spacing * 2 + 3, y, 2, letterH);
    // Y
    g.fillRect(startX + spacing * 3, y, 2, 5);
    g.fillRect(startX + spacing * 3 + 6, y, 2, 5);
    g.fillRect(startX + spacing * 3 + 2, y + 3, 2, 2);
    g.fillRect(startX + spacing * 3 + 4, y + 3, 2, 2);
    g.fillRect(startX + spacing * 3 + 3, y + 5, 2, 7);

    // Glow effect around letters
    g.fillStyle(0xfbbf24, 0.2);
    g.fillRect(4, 4, signWidth - 8, signHeight - 8);

    g.generateTexture("neon_trending", signWidth, signHeight);
    g.destroy();

    // "NEW" neon sign (red/gold)
    const newSign = this.make.graphics({ x: 0, y: 0 });
    newSign.fillStyle(0x1a1a1a);
    newSign.fillRect(0, 0, 50, 20);

    // Glow border
    newSign.fillStyle(0xef4444, 0.3);
    newSign.fillRect(0, 0, 50, 2);
    newSign.fillRect(0, 18, 50, 2);

    // "NEW" text
    newSign.fillStyle(0xef4444);
    // N
    newSign.fillRect(6, 5, 2, 10);
    newSign.fillRect(14, 5, 2, 10);
    newSign.fillRect(8, 6, 2, 2);
    newSign.fillRect(10, 8, 2, 2);
    newSign.fillRect(12, 10, 2, 2);
    // E
    newSign.fillRect(18, 5, 2, 10);
    newSign.fillRect(20, 5, 6, 2);
    newSign.fillRect(20, 9, 4, 2);
    newSign.fillRect(20, 13, 6, 2);
    // W
    newSign.fillRect(28, 5, 2, 10);
    newSign.fillRect(36, 5, 2, 10);
    newSign.fillRect(30, 11, 2, 4);
    newSign.fillRect(32, 9, 2, 4);
    newSign.fillRect(34, 11, 2, 4);

    newSign.generateTexture("neon_new", 50, 20);
    newSign.destroy();

    // Blinking arrow (for attention)
    const arrow = this.make.graphics({ x: 0, y: 0 });
    arrow.fillStyle(0xfbbf24);
    arrow.fillTriangle(0, 10, 16, 0, 16, 20);
    arrow.fillRect(16, 6, 14, 8);
    // Glow
    arrow.fillStyle(0xfbbf24, 0.3);
    arrow.fillTriangle(-2, 10, 18, -2, 18, 22);
    arrow.generateTexture("neon_arrow", 32, 22);
    arrow.destroy();
  }

  private generateSkyscraperSilhouettes(): void {
    // Tall building silhouette for background (dark, moody NYC style)
    const g = this.make.graphics({ x: 0, y: 0 });

    // Building 1 - tall tower
    g.fillStyle(0x111827);
    g.fillRect(0, 40, 30, 160);
    // Antenna
    g.fillRect(13, 20, 4, 20);
    g.fillStyle(0xef4444);
    g.fillCircle(15, 18, 2);
    // Windows (faint lights)
    g.fillStyle(0xfbbf24, 0.3);
    for (let y = 50; y < 190; y += 12) {
      for (let x = 4; x < 26; x += 8) {
        if (Math.random() > 0.3) {
          g.fillRect(x, y, 4, 6);
        }
      }
    }

    // Building 2 - medium tower
    g.fillStyle(0x1f2937);
    g.fillRect(35, 80, 25, 120);
    // Windows
    g.fillStyle(0x60a5fa, 0.2);
    for (let y = 90; y < 190; y += 10) {
      for (let x = 38; x < 58; x += 7) {
        if (Math.random() > 0.4) {
          g.fillRect(x, y, 4, 5);
        }
      }
    }

    // Building 3 - short wide
    g.fillStyle(0x0f172a);
    g.fillRect(65, 120, 35, 80);
    // Billboard on top
    g.fillStyle(0x4ade80, 0.4);
    g.fillRect(70, 110, 25, 12);

    g.generateTexture("skyline_bg", 100, 200);
    g.destroy();
  }

  private generateTickerDisplay(): void {
    // Horizontal ticker/news crawl display
    const g = this.make.graphics({ x: 0, y: 0 });

    // Housing
    g.fillStyle(0x1f2937);
    g.fillRect(0, 0, 200, 16);

    // Screen area
    g.fillStyle(0x0a0a0f);
    g.fillRect(2, 2, 196, 12);

    // LED dots effect
    g.fillStyle(0x111827);
    for (let x = 2; x < 198; x += 2) {
      g.fillRect(x, 2, 1, 12);
    }

    g.generateTexture("ticker_display", 200, 16);
    g.destroy();
  }

  private generateUrbanGround(): void {
    // Concrete/asphalt texture
    const g = this.make.graphics({ x: 0, y: 0 });

    // Base asphalt
    g.fillStyle(0x374151);
    g.fillRect(0, 0, 32, 32);

    // Variation spots
    g.fillStyle(0x4b5563);
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(Math.random() * 28);
      const y = Math.floor(Math.random() * 28);
      g.fillRect(x, y, 3, 3);
    }

    // Cracks
    g.fillStyle(0x1f2937);
    g.fillRect(8, 0, 1, 12);
    g.fillRect(8, 12, 6, 1);
    g.fillRect(20, 15, 1, 17);

    g.generateTexture("concrete", 32, 32);
    g.destroy();

    // Sidewalk
    const sidewalk = this.make.graphics({ x: 0, y: 0 });
    sidewalk.fillStyle(0x6b7280);
    sidewalk.fillRect(0, 0, 32, 32);
    // Grid lines
    sidewalk.fillStyle(0x4b5563);
    sidewalk.fillRect(0, 15, 32, 2);
    sidewalk.fillRect(15, 0, 2, 32);
    // Texture
    sidewalk.fillStyle(0x9ca3af);
    sidewalk.fillRect(4, 4, 2, 2);
    sidewalk.fillRect(20, 22, 2, 2);
    sidewalk.generateTexture("sidewalk", 32, 32);
    sidewalk.destroy();
  }

  private generateStreetLamp(): void {
    // Modern urban street lamp
    const g = this.make.graphics({ x: 0, y: 0 });

    // Pole
    g.fillStyle(0x374151);
    g.fillRect(8, 20, 4, 50);
    g.fillStyle(0x4b5563);
    g.fillRect(9, 20, 2, 50);

    // Lamp arm
    g.fillStyle(0x374151);
    g.fillRect(10, 16, 14, 3);

    // Lamp housing
    g.fillStyle(0x1f2937);
    g.fillRect(16, 10, 12, 8);

    // Light (glowing)
    g.fillStyle(0xfbbf24, 0.8);
    g.fillRect(18, 16, 8, 4);

    // Light glow effect
    g.fillStyle(0xfbbf24, 0.2);
    g.fillRect(14, 18, 16, 20);
    g.fillStyle(0xfbbf24, 0.1);
    g.fillRect(10, 22, 24, 30);

    g.generateTexture("street_lamp", 32, 70);
    g.destroy();
  }

  private generateNeonTubes(): void {
    // Vertical neon tube (green)
    const greenTube = this.make.graphics({ x: 0, y: 0 });
    greenTube.fillStyle(0x4ade80, 0.3);
    greenTube.fillRect(0, 0, 8, 60);
    greenTube.fillStyle(0x4ade80, 0.6);
    greenTube.fillRect(2, 0, 4, 60);
    greenTube.fillStyle(0x4ade80);
    greenTube.fillRect(3, 0, 2, 60);
    greenTube.generateTexture("neon_tube_green", 8, 60);
    greenTube.destroy();

    // Horizontal neon tube (pink/magenta)
    const pinkTube = this.make.graphics({ x: 0, y: 0 });
    pinkTube.fillStyle(0xec4899, 0.3);
    pinkTube.fillRect(0, 0, 80, 6);
    pinkTube.fillStyle(0xec4899, 0.6);
    pinkTube.fillRect(0, 1, 80, 4);
    pinkTube.fillStyle(0xec4899);
    pinkTube.fillRect(0, 2, 80, 2);
    pinkTube.generateTexture("neon_tube_pink", 80, 6);
    pinkTube.destroy();

    // Blue neon tube
    const blueTube = this.make.graphics({ x: 0, y: 0 });
    blueTube.fillStyle(0x3b82f6, 0.3);
    blueTube.fillRect(0, 0, 6, 40);
    blueTube.fillStyle(0x3b82f6, 0.6);
    blueTube.fillRect(1, 0, 4, 40);
    blueTube.fillStyle(0x3b82f6);
    blueTube.fillRect(2, 0, 2, 40);
    blueTube.generateTexture("neon_tube_blue", 6, 40);
    blueTube.destroy();

    // Gold/yellow neon tube
    const goldTube = this.make.graphics({ x: 0, y: 0 });
    goldTube.fillStyle(0xfbbf24, 0.3);
    goldTube.fillRect(0, 0, 60, 6);
    goldTube.fillStyle(0xfbbf24, 0.6);
    goldTube.fillRect(0, 1, 60, 4);
    goldTube.fillStyle(0xfbbf24);
    goldTube.fillRect(0, 2, 60, 2);
    goldTube.generateTexture("neon_tube_gold", 60, 6);
    goldTube.destroy();

    // Generate additional city assets
    this.generateCityAssets();
  }

  private generateCityAssets(): void {
    // Parked car (side view)
    this.generateCar();

    // Fire hydrant
    this.generateFireHydrant();

    // Trash can
    this.generateTrashCan();

    // Road markings
    this.generateRoadMarkings();

    // Advertising poster
    this.generateAdPoster();

    // Traffic light
    this.generateTrafficLight();

    // Taxi/cab variant
    this.generateTaxi();
  }

  private generateCar(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(4, 22, 44, 6);

    // Car body (blue sedan)
    g.fillStyle(0x1e40af);
    g.fillRect(4, 8, 44, 14);

    // Lighter top for 3D effect
    g.fillStyle(0x3b82f6);
    g.fillRect(4, 8, 44, 4);

    // Roof/cabin
    g.fillStyle(0x1e3a8a);
    g.fillRect(14, 2, 22, 8);

    // Windows (glass)
    g.fillStyle(0x60a5fa, 0.8);
    g.fillRect(16, 4, 8, 5);
    g.fillRect(26, 4, 8, 5);

    // Window frame
    g.fillStyle(0x0f172a);
    g.fillRect(24, 4, 2, 5);

    // Wheels
    g.fillStyle(0x1f2937);
    g.fillCircle(12, 20, 5);
    g.fillCircle(40, 20, 5);

    // Wheel centers (hubcaps)
    g.fillStyle(0x6b7280);
    g.fillCircle(12, 20, 2);
    g.fillCircle(40, 20, 2);

    // Headlights
    g.fillStyle(0xfef3c7);
    g.fillRect(46, 12, 2, 4);

    // Taillights
    g.fillStyle(0xef4444);
    g.fillRect(4, 12, 2, 4);

    g.generateTexture("car_blue", 52, 28);
    g.destroy();
  }

  private generateFireHydrant(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(2, 22, 12, 4);

    // Base
    g.fillStyle(0xdc2626);
    g.fillRect(4, 18, 8, 6);

    // Body
    g.fillStyle(0xef4444);
    g.fillRect(3, 8, 10, 12);

    // Cap
    g.fillStyle(0xb91c1c);
    g.fillRect(2, 4, 12, 6);
    g.fillRect(5, 2, 6, 4);

    // Side valves
    g.fillStyle(0xfbbf24);
    g.fillRect(0, 10, 4, 4);
    g.fillRect(12, 10, 4, 4);

    // Highlight
    g.fillStyle(0xfca5a5, 0.5);
    g.fillRect(5, 8, 2, 10);

    g.generateTexture("fire_hydrant", 16, 26);
    g.destroy();
  }

  private generateTrashCan(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(2, 26, 16, 4);

    // Can body
    g.fillStyle(0x374151);
    g.fillRect(2, 8, 16, 20);

    // Darker side for 3D
    g.fillStyle(0x1f2937);
    g.fillRect(2, 8, 4, 20);

    // Lid
    g.fillStyle(0x4b5563);
    g.fillRect(0, 4, 20, 6);

    // Handle
    g.fillStyle(0x6b7280);
    g.fillRect(8, 2, 4, 4);

    // Recycling symbol area
    g.fillStyle(0x4ade80);
    g.fillRect(6, 14, 8, 8);

    g.generateTexture("trash_can", 20, 30);
    g.destroy();
  }

  private generateRoadMarkings(): void {
    // Crosswalk
    const crosswalk = this.make.graphics({ x: 0, y: 0 });
    crosswalk.fillStyle(0x374151);
    crosswalk.fillRect(0, 0, 60, 30);

    // White stripes
    crosswalk.fillStyle(0xffffff, 0.9);
    for (let x = 4; x < 56; x += 10) {
      crosswalk.fillRect(x, 2, 6, 26);
    }

    crosswalk.generateTexture("crosswalk", 60, 30);
    crosswalk.destroy();

    // Road line (dashed)
    const roadLine = this.make.graphics({ x: 0, y: 0 });
    roadLine.fillStyle(0xfbbf24);
    roadLine.fillRect(0, 0, 20, 4);
    roadLine.generateTexture("road_line", 20, 4);
    roadLine.destroy();
  }

  private generateAdPoster(): void {
    // Wall-mounted advertisement poster
    const g = this.make.graphics({ x: 0, y: 0 });

    // Frame
    g.fillStyle(0x1f2937);
    g.fillRect(0, 0, 40, 50);

    // Poster background
    g.fillStyle(0x0a0a0f);
    g.fillRect(2, 2, 36, 46);

    // "BAGS" brand ad
    g.fillStyle(0x4ade80);
    g.fillRect(6, 6, 28, 12);

    // Abstract art lines
    g.fillStyle(0xfbbf24);
    g.fillRect(8, 22, 24, 2);
    g.fillStyle(0xec4899);
    g.fillRect(8, 28, 20, 2);
    g.fillStyle(0x3b82f6);
    g.fillRect(8, 34, 16, 2);

    // "TRADE NOW" text area
    g.fillStyle(0xfbbf24, 0.8);
    g.fillRect(6, 40, 28, 6);

    g.generateTexture("ad_poster", 40, 50);
    g.destroy();
  }

  private generateTrafficLight(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Pole
    g.fillStyle(0x374151);
    g.fillRect(6, 36, 4, 30);

    // Light housing
    g.fillStyle(0x1f2937);
    g.fillRect(0, 0, 16, 38);

    // Light frame
    g.fillStyle(0x374151);
    g.fillRect(1, 1, 14, 36);

    // Red light (top) - off
    g.fillStyle(0x7f1d1d);
    g.fillCircle(8, 8, 4);

    // Yellow light (middle) - off
    g.fillStyle(0x78350f);
    g.fillCircle(8, 19, 4);

    // Green light (bottom) - on
    g.fillStyle(0x4ade80);
    g.fillCircle(8, 30, 4);
    // Glow
    g.fillStyle(0x4ade80, 0.3);
    g.fillCircle(8, 30, 6);

    g.generateTexture("traffic_light", 16, 66);
    g.destroy();
  }

  private generateTaxi(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(4, 22, 44, 6);

    // Car body (yellow taxi)
    g.fillStyle(0xeab308);
    g.fillRect(4, 8, 44, 14);

    // Lighter top for 3D effect
    g.fillStyle(0xfbbf24);
    g.fillRect(4, 8, 44, 4);

    // Roof/cabin
    g.fillStyle(0xca8a04);
    g.fillRect(14, 2, 22, 8);

    // Taxi sign on roof
    g.fillStyle(0xfef3c7);
    g.fillRect(20, 0, 10, 4);

    // Windows (glass)
    g.fillStyle(0x60a5fa, 0.8);
    g.fillRect(16, 4, 8, 5);
    g.fillRect(26, 4, 8, 5);

    // Window frame
    g.fillStyle(0x0f172a);
    g.fillRect(24, 4, 2, 5);

    // Checkered stripe
    g.fillStyle(0x0f172a);
    for (let x = 6; x < 46; x += 4) {
      if ((x / 4) % 2 === 0) {
        g.fillRect(x, 14, 4, 4);
      }
    }

    // Wheels
    g.fillStyle(0x1f2937);
    g.fillCircle(12, 20, 5);
    g.fillCircle(40, 20, 5);

    // Wheel centers (hubcaps)
    g.fillStyle(0x6b7280);
    g.fillCircle(12, 20, 2);
    g.fillCircle(40, 20, 2);

    // Headlights
    g.fillStyle(0xfef3c7);
    g.fillRect(46, 12, 2, 4);

    // Taillights
    g.fillStyle(0xef4444);
    g.fillRect(4, 12, 2, 4);

    g.generateTexture("taxi", 52, 28);
    g.destroy();
  }

  // ============================================
  // ACADEMY ZONE - BAGS.FM TEAM CHARACTER SPRITES
  // ============================================

  private generateRamoSprite(): void {
    // Ramo (@ramyobags) - Co-Founder & CTO, Vienna, Superteam DE
    // Tech-focused look, professional but approachable
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf5d0c5; // Light skin
    const skinHighlight = 0xfce4d6;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Tech blue glow behind Ramo
    g.fillStyle(0x3b82f6, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x10b981, 0.1); // Bags green accent
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark pants - professional)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Shoes (clean sneakers)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Tech blue hoodie/shirt
    g.fillStyle(0x3b82f6);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Hoodie detail
    g.fillStyle(0x2563eb);
    g.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(8 * s), Math.round(4 * s));
    // Bags logo on chest (small green square)
    g.fillStyle(0x10b981);
    g.fillRect(Math.round(14 * s), Math.round(15 * s), Math.round(4 * s), Math.round(3 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    // Hands
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Dark hair (neat, professional)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    // Hair highlight
    g.fillStyle(0x2d2d2d);
    g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(4 * s), Math.round(2 * s));

    // Eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    // Eye shine
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Friendly smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("ramo", size, size);
    g.destroy();
  }

  private generateSincaraSprite(): void {
    // Sincara (@sincara_bags) - Frontend Engineer
    // Creative developer aesthetic, headphones, design-focused
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xd4a574; // Medium skin
    const skinHighlight = 0xe0b88c;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Purple creative glow
    g.fillStyle(0x8b5cf6, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0xa855f7, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark gray jeans)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Shoes (stylish)
    g.fillStyle(0x8b5cf6);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Purple hoodie (design vibes)
    g.fillStyle(0x8b5cf6);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Hoodie highlights
    g.fillStyle(0xa855f7);
    g.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(18 * s), Math.round(14 * s), Math.round(4 * s), Math.round(3 * s));
    // Design icon on shirt (paint palette)
    g.fillStyle(0xfbbf24);
    g.fillRect(Math.round(14 * s), Math.round(16 * s), Math.round(4 * s), Math.round(3 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Brown hair (styled)
    g.fillStyle(0x2d1b0e);
    g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
    g.fillRect(Math.round(22 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
    // Hair texture
    g.fillStyle(0x4a3728);
    g.fillRect(Math.round(12 * s), Math.round(1 * s), Math.round(3 * s), Math.round(2 * s));

    // Headphones (signature accessory)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(3 * s), Math.round(6 * s));
    g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(3 * s), Math.round(6 * s));
    g.fillRect(Math.round(7 * s), Math.round(-1 * s), Math.round(18 * s), Math.round(3 * s));
    // Ear cushions
    g.fillStyle(0x8b5cf6);
    g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(25 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));

    // Eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Creative smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("sincara", size, size);
    g.destroy();
  }

  private generateStuuSprite(): void {
    // Stuu (@StuuBags) - Operations & Support
    // Friendly, approachable, helpful look with Bags green
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xffdbac;
    const skinHighlight = 0xffe4c4;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Bags green glow
    g.fillStyle(0x10b981, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x22c55e, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark jeans)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Shoes
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Bags green polo shirt
    g.fillStyle(0x10b981);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Collar
    g.fillStyle(0x059669);
    g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(3 * s));
    // Polo buttons
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(15 * s), Math.round(13 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(15 * s), Math.round(15 * s), Math.round(2 * s), Math.round(1 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Brown hair (friendly, neat)
    g.fillStyle(0x8b4513);
    g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillStyle(0xa0522d);
    g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(5 * s), Math.round(2 * s));

    // Friendly eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Big friendly smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(8 * s), Math.round(1 * s));
    g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("stuu", size, size);
    g.destroy();
  }

  private generateSamSprite(): void {
    // Sam (@Sambags12) - Growth & Marketing
    // Energetic, hype energy, gold/amber colors
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf1c27d;
    const skinHighlight = 0xffd699;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Gold/amber marketing glow
    g.fillStyle(0xf59e0b, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0xfbbf24, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (stylish jeans)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Trendy sneakers
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Amber/gold jacket
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Jacket details
    g.fillStyle(0xd97706);
    g.fillRect(Math.round(15 * s), Math.round(11 * s), Math.round(2 * s), Math.round(11 * s));
    // White tee underneath
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(11 * s), Math.round(10 * s), Math.round(4 * s));

    // Arms (jacket sleeves)
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(8 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(8 * s));
    // Hands
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(19 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(25 * s), Math.round(19 * s), Math.round(3 * s), Math.round(4 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Blonde hair (trendy, styled up)
    g.fillStyle(0xffd700);
    g.fillRect(Math.round(8 * s), Math.round(-1 * s), Math.round(16 * s), Math.round(6 * s));
    g.fillRect(Math.round(7 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
    g.fillRect(Math.round(22 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
    // Styled spikes
    g.fillRect(Math.round(10 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(16 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillStyle(0xffc107);
    g.fillRect(Math.round(12 * s), Math.round(0 * s), Math.round(4 * s), Math.round(2 * s));

    // Energetic eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Excited smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(8 * s), Math.round(1 * s));
    g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("sam", size, size);
    g.destroy();
  }

  private generateAlaaSprite(): void {
    // Alaa (@alaadotsol) - Skunk Works Director
    // Mysterious, innovative, dark aesthetic with goggles
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xd4a574;
    const skinHighlight = 0xe0b88c;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Dark mysterious glow
    g.fillStyle(0x1f2937, 0.2);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x6366f1, 0.1); // Subtle purple hint
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (black pants)
    g.fillStyle(0x0f0f0f);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Dark boots
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Black lab coat/jacket
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(6 * s), Math.round(11 * s), Math.round(20 * s), Math.round(12 * s));
    // Coat details
    g.fillStyle(0x2d2d2d);
    g.fillRect(Math.round(15 * s), Math.round(11 * s), Math.round(2 * s), Math.round(12 * s));
    // Secret pocket glow (hint of experiments)
    g.fillStyle(0x6366f1);
    g.fillRect(Math.round(18 * s), Math.round(16 * s), Math.round(3 * s), Math.round(2 * s));

    // Arms (lab coat)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(3 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(25 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    // Hands
    g.fillStyle(skinTone);
    g.fillRect(Math.round(3 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(26 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Black hair (messy scientist look)
    g.fillStyle(0x0a0a0a);
    g.fillRect(Math.round(7 * s), Math.round(-1 * s), Math.round(18 * s), Math.round(6 * s));
    g.fillRect(Math.round(6 * s), Math.round(1 * s), Math.round(3 * s), Math.round(6 * s));
    g.fillRect(Math.round(23 * s), Math.round(1 * s), Math.round(3 * s), Math.round(6 * s));
    // Messy spikes
    g.fillRect(Math.round(9 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(Math.round(14 * s), Math.round(-3 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(20 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(3 * s));

    // Lab goggles (signature accessory)
    g.fillStyle(0x374151); // Frame
    g.fillRect(Math.round(8 * s), Math.round(5 * s), Math.round(7 * s), Math.round(4 * s));
    g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(7 * s), Math.round(4 * s));
    g.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
    // Goggle lens (glowing slightly)
    g.fillStyle(0x6366f1);
    g.fillRect(Math.round(9 * s), Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
    // Lens reflection
    g.fillStyle(0xa5b4fc);
    g.fillRect(Math.round(9 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));

    // Mysterious neutral expression
    g.fillStyle(0x6b5b4a);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("alaa", size, size);
    g.destroy();
  }

  private generateCarloSprite(): void {
    // Carlo (@carlobags) - Community Ambassador
    // Welcoming, friendly, wearing badge, green polo
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf5d0c5;
    const skinHighlight = 0xfce4d6;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Friendly green glow
    g.fillStyle(0x22c55e, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x10b981, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (navy pants - professional but casual)
    g.fillStyle(0x1e3a5f);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Clean shoes
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Green polo (ambassador uniform)
    g.fillStyle(0x22c55e);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Collar
    g.fillStyle(0x16a34a);
    g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(3 * s));
    // Ambassador badge (gold)
    g.fillStyle(0xfbbf24);
    g.fillRect(Math.round(18 * s), Math.round(13 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(19 * s), Math.round(14 * s), Math.round(2 * s), Math.round(2 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Brown hair (neat, professional)
    g.fillStyle(0x4a3728);
    g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillStyle(0x5c4033);
    g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(5 * s), Math.round(2 * s));

    // Welcoming eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Warm welcoming smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(1 * s));
    g.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(8 * s), Math.round(1 * s));

    g.generateTexture("carlo", size, size);
    g.destroy();
  }

  private generateBNNSprite(): void {
    // BNN (@BNNBags) - News Network Bot
    // Robot/news bot aesthetic, blue and white, screen display
    const s = SCALE;
    const size = Math.round(32 * s);
    const g = this.make.graphics({ x: 0, y: 0 });

    // News blue glow
    g.fillStyle(0x3b82f6, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x60a5fa, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Robot legs (metallic)
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    // Joint details
    g.fillStyle(0x6b7280);
    g.fillRect(Math.round(10 * s), Math.round(25 * s), Math.round(5 * s), Math.round(2 * s));
    g.fillRect(Math.round(17 * s), Math.round(25 * s), Math.round(5 * s), Math.round(2 * s));

    // Robot feet
    g.fillStyle(0x374151);
    g.fillRect(Math.round(8 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));

    // Robot body (news blue)
    g.fillStyle(0x3b82f6);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(12 * s));
    // Body panel lines
    g.fillStyle(0x2563eb);
    g.fillRect(Math.round(7 * s), Math.round(16 * s), Math.round(18 * s), Math.round(2 * s));
    // News screen on chest
    g.fillStyle(0x1e293b);
    g.fillRect(Math.round(10 * s), Math.round(13 * s), Math.round(12 * s), Math.round(6 * s));
    // Screen content (scrolling text effect)
    g.fillStyle(0x22c55e);
    g.fillRect(Math.round(11 * s), Math.round(14 * s), Math.round(8 * s), Math.round(1 * s));
    g.fillRect(Math.round(11 * s), Math.round(16 * s), Math.round(6 * s), Math.round(1 * s));

    // Robot arms (metallic)
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    // Shoulder joints
    g.fillStyle(0x6b7280);
    g.fillRect(Math.round(4 * s), Math.round(11 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(Math.round(24 * s), Math.round(11 * s), Math.round(4 * s), Math.round(2 * s));
    // Robot hands (claw-like)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));

    // Robot head (boxy, screen face)
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(16 * s), Math.round(11 * s));
    // Head border
    g.fillStyle(0x6b7280);
    g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(16 * s), Math.round(2 * s));
    g.fillRect(Math.round(8 * s), Math.round(11 * s), Math.round(16 * s), Math.round(2 * s));

    // Face screen
    g.fillStyle(0x1e293b);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(12 * s), Math.round(6 * s));

    // LED eyes (bright cyan)
    g.fillStyle(0x22d3ee);
    g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(18 * s), Math.round(5 * s), Math.round(3 * s), Math.round(3 * s));
    // Eye glow
    g.fillStyle(0x67e8f9);
    g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));

    // Antenna (for receiving news)
    g.fillStyle(0x6b7280);
    g.fillRect(Math.round(15 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(5 * s));
    // Antenna light (blinking red)
    g.fillStyle(0xef4444);
    g.fillCircle(Math.round(16 * s), Math.round(-3 * s), Math.round(2 * s));

    // Speaker mouth
    g.fillStyle(0x374151);
    g.fillRect(Math.round(13 * s), Math.round(8 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillStyle(0x22c55e); // Speaker active indicator
    g.fillRect(Math.round(14 * s), Math.round(8 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(8 * s), Math.round(1 * s), Math.round(1 * s));

    g.generateTexture("bnn", size, size);
    g.destroy();
  }
}
